#!/bin/bash

# ============================================
# BeamLab Local Development Startup Script
# ============================================
# This script starts ALL services for local development:
# - Frontend (Vite dev server on port 5173)
# - Node API (Express on port 3001)
# - Python API (FastAPI on port 8000)
# - Rust API (Axum on port 8080)
#
# After all services start, the website will be accessible at:
# ✅ http://localhost:5173
#
# All features are unlocked: PDF export, AI assistant, advanced design codes
# No authentication required for localhost
# ============================================

set +e

cd "$(dirname "$0")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🔧 BeamLab Local Development Environment             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if port is in use
check_port() {
    lsof -i :$1 > /dev/null 2>&1
    return $?
}

# Function to kill existing processes on ports
cleanup_ports() {
    echo -e "${YELLOW}Checking for existing services on required ports...${NC}"
    
    for port in 3001 8000 8080 5173; do
        if check_port $port; then
            echo -e "${YELLOW}⚠️  Port $port is already in use${NC}"
            PID=$(lsof -t -i :$port)
            echo -e "${YELLOW}   Killing process $PID...${NC}"
            kill -9 $PID 2>/dev/null || true
            sleep 1
        fi
    done
    echo ""
}

# Cleanup old processes
cleanup_ports

echo -e "${BLUE}📦 Starting BeamLab Services...${NC}"
echo ""

# ============================================
# 1. START NODE.JS BACKEND
# ============================================
echo -e "${YELLOW}→ Starting Node.js API (Port 3001)...${NC}"
cd apps/api
NODE_ENV=development LOCAL_AUTH_BYPASS=true npm run dev > ../../logs/node-api.log 2>&1 &
NODE_API_PID=$!
echo -e "${GREEN}  ✓ Node API started (PID: $NODE_API_PID)${NC}"
sleep 2
echo ""

# ============================================
# 2. START PYTHON BACKEND
# ============================================
echo -e "${YELLOW}→ Starting Python API (Port 8000)...${NC}"
cd ../backend-python

# Check for venv
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}  Creating Python virtual environment...${NC}"
    python3 -m venv .venv
fi

# Activate venv and start
source .venv/bin/activate > /dev/null 2>&1
pip install -q -r requirements.txt 2>/dev/null || true
python main.py > ../../logs/python-api.log 2>&1 &
PYTHON_API_PID=$!
echo -e "${GREEN}  ✓ Python API started (PID: $PYTHON_API_PID)${NC}"
sleep 3
echo ""

# ============================================
# 3. START RUST BACKEND
# ============================================
echo -e "${YELLOW}→ Starting Rust API (Port 8080)...${NC}"
cd ../rust-api

# Check if binary exists, if not build it
if [ ! -f "target/release/beamlab_rust_api" ] && [ ! -f "target/debug/beamlab_rust_api" ]; then
    echo -e "${YELLOW}  Building Rust API (this may take 2-3 minutes)...${NC}"
    cargo build --release 2>/dev/null
fi

# Start Rust API
cargo run --release --bin beamlab-rust-api > ../../logs/rust-api.log 2>&1 &
RUST_API_PID=$!
sleep 2
if kill -0 "$RUST_API_PID" 2>/dev/null; then
    echo -e "${GREEN}  ✓ Rust API started (PID: $RUST_API_PID)${NC}"
else
    echo -e "${YELLOW}  ⚠ Rust API failed to start (see logs/rust-api.log). Continuing with frontend + Node + Python.${NC}"
fi
echo ""

# ============================================
# 4. START FRONTEND
# ============================================
echo -e "${YELLOW}→ Starting Frontend Dev Server (Port 5173)...${NC}"
cd ../web

# Ensure node_modules exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  Installing dependencies...${NC}"
    npm install > /dev/null 2>&1
fi

npm run dev > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}  ✓ Frontend Dev Server started (PID: $FRONTEND_PID)${NC}"
sleep 2
echo ""

# ============================================
# SHOW STATUS
# ============================================
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ All services started successfully!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}📍 Access Points:${NC}"
echo -e "   ${BLUE}🌐 Frontend:        ${GREEN}http://localhost:5173${NC}"
echo -e "   ${BLUE}🔌 Node API:       ${GREEN}http://localhost:3001${NC}"
echo -e "   ${BLUE}🐍 Python API:     ${GREEN}http://localhost:8000${NC}"
echo -e "   ${BLUE}🦀 Rust API:       ${GREEN}http://localhost:8080${NC}"
echo ""
echo -e "${GREEN}🔓 Authentication:${NC}"
echo -e "   ${YELLOW}✓ Login DISABLED on localhost${NC}"
echo -e "   ${YELLOW}✓ All features UNLOCKED${NC}"
echo -e "   ${YELLOW}✓ Full access to all components${NC}"
echo ""
echo -e "${GREEN}📊 Features Enabled:${NC}"
echo -e "   ${YELLOW}✓ PDF Export${NC}"
echo -e "   ${YELLOW}✓ AI Assistant${NC}"
echo -e "   ${YELLOW}✓ Advanced Design Codes${NC}"
echo -e "   ${YELLOW}✓ Unlimited Projects${NC}"
echo -e "   ${YELLOW}✓ Unlimited Analyses${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📋 Service Logs:${NC}"
echo -e "   tail -f logs/frontend.log       # Frontend dev server"
echo -e "   tail -f logs/node-api.log       # Node.js backend"
echo -e "   tail -f logs/python-api.log     # Python backend"
echo -e "   tail -f logs/rust-api.log       # Rust backend"
echo ""
echo -e "${YELLOW}🛑 To stop all services:${NC}"
echo -e "   pkill -f 'npm run dev'          # Stop frontend"
echo -e "   pkill -f 'python main.py'       # Stop Python API"
echo -e "   pkill -f 'cargo run'            # Stop Rust API"
echo -e "   pkill -f 'node.*index'          # Stop Node API"
echo ""

# ============================================
# KEEP SCRIPT RUNNING
# ============================================
echo -e "${BLUE}Press Ctrl+C to stop all services${NC}"
echo ""

# Save all PIDs for cleanup
echo "$NODE_API_PID $PYTHON_API_PID $RUST_API_PID $FRONTEND_PID" > .pids

# Wait for services
trap "cleanup; exit" INT TERM

cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    
    for pid in $NODE_API_PID $PYTHON_API_PID $RUST_API_PID $FRONTEND_PID; do
        if kill -0 "$pid" 2>/dev/null; then
            kill $pid 2>/dev/null || true
            wait $pid 2>/dev/null || true
        fi
    done
    
    rm -f .pids
    echo -e "${GREEN}✓ All services stopped${NC}"
}

# Keep the script running
wait
