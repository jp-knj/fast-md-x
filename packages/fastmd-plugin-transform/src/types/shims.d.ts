// Minimal type shims to keep builds green in CI without extra deps.

// unified is used for Plugin typing only; provide a lightweight alias.
declare module 'unified' {
  export type Plugin<Params extends any[] = any[], Tree = unknown> = (
    ...args: any
  ) => any;
}

// vfile type is used to read path/history/value in tests.
declare module 'vfile' {
  export interface VFile {
    value?: unknown;
    path?: string;
    history?: string[];
    data?: Record<string, any>;
  }
  export { VFile };
  export default VFile;
}

// Local dev WASM loader path; declare as any to avoid compile-time resolution.
declare module '../../../native/fastmd-native/pkg/fastmd_native.js' {
  const mod: any;
  export default mod;
}

declare module '../../../native/fastmd-native/pkg/fastmd_native_bg.wasm' {
  const path: string;
  export default path;
}

// Fallback wildcard for local native dev paths
declare module '../../../native/*' {
  const anyModule: any;
  export default anyModule;
}

// Optional workspace package not always present in CI
declare module '@fastmd/native' {
  const anyModule: any;
  export default anyModule;
}

// Minimal surface for @fastmd/shared used by vite-plugin
declare module '@fastmd/shared' {
  export type RpcId = string | number;
  export interface RpcRequest { id: RpcId; method: string; params?: unknown }
  export interface RpcError { code: number; message: string; data?: unknown }
  export interface RpcResponse { id: RpcId; result?: unknown; error?: RpcError }
  export interface Deferred<T> { promise: Promise<T>; resolve(v: T): void; reject(e: any): void }
  export const RPC_METHODS: { TRANSFORM: string };
  export function createDeferred<T>(): Deferred<T>;
  export function createRpcRequest(id: RpcId, method: string, params?: unknown): RpcRequest;
  export function generateRequestId(): string;
  export interface TransformRequest {
    file: string;
    content: string;
    options?: { mode?: 'development' | 'production'; sourcemap?: boolean; framework?: 'astro' | 'vite' };
  }
  export interface TransformResponse {
    code: string;
    map?: unknown;
    metadata?: Record<string, unknown>;
    dependencies?: string[];
  }
}
