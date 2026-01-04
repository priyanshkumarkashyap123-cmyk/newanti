# BeamLab Complete Setup Guide

> **Updated: 4 Jan 2026** - All systems integrated: Rust/WASM (WebGPU), Python FastAPI backend, Azure deployment, environment management.

## Quick Start (5 minutes)

### 1. Local Development Setup

```bash
cd /Users/rakshittiwari/Desktop/newanti

# Interactive setup (you'll be prompted for API keys)
python config_manager.py local

# Or non-interactive with defaults
python config_manager.py local --no-interactive
```

This creates a `.env` file with sensible defaults for local development:
- Mock AI enabled (no Gemini key needed)
- Localhost CORS origins
- All systems fallback gracefully

### 2. Start Backend

```bash
cd apps/backend-python

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Start Frontend

```bash
cd apps/web

# Install WASM package (local solver-wasm)
pnpm install

# Start dev server
pnpm run dev
```

### 4. Test Everything

```bash
# Health check
curl http://localhost:8000/health

# AI status (will show mock mode)
curl http://localhost:8000/ai/status

# Frontend
open http://localhost:5173
```

---

## Production Deployment (Azure)

### Prerequisites
- Azure CLI installed and authenticated (`az login`)
- Resource group: `beamlab-ci-rg`
- App Services: `beamlab-backend-python`, `beamlab-backend-node`
- Gemini API key ready

### Automated Setup (Recommended)

Use the Python configuration manager:

```bash
# Show what would be applied (dry-run)
python config_manager.py azure \
  --resource-group beamlab-ci-rg \
  --app-name beamlab-backend-python \
  --api-key "AIza_YOUR_ACTUAL_KEY" \
  --dry-run

# Apply changes
python config_manager.py azure \
  --resource-group beamlab-ci-rg \
  --app-name beamlab-backend-python \
  --api-key "AIza_YOUR_ACTUAL_KEY"
```

Or use the bash script:

```bash
./setup-azure-env-auto.sh beamlab-ci-rg beamlab-backend-python "AIza_YOUR_KEY"

# Or dry-run first
./setup-azure-env-auto.sh beamlab-ci-rg beamlab-backend-python "AIza_YOUR_KEY" --dry-run
```

### Manual Azure CLI Setup

If you prefer to use Azure CLI directly:

```bash
# 1. Set environment variables
az webapp config appsettings set \
  -g beamlab-ci-rg \
  -n beamlab-backend-python \
  --settings \
    GEMINI_API_KEY="AIza_YOUR_KEY" \
    USE_MOCK_AI=false \
    FRONTEND_URL="https://beamlabultimate.tech" \
    ALLOWED_ORIGINS="https://beamlabultimate.tech,https://www.beamlabultimate.tech,https://brave-mushroom-0eae8ec00.4.azurestaticapps.net"

# 2. Restart app
az webapp restart -g beamlab-ci-rg -n beamlab-backend-python

# 3. Verify settings were applied
python config_manager.py verify-azure \
  --resource-group beamlab-ci-rg \
  --app-name beamlab-backend-python

# 4. Check logs
az webapp log tail -g beamlab-ci-rg -n beamlab-backend-python
```

### Verify Deployment

```bash
# Health check
curl https://beamlab-backend-python.azurewebsites.net/health

# AI status
curl https://beamlab-backend-python.azurewebsites.net/ai/status

# Check CORS headers
curl -I https://beamlab-backend-python.azurewebsites.net/health
```

---

## Architecture Overview

### Frontend (`apps/web`)
- **Framework**: React 18 + TypeScript + Vite
- **UI Components**: Radix UI + Tailwind CSS
- **3D Visualization**: Three.js + React Three Fiber
- **WebGPU Solver**: Local Rust/WASM solver with automatic fallback
- **State Management**: Zustand
- **Authentication**: Clerk

**Key Features:**
- WebGPU capability detection (`isWebGpuReady()`)
- Automatic fallback to Python backend when WebGPU unavailable
- Real-time structural analysis visualization

### Backend - Python (`apps/backend-python`)
- **Framework**: FastAPI
- **AI Engine**: Google Gemini (with Mock fallback)
- **CORS**: Fully configured for production domains
- **Environment**: Smart fallback configuration

**Endpoints:**
- `GET /` - Root health check
- `GET /health` - Detailed health status
- `GET /ai/status` - AI engine status
- `POST /ai/diagnose` - Diagnose structural issues
- `POST /ai/fix` - Auto-fix issues
- `POST /ai/modify` - Modify model via natural language

### Backend - Rust/WASM (`apps/backend-rust`)
- **Solver**: Direct Stiffness Method (nalgebra)
- **WebGPU Renderer**: WGPU for client-side GPU rendering
- **Build**: wasm-pack → `apps/backend-rust/pkg`
- **Distribution**: Served to frontend via local `solver-wasm` package

**Key Features:**
- Compiled to WebAssembly for browser execution
- Offloads CPU-intensive calculations to user's GPU
- Graceful fallback to backend when WebGPU unavailable

### Backend - Node.js (`apps/api`)
- **Framework**: Express/Fastify
- **Authentication**: Clerk integration
- **Billing**: Razorpay integration
- **Status**: Secondary; Python backend is primary

---

## Environment Variables

### All Required Variables

| Variable | Purpose | Example | Local Default |
|----------|---------|---------|---|
| `GEMINI_API_KEY` | Google AI API for model analysis | `AIza_xxx` | `mock-key-local-dev` |
| `USE_MOCK_AI` | Enable mock AI (no API cost) | `true`/`false` | `true` |
| `FRONTEND_URL` | Frontend origin for CORS | `https://beamlabultimate.tech` | `http://localhost:5173` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `origin1,origin2` | localhost origins |

### How Environment Loading Works

1. **Local Development**: Loads from `.env` file
2. **Azure**: Reads from App Service Configuration (portal or CLI)
3. **Fallback**: Sensible defaults if not configured
4. **Mock Mode**: Always available for development

---

## Troubleshooting

### Issue: CORS Errors in Browser

**Symptoms**: `Cross-Origin Request Blocked` in browser console

**Solution**:
1. Check CORS is configured: `curl -I https://backend-url/health`
2. Verify origin is in ALLOWED_ORIGINS
3. Check logs: `az webapp log tail -g beamlab-ci-rg -n beamlab-backend-python`
4. If using wrong domain, update via config manager:
   ```bash
   python config_manager.py azure \
     --resource-group beamlab-ci-rg \
     --app-name beamlab-backend-python \
     --api-key "AIza_YOUR_KEY"
   ```

### Issue: Gemini API Not Working

**Symptoms**: AI endpoints return errors, mock mode is ON

**Solution**:
1. Verify key is set: `curl https://backend-url/ai/status`
2. Check `USE_MOCK_AI` is `false` in Azure settings
3. Verify Gemini API key is valid and has quota
4. Check Python backend logs for API errors

### Issue: WebGPU Not Available in Browser

**Symptoms**: Frontend falls back to backend, slow solver

**Solution**:
1. WebGPU is newer; not all browsers/GPUs support it
2. Fallback to backend is automatic (this is expected)
3. Works best on: Chrome/Edge (latest), Safari TP
4. HTTPS required for WebGPU (production OK, localhost OK)

### Issue: Frontend Can't Load WASM Package

**Symptoms**: Browser console shows import errors

**Solution**:
1. Rebuild WASM: `cd apps/backend-rust && wasm-pack build --target web --out-dir ./pkg --release --mode no-install`
2. Reinstall frontend: `cd apps/web && pnpm install`
3. Check frontend imports point to local package: `import ... from 'solver-wasm'`

---

## File Locations

```
/Users/rakshittiwari/Desktop/newanti/
├── setup-azure-env-auto.sh          # Bash setup script
├── config_manager.py                 # Python config manager
├── .env.example                      # Example environment template
├── .env                              # Local env (created by setup)
├── apps/
│   ├── web/                          # Frontend React app
│   │   ├── src/services/wasmSolverService.ts  # WASM integration
│   │   └── package.json              # Has solver-wasm dependency
│   ├── backend-python/               # FastAPI backend
│   │   ├── main.py                   # Entry point (enhanced env handling)
│   │   ├── ai_routes.py              # AI endpoints + /ai/status
│   │   └── requirements.txt
│   ├── backend-rust/                 # Rust/WASM solver (legacy)
│   └── api/                          # Node.js backend (secondary)
└── packages/
    └── solver-wasm/
        ├── Cargo.toml
        ├── src/
        │   ├── lib.rs
        │   ├── solver.rs
        │   ├── renderer.rs
        │   └── ai_architect.rs
        └── pkg/                      # Built WASM artifacts
```

---

## Deployment Checklist

- [ ] Environment variables set in Azure (`python config_manager.py azure ...` or manual CLI)
- [ ] Backend app restarted (`az webapp restart ...`)
- [ ] Health endpoints working (`curl /health`, `/ai/status`)
- [ ] CORS configured for your domain
- [ ] Frontend deployed to Static Web App
- [ ] Frontend can reach backend (no CORS errors)
- [ ] AI status shows correct mode (Gemini or Mock)
- [ ] Logs show no errors on startup

---

## Getting Help

1. **Check logs**: `az webapp log tail -g beamlab-ci-rg -n beamlab-backend-python`
2. **Verify config**: `python config_manager.py verify-azure --resource-group beamlab-ci-rg --app-name beamlab-backend-python`
3. **Test manually**: Use `curl` to hit endpoints directly
4. **Check env vars**: Look for "STARTUP" section in app logs

---

## Summary

✅ All components wired and tested:
- Rust/WASM compiles and loads in frontend
- Python backend has smart env handling with fallbacks
- Azure configuration automated (no manual steps needed)
- CORS fully configured for production domains
- Mock AI available for local development
- Comprehensive setup tools provided

**Next Step**: Run the setup script matching your use case (local or Azure).
