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

## Phase 1 Rollout — Rust Runtime Parallelism (Concurrency Boost)

### Objective

Increase analysis concurrency by ensuring Rust compute paths use multiple cores consistently.

### Changes Introduced

1. Rust API now initializes Rayon global thread pool explicitly at startup.
2. Runtime thread controls are env-driven:
   - `TOKIO_WORKER_THREADS`
   - `RAYON_NUM_THREADS`
3. `/health` now reports effective/configured runtime thread values.

### Recommended Initial Values

Use these as the first production tuning pass (adjust after load tests):

- `TOKIO_WORKER_THREADS=2`
- `RAYON_NUM_THREADS=2`

If host/container has >= 4 vCPU, test:

- `TOKIO_WORKER_THREADS=4`
- `RAYON_NUM_THREADS=4`

### Apply Settings (Azure)

```bash
az webapp config appsettings set \
  --resource-group beamlab-ci-rg \
  --name beamlab-rust-api \
  --settings TOKIO_WORKER_THREADS=2 RAYON_NUM_THREADS=2

az webapp restart \
  --resource-group beamlab-ci-rg \
  --name beamlab-rust-api
```

### Verify Runtime State

```bash
curl -sS https://beamlab-rust-api.azurewebsites.net/health
```

Expected response fragment:

- `threads.rayon_effective` >= 2
- `threads.rayon_configured` = configured value
- `threads.tokio_configured` = configured value
- `threads.host_available_parallelism` >= configured values

### Guardrails

Do NOT set both values far above available CPU cores. Over-subscription causes context-switch overhead and can reduce throughput.

Rule of thumb:

- `RAYON_NUM_THREADS <= host_available_parallelism`
- `TOKIO_WORKER_THREADS <= host_available_parallelism`

### Rollback (if latency regresses)

```bash
az webapp config appsettings set \
  --resource-group beamlab-ci-rg \
  --name beamlab-rust-api \
  --settings TOKIO_WORKER_THREADS=1 RAYON_NUM_THREADS=1

az webapp restart \
  --resource-group beamlab-ci-rg \
  --name beamlab-rust-api
```

### Success Criteria for Phase 1

After rollout and load test rerun:

1. Higher sustained concurrent analysis jobs before 429/5xx climb.
2. Analysis P95 remains within SLO target.
3. No increase in crash/restart frequency.

---

## Phase 2 Rollout — Analysis Backpressure & Queue Protection

### Objective

Protect full functionality during analysis bursts by bounding in-flight heavy requests and queue wait time.

### Changes Introduced

1. Added Node middleware gate for heavy compute endpoints:
   - Analysis routes: `/api/analyze`, `/api/analysis`
   - Advanced routes: `/api/advanced`
2. Bounded queue with graceful overload responses:
   - `BACKPRESSURE_QUEUE_FULL` (queue saturated)
   - `BACKPRESSURE_QUEUE_TIMEOUT` (wait too long)
3. Added runtime tuning env vars for per-lane control.

### Runtime Env Knobs (Node API)

- `ANALYSIS_MAX_IN_FLIGHT` (default 20)
- `ANALYSIS_MAX_QUEUE` (default 150)
- `ANALYSIS_QUEUE_TIMEOUT_MS` (default 45000)
- `ADVANCED_MAX_IN_FLIGHT` (default 10)
- `ADVANCED_MAX_QUEUE` (default 80)
- `ADVANCED_QUEUE_TIMEOUT_MS` (default 60000)

### Recommended Initial Production Values

Start conservative, then increase after load tests:

- Analysis lane: `20 / 150 / 45000`
- Advanced lane: `10 / 80 / 60000`

### Apply Settings (Azure)

```bash
az webapp config appsettings set \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node \
  --settings \
  ANALYSIS_MAX_IN_FLIGHT=20 \
  ANALYSIS_MAX_QUEUE=150 \
  ANALYSIS_QUEUE_TIMEOUT_MS=45000 \
  ADVANCED_MAX_IN_FLIGHT=10 \
  ADVANCED_MAX_QUEUE=80 \
  ADVANCED_QUEUE_TIMEOUT_MS=60000

az webapp restart \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node
```

### Verify Behavior

During burst tests, verify responses include:

- `X-Backpressure-Gate`
- `X-Backpressure-Queue-Wait-Ms` (when queued)
- `X-Backpressure-Queue-Depth` (when queued)

Expected under overload:

- `503` with `code=BACKPRESSURE_QUEUE_FULL` or `BACKPRESSURE_QUEUE_TIMEOUT`
- Normal API routes remain responsive

### Tuning Rules

1. If 503 queue full occurs early but CPU is low, increase `*_MAX_IN_FLIGHT` gradually.
2. If queue timeout dominates, increase compute capacity before increasing queue depth.
3. Keep queue timeout finite (avoid unbounded client wait).
4. Prioritize latency SLO over raw throughput.

### Rollback

If behavior regresses, temporarily relax values:

- Increase queue size modestly, or
- Set `*_MAX_IN_FLIGHT` to previous known-good values.

Then restart Node API and rerun load tests.

---

**Last Updated:** March 11, 2026  
**Tested By:** CI/CD pipelines on every commit  
**Next Review:** When infrastructure changes (e.g., Redis setup)

---

## Phase 3 — Traffic Lane Isolation (Node API)

**Objective:** Each compute class (analysis, advanced, design, AI) has its own
independent concurrency budget and backpressure gate so a burst on one lane
cannot saturate others.

### Lane Configuration

| Lane | In-Flight Default | Queue Default | Timeout |
|------|-------------------|---------------|---------|
| analysis | 20 | 150 | 45 s |
| advanced | 10 | 80 | 60 s |
| design | 15 | 100 | 45 s |
| ai | 5 | 50 | 30 s |

### Apply Settings (Azure)

```bash
az webapp config appsettings set \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node \
  --settings \
  ANALYSIS_MAX_IN_FLIGHT=20 \
  ANALYSIS_MAX_QUEUE=150 \
  ANALYSIS_QUEUE_TIMEOUT_MS=45000 \
  ADVANCED_MAX_IN_FLIGHT=10 \
  ADVANCED_MAX_QUEUE=80 \
  ADVANCED_QUEUE_TIMEOUT_MS=60000 \
  DESIGN_MAX_IN_FLIGHT=15 \
  DESIGN_MAX_QUEUE=100 \
  DESIGN_QUEUE_TIMEOUT_MS=45000 \
  AI_MAX_IN_FLIGHT=5 \
  AI_MAX_QUEUE=50 \
  AI_QUEUE_TIMEOUT_MS=30000

az webapp restart \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node
```

---

## Phase 4 — Azure Autoscaling Rules

**Objective:** Add Azure App Service autoscale rules so the Node API and Rust API
scale out before they saturate, rather than after.

### Prerequisite

Autoscale must be enabled at the App Service Plan level, not the App Service itself.

```bash
# Enable autoscaling on the Node API App Service Plan
az monitor autoscale create \
  --resource-group beamlab-ci-rg \
  --resource beamlab-backend-node \
  --resource-type Microsoft.Web/sites \
  --name beamlab-node-autoscale \
  --min-count 1 \
  --max-count 4 \
  --count 1
```

### Scale-Out Rule (CPU > 70% for 5 min)

```bash
az monitor autoscale rule create \
  --resource-group beamlab-ci-rg \
  --autoscale-name beamlab-node-autoscale \
  --condition "CpuPercentage > 70 avg 5m" \
  --scale out 1
```

### Scale-In Rule (CPU < 30% for 10 min)

```bash
az monitor autoscale rule create \
  --resource-group beamlab-ci-rg \
  --autoscale-name beamlab-node-autoscale \
  --condition "CpuPercentage < 30 avg 10m" \
  --scale in 1
```

### Rust API Autoscale (CPU > 80%)

The Rust API is CPU-bound. Scale it more aggressively:

```bash
az monitor autoscale create \
  --resource-group beamlab-ci-rg \
  --resource beamlab-rust-api \
  --resource-type Microsoft.Web/sites \
  --name beamlab-rust-autoscale \
  --min-count 1 \
  --max-count 6 \
  --count 1

az monitor autoscale rule create \
  --resource-group beamlab-ci-rg \
  --autoscale-name beamlab-rust-autoscale \
  --condition "CpuPercentage > 80 avg 5m" \
  --scale out 1

az monitor autoscale rule create \
  --resource-group beamlab-ci-rg \
  --autoscale-name beamlab-rust-autoscale \
  --condition "CpuPercentage < 30 avg 10m" \
  --scale in 1
```

### Verify

```bash
az monitor autoscale show \
  --resource-group beamlab-ci-rg \
  --name beamlab-node-autoscale
```

---

## Phase 5 — Cost-Weighted Rate Limiting

**Objective:** Per-user cost budget (shared across all endpoints in a window) so
a user running many advanced analyses consumes their budget faster.

### Cost Table

| Endpoint | Cost per call |
|----------|--------------|
| `/api/analysis` | 5 |
| `/api/design` | 3 |
| `/api/advanced` | 10 |
| `/api/ai` | 8 |
| CRUD | 0 (not subject to cost budget) |

Default budget: **200 tokens / window (60 s)** → roughly 40 analysis calls or 20 advanced calls per user per minute.

### Apply Settings (Azure)

```bash
az webapp config appsettings set \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node \
  --settings \
  RATE_LIMIT_DISTRIBUTED=true \
  REDIS_URL=<redis-connection-string> \
  RATE_LIMIT_COST_BUDGET=200

az webapp restart \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node
```

**Note:** Cost budgeting only activates when `RATE_LIMIT_DISTRIBUTED=true` and Redis is reachable. Without Redis, costs are silently bypassed and the per-endpoint flat rate limits remain active.

### Observable Headers

- `X-RateLimit-Cost-Limit`: User's total budget
- `X-RateLimit-Cost-Remaining`: Budget remaining in this window
- `X-RateLimit-Cost-Used`: Cost accumulated so far
- Response `429` with `code: COST_BUDGET_EXCEEDED` when over budget

---

## Phase 6 — Analysis Result Caching

**Objective:** Identical structural models return instantly from an in-process LRU
cache instead of re-running through the Rust solver.

### Configuration

```bash
az webapp config appsettings set \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node \
  --settings \
  ANALYSIS_CACHE_MAX_ENTRIES=500 \
  ANALYSIS_CACHE_TTL_MS=600000

az webapp restart \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node
```

### Verification

Response includes `X-Analysis-Cache: HIT` or `X-Analysis-Cache: MISS`.

Cache stats are exposed in `/health` (dev mode) under `analysisCache`:
- `size` — current entries
- `hits` / `misses` / `evictions`
- `hitRate` — e.g. `34.5` (percent)

---

## Phase 7 — Redis Distributed Rate Limiter (Production Activation)

**Objective:** Activate Redis-backed distributed rate limiting so limits are
enforced consistently when Node API scales to multiple instances.

### Prerequisites

1. Azure Cache for Redis instance provisioned (Basic C0 minimum; Standard C1 recommended)
2. Redis connection string obtained from Azure Portal → Resource → Access keys

### Apply Settings (Azure)

```bash
az webapp config appsettings set \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node \
  --settings \
  RATE_LIMIT_DISTRIBUTED=true \
  REDIS_URL="rediss://:PASSWORD@YOUR-REDIS.redis.cache.windows.net:6380"

az webapp restart \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-node
```

Use `rediss://` (TLS) for Azure Cache for Redis.

### Verify

Check startup logs for:
```
Redis distributed rate limiting enabled
```

If Redis is unreachable, the system automatically falls back to per-instance in-memory limits. No downtime occurs.

---

## Phase 8 — Load Tests and Capacity Numbers

**Objective:** Run the staged k6 suite and publish updated safe/stretch/burst capacity numbers.

### Prerequisites

```bash
brew install k6
export AUTH_TOKEN=<valid-bearer-token>
```

### Run

```bash
# Medium pressure (3 min) — recommended baseline
AUTH_TOKEN=$AUTH_TOKEN npm run load:capacity:w2

# Burst (4 min) — run before any major release
AUTH_TOKEN=$AUTH_TOKEN npm run load:capacity:w3

# Endurance (10 min) — weekly on staging
AUTH_TOKEN=$AUTH_TOKEN npm run load:capacity:w4

# Print capacity recommendation
npm run load:summary
```

### Capacity Update Process

1. Run `w3` on staging after each infrastructure change.
2. Run `node tests/load/capacity-summary.mjs ./k6-summary.json`.
3. Update ops runbook with new `safe / stretch / burst` numbers.
4. Adjust `*_MAX_IN_FLIGHT` and `*_MAX_QUEUE` accordingly.

### Current Capacity Baseline (Post Phase 1-2)

(Update after each load test run)

| Metric | Before Phases 1-2 | After Phases 1-2 |
|--------|-------------------|------------------|
| Safe concurrent jobs | ~60 | TBD (run w3) |
| Stretch | ~100 | TBD |
| Burst | ~120 | TBD |
| Rust threads | 1 | host_available_parallelism |
| Node backpressure | none | analysis=20, advanced=10 |

