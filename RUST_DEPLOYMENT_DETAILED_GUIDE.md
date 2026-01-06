# 🚀 RUST DEPLOYMENT - EXTREMELY DETAILED STEP-BY-STEP GUIDE

**Date**: January 6, 2026  
**Objective**: Deploy Rust API to Azure using GitHub Actions  
**Difficulty**: Easy (copy-paste style, no coding needed)

---

## 📚 Table of Contents

1. [Understanding What We're Doing](#understanding)
2. [Detailed Step 1: Get the Registry Password](#step-1)
3. [Detailed Step 2: Get the Publish Profile](#step-2)
4. [Detailed Step 3: Add Secrets to GitHub](#step-3)
5. [Detailed Step 4: Trigger the Deployment](#step-4)
6. [Detailed Step 5: Monitor & Verify](#step-5)
7. [Troubleshooting in Detail](#troubleshooting)

---

## Understanding What We're Doing {#understanding}

### The Big Picture

You have a **Rust API** that's compiled and ready, but Azure doesn't know about it yet.

**Current State:**
- ✅ Rust code is on GitHub
- ✅ Rust binary is compiled (6.6 MB)
- ✅ Docker build instructions exist (Dockerfile)
- ✅ Azure has a container registry (ACR)
- ✅ Azure has an app service ready
- ❌ Container image NOT built
- ❌ Image NOT pushed to registry
- ❌ App service NOT configured to use the image

**What We're Doing:**
We're using **GitHub Actions** (GitHub's free automation) to:
1. **Build** a Linux Docker image (on GitHub's Linux server)
2. **Push** it to Azure Container Registry
3. **Deploy** it to Azure App Service
4. **Run** it at `beamlab-rust-api.azurewebsites.net`

### Why This Approach?

```
❌ Local (won't work):
   macOS (no Docker) → Can't build Linux image

✅ GitHub Actions (works perfectly):
   GitHub's Ubuntu → Has Docker → Builds Linux image → Pushes to Azure
```

---

## Step 1: Get the Registry Password {#step-1}

### What is this?
- Your Azure Container Registry needs a password
- The registry is like a Docker "warehouse" in the cloud
- GitHub will use this to authenticate and push images

### Where to Find It

**Option A: Using Command Line (Easiest)**

Run this exact command in your terminal:

```bash
az acr credential show --name beamlabregistry --query "passwords[0].value" --output tsv
```

**What you'll get:**
```
m9w2uMC5wEmF1DpLgzDgZoIcldP/CoCpPvXrtEOZP2+ACRC/UiT5
```

**Copy this password and save it somewhere safe (like a text editor)**

---

**Option B: Using Azure Portal (If Command Fails)**

1. Go to https://portal.azure.com
2. Search for "beamlabregistry" in the top search bar
3. Click on it
4. In the left sidebar, click "**Access keys**"
5. You'll see **Registry name** = `beamlabregistry`
6. You'll see **password** (admin user) = `m9w2uMC5wEmF1DpLgzDgZoIcldP/CoCpPvXrtEOZP2+ACRC/UiT5`
7. Click the copy icon next to the password

### What You Now Have

✅ **REGISTRY_USERNAME**: `beamlabregistry`

✅ **REGISTRY_PASSWORD**: `m9w2uMC5wEmF1DpLgzDgZoIcldP/CoCpPvXrtEOZP2+ACRC/UiT5`

---

## Step 2: Get the Publish Profile {#step-2}

### What is this?
- A publish profile tells GitHub **how to deploy** to Azure
- It contains authentication details and deployment instructions
- It's in XML format (looks like this: `<publishProfile>...</publishProfile>`)

### Getting the Publish Profile

**Run this exact command:**

```bash
az webapp deployment list-publishing-profiles \
  --resource-group beamlab-ci-rg \
  --name beamlab-rust-api \
  --xml
```

**What you'll get:**
A long XML block that looks like:
```xml
<publishData>
  <publishProfile profileName="beamlab-rust-api - Web Deploy" publishMethod="MSDeploy" ...>
    <!-- lots of details here -->
  </publishProfile>
  <publishProfile profileName="beamlab-rust-api - FTP" publishMethod="FTP" ...>
    <!-- more details -->
  </publishProfile>
  <publishProfile profileName="beamlab-rust-api - Zip Deploy" publishMethod="ZipDeploy" ...>
    <!-- even more details -->
  </publishProfile>
</publishData>
```

### Saving the Profile

**IMPORTANT:** Copy the ENTIRE output including `<publishData>` and `</publishData>`

The output will be long (several hundred characters). Make sure you copy it ALL.

**To save it to a file for easy access:**

```bash
az webapp deployment list-publishing-profiles \
  --resource-group beamlab-ci-rg \
  --name beamlab-rust-api \
  --xml > ~/Desktop/publish-profile.xml
```

Then open the file:
```bash
cat ~/Desktop/publish-profile.xml
```

Copy everything you see.

### What You Now Have

✅ **AZURE_PUBLISH_PROFILE_RUST**: `<publishData>...</publishData>` (the entire XML block)

---

## Step 3: Add Secrets to GitHub {#step-3}

### What Are Secrets?
Secrets are encrypted values that GitHub stores safely. They're:
- ✅ Encrypted (can't be read)
- ✅ Never shown in logs
- ✅ Only used by authorized workflows
- ✅ Similar to password managers

### How to Add Secrets to GitHub

**Go to your GitHub repository:**

1. Open: https://github.com/rakshittiwari048-ship-it/newanti

2. Click the **"Settings"** tab (at the top of the repo page)
   ```
   Code | Issues | Pull requests | Discussions | Actions | Projects | Settings
                                                                             ↑ Click here
   ```

3. In the left sidebar, find **"Secrets and variables"** section
   - Look for: **Secrets** → **Actions**
   - Or click directly: https://github.com/rakshittiwari048-ship-it/newanti/settings/secrets/actions

4. You'll see a page that says **"Repository secrets"**

5. Click the green **"New repository secret"** button

---

### Adding Secret #1: REGISTRY_USERNAME

1. Click **"New repository secret"**

2. **Name field**: Type exactly: `REGISTRY_USERNAME`
   ```
   REGISTRY_USERNAME
   ```

3. **Secret field**: Type or paste: `beamlabregistry`
   ```
   beamlabregistry
   ```

4. Click **"Add secret"** button

**Result:** You'll see a green checkmark and it appears in your list

---

### Adding Secret #2: REGISTRY_PASSWORD

1. Click **"New repository secret"** again

2. **Name field**: Type exactly: `REGISTRY_PASSWORD`
   ```
   REGISTRY_PASSWORD
   ```

3. **Secret field**: Paste the password from Step 1
   ```
   m9w2uMC5wEmF1DpLgzDgZoIcldP/CoCpPvXrtEOZP2+ACRC/UiT5
   ```

4. Click **"Add secret"** button

**Result:** Green checkmark appears in your list

---

### Adding Secret #3: AZURE_PUBLISH_PROFILE_RUST

1. Click **"New repository secret"** again

2. **Name field**: Type exactly: `AZURE_PUBLISH_PROFILE_RUST`
   ```
   AZURE_PUBLISH_PROFILE_RUST
   ```

3. **Secret field**: Paste the ENTIRE XML from Step 2
   ```xml
   <publishData><publishProfile profileName="beamlab-rust-api - Web Deploy" publishMethod="MSDeploy" publishUrl="beamlab-rust-api.scm.azurewebsites.net:443" msdeploySite="beamlab-rust-api" userName="REDACTED" userPWD="REDACTED" destinationAppUrl="http://beamlab-rust-api.azurewebsites.net" SQLServerDBConnectionString="REDACTED" mySQLDBConnectionString="" hostingProviderForumLink="" controlPanelLink="https://portal.azure.com" webSystem="WebSites"><databases /></publishProfile><publishProfile profileName="beamlab-rust-api - FTP" publishMethod="FTP" publishUrl="ftps://waws-prod-pn1-011.ftp.azurewebsites.windows.net/site/wwwroot" ftpPassiveMode="True" userName="REDACTED" userPWD="REDACTED" destinationAppUrl="http://beamlab-rust-api.azurewebsites.net" SQLServerDBConnectionString="REDACTED" mySQLDBConnectionString="" hostingProviderForumLink="" controlPanelLink="https://portal.azure.com" webSystem="WebSites"><databases /></publishProfile><publishProfile profileName="beamlab-rust-api - Zip Deploy" publishMethod="ZipDeploy" publishUrl="beamlab-rust-api.scm.azurewebsites.net:443" userName="REDACTED" userPWD="REDACTED" destinationAppUrl="http://beamlab-rust-api.azurewebsites.net" SQLServerDBConnectionString="REDACTED" mySQLDBConnectionString="" hostingProviderForumLink="" controlPanelLink="https://portal.azure.com" webSystem="WebSites"><databases /></publishProfile></publishData>
   ```

   **⚠️ IMPORTANT:** Make sure you copy the ENTIRE XML, from `<publishData>` to `</publishData>`

4. Click **"Add secret"** button

**Result:** Green checkmark appears, XML is encrypted and stored safely

---

### Verify All 3 Secrets Are Added

Go back to https://github.com/rakshittiwari048-ship-it/newanti/settings/secrets/actions

You should see all three listed:
```
✓ REGISTRY_USERNAME       Last used never
✓ REGISTRY_PASSWORD       Last used never
✓ AZURE_PUBLISH_PROFILE_RUST  Last used never
```

If you see all three, you're done with this step! ✅

---

## Step 4: Trigger the Deployment {#step-4}

### What Happens Now
Once you add the secrets, GitHub Actions will automatically:
1. Watch for any changes to the Rust API code
2. Build a Docker image when you push changes
3. Deploy it to Azure

### Option A: Automatic (Recommended)

Make a small change to the Rust API and push it:

```bash
cd /Users/rakshittiwari/Desktop/newanti

# Make a small change to the README
echo "# Rust API - Deployment Ready" > apps/rust-api/DEPLOYMENT_READY.md

# Add and commit
git add apps/rust-api/DEPLOYMENT_READY.md
git commit -m "feat: rust api ready for deployment"

# Push to GitHub
git push origin main
```

**What happens next:**
1. GitHub detects the push to `main`
2. GitHub detects changes in `apps/rust-api/`
3. Automatically triggers the workflow
4. You can watch it in the Actions tab

---

### Option B: Manual Trigger (If You Don't Want to Change Code)

1. Go to: https://github.com/rakshittiwari048-ship-it/newanti/actions

2. On the left, find **"Deploy Rust API to Azure"** workflow

3. Click on it

4. You'll see a button **"Run workflow"** (with a dropdown arrow)

5. Click the dropdown and select **Branch: main**

6. Click **"Run workflow"** (green button)

**What happens:**
- Workflow starts immediately
- No code changes needed
- Builds and deploys

---

## Step 5: Monitor & Verify {#step-5}

### Watch the Build Process

1. Go to: https://github.com/rakshittiwari048-ship-it/newanti/actions

2. Click on the **"Deploy Rust API to Azure"** workflow run (the one at the top)

3. You'll see a real-time progress:
   ```
   ✓ Checkout (30 seconds)
   ✓ Log in to Azure Container Registry (20 seconds)
   → Build and push Docker image (5-10 minutes)
   → Deploy to Azure Web App (2-3 minutes)
   ```

### What Each Step Does

**Checkout** (30 sec)
- Downloads your code from GitHub
- Nothing for you to do, just waiting

**Log in to Azure** (20 sec)
- Uses the REGISTRY_PASSWORD secret
- Authenticates to Azure Container Registry
- If this fails: check your password is correct

**Build Docker Image** (5-10 min first time, 2-3 min cached)
- Creates a Linux Docker image
- Runs the Dockerfile
- Installs all dependencies
- Compiles Rust code inside Docker
- If this fails: check Rust code for syntax errors

**Push to Registry** (1-2 min)
- Uploads the Docker image to Azure
- Saves it with tags: `latest` and commit hash
- If this fails: check ACR permissions

**Deploy to App Service** (2-3 min)
- Tells Azure App Service to use the new image
- Downloads the image
- Starts the container
- If this fails: check app service logs

### Checking Real-Time Logs

In the workflow run, click on each step to see details:

```
✓ Checkout code
  └─ Downloaded code from GitHub

✓ Log in to Azure Container Registry
  └─ Authenticated using REGISTRY_PASSWORD

→ Build and push Docker image
  ├─ Building image from Dockerfile
  ├─ Installing build dependencies
  ├─ Compiling Rust code (may take 5-10 min)
  ├─ Creating runtime image
  └─ Pushing to beamlabregistry.azurecr.io

→ Deploy to Azure Web App
  ├─ Using publish profile
  ├─ Starting deployment
  ├─ Pulling Docker image
  ├─ Starting container
  └─ Health checks
```

### Test the Deployment

After the workflow completes (green checkmark):

**Wait 1-2 minutes for the container to start**

Then run this test:

```bash
curl https://beamlab-rust-api.azurewebsites.net/health
```

**Expected response:**
```json
{
  "status": "ok",
  "service": "BeamLab Rust API"
}
```

If you get this, the deployment succeeded! 🎉

---

## Troubleshooting in Detail {#troubleshooting}

### Problem: Workflow shows ❌ Failed at "Log in to Azure"

**What went wrong:**
- Your REGISTRY_PASSWORD is wrong
- Or your REGISTRY_USERNAME is wrong

**How to fix:**
1. Get new credentials:
   ```bash
   az acr credential show --name beamlabregistry --query "passwords[0].value" --output tsv
   ```

2. Go to GitHub Settings → Secrets → Actions

3. Click on **REGISTRY_PASSWORD** → click "Update"

4. Paste the new password

5. Save and run the workflow again

---

### Problem: Workflow shows ❌ Failed at "Build Docker Image"

**What went wrong:**
- Probably a Rust syntax error in your code
- Or missing dependency in Cargo.toml

**How to fix:**
1. Check the workflow logs for the specific error
2. Look for lines starting with `error:`
3. Fix the Rust code
4. Commit and push again

---

### Problem: Workflow shows ❌ Failed at "Deploy to App Service"

**What went wrong:**
- Your AZURE_PUBLISH_PROFILE_RUST is wrong or expired
- Or the publish profile isn't complete

**How to fix:**
1. Get a new publish profile:
   ```bash
   az webapp deployment list-publishing-profiles \
     --resource-group beamlab-ci-rg \
     --name beamlab-rust-api \
     --xml
   ```

2. Go to GitHub Settings → Secrets → Actions

3. Click on **AZURE_PUBLISH_PROFILE_RUST** → "Update"

4. Paste the NEW entire XML

5. Save and run the workflow again

---

### Problem: Workflow succeeds but app shows ❌ HTTP 503

**What went wrong:**
- Container is running but not responding
- Startup command might be missing
- Environment variables not passed

**How to fix:**
Check app service logs:
```bash
az webapp log tail --resource-group beamlab-ci-rg --name beamlab-rust-api
```

Look for errors about:
- Port 8080 not exposed
- RUST_LOG not set
- Binary not found
- Database connection failed

---

### Problem: Workflow succeeds but health check times out

**What went wrong:**
- Container takes longer to start
- Or health endpoint path is wrong

**How to fix:**
Wait 30-60 seconds and try again:
```bash
sleep 60
curl https://beamlab-rust-api.azurewebsites.net/health
```

---

### Checking App Service Logs Manually

```bash
# Stream logs in real-time
az webapp log tail --resource-group beamlab-ci-rg --name beamlab-rust-api

# Download last 10 lines
az webapp log download --resource-group beamlab-ci-rg --name beamlab-rust-api -o /tmp/logs

# Check if container is running
az webapp show --resource-group beamlab-ci-rg --name beamlab-rust-api --query "state"
```

---

## ✅ Summary Checklist

**Step 1: Get Credentials**
- [ ] Run: `az acr credential show ...`
- [ ] Copy: Registry password
- [ ] You have: REGISTRY_USERNAME = `beamlabregistry`
- [ ] You have: REGISTRY_PASSWORD = `m9w2u...`

**Step 2: Get Publish Profile**
- [ ] Run: `az webapp deployment list-publishing-profiles ...`
- [ ] Copy: ENTIRE XML from `<publishData>` to `</publishData>`
- [ ] You have: AZURE_PUBLISH_PROFILE_RUST = `<publishData>...`

**Step 3: Add Secrets to GitHub**
- [ ] Go to: github.com/.../settings/secrets/actions
- [ ] Add: REGISTRY_USERNAME = `beamlabregistry`
- [ ] Add: REGISTRY_PASSWORD = `m9w2u...`
- [ ] Add: AZURE_PUBLISH_PROFILE_RUST = `<publishData>...`
- [ ] Verify: All 3 secrets visible and showing "Last used never"

**Step 4: Trigger Deployment**
- [ ] Make a git commit in apps/rust-api/
- [ ] Or manually trigger workflow from Actions tab
- [ ] GitHub Actions starts automatically

**Step 5: Monitor**
- [ ] Go to Actions tab
- [ ] Watch the workflow run
- [ ] See each step complete
- [ ] Wait for green checkmark

**Step 6: Verify**
- [ ] Wait 2 minutes after workflow completes
- [ ] Run: `curl https://beamlab-rust-api.azurewebsites.net/health`
- [ ] Should get HTTP 200 with JSON response
- [ ] See the status page at: https://beamlab-rust-api.azurewebsites.net

---

## 🎉 You're Done!

After verification, your system will have:
- ✅ Node.js API: `beamlab-backend-node.azurewebsites.net` (Auth)
- ✅ Python Backend: `beamlab-backend-python.azurewebsites.net` (Analysis)
- ✅ Rust API: `beamlab-rust-api.azurewebsites.net` (Super-fast analysis)
- ✅ Frontend: `beamlabultimate.tech` (User interface)

**All production-ready!** 🚀

---

## 📞 Need Help?

**Check these resources:**
1. Read the troubleshooting section above
2. Check GitHub Actions logs for specific error
3. Review Azure App Service logs
4. Verify all secrets were added correctly

All tools are set up. It's just copy-paste from this guide! 💪
