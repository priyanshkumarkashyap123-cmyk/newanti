# BeamLab — GPU Deployment Blueprint
## Component Map · Environment Variable Matrix · Day-by-Day Rollout

> **Audience:** beginner / non-DevOps engineer  
> **Goal:** take BeamLab from "runs on my laptop" to "serves 10 000 concurrent users with GPU-accelerated solvers — on Azure"

---

## Part 1 — What Each Component Does (Plain English)

```
Browser / Desktop App
        │
        │  HTTPS
        ▼
┌─────────────────────────────────────────────────────────┐
│  Azure App Service  (always-on, auto-scaled)            │
│                                                         │
│  ① Node API  (port 3001)  ──── auth, billing, routing   │
│  ② Rust API  (port 8080)  ──── fast solver engine       │
│  ③ Python API(port 8000)  ──── design checks, AI        │
└──────────────┬──────────────────────────────────────────┘
               │ submits heavy GPU jobs
               ▼
┌─────────────────────────────────────────────────────────┐
│  Azure VM Scale Set  (GPU workers, scale 0→N)           │
│                                                         │
│  Each VM:  Ubuntu 22.04 + NVIDIA drivers + CUDA         │
│            Python worker process reads job queue        │
│            Sends result back to Node API webhook        │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
        Azure Redis Cache  (job queue, rate-limit state)
        Azure Cosmos DB / MongoDB Atlas  (persistent data)
        Azure Key Vault  (secrets — never in .env in prod)
```

### What each service handles

| Service | Language | Owns |
|---------|----------|------|
| Node API | TypeScript | Login, billing (Razorpay/PhonePe), project CRUD, job routing |
| Rust API | Rust | Direct Stiffness Method, stiffness matrix assembly, fast linear solvers |
| Python API | Python | IS 456 / IS 800 design checks, AI assistant, report generation |
| GPU Workers (VMSS) | Python + CUDA | P-Delta, nonlinear FEM, buckling eigenvalue, modal analysis |

---

## Part 2 — Environment Variable Matrix

> Fill every cell before go-live.  `dev` = your laptop, `stage` = test Azure slot, `prod` = live.

### 2.1 Core Server

| Variable | dev | stage | prod |
|----------|-----|-------|------|
| `NODE_ENV` | `development` | `production` | `production` |
| `PORT` | `3001` | `3001` | `3001` |
| `MONGODB_URI` | `mongodb://localhost:27017/beamlab` | Atlas connection string | Atlas connection string (prod cluster) |

### 2.2 Authentication (Clerk)

| Variable | dev | stage | prod |
|----------|-----|-------|------|
| `USE_CLERK` | `true` | `true` | `true` |
| `CLERK_SECRET_KEY` | From Clerk dev dashboard | From Clerk stage app | From Clerk prod app |
| `CLERK_PUBLISHABLE_KEY` | From Clerk dev dashboard | From Clerk stage app | From Clerk prod app |
| `VITE_CLERK_PUBLISHABLE_KEY` | Same as above | Same as above | Same as above |

**Where to get it:** https://dashboard.clerk.com → Your app → API Keys

### 2.3 Payment Gateways

| Variable | dev | stage | prod |
|----------|-----|-------|------|
| `VITE_PAYMENT_GATEWAY` | `both` | `both` | `razorpay` OR `phonepe` OR `both` |
| `RAZORPAY_KEY_ID` | Test key from Razorpay dashboard | Test key | Live key |
| `RAZORPAY_KEY_SECRET` | Test secret | Test secret | Live secret |
| `RAZORPAY_WEBHOOK_SECRET` | Any random string | From Razorpay webhook settings | From Razorpay webhook settings |
| `VITE_RAZORPAY_KEY_ID` | Same as RAZORPAY_KEY_ID | Same | Same |
| `PHONEPE_MERCHANT_ID` | UAT merchant ID | UAT merchant ID | Prod merchant ID |
| `PHONEPE_SALT_KEY` | UAT salt | UAT salt | Prod salt |
| `PHONEPE_ENV` | `UAT` | `UAT` | `PRODUCTION` |
| `PHONEPE_CALLBACK_URL` | `http://localhost:3001/api/billing/webhook` | `https://stage.beamlab.in/api/billing/webhook` | `https://beamlab.in/api/billing/webhook` |

**Where to get it:**  
- Razorpay: https://dashboard.razorpay.com → Settings → API Keys  
- PhonePe: Contact PhonePe business onboarding team

### 2.4 Azure App Service & Backends

| Variable | dev | stage | prod |
|----------|-----|-------|------|
| `PYTHON_API_URL` | `http://localhost:8000` | `https://stage-python.azurewebsites.net` | `https://prod-python.azurewebsites.net` |
| `RUST_API_URL` | `http://localhost:8080` | `https://stage-rust.azurewebsites.net` | `https://prod-rust.azurewebsites.net` |
| `FRONTEND_URL` | `http://localhost:5173` | `https://stage.beamlab.in` | `https://beamlab.in` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | `https://stage.beamlab.in` | `https://beamlab.in` |

### 2.5 Redis

| Variable | dev | stage | prod |
|----------|-----|-------|------|
| `REDIS_URL` | `redis://redis:6379` | `rediss://<stage-redis>.redis.cache.windows.net:6380` | `rediss://<prod-redis>.redis.cache.windows.net:6380` |
| `RATE_LIMIT_DISTRIBUTED` | `false` | `true` | `true` |

**Where to get it:** Azure Portal → Redis Cache → Access keys (use the primary connection string)

### 2.6 GPU VM Orchestrator

| Variable | dev | stage | prod |
|----------|-----|-------|------|
| `AZURE_VM_ORCHESTRATOR_URL` | *(leave blank — falls back to Python)* | `http://<stage-orchestrator-vm-ip>:8090` | `http://<prod-orchestrator-vm-ip>:8090` |
| `AZURE_VM_ORCHESTRATOR_API_KEY` | *(leave blank)* | Random 64-char hex string | Different 64-char hex string |
| `AZURE_VM_RESOURCE_GROUP` | — | `beamlab-stage-rg` | `beamlab-prod-rg` |
| `AZURE_VM_SCALE_SET` | — | `beamlab-stage-vmss` | `beamlab-prod-vmss` |
| `AZURE_VM_HTTP_TIMEOUT_MS` | — | `30000` | `30000` |
| `AZURE_VM_CIRCUIT_THRESHOLD` | — | `5` | `5` |
| `AZURE_VM_CIRCUIT_RESET_MS` | — | `60000` | `60000` |

### 2.7 Observability

| Variable | dev | stage | prod |
|----------|-----|-------|------|
| `SENTRY_DSN` | *(leave blank)* | From Sentry stage project | From Sentry prod project |
| `VITE_SENTRY_DSN` | *(leave blank)* | From Sentry stage project | From Sentry prod project |

---

## Part 3 — Day-by-Day Rollout Plan

### Day 1 — Azure Accounts & Resource Groups

**What you do (30 minutes):**

1. Log into https://portal.azure.com with your Microsoft account.
2. Click **"Subscriptions"** — note your Subscription ID.  
   *(Your ID is already in .env: `AZURE_SUBSCRIPTION_ID=2131a61f-...`)*
3. Create a Resource Group:
   - Search "Resource Groups" → **+ Create**
   - Name: `beamlab-prod-rg`
   - Region: `Central India` (closest to your users)
4. Create a second Resource Group for staging:
   - Name: `beamlab-stage-rg`
   - Same region

**Why two groups?** Stage group is your safety net — you can break things there without affecting real users.

---

### Day 2 — Databases

**MongoDB Atlas (free tier to start):**
1. Sign up at https://cloud.mongodb.com
2. Create Cluster → Free tier (M0) → Region: Mumbai (ap-south-1)
3. Database tab → Add Database User (username + strong password)
4. Network Access → Add IP Address → Allow from App Service (or 0.0.0.0/0 for now, lock down later)
5. Connect → Compass → copy the URI → paste into `.env` as `MONGODB_URI`

**Azure Redis Cache:**
1. Azure Portal → **Create a resource** → "Azure Cache for Redis"
2. Name: `beamlab-prod-redis`
3. Location: `Central India`
4. SKU/Size: **Basic C1** (1 GB, ~₹900/month) — upgrade to Standard C2 when >500 users
5. After creation → **Access keys** → copy **Primary connection string**
6. Paste into `.env` as `REDIS_URL` (replace `redis://` with `rediss://` for TLS)
7. Set `RATE_LIMIT_DISTRIBUTED=true`

---

### Day 3 — App Service Deployment

**Node API, Rust API, Python API on Azure App Service:**

1. Azure Portal → **App Services** → **+ Create**
2. Create 3 App Services (one per backend):

   | Name | Runtime | SKU |
   |------|---------|-----|
   | `beamlab-node-api` | Node 20 LTS | **B3** (1.75 GB RAM, 2 vCPU) |
   | `beamlab-rust-api` | Docker / Custom | **B2** |
   | `beamlab-python-api` | Python 3.11 | **B3** |

3. In each App Service → **Configuration** → **Application settings** → add all env vars from Part 2 (never put secrets in code).

4. **Deploy the code:**
   - Option A (easy): Connect App Service to your GitHub repo → enable auto-deploy on push to `main`.
   - Option B: Use the `deploy.sh` script already in the repo root.

5. test: `curl https://beamlab-node-api.azurewebsites.net/health`  
   Expected: `{"status":"healthy",...}`

---

### Day 4 — Payment Gateway Keys

**Razorpay:**
1. Sign up at https://razorpay.com → Dashboard → **Settings** → **API Keys** → Generate Test Key
2. Copy `key_id` → `RAZORPAY_KEY_ID` and `VITE_RAZORPAY_KEY_ID`
3. Copy `key_secret` → `RAZORPAY_KEY_SECRET`
4. Dashboard → **Webhooks** → **+ Add New Webhook**
   - URL: `https://beamlab-node-api.azurewebsites.net/api/billing/razorpay/webhook`
   - Events: `payment.captured`, `payment.failed`, `subscription.activated`
   - Copy the webhook secret → `RAZORPAY_WEBHOOK_SECRET`

**PhonePe (optional — skip if using only Razorpay):**
1. Apply at https://business.phonepe.com/merchants/signup
2. After approval: Dashboard → **UAT Credentials** → copy Merchant ID + Salt Key
3. Set `PHONEPE_MERCHANT_ID`, `PHONEPE_SALT_KEY`, `PHONEPE_ENV=UAT`

**Frontend switch:**
- Set `VITE_PAYMENT_GATEWAY=razorpay` to show only Razorpay to users.

---

### Day 5 — Single GPU VM (Benchmark)

> Purpose: prove the GPU workers solve a real model before you build the full VMSS.

**5.1 Create one GPU VM:**
1. Azure Portal → **Virtual Machines** → **+ Create**
2. Region: `Central India`
3. Image: `Ubuntu Server 22.04 LTS`
4. Size: **Standard NC4as T4 v3** (4 vCPU, 28 GB RAM, 1x NVIDIA T4 — ~₹15/hr)
5. Authentication: SSH public key (generate with `ssh-keygen -t ed25519` on your Mac)
6. Ports: allow SSH (22), and your orchestrator port (8090) — restricted to App Service IP only
7. Click create, wait ~5 minutes

**5.2 Connect and set up the VM:**
```bash
# From your Mac terminal:
ssh -i ~/.ssh/id_ed25519 azureuser@<vm-public-ip>

# On the VM:
sudo apt update && sudo apt upgrade -y

# Install NVIDIA drivers
sudo apt install -y ubuntu-drivers-common
sudo ubuntu-drivers autoinstall
sudo reboot
# Reconnect after reboot:
ssh -i ~/.ssh/id_ed25519 azureuser@<vm-public-ip>

# Verify GPU:
nvidia-smi
# Should show: Tesla T4, Driver Version, CUDA Version

# Install Python + dependencies:
sudo apt install -y python3.11 python3.11-venv python3-pip git
python3 -m pip install --upgrade pip

# Clone your repo and install worker deps:
git clone https://github.com/YOUR_ORG/beamlab.git
cd beamlab/apps/backend-python
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Install CUDA Python:
pip install cupy-cuda12x  # matches CUDA 12.x from nvidia-smi output
```

**5.3 Start the orchestrator Flask server:**
```bash
# Create a minimal orchestrator (receives jobs from Node API, dispatches to solvers):
cat > /home/azureuser/orchestrator.py << 'EOF'
import os, json, threading, uuid
from flask import Flask, request, jsonify

app = Flask(__name__)
API_KEY = os.environ.get("ORCHESTRATOR_API_KEY", "changeme")
jobs: dict = {}

def require_auth(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {API_KEY}":
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return wrapper

@app.route("/health")
def health():
    return jsonify({"healthy": True, "activeWorkers": 1, "queueDepth": len([j for j in jobs.values() if j["status"] == "queued"])})

@app.route("/jobs", methods=["POST"])
@require_auth
def submit():
    job_id = str(uuid.uuid4())
    payload = request.json
    jobs[job_id] = {"jobId": job_id, "status": "queued", "payload": payload}
    # In production: push to a proper queue (Redis) and let workers pick up
    threading.Thread(target=run_job, args=(job_id, payload), daemon=True).start()
    return jsonify({"jobId": job_id, "status": "queued"}), 202

@app.route("/jobs/<job_id>")
@require_auth
def status(job_id):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Not found"}), 404
    return jsonify(job)

@app.route("/jobs/<job_id>", methods=["DELETE"])
@require_auth
def cancel(job_id):
    if job_id in jobs:
        jobs[job_id]["status"] = "cancelled"
    return jsonify({"cancelled": True})

def run_job(job_id: str, payload: dict):
    jobs[job_id]["status"] = "running"
    try:
        # TODO: import actual solver and call it here
        import time; time.sleep(2)  # placeholder
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["output"] = {"message": "placeholder result — wire real solver here"}
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8090)
EOF

export ORCHESTRATOR_API_KEY="<generate-a-64-char-random-hex-string>"
python3 orchestrator.py &
```

**5.4 Update .env (App Service Configuration):**
```
AZURE_VM_ORCHESTRATOR_URL=http://<vm-private-ip>:8090
AZURE_VM_ORCHESTRATOR_API_KEY=<same-64-char-key>
```

**5.5 Verify the connection:**
```bash
# From your Mac, through the Node API:
curl -X POST https://beamlab-node-api.azurewebsites.net/api/v1/gpu-jobs/queue \
  -H "Authorization: Bearer <your-jwt-token>"
# Should return fleet health info
```

---

### Day 6 — Build Golden Image → Create VMSS

> Once the single VM works, turn it into a template (Image) and let Azure manage a fleet from it.

**6.1 Capture the VM as a Managed Image:**
1. Azure Portal → your VM → **Capture** button at the top
2. Name: `beamlab-gpu-worker-v1`
3. Select: "Share image to gallery" → create a gallery `beamlabGPUImages`
4. Azure will stop and generalise the VM (takes ~10 minutes)

**6.2 Create the VM Scale Set:**
1. Azure Portal → **+ Create** → search "Virtual Machine Scale Sets"
2. **Basics:**
   - Resource group: `beamlab-prod-rg`
   - Name: `beamlab-prod-vmss`
   - Region: `Central India`
   - Image: select `beamlab-gpu-worker-v1` from your gallery
   - Size: `Standard NC4as T4 v3`
3. **Scaling:**
   - Initial count: `0` (saves cost — scales to 0 when idle)
   - Minimum: `0`
   - Maximum: `10`
4. **Scaling rule (scale out):**
   - Metric: CPU Percentage > 70% for 5 minutes → add 2 instances
5. **Scaling rule (scale in):**
   - CPU < 10% for 30 minutes → remove 1 instance
6. Set env var: `AZURE_VM_SCALE_SET=beamlab-prod-vmss`

**6.3 Update orchestrator URL:**
- The VMSS assigns a private IP to each instance.
- Put a **load balancer** in front of the VMSS:
  - Azure Portal → your VMSS → **Networking** → **Load balancer** → Create new
  - Name: `beamlab-gpu-lb`
  - Frontend IP: private (accessible only from App Service VNet)
- Update: `AZURE_VM_ORCHESTRATOR_URL=http://<load-balancer-private-ip>:8090`

---

### Day 7 — Security Hardening & Go-Live Checklist

#### Security

- [ ] Move all secrets from App Service "Application Settings" to **Azure Key Vault**:
  ```
  Azure Portal → Key Vault → Secrets → + Generate/Import
  ```
  Then reference them in App Service:
  ```
  @Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/RAZORPAY_KEY_SECRET/)
  ```

- [ ] Restrict VMSS NSG (Network Security Group):
  - Inbound port 8090: allow ONLY from App Service outbound IPs
  - Block all other inbound traffic

- [ ] Enable Azure DDoS Protection Standard on the Virtual Network

- [ ] Set up Azure Monitor alert:
  - Alert when HTTP 5xx > 50/minute → email + SMS

#### Payments

- [ ] Switch Razorpay from Test to Live keys
- [ ] Set `PHONEPE_ENV=PRODUCTION` (if using PhonePe)
- [ ] Test one real ₹1 payment end-to-end before launch

#### Final Smoke Test

```bash
# Run the existing smoke test:
cd /Users/rakshittiwari/Desktop/newanti
bash smoke-test.sh
```

Expected output: all checks pass.

---

## Part 4 — Cost Estimate (Monthly)

| Resource | SKU | Est. Cost (INR/month) |
|----------|-----|-----------------------|
| App Service Plan (3 apps) | B3 × 3 | ₹12,000 |
| Redis Cache | Basic C1 | ₹900 |
| MongoDB Atlas | M10 Dedicated | ₹5,000 |
| GPU VM Scale Set | NC4as T4 (2 avg instances) | ₹45,000 |
| Bandwidth | 100 GB/month | ₹800 |
| **Total** | | **~₹64,000/month** |

> Start cheaper: use MongoDB Atlas M0 (free) + Redis C0 (free tier) + VMSS min=0 to keep costs near ₹15,000/month until you have paying users.

---

## Part 5 — Quick Command Reference

```bash
# Check GPU fleet health (from any terminal)
curl https://beamlab-node-api.azurewebsites.net/health/dependencies

# Submit a GPU job (replace JWT_TOKEN with a real token)
curl -X POST https://beamlab-node-api.azurewebsites.net/api/v1/gpu-jobs \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"solver":"pdelta","input":{"nodes":[],"elements":[]}}'

# Poll job status
curl https://beamlab-node-api.azurewebsites.net/api/v1/gpu-jobs/<JOB_ID> \
  -H "Authorization: Bearer $JWT_TOKEN"

# SSH into a VMSS instance (for debugging)
az vmss list-instance-connection-info \
  --resource-group beamlab-prod-rg \
  --name beamlab-prod-vmss
```

---

*Last updated: 17 March 2026*
