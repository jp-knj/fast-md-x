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

## Spec-kit (light) — 使い方

1. 雛形作成: `scripts/create-new-feature.sh <ID> <slug>` 例: `scripts/create-new-feature.sh 001 sample`
2. 編集: `specs/<ID>-<slug>/{spec.md,plan.md,tasks.md}` を埋め、PR に spec/plan のリンクを追記
3. 実行/検証: `pnpm check && pnpm typecheck && pnpm test` が通ること（CI は既存設定を使用）
