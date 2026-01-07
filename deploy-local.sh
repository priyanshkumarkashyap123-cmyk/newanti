#!/bin/bash

# ============================================
# Quick Local Deployment - Start All Services
# ============================================

echo "🚀 Starting BeamLab Local Deployment"
echo "====================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if builds exist
if [ ! -d "apps/web/dist" ]; then
    echo "❌ Frontend build not found. Run: ./build-production.sh"
    exit 1
fi

if [ ! -f "apps/rust-api/target/release/beamlab-rust-api" ]; then
    echo "❌ Rust API binary not found. Run: ./build-production.sh"
    exit 1
fi

echo "📦 Starting Services..."
echo ""

# Start frontend
echo -e "${BLUE}Starting Frontend...${NC}"
cd apps/web
npx serve dist -p 5173 &
FRONTEND_PID=$!
cd ../..
echo -e "${GREEN}✓${NC} Frontend started on http://localhost:5173 (PID: $FRONTEND_PID)"

# Wait for frontend to start
sleep 2

echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://localhost:5173"
echo ""
echo "📝 Note: Rust API requires MongoDB to start"
echo "   To run Rust API, ensure MongoDB is running then:"
echo "   cd apps/rust-api && ./target/release/beamlab-rust-api"
echo ""
echo "🛑 To stop services:"
echo "   kill $FRONTEND_PID"
echo ""
echo "🎉 Your application is now running!"
echo ""

# Keep script running
wait $FRONTEND_PID
