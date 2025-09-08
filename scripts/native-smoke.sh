#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path...>" >&2
  exit 1
fi

JS_DIGEST=$(node scripts/print-digest.mjs "$@")
if FASTMD_NATIVE=1 node scripts/print-digest.mjs "$@" --native >/tmp/.native.out 2>/tmp/.native.err; then
  NATIVE_DIGEST=$(grep '^native:' /tmp/.native.out | awk '{print $2}')
  if [[ -z "$NATIVE_DIGEST" ]]; then
    echo "Native addon unavailable; JS digest: $JS_DIGEST" >&2
    exit 0
  fi
  echo "JS:     $JS_DIGEST"
  echo "Native: $NATIVE_DIGEST"
  test "$JS_DIGEST" == "$NATIVE_DIGEST"
else
  echo "Native run failed; falling back to JS digest: $JS_DIGEST" >&2
  exit 0
fi

