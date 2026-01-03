#!/bin/bash
# Verify production environment is correctly configured

echo "========================================="
echo "BeamLab Ultimate - Production Verification"
echo "========================================="
echo ""

# Check if environment variables are set
echo "📋 Checking environment variables..."
echo ""

if [ -n "$VITE_API_URL" ]; then
    echo "✅ VITE_API_URL = $VITE_API_URL"
else
    echo "⚠️  VITE_API_URL not set (will use default: https://api.beamlabultimate.tech)"
fi

if [ -n "$VITE_PYTHON_API_URL" ]; then
    echo "✅ VITE_PYTHON_API_URL = $VITE_PYTHON_API_URL"
else
    echo "⚠️  VITE_PYTHON_API_URL not set (will use default: https://api.beamlabultimate.tech)"
fi

if [ -n "$VITE_CLERK_PUBLISHABLE_KEY" ]; then
    echo "✅ VITE_CLERK_PUBLISHABLE_KEY is set"
else
    echo "❌ VITE_CLERK_PUBLISHABLE_KEY not set"
fi

echo ""
echo "========================================="
echo "Testing API Endpoints"
echo "========================================="
echo ""

# Test API health
API_URL="${VITE_API_URL:-https://api.beamlabultimate.tech}"

echo "🔍 Testing: $API_URL/api/health"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" "$API_URL/api/health"

echo "🔍 Testing: $API_URL/api/analyze (should return 401 without auth)"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" "$API_URL/api/analyze"

echo ""
echo "========================================="
echo "Checking localhost references"
echo "========================================="
echo ""

echo "🔍 Scanning for localhost in source code..."
grep -r "localhost" \
    apps/web/src \
    apps/api/src \
    apps/backend-python \
    2>/dev/null | grep -v "node_modules" | grep -v ".next" | wc -l

echo " localhost references found (should be 0 in production source)"

echo ""
echo "========================================="
echo "✅ Verification Complete"
echo "========================================="
echo ""
echo "Frontend URL: https://beamlabultimate.tech"
echo "API URL: $API_URL"
echo ""
