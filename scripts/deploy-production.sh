#!/bin/bash
# ============================================
# BeamLab Production Deployment Configuration
# ============================================
# Complete Azure setup with Rust API integration
# Run: ./deploy-production.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 BeamLab Production Deployment Setup${NC}"
echo "========================================"
echo ""

# ============================================
# 1. VALIDATE CONFIGURATION
# ============================================

echo -e "${YELLOW}Step 1: Validating Configuration${NC}"

REQUIRED_VARS=(
    "AZURE_RESOURCE_GROUP"
    "AZURE_SUBSCRIPTION"
    "MONGODB_URI"
    "CLERK_SECRET_KEY"
    "GEMINI_API_KEY"
    "JWT_SECRET",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}❌ Missing required environment variable: $var${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ All required environment variables are set${NC}"
echo ""

# ============================================
# 2. CREATE/UPDATE AZURE RESOURCES
# ============================================

echo -e "${YELLOW}Step 2: Setting up Azure Resources${NC}"

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-beamlab-ci-rg}"
LOCATION="${AZURE_LOCATION:-eastus}"

echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo ""

# Create resource group if it doesn't exist
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    echo "Creating resource group..."
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
    echo -e "${GREEN}✅ Resource group created${NC}"
else
    echo -e "${GREEN}✅ Resource group exists${NC}"
fi

echo ""

# ============================================
# 3. CREATE/UPDATE RUST API APP SERVICE
# ============================================

echo -e "${YELLOW}Step 3: Setting up Rust API (Port 3002)${NC}"

RUST_API_APP="beamlab-rust-api"
RUST_API_PLAN="beamlab-rust-plan"

echo "App Service: $RUST_API_APP"
echo "App Service Plan: $RUST_API_PLAN"
echo ""

# Create App Service Plan if it doesn't exist
if ! az appservice plan show --name "$RUST_API_PLAN" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo "Creating App Service Plan for Rust API..."
    az appservice plan create \
        --name "$RUST_API_PLAN" \
        --resource-group "$RESOURCE_GROUP" \
        --sku B2 \
        --is-linux
    echo -e "${GREEN}✅ App Service Plan created${NC}"
else
    echo -e "${GREEN}✅ App Service Plan exists${NC}"
fi

echo ""

# Create Web App if it doesn't exist
if ! az webapp show --name "$RUST_API_APP" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo "Creating Web App for Rust API..."
    az webapp create \
        --name "$RUST_API_APP" \
        --resource-group "$RESOURCE_GROUP" \
        --plan "$RUST_API_PLAN" \
        --runtime "DOCKER|rust:1.75"
    echo -e "${GREEN}✅ Web App created${NC}"
else
    echo -e "${GREEN}✅ Web App exists${NC}"
fi

echo ""

# Configure Rust API settings
echo "Configuring Rust API settings..."
az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$RUST_API_APP" \
    --settings \
        RUST_API_PORT=8080 \
        MONGODB_URI="$MONGODB_URI" \
        JWT_SECRET="$JWT_SECRET" \
        RUST_LOG="beamlab_api=info,tower_http=info" \
        WEBSITES_PORT=8080

echo -e "${GREEN}✅ Rust API configured${NC}"
echo ""

# ============================================
# 4. UPDATE NODE.JS API APP SERVICE
# ============================================

echo -e "${YELLOW}Step 4: Setting up Node.js API (Port 3001)${NC}"

NODE_API_APP="beamlab-api"

echo "App Service: $NODE_API_APP"
echo ""

# Configure Node.js API settings
echo "Updating Node.js API settings..."
az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$NODE_API_APP" \
    --settings \
        PORT=8080 \
        NODE_ENV=production \
        CLERK_SECRET_KEY="$CLERK_SECRET_KEY" \
        MONGODB_URI="$MONGODB_URI" \
        FRONTEND_URL=https://beamlabultimate.tech \
        RUST_API_URL=https://${RUST_API_APP}.azurewebsites.net \
        PYTHON_API_URL=https://beamlab-backend-python.azurewebsites.net \
        RAZORPAY_KEY_ID="$RAZORPAY_KEY_ID" \
        RAZORPAY_KEY_SECRET="$RAZORPAY_KEY_SECRET" \
        RAZORPAY_WEBHOOK_SECRET="$RAZORPAY_WEBHOOK_SECRET"

echo -e "${GREEN}✅ Node.js API configured${NC}"
echo ""

# ============================================
# 5. UPDATE PYTHON API APP SERVICE
# ============================================

echo -e "${YELLOW}Step 5: Setting up Python API${NC}"

PYTHON_API_APP="beamlab-backend-python"

echo "App Service: $PYTHON_API_APP"
echo ""

# Configure Python API settings
echo "Updating Python API settings..."
az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$PYTHON_API_APP" \
    --settings \
        GEMINI_API_KEY="$GEMINI_API_KEY" \
        USE_MOCK_AI=false \
        FRONTEND_URL=https://beamlabultimate.tech \
        ALLOWED_ORIGINS="https://beamlabultimate.tech,https://www.beamlabultimate.tech" \
        NODE_API_URL=https://${NODE_API_APP}.azurewebsites.net

echo -e "${GREEN}✅ Python API configured${NC}"
echo ""

# ============================================
# 6. CONFIGURE FRONTEND
# ============================================

echo -e "${YELLOW}Step 6: Configuring Frontend${NC}"

cat > .env.production << EOF
# Frontend Production Configuration
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_PRODUCTION_KEY
VITE_API_URL=https://${NODE_API_APP}.azurewebsites.net
VITE_RUST_API_URL=https://${RUST_API_APP}.azurewebsites.net
VITE_PYTHON_API_URL=https://${PYTHON_API_APP}.azurewebsites.net
EOF

echo -e "${GREEN}✅ Frontend configuration created (.env.production)${NC}"
echo ""

# ============================================
# 7. BUILD AND DEPLOY RUST API
# ============================================

echo -e "${YELLOW}Step 7: Building Rust API${NC}"

cd apps/rust-api

if [ ! -f "target/release/beamlab-rust-api" ]; then
    echo "Building release binary..."
    cargo build --release
    echo -e "${GREEN}✅ Rust API built${NC}"
else
    echo -e "${GREEN}✅ Rust API binary exists${NC}"
fi

echo ""

# ============================================
# 8. PUSH TO AZURE CONTAINER REGISTRY
# ============================================

echo -e "${YELLOW}Step 8: Preparing Docker Image${NC}"

REGISTRY_NAME="beamlabregistry"
IMAGE_NAME="beamlab-rust-api"
IMAGE_TAG="latest"

echo "Registry: $REGISTRY_NAME"
echo "Image: $IMAGE_NAME:$IMAGE_TAG"
echo ""

# Build and push
echo "Building Docker image..."
docker build -t $REGISTRY_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG .
echo -e "${GREEN}✅ Docker image built${NC}"
echo ""

echo "Pushing to Azure Container Registry..."
az acr login --name $REGISTRY_NAME
docker push $REGISTRY_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG
echo -e "${GREEN}✅ Docker image pushed${NC}"
echo ""

# ============================================
# 9. DEPLOY RUST API TO APP SERVICE
# ============================================

echo -e "${YELLOW}Step 9: Deploying Rust API${NC}"

cd ..

az webapp config container set \
    --name "$RUST_API_APP" \
    --resource-group "$RESOURCE_GROUP" \
    --docker-custom-image-name "$REGISTRY_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG" \
    --docker-registry-server-url "https://$REGISTRY_NAME.azurecr.io" \
    --docker-registry-server-user "$(az acr credential show -n $REGISTRY_NAME --query username -o tsv)" \
    --docker-registry-server-password "$(az acr credential show -n $REGISTRY_NAME --query passwords[0].value -o tsv)"

echo -e "${GREEN}✅ Rust API deployed${NC}"
echo ""

# ============================================
# 10. BUILD AND DEPLOY FRONTEND
# ============================================

echo -e "${YELLOW}Step 10: Building Frontend${NC}"

cd apps/web

echo "Building frontend..."
pnpm build
echo -e "${GREEN}✅ Frontend built${NC}"
echo ""

echo -e "${YELLOW}Step 11: Deploying Frontend${NC}"

# Deploy to Azure Static Web Apps (if configured)
if command -v staticwebapp &> /dev/null; then
    echo "Deploying to Static Web Apps..."
    staticwebapp deploy \
        --app-location "dist" \
        --api-location "api" \
        --output-location "dist"
    echo -e "${GREEN}✅ Frontend deployed${NC}"
else
    echo "⚠️  Static Web Apps CLI not found. Deploy manually or use Azure Portal."
fi

echo ""

# ============================================
# 12. RESTART ALL SERVICES
# ============================================

echo -e "${YELLOW}Step 12: Restarting Services${NC}"

for app in "$RUST_API_APP" "$NODE_API_APP" "$PYTHON_API_APP"; do
    echo "Restarting $app..."
    az webapp restart --name "$app" --resource-group "$RESOURCE_GROUP"
done

echo -e "${GREEN}✅ All services restarted${NC}"
echo ""

# ============================================
# 13. VERIFY DEPLOYMENT
# ============================================

echo -e "${YELLOW}Step 13: Verifying Deployment${NC}"

echo "Waiting 30 seconds for services to start..."
sleep 30

RUST_API_URL="https://${RUST_API_APP}.azurewebsites.net"
NODE_API_URL="https://${NODE_API_APP}.azurewebsites.net"

echo "Checking Rust API health..."
RUST_STATUS=$(curl -s "$RUST_API_URL/health" || echo "error")
echo "Rust API: $RUST_STATUS"

echo ""
echo "Checking Node.js API health..."
NODE_STATUS=$(curl -s "$NODE_API_URL/health" || echo "error")
echo "Node.js API: $NODE_STATUS"

echo ""

# ============================================
# SUMMARY
# ============================================

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Production Deployment Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "🌐 URLs:"
echo "  Website: https://beamlabultimate.tech"
echo "  Rust API: $RUST_API_URL"
echo "  Node.js API: $NODE_API_URL"
echo ""
echo "📊 Next Steps:"
echo "  1. Verify analysis endpoints work"
echo "  2. Check performance metrics"
echo "  3. Review logs for errors"
echo "  4. Monitor usage patterns"
echo ""
echo "📝 Configuration saved to: .env.production"
echo ""
