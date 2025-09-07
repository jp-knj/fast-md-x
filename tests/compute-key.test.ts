/// <reference types="bun-types" />
/**
 * TDD: computeKey() — stable and sensitive where required
 *
 * Scope
 * - Exists and returns sha256-like hex string
 * - Stable under frontmatter key reordering and CRLF→LF normalization
 * - Sensitive to importer, mode, and salt
 * - Path invariants: /@fs/ and case-normalized POSIX relpath yield same key
 */
import { describe, expect, test } from 'bun:test';
// Import internals; the helper may not exist yet (TDD: expect this to fail initially)
// eslint-disable-next-line @typescript-eslint/no-var-requires
// @ts-ignore – ESM .mjs without types; cast to any for white-box tests
import { __internals as I } from '../plugins/fastmd-cache/index.mjs';

// Cast to any to avoid TS compile errors until helper exists
const internals: any = I as any;

// Common fixture values
const root = '/repo';
const toolchainDigest = 'node=22.5.0|vite=5.4.0|astro=5.13.5';

function call(args: {
  code: string;
  id: string;
  features?: Record<string, unknown>;
  mode?: 'dev' | 'build' | 'prod';
  salt?: string;
  importer?: string;
}) {
  if (typeof internals.computeKey !== 'function') {
    throw new Error('computeKey helper is not implemented yet');
  }
  return internals.computeKey({
    code: args.code,
    id: args.id,
    root,
    features: args.features ?? {},
    toolchainDigest,
    mode: args.mode ?? 'build',
    salt: args.salt ?? '',
    importer: args.importer ?? ''
  });
}

describe('computeKey()', () => {
  test('exists and returns 64-char hex', () => {
    expect(typeof internals.computeKey).toBe('function');
    const key = call({ code: '# hi', id: '/repo/docs/a.md' });
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  test('frontmatter key order does not change key', () => {
    const a = call({
      id: '/repo/docs/a.md',
      code: '---\na: 1\nb: 2\n---\n# T' // a,b
    });
    const b = call({
      id: '/repo/docs/a.md',
      code: '---\nb: 2\na: 1\n---\n# T' // b,a
    });
    expect(a).toBe(b);
  });

  test('different importer changes key', () => {
    const base = { code: '# X', id: '/repo/docs/a.md' };
    const k1 = call({ ...base, importer: '/repo/src/entry.ts' });
    const k2 = call({ ...base, importer: '' });
    expect(k1).not.toBe(k2);
  });

  test('different mode changes key (dev vs build)', () => {
    const base = { code: '# X', id: '/repo/docs/a.md' };
    const kDev = call({ ...base, mode: 'dev' });
    const kBuild = call({ ...base, mode: 'build' });
    expect(kDev).not.toBe(kBuild);
  });

  test('salt influences key', () => {
    const base = { code: '# X', id: '/repo/docs/a.md' };
    const kA = call({ ...base, salt: 'alpha' });
    const kB = call({ ...base, salt: 'beta' });
    expect(kA).not.toBe(kB);
  });

  test('id normalization invariants: /@fs/ and case yield same key', () => {
    const code = '# x';
    const k1 = call({ id: '/@fs//repo/docs/Index.MD?raw', code });
    const k2 = call({ id: '/repo/docs/index.md', code });
    expect(k1).toBe(k2);
  });
});

