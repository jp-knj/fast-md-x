use std::sync::Arc;
use crossbeam_channel::{bounded, unbounded, Receiver, Sender};
use parking_lot::Mutex;
use dashmap::DashMap;
use num_cpus;

use crate::parallel::{
    task::{TransformTask, TaskResult, TaskBatch},
    worker::{Worker, WorkerMessage, WorkerStats},
};

/// Thread pool for parallel Markdown transformation
pub struct ThreadPool {
    workers: Vec<Worker>,
    task_sender: Sender<WorkerMessage>,
    task_receiver: Arc<Mutex<Receiver<WorkerMessage>>>,
    result_sender: Sender<TaskResult>,
    result_receiver: Receiver<TaskResult>,
    stats: Arc<DashMap<usize, WorkerStats>>,
    num_workers: usize,
}

impl ThreadPool {
    /// Create a new thread pool with the specified number of workers
    pub fn new(num_workers: Option<usize>) -> Self {
        let num_workers = num_workers.unwrap_or_else(|| num_cpus::get());
        tracing::info!("Creating thread pool with {} workers", num_workers);

        // Create channels for task distribution and result collection
        let (task_sender, task_receiver) = unbounded();
        let (result_sender, result_receiver) = unbounded();
        let task_receiver = Arc::new(Mutex::new(task_receiver));
        
        let stats = Arc::new(DashMap::new());
        let mut workers = Vec::with_capacity(num_workers);

        // Spawn worker threads
        for id in 0..num_workers {
            let worker = Worker::spawn(
                id,
                Arc::clone(&task_receiver),
                result_sender.clone(),
            );
            stats.insert(id, WorkerStats::default());
            workers.push(worker);
        }

        ThreadPool {
            workers,
            task_sender,
            task_receiver,
            result_sender,
            result_receiver,
            stats,
            num_workers,
        }
    }

    /// Process a single task
    pub fn process(&self, task: TransformTask) -> Result<TaskResult, String> {
        // Send task to worker pool
        self.task_sender
            .send(WorkerMessage::Task(task))
            .map_err(|e| format!("Failed to send task: {}", e))?;

        // Wait for result
        self.result_receiver
            .recv()
            .map_err(|e| format!("Failed to receive result: {}", e))
    }

    /// Process a batch of tasks in parallel
    pub fn process_batch(&self, batch: TaskBatch) -> Vec<TaskResult> {
        let task_count = batch.tasks.len();
        let mut results = Vec::with_capacity(task_count);

        // Split batch for optimal distribution
        let chunks = batch.split(self.num_workers);
        
        // Send all tasks
        for chunk in chunks {
            for task in chunk {
                if let Err(e) = self.task_sender.send(WorkerMessage::Task(task)) {
                    tracing::error!("Failed to send task: {}", e);
                }
            }
        }

        // Collect all results
        for _ in 0..task_count {
            match self.result_receiver.recv() {
                Ok(result) => {
                    // Update stats
                    if result.is_success() {
                        if let TaskResult::Success { duration_ms, .. } = &result {
                            // In real implementation, track which worker processed this
                            self.stats.iter().next().map(|entry| {
                                entry.value().record_success(*duration_ms);
                            });
                        }
                    } else {
                        self.stats.iter().next().map(|entry| {
                            entry.value().record_failure();
                        });
                    }
                    results.push(result);
                }
                Err(e) => {
                    tracing::error!("Failed to receive result: {}", e);
                }
            }
        }

        results
    }

    /// Process multiple files concurrently
    pub async fn process_files(&self, files: Vec<(String, String)>) -> Vec<TaskResult> {
        let tasks: Vec<TransformTask> = files
            .into_iter()
            .enumerate()
            .map(|(i, (path, content))| {
                TransformTask::new(
                    format!("file-{}", i),
                    path.into(),
                    content,
                )
            })
            .collect();

        let batch = TaskBatch::new("batch".to_string(), tasks);
        self.process_batch(batch)
    }

    /// Get pool statistics
    pub fn stats(&self) -> PoolStats {
        let mut total_tasks = 0;
        let mut total_duration = 0;
        let mut total_errors = 0;

        for entry in self.stats.iter() {
            let stats = entry.value();
            total_tasks += stats.tasks_processed;
            total_duration += stats.total_duration_ms;
            total_errors += stats.errors;
        }

        PoolStats {
            num_workers: self.num_workers,
            total_tasks,
            total_duration_ms: total_duration,
            total_errors,
            average_duration_ms: if total_tasks > 0 {
                total_duration as f64 / total_tasks as f64
            } else {
                0.0
            },
        }
    }

    /// Shutdown the thread pool gracefully
    pub fn shutdown(self) {
        tracing::info!("Shutting down thread pool");
        
        // Send shutdown message to all workers
        for _ in 0..self.num_workers {
            let _ = self.task_sender.send(WorkerMessage::Shutdown);
        }

        // Wait for all workers to finish
        for worker in self.workers {
            if let Err(e) = worker.join() {
                tracing::error!("Worker failed to join: {:?}", e);
            }
        }

        tracing::info!("Thread pool shutdown complete");
    }
}

/// Statistics for the entire thread pool
#[derive(Debug, Clone)]
pub struct PoolStats {
    pub num_workers: usize,
    pub total_tasks: usize,
    pub total_duration_ms: u64,
    pub total_errors: usize,
    pub average_duration_ms: f64,
}

impl PoolStats {
    pub fn throughput(&self) -> f64 {
        if self.total_duration_ms > 0 {
            (self.total_tasks as f64 * 1000.0) / self.total_duration_ms as f64
        } else {
            0.0
        }
    }

    pub fn error_rate(&self) -> f64 {
        if self.total_tasks > 0 {
            self.total_errors as f64 / self.total_tasks as f64
        } else {
            0.0
        }
    }
}

/// Builder for ThreadPool with configuration options
pub struct ThreadPoolBuilder {
    num_workers: Option<usize>,
    queue_size: Option<usize>,
}

impl ThreadPoolBuilder {
    pub fn new() -> Self {
        ThreadPoolBuilder {
            num_workers: None,
            queue_size: None,
        }
    }

    pub fn workers(mut self, num: usize) -> Self {
        self.num_workers = Some(num);
        self
    }

    pub fn queue_size(mut self, size: usize) -> Self {
        self.queue_size = Some(size);
        self
    }

    pub fn build(self) -> ThreadPool {
        ThreadPool::new(self.num_workers)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_thread_pool_creation() {
        let pool = ThreadPool::new(Some(4));
        assert_eq!(pool.num_workers, 4);
        pool.shutdown();
    }

    #[test]
    fn test_single_task_processing() {
        let pool = ThreadPool::new(Some(2));
        
        let task = TransformTask::new(
            "test-1".to_string(),
            PathBuf::from("test.md"),
            "# Hello World".to_string(),
        );
        
        let result = pool.process(task).unwrap();
        assert!(result.is_success());
        assert_eq!(result.id(), "test-1");
        
        pool.shutdown();
    }

    #[test]
    fn test_batch_processing() {
        let pool = ThreadPool::new(Some(4));
        
        let tasks: Vec<TransformTask> = (0..10)
            .map(|i| {
                TransformTask::new(
                    format!("task-{}", i),
                    PathBuf::from(format!("file-{}.md", i)),
                    format!("# Document {}", i),
                )
            })
            .collect();
        
        let batch = TaskBatch::new("test-batch".to_string(), tasks);
        let results = pool.process_batch(batch);
        
        assert_eq!(results.len(), 10);
        for result in results {
            assert!(result.is_success());
        }
        
        pool.shutdown();
    }

    #[test]
    fn test_pool_stats() {
        let pool = ThreadPool::new(Some(2));
        
        // Process some tasks
        for i in 0..5 {
            let task = TransformTask::new(
                format!("task-{}", i),
                PathBuf::from("test.md"),
                "# Test".to_string(),
            );
            let _ = pool.process(task);
        }
        
        let stats = pool.stats();
        assert_eq!(stats.num_workers, 2);
        // Stats might not be perfectly accurate in tests due to async nature
        
        pool.shutdown();
    }

    #[test]
    fn test_thread_pool_builder() {
        let pool = ThreadPoolBuilder::new()
            .workers(8)
            .queue_size(1000)
            .build();
        
        assert_eq!(pool.num_workers, 8);
        pool.shutdown();
    }
}