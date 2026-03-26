#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/deploy_with_env.sh
# This script uses local secret files (must not be committed) to perform a full
# deploy flow:
#   1) load `.env.deploy`
#   2) commit + push current repo changes
#   3) make repository public
#   4) sync GitHub secrets / Azure app settings via `scripts/deploy_secrets.sh`
#   5) wait for backend + frontend workflows to complete
#   6) make repository private again
# It avoids printing secret values.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if [ ! -f .env.deploy ]; then
  echo "Error: .env.deploy not found. Copy .env.deploy.example -> .env.deploy and fill values."
  exit 1
fi

# Load .env.deploy (supports multiline quoted values, e.g. AZURE_CREDENTIALS JSON)
echo "Loading .env.deploy into environment (secrets will not be echoed)."
set -a
# shellcheck disable=SC1091
source .env.deploy
set +a

# Repository target
REPO="priyanshkumarkashyap123-cmyk/newanti"
if [ -z "$REPO" ]; then
  echo "Warning: cannot determine repo remote URL. Provide GITHUB_REPOSITORY env like owner/repo."
  exit 1
fi

cleanup() {
  echo "Reverting repository visibility to private..."
  if command -v gh >/dev/null 2>&1; then
    gh repo edit "$REPO" --visibility private >/dev/null 2>&1 || echo "Warning: failed to set repo private via gh"
  elif [ -n "${GITHUB_ADMIN_TOKEN:-}" ]; then
    curl -s -H "Authorization: token $GITHUB_ADMIN_TOKEN" -X PATCH "https://api.github.com/repos/$REPO" -d '{"private":true}' >/dev/null 2>&1 || echo "Warning: failed to set repo private via API"
  else
    echo "Manual step required: set repository back to private in GitHub settings."
  fi
}

trap cleanup EXIT

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI is required for this script."
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  echo "Error: Azure CLI (az) is required for this script."
  exit 1
fi

if ! gh auth token >/dev/null 2>&1; then
  echo "Error: gh CLI does not have an active usable token. Run 'gh auth login' first."
  exit 1
fi

echo "Checking for local changes to commit..."
if [ -n "$(git status --porcelain)" ]; then
  echo "Committing and pushing current changes to main..."
  git add .
  git commit -m "chore(deploy): finalize production deployment" || true
  git push origin main
else
  echo "No local git changes detected."
fi

echo "Preparing to toggle repository visibility to public. This requires admin rights."

if command -v gh >/dev/null 2>&1; then
  echo "Using gh CLI to set repo public..."
  gh repo edit "$REPO" --visibility public --accept-visibility-change-consequences || { echo "gh repo edit failed"; exit 1; }
else
  if [ -n "${GITHUB_ADMIN_TOKEN:-}" ]; then
    echo "Using GitHub API to set repo public..."
    curl -s -H "Authorization: token $GITHUB_ADMIN_TOKEN" -X PATCH "https://api.github.com/repos/$REPO" -d '{"private":false}' | jq . >/dev/null
  else
    echo "Error: gh CLI not available and GITHUB_ADMIN_TOKEN not set. Cannot toggle repo visibility."
    exit 1
  fi
fi

echo "Syncing repository secrets and Azure app settings..."
bash scripts/deploy_secrets.sh

echo "Finding latest workflow runs..."
sleep 8
AZ_RUN_ID=$(gh run list --repo "$REPO" --workflow azure-deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId // empty')
SWA_RUN_ID=$(gh run list --repo "$REPO" --workflow azure-static-web-apps-brave-mushroom-0eae8ec00.yml --limit 1 --json databaseId --jq '.[0].databaseId // empty')

if [ -n "${AZ_RUN_ID:-}" ] && [ "$AZ_RUN_ID" != "null" ]; then
  echo "Watching backend deployment run: $AZ_RUN_ID"
  gh run watch "$AZ_RUN_ID" --repo "$REPO" || true
else
  echo "Warning: backend workflow run not found"
fi

if [ -n "${SWA_RUN_ID:-}" ] && [ "$SWA_RUN_ID" != "null" ]; then
  echo "Watching frontend deployment run: $SWA_RUN_ID"
  gh run watch "$SWA_RUN_ID" --repo "$REPO" || true
else
  echo "Warning: frontend workflow run not found"
fi

echo "Evaluating workflow outcomes with job-level checks..."

backend_json=$(gh run view "$AZ_RUN_ID" --repo "$REPO" --json status,conclusion,jobs,url 2>/dev/null || echo '{}')
frontend_json=$(gh run view "$SWA_RUN_ID" --repo "$REPO" --json status,conclusion,url 2>/dev/null || echo '{}')

echo "Backend run summary:"
echo "$backend_json" | jq '{status, conclusion, url, jobs: [.jobs[]? | {name, status, conclusion}]}' || true

echo "Frontend run summary:"
echo "$frontend_json" | jq '{status, conclusion, url}' || true

# Enforce critical backend jobs only (Rust is explicitly non-blocking in workflow)
api_ok=$(echo "$backend_json" | jq -r '[.jobs[]? | select(.name == "deploy-api") | .conclusion] | last // "unknown"')
python_ok=$(echo "$backend_json" | jq -r '[.jobs[]? | select(.name == "deploy-python") | .conclusion] | last // "unknown"')
rust_ok=$(echo "$backend_json" | jq -r '[.jobs[]? | select(.name == "deploy-rust") | .conclusion] | last // "unknown"')

if [ "$api_ok" != "success" ]; then
  echo "Error: deploy-api job did not succeed (conclusion=$api_ok)."
  exit 1
fi

if [ "$python_ok" != "success" ]; then
  echo "Error: deploy-python job did not succeed (conclusion=$python_ok)."
  exit 1
fi

if [ "$rust_ok" != "success" ]; then
  echo "Warning: deploy-rust did not succeed (conclusion=$rust_ok). Continuing because Rust is non-blocking."
fi

frontend_conclusion=$(echo "$frontend_json" | jq -r '.conclusion // "unknown"')
if [ "$frontend_conclusion" != "success" ]; then
  echo "Error: frontend workflow did not succeed (conclusion=$frontend_conclusion)."
  exit 1
fi

echo "Deployment workflows completed. Running final public health checks..."
for url in \
  https://beamlabultimate.tech \
  https://beamlab-backend-node-prod.azurewebsites.net/health \
  https://beamlab-backend-python-prod.azurewebsites.net/health \
  https://beamlab-rust-api-prod.azurewebsites.net/health; do
  code=$(curl --max-time 20 -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
  echo "$url -> $code"
done

echo "Done."