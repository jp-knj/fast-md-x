/// <reference types="bun-types" />
/**
 * Validate NDJSON rows against the intended schema (lightweight, no Ajv).
 * We enforce the same required fields as schemas/fastmd-log.schema.json.
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import fastmdCache from '../../plugins/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from '../_utils';

async function mkTmp() {
  const dir = path.resolve(
    process.cwd(),
    `.cache/tests-json-schema-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function isNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function validateRow(row: any): true {
  if (!row || typeof row !== 'object') throw new Error('row must be object');
  if (typeof row.ts !== 'string') throw new Error('ts must be string');

  switch (row.evt) {
    case 'cache_miss':
      if (typeof row.rel !== 'string') throw new Error('rel must be string');
      return true;
    case 'cache_write':
      if (typeof row.rel !== 'string') throw new Error('rel must be string');
      if (!isNum(row.durationMs)) throw new Error('durationMs must be number');
      if (!isNum(row.sizeBytes)) throw new Error('sizeBytes must be number');
      return true;
    case 'cache_hit':
      if (typeof row.rel !== 'string') throw new Error('rel must be string');
      if (!isNum(row.durationMs)) throw new Error('durationMs must be number');
      // sizeBytes is optional per schema
      return true;
    case 'summary':
      if (!isNum(row.total)) throw new Error('total must be number');
      if (!isNum(row.hits)) throw new Error('hits must be number');
      if (!isNum(row.misses)) throw new Error('misses must be number');
      if (!isNum(row.hitRate)) throw new Error('hitRate must be number');
      if (!isNum(row.p50)) throw new Error('p50 must be number');
      if (!isNum(row.p95)) throw new Error('p95 must be number');
      if (!isNum(row.savedMs)) throw new Error('savedMs must be number');
      return true;
    default:
      throw new Error(`unknown evt: ${row.evt}`);
  }
}

describe('fastmd-cache: NDJSON schema validation (lightweight)', () => {
  test('all emitted rows conform to schema rules', async () => {
    const dir = await mkTmp();
    const cacheDir = path.join(dir, '.cache/fastmd');
    const id = path.join(dir, 's.md');
    const code = '# s';
    const js = 'export default 1;';

    const [pre, post] = fastmdCache({ cacheDir, log: 'json' });
    (pre as unknown as { buildStart?: () => void }).buildStart?.();

    const rows: unknown[] = [];
    const orig = console.log;
    console.log = (s: unknown) => {
      try {
        rows.push(JSON.parse(String(s)));
      } catch {}
    };
    try {
      // MISS → WRITE → HIT sequence
      expect(
        await callTransform(pre as unknown as { transform?: TransformLike }, code, id)
      ).toBeNull();
      await callTransform(post as unknown as { transform?: TransformLike }, js, id);
      const hit = await callTransform(pre as unknown as { transform?: TransformLike }, code, id);
      expect(hit).toBe(js);
      (pre as unknown as { buildEnd?: () => void }).buildEnd?.();
    } finally {
      console.log = orig;
    }

    const seen = new Set<string>();
    for (const r of rows as any[]) {
      validateRow(r);
      seen.add(r.evt);
    }
    expect(seen.has('cache_miss')).toBe(true);
    expect(seen.has('cache_write')).toBe(true);
    expect(seen.has('cache_hit')).toBe(true);
    expect(seen.has('summary')).toBe(true);
  });
});

