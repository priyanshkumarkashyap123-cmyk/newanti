#!/bin/bash
# ============================================
# BeamLab Production Integration Tests
# ============================================
# Tests all API endpoints and verifies integration
# Usage: ./test-production-integration.sh [environment]

set -e

ENVIRONMENT="${1:-production}"

if [ "$ENVIRONMENT" == "production" ]; then
    RUST_API_URL="https://beamlab-rust-api.azurewebsites.net"
    NODE_API_URL="https://beamlab-api.azurewebsites.net"
    PYTHON_API_URL="https://beamlab-backend-python.azurewebsites.net"
    FRONTEND_URL="https://beamlabultimate.tech"
else
    RUST_API_URL="http://localhost:3002"
    NODE_API_URL="http://localhost:3001"
    PYTHON_API_URL="http://localhost:8081"
    FRONTEND_URL="http://localhost:5173"
fi

echo "🧪 BeamLab Production Integration Tests"
echo "======================================"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Rust API: $RUST_API_URL"
echo "Node API: $NODE_API_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

PASSED=0
FAILED=0

# Helper function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local expected_code="$5"

    echo -n "Testing $name... "
    
    if [ -z "$data" ]; then
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url")
    else
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$url")
    fi
    
    if [ "$STATUS" == "$expected_code" ]; then
        echo "✅ ($STATUS)"
        ((PASSED++))
    else
        echo "❌ (Expected $expected_code, got $STATUS)"
        ((FAILED++))
    fi
}

# ============================================
# HEALTH CHECKS
# ============================================

echo "Health Checks"
echo "============="
test_endpoint "Rust API health" "GET" "$RUST_API_URL/health" "" "200"
test_endpoint "Frontend" "GET" "$FRONTEND_URL" "" "200"
echo ""

# ============================================
# RUST API ENDPOINTS
# ============================================

echo "Rust API Endpoints"
echo "=================="

# Simple 2-node structure for testing
SIMPLE_MODEL='{
  "nodes": [
    {"id": 1, "x": 0, "y": 0, "z": 0},
    {"id": 2, "x": 0, "y": 3000, "z": 0}
  ],
  "members": [
    {"id": 1, "start_node": 1, "end_node": 2, "e": 210000, "a": 1000, "ix": 1000000, "iy": 1000000, "j": 100000}
  ],
  "supports": [
    {"node": 1, "dx": true, "dy": true, "dz": true, "rx": true, "ry": true, "rz": true}
  ],
  "loads": [
    {"type": "nodal", "node": 2, "fx": 10000, "fy": 0, "fz": 0}
  ]
}'

# Test analysis
echo "Testing Analysis Endpoints"
test_endpoint "Linear analysis" "POST" "$RUST_API_URL/api/analyze" "$SIMPLE_MODEL" "200"

# Test structures CRUD
echo ""
echo "Testing Structure CRUD"
test_endpoint "List structures" "GET" "$RUST_API_URL/api/structures" "" "200"
test_endpoint "Create structure" "POST" "$RUST_API_URL/api/structures" '{"name": "Test", "description": "Test structure"}' "200"

# Test sections
echo ""
echo "Testing Sections Database"
test_endpoint "List sections" "GET" "$RUST_API_URL/api/sections" "" "200"
test_endpoint "Get section" "GET" "$RUST_API_URL/api/sections/ISMB300" "" "200"

# Test metrics
echo ""
echo "Testing Metrics"
test_endpoint "Get metrics" "GET" "$RUST_API_URL/api/metrics" "" "200"

echo ""

# ============================================
# ADVANCED ANALYSIS ENDPOINTS
# ============================================

echo "Advanced Analysis Endpoints"
echo "==========================="

PDELTA_MODEL='{
  "nodes": [
    {"id": 1, "x": 0, "y": 0, "z": 0},
    {"id": 2, "x": 0, "y": 3000, "z": 0}
  ],
  "members": [
    {"id": 1, "start_node": 1, "end_node": 2, "e": 210000, "a": 1000, "ix": 1000000, "iy": 1000000, "j": 100000}
  ],
  "supports": [
    {"node": 1, "dx": true, "dy": true, "dz": true, "rx": true, "ry": true, "rz": true}
  ],
  "loads": [
    {"type": "nodal", "node": 2, "fx": 5000, "fy": 0, "fz": 0}
  ],
  "options": {"max_iterations": 10, "tolerance": 0.001}
}'

test_endpoint "P-Delta analysis" "POST" "$RUST_API_URL/api/advanced/pdelta" "$PDELTA_MODEL" "200"

MODAL_MODEL='{
  "nodes": [
    {"id": 1, "x": 0, "y": 0, "z": 0},
    {"id": 2, "x": 0, "y": 3000, "z": 0}
  ],
  "members": [
    {"id": 1, "start_node": 1, "end_node": 2, "e": 210000, "a": 1000, "ix": 1000000, "iy": 1000000, "j": 100000}
  ],
  "supports": [
    {"node": 1, "dx": true, "dy": true, "dz": true, "rx": true, "ry": true, "rz": true}
  ],
  "num_modes": 5
}'

test_endpoint "Modal analysis" "POST" "$RUST_API_URL/api/advanced/modal" "$MODAL_MODEL" "200"

echo ""

# ============================================
# DESIGN CHECK ENDPOINTS
# ============================================

echo "Design Check Endpoints"
echo "====================="

IS456_MODEL='{
  "b": 300,
  "d": 450,
  "d_prime": 50,
  "fck": 25,
  "fy": 415,
  "mu": 150,
  "vu": 80
}'

test_endpoint "IS 456 design" "POST" "$RUST_API_URL/api/design/is456" "$IS456_MODEL" "200"

AISC_MODEL='{
  "section_id": "W14x30",
  "length": 4000,
  "k": 1.0,
  "fy": 345,
  "e": 200000,
  "pu": 500,
  "mu_x": 100,
  "mu_y": 20,
  "vu": 50
}'

test_endpoint "AISC design" "POST" "$RUST_API_URL/api/design/aisc" "$AISC_MODEL" "200"

echo ""

# ============================================
# PERFORMANCE TESTS
# ============================================

echo "Performance Tests"
echo "================"

echo -n "Measuring Rust API response time... "
START_TIME=$(date +%s%N)
curl -s -X POST "$RUST_API_URL/api/analyze" \
    -H "Content-Type: application/json" \
    -d "$SIMPLE_MODEL" > /dev/null
END_TIME=$(date +%s%N)
DURATION=$(( (END_TIME - START_TIME) / 1000000 ))
echo "✅ ${DURATION}ms"

echo ""

# ============================================
# SUMMARY
# ============================================

TOTAL=$((PASSED + FAILED))

echo "Test Results"
echo "============"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Total: $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ Some tests failed!"
    exit 1
fi
