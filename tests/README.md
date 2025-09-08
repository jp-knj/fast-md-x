# Test Suite Documentation

## Overview

This test suite uses Bun's built-in test runner to validate the FastMD cache plugin functionality. Tests are organized into different categories based on their scope and purpose.

## Directory Structure

```
tests/
├── unit/           # Unit tests for individual functions/modules
├── integration/    # Integration tests for module interactions
├── e2e/            # End-to-end tests for complete workflows
├── benchmarks/     # Performance and benchmark tests
├── fixtures/       # Shared test data and mock files (e.g., md/…)
├── _utils.ts       # Shared test utilities and helpers
├── setup.ts        # Global test setup
├── teardown.ts     # Global test teardown
└── env.d.ts        # TypeScript environment declarations
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
bun test tests/unit/cache-key-generation.test.ts

# Run tests matching a pattern
bun test --filter="cache"
```

## Writing Tests

### Test Naming Conventions

- Test files should end with `.test.ts`
- Use descriptive test names that explain what is being tested
- Group related tests using `describe` blocks
- Use `test` or `it` for individual test cases

### Example Test Structure

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { MarkdownBuilder, createTempDir } from '../_utils';

describe('Feature Name', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await createTempDir();
  });
  
  afterEach(async () => {
    // Cleanup if needed
  });
  
  describe('specific functionality', () => {
    test('should do something specific', () => {
      // Arrange
      const input = new MarkdownBuilder()
        .withFrontmatter({ title: 'Test' })
        .withContent('# Hello')
        .build();
      
      // Act
      const result = processMarkdown(input);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.title).toBe('Test');
    });
  });
});
```

### Test Utilities

Key helpers in `_utils.ts`:

- `callTransform(phase, code, id)`: Safely invoke Vite `transform` hook
- `createTempDir(prefix?)`: Make a unique temp dir under `.cache/`
- `fixture(rel)`: Resolve a file under `tests/fixtures`
- `captureLogs(fn, parseJSON?)`: Capture `console.log` lines during a block

Use these to avoid duplicating temp-dir and path plumbing in tests.

### Test Categories

#### Unit Tests (`tests/unit/`)
- Test individual functions in isolation
- Mock external dependencies
- Focus on edge cases and error conditions
- Should be fast and deterministic

#### Integration Tests (`tests/integration/`)
- Test interactions between modules
- Use real implementations where possible
- Validate data flow between components
- May involve file I/O or cache operations

#### End-to-End Tests (`tests/e2e/`)
- Test complete user workflows
- Simulate real usage scenarios
- Validate the entire plugin lifecycle
- May be slower but provide high confidence

#### Benchmark Tests (`tests/benchmarks/`)
- Measure performance characteristics
- Track performance regressions
- Compare different implementations
- Should be run separately from regular tests

## Best Practices

1. **Keep tests focused**: Each test should verify one specific behavior
2. **Use descriptive names**: Test names should clearly indicate what they test
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Clean up resources**: Always clean up temp files and directories
5. **Avoid test interdependencies**: Tests should be able to run in any order
6. **Use test builders**: Use the provided utilities for consistent test data
7. **Mock external dependencies**: Keep tests isolated and fast
8. **Test edge cases**: Include tests for error conditions and boundaries

## Debugging Failed Tests

1. **Run single test**: Isolate the failing test
   ```bash
   bun test tests/specific-test.test.ts
   ```

2. **Add console.log**: Debug output to understand state
   ```typescript
   console.log('Debug:', variable);
   ```

3. **Use debugger**: Set breakpoints in VS Code
   ```typescript
   debugger; // Pause execution here
   ```

4. **Check test isolation**: Ensure no shared state between tests

5. **Verify async behavior**: Make sure promises are properly awaited

## Coverage Goals

- **Unit tests**: 80%+ coverage
- **Integration tests**: Cover critical paths
- **E2E tests**: Cover main user workflows

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Release tags

The CI pipeline runs:
1. `pnpm check` - Linting and formatting
2. `pnpm typecheck` - TypeScript validation
3. `pnpm test` - All tests

## Common Patterns

### Testing Async Functions
```typescript
test('async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});
```

### Testing Error Conditions
```typescript
test('throws on invalid input', () => {
  expect(() => functionThatThrows()).toThrow('Expected error message');
});
```

### Parameterized Tests
```typescript
test.each([
  ['input1', 'expected1'],
  ['input2', 'expected2'],
])('processes %s correctly', (input, expected) => {
  expect(process(input)).toBe(expected);
});
```

### Snapshot Testing
```typescript
test('generates correct output', () => {
  const output = generateOutput();
  expect(output).toMatchSnapshot();
});
```

## Contributing

When adding new tests:
1. Place them in the appropriate directory
2. Follow the naming conventions
3. Include descriptive comments for complex tests
4. Update this README if adding new patterns or utilities
5. Ensure all tests pass before submitting PR
