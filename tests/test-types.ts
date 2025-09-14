/**
 * Type definitions for test mocks to avoid using 'any'
 */

import type { AstroIntegrationLogger } from 'astro';

/**
 * Partial mock implementation of AstroIntegrationLogger for testing
 */
export type MockLogger = Pick<AstroIntegrationLogger, 'info' | 'warn' | 'error' | 'debug'> & {
  options?: (options: unknown) => void;
  label?: (label: string) => void;
  fork?: (label: string) => MockLogger;
};

/**
 * Helper type for mock functions that simplifies typing
 */
export type MockFunction<T = unknown> = T & { mock: { calls: unknown[][] } };

/**
 * Type for mock Astro config used in tests
 */
export interface MockAstroConfig {
  root?: URL;
  srcDir?: URL;
  publicDir?: URL;
  outDir?: URL;
  cacheDir?: URL;
  markdown?: {
    remarkPlugins?: unknown[];
    rehypePlugins?: unknown[];
  };
  vite?: {
    plugins?: unknown[];
  };
}

/**
 * Type for mock update config function
 */
export type MockUpdateConfig = (config: Partial<MockAstroConfig>) => void;
