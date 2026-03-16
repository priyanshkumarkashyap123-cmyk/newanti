# Sprint 1: Stabilization & Deployment Hardening
**Duration:** Week of 16–23 March 2026  
**Team:** 1–2 engineers (mixed frontend/backend experience)  
**Goal:** Ship Phase 0 (baseline audit) + Phase 1 (deploy hardening) to unblock safe rollout of Phases 2–3  
**Success Metric:** All deployment manual rollbacks become automated, zero unvalidated secrets deploy, health checks reflect real dependency state

---

## Daily Breakdown

### Monday 16 Mar — Phase 0: Baseline & Triage (4h)

| Task | Owner | Effort | Acceptance Criteria |
|------|-------|--------|----------------------|
| **0.1: Gather current prod health scores** | DevOps/Backend | 1h | Document: (1) Current error rate % (last 24h from Sentry), (2) avg response times, (3) last 3 deployment times + success/fail reason, (4) top 5 customer pain points from logs/support |
| **0.2: Audit recent deployment failures** | DevOps | 1h | Create issue: "Deployment Archeology — why last 5 prod deploys failed" with root-cause tags (secrets missing, migration failed, health check flaky, network timeout, etc.) |
| **0.3: Confirm all required secrets exist in GitHub** | DevOps | 1h | Run `gh secret list --repo $REPO \| grep -E 'MONGODB_URI\|JWT_SECRET\|CLERK_SECRET\|SENTRY_DSN\|INTERNAL_SERVICE_SECRET'`; create GitHub issue if any missing |
| **0.4: Map current P0/P1 incidents** | DevOps + Backend | 1h | Create prioritized backlog: List all open issues/bugs affecting users tagged by (a) outage/data-loss risk (P0), (b) core flow broken (P1), (c) degradation (P2). Sort by user impact. Archive low-signal tickets. |

**Checkpoint:** By EOD Monday, you have a clear picture of current state, recent failures, and a triage board.

---

### Tuesday 17 Mar — Phase 1.1: Deployment Secrets Validation (6h)

| Task | Owner | Effort | Acceptance Criteria |
|------|-------|--------|----------------------|
| **1.1.1: Code review current deploy workflow** | Backend/DevOps | 1h | Read `.github/workflows/azure-deploy.yml` lines 1–110 (secret loading). Identify: (1) which secrets are optional vs. required, (2) what happens if a required secret is missing (does deploy proceed?), (3) where validation should be injected |
| **1.1.2: Create shared secrets schema** | Backend | 1h | Create `scripts/validate-secrets.sh` that defines `REQUIRED_SECRETS` array with names + descriptions. Run locally against `.env.deploy` (if present) or GitHub secrets. Exit 1 if any missing. |
| **1.1.3: Inject validation into deploy workflow** | DevOps | 2h | Update `.github/workflows/azure-deploy.yml`: Add new step after secret loading that runs `scripts/validate-secrets.sh`. Fail pipeline with ::error:: if validation returns non-zero. |
| **1.1.4: Test validation locally** | Backend/DevOps | 1h | (1) Simulate missing `MONGODB_URI` secret, verify job fails before deploy attempt. (2) Simulate all secrets present, verify job passes. (3) Run on a test branch and confirm workflow fails as expected. |
| **1.1.5: Document secret onboarding** | DevOps | 1h | Create `docs/DEPLOYMENT_SECRETS_SETUP.md` listing all required secrets + where to fetch them + how to rotate. Link from DEPLOYMENT_RUNBOOK. |

**Checkpoint:** By Tuesday EOD, deploy pipeline fails fast if a required secret is missing.

---

### Wednesday 18 Mar — Phase 1.2: Health Endpoint Hardening (6h)

| Task | Owner | Effort | Acceptance Criteria |
|------|-------|--------|----------------------|
| **1.2.1: Audit current health endpoints** | Backend | 1h | Document: (1) Current `/health` implementation (always 200?), (2) `/health/dependencies` if it exists (checks MongoDB/Rust/Python?), (3) What Azure health probe is currently configured to use |
| **1.2.2: Implement dependency check in liveness probe** | Backend | 2h | Update `apps/api/src/index.ts`: (1) Add async check for MongoDB connection status on startup. (2) Return 503 + degraded status if DB unreachable after 30s retry. (3) Ensure `/health` returns 503 if DB not ready (not always 200). |
| **1.2.3: Configure Azure health probe** | DevOps | 1h | Set Azure App Service to use `/health/dependencies` for liveness probe (not just `/health`). Set timeout to 10s, interval to 30s. |
| **1.2.4: Test health endpoint behavior** | Backend/DevOps | 1h | (1) Start app, verify `/health` returns 200 + MongoDB ok. (2) Kill MongoDB connection externally, wait 5s, verify `/health` returns 503. (3) Restart app, log Azure health probe calls and verify they trigger app restart on 503. |
| **1.2.5: Document health semantics** | Backend | 1h | Add comment block to health endpoint explaining: "Liveness (503 if DB unavailable) vs. Readiness (0 if not fully initialized). Always return within 5s to avoid Azure timeout." |

**Checkpoint:** By Wednesday EOD, health checks reflect real state and trigger Azure restarts on actual degradation.

---

### Thursday 19 Mar — Phase 1.3: Startup Command & Config Cleanup (5h)

| Task | Owner | Effort | Acceptance Criteria |
|------|-------|--------|----------------------|
| **1.3.1: Audit startup fragility** | DevOps | 1h | Review: (1) Current `web.config` (is it still active?), (2) `.github/workflows/azure-deploy.yml` startup command setup, (3) `apps/api/startup.sh`. Identify all places startup path is defined. |
| **1.3.2: Decide on single startup path** | DevOps | 30min | Decision: Will we use (a) `--env-file .env` flag (requires .env in deployment), or (b) rely purely on Azure App Settings (no .env)? Choose based on your precedent. Document in DEPLOYMENT_RUNBOOK. |
| **1.3.3: Update Azure deploy workflow** | DevOps | 1h | Update `.github/workflows/azure-deploy.yml`: (1) Set `--startup-file` to chosen path (e.g., `node --env-file=.env /home/site/wwwroot/dist/index.cjs`). (2) Verify it's set EVERY deploy (not conditional). (3) Add pre-deploy check: list current startup command and verify it matches expected. |
| **1.3.4: Remove or align web.config** | DevOps | 1h | Either: (a) Delete `web.config` if IIS mode is disabled, OR (b) update path to match deployment artifact location. Add comment: "If this file is active, Node startup path must match line X deployment config." |
| **1.3.5: Test startup consistency** | DevOps | 1h | (1) Deploy to staging, SSH into app service, verify startup command is set correctly. (2) Check that app starts cleanly (no 502/503 due to missing entry point). (3) Confirm startup logs show expected env variables loaded. |

**Checkpoint:** By Thursday EOD, single canonical startup path, no brittle config overrides, verified in staging.

---

### Friday 20 Mar — Phase 1.4: Migration Enforcement & Staged Deploy (7h)

| Task | Owner | Effort | Acceptance Criteria |
|------|-------|--------|----------------------|
| **1.4.1: Fix migration step** | Backend/DevOps | 1h | Update `.github/workflows/azure-deploy.yml`: Remove `continue-on-error: true` from database migration step. If migration fails, entire deploy must fail. |
| **1.4.2: Add pre-deploy migration dry-run** | Backend | 1.5h | Add new workflow step: `npm run migrate -- --dry-run`. Must succeed before actual deploy proceeds. Should validate schema changes are idempotent. |
| **1.4.3: Create staging slot** | DevOps | 1.5h | (1) Create Azure App Service staging slot via `az webapp deployment slot create ...`. (2) Add staging DB connection string to App Settings (same MongoDB for now). (3) Test that staging slot can be deployed to independently. |
| **1.4.4: Update deploy workflow for staged rollout** | DevOps | 2h | New workflow steps: (1) Deploy to staging first. (2) Run smoke tests against staging. (3) Only if staging passes, swap staging → production. (4) If swap fails, document manual rollback procedure. |
| **1.4.5: Test staged deploy + rollback** | DevOps | 1h | (1) Deploy v1 to prod (successful baseline). (2) Deploy v2 to staging, pass smoke tests, swap to prod. (3) Simulate v2 failure, manually swap back to v1, verify rollback works. Document time to rollback. |

**Checkpoint:** By Friday EOD, deploy pipeline enforces migration success and supports zero-downtime staged rollout with manual rollback validation.

---

### Weekend Checkpoint (Optional)
- [ ] All Phase 1 changes deployed to production (or prepared for Monday deployment)
- [ ] One production deploy cycle completed without manual intervention
- [ ] Documented rollback procedure tested and verified

---

## Parallel Work (Starting Wednesday)

### Phase 2: Backend API Reliability (Wed–Fri, 2–3 hours/day)
*Does not block Phase 1; can proceed in parallel*

| Task | Owner | Effort | Checkpoint |
|------|-------|--------|-----------|
| **2.1: Standardize error response envelope** | Backend | 2h | All three backends (Node/Python/Rust) return HTTP status + error code + message in consistent format. Add to `docs/API_ERROR_CODES.md`. |
| **2.2: Add request ID propagation** | Backend | 2h | Node generates `X-Request-ID`, passes to Rust/Python, both echo back in responses and logs. Spot-check one request across all three backends. |
| **2.3: Fix Python CORS wildcard** | Backend | 1h | Update `main.py`: Remove `allow_origins=["*"]`, replace with explicit list (default: same as Node). Test with curl from different origin, verify 403 if not allowed. |

### Phase 3: Frontend Crashes (Wed–Fri, 2–3 hours/day)
*Does not block Phase 1; can proceed in parallel*

| Task | Owner | Effort | Checkpoint |
|------|-------|--------|-----------|
| **3.1: Fix useAnalysisExecution memory leak** | Frontend | 2h | Add `useEffect` cleanup for all event listeners and abort controllers. Test with React DevTools Profiler: memory should not grow after 5 iterations of analysis. |
| **3.2: Add worker timeout/fallback** | Frontend | 2h | Wrap worker calls with 30s timeout; if no response, fall back to Rust API. Add console warning. Test by killing worker process mid-analysis. |
| **3.3: Add API response validation** | Frontend | 1.5h | Create `src/lib/api/schemas.ts` with Zod schemas for rustApi responses. Validate on receipt. Log mismatches to Sentry. |

---

## Definition of Done (For Sprint 1)

✅ **Deployment:**
- [ ] Deploy pipeline requires all secrets to be present, fails otherwise
- [ ] Health checks reflect real database status (not always 200)
- [ ] Migrations enforced (deploy fails if schema migration fails)
- [ ] Staged deploy to production with rollback capability verified
- [ ] One complete production deploy cycle executed without manual intervention

✅ **Backend (Parallel with Phase 1):**
- [ ] Error responses standardized across Node/Python/Rust
- [ ] Request IDs propagated end-to-end and in logs
- [ ] Python CORS restricted to allowlist

✅ **Frontend (Parallel with Phase 1):**
- [ ] Analysis execution memory stable (no leaks detected in Profiler)
- [ ] Worker timeout prevents UI hangs
- [ ] API response validation catches schema drift

✅ **Testing & Docs:**
- [ ] All changes include a "how to verify" section
- [ ] DEPLOYMENT_RUNBOOK updated with new procedures
- [ ] One production deployment tested from end to end

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Secrets validation breaks deploy for all projects** | Test on feature branch first, verify both success (all secrets present) and failure (missing secret) paths work |
| **Health endpoint change causes false positives** | Rollback strategy: revert to always-200 if Azure health probe gets flaky. Document in runbook. |
| **Staging slot deployment fails** | Keep manual fallback: if slot swap fails, deploy directly to production (existing process) |
| **Memory leak fix introduces new bugs** | Add React DevTools Profiler snapshot before/after; compare snapshots in test coverage |

---

## Communication

- **Daily standup:** 10 min, status on blockers + next task
- **EOD Friday:** Publish brief "Week 1 Done" summary: what shipped, what's next, known issues
- **Product/Support:** "Stability sprint in progress — deployments and health checks more reliable. May see brief service restarts as health checks improve (normal, not a regression)."

