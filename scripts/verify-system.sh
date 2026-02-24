#!/bin/bash

###############################################################################
# BeamLab System Verification Script
# Tests all components: WASM, Python backend, CORS, AI
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  BeamLab System Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Parse arguments
BACKEND_URL="${1:-http://localhost:8000}"
FRONTEND_URL="${2:-http://localhost:5173}"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Backend URL: $BACKEND_URL"
echo "  Frontend URL: $FRONTEND_URL"
echo ""

# Test 1: Backend Health
echo -e "${BLUE}[1/6]${NC} Testing backend health..."
if curl -s "$BACKEND_URL/health" > /dev/null; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${RED}✗ Backend is not responding${NC}"
    echo "   Make sure: python -m uvicorn main:app --reload is running"
    exit 1
fi

# Test 2: AI Status
echo -e "${BLUE}[2/6]${NC} Checking AI engine status..."
AI_STATUS=$(curl -s "$BACKEND_URL/ai/status")
echo "$AI_STATUS" | jq '.' 2>/dev/null || echo "$AI_STATUS"

if echo "$AI_STATUS" | grep -q "operational"; then
    echo -e "${GREEN}✓ AI engine is operational${NC}"
else
    echo -e "${RED}✗ AI engine status unclear${NC}"
fi
echo ""

# Test 3: CORS Configuration
echo -e "${BLUE}[3/6]${NC} Checking CORS headers..."
CORS_HEADERS=$(curl -s -I "$BACKEND_URL/health")
if echo "$CORS_HEADERS" | grep -q "access-control-allow"; then
    echo -e "${GREEN}✓ CORS headers present${NC}"
    echo "$CORS_HEADERS" | grep "access-control"
else
    echo -e "${YELLOW}⚠ CORS headers not detected (may be blocked locally)${NC}"
fi
echo ""

# Test 4: WASM Build
echo -e "${BLUE}[4/6]${NC} Checking WASM build artifacts..."
WASM_PKG="/Users/rakshittiwari/Desktop/newanti/apps/backend-rust/pkg"
if [ -f "$WASM_PKG/backend_rust_bg.wasm" ]; then
    SIZE=$(ls -lh "$WASM_PKG/backend_rust_bg.wasm" | awk '{print $5}')
    echo -e "${GREEN}✓ WASM binary found (${SIZE})${NC}"
else
    echo -e "${RED}✗ WASM binary not found${NC}"
    echo "   Build it: cd apps/backend-rust && wasm-pack build --target web --out-dir ./pkg --release --mode no-install"
fi
echo ""

# Test 5: Frontend Dependencies
echo -e "${BLUE}[5/6]${NC} Checking frontend setup..."
WEB_DIR="/Users/rakshittiwari/Desktop/newanti/apps/web"
if [ -f "$WEB_DIR/node_modules/.pnpm/lock.yaml" ] || [ -f "$WEB_DIR/node_modules/.package-lock.json" ]; then
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠ Frontend dependencies may not be installed${NC}"
    echo "   Run: cd apps/web && pnpm install"
fi
echo ""

# Test 6: Configuration
echo -e "${BLUE}[6/6]${NC} Checking environment configuration..."
if [ -f "/Users/rakshittiwari/Desktop/newanti/.env" ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"
    
    # Check key vars
    if grep -q "GEMINI_API_KEY" "/Users/rakshittiwari/Desktop/newanti/.env"; then
        echo -e "${GREEN}  ✓ GEMINI_API_KEY configured${NC}"
    fi
    
    if grep -q "USE_MOCK_AI" "/Users/rakshittiwari/Desktop/newanti/.env"; then
        MOCK_AI=$(grep "USE_MOCK_AI" "/Users/rakshittiwari/Desktop/newanti/.env" | cut -d'=' -f2)
        echo -e "${GREEN}  ✓ USE_MOCK_AI = $MOCK_AI${NC}"
    fi
    
    if grep -q "FRONTEND_URL" "/Users/rakshittiwari/Desktop/newanti/.env"; then
        FRONTEND=$(grep "FRONTEND_URL" "/Users/rakshittiwari/Desktop/newanti/.env" | cut -d'=' -f2)
        echo -e "${GREEN}  ✓ FRONTEND_URL = $FRONTEND${NC}"
    fi
else
    echo -e "${YELLOW}⚠ .env file not found${NC}"
    echo "   Create it: python config_manager.py local"
fi
echo ""

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Verification Complete${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Frontend: open $FRONTEND_URL"
echo "  2. API Docs: open $BACKEND_URL/docs"
echo "  3. Logs: tail -f backend logs while testing"
echo ""
