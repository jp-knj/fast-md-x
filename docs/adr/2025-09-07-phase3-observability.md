# ADR: Phase 3 — DX/Observability 強化

- Status: Accepted (2025-09-07)
- Context: NDJSON ログと savedMs の導入により、継続的な効果計測の基盤が整った。
- Decision:
  - NDJSON schema v1 を固定（フィールド追加は可、破壊的変更なし）
  - CI で fastmd.ndjson を収集し、savedMs/hitRate を Job Summary と metrics.csv に出力
  - Bench に “changes scenario” を標準化し、HIT/MISS 混在時の savedMs を可視化
  - Dev/HMR は observe-only を既定とし、read-through 最適化は Phase 4 の検討事項とする
- Consequences:
  - 監視と退行検知が容易になる（履歴のトレンドで判断可能）
  - 破壊的なログ変更は将来の解析を壊すため禁止（追加のみ）
