# Build stage - use Rust nightly for edition2024 support
# Pin to 2025-01 nightly for reproducibility
FROM rust:nightly-2025-01-15-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Create dummy source for dependency caching
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    echo "" > src/lib.rs

# Build dependencies only (cached layer)
RUN cargo build --release && rm -rf src

# Copy openapi.yaml (needed by handlers)
COPY openapi.yaml ./

# Copy actual source code
COPY src ./src

# Touch main.rs to trigger rebuild
RUN touch src/main.rs

# Build the actual application
RUN cargo build --release

# Runtime stage - minimal image
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies including curl for health checks
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder and make executable
COPY --from=builder /app/target/release/beamlab-rust-api /app/beamlab-rust-api
RUN chmod +x /app/beamlab-rust-api

# Security: non-root user
RUN useradd -r -s /bin/false -m app
RUN chown app:app /app/beamlab-rust-api
USER app

# Expose port (Azure uses 8080 by default)
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

ENV RUST_LOG=beamlab_api=info,tower_http=info
ENV PORT=8080

CMD ["/app/beamlab-rust-api"]
