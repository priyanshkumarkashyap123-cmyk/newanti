# Azure VM Automation — Current Status

**Date**: 19 March 2026  
**VM**: `gpu` (beamlab-ci-rg)  
**Status**: Running + Scheduled Shutdown Active + **User-Driven Auto-Scale Ready** ✨

---

## ✅ Completed: Auto-Shutdown (Fixed Schedule)

**Configuration:**
- `Resource`: `/subscriptions/2131a61f-38e0-40e6-a666-457c912974d1/resourcegroups/beamlab-ci-rg/providers/Microsoft.Compute/virtualMachines/gpu`
- `Schedule`: Daily at **22:00 UTC** (10 PM)
- `Notification`: Email to `rakshit007tiwari@gmail.com` 30 minutes before shutdown
- `Status`: **Enabled**
- `Provision State`: **Succeeded**

**Impact**: Prevents runaway costs by automatically shutting down the GPU VM at end of business each day.

---

## ✨ NEW: User-Driven Dynamic Auto-Scale (Cost Optimizing)

**Goal**: VM powers on **only when live users need it**, then off when idle → **save 50–70% compute costs**.

### How It Works

1. **Active User Detection**: WebSocket connections tracked in real-time
2. **Job Queue Monitoring**: GPU job depth exposed via `/api/v1/metrics/gpu-auto-scale`
3. **Logic App Decision**: Every 5 minutes, Azure Logic App checks:
   - Are there active users? → Start VM
   - Is there a job queue backlog? → Start VM
   - Been idle > 15 min AND queue empty? → Deallocate VM (save cost)

### New Metrics Endpoint

```
GET https://beamlab-backend-node.azurewebsites.net/api/v1/metrics/gpu-auto-scale
```

Response:
```json
{
  "timestamp": "2026-03-19T03:15:00Z",
  "metrics": {
    "activeUsers": 5,
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

### Setup Guide

**See**: [GPU_AUTOSCALE_USER_DRIVEN_SETUP.md](GPU_AUTOSCALE_USER_DRIVEN_SETUP.md)

Quick steps (Portal UI):
1. Create **Logic App** → `beamlab-gpu-autoscale`
2. Set trigger: **Recurrence** (every 5 minutes)
3. Add action: **HTTP GET** → metrics endpoint
4. Add condition: `if shouldStartVm == true` → run `az vm start`
5. Save & enable

---

## Cost Estimate (Post Auto-Scale)

| Scenario | Daily VM Runtime | Monthly Cost | Savings |
|----------|------------------|--------------|---------|
| **Before**: 24/7 | 24 hours | ~₹40,000 | — |
| **After (Fixed 22:00)**: Current | 14 hours | ~₹25,000 | ₹15,000/month |
| **After (User-Driven)**: NEW ✨ | 2–4 hours | ~₹5,000–10,000 | **₹30,000–35,000/month** |

> Assumes `Standard_NC4as_T4_v3` @ ~₹55/hr in Central India

---

## To Disable Fixed Shutdown & Go User-Driven Only

If you want **only** user-driven (no fixed 22:00 shutdown):

```bash
# Remove the fixed schedule
az rest --method delete \
  --uri "/subscriptions/2131a61f-38e0-40e6-a666-457c912974d1/resourcegroups/beamlab-ci-rg/providers/microsoft.devtestlab/schedules/shutdown-computevm-gpu?api-version=2018-09-15"
```

Then:
1. Deploy user-driven Logic App (see guide)
2. VM will now only shutdown if idle for > 15 min with zero queue

---

## Commands for Daily Operations

```bash
# Check VM status
az vm get-instance-view -g beamlab-ci-rg -n gpu \
  --query "instanceView.statuses[?starts_with(code, 'PowerState/')].displayStatus"

# Manually start (if needed)
az vm start -g beamlab-ci-rg -n gpu

# Manually stop
az vm deallocate -g beamlab-ci-rg -n gpu

# Check metrics
curl https://beamlab-backend-node.azurewebsites.net/api/v1/metrics/gpu-auto-scale | jq .

# View orchestrator config
az webapp config appsettings list -g beamlab-ci-rg -n beamlab-backend-node \
  --query "[?name=='AZURE_VM_ORCHESTRATOR_URL' || name=='AUTO_SCALE_ACTIVE_USERS_THRESHOLD']"
```

---

**Last Updated**: 19 March 2026, 03:30 UTC

If you want the GPU VM to **automatically start** at the beginning of business hours (e.g., 08:00 UTC), follow *one* of these methods:

### Option A: Azure Portal UI (Simplest)

1. Azure Portal → Resource Groups → `beamlab-ci-rg`
2. Select VM `gpu` → **Operations** → **Auto-shutdown**
3. Look for **Auto-start** button/tab (may be in same panel)
4. Set time: 08:00 UTC daily
5. Save

### Option B: Azure CLI + Automation Runbook (CLI-Native)

```bash
# Create Automation Account
az automation account create \
  -g beamlab-ci-rg \
  -n beamlab-automation \
  --sku Free

# Create Start Runbook (PowerShell)
az automation runbook create \
  -g beamlab-ci-rg \
  -n start-gpu-vm \
  --automation-account-name beamlab-automation \
  --type PowerShell

# Publish runbook content (placeholder — customize as needed)
az automation runbook content update \
  -g beamlab-ci-rg \
  -n start-gpu-vm \
  --automation-account-name beamlab-automation \
  --content @- << 'EOF'
Param(
  [Parameter(Mandatory=$true)]
  [String]$RPG,
  [Parameter(Mandatory=$true)]
  [String]$VMName
)
$connection = Get-AutomationConnection -Name AzureRunAsConnection
Connect-AzureRmAccount -ServicePrincipal -Tenant $connection.TenantID `
  -ApplicationId $connection.ApplicationID -CertificateThumbprint $connection.CertificateThumbprint
Start-AzureRmVM -ResourceGroupName $RG -Name $VMName
EOF

# Create schedule
az automation schedule create \
  -g beamlab-ci-rg \
  --automation-account-name beamlab-automation \
  -n gpu-start-schedule \
  --frequency Day \
  --interval 1 \
  --start-time "2026-03-20T08:00:00+00:00"

# Link schedule to runbook
az automation job-schedule create \
  -g beamlab-ci-rg \
  --automation-account-name beamlab-automation \
  --runbook-name start-gpu-vm \
  --schedule-name gpu-start-schedule \
  --parameters '{"RG":"beamlab-ci-rg","VMName":"gpu"}'
```

### Option C: Azure Function + Timer Trigger (Serverless)

Create a time-triggered Azure Function in Node/Python that calls:
```bash
az vm start -g beamlab-ci-rg -n gpu
```
at desired time each day.

---

## Current orchestrator status verification

```bash
# Check GPU fleet health
curl https://beamlab-backend-node.azurewebsites.net/health/dependencies | jq '.dependencies.gpuFleet'

# Expected output (healthy):
# {
#   "healthy": true,
#   "activeWorkers": 1,
#   "queueDepth": 0,
#   "latencyMs": 18,
#   "configured": true
# }
```

---

## Cost Estimate (Post-Automation)

| Scenario | Daily ShutdownTime | Monthly Cost Savings |
|----------|-------------------|----------------------|
| **Before** (24/7 running) | Never | — |
| **After** (shutdown 22:00–08:00, 10h/day) | 10 hours | ~₹15,000–20,000 |

> Assumes `Standard_NC4as_T4_v3` (₹55/hour approx in Central India)

---

## Commands for Daily Operations

```bash
# Check VM status
az vm get-instance-view -g beamlab-ci-rg -n gpu \
  --query "instanceView.statuses[?starts_with(code, 'PowerState/')].displayStatus"

# Manually start (if needed)
az vm start -g beamlab-ci-rg -n gpu

# Manually stop
az vm deallocate -g beamlab-ci-rg -n gpu

# View orchestrator config
az webapp config appsettings list -g beamlab-ci-rg -n beamlab-backend-node \
  --query "[?name=='AZURE_VM_ORCHESTRATOR_URL']"
```

---

**Last Updated**: 19 March 2026, 03:15 UTC
