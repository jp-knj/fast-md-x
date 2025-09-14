// Main exports for @fastmd/plugin-transform

// Re-export transform pipeline utilities
export { TransformPipeline, builtInRules, ruleComposition } from './transform-pipeline';

// Export the Vite plugin
export { createVitePlugin } from './vite-plugin';

// Export the Astro Integration (default)
export { fastMdTransformIntegration, default } from './astro-integration';

// Export the Remark plugin
export { createRemarkPlugin } from './remark-plugin';

// Type definitions
export type EngineMode = 'native' | 'js';
export type NativeType = 'sidecar' | 'wasm';

export interface TransformContext {
  filepath: string;
  content: string;
  frontmatter?: Record<string, unknown>;
  mode?: 'development' | 'production';
  metadata?: Record<string, unknown>;
}

export interface CustomTransformRule {
  name: string;
  pattern?: RegExp | string;
  transform: (content: string, context: TransformContext) => string | Promise<string>;
  priority?: number;
  stage?: 'pre' | 'post';
  enabled?: boolean;
}

export interface TransformHooks {
  beforeTransform?: (context: TransformContext) => void | Promise<void>;
  afterTransform?: (context: TransformContext & { output: string }) => string | Promise<string>;
}

export interface FastMdTransformOptions {
  engine?: EngineMode;
  nativeType?: NativeType; // Type of native engine (default: 'wasm')
  sidecarPath?: string;
  logLevel?: 'silent' | 'info' | 'debug' | 'trace';
  cacheDir?: string;
  include?: string[];
  exclude?: string[];
  customRules?: CustomTransformRule[];
  hooks?: TransformHooks;
  processors?: {
    remark?: unknown[];
    rehype?: unknown[];
  };
}

export interface EngineConfig {
  mode: EngineMode;
  nativeType?: NativeType;
}

// For backward compatibility, export the Vite plugin as fastmdTransform
import { createVitePlugin } from './vite-plugin';
export const fastmdTransform = createVitePlugin;
