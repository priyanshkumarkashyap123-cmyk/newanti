---
description: "Generate a NAFEMS-style benchmark test case for the structural solver. Validates solver accuracy against published reference solutions for linear elastic, free vibration, nonlinear, thermal, or contact analysis."
---

# Generate NAFEMS Benchmark Test

Create a solver benchmark test case following NAFEMS (National Agency for Finite Element Methods & Standards) conventions.

## Input Required

- **Benchmark category**: LE (linear elastic), FV (free vibration), NL (nonlinear), T (thermal), IC (contact/impact)
- **Target solver**: Rust (`apps/rust-api/`) or Python (`apps/backend-python/`)
- **Element type**: beam, truss, plate/shell, solid
- **Reference**: NAFEMS test ID or published benchmark source

## Procedure

### 1. Define the Benchmark Problem

Specify geometry, material, boundary conditions, and loading exactly as published:

```
Problem: [NAFEMS ID or description]
Reference: [Publication, page/table number]
Expected Result: [displacement/stress/frequency with units]
Tolerance: [±percentage, typically 1-2%]
```

### 2. Generate Test Code

For **Rust** (`apps/rust-api/src/solver/`):
```rust
#[cfg(test)]
mod nafems_benchmarks {
    use super::*;

    #[test]
    fn nafems_le1_patch_test() {
        // NAFEMS LE1: Patch test for plane stress elements
        // Reference: "The Standard NAFEMS Benchmarks", NAFEMS, 1990
        // Expected: Constant stress field σx = 1.0 MPa throughout patch
        
        let model = build_model(/* geometry, material, loads */);
        let result = solve_linear_static(&model).unwrap();
        
        let stress = extract_stress(&result, element_id);
        assert!((stress.sigma_x - 1.0).abs() < 0.01,
            "NAFEMS LE1: σx = {}, expected 1.0 MPa", stress.sigma_x);
    }
}
```

For **Python** (`apps/backend-python/analysis/solvers/`):
```python
def test_nafems_le1_patch_test():
    """NAFEMS LE1: Patch test for plane stress elements.
    
    Reference: "The Standard NAFEMS Benchmarks", NAFEMS, 1990
    Expected: Constant stress field σx = 1.0 MPa throughout patch
    Tolerance: ±1%
    """
    model = build_model(...)
    result = solve_linear_static(model)
    
    stress_x = extract_stress(result, element_id)
    assert abs(stress_x - 1.0) < 0.01, f"NAFEMS LE1: σx = {stress_x}, expected 1.0"
```

### 3. Standard Benchmark Categories

**Linear Elastic (LE):**
- LE1: Patch test (constant stress)
- LE3: Scordelis-Lo roof (shell bending)
- LE5: Z-section cantilever (distortional)
- LE10: Thick cylinder (3D stress)
- LE11: Stepped cantilever beam (tip deflection for Timoshenko/EB comparison)

**Free Vibration (FV):**
- FV2: Cantilever beam natural frequencies (f1, f2, f3)
- FV4: Square plate (modal shapes and frequencies)
- FV12: Clamped-free beam (Timoshenko vs. Euler-Bernoulli)
- FV32: 3D frame building model (first 5 modes)
- FV52: Rectangular membrane (analytical solution comparison)

**Nonlinear (NL):**
- NL1: Large deformation cantilever (geometric nonlinearity)
- NL3: Large displacement portal frame (snap-through)
- NL7: Lee frame buckling (limit point tracking)

**Thermal (T):**
- T1: 1D steady-state heat transfer
- T2: 2D steady-state with convection boundary
- T3: Transient heat conduction

### 4. Validation Checklist

- [ ] Geometry matches reference exactly (node coordinates, connectivity)
- [ ] Material properties match (E, ν, ρ in SI units)
- [ ] Boundary conditions correct (fixed DOFs, symmetry)
- [ ] Loading correct (magnitude, direction, type)
- [ ] Expected result cited with source
- [ ] Tolerance justified (1% for displacements, 2% for stresses, 1% for frequencies)
- [ ] Test passes with current solver
- [ ] Failure message includes expected vs. actual values

### 5. File Naming

```
tests/nafems/[category]_[number]_[short_description].rs    # Rust
tests/nafems/test_[category]_[number]_[short_description].py  # Python
```

Examples:
- `tests/nafems/le11_stepped_cantilever.rs`
- `tests/nafems/test_fv2_cantilever_frequencies.py`

## Current Benchmark Status

82 benchmarks implemented, 78 passing (95.1%). See `NAFEMS_BENCHMARK_REPORT.md` for details.

Known failures:
- NL_3: Convergence tolerance
- T_2: Boundary condition mapping
- IC_1: Contact not implemented
- FV_7: Higher mode accuracy
