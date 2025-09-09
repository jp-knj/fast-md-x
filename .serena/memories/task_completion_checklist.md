# Task Completion Checklist

When completing a task in Fast-MD-X, ensure you:

## 1. Code Quality Checks
- Run `pnpm check` to verify Biome linting passes
- Run `pnpm typecheck` to ensure TypeScript types are correct
- Run `pnpm knip` to check for unused dependencies

## 2. Testing
- Run `pnpm test` to ensure all tests pass
- If native code was modified:
  - Run `pnpm native:test` for Rust tests
  - Run `pnpm test:native` for JS tests with native enabled

## 3. Build Verification
- Run `pnpm build` to ensure the project builds successfully
- For native changes, run `pnpm native:build` to verify compilation

## 4. Documentation
- Update relevant documentation if APIs changed
- Update specs/tasks.md if completing tracked tasks
- Add comments only when explicitly requested

## 5. Git Hygiene
- Stage only necessary files
- Write clear, concise commit messages
- Never commit secrets or API keys