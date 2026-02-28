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
# -w: Worker processes (use CPU count, min 2, max 4 for Azure B1/B2)
WORKERS=${GUNICORN_WORKERS:-$(python3 -c "import os; print(min(4, max(2, os.cpu_count() or 2)))")}
echo "🚀 Starting Production Server with $WORKERS workers..."
gunicorn -w "$WORKERS" -k uvicorn.workers.UvicornWorker main:app --bind=0.0.0.0:8000 --timeout 600 --access-logfile - --error-logfile -
