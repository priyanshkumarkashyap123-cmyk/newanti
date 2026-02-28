# Build stage
FROM node:20-alpine AS builder

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

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
