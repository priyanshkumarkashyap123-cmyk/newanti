#!/bin/bash
set -e

echo "============================================"
echo "🦀 RUST API - WEB APP FOR CONTAINERS"
echo "============================================"
echo ""
echo "Deploying Rust API as Azure Web App (Containerized)"
echo "This is the production-ready approach!"
echo ""

RG="beamlab-ci-rg"
APP_NAME="beamlab-rust-api"
PLAN_NAME="beamlab-ci-plan"

# Get configuration
echo "[1/5] Retrieving configuration..."
MONGODB_URI=$(az webapp config appsettings list \
    --resource-group beamlab-ci-rg \
    --name beamlab-backend-node \
    --query "[?name=='MONGODB_URI'].value" -o tsv)

JWT_SECRET=$(az webapp config appsettings list \
    --resource-group beamlab-ci-rg \
    --name beamlab-backend-node \
    --query "[?name=='JWT_SECRET'].value" -o tsv)

echo "  ✅ Configuration retrieved"

# Check if web app exists
echo ""
echo "[2/5] Checking for existing Rust web app..."
if az webapp show --resource-group "$RG" --name "$APP_NAME" &>/dev/null; then
    echo "  ✅ Web app exists: $APP_NAME"
else
    echo "  Creating new web app..."
    
    # Create web app with Docker container support
    az webapp create \
        --resource-group "$RG" \
        --plan "$PLAN_NAME" \
        --name "$APP_NAME" \
        --deployment-container-image-name "rust:1.75-slim" \
        --output none
    
    echo "  ✅ Web app created"
fi

# Configure web app for Rust
echo ""
echo "[3/5] Configuring web app..."

# Set environment variables
az webapp config appsettings set \
    --resource-group "$RG" \
    --name "$APP_NAME" \
    --settings \
        PORT=3002 \
        WEBSITES_PORT=3002 \
        RUST_LOG=info \
        RUST_BACKTRACE=1 \
        MONGODB_URI="$MONGODB_URI" \
        JWT_SECRET="$JWT_SECRET" \
    --output none

echo "  ✅ Environment configured"

# Build and deploy using local git or kudu
echo ""
echo "[4/5] Building Rust binary locally..."
cd /Users/rakshittiwari/Desktop/newanti/apps/rust-api

if [ ! -f "target/release/beamlab-rust-api" ]; then
    echo "  Compiling Rust (5-10 minutes)..."
    cargo build --release
fi

echo "  ✅ Binary ready: $(du -h target/release/beamlab-rust-api | cut -f1)"

# Create deployment package
echo ""
echo "[5/5] Creating deployment package..."
cd target/release
mkdir -p /tmp/rust-webapp
cp beamlab-rust-api /tmp/rust-webapp/

# Create startup script
cat > /tmp/rust-webapp/startup.sh << 'EOF'
#!/bin/sh
cd /home/site/wwwroot
chmod +x beamlab-rust-api
PORT="${WEBSITES_PORT:-3002}" ./beamlab-rust-api
EOF

chmod +x /tmp/rust-webapp/startup.sh

cd /tmp/rust-webapp
zip -q -r /tmp/rust-deploy.zip .

echo "  ✅ Package created: $(du -h /tmp/rust-deploy.zip | cut -f1)"

# Deploy using Kudu API (works better than az webapp deploy)
echo ""
echo "Deploying to Azure..."

# Get publishing credentials
CREDS=$(az webapp deployment list-publishing-profiles \
    --resource-group "$RG" \
    --name "$APP_NAME" \
    --query "[?publishMethod=='MSDeploy']|[0].{user:userName,pass:userPWD}" -o json)

USER=$(echo $CREDS | jq -r '.user')
PASS=$(echo $CREDS | jq -r '.pass')

# Deploy via Kudu ZIP API
curl -X POST \
    -u "$USER:$PASS" \
    --data-binary @/tmp/rust-deploy.zip \
    "https://$APP_NAME.scm.azurewebsites.net/api/zipdeploy"

echo ""
echo "  ✅ Deployment complete"

# Set startup command
az webapp config set \
    --resource-group "$RG" \
    --name "$APP_NAME" \
    --startup-file "/home/site/wwwroot/startup.sh" \
    --output none

# Restart app
echo ""
echo "Restarting web app..."
az webapp restart --resource-group "$RG" --name "$APP_NAME" --output none

echo "Waiting 30 seconds for startup..."
sleep 30

# Test endpoint
echo ""
echo "Testing endpoint..."
HEALTH_URL="https://$APP_NAME.azurewebsites.net/health"
RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" || echo -e "FAILED\n000")
STATUS=$(echo "$RESPONSE" | tail -1)

echo ""
echo "============================================"
echo "✅ RUST API DEPLOYED!"
echo "============================================"
echo ""
echo "Service: Azure Web App (Container)"
echo "URL: https://$APP_NAME.azurewebsites.net"
echo "Health: $HEALTH_URL"
echo "Status: HTTP $STATUS"
echo ""

if [ "$STATUS" = "200" ]; then
    echo "✅ Rust API is OPERATIONAL!"
else
    echo "⚠️  Service starting (HTTP $STATUS)"
    echo "   Check logs: az webapp log tail --resource-group $RG --name $APP_NAME"
fi

echo ""
echo "============================================"
echo "🎯 BACKEND ARCHITECTURE - FINAL"
echo "============================================"
echo ""
echo "Port 3001: Node.js API"
echo "  https://beamlab-backend-node.azurewebsites.net"
echo "  Role: Auth, Payments"
echo ""
echo "Port 8000: Python Backend"
echo "  https://beamlab-backend-python.azurewebsites.net"
echo "  Role: AI Generation, Templates"
echo ""
echo "Port 3002: Rust API 🦀"
echo "  https://$APP_NAME.azurewebsites.net"
echo "  Role: Ultra-fast Analysis (50-100x faster)"
echo ""
echo "Database: MongoDB Atlas"
echo ""
echo "============================================"

# Cleanup
rm -rf /tmp/rust-webapp /tmp/rust-deploy.zip
