#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Parse arguments
const args = process.argv.slice(2);
const engine = args.find((a) => a.startsWith('--engine='))?.split('=')[1] || 'js';
const pages = Number.parseInt(args.find((a) => a.startsWith('--pages='))?.split('=')[1] || '10');
const heavy = args.includes('--heavy');

console.log(`Benchmark Configuration:`);
console.log(`  Engine: ${engine}`);
console.log(`  Pages: ${pages}`);
console.log(`  Heavy content: ${heavy}`);
console.log('');

// Create test content
function generateMarkdown(index, heavy = false) {
  const content = [`# Test Page ${index}`, ''];

  // Add frontmatter
  content.push('---');
  content.push(`title: Test Page ${index}`);
  content.push(`date: ${new Date().toISOString()}`);
  content.push(`tags: [test, benchmark, page${index}]`);
  content.push('---');
  content.push('');

  // Add content
  content.push(`This is test page number ${index}.`);
  content.push('');

  if (heavy) {
    // Add tables
    content.push('## Data Table');
    content.push('');
    content.push('| Column A | Column B | Column C |');
    content.push('|----------|----------|----------|');
    for (let i = 0; i < 20; i++) {
      content.push(`| Data ${i}A | Data ${i}B | Data ${i}C |`);
    }
    content.push('');

    // Add code blocks
    content.push('## Code Examples');
    content.push('');
    content.push('```javascript');
    content.push('function example() {');
    content.push('  return "Hello from benchmark";');
    content.push('}');
    content.push('```');
    content.push('');

    // Add lists
    content.push('## Task List');
    content.push('');
    for (let i = 0; i < 10; i++) {
      content.push(`- [${i % 2 === 0 ? 'x' : ' '}] Task item ${i}`);
    }
    content.push('');

    // Add long paragraphs
    for (let i = 0; i < 5; i++) {
      content.push(`Lorem ipsum dolor sit amet, consectetur adipiscing elit. ${i} `.repeat(10));
      content.push('');
    }
  }

  return content.join('\n');
}

// Setup test directory
const testDir = join(__dirname, 'test-pages');
rmSync(testDir, { recursive: true, force: true });
mkdirSync(testDir, { recursive: true });

// Generate test files
const files = [];
for (let i = 0; i < pages; i++) {
  const filename = `page-${i}.md`;
  const filepath = join(testDir, filename);
  const content = generateMarkdown(i, heavy);
  writeFileSync(filepath, content);
  files.push(filepath);
}

// Run benchmark for each engine
async function runBenchmark(engineMode) {
  return new Promise((resolve) => {
    const env = { ...process.env, FASTMD_RS: engineMode };

    const startTime = performance.now();
    const child = spawn('node', [join(__dirname, 'transform-test.mjs'), ...files], {
      env,
      stdio: 'pipe'
    });

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      console.error(`[${engineMode}] Error:`, data.toString());
    });

    child.on('close', (code) => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      resolve({
        engine: engineMode,
        duration,
        success: code === 0,
        output
      });
    });
  });
}

// Main benchmark
async function main() {
  const results = [];

  // Run JS baseline
  console.log('Running JS baseline...');
  const jsResult = await runBenchmark('off');
  results.push(jsResult);

  // Run Sidecar if requested
  if (engine === 'sidecar' || engine === 'all') {
    console.log('Running Sidecar engine...');
    const sidecarResult = await runBenchmark('sidecar');
    results.push(sidecarResult);
  }

  // Run WASM if requested
  if (engine === 'wasm' || engine === 'all') {
    console.log('Running WASM engine...');
    const wasmResult = await runBenchmark('wasm');
    results.push(wasmResult);
  }

  // Output results in NDJSON format
  console.log('\n=== Results (NDJSON) ===');
  for (const result of results) {
    const output = {
      evt: 'benchmark',
      engine: result.engine,
      pages,
      heavy,
      durationMs: result.duration.toFixed(2),
      success: result.success,
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(output));
  }

  // Summary table
  console.log('\n=== Summary ===');
  console.log('Engine     | Duration (ms) | Status');
  console.log('-----------|---------------|-------');
  for (const result of results) {
    console.log(
      `${result.engine.padEnd(10)} | ${result.duration.toFixed(2).padStart(13)} | ${result.success ? '✓' : '✗'}`
    );
  }

  // Calculate speedup
  if (results.length > 1) {
    const baseline = results.find((r) => r.engine === 'off');
    console.log('\n=== Speedup vs JS ===');
    for (const result of results) {
      if (result.engine !== 'off') {
        const speedup = ((baseline.duration / result.duration - 1) * 100).toFixed(1);
        const faster = result.duration < baseline.duration;
        console.log(
          `${result.engine}: ${faster ? '+' : ''}${speedup}% ${faster ? 'faster' : 'slower'}`
        );
      }
    }
  }

  // Cleanup
  rmSync(testDir, { recursive: true, force: true });
}

main().catch(console.error);
