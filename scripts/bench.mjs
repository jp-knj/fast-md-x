#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generatePages } from './gen-example-pages.mjs';

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

async function rmrf(p) {
  await fs.rm(p, { recursive: true, force: true }).catch(() => {});
}

async function runAstroBuild(targetDir, env = {}) {
  const args = ['astro', 'build', '--root', targetDir];
  const childEnv = {
    ...process.env,
    FASTMD_LOG: 'summary',
    ...env
  };
  return new Promise((resolve) => {
    const t0 = nowMs();
    const child = spawn('pnpm', args, { stdio: ['ignore', 'pipe', 'pipe'], env: childEnv });
    let stdout = '';
    let stderr = '';
    /** @type {{total?:number;hits?:number;misses?:number;hitRate?:number;p50?:number;p95?:number}} */
    const fastmd = {};
    const re =
      /\[fastmd\] summary total=(\d+) hits=(\d+) misses=(\d+) hitRate=(\d+)% p50=(\d+)ms p95=(\d+)ms/;
    child.stdout.on('data', (buf) => {
      const s = String(buf);
      stdout += s;
      const m = s.match(re);
      if (m) {
        fastmd.total = Number(m[1]);
        fastmd.hits = Number(m[2]);
        fastmd.misses = Number(m[3]);
        fastmd.hitRate = Number(m[4]);
        fastmd.p50 = Number(m[5]);
        fastmd.p95 = Number(m[6]);
      }
    });
    child.stderr.on('data', (buf) => {
      stderr += String(buf);
    });
    child.on('close', (code) => {
      const dt = nowMs() - t0;
      resolve({ code, ms: dt, stdout, stderr, fastmd });
    });
  });
}

async function main() {
  // Args: [targetDir] [cacheDir] [--pages N]
  let targetDir = 'examples/minimal';
  let cacheDir = '.cache/bench-fastmd';
  let pages = 0;
  const argv = process.argv.slice(2);
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pages' && i + 1 < argv.length) {
      pages = Number(argv[++i] || '0') || 0;
    } else if (a.startsWith('--')) {
      // ignore unknown flags
    } else {
      positionals.push(a);
    }
  }
  if (positionals[0]) targetDir = positionals[0];
  if (positionals[1]) cacheDir = positionals[1];

  const absCache = path.resolve(process.cwd(), cacheDir);

  console.log(`[bench] target=${targetDir} cacheDir=${cacheDir} pages=${pages || 0}`);
  await rmrf(absCache);

  // If pages requested, copy targetDir to a temp dir and seed N pages
  if (pages > 0) {
    const seeded = path.resolve(process.cwd(), `.cache/bench-site-${pages}-${Date.now()}`);
    await fs.cp(targetDir, seeded, { recursive: true });
    const made = await generatePages(seeded, pages, 'docs');
    console.log(`[bench] Seeded ${made} pages at ${seeded}/src/pages/docs/`);
    targetDir = seeded;
  }

  const runs = [];
  runs.push(['cold', await runAstroBuild(targetDir, { FASTMD_CACHE_DIR: absCache })]);
  runs.push(['warm', await runAstroBuild(targetDir, { FASTMD_CACHE_DIR: absCache })]);
  runs.push(['hit', await runAstroBuild(targetDir, { FASTMD_CACHE_DIR: absCache })]);

  console.log('\n[bench] Results (ms):');
  for (const [name, r] of runs) {
    const f = r.fastmd || {};
    console.log(
      `- ${name.padEnd(4)}: ${String(r.ms).padStart(6)}  (hits=${f.hits ?? 0}/${f.total ?? 0}, hitRate=${
        f.hitRate ?? 0
      }%)`
    );
  }
  const cold = runs[0][1].ms || 1;
  const hit = runs[runs.length - 1][1].ms || cold;
  const speedup = (cold / hit).toFixed(2);
  console.log(`\n[bench] Speedup (cold/hit): ${speedup}×`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
