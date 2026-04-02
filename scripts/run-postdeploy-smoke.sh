#!/usr/bin/env bash
set -euo pipefail

NODE_API_URL="${NODE_API_URL:-https://beamlab-backend-node-prod.azurewebsites.net/health}"
PYTHON_API_URL="${PYTHON_API_URL:-https://beamlab-backend-python-prod.azurewebsites.net/health}"
RUST_API_URL="${RUST_API_URL:-https://beamlab-rust-api-prod.azurewebsites.net/health}"
SMOKE_RETRIES="${SMOKE_RETRIES:-10}"
SMOKE_SLEEP_SECONDS="${SMOKE_SLEEP_SECONDS:-15}"
SMOKE_CURL_TIMEOUT="${SMOKE_CURL_TIMEOUT:-15}"
SMOKE_ALLOWED_FAILURES="${SMOKE_ALLOWED_FAILURES:-1}"

FAILED=0

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

check_health() {
  local label="$1"
  local url="$2"
  local status
  local healthy_regex='^2[0-9]{2}$|^30[12]$'

  echo "Checking ${label} at ${url}"
  for ((i = 1; i <= SMOKE_RETRIES; i++)); do
    status=$(fetch_http_code "$url")
    echo "  Attempt $i: HTTP $status"
    if [[ "$status" =~ $healthy_regex ]]; then
      return 0
    fi
    if [ "$i" -lt "$SMOKE_RETRIES" ]; then
      sleep "$SMOKE_SLEEP_SECONDS"
    fi
  done

  FAILED=$((FAILED + 1))
  return 1
}

echo "=== POST-DEPLOYMENT HEALTH CHECKS ==="
check_health "Node API" "$NODE_API_URL" || true
check_health "Python API" "$PYTHON_API_URL" || true
check_health "Rust API" "$RUST_API_URL" || true

echo
if [ "$FAILED" -eq 0 ]; then
  echo "PASS: all backend services healthy"
  exit 0
elif [ "$FAILED" -le "$SMOKE_ALLOWED_FAILURES" ]; then
  echo "WARN: $FAILED service not healthy yet (warm-up tolerance applied)"
  exit 0
else
  echo "FAIL: $FAILED services failed health checks"
  exit 1
fi
