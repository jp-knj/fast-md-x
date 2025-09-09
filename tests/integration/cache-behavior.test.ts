/// <reference types="bun-types" />
/**
 * Regression coverage: cache behavior
 *
 * Verifies that:
 * - A MISS followed by POST write yields a HIT on the next PRE call for the same input.
 * - Changing frontmatter/content invalidates the cache (next PRE returns null until POST writes).
 */
import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fastmdCache from '../../packages/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from '../_utils';

function makeCacheDir(label: string) {
  return path.resolve(process.cwd(), `.cache/tests-${label}-${randomUUID()}`);
}

describe('fastmd-cache: end-to-end PRE/POST flow', () => {
  test('HIT after MISS+POST; invalidates on content change', async () => {
    const cacheDir = makeCacheDir('cache-behavior');
    const id = path.resolve(process.cwd(), 'tests/fixtures/md/regression.md');
    const contentV1 = '---\ntitle: Hello\n---\nBody';
    const contentV2 = '---\ntitle: Changed\n---\nBody';
    const jsV1 = 'export const v="v1";';
    const jsV2 = 'export const v="v2";';

    const [pre, post] = fastmdCache({ cacheDir, log: 'silent' });

    // First pass: MISS, then write via POST
    const miss = await callTransform(
      pre as unknown as { transform?: TransformLike },
      contentV1,
      id
    );
    expect(miss).toBeNull();
    await callTransform(post as unknown as { transform?: TransformLike }, jsV1, id);

    // Second pass with same inputs: HIT returns cached JS
    const hit = await callTransform(pre as unknown as { transform?: TransformLike }, contentV1, id);
    expect(hit).toBe(jsV1);

    // Change content -> MISS again
    const miss2 = await callTransform(
      pre as unknown as { transform?: TransformLike },
      contentV2,
      id
    );
    expect(miss2).toBeNull();
    await callTransform(post as unknown as { transform?: TransformLike }, jsV2, id);
    const hit2 = await callTransform(
      pre as unknown as { transform?: TransformLike },
      contentV2,
      id
    );
    expect(hit2).toBe(jsV2);
  });
});
