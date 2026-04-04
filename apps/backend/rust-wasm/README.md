# Backend Rust WASM (apps/backend/rust-wasm)

Rust crate targeting WASM/rlib for in-process compute (browser/edge/Node). No HTTP server.

## Build (WASM)
- ./build_wasm.sh
- ./build_civil_wasm.sh

## Notes
- Exports JS/WASM bundle in pkg/ for frontend/Node consumers.
- Keep math/solver crates runtime-agnostic; no DB/auth here.
