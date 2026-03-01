# 08 — Properties & Materials
## BeamLab Ultimate Figma Specification

---

## 8.1 Section Database Browser

### Full Dialog (720px × 600px)
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Section Database                                                        [✕]   │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ 🔍 [Search sections... e.g. "ISMB 200" or "W14x22"]                         │
│                                                                               │
│ ┌─────────────────┐  ┌──────────────────────────────────────────────────────┐│
│ │ Categories      │  │                                                      ││
│ │                 │  │ Indian Sections (IS 808)                             ││
│ │ ▼ Steel         │  │                                                      ││
│ │   ▸ Indian (IS) │  │  Sort: [Name ▾]  Filter: [All Types ▾]             ││
│ │   ▸ American    │  │                                                      ││
│ │   ▸ European    │  │  ┌──────┬──────┬───────┬───────┬───────┬──────────┐ ││
│ │   ▸ British     │  │  │ Name │ D    │ B     │ tw    │ tf    │ Area     │ ││
│ │   ▸ Australian  │  │  │      │ (mm) │ (mm)  │ (mm)  │ (mm)  │ (cm²)   │ ││
│ │                 │  │  ├──────┼──────┼───────┼───────┼───────┼──────────┤ ││
│ │ ▸ Concrete      │  │  │ISMB  │      │       │       │       │          │ ││
│ │   ▸ Rectangular │  │  │ 100  │ 100  │ 75    │ 4.0   │ 7.2   │ 14.6    │ ││
│ │   ▸ Circular    │  │  │ 150  │ 150  │ 80    │ 4.8   │ 7.6   │ 19.0    │ ││
│ │   ▸ T-Section   │  │  │ 200★ │ 200  │ 100   │ 5.7   │ 10.8  │ 32.3    │ ││
│ │   ▸ L-Section   │  │  │ 250  │ 250  │ 125   │ 6.9   │ 12.5  │ 47.5    │ ││
│ │                 │  │  │ 300  │ 300  │ 140   │ 7.7   │ 13.1  │ 58.9    │ ││
│ │ ▸ Composite     │  │  │ 350  │ 350  │ 140   │ 8.1   │ 14.2  │ 66.7    │ ││
│ │                 │  │  │ 400  │ 400  │ 140   │ 8.9   │ 16.0  │ 78.5    │ ││
│ │ ▸ Cold-Formed   │  │  │ 450  │ 450  │ 150   │ 9.4   │ 17.4  │ 92.3    │ ││
│ │                 │  │  │ 500  │ 500  │ 180   │ 10.2  │ 17.2  │ 110.7   │ ││
│ │ ▸ Timber        │  │  │ 550  │ 550  │ 190   │ 11.2  │ 19.3  │ 132.1   │ ││
│ │                 │  │  │ 600  │ 600  │ 210   │ 12.0  │ 20.8  │ 156.2   │ ││
│ │ ▸ Custom        │  │  └──────┴──────┴───────┴───────┴───────┴──────────┘ ││
│ │                 │  │                                                      ││
│ └─────────────────┘  │  ── Selected: ISMB 200 ──                           ││
│                      │  ┌──────────────────────────────────────────────────┐││
│                      │  │ ┌───────┐  Area = 32.33 cm²                     │││
│                      │  │ │ ┌───┐ │  Ix = 2235.4 cm⁴   Zx = 223.5 cm³   │││
│                      │  │ │ │   │ │  Iy = 150.0 cm⁴    Zy = 37.5 cm³    │││
│                      │  │ │ │   │ │  rx = 8.32 cm       ry = 2.15 cm     │││
│                      │  │ ├─┤   ├─┤  J = 12.3 cm⁴      Cw = 17840 cm⁶   │││
│                      │  │ │ │   │ │  Weight = 25.4 kg/m                   │││
│                      │  │ │ └───┘ │                                       │││
│                      │  │ │ 200mm │  D=200 B=100 tw=5.7 tf=10.8          │││
│                      │  │ └───────┘                                       │││
│                      │  └──────────────────────────────────────────────────┘││
│                      └──────────────────────────────────────────────────────┘│
│                                                                               │
├───────────────────────────────────────────────────────────────────────────────┤
│  Apply to: [Selected Members ▾] (3 members)     [Cancel]  [Apply Section]   │
└───────────────────────────────────────────────────────────────────────────────┘

Section Preview (bottom-right panel):
  SVG cross-section drawing
  Dimensions annotated
  Properties table with all geometric properties
  Rendered in monospace font for values
```

### Custom Section Creator
```
┌───────────────────────────────────────────────────────────────┐
│ Custom Section                                          [✕]   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Section Shape:                                              │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│  │ I  │ │ ▭  │ │ ○  │ │ □  │ │ L  │ │ C  │ │ T  │        │
│  │Beam│ │Rect│ │Pipe│ │Tube│ │Angl│ │Chan│ │Tee │        │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘        │
│                                                               │
│  ── I-Section Parameters ──                                  │
│                                                               │
│  ┌──────────────────────┐     Depth (D):    [ 250 ] mm      │
│  │      ┌────────┐      │     Flange (B):   [ 125 ] mm      │
│  │      │  tf    │ ←B→  │     Web (tw):     [ 6.9 ] mm      │
│  │      └───┬────┘      │     Flange (tf):  [ 12.5] mm      │
│  │          │tw         │                                    │
│  │    D ↕   │            │     ── Calculated ──              │
│  │          │            │     Area: 47.5 cm²                │
│  │      ┌───┴────┐      │     Ix: 5131.6 cm⁴               │
│  │      │  tf    │      │     Iy: 334.5 cm⁴                │
│  │      └────────┘      │     Zx: 410.5 cm³                │
│  └──────────────────────┘     Weight: 37.3 kg/m             │
│                                                               │
│  Section Name: [Custom_I_250 ]                               │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                [Cancel]  [Save to Library]  [Apply]          │
└───────────────────────────────────────────────────────────────┘

Live SVG preview updates as dimensions change
Calculated properties update in real-time
```

---

## 8.2 Material Database

### Material Browser Dialog
```
┌───────────────────────────────────────────────────────────────────┐
│ Material Database                                           [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ 🔍 [Search materials...]                                         │
│                                                                   │
│ Categories: [All] [Steel] [Concrete] [Timber] [Aluminum] [Custom]│
│                                                                   │
│ ┌────────┬──────────┬─────────┬─────────┬─────────┬────────────┐ │
│ │ Name   │ E (MPa)  │ fy(MPa) │ fu(MPa) │ ρ(kg/m³)│ Standard   │ │
│ ├────────┼──────────┼─────────┼─────────┼─────────┼────────────┤ │
│ │ STEEL                                                        │ │
│ │Fe 250  │ 200,000  │ 250     │ 410     │ 7,850   │ IS 2062    │ │
│ │Fe 345★ │ 200,000  │ 345     │ 490     │ 7,850   │ IS 2062    │ │
│ │Fe 410  │ 200,000  │ 410     │ 540     │ 7,850   │ IS 2062    │ │
│ │Fe 450  │ 200,000  │ 450     │ 570     │ 7,850   │ IS 2062    │ │
│ │A36     │ 200,000  │ 248     │ 400     │ 7,850   │ ASTM       │ │
│ │A992    │ 200,000  │ 345     │ 448     │ 7,850   │ ASTM       │ │
│ │S275    │ 210,000  │ 275     │ 430     │ 7,850   │ EN 10025   │ │
│ │S355    │ 210,000  │ 355     │ 490     │ 7,850   │ EN 10025   │ │
│ ├────────┼──────────┼─────────┼─────────┼─────────┼────────────┤ │
│ │ CONCRETE                                                     │ │
│ │M20     │ 22,360   │ —       │ 20 fck  │ 2,500   │ IS 456     │ │
│ │M25     │ 25,000   │ —       │ 25 fck  │ 2,500   │ IS 456     │ │
│ │M30     │ 27,386   │ —       │ 30 fck  │ 2,500   │ IS 456     │ │
│ │M35     │ 29,580   │ —       │ 35 fck  │ 2,500   │ IS 456     │ │
│ │M40     │ 31,623   │ —       │ 40 fck  │ 2,500   │ IS 456     │ │
│ │C30/37  │ 33,000   │ —       │ 30 fck  │ 2,500   │ EN 1992    │ │
│ ├────────┼──────────┼─────────┼─────────┼─────────┼────────────┤ │
│ │ REBAR STEEL                                                  │ │
│ │Fe 415  │ 200,000  │ 415     │ 485     │ 7,850   │ IS 1786    │ │
│ │Fe 500  │ 200,000  │ 500     │ 545     │ 7,850   │ IS 1786    │ │
│ │Fe 550D │ 200,000  │ 550     │ 585     │ 7,850   │ IS 1786    │ │
│ └────────┴──────────┴─────────┴─────────┴─────────┴────────────┘ │
│                                                                   │
│ ── Selected: Fe 345 (IS 2062) ──                                │
│ Elastic Modulus (E):    200,000 MPa                              │
│ Yield Strength (fy):    345 MPa                                  │
│ Ultimate Strength (fu): 490 MPa                                  │
│ Poisson's Ratio (ν):    0.30                                    │
│ Shear Modulus (G):      76,923 MPa                              │
│ Coeff. Thermal Exp (α): 12×10⁻⁶ /°C                           │
│ Density (ρ):            7,850 kg/m³                             │
│ Unit Weight (γ):        76.97 kN/m³                             │
│                                                                   │
│ Stress-Strain Curve:                                             │
│ ┌──────────────────────────────────────────┐                     │
│ │ σ ↑     ┌────────────── fu              │                     │
│ │   │   ╱─╯                                │                     │
│ │   │  ╱← fy                              │                     │
│ │   │ ╱                                    │                     │
│ │   │╱                                     │                     │
│ │   ╱────────────────────────→ ε           │                     │
│ │   0    εy          εu                    │                     │
│ └──────────────────────────────────────────┘                     │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│ Apply to: [Selected Members ▾]         [Cancel]  [Apply Material]│
└───────────────────────────────────────────────────────────────────┘
```

---

## 8.3 Support Assignment Panel

### Support Types Visual
```
┌───────────────────────────────────────────────────────┐
│ Assign Support                                  [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Select support type:                                 │
│                                                       │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│ │   ▲▲▲    │ │    ●     │ │   ●──○   │ │    /     ││
│ │  ▲▲▲▲▲   │ │   ╱╲    │ │   ╱╲     │ │   /      ││
│ │  ╱╱╱╱╱   │ │  ╱  ╲   │ │  ╱  ╲  ○ │ │  /       ││
│ │          │ │         │ │    ○○○  │ │  ○○○     ││
│ │  Fixed   │ │  Pinned │ │  Roller  │ │  Inclined││
│ │ Tx Ty Tz │ │ Tx Ty   │ │ Ty only  │ │  Roller  ││
│ │ Rx Ry Rz │ │         │ │          │ │          ││
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│                                                       │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│ │  ⏜⏜⏜⏜  │ │          │ │  Custom  │              │
│ │  Spring  │ │  Free    │ │          │              │
│ │  Kx, Ky  │ │  (No     │ │  ☐ Tx   │              │
│ │  Kz      │ │  support)│ │  ☐ Ty   │              │
│ └──────────┘ └──────────┘ │  ☐ Tz   │              │
│                            │  ☐ Rx   │              │
│ Apply to: [Selected Nodes]│  ☐ Ry   │              │
│ Nodes: N1, N4             │  ☐ Rz   │              │
│                            └──────────┘              │
│                                                       │
│ Spring Constants (if Spring type selected):          │
│ Kx: [  1000  ] kN/m     KRx: [     0  ] kN·m/rad  │
│ Ky: [ 10000  ] kN/m     KRy: [     0  ] kN·m/rad  │
│ Kz: [  1000  ] kN/m     KRz: [     0  ] kN·m/rad  │
│                                                       │
├───────────────────────────────────────────────────────┤
│                [Cancel]        [Apply Support]        │
└───────────────────────────────────────────────────────┘

Support symbols in viewport:
  Fixed: filled triangle + hash lines below ▲▲▲
  Pinned: hollow triangle △
  Roller: triangle on circles △○○
  Spring: zigzag line ⏜⏜⏜
  Color: gold (#f59e0b)
  Size: proportional to view, 12-20px
```

---

## 8.4 Member Release Editor

```
┌───────────────────────────────────────────────────────┐
│ Member End Releases                             [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Member: M1 (N1 → N2)                                │
│                                                       │
│ ── Start End (N1) ──   ── End End (N2) ──           │
│                                                       │
│ Preset: [Fixed ▾]      Preset: [Pinned ▾]          │
│                                                       │
│ ☐ Release Fx (axial)   ☐ Release Fx                 │
│ ☐ Release Fy (shear)   ☐ Release Fy                 │
│ ☐ Release Fz (shear)   ☐ Release Fz                 │
│ ☐ Release Mx (torsion) ☐ Release Mx                 │
│ ☐ Release My (moment)  ☐ Release My                 │
│ ☑ Release Mz (moment)  ☑ Release Mz                 │
│                                                       │
│ Visual:                                               │
│ ┌──────────────────────────────────────────────────┐  │
│ │  ●──────────────────────────────○                │  │
│ │  N1 (fixed)                    N2 (pinned Mz)    │  │
│ │  ● = rigid connection          ○ = pin/release   │  │
│ └──────────────────────────────────────────────────┘  │
│                                                       │
│ Partial Releases (Advanced):                         │
│ ☐ Enable partial fixity                             │
│ Mz spring: [     ] kN·m/rad (0=free, ∞=fixed)      │
│                                                       │
├───────────────────────────────────────────────────────┤
│                [Cancel]              [Apply]          │
└───────────────────────────────────────────────────────┘

Presets dropdown:
  Fixed — all restrained
  Pinned — Mz released
  Universal Pin — all moments released
  Truss — My + Mz released at both ends
  Custom — manual selection
```

---

## 8.5 Member Offset Editor
```
┌───────────────────────────────────────────────────────┐
│ Member Offsets                                  [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Member: M1                                           │
│                                                       │
│ Offset Type:                                         │
│ ● Rigid offset (from node center to member face)    │
│ ○ Manual offset                                     │
│                                                       │
│ ── Start Offset ──                                   │
│ X: [ 0.000 ] m     (along member axis)              │
│ Y: [ 0.150 ] m     (perpendicular - depth/2)       │
│ Z: [ 0.000 ] m     (out of plane)                   │
│                                                       │
│ ── End Offset ──                                     │
│ X: [ 0.000 ] m                                      │
│ Y: [ 0.150 ] m                                      │
│ Z: [ 0.000 ] m                                      │
│                                                       │
│ [Auto-Calculate from Section]                        │
│                                                       │
├───────────────────────────────────────────────────────┤
│                [Cancel]              [Apply]          │
└───────────────────────────────────────────────────────┘
```
