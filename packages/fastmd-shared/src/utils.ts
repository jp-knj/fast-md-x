/**
 * Shared utility functions for FastMD
 */

import type { RpcError, RpcId, RpcRequest, RpcResponse } from './protocol.js';

/**
 * Create an RPC request object
 */
export function createRpcRequest(id: RpcId, method: string, params?: unknown): RpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params
  };
}

/**
 * Create an RPC response object
 */
export function createRpcResponse(id: RpcId, result?: unknown, error?: RpcError): RpcResponse {
  const response: RpcResponse = {
    jsonrpc: '2.0',
    id
  };

  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }

  return response;
}

/**
 * Create an RPC error object
 */
export function createRpcError(code: number, message: string, data?: unknown): RpcError {
  return { code, message, data };
}

/**
 * Parse NDJSON line
 */
export function parseNdjsonLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch (err) {
    throw new Error(`Invalid NDJSON line: ${line}`);
  }
}

/**
 * Stringify to NDJSON line
 */
export function stringifyNdjsonLine(obj: unknown): string {
  return `${JSON.stringify(obj)}\n`;
}

/**
 * Normalize file path for consistent caching
 */
export function normalizePath(path: string): string {
  // Remove Windows drive letter variations
  let normalized = path.replace(/^[A-Z]:\\/, (match) => match.toLowerCase());

  // Convert Windows backslashes to forward slashes
  normalized = normalized.replace(/\\/g, '/');

  // Remove duplicate slashes
  normalized = normalized.replace(/\/+/g, '/');

  // Remove trailing slash unless root
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Simple glob matcher (supports *, **, ?)
 */
export function matchGlob(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
    .replace(/\*\*/g, '.__DOUBLESTAR__.') // Temporarily replace **
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/\?/g, '.') // ? matches single character
    .replace(/\.__DOUBLESTAR__\./g, '.*'); // ** matches anything

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(path);
}

/**
 * Check if path matches any of the glob patterns
 */
export function matchesGlobs(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchGlob(path, pattern));
}

/**
 * Generate a unique request ID
 */
let requestIdCounter = 0;
export function generateRequestId(): string {
  return `req_${Date.now()}_${++requestIdCounter}`;
}

/**
 * Create a deferred promise
 */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject
  };
}
