# Analysis Module Deprecation (Rust-Only)

Python-based solvers and load engines are removed. The Rust backend is the sole solver.

## Current state
- Python nonlinear/P-Delta/buckling/advanced routers return **410 Gone** and are no longer included; Rust proxy endpoints are authoritative.
- Deprecated Python solver modules removed: `analysis/plate_element.py`, `analysis/solvers/nonlinear.py`, `analysis/solvers/buckling.py`, `analysis/solvers/cable.py`.
- `analysis/solvers/__init__.py` now only exports RC LSD helpers; advanced exports removed.
- `analysis/__init__.py` imports align to Rust-first; `import analysis` passes.
- Legacy direct-analysis tests are module-skipped; Rust proxy smoke test added (skips without `RUST_API_URL`).

## Do not use
- Do not re-enable Python solver paths.
- Do not import PyNite/Scipy solver wrappers for new code.

## Use instead
- Call the Rust backend via `RustInteropClient` (or successor adapter) for all analysis.
- Keep new facades thin: map request payloads → Rust payloads → return Rust responses.

## Next steps
- Migrate `rust_interop.py` into `analysis/adapters/rust/client.py` with a facade in `analysis/facades/`.
- Update any remaining imports of Python solver classes to Rust proxies or remove them.
