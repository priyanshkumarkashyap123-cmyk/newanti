# 🚀 BeamLab Ultimate - Azure Deployment Guide

**Domain:** `beamlabultimate.tech`  
**Hosting:** Microsoft Azure (GitHub Student Pack - $100 Credits)

---

## 📋 Your Services

| Service | Platform | Purpose |
|---------|----------|---------|
| GitHub | Code repository | ✓ |
| Microsoft Azure | Hosting all services | ✓ |
| get.tech | Domain (beamlabultimate.tech) | ✓ |
| MongoDB Atlas | Database | ✓ |
| Google AI Studio | Gemini API | ✓ |
| Clerk | Authentication | ✓ |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  beamlabultimate.tech                       │
│                Azure Static Web App                         │
│                   (React Frontend)                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│  Azure App Service  │         │  Azure App Service  │
│  (Node.js API)      │         │  (Python Engine)    │
│  api-beamlab        │         │  api-beamlab-python │
└─────────┬───────────┘         └─────────────────────┘
          │
          ▼
┌─────────────────────┐
│   MongoDB Atlas     │
│   (Database)        │
└─────────────────────┘
```

---

## Step 1: Prerequisites

Ensure you have:
- [x] GitHub account with repo pushed
- [x] Azure account (get $100 via GitHub Student Pack)
- [x] Azure CLI installed: `brew install azure-cli`

### Your Credentials

| Service | Key |
|---------|-----|
| Clerk Publishable | `pk_test_Y2FwYWJsZS1vd2wtNjYuY2xlcmsuYWNjb3VudHMuZGV2JA` |
| Clerk Secret | `sk_test_7MqXdNmcEp22DKExdwWXDDjn7QzMimENVg5GHo3Q3f` |
| MongoDB URI | `mongodb+srv://beamlab_admin:yLCaEABYdoy5yKYd@cluster0.qiu5szt.mongodb.net/beamlab` |
| Gemini API | `AIzaSyDFYavn0QKWTJ8OjQkoe8IalmQijA6BRhw` |

---

## Step 2: Azure Setup

### 2.1 Login to Azure

```bash
az login
```

### 2.2 Create Resource Group

```bash
az group create --name beamlab-rg --location centralindia
```

---

## Step 3: Deploy Python Backend

### 3.1 Create App Service

```bash
az webapp create \
  --resource-group beamlab-rg \
  --name api-beamlab-python \
  --runtime "PYTHON:3.12" \
  --sku B1
```

### 3.2 Configure Environment Variables

```bash
az webapp config appsettings set \
  --resource-group beamlab-rg \
  --name api-beamlab-python \
  --settings \
    GEMINI_API_KEY="AIzaSyDFYavn0QKWTJ8OjQkoe8IalmQijA6BRhw" \
    USE_MOCK_AI="false" \
    FRONTEND_URL="https://beamlabultimate.tech" \
    ALLOWED_ORIGINS="https://beamlabultimate.tech,https://www.beamlabultimate.tech"
```

### 3.3 Configure Startup Command

```bash
az webapp config set \
  --resource-group beamlab-rg \
  --name api-beamlab-python \
  --startup-file "uvicorn main:app --host 0.0.0.0 --port 8000"
```

### 3.4 Deploy from GitHub

```bash
az webapp deployment source config \
  --resource-group beamlab-rg \
  --name api-beamlab-python \
  --repo-url https://github.com/YOUR_USERNAME/beamlab-ultimate \
  --branch main \
  --manual-integration
```

**Python URL:** `https://api-beamlab-python-acbfetbrhdd7hpgj.centralindia-01.azurewebsites.net`

---

## Step 4: Deploy Node.js Backend

### 4.1 Create App Service

```bash
az webapp create \
  --resource-group beamlab-rg \
  --name api-beamlab \
  --runtime "NODE:18-lts" \
  --sku B1
```

### 4.2 Configure Environment Variables

```bash
az webapp config appsettings set \
  --resource-group beamlab-rg \
  --name api-beamlab \
  --settings \
    PORT="8080" \
    NODE_ENV="production" \
    CLERK_SECRET_KEY="sk_test_7MqXdNmcEp22DKExdwWXDDjn7QzMimENVg5GHo3Q3f" \
    MONGODB_URI="mongodb+srv://beamlab_admin:yLCaEABYdoy5yKYd@cluster0.qiu5szt.mongodb.net/beamlab" \
    FRONTEND_URL="https://beamlabultimate.tech"
```

### 4.3 Configure Startup Command

```bash
az webapp config set \
  --resource-group beamlab-rg \
  --name api-beamlab \
  --startup-file "npm run start"
```

### 4.4 Deploy from GitHub

```bash
az webapp deployment source config \
  --resource-group beamlab-rg \
  --name api-beamlab \
  --repo-url https://github.com/YOUR_USERNAME/beamlab-ultimate \
  --branch main \
  --manual-integration
```

**Node.js URL:** `https://api-beamlab.azurewebsites.net`

---

## Step 4A: GitHub Actions CI/CD (Recommended)

### 4A.1 Get Publish Profiles

1. In Azure Portal → App Services → **api-beamlab** → **Download publish profile**
2. In Azure Portal → App Services → **api-beamlab-python** → **Download publish profile**

### 4A.2 Add GitHub Secrets

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Add **repository secrets**:

| Secret Name | Value | Notes |
|-------------|-------|-------|
| `AZURE_WEBAPP_PUBLISH_PROFILE_API` | Contents of `api-beamlab.PublishSettings` | Download from Azure Portal |
| `AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON` | Contents of `api-beamlab-python.PublishSettings` | Download from Azure Portal |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deployment token from Static Web App | Click "Manage deployment token" |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_Y2FwYWJsZS1vd2wtNjYuY2xlcmsuYWNjb3VudHMuZGV2JA` | From Clerk Dashboard |

> **How to get publish profiles:** Azure Portal → App Service → Download publish profile → Copy entire XML content

### 4A.3 Azure App Settings (Environment Variables)

Configure these in **Azure Portal → App Service → Configuration → Application settings**:

**Node.js API (api-beamlab):**
| Setting | Value |
|---------|-------|
| `MONGODB_URI` | `mongodb+srv://beamlab_admin:yLCaEABYdoy5yKYd@cluster0.qiu5szt.mongodb.net/beamlab` |
| `GEMINI_API_KEY` | `AIzaSyDFYavn0QKWTJ8OjQkoe8IalmQijA6BRhw` |
| `CLERK_SECRET_KEY` | `sk_test_7MqXdNmcEp22DKExdwWXDDjn7QzMimENVg5GHo3Q3f` |
| `FRONTEND_URL` | `https://beamlabultimate.tech` |
| `NODE_ENV` | `production` |

**Python Engine (api-beamlab-python):**
| Setting | Value |
|---------|-------|
| `GEMINI_API_KEY` | `AIzaSyDFYavn0QKWTJ8OjQkoe8IalmQijA6BRhw` |
| `FRONTEND_URL` | `https://beamlabultimate.tech` |
| `ALLOWED_ORIGINS` | `https://beamlabultimate.tech,https://www.beamlabultimate.tech` |

### 4A.4 Trigger Deployment

Every push to `main` branch triggers automatic deployment:
- `.github/workflows/azure-deploy.yml` handles the CI/CD
- **deploy-api**: Node.js API → `api-beamlab`
- **deploy-python**: Python Engine → `api-beamlab-python`
- **deploy-web**: React Frontend → Azure Static Web Apps

---

## Step 5: Deploy Frontend (Static Web App)

### 5.1 Create Static Web App

```bash
az staticwebapp create \
  --name beamlab-frontend \
  --resource-group beamlab-rg \
  --source https://github.com/YOUR_USERNAME/beamlab-ultimate \
  --location centralindia \
  --branch main \
  --app-location "apps/web" \
  --output-location "dist" \
  --login-with-github
```

### 5.2 Configure Environment Variables

In Azure Portal → Static Web Apps → beamlab-frontend → Configuration:

| Name | Value |
|------|-------|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_Y2FwYWJsZS1vd2wtNjYuY2xlcmsuYWNjb3VudHMuZGV2JA` |
| `VITE_PYTHON_API_URL` | `https://beamlab-python.azurewebsites.net` |
| `VITE_API_URL` | `https://beamlab-api.azurewebsites.net` |

**Frontend URL:** `https://beamlab-frontend.azurestaticapps.net`

---

## Step 6: Connect Custom Domain

### 6.1 Add Domain to Static Web App

In Azure Portal → Static Web Apps → beamlab-frontend → Custom domains:

1. Click **Add**
2. Enter: `beamlabultimate.tech`
3. Azure will provide a CNAME or TXT record

### 6.2 Configure DNS at get.tech

Add these DNS records:

| Type | Name | Value |
|------|------|-------|
| CNAME | @ | `beamlab-frontend.azurestaticapps.net` |
| CNAME | www | `beamlab-frontend.azurestaticapps.net` |

Or if root domain requires A record:
| Type | Name | Value |
|------|------|-------|
| A | @ | (Azure provided IP) |
| CNAME | www | `beamlab-frontend.azurestaticapps.net` |

### 6.3 Enable HTTPS

Azure automatically provisions SSL certificates for custom domains.

---

## Step 7: Configure Clerk

In [Clerk Dashboard](https://dashboard.clerk.com):

1. Go to **Domains** → Add `beamlabultimate.tech`
2. Go to **Paths**:
   - After sign-in: `https://beamlabultimate.tech/dashboard`
   - After sign-up: `https://beamlabultimate.tech/dashboard`

---

## Step 8: Test Everything

1. Visit `https://beamlabultimate.tech`
2. Sign up / Log in
3. Try creating a structural model
4. Try AI generation
5. Check browser console for errors

---

## ✅ Verification Checklist

- [ ] GitHub repo pushed with latest code
- [ ] Azure Resource Group created
- [ ] Python App Service deployed and running
- [ ] Node.js App Service deployed and running
- [ ] Static Web App deployed
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Clerk domain added
- [ ] All features working

---

## 💰 Cost Estimation

| Service | Monthly Cost |
|---------|-------------|
| Static Web App | **FREE** |
| App Service (Node.js) - B1 | ~$13 |
| App Service (Python) - B1 | ~$13 |
| **Total** | **~$26/month** |

**With $100 Azure credits = ~4 months FREE!**

---

## 🔧 Troubleshooting

### CORS Errors
Update `ALLOWED_ORIGINS` to include your exact domain with `https://`.

### Build Failures
Check Azure Portal → App Service → Deployment Center → Logs.

### 502 Bad Gateway
Check App Service logs: Diagnose and solve problems → Application Logs.

### Clerk Login Issues
Ensure domain is added in Clerk Dashboard and `VITE_CLERK_PUBLISHABLE_KEY` is set.

---

## 📞 Support Commands

```bash
# View logs
az webapp log tail --resource-group beamlab-rg --name api-beamlab-python

# Restart app
az webapp restart --resource-group beamlab-rg --name api-beamlab-python

# Delete everything
az group delete --name beamlab-rg --yes
```

---

**🎉 Your BeamLab Ultimate is now live at https://beamlabultimate.tech!**
