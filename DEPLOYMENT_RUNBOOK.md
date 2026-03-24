# Deployment Runbook — BeamLab

**Last Verified:** 24 March 2026  
**Verified Against:** `.github/workflows/azure-deploy.yml`, `.github/workflows/azure-static-web-apps-brave-mushroom-0eae8ec00.yml`, `DEPLOYMENT_STATUS.md`, `DEPLOYMENT_CHECKLIST.md`

## Scope

This runbook covers production deployment and rollback operations for:

- Frontend (Azure Static Web Apps)
- Node API (Azure App Service)
- Python API (Azure App Service)
- Rust API (Azure App Service container)

## Canonical Automation

- Backend workflow: `.github/workflows/azure-deploy.yml`
- Frontend workflow: `.github/workflows/azure-static-web-apps-brave-mushroom-0eae8ec00.yml`
- CI gate: `.github/workflows/ci.yml`

Prefer workflow-driven deploys from `main` over manual deployment.

## Standard Release Procedure

1. Confirm `DEPLOYMENT_CHECKLIST.md` pre-deploy gate is complete.
2. Trigger or confirm auto-trigger of backend and frontend workflows on `main`.
3. Monitor backend jobs (`deploy-api`, `deploy-python`, `deploy-rust`, `smoke-test`).
4. Validate production health endpoints:
   - `https://beamlab-backend-node-prod.azurewebsites.net/health`
   - `https://beamlab-backend-python-prod.azurewebsites.net/health`
   - `https://beamlab-rust-api-prod.azurewebsites.net/health`
   - `https://beamlabultimate.tech`
5. Record operational status in `DEPLOYMENT_STATUS.md`.

## Rollback Procedure

Use rollback if deployment state is **failed** or service health remains degraded.

### Path A — Git Revert (Preferred)

1. Revert the offending commit from `main`.
2. Push revert commit.
3. Allow pipelines to redeploy previous known-good behavior.
4. Re-check all health endpoints.

### Path B — Service-Specific Recovery

For single-service failures, recover only affected service:

- Node API: re-run backend workflow and inspect `deploy-api` logs.
- Python API: re-run backend workflow and inspect `deploy-python` logs.
- Rust API: re-run backend workflow and inspect `deploy-rust` logs.
- Frontend: re-run static web app workflow.

### Path C — Emergency Manual Mitigation

Only when workflow path is unavailable:

1. Execute app-level restart in Azure.
2. Confirm health endpoint recovery.
3. Schedule controlled redeploy through standard workflows.

## Incident Documentation Rules

During any deploy incident:

- Record timestamp, affected service, and run IDs in `DEPLOYMENT_STATUS.md`.
- Capture root cause and mitigation action.
- Add follow-up issue for permanent fix.

## Operational Guardrails

- Do not mark deployment successful unless smoke checks and endpoint checks pass.
- Do not keep one-off run IDs as long-term documentation facts.
- Keep this runbook evergreen; store time-bound narratives under `docs/archive/`.
