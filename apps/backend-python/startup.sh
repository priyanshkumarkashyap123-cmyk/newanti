#!/bin/bash
# Azure Linux App Service Startup Script

echo "🚀 Starting FastAPI with Uvicorn..."

# Use direct uvicorn for better compatibility with Azure App Service
# Azure expects app to bind to 0.0.0.0:$PORT or 0.0.0.0:8000
PORT=${PORT:-8000}
python -m uvicorn main:app --host 0.0.0.0 --port "$PORT" --workers 1
