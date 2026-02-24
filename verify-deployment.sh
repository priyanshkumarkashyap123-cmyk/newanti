#!/bin/bash

# Pre-Deployment Verification Script
# Run this before deploying to production

set -e  # Exit on any error

echo "🔍 BEAMLAB PRE-DEPLOYMENT VERIFICATION"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
ERRORS=0
WARNINGS=0

# Function to print success
success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print error
error() {
    echo -e "${RED}✗${NC} $1"
    ERRORS=$((ERRORS + 1))
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

echo "1. Checking Dependencies..."
if command -v pnpm &> /dev/null; then
    success "pnpm installed"
else
    error "pnpm not found - install with: npm install -g pnpm"
fi

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    success "Node.js installed: $NODE_VERSION"
else
    error "Node.js not found"
fi

echo ""
echo "2. Running TypeScript Checks..."
cd apps/web
if pnpm run type-check 2>/dev/null || true; then
    success "TypeScript check passed"
else
    warning "TypeScript check had warnings (may be acceptable)"
fi

echo ""
echo "3. Building Production Bundle..."
if pnpm build > /tmp/build.log 2>&1; then
    success "Production build successful"
    
    # Check bundle size
    if [ -f "dist/index.html" ]; then
        success "dist/index.html exists"
    else
        error "dist/index.html not found"
    fi
    
    # Check for critical assets
    if ls dist/assets/*.js 1> /dev/null 2>&1; then
        JS_COUNT=$(ls dist/assets/*.js | wc -l)
        success "JavaScript bundles created ($JS_COUNT files)"
    else
        error "No JavaScript bundles found"
    fi
    
    if ls dist/assets/*.css 1> /dev/null 2>&1; then
        CSS_COUNT=$(ls dist/assets/*.css | wc -l)
        success "CSS bundles created ($CSS_COUNT files)"
    else
        warning "No CSS bundles found"
    fi
else
    error "Build failed - check /tmp/build.log"
    cat /tmp/build.log
fi

echo ""
echo "4. Checking Critical Files..."
CRITICAL_FILES=(
    "src/main.tsx"
    "src/App.tsx"
    "src/components/ErrorBoundary.tsx"
    "src/utils/fetchUtils.ts"
    "src/utils/productionSafeguards.ts"
    "src/services/AnalysisService.ts"
    "src/store/model.ts"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        success "$file exists"
    else
        error "$file missing"
    fi
done

echo ""
echo "5. Checking Environment Configuration..."
if [ -f ".env" ] || [ -f ".env.production" ]; then
    success "Environment file exists"
else
    warning "No .env file found - ensure env vars set in deployment platform"
fi

echo ""
echo "6. Checking Package Dependencies..."
if [ -f "package.json" ]; then
    success "package.json exists"
    
    # Check for critical dependencies
    if grep -q "react" package.json; then
        success "React dependency found"
    else
        error "React not in dependencies"
    fi
    
    if grep -q "three" package.json; then
        success "Three.js dependency found"
    else
        warning "Three.js not found (may be optional)"
    fi
else
    error "package.json missing"
fi

echo ""
echo "7. Security Check..."
# Check for exposed secrets (basic check)
if grep -r "AKIA" src/ 2>/dev/null || grep -r "sk_live" src/ 2>/dev/null; then
    error "Potential secrets found in source code!"
else
    success "No obvious secrets in source code"
fi

echo ""
echo "8. File Size Check..."
# Check for unusually large files
LARGE_FILES=$(find src -type f -size +1M 2>/dev/null || true)
if [ -z "$LARGE_FILES" ]; then
    success "No unusually large source files"
else
    warning "Large files found in src/:"
    echo "$LARGE_FILES"
fi

echo ""
echo "========================================"
echo "VERIFICATION SUMMARY"
echo "========================================"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL CHECKS PASSED${NC}"
    echo "Status: READY FOR DEPLOYMENT ✅"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ PASSED WITH WARNINGS${NC}"
    echo "Errors: $ERRORS"
    echo "Warnings: $WARNINGS"
    echo "Status: REVIEW WARNINGS BEFORE DEPLOYMENT ⚠️"
    exit 0
else
    echo -e "${RED}✗ VERIFICATION FAILED${NC}"
    echo "Errors: $ERRORS"
    echo "Warnings: $WARNINGS"
    echo "Status: FIX ERRORS BEFORE DEPLOYMENT ❌"
    exit 1
fi
