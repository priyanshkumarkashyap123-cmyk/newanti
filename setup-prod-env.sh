#!/bin/bash
# ============================================
# BeamLab Production Environment Setup
# ============================================
# This script sets up all environment variables for production
# Usage: source setup-prod-env.sh

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔧 BeamLab Production Environment Setup${NC}"
echo ""

# ============================================
# AZURE CONFIGURATION
# ============================================

export AZURE_SUBSCRIPTION="your-subscription-id"
export AZURE_RESOURCE_GROUP="beamlab-ci-rg"
export AZURE_LOCATION="eastus"

# ============================================
# DATABASE
# ============================================

export MONGODB_URI="mongodb+srv://beamlab_admin:yLCaEABYdoy5yKYd@cluster0.qiu5szt.mongodb.net/?appName=Cluster0"

# ============================================
# AUTHENTICATION
# ============================================

# Clerk authentication (sign up at clerk.com)
export CLERK_PUBLISHABLE_KEY="pk_test_Y2FwYWJsZS1vd2wtNjYuY2xlcmsuYWNjb3VudHMuZGV2JA"
export CLERK_SECRET_KEY="sk_test_7MqXdNmcEp22DKExdwWXDDjn7QzMimENVg5GHo3Q3f"

# JWT for internal API communication
export JWT_SECRET="beamlab_jwt_secret_key_2026_production"

# ============================================
# RUST API (New High-Performance Engine)
# ============================================

export RUST_API_PORT=8080
export RUST_LOG="beamlab_api=info,tower_http=info"
export RUST_API_URL="https://beamlab-rust-api.azurewebsites.net"

# ============================================
# NODE.JS API (Legacy - Auth & Payments)
# ============================================

export NODE_ENV=production
export PORT=8080
export API_URL="https://beamlab-api.azurewebsites.net"
export FRONTEND_URL="https://beamlabultimate.tech"

# ============================================
# PYTHON API (AI Services)
# ============================================

export GEMINI_API_KEY="AIzaSyDFYavn0QKWTJ8OjQkoe8IalmQijA6BRhw"
export USE_MOCK_AI=false
export PYTHON_API_URL="https://beamlab-backend-python.azurewebsites.net"

# ============================================
# PAYMENTS (Razorpay)
# ============================================

export RAZORPAY_KEY_ID="rzp_test_RzJWtn49KU70H5"
export RAZORPAY_KEY_SECRET="VRIambh7i6mqeKJ3VMfhH1D8"

# ============================================
# FRONTEND (React)
# ============================================

export VITE_CLERK_PUBLISHABLE_KEY="pk_test_Y2FwYWJsZS1vd2wtNjYuY2xlcmsuYWNjb3VudHMuZGV2JA"
export VITE_API_URL="https://beamlab-api.azurewebsites.net"
export VITE_RUST_API_URL="https://beamlab-rust-api.azurewebsites.net"
export VITE_PYTHON_API_URL="https://beamlab-backend-python.azurewebsites.net"

# ============================================
# DOMAIN & SSL
# ============================================

export DOMAIN="beamlabultimate.tech"
export DOMAIN_WWW="www.beamlabultimate.tech"

# CORS allowed origins
export ALLOWED_ORIGINS="https://beamlabultimate.tech,https://www.beamlabultimate.tech"

# ============================================
# DEPLOYMENT SETTINGS
# ============================================

# Container registry
export CONTAINER_REGISTRY="beamlabregistry"
export CONTAINER_REGISTRY_URL="beamlabregistry.azurecr.io"

# API versions
export RUST_API_VERSION="2.1.0"
export NODE_API_VERSION="2.0.0"

echo -e "${GREEN}✅ Environment variables loaded${NC}"
echo ""
echo "Configuration Summary:"
echo "  Domain: $DOMAIN"
echo "  Database: MongoDB Atlas"
echo "  Auth: Clerk"
echo "  Rust API: $RUST_API_URL"
echo "  Node.js API: $API_URL"
echo "  Python API: $PYTHON_API_URL"
echo ""
echo "📝 Edit this file with your actual credentials before deployment"
echo ""
