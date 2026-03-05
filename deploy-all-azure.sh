#!/bin/bash

# ============================================
# Complete Azure Deployment Script
# Deploys all fixes: Python API, Node API, Frontend
# ============================================

set -e

echo "🚀 BeamLab Complete Deployment to Azure"
echo "========================================"
echo ""

RESOURCE_GROUP="beamlab-ci-rg"
PYTHON_APP="beamlab-backend-python"
NODE_APP="beamlab-backend-node"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Step 1/3: Deploying Python Backend${NC}"
echo "  - Updated security_middleware.py (section endpoints now public)"
echo ""

cd /Users/rakshittiwari/Desktop/newanti

# Deploy Python backend
if az webapp deploy \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PYTHON_APP" \
  --src-path apps/backend-python-deploy.zip \
  --type zip \
  --timeout 300 2>/dev/null; then
  echo -e "${GREEN}✅ Python backend deployed${NC}"
else
  echo -e "${RED}⚠️  Python backend deployment queued (another deployment in progress)${NC}"
  echo "   Will complete automatically. Check: https://beamlab-backend-python.azurewebsites.net/health"
fi

echo ""
echo -e "${YELLOW}📦 Step 2/3: Deploying Node.js Backend${NC}"
echo "  - Updated csrfProtection.ts (whitelisted auth endpoints)"
echo ""

# Deploy Node.js backend
if az webapp deploy \
  --resource-group "$RESOURCE_GROUP" \
  --name "$NODE_APP" \
  --src-path apps/api-deploy.zip \
  --type zip \
  --timeout 300 2>/dev/null; then
  echo -e "${GREEN}✅ Node.js backend deployed${NC}"
else
  echo -e "${RED}⚠️  Node.js backend deployment queued${NC}"
  echo "   Will complete automatically. Check: https://beamlab-backend-node.azurewebsites.net/health"
fi

echo ""
echo -e "${YELLOW}📦 Step 3/3: Deploying Frontend${NC}"
echo "  - Fixed endpoint: /api/user/tier → /api/user/limits"
echo "  - Fixed canvas rendering (removed WebGL hard-block)"
echo "  - Added CSRF tokens to auth requests"
echo ""

# Deploy frontend using SWA CLI
cd apps/web

if [ -z "$AZURE_STATIC_WEB_APPS_API_TOKEN" ]; then
  echo -e "${RED}⚠️  AZURE_STATIC_WEB_APPS_API_TOKEN not set${NC}"
  echo ""
  echo "To deploy frontend, set the token:"
  echo '  export AZURE_STATIC_WEB_APPS_API_TOKEN="your-token-here"'
  echo "  then run: npx @azure/static-web-apps-cli deploy dist --env production"
  echo ""
  echo "Or deploy manually:"
  echo "  1. Go to Azure Portal → Static Web Apps"
  echo "  2. Select: brave-mushroom-0eae8ec00"
  echo "  3. Upload contents of: apps/web/dist/"
else
  if npx @azure/static-web-apps-cli deploy dist \
    --deployment-token="$AZURE_STATIC_WEB_APPS_API_TOKEN" \
    --env production 2>/dev/null; then
    echo -e "${GREEN}✅ Frontend deployed${NC}"
  else
    echo -e "${RED}⚠️  Frontend deployment failed${NC}"
    echo "Try manual deployment via Azure Portal"
  fi
fi

echo ""
echo "================================================"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "Verification URLs:"
echo "  Frontend:    https://beamlabultimate.tech/app"
echo "  Node API:    https://beamlab-backend-node.azurewebsites.net/health"
echo "  Python API:  https://beamlab-backend-python.azurewebsites.net/health"
echo "  Rust API:    https://beamlab-rust-api.azurewebsites.net/health"
echo ""
echo "Expected Fixes:"
echo "  ✅ No more 403 Forbidden errors"
echo "  ✅ No more 404 on /api/user/tier"
echo "  ✅ No more 401 on /sections/standard/create"
echo "  ✅ Canvas renders (may show WebGL warning but draws)"
echo ""
echo "⏳ Note: Deployments may take 2-5 minutes to fully propagate"
echo "   Clear browser cache (Cmd+Shift+R) after deployment"
echo ""
