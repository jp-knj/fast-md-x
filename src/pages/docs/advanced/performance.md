---
layout: ../../../layouts/DocsLayout.astro
title: Performance Tuning Guide
description: Optimize Fast MD-X for maximum performance in production environments
---

## Performance Overview

Fast MD-X achieves exceptional performance through multiple optimization layers:

1. **Intelligent Caching** - 3-10x speedup on rebuilds
2. **Rust Sidecar** - 10-20% faster transformation
3. **WebAssembly** - 5-10% improvement, cross-platform
4. **Parallel Processing** - Utilize all CPU cores
5. **Smart Invalidation** - Minimal cache misses

## Benchmarking

### Running Benchmarks

Fast MD-X includes comprehensive benchmarking tools:

```bash
# Basic benchmark (10 pages)
pnpm bench:engines

# Heavy content benchmark
pnpm bench:heavy

# Custom benchmark
node bench/run.mjs --engine=sidecar --pages=100 --heavy
```

### Benchmark Results

Recent benchmark on MacBook Pro M1 (10 pages, heavy content):

| Engine | Cold Build | Warm Cache | Improvement |
|--------|------------|------------|-------------|
| JavaScript | 1,245ms | 412ms | Baseline |
| WASM | 1,189ms | 398ms | +5% |
| Rust Sidecar | 1,087ms | 341ms | +15% |
| Sidecar + Cache | 1,087ms | 38ms^[1]^ | **32x** |

^[1]^ Second run with populated cache

### Performance Metrics

```javascript
// NDJSON output for CI integration
{
  "evt": "benchmark",
  "engine": "sidecar",
  "pages": 100,
  "durationMs": 3421.5,
  "throughput": 29.2, // pages/sec
  "cacheHitRate": 0.95,
  "timestamp": "2024-01-15T10:00:00Z"
}
```

## Optimization Strategies

### 1. Cache Optimization

Maximize cache hit rates:

```javascript
fastmdCache({
  // Stable cache keys
  salt: pkg.version,
  
  // Persistent cache location
  cacheDir: '.cache/fastmd',
  
  // Include only content files
  include: ['src/content/**/*.{md,mdx}'],
  
  // Exclude volatile files
  exclude: ['**/*.draft.md']
})
```

### 2. Sidecar Tuning

Optimize Rust sidecar performance:

```bash
# Build with optimizations
cd engines/sidecar
cargo build --release

# Profile-guided optimization
cargo build --release --profile=production

# Link-time optimization
RUSTFLAGS="-C lto=fat" cargo build --release
```

### 3. Parallel Processing

Enable parallel transformation:

```javascript
// Future API (planned)
fastmdTransform({
  engine: 'sidecar',
  parallel: true,
  workers: 4 // or 'auto'
})
```

### 4. Memory Management

Optimize memory usage for large sites:

```javascript
// Limit cache size
fastmdCache({
  maxSize: '500MB', // Future API
  maxAge: '7d',
  compression: true
})
```

## WebAssembly {#wasm}

### WASM Performance

WebAssembly provides portable acceleration:

**Advantages:**
- ✅ No compilation required
- ✅ Works everywhere Node.js runs
- ✅ Single binary for all platforms
- ✅ 5-10% performance improvement

**Trade-offs:**
- ❌ Slower than native Rust sidecar
- ❌ Higher memory overhead
- ❌ Limited parallelism

### Building WASM Module

```bash
# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build WASM module
pnpm native:build

# Test WASM performance
FASTMD_NATIVE=1 pnpm test:native
```

### WASM Optimization

```toml
# native/fastmd-native/Cargo.toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true

[package.metadata.wasm-pack]
wasm-opt = ["-O4", "--enable-simd"]
```

## Production Optimization

### CI/CD Pipeline

Optimize builds in CI:

```yaml
# .github/workflows/build.yml
- name: Restore cache
  uses: actions/cache@v4
  with:
    path: .cache/fastmd
    key: fastmd-${{ hashFiles('pnpm-lock.yaml') }}

- name: Build with sidecar
  run: |
    FASTMD_RS=sidecar \
    FASTMD_LOG=json \
    pnpm build | tee build.log
    
- name: Analyze performance
  run: |
    node scripts/analyze-build.js < build.log
```

### Docker Optimization

```dockerfile
# Multi-stage build for Rust sidecar
FROM rust:1.75 as sidecar-builder
WORKDIR /build
COPY engines/sidecar .
RUN cargo build --release

FROM node:20-slim
COPY --from=sidecar-builder /build/target/release/fastmd-sidecar /usr/local/bin/
ENV FASTMD_RS=sidecar
```

### CDN and Edge

Optimize for edge deployment:

```javascript
// Edge-optimized configuration
export default defineConfig({
  output: 'static',
  build: {
    format: 'file',
    inlineStylesheets: 'auto'
  },
  vite: {
    plugins: [
      fastmdTransform({
        engine: 'wasm', // WASM for edge compatibility
      }),
      ...fastmdCache({
        // Aggressive caching
        salt: process.env.DEPLOY_ID
      })
    ]
  }
});
```

## Monitoring

### Performance Tracking

```javascript
// scripts/track-performance.js
import { parse } from 'ndjson';

process.stdin
  .pipe(parse())
  .on('data', (event) => {
    if (event.evt === 'summary') {
      // Send to monitoring service
      sendMetrics({
        cacheHitRate: event.hitRate,
        p95Duration: event.p95,
        timeSaved: event.savedMs
      });
    }
  });
```

### Debugging Slow Builds

```bash
# Enable trace logging
RUST_LOG=trace FASTMD_LOG=verbose pnpm build

# Profile Node.js
node --inspect-brk node_modules/.bin/astro build

# Analyze cache misses
FASTMD_LOG=json pnpm build | grep cache_miss | jq .rel
```

## Performance Checklist

- [ ] **Enable Rust sidecar** for 10-20% speedup
- [ ] **Configure caching** with appropriate include/exclude
- [ ] **Use production builds** of Rust binaries
- [ ] **Set stable cache keys** using salt
- [ ] **Monitor cache hit rates** in CI
- [ ] **Optimize Markdown content** (avoid huge tables/code blocks)
- [ ] **Use CDN** for static assets
- [ ] **Enable compression** for HTML output
- [ ] **Implement incremental builds** where possible
- [ ] **Profile and optimize** hot paths

## Troubleshooting Performance

### Slow First Build

```bash
# Check if sidecar is starting correctly
FASTMD_LOG=verbose FASTMD_RS=sidecar pnpm build

# Verify binary is optimized
file engines/sidecar/target/release/fastmd-sidecar
```

### Low Cache Hit Rate

```bash
# Analyze cache keys
FASTMD_LOG=json pnpm build | jq '.rel' | sort | uniq -c

# Check for unstable content
git diff --stat
```

### Memory Issues

```bash
# Limit Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" pnpm build

# Clear cache if corrupted
rm -rf .cache/fastmd
```

---

> 🚀 **Pro tip:** Combine all optimization techniques for maximum performance: Rust sidecar + aggressive caching + CDN delivery = **30-50x faster** than baseline!