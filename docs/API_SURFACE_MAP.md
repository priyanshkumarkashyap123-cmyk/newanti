# BeamLab API Surface Map

This appendix groups the platform API surface by functional area. It is intended for architecture discovery and onboarding, not as a strict OpenAPI replacement.

## 1. Public and platform health endpoints

| Area | Likely path(s) | Runtime | Notes |
|---|---|---|---|
| Root service health | `/`, `/health`, `/api/health` | Node, Rust, Python | All runtimes expose health-style endpoints |
| API docs | `/api/docs`, `/api/v1/docs` | Node | Protected in production |
| OpenAPI YAML | `/api/openapi.yaml` | Rust | Served directly by Rust API |
| Metrics | `/api/metrics`, `/api/metrics/detailed` | Rust | Prometheus-style/detailed runtime metrics |
| Public marketing API | `/api/public`, `/api/v1/public` | Node | Public landing routes |

## 2. Identity, users, and sessions

### Node-owned ingress surface

| Area | Path family | Notes |
|---|---|---|
| Authentication | `/api/auth`, `/api/v1/auth` | Sign-in, sign-up, auth lifecycle |
| User APIs | `/api/user`, `/api/v1/user` | Current user and user-facing protected actions |
| Device/session | `/api/session`, `/api/v1/session` | Session management and device lifecycle |
| Usage tracking | `/api/usage`, `/api/v1/usage` | Usage and analysis/report activity |
| Consent | `/api/consent`, `/api/v1/consent` | Legal/user consent records |
| Audit | `/api/audit`, `/api/v1/audit` | Audit trail / activity records |

## 3. Projects and collaboration

| Area | Path family | Runtime | Notes |
|---|---|---|---|
| Projects | `/api/project`, `/api/v1/project` | Node | Canonical project CRUD |
| Project users/presence | `/api/project/:id/users` | Node | Socket-based project user list |
| AI session history | `/api/ai-sessions`, `/api/v1/ai-sessions` | Node | Session persistence for AI workflows |
| Feedback | `/api/feedback`, `/api/v1/feedback` | Node | User feedback ingestion |
| Collaboration sockets | Socket.IO via `SocketServer` | Node | Realtime presence/collaboration layer |

## 4. Analysis and solver APIs

### Gateway-mounted families

| Path family | Frontend-facing purpose | Gateway runtime |
|---|---|---|
| `/api/analyze`, `/api/v1/analyze` | Structural analysis requests | Node |
| `/api/analysis`, `/api/v1/analysis` | Alternative analysis family naming | Node |
| `/api/advanced`, `/api/v1/advanced` | High-cost advanced analyses | Node |
| `/api/jobs`, `/api/v1/jobs` | Track job/queue execution | Node |

Verified gateway files:

- [`../apps/api/src/routes/analysis/index.ts`](../apps/api/src/routes/analysis/index.ts)
- [`../apps/api/src/services/serviceProxy.ts`](../apps/api/src/services/serviceProxy.ts)

### Rust analysis families

| Path family | Notes |
|---|---|
| `/api/analyze` | Main Rust analysis endpoint |
| `/api/analyze/solve` | Solve alias |
| `/api/analyze/batch` | Batch analysis |
| `/api/analyze/stream` | Streaming analysis |
| `/api/analysis/modal` | Modal analysis |
| `/api/analysis/time-history` | Time-history analysis |
| `/api/analysis/seismic` | Seismic analysis |
| `/api/advanced/pdelta` | P-Delta |
| `/api/advanced/modal` | Advanced modal |
| `/api/advanced/buckling` | Buckling |
| `/api/advanced/spectrum` | Spectrum |
| `/api/advanced/cable` | Cable analysis |
| `/api/advanced/staged-construction` | Staged construction |
| `/api/advanced/dam` | Direct analysis method |
| `/api/advanced/nonlinear` | Nonlinear solve |
| `/api/advanced/mass-source` | Mass source |
| `/api/advanced/wind-tunnel` | Wind tunnel |
| `/api/advanced/influence-surface` | Influence surface |
| `/api/advanced/spectrum-directional` | Directional spectrum |

### Python analysis families

Observed and registered in `main.py`:

- `/analyze/*` (from `analysis_routes.py`)
- `/analysis/*` and `/analysis/*/*` patterns (from `routers/analysis.py`)
- `/api/jobs/*` (from `routers/jobs.py`)
- additional internal analysis routers: stress/dynamic, meshing, load generation
- health dependency endpoints checking Node and Rust availability

## 5. Design and engineering code APIs

### Gateway-mounted family

| Path family | Purpose | Runtime ingress |
|---|---|---|
| `/api/design`, `/api/v1/design` | Engineering design checks from frontend workflows | Node |

Verified gateway file:

- [`../apps/api/src/routes/design/index.ts`](../apps/api/src/routes/design/index.ts)

### Rust design surface highlights

| Path | Purpose |
|---|---|
| `/api/design/is456/flexural-capacity` | RC flexural capacity |
| `/api/design/is456/shear` | RC shear design |
| `/api/design/is456/biaxial-column` | Column design |
| `/api/design/is456/deflection` | RC deflection check |
| `/api/design/is456/torsion` | RC torsion |
| `/api/design/is800/bolt-bearing` | Steel connection design |
| `/api/design/is800/bolt-hsfg` | HSFG bolt design |
| `/api/design/is800/fillet-weld` | Fillet weld design |
| `/api/design/is800/auto-select` | Steel section auto-select |
| `/api/design/is1893/*` | Seismic checks |
| `/api/design/is875/*` | Wind/live/load code utilities |
| `/api/design/serviceability/*` | Deflection, vibration, crack width |
| `/api/design/section-wise/*` | Section-wise RC/steel flows |
| `/api/design/aisc360/*` | AISC checks |
| `/api/design/ec2/*` | Eurocode concrete |
| `/api/design/ec3/*` | Eurocode steel |
| `/api/design/aci318/*` | ACI concrete |
| `/api/design/nds2018/bending` | Timber/wood design |
| `/api/design/composite-beam` | Composite design |
| `/api/design/base-plate` | Base plate design |
| `/api/design/ductile-detailing` | Detailing checks |
| `/api/design/batch` | Batch design requests |

### Python design families

Observed registrations:

- `/design/*` via `design_routes`
- `routers/design.py`
- `routers/is_code_checks.py`

## 6. Sections, templates, and model helpers

| Area | Path family | Runtime | Notes |
|---|---|---|---|
| Public sections | `/api/sections`, `/api/sections/search`, `/api/sections/:id` | Rust | Public read-style section access |
| Sections databases | `/api/sections/aisc`, `/api/sections/ec3` | Rust | Additional code-specific section lists |
| Python sections | `routers/sections.py` | Python | Additional/overlapping sections behavior |
| Templates | `/api/templates/*` | Rust via Node gateway family | Beam/truss/frame/portal templates |
| Interop | `/api/interop`, `/api/v1/interop` | Node | File/data interchange orchestration |

## 7. Structures, reports, and optimization

### Rust-owned notable families

| Path family | Purpose |
|---|---|
| `/api/structures/*` | Structure CRUD at solver/runtime layer |
| `/api/reports/analysis` | Analysis report generation |
| `/api/reports/design` | Design report generation |
| `/api/optimization/fsd` | Fully stressed design optimization |
| `/api/optimization/check-member` | Member optimization check |
| `/api/optimization/auto-select` | Optimization-driven section selection |
| `/api/optimization/quick` | Quick optimization |
| `/api/optimization/info` | Optimization capability metadata |

### Python-owned notable families

| Family | Purpose |
|---|---|
| `routers/reports.py` | Report/document endpoints |
| `routers/layout.py`, `routers/layout_v2.py` | Planning/layout generation |
| `routers/jobs.py` | Job endpoints |
| `/db/*` | Database persistence helper routes |

## 8. AI, layout, and auxiliary intelligence

| Area | Path family | Runtime | Notes |
|---|---|---|---|
| AI gateway ingress | `/api/ai`, `/api/v1/ai` | Node | Auth, rate limiting, backpressure |
| Python AI routes | `ai_routes.py`, `routers/ai_endpoints.py` | Python | Core AI/generative logic |
| Layout generation | `routers/layout.py`, `routers/layout_v2.py` | Python | Planning/layout-specific functionality |
| PINN solver | `/pinn/*` when available | Python | Optional advanced solver route family |

## 9. Payments and commerce

| Area | Path family | Runtime | Notes |
|---|---|---|---|
| Billing | `/api/billing`, `/api/v1/billing` | Node | Payment/order orchestration |
| Razorpay billing | `/api/billing/razorpay`, `/api/v1/billing/razorpay` | Node | Provider-specific flows |

Verified payment implementation files:

- [`../apps/api/src/razorpay.ts`](../apps/api/src/razorpay.ts)
- [`../apps/api/src/phonepe.ts`](../apps/api/src/phonepe.ts)

Observed Razorpay endpoint sequence from code:

| Step | Endpoint | Purpose |
|---|---|---|
| 1 | `POST /api/billing/razorpay/create-order` | Creates order and returns checkout metadata |
| 2 | frontend popup | User completes Razorpay payment UI |
| 3 | `POST /api/billing/razorpay/verify-payment` | Verifies signature and activates subscription |
| 4 | `POST /api/billing/razorpay/webhook` | Handles provider callback and idempotent subscription sync |

## 10. Cross-cutting traffic policy on the gateway

The following are not business APIs, but they materially shape how frontend requests behave:

- request IDs
- CORS allowlists
- CSRF validation
- auth enforcement
- cost-weighted rate limiting
- backpressure queues for heavy workloads
- startup DB-readiness 503 guard for DB-backed families

These controls are applied in [`../apps/api/src/index.ts`](../apps/api/src/index.ts) and related middleware.

## 11. Verified runtime mount matrix (source-backed)

This section lists mount points as they are actually wired in runtime entrypoints.

### 11.1 Node gateway mounts (`apps/api/src/index.ts`)

| Public path prefix | Mounted router/module | Runtime role |
|---|---|---|
| `/api/analyze`, `/api/analysis`, `/api/v1/analyze`, `/api/v1/analysis` | `routes/analysis/index.ts` | Analysis ingress + Rust forwarding + async jobs |
| `/api/design`, `/api/v1/design` | `routes/design/index.ts` | Design ingress (Rust-first with Python fallback) |
| `/api/advanced`, `/api/v1/advanced` | `routes/advanced/index.ts` | Advanced analysis ingress |
| `/api/jobs`, `/api/v1/jobs` | `routes/jobs/index.ts` | Job queue proxy to Python |
| `/api/interop`, `/api/v1/interop` | `routes/interop/index.ts` | Interoperability workflows |
| `/api/templates`, `/api/v1/templates` | `routes/templates/index.ts` | Template generation ingress |
| `/api/ai`, `/api/v1/ai` | `routes/ai/index.ts` | AI-authenticated gateway layer |
| `/api/public`, `/api/v1/public` | `routes/publicLandingRoutes.ts` | Public/marketing API surface |
| `/api/project`, `/api/v1/project` | `routes/projectRoutes.ts` | Project CRUD and collaboration metadata |
| `/api/user`, `/api/v1/user` | `routes/userRoutes.ts` | User/account endpoints |
| `/api/session`, `/api/v1/session` | `routes/sessionRoutes.ts` | Device/session management |
| `/api/usage`, `/api/v1/usage` | `routes/usageRoutes.ts` | Usage metrics and limits |
| `/api/consent`, `/api/v1/consent` | `routes/consentRoutes.ts` | Legal consent lifecycle |
| `/api/audit`, `/api/v1/audit` | `routes/audit/index.ts` | Audit trail APIs |
| `/api/feedback`, `/api/v1/feedback` | `routes/feedback/index.ts` | Product/AI feedback ingestion |
| `/api/analytics`, `/api/v1/analytics` | `routes/analytics/index.ts` | Product analytics events |
| `/api/ai-sessions`, `/api/v1/ai-sessions` | `routes/aiSessionRoutes.ts` | AI session persistence |
| `/api/billing`, `/api/v1/billing` | `phonepe.ts` (`billingRouter`) | PhonePe billing flow |
| `/api/billing/razorpay`, `/api/v1/billing/razorpay` | `razorpay.ts` (`razorpayBillingRouter`) | Razorpay billing flow |

### 11.2 Rust direct mounts (`apps/rust-api/src/main.rs`)

| Public path prefix | Handler module |
|---|---|
| `/api/analyze*`, `/api/analysis/*` | `handlers::analysis` |
| `/api/advanced/*` | `handlers::advanced` |
| `/api/design/*` | `handlers::design` |
| `/api/optimization/*` | `handlers::optimization` |
| `/api/structures/*` | `handlers::structures` |
| `/api/reports/*` | `handlers::report` |
| `/api/sections*` | `handlers::sections` |
| `/api/templates/*` | `handlers::templates` |
| `/api/metrics*` | `handlers::metrics` |
| `/api/openapi.yaml`, `/health` | `handlers::openapi`, `handlers::health` |

### 11.3 Python direct mounts (`apps/backend-python/main.py`)

| Public path prefix | Router/module source |
|---|---|
| `/analyze/*` | `analysis_routes.py` |
| `/design/*` | `design_routes.py` |
| `/pinn/*` | `pinn_routes.py` |
| `/db/*` | `db_routes.py` |
| `/ai/*` | `ai_routes.py` |
| `/api/jobs/*` | `routers/jobs.py` |
| `/reports/*` | `routers/reports.py` |
| `/interop/*` | `routers/interop.py` |
| `/validate` | local endpoint in `main.py` |

## 12. Reading guidance

- If you need **who owns what**, go to [`SERVICE_ROUTING_MATRIX.md`](./SERVICE_ROUTING_MATRIX.md)
- If you need **which pages call which domains**, go to [`FRONTEND_ROUTE_AND_FEATURE_MAP.md`](./FRONTEND_ROUTE_AND_FEATURE_MAP.md)
- If you need **folder/file locations**, go to [`REPO_ARCHITECTURE_INVENTORY.md`](./REPO_ARCHITECTURE_INVENTORY.md)
