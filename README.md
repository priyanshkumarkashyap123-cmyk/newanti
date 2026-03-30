# BeamLab

Professional structural engineering platform with web-based modeling, multi-backend analysis, AI-assisted workflows, and production deployment pipelines.

**Last Verified:** 30 March 2026  
**Canonical docs:** [`docs/README.md`](./docs/README.md), [`docs/specs/README.md`](./docs/specs/README.md), [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md)

## What this project is

BeamLab is a monorepo for structural engineering design, analysis, reporting, and deployment. It combines a modern web frontend with multiple backend services to support interactive modeling, solver-backed analysis, data persistence, and production-grade hosting.

### Core capabilities

- Structural model creation and editing
- Multi-backend analysis and routing
- Rust-based high-performance solver and design checks
- Python-based structural generation and validation service
- Node.js API for auth, billing, and platform orchestration
- Web UI with production deployment support
- WASM/solver packages for advanced client-side and shared computation

## Start here

Read these in order:

1. [`docs/README.md`](./docs/README.md) — canonical documentation index
2. [`docs/specs/README.md`](./docs/specs/README.md) — specification pack and source-of-truth map
3. [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md) — operations and release workflow
4. [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) — release gates and readiness status

## Repository structure

```text
newanti/
├── apps/
│   ├── web/             # React + Vite frontend
│   ├── api/             # Node.js Express API (auth, billing, orchestration)
│   ├── backend-python/  # FastAPI structural generation/validation service
│   ├── rust-api/       # Rust Axum high-performance analysis service
│   └── backend-rust/   # Rust/WASM solver and related backend code
├── packages/
│   ├── solver/
│   └── solver-wasm/
├── docs/
├── tests/
├── scripts/
├── infra/
└── .github/workflows/
```

## System architecture

### Frontend

- `apps/web`
- React + Vite
- Route-aware UI for modeling, analysis, reports, and account flows
- Detects runtime capabilities and routes work to the appropriate engine

### Node API

- `apps/api`
- Express-based platform API
- Handles auth, payments, project orchestration, and shared app APIs
- Exposes OpenAPI documentation and platform-facing routes

### Python backend

- `apps/backend-python`
- FastAPI structural generation and validation service
- Provides template generation, AI-assisted generation placeholders, and model validation
- Default docs:
	- Swagger: `http://localhost:8080/docs`
	- ReDoc: `http://localhost:8080/redoc`

### Rust API

- `apps/rust-api`
- Axum-based high-performance structural analysis engine
- Focused on solver performance, advanced analysis, and design checks
- Exposes analysis, structures, sections, design, and metrics endpoints

### Shared solver packages

- `packages/solver`
- `packages/solver-wasm`
- `apps/backend-rust`

These support shared computation, web-accelerated solver paths, and cross-runtime analysis logic.

## Key documentation areas

- `docs/ARCHITECTURE.md` — system boundaries and service responsibilities
- `docs/API_SURFACE_MAP.md` — API family map
- `docs/FRONTEND_ROUTE_AND_FEATURE_MAP.md` — frontend route inventory
- `docs/REPO_ARCHITECTURE_INVENTORY.md` — repository structure inventory
- `docs/README.md` — canonical doc hub
- `docs/specs/README.md` — task-friendly specification bundle

## Development setup

### Prerequisites

- Node.js + pnpm
- Python 3.11+ for `apps/backend-python`
- Rust toolchain for `apps/rust-api` and Rust/WASM packages
- Git

### Typical local workflow

1. Install dependencies at the workspace level.
2. Start the backend service you need.
3. Start the frontend in `apps/web`.
4. Use the health endpoints and smoke tests to verify the stack.

### Python backend local run

```bash
cd apps/backend-python
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

Optional JAX support:

```bash
pip install -r requirements-jax.txt
```

### Rust API local run

```bash
cd apps/rust-api
cargo build
cargo build --release
./build.sh --release --run
```

### Frontend local run

```bash
cd apps/web
pnpm install
pnpm dev
```

## Build and verification

Source-of-truth files for build and release flow:

- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `.github/workflows/*.yml`
- `build-production.sh`
- `smoke-test.sh`

Useful validation entrypoints:

- `./build-production.sh`
- `./smoke-test.sh`
- `./verify-system.sh` where available in the docs/tooling flow

## Deployment

### Production topology

The documented production-like deployment includes:

- Frontend web app
- Node API
- Python backend
- Rust API
- data services such as MongoDB and Redis where configured

### Azure and CI/CD

The repository includes Azure-oriented deployment flows and GitHub Actions workflows for build, test, and release automation.

Key deployment references:

- `DEPLOYMENT_RUNBOOK.md`
- `DEPLOYMENT_CHECKLIST.md`
- `DEPLOYMENT_STATUS.md`
- `PRODUCTION_READINESS.md`
- `.github/workflows/azure-deploy.yml`

### Secrets and environment variables

- Use `.env.deploy.example` as the deployment template.
- Do not commit `.env.deploy` or any secret-bearing file.
- Store production secrets in GitHub Actions secrets, Azure App Settings, Azure Key Vault, or equivalent secure stores.

## Configuration highlights

Common environment variables referenced across the repo include:

- `FRONTEND_URL`
- `ALLOWED_ORIGINS`
- `GEMINI_API_KEY`
- `USE_MOCK_AI`
- `MONGODB_URI`
- `JWT_SECRET`
- `RUST_API_PORT`
- `RUST_LOG`
- `VITE_API_URL`
- `VITE_PYTHON_API_URL`
- `VITE_RUST_API_URL`

For app-specific configuration, check the individual app READMEs and environment setup scripts.

## Testing

The repo includes multiple validation layers:

- Backend smoke tests
- Frontend unit tests
- Playwright E2E setup
- Shell-based endpoint smoke tests
- Service health checks

Selected references:

- `smoke-test.sh`
- `tests/`
- `apps/web/src/__tests__/`
- `apps/web/playwright.config.ts`
- `apps/backend-python/tests/`

## Important app READMEs

- [`apps/backend-python/README.md`](./apps/backend-python/README.md)
- [`apps/rust-api/README.md`](./apps/rust-api/README.md)

## Documentation policy

- Treat `docs/README.md` as the canonical documentation hub.
- Treat `docs/specs/README.md` as the canonical specification bundle.
- Treat `docs/archive/**` and older status reports as historical references unless explicitly promoted to active documentation.

## License

MIT
