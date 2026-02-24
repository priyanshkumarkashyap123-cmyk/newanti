#!/bin/bash
# Azure Linux App Service Startup Script

# 1. Install dependencies
# (Azure usually handles this via Oryx, but good to have as fallback or for explicit control)
# 1. Install dependencies (Handled by Oryx build during deployment)
# pip install -r requirements.txt -> REMOVED to prevent startup timeout


# 2. Start Gunicorn with Uvicorn workers
# -w 4: 4 worker processes
# -k uvicorn.workers.UvicornWorker: Use Uvicorn for asyncio
# --bind=0.0.0.0:8000: Azure internal routing expects port 8000
# --timeout 600: 10 minute timeout for long analysis jobs
echo "🚀 Starting Production Server..."
gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app --bind=0.0.0.0:8000 --timeout 600 --access-logfile - --error-logfile -
