# BeamLab Ultimate Deployment Guide

This guide covers the deployment of the BeamLab Ultimate platform, including:
1.  **Authentication**: Clerk
2.  **Frontend**: Vercel (React)
3.  **Backend**: Railway (Python/FastAPI)

---

## 🔐 1. Authentication (Clerk)

### Step 1: Create Clerk Application
1.  Go to [Clerk Dashboard](https://dashboard.clerk.com/).
2.  Create a new application named **"BeamLab Ultimate"**.
3.  Select **"Email/Password"** and **"Google"** as authentication methods.

### Step 2: Get API Keys
1.  Navigate to **API Keys** in the sidebar.
2.  Copy the **Publishable Key** (starts with `pk_test_...` or `pk_live_...`).

### Step 3: Configure Redirects (Production)
Once you have your frontend domain (from Vercel step below):
1.  Go to **Paths** in Clerk Dashboard.
2.  Set "After sign-in" and "After sign-up" to your production URL (e.g., `https://your-app.vercel.app/dashboard`).

---

## 🐍 2. Backend Deployment (Railway)

We will deploy the Python backend (`apps/backend-python`) first so we have the API URL for the frontend.

### Step 1: Set up Railway
1.  Go to [Railway.app](https://railway.app/).
2.  Click **"New Project"** -> **"Deploy from GitHub repo"**.
3.  Select your repository.

### Step 2: Configure Service
Railway normally auto-detects Python but might need specific settings since it's a monorepo.
1.  Click on the service settings.
2.  **Root Directory**: Set to `apps/backend-python`.
3.  **Build Command**: `pip install -r requirements.txt`
4.  **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Step 3: Environment Variables
Add the following variables in Railway:

| Variable | Value | Description |
|----------|-------|-------------|
| `PORT` | `8080` (or let Railway assign one) | Service port |
| `GEMINI_API_KEY` | `AIza...` | Your Google Gemini API Key |
| `USE_MOCK_AI` | `false` | Set to false for real AI |
| `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` | Comma-separated allow list |

### Step 4: Get Public URL
1.  Go to **Settings** -> **Networking**.
2.  Generate a public domain (e.g., `beamlab-production.up.railway.app`).
3.  **Copy this URL** - you need it for the frontend.

---

## ⚛️ 3. Frontend Deployment (Vercel)

### Step 1: Import Project
1.  Go to [Vercel Dashboard](https://vercel.com).
2.  Click **"Add New..."** -> **"Project"**.
3.  Import your GitHub repository.

### Step 2: Configure Build
1.  **Root Directory**: Click "Edit" and select `apps/web`.
2.  **Framework Preset**: Vite (should auto-detect).
3.  **Output Directory**: `dist` (default).

### Step 3: Environment Variables
Add the following variables in Vercel:

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | From Clerk Dashboard |
| `VITE_PYTHON_API_URL` | `https://beamlab-production.up.railway.app` | **Your Railway URL** (no trailing slash) |

### Step 4: Deploy
1.  Click **"Deploy"**.
2.  Wait for the build to finish.
3.  **Important**: Copy the deployment domain (e.g., `beamlab-ultimate.vercel.app`).

---

## 🔄 4. Final Wiring

Now that everything is deployed:

1.  **Update Railway CORS**:
    - Go back to Railway variables.
    - Update `ALLOWED_ORIGINS` with your new Vercel domain: `https://beamlab-ultimate.vercel.app`.
    - Redeploy Railway.

2.  **Update Clerk**:
    - Add your Vercel domain to **Clerk Allowed Origins** (if prompted).
    - Update Redirect URLs in Clerk to point to the production Vercel app.

---

## ✅ Checklist

- [ ] **Clerk**: Keys created, redirects set to Vercel URL.
- [ ] **Railway**: `GEMINI_API_KEY` set, `USE_MOCK_AI=false`, public URL generated.
- [ ] **Vercel**: `VITE_PYTHON_API_URL` set to Railway URL, `VITE_CLERK_PUBLISHABLE_KEY` set.
- [ ] **CORS**: Railway `ALLOWED_ORIGINS` includes Vercel URL.

## Troubleshooting

- **AI Generation Fails**: Check Railway logs. If `GEMINI_API_KEY` is invalid, the backend will return an error.
- **CORS Error**: Ensure `VITE_PYTHON_API_URL` in Vercel does **not** have a trailing slash and matches exactly what is in Railway `ALLOWED_ORIGINS` (excluding the protocol if your code handles it, but usually full URL).
- **Frontend 404s on Refresh**: Ensure Vercel is configured for SPA (rewrites all routes to index.html - generic Vite preset handles this).
