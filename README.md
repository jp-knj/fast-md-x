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

## 🗄️ Cache Backend

- This project uses cacache for all cache I/O. The previous FS layout (`.cache/fastmd/data`, `meta`) has been removed.
- Default location: resolved with `find-cache-dir({ name: 'fastmd', create: true })`; falls back to `./.cache/fastmd` if unavailable. Override with `FASTMD_CACHE_DIR` or `cacheDir` option.
- Clear cache: `rm -rf .cache/fastmd` (or use the exported helper `clearCache('.cache/fastmd')`).
- The `store` option/ENV (`FASTMD_STORE`) and YAML key are no longer supported; cacache is always used.

## Git Hooks

Enable native Git hooks (no extra dependencies):

1. `pnpm run setup:hooks` (sets `core.hooksPath` to `.githooks/` and marks hooks executable)
2. Commit as usual; pre-commit runs:
   - `pnpm check` (Biome lint/format)
   - `pnpm typecheck` (TypeScript, no emit)

To disable later: `git config --unset core.hooksPath`

## Runtime Configuration (ENV-first)

fastmd-cache honors environment variables first, then plugin options (ENV > options). YAML files are not read in Phase 1.

- FASTMD_LOG: controls logging
  - Values: `silent` | `summary` (default) | `verbose`
  - Examples:
    - `FASTMD_LOG=verbose pnpm dev` (detailed HIT/MISS lines)
    - `FASTMD_LOG=silent pnpm build` (no output)
  - Sample:
    - Verbose: `[fastmd] HIT  3ms  docs/intro.md`
    - Summary: `[fastmd] summary total=120 hits=96 misses=24 hitRate=80% p50=5ms p95=28ms`

- FASTMD_SALT: app-specific salt in key derivation
  - Purpose: isolate cache domains across similar repos or CI contexts
  - Default: empty
  - Example: `FASTMD_SALT=docs-site-2025 pnpm build`

- FASTMD_CACHE_DIR: cache location
  - Overrides auto-resolved directory (see “Cache Backend” above)
  - Examples:
    - `FASTMD_CACHE_DIR=.cache/fastmd pnpm dev`
    - `FASTMD_CACHE_DIR=/tmp/fastmd-cache pnpm build`

- FASTMD_DISABLE: disable the plugin (useful for debugging/CI)
  - `FASTMD_DISABLE=1 pnpm dev`

Notes
- Precedence: environment variables override plugin options.
- Supported Node/Vite/Astro: Node 22, Vite 5, Astro 5 (pinned in package.json).

## Spec-kit (light) — 使い方

1. 雛形作成: `scripts/create-new-feature.sh <ID> <slug>` 例: `scripts/create-new-feature.sh 001 sample`
2. 編集: `specs/<ID>-<slug>/{spec.md,plan.md,tasks.md}` を埋め、PR に spec/plan のリンクを追記
3. 実行/検証: `pnpm check && pnpm typecheck && pnpm test` が通ること（CI は既存設定を使用）

## Benchmarking

- Quick benchmark on the minimal example:
  - `pnpm bench` (cold → warm → hit; parses fastmd summary)
- Seed N generated pages into a temporary copy to see clearer speedups:
  - `pnpm bench -- --pages 100`
  - Add heavier content per page: `pnpm bench -- --pages 500 --lines 300`
  - Or specify target/cache: `pnpm bench -- examples/minimal .cache/bench-fastmd --pages 200 --lines 400`
- One-off generation (writes into the given example directory):
  - `node scripts/gen-example-pages.mjs examples/minimal 100 docs 300`
