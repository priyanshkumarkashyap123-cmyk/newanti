# Production Readiness Scorecard Template

_Last updated: 16 March 2026_

## Legend
- Status: `Not Started` | `In Progress` | `Blocked` | `Done`
- Risk: `Low` | `Medium` | `High` | `Critical`

## Program-level KPIs

| KPI | Target | Current | Status | Owner | Evidence |
|---|---:|---:|---|---|---|
| Internal API success rate | >= 99.5% |  | Not Started |  |  |
| p95 analysis latency | <= 8s |  | Not Started |  |  |
| p99 design-check latency | <= 2s |  | Not Started |  |  |
| Failed analysis jobs/day | <= threshold |  | Not Started |  |  |
| Restore drill success | 100% |  | Not Started |  |  |
| Critical security findings open | 0 |  | Not Started |  |  |

## Stream scorecard

| Stream | Deliverable | Status | Risk | Owner | Due Date | Blockers | Evidence |
|---|---|---|---|---|---|---|---|
| Frontend Reliability | API failure UX unified | Not Started | Medium |  |  |  |  |
| Frontend Reliability | Health/connectivity banner | Not Started | Medium |  |  |  |  |
| Frontend Performance | CI bundle budgets enforced | Not Started | Medium |  |  |  |  |
| Node Gateway | Contract validation at boundary | Not Started | High |  |  |  |  |
| Node Gateway | Retry/timeout/circuit policy standardized | Not Started | High |  |  |  |  |
| Rust Solver | Diagnostics in responses (convergence/condition) | Not Started | High |  |  |  |  |
| Python Backend | Parity with Rust for designated suites | Not Started | High |  |  |  |  |
| Database | Backup + restore drill | Not Started | Critical |  |  |  |  |
| Database | Migration rehearsal + rollback strategy | Not Started | Critical |  |  |  |  |
| API Governance | Versioning/deprecation policy | Not Started | High |  |  |  |  |
| Security | CORS/service auth/secrets controls | Not Started | High |  |  |  |  |
| Compliance | SOC2-like evidence package | Not Started | Medium |  |  |  |  |
| Release Ops | Dress rehearsal + rollback simulation | Not Started | Critical |  |  |  |  |

## Weekly readiness review

### Week of: ____

- Overall status: 
- Top 3 risks:
  1. 
  2. 
  3. 
- Decisions made:
- Escalations needed:
- Go/No-Go trajectory:

## Gate checklist snapshot

| Gate | Pass Criteria | Status | Owner | Evidence |
|---|---|---|---|---|
| Gate 0 | Baseline + ownership signed | Not Started |  |  |
| Gate 1 | Reliability drills pass | Not Started |  |  |
| Gate 2 | API/DB governance checks pass | Not Started |  |  |
| Gate 3 | Security/compliance walkthrough pass | Not Started |  |  |
| Gate 4 | Analysis parity benchmarks pass | Not Started |  |  |
| Gate 5 | Load/performance thresholds pass | Not Started |  |  |
| Gate 6 | Dress rehearsal + rollback simulation pass | Not Started |  |  |
| Gate 7 | Hypercare exits with no unresolved P0/P1 | Not Started |  |  |
