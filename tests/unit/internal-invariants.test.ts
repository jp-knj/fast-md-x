/// <reference types="bun-types" />
/**
 * fastmd-cache — internal invariants coverage
 */
import { describe, expect, test } from 'bun:test';
// removed unused fs/os imports
import path from 'node:path';
import fastmdCache, { __internals } from '../../packages/fastmd-cache/index.mjs';

// tmpdir helper removed (no longer used)

describe('helpers: shouldProcess', () => {
  test('detects md/mdx only', () => {
    const st = __internals.createState({});
    expect(__internals.shouldProcess('a.md', st)).toBe(true);
    expect(__internals.shouldProcess('a.mdx', st)).toBe(true);
    expect(__internals.shouldProcess('a.MD', st)).toBe(true);
    expect(__internals.shouldProcess('a.js', st)).toBe(false);
    expect(__internals.shouldProcess('a.astro', st)).toBe(false);
  });
});
describe('helpers: normalizeId', () => {
  test('removes query, handles /@fs/, lowercases, posix rel', () => {
    const root = process.cwd();
    const abs = path.resolve(root, 'Docs/UPPER.MD');
    const { rel, pathDigest } = __internals.normalizeId(`${abs}?x=1`, root);
    expect(rel).toBe('docs/upper.md');
    expect(pathDigest).toBe(rel);

    const viaFs = __internals.normalizeId(`/@fs${abs}?v=2`, root);
    expect(viaFs.rel).toBe('docs/upper.md');
  });
});

describe('helpers: text + YAML normalization', () => {
  test('stripBOM + newline normalization', () => {
    const s = '\uFEFFline1\r\nline2\rline3\n';
    expect(__internals.normalizeNewlines(__internals.stripBOM(s))).toBe('line1\nline2\nline3\n');
  });

  test('extractFrontmatter returns raw block text', () => {
    const block = 'title: X\nflag: true\nnum: 1.5';
    const content = `---\n${block}\n---\nBody`;
    const fm = __internals.extractFrontmatter(content);
    expect(fm).toBe(block);
  });
});

describe('helpers: hashing + sorting', () => {
  test('sortedObject + digestJSON determinism', () => {
    const a = { z: 1, a: 2 };
    const b = { a: 2, z: 1 };
    const da = __internals.digestJSON(__internals.sortedObject(a));
    const db = __internals.digestJSON(__internals.sortedObject(b));
    expect(da).toBe(db);
  });

  test('sha256 known vector', () => {
    const h = __internals.sha256('abc');
    expect(h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

// FS-specific helpers removed (cacache-only backend now)

describe('helpers: toolchain + config', () => {
  test('getToolchainDigest contains node and astro', async () => {
    const s = await __internals.getToolchainDigest();
    expect(s.includes('node=')).toBe(true);
    expect(s.includes('astro=')).toBe(true);
  });

  // YAML config removed: no digest test
});

describe('helpers: misc', () => {
  test('truthy variants', () => {
    expect(__internals.truthy('1')).toBe(true);
    expect(__internals.truthy('on')).toBe(true);
    expect(__internals.truthy('yes')).toBe(true);
    expect(__internals.truthy('true')).toBe(true);
    expect(__internals.truthy('0')).toBe(false);
  });

  test('fmtMs formats', () => {
    expect(__internals.fmtMs(15)).toBe('15ms');
  });

  test('logSummary outputs expected fields', () => {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (s) => lines.push(String(s));
    try {
      __internals.logSummary({ stats: { hits: 3, misses: 1, durations: [5, 10, 20, 30] } });
    } finally {
      console.log = orig;
    }
    expect(
      lines.some(
        (l) =>
          l.includes('[fastmd] summary total=4') && l.includes('hits=3') && l.includes('misses=1')
      )
    ).toBe(true);
  });
});

describe('public API: basic integration smoke', () => {
  test('plugin factory still returns pre/post', () => {
    const arr = fastmdCache();
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBe(2);
  });
});
