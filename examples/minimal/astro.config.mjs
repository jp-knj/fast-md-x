import { defineConfig } from 'astro/config';
import fastmdCache from '../../plugins/fastmd-cache/index.mjs';

export default defineConfig({
  vite: {
    plugins: fastmdCache({ log: 'summary' })
  }
});
