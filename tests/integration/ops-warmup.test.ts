/// <reference types="bun-types" />
/**
 * TDD: manual ops — warmup()
 *
 * Target API (to be implemented next):
 *   export async function warmup(entries: { id: string; code: string; js: string; map?: string }[],
 *                                opts?: { cacheDir?: string; features?: Record<string, unknown> }): Promise<void>
 */
import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import fastmdCache, { warmup } from '../../packages/fastmd-cache/index.mjs';
import { type TransformLike, callTransform, createTempDir } from '../_utils';

/**
 * Create a temporary working directory for tests.
 */
async function mkTmp() {
  return createTempDir('warm');
}

describe('ops: warmup (TDD)', () => {
  test('exposes warmup API', () => {
    expect(typeof warmup).toBe('function');
  });

  test('precomputes cache entries that HIT with the same inputs', async () => {
    const dir = await mkTmp();
    const cacheDir = path.join(dir, '.cache/fastmd');
    const id = path.join(dir, 'b.md');
    const code = '---\ntitle: Warm\n---\nBody';
    const js = 'export default "W";';

    // Act: warmup with known (id, code)->js
    await warmup([{ id, code, js }], { cacheDir, features: {} });

    // Assert: a fresh plugin instance returns HIT for the same content
    const [pre] = fastmdCache({ cacheDir, log: 'silent' });
    const hit = await callTransform(pre as unknown as { transform?: TransformLike }, code, id);
    expect(hit).toBe(js);
  });
});
