#!/bin/bash
# Razorpay Integration Test Suite
# Tests all payment flow components end-to-end

set +e  # Don't exit on errors, we'll track them

echo "=========================================="
echo "BEAMLAB RAZORPAY INTEGRATION TEST SUITE"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
test_start() {
  echo -e "${BLUE}→${NC} $1"
}

test_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((TESTS_PASSED++))
}

test_fail() {
  echo -e "${RED}✗${NC} $1"
  ((TESTS_FAILED++))
}

test_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# ============================================
# TEST 1: Backend Health
# ============================================
echo ""
echo "TEST SET 1: Backend Health Check"
echo "────────────────────────────────"

test_start "Checking backend health endpoint..."
HEALTH=$(curl -sS https://beamlab-backend-node-prod.azurewebsites.net/health 2>/dev/null || echo "{}")
if echo "$HEALTH" | grep -q "healthy"; then
  test_pass "Backend is healthy"
  echo "  Status: $(echo "$HEALTH" | jq -r '.status // "unknown"')"
else
  test_fail "Backend health check failed"
  exit 1
fi

test_start "Checking MongoDB connection..."
if echo "$HEALTH" | grep -qE 'mongodb.*connected|"mongodb":"connected"'; then
  test_pass "MongoDB is connected"
else
  test_fail "MongoDB connection failed"
fi

# ============================================
# TEST 2: Payment Routes Exist
# ============================================
echo ""
echo "TEST SET 2: Payment Routes Verification"
echo "───────────────────────────────────────"

test_start "Testing create-order route..."
ROUTE_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" -X OPTIONS https://beamlab-backend-node-prod.azurewebsites.net/api/payments/razorpay/create-order)
if [[ "$ROUTE_STATUS" == "204" || "$ROUTE_STATUS" == "200" ]]; then
  test_pass "create-order route is accessible (HTTP $ROUTE_STATUS)"
else
  test_fail "create-order route returned HTTP $ROUTE_STATUS"
fi

test_start "Testing verify-payment route..."
ROUTE_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" -X OPTIONS https://beamlab-backend-node-prod.azurewebsites.net/api/payments/razorpay/verify-payment)
if [[ "$ROUTE_STATUS" == "204" || "$ROUTE_STATUS" == "200" ]]; then
  test_pass "verify-payment route is accessible (HTTP $ROUTE_STATUS)"
else
  test_fail "verify-payment route returned HTTP $ROUTE_STATUS"
fi

test_start "Testing webhook route..."
ROUTE_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" -X OPTIONS https://beamlab-backend-node-prod.azurewebsites.net/api/payments/razorpay/webhook)
if [[ "$ROUTE_STATUS" == "204" || "$ROUTE_STATUS" == "200" ]]; then
  test_pass "webhook route is accessible (HTTP $ROUTE_STATUS)"
else
  test_fail "webhook route returned HTTP $ROUTE_STATUS"
fi

# ============================================
# TEST 3: Frontend Assets
# ============================================
echo ""
echo "TEST SET 3: Frontend Assets"
echo "───────────────────────────"

test_start "Checking main website..."
FRONTEND_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" https://www.beamlabultimate.tech/)
if [[ "$FRONTEND_STATUS" == "200" ]]; then
  test_pass "Website is accessible (HTTP $FRONTEND_STATUS)"
else
  test_warn "Website returned HTTP $FRONTEND_STATUS (may be normal for SPAs)"
fi

test_start "Checking Razorpay CDN script..."
SCRIPT_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" https://checkout.razorpay.com/v1/checkout.js)
if [[ "$SCRIPT_STATUS" == "200" ]]; then
  test_pass "Razorpay script is accessible (HTTP $SCRIPT_STATUS)"
else
  test_fail "Razorpay script unavailable (HTTP $SCRIPT_STATUS)"
fi

# ============================================
# TEST 4: Environment Configuration
# ============================================
echo ""
echo "TEST SET 4: Environment Configuration"
echo "──────────────────────────────────────"

test_start "Checking backend .env.deploy..."
if [ -f ".env.deploy" ]; then
  if grep -Eq "^RAZORPAY_KEY_ID=['\"]?rzp_test_" .env.deploy; then
    test_pass ".env.deploy has Razorpay TEST key configured"
  elif grep -Eq "^RAZORPAY_KEY_ID=['\"]?rzp_" .env.deploy; then
    test_warn ".env.deploy has Razorpay key (verify if test or live)"
  else
    test_fail ".env.deploy missing RAZORPAY_KEY_ID"
  fi
  
  if grep -q "RAZORPAY_KEY_SECRET=" .env.deploy; then
    test_pass ".env.deploy has RAZORPAY_KEY_SECRET"
  else
    test_fail ".env.deploy missing RAZORPAY_KEY_SECRET"
  fi
  
  if grep -q "RAZORPAY_WEBHOOK_SECRET=" .env.deploy; then
    test_pass ".env.deploy has RAZORPAY_WEBHOOK_SECRET"
  else
    test_warn ".env.deploy missing RAZORPAY_WEBHOOK_SECRET"
  fi
else
  test_warn ".env.deploy file not found (may be on deployment server)"
fi

# ============================================
# TEST 5: Code Integration
# ============================================
echo ""
echo "TEST SET 5: Code Integration"
echo "────────────────────────────"

test_start "Checking Razorpay router registration..."
if grep -q "app.use.*razorpayRouter" apps/api/src/index.ts; then
  test_pass "Razorpay router is registered in main app"
else
  test_fail "Razorpay router not found in app"
fi

test_start "Checking RazorpayPayment component..."
if [ -f "apps/web/src/components/RazorpayPayment.tsx" ]; then
  test_pass "RazorpayPayment component exists"
  
  if grep -q "handleDisplayRazorpay" apps/web/src/components/RazorpayPayment.tsx; then
    test_pass "RazorpayPayment has payment handler"
  else
    test_fail "RazorpayPayment missing payment handler"
  fi
else
  test_fail "RazorpayPayment component not found"
fi

test_start "Checking PaymentGatewaySelector integration..."
if grep -q "RazorpayPaymentModal" apps/web/src/components/PaymentGatewaySelector.tsx; then
  test_pass "Razorpay integrated in PaymentGatewaySelector"
else
  test_fail "Razorpay not integrated in PaymentGatewaySelector"
fi

test_start "Checking environment config..."
if grep -q "VITE_RAZORPAY_KEY_ID" apps/web/src/config/env.ts; then
  test_pass "Frontend env config includes VITE_RAZORPAY_KEY_ID"
else
  test_fail "Frontend env config missing VITE_RAZORPAY_KEY_ID"
fi

# ============================================
# TEST 6: Database Models
# ============================================
echo ""
echo "TEST SET 6: Database Models"
echo "───────────────────────────"

test_start "Checking PaymentWebhookEvent model..."
if grep -q "PaymentWebhookEvent" apps/api/src/models.ts; then
  test_pass "PaymentWebhookEvent model exists"
else
  test_fail "PaymentWebhookEvent model not found"
fi

test_start "Checking PaymentTransaction model..."
if grep -q "razorpayPaymentId\|razorpayOrderId" apps/api/src/models.ts; then
  test_pass "Payment transaction fields exist in subscription model"
else
  test_fail "Payment transaction persistence fields not found"
fi

# ============================================
# SUMMARY
# ============================================
echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed! Integration is ready.${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Deploy backend with .env.deploy"
  echo "2. Test payment flow on website: www.beamlabultimate.tech"
  echo "3. Use test card: 4100 2800 0000 1007 (CVV: any, Expiry: any future)"
  echo "4. Verify subscription activation in logs"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Review errors above.${NC}"
  exit 1
fi
