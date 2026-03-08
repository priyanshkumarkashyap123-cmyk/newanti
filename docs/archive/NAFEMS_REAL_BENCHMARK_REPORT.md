# NAFEMS Real Benchmark Report — BeamLab

> **Generated**: Session complete  
> **Status**: ALL 11/11 TESTS PASS (10 benchmarks + 1 meta-report)  
> **Methodology**: Every benchmark builds a real FE model, calls the actual solver, and compares results to analytical closed-form solutions.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total real benchmarks | 10 |
| Passed | 10 |
| Failed | 0 |
| Pass rate | **100.0%** |
| Max error | **0.0000%** |
| Solvers used | 3 (3D Frame DSM, Quad4 Thermal FEM, Hex8 Solid FEM) |

### What "Real" Means

Every benchmark in this report follows this pipeline:

1. **Build** a finite element model (nodes, elements, materials, BCs, loads)
2. **Assemble** the global stiffness matrix from element stiffness matrices
3. **Solve** `Ku = F` via LU decomposition (nalgebra) or Gauss elimination
4. **Extract** the quantity of interest (displacement, reaction, temperature, stress)
5. **Compare** against an independently derived analytical solution

Nothing is hard-coded. If you change E, L, or P, the result changes.

---

## Solvers Verified

### 1. 3D Frame Solver (`solver_3d.rs` — `analyze_3d_frame`)
- **Method**: Direct Stiffness Method with 6-DOF beam-column elements
- **Matrix**: nalgebra `DMatrix<f64>`, LU decomposition
- **Capabilities**: Frames, trusses, cables; point/distributed/temperature loads; member-end releases; spring supports
- **Benchmarks**: BM-1, BM-2, BM-3, BM-4, TR-1, FR-1

### 2. Quad4 Thermal Solver (`thermal_analysis.rs` — `SteadyStateThermal::solve`)
- **Method**: Galerkin FEM with 4-node isoparametric quadrilateral elements
- **BCs**: Penalty method (1×10¹⁰ × max diagonal) for temperature BCs
- **Solver**: Gauss elimination with partial pivoting
- **Benchmarks**: TH-1, TH-2

### 3. Hex8 Solid Solver (`solid_solver.rs` — `solve_solid_model`)
- **Method**: 8-node isoparametric hexahedral elements with 2×2×2 Gauss quadrature
- **Formulation**: Standard displacement-based, D·B approach, full 6-component stress/strain
- **Solver**: nalgebra `DMatrix<f64>`, LU decomposition
- **Assembly**: Created in this session to connect `solid_elements.rs` Hex8Element to a global solve pipeline
- **Benchmarks**: SE-1, SE-2

---

## Benchmark Results

### Structural Benchmarks (3D Frame Solver)

| ID | Name | Expected | Computed | Error | Status |
|----|------|----------|----------|-------|--------|
| BM-1 | Cantilever beam, tip point load | δ = PL³/3EI = 6.3492×10⁻⁴ m | 6.3492×10⁻⁴ m | 0.0000% | ✅ PASS |
| BM-2 | Simply-supported beam, UDL | δ = 5wL⁴/384EI = 1.6276×10⁻³ m | 1.6276×10⁻³ m | 0.0000% | ✅ PASS |
| BM-3 | Propped cantilever, UDL (statically indeterminate) | R_A = 5wL/8 = 31,250 N | 31,250 N | 0.0000% | ✅ PASS |
| BM-4 | Two-span continuous beam, midspan loads | R_A = 5P/16 = 31,250 N | 31,250 N | 0.0000% | ✅ PASS |
| TR-1 | Two-bar symmetric truss | U_y at loaded node | Exact match | 0.0000% | ✅ PASS |
| FR-1 | Portal frame, lateral load | ΣFx = 0, equilibrium check | Balanced | 0.0000% | ✅ PASS |

### Thermal Benchmarks (Quad4 Thermal Solver)

| ID | Name | Expected | Computed | Error | Status |
|----|------|----------|----------|-------|--------|
| TH-1 | NAFEMS T1: 1D steady conduction, linear temperature field | T(midpoint) = 50°C | 50.0000°C | 0.0000% | ✅ PASS |
| TH-2 | 2D conduction on unit square, 4-element mesh | T ∈ [0, 100]°C range | Within range | — | ✅ PASS |

### Solid Mechanics Benchmarks (Hex8 Solver)

| ID | Name | Expected | Computed | Error | Status |
|----|------|----------|----------|-------|--------|
| SE-1 | Hex8 patch test: single element, constant strain field | σ_xx = 100 MPa at all 8 Gauss points | 100.0000 MPa | 0.0000% | ✅ PASS |
| SE-2 | Multi-element bar tension: 3 Hex8 elements in series | Linear displacement, correct end displacement | Matches PL/AE | 0.0000% | ✅ PASS |

---

## What Was Fixed

### The Problem
All 31 original NAFEMS benchmarks in `nafems_benchmarks.rs` and `nafems_benchmarks_extended.rs` were **fake**:
```rust
// Old code — validates TARGET against itself
fn validate(&self, computed: f64) -> BenchmarkResult {
    // computed IS the target, so error is always 0%
}
```
The WASM exports called `validate(TARGET)`, guaranteeing 100% pass rate with 0% error — without running any solver.

### The Fix
1. **Created `solid_solver.rs`** — a new global solver module connecting `Hex8Element` stiffness matrices to assembly → boundary conditions → LU solve → stress recovery
2. **Created `tests/nafems_real_benchmarks.rs`** — 10 benchmarks that build real FE models and call real solvers
3. **Added `run_real_benchmarks()` WASM export** — builds models inline in the browser, calls actual solver code, returns a JSON report with computed vs expected values
4. **Rebuilt frontend** — two-tab dashboard: "Real Solver Benchmarks" (genuine) and "Legacy (Reference Only)" (clearly labeled as non-solver validation)

---

## File Inventory

| File | Purpose | Lines |
|------|---------|-------|
| `apps/backend-rust/src/solid_solver.rs` | NEW: Global Hex8 FEA solver | ~175 |
| `apps/backend-rust/tests/nafems_real_benchmarks.rs` | NEW: 10 real benchmark tests | ~1100 |
| `apps/backend-rust/src/lib.rs` | MODIFIED: Added `run_real_benchmarks()` WASM export | +250 |
| `apps/web/src/pages/NafemsBenchmarkPage.tsx` | REWRITTEN: Two-tab dashboard with real vs legacy | ~580 |

---

## How to Run

### Rust Integration Tests
```bash
cd apps/backend-rust
cargo test --test nafems_real_benchmarks -- --nocapture
```
Expected output: `11 passed; 0 failed`

### WASM Build
```bash
cd apps/backend-rust
wasm-pack build --target web --out-dir pkg --release
```

### Frontend
Navigate to `/nafems-benchmarks` in the web app. Click "Run Real Benchmarks" on the Real Solver Benchmarks tab.

---

## Limitations & Future Work

1. **Hex8 Thermal**: `thermal_analysis.rs` has a `ThermalHex8` element type but its assembly is a stub. Only Quad4 thermal works end-to-end.
2. **Modal Analysis**: `dynamics.rs` has a modal solver skeleton but it's incomplete. No FV (Free Vibration) benchmarks are real yet.
3. **Nonlinear**: No Newton-Raphson or arc-length solver exists. NL benchmarks cannot be real.
4. **Mesh Refinement**: TH-2 uses a 2×2 Quad4 mesh, so accuracy is limited by mesh coarseness (range check only, not exact value).
5. **Shell/Plate Elements**: No shell or plate elements exist yet. NAFEMS LE benchmarks (membranes, shells, cylinders) cannot be real.

### What Would Be Needed for Full NAFEMS Compliance
- Shell/plate elements (Quad4-shell, Tri3-shell with drilling DOF)
- Eigenvalue solver (Lanczos or subspace iteration) for FV benchmarks
- Newton-Raphson with line search for NL benchmarks
- Contact mechanics framework for IC benchmarks
- h-refinement mesh generation utilities
