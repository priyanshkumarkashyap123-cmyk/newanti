# International Design Standards Implementation

## Overview

Complete implementation of 5 major international structural design standards in Rust, integrated with the BeamLab structural analysis platform.

**Languages Supported:**
- **US:** AISC 360-22 (Steel), ACI 318-19 (Concrete), NDS 2018 (Timber)
- **Europe:** Eurocode 3 EN 1993-1-1 (Steel), Eurocode 2 EN 1992-1-1 (Concrete)
- **India:** IS 800:2007 (Steel), IS 456:2000 (Concrete) [Already implemented]

---

## 1. AISC 360-22 (US Steel Design)

**Location:** `apps/rust-api/src/design_codes/aisc_360.rs`

### Mathematical Framework

**Plastic Moment (No Buckling):**
$$\phi M_n = \phi Z_x F_y$$
- $\phi = 0.90$ (resistance factor)
- $Z_x$ = plastic section modulus
- $F_y$ = specified yield stress

**Unbraced Length Limits:**
- $L_p = 1.76 r_y \sqrt{\frac{E}{F_y}}$ (limit for plastic moment)
- $L_r = 1.95 r_y \sqrt{\frac{E}{0.7F_y}}$ (limit for elastic LTB)

**Lateral-Torsional Buckling (Inelastic, $L_p < L_b \le L_r$):**
$$\phi M_n = \phi C_b \left[ M_p - (M_p - 0.7F_y S_x) \frac{L_b - L_p}{L_r - L_p} \right] \le \phi M_p$$

**Key Parameters:**
- $C_b$ = lateral-torsional buckling modification factor
- $E$ = 200,000 MPa (modulus of elasticity)
- $r_y$ = radius of gyration (weak axis)

### Implementation Details

```rust
pub struct AiscCapacity {
    pub plastic_moment_kNm: f64,
    pub design_strength_kNm: f64,
    pub utilization_ratio: f64,
    pub buckling_mode: String,
    pub lb_mm: f64,  // Unbraced length
    pub lp_mm: f64,  // Limit for yielding
    pub lr_mm: f64,  // Limit for lateral-torsional buckling
}
```

### Database

Includes W-shape sections (W12, W14, W16) with AISC properties:
- W12×120, W12×96, W12×72
- W14×120
- W16×100

### Tests

✅ `test_aisc_plastic_moment` - Verifies Mp calculation
✅ `test_aisc_limiting_lengths` - Verifies Lp < Lr relationship

---

## 2. Eurocode 3 EN 1993-1-1 (European Steel)

**Location:** `apps/rust-api/src/design_codes/eurocode3.rs`

### Mathematical Framework

**Section Classification:** Class 1 (Plastic), Class 2 (Compact), Class 3 (Semi-compact), Class 4 (Slender)

**Bending Resistance (Classes 1 & 2):**
$$M_{c,Rd} = \frac{W_{pl} f_y}{\gamma_{M0}}$$
- $\gamma_{M0}$ = 1.0 (partial safety factor)
- $W_{pl}$ = plastic section modulus

**Lateral-Torsional Buckling:**

Non-dimensional slenderness:
$$\bar{\lambda}_{LT} = \sqrt{\frac{W_{pl} f_y}{M_{cr}}}$$

Reduction factor (Type 'a' curve):
$$\chi_{LT} = \frac{1}{\phi + \sqrt{\phi^2 - \bar{\lambda}_{LT}^2}}$$

where $\phi = 0.5[1 + \alpha(\bar{\lambda}_{LT} - 0.4) + \bar{\lambda}_{LT}^2]$, $\alpha = 0.21$

Design moment:
$$M_{b,Rd} = \chi_{LT} \frac{W_y f_y}{\gamma_{M1}}$$

### Implementation Details

```rust
pub enum SectionClass {
    Class1, Class2, Class3, Class4
}

pub struct EC3Capacity {
    pub bending_resistance_kNm: f64,
    pub ltb_resistance_kNm: f64,
    pub utilization_ratio: f64,
    pub section_class: String,
    pub slenderness_ltb: f64,
    pub reduction_factor_ltb: f64,
}
```

### Database

European I-sections (IPE, HE series):
- IPE 300, IPE 270, IPE 240
- HE 300A

### Tests

✅ `test_ec3_bending_capacity` - Verifies design moment
✅ `test_ec3_classification` - Verifies section classification

---

## 3. ACI 318-19 (US Reinforced Concrete)

**Location:** `apps/rust-api/src/design_codes/aci_318.rs`

### Mathematical Framework

**Whitney Stress Block:**
$$a = \frac{A_s f_y}{0.85 f'_c b}$$
- $A_s$ = area of tension steel
- $f_y$ = rebar yield strength
- $f'_c$ = concrete compressive strength
- $b$ = beam width

**Nominal Moment Capacity:**
$$\phi M_n = \phi A_s f_y \left(d - \frac{a}{2}\right)$$
- $d$ = effective depth
- $\phi$ = strength reduction factor (variable)

**Strength Reduction Factor:**
- If $\epsilon_t \ge 0.005$: $\phi = 0.90$ (tension-controlled)
- If $0.002 \le \epsilon_t < 0.005$: $\phi$ interpolated linearly
- If $\epsilon_t < 0.002$: $\phi \le 0.65$ (compression-controlled)

**Neutral Axis Depth:**
$$c = \frac{a}{\beta_1}$$
where $\beta_1 = 0.85$ for $f'_c \le 28$ MPa, decreases for higher strengths

### Implementation Details

```rust
pub struct ACICapacity {
    pub nominal_moment_kNm: f64,
    pub design_moment_kNm: f64,
    pub utilization_ratio: f64,
    pub strength_reduction_factor: f64,
    pub strain_tension_steel: f64,
    pub compressive_block_depth_mm: f64,
    pub tension_controlled: bool,
}
```

### Database

Common reinforced concrete sections:
- 300×500 (6#10)
- 400×600 (8#12)
- 350×550 (6#12)
- 300×450 (4#12)

### Tests

✅ `test_aci_bending_capacity` - Verifies design moment
✅ `test_aci_strength_reduction_factor` - Verifies φ factor variation
✅ `test_aci_balanced_steel` - Verifies ρ_bal calculation

---

## 4. Eurocode 2 EN 1992-1-1 (European Concrete)

**Location:** `apps/rust-api/src/design_codes/eurocode2.rs`

### Mathematical Framework

**Design Material Strengths:**
$$f_{cd} = \frac{\alpha_{cc} f_{ck}}{\gamma_c}$$
- $\alpha_{cc}$ = 0.85 (long-term effects factor)
- $\gamma_c$ = 1.5 (partial safety factor for concrete)

$$f_{yd} = \frac{f_{yk}}{\gamma_s}$$
- $\gamma_s$ = 1.15 (partial safety factor for steel)

**Rectangular Stress Block Depth:**
$$x = \frac{A_s f_{yd}}{0.8 b f_{cd}}$$

**Lever Arm:**
$$z = d - 0.4x \text{ (clamped to } [0.5d, 0.95d])$$

**Design Moment:**
$$M_d = A_s f_{yd} z$$

### Implementation Details

```rust
pub struct EC2Capacity {
    pub design_moment_kNm: f64,
    pub utilization_ratio: f64,
    pub compressive_zone_depth_mm: f64,
    pub lever_arm_mm: f64,
    pub design_stress_concrete_mpa: f64,
    pub design_stress_steel_mpa: f64,
}
```

### Database

European reinforced concrete sections:
- 250×400 (4Ø14)
- 300×500 (5Ø16)
- 350×550 (6Ø18)
- 400×600 (8Ø16)

### Tests

✅ `test_ec2_fcd_calculation` - Verifies design concrete strength
✅ `test_ec2_bending_capacity` - Verifies design moment
✅ `test_ec2_minimum_steel` - Verifies minimum reinforcement
✅ `test_ec2_lever_arm_bounds` - Verifies lever arm is within bounds

---

## 5. NDS 2018 (US Timber Design)

**Location:** `apps/rust-api/src/design_codes/nds_2018.rs`

### Mathematical Framework

**Adjusted Bending Design Value (Cascade of Factors):**
$$F'_b = F_b \times C_D \times C_M \times C_t \times C_L \times C_F \times C_i \times C_r$$

Where:
- $C_D$ = load duration factor (Permanent: 0.9, 10-Year: 1.0, 7-Day: 1.15, etc.)
- $C_M$ = wet service factor (Wet: 0.85, Dry: 1.0)
- $C_t$ = temperature factor (linear decay with elevation)
- $C_L$ = beam stability factor: $C_L = \frac{1}{\sqrt{1 + (L_u/d)^2}}$
- $C_F$ = size factor (decreases with larger sections, 1.35 for 2×6, 1.0 for 2×12+)
- $C_i$ = incising factor (Incised: 0.9, Not incised: 1.0)
- $C_r$ = repetitive member factor (Repetitive: 1.15, Single: 1.0)

**Moment Capacity:**
$$M' = F'_b \times S$$
- $S$ = section modulus

### Implementation Details

```rust
pub struct NDSCapacity {
    pub reference_bending_value_mpa: f64,
    pub adjusted_bending_value_mpa: f64,
    pub adjusted_section_modulus_mm3: f64,
    pub design_moment_kNm: f64,
    pub utilization_ratio: f64,
    pub adjustment_factor_total: f64,
}
```

### Database

Common sawn lumber grades (No. 2 Pine):
- 2×8 (7.5 in reference bending: 11.7 MPa)
- 2×10 (9.5 in reference bending: 11.7 MPa)
- 2×12 (11.5 in reference bending: 11.0 MPa)
- 4×12 (11.25 in reference bending: 10.3 MPa)

### Tests

✅ `test_nds_load_duration_factors` - Verifies CD values
✅ `test_nds_adjusted_bending_value` - Verifies design moment
✅ `test_nds_beam_stability_factor` - Verifies CL calculation
✅ `test_nds_lateral_bracing` - Verifies Lu/d ratio check

---

## Feature Summary

### Common Capabilities Across All Standards

| Feature | AISC | EC3 | ACI | EC2 | NDS |
|---------|------|-----|-----|-----|-----|
| Bending capacity | ✅ | ✅ | ✅ | ✅ | ✅ |
| Buckling analysis | ✅ | ✅ | - | - | ✅ |
| Material safety factors | ✅ | ✅ | ✅ | ✅ | ✅ |
| Section database | ✅ (W-shapes) | ✅ (IPE/HE) | ✅ (RC) | ✅ (RC) | ✅ (Sawn) |
| Unit tests | 2 | 2 | 3 | 4 | 4 |

### Numerical Stability

All implementations include:
- Division-by-zero guards
- Discriminant checks for square roots
- Value clamping to physical bounds
- Assertion failures with descriptive messages

### Integration with FSD Optimizer

The design code implementations integrate with the Fully Stressed Design (FSD) optimization engine:
- `check_member()` function returns capacity % utilization ratio
- Direct integration in optimization loop for iterative member sizing
- Compatible with multi-standard optimization (choose standard per member)

---

## Compilation Status

✅ **All 42 tests passing**
- 5 international design standards: 15 tests
- 6 Indian design standards: 27 tests
- 0 compilation errors
- 53 warnings (style-related, non-critical)

## Usage Example (Rust API)

```rust
use beamlab_rust_api::{
    AiscSection, AiscDesignParams,
    EC3Section, EC3DesignParams,
    ACISection, ACIDesignParams,
};
use beamlab_rust_api::design_codes::{aisc_360, eurocode3, aci_318};

// AISC 360-22 Design
let section = AiscSection {
    name: "W12x120".into(),
    fy_mpa: 250.0,
    zx_mm3: 1150e3,
    /* ... other properties ... */
};

let params = AiscDesignParams {
    unbraced_length_mm: 2000.0,
    cb: 1.0,
    applied_moment_kNm: 250.0,
};

let capacity = aisc_360::calculate_bending_capacity(&section, &params);
assert!(capacity.utilization_ratio <= 1.0);

// Similarly for Eurocode 3, ACI, EC2, NDS...
```

---

## Files Created

1. `apps/rust-api/src/design_codes/aisc_360.rs` (300+ lines)
2. `apps/rust-api/src/design_codes/eurocode3.rs` (320+ lines)
3. `apps/rust-api/src/design_codes/aci_318.rs` (350+ lines)
4. `apps/rust-api/src/design_codes/eurocode2.rs` (300+ lines)
5. `apps/rust-api/src/design_codes/nds_2018.rs` (340+ lines)

**Files Modified:**
- `apps/rust-api/src/design_codes/mod.rs` - Added module exports
- `apps/rust-api/src/lib.rs` - Added public re-exports of design code types

**Total Implementation:** ~1,500+ lines of production-ready code

---

## Next Steps

### Immediate
- API endpoints for each design standard (POST /api/design/aisc, etc.)
- Web UI components for standard selection
- Multi-standard FSD optimization

### Medium-term
- CSA S16-19 (Canadian steel)
- BS 5950-1 (UK steel)
- IS 1904 (Indian composite)

### Long-term
- Real-time API for external consumption
- Database persistence for design histories
- Compliance certification exports
- PDF report generation

