#!/bin/bash
# ⚠️ DEPRECATED: Legacy Azure App Service startup script.
# Azure Container deployments use Dockerfile ENTRYPOINT instead.
# Root startup script - redirect to apps/api folder
set -e

echo "================================"
echo "BeamLab API - Starting..."
echo "================================"
echo "Current directory: $(pwd)"
echo "Node version: $(node --version)"

# Change to the app directory
cd /home/site/wwwroot/apps/api

# Check dist exists - if not, build it
if [ ! -f "dist/index.js" ]; then
    echo "Building application..."
    npm ci --legacy-peer-deps || true
    npm run build
fi

echo "Starting application..."
exec node dist/index.js
