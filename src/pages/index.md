---
title: Fast MD-X Test
description: Testing Rust sidecar transformation
---

# Fast MD-X with Rust Sidecar

This page is being transformed using the **Rust sidecar** for high-performance Markdown processing.

## Features

- 🚀 10-20% faster MD/MDX transformation
- 🔄 NDJSON RPC protocol for Node.js ↔ Rust communication
- 📦 Graceful fallback to JavaScript
- 💾 Cache layer for 3-10x speedup

## Performance

| Engine | Speed | Notes |
|--------|-------|-------|
| JavaScript | Baseline | Default fallback |
| Rust Sidecar | +10-20% | Using pulldown-cmark |
| WASM | +5-10% | Cross-platform |

## Code Example

```javascript
// Enable Rust sidecar
export FASTMD_RS=sidecar
pnpm build
```

---

*Powered by Fast MD-X*