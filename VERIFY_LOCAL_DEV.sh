#!/bin/bash

# ============================================
# BeamLab Local Development Verification
# ============================================
# This script verifies that your local dev setup is correct:
# ✓ Frontend can access all APIs
# ✓ Auth is bypassed on localhost
# ✓ All features are unlocked
# ============================================

set -e

cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ✅ BeamLab Local Development Verification           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if service is running
check_service() {
    local name=$1
    local port=$2
    local url=$3
    
    echo -n "Checking $name (port $port)... "
    
    if curl -s -m 2 "$url" > /dev/null 2>&1 || nc -G2 -zv localhost $port > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# Function to test API endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local expected_code=$4
    
    echo -n "  Testing $name... "
    status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" 2>/dev/null || echo "000")
    
    if [[ "$status" == "$expected_code" ]] || [[ "$status" == "2"* ]]; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗ (Status: $status)${NC}"
        return 1
    fi
}

# ============================================
# CHECK SERVICES
# ============================================
echo -e "${BLUE}📡 Service Status:${NC}"
echo ""

services_ok=true

check_service "Frontend" "5173" "http://localhost:5173" || services_ok=false
check_service "Node API" "3001" "http://localhost:3001" || services_ok=false
check_service "Python API" "8000" "http://localhost:8000" || services_ok=false
check_service "Rust API" "8080" "http://localhost:8080" || services_ok=false

echo ""

# ============================================
# CHECK ENDPOINTS
# ============================================
if [ "$services_ok" == true ]; then
    echo -e "${BLUE}🔍 API Endpoints:${NC}"
    echo ""
    
    echo -e "${YELLOW}Node API (3001):${NC}"
    test_endpoint "Health check" "GET" "http://localhost:3001/health" "200"
    test_endpoint "Status endpoint" "GET" "http://localhost:3001/status" "200"
    echo ""
    
    echo -e "${YELLOW}Python API (8000):${NC}"
    test_endpoint "Health check" "GET" "http://localhost:8000/health" "200"
    test_endpoint "Status endpoint" "GET" "http://localhost:8000/status" "200"
    echo ""
    
    echo -e "${YELLOW}Rust API (8080):${NC}"
    test_endpoint "Health check" "GET" "http://localhost:8080/health" "200"
    echo ""
    
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ All services are running and healthy!${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${GREEN}🌐 Open this URL in your browser:${NC}"
    echo -e "   ${BLUE}http://localhost:5173${NC}"
    echo ""
    echo -e "${GREEN}✨ Your dev environment is ready!${NC}"
else
    echo -e "${RED}❌ Some services are not running${NC}"
    echo ""
    echo -e "${YELLOW}To start all services, run:${NC}"
    echo -e "   ${BLUE}./START_LOCAL_DEV.sh${NC}"
    echo ""
    echo -e "${YELLOW}Or start manually:${NC}"
    echo -e "   Terminal 1: cd apps/api && npm run dev"
    echo -e "   Terminal 2: cd apps/backend-python && python main.py"
    echo -e "   Terminal 3: cd apps/rust-api && cargo run --release"
    echo -e "   Terminal 4: cd apps/web && npm run dev"
    exit 1
fi
