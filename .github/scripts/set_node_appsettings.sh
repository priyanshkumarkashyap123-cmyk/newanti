#!/usr/bin/env bash
set -euo pipefail

# Load secrets from .env.deploy (do not print them)
ENV_FILE=".env.deploy"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Aborting."
  exit 1
fi

get_var() {
  grep -m1 "^$1=" "$ENV_FILE" | sed "s/^$1=//" | tr -d '\r' | tr -d '\n'
}

az webapp config appsettings set --resource-group beamlab-prod-rg --name beamlab-backend-node-prod --settings \
  NODE_ENV=production \
  USE_CLERK=true \
  FRONTEND_URL=https://beamlabultimate.tech \
  CORS_ALLOWED_ORIGINS=https://beamlabultimate.tech,https://www.beamlabultimate.tech \
  PYTHON_API_URL=https://beamlab-backend-python-prod.azurewebsites.net \
  RUST_API_URL=https://beamlab-rust-api-prod.azurewebsites.net \
  MONGODB_URI="$(get_var MONGODB_URI)" \
  JWT_SECRET="$(get_var JWT_SECRET)" \
  JWT_REFRESH_SECRET="$(get_var JWT_REFRESH_SECRET)" \
  CLERK_SECRET_KEY="$(get_var CLERK_SECRET_KEY)" \
  CLERK_PUBLISHABLE_KEY="$(get_var CLERK_PUBLISHABLE_KEY)" \
  SENTRY_DSN="$(get_var SENTRY_DSN)" \
  --only-show-errors

az webapp restart --resource-group beamlab-prod-rg --name beamlab-backend-node-prod
sleep 12
curl --max-time 10 -s -o /tmp/node_health.txt -w "%{http_code}" https://beamlab-backend-node-prod.azurewebsites.net/health || echo 000
head -c 400 /tmp/node_health.txt || true
