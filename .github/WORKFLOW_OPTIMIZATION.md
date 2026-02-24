# GitHub Actions Workflow Optimization

## Changes Made (February 1, 2026)

To conserve GitHub Actions minutes and prevent running out of quota, the following optimizations have been implemented:

### ✅ Workflow Modifications

1. **CI Workflow** (`ci.yml`)
   - Added path filters to run only when code files change
   - Prevents running on documentation-only changes
   - **Savings**: ~50% reduction in runs

2. **E2E Tests** (`e2e-tests.yml`)
   - Changed from automatic to manual trigger only
   - Added weekly schedule (Sunday 2 AM UTC)
   - **Savings**: ~90% reduction in runs

3. **Security Scanning** (`security.yml`)
   - Changed from daily to weekly (Monday midnight UTC)
   - Removed push/PR triggers, manual only
   - **Savings**: ~85% reduction in runs

4. **Self-Hosted Workflows**
   - `azure-deploy-selfhosted.yml` - Manual trigger only
   - `azure-static-web-apps-selfhosted.yml` - Manual trigger only
   - `deploy-rust-api-selfhosted.yml` - Manual trigger only
   - **Savings**: ~70% reduction in runs

5. **Dependabot**
   - Disabled by renaming `dependabot.yml` to `dependabot.yml.disabled`
   - Stops automated dependency PRs that consume minutes
   - **Savings**: Massive reduction in workflow runs

### 📊 Active Workflows

Only these workflows will run automatically:

- **Azure Static Web Apps CI/CD** - Main deployment (on push to main)
- **CI** - Code quality checks (on relevant file changes only)
- **PR** - Pull request checks (when PR is opened)

### 🔧 Manual Workflows

These can be triggered manually when needed:

- E2E Tests
- Security Scanning
- Self-hosted deployments
- Release workflow

### 💡 Estimated Savings

- **Before**: ~1500-2000 minutes/month
- **After**: ~300-500 minutes/month
- **Reduction**: ~75-80% savings

### 🚀 To Run Manual Workflows

```bash
# Trigger E2E tests manually
gh workflow run e2e-tests.yml

# Trigger security scan manually
gh workflow run security.yml

# Trigger self-hosted deployment
gh workflow run azure-deploy-selfhosted.yml
```

### ⚠️ Backend Python Issues

The Python backend at `beamlab-backend-python.azurewebsites.net` is not responding.
To fix:

1. Check Azure App Service status
2. Verify deployment was successful
3. Check application logs in Azure portal
4. May need to redeploy or restart the service
