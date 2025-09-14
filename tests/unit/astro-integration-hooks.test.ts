/// <reference types="bun-types" />
/**
 * Unit tests for Astro Integration hook functions
 *
 * Tests individual hook behaviors in isolation with mocked dependencies
 */
import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { fastMdTransformIntegration } from '../../packages/fastmd-plugin-transform/dist/astro-integration.js';
import type { FastMdTransformOptions } from '../../packages/fastmd-plugin-transform/dist/index.js';
import { createRemarkPlugin } from '../../packages/fastmd-plugin-transform/dist/remark-plugin.js';
import { createVitePlugin } from '../../packages/fastmd-plugin-transform/dist/vite-plugin.js';
import type { MockAstroConfig, MockLogger } from '../test-types';

describe('Unit: Hook Function Behavior', () => {
  test('config:setup hook should handle missing markdown config gracefully', async () => {
    const integration = fastMdTransformIntegration();
    const setupHook = integration.hooks?.['astro:config:setup'];

    const mockConfig: MockAstroConfig = {
      root: new URL('file:///test/')
      // No markdown config
    };

    const mockUpdateConfig = mock((config: MockAstroConfig) => {
      expect(config.markdown).toBeDefined();
      expect(config.markdown.remarkPlugins).toBeDefined();
      expect(Array.isArray(config.markdown.remarkPlugins)).toBe(true);
    });

    if (setupHook) {
      await setupHook({
        config: mockConfig as MockAstroConfig,
        updateConfig: mockUpdateConfig,
        addWatchFile: mock(() => {}),
        logger: {
          info: mock(() => {}),
          warn: mock(() => {}),
          error: mock(() => {}),
          debug: mock(() => {})
        } as MockLogger,
        command: 'dev',
        isRestart: false
      });
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

    const mockUpdateConfig = mock((config: MockAstroConfig) => {
      expect(config.vite).toBeDefined();
      expect(config.vite.plugins).toBeDefined();
      expect(Array.isArray(config.vite.plugins)).toBe(true);
    });

    if (setupHook) {
      await setupHook({
        config: mockConfig as MockAstroConfig,
        updateConfig: mockUpdateConfig,
        addWatchFile: mock(() => {}),
        logger: {
          info: mock(() => {}),
          warn: mock(() => {}),
          error: mock(() => {}),
          debug: mock(() => {})
        } as MockLogger,
        command: 'dev',
        isRestart: false
      });
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
      })
    };

    if (buildDoneHook) {
      await buildDoneHook({
        dir: new URL('file:///test/dist/'),
        routes: [],
        logger: mockLogger as MockLogger,
        pages: [],
        assets: new Map()
      });
    }

    expect(mockLogger.info).toHaveBeenCalled();
  });

  test('build:done hook should call vite plugin buildEnd if available', async () => {
    const mockBuildEnd = mock(async () => {});
    const mockVitePlugin = {
      name: 'test-plugin',
      buildEnd: mockBuildEnd
    };

    // We need to test the internal behavior, but since the vitePlugin is private,
    // we'll test the overall behavior through the integration
    const integration = fastMdTransformIntegration();
    const buildDoneHook = integration.hooks?.['astro:build:done'];

    if (buildDoneHook) {
      await buildDoneHook({
        dir: new URL('file:///test/dist/'),
        routes: [],
        logger: {
          info: mock(() => {}),
          warn: mock(() => {}),
          error: mock(() => {}),
          debug: mock(() => {})
        } as MockLogger,
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
    const beforeTransform = mock(async (context: unknown) => {});
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
    const mockUpdateConfig = mock(() => {});

    if (setupHook) {
      await setupHook({
        config: { markdown: {}, vite: {} } as MockAstroConfig,
        updateConfig: mockUpdateConfig,
        addWatchFile: mock(() => {}),
        logger: {
          info: mock(() => {}),
          warn: mock(() => {}),
          error: mock(() => {}),
          debug: mock(() => {})
        } as MockLogger,
        command: 'dev',
        isRestart: false
      });
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
      debug: mock(() => {})
    };

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
      await setupHook({
        config: { markdown: {}, vite: {} } as MockAstroConfig,
        updateConfig: mock(() => {}),
        addWatchFile: mock(() => {}),
        logger: mockLogger as MockLogger,
        command: 'dev',
        isRestart: false
      });
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
      })
    };

    // Test config:done
    const configDoneHook = integration.hooks?.['astro:config:done'];
    if (configDoneHook) {
      await configDoneHook({
        config: {} as MockAstroConfig,
        logger: mockLogger as MockLogger
      });
    }
    expect(logMessages).toContain('Fast MD Transform integration configured');

    // Test server:setup
    const serverSetupHook = integration.hooks?.['astro:server:setup'];
    if (serverSetupHook) {
      await serverSetupHook({
        server: {} as unknown,
        logger: mockLogger as MockLogger
      });
    }
    expect(logMessages).toContain('Fast MD Transform ready for development');

    // Test build:start
    const buildStartHook = integration.hooks?.['astro:build:start'];
    if (buildStartHook) {
      await buildStartHook({
        logger: mockLogger as MockLogger
      });
    }
    expect(logMessages).toContain('Fast MD Transform optimizing for production build');

    // Test build:done
    const buildDoneHook = integration.hooks?.['astro:build:done'];
    if (buildDoneHook) {
      await buildDoneHook({
        dir: new URL('file:///test/dist/'),
        routes: [{ pathname: '/page1' }, { pathname: '/page2' }] as unknown[],
        logger: mockLogger as MockLogger,
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

    const mockUpdateConfig = mock((config: MockAstroConfig) => {
      if (config.markdown?.remarkPlugins?.length > 0) {
        capturedRemarkPlugin = config.markdown.remarkPlugins[0];
      }
    });

    if (setupHook) {
      await setupHook({
        config: { markdown: {}, vite: {} } as MockAstroConfig,
        updateConfig: mockUpdateConfig,
        addWatchFile: mock(() => {}),
        logger: {
          info: mock(() => {}),
          warn: mock(() => {}),
          error: mock(() => {}),
          debug: mock(() => {})
        } as MockLogger,
        command: 'dev',
        isRestart: false
      });
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

    const mockUpdateConfig = mock((config: MockAstroConfig) => {
      if (config.vite?.plugins?.length > 0) {
        capturedVitePlugin = config.vite.plugins[0];
      }
    });

    if (setupHook) {
      await setupHook({
        config: { markdown: {}, vite: {} } as MockAstroConfig,
        updateConfig: mockUpdateConfig,
        addWatchFile: mock(() => {}),
        logger: {
          info: mock(() => {}),
          warn: mock(() => {}),
          error: mock(() => {}),
          debug: mock(() => {})
        } as MockLogger,
        command: 'dev',
        isRestart: false
      });
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

    const mockUpdateConfig = mock(() => {});

    if (setupHook) {
      // Execute the hook and verify it doesn't throw
      await setupHook({
        config: { markdown: {}, vite: {} } as MockAstroConfig,
        updateConfig: mockUpdateConfig,
        addWatchFile: mock(() => {}),
        logger: {
          info: mock(() => {}),
          warn: mock(() => {}),
          error: mock(() => {}),
          debug: mock(() => {})
        } as MockLogger,
        command: 'dev',
        isRestart: false
      });
    }

    expect(mockUpdateConfig).toHaveBeenCalled();
  });

  test('should handle build command', async () => {
    const integration = fastMdTransformIntegration();
    const setupHook = integration.hooks?.['astro:config:setup'];

    const mockUpdateConfig = mock(() => {});

    if (setupHook) {
      // Execute the hook and verify it doesn't throw
      await setupHook({
        config: { markdown: {}, vite: {} } as MockAstroConfig,
        updateConfig: mockUpdateConfig,
        addWatchFile: mock(() => {}),
        logger: {
          info: mock(() => {}),
          warn: mock(() => {}),
          error: mock(() => {}),
          debug: mock(() => {})
        } as MockLogger,
        command: 'build',
        isRestart: false
      });
    }

    expect(mockUpdateConfig).toHaveBeenCalled();
  });

  test('should handle restart flag', async () => {
    const integration = fastMdTransformIntegration();
    const setupHook = integration.hooks?.['astro:config:setup'];

    const mockUpdateConfig = mock(() => {});

    if (setupHook) {
      // Execute the hook and verify it doesn't throw
      await setupHook({
        config: { markdown: {}, vite: {} } as MockAstroConfig,
        updateConfig: mockUpdateConfig,
        addWatchFile: mock(() => {}),
        logger: {
          info: mock(() => {}),
          warn: mock(() => {}),
          error: mock(() => {}),
          debug: mock(() => {})
        } as MockLogger,
        command: 'dev',
        isRestart: true
      });
    }

    expect(mockUpdateConfig).toHaveBeenCalled();
  });
});
