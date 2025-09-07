#!/usr/bin/env node
import fs from 'node:fs/promises';

async function summarize(file) {
  const text = await fs.readFile(file, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  let hits = 0;
  let misses = 0;
  let total = 0;
  let hitRate = 0;
  let p50 = 0;
  let p95 = 0;
  let savedMs = 0;
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (row.evt === 'cache_hit') hits += 1;
      else if (row.evt === 'cache_miss') misses += 1;
      else if (row.evt === 'summary') {
        total = row.total ?? total;
        hitRate = row.hitRate ?? hitRate;
        p50 = row.p50 ?? p50;
        p95 = row.p95 ?? p95;
        savedMs = row.savedMs ?? savedMs;
        if (typeof row.hits === 'number') hits = row.hits;
        if (typeof row.misses === 'number') misses = row.misses;
      }
    } catch {}
  }
  return { total, hits, misses, hitRate, p50, p95, savedMs };
}

async function main() {
  const file = process.argv[2] || 'fastmd.ndjson';
  const runId = process.argv[3] || '';
  const createdAt = process.argv[4] || '';
  const sha = process.argv[5] || '';
  const url = process.argv[6] || '';
  const s = await summarize(file);
  const row = [
    runId,
    createdAt,
    sha,
    url,
    s.total,
    s.hits,
    s.misses,
    s.hitRate,
    s.p50,
    s.p95,
    s.savedMs
  ].join(',');
  console.log(row);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
