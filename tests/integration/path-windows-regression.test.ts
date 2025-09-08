/// <reference types="bun-types" />
/**
 * Phase 3.2 — Path normalization: /@fs// double-slash variant
 *
 * Expected behavior
 * - Vite sometimes emits ids like `/@fs//abs-path` (note the double slash).
 *   This must normalize to the same entry as the absolute path.
 */
import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import fastmdCache from '../../plugins/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from '../_utils';

function mkTmp() {
  return path.resolve(
    process.cwd(),
    `.cache/tests-pathwin-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

describe('fastmd-cache: /@fs// double-slash normalization', () => {
  test('HIT across /@fs//abs and absolute path forms', async () => {
    const dir = mkTmp();
    const cacheDir = path.join(dir, '.cache/fastmd');
    const abs = path.resolve(dir, 'FS.MD');
    const viaFsDouble = `/@fs//${abs.replace(/^\/+/, '')}`; // ensure exactly one extra slash after /@fs/
    const md = 'Hello';
    const js = 'export default 9;';

    // Write using /@fs// form
    {
      const [pre, post] = fastmdCache({ cacheDir, log: 'silent' });
      expect(
        await callTransform(pre as unknown as { transform?: TransformLike }, md, viaFsDouble)
      ).toBeNull();
      await callTransform(post as unknown as { transform?: TransformLike }, js, viaFsDouble);
    }

    // Read using absolute path → should HIT
    {
      const [pre] = fastmdCache({ cacheDir, log: 'silent' });
      const hit = await callTransform(pre as unknown as { transform?: TransformLike }, md, abs);
      expect(hit).toBe(js);
    }
  });
});
