# Item 7: Observability & Limits — Comprehensive Plan

**Date**: Apr 2, 2026  
**Scope**: Request ID propagation, structured logging, rate limiting enforcement, SLO/alert setup  
**Owner**: Platform / Observability Team

---

## Executive Summary

Item 7 establishes end-to-end visibility and operational limits:

1. **Request Tracing** — Unique ID per request, propagated across Node → Rust/Python → Logs
2. **Structured Logging** — JSON-formatted logs with request ID, service, duration, error context
3. **Rate Limiting** — Per-tier enforcement at gateway with shared Redis keyspace
4. **SLOs & Alerts** — Latency targets (p95 < 500ms), error rate (<0.1%), auto-escalation
5. **Monitoring** — Real-time dashboards, health metrics, cost tracking

**Goal**: Every production issue traceable to root cause within minutes; proactive alerts prevent downtime.

---

## Architecture Overview

### Request Tracing Flow

```
User Request (Browser)
  ↓ (generates X-Request-ID)
Node API Gateway
  ├─ Log: [REQUEST_START] id=abc123, user=u1, path=/api/v1/analyze, duration_ms=0
  ├─ Route to Rust/Python
  │  ├─ Add header: x-request-id: abc123
  │  ├─ Rust receives → logs with id=abc123
  │  └─ Python receives → logs with id=abc123
  ├─ Wait for response
  │  ├─ Rust logs: [ANALYSIS_RESULT] id=abc123, elapsed_ms=5000, status=success
  │  └─ Python logs: [DESIGN_CHECK] id=abc123, elapsed_ms=2000, status=success
  └─ Return to client
     └─ Log: [REQUEST_END] id=abc123, total_ms=7100, status=200
```

**Result**: Single request visible in all 3 backends' logs via search: `id=abc123`

### Rate Limiting Architecture

```
User Request → Node API
  ├─ Extract tier from JWT (free, pro, ultimate)
  ├─ Check rate limit
  │  ├─ Lookup: redis.incr("rate:tier:pro:2024-04-02:12:00", 1)
  │  ├─ Compare: current < limit
  │  └─ If limit reached → 429 Too Many Requests
  └─ Forward to backend if OK

Tier Limits (per hour):
  ├─ Free:      100 requests/hour
  ├─ Pro:     1,000 requests/hour
  └─ Ultimate: 10,000 requests/hour
```

### Monitoring Dashboard

```
Real-Time Metrics:
  ├─ Request Rate (req/sec by service)
  ├─ Latency (p50, p95, p99)
  ├─ Error Rate (% by status code)
  ├─ Active Connections (Node, Python, Rust)
  └─ Cost Metrics (Compute Units used)

Alerting:
  ├─ P95 Latency > 1000ms → warning
  ├─ Error Rate > 5% → critical
  ├─ Service down (3 failed health checks) → page on-call
  └─ Quota exceeded → stop processing
```

---

## Task 1: Request ID Propagation

### 1.1 Node API Middleware (Already Exists ✅)

**File**: `apps/api/src/middleware/security.ts`

Current implementation:
```typescript
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  // ... attach to req, res, logs
};
```

**Status**: ✅ Already generates unique ID per request

### 1.2 Propagate to Rust/Python Services (NEW)

**File**: `apps/api/src/services/serviceProxy.ts` (MODIFY)

```typescript
// In proxyRequest() function:
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'x-request-id': options.requestId || '', // Propagate request ID to backends
  'x-service-caller': 'node',
  ...getInternalServiceHeaders(requestId),
};
```

**What to add**:
- Extract `requestId` from context
- Include in headers to Rust/Python
- Both backends extract and use in own logs

### 1.3 Python Logging Middleware (NEW)

**File**: `apps/backend-python/middleware/request_logger.py` (NEW)

```python
from fastapi import Request, Response
from uuid import uuid4
import logging
import time

logger = logging.getLogger(__name__)

async def request_id_middleware(request: Request, call_next):
    """Extract or generate request ID, attach to context."""
    # Get from header or generate
    request_id = request.headers.get('x-request-id', str(uuid4()))
    
    # Attach to request for downstream logging
    request.scope['request_id'] = request_id
    
    # Log request start
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    
    # Log request end with ID
    logger.info(f"[REQUEST_END] id={request_id} path={request.url.path} "
                f"status={response.status_code} duration_ms={duration_ms:.1f}")
    
    return response
```

**File**: `apps/backend-python/main.py` (MODIFY)

```python
from middleware.request_logger import request_id_middleware

app = FastAPI()
app.add_middleware(request_id_middleware)  # Add early in middleware stack
```

### 1.4 Rust Logging Integration (NEW)

**File**: `apps/rust-api/src/middleware.rs` (MODIFY)

```rust
use axum::extract::ConnectInfo;
use uuid::Uuid;
use std::net::SocketAddr;

pub async fn request_id_middleware<B>(
    req: Request<B>,
    next: Next,
) -> Response {
    // Extract from header or generate
    let request_id = req
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    
    // Attach to request state
    let mut req = req;
    req.extensions_mut().insert(request_id.clone());
    
    // Log request
    logger::info!("[REQUEST] id={} path=/api/v1/{}", request_id, path);
    
    let response = next.run(req).await;
    
    // Log response
    logger::info!("[RESPONSE] id={} status={}", request_id, response.status());
    
    response
}
```

---

## Task 2: Structured Logging Standards

### 2.1 Logging Format

All services should use JSON structured logging:

```json
{
  "timestamp": "2026-04-02T20:30:45.123Z",
  "level": "INFO",
  "service": "node-api",
  "request_id": "abc123def456",
  "user_id": "user_12345",
  "action": "ANALYSIS_SUBMITTED",
  "path": "/api/v1/analyze",
  "method": "POST",
  "status_code": 200,
  "duration_ms": 5234,
  "message": "Analysis submitted successfully",
  "error": null,
  "stack_trace": null,
  "context": {
    "project_id": "proj_789",
    "analysis_type": "2d_frame",
    "compute_units": 10
  }
}
```

### 2.2 Node API Logging Pattern

**File**: `apps/api/src/utils/logger.ts` (ALREADY USES PINO ✅)

Current implementation:
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: { target: 'pino-pretty' }, // Pretty in dev, JSON in prod
});

logger.info({ requestId, userId, path, duration }, 'Request completed');
```

**Enhancement needed**: Ensure all logs include `requestId`

### 2.3 Python Logging Standard

**File**: `apps/backend-python/logging_config.py` (NEW)

```python
import logging
import json
from datetime import datetime
import sys

class JSONFormatter(logging.Formatter):
    """Format logs as JSON for structured logging."""
    
    def format(self, record):
        log_data = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'service': 'python-api',
            'request_id': getattr(record, 'request_id', None),
            'message': record.getMessage(),
            'path': getattr(record, 'path', None),
        }
        
        if record.exc_info:
            log_data['error'] = str(record.exc_info[1])
            log_data['stack_trace'] = self.formatException(record.exc_info)
        
        return json.dumps(log_data)

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger()
for handler in logger.handlers:
    handler.setFormatter(JSONFormatter())
```

### 2.4 Rust Logging Standard

Use `tracing` crate for structured logging:

```toml
# Cargo.toml
[dependencies]
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["json"] }
```

**File**: `apps/rust-api/src/main.rs`

```rust
use tracing_subscriber::fmt;

fn init_logging() {
    fmt()
        .json()
        .with_target(true)
        .with_level(true)
        .with_thread_ids(true)
        .init();
}

#[tokio::main]
async fn main() {
    init_logging();
    tracing::info!(service = "rust-api", "Starting server");
    // ...
}
```

---

## Task 3: Rate Limiting Enforcement

### 3.1 Rate Limit Middleware (Already Exists ✅)

**File**: `apps/api/src/middleware/security.ts`

Current implementation:
```typescript
export const generalRateLimit = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate:',
  }),
  windowMs: 60 * 1000,      // 1 minute
  max: 60,                  // 60 req/min default
  keyGenerator: (req) => {
    // Use user ID if authenticated, IP otherwise
    return req.user?.id || req.ip;
  },
});
```

**Enhancement**: Per-tier rate limits

### 3.2 Tier-Based Rate Limiting (NEW)

**File**: `apps/api/src/middleware/tierRateLimit.ts` (NEW)

```typescript
import { rateLimit, RateLimitRequestWildcard } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../cache/index.js';

// Tier-specific limits (per hour)
const TIER_LIMITS = {
  free: 100,      // 100 req/hour
  pro: 1000,      // 1,000 req/hour
  ultimate: 10000, // 10,000 req/hour
};

/**
 * Create tier-aware rate limiter.
 * Enforces per-tier, per-hour limits using Redis.
 */
export const tierRateLimit = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'tier-rate:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  
  // Dynamic max based on user tier
  max: (req, res) => {
    const tier = req.user?.tier || 'free';
    return TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;
  },
  
  // Use user ID as key (not IP) for authenticated users
  keyGenerator: (req) => {
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    // Anonymous users rate-limited by IP
    return `ip:${req.ip}`;
  },
  
  // Custom 429 response
  handler: (req, res) => {
    const tier = req.user?.tier || 'free';
    const limit = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.free;
    
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      code: 'RATE_LIMITED',
      message: `Rate limit exceeded. Maximum: ${limit} requests per hour for ${tier} tier.`,
      limit,
      current: req.rateLimit?.current,
      resetTime: new Date(req.rateLimit?.resetTime || 0).toISOString(),
    });
  },
});

/**
 * Export per-endpoint rate limiters for stricter control.
 */
export const analysisRateLimit = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'analysis-rate:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req) => {
    const tier = req.user?.tier || 'free';
    // Analysis is more expensive; lower limits
    return [30, 300, 3000][['free', 'pro', 'ultimate'].indexOf(tier)] || 30;
  },
  keyGenerator: (req) => req.user?.id || req.ip,
});

export const aiRateLimit = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'ai-rate:',
  }),
  windowMs: 60 * 60 * 1000,
  max: (req) => {
    const tier = req.user?.tier || 'free';
    // AI features only for pro/ultimate
    return tier === 'free' ? 0 : [100, 1000][['pro', 'ultimate'].indexOf(tier)];
  },
  keyGenerator: (req) => req.user?.id || req.ip,
});
```

### 3.3 Apply Rate Limits to Routes

**File**: `apps/api/src/routes/index.ts` (MODIFY)

```typescript
import { tierRateLimit, analysisRateLimit, aiRateLimit } from '../middleware/tierRateLimit.js';

// Apply tier-based limit to all analysis endpoints
router.post('/api/v1/analyze', tierRateLimit, analysisRateLimit, analyzeHandler);
router.post('/api/v1/advanced-analyze', tierRateLimit, analysisRateLimit, advancedAnalyzeHandler);

// Apply AI rate limit to AI-specific endpoints
router.post('/api/v1/projects/:id/ai-assist', tierRateLimit, aiRateLimit, aiAssistHandler);
router.post('/api/v1/projects/:id/layout-optimize', tierRateLimit, aiRateLimit, layoutOptimizeHandler);
```

---

## Task 4: SLOs & Alerts

### 4.1 SLO Definitions

| Service | Metric | Target | Alert Threshold | Impact |
|---|---|---|---|---|
| **Node API** | P95 Latency | < 500 ms | > 1000 ms | Page on-call |
| **Node API** | Error Rate | < 0.1% | > 5% | Page on-call |
| **Node API** | Availability | > 99.5% | < 99% | Page on-call |
| **Python API** | P95 Latency | < 1000 ms | > 2000 ms | Warning |
| **python API** | Error Rate | < 1% | > 10% | Critical |
| **Rust API** | P95 Latency | < 2000 ms | > 3000 ms | Warning |
| **Rust API** | Analysis Success | > 99% | < 95% | Critical |
| **Frontend** | P95 Latency | < 500 ms | > 1000 ms | Warning |
| **MongoDB** | Query P95 | < 100 ms | > 500 ms | Warning |

### 4.2 Monitoring Dashboard (Grafana)

**Panels to create**:

1. **Overall Health**
   - Status lights for each service (🟢 healthy, 🟡 degraded, 🔴 down)
   - Last deploy time
   - Current error rate

2. **Request Flow**
   - Requests per second (by service)
   - Latency heatmap (p50, p95, p99)
   - Error rate by status code

3. **Service Detail**
   - Node API: Active connections, token validations/sec, database latency
   - Python API: Design checks/sec, AI features/sec
   - Rust API: Analyses/sec, solver latency distribution
   - Database: Query latency, connections, replication lag

4. **Cost Tracking**
   - Compute units consumed per hour
   - Cost by analysis type (2D frame, 3D model, etc.)
   - Projection to next billing cycle

### 4.3 Alert Rules (Prometheus)

**File**: `scripts/alerting/prometheus-rules.yml` (NEW)

```yaml
groups:
  - name: beamlab-alerts
    interval: 30s
    rules:
      # Node API latency alert
      - alert: HighNodeLatency
        expr: |
          histogram_quantile(0.95, 
            rate(http_request_duration_seconds_bucket{service="node"}[5m])
          ) > 1
        for: 2m
        annotations:
          summary: "Node API P95 latency high ({{ $value }}s)"
          action: "Check application logs, check database performance"
      
      # Error rate alert
      - alert: HighErrorRate
        expr: |
          (rate(http_requests_total{status=~"5.."}[5m]) / 
           rate(http_requests_total[5m])) > 0.05
        for: 1m
        annotations:
          summary: "Error rate > 5% ({{ $value | humanizePercentage }})"
          action: "Page on-call, check error logs"
      
      # Service down alert
      - alert: ServiceDown
        expr: |
          up{service=~"node|python|rust"} == 0
        for: 1m
        annotations:
          summary: "{{ $labels.service }} service is down"
          action: "Check service health, restart if needed"
      
      # Database latency alert
      - alert: HighDatabaseLatency
        expr: |
          histogram_quantile(0.95, 
            rate(mongodb_query_duration_seconds_bucket[5m])
          ) > 0.5
        for: 2m
        annotations:
          summary: "Database query latency high"
          action: "Check database load, review slow queries"
```

---

## Task 5: Tracing & Correlation

### 5.1 Distributed Tracing Setup (Optional — Future)

For production visibility, consider OpenTelemetry:

```typescript
// apps/api/src/telemetry.ts (Future)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

**Note**: Implement in Item 9 (final integration) if needed.

---

## Implementation Roadmap

| Phase | Tasks | Timeline | Owner |
|---|---|---|---|
| **Phase 1** | Request ID propagation to backends | 1 day | Platform |
| **Phase 2** | Structured logging in all 3 services | 2 days | DevOps |
| **Phase 3** | Tier-based rate limiting | 1 day | Backend |
| **Phase 4** | SLO definitions + alerting rules | 2 days | Platform |
| **Phase 5** | Monitoring dashboards (Grafana) | 2 days | Platform |
| **Total** | | ~1 week | Mixed team |

---

## Testing & Validation

### Test Scenario 1: Request Tracing

1. Submit analysis request with curl
2. Capture X-Request-ID from response
3. Search logs in all 3 services for that ID
4. Verify complete request path visible

```bash
# Generate request
REQUEST_ID=$(curl -s https://api.beamlab.test/api/v1/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nodes":[...]}' | jq -r '.request_id')

# Search logs
echo "Node logs:"
grep "id=$REQUEST_ID" node-api.log

echo "Python logs:"
grep "id=$REQUEST_ID" python-api.log

echo "Rust logs:"
grep "id=$REQUEST_ID" rust-api.log
```

### Test Scenario 2: Rate Limiting

1. Submit 101 requests as free tier user
2. 101st request should return 429 Too Many Requests
3. Response includes reset time

```bash
for i in {1..101}; do
  curl -s https://api.beamlab.test/api/v1/analyze \
    -H "Authorization: Bearer $FREE_TIER_TOKEN" \
    -w "\n%{http_code}\n"
done | tail -5
# Expected final codes: 429, 429, 429
```

### Test Scenario 3: Monitoring Data

1. Run parity pack (generates traffic)
2. Check Grafana dashboard
3. Verify metrics visible:
   - Request rate spike
   - Latency distribution
   - Error rate (should be 0)

---

## Files to Create/Modify

| File | Type | Lines | Purpose |
|---|---|---|---|
| `apps/api/src/services/serviceProxy.ts` | MODIFY | +5 | Add x-request-id header |
| `apps/backend-python/middleware/request_logger.py` | NEW | 30 | Python request ID middleware |
| `apps/backend-python/logging_config.py` | NEW | 40 | Python structured logging |
| `apps/api/src/middleware/tierRateLimit.ts` | NEW | 100 | Tier-aware rate limiting |
| `scripts/alerting/prometheus-rules.yml` | NEW | 60 | Prometheus alert rules |
| `docs/observability/MONITORING_GUIDE.md` | NEW | 200 | Monitoring runbook |

**Total New Code**: ~400 lines

---

## References

- Pino logger docs: https://getpino.io/
- rate-limit-redis: https://github.com/wyattjoh/rate-limit-redis
- Prometheus alerting: https://prometheus.io/docs/alerting/latest/overview/
- Grafana dashboards: https://grafana.com/docs/grafana/latest/dashboards/
