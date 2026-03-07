# Spectrum Analysis 401 Error - Root Cause & Fix

## Problem Summary

**Errors**:
```
beamlab-backend-python.azurewebsites.net/analyze/spectrum: 401 Unauthorized
❌ Error: Analysis failed
```

**Root Cause**:
1. Frontend was calling **Python API directly** for spectrum analysis
2. Frontend uses **Clerk authentication** → sends Clerk JWT tokens
3. Python backend expected **HS256 JWT** signed with `JWT_SECRET`
4. Clerk tokens couldn't be verified → **401 Unauthorized**

## Architecture Flow

### ❌ Before (BROKEN):
```
Frontend → Python API directly
         ↓
       Clerk JWT (can't verify)
         ↓
      401 Unauthorized  
```

### ✅ After (FIXED):
```
Frontend → Node API → Rust API → Python API
         ↓           ↓            ↓
    Clerk JWT   X-Internal-   X-Internal-
                 Service       Service
```

## Changes Made

### 1. **Frontend**: Route spectrum analysis through Node API

**File**: `apps/web/src/components/AdvancedAnalysisDialog.tsx`

**Before**:
```typescript
const PYTHON_API = API_CONFIG.pythonUrl;
const res = await fetch(`${PYTHON_API}/analyze/spectrum`, {
```

**After**:
```typescript
const NODE_API = API_CONFIG.baseUrl; // Use Node API as auth gateway
const res = await fetch(`${NODE_API}/api/advanced/spectrum`, {
```

**Why**: Node API handles Clerk authentication and adds internal service headers when forwarding.

---

### 2. **Node API**: Add internal service authentication header

**File**: `apps/api/src/services/serviceProxy.ts`

**Added**:
```typescript
// Add internal service auth for Python API (bypass JWT verification)
if (service === 'python') {
    const internalSecret = process.env['INTERNAL_SERVICE_SECRET'] || '';
    if (internalSecret) {
        headers['X-Internal-Service'] = internalSecret;
    }
}
```

**Why**: Python backend's `AuthMiddleware` allows requests with matching `X-Internal-Service` header.

---

## Required Environment Variables

### Node API (apps/api):
```bash
# .env or Azure App Service settings
INTERNAL_SERVICE_SECRET=your-strong-secret-min-16-chars
```

### Python API (apps/backend-python):
```bash
# .env or Azure App Service settings
INTERNAL_SERVICE_SECRET=your-strong-secret-min-16-chars  # MUST MATCH Node API
JWT_SECRET=your-jwt-secret  # Optional - for direct API access
```

**CRITICAL**: 
- `INTERNAL_SERVICE_SECRET` must be **identical** in both Node and Python backends
- Must be **at least 16 characters** (enforced by Python security middleware)
- Use a strong random secret: `openssl rand -base64 32`

---

## Python Backend Auth Logic

**File**: `apps/backend-python/security_middleware.py`

```python
# Skip auth for public paths
if path in PUBLIC_PATHS or method == "OPTIONS":
    return await call_next(request)

# Extract token
auth_header = request.headers.get("authorization", "")
if not auth_header.startswith("Bearer "):
    # Allow internal service-to-service calls
    internal_secret = os.getenv("INTERNAL_SERVICE_SECRET", "")
    internal = request.headers.get("x-internal-service")
    # SECURITY: Require at least 16 chars
    if internal_secret and len(internal_secret) >= 16 and internal and hmac.compare_digest(internal_secret, internal):
        return await call_next(request)  # ✅ ALLOWED
    
    return Response(status_code=401)  # ❌ UNAUTHORIZED
```

**Protected Endpoints** (require auth):
- `/analyze/spectrum` ✅
- `/analyze/*` (all analysis endpoints)
- `/ai/*` (AI endpoints)
- `/jobs/*` (job queue)

**Public Endpoints** (no auth):
- `/health`
- `/docs` (dev only)
- `/sections/*` (TODO: should be protected)

---

## Deployment Checklist

### Azure App Service Configuration:

#### 1. **Node API** (`beamlab-backend-node`):
```bash
az webapp config appsettings set \
    --resource-group beamlab-rg \
    --name beamlab-backend-node \
    --settings \
        INTERNAL_SERVICE_SECRET="$(openssl rand -base64 32)"
```

#### 2. **Python API** (`beamlab-backend-python`):
```bash
# Use the SAME secret from Node API
INTERNAL_SECRET="<paste-from-node-api>"

az webapp config appsettings set \
    --resource-group beamlab-rg \
    --name beamlab-backend-python \
    --settings \
        INTERNAL_SERVICE_SECRET="$INTERNAL_SECRET"
```

#### 3. **Rust API** (if forwarding to Python):
```bash
az webapp config appsettings set \
    --resource-group beamlab-rg \
    --name beamlab-rust-api \
    --settings \
        PYTHON_API_URL="https://beamlab-backend-python.azurewebsites.net" \
        INTERNAL_SERVICE_SECRET="$INTERNAL_SECRET"
```

---

## Testing

### 1. **Local Development**:
```bash
# In apps/api/.env
INTERNAL_SERVICE_SECRET=dev-secret-min-16-chars-long

# In apps/backend-python/.env
INTERNAL_SERVICE_SECRET=dev-secret-min-16-chars-long
```

### 2. **Test Spectrum Analysis**:
```bash
# Frontend → Node → Python (with internal auth)
curl -X POST https://beamlab-backend-node.azurewebsites.net/api/advanced/spectrum \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d @spectrum-payload.json
```

**Expected**: ✅ 200 OK (not 401)

### 3. **Verify Internal Service Header**:
```bash
# Direct Python API call (should still fail without Clerk)
curl -X POST https://beamlab-backend-python.azurewebsites.net/analyze/spectrum \
  -H "Content-Type: application/json" \
  -d @spectrum-payload.json

# Expected: 401 Unauthorized (no auth)

# With internal service header (service-to-service)
curl -X POST https://beamlab-backend-python.azurewebsites.net/analyze/spectrum \
  -H "X-Internal-Service: your-secret" \
  -H "Content-Type: application/json" \
  -d @spectrum-payload.json

# Expected: 200 OK or 400 Bad Request (not 401)
```

---

## Buckling Analysis Error

**Separate Issue**:
```
❌ [Buckling] WASM analysis error: Error: Singular stiffness matrix — structure is a mechanism
```

**Root Cause**: The structure being analyzed has **insufficient restraints** or **unstable geometry**.

**Fix**: 
1. Ensure structure has proper supports (pinned/fixed)
2. Verify no floating nodes or disconnected members
3. Check for zero-stiffness members (zero area, zero inertia)
4. Ensure structure is statically stable before buckling analysis

**Not related to 401 errors** - this is a structural modeling issue.

---

## Summary

**Fixed Files**:
1. ✅ `apps/web/src/components/AdvancedAnalysisDialog.tsx` - Route through Node API
2. ✅ `apps/api/src/services/serviceProxy.ts` - Add internal service header

**Required Configuration**:
- Set `INTERNAL_SERVICE_SECRET` in **both** Node and Python backends (must match, ≥16 chars)

**Result**:
- Spectrum analysis now works through proper auth gateway
- Node API validates Clerk tokens
- Python API accepts internal service-to-service calls
- No more 401 errors for authenticated users
