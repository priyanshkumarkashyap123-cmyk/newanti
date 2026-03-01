# 09 — Loading System
## BeamLab Ultimate Figma Specification

---

## 9.1 Load Case Manager

### Load Case Panel (sidebar tab or dialog)
```
┌───────────────────────────────────────────────────────┐
│ Load Cases                              [+] [⚙]  [✕] │
├───────────────────────────────────────────────────────┤
│                                                       │
│ 🔍 [Filter load cases...]                            │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ ☑  LC1: Dead Load (DL)                    [⋮]  │  │
│ │    Type: Dead   │ Self-weight: ✓               │  │
│ │    Loads: 12 point, 8 UDL    Color: ■ #94a3b8  │  │
│ ├─────────────────────────────────────────────────┤  │
│ │ ☑  LC2: Live Load (LL)                    [⋮]  │  │
│ │    Type: Live   │ Self-weight: ✗               │  │
│ │    Loads: 6 UDL, 2 floor     Color: ■ #3b82f6  │  │
│ ├─────────────────────────────────────────────────┤  │
│ │ ☑  LC3: Wind Load X+ (WLx)               [⋮]  │  │
│ │    Type: Wind   │ Auto-gen: IS 875-III         │  │
│ │    Loads: 24 point            Color: ■ #06b6d4  │  │
│ ├─────────────────────────────────────────────────┤  │
│ │ ☑  LC4: Wind Load Z+ (WLz)               [⋮]  │  │
│ │    Type: Wind   │ Auto-gen: IS 875-III         │  │
│ │    Loads: 18 point            Color: ■ #8b5cf6  │  │
│ ├─────────────────────────────────────────────────┤  │
│ │ ☑  LC5: Seismic X (EQx)                  [⋮]  │  │
│ │    Type: Seismic│ Auto-gen: IS 1893            │  │
│ │    Loads: 8 storey forces     Color: ■ #ef4444  │  │
│ ├─────────────────────────────────────────────────┤  │
│ │ ☑  LC6: Seismic Z (EQz)                  [⋮]  │  │
│ │    Type: Seismic│ Auto-gen: IS 1893            │  │
│ │    Loads: 8 storey forces     Color: ■ #f59e0b  │  │
│ ├─────────────────────────────────────────────────┤  │
│ │ ☐  LC7: Temperature (TEMP)                [⋮]  │  │
│ │    Type: Thermal│ ΔT = +30°C                   │  │
│ │    Loads: 4 member thermal   Color: ■ #f97316  │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ [+ New Load Case]  [📋 Duplicate]  [🗑 Delete]      │
│                                                       │
│ ── Active Display ──                                 │
│ Show: ● Selected  ○ All  ○ None                     │
│ Load Values: ☑ Show  Scale: [1.0 ▾]                │
│                                                       │
└───────────────────────────────────────────────────────┘

Context menu on [⋮]:
  Edit Load Case...
  Duplicate
  Add Self-Weight
  Set Color...
  Set as Primary
  Delete
```

### New Load Case Dialog
```
┌───────────────────────────────────────────────────────┐
│ New Load Case                                   [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Load Case Name: [Live Load - Floor    ]              │
│ Abbreviation:   [LL-F                 ]              │
│                                                       │
│ Load Type:                                           │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│ │  ⬇️    │ │  👥   │ │  🌊   │ │  🌀   │        │
│ │ Dead   │ │ Live   │ │ Wind   │ │Seismic │        │
│ └────────┘ └────────┘ └────────┘ └────────┘        │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│ │  🌡️   │ │  ❄️   │ │  🏗️   │ │  ⚡   │        │
│ │Thermal │ │ Snow   │ │ Constr │ │ Impact │        │
│ └────────┘ └────────┘ └────────┘ └────────┘        │
│                                                       │
│ ☐ Include Self-Weight (DL × 1.0)                    │
│ ☐ Auto-generate from code                           │
│                                                       │
│ Display Color: [■ #3b82f6 ▾]                        │
│                                                       │
├───────────────────────────────────────────────────────┤
│               [Cancel]         [Create Load Case]    │
└───────────────────────────────────────────────────────┘
```

---

## 9.2 Load Types — Application UI

### 9.2.1 Concentrated / Point Load
```
┌───────────────────────────────────────────────────────┐
│ Point Load                                      [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Load Case: [LC2: Live Load ▾]                        │
│                                                       │
│ Apply to:                                            │
│ ● Node(s)    ○ Along Member                          │
│                                                       │
│ ── If Node ──                                        │
│ Node(s): [N3, N5, N7   ] [Pick 🎯]                  │
│                                                       │
│ Forces:               Moments:                       │
│ Fx: [    0  ] kN      Mx: [    0  ] kN·m            │
│ Fy: [ -50.0 ] kN ↓    My: [    0  ] kN·m            │
│ Fz: [    0  ] kN      Mz: [    0  ] kN·m            │
│                                                       │
│ Direction: ● Global  ○ Local                        │
│                                                       │
│ ── If Along Member ──                                │
│ Member(s): [M1, M2     ] [Pick 🎯]                  │
│ Distance from start: [ 2.5  ] m  or [ 50  ] %       │
│                                                       │
│ Forces:               Moments:                       │
│ Fy: [ -25.0 ] kN ↓    Mz: [    0  ] kN·m            │
│                                                       │
│ Direction: ○ Global  ● Local                        │
│                                                       │
│ Preview:                                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │  A───────────↓50kN───────────B                  │ │
│ │             2.5m                                  │ │
│ └──────────────────────────────────────────────────┘ │
│                                                       │
├───────────────────────────────────────────────────────┤
│ [Add Another]           [Cancel]        [Apply Load] │
└───────────────────────────────────────────────────────┘

Viewport display:
  Arrow pointing in load direction
  Arrow length proportional to magnitude
  Label showing value: "50 kN"
  Color matches load case
```

### 9.2.2 Uniform Distributed Load (UDL)
```
┌───────────────────────────────────────────────────────┐
│ Uniform Distributed Load (UDL)                  [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Load Case: [LC2: Live Load ▾]                        │
│                                                       │
│ Member(s): [M1, M2, M3  ] [Pick 🎯] [Select All]   │
│                                                       │
│ Load Intensity:                                      │
│ Wy: [ -15.0 ] kN/m ↓                               │
│ Wx: [   0   ] kN/m                                  │
│ Wz: [   0   ] kN/m                                  │
│                                                       │
│ Extent:                                              │
│ ● Full length                                       │
│ ○ Partial:  Start: [ 1.0 ] m   End: [ 4.0 ] m      │
│                                                       │
│ Direction: ● Global  ○ Local  ○ Projected           │
│                                                       │
│ Preview:                                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │  A═══════════════════════════════B              │ │
│ │  ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓               │ │
│ │           15 kN/m                                │ │
│ └──────────────────────────────────────────────────┘ │
│                                                       │
├───────────────────────────────────────────────────────┤
│ [Add Another]           [Cancel]        [Apply Load] │
└───────────────────────────────────────────────────────┘

Viewport display:
  Evenly spaced arrows along member length
  Rectangle outline showing load distribution
  Label: "15 kN/m"
```

### 9.2.3 Triangular / Trapezoidal Load
```
┌───────────────────────────────────────────────────────┐
│ Varying Distributed Load                        [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Load Case: [LC3: Wind Load ▾]                        │
│ Member(s): [M5           ] [Pick 🎯]                │
│                                                       │
│ Pattern:                                             │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│ │ ╲      │ │      ╱ │ │ ╱╲     │ │ ╲╱     │        │
│ │  ╲     │ │     ╱  │ │╱  ╲    │ │  ╲╱    │        │
│ │   ╲    │ │    ╱   │ │    ╲   │ │   ╲    │        │
│ │Tri→0  │ │0→Tri  │ │Tri Peak│ │Trap    │        │
│ └────────┘ └────────┘ └────────┘ └────────┘        │
│                                                       │
│ Start Intensity (W1): [ -20.0 ] kN/m               │
│ End Intensity (W2):   [   0.0 ] kN/m               │
│                                                       │
│ Start Position: [ 0.0 ] m ( 0 %)                    │
│ End Position:   [ 6.0 ] m (100%)                    │
│                                                       │
│ Direction: ○ Global  ● Local                        │
│                                                       │
│ Preview:                                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │  A══════════════════════════════B               │ │
│ │  ↓↓↓↓↓↓↓↓↓↓↓↓                                  │ │
│ │  │╲                                              │ │
│ │  │  ╲                                            │ │
│ │  │    ╲    20→0 kN/m                            │ │
│ │  │      ╲______                                  │ │
│ └──────────────────────────────────────────────────┘ │
│                                                       │
├───────────────────────────────────────────────────────┤
│ [Add Another]           [Cancel]        [Apply Load] │
└───────────────────────────────────────────────────────┘
```

### 9.2.4 Moment Load
```
┌───────────────────────────────────────────────────────┐
│ Applied Moment                                  [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Load Case: [LC2: Live Load ▾]                        │
│                                                       │
│ Apply at: ● Node  ○ Along Member                     │
│ Node: [N5  ] [Pick 🎯]                              │
│                                                       │
│ Mx (Torsion): [   0   ] kN·m                        │
│ My (About Y): [   0   ] kN·m                        │
│ Mz (About Z): [  25.0 ] kN·m  ↺                    │
│                                                       │
│ Convention: ● Right-hand rule  ○ Clockwise +         │
│                                                       │
│ Preview:                                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │  A───────────↺25kN·m────────B                   │ │
│ └──────────────────────────────────────────────────┘ │
│                                                       │
├───────────────────────────────────────────────────────┤
│                         [Cancel]        [Apply Load] │
└───────────────────────────────────────────────────────┘

Viewport display:
  Curved arrow (arc arrow) showing moment direction
  Label: "25 kN·m"
  Color matches load case
```

### 9.2.5 Self-Weight
```
┌───────────────────────────────────────────────────────┐
│ Self-Weight                                     [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Load Case: [LC1: Dead Load ▾]                        │
│                                                       │
│ Direction: ● -Y (Gravity)  ○ Custom                 │
│                                                       │
│ Factor: [ 1.0 ]  (multiplier on calculated weight)  │
│                                                       │
│ Apply to:                                            │
│ ● All members                                       │
│ ○ Selected members only                             │
│                                                       │
│ Calculated total self-weight: 142.6 kN              │
│                                                       │
│ Include:                                             │
│ ☑ Frame members                                     │
│ ☑ Plate elements                                    │
│ ☐ Additional mass only                               │
│                                                       │
├───────────────────────────────────────────────────────┤
│                         [Cancel]  [Apply Self-Weight] │
└───────────────────────────────────────────────────────┘
```

### 9.2.6 Floor / Area Load
```
┌───────────────────────────────────────────────────────┐
│ Floor Load / Area Load                          [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Load Case: [LC2: Live Load ▾]                        │
│                                                       │
│ Distribution Method:                                 │
│ ● One-way slab   ○ Two-way slab   ○ Auto-detect    │
│                                                       │
│ Load Category:                                       │
│ ┌─────────────────────────────────────────┐          │
│ │ Residential (IS 875-II)      2.0 kN/m² │          │
│ │ Office                       3.0 kN/m² │          │
│ │ Commercial / Retail          4.0 kN/m² │          │
│ │ Industrial - Light           5.0 kN/m² │          │
│ │ Industrial - Heavy          10.0 kN/m² │          │
│ │ Parking                      5.0 kN/m² │          │
│ │ Corridors & Stairs           4.0 kN/m² │          │
│ │ Roof - Accessible            1.5 kN/m² │          │
│ │ Roof - Non-accessible        0.75kN/m² │          │
│ │ Custom                       [    ] kN/m²│         │
│ └─────────────────────────────────────────┘          │
│                                                       │
│ Floor Region:                                        │
│ ● Select panel (click enclosed area in viewport)    │
│ ○ By storey: [Storey 3 ▾]                          │
│ ○ All floors                                        │
│                                                       │
│ Intensity: [ 3.0 ] kN/m²                           │
│                                                       │
│ The system auto-distributes to supporting beams.    │
│                                                       │
│ Preview: Tributary areas shown with colored fill     │
│                                                       │
├───────────────────────────────────────────────────────┤
│                         [Cancel]        [Apply Load] │
└───────────────────────────────────────────────────────┘
```

### 9.2.7 Thermal Load
```
┌───────────────────────────────────────────────────────┐
│ Temperature Load                                [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Load Case: [LC7: Temperature ▾]                      │
│ Member(s): [M1, M2, M3  ] [Pick 🎯]                │
│                                                       │
│ Temperature Change:                                  │
│ ΔT (uniform): [ +30.0 ] °C                         │
│                                                       │
│ Gradient (optional):                                 │
│ ΔT top:    [ +35.0 ] °C                            │
│ ΔT bottom: [ +25.0 ] °C                            │
│ Gradient: 10.0 °C across depth                      │
│                                                       │
│ Reference Temperature: [ 20.0 ] °C                  │
│                                                       │
├───────────────────────────────────────────────────────┤
│                         [Cancel]        [Apply Load] │
└───────────────────────────────────────────────────────┘
```

### 9.2.8 Moving Load
```
┌───────────────────────────────────────────────────────┐
│ Moving Load                                     [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Load Case: [LC8: Moving Load ▾]                      │
│                                                       │
│ Vehicle Type:                                        │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│ │ 🚛    │ │ 🚗    │ │ 🚂    │ │ Custom │        │
│ │IRC     │ │IRC     │ │Railway │ │Load    │        │
│ │Class AA│ │Class A │ │        │ │Train   │        │
│ └────────┘ └────────┘ └────────┘ └────────┘        │
│                                                       │
│ ── IRC Class A Vehicle ──                            │
│ ┌──────────────────────────────────────────────────┐ │
│ │  27  27  114  114  68  68  68  68   (kN)        │ │
│ │  │   │    │    │    │   │   │   │              │ │
│ │  ▼   ▼    ▼    ▼    ▼   ▼   ▼   ▼              │ │
│ │  ●───●────●────●────●───●───●───●──→           │ │
│ │ 1.1 3.2  1.2  4.3  3.0 3.0 3.0  (m spacing)   │ │
│ └──────────────────────────────────────────────────┘ │
│                                                       │
│ Path: [Select members in order 🎯]                  │
│ Members: M1 → M2 → M3 → M4                         │
│                                                       │
│ Impact Factor: [ 1.25 ] (auto per IRC 6)            │
│ Lane Factor:   [ 1.0  ]                             │
│ Number of Lanes: [ 2 ]                              │
│                                                       │
│ Increment: [ 0.5 ] m  (position step)               │
│ ☑ Generate envelope (max/min at each position)      │
│                                                       │
├───────────────────────────────────────────────────────┤
│                         [Cancel]   [Generate Loads]  │
└───────────────────────────────────────────────────────┘
```

---

## 9.3 Load Combination Generator

### Manual Combinations
```
┌───────────────────────────────────────────────────────────────────┐
│ Load Combinations                                           [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌──────────┬───────────────────────────────────────────────────┐  │
│ │ Manual   │  Auto-Generate (IS 875)  │  Import  │            │  │
│ └──────────┴───────────────────────────────────────────────────┘  │
│                                                                   │
│ ── Defined Combinations ──                                       │
│                                                                   │
│ ┌──────┬──────────────┬──────┬──────┬──────┬──────┬──────┬─────┐│
│ │ #    │ Name         │ DL   │ LL   │ WLx  │ WLz  │ EQx  │ EQz ││
│ ├──────┼──────────────┼──────┼──────┼──────┼──────┼──────┼─────┤│
│ │ C1   │ 1.5DL+1.5LL │ 1.50 │ 1.50 │  —   │  —   │  —   │  —  ││
│ │ C2   │ 1.2DL+1.2LL │ 1.20 │ 1.20 │  —   │  —   │  —   │  —  ││
│ │      │ +1.2WLx      │      │      │ 1.20 │      │      │     ││
│ │ C3   │ 1.2DL+1.2LL │ 1.20 │ 1.20 │  —   │ 1.20 │  —   │  —  ││
│ │      │ +1.2WLz      │      │      │      │      │      │     ││
│ │ C4   │ 1.5DL+1.5EQx│ 1.50 │  —   │  —   │  —   │ 1.50 │  —  ││
│ │ C5   │ 1.5DL+1.5EQz│ 1.50 │  —   │  —   │  —   │  —   │1.50││
│ │ C6   │ 0.9DL+1.5WLx│ 0.90 │  —   │ 1.50 │  —   │  —   │  —  ││
│ │ C7   │ 0.9DL+1.5WLz│ 0.90 │  —   │  —   │ 1.50 │  —   │  —  ││
│ │ C8   │ 0.9DL+1.5EQx│ 0.90 │  —   │  —   │  —   │ 1.50 │  —  ││
│ │ C9   │ 0.9DL+1.5EQz│ 0.90 │  —   │  —   │  —   │  —   │1.50││
│ │ ENV  │ Envelope     │ 1.00 │ Max  │ Max  │ Max  │ Max  │ Max ││
│ └──────┴──────────────┴──────┴──────┴──────┴──────┴──────┴─────┘│
│                                                                   │
│ [+ Add Combination]  [+ Add Envelope]                            │
│ [🗑 Delete Selected]  [📋 Duplicate]                             │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                         [Cancel]     [Save Combinations]         │
└───────────────────────────────────────────────────────────────────┘
```

### Auto-Generate Dialog
```
┌───────────────────────────────────────────────────────┐
│ Auto-Generate Load Combinations                 [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Design Code: [IS 456:2000 / IS 875 ▾]              │
│                                                       │
│ Other codes available:                               │
│   IS 800:2007 (Steel)                                │
│   ASCE 7-22                                          │
│   EN 1990 (Eurocode)                                 │
│   AS/NZS 1170                                        │
│                                                       │
│ ── Load Case Mapping ──                              │
│                                                       │
│ Dead Load:     [LC1: Dead Load ▾]                   │
│ Live Load:     [LC2: Live Load ▾]                   │
│ Wind X:        [LC3: Wind X    ▾]                   │
│ Wind Z:        [LC4: Wind Z    ▾]                   │
│ Seismic X:     [LC5: Seismic X ▾]                   │
│ Seismic Z:     [LC6: Seismic Z ▾]                   │
│                                                       │
│ Limit States:                                        │
│ ☑ Ultimate Limit State (ULS)                        │
│ ☑ Serviceability Limit State (SLS)                  │
│ ☐ Stability / Overturning                           │
│                                                       │
│ Options:                                             │
│ ☑ Include ± sign alternatives for lateral loads     │
│ ☑ Include 0.9DL combinations (uplift/overturning)   │
│ ☑ Generate envelope combination                     │
│                                                       │
│ Estimated combinations: 24                           │
│                                                       │
├───────────────────────────────────────────────────────┤
│               [Cancel]     [Generate 24 Combinations]│
└───────────────────────────────────────────────────────┘
```

---

## 9.4 Seismic Load Generator (IS 1893)

```
┌───────────────────────────────────────────────────────────────────┐
│ Seismic Load Generator — IS 1893:2016                       [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ── Seismic Zone ──                                               │
│ Zone: ● II (0.10)  ○ III (0.16)  ○ IV (0.24)  ○ V (0.36)     │
│ Z = 0.10                                                         │
│                                                                   │
│ ── Site Parameters ──                                            │
│ Soil Type:  ○ Type I (Hard)  ● Type II (Medium)  ○ Type III   │
│ Importance Factor (I): [ 1.5 ▾]                                 │
│   1.0 — General    1.2 — Important    1.5 — Essential            │
│ Response Reduction (R): [ 5.0 ▾]                                │
│   3.0 — OMRF       5.0 — SMRF        4.0 — Braced              │
│                                                                   │
│ ── Building Data ──                                              │
│ ☑ Auto-detect from model                                        │
│ Number of storeys: [ 8 ]                                         │
│ Building height (H): [ 28.0 ] m                                 │
│ Structure type: [RC Moment Frame ▾]                              │
│ Fundamental period (T): [ 0.628 ] s  (auto: 0.075H^0.75)       │
│ ☐ Override with user-defined T                                   │
│                                                                   │
│ ── Design Spectrum ──                                            │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  Sa/g ↑                                                      │ │
│ │  2.5 ─│──────┐                                               │ │
│ │       │      │                                                │ │
│ │  2.0 ─│      │                                                │ │
│ │       │      │                                                │ │
│ │  1.5 ─│      ╲                                               │ │
│ │       │       ╲                                              │ │
│ │  1.0 ─│        ╲_____ ← T=0.628, Sa/g = 1.59               │ │
│ │       │              ╲____                                   │ │
│ │  0.5 ─│                    ╲____                             │ │
│ │       │                         ╲____                        │ │
│ │   0  ─┼────┬────┬────┬────┬────┬────┬─→ T(s)               │ │
│ │       0   0.5   1.0  1.5  2.0  2.5  3.0                     │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ── Calculated Values ──                                          │
│ Ah = (Z/2) × (I/R) × (Sa/g) = 0.05 × 0.30 × 1.59 = 0.0239   │
│ Base Shear Vb = Ah × W = 0.0239 × 12,450 = 297.6 kN           │
│                                                                   │
│ ── Storey Force Distribution ──                                  │
│ ┌───────┬───────────┬──────────┬───────────┬──────────────────┐ │
│ │ Floor │ Height(m) │ Wi (kN)  │ Wi×hi²    │ Qi (kN)          │ │
│ ├───────┼───────────┼──────────┼───────────┼──────────────────┤ │
│ │ 8 (R) │ 28.0      │ 1,200    │ 940,800   │ 89.2 ← max     │ │
│ │ 7     │ 24.5      │ 1,550    │ 930,938   │ 88.3            │ │
│ │ 6     │ 21.0      │ 1,550    │ 683,550   │ 64.8            │ │
│ │ 5     │ 17.5      │ 1,550    │ 474,688   │ 45.0            │ │
│ │ 4     │ 14.0      │ 1,550    │ 303,800   │ 28.8            │ │
│ │ 3     │ 10.5      │ 1,550    │ 170,888   │ 16.2            │ │
│ │ 2     │  7.0      │ 1,550    │  75,950   │  7.2            │ │
│ │ 1     │  3.5      │ 1,950    │  23,888   │  2.3            │ │
│ │       │           │ Σ=12,450 │           │ Σ Vb = 297.6    │ │
│ └───────┴───────────┴──────────┴───────────┴──────────────────┘ │
│                                                                   │
│ ── Directions ──                                                 │
│ ☑ Generate EQx (+X, -X)                                        │
│ ☑ Generate EQz (+Z, -Z)                                        │
│ ☐ Accidental eccentricity (5% of plan dimension)                │
│ ☐ Vertical seismic (2/3 × horizontal)                           │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│            [Cancel]     [Generate Seismic Load Cases]            │
└───────────────────────────────────────────────────────────────────┘
```

---

## 9.5 Wind Load Generator (IS 875-III)

```
┌───────────────────────────────────────────────────────────────────┐
│ Wind Load Generator — IS 875 Part 3:2015                   [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ── Basic Wind Speed ──                                           │
│ City/Region: [Mumbai, Maharashtra ▾]                             │
│ Vb = [ 44 ] m/s                                                 │
│ ┌──────────────────────────────────────┐                         │
│ │ India Wind Speed Map (SVG)          │                         │
│ │ ● Selected city highlighted          │                         │
│ │ Color-coded zones: 33, 39, 44, 47,  │                         │
│ │ 50, 55 m/s                           │                         │
│ └──────────────────────────────────────┘                         │
│                                                                   │
│ ── Modification Factors ──                                       │
│ Terrain Category: ● 1  ○ 2  ○ 3  ○ 4                          │
│ Risk Factor (k1):       [ 1.06 ] (Table 1, 50yr life)          │
│ Terrain Factor (k2):    [ auto  ] (varies with height)          │
│ Topography Factor (k3): [ 1.00 ]                                │
│ Importance Factor (k4): [ 1.00 ]                                │
│ Cyclonic Region:        ☐ Yes (k4 = 1.15)                      │
│                                                                   │
│ ── Building Parameters ──                                        │
│ Building Height: [ 28.0 ] m                                     │
│ Building Width (B): [ 15.0 ] m                                  │
│ Building Depth (D): [ 20.0 ] m                                  │
│                                                                   │
│ Exposure:                                                        │
│ ● Enclosed  ○ Partially Enclosed  ○ Open                       │
│                                                                   │
│ ── Pressure Coefficients ──                                      │
│ ● Use tabulated Cp values (Table 6)                             │
│ ○ Input custom Cp values                                        │
│                                                                   │
│ ── Height-wise Wind Pressure ──                                  │
│ ┌──────────┬──────────┬──────────┬──────────┐                   │
│ │ Height(m)│ k2       │ Vz(m/s)  │ pz(kN/m²)│                  │
│ ├──────────┼──────────┼──────────┼──────────┤                   │
│ │ 0 - 10   │ 0.80     │ 37.3     │ 0.835    │                   │
│ │ 10 - 15  │ 0.90     │ 42.0     │ 1.058    │                   │
│ │ 15 - 20  │ 0.95     │ 44.3     │ 1.177    │                   │
│ │ 20 - 30  │ 1.00     │ 46.6     │ 1.304    │                   │
│ └──────────┴──────────┴──────────┴──────────┘                   │
│                                                                   │
│ ── Direction ──                                                  │
│ ☑ +X direction    ☑ -X direction                                │
│ ☑ +Z direction    ☑ -Z direction                                │
│ ☐ Diagonal (45°)                                                │
│                                                                   │
│ Distribution:                                                    │
│ ● Auto-distribute to nodes (tributary area method)              │
│ ○ Apply as surface pressure to plates                           │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│              [Cancel]       [Generate Wind Load Cases]           │
└───────────────────────────────────────────────────────────────────┘
```

---

## 9.6 Load Display in Viewport

### Visual Summary
```
Load Visualization Styles:
──────────────────────────

Point Load:
  Single arrow, length proportional to magnitude
  Arrow color = load case color
  Label: "50 kN ↓" at arrow tip

UDL:
  Evenly spaced arrows with connecting line (trapezoid outline)
  Fill with 10% opacity load case color
  Label: "15 kN/m"

Triangular/Trapezoidal:
  Varying-length arrows with sloped connecting line
  Labels at start and end: "20 kN/m → 0"

Moment:
  Curved arrow (arc ~270°) with arrowhead
  Radius proportional to magnitude
  Label: "25 kN·m ↺"

Floor Load:
  Hatched region fill on floor panels
  Direction arrows showing distribution to beams
  Label: "3.0 kN/m²" centered

Self-Weight:
  Small downward arrow at member midpoint
  Dashed, lighter opacity
  Label: "SW" only (no value by default)

Temperature:
  Wavy line along member
  Label: "ΔT +30°C"

Moving Load:
  Animated dots along path (when active)
  Current position highlighted
  Envelope shown as shaded region

Color Legend (bottom-left):
  ■ DL  ■ LL  ■ WLx  ■ WLz  ■ EQx  ■ EQz  ■ TEMP

Scale Control (status bar):
  "Load Scale: [───●────] 1.0x"  (slider)
```

---

## 9.7 Load Table View

```
┌───────────────────────────────────────────────────────────────────────┐
│ Load Table                                          [Filter ▾] [✕]   │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ Load Case: [LC2: Live Load ▾]     [Show All Cases]                   │
│                                                                       │
│ ┌────┬──────┬──────────┬──────────┬──────────┬──────────┬──────────┐ │
│ │ #  │ Type │ Applied  │ Fx (kN)  │ Fy (kN)  │ Fz (kN)  │ Dir      │ │
│ │    │      │ To       │ Mx kN·m  │ My kN·m  │ Mz kN·m  │          │ │
│ ├────┼──────┼──────────┼──────────┼──────────┼──────────┼──────────┤ │
│ │ 1  │Point │ N3       │ 0        │ -50.0    │ 0        │ Global   │ │
│ │ 2  │Point │ N5       │ 0        │ -50.0    │ 0        │ Global   │ │
│ │ 3  │UDL   │ M1       │ 0        │ -15.0/m  │ 0        │ Global   │ │
│ │ 4  │UDL   │ M2       │ 0        │ -15.0/m  │ 0        │ Global   │ │
│ │ 5  │UDL   │ M3       │ 0        │ -15.0/m  │ 0        │ Global   │ │
│ │ 6  │Floor │ Panel-1  │ —        │ 3.0/m²   │ —        │ -Y       │ │
│ │ 7  │Floor │ Panel-2  │ —        │ 3.0/m²   │ —        │ -Y       │ │
│ │ 8  │Moment│ N7       │ 0        │ 0        │ 0 / 25.0 │ Global   │ │
│ └────┴──────┴──────────┴──────────┴──────────┴──────────┴──────────┘ │
│                                                                       │
│ [+ Add Load]  [Edit Selected]  [🗑 Delete]  [📋 Copy to LC...]     │
│                                                                       │
│ Summary:                                                             │
│ Total loads: 8  │  ΣFy = -196.0 kN  │  Self-weight: ✓ (142.6 kN)  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```
