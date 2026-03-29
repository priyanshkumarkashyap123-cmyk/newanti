Sprint Guardrails — 10-Day Enterprise Hardening

Purpose: ensure a safe, reversible, auditable 10-day sprint that focuses on reliability, security, and solver trust.

Immediate rules
- Branching: create `sprint/<name>-<YYYYMMDD>` branch for all sprint work.
- CI: all PRs must pass `TypeScript Check`, `ESLint`, and unit tests for touched packages before review.
- Reviewers: require 2 reviewers for backend changes and 1 reviewer for UI changes.
- Rollback: each deploy must include a documented rollback command in the PR description.

Pre-merge checks
- Add a short `SPRINT-CONTRACT.md` section in PR describing safety considerations and rollout plan.
- Add smoke tests to `azure-deploy` workflow to verify `/health/ready` after deployment.

Release policy
- Use feature flags for UI-visible changes; enable staging rollout for 10% of users before full release.
- Production deploys must include canary window and monitoring links in the PR.

Communication
- Daily sync: 15-minute standup at iteration boundaries.
- Create a single Slack/Teams thread per deploy for roll-forward / rollback actions.

Operations
- Tag the baseline commit with `sprint/baseline-<YYYYMMDD>` at start of Day 1.

Notes
- These are documented guidelines to coordinate the sprint — implementable scripts and CI patches are created in `scripts/` for convenience.
