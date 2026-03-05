#!/bin/bash
# Azure Linux App Service Startup Script

echo "🚀 Starting FastAPI Production Server..."

# Use Gunicorn with Uvicorn workers for production
# Azure expects app to bind to 0.0.0.0:$PORT (defaults to 8000)
PORT=${PORT:-8000}
gunicorn -w 2 -k uvicorn.workers.UvicornWorker main:app --bind=0.0.0.0:$PORT --timeout 180 --access-logfile - --error-logfile -
