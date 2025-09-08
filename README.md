# [Astro](https://astro.build) GitHub Pages Template

## 🤖 Automatic Deployment to GitHub Pages

This minimal Astro project template comes with a [GitHub Action](https://github.com/features/actions) that automatically deploys your site to [GitHub Pages](https://pages.github.com/).

For more information, please see our complete deployment guide—[Deploy your Astro Site to GitHub Pages](https://docs.astro.build/en/guides/deploy/github/).

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                | Action                                           |
| :--------------------- | :----------------------------------------------- |
| `npm install`          | Installs dependencies                            |
| `npm run dev`          | Starts local dev server at `localhost:3000`      |
| `npm run build`        | Build your production site to `./dist/`          |
| `npm run preview`      | Preview your build locally, before deploying     |
| `npm run astro ...`    | Run CLI commands like `astro add`, `astro check` |
| `npm run astro --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## 🧪 Testing

This repo uses Bun’s built-in test runner.

- Install deps: `pnpm install`
- Run tests: `pnpm test` (alias for `bun test`)
- Watch mode: `bun test --watch`
- Coverage (if configured): `bun test --coverage`

Notes:
- Type support for `bun:test` is provided by `bun-types` and a local `tests/env.d.ts` reference.
- The fastmd cache plugin is validated by smoke tests under `tests/`.

## ⚡ FastMD Cache (Vite plugin)

This repo includes a Vite plugin that caches the final JS(+map) generated from Markdown/MDX transforms using a stable cache key.

- Location: `plugins/fastmd-cache/index.mjs`
- Wired by default in `astro.config.mjs` via `vite.plugins`.

### Usage (Astro)

`astro.config.mjs` (already set up here):

```js
import { defineConfig } from 'astro/config';
import fastmdCache from './plugins/fastmd-cache/index.mjs';

export default defineConfig({
  vite: {
    plugins: fastmdCache({
      // Optional
      include: ['**/*.md', '**/*.mdx'],
      exclude: ['**/draft/**'],
      cacheDir: '.cache/fastmd',
      salt: process.env.FASTMD_SALT,
      log: 'summary', // 'silent' | 'summary' | 'verbose' | 'json'
      features: {}
    })
  }
});
```

Notes:
- The cache plugin applies only during build (`apply: 'build'`). Dev/HMR is intentionally disabled for Phase 1.

Keying inputs (stable key):
- Content (BOM stripped, CR/LF normalized) + YAML frontmatter (stable JSON)
- features digest + toolchain digest (node/astro/mdx/remark/rehype versions)
- Path digest (normalized POSIX lowercased relative path)
- Mode (development/production) + Salt

Include/Exclude behavior:
- If `include` is provided, only matching files participate in cache.
- If `exclude` matches, caching is bypassed entirely for that file.
- Globs support `**`, `*`, `?` minimally (internal helper; no extra deps).

Helpers:
- `clearCache(cacheDir: string)` — remove all cached entries
- `warmup(entries: { id, code, js, map? }[], opts?: { cacheDir?, features? })` — pre-populate cache

ENV overrides:
- `FASTMD_DISABLE=1` — disable plugin even if enabled in options
- `FASTMD_LOG=summary|verbose|json|silent`
- `FASTMD_CACHE_DIR=/abs/or/relative/path`
- `FASTMD_INCLUDE=**/*.md,**/*.mdx` (comma-separated)
- `FASTMD_EXCLUDE=**/draft/**`
- `FASTMD_SALT=project-or-build-identifier`

Logging:
- Summary (default): one line per build with totals and percentiles
- JSON (`FASTMD_LOG=json`): NDJSON rows: `cache_miss`, `cache_write`, `cache_hit`, `summary`

JSON schema: see `schemas/fastmd-log.schema.json` and the exported TypeScript union `FastMdLogEvent` in `plugins/fastmd-cache/index.d.ts`.

Example JSON logging:

```bash
FASTMD_LOG=json pnpm build | node -e "process.stdin.on('data',b=>{try{const o=JSON.parse(b);if(o.evt==='summary')console.log(o)}catch{}})"
```

## 🗄️ Cache Backend

- This project uses cacache for all cache I/O. The previous FS layout (`.cache/fastmd/data`, `meta`) has been removed.
- Default location: resolved with `find-cache-dir({ name: 'fastmd', create: true })`; falls back to `./.cache/fastmd` if unavailable. Override with `FASTMD_CACHE_DIR` or `cacheDir` option.
- Clear cache: `rm -rf .cache/fastmd` (or use the exported helper `clearCache('.cache/fastmd')`).
- The `store` option/ENV (`FASTMD_STORE`) and YAML key are no longer supported; cacache is always used.

## 🔬 Bench (3-run protocol)

`scripts/bench.sh` runs a simple MISS→HIT measurement loop. It assumes this repository is already wired with the plugin (it is), but real speedups depend on having many `.md/.mdx` pages in your project.

```bash
./scripts/bench.sh

# optional: JSON logs for post-processing
FASTMD_LOG=json ./scripts/bench.sh | tee bench.ndjson
```

What it does:
- Run #1: clear cache → pnpm build (MISS+WRITE)
- Run #2: pnpm build again (HIT)
- Run #3: touch a sample file (if present) → mixed MISS/HIT

Tips for reproducibility:
- Set `FASTMD_SALT` to identify the dataset (e.g., commit SHA).
- Use `FASTMD_TRACK=strict|loose` to control invalidation sensitivity to toolchain versions.
- Validate JSON logs with `schemas/fastmd-log.schema.json`.
- For deeper measurements, consider `hyperfine` with 3-run x N-reps and parse NDJSON with `jq`.

### Optional Native (Rust) — R0

An optional native path (N-API, Rust via napi-rs) is being introduced behind a flag.

- Enable: set `FASTMD_NATIVE=1` to allow the plugin to try a native module for dependency digesting.
- Fallback: if the native module is not present or fails to load, the JS implementation is used.
- Status: The bridge is present; the native crate will be added in a later step. No behavior change by default.

## Spec-kit (light) — 使い方

1. 雛形作成: `scripts/create-new-feature.sh <ID> <slug>` 例: `scripts/create-new-feature.sh 001 sample`
2. 編集: `specs/<ID>-<slug>/{spec.md,plan.md,tasks.md}` を埋め、PR に spec/plan のリンクを追記
3. 実行/検証: `pnpm check && pnpm typecheck && pnpm test` が通ること（CI は既存設定を使用）
