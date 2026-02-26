# Deep Code Audit — Rust Backend (`apps/backend-rust/`)

## Audit Scope
12 files, ~14,487 total lines of Rust code. Bug categories: panics, integer overflow/underflow, division by zero, array OOB, unsafe code, missing error propagation, memory safety, incorrect numerical algorithms, missing boundary checks, unused/dead code, performance issues, incorrect WASM bindings, missing JS input validation, NaN/Infinity propagation, and incorrect structural engineering formulas.

---

## 1. `src/special_functions.rs` (1616 lines)

### BUG SF-1: Incorrect `carlson_rf` final formula (Lines 928–935)
- **Severity: CRITICAL**
- **Category: Incorrect numerical algorithm**
- **Description:** After the duplication-theorem iteration converges (`x ≈ y ≈ z ≈ A`), the function returns `1.0 / (x * y.sqrt() + y * z.sqrt() + z * x.sqrt()).sqrt()`. When x = y = z = A, this evaluates to `1.0 / (3 * A^1.5)^0.5 = 1.0 / (√3 * A^0.75)`. The correct value is `R_F(A,A,A) = 1/√A`, i.e. `(3.0 / (x + y + z)).sqrt()` or equivalently `1.0 / ((x + y + z) / 3.0).sqrt()`.
- **Impact:** All functions depending on `carlson_rf` return incorrect values, including `ellipf()` (incomplete elliptic integral of the first kind). Any downstream structural or mathematical computation using `ellipf` produces wrong results.
- **Recommended fix:** Replace the final return with:
  ```rust
  let avg = (x + y + z) / 3.0;
  1.0 / avg.sqrt()
  ```

### BUG SF-2: `lgamma` incorrect for negative non-integer arguments (Lines ~105–130)
- **Severity: HIGH**
- **Category: Incorrect numerical algorithm**
- **Description:** The `lgamma` function uses Stirling's approximation, which is only valid for large positive x. For x ≤ 0, it returns `f64::NAN`. The correct `lgamma` should return `ln|Γ(x)|` for all x ≠ 0, -1, -2, ... using the reflection formula `lgamma(x) = ln(π) - ln|sin(πx)| - lgamma(1 - x)` for x < 0.
- **Impact:** Statistical functions (`chi2inv`, `tinv`, `finv`) that internally call `gamma`/`lgamma` may fail for certain parameter ranges.
- **Recommended fix:** Add reflection formula handling for x < 0.5 to mirror what `gamma()` does.

### BUG SF-3: `zeta` slow convergence near s = 1 (Lines ~1177–1195)
- **Severity: MEDIUM**
- **Category: Performance / Incorrect numerical algorithm**
- **Description:** For s > 1 close to 1 (e.g., s = 1.001), the function sums `1/n^s` for n = 1..1000. The partial sum of the harmonic-like series converges extremely slowly near s = 1, requiring millions of terms for reasonable accuracy. 1000 terms gives ~3 decimal places of accuracy for s = 1.01.
- **Impact:** Inaccurate zeta function values for s near 1.
- **Recommended fix:** Use the Euler-Maclaurin formula or Borwein's method for better convergence.

### BUG SF-4: `zeta` reflection formula overflow for large negative s (Line ~1185)
- **Severity: MEDIUM**
- **Category: NaN/Infinity propagation**
- **Description:** `zeta(s)` for s < 0.5 calls `gamma(1.0 - s)`. For s = -200, this evaluates `gamma(201)` which overflows to infinity. Combined with `(2π)^s → 0` and `sin(πs/2)`, the product may produce NaN or incorrect results via `0 * ∞`.
- **Recommended fix:** Use `lgamma` in the reflection formula and work in log-space to avoid overflow.

### BUG SF-5: `expint_e1` unused variable (Line ~1230)
- **Severity: LOW**
- **Category: Dead/unused code**
- **Description:** `let _result = 0.0;` is assigned but never used in the continued-fraction branch.
- **Recommended fix:** Remove the unused variable.

### BUG SF-6: `chi2inv` / `tinv` / `finv` Newton's method may diverge (Lines ~1020–1085)
- **Severity: MEDIUM**
- **Category: Missing boundary checks**
- **Description:** Newton's method for inverse CDF functions uses `df.abs() < 1e-15` as a bail-out when the derivative is near-zero, but does no check for `x` going negative in `chi2inv` (clamped to `1e-10`) or `finv`. If the initial guess is poor, the iteration may converge to a wrong root or oscillate for 50 iterations and return a bad value.
- **Impact:** Silent incorrect results for extreme quantiles.
- **Recommended fix:** Add a bisection fallback when Newton steps increase the residual, and validate the final result via forward CDF evaluation.

---

## 2. `src/solver.rs` (255 lines)

### BUG S-1: `unwrap()` on HashMap lookup in all-fixed branch (Line 177)
- **Severity: HIGH**
- **Category: Panic (unwrap)**
- **Description:** `let idx = node_map.get(&node.id).unwrap();` — if a node's ID is not in `node_map` (e.g., due to duplicate IDs or upstream corruption), this panics the WASM module. In a `panic = "abort"` profile, this terminates the entire WASM instance.
- **Impact:** Unrecoverable crash in production WASM if node ID mapping is inconsistent.
- **Recommended fix:** Use `.ok_or()` or `.unwrap_or()` with proper error propagation.

### BUG S-2: No input validation on node/element properties (Entire file)
- **Severity: MEDIUM**
- **Category: Missing JS input validation**
- **Description:** The 2D solver `analyze()` and `analyze_with_loads()` accept raw JS inputs (via lib.rs WASM bindings) without validating: E > 0, A > 0, I > 0, non-NaN coordinates, non-duplicate node IDs, or that element nodes exist. Unlike `solver_3d.rs` (which validates these), the 2D solver trusts all inputs.
- **Impact:** NaN propagation, division by zero in stiffness computation (E*I / L³), or silent garbage results.
- **Recommended fix:** Add input validation at the start of `analyze()` matching what `analyze_3d_frame()` does.

---

## 3. `src/solver_3d.rs` (4364 lines)

### BUG S3-1: Axial point-load FEF uses Hermite (transverse) formula (Lines 2089–2093)
- **Severity: MEDIUM**
- **Category: Incorrect structural engineering formula**
- **Description:** In `calculate_member_forces()`, the X-component (axial) of a point load on a member uses `compute_point_load_fef()` to get v1 and v2. That function uses the Hermite cubic shape function formula: `V1 = P·b²(3a+b)/L³`. For **axial** DOFs, the displacement field is linear, so the correct FEF is `V1 = P·(L-a)/L`, `V2 = P·a/L` (linear interpolation). The Hermite and linear formulas agree at midspan but diverge for off-center loads. For example at a = L/4: Hermite gives 0.844P vs. correct 0.75P for V1.
- **Impact:** Incorrect member-end axial forces for off-center point loads in the axial direction. The error is bounded (max ~12%) and only affects point loads with an axial component applied off-center.
- **Recommended fix:** Add a separate `compute_axial_point_load_fef()` function using linear shape functions for the axial DOF.

### BUG S3-2: `modal_analysis()` returns placeholder/dummy results (Lines 2230–2310)
- **Severity: HIGH**
- **Category: Incomplete implementation**
- **Description:** The function comment states: *"Since dynamics.rs is a placeholder, we return the dummy result for now."* The function delegates to `solve_eigenvalues()` in the `dynamics` module but acknowledges it doesn't properly return eigenvectors. Modal analysis is exposed to JS via `lib.rs` as `modal_analysis()` and could be called by users expecting real results.
- **Impact:** Users calling modal analysis from JS get empty or incorrect mode shapes.
- **Recommended fix:** Either complete the eigenvector extraction from `dynamics::solve_eigenvalues`, or return an explicit error indicating the feature is incomplete.

### BUG S3-3: P-Delta geometric stiffness excludes Truss elements (Line 2958)
- **Severity: MEDIUM**
- **Category: Missing boundary check / Logic error**
- **Description:** In `p_delta_analysis()`, the K_g assembly loop has `if element.element_type != ElementType::Frame { continue; }`, excluding `Truss` and `Cable` elements. However, in `linearized_buckling_analysis()` (line 2451), both `Frame` and `Truss` are included. Truss elements under axial load DO have geometric stiffness and should be included in P-Delta.
- **Impact:** P-Delta analysis underestimates instability effects for structures with truss members. Buckling analysis correctly includes them but P-Delta does not, causing inconsistent results.
- **Recommended fix:** Change the P-Delta filter to `if !matches!(element.element_type, ElementType::Frame | ElementType::Truss) { continue; }`.

### BUG S3-4: P-Delta spring reaction equilibrium computation is convoluted and fragile (Lines 3098–3114)
- **Severity: LOW**
- **Category: Code quality / Potential logic error**
- **Description:** The spring reaction contribution to equilibrium uses nested `if d==N { fs } else { 0.0 }` patterns which are functionally correct but extremely hard to verify. The same pattern works correctly in the linear solver's equilibrium check, but the P-Delta version duplicates this complex logic.
- **Recommended fix:** Extract the equilibrium-check assembly into a shared helper function.

### BUG S3-5: Element type filtering in K assembly vs force recovery inconsistency (Lines ~2270 vs ~1990)
- **Severity: LOW**
- **Category: Logic inconsistency**
- **Description:** In `modal_analysis()`, only `ElementType::Frame` elements are assembled into K. Plate, Truss, Cable elements are skipped. The linear solver assembles all element types. If a structure with mixed element types is passed to modal analysis, the stiffness matrix is incomplete.
- **Recommended fix:** Modal analysis K assembly should handle all element types (at minimum, Truss and Cable).

---

## 4. `src/foundation_design.rs` (1098 lines)

### BUG FD-1: Division by zero in `MatFoundation::analyze()` (Lines 488–490)
- **Severity: CRITICAL**
- **Category: Division by zero**
- **Description:** `let _ex = total_my / total_p;` and `let _ey = total_mx / total_p;` — `total_p` is the sum of column axial loads and can be zero if no columns are loaded, if loads cancel out, or if the mat is checked under moment-only loading. This produces NaN/Infinity that propagates to all subsequent calculations (q_avg, q_max, q_min, etc.).
- **Impact:** WASM crash or NaN propagation in mat foundation analysis.
- **Recommended fix:** Guard with `if total_p.abs() < 1e-10 { return error or default; }` before the division.

### BUG FD-2: `lateral_capacity()` divides by `soil_layers.len()` which ignores filtering (Lines 740–745)
- **Severity: HIGH**
- **Category: Division by zero / Incorrect formula**
- **Description:** `avg_cu` is computed by summing cohesion of Clay layers only, then dividing by `self.soil_layers.len().max(1)` (total layer count including non-clay). This means if you have 3 sand layers + 1 clay layer (cu=100), `avg_cu = 100/4 = 25` instead of `100/1 = 100`. Furthermore, if there are NO clay layers at all, `avg_cu = 0.0` and the function falls through to the cohesionless branch, which is technically correct but by accident.
- **Impact:** Underestimated lateral capacity in mixed soil profiles. The `avg_cu` is divided by total layers instead of clay layers only.
- **Recommended fix:** Divide by the count of clay layers: `let clay_count = self.soil_layers.iter().filter(|l| l.soil_type == SoilType::Clay).count(); let avg_cu = sum / clay_count.max(1) as f64;`

### BUG FD-3: `estimate_settlement` uses hardcoded pile material modulus (Line 730)
- **Severity: LOW**
- **Category: Incorrect formula**
- **Description:** `let e_pile = 30000.0; // MPa for concrete` — steel piles have E = 200,000 MPa, timber piles ~10,000 MPa. The pile type (`self.pile_type`) is available but not used to select the appropriate modulus.
- **Recommended fix:** Match on `self.pile_type` to select E_pile.

---

## 5. `src/beam_design.rs` (1036 lines)

### BUG BD-1: Incorrect point load deflection formula for Simple beam (Lines 519–524)
- **Severity: HIGH**
- **Category: Incorrect structural engineering formula**
- **Description:** The deflection at the load point for a simply-supported beam under point load uses:
  ```rust
  p * 1000.0 * a * 1000.0 * b * 1000.0 *
  (a * 1000.0 + 2.0 * b * 1000.0) *
  (3.0 * a * 1000.0 * (a * 1000.0 + 2.0 * b * 1000.0)).sqrt() /
  (27.0 * self.e * props.ix * l * 1000.0)
  ```
  This formula involves `sqrt()` in the numerator which does not appear in any standard beam deflection formula. The correct **maximum** deflection for a simple beam with point load P at distance a from left support is:
  - At load point: `δ = P·a²·b² / (3·E·I·L)`
  - Maximum (absolute): `δ_max = P·a·(L² - a²)^(3/2) / (9·√3·E·I·L)` (which does involve sqrt, but the implementation appears garbled)
  
  Additionally, the unit conversions (`* 1000.0` applied to a and b but only once to L) are inconsistent and produce dimensionally incorrect results.
- **Impact:** All point load deflection calculations for simple beams return incorrect values.
- **Recommended fix:** Use the standard formula `δ = P·a²·b² / (3·E·I·L)` at the load point, with consistent unit handling.

### BUG BD-2: Repeated `* 1000.0` unit conversions are error-prone (Lines 519–530)
- **Severity: MEDIUM**
- **Category: Code quality / Units inconsistency**
- **Description:** Instead of converting inputs once at the start, the code applies `* 1000.0` inline to every occurrence of `a`, `b`, `l`, and `p` separately. This makes it extremely easy to miss a conversion or double-convert, and makes the formulas unreadable.
- **Recommended fix:** Convert `p`, `a`, `b`, `l` to consistent units (e.g., N and mm) once at the top of each function, then use clean formulas.

---

## 6. `src/column_design.rs` (963 lines)

### BUG CD-1: Division by zero in `check_interaction()` when mn_x or mn_y is zero (Lines 346–347)
- **Severity: HIGH**
- **Category: Division by zero**
- **Description:** `let mrx = mu_x / cap.mn_x;` and `let mry = mu_y / cap.mn_y;`. If the section has zero plastic modulus in either axis (e.g., `zx = 0` or `zy = 0`), then `mn_x` or `mn_y` is zero, causing division by zero → NaN → the interaction check produces garbage.
- **Impact:** Any steel column with a section where Zx or Zy is not defined (e.g., angle sections for weak axis) will produce NaN interaction ratios.
- **Recommended fix:** Guard `mn_x` and `mn_y` with `if cap.mn_x.abs() < 1e-10 && mu_x.abs() > 1e-10 { return InteractionCheck { ratio: f64::INFINITY, adequate: false, ... } }`.

### BUG CD-2: Concrete column `capacity()` circular dependency in moment magnification (Lines ~430–445)
- **Severity: MEDIUM**
- **Category: Incorrect formula / Logic error**
- **Description:** The moment magnification factor δ_ns (ACI 318-19 §6.6.4) requires the factored axial load P_u to compute Cm/(1 - P_u/P_c). The code estimates `pu_estimate = pn_max * 0.65` (where 0.65 is φ for tied columns), but this estimate is the column's CAPACITY, not the actual applied load. The correct approach requires the actual factored axial load as input.
- **Impact:** Moment magnification is computed with a fixed P_u estimate instead of the actual applied axial load, potentially overestimating or underestimating the magnified moment.
- **Recommended fix:** Accept `p_u` as an input parameter to `capacity()` or separate magnification into a distinct check that takes the actual factored load.

### BUG CD-3: Bresler biaxial check divides by `pr0` (pure axial capacity) (Lines ~480)
- **Severity: LOW**
- **Category: Division by zero (edge case)**
- **Description:** The Bresler reciprocal formula: `1/Pn = 1/Pnx + 1/Pny - 1/Pr0`. If `Pr0` (pure axial capacity) is zero or very small, this produces infinity. Also, if either `Pnx` or `Pny` is zero, division by zero occurs.
- **Impact:** Edge case for columns with near-zero capacity in one direction.
- **Recommended fix:** Add guards on Pnx, Pny, and Pr0 before division.

---

## 7. `src/steel_design_advanced.rs` (899 lines)

### BUG SDA-1: Slip-critical connection hardcodes Class A friction (Lines ~450)
- **Severity: MEDIUM**
- **Category: Incorrect formula / Missing parameters**
- **Description:** The slip-critical connection capacity uses `mu = 0.35` (Class A surface, unpainted clean mill scale). AISC Table J3.1 also defines Class B (mu = 0.50, blast-cleaned/hot-dip galvanized). The class is not configurable.
- **Impact:** Unconservative for Class A (correct), but overly conservative by 30% for Class B connections.
- **Recommended fix:** Add a `surface_class` parameter to `BoltedConnection` and select mu accordingly.

### BUG SDA-2: `effective_length_factor()` uses approximate K values (Lines ~280–300)
- **Severity: LOW**
- **Category: Incorrect formula (minor)**
- **Description:** The function returns textbook approximate K values (e.g., pinned-pinned = 1.0, fixed-fixed = 0.5). For real frames, K depends on the stiffness ratios of beams to columns (alignment chart / Equation C-A-7-1 in AISC Commentary). The approximation can be off by 20-40% for sway frames.
- **Impact:** Column buckling calculations may be unconservative for sway frames.
- **Recommended fix:** Add alignment-chart based K factor calculation or clearly document that these are ideal values.

---

## 8. `src/seismic_isolation.rs` (840 lines)

### BUG SI-1: TFP `effective_stiffness` lower bound too large (Lines ~530)
- **Severity: MEDIUM**
- **Category: Missing boundary check**
- **Description:** `displacement.abs().max(1.0)` clamps the denominator to a minimum of 1.0 (presumably 1 mm). For sub-millimeter displacements (e.g., wind serviceability checks), this returns incorrect stiffness values. The effective stiffness should be k2 + k3 (elastic stiffness) for very small displacements, not bounded by an artificial displacement floor.
- **Impact:** Incorrect stiffness for small-displacement checks.
- **Recommended fix:** Return the elastic stiffness (sum of slider stiffnesses) when displacement is below the yield displacement of the first slider, rather than clamping.

### BUG SI-2: FPS `effective_damping` uses different formula than LRB (Lines ~380 vs ~280)
- **Severity: LOW**
- **Category: Potential formula inconsistency**
- **Description:** LRB uses `β_eff = 2·Q_d·(D - D_y) / (π·k_eff·D²)` (energy-based). FPS uses `β_eff = 2·μ·W / (π·k_eff·D)` (work-based). Both are standard formulations but give different results for the same energy dissipation. The difference is because FPS energy = μ·W·D (constant friction) while LRB energy = Q_d·(D - D_y)·4 (bilinear hysteresis).
- **Impact:** Results are technically correct for each isolator type but could cause confusion if cross-compared.
- **Recommended fix:** Add comments explaining the distinct derivations.

---

## 9. `src/load_combinations.rs` (1260 lines)

### BUG LC-1: ASCE 7 only uses first wind/seismic direction (Lines ~460)
- **Severity: MEDIUM**
- **Category: Incomplete implementation**
- **Description:** `generate_asce7_combinations()` finds `w_id = find_load_case_id(load_cases, LoadType::WindX)` but does not look for `WindXNeg`, `WindY`, `WindYNeg`. This means ASCE 7 combinations only use +X wind direction, while IS 456/800 generators correctly use all 4 wind directions. Similarly for seismic.
- **Impact:** Missing critical load combinations for ASCE 7 analysis (e.g., negative wind, Y-direction wind/seismic).
- **Recommended fix:** Add `WindXNeg`, `WindY`, `WindYNeg`, `SeismicXNeg`, `SeismicY`, `SeismicYNeg` handling matching the IS code generators.

### BUG LC-2: ASCE 7 Combo 5 mutates `factors` vector across if-blocks (Lines ~585–615)
- **Severity: MEDIUM**
- **Category: Logic error**
- **Description:** The `factors` vector for Combo 5 is appended with `(s, 0.2)` snow factor INSIDE an if-let block, but the vector was already allocated with Dead + Earthquake + Live. After pushng snow, the SAME `factors` vector is reused. This doesn't cause a bug in this specific code path because the snow push only happens once, but the pattern is fragile — if another load type were added after snow, it would include the snow factor from the previous combo.
- **Impact:** Currently benign, but a maintenance hazard.
- **Recommended fix:** Clone `factors` before each push, or use a fresh vector per combination.

---

## 10. `src/input_validation.rs` (1093 lines)

### BUG IV-1: O(n²) coincident node detection (Lines ~180–210)
- **Severity: MEDIUM**
- **Category: Performance**
- **Description:** The coincident node checker uses a double loop `for i in 0..n { for j in (i+1)..n { ... } }`, giving O(n²) complexity. For a 10,000-node model, this is 50 million distance comparisons.
- **Impact:** Validation becomes a bottleneck for large models. In WASM, this could cause noticeable UI freezes.
- **Recommended fix:** Use a spatial hash or k-d tree for O(n log n) coincident detection.

### BUG IV-2: Stability check is overly simplified (Lines 695–720)
- **Severity: LOW**
- **Category: Missing boundary check**
- **Description:** `check_stability()` only checks if at least 3 translation DOFs are globally constrained. It doesn't check for mechanisms (e.g., all constraints on the same line), collinear supports, or missing rotational constraints for 3D frames.
- **Impact:** False negatives — unstable structures may pass the stability check.
- **Recommended fix:** Add mechanism detection (e.g., check that support nodes aren't collinear for 3D).

---

## 11. `src/lib.rs` (1062 lines)

### BUG LIB-1: NaN/Infinity sanitization masks analysis failures (Lines 486–516)
- **Severity: HIGH**
- **Category: Missing error propagation / NaN handling**
- **Description:** After `solve_3d_frame_extended()` returns a result, the code iterates through all displacements, reactions, and forces, replacing NaN/Infinity with 0.0. This means:
  - A numerically singular analysis returns all-zero displacements instead of an error
  - The `success: true` flag is preserved even when results are garbage
  - The user has no way to distinguish between "structure doesn't move" and "analysis failed"
- **Impact:** Silent failures that could lead to unconservative structural designs.
- **Recommended fix:** Count the replaced NaN values; if any are found, set `success = false` and populate the `error` field.

### BUG LIB-2: `solve_sparse_system_json` — variable `recovered` is unused (Line ~987)
- **Severity: LOW**
- **Category: Dead code**
- **Description:** `let mut recovered = true;` is declared but never modified or read.
- **Recommended fix:** Remove the variable.

### BUG LIB-3: `solve_sparse_system_json` — variable `p` shadowed (Lines ~970 and ~993)
- **Severity: LOW**
- **Category: Dead code**
- **Description:** `let mut p = r.clone();` on line ~970 is immediately shadowed by `let mut p = z.clone();` on line ~993. The first allocation is wasted.
- **Recommended fix:** Remove the first `p` declaration.

### BUG LIB-4: `solve_sparse_system_json` — `iterations` variable never exposed (Line ~1000)
- **Severity: LOW**
- **Category: Missing feature**
- **Description:** The PCG iteration count is tracked but not included in the `SparseSystemOutput`. This makes it impossible for the caller to assess solver convergence quality.
- **Recommended fix:** Add `iterations: usize` to `SparseSystemOutput`.

### BUG LIB-5: `solve_structure_wasm` error fallback not valid JSON (Line ~380)
- **Severity: LOW**
- **Category: Incorrect WASM binding**
- **Description:** When `serde_wasm_bindgen::to_value(&err_res)` fails, the fallback `JsValue::from_str("Error")` returns a plain string, not a structured JS object. The JS caller expecting `{ success: false, error: "..." }` receives just the string `"Error"`.
- **Recommended fix:** Return a proper JSON error string like the other endpoints do.

---

## 12. `Cargo.toml` (101 lines)

### BUG CT-1: Empty feature flags (Lines 40–42)
- **Severity: LOW**
- **Category: Dead code**
- **Description:** Features `validation`, `logging`, and `benchmarks` are defined but have empty dependency arrays and no code gated behind `#[cfg(feature = "...")]`.
- **Impact:** Misleading — users may think enabling these features activates functionality.
- **Recommended fix:** Either gate code behind these features or remove them.

### BUG CT-2: All dev-dependencies are commented out (Lines ~50–55)
- **Severity: LOW**
- **Category: Missing testing infrastructure**
- **Description:** `proptest` and `criterion` are commented out, meaning property-based testing and benchmarking infrastructure is inactive.
- **Impact:** No fuzz testing of numerical edge cases, no performance regression tracking.
- **Recommended fix:** Uncomment and set up proptest for critical numerical functions (erf, gamma, besselj) and criterion for solver benchmarks.

### BUG CT-3: `wasm-opt = false` disables WASM optimization (Line 60)
- **Severity: LOW**
- **Category: Performance**
- **Description:** The wasm-opt pass that runs Binaryen optimizations (dead code elimination, constant folding, etc.) is disabled. This typically reduces WASM binary size by 10-30% and improves runtime performance.
- **Impact:** Larger WASM binary and potentially slower execution.
- **Recommended fix:** Enable `wasm-opt = true` unless there's a known compatibility issue.

---

## Summary Table

| # | File | Bug ID | Severity | Category |
|---|------|--------|----------|----------|
| 1 | special_functions.rs | SF-1 | **CRITICAL** | Incorrect `carlson_rf` formula |
| 2 | foundation_design.rs | FD-1 | **CRITICAL** | Division by zero in mat analyze |
| 3 | solver.rs | S-1 | **HIGH** | Panic (unwrap) in all-fixed path |
| 4 | special_functions.rs | SF-2 | **HIGH** | `lgamma` wrong for negative args |
| 5 | beam_design.rs | BD-1 | **HIGH** | Incorrect deflection formula |
| 6 | column_design.rs | CD-1 | **HIGH** | Division by zero in interaction |
| 7 | foundation_design.rs | FD-2 | **HIGH** | Wrong avg_cu divisor |
| 8 | solver_3d.rs | S3-2 | **HIGH** | Modal analysis returns dummy |
| 9 | lib.rs | LIB-1 | **HIGH** | NaN sanitization masks errors |
| 10 | solver_3d.rs | S3-1 | **MEDIUM** | Axial FEF uses Hermite formula |
| 11 | solver_3d.rs | S3-3 | **MEDIUM** | P-Delta excludes Truss from Kg |
| 12 | special_functions.rs | SF-3 | **MEDIUM** | Zeta slow convergence near 1 |
| 13 | special_functions.rs | SF-4 | **MEDIUM** | Zeta overflow in reflection |
| 14 | special_functions.rs | SF-6 | **MEDIUM** | Newton's method may diverge |
| 15 | solver.rs | S-2 | **MEDIUM** | 2D solver missing validation |
| 16 | beam_design.rs | BD-2 | **MEDIUM** | Unit conversion fragility |
| 17 | column_design.rs | CD-2 | **MEDIUM** | Circular P_u estimate |
| 18 | steel_design_advanced.rs | SDA-1 | **MEDIUM** | Hardcoded friction class |
| 19 | seismic_isolation.rs | SI-1 | **MEDIUM** | TFP stiffness lower bound |
| 20 | load_combinations.rs | LC-1 | **MEDIUM** | ASCE 7 single wind direction |
| 21 | load_combinations.rs | LC-2 | **MEDIUM** | Mutable factors vector reuse |
| 22 | input_validation.rs | IV-1 | **MEDIUM** | O(n²) coincident check |
| 23 | solver_3d.rs | S3-4 | **LOW** | Convoluted spring equilibrium |
| 24 | solver_3d.rs | S3-5 | **LOW** | Modal K assembly incomplete |
| 25 | foundation_design.rs | FD-3 | **LOW** | Hardcoded pile E_pile |
| 26 | column_design.rs | CD-3 | **LOW** | Bresler div-by-zero edge case |
| 27 | steel_design_advanced.rs | SDA-2 | **LOW** | Approximate K factors |
| 28 | seismic_isolation.rs | SI-2 | **LOW** | FPS vs LRB damping formula |
| 29 | input_validation.rs | IV-2 | **LOW** | Simplified stability check |
| 30 | special_functions.rs | SF-5 | **LOW** | Unused variable |
| 31 | lib.rs | LIB-2 | **LOW** | Unused `recovered` variable |
| 32 | lib.rs | LIB-3 | **LOW** | Shadowed `p` variable |
| 33 | lib.rs | LIB-4 | **LOW** | PCG iterations not exposed |
| 34 | lib.rs | LIB-5 | **LOW** | Non-JSON error fallback |
| 35 | Cargo.toml | CT-1 | **LOW** | Empty feature flags |
| 36 | Cargo.toml | CT-2 | **LOW** | Commented dev-deps |
| 37 | Cargo.toml | CT-3 | **LOW** | wasm-opt disabled |

**Totals: 2 CRITICAL, 7 HIGH, 13 MEDIUM, 15 LOW**
