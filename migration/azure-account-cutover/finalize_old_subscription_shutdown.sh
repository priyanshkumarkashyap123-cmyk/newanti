#!/usr/bin/env bash
set -euo pipefail

OLD_SUBSCRIPTION_ID="2131a61f-38e0-40e6-a666-457c912974d1"
RG="beamlab-ci-rg"

az account set --subscription "$OLD_SUBSCRIPTION_ID"

# Keep data services intact unless you explicitly want deletion.
# Stop only compute/web workloads to preserve credits.
for app in beamlab-backend-node beamlab-backend-python beamlab-rust-api; do
  az webapp stop -g "$RG" -n "$app" -o none || true
done

az vm deallocate -g "$RG" -n gpu --no-wait || true

echo "OLD_SUBSCRIPTION_SAFE_SHUTDOWN_COMPLETE"
