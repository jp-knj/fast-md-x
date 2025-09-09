/// <reference types="bun-types" />
/**
 * Integration-ish test: plugin uses native deps_digest when available (via injection)
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import fastmdCache from '../../packages/fastmd-cache/index.mjs';

async function mkTmp(label: string) {
  const dir = path.resolve(
    process.cwd(),
    `.cache/tests-native-plug-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

describe('plugin + native bridge', () => {
  test('uses injected native deps_digest (marker file written)', async () => {
    const dir = await mkTmp('ok');
    const cacheDir = path.join(dir, '.cache/fastmd');
    const depA = path.join(dir, 'a.md');
    const depB = path.join(dir, 'b.mdx');
    await fs.writeFile(depA, '# a', 'utf8');
    await fs.writeFile(depB, '# b', 'utf8');

    const marker = path.join(dir, 'marker.txt');
    const stubPath = path.join(dir, 'stub-native.js');
    await fs.writeFile(
      stubPath,
      `const fs = require('node:fs');\nmodule.exports = {\n  deps_digest(arr){ fs.writeFileSync(${JSON.stringify(
        marker
      )}, String(Array.isArray(arr)?arr.length:-1)); return 'NA'; }\n};\n`,
      'utf8'
    );

    const id = path.join(dir, 'doc.md');
    const code = '# doc';
    const [pre] = fastmdCache({ cacheDir, log: 'silent', trackDependencies: 'strict' });
    const ctx = {
      getModuleInfo(_id: string) {
        return { importedIds: [depA, depB], dynamicallyImportedIds: [] };
      }
    } as unknown as ThisType<unknown>;

    const prevEnv = { ...process.env };
    process.env.FASTMD_NATIVE = '1';
    process.env.FASTMD_NATIVE_MODULE = stubPath;
    try {
      const out = await (pre.transform as (c: string, i: string) => unknown).call(ctx, code, id);
      expect(out).toBeNull();
      const m = await fs.readFile(marker, 'utf8').catch(() => '');
      expect(m).toBe('2');
    } finally {
      process.env = prevEnv;
    }
  });

  test('fallback when native throws (no marker)', async () => {
    const dir = await mkTmp('throw');
    const cacheDir = path.join(dir, '.cache/fastmd');
    const dep = path.join(dir, 'a.md');
    await fs.writeFile(dep, '# a', 'utf8');
    const marker = path.join(dir, 'marker.txt');
    const stubPath = path.join(dir, 'stub-native.js');
    await fs.writeFile(
      stubPath,
      `module.exports = { deps_digest(){ throw new Error('boom'); } };\n`,
      'utf8'
    );

    const id = path.join(dir, 'doc.md');
    const code = '# doc';
    const [pre] = fastmdCache({ cacheDir, log: 'silent', trackDependencies: 'strict' });
    const ctx = {
      getModuleInfo(_id: string) {
        return { importedIds: [dep], dynamicallyImportedIds: [] };
      }
    } as unknown as ThisType<unknown>;

    const prevEnv = { ...process.env };
    process.env.FASTMD_NATIVE = '1';
    process.env.FASTMD_NATIVE_MODULE = stubPath;
    try {
      const out = await (pre.transform as (c: string, i: string) => unknown).call(ctx, code, id);
      expect(out).toBeNull();
      const exists = await fs
        .access(marker)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    } finally {
      process.env = prevEnv;
    }
  });
});
