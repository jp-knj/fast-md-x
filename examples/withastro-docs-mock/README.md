# withastro/docs (mock) – Benchmarkable Example

This is a lightweight, self-contained Astro project that mimics a docs site with many Markdown pages and optional MDX/remark/rehype plugins. It is wired to use the FastMD cache plugin from this repository via a relative import.

- Local path: `examples/withastro-docs-mock/`
- No extra deps required to run the basic Markdown benchmark (uses this repo’s root deps).
- Optional: add `@astrojs/mdx` and remark/rehype plugins to stress MDX transforms (see notes).

## Quick Start

```
cd examples/withastro-docs-mock
pnpm i   # if you want a fully isolated install; otherwise root deps are used

# Seed 1,000 pages
node scripts/seed-pages.mjs 1000

# Cold build (MISS→WRITE)
FASTMD_LOG=json /usr/bin/time -p pnpm -s build | tee cold.ndjson

# Warm build (HIT)
FASTMD_LOG=json /usr/bin/time -p pnpm -s build | tee warm.ndjson
```

Tips for reproducibility:
- `FASTMD_SALT=$(git rev-parse --short HEAD)` to tag results
- `FASTMD_TRACK=strict|loose` to control dependency sensitivity in keys
- Validate NDJSON lines with `../../schemas/fastmd-log.schema.json`

## MDX & Plugins

This mock enables MDX + popular remark/rehype plugins by default:

- `@astrojs/mdx`, `remark-gfm`, `rehype-slug`, `rehype-autolink-headings`

Install deps (first time only):

```
pnpm -C examples/withastro-docs-mock i
```

Seed MD pages (default) or MDX pages (heavier):

```
node scripts/seed-pages.mjs 1000
MDX=1 node scripts/seed-pages.mjs 1000
```

## Files
- `astro.config.mjs` – wires the plugin from `../../plugins/fastmd-cache/index.mjs`
- `scripts/seed-pages.mjs` – generates many Markdown pages under `src/pages/docs/`
- `scripts/bench.sh` – simple 3-run timing protocol (MISS→HIT)
- `src/pages/` – starter content
