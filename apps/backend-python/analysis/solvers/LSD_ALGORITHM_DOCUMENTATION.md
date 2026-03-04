"""
IS 456:2000 LIMIT STATE DESIGN (LSD) - REINFORCED CONCRETE BEAMS
ALGORITHMIC IMPLEMENTATION AND USER GUIDE

Standard: IS 456:2000 "Code of Practice for Plain and Reinforced Concrete"
         Indian Standard for Structural Design and Testing of Concrete

Document Version: 1.0
Date: March 2026
Author: BeamLab Ultimate Development Team

================================================================================
TABLE OF CONTENTS
================================================================================

1. OVERVIEW AND PHILOSOPHY
2. THE LSD ALGORITHM (STEP-BY-STEP)
3. ALGORITHMIC FLOW DIAGRAM
4. MATHEMATICAL FORMULATIONS
5. CODE REFERENCES (IS 456:2000)
6. IMPLEMENTATION DETAILS
7. USAGE EXAMPLES
8. OUTPUT SPECIFICATIONS
9. VALIDATION AND TESTING

================================================================================
1. OVERVIEW AND PHILOSOPHY
================================================================================

LIMIT STATE DESIGN (LSD) is a semi-probabilistic approach to structural design
that uses partial safety factors (γ_m) to account for uncertainties in:

  • Material strength variations
  • Load estimation errors
  • Model/computational approximations
  • Construction tolerances

vs. WORKING STRESS DESIGN (WSD): Uses permissible stress ratios (~1/2 of strength)

KEY ADVANTAGES OF LSD:

  ✓ More economical designs (accounts for actual failure modes)
  ✓ Better safety margins (uses partial factors)
  ✓ Accounts for ductility (ensures warning before collapse)
  ✓ Treats compression and tension steel differently
  ✓ Handles both singly and doubly reinforced sections


================================================================================
2. THE LSD ALGORITHM (STEP-BY-STEP WORKFLOW)
================================================================================

┌─────────────────────────────────────────────────────────────────────────┐
│ INPUT: Mu (Ultimate Moment), Vu (Ultimate Shear), Section, Materials    │
└─────────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: CALCULATE LIMITING MOMENT (Mu,lim)                             │
│                                                                           │
│ Purpose: Determine maximum moment that can be resisted with SINGLY      │
│          reinforced section while maintaining ductility.                │
│                                                                           │
│ Procedure (Clause 38.1):                                                │
│   1. Limit neutral axis depth: xu/d ≤ 0.48 (for M20-M40)               │
│   2. At limiting condition, xu = 0.48*d                                 │
│   3. Calculate stress block: C_c = 0.36*fck*b*xu                        │
│   4. Lever arm: z = d - 0.42*xu (min. 0.95*d for ductility)            │
│   5. Limiting moment: Mu,lim = C_c * z                                  │
│                                                                           │
│ Variables:                                                               │
│   fck: Characteristic compressive strength (N/mm²)                       │
│   b: Beam width (mm)                                                     │
│   d: Effective depth (mm)                                                │
│   xu: Neutral axis depth (mm)                                            │
│   z: Lever arm (mm)                                                      │
│                                                                           │
│ Output: Mu,lim (kN·m) and related parameters                            │
└─────────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: COMPARE Mu WITH Mu,lim                                         │
└─────────────────────────────────────────────────────────────────────────┘
                    ↓                           ↓
     Mu < Mu,lim (SAFE)         Mu > Mu,lim (OVER-CAPACITY)
            ↓                            ↓
  ┌──────────────────┐        ┌──────────────────────┐
  │ SINGLY           │        │ DOUBLY REINFORCED    │
  │ REINFORCED       │        │ (with compression)   │
  └──────────────────┘        └──────────────────────┘
         ↓                            ↓
 [STEP 3A]                    [STEP 3B]
                                ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3A: SINGLY REINFORCED DESIGN (Mu < Mu,lim)                        │
│                                                                           │
│ Procedure (Clause 38.2):                                                │
│   1. K = Mu / (fck*b*d²)  [Moment coefficient]                          │
│   2. Find xu/d from: 0.1512*(xu/d)² - 0.36*(xu/d) + K = 0              │
│   3. xu = (xu/d) * d                                                     │
│   4. z = d - 0.42*xu (≥ 0.95*d)                                         │
│   5. Ast = Mu / (0.87*fy*z)                                             │
│   6. Select standard bars to match Ast                                   │
│                                                                           │
│ OUTCOME:                                                                 │
│   – Main tension steel: Ast (bottom)                                    │
│   – No compression steel                                                │
│   – Minimum distribution steel at top: 2-10φ                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3B: DOUBLY REINFORCED DESIGN (Mu > Mu,lim)                        │
│                                                                           │
│ Procedure (Clause 38.3):                                                │
│   1. Excess moment: Mu,excess = Mu - Mu,lim                             │
│   2. Compression steel: Asc = Mu,excess / [0.87*fy*(d - d')]           │
│   3. Tension steel: Ast = Ast1 + Ast2                                   │
│      where Ast1 = Mu,lim / (0.87*fy*z_lim)                             │
│            Ast2 = Asc [moment couple effect]                            │
│   4. Select standard bars for Ast and Asc                               │
│                                                                           │
│ OUTCOME:                                                                 │
│   – Main tension steel: Ast (bottom)                                    │
│   – Compression steel: Asc (top)                                        │
│   – Both contribute to moment resistance                                │
└─────────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: SHEAR DESIGN (Clause 40)                                        │
│                                                                           │
│ Procedure:                                                               │
│   1. Nominal shear stress: τv = Vu / (b*d)  [N/mm²]                     │
│   2. Design shear strength: τc = k*tc*(√fck)                            │
│                                                                           │
│   where k = 1 + √(25 - pt)   [depends on reinforcement ratio]          │
│         pt = Ast/(b*d) % [tension steel percentage]                     │
│         tc = 0.48 MPa [base value for M20]                              │
│                                                                           │
│   Maximum τc (Cl. 40.2.1.1):                                            │
│     • Singly reinforced: τc ≤ 4.0 N/mm²                                │
│     • Doubly reinforced: τc ≤ 4.8 N/mm²                                │
│                                                                           │
│   3. Decision:                                                           │
│      IF τv ≤ τc:                                                        │
│           NO shear reinforcement required (use minimum spacing)         │
│      ELSE (τv > τc):                                                    │
│           Shear reinforcement REQUIRED                                   │
│           Calculate stirrup spacing: s = (Asv*0.87*fy*d) / Vu         │
│           where Asv = 2-leg stirrup area (mm²)                          │
│                                                                           │
│   4. Select standard stirrup diameter and round spacing to              │
│      nearest 50 mm increment (Cl. 26.5.1.5, 40.4)                      │
│                                                                           │
│   Minimum: 8φ @ 300 c/c (or 8φ @ 150 c/c for high shear)              │
│   Maximum: 300 mm spacing                                               │
└─────────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ OUTPUT: COMPLETE REBAR SPECIFICATION                                    │
│                                                                           │
│ Example Format:                                                          │
│   "Bottom: 3-16φ | Top: 2-12φ | Shear: 8φ @ 150 c/c"                  │
│                                                                           │
│ This specifies:                                                          │
│   • Main tension: 3 bars @ 16 mm diameter                               │
│   • Compression steel: 2 bars @ 12 mm diameter                          │
│   • Stirrups: 8 mm diameter, spaced 150 mm center-to-center            │
└─────────────────────────────────────────────────────────────────────────┘


================================================================================
3. ALGORITHMIC FLOW DIAGRAM
================================================================================

INPUT: Mu, Vu, Section (b, d), Materials (fck, fy)
   ↓
STEP 1: Calculate Mu,lim
   ├─ xu_lim = 0.48 * d
   ├─ Cc = 0.36 * fck * b * xu_lim
   ├─ z_lim = d - 0.42 * xu_lim
   └─ Mu,lim = Cc * z_lim
   ↓
STEP 2: Branch on Mu vs Mu,lim
   ↓
   ├─ IF Mu < Mu,lim: SINGLY REINFORCED
   │  ├─ K = Mu / (fck * b * d²)
   │  ├─ Solve quadratic for xu/d
   │  ├─ xu = (xu/d) * d
   │  ├─ z = max(d - 0.42*xu, 0.95*d)
   │  ├─ Ast = Mu / (0.87*fy*z)
   │  └─ Select bars for Ast → OUTPUT: Bottom steel config
   │
   └─ ELSE Mu > Mu,lim: DOUBLY REINFORCED
      ├─ Mu,excess = Mu - Mu,lim
      ├─ Asc = Mu,excess / [0.87*fy*(d-d')]
      ├─ Ast1 = Mu,lim / (0.87*fy*z_lim)
      ├─ Ast2 = Asc
      ├─ Ast_total = Ast1 + Ast2
      ├─ Select bars for Ast → OUTPUT: Bottom steel config
      └─ Select bars for Asc → OUTPUT: Top steel config
   ↓
STEP 3: Shear Design
   ├─ τv = Vu / (b*d)
   ├─ pt = Ast / (b*d)
   ├─ τc = k * tc * √(fck/25)   [with k = 1 + √(25-pt)]
   ├─ IF τv > τc:
   │  ├─ Vu,stirrup = Vu - τc*b*d (shear to be resisted)
   │  ├─ Select stirrup diameter
   │  ├─ s = (Asv * 0.87 * fy * d) / Vu,stirrup
   │  └─ OUTPUT: Stirrup config e.g., "8φ @ 150"
   └─ ELSE: OUTPUT: "8φ @ 300" (minimum)
   ↓
FINAL OUTPUT: Rebar Specification
   "Bottom: X-YYφ | Top: X-YYφ | Shear: Zφ @ SSS"


================================================================================
4. MATHEMATICAL FORMULATIONS
================================================================================

4.1 LIMITING MOMENT CALCULATION
──────────────────────────────────────────────────────────────────────────────

At limiting condition (xu/d = 0.48):

  Neutral Axis Depth:
    xu = 0.48 * d

  Compression Force (stress block):
    Cc = 0.36 * fck * b * xu

  Lever Arm (distance from C.C. of compression to tension):
    z = d - (xu/2 + 0.16*fck/100)*xu    [simplified to]
    z = d - 0.42*xu                      [Clause 38.2]

  Limiting Moment:
    Mu,lim = Cc * z = 0.36*fck*b*xu*(d - 0.42*xu)

  Ductility Check:
    z ≥ 0.95*d  (ensures ductile sections)


4.2 MOMENT COEFFICIENT (FOR SINGLY REINFORCED)
──────────────────────────────────────────────────────────────────────────────

Moment Coefficient:
  K = Mu / (fck * b * d²)

Relationship (from rectangular stress block):
  Mu = 0.36*fck*xu*b*(d - 0.42*xu)
  
  Dividing by (fck*b*d²):
  K = 0.36*(xu/d) - 0.1512*(xu/d)²

Quadratic Solution for xu/d:
  0.1512*m² - 0.36*m + K = 0  where m = xu/d
  
  m = [0.36 ± √(0.36² - 4*0.1512*K)] / (2*0.1512)
  
  Choose smaller root (m < 0.48) for ductility


4.3 REQUIRED STEEL AREA
──────────────────────────────────────────────────────────────────────────────

Tension Steel (Singly Reinforced):
  Ast = Mu / (0.87 * fy * z)
  
  where:
    Mu = design moment (N·mm)
    0.87*fy = design yield stress of steel (Clause 36.4.2)
    z = lever arm (mm)

Compression Steel (Doubly Reinforced):
  Asc = (Mu - Mu,lim) / (0.87 * fy * (d - d'))
  
  where:
    d' = depth to compression steel centroid (mm)

Total Tension (Doubly Reinforced):
  Ast,total = [Mu,lim/(0.87*fy*z_lim)] + Asc


4.4 SHEAR STRESS AND STRENGTH
──────────────────────────────────────────────────────────────────────────────

Nominal Shear Stress:
  τv = Vu / (b * d)  [N/mm²]
  
  where:
    Vu = ultimate shear force (N)
    b = beam width (mm)
    d = effective depth (mm)

Design Shear Strength (Concrete):
  τc = k * tc * √(fck/25)  or √(fck/20) for M20
  
  where:
    k = 1 + √(25 - pt)
    pt = (Ast/(b*d)) * 100  [steel percentage, %]
    tc = 0.48 N/mm² (base value, Table 19)

  Maximum Limits (Table 19):
    • Singly reinforced: τc ≤ min(calc value, 4.0 N/mm²)
    • Doubly reinforced: τc ≤ min(calc value, 4.8 N/mm²)


4.5 STIRRUP DESIGN
──────────────────────────────────────────────────────────────────────────────

If τv > τc, shear reinforcement required:

Shear Carried by Stirrups:
  Vu,stirrup = Vu - (τc * b * d)

Required Stirrup Spacing (2-legged):
  s = (Asv * 0.87 * fy * d) / Vu,stirrup
  
  where:
    Asv = 2 * π * (dia/2)² [2-leg area, mm²]
    fy = characteristic yield strength (N/mm²)

Constraints (Clause 26.5.1.5, 40.4):
  • Minimum diameter: 8 mm
  • Maximum spacing: 300 mm
  • Minimum spacing: 100 mm
  • Spacing typically rounded to 50 mm increments


4.6 DESIGN FACTORS (IS 456:2000, Clause 36.4.2)
──────────────────────────────────────────────────────────────────────────────

Partial Safety Factors (γ_m):
  γ_m,concrete = 1.5
  γ_m,steel = 1.15

Stress Reduction Factors:
  fcd (design concrete strength) = (0.67 * fck) / γ_m,concrete
                                 = (0.67 * fck) / 1.5
                                 ≈ 0.45 * fck

  fyd (design steel strength) = (0.87 * fy) / γ_m,steel
                               = (0.87 * fy) / 1.15
                               ≈ 0.756 * fy

  Note: 0.87 factor accounts for reduction due to limit state conditions


================================================================================
5. CODE REFERENCES (IS 456:2000)
================================================================================

KEY CLAUSES AND TABLES:

Clause 36.4.2  - Partial safety factors and calculation of design stresses
Clause 36.4.3  - Stress block parameters (0.36*fck, 0.42*xu)
Clause 38.1    - Limiting neutral axis depth (xu/d ≤ 0.48)
Clause 38.2    - Design of singly reinforced sections
Clause 38.3    - Design of doubly reinforced sections
Clause 40.1    - Nominal shear stress
Clause 40.2.1.1 - Design shear strength of concrete (Table 19)
Clause 40.4    - Spacing of reinforcement in shear
Clause 26.5.1.5 - Minimum diameter of transaction reinforcement

Table 19       - Design Shear Strength (τc) Values
Table 2        - Moment Resistance Coefficient (used in design charts)

IS 875:1987    - Code of Practice for Design Loads (Dead, Live, Wind)
IS 1893:2016   - Earthquake Design Code


================================================================================
6. IMPLEMENTATION DETAILS
================================================================================

6.1 MODULE STRUCTURE
──────────────────────────────────────────────────────────────────────────────

rc_limit_state_design.py
├── ConcreteGrade (Enum)        → M20 to M50
├── RebarGrade (Enum)           → Fe415, Fe500, Fe500S
├── LimitStateDesignConstants   → IS 456 parameters
├── BeamSection (dataclass)     → Section geometry
├── ConcreteProperties          → Material properties
├── RebarProperties             → Steel properties
├── LimitingMomentCalculator    → STEP 1
├── SinglelyReinforcedDesign    → STEP 3A
├── DoublyReinforcedDesign      → STEP 3B
├── ShearDesign                 → STEP 4
└── LimitStateDesignBeam        → Master algorithm

lsd_integration.py
├── LoadFactoring               → Apply load factors (1.5x)
├── LoadBalancer               → Combine load cases
├── RCBeamDesigner              → Full workflow API
└── design_rc_beam()            → Quick design function


6.2 REBAR SELECTION ALGORITHM
──────────────────────────────────────────────────────────────────────────────

Function: _select_reinforcement(Ast_required, b, d)

Goal: Find standard bar configuration matching Ast_required with minimum excess

Algorithm:
  1. For each diameter in [32, 28, 25, 20, 16, 12, 10, 8] (descending)
     2. Calculate bar area: A_bar = π*(dia/2)²
     3. For each count from 2 to max_bars:
        4. Provided area = count * A_bar
        5. If provided ≥ required:
           6. Track (dia, count, provided) if excess is minimal

Later:
  7. Select configuration with least excess

This ensures:
  ✓ Minimum number of bars for constructability
  ✓ Preference for larger diameters (fewer bars)
  ✓ Respect for minimum spacing (Cl. 26.5 requires care)


6.3 NUMERICAL SAFEGUARDS
──────────────────────────────────────────────────────────────────────────────

Epsilon Tolerances:
  • Zero check: 1e-10 (for concrete strain, stresses)
  • Equality of points: 1e-6 (for geometry)
  
Limits:
  • Tension steel: pt ≤ 25% (capped in shear calculation)
  • Compression steel: Asc ≤ 4% of gross area (Cl. 26.5.1.1)
  • Neutral axis: xu ≤ 0.48*d (ductility requirement)
  • Lever arm: z ≥ 0.95*d (ductility check)

Warnings:
  • If xu/d > 0.48 for singly reinforced → Under-reinforced section
  • If Asc exceeds 4% limit → Capped and warning issued
  • If design ratio > 1.0 → Design fails


================================================================================
7. USAGE EXAMPLES
================================================================================

7.1 BASIC USAGE (Quick Design)
──────────────────────────────────────────────────────────────────────────────

from lsd_integration import design_rc_beam

# Design 300×600 mm beam with M30 & Fe500
result = design_rc_beam(
    Mu=350.0,           # kN·m
    Vu=200.0,           # kN
    width_mm=300,
    depth_mm=600,
    concrete_grade='M30',
    steel_grade='Fe500',
    cover_mm=50
)

print(result['rebar_layout']['summary'])
# OUTPUT: "Bottom: 3-16φ | Top: 2-12φ | Shear: 8φ @ 150"


7.2 ADVANCED USAGE (Full Control)
──────────────────────────────────────────────────────────────────────────────

from rc_limit_state_design import (
    BeamSection,
    ConcreteProperties,
    RebarProperties,
    ConcreteGrade,
    RebarGrade,
    LimitStateDesignBeam,
)

# Define section
beam = BeamSection(b=400, d=700, d_prime=80)

# Define materials
concrete = ConcreteProperties(grade=ConcreteGrade.M40, fck=40.0)
rebar = RebarProperties(grade=RebarGrade.Fe500, fy=500.0)

# Design loads
Mu = 500.0  # kN·m
Vu = 250.0  # kN

# Execute
designer = LimitStateDesignBeam(Mu, Vu, beam, concrete, rebar)
full_result = designer.design()

# Access detailed results
print(f"Mu_lim = {full_result.limiting_moment.Mu_lim:.2f} kN·m")
print(f"Bending type = {full_result.bending.design_type}")
print(f"Stirrups = {full_result.shear.stirrup_desc}")
print(f"Status = {full_result.design_status}")


7.3 INTEGRATION WITH STRUCTURAL ANALYSIS
──────────────────────────────────────────────────────────────────────────────

from load_solver import BackSubstitution, AnalysisResultFormatter
from lsd_integration import LoadFactoring, RCBeamDesigner, DesignInput

# Step 1: Run structural analysis
# (Assume analysis_results from load_solver.py)
analysis_results = {...}  # From FEA

# Step 2: Extract service loads
member_forces = analysis_results['member_forces']
max_moment_nm = member_forces['M1']['moment_y_i'] * 1e6  # N·mm
max_shear_n = member_forces['M1']['shear_y_i'] * 1e3      # N

# Step 3: Convert to ultimate (apply load factor 1.5)
Mu, Vu = LoadFactoring.factor_loads(
    Md=max_moment_nm / 1e6,  # Convert to kN·m
    Vd=max_shear_n / 1e3,    # Convert to kN
    load_factor=1.5
)

# Step 4: Design RC beam
design_input = DesignInput(
    Mu=Mu,
    Vu=Vu,
    beam_width=300,
    beam_depth=600,
    concrete_grade='M30',
    steel_grade='Fe500'
)

designer = RCBeamDesigner(design_input)
rc_design = designer.design()

print(rc_design['rebar_layout']['summary'])


================================================================================
8. OUTPUT SPECIFICATIONS
================================================================================

8.1 LIMITING MOMENT OUTPUT
──────────────────────────────────────────────────────────────────────────────

{
  "Mu_lim": 450.235,    # kN·m
  "xu_lim": 288.0,      # mm (0.48*d)
  "z_lim": 429.6,       # mm (d - 0.42*xu)
  "r_lim": 2.25,        # Moment coefficient
  "is_ductile": true
}


8.2 BENDING DESIGN OUTPUT
──────────────────────────────────────────────────────────────────────────────

SINGLY REINFORCED:
{
  "design_type": "singly_reinforced",
  "Ast_required": 1850.5,       # mm²
  "Asc_required": 0.0,          # mm²
  "xu": 195.0,                  # mm
  "z": 517.0,                   # mm
  "Mu_provided": 350.05,        # kN·m (must ≥ Mu)
  "pt": 0.95,                   # % tension steel
  "main_rebar_size": 16,        # mm diameter
  "main_rebar_count": 3,        # of bars
  "main_rebar_desc": "3-16φ",   # Engineering notation
  "comp_rebar_size": 0,
  "comp_rebar_count": 0,
  "comp_rebar_desc": "",
  "pt_balance": 2.28,           # Ductility reference
  "mu_ratio": 0.999             # <1.0 for safe design
}

DOUBLY REINFORCED:
{
  "design_type": "doubly_reinforced",
  "Ast_required": 3200.5,       # mm²
  "Asc_required": 1050.0,       # mm²
  "xu": 288.0,                  # mm (at xu/d = 0.48 limit)
  "z": 429.6,                   # mm
  "Mu_provided": 550.02,        # kN·m
  "main_rebar_desc": "4-20φ",
  "comp_rebar_desc": "2-16φ",
  ...
}


8.3 SHEAR DESIGN OUTPUT
──────────────────────────────────────────────────────────────────────────────

{
  "Vu": 200.0,                   # kN (applied)
  "tau_v": 1.11,                 # N/mm² (nominal stress)
  "tau_c": 1.58,                 # N/mm² (design strength)
  "requires_stirrups": false,    # (tau_v ≤ tau_c)
  "stirrup_dia": 8,              # mm
  "stirrup_spacing": 300.0,      # mm (minimum max)
  "stirrup_desc": "8φ @ 300 c/c",
  "pt_main": 0.95,               # % (from bending design)
  "two_leg_area": 100.5          # mm²
}


8.4 INTEGRATED DESIGN RESPONSE (JSON)
──────────────────────────────────────────────────────────────────────────────

{
  "status": "success",
  
  "design": {
    "section": {
      "width_mm": 300,
      "depth_mm": 600,
      "effective_depth_mm": 550
    },
    "concrete": {
      "grade": "M30",
      "fck_mpa": 30.0,
      "fcd_mpa": 13.4
    },
    "steel": {
      "grade": "Fe500",
      "fy_mpa": 500.0,
      "fyd_mpa": 374.0
    }
  },
  
  "loads": {
    "ultimate_moment_knm": 350.0,
    "ultimate_shear_kn": 200.0
  },
  
  "limiting_moment": {
    "mu_lim_knm": 450.235,
    "xu_lim_mm": 288.0,
    "z_lim_mm": 429.6,
    "ductile": true
  },
  
  "bending_design": {
    "type": "singly_reinforced",
    "tension_steel": {
      "required_mm2": 1850.5,
      "provided_mm2": 1920.0,
      "bars": "3-16φ",
      "percentage": 0.95
    },
    "compression_steel": null,  # Only for doubly reinforced
    "moment_capacity_knm": 350.05,
    "demand_capacity_ratio": 0.999
  },
  
  "shear_design": {
    "nominal_stress_nmm2": 1.11,
    "design_strength_nmm2": 1.58,
    "requires_stirrups": false,
    "stirrups": {
      "diameter_mm": 8,
      "spacing_mm": 300,
      "specification": "8φ @ 300 c/c"
    }
  },
  
  "rebar_layout": {
    "summary": "Bottom: 3-16φ | Top: 2-10φ (min) | Shear: 8φ @ 300 c/c",
    "bottom": "3-16φ",
    "top": "2-10φ (minimum)",
    "shear": "8φ @ 300 c/c"
  },
  
  "design_status": {
    "status": "✓ PASS",
    "design_ratio": 0.999,
    "passes": true,
    "notes":["Limiting moment: 450.23 kN·m"]
  }
}


================================================================================
9. VALIDATION AND TESTING
================================================================================

9.1 UNIT TEST CASES
──────────────────────────────────────────────────────────────────────────────

Test 1: SINGLY REINFORCED SECTION
  Input:  300×600 mm, M30, Fe500, Mu=350 kN·m
  Expected: 3-16φ bottom, 8φ @ 300 shear
  Verify: Mu_provided ≥ Mu, Design ratio ≤ 1.0

Test 2: DOUBLY REINFORCED SECTION
  Input:  300×600 mm, M30, Fe500, Mu=500 kN·m (> Mu_lim)
  Expected: Main + compression steel, design ratio ≤ 1.0

Test 3: HIGH SHEAR REQUIREMENTS
  Input:  300×600 mm, M30, Fe500, Mu=200 kN·m, Vu=350 kN
  Expected: τv > τc, stirrups required, spacing < 300 mm

Test 4: LIMITING MOMENT CALCULATION
  Input:  M30 concrete, Fe500 steel
  Expected: Mu_lim should match design manual values

Test 5: EDGE CASES
  • Mu = 0: Should give minimum steel (0.12% + distribution)
  • Vu = 0: No shear steel required
  • Under-sized section: Design ratio > 1.0 → FAIL status


9.2 COMPARISON WITH DESIGN MANUALS
──────────────────────────────────────────────────────────────────────────────

Validate against:
  • Shetty's Concrete Technology (Chapter on LSD)
  • SP 16-1980 Tables for Columns & Beams
  • Varghese's Manual on Concrete Technology
  • Design hand-calculations using IS 456:2000 directly


9.3 WORKED EXAMPLE (HAND CALCULATION)
──────────────────────────────────────────────────────────────────────────────

Design a 300×600 mm RCC beam, M30 concrete, Fe500 steel
Ultimate loads: Mu = 300 kN·m, Vu = 150 kN

STEP 1: Limiting Moment
  xu_lim = 0.48 × 550 = 264 mm
  Cc = 0.36 × 30 × 300 × 264 = 853,440 N
  z_lim = 550 - 0.42 × 264 = 389.1 mm
  Mu_lim = 853,440 × 389.1 / 1e6 = 332.1 kN·m

STEP 2: Mu < Mu_lim → Singly Reinforced
  K = 300 / (30 × 300 × 550²) = 0.00121
  Solve: 0.1512m² - 0.36m + 0.00121 = 0
  m = 0.0034 → xu = 1.87 mm (using higher root)
  z = 550 - 0.42 × 186.7 = 471.7 mm
  Ast = 300 × 1e6 / (0.87 × 500 × 471.7) = 1468 mm²
  
  Select: 3-16φ provides 1920 mm² (OK)

STEP 3: Shear Design
  τv = 150 × 1e3 / (300 × 550) = 0.91 N/mm²
  pt = 1920 / (300 × 550) × 100 = 1.164%
  τc = (0.48 + 0.5×1.164) × √(30/25) = 0.83 N/mm² (approx)
  
  τv > τc → Stirrups required
  Vu,stirrup ≈ 150 - 0.83 × 300 × 550 / 1000 = 13.8 kN
  s = 2 × π × (4²) × 0.87 × 500 × 550 / (13.8 × 1e3) = 250 mm
  
  Select: 8φ @ 150-200 c/c (more conservative)


RESULT: ✓ 3-16φ bottom | 2-10φ top | 8φ @ 150 c/c


================================================================================
10. KEY ADVANTAGES AND LIMITATIONS
================================================================================

ADVANTAGES:
  ✓ Accounts for actual failure modes (not just permissible stresses)
  ✓ Better economy (uses material strength more efficiently)
  ✓ Ductile failure (section design prevents brittle collapse)
  ✓ Partially accounts for uncertainties via γ factors
  ✓ Internationally adopted approach

LIMITATIONS:
  ✗ Requires knowledge of load combinations and factoring
  ✗ Computational complexity (vs. WSD for hand calculations)
  ✗ Design depends on accurate material property characterization
  ✗ Shear strength formula (Table 19) is empirical, may be conservative
  ✗ Does NOT account for long-term effects (creep, shrinkage)


================================================================================
11. REFERENCES AND FURTHER READING
================================================================================

1. IS 456:2000 - Code of Practice for Plain & Reinforced Concrete
   Published by: Bureau of Indian Standards (BIS)
   Full Title: "Code of Practice for Plain and Reinforced Concrete"

2. IS 875:1987 - Design Loads (other than earthquake) for Buildings and Structures

3. IS 1893:2016 - Criteria for Earthquake Resistant Design of Structures

4. Varghese, P.C. (2005). "Design of Reinforced Concrete Members"
   PHI Publishers, India

5. Shetty, M.S. (2005). "Concrete Technology: Theory and Practice"
   S. Chand & Company, India

6. SP16-1980 - Design Aids for Reinforced Concrete to IS 456

================================================================================

Document prepared for BeamLab Ultimate
Structural Analysis & RC Limit State Design
© 2026 BeamLab Development Team
"""

# This is a markdown-formatted documentation file explaining the complete
# LSD algorithm, mathematical formulations, and usage examples.
# Pair this with rc_limit_state_design.py and lsd_integration.py for
# complete implementation.
