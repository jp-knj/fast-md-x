/// <reference types="bun-types" />
/**
 * TDD: YAML config loader precedence (ENV → options → YAML env[NODE_ENV] → YAML root)
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import fastmdCache from '../plugins/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from './_utils';

/**
 * Run a callback in a temporary working directory and restore CWD afterward.
 */
async function withTempCwd(fn: (dir: string) => Promise<void>) {
  const origCwd = process.cwd();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fastmd-cfg-'));
  try {
    process.chdir(dir);
    await fn(dir);
  } finally {
    process.chdir(origCwd);
  }
}

/**
 * Write a UTF-8 file, creating parent directories as needed.
 */
async function writeFile(p: string, s: string) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, s, 'utf8');
}

/**
 * Check whether the cache data directory contains any JS entries.
 */
/**
 * Check whether the given cacheDir contains a HIT for (id, code).
 */
async function hasCacheHit(cacheDir: string, id: string, code: string): Promise<boolean> {
  // Force enabled in options to bypass YAML env gating when checking presence.
  const [pre] = fastmdCache({ cacheDir, log: 'silent', enabled: true });
  const hit = await callTransform(pre as { transform?: TransformLike }, code, id);
  return hit != null;
}

describe('config merge order', () => {
  test('options override YAML env which overrides YAML root', async () => {
    await withTempCwd(async (dir) => {
      process.env.NODE_ENV = 'test';
      const yaml = [
        'enabled: true',
        'cacheDir: .cache/root',
        'log: verbose',
        'env:',
        '  test:',
        '    enabled: false',
        '    cacheDir: .cache/env',
        '    log: silent',
        ''
      ].join('\n');
      await writeFile(path.join(dir, 'fastmd.config.yml'), yaml);

      const [pre, post] = fastmdCache({ enabled: true, cacheDir: '.cache/opts', log: 'verbose' });
      const id = path.resolve(dir, 'doc.md');
      const code = '# hi';
      expect(await callTransform(pre as { transform?: TransformLike }, code, id)).toBeNull();
      await callTransform(post as { transform?: TransformLike }, 'export default 0', id);

      // Expect options cacheDir to be used (highest after ENV)
      expect(await hasCacheHit(path.resolve(dir, '.cache/opts'), id, code)).toBe(true);
      expect(await hasCacheHit(path.resolve(dir, '.cache/env'), id, code)).toBe(false);
      expect(await hasCacheHit(path.resolve(dir, '.cache/root'), id, code)).toBe(false);
    });
  });

  test('ENV overrides everything: FASTMD_DISABLE and FASTMD_CACHE_DIR', async () => {
    await withTempCwd(async (dir) => {
      const prevDisable = process.env.FASTMD_DISABLE;
      const prevCache = process.env.FASTMD_CACHE_DIR;
      try {
        process.env.FASTMD_DISABLE = '1';
        process.env.FASTMD_CACHE_DIR = '.cache/envvar';

        const yaml = ['enabled: true', 'cacheDir: .cache/root', ''].join('\n');
        await writeFile(path.join(dir, 'fastmd.config.yml'), yaml);

        const [pre, post] = fastmdCache({ enabled: true, cacheDir: '.cache/opts' });
        const id = path.resolve(dir, 'doc.md');
        // Plugin disabled by ENV; no cache writes should occur
        expect(await callTransform(pre as { transform?: TransformLike }, '# hi', id)).toBeNull();
        await callTransform(post as { transform?: TransformLike }, 'export default 0', id);

        expect(await hasCacheHit(path.resolve(dir, '.cache/envvar'), id, '# hi')).toBe(false);
        expect(await hasCacheHit(path.resolve(dir, '.cache/opts'), id, '# hi')).toBe(false);
        expect(await hasCacheHit(path.resolve(dir, '.cache/root'), id, '# hi')).toBe(false);
      } finally {
        process.env.FASTMD_DISABLE = prevDisable;
        process.env.FASTMD_CACHE_DIR = prevCache;
      }
    });
  });

  test('YAML env[NODE_ENV] overrides YAML root when no options/env', async () => {
    await withTempCwd(async (dir) => {
      process.env.NODE_ENV = 'test';
      const yaml = [
        'enabled: false',
        'cacheDir: .cache/root',
        'env:',
        '  test:',
        '    enabled: true',
        '    cacheDir: .cache/env',
        ''
      ].join('\n');
      await writeFile(path.join(dir, 'fastmd.config.yml'), yaml);

      const [pre, post] = fastmdCache();
      const id = path.resolve(dir, 'doc.md');
      const code = '# hi';
      expect(await callTransform(pre as { transform?: TransformLike }, code, id)).toBeNull();
      await callTransform(post as { transform?: TransformLike }, 'export default 0', id);

      expect(await hasCacheHit(path.resolve(dir, '.cache/env'), id, code)).toBe(true);
      expect(await hasCacheHit(path.resolve(dir, '.cache/root'), id, code)).toBe(false);
    });
  });
});
