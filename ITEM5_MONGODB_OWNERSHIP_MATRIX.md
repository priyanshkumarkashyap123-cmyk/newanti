# Item 5: Data Layer Governance — MongoDB Schema Ownership Matrix

**Date Created**: Apr 2, 2026  
**Status**: In Progress  
**Scope**: Database ownership, write authorization, index optimization, and migration governance

---

## Executive Summary

BeamLab uses MongoDB as the sole persistence layer across all backend services (Node, Python, Rust). To prevent schema drift, cross-service contamination, and untracked data mutations, we establish:

1. **Clear ownership**: Which service writes to which collections
2. **Write authorization**: Validation rules before writes to prevent unauthorized mutations
3. **Index governance**: Hot path identification and performance monitoring
4. **Migration safety**: Tracked migrations with rollback capability

**Key Principle**: Services write ONLY to collections they own. Cross-service reads are allowed (with audit); cross-service writes must go through gateway (Node API) or documented APIs.

---

## Collection Ownership Matrix

| Collection | Owner Service | Access Pattern | Hot Query | Purpose | Write Authority |
|---|---|---|---|---|---|
| **users** | Node (Auth) | R/W by Node, R by Python | `email` unique | User accounts, credentials, metadata | Node only |
| **usermodels** | Node (Auth) | R/W by Node, R by Python | `clerkId` | Extended user profile (tiers, settings) | Node only |
| **refreshtokens** | Node (Auth) | W/D by Node, none other | `token` unique | Session refresh tokens | Node only |
| **verificationcodes** | Node (Auth) | W/D by Node, R by frontend | `code` unique | Email/SMS verification OTP | Node only |
| **consents** | Node (Auth) | W by Node, R by Python | `userId` | User consent records (privacy, terms) | Node only |
| **projects** | Node (Gateway) | R/W by Node, R by Python/Rust | `owner`, `createdAt` | Structural design projects | Node only |
| **collaborationinvites** | Node (Gateway) | R/W by Node | `projectId`, `inviteeId` | Project sharing invites | Node only |
| **subscriptions** | Node (Billing) | R/W by Node, R by Python | `user` unique | Subscription records (plan, tier) | Node only |
| **subscriptionledgers** | Node (Billing) | R/W by Node, R by Python | `subscriptionId` | Audit trail for tier changes | Node only |
| **paymentwebhookevents** | Node (Billing) | R/W by Node | `gateway`, `eventKey` unique | Idempotent webhook tracking | Node only |
| **usagecounters** | Node (Billing) | R/W by Node, R by Python | `subscriptionId` | Billing usage tracking | Node only |
| **legacypaymentdata** | Node (Billing) | R/W by Node (migrate-only) | `originalSubscriptionId` | Archived deprecated payment fields | Migration only |
| **tierchangelogs** | Node (Billing) | W-append by Node, R by Python | `userId`, `timestamp` | Immutable tier change history | Node append-only |
| **aisessions** | Node (Projects) | R/W by Node, R by Python | `owner`, `updatedAt` | Context for AI analysis helpers | Node only |
| **analysisjobs** | Node (Projects) | R/W by Node, R by Rust | `jobId` unique | Async analysis job tracking | Node only |
| **analysisresults** | Node (Projects) + Rust (Writer) | R/W by Rust, R by Node/Python | `projectId`, `createdAt` | Cached analysis results from Rust | Rust only |
| **reportgenerations** | Node (Reports) | R/W by Node, R by Python | `projectId`, `createdAt` | Report generation tracking | Node only |
| **devicesessions** | Node (Auth) | R/W by Node | `clerkId`, `active` | Multi-device session enforcement | Node only |
| **usagelogs** | Node (Observability) | W-append, R by Node/Python | `userId`, `clerkId` | High-frequency activity log | Node append-only |
| **quotarecords** | Node (Quota) | R/W by Node, R by Python | `userId`, `windowDate` unique | Per-user daily quota tracking | Node only |
| **gpujobidempotency** | Node (GPU Jobs) | R/W by Node | `idempotencyKey` unique | GPU job deduplication | Node only |

---

## Write Authorization Rules

### Rule 1: Gateway Write Authority
**Only the Node API (gateway) can write to user-facing collections.**

Collections: `users`, `usermodels`, `refreshtokens`, `verificationcodes`, `consents`, `projects`, `collaborationinvites`, `subscriptions`, `subscriptionledger`, `paymentwebhookevents`, `usagecounters`, `aisessions`, `analysisjobs`, `devicesessions`, `usagelogs`, `quotarecords`, `gpujobidempotency`

**Implementation**: Add middleware validation to reject writes from non-Node services.

```typescript
// apps/api/src/middleware/ownershipGuard.ts (pseudocode)
async function validateWriteAuthority(
  service: string,
  collection: string,
  operation: 'insert' | 'update' | 'delete'
) {
  const authorizedWriters: Record<string, string[]> = {
    'users': ['node'],
    'projects': ['node'],
    'analysisresults': ['rust'],
    // ...
  };
  
  const allowed = authorizedWriters[collection] || [];
  if (!allowed.includes(service)) {
    throw new UnauthorizedWriteError(
      `Service '${service}' not authorized to ${operation} in '${collection}'`
    );
  }
}
```

### Rule 2: Rust Write Authority (Analysis Results Only)
**Rust may write ONLY to `analysisresults` — no other collection.**

- Enforced via MongoDB user roles: Rust app credentials have write access to `analysisresults` only.
- Node API proxies Rust writes through its service account.
- Python reads only; no direct writes.

### Rule 3: Python Read-Only Access
**Python backend is read-only except for internal caching.**

- May read any collection via Node gateway only.
- Never write directly to MongoDB.
- Maintain local cache for performance (e.g., project metadata, user tiers).
- Invalidate cache on Node writes via pub/sub or API webhooks.

### Rule 4: Append-Only Collections
**Some collections are append-only to preserve audit trails:**

- `tierchangelogs` — Only INSERT, never UPDATE/DELETE
- `usagelogs` — Only INSERT, never UPDATE/DELETE

**Enforcement**: Schema validation + index strategy (no update queries on these).

---

## Index Audit & Optimization

### Hot Path Analysis

**High-Traffic Queries** (>100 req/sec aggregated):

1. **Auth (users lookup by email)**
   ```javascript
   // Collection: users
   // Query: { email: "user@example.com" }, unique constraint
   // Index: db.users.createIndex({ email: 1 }, { unique: true })
   // Status: ✅ Indexed
   // Estimated Queries/Day: ~10M (login, sign-up, password reset, email verification)
   ```

2. **Project listing (by owner + creation date)**
   ```javascript
   // Collection: projects
   // Query: { owner: ObjectId, createdAt: { $gte: lastWeek } }.sort({ createdAt: -1 })
   // Index: db.projects.createIndex({ owner: 1, createdAt: -1 })
   // Status: ✅ Indexed
   // Estimated Queries/Day: ~5M (dashboard, project list, recent projects)
   ```

3. **Analysis results (by project)**
   ```javascript
   // Collection: analysisresults
   // Query: { projectId: ObjectId, createdAt: { $gte: date } }.sort({ createdAt: -1 })
   // Index: db.analysisresults.createIndex({ projectId: 1, createdAt: -1 })
   // Status: ✅ Indexed
   // Estimated Queries/Day: ~2M (analysis list, result retrieval)
   ```

4. **Subscription tier lookup**
   ```javascript
   // Collection: subscriptions
   // Query: { user: ObjectId }
   // Index: db.subscriptions.createIndex({ user: 1 })
   // Status: ✅ Indexed (unique constraint)
   // Estimated Queries/Day: ~1M (auth on every request for tier enforcement)
   ```

5. **Quota record lookup (per-user, per-day)**
   ```javascript
   // Collection: quotarecords
   // Query: { userId: ObjectId, windowDate: "2026-04-02" }
   // Index: db.quotarecords.createIndex({ userId: 1, windowDate: 1 }, { unique: true })
   // Status: ✅ Indexed (compound unique)
   // Estimated Queries/Day: ~500k (every API call checks quota)
   ```

### Complete Index Registry

| Collection | Index Keys | Unique | Sparse | Status | Purpose |
|---|---|---|---|---|---|
| users | `email` | ✅ Yes | No | ✅ Indexed | Auth lookup |
| users | `clerkId` | No | No | ✅ Indexed | Clerk sync, OAuth |
| users | `subscriptionTier`, `role` | No | No | ✅ Indexed | Tier enforcement |
| users | `createdAt` desc | No | No | ✅ Indexed | User listing |
| projects | `owner`, `createdAt` desc | No | No | ✅ Indexed | Dashboard listing |
| projects | `isPublic`, `updatedAt` desc | No | No | ✅ Indexed | Public gallery browse |
| projects | `name`, `description` text | No | No | ✅ Indexed | Full-text search |
| analysisresults | `projectId`, `createdAt` desc | No | No | ✅ Indexed | Results list |
| subscriptions | `user` | ✅ Yes | No | ✅ Indexed | Tier lookup |
| subscriptions | `phonepeTransactionId` | ✅ Yes | ✅ Sparse | ✅ Indexed | Dedupe payment |
| subscriptions | `razorpayPaymentId` | ✅ Yes | ✅ Sparse | ✅ Indexed | Dedupe payment |
| quotarecords | `userId`, `windowDate` | ✅ Yes | No | ✅ Indexed | Daily quota check |
| devicesessions | `clerkId`, `active` | No | No | ✅ Indexed | Multi-device lock |
| collaborationinvites | `projectId` | No | No | ✅ Indexed | Sharing list |
| collaborationinvites | `inviteeId` | No | No | ✅ Indexed | Invitations received |
| refreshtokens | `token` | ✅ Yes | No | ✅ Indexed | Token validation |
| verificationcodes | `code` | ✅ Yes | No | ✅ Indexed | OTP lookup |
| usagecounters | `subscriptionId` | No | No | ✅ Indexed | Billing fetch |
| tierchangelogs | `userId`, `timestamp` desc | No | No | ✅ Indexed | Audit trail |
| aisessions | `owner`, `updatedAt` desc | No | No | ✅ Indexed | Session listing |

### Missing Indexes (Found During Audit)

None — all critical indexes are in place.  All indexes codified in migrations.

### Index Maintenance

- **Review Schedule**: Monthly
- **Metrics**: Query execution time, index size, cardinality
- **Tool**: MongoDB Atlas Performance Advisor (automated)

---

## Cross-Service Read Patterns

### Allowed Read Patterns

1. **Node → Rust Analysis Results**
   ```
   Node API fetches analysis results from analysisresults.
   Purpose: Return results to frontend, build reports.
   Frequency: ~1 req/sec
   Cache: 5-min TTL to reduce query load
   ```

2. **Python → User/Subscription Data**
   ```
   Python AI service reads user tiers, subscription objects to:
   - Enforce feature gates (pro-only AI helpers)
   - Validate compute unit quotas
   Purpose: Rate limiting, feature enforcement
   Frequency: ~500 req/sec (cached)
   Cache: 30-sec TTL; invalidate on Node tier change
   ```

3. **Python → Projects & Analysis Results**
   ```
   Python reads projects to enrich reports, fetch cached analysis results.
   Purpose: Report generation, context building
   Frequency: ~100 req/sec
   Cache: 10-min TTL
   ```

4. **Rust → User Subscriptions** (if needed)
   ```
   Rust reads subscriptions to enforce quota limits on compute jobs.
   Purpose: GPU resource allocation per subscription tier
   Frequency: ~50 req/sec
   Cache: 1-min TTL; fetch on cache miss only
   ```

### Cache Invalidation Strategy

Use **pub/sub or webhook events** when Node writes change critical data:

- **On subscription tier change**: Publish event to Python, Rust to invalidate user cache
- **On project write**: Publish event to Python to invalidate project metadata cache
- **On quota update**: Publish event to Python to invalidate quota cache

**Implementation Notes**:
- Kafka topic: `data-changes` with payload `{ service, collection, action, docId, timestamp }`
- Redis cache keys: `cache:collection:docId`
- TTL strategy: Aggressive (5-30 sec) for frequently-changing data; relaxed (10 min) for stable data

---

## Write Authorization Middleware

### Implementation Plan

**File**: `apps/api/src/middleware/databaseOwnershipGuard.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { connectDB } from '../models/db.js';

const WRITE_AUTHORITY: Record<string, string[]> = {
  'users': ['node'],
  'usermodels': ['node'],
  'refreshtokens': ['node'],
  'projects': ['node'],
  'analysisresults': ['rust'], // Rust has exclusive write access
  'subscriptions': ['node'],
  'tierchangelogs': ['node'], // append-only
  'usagelogs': ['node'], // append-only
  // ... define all collections
};

export async function validateDatabaseWriteAuthority(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Extract caller service from headers or JWT claims
  const service = req.headers['x-service-caller'] || 'unknown';
  
  // If this request will write to MongoDB, validate authority
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    const targetCollections = extractTargetCollections(req); // middleware helper
    
    for (const collection of targetCollections) {
      const authorized = WRITE_AUTHORITY[collection] || [];
      if (!authorized.includes(service)) {
        return res.status(403).json({
          error: 'UNAUTHORIZED_WRITE',
          message: `Service '${service}' not authorized to write to '${collection}'`,
          code: 'OWNERSHIP_VIOLATION',
        });
      }
    }
  }
  
  next();
}
```

**Deployment**:
1. Apply middleware at `apps/api/src/index.ts` before all routes
2. Add `x-service-caller` header on all internal calls (Node→Python, Node→Rust)
3. Log violations to audit trail
4. Alert on repeated violations (potential intrusion)

---

## Migration Governance

### Safe Migration Workflow

**1. Pre-flight Checks** (Before applying migration in production)
```bash
# Check migration status
npx tsx apps/api/src/migrations/runner.ts --status

# Verify database connectivity
npx tsx apps/api/src/migrations/runner.ts --health

# Dry-run migration (if supported)
npx tsx apps/api/src/migrations/runner.ts --dry-run 20260401000000_name
```

**2. Apply Migration** (In maintenance window)
```bash
# Single migration
npx tsx apps/api/src/migrations/runner.ts

# To a specific version (if needed)
npx tsx apps/api/src/migrations/runner.ts --to 20260401000000_name
```

**3. Post-Flight Verification**
```bash
# Check new migration logged
npx tsx apps/api/src/migrations/runner.ts --status

# Run smoke tests against modified collections
npm run test:migrations

# Verify index presence
npx tsx scripts/create_mongodb_indexes.ts --verify
```

**4. Rollback (If needed)**
```bash
# Safe rollback for reversible migrations
npx tsx apps/api/src/migrations/runner.ts --down 20260401000000_name

# For data-destroying migrations: restore from backup
mongorestore --drop backup/beamlab-TIMESTAMP/
```

### Migration Checklist Template

Create ticket with following before running production migration:

```markdown
## Migration: [Name]

- [ ] Migration file `YYYYMMDDHHMMSS_description.ts` reviewed by >=2 engineers
- [ ] Tested in staging environment
- [ ] Rollback plan documented
- [ ] Data backup taken (point-in-time: TIMESTAMP)
- [ ] Maintenance window scheduled (date/time)
- [ ] Alert rules configured (index creation latency, replica lag)
- [ ] Post-flight manual verification script prepared
- [ ] Runbook link: [url]

**Expected Impact**:
- Duration: [X minutes]
- Availability: [no interruption / read-only / downtime]
- Estimated document count affected: [N]
- Index size impact: [+/-X GB]

**Approval**: 
- [ ] DB Owner
- [ ] Product Lead
```

### Migration Registry (Current)

| File | Description | Status | Rollback |
|---|---|---|---|
| `20250101000000_add_indexes` | Create baseline indexes (users, projects, tokens) | ✅ Applied | ✅ Yes (drop indexes) |
| `20260302000000_add_master_db_collections` | Create device sessions, analysis results, reports, usage logs collections | ✅ Applied | ✅ Yes (drop collections) |
| `20260316000000_add_quota_and_collaboration` | Create quota_records and collaboration_invites | ✅ Applied | ✅ Yes (drop collections) |
| `20260317010000_harden_billing_idempotency` | Add webhook event lock collection, unique transaction indexes | ✅ Applied | ✅ Yes (drop indexes) |

---

## Service Isolation Boundaries

### Network Boundaries (Recommended)

- **Node API**: Public ingress (Azure App Service, HTTPS public)
- **Python API**: Private (Azure Private VNet, no inbound from internet)
- **Rust API**: Private (Azure Private VNet, no inbound from internet)
- **MongoDB**: Private (no inbound from internet, only from VNet)

### Application-Level Boundaries

1. **Database Credentials Segregation** (MongoDB RBAC)
   ```javascript
   // Pseudo-config
   db.createUser({
     user: 'node-app',
     password: '...',
     roles: [
       { role: 'readWrite', db: 'beamlab' }, // full RW
     ]
   });
   
   db.createUser({
     user: 'rust-app',
     password: '...',
     roles: [
       { role: 'read', db: 'beamlab' }, // read-only except...
       // Custom role: write only to analysisresults
     ]
   });
   
   db.createUser({
     user: 'python-app',
     password: '...',
     roles: [
       { role: 'read', db: 'beamlab' }, // read-only
     ]
   });
   ```

2. **API Gateway Write Control**
   - All external writes go through Node API
   - Python/Rust call Node APIs for mutations
   - Direct database access is deployment-time only (migrations)

---

## Compliance & Auditing

### Audit Trail Requirements

1. **Track all writes**: Log who wrote what, when
2. **Immutable collections**: Some collections are append-only (see Rule 4)
3. **Change detection**: Index on timestamps to quickly find recent changes
4. **Tier change immutability**: `tierchangelogs` is never updated; only appended

### Audit Query Examples

```javascript
// Find all user tier changes in the past week
db.tierchangelogs.find({
  timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
}).sort({ timestamp: -1 });

// Find all projects modified today by a specific user
db.projects.find({
  owner: ObjectId("..."),
  updatedAt: { $gte: today() }
}).sort({ updatedAt: -1 });

// Find all payment webhook events processed in the past hour
db.paymentwebhookevents.find({
  createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
}).count();
```

---

## Next Steps

1. **✅ Ownership Matrix Created** (this document)
2. **⏳ Ownership Validation Middleware** — Implement `databaseOwnershipGuard.ts`
3. **⏳ Cross-Service Cache Invalidation** — Set up pub/sub (Kafka/Redis)
4. **⏳ MongoDB RBAC Setup** — Apply user roles per service
5. **⏳ Monitoring & Alerting** — Track ownership violations, index health
6. **⏳ Documentation Update** — Add to `docs/ARCHITECTURE.md`

---

## References

- Migration system: `apps/api/src/migrations/runner.ts`
- Index creation: `scripts/create_mongodb_indexes.ts`
- Model definitions: `apps/api/src/models/*.ts`
- Current database config: `apps/api/src/config/env.ts`
