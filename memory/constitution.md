# Principles
- 可読性 > 正確性 > 速度（ただしパフォーマンス予算は遵守）
- 既存の設計意図を尊重し、境界を明確化する

# Non-Goals
- ライブラリの全面置換
- CI/CD の即時刷新（提案止まり）

# Technical Policies
- 言語: TypeScript
- パッケージ管理: pnpm
- コード規約: Biome（既存設定に準拠）
- テスト: bun test（= pnpm test）
- i18n/アクセシビリティ: 既存ルールに従う。新規 UI は aria-* とラベル検証を必須とする

# Quality / Perf
- 単体テストを最小 1 ケース追加（回帰防止）
- パフォーマンス予算: ビルド/ランタイムの回帰は PR で可視化

