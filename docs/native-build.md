# Native Build Guide (WASM) — fast-md-x

このドキュメントは、オプションのネイティブモジュール（Rust, WebAssembly）をローカルでビルドして試すための最小手順です。既定では JS フォールバックで動作します。ネイティブはオプトイン（FASTMD_NATIVE=1）です。

## 前提条件
- Node.js 18+（推奨: 20+）
- Rust（stable）: `rustup` で導入済み
- wasm-pack: `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`
- pnpm（任意）: `corepack enable` で利用可
- 全プラットフォーム対応（Linux/macOS/Windows）

## ビルド手順（wasm-pack）
1) ルート直下から実行:

```bash
pnpm native:build
# または
cd native/fastmd-native && wasm-pack build --target nodejs --out-name fastmd_native
```

2) 開発ビルド（最適化なし、高速）:

```bash
pnpm native:build:dev
```

- 生成物: `native/fastmd-native/pkg/` ディレクトリ内
  - `fastmd_native_bg.wasm` - WebAssembly バイナリ
  - `fastmd_native.js` - JavaScript バインディング
  - `index.js` - Node.js 互換ラッパー
- このモジュールは `packages/fastmd-cache/native-bridge.mjs` から動的に読み込まれます
- 読み込み条件: `FASTMD_NATIVE=1` かつ `@fastmd/native` もしくは `native/fastmd-native/index.js` 経由で WASM モジュールが解決できること

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
- WASM モジュールが見つからない: `pnpm native:build` を実行して `pkg/` ディレクトリが生成されているか確認
- Node 互換性: WebAssembly は Node.js 12 以降でサポート。推奨は Node 18+
- ビルドエラー: `wasm-pack` がインストールされているか確認
- それでもダメな場合: `FASTMD_NATIVE` を外せば JS フォールバックで動作します

## WebAssembly の利点
- **クロスプラットフォーム**: 単一のバイナリが全プラットフォームで動作
- **配布が簡単**: プラットフォーム別のビルドが不要
- **インストール簡単**: ユーザーに Rust ツールチェーンが不要
- **セキュア**: サンドボックス環境で実行
- **将来性**: ブラウザでも動作可能（Astro のクライアントサイドでの利用も可能）

## 補足
- CI で WASM ビルドが自動化されています（.github/workflows/native-prebuild.yml）
- リリースタグ（`native-v*`）や手動実行で、WASM モジュールを GitHub Release から取得可能
- 単一の WASM ファイルで全プラットフォームに対応（prebuild マトリクス不要）
- npm への配布も将来的に検討中

## Rust 側テスト（雛形）

ネイティブ crate 単体のテストは Cargo で実行できます（ローカル限定）。

```bash
cd native/fastmd-native
cargo test
```

内容:
- 既存/欠損ファイルを混在させたときのダイジェスト（`path|size|mtimeMs\n`連結→sha256）
- 入力順序に依らず同一ダイジェスト（安定ソート）
