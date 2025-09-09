import { defineConfig } from 'astro/config';
import fastmdCache from './packages/fastmd-cache/index.mjs';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: fastmdCache({})
  }
});
