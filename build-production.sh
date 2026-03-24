#!/bin/bash
# 🚀 BeamLab Production Deployment Script
# Builds both Rust API and Frontend for production

set -e  # Exit on error

echo "🦀 Building Rust API (Release Mode)..."
cd apps/rust-api
cargo build --release
echo "✅ Rust API built successfully!"
echo ""

echo "⚛️ Building Frontend (Production)..."
cd ../web

# Ensure required VITE_* env vars are set for the build
: "${VITE_CLERK_PUBLISHABLE_KEY:?Missing VITE_CLERK_PUBLISHABLE_KEY}"
export VITE_API_URL="${VITE_API_URL:-https://beamlab-backend-node-prod.azurewebsites.net}"
export VITE_RUST_API_URL="${VITE_RUST_API_URL:-https://beamlab-rust-api-prod.azurewebsites.net}"
export VITE_PYTHON_API_URL="${VITE_PYTHON_API_URL:-https://beamlab-backend-python-prod.azurewebsites.net}"
export VITE_WEBSOCKET_URL="${VITE_WEBSOCKET_URL:-wss://beamlab-backend-python-prod.azurewebsites.net/ws}"
export VITE_SENTRY_DSN="${VITE_SENTRY_DSN:-}"

pnpm install --frozen-lockfile
pnpm build
echo "✅ Frontend built successfully!"
echo ""

echo "🎉 Build Complete!"
echo ""
echo "📦 Production artifacts:"
echo "  - Rust API: apps/rust-api/target/release/beamlab-rust-api"
echo "  - Frontend: apps/web/dist/"
echo ""
echo "🚀 To run in production:"
echo "  1. Start Rust API: ./apps/rust-api/target/release/beamlab-rust-api"
echo "  2. Serve frontend: cd apps/web && pnpm preview"
echo ""
