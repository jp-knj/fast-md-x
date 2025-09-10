use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// A task to be processed by a worker thread
#[derive(Debug, Clone)]
pub struct TransformTask {
    /// Unique identifier for this task
    pub id: String,
    /// File path being processed
    pub file: PathBuf,
    /// Content to transform
    pub content: String,
    /// Processing options
    pub options: TaskOptions,
    /// Priority (higher = more important)
    pub priority: u32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TaskOptions {
    pub mode: Option<String>,
    pub sourcemap: Option<bool>,
    pub framework: Option<String>,
}

/// Result of a transformation task
#[derive(Debug, Clone)]
pub enum TaskResult {
    Success {
        id: String,
        code: String,
        map: Option<serde_json::Value>,
        metadata: Option<serde_json::Value>,
        duration_ms: u64,
    },
    Failure {
        id: String,
        error: String,
        recoverable: bool,
    },
}

impl TransformTask {
    pub fn new(id: String, file: PathBuf, content: String) -> Self {
        Self {
            id,
            file,
            content,
            options: TaskOptions::default(),
            priority: 0,
        }
    }

    pub fn with_options(mut self, options: TaskOptions) -> Self {
        self.options = options;
        self
    }

    pub fn with_priority(mut self, priority: u32) -> Self {
        self.priority = priority;
        self
    }

    /// Estimate task size for load balancing
    pub fn estimated_cost(&self) -> usize {
        // Base cost on content size and complexity
        let size_cost = self.content.len();
        let complexity_multiplier = if self.content.contains("```") {
            2 // Code blocks are more expensive
        } else {
            1
        };
        size_cost * complexity_multiplier
    }
}

impl TaskResult {
    pub fn id(&self) -> &str {
        match self {
            TaskResult::Success { id, .. } => id,
            TaskResult::Failure { id, .. } => id,
        }
    }

    pub fn is_success(&self) -> bool {
        matches!(self, TaskResult::Success { .. })
    }

    pub fn is_failure(&self) -> bool {
        matches!(self, TaskResult::Failure { .. })
    }
}

/// Batch of tasks to process together
#[derive(Debug)]
pub struct TaskBatch {
    pub id: String,
    pub tasks: Vec<TransformTask>,
    pub total_cost: usize,
}

impl TaskBatch {
    pub fn new(id: String, tasks: Vec<TransformTask>) -> Self {
        let total_cost = tasks.iter().map(|t| t.estimated_cost()).sum();
        Self {
            id,
            tasks,
            total_cost,
        }
    }

    /// Split batch into smaller chunks for parallel processing
    pub fn split(self, num_chunks: usize) -> Vec<Vec<TransformTask>> {
        if num_chunks <= 1 || self.tasks.len() <= num_chunks {
            return vec![self.tasks];
        }

        let chunk_size = (self.tasks.len() + num_chunks - 1) / num_chunks;
        self.tasks
            .into_iter()
            .collect::<Vec<_>>()
            .chunks(chunk_size)
            .map(|chunk| chunk.to_vec())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_creation() {
        let task = TransformTask::new(
            "test-1".to_string(),
            PathBuf::from("test.md"),
            "# Test".to_string(),
        );
        assert_eq!(task.id, "test-1");
        assert_eq!(task.priority, 0);
    }

    #[test]
    fn test_task_cost_estimation() {
        let simple = TransformTask::new(
            "1".to_string(),
            PathBuf::from("simple.md"),
            "Hello world".to_string(),
        );
        assert_eq!(simple.estimated_cost(), 11);

        let complex = TransformTask::new(
            "2".to_string(),
            PathBuf::from("complex.md"),
            "```rust\ncode\n```".to_string(),
        );
        assert_eq!(complex.estimated_cost(), 34); // 17 * 2
    }

    #[test]
    fn test_batch_splitting() {
        let tasks: Vec<TransformTask> = (0..10)
            .map(|i| {
                TransformTask::new(
                    format!("task-{}", i),
                    PathBuf::from(format!("file-{}.md", i)),
                    format!("Content {}", i),
                )
            })
            .collect();

        let batch = TaskBatch::new("batch-1".to_string(), tasks);
        let chunks = batch.split(3);
        
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].len(), 4);
        assert_eq!(chunks[1].len(), 3);
        assert_eq!(chunks[2].len(), 3);
    }
}