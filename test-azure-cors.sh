#!/bin/bash
# Test CORS configuration for BeamLab Azure backends

echo "=================================================="
echo "BeamLab CORS Configuration Test"
echo "=================================================="

# Test configuration
ORIGIN="https://beamlabultimate.tech"
NODE_API="https://beamlab-backend-node.azurewebsites.net"
PYTHON_API="https://beamlab-backend-python.azurewebsites.net"
RUST_API="https://beamlab-rust-api.azurewebsites.net"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test CORS for an endpoint
test_cors() {
    local name=$1
    local url=$2
    local endpoint=$3
    
    echo ""
    echo "Testing $name: $url$endpoint"
    echo "----------------------------------------"
    
    # Test simple GET request
    echo "📡 Testing GET request..."
    response=$(curl -s -I -H "Origin: $ORIGIN" "$url$endpoint" 2>&1)
    
    if echo "$response" | grep -q "access-control-allow-origin"; then
        origin_header=$(echo "$response" | grep -i "access-control-allow-origin" | cut -d' ' -f2- | tr -d '\r')
        echo -e "${GREEN}✅ Access-Control-Allow-Origin: $origin_header${NC}"
    else
        echo -e "${RED}❌ Missing Access-Control-Allow-Origin header${NC}"
    fi
    
    if echo "$response" | grep -q "access-control-allow-credentials"; then
        creds=$(echo "$response" | grep -i "access-control-allow-credentials" | cut -d' ' -f2- | tr -d '\r')
        echo -e "${GREEN}✅ Access-Control-Allow-Credentials: $creds${NC}"
    else
        echo -e "${YELLOW}⚠️  Missing Access-Control-Allow-Credentials header${NC}"
    fi
    
    # Test preflight (OPTIONS) request
    echo ""
    echo "🔍 Testing OPTIONS (preflight) request..."
    preflight=$(curl -s -I -X OPTIONS \
        -H "Origin: $ORIGIN" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization" \
        "$url$endpoint" 2>&1)
    
    if echo "$preflight" | grep -q "access-control-allow-methods"; then
        methods=$(echo "$preflight" | grep -i "access-control-allow-methods" | cut -d' ' -f2- | tr -d '\r')
        echo -e "${GREEN}✅ Access-Control-Allow-Methods: $methods${NC}"
    else
        echo -e "${RED}❌ Missing Access-Control-Allow-Methods header${NC}"
    fi
    
    if echo "$preflight" | grep -q "access-control-allow-headers"; then
        headers=$(echo "$preflight" | grep -i "access-control-allow-headers" | cut -d' ' -f2- | tr -d '\r')
        echo -e "${GREEN}✅ Access-Control-Allow-Headers: $headers${NC}"
    else
        echo -e "${RED}❌ Missing Access-Control-Allow-Headers header${NC}"
    fi
    
    # Check HTTP status
    status=$(echo "$response" | grep "HTTP" | awk '{print $2}')
    if [ "$status" == "200" ] || [ "$status" == "204" ] || [ "$status" == "302" ]; then
        echo -e "${GREEN}✅ HTTP Status: $status${NC}"
    else
        echo -e "${YELLOW}⚠️  HTTP Status: $status${NC}"
    fi
}

# Test Node.js API
test_cors "Node.js API" "$NODE_API" "/health"

# Test more endpoints
echo ""
echo "Testing subscription endpoint..."
test_cors "Node.js API (Subscription)" "$NODE_API" "/api/user/subscription"

# Test Python API
test_cors "Python API" "$PYTHON_API" "/health"

# Test Rust API
test_cors "Rust API" "$RUST_API" "/health"

# Test WebSocket endpoint
echo ""
echo "=================================================="
echo "Testing WebSocket Endpoint"
echo "=================================================="
echo "📡 Testing WebSocket connection..."
ws_url="wss://beamlab-backend-node.azurewebsites.net/socket.io/"
echo "WebSocket URL: $ws_url"
echo ""
echo "Note: WebSocket CORS is tested automatically when establishing connection."
echo "If you still see WebSocket errors in browser, it means the main CORS"
echo "configuration needs to be fixed first (see above)."

echo ""
echo "=================================================="
echo "Summary"
echo "=================================================="
echo ""
echo "If you see ❌ errors above, CORS is NOT properly configured."
echo "Run this to fix:"
echo "  ./fix-azure-cors.sh"
echo ""
echo "Or configure manually via Azure Portal:"
echo "  See AZURE_CORS_FIX.md for instructions"
echo ""
echo "After fixing, wait 30-60 seconds and run this test again:"
echo "  ./test-azure-cors.sh"
echo ""
