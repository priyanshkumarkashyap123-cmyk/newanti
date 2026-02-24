#!/bin/bash
# =============================================================================
# GitHub Actions Usage Checker
# =============================================================================
# 
# This script helps you check your GitHub Actions minutes usage
# Requires: gh (GitHub CLI) - install with: brew install gh
#
# Usage: ./check-github-actions-usage.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    GitHub Actions Usage Checker                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed${NC}"
    echo ""
    echo "Install it with:"
    echo "  brew install gh"
    echo ""
    echo "Then authenticate:"
    echo "  gh auth login"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated with GitHub CLI${NC}"
    echo ""
    echo "Please authenticate:"
    echo "  gh auth login"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ GitHub CLI authenticated${NC}"
echo ""

# Get current username
CURRENT_USER=$(gh api user -q .login)
echo -e "${BLUE}Current Account: $CURRENT_USER${NC}"
echo ""

# Check if we can access the API
echo -e "${YELLOW}Fetching GitHub Actions usage...${NC}"
echo ""

# Get billing information (requires admin access)
BILLING_RESPONSE=$(gh api "/users/$CURRENT_USER/settings/billing/actions" 2>&1)

if [[ $? -eq 0 ]]; then
    # Parse the response
    TOTAL_MINUTES=$(echo "$BILLING_RESPONSE" | jq -r '.total_minutes_used // 0')
    INCLUDED_MINUTES=$(echo "$BILLING_RESPONSE" | jq -r '.included_minutes // 3000')
    REMAINING_MINUTES=$((INCLUDED_MINUTES - TOTAL_MINUTES))
    
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║    Usage Summary                                           ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Account: ${GREEN}$CURRENT_USER${NC}"
    echo -e "Total Minutes Used: ${YELLOW}$TOTAL_MINUTES${NC}"
    echo -e "Included Minutes: ${BLUE}$INCLUDED_MINUTES${NC}"
    echo -e "Remaining Minutes: ${GREEN}$REMAINING_MINUTES${NC}"
    echo ""
    
    # Calculate percentage
    PERCENTAGE=$((TOTAL_MINUTES * 100 / INCLUDED_MINUTES))
    
    if [ $PERCENTAGE -ge 90 ]; then
        echo -e "${RED}⚠️  WARNING: ${PERCENTAGE}% of minutes used!${NC}"
        echo -e "${RED}Consider switching to alternate account or self-hosted runner${NC}"
    elif [ $PERCENTAGE -ge 75 ]; then
        echo -e "${YELLOW}⚠️  NOTICE: ${PERCENTAGE}% of minutes used${NC}"
        echo -e "${YELLOW}Start planning for alternate account setup${NC}"
    else
        echo -e "${GREEN}✅ Usage OK: ${PERCENTAGE}% of minutes used${NC}"
    fi
    echo ""
    
    # Visual bar
    USED_BARS=$((PERCENTAGE / 2))
    REMAINING_BARS=$((50 - USED_BARS))
    
    echo -e "${BLUE}Usage Bar:${NC}"
    echo -n "["
    for ((i=0; i<USED_BARS; i++)); do echo -n "█"; done
    for ((i=0; i<REMAINING_BARS; i++)); do echo -n "░"; done
    echo "] ${PERCENTAGE}%"
    echo ""
    
else
    echo -e "${YELLOW}⚠️  Unable to fetch billing information${NC}"
    echo ""
    echo "This could mean:"
    echo "1. You don't have admin access to this account"
    echo "2. The repository belongs to an organization"
    echo "3. API permissions need to be updated"
    echo ""
    echo "Try checking manually at:"
    echo "  https://github.com/settings/billing/summary"
    echo ""
fi

# Alternative: Check workflow runs
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    Recent Workflow Runs                                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get repository info
REPO=$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')

if [ ! -z "$REPO" ]; then
    echo "Repository: $REPO"
    echo ""
    
    # Get recent workflow runs
    RUNS=$(gh api "repos/$REPO/actions/runs?per_page=5" 2>&1)
    
    if [[ $? -eq 0 ]]; then
        echo "$RUNS" | jq -r '.workflow_runs[] | "[\(.conclusion // "running")] \(.name) - \(.created_at)"' | head -5
        echo ""
        echo "View all runs at:"
        echo "  https://github.com/$REPO/actions"
    else
        echo -e "${YELLOW}⚠️  Unable to fetch workflow runs${NC}"
        echo "Check: https://github.com/$REPO/actions"
    fi
else
    echo -e "${YELLOW}⚠️  Not in a git repository${NC}"
fi

echo ""

# Recommendations
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    Recommendations                                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $REMAINING_MINUTES -lt 500 ]; then
    echo -e "${RED}🚨 URGENT: Low on minutes!${NC}"
    echo ""
    echo "Run the setup script NOW:"
    echo "  ./setup-alternate-github-account.sh"
    echo ""
elif [ $REMAINING_MINUTES -lt 1000 ]; then
    echo -e "${YELLOW}⚠️  Plan ahead:${NC}"
    echo ""
    echo "1. Read: GITHUB_ACTIONS_ALTERNATE_ACCOUNT_SETUP.md"
    echo "2. Prepare alternate account credentials"
    echo "3. Export secrets from current repository"
    echo ""
else
    echo -e "${GREEN}✅ You're good for now!${NC}"
    echo ""
    echo "Monitor usage periodically with:"
    echo "  ./check-github-actions-usage.sh"
    echo ""
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
