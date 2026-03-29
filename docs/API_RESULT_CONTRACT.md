# API Result Contract

This document defines the canonical result payload returned by solver/design APIs and consumed by frontend engines.

Fields
- `passed` (boolean): overall pass/fail result for the check.
- `utilization` (number|null): utilization ratio (>=0, where 1.0 means capacity reached). Use `null` if not applicable.
- `message` (string, optional): human-readable summary.
- `diagnostics` (object, optional): machine-readable diagnostics for debugging and observability. Suggested fields:
  - `solver`: string (e.g., `rust-api`, `python-solver`, `wasm`)
  - `iterations`: number
  - `tolerance`: number
  - `conditionEstimate`: number
  - `fallback`: string
  - `warnings`: array of strings
- `version` (string, optional): semantic version of the result contract implementation.

Usage
- All services must produce this shape for structural solver responses. Frontend engines should prefer `diagnostics` for telemetry and show `message` to users.

Numeric tolerances and comparison guidance
- When comparing cross-runtime values (Rust/Python/WASM), use relative tolerance of 1e-6 for displacements and 1e-3 for aggregated utilization ratios, unless test fixture specifies otherwise.
