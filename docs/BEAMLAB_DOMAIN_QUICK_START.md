# 🌐 BeamLab Ultimate - Domain Quick Start

**Production Domain: https://beamlabultimate.tech**

## Setup Your Custom Domain (5 minutes)

### Step 1: Configure Local Domain

Run the automatic setup script:

```bash
cd /Users/rakshittiwari/Desktop/newanti
./setup-domain.sh
```

**What it does:**
- Adds domain entries to /etc/hosts for local development
- Sets up: app.beamlabultimate.local, api.beamlabultimate.local
- Flushes DNS cache
- Verifies domain resolution

**Alternative (Manual):**
```bash
sudo nano /etc/hosts

# Add these lines:
127.0.0.1    app.beamlabultimate.local
127.0.0.1    api.beamlabultimate.local
127.0.0.1    python-api.beamlabultimate.local
127.0.0.1    beamlabultimate.local
::1          app.beamlabultimate.local
::1          api.beamlabultimate.local
```

### Step 2: Create .env.local File

```bash
cp .env.local.example .env.local
```

The `.env.local` includes production domain URLs:
- `VITE_API_URL=http://api.beamlabultimate.local:3001`
- `VITE_PYTHON_API_URL=http://api.beamlabultimate.local:3002`
- All domain-based URLs configured

### Step 3: Start Servers

**Option A: Use pnpm (Recommended)**
```bash
pnpm dev
```

**Option B: Use Docker Compose**
```bash
docker-compose -f docker-compose.bheemla.yml up
```

**Option C: Manual - Multiple Terminals**

Terminal 1 (Frontend):
```bash
cd apps/web
npm run dev
# Accessible at: http://app.beamlabultimate.local:5173
```

Terminal 2 (API):
```bash
cd apps/api
npm run dev
# Running on: http://api.beamlabultimate.local:3001
```

Terminal 3 (Python AI API):
```bash
cd apps/backend-python
python -m uvicorn main:app --host 0.0.0.0 --port 3002 --reload
# Running on: http://api.beamlabultimate.local:3002
```

### Step 4: Access Your App

**Local Development:**
```
http://app.beamlabultimate.local:5173
```

**Production:**
```
https://beamlabultimate.tech
```

---

## Verify Setup

### Test Domain Resolution
```bash
ping app.beamlabultimate.local
ping api.beamlabultimate.local
```

All should resolve to `127.0.0.1`

### Test Server Access
```bash
# Frontend
curl -I http://app.beamlabultimate.local:5173

# API
curl http://api.beamlabultimate.local:3001/health

# Python API
curl http://api.beamlabultimate.local:3002/health
```

All should return HTTP 200

### Check Running Services
```bash
lsof -i -P -n | grep LISTEN | grep -E "5173|3001|3002"
```

Expected output:
```
node  ... TCP *:5173 (LISTEN)    # Frontend
node  ... TCP *:3001 (LISTEN)    # API
python... TCP *:3002 (LISTEN)    # Python API
```

---

## Your Domain URLs

| Service | Local Development | Production |
|---------|------------------|------------|
| **Frontend** | http://app.beamlabultimate.local:5173 | https://beamlabultimate.tech |
| **Node API** | http://api.beamlabultimate.local:3001 | https://api.beamlabultimate.tech |
| **Python API** | http://api.beamlabultimate.local:3002 | https://python-api.beamlabultimate.tech |
| **Database UI** | http://localhost:8080 (Adminer - Docker) | - |
| **Redis** | localhost:6379 | - |

---

## Production Domain Features

Your production domain **https://beamlabultimate.tech** includes:

- ✅ HTTPS with SSL certificate
- ✅ Azure Static Web Apps for frontend
- ✅ Container Apps for backends
- ✅ Custom domain configured
- ✅ CDN for global distribution
- ✅ Automatic scaling

---

## Troubleshooting

### Domain Not Resolving?
```bash
# Check /etc/hosts
cat /etc/hosts | grep beamlab

# Flush DNS cache (Mac)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Flush DNS cache (Linux)
sudo systemctl restart systemd-resolved
```

### Servers Not Starting?
```bash
# Check if ports are in use
lsof -i :5173
lsof -i :3001
lsof -i :3002

# Kill processes on those ports if needed
kill -9 <PID>
```

### CORS Errors?
```bash
# Check API is running
curl http://api.beamlabultimate.local:3001/health

# Check ALLOWED_ORIGINS in .env.local includes:
# http://app.beamlabultimate.local:5173
# https://beamlabultimate.tech
```

### Hot Reload Not Working?
```bash
# Clear browser cache (Cmd+Shift+R on Mac)
# Check Vite config has correct host
# Restart dev server
```

---

## Quick Commands

```bash
# Setup domain (first time only)
./setup-domain.sh

# Start all servers
pnpm dev

# Start with Docker
docker-compose -f docker-compose.bheemla.yml up -d

# Stop servers
pkill -f "pnpm|node|python"

# View running services
lsof -i -P -n | grep LISTEN

# Test connectivity
ping app.beamlabultimate.local
curl http://api.beamlabultimate.local:3001/health

# Deploy to production
./deploy_complete.sh
```

---

## Environment Comparison

| Environment | Frontend URL | API URL | Database |
|------------|-------------|---------|----------|
| **Local Dev** | app.beamlabultimate.local:5173 | api.beamlabultimate.local:3001 | localhost:27017 |
| **Production** | beamlabultimate.tech | api.beamlabultimate.tech | Azure MongoDB |

---

## What Changed from Localhost

| Before (Localhost) | After (BeamLab Ultimate Domain) |
|-------------------|--------------------------------|
| http://localhost:5173 | http://app.beamlabultimate.local:5173 |
| http://localhost:3001 | http://api.beamlabultimate.local:3001 |
| VITE_API_URL=http://localhost:3001 | VITE_API_URL=http://api.beamlabultimate.local:3001 |
| Manual port management | Automatic domain routing |
| No production setup | Production domain configured |

---

## Production Deployment

When ready to deploy to **https://beamlabultimate.tech**:

1. **Update Environment for Production**
   ```env
   VITE_API_URL=https://api.beamlabultimate.tech
   VITE_FRONTEND_URL=https://beamlabultimate.tech
   FRONTEND_URL=https://beamlabultimate.tech
   ```

2. **Deploy to Azure**
   ```bash
   ./deploy_complete.sh
   ```

3. **Access Production**
   - Frontend: https://beamlabultimate.tech
   - All APIs automatically configured

---

## No More Localhost! 🚀

Your application is now configured with the **BeamLab Ultimate** domain:

- **Local Development**: app.beamlabultimate.local
- **Production**: https://beamlabultimate.tech

All CORS, environment variables, and server configs work seamlessly across both environments.

**Ready to go!** 

Access your app:
- **Local**: http://app.beamlabultimate.local:5173
- **Production**: https://beamlabultimate.tech

---

*Last Updated: 2026-01-04*
*Domain: BeamLab Ultimate (beamlabultimate.tech)*
