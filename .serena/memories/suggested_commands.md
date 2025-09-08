# Suggested Commands for Development

## Essential Development Commands

### Start Development
- `pnpm dev` or `pnpm start` - Start local dev server at localhost:3000
- `pnpm build` - Build production site to ./dist/
- `pnpm preview` - Preview build locally before deploying

### Code Quality Checks (RUN AFTER COMPLETING TASKS)
- `pnpm check` - Run Biome linter and formatter checks
- `pnpm typecheck` - Run TypeScript type checking (tsc --noEmit)
- `pnpm test` - Run Bun tests
- `pnpm test:coverage` - Run tests with coverage report
- `pnpm knip` - Check for unused exports and dependencies

### Installation & Setup
- `pnpm install` - Install all dependencies

### Astro CLI
- `pnpm astro add` - Add Astro integrations
- `pnpm astro check` - Check Astro project
- `pnpm astro --help` - Get Astro CLI help

### Cache Management
- `rm -rf .cache/fastmd` - Clear the fastmd cache
- Default cache location: `.cache/fastmd` (or via FASTMD_CACHE_DIR env var)

### Spec-kit Workflow
- `scripts/create-new-feature.sh <ID> <slug>` - Create new feature scaffold
  - Example: `scripts/create-new-feature.sh 001 sample`

### Darwin/macOS System Commands
- `ls` - List directory contents
- `find` - Find files and directories
- `grep` or better `rg` (ripgrep) - Search file contents
- `git` - Version control operations
- `cd` - Change directory

## Important Notes
- Always run `pnpm check && pnpm typecheck && pnpm test` after completing development tasks
- The project uses pnpm as the package manager (v10.13.1)
- Tests use Bun's built-in test runner