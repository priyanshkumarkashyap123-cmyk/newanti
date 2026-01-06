#!/bin/bash
set -e

echo "============================================"
echo "🦀 RUST DEPLOYMENT VIA az webapp deploy"
echo "============================================"

RG="beamlab-ci-rg"
APP="beamlab-backend-python"

echo "[1/5] Stopping app..."
az webapp stop --resource-group "$RG" --name "$APP"

echo "[2/5] Creating clean deployment package..."
cd /Users/rakshittiwari/Desktop/newanti/apps/rust-api/target/release
mkdir -p /tmp/rust-clean
cp beamlab-rust-api /tmp/rust-clean/
chmod +x /tmp/rust-clean/beamlab-rust-api

cd /tmp/rust-clean
tar -czf /tmp/rust-api.tar.gz beamlab-rust-api

echo "[3/5] Deploying with az webapp deploy..."
az webapp deploy \
    --resource-group "$RG" \
    --name "$APP" \
    --src-path /tmp/rust-api.tar.gz \
    --type static \
    --clean true \
    --restart true

echo "[4/5] Configuring startup..."
az webapp config set \
    --resource-group "$RG" \
    --name "$APP" \
    --startup-file "/home/site/wwwroot/beamlab-rust-api"

echo "[5/5] Setting environment..."
MONGODB_URI="$(az webapp config appsettings list --resource-group beamlab-ci-rg --name beamlab-backend-node --query "[?name=='MONGODB_URI'].value" -o tsv)"
JWT_SECRET="$(az webapp config appsettings list --resource-group beamlab-ci-rg --name beamlab-backend-node --query "[?name=='JWT_SECRET'].value" -o tsv)"

az webapp config appsettings set \
    --resource-group "$RG" \
    --name "$APP" \
    --settings \
        PORT=8000 \
        RUST_LOG=info \
        RUST_BACKTRACE=1 \
        MONGODB_URI="$MONGODB_URI" \
        JWT_SECRET="$JWT_SECRET" \
        SCM_DO_BUILD_DURING_DEPLOYMENT=false

echo ""
echo "Starting app..."
az webapp start --resource-group "$RG" --name "$APP"

echo "Waiting 20s..."
sleep 20

echo ""
curl -s "https://$APP.azurewebsites.net/health" || echo "Not ready yet"

echo ""
echo "✅ Deployment complete!"
