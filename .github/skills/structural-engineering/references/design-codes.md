# Design Codes Reference

## IS 456:2000 — Plain and Reinforced Concrete (Limit State Method)

### Key Functions (Rust: `apps/rust-api/src/design_codes/is_456.rs`)

| Function | Purpose | Clause |
|----------|---------|--------|
| `table_19_tc(fck, pt_percent)` | Permissible shear stress τc with interpolation | Table 19 |
| `xu_max_ratio(fy)` | Maximum neutral axis depth ratio | Cl. 38.1 |
| `flexural_capacity_singly(b, d, fck, fy, ast)` | Singly reinforced beam Mu | Cl. 38.1 |
| `flexural_capacity_doubly(b, d, d', fck, fy, ast, asc)` | Doubly reinforced beam Mu | Cl. 38.1 |
| `design_shear(b, d, fck, fy, vu_kn, ast, stirrup_legs, stirrup_dia)` | Complete shear check + stirrup design | Cl. 40 |
| `pm_interaction_curve(b, d, d', fck, fy, ast_total, n_points)` | P-M interaction diagram for columns | SP 16 |
| `check_column_biaxial(pu, mux, muy, b, d, d', fck, fy, ast_total)` | Bresler's equation biaxial check | Cl. 39.6 |
| `check_deflection(span, d, pt, pc, support_condition, fs)` | Deflection via span/depth ratio | Cl. 23.2, Table 4 |
| `development_length(phi, fy, fck)` | Bar development length | Cl. 26.2.1 |

### IS 456 Shear Design (Table 19)

Permissible shear stress τc interpolated from table data indexed by:
- Concrete grade fck (M15–M40)
- Tension steel percentage pt% (0.15–3.0)

Maximum shear stress τc_max:
| fck (MPa) | 20 | 25 | 30 | 35 | 40 |
|-----------|-----|-----|-----|-----|-----|
| τc_max | 2.8 | 3.1 | 3.5 | 3.7 | 4.0 |

If τv > τc_max: section is inadequate (increase size).
If τv > τc: provide stirrups for Vus = Vu − τc·b·d.

### IS 456 xu/d Maximum

| fy (MPa) | xu_max/d |
|-----------|----------|
| 250 | 0.53 |
| 415 | 0.48 |
| 500 | 0.46 |

### IS 456 Column Biaxial Check (Bresler)

```
(Mux/Mux1)^αn + (Muy/Muy1)^αn ≤ 1.0
```
αn = 1.0 for Pu/Puz ≤ 0.2, αn = 2.0 for Pu/Puz ≥ 0.8, interpolate between.

---

## IS 800:2007 — General Construction in Steel (Limit State Method)

### Key Functions (Rust: `apps/rust-api/src/design_codes/is_800.rs`)

| Function | Purpose | Clause |
|----------|---------|--------|
| `design_shear(d_web, tw, fy, vu_kn)` | Web shear capacity | Cl. 8.4 |
| `design_bolt_bearing(bolt_dia, grade, n_bolts, fu_plate, t_plate, vu_kn, ...)` | Bearing bolt design | Cl. 10.3 |
| `design_bolt_hsfg(bolt_dia, grade, n_bolts, mu_f, vu_kn)` | HSFG friction bolt design | Cl. 10.4 |
| `design_fillet_weld(weld_size, length, fu, demand_kn)` | Fillet weld design | Cl. 10.5.7 |
| `bolt_grade(grade_str)` | Bolt grade properties (fub, fyb) | Table 7 |

### Partial Safety Factors

| Factor | Value | Use |
|--------|-------|-----|
| γm0 | 1.10 | Yielding, instability |
| γm1 | 1.25 | Ultimate stress, fracture |
| γmb | 1.25 | Bolted connections |
| γmw | 1.25 | Welded connections |

### Section Classification (Table 2)

| Class | Behavior | Rotation Capacity |
|-------|----------|-------------------|
| Plastic | Full plastic moment, large rotation | High |
| Compact | Full plastic moment, limited rotation | Limited |
| Semi-compact | Elastic moment only | None |
| Slender | Local buckling below yield | None |

---

## IS 875 (Parts 1–5) — Design Loads

### Key Functions (Rust: `apps/rust-api/src/design_codes/is_875.rs`)

- Dead loads: Unit weights of materials (Part 1)
- Live loads: Imposed loads by occupancy (Part 2)
- Wind loads: Terrain factors k1/k2/k3, pressure coefficients Cp (Part 3)
- Snow loads: Ground snow load, shape factors (Part 4)
- Load combinations: LSM factors (Part 5)

### Standard Load Combinations (IS 875 Part 5 — LSM)

| Combination | Expression |
|-------------|------------|
| LC1 | 1.5(DL + LL) |
| LC2 | 1.5(DL + WL) |
| LC3 | 1.2(DL + LL + WL) |
| LC4 | 1.5(DL + EQ) |
| LC5 | 1.2(DL + LL + EQ) |
| LC6 | 0.9DL + 1.5WL |
| LC7 | 0.9DL + 1.5EQ |

---

## IS 1893:2016 (Part 1) — Earthquake Resistant Design

### Key Functions (Rust: `apps/rust-api/src/design_codes/is_1893.rs`)

| Function | Purpose |
|----------|---------|
| `SeismicZone::z_factor()` | Zone factor Z (II=0.10, III=0.16, IV=0.24, V=0.36) |
| `spectral_acceleration(T, soil)` | Sa/g from response spectrum for soil type |
| `calculate_period_approx(height, building_type)` | Approximate Ta |
| `calculate_ah(Z, I, R, Sa_g)` | Ah = (Z/2)(Sa/g)/(R/I) |
| `calculate_base_shear(Z, I, R, T, soil, W)` | Vb = Ah × W |
| `vertical_distribution(vb, weights[], heights[])` | Qi per storey |
| `check_storey_drift(elastic_drift, R, height, limit)` | Drift < 0.004h |
| `combine_srss(responses[])` | SRSS modal combination |
| `combine_cqc(responses[], freqs[], damping)` | CQC with cross-correlation |

### Seismic Zones

| Zone | Z | Typical Regions |
|------|------|------|
| II | 0.10 | Low seismicity |
| III | 0.16 | Moderate |
| IV | 0.24 | High |
| V | 0.36 | Very high |

### Approximate Natural Period

| Building Type | Formula |
|---------------|---------|
| RC frame (bare) | T = 0.075 h^0.75 |
| RC frame (infill) | T = 0.09 h / √d |
| Steel frame | T = 0.085 h^0.75 |
| Masonry | T = 0.09 h / √d |

### Spectral Acceleration (Sa/g)

| Period Range | Hard Soil | Medium Soil | Soft Soil |
|-------------|-----------|-------------|-----------|
| T < 0.10 | 1 + 15T | 1 + 15T | 1 + 15T |
| 0.10 ≤ T ≤ Tc | 2.50 | 2.50 | 2.50 |
| T > Tc | 1.0/T | 1.36/T | 1.67/T |

Tc = 0.40 (hard), 0.55 (medium), 0.67 (soft)

---

## ACI 318-19 — Building Code for Structural Concrete (USA)

**Rust:** `apps/rust-api/src/design_codes/aci_318.rs`

Key provisions:
- Strength reduction factors: φ = 0.90 (flexure), 0.75 (shear), 0.65–0.90 (compression)
- Whitney stress block: a = Asfy / (0.85f'c·b)
- Shear: Vc = 2√f'c · bw · d (simplified)
- Development length per Chapter 25

---

## AISC 360-22 — Specification for Structural Steel Buildings (USA)

**Rust:** `apps/rust-api/src/design_codes/aisc_360.rs`

Key provisions:
- LRFD resistance factors: φ = 0.90 (yielding), 0.75 (fracture)
- Flexure: Mn per Chapter F (compact/noncompact/slender)
- Shear: Vn = 0.6Fy·Aw·Cv1 (Chapter G)
- Compression: Fcr for flexural, torsional, local buckling (Chapter E)

---

## Eurocode 2 (EN 1992-1-1) & Eurocode 3 (EN 1993-1-1)

**Rust:** `apps/rust-api/src/design_codes/eurocode2.rs`, `eurocode3.rs`

### EC2 — Concrete
- Parabolic-rectangular stress block (α = 1.0, λ = 0.8 for fck ≤ 50)
- Variable shear without stirrups: VRd,c = [CRd,c · k · (100ρ1·fck)^(1/3)] · bw · d
- γc = 1.5 (concrete), γs = 1.15 (steel)

### EC3 — Steel
- Cross-section classification (Class 1–4)
- Resistance: Mc,Rd = Wpl·fy/γM0 (Class 1/2), Mel,Rd = Wel·fy/γM0 (Class 3)
- γM0 = 1.00, γM1 = 1.00, γM2 = 1.25

---

## NDS 2018 — National Design Specification for Wood (USA)

**Rust:** `apps/rust-api/src/design_codes/nds_2018.rs`

- Adjustment factors: CD, CM, Ct, CL, CF, Cfu, Ci, Cr
- Reference design values from NDS Supplement tables
- ASD and LRFD format factors
