/// <reference types="bun-types" />
/**
 * Smoke-test the plugin using content from examples/minimal without running Astro.
 * Verifies MISS → POST → HIT behavior using the example's index.md file path.
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
// ESM .mjs plugin
import fastmdCache from '../plugins/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from './_utils';

async function mkTmp() {
  const dir = path.resolve(
    process.cwd(),
    `.cache/tests-example-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

describe('examples/minimal smoke', () => {
  test('HIT after MISS+POST using example page', async () => {
    const root = path.resolve(process.cwd(), 'examples/minimal');
    const id = path.join(root, 'src/pages/index.md');
    const code = await fs.readFile(id, 'utf8');
    const cacheDir = path.join(await mkTmp(), '.cache/fastmd');

    const [pre, post] = fastmdCache({ cacheDir, log: 'silent' });
    // First pass: MISS
    expect(
      await callTransform(pre as unknown as { transform?: TransformLike }, code, id)
    ).toBeNull();
    // Simulate toolchain result
    const js = 'export default "ok";';
    await callTransform(post as unknown as { transform?: TransformLike }, js, id);
    // Second pass: HIT
    const hit = await callTransform(pre as unknown as { transform?: TransformLike }, code, id);
    expect(hit).toBe(js);
  });
});
