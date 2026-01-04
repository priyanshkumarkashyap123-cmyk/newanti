# Comprehensive Structural Engineering Knowledge Base
## For BeamLab Ultimate - Indian Standard Codes Reference

> **Purpose**: This document serves as a comprehensive reference for implementing structural engineering calculations in the BeamLab platform, following Indian Standard Codes.

---

## Table of Contents

1. [Strength of Materials - Fundamentals](#1-strength-of-materials---fundamentals)
2. [Indian Standard Codes Overview](#2-indian-standard-codes-overview)
3. [RCC Design (IS 456:2000)](#3-rcc-design-is-4562000)
4. [Steel Design (IS 800:2007)](#4-steel-design-is-8002007)
5. [Prestressed Concrete (IS 1343:2012)](#5-prestressed-concrete-is-13432012)
6. [Load Calculations (IS 875)](#6-load-calculations-is-875)
7. [Seismic Design (IS 1893:2016)](#7-seismic-design-is-18932016)
8. [Ductile Detailing (IS 13920:2016)](#8-ductile-detailing-is-139202016)
9. [Design Aids (SP 16 & SP 34)](#9-design-aids-sp-16--sp-34)
10. [Section Properties Formulas](#10-section-properties-formulas)

---

## 1. Strength of Materials - Fundamentals

### 1.1 Stress and Strain Basics

| Concept | Formula | Units | Description |
|---------|---------|-------|-------------|
| **Normal Stress (σ)** | σ = P / A | N/mm² (MPa) | Force per unit area |
| **Shear Stress (τ)** | τ = V / A | N/mm² (MPa) | Tangential force per unit area |
| **Axial Strain (ε)** | ε = ΔL / L | Dimensionless | Change in length / original length |
| **Shear Strain (γ)** | γ = tan(θ) ≈ θ | Radians | Angular distortion |

### 1.2 Hooke's Law & Elastic Constants

```
σ = E × ε                    # Hooke's Law
τ = G × γ                    # Shear stress-strain relationship

E = σ / ε                    # Young's Modulus (Modulus of Elasticity)
G = τ / γ                    # Modulus of Rigidity (Shear Modulus)
ν = -ε_lateral / ε_axial     # Poisson's Ratio

# Relationship between elastic constants:
E = 2G(1 + ν)
E = 3K(1 - 2ν)               # K = Bulk Modulus
G = E / (2(1 + ν))
```

### 1.3 Material Properties (Typical Values)

| Material | E (GPa) | G (GPa) | ν | fy (MPa) | fu (MPa) |
|----------|---------|---------|---|----------|----------|
| **Structural Steel (Fe 250)** | 200 | 77 | 0.30 | 250 | 410 |
| **Steel (Fe 415)** | 200 | 77 | 0.30 | 415 | - |
| **Steel (Fe 500)** | 200 | 77 | 0.30 | 500 | - |
| **Concrete M20** | 22.4 | - | 0.15-0.20 | - | 20 (fck) |
| **Concrete M25** | 25 | - | 0.15-0.20 | - | 25 (fck) |
| **Concrete M30** | 27.4 | - | 0.15-0.20 | - | 30 (fck) |
| **Concrete M40** | 31.6 | - | 0.15-0.20 | - | 40 (fck) |

### 1.4 Stress-Strain Curve Key Points

```
1. Proportional Limit     - Up to this, σ ∝ ε (Hooke's Law valid)
2. Elastic Limit          - Maximum stress with complete recovery
3. Yield Point (fy)       - Onset of plastic deformation
4. Ultimate Tensile Strength (fu) - Maximum stress before failure
5. Fracture Point         - Material breaks
```

### 1.5 Beam Theory - Bending

```
# Bending Stress (Flexure Formula)
σ_b = (M × y) / I

Where:
  M = Bending moment (N·mm)
  y = Distance from neutral axis (mm)
  I = Moment of inertia (mm⁴)

# Maximum Bending Stress
σ_max = M / Z        # Z = Section Modulus = I / y_max

# Shear Stress in Beams
τ = (V × Q) / (I × b)

Where:
  V = Shear force (N)
  Q = First moment of area above the point (mm³)
  I = Moment of inertia (mm⁴)
  b = Width at the point (mm)
```

### 1.6 Deflection Formulas (Common Cases)

| Beam Type | Loading | Maximum Deflection |
|-----------|---------|-------------------|
| **Simply Supported** | Central Point Load P | δ = PL³ / 48EI |
| **Simply Supported** | UDL w | δ = 5wL⁴ / 384EI |
| **Cantilever** | End Point Load P | δ = PL³ / 3EI |
| **Cantilever** | UDL w | δ = wL⁴ / 8EI |
| **Fixed-Fixed** | Central Point Load P | δ = PL³ / 192EI |
| **Fixed-Fixed** | UDL w | δ = wL⁴ / 384EI |

---

## 2. Indian Standard Codes Overview

### 2.1 Primary Design Codes

| Code | Title | Purpose |
|------|-------|---------|
| **IS 456:2000** | Plain and Reinforced Concrete | RCC design (Limit State & Working Stress) |
| **IS 800:2007** | Steel Structures | Steel design (Limit State Method) |
| **IS 1343:2012** | Prestressed Concrete | Prestressed concrete design |
| **IS 875 (Parts 1-5)** | Design Loads | Dead, Live, Wind, Snow, Load Combinations |
| **IS 1893:2016** | Earthquake Resistant Design | Seismic design criteria |
| **IS 13920:2016** | Ductile Detailing | Earthquake-resistant RCC detailing |

### 2.2 Design Aids & Handbooks

| Code | Title | Purpose |
|------|-------|---------|
| **SP 16:1980** | Design Aids for RC | Charts & tables for RCC design |
| **SP 34:1987** | Handbook on Reinforcement Detailing | Bar bending schedules, detailing |
| **SP 6(1):1964** | ISI Handbook for Steel Designers | Steel section properties |

### 2.3 Load Codes (IS 875 Series)

| Part | Content |
|------|---------|
| **Part 1** | Dead loads - Unit weights of materials |
| **Part 2** | Imposed (Live) loads |
| **Part 3** | Wind loads |
| **Part 4** | Snow loads |
| **Part 5** | Load combinations |

---

## 3. RCC Design (IS 456:2000)

### 3.1 Design Philosophy

IS 456:2000 recommends the **Limit State Method (LSM)** for design:

```
# Partial Safety Factors
γ_f = 1.5    # For Dead Load (DL)
γ_f = 1.5    # For Live Load (LL)
γ_m = 1.5    # For Concrete
γ_m = 1.15   # For Steel

# Design Strength
f_cd = 0.67 × fck / γ_m = 0.446 × fck    # Concrete
f_yd = fy / γ_m = 0.87 × fy               # Steel

# Load Combinations (Limit State)
1.5 × (DL + LL)
1.5 × (DL + QL)               # QL = Earthquake load
1.2 × (DL + LL + QL)
0.9 × DL + 1.5 × QL
```

### 3.2 Beam Design - Flexure

#### 3.2.1 Singly Reinforced Beam

```
# Limiting Neutral Axis Depth (xu,lim / d)
Fe 250: xu,lim/d = 0.53
Fe 415: xu,lim/d = 0.48
Fe 500: xu,lim/d = 0.46

# Moment of Resistance (Under-reinforced)
Mu = 0.36 × fck × b × xu × (d - 0.42xu)

# Limiting Moment of Resistance
Mu,lim = 0.36 × fck × b × xu,lim × (d - 0.42 × xu,lim)

# Alternative Formula for Mu,lim
Mu,lim = K × fck × b × d²

Where K values:
  Fe 250: K = 0.149
  Fe 415: K = 0.138
  Fe 500: K = 0.133

# Area of Steel
Ast = (0.5 × fck / fy) × [1 - √(1 - 4.6 × Mu / (fck × b × d²))] × b × d
```

#### 3.2.2 Doubly Reinforced Beam

```
# When Mu > Mu,lim
Mu2 = Mu - Mu,lim

# Compression Steel
Asc = Mu2 / [(fsc - 0.446 × fck) × (d - d')]

# Additional Tension Steel
Ast2 = Mu2 / (0.87 × fy × (d - d'))

# Total Tension Steel
Ast = Ast1 + Ast2

Where:
  fsc = Stress in compression steel (from strain compatibility)
  d' = Effective cover to compression steel
```

#### 3.2.3 Minimum & Maximum Reinforcement

```
# Minimum Tension Steel (Clause 26.5.1.1)
Ast,min = (0.85 × b × d) / fy

# Maximum Tension Steel
Ast,max = 0.04 × b × D

# Minimum Shear Reinforcement
Asv,min = (0.4 × b × sv) / (0.87 × fy)
```

### 3.3 Beam Design - Shear

```
# Nominal Shear Stress
τv = Vu / (b × d)

# Design Shear Strength of Concrete (τc) - From Table 19, IS 456
# Depends on percentage of tension steel (pt) and fck

# Maximum Shear Stress (τc,max) - From Table 20, IS 456
M15: τc,max = 2.5 N/mm²
M20: τc,max = 2.8 N/mm²
M25: τc,max = 3.1 N/mm²
M30: τc,max = 3.5 N/mm²
M35: τc,max = 3.7 N/mm²
M40: τc,max = 4.0 N/mm²

# Shear Reinforcement Required When τv > τc
Vus = Vu - τc × b × d

# Vertical Stirrup Spacing
sv = (0.87 × fy × Asv × d) / Vus

# Maximum Stirrup Spacing
sv,max = min(0.75 × d, 300 mm)
```

### 3.4 Column Design

#### 3.4.1 Short Column - Axial Load

```
# Minimum Eccentricity
e_min = max(L/500 + D/30, 20 mm)

# Axially Loaded Short Column (when e ≤ 0.05D)
Pu = 0.4 × fck × Ac + 0.67 × fy × Asc

Where:
  Ac = Area of concrete = Ag - Asc
  Ag = Gross cross-sectional area
  Asc = Area of longitudinal steel

# As percentage:
Pu = 0.4 × fck × Ag + (0.67 × fy - 0.4 × fck) × Asc
```

#### 3.4.2 Column Slenderness

```
# Effective Length (from Table 28, IS 456)
Le = k × L

Common k values:
  Both ends fixed: k = 0.65
  One end fixed, one end hinged: k = 0.80
  Both ends hinged: k = 1.00
  One end fixed, one end free: k = 2.00

# Slenderness Ratio
λ = Le / r   or   λ = Le / D (for rectangular)

# Short Column: Le/D ≤ 12 (braced) or Le/D ≤ 12 (unbraced)
# Long (Slender) Column: Le/D > 12
```

#### 3.4.3 Column Reinforcement Limits

```
# Longitudinal Steel
Minimum: 0.8% of Ag
Maximum: 6% of Ag (4% at laps)

# Minimum Number of Bars
Rectangular column: 4 bars
Circular column: 6 bars

# Transverse Reinforcement (Ties)
Diameter: ≥ 1/4 of largest longitudinal bar, ≥ 6 mm
Pitch: ≤ min(least lateral dimension, 16 × smallest longitudinal bar dia, 300 mm)
```

### 3.5 Slab Design

#### 3.5.1 One-Way Slab (Ly/Lx ≥ 2)

```
# Effective Span
Le = min(c/c distance between supports, clear span + d)

# Bending Moment Coefficients (Table 12, IS 456)
For continuous slabs with:
DL = αd × w × L²
LL = αl × w × L²

# Main Steel
Ast = (Mu) / (0.87 × fy × (d - 0.42 × xu))

# Distribution Steel
Ast,dist = 0.12% × b × D (for Fe 415)
Ast,dist = 0.15% × b × D (for Fe 250)

# Minimum Main Steel
Ast,min = 0.12% × b × D (for Fe 415)
```

#### 3.5.2 Two-Way Slab (Ly/Lx < 2)

```
# Bending Moments (Table 26, IS 456)
Mx = αx × w × Lx²    # Short span moment
My = αy × w × Lx²    # Long span moment

Where:
  αx, αy = Moment coefficients from Table 26 or 27
  w = Total factored load (kN/m²)
  Lx = Shorter span

# Steel Area
Ast,x = Mx / (0.87 × fy × (d - 0.42 × xu))
Ast,y = My / (0.87 × fy × (d - 0.42 × xu))
```

### 3.6 Footing Design

#### 3.6.1 Isolated Footing

```
# Area of Footing
A_req = (P + Self weight) / q_safe

Where:
  P = Column load (service)
  q_safe = Safe bearing capacity of soil

# Net Upward Pressure (Factored)
q_u = Pu / A_provided

# One-Way Shear Check (at d from column face)
τv = Vu / (b × d) ≤ τc

# Two-Way (Punching) Shear Check (at d/2 from column face)
τv = Vu / (perimeter × d) ≤ ks × τc

Where:
  ks = 0.5 + βc ≤ 1.0
  βc = Short side / Long side of column
  τc = 0.25 × √fck

# Bending Moment (at face of column)
Mu = q_u × B × (L - a)² / 2  # For one direction

# Minimum Thickness at Edge: 150 mm (on soil)
```

### 3.7 Deflection Control

```
# Deflection Limits (Clause 23.2)
Final deflection: ≤ Span/250
Deflection after finishes: ≤ Span/350 or 20 mm (whichever is less)

# Basic Span/Depth Ratios (for spans up to 10 m)
Cantilever: 7
Simply Supported: 20
Continuous: 26

# Modification Factors
Kt = Based on tension steel ratio (Figure 4, IS 456)
Kc = Based on compression steel ratio (Figure 5, IS 456)

# Modified Span/Depth Ratio
(L/d)_allowable = Basic ratio × Kt × Kc
```

---

## 4. Steel Design (IS 800:2007)

### 4.1 Design Philosophy

IS 800:2007 follows the **Limit State Method (LSM)**:

```
# Partial Safety Factors
γ_m0 = 1.10   # For yielding and buckling
γ_m1 = 1.25   # For ultimate stress
γ_mw = 1.25   # For shop welds
γ_mw = 1.50   # For site welds
γ_mb = 1.25   # For bolts (bearing type)
γ_mf = 1.10   # For friction bolts (service load)

# Material Properties
E = 2 × 10⁵ N/mm²
G = 0.769 × 10⁵ N/mm²
ν = 0.3
ρ = 7850 kg/m³
α = 12 × 10⁻⁶ /°C
```

### 4.2 Tension Member Design

```
# Design Strength in Tension
Td = min(Tdg, Tdn, Tdb)

# Yielding of Gross Section
Tdg = fy × Ag / γ_m0

# Rupture of Net Section
Tdn = 0.9 × fu × An / γ_m1

# Block Shear Failure
Tdb = (Avg × fy / (√3 × γ_m0)) + (0.9 × Atn × fu / γ_m1)
or
Tdb = (0.9 × Avn × fu / (√3 × γ_m1)) + (Atg × fy / γ_m0)

Take smaller value.

# Slenderness Ratio Limits
Main tension member: λ ≤ 400
Secondary member: λ ≤ 350
```

### 4.3 Compression Member Design

```
# Design Compressive Strength
Pd = Ae × fcd

# Design Compressive Stress
fcd = (fy / γ_m0) / [φ + √(φ² - λ²)]

φ = 0.5 × [1 + α(λ - 0.2) + λ²]

# Non-dimensional Slenderness Ratio
λ = √(fy / fcr) = (Le/r) / π × √(fy/E)

# Euler's Critical Stress
fcr = π² × E / (Le/r)²

# Imperfection Factor (α) - Based on Buckling Class
Class a: α = 0.21
Class b: α = 0.34
Class c: α = 0.49
Class d: α = 0.76

# Slenderness Ratio Limits
Main compression member: λ ≤ 180
Secondary member: λ ≤ 250
```

### 4.4 Bending Member Design

```
# Design Bending Strength
Md = βb × Zp × fy / γ_m0       # For plastic sections

Where:
  βb = 1.0 for plastic and compact sections
  Zp = Plastic section modulus

# Laterally Unsupported Beams
Md = βb × Zp × fbd

fbd = χLT × fy / γ_m0

# Lateral Torsional Buckling
χLT = 1 / [φLT + √(φLT² - λLT²)] ≤ 1.0

φLT = 0.5 × [1 + αLT(λLT - 0.2) + λLT²]

λLT = √(βb × Zp × fy / Mcr)

# Shear Strength
Vd = fy × Av / (√3 × γ_m0)

Where:
  Av = Shear area = D × tw (for I-sections with shear along web)
```

### 4.5 Bolted Connections

```
# Design Shear Strength of Bolt
Vdsb = Vnsb / γ_mb

Vnsb = (fu_b / √3) × (nn × An + ns × As)

Where:
  fu_b = Ultimate tensile strength of bolt
  nn = Number of shear planes in threads
  ns = Number of shear planes in shank
  An = Net tensile stress area (≈ 0.78 × As)
  As = Shank area = π × d² / 4

# Design Bearing Strength
Vdpb = Vnpb / γ_mb

Vnpb = 2.5 × kb × d × t × fu

kb = min(e/(3×d₀), p/(3×d₀) - 0.25, fu_b/fu, 1.0)

# Design Tensile Strength
Tdb = Tnb / γ_mb

Tnb = 0.9 × fu_b × An

# Combined Shear and Tension (Interaction)
(Vsb/Vdsb)² + (Tb/Tdb)² ≤ 1.0

# Minimum Spacing: 2.5 × d
# Minimum Edge Distance: 1.5 × d₀ (Table 22, IS 800)
# Maximum Edge Distance: 12 × t × √(250/fy)
```

### 4.6 Welded Connections

```
# Fillet Weld - Design Strength
fwd = fu / (√3 × γ_mw)

# Effective Throat Thickness
te = K × s       # s = size of weld

K values (based on included angle):
  60° - 90°: K = 0.70
  91° - 100°: K = 0.65
  101° - 106°: K = 0.60
  107° - 113°: K = 0.55
  114° - 120°: K = 0.50

# Strength Per Unit Length
Pw = te × fwd = 0.7 × s × fu / (√3 × γ_mw)

# Minimum Weld Size (Table 21, IS 800)
t ≤ 10 mm: s_min = 3 mm
10 < t ≤ 20 mm: s_min = 5 mm
20 < t ≤ 32 mm: s_min = 6 mm
t > 32 mm: s_min = First run 8 mm

# Maximum Weld Size
At edge: s_max = t - 1.5 mm (for t > 6 mm)
         s_max = t (for t ≤ 6 mm)
```

---

## 5. Prestressed Concrete (IS 1343:2012)

### 5.1 Material Requirements

```
# Minimum Concrete Grade
Pre-tensioned: M40 minimum
Post-tensioned: M30 minimum

# Prestressing Steel Types
- High tensile steel wires
- High tensile steel strands (7-wire strands)
- High tensile steel bars

# Typical Properties
fu = 1860 MPa (for low relaxation strands)
fp = 0.7 × fu (initial prestress ≈ 1300 MPa)
Ep = 195,000 MPa (Modulus of elasticity)
```

### 5.2 Loss of Prestress

```
# 1. Elastic Shortening (Pre-tensioned)
Δfp_ES = (Ep / Ec) × fci

Where:
  fci = Concrete stress at CG of tendons at transfer

# 2. Friction Loss (Post-tensioned)
Px = P₀ × e^-(μα + kx)

Where:
  P₀ = Initial prestressing force at jacking end
  μ = Coefficient of friction (0.25 - 0.55)
  α = Cumulative angle change (radians)
  k = Wobble coefficient (0.0015 - 0.0050 /m)
  x = Distance from jacking end

# 3. Anchorage Slip
Δfp_slip = (Δ × Ep) / L

Where:
  Δ = Slip at anchorage (typically 2-6 mm)
  L = Length of tendon

# 4. Shrinkage Loss
Δfp_sh = Ep × εsh

Pre-tensioned: εsh = 300 × 10⁻⁶
Post-tensioned: εsh = 200 × 10⁻⁶ / log₁₀(t + 2)

# 5. Creep Loss
Δfp_cr = Ep × φ × (fci / Ec)

Where:
  φ = Creep coefficient (1.5 - 3.0 depending on age at loading)

# 6. Relaxation of Steel
Depends on steel type and initial stress level
Low relaxation strands: 2.5% - 5% of initial stress
```

### 5.3 Stress Limits

```
# At Transfer (Clause 22.1)
Compression: 0.54 × fci
Tension: 0.45√fci (no cracking allowed typically)

# At Service (Clause 22.3)
Compression: 0.41 × fck to 0.48 × fck
Tension: 0 (fully prestressed) or limited values

# Crack Width Limits
Moderate/Mild environment: 0.2 mm
Severe environment: 0.1 mm
```

### 5.4 Flexural Design

```
# Prestress at Section
P/A ± P×e×y/I ± M×y/I

# Combined Stress Formula
σ = (P/A) × (1 ± e×y/r²) ± (M×y/I)

Where:
  r² = I/A (radius of gyration squared)
  e = Eccentricity of prestressing force
  M = Applied moment

# Ultimate Moment Capacity
Mu = Aps × fps × (dp - a/2)

Where:
  Aps = Area of prestressing steel
  fps = Stress in prestressing steel at ultimate
  dp = Effective depth to prestressing steel
  a = Depth of stress block
```

---

## 6. Load Calculations (IS 875)

### 6.1 Dead Load (Part 1)

```
# Unit Weights (kN/m³)
Plain Concrete: 24
Reinforced Concrete: 25
Steel: 78.5
Brick Masonry: 19-20
Timber (teak): 6.5
Glass: 25.5

# Floor Finishes
Cement mortar: 20 kN/m³
Flooring tiles: 0.8-1.0 kN/m² (25mm thick)
Terrazzo: 0.5 kN/m² (25mm thick)

# Partition Load (Movable)
Generally: 1.0 - 1.5 kN/m² on floor area
```

### 6.2 Live Load (Part 2)

```
# Minimum Imposed Loads on Floors (kN/m²)
Residential: 2.0
Office: 2.5 - 4.0
Schools, Hospitals: 3.0
Assembly halls (fixed seats): 4.0
Assembly halls (no fixed seats): 5.0
Stores, warehouses: 5.0 - 10.0
Libraries (stack rooms): 6.0 - 10.0
Factories (light): 3.5
Factories (heavy): 5.0 - 10.0
Garages (light vehicles): 4.0

# Roof Live Loads
Accessible: 1.5 - 3.0 kN/m²
Non-accessible: 0.75 kN/m² (maintenance)
```

### 6.3 Wind Load (Part 3)

```
# Design Wind Speed
Vz = Vb × k₁ × k₂ × k₃ × k₄

Where:
  Vb = Basic wind speed (from wind zone map)
  k₁ = Risk coefficient
  k₂ = Terrain and height factor
  k₃ = Topography factor
  k₄ = Importance factor for cyclonic region

# Design Wind Pressure
pz = 0.6 × Vz²

# Wind Force on Structure
F = Cf × Ae × pz

Where:
  Cf = Force coefficient
  Ae = Effective frontal area

# Basic Wind Speed Zones (India)
Zone 1: 33 m/s
Zone 2: 39 m/s
Zone 3: 44 m/s
Zone 4: 47 m/s
Zone 5: 50 m/s
Zone 6: 55 m/s
```

### 6.4 Load Combinations (Part 5)

```
# Limit State of Strength
1.5 (DL + LL)
1.5 (DL + WL)
1.2 (DL + LL + WL)
1.5 (DL + EL)
1.2 (DL + LL + EL)
0.9 DL + 1.5 WL
0.9 DL + 1.5 EL

# Limit State of Serviceability
1.0 (DL + LL)
1.0 (DL + WL)
1.0 (DL + EL)
1.0 (DL + 0.8 LL + 0.8 WL)
```

---

## 7. Seismic Design (IS 1893:2016)

### 7.1 Seismic Zones

| Zone | Z Factor | Description |
|------|----------|-------------|
| II | 0.10 | Low seismic hazard |
| III | 0.16 | Moderate seismic hazard |
| IV | 0.24 | Severe seismic hazard |
| V | 0.36 | Very severe seismic hazard |

### 7.2 Design Seismic Force

```
# Design Horizontal Seismic Coefficient
Ah = (Z × I × Sa/g) / (2 × R)

Where:
  Z = Zone factor
  I = Importance factor
  R = Response reduction factor
  Sa/g = Spectral acceleration coefficient

# Importance Factor (I)
Critical facilities: 1.5
Schools, hospitals: 1.5
Residential, commercial: 1.0

# Response Reduction Factor (R)
OMRF (RCC): 3.0
SMRF (RCC): 5.0
Steel OMRF: 3.0
Steel SMRF: 5.0
```

### 7.3 Base Shear

```
# Design Base Shear
Vb = Ah × W

Where:
  W = Seismic weight of building

# Distribution of Base Shear
Qi = Vb × (Wi × hi²) / Σ(Wj × hj²)

Where:
  Qi = Lateral force at floor i
  Wi = Seismic weight of floor i
  hi = Height of floor i from base
```

### 7.4 Natural Period

```
# Approximate Fundamental Period
RC Frame: Ta = 0.075 × h^0.75
Steel Frame: Ta = 0.085 × h^0.75
RC Frame with Shear Walls: Ta = 0.075 × h^0.75 / √Aw
Other Buildings: Ta = 0.09 × h / √d

Where:
  h = Height of building (m)
  Aw = Effective area of shear walls
  d = Base dimension in direction of EQ
```

### 7.5 Response Spectrum

```
# For 5% Damping (Rock/Hard Soil)
Sa/g = 1 + 15T           (0 ≤ T ≤ 0.10)
Sa/g = 2.50              (0.10 < T ≤ 0.40)
Sa/g = 1.00/T            (0.40 < T ≤ 4.00)

# For Medium Soil
Sa/g = 1 + 15T           (0 ≤ T ≤ 0.10)
Sa/g = 2.50              (0.10 < T ≤ 0.55)
Sa/g = 1.36/T            (0.55 < T ≤ 4.00)

# For Soft Soil
Sa/g = 1 + 15T           (0 ≤ T ≤ 0.10)
Sa/g = 2.50              (0.10 < T ≤ 0.67)
Sa/g = 1.67/T            (0.67 < T ≤ 4.00)
```

---

## 8. Ductile Detailing (IS 13920:2016)

### 8.1 Applicability

- Mandatory for all RC structures in seismic zones III, IV, and V
- Recommended for zone II for important structures

### 8.2 Beam Requirements

```
# Dimensional Requirements
Width ≥ 200 mm
Depth ≤ span/4
Width/Depth ≥ 0.3

# Longitudinal Reinforcement
Minimum at any face: 2 bars of 12 mm φ
At joint: Positive steel ≥ 0.5 × Negative steel
Continuous through length: ≥ 0.25 × Maximum negative steel

# Transverse Reinforcement (Stirrups)
Minimum diameter: 8 mm
Shape: Closed loops with 135° hooks
At ends (over 2d length):
  Spacing ≤ min(d/4, 8×smallest bar dia, 100 mm)
First stirrup: Within 50 mm from joint face

# Lap Splices
Not within joints
Not within 2d from joint face
Not more than 50% bars spliced at one section
```

### 8.3 Column Requirements

```
# Dimensional Requirements
Shortest dimension ≥ 300 mm (if unsupported length > 4m)
Short side/Long side ≥ 0.4

# Longitudinal Reinforcement
Minimum: 0.8% of Ag
Maximum: 4% of Ag
Circular columns: Minimum 6 bars

# Transverse Reinforcement
Minimum diameter: 8 mm
Shape: Closed hoops with 135° hooks

# Special Confining Reinforcement
Required over length: max(D, clear span/6, 450 mm) from joint face
Hoop spacing: ≤ min(75 mm, B/4)
Area of cross ties:
  Ash = 0.18 × s × hc × (fck/fy) × [(Ag/Ac) - 1]

# Lap Splices
Only in central half of member length
Special confining reinforcement over full lap length
```

### 8.4 Beam-Column Joint

```
# Strong Column - Weak Beam
ΣMc ≥ 1.4 × ΣMb

Where:
  ΣMc = Sum of moment capacities of columns
  ΣMb = Sum of moment capacities of beams

# Joint Shear Check
Shear force in joint:
  Vj = T₁ + C₂ - Vcol

# Confining Reinforcement
Required if beams do not frame into all four sides
Spacing ≤ 150 mm
```

---

## 9. Design Aids (SP 16 & SP 34)

### 9.1 SP 16:1980 - Key Charts & Tables

```
# Flexural Design Charts
- Charts for Mu/(bd²) vs pt for singly reinforced sections
- Charts for doubly reinforced sections
- Interaction diagrams for columns

# Shear Design Tables
- Table of τc vs pt for different fck values

# Development Length Tables
- Ld values for different bar sizes, grades of steel and concrete
```

### 9.2 Development Length (Clause 26.2.1, IS 456)

```
# Basic Development Length
Ld = (φ × σs) / (4 × τbd)

# Design Bond Stress (τbd) - Table 26, IS 456
M15: 1.0 N/mm² (plain bars), 1.6 N/mm² (deformed bars)
M20: 1.2 N/mm², 1.92 N/mm²
M25: 1.4 N/mm², 2.24 N/mm²
M30: 1.5 N/mm², 2.40 N/mm²
M35: 1.7 N/mm², 2.72 N/mm²
M40: 1.9 N/mm², 3.04 N/mm²

# For HYSD Bars in Tension
Ld = (0.87 × fy × φ) / (4 × τbd)

# Anchorage Value of Hooks
Standard 90° bend = 8φ
Standard U-hook = 16φ
```

### 9.3 SP 34:1987 - Detailing Rules

```
# Clear Cover Requirements
Footings in direct contact with soil: 75 mm
Columns, beams exposed to weather: 45 mm
Beams, slabs (sheltered): 25-30 mm
Slabs (protected): 20 mm

# Minimum Clear Spacing Between Bars
Horizontal: max(φ, aggregate size + 5 mm)
Vertical (in layers): 15 mm or 2/3 aggregate size

# Bar Bending Dimensions
Standard hook radius: 4φ minimum (plain bars), 4φ (deformed bars)
Minimum bend radius: 2φ (stirrups), 4φ (main bars)
```

---

## 10. Section Properties Formulas

### 10.1 Moment of Inertia (Second Moment of Area)

```
# Rectangle (about centroidal axis)
Ix = bh³/12
Iy = hb³/12

# Circle
I = πD⁴/64

# Hollow Circle (Tube)
I = π(D⁴ - d⁴)/64

# Triangle (about base)
Ix = bh³/12

# Triangle (about centroidal axis)
Ix = bh³/36

# Parallel Axis Theorem
I = I₀ + A × d²

Where:
  I₀ = Moment of inertia about centroidal axis
  A = Cross-sectional area
  d = Distance between axes
```

### 10.2 Section Modulus

```
# Elastic Section Modulus
Ze = I / y_max

# Rectangle
Zx = bh²/6
Zy = hb²/6

# Circle
Z = πD³/32

# Hollow Circle
Z = π(D⁴ - d⁴)/(32D)

# Plastic Section Modulus (for steel)
Zp = A × y̅

For rectangle: Zp = bh²/4 (shape factor = 1.5)
For circle: Zp = D³/6 (shape factor = 1.7)
```

### 10.3 Radius of Gyration

```
r = √(I/A)

# Rectangle
rx = h/(√12) = 0.289h
ry = b/(√12) = 0.289b

# Circle
r = D/4

# Hollow Circle
r = √((D² + d²)/16)
```

### 10.4 Composite Section Properties

```
# For I-Section (built-up)
1. Find centroid: ȳ = Σ(Ai × yi) / ΣAi
2. Find I for each component about centroidal axis
3. Apply parallel axis theorem
4. Sum all contributions: I_total = Σ(Ii + Ai × di²)
```

---

## Quick Reference Tables

### Concrete Grades & Properties

| Grade | fck (MPa) | Ec (GPa) | Design Stress 0.446fck |
|-------|-----------|----------|------------------------|
| M15 | 15 | 19.4 | 6.69 |
| M20 | 20 | 22.4 | 8.92 |
| M25 | 25 | 25.0 | 11.15 |
| M30 | 30 | 27.4 | 13.38 |
| M35 | 35 | 29.6 | 15.61 |
| M40 | 40 | 31.6 | 17.84 |
| M45 | 45 | 33.5 | 20.07 |
| M50 | 50 | 35.4 | 22.30 |

### Steel Grades & Design Values

| Grade | fy (MPa) | 0.87fy (MPa) | Typical Use |
|-------|----------|--------------|-------------|
| Fe 250 | 250 | 217.5 | Mild steel bars |
| Fe 415 | 415 | 361.05 | HYSD bars (common) |
| Fe 500 | 500 | 435.0 | HYSD bars |
| Fe 550 | 550 | 478.5 | High strength bars |

### Common Bar Areas

| Dia (mm) | Area (mm²) | Weight (kg/m) |
|----------|------------|---------------|
| 6 | 28.27 | 0.222 |
| 8 | 50.27 | 0.395 |
| 10 | 78.54 | 0.617 |
| 12 | 113.10 | 0.888 |
| 16 | 201.06 | 1.578 |
| 20 | 314.16 | 2.466 |
| 25 | 490.87 | 3.853 |
| 28 | 615.75 | 4.834 |
| 32 | 804.25 | 6.313 |

---

## Implementation Notes for BeamLab

### Calculator Modules to Implement

1. **Beam Calculator**
   - Simply supported, fixed, continuous beams
   - SF/BM diagram generation
   - Deflection calculation
   - RCC beam design (IS 456)
   - Steel beam design (IS 800)

2. **Column Calculator**
   - Axially loaded columns
   - Columns with uniaxial/biaxial bending
   - Slenderness checks
   - Interaction diagram usage

3. **Slab Calculator**
   - One-way slab design
   - Two-way slab design
   - Flat slab design
   - Deflection checks

4. **Footing Calculator**
   - Isolated footings
   - Combined footings
   - Strap footings
   - Pile capacity

5. **Connection Calculator**
   - Bolted connections
   - Welded connections
   - Base plate design
   - Splice design

6. **Seismic Calculator**
   - Base shear calculation
   - Storey forces distribution
   - Drift checks
   - P-Delta effects

7. **Load Calculator**
   - Dead load estimation
   - Live load selection
   - Wind load calculation
   - Seismic weight calculation

---

*Document Version: 1.0*
*Last Updated: January 2026*
*Reference Codes: IS 456:2000, IS 800:2007, IS 1343:2012, IS 875:1987, IS 1893:2016, IS 13920:2016*
