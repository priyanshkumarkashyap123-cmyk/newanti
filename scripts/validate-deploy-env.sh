#!/bin/bash

# ITEM 6: Validate all required environment variables before deploy
# Usage: ./scripts/validate-deploy-env.sh

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Required environment variables by service
REQUIRED_VARS=(
  # Core
  "MONGODB_URI"
  "REDIS_URL"
  
  # Payment Processing
  "RAZORPAY_KEY_ID"
  "RAZORPAY_KEY_SECRET"
  "RAZORPAY_WEBHOOK_SECRET"
  
  # Authentication
  "CLERK_SECRET_KEY"
  "JWT_SECRET"
  "JWT_REFRESH_SECRET"
  
  # Frontend
  "VITE_RAZORPAY_KEY_ID"
  "VITE_API_GATEWAY_BASE_URL"
  
  # Services
  "RUST_API_URL"
  "PYTHON_API_URL"
)

# Optional variables (warn if missing)
OPTIONAL_VARS=(
  "SENTRY_DSN"
  "SLACK_WEBHOOK_DEPLOY"
  "SLACK_WEBHOOK_ERRORS"
)

echo "🔍 Validating deployment environment variables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

MISSING_REQUIRED=()
MISSING_OPTIONAL=()

# Check required variables
echo "Required variables:"
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_REQUIRED+=("$var")
    echo -e "  ${RED}❌${NC} $var (MISSING)"
  else
    # Mask the value (show first 5 chars + asterisks)
    value="${!var}"
    if [ ${#value} -gt 10 ]; then
      masked="${value:0:5}...${value: -3}"
    else
      masked="***"
    fi
    echo -e "  ${GREEN}✅${NC} $var (${masked})"
  fi
done

echo ""
echo "Optional variables:"
for var in "${OPTIONAL_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_OPTIONAL+=("$var")
    echo -e "  ${YELLOW}⚠️${NC}  $var (not set)"
  else
    echo -e "  ${GREEN}✅${NC} $var (set)"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#MISSING_REQUIRED[@]} -gt 0 ]; then
  echo -e "${RED}❌ DEPLOYMENT BLOCKED: Missing required variables:${NC}"
  printf '%s\n' "${MISSING_REQUIRED[@]}" | sed 's/^/  - /'
  echo ""
  echo "Set the missing variables and try again:"
  echo "  export ${MISSING_REQUIRED[0]}=<value>"
  exit 1
fi

if [ ${#MISSING_OPTIONAL[@]} -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Missing optional variables (deploy will continue):${NC}"
  printf '%s\n' "${MISSING_OPTIONAL[@]}" | sed 's/^/  - /'
  echo ""
fi

echo -e "${GREEN}✅ All required environment variables present${NC}"
exit 0
