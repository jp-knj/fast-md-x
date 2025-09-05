/// <reference types="bun-types" />
/**
 * TDD: manual ops — clearCache()
 *
 * Target API (to be implemented next):
 *   export async function clearCache(cacheDir: string): Promise<void>
 *   - Deletes all files under `<cacheDir>/data` and `<cacheDir>/meta` if present.
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import fastmdCache, { clearCache } from '../plugins/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from './_utils';

async function mkTmp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'fastmd-clear-'));
}

describe('ops: clearCache (TDD)', () => {
  test('exposes clearCache API', () => {
    expect(typeof clearCache).toBe('function');
  });

  test('clears data and meta directories', async () => {
    const dir = await mkTmp();
    const cacheDir = path.join(dir, '.cache/fastmd');
    const [pre, post] = fastmdCache({ cacheDir, log: 'silent' });
    const id = path.join(dir, 'a.md');
    expect(await callTransform(pre as { transform?: TransformLike }, '# a', id)).toBeNull();
    await callTransform(post as { transform?: TransformLike }, 'export default 1', id);

    // Precondition: data exists
    const dataPath = path.join(cacheDir, 'data');
    const metaPath = path.join(cacheDir, 'meta');
    const before = await fs.readdir(dataPath).catch(() => []);
    expect(before.length > 0).toBe(true);

    // Act: clearCache(cacheDir)
    await clearCache(cacheDir);

    const afterData = await fs.readdir(dataPath).catch(() => []);
    const afterMeta = await fs.readdir(metaPath).catch(() => []);
    expect(afterData.length).toBe(0);
    expect(afterMeta.length).toBe(0);
  });
});
