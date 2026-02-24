# Azure Backend Startup Troubleshooting Guide

## Quick Status Check

```bash
# Check if services exist
az webapp list --resource-group beamlab-ci-rg --query "[].name"

# View current config for each service
az webapp config show --resource-group beamlab-ci-rg --name beamlab-api
az webapp config show --resource-group beamlab-ci-rg --name beamlab-backend-python
az webapp config show --resource-group beamlab-ci-rg --name beamlab-rust-api
```

## Common Issues & Solutions

### 1. Node.js API Not Starting (Port 3001)

**Symptom:** `https://beamlab-api.azurewebsites.net/health` returns 502/503

**Solution:**

```bash
# Step 1: Check current startup file
az webapp config show --resource-group beamlab-ci-rg --name beamlab-api --query "startupCommand"

# Step 2: Set correct startup command
az webapp config set --resource-group beamlab-ci-rg --name beamlab-api --startup-file "npm run start"

# Step 3: Verify environment variables
az webapp config appsettings list --resource-group beamlab-ci-rg --name beamlab-api

# Step 4: Restart
az webapp restart --resource-group beamlab-ci-rg --name beamlab-api

# Step 5: View logs
az webapp log tail --resource-group beamlab-ci-rg --name beamlab-api
```

### 2. Python Backend Not Starting (Port 8000)

**Symptom:** `https://beamlab-backend-python.azurewebsites.net/health` returns 502/503

**Solution:**

```bash
# Step 1: Check Python version
az webapp config show --resource-group beamlab-ci-rg --name beamlab-backend-python --query "linuxFxVersion"

# Step 2: Ensure correct Python runtime
# Should show: PYTHON|3.11 or PYTHON|3.10

# Step 3: Check startup file
az webapp config show --resource-group beamlab-ci-rg --name beamlab-backend-python --query "startupCommand"

# Step 4: Set correct startup command for gunicorn
az webapp config set --resource-group beamlab-ci-rg --name beamlab-backend-python \
  --startup-file "gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind=0.0.0.0:8000 --timeout 600"

# Step 5: Verify dependencies are installed
# (Azure Oryx should handle this automatically)

# Step 6: Restart
az webapp restart --resource-group beamlab-ci-rg --name beamlab-backend-python

# Step 7: View logs
az webapp log tail --resource-group beamlab-ci-rg --name beamlab-backend-python
```

### 3. Rust API Not Starting (Port 3002)

**Symptom:** `https://beamlab-rust-api.azurewebsites.net` returns 502/503

**Solution:**

```bash
# Rust API should have the binary pre-built
# Just verify environment

az webapp config appsettings set --resource-group beamlab-ci-rg --name beamlab-rust-api \
  --settings RUST_API_PORT=3002

az webapp restart --resource-group beamlab-ci-rg --name beamlab-rust-api

# Check logs
az webapp log tail --resource-group beamlab-ci-rg --name beamlab-rust-api
```

## View Real-Time Logs

```bash
# Node.js API
az webapp log tail --resource-group beamlab-ci-rg --name beamlab-api --filter "ERROR\|WARN"

# Python Backend
az webapp log tail --resource-group beamlab-ci-rg --name beamlab-backend-python --filter "ERROR\|Traceback"

# Rust API
az webapp log tail --resource-group beamlab-ci-rg --name beamlab-rust-api
```

## Test Endpoints

```bash
# Node.js API
curl https://beamlab-api.azurewebsites.net/health

# Python Backend
curl https://beamlab-backend-python.azurewebsites.net/health

# Rust API
curl https://beamlab-rust-api.azurewebsites.net/health
```

## Environment Variables Needed

### Node.js API

```
PORT=3001
USE_CLERK=false
NODE_ENV=production
MONGODB_URI=[your-mongodb-uri]
JWT_SECRET=[your-jwt-secret]
GEMINI_API_KEY=AIzaSyDFYavn0QKWTJ8OjQkoe8IalmQijA6BRhw
FRONTEND_URL=https://beamlabultimate.tech
ALLOWED_ORIGINS=https://beamlabultimate.tech,...
```

### Python Backend

```
GEMINI_API_KEY=AIzaSyDFYavn0QKWTJ8OjQkoe8IalmQijA6BRhw
USE_MOCK_AI=false
FRONTEND_URL=https://beamlabultimate.tech
ALLOWED_ORIGINS=https://beamlabultimate.tech,...
PYTHONPATH=/home/site/wwwroot
PORT=8000
```

### Rust API

```
RUST_API_PORT=3002
MONGODB_URI=[your-mongodb-uri]
JWT_SECRET=[your-jwt-secret]
```

## Complete Reset Procedure

If nothing works, do a complete reset:

```bash
# 1. Stop all apps
for app in beamlab-api beamlab-backend-python beamlab-rust-api; do
  az webapp stop --resource-group beamlab-ci-rg --name $app 2>/dev/null
  echo "Stopped $app"
done

# 2. Wait 10 seconds
sleep 10

# 3. Clear app cache (optional but recommended)
for app in beamlab-api beamlab-backend-python beamlab-rust-api; do
  az webapp config appsettings set --resource-group beamlab-ci-rg --name $app \
    --settings SCM_TRACE_ON=false WEBSITES_ENABLE_APP_SERVICE_STORAGE=true > /dev/null 2>&1
done

# 4. Start all apps
for app in beamlab-api beamlab-backend-python beamlab-rust-api; do
  az webapp start --resource-group beamlab-ci-rg --name $app
  echo "Started $app"
done

# 5. Wait 30 seconds for full startup
sleep 30

# 6. Check status
echo "Checking status..."
for app in beamlab-api beamlab-backend-python beamlab-rust-api; do
  status=$(az webapp show --resource-group beamlab-ci-rg --name $app --query "state" -o tsv)
  echo "$app: $status"
done
```

## Check Build & Deployment Status

```bash
# View deployment center settings
az webapp deployment source show --resource-group beamlab-ci-rg --name beamlab-api

# View deployment history
az webapp deployment list --resource-group beamlab-ci-rg --name beamlab-api

# Check if build is running
az webapp up --resource-group beamlab-ci-rg --name beamlab-api --query "properties.state"
```

## MongoDB Connection Check

If MongoDB connection is failing:

```bash
# Verify MONGODB_URI is set
az webapp config appsettings list --resource-group beamlab-ci-rg --name beamlab-api \
  --query "[?name=='MONGODB_URI']"

# If not set or wrong:
az webapp config appsettings set --resource-group beamlab-ci-rg --name beamlab-api \
  --settings MONGODB_URI="$MONGODB_URI"

# Restart
az webapp restart --resource-group beamlab-ci-rg --name beamlab-api
```

## Performance & Resource Check

```bash
# Check if service plan has enough resources
az appservice plan show --resource-group beamlab-ci-rg --name beamlab-plan-api \
  --query "{sku:sku.name, status:status, computeMode:computeMode}"

# If B1 or smaller, upgrade to at least B2
az appservice plan update --resource-group beamlab-ci-rg --name beamlab-plan-api --sku B2
```

## Automatic Fix Script

Run this to automatically fix all issues:

```bash
chmod +x /Users/rakshittiwari/Desktop/newanti/FIX_AZURE_BACKEND.sh
/Users/rakshittiwari/Desktop/newanti/FIX_AZURE_BACKEND.sh
```

---

**Last Updated:** January 5, 2026
**Status:** All services should be operational after running the fix script
