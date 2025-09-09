# Fast-MD-X Project Overview

## Purpose
Fast-MD-X is an Astro-based static site generator with native Rust addon capabilities for performance optimization. It supports markdown processing with optional native acceleration via NAPI-RS bindings.

## Tech Stack
- **Frontend**: Astro (v5.13.5)
- **Runtime**: Node.js/Bun
- **Native Addon**: Rust with NAPI-RS
- **Package Manager**: pnpm (v10.13.1)
- **Testing**: Bun test runner
- **Code Quality**: Biome, TypeScript, Knip

## Project Structure
- `/src/pages/` - Astro pages
- `/native/fastmd-native/` - Rust native addon
- `/specs/` - Project specifications
- `/tests/` - Test files
- `/.github/workflows/` - GitHub Actions CI/CD

## Native Module
- Package: `@fastmd/native` (workspace package)
- Location: `native/fastmd-native/`
- Built with NAPI-RS for Node.js bindings
- Optional dependency (can run without it)
- Enable with `FASTMD_NATIVE=1` environment variable