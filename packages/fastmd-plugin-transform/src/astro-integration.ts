import type { AstroConfig, AstroIntegration } from 'astro';
import type { Plugin } from 'vite';
import type { FastMdTransformOptions } from './index';
import { createRemarkPlugin } from './remark-plugin';
import { createVitePlugin } from './vite-plugin';

/**
 * Astro Integration for Fast MD Transform
 * This integration properly hooks into Astro's Markdown processing pipeline
 */
export function fastMdTransformIntegration(options: FastMdTransformOptions = {}): AstroIntegration {
  let config: AstroConfig;
  let vitePlugin: Plugin;

  return {
    name: '@fastmd/plugin-transform',
    hooks: {
      'astro:config:setup': async ({ config: astroConfig, updateConfig, addWatchFile, logger }) => {
        config = astroConfig;

        logger.info('Setting up Fast MD Transform integration');

        // Create the Vite plugin instance
        vitePlugin = createVitePlugin(options);

        // Add our remark plugin to process Markdown
        const remarkPlugin = createRemarkPlugin(options);

        // Update Astro's Markdown configuration
        updateConfig({
          markdown: {
            remarkPlugins: [...(astroConfig.markdown?.remarkPlugins || []), remarkPlugin],
            // Optionally extend with rehype plugins if needed
            rehypePlugins: [...(astroConfig.markdown?.rehypePlugins || [])]
          },
          vite: {
            plugins: [vitePlugin]
          }
        });

        // Log the current configuration
        logger.info(`Engine: ${options.engine || 'js'}`);
        if (options.engine === 'native' || process.env.FASTMD_NATIVE === '1') {
          logger.info(`Native Type: ${options.nativeType || 'wasm'}`);
        }
        if (options.customRules) {
          logger.info(`Custom Rules: ${options.customRules.length} rules configured`);
        }
      },

      'astro:config:done': async ({ config: finalConfig, logger }) => {
        config = finalConfig;
        logger.info('Fast MD Transform integration configured');
      },

      'astro:server:setup': async ({ server, logger }) => {
        logger.info('Fast MD Transform ready for development');
      },

      'astro:build:start': async ({ logger }) => {
        logger.info('Fast MD Transform optimizing for production build');

        // Set production mode for the transform pipeline
        if (vitePlugin && typeof vitePlugin === 'object' && 'buildStart' in vitePlugin) {
          // Production optimizations can be applied here
        }
      },

      'astro:build:done': async ({ logger, dir, routes }) => {
        logger.info(`Fast MD Transform processed ${routes.length} routes`);

        // Cleanup after build
        if (vitePlugin && typeof vitePlugin === 'object' && 'buildEnd' in vitePlugin) {
          const plugin = vitePlugin as Plugin & { buildEnd?: () => Promise<void> };
          await plugin.buildEnd?.();
        }
      }
    }
  };
}

// Default export for easier import
export default fastMdTransformIntegration;
