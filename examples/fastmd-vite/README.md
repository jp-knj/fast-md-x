# Example: fastmd + Vite

Minimal example configuration illustrating how to enable the FastMD cache plugin in a Vite-powered site (e.g., Astro).

This folder is illustrative; it’s not a runnable project by itself. Copy `vite.config.ts` into your app and adjust the import path to wherever you place the plugin.

## vite.config.ts

```ts
import { defineConfig } from 'vite';
import fastmdCache from '../../plugins/fastmd-cache/index.mjs';

export default defineConfig({
  plugins: fastmdCache({
    include: ['**/*.md', '**/*.mdx'],
    exclude: ['**/draft/**'],
    log: 'summary',
    salt: process.env.FASTMD_SALT
  })
});
```

## Tips

- Use `FASTMD_LOG=json` to emit NDJSON logs for CI collection.
- Use `FASTMD_INCLUDE`/`FASTMD_EXCLUDE` to control cache scope per environment.
- Clear cache with `node -e "import('./plugins/fastmd-cache/index.mjs').then(m=>m.clearCache('.cache/fastmd'))"`.

