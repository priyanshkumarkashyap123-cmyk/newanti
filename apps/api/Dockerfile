FROM node:18-alpine AS builder

# Install pnpm (matches workspace package manager)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm run build

FROM node:18-alpine

# Install pnpm in production image
RUN corepack enable && corepack prepare pnpm@latest --activate

# Security: run as non-root user
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/package.json ./
COPY --from=builder --chown=app:app /app/node_modules ./node_modules

USER app

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["pnpm", "start"]
