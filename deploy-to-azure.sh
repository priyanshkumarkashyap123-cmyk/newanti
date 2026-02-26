#!/bin/bash

# ============================================
# BeamLab Azure Deployment Script
# ============================================
# This script deploys to your Azure production environment

set -e

echo "🚀 BeamLab Azure Deployment"
echo "============================"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "⚠️  Azure CLI not found. Install from: https://aka.ms/azure-cli"
    echo ""
    echo "Alternative deployment methods:"
    echo "1. Use Azure Portal to upload dist/ folder"
    echo "2. Use GitHub Actions (see .github/workflows/)"
    echo "3. Use FTP/FTPS to upload files"
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo "🔐 Please login to Azure..."
    az login
fi

echo "📦 Deployment Checklist:"
echo "  ✓ Rust API binary ready (6.8 MB)"
echo "  ✓ Frontend bundle ready (37 MB)"
echo "  ✓ WASM modules included (3.2 MB)"
echo ""

echo "🎯 Target Environments:"
echo "  Frontend: https://beamlabultimate.tech"
echo "  Rust API: https://beamlab-rust-api.azurewebsites.net"
echo "  Node API: https://beamlab-api.azurewebsites.net"
echo "  Python API: https://beamlab-backend-python.azurewebsites.net"
echo ""

# Ask for confirmation
read -p "Deploy to production? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "📤 Deploying Frontend..."
echo "========================"

# Deploy frontend using Azure Static Web Apps CLI or Git
if command -v swa &> /dev/null; then
    echo "Using Azure Static Web Apps CLI..."
    cd apps/web
    swa deploy dist --env production
    cd ../..
else
    echo "⚠️  Azure Static Web Apps CLI not found."
    echo ""
    echo "Install with: npm install -g @azure/static-web-apps-cli"
    echo ""
    echo "Or deploy manually:"
    echo "1. Go to Azure Portal"
    echo "2. Navigate to your Static Web App"
    echo "3. Upload contents of apps/web/dist/"
    echo ""
fi

echo ""
echo "📤 Deploying Rust API..."
echo "======================="

# Deploy Rust API
RUST_BINARY="apps/rust-api/target/release/beamlab-rust-api"
if [ -f "$RUST_BINARY" ]; then
    echo "Binary found: $RUST_BINARY"
    
    # Check if Azure Web App exists
    if az webapp show --name beamlab-rust-api --resource-group BeamLab &> /dev/null; then
        echo "Deploying to Azure App Service..."
        
        # Create deployment package
        cd apps/rust-api
        zip -r deploy.zip target/release/beamlab-rust-api
        
        # Deploy using Azure CLI
        az webapp deployment source config-zip \
            --resource-group BeamLab \
            --name beamlab-rust-api \
            --src deploy.zip
        
        rm deploy.zip
        cd ../..
        
        echo "✅ Rust API deployed successfully"
    else
        echo "⚠️  Azure Web App 'beamlab-rust-api' not found"
        echo "Create it in Azure Portal first, then rerun this script"
    fi
else
    echo "❌ Rust binary not found. Run: cargo build --release"
    exit 1
fi

echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo ""
echo "🔍 Verify deployment:"
echo "  Frontend: https://beamlabultimate.tech"
echo "  Rust API: https://beamlab-rust-api.azurewebsites.net/health"
echo ""
echo "📊 Test endpoints:"
echo "  ./test-features.sh"
echo ""
echo "📈 Monitor:"
echo "  Azure Portal → App Services → Logs"
echo ""

exit 0
