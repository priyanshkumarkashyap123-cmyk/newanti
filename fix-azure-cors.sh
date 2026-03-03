#!/bin/bash
# Quick fix for Azure Web App CORS configuration
# Run this script to configure CORS for all BeamLab backend services

set -e

echo "=================================================="
echo "BeamLab Azure CORS Configuration Fix"
echo "=================================================="

# Configuration
RESOURCE_GROUP="beamlab-rg"
NODE_API="beamlab-backend-node"
PYTHON_API="beamlab-backend-python"
RUST_API="beamlab-rust-api"

# Allowed origins
ORIGINS=(
    "https://beamlabultimate.tech"
    "https://www.beamlabultimate.tech"
    "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net"
    "http://localhost:5173"
)

echo ""
echo "This script will configure CORS for:"
echo "  - $NODE_API"
echo "  - $PYTHON_API"
echo "  - $RUST_API"
echo ""
echo "Allowed origins:"
for origin in "${ORIGINS[@]}"; do
    echo "  - $origin"
done
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Function to configure CORS for a web app
configure_cors() {
    local app_name=$1
    echo ""
    echo "Configuring CORS for $app_name..."
    
    # Clear existing CORS configuration
    echo "  - Clearing existing CORS settings..."
    az webapp cors remove \
        --resource-group "$RESOURCE_GROUP" \
        --name "$app_name" \
        --allowed-origins "*" \
        2>/dev/null || true
    
    # Add allowed origins
    echo "  - Adding allowed origins..."
    for origin in "${ORIGINS[@]}"; do
        az webapp cors add \
            --resource-group "$RESOURCE_GROUP" \
            --name "$app_name" \
            --allowed-origins "$origin"
    done
    
    # Enable credentials
    echo "  - Enabling credentials support..."
    az webapp config set \
        --resource-group "$RESOURCE_GROUP" \
        --name "$app_name" \
        --generic-configurations '{"cors":{"supportCredentials":true}}'
    
    echo "  ✅ CORS configured for $app_name"
}

# Configure each service
configure_cors "$NODE_API"
configure_cors "$PYTHON_API"
configure_cors "$RUST_API"

echo ""
echo "=================================================="
echo "Setting environment variables..."
echo "=================================================="

# Set environment variables for Node.js API
echo ""
echo "Setting environment for $NODE_API..."
az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$NODE_API" \
    --settings \
        NODE_ENV=production \
        PORT=8080 \
        FRONTEND_URL=https://beamlabultimate.tech \
        "CORS_ALLOWED_ORIGINS=https://beamlabultimate.tech,https://www.beamlabultimate.tech,https://brave-mushroom-0eae8ec00.4.azurestaticapps.net" \
        PYTHON_BACKEND_URL=https://beamlab-backend-python.azurewebsites.net \
        RUST_BACKEND_URL=https://beamlab-rust-api.azurewebsites.net

echo "✅ Environment configured for $NODE_API"

# Set environment variables for Python API
echo ""
echo "Setting environment for $PYTHON_API..."
az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$PYTHON_API" \
    --settings \
        ENV=production \
        FRONTEND_URL=https://beamlabultimate.tech \
        "ALLOWED_ORIGINS=https://beamlabultimate.tech,https://www.beamlabultimate.tech,https://brave-mushroom-0eae8ec00.4.azurestaticapps.net" \
        NODE_BACKEND_URL=https://beamlab-backend-node.azurewebsites.net \
        RUST_BACKEND_URL=https://beamlab-rust-api.azurewebsites.net

echo "✅ Environment configured for $PYTHON_API"

# Set environment variables for Rust API
echo ""
echo "Setting environment for $RUST_API..."
az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$RUST_API" \
    --settings \
        RUST_ENV=production \
        FRONTEND_URL=https://beamlabultimate.tech \
        "ALLOWED_ORIGINS=https://beamlabultimate.tech,https://www.beamlabultimate.tech,https://brave-mushroom-0eae8ec00.4.azurestaticapps.net" \
        NODE_BACKEND_URL=https://beamlab-backend-node.azurewebsites.net \
        PYTHON_BACKEND_URL=https://beamlab-backend-python.azurewebsites.net

echo "✅ Environment configured for $RUST_API"

echo ""
echo "=================================================="
echo "Restarting services..."
echo "=================================================="

# Restart all services
echo ""
echo "Restarting $NODE_API..."
az webapp restart --resource-group "$RESOURCE_GROUP" --name "$NODE_API"
echo "✅ $NODE_API restarted"

echo ""
echo "Restarting $PYTHON_API..."
az webapp restart --resource-group "$RESOURCE_GROUP" --name "$PYTHON_API"
echo "✅ $PYTHON_API restarted"

echo ""
echo "Restarting $RUST_API..."
az webapp restart --resource-group "$RESOURCE_GROUP" --name "$RUST_API"
echo "✅ $RUST_API restarted"

echo ""
echo "=================================================="
echo "✅ CORS Configuration Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Wait 30-60 seconds for apps to fully restart"
echo "2. Test CORS with:"
echo "   curl -I -H \"Origin: https://beamlabultimate.tech\" https://beamlab-backend-node.azurewebsites.net/health"
echo ""
echo "3. Check browser console for CORS errors"
echo "4. If still seeing errors, check application logs:"
echo "   az webapp log tail --name $NODE_API --resource-group $RESOURCE_GROUP"
echo ""
echo "Done!"
