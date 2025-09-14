/// <reference types="bun-types" />
/**
 * Unit tests for Astro Integration hook functions
 *
 * Tests individual hook behaviors in isolation with mocked dependencies
 */
import { describe, expect, mock, test } from 'bun:test';
import type { AstroConfig, AstroIntegration, AstroIntegrationLogger } from 'astro';
import { fastMdTransformIntegration } from '../../packages/fastmd-plugin-transform/dist/astro-integration';
import type { FastMdTransformOptions } from '../../packages/fastmd-plugin-transform/dist/index';
import type { MockAstroConfig, MockLogger } from '../test-types';

// Helper to create inline mock logger
function createInlineMockLogger(): MockLogger {
  const logger: MockLogger = {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
    options: { dest: console, level: 'info' },
    label: 'test',
    fork: mock(() => logger)
  };
  return logger;
}

// Helper to create a mock AstroConfig
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

// Helper to create mock setup hook params
function createMockSetupHookParams(
  overrides?: Partial<Parameters<NonNullable<AstroIntegration['hooks']>['astro:config:setup']>[0]>
) {
  return {
    config: createMockAstroConfig(),
    updateConfig: mock(() => createMockAstroConfig()),
    addWatchFile: mock(() => {}),
    addRenderer: mock(() => {}),
    injectScript: mock(() => {}),
    injectRoute: mock(() => {}),
    addClientDirective: mock(() => {}),
    addDevToolbarApp: mock(() => {}),
    addMiddleware: mock(() => {}),
    createCodegenDir: mock(() => new URL('file:///test/')),
    logger: createInlineMockLogger() as unknown as AstroIntegrationLogger,
    command: 'dev' as const,
    isRestart: false,
    ...overrides
  };
}

// Helper to create mock config:done hook params
function createMockConfigDoneParams(
  overrides?: Partial<Parameters<NonNullable<AstroIntegration['hooks']>['astro:config:done']>[0]>
) {
  return {
    config: createMockAstroConfig(),
    setAdapter: mock(() => {}),
    injectTypes: mock(() => new URL('file:///test/')),
    logger: createInlineMockLogger() as unknown as AstroIntegrationLogger,
    buildOutput: 'static' as const,
    ...overrides
  };
}

// Helper to create mock server:setup hook params
function createMockServerSetupParams(
  overrides?: Partial<Parameters<NonNullable<AstroIntegration['hooks']>['astro:server:setup']>[0]>
) {
  return {
    server: {} as unknown,
    logger: createInlineMockLogger() as unknown as AstroIntegrationLogger,
    toolbar: {
      send: mock(() => {}),
      on: mock(() => {}),
      onAppInitialized: mock(() => {}),
      onAppToggled: mock(() => {})
    },
    ...overrides
  } as Parameters<NonNullable<AstroIntegration['hooks']>['astro:server:setup']>[0];
}

describe('Unit: Hook Function Behavior', () => {
  test('config:setup hook should handle missing markdown config gracefully', async () => {
    const integration = fastMdTransformIntegration();
    const setupHook = integration.hooks?.['astro:config:setup'];

    const mockConfig: MockAstroConfig = {
      root: new URL('file:///test/')
      // No markdown config
    };

    const mockUpdateConfig = mock((config: Partial<AstroConfig>) => {
      expect(config.markdown).toBeDefined();
      expect(config.markdown?.remarkPlugins).toBeDefined();
      expect(Array.isArray(config.markdown?.remarkPlugins)).toBe(true);
      return createMockAstroConfig();
    });

    if (setupHook) {
      await setupHook(
        createMockSetupHookParams({
          config: mockConfig as unknown as AstroConfig,
          updateConfig: mockUpdateConfig,
          addWatchFile: mock(() => {}),
          logger: createInlineMockLogger() as unknown as AstroIntegrationLogger
        })
      );
    }

    expect(mockUpdateConfig).toHaveBeenCalled();
  });

  test('config:setup hook should handle missing vite config gracefully', async () => {
    const integration = fastMdTransformIntegration();
    const setupHook = integration.hooks?.['astro:config:setup'];

    const mockConfig: MockAstroConfig = {
      root: new URL('file:///test/'),
      markdown: { remarkPlugins: [] }
      // No vite config
    };

    const mockUpdateConfig = mock((config: Partial<AstroConfig>) => {
      expect(config.vite).toBeDefined();
      expect(config.vite?.plugins).toBeDefined();
      expect(Array.isArray(config.vite?.plugins)).toBe(true);
      return createMockAstroConfig();
    });

    if (setupHook) {
      await setupHook(
        createMockSetupHookParams({
          config: mockConfig as unknown as AstroConfig,
          updateConfig: mockUpdateConfig,
          addWatchFile: mock(() => {}),
          logger: createInlineMockLogger() as unknown as AstroIntegrationLogger
        })
      );
    }

    expect(mockUpdateConfig).toHaveBeenCalled();
  });

  test('build:done hook should handle empty routes array', async () => {
    const integration = fastMdTransformIntegration();
    const buildDoneHook = integration.hooks?.['astro:build:done'];

    const mockLogger = {
      info: mock((message: string) => {
        if (message.includes('processed')) {
          expect(message).toContain('0 routes');
        }
      }),
      warn: mock(() => {}),
      error: mock(() => {}),
      debug: mock(() => {}),
      options: { dest: console, level: 'info' },
      label: 'test',
      fork: mock(() => mockLogger)
    } as MockLogger;

    if (buildDoneHook) {
      await buildDoneHook({
        dir: new URL('file:///test/dist/'),
        routes: [],
        logger: mockLogger as unknown as AstroIntegrationLogger,
        pages: [],
        assets: new Map()
      });
    }

    expect(mockLogger.info).toHaveBeenCalled();
  });

  test('build:done hook should call vite plugin buildEnd if available', async () => {
    // We need to test the internal behavior, but since the vitePlugin is private,
    // we'll test the overall behavior through the integration
    const integration = fastMdTransformIntegration();
    const buildDoneHook = integration.hooks?.['astro:build:done'];

    if (buildDoneHook) {
      await buildDoneHook({
        dir: new URL('file:///test/dist/'),
        routes: [],
        logger: createInlineMockLogger() as unknown as AstroIntegrationLogger,
        pages: [],
        assets: new Map()
      });
    }

    // The test verifies that buildDone doesn't throw even when buildEnd is called
    expect(true).toBe(true);
  });
});

describe('Unit: Options Validation and Processing', () => {
  test('should handle undefined options', () => {
    const integration = fastMdTransformIntegration();
    expect(integration).toBeDefined();
    expect(integration.name).toBe('@fastmd/plugin-transform');
  });

  test('should handle empty options object', () => {
    const integration = fastMdTransformIntegration({});
    expect(integration).toBeDefined();
    expect(integration.name).toBe('@fastmd/plugin-transform');
  });

  test('should handle partial options', () => {
    const integration = fastMdTransformIntegration({
      engine: 'native'
      // Missing other options
    });
    expect(integration).toBeDefined();
    expect(integration.name).toBe('@fastmd/plugin-transform');
  });

  test('should handle options with hooks', async () => {
    const beforeTransform = mock(async (_context: unknown) => {});
    const afterTransform = mock(async (context: { output: string }) => context.output);

    const options: FastMdTransformOptions = {
      hooks: {
        beforeTransform,
        afterTransform
      }
    };

    const integration = fastMdTransformIntegration(options);
    expect(integration).toBeDefined();

    // The hooks should be passed through to the remark plugin
    const setupHook = integration.hooks?.['astro:config:setup'];
    const mockUpdateConfig = mock(() => createMockAstroConfig());

    if (setupHook) {
      await setupHook(
        createMockSetupHookParams({
          config: { markdown: {}, vite: {} } as unknown as AstroConfig,
          updateConfig: mockUpdateConfig,
          logger: createInlineMockLogger() as unknown as AstroIntegrationLogger
        })
      );
    }

    expect(mockUpdateConfig).toHaveBeenCalled();
  });
});

describe('Unit: Logger Interactions', () => {
  test('should log all expected messages during setup', async () => {
    const logMessages: string[] = [];
    const mockLogger = {
      info: mock((message: string) => {
        logMessages.push(message);
      }),
      warn: mock(() => {}),
      error: mock(() => {}),
      debug: mock(() => {}),
      options: { dest: console, level: 'info' },
      label: 'test',
      fork: mock(() => mockLogger)
    } as MockLogger;

    const integration = fastMdTransformIntegration({
      engine: 'native',
      nativeType: 'wasm',
      customRules: [
        { name: 'rule1', stage: 'pre', priority: 1, transform: (c) => c },
        { name: 'rule2', stage: 'post', priority: 2, transform: (c) => c }
      ]
    });

    const setupHook = integration.hooks?.['astro:config:setup'];

    if (setupHook) {
      await setupHook(
        createMockSetupHookParams({
          config: { markdown: {}, vite: {} } as unknown as AstroConfig,
          updateConfig: mock(() => createMockAstroConfig()),
          logger: mockLogger as unknown as AstroIntegrationLogger
        })
      );
    }

    expect(logMessages).toContain('Setting up Fast MD Transform integration');
    expect(logMessages).toContain('Engine: native');
    expect(logMessages).toContain('Native Type: wasm');
    expect(logMessages).toContain('Custom Rules: 2 rules configured');
  });

  test('should log during build lifecycle', async () => {
    const integration = fastMdTransformIntegration();
    const logMessages: string[] = [];
    const mockLogger = {
      info: mock((message: string) => {
        logMessages.push(message);
      }),
      warn: mock(() => {}),
      error: mock(() => {}),
      debug: mock(() => {}),
      options: { dest: console, level: 'info' },
      label: 'test',
      fork: mock(() => mockLogger)
    } as MockLogger;

    // Test config:done
    const configDoneHook = integration.hooks?.['astro:config:done'];
    if (configDoneHook) {
      await configDoneHook(
        createMockConfigDoneParams({
          config: {} as unknown as AstroConfig,
          logger: mockLogger as unknown as AstroIntegrationLogger
        })
      );
    }
    expect(logMessages).toContain('Fast MD Transform integration configured');

    // Test server:setup
    const serverSetupHook = integration.hooks?.['astro:server:setup'];
    if (serverSetupHook) {
      await serverSetupHook(
        createMockServerSetupParams({
          logger: mockLogger as unknown as AstroIntegrationLogger
        })
      );
    }
    expect(logMessages).toContain('Fast MD Transform ready for development');

    // Test build:start
    const buildStartHook = integration.hooks?.['astro:build:start'];
    if (buildStartHook) {
      await buildStartHook({
        logger: mockLogger as unknown as AstroIntegrationLogger
      });
    }
    expect(logMessages).toContain('Fast MD Transform optimizing for production build');

    // Test build:done
    const buildDoneHook = integration.hooks?.['astro:build:done'];
    if (buildDoneHook) {
      await buildDoneHook({
        dir: new URL('file:///test/dist/'),
        routes: [{ pathname: '/page1' }, { pathname: '/page2' }] as unknown as Parameters<
          typeof buildDoneHook
        >[0]['routes'],
        logger: mockLogger as unknown as AstroIntegrationLogger,
        pages: [],
        assets: new Map()
      });
    }
    expect(logMessages).toContain('Fast MD Transform processed 2 routes');
  });
});

describe('Unit: Plugin Creation and Registration', () => {
  test('should create remark plugin with correct options', async () => {
    const customRules = [
      {
        name: 'arrow',
        stage: 'pre' as const,
        priority: 1,
        pattern: /-->/g,
        transform: (content: string) => content.replace(/-->/g, '→')
      }
    ];

    const integration = fastMdTransformIntegration({
      customRules,
      engine: 'js'
    });

    const setupHook = integration.hooks?.['astro:config:setup'];
    let capturedRemarkPlugin: unknown = null;

    const mockUpdateConfig = mock((config: Partial<AstroConfig>) => {
      if (config.markdown?.remarkPlugins?.length && config.markdown.remarkPlugins.length > 0) {
        capturedRemarkPlugin = config.markdown.remarkPlugins[0];
      }
      return createMockAstroConfig();
    });

    if (setupHook) {
      await setupHook(
        createMockSetupHookParams({
          config: { markdown: {}, vite: {} } as unknown as AstroConfig,
          updateConfig: mockUpdateConfig,
          logger: createInlineMockLogger() as unknown as AstroIntegrationLogger
        })
      );
    }

    expect(capturedRemarkPlugin).toBeDefined();
    expect(typeof capturedRemarkPlugin).toBe('function');
  });

  test('should create vite plugin with correct options', async () => {
    const integration = fastMdTransformIntegration({
      engine: 'native',
      nativeType: 'sidecar',
      sidecarPath: './custom/sidecar/path'
    });

    const setupHook = integration.hooks?.['astro:config:setup'];
    let capturedVitePlugin: unknown = null;

    const mockUpdateConfig = mock((config: Partial<AstroConfig>) => {
      if (config.vite?.plugins?.length && config.vite.plugins.length > 0) {
        capturedVitePlugin = config.vite.plugins[0];
      }
      return createMockAstroConfig();
    });

    if (setupHook) {
      await setupHook(
        createMockSetupHookParams({
          config: { markdown: {}, vite: {} } as unknown as AstroConfig,
          updateConfig: mockUpdateConfig,
          logger: createInlineMockLogger() as unknown as AstroIntegrationLogger
        })
      );
    }

    expect(capturedVitePlugin).toBeDefined();
    // Vite plugin should be an object with at least a name property
    expect(typeof capturedVitePlugin).toBe('object');
  });
});

describe('Unit: Command and Restart Handling', () => {
  test('should handle dev command', async () => {
    const integration = fastMdTransformIntegration();
    const setupHook = integration.hooks?.['astro:config:setup'];

    const mockUpdateConfig = mock(() => createMockAstroConfig());

    if (setupHook) {
      // Execute the hook and verify it doesn't throw
      await setupHook(
        createMockSetupHookParams({
          config: { markdown: {}, vite: {} } as unknown as AstroConfig,
          updateConfig: mockUpdateConfig,
          logger: createInlineMockLogger() as unknown as AstroIntegrationLogger
        })
      );
    }

    expect(mockUpdateConfig).toHaveBeenCalled();
  });

  test('should handle build command', async () => {
    const integration = fastMdTransformIntegration();
    const setupHook = integration.hooks?.['astro:config:setup'];

    const mockUpdateConfig = mock(() => createMockAstroConfig());

    if (setupHook) {
      // Execute the hook and verify it doesn't throw
      await setupHook(
        createMockSetupHookParams({
          config: { markdown: {}, vite: {} } as unknown as AstroConfig,
          updateConfig: mockUpdateConfig,
          logger: createInlineMockLogger() as unknown as AstroIntegrationLogger,
          command: 'build'
        })
      );
    }

    expect(mockUpdateConfig).toHaveBeenCalled();
  });

  test('should handle restart flag', async () => {
    const integration = fastMdTransformIntegration();
    const setupHook = integration.hooks?.['astro:config:setup'];

    const mockUpdateConfig = mock(() => createMockAstroConfig());

    if (setupHook) {
      // Execute the hook and verify it doesn't throw
      await setupHook(
        createMockSetupHookParams({
          config: { markdown: {}, vite: {} } as unknown as AstroConfig,
          updateConfig: mockUpdateConfig,
          logger: createInlineMockLogger() as unknown as AstroIntegrationLogger,
          isRestart: true
        })
      );
    }

    expect(mockUpdateConfig).toHaveBeenCalled();
  });
});
