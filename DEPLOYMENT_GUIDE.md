# Deployment Guide - beamlabultimate.tech

## Pre-Deployment Checklist

### 1. Sequential IDs Implementation ✅
- [x] Nodes use N1, N2, N3... format
- [x] Members use M1, M2, M3... format
- [x] Counter auto-increments
- [x] Counter persists across operations

### 2. Production URLs ✅
- [x] All localhost removed from source code
- [x] Default fallback to beamlabultimate.tech
- [x] Environment variables supported
- [x] No hardcoded dev URLs

### 3. Enterprise Features ✅
- [x] Default tier: enterprise
- [x] All features unlocked
- [x] No upgrade prompts
- [x] PDF export enabled
- [x] AI features enabled

---

## Deployment Steps

### Step 1: Set Environment Variables

On your hosting platform (Azure App Service, Vercel, AWS, etc.):

```bash
# Frontend (apps/web)
VITE_API_URL=https://api.beamlabultimate.tech
VITE_PYTHON_API_URL=https://api.beamlabultimate.tech
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_KEY
CLERK_SECRET_KEY=sk_live_YOUR_SECRET

# Backend Node.js (apps/api)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/beamlab
CLERK_SECRET_KEY=sk_live_YOUR_SECRET
FRONTEND_URL=https://beamlabultimate.tech
NODE_ENV=production
PORT=8080

# Backend Python (apps/backend-python)
CORS_ORIGINS=https://beamlabultimate.tech
API_URL=https://beamlabultimate.tech
```

### Step 2: Build and Deploy

**Frontend (Static Site)**
```bash
cd apps/web
pnpm install
pnpm build
# Deploy dist/ folder to CDN/static hosting
```

**Node.js API**
```bash
cd apps/api
pnpm install
pnpm build
# Deploy to app service with Node.js runtime
```

**Python Backend**
```bash
cd apps/backend-python
pip install -r requirements.txt
# Deploy to Python service
```

### Step 3: Verify Deployment

```bash
# Run verification script
bash verify_production.sh

# Expected output:
# ✅ VITE_API_URL = https://api.beamlabultimate.tech
# ✅ VITE_PYTHON_API_URL = https://api.beamlabultimate.tech
# HTTP Status: 200
# 0 localhost references found
```

### Step 4: Test Features

1. **Open https://beamlabultimate.tech**
2. **Create a structure:**
   - Click on member tool
   - Draw members (should get N1, M1 IDs)
   - Draw more members (should get N2, N3, M2, M3, etc.)
3. **Test PDF Export:**
   - Right-click → Export → PDF
   - Check report opens correctly
4. **Test AI Features:**
   - Should work without upgrade prompts
5. **Check Network tab:**
   - All API calls should go to `api.beamlabultimate.tech`

---

## URL Structure

### Frontend
```
https://beamlabultimate.tech/
├── /dashboard
├── /analysis
├── /design
└── /export
```

### API Endpoints
```
https://api.beamlabultimate.tech/
├── /api/health              # Health check
├── /api/user/subscription   # User subscription
├── /api/analyze             # Run analysis
├── /api/export/pdf          # PDF export
└── /api/design              # Design checks
```

### Python Solver
```
https://api.beamlabultimate.tech/
├── /api/solve               # Run structural analysis
├── /api/modal               # Modal analysis
└── /api/optimize            # Optimization
```

---

## Rollback Plan

If deployment has issues:

1. **Immediate Rollback:**
   ```bash
   # Redeploy previous version
   git revert <commit>
   cd apps/web && pnpm build && deploy
   ```

2. **Quick Fix (if API down):**
   - Update environment variables back to localhost
   - Redeploy frontend only

3. **Database Issues:**
   - Check MongoDB connection string
   - Verify Clerk setup
   - Run migrations if needed

---

## Monitoring

### Key Metrics
- API response time < 200ms
- PDF export success rate > 99%
- Sequential ID generation (all nodes have N# format)
- Error rate < 0.1%

### Logs to Monitor
- `/api/analyze` - Solver calls
- `/api/export/pdf` - PDF generation
- `/api/user/subscription` - Subscription checks
- Authentication errors - Clerk integration

---

## Performance Optimization

### Frontend (beamlabultimate.tech)
- Enable CDN caching (1 hour)
- Enable gzip compression
- Serve modern JS only
- Cache busting for updates

### API (api.beamlabultimate.tech)
- Enable response caching
- Rate limiting: 100 requests/minute
- Connection pooling for MongoDB
- Auto-scaling based on load

### Python Solver
- Queue-based job processing
- Timeout: 30 seconds per analysis
- Max simultaneous jobs: 10
- Memory limit: 2GB per job

---

## Security Checklist

- [x] HTTPS only (no HTTP)
- [x] No localhost URLs
- [x] CORS configured for beamlabultimate.tech
- [x] Clerk authentication enabled
- [x] MongoDB connection encrypted
- [x] API rate limiting enabled
- [x] CSRF protection enabled
- [x] SQL injection prevention

---

## Support URLs

For users having issues:

1. **Email:** support@beamlabultimate.tech
2. **Documentation:** https://docs.beamlabultimate.tech
3. **Status Page:** https://status.beamlabultimate.tech
4. **Contact Form:** https://beamlabultimate.tech/contact

---

## Next Steps

1. Deploy to staging environment first
2. Run full test suite on staging
3. Get approval from team
4. Deploy to production
5. Monitor for 24 hours
6. Send deployment notification to users

---

**Deployment Status**: READY ✅

Last Updated: 3 January 2026
