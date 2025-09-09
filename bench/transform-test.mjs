#!/usr/bin/env node

// Simple transform test harness for benchmarking
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

// Get file paths from command line
const files = process.argv.slice(2);

// Mock a simple transform based on engine mode
const engineMode = process.env.FASTMD_RS || 'off';

for (const filepath of files) {
  const content = readFileSync(filepath, 'utf-8');
  const filename = basename(filepath);
  
  // Simulate different processing based on engine
  let result;
  
  if (engineMode === 'off') {
    // JS processing simulation
    result = `// JS Transform: ${filename}\nexport default \`${content.replace(/`/g, '\\`')}\`;`;
  } else if (engineMode === 'sidecar') {
    // Sidecar would actually call the Rust process
    // For now, just simulate
    result = `// Sidecar Transform: ${filename}\nexport default \`<div>${content}</div>\`;`;
  } else if (engineMode === 'wasm') {
    // WASM would call the wasm module
    // For now, just simulate
    result = `// WASM Transform: ${filename}\nexport default \`<article>${content}</article>\`;`;
  }
  
  // In real usage, we'd write this to output or return it
  // For benchmark, we just process it
  if (result.length === 0) {
    throw new Error('Transform failed');
  }
}

// Success
process.exit(0);