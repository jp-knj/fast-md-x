# Implementation Plan: fast-md-x – フル出力キャッシュ (Phase 1 / Vite 経由 MVP)

Branch: `002-fastmd-x` | Date: 2025-09-09 | Spec: `specs/002-fastmd-x/spec.md`
Input: Feature specification from `specs/002-fastmd-x/spec.md`

## Summary
Vite の transform パイプラインに「pre/post」2段の観測フックを差し込み、MD/MDX → JS(+map) の最終生成物を安定キーで `cacache` に保存・再利用する。キーは「内容(LF正規化+BOM除去)+frontmatter(JSON安定化)+features+toolchain+pathDigest(+mode,+salt)」で構成。Astro/Vite プロジェクトでのビルド反復時間を短縮し、キャッシュ破損時は MISS として安全にフォールバックする。

## Technical Context
Language/Version: Node.js 22 (ESM)  
Primary Dependencies: `cacache`, `gray-matter`, `json-stable-stringify`, `find-cache-dir`（Vite/Astro は利用側依存）  
Storage: cacache（デフォルトは `find-cache-dir({name:'fastmd'})`、無ければ `./.cache/fastmd`）  
Testing: Bun test (`pnpm test`)  
Target Platform: macOS/Linux/Windows (Node 22)  
Project Type: Single package（モノレポ未採用）  
Performance Goals: ヒット時 ≥3× 短縮、コールド時オーバーヘッド ≤ +3%  
Constraints: キャッシュ破損時は MISS 扱いで例外を投げない（ビルドは継続）

## Constitution Check
Simplicity:
- Projects: 1（app+lib 同居、プラグインは `packages/fastmd-cache`）
- フレームワーク直使用（Vite/Astro）。余剰なラッパは作らない。

Architecture:
- ライブラリ（Viteプラグイン）として提供。CLI は現段階で不要。
- ドキュメントは README と `examples/` に集約。

Testing (NON-NEGOTIABLE):
- RED→GREEN→Refactor の順序厳守。実装前にテストを追加して失敗を確認。
- 重要仕様（include/exclude、salt、mode、ログ構造、破損時回復、Win系パス正規化）をテスト化。

Observability:
- 構造化ログ（summary 含む）。必要に応じて NDJSON（`FASTMD_LOG=json`）を CI 収集。

Versioning:
- 現状 `0.0.1`。Breaking は 1.0.0 で明示。

## Project Structure
Single project を維持。既存の `plugins/`, `tests/`, `examples/` を使用。

## Phase 0: Outline & Research
Unknowns → 現段階なし。将来検討：HMR/dev 時ポリシー、transitive 依存までの fingerprint 深さ。

## Phase 1: Design & Contracts
- API（オプション）: `include`, `exclude`, `salt`, `log`, `cacheDir`, `features`（テレメトリ用）
- 期待動作: include/exclude のグロブ適用、salt/mode をキーへ反映、破損キャッシュ時の安全動作、JSON ログ整合。
- Quickstart: Vite/Astro への組み込み例を `examples/` と README に記載。

## Phase 2: Task Planning Approach
Task Generation Strategy:
- テンプレートに従い、テスト→実装→統合→ポリッシュの順でタスク化。
- 機能要件の差分（include/exclude、salt、mode、ログ、破損耐性、Winパス）をすべて RED テスト化。

Ordering Strategy:
- Tests first（失敗を確認）→ Core 実装 → Docs/Examples/Bench → Polish。

Estimated Output:
- 20〜25 のタスク（並列可能タスクは [P] 付与）。

## Phase 3+: Future Implementation
- Phase 3: tasks.md に基づく実行（このリポジトリで実施）。
- Phase 4: 実装完了・レビュー・ベンチ。
- Phase 5: バリデーション（DoD: ヒット時 ≥3×、コールド ≤+3%、ログ/例が動く）。

## Complexity Tracking
現状なし。

## Progress Tracking
Phase Status:
- [ ] Phase 0: Research complete
- [x] Phase 1: Design complete（spec.md 済）
- [x] Phase 2: Task planning complete（本 plan.md で方針確定）
- [ ] Phase 3: Tasks generated
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

Gate Status:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved（当面分）
- [ ] Complexity deviations documented

