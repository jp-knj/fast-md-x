# Codebase Structure

## Root Directory Layout
```
/
├── .github/          # GitHub Actions workflows for CI/CD
├── .serena/          # Serena MCP server files
├── .claude/          # Claude-specific configuration
├── examples/         # Example code and usage
├── memory/           # Memory storage for development context
├── plugins/          # Custom Astro plugins
│   └── fastmd-cache/ # Markdown caching plugin
├── public/           # Static assets served directly
├── scripts/          # Build and utility scripts
├── specs/            # Feature specifications
│   ├── 001-sample/   # Sample spec template
│   └── 002-fastmd-x/ # FastMD-X feature spec
├── src/              # Source code
│   ├── pages/        # Astro pages (routes)
│   │   └── index.astro
│   └── env.d.ts      # TypeScript environment declarations
├── templates/        # Project templates
└── tests/            # Test files (Bun test runner)

## Key Files
- `package.json` - Project dependencies and scripts
- `pnpm-workspace.yaml` - PNPM workspace configuration
- `tsconfig.json` - TypeScript configuration
- `biome.json` - Biome linter/formatter config
- `astro.config.mjs` - Astro configuration
- `knip.json` - Knip unused exports config
- `README.md` - Project documentation
- `AGENTS.md` - Agent/AI assistant documentation
- `fastmd.config.sample.yml` - Sample FastMD configuration
- `fastmd.phase1.spec.yml` - Phase 1 specification

## Plugin Architecture
The main plugin is `plugins/fastmd-cache/index.mjs` which provides:
- Cache management using cacache
- Frontmatter extraction with gray-matter
- Toolchain digest generation
- Performance logging utilities

## Spec-kit Workflow
Each spec in `specs/` contains:
- `spec.md` - Feature specification
- `plan.md` - Implementation plan
- `tasks.md` - Task breakdown