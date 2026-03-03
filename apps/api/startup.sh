#!/bin/bash
# Azure App Service startup script for Node.js backend
# This ensures environment variables are loaded and the app starts correctly

set -e

echo "==================================="
echo "BeamLab API Server - Azure Startup"
echo "==================================="

# Print Node.js version
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"

# Print working directory
echo "Working directory: $(pwd)"
echo "Directory contents:"
ls -la

# Ensure environment variables are set (Azure App Service settings take precedence)
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-8080}

# Log critical environment variables (without exposing secrets)
echo "Environment configured:"
echo "  NODE_ENV: $NODE_ENV"
echo "  PORT: $PORT"
echo "  FRONTEND_URL: ${FRONTEND_URL:-not set}"
echo "  CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS:-not set}"

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo "ERROR: dist folder not found!"
    echo "Current directory contents:"
    ls -la
    exit 1
fi

# Check if the entry point exists
if [ ! -f "dist/index.js" ]; then
    echo "ERROR: dist/index.js not found!"
    echo "dist/ contents:"
    ls -la dist/
    exit 1
fi

echo "Starting BeamLab API server..."
echo "==================================="

# Start the Node.js application
exec node dist/index.js
