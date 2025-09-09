# Tasks: fast-md-x — “自作しない”収束

## チェックリスト
- [x] pre/post に `apply: 'build'` を追加
- [x] picomatch で include/exclude 判定を実装（`__internals` 互換）
- [x] slash でパス正規化に統一
- [x] zod で Options をパース/バリデート
- [x] pino で JSON ログを出力（既存スキーマ）
- [x] strict: `getModuleInfo` で依存を stat → キーへ反映
- [x] JSDoc 付与 + `tsconfig.types.json` + `pnpm types:gen`
- [x] README に運用ノート/ベンチ手順を追記

## DoD
- [ ] `pnpm check && pnpm typecheck && pnpm test` がグリーン
- [ ] `FASTMD_LOG=json` の NDJSON が schema に適合
- [ ] `hyperfine` による MISS→HIT 差分が観測できる（ドキュメント化）

## フォローアップ
- [ ] NDJSON を schema で実際に検証するテストを追加（ajv 等）
- [ ] hyperfine の手順を README にもう少し具体化（サンプル出力）
- [ ] `pnpm check`/`typecheck` のCIゲート有効化

## 依存（追加）
- runtime: `picomatch`, `slash`, `zod`, `pino`
- dev: `@types/node`（必要なら）, ベンチ用途 `hyperfine` は外部ツール
