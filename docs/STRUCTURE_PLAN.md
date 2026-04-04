# Repository structure plan

## Target layout (production organization)
- `apps/frontend/`
- `apps/backend/` (grouped services)
	- `node/`
	- `python/`
	- `rust-api/`
	- `rust-wasm/`
- `packages/` → shared libs (analysis, schema, solver, etc.)
- `scripts/` → operational scripts
- `configs/` → shared base configs
- `docs/` → architecture and runbooks

## Configs (to add under `configs/`)
- `tsconfig.base.json`
- `eslint.base.mjs`
- `prettier.config.js`
- `turbo.json` (root) referencing apps/packages
- `docker-compose.template.yml`
- `nginx.base.conf`

## Policy
- pnpm as single package manager; remove stray npm lockfiles if found.
- No committed artifacts: node_modules, deploy zips/logs/bundles are gitignored.
- Per-service env examples only; secrets via vault.
