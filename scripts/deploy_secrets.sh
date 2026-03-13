#!/usr/bin/env bash
set -euo pipefail
REPO="priyanshkumarkashyap123-cmyk/newanti"
RG=beamlab-ci-rg
NODE_APP=beamlab-backend-node
PY_APP=beamlab-backend-python
RUST_APP=beamlab-rust-api
SWA_NAME="brave-mushroom-0eae8ec00"

find_var(){


  for f in .env.deploy apps/api/.env.local apps/backend-python/.env apps/web/.env.local apps/rust-api/.env; do
    [ -f "$f" ] || continue
    val=$(grep -m1 "^$1=" "$f" || true)
    if [ -n "$val" ]; then
      echo "${val#*=}"
      return 0
    fi
  done
  return 1
}

find_any_var(){
  for key in "$@"; do
    if val=$(find_var "$key" 2>/dev/null); then
      if [ -n "$val" ]; then
        echo "$val"
        return 0
      fi
    fi
  done
  return 1
}

set_secret_mapped(){
  local target="$1"
  shift
  if val=$(find_any_var "$@" 2>/dev/null); then
    echo "Setting GH secret: $target"
    gh secret set "$target" --body "$val" --repo "$REPO" || echo "gh secret set failed for $target"
  else
    echo "Local value for $target not found via mapped keys ($*); skipping"
  fi
}

echo "== Setting GitHub repository secrets into $REPO =="

# Core runtime secrets (with fallback key mapping)
set_secret_mapped JWT_SECRET JWT_SECRET
set_secret_mapped JWT_REFRESH_SECRET JWT_REFRESH_SECRET
set_secret_mapped SESSION_SECRET SESSION_SECRET
set_secret_mapped MONGODB_URI MONGODB_URI MONGODB_URL
set_secret_mapped USE_CLERK USE_CLERK VITE_USE_CLERK
set_secret_mapped TEMP_UNLOCK_ALL TEMP_UNLOCK_ALL VITE_TEMP_UNLOCK_ALL
set_secret_mapped CLERK_SECRET_KEY CLERK_SECRET_KEY
set_secret_mapped CLERK_PUBLISHABLE_KEY CLERK_PUBLISHABLE_KEY VITE_CLERK_PUBLISHABLE_KEY
set_secret_mapped GEMINI_API_KEY GEMINI_API_KEY GOOGLE_API_KEY
set_secret_mapped INTERNAL_SERVICE_SECRET INTERNAL_SERVICE_SECRET
set_secret_mapped SENTRY_DSN SENTRY_DSN
set_secret_mapped PHONEPE_MERCHANT_ID PHONEPE_MERCHANT_ID
set_secret_mapped PHONEPE_ENV PHONEPE_ENV VITE_PHONEPE_ENV
set_secret_mapped RAZORPAY_KEY_ID RAZORPAY_KEY_ID
set_secret_mapped RAZORPAY_KEY_SECRET RAZORPAY_KEY_SECRET
set_secret_mapped RAZORPAY_WEBHOOK_SECRET RAZORPAY_WEBHOOK_SECRET
set_secret_mapped VITE_RAZORPAY_KEY_ID VITE_RAZORPAY_KEY_ID RAZORPAY_KEY_ID
set_secret_mapped VITE_FORCE_PAYMENT_TEST_MODE VITE_FORCE_PAYMENT_TEST_MODE
set_secret_mapped PHONEPE_SALT_KEY PHONEPE_SALT_KEY
set_secret_mapped PHONEPE_SALT_INDEX PHONEPE_SALT_INDEX
set_secret_mapped REGISTRY_USERNAME REGISTRY_USERNAME
set_secret_mapped REGISTRY_PASSWORD REGISTRY_PASSWORD

# If user has provided publish profiles or SWA token in .env.deploy, prefer those over az fetch
set_secret_mapped AZURE_WEBAPP_PUBLISH_PROFILE_API AZURE_WEBAPP_PUBLISH_PROFILE_API
set_secret_mapped AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON
set_secret_mapped AZURE_PUBLISH_PROFILE_RUST AZURE_PUBLISH_PROFILE_RUST AZURE_WEBAPP_PUBLISH_PROFILE_RUST
set_secret_mapped AZURE_STATIC_WEB_APPS_API_TOKEN AZURE_STATIC_WEB_APPS_API_TOKEN

set_publish_profile(){
  local app="$1"
  local secretname="$2"
  echo "Fetching publish profile for $app"
  prof=$(az webapp deployment list-publishing-profiles --name "$app" --resource-group "$RG" --output json 2>/dev/null || true)
  if [ -n "$prof" ]; then
    xml="$prof"
    if command -v jq >/dev/null 2>&1; then
      xml_candidate=$(echo "$prof" | jq -r '.[0].publishProfile // empty' 2>/dev/null || true)
      if [ -n "$xml_candidate" ]; then
        xml="$xml_candidate"
      fi
    fi
    echo "Setting GH secret $secretname"
    gh secret set "$secretname" --body "$xml" --repo "$REPO" || echo "gh secret set failed for $secretname"
  else
    echo "Publish profile for $app not found via az. Please download manually and add as $secretname in repo settings."
  fi
}

set_publish_profile "$NODE_APP" AZURE_WEBAPP_PUBLISH_PROFILE_API
set_publish_profile "$PY_APP" AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON
set_publish_profile "$RUST_APP" AZURE_PUBLISH_PROFILE_RUST

if az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" >/dev/null 2>&1; then
  echo "Attempting to fetch SWA token"
  swaToken=$(az staticwebapp secrets list --name "$SWA_NAME" --resource-group "$RG" -o json 2>/dev/null || true)
  if [ -n "$swaToken" ]; then
    token=""
    if command -v jq >/dev/null 2>&1; then
      token=$(echo "$swaToken" | jq -r '.[0].value // empty' 2>/dev/null || true)
    fi
    if [ -n "$token" ]; then
      gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --body "$token" --repo "$REPO" || echo "Failed to set AZURE_STATIC_WEB_APPS_API_TOKEN"
      echo "SWA token set"
    else
      echo "Could not parse SWA token; please set AZURE_STATIC_WEB_APPS_API_TOKEN manually"
    fi
  else
    echo "Could not list SWA secrets via az; please set token manually"
  fi
else
  echo "Static Web App $SWA_NAME not found via az; skip SWA token retrieval"
fi

apply_app_settings(){
  local appname="$1"
  shift
  local keys=("$@")
  settings=()
  for k in "${keys[@]}"; do
    if v=$(find_var "$k" 2>/dev/null); then
      settings+=("$k=$v")
    fi
  done
  if [ ${#settings[@]} -gt 0 ]; then
    echo "Applying settings to $appname"
    az webapp config appsettings set --resource-group "$RG" --name "$appname" --settings "${settings[@]}" || echo "Failed to set settings for $appname"
  else
    echo "No settings found locally for $appname"
  fi
}

apply_app_settings "$NODE_APP" JWT_SECRET JWT_REFRESH_SECRET SESSION_SECRET MONGODB_URI CLERK_SECRET_KEY USE_CLERK TEMP_UNLOCK_ALL INTERNAL_SERVICE_SECRET SENTRY_DSN PHONEPE_MERCHANT_ID PHONEPE_SALT_KEY PHONEPE_SALT_INDEX PHONEPE_ENV RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET
apply_app_settings "$PY_APP" JWT_SECRET GEMINI_API_KEY MONGODB_URI INTERNAL_SERVICE_SECRET SENTRY_DSN
apply_app_settings "$RUST_APP" JWT_SECRET MONGODB_URI INTERNAL_SERVICE_SECRET

echo "Triggering workflows"
if gh workflow run azure-deploy.yml --repo "$REPO"; then echo "Triggered azure-deploy.yml"; else echo "Failed to trigger azure-deploy.yml"; fi
if gh workflow run azure-static-web-apps-brave-mushroom-0eae8ec00.yml --repo "$REPO"; then echo "Triggered frontend workflow"; else echo "Failed to trigger frontend workflow"; fi

echo "Recent azure-deploy runs:"
gh run list --repo "$REPO" --workflow=azure-deploy.yml --limit 5 || true

echo "Recent SWA runs:"
gh run list --repo "$REPO" --workflow=azure-static-web-apps-brave-mushroom-0eae8ec00.yml --limit 5 || true

echo "Done. If any manual items remain, please add publish profiles or SWA token in GitHub repo settings."
