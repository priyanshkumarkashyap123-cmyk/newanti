#!/bin/bash
# Validate that all required deployment secrets are present and valid
# Usage: ./scripts/validate-secrets.sh [env_file]
# Exit codes: 0 = all required secrets present, 1 = missing or invalid secret

set -e

ENV_FILE="${1:-.env.deploy}"

# Define required secrets with descriptions
declare -A REQUIRED_SECRETS=(
  ["MONGODB_URI"]="MongoDB connection string (format: mongodb+srv://user:pass@...)"
  ["JWT_SECRET"]="JWT signing secret (minimum 32 characters)"
  ["JWT_REFRESH_SECRET"]="JWT refresh secret (minimum 32 characters)"
  ["CLERK_SECRET_KEY"]="Clerk API secret key (used for auth provider integration)"
  ["SENTRY_DSN"]="Sentry error tracking DSN (optional for dev, required for prod)"
  ["INTERNAL_SERVICE_SECRET"]="Service-to-service secret (minimum 16 characters)"
)

# Define optional secrets with descriptions
declare -A OPTIONAL_SECRETS=(
  ["AZURE_CREDENTIALS"]="Azure auth credentials (usually from GitHub secret)"
  ["OPENTELEMETRY_ENDPOINT"]="OpenTelemetry collection endpoint (for distributed tracing)"
)

MISSING_COUNT=0
INVALID_COUNT=0

# Check environment variable sources (command line, env vars, or .env file)
get_secret() {
  local key="$1"
  local value=""
  
  # Priority 1: Already in environment
  if [ -n "${!key:-}" ]; then
    echo "${!key}"
    return 0
  fi
  
  # Priority 2: Look in env file if it exists
  if [ -f "$ENV_FILE" ]; then
    value=$(grep "^$key=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo "")
    if [ -n "$value" ]; then
      echo "$value"
      return 0
    fi
  fi
  
  # Priority 3: Check if GitHub Actions has it (via secrets context)
  local gh_secrets_var="SECRET_$key"
  if [ -n "${!gh_secrets_var:-}" ]; then
    echo "${!gh_secrets_var}"
    return 0
  fi
  
  return 1
}

echo "=== DEPLOYMENT SECRETS VALIDATION ==="
echo

# Check required secrets
echo "Checking REQUIRED secrets:"
for key in "${!REQUIRED_SECRETS[@]}"; do
  if value=$(get_secret "$key"); then
    echo "  ✓ $key"
    
    # Additional validation for specific secrets
    case "$key" in
      JWT_SECRET|JWT_REFRESH_SECRET)
        if [ ${#value} -lt 32 ]; then
          echo "    ⚠ WARNING: $key is shorter than recommended 32 characters (actual: ${#value})"
          ((INVALID_COUNT++))
        fi
        ;;
      INTERNAL_SERVICE_SECRET)
        if [ ${#value} -lt 16 ]; then
          echo "    ✗ FAIL: $key must be at least 16 characters (actual: ${#value})"
          ((INVALID_COUNT++))
        fi
        ;;
      MONGODB_URI)
        if ! [[ "$value" =~ ^mongodb ]]; then
          echo "    ✗ FAIL: $key must start with 'mongodb' or 'mongodb+srv'"
          ((INVALID_COUNT++))
        fi
        ;;
    esac
  else
    echo "  ✗ $key — MISSING"
    echo "    Description: ${REQUIRED_SECRETS[$key]}"
    ((MISSING_COUNT++))
  fi
done

echo
echo "Checking OPTIONAL secrets:"
for key in "${!OPTIONAL_SECRETS[@]}"; do
  if value=$(get_secret "$key"); then
    echo "  ✓ $key (present)"
  else
    echo "  ○ $key (not configured, will use defaults)"
  fi
done

echo
echo "=== VALIDATION SUMMARY ==="
echo "Required secrets present: $((${#REQUIRED_SECRETS[@]} - MISSING_COUNT))/${#REQUIRED_SECRETS[@]}"
echo "Invalid secrets: $INVALID_COUNT"

if [ "$MISSING_COUNT" -gt 0 ]; then
  echo
  echo "✗ FAILED: Missing $MISSING_COUNT required secret(s)"
  echo
  echo "To fix, ensure these secrets are set:"
  for key in "${!REQUIRED_SECRETS[@]}"; do
    if ! get_secret "$key" >/dev/null 2>&1; then
      echo "  - $key: ${REQUIRED_SECRETS[$key]}"
    fi
  done
  exit 1
fi

if [ "$INVALID_COUNT" -gt 0 ]; then
  echo
  echo "✗ FAILED: $INVALID_COUNT secret validation error(s) detected"
  exit 1
fi

echo "✓ All required secrets validated"
exit 0
