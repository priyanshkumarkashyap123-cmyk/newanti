#!/bin/bash
# Pre-Test Validation Kit for Item 9 (Apr 2 Evening)
# 
# Verifies all Items 1-8 are deployed and ready for Apr 3 staging test
# Duration: ~15 minutes
# 
# Usage: ./scripts/pre-test-validation.sh [staging_base_url]

set -euo pipefail

STAGING_URL="${1:-https://staging.beamlabultimate.tech}"
DEBUG_MODE="${2:-false}"
VALIDATION_REPORT="pre-test-validation-$(date +%Y%m%d-%H%M%S).json"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# Logging
# ============================================

log_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}\n"
}

log_check() {
    echo -e "${YELLOW}[CHECK] $1${NC}"
}

log_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_fail() {
    echo -e "${RED}❌ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_info() {
    echo "ℹ️  $1"
}

# ============================================
# Validation Checks
# ============================================

CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0

check_passed() {
    ((CHECKS_PASSED+=1))
    log_pass "$1"
}

check_failed() {
    ((CHECKS_FAILED+=1))
    log_fail "$1"
}

check_warned() {
    ((CHECKS_WARNED+=1))
    log_warn "$1"
}

# ============================================
# Item 1: Health Assessment Components
# ============================================

validate_item_1() {
    log_header "Item 1: Health Assessment Components"
    
    log_check "Verify health-checks.sh exists and is executable"
    if [ -x "./scripts/smoke-tests/health-checks.sh" ]; then
        check_passed "health-checks.sh is executable"
    else
        check_failed "health-checks.sh missing or not executable"
    fi
    
    log_check "Verify health check endpoints exist"
    if curl -sf "$STAGING_URL/health" > /dev/null 2>&1; then
        check_passed "Node /health endpoint responds"
    else
        check_failed "Node /health endpoint not responding"
    fi
}

# ============================================
# Item 2: Node Gateway
# ============================================

validate_item_2() {
    log_header "Item 2: Node Gateway Restoration"
    
    log_check "Verify Node API availability"
    local response=$(curl -s -w "\n%{http_code}" "$STAGING_URL/health" 2>/dev/null || echo "000")
    local http_code=$(echo "$response" | tail -1)
    
    if [ "$http_code" = "200" ]; then
        check_passed "Node API responding with 200 OK"
    else
        check_failed "Node API returning $http_code"
    fi
    
    log_check "Verify no 503 errors in recent logs"
    log_info "Manual check: Azure App Service logs for Node API (automated check requires log access)"
    check_warned "Requires manual log review for 503 errors"
}

# ============================================
# Item 3: CORS/Auth Hardening
# ============================================

validate_item_3() {
    log_header "Item 3: CORS/Auth Hardening"
    
    log_check "Verify CORS headers configured"
    local cors_header=$(curl -s -i "$STAGING_URL/health" 2>/dev/null | grep -i "access-control-allow-origin" || echo "NOT_FOUND")
    
    if [ "$cors_header" != "NOT_FOUND" ] && [[ ! "$cors_header" =~ \* ]]; then
        check_passed "CORS configured without wildcard"
    elif [[ "$cors_header" =~ \* ]]; then
        check_failed "CORS still has wildcard - security issue"
    else
        check_warned "CORS headers not found (may be configured elsewhere)"
    fi
    
    log_check "Verify JWT auth middleware active"
    log_info "Manual check: Attempt request without auth token, should receive 401/403"
    check_warned "Requires manual auth test"
}

# ============================================
# Item 4: Contract Normalization
# ============================================

validate_item_4() {
    log_header "Item 4: Contract Normalization"
    
    log_check "Verify requestNormalizer.ts exists"
    if [ -f "apps/api/src/services/requestNormalizer.ts" ]; then
        local lines=$(wc -l < "apps/api/src/services/requestNormalizer.ts")
        check_passed "requestNormalizer.ts present ($lines lines)"
    else
        check_failed "requestNormalizer.ts missing"
    fi
    
    log_check "Verify responseDenormalizer.ts exists"
    if [ -f "apps/api/src/services/responseDenormalizer.ts" ]; then
        local lines=$(wc -l < "apps/api/src/services/responseDenormalizer.ts")
        check_passed "responseDenormalizer.ts present ($lines lines)"
    else
        check_failed "responseDenormalizer.ts missing"
    fi
    
    log_check "Verify integration in serviceProxy.ts"
    if grep -q "normalizeAnalysisRequestForPython\|normalizeDesignRequestForPython\|denormalizeAnalysisResponse\|denormalizeDesignResponse" "apps/api/src/services/serviceProxy.ts" 2>/dev/null; then
        check_passed "normalizer/denormalizer integrated in serviceProxy"
    else
        check_failed "normalizer/denormalizer not integrated"
    fi
}

# ============================================
# Item 5: Data Governance
# ============================================

validate_item_5() {
    log_header "Item 5: Data Governance & Ownership"
    
    log_check "Verify databaseOwnershipGuard.ts exists"
    if [ -f "apps/api/src/middleware/databaseOwnershipGuard.ts" ]; then
        check_passed "databaseOwnershipGuard.ts present"
    else
        check_failed "databaseOwnershipGuard.ts missing"
    fi
    
    log_check "Verify ownership matrix documented"
    if [ -f "ITEM5_MONGODB_OWNERSHIP_MATRIX.md" ]; then
        check_passed "ITEM5_MONGODB_OWNERSHIP_MATRIX.md present"
    else
        check_failed "ITEM5_MONGODB_OWNERSHIP_MATRIX.md missing"
    fi
    
    log_check "Verify middleware registered in app.ts"
    if grep -q "databaseOwnershipGuard" "apps/api/src/app.ts" 2>/dev/null; then
        check_passed "databaseOwnershipGuard registered in app.ts"
    else
        check_failed "databaseOwnershipGuard not registered"
    fi
}

# ============================================
# Item 6: Deployment Automation
# ============================================

validate_item_6() {
    log_header "Item 6: Deployment Automation Scripts"
    
    log_check "Verify health-checks.sh executable"
    if [ -x "./scripts/smoke-tests/health-checks.sh" ]; then
        check_passed "health-checks.sh is executable"
    else
        check_failed "health-checks.sh not executable"
    fi
    
    log_check "Verify parity-pack.sh executable"
    if [ -x "./scripts/smoke-tests/parity-pack.sh" ]; then
        check_passed "parity-pack.sh is executable"
    else
        check_failed "parity-pack.sh not executable"
    fi
    
    log_check "Verify validate-deploy-env.sh executable"
    if [ -x "./scripts/validate-deploy-env.sh" ]; then
        check_passed "validate-deploy-env.sh is executable"
    else
        check_failed "validate-deploy-env.sh not executable"
    fi
    
    log_check "Run deployment env validation"
    if bash ./scripts/validate-deploy-env.sh > /dev/null 2>&1; then
        check_passed "Deployment environment validation passed"
    else
        check_warned "Deployment environment validation failed in current shell (check required vars)"
    fi
}

# ============================================
# Item 7: Observability & Rate Limiting
# ============================================

validate_item_7() {
    log_header "Item 7: Observability & Rate Limiting"
    
    log_check "Verify tierRateLimit.ts exists"
    if [ -f "apps/api/src/middleware/tierRateLimit.ts" ]; then
        check_passed "tierRateLimit.ts present"
    else
        check_failed "tierRateLimit.ts missing"
    fi
    
    log_check "Verify request_logger.py exists"
    if [ -f "apps/backend-python/middleware/request_logger.py" ]; then
        check_passed "request_logger.py present"
    else
        check_failed "request_logger.py missing"
    fi
    
    log_check "Verify prometheus-rules.yml exists"
    if [ -f "scripts/alerting/prometheus-rules.yml" ]; then
        local lines=$(wc -l < "scripts/alerting/prometheus-rules.yml")
        check_passed "prometheus-rules.yml present ($lines lines)"
    else
        check_failed "prometheus-rules.yml missing"
    fi
    
    log_check "Request ID propagation"
    local headers=$(curl -s -i "$STAGING_URL/health" 2>/dev/null | grep -i "x-request-id" || echo "NOT_FOUND")
    if [ "$headers" != "NOT_FOUND" ]; then
        check_passed "Request ID header present"
    else
        check_warned "Request ID not in response headers (may be in logs)"
    fi
}

# ============================================
# Item 8: Documentation
# ============================================

validate_item_8() {
    log_header "Item 8: Documentation & ADRs"
    
    log_check "Verify ADR-001 exists"
    if [ -f "docs/adr/ADR-001-mongodb-ownership.md" ]; then
        check_passed "ADR-001-mongodb-ownership.md present"
    else
        check_failed "ADR-001 missing"
    fi
    
    log_check "Verify ADR-002 exists"
    if [ -f "docs/adr/ADR-002-rate-limiting.md" ]; then
        check_passed "ADR-002-rate-limiting.md present"
    else
        check_failed "ADR-002 missing"
    fi
    
    log_check "Verify ADR-003 exists"
    if [ -f "docs/adr/ADR-003-contract-normalization.md" ]; then
        check_passed "ADR-003-contract-normalization.md present"
    else
        check_failed "ADR-003 missing"
    fi
    
    log_check "Verify ARCHITECTURE.md exists"
    if [ -f "docs/ARCHITECTURE.md" ]; then
        check_passed "ARCHITECTURE.md present"
    else
        check_failed "ARCHITECTURE.md missing"
    fi
}

# ============================================
# Item 9: Test Framework
# ============================================

validate_item_9() {
    log_header "Item 9: Integration Test Framework"
    
    log_check "Verify test-execution.sh executable"
    if [ -x "./scripts/test-execution.sh" ]; then
        check_passed "test-execution.sh is executable"
    else
        check_failed "test-execution.sh not executable"
    fi
    
    log_check "Verify ITEM9_FINAL_INTEGRATION_TEST_PLAN.md exists"
    if [ -f "ITEM9_FINAL_INTEGRATION_TEST_PLAN.md" ]; then
        check_passed "ITEM9_FINAL_INTEGRATION_TEST_PLAN.md present"
    else
        check_failed "ITEM9_FINAL_INTEGRATION_TEST_PLAN.md missing"
    fi
    
    log_check "Verify ITEM9_EXECUTION_QUICK_START.md exists"
    if [ -f "ITEM9_EXECUTION_QUICK_START.md" ]; then
        check_passed "ITEM9_EXECUTION_QUICK_START.md present"
    else
        check_failed "ITEM9_EXECUTION_QUICK_START.md missing"
    fi
}

# ============================================
# Infrastructure Checks
# ============================================

validate_infrastructure() {
    log_header "Infrastructure Readiness"
    
    log_check "Verify MongoDB connectivity (staging)"
    log_info "Manual check: Verify MongoDB Atlas staging cluster status"
    check_warned "Requires MongoDB Atlas portal access"
    
    log_check "Verify Redis availability (if using)"
    log_info "Manual check: Verify Redis is running for rate limiting"
    check_warned "Requires Redis system check"
    
    log_check "Verify Azure services health"
    log_info "Manual check: Verify all Azure App Services are running"
    check_warned "Requires Azure Portal access"
    
    log_check "Verify GitHub Actions workflows enabled"
    if [ -d ".github/workflows" ]; then
        check_passed ".github/workflows directory present"
    else
        check_failed ".github/workflows directory missing"
    fi
}

# ============================================
# Team Readiness Checks
# ============================================

validate_team_readiness() {
    log_header "Team Readiness Checklist"
    
    echo -e "\n${YELLOW}Verify the following team preparations:${NC}\n"
    
    local checks=(
        "QA team assigned for Phase 2 (smoke tests) - on call Apr 3 10am-1pm"
        "Backend team assigned for Phase 3-4 (contract/ownership) - on call Apr 3 11:30am-1pm"
        "DevOps team assigned for Phase 5-6 (rate limit/observability) - on call Apr 3 12:30pm-2pm"
        "Tech lead assigned for Phase 7 (docs) - review at 2pm"
        "QA team assigned for Phase 8 (E2E) - on call Apr 3 2:30pm-5pm"
        "Performance team assigned for load testing - on call Apr 3 4:30pm-5:30pm"
        "CTO/Tech lead on call for sign-off review - 5:30pm-7pm"
        "On-call rotation notified for Apr 3 evening"
        "Slack channel #beamlab-delivery created for updates"
        "Rollback procedures reviewed and approved"
    )
    
    for check in "${checks[@]}"; do
        echo -e "  [ ] $check"
    done
}

# ============================================
# Database Backup Verification
# ============================================

validate_backups() {
    log_header "Backup & Rollback Readiness"
    
    log_check "MongoDB backup created today"
    log_info "Manual check: Verify MongoDB Atlas backup in staging"
    check_warned "Requires MongoDB Atlas access"
    
    log_check "Rollback script accessible"
    if [ -f "DEPLOYMENT_CHECKLIST.md" ]; then
        check_passed "DEPLOYMENT_CHECKLIST.md present (contains rollback)"
    else
        check_failed "DEPLOYMENT_CHECKLIST.md missing"
    fi
    
    log_check "Previous version deployment verified"
    log_info "Manual check: Confirm previous version can be redeployed"
    check_warned "Requires deployment system check"
}

# ============================================
# Summary Report
# ============================================

print_summary() {
    local total=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNED))
    
    log_header "VALIDATION SUMMARY"
    
    echo -e "${GREEN}✅ Passed: $CHECKS_PASSED${NC}"
    echo -e "${RED}❌ Failed: $CHECKS_FAILED${NC}"
    echo -e "${YELLOW}⚠️  Warned: $CHECKS_WARNED${NC}"
    echo -e "\nTotal Checks: $total\n"
    
    if [ "$CHECKS_FAILED" -eq 0 ]; then
        echo -e "${GREEN}✅ ALL CRITICAL CHECKS PASSED - READY FOR APR 3 TEST${NC}\n"
        return 0
    else
        echo -e "${RED}❌ CRITICAL CHECKS FAILED - FIX BEFORE APR 3${NC}\n"
        echo -e "${YELLOW}Failed checks above must be resolved.${NC}\n"
        return 1
    fi
}

# ============================================
# Main Execution
# ============================================

main() {
    log_header "PRE-TEST VALIDATION KIT (Apr 2 Evening)"
    log_info "Staging URL: $STAGING_URL"
    log_info "Report: $VALIDATION_REPORT"
    log_info "Start: $(date)"
    
    # Run all validations
    validate_item_1
    validate_item_2
    validate_item_3
    validate_item_4
    validate_item_5
    validate_item_6
    validate_item_7
    validate_item_8
    validate_item_9
    validate_infrastructure
    validate_backups
    
    # Print summary
    print_summary
    local exit_code=$?
    
    # Team checklist
    validate_team_readiness
    
    log_header "NEXT STEPS"
    echo -e "${YELLOW}Apr 3, 2026:${NC}"
    echo "  9:00 AM  - Team arrives, final checks"
    echo "  9:30 AM  - Start Phase 1 (environment setup)"
    echo "           Run: ./scripts/test-execution.sh $STAGING_URL"
    echo ""
    echo -e "${YELLOW}If any checks failed above:${NC}"
    echo "  1. Fix issues immediately"
    echo "  2. Re-run: bash scripts/pre-test-validation.sh $STAGING_URL"
    echo "  3. Verify all checks pass before Apr 3"
    echo ""
    
    return $exit_code
}

# Run main
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
