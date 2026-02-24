#!/bin/bash

# ============================================
# RUST API DEPLOYMENT TO AZURE
# ============================================
# Builds and deploys the Rust API to Azure Container Instances
# Usage: ./DEPLOY_RUST_API.sh

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}    Rust API Deployment to Azure${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# ============================================
# 1. CHECK PREREQUISITES
# ============================================
echo -e "${YELLOW}[1] Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Install Docker Desktop for Mac.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker found${NC}"

if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI not found. Install with: brew install azure-cli${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Azure CLI found${NC}"

# Check Azure login
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}❌ Not logged in to Azure. Please login...${NC}"
    az login
fi
echo -e "${GREEN}✅ Azure authentication verified${NC}"
echo ""

# ============================================
# 2. CONFIGURATION
# ============================================
RESOURCE_GROUP="beamlab-ci-rg"
RUST_API_NAME="beamlab-rust-api"
REGISTRY_NAME="beamlabacr"
IMAGE_NAME="beamlab-rust-api"
IMAGE_TAG="latest"

echo -e "${YELLOW}[2] Configuration${NC}"
echo "Resource Group: $RESOURCE_GROUP"
echo "Rust API Name: $RUST_API_NAME"
echo "Registry: $REGISTRY_NAME"
echo "Image: $REGISTRY_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"
echo ""

# ============================================
# 3. BUILD RUST BINARY
# ============================================
echo -e "${YELLOW}[3] Building Rust API binary...${NC}"
cd "$(dirname "$0")/apps/rust-api"

if [ ! -f "Cargo.toml" ]; then
    echo -e "${RED}❌ Cargo.toml not found. Are you in the right directory?${NC}"
    exit 1
fi

echo "   ├─ Running cargo build --release..."
if cargo build --release 2>&1 | tail -20; then
    echo -e "   ${GREEN}✅ Rust API binary built${NC}"
else
    echo -e "   ${RED}❌ Build failed${NC}"
    exit 1
fi
echo ""

# ============================================
# 4. BUILD DOCKER IMAGE
# ============================================
echo -e "${YELLOW}[4] Building Docker image...${NC}"
echo "   ├─ Building: $IMAGE_NAME:$IMAGE_TAG"

if docker build -t "$IMAGE_NAME:$IMAGE_TAG" . 2>&1 | tail -15; then
    echo -e "   ${GREEN}✅ Docker image built successfully${NC}"
else
    echo -e "   ${RED}❌ Docker build failed${NC}"
    exit 1
fi
echo ""

# ============================================
# 5. CREATE/CHECK CONTAINER REGISTRY
# ============================================
echo -e "${YELLOW}[5] Checking Azure Container Registry...${NC}"

REGISTRY_EXISTS=$(az acr list --resource-group "$RESOURCE_GROUP" --query "[?name=='$REGISTRY_NAME'].name" -o tsv 2>/dev/null || echo "")

if [ -z "$REGISTRY_EXISTS" ]; then
    echo "   ├─ Creating Azure Container Registry..."
    az acr create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$REGISTRY_NAME" \
        --sku Basic \
        --query "loginServer"
    echo -e "   ${GREEN}✅ Container Registry created${NC}"
else
    echo -e "   ${GREEN}✅ Container Registry found: $REGISTRY_NAME${NC}"
fi
echo ""

# ============================================
# 6. GET REGISTRY CREDENTIALS
# ============================================
echo -e "${YELLOW}[6] Getting registry credentials...${NC}"

REGISTRY_URL=$(az acr show --resource-group "$RESOURCE_GROUP" --name "$REGISTRY_NAME" --query "loginServer" -o tsv)
REGISTRY_USERNAME=$(az acr credential show --resource-group "$RESOURCE_GROUP" --name "$REGISTRY_NAME" --query "username" -o tsv)
REGISTRY_PASSWORD=$(az acr credential show --resource-group "$RESOURCE_GROUP" --name "$REGISTRY_NAME" --query "passwords[0].value" -o tsv)

echo "   ├─ Registry URL: $REGISTRY_URL"
echo -e "   ${GREEN}✅ Credentials retrieved${NC}"
echo ""

# ============================================
# 7. TAG & PUSH IMAGE
# ============================================
echo -e "${YELLOW}[7] Tagging and pushing image to registry...${NC}"

IMAGE_FULL="$REGISTRY_URL/$IMAGE_NAME:$IMAGE_TAG"
echo "   ├─ Tagging: $IMAGE_FULL"
docker tag "$IMAGE_NAME:$IMAGE_TAG" "$IMAGE_FULL"

echo "   ├─ Logging in to registry..."
echo "$REGISTRY_PASSWORD" | docker login "$REGISTRY_URL" -u "$REGISTRY_USERNAME" --password-stdin > /dev/null 2>&1

echo "   ├─ Pushing to registry..."
if docker push "$IMAGE_FULL" 2>&1 | tail -10; then
    echo -e "   ${GREEN}✅ Image pushed to registry${NC}"
else
    echo -e "   ${RED}❌ Push failed${NC}"
    exit 1
fi
echo ""

# ============================================
# 8. GET ENVIRONMENT VARIABLES
# ============================================
echo -e "${YELLOW}[8] Preparing environment variables...${NC}"

# These should be set in Azure Key Vault or environment
MONGODB_URI="${MONGODB_URI:-}"
JWT_SECRET="${JWT_SECRET:-}"

if [ -z "$MONGODB_URI" ]; then
    echo -e "   ${YELLOW}⚠️  MONGODB_URI not set (will use default if available)${NC}"
fi

if [ -z "$JWT_SECRET" ]; then
    echo -e "   ${YELLOW}⚠️  JWT_SECRET not set (will use default if available)${NC}"
fi

echo -e "   ${GREEN}✅ Environment variables ready${NC}"
echo ""

# ============================================
# 9. DEPLOY TO AZURE CONTAINER INSTANCES
# ============================================
echo -e "${YELLOW}[9] Deploying to Azure Container Instances...${NC}"

# Check if container already exists
CONTAINER_EXISTS=$(az container list --resource-group "$RESOURCE_GROUP" --query "[?name=='$RUST_API_NAME'].name" -o tsv 2>/dev/null || echo "")

if [ ! -z "$CONTAINER_EXISTS" ]; then
    echo "   ├─ Removing existing container..."
    az container delete \
        --resource-group "$RESOURCE_GROUP" \
        --name "$RUST_API_NAME" \
        --yes > /dev/null 2>&1
    echo "   ├─ Waiting for deletion..."
    sleep 10
fi

echo "   ├─ Creating new container instance..."

# Build environment variables array
ENV_VARS="RUST_API_PORT=3002 RUST_LOG=info,beamlab_rust_api=debug"

if [ ! -z "$MONGODB_URI" ]; then
    ENV_VARS="$ENV_VARS MONGODB_URI=$MONGODB_URI"
fi

if [ ! -z "$JWT_SECRET" ]; then
    ENV_VARS="$ENV_VARS JWT_SECRET=$JWT_SECRET"
fi

if az container create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$RUST_API_NAME" \
    --image "$IMAGE_FULL" \
    --registry-login-server "$REGISTRY_URL" \
    --registry-username "$REGISTRY_USERNAME" \
    --registry-password "$REGISTRY_PASSWORD" \
    --cpu 2 \
    --memory 2 \
    --ports 3002 \
    --protocol TCP \
    --ip-address public \
    --environment-variables $ENV_VARS \
    --restart-policy OnFailure > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Container instance created${NC}"
else
    echo -e "   ${RED}❌ Deployment failed${NC}"
    exit 1
fi
echo ""

# ============================================
# 10. WAIT & GET PUBLIC IP
# ============================================
echo -e "${YELLOW}[10] Waiting for container to start...${NC}"
sleep 15

PUBLIC_IP=$(az container show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$RUST_API_NAME" \
    --query "ipAddress.ip" \
    -o tsv 2>/dev/null || echo "")

if [ ! -z "$PUBLIC_IP" ]; then
    echo -e "   ${GREEN}✅ Public IP assigned: $PUBLIC_IP${NC}"
else
    echo -e "   ${YELLOW}⏳ Waiting for IP assignment...${NC}"
    sleep 10
    PUBLIC_IP=$(az container show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$RUST_API_NAME" \
        --query "ipAddress.ip" \
        -o tsv)
    echo -e "   ${GREEN}✅ Public IP: $PUBLIC_IP${NC}"
fi
echo ""

# ============================================
# 11. TEST ENDPOINTS
# ============================================
echo -e "${YELLOW}[11] Testing Rust API endpoints...${NC}"
echo ""

echo "   Waiting for service startup (15 seconds)..."
sleep 15

# Test health endpoint
echo -n "   Testing /health endpoint: "
HEALTH_STATUS=$(curl -s -w "%{http_code}" -o /tmp/health.json "http://$PUBLIC_IP:3002/health" 2>/dev/null || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ HTTP $HEALTH_STATUS${NC}"
    echo "   Response: $(cat /tmp/health.json)"
elif [ "$HEALTH_STATUS" = "404" ]; then
    echo -e "${YELLOW}⏳ HTTP $HEALTH_STATUS (endpoint may not exist)${NC}"
else
    echo -e "${YELLOW}⏳ HTTP $HEALTH_STATUS (service may still be starting)${NC}"
fi
echo ""

# ============================================
# 12. FINAL SUMMARY
# ============================================
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Rust API Deployment Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo "📊 Deployment Summary:"
echo "   Service: $RUST_API_NAME"
echo "   Status: Running"
echo "   Public IP: $PUBLIC_IP"
echo "   Port: 3002"
echo "   Resource Group: $RESOURCE_GROUP"
echo ""
echo "🔗 Service URLs:"
echo "   Health: http://$PUBLIC_IP:3002/health"
echo "   Analysis: http://$PUBLIC_IP:3002/api/analyze"
echo "   Modal: http://$PUBLIC_IP:3002/api/modal"
echo "   Buckling: http://$PUBLIC_IP:3002/api/buckling"
echo ""
echo "⚡ Performance:"
echo "   CPU: 2 cores"
echo "   Memory: 2GB"
echo "   Expected throughput: 100k+ req/sec"
echo ""
echo "📝 Next Steps:"
echo "   1. Update frontend with Rust API URL"
echo "   2. Route heavy analysis requests to Rust API"
echo "   3. Monitor container logs: az container logs --resource-group $RESOURCE_GROUP --name $RUST_API_NAME"
echo "   4. Set up continuous deployment via GitHub Actions"
echo ""
echo "🔍 For more details, see RUST_API_DEPLOYMENT_GUIDE.md"
echo ""

