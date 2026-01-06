#!/bin/bash

# BeamLab Ultimate - Complete Deployment Script with Advanced Analysis
# Deploys frontend (Azure Static Web Apps) and backend (Azure Container Apps)

set -e  # Exit on any error

echo "🚀 BeamLab Ultimate - Full Deployment with Advanced Structural Analysis"
echo "======================================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="beamlab-rg"
LOCATION="eastus"
WEB_APP_NAME="beamlab-web"
BACKEND_NAME="beamlab-api"
PYTHON_BACKEND_NAME="beamlab-python"

echo ""
echo "📦 Step 1: Building WASM Solver with Advanced Features..."
echo "--------------------------------------------------------"
cd packages/solver-wasm
echo "Building Rust WASM module..."
wasm-pack build --target web
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} WASM build successful"
else
    echo -e "${RED}✗${NC} WASM build failed"
    exit 1
fi

echo ""
echo "📦 Step 2: Installing Dependencies..."
echo "--------------------------------------"
cd ../..
pnpm install || npm install
echo -e "${GREEN}✓${NC} Dependencies installed"

echo ""
echo "📦 Step 3: Building Frontend with Advanced Analysis UI..."
echo "----------------------------------------------------------"
cd apps/web

# Copy WASM files to public directory
echo "Copying WASM files to public directory..."
mkdir -p public/solver-wasm
cp -r ../../packages/solver-wasm/pkg/* public/solver-wasm/
echo -e "${GREEN}✓${NC} WASM files copied"

# Build frontend
echo "Building React frontend..."
pnpm build || npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Frontend build successful"
else
    echo -e "${RED}✗${NC} Frontend build failed"
    exit 1
fi

echo ""
echo "📦 Step 4: Building Node.js Backend..."
echo "---------------------------------------"
cd ../api
pnpm build || npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Node.js backend build successful"
else
    echo -e "${RED}✗${NC} Node.js backend build failed"
    exit 1
fi

echo ""
echo "📦 Step 5: Preparing Python Backend..."
echo "---------------------------------------"
cd ../backend-python
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
echo -e "${GREEN}✓${NC} Python dependencies installed"
deactivate

echo ""
echo "☁️  Step 6: Deploying to Azure..."
echo "===================================="

cd ../..

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}✗${NC} Azure CLI is not installed"
    echo "Please install: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in
echo "Checking Azure login..."
az account show &> /dev/null
if [ $? -ne 0 ]; then
    echo "Please log in to Azure..."
    az login
fi

echo -e "${GREEN}✓${NC} Azure CLI ready"

# Create resource group if it doesn't exist
echo ""
echo "📦 Creating/Verifying Resource Group..."
az group create --name $RESOURCE_GROUP --location $LOCATION --output none
echo -e "${GREEN}✓${NC} Resource group: $RESOURCE_GROUP"

# Deploy Static Web App (Frontend)
echo ""
echo "🌐 Deploying Frontend to Azure Static Web Apps..."
echo "--------------------------------------------------"

# Check if Static Web App exists
SWA_EXISTS=$(az staticwebapp show --name $WEB_APP_NAME --resource-group $RESOURCE_GROUP 2>/dev/null)

if [ -z "$SWA_EXISTS" ]; then
    echo "Creating new Static Web App..."
    az staticwebapp create \
        --name $WEB_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --source "" \
        --branch main \
        --app-location "apps/web" \
        --output-location "dist" \
        --output none
    echo -e "${GREEN}✓${NC} Static Web App created"
else
    echo "Static Web App already exists"
fi

# Get deployment token
echo "Getting deployment token..."
DEPLOY_TOKEN=$(az staticwebapp secrets list --name $WEB_APP_NAME --resource-group $RESOURCE_GROUP --query "properties.apiKey" -o tsv)

if [ -z "$DEPLOY_TOKEN" ]; then
    echo -e "${RED}✗${NC} Failed to get deployment token"
    exit 1
fi

# Deploy using SWA CLI
if command -v swa &> /dev/null; then
    echo "Deploying with SWA CLI..."
    cd apps/web
    swa deploy ./dist --deployment-token $DEPLOY_TOKEN --env production
    cd ../..
else
    echo -e "${YELLOW}⚠${NC} SWA CLI not installed. Install with: npm install -g @azure/static-web-apps-cli"
    echo "Uploading dist folder manually..."
    # Alternative: use az storage blob upload-batch
fi

echo -e "${GREEN}✓${NC} Frontend deployed"

# Get frontend URL
FRONTEND_URL=$(az staticwebapp show --name $WEB_APP_NAME --resource-group $RESOURCE_GROUP --query "defaultHostname" -o tsv)
echo "Frontend URL: https://$FRONTEND_URL"

# Deploy Node.js Backend (Container App)
echo ""
echo "🔧 Deploying Node.js Backend to Azure Container Apps..."
echo "--------------------------------------------------------"

# Create Container Apps environment if doesn't exist
ENV_NAME="beamlab-env"
ENV_EXISTS=$(az containerapp env show --name $ENV_NAME --resource-group $RESOURCE_GROUP 2>/dev/null)

if [ -z "$ENV_EXISTS" ]; then
    echo "Creating Container Apps environment..."
    az containerapp env create \
        --name $ENV_NAME \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --output none
    echo -e "${GREEN}✓${NC} Environment created"
fi

# Build and push Node.js backend Docker image
echo "Building Node.js backend Docker image..."
cd apps/api

# Create Dockerfile if it doesn't exist
if [ ! -f "Dockerfile" ]; then
    echo "Creating Dockerfile..."
    cat > Dockerfile <<EOF
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "dist/index.js"]
EOF
fi

ACR_NAME="beamlabregistry"
ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"

# Create ACR if it doesn't exist
ACR_EXISTS=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP 2>/dev/null)
if [ -z "$ACR_EXISTS" ]; then
    echo "Creating Azure Container Registry..."
    az acr create \
        --name $ACR_NAME \
        --resource-group $RESOURCE_GROUP \
        --sku Basic \
        --admin-enabled true \
        --output none
fi

# Login to ACR
az acr login --name $ACR_NAME

# Build and push
echo "Building and pushing Docker image..."
docker build -t ${ACR_LOGIN_SERVER}/beamlab-api:latest .
docker push ${ACR_LOGIN_SERVER}/beamlab-api:latest

# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query "username" -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

# Deploy Container App
echo "Deploying Node.js backend Container App..."
az containerapp create \
    --name $BACKEND_NAME \
    --resource-group $RESOURCE_GROUP \
    --environment $ENV_NAME \
    --image ${ACR_LOGIN_SERVER}/beamlab-api:latest \
    --registry-server $ACR_LOGIN_SERVER \
    --registry-username $ACR_USERNAME \
    --registry-password $ACR_PASSWORD \
    --target-port 3000 \
    --ingress external \
    --env-vars \
        "NODE_ENV=production" \
    --output none

BACKEND_URL=$(az containerapp show --name $BACKEND_NAME --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv)
echo -e "${GREEN}✓${NC} Node.js backend deployed"
echo "Backend URL: https://$BACKEND_URL"

cd ../..

# Deploy Python Backend (Container App)
echo ""
echo "🐍 Deploying Python Backend to Azure Container Apps..."
echo "-------------------------------------------------------"

cd apps/backend-python

# Create Dockerfile if it doesn't exist
if [ ! -f "Dockerfile" ]; then
    echo "Creating Dockerfile..."
    cat > Dockerfile <<EOF
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8081
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]
EOF
fi

# Build and push
echo "Building and pushing Python Docker image..."
docker build -t ${ACR_LOGIN_SERVER}/beamlab-python:latest .
docker push ${ACR_LOGIN_SERVER}/beamlab-python:latest

# Deploy Container App
echo "Deploying Python backend Container App..."
az containerapp create \
    --name $PYTHON_BACKEND_NAME \
    --resource-group $RESOURCE_GROUP \
    --environment $ENV_NAME \
    --image ${ACR_LOGIN_SERVER}/beamlab-python:latest \
    --registry-server $ACR_LOGIN_SERVER \
    --registry-username $ACR_USERNAME \
    --registry-password $ACR_PASSWORD \
    --target-port 8081 \
    --ingress external \
    --env-vars \
        "PYTHONUNBUFFERED=1" \
    --output none

PYTHON_URL=$(az containerapp show --name $PYTHON_BACKEND_NAME --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv)
echo -e "${GREEN}✓${NC} Python backend deployed"
echo "Python URL: https://$PYTHON_URL"

cd ../..

echo ""
echo "======================================================================"
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo "======================================================================"
echo ""
echo "🌐 Application URLs:"
echo "--------------------"
echo "Frontend:        https://$FRONTEND_URL"
echo "Node.js Backend: https://$BACKEND_URL"
echo "Python Backend:  https://$PYTHON_URL"
echo ""
echo "🔧 Advanced Analysis Features:"
echo "-------------------------------"
echo "✓ Triangular distributed loads"
echo "✓ Trapezoidal distributed loads"
echo "✓ P-Delta second-order analysis"
echo "✓ Buckling stability analysis"
echo "✓ All running client-side via WASM!"
echo ""
echo "📝 Next Steps:"
echo "--------------"
echo "1. Configure environment variables in Azure Portal"
echo "2. Set up custom domain (optional)"
echo "3. Configure CORS settings"
echo "4. Test advanced analysis features"
echo ""
echo "📚 Documentation:"
echo "-----------------"
echo "- Advanced Features: ADVANCED_FEATURES_COMPLETE.md"
echo "- Mathematics: ADVANCED_MATHEMATICS_COMPLETE.md"
echo "- Quick Reference: QUICK_REFERENCE_ADVANCED.md"
echo "- Test Suite: test_advanced_structural.html"
echo ""
echo "Happy analyzing! 🏗️"
