# Code Style and Conventions

## Formatting (via Biome)
- **Indentation**: 2 spaces
- **Line width**: 100 characters max
- **Quotes**: Single quotes for JavaScript/TypeScript
- **Semicolons**: Always use semicolons
- **Trailing commas**: None
- **Organize imports**: Enabled

## TypeScript Configuration
- Extends Astro's base tsconfig
- **Strict checks**:
  - `noEmit`: true (TypeScript only for type checking)
  - `allowJs`: true
  - `checkJs`: true
  - `noUnusedLocals`: true
  - `noUnusedParameters`: true
  - `skipLibCheck`: true

## File Structure
- ES modules (type: "module" in package.json)
- `.mjs` extension for plugin files
- `.astro` files for pages and components
- Tests in `tests/` directory with `.ts` extension

## Ignored Paths
- dist/
- node_modules/
- .cache/
- .astro/
- public/
- **/*.astro (for Biome processing)

## Naming Conventions
- Functions: camelCase (e.g., `createState`, `digestJSON`)
- Constants: UPPER_CASE or camelCase depending on context
- Files: kebab-case for directories, camelCase or kebab-case for files