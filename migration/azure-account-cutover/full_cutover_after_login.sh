#!/usr/bin/env bash
set -euo pipefail

BASE="/Users/rakshittiwari/Desktop/newanti/migration/azure-account-cutover"

bash "$BASE/deploy_bicep_after_login.sh"
bash "$BASE/post_deploy_hardening.sh"
bash "$BASE/verify_new_account_health.sh"
bash "$BASE/sync_github_secrets_new_account.sh"
bash "$BASE/finalize_old_subscription_shutdown.sh"

echo "FULL_CUTOVER_COMPLETE"
