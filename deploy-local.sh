#!/bin/bash

# ============================================
# Full Local Deployment - Web + Node + Python + Rust + Mongo
# ============================================

set -e

echo "🚀 Starting BeamLab Full Local Deployment"
echo "========================================="
echo ""

if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Docker is required but not installed."
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "❌ docker compose plugin is required."
    exit 1
fi

echo "📦 Building and starting integrated stack..."
docker compose up --build -d

echo ""
echo "⏳ Waiting for health checks to stabilize..."
sleep 8

echo ""
echo "📊 Service status"
docker compose ps

echo ""
echo "🔍 Health probe summary"
curl -fsS http://localhost:3001/health >/dev/null && echo "✅ Node API healthy" || echo "⚠️ Node API not ready"
curl -fsS http://localhost:8000/health >/dev/null && echo "✅ Python API healthy" || echo "⚠️ Python API not ready"
curl -fsS http://localhost:3002/health >/dev/null && echo "✅ Rust API healthy" || echo "⚠️ Rust API not ready"
curl -fsS http://localhost:5173/health >/dev/null && echo "✅ Frontend healthy" || echo "⚠️ Frontend not ready"

echo ""
echo "✅ Deployment complete"
echo "🌐 Frontend: http://localhost:5173"
echo "🧠 Node API: http://localhost:3001/health"
echo "🐍 Python API: http://localhost:8000/health"
echo "🦀 Rust API: http://localhost:3002/health"
echo ""
echo "🛑 Stop everything with: docker compose down"
