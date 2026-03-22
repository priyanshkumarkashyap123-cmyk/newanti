#!/usr/bin/env bash
set -euo pipefail

SUBSCRIPTION_ID="6eef4608-7e34-4237-834f-0e66cbd72ccd"
TENANT_ID="4a247a4a-971f-4e73-9d52-1fe5aea7a3e8"
RG="beamlab-prod-rg"
LOCATION="centralindia"
TEMPLATE="/Users/rakshittiwari/Desktop/newanti/infra/decodedoffice-prod/main.bicep"
PARAMS="/Users/rakshittiwari/Desktop/newanti/infra/decodedoffice-prod/main.parameters.json"
LOG_DIR="/Users/rakshittiwari/Desktop/newanti/migration/azure-account-cutover/logs"

mkdir -p "$LOG_DIR"

echo "Logging into decodedoffice tenant..."
az login --use-device-code --tenant "$TENANT_ID" -o none
az account set --subscription "$SUBSCRIPTION_ID"

echo "Creating resource group..."
az group create -n "$RG" -l "$LOCATION" -o none

echo "Running what-if..."
az deployment group what-if \
  --resource-group "$RG" \
  --template-file "$TEMPLATE" \
  --parameters "$PARAMS" \
  > "$LOG_DIR/whatif-$(date +%Y%m%d-%H%M%S).log"

echo "Deploying template..."
az deployment group create \
  --resource-group "$RG" \
  --template-file "$TEMPLATE" \
  --parameters "$PARAMS" \
  -o json > "$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).json"

echo "Listing deployed resources..."
az resource list -g "$RG" --query "[].{name:name,type:type,location:location}" -o table

echo "BICEP_DEPLOY_COMPLETE"
