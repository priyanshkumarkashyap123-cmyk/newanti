# GPU Auto-Scale Configuration — User-Driven Dynamic VM

**Goal**: VM power on/off automatically based on **live website users** and **GPU job queue depth**, not on a fixed schedule.

**Benefit**: Save ~50–70% on compute costs by only running the VM when needed.

---

## How It Works

### 1. Metrics Collection (New `/api/v1/metrics/gpu-auto-scale` endpoint)

Exposes:
- **Active WebSocket users** on the platform (connected in real-time)
- **GPU queue depth** (jobs waiting for compute)
- **Recent job submissions** (last 5 minutes)
- **Recommendation**: Whether VM should start or can stay off

### 2. Azure Logic App (Runs Every 5 Minutes)

- Polls `/api/v1/metrics/gpu-auto-scale`
- **Decision logic**:
  - If `activeUsers > 0` OR `queueDepth > 0` OR `recentSubmissions > 0` → **Start VM** (idempotent, safe to call many times)
  - If idle for 15+ minutes AND queue empty → **Deallocate VM** (saves money)

### 3. Automatic Shutdown (Existing)

- Fixed schedule: **22:00 UTC daily** (as already configured)
- Email notification: `rakshit007tiwari@gmail.com` 30 min before

---

## Quick Setup (Azure Portal)

### Step 1: Create Logic App

**Azure Portal:**
1. Search: **Logic Apps**
2. Click **+ Create**
3. Basics:
   - Name: `beamlab-gpu-autoscale`
   - Resource group: `beamlab-ci-rg`
   - Location: `Central India`
   - Plan: **Consumption**
4. Click **Review + Create** → **Create**

### Step 2: Designer — Add Trigger

1. Navigate to newly created Logic App
2. Click **Edit in designer**
3. Start with: **Recurrence**
   - Interval: `5`
   - Frequency: `Minute`
4. Click **+ New step**

### Step 3: Call Metrics Endpoint

1. **Action**: Search for **HTTP**
2. Select **HTTP** action:
   - Method: `GET`
   - URI: `https://beamlab-backend-node.azurewebsites.net/api/v1/metrics/gpu-auto-scale`
   - Advanced: No auth required (endpoint is public)

### Step 4: Parse Response

1. **+ New step** → Add action: **Parse JSON**
2. Content: Select output from HTTP step
3. Schema:
   ```json
   {
     "properties": {
       "autoScale": {
         "properties": {
           "reason": { "type": "string" },
           "shouldStartVm": { "type": "boolean" }
         },
         "type": "object"
       },
       "metrics": {
         "properties": {
           "activeUsers": { "type": "integer" },
           "gpuActiveWorkers": { "type": "integer" },
           "gpuHealthy": { "type": "boolean" },
           "gpuQueueDepth": { "type": "integer" },
           "recentJobSubmissions": { "type": "integer" }
         },
         "type": "object"
       }
    }
   }
   ```

### Step 5: Condition — Should Start VM?

1. **+ New step** → **Condition**
2. Choose a value: Select `shouldStartVm` from Parse JSON
3. is equal to: `true`
4. If **true**, go to **Action A** (next step)
5. If **false**, go to **Action B** (skip)

### Step 6 (TRUE branch): Start VM

1. In the **True** branch, click **Add an action**
2. Search: **Azure Resource Manager** (`ARM`)
3. Select **Create or update resource**
4. Settings:
   - Subscription: *(your Azure for Students subscription)*
   - Resource group: `beamlab-ci-rg`
   - Resource type: `Microsoft.Compute/virtualMachines`
   - Resource name: `gpu`
   - API version: `2021-07-01`
   - Body:
     ```json
     {
       "properties": {}
     }
     ```

**Alternative (simpler — use Azure CLI in a Function):**

If ARM doesn't work, use **Azure Automation Runbook** or **Azure Function** to call:
```bash
az vm start -g beamlab-ci-rg -n gpu
```

### Step 7 (FALSE branch): Check Idle Timeout

1. In the **False** branch, click **Add an action**
2. Add **Lookup in history** (or use a **Variable** to track last active time):
   - If `timeSinceLastActivity > 15 minutes` AND `queueDepth == 0`:
     - Call another ARM action to deallocate: `az vm deallocate -g beamlab-ci-rg -n gpu`
   - Else: Do nothing (VM stays deallocated)

### Step 8: Save & Enable

1. Click **Save**
2. Repeat firing: Ensure "**Run** trigger is enabled"
3. Test: Click **Run** manually to confirm metrics endpoint returns data

---

## CLI Alternative (Faster if Familiar with ARM Templates)

```bash
# Deploy Logic App via CLI (saves clicks in portal)
az logic workflow create \
  --resource-group beamlab-ci-rg \
  --location centralindia \
  --name beamlab-gpu-autoscale \
  --definition @logic-app-definition.json

# Where logic-app-definition.json contains the full workflow (see template below)
```

---

## Monitoring & Testing

### Test Metrics Endpoint Directly

```bash
curl https://beamlab-backend-node.azurewebsites.net/api/v1/metrics/gpu-auto-scale | jq .

# Expected output:
{
  "timestamp": "2026-03-19T03:15:00Z",
  "metrics": {
    "activeUsers": 5,
    "recentJobSubmissions": 2,
    "gpuQueueDepth": 1,
    "gpuActiveWorkers": 1,
    "gpuHealthy": true
  },
  "autoScale": {
    "shouldStartVm": true,
    "reason": "active users"
  }
}
```

### Simulate User Activity (for testing)

Frontend can manually trigger a job submission to test:

```bash
# Submit a test GPU job
curl -X POST https://beamlab-backend-node.azurewebsites.net/api/v1/gpu-jobs \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "solver": "pdelta",
    "input": {"nodes": [{"id": 1, "x": 0, "y": 0, "z": 0}]}
  }'

# Then check metrics
curl https://beamlab-backend-node.azurewebsites.net/api/v1/metrics/gpu-auto-scale | jq .metrics.gpuQueueDepth
```

### Monitor Logic App Runs

1. Azure Portal → `beamlab-gpu-autoscale` Logic App
2. Click **Overview** → **Runs history**
3. Check each run for:
   - Status: **Succeeded** or **Failed**
   - Metrics reported
   - Actions executed

---

## Cost Estimate (With Auto-Scale)

| Scenario | VM Runtime Per Day | Monthly Cost Savings |
|----------|-------------------|----------------------|
| **Before** (24/7 fixed schedule) | 14 hours (22:00–12:00 next day off) | — |
| **After** (user-driven) | 2–4 hours (only during work hours) | **₹20,000–30,000** |

Assumes:
- Average 2–4 users per day during work hours
- `Standard_NC4as_T4_v3` at ~₹55/hour
- Logic App cost: negligible (~₹5/month)

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Logic App not firing | Trigger disabled | Portal → Logic App → **Overview** → Enable trigger |
| Metrics endpoint 401 | Auth issue | Route is public; no token needed. Check URL spelling |
| VM not starting | ARM permissions | Logic App identity needs **Contributor** role on VM. Portal → VM → **Access Control (IAM)** → Add role assignment |
| Idle timeout too long | Not detecting idle | Reduce grace period in condition (default 15 min). Adjust `shouldStartVm` logic in metrics endpoint |
| Queue depth stays > 0 | Jobs stuck | Check `/health/dependencies` → `gpuFleet`. Manually restart GPU service if needed |

---

## Next Steps

1. ✅ **Deploy Logic App** via portal or CLI (above)
2. ✅ **Test metrics endpoint** with curl (above)
3. ✅ **Monitor first 24 hours** of auto-scale behavior
4. ✅ **Optional**: Set up Application Insights alerts if VM starts too often

---

## Environment Variables (Optional Tuning)

In App Service config (`beamlab-backend-node`):

| Var | Default | Purpose |
|-----|---------|---------|
| `AUTO_SCALE_ACTIVE_USERS_THRESHOLD` | `1` | Start VM if active users ≥ this number |
| `AUTO_SCALE_IDLE_TIMEOUT_MIN` | `15` | Deallocate after N minutes of inactivity |

To adjust:

```bash
az webapp config appsettings set \
  -g beamlab-ci-rg \
  -n beamlab-backend-node \
  --settings AUTO_SCALE_ACTIVE_USERS_THRESHOLD=2 AUTO_SCALE_IDLE_TIMEOUT_MIN=20
```

---

**Last Updated**: 19 March 2026  
**Created By**: BeamLab Auto-Scale System
