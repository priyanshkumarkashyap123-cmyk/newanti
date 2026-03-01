# 15 — BIM Integration
## BeamLab Ultimate Figma Specification

---

## 15.1 BIM Integration Hub

```
┌───────────────────────────────────────────────────────────────────┐
│ BIM Integration Hub                                         [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ── Connected Platforms ──                                        │
│                                                                   │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│ │ 🏢 Revit    │ │ 🏗️ Tekla   │ │ 📐 AutoCAD │ │ 🟢 ETABS  │ │
│ │ ● Connected │ │ ○ Not setup │ │ ○ Not setup │ │ ○ Not setup│ │
│ │ Last sync:  │ │             │ │             │ │            │ │
│ │ 2 hrs ago   │ │ [Connect]   │ │ [Connect]   │ │ [Connect]  │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
│                                                                   │
│ ── IFC Import/Export ──                                         │
│                                                                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ IFC File Management                                          │ │
│ │                                                              │ │
│ │ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │ │
│ │ │ 📥 Import    │  │ 📤 Export    │  │ 🔄 Sync      │       │ │
│ │ │ IFC File     │  │ IFC File     │  │ Round-trip    │       │ │
│ │ └──────────────┘  └──────────────┘  └──────────────┘       │ │
│ │                                                              │ │
│ │ Supported: IFC2x3, IFC4, IFC4.3                             │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ── API Access ──                                                │
│                                                                   │
│ API Key: [sk-beam-••••••••••••••••] [Copy] [Regenerate]        │
│ Documentation: [View API Docs →]                                 │
│ Webhooks: 2 configured [Manage →]                               │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 15.2 IFC Import Dialog

```
┌───────────────────────────────────────────────────────────────────┐
│ Import IFC File                                             [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ File: [Building_Structural.ifc         ] [Browse...]            │
│ Size: 12.4 MB  │  Format: IFC4                                  │
│                                                                   │
│ ── Preview ──                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │                                                              │ │
│ │     [3D preview of IFC model rendered in viewport]          │ │
│ │                                                              │ │
│ │     Objects found:                                           │ │
│ │     • IfcColumn: 48                                          │ │
│ │     • IfcBeam: 96                                            │ │
│ │     • IfcSlab: 12                                            │ │
│ │     • IfcWall: 24                                            │ │
│ │     • IfcFooting: 16                                         │ │
│ │                                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ── Import Options ──                                            │
│                                                                   │
│ Elements to import:                                              │
│ ☑ Columns → Frame members (vertical)                           │
│ ☑ Beams → Frame members (horizontal)                           │
│ ☐ Slabs → Plate elements                                       │
│ ☐ Walls → Shell elements                                       │
│ ☐ Footings → Support annotations                               │
│                                                                   │
│ Mapping:                                                         │
│ ☑ Auto-map IFC sections to database                            │
│ ☑ Auto-map IFC materials to database                           │
│ ☑ Import levels/storeys                                        │
│ ☐ Import architectural elements (for reference)                 │
│                                                                   │
│ Coordinate System:                                               │
│ ● Use IFC origin                                                │
│ ○ Re-center to (0,0,0)                                         │
│ Units: [millimeters → meters ▾]                                │
│                                                                   │
│ ── Mapping Summary ──                                           │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ IFC Section         │ Mapped To          │ Status            │ │
│ ├──────────────────────┼────────────────────┼───────────────────┤ │
│ │ UC 305x305x137       │ → ISHB 300         │ ⚠️ Approximate  │ │
│ │ UB 457x191x67        │ → ISMB 450         │ ✅ Exact match  │ │
│ │ RHS 200x100x8        │ → Custom RHS       │ ✅ Imported     │ │
│ │ Concrete 400x400     │ → Rect 400×400     │ ✅ Created      │ │
│ └──────────────────────┴────────────────────┴───────────────────┘ │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│         [Cancel]    [Review Mapping]    [📥 Import Model]       │
└───────────────────────────────────────────────────────────────────┘
```

---

## 15.3 IFC Export Dialog

```
┌───────────────────────────────────────────────────────────────────┐
│ Export IFC                                                  [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ IFC Version: ● IFC4  ○ IFC2x3  ○ IFC4.3                       │
│ Schema: [Structural Analysis View ▾]                             │
│                                                                   │
│ Export Contents:                                                  │
│ ☑ Structural members (IfcStructuralCurveMember)                 │
│ ☑ Cross sections (IfcProfileDef)                                │
│ ☑ Materials (IfcMaterial)                                       │
│ ☑ Supports (IfcBoundaryCondition)                               │
│ ☑ Loads (IfcStructuralLoadGroup)                                │
│ ☑ Analysis results (IfcStructuralResultGroup)                   │
│ ☐ Design results (custom Pset)                                  │
│                                                                   │
│ Coordinate System:                                               │
│ ● Global coordinates                                            │
│ ○ Project coordinates (with offset)                             │
│ Units: [meters ▾]                                               │
│                                                                   │
│ File name: [Project_Structural_Export.ifc    ]                  │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│              [Cancel]            [📤 Export IFC File]           │
└───────────────────────────────────────────────────────────────────┘
```

---

## 15.4 Revit Sync Panel

```
┌───────────────────────────────────────────────────────────────────┐
│ Revit Sync                                                  [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Status: ● Connected to Revit 2024                               │
│ Project: Building_A.rvt                                          │
│ Last sync: 2 hours ago                                           │
│                                                                   │
│ ── Sync Direction ──                                            │
│                                                                   │
│ ┌──────────────────────┐     ┌──────────────────────┐           │
│ │     BeamLab          │ ←→  │      Revit           │           │
│ │                      │     │                      │           │
│ │  Nodes: 120          │     │  Analytical: 120     │           │
│ │  Members: 225        │     │  Elements: 230       │           │
│ │  Sections: 8 types   │     │  Families: 12        │           │
│ │  Loads: 7 cases      │     │  Load cases: 7       │           │
│ │  Results: ✅          │     │  Results: pending    │           │
│ └──────────────────────┘     └──────────────────────┘           │
│                                                                   │
│ ── Changes Since Last Sync ──                                   │
│                                                                   │
│ In Revit (to pull):                                             │
│ ⚪ 3 new columns added at grid E                                │
│ ⚪ 2 beams modified (section changed)                           │
│ ⚪ 1 storey height changed (L3: 3.3→3.5m)                     │
│                                                                   │
│ In BeamLab (to push):                                           │
│ ⚪ Analysis results updated                                     │
│ ⚪ 4 sections optimized                                         │
│ ⚪ RC reinforcement designed                                    │
│                                                                   │
│ Conflict: None detected                                          │
│                                                                   │
│ ── Sync Options ──                                              │
│ ☑ Update geometry changes                                       │
│ ☑ Update section changes                                        │
│ ☑ Push analysis results to Revit                                │
│ ☐ Push design results (reinforcement)                           │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│    [Pull from Revit]  [Push to Revit]  [🔄 Full Bi-directional]│
└───────────────────────────────────────────────────────────────────┘
```

---

## 15.5 STAAD.Pro File Import

```
┌───────────────────────────────────────────────────────────────────┐
│ Import STAAD.Pro File                                       [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ File: [Building_Frame.std           ] [Browse...]               │
│                                                                   │
│ ── Parsing Results ──                                           │
│ ✅ STAAD file parsed successfully                                │
│                                                                   │
│ Model contents:                                                  │
│ • Nodes: 84                                                      │
│ • Members: 148                                                   │
│ • Plates: 12                                                     │
│ • Supports: 16 (fixed)                                           │
│ • Load cases: 5                                                  │
│ • Load combinations: 12                                          │
│ • Sections: 6 unique                                             │
│ • Materials: 2 (steel, concrete)                                 │
│                                                                   │
│ ⚠️ Unsupported features (will be skipped):                     │
│   • PERFORM ANALYSIS P-DELTA → Use BeamLab P-Delta instead    │
│   • DEFINE WIND LOAD → Re-generate in BeamLab                 │
│                                                                   │
│ Import settings:                                                 │
│ ☑ Import geometry                                               │
│ ☑ Import sections & materials                                   │
│ ☑ Import supports                                               │
│ ☑ Import loads & combinations                                   │
│ ☐ Attempt to import analysis commands                           │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│            [Cancel]           [📥 Import STAAD File]            │
└───────────────────────────────────────────────────────────────────┘
```
