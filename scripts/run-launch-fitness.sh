#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${ROOT_DIR}/.launch-fitness.log"

cd "${ROOT_DIR}"

echo "[Launch Fitness] Running launch gate checks..."

if pnpm run check:launch:fitness >"${LOG_FILE}" 2>&1; then
  cat "${LOG_FILE}"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      echo "## Launch Fitness Gate"
      echo ""
      echo "Status: PASS"
      echo ""
      echo "Checks:"
      echo "- Route versioning policy"
      echo "- Launch contract snapshots"
    } >> "${GITHUB_STEP_SUMMARY}"
  fi
  exit 0
fi

cat "${LOG_FILE}"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "## Launch Fitness Gate"
    echo ""
    echo "Status: FAIL"
    echo ""
    echo "### Quick Hints"
    echo "- If route policy failed, inspect docs/specs/unversioned-route-allowlist.txt and apps/api/src/index.ts"
    echo "- If contract snapshot failed, inspect apps/api/src/__tests__/launchContractSnapshots.test.ts"
    echo "- Reproduce locally: pnpm run check:launch:fitness"
    echo ""
    echo "### Tail Log"
    echo '```text'
    tail -n 80 "${LOG_FILE}"
    echo '```'
  } >> "${GITHUB_STEP_SUMMARY}"
fi

exit 1
