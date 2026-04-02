# April 3 Staging Test: Team Coordination & Execution Plan

**Date**: April 3, 2026  
**Duration**: 8-9 hours (9:00 AM - 7:00 PM)  
**Location**: Remote (Slack #beamlab-delivery for updates)  
**Status**: Ready for execution ✅

---

## 🎯 Test Objectives

- ✅ Verify Items 1-8 deployed and working together (Item 9 Phase 8)
- ✅ Validate all Items 1-8 in staging before production (Apr 4)
- ✅ Capture any issues + generate remediation plan
- ✅ Get leadership sign-off on 9-item gate checklist
- ✅ Ready for production deployment Apr 4

---

## 👥 Team Assignments

### **Phase 1: Environment Setup (9:00 AM - 10:00 AM)**
- **Owner**: DevOps Lead
- **Team**: DevOps + Infrastructure engineer
- **Checklist**:
  - [ ] Pre-test validation complete: `bash scripts/pre-test-validation.sh`
  - [ ] All Items 1-8 deployed to staging
  - [ ] MongoDB backup verified + ready
  - [ ] Azure services health confirmed
  - [ ] Health checks passing (Node, Python, Rust, Frontend)
- **Success**: All 4 services 🟢 healthy
- **Slack Update**: `#beamlab-delivery` at 10:00 AM

### **Phase 2: Smoke Tests (10:00 AM - 11:30 AM)**
- **Owner**: QA Lead
- **Team**: QA Engineer #1, QA Engineer #2
- **Checklist**:
  - [ ] Run: `bash scripts/smoke-tests/health-checks.sh` (30 sec)
  - [ ] Run: `BASE_URL=https://staging... bash scripts/smoke-tests/parity-pack.sh` (2-3 min)
  - [ ] Verify 7/7 tests pass in parity-pack
  - [ ] Document any issues found
- **Success**: health-checks ✅, parity-pack 7/7 ✅
- **Slack Update**: `#beamlab-delivery` at 11:30 AM with results

### **Phase 3: Contract Normalization (11:30 AM - 12:00 PM)**
- **Owner**: Backend Lead
- **Team**: Backend Engineer (Node specialist)
- **Checklist**:
  - [ ] POST /api/v1/analyze with camelCase request
    ```bash
    curl -X POST https://staging.beamlabultimate.tech/api/v1/analyze \
      -H "Authorization: Bearer $TEST_TOKEN" \
      -d '{"projectId": "test", "startNodeId": 1, ...}'
    ```
  - [ ] Verify Node receives camelCase, transforms to snake_case internally
  - [ ] Verify Python receives snake_case (check logs)
  - [ ] Verify response returns camelCase to client
  - [ ] Check latency of transformation (target: <5ms)
- **Success**: camelCase → snake_case → camelCase transparent
- **Slack Update**: `#beamlab-delivery` at 12:00 PM

### **Phase 4: Ownership Enforcement (12:00 PM - 12:30 PM)**
- **Owner**: Security Lead
- **Team**: Security Engineer + Backend Engineer
- **Checklist**:
  - [ ] Verify Node can write to: users, projects, analyses, reports, billing
  - [ ] Verify Rust restricted to: analysisresults (write only)
  - [ ] Attempt unauthorized write (e.g., Rust writing to users) → should fail 403
  - [ ] Check logs for OWNERSHIP_VIOLATION events
  - [ ] Verify audit trail: tierchangelogs, usagelogs, auditlogs (append-only)
- **Success**: ZERO unauthorized writes, all violations logged
- **Slack Update**: `#beamlab-delivery` at 12:30 PM

### **Phase 5: Rate Limiting (12:30 PM - 1:15 PM)**
- **Owner**: DevOps Lead
- **Team**: DevOps Engineer + Performance Engineer
- **Checklist**:
  - [ ] Set up load test with 3 test users (Free, Pro, Ultimate)
  - [ ] Free tier: Send 101 requests → should get 429 on 101st
  - [ ] Pro tier: Send 1001 requests → should get 429 on 1001st
  - [ ] Ultimate tier: Send 10001 requests → should get 429 on 10001st
  - [ ] Verify rate limit headers: x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset
  - [ ] Check for Redis connectivity issues (if applicable)
- **Success**: All tier limits enforced correctly, 429 responses accurate
- **Slack Update**: `#beamlab-delivery` at 1:15 PM

### **Phase 6: Observability (1:15 PM - 2:00 PM)**
- **Owner**: DevOps Lead
- **Team**: DevOps Engineer + Monitoring Engineer
- **Checklist**:
  - [ ] Make request to Node API
  - [ ] Verify X-Request-ID present and unique
  - [ ] Verify Node API logs include request_id
  - [ ] If Python called, verify Python logs include same request_id
  - [ ] Verify JSON-structured logs (not plain text)
  - [ ] Check Prometheus metrics collection
  - [ ] Verify alerts configured and active
  - [ ] Test Prometheus query: `rate(requests_total[1m])`
- **Success**: Request IDs propagate across all logs, structured format, metrics collecting
- **Slack Update**: `#beamlab-delivery` at 2:00 PM with tracing sample

### **Phase 7: Documentation Verification (2:00 PM - 2:30 PM)**
- **Owner**: Tech Lead
- **Team**: Tech Lead + Architecture reviewer
- **Checklist**:
  - [ ] ADR-001 (MongoDB Ownership) present and complete
  - [ ] ADR-002 (Rate Limiting) present and complete
  - [ ] ADR-003 (Contract Normalization) present and complete
  - [ ] ARCHITECTURE.md complete with diagrams
  - [ ] All ADRs have: Context → Decision → Consequences → Alternatives → Implementation
  - [ ] Cross-references between ADRs working
  - [ ] Can a new engineer understand system from docs?
- **Success**: All docs present, complete, understandable
- **Slack Update**: `#beamlab-delivery` at 2:30 PM

### **Phase 8: End-to-End Integration (2:30 PM - 4:30 PM)**
- **Owner**: QA Lead
- **Team**: QA Engineer #1, QA Engineer #2, Backend Engineer
- **Checklist**:
  - [ ] **Step 1: User Signup** (POST /api/v1/auth/signup)
    - Create test user: test-{timestamp}@beamlab.test
    - Expected: User created, JWT token returned
  - [ ] **Step 2: Create Project** (POST /api/v1/projects)
    - Name: "E2E Test Project - $(date)"
    - Expected: Project created, ownership = current user
  - [ ] **Step 3: Add Geometry** (POST /api/v1/projects/{id}/geometry)
    - Define nodes, members, loads
    - Expected: Geometry saved, Node ownership verified
  - [ ] **Step 4: Submit Analysis** (POST /api/v1/analyze)
    - Send analysis request with all geometry
    - Expected: Analysis submitted, processing, request ID logged
  - [ ] **Step 5: Wait for Results** (GET /api/v1/analyses/{id})
    - Poll every 5 seconds for completion
    - Expected: Results returned with camelCase, deflections + stresses
  - [ ] **Step 6: Design Check** (POST /api/v1/design/check)
    - Send design check request to Python
    - Expected: Python receives snake_case, processes, returns camelCase
  - [ ] **Step 7: Generate Report** (POST /api/v1/reports)
    - Create PDF report from results
    - Expected: Report generated, ownership = current user
  - [ ] **Step 8: Cleanup** (DELETE /api/v1/projects/{id})
    - Delete test project
    - Expected: Project and all children deleted
- **Success**: All 8 steps complete successfully, no errors
- **Slack Update**: `#beamlab-delivery` at 4:30 PM with journey summary

### **Load Testing (4:30 PM - 5:30 PM)**
- **Owner**: Performance Engineer
- **Team**: Performance Engineer + DevOps
- **Checklist**:
  - [ ] k6 installed and ready
  - [ ] Load test script created or verified
  - [ ] Test parameters: 100 concurrent users, 10 minutes
  - [ ] User distribution: 50 free, 35 pro, 15 ultimate
  - [ ] Run: `k6 run tests/load-test.js --stage 2m:0 --stage 8m:100`
  - [ ] Verify metrics:
    - [ ] P95 latency < 1000ms (GREEN: <500ms, YELLOW: 500-1000ms, RED: >1000ms)
    - [ ] Error rate < 5% (GREEN: <1%, YELLOW: 1-5%, RED: >5%)
    - [ ] Request IDs present in 100% of requests
  - [ ] Check for Redis bottlenecks
  - [ ] Check Node/Python/Rust CPU/memory
- **Success**: P95 < 1000ms, error rate < 5%, all request IDs present
- **Slack Update**: `#beamlab-delivery` at 5:30 PM with performance summary

### **Leadership Sign-Off Review (5:30 PM - 7:00 PM)**
- **Owner**: CTO
- **Team**: CTO + Tech Lead + Product Lead
- **Checklist**:
  - [ ] Review Phase 1-8 results (all items working)
  - [ ] Review load test metrics (P95, error rate)
  - [ ] Review 9-item sign-off gate:
    - [ ] Item 1: Health assessment documented ✅
    - [ ] Item 2: Node gateway stable ✅
    - [ ] Item 3: CORS/Auth hardened ✅
    - [ ] Item 4: Contract transformation transparent ✅
    - [ ] Item 5: Write authorization enforced ✅
    - [ ] Item 6: Smoke test scripts passing ✅
    - [ ] Item 7: Rate limiting + observability active ✅
    - [ ] Item 8: ADRs complete + documentation ready ✅
    - [ ] Item 9: 8-phase test passed + load test met SLOs ✅
  - [ ] Identify any critical issues
  - [ ] Decision: **READY FOR PRODUCTION** or **NEEDS FIXES**
- **Success**: All 9 items signed off, green light to deploy
- **Slack Update**: `#beamlab-delivery` at 7:00 PM with decision

---

## 📋 Pre-Test (Apr 2 - Evening)

### Run Validation Kit
```bash
cd /Users/rakshittiwari/Desktop/newanti
bash scripts/pre-test-validation.sh https://staging.beamlabultimate.tech
```

**Expected output**:
- ✅ All Items 1-9 files present
- ✅ Executable scripts verified
- ✅ Staging services responding
- ✅ Team checklist generated

**If any checks fail**: Fix issues immediately, re-run, verify ✅ before Apr 3

---

## 📊 Slack Communication

### Channels
- **#beamlab-delivery** — Test updates (hourly)
- **#beamlab-incidents** — Critical issues (if any)
- **@cto** — Escalations
- **@on-call** — Alerts

### Update Template
```
🚀 Phase X: [PHASE_NAME] - [STATUS]
  Start: HH:MM AM
  Owner: [PERSON]
  Tests run: N/X passed
  Issues: [none|list]
  Next: Phase Y at HH:MM AM
  📊 Metrics: [key metrics if applicable]
```

---

## 🚨 Critical Issues Procedure

**If critical issue detected during test:**

1. **Stop testing immediately**
2. **Post to #beamlab-incidents**: `CRITICAL: [Issue]`
3. **Alert @cto and @tech-lead**
4. **Investigate root cause**
5. **Decide: Fix now or rollback**
6. **If fix**: Restart testing at Phase where issue found
7. **If rollback**: Run rollback script, mark test FAILED, schedule retry

---

## ✅ Success Criteria

| Phase | Success = | Failure = |
|-------|-----------|-----------|
| Phase 1 | All 4 services 🟢 | Any service 🔴 |
| Phase 2 | health-checks ✅, parity-pack 7/7 | Any test fails |
| Phase 3 | camelCase → snake_case → camelCase | Transformation breaks |
| Phase 4 | 0 unauthorized writes logged | Any unauthorized write |
| Phase 5 | All tier limits enforced | Limits not enforced |
| Phase 6 | Request IDs in all logs | IDs missing |
| Phase 7 | 3 ADRs + architecture complete | Docs incomplete |
| Phase 8 | All 8 journey steps succeed | Any step fails |
| Load | P95 < 1000ms, error < 5% | Latency/errors exceed limits |
| Sign-Off | All 9 items ✅ | Any item ❌ |

---

## 🔄 Rollback Procedures

### If Phase 1-2 Fails (Environment)
1. Run: `bash scripts/validate-deploy-env.sh`
2. Restart Azure services
3. Re-run health checks
4. Restart from Phase 1

### If Phase 3-4 Fails (Contract/Ownership)
1. Check logs for transformation errors
2. Verify middleware registration
3. If code issue, fix in staging
4. Re-run parity-pack to validate
5. Restart from Phase 3

### If Phase 5-6 Fails (Rate Limit/Observability)
1. Check Redis connectivity
2. Verify middleware registration
3. Review recent changes
4. If config issue, update
5. Restart from Phase 5

### If Phase 8 Fails (E2E)
1. Identify which step failed
2. Isolate the issue (contract? ownership? rate limit?)
3. Fix underlying Item
4. Re-test that step
5. Restart from Phase 8

### If Load Test Fails (Performance)
1. Check metrics: CPU, memory, database
2. Identify bottleneck (Node? Python? Rust? DB?)
3. Scale or optimize as needed
4. Re-run load test

### Full Rollback (Production Not Ready)
1. CTO decision: **DO NOT DEPLOY**
2. Document all issues + root causes
3. Create remediation plan
4. Re-schedule test for Apr 5 (or later)
5. Post-mortem meeting to understand why items broke

---

## 📞 Escalation Path

**During Test**:
- Issue found → Phase Owner → Tech Lead (⏰ 15 min)
- Tech Lead can't resolve → CTO (⏰ 5 min)
- CTO decides: **Continue** or **Rollback**

**Critical Issue**:
- CTO notified immediately
- Halt all testing
- Root cause analysis
- Decision: Fix/Rollback/Reschedule

---

## 🎓 New Team Member Onboarding (During Test)

If someone is unfamiliar with Items 1-9:
1. Read: `PHASE1_COMPLETION_REPORT.md` (15 min overview)
2. Read: Phase-specific ADR (5 min deep dive)
3. Shadow Phase Owner (hands-on)
4. Ask questions in #beamlab-delivery

---

## 📈 Post-Test (Apr 3 Evening)

### If READY FOR PRODUCTION ✅
1. **Apr 3, 7:00 PM**: Sign-off complete
2. **Apr 4, 9:00 AM**: Production deployment
3. **Apr 4, 5:00 PM**: Production monitoring begins
4. **Apr 5, 10:00 AM**: Post-deployment retrospective

### If NEEDS FIXES ❌
1. **Apr 3, 7:00 PM**: Issues documented
2. **Apr 4-5**: Fixes implemented
3. **Apr 6**: Retry test execution
4. **Apr 6 PM**: Production decision

---

## 📋 Day-Of Checklist (Apr 3, 8:30 AM)

**DevOps Lead**:
- [ ] Git latest changes pulled
- [ ] Staging environment verified
- [ ] MongoDB backup confirmed
- [ ] Health checks script ready
- [ ] Slack channel active
- [ ] Everyone in #beamlab-delivery

**QA Lead**:
- [ ] Test accounts ready (Free, Pro, Ultimate)
- [ ] Test data cleaned up
- [ ] Parity-pack script verified
- [ ] E2E test cases ready

**Backend Lead**:
- [ ] Contract test endpoints identified
- [ ] Logs access verified
- [ ] Python API staging URL confirmed

**Security Lead**:
- [ ] Ownership matrix reviewed
- [ ] Log queries ready for violations
- [ ] Unauthorized write tests prepared

**Performance Engineer**:
- [ ] k6 installed and working
- [ ] Load test script ready
- [ ] Metrics dashboard open

**CTO/Tech Lead**:
- [ ] 9-item sign-off gate checklist printed
- [ ] Escalation phone line ready
- [ ] Production deployment plan reviewed

---

## 📞 Contact Info

| Role | Person | Phone | Slack |
|------|--------|-------|-------|
| CTO | [Name] | [+1-XXX] | @cto |
| Tech Lead | [Name] | [+1-XXX] | @tech-lead |
| DevOps Lead | [Name] | [+1-XXX] | @devops-lead |
| QA Lead | [Name] | [+1-XXX] | @qa-lead |
| On-Call | [Name] | [+1-XXX] | @on-call |

---

## 🎯 Bottom Line

- **8 phases of validation** (9 AM - 5:30 PM)
- **Load testing** (4:30 PM - 5:30 PM)  
- **Leadership sign-off** (5:30 PM - 7:00 PM)
- **Decision**: Ready for production OR needs fixes
- **Next step**: Production deployment Apr 4 (if approved)

---

**Team: Let's ship this! 🚀**
