# Spec: Phase 3 — DX/Observability 強化と運用計測
- Owner: knj
- ID: 003-phase3
- Status: Draft
- Last Updated: 2025-09-07

## 1. 背景 / 目的
Phase 2 で NDJSON ログと savedMs を導入し、CI 収集を整備した。Phase 3 では「開発者体験（DX）」と「運用で継続的に効く観測」を強化し、意思決定（しきい値、退行検知）を可能にする。

## 2. 目標 / 非目標
### Goals
- G1: savedMs 集計の安定化（schema v1 固定 & 破壊的変更なし）
- G2: ベンチに “changes scenario” を標準化（HIT/MISS混在の可視化）
- G3: CI に savedMs/hitRate の履歴可視化（週次トレンド）
- G4: dev/HMR 方針の明文化（Phase 3 は方針と下地のみ・大規模実装は次期）

### Non-Goals
- dev サーバの最適化（読み書きキャッシュ実装）本格対応は Phase 4
- Rust/napi 導入

## 3. ユースケース
- PR/デイリーで hitRate と savedMs の推移を見て、効果/退行を判断
- 小さな変更時も “changes scenario” で混在状態の savedMs を把握

## 4. 要件
### FR
- FR1: NDJSON schema v1: {evt, ts, rel?, durationMs?, sizeBytes?, total?, hits?, misses?, hitRate?, p50?, p95?, savedMs?}
- FR2: bench で --changes を標準化（1/N ファイル更新）と savedMs 出力
- FR3: CI で NDJSON を収集→要約→履歴化（CSV/JSON）
- FR4: dev/HMR 方針を README/AGENTS に記述（observe-only / read-through の選択肢）

### NFR
- ログの後方互換性（minor 変更はフィールド追加のみ）
- CI 実行時間の増加は最小限

## 5. 互換性/設定
- Node 22 / Vite 5 / Astro 5 継続
- FASTMD_LOG=json の既定は維持（CI）

## 6. 計測/DoD
- CI の Job Summary に savedMs と hitRate が毎回表示
- metrics.csv に直近 30 run の {runId, savedMs, hitRate, total, date} が蓄積
- “changes scenario” で HIT/MISS 混在が確認できること

## 7. リスク
- ログ肥大 → アーティファクト保持期間/圧縮で対処
- schema 変更 → v1 を固定し追加のみで拡張

## 8. マイルストーン
- M0: spec/plan/tasks 合意
- M1: CI 履歴集計（CSV/JSON）+ README 追記
- M2: bench --changes の標準化（README 追記）
- M3: dev/HMR 方針の文書化と ToR（次期への橋渡し）
