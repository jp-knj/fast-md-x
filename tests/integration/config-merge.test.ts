/// <reference types="bun-types" />
/**
 * Config precedence (minimal): ENV → options. YAML is not supported.
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import fastmdCache from '../../packages/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from '../_utils';

/**
 * Run a callback in a temporary working directory and restore CWD afterward.
 */
async function withTempCwd(fn: (dir: string) => Promise<void>) {
  const origCwd = process.cwd();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fastmd-cfg-'));
  try {
    process.chdir(dir);
    await fn(dir);
  } finally {
    process.chdir(origCwd);
  }
}

/**
 * Write a UTF-8 file, creating parent directories as needed.
 */
// YAML is not supported; file helper removed

/**
 * Check whether the cache data directory contains any JS entries.
 */
/**
 * Check whether the given cacheDir contains a HIT for (id, code).
 */
async function hasCacheHit(cacheDir: string, id: string, code: string): Promise<boolean> {
  // Force enabled and isolate from ENV by temporarily unsetting cache overrides.
  const prevCache = process.env.FASTMD_CACHE_DIR;
  const prevDisable = process.env.FASTMD_DISABLE;
  process.env.FASTMD_CACHE_DIR = undefined as unknown as string;
  process.env.FASTMD_DISABLE = undefined as unknown as string;
  try {
    const [pre] = fastmdCache({ cacheDir, log: 'silent', enabled: true });
    const hit = await callTransform(pre as unknown as { transform?: TransformLike }, code, id);
    return hit != null;
  } finally {
    if (prevCache != null) process.env.FASTMD_CACHE_DIR = prevCache;
    if (prevDisable != null) process.env.FASTMD_DISABLE = prevDisable;
  }
}

describe('config merge order', () => {
  test('ENV overrides options', async () => {
    await withTempCwd(async (dir) => {
      const prev = process.env.FASTMD_CACHE_DIR;
      process.env.FASTMD_CACHE_DIR = '.cache/env';
      const [pre, post] = fastmdCache({ enabled: true, cacheDir: '.cache/opts', log: 'verbose' });
      const id = path.resolve(dir, 'doc.md');
      const code = '# hi';
      expect(
        await callTransform(pre as unknown as { transform?: TransformLike }, code, id)
      ).toBeNull();
      await callTransform(post as unknown as { transform?: TransformLike }, 'export default 0', id);

      // ENV has higher precedence than options
      expect(await hasCacheHit(path.resolve(dir, '.cache/env'), id, code)).toBe(true);
      expect(await hasCacheHit(path.resolve(dir, '.cache/opts'), id, code)).toBe(false);
      process.env.FASTMD_CACHE_DIR = prev;
    });
  });

  test('FASTMD_DISABLE disables caching even with options', async () => {
    await withTempCwd(async (dir) => {
      const prevDisable = process.env.FASTMD_DISABLE;
      const prevCache = process.env.FASTMD_CACHE_DIR;
      try {
        process.env.FASTMD_DISABLE = '1';
        process.env.FASTMD_CACHE_DIR = '.cache/envvar';

        const [pre, post] = fastmdCache({ enabled: true, cacheDir: '.cache/opts' });
        const id = path.resolve(dir, 'doc.md');
        // Plugin disabled by ENV; no cache writes should occur
        expect(
          await callTransform(pre as unknown as { transform?: TransformLike }, '# hi', id)
        ).toBeNull();
        await callTransform(
          post as unknown as { transform?: TransformLike },
          'export default 0',
          id
        );

        expect(await hasCacheHit(path.resolve(dir, '.cache/envvar'), id, '# hi')).toBe(false);
        expect(await hasCacheHit(path.resolve(dir, '.cache/opts'), id, '# hi')).toBe(false);
      } finally {
        process.env.FASTMD_DISABLE = prevDisable;
        process.env.FASTMD_CACHE_DIR = prevCache;
      }
    });
  });
});
