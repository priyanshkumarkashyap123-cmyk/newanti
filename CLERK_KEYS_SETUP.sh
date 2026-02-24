#!/bin/bash

# ============================================
# Clerk Keys Setup Script
# ============================================
# This script helps you configure Clerk authentication keys
# Usage: bash CLERK_KEYS_SETUP.sh

set -e

echo "🔐 BeamLab Ultimate - Clerk Keys Setup"
echo "========================================"
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not found. Please install it:"
    echo "   https://cli.github.com"
    exit 1
fi

# Check if user is authenticated with GitHub
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub. Please run:"
    echo "   gh auth login"
    exit 1
fi

echo "✅ GitHub CLI authenticated"
echo ""

# Get repository
REPO=$(gh repo view --json nameWithOwner -q)
echo "📦 Repository: $REPO"
echo ""

# Prompt for production key
echo "Please provide your production Clerk keys:"
echo ""
read -p "Enter VITE_CLERK_PUBLISHABLE_KEY (pk_live_...): " PROD_KEY

if [[ ! $PROD_KEY =~ ^pk_live_ ]]; then
    echo "❌ Invalid key format. Production key should start with 'pk_live_'"
    exit 1
fi

echo ""
echo "Setting GitHub repository secret..."
gh secret set VITE_CLERK_PUBLISHABLE_KEY --body "$PROD_KEY"

echo ""
echo "✅ GitHub secret configured successfully!"
echo ""
echo "🔑 Keys Summary:"
echo "   - Production: VITE_CLERK_PUBLISHABLE_KEY set in GitHub secrets"
echo "   - Development: Test key in apps/web/.env.local"
echo ""
echo "📝 Next Steps:"
echo "   1. Configure Allowed Origins in Clerk Dashboard:"
echo "      - https://beamlabultimate.tech"
echo "      - https://www.beamlabultimate.tech"
echo "      - http://localhost:5173 (local dev)"
echo ""
echo "   2. Test locally:"
echo "      cd apps/web && pnpm run dev"
echo ""
echo "   3. Push to main to trigger production deployment:"
echo "      git push origin main"
echo ""

