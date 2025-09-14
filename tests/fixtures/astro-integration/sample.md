---
title: Test Markdown File
description: This file is used for testing the Astro Integration
---

# Test Markdown Content

This is a test markdown file used for verifying the Astro Integration.

## Test Patterns

Here are some patterns that custom rules might transform:
- Arrow pattern: --> should become →
- Double arrow: ==> should become ⇨
- Custom pattern: <test> for testing

## Code Block (should be preserved)

```javascript
// This should NOT be transformed
const arrow = '-->';
const doubleArrow = '==>';
```

## Lists

1. First item --> next item
2. Second item ==> final item
3. Third item with <test> pattern

## Inline Code

Inline code like `-->` and `==>` should be preserved.

## Conclusion

This file helps verify that:
- Custom transformation rules are applied
- Code blocks are preserved
- The integration properly processes markdown files