# BeamLab Website Complete Specification Pack

_Last updated: 24 March 2026_

This folder is the **canonical, task-breakdown-friendly specification bundle** for the BeamLab website/platform.

It is designed so planning tools (including AWS Kiro-style task splitters) can parse the system into clear implementation chunks.

## What is covered

- Product and platform scope
- Frontend information architecture and route map
- Backend/API contract map
- Data, auth, session, and billing model
- Non-functional requirements and operations
- Ready-to-split implementation backlog with acceptance criteria

## Spec index

1. `01-system-overview-spec.md` — system boundaries, runtime ownership, key user journeys
2. `02-frontend-ia-and-routing-spec.md` — route architecture, page domains, UX shell behavior
3. `03-backend-api-contract-spec.md` — API mount matrix, endpoint families, request/response conventions
4. `04-data-auth-billing-spec.md` — data entities, auth modes, subscription/payment lifecycle
5. `05-nfr-security-ops-spec.md` — performance, security, observability, deployment requirements
6. `06-task-breakdown-spec.md` — decomposition-ready epics/features/stories with DoD and test gates

## Source of truth references used

- `docs/ARCHITECTURE.md`
- `docs/API_SURFACE_MAP.md`
- `docs/FRONTEND_ROUTE_AND_FEATURE_MAP.md`
- `docs/REPO_ARCHITECTURE_INVENTORY.md`
- `apps/web/src/App.tsx`
- `apps/web/src/app/routes/*.tsx`
- `apps/web/src/config/env.ts`
- `apps/api/src/index.ts`
- `apps/api/src/routes/**/*`
- `apps/api/src/models.ts`
- `apps/api/src/middleware/validation.ts`

## Usage guidance

- For product planning: start with `01` then `06`.
- For frontend execution: use `02` + related items in `06`.
- For backend integration: use `03` + `04`.
- For production hardening: use `05`.

## Change policy

When adding new platform capabilities, update:

- route/table in `02`
- endpoint family in `03`
- data/auth impact in `04`
- operational/security impact in `05`
- backlog decomposition in `06`
