# STAAD Pro Features — Comprehensive Figma Design Specification

> **Version:** 1.0.0  
> **Date:** 2026-03-03  
> **Scope:** Complete modeling, design & analysis toolbar system, load panels, material/section assignment, analysis execution, and results post-processing.  
> **Framework:** React 18 + TypeScript + Tailwind CSS + Zustand + Lucide Icons + React Three Fiber  
> **Reference Files:** `ToolGroups.ts`, `ModelingToolbar.tsx`, `LoadDialog.tsx`, `MaterialLibraryDialog.tsx`, `SectionAssignDialog.tsx`, `PropertiesPanel.tsx`, `useAnalysisExecution.ts`, `memberLoadFEF.ts`, `diagramUtils.ts`, `structuralValidation.ts`, `model.ts`, `modelTypes.ts`

---

## Table of Contents

1. [Application Layout Overview](#1-application-layout-overview)
2. [Category Ribbon Bar](#2-category-ribbon-bar)
3. [Modeling Toolbar — Complete Reference](#3-modeling-toolbar)
4. [Properties Toolbar](#4-properties-toolbar)
5. [Loading Toolbar](#5-loading-toolbar)
6. [Analysis Toolbar](#6-analysis-toolbar)
7. [Design Toolbar](#7-design-toolbar)
8. [Keyboard Shortcuts Map](#8-keyboard-shortcuts-map)
9. [Load Dialog — 6-Tab Panel](#9-load-dialog)
10. [Material Library Dialog](#10-material-library-dialog)
11. [Section Assignment Dialog](#11-section-assignment-dialog)
12. [Properties Panel — Right Sidebar](#12-properties-panel)
13. [Analysis Execution Flow](#13-analysis-execution-flow)
14. [Structural Validation System](#14-structural-validation-system)
15. [Results & Post-Processing](#15-results-and-post-processing)
16. [Member Interface & Data Model](#16-member-interface-and-data-model)
17. [Store Actions Reference](#17-store-actions-reference)

**Appendixes:**
- [A — Color Tokens & Tailwind Classes](#appendix-a-color-tokens)
- [B — Icon Registry (Lucide)](#appendix-b-icon-registry)
- [C — Load Type Definitions](#appendix-c-load-type-definitions)
- [D — Material Database (All 27 Materials)](#appendix-d-material-database)
- [E — Section Database (All 38 Sections)](#appendix-e-section-database)
- [F — Solver Sign Conventions & FEF Formulas](#appendix-f-solver-conventions)
- [G — Unit System Reference](#appendix-g-unit-system)
- [H — Figma Component Hierarchy](#appendix-h-component-hierarchy)

---

## 1. Application Layout Overview

### 1.1 Global Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│  CATEGORY RIBBON BAR  (fixed top)                            │
│  [ Modeling | Properties | Loading | Analysis | Design ]     │
├──────────────────────────────────────────────────────────────┤
│  CONTEXT TOOLBAR  (below ribbon, changes per category)       │
│  [Quick Tools] │ [Group Dropdowns...]                        │
├────────────────────────────────────────────┬─────────────────┤
│                                            │  PROPERTIES     │
│                                            │  PANEL          │
│           3D VIEWPORT                      │  (Right Side)   │
│           (React Three Fiber)              │                 │
│                                            │  - Node Editor  │
│                                            │  - Member Editor│
│                                            │  - Load Editor  │
│                                            │  - Results View │
├────────────────────────────────────────────┴─────────────────┤
│  STATUS BAR  (fixed bottom)                                  │
│  [Selection Info] [Coordinates] [Analysis Status] [Units]    │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Global Container Styling

| Element | Tailwind Classes |
|---------|-----------------|
| App Background | `bg-slate-50 dark:bg-slate-950` |
| Ribbon Bar | `bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800` |
| Context Toolbar | `bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg border shadow-lg` |
| Properties Panel | `bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800` |
| Status Bar | `bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800` |
| Modal Overlay | `bg-black/50 backdrop-blur-sm` |
| Dialog Container | `bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700` |

### 1.3 Typography Scale

| Usage | Tailwind | Size | Weight |
|-------|----------|------|--------|
| Dialog Title | `text-xl font-semibold` | 20px | 600 |
| Section Header | `text-sm font-semibold` | 14px | 600 |
| Input Label | `text-xs text-slate-500 dark:text-slate-400` | 12px | 400 |
| Badge Text | `text-[10px] font-medium` | 10px | 500 |
| Body Text | `text-sm text-slate-700 dark:text-slate-300` | 14px | 400 |
| Value Display | `text-sm font-mono` | 14px | 400 |

---

## 2. Category Ribbon Bar

### 2.1 Structure

The ribbon bar contains 5 category buttons that switch the entire context toolbar:

```
[ MODELING ] [ PROPERTIES ] [ LOADING ] [ ANALYSIS ] [ DESIGN ]
```

### 2.2 Category Button States

| State | Tailwind Classes |
|-------|-----------------|
| Default | `px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md transition-colors` |
| Active | `bg-blue-600 text-white shadow-sm rounded-md` |
| Hover (inactive) | `bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white` |

### 2.3 Category → Tool Count Mapping

| Category | Tool Groups | Total Tools | Quick-Access Buttons |
|----------|-------------|-------------|---------------------|
| **MODELING** | 7 groups | 39 tools | 5 (Select, Node, Beam, Column, Delete) |
| **PROPERTIES** | — | 10 tools | — |
| **LOADING** | — | 12 tools | — |
| **ANALYSIS** | — | 6 tools | — |
| **DESIGN** | — | 3 tools | — |

---

## 3. Modeling Toolbar — Complete Reference

### 3.1 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [🔘][◎][—][⬇][🗑] │ Select▾ │ Draw▾ │ Edit▾ │ Array▾ │ Transform▾ │ Generate▾ │ Measure▾ │
│  Quick-Access Icons  │         Dropdown Groups (7)                                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Quick-Access Buttons (Icon-Only)

These 5 buttons are always visible, never hidden in dropdowns:

| # | Tool ID | Icon (Lucide) | Size | Tooltip | Shortcut |
|---|---------|---------------|------|---------|----------|
| 1 | `SELECT` | `MousePointer` | 18px | Select | Escape |
| 2 | `DRAW_NODE` | `CircleDot` | 18px | Draw Node | N |
| 3 | `DRAW_BEAM` | `Minus` | 18px | Draw Beam | B |
| 4 | `DRAW_COLUMN` | `ArrowDown` | 18px | Draw Column | V |
| 5 | `DELETE` | `Trash2` | 18px | Delete | Delete |

**Button Styling:**

| State | Tailwind Classes |
|-------|-----------------|
| Default | `p-2 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors` |
| Active | `bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500 rounded-md` |
| Separator | `w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1` |

### 3.3 Selection Group (4 tools)

| # | Tool ID | Label | Icon | Shortcut | Description |
|---|---------|-------|------|----------|-------------|
| 1 | `SELECT` | Select | `MousePointer` | Escape | Click to select nodes/members |
| 2 | `SELECT_RANGE` | Box Select | `Square` | Shift+S | Drag to box-select multiple entities |
| 3 | `PAN` | Pan | `Move` | — | Pan/orbit the 3D viewport |
| 4 | `ZOOM_WINDOW` | Zoom Window | `Maximize2` | Z | Zoom to fit a rectangle |

### 3.4 Draw Group (7 tools)

| # | Tool ID | Label | Icon | Shortcut | Description |
|---|---------|-------|------|----------|-------------|
| 1 | `DRAW_NODE` | Node | `CircleDot` | N | Place node at clicked position |
| 2 | `DRAW_BEAM` | Beam | `Minus` | B | Draw beam between two nodes |
| 3 | `DRAW_COLUMN` | Column | `ArrowDown` | V | Draw vertical column member |
| 4 | `DRAW_CABLE` | Cable | `Cable` | C | Draw cable element (tension-only) |
| 5 | `DRAW_ARCH` | Arch | `Spline` | A | Draw curved arch member |
| 6 | `DRAW_RIGID_LINK` | Rigid Link | `Link2` | — | Draw rigid constraint between nodes |
| 7 | `DRAW_PLATE` | Plate/Shell | `Square` | P | Draw 4-node plate/shell element |

### 3.5 Edit Group (7 tools)

| # | Tool ID | Label | Icon | Shortcut | Description |
|---|---------|-------|------|----------|-------------|
| 1 | `COPY` | Copy | `Copy` | Ctrl+C | Copy selected entities |
| 2 | `MIRROR` | Mirror | `FlipHorizontal2` | — | Mirror about an axis |
| 3 | `DELETE` | Delete | `Trash2` | Delete | Delete selected entities |
| 4 | `DIVIDE_MEMBER` | Divide | `Split` | — | Divide member into N equal parts |
| 5 | `SPLIT_MEMBER` | Split at Point | `Split` | — | Split member at specific location |
| 6 | `MERGE_NODES` | Merge Nodes | `Merge` | — | Merge coincident nodes |
| 7 | `ALIGN_NODES` | Align | `AlignLeft` | — | Align selected nodes along axis |

### 3.6 Array Group (3 tools)

| # | Tool ID | Label | Icon | Shortcut | Description |
|---|---------|-------|------|----------|-------------|
| 1 | `ARRAY_LINEAR` | Linear Array | `ArrowRight` | — | Repeat along a straight line |
| 2 | `ARRAY_POLAR` | Polar Array | `Circle` | — | Repeat around a center point |
| 3 | `ARRAY_3D` | 3D Array | `Box` | — | 3D grid repeat (X × Y × Z) |

### 3.7 Transform Group (5 tools)

| # | Tool ID | Label | Icon | Shortcut | Description |
|---|---------|-------|------|----------|-------------|
| 1 | `MOVE` | Move | `Move` | M | Translate selected entities |
| 2 | `ROTATE` | Rotate | `RotateCw` | R | Rotate about an axis |
| 3 | `SCALE` | Scale | `Maximize2` | S | Scale from a reference point |
| 4 | `OFFSET_MEMBER` | Offset | `Columns` | O | Create parallel offset member |
| 5 | `EXTRUDE` | Extrude | `CornerUpRight` | E | Extrude nodes/members into 3D |

### 3.8 Generate Group (11 tools)

All tools in this group have `isGenerator: true` — they open specialized dialogs.

| # | Tool ID | Label | Icon | Description |
|---|---------|-------|------|-------------|
| 1 | `GRID_GENERATE` | 2D Grid | `Grid` | Generate 2D bay grid |
| 2 | `GRID_3D` | 3D Grid | `Box` | Generate 3D frame grid |
| 3 | `CIRCULAR_GRID` | Circular Grid | `Circle` | Generate circular grid |
| 4 | `TRUSS_GENERATOR` | Truss | `Triangle` | Truss pattern generator |
| 5 | `ARCH_GENERATOR` | Arch | `Spline` | Parabolic/circular arch |
| 6 | `PIER_GENERATOR` | Pier | `Milestone` | Bridge pier generator |
| 7 | `TOWER_GENERATOR` | Tower | `Building` | Transmission tower |
| 8 | `DECK_GENERATOR` | Deck | `Layers` | Bridge deck system |
| 9 | `CABLE_PATTERN` | Cable Pattern | `Cable` | Cable-stayed pattern |
| 10 | `FRAME_GENERATOR` | Frame | `Building` | Multi-story frame |
| 11 | `STAIRCASE_GENERATOR` | Staircase | `ArrowDown` | Staircase elements |

### 3.9 Measure Group (3 tools)

| # | Tool ID | Label | Icon | Description |
|---|---------|-------|------|-------------|
| 1 | `MEASURE_DISTANCE` | Distance | `Ruler` | Measure distance between two points |
| 2 | `MEASURE_ANGLE` | Angle | `CornerUpRight` | Measure angle between members |
| 3 | `MEASURE_AREA` | Area | `Square` | Measure enclosed area |

### 3.10 Dropdown Group Component (`ToolGroupDropdown`)

**Trigger Button:**
```
┌────────────────────┐
│  [Icon] Label  [▾] │
└────────────────────┘
```

| Property | Value |
|----------|-------|
| Min Width | `min-w-[200px]` (dropdown menu) |
| Trigger Padding | `px-3 py-1.5` |
| Label Visibility | Hidden on small screens (`hidden sm:inline`) |
| Chevron | `ChevronDown` 14px, `ml-1` |
| Active Ring | `ring-2 ring-blue-500/50` when any tool in group is active |

**Dropdown Menu Item:**
```
┌──────────────────────────────────────┐
│  [Icon 16px]  Tool Label     [Ctrl+X]│
└──────────────────────────────────────┘
```

| State | Tailwind Classes |
|-------|-----------------|
| Default | `flex items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer` |
| Active | `bg-blue-600/10 text-blue-600 dark:text-blue-400 font-medium` |
| Shortcut Badge | `ml-auto text-xs text-slate-400 dark:text-slate-500 font-mono` |

---

## 4. Properties Toolbar

### 4.1 Tool List (10 tools)

| # | Tool ID | Label | Icon | Description |
|---|---------|-------|------|-------------|
| 1 | `ASSIGN_SECTION` | Section | `Hexagon` | Open Section Assignment Dialog |
| 2 | `ASSIGN_MATERIAL` | Material | `Box` | Open Material Library Dialog |
| 3 | `ASSIGN_RELEASE` | Releases | `Link2` | Set member end releases (hinges) |
| 4 | `ASSIGN_OFFSET` | Offset | `Columns` | Set rigid zone offsets |
| 5 | `ASSIGN_CABLE_PROPS` | Cable Props | `Cable` | Set cable element properties |
| 6 | `ASSIGN_SPRING` | Spring | `Zap` | Assign spring supports/elements |
| 7 | `ASSIGN_MASS` | Mass | `Weight` | Assign lumped/distributed mass |
| 8 | `MEMBER_ORIENTATION` | Orientation | `RotateCw` | Set beta angle (member roll) |
| 9 | `ASSIGN_SUPPORT` | Support | `ArrowDown` | Assign boundary conditions |
| 10 | `SECTION_BUILDER` | Section Builder | `Settings` | Custom section shape designer |

### 4.2 Material Assignment Requirement

**CRITICAL WORKFLOW:** Users MUST assign material properties to each member before running analysis. If not assigned:

- Default steel properties are silently applied: **E = 200 GPa, A = 100 cm², I = 10000 cm⁴**
- A prominent **WARNING** is shown during pre-analysis validation
- The warning message reads: *"Missing material/section assignment — N member(s) use default properties. Defaults: E=200 GPa (Steel), A=100 cm², I=10000 cm⁴. Assign materials and sections for accurate results."*
- Members with default properties are listed by ID in the warning

### 4.3 Material Assignment Flow

```
User selects members → Click "Material" tool → Material Library Dialog opens
  → Browse tab: Search/Filter 27 materials by Category/Standard
  → Custom tab: Enter custom E, G, ρ values
  → Click "Assign" → E, G, rho written to selected members
  → Properties Panel shows assigned material with E value
```

### 4.4 Section Assignment Flow

```
User selects members → Click "Section" tool → Section Assignment Dialog opens
  → Section Library tab: Filter by Standard (IS/AISC/Eurocode) and Shape
  → Custom Section tab: Enter Width, Depth → auto-compute A, Ix, Iy, J
  → Click "Assign" → sectionId, sectionType, A, I, Iy, J, dimensions written
  → Properties Panel shows section designation with A, I values
```

---

## 5. Loading Toolbar

### 5.1 Tool List (12 tools)

| # | Tool ID | Label | Icon | Shortcut | Description |
|---|---------|-------|------|----------|-------------|
| 1 | `ADD_POINT_LOAD` | Point Load | `ArrowDown` | F | Add concentrated force on member |
| 2 | `ADD_MOMENT` | Moment | `RotateCw` | — | Add concentrated moment on member |
| 3 | `ADD_UDL` | UDL | `Minus` | U | Add uniform distributed load |
| 4 | `ADD_TRAPEZOID` | Varying Load | `Triangle` | — | Add trapezoidal/triangular load |
| 5 | `ADD_WIND` | Wind Load | `Wind` | W | Add wind pressure load |
| 6 | `ADD_SEISMIC` | Seismic | `Zap` | — | Add seismic equivalent static load |
| 7 | `ADD_PRETENSION` | Pretension | `Cable` | — | Add pretension force to cable |
| 8 | `ADD_TEMPERATURE` | Temperature | `Thermometer` | T | Add thermal strain load |
| 9 | `ADD_MOVING_LOAD` | Moving Load | `Milestone` | — | Add moving load pattern |
| 10 | `ADD_HYDROSTATIC` | Hydrostatic | `Waves` | — | Add pressure varying with depth |
| 11 | `ADD_SELF_WEIGHT` | Self Weight | `Weight` | G | Add gravity self-weight load |
| 12 | `LOAD_COMBINATIONS` | Combinations | `Layers` | — | Open load combination manager |

---

## 6. Analysis Toolbar

### 6.1 Tool List (6 tools)

| # | Tool ID | Label | Icon | Shortcut | Description |
|---|---------|-------|------|----------|-------------|
| 1 | `RUN_ANALYSIS` | Run Analysis | `Play` | F5 | Execute structural analysis |
| 2 | `VIEW_DEFORMED` | Deformed Shape | `Eye` | — | Toggle deformed shape display |
| 3 | `VIEW_REACTIONS` | Reactions | `ArrowDown` | — | Show support reaction arrows |
| 4 | `VIEW_SFD` | Shear Diagram | `CornerUpRight` | — | Display Shear Force Diagrams |
| 5 | `VIEW_BMD` | Bending Diagram | `Spline` | — | Display Bending Moment Diagrams |
| 6 | `MODAL_ANALYSIS` | Modal Analysis | `Zap` | — | Run eigenvalue modal analysis |

### 6.2 Analysis Execution Button

```
┌───────────────────────────────┐
│  ▶  Run Analysis   [F5]      │
│  bg-emerald-600              │
│  hover:bg-emerald-500        │
│  text-white font-semibold    │
│  px-6 py-2 rounded-lg       │
│  shadow-lg shadow-emerald/25 │
└───────────────────────────────┘
```

| State | Appearance |
|-------|-----------|
| Ready | Green button, `▶ Run Analysis` |
| Running | Pulsing blue, `⏳ Analyzing...` with progress bar |
| Complete | Green checkmark, `✓ Complete` (2s then reset) |
| Failed | Red, `✗ Failed` with error message |

---

## 7. Design Toolbar

### 7.1 Tool List (3 tools)

| # | Tool ID | Label | Icon | Description |
|---|---------|-------|------|-------------|
| 1 | `STEEL_CHECK` | Steel Design | `Hammer` | IS 800 / AISC 360 steel member check |
| 2 | `CONCRETE_DESIGN` | Concrete Design | `Box` | IS 456 / ACI 318 RC design |
| 3 | `GENERATE_REPORT` | Generate Report | `FileText` | Export analysis/design report (PDF) |

---

## 8. Keyboard Shortcuts Map

### 8.1 Complete Shortcut Table

| Key | Tool | Category |
|-----|------|----------|
| `Escape` | SELECT | Modeling |
| `N` | DRAW_NODE | Modeling |
| `B` | DRAW_BEAM | Modeling |
| `V` | DRAW_COLUMN | Modeling |
| `C` | DRAW_CABLE | Modeling |
| `A` | DRAW_ARCH | Modeling |
| `P` | DRAW_PLATE | Modeling |
| `M` | MOVE | Modeling |
| `R` | ROTATE | Modeling |
| `S` | SCALE | Modeling |
| `O` | OFFSET_MEMBER | Modeling |
| `E` | EXTRUDE | Modeling |
| `D` | DELETE | Modeling |
| `Z` | ZOOM_WINDOW | Modeling |
| `Delete` | DELETE | Modeling |
| `Backspace` | DELETE | Modeling |
| `Shift+S` | SELECT_RANGE | Modeling |
| `Ctrl+C` | COPY | Modeling |
| `F` | ADD_POINT_LOAD | Loading |
| `U` | ADD_UDL | Loading |
| `W` | ADD_WIND | Loading |
| `T` | ADD_TEMPERATURE | Loading |
| `G` | ADD_SELF_WEIGHT | Loading |
| `F5` | RUN_ANALYSIS | Analysis |

### 8.2 Shortcut Badge Styling

```
┌─────┐
│ F5  │  text-xs font-mono text-slate-400 dark:text-slate-500
└─────┘  bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded
```

---

## 9. Load Dialog — 6-Tab Panel

### 9.1 Dialog Shell

| Property | Value |
|----------|-------|
| Title | "Load Manager" |
| Size | `max-w-4xl w-full max-h-[80vh]` |
| Icon | `ArrowDown` 20px, `text-blue-400` |
| Close Button | `X` icon, top-right |
| Background | `bg-white dark:bg-slate-900 rounded-xl shadow-2xl` |
| Overlay | `fixed inset-0 bg-black/50 backdrop-blur-sm z-50` |

### 9.2 Tab Bar

```
┌────────┬────────┬────────┬──────────┬──────────┬────────┐
│ Nodal  │ Member │ Floor  │ Thermal  │ Prestress│ Combos │
│ 🎯     │ ⬇      │ ▦      │ 🌡       │ 🔗      │ 📑    │
└────────┴────────┴────────┴──────────┴──────────┴────────┘
```

| Tab ID | Label | Icon (Lucide) | Icon Size | Color Class | Badge Info |
|--------|-------|---------------|-----------|-------------|------------|
| `nodal` | Nodal | `Target` | 16px | `text-blue-400` | Count of nodal loads |
| `member` | Member | `ArrowDown` | 16px | `text-green-400` | Count of member loads |
| `floor` | Floor | `Grid3X3` | 16px | `text-purple-400` | Count of floor loads |
| `temperature` | Thermal | `Thermometer` | 16px | `text-orange-400` | Count of temp loads |
| `prestress` | Prestress | `Cable` | 16px | `text-cyan-400` | Count of prestress loads |
| `combinations` | Combos | `Layers` | 16px | `text-yellow-400` | Count of combinations |

**Tab Button States:**

| State | Tailwind Classes |
|-------|-----------------|
| Default | `flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 border-b-2 border-transparent hover:text-slate-700 dark:hover:text-slate-300 transition-colors` |
| Active | `text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400` |

### 9.3 Load Case Selector

At the top of the dialog, before tabs:

```
┌─────────────────────────────────────────────────┐
│  Load Case:  [DEAD ▾]   [ + New Case ]          │
│                                                  │
│  Types: DEAD | LIVE | WIND | SEISMIC |           │
│         TEMPERATURE | PRESTRESS | IMPOSED        │
└─────────────────────────────────────────────────┘
```

| Load Case Type | Color Badge |
|---------------|-------------|
| DEAD | `bg-slate-600 text-white` |
| LIVE | `bg-blue-600 text-white` |
| WIND | `bg-cyan-600 text-white` |
| SEISMIC | `bg-red-600 text-white` |
| TEMPERATURE | `bg-orange-600 text-white` |
| PRESTRESS | `bg-purple-600 text-white` |
| IMPOSED | `bg-green-600 text-white` |

### 9.4 Tab 1 — Nodal Load Panel

**Header Bar:**
```
┌──────────────────────────────────────────────────┐
│  🎯  Nodal Loads                    [+ Add Load] │
│      Apply forces/moments at nodes               │
└──────────────────────────────────────────────────┘
```

**Add Load Button:** `bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-md`

**Load Card (per nodal load):**
```
┌──────────────────────────────────────────────────┐
│  🎯 Node: abc123de                    [🗑 Delete] │
├──────────────────────────────────────────────────┤
│  Fx (kN):  [ 0    ]   Fy (kN):  [ -10  ]        │
│  Fz (kN):  [ 0    ]   Mx (kN·m): [ 0   ]        │
│  My (kN·m): [ 0   ]   Mz (kN·m): [ 0   ]        │
└──────────────────────────────────────────────────┘
```

**Default Values:** `fx: 0, fy: -10, fz: 0, mx: 0, my: 0, mz: 0`

**Input Fields:** `type="number"`, `className="h-8"`, 3-column or 2-column grid depending on viewport.

Each input uses `value={load.fx}` (controlled) with `onChange` handler calling `onUpdate(load.id, { fx: parseFloat(e.target.value) || 0 })`.

### 9.5 Tab 2 — Member Load Panel

**Load Type Selector:**
```
┌──────────────────────────────────────────────────┐
│  ⬇  Member Loads                                 │
│  Type: [UDL ▾]  [UVL | Point | Moment]           │
│                                [+ Add to Selected]│
└──────────────────────────────────────────────────┘
```

**Member Load Card (`MemberLoadCard` Component):**

Renders differently based on `load.type`:

#### 9.5.1 UDL (Uniform Distributed Load)
```
┌──────────────────────────────────────────────────┐
│  ═══  Member: abc123de                [🗑]        │
│  Type: UDL (Uniform)                              │
├──────────────────────────────────────────────────┤
│  w (kN/m):     [ -10  ]                          │
│  Start (%):    [ 0    ]   End (%):    [ 1    ]   │
│  Direction:    [ global_y ▾ ]                     │
└──────────────────────────────────────────────────┘
```

#### 9.5.2 UVL (Uniform Varying / Trapezoidal Load)
```
┌──────────────────────────────────────────────────┐
│  △  Member: abc123de                  [🗑]        │
│  Type: UVL (Varying)                              │
├──────────────────────────────────────────────────┤
│  w₁ (kN/m):   [ -5   ]   w₂ (kN/m):  [ -15  ]  │
│  Start (%):    [ 0    ]   End (%):    [ 1    ]   │
│  Direction:    [ global_y ▾ ]                     │
└──────────────────────────────────────────────────┘
```

#### 9.5.3 Point Load
```
┌──────────────────────────────────────────────────┐
│  ⬇  Member: abc123de                  [🗑]       │
│  Type: Point Load                                 │
├──────────────────────────────────────────────────┤
│  P (kN):      [ -20  ]                           │
│  Position:    [ 0.5  ]  (0–1 ratio along member) │
│  Direction:   [ global_y ▾ ]                      │
└──────────────────────────────────────────────────┘
```

**Point Load Position Field — CRITICAL:**
- **Type:** `number`
- **Step:** `0.1`
- **Min:** `0` (start of member)
- **Max:** `1` (end of member)  
- **Default:** `0.5` (midpoint)
- **Interpretation:** `a = position × L` where L is member length
- The position ratio allows users to apply point loads at **any desired location** along the member
- Position `0.0` = at start node, `0.5` = midspan, `1.0` = at end node
- Any fractional value is valid: `0.25` = quarter point, `0.333` = third point, etc.

#### 9.5.4 Moment Load
```
┌──────────────────────────────────────────────────┐
│  ↻  Member: abc123de                  [🗑]       │
│  Type: Applied Moment                             │
├──────────────────────────────────────────────────┤
│  M (kN·m):    [ 10   ]                           │
│  Position:    [ 0.5  ]  (0–1 ratio along member) │
│  About Axis:  [ Z ▾ ]                             │
└──────────────────────────────────────────────────┘
```

**Direction Dropdown Options:**
| Value | Display Label |
|-------|--------------|
| `global_y` | Global Y (Vertical) |
| `global_x` | Global X |
| `global_z` | Global Z |
| `local_y` | Local Y (Perpendicular) |
| `local_x` | Local X (Axial) |
| `local_z` | Local Z |

### 9.6 Tab 3 — Floor Load Panel

```
┌──────────────────────────────────────────────────┐
│  ▦  Floor Loads                    [+ Add Floor] │
│      Pressure load distributed to beams          │
├──────────────────────────────────────────────────┤
│  Pressure (kN/m²): [ -5    ]                     │
│  Y Level (m):       [ 3    ]                     │
│  X Range: [ -∞   ] to [ ∞   ]                   │
│  Z Range: [ -∞   ] to [ ∞   ]                   │
│  Direction: [ global_y ▾ ]                        │
└──────────────────────────────────────────────────┘
```

**Default Values:** `pressure: -5, yLevel: 3, xMin: -Infinity, zMin: -Infinity, xMax: Infinity, zMax: Infinity`

**Floor Load Distribution Algorithm:**
1. Detect panels at the specified Y level bounded by X/Z ranges
2. Use tributary area method to distribute area pressure → beam UDLs
3. Generate `wasmMemberLoads` automatically during analysis

### 9.7 Tab 4 — Temperature Load Panel

```
┌──────────────────────────────────────────────────┐
│  🌡  Temperature Loads             [+ Add to Sel]│
│      ΔT causes axial strain: ε = α × ΔT         │
├──────────────────────────────────────────────────┤
│  🌡 Member: abc123de                              │
│  ΔT (°C):    [ 30   ]   α (×10⁻⁶/°C): [ 12  ]  │
│  Gradient ΔT (°C): [ 0   ]  (Optional)           │
└──────────────────────────────────────────────────┘
```

**Default Values:** `deltaT: 30, alpha: 12e-6, gradientT: 0`

**FIXED:** All inputs are now controlled (`value=` + `onChange=`) — previously used `defaultValue` which caused edits to not persist.

### 9.8 Tab 5 — Prestress Load Panel

```
┌──────────────────────────────────────────────────┐
│  🔗  Prestress Loads               [+ Add to Sel]│
│      Parabolic cable profile with equivalent loads│
├──────────────────────────────────────────────────┤
│  🔗 Member: abc123de                              │
│  Force P (kN): [ 1000 ]                          │
│  e_start (m):  [ 0    ]   e_mid (m):  [ 0.15 ]  │
│  e_end (m):    [ 0    ]                          │
│  ──────────────────────────────────               │
│  Eccentricity: +ve below centroid                 │
│  Equivalent UDL = 8Pe/L²                          │
└──────────────────────────────────────────────────┘
```

**Default Values:** `P: 1000, eStart: 0, eMid: 0.15, eEnd: 0`

**FIXED:** All inputs are now controlled (`value=` + `onChange=`) with proper update handlers.

### 9.9 Tab 6 — Load Combinations Panel

```
┌──────────────────────────────────────────────────┐
│  📑  Load Combinations          [+ Add Combo]    │
├──────────────────────────────────────────────────┤
│  COMBO_1: Custom combination                      │
│  ┌────────────────────────────────────────┐       │
│  │ DEAD:  [ 1.5 ]   LIVE:  [ 1.5 ]      │       │
│  └────────────────────────────────────────┘       │
└──────────────────────────────────────────────────┘
```

**Default Combinations (IS 875 / IS 456):**
| Combo Name | DEAD Factor | LIVE Factor |
|-----------|-------------|-------------|
| 1.5DL + 1.5LL | 1.5 | 1.5 |
| 1.2DL + 1.2LL | 1.2 | 1.2 |
| 1.5DL | 1.5 | 0 |
| 0.9DL | 0.9 | 0 |

---

## 10. Material Library Dialog

### 10.1 Dialog Shell

| Property | Value |
|----------|-------|
| Title | "Material Library" |
| Icon | `Layers` 20px, `text-amber-400` |
| Size | `max-w-3xl w-full max-h-[75vh]` |
| Tabs | "Browse" (Material Database) \| "Custom" (Custom Material) |

### 10.2 Browse Tab — Filter Controls

```
┌──────────────────────────────────────────────────┐
│  Search: [________________]                       │
│  Category: [All ▾]   Standard: [All ▾]            │
│            Steel      IS                          │
│            Concrete   ASTM                        │
│            Timber     EN                          │
│            Aluminum                               │
│            Masonry                                │
└──────────────────────────────────────────────────┘
```

### 10.3 Material Card

```
┌──────────────────────────────────────────────────┐
│  Fe 250                            [Select]       │
│  IS 2062 E250                                     │
│  ┌──────────────────────────────────────────┐     │
│  │ E: 200 GPa  │  G: 77 GPa  │  ρ: 7850   │     │
│  │ fy: 250 MPa │  fu: 410 MPa│  ν: 0.3    │     │
│  │ α: 12×10⁻⁶ /°C                          │     │
│  └──────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

### 10.4 Material Categories & Count

| Category | Standard | Count | Example Materials |
|----------|----------|-------|-------------------|
| Steel | IS | 4 | Fe 250, Fe 345, Fe 410, TMT Fe 500 |
| Steel | ASTM | 4 | A36, A572 Gr.50, A992, A500 Gr.B |
| Steel | EN | 3 | S235, S275, S355 |
| Concrete | IS | 5 | M20, M25, M30, M35, M40 |
| Concrete | ACI | 3 | f'c 3000 psi, f'c 4000 psi, f'c 5000 psi |
| Timber | IS/ASTM | 4 | Teak, Sal, Douglas Fir, Southern Pine |
| Aluminum | ASTM | 2 | 6061-T6, 6063-T5 |
| Masonry | IS | 1 | Brick (Class A) |
| **Total** | | **26** | |

### 10.5 Custom Material Tab

```
┌──────────────────────────────────────────────────┐
│  Custom Material                                  │
├──────────────────────────────────────────────────┤
│  Name:        [________________]                  │
│  E (kN/m²):   [ 200000000     ]                  │
│  G (kN/m²):   [ 77000000      ]                  │
│  ρ (kg/m³):   [ 7850          ]                   │
│                                                   │
│          [Assign to Selected Members]             │
└──────────────────────────────────────────────────┘
```

### 10.6 What Gets Assigned to Members

When a material is assigned, only these properties are written to the `Member` object:

| Member Field | Source | Example (Fe 250) |
|-------------|--------|-------------------|
| `E` | Material's E value | `200e6` (200,000,000 kN/m²) |
| `G` | Material's G value | `77e6` (77,000,000 kN/m²) |
| `rho` | Material's density | `7850` kg/m³ |

**Note:** `fy`, `fu`, `fck`, `nu`, `alpha` are displayed but NOT stored on the Member — they are used only for design checks.

---

## 11. Section Assignment Dialog

### 11.1 Dialog Shell

| Property | Value |
|----------|-------|
| Title | "Section Assignment" |
| Icon | `Hexagon` 20px, `text-cyan-400` |
| Size | `max-w-3xl w-full max-h-[75vh]` |
| Tabs | "Section Library" \| "Custom Section" |

### 11.2 Library Tab — Filter Controls

```
┌──────────────────────────────────────────────────┐
│  Standard: [IS ▾]   Shape: [All ▾]               │
│             AISC      I-Beam                      │
│             Eurocode  Channel                     │
│                       Angle                       │
│                       Tube                        │
│                       Pipe                        │
│  Search: [________________]                       │
└──────────────────────────────────────────────────┘
```

### 11.3 Section Card

```
┌──────────────────────────────────────────────────┐
│  ISMB 300                          [Assign]       │
│  I-Beam — IS Standard                             │
│  ┌──────────────────────────────────────────┐     │
│  │ A: 58.9 cm²   │  Ix: 8604 cm⁴           │     │
│  │ Iy: 454 cm⁴   │  J: 18 cm⁴              │     │
│  │ Depth: 300 mm  │  Width: 140 mm          │     │
│  └──────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

### 11.4 Section Libraries Summary

| Standard | I-Beam | Channel | Angle | Tube | Pipe | Total |
|----------|--------|---------|-------|------|------|-------|
| IS | 10 | 5 | 3 | — | — | **18** |
| AISC | 8 | — | — | 2 | 2 | **12** |
| Eurocode | 7 | 1 | — | — | — | **8** |
| **Total** | **25** | **6** | **3** | **2** | **2** | **38** |

### 11.5 Supported Section Shapes

| Shape ID | Display Name | Parameters |
|----------|-------------|------------|
| `rectangular` | Rectangle | Width, Depth |
| `circular` | Circle | Diameter |
| `i-beam` | I-Beam | Depth, Width, tw, tf |
| `channel` | Channel | Depth, Width, tw, tf |
| `angle` | Angle | Leg1, Leg2, thickness |
| `tube` | Tube (HSS) | Width, Depth, thickness |
| `pipe` | Pipe | Outer diameter, thickness |
| `tee` | T-Section | Depth, Width, tw, tf |

### 11.6 Custom Section Tab

```
┌──────────────────────────────────────────────────┐
│  Custom Section                                   │
├──────────────────────────────────────────────────┤
│  Shape: [Rectangular ▾]                           │
│                                                   │
│  Width (mm):   [ 300  ]   Depth (mm):  [ 500  ]  │
│  ──────────────────────────────────────────────   │
│  Computed:                                        │
│  A = 1500 cm²   Ix = 31250 cm⁴                   │
│  Iy = 11250 cm⁴  J = 26726 cm⁴                   │
│                                                   │
│          [Assign to Selected Members]             │
└──────────────────────────────────────────────────┘
```

### 11.7 What Gets Assigned to Members

| Member Field | Source | Example (ISMB 300) |
|-------------|--------|---------------------|
| `sectionId` | Section designation | `"ISMB 300"` |
| `sectionType` | Shape type | `"I-BEAM"` |
| `A` | Cross-section area (m²) | `58.9e-4` |
| `I` | Major axis MoI (m⁴) | `8603.6e-8` |
| `Iy` same as `Iz` | Minor axis MoI (m⁴) | `453.9e-8` |
| `J` | Torsion constant (m⁴) | `18.0e-8` |
| `dimensions` | Full dimension object | `{ height: 300, width: 140, ... }` |

---

## 12. Properties Panel — Right Sidebar

### 12.1 Panel States

| State | Trigger | Content |
|-------|---------|---------|
| Minimized | Panel collapsed | Collapsed button showing "Properties" with `Settings2` icon |
| No Selection | Nothing selected | "No selection" text + analysis status indicator |
| Single Node | One node selected | Full node editor (coords, supports, loads, results) |
| Single Member | One member selected | Full member editor (connectivity, section, material, loads, results) |
| Multi-Member | Multiple members only | Bulk edit mode (section, material, releases) |
| Multi-Mixed | Nodes + members | Count display + delete button |

### 12.2 Panel Container

```css
/* Panel sizing */
width: 320px;
max-height: 100vh;
overflow-y: auto;
/* Tailwind */
bg-white dark:bg-slate-900
border-l border-slate-200 dark:border-slate-800
p-4 space-y-4
```

### 12.3 Single Node Editor

#### Section: Node Badge
```
┌──────────────────────────────────────┐
│  ◎ Node abc123de                     │
│     text-blue-500                    │
└──────────────────────────────────────┘
```

#### Section: Coordinates (m)
| Icon | Color | Fields |
|------|-------|--------|
| `Crosshair` | `text-blue-400` | X, Y, Z — editable `NumberInput` |

```
┌──────────────────────────────────────┐
│  ✚ Coordinates (m)                   │
│  X: [ 0.000 ]  Y: [ 3.000 ]         │
│  Z: [ 0.000 ]                        │
└──────────────────────────────────────┘
```

#### Section: Boundary Conditions
| Icon | Color | Fields |
|------|-------|--------|
| `Lock` | `text-emerald-400` | Preset buttons + 6 DOF toggles |

```
┌──────────────────────────────────────┐
│  🔒 Boundary Conditions              │
│  [Fixed] [Pinned] [Roller] [Free]    │
│  ┌──────────────────────────────┐    │
│  │ Tx ☑  Ty ☑  Tz ☑            │    │
│  │ Rx ☑  Ry ☑  Rz ☑            │    │
│  └──────────────────────────────┘    │
│  Support: Fixed                      │
└──────────────────────────────────────┘
```

**Preset Definitions:**

| Preset | Tx | Ty | Tz | Rx | Ry | Rz |
|--------|----|----|----|----|----|----|
| Fixed | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pinned | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Roller | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Free | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

#### Section: Nodal Loads
| Icon | Color | Fields |
|------|-------|--------|
| `ArrowDown` | `text-yellow-400` | Load list + Add form |

```
┌──────────────────────────────────────┐
│  ⬇ Nodal Loads                       │
│  ┌────────────────────────────┐      │
│  │ Fy: -10 kN            [🗑] │      │
│  └────────────────────────────┘      │
│  ── Add Load ──                      │
│  Mode: [Simple ▾]  (Simple | Full)   │
│  Fy (kN): [ -10 ]  [+ Add]          │
└──────────────────────────────────────┘
```

#### Section: Analysis Results (post-analysis)
| Icon | Color | Fields |
|------|-------|--------|
| `Activity` | `text-emerald-400` | Displacements + Reactions |

```
┌──────────────────────────────────────┐
│  📊 Analysis Results                  │
│  Displacements:                       │
│    δx: 0.000 mm   δy: -2.345 mm     │
│    δz: 0.000 mm   θz: 0.001 rad     │
│  Reactions (at supports):             │
│    Rx: 0.00 kN    Ry: 15.00 kN      │
│    Rz: 0.00 kN    Mz: 5.00 kN·m     │
└──────────────────────────────────────┘
```

### 12.4 Single Member Editor

#### Section: Member Badge
```
┌──────────────────────────────────────┐
│  🔗 Member def456gh                  │
│     Beam (horizontal)    text-orange │
└──────────────────────────────────────┘
```

Type indicator: `Beam` (horizontal), `Column` (vertical), `Inclined` (angled).

#### Section: Connectivity
| Icon | Color | Fields |
|------|-------|--------|
| `Link2` | `text-blue-400` | Start/End node IDs with coords |

```
┌──────────────────────────────────────┐
│  🔗 Connectivity                      │
│  Start (I): node_1  (0, 0, 0)        │
│  End   (J): node_2  (6, 0, 0)        │
└──────────────────────────────────────┘
```

#### Section: Geometry
| Icon | Color | Fields |
|------|-------|--------|
| `Ruler` | `text-emerald-400` | Length, Angle |

```
┌──────────────────────────────────────┐
│  📏 Geometry                          │
│  Length: 6.000 m                      │
│  Angle:  0.0°                         │
└──────────────────────────────────────┘
```

#### Section: Section Category
| Icon | Color | Fields |
|------|-------|--------|
| `Ruler` | `text-cyan-400` | Category dropdown |

```
┌──────────────────────────────────────┐
│  📐 Section Category                  │
│  [ ISMB ▾ ]                           │
│  Options: ISMB, ISMC, ISLB, ISHB,    │
│           W, RCC-BEAM, RCC-COLUMN     │
└──────────────────────────────────────┘
```

#### Section: Section Properties
| Icon | Color | Fields |
|------|-------|--------|
| `Box` | `text-cyan-400` | Section dropdown + properties display |

```
┌──────────────────────────────────────┐
│  📦 Section                           │
│  [ ISMB 300 ▾ ]    or  [Custom]       │
│  A: 58.9 cm²    I: 8604 cm⁴          │
│  ── Custom Section ──                 │
│  Width (mm): [    ]  Depth (mm): [  ] │
│  Area (cm²): [    ]  Iy (cm⁴): [   ] │
└──────────────────────────────────────┘
```

#### Section: Beta Angle
| Icon | Color | Fields |
|------|-------|--------|
| `RotateCcw` | `text-amber-400` | Beta angle input |

```
┌──────────────────────────────────────┐
│  ↺ Beta Angle (deg)                  │
│  [ 0.0 ]                             │
└──────────────────────────────────────┘
```

#### Section: Material
| Icon | Color | Fields |
|------|-------|--------|
| `Layers` | `text-amber-400` | Material dropdown + E display |

```
┌──────────────────────────────────────┐
│  🔶 Material                          │
│  [ Fe 250 (Steel) ▾ ]   or [Custom]  │
│  E: 200 GPa                          │
│  ── Custom Material ──               │
│  E (kN/m²): [ 200000000 ]            │
└──────────────────────────────────────┘
```

**Material Dropdown Options:**
- Steel Fe 250  
- Steel Fe 345  
- Steel A36  
- Steel A992  
- Concrete M20  
- Concrete M25  
- Concrete M30  
- Custom...  

#### Section: Member End Releases
| Icon | Color | Fields |
|------|-------|--------|
| `Unlock` | `text-orange-400` | Start/End hinge toggles |

```
┌──────────────────────────────────────┐
│  🔓 Member End Releases               │
│  Start (I):  [Hinged ◉] [Fixed ○]    │
│  End   (J):  [Hinged ○] [Fixed ◉]    │
│  ──────────────────────────           │
│  Type: End Pinned                     │
└──────────────────────────────────────┘
```

| Release Indicator | Start | End | Description |
|-------------------|-------|-----|-------------|
| Rigid Frame | Fixed | Fixed | Full moment connection |
| Start Pinned | Hinged | Fixed | Pin at start node |
| End Pinned | Fixed | Hinged | Pin at end node |
| Truss | Hinged | Hinged | Both ends pinned |

#### Section: Member Loads (UDL)
| Icon | Color | Fields |
|------|-------|--------|
| `ArrowDown` | `text-purple-400` | Load list + Add form |

```
┌──────────────────────────────────────┐
│  ⬇ Member Loads                       │
│  ┌────────────────────────────┐      │
│  │ UDL: -10 kN/m  dir:Y  [🗑] │      │
│  └────────────────────────────┘      │
│  ── Add UDL ──                       │
│  w (kN/m): [ -10 ]                   │
│  Direction: [ global_y ▾ ]           │
│  Start (%): [ 0 ]  End (%): [ 1 ]   │
│  [ + Add Load ]                       │
└──────────────────────────────────────┘
```

#### Section: Member End Forces (post-analysis)
| Icon | Color | Fields |
|------|-------|--------|
| `Activity` | `text-emerald-400` | Axial, Shear, Moment |

```
┌──────────────────────────────────────┐
│  📊 Member End Forces                 │
│  Axial (N):   -5.23 kN  (C)          │
│  Shear Y:     12.50 kN               │
│  Shear Z:      0.00 kN               │
│  Moment:      15.75 kN·m             │
│  ──────────────────────────           │
│  Behavior: Beam-Column               │
└──────────────────────────────────────┘
```

### 12.5 Bulk Edit Mode (Multi-Member Selection)

```
┌──────────────────────────────────────┐
│  ⚡ Bulk Edit — 5 Members             │
├──────────────────────────────────────┤
│  Section Category: [ ISMB ▾ ]         │
│  Set Section:      [ ISMB 300 ▾ ]    │
│  Set Material:     [ Fe 250 ▾ ]      │
│  ──────────────────────────           │
│  Releases:                            │
│  Start: [ ] Hinged    End: [ ] Hinged│
│  ──────────────────────────           │
│  [ 🗑 Delete All Selected ]           │
└──────────────────────────────────────┘
```

---

## 13. Analysis Execution Flow

### 13.1 Pipeline Stages

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  VALIDATING  │──▶│  ASSEMBLING  │──▶│   SOLVING    │──▶│  COMPLETE   │
│  0-20%       │   │  20-40%      │   │  40-75%      │   │  75-100%   │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
```

### 13.2 Analysis Progress Modal

```
┌──────────────────────────────────────────────────┐
│           Structural Analysis                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 67%           │
│                                                   │
│  Stage: Solving with WASM engine...              │
│  ┌──────────────────────────────────┐             │
│  │ ✓ Validating structure           │             │
│  │ ✓ Assembling stiffness matrix    │             │
│  │ ⏳ Solving equations...           │             │
│  │ ○ Post-processing results        │             │
│  └──────────────────────────────────┘             │
│                                                   │
│  [Cancel Analysis]                                │
└──────────────────────────────────────────────────┘
```

| Stage | Icon | Status Color |
|-------|------|-------------|
| Validating | `CheckCircle` | `text-emerald-400` when done |
| Assembling | `CheckCircle` | `text-emerald-400` when done |
| Solving | `Loader2` (spinning) | `text-blue-400` when active |
| Complete | `CheckCircle` | `text-emerald-400` when done |

### 13.3 Solver Architecture (3-Tier Fallback)

```
┌──────────────────────────────────────────────────┐
│  Tier 1: Rust WASM Solver (client-side)          │
│  ├─ Full 3D 6-DOF frame analysis                │
│  ├─ Plate/shell elements                         │
│  ├─ P-Delta geometric nonlinearity              │
│  └─ Eigenvalue modal analysis                    │
├──────────────────────────────────────────────────┤
│  Tier 2: Enhanced Analysis Engine (TypeScript)    │
│  ├─ Fallback if WASM fails to load              │
│  ├─ DSM 2D/3D beam-column analysis              │
│  └─ No plate element support                     │
├──────────────────────────────────────────────────┤
│  Tier 3: Structural Solver Worker (Web Worker)   │
│  ├─ Last-resort fallback                         │
│  ├─ Basic 2D frame analysis only                │
│  └─ Limited to small models                      │
└──────────────────────────────────────────────────┘
```

### 13.4 Unit Conversion During Analysis

| Quantity | Store (UI) | Solver (WASM) | Conversion |
|----------|-----------|---------------|------------|
| Forces | kN | N | × 1000 |
| Moments | kN·m | N·m | × 1000 |
| Distances | m | m | No change |
| E, G | kN/m² | kN/m² | No change |
| Area | m² | m² | No change |
| Inertia | m⁴ | m⁴ | No change |
| Results (displacements) | m → mm | m | × 1000 display |

### 13.5 2D vs 3D Auto-Detection

```
const allZValues = nodesArray.map(n => n.z ?? 0);
const zRange = Math.max(...allZValues) - Math.min(...allZValues);
const is2DPlanar = zRange < 0.001; // Less than 1mm Z variation = 2D
```

If 2D: out-of-plane DOFs (Z-translation, X-rotation, Y-rotation) are automatically constrained for all nodes.

### 13.6 Point Load Processing Pipeline

1. **UI Input:** User sets `P` (kN), `position` (0–1 ratio), `direction` (6 options)
2. **Store:** Stored as `MemberLoad` with `type: "point", P, a: position, direction`
3. **Analysis Pre-processing:** Converted to equivalent nodal loads (FEF formulas)
   - `R1 = P·b²·(3a+b)/L³`, `R2 = P·a²·(a+3b)/L³`
   - `M1 = P·a·b²/L²`, `M2 = -P·a²·b/L²`
4. **Direction Handling:**
   - `global_y/x/z` → Forces applied directly in global DOFs
   - `local_y/local_z` → Forces computed in local, then transformed to global via `T^T` (rotation matrix transpose)
5. **Post-processing:** `memberLoadFEF.ts` computes local FEF correction subtracted from WASM member forces

### 13.7 Moment Load Processing Pipeline

1. **UI Input:** User sets `M` (kN·m), `position` (0–1), `direction/aboutAxis`
2. **FEF Formulas (matching Rust solver):**
   - `R1 = 6·M₀·a·b/L³` (positive shear at start)
   - `R2 = -6·M₀·a·b/L³` (negative shear at end)
   - `M1 = M₀·b·(2a−b)/L²`
   - `M2 = M₀·a·(2b−a)/L²`
3. **Direction Dispatch:**
   - `global_z` / default → shear in fy, moment in mz (primary bending)
   - `global_y` → shear in fz, moment in my (weak-axis bending)
   - `global_x` → torsion distribution: `Mx1 = Mo·b/L, Mx2 = Mo·a/L`
   - `local_y/local_z` → FEF in local coordinates → transformed to global via `T^T`

---

## 14. Structural Validation System

### 14.1 Pre-Analysis Validation Checks

| # | Check | Severity | Description |
|---|-------|----------|-------------|
| 1 | No nodes | `critical` | "No nodes defined" |
| 2 | No members | `critical` | "No members defined" |
| 3 | No supports | `error` | "No boundary conditions defined" |
| 4 | No loads | `warning` | "No loads applied" |
| 5 | Disconnected nodes | `warning` | "Orphan nodes detected" |
| 6 | Missing material/section | `warning` | Shows default E/I/A values used |
| 7 | Zero-length members | `error` | "Zero-length member detected" |
| 8 | Determinacy analysis | varies | Statically determinate/indeterminate check |
| 9 | Mechanism detection | `critical` | "Structure is a mechanism" |

### 14.2 Validation Result Display

```
┌──────────────────────────────────────────────────┐
│  ⚠ Pre-Analysis Warnings                         │
├──────────────────────────────────────────────────┤
│  ⚠ Missing material/section assignment            │
│    3 member(s) use default properties             │
│    (abc123, def456, ghi789)                       │
│    Defaults: E=200 GPa (Steel), A=100 cm²,       │
│    I=10000 cm⁴.                                   │
│    Assign materials and sections for accurate     │
│    results.                                       │
├──────────────────────────────────────────────────┤
│  ℹ Structure is statically indeterminate          │
│    (degree of indeterminacy: 3)                   │
├──────────────────────────────────────────────────┤
│  [Continue Anyway]  [Cancel]                      │
└──────────────────────────────────────────────────┘
```

| Severity | Icon | Color |
|----------|------|-------|
| `critical` | `XCircle` | `text-red-500 bg-red-50 dark:bg-red-950/30` |
| `error` | `AlertCircle` | `text-orange-500 bg-orange-50 dark:bg-orange-950/30` |
| `warning` | `AlertTriangle` | `text-yellow-500 bg-yellow-50 dark:bg-yellow-950/30` |

### 14.3 Validation Flow

```
User clicks "Run Analysis"
  → validateStructure() runs 9 checks
  → If critical/error: Block analysis, show errors
  → If warnings only: Show warnings with "Continue Anyway" button
  → If clean: Proceed to analysis immediately
```

---

## 15. Results & Post-Processing

### 15.1 Available Result Views

| Result Type | Tool | Icon | Description |
|-------------|------|------|-------------|
| Deformed Shape | `VIEW_DEFORMED` | `Eye` | Scaled displacement overlay |
| Support Reactions | `VIEW_REACTIONS` | `ArrowDown` | Reaction arrows at supports |
| Shear Force Diagram (SFD) | `VIEW_SFD` | `CornerUpRight` | V(x) along members |
| Bending Moment Diagram (BMD) | `VIEW_BMD` | `Spline` | M(x) along members |
| Axial Force Diagram (AFD) | — | — | N(x) along members |
| Stress Visualization | — | — | Color-mapped stress overlay |
| Deflected Shape | — | — | Numeric deflection values |

### 15.2 Diagram Generation

Each member gets diagrams with **51 evenly-spaced stations** plus discontinuity points at point load/moment positions:

```typescript
// Station generation
const stations = buildDiagramStations(L, loads, 51);
// Adds ±ε points at each point load/moment position for clean jumps
```

### 15.3 SFD/BMD Formulas

**Local coordinate system for diagrams:**

| Member Orientation | Local Y | Local Z | Reference |
|-------------------|---------|---------|-----------|
| Horizontal beam | Global −Y projected | Perpendicular | Standard cross product |
| Vertical column (up) | `[-1, 0, 0]` | Cross product | Matches Rust solver |
| Vertical column (down) | `[1, 0, 0]` | Cross product | Matches Rust solver |
| General inclined | `lz_temp × lx` | `lx × globalY` | Standard formulation |

**Free-body diagram formulas:**
```
V_y(x) = V1 + dVy          (shear in local-Y plane)
M_z(x) = -M1 + V1·x + dMz  (moment about local-Z = primary BMD)
V_z(x) = Vz1 + dVz         (shear in local-Z plane)
M_y(x) = My1 + Vz1·x + dMy (moment about local-Y = weak-axis BMD)
```

Where `dVy, dMz, dVz, dMy` are accumulated load effects from `accumulateLoadEffects()`.

### 15.4 Deflection Integration

```
EI·v″ = M(x)   →  Double integration via trapezoidal rule
  → First integrate M(x)/EI → slope θ(x)
  → Second integrate θ(x) → deflection v(x)
  → Apply boundary correction: v(0) = v_start, v(L) = v_end
```

### 15.5 Result Display Controls

```
┌──────────────────────────────────────────────────┐
│  📊 Results Display Controls                      │
│  ┌──────────────────────────────────┐             │
│  │ ☑ Deformed Shape     Scale: [10] │             │
│  │ ☑ SFD (Shear)                    │             │
│  │ ☑ BMD (Bending)                  │             │
│  │ ☐ AFD (Axial)                    │             │
│  │ ☐ BMD-My (Weak axis)            │             │
│  │ ☐ Shear-Z                       │             │
│  │ ☐ Stress Overlay                │             │
│  │ ──────────────────────           │             │
│  │ Diagram Scale: ━━━━●━━━ [1.0]   │             │
│  │ Displacement Scale: ━━━●━ [10]   │             │
│  └──────────────────────────────────┘             │
└──────────────────────────────────────────────────┘
```

---

## 16. Member Interface & Data Model

### 16.1 Complete Member Interface

```typescript
interface Member {
  id: string;
  startNodeId: string;
  endNodeId: string;

  // Section identification
  sectionId?: string;                // e.g. "ISMB 300", "Default"
  sectionType?: SectionType;         // 11 shape types

  // Section geometry for 3D rendering
  dimensions?: SectionDimensions;

  // Structural properties (stored in WASM-compatible units)
  E?: number;    // Young's Modulus (kN/m²)        Default: 200e6
  A?: number;    // Cross-sectional Area (m²)       Default: 0.01 (100 cm²)
  I?: number;    // Moment of Inertia, major (m⁴)   Default: 1e-4 (10000 cm⁴)
  Iy?: number;   // Moment of Inertia, minor (m⁴)
  Iz?: number;   // Moment of Inertia, z-axis (m⁴)
  J?: number;    // Torsion constant (m⁴)
  G?: number;    // Shear Modulus (kN/m²)
  rho?: number;  // Density (kg/m³)                  Default: 7850 (steel)

  // Member releases (hinges)
  releases?: {
    startMoment?: boolean;   // Legacy 2D
    endMoment?: boolean;     // Legacy 2D
    // Full 3D releases (12 DOFs at member ends)
    fxStart?: boolean; fyStart?: boolean; fzStart?: boolean;
    mxStart?: boolean; myStart?: boolean; mzStart?: boolean;
    fxEnd?: boolean;   fyEnd?: boolean;   fzEnd?: boolean;
    mxEnd?: boolean;   myEnd?: boolean;   mzEnd?: boolean;
  };

  // Rigid zone offsets
  startOffset?: { x: number; y: number; z: number };
  endOffset?: { x: number; y: number; z: number };

  // Member roll angle
  betaAngle?: number;  // degrees
}
```

### 16.2 Section Types (11 Values)

```typescript
type SectionType =
  | 'I-BEAM' | 'TUBE' | 'L-ANGLE' | 'RECTANGLE' | 'CIRCLE'
  | 'C-CHANNEL' | 'T-SECTION' | 'DOUBLE-ANGLE' | 'PIPE'
  | 'TAPERED' | 'BUILT-UP';
```

### 16.3 Node Interface

```typescript
interface Node {
  id: string;
  x: number;        // X coordinate (m)
  y: number;        // Y coordinate (m)
  z?: number;       // Z coordinate (m), default 0
  restraints?: Restraints;
}

interface Restraints {
  fx: boolean;   // Translation X
  fy: boolean;   // Translation Y
  fz: boolean;   // Translation Z
  mx: boolean;   // Rotation X
  my: boolean;   // Rotation Y
  mz: boolean;   // Rotation Z
}
```

### 16.4 Default Member Values (addMember)

| Property | Default Value | Description |
|----------|--------------|-------------|
| `E` | `200e6` (200,000,000 kN/m²) | Steel E |
| `A` | `0.01` (100 cm²) | Default area |
| `I` | `1e-4` (10,000 cm⁴) | Default MoI |
| `sectionId` | `"Default"` | No assigned section |
| `rho` | `7850` | Steel density |

---

## 17. Store Actions Reference

### 17.1 Node Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `addNode` | `(node: Node) → void` | Add single node |
| `removeNode` | `(id: string) → void` | Remove node + connected members |
| `updateNodePosition` | `(id, position) → void` | Move node |
| `updateNode` | `(id, updates) → void` | Partial update |
| `setNodeRestraints` | `(id, restraints) → void` | Set boundary conditions |
| `addNodes` | `(nodes: Node[]) → void` | Bulk add |
| `updateNodes` | `(updates: Map) → void` | Batch update |

### 17.2 Member Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `addMember` | `(member: Member) → void` | Add member with defaults |
| `removeMember` | `(id: string) → void` | Remove member |
| `updateMember` | `(id, updates) → void` | Update properties |
| `addMembers` | `(members: Member[]) → void` | Bulk add |
| `updateMembers` | `(updates: Map) → void` | Batch update |
| `splitMemberById` | `(id, ratio) → void` | Split at ratio |
| `mergeNodes` | `(nodeId1, nodeId2) → void` | Merge coincident |
| `renumberNodes` | `() → void` | Sequential renumber |
| `renumberMembers` | `() → void` | Sequential renumber |

### 17.3 Load Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `addLoad` | `(load: NodeLoad) → void` | Add nodal load |
| `removeLoad` | `(id: string) → void` | Remove nodal load |
| `addMemberLoad` | `(load: MemberLoad) → void` | Add member load |
| `removeMemberLoad` | `(id: string) → void` | Remove member load |
| `updateMemberLoadById` | `(id, updates) → void` | Update load properties |
| `addFloorLoad` | `(load: FloorLoad) → void` | Add floor load |
| `removeFloorLoad` | `(id: string) → void` | Remove floor load |
| `clearFloorLoads` | `() → void` | Remove all floor loads |

### 17.4 Load Case & Combination Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `addLoadCase` | `(lc: LoadCase) → void` | Add load case |
| `removeLoadCase` | `(id: string) → void` | Remove load case |
| `updateLoadCase` | `(id, updates) → void` | Update load case |
| `setActiveLoadCase` | `(id: string \| null) → void` | Switch active case |
| `addLoadCombination` | `(combo) → void` | Add combination |
| `removeLoadCombination` | `(id) → void` | Remove combination |
| `updateLoadCombination` | `(id, updates) → void` | Update factors |

### 17.5 Analysis & Results Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `setAnalysisResults` | `(results \| null) → void` | Store results |
| `setIsAnalyzing` | `(boolean) → void` | Set analyzing flag |
| `setErrorElementIds` | `(ids: string[]) → void` | Highlight errors |
| `clearErrorElementIds` | `() → void` | Clear error highlights |

### 17.6 Visualization Actions

| Action | Description |
|--------|-------------|
| `setDisplacementScale(scale)` | Deformed shape magnification |
| `setShowSFD(show)` | Toggle shear diagram |
| `setShowBMD(show)` | Toggle bending diagram |
| `setShowAFD(show)` | Toggle axial diagram |
| `setShowBMDMy(show)` | Toggle weak-axis BMD |
| `setShowShearZ(show)` | Toggle Z-direction shear |
| `setShowStressOverlay(show)` | Toggle stress colors |
| `setShowDeflectedShape(show)` | Toggle deflection display |
| `setDiagramScale(scale)` | Diagram amplitude scaling |
| `setShowResults(show)` | Master results toggle |

### 17.7 Selection Actions

| Action | Description |
|--------|-------------|
| `select(id, multi)` | Select entity (multi = add to selection) |
| `selectNode(id, multi?)` | Select specific node |
| `selectMember(id, multi?)` | Select specific member |
| `clearSelection()` | Deselect all |
| `selectAll()` | Select all entities |
| `invertSelection()` | Toggle selection |
| `selectMultiple(ids)` | Select multiple by IDs |
| `boxSelect(minX, minZ, maxX, maxZ)` | Rectangle selection |
| `selectByCoordinate(axis, min, max, add?)` | Select by coordinate range |
| `selectParallel(axis, add?)` | Select parallel members |
| `selectByProperty(property, value, add?)` | Select by section/material |

### 17.8 Model Management Actions

| Action | Description |
|--------|-------------|
| `clearModel()` | Reset entire model |
| `loadStructure(nodes, members)` | Import structure |
| `loadProject(data)` | Load saved project |
| `autoFixModel()` | Auto-fix disconnected members, orphan nodes |
| `setTool(tool)` | Set active tool (select/draw/load/etc.) |

---

## Appendix A — Color Tokens & Tailwind Classes

### A.1 Status Colors

| Status | Background | Text | Border |
|--------|-----------|------|--------|
| Success | `bg-emerald-50 dark:bg-emerald-950/30` | `text-emerald-600 dark:text-emerald-400` | `border-emerald-200 dark:border-emerald-800` |
| Warning | `bg-yellow-50 dark:bg-yellow-950/30` | `text-yellow-600 dark:text-yellow-400` | `border-yellow-200 dark:border-yellow-800` |
| Error | `bg-red-50 dark:bg-red-950/30` | `text-red-600 dark:text-red-400` | `border-red-200 dark:border-red-800` |
| Info | `bg-blue-50 dark:bg-blue-950/30` | `text-blue-600 dark:text-blue-400` | `border-blue-200 dark:border-blue-800` |

### A.2 Tool Category Accent Colors

| Category | Primary | Active BG | Text |
|----------|---------|----------|------|
| Modeling | Blue | `bg-blue-600/20` | `text-blue-600 dark:text-blue-400` |
| Properties | Cyan | `bg-cyan-600/20` | `text-cyan-600 dark:text-cyan-400` |
| Loading | Green | `bg-green-600/20` | `text-green-600 dark:text-green-400` |
| Analysis | Emerald | `bg-emerald-600/20` | `text-emerald-600 dark:text-emerald-400` |
| Design | Amber | `bg-amber-600/20` | `text-amber-600 dark:text-amber-400` |

### A.3 Load Tab Colors

| Tab | Icon Color | Active Border |
|-----|-----------|---------------|
| Nodal | `text-blue-400` | `border-blue-600` |
| Member | `text-green-400` | `border-green-600` |
| Floor | `text-purple-400` | `border-purple-600` |
| Thermal | `text-orange-400` | `border-orange-600` |
| Prestress | `text-cyan-400` | `border-cyan-600` |
| Combos | `text-yellow-400` | `border-yellow-600` |

### A.4 Material Category Colors

| Category | Badge Color |
|----------|------------|
| Steel | `bg-slate-700 text-white` |
| Concrete | `bg-stone-600 text-white` |
| Timber | `bg-amber-700 text-white` |
| Aluminum | `bg-zinc-500 text-white` |
| Masonry | `bg-orange-800 text-white` |

---

## Appendix B — Icon Registry (Lucide)

### B.1 Complete Icon Usage Map

| Lucide Icon | Size | Usage |
|-------------|------|-------|
| `MousePointer` | 18px | SELECT tool |
| `CircleDot` | 18px | DRAW_NODE tool, node badge |
| `Minus` | 18px | DRAW_BEAM tool, UDL |
| `ArrowDown` | 18px | DRAW_COLUMN, Point Load, Reactions |
| `Trash2` | 18px | DELETE tool |
| `Square` | 18px | BOX_SELECT, DRAW_PLATE, MEASURE_AREA |
| `Move` | 18px | PAN, MOVE tools |
| `Maximize2` | 18px | ZOOM_WINDOW, SCALE |
| `Cable` | 18px | DRAW_CABLE, Cable Props, Prestress |
| `Spline` | 18px | DRAW_ARCH, ARCH_GENERATOR, BMD |
| `Link2` | 18px | RIGID_LINK, RELEASES, Connectivity |
| `Copy` | 16px | COPY |
| `FlipHorizontal2` | 16px | MIRROR |
| `Split` | 16px | DIVIDE, SPLIT |
| `Merge` | 16px | MERGE_NODES |
| `AlignLeft` | 16px | ALIGN |
| `ArrowRight` | 16px | LINEAR_ARRAY |
| `Circle` | 16px | POLAR_ARRAY, CIRCULAR_GRID |
| `Box` | 16px | 3D_ARRAY, Material, CONCRETE_DESIGN |
| `RotateCw` | 16px | ROTATE, Moment, Orientation |
| `Columns` | 16px | OFFSET |
| `CornerUpRight` | 16px | EXTRUDE, SFD, MEASURE_ANGLE |
| `Grid` | 16px | 2D_GRID |
| `Triangle` | 16px | TRUSS, Trapezoid Load |
| `Milestone` | 16px | PIER, Moving Load |
| `Building` | 16px | TOWER, FRAME generators |
| `Layers` | 16px | DECK, Combinations, Material |
| `Ruler` | 16px | MEASURE_DISTANCE, Geometry |
| `Hexagon` | 16px | ASSIGN_SECTION |
| `Zap` | 16px | SPRING, SEISMIC, MODAL |
| `Weight` | 16px | MASS, Self Weight |
| `Settings` | 16px | SECTION_BUILDER |
| `Play` | 16px | RUN_ANALYSIS |
| `Eye` | 16px | VIEW_DEFORMED |
| `Hammer` | 16px | STEEL_CHECK |
| `FileText` | 16px | GENERATE_REPORT |
| `Wind` | 16px | WIND_LOAD |
| `Thermometer` | 16px | TEMPERATURE |
| `Waves` | 16px | HYDROSTATIC |
| `Target` | 16px | Nodal loads tab |
| `Grid3X3` | 16px | Floor loads tab |
| `ChevronDown` | 14px | Dropdown triggers |
| `X` | 16px | Dialog close button |
| `Plus` | 16px | Add buttons |
| `Crosshair` | 16px | Coordinates section |
| `Lock` | 16px | Boundary conditions |
| `Unlock` | 16px | Member releases |
| `Activity` | 16px | Analysis results |
| `Settings2` | 16px | Properties panel |
| `RotateCcw` | 16px | Beta angle |
| `CheckCircle` | 16px | Progress completed stage |
| `Loader2` | 16px | Progress active stage (spinning) |
| `XCircle` | 16px | Critical error |
| `AlertCircle` | 16px | Error |
| `AlertTriangle` | 16px | Warning |

---

## Appendix C — Load Type Definitions

### C.1 Nodal Load

```typescript
interface NodalLoad {
  id: string;
  nodeId: string;
  fx: number;    // Force X (kN)
  fy: number;    // Force Y (kN)
  fz: number;    // Force Z (kN)
  mx: number;    // Moment X (kN·m)
  my: number;    // Moment Y (kN·m)
  mz: number;    // Moment Z (kN·m)
}
```

### C.2 Member Load (Union Type)

```typescript
type MemberLoad = {
  id: string;
  memberId: string;
  type: 'UDL' | 'UVL' | 'point' | 'moment';
  direction: LoadDirection;
  // UDL fields
  w?: number;          // Uniform intensity (kN/m)
  startPos?: number;   // Start position (0–1 ratio)
  endPos?: number;     // End position (0–1 ratio)
  isProjected?: boolean;
  // UVL fields
  w1?: number;         // Start intensity (kN/m)
  w2?: number;         // End intensity (kN/m)
  // Point load fields
  P?: number;          // Point force (kN)
  a?: number;          // Position (0–1 ratio)
  // Moment fields
  M?: number;          // Moment magnitude (kN·m)
  aboutAxis?: 'x' | 'y' | 'z';
};
```

### C.3 Floor Load

```typescript
interface FloorLoad {
  id: string;
  pressure: number;      // Area pressure (kN/m²)
  yLevel: number;        // Y-coordinate of floor (m)
  direction: LoadDirection;
  xMin: number;          // Bounding box
  xMax: number;
  zMin: number;
  zMax: number;
}
```

### C.4 Temperature Load

```typescript
interface TemperatureLoad {
  id: string;
  memberId: string;
  deltaT: number;        // Temperature change (°C)
  alpha: number;         // Coefficient of thermal expansion (/°C)
  gradientT?: number;    // Temperature gradient (°C), optional
}
```

### C.5 Prestress Load

```typescript
interface PrestressLoad {
  id: string;
  memberId: string;
  P: number;             // Prestress force (kN)
  eStart: number;        // Eccentricity at start (m)
  eMid: number;          // Eccentricity at mid-span (m)
  eEnd: number;          // Eccentricity at end (m)
}
```

### C.6 Load Direction Enum

```typescript
type LoadDirection =
  | 'global_y'   // Vertical (most common)
  | 'global_x'   // Horizontal X
  | 'global_z'   // Horizontal Z
  | 'local_y'    // Perpendicular to member (local Y)
  | 'local_x'    // Along member axis
  | 'local_z';   // Local Z axis
```

### C.7 Load Combination

```typescript
interface LoadCombination {
  name: string;           // e.g. "1.5DL + 1.5LL"
  description: string;
  factors: Record<string, number>;  // { DEAD: 1.5, LIVE: 1.5 }
}
```

---

## Appendix D — Material Database (All 27 Materials)

### D.1 Steel — IS Standard (4)

| # | Name | Grade | E (kN/m²) | G (kN/m²) | fy (kN/m²) | fu (kN/m²) | ρ (kg/m³) | ν | α (/°C) |
|---|------|-------|-----------|-----------|-----------|-----------|-----------|-----|---------|
| 1 | Fe 250 | IS 2062 E250 | 2×10⁸ | 7.7×10⁷ | 250,000 | 410,000 | 7,850 | 0.3 | 12×10⁻⁶ |
| 2 | Fe 345 | IS 2062 E350 | 2×10⁸ | 7.7×10⁷ | 345,000 | 490,000 | 7,850 | 0.3 | 12×10⁻⁶ |
| 3 | Fe 410 | IS 2062 E410 | 2×10⁸ | 7.7×10⁷ | 410,000 | 540,000 | 7,850 | 0.3 | 12×10⁻⁶ |
| 4 | TMT Fe 500 | IS 1786 Fe500 | 2×10⁸ | 7.7×10⁷ | 500,000 | 545,000 | 7,850 | 0.3 | 12×10⁻⁶ |

### D.2 Steel — ASTM (4)

| # | Name | Grade | E | G | fy | fu | ρ | ν | α |
|---|------|-------|---|---|----|----|---|---|---|
| 5 | A36 | ASTM A36 | 2×10⁸ | 7.7×10⁷ | 250,000 | 400,000 | 7,850 | 0.3 | 12×10⁻⁶ |
| 6 | A572 Gr.50 | ASTM A572 | 2×10⁸ | 7.7×10⁷ | 345,000 | 450,000 | 7,850 | 0.3 | 12×10⁻⁶ |
| 7 | A992 | ASTM A992 | 2×10⁸ | 7.7×10⁷ | 345,000 | 450,000 | 7,850 | 0.3 | 12×10⁻⁶ |
| 8 | A500 Gr.B | ASTM A500 | 2×10⁸ | 7.7×10⁷ | 290,000 | 400,000 | 7,850 | 0.3 | 12×10⁻⁶ |

### D.3 Steel — Eurocode (3)

| # | Name | Grade | E | G | fy | fu | ρ | ν | α |
|---|------|-------|---|---|----|----|---|---|---|
| 9 | S235 | EN 10025 S235 | 2.1×10⁸ | 8.1×10⁷ | 235,000 | 360,000 | 7,850 | 0.3 | 12×10⁻⁶ |
| 10 | S275 | EN 10025 S275 | 2.1×10⁸ | 8.1×10⁷ | 275,000 | 430,000 | 7,850 | 0.3 | 12×10⁻⁶ |
| 11 | S355 | EN 10025 S355 | 2.1×10⁸ | 8.1×10⁷ | 355,000 | 510,000 | 7,850 | 0.3 | 12×10⁻⁶ |

### D.4 Concrete — IS 456 (5)

| # | Name | Grade | E | G | fck | ρ | ν | α |
|---|------|-------|---|---|-----|---|---|---|
| 12 | M20 | IS 456 M20 | 2.24×10⁷ | 9.3×10⁶ | 20,000 | 2,500 | 0.2 | 10×10⁻⁶ |
| 13 | M25 | IS 456 M25 | 2.5×10⁷ | 1.04×10⁷ | 25,000 | 2,500 | 0.2 | 10×10⁻⁶ |
| 14 | M30 | IS 456 M30 | 2.74×10⁷ | 1.14×10⁷ | 30,000 | 2,500 | 0.2 | 10×10⁻⁶ |
| 15 | M35 | IS 456 M35 | 2.96×10⁷ | 1.23×10⁷ | 35,000 | 2,500 | 0.2 | 10×10⁻⁶ |
| 16 | M40 | IS 456 M40 | 3.16×10⁷ | 1.32×10⁷ | 40,000 | 2,500 | 0.2 | 10×10⁻⁶ |

### D.5 Concrete — ACI 318 (3)

| # | Name | Grade | E | G | fck | ρ | ν | α |
|---|------|-------|---|---|-----|---|---|---|
| 17 | f'c 3000 psi | ACI 318 | 2.06×10⁷ | 8.6×10⁶ | 20,684 | 2,400 | 0.2 | 10×10⁻⁶ |
| 18 | f'c 4000 psi | ACI 318 | 2.38×10⁷ | 9.9×10⁶ | 27,579 | 2,400 | 0.2 | 10×10⁻⁶ |
| 19 | f'c 5000 psi | ACI 318 | 2.66×10⁷ | 1.11×10⁷ | 34,474 | 2,400 | 0.2 | 10×10⁻⁶ |

### D.6 Timber (4)

| # | Name | Standard | E | G | fy | ρ | ν | α |
|---|------|----------|---|---|----|----|---|---|
| 20 | Teak (Group A) | IS 883 | 1.26×10⁷ | 6.3×10⁵ | 14,000 | 660 | 0.3 | 5×10⁻⁶ |
| 21 | Sal (Group A) | IS 883 | 1.26×10⁷ | 6.3×10⁵ | 14,000 | 870 | 0.3 | 5×10⁻⁶ |
| 22 | Douglas Fir | NDS | 1.2×10⁷ | 7.5×10⁵ | 6,900 | 500 | 0.3 | 5×10⁻⁶ |
| 23 | Southern Pine | NDS | 1.1×10⁷ | 6.9×10⁵ | 5,500 | 560 | 0.3 | 5×10⁻⁶ |

### D.7 Aluminum (2)

| # | Name | Grade | E | G | fy | fu | ρ | ν | α |
|---|------|-------|---|---|----|----|---|---|---|
| 24 | 6061-T6 | ASTM B308 | 6.9×10⁷ | 2.6×10⁷ | 276,000 | 310,000 | 2,700 | 0.33 | 23.6×10⁻⁶ |
| 25 | 6063-T5 | ASTM B221 | 6.9×10⁷ | 2.6×10⁷ | 186,000 | 207,000 | 2,700 | 0.33 | 23.6×10⁻⁶ |

### D.8 Masonry (1)

| # | Name | Grade | E | G | fck | ρ | ν | α |
|---|------|-------|---|---|-----|---|---|---|
| 26 | Brick (Class A) | IS 1905 | 5.5×10⁶ | 2.2×10⁶ | 10,000 | 1,920 | 0.25 | 6×10⁻⁶ |

---

## Appendix E — Section Database (All 38 Sections)

### E.1 IS Standard — I-Beams (10)

| # | Designation | A (m²) | Ix (m⁴) | Iy (m⁴) | J (m⁴) | Depth (mm) | Width (mm) |
|---|-------------|---------|----------|----------|---------|------------|------------|
| 1 | ISMB 100 | 11.4e-4 | 257.5e-8 | 40.8e-8 | 1.1e-8 | 100 | 75 |
| 2 | ISMB 150 | 19.0e-4 | 726.4e-8 | 52.6e-8 | 2.1e-8 | 150 | 80 |
| 3 | ISMB 200 | 32.3e-4 | 2235.4e-8 | 150.0e-8 | 7.0e-8 | 200 | 100 |
| 4 | ISMB 250 | 47.6e-4 | 5131.6e-8 | 334.5e-8 | 14.0e-8 | 250 | 125 |
| 5 | ISMB 300 | 58.9e-4 | 8603.6e-8 | 453.9e-8 | 18.0e-8 | 300 | 140 |
| 6 | ISMB 350 | 66.7e-4 | 13158.3e-8 | 537.7e-8 | 21.0e-8 | 350 | 140 |
| 7 | ISMB 400 | 78.5e-4 | 20458.4e-8 | 622.1e-8 | 26.0e-8 | 400 | 140 |
| 8 | ISMB 450 | 92.3e-4 | 30390.8e-8 | 834.0e-8 | 34.0e-8 | 450 | 150 |
| 9 | ISMB 500 | 110.7e-4 | 45218.3e-8 | 1369.8e-8 | 48.0e-8 | 500 | 180 |
| 10 | ISMB 600 | 156.2e-4 | 91813.0e-8 | 3060.0e-8 | 98.0e-8 | 600 | 210 |

### E.2 IS Standard — Channels (5)

| # | Designation | A (m²) | Ix (m⁴) | Iy (m⁴) | J (m⁴) | Depth | Width |
|---|-------------|---------|----------|----------|---------|-------|-------|
| 11 | ISMC 100 | 11.7e-4 | 186.7e-8 | 25.7e-8 | 1.1e-8 | 100 | 50 |
| 12 | ISMC 150 | 20.9e-4 | 779.4e-8 | 102.3e-8 | 3.5e-8 | 150 | 75 |
| 13 | ISMC 200 | 28.2e-4 | 1819.3e-8 | 141.4e-8 | 5.0e-8 | 200 | 75 |
| 14 | ISMC 250 | 37.2e-4 | 3816.8e-8 | 211.2e-8 | 8.0e-8 | 250 | 80 |
| 15 | ISMC 300 | 45.6e-4 | 6362.6e-8 | 310.8e-8 | 11.0e-8 | 300 | 90 |

### E.3 IS Standard — Angles (3)

| # | Designation | A (m²) | Ix (m⁴) | Iy (m⁴) | J (m⁴) | Size |
|---|-------------|---------|----------|----------|---------|------|
| 16 | ISA 50×50×6 | 5.69e-4 | 11.1e-8 | 11.1e-8 | 0.6e-8 | 50×50 |
| 17 | ISA 75×75×8 | 11.4e-4 | 48.4e-8 | 48.4e-8 | 2.0e-8 | 75×75 |
| 18 | ISA 100×100×10 | 19.0e-4 | 146.8e-8 | 146.8e-8 | 5.3e-8 | 100×100 |

### E.4 AISC — W-Shapes (8)

| # | Designation | A (m²) | Ix (m⁴) | Iy (m⁴) | J (m⁴) | Depth | Width | tw | tf |
|---|-------------|---------|----------|----------|---------|-------|-------|-----|-----|
| 19 | W8×31 | 59.0e-4 | 11020e-8 | 3720e-8 | 36e-8 | 203 | 203 | 7.2 | 11.0 |
| 20 | W10×49 | 92.9e-4 | 27430e-8 | 9310e-8 | 90e-8 | 254 | 254 | 8.6 | 14.2 |
| 21 | W12×65 | 123.2e-4 | 53330e-8 | 17430e-8 | 150e-8 | 305 | 305 | 9.9 | 15.4 |
| 22 | W14×90 | 170.3e-4 | 106030e-8 | 33330e-8 | 264e-8 | 356 | 368 | 11.2 | 18.0 |
| 23 | W16×100 | 189.7e-4 | 155520e-8 | 18580e-8 | 260e-8 | 406 | 264 | 11.7 | 19.9 |
| 24 | W18×119 | 225.2e-4 | 246050e-8 | 25350e-8 | 376e-8 | 457 | 279 | 13.0 | 22.2 |
| 25 | W21×147 | 278.7e-4 | 418690e-8 | 35560e-8 | 540e-8 | 533 | 292 | 14.5 | 25.4 |
| 26 | W24×176 | 333.5e-4 | 645490e-8 | 47730e-8 | 714e-8 | 610 | 305 | 15.9 | 28.4 |

### E.5 AISC — HSS Tubes (2) & Pipes (2)

| # | Designation | Shape | A (m²) | Ix (m⁴) | Iy (m⁴) | J (m⁴) | Size |
|---|-------------|-------|---------|----------|----------|---------|------|
| 27 | HSS 6×6×3/8 | tube | 51.0e-4 | 4530e-8 | 4530e-8 | 7370e-8 | 152×152 |
| 28 | HSS 8×8×1/2 | tube | 90.3e-4 | 14350e-8 | 14350e-8 | 22600e-8 | 203×203 |
| 29 | Pipe 6 STD | pipe | 34.7e-4 | 2830e-8 | 2830e-8 | 5660e-8 | Ø168 |
| 30 | Pipe 8 STD | pipe | 47.4e-4 | 6490e-8 | 6490e-8 | 12980e-8 | Ø219 |

### E.6 Eurocode — HEA/HEB/IPE/UPN (8)

| # | Designation | Shape | A (m²) | Ix (m⁴) | Iy (m⁴) | J (m⁴) | Depth | Width | tw | tf |
|---|-------------|-------|---------|----------|----------|---------|-------|-------|-----|-----|
| 31 | HEA 200 | i-beam | 53.8e-4 | 3692e-8 | 1336e-8 | 21e-8 | 190 | 200 | 6.5 | 10.0 |
| 32 | HEA 300 | i-beam | 112.5e-4 | 18260e-8 | 6310e-8 | 85e-8 | 290 | 300 | 8.5 | 14.0 |
| 33 | HEB 200 | i-beam | 78.1e-4 | 5696e-8 | 2003e-8 | 59e-8 | 200 | 200 | 9.0 | 15.0 |
| 34 | HEB 300 | i-beam | 149.1e-4 | 25170e-8 | 8563e-8 | 185e-8 | 300 | 300 | 11.0 | 19.0 |
| 35 | IPE 200 | i-beam | 28.5e-4 | 1943e-8 | 142e-8 | 7e-8 | 200 | 100 | 5.6 | 8.5 |
| 36 | IPE 300 | i-beam | 53.8e-4 | 8356e-8 | 604e-8 | 20e-8 | 300 | 150 | 7.1 | 10.7 |
| 37 | IPE 400 | i-beam | 84.5e-4 | 23130e-8 | 1318e-8 | 51e-8 | 400 | 180 | 8.6 | 13.5 |
| 38 | UPN 200 | channel | 32.2e-4 | 1910e-8 | 148e-8 | 6e-8 | 200 | 75 | 8.5 | 11.5 |

---

## Appendix F — Solver Sign Conventions & FEF Formulas

### F.1 Local Coordinate System

```
Local X = member axis (start → end)
Local Y = perpendicular to member, in-plane of bending
Local Z = right-hand rule: lZ = lX × lY
```

**Rotation matrix T (3×3):** Transforms global → local: `v_local = T · v_global`

### F.2 Vertical Member Convention (Matching Rust Solver)

For a member along global Y (vertical column):
```
sign = cy > 0 ? 1 : -1   (upward = +1, downward = -1)

T = [  0,          sign,  0    ]    Row 0 = local X (along member)
    [ −sign·cos β,  0,    sin β]    Row 1 = local Y
    [  sign·sin β,  0,    cos β]    Row 2 = local Z
```

With β = 0: local Y = [-sign, 0, 0], local Z = [0, 0, 1]

### F.3 General Member Convention

```
cxz = sqrt(cx² + cz²)

T = [ cx,                              cy,        cz                              ]
    [ (-cx·cy·cosβ − cz·sinβ)/cxz,    cxz·cosβ,  (-cy·cz·cosβ + cx·sinβ)/cxz    ]
    [ (cx·cy·sinβ − cz·cosβ)/cxz,    −cxz·sinβ,  (cy·cz·sinβ + cx·cosβ)/cxz     ]
```

### F.4 Concentrated Point Load FEF (Hermite)

For a transverse point load P at distance `a` from start, `b = L − a`:

```
R1 = P · b² · (3a + b) / L³     (reaction at start)
R2 = P · a² · (a + 3b) / L³     (reaction at end)
M1 = P · a · b² / L²            (fixed-end moment at start)
M2 = −P · a² · b / L²           (fixed-end moment at end)
```

### F.5 Concentrated Moment FEF (Hermite Derivative)

For a concentrated moment M₀ at distance `a` from start:

```
R1 =  6 · M₀ · a · b / L³      (shear at start — POSITIVE)
R2 = −6 · M₀ · a · b / L³      (shear at end — NEGATIVE)
M1 =  M₀ · b · (2a − b) / L²   (moment at start)
M2 =  M₀ · a · (2b − a) / L²   (moment at end)
```

**Sign convention matches Rust `compute_point_load_fef`:**
- Shear R1 is POSITIVE (downward reaction for upward moment)
- Previous JS code had R1 = −6M₀ab/L³ (WRONG, now fixed)

### F.6 Axial Point Load FEF

```
R1 = P · (L − a) / L           (axial reaction at start)
R2 = P · a / L                 (axial reaction at end)
```

### F.7 FEF Correction Formula

WASM solver returns forces without knowing about pre-converted point loads:

```
f_wrong = k_local · u_local − FEF_distributed
f_correct = f_wrong − FEF_pointAndMoment      (Eq. 2)
```

### F.8 Local to Global Transformation for Equivalent Nodal Loads

For local-direction loads: FEF computed in local coords, rotated to global via:

```
v_global = T^T · v_local        (transpose of rotation matrix)
```

This is done separately for forces [Fx, Fy, Fz] and moments [Mx, My, Mz].

---

## Appendix G — Unit System Reference

### G.1 Primary Unit System

| Quantity | Unit | Store Field |
|----------|------|-------------|
| Length | m (meters) | Node x, y, z |
| Force | kN (kilonewtons) | Load fx, fy, fz, P, w |
| Moment | kN·m | Load mx, my, mz, M |
| Stress | kN/m² (= kPa) | Member E, G |
| Area | m² | Member A |
| Moment of Inertia | m⁴ | Member I, Iy, Iz, J |
| Density | kg/m³ | Member rho |
| Temperature | °C | TemperatureLoad deltaT |
| Angle | degrees | Member betaAngle |
| Thermal Expansion | /°C | TemperatureLoad alpha |
| Pressure | kN/m² | FloorLoad pressure |

### G.2 Display Unit Conversions

| Property | Store Unit | Display Unit | Conversion |
|----------|-----------|-------------|------------|
| Area | m² | cm² | × 10,000 |
| Moment of Inertia | m⁴ | cm⁴ | × 10⁸ |
| Young's Modulus | kN/m² | GPa | ÷ 10⁶ |
| Displacement | m | mm | × 1,000 |
| Section Depth/Width | m | mm | × 1,000 |
| Stress (result) | kN/m² | MPa | ÷ 1,000 |

### G.3 Solver Unit Conversion

| From (Store) | To (Solver) | Factor |
|-------------|-------------|--------|
| kN | N | × 1,000 |
| kN·m | N·m | × 1,000 |
| m | m | × 1 |
| kN/m² | kN/m² | × 1 |
| m² | m² | × 1 |
| m⁴ | m⁴ | × 1 |

---

## Appendix H — Figma Component Hierarchy

### H.1 Atomic Components

```
atoms/
├── IconButton          // p-2 rounded-md, icon + tooltip
├── NumberInput         // type="number", h-8, controlled value
├── Label              // text-xs text-slate-500
├── Badge              // text-[10px] px-1.5 py-0.5 rounded
├── Separator          // w-px h-6 bg-slate-200
├── Toggle             // checkbox-style DOF toggle
├── ProgressBar        // h-2 bg-emerald-500 rounded-full
└── Tooltip            // absolute positioned, bg-slate-900 text-white text-xs
```

### H.2 Molecule Components

```
molecules/
├── ToolButton            // Icon + Label + Shortcut badge
├── DropdownMenuItem      // Icon + Label + Shortcut aligned right
├── LoadCard              // Header + grid of inputs + delete button
├── MaterialCard          // Name + grade + property grid + select button
├── SectionCard           // Designation + shape + property grid + assign button
├── ValidationErrorCard   // Icon + message + details
├── ProgressStage         // Check/Spinner icon + stage name
├── PropertySection       // Icon + title + collapsible content
├── DOFToggleGroup        // 6 toggle buttons (Tx,Ty,Tz,Rx,Ry,Rz)
└── SupportPresetBar      // Fixed | Pinned | Roller | Free buttons
```

### H.3 Organism Components

```
organisms/
├── CategoryRibbonBar         // 5 category buttons
├── ModelingToolbar            // Quick-access + 7 dropdown groups
├── PropertiesToolbar          // 10 tool buttons
├── LoadingToolbar             // 12 tool buttons
├── AnalysisToolbar            // 6 tool buttons + Run Analysis CTA
├── DesignToolbar              // 3 tool buttons
├── PropertiesPanel            // Right sidebar — node/member editor
├── LoadDialog                 // 6-tab load management modal
├── MaterialLibraryDialog      // Browse/Custom material selection
├── SectionAssignDialog        // Library/Custom section selection
├── AnalysisProgressModal      // Progress bar + stage checklist
├── ValidationErrorDisplay     // List of validation errors/warnings
└── ResultsDisplayControls     // Toggle switches + scale sliders
```

### H.4 Page/Frame Components

```
pages/
├── ModelerPage               // Main modeling workspace
│   ├── CategoryRibbonBar
│   ├── ContextToolbar (varies by category)
│   ├── 3DViewport (R3F Canvas)
│   ├── PropertiesPanel
│   └── StatusBar
├── LoadDialog (overlay)
├── MaterialLibraryDialog (overlay)
├── SectionAssignDialog (overlay)
└── AnalysisProgressModal (overlay)
```

### H.5 Responsive Breakpoints

| Breakpoint | Width | Toolbar Behavior |
|-----------|-------|-----------------|
| `sm` (640px) | Mobile | Labels hidden, icon-only buttons |
| `md` (768px) | Tablet | Some labels visible |
| `lg` (1024px) | Desktop | Full labels + shortcuts |
| `xl` (1280px) | Wide | Properties panel always visible |

---

*End of STAAD Pro Features Design Specification v1.0.0*
*Total coverage: 5 categories, 70 tools, 6 load tabs, 26 materials, 38 sections, 17 store action groups, 50+ Lucide icons, complete FEF formulas, unit system reference.*
