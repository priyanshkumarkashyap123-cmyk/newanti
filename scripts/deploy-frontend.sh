#!/bin/bash
# ============================================
# Deploy Frontend to Azure Static Web Apps
# ============================================
# This script builds and deploys the frontend
# Usage: ./deploy-frontend.sh [environment]

set -e

ENVIRONMENT="${1:-production}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-beamlab-ci-rg}"
APP_NAME="beamlab-web"
REGISTRY_NAME="${CONTAINER_REGISTRY:-beamlabregistry}"

echo "🌐 Deploying Frontend ($ENVIRONMENT)"
echo "======================================"
echo ""

# ============================================
# 1. VALIDATE ENVIRONMENT
# ============================================

if [ "$ENVIRONMENT" == "production" ]; then
    ENV_FILE=".env.production"
    if [ ! -f "apps/web/$ENV_FILE" ]; then
        echo "❌ $ENV_FILE not found"
        exit 1
    fi
else
    ENV_FILE=".env.$ENVIRONMENT"
fi

echo "Using environment: $ENVIRONMENT"
echo "Config file: $ENV_FILE"
echo ""

# ============================================
# 2. BUILD FRONTEND
# ============================================

echo "📦 Building frontend..."
cd apps/web

# Copy environment file
cp "../..$ENV_FILE" .env

# Build
pnpm install
pnpm build

if [ ! -d "dist" ]; then
    echo "❌ Build failed: dist directory not created"
    exit 1
fi

echo "✅ Frontend built successfully"
echo ""

# ============================================
# 3. VALIDATE BUILD
# ============================================

echo "🔍 Validating build..."

# Check for main files
if [ ! -f "dist/index.html" ]; then
    echo "❌ index.html not found in dist"
    exit 1
fi

echo "✅ Build validation passed"
echo ""

# ============================================
# 4. PREPARE DEPLOYMENT PACKAGE
# ============================================

echo "📦 Preparing deployment package..."

# Create deployment manifest
cat > dist/deployment-manifest.json << EOF
{
  "version": "1.0.0",
  "environment": "$ENVIRONMENT",
  "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "rustApiUrl": "$VITE_RUST_API_URL",
  "nodeApiUrl": "$VITE_API_URL",
  "pythonApiUrl": "$VITE_PYTHON_API_URL"
}
EOF

echo "✅ Deployment package ready"
echo ""

# ============================================
# 5. BUILD DOCKER IMAGE (Optional)
# ============================================

echo "🐳 Building frontend Docker image..."

cat > Dockerfile.frontend << 'EOF'
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Runtime stage
FROM nginx:alpine

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf
COPY dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF

docker build -t $REGISTRY_NAME.azurecr.io/beamlab-web:$ENVIRONMENT -f Dockerfile.frontend .

echo "✅ Docker image built"
echo ""

# ============================================
# 6. PUSH TO REGISTRY
# ============================================

echo "⬆️  Pushing image to registry..."
az acr login --name $REGISTRY_NAME
docker push $REGISTRY_NAME.azurecr.io/beamlab-web:$ENVIRONMENT

echo "✅ Image pushed"
echo ""

# ============================================
# 7. DEPLOY VIA STATIC WEB APPS (Primary)
# ============================================

echo "🚀 Deploying to Azure Static Web Apps..."

# Note: This requires Azure Static Web Apps CLI to be installed
# Install with: npm install -g @azure/static-web-apps-cli

if command -v swa &> /dev/null; then
    echo "Using Static Web Apps CLI..."
    swa deploy ./dist \
        --app-location ./dist \
        --output-location ./dist \
        --env production
    
    echo "✅ Deployed via Static Web Apps"
else
    echo "⚠️  Static Web Apps CLI not installed"
    echo "Install with: npm install -g @azure/static-web-apps-cli"
    echo ""
    echo "Alternative: Deploy via Azure Portal or use web app deployment:"
fi

echo ""

# ============================================
# 8. DEPLOY VIA APP SERVICE (Fallback)
# ============================================

if [ -z "$SKIP_APPSERVICE_DEPLOY" ]; then
    echo "📱 Deploying to App Service (fallback)..."
    
    if ! az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        echo "⚠️  App Service $APP_NAME not found, skipping..."
    else
        # Create deployment package
        zip -r deployment.zip dist/ -x "*.git*"
        
        # Deploy
        az webapp deployment source config-zip \
            --resource-group "$RESOURCE_GROUP" \
            --name "$APP_NAME" \
            --src deployment.zip
        
        rm deployment.zip
        echo "✅ Deployed via App Service"
    fi
fi

echo ""

# ============================================
# 9. VERIFY DEPLOYMENT
# ============================================

echo "⏳ Waiting for deployment to complete (30 seconds)..."
sleep 30

echo "🔍 Verifying frontend..."

# Get the frontend URL
FRONTEND_URL="https://beamlabultimate.tech"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")

if [ "$HTTP_STATUS" == "200" ]; then
    echo "✅ Frontend is accessible"
    echo ""
    
    # Check if API configuration is correct
    echo "🔍 Checking API configuration..."
    
    # Look for environment variables in the HTML
    if grep -q "VITE_RUST_API_URL" dist/index.html 2>/dev/null || grep -q "rust-api" dist/*.js 2>/dev/null; then
        echo "✅ Rust API configured"
    fi
else
    echo "⚠️  Frontend returned HTTP $HTTP_STATUS"
fi

echo ""

# ============================================
# 10. SUMMARY
# ============================================

echo "✅ Frontend Deployment Complete!"
echo ""
echo "📊 Deployment Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  URL: https://beamlabultimate.tech"
echo "  Build Time: $(date)"
echo ""
echo "📝 Rollback command:"
echo "  git checkout HEAD~1 && ./deploy-frontend.sh $ENVIRONMENT"
echo ""
echo "📊 Monitor deployment:"
echo "  az webapp log tail --name beamlab-web --resource-group $RESOURCE_GROUP"
echo ""
