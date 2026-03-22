# BeamLab Capacity Load Tests

This directory contains staged load tests for estimating **concurrent analysis capacity**.

## Prerequisites

- k6 installed (`brew install k6` on macOS)
- Valid auth token for Node API analysis endpoint (`/api/analysis`)

## Environment Variables

- `BASE_URL` (default: `https://beamlab-backend-node.azurewebsites.net`)
- `AUTH_TOKEN` (required for analysis profiles)
- `ENABLE_ANALYSIS=true` for analysis profiles
- `PROFILE=health|w1|w2|w3|w4`

## Profiles

| Profile | Description | Duration | Target RPS |
|---------|-------------|----------|------------|
| `health` | Health-only baseline, verifies low-latency path | 2 min | – |
| `w1` | Low analysis pressure (constant 2 rps) | 3 min | 2/s |
| `w2` | Medium analysis pressure (constant 5 rps) | 3 min | 5/s |
| `w3` | Burst pressure (ramping 5→20 rps) | 4 min | up to 20/s |
| `w4` | Endurance test (sustained 3 rps for 10 min) | 10 min | 3/s |

`w4` also runs a health sidecar VU to detect if the API stays responsive under sustained load.

## Run Examples

Run from repo root (scripts are in root `package.json`):

```sh
npm run load:capacity:health
AUTH_TOKEN=<token> npm run load:capacity:w1
AUTH_TOKEN=<token> npm run load:capacity:w2
AUTH_TOKEN=<token> npm run load:capacity:w3
AUTH_TOKEN=<token> npm run load:capacity:w4

# Phase 8 (recommended): run w2 + w3 in one go and write reports under tests/load/reports/
AUTH_TOKEN=<token> npm run load:phase8

# Optional endurance in same run
AUTH_TOKEN=<token> npm run load:phase8 -- --include-w4

# Health-only baseline (no auth token required)
npm run load:phase8 -- --health-only

# Run w2 and print capacity recommendation in one command:
AUTH_TOKEN=<token> npm run load:full
```

Export machine-readable summary manually:

```sh
k6 run tests/load/capacity-staged.js \
  --env PROFILE=w2 --env ENABLE_ANALYSIS=true \
  --env AUTH_TOKEN=<token> \
  --summary-export ./k6-summary.json

node tests/load/capacity-summary.mjs ./k6-summary.json
# Or pass explicit concurrency override:
node tests/load/capacity-summary.mjs ./k6-summary.json --concurrency 80
```

## Output Interpretation

`capacity-summary.mjs` emits JSON with:

- `safe_concurrent_analysis_jobs` (70% of measured max concurrency)
- `stretch_concurrent_analysis_jobs` (85%)
- `burst_concurrent_analysis_jobs` (100%)

**SLO pass criteria:**
- P95 analysis latency ≤ 3000 ms
- HTTP failure rate < 1%
- HTTP 5xx rate < 1%
- HTTP 429 rate < 5%

Use safe/stretch/burst numbers as operational guardrails. After any scaling change
(new instance tier, Rayon/Tokio thread counts, backpressure limits), re-run w2 or
w3 and compare the new capacity numbers to the previous baseline.

## Recommended Test Cadence

1. After each infrastructure change: run `w2` (3 min, medium pressure)
2. After each software release: run `w3` (burst — catches regressions)
3. Weekly on staging: run `w4` (endurance — catches slow memory leaks)
