#!/bin/bash

# ============================================================================
# BeamLab Production Setup Script
# Sets up all GitHub Secrets, Azure App Settings, and local .env
# ============================================================================

set -e

REPO="priyanshkumarkashyap123-cmyk/newanti"
RESOURCE_GROUP="beamlab-ci-rg"

echo "🚀 BeamLab Production Setup"
echo "============================"

# ============================================================================
# 1) GITHUB SECRETS
# ============================================================================

echo -e "\n📝 Setting GitHub Secrets..."

gh secret set VITE_SENTRY_DSN \
  --repo "$REPO" \
  --body "https://d3e4d431db73c6082f2167534bc508e2@o4511015068237824.ingest.de.sentry.io/4511015126433872"
echo "✓ VITE_SENTRY_DSN"

gh secret set SENTRY_DSN \
  --repo "$REPO" \
  --body "https://eeb7a15ae1246d8c4e26121e79d82e07@o4511015068237824.ingest.de.sentry.io/4511015185481808"
echo "✓ SENTRY_DSN (Node backend)"

gh secret set GOOGLE_API_KEY \
  --repo "$REPO" \
  --body "AIzaSyAxZ48TkoqMU7sU-3DNMDf3c6YNXZwB65s"
echo "✓ GOOGLE_API_KEY"

# Generate secrets
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 32)

gh secret set JWT_SECRET \
  --repo "$REPO" \
  --body "$JWT_SECRET"
echo "✓ JWT_SECRET"

gh secret set JWT_REFRESH_SECRET \
  --repo "$REPO" \
  --body "$JWT_REFRESH_SECRET"
echo "✓ JWT_REFRESH_SECRET"

gh secret set SESSION_SECRET \
  --repo "$REPO" \
  --body "$SESSION_SECRET"
echo "✓ SESSION_SECRET"

echo -e "\n✅ GitHub Secrets configured"

# ============================================================================
# 2) AZURE APP SETTINGS - NODE BACKEND
# ============================================================================

echo -e "\n⚙️  Configuring Azure App Settings (Node backend)..."

az webapp config appsettings set \
  -n beamlab-backend-node \
  -g "$RESOURCE_GROUP" \
  --settings \
    SENTRY_DSN="https://eeb7a15ae1246d8c4e26121e79d82e07@o4511015068237824.ingest.de.sentry.io/4511015185481808" \
    GOOGLE_API_KEY="AIzaSyAxZ48TkoqMU7sU-3DNMDf3c6YNXZwB65s" \
    JWT_SECRET="$JWT_SECRET" \
    JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
    SESSION_SECRET="$SESSION_SECRET" \
    ENVIRONMENT="production" \
    NODE_ENV="production" > /dev/null

echo "✓ Node backend settings updated"

# ============================================================================
# 3) AZURE APP SETTINGS - PYTHON BACKEND
# ============================================================================

echo -e "\n⚙️  Configuring Azure App Settings (Python backend)..."

az webapp config appsettings set \
  -n beamlab-backend-python \
  -g "$RESOURCE_GROUP" \
  --settings \
    SENTRY_DSN="https://c46a21516da55660388fcf3909f5d14c@o4511015068237824.ingest.de.sentry.io/4511015190134864" \
    ENVIRONMENT="production" \
    PYTHON_ENV="production" > /dev/null

echo "✓ Python backend settings updated"

# ============================================================================
# 4) AZURE APP SETTINGS - RUST API
# ============================================================================

echo -e "\n⚙️  Configuring Azure App Settings (Rust API)..."

az webapp config appsettings set \
  -n beamlab-rust-api \
  -g "$RESOURCE_GROUP" \
  --settings \
    RUST_LOG="info" \
    ENVIRONMENT="production" > /dev/null

echo "✓ Rust API settings updated"

# ============================================================================
# 5) CREATE LOCAL .ENV
# ============================================================================

echo -e "\n📄 Creating local .env file..."

cat > .env << EOF
# ============================================
# API KEYS
# ============================================

GOOGLE_API_KEY=AIzaSyAxZ48TkoqMU7sU-3DNMDf3c6YNXZwB65s
OPENAI_API_KEY=

# ============================================
# DATABASE
# ============================================

MONGODB_URI=mongodb://localhost:27017/beamlab

# ============================================
# SERVICES
# ============================================

FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:3001
VITE_PYTHON_API_URL=http://localhost:8000
VITE_RUST_API_URL=http://localhost:3002
VITE_WEBSOCKET_URL=ws://localhost:8000/ws
PYTHON_API_URL=http://localhost:8000
RUST_API_URL=http://localhost:3002

# ============================================
# SECURITY
# ============================================

JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
SESSION_SECRET=$SESSION_SECRET
INTERNAL_SERVICE_SECRET=$(openssl rand -base64 32)

# ============================================
# SENTRY (Local development — leave empty)
# ============================================

VITE_SENTRY_DSN=
SENTRY_DSN=

# ============================================
# DEVELOPMENT
# ============================================

ENVIRONMENT=development
NODE_ENV=development
DEBUG=true
RUST_LOG=debug
EOF

echo "✓ .env file created"

# ============================================================================
# 6) VERIFY SETUP
# ============================================================================

echo -e "\n✅ VERIFICATION"
echo "==============="
echo ""
echo "GitHub Secrets (5 configured):"
gh secret list --repo "$REPO" | head -10

echo -e "\nNode Backend App Settings:"
az webapp config appsettings list -n beamlab-backend-node -g "$RESOURCE_GROUP" \
  --query "[?name=='SENTRY_DSN' || name=='ENVIRONMENT'].{name:name, value:value}" -o table

echo -e "\nPython Backend App Settings:"
az webapp config appsettings list -n beamlab-backend-python -g "$RESOURCE_GROUP" \
  --query "[?name=='SENTRY_DSN' || name=='ENVIRONMENT'].{name:name, value:value}" -o table

echo -e "\nLocal .env file:"
test -f .env && echo "✓ .env exists" || echo "✗ .env missing"
grep "JWT_SECRET=" .env | head -c 60 && echo "..." || echo "✗ JWT_SECRET missing"

echo -e "\n" 
echo "🎉 Production setup complete!"
echo ""
echo "Next steps:"
echo "1. Verify GitHub Secrets: gh secret list --repo $REPO"
echo "2. Deploy: git commit --allow-empty -m 'chore: activate production configuration' && git push origin main"
echo "3. Monitor: Watch Azure deployment (10-15 min)"
echo "4. Test: curl https://beamlabultimate.tech/health"
echo ""
