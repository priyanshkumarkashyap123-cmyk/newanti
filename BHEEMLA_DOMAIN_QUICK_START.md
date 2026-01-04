# 🌐 Bheemla Ultimate - Domain Quick Start

## Setup Your Custom Domain (5 minutes)

### Step 1: Configure Local Domain

Run the automatic setup script:

```bash
cd /Users/rakshittiwari/Desktop/newanti
chmod +x setup-domain.sh
./setup-domain.sh
```

**What it does:**
- Adds domain entries to /etc/hosts
- Flushes DNS cache
- Verifies domain resolution

**Alternative (Manual):**
```bash
sudo nano /etc/hosts

# Add these lines:
127.0.0.1    app.bheemla.local
127.0.0.1    api.bheemla.local
127.0.0.1    python-api.bheemla.local
::1          app.bheemla.local
::1          api.bheemla.local
::1          python-api.bheemla.local
```

### Step 2: Create .env.local File

```bash
cp .env.local.example .env.local
```

The `.env.local` includes:
- `VITE_API_URL=http://api.bheemla.local:3001`
- `VITE_PYTHON_API_URL=http://api.bheemla.local:3002`
- All domain-based URLs

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
# Listen on: http://app.bheemla.local:5173
```

Terminal 2 (API):
```bash
cd apps/api
npm run dev
# Listen on: http://api.bheemla.local:3001
```

Terminal 3 (Python API):
```bash
cd apps/backend-python
python -m uvicorn main:app --host 0.0.0.0 --port 3002 --reload
# Listen on: http://api.bheemla.local:3002
```

### Step 4: Access Your App

Open in browser:
```
http://app.bheemla.local:5173
```

All APIs will automatically use:
- **Node.js API**: http://api.bheemla.local:3001
- **Python API**: http://api.bheemla.local:3002

---

## Verify Setup

### Test Domain Resolution
```bash
ping app.bheemla.local
ping api.bheemla.local
ping python-api.bheemla.local
```

All should resolve to `127.0.0.1`

### Test Server Access
```bash
# Frontend
curl -I http://app.bheemla.local:5173

# API
curl -I http://api.bheemla.local:3001/health

# Python API
curl -I http://api.bheemla.local:3002/health
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

| Service | URL | Note |
|---------|-----|------|
| **Frontend** | http://app.bheemla.local:5173 | Main app |
| **Node API** | http://api.bheemla.local:3001 | REST API |
| **Python API** | http://api.bheemla.local:3002 | AI/Gemini API |
| **Adminer** | http://localhost:8080 | Database UI (Docker) |
| **Redis** | localhost:6379 | Cache (Docker) |

---

## Troubleshooting

### Domain Not Resolving?
```bash
# Check /etc/hosts
cat /etc/hosts | grep bheemla

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
curl http://api.bheemla.local:3001/health

# Check ALLOWED_ORIGINS in .env.local
# Should include: http://app.bheemla.local:5173
```

### Hot Reload Not Working?
```bash
# Clear browser cache (Cmd+Shift+R on Mac)
# Check Vite config has correct host
# Restart dev server
```

---

## Production Domain Setup

When ready for real domain:

1. **Purchase Domain**
   - Bheemla Ultimate domain (e.g., bheemla-ultimate.tech)
   
2. **Update Environment**
   ```env
   VITE_API_URL=https://api.bheemla-ultimate.tech
   VITE_FRONTEND_URL=https://www.bheemla-ultimate.tech
   FRONTEND_URL=https://www.bheemla-ultimate.tech
   ```

3. **Deploy to Azure**
   ```bash
   ./deploy_complete.sh
   ```

4. **Configure DNS**
   - Point A records to Azure IPs
   - Enable HTTPS certificates

---

## Quick Commands

```bash
# Setup domain (first time)
./setup-domain.sh

# Start all servers
pnpm dev

# Start with Docker
docker-compose -f docker-compose.bheemla.yml up

# Stop servers
pkill -f "pnpm\|node\|python"

# View running services
lsof -i -P -n | grep LISTEN

# Test connectivity
ping app.bheemla.local
curl http://api.bheemla.local:3001/health

# View server logs
tail -f /tmp/dev-servers.log
```

---

## What Changed from Localhost

| Before (Localhost) | After (Bheemla Domain) |
|-------------------|----------------------|
| http://localhost:5173 | http://app.bheemla.local:5173 |
| http://localhost:3001 | http://api.bheemla.local:3001 |
| VITE_API_URL=http://localhost:3001 | VITE_API_URL=http://api.bheemla.local:3001 |
| Manual port management | Automatic domain routing |

---

## No More Localhost! 🚀

Your application is now configured to use the Bheemla Ultimate domain:
- **Local Development**: app.bheemla.local
- **Production Ready**: bheemla-ultimate.tech (when you get domain)

All CORS, environment variables, and server configs are set up automatically.

**Ready to go!** Access your app at: **http://app.bheemla.local:5173**

---

*Last Updated: 2026-01-04*
*Domain: Bheemla Ultimate*
