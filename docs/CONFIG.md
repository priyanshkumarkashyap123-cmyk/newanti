# Configuration and environment policy

## Principles
- No secrets in repo. Use vault/OIDC (e.g., Key Vault + GitHub OIDC) for secrets.
- Checked-in env files are non-secret and stage-specific.
- Single source of truth for shared config; per-service overrides extend it.

## Files
- Root examples: `.env.example`, `.env.local`, `.env.staging`, `.env.production` (non-secret only). Include shared URLs/feature flags.
- Service examples (non-secret):
  - `apps/api/.env.example`
  - `apps/api/.env.production.example`
  - `apps/web/.env.example`
  - `apps/backend-python/.env.example`
  - `apps/rust-api/.env.example`
  - `apps/backend-rust/.env.example` (if needed for build flags)
- Secrets live in vault and are injected at deploy/runtime. Do not commit publish profiles or keys.

## Consumption order (local dev)
1) Per-service `.env.local` (gitignored) for developer-specific values.
2) Stage file (`.env.staging` or `.env.production`) for non-secret stage config.
3) Secret provider (vault) for sensitive values.

## Deployment expectations
- CI loads non-secret stage config from checked-in files and secrets from the secret store.
- Each service documents required variables in its `.env.example`.
- Health/readiness endpoints and ports are consistent and configurable via env.
