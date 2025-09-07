#!/usr/bin/env node
import fs from 'node:fs/promises';

async function main() {
  const file = process.argv[2] || 'fastmd.ndjson';
  const text = await fs.readFile(file, 'utf8').catch(() => '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  let hits = 0;
  let misses = 0;
  let writes = 0;
  let total = 0;
  let p50 = 0;
  let p95 = 0;
  let savedMs = 0;
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (row.evt === 'cache_hit') hits += 1;
      else if (row.evt === 'cache_miss') misses += 1;
      else if (row.evt === 'cache_write') writes += 1;
      else if (row.evt === 'summary') {
        total = row.total ?? total;
        p50 = row.p50 ?? p50;
        p95 = row.p95 ?? p95;
        if (typeof row.savedMs === 'number') savedMs = row.savedMs;
        if (typeof row.hits === 'number') hits = row.hits;
        if (typeof row.misses === 'number') misses = row.misses;
      }
    } catch {}
  }
  const denom = total || hits + misses || 0;
  const hitRate = denom ? Math.round((hits / denom) * 100) : 0;
  const out = [];
  out.push('## fastmd-cache summary');
  out.push('');
  out.push(`- total: ${total}`);
  out.push(`- hits/misses: ${hits}/${misses} (hitRate=${hitRate}%)`);
  out.push(`- writes: ${writes}`);
  out.push(`- p50/p95 (ms): ${p50}/${p95}`);
  out.push(`- savedMs (est.): ${savedMs} ms`);
  console.log(out.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
