#!/usr/bin/env bash
set -euo pipefail

echo "Verifying CI environment prerequisites..."

check_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    echo " - $1: OK"
  else
    echo " - $1: MISSING"
  fi
}

check_cmd node
check_cmd pnpm
check_cmd cargo
check_cmd rustc
check_cmd python3
check_cmd docker

echo "Environment verification complete. Please install missing tools before running full CI locally."

exit 0
