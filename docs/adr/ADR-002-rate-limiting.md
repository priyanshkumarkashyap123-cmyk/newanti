# ADR-002: Tiered Rate Limiting Strategy

**Status**: APPROVED  
**Date**: Apr 2, 2026  
**Author**: Platform Architecture Team  
**Related**: Item 7 (Observability & Limits)

---

## Problem

**Current State**:
- No rate limiting on any endpoint
- Free tier users can make unlimited requests
- No protection against:
  - Accidental abuse (script errors, loops)
  - Intentional DDoS
  - Fair-use violations
- Paid tiers (Pro/Ultimate) have no capacity guarantee

**Business Impact**:
- Unpredictable infrastructure costs (unlimited analysis requests)
- Cannot monetize higher tiers (no differentiation)
- Service degradation for legitimate users (noisy neighbor problem)
- Compliance risk (Razorpay quota violations if payment processing floods)

**Examples**:
- User runs analysis in loop → 10K requests/hour → Node CPU at 100%
- Bot crawls API → fills rate limiter cache → Redis memory exhausted
- Free user wants pro features → no limitation → service costs mount

---

## Solution

Tiered, Redis-backed rate limiting:

### Tier Definitions (Per Hour)

| Tier | Global | Analysis | Design Check | AI Features |
|---|---|---|---|---|
| **Free** | 100 | 30 | 50 | 0 (disabled) |
| **Pro** | 1,000 | 300 | 500 | 100 |
| **Ultimate** | 10,000 | 3,000 | 5,000 | 1,000 |
| **Internal** | ∞ | ∞ | ∞ | ∞ |

### Enforcement Method

1. **Extraction**: Get user tier from JWT token
2. **Lookup**: Redis key = `tier-rate:{tier}:user:{userId}`
3. **Increment**: Redis INCR (atomic counter)
4. **Compare**: current <= limit?
5. **Response**: 200 OK or 429 Too Many Requests

### Response (When Limited)

```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "code": "RATE_LIMITED",
  "message": "Rate limit exceeded for free tier. Maximum: 100 requests per hour.",
  "metadata": {
    "tier": "free",
    "limit": 100,
    "resetTime": "2026-04-02T21:00:00Z",
    "documentation": "https://docs.beamlab.tech/rate-limiting"
  }
}
```

---

## Consequences

### ✅ Advantages

1. **Fair-Use Protection**
   - Each user gets predictable quota
   - Prevents noisy neighbor problem
   - Protects paid tier SLOs

2. **Monetization Enabler**
   - Clear tier differentiation
   - Upsell pathway: Hit limit → upgrade to Pro
   - Predictable cost per user (tier-based)

3. **Operational Cost Control**
   - Limits expensive operations (analysis, AI)
   - Prevents runaway infrastructure cost
   - Predictable load (bounded by tier * user count)

4. **Developer Experience**
   - Explicit limits known upfront
   - Reset time communicated
   - Documentation easily accessible

### ⚠️ Trade-offs

1. **User Friction**
   - Free users will hit limits (expected)
   - Requires appeals/override process
   - Customer support burden (quota increase requests)

2. **Infrastructure**
   - Requires Redis (already present)
   - Redis failure → rate limiter unavailable
   - Fallback: in-memory limits (not distributed)

3. **Operational Complexity**
   - Per-tier configuration management
   - SLO negotiation (what limits are fair?)
   - Quota increase approval workflow

---

## Alternatives Considered

### 1. No Rate Limiting ❌
**Approach**: Unlimited requests for all users

**Rejected Because**:
- DDoS vulnerability (anyone can crash service)
- Cost unbounded (no Razorpay quota protection)
- Unfair to paying customers (paid tiers don't get isolation)

### 2. Single Rate Limit for All Tiers ❌
**Approach**: Everyone gets 1000 req/hour

**Rejected Because**:
- Free tier users unhappy (too low)
- No monetization lever (can't charge for more)
- Ultimate tier users unhappy (too low for their use case)

### 3. Compute-Unit Based Pricing ❌
**Approach**: Each endpoint costs N compute units (like AWS Lambda)

**Rejected Because**:
- Per-request calculation overhead
- Complex pricing models confuse users
- Difficult to predict cost before request

### 4. Request Signature/Throttle Queues ❌
**Approach**: Queue requests, process in order

**Rejected Because**:
- Added latency (queuing)
- Users don't get immediate feedback
- Doesn't prevent abuse (queue just gets longer)

---

## Implementation Details

### Redis Key Structure

```
tier-rate:{tier}:{granularity}:{window}:{identifier}
Example: tier-rate:free:hour:2026-04-02T21:00:00Z:user:12345
```

### Configuration

```typescript
const TIER_LIMITS_PER_HOUR = {
  free: 100,
  pro: 1000,
  ultimate: 10000,
  internal: 100000,
};

const ENDPOINT_LIMITS_PER_HOUR = {
  '/api/v1/analyze': { free: 30, pro: 300, ultimate: 3000, internal: 100000 },
  '/api/v1/advanced-analyze': { free: 10, pro: 100, ultimate: 1000, internal: 100000 },
  '/api/v1/design/check': { free: 50, pro: 500, ultimate: 5000, internal: 100000 },
  '/api/v1/projects/:id/ai-assist': { free: 0, pro: 100, ultimate: 1000, internal: 100000 },
};
```

### Failure Mode (Redis Down)

If Redis unavailable:
1. Log warning
2. Fall back to in-memory limits (single server only)
3. Allow request to proceed (degrade gracefully)
4. Alert ops to restore Redis

---

## Special Cases

### Rate Limit Appeals

**Process**:
1. User hits limit, contacts support
2. Support verifies:
   - Is tier correct? (no billing issue)
   - Is usage legitimate? (not bot-like)
   - Is there spike reason? (temporary project)
3. Options:
   - **Legitimate spike**: 24-hour exemption + monitor
   - **Sustained growth**: Suggest upgrade to Pro
   - **Bot-like**: Block and investigate

### Internal Service Calls

Services identified by x-service-caller header:
- Node → Python/Rust: bypass rate limit (internal only)
- Frontend → Node: enforce rate limit (external)

### Multi-Tenant Projections

Future: Per-project rate limits (if needed)  
Current: Per-user only

---

## Monitoring & Alerts

**Metrics**:
- Requests/sec per tier (Prometheus)
- 429 responses per minute (trend)
- Rate limit violations per user (anomaly detection)

**Alerts**:
- `alert: HighRateLimitViolations` → > 10/sec → investigate abuse
- `alert: RedisDown` → rate limiter unavailable → escalate

---

## Governance

**Configuration Ownership**: Product + Engineering  
**Change Process**:
- Proposal (product team) → Review (engineering) → A/B test (if needed) → deploy

**Review Frequency**: Monthly (after first month, then quarterly)

---

## Migration Path

Phase 1 (Current): Rate limiting in Node gateway  
Phase 2: Per-service limits (Python, Rust explicit limits)  
Phase 3: Compute-unit model (if monetization needs evolve)

---

## References

- Implementation: `/apps/api/src/middleware/tierRateLimit.ts`
- Plan: `/ITEM7_OBSERVABILITY_LIMITS_PLAN.md` (section: Task 3)
- Related: ADR-001 (Ownership), ADR-006 (SLO Targets)
