/// <reference types="bun-types" />
/**
 * Phase 3.2 — bundler mode contributes to key derivation
 *
 * Expected behavior
 * - dev/prod (mode) MUST be part of the key; entries created in `development`
 *   MUST NOT HIT in `production` and vice versa.
 *
 * Current status (pre-RED): mode is not included, so cross-mode HIT occurs.
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import fastmdCache from '../../plugins/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from '../_utils';

async function mkTmp() {
  const dir = path.resolve(
    process.cwd(),
    `.cache/tests-mode-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

describe('fastmd-cache: mode in key', () => {
  test('HIT does not cross development/production modes', async () => {
    const dir = await mkTmp();
    const cacheDir = path.join(dir, '.cache/fastmd');
    const id = path.join(dir, 'm.md');
    const code = '# m';
    const js = 'export default 42;';

    // Warm in development mode
    const [preDev, postDev] = fastmdCache({ cacheDir, log: 'silent' });
    (
      preDev as unknown as {
        configResolved?: (cfg: { root: string; mode: 'development' | 'production' }) => void;
      }
    ).configResolved?.({
      root: dir,
      mode: 'development'
    } as { root: string; mode: 'development' });
    expect(
      await callTransform(preDev as unknown as { transform?: TransformLike }, code, id)
    ).toBeNull();
    await callTransform(postDev as unknown as { transform?: TransformLike }, js, id);

    // Attempt HIT in production mode → should MISS if mode affects key
    const [preProd] = fastmdCache({ cacheDir, log: 'silent' });
    (
      preProd as unknown as {
        configResolved?: (cfg: { root: string; mode: 'development' | 'production' }) => void;
      }
    ).configResolved?.({
      root: dir,
      mode: 'production'
    } as { root: string; mode: 'production' });
    const res = await callTransform(preProd as unknown as { transform?: TransformLike }, code, id);
    // RED: currently implementation will HIT; desired is MISS
    expect(res).toBeNull();
  });
});
