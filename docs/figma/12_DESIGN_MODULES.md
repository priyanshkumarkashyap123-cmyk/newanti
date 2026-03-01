# 12 — Design Modules
## BeamLab Ultimate Figma Specification

---

## 12.1 Design Setup Dialog

```
┌───────────────────────────────────────────────────────────────────┐
│ Design Setup                                                [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Steel Design │ RC Design │ Connection │ Foundation │ Timber  │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ══════════════════════════════════════════════════════════════    │
│ STEEL DESIGN                                                     │
│ ══════════════════════════════════════════════════════════════    │
│                                                                   │
│ Design Code:                                                     │
│ ● IS 800:2007 (Indian Standard — Limit State Method)            │
│ ○ AISC 360-22 (American)                                        │
│ ○ EN 1993-1-1 (Eurocode 3)                                      │
│ ○ BS 5950 (British)                                              │
│ ○ AS 4100 (Australian)                                           │
│                                                                   │
│ Members to Design:                                               │
│ ● All steel members (28 members)                                │
│ ○ Selected members only                                         │
│ ○ Member groups                                                  │
│                                                                   │
│ Design Parameters:                                               │
│ Partial Safety Factor (γm0): [ 1.10 ]                           │
│ Partial Safety Factor (γm1): [ 1.25 ]                           │
│ Fabrication:  ● Welded  ○ Bolted                                │
│ Steel Grade:  [Fe 345 (IS 2062) ▾]                              │
│                                                                   │
│ Effective Length Factors:                                         │
│ ● Auto-calculate from stability analysis                        │
│ ○ User-defined:                                                  │
│   Ky (in-plane):  [ 1.0 ]                                       │
│   Kz (out-plane): [ 1.0 ]                                       │
│   KLT (LTB):     [ 1.0 ]                                        │
│                                                                   │
│ Load Combinations for Design:                                    │
│ ☑ C1: 1.5DL+1.5LL                                              │
│ ☑ C2: 1.2DL+1.2LL+1.2WLx                                      │
│ ☑ C3: 1.2DL+1.2LL+1.2WLz                                      │
│ ☑ C4: 1.5DL+1.5EQx                                             │
│ ☑ C5: 1.5DL+1.5EQz                                             │
│ ☑ C6-C9: Uplift combinations                                   │
│ ☑ ENV: Envelope                                                 │
│                                                                   │
│ Checks to Perform:                                               │
│ ☑ Section classification                                        │
│ ☑ Tension capacity                                              │
│ ☑ Compression capacity (buckling)                               │
│ ☑ Bending capacity (plastic/elastic/LTB)                        │
│ ☑ Shear capacity                                                │
│ ☑ Combined axial + bending (interaction)                        │
│ ☑ Deflection (serviceability)                                   │
│ ☐ Web bearing and buckling                                      │
│ ☐ Fatigue                                                       │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│        [Cancel]    [Preview Checks]    [▶ Run Steel Design]     │
└───────────────────────────────────────────────────────────────────┘
```

---

## 12.2 Steel Design Results

### Overview — Utilization Ratio Display
```
┌───────────────────────────────────────────────────────────────────────────┐
│ Steel Design Results — IS 800:2007                              [✕]      │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ ── Summary ──                                                            │
│ Designed: 28 members  │  Passed: 24 ✅  │  Failed: 4 ❌               │
│ Critical member: M20 (UR = 1.12)                                        │
│                                                                           │
│ [Show in Viewport: Utilization Colors]                                   │
│                                                                           │
│ ┌──────┬──────────┬──────────┬──────────┬───────┬──────────┬──────────┐ │
│ │Member│ Section  │ Governing│   UR     │Status │ Critical │ Combo    │ │
│ │      │          │ Check    │          │       │ Clause   │          │ │
│ ├──────┼──────────┼──────────┼──────────┼───────┼──────────┼──────────┤ │
│ │ M1   │ ISMB 300 │ Bending  │ ████ 0.72│  ✅  │ Cl.8.2.1 │ C1       │ │
│ │ M2   │ ISMB 300 │ Interact │ ██████0.85│ ✅  │ Cl.9.3.1 │ C4       │ │
│ │ M3   │ ISMB 250 │ Deflectn │ ███ 0.62 │  ✅  │ Cl.5.6.1 │ SLS      │ │
│ │ M5   │ ISMB 200 │ LTB      │ █████ 0.78│ ✅  │ Cl.8.2.2 │ C2       │ │
│ │ M12  │ ISMB 400 │ Bending  │ ██████0.91│ ⚠️  │ Cl.8.2.1 │ C1       │ │
│ │ M18  │ ISHB 200 │ Buckling │ ████████1.05│❌  │ Cl.7.1.2 │ C4       │ │
│ │ M20  │ ISHB 200 │ Interact │ █████████1.12│❌ │ Cl.9.3.1 │ C4       │ │
│ │ M22  │ ISHB 150 │ Slndrnes │ █████████1.08│❌ │ Cl.3.8   │ C5       │ │
│ │ M25  │ ISHB 150 │ Buckling │ ████████1.03│❌  │ Cl.7.1.2 │ C4       │ │
│ │ ...  │          │          │          │       │          │          │ │
│ └──────┴──────────┴──────────┴──────────┴───────┴──────────┴──────────┘ │
│                                                                           │
│ Utilization Ratio (UR) bar colors:                                       │
│   0.0 - 0.6: #22c55e (green — under-utilized)                          │
│   0.6 - 0.8: #3b82f6 (blue — efficient)                                │
│   0.8 - 0.9: #f59e0b (amber — near limit)                              │
│   0.9 - 1.0: #f97316 (orange — at limit)                               │
│   > 1.0:     #ef4444 (red — FAILED)                                     │
│                                                                           │
│ Viewport overlay: members colored by UR                                  │
│ Click member row → detailed design report                               │
│                                                                           │
│ [Auto-Optimize Sections]  [📊 Design Report]  [Export]                  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Detailed Member Design Report
```
┌───────────────────────────────────────────────────────────────────────────┐
│ Steel Design Report — Member M20                                [✕]      │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ Member: M20 (N17 → N21)  │  L = 3.500 m  │  Type: Column               │
│ Section: ISHB 200  │  Material: Fe 345  │  Governing: C4 (1.5DL+1.5EQx)│
│                                                                           │
│ ══ Section Classification (IS 800 Table 2) ══                            │
│ Flange: b/tf = 100/9.0 = 11.1 ≤ 9.4ε → Semi-compact                   │
│ Web: d/tw = 162/6.1 = 26.6 ≤ 42ε → Plastic                            │
│ Overall: Semi-compact section                                            │
│                                                                           │
│ ══ Design Forces (C4: 1.5DL + 1.5EQx) ══                               │
│ Axial (Pu):    456.7 kN (compression)                                   │
│ Moment (Mu):    85.3 kN·m (about major axis)                           │
│ Shear (Vu):     12.3 kN                                                │
│                                                                           │
│ ══ Check 1: Compression Capacity (Cl. 7.1.2) ══                        │
│ Ag = 47.54 cm²                                                          │
│ fy = 345 MPa                                                            │
│ KL/ry = 1.0 × 3500 / 41.1 = 85.2                                      │
│ λ = (KL/r) / √(π²E/fy) = 85.2 / 75.7 = 1.125                         │
│ Class b curve → φ = 0.49                                                │
│ χ = 0.524                                                                │
│ Pd = χ × Ag × fy / γm0 = 0.524 × 4754 × 345 / 1.10 = 772.3 kN       │
│                                                                          │
│ UR = Pu/Pd = 456.7/772.3 = 0.591  ✅                                   │
│                                                                           │
│ ══ Check 2: Bending Capacity (Cl. 8.2.1) ══                            │
│ Zpz = 400.0 cm³  (plastic section modulus)                              │
│ Md = Zpz × fy / γm0 = 400.0 × 345 / 1.10 = 125.5 kN·m               │
│                                                                          │
│ UR = Mu/Md = 85.3/125.5 = 0.680  ✅                                    │
│                                                                           │
│ ══ Check 3: LTB Capacity (Cl. 8.2.2) ══                                │
│ Mcr = 142.3 kN·m  (elastic critical moment)                            │
│ λLT = √(Zpz×fy/Mcr) = 0.982                                           │
│ χLT = 0.615                                                             │
│ Md,LTB = χLT × Zpz × fy / γm0 = 77.2 kN·m                           │
│                                                                          │
│ UR = Mu/Md,LTB = 85.3/77.2 = 1.105  ❌ FAILS                          │
│                                                                           │
│ ══ Check 4: Combined Interaction (Cl. 9.3.1) ══                        │
│ (Pu/Pd) + (CMy × Muy)/(Mdy × (1 - Pu/Pey))                           │
│ = 0.591 + (0.6 × 85.3)/(77.2 × (1 - 456.7/1825))                     │
│ = 0.591 + 0.883 = 1.12  ❌ FAILS (> 1.0)                              │
│                                                                           │
│ ══ CHECK SUMMARY ══                                                      │
│ ┌────────────────────────┬───────┬────────┐                              │
│ │ Check                  │  UR   │ Status │                              │
│ ├────────────────────────┼───────┼────────┤                              │
│ │ Compression            │ 0.591 │  ✅    │                              │
│ │ Bending (plastic)      │ 0.680 │  ✅    │                              │
│ │ LTB                    │ 1.105 │  ❌    │                              │
│ │ Shear                  │ 0.082 │  ✅    │                              │
│ │ Interaction (combined) │ 1.120 │  ❌    │                              │
│ │ Slenderness (KL/r)     │ 85.2  │  ✅    │ (< 180)                    │
│ │ Deflection             │ 0.450 │  ✅    │                              │
│ └────────────────────────┴───────┴────────┘                              │
│                                                                           │
│ ⚠️ RECOMMENDATION: Upgrade to ISHB 250 or add lateral bracing          │
│ [Try ISHB 250]  [Try ISMB 300]  [Auto-Select Section]                  │
│                                                                           │
│ [← Previous Member]  [Next Member →]  [📄 Print Report]  [Export PDF]  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 12.3 RC Design (Concrete)

### RC Design Setup
```
┌───────────────────────────────────────────────────────────────────┐
│ RC Design Setup — IS 456:2000                               [✕]  │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Design Type:                                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ 🏗️ Beam │ │ 🏛️ Col  │ │ 📐 Slab │ │ 🧱 Wall │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                   │
│ Concrete Grade: [M25 ▾]   fck = 25 MPa                         │
│ Rebar Grade:    [Fe 500 ▾] fy = 500 MPa                        │
│                                                                   │
│ Cover:                                                           │
│ Beams:    [ 25 ] mm   (IS 456 Table 16)                         │
│ Columns:  [ 40 ] mm                                             │
│ Slabs:    [ 20 ] mm                                             │
│                                                                   │
│ Exposure: ○ Mild  ● Moderate  ○ Severe  ○ Very Severe          │
│                                                                   │
│ Design Philosophy:                                               │
│ ● Limit State Method (IS 456)                                   │
│ ○ Working Stress Method                                         │
│                                                                   │
│ Ductility Detailing:                                             │
│ ● Ductile (IS 13920) — Seismic Zone III, IV, V                 │
│ ○ Ordinary                                                      │
│                                                                   │
│ Max rebar diameter: [ 32 ] mm                                   │
│ Min rebar diameter: [ 10 ] mm                                   │
│ Stirrup diameter:   [ 8  ] mm                                   │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│           [Cancel]           [▶ Run RC Design]                  │
└───────────────────────────────────────────────────────────────────┘
```

### RC Beam Design Result
```
┌───────────────────────────────────────────────────────────────────────────┐
│ RC Beam Design — M12                                            [✕]      │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ Section: 300×500 mm  │  Cover: 25mm  │  d = 462mm                       │
│ Concrete: M25  │  Steel: Fe 500  │  Governing: C1                       │
│                                                                           │
│ ── Cross-Section Drawing (SVG) ──                                        │
│ ┌──────────────────────────────────────────┐                             │
│ │ ┌────────────────────────────────────┐   │                             │
│ │ │ ○─○─○  2-16φ (top/compression)    │   │                             │
│ │ │                                    │   │  500mm                      │
│ │ │  ┌──┐  8φ @ 150mm c/c stirrups    │   │                             │
│ │ │  │  │                              │   │                             │
│ │ │  └──┘                              │   │                             │
│ │ │ ○─○─○─○  3-20φ + 1-16φ (bottom)   │   │                             │
│ │ └────────────────────────────────────┘   │                             │
│ │          ←── 300mm ──→                   │                             │
│ └──────────────────────────────────────────┘                             │
│                                                                           │
│ ── Flexure Design ──                                                     │
│ Mu = 185.3 kN·m                                                         │
│ Mu,lim = 0.138 × fck × b × d² = 0.138 × 25 × 300 × 462² = 220.9 kN·m│
│ Since Mu < Mu,lim → Singly reinforced                                   │
│ Ast = 1108 mm²  → Provide 3-20φ + 1-16φ = 1144 mm²                    │
│ pt = 0.826% (min 0.205% ✅, max 4.0% ✅)                               │
│                                                                           │
│ ── Shear Design ──                                                       │
│ Vu = 65.3 kN                                                            │
│ τv = Vu/(b×d) = 0.471 MPa                                              │
│ τc = 0.488 MPa (IS 456 Table 19, pt=0.826%)                            │
│ Since τv < τc → Min stirrups sufficient                                 │
│ Sv = 0.87×fy×Asv/(0.4×b) = 0.87×500×100.5/(0.4×300) = 365 mm         │
│ Provide 8φ @ 150mm c/c (< 0.75d = 346mm) ✅                            │
│                                                                           │
│ ── Ductile Detailing (IS 13920) ──                                      │
│ ☑ Top reinforcement ≥ 50% of bottom at face of support                 │
│ ☑ Stirrup spacing ≤ d/4 in plastic hinge zone (2d from support)        │
│ ☑ At least 2 bars continuous top & bottom                               │
│ ☑ Lap splice not in plastic hinge zone                                  │
│                                                                           │
│ ── Reinforcement Schedule ──                                             │
│ ┌─────────────────────────────────────────────────────────────────────┐  │
│ │ Location  │ Top Steel    │ Bottom Steel   │ Stirrups              │  │
│ ├───────────┼──────────────┼────────────────┼───────────────────────┤  │
│ │ Left end  │ 3-20φ+1-16φ │ 2-16φ          │ 8φ@100 c/c (2d zone) │  │
│ │ Midspan   │ 2-16φ       │ 3-20φ+1-16φ    │ 8φ@150 c/c           │  │
│ │ Right end │ 3-20φ+1-16φ │ 2-16φ          │ 8φ@100 c/c (2d zone) │  │
│ └───────────┴──────────────┴────────────────┴───────────────────────┘  │
│                                                                           │
│ [← Previous]  [Next →]  [📄 Print]  [View Bar Bending Schedule]        │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### RC Column Design Result
```
┌───────────────────────────────────────────────────────────────────────────┐
│ RC Column Design — M20                                          [✕]      │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ Section: 400×400 mm  │  Cover: 40mm  │  Le = 3.0 m                     │
│ Concrete: M30  │  Steel: Fe 500  │  Governing: C4                       │
│                                                                           │
│ ── Interaction Diagram ──                                                │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ Pu (kN) ↑                                                           │ │
│ │ 3000 ─ ─│─ ─ Pure compression (Pu,max)                             │ │
│ │         │╲                                                           │ │
│ │ 2500 ─ ─│  ╲                                                        │ │
│ │         │    ╲                                                       │ │
│ │ 2000 ─ ─│      ╲  ← Balanced point                                │ │
│ │         │        ╲                                                   │ │
│ │ 1500 ─ ─│          ╲                                                │ │
│ │         │            ╲                                               │ │
│ │ 1000 ─ ─│    ●(456.7, 85.3) — design point                        │ │
│ │         │              ╲                                             │ │
│ │  500 ─ ─│                ╲                                          │ │
│ │         │                  ╲                                         │ │
│ │    0 ─ ─┼──────┼──────┼──────╲────→ Mu (kN·m)                     │ │
│ │         0     100    200    300  (Pure bending)                      │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│ Design point (456.7, 85.3) is INSIDE curve → ✅ Safe                    │
│                                                                           │
│ ── Cross Section ──                                                      │
│ ┌────────────┐                                                           │
│ │ ○  ○  ○  ○ │  4-20φ per face                                         │
│ │ ○        ○ │  Total: 8-20φ = 2513 mm²                                │
│ │ ○        ○ │  pt = 1.57%                                              │
│ │ ○  ○  ○  ○ │  Ties: 8φ@200 c/c                                      │
│ └────────────┘  400×400                                                  │
│                                                                           │
│ [← Previous]  [Next →]  [📄 Print]  [Design All Columns]              │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 12.4 Connection Design

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Connection Design                                               [✕]      │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ Connection Type:                                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│ │  ┬──    │ │  ├──    │ │  ┼──    │ │  ──┤    │ │  ──╨    │          │
│ │ Simple  │ │ Moment  │ │ Splice  │ │ Bracket │ │ Base    │          │
│ │ Shear   │ │ End-Plt │ │ Flange  │ │ Seat    │ │ Plate   │          │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                                           │
│ ── Simple Shear Connection (Clip Angle) ──                              │
│                                                                           │
│ Beam: [ISMB 300 ▾]     Column: [ISHB 200 ▾]                           │
│ Design Shear: 65.3 kN  │  Code: IS 800:2007                            │
│                                                                           │
│ ┌─────────────────────────────┐  Bolt Details:                          │
│ │         ┌─┐                 │  Grade: [8.8 ▾]                         │
│ │    ○    │ │                 │  Diameter: [16 ▾] mm                    │
│ │    ○    │ │                 │  No. of bolts: [ 3 ]                    │
│ │    ○    │ │─── Beam Web     │  Gauge: [ 55 ] mm                      │
│ │         │ │                 │  Pitch: [ 50 ] mm                      │
│ │    ○    │ │                 │  Edge dist: [ 30 ] mm                   │
│ │    ○    │ │                 │                                          │
│ │ Col Flg├─┘                 │  Angle: [ISA 90×60×8 ▾]                │
│ └─────────────────────────────┘                                          │
│                                                                           │
│ ── Design Checks ──                                                      │
│ ✅ Bolt shear: 41.2 / 62.4 kN = 0.66                                   │
│ ✅ Bolt bearing: 41.2 / 76.8 kN = 0.54                                 │
│ ✅ Angle shear: 65.3 / 124.5 kN = 0.52                                 │
│ ✅ Block shear: 65.3 / 98.7 kN = 0.66                                  │
│ ✅ Weld (if welded alternative): adequate                               │
│                                                                           │
│ Overall UR: 0.66  ✅ PASS                                               │
│                                                                           │
│ [Generate Drawing (DXF)]  [📄 Print Report]                            │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 12.5 Foundation Design

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Foundation Design                                               [✕]      │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ Foundation Type:                                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│ │ ╔════╗   │ │ ╔═══╦═══╗│ │  ┌───┐   │ │ ████████ │                    │
│ │ ║    ║   │ │ ║   ║   ║│ │  │   │   │ │ ████████ │                    │
│ │ ╠════╣   │ │ ╠═══╬═══╣│ │  │   │   │ │ ████████ │                    │
│ │Isolatd  │ │Combined │ │ │  Pile  │ │ │  Raft    │                    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                    │
│                                                                           │
│ ── Isolated Footing Design ──                                           │
│                                                                           │
│ Support: N1          Column: 400×400 mm                                 │
│ Axial Load: 342.5 kN  │  Moment: 45.2 kN·m                            │
│                                                                           │
│ Soil Parameters:                                                         │
│ SBC: [ 150 ] kN/m²   (Safe Bearing Capacity)                           │
│ Unit weight: [ 18 ] kN/m³                                               │
│ Depth of foundation: [ 1.5 ] m                                          │
│                                                                           │
│ Computed Size: 1.8 m × 1.8 m × 0.45 m                                  │
│                                                                           │
│ ┌────────────────────────────────────┐    Checks:                        │
│ │ ┌──────────────────────────────┐   │    ✅ Bearing: 125 < 150 kN/m²  │
│ │ │     ┌──────┐                 │   │    ✅ One-way shear: OK          │
│ │ │     │Column│                 │   │    ✅ Two-way (punching): OK     │
│ │ │     │400×400                 │   │    ✅ Bending: Ast = 628 mm²     │
│ │ │     └──────┘                 │   │    Rebar: 10φ @ 180 c/c BW      │
│ │ │  1800 × 1800 × 450          │   │                                   │
│ │ └──────────────────────────────┘   │                                   │
│ └────────────────────────────────────┘                                   │
│                                                                           │
│ [Design All Footings]  [📄 Report]  [Generate Drawing]                 │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 12.6 Viewport — Design Results Overlay

```
Design Color Overlay in 3D Viewport:
─────────────────────────────────────

When design results are displayed, each member is colored by its
utilization ratio (UR):

  UR ≤ 0.3:  #22c55e (green)    — significantly under-utilized
  UR 0.3-0.6: #3b82f6 (blue)    — under-utilized
  UR 0.6-0.8: #06b6d4 (cyan)    — efficient
  UR 0.8-0.9: #f59e0b (amber)   — near capacity
  UR 0.9-1.0: #f97316 (orange)  — at capacity
  UR > 1.0:   #ef4444 (red)     — FAILED (pulsing animation)

Member labels show:
  Section name + UR value
  e.g. "ISMB 300 (0.72)"

Failed members:
  Red color + 3px stroke + pulsing glow animation
  Tooltip: "FAILED: Interaction check, UR=1.12, Need ISHB 250"

Legend (bottom-left):
  Utilization Ratio
  ■ 0-30%  ■ 30-60%  ■ 60-80%  ■ 80-90%  ■ 90-100%  ■ >100%
  Members: 28 | Pass: 24 | Fail: 4
```
