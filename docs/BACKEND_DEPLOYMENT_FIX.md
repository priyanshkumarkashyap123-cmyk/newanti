# Backend Deployment Fix - Quick Start

## Problem: Backend Service Returning 503 Error

The Python FastAPI backend at `https://beamlab-backend-python.azurewebsites.net` is not responding to requests.

## Quick Fix Steps (Choose One)

### Option 1: Auto Deployment (Recommended)
```bash
cd /Users/rakshittiwari/Desktop/newanti

# Run the automated deployment script
./deploy_backend_to_azure.sh

# This will:
# 1. Package the Python backend code
# 2. Deploy to Azure App Service  
# 3. Restart the application
# 4. Verify the health endpoint
```

**Expected Output:**
```
[✓] Package created: /tmp/backend-1767503214.zip (512K)
[✓] Deployment submitted to Azure
[✓] Application restarted
[✓] Backend is responding!
```

### Option 2: Manual Azure CLI Commands
```bash
# Step 1: Navigate to backend directory
cd /Users/rakshittiwari/Desktop/newanti/apps/backend-python

# Step 2: Create deployment package
DEPLOY_DIR=$(mktemp -d)
cp -r . "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"
rm -rf __pycache__ .pytest_cache *.pyc .env backend-python.zip
zip -r /tmp/backend-deploy.zip .

# Step 3: Deploy to Azure
az webapp deployment source config-zip \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-python \
  --src /tmp/backend-deploy.zip

# Step 4: Restart the service
az webapp restart \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-python

# Step 5: Wait and verify
sleep 10
curl https://beamlab-backend-python.azurewebsites.net/health
```

### Option 3: Check Current Status First
```bash
# See what's currently deployed
az webapp show --resource-group beamlab-ci-rg \
  --name beamlab-backend-python \
  --query "{state, lastModifiedTime}"

# Check if python runtime is properly configured
az webapp config show --resource-group beamlab-ci-rg \
  --name beamlab-backend-python \
  --query "linuxFxVersion"

# View recent logs
az webapp log tail --resource-group beamlab-ci-rg \
  --name beamlab-backend-python
```

## Verification Steps

### Test 1: Health Endpoint
```bash
curl https://beamlab-backend-python.azurewebsites.net/health
# Expected: HTTP 200 with JSON response
```

### Test 2: AI Status Endpoint  
```bash
curl https://beamlab-backend-python.azurewebsites.net/ai/status
# Expected: HTTP 200 with status and AI engine info
```

### Test 3: Check Logs for Errors
```bash
az webapp log tail --resource-group beamlab-ci-rg \
  --name beamlab-backend-python
# Look for Python errors or import failures
```

### Test 4: Verify Environment Variables
```bash
az webapp config appsettings list --resource-group beamlab-ci-rg \
  --name beamlab-backend-python -o json | \
  jq '.[] | select(.name | test("GEMINI|USE_MOCK|FRONTEND")) | {name, value}'
```

## Common Issues & Solutions

### Issue 1: "409 Conflict" Error During Deployment
**Cause**: Another deployment in progress or WEBSITE_RUN_FROM_PACKAGE setting
**Solution**:
```bash
# Remove the problematic setting
az webapp config appsettings delete \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-python \
  --setting-names WEBSITE_RUN_FROM_PACKAGE

# Wait 2 minutes, then try deployment again
```

### Issue 2: Python Dependencies Not Installing
**Cause**: requirements.txt not being processed during deployment
**Solution**:
```bash
# Enable automatic build during deployment
az webapp config appsettings set \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-python \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true

# Trigger redeployment
az webapp restart \
  --resource-group beamlab-ci-rg \
  --name beamlab-backend-python
```

### Issue 3: "503 Service Unavailable" After Deployment
**Cause**: Application not started or fatal error on startup
**Solution**:
```bash
# Check logs for startup errors
az webapp log tail --resource-group beamlab-ci-rg \
  --name beamlab-backend-python

# Look for:
# - ModuleNotFoundError (missing Python package)
# - ImportError (circular imports or missing dependencies)
# - EnvironmentError (missing .env variables)
```

## Architecture Diagram

```
User Browser (https://beamlabultimate.tech)
         ↓
    React App
         ↓
   [API Request]
         ↓
https://beamlab-backend-python.azurewebsites.net
         ↓
    Python FastAPI
    - main.py (entry)
    - ai_routes.py (endpoints)
    - models.py (validation)
         ↓
    [Gemini AI / Mock AI]
    [FEA Analysis Engine]
         ↓
    JSON Response → Browser
```

## Deployment Timeline

```
Before: Manual deployment + environment config = Hours of work
After:  ./deploy_backend_to_azure.sh = 2-3 minutes automated
```

## Important Files

- **Deployment Script**: `/Users/rakshittiwari/Desktop/newanti/deploy_backend_to_azure.sh`
- **Backend Code**: `/Users/rakshittiwari/Desktop/newanti/apps/backend-python/`
- **Requirements**: `/Users/rakshittiwari/Desktop/newanti/apps/backend-python/requirements.txt`
- **Main Entry**: `/Users/rakshittiwari/Desktop/newanti/apps/backend-python/main.py`
- **AI Routes**: `/Users/rakshittiwari/Desktop/newanti/apps/backend-python/ai_routes.py`

## Success Indicators

After successful deployment, you should see:

✅ `curl https://beamlab-backend-python.azurewebsites.net/health` returns 200
✅ Website at beamlabultimate.tech loads and shows content
✅ Browser Network tab shows successful requests to `/ai/diagnose`, `/models`, etc.
✅ 3D visualization loads with sample beam structures
✅ AI assistant responds to queries

## Need Help?

1. **Check Azure Portal**: https://portal.azure.com → beamlab-ci-rg → beamlab-backend-python
2. **View Logs**: `az webapp log tail --resource-group beamlab-ci-rg --name beamlab-backend-python`
3. **Restart Service**: `az webapp restart --resource-group beamlab-ci-rg --name beamlab-backend-python`
4. **Force Redeploy**: `./deploy_backend_to_azure.sh` (wait 10 minutes first)

---

**Last Updated**: January 4, 2025  
**Status**: Backend requires deployment after 503 error  
**Next Action**: Run `./deploy_backend_to_azure.sh`
