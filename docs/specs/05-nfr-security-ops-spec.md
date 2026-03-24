# 05 — Non-Functional, Security, and Operations Specification

_Last updated: 24 March 2026_

## 1. Reliability and availability

### Health endpoints

Minimum required checks:

- liveness: `/health`
- dependency health: `/health/dependencies`
- readiness: `/health/ready`
- compatibility alias: `/api/health`

### Required behavior

- return HTTP `200` when healthy
- return HTTP `503` when degraded/not ready
- include dependency status detail for Mongo/Rust/Python

## 2. Security baseline

Global Node middleware must remain enabled:

- CORS (allowlist-driven)
- security headers (Helmet-style)
- cookie parsing + CSRF protection
- XSS sanitization
- request IDs + structured request logging
- secure error handler

## 3. Rate limiting and backpressure

Heavy endpoint groups must remain protected by:

- global rate limits
- weighted cost limits (analysis/design/advanced/AI)
- lane-specific backpressure queues for high-cost workloads

## 4. Environment hardening

### Frontend

`apps/web/src/config/env.ts` validation requirements:

- production API URLs must be HTTPS
- production URLs must not point to localhost
- payment config warnings/errors surfaced at startup

### Node API

`apps/api/src/config/env.ts` production constraints:

- fatal on unsafe critical env config
- CORS origin safety checks
- localhost guard for production
- internal secret strength validation

## 5. Observability

Required baseline:

- request correlation (`X-Request-ID`)
- structured logging in Node
- error monitoring support (Sentry when enabled)
- metrics endpoint families (`/api/metrics*`, rust metrics)

## 6. Performance expectations

- Rust service remains primary path for performance-critical structural compute
- analysis cache supported for repeat solves
- async jobs used for very large model runs
- frontend lazy-load route/page modules to reduce initial bundle pressure

## 7. Deployment topology (expected)

Production-like topology includes:

- web frontend
- Node gateway (`api-node`)
- Rust API
- Python backend
- MongoDB
- Redis

## 8. NFR acceptance criteria

1. Security middleware stack is active in all environments.
2. Health/readiness semantics are accurate and automatable.
3. Heavy compute paths have enforceable rate/backpressure controls.
4. Production env misconfiguration fails fast.
5. Logs/metrics are sufficient to debug cross-service failures.
