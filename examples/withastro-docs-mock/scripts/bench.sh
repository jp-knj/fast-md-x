#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[bench] seeding pages (1000)"
node scripts/seed-pages.mjs 1000

echo "[bench] cold build (MISS→WRITE)"
FASTMD_SALT=${FASTMD_SALT:-$(date +%s)} FASTMD_TRACK=${FASTMD_TRACK:-strict} FASTMD_LOG=json /usr/bin/time -p pnpm -s build | tee cold.ndjson || true

echo "[bench] warm build (HIT)"
FASTMD_LOG=json /usr/bin/time -p pnpm -s build | tee warm.ndjson || true

echo "[bench] done. Files: cold.ndjson, warm.ndjson"

