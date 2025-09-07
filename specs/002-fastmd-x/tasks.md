# Tasks — 002-fastmd-x

- [ ] shouldProcess(): `.md/.mdx` 判定と `?query` 剥離、`/@fs/`→絶対化、POSIX 小文字正規化
- [ ] digestFrontmatter(): `json-stable-stringify` による安定化（順序差の回帰テスト）
- [ ] deriveToolchainFingerprint(): Node/OS/自身/主要依存の実解決版を収集しメモ化
- [ ] computeKey(): k1..k6 を連結 → SHA256(hex)。salt/モード/importer を吸収
- [ ] pre-phase: キャッシュ HIT 判定と読み出し、メタ復元、ログ出力（hit/miss）
- [ ] post-phase: MISS 時に `cacache.put(payload:{code,map,meta})`、duration/size を記録
- [ ] ENV/opts 優先順位: ENV > options（`FASTMD_*` が最優先）
- [ ] ログ整形: NDJSON + summary 集計（hits, misses, durations）
- [ ] エラーハンドリング: キャッシュ破損時は MISS 扱いで継続
- [ ] テスト: 単体（正規化/キー/ENV）、結合（HIT/MISS/再ビルド）、回帰（Windows 互換含む）
- [ ] ベンチ: 3 回連続ビルドで cold→warm→hit 計測、1 ファイル変更シナリオで混在確認
- [ ] ドキュメント: README に最小導入手順/ENV/メトリクス例/既知の制限を追記（提案 PR）

Definition of Done
- D1: ヒット時 ≥3× 短縮（withastro/docs 規模の再現プロジェクトで実測）
- D2: コールド時オーバーヘッド ≤ +3%
- D3: CI で hit/miss ログ集計が提案できる
- D4: examples/ に最小再現が追加され README が更新済み

Out of Scope
- 開発サーバ HMR の最適化（Phase 2 以降）
- Rust 実装・napi 統合（Phase 2 以降）
