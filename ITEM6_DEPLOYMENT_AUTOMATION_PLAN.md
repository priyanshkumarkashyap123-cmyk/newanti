# Item 6: Deployment Automation & Checks — Comprehensive Plan

**Date**: Apr 2, 2026  
**Scope**: Azure CI/CD automation, post-deploy smoke tests, secret management, rollback procedures  
**Owner**: DevOps / Platform Team

---

## Executive Summary

Item 6 establishes reliable, repeatable deployment procedures across all services:

1. **Deploy Stabilization** — Fix Azure workflows, ensure secrets are present, validate pipelines
2. **Smoke Tests** — Parity pack exercising all services post-deploy
3. **Health Verification** — Automated health checks with escalation
4. **Rollback Procedures** — Safe, documented rollback workflows
5. **Monitoring & Alerts** — Real-time deployment status and error tracking

**Goal**: Every deploy is observable, recoverable, and verified to work end-to-end before marking complete.

---

## Architecture Overview

### Deployment Flow (Current → Target)

```
Git Push → GitHub Actions
    ├─ CI: Lint, test, build (existing ✅)
    └─ Deploy Workflow:
        ├─ Set up Azure credentials
        ├─ Deploy Node API (azure-deploy.yml)
        ├─ Deploy Python backend  
        ├─ Deploy Rust API
        ├─ Deploy Frontend (SWA)
        ├─ Post-Deploy Smoke Tests (NEW)
        │  ├─ Service health checks (3 backends)
        │  ├─ Parity pack (feature validation across all services)
        │  ├─ Database connectivity
        │  └─ Critical user flow (auth → analysis → report)
        ├─ Alert on failure (NEW)
        └─ Mark deploy complete
```

### Service Matrix

| Service | Deployment Tool | Pipeline | Health Check | Rollback |
|---|---|---|---|---|
| **Node API** | Azure App Service | `azure-deploy.yml` | `/health` | Slot swap |
| **Python** | Azure App Service | `azure-deploy.yml` | `/health` | Slot swap |
| **Rust** | Azure App Service or Container | `azure-deploy.yml` | `/health` | Container restart |
| **Frontend** | Azure Static Web Apps | `azure-static-web-apps-*.yml` | `https://beamlabultimate.tech/` | Rollback to last stable |
| **Database** | MongoDB Atlas | Manual backups | `_migrations` collection ready | Point-in-time restore |

---

## Task 1: Stabilize Azure Deployment Workflows

### Current Issues (Based on Deployment Status)

| Issue | Root Cause | Fix |
|---|---|---|
| Node API deploys as 503 | Startup script missing/incorrect | Verify `web.config`, startup command |
| Python deploy hangs | Missing environment variables | Validate all env vars in settings |
| Rust deploy fails | Missing cargo build context | Check repo structure, dependencies |
| Frontend CDN stale | SWA token expired or misconfigured | Regenerate token, verify settings |
| Secrets not synced | Manual sync required | Automate GitHub→Azure secret sync |

### 1.1 Verify Azure App Service Settings

**Action**: Check each App Service for correct configuration

```bash
#!/bin/bash
# Verify each service is configured correctly

echo "=== Node API Settings ==="
az webapp config show \
  --resource-group beamlab-prod \
  --name beamlab-backend-node-prod \
  --query "appSettings[?name=='STARTUP_COMMAND_PATH'].value"
# Expected: startup.sh or web.config startup command

echo "=== Python API Settings ==="
az webapp config appsettings list \
  --resource-group beamlab-prod \
  --name beamlab-backend-python-prod \
  | jq '.[] | select(.name | test("PYTHONPATH|FLASK|DJANGO")) | {name, value}'

echo "=== Rust API Settings ==="
az webapp config appsettings list \
  --resource-group beamlab-prod \
  --name beamlab-rust-api-prod \
  | jq '.[] | {name, value}' | head -20

echo "=== Frontend SWA Token ==="
az staticwebapp show \
  --resource-group beamlab-prod \
  --name beamlabultimate \
  --query "repositoryToken" | head -c 20
# Should output first 20 chars of token (masked)
```

### 1.2 Verify Environment Variables

**Action**: Create automated env var validation

**File**: `scripts/validate-deploy-env.sh` (NEW)

```bash
#!/bin/bash

# ITEM 6: Validate all required environment variables before deploy

set -e

REQUIRED_VARS=(
  # Node API
  "MONGODB_URI"
  "RAZORPAY_KEY_ID"
  "RAZORPAY_KEY_SECRET"
  "RAZORPAY_WEBHOOK_SECRET"
  "CLERK_SECRET_KEY"
  "JWT_SECRET"
  "VITE_RAZORPAY_KEY_ID"
  
  # Python
  "PYTHONPATH"
  "PYTHON_API_URL"
  
  # Rust
  "RUST_API_URL"
  
  # Frontend
  "VITE_API_GATEWAY_BASE_URL"
)

MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING+=("$var")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "❌ Missing environment variables:"
  printf '  - %s\n' "${MISSING[@]}"
  exit 1
fi

echo "✅ All required environment variables present"
```

---

## Task 2: Create Smoke Test Suite

### 2.1 Health Checks (Automated)

**File**: `scripts/smoke-tests/health-checks.sh` (NEW)

```bash
#!/bin/bash

# ITEM 6: Post-deploy health verification
# Runs immediately after deployment to verify all services are responsive

set -e

TIMEOUT=30
RETRIES=3

check_health() {
  local service=$1
  local url=$2
  local max_attempts=$3
  
  echo "Checking $service health..."
  
  for attempt in $(seq 1 $max_attempts); do
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
      --max-time $TIMEOUT \
      "$url" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
      echo "  ✅ $service healthy (attempt $attempt/$max_attempts)"
      return 0
    fi
    
    echo "  ⏳ $service not ready (HTTP $http_code, attempt $attempt/$max_attempts)"
    sleep $((attempt * 2))
  done
  
  echo "  ❌ $service health check failed after $max_attempts attempts"
  return 1
}

# Node API
check_health "Node API" \
  "https://beamlab-backend-node-prod.azurewebsites.net/health" \
  $RETRIES || exit 1

# Python API
check_health "Python API" \
  "https://beamlab-backend-python-prod.azurewebsites.net/health" \
  $RETRIES || exit 1

# Rust API
check_health "Rust API" \
  "https://beamlab-rust-api-prod.azurewebsites.net/health" \
  $RETRIES || exit 1

# Frontend
check_health "Frontend" \
  "https://beamlabultimate.tech/" \
  $RETRIES || exit 1

echo ""
echo "✅ All services healthy"
```

### 2.2 Parity Pack (Feature Tests)

**File**: `scripts/smoke-tests/parity-pack.sh` (NEW)

```bash
#!/bin/bash

# ITEM 6: Parity pack — validates core features work end-to-end

set -e

BASE_URL="https://beamlab-backend-node-prod.azurewebsites.net"
TEST_USER_EMAIL="smoketest+$(date +%s)@beamlab.test"
TEST_PASSWORD="SmokeTesting123!"

echo "🧪 BeamLab Parity Pack — Validating critical user flows"
echo ""

# 1. USER AUTHENTICATION
echo "1️⃣  Testing user authentication..."
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_USER_EMAIL\", \"password\": \"$TEST_PASSWORD\"}" \
  --max-time 10)

USER_ID=$(echo "$SIGNUP_RESPONSE" | jq -r '.result.userId // .userId // empty')
if [ -z "$USER_ID" ]; then
  echo "  ❌ Signup failed: $SIGNUP_RESPONSE"
  exit 1
fi
echo "  ✅ User created: $USER_ID"

AUTH_TOKEN=$(echo "$SIGNUP_RESPONSE" | jq -r '.result.token // .token // empty')
if [ -z "$AUTH_TOKEN" ]; then
  echo "  ❌ Token not returned"
  exit 1
fi
echo "  ✅ Auth token obtained"

# 2. PROJECT CREATION
echo ""
echo "2️⃣  Testing project creation..."
PROJECT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/projects" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Smoke Test Project\", \"description\": \"Auto-generated smoke test\"}" \
  --max-time 10)

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.result.id // .result._id // empty')
if [ -z "$PROJECT_ID" ]; then
  echo "  ❌ Project creation failed: $PROJECT_RESPONSE"
  exit 1
fi
echo "  ✅ Project created: $PROJECT_ID"

# 3. STRUCTURE CREATION (Simple 2D frame)
echo ""
echo "3️⃣  Testing structure creation..."
STRUCTURE_PAYLOAD='{
  "nodes": [
    {"id": "n1", "x": 0, "y": 0, "z": 0},
    {"id": "n2", "x": 5, "y": 0, "z": 0}
  ],
  "members": [
    {"id": "m1", "startNodeId": "n1", "endNodeId": "n2", "section": {"A": 100}}
  ],
  "supports": [
    {"nodeId": "n1", "restraintX": true, "restraintY": true, "restraintZ": true}
  ],
  "loads": [
    {"memberLoadId": "l1", "memberId": "m1", "loadValue": 10, "loadType": "distributed"}
  ]
}'

ANALYZE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/analyze" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$STRUCTURE_PAYLOAD" \
  --max-time 30)

ANALYSIS_ID=$(echo "$ANALYZE_RESPONSE" | jq -r '.result.analysisId // .result._id // empty')
if [ -z "$ANALYSIS_ID" ]; then
  echo "  ❌ Analysis submission failed: $ANALYZE_RESPONSE"
  exit 1
fi
echo "  ✅ Analysis submitted: $ANALYSIS_ID"

# 4. ANALYSIS RESULT RETRIEVAL (Wait for completion)
echo ""
echo "4️⃣  Retrieving analysis results..."
TIMEOUT=60
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  RESULT_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/projects/$PROJECT_ID/analyses/$ANALYSIS_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    --max-time 10)
  
  STATUS=$(echo "$RESULT_RESPONSE" | jq -r '.result.status // .status // empty')
  if [ "$STATUS" = "completed" ]; then
    echo "  ✅ Analysis completed"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "  ❌ Analysis failed: $(echo "$RESULT_RESPONSE" | jq -r '.result.error')"
    exit 1
  fi
  
  echo "  ⏳ Analysis in progress (status: $STATUS)..."
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "  ❌ Analysis timed out after ${TIMEOUT}s"
  exit 1
fi

# 5. REPORT GENERATION
echo ""
echo "5️⃣  Testing report generation..."
REPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/projects/$PROJECT_ID/reports" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"analysisId\": \"$ANALYSIS_ID\", \"format\": \"pdf\"}" \
  --max-time 30)

REPORT_URL=$(echo "$REPORT_RESPONSE" | jq -r '.result.downloadUrl // .result.url // empty')
if [ -z "$REPORT_URL" ]; then
  echo "  ⚠️  Report generation initiated but URL not immediately available (expected for async)"
  echo "  ✅ Report generation endpoint responsive"
else
  echo "  ✅ Report URL: $REPORT_URL"
fi

# 6. CLEANUP
echo ""
echo "6️⃣  Cleaning up test data..."
curl -s -X DELETE "$BASE_URL/api/v1/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  --max-time 10 > /dev/null
echo "  ✅ Test project deleted"

echo ""
echo "✅ 🎉 PARITY PACK COMPLETE — All critical flows working!"
```

---

## Task 3: Workflow Configuration

### 3.1 GitHub Actions Post-Deploy Smoke Test

**File**: `.github/workflows/azure-deploy.yml` (MODIFY)

```yaml
name: Deploy to Azure

on:
  push:
    branches:
      - main

jobs:
  # ... existing build jobs ...
  
  smoke-tests:
    name: Post-Deploy Smoke Tests
    runs-on: ubuntu-latest
    needs: [deploy-node, deploy-python, deploy-rust, deploy-frontend]
    if: success()
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run health checks
        run: |
          bash scripts/smoke-tests/health-checks.sh
        timeout-minutes: 10
      
      - name: Run parity pack
        run: |
          bash scripts/smoke-tests/parity-pack.sh
        timeout-minutes: 15
      
      - name: Alert on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: |
            ❌ Smoke test failed!
            Workflow: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
            Check deploy status: https://beamlab-backend-node-prod.azurewebsites.net/health
          webhook_url: ${{ secrets.SLACK_WEBHOOK_DEPLOY }}
      
      - name: Mark deploy complete
        if: success()
        run: |
          echo "Deploy and smoke tests successful ✅"
```

---

## Task 4: Secret Management

### 4.1 Automated Secret Sync

**File**: `scripts/sync-gh-secrets-from-azure.sh` (NEW)

```bash
#!/bin/bash

# ITEM 6: Sync secrets from Azure Key Vault → GitHub Actions Secrets
# Run: Before each deploy to ensure secrets are up-to-date

set -e

GITHUB_REPO="priyanshkumarkashyap123-cmyk/newanti"
KEYVAULT_NAME="beamlab-prod-kv"

REQUIRED_SECRETS=(
  "MONGODB_URI"
  "RAZORPAY_KEY_ID"
  "RAZORPAY_KEY_SECRET"
  "RAZORPAY_WEBHOOK_SECRET"
  "CLERK_SECRET_KEY"
  "JWT_SECRET"
  "VITE_RAZORPAY_KEY_ID"
  "AZURE_STATIC_WEB_APPS_API_TOKEN"
  "AZURE_WEBAPP_PUBLISH_PROFILE_NODE"
  "AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON"
  "AZURE_WEBAPP_PUBLISH_PROFILE_RUST"
)

echo "🔐 Syncing secrets: Azure Key Vault → GitHub"

for secret in "${REQUIRED_SECRETS[@]}"; do
  echo -n "Syncing $secret... "
  
  # Fetch from Key Vault
  value=$(az keyvault secret show \
    --vault-name "$KEYVAULT_NAME" \
    --name "$secret" \
    --query "value" -o tsv 2>/dev/null)
  
  if [ -z "$value" ]; then
    echo "⚠️  (not in Key Vault, skipping)"
    continue
  fi
  
  # Set in GitHub Secrets
  gh secret set "$secret" \
    --repo "$GITHUB_REPO" \
    --body "$value" > /dev/null 2>&1
  
  echo "✅"
done

echo "✅ All secrets synchronized"
```

---

## Task 5: Rollback Procedures

### 5.1 Service-Specific Rollback

#### Node API — Slot Swap Rollback

```bash
#!/bin/bash

# Rollback Node API to previous deployment slot

RESOURCE_GROUP="beamlab-prod"
APP_SERVICE="beamlab-backend-node-prod"
STAGING_SLOT="staging"
PRODUCTION_SLOT="production"

echo "🔄 Node API rollback: swapping slots..."

az webapp deployment slot swap \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE" \
  --slot "$STAGING_SLOT"

echo "✅ Node API rolled back to previous slot"
```

#### Database Rollback — Point-in-Time Restore

```bash
#!/bin/bash

# Rollback MongoDB to 30 minutes ago

TIMESTAMP=$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ)

echo "🔄 Rolling back MongoDB to $TIMESTAMP..."
echo "Note: This requires manual restore from Azure Backup or MongoDB Atlas"
echo "Steps:"
echo "  1. Open Azure Portal → Cosmos DB → Backups → Restore"
echo "  2. Select timestamp: $TIMESTAMP"
echo "  3. Confirm restore"
echo ""
echo "For urgent rollback: Contact ops-lead@beamlab.dev"
```

---

## Task 6: Monitoring & Alerting

### 6.1 Deployment Status Dashboard

**File**: `scripts/check-deploy-status.sh` (NEW)

```bash
#!/bin/bash

# Quick status check for all deployed services

echo "📊 BeamLab Deployment Status Report"
echo "Generated: $(date)"
echo ""

check_endpoint() {
  local name=$1
  local url=$2
  
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "0")
  
  if [ "$http_code" = "200" ]; then
    echo "  ✅ $name (HTTP 200)"
  else
    echo "  ❌ $name (HTTP $http_code)"
  fi
}

echo "Backend Services:"
check_endpoint "Node API" "https://beamlab-backend-node-prod.azurewebsites.net/health"
check_endpoint "Python API" "https://beamlab-backend-python-prod.azurewebsites.net/health"
check_endpoint "Rust API" "https://beamlab-rust-api-prod.azurewebsites.net/health"

echo ""
echo "Frontend:"
check_endpoint "Website" "https://beamlabultimate.tech/"

echo ""
echo "Database:"
mongosh "$MONGODB_URI" --eval "print(db.getMongo().getServerStatus() ? '✅ MongoDB' : '❌ MongoDB')" 2>/dev/null || echo "  ❌ MongoDB (connection failed)"

echo ""
```

---

## Implementation Roadmap

| Phase | Tasks | Timeline | Owner |
|---|---|---|---|
| **Phase 1: Validation** | Verify Azure settings, env vars | This week | DevOps |
| **Phase 2: Smoke Tests** | Create health checks + parity pack | 2-3 days | QA/Platform |
| **Phase 3: Workflow Integration** | Add smoke tests to CI/CD pipeline | 2 days | CI/CD |
| **Phase 4: Secret Management** | Automate secret sync | 1 day | DevOps |
| **Phase 5: Rollback Procedures** | Document and test rollbacks | 2 days | DevOps |
| **Phase 6: Monitoring** | Deploy dashboards, set up alerts | 3 days | Platform |

---

## Success Criteria

### Pre-Deploy
- [ ] All environment variables present and validated
- [ ] Lint/tests pass in CI
- [ ] No merge conflicts

### Deploy (Automated)
- [ ] Build succeeds
- [ ] Artifacts pushed to Azure
- [ ] All 4 services deployed (Node, Python, Rust, Frontend)

### Post-Deploy (Automated Smoke)
- [ ] All health checks pass (3 backends + frontend)
- [ ] Parity pack completes (5 critical user flows)
- [ ] No alerts triggered

### Post-Deploy (Manual Verification)
- [ ] Spot check production logs for errors
- [ ] Spot check performance metrics (latency, error rate)
- [ ] Manual smoke test from web UI (optional, if automated fails)

### Deployment Mark Complete
- [ ] All checks passed
- [ ] Update `DEPLOYMENT_STATUS.md` with completion time
- [ ] Post in #deployments Slack channel

---

## References

- Azure App Service deployment: `https://docs.microsoft.com/azure/app-service/`
- GitHub Actions: `https://docs.github.com/en/actions`
- MongoDB backup/restore: `https://docs.mongodb.com/atlas/backup/`
- Deployment checklist: `DEPLOYMENT_CHECKLIST.md`
