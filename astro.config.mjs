import { defineConfig } from 'astro/config';
import fastmdCache from './packages/fastmd-cache/index.mjs';
import fastMdTransform from './packages/fastmd-plugin-transform/dist/astro-integration.js';
import { builtInRules } from './packages/fastmd-plugin-transform/dist/transform-pipeline.js';

// https://astro.build/config
export default defineConfig({
  integrations: [
    // Fast MD Transform as Astro Integration
    fastMdTransform({
      // Use native mode if FASTMD_NATIVE is set
      engine: process.env.FASTMD_NATIVE === '1' ? 'native' : 'js',
      nativeType: process.env.FASTMD_NATIVE_TYPE || 'wasm',

      // Custom transformation rules (JS execution for now)
      customRules: [
        // Simple arrow replacement rule
        builtInRules.patternReplace('arrow-replacer', /-->/g, '→', { stage: 'pre', priority: 1 }),
        // Double arrow replacement
        builtInRules.patternReplace('double-arrow', /==>/g, '⇨', { stage: 'pre', priority: 1 }),
        // Custom test rule
        {
          name: 'test-custom-rule',
          stage: 'pre',
          priority: 2,
          transform: (content, context) => {
            console.log(`[Custom Rule] Processing: ${context.filepath}`);
            return content;
          }
        }
      ],

      // Hooks for additional processing
      hooks: {
        beforeTransform: async (context) => {
          console.log(`[Hook] Starting transform: ${context.filepath}`);
        },
        afterTransform: async (context) => {
          console.log(`[Hook] Completed transform: ${context.filepath}`);
          return context.output;
        }
      },

      sidecarPath: './engines/sidecar/target/release/fastmd-sidecar',
      logLevel: 'info'
    })
  ],

  vite: {
    plugins: [
      // Cache layer (3-10x speedup on cache hits)
      ...fastmdCache({
        log: process.env.FASTMD_LOG || 'summary'
      })
    ]
  }
});
