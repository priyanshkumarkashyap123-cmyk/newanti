#!/bin/bash
# ============================================
# BeamLab Comprehensive Integration Audit
# ============================================
# Orchestrates production readiness + integration tests
# Combines security checks, health probes, and route verification
# Usage: ./run-integration-audit.sh [environment]

set -e

ENVIRONMENT="${1:-staging}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔍 BeamLab Comprehensive Integration Audit"
echo "=========================================="
echo ""
echo "Environment: $ENVIRONMENT"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

RESULTS_DIR="/tmp/beamlab-audit-$ENVIRONMENT-$(date +%s)"
mkdir -p "$RESULTS_DIR"

# ============================================
# 1. PRODUCTION READINESS CHECKS
# ============================================

echo "📋 Phase 1: Production Readiness Checks"
echo "========================================="
echo ""

READINESS_SCRIPT="$ROOT_DIR/scripts/production-readiness-audit.sh"
if [ -f "$READINESS_SCRIPT" ]; then
    bash "$READINESS_SCRIPT" "$ENVIRONMENT" | tee "$RESULTS_DIR/readiness.log"
    READINESS_STATUS=${PIPESTATUS[0]}
    echo ""
else
    echo "⚠️  Production readiness script not found: $READINESS_SCRIPT"
    READINESS_STATUS=1
fi

# ============================================
# 2. INTEGRATION TESTS (Gateway-First)
# ============================================

echo ""
echo "🔗 Phase 2: Integration Tests (Gateway-First)"
echo "=============================================="
echo ""

INTEGRATION_SCRIPT="$SCRIPT_DIR/test-production-integration.sh"
if [ -f "$INTEGRATION_SCRIPT" ]; then
    # Try to use JWT token if available in environment
    if [ -n "$BEAMLAB_TEST_TOKEN" ]; then
        bash "$INTEGRATION_SCRIPT" "$ENVIRONMENT" "$BEAMLAB_TEST_TOKEN" | tee "$RESULTS_DIR/integration.log"
    else
        bash "$INTEGRATION_SCRIPT" "$ENVIRONMENT" | tee "$RESULTS_DIR/integration.log"
    fi
    INTEGRATION_STATUS=${PIPESTATUS[0]}
    echo ""
else
    echo "❌ Integration test script not found: $INTEGRATION_SCRIPT"
    INTEGRATION_STATUS=1
fi

# ============================================
# 3. SERVICE DEPENDENCY CHECKS
# ============================================

echo ""
echo "🔄 Phase 3: Service Dependency Checks"
echo "======================================"
echo ""

if [ "$ENVIRONMENT" == "production" ]; then
    GATEWAY_URL="https://beamlab-backend-node.azurewebsites.net"
    RUST_URL="https://beamlab-rust-api.azurewebsites.net"
    PYTHON_URL="https://beamlab-backend-python.azurewebsites.net"
else
    GATEWAY_URL="http://localhost:3001"
    RUST_URL="http://localhost:3002"
    PYTHON_URL="http://localhost:8000"
fi

echo -n "Checking Gateway health... "
if curl -s -f "$GATEWAY_URL/health" > /dev/null 2>&1; then
    echo "✅"
    GATEWAY_HEALTH=0
else
    echo "❌"
    GATEWAY_HEALTH=1
fi

echo -n "Checking Rust API health... "
if curl -s -f "$RUST_URL/health" > /dev/null 2>&1; then
    echo "✅"
    RUST_HEALTH=0
else
    echo "❌"
    RUST_HEALTH=1
fi

echo -n "Checking Python API health... "
if curl -s -f "$PYTHON_URL/health" > /dev/null 2>&1; then
    echo "✅"
    PYTHON_HEALTH=0
else
    echo "❌"
    PYTHON_HEALTH=1
fi

DEPENDENCY_STATUS=$((GATEWAY_HEALTH + RUST_HEALTH + PYTHON_HEALTH))
echo ""

# ============================================
# SUMMARY REPORT
# ============================================

echo ""
echo "📊 Audit Summary"
echo "================"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Results Directory: $RESULTS_DIR"
echo ""

STATUS_STR=""
READINESS_FAILURE=0
if [ $READINESS_STATUS -eq 0 ]; then
    echo "✅ Production Readiness: PASSED"
elif [ $READINESS_STATUS -eq 1 ]; then
    echo "⚠️  Production Readiness: PASSED WITH WARNINGS"
else
    echo "⚠️  Production Readiness: FAILED (exit code: $READINESS_STATUS)"
    STATUS_STR="$STATUS_STR READINESS_FAILED"
    READINESS_FAILURE=1
fi

if [ $INTEGRATION_STATUS -eq 0 ]; then
    echo "✅ Integration Tests: PASSED"
else
    echo "⚠️  Integration Tests: FAILED (exit code: $INTEGRATION_STATUS)"
    STATUS_STR="$STATUS_STR INTEGRATION_FAILED"
fi

if [ $DEPENDENCY_STATUS -eq 0 ]; then
    echo "✅ Service Dependencies: HEALTHY"
else
    echo "⚠️  Service Dependencies: SOME_UNHEALTHY"
    STATUS_STR="$STATUS_STR DEPENDENCY_ISSUES"
fi

echo ""
echo "Detailed logs saved to: $RESULTS_DIR"
echo ""

TOTAL_STATUS=$((READINESS_FAILURE + INTEGRATION_STATUS + DEPENDENCY_STATUS))

if [ $TOTAL_STATUS -eq 0 ]; then
    echo "🎉 All audits passed! System ready for deployment."
    exit 0
else
    echo "⚠️  Some audits failed. Please review logs:$STATUS_STR"
    echo ""
    echo "Review individual phase logs:"
    [ -f "$RESULTS_DIR/readiness.log" ] && echo "  - Readiness: tail -f $RESULTS_DIR/readiness.log"
    [ -f "$RESULTS_DIR/integration.log" ] && echo "  - Integration: tail -f $RESULTS_DIR/integration.log"
    exit 1
fi
