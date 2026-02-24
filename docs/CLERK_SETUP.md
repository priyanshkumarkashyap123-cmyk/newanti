# Clerk Authentication Setup Guide

## Overview
BeamLab Ultimate uses [Clerk](https://clerk.com) for authentication. You need to configure Clerk keys for both local development and production deployment.

---

## 🔑 Getting Your Clerk Keys

1. **Sign up for Clerk**: Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
2. **Create an Application**: 
   - Click "Add Application"
   - Name it "BeamLab Ultimate" (or similar)
   - Choose authentication methods (Email, Google, GitHub, etc.)
3. **Get Your Keys**:
   - Go to **API Keys** in the dashboard
   - Copy the **Publishable Key** (starts with `pk_test_` for development or `pk_live_` for production)
   - Copy the **Secret Key** (starts with `sk_test_` or `sk_live_`)

---

## 🏠 Local Development Setup

### Step 1: Create Environment File

Your `apps/web/.env.local` is already configured with the test key:

```bash
# Clerk Authentication (Development/Test)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_Y2FwYWJsZS1vd2wtNjYuY2xlcmsuYWNjb3VudHMuZGV2JA

# API URLs
VITE_API_URL=http://localhost:3001
VITE_PYTHON_API_URL=http://localhost:3002
VITE_WEBSOCKET_URL=ws://localhost:3001
VITE_USE_CLERK=true
```

### Step 2: Configure Allowed Origins in Clerk Dashboard

1. Go to Clerk Dashboard → **API Keys**
2. Scroll to **Allowed Origins**
3. Add:
   - `http://localhost:5173` (Vite dev server)
   - `http://localhost:3000` (alternative port)
   - Any other local development URLs

### Step 3: Test Locally

```bash
cd /Users/rakshittiwari/Desktop/newanti
pnpm install
cd apps/web
pnpm run dev
```

Visit `http://localhost:5173` - you should see the Clerk sign-in widget if not authenticated.

---

## 🚀 Production Deployment Setup

### Step 1: GitHub Repository Secret Already Configured

Your production key has been set to use a GitHub secret. The workflow is already updated to use:

```yaml
VITE_CLERK_PUBLISHABLE_KEY: ${{ secrets.VITE_CLERK_PUBLISHABLE_KEY }}
```

**You still need to add the secret to GitHub:**

#### Option A: Using GitHub CLI (Recommended)

```bash
bash CLERK_KEYS_SETUP.sh
```

This script will interactively add the secret to your repository.

#### Option B: Manual Setup

1. Go to https://github.com/rakshittiwari048-ship-it/newanti/settings/secrets/actions
2. Click **"New repository secret"**
3. Add:
   - **Name**: `VITE_CLERK_PUBLISHABLE_KEY`
   - **Value**: `pk_live_Y2xlcmsuYmVhbWxhYnVsdGltYXRlLnRlY2gk`
4. Click **"Add secret"**

### Step 2: Backend API Configuration

The backend APIs are already configured with production keys:

**Node.js API** (`apps/api/.env`):
```bash
CLERK_SECRET_KEY=sk_live_REDACTED
CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuYmVhbWxhYnVsdGltYXRlLnRlY2gk
```

**Python API** (`apps/backend-python/.env`):
```bash
CLERK_SECRET_KEY=sk_live_REDACTED
```

### Step 3: Configure Allowed Origins for Production

In Clerk Dashboard (Production mode):

1. Go to **API Keys** → **Allowed Origins**
2. Add:
   - `https://beamlabultimate.tech`
   - `https://www.beamlabultimate.tech`
   - `https://brave-mushroom-0eae8ec00.3.azurestaticapps.net` (your Azure Static Web Apps URL)

### Step 4: Redeploy

Push to main branch to trigger GitHub Actions deployment:

```bash
git add .
git commit -m "Configure Clerk production keys"
git push origin main
```

The GitHub Actions workflow will automatically use the secret from `${{ secrets.VITE_CLERK_PUBLISHABLE_KEY }}`.

---

## 🛠️ Backend API Setup (Optional)

If your backend needs to verify Clerk tokens:

### Node.js API (`apps/api/.env`)

```bash
CLERK_SECRET_KEY=sk_test_YOUR_SECRET_KEY
CLERK_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
```

### Python API (`apps/backend-python/.env`)

```bash
CLERK_SECRET_KEY=sk_test_YOUR_SECRET_KEY
```

---

## 🔍 Troubleshooting

### Error: "Clerk publishable key missing"

**Cause**: `VITE_CLERK_PUBLISHABLE_KEY` not set or app not rebuilt after adding it.

**Solution**:
1. Check `apps/web/.env.local` exists and has the correct key
2. Restart the dev server: `pnpm run dev`
3. For production: check GitHub repository secrets

### Error: "Cross-Origin Request Blocked"

**Cause**: Your domain is not in Clerk's Allowed Origins list.

**Solution**:
1. Go to Clerk Dashboard → **API Keys**
2. Add your domain to **Allowed Origins**
3. Wait a few minutes for changes to propagate

### Error: "Invalid publishable key"

**Cause**: Using test key in production or vice versa.

**Solution**:
- Local dev: Use `pk_test_...` keys
- Production: Use `pk_live_...` keys
- Never mix test/live keys

### Keys appear truncated or invalid

**Cause**: Copy-paste error or incomplete key.

**Solution**:
1. Copy the full key from Clerk Dashboard (should be ~60+ characters)
2. Ensure no spaces or line breaks
3. Regenerate key if necessary in Clerk Dashboard

---

## 📚 Additional Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk React SDK](https://clerk.com/docs/references/react/overview)
- [Clerk Authentication Flow](https://clerk.com/docs/authentication/overview)

---

## ✅ Verification Checklist

- [ ] Clerk account created
- [ ] Application created in Clerk Dashboard
- [ ] `VITE_CLERK_PUBLISHABLE_KEY` added to `apps/web/.env.local`
- [ ] Local development origins added to Clerk Dashboard
- [ ] Production `VITE_CLERK_PUBLISHABLE_KEY` added as GitHub secret
- [ ] Production origins added to Clerk Dashboard
- [ ] Successfully signed in locally
- [ ] Successfully signed in on production

---

**Last Updated**: January 8, 2026
