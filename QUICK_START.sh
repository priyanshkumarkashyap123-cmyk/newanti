#!/bin/bash
# =============================================================================
# QUICK START - GitHub Actions Alternate Account
# =============================================================================
# 
# Run this to get started immediately!
#
# =============================================================================

cat << 'EOF'

╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   🚀 GITHUB ACTIONS - ALTERNATE ACCOUNT SETUP                        ║
║   Quick Start Guide                                                  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝

📋 WHAT'S THE PROBLEM?
   Your main GitHub account is out of GitHub Actions minutes (0/3000).
   You need to use your alternate GitHub Copilot Pro account.

✅ WHAT'S THE SOLUTION?
   Transfer this repository to your alternate account to get 3,000 fresh
   minutes per month.

⏱️  HOW LONG WILL IT TAKE?
   10 minutes (following this guide)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 STEP-BY-STEP INSTRUCTIONS:

STEP 1: Run the Setup Script
─────────────────────────────
   ./setup-alternate-github-account.sh

   This will:
   - Update your git remote to point to alternate account
   - Create a secrets checklist for you
   - Generate a quick reference guide

STEP 2: Transfer the Repository on GitHub
──────────────────────────────────────────
   a) Go to: https://github.com/YOUR_MAIN_ACCOUNT/newanti/settings
   
   b) Scroll down to the "Danger Zone" section
   
   c) Click "Transfer ownership"
   
   d) Enter your ALTERNATE account username
   
   e) Type the repository name to confirm: newanti
   
   f) Click "I understand, transfer this repository"

STEP 3: Add Secrets to New Repository
──────────────────────────────────────
   a) Go to: https://github.com/YOUR_ALT_ACCOUNT/newanti/settings/secrets/actions
   
   b) Click "New repository secret" for each:
   
      ✓ REGISTRY_USERNAME
      ✓ REGISTRY_PASSWORD
      ✓ AZURE_PUBLISH_PROFILE_RUST
      ✓ AZURE_CREDENTIALS
      ✓ AZURE_STATIC_WEB_APPS_API_TOKEN_BRAVE_MUSHROOM_0EAE8EC00
      ✓ AZURE_PUBLISH_PROFILE_API
      ✓ AZURE_PUBLISH_PROFILE_PYTHON
   
   c) Copy each value from your main account's secrets

STEP 4: Enable GitHub Actions
──────────────────────────────
   a) Go to: https://github.com/YOUR_ALT_ACCOUNT/newanti/settings/actions
   
   b) Ensure "Allow all actions and reusable workflows" is selected
   
   c) Click "Save"

STEP 5: Test the Setup
───────────────────────
   git push origin main

   Then check: https://github.com/YOUR_ALT_ACCOUNT/newanti/actions

   You should see:
   ✅ All 3 workflows running
   ✅ Using your alternate account's minutes
   ✅ Deployments completing successfully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 NEED MORE HELP?

   Full Documentation:
   -------------------
   START_HERE_GITHUB_ACTIONS.md           ← Best overview
   GITHUB_ACTIONS_SETUP_README.md         ← Quick reference
   GITHUB_ACTIONS_VISUAL_GUIDE.md         ← Visual diagrams
   GITHUB_ACTIONS_ALTERNATE_ACCOUNT_SETUP.md  ← Complete guide

   Scripts:
   --------
   ./setup-alternate-github-account.sh    ← Main setup script
   ./check-github-actions-usage.sh        ← Check minutes usage

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 READY TO START?

   Run: ./setup-alternate-github-account.sh

   Or manually follow the 5 steps above!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF

# Ask if they want to start now
echo ""
read -p "🚀 Start setup now? [y/N]: " START_NOW

if [[ $START_NOW =~ ^[Yy]$ ]]; then
    echo ""
    echo "🎯 Starting setup..."
    echo ""
    ./setup-alternate-github-account.sh
else
    echo ""
    echo "✅ No problem! Run this when ready:"
    echo "   ./setup-alternate-github-account.sh"
    echo ""
fi
