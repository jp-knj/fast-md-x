#!/usr/bin/env bash
set -euo pipefail

# Simple 3-run MISS→HIT timing protocol for FastMD cache
# Usage: ./scripts/bench.sh

CACHE_DIR="${FASTMD_CACHE_DIR:-.cache/fastmd}"

say() { printf "\033[1;36m[bench]\033[0m %s\n" "$*"; }
secs() { awk '/^real/ {print $2}' | sed 's/^0*//'; }

run_build() {
  local label=$1
  say "Run ${label}: pnpm build"
  command time -p pnpm -s build 2> >(secs | sed 's/^/real=/' )
}

say "Clearing dist and cache (${CACHE_DIR})"
rm -rf dist "$CACHE_DIR"

run_build 1  # MISS + WRITE
run_build 2  # HIT

# Optional third run: touch a sample MD file if it exists
MD_SAMPLE="src/pages/sample.md"
if [ -f "$MD_SAMPLE" ]; then
  say "Touching $MD_SAMPLE to induce partial MISS"
  touch "$MD_SAMPLE"
  run_build 3
else
  say "No $MD_SAMPLE — skipping Run 3"
fi

say "Done. For JSON logs, run with FASTMD_LOG=json"

