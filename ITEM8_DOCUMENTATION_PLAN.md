# Item 8: Documentation & ADRs — Comprehensive Plan

**Date**: Apr 2, 2026  
**Scope**: Architecture Decision Records, runbooks, deployment guides, API documentation  
**Owner**: Architecture / Tech Lead

---

## Executive Summary

Item 8 captures architectural decisions from Items 1-7 as Architecture Decision Records (ADRs), updates core documentation, and creates operational runbooks for production support.

**Goals**:
1. **ADRs** — Document why each major decision was made (ownership model, versioning, rate limiting)
2. **Architecture Guide** — Comprehensive overview of BeamLab's system design post-hardening
3. **Operational Runbooks** — Step-by-step guides for common production tasks
4. **API Documentation** — Updated OpenAPI specs and integration guides
5. **Decision Log** — Timeline of architectural evolution

**Outcome**: Any team member can understand the system design and make consistent decisions going forward.

---

## Architecture Decision Records (ADRs)

### ADR-001: MongoDB Collection Ownership Model (Item 5)

**Status**: APPROVED  
**Date**: Apr 2, 2026

**Context**:
- Multi-service architecture (Node gateway, Python design, Rust solver)
- Single MongoDB cluster shared across all services
- Need to prevent accidental cross-service mutations and data corruption
- Previous: No ownership boundaries, any service could write anywhere

**Decision**:
Implement explicit ownership model:
- Each collection assigned to single owner service
- Ownership enforced at middleware level (Express + Pydantic validators)
- Write authority database (WRITE_AUTHORITY matrix in middleware)
- Append-only collections for immutable audit trails
- Migrations require explicit authorization

**Consequences**:
- **Positive**:
  - Prevents accidental data corruption across services
  - Clear accountability for data quality
  - Audit trails for compliance
  - Enables future service decomposition
  
- **Negative**:
  - Requires explicit authorization checks on every write
  - Migration procedures more complex (need bypass authorization)
  - Additional middleware latency (negligible: <1ms per request)

**Alternatives Considered**:
1. Separate databases per service — Rejected (operational complexity, transaction issues)
2. No explicit enforcement, rely on discipline — Rejected (proven ineffective)
3. Service mesh policy enforcement — Rejected (adds Istio dependency)

**Implementation**:
- [databaseOwnershipGuard.ts](/apps/api/src/middleware/databaseOwnershipGuard.ts) (400 lines)
- [ITEM5_MONGODB_OWNERSHIP_MATRIX.md](/ITEM5_MONGODB_OWNERSHIP_MATRIX.md) (800 lines)

**Related ADRs**: ADR-003 (Versioning), ADR-004 (Migration Safety)

---

### ADR-002: Tiered Rate Limiting Strategy (Item 7)

**Status**: APPROVED  
**Date**: Apr 2, 2026

**Context**:
- Free tier users (volume unknown) sending high-frequency requests
- Pro/Ultimate tiers paying for guaranteed capacity
- No rate limiting previously → DDoS/fair-use risk
- Need per-tier enforcement at gateway level

**Decision**:
Implement Redis-backed tiered rate limiting:
- **Free**: 100 requests/hour (1.67 req/min avg)
- **Pro**: 1,000 requests/hour (16.7 req/min avg)
- **Ultimate**: 10,000 requests/hour (167 req/min avg)
- Stricter per-endpoint limits for expensive operations:
  - Analysis: 30/300/3000 per tier
  - AI features: disabled for free, 100/1000 for pro/ultimate

**Consequences**:
- **Positive**:
  - Fair allocation across user tiers
  - Protects service from abuse
  - Monetizable feature (upgrade to higher tier)
  - Predictable burst handling
  
- **Negative**:
  - Some free tier users may hit limits (expected, part of design)
  - Requires Redis infrastructure (already present for caching)
  - Need user communication on limits (appeals process)

**Alternatives Considered**:
1. No rate limiting — Rejected (fair-use risk)
2. Single limit for all tiers — Rejected (doesn't support monetization)
3. Compute-unit based (like AWS) — Rejected (complexity, overhead)

**Implementation**:
- [tierRateLimit.ts](/apps/api/src/middleware/tierRateLimit.ts) (350 lines)
- [ITEM7_OBSERVABILITY_LIMITS_PLAN.md](/ITEM7_OBSERVABILITY_LIMITS_PLAN.md) (section: Task 3)

**Related ADRs**: ADR-005 (Quota Management), ADR-006 (SLO Targets)

---

### ADR-003: Request/Response Contract Normalization (Item 4)

**Status**: APPROVED  
**Date**: Apr 2, 2026

**Context**:
- Node API uses camelCase field naming (Zod convention)
- Python API uses snake_case (Pydantic convention)
- Cannot force consistency across frameworks
- Client (web) expects camelCase (JavaScript convention)
- Need transparent bridging at gateway

**Decision**:
Implement transparent request/response transformation at Node gateway:
- **Inbound**: camelCase → snake_case before sending to Python
- **Outbound**: snake_case → camelCase before returning to client
- Endpoint-specific handlers for complex transformations
- Generic snake_case converter for unknown endpoints

**Consequences**:
- **Positive**:
  - Client sees consistent camelCase API
  - Each service uses natural conventions
  - No changes required to existing services
  - Transformation layer isolates contract differences
  
- **Negative**:
  - Additional transformation latency (~2-5ms per request)
  - Need to maintain mapping as services evolve
  - Complexity: endpoint-specific logic needed for some requests

**Alternatives Considered**:
1. Enforce single convention (camelCase) everywhere — Rejected (existing Python codebase)
2. Dual API versions — Rejected (maintenance burden)
3. Client-side transformation — Rejected (poor UX)

**Implementation**:
- [requestNormalizer.ts](/apps/api/src/services/requestNormalizer.ts) (408 lines)
- [responseDenormalizer.ts](/apps/api/src/services/responseDenormalizer.ts) (370 lines)
- [ITEM4_CONTRACT_AUDIT.md](/ITEM4_CONTRACT_AUDIT.md) (400 lines)

**Related ADRs**: ADR-001 (Ownership), ADR-007 (Service Boundaries)

---

### ADR-004: Structured Logging & Request Tracing (Item 7)

**Status**: APPROVED  
**Date**: Apr 2, 2026

**Context**:
- Multi-service requests difficult to trace
- Mixed logging formats (text, JSON, unstructured)
- Production issues hard to diagnose without end-to-end context
- Need single request ID propagated through all services

**Decision**:
Implement W3C Trace Context standard:
- Unique X-Request-ID per user request
- Propagated from Node → Python/Rust backends
- Included in all structured logs
- JSON-formatted output for machine parsing
- Searchable via request ID across all logs

**Consequences**:
- **Positive**:
  - Single log line to find entire request flow
  - MTTR (mean time to resolution) dramatically reduced
  - Enables distributed tracing in future
  - Audit trail for compliance
  
- **Negative**:
  - Additional header in every request (~50 bytes)
  - Logging infrastructure (ELK/Datadog) required for search
  - Slight performance overhead (<1ms)

**Alternatives Considered**:
1. OpenTelemetry/Jaeger — Rejected (overkill for current scale)
2. Application-level tracing library — Rejected (too fragmented)
3. No tracing — Rejected (operability impact)

**Implementation**:
- [requestIdMiddleware.ts](/apps/api/src/middleware/security.ts) (already exists)
- [request_logger.py](/apps/backend-python/middleware/request_logger.py) (100 lines, new)
- W3C header: X-Request-ID (standard)

**Related ADRs**: ADR-002 (Rate Limiting), ADR-008 (Monitoring)

---

### ADR-005: Safe Database Migration Procedures (Item 5)

**Status**: APPROVED  
**Date**: Apr 2, 2026

**Context**:
- MongoDB schema changes needed (indexes, collections)
- Production data must never be lost
- Rollback capability required
- No blue-green deployment for database

**Decision**:
Implement formal migration procedure:
- Pre-flight checklist (code review, backup verification)
- Dry-run on staging first (≥24 hours)
- Monitored execute with success criteria
- Post-flight verification (immediate + delayed)
- 3 rollback strategies: index drop, collection drop, data restore

**Consequences**:
- **Positive**:
  - Data safety guaranteed
  - Rollback available if needed
  - Documented audit trail
  - Team confidence in production changes
  
- **Negative**:
  - Slower deployment process (2-3 hours per migration)
  - Requires DBAs and developers (not solo task)
  - Index creation may cause brief latency spikes

**Alternatives Considered**:
1. Ad-hoc migrations (current state) — Rejected (risk of data loss)
2. Automated migrations (Liquibase/Flyway) — Rejected (complicated, overkill)
3. Rename/shadow collection pattern — Rejected (complexity)

**Implementation**:
- [MIGRATION_GOVERNANCE_RUNBOOK.md](/MIGRATION_GOVERNANCE_RUNBOOK.md) (600 lines)
- Migration tracking: `_migrations` collection
- Approval process: 2+ engineers

**Related ADRs**: ADR-001 (Ownership), ADR-006 (SLO Targets)

---

### ADR-006: SLO & Alert Strategy (Item 7)

**Status**: APPROVED  
**Date**: Apr 2, 2026

**Context**:
- No defined performance targets
- Production incidents not classified by severity
- No alerting currently
- Difficult to prioritize improvements

**Decision**:
Define Service Level Objectives (SLOs):
- **Node API**: P95 < 500ms, error rate < 0.1%, availability > 99.5%
- **Python API**: P95 < 1000ms, error rate < 1%, availability > 99%
- **Rust API**: P95 < 2000ms, analysis success > 99%, availability > 99%
- **Database**: Query P95 < 100ms, replication lag < 10s
- Alert escalation: warnings (2m) → critical (1m) → PagerDuty

**Consequences**:
- **Positive**:
  - Clear performance targets
  - Data-driven scaling decisions
  - Proactive alerting prevents downtime
  - Business alignment (SLOs = revenue protection)
  
- **Negative**:
  - Monitoring infrastructure required (Prometheus, Grafana)
  - Team must respond to alerts (on-call burden)
  - May need infrastructure investment to meet targets

**Alternatives Considered**:
1. No SLOs (best-effort) — Rejected (no accountability)
2. 99.99% uptime SLO — Rejected (unrealistic for current scale)
3. SLAs with penalties — Rejected (premature for v1)

**Implementation**:
- [prometheus-rules.yml](/scripts/alerting/prometheus-rules.yml) (250 lines)
- [ITEM7_OBSERVABILITY_LIMITS_PLAN.md](/ITEM7_OBSERVABILITY_LIMITS_PLAN.md) (section: Task 4)
- Grafana dashboards (to create)

**Related ADRs**: ADR-002 (Rate Limiting), ADR-007 (Service Boundaries)

---

### ADR-007: Service Boundary & Contract Strategy

**Status**: APPROVED  
**Date**: Apr 2, 2026

**Context**:
- Multiple backend services (Node, Python, Rust)
- Need clear APIs and ownership
- Prevent accidental service coupling
- Enable independent scaling

**Decision**:
Define explicit service boundaries:
- **Node API**: Gateway, auth, projects, user management, reporting
- **Python API**: Design verification, code check, recommendations
- **Rust API**: Structural analysis, solver, optimization
- **MongoDB**: Single cluster, collection ownership enforced
- **Contract**: OpenAPI 3.0 specs, versioning via Accept: application/vnd.beamlab.v1+json

**Consequences**:
- **Positive**:
  - Clear team ownership (Node team, Design team, Solver team)
  - Enables independent releases and scaling
  - New team members understand responsibilities
  - Better fault isolation

**Negative**:
  - Cross-service coordination required for breaking changes
  - Latency between services (internal HTTP)
  - Network dependency on inter-service communication

**Alternatives Considered**:
1. Monolithic Node app — Rejected (doesn't leverage Python/Rust expertise)
2. Event-driven (Kafka) — Rejected (operational complexity)
3. GraphQL federation — Rejected (doesn't address Node/Python/Rust mismatch)

**Implementation**:
- [ITEM5_MONGODB_OWNERSHIP_MATRIX.md](/ITEM5_MONGODB_OWNERSHIP_MATRIX.md)
- [ITEM4_CONTRACT_AUDIT.md](/ITEM4_CONTRACT_AUDIT.md)
- Updated OpenAPI specs (to create in Item 8)

**Related ADRs**: ADR-001 (Ownership), ADR-003 (Contract Normalization)

---

## Supporting Documentation

### 1. Architecture Overview (`docs/ARCHITECTURE.md`)

**Current State**: Outdated, needs update  
**To Include**:
- System diagram (Node gateway → Python/Rust backend → MongoDB)
- Service responsibilities matrix
- Data flow for key user journeys (signup → create project → analyze)
- Deployment topology (Azure App Services, Static Web Apps, Container Instances)
- Technology stack (Node, Python, Rust, MongoDB, Redis, etc.)

**Lines**: ~300  
**Audience**: New team members, architects, stakeholders

### 2. API Integration Guide (`docs/API_INTEGRATION.md`)

**Current State**: Missing  
**To Include**:
- Authentication flow (Clerk JWT)
- Rate limiting (tier-based)
- Request ID tracing (X-Request-ID header)
- Error handling (response envelope, error codes)
- Versioning strategy (Accept header)
- Request/response contract examples
- Field naming conventions (camelCase)

**Lines**: ~200  
**Audience**: Integration engineers, backend developers

### 3. Operational Runbooks

#### **Runbook-001: Handle Rate Limit Appeal**

**When**: User hitting rate limit, asks for increase  
**Steps**:
1. Verify user tier (free/pro/ultimate)
2. Check typical usage patterns (last 7 days)
3. Decision tree:
   - Free tier, legitimate use → suggest Pro upgrade
   - Pro tier, spiky usage → approve temporary increase
   - Abuse pattern → block and investigate
4. If approved: Add to allowlist in rate limiter
5. Follow up: Check actual usage after 1 week

**Lines**: ~50  
**Owner**: Support + Engineering

#### **Runbook-002: Debug P95 Latency Spike**

**When**: Alert: P95 latency > 1000ms  
**Steps**:
1. Check Grafana: Which service? (Node/Python/Rust/DB)
2. Search error logs: `grep "duration_ms" logs | tail -100` (look for > 1000ms)
3. Filter by request ID to find pattern
4. Service-specific checks:
   - **Node**: Check rate limiter, check downstream services
   - **Python**: Check design check queue, check DB latency
   - **Rust**: Check solver queue depth, check kernel resource usage
   - **DB**: Check active connections, check slow query log
5. If ongoing: Scale up affected service
6. Post-mortem: Update runbook if new pattern discovered

**Lines**: ~80  
**Owner**: On-call engineer

#### **Runbook-003: Perform Safe Database Migration**

**When**: Need to add index, alter collection, etc.  
**Steps**: (Reference [MIGRATION_GOVERNANCE_RUNBOOK.md](/MIGRATION_GOVERNANCE_RUNBOOK.md))
1. Pre-flight (24 hours before):
   - Code review (2+ approvals)
   - Test on staging (24+ hours)
   - Backup verification
2. Execute (during maintenance window):
   - Run pre-exec health checks
   - Execute migration script
   - Monitor during execution
3. Post-flight (immediately + 48 hours):
   - Verify data integrity
   - Check replication lag
   - Monitor error rate

**Lines**: ~150 (reference to main runbook)  
**Owner**: DBA + Backend Lead

#### **Runbook-004: Respond to Payment Failures**

**When**: Alert: Payment failure rate > 5%  
**Steps**:
1. Check Razorpay status page (is payment gateway down?)
2. If yes: Notify users, schedule retry for later
3. If no: Check webhook logs for failures
4. Error categories:
   - **Network timeout**: Retry with backoff
   - **Invalid amount**: Check calculation logic (tier pricing)
   - **Fraud detected**: Contact Razorpay support
5. Update billing dashboard status
6. Post-mortem: Add monitoring for specific failure type

**Lines**: ~70  
**Owner**: Billing + Backend Team

### 4. Decision Log (`docs/DECISIONS.md`)

Timeline of architectural decisions:

```
2026-04-02: ADR-001 approved (MongoDB ownership model)
2026-04-02: ADR-002 approved (Tiered rate limiting)
2026-04-02: ADR-003 approved (Contract normalization)
2026-04-02: ADR-004 approved (Request tracing)
2026-04-02: ADR-005 approved (Migration procedures)
2026-04-02: ADR-006 approved (SLO targets)
2026-04-02: ADR-007 approved (Service boundaries)

2026-03-20: Item 2 approved (Node gateway restoration)
2026-03-20: Item 3 approved (CORS/Auth hardening)
```

**Lines**: ~100  
**Audience**: Architects, leads, historians

---

## Files to Create

| File | Type | Lines | Purpose |
|---|---|---|---|
| `docs/ARCHITECTURE.md` | NEW | 300 | System overview, technology stack |
| `docs/API_INTEGRATION.md` | NEW | 200 | Integration guide, contract examples |
| `docs/OPERATIONAL_RUNBOOKS.md` | NEW | 400 | All runbooks in one reference |
| `documents/ADR-001-mongodb-ownership.md` | NEW | 100 | MongoDB ownership decision |
| `documents/ADR-002-rate-limiting.md` | NEW | 100 | Rate limiting decision |
| `documents/ADR-003-contract-normalization.md` | NEW | 100 | Request normalization decision |
| `documents/ADR-004-request-tracing.md` | NEW | 100 | Request tracing decision |
| `documents/ADR-005-safe-migrations.md` | NEW | 100 | Migration procedures decision |
| `documents/ADR-006-slo-targets.md` | NEW | 100 | SLO/alerting decision |
| `documents/ADR-007-service-boundaries.md` | NEW | 100 | Service boundary decision |
| `ITEM8_DOCUMENTATION_SUMMARY.md` | NEW | 300 | Implementation summary |

**Total Lines**: ~2,000 lines  
**Total Files**: 11 new files

---

## Implementation Timeline

| Phase | Tasks | Time | Owner |
|---|---|---|---|
| **Phase 1** | Write ADRs 1-7 | 1 day | Architect |
| **Phase 2** | Update ARCHITECTURE.md + API guide | 1 day | Tech Lead |
| **Phase 3** | Create operational runbooks | 1 day | DevOps + Leads |
| **Phase 4** | Review + feedback loop | 1 day | Architecture Review |
| **Phase 5** | Finalize + publish | 0.5 day | Tech Lead |
| **Total** | | ~4.5 days | |

---

## Success Criteria

✅ **Documentation Complete**:
- [ ] All 7 ADRs written and approved
- [ ] ARCHITECTURE.md updated with current stack
- [ ] API integration guide published
- [ ] All 4 runbooks written and tested
- [ ] Decision log up to date

✅ **Team Alignment**:
- [ ] Architecture review meeting (team sign-off on ADRs)
- [ ] New team member onboarding uses docs
- [ ] On-call uses runbooks (feedback validation)
- [ ] Zero architecture questions unanswered in docs

✅ **Production Readiness**:
- [ ] Runbooks tested with volunteer on-call
- [ ] Decision log accessible to all engineers
- [ ] Runbooks linked in alert notifications
- [ ] Deployment guide updated with post-Item-8 changes

---

## References

- **ADR Template**: https://github.com/joelparkerhenderson/architecture-decision-record
- **Architecture Diagrams**: Use C4 model (Context, Container, Component, Code)
- **OpenAPI 3.0**: https://swagger.io/specification/
- **W3C Trace Context**: https://www.w3.org/TR/trace-context/
- **Operational Runbooks**: https://www.atlassian.com/incident-management/handbook/runbooks
