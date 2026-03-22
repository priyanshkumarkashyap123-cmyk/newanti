#!/usr/bin/env bash
set -euo pipefail

SUBSCRIPTION_ID="6eef4608-7e34-4237-834f-0e66cbd72ccd"
RG="beamlab-prod-rg"
NODE_APP="beamlab-backend-node-prod"
PY_APP="beamlab-backend-python-prod"
RUST_APP="beamlab-rust-api-prod"
SWA_APP="beamlab-frontend-prod"

az account set --subscription "$SUBSCRIPTION_ID"

NODE_URL="https://$(az webapp show -g "$RG" -n "$NODE_APP" --query defaultHostName -o tsv)"
PY_URL="https://$(az webapp show -g "$RG" -n "$PY_APP" --query defaultHostName -o tsv)"
RUST_URL="https://$(az webapp show -g "$RG" -n "$RUST_APP" --query defaultHostName -o tsv)"
SWA_URL="https://$(az staticwebapp show -g "$RG" -n "$SWA_APP" --query defaultHostname -o tsv 2>/dev/null || true)"

echo "NODE_URL=$NODE_URL"
echo "PY_URL=$PY_URL"
echo "RUST_URL=$RUST_URL"
echo "SWA_URL=$SWA_URL"

echo "Checking health endpoints..."
for u in "$NODE_URL/health" "$PY_URL/health" "$RUST_URL/health"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$u" || true)"
  echo "$u -> $code"
done

if [[ -n "$SWA_URL" ]]; then
  code="$(curl -s -o /dev/null -w '%{http_code}' "$SWA_URL" || true)"
  echo "$SWA_URL -> $code"
fi

echo "VERIFY_COMPLETE"
