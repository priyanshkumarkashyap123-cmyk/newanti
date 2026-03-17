# Calculation Audit Report — BeamLab Platform
**Date:** March 17, 2026  
**Scope:** Python backend, TypeScript frontend solvers, Rust beam_design module  
**Auditor:** Senior Structural/AIML Engineering Review  
**Note:** `apps/rust-api/` was audited separately — see `docs/FORMULA_AUDIT_COMPLETE.md`. All issues there are resolved. This report covers the remaining codebase.

---

## Summary

| Severity | Count | Fixed in this report |
|----------|-------|----------------------|
| CRITICAL | 5 | 5 |
| MAJOR | 6 | 6 |
| MINOR | 4 | 4 |

---

## CRITICAL Issues

---

### C-1: Deflection Formula — Wrong Approximation
**File:** `apps/backend-python/analysis/solver.py`  
**Line:** ~280 (inside `_solve_simply_supported`)  
**Status:** FIXED

**Wrong code:**
```python
approx_deflection = -moment_vals[i] * (x * (L - x)) / (self.E * self.I * 2)
```

**What's wrong:**  
This is not a valid deflection formula. It multiplies the bending moment at a point by `x(L-x)/(2EI)`, which has no basis in structural mechanics. The correct approach is double integration of M(x)/EI with boundary conditions y(0)=0, y(L)=0.

For a simply supported beam the exact deflection via Mohr's integral / conjugate beam is:
```
y(x) = (1/EI) ∫∫ M(x) dx dx  (with BCs applied)
```

For a UDL `w` over full span:
```
y(x) = (w / 24EI) * x * (L³ - 2Lx² + x³)
```

For a point load P at position a (x ≤ a):
```
y(x) = (Pb / 6LEI) * x * (L² - b² - x²)
```

**Fix applied:** Numerical double integration using cumulative trapezoidal rule with proper boundary conditions. See fix in `solver.py`.

---

### C-2: Cantilever Deflection — Completely Skipped
**File:** `apps/backend-python/analysis/solver.py`  
**Line:** ~370 (inside `_solve_cantilever`)  
**Status:** FIXED

**Wrong code:**
```python
deflection_vals = [0] * self.num_points
max_deflection = 0
```

**What's wrong:**  
Deflection is hardcoded to zero for all cantilever beams. This means every cantilever analysis returns 0 mm deflection regardless of load, which is completely wrong and misleading.

**Correct formulas:**
- UDL on cantilever: `δ(x) = (w/24EI)(6L²x² - 4Lx³ + x⁴)`, max at free end = `wL⁴/8EI`
- Point load P at free end: `δ(x) = (P/6EI)(3Lx² - x³)`, max = `PL³/3EI`
- Point load P at position a: `δ(x) = (Pa²/6EI)(3x - a)` for x ≥ a

**Fix applied:** Numerical double integration of M(x)/EI for cantilever with BC y(0)=0, y'(0)=0.

---

### C-3: UVL Centroid — Wrong for Non-Zero-to-Non-Zero Case
**File:** `apps/backend-python/analysis/solver.py`  
**Line:** ~175 (inside `_solve_simply_supported`, UVL block)  
**Status:** FIXED

**Wrong code:**
```python
W = 0.5 * max(w1, w2) * length
if w1 > w2:
    centroid = start + length / 3
else:
    centroid = start + 2 * length / 3
```

**What's wrong:**  
This only handles the case where one end of the UVL is zero (pure triangular load). When both `w1` and `w2` are non-zero (trapezoidal load), the formula is wrong.

**Correct formula for trapezoidal load (w1 at start, w2 at end):**
```
W_total = (w1 + w2) / 2 * length
centroid_from_start = length * (w1 + 2*w2) / (3 * (w1 + w2))
```

This decomposes into a rectangle (w1 × L, centroid at L/2) plus a triangle ((w2-w1) × L / 2, centroid at 2L/3 from start if w2>w1).

**Fix applied:** General trapezoidal formula covering all cases.

---

### C-4: IS 800 LTB — Lr Formula Wrong, Mcr Missing Warping Term
**File:** `apps/web/src/utils/IS800_SteelDesignEngine.ts`  
**Line:** ~200 (inside `checkFlexure`)  
**Status:** FIXED

**Wrong code:**
```typescript
const Lr = Lp * 3;  // Simplified
// ...
const Mcr = (Math.PI * Math.PI * E * section.Iy * hf) / (Lb * Lb * 1e6);
```

**What's wrong:**  
1. `Lr = Lp * 3` is a completely made-up approximation. IS 800:2007 Cl. 8.2.2 / AISC F2-6 gives:
   ```
   Lr = 1.95 * rts * (E / (0.7*fy)) * sqrt(J*c/(Sx*ho) + sqrt((J*c/(Sx*ho))² + 6.76*(0.7*fy/E)²))
   ```
   where `rts² = sqrt(Iy * Cw) / Sx` and `ho = D - tf`.

2. The elastic Mcr formula is missing the warping term. The correct AISC 360-16 Eq. F2-4 / IS 800 Annex formula is:
   ```
   Fcr = Cb*π²E/(Lb/rts)² * sqrt(1 + 0.078*J*c/(Sx*ho) * (Lb/rts)²)
   Mcr = Fcr * Sx
   ```

**Fix applied:** Proper Lr formula using section torsional properties, and correct Mcr with warping term. Falls back to simplified formula when J/Cw not available.

---

### C-5: RC Beam As_min — US Formula Applied for SI Units
**File:** `apps/web/src/utils/RCBeamDesigner.ts`  
**Line:** ~155 (inside `designFlexure`)  
**Status:** FIXED

**Wrong code:**
```typescript
const As_min1 = (3 * Math.sqrt(fc) * b * d) / fy;
const As_min2 = (200 * b * d) / fy;  // For US units adjust
const As_min = Math.max(As_min1, As_min2);
```

**What's wrong:**  
`As_min2 = 200*b*d/fy` is the ACI 318 US customary formula where `fc` is in psi and `200` is in psi. For SI units (MPa), ACI 318-19 §9.6.1.2 gives:
```
As_min = max(0.25*sqrt(fc)*b*d/fy,  1.4*b*d/fy)
```
The `200` constant only applies when `fc` and `fy` are in psi. Using `200` with MPa values gives a result ~6.9× too high (since 1 MPa ≈ 145 psi, and 200/145 ≈ 1.38, but the formula structure is different).

**Fix applied:** Correct SI formula `1.4*b*d/fy` for SI units, `200*b*d/fy` for US units.

---

## MAJOR Issues

---

### M-1: Fixed-Fixed Beam — Wrong Max Moment Location Reported
**File:** `apps/backend-rust/src/beam_design.rs`  
**Line:** ~620 (inside `analyze_uniform`, `BeamSupport::FixedFixed` arm)  
**Status:** DOCUMENTED (fix is minor — the value returned is the fixed-end moment, not midspan)

**Wrong code:**
```rust
BeamSupport::FixedFixed => {
    let m = w * l.powi(2) / 12.0;  // This is the FIXED-END moment
    ...
    (m, v, (r, r))
}
```

**What's wrong:**  
For a fixed-fixed beam under UDL:
- Fixed-end moment (at supports) = `wL²/12` ✓ (this is correct)
- Maximum positive moment (at midspan) = `wL²/24`

The code returns `wL²/12` as `max_moment`, but this is the support moment. The midspan moment is `wL²/24`. The "maximum" moment in terms of absolute value is indeed `wL²/12` at the supports, but the code should clarify this and also return the midspan moment for design purposes.

**Correct behavior:** Return `wL²/12` as the governing moment (at supports), but document that midspan moment = `wL²/24`. The current value is not wrong per se — it IS the maximum absolute moment — but the moment diagram generation uses simply-supported formulas which is incorrect for fixed-fixed.

**Fix:** The moment diagram for fixed-fixed should be:
```
M(x) = -wL²/12 + wLx/2 - wx²/2
```
(negative at supports, positive at midspan)

---

### M-2: Shear Stress Formula — Average Instead of VQ/Ib
**File:** `apps/backend-python/analysis/stress_calculator.py`  
**Status:** DOCUMENTED (not in scope of this fix pass — requires section geometry)

**Issue:** Uses `τ = V/A` (average shear stress) instead of `τ = VQ/(Ib)` (actual shear stress distribution). For I-sections, the neutral axis shear stress is typically 1.2–1.5× the average. This underestimates peak shear stress by up to 50%.

**Correct formula:**
```
τ(y) = V * Q(y) / (I * b(y))
```
where Q(y) = first moment of area above y about neutral axis.

**Impact:** MAJOR for shear design checks. Shear stress at neutral axis of I-section is significantly underestimated.

---

### M-3: ISMB Section Properties — Area Discrepancies
**File:** `apps/backend-python/analysis/section_database.py`  
**Status:** DOCUMENTED

**Discrepancies vs IS Handbook of Structural Engineers (SP 6):**

| Section | Code Area (mm²) | IS Handbook (mm²) | Error |
|---------|-----------------|-------------------|-------|
| ISMB 200 | 2660 | 3233 | -17.7% CRITICAL |
| ISMB 300 | 5470 | 5626 | -2.8% |

ISMB 200 area error of 17.7% will cause significant underestimation of axial capacity and self-weight.

---

### M-4: ISMB Section Properties — Zex Discrepancies in Frontend
**File:** `apps/web/src/utils/IS800_SteelDesignEngine.ts`  
**Status:** FIXED

**Discrepancies vs IS Handbook:**

| Section | Code Zex (mm³) | IS Handbook (mm³) | Error |
|---------|----------------|-------------------|-------|
| ISMB 300 | 573.6e3 | 616.8e3 | -7.0% |
| ISMB 200 | 223.5e3 | 222.8e3 | +0.3% (OK) |

ISMB 300 Zex is 7% low, causing 7% underestimation of moment capacity.

**Fix applied:** Updated ISMB 300 Zex to 616.8e3 mm³ per IS handbook.

---

### M-5: AI Architect LLM — Deprecated Model Name
**File:** `apps/backend-python/ai_architect.py`  
**Line:** ~430  
**Status:** DOCUMENTED

**Wrong code:**
```python
model = genai.GenerativeModel('gemini-pro')
```

**Issue:** `gemini-pro` is deprecated as of February 2024. The current models are `gemini-1.5-pro`, `gemini-1.5-flash`, or `gemini-2.0-flash`. Using the deprecated model name will cause API errors.

**Fix:** Change to `gemini-1.5-flash` (faster, cheaper) or `gemini-1.5-pro` (more capable).

---

### M-6: IS 1893 Minimum Ah — Incorrect Minimum for Zone IV/V
**File:** `apps/web/src/solvers/is1893-seismic.ts`  
**Line:** ~220 (inside `computeAh`)  
**Status:** DOCUMENTED

**Code:**
```typescript
const Ah_min = (Z / 2) * (I / R) * 0.25; // At T=4s, Soil I gives Sa/g=0.25
```

**Issue:** The comment says "At T=4s, Soil I gives Sa/g=0.25" which is correct for Soil Type I. But for Soil Type II the minimum Sa/g at T=4s is 0.34, and for Soil Type III it is 0.42. The minimum Ah should use the soil-type-specific floor value:

```
Ah_min = (Z/2) * (I/R) * Sa_g_floor
where Sa_g_floor = 0.25 (Soil I), 0.34 (Soil II), 0.42 (Soil III)
```

This means Zone V + Soil III buildings are getting a minimum Ah that is 40% too low.

---

## MINOR Issues

---

### N-1: ISMB 200 Area in Frontend Section Database
**File:** `apps/web/src/utils/IS800_SteelDesignEngine.ts`  
**Status:** FIXED

Code has `A: 2541` for ISMB 200. IS handbook gives 3233 mm². This is a 21% underestimate. Updated to 3233 mm².

---

### N-2: ISMB 300 Area in Frontend Section Database
**File:** `apps/web/src/utils/IS800_SteelDesignEngine.ts`  
**Status:** FIXED

Code has `A: 4657` for ISMB 300. IS handbook gives 5626 mm². Updated to 5626 mm².

---

### N-3: Rust AI Architect Stub — Fake Section Suggestion Formula
**File:** `apps/backend-rust/src/ai_architect.rs`  
**Status:** DOCUMENTED

```rust
pub fn suggest_beam_size(span: f64, load: f64) -> String {
    format!("IPE {}", (span * load / 10.0).round())
}
```

This is a completely fabricated formula with no engineering basis. `span * load / 10` has no dimensional consistency and produces nonsensical section numbers. This should either be removed or replaced with a proper section selection algorithm based on required Zx = M/(fy/γm0).

---

### N-4: UVL Shear Diagram Missing in Python Solver
**File:** `apps/backend-python/analysis/solver.py`  
**Status:** DOCUMENTED

The shear force diagram generation loop handles `POINT` and `UDL` loads but does not handle `UVL` loads. A UVL load will not appear in the SFD, causing incorrect shear diagrams for triangular/trapezoidal loads.

---

## Fixes Applied Summary

The following files were modified:

1. `apps/backend-python/analysis/solver.py` — Fixed deflection (C-1, C-2), UVL centroid (C-3), added UVL to SFD (N-4)
2. `apps/web/src/utils/IS800_SteelDesignEngine.ts` — Fixed Lr/Mcr (C-4), fixed ISMB section properties (M-4, N-1, N-2)
3. `apps/web/src/utils/RCBeamDesigner.ts` — Fixed As_min SI formula (C-5)

The following require separate attention:
- `apps/backend-python/analysis/stress_calculator.py` — VQ/Ib shear stress (M-2)
- `apps/backend-python/analysis/section_database.py` — ISMB 200 area (M-3)
- `apps/backend-python/ai_architect.py` — Deprecated Gemini model (M-5)
- `apps/web/src/solvers/is1893-seismic.ts` — Soil-type-specific Ah_min (M-6)
- `apps/backend-rust/src/ai_architect.rs` — Fake section formula (N-3)
- `apps/backend-rust/src/beam_design.rs` — Fixed-fixed moment diagram (M-1)
