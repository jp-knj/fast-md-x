/**
 * Core types shared across FastMD packages
 */

export interface FastMdFile {
  path: string;
  content: string;
  mtime?: number;
  size?: number;
}

export interface FastMdMetadata {
  frontmatter?: Record<string, unknown>;
  imports?: string[];
  exports?: string[];
  hasJsx?: boolean;
  framework?: 'astro' | 'vite' | 'rollup';
}

export interface FastMdTransformResult {
  code: string;
  map?: unknown;
  metadata?: FastMdMetadata;
  dependencies?: string[];
}

export interface FastMdCacheEntry {
  key: string;
  code: string;
  map?: unknown;
  metadata?: FastMdMetadata;
  timestamp: number;
  size: number;
}

export interface FastMdCacheOptions {
  cacheDir?: string;
  include?: string[];
  exclude?: string[];
  salt?: string;
  log?: 'silent' | 'summary' | 'verbose' | 'json';
  features?: Record<string, boolean | string>;
  mode?: 'development' | 'production';
}

export interface FastMdLogEvent {
  evt: 'cache_hit' | 'cache_miss' | 'cache_write' | 'summary';
  timestamp?: string;
  rel?: string;
  key?: string;
  durationMs?: number;
  sizeBytes?: number;
  savedMs?: number;
  reason?: string;
  stats?: {
    total: number;
    hits: number;
    misses: number;
    hitRate: number;
    p50: number;
    p95: number;
    savedMs: number;
  };
}

export type FastMdPluginHook = (
  code: string,
  id: string,
  options?: unknown
) => Promise<FastMdTransformResult | null> | FastMdTransformResult | null;
