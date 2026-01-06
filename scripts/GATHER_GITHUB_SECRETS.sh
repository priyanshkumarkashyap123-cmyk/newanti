#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Rust API Deployment - Gather GitHub Secrets                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

REGISTRY_NAME="beamlabregistry"
RESOURCE_GROUP="beamlab-ci-rg"
APP_NAME="beamlab-rust-api"

echo "📋 Step 1: Getting ACR Credentials..."
echo ""

# Get ACR username (always the registry name)
ACR_USERNAME=$REGISTRY_NAME
echo "✓ Registry Username: $ACR_USERNAME"

# Get ACR password
echo "Getting password from Azure..."
ACR_PASSWORD=$(az acr credential show \
  --name "$REGISTRY_NAME" \
  --query "passwords[0].value" \
  --output tsv)

if [ -z "$ACR_PASSWORD" ]; then
  echo "❌ Failed to get ACR password"
  exit 1
fi

echo "✓ Registry Password: ${ACR_PASSWORD:0:10}...${ACR_PASSWORD: -10}"
echo ""

echo "📋 Step 2: Getting App Service Publish Profile..."
echo ""

# Get publish profile
PUBLISH_PROFILE=$(az webapp deployment list-publishing-profiles \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --xml)

if [ -z "$PUBLISH_PROFILE" ]; then
  echo "❌ Failed to get publish profile"
  exit 1
fi

echo "✓ Publish Profile obtained (XML format)"
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  GitHub Secrets to Add                                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

echo "📌 Go to: https://github.com/rakshittiwari048-ship-it/newanti/settings/secrets/actions"
echo ""

echo "1️⃣  Add Secret: REGISTRY_USERNAME"
echo "   Value: $ACR_USERNAME"
echo ""

echo "2️⃣  Add Secret: REGISTRY_PASSWORD"
echo "   Value: $ACR_PASSWORD"
echo ""

echo "3️⃣  Add Secret: AZURE_PUBLISH_PROFILE_RUST"
echo "   Value: (Full XML below)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$PUBLISH_PROFILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✅ Secrets ready to add to GitHub!"
echo ""
echo "Next steps:"
echo "1. Copy each secret above"
echo "2. Go to GitHub repo Settings → Secrets → Actions"
echo "3. Click 'New repository secret'"
echo "4. Add all 3 secrets"
echo "5. Then push a commit to trigger the workflow"
echo ""

# Save to file for reference
mkdir -p /tmp/github_secrets
echo "$ACR_USERNAME" > /tmp/github_secrets/REGISTRY_USERNAME.txt
echo "$ACR_PASSWORD" > /tmp/github_secrets/REGISTRY_PASSWORD.txt
echo "$PUBLISH_PROFILE" > /tmp/github_secrets/AZURE_PUBLISH_PROFILE_RUST.txt

echo "💾 Secrets also saved to /tmp/github_secrets/ for reference"
