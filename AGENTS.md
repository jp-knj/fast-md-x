# AGENTS

プロジェクトの実行方法（検出値で上書き）:
- Setup: pnpm i
- Build: pnpm build
- Test (CI): pnpm test（実体は bun test）
- Lint/Typecheck: pnpm check && pnpm typecheck

モノレポの境界:
- 単一パッケージ（現状 apps/* / packages/* は未採用）
- 将来モノレポ化する場合は境界を追記

ブランチとコミット:
- Branch: <ID>-<slug> 例) 001-fastmd-cache
- Conventional Commits 推奨（feat/fix/chore/docs/test/refactor）

開発フロー:
1) specs/<ID>-<slug> に spec.md（何/なぜ）→ plan.md（どうやる/代替案/境界/非目標）→ tasks.md（チェックリスト/DoD）を作成
2) 承認後に実装着手、PR 本文に spec/plan のリンクを記載
3) すべての PR は lint/typecheck/test をパスすること

エージェント利用方針:
- 破壊的操作は Diff → 私の承認 → 適用 の順
- 依存追加は理由・影響・代替案を伴う提案から
- ドキュメント更新（README/CHANGELOG）は PR に含める

## Dev/HMR 方針（Phase 3）
- 既定: observe-only（開発サーバではコードを変更せず、HIT/MISS を計測するのみ）
- 目的: 安全に挙動を観測し、将来の read-through 最適化（Phase 4）に備える
- ルール:
  - 本番と同じキー設計（mode/importer/salt 含む）で HIT/MISS を計測
  - ログレベルは `FASTMD_LOG=summary` あるいは `json`（NDJSON）
  - 変換結果の差異を生まず、ビルドの正当性に影響しないこと
  - read-through（HMR 時のキャッシュ読み出し/書き込み）は Phase 4 で検討（安全策と回避策を含む）
