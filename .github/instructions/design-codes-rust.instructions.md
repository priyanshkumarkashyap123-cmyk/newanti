---
applyTo: "apps/rust-api/src/design_codes/**/*.rs"
description: "Design code implementation rules for IS 456, IS 800, IS 1893, IS 875, ACI 318, AISC 360, Eurocode 2/3, and NDS 2018 Rust modules. Enforces clause citations, safety factor accuracy, and result struct conventions."
---

# Design Code Rust Module Guidelines

## Clause Citation (Mandatory)

Every calculation function MUST include the code clause reference in:
1. A doc comment above the function
2. The result struct's `clause` or `message` field

Examples:
```rust
/// Shear design per IS 456:2000, Cl. 40.1-40.4
/// τc from Table 19 with linear interpolation
pub fn design_shear(...) -> ShearCheckResult { ... }
```

```rust
/// Bolt bearing capacity per IS 800:2007, Cl. 10.3.3
/// kb = min(e/(3d0), p/(3d0)-0.25, fub/fu, 1.0)
pub fn design_bolt_bearing(...) -> BoltBearingResult { ... }
```

## Safety Factors — Never Hardcode Inline

Use named constants at module top, never magic numbers in formulas:

```rust
// IS 456 partial safety factors
const GAMMA_C: f64 = 1.50;  // Concrete (Cl. 36.4.2)
const GAMMA_S: f64 = 1.15;  // Steel reinforcement (Cl. 36.4.2)

// IS 800 partial safety factors
pub const GAMMA_M0: f64 = 1.10;  // Yielding / instability (Table 5)
pub const GAMMA_M1: f64 = 1.25;  // Ultimate stress / fracture (Table 5)
pub const GAMMA_MB: f64 = 1.25;  // Bolted connections (Table 5)
```

If a safety factor value already exists as a constant in the module, reuse it. Do NOT create duplicates.

## Result Structs

Every design check function must return a struct with at minimum:
```rust
pub struct XxxResult {
    pub passed: bool,        // capacity ≥ demand?
    pub utilization: f64,    // demand / capacity (0.0–∞)
    pub message: String,     // human-readable summary with clause ref
    // ... additional fields specific to the check
}
```

Units must be documented in field comments:
```rust
pub tau_v: f64,       // Applied shear stress (N/mm²)
pub vd_kn: f64,       // Design shear capacity (kN)
pub spacing_mm: f64,  // Required stirrup spacing (mm)
```

## Error Handling

- Return `Result<T, SolverError>` for functions that can fail on invalid input.
- Use `?` propagation, never `.unwrap()` on user-supplied data.
- Validate inputs at function entry: fck > 0, fy > 0, dimensions > 0, etc.

## Precision

- Use `f64` exclusively — never `f32`.
- Use `f64::EPSILON` for floating-point comparisons, not `== 0.0`.
- Interpolation (e.g., IS 456 Table 19): use linear interpolation between table values, never round to nearest entry.

## Testing

Each new function must include at least one `#[test]` with:
- Input from a known textbook example or design handbook (cite the source)
- Expected output verified by hand calculation
- Tolerance: 1% for stress/force values, exact for boolean pass/fail

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shear_is456_example() {
        // Example 6.1, Pillai & Menon "RC Design", 4th Ed.
        let result = design_shear(300.0, 450.0, 25.0, 415.0, 120.0, 942.0, 2, 8.0);
        assert!(result.passed);
        assert!((result.tau_v - 0.889).abs() < 0.01);
    }
}
```

## Table Data

When a code table is implemented (e.g., IS 456 Table 19, IS 800 Table 2):
- Include the full table data, not partial
- Cite the table number in a comment above the data
- Use interpolation for intermediate values (never round to nearest row)

## Code-Specific Rules

### IS 456 (is_456.rs)
- fck in MPa, fy in MPa, dimensions in mm, forces in kN, moments in kN·m
- τc interpolation: use both fck grade and pt% as indices
- xu_max/d: 0.53 (Fe250), 0.48 (Fe415), 0.46 (Fe500)

### IS 800 (is_800.rs)
- All steel properties in N/mm² (MPa)
- Section dimensions in mm
- Bolt hole diameter = bolt diameter + 2mm (standard clearance)

### IS 1893 (is_1893.rs)
- Zone factors: II=0.10, III=0.16, IV=0.24, V=0.36
- Never combine wind and earthquake simultaneously (Cl. 6.3.2)
- Spectral acceleration curves differ by soil type

### ACI 318 (aci_318.rs)
- f'c in psi internally if following ACI convention, but convert to MPa for consistency
- φ factors: 0.90 (flexure), 0.75 (shear), 0.65 (compression-controlled)

### AISC 360 (aisc_360.rs)
- LRFD φ factors: 0.90 (yielding), 0.75 (fracture)
- Fy, Fu in ksi internally if following AISC, but convert to MPa for storage
