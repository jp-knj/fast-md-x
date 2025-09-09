const fs = require('node:fs');
const path = require('node:path');

let wasmModule = null;

/**
 * Load WASM module lazily
 */
function loadWasm() {
  if (wasmModule) return wasmModule;

  try {
    // The pkg/fastmd_native.js already handles WASM loading automatically
    wasmModule = require('./pkg/fastmd_native.js');
    return wasmModule;
  } catch (err) {
    console.error('Failed to load WASM module:', err);
    // Return stub functions to avoid breaking the bridge
    return {
      deps_digest: () => {
        throw new Error('WASM module not available');
      },
      normalize_content: () => {
        throw new Error('WASM module not available');
      }
    };
  }
}

/**
 * Compute deps digest from file paths
 * @param {string[]} paths - Array of file paths
 * @returns {string} SHA256 hex digest
 */
function deps_digest(paths) {
  const wasm = loadWasm();

  // Gather file metadata synchronously
  const files = paths.map((p) => {
    try {
      const stats = fs.statSync(p);
      return {
        path: p,
        size: stats.size,
        mtime_ms: stats.mtimeMs
      };
    } catch {
      // Missing files get 0|0
      return {
        path: p,
        size: 0,
        mtime_ms: 0
      };
    }
  });

  // Call WASM function with JSON-serialized metadata
  const filesJson = JSON.stringify(files);
  return wasm.deps_digest(filesJson);
}

/**
 * Normalize content (remove BOM, normalize newlines)
 * @param {string} content - Input text
 * @returns {string} Normalized text
 */
function normalize_content(content) {
  const wasm = loadWasm();
  return wasm.normalize_content(String(content));
}

module.exports = {
  deps_digest,
  normalize_content
};
