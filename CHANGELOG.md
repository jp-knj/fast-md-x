# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **fastmd-cache Plugin**: Full output caching for MD/MDX transformations
  - Disk-persistent cache using `cacache`
  - Smart cache invalidation based on content and dependencies
  - 3-10x faster rebuilds on cache hits
  - Configurable include/exclude patterns
  - Structured logging (JSON/pretty formats)
  - TypeScript type definitions

- **Native Module (WASM)**: Optional WebAssembly acceleration
  - `deps_digest`: Fast file dependency hashing
  - `normalize_content`: BOM removal and newline normalization
  - Cross-platform single binary (no platform-specific builds)
  - Automatic fallback to JavaScript implementation

- **Testing Infrastructure**
  - Comprehensive unit tests for cache behavior
  - Integration tests with Vite
  - Performance benchmarks (JS vs WASM)
  - CI/CD with GitHub Actions

- **Documentation**
  - Example Vite project (`examples/fastmd-vite`)
  - Native build guide for WASM
  - Detailed README with usage examples

### Changed
- Migrated from NAPI to WebAssembly for better portability
- Simplified GitHub Actions workflow (single WASM build vs matrix)
- Updated to use `picomatch` for glob pattern matching

### Fixed
- Windows path normalization issues
- Cache corruption graceful recovery
- Proper handling of missing files in deps digest

## [0.1.0] - 2024-01-15 (Initial Development)

### Added
- Initial project setup with Astro
- Basic MD/MDX transformation pipeline
- Vite plugin architecture
- Test suite foundation

### Technical Details

#### Cache Key Composition
- File content (normalized)
- Frontmatter metadata (sorted)
- File dependencies (imports/includes)
- Toolchain versions (Node, Astro, packages)
- Configuration options (salt, mode)
- Environment variables

#### Performance Metrics
- **Cold build**: Baseline performance
- **Warm cache**: 3-10x faster rebuilds
- **WASM overhead**: 50-60% for small operations
- **Cache hit rate**: Typically >90% in development

#### Compatibility
- Node.js 18+ (recommended 20+)
- Vite 5.0+
- Astro 5.0+
- Windows, macOS, Linux

---

For more details, see the [project documentation](./README.md) and [specifications](./specs/).