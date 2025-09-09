# Spec: fast-md-x — “自作しない”収束 (Converge on Existing Libraries)

## 1. 概要 / 背景
- 目的: 既存の最小実装を維持しつつ、自前実装を可能な限り外部ライブラリへ置き換え、保守性と信頼性を高める。
- 方針: 自作しない。既存の設計と挙動は可能な限り保持し、差分は小さく。段階的に計測→是非判断。

## 2. スコープ
- 対象: `packages/fastmd-cache/index.mjs` と付随の開発ドキュメント/設定。
- 非対象: キャッシュ戦略（cacache）やキー構成の根幹は変更しない（内容+frontmatter+features+toolchain+path+mode+salt）。

## 3. 置き換えマップ（決定）
- Glob/パターン判定: 内製簡易実装 → picomatch（単純マッチ）/ fast-glob（収集用途が必要な場合）
- パス正規化: `path.sep` 置換 → slash
- 設定バリデーション: if 群 → zod（最小スキーマ）
- ログ: 文字列連結/手動 JSON → pino（JSON ログ; 既存スキーマ維持）
- キーの安定シリアライズ: json-stable-stringify 継続
- ベンチ/レポート: hyperfine + jq（CI: rhysd/actions-benchmark）
- 依存関係収集（strict 拡張）: `this.getModuleInfo(id)`→ `importedIds`/`dynamicallyImportedIds` を stat しキーに反映
- 型定義: 手書き `.d.ts` → JSDoc + `tsc --emitDeclarationOnly`（当面は併存可）

## 4. 非機能要件 / 互換性
- 既存の JSON ログスキーマ（schemas/fastmd-log.schema.json）を維持。
- 既存テストを基本互換。`[fastmd] summary ...` の人間可読ログは維持。
- dev/HMR では無効化（`apply: 'build'` を宣言）。

## 5. ユーザー可視 API 変更
- Options: `include/exclude` の意味は同じ。マッチャの実装が picomatch へ。
- Options: `trackDependencies: 'strict'|'loose'` は継続。strict 時、依存ファイルの mtime/size をキーに含める。
- ENV: 既存の `FASTMD_LOG=json` は pino へ委譲。出力スキーマは据え置き。

## 6. リスクと緩和
- 新規依存: バンドルサイズ/起動コスト増 → 最小 API 利用、lazy 構築。
- ログ出力の取り回し: pino 出力は `console.log` キャプチャ互換にする（destination を console.log ブリッジ）。
- getModuleInfo 非対応の文脈（単体実行/テスト）→ ガードして無効化、挙動は現状踏襲。

## 7. 計測 (DoD)
- `pnpm build` の MISS→HIT 所要時間差を `hyperfine` で 3-run x 3rep 測定し、NDJSON を `jq` で検証。
- 既存 tests（bun）を通過。JSON ログの型も schema に適合。

## 8. ロールバック戦略
- 置き換え箇所は関数境界を維持（パターン判定/ログ/opts-parse）。問題時に 1 commit で戻せるよう分割コミット。

## 9. ADR（要点）
- ライブラリ採用により保守コスト/バグリスクを削減。高速化は目的ではない（回帰しない範囲で）。
