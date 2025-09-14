---
layout: ../../layouts/DocsLayout.astro
title: API Reference
description: Complete API documentation for Fast MD-X plugins, protocols, and utilities
---

## Cache API

The cache plugin provides programmatic access to cache operations.

### Factory Function

```javascript
import fastmdCache from '@fastmd/cache';

const [prePlugin, postPlugin] = fastmdCache(options);
```

Returns a tuple of Vite plugins:
- `prePlugin`: Handles cache lookups (runs before transformation)
- `postPlugin`: Handles cache writes (runs after transformation)

### Cache Methods

#### `clearCache()`

Clear all cached entries:

```javascript
import { clearCache } from '@fastmd/cache';

// Clear entire cache
await clearCache();

// Clear with custom cache directory
await clearCache({ cacheDir: '.cache/custom' });
```

#### `warmup()`

Pre-populate cache by transforming files:

```javascript
import { warmup } from '@fastmd/cache';

// Warm up specific files
await warmup([
  'src/content/blog/post-1.md',
  'src/content/blog/post-2.md'
], {
  cacheDir: '.cache/fastmd',
  log: 'verbose'
});
```

### Internal APIs

> ⚠️ **Warning:** These are internal APIs and may change between versions.

```javascript
import { __internals } from '@fastmd/cache';

// Content normalization
const normalized = __internals.normalizeContent(content);

// BOM stripping
const clean = __internals.stripBOM(content);

// Newline normalization
const uniform = __internals.normalizeNewlines(content);

// Dependency digest
const digest = await __internals.computeDepsDigest(files);
```

## Transform API

### Transform Plugin

The transform plugin processes Markdown/MDX content with multiple engine options:

```typescript
interface TransformContext {
  filepath: string;
  content: string;
  frontmatter?: Record<string, any>;
  mode?: 'development' | 'production';
  metadata?: Record<string, any>;
}

interface CustomTransformRule {
  name: string;
  pattern?: RegExp | string;
  transform: (content: string, context: TransformContext) => string | Promise<string>;
  priority?: number;
  stage?: 'pre' | 'post';
  enabled?: boolean;
}

interface TransformResponse {
  code: string;
  map?: SourceMap;
  metadata?: {
    frontmatter?: Record<string, any>;
    imports?: string[];
    exports?: string[];
    wordCount?: number;
    headingCount?: number;
  };
  dependencies?: string[];
}
```

### Custom Rules API

#### Built-in Rule Factories

```typescript
import { builtInRules, ruleComposition } from '@fastmd/plugin-transform/transform-pipeline';

// Pattern-based replacement
const emojiRule = builtInRules.patternReplace(
  'emoji',
  /:smile:/g,
  '😀'
);

// Custom function
const customRule = builtInRules.customFunction(
  'custom',
  async (content, context) => {
    // Transform logic
    return modifiedContent;
  }
);

// Chain multiple rules
const chainedRule = ruleComposition.chain(
  'chained',
  [rule1, rule2, rule3]
);

// Conditional execution
const conditionalRule = ruleComposition.conditional(
  'conditional',
  (context) => context.frontmatter?.beta === true,
  betaFeatureRule
);
```

### Transform Pipeline

```typescript
import { TransformPipeline } from '@fastmd/plugin-transform/transform-pipeline';

const pipeline = new TransformPipeline();

// Add rules
pipeline.addRule({
  name: 'my-rule',
  stage: 'pre',
  transform: (content) => content.toUpperCase()
});

// Execute transformation
const result = await pipeline.executeStage(
  content,
  context,
  'pre'
);
```

### Usage Examples

#### With Native Engine (WASM)

```javascript
import fastmdTransform from '@fastmd/plugin-transform';

export default {
  plugins: [
    fastmdTransform({
      engine: 'native',
      nativeType: 'wasm',
      customRules: [
        {
          name: 'github-alerts',
          pattern: /^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gm,
          stage: 'pre',
          transform: (content) => {
            // Convert GitHub-style alerts to HTML
            return content.replace(
              /^> \[!(\w+)\](.*)$/gm,
              '<div class="alert alert-$1">$2</div>'
            );
          }
        }
      ]
    })
  ]
};
```

#### With JS Engine and Processors

```javascript
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export default {
  plugins: [
    fastmdTransform({
      engine: 'js',
      processors: {
        remark: [remarkGfm],
        rehype: [rehypeHighlight]
      },
      hooks: {
        afterTransform: async ({ output, frontmatter }) => {
          if (frontmatter?.layout) {
            return wrapWithLayout(output, frontmatter.layout);
          }
          return output;
        }
      }
    })
  ]
};
```

## RPC Protocol

Fast MD-X uses NDJSON RPC for communication between Node.js and Rust.

### Request Format

```typescript
interface RpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}
```

### Response Format

```typescript
interface RpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}
```

### RPC Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `ping` | None | Health check |
| `transform` | `TransformRequest` | Transform Markdown/MDX |
| `normalize` | `{ content: string }` | Normalize content |
| `computeDigest` | `{ files: FileInfo[] }` | Calculate dependency digest |
| `configure` | `ConfigRequest` | Update configuration |
| `getCacheEntry` | `{ key: string }` | Retrieve cached entry |
| `setCacheEntry` | `CacheEntry` | Store cache entry |
| `shutdown` | None | Graceful shutdown |

### Error Codes

```javascript
const RPC_ERRORS = {
  PARSE_ERROR: -32700,      // Invalid JSON
  INVALID_REQUEST: -32600,  // Invalid request structure
  METHOD_NOT_FOUND: -32601, // Unknown method
  INVALID_PARAMS: -32602,   // Invalid parameters
  INTERNAL_ERROR: -32603,   // Internal error
  
  // Custom errors
  TRANSFORM_ERROR: -32001,  // Transformation failed
  CACHE_ERROR: -32002,      // Cache operation failed
  IO_ERROR: -32003,         // File I/O error
};
```

## Cache Key Composition

The cache key is a SHA-256 hash of:

```javascript
const key = sha256({
  // File content (normalized)
  content: normalizedContent,
  
  // Sorted frontmatter
  frontmatter: sortedFrontmatter,
  
  // File dependencies
  dependencies: depsDigest,
  
  // Toolchain versions
  versions: {
    node: process.version,
    astro: astroVersion,
    fastmd: packageVersion
  },
  
  // Configuration
  config: {
    salt: options.salt,
    mode: buildMode,
    env: relevantEnvVars
  }
});
```

## Utility Functions

### Pattern Matching

```javascript
import { matchesPattern } from '@fastmd/shared';

// Check if file matches patterns
const shouldProcess = matchesPattern(
  '/src/content/blog/post.md',
  ['**/*.md', '**/*.mdx']
);
```

### NDJSON Utilities

```javascript
import { 
  parseNdjsonLine, 
  stringifyNdjsonLine 
} from '@fastmd/shared';

// Parse NDJSON line
const obj = parseNdjsonLine('{"evt":"cache_hit","file":"test.md"}');

// Stringify to NDJSON
const line = stringifyNdjsonLine({ evt: 'cache_miss' });
```

### Deferred Promises

```javascript
import { createDeferred } from '@fastmd/shared';

const deferred = createDeferred();

// Later...
deferred.resolve(result);
// or
deferred.reject(error);

// Wait for result
const value = await deferred.promise;
```

## TypeScript Types

### Import Types

```typescript
import type {
  FastMdTransformOptions,
  FastMdCacheOptions,
  TransformRequest,
  TransformResponse,
  RpcRequest,
  RpcResponse,
  CacheEntry,
  EngineMode
} from '@fastmd/shared';
```

### Plugin Types

```typescript
import type { Plugin } from 'vite';

interface FastMdPlugin extends Plugin {
  name: 'fastmd-cache' | 'fastmd-transform';
  buildStart?: () => Promise<void>;
  transform?: (code: string, id: string) => Promise<TransformResult | null>;
  buildEnd?: () => Promise<void>;
}
```

## Events and Logging

### Log Event Types

```typescript
interface LogEvent {
  evt: 'cache_miss' | 'cache_write' | 'cache_hit' | 'summary';
  ts: string;  // ISO timestamp
  rel?: string; // Relative file path
  durationMs?: number;
  sizeBytes?: number;
}

interface SummaryEvent extends LogEvent {
  evt: 'summary';
  total: number;
  hits: number;
  misses: number;
  hitRate: number;
  p50: number;
  p95: number;
  savedMs: number;
}
```

### Parsing Log Output

```javascript
// Parse NDJSON logs
const logs = [];
process.stdin.on('data', (chunk) => {
  const lines = chunk.toString().split('\n');
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.evt) logs.push(event);
    } catch {}
  }
});

// Analyze performance
const summary = logs.find(e => e.evt === 'summary');
console.log(`Cache hit rate: ${summary.hitRate}%`);
console.log(`Time saved: ${summary.savedMs}ms`);
```

---

> 📚 **Note:** For implementation examples, see the [test files](https://github.com/kenji/fast-md-x/tree/main/tests) in the repository.