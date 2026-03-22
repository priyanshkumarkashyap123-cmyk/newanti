# Deployment Report — 2026-03-22

## Strategy Executed
- Repository visibility set to **PUBLIC** before deployment.
- Local Azure CLI deployment executed (`deploy-now.sh`) with retry behavior for App Service zip deploy conflicts.
- Services verified post-deploy.
- Deployment report committed to git.
- Repository visibility switched back to **PRIVATE** after deployment workflow.

## Deployment Targets
- Website: `https://beamlabultimate.tech`
- Node API: `https://beamlab-backend-node.azurewebsites.net`
- Python API: `https://beamlab-backend-python.azurewebsites.net`
- Rust API: `https://beamlab-rust-api.azurewebsites.net`

## Verification Snapshot
- Website: **200 OK**
- Node API `/health`: **200 OK** (`{"status":"ok","version":"unknown","db":"connected"}`)
- Rust API `/health`: **200 OK** (`{"status":"ok","service":"BeamLab Rust API", ...}`)
- Python API `/health`: **timeout / unavailable** (`curl timeout, App Service startup failure`)

## Key Operational Notes
- Node and Python zip deploys encountered transient 409 conflicts from Kudu and retried.
- Python deployment repeatedly reports: **Site failed to start within 10 minutes**.
- Python App Service remains the only blocked service and needs focused startup/runtime remediation.

## Git Posting Scope
- This commit intentionally records deployment operations and status only.
- Large local workspace changes (including vendored `.python_packages`) are excluded from this deployment-report commit.
