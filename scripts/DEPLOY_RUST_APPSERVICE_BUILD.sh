#!/bin/bash

echo "╔═══════════════════════════════════════╗"
echo "║  DEPLOYING RUST VIA APP SERVICE BUILD ║"
echo "╚═══════════════════════════════════════╝"

cd /Users/rakshittiwari/Desktop/newanti

# Configure App Service to build from source
echo ""
echo "Configuring beamlab-rust-api for App Service build..."

# Set deployment source to local Git
az webapp deployment source config-local-git \
  --resource-group beamlab-ci-rg \
  --name beamlab-rust-api \
  --output table

# Get deployment credentials
CREDS=$(az webapp deployment list-publishing-credentials \
  --resource-group beamlab-ci-rg \
  --name beamlab-rust-api \
  --query "{username:publishingUserName, password:publishingPassword}" \
  --output json)

USER=$(echo $CREDS | jq -r '.username')
PASS=$(echo $CREDS | jq -r '.password')

# Configure environment variables
echo ""
echo "Setting environment variables..."
az webapp config appsettings set \
  --resource-group beamlab-ci-rg \
  --name beamlab-rust-api \
  --settings \
    PORT=8080 \
    WEBSITES_PORT=8080 \
    RUST_LOG=info \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true \
    --output none

# Set up Git remote (if not exists)
if ! git remote | grep -q azure-rust; then
  echo ""
  echo "Adding Azure Git remote..."
  git remote add azure-rust "https://$USER:$PASS@beamlab-rust-api.scm.azurewebsites.net/beamlab-rust-api.git"
fi

# Push to Azure (this will trigger build)
echo ""
echo "╔═══════════════════════════════════════╗"
echo "║ OPTION 1: Git Push (Auto Build)      ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "Run this command to deploy:"
echo "  git push azure-rust main"
echo ""
echo "╔═══════════════════════════════════════╗"
echo "║ OPTION 2: ZIP Deploy (Faster)        ║"
echo "╚═══════════════════════════════════════╝"
echo ""
echo "Creating deployment package..."
cd apps/rust-api

# Create zip with compiled binary
zip -r /tmp/rust-deploy.zip . -x "target/*" -x ".git/*" -x "*.log"

# Add pre-compiled binary
cd target/release
if [ -f beamlab-rust-api ]; then
  zip /tmp/rust-deploy.zip beamlab-rust-api
  echo "✅ Binary included in package"
else
  echo "⚠️  Binary not found, will build on Azure"
fi

cd /Users/rakshittiwari/Desktop/newanti

echo ""
echo "Deploying ZIP to Azure..."
az webapp deployment source config-zip \
  --resource-group beamlab-ci-rg \
  --name beamlab-rust-api \
  --src /tmp/rust-deploy.zip

echo ""
echo "Restarting service..."
az webapp restart --resource-group beamlab-ci-rg --name beamlab-rust-api

echo ""
echo "╔════════════════════════════════════╗"
echo "║  DEPLOYMENT COMPLETE               ║"
echo "╚════════════════════════════════════╝"
echo ""
echo "Testing in 30 seconds..."
sleep 30

echo ""
curl -s -m 10 https://beamlab-rust-api.azurewebsites.net/health && echo "" || echo "Service starting... (retry in 1-2 minutes)"

echo ""
echo "Logs: az webapp log tail --resource-group beamlab-ci-rg --name beamlab-rust-api"
