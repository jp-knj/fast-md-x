use std::sync::Arc;
use std::thread;
use crossbeam_channel::{Receiver, Sender};
use parking_lot::Mutex;
use crate::parallel::task::{TransformTask, TaskResult};
use crate::transform::markdown_to_html;
use std::time::Instant;

/// Message types for worker communication
#[derive(Debug)]
pub enum WorkerMessage {
    Task(TransformTask),
    Shutdown,
}

/// Worker thread that processes transformation tasks
pub struct Worker {
    id: usize,
    thread: Option<thread::JoinHandle<()>>,
}

impl Worker {
    /// Create and start a new worker
    pub fn spawn(
        id: usize,
        receiver: Arc<Mutex<Receiver<WorkerMessage>>>,
        sender: Sender<TaskResult>,
    ) -> Self {
        let thread = thread::spawn(move || {
            Worker::run(id, receiver, sender);
        });

        Worker {
            id,
            thread: Some(thread),
        }
    }

    /// Worker main loop
    fn run(
        id: usize,
        receiver: Arc<Mutex<Receiver<WorkerMessage>>>,
        sender: Sender<TaskResult>,
    ) {
        tracing::debug!("Worker {} started", id);

        loop {
            // Lock receiver only for receiving, not for processing
            let message = {
                let rx = receiver.lock();
                rx.recv()
            };

            match message {
                Ok(WorkerMessage::Task(task)) => {
                    let start = Instant::now();
                    let result = Worker::process_task(task);
                    let duration_ms = start.elapsed().as_millis() as u64;

                    // Update result with actual duration
                    let result = match result {
                        TaskResult::Success { id, code, map, metadata, .. } => {
                            TaskResult::Success {
                                id,
                                code,
                                map,
                                metadata,
                                duration_ms,
                            }
                        }
                        failure => failure,
                    };

                    if let Err(e) = sender.send(result) {
                        tracing::error!("Worker {} failed to send result: {}", id, e);
                        break;
                    }
                }
                Ok(WorkerMessage::Shutdown) => {
                    tracing::debug!("Worker {} shutting down", id);
                    break;
                }
                Err(e) => {
                    tracing::error!("Worker {} channel error: {}", id, e);
                    break;
                }
            }
        }

        tracing::debug!("Worker {} stopped", id);
    }

    /// Process a single transformation task
    fn process_task(task: TransformTask) -> TaskResult {
        match markdown_to_html(&task.content) {
            Ok(html) => TaskResult::Success {
                id: task.id,
                code: html,
                map: None,
                metadata: None,
                duration_ms: 0, // Will be updated by caller
            },
            Err(e) => TaskResult::Failure {
                id: task.id,
                error: e.to_string(),
                recoverable: true,
            },
        }
    }

    /// Get worker ID
    pub fn id(&self) -> usize {
        self.id
    }

    /// Join worker thread
    pub fn join(mut self) -> thread::Result<()> {
        if let Some(thread) = self.thread.take() {
            thread.join()
        } else {
            Ok(())
        }
    }
}

/// Worker pool statistics
#[derive(Debug, Clone, Default)]
pub struct WorkerStats {
    pub tasks_processed: usize,
    pub total_duration_ms: u64,
    pub errors: usize,
}

impl WorkerStats {
    pub fn record_success(&mut self, duration_ms: u64) {
        self.tasks_processed += 1;
        self.total_duration_ms += duration_ms;
    }

    pub fn record_failure(&mut self) {
        self.errors += 1;
    }

    pub fn average_duration_ms(&self) -> f64 {
        if self.tasks_processed == 0 {
            0.0
        } else {
            self.total_duration_ms as f64 / self.tasks_processed as f64
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_worker_processes_task() {
        let (tx, rx) = crossbeam_channel::unbounded();
        let (result_tx, result_rx) = crossbeam_channel::unbounded();
        let rx = Arc::new(Mutex::new(rx));

        // Start worker
        let worker = Worker::spawn(0, rx, result_tx);

        // Send task
        let task = TransformTask::new(
            "test-1".to_string(),
            PathBuf::from("test.md"),
            "# Hello World".to_string(),
        );
        tx.send(WorkerMessage::Task(task)).unwrap();

        // Get result
        let result = result_rx.recv_timeout(std::time::Duration::from_secs(1)).unwrap();
        assert!(result.is_success());
        assert_eq!(result.id(), "test-1");

        // Shutdown
        tx.send(WorkerMessage::Shutdown).unwrap();
        worker.join().unwrap();
    }

    #[test]
    fn test_worker_stats() {
        let mut stats = WorkerStats::default();
        
        stats.record_success(10);
        stats.record_success(20);
        stats.record_failure();
        
        assert_eq!(stats.tasks_processed, 2);
        assert_eq!(stats.total_duration_ms, 30);
        assert_eq!(stats.errors, 1);
        assert_eq!(stats.average_duration_ms(), 15.0);
    }
}