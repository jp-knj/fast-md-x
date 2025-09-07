# Spec: fast-md-x – フル出力キャッシュ (Phase 1 / Vite 経由 MVP)
- Owner: knj
- ID: 002-fastmd-x
- Status: Draft
- Last Updated: 2025-09-07

## 1. 概要 / 背景
MD/MDX → 最終JS(+map) の生成を **内容と環境に基づく安定キー** でディスク永続し、同一キーの再ビルド時に **Vite 変換を素通し** してビルド時間を短縮する。  
既存の「メモリのウォームアップ」「Rollup/Vite内部キャッシュ」「Astro専用最適化」はあるが、**“MD/MDX→最終JS” 粒度で公開プラグインがない**ため、プラグインとして切り出す。

## 2. 目標 / 非目標
### Goals
- G1: **キャッシュヒット時の再ビルドを ≥3×** 短縮（withastro/docs 規模: 1,000+ MD/MDXで計測）
- G2: コールド時のオーバーヘッド **≤ +3%**
- G3: ヒット/ミス/無効化の **観測可能性**（メトリクス/ログ標準化）
- G4: APIは **Viteプラグイン**として提供し、Astro/Docsで無改造運用
### Non-Goals
- N1: Phase 1では **Rust実装は行わない**（Phase 2で markdown-rs / napi-rs / wasm化を検討）
- N2: MDXの型安全（TS型流し込み）は対象外（既存チェーン前提）
- N3: 画像最適化やルーティングは対象外

## 3. 想定ユーザー / ユースケース
- Astro / Vite プロジェクトで、**MD/MDXが多数**あるドキュメント/ブログ/ナレッジサイト。
- CI/CDでの **増分ビルド**、ローカル反復ビルドの高速化。

## 4. 要件
### 機能要件 (FR)
- FR1: MD/MDX → JS(+map) の生成結果を **cacache** に保存/取得
- FR2: **安定キー**は「内容 + オプション + バージョン + 実行環境」を含む（詳細 §5.2）
- FR3: キャッシュミス時は通常ビルドを実行し、**post** フェーズで保存
- FR4: ファイル/依存の変更や設定変更で正しく **無効化**
- FR5: `include/exclude`、`cacheDir`、`debug`、`salt` などの設定が可能
### 非機能要件 (NFR)
- NFR1: Node 22 / macOS, Linux, Windows で動作
- NFR2: キャッシュ破損時は自動回復（MISS扱い）し、ビルドは失敗させない
- NFR3: ログは構造化（level, event, keyHash, duration, size, hit/miss）

## 5. 仕様詳細
### 5.1 アーキテクチャ
```mermaid
flowchart LR
  A[MD/MDX file] --> B[pre: key compute]
  B -->|HIT| C[read from cacache]
  C --> D[Vite returns JS(+map)]
  B -->|MISS| E[normal transform (MD/MDX toolchain)]
  E --> F[post: write to cacache]
  F --> D
```

### 5.2 キー設計（安定キー）
キーは以下の **正規化 → 連結 → SHA256** で算出。

* k1: ソース本文のハッシュ（`frontmatter` は `json-stable-stringify` 済み）
* k2: 変換オプション（remark/rehype/MDXフラグ等を正規化）
* k3: **ツールチェーン fingerprint**
  * Node major/minor、OS、fast-md-x バージョン
  * 主要依存（mdx/remark/rehype/astro/vite等）の **semverレンジと実解決版**
* k4: 呼び出し元バンドラのモード（dev/build / prod）
* k5: `salt`（プロジェクト単位の任意文字列）
* k6: importer 情報（クエリ/virtual id を含むなら正規化）

> 例: `sha256( k1|k2|k3|k4|k5|k6 ) → hex`

### 5.3 無効化 & 整合性
* **依存追跡**: MDX内の `import`/`remark plugins` など設定に触る要素は key に吸収
* **前方互換**: マイナー互換の依存更新は key に反映（衝突を避けるため semver ではなく実解決版を使う）

### 5.4 設定API
```ts
import fastMdX from "fast-md-x/vite";

export interface FastMdXOptions {
  cacheDir?: string;        // 既定: find-cache-dir("fast-md-x")
  include?: string | string[];
  exclude?: string | string[];
  salt?: string;            // プロジェクト識別に利用
  debug?: boolean;          // ログを詳細化
  trackDependencies?: "strict" | "loose"; // keyへの反映度合い
}

export default defineConfig({
  plugins: [fastMdX({ debug: false, trackDependencies: "strict" })],
});
```

### 5.5 互換性
* Node ≥ 22、Vite ≥ 5、Astro ≥ 4 を想定（最小サポート行は README に明記）

## 6. テレメトリ / デバッグ
* メトリクス: `fastmdx_hit_count`, `miss_count`, `write_bytes`, `read_ms`, `transform_ms_saved`
* ログ例（NDJSON）:
  `{"lvl":"info","evt":"cache_hit","key":"b8e…","path":"docs/x.md","read_ms":3}`

## 7. セキュリティ / ライセンス
* キャッシュに機密を入れない（`salt`は公開可前提）。cacacheはプロセス権限に従う。
* OSS ライセンス整合（cacache/remark 等のライセンス表記をNOTICEに集約）

## 8. 代替案と比較
* A) Vite の transformCache を拡張：内部API依存が強く将来変化に弱い
* B) FS直書き自作: 信頼性・並行I/O・ガベコレを自前管理するコストが高い
* **採用**: cacache（堅牢・実績豊富・クリーニング機構あり）

## 9. リスク & 緩和策
* R1: キー漏れで誤ヒット → **キー構成をE2Eで検証**＋`salt`の既定値明示
* R2: 依存の実解決版取得コスト → 初回のみ、結果をプロセス内メモ化
* R3: Windows パス長/差分 → path 正規化（POSIX風）・テスト追加

## 10. 測定 / 受け入れ基準 (DoD)
* D1: withastro/docs 規模で **ヒット時 ≥3×**（時間/CPUサンプルを記録）
* D2: コールド時オーバーヘッド **≤ +3%**
* D3: `hit/miss` ログがCIで収集可能
* D4: `examples/` で最小再現と README の導入手順が動作

### ベンチ手順（例）
```bash
# 1) ベースライン
time pnpm build

# 2) キャッシュ生成（MISS→WRITE）
time pnpm build

# 3) キャッシュヒット測定（HIT）
time pnpm build

# 4) 変更シナリオ（1ファイルtouch）でのHIT/MISS混在測定
```

## 11. マイルストーン
* M0: MVP（pre/postフック・cacache・キー計算・観測ログ）
* M1: 依存fingerprint安定化・examples追加・README整備
* M2: CI用メトリクス出力（JSON/NDJSON）と可視化サンプル
* M3: フィードバック反映 / 1.0.0 リリース候補

## 12. 未解決事項
* どこまで依存解決を key に含めるか（transitive の深さ）
* devサーバ（HMR）時のポリシー（Phase 1 は build優先）

## 13. 決定ログ (ADR)
* 2025-09-07: キャッシュBackendは cacache を採用。I/O信頼性とクリーンアップ優先。
* 2025-09-07: Phase 1は JS 実装に限定、Phase 2で markdown-rs + napi-rs 検討。
