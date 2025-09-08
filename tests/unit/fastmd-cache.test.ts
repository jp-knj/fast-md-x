/// <reference types="bun-types" />
/**
 * fastmd-cache plugin — smoke tests
 *
 * Goals
 * - Ensure the factory returns two Vite plugins (pre/post phases).
 * - Verify identifying metadata (`name`, `enforce`) to document the contract.
 * - Sanity-check transform gating: non-Markdown inputs are ignored by `pre.transform`.
 *
 * Notes
 * - Runner: Bun (`bun test`). No filesystem I/O is performed.
 * - The plugin under test is ESM (`index.mjs`).
 */
import { describe, expect, test } from 'bun:test';
import fastmdCache from '../../plugins/fastmd-cache/index.mjs';

/**
 * Create plugin phases with default options and assert basic shape.
 * @returns {[any, any]} Tuple of `[pre, post]` plugins.
 */
type Phase = { name?: string; enforce?: string; transform?: (...args: unknown[]) => unknown };

function createPhases(): [Phase, Phase] {
  const plugins = fastmdCache();
  expect(Array.isArray(plugins)).toBe(true);
  expect(plugins.length).toBe(2);
  return plugins as unknown as [Phase, Phase];
}

describe('fastmd-cache plugin', () => {
  test('factory returns both phases with correct metadata', () => {
    const [pre, post] = createPhases();
    expect(pre?.name).toBe('fastmd-cache-pre');
    expect(pre?.enforce).toBe('pre');
    expect(typeof pre?.transform).toBe('function');

    expect(post?.name).toBe('fastmd-cache-post');
    expect(post?.enforce).toBe('post');
    expect(typeof post?.transform).toBe('function');
  });

  test('pre.transform ignores non-md files (.js)', async () => {
    const [pre] = createPhases();
    /**
     * For non-Markdown inputs, `shouldProcess` returns false and `transform`
     * should be a no-op (null) to defer to downstream tooling.
     */
    const result = await pre.transform?.('console.log("hi")', '/tmp/example.js');
    expect(result).toBeNull();
  });
});
