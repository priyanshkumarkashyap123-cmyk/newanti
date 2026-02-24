#!/bin/bash

# Deploy Python Backend to Azure App Service
# This script packages and deploys the backend code to Azure

set -e

echo "=========================================="
echo "BeamLab Backend Azure Deployment Script"
echo "=========================================="

RESOURCE_GROUP="beamlab-ci-rg"
APP_NAME="beamlab-backend-python"
BACKEND_DIR="apps/backend-python"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "Error: Backend directory not found at $BACKEND_DIR"
  exit 1
fi

echo ""
echo "[1/4] Creating deployment package..."
cd "$BACKEND_DIR"

# Create temporary deployment directory
DEPLOY_DIR=$(mktemp -d)
trap "rm -rf $DEPLOY_DIR" EXIT

# Copy all necessary files
cp -r . "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"

# Remove unnecessary files
rm -rf __pycache__ .pytest_cache *.pyc .env backend-python.zip

# Create zip archive
ZIP_FILE="/tmp/backend-$(date +%s).zip"
zip -r "$ZIP_FILE" . -q

echo "[✓] Package created: $ZIP_FILE ($(du -h $ZIP_FILE | cut -f1))"

echo ""
echo "[2/4] Deploying to Azure App Service..."
echo "      Resource Group: $RESOURCE_GROUP"
echo "      App Name: $APP_NAME"

# Deploy using Azure CLI
az webapp deployment source config-zip \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --src "$ZIP_FILE"

echo "[✓] Deployment submitted to Azure"

echo ""
echo "[3/4] Restarting application..."
az webapp restart --resource-group "$RESOURCE_GROUP" --name "$APP_NAME"

echo "[✓] Application restarted"

echo ""
echo "[4/4] Verifying deployment..."
sleep 10

# Test health endpoint
HEALTH_URL="https://${APP_NAME}.azurewebsites.net/health"
echo "      Testing: $HEALTH_URL"

if curl -s "$HEALTH_URL" --max-time 5 > /dev/null; then
  echo "[✓] Backend is responding!"
else
  echo "[!] Backend is not responding yet. It may still be starting up."
  echo "    Try again in a few moments."
fi

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Visit https://beamlabultimate.tech in your browser"
echo "2. Monitor logs with: az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME"
echo "3. Check settings with: az webapp config appsettings list --resource-group $RESOURCE_GROUP --name $APP_NAME"

# Cleanup
rm -f "$ZIP_FILE"
