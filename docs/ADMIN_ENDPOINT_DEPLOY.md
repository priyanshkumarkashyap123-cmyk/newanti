## Deploying the admin diagnostics endpoint (/api/admin/gpu-status)

This document shows the minimal steps to ensure the admin diagnostics route is deployed and reachable in production without exposing secrets.

Prerequisites
- You have push access to the repository and the project's CI/CD (GitHub Actions) is used to deploy `apps/api` to App Service.
- The admin route code exists in `apps/api/src/routes/admin/gpuStatus.ts` and the router is registered in `apps/api/src/index.ts`.

Steps

1) Create a feature branch and confirm admin route is present

   ```bash
   git checkout -b add/admin-endpoint
   git add apps/api/src/routes/admin/gpuStatus.ts apps/api/src/index.ts
   git commit -m "chore(admin): add admin diagnostics route"
   git push --set-upstream origin add/admin-endpoint
   # Open a PR and request review
   gh pr create --fill
   ```

2) Configure a short-lived admin token in Azure App Service (recommended)

   - In the Azure Portal, go to your App Service (e.g. `beamlab-backend-node`).
   - Settings → Configuration → Application settings → Add a new setting:
     - Name: `ADMIN_STATUS_TOKEN`
     - Value: a strong random 32-byte hex token (do NOT commit this anywhere).
      - Additionally set `ADMIN_STATUS_ENABLED` to `true` to enable the route (default: `false`).
   - Save and restart the App Service.

   Alternative (Key Vault): put the token into Key Vault and reference it as an App Setting.

3) Ensure build includes `apps/api` and is deployed by CI

   - If your repository uses workspace builds, ensure the workflow building `apps/api` runs on push to the PR merge branch.
   - If you use `yarn build` / `pnpm build` ensure `apps/api` is included.

4) Post-deploy verification

   Locally (use your admin token from step 2):

   ```bash
   ADMIN_TOKEN=the_token_you_created
   curl -H "x-admin-token: $ADMIN_TOKEN" https://<your-app-host>/api/admin/gpu-status | jq .
   ```

   If the endpoint returns 200 and JSON with `autostartEligible`, `vmHealth` and `telemetry` fields, the admin endpoint is live.

5) If endpoint is still 404

   - Check the deployed build artifact: `apps/api/dist` (or compiled JS) contains `routes/admin/gpuStatus.js`.
   - Ensure `apps/api/src/index.ts` registers the router, e.g.: `app.use('/api/admin', adminRouter);`
   - Check App Service logs (`Log Stream` or Application Insights) for startup errors (missing dependencies, TypeScript build errors).

6) Optional: Run automated diagnostic script (on your machine)

   - Use the repository-provided `scripts/gather_gpu_status.sh` (or run the commands below):

   ```bash
   export ADMIN_STATUS_TOKEN=...
   curl -H "x-admin-token: $ADMIN_STATUS_TOKEN" https://<your-app-host>/api/admin/gpu-status | jq . > admin_status.json
   curl https://<your-app-host>/api/health
   ```

Notes & security
- Never commit the `ADMIN_STATUS_TOKEN` into the repo. Use App Settings or Key Vault references.
- Use Reader scope service principals only when you need read-only diagnostics. Contributor is required to start/stop VMs.
- After diagnostics, rotate or remove `ADMIN_STATUS_TOKEN` from App Settings.

If you want, I can prepare the PR branch and open the GitHub PR for you (I will not include secrets). Tell me to `prepare-pr` and I will create the branch and commit the admin route files if missing.
