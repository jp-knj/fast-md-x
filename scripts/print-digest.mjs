#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function statSafe(p) {
  try {
    const st = await fs.stat(p);
    return { size: st.size, mtimeMs: st.mtimeMs };
  } catch {
    return { size: 0, mtimeMs: 0 };
  }
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function digestJs(paths) {
  const abs = paths.map((p) => (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p))).sort();
  const lines = [];
  for (const ap of abs) {
    const { size, mtimeMs } = await statSafe(ap);
    lines.push(`${ap}|${size}|${mtimeMs}`);
  }
  return sha256Hex(lines.join('\n') + (lines.length ? '\n' : ''));
}

async function tryNative(paths) {
  try {
    const { loadFastmdNative } = await import('../packages/fastmd-cache/native-bridge.mjs');
    const mod = loadFastmdNative();
    if (mod && typeof mod.deps_digest === 'function') return mod.deps_digest(paths);
  } catch {}
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('-h') || args.includes('--help')) {
    console.log('Usage: node scripts/print-digest.mjs <path...> [--native]');
    process.exit(0);
  }
  const nativeFlag = args.includes('--native');
  const files = args.filter((a) => a !== '--native');
  const abs = files.map((p) => (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p))).sort();

  const js = await digestJs(abs);
  if (!nativeFlag) {
    console.log(js);
    return;
  }
  const native = await tryNative(abs);
  if (!native) {
    console.log(js);
    console.error('[warn] native addon not available; printed JS digest');
    return;
  }
  console.log(`js:     ${js}`);
  console.log(`native: ${native}`);
  if (js !== native) {
    console.error('mismatch');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
