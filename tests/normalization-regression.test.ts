/// <reference types="bun-types" />
/**
 * Regression coverage: normalization (BOM, CRLF, /@fs/ path)
 */
import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fastmdCache from '../plugins/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from './_utils';

function makeCacheDir(label: string) {
  return path.resolve(process.cwd(), `.cache/tests-${label}-${randomUUID()}`);
}

describe('fastmd-cache: normalization invariants', () => {
  test('BOM and CRLF normalize to same key as LF', async () => {
    const cacheDir = makeCacheDir('norm');
    const abs = path.resolve(process.cwd(), 'src/pages/norm.md');
    const withBOM_CRLF = '\uFEFF---\r\ntitle: N\r\n---\r\nBody\r\n';
    const normalizedLF = '---\ntitle: N\n---\nBody\n';
    const js = 'export default "N";';

    // First instance writes using BOM/CRLF input
    {
      const [pre, post] = fastmdCache({ cacheDir, log: 'silent' });
      expect(
        await callTransform(pre as { transform?: TransformLike }, withBOM_CRLF, abs)
      ).toBeNull();
      await callTransform(post as { transform?: TransformLike }, js, abs);
    }

    // Second instance reads using LF-normalized input => HIT must return same JS
    {
      const [pre] = fastmdCache({ cacheDir, log: 'silent' });
      const hit = await callTransform(pre as { transform?: TransformLike }, normalizedLF, abs);
      expect(hit).toBe(js);
    }
  });

  test('/@fs/ absolute URL and absolute path yield same cache entry', async () => {
    const cacheDir = makeCacheDir('fsurl');
    const abs = path.resolve(process.cwd(), 'src/pages/fs-sample.md');
    const viaFsUrl = `/@fs${abs}`;
    const md = 'Hello';
    const js = 'export default 1;';

    // Write using /@fs/ URL form
    {
      const [pre, post] = fastmdCache({ cacheDir, log: 'silent' });
      expect(await callTransform(pre as { transform?: TransformLike }, md, viaFsUrl)).toBeNull();
      await callTransform(post as { transform?: TransformLike }, js, viaFsUrl);
    }

    // Read using absolute path form -> should HIT
    {
      const [pre] = fastmdCache({ cacheDir, log: 'silent' });
      const hit = await callTransform(pre as { transform?: TransformLike }, md, abs);
      expect(hit).toBe(js);
    }
  });
});
