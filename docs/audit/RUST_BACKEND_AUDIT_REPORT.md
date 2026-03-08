# Rust Backend Comprehensive Audit Report

**Date:** 2026-02-28  
**Auditor:** GitHub Copilot (Claude Opus 4.6)  
**Scope:** `apps/backend-rust/` (WASM engine) and `apps/rust-api/` (HTTP API server)

---

## Executive Summary

The Rust backend consists of two projects:

| Project | Files | Lines of Code | Purpose | Overall Assessment |
|---------|-------|---------------|---------|-------------------|
| `backend-rust` | 273 `.rs` + 19 civil_engineering | **284,524** | WASM structural solver | **PARTIAL** — Core solver is REAL; ~80% of specialty modules are PARTIAL to FAKE |
| `rust-api` | 28 `.rs` | **11,323** | Axum HTTP API server | **REAL** — Production-grade API with working solver |

**Critical findings: 5 | High: 12 | Medium: 18 | Low: 14**

---

## 1. Project Classification Summary

### `apps/rust-api/` — HTTP API Server: **REAL (Production-Grade)**

The Axum-based API is genuinely functional:
- ✅ Working 3D frame solver with 6-DOF direct stiffness method
- ✅ Parallel matrix assembly via Rayon
- ✅ MongoDB persistence with proper connection handling
- ✅ Rate limiting (Governor), security headers, CORS
- ✅ JWT authentication infrastructure
- ✅ Modal, P-Delta, cable, seismic analysis endpoints
- ✅ 140 integration/unit tests across 5 test files

### `apps/backend-rust/` — WASM Solver Engine: **PARTIAL (Mixed Quality)**

| Category | Files | Status |
|----------|-------|--------|
| **Core solver** (`solver.rs`, `solver_3d.rs`, `lib.rs`) | 3 | **REAL** — Working 2D/3D frame analysis |
| **Design codes** (`design_codes.rs`, `code_checking.rs`) | ~5 | **REAL** — IS 456, IS 800, IS 1893, AISC 360 implemented correctly |
| **Dynamics** (`dynamics.rs`) | 1 | **PARTIAL** — Eigenvalue solver works but mode shapes not returned, seismic uses mock masses |
| **Geometric nonlinearity** (`geometric_nonlinearity.rs`) | 1 | **REAL** — Corotational formulation, quaternions, geometric stiffness |
| **Specialty enginering modules** (~230 files) | ~230 | **PARTIAL to FAKE** — Structs and enums defined, algorithms simplified or stubbed |
| **AI modules** (`ai_architect.rs`, `ai_guardrails.rs`) | 2 | **FAKE/STUB** — `ai_architect` returns `format!("IPE {}", ...)` |
| **Multi-physics coupling** | 1 | **FAKE** — Solve methods return hardcoded `converged: true` |
| **Parallel computing** | 1 | **FAKE** — FETI solver returns `f * 0.001` placeholder |
| **P-Delta buckling** (`pdelta_buckling.rs`) | 1 | **PARTIAL** — Uses Jacobi iteration placeholder instead of real sparse solver |
| **Renderer** | 1 | **STUB** — Explicit no-op stubs for Three.js delegation |
| **Mesh adaptation** | 1 | **REAL** — Proper Dörfler marking, red/green refinement |
| **Fluid-structure interaction** | 1 | **PARTIAL** — Coupling framework is real, flutter eigenvalue solve returns dummy values |

---

## 2. Findings by Severity

### CRITICAL (5)

#### C1. Credentials Committed to Repository
- **File:** [apps/rust-api/.env](apps/rust-api/.env)
- **Line:** 8-9
- **Detail:** MongoDB connection URI with username `beamlab_admin` and password `<yLCaEABYdoy5yKYd>` is present in the `.env` file. While `.gitignore` has `*.env`, the file exists in the workspace and has been accessible.
- **JWT secret** on L12 is a static string: `beamlab-rust-secret-key-change-in-production`
- **Impact:** Full database access compromise, ability to forge authentication tokens
- **Fix:** Rotate MongoDB credentials immediately. Use vault/env injection in production.

#### C2. Unsafe Static Mutable State (Data Races)
- **Files:** 
  - [apps/backend-rust/src/data_export.rs](apps/backend-rust/src/data_export.rs#L482-L487) — `static mut COUNTER` for IFC GUID generation
  - [apps/backend-rust/src/optimization_engine.rs](apps/backend-rust/src/optimization_engine.rs#L912-L921) — `static mut SEED` for PRNG
  - [apps/backend-rust/src/report_visualization.rs](apps/backend-rust/src/report_visualization.rs#L723-L728) — `static mut SEED` for report IDs
- **Detail:** Three `unsafe` blocks mutate `static mut` variables. In WASM this is single-threaded so technically safe, but this is undefined behavior in Rust's memory model and will cause data races if compiled for native multi-threaded use.
- **Fix:** Use `AtomicU64` or `std::sync::Mutex<u64>` instead.

#### C3. Incorrect Shear Modulus Formula (rust-api)
- **File:** [apps/rust-api/src/solver/mod.rs](apps/rust-api/src/solver/mod.rs#L588)
- **Line:** 588
- **Detail:** `let gj_l = e * j / (2.6 * l);` comments "Approximate G = E/2.6". The correct formula is $G = \frac{E}{2(1+\nu)}$. For steel ($\nu = 0.3$): $G = E/2.6$ is exactly correct. **However**, for concrete ($\nu = 0.2$): $G = E/2.4$, for aluminum ($\nu = 0.33$): $G = E/2.66$. This hardcoded value will produce **8% error** for concrete and other materials.
- **Impact:** Incorrect torsional stiffness for non-steel materials, leading to wrong member forces.
- **Fix:** Accept Poisson's ratio as input or separate shear modulus `G` per member.

#### C4. Reaction Computation Bug (rust-api)
- **File:** [apps/rust-api/src/solver/mod.rs](apps/rust-api/src/solver/mod.rs#L476-L490)
- **Lines:** 476-490
- **Detail:** Reactions are computed as `fx: if support.fx { -f[base] } else { 0.0 }` — this simply negates the applied load vector, NOT computing $R = K \cdot u - F$. This means reactions will be **wrong** whenever loads are not applied directly at support nodes (which is most real structures).
- **Impact:** Incorrect support reactions returned to users. The backend-rust WASM solver (`solver.rs` L230) does this correctly.
- **Fix:** Compute reactions from the full stiffness matrix: `R = K_full * u - F` for restrained DOFs.

#### C5. Modal Analysis Returns Empty Mode Shapes (backend-rust)
- **File:** [apps/backend-rust/src/dynamics.rs](apps/backend-rust/src/dynamics.rs#L208-L210)
- **Lines:** 208-210
- **Detail:** `solve_eigenvalues()` computes eigenvalues correctly but returns `mode_shapes: vec![]` and `mass_participation: vec![]` with a comment "Let's return raw vector logic placeholder". The frequencies are valid but mode shapes — essential for response spectrum analysis — are never populated.
- **Impact:** Any downstream analysis depending on mode shapes (seismic, vibration) will fail or produce empty results.

---

### HIGH (12)

#### H1. Seismic Analysis Uses Mock Effective Weights
- **File:** [apps/backend-rust/src/dynamics.rs](apps/backend-rust/src/dynamics.rs#L260-L267)
- **Lines:** 260-267
- **Detail:** `calculate_response_spectrum()` uses `let effective_weight = if i == 0 { 100000.0 } else { 10000.0 }; // Mock weight (kN)` instead of computing actual modal participation factors. The Z-direction shear is hardcoded as `0.3 × X-direction`.
- **Impact:** Seismic base shear results are completely fictitious.

#### H2. Consistent Mass Matrix is Zero
- **File:** [apps/backend-rust/src/dynamics.rs](apps/backend-rust/src/dynamics.rs#L112-L114)
- **Lines:** 112-114
- **Detail:** `consistent_mass_frame()` is declared but returns `DMatrix::zeros(12, 12)`. The code is commented to use consistent mass "for higher accuracy in dynamics" but then falls back to lumped mass. The return value is stored in `_m_local` (unused).
- **Impact:** Only lumped mass is available. Not a bug per se (lumped is valid) but the function is dead, misleading code.

#### H3. Flutter Analysis Returns Dummy Eigenvalues
- **File:** [apps/backend-rust/src/fluid_structure_interaction.rs](apps/backend-rust/src/fluid_structure_interaction.rs#L607-L614)
- **Lines:** 607-614
- **Detail:** `solve_eigenvalue_problem()` returns hardcoded `frequencies = vec![10.0, 25.0, 50.0]` and `dampings = vec![-0.01, -0.02, -0.03 + 0.001 * dynamic_pressure]`. No actual complex eigenvalue solve is performed.
- **Impact:** Flutter velocity predictions are meaningless.

#### H4. P-Delta Buckling Uses Jacobi Placeholder Solver
- **File:** [apps/backend-rust/src/pdelta_buckling.rs](apps/backend-rust/src/pdelta_buckling.rs#L273-L290)
- **Lines:** 273-290
- **Detail:** The `solve_system()` method uses 100 iterations of Jacobi method (single-DOF Gauss-Seidel) as a "placeholder." Jacobi iteration for structural stiffness matrices has poor convergence and won't converge for most real structures.
- **Impact:** P-Delta iteration will produce inaccurate or non-converging results.

#### H5. FETI Solver Returns Scaled Forces
- **File:** [apps/backend-rust/src/parallel_computing.rs](apps/backend-rust/src/parallel_computing.rs#L642)
- **Line:** 642
- **Detail:** `solve_feti()` returns `global_f.iter().map(|&f| f * 0.001).collect()` — literally scaling the force vector by 0.001 and returning it as "displacements."
- **Impact:** Any code using the FETI solver will get meaningless results.

#### H6. Multi-Physics Solver is Non-Functional
- **File:** [apps/backend-rust/src/multi_physics_coupling.rs](apps/backend-rust/src/multi_physics_coupling.rs#L408-L461)
- **Lines:** 408-461
- **Detail:** `solve_monolithic()` returns `converged: true` with zero residuals without doing any computation. `solve_sequential()` and `solve_parallel()` are similarly empty. Only iterative coupling has loop structure but delegates to the empty sequential solver.

#### H7. `ai_architect.rs` is Entirely Fake
- **File:** [apps/backend-rust/src/ai_architect.rs](apps/backend-rust/src/ai_architect.rs#L21-L26)
- **Lines:** 21-26
- **Detail:** `suggest_beam_size()` returns `format!("IPE {}", (span * load / 10.0).round())`. This is not connected to any ML model, section database, or optimization algorithm. The beam suggestion has no engineering basis.

#### H8. 335 `.unwrap()` Calls Across Backend-Rust
- **Files:** Across all 273 source files
- **Detail:** 335 calls to `.unwrap()` exist. While most are in test code, some are in production paths (e.g., `solver.rs:175`, `member_diagrams.rs:839`, `moving_loads.rs:801`). In a WASM context, unwrap panics abort the WASM module.
- **Impact:** Runtime panics under edge-case inputs.

#### H9. `#![allow(dead_code)]` Crate-Wide Suppression
- **File:** [apps/backend-rust/src/lib.rs](apps/backend-rust/src/lib.rs#L6)
- **Line:** 6
- **Detail:** The crate-level `#![allow(dead_code)]` suppresses all dead code warnings for **284K lines**. This masks genuinely unused code that should be pruned.

#### H10. No Authentication on Analysis Endpoints (rust-api)
- **File:** [apps/rust-api/src/main.rs](apps/rust-api/src/main.rs#L133-L170)
- **Lines:** 133-170
- **Detail:** The JWT middleware (`Claims` struct) is defined in `middleware.rs` but **never applied** to any route. All analysis endpoints (`/api/analyze`, `/api/advanced/*`, `/api/structures/*`) are completely unauthenticated.
- **Impact:** Anyone can run expensive analyses, create/delete structures, and access all data without authentication.

#### H11. CORS Origins Include Development URLs in Production
- **File:** [apps/rust-api/src/main.rs](apps/rust-api/src/main.rs#L101-L106)
- **Lines:** 101-106
- **Detail:** CORS allows `http://localhost:5173` and `http://localhost:3000` alongside production origins. These should be conditional on environment.

#### H12. Hardcoded Static Date in Reports
- **File:** [apps/backend-rust/src/report_visualization.rs](apps/backend-rust/src/report_visualization.rs#L733)
- **Line:** 733
- **Detail:** `fn current_date() -> String { "2025-01-31".to_string() }` — Reports will always show January 31, 2025 regardless of actual date.

---

### MEDIUM (18)

| ID | File | Line(s) | Description |
|----|------|---------|-------------|
| M1 | `solver_3d.rs` | 2370 | Comment: "Since dynamics.rs is a placeholder, we return the dummy result" — awareness of fake code not addressed |
| M2 | `mesh_adaptation.rs` | 532 | "For simplicity, return placeholder" in error estimator |
| M3 | `geometric_nonlinearity.rs` | 553 | "This is a placeholder - full implementation needs proper B_NL matrix" in nonlinear strain |
| M4 | `sensitivity_analysis.rs` | 385 | "Factorize matrix (placeholder)" — sensitivity solver incomplete |
| M5 | `high_performance_computing.rs` | 299 | AMG preconditioner is listed as "placeholder" |
| M6 | `ai_guardrails.rs` | 673 | "This is a placeholder" in hallucination checking function |
| M7 | `bim_ifc_complete.rs` | 784 | Owner history uses `id + 1000` as placeholder |
| M8 | `dynamics.rs` | 143-157 | Zero-mass DOFs get dummy mass of `min_mass * 1e-8` which may corrupt eigenvalue spectrum for structures with many massless DOFs |
| M9 | `design_codes.rs` | 232 | `span_to_depth_ratio()` has `mf_tension = 1.0; mf_compression = 1.0;` simplification — should compute from IS 456 Fig. 4 |
| M10 | `design_codes.rs` | 316 | Steel compression uses only buckling curve "b" (`alpha = 0.34`) — should select curve (a/b/c/d) based on section type per IS 800 Table 10 |
| M11 | `is_875` module | 540+ | `terrain_factor()` is simplified — full IS 875-3 Table 2 has 50+ height/category combinations |
| M12 | `aisc360` module | 660+ | `rts` calculation uses approximation from `Iy * Cw` — fragile for non-I-sections |
| M13 | `advanced_composite.rs` | 646 | "Interpolation per EC4 (simplified)" — unclear what's simplified |
| M14 | `Cargo.toml` (backend-rust) | Various | `proptest` and `criterion` dev-dependencies are **commented out**, eliminating property-based and benchmark testing |
| M15 | `blast_resistant.rs` | 42 | "Kingery-Bulmash polynomial fit (simplified)" — blast loads are safety-critical |
| M16 | `Cargo.toml` (rust-api) | 41 | `nalgebra` versions differ: backend-rust uses 0.33, rust-api uses 0.32 — version mismatch |
| M17 | `optimization_engine.rs` | 910 | Custom PRNG using system time XOR — not suitable for Monte Carlo or optimization sampling |
| M18 | `lib.rs` | 912+ | NaN/Infinity silently replaced with `0.0` in 3D solver results — masks underlying numerical issues |

---

### LOW (14)

| ID | File | Line(s) | Description |
|----|------|---------|-------------|
| L1 | `Cargo.toml` | 93 | `wasm-opt = false` — WASM optimizer disabled, larger bundle size |
| L2 | `lib.rs` | 8 | `#![allow(non_snake_case)]` globally — common in engineering code but masks naming issues |
| L3 | `renderer.rs` | All | Entire file is explicit stubs (58 lines) — should be documented as intentional delegation |
| L4 | `benchmark_tests.rs` | 480 lines | 480 lines of benchmarks that can never run (criterion is commented out) |
| L5 | `design_codes.rs` | 119 | `_gamma_c` and `_gamma_s` variables declared but unused (prefixed with `_`) |
| L6 | `fluid_structure_interaction.rs` | 584 | `vg_data: Vec::new()` — V-g plot data never populated |
| L7 | `profile.release` | Both | `panic = "abort"` removes stack traces — appropriate for WASM, less ideal for Rust API debugging in production |
| L8 | 273 files | Various | ~166 occurrences of `9.81` hardcoded as gravity — should be a named constant |
| L9 | `data_export.rs` | 485 | IFC GUID format `{:022X}` produces hex, not Base64-encoded as IFC spec requires |
| L10 | `solver_3d.rs` | 4497 lines | Single 4500-line file — should be split into submodules |
| L11 | `lib.rs` | 20-290 | ~270 `pub mod` declarations auto-generated — all modules are public even internal ones |
| L12 | Various | Various | Many files have `use std::collections::HashMap;` imported but unused |
| L13 | `Cargo.toml` (rust-api) | — | No `Cargo.lock` audit; no `cargo deny` or `cargo audit` CI integration |
| L14 | `dynamics.rs` | 306 lines | 306-line file declared as modal analysis — far too thin for what it claims |

---

## 3. Test Coverage Analysis

### `apps/rust-api/` (HTTP API)

| Component | Unit Tests | Integration Tests | Coverage |
|-----------|-----------|-------------------|----------|
| Solver core | 1 | 7 | ⚠️ Minimal |
| Cable analysis | 6 | 33 | ✅ Good |
| P-Delta | 3 | 19 | ✅ Moderate |
| Dynamics/Modal | 2 | 21 | ✅ Moderate |
| Seismic | 6 | 22 | ✅ Moderate |
| Handlers | 0 | 0 | ❌ None |
| Middleware | 0 | 0 | ❌ None |
| Config/DB | 0 | 0 | ❌ None |
| **Total** | **38** | **102** | **~30%** |

### `apps/backend-rust/` (WASM Engine)

| Component | `#[test]` Count | Assessment |
|-----------|----------------|------------|
| All files | 3,007 | ✅ High quantity |
| Core solver | ~50 | ✅ Good |
| Design codes | ~30 | ✅ Good |
| Specialty modules | ~2,900 | ⚠️ Many are trivial/smoke tests |

**Note:** 3,007 tests exist but many test trivial struct construction or assert that fake functions return expected hardcoded values. The tests mirror the code quality — real tests for real modules, superficial tests for superficial modules.

---

## 4. Dependencies Audit

### `apps/backend-rust/Cargo.toml`

| Dependency | Version | Status | Notes |
|-----------|---------|--------|-------|
| `nalgebra` | 0.33 | ✅ Current | Core LA library |
| `nalgebra-sparse` | 0.10 | ✅ Current | Sparse matrices |
| `serde` | 1.0 | ✅ | Standard serialization |
| `wasm-bindgen` | 0.2 | ✅ | WASM bindings |
| `petgraph` | 0.6 | ✅ | Graph algorithms |
| `clarabel` | 0.5 | ⚠️ | Only used by optimization — check if used |
| `uuid` | 1.0 | ✅ | With JS feature for WASM |
| `thiserror` | 1.0 | ✅ | Error handling |
| **Dev-deps** | — | ❌ | `proptest` and `criterion` commented out |

### `apps/rust-api/Cargo.toml`

| Dependency | Version | Status | Notes |
|-----------|---------|--------|-------|
| `axum` | 0.7 | ✅ Current | Web framework |
| `tokio` | 1.35 | ✅ | Async runtime |
| `mongodb` | 2.8 | ✅ | Database driver |
| `nalgebra` | **0.32** | ⚠️ | One version behind backend-rust's 0.33 |
| `rayon` | 1.8 | ✅ | Parallel processing |
| `jsonwebtoken` | 9.2 | ✅ | But not used in middleware |
| `argon2` | 0.5 | ✅ | But not used anywhere |
| `governor` | 0.6 | ✅ | Rate limiting — in use |
| `validator` | 0.16 | ⚠️ | Imported but not used on any request types |

**Unused dependencies in rust-api:** `argon2`, `validator`, `crossbeam` (rayon handles parallelism), `futures` (mostly unused).

---

## 5. Quantitative Summary

| Metric | `backend-rust` | `rust-api` |
|--------|---------------|------------|
| Source files | 292 | 28 |
| Lines of code | 284,524 | 11,323 |
| `#[test]` functions | 3,007 | 140 |
| `unsafe` blocks | 3 | 0 |
| `unwrap()` calls | 335 | ~20 |
| Placeholder markers | ~50 | 1 (stream_analyze TODO) |
| "Simplified" markers | ~120 | 1 |
| `todo!`/`unimplemented!` | 0 | 0 |
| `panic!` in non-test code | 3 | 0 |
| Dead code suppression | Crate-wide | None |

---

## 6. Architectural Observations

1. **Code bloat**: 284K lines for a structural solver is extraordinary. Commercial-grade FEA solvers (STAAD, SAP2000) core engines are in this range but have been developed over decades. Many files appear to have been generated or written by AI to cover topic areas that are not functionally complete.

2. **Dual solver architecture**: Both `backend-rust` (WASM) and `rust-api` (server) implement their own solver independently. The WASM solver is more complete for 2D/3D frame analysis; the API solver has better production hardening (sparse assembly, Rayon parallelism).

3. **No shared library**: The two Rust projects don't share code despite both implementing frame analysis. Solver bugs fixed in one won't be fixed in the other.

4. **Module coupling**: `lib.rs` exposes all 270+ modules as `pub mod`, creating a flat public API surface with no encapsulation.

---

## 7. Priority Recommendations

1. **IMMEDIATE**: Rotate MongoDB credentials and JWT secret (C1)
2. **IMMEDIATE**: Fix reaction computation in rust-api solver (C4)
3. **WEEK 1**: Add authentication middleware to API routes (H10)
4. **WEEK 1**: Fix shear modulus to accept material-specific Poisson's ratio (C3)
5. **WEEK 2**: Complete modal analysis mode shape output (C5)
6. **WEEK 2**: Replace `unsafe` static muts with atomic types (C2)
7. **MONTH 1**: Audit and remove/mark the ~230 specialty modules that are partial/fake
8. **MONTH 1**: Add handler-level integration tests for rust-api
9. **ONGOING**: Establish `cargo audit` in CI pipeline
10. **ONGOING**: Consider extracting shared solver library used by both projects
