# Rust Adapter (Backend Python)

Rust is the only solver. This adapter provides the HTTP client used by facades and routers.

- Use `from analysis.rust_interop import analyze_with_best_backend` (backward compatible) or import directly from `analysis.adapters.rust.client`.
- `SolverBackend.PYTHON` is deprecated; AUTO and PYTHON both resolve to Rust.
- Do not add Python solver fallbacks.

Entrypoints:
- `RustInteropClient.analyze(model, analysis_type="static", backend=SolverBackend.AUTO)`
- `analyze_with_best_backend(model, analysis_type)` via the facade
- `get_rust_client()` for shared client
