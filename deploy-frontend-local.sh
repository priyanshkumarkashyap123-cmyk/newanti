#!/bin/bash
# =============================================================================
# Local Frontend Deploy to Azure Static Web Apps
# =============================================================================
# Deploys the frontend WITHOUT using any GitHub Actions minutes.
# Performs the same build steps as azure-static-web-apps-brave-mushroom workflow.
#
# Prerequisites:
#   npm install -g @azure/static-web-apps-cli
#   Set AZURE_STATIC_WEB_APPS_API_TOKEN env var or pass --deployment-token
# =============================================================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  BeamLab Frontend - Local Deploy to Azure SWA             ║${NC}"
echo -e "${BLUE}║  (Zero GitHub Actions minutes)                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
if ! command -v swa &> /dev/null; then
    echo -e "${RED}❌ Azure Static Web Apps CLI not found${NC}"
    echo "   Install: npm install -g @azure/static-web-apps-cli"
    exit 1
fi

if ! command -v wasm-pack &> /dev/null; then
    echo -e "${YELLOW}⚠️  wasm-pack not found - WASM modules must already be built${NC}"
fi

# Get deployment token
DEPLOY_TOKEN="${AZURE_STATIC_WEB_APPS_API_TOKEN:-}"
if [ -z "$DEPLOY_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  AZURE_STATIC_WEB_APPS_API_TOKEN not set${NC}"
    echo "   Get it from: Azure Portal → Static Web App → Manage deployment token"
    echo ""
    read -p "Paste deployment token (or Ctrl-C to cancel): " DEPLOY_TOKEN
    if [ -z "$DEPLOY_TOKEN" ]; then
        echo -e "${RED}❌ No token provided${NC}"
        exit 1
    fi
fi

echo ""

# Step 1: Build WASM modules if wasm-pack is available
if command -v wasm-pack &> /dev/null; then
    echo -e "${BLUE}🦀 Step 1/4: Building WASM modules...${NC}"
    
    if [ -d "apps/backend-rust" ]; then
        echo "   Building backend-rust WASM..."
        cd apps/backend-rust
        wasm-pack build --target web --out-dir ./pkg --release 2>&1 | tail -3
        cd ../..
    fi
    
    if [ -d "packages/solver-wasm" ]; then
        echo "   Building solver-wasm WASM..."
        cd packages/solver-wasm
        wasm-pack build --target web --out-dir ./pkg --release 2>&1 | tail -3
        cd ../..
    fi
    
    echo -e "${GREEN}   ✅ WASM build complete${NC}"
else
    echo -e "${YELLOW}⏭️  Step 1/4: Skipping WASM build (using existing .wasm files)${NC}"
fi

echo ""

# Step 2: Install dependencies
echo -e "${BLUE}📦 Step 2/4: Installing dependencies...${NC}"
pnpm install --no-frozen-lockfile 2>&1 | tail -3
echo -e "${GREEN}   ✅ Dependencies installed${NC}"

echo ""

# Step 3: Build frontend
echo -e "${BLUE}⚛️  Step 3/4: Building frontend...${NC}"
export NODE_OPTIONS="--max-old-space-size=8192"
export VITE_API_URL="https://beamlab-backend-node.azurewebsites.net"
export VITE_PYTHON_API_URL="https://beamlab-backend-python.azurewebsites.net"
export VITE_RUST_API_URL="https://beamlab-rust-api.azurewebsites.net"
export VITE_USE_CLERK="true"

# Check for Clerk key
if [ -z "${VITE_CLERK_PUBLISHABLE_KEY:-}" ]; then
    echo -e "${YELLOW}   ⚠️  VITE_CLERK_PUBLISHABLE_KEY not set - Clerk auth may not work${NC}"
    echo "   Set it with: export VITE_CLERK_PUBLISHABLE_KEY=pk_live_..."
fi

cd apps/web
pnpm run build 2>&1 | tail -5
cd ../..
echo -e "${GREEN}   ✅ Frontend built (apps/web/dist/)${NC}"

echo ""

# Step 4: Deploy
echo -e "${BLUE}🚀 Step 4/4: Deploying to Azure Static Web Apps...${NC}"
swa deploy apps/web/dist \
    --env production \
    --deployment-token "$DEPLOY_TOKEN" \
    2>&1

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Frontend deployed to https://beamlabultimate.tech     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Verify: curl -sI https://beamlabultimate.tech | head -5"
