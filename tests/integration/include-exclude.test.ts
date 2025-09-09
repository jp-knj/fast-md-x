/// <reference types="bun-types" />
/**
 * Phase 3.2 — include/exclude globs
 *
 * Expected behavior
 * - Files NOT matched by `include` MUST bypass the cache (no write in POST, no HIT later).
 * - Files matched by `exclude` MUST bypass the cache likewise.
 *
 * Current status (pre-RED): include/exclude are not implemented, so these tests should fail
 * once we assert for MISS-after-POST (bypass) behavior.
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import fastmdCache from '../../packages/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from '../_utils';

async function mkTmp(label: string) {
  const dir = path.resolve(
    process.cwd(),
    `.cache/tests-inc-exc-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

describe('fastmd-cache: include/exclude globs', () => {
  test('include: "**/*.mdx" excludes .md files (bypass cache)', async () => {
    const dir = await mkTmp('include');
    const cacheDir = path.join(dir, '.cache/fastmd');
    const id = path.join(dir, 'note.md');
    const code = '# note';
    const js = 'export default 1;';

    // Using include that only allows .mdx should bypass .md
    const [pre, post] = fastmdCache({ cacheDir, log: 'silent', include: '**/*.mdx' });
    expect(
      await callTransform(pre as unknown as { transform?: TransformLike }, code, id)
    ).toBeNull();

    // If bypassed correctly, POST should not persist and subsequent PRE remains MISS (null)
    await callTransform(post as unknown as { transform?: TransformLike }, js, id);

    const [pre2] = fastmdCache({ cacheDir, log: 'silent', include: '**/*.mdx' });
    const second = await callTransform(pre2 as unknown as { transform?: TransformLike }, code, id);
    // RED: currently implementation will HIT; desired is MISS (null)
    expect(second).toBeNull();
  });

  test('exclude: "**/draft/**" bypasses cache entirely', async () => {
    const dir = await mkTmp('exclude');
    const cacheDir = path.join(dir, '.cache/fastmd');
    const id = path.join(dir, 'draft', 'wip.md');
    const code = '# wip';
    const js = 'export default 2;';

    const [pre, post] = fastmdCache({ cacheDir, log: 'silent', exclude: '**/draft/**' });
    expect(
      await callTransform(pre as unknown as { transform?: TransformLike }, code, id)
    ).toBeNull();
    await callTransform(post as unknown as { transform?: TransformLike }, js, id);

    const [pre2] = fastmdCache({ cacheDir, log: 'silent', exclude: '**/draft/**' });
    const after = await callTransform(pre2 as unknown as { transform?: TransformLike }, code, id);
    // RED: currently implementation will HIT; desired is MISS (null)
    expect(after).toBeNull();
  });
});
