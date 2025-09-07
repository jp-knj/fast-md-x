#!/usr/bin/env bash
set -euo pipefail
id="${1:-}"
slug="${2:-}"
if [[ -z "$id" || -z "$slug" ]]; then
  echo "usage: scripts/create-new-feature.sh <ID> <slug>"; exit 1;
fi
dir="specs/${id}-${slug}"
mkdir -p "${dir}"
cp -n templates/spec-template.md "${dir}/spec.md"
cp -n templates/plan-template.md "${dir}/plan.md"
cp -n templates/tasks-template.md "${dir}/tasks.md"
echo "Created ${dir}/ {spec.md,plan.md,tasks.md}"
