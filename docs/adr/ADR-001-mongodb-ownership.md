# ADR-001: MongoDB Collection Ownership Model

**Status**: APPROVED  
**Date**: Apr 2, 2026  
**Author**: Platform Architecture Team  
**Related**: Item 5 (Data Governance)

---

## Problem

**Current State**:
- Single MongoDB cluster shared across Node, Python, and Rust services
- No explicit ownership enforcement
- Any service can write to any collection
- Risk of accidental data corruption, cross-service coupling, unclear accountability

**Incident Examples**:
- Rust service accidentally writes to users collection (data format mismatch)
- Python design checks modify analysis results (creates inconsistency)
- Node gateway deletes audit logs while troubleshooting (lost compliance data)

**Business Impact**:
- Data integrity risk: Undetectable corruption
- Operational friction: Debugging cross-service issues
- Compliance violation: Missing audit trails
- Scalability blocker: Cannot decompose services independently

---

## Solution

Implement explicit ownership model:

### Collection Ownership Matrix

Each collection assigned to single owner service:

| Collection | Owner | Read Access | Write Access |
|---|---|---|---|
| users | node | node, python, rust | node |
| projects | node | node, python, rust | node |
| analyses | node | node, rust, python | node |
| analysisresults | rust | node, python, rust | rust |
| designresults | python | node, python, rust | python |
| reports | node | node | node |
| billing | node | — | node |
| tierchangelogs | node | audit, node | node (append-only) |
| usagelogs | node | audit | node (append-only) |
| sections | node | — | node |
| ... | ... | ... | ... |

### Implementation Strategy

1. **Middleware Enforcement** (Express)
   - Intercept write operations (INSERT, UPDATE, DELETE)
   - Check x-service-caller header (identifies calling service)
   - Lookup target collection in WRITE_AUTHORITY matrix
   - Reject if unauthorized (403 Forbidden)
   - Log all violations for audit

2. **Application-Level Validation** (Pydantic/Zod)
   - Added type safety to requests
   - Validate request schema matches expected format
   - Implicit ownership enforcement

3. **Migration Safety**
   - Migrations tracked in _migrations collection
   - Requires ≥2 engineer approvals
   - Dry-run on staging (≥24 hours before production)
   - Rollback procedures documented

---

## Consequences

### ✅ Advantages

1. **Data Integrity**
   - Clear owner accountability
   - Prevents accidental cross-service mutations
   - Enables schema evolution independently

2. **Operational Clarity**
   - Debugging: "Which service owns this data?" → matrix lookup
   - Responsibility: "Who fixes this?" → collection owner

3. **Compliance**
   - Audit trails immutable (append-only collections)
   - Access patterns documented
   - Required for SOC 2, ISO certifications

4. **Scalability**
   - Foundation for future service decomposition
   - Enables separate databases per service (later)
   - No hidden service dependencies

### ⚠️ Trade-offs

1. **Performance**
   - Additional middleware latency: <1ms per request
   - Redis lookup for rate limiting: <2ms

2. **Operational Burden**
   - Migrations more complex (need explicit authorization)
   - Emergency fixes require bypass procedure (x-enforce-ownership: false)
   - Requires DBA involvement for schema changes

3. **Flexibility**
   - Cannot do ad-hoc cross-service mutations
   - Requires formal process for shared data updates

---

## Alternatives Considered

### 1. Separate Database per Service ❌
**Approach**: Node uses DB_NODE, Python uses DB_PYTHON, Rust uses DB_RUST

**Rejected Because**:
- Distributed transactions impossible (ACID guarantees lost)
- Replication complexity (keeping copies in sync)
- Operational burden (3x database management)

### 2. No Enforcement, Rely on Discipline ❌
**Approach**: Trust engineers not to break ownership rules

**Rejected Because**:
- Proven ineffective in incident history
- New hires don't know rules
- Difficult to enforce in code review
- No recourse when violations occur

### 3. Service Mesh (Istio) Policy Enforcement ❌
**Approach**: Use Istio AuthorizationPolicy to control MongoDB access

**Rejected Because**:
- Requires Kubernetes (not current infrastructure)
- Adds operational complexity (Istio maintenance)
- Difficult to debug (policy failures in API layer)
- Not standard for MongoDB workloads

### 4. Database-Level RBAC ❌
**Approach**: MongoDB native roles (reader, writer, admin)

**Rejected Because**:
- Cannot distinguish between Node writing to projects vs. users
- Connection pooling makes service identification hard
- Requires code changes to use separate connections per operation
- Not granular enough for collection-level enforcement

---

## Implementation Details

### Ownership Matrix (Enforced)

```typescript
const WRITE_AUTHORITY: Record<string, string[]> = {
  // Node Gateway owns user/project/reporting data
  'users': ['node'],
  'projects': ['node'],
  'analyses': ['node'],
  'reports': ['node'],
  'billing': ['node'],
  'subscriptions': ['node'],
  
  // Rust API exclusive to analysis results
  'analysisresults': ['rust'],
  'convergence_data': ['rust'],
  
  // Python API exclusive to design results
  'designresults': ['python'],
  'slab_analysis_cache': ['python'],
  
  // Audit-only (append-only)
  'tierchangelogs': ['node'],
  'usagelogs': ['node'],
  'auditlogs': ['node'],
};

const APPEND_ONLY_COLLECTIONS = new Set([
  'tierchangelogs',
  'usagelogs',
  'auditlogs',
]);
```

### Middleware Logic

```typescript
export function databaseOwnershipGuard(req: Request, res: Response, next: NextFunction) {
  // Skip for non-write operations
  if (!isWriteOperation(req)) {
    return next();
  }
  
  // Extract service caller
  const service = req.headers['x-service-caller'] || 'node';
  
  // Infer target collection from request
  const collection = inferCollection(req);
  
  // Check authorization
  if (!isAuthorized(service, collection)) {
    logger.warn({ service, collection }, 'OWNERSHIP_VIOLATION');
    return res.status(403).json({
      error: 'OWNERSHIP_VIOLATION',
      message: `Service '${service}' not authorized to write to '${collection}'`
    });
  }
  
  // For append-only collections, reject UPDATE/DELETE
  if (APPEND_ONLY_COLLECTIONS.has(collection) && 
      (req.method === 'PUT' || req.method === 'DELETE')) {
    return res.status(403).json({
      error: 'APPEND_ONLY_VIOLATION',
      message: `Collection '${collection}' is append-only`
    });
  }
  
  next();
}
```

---

## Migration Path

Phase 1 (Current): Enforcement in Node gateway only  
Phase 2: Add Python/Rust middleware for local validation  
Phase 3: Database-level RBAC (bonus: defense in depth)  
Phase 4: Separate databases per service (if needed)

---

## Governance

**Change Authority**: Architecture Review Board + Database Owner  
**Approval Process**: 
- Proposal → Review → Voting (unanimous approval for ownership changes)
- **Bypass**: Emergency-only with escalation + post-mortem

**Review Frequency**: Quarterly architecture sync + incident reviews

---

## Metrics & Monitoring

**Key Metrics**:
- Permission violations per day → trend to zero
- Migration execution time → consistent <1 hour
- Rollback frequency → trend to zero
- Data consistency score → trend to 100%

**Alerts**:
- OWNERSHIP_VIOLATION count > 10/min → page on-call
- Append-only write attempt → critical log
- Unauthorized write attempt → security team notification

---

## References

- Implementation: `/apps/api/src/middleware/databaseOwnershipGuard.ts`
- Ownership Matrix: `/ITEM5_MONGODB_OWNERSHIP_MATRIX.md`
- Migration Runbook: `/MIGRATION_GOVERNANCE_RUNBOOK.md`
- Related: ADR-003 (Contract Normalization), ADR-007 (Service Boundaries)
