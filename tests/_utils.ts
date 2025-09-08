/// <reference types="bun-types" />
/**
 * Test helpers for invoking Vite plugin hooks and common test utilities.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

// (mkdtemp/tmpdir/join) were previously used; removed after consolidating helpers

export type TransformLike =
  | ((code: string, id: string) => unknown)
  | {
      handler: (code: string, id: string) => unknown;
      order?: 'pre' | 'post';
    };

/**
 * Call a Vite transform hook that may be either a function or an ObjectHook.
 * This narrows the union so TypeScript is satisfied (avoids TS2349).
 *
 * Note: we pass a minimal context; hooks in this repo do not rely on Rollup context.
 */
export async function callTransform(
  phase: { transform?: TransformLike } | undefined,
  code: string,
  id: string
) {
  const t = phase?.transform as TransformLike | undefined;
  if (!t) return null;
  if (typeof t === 'function') {
    return await (t as (code: string, id: string) => unknown).call({}, code, id);
  }
  if (typeof t === 'object' && typeof t.handler === 'function') {
    return await t.handler.call({}, code, id);
  }
  return null;
}

/**
 * Create a unique temporary directory under the project `.cache` for integration tests.
 * Example: `.cache/tests-<prefix>-<timestamp>-<rand>`
 */
export async function createTempDir(prefix = 'tmp') {
  const dir = path.resolve(
    process.cwd(),
    `.cache/tests-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Resolve a file path inside `tests/fixtures`.
 */
// (fixture) helper removed as unused

/**
 * Capture console.log output during the execution of an async function and return
 * the collected lines (optionally JSON-parsed).
 */
// (captureLogs) helper removed as unused (tests use inline capture)

// Note: a second createTempDir (mkdtemp-based) existed; removed to avoid redeclare.

/**
 * Test data builder for creating consistent test markdown content.
 */
export class MarkdownBuilder {
  private frontmatter: Record<string, unknown> = {};
  private content = '';

  withFrontmatter(data: Record<string, unknown>): this {
    this.frontmatter = { ...this.frontmatter, ...data };
    return this;
  }

  withContent(content: string): this {
    this.content = content;
    return this;
  }

  build(): string {
    const hasFrontmatter = Object.keys(this.frontmatter).length > 0;
    if (!hasFrontmatter) {
      return this.content;
    }

    const frontmatterStr = Object.entries(this.frontmatter)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n');

    return `---\n${frontmatterStr}\n---\n${this.content}`;
  }
}

/**
 * Mock factory for creating test plugin configurations.
 */
export function createMockPluginConfig(overrides = {}) {
  return {
    cacheDir: '.cache/fastmd',
    include: ['**/*.md', '**/*.mdx'],
    exclude: [],
    salt: '',
    disable: false,
    logLevel: 'error' as const,
    ...overrides
  };
}

/**
 * Assertion helper for cache hit validation.
 */
// (assertCacheHit) removed as unused

/**
 * Assertion helper for cache miss validation.
 */
// (assertCacheMiss) removed as unused

/**
 * Creates a test file path helper.
 */
// (createTestPath) removed as unused

/**
 * Waits for a condition to be true with timeout.
 */
// (waitFor) removed as unused

/**
 * Test fixture loader for common test scenarios.
 */
// (TestFixtures) removed as unused
