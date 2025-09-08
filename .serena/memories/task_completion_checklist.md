# Task Completion Checklist

## MUST DO After Completing Any Code Task

### 1. Run Code Quality Checks (IN ORDER)
```bash
pnpm check      # Biome linter and formatter
pnpm typecheck  # TypeScript type checking
pnpm test       # Run all tests
```

### 2. Verify All Checks Pass
- ✅ No linting errors from Biome
- ✅ No TypeScript type errors
- ✅ All tests passing

### 3. If Any Check Fails
- Fix the issues immediately
- Re-run all checks until they pass
- Do NOT consider the task complete until all checks pass

### 4. Additional Considerations
- Ensure no console.log statements left in production code (unless intentional)
- Verify imports are organized (Biome handles this)
- Check that new code follows existing patterns in the codebase
- Ensure no unused variables or imports (caught by TypeScript config)

## Important Notes
- The CI/CD pipeline will run these same checks, so they MUST pass locally first
- If unsure about the correct command, ask the user
- Consider writing commands to CLAUDE.md for future reference if they're project-specific