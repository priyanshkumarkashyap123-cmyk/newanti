FROM python:3.12.8-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Security: create non-root user
RUN useradd -r -s /bin/false -m app

# Copy application code
COPY --chown=app:app . .

# Copy startup script with execute permission
COPY --chown=app:app startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

# Set production environment
ENV ENVIRONMENT=production
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

USER app

# Expose port
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start with Gunicorn (production)
CMD ["/app/startup.sh"]
