# 🚀 BeamLab Local Development Setup Guide

## Overview

This guide will help you get BeamLab running on **localhost:5173** with:
- ✅ **No authentication required** (login bypass enabled)
- ✅ **All features unlocked** (subscription tiers disabled)
- ✅ **Full component access** (PDF export, AI, advanced design codes, unlimited projects/analyses)

---

## 📋 Service Architecture

Your local setup will run 4 services in parallel:

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| **Frontend** | Vite React | `5173` | Web UI & user interface |
| **Node API** | Express.js | `3001` | Main backend, auth, workspace, payment processing |
| **Python API** | FastAPI | `8000` | Design analysis, FEA, AI assistant |
| **Rust API** | Axum | `8080` | High-performance structural solver |

---

## ✨ What's Already Configured

### Authentication Bypass
- `RequireAuth.tsx` component checks if you're on `localhost:5173`
- If yes → **skips login entirely**
- You get instant access to all protected routes

### Subscription Unlocking  
- `VITE_TEMP_UNLOCK_ALL=true` in `.env.local`
- Enables all features in the subscription hook
- `canAccess()` always returns `true`
- `requiresUpgrade()` always returns `false`

### API Endpoints
All configured in `.env.local`:
```
VITE_API_URL=http://localhost:3001
VITE_PYTHON_API_URL=http://localhost:8000
VITE_RUST_API_URL=http://localhost:8080
VITE_WEBSOCKET_URL=ws://localhost:8000/ws
```

---

## 🚀 Quick Start (Recommended)

### Option 1: Automated Startup Script

```bash
cd /Users/rakshittiwari/Desktop/newanti
./START_LOCAL_DEV.sh
```

This script:
1. Kills any existing services on ports 3001, 8000, 8080, 5173
2. Starts all 4 services in parallel
3. Waits for them to become healthy
4. Shows access points and logs

**Then open:**
```
http://localhost:5173
```

**To stop all services:**
```
Ctrl+C in the terminal
```

---

## 🔧 Manual Startup (If You Prefer)

If you need to start services individually:

### Terminal 1: Node Backend
```bash
cd apps/api
npm run dev

# Expected output:
# [STARTUP] ✅ Server listening successfully!
# BeamLab Ultimate API running on http://localhost:3001
```

### Terminal 2: Python Backend
```bash
cd apps/backend-python

# First time: create venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start server
python main.py

# Expected output:
# 🔌 Binding to port: 8000
# INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Terminal 3: Rust Backend
```bash
cd apps/rust-api

# First time (takes 2-3 min): 
cargo build --release

# Start server
cargo run --release

# Expected output:
# 🦀 BeamLab Rust API listening on 0.0.0.0:8080
```

### Terminal 4: Frontend Dev Server
```bash
cd apps/web
npm install  # if needed
npm run dev

# Expected output:
# ➜  local:   http://localhost:5173/
```

---

## 🌐 Accessing the Website

Once all 4 services are running:

1. **Open browser**: http://localhost:5173
2. **No login needed** - you're automatically authenticated locally
3. **All features unlocked** - create unlimited projects, export PDFs, use AI

---

## 🔍 Troubleshooting

### Port Already in Use

If you see error like `EADDRINUSE: address already in use :::3001`:

```bash
# Kill process on port 3001 (Node API)
lsof -i :3001
kill -9 <PID>

# Or kill all Node processes
pkill -f "npm run dev"
pkill -f "node"
```

Same for other ports:
```bash
kill -9 $(lsof -t -i :8000)    # Python
kill -9 $(lsof -t -i :8080)    # Rust
kill -9 $(lsof -t -i :5173)    # Frontend
```

### Dependencies Missing

```bash
# Node backend
cd apps/api && npm install

# Python backend  
cd apps/backend-python && pip install -r requirements.txt

# Frontend
cd apps/web && npm install
```

### Logs

Logs are saved to `/logs/` directory:
```bash
tail -f logs/frontend.log       # Frontend dev server
tail -f logs/node-api.log       # Node.js backend
tail -f logs/python-api.log     # Python backend
tail -f logs/rust-api.log       # Rust backend
```

### MongoDB Not Running

Some endpoints may fail if MongoDB is not running. This is OK for frontend development.

For full functionality, you may need:
```bash
# If using Docker
docker run -d -p 27017:27017 --name mongodb mongo

# Or if MongoDB is installed locally
brew services start mongodb-community
```

---

## 🛡️ Security Notes

⚠️ **These settings are FOR DEVELOPMENT ONLY:**

1. **`VITE_TEMP_UNLOCK_ALL=true`** - Never set in production
2. **No authentication on localhost** - Only works on `localhost:5173`
3. **Test Razorpay keys** - Not real credentials

Production deployments use:
- Live Clerk authentication
- Real subscription checks
- Production Razorpay keys
- HTTPS

---

## 🔄 Reload & Hot Updates

- **Frontend changes** → Auto-reload via Vite HMR (Hot Module Replacement)
- **Node API changes** → Restart with `Ctrl+C` and `npm run dev`
- **Python API changes** → Restart with `Ctrl+C` and `python main.py`
- **Rust API changes** → Rebuild and restart

---

## 📝 Environment Variables Reference

### .env.local (Frontend - apps/web/.env.local)

```bash
# Clerk Auth - localhost bypass automatically skips this
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_USE_CLERK=true

# API Endpoints
VITE_API_URL=http://localhost:3001
VITE_PYTHON_API_URL=http://localhost:8000
VITE_RUST_API_URL=http://localhost:8080
VITE_WEBSOCKET_URL=ws://localhost:8000/ws

# Unlock all features (DO NOT SET IN PRODUCTION)
VITE_TEMP_UNLOCK_ALL=true

# Payment Gateway (test keys)
VITE_RAZORPAY_KEY_ID=rzp_test_DO6Cd6wnC84zgh
VITE_PAYMENT_GATEWAY=razorpay
```

### Backend ENV Files

**apps/api/.env** - Check example for Node API vars
**apps/backend-python/.env** - Check example for Python API vars  
**apps/rust-api/.env** - Check example for Rust API vars

---

## ✅ Verification Checklist

After starting services, verify:

- [ ] Frontend loads at http://localhost:5173
- [ ] No login screen appears
- [ ] Dashboard/workspace visible
- [ ] Can create new projects
- [ ] Design codes accessible
- [ ] PDF export option available
- [ ] AI assistant enabled
- [ ] No "upgrade required" messages
- [ ] WebSocket connection shows in browser DevTools

---

## 🎯 Common Development Tasks

### Create a Test Project
1. Go to Dashboard
2. Click "New Project"
3. Fill details, click Create
4. Access all features without restrictions

### Test Analysis Features
1. Create beam/column/slab
2. Add loads
3. Run analysis (no "daily limit" warnings)
4. Export PDF (enabled for all users locally)

### Export & Download
1. Complete an analysis
2. Click "Export Report"
3. PDF downloads immediately
4. No payment required

### Use AI Assistant
1. Open any design calculation
2. Click "Ask AI"
3. AI responds (powered by Python backend)
4. No subscription limit

---

## 💡 Tips

1. **Keep terminal open** - Shows live logs as you work
2. **Check logs on error** - All errors logged to `/logs/` files
3. **Use DevTools** - Open browser DevTools (F12) to debug frontend
4. **Database optional** - For demo/frontend work, MongoDB not required
5. **Local-only features** - WebGPU and advanced GPU features work better locally

---

## 🆘 Need Help?

If services don't start:

1. Check ports aren't in use: `lsof -i :5173; lsof -i :3001; lsof -i :8000; lsof -i :8080`
2. Check logs: `tail -f logs/*.log`
3. Verify Node/Python/Rust installed: `node -v; python3 -v; rustc --version`
4. Try manual startup to see errors clearly
5. Check .env files exist in each service directory

---

## 🎉 You're Ready!

Your local BeamLab environment is fully configured for development. 

**Happy coding! 🚀**
