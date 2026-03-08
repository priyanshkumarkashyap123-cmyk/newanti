# Known Issues & Gotchas

## Critical Bugs

### 1. Reaction Computation Bug (Rust API)
**Location:** `apps/rust-api/src/solver/mod.rs`
**Problem:** Reactions computed as negation of applied loads instead of proper `R = K*U - F`.
**Impact:** Wrong reaction forces at supports when member loads (UDL, etc.) are present.
**Fix:** Replace load negation with matrix multiplication approach.

### 2. Modal Analysis Empty Mode Shapes
**Location:** `apps/rust-api/src/solver/dynamics.rs`
**Problem:** Natural frequencies are computed correctly, but mode shape vectors returned empty.
**Impact:** Cannot do modal superposition, response spectrum, or visual mode shape animation.
**Root cause:** Eigenvector extraction from the solver returns only eigenvalues.

### 3. Seismic Mock Effective Weights
**Location:** `apps/rust-api/src/solver/seismic.rs`
**Problem:** Uses placeholder/mock values for seismic effective weight instead of computing from mass matrix.
**Impact:** Base shear Vb will be wrong since Vb = Ah × W.

### 4. Shear Modulus Hardcoded
**Location:** Multiple solver files
**Problem:** G = E/2.6 used universally instead of G = E/(2(1+ν)).
**Impact:** ~8% error for concrete (ν ≈ 0.15–0.20 gives G = E/2.3–2.4, not E/2.6).
**Fix:** Use actual Poisson's ratio: `G = E / (2.0 * (1.0 + poisson))`.

### 5. P-Delta Uses Jacobi Placeholder
**Location:** `apps/rust-api/src/solver/pdelta.rs`
**Problem:** Eigenvalue solver for geometric stiffness uses Jacobi method placeholder — may not converge for large models.
**Impact:** P-Delta results unreliable for large structures or high axial loads.

### 6. Flutter Analysis Returns Dummy Values
**Location:** `apps/rust-api/src/solver/dynamics.rs`
**Problem:** Flutter (aeroelastic) analysis returns placeholder complex eigenvalues.
**Impact:** Cannot perform aeroelastic stability checks.

### 7. FETI Solver Non-functional
**Location:** `apps/rust-api/src/solver/sparse_solver.rs`
**Problem:** Domain decomposition (FETI) solver is stubbed out.
**Impact:** No parallel solver for very large models.

---

## Code Quality Issues

### 335 `.unwrap()` Calls in Rust
**Location:** Throughout `apps/rust-api/src/`
**Impact:** Any unexpected None or Err will panic the server (crash, not graceful error).
**Priority fix areas:** Solver input parsing, matrix operations, JSON deserialization.

### Unsafe `static mut` Usage
**Location:** Thread-local state management in Rust API
**Impact:** Potential data races in concurrent analysis requests.
**Fix:** Use `thread_local!` or `Mutex<>` wrappers.

---

## Mathematical Gotchas

### Tributary Width for 2-Way Slabs
**CORRECT:** `tributary_width = bay_width / 4` (each beam gets 1/4 of panel, 2-way distribution)
**WRONG:** `tributary_width = bay_width / 2` (1-way assumption, double-counts for 2-way)

This was the most impactful mathematical correction found. See `MATHEMATICAL_CORRECTIONS_COMPLETE.md`.

### Sign Convention Consistency
Different IS codes use different sign conventions:
- IS 456/ACI: +M = sagging (tension at bottom)
- IS 800/AISC: +M = sagging (compression at bottom flange)

**Rule:** Always use absolute values for capacity checks. Preserve signs only for:
- Reinforcement placement decisions (top vs. bottom steel)
- Moment gradient factor Cb (IS 800 / AISC)
- P-M interaction (sign of axial force matters)

### UDL Equivalent Nodal Loads
Fixed-end moments must be subtracted from member-end forces after solving:
```
Member forces = K_local × U_local − FEF_local
```
If FEF (Fixed-End Forces) are not subtracted, member forces will be wrong even if displacements are correct.

### Coordinate Transformation Order
Apply transformation **before** assembly, not after:
```python
K_global = T.T @ K_local @ T  # CORRECT: transform each element
# NOT: transform global K after assembly
```

---

## Security Issues

### Exposed Credentials
- MongoDB creds in `.env` files — rotate before production deployment
- JWT secret hardcoded in Rust API config — use environment variable
- Some analysis API endpoints lack authentication middleware

### Input Validation
- No bounds checking on number of nodes/elements (OOM risk for malicious input)
- No timeout on solver iterations (infinite loop risk for ill-conditioned matrices)

---

## NAFEMS Benchmark Failures (4 of 82)

| Test | Category | Issue |
|------|----------|-------|
| NL_3 | Nonlinear | Convergence tolerance too loose |
| T_2 | Thermal | Boundary condition mapping error |
| IC_1 | Contact | Contact algorithm not implemented |
| FV_7 | Free Vibration | Higher mode accuracy degrades |

Overall pass rate: 78/82 = 95.1%

---

## Performance Notes

- Rust solver handles ~10K DOF models in real-time
- Python solver ~10x slower than Rust for same problem size
- WASM solver limited by browser memory (~2GB) — cap at ~5K DOF
- No matrix reuse optimization for multiple load cases (solves from scratch each time)
- Sparse solver available but not used by default in all analysis paths
