# Plan: Rust Core R0 — Native bridge with safe fallback

## Steps
1) Add JS bridge `packages/fastmd-cache/native-bridge.mjs`
   - `loadFastmdNative()` — env-guarded loader (FASTMD_NATIVE)
   - Expose `depsDigestNative(paths)` or return null
2) Wire bridge in plugin (strict deps digest path)
   - If native present → use it; else current JS stat path
3) Docs
   - README: optional native path + env flag
4) (Later) Add Rust crate `native/fastmd-native` via napi-rs
   - Export `deps_digest` (paths: string[]) → string
   - Prebuild workflow proposal in a separate spec

## Non-goals
- No behavior change without `FASTMD_NATIVE=1`
- No replacement of cache backend or globs in R0

