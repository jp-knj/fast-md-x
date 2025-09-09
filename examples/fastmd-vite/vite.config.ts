import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
// Import the fastmd-cache plugin from the local workspace
import fastmdCache from '../../packages/fastmd-cache/index.mjs';

export default defineConfig({
  plugins: [
    // fastmd-cache returns a tuple of [pre, post] plugins
    ...fastmdCache({
      // Cache configuration
      cacheDir: '.fastmd-cache',

      // Only cache markdown and MDX files
      include: ['**/*.md', '**/*.mdx'],

      // Exclude drafts from caching
      exclude: ['**/draft/**'],

      // Add a custom salt for cache invalidation
      salt: 'v1',

      // Enable debug logging
      debug: true,

      // Log format (json or pretty)
      logFormat: 'pretty',

      // Features to enable
      features: {
        deps: true, // Track file dependencies
        frontmatter: true, // Parse frontmatter
        toolchain: true // Include toolchain version in cache key
      }
    }),

    // Vue plugin for handling .vue files
    vue()
  ],

  // Markdown/MDX transform configuration
  assetsInclude: ['**/*.md', '**/*.mdx']
});
