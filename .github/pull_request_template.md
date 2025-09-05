## Summary

- What does this PR change? Keep it focused on a single concern.

## TDD Checklist (New Functions Only)

- [ ] Added a failing test first (commit ref: __________)
- [ ] Then added implementation to make it pass (commit ref: __________)
- [ ] Tests live under `tests/` and follow `*.test.ts` naming
- [ ] `pnpm check` passes locally
- [ ] `pnpm test` passes locally

## Scope

- New functions introduced:
  - `module#function`: tested by `tests/<name>.test.ts`
- Existing functions changed? If yes, include regression tests and rationale.

## Test Plan

- Commands run and results (paste outputs or screenshots):
  - `pnpm check`
  - `pnpm test`

## Risks & Rollback

- Breaking changes? Migration steps?
- Rollback plan if issues arise

