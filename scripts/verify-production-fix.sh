#!/bin/bash

# Verify WebGPU Fix on Production
# Run this after deployment completes (~5 minutes)

echo "🔍 Verifying WebGPU Fix on Production"
echo "======================================"
echo ""

PRODUCTION_URL="https://beamlabultimate.tech"
BACKUP_URL="https://brave-mushroom-0eae8ec00.4.azurestaticapps.net"

echo "📡 Checking if production site is accessible..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PRODUCTION_URL")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Production site is UP (HTTP $HTTP_CODE)"
    echo ""
    
    echo "🔍 Checking for WASM files..."
    curl -s "$PRODUCTION_URL" | grep -q "backend_rust_bg.*\.wasm"
    if [ $? -eq 0 ]; then
        echo "✅ Backend Rust WASM referenced in HTML"
    else
        echo "⚠️  Backend Rust WASM not found in HTML"
    fi
    
    curl -s "$PRODUCTION_URL" | grep -q "solver_wasm_bg.*\.wasm"
    if [ $? -eq 0 ]; then
        echo "✅ Solver WASM referenced in HTML"
    else
        echo "⚠️  Solver WASM not found in HTML"
    fi
    
    echo ""
    echo "📋 Next Steps:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "1. Open: $PRODUCTION_URL"
    echo "2. Press F12 to open DevTools Console"
    echo "3. Check for these SUCCESS indicators:"
    echo "   ✓ No 'Context Lost' errors"
    echo "   ✓ No 'maxInterStageShaderComponents' errors"
    echo "   ✓ WGPU device initialized"
    echo ""
    echo "4. Try creating a structural model:"
    echo "   • Add nodes"
    echo "   • Add beams"
    echo "   • Add loads"
    echo "   • Run analysis"
    echo "   • Check 3D visualization works"
    echo ""
else
    echo "❌ Production site returned HTTP $HTTP_CODE"
    echo "Trying backup URL: $BACKUP_URL"
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKUP_URL")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Backup site is UP (HTTP $HTTP_CODE)"
        echo "Wait a few minutes for custom domain to propagate"
    else
        echo "❌ Both sites are down. Check GitHub Actions for deployment errors."
    fi
fi

echo ""
echo "🔗 Useful Links:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Production:      $PRODUCTION_URL"
echo "Backup URL:      $BACKUP_URL"
echo "GitHub Actions:  https://github.com/rakshittiwari048-ship-it/newanti/actions"
echo "Azure Portal:    https://portal.azure.com"
echo ""
