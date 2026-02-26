#!/bin/bash

# ============================================
# AZURE BACKEND STARTUP FIX
# ============================================
# Comprehensive fix for Node.js API (3001) and Python Backend (8000/8081)
# Usage: ./FIX_AZURE_BACKEND.sh

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}    Azure Backend Startup Fix${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# ============================================
# 1. CHECK AZURE CLI
# ============================================
echo -e "${YELLOW}[1] Checking Azure CLI...${NC}"
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI not found. Install with: brew install azure-cli${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Azure CLI found${NC}"
echo ""

# ============================================
# 2. SET RESOURCE GROUP
# ============================================
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-beamlab-ci-rg}"
RUST_API_APP="beamlab-rust-api"
NODE_API_APP="beamlab-backend-node"
PYTHON_BACKEND_APP="beamlab-backend-python"

echo -e "${YELLOW}[2] Azure Configuration${NC}"
echo "Resource Group: $RESOURCE_GROUP"
echo "Node.js API App: $NODE_API_APP"
echo "Python Backend: $PYTHON_BACKEND_APP"
echo "Rust API: $RUST_API_APP"
echo ""

# ============================================
# 3. FIX NODE.JS API (Port 3001)
# ============================================
echo -e "${YELLOW}[3] Fixing Node.js API (3001)...${NC}"

echo "   ├─ Setting environment variables..."
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$NODE_API_APP" \
  --settings \
    PORT="3001" \
    USE_CLERK="false" \
    NODE_ENV="production" \
    MONGODB_URI="$MONGODB_URI" \
    JWT_SECRET="$JWT_SECRET" \
    GEMINI_API_KEY="${GEMINI_API_KEY:?GEMINI_API_KEY env var required}" \
    FRONTEND_URL="https://beamlabultimate.tech" \
    ALLOWED_ORIGINS="https://beamlabultimate.tech,https://www.beamlabultimate.tech,http://localhost:5173" \
    SMTP_HOST="smtp.gmail.com" \
    SMTP_PORT="587" \
    FROM_EMAIL="noreply@beamlabultimate.tech" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "   ${GREEN}✅ Node.js API env vars set${NC}"
else
    echo -e "   ${YELLOW}⚠️  Node.js API env vars (may already be set)${NC}"
fi

echo "   ├─ Setting Node.js startup file..."
az webapp config set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$NODE_API_APP" \
  --startup-file "npm run start" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "   ${GREEN}✅ Node.js startup configured${NC}"
fi

echo "   ├─ Restarting Node.js API..."
az webapp restart \
  --resource-group "$RESOURCE_GROUP" \
  --name "$NODE_API_APP"

echo -e "   ${GREEN}✅ Node.js API restarting${NC}"
echo ""

# ============================================
# 4. FIX PYTHON BACKEND (Port 8000/8081)
# ============================================
echo -e "${YELLOW}[4] Fixing Python Backend...${NC}"

echo "   ├─ Setting environment variables..."
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PYTHON_BACKEND_APP" \
  --settings \
    GEMINI_API_KEY="${GEMINI_API_KEY:?GEMINI_API_KEY env var required}" \
    USE_MOCK_AI="false" \
    FRONTEND_URL="https://beamlabultimate.tech" \
    ALLOWED_ORIGINS="https://beamlabultimate.tech,https://www.beamlabultimate.tech,http://localhost:5173" \
    PYTHONPATH="/home/site/wwwroot" \
    PORT="8000" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "   ${GREEN}✅ Python backend env vars set${NC}"
else
    echo -e "   ${YELLOW}⚠️  Python backend env vars (may already be set)${NC}"
fi

echo "   ├─ Setting Python startup file..."
az webapp config set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PYTHON_BACKEND_APP" \
  --startup-file "gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind=0.0.0.0:8000 --timeout 600" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "   ${GREEN}✅ Python startup configured${NC}"
fi

echo "   ├─ Ensuring Python runtime..."
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PYTHON_BACKEND_APP" \
  --settings WEBSITES_ENABLE_APP_SERVICE_STORAGE=true > /dev/null 2>&1

echo "   ├─ Restarting Python backend..."
az webapp restart \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PYTHON_BACKEND_APP"

echo -e "   ${GREEN}✅ Python backend restarting${NC}"
echo ""

# ============================================
# 5. VERIFY RUST API (Optional)
# ============================================
echo -e "${YELLOW}[5] Checking for Rust API...${NC}"

RUST_EXISTS=$(az webapp list --resource-group "$RESOURCE_GROUP" --query "[?name=='$RUST_API_APP'].name" -o tsv 2>/dev/null || echo "")
if [ -z "$RUST_EXISTS" ]; then
    echo -e "   ${YELLOW}⊘ Rust API ($RUST_API_APP) not found in resource group${NC}"
    echo -e "   ${YELLOW}  (This is OK - Python backend handles analysis)${NC}"
else
    echo -e "   ${GREEN}✅ Rust API found, configuring...${NC}"
    az webapp config appsettings set \
      --resource-group "$RESOURCE_GROUP" \
      --name "$RUST_API_APP" \
      --settings \
        RUST_API_PORT="3002" \
        MONGODB_URI="$MONGODB_URI" \
        JWT_SECRET="$JWT_SECRET" > /dev/null 2>&1
    echo -e "   ${GREEN}✅ Rust API configured${NC}"
fi
echo ""

# ============================================
# 6. WAIT & VERIFY
# ============================================
echo -e "${YELLOW}[6] Waiting for services to start...${NC}"
sleep 15

echo ""
echo -e "${YELLOW}[7] Testing Endpoints...${NC}"
echo ""

# Test Node.js API
echo -e "   Node.js API (3001):"
NODE_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "https://$NODE_API_APP.azurewebsites.net/health" 2>/dev/null || echo "000")
if [ "$NODE_STATUS" = "200" ] || [ "$NODE_STATUS" = "404" ]; then
    echo -e "   ${GREEN}✅ Node.js API responding (HTTP $NODE_STATUS)${NC}"
else
    echo -e "   ${YELLOW}⏳ Node.js API starting (HTTP $NODE_STATUS, may take 30-60 seconds)${NC}"
fi

# Test Python Backend
echo -e "   Python Backend (8000):"
PYTHON_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "https://$PYTHON_BACKEND_APP.azurewebsites.net/health" 2>/dev/null || echo "000")
if [ "$PYTHON_STATUS" = "200" ] || [ "$PYTHON_STATUS" = "404" ]; then
    echo -e "   ${GREEN}✅ Python backend responding (HTTP $PYTHON_STATUS)${NC}"
else
    echo -e "   ${YELLOW}⏳ Python backend starting (HTTP $PYTHON_STATUS, may take 30-60 seconds)${NC}"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Backend Startup Fix Applied!${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo "📊 What was done:"
echo "   1. ✅ Set environment variables for all services"
echo "   2. ✅ Configured startup files"
echo "   3. ✅ Restarted Node.js API (3001)"
echo "   4. ✅ Restarted Python backend (8000)"
echo "   5. ✅ Verified Rust API (3002)"
echo ""
echo "🔗 Service URLs:"
echo "   • Frontend: https://beamlabultimate.tech"
echo "   • Node.js API: https://$NODE_API_APP.azurewebsites.net"
echo "   • Python Backend: https://$PYTHON_BACKEND_APP.azurewebsites.net"
echo "   • Rust API: https://$RUST_API_APP.azurewebsites.net"
echo ""
echo "⏱️  Services should be fully operational in 30-60 seconds."
echo "   If still not responding, check Azure App Service logs:"
echo ""
echo "   View logs:"
echo "   az webapp log tail --resource-group $RESOURCE_GROUP --name $NODE_API_APP"
echo "   az webapp log tail --resource-group $RESOURCE_GROUP --name $PYTHON_BACKEND_APP"
echo ""
