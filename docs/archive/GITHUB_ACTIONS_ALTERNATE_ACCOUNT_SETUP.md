# GitHub Actions - Alternate Account Setup Guide

## 🎯 Problem
Main GitHub account has run out of free GitHub Actions minutes. Need to use alternate GitHub Copilot Pro account for CI/CD.

## 📋 Solutions Available

### **Option 1: Fork to Alternate Account (Recommended)**
Transfer repository ownership or fork to alternate account with available minutes.

#### Steps:
1. **Fork/Transfer Repository**
   ```bash
   # On alternate account's GitHub:
   # Go to: https://github.com/YOUR_MAIN_ACCOUNT/newanti/settings
   # Scroll to "Danger Zone"
   # Click "Transfer ownership"
   # Enter alternate account username
   ```

2. **Update Remote URLs Locally**
   ```bash
   cd /Users/rakshittiwari/Desktop/newanti
   
   # Check current remote
   git remote -v
   
   # Update to alternate account
   git remote set-url origin https://github.com/ALTERNATE_ACCOUNT/newanti.git
   
   # Or with SSH
   git remote set-url origin git@github.com:ALTERNATE_ACCOUNT/newanti.git
   
   # Verify
   git remote -v
   ```

3. **Re-add Secrets in New Repository**
   - Go to: `https://github.com/ALTERNATE_ACCOUNT/newanti/settings/secrets/actions`
   - Add all required secrets:
     - `REGISTRY_USERNAME`
     - `REGISTRY_PASSWORD`
     - `AZURE_PUBLISH_PROFILE_RUST`
     - `AZURE_CREDENTIALS`
     - `AZURE_STATIC_WEB_APPS_API_TOKEN_BRAVE_MUSHROOM_0EAE8EC00`
     - `AZURE_PUBLISH_PROFILE_API`
     - `AZURE_PUBLISH_PROFILE_PYTHON`

---

### **Option 2: Self-Hosted Runners (Free, Unlimited Minutes)**
Run GitHub Actions on your own machine/server.

#### Steps:

1. **Install Self-Hosted Runner**
   ```bash
   # Go to: https://github.com/YOUR_ACCOUNT/newanti/settings/actions/runners/new
   # Select macOS/Linux/Windows based on your system
   # Follow the download and configuration steps
   ```

2. **For macOS/Linux:**
   ```bash
   # Create a folder
   mkdir actions-runner && cd actions-runner
   
   # Download the latest runner package
   curl -o actions-runner-osx-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-osx-x64-2.311.0.tar.gz
   
   # Extract the installer
   tar xzf ./actions-runner-osx-x64-2.311.0.tar.gz
   
   # Create the runner and start the configuration
   ./config.sh --url https://github.com/YOUR_ACCOUNT/newanti --token YOUR_TOKEN
   
   # Run it
   ./run.sh
   ```

3. **Update Workflow Files**
   See modified workflows below.

---

### **Option 3: Use GitHub Actions from Alternate Account via Personal Access Token**
Keep main repo, but authenticate workflows with alternate account's PAT.

#### Steps:
1. **Create Personal Access Token on Alternate Account**
   - Go to alternate account: `https://github.com/settings/tokens`
   - Generate new token (classic) with scopes:
     - `repo` (full control)
     - `workflow`
     - `admin:org` (if using organization)

2. **Add Token to Main Repo Secrets**
   - Main account repo: `https://github.com/MAIN_ACCOUNT/newanti/settings/secrets/actions`
   - Add secret: `ALTERNATE_ACCOUNT_PAT`

3. **Update Workflows**
   See modified workflows below.

---

## 🔧 Modified Workflow Files

### For Self-Hosted Runners:

Create: `.github/workflows/deploy-rust-api-selfhosted.yml`
```yaml
name: Deploy Rust API (Self-Hosted)

on:
  push:
    branches:
      - main
    paths:
      - 'apps/rust-api/**'
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: self-hosted  # ← Changed from ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Log in to Azure Container Registry
        uses: azure/docker-login@v1
        with:
          login-server: beamlabregistry.azurecr.io
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: ./apps/rust-api
          push: true
          tags: |
            beamlabregistry.azurecr.io/beamlab-rust:latest
            beamlabregistry.azurecr.io/beamlab-rust:${{ github.sha }}
      
      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v2
        with:
          app-name: beamlab-rust-api
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE_RUST }}
          images: 'beamlabregistry.azurecr.io/beamlab-rust:latest'
```

### For Alternate Account PAT:

Update existing workflows to use PAT for checkout:
```yaml
steps:
  - uses: actions/checkout@v4
    with:
      token: ${{ secrets.ALTERNATE_ACCOUNT_PAT }}  # ← Add this
      submodules: true
```

---

## 📊 Comparison

| Solution | Cost | Setup Time | Maintenance | Speed |
|----------|------|------------|-------------|-------|
| **Fork to Alternate Account** | Free (3000 min/month) | 15 min | Low | Fast |
| **Self-Hosted Runner** | Hardware cost only | 30 min | Medium | Depends on machine |
| **Alternate PAT** | Free (uses alternate mins) | 10 min | Low | Fast |

---

## ✅ Recommended Approach

**Option 1 (Fork)** is recommended because:
- ✅ Clean separation
- ✅ Fresh 3000 minutes/month
- ✅ No infrastructure management
- ✅ Works exactly like current setup
- ✅ Easy rollback

---

## 🚀 Quick Start Script

```bash
#!/bin/bash
# run-alternate-account-setup.sh

echo "🔧 GitHub Actions Alternate Account Setup"
echo "=========================================="
echo ""
echo "Current remote:"
git remote -v
echo ""
echo "Enter your ALTERNATE GitHub account username:"
read ALT_ACCOUNT
echo ""
echo "Updating remote to: https://github.com/$ALT_ACCOUNT/newanti.git"
git remote set-url origin https://github.com/$ALT_ACCOUNT/newanti.git
echo ""
echo "✅ Remote updated:"
git remote -v
echo ""
echo "⚠️  NEXT STEPS:"
echo "1. Transfer repository ownership on GitHub to: $ALT_ACCOUNT"
echo "2. Re-add all secrets at: https://github.com/$ALT_ACCOUNT/newanti/settings/secrets/actions"
echo "3. Push to trigger workflows: git push origin main"
```

Save and run:
```bash
chmod +x run-alternate-account-setup.sh
./run-alternate-account-setup.sh
```

---

## 📝 Secrets Checklist

Copy these from main account to alternate account:

- [ ] `REGISTRY_USERNAME` - Azure Container Registry username
- [ ] `REGISTRY_PASSWORD` - Azure Container Registry password
- [ ] `AZURE_PUBLISH_PROFILE_RUST` - Rust API publish profile
- [ ] `AZURE_CREDENTIALS` - Azure credentials JSON
- [ ] `AZURE_STATIC_WEB_APPS_API_TOKEN_BRAVE_MUSHROOM_0EAE8EC00` - Static web app token
- [ ] `AZURE_PUBLISH_PROFILE_API` - Node API publish profile
- [ ] `AZURE_PUBLISH_PROFILE_PYTHON` - Python API publish profile

---

## 🆘 Troubleshooting

### "Remote rejected" after changing remote
```bash
# Re-authenticate
git credential-helper erase
git push origin main  # Will prompt for credentials
```

### Workflows not triggering
1. Check repository Actions settings are enabled
2. Verify secrets are added
3. Check branch protection rules

### Self-hosted runner not connecting
```bash
# Remove and reconfigure
cd actions-runner
./config.sh remove
./config.sh --url https://github.com/YOUR_ACCOUNT/newanti --token NEW_TOKEN
```

---

## 📞 Need Help?

1. Check GitHub Actions status: https://www.githubstatus.com/
2. View workflow logs in Actions tab
3. Verify secrets are correctly named (case-sensitive)

---

**Created:** January 23, 2026  
**For:** newanti structural engineering project
