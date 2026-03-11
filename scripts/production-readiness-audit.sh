#!/bin/bash
# BeamLab production readiness audit
# Usage: ./scripts/production-readiness-audit.sh

set -u

# ---------- Config ----------
FRONTEND_URL="${FRONTEND_URL:-https://beamlabultimate.tech}"
NODE_HEALTH_URL="${NODE_HEALTH_URL:-https://beamlab-backend-node.azurewebsites.net/health}"
PYTHON_HEALTH_URL="${PYTHON_HEALTH_URL:-https://beamlab-backend-python.azurewebsites.net/health}"
RUST_HEALTH_URL="${RUST_HEALTH_URL:-https://beamlab-rust-api.azurewebsites.net/health}"
NODE_CORS_PROBE_URL="${NODE_CORS_PROBE_URL:-https://beamlab-backend-node.azurewebsites.net/api/analytics/batch}"
REPO="${REPO:-rakshittiwari048-ship-it/newanti}"

PASS=0
WARN=0
FAIL=0

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_pass() { echo -e "${GREEN}PASS${NC}  $1"; PASS=$((PASS+1)); }
log_warn() { echo -e "${YELLOW}WARN${NC}  $1"; WARN=$((WARN+1)); }
log_fail() { echo -e "${RED}FAIL${NC}  $1"; FAIL=$((FAIL+1)); }

hr() { printf '%*s\n' "${COLUMNS:-80}" '' | tr ' ' '-'; }

probe_http() {
  # Outputs: code time_total
  local url="$1"
  curl -sS -o /tmp/prod_audit_resp.txt --max-time 20 -w "%{http_code} %{time_total}" "$url" 2>/tmp/prod_audit_err.txt || echo "000 99"
}

check_health_json_ok() {
  local url="$1"
  local name="$2"
  local result code t
  result="$(probe_http "$url")"
  code="${result%% *}"
  t="${result##* }"
  if [[ "$code" != "200" ]]; then
    log_fail "$name not healthy (HTTP $code, ${t}s)"
    return
  fi

  if grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' /tmp/prod_audit_resp.txt; then
    log_pass "$name healthy (HTTP 200, ${t}s)"
  else
    log_warn "$name returned 200 but no explicit status=ok (time ${t}s)"
  fi
}

check_route_200() {
  local url="$1"
  local name="$2"
  local result code t
  result="$(probe_http "$url")"
  code="${result%% *}"
  t="${result##* }"
  if [[ "$code" == "200" ]]; then
    log_pass "$name reachable (HTTP 200, ${t}s)"
  elif [[ "$code" =~ ^30[1278]$ ]]; then
    log_warn "$name redirected (HTTP $code, ${t}s)"
  else
    log_fail "$name unreachable (HTTP $code, ${t}s)"
  fi
}

check_frontend_security_headers() {
  local headers
  headers="$(curl -sSI --max-time 20 "$FRONTEND_URL" 2>/dev/null || true)"

  local missing=()
  grep -qi '^strict-transport-security:' <<<"$headers" || missing+=("HSTS")
  grep -qi '^x-content-type-options:' <<<"$headers" || missing+=("X-Content-Type-Options")
  grep -qi '^x-frame-options:' <<<"$headers" || missing+=("X-Frame-Options")
  grep -qi '^content-security-policy:' <<<"$headers" || missing+=("CSP")

  if (( ${#missing[@]} == 0 )); then
    log_pass "Frontend security headers present (HSTS, XCTO, XFO, CSP)"
  elif (( ${#missing[@]} <= 2 )); then
    log_warn "Frontend missing some security headers: ${missing[*]}"
  else
    log_fail "Frontend missing critical security headers: ${missing[*]}"
  fi
}

check_node_cors_preflight() {
  local headers code
  headers="$(curl -sSI -X OPTIONS \
    -H "Origin: https://beamlabultimate.tech" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type" \
    --max-time 20 "$NODE_CORS_PROBE_URL" 2>/dev/null || true)"

  code="$(awk 'toupper($1) ~ /^HTTP\// {c=$2} END{print c+0}' <<<"$headers")"

  if [[ "$code" -eq 0 ]]; then
    log_fail "Node CORS preflight failed (no HTTP response)"
    return
  fi

  local has_acao=0
  local has_acam=0
  grep -qi '^access-control-allow-origin:' <<<"$headers" && has_acao=1
  grep -qi '^access-control-allow-methods:' <<<"$headers" && has_acam=1

  if (( has_acao == 1 && has_acam == 1 )); then
    log_pass "Node CORS preflight healthy (HTTP $code, ACAO + ACAM present)"
  elif (( has_acao == 1 )); then
    log_warn "Node preflight partially healthy (HTTP $code, ACAO present; ACAM missing)"
  else
    log_fail "Node CORS headers missing on preflight (HTTP $code)"
  fi
}

check_tls_days() {
  local host days
  host="$(echo "$FRONTEND_URL" | sed -E 's#https?://([^/]+).*#\1#')"
  local enddate
  enddate="$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"

  if [[ -z "$enddate" ]]; then
    log_fail "TLS check failed for $host"
    return
  fi

  local end_epoch now_epoch
  end_epoch="$(date -j -f "%b %e %T %Y %Z" "$enddate" +%s 2>/dev/null || true)"
  now_epoch="$(date +%s)"

  if [[ -z "$end_epoch" ]]; then
    log_warn "TLS expiry parse failed for $host (raw: $enddate)"
    return
  fi

  days=$(( (end_epoch - now_epoch) / 86400 ))

  if (( days >= 30 )); then
    log_pass "TLS certificate valid for $days more days"
  elif (( days >= 14 )); then
    log_warn "TLS certificate expires soon ($days days remaining)"
  else
    log_fail "TLS certificate critical ($days days remaining)"
  fi
}

check_repo_visibility() {
  if ! command -v gh >/dev/null 2>&1; then
    log_warn "gh CLI not found; skipping repo visibility check"
    return
  fi

  local vis
  vis="$(gh repo view "$REPO" --json visibility --jq '.visibility' 2>/dev/null || true)"
  if [[ -z "$vis" ]]; then
    log_warn "Could not read repo visibility (auth/repo access issue)"
  elif [[ "$vis" == "PRIVATE" ]]; then
    log_pass "Repository visibility is PRIVATE"
  else
    log_warn "Repository visibility is $vis (expected PRIVATE)"
  fi
}

check_latest_deploy() {
  if ! command -v gh >/dev/null 2>&1; then
    log_warn "gh CLI not found; skipping deployment workflow status"
    return
  fi

  local run_line status conclusion
  run_line="$(gh run list -R "$REPO" --workflow="Deploy to Azure" --limit 1 --json status,conclusion --jq '.[0] | "\(.status) \(.conclusion)"' 2>/dev/null || true)"

  status="${run_line%% *}"
  conclusion="${run_line##* }"

  if [[ -z "$status" || "$status" == "null" ]]; then
    log_warn "Could not read latest Deploy to Azure run status"
    return
  fi

  if [[ "$status" == "completed" && "$conclusion" == "success" ]]; then
    log_pass "Latest Deploy to Azure workflow succeeded"
  elif [[ "$status" == "in_progress" || "$status" == "queued" ]]; then
    log_warn "Latest Deploy to Azure workflow is $status"
  else
    log_fail "Latest Deploy to Azure workflow is $status/$conclusion"
  fi
}

# ---------- Run checks ----------

echo -e "${BLUE}BeamLab Production Readiness Audit${NC}"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
hr

check_latest_deploy
check_repo_visibility
hr

check_route_200 "$FRONTEND_URL" "Frontend home"
check_route_200 "$FRONTEND_URL/demo" "Demo page"
check_route_200 "$FRONTEND_URL/sign-in" "Sign-in page"
check_route_200 "$FRONTEND_URL/sign-up" "Sign-up page"
check_route_200 "$FRONTEND_URL/pricing" "Pricing page"
check_route_200 "$FRONTEND_URL/help" "Help page"
check_route_200 "$FRONTEND_URL/privacy" "Privacy page"
check_route_200 "$FRONTEND_URL/terms" "Terms page"
hr

check_health_json_ok "$NODE_HEALTH_URL" "Node API"
check_health_json_ok "$PYTHON_HEALTH_URL" "Python API"
check_health_json_ok "$RUST_HEALTH_URL" "Rust API"
hr

check_node_cors_preflight
check_frontend_security_headers
check_tls_days
hr

TOTAL=$((PASS + WARN + FAIL))
SCORE=$(( (PASS * 100) / (TOTAL == 0 ? 1 : TOTAL) ))

echo "Summary: PASS=$PASS WARN=$WARN FAIL=$FAIL"
echo "Readiness score: ${SCORE}/100"

if (( FAIL > 0 )); then
  echo "Result: NOT READY"
  exit 2
elif (( WARN > 0 )); then
  echo "Result: READY WITH WARNINGS"
  exit 1
else
  echo "Result: READY"
  exit 0
fi
