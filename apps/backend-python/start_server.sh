#!/bin/bash
# Azure App Service startup script for Python backend
set -e

echo "[$(date)] Starting BeamLab Python Backend..."
echo "[$(date)] Python version: $(python3 --version)"
echo "[$(date)] Pip packages installed:"
pip list | grep -E "(gunicorn|uvicorn|fastapi)" || true

# Use UV_THREADPOOL_SIZE to prevent thread pool deadlock
export UV_THREADPOOL_SIZE=16

# Run gunicorn with minimal workers to avoid timeout
echo "[$(date)] Starting gunicorn..."
exec gunicorn \
  --workers 1 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 600 \
  --access-logfile - \
  --error-logfile - \
  --log-level info \
  main:app
