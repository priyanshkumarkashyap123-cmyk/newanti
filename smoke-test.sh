#!/bin/bash
# ============================================
# BeamLab Deployment Smoke Test
# ============================================
# Validates that all services are up, healthy, and
# critical API routes respond correctly after deployment.
#
# Usage:
#   ./smoke-test.sh                 # test localhost defaults
#   ./smoke-test.sh --prod          # test production endpoints
#   ./smoke-test.sh --base http://my-host:5173  # custom frontend URL

set -euo pipefail

# ============================================
# Configuration
# ============================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
TIMEOUT=5  # seconds per request
RETRIES=3

# Default local URLs
FRONTEND="http://localhost:5173"
NODE_API="http://localhost:3001"
PYTHON_API="http://localhost:8000"
RUST_API="http://localhost:3002"

# Parse arguments
case "${1:-}" in
    --prod)
        FRONTEND="https://www.beamlabultimate.tech"
        NODE_API="https://beamlab-backend-node-prod.azurewebsites.net"
        PYTHON_API="https://beamlab-backend-python-prod.azurewebsites.net"
        RUST_API="https://beamlab-rust-api-prod.azurewebsites.net"
        ;;
    --base)
        FRONTEND="${2:-$FRONTEND}"
        ;;
esac

echo ""
echo "=========================================="
echo "  BeamLab Deployment Smoke Test"
echo "=========================================="
echo "  Frontend : $FRONTEND"
echo "  Node API : $NODE_API"
echo "  Python   : $PYTHON_API"
echo "  Rust API : $RUST_API"
echo "  Timeout  : ${TIMEOUT}s per request"
echo "=========================================="
echo ""

# ============================================
# Helpers
# ============================================

check() {
    local label="$1"
    local url="$2"
    local expected_status="${3:-200}"

        local status="000"
        local attempt=1
        while [ "$attempt" -le "$RETRIES" ]; do
            status=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "000")
            if [ "$status" = "$expected_status" ]; then
                break
            fi
            attempt=$((attempt + 1))
            sleep 2
        done

    if [ "$status" = "$expected_status" ]; then
        printf "  ${GREEN}PASS${NC}  %-40s %s\n" "$label" "$url"
        PASS=$((PASS + 1))
    elif [ "$status" = "000" ]; then
        printf "  ${RED}FAIL${NC}  %-40s %s (unreachable/timeout)\n" "$label" "$url"
        FAIL=$((FAIL + 1))
    else
        printf "  ${RED}FAIL${NC}  %-40s %s (got %s, want %s)\n" "$label" "$url" "$status" "$expected_status"
        FAIL=$((FAIL + 1))
    fi
}

check_any() {
    local label="$1"
    local url="$2"
    shift 2
    local expected=("$@")

    local status="000"
    local attempt=1
    while [ "$attempt" -le "$RETRIES" ]; do
      status=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "000")

      for code in "${expected[@]}"; do
          if [ "$status" = "$code" ]; then
              printf "  ${GREEN}PASS${NC}  %-40s %s\n" "$label" "$url"
              PASS=$((PASS + 1))
              return
          fi
      done

      attempt=$((attempt + 1))
      sleep 2
    done

    if [ "$status" = "000" ]; then
        printf "  ${RED}FAIL${NC}  %-40s %s (unreachable/timeout)\n" "$label" "$url"
        FAIL=$((FAIL + 1))
    else
        printf "  ${RED}FAIL${NC}  %-40s %s (got %s, expected one of: %s)\n" "$label" "$url" "$status" "${expected[*]}"
        FAIL=$((FAIL + 1))
    fi
}

check_json() {
    local label="$1"
    local url="$2"
    local jq_filter="$3"

    local body
    body=$(curl -s --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "{}")
    local match
    match=$(echo "$body" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    v = $jq_filter
    print('1' if v else '0')
except:
    print('0')
" 2>/dev/null || echo "0")

    if [ "$match" = "1" ]; then
        printf "  ${GREEN}PASS${NC}  %-40s %s\n" "$label" "$url"
        PASS=$((PASS + 1))
    else
        printf "  ${YELLOW}WARN${NC}  %-40s %s (response mismatch)\n" "$label" "$url"
        WARN=$((WARN + 1))
    fi
}

section() {
    echo ""
    echo "--- $1 ---"
}

# ============================================
# Tests
# ============================================

section "Frontend"
check "Frontend serves HTML"       "$FRONTEND"
check "Frontend health endpoint"   "$FRONTEND/health"

section "Node API"
check "Node health"                "$NODE_API/health"

section "Python API"
check "Python root"                "$PYTHON_API/"
check "Python health"              "$PYTHON_API/health"
check_json "Python templates"      "$PYTHON_API/health" "d.get('templates_available') is not None"
check_any "Python OpenAPI docs"    "$PYTHON_API/docs" "200" "401"
check "Python dependency check"    "$PYTHON_API/health/dependencies"

section "Rust API"
check "Rust root"                  "$RUST_API/"
check "Rust health"                "$RUST_API/health"

section "Critical API Routes"
check_any "Rust analyze endpoint"  "$RUST_API/api/analyze"          "405" "401"  # 405 if public POST-only, 401 when auth-protected
check "Rust sections list"         "$RUST_API/api/sections"
check "Rust metrics"               "$RUST_API/api/metrics"
check_any "Python job queue status" "$PYTHON_API/api/jobs/queue/status" "200" "401"
check_any "Python mesh plate"      "$PYTHON_API/mesh/plate"         "422" "401"  # 422 for anonymous validation path, 401 if auth-protected

section "Cross-Origin (CORS)"
# Quick preflight against Python API
cors_status=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" \
    -X OPTIONS \
    -H "Origin: $FRONTEND" \
    -H "Access-Control-Request-Method: POST" \
    "$PYTHON_API/health" 2>/dev/null || echo "000")

if [ "$cors_status" = "200" ] || [ "$cors_status" = "204" ]; then
    printf "  ${GREEN}PASS${NC}  %-40s CORS preflight → %s\n" "Python CORS preflight" "$cors_status"
    PASS=$((PASS + 1))
else
    printf "  ${YELLOW}WARN${NC}  %-40s CORS preflight → %s\n" "Python CORS preflight" "$cors_status"
    WARN=$((WARN + 1))
fi

# ============================================
# Summary
# ============================================

echo ""
echo "=========================================="
TOTAL=$((PASS + FAIL + WARN))
printf "  Results: ${GREEN}%d passed${NC}  ${RED}%d failed${NC}  ${YELLOW}%d warnings${NC}  (total: %d)\n" "$PASS" "$FAIL" "$WARN" "$TOTAL"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then
    echo ""
    echo "  Some critical checks failed. Review deployment logs:"
    echo "    docker compose logs <service-name>"
    echo ""
    exit 1
fi

echo ""
echo "  All critical checks passed."
echo ""
exit 0
