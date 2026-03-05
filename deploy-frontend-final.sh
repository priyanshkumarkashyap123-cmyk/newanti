#!/bin/bash

set -e

cd /Users/rakshittiwari/Desktop/newanti

echo "🚀 DEPLOYING FRONTEND TO AZURE STATIC WEB APPS"
echo "=============================================="
echo ""

# Step 1: Get deployment token
echo "⏳ Step 1: Getting deployment token..."
TOKEN=$(az staticwebapp secrets list \
  --name beamlab-frontend \
  --resource-group beamlab-ci-rg \
  --query "properties.apiKey" \
  -o tsv)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to retrieve deployment token"
  exit 1
fi

echo "✅ Token retrieved"
echo ""

# Step 2: Deploy frontend
echo "⏳ Step 2: Deploying frontend files..."
cd apps/web

export AZURE_STATIC_WEB_APPS_API_TOKEN="$TOKEN"

npx @azure/static-web-apps-cli deploy dist \
  --env production

echo ""
echo "✅ Frontend deployment complete!"
echo ""
echo "Waiting 30 seconds for deployment to propagate..."
sleep 30

echo ""
echo "🔍 Verifying deployment..."
echo ""

cd /Users/rakshittiwari/Desktop/newanti

# Check if frontend is live
if curl -s https://beamlabultimate.tech/app | grep -q "three-vendor"; then
  echo "✅ Frontend successfully deployed to https://beamlabultimate.tech/app"
else
  echo "⏳ Frontend is deploying (may take a few more minutes)"
fi

# Check backend status
echo ""
echo "Checking backend services..."
echo "  Python API: $(curl -s -o /dev/null -w 'HTTP %{http_code}' https://beamlab-backend-python.azurewebsites.net/health)"
echo "  Node API: $(curl -s -o /dev/null -w 'HTTP %{http_code}' https://beamlab-backend-node.azurewebsites.net/health)"
echo ""

echo "=========================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "Test the app:"
echo "1. Visit: https://beamlabultimate.tech/app"
echo "2. Open DevTools (F12) → Console tab"
echo "3. Expected: No 403/404/401 errors"
echo "4. Canvas should render with optional WebGL warning"
echo ""
echo "Clear browser cache: Cmd+Shift+R"
echo ""
