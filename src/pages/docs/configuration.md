---
layout: ../../layouts/DocsLayout.astro
title: Configuration Guide
description: Complete configuration reference for Fast MD-X plugins and options
---

## Plugin Configuration

Fast MD-X provides two main plugins that work together to optimize your Markdown/MDX pipeline.

### Transform Plugin Options

The transform plugin handles engine selection and Markdown processing:

```typescript
interface FastMdTransformOptions {
  // Transformation engine
  engine?: 'sidecar' | 'wasm' | 'off';
  
  // Path to sidecar binary
  sidecarPath?: string;
  
  // Logging level for sidecar
  logLevel?: 'silent' | 'info' | 'debug' | 'trace';
  
  // Cache directory for sidecar
  cacheDir?: string;
  
  // Include patterns (glob)
  include?: string[];
  
  // Exclude patterns (glob)
  exclude?: string[];
}
```

### Cache Plugin Options

The cache plugin provides persistent caching:

```typescript
interface FastMdCacheOptions {
  // Cache directory location
  cacheDir?: string;
  
  // Logging mode
  log?: 'silent' | 'summary' | 'verbose' | 'json';
  
  // Include/exclude patterns
  include?: string | string[];
  exclude?: string | string[];
  
  // Cache key salt
  salt?: string;
}
```

## Environment Variables

Environment variables override configuration options:

### Engine Selection

```bash
# Use Rust sidecar (fastest)
export FASTMD_RS=sidecar

# Use WebAssembly (portable)
export FASTMD_RS=wasm

# Disable acceleration (JavaScript only)
export FASTMD_RS=off
```

### Logging Configuration

```bash
# Silent mode - no output
export FASTMD_LOG=silent

# Summary mode - basic statistics
export FASTMD_LOG=summary

# Verbose mode - detailed logging
export FASTMD_LOG=verbose

# JSON mode - structured NDJSON output
export FASTMD_LOG=json
```

### Cache Settings

```bash
# Custom cache directory
export FASTMD_CACHE_DIR=/path/to/cache

# Cache invalidation salt
export FASTMD_SALT=v2-breaking-change

# Disable cache
export FASTMD_CACHE_DISABLE=1
```

## Plugin Options

### Include/Exclude Patterns

Control which files are processed:

```javascript
fastmdTransform({
  // Only process MDX files
  include: ['**/*.mdx'],
  
  // Skip draft content
  exclude: ['**/draft/**', '**/_*.md']
})
```

### Custom Sidecar Path

Use a custom-built sidecar binary:

```javascript
fastmdTransform({
  engine: 'sidecar',
  sidecarPath: './bin/fastmd-sidecar',
  logLevel: 'debug'
})
```

## Advanced Configuration

### Multi-Environment Setup

```javascript
// astro.config.mjs
const isDev = process.env.NODE_ENV !== 'production';
const isCI = process.env.CI === 'true';

export default defineConfig({
  vite: {
    plugins: [
      fastmdTransform({
        // Use sidecar in production, off in development
        engine: isDev ? 'off' : 'sidecar',
        
        // Verbose logging in CI
        logLevel: isCI ? 'trace' : 'info'
      }),
      ...fastmdCache({
        // JSON logging in CI
        log: isCI ? 'json' : 'summary',
        
        // Different cache for branches
        salt: process.env.BRANCH_NAME || 'main'
      })
    ]
  }
});
```

### Performance Tuning

```javascript
// Optimized for large sites
fastmdCache({
  // Larger cache for production builds
  cacheDir: '.cache/fastmd-prod',
  
  // Include only content files
  include: ['src/content/**/*.{md,mdx}'],
  
  // Exclude test files
  exclude: ['**/*.test.md', '**/*.spec.mdx'],
  
  // Unique salt per deployment
  salt: process.env.DEPLOY_ID
})
```

### Debugging Issues

Enable detailed logging to troubleshoot:

```bash
# Maximum verbosity
FASTMD_LOG=verbose FASTMD_RS=sidecar pnpm build

# Trace sidecar communication
RUST_LOG=trace FASTMD_RS=sidecar pnpm build

# JSON output for analysis
FASTMD_LOG=json pnpm build 2>&1 | tee build.log
node analyze-logs.js < build.log
```

## Configuration Examples

### Minimal Setup

```javascript
// Simple cache-only configuration
import fastmdCache from '@fastmd/cache';

export default defineConfig({
  vite: {
    plugins: fastmdCache({})
  }
});
```

### Full-Featured Setup

```javascript
// Complete configuration with all features
import fastmdCache from '@fastmd/cache';
import fastmdTransform from '@fastmd/plugin-transform';

export default defineConfig({
  vite: {
    plugins: [
      // Rust sidecar with custom settings
      fastmdTransform({
        engine: process.env.FASTMD_RS || 'sidecar',
        sidecarPath: './engines/sidecar/target/release/fastmd-sidecar',
        logLevel: 'info',
        include: ['**/*.{md,mdx}'],
        exclude: ['**/node_modules/**']
      }),
      
      // Advanced caching configuration
      ...fastmdCache({
        cacheDir: '.cache/fastmd',
        log: process.env.FASTMD_LOG || 'summary',
        salt: `${pkg.version}-${process.env.NODE_ENV}`,
        include: ['src/**/*.{md,mdx}'],
        exclude: ['**/draft/**']
      })
    ]
  }
});
```

## Troubleshooting

### Common Issues

**Sidecar fails to start:**
```bash
# Check binary exists and is executable
ls -la ./engines/sidecar/target/release/fastmd-sidecar
chmod +x ./engines/sidecar/target/release/fastmd-sidecar
```

**Cache not working:**
```bash
# Clear cache and rebuild
rm -rf .cache/fastmd
FASTMD_LOG=verbose pnpm build
```

**Performance regression:**
```bash
# Compare with and without sidecar
time pnpm build
time FASTMD_RS=sidecar pnpm build
```

---

> 💡 **Tip:** Start with the default configuration and adjust based on your project's needs.