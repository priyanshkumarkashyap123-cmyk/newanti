# 13 — Reporting & Export
## BeamLab Ultimate Figma Specification

---

## 13.1 Report Builder

### Report Configuration Dialog
```
┌───────────────────────────────────────────────────────────────────────────┐
│ Generate Report                                                    [✕]   │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ Report Type:                                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │ 📊       │ │ 📋       │ │ 🧮       │ │ 📐       │ │ 📑       │      │
│ │ Full     │ │ Summary  │ │ Calc     │ │ Drawing  │ │ Custom   │      │
│ │ Analysis │ │ Report   │ │ Sheet    │ │ Package  │ │ Report   │      │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                                           │
│ ── Full Analysis Report Contents ──                                      │
│                                                                           │
│ ☑ 1. Cover Page (project info, engineer details, date)                  │
│ ☑ 2. Table of Contents                                                  │
│ ☑ 3. Project Summary                                                    │
│ ☑ 4. Design Codes & Standards Referenced                                │
│ ☑ 5. Geometry & Coordinates                                             │
│   ☑  5.1 Node coordinates table                                        │
│   ☑  5.2 Member connectivity table                                     │
│   ☑  5.3 3D model views (isometric, front, side, top)                  │
│ ☑ 6. Section & Material Properties                                      │
│   ☑  6.1 Section assignment table                                       │
│   ☑  6.2 Section properties (A, Ix, Iy, Zx, Zy)                       │
│   ☑  6.3 Material properties table                                      │
│ ☑ 7. Support Conditions                                                 │
│ ☑ 8. Loading                                                            │
│   ☑  8.1 Load case summary                                             │
│   ☑  8.2 Individual load details                                        │
│   ☑  8.3 Load combination table                                        │
│   ☑  8.4 Load diagrams (per case)                                      │
│ ☑ 9. Analysis Results                                                   │
│   ☑  9.1 Displacement summary                                          │
│   ☑  9.2 Member forces table (all combos)                              │
│   ☑  9.3 Reactions table                                                │
│   ☑  9.4 BMD diagrams                                                  │
│   ☑  9.5 SFD diagrams                                                  │
│   ☑  9.6  AFD diagrams                                                 │
│   ☑  9.7 Deformed shape plots                                          │
│ ☑ 10. Design Results                                                    │
│   ☑  10.1 Steel design summary                                         │
│   ☑  10.2 Detailed calculations per member                              │
│   ☑  10.3 Utilization ratio summary                                     │
│   ☑  10.4 RC design (if applicable)                                    │
│ ☐ 11. Connection Design (if performed)                                  │
│ ☐ 12. Foundation Design (if performed)                                  │
│ ☑ 13. Drift & Serviceability Checks                                    │
│ ☑ 14. Conclusion & Recommendations                                     │
│                                                                           │
│ ── Report Options ──                                                     │
│ Format: ● PDF  ○ DOCX  ○ HTML                                          │
│ Paper: [A4 ▾]   Orientation: ● Portrait  ○ Landscape                  │
│                                                                           │
│ Header:                                                                  │
│ Company Name: [Structural Consultants Pvt Ltd ]                         │
│ Company Logo: [Upload Logo ▾] [logo.png ✓]                             │
│ Project No:   [STR-2024-0042               ]                            │
│ Engineer:     [Er. Rakshit Tiwari           ]                            │
│ Checker:      [                             ]                            │
│ Revision:     [ Rev 0                       ]                            │
│                                                                           │
│ Estimated pages: ~85                                                     │
│                                                                           │
├───────────────────────────────────────────────────────────────────────────┤
│          [Cancel]     [Preview]     [📄 Generate Report]                │
└───────────────────────────────────────────────────────────────────────────┘
```

### Report Preview
```
┌───────────────────────────────────────────────────────────────────────────┐
│ Report Preview                               Page [3] of 85   [✕]       │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐  │
│ │                                                                     │  │
│ │  ┌──────────────────────────────────────────────────────────────┐   │  │
│ │  │ [Logo]  Structural Consultants Pvt Ltd    Project: STR-0042 │   │  │
│ │  └──────────────────────────────────────────────────────────────┘   │  │
│ │                                                                     │  │
│ │  3. PROJECT SUMMARY                                                │  │
│ │  ─────────────────                                                  │  │
│ │                                                                     │  │
│ │  Project Name: Multi-Storey Residential Building                   │  │
│ │  Location: Mumbai, Maharashtra                                      │  │
│ │  Structure Type: RC Moment Resisting Frame                         │  │
│ │  No. of Storeys: 8 + 1 Basement                                   │  │
│ │  Total Height: 28.0 m                                              │  │
│ │  Plan Dimensions: 15.0 m × 20.0 m                                 │  │
│ │                                                                     │  │
│ │  Design Codes:                                                      │  │
│ │  • IS 456:2000 — Plain & Reinforced Concrete                      │  │
│ │  • IS 800:2007 — General Construction in Steel                     │  │
│ │  • IS 875 Parts I-V — Code of Practice for Loads                  │  │
│ │  • IS 1893:2016 — Criteria for Earthquake Resistant Design        │  │
│ │  • IS 13920:2016 — Ductile Detailing of RC Structures            │  │
│ │                                                                     │  │
│ │  ┌──────────────────────────────────────────────────────────────┐   │  │
│ │  │ [3D Isometric View of Structure - rendered image]           │   │  │
│ │  │                                                              │   │  │
│ │  │         Figure 3.1: 3D Model — Isometric View              │   │  │
│ │  └──────────────────────────────────────────────────────────────┘   │  │
│ │                                                                     │  │
│ │  ┌──────────────────────────────────────────────────────────────┐   │  │
│ │  │ Page 3 of 85                              Rev 0 — Jan 2025 │   │  │
│ │  └──────────────────────────────────────────────────────────────┘   │  │
│ │                                                                     │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│ [◀ Prev]  [Next ▶]  [Jump to Section ▾]  [🖨 Print]  [💾 Download PDF] │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 13.2 Calculation Sheet

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Calculation Sheet — Member M12 Beam Design                      [✕]      │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐  │
│ │                                                                     │  │
│ │  CALCULATION SHEET                     Sheet 1 of 3                │  │
│ │  Project: STR-2024-0042                Date: 15-Jan-2025           │  │
│ │  Member: M12 — First Floor Beam B1     Designed by: RT             │  │
│ │  ──────────────────────────────────────────────────────────────    │  │
│ │                                                                     │  │
│ │  REF          CALCULATIONS                   OUTPUT               │  │
│ │  ─────        ─────────────                   ──────               │  │
│ │                                                                     │  │
│ │  IS 456       FLEXURAL DESIGN                                      │  │
│ │  Cl. 38.1                                                          │  │
│ │               b = 300 mm, D = 500 mm                               │  │
│ │               d = 500 - 25 - 8 - 10 = 457 mm                     │  │
│ │               fck = 25 MPa, fy = 500 MPa                          │  │
│ │                                                                     │  │
│ │  Annex G      Mu = 185.3 kN·m                                     │  │
│ │                                                                     │  │
│ │               Mu,lim = 0.138 × fck × b × d²                       │  │
│ │                     = 0.138 × 25 × 300 × 457²                     │  │
│ │                     = 216.3 kN·m                                   │  │
│ │                                                                     │  │
│ │               Since Mu < Mu,lim                                    │  │
│ │               → Singly Reinforced Section                ✓        │  │
│ │                                                                     │  │
│ │  Cl. 38.1     xu/d = 1 - √(1 - 4.598 × Mu/(fck×b×d²))          │  │
│ │                   = 1 - √(1 - 4.598 × 185.3×10⁶                  │  │
│ │                         /(25 × 300 × 457²))                        │  │
│ │                   = 0.362                                          │  │
│ │                                                                     │  │
│ │               Ast = 0.362 × fck × b × d / (0.87 × fy)            │  │
│ │                   = 0.362 × 25 × 300 × 457 / (0.87 × 500)        │  │
│ │                   = 2856 / 435                                     │  │
│ │                   = 1083 mm²                                       │  │
│ │                                                                     │  │
│ │               Provide 3-20φ + 1-16φ                               │  │
│ │               = 3×314.2 + 1×201.1                                  │  │
│ │               = 942.5 + 201.1 = 1143.6 mm²          Ast = 1144   │  │
│ │                                                mm² ✓              │  │
│ │  ──────────────────────────────────────────────────────────────    │  │
│ │                                                                     │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│ Style: Monospaced font (JetBrains Mono), A4 layout                      │
│ Three-column format: Reference | Calculations | Output                   │
│ Hand-calculation style familiar to structural engineers                  │
│                                                                           │
│ [← Previous Sheet]  [Next Sheet →]  [🖨 Print]  [💾 PDF]              │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 13.3 Export Options

### Export Dialog
```
┌───────────────────────────────────────────────────────────────────┐
│ Export                                                      [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ── File Formats ──                                               │
│                                                                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ 📄 PDF   │ │ 📐 DXF   │ │ 🏢 IFC   │ │ 📊 Excel │            │
│ │ Report   │ │ AutoCAD  │ │ BIM      │ │ Data     │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ 📋 CSV   │ │ 🖼️ Image│ │ 📦 JSON  │ │ 🔗 STAAD │            │
│ │ Tables   │ │ PNG/SVG  │ │ API      │ │ STD File │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                   │
│ ═══════════════════════════════════════════════════════          │
│                                                                   │
│ ── DXF Export Options ──                                        │
│                                                                   │
│ Content:                                                         │
│ ☑ Structural frame (center-line model)                          │
│ ☑ Section outlines (rendered cross-sections)                    │
│ ☑ Support symbols                                               │
│ ☑ Node numbers                                                  │
│ ☑ Member numbers                                                │
│ ☐ Load diagrams                                                 │
│ ☐ BMD/SFD diagrams                                              │
│ ☑ Dimensions                                                    │
│                                                                   │
│ Views:                                                           │
│ ☑ Plan view (XZ)                                                │
│ ☑ Front elevation (XY)                                          │
│ ☑ Side elevation (ZY)                                           │
│ ☑ 3D isometric                                                  │
│                                                                   │
│ Scale: [1:100 ▾]   Paper: [A1 ▾]                              │
│ Units in DXF: [mm ▾]                                            │
│                                                                   │
│ ── Excel Export Options ──                                      │
│                                                                   │
│ Sheets to include:                                               │
│ ☑ Node coordinates                                              │
│ ☑ Member connectivity                                           │
│ ☑ Section properties                                            │
│ ☑ Material properties                                           │
│ ☑ Load data                                                     │
│ ☑ Displacements (all nodes, all combos)                        │
│ ☑ Member forces (all members, all combos)                      │
│ ☑ Reactions                                                     │
│ ☑ Design results summary                                       │
│                                                                   │
│ ── Image Export Options ──                                      │
│                                                                   │
│ Format: ● PNG  ○ SVG  ○ JPEG                                   │
│ Resolution: [3840×2160 ▾] (4K)                                  │
│ Background: ● Transparent  ○ White  ○ Dark                     │
│ Include: ☑ Labels  ☑ Legend  ☑ Title Block                      │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│              [Cancel]           [💾 Export Selected]             │
└───────────────────────────────────────────────────────────────────┘
```

---

## 13.4 Print Preview / Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Print / Drawing Layout                                          [✕]      │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐  │
│ │ ┌──────────────────────────────────────────────────────────────┐   │  │
│ │ │                                                              │   │  │
│ │ │    ┌──────────── DRAWING AREA ────────────┐                 │   │  │
│ │ │    │                                       │                 │   │  │
│ │ │    │   [3D/2D View of Structure]           │                 │   │  │
│ │ │    │                                       │                 │   │  │
│ │ │    │                                       │                 │   │  │
│ │ │    │                                       │                 │   │  │
│ │ │    └───────────────────────────────────────┘                 │   │  │
│ │ │                                                              │   │  │
│ │ │    ┌─── TITLE BLOCK ───────────────────────────────────────┐│   │  │
│ │ │    │ Company: ____________  │ Project: ___________         ││   │  │
│ │ │    │ Drawing: ____________  │ Scale: 1:100                 ││   │  │
│ │ │    │ Drawn: RT  Checked: __ │ Date: 15-Jan-2025  Rev: 0   ││   │  │
│ │ │    └───────────────────────────────────────────────────────┘│   │  │
│ │ │                                                              │   │  │
│ │ └──────────────────────────────────────────────────────────────┘   │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│ Paper: [A1 ▾]  Scale: [1:100 ▾]  Orientation: [Landscape ▾]            │
│ View: [Front Elevation ▾]                                                │
│                                                                           │
│ [🖨 Print]  [💾 Save as PDF]  [📐 Save as DXF]                         │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```
