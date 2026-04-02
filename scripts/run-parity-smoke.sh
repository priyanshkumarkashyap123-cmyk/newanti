#!/usr/bin/env bash
set -euo pipefail

FIXTURES_DIR="${1:-tests/solver-parity/fixtures}"
PYTHON_BASE="${PYTHON_API_URL:-http://localhost:8000}"
RUST_BASE="${RUST_API_URL:-http://localhost:3002}"
SMOKE_CURL_TIMEOUT="${SMOKE_CURL_TIMEOUT:-8}"

fetch_http_code() {
  local url="$1"
  local status

  status=$(curl --max-time "$SMOKE_CURL_TIMEOUT" -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || true)
  if [[ "$status" =~ ^[0-9]{3}$ ]]; then
    echo "$status"
  else
    echo "000"
  fi
}

echo "=== PARITY SMOKE (launch-critical fixtures) ==="
echo "Python: ${PYTHON_BASE}"
echo "Rust:   ${RUST_BASE}"

python_status=$(fetch_http_code "${PYTHON_BASE%/}/health")
rust_status=$(fetch_http_code "${RUST_BASE%/}/health")

if [[ ! "$python_status" =~ ^2[0-9]{2}$ ]] || [[ ! "$rust_status" =~ ^2[0-9]{2}$ ]]; then
  echo "Skipping parity smoke: backend health not ready (python=${python_status}, rust=${rust_status})"
  exit 0
fi

RUST_API_URL="${RUST_BASE}" PYTHON_API_URL="${PYTHON_BASE}" node tools/solver-parity/run_parity.cjs "${FIXTURES_DIR}"
