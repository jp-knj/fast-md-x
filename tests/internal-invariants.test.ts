/// <reference types="bun-types" />
/**
 * fastmd-cache — internal invariants coverage
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import fastmdCache, { __internals } from '../plugins/fastmd-cache/index.mjs';

function tmpdir(label = 'inv') {
  return fs.mkdtemp(path.join(os.tmpdir(), `fastmd-${label}-`));
}

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

  test('extractFrontmatter and normalizeFrontmatter scalars', () => {
    const yaml = 'b: 2\na: "x"\nflag: true\nnone: null\nnum: 1.5';
    const content = `---\n${yaml}\n---\nBody`;
    const fm = __internals.extractFrontmatter(content);
    const norm = __internals.normalizeFrontmatter(fm);
    // sorted keys and typed values
    expect(norm).toBe('{"a":"x","b":2,"flag":true,"none":null,"num":1.5}');
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

describe('helpers: fs + io', () => {
  test('cachePaths layout', () => {
    const p = __internals.cachePaths('.cache/x', 'k');
    expect(p.dataPath.endsWith('data/k.js')).toBe(true);
    expect(p.mapPath.endsWith('data/k.js.map')).toBe(true);
    expect(p.metaPath.endsWith('meta/k.json')).toBe(true);
  });

  test('ensureDirs and atomicWriteIfAbsent', async () => {
    const dir = await tmpdir('io');
    await __internals.ensureDirs(dir);
    const { dataPath } = __internals.cachePaths(dir, 'k');
    await __internals.atomicWriteIfAbsent(dataPath, 'one');
    await __internals.atomicWriteIfAbsent(dataPath, 'two');
    const read = await fs.readFile(dataPath, 'utf8');
    expect(read).toBe('one');
  });
});

describe('helpers: toolchain + config', () => {
  test('getToolchainDigest contains node and astro', async () => {
    const s = await __internals.getToolchainDigest();
    expect(s.includes('node=')).toBe(true);
    expect(s.includes('astro=')).toBe(true);
  });

  test('resolveConfigDigestSync reads YAML when present', async () => {
    const dir = await tmpdir('cfg');
    const yml = 'x: 1\n';
    await fs.writeFile(path.join(dir, 'fastmd.config.yml'), yml, 'utf8');
    const st = { root: dir, configDigest: '' };
    __internals.resolveConfigDigestSync(st);
    expect(st.configDigest).toBe(
      __internals.sha256(__internals.normalizeNewlines(__internals.stripBOM(yml)))
    );
  });
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
