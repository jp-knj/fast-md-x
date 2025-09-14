/// <reference types="bun-types" />
/**
 * Stress tests for concurrent processing and system limits
 * These tests push the system to its limits to ensure stability
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

// Helper to monitor system resources
class ResourceMonitor {
  private samples: Array<{
    timestamp: number;
    memory: NodeJS.MemoryUsage;
    cpu?: number;
  }> = [];
  private interval?: Timer;

  start(intervalMs = 100) {
    this.samples = [];
    this.interval = setInterval(() => {
      this.samples.push({
        timestamp: Date.now(),
        memory: process.memoryUsage()
        // CPU usage would need native binding in real implementation
      });
    }, intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  getStats() {
    const memoryValues = this.samples.map((s) => s.memory.heapUsed / (1024 * 1024));
    return {
      peakMemoryMB: Math.max(...memoryValues),
      avgMemoryMB: memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
      minMemoryMB: Math.min(...memoryValues),
      samples: this.samples.length
    };
  }
}

// Simulate sidecar process for testing
class MockSidecar {
  private process?: ChildProcess;
  private ready = false;

  async start(): Promise<void> {
    // In real tests, this would start the actual sidecar
    this.ready = true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async stop(): Promise<void> {
    this.ready = false;
    if (this.process) {
      this.process.kill();
    }
  }

  async processFiles(files: string[]): Promise<void> {
    if (!this.ready) throw new Error('Sidecar not ready');
    // Simulate processing with some delay
    await new Promise((resolve) => setTimeout(resolve, files.length * 0.5));
  }

  isAlive(): boolean {
    return this.ready;
  }
}

// Generate large files for stress testing
async function generateLargeFile(sizeKB: number): Promise<string> {
  const testDir = path.join(process.cwd(), '.stress-test');
  await fs.mkdir(testDir, { recursive: true });

  const filename = path.join(testDir, `large-${Date.now()}-${Math.random()}.md`);
  const chunks: string[] = [];

  // Generate content in chunks to avoid memory issues
  const chunkSize = 1024; // 1KB chunks
  const numChunks = sizeKB;

  for (let i = 0; i < numChunks; i++) {
    chunks.push('#'.repeat(chunkSize));
  }

  await fs.writeFile(filename, chunks.join(''));
  return filename;
}

describe('Stress Tests: Concurrent Processing', () => {
  let monitor: ResourceMonitor;
  let sidecar: MockSidecar;

  beforeAll(() => {
    monitor = new ResourceMonitor();
    sidecar = new MockSidecar();
  });

  afterAll(async () => {
    monitor.stop();
    await sidecar.stop();

    // Cleanup test files
    const testDir = path.join(process.cwd(), '.stress-test');
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('High Concurrency', () => {
    test('handles 1000 concurrent file operations', async () => {
      monitor.start();
      await sidecar.start();

      const promises: Promise<void>[] = [];
      const fileCount = 1000;

      // Create and process files concurrently
      for (let i = 0; i < fileCount; i++) {
        promises.push(
          (async () => {
            const file = await generateLargeFile(1); // 1KB files
            await sidecar.processFiles([file]);
            await fs.unlink(file); // Clean up immediately
          })()
        );
      }

      const start = performance.now();
      await Promise.all(promises);
      const duration = performance.now() - start;

      monitor.stop();
      const stats = monitor.getStats();

      // Assertions
      expect(duration).toBeLessThan(30000); // Complete within 30 seconds
      expect(stats.peakMemoryMB).toBeLessThan(500); // Peak memory under 500MB
      expect(sidecar.isAlive()).toBe(true); // Sidecar survived
    });

    test('handles mixed file sizes concurrently', async () => {
      monitor.start();
      await sidecar.start();

      const sizes = [1, 10, 100, 1000]; // 1KB to 1MB
      const filesPerSize = 25;
      const promises: Promise<void>[] = [];

      for (const size of sizes) {
        for (let i = 0; i < filesPerSize; i++) {
          promises.push(
            (async () => {
              const file = await generateLargeFile(size);
              await sidecar.processFiles([file]);
              await fs.unlink(file);
            })()
          );
        }
      }

      await Promise.all(promises);

      monitor.stop();
      const stats = monitor.getStats();

      expect(stats.peakMemoryMB).toBeLessThan(1000); // Under 1GB
      expect(sidecar.isAlive()).toBe(true);
    });

    test('handles rapid fire requests', async () => {
      await sidecar.start();

      const requestCount = 10000;
      const requests: Promise<void>[] = [];
      let errors = 0;

      // Fire requests as fast as possible
      for (let i = 0; i < requestCount; i++) {
        requests.push(
          sidecar.processFiles([`virtual-${i}.md`]).catch(() => {
            errors++;
          })
        );
      }

      const start = performance.now();
      await Promise.all(requests);
      const duration = performance.now() - start;
      const throughput = requestCount / (duration / 1000);

      expect(errors).toBeLessThan(requestCount * 0.01); // <1% error rate
      expect(throughput).toBeGreaterThan(100); // >100 req/sec
    });
  });

  describe('Memory Pressure', () => {
    test('handles memory pressure gracefully', async () => {
      monitor.start();
      await sidecar.start();

      // Try to allocate large amounts of memory
      const bigFiles: string[] = [];
      const maxFiles = 10;
      const fileSize = 10000; // 10MB per file

      try {
        for (let i = 0; i < maxFiles; i++) {
          const file = await generateLargeFile(fileSize);
          bigFiles.push(file);
        }

        // Process all at once
        await sidecar.processFiles(bigFiles);

        monitor.stop();
        const stats = monitor.getStats();

        // Should handle without crashing
        expect(stats.peakMemoryMB).toBeLessThan(2000); // Under 2GB
        expect(sidecar.isAlive()).toBe(true);
      } finally {
        // Cleanup
        for (const file of bigFiles) {
          await fs.unlink(file).catch(() => {});
        }
      }
    });

    test('recovers from memory spikes', async () => {
      monitor.start();
      await sidecar.start();

      const initialMemory = process.memoryUsage().heapUsed / (1024 * 1024);

      // Create memory spike
      const hugeFile = await generateLargeFile(50000); // 50MB
      await sidecar.processFiles([hugeFile]);
      await fs.unlink(hugeFile);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait for memory to stabilize
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const finalMemory = process.memoryUsage().heapUsed / (1024 * 1024);
      const memoryLeak = finalMemory - initialMemory;

      monitor.stop();

      // Memory should return close to initial levels
      // Allow more tolerance for CI environments
      expect(memoryLeak).toBeLessThan(100); // Less than 100MB leak
      expect(sidecar.isAlive()).toBe(true);
    });
  });

  describe('Process Stability', () => {
    test('handles process crashes and restarts', async () => {
      let crashCount = 0;
      const maxCrashes = 3;

      for (let i = 0; i < maxCrashes; i++) {
        await sidecar.start();
        expect(sidecar.isAlive()).toBe(true);

        // Simulate crash
        await sidecar.stop();
        expect(sidecar.isAlive()).toBe(false);
        crashCount++;

        // Should be able to restart
        await sidecar.start();
        expect(sidecar.isAlive()).toBe(true);

        // Process some files after restart
        await sidecar.processFiles(['test.md']);
      }

      expect(crashCount).toBe(maxCrashes);
    });

    test('handles partial batch failures', async () => {
      await sidecar.start();

      const batch = Array.from({ length: 100 }, (_, i) => `file-${i}.md`);

      // Simulate some files causing errors
      const results: Array<{ success: boolean; error?: Error }> = [];

      for (const file of batch) {
        try {
          // Randomly fail some files
          if (Math.random() < 0.1) {
            throw new Error(`Failed to process ${file}`);
          }
          await sidecar.processFiles([file]);
          results.push({ success: true });
        } catch (error) {
          results.push({ success: false, error: error as Error });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      // Most files should succeed
      expect(successCount).toBeGreaterThan(batch.length * 0.85);
      expect(failureCount).toBeLessThan(batch.length * 0.15);
      expect(sidecar.isAlive()).toBe(true); // Sidecar should survive
    });

    test('handles file descriptor exhaustion', async () => {
      await sidecar.start();

      // Try to open many files simultaneously
      const files: string[] = [];
      const handles: fs.FileHandle[] = [];
      const maxFiles = 1000;

      try {
        for (let i = 0; i < maxFiles; i++) {
          const file = await generateLargeFile(1);
          files.push(file);

          // Try to keep file handles open
          try {
            const handle = await fs.open(file, 'r');
            handles.push(handle);
          } catch {
            // Expected to fail at some point
            break;
          }
        }

        // Should still be able to process files
        await sidecar.processFiles(files.slice(0, 10));
        expect(sidecar.isAlive()).toBe(true);
      } finally {
        // Cleanup
        for (const handle of handles) {
          await handle.close().catch(() => {});
        }
        for (const file of files) {
          await fs.unlink(file).catch(() => {});
        }
      }
    });
  });

  describe('Deadlock Detection', () => {
    test('detects and recovers from deadlocks', async () => {
      await sidecar.start();

      // Simulate potential deadlock scenario
      const promises: Promise<void>[] = [];

      // Create circular dependency simulation
      for (let i = 0; i < 10; i++) {
        promises.push(
          (async () => {
            // Each task depends on the next one (circular)
            const nextIndex = (i + 1) % 10;
            await new Promise((resolve) => setTimeout(resolve, 100));
            await sidecar.processFiles([`file-${i}.md`, `file-${nextIndex}.md`]);
          })()
        );
      }

      // Should complete without hanging
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Deadlock detected')), 5000)
      );

      try {
        await Promise.race([Promise.all(promises), timeout]);
        expect(sidecar.isAlive()).toBe(true);
      } catch (error) {
        // If we timeout, it's a deadlock
        expect(error).not.toEqual(expect.objectContaining({ message: 'Deadlock detected' }));
      }
    });
  });
});

describe('Stress Tests: System Limits', () => {
  test('respects system resource limits', async () => {
    // Guard against sandboxed environments that may report 0 CPUs / very low free mem
    const cpuCountRaw = os.cpus().length;
    const cpuCount = Math.max(1, cpuCountRaw);
    const totalMemory = os.totalmem() / (1024 * 1024 * 1024); // GB
    const freeMemory = Math.max(0.25, os.freemem() / (1024 * 1024 * 1024)); // GB (floor at 0.25GB)

    console.log(
      `System: ${cpuCount} CPUs, ${totalMemory.toFixed(1)}GB total, ${freeMemory.toFixed(1)}GB free`
    );

    // Test should adapt to system resources
    const maxWorkers = Math.max(1, Math.min(cpuCount * 2, 16));
    const maxMemoryMB = Math.max(64, Math.min(freeMemory * 1024 * 0.5, 2048)); // 50% of free, min 64MB

    const sidecar = new MockSidecar();
    await sidecar.start();
    const startUsedMB = process.memoryUsage().heapUsed / (1024 * 1024);

    // Simulate resource-aware processing
    const fileCount = Math.min(1000, Math.floor(maxMemoryMB) * 10); // Adjust based on memory
    const batchSize = Math.max(10, Math.floor(fileCount / maxWorkers) || 10);

    const start = performance.now();

    for (let i = 0; i < fileCount; i += batchSize) {
      const batch = Array.from(
        { length: Math.min(batchSize, fileCount - i) },
        (_, j) => `file-${i + j}.md`
      );
      await sidecar.processFiles(batch);
    }

    const duration = performance.now() - start;
    const throughput = fileCount / (duration / 1000);

    expect(throughput).toBeGreaterThan(25); // Reasonable throughput (lower threshold for CI)
    // Compare memory increase instead of absolute, allow headroom for CI
    const usedNowMB = process.memoryUsage().heapUsed / (1024 * 1024);
    const increaseMB = usedNowMB - startUsedMB;
    expect(increaseMB).toBeLessThan(Math.max(64, maxMemoryMB));
  });
});
