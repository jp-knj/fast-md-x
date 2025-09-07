#!/usr/bin/env bash
set -euo pipefail
git config core.hooksPath .githooks
chmod +x .githooks/* || true
echo "Git hooks path set to .githooks. Pre-commit enabled."
