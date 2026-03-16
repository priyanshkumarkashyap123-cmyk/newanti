#!/usr/bin/env bash
set -euo pipefail

is_placeholder() {
  local value="${1:-}"
  [[ -z "$value" ]] && return 0
  [[ "$value" =~ your_|replace|changeme|example|placeholder|YOUR_ ]]
}

require_var() {
  local name="$1"
  local min_len="${2:-1}"
  local value="${!name:-}"

  if [[ -z "$value" ]]; then
    echo "❌ Missing required environment variable: $name"
    exit 1
  fi

  if is_placeholder "$value"; then
    echo "❌ Placeholder value detected for: $name"
    exit 1
  fi

  if (( ${#value} < min_len )); then
    echo "❌ Environment variable $name must be at least $min_len characters"
    exit 1
  fi
}

validate_no_unsafe_origins() {
  local origins="${CORS_ALLOWED_ORIGINS:-}"
  [[ -z "$origins" ]] && return 0

  IFS=',' read -r -a split_origins <<< "$origins"
  for raw_origin in "${split_origins[@]}"; do
    origin="$(echo "$raw_origin" | xargs)"
    [[ -z "$origin" ]] && continue

    if [[ "$origin" == "*" ]]; then
      echo "❌ Wildcard origin is not allowed in production: CORS_ALLOWED_ORIGINS"
      exit 1
    fi

    if [[ "$origin" =~ localhost|127\.0\.0\.1 ]]; then
      echo "❌ Localhost origin is not allowed in production: $origin"
      exit 1
    fi

    if [[ ! "$origin" =~ ^https:// ]]; then
      echo "❌ Non-HTTPS origin is not allowed in production: $origin"
      exit 1
    fi
  done
}

echo "🔐 Validating production secrets and trust configuration"

require_var AZURE_RESOURCE_GROUP 3
require_var AZURE_SUBSCRIPTION 3
require_var MONGODB_URI 10
require_var INTERNAL_SERVICE_SECRET 16

if [[ "${USE_CLERK:-true}" == "true" ]]; then
  require_var CLERK_SECRET_KEY 10
else
  require_var JWT_SECRET 32
fi

require_var GEMINI_API_KEY 10
require_var PHONEPE_MERCHANT_ID 3
require_var PHONEPE_SALT_KEY 16
require_var FRONTEND_URL 8

if [[ "${FRONTEND_URL:-}" =~ localhost|127\.0\.0\.1 ]] || [[ ! "${FRONTEND_URL:-}" =~ ^https:// ]]; then
  echo "❌ FRONTEND_URL must be a non-localhost HTTPS URL in production"
  exit 1
fi

validate_no_unsafe_origins

echo "✅ Production secret validation passed"
