# Azure Web App CORS Configuration Guide

This document explains how to fix CORS errors for the BeamLab production deployment on Azure.

## Problem

The production website at `https://beamlabultimate.tech` is blocked from accessing the backend API at `https://beamlab-backend-node.azurewebsites.net` due to CORS policy:

```
Access to fetch at 'https://beamlab-backend-node.azurewebsites.net/api/...' from origin 'https://beamlabultimate.tech' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

## Root Cause

Azure Web Apps have **two levels of CORS configuration**:

1. **Application-level CORS**: Handled by Express.js `cors` middleware (already configured correctly in `/apps/api/src/config/cors.ts`)
2. **Platform-level CORS**: Azure Web App Service settings that can override or block application settings

The issue is that Azure platform-level CORS needs to be configured.

## Solution

### Option 1: Configure via Azure Portal (Recommended)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **App Services** → `beamlab-backend-node`
3. In the left sidebar, select **CORS** (under API section)
4. Add the following **Allowed Origins**:
   - `https://beamlabultimate.tech`
   - `https://www.beamlabultimate.tech`
   - `https://brave-mushroom-0eae8ec00.4.azurestaticapps.net`
   - `http://localhost:5173` (for local development)
5. **IMPORTANT**: Enable **"Enable Access-Control-Allow-Credentials"**
6. Click **Save**
7. Restart the Web App

**Repeat for Python backend**:
- Navigate to **App Services** → `beamlab-backend-python`
- Apply the same CORS settings

### Option 2: Configure via Azure CLI

```bash
# Set CORS origins for Node.js API
az webapp cors add \
  --resource-group beamlab-rg \
  --name beamlab-backend-node \
  --allowed-origins \
    "https://beamlabultimate.tech" \
    "https://www.beamlabultimate.tech" \
    "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net"

# Enable credentials
az webapp config set \
  --resource-group beamlab-rg \
  --name beamlab-backend-node \
  --generic-configurations '{"cors":{"supportCredentials":true}}'

# Repeat for Python backend
az webapp cors add \
  --resource-group beamlab-rg \
  --name beamlab-backend-python \
  --allowed-origins \
    "https://beamlabultimate.tech" \
    "https://www.beamlabultimate.tech" \
    "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net"

az webapp config set \
  --resource-group beamlab-rg \
  --name beamlab-backend-python \
  --generic-configurations '{"cors":{"supportCredentials":true}}'
```

### Option 3: Set Environment Variables (Already Done)

The GitHub Actions deployment workflow has been updated to include these environment variables:

- `FRONTEND_URL=https://beamlabultimate.tech`
- `CORS_ALLOWED_ORIGINS=https://beamlabultimate.tech,https://www.beamlabultimate.tech,...`

These are automatically loaded by the Express app.

However, **Azure platform CORS still needs to be configured** (Options 1 or 2 above).

## Additional Environment Variables Needed

Set these in Azure Portal → App Service → Configuration → Application Settings:

### Node.js Backend (`beamlab-backend-node`)

```
NODE_ENV=production
PORT=8080
FRONTEND_URL=https://beamlabultimate.tech
CORS_ALLOWED_ORIGINS=https://beamlabultimate.tech,https://www.beamlabultimate.tech,https://brave-mushroom-0eae8ec00.4.azurestaticapps.net
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-jwt-secret>
CLERK_PUBLISHABLE_KEY=<your-clerk-key>
CLERK_SECRET_KEY=<your-clerk-secret>
PYTHON_BACKEND_URL=https://beamlab-backend-python.azurewebsites.net
RUST_BACKEND_URL=https://beamlab-rust-api.azurewebsites.net
PHONEPE_MERCHANT_ID=<merchant-id>
PHONEPE_SALT_KEY=<salt-key>
PHONEPE_SALT_INDEX=<salt-index>
PHONEPE_ENV=PRODUCTION
```

### Python Backend (`beamlab-backend-python`)

```
ENV=production
ALLOWED_ORIGINS=https://beamlabultimate.tech,https://www.beamlabultimate.tech
FRONTEND_URL=https://beamlabultimate.tech
NODE_BACKEND_URL=https://beamlab-backend-node.azurewebsites.net
RUST_BACKEND_URL=https://beamlab-rust-api.azurewebsites.net
CLERK_SECRET_KEY=<your-clerk-secret>
```

## Verify Configuration

### 1. Check CORS Headers

```bash
curl -I -H "Origin: https://beamlabultimate.tech" \
  https://beamlab-backend-node.azurewebsites.net/health
```

**Expected response should include**:
```
access-control-allow-origin: https://beamlabultimate.tech
access-control-allow-credentials: true
```

### 2. Test Preflight Request

```bash
curl -X OPTIONS -I \
  -H "Origin: https://beamlabultimate.tech" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  https://beamlab-backend-node.azurewebsites.net/api/user/subscription
```

**Expected**:
- Status: `204 No Content` or `200 OK`
- Headers: `access-control-allow-origin`, `access-control-allow-methods`, `access-control-allow-headers`

### 3. Monitor Application Logs

```bash
# Stream logs from Azure
az webapp log tail --name beamlab-backend-node --resource-group beamlab-rg

# Check for CORS-related logs
# Should see: "CORS configured" with allowed origins list
```

## Restart Required

After making configuration changes, restart all web apps:

```bash
az webapp restart --name beamlab-backend-node --resource-group beamlab-rg
az webapp restart --name beamlab-backend-python --resource-group beamlab-rg
az webapp restart --name beamlab-rust-api --resource-group beamlab-rg
```

Or via Azure Portal: App Service → Overview → Restart

## WebSocket CORS

For WebSocket connections (`wss://beamlab-backend-node.azurewebsites.net/socket.io/`), the Socket.IO server is configured in `/apps/api/src/services/SocketServer.ts` to use the same CORS origins.

WebSocket CORS errors will be resolved once the main CORS configuration is fixed.

## Authentication (401 Errors)

The 401 error for `/sections/standard/create` indicates missing or invalid authentication token, not a CORS issue.

Ensure:
1. Frontend sends `Authorization: Bearer <token>` header
2. Token is valid and not expired
3. Clerk configuration matches between frontend and backend

## Troubleshooting

### Still seeing CORS errors after configuration?

1. **Hard refresh browser**: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. **Clear browser cache**: DevTools → Network → Disable cache
3. **Check application logs**: Ensure app is starting without errors
4. **Verify deployment**: Check if latest code is deployed
5. **Test with curl**: Verify CORS headers are present

### Logs show "CORS blocked origin"?

This means the origin is not in the allowed list. Check:
- Application settings in Azure Portal
- Environment variables are loaded (check startup logs)
- No typos in origin URLs (case-sensitive, no trailing slashes)

### Mixed content warnings?

Ensure all API calls use `https://`, not `http://`. Check frontend environment variables.

## Files Changed

This fix includes:

1. **`/apps/api/web.config`** (NEW): Azure IIS configuration to not interfere with CORS
2. **`/apps/api/startup.sh`** (NEW): Startup script for Azure deployment
3. **`/.github/workflows/azure-deploy.yml`**: Updated to include environment variables
4. **`/apps/api/src/config/cors.ts`**: Already had correct origins
5. **`/apps/backend-python/main.py`**: Already had correct CORS config

## Next Steps

1. Configure CORS in Azure Portal (Option 1 above) ✅
2. Set environment variables in Azure Portal ✅
3. Restart all web apps ✅
4. Test with curl to verify CORS headers ✅
5. Test from browser console ✅
6. Monitor for any remaining errors ✅

---

**Last Updated**: 3 March 2026
