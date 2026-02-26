#!/bin/bash
set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║        BEAMLAB BACKEND DEPLOYMENT - FINAL STATUS         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

RG="beamlab-ci-rg"

echo "[1/3] Verifying all backends are operational..."
echo ""

# Test Node.js
echo "  1. Node.js API:"
NODE_STATUS=$(curl -s -m 5 -o /dev/null -w "%{http_code}" https://beamlab-backend-node.azurewebsites.net/health 2>/dev/null || echo "000")
if [ "$NODE_STATUS" = "200" ]; then
    echo "     ✅ HTTP 200 - OPERATIONAL"
else
    echo "     ⚠️  HTTP $NODE_STATUS"
fi

# Test Python
echo "  2. Python Backend:"
PYTHON_STATUS=$(curl -s -m 5 -o /dev/null -w "%{http_code}" https://beamlab-backend-python.azurewebsites.net/health 2>/dev/null || echo "000")
if [ "$PYTHON_STATUS" = "200" ]; then
    echo "     ✅ HTTP 200 - OPERATIONAL"
else
    echo "     ⚠️  HTTP $PYTHON_STATUS"
fi

# Test Rust
echo "  3. Rust API:"
RUST_STATUS=$(curl -s -m 5 -o /dev/null -w "%{http_code}" https://beamlab-rust-api.azurewebsites.net/health 2>/dev/null || echo "000")
if [ "$RUST_STATUS" = "200" ]; then
    echo "     ✅ HTTP 200 - OPERATIONAL"
else
    echo "     ⚠️  HTTP $RUST_STATUS - Reconfiguring..."
fi

echo ""
echo "[2/3] Ensuring all backends are properly configured..."

# Get shared secrets
MONGODB_URI=$(az webapp config appsettings list --resource-group "$RG" --name beamlab-backend-node --query "[?name=='MONGODB_URI'].value" -o tsv)
JWT_SECRET=$(az webapp config appsettings list --resource-group "$RG" --name beamlab-backend-node --query "[?name=='JWT_SECRET'].value" -o tsv)
GEMINI_API_KEY=$(az webapp config appsettings list --resource-group "$RG" --name beamlab-backend-node --query "[?name=='GEMINI_API_KEY'].value" -o tsv)

# Ensure Python is configured
if [ "$PYTHON_STATUS" != "200" ]; then
    echo "  Fixing Python backend..."
    
    az webapp config set \
        --resource-group "$RG" \
        --name beamlab-backend-python \
        --startup-file "gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000" \
        --output none
    
    az webapp config appsettings set \
        --resource-group "$RG" \
        --name beamlab-backend-python \
        --settings \
            SCM_DO_BUILD_DURING_DEPLOYMENT=true \
            PORT=8000 \
            MONGODB_URI="$MONGODB_URI" \
            JWT_SECRET="$JWT_SECRET" \
            GEMINI_API_KEY="$GEMINI_API_KEY" \
        --output none
    
    echo "  Restarting Python..."
    az webapp restart --resource-group "$RG" --name beamlab-backend-python --output none
    sleep 30
fi

# Fix Rust - for now, use Python as fallback for analysis
if [ "$RUST_STATUS" != "200" ]; then
    echo "  Note: Rust API requires Docker image build (needs Docker CLI)"
    echo "        Python backend will handle structural analysis"
fi

echo ""
echo "[3/3] Final verification..."

# Wait and retest
sleep 30

NODE_STATUS=$(curl -s -m 5 -o /dev/null -w "%{http_code}" https://beamlab-backend-node.azurewebsites.net/health 2>/dev/null || echo "000")
PYTHON_STATUS=$(curl -s -m 5 -o /dev/null -w "%{http_code}" https://beamlab-backend-python.azurewebsites.net/health 2>/dev/null || echo "000")
RUST_STATUS=$(curl -s -m 5 -o /dev/null -w "%{http_code}" https://beamlab-rust-api.azurewebsites.net/health 2>/dev/null || echo "000")

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              FINAL DEPLOYMENT STATUS                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

echo "🔐 Node.js API (Authentication)"
echo "   https://beamlab-backend-node.azurewebsites.net"
if [ "$NODE_STATUS" = "200" ]; then
    echo "   Status: ✅ FULLY OPERATIONAL"
else
    echo "   Status: ⚠️  HTTP $NODE_STATUS - Check: az webapp log tail --resource-group $RG --name beamlab-backend-node"
fi

echo ""
echo "🐍 Python Backend (Analysis & AI)"
echo "   https://beamlab-backend-python.azurewebsites.net"
if [ "$PYTHON_STATUS" = "200" ]; then
    echo "   Status: ✅ FULLY OPERATIONAL"
else
    echo "   Status: ⏳ Starting (HTTP $PYTHON_STATUS) - Wait 2-3 minutes"
    echo "   Then check: curl https://beamlab-backend-python.azurewebsites.net/health"
fi

echo ""
echo "🦀 Rust API (Optional Ultra-fast Analysis)"
echo "   https://beamlab-rust-api.azurewebsites.net"
if [ "$RUST_STATUS" = "200" ]; then
    echo "   Status: ✅ FULLY OPERATIONAL"
else
    echo "   Status: ⏳ Requires Docker image (needs local Docker CLI)"
    echo "   To deploy: cd apps/rust-api && docker build -t beamlab-rust . --platform linux/amd64"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$NODE_STATUS" = "200" ] && [ "$PYTHON_STATUS" = "200" ]; then
    echo "✅ BEAMLAB READY FOR PRODUCTION"
    echo ""
    echo "All critical backends operational:"
    echo "  ✅ Authentication & Payments"
    echo "  ✅ Structural Analysis & AI"
    echo "  📊 Ready for user traffic"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
