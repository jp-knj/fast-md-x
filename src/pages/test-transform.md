---
title: Test Transform Plugin
---

# Test Transform Plugin

This page tests the custom transformation rules.

## Arrow Replacement Test

Here's an arrow that should be replaced: -->

Multiple arrows: --> --> -->

## Custom Rule Test

This content is processed by our custom rules.

## Code Block Test

```javascript
// This arrow should NOT be replaced: -->
const arrow = '-->';
```

## Performance Note

The transform plugin supports:
- **Native mode**: High-performance Rust-based processing
- **JS mode**: Compatible JavaScript processing
- **Custom rules**: Define your own transformations
- **Hooks**: Pre and post-processing hooks

### Current Configuration

- Engine: `{{ engine }}` 
- Native Type: `{{ nativeType }}`
- Custom Rules: Active

Check the console for custom rule and hook logs!