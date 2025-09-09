# fastmd-vite Example

This example demonstrates how to use the **fastmd-cache** plugin with Vite for caching Markdown and MDX transformations.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Clean cache
pnpm clean
```

## 📁 Project Structure

```
examples/fastmd-vite/
├── src/
│   └── content/
│       ├── sample.md    # Regular Markdown example
│       └── demo.mdx     # MDX with React components
├── vite.config.ts       # Vite configuration with fastmd-cache
├── package.json
└── README.md
```

## ⚙️ Configuration

The `vite.config.ts` shows how to configure the fastmd-cache plugin:

```typescript
import fastmdCache from '../../plugins/fastmd-cache/index.mjs';

export default defineConfig({
  plugins: [
    ...fastmdCache({
      cacheDir: '.fastmd-cache',
      include: ['**/*.md', '**/*.mdx'],
      exclude: ['**/draft/**'],
      salt: 'v1',
      debug: true,
      features: {
        deps: true,
        frontmatter: true,
        toolchain: true
      }
    })
  ]
});
```

## 🔥 Performance Benefits

### First Build (Cold Cache)
```bash
$ pnpm build
[fastmd] MISS(new) - src/content/sample.md (12.5ms)
[fastmd] MISS(new) - src/content/demo.mdx (45.3ms)
✓ built in 523ms
```

### Second Build (Warm Cache)
```bash
$ pnpm build
[fastmd] HIT - src/content/sample.md (0.8ms, saved 11.7ms)
[fastmd] HIT - src/content/demo.mdx (1.2ms, saved 44.1ms)
✓ built in 178ms  # 3x faster!
```

## 📊 Cache Metrics

The plugin provides detailed metrics:
- **Hit Rate**: Percentage of successful cache hits
- **Time Saved**: Cumulative time saved by cache hits
- **Cache Size**: Disk space used by cached entries

## 🔧 Environment Variables

Control cache behavior via environment variables:

```bash
# Disable cache
FASTMD_DISABLE=1 pnpm build

# JSON logging
FASTMD_LOG=json pnpm build

# Custom cache directory
FASTMD_CACHE_DIR=/tmp/cache pnpm build

# Add cache salt
FASTMD_SALT=v2 pnpm build
```

## 🧹 Cache Management

```bash
# Clear cache manually
rm -rf .fastmd-cache

# Or use the clean script
pnpm clean
```

## 📝 How It Works

1. **Key Computation**: Generates a stable cache key from:
   - File content (normalized)
   - Frontmatter metadata
   - Dependencies (imports/includes)
   - Configuration options
   - Toolchain versions

2. **Cache Hit**: If key exists in cache:
   - Skip MD/MDX transformation
   - Return cached JS output directly
   - Log metrics (time saved)

3. **Cache Miss**: If key not found:
   - Run normal transformation
   - Store result in cache
   - Log metrics (cache write)

## 🎯 Best Practices

1. **Include/Exclude**: Use globs to control which files are cached
2. **Salt**: Change salt to invalidate entire cache
3. **Debug Mode**: Enable for detailed logging during development
4. **CI/CD**: Share cache between builds for faster CI

## 📚 Learn More

- [Vite Documentation](https://vitejs.dev)
- [MDX Documentation](https://mdxjs.com)
- [Plugin Source](../../plugins/fastmd-cache/)