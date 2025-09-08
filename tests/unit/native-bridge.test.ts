/// <reference types="bun-types" />
/**
 * Native bridge injection (TDD)
 *
 * Goal: Support FASTMD_NATIVE_MODULE to load a JS stub that mimics the native addon.
 * This allows CI-safe tests without building a real N-API binary.
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';

const TMP_DIR = path.resolve(
  process.cwd(),
  `.cache/tests-native-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

async function writeStub(modulePath: string, body: string) {
  await fs.mkdir(path.dirname(modulePath), { recursive: true });
  await fs.writeFile(modulePath, body, 'utf8');
}

describe('native-bridge: FASTMD_NATIVE_MODULE injection', () => {
  test('loads stub module and uses deps_digest', async () => {
    const modPath = path.join(TMP_DIR, 'stub-native.js');
    await writeStub(
      modPath,
      `module.exports = { deps_digest: (arr) => 'NATIVE_OK_' + (Array.isArray(arr) ? arr.length : -1) };\n`
    );

    const prevEnv = { ...process.env };
    process.env.FASTMD_NATIVE = '1';
    process.env.FASTMD_NATIVE_MODULE = modPath;

    // dynamic import after env set
    const m = await import('../../plugins/fastmd-cache/native-bridge.mjs');
    const stub = m.loadFastmdNative();
    expect(!!stub).toBe(true);
    // depsDigestNative should call the stub
    const res = m.depsDigestNative(['a', 'b', 'c'], stub);
    expect(res).toBe('NATIVE_OK_3');

    // restore env
    process.env = prevEnv;
  });

  test('disabled when FASTMD_NATIVE != 1', async () => {
    const prevEnv = { ...process.env };
    delete process.env.FASTMD_NATIVE;
    process.env.FASTMD_NATIVE_MODULE = path.join(TMP_DIR, 'nope.js');
    const m = await import('../../plugins/fastmd-cache/native-bridge.mjs');
    const stub = m.loadFastmdNative();
    expect(stub).toBeNull();
    // depsDigestNative returns null when not enabled
    const res = m.depsDigestNative(['x']);
    expect(res).toBeNull();
    process.env = prevEnv;
  });
});

