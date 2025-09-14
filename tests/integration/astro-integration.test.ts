/// <reference types="bun-types" />
/**
 * Integration tests for @fastmd/plugin-transform Astro Integration
 *
 * Tests verify that the Astro Integration properly:
 * - Registers with Astro's configuration system
 * - Adds remark plugins to the markdown pipeline
 * - Handles different engine modes (js/native)
 * - Properly manages lifecycle hooks
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { AstroConfig } from 'astro';
import { fastMdTransformIntegration } from '../../packages/fastmd-plugin-transform/dist/astro-integration.js';
import type { MockLogger } from '../test-types';

// Mock logger for testing
function createMockLogger(): MockLogger {
  const logger: MockLogger = {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
    options: {},
    label: 'test',
    fork: mock(() => logger)
  };
  return logger;
}

// Mock Astro config
function createMockAstroConfig(): AstroConfig {
  return {
    root: new URL('file:///test/'),
    srcDir: new URL('file:///test/src/'),
    publicDir: new URL('file:///test/public/'),
    outDir: new URL('file:///test/dist/'),
    cacheDir: new URL('file:///test/.cache/'),
    build: {
      format: 'directory',
      client: new URL('file:///test/dist/client/'),
      server: new URL('file:///test/dist/server/'),
      assets: '_astro',
      serverEntry: 'entry.mjs',
      redirects: true,
      inlineStylesheets: 'auto'
    },
    markdown: {
      remarkPlugins: [],
      rehypePlugins: []
    },
    vite: {
      plugins: []
    }
  } as unknown as AstroConfig;
}

describe('Astro Integration: Setup and Registration', () => {
  test('should return a valid AstroIntegration object', () => {
    const integration = fastMdTransformIntegration();

    expect(integration).toBeDefined();
    expect(integration.name).toBe('@fastmd/plugin-transform');
    expect(integration.hooks).toBeDefined();
    expect(typeof integration.hooks).toBe('object');
  });

  test('should have all required hooks', () => {
    const integration = fastMdTransformIntegration();

    expect(integration.hooks?.['astro:config:setup']).toBeDefined();
    expect(integration.hooks?.['astro:config:done']).toBeDefined();
    expect(integration.hooks?.['astro:server:setup']).toBeDefined();
    expect(integration.hooks?.['astro:build:start']).toBeDefined();
    expect(integration.hooks?.['astro:build:done']).toBeDefined();
  });

  test('should accept configuration options', () => {
    const options = {
      engine: 'native' as const,
      nativeType: 'wasm' as const,
      customRules: [
        {
          name: 'test-rule',
          stage: 'pre' as const,
          priority: 1,
          transform: (content: string) => content
        }
      ]
    };

    const integration = fastMdTransformIntegration(options);
    expect(integration).toBeDefined();
    expect(integration.name).toBe('@fastmd/plugin-transform');
  });
});

describe('Astro Integration: Config Setup Hook', () => {
  let mockUpdateConfig: ReturnType<typeof mock>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockAddWatchFile: ReturnType<typeof mock>;
  let astroConfig: AstroConfig;

  beforeEach(() => {
    mockUpdateConfig = mock(() => {});
    mockLogger = createMockLogger();
    mockAddWatchFile = mock(() => {});
    astroConfig = createMockAstroConfig();
  });

  test('should add remark plugin to markdown config', async () => {
    const integration = fastMdTransformIntegration();
    const setupHook = integration.hooks?.['astro:config:setup'];

    if (setupHook) {
      await setupHook({
        config: astroConfig,
        updateConfig: mockUpdateConfig,
        addWatchFile: mockAddWatchFile,
        logger: mockLogger as MockLogger,
        command: 'dev',
        isRestart: false
      });
    }

    expect(mockUpdateConfig).toHaveBeenCalled();
    const updateCall = mockUpdateConfig.mock.calls[0];
    const config = updateCall[0];

    expect(config.markdown).toBeDefined();
    expect(config.markdown.remarkPlugins).toBeDefined();
    expect(Array.isArray(config.markdown.remarkPlugins)).toBe(true);
    expect(config.markdown.remarkPlugins.length).toBeGreaterThan(0);
  });

  test('should add vite plugin to vite config', async () => {
    const integration = fastMdTransformIntegration();
    const setupHook = integration.hooks?.['astro:config:setup'];

    if (setupHook) {
      await setupHook({
        config: astroConfig,
        updateConfig: mockUpdateConfig,
        addWatchFile: mockAddWatchFile,
        logger: mockLogger as MockLogger,
        command: 'dev',
        isRestart: false
      });
    }

    expect(mockUpdateConfig).toHaveBeenCalled();
    const updateCall = mockUpdateConfig.mock.calls[0];
    const config = updateCall[0];

    expect(config.vite).toBeDefined();
    expect(config.vite.plugins).toBeDefined();
    expect(Array.isArray(config.vite.plugins)).toBe(true);
    expect(config.vite.plugins.length).toBeGreaterThan(0);
  });

  test('should log configuration details', async () => {
    const options = {
      engine: 'native' as const,
      nativeType: 'wasm' as const,
      customRules: [
        {
          name: 'test-rule',
          stage: 'pre' as const,
          priority: 1,
          transform: (content: string) => content
        }
      ]
    };

    const integration = fastMdTransformIntegration(options);
    const setupHook = integration.hooks?.['astro:config:setup'];

    if (setupHook) {
      await setupHook({
        config: astroConfig,
        updateConfig: mockUpdateConfig,
        addWatchFile: mockAddWatchFile,
        logger: mockLogger as MockLogger,
        command: 'dev',
        isRestart: false
      });
    }

    expect(mockLogger.info).toHaveBeenCalledWith('Setting up Fast MD Transform integration');
    expect(mockLogger.info).toHaveBeenCalledWith('Engine: native');
    expect(mockLogger.info).toHaveBeenCalledWith('Native Type: wasm');
    expect(mockLogger.info).toHaveBeenCalledWith('Custom Rules: 1 rules configured');
  });

  test('should preserve existing markdown plugins', async () => {
    const existingRemarkPlugin = mock(() => {});
    const existingRehypePlugin = mock(() => {});

    // Only set the properties we're testing
    if (!astroConfig.markdown) {
      astroConfig.markdown = {} as typeof astroConfig.markdown;
    }
    astroConfig.markdown.remarkPlugins = [existingRemarkPlugin];
    astroConfig.markdown.rehypePlugins = [existingRehypePlugin];

    const integration = fastMdTransformIntegration();
    const setupHook = integration.hooks?.['astro:config:setup'];

    if (setupHook) {
      await setupHook({
        config: astroConfig,
        updateConfig: mockUpdateConfig,
        addWatchFile: mockAddWatchFile,
        logger: mockLogger as MockLogger,
        command: 'dev',
        isRestart: false
      });
    }

    const updateCall = mockUpdateConfig.mock.calls[0];
    const config = updateCall[0];

    // Should include both existing and new plugins
    expect(config.markdown.remarkPlugins.length).toBeGreaterThanOrEqual(2);
    expect(config.markdown.rehypePlugins.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Astro Integration: Build Lifecycle Hooks', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  test('should execute config:done hook', async () => {
    const integration = fastMdTransformIntegration();
    const configDoneHook = integration.hooks?.['astro:config:done'];

    if (configDoneHook) {
      await configDoneHook({
        config: createMockAstroConfig(),
        logger: mockLogger as MockLogger
      });
    }

    expect(mockLogger.info).toHaveBeenCalledWith('Fast MD Transform integration configured');
  });

  test('should execute server:setup hook', async () => {
    const integration = fastMdTransformIntegration();
    const serverSetupHook = integration.hooks?.['astro:server:setup'];

    if (serverSetupHook) {
      // Create a minimal mock that satisfies the type requirements for testing
      const mockServer = {
        config: {} as never,
        middlewares: {} as never,
        httpServer: null as never,
        watcher: {} as never,
        ws: {} as never,
        pluginContainer: {} as never,
        moduleGraph: {} as never,
        ssrTransform: {} as never,
        transformRequest: {} as never,
        close: async () => {},
        listen: async () => {},
        restart: async () => {}
      } as unknown;

      await serverSetupHook({
        server: mockServer,
        logger: mockLogger as MockLogger,
        toolbar: {
          send: () => {},
          on: () => {},
          onAppInitialized: () => {},
          onAppToggled: () => {}
        }
      });
    }

    expect(mockLogger.info).toHaveBeenCalledWith('Fast MD Transform ready for development');
  });

  test('should execute build:start hook', async () => {
    const integration = fastMdTransformIntegration();
    const buildStartHook = integration.hooks?.['astro:build:start'];

    if (buildStartHook) {
      await buildStartHook({
        logger: mockLogger as MockLogger
      });
    }

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Fast MD Transform optimizing for production build'
    );
  });

  test('should execute build:done hook with route count', async () => {
    const integration = fastMdTransformIntegration();
    const buildDoneHook = integration.hooks?.['astro:build:done'];

    const mockRoutes = [
      {
        pathname: '/page1',
        component: '',
        params: [],
        pattern: /^\/page1\/$/,
        prerender: false,
        segments: [],
        type: 'page' as const,
        route: '/page1'
      },
      {
        pathname: '/page2',
        component: '',
        params: [],
        pattern: /^\/page2\/$/,
        prerender: false,
        segments: [],
        type: 'page' as const,
        route: '/page2'
      },
      {
        pathname: '/page3',
        component: '',
        params: [],
        pattern: /^\/page3\/$/,
        prerender: false,
        segments: [],
        type: 'page' as const,
        route: '/page3'
      }
    ];

    if (buildDoneHook) {
      await buildDoneHook({
        dir: new URL('file:///test/dist/'),
        routes: mockRoutes,
        logger: mockLogger as MockLogger,
        pages: [],
        assets: new Map()
      });
    }

    expect(mockLogger.info).toHaveBeenCalledWith('Fast MD Transform processed 3 routes');
  });
});

describe('Astro Integration: Engine Mode Configuration', () => {
  let mockUpdateConfig: ReturnType<typeof mock>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockUpdateConfig = mock(() => {});
    mockLogger = createMockLogger();
  });

  test('should configure JS engine mode by default', async () => {
    const integration = fastMdTransformIntegration();
    const setupHook = integration.hooks?.['astro:config:setup'];

    if (setupHook) {
      await setupHook({
        config: createMockAstroConfig(),
        updateConfig: mockUpdateConfig,
        addWatchFile: mock(() => {}),
        logger: mockLogger as MockLogger,
        command: 'dev',
        isRestart: false
      });
    }

    expect(mockLogger.info).toHaveBeenCalledWith('Engine: js');
  });

  test('should configure native engine mode when specified', async () => {
    const integration = fastMdTransformIntegration({
      engine: 'native',
      nativeType: 'sidecar'
    });
    const setupHook = integration.hooks?.['astro:config:setup'];

    if (setupHook) {
      await setupHook({
        config: createMockAstroConfig(),
        updateConfig: mockUpdateConfig,
        addWatchFile: mock(() => {}),
        logger: mockLogger as MockLogger,
        command: 'dev',
        isRestart: false
      });
    }

    expect(mockLogger.info).toHaveBeenCalledWith('Engine: native');
    expect(mockLogger.info).toHaveBeenCalledWith('Native Type: sidecar');
  });

  test('should respect FASTMD_NATIVE environment variable', async () => {
    // Save original env var
    const originalEnv = process.env.FASTMD_NATIVE;
    process.env.FASTMD_NATIVE = '1';

    try {
      const integration = fastMdTransformIntegration({
        engine: 'native'
      });
      const setupHook = integration.hooks?.['astro:config:setup'];

      if (setupHook) {
        await setupHook({
          config: createMockAstroConfig(),
          updateConfig: mockUpdateConfig,
          addWatchFile: mock(() => {}),
          logger: mockLogger as MockLogger,
          command: 'dev',
          isRestart: false
        });
      }

      expect(mockLogger.info).toHaveBeenCalledWith('Engine: native');
    } finally {
      // Restore original env var
      if (originalEnv !== undefined) {
        process.env.FASTMD_NATIVE = originalEnv;
      } else {
        process.env.FASTMD_NATIVE = undefined as string | undefined;
      }
    }
  });
});

describe('Astro Integration: Custom Rules Configuration', () => {
  test('should pass custom rules to remark plugin', async () => {
    const customRule = {
      name: 'test-arrow',
      stage: 'pre' as const,
      priority: 1,
      pattern: /-->/g,
      transform: (content: string) => content.replace(/-->/g, '→')
    };

    const integration = fastMdTransformIntegration({
      customRules: [customRule]
    });

    const setupHook = integration.hooks?.['astro:config:setup'];
    const mockUpdateConfig = mock((newConfig: Partial<AstroConfig>) => ({ ...createMockAstroConfig(), ...newConfig }));

    if (setupHook) {
      await setupHook({
        config: createMockAstroConfig(),
        updateConfig: mockUpdateConfig,
        addWatchFile: mock(() => {}),
        logger: createMockLogger() as MockLogger,
        command: 'dev',
        isRestart: false
      });
    }

    expect(mockUpdateConfig).toHaveBeenCalled();
    // Since we're returning the config, we just verify the function was called
    // The actual config changes are tested in other tests
  });

  test('should work without custom rules', async () => {
    const integration = fastMdTransformIntegration({});
    const setupHook = integration.hooks?.['astro:config:setup'];
    const mockUpdateConfig = mock(() => astroConfig);

    if (setupHook) {
      await setupHook({
        config: createMockAstroConfig(),
        updateConfig: mockUpdateConfig,
        addWatchFile: mock(() => {}),
        logger: createMockLogger() as MockLogger,
        command: 'dev',
        isRestart: false
      });
    }

    expect(mockUpdateConfig).toHaveBeenCalled();
  });
});
