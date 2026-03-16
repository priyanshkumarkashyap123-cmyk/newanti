# BeamLab Repository Architecture Inventory

This appendix is the deep repo map for the current BeamLab monorepo.

## 1. Root workspace

Key root-level files and folders:

- [`../package.json`](../package.json) — workspace scripts and package-manager baseline
- [`../pnpm-workspace.yaml`](../pnpm-workspace.yaml) — workspace package globs
- [`../turbo.json`](../turbo.json) — monorepo task orchestration
- [`../docker-compose.yml`](../docker-compose.yml) — primary runtime topology
- [`../docker-compose.bheemla.yml`](../docker-compose.bheemla.yml) — local/dev-oriented compose variant
- [`../README.md`](../README.md) — general repo entry
- [`../docs`](../docs) — large documentation corpus
- [`../apps`](../apps) — deployable/product applications
- [`../packages`](../packages) — shared libraries and interfaces
- [`../tests`](../tests) — root-level testing/support area
- [`../scripts`](../scripts) — build/deploy/support scripts
- [`../.github`](../.github) — workflows, instructions, templates

## 2. Applications (`apps/`)

Current top-level apps folder contents:

- [`../apps/web`](../apps/web)
- [`../apps/api`](../apps/api)
- [`../apps/rust-api`](../apps/rust-api)
- [`../apps/backend-python`](../apps/backend-python)
- [`../apps/backend-rust`](../apps/backend-rust)
- [`../apps/desktop`](../apps/desktop)

### 2.1 `apps/web`

Important source subtrees observed in [`../apps/web/src`](../apps/web/src):

- `pages/` — route entrypoints
- `components/` — reusable UI and domain components
- `providers/` — app-wide providers
- `hooks/` — custom hooks
- `store/` — application state
- `services/` — service layer
- `config/` — route metadata, env/config
- `modules/` — domain modules (including reports/civil/etc.)
- `workers/` — background/worker logic
- `solvers/`, `engine/`, `engines/` — client-side engineering helpers
- `visualization/`, `graphics/` — rendering/visual UX
- `api/`, `lib/`, `utils/` — network helpers, libraries, utilities
- `app/` — app-scoped or framework-style pages/modules
- `core/`, `contracts/`, `types/`, `constants/` — foundational contracts and shared frontend logic

Representative files:

- [`../apps/web/src/App.tsx`](../apps/web/src/App.tsx)
- [`../apps/web/src/main.tsx`](../apps/web/src/main.tsx)
- [`../apps/web/src/config/appRouteMeta.ts`](../apps/web/src/config/appRouteMeta.ts)

### 2.2 `apps/api`

Important source areas:

- `src/routes/` — route families (`analysis`, `design`, `advanced`, `ai`, `jobs`, etc.)
- `src/middleware/` — security/auth/backpressure/validation layers
- `src/services/` — orchestration/business helpers
- `src/config/` — env and CORS configuration
- `src/utils/` — logging, JWT, helpers
- `src/types/` — TS types for API layer
- `src/migrations/` — DB migration runner
- `src/models.ts` — Mongoose models
- `src/SocketServer.ts` — collaboration/realtime socket layer
- `src/index.ts` — runtime entry

Representative route families under [`../apps/api/src/routes`](../apps/api/src/routes):

- `advanced/`
- `ai/`
- `analysis/`
- `analytics/`
- `audit/`
- `design/`
- `interop/`
- `jobs/`
- `layout/`
- `templates/`
- standalone route files such as `authRoutes.ts`, `projectRoutes.ts`, `userRoutes.ts`, `sessionRoutes.ts`, `usageRoutes.ts`

### 2.3 `apps/rust-api`

Core source areas:

- `src/main.rs` — runtime entry
- `src/lib.rs` — library export layer
- `src/config.rs`, `src/db.rs`, `src/error.rs`, `src/models.rs` — app foundation
- `src/handlers/` — HTTP handlers
- `src/solver/` — structural solver internals
- `src/design_codes/` — code-based engineering checks
- `src/optimization/` — optimization engines
- `src/cache.rs`, `src/middleware.rs` — performance and security runtime helpers
- `tests/` — Rust regression and benchmark validation

Observed handler files:

- `advanced.rs`
- `analysis.rs`
- `design.rs`
- `health.rs`
- `metrics.rs`
- `openapi.rs`
- `optimization.rs`
- `report.rs`
- `sections.rs`
- `structures.rs`
- `templates.rs`

### 2.4 `apps/backend-python`

Key source areas:

- `main.py` — runtime entry
- `routers/` — modular FastAPI route families
- `analysis/` — solver/report/analysis support modules
- `design/` — engineering design modules
- `database/` — data helpers
- `is_codes/` — code-specific engineering logic
- `ai_routes.py` — AI routing layer
- `factory.py`, `models.py` — core Python API contracts
- `security_middleware.py`, `logging_config.py`, request logging middleware
- `tests/` — Python-side tests

Observed routers under [`../apps/backend-python/routers`](../apps/backend-python/routers):

- `analysis.py`
- `design.py`
- `interop.py`
- `is_code_checks.py`
- `jobs.py`
- `layout.py`
- `layout_v2.py`
- `load_gen.py`
- `meshing.py`
- `reports.py`
- `sections.py`
- `stress_dynamic.py`
- `ai_endpoints.py`
- `schemas.py`

### 2.5 `apps/desktop`

Observed files:

- [`../apps/desktop/tauri.conf.json`](../apps/desktop/tauri.conf.json)
- `src-tauri/`

Desktop currently appears to be a Tauri wrapper around the web application rather than an independent UI stack.

### 2.6 `apps/backend-rust`

This app exists as a top-level Rust crate and is currently structured as a **library/WASM package**, not a standalone HTTP runtime service.

Verified from [`../apps/backend-rust/Cargo.toml`](../apps/backend-rust/Cargo.toml):

- `[lib]` is defined with `crate-type = ["cdylib", "rlib"]`
- no `[[bin]]` target is declared
- no `src/main.rs` file is present
- primary crate entrypoint is [`../apps/backend-rust/src/lib.rs`](../apps/backend-rust/src/lib.rs)

Interpretation for architecture mapping:

- treat `apps/backend-rust` as an engine/library artifact (including WASM-facing exports),
- treat `apps/rust-api` as the Rust HTTP runtime service entrypoint.

## 3. Shared packages (`packages/`)

Observed package folders:

- [`../packages/analysis`](../packages/analysis)
- [`../packages/database`](../packages/database)
- [`../packages/solver`](../packages/solver)
- [`../packages/solver-wasm`](../packages/solver-wasm)

Working interpretation:

- `analysis/` — shared analysis-oriented helpers/contracts
- `database/` — shared DB definitions or schema support
- `solver/` — solver abstractions/interfaces consumable outside Rust runtime
- `solver-wasm/` — Rust/WASM/browser-facing solver bridge work

## 4. Documentation corpus (`docs/`)

The docs folder is large and already contains many architecture-adjacent documents. Important current anchors:

- [`./ARCHITECTURE.md`](./ARCHITECTURE.md) — canonical architecture index created in this pass
- [`./CTO_TECHNICAL_ARCHITECTURE.md`](./CTO_TECHNICAL_ARCHITECTURE.md)
- [`./ARCHITECTURE_DECISION_RECORDS.md`](./ARCHITECTURE_DECISION_RECORDS.md)
- [`./BEAMLAB_DOMAIN_QUICK_START.md`](./BEAMLAB_DOMAIN_QUICK_START.md)
- [`./DEPLOYMENT.md`](./DEPLOYMENT.md) and other deployment guides
- [`./RUST_WASM_ARCHITECTURE.md`](./RUST_WASM_ARCHITECTURE.md)
- numerous phase/status/completion docs that should usually be treated as historical context, not canonical architecture sources

Recommendation: use `ARCHITECTURE.md` as the front door, then cross-link to older focused docs instead of rewriting them.

## 5. CI/CD and repo automation (`.github/`)

Observed workflows in [`../.github/workflows`](../.github/workflows):

- `azure-deploy.yml`
- `azure-static-web-apps-brave-mushroom-0eae8ec00.yml`
- `ci.yml`
- `deploy-rust-api.yml`
- `e2e-tests.yml`
- `lighthouse.yml`
- `pr.yml`
- `preview-deploy.yml`
- `release.yml`
- `security.yml`

Also notable:

- [`../.github/copilot-instructions.md`](../.github/copilot-instructions.md)
- [`../.github/instructions`](../.github/instructions)
- [`../.github/skills`](../.github/skills)

## 6. Runtime topology inventory

From [`../docker-compose.yml`](../docker-compose.yml), current production-like container inventory:

- `web`
- `backend-python`
- `rust-api`
- `api-node`
- `mongo`
- `redis`
- `mongo-backup`

Network tiers:

- `frontend`
- `backend`
- `data`

This is important because it reveals the intended production architecture more clearly than reading any single app in isolation.

## 7. Architecture reading order for new contributors

Recommended order:

1. [`ARCHITECTURE.md`](./ARCHITECTURE.md)
2. [`SERVICE_ROUTING_MATRIX.md`](./SERVICE_ROUTING_MATRIX.md)
3. [`FRONTEND_ROUTE_AND_FEATURE_MAP.md`](./FRONTEND_ROUTE_AND_FEATURE_MAP.md)
4. [`API_SURFACE_MAP.md`](./API_SURFACE_MAP.md)
5. This inventory file for folder-level discovery

## 8. Gaps to document in future audits

- exact ownership of shared packages under `packages/`
- more detailed package-level export graphs
- route-to-file mapping for every single frontend page
- source-of-truth declarations for overlapping Python/Rust engineering features
