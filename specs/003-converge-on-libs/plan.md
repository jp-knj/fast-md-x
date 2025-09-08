# Plan: fast-md-x — “自作しない”収束

## 方針
最小改修・段階適用。既存の関数境界（include/exclude 判定、normalizeId、ログ、opts 解決）を保ったまま、内部実装だけをライブラリへ差し替える。テストグリーンを維持しつつ計測可能な単位で進める。

## 作業ブレークダウン（提案コミット粒度）
1) 前準備
- `apply: 'build'` を pre/post に追加（dev/HMR 明示無効）
- README へ運用ノート追記（dev は無効・ベンチ手順）

2) パターン判定: picomatch
- 置換: `compileGlobs + patternsMatch` 内部を picomatch へ実装切替
- API 互換: `__internals` エクスポートとテストは維持

3) パス正規化: slash
- `normalizeId` 内の `split(path.sep).join('/')` を `slash` に置換

4) 設定バリデーション: zod
- `createState` の冒頭に schema 追加 `Opts.parse(userOptions)`
- ENV 上書き後も型整合を保持

5) ログ: pino（JSON は既存スキーマ）
- `logJSON/logSummaryJSON` 実装を pino に委譲
- 互換: destination を console.log ブリッジ（テストの console キャプチャ動作を維持）

6) 依存収集（strict 拡張）
- `pre.transform` 内で `this.getModuleInfo?.(id)` を呼び、`importedIds + dynamicallyImportedIds` を収集
- `fs.stat` の `{ mtimeMs, size }` をキー部品に組み込み（順序は path 昇順で安定化）
- 失敗時はスキップ（strict でも fail-closed しない）

7) 型定義: JSDoc + `tsc --emitDeclarationOnly`
- `plugins/fastmd-cache/index.mjs` に JSDoc 付与
- `tsconfig.types.json` を追加、`dist/types` へ出力
- 当面は既存 `index.d.ts` 併存（切替は後続）

8) ベンチ支援（任意・開発環境）
- `scripts/bench-hf.sh` 追加（hyperfine + jq）
- CI 用の README 断片と actions-benchmark のサンプル断片を docs に記載

## 代替案
- ログは `console` を継続: 依存ゼロだが将来拡張性に劣る → 今回は pino を選択
- グロブは fast-glob に一本化: 収集不要なため今回は picomatch 優先

## ガードレール
- `this.getModuleInfo` が無い場合は依存収集をスキップ
- 失敗してもキー計算は従来要素で成立

