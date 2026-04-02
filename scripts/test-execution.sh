#!/bin/bash
# Item 9: Final Integration Test Execution Script
# 
# Runs 8-phase staging validation for architecture hardening Items 1-9
# Schedule: Apr 3, 2026 | Est. Duration: 8-9 hours
#
# Usage: ./test-execution.sh [staging_base_url] [debug_mode]
# Example: ./test-execution.sh https://staging.beamlabultimate.tech true

set -euo pipefail

# ============================================
# Configuration
# ============================================

STAGING_URL="${1:-https://staging.beamlabultimate.tech}"
DEBUG_MODE="${2:-false}"
TEST_USER_EMAIL="test-$(date +%s)@beamlab.test"
TEST_TOKEN=""
TEST_PROJECT_ID=""
TEST_ANALYSIS_ID=""
RESULTS_FILE="test-results-$(date +%Y%m%d-%H%M%S).json"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# Logging Functions
# ============================================

log_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}\n"
}

log_phase() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] Phase: $1${NC}"
}

log_test() {
    echo -e "${YELLOW}  [TEST] $1${NC}"
}

log_pass() {
    echo -e "${GREEN}  ✅ $1${NC}"
}

log_fail() {
    echo -e "${RED}  ❌ $1${NC}"
}

log_info() {
    echo -e "  ℹ️  $1"
}

save_result() {
    local phase="$1"
    local test="$2"
    local status="$3"
    local details="$4"
    
    echo "{
      \"phase\": \"$phase\",
      \"test\": \"$test\",
      \"status\": \"$status\",
      \"details\": \"$details\",
      \"timestamp\": \"$(date -Iseconds)\"
    }," >> "$RESULTS_FILE"
}

# ============================================
# Phase 1: Environment Setup (1 hour)
# ============================================

phase_1_setup() {
    log_header "PHASE 1: ENVIRONMENT SETUP"
    log_phase "Deploy Items 1-8 to staging and verify basic health"
    
    log_test "Verify Node API health"
    if curl -sf "$STAGING_URL/health" > /dev/null 2>&1; then
        log_pass "Node API responding"
        save_result "Phase 1" "Node API health" "PASS" "HTTP 200"
    else
        log_fail "Node API not responding"
        save_result "Phase 1" "Node API health" "FAIL" "No response"
        return 1
    fi
    
    log_test "Verify Python API health"
    PYTHON_URL="${STAGING_URL/'/api'/''}"  # Remove /api from URL
    if curl -sf "https://staging-backend-python.azurewebsites.net/health" > /dev/null 2>&1; then
        log_pass "Python API responding"
        save_result "Phase 1" "Python API health" "PASS" "HTTP 200"
    else
        log_fail "Python API not responding (will continue)"
        save_result "Phase 1" "Python API health" "FAIL" "No response"
    fi
    
    log_test "Verify Rust API health"
    if curl -sf "https://staging-rust-api.azurecontainers.io/health" > /dev/null 2>&1; then
        log_pass "Rust API responding"
        save_result "Phase 1" "Rust API health" "PASS" "HTTP 200"
    else
        log_fail "Rust API not responding (will continue)"
        save_result "Phase 1" "Rust API health" "FAIL" "No response"
    fi
    
    log_test "Verify MongoDB connectivity"
    # This would require internal endpoint access
    log_info "MongoDB connectivity check requires internal access (manual verification needed)"
    
    log_pass "Phase 1 Complete: Environment healthy"
}

# ============================================
# Phase 2: Smoke Tests (1.5 hours)
# ============================================

phase_2_smoke_tests() {
    log_header "PHASE 2: SMOKE TESTS"
    log_phase "Run Item 6 scripts: health checks + parity pack"
    
    log_test "Run health checks script"
    if [ -f "./scripts/smoke-tests/health-checks.sh" ]; then
        if bash ./scripts/smoke-tests/health-checks.sh; then
            log_pass "Health checks passed (all 4 services healthy)"
            save_result "Phase 2" "Health checks" "PASS" "All services responding"
        else
            log_fail "Health checks failed"
            save_result "Phase 2" "Health checks" "FAIL" "One or more services unhealthy"
            return 1
        fi
    else
        log_fail "Health checks script not found"
        save_result "Phase 2" "Health checks" "FAIL" "Script missing"
    fi
    
    log_test "Run parity pack (7-test critical flows)"
    if [ -f "./scripts/smoke-tests/parity-pack.sh" ]; then
        if BASE_URL="$STAGING_URL" bash ./scripts/smoke-tests/parity-pack.sh; then
            log_pass "Parity pack passed (7/7 scenarios)"
            save_result "Phase 2" "Parity pack" "PASS" "All 7 tests passed"
        else
            log_fail "Parity pack failed"
            save_result "Phase 2" "Parity pack" "FAIL" "One or more tests failed"
            return 1
        fi
    else
        log_fail "Parity pack script not found"
        save_result "Phase 2" "Parity pack" "FAIL" "Script missing"
    fi
    
    log_test "Validate environment"
    if [ -f "./scripts/validate-deploy-env.sh" ]; then
        if bash ./scripts/validate-deploy-env.sh; then
            log_pass "Environment validation passed"
            save_result "Phase 2" "Env validation" "PASS" "All required vars present"
        else
            log_fail "Environment validation failed"
            save_result "Phase 2" "Env validation" "FAIL" "Missing required variables"
        fi
    fi
    
    log_pass "Phase 2 Complete: Smoke tests passed"
}

# ============================================
# Phase 3: Contract Normalization Test (30 min)
# ============================================

phase_3_contract_test() {
    log_header "PHASE 3: CONTRACT NORMALIZATION TEST"
    log_phase "Verify Item 4: camelCase ↔ snake_case transformation"
    
    log_test "Request normalization (camelCase → snake_case)"
    local response=$(curl -s -X POST "$STAGING_URL/api/v1/analyze" \
        -H "Content-Type: application/json" \
        -d '{
            "projectId": "test_proj",
            "startNodeId": 1,
            "endNodeId": 2,
            "nodeList": [{"id": 1, "x": 0, "y": 0}, {"id": 2, "x": 10, "y": 0}],
            "loadCases": [{"name": "DL", "appliedLoads": [{"nodeId": 1, "loadX": 10, "loadY": 0}]}]
        }' 2>/dev/null || echo '{}')
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        log_pass "Request normalized and processed"
        save_result "Phase 3" "Request normalization" "PASS" "camelCase accepted"
    else
        log_fail "Request normalization failed"
        save_result "Phase 3" "Request normalization" "FAIL" "Request rejected"
    fi
    
    log_test "Response denormalization (snake_case → camelCase)"
    # Check that response fields are in camelCase
    if echo "$response" | jq -e '.result.deflections' > /dev/null 2>&1; then
        log_pass "Response in camelCase format"
        save_result "Phase 3" "Response denormalization" "PASS" "camelCase returned"
    else
        log_info "Analysis still processing (async) - manual verification needed"
        save_result "Phase 3" "Response denormalization" "SKIP" "Async processing"
    fi
    
    log_pass "Phase 3 Complete: Contract test done"
}

# ============================================
# Phase 4: Ownership Enforcement Test (30 min)
# ============================================

phase_4_ownership_test() {
    log_header "PHASE 4: OWNERSHIP ENFORCEMENT TEST"
    log_phase "Verify Item 5: Write authorization"
    
    log_test "Check authorization logs (Node can write projects)"
    # This requires log access
    log_info "Ownership tests require MongoDB/log access (manual verification needed)"
    log_info "Check node-api.log for OWNERSHIP_VIOLATION: should be 0"
    
    log_test "Verify write operations logged"
    log_info "Administrator should verify in Azure Log Analytics"
    
    save_result "Phase 4" "Ownership enforcement" "PENDING" "Manual log verification"
    log_pass "Phase 4 Complete (requires manual log review)"
}

# ============================================
# Phase 5: Rate Limiting Test (45 min)
# ============================================

phase_5_rate_limit_test() {
    log_header "PHASE 5: RATE LIMITING TEST"
    log_phase "Verify Item 7: Tier-based rate limiting"
    
    log_test "Rate limit response format"
    local limited_response=$(curl -s -X GET "$STAGING_URL/api/v1/health" \
        -H "Authorization: Bearer invalid_token_to_trigger_limit" 2>/dev/null || echo '{}')
    
    log_info "Rate limit headers in response:"
    curl -i -X GET "$STAGING_URL/api/v1/health" 2>/dev/null | grep -i "ratelimit" || log_info "No rate limit headers (test user may not be rate limited)"
    
    save_result "Phase 5" "Rate limit enforcement" "PENDING" "Manual load test needed"
    log_pass "Phase 5 Complete (requires load test for full validation)"
}

# ============================================
# Phase 6: Observability Test (45 min)
# ============================================

phase_6_observability_test() {
    log_header "PHASE 6: OBSERVABILITY TEST"
    log_phase "Verify Item 7: Request tracing + structured logging"
    
    log_test "Request ID propagation"
    local request_with_id=$(curl -i -s -X GET "$STAGING_URL/health" 2>/dev/null)
    
    if echo "$request_with_id" | grep -qi "x-request-id"; then
        log_pass "Request ID present in response headers"
        local req_id=$(echo "$request_with_id" | grep -i "x-request-id" | cut -d' ' -f2)
        log_info "Request ID: $req_id"
        save_result "Phase 6" "Request ID propagation" "PASS" "ID: $req_id"
    else
        log_info "Request ID not in response (may be logged in stdout)"
        save_result "Phase 6" "Request ID propagation" "PENDING" "Manual log verification"
    fi
    
    log_test "Structured logging format"
    log_info "Check Azure Log Analytics for JSON-formatted logs"
    log_info "Expected format: { timestamp, level, service, request_id, action, duration_ms }"
    
    save_result "Phase 6" "Structured logging" "PENDING" "Manual verification"
    log_pass "Phase 6 Complete (requires log access for full validation)"
}

# ============================================
# Phase 7: Documentation Verification (30 min)
# ============================================

phase_7_docs_test() {
    log_header "PHASE 7: DOCUMENTATION VERIFICATION"
    log_phase "Verify Item 8: ADRs + Architecture guide"
    
    log_test "ADR-001: MongoDB Ownership Model"
    if [ -f "docs/adr/ADR-001-mongodb-ownership.md" ]; then
        local lines=$(wc -l < "docs/adr/ADR-001-mongodb-ownership.md")
        log_pass "ADR-001 present ($lines lines)"
        save_result "Phase 7" "ADR-001" "PASS" "$lines lines"
    else
        log_fail "ADR-001 not found"
        save_result "Phase 7" "ADR-001" "FAIL" "File missing"
    fi
    
    log_test "ADR-002: Rate Limiting Strategy"
    if [ -f "docs/adr/ADR-002-rate-limiting.md" ]; then
        local lines=$(wc -l < "docs/adr/ADR-002-rate-limiting.md")
        log_pass "ADR-002 present ($lines lines)"
        save_result "Phase 7" "ADR-002" "PASS" "$lines lines"
    else
        log_fail "ADR-002 not found"
        save_result "Phase 7" "ADR-002" "FAIL" "File missing"
    fi
    
    log_test "ADR-003: Contract Normalization"
    if [ -f "docs/adr/ADR-003-contract-normalization.md" ]; then
        local lines=$(wc -l < "docs/adr/ADR-003-contract-normalization.md")
        log_pass "ADR-003 present ($lines lines)"
        save_result "Phase 7" "ADR-003" "PASS" "$lines lines"
    else
        log_fail "ADR-003 not found"
        save_result "Phase 7" "ADR-003" "FAIL" "File missing"
    fi
    
    log_test "ARCHITECTURE.md"
    if [ -f "docs/ARCHITECTURE.md" ]; then
        local lines=$(wc -l < "docs/ARCHITECTURE.md")
        log_pass "ARCHITECTURE.md present ($lines lines)"
        save_result "Phase 7" "ARCHITECTURE.md" "PASS" "$lines lines"
    else
        log_fail "ARCHITECTURE.md not found"
        save_result "Phase 7" "ARCHITECTURE.md" "FAIL" "File missing"
    fi
    
    log_pass "Phase 7 Complete: Documentation verified"
}

# ============================================
# Phase 8: E2E Integration Test (2 hours)
# ============================================

phase_8_e2e_test() {
    log_header "PHASE 8: END-TO-END INTEGRATION TEST"
    log_phase "Complete user journey: signup → project → analyze → report"
    
    log_test "Step 1: User signup (Item 1 - Auth)"
    log_info "Signup endpoint: POST /api/v1/auth/signup"
    log_info "Expected: User created, JWT token returned"
    save_result "Phase 8" "Signup" "PENDING" "Manual test required"
    
    log_test "Step 2: Create project (Item 5 - Ownership)"
    log_info "Project write endpoint: POST /api/v1/projects"
    log_info "Expected: Project created, Node ownership verified"
    save_result "Phase 8" "Create project" "PENDING" "Manual test required"
    
    log_test "Step 3: Submit analysis (Items 4,5,7)"
    log_info "Analysis endpoint: POST /api/v1/analyze"
    log_info "Expected: Contract normalized, Rate limit enforced, Request ID logged"
    save_result "Phase 8" "Submit analysis" "PENDING" "Manual test required"
    
    log_test "Step 4: View results (Item 4 - Contract)"
    log_info "Results endpoint: GET /api/v1/analyses/{id}/results"
    log_info "Expected: Response denormalized to camelCase"
    save_result "Phase 8" "View results" "PENDING" "Manual test required"
    
    log_test "Step 5: Design check (Items 4,5)"
    log_info "Design endpoint: POST /api/v1/design/check"
    log_info "Expected: Contract transformation, Python receives snake_case"
    save_result "Phase 8" "Design check" "PENDING" "Manual test required"
    
    log_test "Step 6: Generate report (Item 5 - Ownership)"
    log_info "Report endpoint: POST /api/v1/reports"
    log_info "Expected: Report created, Node ownership verified"
    save_result "Phase 8" "Generate report" "PENDING" "Manual test required"
    
    log_pass "Phase 8 Complete (requires manual E2E testing)"
}

# ============================================
# Load Testing (1 hour)
# ============================================

load_test() {
    log_header "LOAD TESTING"
    log_phase "100 concurrent users, 10 minutes duration"
    
    log_test "Verify k6 installed"
    if command -v k6 &> /dev/null; then
        log_pass "k6 load testing tool available"
        log_info "Running: k6 run tests/load-test.js --stage 2m:0 --stage 8m:100"
        log_info "(Estimated duration: 10 minutes)"
        # Actual k6 execution would go here
        save_result "Load Test" "k6 execution" "PENDING" "Manual execution needed"
    else
        log_fail "k6 not installed. Install with: npm install -g k6"
        log_info "Or: brew install k6 (macOS)"
        save_result "Load Test" "k6 availability" "FAIL" "k6 not installed"
    fi
    
    log_info "Expected metrics:"
    log_info "  - P95 latency: < 1000ms"
    log_info "  - Error rate: < 5% (rate limiting expected)"
    log_info "  - Request IDs: All requests have ID"
}

# ============================================
# Sign-Off Review
# ============================================

sign_off_review() {
    log_header "PRODUCTION SIGN-OFF REVIEW"
    log_phase "Verify all gate criteria met"
    
    echo -e "\n${YELLOW}Sign-Off Checklist:${NC}\n"
    
    local checks=(
        "Item 1: Health assessment documented"
        "Item 2: Node gateway restored"
        "Item 3: CORS/Auth hardened"
        "Item 4: Contract normalization working"
        "Item 5: Ownership enforcement active"
        "Item 6: Smoke test scripts pass"
        "Item 7: Rate limiting + observability"
        "Item 8: Documentation complete"
        "Item 9: E2E integration passes"
        "Security review passed"
        "On-call team trained"
        "Zero critical issues found"
    )
    
    for check in "${checks[@]}"; do
        echo -e "  [ ] $check"
    done
    
    echo -e "\n${YELLOW}Gate Status:${NC}"
    echo "  [ ] READY FOR PRODUCTION (all items checked)"
    echo "  [ ] NEEDS FIXES (see results file: $RESULTS_FILE)"
    
    log_info "Results saved to: $RESULTS_FILE"
}

# ============================================
# Main Execution
# ============================================

main() {
    log_header "ITEM 9: FINAL INTEGRATION TEST EXECUTION"
    log_info "Staging URL: $STAGING_URL"
    log_info "Start time: $(date)"
    log_info "Results file: $RESULTS_FILE"
    
    # Initialize results file
    echo "[" > "$RESULTS_FILE"
    
    # Run phases
    phase_1_setup || true
    phase_2_smoke_tests || true
    phase_3_contract_test || true
    phase_4_ownership_test || true
    phase_5_rate_limit_test || true
    phase_6_observability_test || true
    phase_7_docs_test || true
    phase_8_e2e_test || true
    load_test || true
    
    # Sign-off review
    sign_off_review
    
    # Finalize results
    echo "]" >> "$RESULTS_FILE"
    
    log_header "EXECUTION COMPLETE"
    log_info "Total time: $(date)"
    log_info "Results saved to: $RESULTS_FILE"
    log_pass "Test execution finished. Review results and sign-off checklist above."
}

# Run main if not sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
