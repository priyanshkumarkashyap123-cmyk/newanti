# BeamLab Architecture

This document is the canonical architecture index for the BeamLab platform. It explains how the website and platform are organized across the web frontend, Node gateway, Rust solver service, Python analysis/AI service, desktop shell, data layer, reports, payments, and deployment.

Use this file as the entry point, then drill into the supporting appendices:

- [`SERVICE_ROUTING_MATRIX.md`](./SERVICE_ROUTING_MATRIX.md) — which runtime owns which feature or endpoint
- [`API_SURFACE_MAP.md`](./API_SURFACE_MAP.md) — grouped API surface used by the frontend and platform clients
- [`REPO_ARCHITECTURE_INVENTORY.md`](./REPO_ARCHITECTURE_INVENTORY.md) — deep repo and folder map
- [`FRONTEND_ROUTE_AND_FEATURE_MAP.md`](./FRONTEND_ROUTE_AND_FEATURE_MAP.md) — route/page → feature → service/store/backend mapping

Existing reference documents worth keeping linked rather than duplicated:

- [`CTO_TECHNICAL_ARCHITECTURE.md`](./CTO_TECHNICAL_ARCHITECTURE.md)
- [`ARCHITECTURE_DECISION_RECORDS.md`](./ARCHITECTURE_DECISION_RECORDS.md)
- [`BEAMLAB_DOMAIN_QUICK_START.md`](./BEAMLAB_DOMAIN_QUICK_START.md)
- [`RUST_WASM_ARCHITECTURE.md`](./RUST_WASM_ARCHITECTURE.md)
- [`DEPLOYMENT_RUNBOOK.md`](../DEPLOYMENT_RUNBOOK.md)

## 1. System overview

BeamLab is a monorepo-based structural engineering platform with multiple runtimes that collaborate to serve one user-facing product.

### Runtime layers

```text
Browser / Desktop Shell
        │
        ▼
React + TypeScript frontend (`apps/web`)
        │
        ▼
Node.js gateway/orchestration API (`apps/api`)
        │                 │
        │                 ├── Rust structural compute + design API (`apps/rust-api`)
        │                 └── Python analysis + AI + report API (`apps/backend-python`)
        │
        ▼
MongoDB + Redis + local browser storage
```

### Request and ownership flow

```mermaid
flowchart TD
        U[User in Browser or Tauri Desktop] --> W[apps/web React frontend]
        W --> N[apps/api Node gateway]
        N -->|analysis / advanced| R[apps/rust-api]
        N -->|AI / reports / layout / compatibility| P[apps/backend-python]
        N -->|projects / auth / billing / analytics| M[(MongoDB)]
        R --> M
        P --> M
        N --> X[(Redis / rate-limit and queue support)]
```

### Monorepo layout

Workspace composition is defined by [`pnpm-workspace.yaml`](../pnpm-workspace.yaml), which includes:

- `apps/*`
- `packages/*`

Primary runtime apps:

- [`../apps/web`](../apps/web) — React/Vite product frontend
- [`../apps/api`](../apps/api) — Express-based gateway, auth, CRUD, billing, analytics, orchestration
- [`../apps/rust-api`](../apps/rust-api) — Axum/Tokio/Rayon structural analysis and design service
- [`../apps/backend-python`](../apps/backend-python) — FastAPI-based analysis, AI, sections, reports, layout, compatibility service
- [`../apps/desktop`](../apps/desktop) — Tauri shell wrapping the web app for desktop distribution

Shared packages:

- [`../packages/analysis`](../packages/analysis)
- [`../packages/database`](../packages/database)
- [`../packages/solver`](../packages/solver)
- [`../packages/solver-wasm`](../packages/solver-wasm)

## 2. Runtime architecture and service boundaries

### Web frontend: `apps/web`

The frontend is a React 18 + TypeScript single-page application with lazy-loaded route modules, auth-aware layout composition, API client utilities, domain-specific pages, and a large structural feature set.

Key entry files:

- [`../apps/web/src/main.tsx`](../apps/web/src/main.tsx)
- [`../apps/web/src/App.tsx`](../apps/web/src/App.tsx)
- [`../apps/web/src/config/appRouteMeta.ts`](../apps/web/src/config/appRouteMeta.ts)

Key responsibilities:

- Marketing and public pages (`/`, `/pricing`, legal/help)
- Authenticated dashboard and project workspace (`/stream`, `/app`)
- Structural analysis UI (`/analysis/*`)
- Structural design UI (`/design/*`)
- Reporting and export UI (`/reports*`)
- Enterprise/collaboration/integration dashboards
- Pricing, subscription, AI, civil, room-planning, and learning features

### Node gateway/API: `apps/api`

The Node service is the web-facing orchestration layer. It is **not the primary structural solver**.

Key entry file:

- [`../apps/api/src/index.ts`](../apps/api/src/index.ts)

Key responsibilities:

- Auth bootstrapping and protection (`@clerk/express` or in-house JWT fallback)
- Security middleware: CORS, Helmet, CSRF, request IDs, rate limiting, backpressure, XSS sanitization
- User/project/session/consent/usage/audit CRUD
- Billing and payment integration routes
- Analytics ingestion
- Socket-based collaboration/user presence coordination
- Proxying / routing frontend requests to Rust or Python services through route modules

### Rust structural API: `apps/rust-api`

The Rust service is the primary high-performance compute layer for analysis/design workloads.

Key entry file:

- [`../apps/rust-api/src/main.rs`](../apps/rust-api/src/main.rs)

Key responsibilities:

- Linear and advanced structural analysis
- Design code endpoints (IS, ACI, AISC, EC, NDS, serviceability)
- Optimization flows and section auto-selection
- Fast structure CRUD for solver-owned data models
- Section/template endpoints
- Report generation endpoints for analysis/design calculations
- Shared analysis cache and performance-oriented runtime tuning

### Python backend: `apps/backend-python`

The Python service is the flexible engineering/AI/report layer. It overlaps with Rust in some engineering areas, but also owns AI-heavy and report-heavy capabilities.

Key entry file:

- [`../apps/backend-python/main.py`](../apps/backend-python/main.py)

Key responsibilities:

- Additional analysis and meshing endpoints
- Design, IS-code, and section routes
- Reports and document generation
- AI endpoints, layout generation, internal orchestration helpers
- Job routes and auxiliary collaboration/websocket routes
- Dependency health checks against Node and Rust services

### Desktop shell: `apps/desktop`

The desktop app is a Tauri shell over the web frontend, not a separate product architecture.

Key file:

- [`../apps/desktop/tauri.conf.json`](../apps/desktop/tauri.conf.json)

Desktop behavior today:

- Runs the web dev server during desktop development: `cd ../web && pnpm dev`
- Bundles the web build output for desktop packaging: `../web/dist`
- Uses Tauri as the native wrapper and installer/bundling layer

## 3. Frontend architecture (`apps/web`)

### 3.1 Entry and route composition

The application shell is built in [`../apps/web/src/App.tsx`](../apps/web/src/App.tsx). Important architectural patterns there:

- Route-level lazy loading via `React.lazy`
- `RequireAuth` wrapping for protected pages
- `ConditionalLayout` deciding whether to render `AppShell` or plain content
- Public route detection through `isPublicRoute()`
- Full-screen workspace handling through `isFullScreenRoute()`
- Route aliases for legacy paths
- Global providers and utilities including analytics, offline banner, cookie consent, and error boundaries

The route map is broad and divided across feature areas:

- Public marketing and auth pages
- Workspace/modeling pages
- Analysis pages (`/analysis/*`)
- Design pages (`/design/*`)
- Tools/utilities (`/tools/*`)
- Reports and visualization
- Civil engineering modules
- AI dashboards
- Enterprise/collaboration/integration pages

### 3.2 Navigation and route metadata

[`../apps/web/src/config/appRouteMeta.ts`](../apps/web/src/config/appRouteMeta.ts) is the route taxonomy file. It defines:

- `PUBLIC_PATHS`
- `FULL_SCREEN_PATHS`
- `APP_FEATURE_CATEGORIES`
- feature search items, labels, breadcrumbs, and category hierarchy

This file is effectively the frontend’s feature catalog and is central to:

- sidebar/navigation composition
- breadcrumb generation
- search/command palette discoverability
- classifying the app by domains such as analysis, design, tools, enterprise, reports, civil, AI, and learning

### 3.3 State, services, and composition

Key frontend architectural areas:

- [`../apps/web/src/providers`](../apps/web/src/providers) — auth, analytics, toast, cross-cutting providers
- [`../apps/web/src/store`](../apps/web/src/store) — Zustand-powered application state and persistence helpers
- [`../apps/web/src/services`](../apps/web/src/services) — business/service orchestration
- [`../apps/web/src/lib`](../apps/web/src/lib) and [`../apps/web/src/api`](../apps/web/src/api) — API client and helper layers
- [`../apps/web/src/hooks`](../apps/web/src/hooks) — custom behavior hooks for registration, device sessions, AI orchestration, analysis jobs, structural modeling, etc.
- [`../apps/web/src/components`](../apps/web/src/components) and [`../apps/web/src/pages`](../apps/web/src/pages) — UI shells and route entrypoints

### 3.4 Exact frontend integration touchpoints

The following files are the highest-value entrypoints for understanding how the frontend actually works:

| Concern | Verified file | What it does |
|---|---|---|
| app-wide route registry | [`../apps/web/src/App.tsx`](../apps/web/src/App.tsx) | Declares routes, auth wrappers, lazy-loading, shell/full-screen behavior |
| auth provider | [`../apps/web/src/providers/AuthProvider.tsx`](../apps/web/src/providers/AuthProvider.tsx) | Wraps Clerk, exposes unified auth context, token retrieval, sign-out cleanup |
| main model state | [`../apps/web/src/store/model.ts`](../apps/web/src/store/model.ts) | Core Zustand store for nodes, members, loads, combinations, analysis results, geometry tools, clipboard, modal results |
| analysis orchestration | [`../apps/web/src/services/AnalysisService.ts`](../apps/web/src/services/AnalysisService.ts) | Smart solver routing between local worker and cloud APIs, validation, polling, nonlinear requests |
| pricing config | [`../apps/web/src/config/pricing.ts`](../apps/web/src/config/pricing.ts) | Plan definitions, INR pricing, checkout plan IDs, feature bundles |
| payment entry modal | [`../apps/web/src/components/PaymentGatewaySelector.tsx`](../apps/web/src/components/PaymentGatewaySelector.tsx) | Selects Razorpay vs PhonePe and launches the chosen payment modal |
| professional report UI | [`../apps/web/src/pages/ProfessionalReportGenerator.tsx`](../apps/web/src/pages/ProfessionalReportGenerator.tsx) | Configures enterprise-style report sections and exports HTML-style report output |
| report builder engine | [`../apps/web/src/modules/reports/EngineeringReportGenerator.ts`](../apps/web/src/modules/reports/EngineeringReportGenerator.ts) | Structured report builder with sections, tables, equations, calculations, and specialized report generators |

### 3.5 User-facing feature chapters

The frontend is best understood in chapters:

1. **Public/marketing** — landing, pricing, help, legal, contact, capabilities
2. **Auth and user identity** — sign-in/sign-up, verification, locked/expired flows
3. **Dashboard and workspace** — `/stream`, `/app`, `/workspace/:moduleType`
4. **Analysis** — modal, time-history, seismic, buckling, p-delta, nonlinear, dynamic, pushover, plate-shell, optimization
5. **Design** — RC, foundation, steel, connections, reinforcement, detailing, composite, timber, design center, post-analysis hub
6. **Tools** — load combinations, section database, BBS, meshing, print/export, space planning, room planner
7. **Reports and visualization** — reports, report builder, professional reports, 3D engine, result animation
8. **Enterprise/integration** — collaboration, BIM, CAD, API dashboard, materials database, compliance
9. **AI** — AI dashboard and AI power interfaces
10. **Civil modules** — hydraulics, transportation, construction, quantity survey

For the route-level breakdown, see [`FRONTEND_ROUTE_AND_FEATURE_MAP.md`](./FRONTEND_ROUTE_AND_FEATURE_MAP.md).

### 3.6 Example frontend integration chains

#### Structural analysis flow

```text
/app or /analysis/* route
→ React page/panel in App.tsx
→ Zustand model state in store/model.ts
→ AnalysisService.ts
→ Node gateway /api/analyze or /api/advanced
→ Rust API primary solver endpoints
→ results returned to frontend state and visualization/report modules
```

#### Pricing and payment flow

```text
/pricing
→ EnhancedPricingPage.tsx
→ pricing config in config/pricing.ts
→ PaymentGatewaySelector.tsx
→ RazorpayPayment or PhonePePayment modal
→ Node billing endpoints under /api/billing/*
→ subscription state persisted in backend user/subscription models
```

#### Report flow

```text
/reports, /reports/builder, /reports/professional
→ report page component
→ EngineeringReportGenerator.ts and/or page-local report composition
→ backend report endpoints (Python and/or Rust)
→ exported engineering document shown, downloaded, or printed
```

## 4. User, auth, and session integration

### 4.1 Auth model

The frontend reads auth state through [`../apps/web/src/providers/AuthProvider.tsx`](../apps/web/src/providers/AuthProvider.tsx) and uses `RequireAuth` to guard protected routes.

On the backend, auth can be provided in two modes in [`../apps/api/src/index.ts`](../apps/api/src/index.ts):

- **Clerk mode** via `clerkMiddleware()`
- **In-house JWT mode** via `authMiddleware` and route-local `requireAuth()`

This means the user model is hybrid-capable:

- hosted identity provider support for production flows
- fallback/local auth support for self-managed or non-Clerk deployments

### 4.2 Session, user registration, and device lifecycle

In `App.tsx`, the frontend initializes:

- `useUserRegistration()`
- `useDeviceSession()`
- `useGlobalErrorHandler()`

These hooks indicate that user creation, device/session lifecycle, and global runtime error capture are frontend boot concerns rather than isolated page-level concerns.

Node route groups supporting this include:

- [`../apps/api/src/routes/authRoutes.ts`](../apps/api/src/routes/authRoutes.ts)
- [`../apps/api/src/routes/userRoutes.ts`](../apps/api/src/routes/userRoutes.ts)
- [`../apps/api/src/routes/sessionRoutes.ts`](../apps/api/src/routes/sessionRoutes.ts)
- [`../apps/api/src/routes/usageRoutes.ts`](../apps/api/src/routes/usageRoutes.ts)

### 4.3 Feature gating and pricing

Pricing is exposed publicly through `/pricing`, implemented by [`../apps/web/src/pages/EnhancedPricingPage.tsx`](../apps/web/src/pages/EnhancedPricingPage.tsx).

Gating signals exist across:

- frontend pricing/config modules
- auth tier logic in Node user/session models
- billing routes in Node

The architecture should treat feature access as a cross-cutting concern spanning UI state, backend authorization, and billing/subscription state.

## 5. API gateway and backend routing (`apps/api`)

### 5.1 What the Node API owns directly

The Node API directly owns the web-facing orchestration and CRUD surface:

- health/docs/openapi exposure
- auth flows
- project, user, session, consent, audit, analytics, usage routes
- billing/payment routes
- feedback and AI-session persistence
- socket-based collaboration helpers

Important directories:

- [`../apps/api/src/routes`](../apps/api/src/routes)
- [`../apps/api/src/middleware`](../apps/api/src/middleware)
- [`../apps/api/src/services`](../apps/api/src/services)
- [`../apps/api/src/models.ts`](../apps/api/src/models.ts)

### 5.2 What the Node API brokers to compute services

In [`../apps/api/src/index.ts`](../apps/api/src/index.ts), the following route families are mounted as separate feature routers:

- `analysis`
- `design`
- `advanced`
- `interop`
- `templates`
- `jobs`
- `ai`

These routers are the decision points where the gateway maps frontend concerns to Rust or Python runtime behavior.

Important implementation files:

| Concern | Verified file | Observed behavior |
|---|---|---|
| cross-service HTTP bridge | [`../apps/api/src/services/serviceProxy.ts`](../apps/api/src/services/serviceProxy.ts) | Provides `rustProxy()` and `pythonProxy()`, circuit breakers, retries, timeouts, and health checks |
| analysis proxy | [`../apps/api/src/routes/analysis/index.ts`](../apps/api/src/routes/analysis/index.ts) | Rust-only thin proxy, async jobs for large models, cache layer, structured error parsing |
| design proxy | [`../apps/api/src/routes/design/index.ts`](../apps/api/src/routes/design/index.ts) | Rust-first forwarding with Python fallback on supported families |

This matters because route-level code is more authoritative than comments or historical docs. In the current implementation:

- analysis is explicitly Rust-owned at the gateway layer
- design is Rust-first but Python-capable as a fallback/compatibility path
- serviceProxy centralizes HTTP-level resilience and backend connectivity

For the ownership matrix, see [`SERVICE_ROUTING_MATRIX.md`](./SERVICE_ROUTING_MATRIX.md).

### 5.3 Security and traffic control

The gateway provides cross-cutting controls not replicated in the frontend:

- CORS allowlisting
- request IDs and structured request logging
- compression
- CSRF cookies and validation
- general and route-weighted rate limiting
- backpressure for analysis/design/advanced/AI workloads
- graceful shutdown and draining

This makes Node the correct place for platform-wide traffic policy, even when the underlying work is delegated to Rust or Python.

## 6. Rust solver/design service (`apps/rust-api`)

### 6.1 Runtime and state

The Rust service starts in [`../apps/rust-api/src/main.rs`](../apps/rust-api/src/main.rs) and builds a shared `AppState` containing:

- database access
- environment/config
- `AnalysisCache`

It configures:

- Tokio runtime
- Rayon thread pool
- tracing/logging
- Sentry integration (when configured)
- request limits and CORS

### 6.2 Major endpoint families

Handler families under [`../apps/rust-api/src/handlers`](../apps/rust-api/src/handlers):

- `analysis.rs`
- `advanced.rs`
- `design.rs`
- `optimization.rs`
- `report.rs`
- `sections.rs`
- `structures.rs`
- `templates.rs`
- `health.rs`
- `metrics.rs`
- `openapi.rs`

Functional groupings:

- fast analysis endpoints (`/api/analyze*`)
- advanced analysis (`/api/advanced/*`)
- code-based design endpoints (`/api/design/*`)
- optimization (`/api/optimization/*`)
- reports (`/api/reports/*`)
- structure CRUD (`/api/structures/*`)
- public template and section data

### 6.3 Solver and code modules

Key source areas:

- [`../apps/rust-api/src/solver`](../apps/rust-api/src/solver)
- [`../apps/rust-api/src/design_codes`](../apps/rust-api/src/design_codes)
- [`../apps/rust-api/src/optimization`](../apps/rust-api/src/optimization)

The Rust service is the strongest candidate for canonical structural compute ownership because it bundles:

- advanced analysis routes
- broad design code coverage
- optimization routes
- report generation routes
- cache/performance infrastructure

## 7. Python analysis/AI/report service (`apps/backend-python`)

### 7.1 Runtime and startup shape

The Python app starts in [`../apps/backend-python/main.py`](../apps/backend-python/main.py), with:

- structured logging
- optional `.env` loading
- Sentry init when configured
- security middleware stack
- curated CORS origin assembly
- body size protection
- unified JSON error envelope format
- dependency health checks to Node and Rust

### 7.2 Router inventory

Router directory:

- [`../apps/backend-python/routers`](../apps/backend-python/routers)

Registered internal routers include:

- jobs
- meshing
- analysis
- stress/dynamic
- sections
- reports
- AI endpoints
- design
- load generation
- IS code checks
- layout and layout_v2

This makes the Python backend the most functionally broad service after the frontend, even if not every function is the system-of-record owner.

### 7.3 Python-owned strengths

The Python layer is especially important for:

- report generation and document-style output
- AI/generative features and auxiliary intelligence flows
- layout/planning engines
- meshing and engineering auxiliary services
- compatibility or fallback implementations of design/analysis logic

## 8. Data models and persistence

### 8.1 Primary persisted entities

Based on the Node and service architecture, main persisted platform entities include:

- users
- projects
- subscriptions
- session/device state
- consent/audit logs
- usage analytics
- structures
- analysis results
- report artifacts / export metadata

Important model/reference locations:

- [`../apps/api/src/models.ts`](../apps/api/src/models.ts)
- Rust database + models under [`../apps/rust-api/src/db.rs`](../apps/rust-api/src/db.rs) and [`../apps/rust-api/src/models.rs`](../apps/rust-api/src/models.rs)
- Python schemas/models under [`../apps/backend-python/models.py`](../apps/backend-python/models.py) and [`../apps/backend-python/routers/schemas.py`](../apps/backend-python/routers/schemas.py)

### 8.2 Storage layers

Platform persistence is split across:

- **MongoDB** — application data, projects, analysis outputs, subscriptions, user records
- **Redis** — traffic/rate limiting/backpressure/cache-adjacent runtime support in Docker topology
- **Browser local storage / client persistence** — local state, UI/session persistence, offline-friendly behavior
- **Desktop bundle filesystem** — only as part of Tauri packaging/runtime, not the main domain database

## 9. Reports and export pipeline

Reporting is not isolated to a single layer; it spans UI, orchestration, and compute services.

Frontend/report entry areas include:

- [`../apps/web/src/pages/ReportsPage.tsx`](../apps/web/src/pages/ReportsPage.tsx)
- [`../apps/web/src/pages/ReportBuilderPage.tsx`](../apps/web/src/pages/ReportBuilderPage.tsx)
- [`../apps/web/src/pages/ProfessionalReportGenerator.tsx`](../apps/web/src/pages/ProfessionalReportGenerator.tsx)
- report modules under [`../apps/web/src/modules`](../apps/web/src/modules)

Backend/report layers:

- Rust report endpoints in [`../apps/rust-api/src/handlers/report.rs`](../apps/rust-api/src/handlers/report.rs)
- Python report router in [`../apps/backend-python/routers/reports.py`](../apps/backend-python/routers/reports.py)

Architecture implication:

- the **frontend** owns report configuration and user flow
- the **backend services** own engineering result packaging and export generation
- there may be overlapping implementations, so this chapter should remain linked to the routing matrix and known-gap section

## 10. Payments and subscriptions

Public pricing starts at the frontend, but authoritative subscription state should be treated as backend-owned.

Key frontend payment surfaces:

- [`../apps/web/src/pages/EnhancedPricingPage.tsx`](../apps/web/src/pages/EnhancedPricingPage.tsx)
- [`../apps/web/src/config/pricing.ts`](../apps/web/src/config/pricing.ts)
- [`../apps/web/src/components/PaymentGatewaySelector.tsx`](../apps/web/src/components/PaymentGatewaySelector.tsx)
- [`../apps/web/src/components/RazorpayPayment.tsx`](../apps/web/src/components/RazorpayPayment.tsx)
- [`../apps/web/src/components/PhonePePayment.tsx`](../apps/web/src/components/PhonePePayment.tsx)

Key backend payment surfaces in Node:

- [`../apps/api/src/phonepe.ts`](../apps/api/src/phonepe.ts)
- [`../apps/api/src/razorpay.ts`](../apps/api/src/razorpay.ts)
- billing mounts in [`../apps/api/src/index.ts`](../apps/api/src/index.ts)

Observed Razorpay flow from code:

```mermaid
sequenceDiagram
        participant U as User
        participant F as apps/web payment modal
        participant N as apps/api razorpay.ts
        participant R as Razorpay
        participant DB as MongoDB

        U->>F: Choose Pro/Business plan
        F->>N: POST /api/billing/razorpay/create-order
        N->>R: Create payment order
        R-->>N: orderId + amount
        N-->>F: checkout config
        U->>R: Complete payment popup
        F->>N: POST /api/billing/razorpay/verify-payment
        N->>N: Verify HMAC signature
        N->>DB: Activate/update subscription
        R->>N: webhook callback
        N->>DB: idempotent subscription sync
```

Responsibilities by layer:

- **frontend** — present plans, pricing, upsell, and payment initiation UX
- **Node gateway** — create/verify orders, rate limit billing routes, store subscription state, enforce protected access boundaries
- **data layer** — persist user tier/subscription metadata

## 11. AI features and integrations

AI is distributed across frontend and backend layers.

Frontend AI entrypoints:

- routes `/ai-dashboard` and `/ai-power`
- components under [`../apps/web/src/components/ai`](../apps/web/src/components/ai)
- hooks under [`../apps/web/src/hooks`](../apps/web/src/hooks)

Backend AI layers:

- Node AI routes: [`../apps/api/src/routes/ai`](../apps/api/src/routes/ai)
- Python AI routes: [`../apps/backend-python/ai_routes.py`](../apps/backend-python/ai_routes.py) and [`../apps/backend-python/routers/ai_endpoints.py`](../apps/backend-python/routers/ai_endpoints.py)

Architecture implication:

- the frontend provides AI workspaces and orchestration UX
- Node governs auth/rate limiting/session persistence around AI access
- Python appears to own much of the flexible AI/generation logic

## 12. Desktop app relation to the web stack

The desktop app is a packaging layer, not a separate business logic stack.

From [`../apps/desktop/tauri.conf.json`](../apps/desktop/tauri.conf.json):

- development depends on the web app dev server
- production bundles the built web frontend
- the same React application is reused in desktop delivery

This means architecture decisions for the web frontend automatically affect the desktop product unless Tauri-specific plugins/native code are introduced later.

## 13. Deployment, environments, CI/CD, and observability

### 13.1 Build orchestration

Root-level orchestration and packaging live in:

- [`../package.json`](../package.json)
- [`../turbo.json`](../turbo.json)
- [`../pnpm-workspace.yaml`](../pnpm-workspace.yaml)

### 13.2 Container/runtime topology

The primary production-like topology is declared in [`../docker-compose.yml`](../docker-compose.yml), with:

- isolated `frontend`, `backend`, and `data` networks
- services: `web`, `api-node`, `backend-python`, `rust-api`, `mongo`, `redis`, `mongo-backup`
- health checks for each runtime
- resource limits and environment variables controlling service collaboration

### 13.3 CI/CD workflows

Workflow inventory under [`../.github/workflows`](../.github/workflows):

- `ci.yml`
- `pr.yml`
- `release.yml`
- `security.yml`
- `e2e-tests.yml`
- `lighthouse.yml`
- Azure deployment workflows

### 13.4 Observability

Observed monitoring/ops signals in entry files:

- Sentry support in Node and Python, and Rust when configured
- request logging and request IDs in Node
- tracing in Rust
- structured logging in Python
- health endpoints across runtimes

## 14. Known duplication, risks, and architecture gaps

The current codebase is powerful, but the architecture has some duplication and ambiguity that should be documented explicitly rather than hidden.

### 14.1 Key ambiguities

1. **Node vs Rust vs Python ownership is not self-evident** from the repo layout alone.
2. **Analysis/design logic overlaps** between Rust and Python in places.
3. **Reporting may be multi-home**, with both Rust and Python participating.
4. **AI spans Node and Python**, and needs a clear source-of-truth contract.
5. **Frontend route breadth is huge**, so discoverability relies heavily on route metadata and documentation.

### 14.2 Current source-of-truth assumptions used by this architecture set

Until code-level consolidation says otherwise, this documentation uses these working assumptions:

- **Frontend/UI source of truth:** `apps/web`
- **Public web/API ingress and policy source of truth:** `apps/api`
- **Primary structural compute/design source of truth:** `apps/rust-api`
- **Flexible analysis/AI/report/compatibility source of truth:** `apps/backend-python`
- **Desktop distribution source of truth:** `apps/desktop`

### 14.3 Source-of-truth decisions recorded from verified code

| Domain | Current best source of truth | Why |
|---|---|---|
| route registry and user-visible feature map | `apps/web/src/App.tsx` + `apps/web/src/config/appRouteMeta.ts` | They define actual routes, categories, breadcrumbs, and route visibility |
| auth integration | `apps/web/src/providers/AuthProvider.tsx` + `apps/api/src/middleware/authMiddleware.*` | Verified Clerk bridge on frontend and hybrid auth mode on backend |
| modeling state | `apps/web/src/store/model.ts` | Central Zustand store with geometry, loads, results, modal state, selection, and persistence hooks |
| analysis gateway behavior | `apps/api/src/routes/analysis/index.ts` | Explicitly documents Rust as canonical owner and implements the proxy/job flow |
| design gateway behavior | `apps/api/src/routes/design/index.ts` | Explicitly implements Rust-first with Python fallback |
| backend connectivity policy | `apps/api/src/services/serviceProxy.ts` | Central retries, circuit breaking, timeout, and health logic |
| pricing and plan metadata | `apps/web/src/config/pricing.ts` | Verified plan IDs, checkout IDs, feature bundles, and INR pricing |
| payment verification and subscription activation | `apps/api/src/razorpay.ts` and `apps/api/src/phonepe.ts` | Verified order creation, verification, webhook, and subscription updates |
| report builder primitives | `apps/web/src/modules/reports/EngineeringReportGenerator.ts` | Verified report builder, sections, equations, and specialized report generators |

### 14.4 Recommended follow-up decisions

- Publish an official service ownership matrix and keep it versioned
- Decide whether Rust or Python is canonical for each overlapping engineering domain
- Standardize health payload formats across runtimes
- Standardize error code envelopes where possible
- Keep this document as the front door for the architecture, not one more isolated markdown file

## 15. Where to go next

- Need endpoint ownership? Read [`SERVICE_ROUTING_MATRIX.md`](./SERVICE_ROUTING_MATRIX.md)
- Need grouped API coverage? Read [`API_SURFACE_MAP.md`](./API_SURFACE_MAP.md)
- Need folder/file discovery? Read [`REPO_ARCHITECTURE_INVENTORY.md`](./REPO_ARCHITECTURE_INVENTORY.md)
- Need frontend route mapping? Read [`FRONTEND_ROUTE_AND_FEATURE_MAP.md`](./FRONTEND_ROUTE_AND_FEATURE_MAP.md)
