# Repository Guidelines

These guidelines are specific to this Astro project and its experimental Markdown/MDX cache plugin.

## Project Structure & Module Organization
- `src/pages/`: Astro pages (`.astro`, `.md`, `.mdx`).
- `public/`: Static assets served as‑is.
- `plugins/fastmd-cache/`: Vite plugin (`index.mjs`) implementing whole‑output caching for `.md/.mdx`.
- `astro.config.mjs`: Registers the plugin via `vite.plugins`.
- `fastmd.config.yml` (optional): Plugin config; see `fastmd.config.sample.yml`.
- `.cache/fastmd/`: Cache storage (ignored by Git).
- `.github/workflows/deploy.yml`: GitHub Pages build (Node 22, `pnpm`).

## Build, Test, and Development Commands
- `pnpm install`: Install dependencies (uses `pnpm-lock.yaml`).
- `pnpm dev` / `pnpm start`: Run Astro dev server.
- `pnpm build`: Build to `dist/`.
- `pnpm preview`: Preview the production build.
- `pnpm check`: Biome lint/format checks.
- `bun test` or `pnpm test`: Run tests with Bun’s built‑in runner.
Environment: Node 22 + pnpm for build/dev; Bun 1.1+ for tests. Example: `FASTMD_LOG=verbose pnpm dev` to inspect cache logs.

## Coding Style & Naming Conventions
- **Formatter/Linter**: Biome (`biome.json`). 2‑space indent, single quotes, semicolons, no trailing commas, line width 100. `*.astro` files are ignored by Biome—format them manually or with editor support.
- **Modules**: ESM only (`"type": "module"`); prefer named exports; Node built‑ins via `node:` specifiers.
- **Files/Dirs**: Lowercase with hyphens (e.g., `fastmd-cache`, `site-settings.mjs`).
- **Versions**: Pin exact versions (no `^`/`~`). Update via `pnpm up <pkg>@<x.y.z>` and commit the lockfile.
  - Current key pin: `astro@5.13.5`.

## Testing Guidelines
Primary runner: `bun test` (aliased as `pnpm test`). Types are provided by `bun-types` with a local `tests/env.d.ts` reference.
Suggested patterns:
- Name files `*.test.ts` next to sources or under `tests/`.
- Keep fast unit tests; target >=80% coverage for plugin utilities.
- Watch mode: `bun test --watch`; coverage when added: `bun test --coverage`.
- Lint before pushing: `pnpm check`.
Reference behaviors are documented in `fastmd.phase1.spec.yml`.

## Commit & Pull Request Guidelines
- History shows no strict convention; use Conventional Commits (e.g., `feat(plugin): add cache key digest`).
- PRs should include: concise description, linked issues, reproduction/validation steps, and—when relevant—`FASTMD_LOG=summary` output or screenshots. Mention effects on build time and cache hits.
- Ensure CI passes and no cache artifacts are committed (`.cache/fastmd/`).

## Security & Configuration Tips
- Disable plugin: `FASTMD_DISABLE=1 pnpm dev`.
- Change cache dir: `FASTMD_CACHE_DIR=.cache/fastmd pnpm build`.
- Clear cache locally: `rm -rf .cache/fastmd`.
- Do not store secrets in repo; use GitHub Actions secrets for deploy settings.

## CI Notes
- GitHub Actions caches `.cache/fastmd` using a key from OS + `pnpm-lock.yaml` + optional `fastmd.config.yml`. Warm builds improve cache hit rate and shorten build time.

## Cache Backend
- Backend: cacache only. The old FS layout (`data/`, `meta/`) is removed.
- Default Location: resolved via `find-cache-dir({ name: 'fastmd', create: true })`; falls back to `./.cache/fastmd` if not available. You can override with `FASTMD_CACHE_DIR` or the `cacheDir` option.
- Clear: `rm -rf .cache/fastmd` or programmatically via `clearCache('.cache/fastmd')`.
- Removed keys: `store` option/ENV/YAML (e.g., `FASTMD_STORE`) are not supported; cacache is always used.

## TDD For New Functions
- Policy: From Sep 5, 2025, use test‑driven development only for newly added functions. Existing functions are exempt unless behavior changes (add regression tests).
- Flow:
  - Write a failing test under `tests/` (e.g., `tests/<feature>.test.ts`).
  - Commit tests first, then implement the function, and commit again.
  - Verify locally: `pnpm check` and `pnpm test`.
- PRs: Include both commits and reference them in the PR template checklist.
