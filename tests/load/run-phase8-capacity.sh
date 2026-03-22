#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="${BASE_URL:-https://beamlab-backend-node.azurewebsites.net}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
INCLUDE_W4="false"
HEALTH_ONLY="false"

for arg in "$@"; do
  case "$arg" in
    --include-w4)
      INCLUDE_W4="true"
      ;;
    --health-only)
      HEALTH_ONLY="true"
      ;;
  esac
done

if ! command -v k6 >/dev/null 2>&1; then
  echo "❌ k6 is not installed. Install with: brew install k6"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node is required to run capacity-summary.mjs"
  exit 1
fi

if [ "$HEALTH_ONLY" != "true" ] && [ -z "$AUTH_TOKEN" ]; then
  echo "❌ AUTH_TOKEN is required for Phase 8 analysis capacity runs."
  exit 1
fi

RUN_ID="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT_DIR/tests/load/reports/$RUN_ID"
mkdir -p "$OUT_DIR"

run_profile() {
  local profile="$1"
  local summary_file="$OUT_DIR/k6-summary-${profile}.json"
  local parsed_file="$OUT_DIR/capacity-${profile}.json"

  echo "\n=== Running profile: ${profile} ==="

  k6 run tests/load/capacity-staged.js \
    --env BASE_URL="$BASE_URL" \
    --env PROFILE="$profile" \
    --env ENABLE_ANALYSIS=true \
    --env AUTH_TOKEN="$AUTH_TOKEN" \
    --summary-export "$summary_file"

  node tests/load/capacity-summary.mjs "$summary_file" > "$parsed_file"

  echo "Saved raw summary:    $summary_file"
  echo "Saved parsed summary: $parsed_file"
}

if [ "$HEALTH_ONLY" = "true" ]; then
  summary_file="$OUT_DIR/k6-summary-health.json"
  parsed_file="$OUT_DIR/capacity-health.json"
  echo "\n=== Running profile: health ==="

  k6 run tests/load/capacity-staged.js \
    --env BASE_URL="$BASE_URL" \
    --env PROFILE=health \
    --summary-export "$summary_file"

  node tests/load/capacity-summary.mjs "$summary_file" > "$parsed_file"

  echo "Saved raw summary:    $summary_file"
  echo "Saved parsed summary: $parsed_file"
else
  run_profile w2
  run_profile w3

  if [ "$INCLUDE_W4" = "true" ]; then
    run_profile w4
  fi
fi

LATEST_POINTER="$ROOT_DIR/tests/load/reports/latest.txt"
printf '%s\n' "$OUT_DIR" > "$LATEST_POINTER"

echo "\n✅ Phase 8 capacity run complete."
echo "Output directory: $OUT_DIR"
echo "Latest pointer:   $LATEST_POINTER"