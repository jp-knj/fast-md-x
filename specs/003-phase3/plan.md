# Plan — Phase 3
- Logging
  - 固定 schema v1 の明記（READMEにサンプル/契約）
  - 追加は後方互換（フィールド追加のみ）
- Bench
  - “changes scenario” を README に常設（コマンド例と解釈ガイド）
- CI 履歴
  - workflow_run で artifact fastmd-ndjson を取得→ summarize → metrics.csv 生成
  - Job Summary へ最新値、artifact に CSV/JSON を添付
- Dev/HMR
  - README/AGENTS に方針記述（observe-only / read-through の選択肢、利点/注意）
  - 実装は Phase 4 へスコープ移送（ADR 記載）

リスク/ロールバック
- CI 時間増 → 解析を 100KB 以内の NDJSON に限定、失敗時はスキップ
