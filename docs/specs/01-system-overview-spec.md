# 01 — System Overview Specification

_Last updated: 24 March 2026_

## 1. Purpose

BeamLab is a professional structural engineering platform delivered as a web-first product with multi-runtime compute backends.

This spec defines the complete website system boundary and runtime responsibilities.

## 2. System scope

### In scope

- Public website pages (marketing, pricing, legal, support)
- Authenticated app (dashboard, modeling workspace, analysis/design tools)
- Reports, visualization, integration, and enterprise workflows
- API gateway, solver services, AI/report services, data persistence, and billing

### Out of scope

- Internal-only ad-hoc scripts not mounted in production paths
- Historical documents that are not active runtime contracts

## 3. Runtime architecture

```text
Browser (React SPA)
  -> Node API Gateway (Express)
      -> Rust API (high-performance structural compute + design)
      -> Python API (AI/report/layout/compatibility)
      -> MongoDB (domain persistence)
      -> Redis (rate-limit/cache/support infra)
```

## 4. Runtime ownership

| Runtime | Primary responsibilities |
|---|---|
| `apps/web` | UI, route orchestration, auth-aware shell, client state, user workflows |
| `apps/api` | Auth/security middleware, API ingress, orchestration, billing, user/project/session CRUD |
| `apps/rust-api` | Core analysis/design compute, optimization, high-performance engineering endpoints |
| `apps/backend-python` | AI endpoints, reporting, layout/planning, compatibility routes |
| `mongo` | users/projects/subscriptions/jobs/usage/session state |
| `redis` | distributed limit/cache support |

## 5. Product capability domains

1. **Core workspace** — model creation/editing (`/app`, `/workspace/:moduleType`)
2. **Analysis** — modal, time-history, seismic, buckling, cable, p-delta, nonlinear, pushover, plate-shell
3. **Design** — RC, steel, foundation, connection, timber, composite, geotech, detailing
4. **Reporting & visualization** — report builder, professional reports, 3D engine, result animation
5. **Enterprise/integration** — BIM, CAD, API dashboard, collaboration, digital twin
6. **Commercial** — pricing, payment, subscription, quota and usage
7. **AI and planning** — AI Architect, AI sessioning, space-planning/room-planner

## 6. Critical user journeys

### Journey A — Structural analysis run

1. User opens workspace (`/app`)
2. Builds/loads model
3. Triggers analysis flow
4. Frontend submits to Node (`/api/analyze*` or `/api/advanced*`)
5. Node validates + applies auth/rate/backpressure
6. Rust runs compute (primary path)
7. Results return to frontend state and visual/report modules

### Journey B — Design check

1. User opens design route (`/design/*`)
2. Frontend sends design payload to Node (`/api/design/*`)
3. Node validates using Zod schemas
4. Node executes Rust-first design forwarding (with Python fallback where configured)
5. Result returned with gateway envelope including selected engine

### Journey C — Subscription payment

1. User selects plan in `/pricing`
2. Checkout via Razorpay/PhonePe gateway flow
3. Node billing routes create order + verify transaction
4. Subscription persisted and linked to user
5. Frontend plan/feature gates reflect updated tier

## 7. System constraints

- Security middleware applies globally: CORS, CSRF, headers, request IDs, rate limits, XSS sanitization
- DB-readiness guard blocks DB-dependent routes until Mongo is connected
- Production env validation is strict (fatal on invalid critical settings)
- Heavy workloads are controlled with backpressure + weighted rate-limiting

## 8. Success criteria (platform-level)

- All primary routes resolve with correct auth/layout behavior
- Core analysis/design endpoints are reachable via Node ingress
- Health endpoints reflect dependency status truthfully
- Billing/auth/session/project workflows are stable under production middleware
- Documentation remains aligned with source route/endpoint registries
