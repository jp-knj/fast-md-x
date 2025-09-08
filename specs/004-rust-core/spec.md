# Spec: fast-md-x — Rust Core (Optional, Safe Fallback)

## 概要
- 目的: 変換パイプラインのホットパスを Rust に寄せて将来の最適化余地を確保しつつ、現行 JS 実装を完全互換で残す。
- 方針: N-API 経由（napi-rs）で Node から呼び出す。`FASTMD_NATIVE=1` が有効時のみネイティブを試行。未提供/失敗時は即座に JS フォールバック。

## スコープ（Phase R0）
- 提供関数（最小）
  - `deps_digest(paths: string[]): string` — 依存ファイルの `mtime_ms`/`size` を並列 stat→安定連結→sha256(hex)
- 非対象
  - cache backend（cacache）は JS のまま
  - frontmatter 解析や globs は既存ライブラリを継続

## 互換性
- 既存テストに影響なし（既定は JS 実装）。`FASTMD_NATIVE=1` を付けた CI ジョブでネイティブ経路を別途検証可能。

## リスクと緩和
- ビルド環境差: Prebuild 導入まではリポジトリ内で手動ビルド（将来 actions-rs + prebuild を採用）。
- 失敗時の挙動: try/catch + フラグで確実にフォールバック。

## DoD
- ブリッジ層（JS）実装、環境フラグでの切替、既存テスト green
- 将来: Rust crate 追加後に `deps_digest` を Rust 実装へ差し替え
