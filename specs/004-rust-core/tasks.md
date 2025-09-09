# Tasks: Rust Core R0/R1

## 完了（R0/R1）
- [x] Add native bridge file (env-guarded)
- [x] Integrate bridge into deps digest path (strict only)
- [x] Update README with FASTMD_NATIVE note（現状に合わせて追補予定あり）
- [x] Keep tests green (default path)
- [x] Scaffold napi-rs crate（`native/fastmd-native`）

## 未着手/進行中（R2 以降）
- [ ] Implement `normalize_content` in Rust（BOM除去 + 改行正規化）
- [ ] JS ↔ Rust 正規化の同値性テスト（ゴールデン/プロパティ）
- [ ] CI: `FASTMD_NATIVE=1` で Linux ジョブ追加（`pnpm native:build && pnpm test:native`）
- [ ] Prebuild 配布（napi prebuild, GitHub Actions matrix: macOS/Linux x64/arm64, Windows 検討）
- [ ] Windows 特有テスト（junction/symlink、ACL deny、長パス）
- [ ] ベンチ導入（hyperfine + actions-benchmark）
- [ ] README のネイティブ節を現状（crate あり）へ更新・整合
