//! Parallel processing module for high-performance Markdown transformation
//!
//! This module provides a thread pool implementation for processing multiple
//! Markdown files concurrently, achieving significant performance improvements
//! on multi-core systems.

pub mod task;
pub mod worker;
pub mod pool;

pub use task::{TransformTask, TaskResult, TaskBatch, TaskOptions};
pub use worker::{Worker, WorkerMessage, WorkerStats};
pub use pool::{ThreadPool, ThreadPoolBuilder, PoolStats};

use std::sync::Once;

static INIT: Once = Once::new();

/// Initialize the parallel processing subsystem
pub fn initialize() {
    INIT.call_once(|| {
        tracing::info!("Initializing parallel processing subsystem");
        
        // Log system information
        let num_cpus = num_cpus::get();
        let num_physical = num_cpus::get_physical();
        
        tracing::info!(
            "System has {} logical CPUs ({} physical cores)",
            num_cpus,
            num_physical
        );
    });
}

/// Get the recommended number of worker threads
pub fn recommended_workers() -> usize {
    // Use physical cores for CPU-bound work
    let physical = num_cpus::get_physical();
    
    // But don't use more than 8 workers by default to avoid overhead
    physical.min(8)
}

/// Configuration for parallel processing
#[derive(Debug, Clone)]
pub struct ParallelConfig {
    pub enabled: bool,
    pub num_workers: Option<usize>,
    pub batch_size: usize,
    pub queue_size: usize,
}

impl Default for ParallelConfig {
    fn default() -> Self {
        ParallelConfig {
            enabled: true,
            num_workers: None, // Auto-detect
            batch_size: 10,
            queue_size: 1000,
        }
    }
}

impl ParallelConfig {
    /// Create config from environment variables
    pub fn from_env() -> Self {
        let mut config = Self::default();
        
        if let Ok(val) = std::env::var("FASTMD_PARALLEL") {
            config.enabled = val.to_lowercase() != "false";
        }
        
        if let Ok(val) = std::env::var("FASTMD_WORKERS") {
            if let Ok(num) = val.parse::<usize>() {
                config.num_workers = Some(num);
            }
        }
        
        if let Ok(val) = std::env::var("FASTMD_BATCH_SIZE") {
            if let Ok(size) = val.parse::<usize>() {
                config.batch_size = size;
            }
        }
        
        config
    }
}

/// Global thread pool instance (optional singleton pattern)
static mut GLOBAL_POOL: Option<ThreadPool> = None;
static POOL_INIT: Once = Once::new();

/// Get or create the global thread pool
pub fn global_pool() -> Option<&'static ThreadPool> {
    unsafe {
        POOL_INIT.call_once(|| {
            let config = ParallelConfig::from_env();
            if config.enabled {
                initialize();
                let pool = ThreadPoolBuilder::new()
                    .workers(config.num_workers.unwrap_or_else(recommended_workers))
                    .queue_size(config.queue_size)
                    .build();
                GLOBAL_POOL = Some(pool);
            }
        });
        GLOBAL_POOL.as_ref()
    }
}

/// Shutdown the global thread pool
pub fn shutdown_global_pool() {
    unsafe {
        if let Some(pool) = GLOBAL_POOL.take() {
            pool.shutdown();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recommended_workers() {
        let workers = recommended_workers();
        assert!(workers > 0);
        assert!(workers <= 8);
    }

    #[test]
    fn test_parallel_config_default() {
        let config = ParallelConfig::default();
        assert!(config.enabled);
        assert_eq!(config.batch_size, 10);
        assert_eq!(config.queue_size, 1000);
    }

    #[test]
    fn test_initialization() {
        initialize();
        // Should not panic on multiple calls
        initialize();
    }
}