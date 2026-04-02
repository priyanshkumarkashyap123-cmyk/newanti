# Item 9: Execution Quick Start Guide

## 🚀 Quick Launch

```bash
# Run test execution script (interactive, full report)
./scripts/test-execution.sh https://staging.beamlabultimate.tech

# With debug output
./scripts/test-execution.sh https://staging.beamlabultimate.tech true
```

**Estimated Duration**: 8-9 hours  
**Test Date**: April 3, 2026  
**Test Environment**: Azure staging infrastructure

---

## 📋 8-Phase Test Breakdown

| Phase | Duration | What's Tested | Owner | Status |
|-------|----------|---------------|-------|--------|
| **1** | 1 hour | Environment setup (Items 1-2 health) | DevOps | Automated |
| **2** | 1.5 hrs | Smoke tests (health-checks.sh + parity-pack.sh) | QA | Automated |
| **3** | 30 min | Contract normalization (camelCase ↔ snake_case) | Backend | Semi-automated |
| **4** | 30 min | Ownership enforcement (write authorization) | Security | Manual logs |
| **5** | 45 min | Rate limiting (tier enforcement) | DevOps | Load test needed |
| **6** | 45 min | Observability (request tracing + logging) | DevOps | Manual logs |
| **7** | 30 min | Documentation (ADRs + architecture) | Tech Lead | Automated |
| **8** | 2 hours | E2E integration (full user journey) | QA | Manual E2E |
| **Load** | 1 hour | Load test (100 users, P95 < 1000ms) | Performance | k6 script |

---

## ✅ Pre-Test Checklist

Before running tests, verify:

- [ ] Staging environment deployed with all Items 1-8
- [ ] MongoDB Atlas staging cluster healthy and backup verified
- [ ] Azure services running (Node App Service, Python App Service, Rust Container)
- [ ] GitHub repository secrets synced (AZURE_* tokens)
- [ ] Test user pool created (test-*.beamlab.test email domain)
- [ ] Monitoring dashboards active (Prometheus + Grafana)
- [ ] On-call team notified
- [ ] Rollback procedures reviewed with DevOps

---

## 📊 Expected Results

### Phase Outcomes

**Phase 1**: All services responding (HTTP 200)  
**Phase 2**: health-checks.sh ✅, parity-pack.sh ✅ (7/7)  
**Phase 3**: Request accepts camelCase, response returns camelCase  
**Phase 4**: Zero ownership violations in logs (`OWNERSHIP_VIOLATION: 0`)  
**Phase 5**: Rate limiting headers present, 429 on tier overflow  
**Phase 6**: Request ID in all service logs, structured JSON format  
**Phase 7**: All ADR files present, ARCHITECTURE.md complete  
**Phase 8**: Complete user journey succeeds without errors  
**Load Test**: P95 latency < 1000ms, error rate < 5%

### Production Sign-Off Gate (9-Item Checklist)

```
✅ Item 1: Health assessment documented + auto-checks passing
✅ Item 2: Node gateway stable, no 503 errors
✅ Item 3: CORS/Auth hardened (wildcard removed, origin validation)
✅ Item 4: Contract transformation transparent (camelCase ↔ snake_case)
✅ Item 5: Write authorization enforced (no cross-service contamination)
✅ Item 6: Smoke test scripts executable and passing
✅ Item 7: Rate limiting + request tracing + alerts active
✅ Item 8: 3 ADRs complete + architecture guide published
✅ Item 9: 8-phase test passed + load test met SLOs
```

**Gate Status**: Ready for production ✅ (when all 9 checked)

---

## 🔧 Running Individual Phases

If you need to run a single phase:

```bash
# Phase 1: Environment setup
./scripts/test-execution.sh | grep -A 50 "PHASE 1"

# Phase 2: Smoke tests
bash ./scripts/smoke-tests/health-checks.sh
BASE_URL=https://staging.beamlabultimate.tech bash ./scripts/smoke-tests/parity-pack.sh

# Phase 7: Documentation check
ls -lh docs/adr/ADR-*.md docs/ARCHITECTURE.md

# Phase 8: Manual E2E test
# See ITEM9_FINAL_INTEGRATION_TEST_PLAN.md for detailed E2E scenarios
```

---

## 📁 Key Files Referenced in Tests

| File | Purpose | Items |
|------|---------|-------|
| `scripts/smoke-tests/health-checks.sh` | 20-30s service health check | 1, 2, 3 |
| `scripts/smoke-tests/parity-pack.sh` | 7 critical flow validation | 2, 3, 4, 5 |
| `scripts/validate-deploy-env.sh` | Pre-deploy environment validation | 6 |
| `docs/adr/ADR-001-mongodb-ownership.md` | Ownership decision record | 5 |
| `docs/adr/ADR-002-rate-limiting.md` | Rate limiting strategy | 7 |
| `docs/adr/ADR-003-contract-normalization.md` | Contract transformation | 4 |
| `docs/ARCHITECTURE.md` | System architecture overview | 1-8 |
| `apps/api/src/middleware/tierRateLimit.ts` | Rate limiting middleware | 7 |
| `apps/api/src/middleware/databaseOwnershipGuard.ts` | Ownership enforcement | 5 |
| `ITEM9_FINAL_INTEGRATION_TEST_PLAN.md` | Detailed test scenarios | 9 |

---

## 🚨 Critical Paths (Manual Testing)

These require hands-on validation:

### Phase 4 - Ownership Verification
```bash
# Check Azure Log Analytics for ownership violations
az monitor log-analytics workspace query \
  --resource-group beamlab-staging \
  --workspace-name beamlab-logs \
  --analytics-query "
    customLogs
    | where service_s == 'node-api'
    | where action_s == 'OWNERSHIP_VIOLATION'
    | count
  "
# Expected: 0 violations
```

### Phase 5 - Rate Limit Load Test
```bash
# Install k6 first:
brew install k6   # macOS
# or: npm install -g k6

# Run load test (requires k6 script, see ITEM9_FINAL_INTEGRATION_TEST_PLAN.md)
k6 run tests/load-test.js --stage 2m:0 --stage 8m:100

# Verify metrics
# - P95 latency < 1000ms
# - Error rate < 5%
# - Request IDs present
```

### Phase 6 - Request Tracing
```bash
# Check that all requests have X-Request-ID
curl -i https://staging.beamlabultimate.tech/health 2>/dev/null | grep -i "x-request-id"

# Expected format: x-request-id: 550e8400-e29b-41d4-a716-446655440000
```

### Phase 8 - E2E User Journey
See **ITEM9_FINAL_INTEGRATION_TEST_PLAN.md** sections:
- E2E Scenario 1: Complete User Journey (40 steps)
- E2E Scenario 2: Rate Limiting Behavior (20 steps)
- E2E Scenario 3: Request Tracing (12 steps)
- E2E Scenario 4: Ownership Compliance (15 steps)

---

## 📝 Results & Reporting

Test script generates: `test-results-YYYYMMDD-HHMMSS.json`

Example result entry:
```json
{
  "phase": "Phase 2",
  "test": "Health checks",
  "status": "PASS",
  "details": "All 4 services responding",
  "timestamp": "2026-04-03T10:15:00Z"
}
```

### Report Server Results
1. Copy results JSON to Slack #beamlab-delivery
2. Update ITEM9_IMPLEMENTATION_SUMMARY.md with outcomes
3. Present sign-off checklist to leadership
4. Document any issues found + remediation plan

---

## ⏰ Timeline (Apr 3, 2026)

```
9:00 AM   - Phase 1 starts (environment setup)
10:00 AM  - Phase 2 starts (smoke tests)
11:30 AM  - Phase 3 starts (contract test)
12:00 PM  - Phase 4 starts (ownership test)
12:30 PM  - Phase 5 starts (rate limiting)
1:15 PM   - Phase 6 starts (observability)
2:00 PM   - Phase 7 starts (docs check)
2:30 PM   - Phase 8 starts (E2E integration)
4:30 PM   - Load test (k6, 1 hour)
5:30 PM   - Leadership sign-off review
7:00 PM   - Decision: Ready/Not Ready for production
```

---

## 🔀 If Tests Fail

### For Phase 1-2 (Environment/Smoke)
- Check Azure service health in Portal
- Review GitHub Actions deployment logs
- Run health checks script manually
- Restart services if needed

### For Phase 3-4 (Contract/Ownership)
- Check `/apps/api/src/services/requestNormalizer.ts` for field mapping
- Verify `databaseOwnershipGuard.ts` middleware is registered
- Check node-api logs for specific transformation errors
- Run parity-pack.sh in verbose mode

### For Phase 5-6 (Rate Limit/Observability)
- Verify Redis is running (if Redis-backed rate limiting)
- Check `tierRateLimit.ts` middleware configuration
- Verify `request_logger.py` is installed and active
- Check Azure Prometheus configuration

### For Phase 7-8 (Docs/E2E)
- Verify all ADR files present in `/docs/adr/`
- Run specific E2E scenarios manually (see ITEM9_FINAL_INTEGRATION_TEST_PLAN.md)
- Check Python API for snake_case conversion errors
- Verify MongoDB writes are being granted/denied correctly

### Rollback Procedure
If critical failure detected during testing:
1. Stop testing immediately
2. Halt staging deployments
3. Run rollback script (see DEPLOYMENT_CHECKLIST.md)
4. Investigate root cause
5. Fix issue
6. Restart test execution from Phase 1

---

## 📧 Communication

- **Slack Channel**: #beamlab-delivery (hourly updates)
- **Stakeholder**: CTO + Tech Lead (sign-off decision makers)
- **On-Call**: PagerDuty alert for critical failures
- **Post-Test**: 30-min retrospective meeting

---

## ✨ Done Criteria

Test is considered **DONE** when:
- ✅ All 8 phases completed (manual tests documented)
- ✅ Load test shows P95 < 1000ms
- ✅ Production sign-off gate: all 9 items checked
- ✅ Zero critical issues remaining
- ✅ Team consensus to proceed to production (Apr 4)

---

**Questions?** See:
- [ITEM9_FINAL_INTEGRATION_TEST_PLAN.md](./ITEM9_FINAL_INTEGRATION_TEST_PLAN.md) — Detailed test procedures
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) — Production deployment steps
- [docs/adr/](./docs/adr/) — Architecture Decision Records
