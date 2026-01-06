#!/bin/bash
set -e

echo "╔══════════════════════════════════════╗"
echo "║  DEPLOYING ALL BACKENDS NOW         ║"
echo "╚══════════════════════════════════════╝"
echo ""

RG="beamlab-ci-rg"

# Get config
MONGODB_URI=$(az webapp config appsettings list --resource-group "$RG" --name beamlab-backend-node --query "[?name=='MONGODB_URI'].value" -o tsv)
JWT_SECRET=$(az webapp config appsettings list --resource-group "$RG" --name beamlab-backend-node --query "[?name=='JWT_SECRET'].value" -o tsv)

# Python
echo "Fixing Python..."
az webapp restart --resource-group "$RG" --name beamlab-backend-python --output none &

# Rust
echo "Building Rust in Azure..."
cd /Users/rakshittiwari/Desktop/newanti/apps/rust-api
az acr build --registry beamlabregistry --image beamlab-rust-api:latest --platform linux/amd64 . > /tmp/rust-final.log 2>&1 &
BUILD_PID=$!

echo ""
echo "Python: Restarting"
echo "Rust: Building (PID $BUILD_PID)"
echo ""
echo "Monitor: tail -f /tmp/rust-final.log"
echo "Wait 10-15 minutes for Rust build to complete"
echo ""
