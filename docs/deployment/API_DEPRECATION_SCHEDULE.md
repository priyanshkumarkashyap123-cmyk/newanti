# API Deprecation Schedule (Launch Window)

Status: Active
Effective date: 2026-04-01
Window: 15-20 day launch hardening

## Policy

1. No new unversioned public routes may be introduced during launch window.
2. Existing unversioned routes remain for compatibility only.
3. All new public APIs must be under /api/v1/*.

## Route classes

1. Class A (keep through launch): critical compatibility routes currently serving traffic.
2. Class B (announce now, remove post-launch sprint): low-traffic aliases.
3. Class C (internal/admin only): not part of public contract.

## Sunset timeline

1. Day 0-5 (now): Add deprecation communication in release notes and changelog.
2. Day 6-12: Monitor traffic ratio for unversioned routes.
3. Day 13-20: Freeze additions; keep compatibility active for go-live safety.
4. Post-launch Sprint 1: remove Class B routes.
5. Post-launch Sprint 2: remove remaining Class A aliases after client migration confirmation.

## Ownership

1. Node API owner approves temporary exceptions.
2. Architecture owner approves allowlist changes.
3. Release owner verifies no P0/P1 defects before any route removal.

## Enforcement

1. CI gate: scripts/check-versioned-routes.mjs
2. Baseline allowlist: docs/specs/unversioned-route-allowlist.txt
3. Ownership contract: docs/specs/ownership-registry.yaml
