# Plan — 002-fastmd-x (Phase 1 / Vite 経由 MVP)

- Architecture & Boundaries
  - Vite プラグインを 2 フェーズで構成: `pre`(transform 観測/キー算出・HIT判定), `post`(MISS 時の書き込み)。
  - 対象拡張子: `.md`, `.mdx` のみ。クエリは落とし、`/@fs/` や絶対/相対を POSIX 正規化。
  - コードは変更しない（transform は基本 `null` を返し、Vite に通常チェーンを実行させる）。成功時の成果物（code/map/meta）を観測・キャッシュ。
  - ログ/メトリクスは NDJSON で出力（level, event, keyHash, relPath, durationMs, sizeBytes, hit/miss）。

- Tech Choices & Rationale
  - キャッシュ: `cacache`（堅牢・整合・クリーンアップ機構）。
  - キー: SHA256(k1..k6) 連結。k1:本文ハッシュ, k2:オプション正規化, k3:ツールチェーン fingerprint（Node, OS, pkg 実解決版, 自身のバージョン）, k4: モード, k5: salt, k6: importer。
  - 正規化: `json-stable-stringify`、パスは POSIX/小文字化で揺れを排除。
  - 依存 fingerprint は初回のみ計算しメモ化、パフォーマンス影響を最小化。

- Alternatives Considered
  - Vite 内部キャッシュの拡張: 内部 API 依存が強く将来不安。
  - FS 直実装: 併用/並行 I/O/掃除のコストが高い。cacache 採用が妥当。

- Risks / Rollback strategy
  - 誤ヒット: キー構成の E2E テストを追加。`FASTMD_DISABLE=1` で即時無効化可能。
  - Windows パス差分: 正規化ユーティリティに回帰テストを追加。
  - 依存解決のコスト: 初回のみ、結果をプロセス内にメモ化。

- Test Strategy
  - 単体: 正規化、キー算出、fingerprint、ENV 切替（disable/log level/salt）。
  - 結合: 小規模 MD/MDX プロジェクトで HIT/MISS 振る舞いとメタ記録。
  - 回帰: 既存 `tests/*` に合わせ、パス正規化・ENV 優先度のリグレッション。
  - ベンチ: `scripts/bench.sh`（将来）で 3× 短縮検証（spec の D1〜D4 基準に準拠）。

- Compatibility
  - Node ≥ 22, Vite ≥ 5, Astro ≥ 4（現状の package pins を前提）。CI/lockfile の変更は提案のみ。

- Observability
  - summary/silent/verbose の 3 段階（ENV `FASTMD_LOG`）。CI では summary 既定。
  - 終了時に集計（hits, misses, p50/p95/p99, totalSavedMs）を 1 行で出力。

