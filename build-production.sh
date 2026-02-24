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
