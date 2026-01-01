# CORS Configuration - BeamLab Ultimate

## Overview
CORS (Cross-Origin Resource Sharing) is properly configured across all services to allow the frontend to communicate with backend APIs from different origins.

---

## Frontend Configuration

### API Endpoints
```typescript
// apps/web/src/api/analysis.ts
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// apps/web/src/components/ModernModeler.tsx
const PYTHON_API = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000';
```

### Production URLs (GitHub Actions)
Set in `.github/workflows/azure-static-web-apps-brave-mushroom-0eae8ec00.yml`:
- **VITE_API_URL**: `https://beamlab-backend-node.azurewebsites.net`
- **VITE_PYTHON_API_URL**: `https://beamlab-backend-python.azurewebsites.net`

### Fetch Request Configuration
All API calls include CORS credentials:

```typescript
const response = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // IMPORTANT: Send cookies/auth tokens
    body: JSON.stringify({ /* data */ })
});
```

---

## Node.js Backend Configuration

**File**: `apps/api/src/index.ts` (lines 47-76)

### Allowed Origins
```typescript
const ALLOWED_ORIGINS = [
    process.env['FRONTEND_URL'] || "http://localhost:5173",
    "https://beamlabultimate.tech",
    "https://www.beamlabultimate.tech",
    "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net",
    "http://localhost:5173",
    "http://localhost:3000"
];
```

### CORS Middleware
```typescript
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);  // Allow no-origin requests
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        console.warn(`CORS blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,  // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## Python Backend Configuration

**File**: `apps/backend-python/main.py` (lines 33-70)

### Allowed Origins
```python
allow_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    # Production URLs
    "https://beamlabultimate.tech",
    "https://www.beamlabultimate.tech",
    "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net",
]

# Add environment-based origins if provided
if allowed_origins_env:
    allow_origins.extend([origin.strip() for origin in allowed_origins_env.split(",")])
```

### CORS Middleware
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## API Endpoints with CORS

### Node.js Backend Routes
- `POST /api/analyze` - Structural analysis
- `POST /api/auth/signin` - User sign in
- `POST /api/auth/signup` - User registration
- `GET /api/auth/me` - Get current user
- `POST /api/auth/signout` - Sign out

### Python Backend Routes
- `POST /analyze/frame` - Frame analysis (PyNite)
- `GET /health` - Health check
- `POST /generate/ai` - AI template generation
- `POST /validate` - Model validation

---

## Testing CORS Configuration

### Local Testing
```bash
# Terminal 1: Start frontend
cd apps/web
npm run dev -- --host --port 5173

# Terminal 2: Start Node.js backend
cd apps/api
npm run dev

# Terminal 3: Start Python backend
cd apps/backend-python
python main.py
```

### Testing CORS with curl
```bash
# Test with Origin header
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:3001/api/analyze

# Test actual request
curl -X POST http://localhost:3001/api/analyze \
     -H "Content-Type: application/json" \
     -H "Origin: http://localhost:5173" \
     -d '{"nodes": [], "members": []}'
```

### Browser DevTools Check
1. Open DevTools → Network tab
2. Make an API request (e.g., Run Analysis)
3. Check request headers:
   - Should have `Origin: https://beamlabultimate.tech`
   - Should have `Sec-Fetch-Mode: cors`
4. Check response headers:
   - Should have `Access-Control-Allow-Origin: https://beamlabultimate.tech`
   - Should have `Access-Control-Allow-Credentials: true`
   - Should have `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`

---

## Troubleshooting CORS Issues

### Issue: "No 'Access-Control-Allow-Origin' header"
**Cause**: Origin not in allowed list or CORS not configured
**Fix**:
1. Add frontend URL to `ALLOWED_ORIGINS` in Node.js backend
2. Add frontend URL to `allow_origins` in Python backend
3. Ensure `credentials: 'include'` in frontend fetch calls

### Issue: "Credentials mode is 'include' but 'Access-Control-Allow-Credentials' is missing"
**Cause**: Backend not allowing credentials
**Fix**: Ensure both backends have `credentials: true` / `allow_credentials=True`

### Issue: "Preflight request failed"
**Cause**: OPTIONS method not allowed or headers not allowed
**Fix**: Ensure `methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']` in backend

### Issue: Authorization header being blocked
**Cause**: Authorization not in `allowedHeaders`
**Fix**: Add `'Authorization'` to allowedHeaders in Node.js backend

---

## Production Deployment Checklist

- [ ] Frontend URL matches deployed domain (`beamlabultimate.tech`)
- [ ] Both backend URLs are whitelisted in CORS config
- [ ] GitHub Actions secrets are set:
  - `VITE_CLERK_PUBLISHABLE_KEY`
  - `AZURE_STATIC_WEB_APPS_API_TOKEN`
- [ ] Environment variables set in Azure App Service:
  - Node.js: `CLERK_SECRET_KEY`, `DATABASE_URL`
  - Python: ALLOWED_ORIGINS (if needed)
- [ ] SSL/TLS certificates are valid
- [ ] Verify preflight requests complete successfully

---

## References

- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS Package](https://github.com/expressjs/cors)
- [FastAPI CORS Middleware](https://fastapi.tiangolo.com/tutorial/cors/)

---

**Last Updated**: January 1, 2026
**Status**: ✅ Properly Configured
