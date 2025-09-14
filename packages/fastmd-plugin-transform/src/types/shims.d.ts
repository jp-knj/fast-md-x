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
