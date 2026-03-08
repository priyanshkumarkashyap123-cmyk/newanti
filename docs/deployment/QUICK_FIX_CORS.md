# 🚨 IMMEDIATE ACTION REQUIRED - CORS Fix

## The Problem
Your Node.js backend is **not running** (503 Service Unavailable). That's why you're seeing all the CORS errors.

## Quick Test Results
```
✅ Rust API:    Working perfectly (200 OK + correct CORS)
⚠️  Python API: Running but CORS needs tuning (200 OK)
❌ Node.js API: DOWN (503 - Service Unavailable)
```

## Fix in 3 Steps (5-10 minutes)

### Step 1: Deploy the Fixed Code ⚡

```bash
# Commit all CORS fixes
git add .
git commit -m "fix: Configure CORS and deploy Node.js API to Azure"
git push origin main
```

Wait 5-10 minutes for GitHub Actions to deploy.

**Check deployment**: https://github.com/rakshittiwari048-ship-it/newanti/actions

### Step 2: Configure Azure CORS 🔧

**Option A - Automated (Recommended)**:
```bash
./fix-azure-cors.sh
```

**Option B - Manual via Azure Portal**:
1. Go to https://portal.azure.com
2. App Services → `beamlab-backend-node`
3. CORS → Add these origins:
   - `https://beamlabultimate.tech`
   - `https://www.beamlabultimate.tech`
4. Enable "Access-Control-Allow-Credentials"
5. Save & Restart

### Step 3: Verify ✅

```bash
# Wait 60 seconds after restart, then:
./test-azure-cors.sh
```

**Expected**: All ✅ green checkmarks

---

## Alternative: Quick Deploy Now

If you can't wait for GitHub Actions:

```bash
# Build locally
cd apps/api
pnpm install
pnpm run build

# Deploy
cd ../..
./deploy-to-azure.sh
```

---

## What We Fixed

1. ✅ Created `web.config` for Azure IIS
2. ✅ Updated deployment workflow with CORS env vars
3. ✅ Created automated CORS fix script
4. ✅ Created test script to verify CORS
5. ✅ Documented everything in AZURE_CORS_FIX.md

---

## After Fix - Browser Console Will Show

**Before**:
```
❌ CORS policy: No 'Access-Control-Allow-Origin' header
❌ Failed to fetch
❌ WebSocket connection failed
```

**After**:
```
✅ All API calls work
✅ WebSocket connected
✅ No CORS errors
```

---

## Need Help?

**Check deployment logs**:
```bash
az webapp log tail --name beamlab-backend-node --resource-group beamlab-rg
```

**Check if app is running**:
```bash
curl -I https://beamlab-backend-node.azurewebsites.net/health
```

**See full documentation**: `AZURE_CORS_FIX.md`

---

## TL;DR

1. Push code → Deploys Node.js API
2. Run `./fix-azure-cors.sh` → Configures CORS
3. Run `./test-azure-cors.sh` → Verifies working
4. Done! 🎉
