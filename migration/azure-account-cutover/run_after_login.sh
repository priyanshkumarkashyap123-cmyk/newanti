#!/usr/bin/env bash
set -euo pipefail

BASE="/Users/rakshittiwari/Desktop/newanti/migration/azure-account-cutover"

bash "$BASE/deploy_new_account_production.sh"
bash "$BASE/post_deploy_hardening.sh"
bash "$BASE/verify_new_account_health.sh"

echo "CUTOVER_AUTOMATION_COMPLETE"
