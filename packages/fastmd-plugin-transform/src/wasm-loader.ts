/**
 * WASM module loader for fastmd-native
 */

interface WasmModule {
  transform_markdown_rs: (input: string, options?: string) => string;
  transform_markdown_pulldown: (input: string, options?: string) => string;
  transform_markdown_comrak: (input: string, options?: string) => string;
  transform_markdown_full: (input: string, rules?: string, options?: string) => string;
  apply_custom_rules: (input: string, rules: string) => string;
  deps_digest: (files: string) => string;
  normalize_content: (input: string) => string;
}

let wasmModule: WasmModule | null = null;
let loadPromise: Promise<WasmModule> | null = null;

/**
 * Load the WASM module asynchronously
 */
export async function loadWasmModule(): Promise<WasmModule> {
  // Return cached module if already loaded
  if (wasmModule) {
    return wasmModule;
  }

  // Return existing load promise if loading is in progress
  if (loadPromise) {
    return loadPromise;
  }

  // Start loading the module
  loadPromise = loadWasmModuleInternal();
  
  try {
    wasmModule = await loadPromise;
    return wasmModule;
  } catch (error) {
    loadPromise = null;
    throw error;
  }
}

/**
 * Internal function to load the WASM module
 */
async function loadWasmModuleInternal(): Promise<WasmModule> {
  try {
    // Try to load from @fastmd/native package first
    const nativeModule = await import('@fastmd/native');
    console.log('[WASM Loader] Loaded from @fastmd/native package');
    return nativeModule as unknown as WasmModule;
  } catch (err) {
    console.warn('[WASM Loader] Failed to load from @fastmd/native:', err);
  }

  // Try to load from relative path (for development)
  try {
    const wasmPath = new URL('../../../native/fastmd-native/pkg/fastmd_native_bg.wasm', import.meta.url);
    const wasmModule = await import('../../../native/fastmd-native/pkg/fastmd_native.js');
    
    // Initialize the WASM module with the binary
    const wasmBinary = await fetch(wasmPath).then(r => r.arrayBuffer());
    if (typeof (wasmModule as any).default === 'function') {
      await (wasmModule as any).default(wasmBinary);
    }
    
    console.log('[WASM Loader] Loaded from local development path');
    return wasmModule as unknown as WasmModule;
  } catch (err) {
    console.warn('[WASM Loader] Failed to load from local path:', err);
  }

  throw new Error('Failed to load WASM module from any source');
}

/**
 * Check if WASM is supported in the current environment
 */
export function isWasmSupported(): boolean {
  try {
    // Check for WebAssembly support
    if (typeof WebAssembly === 'undefined') {
      return false;
    }

    // Check if we can instantiate a simple module
    const bytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    const module = new WebAssembly.Module(bytes);
    const instance = new WebAssembly.Instance(module);
    
    return instance !== null;
  } catch {
    return false;
  }
}

/**
 * Unload the WASM module to free memory
 */
export function unloadWasmModule(): void {
  wasmModule = null;
  loadPromise = null;
}

/**
 * Get the loaded WASM module (throws if not loaded)
 */
export function getWasmModule(): WasmModule {
  if (!wasmModule) {
    throw new Error('WASM module not loaded. Call loadWasmModule() first.');
  }
  return wasmModule;
}

/**
 * Transform markdown using the WASM module
 */
export async function transformMarkdownWasm(
  content: string,
  options?: {
    engine?: 'markdown-rs' | 'pulldown' | 'comrak';
    customRules?: Array<{ pattern: string; replacement: string }>;
    gfm?: boolean;
    tables?: boolean;
    footnotes?: boolean;
    strikethrough?: boolean;
    tasklist?: boolean;
    smart_punctuation?: boolean;
    heading_ids?: boolean;
    xhtml?: boolean;
  }
): Promise<{ html: string; metadata?: any }> {
  const wasm = await loadWasmModule();
  
  const transformOptions = {
    engine: options?.engine || 'markdown-rs',
    gfm: options?.gfm ?? true,
    tables: options?.tables ?? true,
    footnotes: options?.footnotes ?? true,
    strikethrough: options?.strikethrough ?? true,
    tasklist: options?.tasklist ?? true,
    smart_punctuation: options?.smart_punctuation ?? false,
    heading_ids: options?.heading_ids ?? true,
    xhtml: options?.xhtml ?? false,
  };

  let result: string;
  
  if (options?.customRules && options.customRules.length > 0) {
    // Use full pipeline with custom rules
    result = wasm.transform_markdown_full(
      content,
      JSON.stringify(options.customRules),
      JSON.stringify(transformOptions)
    );
  } else {
    // Use specific engine without custom rules
    switch (transformOptions.engine) {
      case 'pulldown':
        result = wasm.transform_markdown_pulldown(content, JSON.stringify(transformOptions));
        break;
      case 'comrak':
        result = wasm.transform_markdown_comrak(content, JSON.stringify(transformOptions));
        break;
      default:
        result = wasm.transform_markdown_rs(content, JSON.stringify(transformOptions));
    }
  }

  try {
    return JSON.parse(result);
  } catch {
    // Fallback if result is not JSON
    return { html: result };
  }
}