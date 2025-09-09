/// <reference types="bun-types" />
/**
 * Unit tests for cache key generation logic.
 * Tests the deterministic generation of cache keys based on content and configuration.
 */

import { describe, expect, test } from 'bun:test';
// @ts-ignore - ESM import
import { __internals } from '../../packages/fastmd-cache/index.mjs';
import { MarkdownBuilder, createMockPluginConfig } from '../_utils';

describe('Cache Key Generation', () => {
  describe('normalizeId', () => {
    test('removes query parameters from file paths', () => {
      const root = process.cwd();
      const id = '/path/to/file.md?timestamp=123456';
      const normalized = __internals.normalizeId(id, root);
      expect(normalized.rel).not.toContain('?');
      expect(normalized.rel).not.toContain('timestamp');
    });

    test('handles /@fs/ prefixes correctly', () => {
      const root = process.cwd();
      const id = `/@fs/${root}/src/pages/test.md`;
      const normalized = __internals.normalizeId(id, root);
      expect(normalized.rel).not.toContain('/@fs/');
      expect(normalized.rel).toContain('src/pages/test.md');
    });

    test('converts to lowercase for case-insensitive matching', () => {
      const root = process.cwd();
      const id = '/Path/To/FILE.MD';
      const normalized = __internals.normalizeId(id, root);
      expect(normalized.rel).toBe(normalized.rel.toLowerCase());
    });

    test('converts to relative posix paths', () => {
      const root = process.cwd();
      const id = `${root}/src/pages/test.md`;
      const normalized = __internals.normalizeId(id, root);
      expect(normalized.rel).not.toContain('\\');
      expect(normalized.rel).toContain('/');
      expect(normalized.rel).toBe('src/pages/test.md');
    });

    test.skip('handles Windows paths correctly', () => {
      // This test is platform-specific and will fail on non-Windows systems
      const root = 'C:\\Users\\test\\project';
      const id = 'C:\\Users\\test\\project\\src\\pages\\test.md';
      const normalized = __internals.normalizeId(id, root);
      expect(normalized.rel).toBe('src/pages/test.md');
      expect(normalized.rel).not.toContain('\\');
    });
  });

  describe('digestJSON', () => {
    test('generates consistent hash for same object regardless of key order', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { c: 3, a: 1, b: 2 };
      const hash1 = __internals.digestJSON(obj1);
      const hash2 = __internals.digestJSON(obj2);
      expect(hash1).toBe(hash2);
    });

    test('generates different hashes for different objects', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };
      const hash1 = __internals.digestJSON(obj1);
      const hash2 = __internals.digestJSON(obj2);
      expect(hash1).not.toBe(hash2);
    });

    test('handles nested objects correctly', () => {
      const obj1 = { a: { b: { c: 1 } }, d: 2 };
      const obj2 = { d: 2, a: { b: { c: 1 } } };
      const hash1 = __internals.digestJSON(obj1);
      const hash2 = __internals.digestJSON(obj2);
      expect(hash1).toBe(hash2);
    });

    test('handles arrays in objects', () => {
      const obj = { items: [1, 2, 3], name: 'test' };
      const hash = __internals.digestJSON(obj);
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    test('handles null and undefined values', () => {
      const obj1 = { a: null, b: undefined, c: 1 };
      const obj2 = { a: null, c: 1 };
      const hash1 = __internals.digestJSON(obj1);
      const hash2 = __internals.digestJSON(obj2);
      // undefined values are typically omitted in JSON
      expect(hash1).toBe(hash2);
    });
  });

  describe('sha256', () => {
    test('generates correct hash for known input', () => {
      const hash = __internals.sha256('abc');
      expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    test('generates consistent hash for same input', () => {
      const input = 'test string for hashing';
      const hash1 = __internals.sha256(input);
      const hash2 = __internals.sha256(input);
      expect(hash1).toBe(hash2);
    });

    test('generates different hashes for different inputs', () => {
      const hash1 = __internals.sha256('input1');
      const hash2 = __internals.sha256('input2');
      expect(hash1).not.toBe(hash2);
    });

    test('handles empty string', () => {
      const hash = __internals.sha256('');
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    test('handles unicode characters', () => {
      const hash = __internals.sha256('Hello 世界 🌍');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });
  });

  describe('cache key composition', () => {
    test('includes content in cache key', () => {
      const content1 = '# Title\nContent 1';
      const content2 = '# Title\nContent 2';

      // Since we can't directly test the cache key generation without
      // the full plugin context, we verify that content normalization works
      const normalized1 = __internals.normalizeNewlines(content1);
      const normalized2 = __internals.normalizeNewlines(content2);

      expect(__internals.sha256(normalized1)).not.toBe(__internals.sha256(normalized2));
    });

    test.skip('includes salt in cache key when provided', () => {
      // Salt functionality not yet implemented in current version
      const config1 = createMockPluginConfig({ salt: 'salt1' });
      const config2 = createMockPluginConfig({ salt: 'salt2' });

      const state1 = __internals.createState(config1);
      const state2 = __internals.createState(config2);

      // @ts-ignore - salt property doesn't exist yet
      expect(state1.salt).toBe('salt1');
      // @ts-ignore - salt property doesn't exist yet
      expect(state2.salt).toBe('salt2');
    });

    test('normalizes content before hashing', () => {
      const contentWithCRLF = 'Line 1\r\nLine 2\r\nLine 3';
      const contentWithLF = 'Line 1\nLine 2\nLine 3';

      const normalized1 = __internals.normalizeNewlines(contentWithCRLF);
      const normalized2 = __internals.normalizeNewlines(contentWithLF);

      expect(normalized1).toBe(normalized2);
    });

    test('strips BOM from content', () => {
      const contentWithBOM = '\uFEFF# Title\nContent';
      const contentWithoutBOM = '# Title\nContent';

      const stripped = __internals.stripBOM(contentWithBOM);
      expect(stripped).toBe(contentWithoutBOM);
    });

    test('handles frontmatter extraction', () => {
      const markdown = new MarkdownBuilder()
        .withFrontmatter({ title: 'Test', tags: ['a', 'b'] })
        .withContent('# Content')
        .build();

      const frontmatter = __internals.extractFrontmatter(markdown);
      expect(frontmatter).toContain('title:');
      expect(frontmatter).toContain('tags:');
    });
  });

  describe('sortedObject', () => {
    test('sorts object keys alphabetically', () => {
      const obj = { z: 1, a: 2, m: 3, b: 4 };
      const sorted = __internals.sortedObject(obj);
      const keys = Object.keys(sorted);
      expect(keys).toEqual(['a', 'b', 'm', 'z']);
    });

    test('sorts top-level keys only (not recursive)', () => {
      const obj = {
        z: { b: 2, a: 1 },
        a: { z: 4, x: 3 }
      };
      const sorted = __internals.sortedObject(obj);
      const topKeys = Object.keys(sorted);
      // @ts-ignore - accessing nested object
      const nestedKeys1 = Object.keys(sorted.a);
      // @ts-ignore - accessing nested object
      const nestedKeys2 = Object.keys(sorted.z);

      expect(topKeys).toEqual(['a', 'z']);
      // Nested objects are not sorted
      expect(nestedKeys1).toEqual(['z', 'x']);
      expect(nestedKeys2).toEqual(['b', 'a']);
    });

    test('preserves arrays without sorting', () => {
      const obj = { items: [3, 1, 2], sorted: false };
      const sorted = __internals.sortedObject(obj);
      expect(sorted.items).toEqual([3, 1, 2]);
    });

    test('handles mixed types correctly', () => {
      const obj = {
        str: 'string',
        num: 123,
        bool: true,
        nil: null,
        arr: [1, 2],
        obj: { a: 1 }
      };
      const sorted = __internals.sortedObject(obj);
      const keys = Object.keys(sorted);
      expect(keys).toEqual(['arr', 'bool', 'nil', 'num', 'obj', 'str']);
    });
  });
});
