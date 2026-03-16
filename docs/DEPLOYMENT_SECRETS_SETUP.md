# Deployment Secrets Setup

**Date:** 16 March 2026  
**Purpose:** Define all required secrets for BeamLab production deployment and how to configure them.

## Required Secrets (Must Be Present for Deploy to Succeed)

### MongoDB
- **Secret Name:** `MONGODB_URI`
- **Format:** `mongodb+srv://username:password@cluster.mongodb.net/dbname`
- **Used By:** Node.js API, Python backend, Rust API (implicit via Node proxy)
- **Setup:** 
  1. Go to MongoDB Atlas → Network Access → add GitHub Actions IP
  2. Go to Database Users → create service account with read/write permissions
  3. Go to Clusters → Connect → copy connection string
  4. Replace `<password>` and `<dbname>` in the string
  5. Add to GitHub secret: `Settings > Secrets > New repository secret > MONGODB_URI`

### JWT Secrets
- **Secret Name:** `JWT_SECRET`
- **Format:** Random string, minimum 32 characters (base64 recommended)
- **Used By:** Node.js API to sign authentication JWTs
- **Setup:**
  ```bash
  openssl rand -base64 32
  ```
  Add result to GitHub secret

- **Secret Name:** `JWT_REFRESH_SECRET`
- **Format:** Random string, minimum 32 characters (different from JWT_SECRET)
- **Used By:** Node.js API to sign refresh tokens
- **Setup:** Same as JWT_SECRET, generate separate random value

### Clerk (Auth Provider)
- **Secret Name:** `CLERK_SECRET_KEY`
- **Format:** String starting with `sk_live_` or `sk_test_`
- **Used By:** Node.js API for Clerk authentication
- **Setup:**
  1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
  2. Select your project
  3. Go to API Keys
  4. Copy the secret key
  5. Add to GitHub secret

### Sentry (Error Tracking)
- **Secret Name:** `SENTRY_DSN`
- **Format:** `https://key@sentry.io/project-id`
- **Used By:** Node.js API for error reporting
- **Setup:**
  1. Go to [Sentry](https://sentry.io)
  2. Create a new project or use existing
  3. Go to Settings → Client Keys (DSN)
  4. Copy the DSN
  5. Add to GitHub secret

### Internal Service Secret (Inter-service Auth)
- **Secret Name:** `INTERNAL_SERVICE_SECRET`
- **Format:** Random string, minimum 16 characters
- **Used By:** Node.js API to validate requests from Rust/Python backends
- **Setup:**
  ```bash
  openssl rand -base64 16
  ```
  Add result to GitHub secret

## Optional Secrets (Deploy Works Without These, But Limits Functionality)

### Payment Gateway (PhonePe)
- `PHONEPE_MERCHANT_ID`
- `PHONEPE_SALT_KEY`
- `PHONEPE_SALT_INDEX`

**Setup:** Contact PhonePe support to obtain these values for your merchant account

### Clerk Publishable Key
- `CLERK_PUBLISHABLE_KEY`
- **Format:** String starting with `pk_live_` or `pk_test_`
- **Used By:** Frontend for Clerk UI
- **Note:** This can also be hardcoded in frontend (it's not secret by design)

### Azure Credentials
- `AZURE_CREDENTIALS`
- **Format:** JSON service principal credentials
- **Used By:** Deployment workflow to authenticate to Azure

**Setup:**
```bash
az ad sp create-for-rbac \
  --name BeamLabDeployment \
  --role contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID
```

## Secrets Validation

The deployment workflow (`azure-deploy.yml`) now validates that all required secrets are present before attempting deployment.

**Validation happens at these steps:**
1. **"CRITICAL: Validate required secrets before deployment"** — checks MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET, CLERK_SECRET_KEY, SENTRY_DSN
2. **Deploy fails immediately** if any required secret is missing (exit code 1)
3. **Error message** includes the name of missing secret(s)

**Local validation** (before committing):
```bash
# Check which GitHub secrets are configured
gh secret list --repo priyanshkumarkashyap123-cmyk/newanti

# Expected output should include:
# MONGODB_URI
# JWT_SECRET
# JWT_REFRESH_SECRET
# CLERK_SECRET_KEY
# SENTRY_DSN
# INTERNAL_SERVICE_SECRET
```

## Secret Rotation

All secrets should be rotated annually or immediately if compromised.

### JWT Secret Rotation
1. Generate new value: `openssl rand -base64 32`
2. Add alongside old value in code (support both temporarily): implement key versioning in JWT decode logic
3. Update GitHub secret with new value
4. Deploy to staging first
5. Monitor for JWT validation failures
6. After 7 days, remove old value support and force re-login

### MongoDB URI Rotation
1. Go to MongoDB Atlas
2. Rotate password for service account
3. Copy new connection string
4. Update GitHub secret
5. Deploy and verify connection works
6. Old password automatically stops working after MongoDB Atlas rotation

### CLERK_SECRET_KEY Rotation
1. Go to Clerk Dashboard → API Keys
2. Revoke old secret key
3. Generate new secret key
4. Update GitHub secret
5. Deploy and verify no auth errors
6. Monitor Sentry for any JWT validation failures

## Troubleshooting Deploy Failures

### Error: "MISSING REQUIRED SECRET: MONGODB_URI"

**Cause:** GitHub secret not set or runner can't access it

**Solution:**
```bash
# Verify secret exists
gh secret view MONGODB_URI

# If missing, create it
gh secret create MONGODB_URI < <(echo "mongodb+srv://...")

# Re-run workflow
gh workflow run azure-deploy.yml --ref main
```

### Error: "Database migration failed - aborting deployment"

**Cause:** Migration script couldn't connect to MongoDB or has a syntax error

**Solution:**
1. Verify MONGODB_URI is correct: `gh secret view MONGODB_URI | head -1`
2. Check migration files in `apps/api/src/migrations/`
3. Run migration locally: `MONGODB_URI="..." npm run migrate`
4. Fix the migration script
5. Re-run deployment

### Warning: "$FAILED services failed health check"

**Cause:** App started but is not yet responsive (warming up) or has a bug

**Solution:**
1. Wait 30 seconds and check health endpoint manually:
   ```bash
   curl https://beamlab-backend-node.azurewebsites.net/health -v
   ```
2. If 503, MongoDB is not connecting:
   - Check MongoDB Atlas network access whitelist includes Azure IP
   - Verify MONGODB_URI secret is correct
3. If 200 but dependencies show "disconnected", wait longer
4. If it doesn't recover after 2 minutes, check Azure app logs:
   ```bash
   az webapp log tail --resource-group beamlab-ci-rg --name beamlab-backend-node --provider applicationinsights
   ```

## Security Best Practices

1. **Never hardcode secrets** in code, config files, or environment examples
2. **Rotate secrets annually** at minimum
3. **Use GitHub secret scope** to limit secret access to specific repos
4. **Enable secret masking** in workflow logs (GitHub does this automatically)
5. **Audit secret access** via GitHub repository audit logs
6. **Use separate secrets per environment** (prod vs staging require different secrets)

## See Also

- [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) — full deployment procedure
- [.github/workflows/azure-deploy.yml](./.github/workflows/azure-deploy.yml) — deployment workflow configuration
- GitHub Docs: [Creating encrypted secrets for a repository](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
