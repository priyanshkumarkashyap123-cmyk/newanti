#!/bin/bash

# ============================================
# BeamLab Ultimate - Deployment Script
# Deploy to beamlabultimate.tech
# ============================================

set -e  # Exit on any error

echo "============================================"
echo "🚀 BeamLab Ultimate - Production Deployment"
echo "============================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="beamlabultimate.tech"
API_DOMAIN="api.beamlabultimate.tech"
DEPLOY_DIR="/var/www/beamlab"
API_DEPLOY_DIR="/var/www/beamlab-api"

# ============================================
# Step 1: Verify Environment
# ============================================

echo -e "${BLUE}[1/6]${NC} Verifying environment..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js$(node --version)${NC}"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ pnpm$(pnpm --version)${NC}"

# Check current directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Not in project root directory${NC}"
    exit 1
fi
echo -e "${GREEN}✅ In project root directory${NC}"
echo ""

# ============================================
# Step 2: Build Applications
# ============================================

echo -e "${BLUE}[2/6]${NC} Building applications..."
echo ""

echo "📦 Building frontend..."
cd apps/web
rm -rf dist
pnpm install > /dev/null 2>&1
pnpm build
echo -e "${GREEN}✅ Frontend built successfully${NC}"
cd ../..

echo ""
echo "📦 Building API..."
cd apps/api
pnpm install > /dev/null 2>&1
pnpm build
echo -e "${GREEN}✅ API built successfully${NC}"
cd ../..

echo ""
echo "📦 Building Python backend..."
cd apps/backend-python
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate 2>/dev/null || true
pip install -r requirements.txt > /dev/null 2>&1
echo -e "${GREEN}✅ Python dependencies installed${NC}"
cd ../..

echo ""

# ============================================
# Step 3: Verify Build Artifacts
# ============================================

echo -e "${BLUE}[3/6]${NC} Verifying build artifacts..."
echo ""

if [ -d "apps/web/dist" ]; then
    SIZE=$(du -sh apps/web/dist | cut -f1)
    echo -e "${GREEN}✅ Frontend dist: $SIZE${NC}"
else
    echo -e "${RED}❌ Frontend dist not found${NC}"
    exit 1
fi

if [ -d "apps/api/dist" ]; then
    SIZE=$(du -sh apps/api/dist | cut -f1)
    echo -e "${GREEN}✅ API dist: $SIZE${NC}"
else
    echo -e "${RED}❌ API dist not found${NC}"
    exit 1
fi

echo ""

# ============================================
# Step 4: Create Deployment Package
# ============================================

echo -e "${BLUE}[4/6]${NC} Creating deployment package..."
echo ""

PACKAGE_DIR="deployment-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PACKAGE_DIR"

echo "📦 Packaging frontend..."
cp -r apps/web/dist "$PACKAGE_DIR/frontend"
echo -e "${GREEN}✅ Frontend packaged${NC}"

echo "📦 Packaging API..."
mkdir -p "$PACKAGE_DIR/api"
cp -r apps/api/dist "$PACKAGE_DIR/api/"
cp apps/api/package.json "$PACKAGE_DIR/api/"
cp apps/api/.env "$PACKAGE_DIR/api/"
echo -e "${GREEN}✅ API packaged${NC}"

echo "📦 Packaging Python backend..."
mkdir -p "$PACKAGE_DIR/python"
cp -r apps/backend-python "$PACKAGE_DIR/python/"
cp apps/backend-python/requirements.txt "$PACKAGE_DIR/python/"
echo -e "${GREEN}✅ Python backend packaged${NC}"

# Create deployment manifest
cat > "$PACKAGE_DIR/DEPLOYMENT_MANIFEST.txt" << 'EOF'
============================================
BeamLab Ultimate - Deployment Manifest
============================================

Deployment Date: $(date)
Version: 2.1.0
Domain: beamlabultimate.tech

CONTENTS:
---------
/frontend     - React app (dist/)
/api          - Node.js backend (dist/)
/python       - Python solver

DEPLOYMENT STEPS:
-----------------
1. Frontend: Upload /frontend to https://beamlabultimate.tech
2. API: Deploy /api to https://api.beamlabultimate.tech
3. Python: Deploy /python to Python service

VERIFICATION:
--------------
After deployment, verify:
✓ https://beamlabultimate.tech loads
✓ API responds at https://api.beamlabultimate.tech/api/health
✓ Sequential IDs appear (N1, M1)
✓ PDF export works
✓ All features accessible

============================================
EOF

echo -e "${GREEN}✅ Deployment package created: $PACKAGE_DIR${NC}"
echo ""

# ============================================
# Step 5: Generate Deployment Instructions
# ============================================

echo -e "${BLUE}[5/6]${NC} Generating deployment instructions..."
echo ""

cat > "$PACKAGE_DIR/DEPLOYMENT_STEPS.md" << 'EOF'
# Deployment Steps - beamlabultimate.tech

## 1. Frontend Deployment

### Option A: Using GitHub Pages / Vercel / Netlify
```bash
# Upload frontend/ directory to your hosting
# Set up custom domain: beamlabultimate.tech
# Enable HTTPS/SSL
```

### Option B: Manual Server Deployment
```bash
# SSH into web server
ssh user@web.beamlabultimate.tech

# Deploy frontend
mkdir -p /var/www/beamlab
cp -r frontend/* /var/www/beamlab/

# Configure nginx
sudo systemctl restart nginx
```

## 2. API Deployment

### Option A: Using Docker
```bash
cd api/
docker build -t beamlab-api .
docker run -d \
  --name beamlab-api \
  -p 3001:3001 \
  -e MONGODB_URI=mongodb+srv://... \
  -e CLERK_SECRET_KEY=sk_live_... \
  -e FRONTEND_URL=https://beamlabultimate.tech \
  beamlab-api
```

### Option B: Using Node.js directly
```bash
cd api/
npm install
NODE_ENV=production PORT=3001 npm start
```

### Option C: Using Azure App Service
```bash
az webapp up \
  --name beamlab-api \
  --resource-group beamlab \
  --runtime "node|18" \
  --sku B2
```

## 3. Python Backend Deployment

### Option A: Using Python Service
```bash
cd python/
pip install -r requirements.txt
gunicorn --bind 0.0.0.0:8000 main:app
```

### Option B: Using Docker
```bash
docker build -f python/Dockerfile -t beamlab-python .
docker run -d --name beamlab-python -p 8000:8000 beamlab-python
```

## 4. Environment Variables

**Frontend (beamlabultimate.tech)**
```
VITE_API_URL=https://api.beamlabultimate.tech
VITE_PYTHON_API_URL=https://api.beamlabultimate.tech
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_KEY
```

**API (api.beamlabultimate.tech)**
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/beamlab
CLERK_SECRET_KEY=sk_live_YOUR_SECRET
FRONTEND_URL=https://beamlabultimate.tech
NODE_ENV=production
PORT=3001
```

## 5. Post-Deployment Verification

```bash
# 1. Check frontend
curl -I https://beamlabultimate.tech
# Expected: 200 OK

# 2. Check API health
curl -I https://api.beamlabultimate.tech/api/health
# Expected: 200 OK

# 3. Test analysis
curl -X POST https://api.beamlabultimate.tech/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"nodes": [], "members": []}'
# Expected: 200 OK (or 401 if auth required)

# 4. Browser: Open https://beamlabultimate.tech
# Expected: App loads, create member gets N1, M1 IDs
```

## 6. Troubleshooting

### Frontend not loading
- Check DNS: `nslookup beamlabultimate.tech`
- Check SSL: `openssl s_client -connect beamlabultimate.tech:443`
- Check browser cache: Clear and reload

### API not responding
- Check service: `curl https://api.beamlabultimate.tech/api/health`
- Check logs: `tail -f /var/log/beamlab-api.log`
- Check environment: Verify all env vars set

### Sequential IDs not appearing
- Rebuild frontend: `pnpm build`
- Clear browser cache
- Verify model.ts has ID generation functions

## 7. Rollback Plan

If deployment fails:
```bash
# Restore previous version
git revert HEAD
pnpm build
# Redeploy
```

EOF

echo -e "${GREEN}✅ Deployment instructions generated${NC}"
echo ""

# ============================================
# Step 6: Create Checklist
# ============================================

echo -e "${BLUE}[6/6]${NC} Creating deployment checklist..."
echo ""

cat > "$PACKAGE_DIR/PRE_DEPLOYMENT_CHECKLIST.txt" << 'EOF'
PRE-DEPLOYMENT CHECKLIST
========================

CONFIGURATION
[ ] VITE_API_URL set to https://api.beamlabultimate.tech
[ ] VITE_PYTHON_API_URL set to https://api.beamlabultimate.tech
[ ] CLERK_PUBLISHABLE_KEY configured (pk_live_*)
[ ] CLERK_SECRET_KEY configured (sk_live_*)
[ ] MONGODB_URI configured
[ ] FRONTEND_URL set to https://beamlabultimate.tech
[ ] CORS origins include beamlabultimate.tech

BUILD VERIFICATION
[ ] Frontend builds without errors (0 TypeScript errors)
[ ] API builds without errors
[ ] Python environment set up correctly
[ ] No localhost references in code
[ ] dist/ folders exist with content

PRODUCTION READY
[ ] HTTPS/SSL certificate installed
[ ] Domain DNS configured
[ ] CDN setup (if applicable)
[ ] Database backups in place
[ ] Monitoring/alerting configured
[ ] Logging configured
[ ] Rate limiting configured
[ ] CORS properly configured

TESTING (POST-DEPLOYMENT)
[ ] Frontend loads at beamlabultimate.tech
[ ] API responds at api.beamlabultimate.tech
[ ] Sequential IDs working (N1, M1)
[ ] PDF export functional
[ ] Design checks working
[ ] AI features working
[ ] Authentication working
[ ] Email service working
[ ] No 404 errors
[ ] No console errors
[ ] Mobile responsive

MONITORING
[ ] Set up uptime monitoring
[ ] Set up error logging (Sentry/LogRocket)
[ ] Set up performance monitoring
[ ] Set up user analytics
[ ] Configure alerts for failures

TEAM NOTIFICATION
[ ] Notify team of deployment
[ ] Update status page
[ ] Send announcement email
[ ] Update documentation
EOF

echo -e "${GREEN}✅ Checklist created${NC}"
echo ""

# ============================================
# Final Summary
# ============================================

echo "============================================"
echo -e "${GREEN}✅ DEPLOYMENT PACKAGE READY${NC}"
echo "============================================"
echo ""
echo "📦 Package location: $PACKAGE_DIR"
echo ""
echo "📋 Contents:"
echo "  • frontend/        - React app (dist/)"
echo "  • api/             - Node.js backend"
echo "  • python/          - Python solver"
echo ""
echo "📄 Documentation:"
echo "  • DEPLOYMENT_STEPS.md"
echo "  • PRE_DEPLOYMENT_CHECKLIST.txt"
echo "  • DEPLOYMENT_MANIFEST.txt"
echo ""
echo "🚀 Next Steps:"
echo "1. Review DEPLOYMENT_STEPS.md"
echo "2. Complete PRE_DEPLOYMENT_CHECKLIST.txt"
echo "3. Deploy to beamlabultimate.tech"
echo "4. Verify using DEPLOYMENT_MANIFEST.txt"
echo ""
echo "Domain: https://beamlabultimate.tech"
echo "API: https://api.beamlabultimate.tech"
echo ""
echo "============================================"
