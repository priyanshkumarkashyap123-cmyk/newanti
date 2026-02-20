# Contributing to BeamLab Ultimate

Thank you for your interest in contributing! This guide will help you get started.

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0 (`corepack enable && corepack prepare pnpm@10.25.0 --activate`)
- **Rust** stable toolchain (for `backend-rust` / `rust-api`)
- **Python** 3.11+ (for `backend-python`)
- **Docker** & Docker Compose (for full-stack local development)

## Getting Started

```bash
# 1. Clone the repository
git clone <repo-url> && cd beamlab-ultimate

# 2. Install dependencies
pnpm install

# 3. Copy environment files
cp .env.docker.example .env
cp apps/web/.env.example apps/web/.env.local

# 4. Start the full stack
docker compose up -d

# 5. Or run just the frontend in dev mode
pnpm dev
```

## Project Structure

```
apps/
  web/           → React + Vite frontend (TypeScript)
  api/           → Node.js Express API (auth, payments, projects)
  backend-python/→ FastAPI (AI, analysis engine, design)
  rust-api/      → Axum high-perf API (analysis, data)
  desktop/       → Electron desktop app
packages/
  analysis/      → Shared analysis engine
  solver/        → Core structural solver
  solver-wasm/   → WASM-compiled solver
```

## Development Workflow

### Branch Naming

- `feat/description` — New features
- `fix/description` — Bug fixes
- `chore/description` — Maintenance, config, CI
- `docs/description` — Documentation only

### Commit Messages

We enforce [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(solver): add P-delta geometric stiffness
fix(auth): handle expired refresh tokens gracefully
chore(ci): enable Dependabot for npm ecosystem
docs(api): update OpenAPI spec for billing endpoints
```

Commitlint runs automatically via Husky pre-commit hooks. Your PR will fail CI if commit messages don't conform.

### Pull Request Process

1. Create a branch from `main`
2. Make your changes with proper commit messages
3. Ensure all checks pass locally: `pnpm validate`
4. Open a PR against `main` using our [PR template](.github/PULL_REQUEST_TEMPLATE.md)
5. Wait for CI to pass (typecheck, lint, tests, build)
6. Request review from a code owner (see [CODEOWNERS](.github/CODEOWNERS))

### Running Tests

```bash
# All tests
pnpm test:run

# Frontend unit tests with coverage
cd apps/web && pnpm test:run -- --coverage

# E2E tests (requires build first)
cd apps/web && pnpm build && pnpm test:e2e

# Regression tests (structural solver validation)
pnpm --filter @beamlab/web test:regression

# Rust backend tests
cd apps/rust-api && cargo test --all-features
```

### Code Quality

```bash
# Type check
pnpm type-check

# Lint
pnpm lint

# Full validation (lint + typecheck + test)
pnpm validate
```

## Architecture Guidelines

- **Frontend components**: Use TypeScript strict mode. All new components must have corresponding test files.
- **API routes**: Validate all input with Zod schemas. Return responses via `res.ok()` / `res.fail()` helpers.
- **Solver code**: Must include regression tests validating against known analytical solutions to ≤ 0.1% tolerance.
- **Security**: Never commit secrets. Never use hardcoded fallback keys. Use `process.env['KEY']` and crash if missing in production.

## Reporting Issues

Use our [issue templates](.github/ISSUE_TEMPLATE/) for:
- **Bug reports** — Include steps to reproduce, expected vs. actual behavior
- **Feature requests** — Describe the use case and proposed solution

## Code of Conduct

Be respectful, constructive, and professional. We are building safety-critical engineering software — precision, correctness, and thoroughness matter.
