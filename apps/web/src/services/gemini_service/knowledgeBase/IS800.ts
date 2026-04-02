/**
 * IS 800:2007 - Code of Practice for General Construction in Steel
 * Indian steel design code with partial safety factors and design aids
 */

export const IS800_KNOWLEDGE = `
## IS 800:2007 (Indian Steel Code)

### COMPREHENSIVE DESIGN KNOWLEDGE

#### Grade & Material Properties (Clause 5)
- Common Grades: Fe250, Fe410, Fe500, Fe550 (now Fe410/Fe500 are standard)
- fy values: 250, 410, 500, 550 MPa (yield stress)
- fyd = fy / γm0 = fy / 1.1 (design yield strength for Class 1/2)
- fu values: 410, 490, 575, 600 MPa (ultimate tensile stress)
- Modulus: E = 200,000 MPa
- Poisson's ratio: 0.30
- Shear modulus: G = 77,000 MPa
- Section classes: 1 (fully plastic), 2 (compact), 3 (semi-compact), 4 (slender)

#### Design Safety Factors (Clause 5.1.2)
- γm0 = 1.10 (for yielding check)
- γm1 = 1.25 (for rupture check)
- γm2 = 1.50 (for pins, bolt holes, etc.)
- Load factor = 1.5 for dead + live loads

#### Section Types & Properties
- I-sections: ISMB, ISWB (Beams), ISMC (Columns), ISLB (Light)
- Channels: ISSC, CSS (with lips)
- Angles: ISA (standard)
- Hollow: CHS (circular), RHS (rectangular), SHS (square)
- Plates & Flats: Standard thickness & widths

### BEAM DESIGN (Clause 8)

#### Bending capacity (Clause 8.2.1.1)
- For Class 1 & 2: Md = βb × Mpd where Mpd = Zp × fy/γm0
  - Zp = Plastic section modulus (use tables)
  - βb = 1.0 (no reduction if no lateral buckling)
- For Class 3: Md = Ze × fy / γm0 (elastic section modulus)
- For Class 4: Must first reduce area due to local buckling

#### Lateral Torsional Buckling (Clause 8.4.1)  
- Check if moment capacity reduces due to buckling
- Critical moment: Mcr = (π/L) × √(E×Iw×GIt) (complicated formula - use tables)
- Slenderness: λLT = √(β1×Md×γm0 / Mcr)
- If λLT > λLT,0: Design capacity = non-dimensional parameter × fy × Ze/γm0
- Simplified: Use buckling curves (Table 11, IS 800) based on L/ry ratio
  - If L/ry < 40: Lateral buckling not critical
  - If L/ry > 300: Severe reduction (likely redesign)

#### Shear Capacity (Clause 8.3)
- Vd = (fu × Av) / (√3 × γm0)
  - Av = d × tw (core area, ignoring flange)
  - d = overall depth, tw = web thickness
- For ISMB: Vd ≈ 0.6 × fy × d × tw (simplified)
- Typically checked simultaneously with shear + bending interaction

#### Web Crippling Check (Clause 8.7.1)
- Local crushing of web at supports or concentrated loads  
- Capacity: pw = (b1 + n) × tw × fy / γm0
  - b1 = bearing length
  - n = effective length reduction (function of flange thickness & reaction type)
  - typical n=35mm for I-beams with under-beam seats

#### Deflection Limits (Clause 5.8)
- L/240 for floors (live load)
- L/180 for cantilevers (live load)
- L/360 for floor + partition systems (total load)
- In practice: Increase depth if deflection critical (use Ix guide)

#### Combined Stress Check (Clause 9.2)
- Beam-column interaction: (N/Ncr + M/Mcr + V/Vcr) ≤ 1.0
- Simplified: Design both for axial + bending with reduced capacities

### COLUMN DESIGN (Clause 7)

#### Compression Capacity (Clause 7.1.1)
- Short: Pd = Ag × fy / γm0 (plastic neutral axis)
- Long: Pd = χ × Ag × fy / γm0 (with reduction factor χ)
- Slenderness ratio: λ = L / r
  - r = √(I/A) = radius of gyration
  - L = effective length = β × length (β = same as concrete)
  - β: 0.65 (fixed-fixed), 0.8 (fixed-pinned), 1.0 (pinned-pinned), 2.0 (cantilever)
- Reduction factor χ (Perry-formula, Table 4, IS 800):
  - λ < 20: χ ≈ 1.0 (short)
  - λ = 40: χ ≈ 0.95
  - λ = 100: χ ≈ 0.6
  - λ > 180: χ ≈ 0.15-0.3 (avoid these)

#### Buckling Category Selection
- Category 'a': Rolled I, H, angles with good fabrication → χ per Eurocode 3 curve(a)
- Category 'b': Welded I-sections, box sections → χ per curve (b)
- Category 'c': Welded box/hollow sections, other → χ per curve (c)

#### Local Buckling Prevention (Clause 3.7.1)
- Width-thickness limits:
  - Flanges: b/tf < 12.4 (Fe500, Class 2)
  - Webs: d/tw < 105 (Fe500, Class 2)
- If exceeded → Class 3 or 4 (reduced capacity)
- Section classification is automatic if using standard I-sections

### CONNECTION DESIGN (Clause 10 & Appendix D)

#### Riveted Connections (Clause D.4 - Now mainly historical)
- Shear capacity per rivet: P = (π/4) × d² × τ
  - τ = 100 MPa (bearing), 70 MPa (shear)
- Bearing: P = d × t × σ (σ = 250 MPa)
- Edge distance: ≥ 1.5 × d, End distance: ≥ 2 × d

#### Bolted Connections (Clause 10.2 & D.3)
- Shear capacity per bolt: P = (π/4) × db² × fy,b / γm1
  - M20: ~150 kN (Grade 8.8), ~120 kN (Grade 4.6)
  - M24: ~220 kN (Grade 8.8)
- Bearing: P = 2.5 × db × t × fy / γm1 (end bolts), 5 × db × t × fy / γm1 (interior)
- Hole size: Standard (d + 1.5mm) or oversize (d + 2.5mm)
- Edge distances:
  - Sheared edge: ≥ 1.4 × db
  - Rolled edge: ≥ 1.2 × db
- Spacing: ≥ 2.5 × db (minimum), ≤ 32 × t (maximum, for Class 2)

#### Welded Connections (Clause 10.1 & D.1)
-Fillet weld: Capacity = (√2 × h × L × fw) / γm0
  - h = throat thickness ≈ 0.7 × leg length
  - L = effective length
  - fw = characteristic strength (fu / √3 for fy/fu ratio)
  - m20: ~0.87 × 290 = 252 MPa → Capacity = 0.87 × h × L × 252 / 1.25 kN
- Butt weld: Full strength (if perfect) → P = A × fy / γm0
- Lap distance: ≥ 5 × leg (fillet)

#### Connection Failures to Avoid
1. Block shear: Check rupture along both shear + tension paths
2. Prying: Excessive bolt tension due to lever effect; use fin stiffeners if high
3. Net section crippling: Ensure adequate section remains after bolt holes
4. Fatigue: If vibration/fluctuating loads, reduce capacities per IS 800 Appendix E

### PRACTICAL DESIGN WORKFLOW

1. **Section Selection**: Choose trial section based on ISMB/ISWB tables
2. **Bending Check**: Compare applied moment to design moment capacity
3. **Lateral Buckling Check**: Ensure lateral support or check reduction
4. **Shear Check**: Compare applied shear to Vd (usually not critical)
5. **Deflection Check**: L/240 rule - if not met, increase section
6. **Connection Design**: Size bolts/welds to resist shear/moment transfer
7. **Detailing**: Ensure minimum clearances, standard bolt patterns

### CRITICAL CODE RULES

- Always start with Class 2 sections (ISMB standard sizes)
- γm0 = 1.1 for all yield-based checks
- γm1 = 1.25 for high-stress connection methods
- β (member buckling) ≤ 2.0; prefer ≤ 1.2 (shorter effective lengths are better)
- Check web crippling at concentrated loads
- Detailing: 1.5db edge distance (minimum), 32t max spacing
`;
