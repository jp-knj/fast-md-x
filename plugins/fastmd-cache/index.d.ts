import type { Plugin } from 'vite';

export type FastMdLogLevel = 'silent' | 'summary' | 'verbose' | 'json';
export type TrackDependenciesMode = 'strict' | 'loose';

export interface FastMdFeatures {
  // Reserved for future telemetry toggles; no strict shape required yet
  [key: string]: unknown;
}
export interface FastMdCacheOptions {
  enabled?: boolean;
  cacheDir?: string;
  include?: string | string[];
  exclude?: string | string[];
  salt?: string;
  log?: FastMdLogLevel;
  features?: FastMdFeatures;
  trackDependencies?: TrackDependenciesMode; // 'strict' (default) or 'loose'
}

export type FastMdPluginPhases = Readonly<[Plugin, Plugin]>; // [pre, post]

declare function fastmdCache(options?: FastMdCacheOptions): FastMdPluginPhases;
export default fastmdCache;

// Operational helpers (not Vite-specific)
export declare function clearCache(cacheDir: string): Promise<void>;
export declare function warmup(
  entries: { id: string; code: string; js: string; map?: string }[],
  opts?: { cacheDir?: string; features?: Record<string, unknown> }
): Promise<void>;

// Console JSON log schema (NDJSON lines when log==='json')
export type FastMdLogEvent =
  | { evt: 'cache_miss'; ts: string; rel: string }
  | { evt: 'cache_write'; ts: string; rel: string; durationMs: number; sizeBytes: number }
  | { evt: 'cache_hit'; ts: string; rel: string; durationMs: number; sizeBytes?: number }
  | {
      evt: 'summary';
      ts: string;
      total: number;
      hits: number;
      misses: number;
      hitRate: number;
      p50: number;
      p95: number;
      savedMs: number;
    };
