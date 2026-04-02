# BeamLab Architecture Remediation Program (2026-04-01)

Status: Proposed
Owner: Platform Architecture Group
Scope: apps/web, apps/api, apps/backend-python, apps/rust-api, apps/backend-rust, packages/*

## Implementation status (as of 2026-04-01)

Implemented now:

1. Ownership registry added and versioned: docs/specs/ownership-registry.yaml.
2. Non-v1 route freeze guardrail added:
   - scripts/check-versioned-routes.mjs
   - docs/specs/unversioned-route-allowlist.txt
3. Launch contract snapshot tests added for gateway envelope stability:
   - apps/api/src/__tests__/launchContractSnapshots.test.ts
4. Unified launch fitness command added:
   - package.json scripts: check:launch:fitness, check:launch:contracts
5. Azure deploy workflow now enforces launch fitness before API build:
   - .github/workflows/azure-deploy.yml
6. CI-friendly launch fitness runner with failure hints and GitHub step summary:
   - scripts/run-launch-fitness.sh
7. Production fail-fast env hardening applied:
   - apps/api/src/config/env.ts
   - apps/backend-python/main.py
   - apps/rust-api/src/config.rs

Still pending for launch window:

1. Deprecation headers rollout across legacy routes.
2. Minimal deterministic parity pack for launch demo scenarios.
3. Single-command smoke test against production-like deployment.

## 1. Executive diagnosis

BeamLab has strong capability breadth, but lacks hard architectural boundaries in four critical areas:

1. Compute ownership ambiguity (Rust vs Python vs local web solver decision paths).
2. API surface sprawl (versioned + unversioned + legacy aliases concurrently active).
3. Contract drift risk (gateway proxy envelopes not consistently normalized to stable DTOs).
4. Environment/config coupling (service-level defaults that can diverge by runtime).

The target state is a deterministic platform where:

1. Every capability has one authoritative engine of truth.
2. Every external endpoint is versioned and governed by a deprecation policy.
3. Every response contract is gateway-normalized and schema-checked.
4. Every runtime uses one shared configuration contract with fail-fast startup.

## 2. Target-state architecture (C4-lite)

```text
User (Web/Desktop)
  -> apps/web (UI + UX orchestration only)
  -> apps/api (single ingress, auth, policy, DTO contracts)
     -> apps/rust-api (authoritative structural analysis + design core)
     -> apps/backend-python (AI/report/layout adjunct services)
  -> Data plane (Mongo/Redis/Blob)
```

Boundary principles:

1. apps/web never defines domain truth for solver or design semantics.
2. apps/api never leaks transport envelopes to public clients.
3. apps/rust-api owns structural numerical truth for analysis and deterministic code checks.
4. apps/backend-python owns AI-assisted generation, report composition, and layout workflows.
5. apps/backend-rust is explicitly classified as either library-only or runtime-only, never both without a published ADR.

## 3. Capability ownership contract (source of truth)

| Capability | Ingress | Authoritative owner | Allowed fallback | Notes |
|---|---|---|---|---|
| Static/modal/time-history analysis | Node `/api/v1/analyze*` | Rust API | Availability fallback only | Fallback must preserve response schema and tolerance envelopes |
| Design code deterministic checks | Node `/api/v1/design*` | Rust API | Python only for approved route list | Route list and parity status must be versioned |
| AI generation and assistants | Node `/api/v1/ai*` | Python | None | Node handles auth/rate limits, Python handles model logic |
| Reports (narrative/composition) | Node `/api/v1/reports*` | Python | Rust for numeric annex only | Split narrative vs numeric sections |
| Billing/auth/project/session | Node `/api/v1/*` | Node API | None | No cross-runtime ownership |
| Sections/templates catalog | Node `/api/v1/sections*` | One owner via ADR | None | Remove duplicate providers after migration |

Definition: "Authoritative owner" means semantic truth, regression baselines, and backward compatibility responsibility.

## 4. Gap-to-remediation mapping

| Gap | Current signal | Remediation |
|---|---|---|
| Engine ambiguity | Rust/Python/local decisions split across layers | Introduce Ownership Registry + parity gate |
| Route sprawl | `/api/*`, `/api/v1/*`, legacy compat routes | Versioned-only public contract + deprecation timeline |
| Contract inconsistency | ProxyResult and route payload shape variance | API DTO mapper per route family + schema snapshots |
| Config drift | Runtime-specific defaults and hardcoded origins | Unified config package and startup validation |
| Boundary erosion | Monolithic Node composition root | Domain module registries + policy tests |

## 5. 15-20 day launch-critical roadmap

Launch mode rule:

1. Only changes that reduce launch risk are in scope.
2. Any non-blocking architectural cleanup is deferred to post-launch backlog.
3. Every phase ends with a production-like smoke gate.

## Phase A (Days 1-3): Freeze architecture and define non-negotiables

Must ship:

1. Lock ownership contract in one machine-readable file: docs/specs/ownership-registry.yaml.
2. Confirm launch ownership decisions:
   - Rust authoritative for deterministic analysis/design.
   - Python authoritative for AI/report/layout.
   - Node authoritative for ingress/auth/billing/project/session.
3. Publish minimal ADR set required for launch governance:
   - ADR-009 ownership
   - ADR-010 versioning and sunset
4. Freeze new public route creation unless under /api/v1.

Exit gate:

1. Ownership file merged.
2. ADR-009 and ADR-010 merged.
3. Team alignment sign-off done.

## Phase B (Days 4-8): Contract and route safety hardening

Must ship:

1. Add script gate to fail new non-v1 public routes.
2. Add deprecation headers on legacy endpoints (do not remove them yet).
3. Normalize gateway response shape for top launch-critical families:
   - /api/v1/analyze*
   - /api/v1/design*
   - /api/v1/ai*
   - /api/v1/billing*
4. Add contract snapshots for the same launch-critical families.

Defer post-launch:

1. Full repo-wide DTO normalization for all legacy modules.
2. Complete alias removal.

Exit gate:

1. CI fails on new non-v1 public route.
2. Snapshot tests exist for launch-critical endpoints.
3. Legacy routes emit Deprecation and Sunset headers.

## Phase C (Days 9-14): Determinism and config fail-fast

Must ship:

1. Add minimal parity suite for deterministic engineering endpoints used in launch demos.
2. Add startup config validation for production-critical env vars in Node, Python, Rust.
3. Add one command to run launch fitness checks locally and in CI.

Defer post-launch:

1. Full parity suite across all code families.
2. Deep tolerance tuning for every advanced solver route.

Exit gate:

1. Parity tests pass for launch-critical scenarios.
2. Services fail fast on missing critical config in production mode.
3. Launch fitness command is required in pipeline.

## Phase D (Days 15-20): Stabilization and go-live gate

Must ship:

1. Run end-to-end smoke flows against production-like environment.
2. Verify legacy route telemetry volume and keep compatibility adapters active until traffic is low.
3. Freeze architecture-affecting refactors after Day 17 (bug fixes only).

Go-live criteria:

1. All launch-critical tests green.
2. No open P0/P1 architecture defects.
3. Rollback path validated.

## 6. Architecture fitness functions (must be automated)

1. Route policy check:
   - Fail if new public route is not under `/api/v1`.
2. Ownership check:
   - Fail if a non-owner service introduces endpoints for an owned capability without ADR update.
3. Contract check:
   - Fail if response schema changes without version bump or compatibility annotation.
4. Config check:
   - Fail startup if required production config keys are absent.
5. Parity check:
   - Fail if deterministic engineering outputs exceed tolerance envelope.

## 7. Required ADRs to add now

1. ADR-009: Deterministic Compute Ownership (Rust as analysis/design truth).
2. ADR-010: Public API Versioning and Sunset Policy.
3. ADR-011: Gateway DTO Normalization and Contract Snapshots.
4. ADR-012: Unified Runtime Configuration Contract.
5. ADR-013: Architecture Fitness Functions as CI Gate.

## 8. Key metrics (daily during launch window)

1. Legacy route traffic ratio (% total API calls).
2. Contract drift incidents (count per week).
3. Cross-engine parity failures (count and severity).
4. Mean time to detect architecture regression.
5. Config validation startup failures (pre-prod catch rate).

Target by Day 20:

1. Contract drift incidents = 0 for launch-critical endpoints.
2. Parity failures = 0 unresolved for launch-critical scenarios.
3. Missing critical config startup escapes = 0.
4. New unversioned public routes introduced = 0.

## 9. Immediate repo actions (next 48 hours)

1. Create docs/specs/ownership-registry.yaml and enforce in CI.
2. Add scripts/check-versioned-routes.mjs and wire into pipeline.
3. Add tests/contracts snapshots for analyze, design, ai, billing routes.
4. Add a minimal parity golden pack for launch-critical deterministic checks.
5. Add docs/deployment/API_DEPRECATION_SCHEDULE.md with explicit post-launch removal dates.

## 9.1 Explicit deferrals (post-launch backlog)

1. Broad legacy endpoint removal.
2. Full endpoint DTO normalization across all route families.
3. Complete architecture scorecard rollout.
4. Full cross-engine parity coverage for every advanced analysis mode.

## 10. Risks and mitigations

1. Risk: client breakage during route cleanup.
   Mitigation: dual-serve window + deprecation headers + telemetry-triggered sunset.
2. Risk: false parity alarms.
   Mitigation: explicit tolerances by capability and standardized load cases.
3. Risk: team bypasses architecture checks under deadline pressure.
   Mitigation: CI required checks + release manager sign-off.

## 11. Definition of done for architecture remediation

1. Ownership is machine-readable and enforced.
2. Public API is v1-only and contract-tested.
3. Deterministic engineering flows have parity and golden benchmarks.
4. Config is centralized and fail-fast across Node/Python/Rust.
5. Architecture fitness checks are non-optional in CI.
