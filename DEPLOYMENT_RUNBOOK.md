# Deployment Runbook — BeamLab

**Audience:** DevOps / Release Engineers  
**Scope:** Deploying code to production Azure infrastructure

---

## Pre-Deployment Checklist

```bash
# 1. Verify CI passed on main
git log --oneline -1
# Should see commit message. Check GitHub Actions status.

# 2. Verify no uncommitted changes
git status
# Should output: "On branch main, nothing to commit, working tree clean"

# 3. Build locally to catch issues
pnpm install --frozen-lockfile
pnpm run build

# 4. Run all tests locally
npx vitest run
cargo test --manifest-path apps/rust-api/Cargo.toml

# 5. Verify environment config
echo "Frontend build env:"
grep VITE_API_URL apps/web/.env.production

echo "Node backend env:"
grep MONGODB_URI apps/api/.env.production

echo "Python backend env:"
grep MONGODB_URI apps/backend-python/.env.production
```

---

## Manual Deployment (Emergency Path)

**Use only if CI is unavailable.**

### Frontend (Azure Static Web Apps)

```bash
cd /Users/rakshittiwari/Desktop/newanti

# 1. Build WASM packages
cd apps/backend-rust
wasm-pack build --target web --out-dir ./pkg --release

cd ../../packages/solver-wasm
wasm-pack build --target web --out-dir ./pkg --release

# 2. Build frontend
cd ../../apps/web
pnpm run build

# 3. Deploy via SWA CLI (if not using GitHub Actions)
# Requires: Azure Static Web Apps CLI v2.0+
swa deploy dist --deployment-token $AZURE_STATIC_WEB_APPS_API_TOKEN
```

### Node.js Backend

```bash
cd /Users/rakshittiwari/Desktop/newanti/apps/api

# 1. Build
pnpm install --frozen-lockfile
pnpm run build

# 2. Prepare deployment package
rm -rf deploy-api && mkdir deploy-api
cp -r dist deploy-api/
cp web.config deploy-api/
npm install --omit=dev  # For production only

# 3. Create zip
cd deploy-api && zip -r ../api-app.zip .

# 4. Deploy to Azure Web App
az webapp deployment source config-zip \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node \
  --src ../api-app.zip

# 5. Verify health
sleep 30
curl https://beamlab-backend-node.azurewebsites.net/health
```

### Python Backend

```bash
cd /Users/rakshittiwari/Desktop/newanti/apps/backend-python

# 1. Install production dependencies
python3 -m venv venv-prod
source venv-prod/bin/activate
pip install -r requirements.txt

# 2. Package for deployment
zip -r python-app.zip .

# 3. Deploy to Azure Web App
az webapp deployment source config-zip \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-python \
  --src python-app.zip

# 4. Verify health
sleep 30
curl https://beamlab-backend-python.azurewebsites.net/health
```

### Rust API

```bash
cd /Users/rakshittiwari/Desktop/newanti/apps/rust-api

# 1. Build Docker image
docker build -t beamlab-rust:$GIT_SHA .

# 2. Push to Azure Container Registry
docker tag beamlab-rust:$GIT_SHA beamlabregistry.azurecr.io/beamlab-rust:$GIT_SHA
docker tag beamlab-rust:$GIT_SHA beamlabregistry.azurecr.io/beamlab-rust:latest
docker push beamlabregistry.azurecr.io/beamlab-rust:latest

# 3. Restart container
az webapp restart \
  --resource-group beamlab-ci-rg \
  --name beamlab-rust-api

# 4. Verify health
sleep 30
curl https://beamlab-rust-api.azurewebsites.net/health
```

---

## Post-Deployment Verification

**Perform these checks immediately after deploy to catch issues early.**

### 1. Health Endpoint Checks

```bash
#!/bin/bash

endpoints=(
  "https://beamlabultimate.tech"
  "https://beamlab-backend-node.azurewebsites.net/health"
  "https://beamlab-backend-python.azurewebsites.net/health"
  "https://beamlab-rust-api.azurewebsites.net/health"
)

for url in "${endpoints[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$status" = "200" ]; then
    echo "✅ $url → $status"
  else
    echo "❌ $url → $status (CRITICAL)"
    exit 1
  fi
done

echo "All health checks passed ✅"
```

### 2. Error Log Check (Sentry)

```bash
# Log in to https://sentry.io and check:
# 1. Error rate should be < 0.1%
# 2. No crashes in last 5 minutes
# 3. Auth errors minimal (< 10)
```

### 3. Performance Baseline

```bash
# Using Lighthouse CI or WebPageTest:
curl https://beamlabultimate.tech -I
# Response time should be < 2s for initial HTML

# Monitor database query times (should be < 100ms):
# From MongoDB Atlas dashboard or slow query log
```

### 4. Rate Limiting Test

```bash
# Send 550 requests in < 60 seconds:
ab -n 550 -c 10 https://beamlab-backend-node.azurewebsites.net/health

# Last ~50 requests should return 429 (Too Many Requests)
# Rate limit is 500 req/min global
```

---

## Rollback Procedures

**Use if deployment breaks production.**

### Option A: Revert Previous Commit (< 5 min ago)

```bash
# 1. Get SHA of previous good commit
git log --oneline -5 | grep "✅"  # Look for passing CI marker

# 2. Revert
gh run list --status failure --limit 1
gh run view --log $RUN_ID
git revert HEAD --no-edit
git push origin main

# CI will auto-deploy the revert
```

### Option B: Immediate Rollback (Azure Slots)

**Requires staging slot to be enabled (see PRODUCTION_READINESS.md item 4)**

```bash
# Swap production with staging (instant rollback)
az webapp deployment slot swap \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node \
  --slot staging

az webapp deployment slot swap \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-python \
  --slot staging

# Verify health
curl https://beamlab-backend-node.azurewebsites.net/health
```

### Option C: Manual Revert from Backup

**Use if slots not available and Git revert doesn't work**

```bash
# 1. Get previous deployment artifact from deployment history
az webapp deployment list \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node

# 2. Re-deploy known-good version
az webapp deployment source config-zip \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node \
  --src /backups/api-app-2026-03-08.zip

# 3. Verify
curl https://beamlab-backend-node.azurewebsites.net/health
```

---

## Incident Response

### Database Connection Failure

```bash
# See error: "ECONNREFUSED 127.0.0.1:27017"
# 1. Check MongoDB Atlas status
#    → https://cloud.mongodb.com → beamlab-prod cluster

# 2. Verify connection string in Azure
az webapp config appsettings show \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node | grep MONGODB_URI

# 3. If offline, rollback backend immediately
#    → Use "Option B: Azure Slots" above

# 4. Contact MongoDB support if persistent
```

### Rate Limiter Memory Leak

```bash
# See error: "Rate limiter store exceeded 1GB"
# (Only applicable for in-memory rate limiter; Redis doesn't have this issue)

# Quick fix:
az webapp restart \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node

# Permanent fix:
# → Provision Redis (see PRODUCTION_READINESS.md item 2)
```

### Sentry Spam (100+ errors in 5 min)

```bash
# 1. Silence false positives in Sentry
#    → https://sentry.io → Settings → Inbound Data Filters

# 2. Check git logs for recent changes
git log --oneline -20

# 3. If human error, rollback immediately
gh run view --log <LAST_RUN_ID>

# 4. If external issue (bot attack, etc), enable firewall
az network waf-policy create \
  --name beamlab-waf \
  --resource-group beamlab-ci-rg
```

---

## Deployment Metrics to Track

| Metric | Target | Action if Exceeded |
|--------|--------|-------------------|
| Deployment time | < 5 min | Check network/pipeline logs |
| Post-deploy error rate | < 0.1% | Rollback within 5 min |
| API response time (p99) | < 1s | Scale up or check slow queries |
| Database query time (p95) | < 100ms | Add indexes or cache |
| Memory usage | < 500MB | Check for leaks, restart |
| CPU usage | < 70% | Add container replicas |

---

## Deployment Schedule

| Service | Frequency | Window | Owner |
|---------|-----------|--------|-------|
| Frontend | Per commit to main | Anytime (instant) | GitHub Actions |
| Node API | Per commit to main | Off-peak (10s downtime) | GitHub Actions |
| Python API | Per commit to main | Off-peak (10s downtime) | GitHub Actions |
| Rust API | Per commit to main | Off-peak (20s downtime) | GitHub Actions |

**Off-peak:** Monday–Friday, 23:00–07:00 UTC (or trigger manually)

---

## Emergency Contacts

- **Azure Support:** https://portal.azure.com (File support ticket)
- **MongoDB Support:** https://cloud.mongodb.com (Chat)
- **Sentry Team:** support@sentry.io (Email)
- **GitHub Actions Help:** https://docs.github.com/en/actions/troubleshooting

---

**Last Updated:** March 9, 2026  
**Tested By:** CI/CD pipelines on every commit  
**Next Review:** When infrastructure changes (e.g., Redis setup)
