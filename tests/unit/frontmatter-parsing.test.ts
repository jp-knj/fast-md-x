/// <reference types="bun-types" />
/**
 * Unit tests for frontmatter parsing functionality.
 * Tests extraction and processing of YAML frontmatter from Markdown files.
 */

import { describe, expect, test } from 'bun:test';
// gray-matter is used internally but not exported, so we import it directly
import matter from 'gray-matter';
// @ts-ignore - ESM import
import { __internals } from '../../packages/fastmd-cache/index.mjs';
import { MarkdownBuilder } from '../_utils';

describe('Frontmatter Parsing', () => {
  describe('extractFrontmatter', () => {
    test('extracts basic frontmatter block', () => {
      const content = `---
title: Test Page
author: John Doe
---
# Content`;

      const frontmatter = __internals.extractFrontmatter(content);
      expect(frontmatter).toBe('title: Test Page\nauthor: John Doe');
    });

    test('returns empty string when no frontmatter', () => {
      const content = '# Just Content\n\nNo frontmatter here';
      const frontmatter = __internals.extractFrontmatter(content);
      expect(frontmatter).toBe('');
    });

    test('handles empty frontmatter block', () => {
      const content = `---
---
# Content`;
      const frontmatter = __internals.extractFrontmatter(content);
      expect(frontmatter).toBe('');
    });

    test('handles frontmatter with special characters', () => {
      const content = `---
title: "Test: Page with special chars!"
description: 'It\\'s a test'
---
# Content`;

      const frontmatter = __internals.extractFrontmatter(content);
      expect(frontmatter).toContain('title:');
      expect(frontmatter).toContain('description:');
    });

    test('handles multiline frontmatter values', () => {
      const content = `---
title: Test
description: |
  This is a multiline
  description that spans
  multiple lines
tags:
  - one
  - two
---
# Content`;

      const frontmatter = __internals.extractFrontmatter(content);
      expect(frontmatter).toContain('title: Test');
      expect(frontmatter).toContain('description:');
      expect(frontmatter).toContain('tags:');
    });

    test('handles frontmatter with BOM', () => {
      const content = `\uFEFF---
title: Test
---
# Content`;

      const stripped = __internals.stripBOM(content);
      const frontmatter = __internals.extractFrontmatter(stripped);
      expect(frontmatter).toBe('title: Test');
    });

    test('ignores non-frontmatter dashes', () => {
      const content = `# Title

Some content with --- dashes

Not frontmatter`;

      const frontmatter = __internals.extractFrontmatter(content);
      expect(frontmatter).toBe('');
    });
  });

  describe('gray-matter integration', () => {
    test('parses simple frontmatter', () => {
      const content = new MarkdownBuilder()
        .withFrontmatter({ title: 'Test', draft: false })
        .withContent('# Hello')
        .build();

      const result = matter(content);
      expect(result.data.title).toBe('Test');
      expect(result.data.draft).toBe(false);
      expect(result.content).toContain('# Hello');
    });

    test('parses complex frontmatter types', () => {
      const content = `---
title: Complex Test
number: 42
float: 3.14
boolean: true
null_value: null
date: 2024-01-01
array:
  - item1
  - item2
  - item3
object:
  key1: value1
  key2: value2
nested:
  level1:
    level2: deep value
---
# Content`;

      const result = matter(content);
      expect(result.data.title).toBe('Complex Test');
      expect(result.data.number).toBe(42);
      expect(result.data.float).toBe(3.14);
      expect(result.data.boolean).toBe(true);
      expect(result.data.null_value).toBeNull();
      expect(result.data.array).toEqual(['item1', 'item2', 'item3']);
      expect(result.data.object).toEqual({ key1: 'value1', key2: 'value2' });
      expect(result.data.nested.level1.level2).toBe('deep value');
    });

    test('preserves content after frontmatter', () => {
      const content = `---
title: Test
---

# Heading

Paragraph with **bold** and *italic* text.

\`\`\`js
const code = 'block';
\`\`\`

- List item 1
- List item 2`;

      const result = matter(content);
      expect(result.content).toContain('# Heading');
      expect(result.content).toContain('**bold**');
      expect(result.content).toContain('```js');
      expect(result.content).toContain('- List item 1');
    });

    test('handles invalid YAML gracefully', () => {
      const content = `---
title: Test
invalid: [unclosed array
---
# Content`;

      // gray-matter throws on invalid YAML by default
      expect(() => matter(content)).toThrow();
    });

    test('handles empty input', () => {
      const result = matter('');
      expect(result.data).toEqual({});
      expect(result.content).toBe('');
    });

    test('parses frontmatter with quoted values', () => {
      const content = `---
single: 'single quoted'
double: "double quoted"
unquoted: no quotes
with_colon: "value: with colon"
---
# Content`;

      const result = matter(content);
      expect(result.data.single).toBe('single quoted');
      expect(result.data.double).toBe('double quoted');
      expect(result.data.unquoted).toBe('no quotes');
      expect(result.data.with_colon).toBe('value: with colon');
    });
  });

  describe('frontmatter normalization', () => {
    test('consistent parsing with different line endings', () => {
      const contentLF = '---\ntitle: Test\n---\n# Content';
      const contentCRLF = '---\r\ntitle: Test\r\n---\r\n# Content';

      const normalizedLF = __internals.normalizeNewlines(contentLF);
      const normalizedCRLF = __internals.normalizeNewlines(contentCRLF);

      const fm1 = __internals.extractFrontmatter(normalizedLF);
      const fm2 = __internals.extractFrontmatter(normalizedCRLF);

      expect(fm1).toBe(fm2);
    });

    test('frontmatter extraction is deterministic', () => {
      const content = new MarkdownBuilder()
        .withFrontmatter({
          z: 'last',
          a: 'first',
          m: 'middle'
        })
        .withContent('Content')
        .build();

      const fm1 = __internals.extractFrontmatter(content);
      const fm2 = __internals.extractFrontmatter(content);

      expect(fm1).toBe(fm2);
    });

    test('whitespace handling in frontmatter', () => {
      const content = `---
title: "  Test  "
tags:
  - "  one  "
  - "  two  "
---
# Content`;

      const result = matter(content);
      // gray-matter preserves whitespace in quoted strings
      expect(result.data.title).toBe('  Test  ');
      expect(result.data.tags).toEqual(['  one  ', '  two  ']);
    });
  });

  describe('edge cases', () => {
    test('handles multiple --- in content', () => {
      const content = `---
title: Test
---

# Content

---

More content with --- in it

---`;

      const result = matter(content);
      expect(result.data.title).toBe('Test');
      expect(result.content).toContain('---');
      expect(result.content).toContain('More content with --- in it');
    });

    test('handles frontmatter-like content in code blocks', () => {
      const content = `---
title: Real Frontmatter
---

# Example

\`\`\`yaml
---
title: Not Frontmatter
---
\`\`\``;

      const result = matter(content);
      expect(result.data.title).toBe('Real Frontmatter');
      expect(result.content).toContain('title: Not Frontmatter');
    });

    test('handles unicode in frontmatter', () => {
      const content = `---
title: "测试 🚀 Test"
author: José García
tags:
  - français
  - 日本語
  - emoji 😊
---
# Content`;

      const result = matter(content);
      expect(result.data.title).toBe('测试 🚀 Test');
      expect(result.data.author).toBe('José García');
      expect(result.data.tags).toContain('日本語');
      expect(result.data.tags).toContain('emoji 😊');
    });

    test('handles very large frontmatter', () => {
      const largeFrontmatter: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeFrontmatter[`key${i}`] = `value${i}`;
      }

      const content = new MarkdownBuilder()
        .withFrontmatter(largeFrontmatter)
        .withContent('# Content')
        .build();

      const result = matter(content);
      expect(Object.keys(result.data).length).toBe(100);
      expect(result.data.key50).toBe('value50');
    });
  });
});
