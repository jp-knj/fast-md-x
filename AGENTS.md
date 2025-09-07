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
# [PROJECT_NAME] Constitution
<!-- Example: Spec Constitution, TaskFlow Constitution, etc. -->

## Core Principles

### [PRINCIPLE_1_NAME]
<!-- Example: I. Library-First -->
[PRINCIPLE_1_DESCRIPTION]
<!-- Example: Every feature starts as a standalone library; Libraries must be self-contained, independently testable, documented; Clear purpose required - no organizational-only libraries -->

### [PRINCIPLE_2_NAME]
<!-- Example: II. CLI Interface -->
[PRINCIPLE_2_DESCRIPTION]
<!-- Example: Every library exposes functionality via CLI; Text in/out protocol: stdin/args → stdout, errors → stderr; Support JSON + human-readable formats -->

### [PRINCIPLE_3_NAME]
<!-- Example: III. Test-First (NON-NEGOTIABLE) -->
[PRINCIPLE_3_DESCRIPTION]
<!-- Example: TDD mandatory: Tests written → User approved → Tests fail → Then implement; Red-Green-Refactor cycle strictly enforced -->

### [PRINCIPLE_4_NAME]
<!-- Example: IV. Integration Testing -->
[PRINCIPLE_4_DESCRIPTION]
<!-- Example: Focus areas requiring integration tests: New library contract tests, Contract changes, Inter-service communication, Shared schemas -->

### [PRINCIPLE_5_NAME]
<!-- Example: V. Observability, VI. Versioning & Breaking Changes, VII. Simplicity -->
[PRINCIPLE_5_DESCRIPTION]
<!-- Example: Text I/O ensures debuggability; Structured logging required; Or: MAJOR.MINOR.BUILD format; Or: Start simple, YAGNI principles -->

## [SECTION_2_NAME]
<!-- Example: Additional Constraints, Security Requirements, Performance Standards, etc. -->

[SECTION_2_CONTENT]
<!-- Example: Technology stack requirements, compliance standards, deployment policies, etc. -->

## [SECTION_3_NAME]
<!-- Example: Development Workflow, Review Process, Quality Gates, etc. -->

[SECTION_3_CONTENT]
<!-- Example: Code review requirements, testing gates, deployment approval process, etc. -->

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

[GOVERNANCE_RULES]
<!-- Example: All PRs/reviews must verify compliance; Complexity must be justified; Use [GUIDANCE_FILE] for runtime development guidance -->

**Version**: [CONSTITUTION_VERSION] | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]
<!-- Example: Version: 2.1.1 | Ratified: 2025-06-13 | Last Amended: 2025-07-16 -->