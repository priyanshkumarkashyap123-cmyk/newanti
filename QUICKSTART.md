# 🚀 QUICKSTART — BeamLab Local Development

## ⚡ 30-Second Setup

```bash
cd /Users/rakshittiwari/Desktop/newanti
./START_LOCAL_DEV.sh
```

Then open: **http://localhost:5173**

**Done!** ✅ No login needed, all features unlocked.

---

## 📋 What Just Happened?

1. ✅ **Frontend** — Vite dev server on port 5173
2. ✅ **Node API** — Express backend on port 3001  
3. ✅ **Python API** — FastAPI analysis engine on port 8000
4. ✅ **Rust API** — High-performance solver on port 8080

All running in parallel. All features unlocked. No auth required.

---

## 🎯 You Can Now:

- ✅ Create unlimited projects
- ✅ Run unlimited analyses
- ✅ Export reports as PDF
- ✅ Use AI assistant
- ✅ Access advanced design codes (IS 456, IS 800, ACI 318, etc.)
- ✅ No "upgrade required" messages
- ✅ No subscription tiers
- ✅ Full component access

---

## 🔧 If Something Goes Wrong

### Services won't start?
```bash
# Kill any lingering processes
pkill -f "npm run dev"
pkill -f "python main.py"
pkill -f "cargo run"

# Then try again
./START_LOCAL_DEV.sh
```

### Port already in use?
```bash
# Find what's using port 3001
lsof -i :3001

# Kill it
kill -9 <PID>
```

### Missing dependencies?
```bash
# Node frontend
cd apps/web && npm install

# Python backend  
cd apps/backend-python && pip install -r requirements.txt
```

---

## 📝 Or Start Manually (4 Terminals)

**Terminal 1 — Frontend:**
```bash
cd apps/web && npm run dev
# → http://localhost:5173
```

**Terminal 2 — Node API:**
```bash
cd apps/api && npm run dev
# → http://localhost:3001
```

**Terminal 3 — Python API:**
```bash
cd apps/backend-python
python main.py
# → http://localhost:8000
```

**Terminal 4 — Rust API:**
```bash
cd apps/rust-api
cargo run --release
# → http://localhost:8080
```

Then open: http://localhost:5173

---

## ✨ What's Already Configured

### Frontend (.env.local)
- ✅ Auth bypassed on localhost
- ✅ All features unlocked (`VITE_TEMP_UNLOCK_ALL=true`)
- ✅ API endpoints configured
- ✅ No login screen appears

### AuthProvider Hook
- ✅ Detects localhost:5173
- ✅ Returns fake "dev" user automatically
- ✅ No Clerk auth on localhost
- ✅ `isSignedIn` always true

### Subscription Hook
- ✅ `VITE_TEMP_UNLOCK_ALL` flag set to true
- ✅ `canAccess()` always returns true
- ✅ `requiresUpgrade()` always returns false
- ✅ All premium features available

---

## 📊 Verify Everything Works

```bash
./VERIFY_LOCAL_DEV.sh
```

Shows live health of all 4 services.

---

## 🛑 To Stop All Services

```bash
# If using START_LOCAL_DEV.sh
Ctrl+C in the terminal

# Or manually
pkill -f "npm run dev"
pkill -f "python main.py"
pkill -f "cargo run"
```

---

## 🎓 Full Documentation

For detailed setup, troubleshooting, and development tips:

👉 **[LOCAL_DEVELOPMENT_SETUP.md](./LOCAL_DEVELOPMENT_SETUP.md)**

---

## ✅ Ready?

```bash
./START_LOCAL_DEV.sh
```

🎉 Happy developing!
