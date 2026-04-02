#!/bin/bash

# ITEM 6: Post-deploy health verification
# Runs immediately after deployment to verify all services are responsive
# Usage: ./scripts/smoke-tests/health-checks.sh

set -e

TIMEOUT=30
RETRIES=3
FAILED_SERVICES=0

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_health() {
  local service=$1
  local url=$2
  local max_attempts=$3
  
  printf "%-20s" "Checking $service..."
  
  for attempt in $(seq 1 "$max_attempts"); do
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
      --max-time "$TIMEOUT" \
      "$url" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
      printf "${GREEN}✅ HEALTHY${NC}\n"
      return 0
    fi
    
    if [ "$attempt" -lt "$max_attempts" ]; then
      printf "."
      sleep $((attempt * 2))
    fi
  done
  
  printf "${RED}❌ FAILED (HTTP $http_code after $max_attempts attempts)${NC}\n"
  FAILED_SERVICES=$((FAILED_SERVICES + 1))
  return 1
}

echo "📊 BeamLab Post-Deploy Health Check — $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Node API
check_health "Node API" \
  "https://beamlab-backend-node-prod.azurewebsites.net/health" \
  "$RETRIES"

# Python API
check_health "Python API" \
  "https://beamlab-backend-python-prod.azurewebsites.net/health" \
  "$RETRIES"

# Rust API
check_health "Rust API" \
  "https://beamlab-rust-api-prod.azurewebsites.net/health" \
  "$RETRIES"

# Frontend
check_health "Frontend" \
  "https://beamlabultimate.tech/" \
  "$RETRIES"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAILED_SERVICES -eq 0 ]; then
  echo -e "${GREEN}✅ All services healthy${NC}"
  exit 0
else
  echo -e "${RED}❌ $FAILED_SERVICES service(s) failed health check${NC}"
  exit 1
fi
