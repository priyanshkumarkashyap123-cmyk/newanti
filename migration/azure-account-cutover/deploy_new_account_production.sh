#!/usr/bin/env bash
set -euo pipefail

SUBSCRIPTION_ID="6eef4608-7e34-4237-834f-0e66cbd72ccd"
LOCATION_PRIMARY="centralindia"
LOCATION_SWA="eastasia"
RG="beamlab-prod-rg"

PLAN="beamlab-prod-plan"
NODE_APP="beamlab-backend-node-prod"
PY_APP="beamlab-backend-python-prod"
RUST_APP="beamlab-rust-api-prod"
SWA_APP="beamlab-frontend-prod"

SUFFIX="$(date +%m%d%H%M)"
ACR="beamlabreg${SUFFIX}"
COSMOS="beamlabmongo${SUFFIX}"
REDIS="beamlabredis${SUFFIX}"

echo "[1/10] Logging into Azure (device code if needed)..."
if ! az account show >/dev/null 2>&1; then
  az login --use-device-code >/dev/null
fi

echo "[2/10] Selecting target subscription..."
az account set --subscription "$SUBSCRIPTION_ID"

echo "[3/10] Creating resource group..."
az group create -n "$RG" -l "$LOCATION_PRIMARY" -o none

echo "[4/10] Creating App Service Plan (P1v3, 2 workers for reliability)..."
az appservice plan create \
  --name "$PLAN" \
  --resource-group "$RG" \
  --location "$LOCATION_PRIMARY" \
  --sku P1v3 \
  --is-linux \
  --number-of-workers 2 \
  -o none

echo "[5/10] Creating Node backend app..."
az webapp create \
  --resource-group "$RG" \
  --plan "$PLAN" \
  --name "$NODE_APP" \
  --runtime "NODE:20-lts" \
  -o none || true
az webapp config set -g "$RG" -n "$NODE_APP" --always-on true --http20-enabled true -o none || true

echo "[6/10] Creating Python backend app..."
az webapp create \
  --resource-group "$RG" \
  --plan "$PLAN" \
  --name "$PY_APP" \
  --runtime "PYTHON:3.11" \
  -o none || true
az webapp config set -g "$RG" -n "$PY_APP" --always-on true --http20-enabled true -o none || true

echo "[7/10] Creating Rust API app (container placeholder)..."
az webapp create \
  --resource-group "$RG" \
  --plan "$PLAN" \
  --name "$RUST_APP" \
  --deployment-container-image-name "mcr.microsoft.com/azuredocs/aci-helloworld" \
  -o none || true
az webapp config set -g "$RG" -n "$RUST_APP" --always-on true --http20-enabled true -o none || true

echo "[8/10] Creating ACR, Cosmos MongoDB, and Redis..."
az acr create -g "$RG" -n "$ACR" -l "$LOCATION_PRIMARY" --sku Basic --admin-enabled false -o none
az cosmosdb create -g "$RG" -n "$COSMOS" --kind MongoDB --default-consistency-level Session --locations regionName="$LOCATION_PRIMARY" failoverPriority=0 isZoneRedundant=False -o none
az redis create -g "$RG" -n "$REDIS" -l "$LOCATION_PRIMARY" --sku Standard --vm-size C1 -o none

echo "[9/10] Creating Static Web App (best-effort)..."
az staticwebapp create \
  --name "$SWA_APP" \
  --resource-group "$RG" \
  --location "$LOCATION_SWA" \
  --sku Standard \
  -o none || true

echo "[10/10] Summarizing deployed resources..."
az resource list -g "$RG" --query "[].{name:name,type:type,location:location}" -o table

echo
echo "DEPLOYMENT_COMPLETE"
echo "RG=$RG"
echo "NODE_APP=$NODE_APP"
echo "PY_APP=$PY_APP"
echo "RUST_APP=$RUST_APP"
echo "SWA_APP=$SWA_APP"
echo "ACR=$ACR"
echo "COSMOS=$COSMOS"
echo "REDIS=$REDIS"
