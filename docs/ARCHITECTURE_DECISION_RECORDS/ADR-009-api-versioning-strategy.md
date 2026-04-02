---
Status: Proposed
Date: 2026-04-02
Context: Production Readiness & API Stability Hardening
---

# ADR-009: API Versioning Strategy & Deprecation Protocol

## Context

BeamLab's API services (Node, Python, Rust) currently expose unversioned or partially versioned endpoints:

- **Node (apps/api):** Dual routes (`/api/*` legacy + `/api/v1/*` partial)
- **Python (apps/backend-python):** Fully unversioned (`/analyze`, `/design/*`, `/ai/*`, etc.)
- **Rust (apps/rust-api):** Fully unversioned (`/api/analyze`, `/api/design/*`, etc.)

This creates risk:

1. **Contract fragility:** Clients don't know which version they're calling; breaking changes affect all consumers
2. **Deprecation blindness:** No mechanism to signal upcoming endpoint sunsets
3. **Multi-version support burden:** Unclear which versions must be maintained
4. **Gateway complexity:** Frontend can't safely determine if cached responses are still valid

## Decision

Implement a **three-phase versioning strategy**:

### Phase 1: Immediate Deprecation Signaling (2–4 weeks)

**For all unversioned routes (Node legacy, all Python, all Rust),** inject HTTP deprecation headers:

```
Deprecation: true
Sunset: <date 6 months>
Link: <https://docs.beamlabultimate.tech/api-versioning>; rel="successor-version"
X-API-Replacement: /api/v1/<endpoint> (where applicable)
```

**Implementation:**
- Node: Use existing deprecation middleware in `app.ts` for `/api/*` routes ✅
- Python: Add `DeprecationHeaderMiddleware` to all responses ✅
- Rust: Add deprecation headers in `security_headers_middleware` ✅

**Rationale:**
- Non-breaking; allows SDKs/clients to detect deprecation programmatically
- No migration required during this phase
- Gives client teams 6 months to plan migration

### Phase 2: Versioned Routes Introduction (weeks 5–12)

**Create `/api/v1/*` equivalents for all public endpoints:**

**Node:**
- Existing `/api/v1/*` routes are the canonical versioned paths
- Deprecation period for `/api/*` → End 2026-06-30
- Continue serving both paths; warn clients about sunset

**Python:**
- Introduce router prefix `/api/v1/` for all current routes
- Reuse existing route logic; mount under versioned prefix
- Deprecation period: 6 months from go-live

**Rust:**
- Introduce router prefix `/api/v1/` for all analysis/design/advanced routes
- Keep public read-only routes (`/api/sections`, `/api/metrics`, etc.) unversioned or dual-mount
- Deprecation period: 6 months from go-live

**Implementation approach:**
- No schema changes; `/v1` is purely a namespace
- Use middleware to migrate unversioned → versioned calls internally (optional, for backward compat)
- OR require clients to update endpoints (cleaner, one-time pain)

### Phase 3: Unversioned Route Freeze (Day 181)

**Sunset and remove all unversioned routes:**

- Health checks (`/health`) remain unversioned (standard practice)
- Public read-only routes (sections, templates, metrics, OpenAPI schema) may remain unversioned
- All state-changing/compute routes require `/api/v1` prefix
- Return **410 Gone** for sunset endpoints (not 404) to signal intentional removal

**Rationale:**
- Clients have had 6 months to migrate
- Unversioned endpoints removed cleanly
- No ambiguity about which version is active

---

## Alternatives Considered

### Alt 1: Instant Migration (Break All Clients)

- **Pros:** Single transition, clear cutoff
- **Cons:** Breaks production integrations, customer churn, support burden
- **Rejected:** Too disruptive

### Alt 2: No Versioning (Forever)

- **Pros:** Simpler API surface
- **Cons:** Cannot evolve safely; breaking changes block all users
- **Rejected:** Sets up future scalability issues

### Alt 3: Content Negotiation (Accept-Version Header)

- **Pros:** URL remains cleaner
- **Cons:** Harder to discover versions (clients must check docs); harder to cache
- **Rejected:** Path-based versioning is more standard & debuggable

---

## Consequences

### Positive

- **Client safety:** Unambiguous versioning; clients can opt-in to upgrades
- **Breaking change safety:** v2 can ship breaking changes; v1 remains stable
- **Debugging:** URLs and logs immediately show which version is in use
- **Cacheability:** HTTP caches can differentiate versions by path
- **Standards alignment:** Matches REST conventions (GitHub, Stripe, AWS APIs)

### Negative

- **API surface doubles during Phase 2:** Both `/api/*` and `/api/v1/*` coexist
- **Maintenance burden:** Multiple versions to support
- **Migration work:** Clients must update SDK/endpoint calls
- **Documentation duplication:** Docs must show both versions during transition

### Risks

- **Clients ignore Deprecation header:** Mitigated with 6-month sunset deadline + 410 responses
- **Version proliferation:** v1, v2, v3, ... → Mitigated by sunsetting old versions aggressively (2–3 year windows)
- **Schema drift between versions:** Mitigated by automated contract tests (`test:contracts`, snapshot tests)

---

## Implementation Steps

### Week 1–2: Phase 1 — Deprecation Headers

- [x] Node: Verify existing deprecation middleware works
- [x] Python: Add `DeprecationHeaderMiddleware`
- [x] Rust: Add deprecation headers to `security_headers_middleware`
- [ ] Deploy to staging; verify headers appear in responses
- [ ] Update API docs to reference deprecation timeline
- [ ] Announce deprecation to customers (blog post, email)

### Week 5–8: Phase 2 — Versioned Routes

- [ ] Python: Mount all routers under `/api/v1/` prefix
- [ ] Rust: Mount all routers under `/api/v1/` prefix
- [ ] Add route parity tests to verify `/api/*` ↔ `/api/v1/*` equivalence
- [ ] Update SDKs to use `/api/v1/` by default
- [ ] Deploy to production; run parity smoke tests
- [ ] Update API docs to feature `/api/v1/` prominently

### Week 12+: Phase 3 — Sunset (June 30, 2026)

- [ ] Stop serving unversioned routes; return 410 Gone
- [ ] Remove deprecated endpoint code
- [ ] Update SDKs to remove legacy path support
- [ ] Final documentation cleanup

---

## Ownership & Accountability

- **Node API (v1 routes):** API team (@dev-team)
- **Python API (versioning):** Compute team (@compute-team)
- **Rust API (versioning):** Performance team (@perf-team)
- **SDKs & Clients:** Frontend team (@frontend-team)
- **Deprecation communication:** Product team (@product-team)

---

## Related ADRs & Decisions

- **ADR-008:** OpenAPI Documentation — v1 endpoints should be documented first
- **ARCHITECTURE_REMEDIATION_PROGRAM:** Route freeze script enforces v1-only; ADR-009 codifies the strategy
- **Fitness functions:** Route parity tests validate `/api/*` ↔ `/api/v1/*` equivalence during migration

---

## Success Criteria

- [ ] All services expose `/api/v1/*` equivalents by end of Week 8
- [ ] Deprecation headers present on all unversioned endpoints
- [ ] Route parity tests pass (unversioned ↔ versioned contracts match)
- [ ] 0 customer support escalations due to versioning confusion
- [ ] SDK migration guide published and adopted by 80% of users
- [ ] Unversioned routes removed cleanly post-sunset (410 Gone responses)

---

## References

- [RFC 7231: HTTP Deprecation Header](https://www.rfc-editor.org/rfc/rfc8594)
- [REST API Versioning Best Practices](https://stackoverflow.com/questions/389169/best-practices-for-api-versioning)
- [Stripe API Versioning](https://stripe.com/docs/api/versioning) (reference implementation)
- Related code: [ARCHITECTURE_REMEDIATION_PROGRAM.md](../ARCHITECTURE_REMEDIATION_PROGRAM_2026-04-01.md)
