# BeamLab

Professional structural engineering platform with web-based modeling, multi-backend analysis, and production deployment pipelines.

**Last Verified:** 24 March 2026  
**Verified Against:** `package.json`, `pnpm-workspace.yaml`, `.github/workflows/*.yml`, `apps/*` entrypoints

## Start here

- Project documentation hub: [`docs/README.md`](./docs/README.md)
- Platform specifications: [`docs/specs/README.md`](./docs/specs/README.md)
- Deployment operations: [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md)
- Release readiness: [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md)

## Platform overview

BeamLab runs as a monorepo with frontend, APIs, and shared engineering packages.

- **Frontend:** `apps/web` (React + Vite)
- **Node API:** `apps/api` (Express)
- **Python Backend:** `apps/backend-python` (FastAPI)
- **Rust API:** `apps/rust-api` (Axum)
- **WASM/solver packages:** `apps/backend-rust`, `packages/solver-wasm`, `packages/solver`

## Repository layout

```text
newanti/
├── apps/
│   ├── web/
│   ├── api/
│   ├── backend-python/
│   ├── rust-api/
│   └── backend-rust/
├── packages/
├── docs/
├── tests/
└── .github/workflows/
```

## Development and verification

Use workspace scripts and workflows as the source of truth:

- Root task graph/config: `turbo.json`
- Workspace/package boundaries: `pnpm-workspace.yaml`
- CI quality gates: `.github/workflows/ci.yml`
- Production deployment: `.github/workflows/azure-deploy.yml`

Environment Variables and Secrets Management:
- Use `.env.deploy.example` as the template for deployment environments. Do **not** commit `.env.deploy` with real secrets—it's already git-ignored.
- Store production secrets in a secure store (e.g., GitHub Actions secrets, Azure Key Vault), and inject them at build or runtime rather than storing in code.

For environment variables, reference the environment setup files used by each app and deployment script family under `scripts/`.

## Notes on historical documentation

The repository contains historical session reports and phase logs in `docs/` and `docs/archive/`. Treat these as informational snapshots unless explicitly marked canonical in [`docs/README.md`](./docs/README.md).

## License

MIT
