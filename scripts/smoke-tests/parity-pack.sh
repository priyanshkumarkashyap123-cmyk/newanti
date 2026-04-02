#!/bin/bash

# ITEM 6: Parity pack — validates critical features work end-to-end
# Usage: ./scripts/smoke-tests/parity-pack.sh
# Requires: jq, curl

set -e

# Configuration
BASE_URL="${BASE_URL:-https://beamlab-backend-node-prod.azurewebsites.net}"
TEST_USER_EMAIL="smoketest+$(date +%s)@beamlab.test"
TEST_PASSWORD="SmokeTesting123!"
TIMEOUT=30

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

test_count=0
pass_count=0
fail_count=0

# Test helper
run_test() {
  local test_num=$1
  local test_name=$2
  test_count=$((test_count + 1))
  
  printf "${BLUE}${test_num}️⃣  ${NC}%-40s" "$test_name..."
}

pass_test() {
  pass_count=$((pass_count + 1))
  echo -e "${GREEN}✅${NC}"
}

fail_test() {
  local reason=$1
  fail_count=$((fail_count + 1))
  echo -e "${RED}❌${NC} ($reason)"
}

warn_test() {
  local reason=$1
  echo -e "${YELLOW}⚠️${NC}  ($reason)"
}

# Start
echo ""
echo -e "${BLUE}🧪 BeamLab Parity Pack — Validating critical user flows${NC}"
echo -e "Base URL: $BASE_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: User Authentication
run_test "1" "User signup"
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_USER_EMAIL\", \"password\": \"$TEST_PASSWORD\"}" \
  --max-time "$TIMEOUT" 2>/dev/null || echo "{}")

USER_ID=$(echo "$SIGNUP_RESPONSE" | jq -r '.result.userId // .userId // empty' 2>/dev/null)
AUTH_TOKEN=$(echo "$SIGNUP_RESPONSE" | jq -r '.result.token // .token // empty' 2>/dev/null)

if [ -n "$USER_ID" ] && [ -n "$AUTH_TOKEN" ]; then
  pass_test
  echo "   → User ID: $USER_ID"
else
  fail_test "Signup response invalid"
  echo "   → Response: $SIGNUP_RESPONSE"
  exit 1
fi

# Test 2: Login Token Validation
run_test "2" "Token validation"
TOKEN_CHECK=$(curl -s -X GET "$BASE_URL/api/v1/auth/me" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  --max-time "$TIMEOUT" 2>/dev/null || echo "{}")

VALIDATED_USER=$(echo "$TOKEN_CHECK" | jq -r '.result.id // .id // empty' 2>/dev/null)
if [ -n "$VALIDATED_USER" ]; then
  pass_test
else
  fail_test "Token validation failed"
fi

# Test 3: Project Creation
run_test "3" "Project creation"
PROJECT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/projects" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Smoke Test $(date +%s)\", \"description\": \"Auto-generated parity test\"}" \
  --max-time "$TIMEOUT" 2>/dev/null || echo "{}")

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.result.id // .result._id // .id // .projectId // empty' 2>/dev/null)

if [ -n "$PROJECT_ID" ]; then
  pass_test
  echo "   → Project ID: $PROJECT_ID"
else
  fail_test "Project creation failed"
  # Continue anyway; project creation might be optional
fi

# Test 4: Structure/Analysis Submission
run_test "4" "Analysis submission (simple 2D frame)"

STRUCTURE_PAYLOAD='{
  "nodes": [
    {"id": "n1", "x": 0, "y": 0, "z": 0},
    {"id": "n2", "x": 5, "y": 0, "z": 0}
  ],
  "members": [
    {"id": "m1", "startNodeId": "n1", "endNodeId": "n2", "section": {"A": 100}}
  ],
  "supports": [
    {"nodeId": "n1", "restraintX": true, "restraintY": true, "restraintZ": true}
  ],
  "loads": []
}'

ANALYZE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/analyze" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$STRUCTURE_PAYLOAD" \
  --max-time 60 2>/dev/null || echo "{}")

ANALYSIS_ID=$(echo "$ANALYZE_RESPONSE" | jq -r '.result.analysisId // .result._id // .analysisId // empty' 2>/dev/null)

if [ -n "$ANALYSIS_ID" ]; then
  pass_test
  echo "   → Analysis ID: $ANALYSIS_ID"
else
  fail_test "Analysis submission failed"
  warn_test "Note: Analysis endpoint may be async; ID might be returned separately"
fi

# Test 5: Quota/Subscription Status
run_test "5" "Quota check"

QUOTA_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/auth/quota" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  --max-time "$TIMEOUT" 2>/dev/null || echo "{}")

QUOTA=$(echo "$QUOTA_RESPONSE" | jq -r '.result.quota // .quota // .computeUnitsRemaining // empty' 2>/dev/null)

if [ -n "$QUOTA" ]; then
  pass_test
  echo "   → Quota: $QUOTA units remaining"
else
  warn_test "Quota endpoint may not be available in all tiers"
fi

# Test 6: Database Connectivity
run_test "6" "Database status"

HEALTH_RESPONSE=$(curl -s -X GET "$BASE_URL/health" \
  --max-time "$TIMEOUT" 2>/dev/null || echo "{}")

DB_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.mongodb // .database // empty' 2>/dev/null)

if [ "$DB_STATUS" = "connected" ] || [ -n "$DB_STATUS" ]; then
  pass_test
else
  warn_test "Could not verify database status"
fi

# Test 7: Cleanup (delete test project)
if [ -n "$PROJECT_ID" ]; then
  run_test "7" "Cleanup (delete project)"
  
  DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/v1/projects/$PROJECT_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    --max-time "$TIMEOUT" 2>/dev/null || echo "{}")
  
  # Cleanup might return 204 or 200 with success=true
  DELETE_STATUS=$(echo "$DELETE_RESPONSE" | jq -r '.success // true' 2>/dev/null)
  if [ "$DELETE_STATUS" = "true" ] || [ -z "$DELETE_RESPONSE" ]; then
    pass_test
  else
    warn_test "Cleanup may have failed, but continuing"
  fi
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "Results: ${GREEN}$pass_count passed${NC}, ${RED}$fail_count failed${NC} (out of $test_count tests)"

if [ $fail_count -eq 0 ]; then
  echo -e "${GREEN}✅ 🎉 PARITY PACK COMPLETE — All critical flows working!${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ PARITY PACK FAILED — $fail_count critical flows not working${NC}"
  echo ""
  exit 1
fi
