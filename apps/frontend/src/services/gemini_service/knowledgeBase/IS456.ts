/**
 * IS 456:2016 - Code of Practice for Plain and Reinforced Concrete
 * Indian concrete design code with partial safety factors, design aids, and checks
 */

export const IS456_KNOWLEDGE = `
## IS 456:2016 (Indian Concrete Code)

### COMPREHENSIVE DESIGN KNOWLEDGE

#### Grade & Material Properties (Clause 5)
- Concrete Grade: M20, M25, M30, M35, M40, M50, M60
- fck values: 20, 25, 30, 35, 40, 50, 60 MPa (characteristic at 28 days)
- fcd = fck / 1.5 (design strength, γc = 1.5)
- Modulus: Ec = 5000√fck MPa
- Poisson's ratio: 0.15
- Coefficient of thermal expansion: 12 × 10⁻⁶/°C

#### Steel Reinforcement (Clause 5)
- Grades: Fe250 (now Fe415, Fe500, Fe500S)
- fy values: 250, 415, 500 MPa (yield)
- fyd = fy / 1.15 (design strength, γs = 1.15)
- Bond coefficient: 1.4 (high bond), 1.0 (plain bars)
- Clear cover: 20mm (beams), 30-40mm (columns), 25-40mm (slabs)

#### Design Loads (IS 875)
- Dead: Include self-weight + finishing (assumed internally)
- Live:
  - Residential: 2 kN/m²
  - Office: 2.5 kN/m²
  - Retail: 4 kN/m²
  - Industrial: 5-10 kN/m²
  - Storage: 12-24 kN/m²

#### Load Factors & Combinations (Clause 6.3)
- ULS: 1.5 × DL, 1.5 × LL
- SLS: 1.0 × DL, 1.0 × LL (for deflection checks)
- Wind/Seismic: 1.2 × (DL + LL + WL/EQ)
- Uplift: 0.9 × DL + 1.5 × WL/EQ

### BEAM DESIGN (Clause 23)

#### Moment Capacity (Clause 23.2.1)
- Mr = 0.138 × fck × b × d² (simplified)
- Detailed: Mr = Ast × fyd × (d - 0.42 × xu)
- Ast_min = 0.12% × b × d (minimum reinforcement, Fe500)
- Ast_max = 4% × b × d (maximum - practical limit)
- Limiting: xu = 0.48 × d (For Fe500, to avoid brittle failure)

#### Shear Design (Clause 23.4)
- Vud = design shear force (VT × γf)  - τv = Vud / (b × d) (shear stress)
- τc (permissible, no shear reinforcement):
  - 0.25√fck (for 0.5% steel) 
  - 0.32√fck (for 1% steel)
  - 0.37√fck (for 2% steel)
- If τv > τc: use shear reinforcement
- Asv required: (τv - τc) × b × s / (0.87 × fy)

#### Torsion Design (Clause 23.5)
- Torsional shear stress: τt = T / (1.7 × b × d²)
- If τt < √fck / 5: design as beam + min torsion steel
- If τt > √fck / 5: increase steel or cross-section
- Minimum: τtl = Asl × fy / (2s × 0.87) for longitudinal steel

#### Deflection Control (Clause 23.2.1)
- Basic span/depth ratio: l/d ≤ 20 for cantilevers, ≤ 26 for simply supported
- Modified: Multiply by 0.33 × fy / (87 + required%)  
- Maximum deflection: l/240 (total), l/360 (live + imposed), l/180 (cantilevers)
- No detailed calculation required if l/d ratio satisfied (quick check)

### SLAB DESIGN (Clause 24)

#### One-way Slabs
- Effective span: l = clear span + effective depth (max 0.5× thickness)
- Effective depth: Assume 2-4 cm for bracing
- Main steel (bottom): Similar to beam bending formula
- Distribution steel (top & sides): 0.12% of cross-section
- Minimum span/depth ratio: 30-40 (depends on support type)

#### Two-way Slabs
- Coefficients method (for square/rectangular with l/b < 2):
  - Use coefficients from Table 3, IS 456
  - mx = midspan moment coefficient (x-direction)
  - my = midspan moment coefficient (y-direction)
  - ms = support moment coefficient
  - My = mx × w × lx² (main span)
  - Mx = my × w × lx² (secondary span)
  - Ms = ms × w × lx² (support moments)
- Rebar:
  - Main steel: Calculated from moments
  - Distribution: 0.12% perpendicular to main
  - All four faces must have minimum: 0.12% of area

#### Deflection Control
- l/d ratios: 26-40 (depends on boundary conditions)
- Simplified: Pre-check l/d; perform detailed if not satisfied

### COLUMN DESIGN (Clause 25)

#### Slenderness Limits (Clause 25.1)
- Effective length: lex = β × lc
- β (effective length factor):
  - β = 0.65 (fixed-fixed)
  - β = 0.8 (fixed-pinned)
  - β = 1.0 (pinned-pinned)
  - β = 2.0 (fixed-free)
- Effective slenderness: λ = lex / b (b = least side)
- Short column: λ ≤ 12
- Long column: 12 < λ ≤ 45 (slender)

#### Capacity Reduction (Clause 25.1.1)
- Short: Pu ≤ 0.4 × fck × Ac + 0.67 × fy × Asc
- Long: Pu ≤ 0.4 × fck × Ac × (1 - 2(lex/1000+d/b)³/45) + 0.67 × fy × Asc
  - Simplified: Pu = 0.4 × fck × Ac × R (where R = reduction factor ~0.6-0.85)
- Minimum steel: 0.8% (practical), Maximum: 6% (for practical reasons, limit to 4%)

#### Eccentricity Check (Clause 25.1.3)
- e_min = greatest of:
  - 0.05b (b = width in direction of bending)
  - 500 mm / 1000 (structural code)
- uniaxial bending: Pu / (0.9 × Ac × fcd) + (Mu × (d-0.42×xu)) / (0.9 × I × fcd) ≤ 1

### FOUNDATION DESIGN (Clause 7)

#### Bearing Capacity (Clause 7.3.1 - IS 1904:2013 referenced)
- qult = 0.5 × γ × B × Nγ + c × Nc + γ × D × Nd + 0.5 × γ × B × tan(φ) × Nq
  - Simplified for concrete on soil:
  - qult ≈ cNc + γD×Nd + 0.5γB×Nγ (Terzaghi)
- Safe bearing capacity: qb = qult / 3 (For general use)
- qb values (typical):
  - Gravel: 250-500 kPa
  - Sand: 150-300 kPa 
  - Stiff clay: 100-200 kPa
  - Soft clay: 50-100 kPa

#### Footing Design (Clause 34.2 - Simple Foundations)
- One-way shear: Vud ≤ τc × b × d (at d from face of column)
- Two-way shear (punching): Vud ≤ (0.16√fck + 0.16×fy%/100) × b × d (at 0.5d from face)
- Settlement limit: Differential < 40-50mm, Absolute < 100-150mm
- Depth: Min d = 450mm (typical), consider: Df ≥ 0.6m below grade to avoid frost

### DESIGN SAFETY CHECKS (Clause 6)

#### Partial Safety Factors (PSF)
- γc = 1.5 (concrete)
- γs = 1.15 (steel)
- γf = 1.5 (dead loads), 1.5 (live loads)  Equivalent factored loads: 1.5×DL + 1.5×LL

#### Code Compliance Essentials
1. Always check minimum reinforcement (0.12% slabs, 0.8% columns)
2. Bond length: Ld = (φ × fy) / (1.4 × τbd × [1 + (1 - 2 × Clear/φ)])
3. Spacing: Main ≤ 3d or 300mm (whichever is less)
4. Cover: 20-50mm depending on exposure (see Table 1)
5. Detailing: No splices in negative bending, minimum lap = 40 × dia
`;
