# Build stage
FROM node:20.18-alpine AS builder

WORKDIR /app

# Copy package files + workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/solver-wasm/package.json packages/solver-wasm/

# Install dependencies
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate
RUN pnpm install --frozen-lockfile --filter @beamlab/web...

# Copy source
COPY apps/web apps/web
COPY packages packages

# Build
WORKDIR /app/apps/web
RUN pnpm build

# Production stage — use nginx:stable for security patches
FROM nginx:stable-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Add production nginx main config with tuning for 10K+ concurrent connections
RUN echo 'worker_processes auto;\n\
worker_rlimit_nofile 65535;\n\
error_log /var/log/nginx/error.log warn;\n\
pid /var/run/nginx.pid;\n\
events {\n\
    worker_connections 4096;\n\
    multi_accept on;\n\
    use epoll;\n\
}\n\
http {\n\
    include /etc/nginx/mime.types;\n\
    default_type application/octet-stream;\n\
    sendfile on;\n\
    tcp_nopush on;\n\
    tcp_nodelay on;\n\
    server_tokens off;\n\
    log_format main '\''$remote_addr - $remote_user [$time_local] "$request" '\''\n\
                      '\''$status $body_bytes_sent "$http_referer" '\''\n\
                      '\''"$http_user_agent" "$http_x_forwarded_for" $request_time'\'';\n\
    access_log /var/log/nginx/access.log main;\n\
    include /etc/nginx/conf.d/*.conf;\n\
}' > /etc/nginx/nginx.conf

# Copy built assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx server config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
