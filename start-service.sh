#!/bin/bash

# ============================================
# BeamLab Simple Startup - Direct Terminal
# ============================================
# Run this in 4 separate terminals to see live output

if [ "$1" == "frontend" ]; then
    echo "🌐 Starting Frontend on port 5173..."
    cd /Users/rakshittiwari/Desktop/newanti/apps/web
    npm run dev
    
elif [ "$1" == "node" ]; then
    echo "🔌 Starting Node API on port 3001..."
    cd /Users/rakshittiwari/Desktop/newanti/apps/api
    NODE_ENV=development LOCAL_AUTH_BYPASS=true npm run dev
    
elif [ "$1" == "python" ]; then
    echo "🐍 Starting Python API on port 8000..."
    cd /Users/rakshittiwari/Desktop/newanti/apps/backend-python
    source .venv/bin/activate
    PORT=8000 python main.py
    
elif [ "$1" == "rust" ]; then
    echo "🦀 Starting Rust API on port 8080..."
    cd /Users/rakshittiwari/Desktop/newanti/apps/rust-api
    cargo run --release --bin beamlab-rust-api
    
else
    echo "Usage: $0 {frontend|node|python|rust}"
    echo ""
    echo "Open 4 terminals and run:"
    echo "  Terminal 1: $0 frontend"
    echo "  Terminal 2: $0 node"
    echo "  Terminal 3: $0 python"
    echo "  Terminal 4: $0 rust"
    echo ""
    echo "Then open: http://localhost:5173"
fi
