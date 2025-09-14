# Astro Integration Tests

## Overview

Comprehensive test suite for the `@fastmd/plugin-transform` Astro Integration. These tests verify that the integration properly hooks into Astro's markdown processing pipeline without testing the actual transformation logic.

## Test Structure

### Integration Tests (`tests/integration/astro-integration.test.ts`)
Main integration tests covering:
- Integration setup and registration
- Configuration hooks (`astro:config:setup`)
- Build lifecycle hooks (`astro:config:done`, `astro:build:start`, `astro:build:done`)
- Server setup hooks (`astro:server:setup`)
- Engine mode configuration (js/native)
- Custom rules configuration

### Unit Tests (`tests/unit/astro-integration-hooks.test.ts`)
Focused unit tests for:
- Individual hook function behaviors
- Options validation and processing
- Logger interactions
- Plugin creation and registration
- Command and restart handling
- Error scenarios

### Test Fixtures (`tests/fixtures/astro-integration/`)
- `sample.md` - Test markdown file with various patterns
- `mock-astro-config.ts` - Mock Astro configuration utilities

## Running Tests

```bash
# Run all Astro Integration tests
bun test tests/integration/astro-integration.test.ts tests/unit/astro-integration-hooks.test.ts

# Run from the plugin package
cd packages/fastmd-plugin-transform
pnpm test

# Run all project tests
bun test
```

## Test Coverage

The tests verify:
✅ Integration properly registers with Astro
✅ Remark plugin is added to markdown pipeline
✅ Vite plugin is registered correctly
✅ Custom transformation rules are passed through
✅ Different engine modes work correctly
✅ Lifecycle hooks execute properly
✅ Configuration merging preserves existing plugins
✅ Logger outputs appropriate messages
✅ Handles various command modes (dev/build)
✅ Gracefully handles missing configurations

## Key Testing Patterns

1. **Mocking Astro APIs**: Tests use mock functions to simulate Astro's integration API
2. **Isolation**: Each test is isolated with its own mock setup
3. **Comprehensive Coverage**: Tests cover happy paths and edge cases
4. **Type Safety**: Tests use TypeScript for type-safe mocking

## Test Results

All 31 tests passing:
- 15 integration tests
- 16 unit tests
- 73 assertions total

## Notes

- Tests focus on the integration itself, not transformation logic
- Uses Bun test framework for consistency with the project
- Follows existing test patterns from the codebase
- Mock implementations avoid external dependencies