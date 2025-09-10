---
title: Fast MD-X Test Content
description: This markdown file will be transformed by the Rust sidecar
author: Fast MD-X Team
date: 2025-09-10
tags: [rust, performance, markdown]
---

# Fast MD-X Performance Test

This content is being transformed using the **Rust sidecar** via the `?fastmd` import.

## Features Demonstration

### Text Formatting

This paragraph contains **bold text**, *italic text*, and ***bold italic text***. We can also use `inline code` and ~~strikethrough text~~.

### Lists

#### Unordered List
- First item
- Second item
  - Nested item 1
  - Nested item 2
- Third item

#### Ordered List
1. Step one
2. Step two
   1. Sub-step A
   2. Sub-step B
3. Step three

### Code Blocks

```javascript
// JavaScript example with syntax highlighting
function transformMarkdown(content) {
  const start = performance.now();
  const html = rustSidecar.transform(content);
  const duration = performance.now() - start;
  
  console.log(`Transformation took ${duration}ms`);
  return html;
}
```

```rust
// Rust code example
use pulldown_cmark::{html, Parser};

pub fn markdown_to_html(input: &str) -> String {
    let parser = Parser::new(input);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    html_output
}
```

### Tables

| Engine | Performance | Memory Usage | Notes |
|--------|------------|--------------|-------|
| JavaScript | Baseline | 100MB | Default fallback |
| Rust Sidecar | +20-30% | 50MB | Using pulldown-cmark |
| WASM | +10-15% | 75MB | Cross-platform |
| Parallel | +200-300% | 150MB | Multi-core utilization |

### Blockquotes

> "Performance is not just about speed, it's about efficiency and scalability."
> 
> — The Fast MD-X Team

### Links and Images

Check out the [Astro documentation](https://docs.astro.build) for more information.

### Math (if supported)

When $a \ne 0$, there are two solutions to $(ax^2 + bx + c = 0)$.

### Task Lists

- [x] Implement Rust sidecar
- [x] Add NDJSON RPC protocol
- [x] Create opt-in transform
- [ ] Complete parallel processing
- [ ] Add shared memory IPC

---

## Performance Metrics

Current benchmarks show:

1. **Cold build**: Baseline performance
2. **Warm cache**: 3-10x faster
3. **With sidecar**: Additional 20-30% improvement
4. **Parallel mode**: 2-3x faster on multi-core systems

---

*This content was transformed using Fast MD-X with Rust acceleration.*