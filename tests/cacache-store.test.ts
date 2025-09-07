/// <reference types="bun-types" />
/**
 * TDD: store=cacache — behavior parity with FS store
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import fastmdCache, { clearCache, warmup } from '../plugins/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from './_utils';

/**
 * Create a temporary working directory for tests.
 */
async function mkTmp() {
  const dir = path.resolve(process.cwd(), `.cache/tests-cacache-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

describe('store=cacache', () => {
  test('pre/post flow yields HIT after MISS+POST', async () => {
    const dir = await mkTmp();
    const cacheDir = path.join(dir, '.cache/fastmd');
    const id = path.join(dir, 'c.md');
    const code = 'Hello';
    const js = 'export default 1;';

    const [pre, post] = fastmdCache({ cacheDir, log: 'silent' });
    expect(
      await callTransform(pre as unknown as { transform?: TransformLike }, code, id)
    ).toBeNull();
    await callTransform(post as unknown as { transform?: TransformLike }, js, id);
    const hit = await callTransform(pre as unknown as { transform?: TransformLike }, code, id);
    expect(hit).toBe(js);

    // Using cacache store should not create per-key files under data/
    const dataDir = path.join(cacheDir, 'data');
    const hasDataDir = await fs
      .stat(dataDir)
      .then((s) => s.isDirectory())
      .catch(() => false);
    expect(hasDataDir).toBe(false);
  });

  test('warmup precomputes HITs under cacache store', async () => {
    const dir = await mkTmp();
    const cacheDir = path.join(dir, '.cache/fastmd');
    const id = path.join(dir, 'd.md');
    const code = 'Hi';
    const js = 'export default 2;';

    await warmup([{ id, code, js }], { cacheDir, features: {} });
    const [pre] = fastmdCache({ cacheDir, log: 'silent' });
    const hit = await callTransform(pre as unknown as { transform?: TransformLike }, code, id);
    expect(hit).toBe(js);

    // No data/ directory created for cacache store
    const hasDataDir = await fs
      .stat(path.join(cacheDir, 'data'))
      .then((s) => s.isDirectory())
      .catch(() => false);
    expect(hasDataDir).toBe(false);
  });

  test('clearCache removes cacache entries', async () => {
    const dir = await mkTmp();
    const cacheDir = path.join(dir, '.cache/fastmd');
    const id = path.join(dir, 'e.md');
    const code = 'Yo';
    const js = 'export default 3;';

    const [pre, post] = fastmdCache({ cacheDir, log: 'silent' });
    expect(
      await callTransform(pre as unknown as { transform?: TransformLike }, code, id)
    ).toBeNull();
    await callTransform(post as unknown as { transform?: TransformLike }, js, id);
    const hit = await callTransform(pre as unknown as { transform?: TransformLike }, code, id);
    expect(hit).toBe(js);

    await clearCache(cacheDir);
    const miss = await callTransform(pre as unknown as { transform?: TransformLike }, code, id);
    expect(miss).toBeNull();
  });
});
