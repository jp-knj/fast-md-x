---
title: Test Arrow Transform
---

# Arrow Transformation Test

Regular arrows: --> --> -->

In a sentence: Click here --> then go there --> and finally arrive.

## Code blocks should be preserved

```javascript
// Arrows in code should NOT be transformed
const arrow = '-->';
console.log('-->', 'arrow');
```

## Test multiple patterns

- Item 1 --> Item 2
- Item A --> Item B

This --> should --> be --> replaced --> with → symbols.

## Success!

If you see → symbols above instead of -->, the custom rules are working!