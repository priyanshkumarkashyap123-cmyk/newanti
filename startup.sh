#!/bin/bash
# Root startup script - redirect to apps/api folder
set -e

echo "BeamLab Node.js API - Starting from monorepo root"
echo "Current directory: $(pwd)"

# Change to the app directory
cd apps/api

echo "Working directory: $(pwd)"
echo "Contents:"
ls -la | head -20

# Check dist exists
if [ ! -d "dist" ]; then
    echo "ERROR: dist folder not found! Running build..."
    npm ci --legacy-peer-deps
    npm run build
fi

# Set up environment
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-8080}

echo "Starting application with NODE_ENV=$NODE_ENV on PORT=$PORT"

# Start the app
exec node dist/index.js
