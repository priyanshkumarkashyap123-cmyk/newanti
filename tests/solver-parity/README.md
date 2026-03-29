# Solver Parity Harness

Quick parity harness to compare Rust and Python solver outputs on canonical fixtures.

Prereqs
node tools/solver-parity/run_parity.cjs
- Python FastAPI backend running locally (default: `http://localhost:8000`)
- Rust API running locally (default: `http://localhost:3002`)
node tools/solver-parity/run_parity.cjs tests/solver-parity/fixtures
Run
# Rust in-process (no HTTP)
cd apps/rust-api && cargo run --bin solver-parity -- --fixture ../../tests/solver-parity/fixtures/basic_frame.json

# WASM (local, no HTTP)
cd packages/solver-wasm && npm run build
node tools/solver-parity/wasm_run.mjs tests/solver-parity/fixtures/basic_frame.json

```bash
# from repo root
node tools/solver-parity/run_parity.js

# or point to a fixtures directory
node tools/solver-parity/run_parity.js tests/solver-parity/fixtures
```

Environment variables
- `PYTHON_API_URL` — base URL for Python API (default `http://localhost:8000`)
- `RUST_API_URL` — base URL for Rust API (default `http://localhost:3002`)

Add fixtures as JSON files under `tests/solver-parity/fixtures`. Each fixture should follow the Rust `AnalysisInput` shape (fields: `nodes`, `members`, `supports`, `loads`). Include `tolerance_mm` in the top-level fixture to control pass/fail criteria.
