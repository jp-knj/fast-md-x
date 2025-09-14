import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { Plugin } from 'vite';
import matter from 'gray-matter';
import {
  type Deferred,
  RPC_METHODS,
  type RpcRequest,
  type RpcResponse,
  type TransformRequest,
  type TransformResponse,
  createDeferred,
  createRpcRequest,
  generateRequestId
} from '@fastmd/shared';
import { loadWasmModule, transformMarkdownWasm, unloadWasmModule, isWasmSupported } from './wasm-loader';
import type { 
  EngineMode, 
  NativeType, 
  FastMdTransformOptions, 
  EngineConfig,
  TransformContext 
} from './index';

class SidecarClient {
  private process: ChildProcess | null = null;
  private pendingRequests = new Map<string, Deferred<unknown>>();
  private options: FastMdTransformOptions;

  constructor(options: FastMdTransformOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    const sidecarPath = this.options.sidecarPath || 'fastmd-sidecar';
    const args: string[] = [];

    if (this.options.logLevel) {
      args.push('--log-level', this.options.logLevel);
    }

    if (this.options.cacheDir) {
      args.push('--cache-dir', this.options.cacheDir);
    }

    this.process = spawn(sidecarPath, args, {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    if (!this.process.stdout || !this.process.stdin) {
      throw new Error('Failed to start sidecar process');
    }

    // Setup readline for NDJSON parsing
    const rl = createInterface({
      input: this.process.stdout,
      crlfDelay: Number.POSITIVE_INFINITY
    });

    rl.on('line', (line) => {
      this.handleResponse(line);
    });

    this.process.on('error', (err) => {
      console.error('Sidecar process error:', err);
      this.cleanup();
    });

    this.process.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.log(`Sidecar process exited with code ${code}`);
      }
      // Don't call cleanup here if we're already shutting down
      if (this.process) {
        this.cleanup();
      }
    });

    // Ping to verify connection
    await this.ping();
  }

  private handleResponse(line: string) {
    try {
      const response: RpcResponse = JSON.parse(line);
      const deferred = this.pendingRequests.get(String(response.id));

      if (deferred) {
        this.pendingRequests.delete(String(response.id));

        if (response.error) {
          deferred.reject(new Error(response.error.message));
        } else {
          deferred.resolve(response.result);
        }
      }
    } catch (err) {
      console.error('Failed to parse sidecar response:', err);
    }
  }

  private async sendRequest(method: string, params?: unknown): Promise<unknown> {
    if (!this.process || !this.process.stdin) {
      throw new Error('Sidecar not running');
    }

    const id = generateRequestId();
    const request = createRpcRequest(id, method, params);
    const deferred = createDeferred<unknown>();

    this.pendingRequests.set(id, deferred);

    const line = `${JSON.stringify(request)}\n`;
    this.process.stdin.write(line);

    // Add timeout
    const timeout = setTimeout(() => {
      this.pendingRequests.delete(id);
      deferred.reject(new Error('Request timeout'));
    }, 5000);

    try {
      const result = await deferred.promise;
      clearTimeout(timeout);
      return result;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  async ping(): Promise<void> {
    await this.sendRequest('ping');
  }

  async transform(file: string, content: string, options?: any): Promise<TransformResponse> {
    const request: TransformRequest = {
      file,
      content,
      options
    };
    return await this.sendRequest(RPC_METHODS.TRANSFORM, request) as TransformResponse;
  }

  async shutdown(): Promise<void> {
    if (this.process) {
      try {
        await this.sendRequest('shutdown');
      } catch (err) {
        // Ignore errors during shutdown
      }
      this.cleanup();
    }
  }

  private cleanup() {
    // Reject all pending requests
    for (const [id, deferred] of this.pendingRequests) {
      deferred.reject(new Error('Sidecar shutting down'));
    }
    this.pendingRequests.clear();

    // Kill process if still running
    if (this.process && !this.process.killed) {
      this.process.kill();
    }

    this.process = null;
  }
}

function getEngineConfig(options: FastMdTransformOptions): EngineConfig {
  // Priority: explicit option > env variable > default
  let mode: EngineMode = 'js';
  let nativeType: NativeType = 'wasm';

  // Check for engine mode
  if (options.engine) {
    mode = options.engine;
  } else if (process.env.FASTMD_NATIVE === '1' || process.env.FASTMD_NATIVE === 'true') {
    mode = 'native';
  } else if (process.env.FASTMD_ENGINE) {
    const envEngine = process.env.FASTMD_ENGINE.toLowerCase();
    if (envEngine === 'native' || envEngine === 'js') {
      mode = envEngine as EngineMode;
    }
  }

  // Check for native type if in native mode
  if (mode === 'native') {
    if (options.nativeType) {
      nativeType = options.nativeType;
    } else if (process.env.FASTMD_NATIVE_TYPE) {
      const envType = process.env.FASTMD_NATIVE_TYPE.toLowerCase();
      if (envType === 'sidecar' || envType === 'wasm') {
        nativeType = envType as NativeType;
      }
    }
  }

  return { mode, nativeType };
}

export function createVitePlugin(options: FastMdTransformOptions = {}): Plugin {
  let client: SidecarClient | null = null;
  let wasmModule: any = null;
  let engineConfig: EngineConfig;

  return {
    name: 'fastmd-transform',
    enforce: 'pre', // Run before Astro's markdown processing

    async buildStart() {
      engineConfig = getEngineConfig(options);
      console.log(`[fastmd-transform] Engine: ${engineConfig.mode}${engineConfig.mode === 'native' ? ` (${engineConfig.nativeType})` : ''}`);

      // Initialize native engine if configured
      if (engineConfig.mode === 'native') {
        if (engineConfig.nativeType === 'sidecar') {
          try {
            client = new SidecarClient(options);
            await client.start();
            console.log('[fastmd-transform] Sidecar started successfully');
          } catch (err) {
            console.warn('[fastmd-transform] Failed to start sidecar, falling back to JS:', err);
            engineConfig.mode = 'js';
            client = null;
          }
        } else if (engineConfig.nativeType === 'wasm') {
          if (!isWasmSupported()) {
            console.warn('[fastmd-transform] WASM not supported in this environment, falling back to JS');
            engineConfig.mode = 'js';
          } else {
            try {
              console.log('[fastmd-transform] Loading WASM module...');
              wasmModule = await loadWasmModule();
              console.log('[fastmd-transform] WASM module loaded successfully');
            } catch (err) {
              console.warn('[fastmd-transform] Failed to load WASM module, falling back to JS:', err);
              engineConfig.mode = 'js';
            }
          }
        }
      }
    },

    async transform(code: string, id: string) {
      // Only process markdown files with ?fastmd query parameter
      const [filepath, query] = id.split('?');

      // Skip if not a markdown file or doesn't have ?fastmd query
      if (!filepath.endsWith('.md') || !query?.includes('fastmd')) {
        return null;
      }

      // Check include/exclude
      if (options.include && !matchesPatterns(filepath, options.include)) {
        return null;
      }

      if (options.exclude && matchesPatterns(filepath, options.exclude)) {
        return null;
      }

      // Parse frontmatter
      const { content, data: frontmatter } = matter(code);
      
      // Create transform context
      const mode = this.meta.watchMode ? 'development' : 'production';
      const context: TransformContext = {
        filepath,
        content,
        frontmatter,
        mode,
        metadata: {}
      };

      // Apply beforeTransform hook
      if (options.hooks?.beforeTransform) {
        await options.hooks.beforeTransform(context);
      }

      // Apply pre-processing custom rules
      let processedContent = content;
      if (options.customRules) {
        const preRules = options.customRules
          .filter(rule => rule.enabled !== false && rule.stage === 'pre')
          .sort((a, b) => (a.priority || 0) - (b.priority || 0));
        
        for (const rule of preRules) {
          try {
            processedContent = await rule.transform(processedContent, context);
          } catch (err) {
            console.warn(`[fastmd-transform] Custom rule '${rule.name}' failed:`, err);
          }
        }
      }

      // Use appropriate engine based on mode
      let html = '';

      if (engineConfig.mode === 'native') {
        if (engineConfig.nativeType === 'sidecar' && client) {
          try {
            const result = await client.transform(filepath, processedContent, {
              mode,
              sourcemap: false,
              framework: 'astro'
            });
            html = result.code;
          } catch (err) {
            console.warn('[fastmd-transform] Sidecar transform failed:', err);
            html = `<p>Error transforming markdown: ${err}</p>`;
          }
        } else if (engineConfig.nativeType === 'wasm' && wasmModule) {
          try {
            // Prepare custom rules for WASM if any
            const wasmRules = options.customRules
              ?.filter(r => r.pattern && typeof r.pattern === 'string')
              .map(r => ({ 
                pattern: r.pattern as string, 
                replacement: 'RULE_OUTPUT' // Simplified for now
              }));

            // Use WASM transform
            const result = await transformMarkdownWasm(processedContent, {
              engine: 'markdown-rs',
              customRules: wasmRules,
              gfm: true,
              tables: true,
              footnotes: true,
              strikethrough: true,
              tasklist: true,
              heading_ids: true
            });
            html = result.html;
          } catch (err) {
            console.warn('[fastmd-transform] WASM transform failed:', err);
            html = `<p>Error transforming markdown: ${err}</p>`;
          }
        } else {
          // Fallback if native engine not available
          html = '<p>Native engine not available, please check configuration</p>';
        }
      } else {
        // JS mode - basic fallback
        html = '<p>JS transform engine (implement with remark/rehype)</p>';
      }

      // Apply post-processing custom rules
      if (options.customRules) {
        const postRules = options.customRules
          .filter(rule => rule.enabled !== false && (!rule.stage || rule.stage === 'post'))
          .sort((a, b) => (a.priority || 0) - (b.priority || 0));
        
        for (const rule of postRules) {
          try {
            html = await rule.transform(html, { ...context, content: html });
          } catch (err) {
            console.warn(`[fastmd-transform] Custom rule '${rule.name}' failed:`, err);
          }
        }
      }

      // Apply afterTransform hook
      if (options.hooks?.afterTransform) {
        html = await options.hooks.afterTransform({ ...context, output: html }) || html;
      }

      // Return ESM module with html and frontmatter exports
      // This is what Astro can import and use
      const moduleCode = `
export const html = ${JSON.stringify(html)};
export const frontmatter = ${JSON.stringify(frontmatter || {})};
export default { html, frontmatter };
`;

      return {
        code: moduleCode,
        map: null
      };
    },

    async buildEnd() {
      if (client) {
        await client.shutdown();
        console.log('[fastmd-transform] Sidecar stopped');
      }
      if (wasmModule) {
        unloadWasmModule();
        console.log('[fastmd-transform] WASM module unloaded');
      }
    }
  };
}

function matchesPatterns(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Simple glob matching (real implementation would use minimatch or similar)
    const regex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(path);
  });
}