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
import path from 'node:path';
import fastmdCache, { clearCache } from '../plugins/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from './_utils';

/**
 * Create a temporary working directory for tests.
 */
async function mkTmp() {
  const dir = path.resolve(
    process.cwd(),
    `.cache/tests-clear-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(dir, { recursive: true });
  return dir;
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
    expect(
      await callTransform(pre as unknown as { transform?: TransformLike }, '# a', id)
    ).toBeNull();
    await callTransform(post as unknown as { transform?: TransformLike }, 'export default 1', id);

    // Precondition: HIT occurs for same inputs
    const [pre2] = fastmdCache({ cacheDir, log: 'silent' });
    const hitBefore = await callTransform(
      pre2 as unknown as { transform?: TransformLike },
      '# a',
      id
    );
    expect(hitBefore).toBe('export default 1');

    // Act: clearCache(cacheDir)
    await clearCache(cacheDir);

    // Postcondition: next pre-transform is MISS (null)
    const [pre3] = fastmdCache({ cacheDir, log: 'silent' });
    const missAfter = await callTransform(
      pre3 as unknown as { transform?: TransformLike },
      '# a',
      id
    );
    expect(missAfter).toBeNull();
  });
});
