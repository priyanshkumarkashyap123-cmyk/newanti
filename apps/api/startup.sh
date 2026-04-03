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

# Ensure environment variables are set (Azure App Service settings take precedence)
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3001}

# Log critical environment variables (without exposing secrets)
echo "Environment configured:"
echo "  NODE_ENV: $NODE_ENV"
echo "  PORT: $PORT"
echo "  FRONTEND_URL: ${FRONTEND_URL:-not set}"
echo "  CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS:-not set}"

# Verify critical env vars
if [ -z "$MONGODB_URI" ]; then
  echo "FATAL: MONGODB_URI not set"
  exit 1
fi
if [ -z "$JWT_SECRET" ]; then
  echo "FATAL: JWT_SECRET not set"
  exit 1
fi

# Handle node_modules - either extract from tarball or install from lock file
echo "Setting up dependencies..."
if [ -f "node_modules.tar.gz" ]; then
    echo "Found node_modules.tar.gz, extracting..."
    tar -xzf node_modules.tar.gz
elif [ ! -d "node_modules" ]; then
    echo "node_modules not found and no tarball available, installing from package-lock.json..."
    npm ci --legacy-peer-deps --verbose
else
    echo "Using existing node_modules directory"
fi

# Verify build artifacts exist
if [ ! -f "dist/index.js" ]; then
    if [ ! -f "dist/index.cjs" ]; then
        echo "ERROR: Neither dist/index.js nor dist/index.cjs found. Build artifacts missing."
        echo "Available dist files:"
        ls -la dist/ 2>/dev/null || echo "(dist directory empty or missing)"
        exit 1
    fi
    echo "WARNING: dist/index.js not found, but dist/index.cjs exists. Using cjs variant."
    echo "Starting server from dist/index.cjs..."
    exec node dist/index.cjs
fi

echo "Build artifacts verified. Starting BeamLab API server..."
exec node dist/index.js

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
