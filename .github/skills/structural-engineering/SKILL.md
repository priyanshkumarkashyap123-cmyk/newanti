---
name: structural-engineering
description: "**WORKFLOW SKILL** — Structural engineering analysis and design for BeamLab. USE FOR: RC beam/column/slab/footing design per IS 456, IS 800 steel design, seismic analysis per IS 1893, load combinations per IS 875, ACI 318 concrete, AISC 360 steel, Eurocode 2/3, Direct Stiffness Method solver work, P-Delta analysis, modal/dynamic analysis, response spectrum, FSD section optimization, cable catenary analysis, element stiffness matrices, load application, member force extraction, sign conventions, tributary width calculations, NAFEMS benchmarks. DO NOT USE FOR: general frontend UI styling, authentication/auth flow, database schema, deployment/DevOps, non-structural calculations."
argument-hint: "What structural engineering task? (e.g., design an RC beam, add seismic load case, fix solver convergence)"
---

# Structural Engineering — BeamLab

Professional-grade structural engineering platform for analyzing and designing building structures. Multi-engine architecture: Rust API (primary solver), Python FastAPI (secondary solver), WASM (browser solver), React/Three.js frontend.

## When to Use

- Designing RC members (beams, columns, slabs, footings) to IS 456 / ACI 318 / Eurocode 2
- Steel member design per IS 800 / AISC 360 / Eurocode 3
- Running or debugging structural analysis (static, modal, P-Delta, buckling, dynamic)
- Applying loads (point, UDL, trapezoidal, wind, seismic) and load combinations
- Seismic analysis per IS 1893:2016 (base shear, response spectrum, storey drift)
- Section optimization via Fully Stressed Design (FSD)
- Working with element stiffness matrices or solver internals
- Validating results against NAFEMS benchmarks
- Fixing mathematical or sign-convention errors in calculations

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend: React + TypeScript + Three.js (apps/web/src/)     │
│  ├── components/rc-design/      RC beam/column/slab/footing  │
│  ├── components/steel-design/   Steel member design          │
│  ├── components/structural/     27 calculation engines       │
│  └── modules/                   Domain modules (30+)         │
├──────────────────────────────────────────────────────────────┤
│  Rust API (apps/rust-api/src/) — PRIMARY SOLVER              │
│  ├── solver/mod.rs              3D DSM frame solver (6 DOF)  │
│  ├── solver/elements.rs         Element stiffness matrices   │
│  ├── solver/dynamics.rs         Modal/time-history/spectrum  │
│  ├── solver/pdelta.rs           P-Delta geometric nonlinear  │
│  ├── solver/seismic.rs          IS 1893 seismic analysis     │
│  ├── solver/cable.rs            Catenary cable analysis       │
│  ├── design_codes/              IS/ACI/AISC/EC code checks   │
│  └── optimization/fsd_engine.rs FSD section optimization     │
├──────────────────────────────────────────────────────────────┤
│  Python Backend (apps/backend-python/analysis/solvers/)      │
│  ├── dsm_3d_frame.py            DSM solver (920+ lines)      │
│  ├── load_solver.py             Load application & forces     │
│  ├── load_combinations.py       IS 456/800/1893 combos       │
│  ├── dynamics.py                Dynamic analysis              │
│  └── rc_limit_state_design.py   RC LSD calculations          │
├──────────────────────────────────────────────────────────────┤
│  WASM Solver (packages/solver-wasm/src/)                     │
│  └── lib.rs                     Browser-side solver + AI      │
└──────────────────────────────────────────────────────────────┘
```

## Key Procedures

### 1. RC Member Design (Beam/Column/Slab/Footing)

**Relevant files:**
- Frontend: `apps/web/src/components/rc-design/RCBeamDesigner.tsx`, `RCColumnDesigner.tsx`, `RCSlabDesigner.tsx`, `RCFootingDesigner.tsx`
- Rust code checks: `apps/rust-api/src/design_codes/is_456.rs` (IS 456), `aci_318.rs` (ACI), `eurocode2.rs` (EC2)
- Python LSD: `apps/backend-python/analysis/solvers/rc_limit_state_design.py`
- Engines: `apps/web/src/components/structural/ColumnDesignEngine.ts`, `FootingDesignEngine.ts`, `DeepBeamDesignEngine.ts`, etc.

**Design workflow:**
1. Determine factored design forces (Mu, Vu, Nu) from analysis
2. Select design code (IS 456 / ACI 318 / EC2)
3. Check flexure → compute required Ast (tension steel area)
4. Check shear → compare Vu with τc (IS 456 Table 19), provide stirrups
5. Check deflection → span/depth ratios (IS 456 Table 4)
6. For columns: P-M interaction diagram, biaxial check (Bresler's equation)
7. Check development length, detailing requirements

**Critical sign convention:**
| Moment | IS 456 / ACI / EC2 | IS 800 / AISC |
|--------|---------------------|---------------|
| Sagging (+M) | Tension at bottom → bottom steel | Compression at bottom flange |
| Hogging (−M) | Tension at top → top steel | Compression at top flange |

Always use absolute values for capacity checks; preserve signs for reinforcement placement decisions and gradient factors.

### 2. Steel Member Design

**Relevant files:**
- Frontend: `apps/web/src/components/steel-design/SteelMemberDesigner.tsx`
- Rust: `apps/rust-api/src/design_codes/is_800.rs`, `aisc_360.rs`, `eurocode3.rs`
- Engine: `apps/web/src/components/structural/SteelDesignEngine.ts`
- Section DB: `apps/rust-api/src/solver/section_database.rs`

**Design workflow:**
1. Classify section (IS 800 Table 2: plastic, compact, semi-compact, slender)
2. Check shear capacity (Clause 8.4)
3. Check flexural capacity based on classification
4. Check bolt connections: bearing type (Cl. 10.3) or HSFG friction (Cl. 10.4)
5. Check weld: fillet weld design (Cl. 10.5.7)
6. Check deflection limits (IS 800 Table 6)
7. Automatic lightest ISMB section selection available

### 3. Structural Analysis (Solver)

**Relevant files:**
- Rust solver: `apps/rust-api/src/solver/mod.rs` (main DSM), `elements.rs` (stiffness matrices)
- Python solver: `apps/backend-python/analysis/solvers/dsm_3d_frame.py`
- Post-processing: `apps/rust-api/src/solver/post_processor.rs`
- Sparse solver: `apps/rust-api/src/solver/sparse_solver.rs`

**Analysis types and procedures:**

| Analysis | Key Equation | File |
|----------|-------------|------|
| Linear Static | [K]{U} = {F} | `solver/mod.rs`, `dsm_3d_frame.py` |
| Modal | [K − ω²M]{φ} = 0 | `solver/dynamics.rs`, `dynamics.py` |
| P-Delta | ([Ke] + [Kg(P)]){U} = {F} | `solver/pdelta.rs` |
| Buckling | [K + λKg]{φ} = 0 | `buckling.py` |
| Response Spectrum | CQC: R = √(ΣΣ ρᵢⱼ Rᵢ Rⱼ) | `solver/dynamics.rs` |
| Time-History | Newmark-β: [M]{ü} + [C]{u̇} + [K]{u} = {F(t)} | `solver/dynamics.rs` |
| Cable | Catenary: y = (H/w)(cosh(wx/H) − 1) | `solver/cable.rs`, `cable.py` |

**Element types:**
- Timoshenko Beam (12×12, shear deformable) — primary
- Euler-Bernoulli (6 DOF, slender members)
- Truss (2-node, axial only)
- Plate/Shell (4-node, Mindlin-Reissner)
- Spring (6 DOF), Rigid Link, Cable

### 4. Load Application

**Relevant files:**
- Rust: `solver/mod.rs` (load assembly), `solver/load_combinations.rs`
- Python: `load_solver.py`, `load_combinations.py`
- Frontend: `apps/web/src/components/structural/LoadAnalysisEngine.ts`
- Wind: `apps/rust-api/src/design_codes/is_875.rs`

**Load types:** Point forces/moments, UDL, triangular, trapezoidal, wind (IS 875), seismic (IS 1893), moving loads

**UDL → equivalent joint loads (fixed-end forces):**
```
Full span:  Ri = wL/2,  Rj = wL/2,  Mi = wL²/12,  Mj = −wL²/12
Partial:    Use virtual work or integration formulas
```

**Critical tributary width rule for 2-way slabs:**
```
CORRECT:   tributaryWidth = bayWidth / 4  (2-way distribution)
WRONG:     tributaryWidth = bayWidth / 2  (causes double-counting)
```

### 5. Seismic Analysis (IS 1893:2016)

**Relevant files:**
- Rust: `apps/rust-api/src/solver/seismic.rs`, `apps/rust-api/src/design_codes/is_1893.rs`
- Frontend: `apps/web/src/components/structural/SeismicAnalysisEngine.ts`

**Procedure:**
1. Determine seismic zone (II–V) → zone factor Z
2. Classify soil type (Hard/Medium/Soft)
3. Compute natural period T per building type
4. Get spectral acceleration Sa/g from response spectrum curves
5. Compute Ah = (Z/2)(Sa/g)/(R/I) — design horizontal acceleration
6. Base shear Vb = Ah × W (seismic weight)
7. Distribute vertically: Qi = Vb × (Wi·hi²) / Σ(Wj·hj²)
8. Check storey drift < 0.004h (IS 1893 limit)
9. For modal: SRSS or CQC combination of modal responses

### 6. FSD Section Optimization

**Relevant files:**
- Rust: `apps/rust-api/src/optimization/fsd_engine.rs`
- Frontend: `apps/web/src/modules/optimization/`

**Procedure:**
1. Start with initial section assignments from ISMB catalog
2. Run analysis → get utilization ratios (UR) for all members, all load cases
3. If UR > target (1.0): scale section up to next larger ISMB
4. If UR < 0.8×target: scale section down to next smaller ISMB
5. Re-analyze (stiffness redistribution for indeterminate structures)
6. Iterate until convergence (weight change < tolerance)
7. Objective: minimize W = Σ ρᵢ Aᵢ Lᵢ

## Mathematical Reference

See [mathematical framework](./references/math-framework.md) for complete equations:
- 3D Timoshenko beam stiffness matrix (12×12)
- Coordinate transformation matrices
- Geometric stiffness matrix for P-Delta
- Newmark-β time integration scheme
- CQC modal combination with cross-correlation coefficients

## Design Codes Reference

See [design codes reference](./references/design-codes.md) for:
- IS 456:2000 (RC concrete), IS 800:2007 (steel), IS 875 (loads), IS 1893:2016 (seismic)
- ACI 318-19, AISC 360-22, Eurocode 2/3, NDS 2018

## Known Issues & Gotchas

See [known issues](./references/known-issues.md) for:
- Modal analysis empty mode shapes (frequencies correct)
- Seismic mock effective weights
- Shear modulus hardcoded as G = E/2.6 (8% error for concrete)
- Reaction computation bug (uses load negation, not K*u − F)
- 335 `.unwrap()` calls in Rust code

## Validation

- **NAFEMS benchmarks:** 82 tests, 78 passed (95.1%)
- Categories: Linear Elastic, Free Vibration, Nonlinear, Thermal, Contact/Impact
- See `NAFEMS_BENCHMARK_REPORT.md` and `NAFEMS_REAL_BENCHMARK_REPORT.md`
- Rust unit tests: 42 passing
- Frontend component tests: `apps/web/src/__tests__/`
