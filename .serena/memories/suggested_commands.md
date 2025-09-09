# Suggested Commands for Fast-MD-X Development

## Development
- `pnpm dev` - Start Astro dev server
- `pnpm build` - Build production site to ./dist/
- `pnpm preview` - Preview build locally

## Testing
- `pnpm test` - Run Bun tests
- `pnpm test:coverage` - Run tests with coverage
- `pnpm test:native` - Run tests with native addon enabled (FASTMD_NATIVE=1)
- `pnpm native:test` - Run Rust/Cargo tests

## Code Quality
- `pnpm check` - Run Biome checks
- `pnpm typecheck` - TypeScript type checking
- `pnpm knip` - Check for unused dependencies

## Native Addon
- `pnpm native:build` - Build Rust native addon with NAPI
- `bash -lc 'cd native/fastmd-native && pnpm --package=@napi-rs/cli@latest dlx napi build --release'` - Full native build command

## Git & GitHub
- `git status` - Check current changes
- `git diff` - View uncommitted changes
- `gh pr create` - Create pull request
- `gh workflow run native-prebuild.yml` - Manually trigger prebuild workflow

## System Utils (macOS/Darwin)
- `ls` - List files
- `find` - Find files
- `grep` / `rg` (ripgrep) - Search in files
- `tar` - Archive files