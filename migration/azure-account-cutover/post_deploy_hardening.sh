#!/usr/bin/env bash
set -euo pipefail

SUBSCRIPTION_ID="6eef4608-7e34-4237-834f-0e66cbd72ccd"
RG="beamlab-prod-rg"
PLAN="beamlab-prod-plan"
NODE_APP="beamlab-backend-node-prod"
PY_APP="beamlab-backend-python-prod"
RUST_APP="beamlab-rust-api-prod"

# Credit-aware but reliable baseline:
# - Keep Premium v3 plan for production resilience
# - Autoscale from 2 to 4 instances on CPU pressure
# - Health checks + always-on + HTTP2 for all app services

az account set --subscription "$SUBSCRIPTION_ID"

for app in "$NODE_APP" "$PY_APP" "$RUST_APP"; do
  az webapp config set -g "$RG" -n "$app" --always-on true --http20-enabled true --min-tls-version 1.2 -o none
  az webapp config access-restriction set -g "$RG" -n "$app" --use-same-restrictions-for-scm-site true -o none || true
  az webapp config appsettings set -g "$RG" -n "$app" --settings WEBSITE_HEALTHCHECK_MAXPINGFAILURES=10 -o none || true
done

# Health check paths (adjust to your actual endpoints)
az webapp config set -g "$RG" -n "$NODE_APP" --generic-configurations '{"healthCheckPath":"/health"}' -o none || true
az webapp config set -g "$RG" -n "$PY_APP" --generic-configurations '{"healthCheckPath":"/health"}' -o none || true
az webapp config set -g "$RG" -n "$RUST_APP" --generic-configurations '{"healthCheckPath":"/health"}' -o none || true

# Autoscale profile for the App Service plan
PLAN_ID="$(az appservice plan show -g "$RG" -n "$PLAN" --query id -o tsv)"
AUTOSCALE_NAME="beamlab-prod-autoscale"

if ! az monitor autoscale show -g "$RG" -n "$AUTOSCALE_NAME" >/dev/null 2>&1; then
  az monitor autoscale create \
    --resource-group "$RG" \
    --resource "$PLAN_ID" \
    --resource-type Microsoft.Web/serverfarms \
    --name "$AUTOSCALE_NAME" \
    --min-count 2 \
    --max-count 4 \
    --count 2 \
    -o none
fi

az monitor autoscale rule create -g "$RG" --autoscale-name "$AUTOSCALE_NAME" \
  --condition "Percentage CPU > 70 avg 10m" --scale out 1 -o none || true

az monitor autoscale rule create -g "$RG" --autoscale-name "$AUTOSCALE_NAME" \
  --condition "Percentage CPU < 35 avg 20m" --scale in 1 -o none || true

echo "HARDENING_COMPLETE"
