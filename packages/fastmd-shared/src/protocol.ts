/**
 * NDJSON RPC protocol definitions for FastMD sidecar communication
 */

export const PROTOCOL_VERSION = '1.0.0';

export type RpcId = string | number;

export interface RpcRequest {
  jsonrpc: '2.0';
  id: RpcId;
  method: string;
  params?: unknown;
}

export interface RpcResponse {
  jsonrpc: '2.0';
  id: RpcId;
  result?: unknown;
  error?: RpcError;
}

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface RpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

// Standard error codes
export const RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Custom error codes
  TRANSFORM_ERROR: -32001,
  CACHE_ERROR: -32002,
  IO_ERROR: -32003
} as const;

// Method names for sidecar operations
export const RPC_METHODS = {
  // Core operations
  TRANSFORM: 'transform',
  NORMALIZE: 'normalize',
  COMPUTE_DIGEST: 'computeDigest',

  // Cache operations
  CACHE_GET: 'cache.get',
  CACHE_SET: 'cache.set',
  CACHE_DELETE: 'cache.delete',
  CACHE_CLEAR: 'cache.clear',
  CACHE_STATS: 'cache.stats',

  // Lifecycle
  PING: 'ping',
  SHUTDOWN: 'shutdown',
  CONFIGURE: 'configure'
} as const;

// Request/Response types for each method
export interface TransformRequest {
  file: string;
  content: string;
  options?: {
    mode?: 'development' | 'production';
    sourcemap?: boolean;
    framework?: 'astro' | 'vite';
  };
}

export interface TransformResponse {
  code: string;
  map?: unknown;
  metadata?: Record<string, unknown>;
  dependencies?: string[];
}

export interface NormalizeRequest {
  content: string;
  removeBom?: boolean;
  normalizeLf?: boolean;
}

export interface NormalizeResponse {
  content: string;
  changed: boolean;
}

export interface ComputeDigestRequest {
  files: Array<{
    path: string;
    size: number;
    mtime: number;
  }>;
}

export interface ComputeDigestResponse {
  digest: string;
}

export interface CacheGetRequest {
  key: string;
}

export interface CacheGetResponse {
  found: boolean;
  entry?: {
    code: string;
    map?: unknown;
    metadata?: Record<string, unknown>;
  };
}

export interface CacheSetRequest {
  key: string;
  code: string;
  map?: unknown;
  metadata?: Record<string, unknown>;
}

export interface CacheSetResponse {
  success: boolean;
}

export interface CacheStatsResponse {
  entries: number;
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

export interface ConfigureRequest {
  cacheDir?: string;
  logLevel?: 'silent' | 'info' | 'debug' | 'trace';
  features?: Record<string, boolean>;
}

export interface ConfigureResponse {
  success: boolean;
  applied: Record<string, unknown>;
}
