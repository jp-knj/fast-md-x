# Fast-MD-X Project Overview

## Purpose
Fast-MD-X is an Astro-based static site generator with enhanced Markdown caching capabilities. The project focuses on optimizing build performance through intelligent caching of Markdown content using the cacache library.

## Tech Stack
- **Framework**: Astro 5.13.5 (static site generator)
- **Language**: JavaScript/TypeScript (ES modules)
- **Package Manager**: pnpm 10.13.1
- **Testing**: Bun test runner
- **Code Quality**: Biome (linting/formatting), Knip (unused exports detection)
- **Caching**: cacache library for cache I/O
- **Build**: GitHub Actions for CI/CD and automatic deployment to GitHub Pages

## Key Features
- Markdown content caching plugin (`plugins/fastmd-cache`)
- Spec-kit light for feature development workflow
- Gray-matter for frontmatter parsing
- Find-cache-dir for intelligent cache location resolution

## Environment
- Platform: Darwin (macOS)
- Node environment with ES modules
- TypeScript for type checking (no emit, just validation)