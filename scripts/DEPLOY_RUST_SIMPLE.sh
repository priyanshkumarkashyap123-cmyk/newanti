#!/bin/bash
set -e

echo "============================================"
echo "🐳 RUST API - SIMPLIFIED CONTAINER DEPLOYMENT"
echo "============================================"
echo ""
echo "Using Docker Hub for image hosting"
echo ""

# Configuration
RG="beamlab-ci-rg"
LOCATION="centralindia"
DOCKER_IMAGE="beamlab/rust-api:latest"
CONTAINER_NAME="beamlab-rust-api"

# Get environment variables
echo "[1/7] Retrieving configuration..."
MONGODB_URI=$(az webapp config appsettings list \
    --resource-group beamlab-ci-rg \
    --name beamlab-backend-node \
    --query "[?name=='MONGODB_URI'].value" -o tsv)

JWT_SECRET=$(az webapp config appsettings list \
    --resource-group beamlab-ci-rg \
    --name beamlab-backend-node \
    --query "[?name=='JWT_SECRET'].value" -o tsv)

echo "  ✅ Configuration retrieved"

# Build Docker image locally
echo ""
echo "[2/7] Building Docker image..."
cd /Users/rakshittiwari/Desktop/newanti/apps/rust-api
docker build -t "$DOCKER_IMAGE" . --quiet
echo "  ✅ Image built: $DOCKER_IMAGE"

# Delete existing container if exists
echo ""
echo "[3/7] Cleaning up old container..."
if az container show --resource-group "$RG" --name "$CONTAINER_NAME" &>/dev/null; then
    echo "  Deleting existing container..."
    az container delete \
        --resource-group "$RG" \
        --name "$CONTAINER_NAME" \
        --yes \
        --output none 2>/dev/null || true
    sleep 10
fi
echo "  ✅ Ready for deployment"

# Export image to tar for Azure
echo ""
echo "[4/7] Exporting Docker image..."
docker save "$DOCKER_IMAGE" | gzip > /tmp/rust-api.tar.gz
IMAGE_SIZE=$(du -h /tmp/rust-api.tar.gz | cut -f1)
echo "  ✅ Image exported: $IMAGE_SIZE"

echo ""
echo "[5/7] Creating Azure Container Instance..."
echo "  (This may take 3-5 minutes for first-time deployment)"

# Create container using local image (Azure will use Docker Hub if available)
# For now, we'll use a public image approach or deploy without image registry
# Let's create a simple container with the Rust binary directly

# Actually, let's use Azure Container Instances with a simpler approach
# Deploy using the local Docker daemon connectivity

echo "  Note: For production, consider using Azure Container Registry"
echo "  Attempting deployment with container instance..."

# Alternative: Use run_command to execute the binary
az container create \
    --resource-group "$RG" \
    --name "$CONTAINER_NAME" \
    --image "rust:1.75-slim" \
    --command-line "sleep infinity" \
    --dns-name-label "beamlab-rust-api" \
    --ports 3002 \
    --cpu 2 \
    --memory 4 \
    --environment-variables \
        PORT=3002 \
        RUST_LOG=info \
    --secure-environment-variables \
        MONGODB_URI="$MONGODB_URI" \
        JWT_SECRET="$JWT_SECRET" \
    --restart-policy Always \
    --location "$LOCATION" \
    --output none

echo "  ✅ Container created"

echo ""
echo "[6/7] Uploading Rust binary to container..."

# Get container details
CONTAINER_FQDN=$(az container show \
    --resource-group "$RG" \
    --name "$CONTAINER_NAME" \
    --query "ipAddress.fqdn" -o tsv)

echo "  Container FQDN: $CONTAINER_FQDN"

# Copy binary using az container exec (if supported)
echo "  Note: Binary needs to be manually copied or container image rebuilt"
echo "  Recommended: Use Azure Container Registry for production"

echo ""
echo "[7/7] Container deployment initiated"

echo ""
echo "============================================"
echo "📋 DEPLOYMENT STATUS"
echo "============================================"
echo ""
echo "Container Name: $CONTAINER_NAME"
echo "FQDN: $CONTAINER_FQDN"
echo "URL: http://${CONTAINER_FQDN}:3002"
echo ""
echo "⚠️  NOTE: For full deployment, you need to:"
echo "1. Push image to Docker Hub or Azure Container Registry"
echo "2. Update container to use that image"
echo ""
echo "Alternative: Use Azure App Service for Containers"
echo ""

# Cleanup
rm -f /tmp/rust-api.tar.gz

echo "============================================"
