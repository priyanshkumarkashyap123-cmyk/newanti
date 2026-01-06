#!/bin/bash
# ============================================
# Deploy Rust API to Azure Container Registry
# ============================================
# This script builds and pushes the Rust API to Azure
# Usage: ./deploy-rust-api.sh

set -e

REGISTRY_NAME="${CONTAINER_REGISTRY:-beamlabregistry}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-beamlab-ci-rg}"
APP_NAME="beamlab-rust-api"
IMAGE_NAME="beamlab-rust-api"
IMAGE_TAG="${1:-latest}"

echo "🦀 Deploying Rust API to Azure"
echo "================================"
echo ""
echo "Registry: $REGISTRY_NAME"
echo "App: $APP_NAME"
echo "Image: $IMAGE_NAME:$IMAGE_TAG"
echo ""

# ============================================
# 1. BUILD RUST RELEASE BINARY
# ============================================

echo "📦 Building Rust release binary..."
cd apps/rust-api

if [ ! -f "Cargo.lock" ]; then
    echo "Generating Cargo.lock..."
    cargo update
fi

cargo build --release --all

# Binary should be at target/release/beamlab-rust-api
if [ ! -f "target/release/beamlab-rust-api" ]; then
    echo "❌ Build failed: beamlab-rust-api binary not found"
    exit 1
fi

echo "✅ Binary built successfully"
echo ""

# ============================================
# 2. BUILD DOCKER IMAGE
# ============================================

echo "🐳 Building Docker image..."

# Make sure Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not found"
    exit 1
fi

docker build -t $REGISTRY_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG .

echo "✅ Docker image built"
echo ""

# ============================================
# 3. LOGIN TO AZURE
# ============================================

echo "🔐 Authenticating with Azure..."
az acr login --name $REGISTRY_NAME

echo "✅ Authenticated with Azure Container Registry"
echo ""

# ============================================
# 4. PUSH TO REGISTRY
# ============================================

echo "⬆️  Pushing image to registry..."
docker push $REGISTRY_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG

echo "✅ Image pushed successfully"
echo ""

# ============================================
# 5. DEPLOY TO APP SERVICE
# ============================================

echo "🚀 Deploying to App Service..."

# Get credentials for the registry
USERNAME=$(az acr credential show -n $REGISTRY_NAME --query username -o tsv)
PASSWORD=$(az acr credential show -n $REGISTRY_NAME --query passwords[0].value -o tsv)

# Configure the web app
az webapp config container set \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --docker-custom-image-name "$REGISTRY_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG" \
    --docker-registry-server-url "https://$REGISTRY_NAME.azurecr.io" \
    --docker-registry-server-user "$USERNAME" \
    --docker-registry-server-password "$PASSWORD"

echo "✅ Container configuration updated"
echo ""

# ============================================
# 6. APPLY SETTINGS
# ============================================

echo "⚙️  Applying application settings..."

az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --settings \
        WEBSITES_ENABLE_APP_SERVICE_STORAGE=false \
        WEBSITES_PORT=8080 \
        RUST_LOG="beamlab_api=info,tower_http=info"

echo "✅ Settings applied"
echo ""

# ============================================
# 7. RESTART SERVICE
# ============================================

echo "🔄 Restarting app service..."
az webapp restart --name "$APP_NAME" --resource-group "$RESOURCE_GROUP"

echo "✅ App service restarted"
echo ""

# ============================================
# 8. VERIFY DEPLOYMENT
# ============================================

echo "⏳ Waiting for service to start (60 seconds)..."
sleep 60

API_URL="https://${APP_NAME}.azurewebsites.net"

echo "🔍 Checking health endpoint..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")

if [ "$HEALTH" == "200" ]; then
    echo "✅ Service is running"
    echo ""
    curl -s "$API_URL/health" | jq '.'
else
    echo "⚠️  Health check returned HTTP $HEALTH"
    echo "Check logs: az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Service Information:"
echo "  URL: $API_URL"
echo "  Health: $API_URL/health"
echo "  Metrics: $API_URL/api/metrics"
echo ""
echo "📝 View logs:"
echo "  az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
echo ""
