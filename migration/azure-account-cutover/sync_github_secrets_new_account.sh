#!/usr/bin/env bash
set -euo pipefail

SUBSCRIPTION_ID="6eef4608-7e34-4237-834f-0e66cbd72ccd"
RG="beamlab-prod-rg"
PY_APP="beamlab-backend-python-prod"
SWA_APP="beamlab-frontend-prod"
REPO="priyanshkumarkashyap123-cmyk/newanti"

az account set --subscription "$SUBSCRIPTION_ID"

PY_USER="$(az webapp deployment list-publishing-credentials -g "$RG" -n "$PY_APP" --query publishingUserName -o tsv)"
PY_PASS="$(az webapp deployment list-publishing-credentials -g "$RG" -n "$PY_APP" --query publishingPassword -o tsv)"
PUBLISH_XML="$(az webapp deployment list-publishing-profiles -g "$RG" -n "$PY_APP" --xml)"
SWA_TOKEN="$(az staticwebapp secrets list -g "$RG" -n "$SWA_APP" --query properties.apiKey -o tsv)"

printf "%s" "$PY_USER" | gh secret set AZURE_PY_DEPLOY_USER --repo "$REPO"
printf "%s" "$PY_PASS" | gh secret set AZURE_PY_DEPLOY_PASS --repo "$REPO"
printf "%s" "$PUBLISH_XML" | gh secret set AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON --repo "$REPO"
printf "%s" "$SWA_TOKEN" | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --repo "$REPO"

echo "SECRET_SYNC_COMPLETE"
