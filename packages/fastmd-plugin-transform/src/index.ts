import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
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
import type { Plugin } from 'vite';

export type EngineMode = 'sidecar' | 'wasm' | 'off';

export interface FastMdTransformOptions {
  engine?: EngineMode;
  sidecarPath?: string;
  logLevel?: 'silent' | 'info' | 'debug' | 'trace';
  cacheDir?: string;
  include?: string[];
  exclude?: string[];
}

class SidecarClient {
  private process: ChildProcess | null = null;
  private pendingRequests = new Map<string, Deferred<any>>();
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

  private async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.process || !this.process.stdin) {
      throw new Error('Sidecar not running');
    }

    const id = generateRequestId();
    const request = createRpcRequest(id, method, params);
    const deferred = createDeferred<any>();

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
    return await this.sendRequest(RPC_METHODS.TRANSFORM, request);
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

function getEngineMode(options: FastMdTransformOptions): EngineMode {
  // Priority: explicit option > env variable > default
  if (options.engine) {
    return options.engine;
  }

  const envEngine = process.env.FASTMD_RS || process.env.FASTMD_ENGINE;
  if (envEngine) {
    const normalized = envEngine.toLowerCase();
    if (normalized === 'sidecar' || normalized === 'wasm' || normalized === 'off') {
      return normalized as EngineMode;
    }
    console.warn(`[fastmd-transform] Invalid FASTMD_RS value: ${envEngine}, using 'off'`);
  }

  return 'off'; // Default to JS fallback
}

export default function fastmdTransform(options: FastMdTransformOptions = {}): Plugin {
  let client: SidecarClient | null = null;
  let engineMode: EngineMode;

  return {
    name: 'fastmd-transform',

    async buildStart() {
      engineMode = getEngineMode(options);
      console.log(`[fastmd-transform] Engine mode: ${engineMode}`);

      // Start sidecar if configured
      if (engineMode === 'sidecar') {
        try {
          client = new SidecarClient(options);
          await client.start();
          console.log('[fastmd-transform] Sidecar started successfully');
        } catch (err) {
          console.warn('[fastmd-transform] Failed to start sidecar, falling back to JS:', err);
          engineMode = 'off';
          client = null;
        }
      } else if (engineMode === 'wasm') {
        // TODO: Initialize WASM module
        console.log('[fastmd-transform] WASM mode not yet implemented, falling back to JS');
        engineMode = 'off';
      }
    },

    async transform(code: string, id: string) {
      // Only process markdown/mdx files
      if (!id.endsWith('.md') && !id.endsWith('.mdx')) {
        return null;
      }

      // Check include/exclude
      if (options.include && !matchesPatterns(id, options.include)) {
        return null;
      }

      if (options.exclude && matchesPatterns(id, options.exclude)) {
        return null;
      }

      // Use appropriate engine based on mode
      if (engineMode === 'sidecar' && client) {
        try {
          const result = await client.transform(id, code, {
            mode: this.meta.watchMode ? 'development' : 'production',
            sourcemap: true,
            framework: 'vite'
          });

          return {
            code: result.code,
            map: result.map
          };
        } catch (err) {
          console.warn('[fastmd-transform] Sidecar transform failed:', err);
          // Fall through to JS processing
        }
      } else if (engineMode === 'wasm') {
        // TODO: Use WASM transform
        // For now, fall through to JS
      }

      // JS fallback or 'off' mode - let Vite handle it normally
      return null;
    },

    async buildEnd() {
      if (client) {
        await client.shutdown();
        console.log('[fastmd-transform] Sidecar stopped');
      }
    }
  };
}

function matchesPatterns(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Simple glob matching (real implementation would use minimatch or similar)
    const regex = pattern.replace(/\\*/g, '.*').replace(/\\?/g, '.');
    return new RegExp(`^${regex}$`).test(path);
  });
}
