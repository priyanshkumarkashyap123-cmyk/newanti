FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy solver
COPY solver.py .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD echo '{"nodes":[],"members":[],"loads":[]}' | python solver.py --stdin || exit 1

# Default command
CMD ["python", "solver.py", "--stdin"]
