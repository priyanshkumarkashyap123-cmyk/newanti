# Production Readiness — BeamLab

**Last Verified:** 24 March 2026  
**Verified Against:** `.github/workflows/ci.yml`, `.github/workflows/azure-deploy.yml`, `.github/workflows/azure-static-web-apps-brave-mushroom-0eae8ec00.yml`

## Readiness Definition

Production readiness means:

1. Required CI quality gates pass.
2. Deployment pipelines complete successfully.
3. Runtime health endpoints are healthy.
4. Critical user flows are smoke-tested post-deploy.

## Gate 1 — CI Quality (Must Pass)

Source of truth: `.github/workflows/ci.yml`

Required outcomes:

- TypeScript check
- ESLint
- Web browser compatibility guard
- Web build + unit tests
- Regression tests
- Rust checks/tests
- API build/tests
- Python backend tests
- API contract compatibility
- OpenAPI contract validation
- Design contract gate

## Gate 2 — Deployment (Must Pass)

Source of truth:

- Backend deploy: `.github/workflows/azure-deploy.yml`
- Frontend deploy: `.github/workflows/azure-static-web-apps-brave-mushroom-0eae8ec00.yml`

Required outcomes:

- Backend jobs complete without blocking failures.
- Backend smoke-test stage confirms service availability.
- Frontend deploy publishes current build artifact successfully.

## Gate 3 — Runtime Health (Must Pass)

- `https://beamlabultimate.tech`
- `https://beamlab-backend-node-prod.azurewebsites.net/health`
- `https://beamlab-backend-python-prod.azurewebsites.net/health`
- `https://beamlab-rust-api-prod.azurewebsites.net/health`

## Gate 4 — Product Smoke (Must Pass)

Minimum manual smoke set after deploy:

- Login/auth flow works in web app.
- Core analysis request returns valid response.
- Report-generation path renders output.

## Readiness States

- **READY:** All four gates pass.
- **DEGRADED:** One non-critical gate has warnings but no blocked user flow.
- **NOT READY:** Any critical gate fails.

## Readiness Review Cadence

- On every production deploy.
- Weekly operational review for recurring warnings.
- Immediate review after any incident/rollback.

## Historical Note

Past snapshot-style readiness scores and dated rollout narratives are historical context only. Use this file and live workflow states for current readiness decisions.
