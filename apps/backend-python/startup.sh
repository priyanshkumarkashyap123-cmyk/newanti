#!/bin/bash
# Azure Linux App Service Startup Script

echo "🚀 Starting FastAPI Production Server..."

# Use Gunicorn with Uvicorn workers for production
# Azure expects app to bind to 0.0.0.0:$PORT (defaults to 8000)
PORT=${PORT:-8000}

# Calculate optimal workers: 2 * CPU cores + 1 (capped at 8 for memory safety)
# For 10K concurrent users, uvicorn's async handles most concurrency on each worker
WORKERS=${GUNICORN_WORKERS:-4}
MAX_REQUESTS=${GUNICORN_MAX_REQUESTS:-5000}
MAX_REQUESTS_JITTER=${GUNICORN_MAX_REQUESTS_JITTER:-500}

echo "Workers: $WORKERS, Max requests: $MAX_REQUESTS, Port: $PORT"

gunicorn -w "$WORKERS" \
    -k uvicorn.workers.UvicornWorker \
    main:app \
    --bind=0.0.0.0:"$PORT" \
    --timeout 180 \
    --graceful-timeout 30 \
    --keep-alive 65 \
    --max-requests "$MAX_REQUESTS" \
    --max-requests-jitter "$MAX_REQUESTS_JITTER" \
    --access-logfile - \
    --error-logfile - \
    --log-level info
