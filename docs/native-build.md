# Native Build Guide (R1) — fast-md-x

このドキュメントは、オプションのネイティブモジュール（Rust, napi-rs）をローカルでビルドして試すための最小手順です。既定では JS フォールバックで動作します。ネイティブはオプトイン（FASTMD_NATIVE=1）です。

## 前提条件
- Node.js 18+（推奨: 20+）
- Rust（stable）: `rustup` で導入済み
- pnpm（任意）: `corepack enable` で利用可
- macOS/Linux/Windows いずれも可（Windows は MSVC Build Tools が必要）

## ビルド手順（@napi-rs/cli）
1) ルート直下から、ネイティブパッケージへ移動:

```bash
cd native/fastmd-native
```

2) @napi-rs/cli でビルド（リリース）:

```bash
pnpm dlx @napi-rs/cli@latest build --release
# うまくいけば、このディレクトリに index.node が生成されます
```

- 生成物: `native/fastmd-native/index.node`
- このモジュールは `plugins/fastmd-cache/native-bridge.mjs` から動的に読み込まれます
- 読み込み条件: `FASTMD_NATIVE=1` かつ `@fastmd/native` もしくは `native/fastmd-native/index.js` 経由で `index.node` が解決できること

## 動作確認（スモーク）
ルート直下で実行:

```bash
# JS のダイジェスト（基準）
node scripts/print-digest.mjs path/to/a.md path/to/b.mdx

# JS vs Native を比較（一致しなければ非ゼロ終了）
FASTMD_NATIVE=1 node scripts/print-digest.mjs path/to/a.md path/to/b.mdx --native
# もしくはラッパー
scripts/native-smoke.sh path/to/a.md path/to/b.mdx
```

期待結果:
- `js:` と `native:` のハッシュが一致（フォーマット: `path|size|mtimeMs\n` の安定連結 → sha256hex）

## トラブルシュート
- index.node が見つからない: `pnpm dlx @napi-rs/cli build --release` を `native/fastmd-native` で実行しているか確認
- Node 互換性: Cargo.toml は `napi = { features = ["napi8"] }` です。Node 18/20 では後方互換で動作します
- Windows: MSVC ツールチェーン（Visual Studio Build Tools）を導入
- それでもダメな場合: `FASTMD_NATIVE` を外せば JS フォールバックで動作します

## 補足
- 現状 prebuild 配布は未対応（R1 の範囲外）。CI/テストは常に JS 経路が基準です
- 将来 R2 として prebuild（actions + matrix）を導入予定

