import { createRequire } from 'node:module';
/**
 * Attempt to load a native addon when FASTMD_NATIVE=1. Never throws; returns null on failure.
 */
export function loadFastmdNative() {
  if (process.env.FASTMD_NATIVE !== '1') return null;
  const require = createRequire(import.meta.url);
  const injected = process.env.FASTMD_NATIVE_MODULE;
  const candidates = [
    injected && String(injected),
    '@fastmd/native',
    '../../native/fastmd-native/index.js'
  ].filter(Boolean);
  for (const id of candidates) {
    try {
      const mod = require(id);
      if (mod && typeof mod.deps_digest === 'function') return mod;
    } catch {}
  }
  return null;
}

/**
 * Call native deps digest if available; otherwise return null to signal fallback.
 * @param {string[]} paths absolute file paths
 * @param {any} native optional native module
 */
export function depsDigestNative(paths, native) {
  try {
    const mod = native ?? loadFastmdNative();
    if (mod && typeof mod.deps_digest === 'function') {
      return mod.deps_digest(paths);
    }
  } catch {}
  return null;
}
