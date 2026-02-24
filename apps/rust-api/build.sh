#!/bin/bash
# BeamLab Rust API - Build and Run Script

set -e

echo "🦀 BeamLab Rust API Build Script"
echo "================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}❌ Rust is not installed!${NC}"
    echo "Install Rust from: https://rustup.rs"
    exit 1
fi

echo -e "${GREEN}✅ Rust $(rustc --version)${NC}"

# Navigate to the rust-api directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Parse arguments
BUILD_MODE="debug"
RUN_AFTER_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --release)
            BUILD_MODE="release"
            shift
            ;;
        --run)
            RUN_AFTER_BUILD=true
            shift
            ;;
        --docker)
            echo -e "${YELLOW}🐳 Building Docker image...${NC}"
            docker build -t beamlab-rust-api:latest .
            echo -e "${GREEN}✅ Docker image built: beamlab-rust-api:latest${NC}"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--release] [--run] [--docker]"
            exit 1
            ;;
    esac
done

# Build
echo -e "${YELLOW}🔧 Building in $BUILD_MODE mode...${NC}"

if [ "$BUILD_MODE" = "release" ]; then
    cargo build --release
    BINARY="target/release/beamlab-rust-api"
else
    cargo build
    BINARY="target/debug/beamlab-rust-api"
fi

echo -e "${GREEN}✅ Build successful!${NC}"
echo "Binary: $BINARY"

# Run if requested
if [ "$RUN_AFTER_BUILD" = true ]; then
    echo ""
    echo -e "${YELLOW}🚀 Starting server...${NC}"
    
    # Set default environment variables if not set
    export RUST_LOG="${RUST_LOG:-beamlab_api=debug,tower_http=debug}"
    export RUST_API_PORT="${RUST_API_PORT:-3002}"
    export MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/beamlab}"
    export JWT_SECRET="${JWT_SECRET:-development-secret-key}"
    
    echo "Port: $RUST_API_PORT"
    echo "MongoDB: $MONGODB_URI"
    echo ""
    
    ./$BINARY
fi
