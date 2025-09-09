#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');

// JS implementations
function stripBOM(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function normalizeNewlines(s) {
  return s.replace(/\r\n?/g, '\n');
}

function normalizeContentJS(s) {
  return normalizeNewlines(stripBOM(s));
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function depsDigestJS(paths) {
  const lines = [];
  for (const p of paths) {
    try {
      const stats = fs.statSync(p);
      lines.push(`${p}|${stats.size}|${Math.floor(stats.mtimeMs)}`);
    } catch {
      lines.push(`${p}|0|0`);
    }
  }
  lines.sort();
  return sha256(lines.join('\n') + (lines.length ? '\n' : ''));
}

// Try to load WASM implementation
let wasmModule = null;
try {
  process.env.FASTMD_NATIVE = '1';
  wasmModule = require('../native/fastmd-native');
  console.log('✅ WASM module loaded successfully\n');
} catch (err) {
  console.error('❌ Failed to load WASM module:', err.message);
  process.exit(1);
}

// Helper to measure execution time
function benchmark(name, fn, iterations = 1000) {
  // Warmup
  for (let i = 0; i < 100; i++) fn();

  // Measure
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();

  return {
    name,
    totalTime: end - start,
    avgTime: (end - start) / iterations,
    iterations
  };
}

// Generate test content
function generateMDContent(sizeKB) {
  const lines = [];
  lines.push('---');
  lines.push('title: Test Document');
  lines.push('date: 2024-01-01');
  lines.push('tags: [markdown, test, benchmark]');
  lines.push('---');
  lines.push('');
  lines.push('# Test Document\n');

  const targetBytes = sizeKB * 1024;
  let currentSize = lines.join('\n').length;

  while (currentSize < targetBytes) {
    lines.push(`## Section ${lines.length}`);
    lines.push('');
    lines.push('This is a paragraph with some **bold** and *italic* text. ');
    lines.push('Here is a [link](https://example.com) and some `inline code`.');
    lines.push('');
    lines.push('```javascript');
    lines.push('const example = "code block";');
    lines.push('console.log(example);');
    lines.push('```');
    lines.push('');
    lines.push('> A blockquote with some important information');
    lines.push('> that spans multiple lines');
    lines.push('');
    lines.push('- List item 1');
    lines.push('- List item 2 with **formatting**');
    lines.push('- List item 3 with `code`');
    lines.push('');
    lines.push('| Column 1 | Column 2 | Column 3 |');
    lines.push('|----------|----------|----------|');
    lines.push('| Data 1   | Data 2   | Data 3   |');
    lines.push('');
    currentSize = lines.join('\n').length;
  }

  // Add BOM and mixed line endings for normalization test
  const content = lines.join('\n');
  return `\uFEFF${content.replace(/\n/g, () => (Math.random() > 0.5 ? '\r\n' : Math.random() > 0.5 ? '\r' : '\n'))}`;
}

function generateMDXContent(sizeKB) {
  const lines = [];
  lines.push('---');
  lines.push('title: MDX Test Document');
  lines.push('layout: ../layouts/BlogPost.astro');
  lines.push('---');
  lines.push('');
  lines.push('import Component from "../components/Component.astro";');
  lines.push('');
  lines.push('# MDX Test Document\n');

  const targetBytes = sizeKB * 1024;
  let currentSize = lines.join('\n').length;

  while (currentSize < targetBytes) {
    lines.push(`## MDX Section ${lines.length}`);
    lines.push('');
    lines.push('<Component prop="value" />');
    lines.push('');
    lines.push('Regular markdown with **bold** and *italic* text.');
    lines.push('');
    lines.push('export const data = {');
    lines.push('  key: "value",');
    lines.push('  count: 42');
    lines.push('};');
    lines.push('');
    lines.push('<div className="custom">');
    lines.push('  JSX content inside MDX');
    lines.push('</div>');
    lines.push('');
    currentSize = lines.join('\n').length;
  }

  return `\uFEFF${lines.join('\r\n')}`; // Use CRLF for MDX
}

console.log('='.repeat(70));
console.log('WASM vs JavaScript Performance Benchmark');
console.log('='.repeat(70));

// Test 1: normalize_content with MD files
console.log('\n📝 normalize_content Performance (Markdown):');
console.log('-'.repeat(70));

const mdSizes = [1, 10, 100]; // KB
const mdNormalizeResults = [];

for (const sizeKB of mdSizes) {
  const content = generateMDContent(sizeKB);
  const iterations = sizeKB === 100 ? 100 : 1000;

  const jsResult = benchmark(`JS (${sizeKB}KB)`, () => normalizeContentJS(content), iterations);

  const wasmResult = benchmark(
    `WASM (${sizeKB}KB)`,
    () => wasmModule.normalize_content(content),
    iterations
  );

  const speedup = ((jsResult.avgTime / wasmResult.avgTime - 1) * 100).toFixed(1);
  const faster = wasmResult.avgTime < jsResult.avgTime;

  mdNormalizeResults.push({
    size: `${sizeKB}KB MD`,
    js: `${jsResult.avgTime.toFixed(3)}ms`,
    wasm: `${wasmResult.avgTime.toFixed(3)}ms`,
    speedup: faster ? `+${speedup}%` : `${speedup}%`,
    winner: faster ? '🚀 WASM' : 'JS'
  });
}

console.table(mdNormalizeResults);

// Test 2: normalize_content with MDX files
console.log('\n📝 normalize_content Performance (MDX):');
console.log('-'.repeat(70));

const mdxSizes = [1, 10, 100]; // KB
const mdxNormalizeResults = [];

for (const sizeKB of mdxSizes) {
  const content = generateMDXContent(sizeKB);
  const iterations = sizeKB === 100 ? 100 : 1000;

  const jsResult = benchmark(`JS (${sizeKB}KB)`, () => normalizeContentJS(content), iterations);

  const wasmResult = benchmark(
    `WASM (${sizeKB}KB)`,
    () => wasmModule.normalize_content(content),
    iterations
  );

  const speedup = ((jsResult.avgTime / wasmResult.avgTime - 1) * 100).toFixed(1);
  const faster = wasmResult.avgTime < jsResult.avgTime;

  mdxNormalizeResults.push({
    size: `${sizeKB}KB MDX`,
    js: `${jsResult.avgTime.toFixed(3)}ms`,
    wasm: `${wasmResult.avgTime.toFixed(3)}ms`,
    speedup: faster ? `+${speedup}%` : `${speedup}%`,
    winner: faster ? '🚀 WASM' : 'JS'
  });
}

console.table(mdxNormalizeResults);

// Test 3: deps_digest with different file counts
console.log('\n📦 deps_digest Performance:');
console.log('-'.repeat(70));

// Create temporary test files
const tempDir = path.join(__dirname, 'fixtures', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const fileCounts = [10, 100, 500];
const digestResults = [];

for (const count of fileCounts) {
  // Create test files (mix of .md and .mdx)
  const paths = [];
  for (let i = 0; i < count; i++) {
    const ext = i % 2 === 0 ? '.md' : '.mdx';
    const filePath = path.join(tempDir, `test-${i}${ext}`);
    paths.push(filePath);
    if (!fs.existsSync(filePath)) {
      const content =
        ext === '.md'
          ? `# Markdown file ${i}\nContent for file ${i}`
          : `# MDX file ${i}\n<Component />\nContent for file ${i}`;
      fs.writeFileSync(filePath, content);
    }
  }

  const iterations = count === 500 ? 10 : 100;

  const jsResult = benchmark(`JS (${count} files)`, () => depsDigestJS(paths), iterations);

  const wasmResult = benchmark(
    `WASM (${count} files)`,
    () => wasmModule.deps_digest(paths),
    iterations
  );

  const speedup = ((jsResult.avgTime / wasmResult.avgTime - 1) * 100).toFixed(1);
  const faster = wasmResult.avgTime < jsResult.avgTime;

  digestResults.push({
    files: `${count} (.md/.mdx)`,
    js: `${jsResult.avgTime.toFixed(3)}ms`,
    wasm: `${wasmResult.avgTime.toFixed(3)}ms`,
    speedup: faster ? `+${speedup}%` : `${speedup}%`,
    winner: faster ? '🚀 WASM' : 'JS'
  });
}

console.table(digestResults);

// Summary
console.log(`\n${'='.repeat(70)}`);
console.log('📊 Performance Summary:');
console.log('='.repeat(70));

const allResults = [...mdNormalizeResults, ...mdxNormalizeResults, ...digestResults];
const totalWasmWins = allResults.filter((r) => r.winner === '🚀 WASM').length;
const totalTests = allResults.length;

console.log('\nWASM Performance:');
console.log(`  • Won: ${totalWasmWins}/${totalTests} benchmarks`);

// Calculate average speedup for WASM wins
const wasmWins = allResults.filter((r) => r.winner === '🚀 WASM');
if (wasmWins.length > 0) {
  const avgSpeedup =
    wasmWins.map((r) => Number.parseFloat(r.speedup)).reduce((a, b) => a + b, 0) / wasmWins.length;
  console.log(`  • Average speedup when faster: +${avgSpeedup.toFixed(1)}%`);
}

// Show performance by category
console.log('\nPerformance by file type:');
const mdWins = mdNormalizeResults.filter((r) => r.winner === '🚀 WASM').length;
const mdxWins = mdxNormalizeResults.filter((r) => r.winner === '🚀 WASM').length;
const digestWins = digestResults.filter((r) => r.winner === '🚀 WASM').length;

console.log(`  • Markdown normalization: ${mdWins}/${mdNormalizeResults.length} WASM wins`);
console.log(`  • MDX normalization: ${mdxWins}/${mdxNormalizeResults.length} WASM wins`);
console.log(`  • Deps digest: ${digestWins}/${digestResults.length} WASM wins`);

// Overall assessment
console.log('\n💡 Analysis:');
if (totalWasmWins > totalTests / 2) {
  console.log('  WASM provides better performance overall! 🎉');
} else {
  console.log('  JS performs better in most cases, but WASM still competitive.');
}

// Cleanup
console.log('\n🧹 Cleaning up temp files...');
fs.rmSync(tempDir, { recursive: true, force: true });
