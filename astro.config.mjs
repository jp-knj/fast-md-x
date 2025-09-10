import { defineConfig } from 'astro/config';
import fastmdCache from './packages/fastmd-cache/index.mjs';
import fastmdTransform from './packages/fastmd-plugin-transform/dist/index.js';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [
      // Rust sidecar transformation (when FASTMD_RS=sidecar or engine is set)
      fastmdTransform({
        engine: process.env.FASTMD_RS || 'off', // 'sidecar' | 'wasm' | 'off'
        sidecarPath: './engines/sidecar/target/release/fastmd-sidecar',
        logLevel: 'info'
      }),
      // Cache layer (3-10x speedup on cache hits)
      ...fastmdCache({
        log: process.env.FASTMD_LOG || 'summary'
      })
    ]
  }
});
