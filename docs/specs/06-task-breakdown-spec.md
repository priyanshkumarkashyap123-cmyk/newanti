# 06 — Task Breakdown Specification (Kiro-Friendly)

_Last updated: 24 March 2026_

## 1. Goal

Provide decomposition-ready tasks for full-website understanding and execution planning.

Each item below is designed to be atomic enough for automated task splitters.

## 2. Epic catalog

### Epic A — Frontend IA and route governance

**Outcome:** all pages, route ownership, and shell/auth behavior are explicitly governed.

Stories:

1. Maintain canonical route inventory from `App.tsx` + route modules.
2. Validate protected vs public route behavior.
3. Validate route metadata parity with actual routes.
4. Document route aliases and deprecations.

Acceptance criteria:

- no orphan routes without metadata intent
- no protected page exposed without `RequireAuth`
- route docs updated in same PR as route changes

---

### Epic B — API contract governance

**Outcome:** endpoint families and gateway behavior are stable and auditable.

Stories:

1. Maintain API mount matrix (`/api` + `/api/v1` parity).
2. Validate request/response envelope conventions.
3. Ensure validation schema coverage for all public payload families.
4. Maintain Rust/Python fallback policy documentation by route family.

Acceptance criteria:

- all public API families mapped to owner runtime
- all invalid payloads produce deterministic 4xx responses
- upstream failure envelopes include service context

---

### Epic C — Data/auth/session integrity

**Outcome:** identity, projects, sessions, and subscriptions remain consistent.

Stories:

1. Verify User/Project/Subscription relation integrity.
2. Verify session/device lifecycle endpoints.
3. Verify quota/tier enforcement for compute-heavy routes.
4. Verify billing state transitions and idempotency handling.

Acceptance criteria:

- no dangling references in critical user/project/subscription records
- session routes follow auth and validation constraints
- analysis quota deductions only on successful compute completion

---

### Epic D — Security and NFR hardening

**Outcome:** production safety controls are explicit and testable.

Stories:

1. Validate security middleware stack presence.
2. Validate env hardening rules in web/node.
3. Validate health/readiness semantics with dependency states.
4. Validate rate-limit/backpressure policy on heavy paths.

Acceptance criteria:

- middleware order remains compliant
- production misconfigurations fail fast
- readiness endpoints return 503 during dependency outage

---

### Epic E — Reporting, integration, and enterprise flows

**Outcome:** advanced product surfaces remain aligned with architecture docs.

Stories:

1. Map report generation flows across web/node/python/rust.
2. Map BIM/CAD/API dashboard integration endpoints.
3. Validate collaboration, analytics, and audit trails.
4. Document digital twin and planning modules integration boundaries.

Acceptance criteria:

- each enterprise/integration feature has clear backend ownership
- report/export flows specify source service and output contract

## 3. Suggested implementation order

1. Epic A (frontend route certainty)
2. Epic B (API certainty)
3. Epic C (data/auth correctness)
4. Epic D (ops/security)
5. Epic E (integration/reporting polish)

## 4. Definition of done (global)

A task is complete only when:

1. Source-of-truth docs in `docs/specs/` are updated.
2. Relevant tests/checks pass for modified layer.
3. New/changed routes/endpoints are reflected in matching spec file.
4. No contract ambiguity remains for owner runtime.

## 5. Work-item template (copy/paste)

```md
### Work Item: <title>
- Layer: frontend | node | rust | python | data | docs
- Related epic: A|B|C|D|E
- Inputs: files/routes/endpoints touched
- Change:
- Acceptance checks:
  - [ ]
  - [ ]
- Risks:
- Rollback plan:
```
