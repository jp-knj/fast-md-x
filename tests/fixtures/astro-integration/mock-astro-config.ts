import type { AstroConfig } from 'astro';

/**
 * Mock Astro configuration for testing
 */
export function createTestAstroConfig(overrides: Partial<AstroConfig> = {}): AstroConfig {
  return {
    root: new URL('file:///test/project/'),
    srcDir: new URL('file:///test/project/src/'),
    publicDir: new URL('file:///test/project/public/'),
    outDir: new URL('file:///test/project/dist/'),
    cacheDir: new URL('file:///test/project/.cache/'),
    build: {
      format: 'directory',
      client: new URL('file:///test/project/dist/client/'),
      server: new URL('file:///test/project/dist/server/'),
      assets: '_astro',
      serverEntry: 'entry.mjs',
      redirects: true,
      inlineStylesheets: 'auto'
    },
    markdown: {
      remarkPlugins: [],
      rehypePlugins: [],
      shikiConfig: {
        theme: 'github-dark',
        wrap: false
      },
      syntaxHighlight: 'shiki'
    },
    vite: {
      plugins: [],
      optimizeDeps: {
        include: [],
        exclude: []
      },
      ssr: {
        external: [],
        noExternal: []
      }
    },
    integrations: [],
    adapter: undefined,
    output: 'static',
    server: {
      host: false,
      port: 4321
    },
    ...overrides
  } as unknown as AstroConfig;
}

/**
 * Mock custom transformation rules for testing
 */
export const mockCustomRules = [
  {
    name: 'arrow-replacer',
    stage: 'pre' as const,
    priority: 1,
    pattern: /-->/g,
    transform: (content: string) => content.replace(/-->/g, '→')
  },
  {
    name: 'double-arrow-replacer',
    stage: 'pre' as const,
    priority: 1,
    pattern: /==>/g,
    transform: (content: string) => content.replace(/==>/g, '⇨')
  },
  {
    name: 'test-pattern',
    stage: 'post' as const,
    priority: 2,
    pattern: /<test>/g,
    transform: (content: string) => content.replace(/<test>/g, '[TEST]')
  }
];

/**
 * Mock logger for testing
 */
export function createMockLogger() {
  const logs = {
    info: [] as string[],
    warn: [] as string[],
    error: [] as string[],
    debug: [] as string[]
  };

  return {
    info: (message: string) => logs.info.push(message),
    warn: (message: string) => logs.warn.push(message),
    error: (message: string) => logs.error.push(message),
    debug: (message: string) => logs.debug.push(message),
    getLogs: () => logs,
    clearLogs: () => {
      logs.info = [];
      logs.warn = [];
      logs.error = [];
      logs.debug = [];
    }
  };
}
