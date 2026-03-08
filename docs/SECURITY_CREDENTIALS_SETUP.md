# 🔐 BeamLab Credentials Setup Guide

**⚠️ SECURITY WARNING:** This document does NOT contain actual credentials. Credentials are environment-specific and should NEVER be committed to Git.

---

## Overview

BeamLab requires several third-party credentials for full functionality:

| Service | Purpose | Environment | Status |
|---------|---------|-------------|--------|
| **MongoDB Atlas** | Database | Production | Required |
| **Clerk** | Authentication | Production | Required |
| **Google Gemini API** | AI Analysis | Production | Required |
| **Razorpay** | Payment Processing | Production | Optional (not for MVP) |
| **JWT Secret** | Session Security | All | Required |
| **Azure Credentials** | CI/CD Deployment | Production | Required |

---

## Prerequisites

You will need:

1. **MongoDB Atlas Account** — [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. **Clerk Account** — [https://clerk.com](https://clerk.com)
3. **Google Cloud Project** with Gemini API enabled — [https://console.cloud.google.com](https://console.cloud.google.com)
4. **Azure Account** (for CI/CD) — [https://portal.azure.com](https://portal.azure.com)
5. **GitHub Repository Settings** access

---

## Setup Instructions by Environment

### **1. Local Development (.env.local)**

Create `apps/web/.env.local`:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_CLERK_PUBLISHABLE_KEY
VITE_GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Create `.env.local`:
```
# Database
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/?appName=BeamLab

# Clerk (Backend Validation)
CLERK_SECRET_KEY=sk_test_YOUR_CLERK_SECRET_KEY

# JWT & Session
JWT_SECRET=generate-with: openssl rand -base64 64
SESSION_SECRET=beamlab-dev-session-secret-unique-per-dev

# Google Gemini
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Optional: Payment (not needed for development)
# RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
# RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
```

**🔑 How to get these values:**

#### **Clerk Setup**
1. Sign up at [clerk.com](https://clerk.com)
2. Create a new application
3. Go to **Developers → API Keys**
4. Copy **Publishable Key** → `VITE_CLERK_PUBLISHABLE_KEY`
5. Copy **Secret Key** → `CLERK_SECRET_KEY`

#### **MongoDB Atlas**
1. Sign up at [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Go to **Database → Connect**
4. Choose **Drivers**
5. Copy connection string with your username/password → `DATABASE_URL`

#### **Google Gemini API**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project
3. Enable **Generative Language API**
4. Go to **APIs & Services → Credentials**
5. Create **API Key**
6. Copy key → `GEMINI_API_KEY`

---

### **2. Staging Deployment (Azure)**

Configure via Azure Portal or Azure CLI:

```bash
# Set credentials for Python backend
az webapp config appsettings set \
  --resource-group beamlab-rg \
  --name beamlab-backend-python \
  --settings \
    MONGODB_URI="mongodb+srv://..." \
    CLERK_SECRET_KEY="sk_test_..." \
    JWT_SECRET="$(openssl rand -base64 64)" \
    GEMINI_API_KEY="AIzaSy..." \
    ENVIRONMENT="staging"

# Set credentials for Rust API
az webapp config appsettings set \
  --resource-group beamlab-rg \
  --name beamlab-rust-api \
  --settings \
    MONGODB_URI="mongodb+srv://..." \
    JWT_SECRET="$(openssl rand -base64 64)" \
    ENVIRONMENT="staging"
```

---

### **3. Production Deployment (Azure)**

**⚠️ Use Azure Key Vault instead of plain environment variables:**

```bash
# Store secret in Azure Key Vault
az keyvault secret set \
  --vault-name beamlab-keyvault \
  --name mongodb-uri \
  --value "mongodb+srv://..."

az keyvault secret set \
  --vault-name beamlab-keyvault \
  --name jwt-secret \
  --value "$(openssl rand -base64 64)"

# Reference from Key Vault in App Service
az webapp config appsettings set \
  --resource-group beamlab-rg \
  --name beamlab-backend-python \
  --settings MONGODB_URI="@Microsoft.KeyVault(SecretUri=https://beamlab-keyvault.vault.azure.net/secrets/mongodb-uri/)"
```

---

### **4. GitHub Actions Secrets**

Required secrets for CI/CD workflows:

| Secret Name | Source | Scope |
|------------|--------|-------|
| `JWT_SECRET` | `openssl rand -base64 64` | All deployments |
| `CLERK_SECRET_KEY` | Clerk dashboard | Needed for secrets validation |
| `MONGODB_URI` | MongoDB Atlas | Backend deployment |
| `REGISTRY_USERNAME` | Azure Container Registry | Docker pushes |
| `REGISTRY_PASSWORD` | Azure ACR access keys | Docker pushes |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk dashboard | Frontend build |
| `AZURE_PUBLISH_PROFILE_RUST` | Azure Portal (download publish profile) | Rust API deployment |

**To add secrets to GitHub:**

1. Go to your repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Enter each name and value pair
5. Save

---

## Secret Rotation Checklist

### **Monthly**
- [ ] Rotate JWT_SECRET (generate new with openssl; update all services)
- [ ] Rotate Clerk secret key (go to Clerk dashboard; regenerate; update GitHub + Azure)

### **Quarterly**
- [ ] Rotate MongoDB credentials (change user password in Atlas)
- [ ] Rotate Gemini API key (regenerate in Google Cloud Console)
- [ ] Rotate Azure deployment credentials (refresh publish profiles)
- [ ] Rotate Docker registry password (Azure ACR access keys)

### **Immediately After Exposure**
- [ ] Revoke and regenerate all affected credentials
- [ ] Update GitHub secrets
- [ ] Restart all affected services
- [ ] Review git history for accidental commits: `git log --all -p -- "*.env"`

---

## Security Best Practices

✅ **DO:**
- Store secrets in environment variables, not code
- Use `.env` files locally (never commit)
- Rotate credentials quarterly
- Use strong random values: `openssl rand -base64 64`
- Use Azure Key Vault for production (not app settings)
- Enable 2FA on all service accounts (Clerk, Google, MongoDB, GitHub)

❌ **DON'T:**
- Hardcode credentials in source files
- Commit `.env` files (`.gitignore` blocks this)
- Share credentials via email or chat
- Use same credentials across environments
- Store credentials in documentation
- Use test/development keys in production

---

## Troubleshooting

**Issue:** "Invalid API key" error
- **Fix:** Verify API key format matches service requirements
- Check expiry date (some keys expire)
- Verify environment variable is set correctly

**Issue:** "Authentication failed" (Clerk)
- **Fix:** Ensure using correct environment (test vs. production keys)
- Verify secret key (not publishable key) is used for backend validation
- Check timestamp synchronization between services

**Issue:** "Connection refused" (MongoDB)
- **Fix:** Whitelist your IP in MongoDB Atlas → Network Access
- Check connection string format (srv vs. non-srv)
- Verify username/password doesn't contain special characters requiring URL encoding

---

## Support

For questions or credential-related issues:
1. Check [docs/CLERK_SETUP.md](CLERK_SETUP.md) for Clerk-specific setup
2. Review [docs/AZURE_QUICK_SETUP.txt](AZURE_QUICK_SETUP.txt) for Azure deployment
3. File an issue with "🔐 credentials" label (without exposing keys)

---

**Last Updated:** March 8, 2026  
**Status:** ✅ Secure (no actual secrets in this document)
