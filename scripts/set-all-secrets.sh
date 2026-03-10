#!/usr/bin/env bash
set -euo pipefail

# BeamLab one-shot secret setup
# - Updates local .env with generated strong secrets (if missing/placeholders)
# - Sets GitHub Actions secrets for the current origin repo
# - Pulls MONGODB_URI from Azure Node app settings when available

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing command: $1"; exit 1; }
}

require_cmd gh
require_cmd openssl

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ .env not found at $ENV_FILE"
  exit 1
fi

# Detect repo from git origin
REPO="$(git -C "$ROOT_DIR" remote get-url origin | sed -E 's#https://github.com/##; s#\.git$##')"
if [[ -z "$REPO" ]]; then
  echo "❌ Could not detect GitHub repo from origin"
  exit 1
fi

# Ensure GH auth exists
if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "❌ GitHub CLI is not authenticated. Run: gh auth login -h github.com"
  exit 1
fi

# Best-effort Azure Mongo URI fetch
MONGO_URI=""
if command -v az >/dev/null 2>&1 && az account show >/dev/null 2>&1; then
  MONGO_URI="$(az webapp config appsettings list -n beamlab-backend-node -g beamlab-ci-rg --query "[?name=='MONGODB_URI'].value | [0]" -o tsv 2>/dev/null || true)"
fi

# Helper: upsert key=value in .env
upsert_env() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    perl -0777 -i -pe "s#^${key}=.*#${key}=${value}#mg" "$ENV_FILE"
  else
    printf "\n%s=%s\n" "$key" "$value" >> "$ENV_FILE"
  fi
}

# Generate strong secrets
GEN_JWT_SECRET="$(openssl rand -base64 64)"
GEN_JWT_REFRESH_SECRET="$(openssl rand -base64 64)"
GEN_SESSION_SECRET="$(openssl rand -base64 32)"
GEN_INTERNAL_SERVICE_SECRET="$(openssl rand -base64 32)"

# Update .env only if blank/placeholder
current_val() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d'=' -f2-
}

maybe_replace_secret() {
  local key="$1"
  local generated="$2"
  local cur
  cur="$(current_val "$key" || true)"
  if [[ -z "$cur" ]] || [[ "$cur" == "replace_with_secure_random_secret" ]] || [[ "$cur" == REPLACE_ME* ]]; then
    upsert_env "$key" "$generated"
    echo "✅ Updated $key in .env"
  else
    echo "ℹ️  Keeping existing $key in .env"
  fi
}

maybe_replace_secret "JWT_SECRET" "$GEN_JWT_SECRET"
maybe_replace_secret "JWT_REFRESH_SECRET" "$GEN_JWT_REFRESH_SECRET"
maybe_replace_secret "SESSION_SECRET" "$GEN_SESSION_SECRET"
maybe_replace_secret "INTERNAL_SERVICE_SECRET" "$GEN_INTERNAL_SERVICE_SECRET"

if [[ -n "$MONGO_URI" && "$MONGO_URI" != "null" ]]; then
  upsert_env "MONGODB_URI" "$MONGO_URI"
  echo "✅ Synced MONGODB_URI into .env from Azure"
fi

# Load .env values for secret sync
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Required/commonly used keys to sync to GitHub Actions
# Optional keys are only set when non-empty.
set_secret_if_present() {
  local name="$1"
  local value="${2:-}"
  if [[ -n "$value" ]]; then
    gh secret set "$name" --repo "$REPO" --body "$value" >/dev/null
    echo "✅ Set $name"
  else
    echo "⚠️  Skipped $name (empty)"
  fi
}

set_secret_if_present "VITE_SENTRY_DSN" "${VITE_SENTRY_DSN:-}"
set_secret_if_present "SENTRY_DSN" "${SENTRY_DSN:-}"
set_secret_if_present "MONGODB_URI" "${MONGODB_URI:-}"
set_secret_if_present "JWT_SECRET" "${JWT_SECRET:-}"
set_secret_if_present "JWT_REFRESH_SECRET" "${JWT_REFRESH_SECRET:-}"
set_secret_if_present "SESSION_SECRET" "${SESSION_SECRET:-}"
set_secret_if_present "INTERNAL_SERVICE_SECRET" "${INTERNAL_SERVICE_SECRET:-}"
set_secret_if_present "GOOGLE_API_KEY" "${GOOGLE_API_KEY:-}"
set_secret_if_present "OPENAI_API_KEY" "${OPENAI_API_KEY:-}"
set_secret_if_present "VITE_CLERK_PUBLISHABLE_KEY" "${VITE_CLERK_PUBLISHABLE_KEY:-}"
set_secret_if_present "CLERK_PUBLISHABLE_KEY" "${CLERK_PUBLISHABLE_KEY:-${VITE_CLERK_PUBLISHABLE_KEY:-}}"
set_secret_if_present "CLERK_SECRET_KEY" "${CLERK_SECRET_KEY:-}"
set_secret_if_present "PHONEPE_MERCHANT_ID" "${PHONEPE_MERCHANT_ID:-${VITE_PHONEPE_MERCHANT_ID:-}}"
set_secret_if_present "PHONEPE_SALT_KEY" "${PHONEPE_SALT_KEY:-}"
set_secret_if_present "PHONEPE_SALT_INDEX" "${PHONEPE_SALT_INDEX:-1}"
set_secret_if_present "AZURE_SUBSCRIPTION_ID" "${AZURE_SUBSCRIPTION_ID:-}"
set_secret_if_present "AZURE_TENANT_ID" "${AZURE_TENANT_ID:-}"

# Version default for web build tagging
set_secret_if_present "VITE_APP_VERSION" "${VITE_APP_VERSION:-1.0.0}"

echo "\n🎉 Secret setup completed for repo: $REPO"
echo "Next: trigger deploy after setting any missing third-party keys (Sentry/Clerk/PhonePe/OpenAI)."
