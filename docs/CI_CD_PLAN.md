# CI/CD and deploy consolidation

## CI pipeline (per service)
- Lint: eslint/ruff/clippy as applicable.
- Typecheck/build checks (tsc, mypy/pyright, cargo check/clippy).
- Tests: unit + integration (containerized deps), contract tests against mock servers.
- Build artifacts/images: Docker image per service; signed/tagged.
- Migrations: dry-run (Prisma/Alembic/sqlx) gate.
- Security: dep scan, secret scan, SAST; block on high severity.

## CD principles
- Promote built artifacts/images across envs (dev→staging→prod) without rebuild.
- Deployment strategy: blue/green or rolling with health/readiness probes.
- Config injection: non-secret stage config from repo; secrets from vault/OIDC.
- Post-deploy smoke: hit `/healthz` and key functional smoke tests.

## Service matrix
- Frontend (`apps/web` → `frontend/`): build static bundle → CDN/static host. Add cache headers and CSP.
- Node API (`apps/api` → `backend/node/`): Dockerized service; depends on DB/cache. Health/readiness, rate limit, tracing.
- Python (`apps/backend-python` → `backend/python/`): Dockerized FastAPI; health/readiness; migrations if DB-bound.
- Rust API (`apps/rust-api` → `backend/rust/`): Dockerized Axum; tracing, metrics, readiness. 
- Rust WASM lib (`apps/backend-rust`): build/publish npm package (no deploy).

## Tooling
- One canonical Dockerfile per service; remove legacy Oryx/custom zips once replaced.
- Turbo/pnpm orchestrates Node builds; use cache keys per lockfile.
- Observability: OpenTelemetry exporters, structured JSON logs, correlation IDs; metrics and alerts on SLIs.

## Cleanup/deprecation
- Remove committed artifacts (node_modules, deploy zips/logs) and legacy deploy scripts once replacements land.
- Document required env vars in `.env.example` per service; keep secrets out of repo.
