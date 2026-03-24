# BeamLab Documentation Index

**Last Verified:** 24 March 2026  
**Status:** Canonical active documentation hub

## Start Here

- Repository overview: [`../README.md`](../README.md)
- Deployment operations: [`../DEPLOYMENT_RUNBOOK.md`](../DEPLOYMENT_RUNBOOK.md)
- Deployment status contract: [`../DEPLOYMENT_STATUS.md`](../DEPLOYMENT_STATUS.md)
- Release readiness gates: [`../PRODUCTION_READINESS.md`](../PRODUCTION_READINESS.md)
- Specification pack: [`./specs/README.md`](./specs/README.md)

## Documentation Lanes

### 1. Product & System Specs

- `docs/specs/*` (canonical architecture and implementation specification pack)

### 2. Deployment & Operations

- `DEPLOYMENT_RUNBOOK.md`
- `DEPLOYMENT_CHECKLIST.md`
- `DEPLOYMENT_STATUS.md`
- `PRODUCTION_READINESS.md`

### 3. Engineering Deep Dives

- `docs/ADVANCED_*`
- `docs/*ARCHITECTURE*`
- app-level docs under `apps/**`

### 4. Historical Snapshots

- `docs/archive/**`
- legacy status/final/session summary files in `docs/` and root

Historical files are informational and not source-of-truth for current operations.

## Source-of-Truth Policy

When documentation conflicts with implementation, trust in this order:

1. Runtime code and app entrypoints (`apps/**`)
2. CI/CD workflows (`.github/workflows/*.yml`)
3. Active operations docs (root deploy/readiness files)
4. Snapshot/history docs

## Maintenance Rules

- Keep active docs evergreen (avoid embedding one-run IDs/timestamps as facts).
- Move one-off rollout narratives to `docs/archive/`.
- Update this index when introducing a new canonical doc or lane.
