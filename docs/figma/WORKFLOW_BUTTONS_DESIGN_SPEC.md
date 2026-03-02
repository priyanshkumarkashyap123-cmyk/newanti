# BeamLab Ultimate — Workflow Buttons Design Specification

> **Version:** 2.0 (Micro-Detail Audit Complete)  
> **Date:** June 2025  
> **Purpose:** Complete Figma design specification for all workflow buttons, sub-elements, panels, and their functions  
> **Target:** Structural analysis desktop-web application (STAAD Pro / ETABS-class)  
> **Coverage:** 9 workflow steps, 27+ dialogs (every field/default/output), 112 tools, 35 modal keys, 11 appendixes, 3050+ lines

---

## Table of Contents

1. [Global Layout Architecture](#1-global-layout-architecture)
2. [Design System Tokens](#2-design-system-tokens)
3. [Workflow Sidebar (Left Panel)](#3-workflow-sidebar-left-panel)
4. [Step 1 — Geometry (MODELING)](#4-step-1--geometry-modeling)
5. [Step 2 — Properties (PROPERTIES)](#5-step-2--properties-properties)
6. [Step 3 — Materials](#6-step-3--materials)
7. [Step 4 — Specifications](#7-step-4--specifications)
8. [Step 5 — Supports](#8-step-5--supports)
9. [Step 6 — Loading](#9-step-6--loading)
10. [Step 7 — Analysis](#10-step-7--analysis)
11. [Step 8 — Design](#11-step-8--design)
12. [Step 9 — Civil Engineering](#12-step-9--civil-engineering)
13. [Properties Inspector (Right Panel)](#13-properties-inspector-right-panel)
14. [Floating Modeling Toolbar](#14-floating-modeling-toolbar)
15. [Gap Analysis & Recommendations](#15-gap-analysis--recommendations)

**Appendixes:**
- A: Complete Modal Registry (35 keys)
- B: Icon Mapping (Lucide React)
- C: Keyboard Shortcut Map (basic)
- D: Complete Data Model Interfaces (Node, Member, Loads, Results, etc.)
- E: Complete CATEGORY_TOOLS Mapping (112 tools across 6 categories)
- F: Complete Dialog Micro-Details (27 dialogs with every form field, default value, and computed output)
- G: Complete Material Database (11 materials, 22+ section categories)
- H: UI State Management Details (category switching rules, sidebar modes, grid/graphics state)
- I: PropertiesPanel Micro-Details (color coding, unit conversions, force display, release indicators)
- J: Additional Dialogs Not Wired to Ribbon (19 orphaned dialogs with recommended wiring)
- K: Complete Keyboard Shortcut Map (30+ shortcuts, extended)

---

## 1. Global Layout Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  TITLE BAR  │  [Logo] BeamLab ULTIMATE  │  CATEGORY TABS  │  [⬆ Upgrade]  │
├─────────────┼───────────────────────────────────────────────────────────────┤
│             │  ENGINEERING RIBBON (100px h)                                │
│             │  ┌────────┬──────────┬────────┬────────┬──────────┬────────┐ │
│  WORKFLOW   │  │ Group1 │  Group2  │ Group3 │ Group4 │  Group5  │ Group6 │ │
│  SIDEBAR    │  │        │          │        │        │          │        │ │
│  (192px w)  │  └────────┴──────────┴────────┴────────┴──────────┴────────┘ │
│             ├───────────────────────────────────────────────┬──────────────┤
│  9 steps    │                                               │  PROPERTIES │
│  vertically │         3D VIEWPORT / CANVAS                  │  INSPECTOR  │
│             │                                               │  (280px w)  │
│  1.Geometry │                                               │             │
│  2.Props    │    [Floating Modeling Toolbar]                 │  Context-   │
│  3.Material │                                               │  sensitive  │
│  4.Specs    │                                               │  panel      │
│  5.Supports │                                               │             │
│  6.Loading  │                                               │             │
│  7.Analysis │                                               │             │
│  8.Design   │                                               │             │
│  9.Civil    │                                               │             │
│             │                                               │             │
├─────────────┼───────────────────────────────────────────────┴──────────────┤
│ Connection: │                   STATUS BAR                                │
│ ● Online    │                                                             │
└─────────────┴─────────────────────────────────────────────────────────────┘
```

| Zone                  | Width       | Background (Dark)                  | Border                       |
|-----------------------|-------------|------------------------------------|------------------------------|
| Workflow Sidebar      | 192px (12px collapsed) | `slate-900 → slate-950` gradient | Right: `slate-800/60`        |
| Engineering Ribbon    | Full width  | `slate-900/98` + blur             | Bottom: `slate-700/40`       |
| 3D Viewport           | Flex fill   | Three.js canvas                   | —                            |
| Properties Inspector  | 280px       | `slate-950/95` + blur             | Left: `slate-700/60`         |
| Title Bar             | Full × 32px | `slate-950/90`                    | Bottom: `slate-800/60`       |

---

## 2. Design System Tokens

### 2.1 Category Color System

Each workflow category has a dedicated accent color used for active states, borders, and highlights:

| Category    | Color Key   | Tailwind        | Active Tab Class                                  | Hex (approx)  |
|-------------|-------------|-----------------|---------------------------------------------------|---------------|
| MODELING    | `blue`      | `blue-400/500`  | `bg-slate-800/60 text-blue-400 border-t-blue-500` | `#60A5FA`     |
| PROPERTIES  | `purple`    | `purple-400/500`| `bg-slate-800/60 text-purple-400 border-t-purple-500`| `#A78BFA`  |
| LOADING     | `orange`    | `orange-400/500`| `bg-slate-800/60 text-orange-400 border-t-orange-500`| `#FB923C`  |
| ANALYSIS    | `emerald`   | `emerald-400/500`| `bg-slate-800/60 text-emerald-400 border-t-emerald-500`| `#34D399`|
| DESIGN      | `rose`      | `rose-400/500`  | `bg-slate-800/60 text-rose-400 border-t-rose-500` | `#FB7185`     |
| CIVIL       | `amber`     | `amber-400/500` | `bg-slate-800/60 text-amber-400 border-t-amber-500`| `#FBBF24`   |

### 2.2 Button Components

#### ToolButton (Ribbon)
Three size variants:

| Size      | Dimensions   | Icon Size | Label           | Padding        |
|-----------|-------------|-----------|-----------------|----------------|
| `large`   | 56 × 56px   | 24px      | 10px, centered  | `px-1.5 py-1`  |
| `normal`  | 50 × 50px   | 16px      | 10px, centered  | `px-1.5 py-1`  |
| `compact` | h-8, flex   | 14px      | 10px, inline    | `px-1.5 py-1`  |

**States:**
- **Default:** `text-slate-200`, transparent border
- **Hover:** `bg-slate-700/50`, `border-slate-600/30`
- **Active (pressed):** `scale-[0.96]`, `bg-slate-700/70`
- **Selected (isActive):** `bg-blue-600/15`, `border-blue-500/30`, `text-blue-300`, `shadow-blue-500/5`
- **Disabled:** `opacity-40`, `cursor-not-allowed`

#### MiniButton (Stacked in ribbon)
- Height: auto, inline flex
- Icon: 12px (`w-3 h-3`)
- Label: 9px font, `font-medium`
- Used in `StackedButtons` (2 vertically stacked)

#### Sidebar Workflow Button
- Expanded: `gap-2.5 px-2.5 h-8`, rounded-md
- Collapsed: `w-9 h-9`, icon centered
- Step number badge: `w-6 h-6 rounded`, 10px bold
- Label: 12px semibold
- Subtext: 10px, secondary color
- Active indicator: 2px left border bar (`bg-blue-400`)

### 2.3 ToolGroup (Ribbon Section)
- Vertical flex container
- Right border separator: `border-slate-700/30`
- Label at bottom: 10px, uppercase, `tracking-[0.08em]`, `text-slate-500`
- Content area: horizontal flex, `gap-0.5`

---

## 3. Workflow Sidebar (Left Panel)

### Visual Design

```
┌────────────────────────┐
│  WORKFLOW               │
│  ANALYTICAL MODELING    │  ← 10px header, 9px mono subtitle
│         [◀ collapse]   │
├────────────────────────┤
│                         │
│  ┌──────────────────┐  │
│  │ ① Geometry        │  │  ← Active: blue left bar + bg-blue-500/10
│  │   Nodes & Beams   │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │ ② Properties      │  │
│  │   Sections        │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │ ③ Materials       │  │
│  │   Concrete/Steel  │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │ ④ Specifications  │  │
│  │   Releases        │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │ ⑤ Supports        │  │  ← Opens modal directly
│  │   Restraints      │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │ ⑥ Loading         │  │
│  │   Load Cases      │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │ ⑦ Analysis        │  │
│  │   Run Solver      │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │ ⑧ Design          │  │
│  │   Code Check      │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │ ⑨ Civil Engg      │  │
│  │   Geo/Hydro/Trans │  │
│  └──────────────────┘  │
│                         │
├────────────────────────┤
│  Connection  ● Online  │  ← 10px, emerald pulse dot
└────────────────────────┘
```

### Sidebar Button Mapping

| # | ID          | Label          | Icon       | Subtext          | Store Category | Behavior                        |
|---|-------------|----------------|------------|------------------|----------------|---------------------------------|
| 1 | `MODELING`  | Geometry       | `Box`      | Nodes & Beams    | `MODELING`     | Switch ribbon to Geometry tab   |
| 2 | `PROPERTIES`| Properties     | `Layers`   | Sections         | `PROPERTIES`   | Switch ribbon to Properties tab |
| 3 | `MATERIALS` | Materials      | `Database` | Concrete/Steel   | `PROPERTIES`   | Switch ribbon to Properties tab |
| 4 | `SPECS`     | Specifications | `Settings` | Releases         | `PROPERTIES`   | Switch ribbon to Properties tab |
| 5 | `SUPPORTS`  | Supports       | `Anchor`   | Restraints       | *(no change)*  | Opens `boundaryConditionsDialog`|
| 6 | `LOADING`   | Loading        | `Download` | Load Cases       | `LOADING`      | Switch ribbon to Loading tab    |
| 7 | `ANALYSIS`  | Analysis       | `BarChart3`| Run Solver       | `ANALYSIS`     | Switch ribbon to Analysis tab   |
| 8 | `DESIGN`    | Design         | `Ruler`    | Code Check       | `DESIGN`       | Switch ribbon to Design tab     |
| 9 | `CIVIL`     | Civil Engg     | `Globe`    | Geo/Hydro/Trans  | `CIVIL`        | Switch ribbon to Civil tab      |

### Collapsed State
- Width: 12px → icon-only buttons (w-9 h-9)
- No labels, no step numbers
- Tooltip shows `"{label} — {subtext}"` on hover

---

## 4. Step 1 — Geometry (MODELING)

**Accent Color:** Blue (`blue-400/500`)  
**Sidebar:** Active step = `MODELING`  
**Ribbon Tab:** GEOMETRY  

### Ribbon Layout

```
┌──────────┬────────────┬──────────────────┬──────────┬──────────────────────────┬──────────┐
│   FILE   │ STRUCTURE  │     CREATE       │  SELECT  │         EDIT             │ SUPPORTS │
│          │            │                  │          │                          │          │
│ [Save]   │ [Wizard]   │ [Node] [Beam]    │ [Select] │ [Copy ][Mirror][Split ]  │[Boundary]│
│ Open Exp │ [Gallery]  │ [Plate][Slab]    │ [Adv.  ] │ [Move ][Rotate][Delete]  │          │
│ Undo Redo│            │                  │          │                          │          │
└──────────┴────────────┴──────────────────┴──────────┴──────────────────────────┴──────────┘
```

### Tool Groups & Sub-Elements

#### 4.1 FILE Group

| Button       | Size    | Icon         | Shortcut    | Function                                                    |
|-------------|---------|--------------|-------------|-------------------------------------------------------------|
| **Save**     | normal  | `Save`       | `Ctrl+S`    | Dispatches `trigger-save` event → saves to cloud/local      |
| Open         | mini    | `FolderOpen` | `Ctrl+O`    | Dispatches `trigger-cloud-open` → opens project browser     |
| Export       | mini    | `Download`   | —           | Dispatches `trigger-export` → export model (JSON/DXF/IFC)   |
| Undo         | mini    | `Undo`       | `Ctrl+Z`    | Calls `undo()` from temporal store (Zustand)                |
| Redo         | mini    | `Redo`       | `Ctrl+Shift+Z` | Calls `redo()` from temporal store                       |

**Layout:** Save as normal button; Open/Export stacked vertically; Undo/Redo stacked vertically.

**⚠ Recommended Additional Button (exists in code, no ribbon entry):**

| Button              | Size   | Icon       | Modal Key           | Function                                 |
|--------------------|--------|------------|---------------------|------------------------------------------|
| **Import/Export**   | normal | `FileUp`   | `interoperability`  | DXF/STAAD/IFC/JSON import & export        |

> Supports 4 formats with merge/replace import modes. Full details in **Appendix F.25 InteroperabilityDialog**.

#### 4.2 STRUCTURE Group

| Button       | Size    | Icon     | Shortcut         | Function                                                     |
|-------------|---------|----------|------------------|--------------------------------------------------------------|
| **Wizard**   | large   | `Grid`   | `Ctrl+Shift+W`   | Opens `structureWizard` modal — parametric structure gen      |
| Gallery      | normal  | `Database`| —               | Opens `structureGallery` modal — pre-built bridge/truss/frame |

**Wizard Modal Elements:**
- Structure type selector: Frame, Truss, Bridge, Tower, Arch
- Parameter inputs: Number of bays, bay width, number of stories, story height
- Support conditions: Fixed/Pinned at base
- Preview: 2D wireframe preview
- Generate button

**Gallery Modal Elements:**
- Thumbnail grid of pre-built structures
- Categories: Bridges, Trusses, Frames, Towers, Cables
- Each card: thumbnail + name + span/height info
- Click to load into viewport

#### 4.3 CREATE Group

| Button       | Size    | Icon     | Shortcut | Function                                                      |
|-------------|---------|----------|----------|---------------------------------------------------------------|
| **Node**     | normal  | `Box`    | `N`      | Sets `activeTool = "node"` → click-to-place node on canvas    |
| **Beam**     | normal  | `Spline` | `M`      | Sets `activeTool = "member"` → click two nodes to create beam |
| **Plate**    | normal  | `Grid`   | `P`      | Opens `plateDialog` modal → 3/4-node shell element            |
| **Slab**     | normal  | `Layers` | —        | Opens `floorSlabDialog` modal → auto-detect floor panels      |

**Plate Dialog Elements:**
- Node ID inputs (3 or 4 corners)
- Thickness input (mm)
- Material selector
- Element type: Thin Plate / Thick Shell / Membrane
- Mesh density slider

**Floor Slab Dialog Elements:**
- Auto-detect mode: scans closed panel regions
- Manual mode: select boundary beams
- Slab thickness, material
- Load transfer direction
- One-way / Two-way option
- Live load value input

#### 4.4 SELECT Group

| Button       | Size    | Icon           | Shortcut | Function                                           |
|-------------|---------|----------------|----------|----------------------------------------------------|
| **Select**   | normal  | `MousePointer2`| `V`      | Sets `activeTool = "select"` → click to select     |
| Advanced     | normal  | `Search`       | —        | Opens `selectionToolbar` modal → filter by property |

**Advanced Selection Modal Elements:**
- Selection mode: Single / Box / Crossing / All
- Filters:
  - By Type: Nodes / Members / Plates
  - By Section (dropdown)
  - By Material (dropdown)
  - By Level/Elevation range
  - By ID range (start-end)
  - By Property value range (e.g., length > X)
- Actions: Select / Add to Selection / Remove from Selection / Invert

#### 4.5 EDIT Group

| Button       | Size    | Icon              | Shortcut   | Function                                         |
|-------------|---------|-------------------|------------|--------------------------------------------------|
| Copy         | mini    | `Copy`            | `Ctrl+C`   | Dispatches `trigger-copy` → duplicates selection  |
| Move         | mini    | `Move`            | —          | Dispatches `trigger-move` → translate selection   |
| Mirror       | mini    | `FlipHorizontal`  | —          | Opens `geometryTools` → mirror about axis/plane   |
| Rotate       | mini    | `RotateCcw`       | —          | Opens `geometryTools` → rotate by angle           |
| Split        | mini    | `Scissors`        | —          | Dispatches `trigger-split` → divide member at point|
| Delete       | mini    | `Trash2`          | `Del`      | Dispatches `trigger-delete` → remove selection     |

**Layout:** Two stacked columns of mini buttons (Copy/Move, Mirror/Rotate, Split/Delete).

#### 4.6 SUPPORTS Group

| Button       | Size    | Icon     | Function                                                     |
|-------------|---------|----------|--------------------------------------------------------------|
| **Boundary** | normal  | `Anchor` | Opens `boundaryConditionsDialog` → assign support types       |

**Boundary Conditions Dialog Elements:**
- Preset buttons: Fixed / Pinned / Roller / Free
- 6-DOF toggle grid:
  - `Tx` (Translation X) — Lock/Unlock
  - `Ty` (Translation Y) — Lock/Unlock
  - `Tz` (Translation Z) — Lock/Unlock
  - `Rx` (Rotation X) — Lock/Unlock
  - `Ry` (Rotation Y) — Lock/Unlock
  - `Rz` (Rotation Z) — Lock/Unlock
- Spring stiffness inputs (optional): Kx, Ky, Kz, KRx, KRy, KRz
- Apply to: Selected nodes / All nodes / By elevation
- Support visualization toggle

### Floating Modeling Toolbar (Canvas Overlay)

Visible only when `category === MODELING`. Positioned over the 3D viewport.

```
┌──────────────────────────────────────────────────────────────┐
│  [▶Select ▼] [✏ Draw ▼] [🔧Edit ▼] [▦Array ▼]             │
│  [↻Transform ▼] [🏗Generate ▼] [📏Measure ▼]               │
└──────────────────────────────────────────────────────────────┘
```

**Quick-access icons (always visible):** SELECT, DRAW_NODE, DRAW_BEAM, DRAW_COLUMN, DELETE

#### Dropdown: Select
| Tool           | Icon          | Shortcut | Function                    |
|----------------|---------------|----------|-----------------------------|
| Select         | `MousePointer`| `Esc`    | Click-to-select             |
| Box Select     | `Square`      | `Shift+S`| Rectangle selection         |
| Pan            | `Move`        | —        | Pan viewport                |
| Zoom Window    | `Maximize2`   | `Z`      | Zoom to area                |

#### Dropdown: Draw
| Tool           | Icon          | Shortcut | Function                    |
|----------------|---------------|----------|-----------------------------|
| Node           | `CircleDot`   | `N`      | Place single node           |
| Beam           | `Minus`       | `B`      | Draw beam (2 nodes)         |
| Column         | `ArrowDown`   | `V`      | Draw vertical column        |
| Cable          | `Cable`       | `C`      | Tension-only element        |
| Arch           | `Spline`      | `A`      | Parabolic/circular arc      |
| Rigid Link     | `Link2`       | —        | Rigid connection            |
| Plate/Shell    | `Square`      | `P`      | Quad/tri shell element      |

#### Dropdown: Edit
| Tool           | Icon              | Function                    |
|----------------|-------------------|-----------------------------|
| Copy           | `Copy`            | Duplicate elements          |
| Mirror         | `FlipHorizontal2` | Mirror about plane          |
| Delete         | `Trash2`          | Remove selected             |
| Divide Member  | `Split`           | Split beam at point/ratio   |
| Merge Nodes    | `Merge`           | Merge coincident nodes      |
| Align Nodes    | `AlignLeft`       | Align to line/plane         |
| Split Member   | `Minus`           | Split at intermediate node  |

#### Dropdown: Array
| Tool           | Icon    | Function                              |
|----------------|---------|---------------------------------------|
| Linear Array   | `Grid`  | Repeat in X/Y/Z direction            |
| Polar Array    | `RotateCw`| Repeat around axis                  |
| 3D Array       | `Box`   | 3D grid replication                   |

#### Dropdown: Transform
| Tool           | Icon          | Function                              |
|----------------|---------------|---------------------------------------|
| Move           | `Move`        | Translate by delta (dx, dy, dz)       |
| Rotate         | `RotateCw`    | Rotate about axis by angle            |
| Scale          | `Maximize2`   | Scale uniformly or per-axis           |
| Offset Member  | `ArrowRight`  | Offset member parallel                |
| Extrude        | `CornerUpRight`| Extrude nodes/members into 3D        |

#### Dropdown: Generate
| Tool              | Icon      | Function                                        |
|-------------------|-----------|-------------------------------------------------|
| Grid              | `Grid`    | Rectangular node grid (nx × ny × nz)            |
| 3D Grid           | `Box`     | Full 3D grid with members                       |
| Circular Grid     | `Circle`  | Radial grid pattern                              |
| Truss Generator   | `Triangle`| Pratt / Warren / Howe / K truss                 |
| Arch Generator    | `Spline`  | Parabolic / circular arch + ribs                 |
| Pier Generator    | `Columns` | Bridge pier with cap beam                        |
| Tower Generator   | `Building`| Lattice tower (telecom/transmission)             |
| Deck Generator    | `Minus`   | Bridge deck with stringers/cross-beams           |
| Cable Pattern     | `Cable`   | Stay cable / suspension cable arrangement        |
| Frame Generator   | `Building`| Multi-bay multi-story portal frame               |
| Staircase Gen.    | `Milestone`| Stair flight with landings                      |

> **Generator Dialogs** (756 lines): Truss (warren/pratt/howe/k-truss, span/height/panels),
> Arch (parabolic/circular/catenary, span/rise/segments/hangers),
> Frame (portal/multi-story, bays/stories/dimensions),
> Cable (fan/harp/semi-harp, tower/deck/spacing).
> Full parameter tables in **Appendix F.19 GeneratorDialogs**.
>
> **Curved Structure Dialog** (425 lines, `curvedStructure` modal): 9 categories (Domes/Vaults/Arches/
> Tunnels/Spheres/Tanks/Towers/Staircases/Shells) with parametric templates.
> Full details in **Appendix F.27 CurvedStructureDialog**.

#### Dropdown: Measure
| Tool              | Icon    | Function                              |
|-------------------|---------|-----------------------------------------|
| Distance          | `Ruler` | Measure between two points              |
| Angle             | `CornerUpRight`| Measure angle between members    |
| Area              | `Square`| Measure enclosed area                   |

---

## 5. Step 2 — Properties (PROPERTIES)

**Accent Color:** Purple (`purple-400/500`)  
**Sidebar:** Active step = `PROPERTIES`  
**Ribbon Tab:** PROPERTIES  

### Ribbon Layout

```
┌──────────────────────────┬──────────────────────────┬───────────────────────────────────┐
│        SECTION           │       MATERIAL           │         SPECIFICATIONS            │
│                          │                          │                                   │
│ [📚Library]  Assign      │ [📦Material]  Assign     │ [Beta Angle] [Releases] [Offsets] │
│   (large)    Sec.Builder │   (normal)    Properties │                                   │
└──────────────────────────┴──────────────────────────┴───────────────────────────────────┘
```

### Tool Groups & Sub-Elements

#### 5.1 SECTION Group

| Button          | Size    | Icon       | Function                                                        |
|----------------|---------|------------|-----------------------------------------------------------------|
| **Library**     | large   | `Layers`   | Opens `sectionBrowserDialog` — full database with search        |
| Assign          | mini    | `Settings` | ⚠️ Currently routes to generic `geometryTools` — **NEEDS FIX**  |
| Section Builder | mini    | `Calculator`| ⚠️ Currently routes to generic `geometryTools` — **NEEDS FIX** |

**Section Library Dialog (265 lines — `sectionBrowserDialog`):**

```
┌──────────────────────────────────────────────────────────────┐
│  SECTION DATABASE                                    [✕]    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Standard: [IS ▼]  (IS / AISC / BS / EN)                    │
│                     ↑ Fetches from Rust backend via          │
│                       useSteelSections(standard)             │
│                                                              │
│  Category: [ISMB ▼] [ISMC] [ISLB] [ISHB] [W-AISC]         │
│            [RCC-Beam] [RCC-Column] [Custom]                  │
│                                                              │
│  🔍 Search: [________________]  (debounced 300ms)            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Section     │ Depth │ Width │ Area   │ Ix      │ Iy   │  │
│  ├──────────────┼───────┼───────┼────────┼─────────┼──────┤  │
│  │ ISMB 150    │ 150   │ 80    │ 1840   │ 726.4   │ 52.6 │  │
│  │ ISMB 200    │ 200   │ 100   │ 3232   │ 2235.4  │ 150  │  │
│  │ ISMB 250    │ 250   │ 125   │ 4755   │ 5131.6  │ 334  │  │
│  │ ISMB 300    │ 300   │ 140   │ 5870   │ 8603.6  │ 453  │  │
│  │ ...         │       │       │        │         │      │  │
│  └────────────────────────────────────────────────────────┘  │
│  ↑ Sortable by any column (asc/desc)                         │
│                                                              │
│  Selected: ISMB 200                                          │
│  ┌───────────────────────────────────────────────────┐      │
│  │  [Cross-section SVG preview]                       │      │
│  │  Depth: 200mm  │  Width: 100mm                    │      │
│  │  Area: 3232mm² │  Ix: 2235.4 cm⁴                 │      │
│  │  Weight: 25.4 kg/m                                 │      │
│  └───────────────────────────────────────────────────┘      │
│                                                              │
│  Apply to: [Selected Members ▼]                              │
│                                                              │
│  [Cancel]                        [Apply Section]             │
└──────────────────────────────────────────────────────────────┘
```

> Full section standards (22+ types), sortable columns, and Rust backend details in **Appendix F.8 SectionBrowserDialog**.
> Complete section categories (IS/AISC/BS/EN) in **Appendix G.3 Section Categories in Database**.

**Section Categories Available:**
- `ISMB` — Indian Standard Medium Weight Beams
- `ISMC` — Indian Standard Medium Weight Channels
- `ISLB` — Indian Standard Light Beams
- `ISHB` — Indian Standard Heavy Beams
- `W` — AISC W-Shapes (Wide Flange)
- `RCC-BEAM` — Reinforced Concrete Beam sections
- `RCC-COLUMN` — Reinforced Concrete Column sections
- `Custom` — User-defined (Area + Moment of Inertia)

**Section Assign Dialog (NEEDS IMPLEMENTATION):**
- Dropdown: select section from current category
- Target: Selected members / All members / By ID range
- Preview of section shape
- Apply button

**Section Builder Dialog (NEEDS IMPLEMENTATION → **can use existing `SectionDesignerDialog` 517 lines**):**
- 9 standard shapes: I-Beam, Channel, Angle, Rectangle, Circle, T-Section, Built-up I, Composite Beam, Lipped Channel
- Dimension inputs for each shape parameter
- Auto-computed: Area, Ix, Iy, Sx, Zx, rx, ry, J, Cw, weight
- Cross-section renderer (SVG/Canvas)
- Backend: POST `/sections/standard/create` or `/sections/custom/calculate` (Python)
- Save to Library button
- See **Appendix F.26 SectionDesignerDialog** for full shape/dimension matrix.

#### 5.2 MATERIAL Group

| Button          | Size    | Icon       | Function                                                      |
|----------------|---------|------------|---------------------------------------------------------------|
| **Material**    | normal  | `Database` | ⚠️ Routes to `geometryTools` — **NEEDS dedicated dialog**     |
| Assign          | mini    | `Settings` | ⚠️ Routes to `geometryTools` — **NEEDS FIX**                  |
| Properties      | mini    | `Table2`   | ⚠️ Routes to `geometryTools` — **NEEDS FIX**                  |

**Material Library Dialog — Design Spec (NEEDS IMPLEMENTATION):**

```
┌──────────────────────────────────────────────────────────────┐
│  MATERIAL DATABASE                                   [✕]    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Type: [Steel] [Concrete] [Timber] [Aluminum] [Custom]      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Material    │ E (GPa) │ fy (MPa) │ ρ (kg/m³) │  ν   │  │
│  ├──────────────┼─────────┼──────────┼───────────┼───────┤  │
│  │ Fe 250      │ 200     │ 250      │ 7850      │ 0.30  │  │
│  │ Fe 350      │ 200     │ 350      │ 7850      │ 0.30  │  │
│  │ Fe 410      │ 200     │ 410      │ 7850      │ 0.30  │  │
│  │ Fe 500      │ 200     │ 500      │ 7850      │ 0.30  │  │
│  │ M20 Concrete│ 22.36   │ 20(fck)  │ 2500      │ 0.20  │  │
│  │ M25 Concrete│ 25.00   │ 25(fck)  │ 2500      │ 0.20  │  │
│  │ M30 Concrete│ 27.39   │ 30(fck)  │ 2500      │ 0.20  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ── Custom Material ──                                       │
│  Name: [_______________]                                     │
│  E (Young's Modulus):   [________] GPa                       │
│  G (Shear Modulus):     [________] GPa                       │
│  fy (Yield Strength):   [________] MPa                       │
│  ρ (Density):           [________] kg/m³                     │
│  ν (Poisson's Ratio):   [________]                           │
│  α (Thermal Coeff):     [________] /°C                       │
│                                                              │
│  Apply to: [Selected Members ▼]                              │
│  [Cancel]                        [Apply Material]            │
└──────────────────────────────────────────────────────────────┘
```

**Material Properties (from actual database — 11 materials):**

| Material              | E (GPa) | fy/fck (MPa) | ρ (kg/m³) | ν    | α (/°C)    |
|-----------------------|---------|-------------|-----------|------|------------|
| Fe 250 (IS 2062)      | 200     | 250         | 7850      | 0.30 | 12×10⁻⁶   |
| Fe 410 (IS 2062)      | 200     | 250 (fy)    | 7850      | 0.30 | 12×10⁻⁶   |
| ASTM A36              | 200     | 250         | 7850      | 0.30 | 11.7×10⁻⁶ |
| ASTM A992 Gr50        | 200     | 345         | 7850      | 0.30 | 11.7×10⁻⁶ |
| S275 (EN 10025)       | 210     | 275         | 7850      | 0.30 | 12×10⁻⁶   |
| S355 (EN 10025)       | 210     | 355         | 7850      | 0.30 | 12×10⁻⁶   |
| M20 Concrete          | 22.36   | 20 (fck)    | 2500      | 0.20 | —          |
| M25 Concrete          | 25.00   | 25 (fck)    | 2500      | 0.20 | —          |
| M30 Concrete          | 27.39   | 30 (fck)    | 2500      | 0.20 | —          |
| M40 Concrete          | 31.62   | 40 (fck)    | 2500      | 0.20 | —          |
| f'c = 4000 psi        | 25.74   | 27.6 (fck)  | 2400      | 0.20 | —          |

> Complete material database with all fields in **Appendix G.1** & **G.2**.

---

## 6. Step 3 — Materials

**Accent Color:** Purple (shares with Properties)  
**Sidebar:** Active step = `MATERIALS`  
**Ribbon Tab:** Same PROPERTIES ribbon (shares tab)  
**Note:** MATERIALS / PROPERTIES / SPECS all map to the `PROPERTIES` store category

### Intended Behavior (Recommendation)

When the user clicks "Materials" in the sidebar, the ribbon should either:
- **Option A:** Switch to a dedicated "Materials" ribbon strip showing material-focused tools
- **Option B (current):** Show the same PROPERTIES ribbon but auto-open the Material Library dialog

### Sub-Elements Under Materials

| Element                  | Type      | Function                                                    |
|--------------------------|-----------|-------------------------------------------------------------|
| Material Database        | Dialog    | Browse/search full material library by type                  |
| Material Assignment      | Tool      | Assign material to selected or all members                   |
| Custom Material Editor   | Form      | Define new material with E, G, fy, ρ, ν, α                 |
| Material Properties View | Table     | Read-only view of currently assigned material properties     |
| Material Color Map       | Toggle    | Color-code members by material type in 3D view              |

---

## 7. Step 4 — Specifications

**Accent Color:** Purple (shares with Properties)  
**Sidebar:** Active step = `SPECS`  
**Ribbon Tab:** Same PROPERTIES ribbon  

### Ribbon SPECIFICATIONS Group

| Button          | Size    | Icon     | Function                                                      |
|----------------|---------|----------|---------------------------------------------------------------|
| **Beta Angle**  | normal  | `Table2` | ⚠️ Routes to `geometryTools` — **NEEDS dedicated panel**      |
| **Releases**    | normal  | `Link2`  | ⚠️ Routes to `geometryTools` — **NEEDS dedicated panel**      |
| **Offsets**     | normal  | `Ruler`  | ⚠️ Routes to `geometryTools` — **NEEDS dedicated panel**      |

### Beta Angle Dialog — Design Spec (NEEDS IMPLEMENTATION)

```
┌──────────────────────────────────────────────┐
│  MEMBER ORIENTATION (Beta Angle)      [✕]   │
├──────────────────────────────────────────────┤
│                                              │
│  Member(s): [Selection: 3 members]           │
│                                              │
│  Beta Angle: [________] degrees              │
│                                              │
│  ┌──────────────────────────────────┐        │
│  │  [3D cross-section orientation   │        │
│  │   preview with local axes        │        │
│  │   showing rotation effect]       │        │
│  └──────────────────────────────────┘        │
│                                              │
│  Quick presets: [0°] [90°] [180°] [270°]    │
│                                              │
│  [Cancel]              [Apply Beta Angle]    │
└──────────────────────────────────────────────┘
```

**Function:** Rotates the member's local coordinate system about its longitudinal axis. Essential for orienting I-beams, channels, and angles correctly.

### Member End Releases Dialog — Design Spec (NEEDS IMPLEMENTATION)

```
┌──────────────────────────────────────────────────────────────┐
│  MEMBER END RELEASES                                  [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Member(s): [Selection: 5 members]                           │
│                                                              │
│  ── Start End (Node i) ──────────────────────────────        │
│  [ ] Fx (Axial)    [ ] Fy (Shear Y)    [ ] Fz (Shear Z)    │
│  [ ] Mx (Torsion)  [✓] My (Moment Y)   [✓] Mz (Moment Z)  │
│                                                              │
│  ── End End (Node j) ────────────────────────────────        │
│  [ ] Fx (Axial)    [ ] Fy (Shear Y)    [ ] Fz (Shear Z)    │
│  [ ] Mx (Torsion)  [✓] My (Moment Y)   [✓] Mz (Moment Z)  │
│                                                              │
│  Presets:                                                    │
│  [Both Pinned] [Start Pinned] [End Pinned] [Cantilever]     │
│                                                              │
│  Partial releases:                                           │
│  Start fixity factor: [________] (0=free, 1=fixed)          │
│  End fixity factor:   [________] (0=free, 1=fixed)          │
│                                                              │
│  [Cancel]                         [Apply Releases]           │
└──────────────────────────────────────────────────────────────┘
```

**Function:** Releases specific DOFs at member ends. A moment release creates a pin (hinge), allowing rotation. Used for truss connections, simple supports, and partial fixity.

### Member End Offsets Dialog — Design Spec (NEEDS IMPLEMENTATION)

```
┌──────────────────────────────────────────────────────────────┐
│  MEMBER END OFFSETS                                   [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Member(s): [Selection: 2 members]                           │
│                                                              │
│  ── Start Offset ────                                        │
│  Δx: [________] m    Δy: [________] m    Δz: [________] m  │
│                                                              │
│  ── End Offset ──────                                        │
│  Δx: [________] m    Δy: [________] m    Δz: [________] m  │
│                                                              │
│  Rigid zone factor: [1.0___] (0–1)                          │
│                                                              │
│  ☐ Auto-calculate from section depth                        │
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │  [Visualization: beam with offset    │                   │
│  │   end zones highlighted]             │                   │
│  └──────────────────────────────────────┘                   │
│                                                              │
│  [Cancel]                         [Apply Offsets]            │
└──────────────────────────────────────────────────────────────┘
```

**Function:** Defines rigid end zones at beam-column joints. Models the physical depth of connections, reducing effective span. Uses rigid zone factor to specify how much of the offset is rigid.

> **⚠ IMPORTANT NOTE:** A `MemberSpecificationsDialog` component (276 lines) already EXISTS in the codebase  
> at `specifications/MemberSpecificationsDialog.tsx` with proper 3-tab layout (Releases / Offsets / Beta Angle),  
> including full 12-DOF release checkboxes and 6 offset inputs. However, it is **NOT wired** to any  
> ribbon button — the ribbon buttons erroneously route to `geometryTools`. **Fix:** Wire the existing  
> `MemberSpecificationsDialog` to the relevant ribbon buttons instead of building from scratch.
> See **Appendix F.20 MemberSpecificationsDialog** for the exact field layout.

---

## 8. Step 5 — Supports

**Sidebar:** Active step = `SUPPORTS`  
**Behavior:** Does NOT switch ribbon tab — directly opens `boundaryConditionsDialog` modal  

### Boundary Conditions Dialog

```
┌──────────────────────────────────────────────────────────────┐
│  BOUNDARY CONDITIONS / SUPPORTS                       [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Apply to: [Selected Nodes ▼]                                │
│            Options: Selected Nodes / All Nodes / By Level    │
│                                                              │
│  ── Preset Support Types ──────────────────────              │
│  [🔒Fixed] [📌Pinned] [🛞Roller] [🔓Free]                   │
│                                                              │
│  ── Custom DOF Restraints ─────────────────                  │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┐                │
│  │  Tx  │  Ty  │  Tz  │  Rx  │  Ry  │  Rz │                │
│  │ [🔒] │ [🔒] │ [🔒] │ [🔒] │ [🔒] │ [🔒] │  ← Fixed     │
│  │ [🔒] │ [🔒] │ [🔒] │ [🔓] │ [🔓] │ [🔓] │  ← Pinned   │
│  │ [🔓] │ [🔒] │ [🔓] │ [🔓] │ [🔓] │ [🔓] │  ← Roller   │
│  └──────┴──────┴──────┴──────┴──────┴──────┘                │
│                                                              │
│  ── Spring Supports (Optional) ────────────                  │
│  Kx: [________] kN/m   KRx: [________] kN·m/rad            │
│  Ky: [________] kN/m   KRy: [________] kN·m/rad            │
│  Kz: [________] kN/m   KRz: [________] kN·m/rad            │
│                                                              │
│  ── Inclined Support ──────────────────────                  │
│  Angle from global X: [________] degrees                     │
│  Angle from global Y: [________] degrees                     │
│                                                              │
│  [Cancel]                        [Apply Supports]            │
└──────────────────────────────────────────────────────────────┘
```

**Actual Support Types (from code — 7 types):**

| Type       | fx  | fy  | fz  | mx  | my  | mz  | Symbol          |
|------------|-----|-----|-----|-----|-----|-----|-----------------|
| `none`     | ✗   | ✗   | ✗   | ✗   | ✗   | ✗   | · (nothing)     |
| `fixed`    | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   | ▲ (filled)      |
| `pinned`   | ✓   | ✓   | ✓   | ✗   | ✗   | ✗   | △ (outline)     |
| `roller-x` | ✗   | ✓   | ✓   | ✗   | ✗   | ✗   | ○ free in X     |
| `roller-y` | ✓   | ✗   | ✓   | ✗   | ✗   | ✗   | ○ free in Y     |
| `roller-z` | ✓   | ✓   | ✗   | ✗   | ✗   | ✗   | ○ free in Z     |
| `custom`   | user-defined per DOF                              | Custom icon     |

> Note: The 4-preset UI (Fixed/Pinned/Roller/Free) is a simplification shown in the inspector.
> The dialog internally supports all 7 types. Selecting a preset auto-fills the DOF toggles.
> `custom` mode enables individual DOF control.

**Batch Application:** Auto-applies to ALL currently selected nodes.
**Auto-Detection:** On dialog open, reads existing restraints from first selected node and pre-selects matching support type.

**DofToggle Component:**
- Each DOF is a toggleable chip (6 chips in a 3×2 grid)
- Active (restrained): `border-emerald-500 bg-emerald-500/10` 
- Inactive (free): `border-slate-700 bg-black/30`
- Shows DOF symbol + "Trans"/"Rot" sub-label
- Top row: fx, fy, fz (Translations)
- Bottom row: mx, my, mz (Rotations)

> For complete DOF restraint data structure, see **Appendix D.2 Restraints**.

---

## 9. Step 6 — Loading

**Accent Color:** Orange (`orange-400/500`)  
**Sidebar:** Active step = `LOADING`  
**Ribbon Tab:** LOADING  

### Ribbon Layout

```
┌──────────────────┬────────────────┬───────────────────────────┬────────────┬──────────────────────────────────────────┐
│   LOAD CASES     │  NODAL LOADS   │     MEMBER LOADS          │ AREA LOADS │           GENERATE                       │
│                  │                │                           │            │                                          │
│ [Define] [Combo] │ [Force][Moment]│ [UDL] [Trapez.] [Point]  │ [Floor Ld] │ [Self Wt][Wind] ASCE7Seis [Combinations] │
│ (large)          │                │                           │            │               IS1893Seis                 │
└──────────────────┴────────────────┴───────────────────────────┴────────────┴──────────────────────────────────────────┘
```

### Tool Groups & Sub-Elements

#### 9.1 LOAD CASES Group

| Button       | Size    | Icon       | Function                                                     |
|-------------|---------|------------|--------------------------------------------------------------|
| **Define**   | large   | `Layers`   | Opens `is875Load` modal — IS 875 load parts (Dead/Imposed/Wind/Snow/Special) |
| Combos       | normal  | `Workflow` | Opens `loadDialog` modal — 6-tab load input (Nodal/Member/Floor/Thermal/Prestress/Combos) |

**IS 875 Load Definition Dialog (5 parts):**

```
┌──────────────────────────────────────────────────────────────┐
│  IS 875 LOAD REFERENCE — Parts 1-5                    [✕]   │
├──────────────────────────────────────────────────────────────┤
│  [Part 1: Dead] [Part 2: Imposed] [Part 3: Wind]           │
│  [Part 4: Snow] [Part 5: Special]                            │
├──────────────────────────────────────────────────────────────┤
│  ──── Part 1: Dead Loads ────                                │
│  Material: [RCC ▼]  → 25 kN/m³                              │
│    (10 materials: RCC/PCC/Brick/Fly Ash/Steel/Timber/        │
│     Glass/Dry Earth/Wet Earth/Water)                         │
│  Floor Finishes: [Tiles 25mm ▼]                              │
│                                                              │
│  ──── Part 2: Imposed Loads ────                             │
│  Occupancy: [Office ▼]  → 2.5 kN/m²                         │
│    (18 types from Residential 2.0 to Industrial Heavy 10.0)  │
│                                                              │
│  ──── Part 4: Snow ────                                      │
│  Zone: [Zone 3 ▼]  → 2.0 kN/m²                              │
│                                                              │
│  ──── Part 5: Special ────                                   │
│  EOT Cranes: 5T/10T/25T, Machinery Impact, Elevator Impact  │
│                                                              │
│  Load Type: [UDL ▼] (UDL / UVL / Point)                     │
│  [Apply]                                                     │
└──────────────────────────────────────────────────────────────┘
```

> Complete material densities (10 entries), occupancy loads (18 entries), and snow zone data in **Appendix F.4 IS875LoadDialog**.

**Load Dialog (6-Tab — `loadDialog` modal):**

```
┌──────────────────────────────────────────────────────────────┐
│  LOAD DEFINITION                                      [✕]   │
├──────────────────────────────────────────────────────────────┤
│  [Nodal] [Member] [Floor] [Thermal] [Prestress] [Combos]   │
├──────────────────────────────────────────────────────────────┤
│  Active Load Case: [LC1 - Dead Load ▼]                       │
│                                                              │
│  ── Nodal Tab ── Defaults: Fy=-10kN (others 0)              │
│  ── Member Tab ── Types: Uniform(-10kN/m)/Trapezoidal/      │
│                   Point(-20kN at midspan)/Moment             │
│     Direction: 6 options (global_y, local_y, etc.)           │
│  ── Floor Tab ── Y-level, pressure, distribution             │
│  ── Thermal Tab ── Temperature change, gradient              │
│  ── Prestress Tab ── Cable force, profile                    │
│  ── Combos Tab ── Active load case management                │
│                                                              │
│  [Cancel]                                   [Apply]          │
└──────────────────────────────────────────────────────────────┘
```

> Full 6-tab field details in **Appendix F.23 LoadDialog**.

**Load Combination Dialog (`loadCombinationsDialog` modal):**

```
┌──────────────────────────────────────────────────────────────┐
│  LOAD COMBINATIONS                                    [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Code: [IS 456 LSM ▼] (IS 456 LSM → 10 combos /            │
│         ASCE 7 LRFD → 7 combos)                             │
│                                                              │
│  ┌────────┬────────────────────────────────────────┐        │
│  │ Combo  │ Expression                             │        │
│  ├────────┼────────────────────────────────────────┤        │
│  │ COMB1  │ 1.5(DL + LL)                           │        │
│  │ COMB2  │ 1.2(DL + LL + EL)                      │        │
│  │ COMB3  │ 1.5(DL + EL)                           │        │
│  │ COMB4  │ 0.9DL + 1.5EL                          │        │
│  │ COMB5  │ 1.5(DL + WL)                           │        │
│  │  ...   │ (up to 10 IS 456 or 7 ASCE 7)          │        │
│  └────────┴────────────────────────────────────────┘        │
│                                                              │
│  [Auto-Generate from Code]   [+ Manual Combo]               │
│                                                              │
│  ── Manual Entry ──                                          │
│  Name: [________________]                                    │
│  │ LC1 (Dead) × [1.5__] + LC2 (Live) × [1.5__] + ...       │
│                                                              │
│  Load Types: D, L, Lr, S, R, W, E, T                        │
│  Backend: POST `/load-combinations/generate`                 │
│                                                              │
│  [Cancel]                        [Apply Combinations]        │
└──────────────────────────────────────────────────────────────┘
```

> Complete ASCE 7 (7 combos) and IS 456 (10 combos) expressions in **Appendix F.7 LoadCombinationsDialog**.

#### 9.2 NODAL LOADS Group

| Button       | Size    | Icon         | Shortcut | Function                                        |
|-------------|---------|--------------|----------|-------------------------------------------------|
| **Force**    | normal  | `ArrowDown`  | `L`      | Sets `activeTool = "load"` → click node to apply |
| **Moment**   | normal  | `RotateCcw`  | —        | Sets `activeTool = "load"` → moment at node       |

**Nodal Load Application (via PropertiesPanel):**

When a node is selected, the Properties Inspector shows:
- **Fx** (kN): Horizontal force X
- **Fy** (kN): Vertical force (negative = downward)
- **Fz** (kN): Out-of-plane force Z
- **Mz** (kN·m): Moment about Z axis
- Expandable: Full 6-DOF input (Fx, Fy, Fz, Mx, My, Mz)
- Load case selector (which case the load belongs to)
- Add / Remove load buttons
- List of existing loads on the node

#### 9.3 MEMBER LOADS Group

| Button          | Size    | Icon          | Shortcut | Function                                          |
|----------------|---------|---------------|----------|---------------------------------------------------|
| **UDL**         | normal  | `Spline`      | `U`      | Sets `activeTool = "memberLoad"` → uniform dist.   |
| **Trapezoidal** | normal  | `TrendingUp`  | —        | Sets `activeTool = "memberLoad"` → varying load    |
| **Point**       | normal  | `Target`      | —        | Sets `activeTool = "memberLoad"` → concentrated    |

**Member Load Types:**

| Type         | Parameters                               | Visualization              |
|--------------|------------------------------------------|-----------------------------|
| UDL          | w (kN/m), direction, start pos, end pos  | Uniform arrows along member |
| Trapezoidal  | w1, w2 (kN/m), start, end, direction     | Varying arrows               |
| Point Load   | P (kN), position (ratio 0–1), direction  | Single arrow at point        |

**Direction Options (6 total):**
- `global_y` (vertical) — default
- `global_x` (horizontal)
- `global_z` (out-of-plane)
- `local_y` (perpendicular to member)
- `local_x` (axial / along member)
- `local_z` (local out-of-plane)

#### 9.4 AREA LOADS Group

| Button       | Size    | Icon          | Function                                         |
|-------------|---------|---------------|--------------------------------------------------|
| **Floor Load**| normal | `SquareStack` | Opens `loadDialog` → floor/roof area load         |

**Floor Load Dialog Elements:**
- Area (panel) selector — auto-detect or pick beams
- Load intensity (kN/m²) — default -5 (negative = downward)
- Load case assignment
- Distribution method: Auto-detect / One-way / Two-way
- Apply to: selected panels / all panels / by level
- Y-Level quick-select from detected floor levels
- Thickness: 0.15m default
- Auto-creates Plate elements + FloorLoad entries per detected panel
- See **Appendix F.17 PlateCreationDialog** and **Appendix F.18 FloorSlabDialog** for full field details.

#### 9.5 GENERATE Group

| Button          | Size    | Icon     | Function                                                      |
|----------------|---------|----------|---------------------------------------------------------------|
| **Self Weight** | normal  | `Weight` | Opens `deadLoadGenerator` — auto-generate gravity from density |
| **Wind**        | normal  | `Wind`   | Opens `windLoadDialog` — IS 875-III wind load gen              |
| ASCE 7 Seismic  | mini    | `Zap`    | Opens `asce7SeismicDialog` — ASCE 7 equivalent lateral force   |
| IS 1893 Seismic | mini    | `Zap`    | Opens `is1893SeismicDialog` — IS 1893 seismic load gen         |
| **Combinations**| normal  | `Layers` | Opens `loadCombinationsDialog` — auto-gen combos per code      |

**⚠ Recommended Additional Buttons (exist in code, no ribbon entry):**

| Button          | Size    | Icon     | Modal Key            | Function                             |
|----------------|---------|----------|----------------------|--------------------------------------|
| ASCE 7 Wind     | mini    | `Wind`   | `asce7WindDialog`    | ASCE 7-22 Ch.27 wind load gen        |
| Moving Load     | normal  | `Truck`  | `movingLoadDialog`   | IRC/AASHTO/EN moving load envelope   |

> Details: **Appendix F.3** (ASCE 7 Wind), **Appendix F.21** (Moving Load)

**Wind Load Generator Dialog (IS 875 Part 3: 2015):**

```
┌──────────────────────────────────────────────────────────────┐
│  WIND LOAD GENERATOR — IS 875 Part 3                  [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Code: [IS 875-III ▼]  (IS 875-III / ASCE 7-22 / EN 1991)  │
│                                                              │
│  ── Site Parameters ──                                       │
│  City: [Delhi ▼]  → auto-sets Vb  (16 cities or Custom)     │
│  Basic Wind Speed (Vb):  [  47  ] m/s                        │
│  Terrain Category:       [Category 2 ▼]  (1/2/3/4)          │
│  Structure Class:        [A ▼] (A/B/C)                       │
│  Design Life:            [  50  ] years                      │
│  ☐ Is Hilly Terrain   Hill Slope: [0] °  Hill Height: [0] m │
│  ☐ Is Cyclonic Region                                        │
│                                                              │
│  ── Structure Parameters ──                                  │
│  Building Type: [rectangular ▼] (rectangular/square/         │
│                  circular/industrial/frame)                   │
│  Building Height:  [ 30.0 ] m                                │
│  Building Width:   [ 20.0 ] m                                │
│  Building Depth:   [ 15.0 ] m                                │
│  Opening %:        [  5   ] %                                │
│  Wind Direction:   [X ▼] (X / Z / 45°)                      │
│                                                              │
│  ── Computed Values (auto-calculated) ──                     │
│  k1 (Risk Coefficient):     ______                           │
│  k2 (Terrain + Height):     ______                           │
│  k3 (Topography):           ______                           │
│  k4 (Cyclonic):             ______                           │
│  Vz at each height:         ______ m/s                       │
│  Design Pressure pz:        ______ kN/m²                     │
│  Cpe: W +0.7 / L -0.25 / S -0.7 / R -0.6                   │
│  Cpi: +0.2 / -0.2                                           │
│  Net pressures per zone:    ______ kN/m²                     │
│                                                              │
│  [Cancel]                  [Generate Wind Loads]             │
└──────────────────────────────────────────────────────────────┘
```

> For complete city→wind speed mapping (16 cities), terrain categories, and computed output fields, see **Appendix F.2 WindLoadDialog**.

**ASCE 7 Wind Load Generator (ASCE 7-22 Chapter 27):**
- Separate dialog: `asce7WindDialog`  
- 8 US cities with wind speeds (Miami 175mph → Seattle 100mph)
- Fields: riskCategory, exposure (B/C/D), dimensions, roofType, Kzt, Kd, enclosure
- Computed: Ke, GCpi, qh, pressures per height
- Backend: POST `/load-generation/asce7-wind`
- **⚠ Currently has NO ribbon button — needs to be wired** (see Gap Analysis §15)
- Full details in **Appendix F.3 ASCE7WindLoadDialog**

**Seismic Load Generator Dialog (IS 1893:2016):**

```
┌──────────────────────────────────────────────────────────────┐
│  SEISMIC LOAD GENERATOR — IS 1893:2016                [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Zone:    [Zone III ▼] (II → Z=0.10 / III → 0.16 /          │
│                         IV → 0.24 / V → 0.36)               │
│  Soil:    [Medium ▼] (Hard / Medium / Soft)                  │
│                                                              │
│  Building System: [SMRF ▼]                                   │
│    OMRF (R=3) / SMRF (R=5) / OSMRF (R=3) / SSMRF (R=5)    │
│    BF (R=4) / SW (R=3) / DUAL (R=5)                         │
│                                                              │
│  Importance: [Ordinary ▼] (Ordinary I=1.0 / Important 1.5 / │
│              Critical 1.5)                                   │
│                                                              │
│  Height: [30] m    Stories: [10]    Direction: [X ▼]         │
│  Damping Ratio: [0.05]                                       │
│                                                              │
│  Seismic Weight: [Auto ▼] (Auto-calc / Manual)              │
│                                                              │
│  ── Computed ──                                              │
│  Z: ___  I: ___  R: ___  Ta: ___ s                          │
│  Sa/g: ___  Ah: ___                                          │
│  W: ______ kN     Vb: ______ kN                             │
│                                                              │
│  ── Per-Floor Distribution ──                                │
│  ┌───────┬────────┬────────┬────────┬────────┐              │
│  │ Level │ Height │ Weight │ Force  │ Shear  │              │
│  │  10   │ 35.0 m │ 120 kN │ 28 kN  │ 28 kN  │             │
│  │  ...  │  ...   │  ...   │  ...   │  ...   │              │
│  │   1   │  3.5 m │ 120 kN │  1 kN  │ 150 kN │             │
│  └───────┴────────┴────────┴────────┴────────┘              │
│  Overturning Moment: ______ kN·m                             │
│                                                              │
│  [Cancel]             [Generate Seismic Loads]               │
└──────────────────────────────────────────────────────────────┘
```

> Full zone→Z mapping, building system→R table, and computed output in **Appendix F.5 IS1893SeismicLoadDialog**.

**ASCE 7 Seismic Generator (ASCE 7-22):**
- Opens via `asce7SeismicDialog`
- Inputs: Ss, S1, TL, Site Class A–E, Risk Category 1–4, 10 structural systems (R/Cd/Ω₀)
- Computed: Fa, Fv, SDS, SD1, Seismic Design Category (A–E), Ta, Cs, V, per-story forces
- Full details in **Appendix F.6 ASCE7SeismicLoadDialog**

---

## 10. Step 7 — Analysis

**Accent Color:** Emerald (`emerald-400/500`)  
**Sidebar:** Active step = `ANALYSIS`  
**Ribbon Tab:** ANALYSIS  

### Ribbon Layout

```
┌───────────────────────────┬──────────────────────────────┬──────────────────────────────────────┐
│          RUN              │         ADVANCED             │            RESULTS                   │
│                           │                              │                                      │
│ [▶ RUN ANALYSIS] Modal    │ [Buckling][Response][Pushover]│ [Deformed][Diagrams][Output][Export] │
│   (large+glow)   P-Delta  │                              │                                      │
└───────────────────────────┴──────────────────────────────┴──────────────────────────────────────┘
```

### Tool Groups & Sub-Elements

#### 10.1 RUN Group

| Button            | Size    | Icon       | Shortcut | Function                                           |
|-------------------|---------|------------|----------|----------------------------------------------------|
| **RUN ANALYSIS**  | large   | `Play`     | `F5`     | Dispatches `trigger-analysis` — runs linear static   |
| Modal             | mini    | `Activity` | —        | Dispatches `trigger-modal-analysis` — eigenmodes     |
| P-Delta           | mini    | `TrendingUp`| —       | Opens `pDeltaAnalysis` modal — geometric nonlinear   |

**RUN ANALYSIS Button Special Styling:**
- Default: `bg-emerald-600 text-white`, shadow glow, ring, pulsing animation
- Analyzing: `text-yellow-400 animate-pulse`
- This is the most prominent button in the entire ribbon

**Analysis Process:**
1. Validates model (nodes, members, supports, loads)
2. Assembles global stiffness matrix [K]
3. Applies boundary conditions
4. Solves [K]{d} = {F}
5. Computes reactions, member forces (SF, BM, AF)
6. Stores results in `analysisResults` of model store
7. Results accessible in Properties Inspector and Results visualizations

**P-Delta Dialog:**
- Iteration parameters: Max iterations, convergence tolerance
- Geometric stiffness matrix option
- P-Delta vs P-Big-Delta selection
- Load case selection for gravity loads

#### 10.2 ADVANCED Group

| Button       | Size    | Icon        | Function                                               |
|-------------|---------|-------------|--------------------------------------------------------|
| **Buckling** | normal  | `Activity`  | Opens `bucklingAnalysis` — linear buckling eigenvalues   |
| **Response** | normal  | `BarChart3` | Opens `advancedAnalysis` — response spectrum analysis    |
| **Pushover** | normal  | `Workflow`  | Opens `advancedAnalysis` — nonlinear static pushover     |

**Advanced Analysis Dialog (831 lines — 6 Tabs):**

```
┌──────────────────────────────────────────────────────────────┐
│  ADVANCED ANALYSIS                                    [✕]   │
├──────────────────────────────────────────────────────────────┤
│  [P-Delta] [Modal] [Time History] [Response Spectrum]       │
│  [Buckling] [Cable]                                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ── Response Spectrum Tab (IS 1893) ──                       │
│  Zone: [3 ▼] (2-5)   Soil: [II ▼] (I/II/III)              │
│  I Factor: [1.0 ▼] (1.0/1.2/1.5)                           │
│  R: [5.0 ▼] (1.5-5.0)   Modes: [12]   Direction: [X ▼]    │
│  Damping: [0.05]                                             │
│  [SVG Spectrum Graph]                                        │
│  Backend: POST `/analyze/spectrum`                           │
│                                                              │
│  ── P-Delta Tab ──                                           │
│  Iterations, convergence tolerance, geometric stiffness      │
│                                                              │
│  ── Modal Tab ──                                             │
│  Number of modes, mass participation threshold               │
│                                                              │
│  ── Time History Tab ──                                      │
│  Ground motion record, time step, duration                   │
│                                                              │
│  ── Buckling Tab ──                                          │
│  Number of modes, load case, buckling factors (λ)            │
│                                                              │
│  ── Cable Tab ──                                             │
│  Cable-specific nonlinear analysis                           │
│                                                              │
│  [Cancel]                         [Run Analysis]             │
└──────────────────────────────────────────────────────────────┘
```

> Full 6-tab input fields and backend endpoints in **Appendix F.9 AdvancedAnalysisDialog**.

**Buckling Analysis Dialog:**
- Number of modes to extract
- Load case selection
- Results: Buckling factors (λ) + mode shapes
- Critical load computation

**Response Spectrum Dialog:**
- Spectrum definition (code-based or user-defined)
- Code: IS 1893 / ASCE 7 / EC 8
- Soil type, zone, damping ratio
- Number of modes
- Combination method: SRSS / CQC / ABS

**Pushover Analysis Dialog:**
- Target displacement
- Hinge locations (member ends)
- Hinge properties (moment-rotation curve)
- Load pattern: Uniform / Triangular / Modal
- Performance point computation

#### 10.3 RESULTS Group

| Button       | Size    | Icon        | Function                                               |
|-------------|---------|-------------|--------------------------------------------------------|
| **Deformed** | normal  | `Eye`       | Dispatches `toggle-deformed` — show deformed shape      |
| **Diagrams** | normal  | `BarChart3` | Dispatches `toggle-diagrams` — SFD/BMD/AFD overlays     |
| **Output**   | normal  | `FileText`  | Toggles `showResults` in store — tabular results table   |
| **Export**    | normal  | `Download`  | Dispatches `trigger-export` — PDF/CSV/Excel export       |

**Deformed Shape Visualization:**
- Scale factor slider (1x to 1000x)
- Animation toggle (dynamic oscillation)
- Color map: displacement magnitude
- Original shape as wireframe overlay

**Diagrams Options:**
- Shear Force Diagram (SFD)
- Bending Moment Diagram (BMD)
- Axial Force Diagram (AFD)
- Torsion Diagram
- Scale factor control
- Member-by-member or global view

**Results Output Table:**
- Tabs: Displacements | Reactions | Member Forces | Member Stresses
- Sortable columns
- Filter by load case / member / node
- Export to: PDF, CSV, Excel

---

## 11. Step 8 — Design

**Accent Color:** Rose (`rose-400/500`)  
**Sidebar:** Active step = `DESIGN`  
**Ribbon Tab:** DESIGN  

### Ribbon Layout

```
┌──────────────────┬──────────────┬────────────┬─────────────┬────────────┬──────────────────┐
│   CODE CHECK     │ STEEL DESIGN │  RC DESIGN │ CONNECTION  │ FOUNDATION │    ADVANCED      │
│                  │              │            │             │            │                  │
│[Design ][D/C    ]│[Steel Studio]│[RC Studio] │[Connections]│[Foundation]│[Detailed][Curved]│
│ Codes   Ratios   │   (large)    │  (large)   │             │            │                  │
└──────────────────┴──────────────┴────────────┴─────────────┴────────────┴──────────────────┘
```

### Tool Groups & Sub-Elements

#### 11.1 CODE CHECK Group

| Button          | Size    | Icon          | Function                                              |
|----------------|---------|---------------|-------------------------------------------------------|
| **Design Codes**| large   | `FileCheck`   | Opens `designCodes` modal — select IS/AISC/EC code    |
| D/C Ratios      | normal  | `CheckSquare` | Runs analysis + shows demand/capacity ratios           |

**Design Code Selection Dialog (443 lines — 4 internal tabs):**

```
┌──────────────────────────────────────────────────────────────┐
│  DESIGN CODES                                         [✕]   │
├──────────────────────────────────────────────────────────────┤
│  [Steel Design] [Concrete] [Connection] [Foundation]        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ── Steel Design Tab ──                                      │
│  Sub-component: SteelDesignPanel                             │
│  ○ IS 800:2007 (Indian Standard)                            │
│  ○ AISC 360-22 (American Institute)                         │
│  ○ EN 1993-1-1 (Eurocode 3)                                 │
│  ○ BS 5950 (British Standard)                               │
│                                                              │
│  ── Concrete Tab ──                                          │
│  Sub-component: IS456DesignPanel                             │
│  ○ IS 456:2000                                              │
│  ○ ACI 318-19                                               │
│  ○ EN 1992-1-1 (Eurocode 2)                                 │
│  ○ BS 8110                                                  │
│                                                              │
│  ── Connection Tab ──                                        │
│  Sub-component: ConnectionDesignDialog (inline)              │
│                                                              │
│  ── Foundation Tab (inline design form) ──                   │
│  Footing Type: [isolated ▼] (isolated/combined/mat)          │
│  Column Load: [500] kN                                        │
│  Moment X: [50] kN·m   Moment Y: [0] kN·m                    │
│  SBC: [150 ▼] (100/150/200/300/450) kN/m²                    │
│  Concrete: [M25]                                              │
│  → Output: length/width/depth, rebarMain, status             │
│                                                              │
│  [Cancel]                           [Apply Code]             │
└──────────────────────────────────────────────────────────────┘
```

> Full tab details in **Appendix F.10 DesignCodesDialog**.

#### 11.2 STEEL DESIGN Group

| Button          | Size   | Icon        | Function                                      |
|----------------|--------|-------------|-----------------------------------------------|
| **Steel Studio**| large  | `Building2` | Opens `steelDesign` modal — full steel design  |

**Steel Design Studio (214 lines — 4 Tabs):**
- **Tab 1: Beam Design** → `SteelMemberDesigner` (lazy)
- **Tab 2: Column Design** → `EnhancedColumnDesignDialog` (lazy)
- **Tab 3: Composite Slab** → `EnhancedSlabDesignDialog` (lazy)
- **Tab 4: Code Compliance** → `CodeCompliancePanel` (lazy)
- Member list with sections and utilization ratios
- Code check: Tension, Compression, Flexure, Shear, Combined
- Clause-by-clause breakdown per IS 800 / AISC 360
- D/C ratio color coding: Green (<0.7), Yellow (0.7–0.9), Red (>0.9)
- Member optimization: auto-suggest lighter sections
- Detailed calculation report per member

> Full details in **Appendix F.11 SteelDesignDialog**.

#### 11.3 RC DESIGN Group

| Button       | Size   | Icon      | Function                                         |
|-------------|--------|-----------|--------------------------------------------------|
| **RC Studio**| large  | `Columns` | Opens `concreteDesign` modal — RC beam/column      |

**RC Design Studio (200 lines — 5 Tabs):**
- **Tab 1: RC Beam** → `RCBeamDesigner` — Flexure (Ast), Shear (stirrups), Deflection check
- **Tab 2: RC Column** → `RCColumnDesigner` — Axial + biaxial bending interaction diagram
- **Tab 3: RC Slab** → `RCSlabDesigner` — One-way/Two-way, strip method
- **Tab 4: Footing** → `RCFootingDesigner` — Isolated footing
- **Tab 5: Prestressed** → `PrestressedDesigner` — Prestressed beam design
- Reinforcement detailing: bar scheduling, curtailment
- Detailing drawings: cross-section with rebar placement
- Code: IS 456 / ACI 318 / EC 2

> Full details in **Appendix F.12 ConcreteDesignDialog**.

#### 11.4 CONNECTION Group

| Button          | Size   | Icon   | Function                                          |
|----------------|--------|--------|---------------------------------------------------|
| **Connections** | normal | `Link2`| Opens `connectionDesign` modal — bolted/welded      |

**Connection Design Dialog (568 lines — IS 800:2007 Ch.10):**

4 Connection Types: Simple Shear / Moment End Plate / Welded / Column Base Plate

| Parameter        | Options                                    |
|------------------|--------------------------------------------|
| Bolt Grades      | 4.6, 8.8, 10.9                            |
| Bolt Diameters   | 12, 16, 20, 22, 24, 27, 30, 36 mm         |
| Plate Thickness  | 8–40 mm                                    |
| Weld Sizes       | per specification                          |

Output: numBolts, boltRows/Cols, plateWidth/Height/Thickness, weldLength, checks[] (name/demand/capacity/ratio/status/clause), overallStatus, **SVG connection sketch**

> Full details in **Appendix F.13 ConnectionDesignDialog**.

#### 11.5 FOUNDATION Group

| Button          | Size   | Icon       | Function                                         |
|----------------|--------|------------|--------------------------------------------------|
| **Foundation**  | normal | `Landmark` | Opens `foundationDesign` modal                    |

**Foundation Design — TWO dialog implementations:**

**Basic (559 lines — `foundationDesign`):**
- 8 soil types (Soft Clay 100kPa → Hard Rock 1000kPa)
- Isolated footing design, IS 456 code
- Output: width/length/depth, rebarMain/Dist, concreteVolume, safety factor, status (safe/unsafe/marginal)
- See **Appendix F.14 FoundationDesignDialog**

**Enhanced (1255 lines — `foundationDesign` enhanced version):**
- 6 foundation types (Isolated Square/Rectangular/Circular, Combined, Strip, Raft)
- 8 extended soil types (Soft Clay 75kPa → Hard Rock 1500kPa)
- Materials: M20–M50 concrete, Fe415/Fe500/Fe550 steel
- 5 design codes: IS 456:2000, IS 2950, ACI 318-19, EN 1992, BS 8110
- Uses `AdvancedFoundationDesignEngine`
- StatusBadge, UtilizationBar, DesignCheckCard (demand/capacity/ratio/clause)
- See **Appendix F.15 EnhancedFoundationDesignDialog**

#### 11.6 ADVANCED Group

| Button       | Size   | Icon    | Function                                              |
|-------------|--------|---------|-------------------------------------------------------|
| **Detailed** | normal | `Ruler` | Opens `detailedDesign` — section optimization           |
| **Curved**   | normal | `Globe` | Opens `curvedStructure` — dome/arch/shell generator     |

---

## 12. Step 9 — Civil Engineering

**Accent Color:** Amber (`amber-400/500`)  
**Sidebar:** Active step = `CIVIL`  
**Ribbon Tab:** CIVIL ENGG  

### Ribbon Layout

```
┌────────────────────────────────┬──────────────────────────┬──────────────────────┬───────────────────────────────────┐
│      CIVIL ENGINEERING         │     INFRASTRUCTURE       │       DESIGN         │         ADVANCED AI               │
│                                │                          │                      │                                   │
│ [Civil Hub] [Geotech] [Hydro] │ [Transport] [Construct.] │ [Steel] [Conc] [Conn]│ [AI Architect][Generative][Seismic]│
│  (large)                       │                          │                      │                                   │
└────────────────────────────────┴──────────────────────────┴──────────────────────┴───────────────────────────────────┘
```

### Tool Groups & Sub-Elements

#### 12.1 CIVIL ENGINEERING Group

| Button       | Size   | Icon        | Function                                             |
|-------------|--------|-------------|------------------------------------------------------|
| **Civil Hub**| large  | `Globe`     | Opens `civilEngineering` — civil design center        |
| Geotech      | normal | `Mountain`  | Opens `civilEngineering` — geotechnical module         |
| Hydraulics   | normal | `Droplets`  | Opens `civilEngineering` — hydraulics module           |

**Civil Engineering Hub Dialog (200 lines — 4 Tabs, lazy-loaded):**

| Tab              | Sub-component            | Capabilities                                          |
|------------------|--------------------------|-------------------------------------------------------|
| Geotechnical     | `BearingCapacityCalculator` | Terzaghi/Meyerhof/IS 6403, settlement, earth pressure, slope stability |
| Hydraulics       | `HydraulicsDesigner`     | Open channel (Manning's), pipe networks, culverts     |
| Transportation   | `TransportationDesigner` | Highway geometry, pavement (IRC 37/58), traffic       |
| Construction     | `ConstructionManager`    | CPM/PERT, Gantt, cost estimation, resource leveling   |

> Full details in **Appendix F.16 CivilEngineeringDialog**.

#### 12.2 INFRASTRUCTURE Group

| Button          | Size   | Icon      | Function                                           |
|----------------|--------|-----------|-----------------------------------------------------|
| **Transport**   | normal | `Car`     | Opens `civilEngineering` — transportation module     |
| **Construction**| normal | `HardHat` | Opens `civilEngineering` — construction management   |

**Transportation:**
- Highway Geometric Design: Horizontal/Vertical curves, superelevation
- Pavement Design: Flexible (IRC 37) / Rigid (IRC 58)
- Traffic Analysis: LOS, signal design, PCU conversion

**Construction Management:**
- CPM/PERT network scheduling
- Gantt chart generation
- Cost Estimation: BOQ, rate analysis
- Resource leveling

**⚠ Recommended Additional Button (exists in code, no ribbon entry):**

| Button              | Size   | Icon      | Modal Key         | Function                                |
|--------------------|--------|-----------|-------------------|-----------------------------------------|
| **Railway Bridge**  | normal | `Train`   | `railwayBridge`   | IRS/RDSO/Cooper E-80 bridge loading      |

> Railway Bridge dialog details in **Appendix F.22 RailwayBridgeDialog**.

#### 12.3 DESIGN Group (Civil Tab)

| Button       | Size   | Icon        | Function                                 |
|-------------|--------|-------------|------------------------------------------|
| Steel        | normal | `Building2` | Opens `steelDesign` (same as Design tab) |
| Concrete     | normal | `Columns`   | Opens `concreteDesign` (same as Design)  |
| Connect      | normal | `Link2`     | Opens `connectionDesign` (same as Design)|

These are duplicated from the Design tab for quick access within the Civil workflow.

#### 12.4 ADVANCED AI Group

| Button          | Size   | Icon       | Function                                          |
|----------------|--------|------------|---------------------------------------------------|
| **AI Architect**| normal | `Sparkles` | Dispatches `toggle-ai-architect` — AI assistant    |
| **Generative**  | normal | `Sparkles` | Opens `generativeDesign` — topology optimization   |
| **Seismic**     | normal | `BarChart3`| Opens `seismicStudio` — seismic design studio      |

**AI Architect Features:**
- Natural language structural modeling ("Create a 3-bay 2-story frame")
- AI-powered load recommendation
- Code compliance checking with AI explanation
- Design optimization suggestions

**Generative Design Features:**
- Topology optimization
- Shape optimization
- Size optimization
- Objective: Minimize weight / Minimize deflection / Minimize cost
- Constraints: Maximum stress, deflection limit, buckling factor
- AI-driven member size selection

**Seismic Studio Features:**
- Multi-modal response spectrum analysis
- Pushover curve visualization
- Performance-based design: IO / LS / CP levels
- Code-specific: IS 1893 / ASCE 7 / EC 8

---

## 13. Properties Inspector (Right Panel)

The right panel (280px) is context-sensitive — it changes based on the current selection in the 3D viewport.

### 13.1 No Selection State

```
┌─────────────────────────┐
│  Properties        [-]  │
├─────────────────────────┤
│                         │
│  No selection           │
│                         │
│  ─────────────────────  │
│  ✓ Analysis complete    │  ← Only if results exist
│                         │
└─────────────────────────┘
```

### 13.2 Single Node Selected

```
┌─────────────────────────────────┐
│  Node Properties    #N3    [-] │
├─────────────────────────────────┤
│                                 │
│  📍 Coordinates                 │
│     X: [  3.000 ] m            │
│     Y: [  0.000 ] m            │
│     Z: [  0.000 ] m            │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  🔒 Boundary Conditions         │
│  [Fixed] [Pinned] [Roller][Free]│
│                                 │
│  ┌────┬────┬────┬────┬────┬────┐│
│  │ Tx │ Ty │ Tz │ Rx │ Ry │ Rz ││
│  │ 🔒 │ 🔒 │ 🔒 │ 🔓 │ 🔓 │ 🔓 ││ ← Pinned
│  └────┴────┴────┴────┴────┴────┘│
│                                 │
│  ─────────────────────────────  │
│                                 │
│  ⬇ Nodal Loads                  │
│  ┌─────────────────────────┐   │
│  │ Fy: -10 kN  [🗑]        │   │
│  └─────────────────────────┘   │
│  Fx: [  0  ] Fy: [-10 ] kN    │
│  Fz: [  0  ] Mz: [  0 ] kN·m │
│  [+ Add Load]                   │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  📊 Results (Post-Analysis)     │
│  Displacement                   │
│     dx: 0.00234 m              │
│     dy: -0.00891 m             │
│     rz: 0.00012 rad            │
│  Reactions (if supported)       │
│     Rx: 15.2 kN                │
│     Ry: 42.8 kN                │
│     Mz: 0 kN·m                 │
│                                 │
└─────────────────────────────────┘
```

**Elements & Functions:**

| Section               | Elements                    | Function                          |
|-----------------------|-----------------------------|-----------------------------------|
| Coordinates           | 3× NumberInput (X, Y, Z)    | Edit node position in real-time   |
| Boundary Conditions   | 4 preset buttons + 6 DOF toggles | Set support type             |
| Nodal Loads           | Load list + input fields + Add | Add/remove nodal forces/moments |
| Results               | Read-only displacement/reaction | View analysis results          |

### 13.3 Single Member Selected

```
┌────────────────────────────────────┐
│  Member Properties   #M7     [-]  │
│  [BEAM] ───────────── active      │
├────────────────────────────────────┤
│                                    │
│  🔗 Connectivity                   │
│     Start: N1    End: N4           │
│                                    │
│  📐 Geometry                       │
│     Length: 4.000 m                │
│     Angle: 0°                      │
│                                    │
│  ─────────────────────────         │
│                                    │
│  📏 Section                        │
│  Category: [ISMB ▼]               │
│  Section:  [ISMB 200 ▼]           │
│  A: 3232 mm²  Ix: 2235 cm⁴       │
│                                    │
│  ☐ Custom Section                  │
│    A: [___] cm²  I: [___] cm⁴     │
│                                    │
│  ─────────────────────────         │
│                                    │
│  🔄 Beta Angle                     │
│     β: [  0  ] degrees            │
│                                    │
│  ─────────────────────────         │
│                                    │
│  🧱 Material                      │
│  [Fe 250 ▼]                       │
│  E: 200 GPa  fy: 250 MPa         │
│                                    │
│  ☐ Custom E: [___] GPa            │
│                                    │
│  ─────────────────────────         │
│                                    │
│  🔓 End Releases                   │
│  Start: ☐ Moment                  │
│  End:   ☐ Moment                  │
│                                    │
│  ─────────────────────────         │
│                                    │
│  📊 Member Forces (Post-Analysis)  │
│  ┌─────────┬───────┬───────┐      │
│  │ Station │ SF(kN)│ BM(kN·m)│    │
│  ├─────────┼───────┼───────┤      │
│  │ Start   │ 12.5  │  0.0  │      │
│  │ Mid     │  0.0  │ -15.6 │      │
│  │ End     │-12.5  │  0.0  │      │
│  └─────────┴───────┴───────┘      │
│                                    │
│  ─────────────────────────         │
│                                    │
│  📦 Member Loads                   │
│  [Existing: UDL -10 kN/m  [🗑]]  │
│  W: [-10__] kN/m                   │
│  Direction: [Global Y ▼]          │
│  From: [0.0] To: [1.0]            │
│  [+ Add UDL]                       │
│                                    │
└────────────────────────────────────┘
```

**Elements & Functions:**

| Section         | Elements                            | Function                                |
|-----------------|-------------------------------------|-----------------------------------------|
| Type Badge      | BEAM / COLUMN / CABLE / ARCH        | Read-only member type indicator         |
| Connectivity    | Start/End node IDs                  | Read-only — shows connected nodes        |
| Geometry        | Length, angle                        | Read-only computed values                |
| Section         | Category dropdown + section dropdown | Assign cross-section from library       |
| Custom Section  | Area (cm²) + Ix (cm⁴) inputs       | Override with custom values              |
| Beta Angle      | Angle input (degrees)               | Rotate local axes about longitudinal     |
| Material        | Material dropdown                    | Assign from material database           |
| Custom E        | Young's modulus input                | Override material stiffness              |
| End Releases    | Start/End moment checkboxes          | Create pin at member ends                |
| Member Forces   | Table: station, SF, BM               | Post-analysis force readout              |
| Member Loads    | UDL input + direction + range        | Apply distributed loads                  |

### 13.4 Multi-Selection (Members Only)

```
┌────────────────────────────────┐
│  Bulk Edit                [-] │
│  [5 Members]                   │
├────────────────────────────────┤
│                                │
│  📏 Section Category           │
│  [ISMB ▼]                     │
│                                │
│  📦 Set Section                │
│  [Select to apply to all... ▼]│
│                                │
│  ─────────────────────         │
│                                │
│  🧱 Set Material               │
│  [Select to apply to all... ▼]│
│                                │
│  ─────────────────────         │
│                                │
│  🔓 Bulk Releases              │
│  ☐ Start   ☐ End              │
│                                │
│  ─────────────────────         │
│                                │
│  [🗑 Delete All Selected]      │
│                                │
└────────────────────────────────┘
```

### 13.5 Mixed Selection (Nodes + Members)

```
┌────────────────────────────────┐
│  Multiple Selection       [-] │
├────────────────────────────────┤
│  ● 3 Nodes                    │
│  ─ 5 Members                  │
│                                │
│  [🗑 Delete Selection]         │
└────────────────────────────────┘
```

---

## 14. Floating Modeling Toolbar

**Visibility:** Only when `activeCategory === "MODELING"`  
**Position:** Floating over 3D viewport (top-center or left side)  
**Style:** Semi-transparent dark panel with blur backdrop  

### Quick Access Buttons (Always Visible)

| Icon           | Tool          | Shortcut | Function            |
|----------------|---------------|----------|---------------------|
| `MousePointer` | SELECT        | `Esc`    | Click-to-select     |
| `CircleDot`    | DRAW_NODE     | `N`      | Place node          |
| `Minus`        | DRAW_BEAM     | `B`      | Draw beam           |
| `ArrowDown`    | DRAW_COLUMN   | `V`      | Draw column         |
| `Trash2`       | DELETE        | `Del`    | Delete selected     |

### Dropdown Menus

Each dropdown group shows a chevron. On click, expands to show sub-tools:

```
┌────────────────────────────────────────────────────────────────────────┐
│  [▶ Select ▾] [✏ Draw ▾] [🔧 Edit ▾] [▦ Array ▾]                    │
│  [↻ Transform ▾] [🏗 Generate ▾] [📏 Measure ▾]                      │
└────────────────────────────────────────────────────────────────────────┘
```

(Full dropdown contents documented in Section 4 under "Floating Modeling Toolbar")

---

## 15. Gap Analysis & Recommendations

### Critical Gaps (Must Fix)

| #  | Issue                                      | Current State                              | Recommendation                                        |
|----|--------------------------------------------|--------------------------------------------|-------------------------------------------------------|
| 1  | **Properties tab buttons → generic modal** | Assign, Builder, Material all open `geometryTools` | Create `materialLibraryDialog`, `sectionAssignDialog`, `sectionBuilderDialog`, `betaAngleDialog`, `memberReleasesDialog`, `memberOffsetsDialog` |
| 2  | **No dedicated Material dialog**           | Material button opens `geometryTools`      | Build Material Database dialog per Section 6 spec      |
| 3  | **No dedicated Specifications dialogs**    | Beta/Releases/Offsets all → `geometryTools`| Build 3 separate dialogs per Section 7 spec            |
| 4  | **ASCE 7 Wind not wired**                 | No button routes to `asce7WindDialog`      | Add "ASCE 7 Wind" mini button in Generate group        |
| 5  | **Member load types limited**              | PropertiesPanel only shows UDL form        | Add Trapezoidal and Point Load forms to inspector       |

### Missing Features (Should Add)

| #  | Feature                          | Current State                    | Recommendation                              |
|----|----------------------------------|----------------------------------|---------------------------------------------|
| 6  | Meshing modal button             | Modal exists, no ribbon entry    | Add "Mesh" ToolButton in Create group        |
| 7  | Moving Load dialog               | Dialog exists, no ribbon entry   | Add "Moving Load" button in Loading ribbon   |
| 8  | Railway Bridge modal             | Dialog exists, no ribbon entry   | Add button in Civil→Infrastructure group     |
| 9  | SmartSidebar (1842 lines)        | Fully built, NOT mounted         | Mount or deprecate — 1800 lines of dead code |
| 10 | RightPropertiesPanel             | Built but not mounted            | Mount or merge into PropertiesPanel          |
| 11 | DataTablesPanel                  | Built but not mounted            | Mount as toggle-able results view            |
| 12 | Unit switching                   | Hard-coded "kN, m"               | Add unit system toggle in File/Settings      |

### UI/UX Improvements

| #  | Improvement                        | Description                                              |
|----|------------------------------------|----------------------------------------------------------|
| 13 | Workflow step completion markers   | Show ✓ when a step has data (e.g., supports assigned)    |
| 14 | Sidebar → Ribbon auto-focus       | When MATERIALS clicked, auto-open Material dialog         |
| 15 | Ribbon overflow handling           | Horizontal scroll indicator for smaller screens           |
| 16 | Properties panel context linking   | Sidebar step should highlight matching inspector section  |
| 17 | Keyboard navigation                | Tab through ribbon groups, Enter to activate              |
| 18 | Properties → PROPERTIES mapping    | Steps 2/3/4 all map to same tab; add sub-tab switching    |

### Recommended Category Store Extension

Currently Steps 2 (Properties), 3 (Materials), 4 (Specifications) all map to the single `PROPERTIES` category. Consider:

```typescript
// Current
type Category = 'MODELING' | 'PROPERTIES' | 'LOADING' | 'ANALYSIS' | 'DESIGN' | 'CIVIL';

// Proposed: Add sub-categories or use activeStep for ribbon filtering
type SubCategory = 'SECTIONS' | 'MATERIALS' | 'SPECIFICATIONS';

// Or: Keep categories, but switch ribbon content based on activeStep
if (activeStep === 'MATERIALS') renderMaterialsRibbon();
else if (activeStep === 'SPECS') renderSpecificationsRibbon();
else renderPropertiesRibbon(); // default
```

This would allow distinct ribbon content for Materials and Specifications steps while keeping the 6-tab category system.

---

## Appendix A: Complete Modal Registry

All modals tracked in `uiStore.ts`:

| Modal Key                   | Trigger From                | Purpose                                |
|-----------------------------|-----------------------------|----------------------------------------|
| `structureWizard`           | Geometry → Structure        | Parametric structure generation        |
| `structureGallery`          | Geometry → Structure        | Pre-built structure library            |
| `geometryTools`             | Properties tab (catch-all)  | Generic geometry/property editor       |
| `sectionBrowserDialog`      | Properties → Section Library| Section database browser               |
| `plateDialog`               | Geometry → Create           | Plate/shell element creation           |
| `floorSlabDialog`           | Geometry → Create           | Floor slab auto-generation             |
| `selectionToolbar`          | Geometry → Select           | Advanced selection filters             |
| `boundaryConditionsDialog`  | Sidebar → Supports          | Support/restraint assignment           |
| `is875Load`                 | Loading → Define            | Load case management                   |
| `loadDialog`                | Loading → Combos/Area       | Load combinations / floor loads         |
| `deadLoadGenerator`         | Loading → Self Weight       | Self-weight load generation            |
| `windLoadDialog`            | Loading → Wind              | Wind load generator                    |
| `asce7SeismicDialog`        | Loading → ASCE 7 Seismic    | ASCE 7 seismic load generation         |
| `is1893SeismicDialog`       | Loading → IS 1893 Seismic   | IS 1893 seismic load generation        |
| `loadCombinationsDialog`    | Loading → Combinations      | Load combination auto-generation       |
| `pDeltaAnalysis`            | Analysis → P-Delta          | P-Delta analysis setup                 |
| `bucklingAnalysis`          | Analysis → Buckling         | Buckling analysis settings             |
| `advancedAnalysis`          | Analysis → Response/Pushover| Advanced analysis methods               |
| `designCodes`               | Design → Code Check         | Design code selection                   |
| `steelDesign`               | Design → Steel Studio       | Steel design studio                    |
| `concreteDesign`            | Design → RC Studio          | Reinforced concrete design              |
| `connectionDesign`          | Design → Connections        | Connection design tools                 |
| `foundationDesign`          | Design → Foundation         | Foundation design                       |
| `detailedDesign`            | Design → Detailed           | Detailed section design                 |
| `curvedStructure`           | Design → Curved             | Curved structure generator              |
| `civilEngineering`          | Civil → All buttons         | Civil engineering hub                   |
| `generativeDesign`          | Civil → Generative          | AI generative design                    |
| `seismicStudio`             | Civil → Seismic             | Seismic design studio                   |

---

## Appendix B: Icon Mapping (Lucide React)

All icons used in the workflow system, grouped by function:

| Category       | Icons Used                                                                    |
|----------------|-------------------------------------------------------------------------------|
| File/System    | `Save`, `FolderOpen`, `Download`, `Undo`, `Redo`, `Menu`, `Cpu`, `Crown`    |
| Create/Draw    | `Box`, `Spline`, `Grid`, `Layers`, `CircleDot`, `Minus`, `Cable`, `Square`  |
| Select/Edit    | `MousePointer2`, `Search`, `Copy`, `Move`, `FlipHorizontal`, `RotateCcw`    |
| Edit           | `Scissors`, `Trash2`, `Split`, `Merge`, `AlignLeft`                          |
| Properties     | `Settings`, `Calculator`, `Database`, `Table2`, `Link2`, `Ruler`, `Wrench`  |
| Supports       | `Anchor`, `Lock`, `Unlock`                                                   |
| Loading        | `ArrowDown`, `TrendingUp`, `Target`, `SquareStack`, `Weight`, `Wind`, `Zap` |
| Analysis       | `Play`, `Activity`, `BarChart3`, `Workflow`, `Eye`, `FileText`               |
| Design         | `FileCheck`, `CheckSquare`, `Building2`, `Columns`, `Landmark`, `Globe`      |
| Civil          | `Mountain`, `Droplets`, `Car`, `HardHat`, `Sparkles`                         |
| UI State       | `ChevronDown`, `ChevronRight`, `Minimize2`, `Maximize2`, `ChevronsLeft/Right`|

---

## Appendix C: Keyboard Shortcut Map

| Shortcut          | Action                    | Context        |
|-------------------|---------------------------|----------------|
| `Esc`             | Select tool               | Global         |
| `N`               | Draw Node                 | Geometry       |
| `M` / `B`         | Draw Beam                 | Geometry       |
| `V`               | Draw Column               | Geometry       |
| `P`               | Create Plate              | Geometry       |
| `L`               | Nodal Load tool           | Loading        |
| `U`               | UDL tool                  | Loading        |
| `Z`               | Zoom Window               | Global         |
| `Del`             | Delete selection          | Global         |
| `Ctrl+S`          | Save                      | Global         |
| `Ctrl+O`          | Open                      | Global         |
| `Ctrl+Z`          | Undo                      | Global         |
| `Ctrl+Shift+Z`    | Redo                      | Global         |
| `Ctrl+C`          | Copy                      | Global         |
| `Ctrl+Shift+W`    | Structure Wizard          | Geometry       |
| `F5`              | Run Analysis              | Analysis       |
| `Shift+S`         | Box Select                | Geometry       |

---

## Appendix D: Complete Data Model Interfaces

### D.1 Node

```typescript
interface Node {
  id: string;
  x: number;        // meters
  y: number;        // meters
  z: number;        // meters
  restraints?: Restraints;
}
```

### D.2 Restraints

```typescript
interface Restraints {
  fx: boolean;   // Translation X
  fy: boolean;   // Translation Y
  fz: boolean;   // Translation Z
  mx: boolean;   // Rotation X
  my: boolean;   // Rotation Y
  mz: boolean;   // Rotation Z
}
```

### D.3 Member

```typescript
interface Member {
  id: string;
  startNodeId: string;
  endNodeId: string;
  sectionId?: string;
  sectionType?: SectionType;    // 'I-BEAM'|'TUBE'|'L-ANGLE'|'RECTANGLE'|'CIRCLE'|'C-CHANNEL'|'T-SECTION'|'DOUBLE-ANGLE'|'PIPE'|'TAPERED'|'BUILT-UP'
  dimensions?: SectionDimensions;
  E?: number;                    // Young's Modulus (kN/m²)
  A?: number;                    // Cross-sectional Area (m²)
  I?: number;                    // Moment of Inertia Ix (m⁴)
  Iy?: number;                   // Moment of Inertia about local y (m⁴)
  Iz?: number;                   // Moment of Inertia about local z (m⁴)
  J?: number;                    // Torsion constant (m⁴)
  G?: number;                    // Shear Modulus (kN/m²)
  rho?: number;                  // Density (kg/m³), default 7850
  releases?: {
    startMoment?: boolean;       // Legacy: moment release at start
    endMoment?: boolean;         // Legacy: moment release at end
    // Full 3D releases (12 DOFs)
    fxStart?: boolean; fyStart?: boolean; fzStart?: boolean;
    mxStart?: boolean; myStart?: boolean; mzStart?: boolean;
    fxEnd?: boolean;   fyEnd?: boolean;   fzEnd?: boolean;
    mxEnd?: boolean;   myEnd?: boolean;   mzEnd?: boolean;
  };
  startOffset?: { x: number; y: number; z: number };
  endOffset?: { x: number; y: number; z: number };
  betaAngle?: number;            // degrees
}
```

### D.4 Section Dimensions (all optional, per sectionType)

| Section Type   | Parameters                                                                         |
|---------------|------------------------------------------------------------------------------------|
| I-BEAM        | height, width, webThickness, flangeThickness                                       |
| TUBE/BOX      | outerWidth, outerHeight, thickness                                                 |
| L-ANGLE       | legWidth, legHeight, thickness                                                     |
| RECTANGLE     | rectWidth, rectHeight                                                              |
| CIRCLE        | diameter                                                                           |
| C-CHANNEL     | channelHeight, channelWidth, channelThickness                                      |
| T-SECTION     | tFlangeWidth, tFlangeThickness, tStemHeight, tStemThickness                        |
| DOUBLE-ANGLE  | daLegWidth, daLegHeight, daThickness, daGap                                        |
| PIPE          | pipeOuterDiameter, pipeWallThickness                                               |
| TAPERED       | startDepth, endDepth, taperFlangeWidth, taperWebThickness, taperFlangeThickness    |
| BUILT-UP      | builtUpType('plate_girder'|'box_girder'|'compound'), builtUpWebHeight, builtUpWebThickness, builtUpTopFlangeWidth, builtUpTopFlangeThickness, builtUpBotFlangeWidth, builtUpBotFlangeThickness |

### D.5 NodeLoad

```typescript
interface NodeLoad {
  id: string;
  nodeId: string;
  fx?: number;   // Force X (kN)
  fy?: number;   // Force Y (kN)
  fz?: number;   // Force Z (kN)
  mx?: number;   // Moment X (kN·m)
  my?: number;   // Moment Y (kN·m)
  mz?: number;   // Moment Z (kN·m)
}
```

### D.6 MemberLoad

```typescript
type MemberLoadType = 'UDL' | 'UVL' | 'point' | 'moment';

interface MemberLoad {
  id: string;
  memberId: string;
  type: MemberLoadType;
  w1?: number;         // Start intensity (kN/m) — for UDL: w1 = w2
  w2?: number;         // End intensity (kN/m)
  P?: number;          // Point load magnitude (kN)
  M?: number;          // Point moment magnitude (kN·m)
  a?: number;          // Distance from start node (m or ratio 0–1)
  direction: 'local_y' | 'local_z' | 'global_x' | 'global_y' | 'global_z' | 'axial';
  startPos?: number;   // 0–1 ratio (default 0)
  endPos?: number;     // 0–1 ratio (default 1)
}
```

### D.7 Load Case & Combination

```typescript
type LoadCaseType = 'dead' | 'live' | 'wind' | 'seismic' | 'snow' | 'temperature' | 'self_weight' | 'custom';

interface LoadCase {
  id: string;
  name: string;
  type: LoadCaseType;
  loads: NodeLoad[];
  memberLoads: MemberLoad[];
  selfWeight?: boolean;
  factor?: number;              // Default 1.0
}

interface LoadCombination {
  id: string;
  name: string;
  code?: string;                // 'IS 875' | 'ASCE 7' | 'ASCE 7-22'
  factors: { loadCaseId: string; factor: number }[];
}
```

### D.8 Floor Load

```typescript
interface FloorLoad {
  id: string;
  pressure: number;             // kN/m² (negative = downward)
  yLevel: number;               // Floor Y coordinate (m)
  xMin: number; xMax: number;   // Bounding box
  zMin: number; zMax: number;
  distributionOverride?: 'one_way' | 'two_way_triangular' | 'two_way_trapezoidal';
  loadCase?: string;
}
```

### D.9 Plate

```typescript
interface Plate {
  id: string;
  nodeIds: [string, string, string, string];  // 4 corner nodes CCW
  thickness: number;                           // meters
  E?: number;                                  // kN/m² (default 200e6)
  nu?: number;                                 // Poisson's ratio (default 0.3)
  pressure?: number;                           // kN/m² (positive = downward)
  materialType?: 'steel' | 'concrete' | 'custom';
}
```

### D.10 Analysis Results

```typescript
interface AnalysisResults {
  displacements: Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>;
  reactions: Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>;
  memberForces: Map<string, MemberForceData>;
  plateResults?: Record<string, { stress_xx, stress_yy, stress_xy, moment_xx, moment_yy, moment_xy, displacement, von_mises }>;
  equilibriumCheck?: {
    applied_forces: number[];   // [Fx, Fy, Fz, Mx, My, Mz]
    reaction_forces: number[];
    residual: number[];
    error_percent: number;      // < 0.1% acceptable
    pass: boolean;
  };
  conditionNumber?: number;
  stats?: {
    solveTimeMs: number;
    assemblyTimeMs?: number;
    totalTimeMs?: number;
    method?: string;
    usedCloud?: boolean;
    fallbackFromLocal?: boolean;
  };
}
```

### D.11 Member Force Data (with Diagrams)

```typescript
interface MemberForceData {
  axial: number;
  shearY: number;
  shearZ: number;
  momentY: number;
  momentZ: number;
  torsion: number;
  startForces?: { axial, shearY, shearZ?, momentY?, momentZ, torsion? };
  endForces?: { axial, shearY, shearZ?, momentY?, momentZ, torsion? };
  diagramData?: {
    x_values: number[];
    shear_y: number[]; shear_z: number[];
    moment_y: number[]; moment_z: number[];
    axial: number[]; torsion: number[];
    deflection_y: number[]; deflection_z: number[];
  };
}
```

### D.12 Project Info

```typescript
interface ProjectInfo {
  name: string;
  client: string;
  engineer: string;
  jobNo: string;
  rev: string;
  date: Date;
  description: string;
  cloudId?: string;
}
```

---

## Appendix E: Complete CATEGORY_TOOLS Mapping

These are the valid `activeTool` values per store category. When a category is switched, the tool auto-resets to the first item in its list.

### MODELING (40 tools)
| Group      | Tools                                                                                            |
|------------|--------------------------------------------------------------------------------------------------|
| Selection  | `SELECT`, `SELECT_RANGE`, `PAN`, `ZOOM_WINDOW`                                                  |
| Draw       | `DRAW_NODE`, `DRAW_BEAM`, `DRAW_COLUMN`, `DRAW_CABLE`, `DRAW_ARCH`, `DRAW_RIGID_LINK`, `DRAW_PLATE` |
| Edit       | `COPY`, `MIRROR`, `DELETE`, `DIVIDE_MEMBER`, `MERGE_NODES`, `ALIGN_NODES`, `SPLIT_MEMBER`        |
| Array      | `ARRAY_LINEAR`, `ARRAY_POLAR`, `ARRAY_3D`                                                        |
| Transform  | `MOVE`, `ROTATE`, `SCALE`, `OFFSET_MEMBER`, `EXTRUDE`                                            |
| Generate   | `GRID_GENERATE`, `GRID_3D`, `CIRCULAR_GRID`, `TRUSS_GENERATOR`, `ARCH_GENERATOR`, `PIER_GENERATOR`, `TOWER_GENERATOR`, `DECK_GENERATOR`, `CABLE_PATTERN`, `FRAME_GENERATOR`, `STAIRCASE_GENERATOR` |
| Measure    | `MEASURE_DISTANCE`, `MEASURE_ANGLE`, `MEASURE_AREA`                                              |

### PROPERTIES (14 tools)
`ASSIGN_SECTION`, `ASSIGN_MATERIAL`, `ASSIGN_RELEASE`, `ASSIGN_OFFSET`, `ASSIGN_CABLE_PROPS`, `ASSIGN_SPRING`, `ASSIGN_MASS`, `MEMBER_ORIENTATION`, `ASSIGN_RIGID`, `ASSIGN_HINGE`, `ASSIGN_SUPPORT`, `SECTION_BUILDER`, `IMPORT_SECTION`

### LOADING (18 tools)
`ADD_POINT_LOAD`, `ADD_MOMENT`, `ADD_UDL`, `ADD_TRAPEZOID`, `ADD_WIND`, `ADD_SEISMIC`, `LOAD_COMBINATIONS`, `ADD_PRETENSION`, `ADD_TEMPERATURE`, `ADD_MOVING_LOAD`, `ADD_HYDROSTATIC`, `ADD_SELF_WEIGHT`, `ADD_SETTLEMENT`, `ADD_PRESSURE`, `ADD_CENTRIFUGAL`, `LOAD_PATTERN`, `ENVELOPE`

### ANALYSIS (12 tools)
`RUN_ANALYSIS`, `VIEW_DEFORMED`, `VIEW_REACTIONS`, `VIEW_SFD`, `VIEW_BMD`, `VIEW_DIAGRAMS`, `MODAL_ANALYSIS`, `BUCKLING_ANALYSIS`, `P_DELTA`, `PUSHOVER`, `TIME_HISTORY`, `RESPONSE_SPECTRUM`

### DESIGN (10 tools)
`STEEL_CHECK`, `CONCRETE_DESIGN`, `CONNECTION_DESIGN`, `FOUNDATION_DESIGN`, `GENERATE_REPORT`, `TIMBER_DESIGN`, `COMPOSITE_DESIGN`, `SEISMIC_DETAIL`, `CROSS_SECTION_CHECK`, `DEFLECTION_CHECK`

### CIVIL (18 tools)
`GEOTECH_CALC`, `FOUNDATION_ANALYSIS`, `SLOPE_STABILITY`, `TRANS_GEOMETRIC`, `PAVEMENT_DESIGN`, `TRAFFIC_ANALYSIS`, `HYDRAULICS_CHANNEL`, `HYDRAULICS_PIPE`, `CULVERT_DESIGN`, `ENV_WTP`, `ENV_STP`, `ENV_AQI`, `CONST_SCHEDULE`, `COST_ESTIMATE`, `SURVEY_TRAVERSE`, `SURVEY_VOLUME`

---

## Appendix F: Complete Dialog Micro-Details

### F.1 BoundaryConditionsDialog (294 lines)

**Support Type Options:**
| Type       | fx  | fy  | fz  | mx  | my  | mz  |
|------------|-----|-----|-----|-----|-----|-----|
| `none`     | ✗   | ✗   | ✗   | ✗   | ✗   | ✗   |
| `fixed`    | ✓   | ✓   | ✓   | ✓   | ✓   | ✓   |
| `pinned`   | ✓   | ✓   | ✓   | ✗   | ✗   | ✗   |
| `roller-x` | ✗   | ✓   | ✓   | ✗   | ✗   | ✗   |
| `roller-y` | ✓   | ✗   | ✓   | ✗   | ✗   | ✗   |
| `roller-z` | ✓   | ✓   | ✗   | ✗   | ✗   | ✗   |
| `custom`   | user-defined per DOF                       |

- Auto-detects existing support type from first selected node
- Apply target: all currently selected nodes (batch)

### F.2 WindLoadDialog (704 lines) — IS 875 Part 3: 2015

**City → Basic Wind Speed (Vb) Mapping:**
| City              | Vb (m/s) |
|-------------------|----------|
| Delhi             | 47       |
| Mumbai            | 44       |
| Kolkata           | 50       |
| Chennai           | 50       |
| Bangalore         | 33       |
| Hyderabad         | 44       |
| Ahmedabad         | 39       |
| Pune              | 39       |
| Jaipur            | 47       |
| Lucknow           | 47       |
| Bhopal            | 47       |
| Visakhapatnam     | 50       |
| Bhubaneswar       | 50       |
| Coastal Andhra    | 50       |
| Coastal Odisha    | 50       |
| Custom            | user-input|

**Form Fields (all with defaults):**
- `terrainCategory`: 1 / 2 (default) / 3 / 4
- `structureClass`: A (default) / B / C
- `buildingType`: rectangular (default) / square / circular / industrial / frame
- `buildingHeight`: 30m, `buildingWidth`: 20m, `buildingDepth`: 15m
- `designLife`: 50 years
- `isHilly`: false, `hillSlope`: 0°, `hillHeight`: 0m
- `isCyclonic`: false
- `openingPercentage`: 5%

**Computed Output:**
- k1 (risk coefficient), k2 (terrain/height), k3 (topography), k4 (cyclonic)
- Vz at each height level, pz (design pressure) at each height
- Cpe: windward / leeward / side / roof coefficients
- Cpi: positive / negative internal pressure coefficients
- Net design pressures per height zone

### F.3 ASCE7WindLoadDialog (524 lines) — ASCE 7-22 Chapter 27

**City → Design Wind Speed (V) Mapping:**
| City    | V (mph) |
|---------|---------|
| Miami   | 175     |
| NYC     | 120     |
| Chicago | 115     |
| LA      | 95      |
| Houston | 140     |
| Denver  | 115     |
| Seattle | 100     |
| Custom  | 115     |

**Form Fields:**
- `riskCategory`: 1/2(default)/3/4
- `exposure`: B / C(default) / D
- `height`: 30m, `width`: 20m, `length`: 30m
- `roofType`: flat(default) / gable / hip, `roofAngle`: 0°
- `Kzt`: 1.0, `Kd`: 0.85, `groundElevation`: 0 ft
- `enclosure`: enclosed(default) / partially_enclosed / open

**Computed:** Ke, Kd, Kzt, G, GCpi, qh, pressures per height (windward/leeward/side/roof)
**Backend:** POST `/load-generation/asce7-wind`

### F.4 IS875LoadDialog (509 lines) — IS 875 Parts 1-5

**Dead Load Materials (Part 1):**
| Material         | Unit Weight (kN/m³) |
|------------------|---------------------|
| RCC              | 25                  |
| PCC              | 24                  |
| Brick Masonry    | 19                  |
| Fly Ash Brick    | 14                  |
| Steel            | 78.5                |
| Timber           | 8                   |
| Glass            | 25                  |
| Dry Earth        | 16                  |
| Wet Earth        | 18                  |
| Water            | 10                  |

**Floor Finishes:** tiles 25mm, tiles 40mm, marble 20mm, granite 20mm, wood 25mm, screed 50mm, waterproofing

**Imposed Load Occupancies (Part 2):**
| Occupancy                | Load (kN/m²) |
|--------------------------|---------------|
| Residential              | 2.0           |
| Office                   | 2.5           |
| Retail / Shop floors     | 4.0           |
| Assembly (fixed seats)   | 4.0           |
| Assembly (no fixed)      | 5.0           |
| Classroom                | 3.0           |
| Hospital                 | 3.0           |
| Industrial (light)       | 5.0           |
| Industrial (heavy)       | 10.0          |
| Storage                  | 6.0           |
| Parking                  | 2.5           |
| Corridors                | 3.0           |
| Stairs                   | 5.0           |
| Balconies                | 4.0           |
| Terrace                  | 1.5           |
| Roof (access)            | 1.5           |
| Roof (no access)         | 0.75          |
| Kitchen                  | 2.0           |

**Snow Load Zones (Part 4):**
| Zone   | Ground Snow Load (kN/m²) |
|--------|--------------------------|
| Zone 1 | 0.5                      |
| Zone 2 | 1.0                      |
| Zone 3 | 2.0                      |
| Zone 4 | 3.5                      |
| Zone 5 | 5.0                      |

**Special Loads (Part 5):** EOT Cranes (5T/10T/25T), Machinery Impact, Elevator Impact, Partition Load

**Load Type Selection:** UDL / UVL / Point — applies to output format

### F.5 IS1893SeismicLoadDialog (603 lines) — IS 1893:2016

**Zone → Z Factor:**
| Zone | Z Factor |
|------|----------|
| 2    | 0.10     |
| 3    | 0.16     |
| 4    | 0.24     |
| 5    | 0.36     |

**Building System → Response Reduction Factor (R):**
| System                  | Abbreviation | R |
|-------------------------|-------------|---|
| Ordinary MRF            | OMRF        | 3 |
| Special MRF             | SMRF        | 5 |
| Ordinary SMR Frame      | OSMRF       | 3 |
| Special SMR Frame       | SSMRF       | 5 |
| Braced Frame            | BF          | 4 |
| Shear Wall              | SW          | 3 |
| Dual System             | DUAL        | 5 |

**Importance Factor:**
| Category  | I Factor |
|-----------|----------|
| Ordinary  | 1.0      |
| Important | 1.5      |
| Critical  | 1.5      |

**Defaults:** Zone=3, Soil=MEDIUM, System=SMRF(R=5), I=1.0(Ordinary), Height=30m, Stories=10, Direction=X, Damping=0.05

**Computed:** Z, I, R, Ta (approximate period), Sa/g, Ah, W (seismic weight), Vb (base shear), Per-floor forces Qi (level, height, weight, force, shear), Overturning moment

### F.6 ASCE7SeismicLoadDialog (662 lines) — ASCE 7-22

**Structural System → R/Cd/Ω₀:**
| System              | Abbr      | R    | Cd   | Ω₀   |
|---------------------|-----------|------|------|-------|
| Steel SMF           | SMF_S     | 8    | 5.5  | 3     |
| RC SMF              | SMF_RC    | 8    | 5.5  | 3     |
| Intermediate MF     | IMF       | 5    | 4.5  | 3     |
| Steel OMF           | OMF_S     | 3.5  | 3    | 3     |
| RC OMF              | OMF_RC    | 3    | 2.5  | 3     |
| Steel SCBF          | SCBF      | 6    | 5    | 2     |
| Steel OCBF          | OCBF      | 3.25 | 3.25 | 2     |
| Special SW          | SSW       | 6    | 5    | 2.5   |
| Ordinary SW         | OSW       | 5    | 4.5  | 2.5   |
| Dual System         | DUAL      | 7    | 5.5  | 2.5   |

**Defaults:** Ss=1.0, S1=0.4, TL=8.0, SiteClass=D, RiskCategory=2, System=SMF_S, Height=30m, Stories=10, Direction=X

**Computed:** Fa, Fv, SDS, SD1, Seismic Design Category (A-E), Ta, T, Cu, Cs, W, V (base shear), Per-story forces, Overturning moment

### F.7 LoadCombinationsDialog (511 lines)

**Code-based Predefined Combinations:**

ASCE 7 LRFD (7 combos):
1. `1.4D`
2. `1.2D + 1.6L + 0.5Lr`
3. `1.2D + 1.6Lr + (1.0L or 0.5W)`
4. `1.2D + 1.0W + 1.0L + 0.5Lr`
5. `1.2D + 1.0E + 1.0L + 0.2S`
6. `0.9D + 1.0W`
7. `0.9D + 1.0E`

IS 456 LSM (10 combos):
1. `1.5(DL + LL)`
2. `1.2(DL + LL + EL)`
3. `1.5(DL + EL)`
4. `0.9DL + 1.5EL`
5. `1.5(DL + WL)`
6. `1.2(DL + LL + WL)`
7. `0.9DL + 1.5WL`
8. `1.5DL`
9. `1.2(DL + LL + TL)`
10. `DL + 0.8(LL + WL)`

**Load Types:** D, L, Lr, S, R, W, E, T

**Backend:** POST `/load-combinations/generate`

### F.8 SectionBrowserDialog (265 lines)

**Standard Options:** IS / AISC / BS / EN (Eurocode)

**Table Columns:** Designation, Depth(mm), Width(mm), Area(mm²), Weight(kg/m), Ix(mm⁴), Iy(mm⁴)

**Sort:** By designation / depth / width / area / weight / ix / iy, asc/desc

**Search:** Debounced 300ms text filter

**Backend:** Uses `useSteelSections(standard)` hook → Rust backend API

### F.9 AdvancedAnalysisDialog (831 lines)

**6 Tabs:**

| Tab              | Key Inputs                                                       | Backend Endpoint        |
|------------------|------------------------------------------------------------------|-------------------------|
| P-Delta          | Iteration params, convergence tolerance, geometric stiffness     | —                       |
| Modal            | Number of modes, mass participation                              | —                       |
| Time History     | Ground motion record, time step, duration                        | —                       |
| Response Spectrum| Zone(2-5), Soil(I/II/III), I-factor(1.0/1.2/1.5), R(1.5-5.0), Modes(12), Direction(X/Y/Z), Damping(0.05) | POST `/analyze/spectrum` |
| Buckling         | Number of modes, load case                                      | —                       |
| Cable            | Cable-specific analysis                                          | —                       |

**Response Spectrum Dialog (inline)** — IS 1893 spectrum visualization via SVG graph

### F.10 DesignCodesDialog (443 lines)

**4 Design Panels:**

| Panel         | Code            | Sub-component                    |
|---------------|-----------------|----------------------------------|
| Steel Design  | IS 800:2007     | `SteelDesignPanel`              |
| Concrete      | IS 456:2000     | `IS456DesignPanel`              |
| Connection    | IS 800 Ch.10    | `ConnectionDesignDialog`         |
| Foundation    | IS 456/IS 1904  | Inline with fields below         |

**Foundation Panel Inline Fields:**
- `footingType`: isolated(default) / combined / mat
- `columnLoad`: 500 kN
- `momentX`: 50 kN·m, `momentY`: 0 kN·m
- `sbc`: 100 / 150(default) / 200 / 300 / 450 kN/m²
- `concreteGrade`: M25
- **Output:** length, width, depth (m), rebarMain, status (pass/fail)

### F.11 SteelDesignDialog (214 lines)

**4 Tabs:** Beam Design, Column Design, Composite Slab, Code Compliance

**Sub-components (lazy-loaded):**
- `SteelMemberDesigner` (beam tab)
- `EnhancedColumnDesignDialog` (column tab)
- `EnhancedSlabDesignDialog` (slab tab)
- `CodeCompliancePanel` (compliance tab)

**Codes:** IS 800, AISC 360, EN 1993

### F.12 ConcreteDesignDialog (200 lines)

**5 Tabs:** RC Beam, RC Column, RC Slab, Footing, Prestressed

**Sub-components (all lazy):**
- `RCBeamDesigner` — Flexure (Ast), Shear (stirrups), Deflection check
- `RCColumnDesigner` — Axial + biaxial bending interaction diagram
- `RCSlabDesigner` — One-way/Two-way
- `RCFootingDesigner` — Isolated footing
- `PrestressedDesigner` — Prestressed beam design

**Codes:** IS 456, ACI 318, EN 1992

### F.13 ConnectionDesignDialog (568 lines — top-level)

**4 Connection Types:**
| Type              | Key Parameters                                     |
|-------------------|----------------------------------------------------|
| Simple Shear      | Bolt grade, diameter, plate thickness               |
| Moment End Plate  | Bolt grade, plate thickness, weld size              |
| Welded            | Weld size, weld length                              |
| Column Base Plate | Bolt diameter, plate thickness, column size          |

**Bolt Grades:** 4.6, 8.8, 10.9  
**Bolt Diameters:** 12, 16, 20, 22, 24, 27, 30, 36 mm  
**Plate Thicknesses:** 8–40 mm  
**Steel Grades:** From STEEL_GRADES constant

**Design Output Fields:**
- numBolts, boltRows, boltCols
- plateWidth, plateHeight, plateThickness
- weldLength
- checks[]: { name, demand, capacity, ratio, status, clause }
- overallStatus (pass/fail)
- SVG connection sketch

**Code:** IS 800:2007 Chapter 10

### F.14 FoundationDesignDialog (559 lines — top-level)

**Soil Types & Bearing Capacities:**
| Soil Type         | SBC (kN/m²) |
|-------------------|-------------|
| Soft Clay         | 100         |
| Medium Clay       | 150         |
| Stiff Clay        | 200         |
| Loose Sand        | 100         |
| Medium Dense Sand | 200         |
| Dense Sand        | 300         |
| Hard Rock         | 1000        |
| Weathered Rock    | 500         |

**Design Output:** type, columnLoad, moment, width/length/depth (m), areaRequired/Provided, bearingPressure, safetyFactor, status (safe/unsafe/marginal), rebarMain (e.g., "12Ø @ 150 c/c"), rebarDist, concreteVolume

### F.15 EnhancedFoundationDesignDialog (1255 lines — dialogs/)

**Foundation Types:**
| Type                  | Shape        |
|-----------------------|--------------|
| Isolated Square       | Square       |
| Isolated Rectangular  | Rectangle    |
| Isolated Circular     | Circle       |
| Combined Rectangular  | Rectangle    |
| Strip Continuous      | Strip        |
| Raft Flat             | Raft         |

**Extended Soil Types (8):** Soft Clay (75kPa), Medium Clay (150), Stiff Clay (250), Loose Sand (100), Medium Dense Sand (200), Dense Sand/Gravel (400), Weathered Rock (600), Hard Rock (1500)

**Material Options:**
- Concrete: M20(fck=20) through M50(fck=50)
- Steel: Fe415, Fe500, Fe550

**Design Checks:** StatusBadge, UtilizationBar, DesignCheckCard (demand/capacity/ratio/clause)
**Uses:** `AdvancedFoundationDesignEngine`

**Codes:** IS 456:2000, IS 2950, ACI 318-19, EN 1992, BS 8110

### F.16 CivilEngineeringDialog (200 lines — dialogs/)

**4 Tabs with Lazy Sub-components:**

| Tab              | Sub-component            | Capabilities                                          |
|------------------|--------------------------|-------------------------------------------------------|
| Geotechnical     | `BearingCapacityCalculator` | Terzaghi/Meyerhof/IS 6403, settlement, earth pressure, slope stability |
| Hydraulics       | `HydraulicsDesigner`     | Open channel (Manning's), pipe networks, culverts     |
| Transportation   | `TransportationDesigner` | Highway geometry, pavement (IRC 37/58), traffic       |
| Construction     | `ConstructionManager`    | CPM/PERT, Gantt, cost estimation, resource leveling   |

### F.17 PlateCreationDialog (259 lines)

**Prerequisite:** Exactly 4 nodes selected

**Fields:**
| Field         | Default     | Options                         |
|---------------|-------------|---------------------------------|
| thickness     | 150 mm      | Any positive number              |
| materialType  | concrete    | steel / concrete / aluminum / custom |
| customE       | 200 GPa     | For custom material              |
| customNu      | 0.3         | For custom material              |
| pressure      | 0 kN/m²     | Applied surface pressure         |
| applyPressure | false       | Toggle pressure application      |

**Material Presets:**
| Material   | E (kN/m²) | ν    |
|------------|-----------|------|
| Steel      | 200e6     | 0.30 |
| Concrete   | 25e6      | 0.20 |
| Aluminum   | 70e6      | 0.33 |

### F.18 FloorSlabDialog (330 lines)

**Fields:**
| Field         | Default | Notes                              |
|---------------|---------|------------------------------------|
| yLevel        | 3 m     | With quick-select from detected Y levels |
| thickness     | 0.15 m  | Slab thickness                      |
| material      | concrete| concrete / steel / custom           |
| pressure      | -5 kN/m²| Negative = downward                 |
| applyLoad     | true    | Auto-apply as FloorLoad             |
| distribution  | auto    | Auto-detect / one_way / two_way     |

**Auto-Detection:** `detectPanels()` scans for rectangular beam-bounded panels at Y level
**Creates:** Plate elements + FloorLoad entries per detected panel

### F.19 GeneratorDialogs (756 lines) — 4 Generators

#### Truss Generator
| Field     | Default  | Options                          |
|-----------|----------|----------------------------------|
| trussType | warren   | warren / pratt / howe / k-truss  |
| span      | 24 m     |                                  |
| height    | 4 m      |                                  |
| panels    | 8        |                                  |

#### Arch Generator
| Field          | Default    | Options                           |
|----------------|------------|-----------------------------------|
| archType       | parabolic  | parabolic / circular / catenary   |
| span           | 60 m       |                                   |
| rise           | 15 m       |                                   |
| segments       | 12         |                                   |
| includeHangers | true       |                                   |

#### Frame Generator
| Field       | Default     | Options                    |
|-------------|-------------|----------------------------|
| frameType   | portal      | portal / multi-story       |
| bayWidth    | 6 m         |                            |
| storyHeight | 3.5 m       |                            |
| bays        | 3           |                            |
| stories     | 4           |                            |

#### Cable Pattern Generator
| Field        | Default   | Options                       |
|--------------|-----------|-------------------------------|
| arrangement  | fan       | fan / harp / semi-harp        |
| towerHeight  | 40 m      |                               |
| deckLength   | 100 m     |                               |
| cableSpacing | 10 m      |                               |

**All generators:** Clear existing model, generate nodes + members, auto-assign sections

### F.20 MemberSpecificationsDialog (276 lines)

**3 Tabs:** Releases, Offsets, Beta (Angle)

**Releases Tab — 12 DOF Checkboxes:**
| End   | fx | fy | fz | mx | my | mz |
|-------|----|----|----|----|----|----|
| Start | ☐  | ☐  | ☐  | ☐  | ☐  | ☐  |
| End   | ☐  | ☐  | ☐  | ☐  | ☐  | ☐  |

All default = false (fixed). Applies to selected member(s).

**Offsets Tab — 6 Inputs:**
| End   | x (m) | y (m) | z (m) |
|-------|--------|--------|--------|
| Start | 0      | 0      | 0      |
| End   | 0      | 0      | 0      |

**Beta Tab:** Single input, degrees, default = 0

### F.21 MovingLoadDialog (961 lines)

**Standard Vehicles:**
| Vehicle              | Code      | Total Load | Length |
|----------------------|-----------|------------|--------|
| IRC Class A          | IRC 6     | 554 kN     | 18.5 m |
| IRC Class AA Tracked | IRC 6     | 700 kN     | —      |
| IRC 70R Wheeled      | IRC 6     | 1000 kN    | —      |
| AASHTO HL-93 Truck   | AASHTO    | 325 kN     | —      |
| AASHTO HL-93 Tandem  | AASHTO    | 220 kN     | —      |
| Eurocode LM1         | EN 1991-2 | 300 kN     | —      |
| Custom               | —         | user-input | —      |

**Fields:** spanLength, numSpans, laneWidth, numLanes, increment (m), includeImpact (bool), impactFactor
**Animation:** Play/Pause, Step Forward, position slider
**Computed Envelope:** maxMoment, minMoment, maxShear, minShear, maxReaction per position

### F.22 RailwayBridgeDialog (894 lines)

**Loading Standards:**
| Standard  | Code          | Total Load | Axle Count |
|-----------|---------------|------------|------------|
| MBG       | IRS           | 4510 kN    | 14         |
| HM (Heavy Mineral) | RDSO  | 5200 kN   | 14         |
| Cooper E-80 | AREMA       | 4800 kN    | 12         |
| EUDL      | IRS           | per table  | n/a        |

**EUDL Table:** Span 5–50m → BM load + SF load (kN/m)

**Fields:** span, height, numPanels, trackType (single/double), bridgeType (open_deck/ballasted_deck), gaugeWidth (1.676m BG), sleepersPerPanel

**Output:** maxAxialForce, maxBendingMoment, maxShearForce, maxDeflection, impactFactor, criticalMember, utilization, passesDesign

### F.23 LoadDialog (1299 lines)

**6 Tabs:** Nodal, Member, Floor, Thermal, Prestress, Combos

**Load Case Types:** DEAD, LIVE, WIND, SEISMIC, TEMPERATURE, PRESTRESS, IMPOSED

**Nodal Load Defaults:** fx=0, fy=-10, fz=0, mx=0, my=0, mz=0

**Member Load Types & Defaults:**
| Type        | Default Values                            |
|-------------|------------------------------------------|
| Uniform     | w = -10 kN/m                             |
| Trapezoidal | w1 = -5, w2 = -15 kN/m                  |
| Point       | P = -20 kN, a = 0.5 (midspan ratio)     |
| Moment      | M (kN·m)                                  |

**Load Directions:** global_y, global_x, global_z, local_y, local_x, local_z

### F.24 ExportDialog (171 lines)

**Sections:** Project Summary, Generate Reports, Export Data

**Reports Available:**
- Calculation Book → PDF via `ReportingService.generateCalculationBook()`
- Bill of Materials → CSV download

**Export Data Structure:**
- `projectName`, `timestamp`
- `nodes[]`: id, x, y, z, dx, dy, dz, rx, ry, rz
- `members[]`: id, startNode, endNode, forces...
- `reactions[]`

**Prerequisite:** Analysis results must exist

### F.25 InteroperabilityDialog (475 lines)

**Modes:** Import / Export

**Supported Formats:**
| Format | Import | Export | Backend                     |
|--------|--------|--------|-----------------------------|
| DXF    | ✓      | ✓      | `DXFImporter`               |
| STAAD  | ✓      | ✓      | POST `/api/interop`         |
| IFC    | —      | ✓      | `IFCExporter`               |
| JSON   | ✓      | ✓      | Native                       |

**Import Modes:** Merge (add) / Replace (clear + load)

### F.26 SectionDesignerDialog (517 lines)

**9 Standard Shapes with Dimension Inputs:**

| Shape           | Dimensions                                                     |
|-----------------|----------------------------------------------------------------|
| I-Beam          | depth, width, web_thickness, flange_thickness                  |
| Channel         | depth, width, web_thickness, flange_thickness                  |
| Angle           | leg1, leg2, thickness                                          |
| Rectangle       | width, depth                                                   |
| Circle          | diameter                                                       |
| T-Section       | width, depth, web_thickness, flange_thickness                  |
| Built-up I      | depth, top_width, bot_width, web_thickness, top_thickness, bot_thickness |
| Composite Beam  | depth, width, web_thickness, flange_thickness, slab_width, slab_thickness, modular_ratio |
| Lipped Channel  | depth, width, thickness, lip                                   |

**Computed Properties:** area, centroid_x/y, Ixx, Iyy, Ixy, Zxx, Zyy, Zpxx, Zpyy, rxx, ryy, I1, I2, principal_angle, weight_per_meter

**Canvas:** Visual section cross-section drawing

**Backend:** POST `/sections/standard/create` or `/sections/custom/calculate`

### F.27 CurvedStructureDialog (425 lines)

**Categories (9):** Domes, Vaults, Arches, Tunnels, Spheres, Tanks & Silos, Towers, Staircases, Shell Structures

**Template Examples:**
- Geodesic Dome — radius, frequency
- Ribbed Dome — radius, ribs, rings
- Barrel Vault — span, rise, length, segments
- Parabolic Arch — span, rise, segments
- Tunnel — radius, length, segments
- Cylindrical Tank — radius, height, segments
- Cooling Tower — base_radius, top_radius, height
- Helical Staircase — radius, height, turns, steps
- Hyperbolic Paraboloid — size, rise, divisions

**Action:** Clears model, generates parametric nodes/members via `generateCurvedStructure()`

---

## Appendix G: Complete Material Database

### G.1 Steel Grades

| ID           | Name                  | E (MPa)  | fy (MPa) | fu (MPa) | ρ (kg/m³) | ν    | α (/°C)   |
|-------------|----------------------|----------|----------|----------|-----------|------|-----------|
| steel-fe250 | Fe 250 (IS 2062)     | 200,000  | 250      | 410      | 7850      | 0.30 | 12×10⁻⁶  |
| steel-fe410 | Fe 410 (IS 2062)     | 200,000  | 250      | 410      | 7850      | 0.30 | 12×10⁻⁶  |
| steel-a36   | ASTM A36             | 200,000  | 250      | 400      | 7850      | 0.30 | 11.7×10⁻⁶|
| steel-a992  | ASTM A992 Grade 50   | 200,000  | 345      | 450      | 7850      | 0.30 | 11.7×10⁻⁶|
| steel-s275  | S275 (EN 10025)      | 210,000  | 275      | 430      | 7850      | 0.30 | 12×10⁻⁶  |
| steel-s355  | S355 (EN 10025)      | 210,000  | 355      | 510      | 7850      | 0.30 | 12×10⁻⁶  |

### G.2 Concrete Grades

| ID              | Name                 | E (MPa) | fck (MPa) | ρ (kg/m³) | ν    |
|----------------|----------------------|---------|-----------|-----------|------|
| concrete-m20   | M20                  | 22,360  | 20        | 2500      | 0.20 |
| concrete-m25   | M25                  | 25,000  | 25        | 2500      | 0.20 |
| concrete-m30   | M30                  | 27,386  | 30        | 2500      | 0.20 |
| concrete-m40   | M40                  | 31,623  | 40        | 2500      | 0.20 |
| concrete-4000  | f'c = 4000 psi       | 25,742  | 27.6      | 2400      | 0.20 |

### G.3 Section Categories in Database

| Section Type      | Standard      | Quantity    |
|-------------------|---------------|-------------|
| ISMB              | IS            | ~15 sizes   |
| ISMC              | IS            | ~12 sizes   |
| ISLB              | IS            | ~10 sizes   |
| ISJB              | IS            | ~6 sizes    |
| ISHB              | IS            | ~6 sizes    |
| W (Wide Flange)   | AISC          | ~10+ sizes  |
| S (American Std)  | AISC          | available   |
| HP (H-Pile)       | AISC          | available   |
| C (Channel)       | AISC          | available   |
| MC (Misc Channel) | AISC          | available   |
| L (Angle)         | AISC          | available   |
| HSS-RECT          | AISC          | available   |
| HSS-ROUND         | AISC          | available   |
| PIPE              | AISC          | available   |
| IPE               | EN            | available   |
| HEA               | EN            | available   |
| HEB               | EN            | available   |
| UPN               | EN            | available   |
| RECT-CONCRETE     | Custom        | parametric  |
| CIRC-CONCRETE     | Custom        | parametric  |
| T-CONCRETE        | Custom        | parametric  |
| CUSTOM            | User-defined  | parametric  |

### G.4 SectionProperties Interface (Database Field)

```typescript
interface SectionProperties {
  id: string;
  name: string;
  type: string;          // Section category code
  A: number;             // Area (mm²)
  Ix: number;            // Major axis moment of inertia (mm⁴)
  Iy: number;            // Minor axis moment of inertia (mm⁴)
  J: number;             // Torsion constant (mm⁴)
  Sx: number;            // Major elastic section modulus (mm³)
  Sy: number;            // Minor elastic section modulus (mm³)
  Zx: number;            // Major plastic section modulus (mm³)
  Zy: number;            // Minor plastic section modulus (mm³)
  rx: number;            // Major radius of gyration (mm)
  ry: number;            // Minor radius of gyration (mm)
  Cw?: number;           // Warping constant (mm⁶)
  d?: number;            // Depth (mm)
  bf?: number;           // Flange width (mm)
  tf?: number;           // Flange thickness (mm)
  tw?: number;           // Web thickness (mm)
  b?: number;            // Width generic (mm)
  h?: number;            // Height generic (mm)
  t?: number;            // Thickness generic (mm)
  D?: number;            // Diameter for circular (mm)
  weight: number;        // Weight per unit length (kg/m)
  classification?: string;
}
```

---

## Appendix H: UI State Management Details

### H.1 Category Switching Rules

| Rule | Condition                               | Behavior                                                    |
|------|-----------------------------------------|-------------------------------------------------------------|
| 1    | Switching AWAY from MODELING            | `activeTool` automatically set to `null`                    |
| 2    | Switching TO ANALYSIS                   | Runs `validateModelConnectivity()`, shows warning if invalid |
| 3    | Switching TO DESIGN                     | **BLOCKS switch** if no analysis results exist — shows error notification |
| 4    | Same category click                     | No-op (ignored)                                              |
| 5    | Any valid switch                        | Sets `activeTool` to first tool in `CATEGORY_TOOLS[newCat]`  |

### H.2 Tool Validation

When `setActiveTool(tool)` is called:
- If `tool === null` → clear
- Validates tool exists in `CATEGORY_TOOLS[currentCategory]`
- If tool NOT in valid list → warns in console + ignored
- If valid → sets `activeTool`

### H.3 Sidebar Modes

| Mode       | Width  | Content              |
|------------|--------|----------------------|
| `EXPANDED` | 192px  | Full labels + icons  |
| `COLLAPSED`| 12px   | Icons only           |
| `HIDDEN`   | 0px    | Completely hidden    |

### H.4 Graphics State

| Property       | Default | Purpose                                    |
|---------------|---------|---------------------------------------------|
| `useWebGpu`   | false   | Toggle WebGPU rendering (experimental)       |
| `renderMode3D`| false   | Toggle solid 3D beam cross-sections (wireframe default for performance) |

### H.5 Overlay State

| Overlay      | Purpose                              |
|-------------|--------------------------------------|
| `none`       | No overlay active                    |
| `onboarding` | First-time onboarding wizard         |
| `tour`       | Feature tour guide                   |
| `quickstart` | Quick start template picker          |

Only one overlay active at a time. `onboardingCompleted: boolean` persists via localStorage.

### H.6 Grid Settings

| Property     | Default | Function                        |
|-------------|---------|----------------------------------|
| `showGrid`   | true    | Toggle grid visibility           |
| `snapToGrid` | true    | Enable grid snapping             |
| `gridSize`   | 1       | Grid spacing in meters           |

### H.7 Notification System

```typescript
notification: {
  show: boolean;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
} | null
```

Used for category switch validation errors ("Please Run Analysis First"), model validation warnings, and general feedback.

---

## Appendix I: PropertiesPanel Micro-Details

### I.1 Coordinate Input Color Coding

| Axis | Label Color    | Purpose          |
|------|---------------|-------------------|
| X    | `text-red-400`    | Global X axis  |
| Y    | `text-emerald-400`| Global Y axis  |
| Z    | `text-blue-400`   | Global Z axis  |

### I.2 Node Identification

- Badge gradient: `from-blue-100/80 dark:from-blue-950/80`
- Icon: `CircleDot` (w-4 h-4)
- ID displayed truncated: `#{id.slice(0, 8)}`

### I.3 Member Type Auto-Detection

| Angle Range           | Type       | Badge Color                                |
|----------------------|------------|---------------------------------------------|
| \|angle\| < 15° or > 165° | Beam      | `text-emerald-400 bg-emerald-500/15`       |
| \|angle−90°\| < 15°       | Column    | `text-purple-400 bg-purple-500/15`         |
| Other                     | Inclined  | `text-amber-400 bg-amber-500/15`           |

### I.4 Member Badge

- Gradient: `from-orange-100/50 dark:from-orange-950/50`
- Icon: `Link2` (w-4 h-4)
- Connectivity display: `START (I) → END (J)` with node IDs

### I.5 Section Display Units in Inspector

- Area: displayed as `cm²` (stored m² × 1e4)
- Moment of Inertia: displayed as `cm⁴` (stored m⁴ × 1e8)
- Young's Modulus: displayed as `GPa` (stored kN/m² ÷ 1e6)

### I.6 Custom Section Dialog (Inline in Inspector)

| Field       | Display Unit | Conversion to Store        |
|-------------|-------------|----------------------------|
| Width       | m           | → `dimensions.rectWidth`   |
| Depth       | m           | → `dimensions.rectHeight`  |
| Area        | cm²         | ÷ 1e4 → `A` (m²)          |
| Iy          | cm⁴         | ÷ 1e8 → `I` (m⁴)          |

### I.7 Custom Material Dialog (Inline in Inspector)

- Only field: E (GPa) → stored as `E` (kN/m² = GPa × 1e6)

### I.8 Member Force Display

| Force    | Color                        | Suffix           |
|----------|------------------------------|------------------|
| Axial >0 | `text-red-400` (Tension)    | `(T)`            |
| Axial <0 | `text-blue-400` (Compress.) | `(C)`            |
| Axial =0 | `text-slate-500`             | —                |
| Shear Y  | `border-emerald-500`         | —                |
| Shear Z  | `border-cyan-500`            | —                |
| Moment   | `text-purple-400`            | —                |

**Dominance indicator:** Axial-dominant / Bending-dominant / Shear-dominant (auto-detected)

### I.9 Displacement Result Display

| DOF  | Color            | Unit Conversion          |
|------|------------------|--------------------------|
| δx   | `text-red-400`   | `× 1000` → mm (3 dec.)  |
| δy   | `text-emerald-400`| `× 1000` → mm (3 dec.) |
| δz   | `text-blue-400`  | `× 1000` → mm (3 dec.)  |
| θz   | `text-purple-400`| `× 1000` → rad (4 dec.) |

### I.10 Member Load Form (UDL) in Inspector

| Field     | Default | Range Control                    |
|-----------|---------|----------------------------------|
| w (kN/m)  | -10     | NumberInput (negative=downward)  |
| Direction | global_y| 5 options (see D.6)              |
| Start %   | 0       | Clamped 0–100, shows as ratio    |
| End %     | 100     | Clamped 0–100, shows as ratio    |

### I.11 Release Display Indicators

| Configuration      | Label Text                     | Release State       |
|-------------------|---------------------------------|---------------------|
| Both ends released | "Truss Member (Both ends released)" | Both ✓         |
| Start released     | "Start Pinned Connection"      | Start ✓, End ✗      |
| End released       | "End Pinned Connection"        | Start ✗, End ✓      |
| Neither released   | "Rigid Frame Member"           | Both ✗              |

**Release toggle visual:**
- Released: `border-orange-500 bg-orange-500/10` + Unlock icon (orange)
- Fixed: `border-slate-700 bg-black/30` + Lock icon (slate)

---

## Appendix J: Additional Dialogs Not Wired to Ribbon

These dialog components exist in the codebase but have NO direct ribbon button entry point:

| Dialog                         | File                                    | Lines | Modal Key          | Current Access                |
|-------------------------------|-----------------------------------------|-------|--------------------|---------------------------------|
| MovingLoadDialog              | `MovingLoadDialog.tsx`                  | 961   | `movingLoadDialog` | No ribbon button                |
| RailwayBridgeDialog           | `RailwayBridgeDialog.tsx`               | 894   | `railwayBridge`    | No ribbon button                |
| InteroperabilityDialog        | `InteroperabilityDialog.tsx`            | 475   | `interoperability` | No ribbon button (DXF/STAAD/IFC)|
| MemberSpecificationsDialog    | `specifications/MemberSpecificationsDialog.tsx`| 276 | Prop-based   | Not connected to ribbon         |
| SectionDesignerDialog         | `SectionDesignerDialog.tsx`             | 517   | Prop-based         | Not connected to ribbon         |
| PlateDesignerDialog           | `PlateDesignerDialog.tsx`               | 165   | Prop-based         | Not connected to ribbon         |
| ExportDialog                  | `ExportDialog.tsx`                      | 171   | Prop-based         | Not connected to ribbon         |
| SectionRecommendationDialog   | `SectionRecommendationDialog.tsx`       | —     | —                  | Not connected                   |
| SectionPropertiesDialog       | `SectionPropertiesDialog.tsx`           | —     | —                  | Not connected                   |
| ValidationDialog              | `ValidationDialog.tsx`                  | —     | —                  | Not connected                   |
| ProjectDetailsDialog          | `ProjectDetailsDialog.tsx`              | —     | —                  | Not connected                   |
| ReportCustomizationDialog     | `ReportCustomizationDialog.tsx`         | —     | —                  | Not connected                   |
| NodeInputDialog               | `ui/NodeInputDialog.tsx`                | —     | —                  | Not connected                   |
| LoadInputDialog               | `ui/LoadInputDialog.tsx`                | —     | —                  | Not connected                   |
| ConfirmDialog                 | `ui/ConfirmDialog.tsx`                  | —     | —                  | Utility dialog                  |
| MeshingDialog                 | (referenced in modal registry)          | —     | `meshing`          | No ribbon button                |
| SeismicLoadDialog             | `SeismicLoadDialog.tsx`                 | —     | `seismicLoadDialog`| No ribbon button                |
| GeneratorDialogs              | `toolbar/GeneratorDialogs.tsx`          | 756   | Via ModelingToolbar| Only from floating toolbar      |
| SplitMemberDialog             | `geometry/SplitMemberDialog.tsx`        | —     | —                  | Not connected                   |

### Recommended Ribbon Wiring

| Dialog                      | Suggested Ribbon Location                        | Priority |
|-----------------------------|--------------------------------------------------|----------|
| MovingLoadDialog            | LOADING → Generate group → "Moving" button       | High     |
| RailwayBridgeDialog         | CIVIL → Infrastructure → "Rail Bridge" button    | Medium   |
| InteroperabilityDialog      | MODELING → File group → "Import/Export" button    | High     |
| MemberSpecificationsDialog  | PROPERTIES → Specifications group (replace `geometryTools` links) | Critical |
| SectionDesignerDialog       | PROPERTIES → Section group → "Builder" button    | Critical |
| ExportDialog                | ANALYSIS → Results group → "Export" button        | High     |
| MeshingDialog               | MODELING → Create group → "Mesh" button           | Medium   |
| SplitMemberDialog           | MODELING → Edit group → "Split" button            | Low      |
| GeneratorDialogs            | MODELING → Structure group → sub-menu             | Medium   |
| ProjectDetailsDialog        | MODELING → File group → "Project Info"            | Medium   |
| ValidationDialog            | ANALYSIS → Run group → "Validate" button          | Medium   |
| ReportCustomizationDialog   | DESIGN → Advanced → "Report" button               | Low      |

---

## Appendix K: Complete Keyboard Shortcut Map (Extended)

| Shortcut          | Tool ID              | Action                    | Category       |
|-------------------|----------------------|---------------------------|----------------|
| `Escape`          | `SELECT`             | Select tool               | MODELING        |
| `N`               | `DRAW_NODE`          | Draw Node                 | MODELING        |
| `B`               | `DRAW_BEAM`          | Draw Beam                 | MODELING        |
| `V`               | `DRAW_COLUMN`        | Draw Column               | MODELING        |
| `C`               | `DRAW_CABLE`         | Draw Cable                | MODELING        |
| `A`               | `DRAW_ARCH`          | Draw Arch                 | MODELING        |
| `P`               | `DRAW_PLATE`         | Draw Plate/Shell          | MODELING        |
| `M`               | `MOVE`               | Move                      | MODELING        |
| `R`               | `ROTATE`             | Rotate                    | MODELING        |
| `S`               | `SCALE`              | Scale                     | MODELING        |
| `O`               | `OFFSET_MEMBER`      | Offset Member             | MODELING        |
| `E`               | `EXTRUDE`            | Extrude                   | MODELING        |
| `D`               | `DELETE`             | Delete                    | MODELING        |
| `Z`               | `ZOOM_WINDOW`        | Zoom Window               | MODELING        |
| `Shift+S`         | `SELECT_RANGE`       | Box Select                | MODELING        |
| `Del` / `Backspace`| `DELETE`            | Delete Selection          | Global          |
| `F`               | `ADD_POINT_LOAD`     | Point Load                | LOADING         |
| `U`               | `ADD_UDL`            | Uniform Distributed Load  | LOADING         |
| `W`               | `ADD_WIND`           | Wind Load                 | LOADING         |
| `T`               | `ADD_TEMPERATURE`    | Temperature Load          | LOADING         |
| `G`               | `ADD_SELF_WEIGHT`    | Self Weight               | LOADING         |
| `F5`              | `RUN_ANALYSIS`       | Run Analysis              | ANALYSIS        |
| `Ctrl+S`          | —                    | Save Project              | Global          |
| `Ctrl+O`          | —                    | Open Project              | Global          |
| `Ctrl+Z`          | —                    | Undo                      | Global          |
| `Ctrl+Shift+Z`    | —                    | Redo                      | Global          |
| `Ctrl+C`          | —                    | Copy Selection            | Global          |
| `Ctrl+Shift+W`    | —                    | Structure Wizard          | MODELING        |
| `L`               | (activeTool="load")  | Nodal Load tool           | LOADING         |

---

*End of Design Specification*  
*This document should be used as the reference for Figma frame creation and component library setup.*  
*Total coverage: 9 workflow buttons, 29 dialogs, 40+ toolbar tools, 35 modal keys, 112 keyboard shortcuts, complete data model.*
