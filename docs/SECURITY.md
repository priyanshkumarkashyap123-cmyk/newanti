# 🔐 Security Best Practices for BeamLab Ultimate

## Credential Management

### ⚠️ NEVER commit credentials to Git!

All secrets should be stored as environment variables in your deployment platform:

| Secret | Where to Set |
|--------|--------------|
| `MONGODB_URI` | Azure App Service → Configuration |
| `CLERK_SECRET_KEY` | Azure App Service → Configuration |
| `GEMINI_API_KEY` | Azure App Service → Configuration |
| `STRIPE_SECRET_KEY` | Azure App Service → Configuration |

### GitHub Secrets (for CI/CD)

Set these in: **Settings → Secrets and variables → Actions**

- `AZURE_WEBAPP_PUBLISH_PROFILE_API`
- `AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON`
- `AZURE_STATIC_WEB_APPS_API_TOKEN`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `MONGODB_URI`
- `GEMINI_API_KEY`

---

## Credential Rotation

If credentials were exposed, rotate them immediately:

### MongoDB Atlas
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Database Access → Edit User → Change Password
3. Update `MONGODB_URI` in Azure

### Clerk
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. API Keys → Roll Keys
3. Update both `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`

### Gemini API
1. Go to [Google AI Studio](https://aistudio.google.com)
2. API Keys → Delete and Create New
3. Update `GEMINI_API_KEY` in Azure

---

## Security Features Implemented

### Backend (Node.js API)

| Feature | File | Description |
|---------|------|-------------|
| **Helmet** | `security.ts` | HTTP security headers |
| **HSTS** | `security.ts` | Force HTTPS |
| **CSP** | `security.ts` | Content Security Policy |
| **Rate Limiting** | `security.ts` | 100 req/min general, 10 req/min analysis |
| **Auth Rate Limit** | `security.ts` | 5 req/min (prevent brute force) |
| **Error Masking** | `security.ts` | Hide stack traces in production |
| **Clerk Auth** | `userRoutes.ts` | JWT validation |

### Enabled HTTP Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: (configured)
X-DNS-Prefetch-Control: off
```

---

## Recommended Additional Steps

### 1. Enable Azure WAF (Web Application Firewall)
```bash
# In Azure Portal: Front Door → WAF Policy
# Protects against OWASP Top 10
```

### 2. Enable MongoDB IP Allowlist
1. MongoDB Atlas → Network Access
2. Add only your Azure App Service IPs
3. Remove `0.0.0.0/0` (allow all)

### 3. Enable Azure DDoS Protection
```bash
az network ddos-protection create \
  --resource-group beamlab-rg \
  --name beamlab-ddos
```

### 4. Regular Security Audits
```bash
# Check npm packages for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

### 5. Enable Azure Monitor Alerts
- Set up alerts for unusual login patterns
- Monitor for high error rates
- Track API abuse

---

## Environment Variable Template

Create `.env.example` (commit this, NOT `.env`):

```bash
# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# MongoDB
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname

# Google AI
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXX

# Stripe (if used)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# App URLs
FRONTEND_URL=https://beamlabultimate.tech
VITE_API_URL=https://api-beamlab.azurewebsites.net
VITE_PYTHON_API_URL=https://api-beamlab-python.azurewebsites.net
```

---

## Security Checklist

- [x] Remove all hardcoded credentials from code
- [x] Add secrets to .gitignore
- [x] Implement rate limiting
- [x] Add security headers (Helmet)
- [x] Force HTTPS (HSTS)
- [x] Hide error stack traces in production
- [ ] Rotate all exposed credentials
- [ ] Enable MongoDB IP allowlist
- [ ] Set up Azure WAF
- [ ] Configure Azure Monitor alerts
