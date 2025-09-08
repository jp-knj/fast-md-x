# Tasks: 002-fastmd-x — Phase 3 (Tests First)

Input: `specs/002-fastmd-x/spec.md`, `specs/002-fastmd-x/plan.md`
Prerequisites: All tests run green at baseline (`pnpm test`).

Format: `[ID] [P?] Description` — [P] = parallel-safe（異なるファイルを編集）

## Phase 3.1: Setup
- [ ] T001 Confirm working branch `002-fastmd-x` and reference spec/plan links in PR
- [ ] T002 [P] Add JSDoc for public API (factory, `clearCache`, `warmup`) in `plugins/fastmd-cache/index.mjs`

## Phase 3.2: Tests First (must fail before 3.3)
- [ ] T101 include/exclude globs are honored
  - File: `tests/include-exclude.test.ts`
  - Cases: `include: "**/*.mdx"` excludes `.md`; `exclude: "**/draft/**"` bypasses cache entirely
- [ ] T102 salt contributes to key (different salts ≠ HIT)
  - File: `tests/salt-keying.test.ts`
- [ ] T103 bundler mode (development/production) contributes to key
  - File: `tests/mode-keying.test.ts`
  - Simulate `configResolved` with different `mode`; ensure HIT 交差しない
- [ ] T104 JSON logging structure is stable (cache_hit/miss/write + summary)
  - File: `tests/log-json.test.ts`
  - Capture `console.log`; assert fields: `evt`, `rel`, `durationMs/sizeBytes` and summary (`total,hits,misses,hitRate,p50,p95,savedMs`)
- [ ] T105 Corrupted cache entry gracefully degrades to MISS (no crash)
  - File: `tests/corrupt-entry.test.ts`
  - Pre-write invalid JSON under cacache for a computed key
- [ ] T106 [P] Windows-like path normalization regression
  - File: `tests/path-windows-regression.test.ts`
  - `C:\\Docs\\A.MD` と `/@fs/C:/Docs/A.MD` が同一 rel に正規化

## Phase 3.3: Core Implementation (ONLY after tests are red)
- [ ] T201 Implement `include`/`exclude` option (globs)
  - File: `plugins/fastmd-cache/index.mjs`
  - Proposal: add `picomatch` for performance/consistency（代替: `minimatch`, 自前実装）。PR で理由・影響・代替案を明記。
- [ ] T202 Add `salt` option + `FASTMD_SALT`（キーへ反映）
- [ ] T203 Inject bundler `mode` into key（`configResolved` から取得）
- [ ] T204 Ensure JSON logs include `sizeBytes`/`durationMs` and summary includes `savedMs`（既存出力のフィールド整合をテストと合わせる）
- [x] T205 Remove unused `persist` option from config merge（混乱回避）
- [ ] T206 Add `plugins/fastmd-cache/index.d.ts` (factory tuple types, `clearCache`, `warmup`)

## Phase 3.4: Integration
- [ ] T301 Update `README.md` with usage: Vite/Astro config, ENV overrides, logging modes, cache ops (`clearCache`, `warmup`)
- [ ] T302 Add `examples/fastmd-vite` (minimal `vite.config.ts` + 2 MD/MDX files)
- [ ] T303 Add `scripts/bench.sh` for MISS→HIT timing（3-run protocol）

## Phase 3.5: Polish
- [ ] T401 [P] Lint/Typecheck gates pass (`pnpm check && pnpm typecheck`)
- [ ] T402 [P] Knip baseline stays green (`pnpm knip`)
- [ ] T403 Changelog entry + DoD mapping（Spec の D1–D4 に対応）
- [ ] T404 [P] CI path with `FASTMD_LOG=json` emits NDJSON parsable lines

## Dependencies
- T201 で `picomatch` を検討（理由: 高速・安定・豊富な glob 機能）。代替は `minimatch` または簡易実装。採否は PR で決定。

## Definition of Done (DoD)
- 新規テスト（T101–T106）が RED→GREEN を経てすべて成功
- include/exclude, salt, mode-in-key, JSON ログ整合、破損時回復、Win パス正規化が実装済み
- README と example で導入手順が再現可能
- ベンチ（サンプル）で HIT がコールド比 ≥3×、コールドオーバーヘッド ≤+3%（目安）
