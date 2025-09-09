/// <reference types="bun-types" />
/**
 * Phase 3.2 — salt contributes to key derivation
 *
 * Expected behavior
 * - Different `salt` values MUST yield different keys (no cross-HIT between salts).
 *
 * Current status (pre-RED): `salt` option is ignored, so cross-salt HIT occurs.
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import fastmdCache from '../../packages/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from '../_utils';

async function mkTmp() {
  const dir = path.resolve(
    process.cwd(),
    `.cache/tests-salt-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

describe('fastmd-cache: salt in key', () => {
  test('different salt values do not HIT across caches', async () => {
    const dir = await mkTmp();
    const cacheDir = path.join(dir, '.cache/fastmd');
    const id = path.join(dir, 's.md');
    const code = '# s';
    const js = 'export default "S";';

    // Write with salt=A
    {
      const [pre, post] = fastmdCache({ cacheDir, log: 'silent', salt: 'A' });
      expect(
        await callTransform(pre as unknown as { transform?: TransformLike }, code, id)
      ).toBeNull();
      await callTransform(post as unknown as { transform?: TransformLike }, js, id);
    }

    // Read with salt=B (should MISS if salt is part of the key)
    {
      const [pre] = fastmdCache({ cacheDir, log: 'silent', salt: 'B' });
      const maybeHit = await callTransform(
        pre as unknown as { transform?: TransformLike },
        code,
        id
      );
      // RED: currently implementation ignores salt and will HIT here; desired is MISS
      expect(maybeHit).toBeNull();
    }
  });
});
