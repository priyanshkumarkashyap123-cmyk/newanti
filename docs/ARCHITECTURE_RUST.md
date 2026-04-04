# Rust components overview

## apps/rust-api
- Role: Axum-based network service exposing structural analysis/design endpoints (compute backend over HTTP).
- Responsibilities: routing, auth/rate-limit, caching, DB (Mongo) access, OpenAPI, health/readiness/metrics, solver core, design code checks.
- Runtime: long-lived service (e.g., port 3002), deployed alongside Node API (auth/payments) and Python service.
- Consumers: frontend and Node via HTTP; shared Mongo database.

## apps/backend-rust
- Role: Rust crate with WASM + rlib build for in-process/edge/browser compute; no HTTP server or DB.
- Responsibilities: exports solver/analysis functions via wasm-bindgen; packaged JS/WASM in `pkg/` for frontend/Node consumption.
- Runtime: embedded (browser/edge/serverless/Node), no auth/DB.
- Consumers: frontend and Node via JS/WASM bundle.

## Boundary decision
- Keep both: they target different delivery channels.
  - `rust-api` = networked compute service.
  - `backend-rust` = embedded/WASM library.
- Do not merge: packaging, runtime, and responsibilities differ.

## Optional convergence
- If desired, share solver crates: extract common solver modules into a workspace crate consumed by both `rust-api` and `backend-rust` to reduce duplication while keeping delivery separation.
