/// <reference types="bun-types" />
/**
 * Phase 3.2 — JSON logging structure
 *
 * Expected behavior
 * - When `log: 'json'`, the plugin emits JSON lines for cache_miss, cache_write, cache_hit,
 *   and a final summary. Each line should be parseable JSON with expected fields.
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import fastmdCache from '../../packages/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from '../_utils';

async function mkTmp() {
  const dir = path.resolve(
    process.cwd(),
    `.cache/tests-json-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

describe('fastmd-cache: JSON logs', () => {
  test('emits cache_miss, cache_write, cache_hit and summary with expected fields', async () => {
    const dir = await mkTmp();
    const cacheDir = path.join(dir, '.cache/fastmd');
    const id = path.join(dir, 'j.md');
    const code = '# j';
    const js = 'export default 7;';

    const [pre, post] = fastmdCache({ cacheDir, log: 'json' });
    (pre as unknown as { buildStart?: () => void }).buildStart?.();

    const lines: unknown[] = [];
    const orig = console.log;
    console.log = (s: unknown) => {
      try {
        lines.push(JSON.parse(String(s)));
      } catch {
        // ignore non-JSON lines
      }
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

    const rows = lines as Array<{ evt?: string; [k: string]: unknown }>;
    const evts = new Set(rows.map((o) => o?.evt).filter(Boolean));
    expect(evts.has('cache_miss')).toBe(true);
    expect(evts.has('cache_write')).toBe(true);
    expect(evts.has('cache_hit')).toBe(true);
    expect(evts.has('summary')).toBe(true);

    const summary = rows.find((o) => o?.evt === 'summary') as { [k: string]: unknown } | undefined;
    expect(typeof summary?.total).toBe('number');
    expect(typeof summary?.hits).toBe('number');
    expect(typeof summary?.misses).toBe('number');
    expect(typeof summary?.hitRate).toBe('number');
    expect(typeof summary?.p50).toBe('number');
    expect(typeof summary?.p95).toBe('number');
    expect(typeof summary?.savedMs).toBe('number');
  });
});
