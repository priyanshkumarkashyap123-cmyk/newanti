# 03 — Backend API Contract Specification

_Last updated: 24 March 2026_

## 1. API architecture

Public client traffic enters through Node API (`apps/api/src/index.ts`), which mounts families under both legacy and versioned prefixes.

Pattern:

- Legacy: `/api/...`
- Versioned: `/api/v1/...`

## 2. Mounted API families (Node ingress)

| Family | Primary prefix(es) | Ownership |
|---|---|---|
| health/public | `/`, `/health`, `/api/health`, `/api/public*` | Node |
| auth | `/api/auth`, `/api/v1/auth` | Node |
| analysis | `/api/analyze*`, `/api/analysis*` | Node -> Rust |
| advanced | `/api/advanced*` | Node -> Rust |
| design | `/api/design*` | Node -> Rust-first (+ Python fallback on selected routes) |
| interop | `/api/interop*` | Node orchestration |
| templates | `/api/templates*` | Node gateway |
| jobs | `/api/jobs*`, `/api/gpu-jobs*` | Node gateway/orchestration |
| user/project/session/usage | `/api/user*`, `/api/project*`, `/api/session*`, `/api/usage*` | Node + Mongo |
| consent/audit | `/api/consent*`, `/api/audit*` | Node + Mongo |
| ai + ai sessions | `/api/ai*`, `/api/ai-sessions*` | Node -> Python and Node persistence |
| feedback/analytics | `/api/feedback*`, `/api/analytics*` | Node |
| billing/payments | `/api/billing*`, `/api/payments/razorpay*` | Node |
| metrics | `/api/metrics*`, `/api/v1/metrics*` | Node/GPU telemetry |

## 3. Analysis contracts

### Core endpoints

- `POST /api/analyze`
- `POST /api/analyze/solve`
- `POST /api/analyze/run`
- `POST /api/analyze/modal`
- `POST /api/analyze/time-history`
- `POST /api/analyze/seismic`
- `GET /api/analyze/job/:jobId`
- `GET /api/analyze/jobs`
- `POST /api/analyze/preflight`
- `POST /api/analyze/validate`

### Behavior

- authenticated-only (`requireAuth`)
- request validation via `analyzeRequestSchema`
- model-size gate by subscription tier
- cache support for synchronous solves
- quota deductions on successful runs
- async job path for large models

## 4. Advanced analysis contracts

- `POST /api/advanced/pdelta`
- `POST /api/advanced/modal`
- `POST /api/advanced/spectrum`
- `POST /api/advanced/buckling`
- `POST /api/advanced/cable`
- `GET /api/advanced/capabilities`

All advanced routes proxy to Rust advanced endpoints.

## 5. Design contracts

### Canonical route families

- `POST /api/design/steel`
- `POST /api/design/concrete/beam`
- `POST /api/design/concrete/column`
- `POST /api/design/connection`
- `POST /api/design/foundation`

### Backward-compatible aliases

- `POST /api/design/aisc`
- `POST /api/design/is800`
- `POST /api/design/steel/check`
- `POST /api/design/concrete/check`
- `POST /api/design/optimize`
- `GET /api/design/codes`

### Geotechnical contracts

- `/api/design/geotech/spt-correlation`
- `/api/design/geotech/slope/infinite`
- `/api/design/geotech/foundation/bearing-capacity`
- `/api/design/geotech/retaining-wall/stability`
- `/api/design/geotech/settlement/consolidation`
- `/api/design/geotech/liquefaction/screening`
- `/api/design/geotech/foundation/pile-axial-capacity`
- `/api/design/geotech/earth-pressure/rankine`
- `/api/design/geotech/earth-pressure/seismic`

## 6. Contract envelope conventions

### Success (gateway-wrapped design)

```json
{
  "success": true,
  "engine": "rust",
  "result": { "...": "payload" }
}
```

### Error (typical)

```json
{
  "success": false,
  "error": "human readable reason",
  "code": "OPTIONAL_MACHINE_CODE"
}
```

## 7. Validation schema groups

Request payloads are validated through `apps/api/src/middleware/validation.ts` for:

- structural model graph + loads + combinations
- analysis payloads
- advanced analysis payloads
- design (steel/concrete/connection/foundation/geotech)
- auth/session/profile
- project CRUD
- billing + consent
- AI session CRUD

## 8. Cross-cutting enforcement

All API families operate under middleware controls:

- CORS allowlist
- security headers
- CSRF cookie + verification
- global and weighted rate limiting
- backpressure for expensive lanes
- request ID injection and structured logging
- DB readiness guard for DB-backed route families

## 9. API acceptance criteria

1. Every mounted family is available at intended prefixes.
2. Validation failures return deterministic 400 envelope.
3. Rust/Python proxy failures return explicit upstream/service context.
4. Protected families reject unauthenticated access.
5. Health endpoints reflect dependency readiness state (200/503 appropriately).
