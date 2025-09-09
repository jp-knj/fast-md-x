/// <reference types="bun-types" />
/**
 * Phase 3.2 — Corrupted cache entry handling
 *
 * Expected behavior
 * - If a cacache entry contains invalid JSON, `pre.transform` should treat it as MISS (null)
 *   and must NOT throw.
 */
import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import cacache from 'cacache';
import matter from 'gray-matter';
import stringify from 'json-stable-stringify';
import fastmdCache, { __internals } from '../../packages/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from '../_utils';

function mkTmp() {
  return path.resolve(
    process.cwd(),
    `.cache/tests-corrupt-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

describe('fastmd-cache: corrupted entry → MISS (no crash)', () => {
  test('invalid JSON payload is ignored safely', async () => {
    const dir = mkTmp();
    const cacheDir = path.join(dir, '.cache/fastmd');
    const id = path.join(dir, 'z.md');
    const code = 'Hello';

    // Compute the same key as plugin does
    const root = process.cwd();
    const norm = __internals.normalizeId(id, root);
    const contentLF = __internals.normalizeNewlines(__internals.stripBOM(code));
    const fmParsed = matter(contentLF);
    const frontmatterNorm = stringify(fmParsed.data || {});
    const featuresDigest = __internals.digestJSON(__internals.sortedObject({}));
    const toolchainDigest = await __internals.getToolchainDigest();
    const key = __internals.sha256(
      contentLF + frontmatterNorm + featuresDigest + toolchainDigest + norm.pathDigest
    );

    // Corrupt the stored payload
    await cacache.put(cacheDir, key, Buffer.from('not-json'));

    // A fresh instance should treat the entry as MISS (null) and not throw
    const [pre] = fastmdCache({ cacheDir, log: 'silent' });
    const res = await callTransform(pre as unknown as { transform?: TransformLike }, code, id);
    expect(res).toBeNull();
  });
});
