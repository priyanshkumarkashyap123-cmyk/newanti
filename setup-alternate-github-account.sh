#!/bin/bash
# =============================================================================
# GitHub Actions Alternate Account Setup Script
# =============================================================================
# 
# This script helps you switch your repository to use an alternate GitHub
# account to avoid running out of GitHub Actions minutes.
#
# Usage: ./setup-alternate-github-account.sh
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    GitHub Actions - Alternate Account Setup               ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""

# Step 1: Check current git remote
echo -e "${YELLOW}📍 Step 1: Current Repository Configuration${NC}"
echo "Current remote URL:"
git remote -v
echo ""

# Step 2: Get alternate account username
echo -e "${YELLOW}📝 Step 2: Enter Alternate Account Details${NC}"
read -p "Enter your ALTERNATE GitHub account username: " ALT_ACCOUNT

if [ -z "$ALT_ACCOUNT" ]; then
    echo -e "${RED}❌ Error: Account username cannot be empty${NC}"
    exit 1
fi

echo ""

# Step 3: Choose authentication method
echo -e "${YELLOW}🔐 Step 3: Choose Authentication Method${NC}"
echo "1) HTTPS (username/password or token)"
echo "2) SSH (requires SSH key setup)"
read -p "Enter choice [1-2]: " AUTH_CHOICE

case $AUTH_CHOICE in
    1)
        NEW_REMOTE="https://github.com/$ALT_ACCOUNT/newanti.git"
        ;;
    2)
        NEW_REMOTE="git@github.com:$ALT_ACCOUNT/newanti.git"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""

# Step 4: Confirm changes
echo -e "${YELLOW}⚠️  Step 4: Confirm Changes${NC}"
echo "Will update remote from:"
echo "  $(git remote get-url origin)"
echo "To:"
echo "  $NEW_REMOTE"
echo ""
read -p "Continue? [y/N]: " CONFIRM

if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Cancelled${NC}"
    exit 1
fi

# Step 5: Update remote
echo ""
echo -e "${YELLOW}🔧 Step 5: Updating Remote URL${NC}"
git remote set-url origin "$NEW_REMOTE"

# Verify
echo -e "${GREEN}✅ Remote updated successfully!${NC}"
echo ""
git remote -v
echo ""

# Step 6: Create secrets checklist
echo -e "${YELLOW}📋 Step 6: Secrets Migration Checklist${NC}"
cat > /tmp/github-secrets-checklist.txt << EOF
GitHub Actions Secrets Migration Checklist
==========================================
Date: $(date)
From: Main Account
To: $ALT_ACCOUNT

Copy these secrets to: https://github.com/$ALT_ACCOUNT/newanti/settings/secrets/actions

Required Secrets:
-----------------
[ ] REGISTRY_USERNAME
    Description: Azure Container Registry username
    
[ ] REGISTRY_PASSWORD
    Description: Azure Container Registry password
    
[ ] AZURE_PUBLISH_PROFILE_RUST
    Description: Azure Web App publish profile for Rust API
    
[ ] AZURE_CREDENTIALS
    Description: Azure service principal credentials (JSON)
    
[ ] AZURE_STATIC_WEB_APPS_API_TOKEN_BRAVE_MUSHROOM_0EAE8EC00
    Description: Azure Static Web Apps deployment token
    
[ ] AZURE_PUBLISH_PROFILE_API
    Description: Azure Web App publish profile for Node.js API
    
[ ] AZURE_PUBLISH_PROFILE_PYTHON
    Description: Azure Web App publish profile for Python backend

Optional Secrets:
-----------------
[ ] ALTERNATE_ACCOUNT_PAT (if using PAT method)
    Description: Personal Access Token from alternate account
    Scopes: repo, workflow

Notes:
------
- All secret names are case-sensitive
- Values should be copied exactly (no extra spaces)
- Test one workflow first before enabling all

EOF

cat /tmp/github-secrets-checklist.txt
echo ""
echo -e "${GREEN}✅ Checklist saved to: /tmp/github-secrets-checklist.txt${NC}"
echo ""

# Step 7: Next steps
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    🎯 NEXT STEPS (CRITICAL!)                               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}1. Transfer Repository Ownership${NC}"
echo "   a) Go to: https://github.com/YOUR_MAIN_ACCOUNT/newanti/settings"
echo "   b) Scroll to 'Danger Zone'"
echo "   c) Click 'Transfer ownership'"
echo "   d) Enter: $ALT_ACCOUNT"
echo "   e) Confirm the transfer"
echo ""

echo -e "${YELLOW}2. Enable GitHub Actions${NC}"
echo "   a) Go to: https://github.com/$ALT_ACCOUNT/newanti/settings/actions"
echo "   b) Ensure 'Allow all actions and reusable workflows' is selected"
echo "   c) Save changes"
echo ""

echo -e "${YELLOW}3. Add Repository Secrets${NC}"
echo "   a) Go to: https://github.com/$ALT_ACCOUNT/newanti/settings/secrets/actions"
echo "   b) Click 'New repository secret'"
echo "   c) Add all secrets from the checklist above"
echo "   d) Verify secret names match exactly (case-sensitive)"
echo ""

echo -e "${YELLOW}4. Test the Setup${NC}"
echo "   Run: git push origin main"
echo "   Then check: https://github.com/$ALT_ACCOUNT/newanti/actions"
echo ""

echo -e "${YELLOW}5. Verify Azure Connections${NC}"
echo "   Check that all three workflows run successfully:"
echo "   - Deploy Rust API to Azure"
echo "   - Deploy to Azure"
echo "   - Azure Static Web Apps CI/CD"
echo ""

# Step 8: Create quick reference card
cat > QUICK_REFERENCE_ALTERNATE_ACCOUNT.md << EOF
# Quick Reference: Alternate Account Setup

## ✅ Completed
- [x] Updated git remote to: $NEW_REMOTE
- [x] Created secrets checklist

## ⏳ Pending Actions

### 1. Transfer Repository
\`\`\`
Main account → https://github.com/MAIN_ACCOUNT/newanti/settings
Look for: "Transfer ownership" in Danger Zone
Transfer to: $ALT_ACCOUNT
\`\`\`

### 2. Add Secrets
\`\`\`
URL: https://github.com/$ALT_ACCOUNT/newanti/settings/secrets/actions

Secrets needed:
- REGISTRY_USERNAME
- REGISTRY_PASSWORD
- AZURE_PUBLISH_PROFILE_RUST
- AZURE_CREDENTIALS
- AZURE_STATIC_WEB_APPS_API_TOKEN_BRAVE_MUSHROOM_0EAE8EC00
- AZURE_PUBLISH_PROFILE_API
- AZURE_PUBLISH_PROFILE_PYTHON
\`\`\`

### 3. Test Push
\`\`\`bash
git push origin main
\`\`\`

### 4. Verify Workflows
\`\`\`
Check: https://github.com/$ALT_ACCOUNT/newanti/actions
All three workflows should run successfully
\`\`\`

## 📊 Account Limits

**Alternate Account ($ALT_ACCOUNT):**
- Free tier: 3,000 minutes/month
- Current usage: 0 minutes
- Resets: 1st of each month

## 🆘 Rollback (if needed)
\`\`\`bash
# Restore to main account
git remote set-url origin https://github.com/MAIN_ACCOUNT/newanti.git
\`\`\`

---
Setup Date: $(date)
EOF

echo -e "${GREEN}✅ Quick reference saved to: QUICK_REFERENCE_ALTERNATE_ACCOUNT.md${NC}"
echo ""

# Step 9: Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    ✅ LOCAL SETUP COMPLETE                                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}What was done:${NC}"
echo "  ✓ Git remote updated to $ALT_ACCOUNT"
echo "  ✓ Secrets checklist created"
echo "  ✓ Quick reference guide created"
echo ""
echo -e "${YELLOW}What you need to do:${NC}"
echo "  ⚠️  Transfer repository ownership on GitHub"
echo "  ⚠️  Add all secrets to new repository"
echo "  ⚠️  Test with: git push origin main"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "  📄 Full guide: GITHUB_ACTIONS_ALTERNATE_ACCOUNT_SETUP.md"
echo "  📄 Quick ref: QUICK_REFERENCE_ALTERNATE_ACCOUNT.md"
echo "  📄 Checklist: /tmp/github-secrets-checklist.txt"
echo ""
echo -e "${GREEN}🎉 Ready to transfer! Follow the next steps above.${NC}"
echo ""
