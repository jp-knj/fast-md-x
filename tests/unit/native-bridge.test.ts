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
    process.env.FASTMD_NATIVE = undefined as unknown as string;
    process.env.FASTMD_NATIVE_MODULE = path.join(TMP_DIR, 'nope.js');
    const m = await import('../../plugins/fastmd-cache/native-bridge.mjs');
    const stub = m.loadFastmdNative();
    expect(stub).toBeNull();
    // depsDigestNative returns null when not enabled
    const res = m.depsDigestNative(['x'], undefined as unknown as any);
    expect(res).toBeNull();
    process.env = prevEnv;
  });

  test('falls back when stub lacks deps_digest', async () => {
    const modPath = path.join(TMP_DIR, 'bad-stub.js');
    await writeStub(modPath, 'module.exports = { not_it: () => 0 };\n');
    const prevEnv = { ...process.env };
    process.env.FASTMD_NATIVE = '1';
    process.env.FASTMD_NATIVE_MODULE = modPath;
    const m = await import('../../plugins/fastmd-cache/native-bridge.mjs');
    const stub = m.loadFastmdNative();
    // Should be null since it doesn't expose deps_digest
    expect(stub).toBeNull();
    const res = m.depsDigestNative(['x'], undefined as unknown as any);
    expect(res).toBeNull();
    process.env = prevEnv;
  });

  test('falls back when deps_digest throws', async () => {
    const modPath = path.join(TMP_DIR, 'throw-stub.js');
    await writeStub(
      modPath,
      `module.exports = { deps_digest: () => { throw new Error('boom'); } };\n`
    );
    const prevEnv = { ...process.env };
    process.env.FASTMD_NATIVE = '1';
    process.env.FASTMD_NATIVE_MODULE = modPath;
    const m = await import('../../plugins/fastmd-cache/native-bridge.mjs');
    const res = m.depsDigestNative(['y'], undefined as unknown as any);
    expect(res).toBeNull();
    process.env = prevEnv;
  });
});
