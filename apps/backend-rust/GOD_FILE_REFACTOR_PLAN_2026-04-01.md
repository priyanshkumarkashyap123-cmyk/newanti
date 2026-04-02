# Backend Rust God File Refactor Plan (2026-04-01)

## Scope
- Root scanned: `apps/backend-rust/src`
- Files scanned: 328
- Thresholds: WARN >= 800 lines, FAIL >= 1200 lines
- Current status:
  - FAIL: 37 files
  - WARN: 183 files
  - OK: 108 files

## Critical Fail Files (all >= 1200 lines)
1. src/solver_3d.rs (4416)
2. src/solver_3d/mod.rs (2975)
3. src/advanced_numerical_methods.rs (2498)
4. src/industry_complete_parity.rs (2401)
5. src/nongaussian_transforms.rs (2131)
6. src/nafems_benchmarks.rs (2126)
7. src/civil_engineering/rendering.rs (1969)
8. src/model_import.rs (1886)
9. src/industry_gaps_closure.rs (1797)
10. src/section_database.rs (1731)
11. src/cad_export.rs (1679)
12. src/nafems_benchmarks_extended.rs (1678)
13. src/special_functions.rs (1644)
14. src/hysteretic_models.rs (1622)
15. src/lib.rs (1620)
16. src/advanced_matrix_decompositions.rs (1586)
17. src/sparse_solver_advanced.rs (1522)
18. src/production_engineering_calcs.rs (1510)
19. src/sparse_solver.rs (1384)
20. src/out_of_core_solver.rs (1382)
21. src/six_sigma_quality.rs (1381)
22. src/advanced_foundation_design.rs (1325)
23. src/ml_optimization_engine.rs (1321)
24. src/load_combinations.rs (1308)
25. src/solid_elements.rs (1305)
26. src/robust_eigenvalue_solver.rs (1287)
27. src/cache_optimized_sparse.rs (1274)
28. src/deep_excavation.rs (1267)
29. src/sparse_multifidelity.rs (1266)
30. src/modeling_rendering.rs (1263)
31. src/advanced_sampling.rs (1254)
32. src/ifc_export.rs (1227)
33. src/mesh_generation_production.rs (1219)
34. src/ground_improvement.rs (1211)
35. src/robust_design_optimization.rs (1211)
36. src/member_diagrams.rs (1209)
37. src/moving_loads.rs (1208)

## Work Already Applied
- Added audit script: `scripts/audit_rust_god_files.py`
- Added npm scripts:
  - `check:rust:god-files`
  - `check:rust:god-files:enforce`
- Reduced top-level declaration bloat in `src/lib.rs` by extracting module declarations into `src/module_manifest.rs`
- Introduced shared integration utilities in `src/wasm_exports_common.rs`:
  - centralized parse/serialize contracts for WASM exports
  - shared defaulting helpers for runtime inputs
  - shared 3D result sanitization logic to preserve solver output integrity
  - removed repeated glue code from multiple `src/lib.rs` endpoints
- Expanded migration scope in `src/lib.rs` to cover major export families:
  - 2D frame exports (`solve_structure_wasm`, `solve_2d_frame_with_loads`)
  - 3D/frame dynamic exports (`solve_3d_frame_extended`, `modal_analysis`, `solve_response_spectrum`, `solve_p_delta_extended`, `analyze_buckling`)
  - load combination export (`combine_load_cases`)
  - benchmark exports (`solve_ultra_fast`, `benchmark_ultra_fast`, `run_nafems_*`, `run_real_benchmarks`)
  - pushover export (`solve_pushover`)

## Integration Outcomes (current)
- Shared input/output contracts now sit in one module (`src/wasm_exports_common.rs`) instead of being copy-pasted across exports.
- Endpoint integration is now uniform: parse -> normalize/default -> analyze -> sanitize (if needed) -> serialize.
- Future module splits can move endpoint logic without duplicating parse/serialize boilerplate.

## Refactor Strategy
- Rule 1: Any file >= 1200 lines must be split in priority order.
- Rule 2: Keep public API stable while extracting internals.
- Rule 3: Split by responsibility first, then by algorithms.
- Rule 4: Add per-module unit tests before moving next chunk.
- Rule 5: Before splitting any large file, extract repeated integration logic into shared utility modules to prevent copy-paste across new modules.

## Priority Batches

### Batch A (Core Risk)
- `src/solver_3d.rs`
- `src/solver_3d/mod.rs`
- `src/lib.rs`
- `src/nafems_benchmarks.rs`
- `src/nafems_benchmarks_extended.rs`

Target structure:
- `src/solver_3d/assembly.rs`
- `src/solver_3d/loads.rs`
- `src/solver_3d/postprocess.rs`
- `src/solver_3d/envelope.rs`
- `src/solver_3d/buckling.rs`
- `src/solver_3d/pdelta.rs`
- `src/lib_exports/wasm_2d.rs`
- `src/lib_exports/wasm_3d.rs`
- `src/lib_exports/benchmarks.rs`

### Batch B (Numerics)
- `src/advanced_numerical_methods.rs`
- `src/special_functions.rs`
- `src/advanced_matrix_decompositions.rs`
- `src/sparse_solver_advanced.rs`
- `src/sparse_solver.rs`

Target structure:
- `src/numerics/integration.rs`
- `src/numerics/optimization.rs`
- `src/numerics/decompositions.rs`
- `src/numerics/special_fn.rs`
- `src/numerics/sparse/preconditioners.rs`
- `src/numerics/sparse/iterative.rs`

### Batch C (Domain Packs)
- Industry/code packs and CAD/IFC packs split into focused modules by feature.

## Definition Of Done
- No file in `apps/backend-rust/src` above 1200 lines.
- Batch A files each below 900 lines.
- `check:rust:god-files:enforce` passes in CI.
- Public exports unchanged or migration shim provided.

## Phase 1 Kickoff (Started 2026-04-02)

### Target 1: `src/model_import.rs` (1886)

Current structure snapshot:
- Data types + enums for imported model objects
- `StaadParser` implementation block
- `IfcParser` implementation block
- Public API: `import_model`, `detect_format`, `validate_model`

Planned extraction map:
- `src/model_import/types.rs`
  - `ImportedModel`, unit enums/structs, imported node/element/material/section/support/load DTOs
  - `ImportWarning`, `ImportError`
- `src/model_import/staad.rs`
  - `StaadParser` + all STAAD parsing helpers
- `src/model_import/ifc.rs`
  - `IfcParser`, `IfcEntity`, IFC parse/resolve helpers
- `src/model_import/validate.rs`
  - `validate_model` and validation-only helpers
- `src/model_import/api.rs`
  - `import_model`, `detect_format`, thin façade glue
- `src/model_import/mod.rs`
  - stable re-exports preserving public API

Execution slices:
1. Move DTO/type declarations to `types.rs` and re-export.
2. Move `validate_model` to `validate.rs` with no behavior change.
3. Move `StaadParser` block to `staad.rs`.
4. Move `IfcParser` block to `ifc.rs`.
5. Keep `import_model` and `detect_format` in `api.rs` and route through re-exports.

Risk controls:
- Preserve all field names and enum variants exactly.
- Keep error/warning codes unchanged.
- Keep `import_model` signature and default detection behavior unchanged.

### Target 2: `src/advanced_numerical_methods.rs` (2498)

Current structure snapshot:
- Root finding family
- Integration/quadrature family
- Differentiation and Jacobian/Hessian helpers
- Interpolation/spline/polynomial helpers
- Optimization family
- ODE solvers (`rk4`, `rk45`)
- Large in-file test module

Planned extraction map:
- `src/numerics/root_finding.rs`
  - Newton variants, bisection/secant/brent/ridders/illinois
- `src/numerics/integration.rs`
  - Gauss-Legendre/Lobatto, adaptive Simpson, Romberg, Clenshaw-Curtis, Gauss-Kronrod
- `src/numerics/differentiation.rs`
  - finite differences, Richardson, gradient/hessian/jacobian
- `src/numerics/interpolation.rs`
  - Horner, Chebyshev, Lagrange/barycentric/Newton interpolation, spline coeff/eval
- `src/numerics/optimization.rs`
  - golden section, Brent minimization, gradient descent, BFGS
- `src/numerics/ode.rs`
  - `OdeResult`, `rk4`, `rk45`
- `src/numerics/mod.rs`
  - shared result structs + re-exports

Execution slices:
1. Extract result structs (`RootResult`, `IntegrationResult`, `OptimizationResult`, `OdeResult`) to `numerics/mod.rs`.
2. Move root-finding family.
3. Move integration family.
4. Move differentiation + interpolation family.
5. Move optimization + ODE family.
6. Split tests by module and keep original test names where feasible.

Risk controls:
- Preserve algorithm defaults and tolerances exactly.
- Keep deterministic behavior for tests (same seeds/iteration caps).
- Keep function signatures unchanged via `pub use` in `numerics/mod.rs`.

### Immediate Next Step
- Execute Slice 1 for `src/model_import.rs` first (types + warnings/errors extraction), then run compile/error checks before proceeding.
