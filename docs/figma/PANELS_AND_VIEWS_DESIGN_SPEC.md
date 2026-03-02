# BeamLab — Panels, Views & Pages Design Specification

**Version:** 2.0  
**Last Updated:** 2025-01-XX  
**Companion To:** `WORKFLOW_BUTTONS_DESIGN_SPEC.md` (covers Workflow Sidebar, Ribbon, and all workflow dialogs)  
**Scope:** Every panel, view, page, overlay, toolbar, menu, and modal **not** covered in the workflow spec — micro-detail accuracy for Figma reproduction.  
**Results Coverage:** 19 component files (~11,000 lines) fully documented in Appendixes F, G, H, I.

---

## Table of Contents

1. [Design System Tokens](#1-design-system-tokens)
2. [Application Shell — ModernModeler](#2-application-shell--modernmodeler)
3. [Engineering Ribbon](#3-engineering-ribbon)
4. [Workflow Sidebar](#4-workflow-sidebar)
5. [Inspector Panel (Right Panel)](#5-inspector-panel-right-panel)
6. [Status Bar](#6-status-bar)
7. [Modeling Toolbar (Floating)](#7-modeling-toolbar-floating)
8. [Context Menus](#8-context-menus)
9. [Command Palette](#9-command-palette)
10. [Results Toolbar (Post-Analysis)](#10-results-toolbar-post-analysis)
11. [Analysis Panels](#11-analysis-panels)
12. [Design Panels & Dialogs](#12-design-panels--dialogs)
13. [Civil Engineering Panel](#13-civil-engineering-panel)
14. [Empty Workspace Overlay](#14-empty-workspace-overlay)
15. [3D Viewport & Canvas](#15-3d-viewport--canvas)

**Appendixes**
- [A — Icon Reference Table](#appendix-a--icon-reference-table)
- [B — Keyboard Shortcuts Map](#appendix-b--keyboard-shortcuts-map)
- [C — Color Token Glossary](#appendix-c--color-token-glossary)
- [D — Analysis Panels Deep Spec](#appendix-d--analysis-panels-deep-spec)
- [E — Design Dialogs Deep Spec](#appendix-e--design-dialogs-deep-spec)
- [F — Results & Post-Processing Deep Spec](#appendix-f--results--post-processing-deep-spec) *(18 sections, 1200+ lines)*
- [G — Structural Analysis Viewer](#appendix-g--structural-analysis-viewer)
- [H — Post-Processing Design Studio](#appendix-h--post-processing-design-studio) *(12 sub-sections covering RC Beam/Steel/Section/Deflection)*
- [I — Barrel Exports](#appendix-i--barrel-exports-resultsindexts)

---

## 1. Design System Tokens

### 1.1 Color Palette

| Token | Light | Dark | Usage |
|---|---|---|---|
| `bg-primary` | `white` | `slate-900` | Main surfaces |
| `bg-secondary` | `slate-50` | `slate-950` | Canvas, analysis panels |
| `bg-elevated` | `white` | `slate-800` | Cards, dropdowns |
| `bg-overlay` | `black/60` | `black/60` | Modal backdrops |
| `border-primary` | `slate-200` | `slate-700` | Section dividers |
| `border-secondary` | `slate-200` | `slate-800` | Subtle separators |
| `text-primary` | `slate-900` | `white` | Headings, primary text |
| `text-secondary` | `slate-500` | `slate-400` | Labels, descriptions |
| `text-muted` | `slate-400` | `slate-500` | Disabled, hints |
| `accent-blue` | `blue-600` | `blue-500` | Primary actions, active states |
| `accent-purple` | `purple-600` | `purple-500` | Properties, premium |
| `accent-orange` | `orange-600` | `orange-500` | Loading, concrete design |
| `accent-emerald` | `emerald-600` | `emerald-500` | Analysis, success |
| `accent-rose` | `rose-600` | `rose-500` | Design, danger |
| `accent-amber` | `amber-600` | `amber-500` | Civil, warnings |
| `accent-red` | `red-500` | `red-500` | Errors, BMD diagrams |
| `accent-green` | `green-500` | `green-500` | Success, connections online |
| `accent-cyan` | `cyan-500` | `cyan-400` | Frequency values, time-history |
| `accent-teal` | `teal-500` | `teal-400` | BMD My diagrams |
| `accent-indigo` | `indigo-600` | `indigo-400` | Modal analysis, AI PINN |

### 1.2 Accent Color Map by Category

| Category | Primary Gradient | Badge/Tab Active | Icon Color |
|---|---|---|---|
| MODELING | — | `text-blue-400` | `text-blue-400` |
| PROPERTIES | — | `text-purple-400` | `text-purple-400` |
| LOADING | — | `text-orange-400` | `text-orange-400` |
| ANALYSIS | — | `text-emerald-400` | `text-emerald-400` |
| DESIGN | — | `text-rose-400` | `text-rose-400` |
| CIVIL | — | `text-amber-400` | `text-amber-400` |

### 1.3 Typography Scale

| Level | Classes | Usage |
|---|---|---|
| Page Title | `text-xl font-bold` | Dialog/panel main titles |
| Section Title | `text-lg font-bold` | Card group headings |
| Subsection | `text-sm font-semibold` | Field group labels |
| Label | `text-xs font-medium uppercase tracking-wider` | Form labels, section headers |
| Body | `text-sm` | Descriptions, table cells |
| Caption | `text-xs` | Auxiliary info, footers |
| Micro | `text-[10px]` | Tick labels, secondary data points |
| Nano | `text-[9px]` | Badge text, version labels |

### 1.4 Spacing System

| Token | Value | Usage |
|---|---|---|
| `gap-1` | 4px | Icon grid, compact items |
| `gap-2` | 8px | Button groups, stat cards |
| `gap-3` | 12px | Header elements |
| `gap-4` | 16px | Form field spacing |
| `gap-6` | 24px | Section spacing |
| `p-2` | 8px | Compact card padding |
| `p-3` | 12px | Toolbar padding |
| `p-4` | 16px | Standard content padding |
| `p-6` | 24px | Dialog/panel body padding |

### 1.5 Shared Component Patterns

#### Standard Input
```
Classes: w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800
         border border-slate-300 dark:border-slate-700
         text-slate-900 dark:text-white text-sm
         focus:outline-none focus:ring-2 focus:ring-blue-500
```

#### Standard Label
```
Classes: text-xs font-semibold text-slate-500 dark:text-slate-400
         uppercase tracking-wider
```

#### Standard Card
```
Classes: bg-slate-100/60 dark:bg-slate-800/60
         border border-slate-200/50 dark:border-slate-700/50
         rounded-lg p-4
```

#### Standard Button (Primary)
```
Classes: flex items-center gap-2 px-4 py-2
         bg-blue-600 hover:bg-blue-700 text-white
         rounded-lg font-medium transition-colors
         disabled:opacity-50 disabled:cursor-not-allowed
```

#### Gradient Button
```
Classes: bg-gradient-to-r from-{color}-600 to-{color2}-600
         hover:from-{color}-500 hover:to-{color2}-500
         text-white shadow-lg shadow-{color}-500/25
         rounded-lg font-medium transition-all
```

#### PRO Badge
```
Classes: bg-gradient-to-r from-amber-500 to-orange-500
         text-white text-[10px] px-1.5 py-0.5 rounded
         font-bold flex items-center gap-1
Icon: Crown (w-3 h-3)
```

---

## 2. Application Shell — ModernModeler

### 2.1 Root Layout

```
┌──────────────────────────────────────────────────┐
│                 Engineering Ribbon                │
├──────────┬───────────────────────────┬────────────┤
│ Workflow │                           │  Inspector │
│ Sidebar  │      3D Viewport          │   Panel    │
│ (w-48)   │      + Overlays           │  (w-[280px])│
│          │                           │            │
│          │  ┌─FloatingToolbar──┐     │            │
│          │  │ ModelingToolbar  │     │            │
│          │  └─────────────────┘     │            │
│          │                           │            │
│          │  ┌─ResultsToolbar─┐      │            │
│          │  │ (bottom-right)  │      │            │
│          │  └────────────────┘      │            │
│          │                           │            │
│          │  ┌─ResultsTableDock─┐    │            │
│          │  │ (bottom docked)   │    │            │
│          │  └──────────────────┘    │            │
├──────────┴───────────────────────────┴────────────┤
│                    Status Bar                     │
└──────────────────────────────────────────────────┘
```

**Root container:** `h-screen w-screen flex flex-col bg-slate-50 dark:bg-slate-900`

**Layout hierarchy:**
1. `EngineeringRibbon` — full width, top
2. Main area: `flex flex-row flex-1 overflow-hidden`
   - `WorkflowSidebar` — left aside, `w-48` (or `w-12` collapsed)
   - Main workspace: `flex-1 flex flex-col relative`
     - 3D Canvas (fills available space)
     - Overlays: `ModelingToolbar`, `ResultsToolbar`, `ResultsTableDock`, `SelectionToolbar`, `EmptyOverlay`
   - `InspectorPanel` — right, `w-[280px]` (or `w-[10px]` collapsed)
3. `StatusBar` — full width, bottom

### 2.2 Lazy-Loaded Dialogs (40+)

All dialogs use `React.lazy()` + `<Suspense>` wrapping. They are only loaded when their trigger fires.

| Dialog | Trigger | Notes |
|---|---|---|
| StructureWizard | Ribbon → Structure → Wizard | |
| FoundationDesignDialog | Ribbon → Foundation | |
| IS875LoadDialog | Ribbon → Wind IS 875 | |
| GeometryToolsPanel | Ribbon → Geometry Tools | |
| ValidationDialog | Pre-analysis validation | |
| StressVisualization | After analysis, stress type | |
| InteroperabilityDialog | Import/Export DXF/IFC | |
| RailwayBridgeDialog | Command Palette → Railway Bridge | PRO |
| MeshingPanel | Command Palette → FEA Meshing | PRO |
| AdvancedSelectionPanel | Ribbon → Advanced Select | |
| LoadDialog | Context menu → Add Load | |
| WindLoadDialog | Ribbon → ASCE7 Wind | |
| SeismicLoadDialog | Ribbon → IS 1893 | |
| MovingLoadDialog | Command Palette → Moving Load | |
| SplitMemberDialog | Context menu → Split | |
| MemberSpecificationsDialog | Context menu → Specs | |
| ASCE7SeismicLoadDialog | Ribbon → ASCE7 Seismic | |
| ASCE7WindLoadDialog | Ribbon → ASCE7 Wind | |
| LoadCombinationsDialog | Ribbon → Combos | |
| IS1893SeismicLoadDialog | Ribbon → IS 1893 | |
| SectionBrowserDialog | Ribbon → Section Library | |
| AdvancedAnalysisDialog | Ribbon → Advanced / Command Palette | PRO |
| DesignCodesDialog | Ribbon → Design Codes | |
| ModalAnalysisPanel | Ribbon → Modal / Command Palette | PRO |
| ExportDialog | Ribbon → Export | |
| CloudProjectManager | Cmd+S (save), Cmd+O (open) | |
| StructureGallery | Ribbon → Gallery, Command Palette | |
| PlateCreationDialog | Ribbon → Plate | |
| FloorSlabDialog | Ribbon → Slab | |
| BoundaryConditionsDialog | Workflow → Supports | |
| SelectionToolbar | When elements selected | |
| DeadLoadGenerator | Ribbon → Self Weight | |
| CurvedStructureDialog | Ribbon → Curved | |
| DetailedDesignPanel | Ribbon → Detailed | |
| SteelDesignDialog | Ribbon → Steel Studio | |
| ConcreteDesignDialog | Ribbon → RC Studio | |
| ConnectionDesignDialog | Ribbon → Connections | |
| CivilEngineeringDialog | Ribbon → Civil Hub | |
| GenerativeDesignPanel | Ribbon → Generative | |
| SeismicDesignStudio | Ribbon → Seismic | |
| CommandPalette | Cmd+K / Ctrl+K | |

### 2.3 Multiplayer Provider

Entire shell is wrapped in `<MultiplayerProvider>` for collaboration awareness.

---

## 3. Engineering Ribbon

### 3.1 Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ 🔵 BeamLab ULTIMATE │ MODELING │ PROPERTIES │ LOADING │ ...      │ ⬆ Upgrade │ ☁ Auto-Saved │
├────────────────────────────────────────────────────────────────────┤
│  ┌─File──┐ ┌─Structure─┐ ┌─Create───┐ ┌─Select─┐ ┌─Edit──────┐  │
│  │Save   │ │Wizard     │ │Node      │ │Select  │ │Copy  Move │  │
│  │Open   │ │Gallery    │ │Beam      │ │Advanced│ │Mirror     │  │
│  │Export │ │           │ │Plate     │ │        │ │Rotate     │  │
│  │Undo   │ │           │ │Slab      │ │        │ │Split  Del │  │
│  │Redo   │ │           │ │          │ │        │ │           │  │
│  └───────┘ └───────────┘ └──────────┘ └────────┘ └───────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**File:** `apps/web/src/components/toolbar/EngineeringRibbon.tsx` (756 lines)

### 3.2 Title Bar

| Element | Position | Spec |
|---|---|---|
| Logo | Left | `BeamLab` text + `ULTIMATE` gradient badge (`from-amber-500 to-orange-500`, `text-[10px]`) |
| Category Tabs | Center | 6 tabs, see below |
| Upgrade Button | Right | `from-amber-500 to-orange-500` gradient, `Crown` icon, `text-xs` |
| Auto-Saved | Far Right | `text-xs text-slate-500 dark:text-slate-400`, `Check` icon (green) |

### 3.3 Category Tabs

| Category | Text Color (Active) | Background (Active) |
|---|---|---|
| MODELING | `text-blue-400` | `bg-blue-500/10 border-b-2 border-blue-500` |
| PROPERTIES | `text-purple-400` | `bg-purple-500/10 border-b-2 border-purple-500` |
| LOADING | `text-orange-400` | `bg-orange-500/10 border-b-2 border-orange-500` |
| ANALYSIS | `text-emerald-400` | `bg-emerald-500/10 border-b-2 border-emerald-500` |
| DESIGN | `text-rose-400` | `bg-rose-500/10 border-b-2 border-rose-500` |
| CIVIL | `text-amber-400` | `bg-amber-500/10 border-b-2 border-amber-500` |

**Inactive Tab:** `text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white`

### 3.4 Tool Buttons

**Three sizes:**

| Size | Height | Icon Size | Label |
|---|---|---|---|
| `large` | `56px` | `w-5 h-5` | Below icon, `text-[10px]` |
| `normal` | `50px` | `w-4 h-4` | Below icon, `text-[10px]` |
| `compact` | `h-8` | `w-4 h-4` | Inline, `text-[10px]` |

**Active state:** `bg-blue-600 text-white`  
**Inactive:** `text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700`

### 3.5 Tool Groups per Tab

#### MODELING Tab

| Group | Buttons | Size |
|---|---|---|
| File | Save (`Save`), Open (`FolderOpen`), Export (`Download`), Undo (`Undo2`), Redo (`Redo2`) | normal |
| Structure | Wizard (`Wand2`), Gallery (`LayoutGrid`) | large |
| Create | Node (`Circle`), Beam (`Minus`), Plate (`Square`), Slab (`Grid`) | normal |
| Select | Select (`MousePointer`), Advanced (`BoxSelect`) | normal |
| Edit | Copy (`Copy`), Move (`Move`), Mirror (`FlipHorizontal`), Rotate (`RotateCw`), Split (`Scissors`), Delete (`Trash2`) | compact |
| Supports | Boundary (`Anchor`) | large |

#### PROPERTIES Tab

| Group | Buttons |
|---|---|
| Section | Library (`Database`), Assign (`Link`), Section Builder (`Pen`) |
| Material | Material (`Layers`), Assign (`Link`), Properties (`Settings`) |
| Specifications | Beta Angle (`RotateCcw`), Releases (`Unlock`), Offsets (`MoveHorizontal`) |

#### LOADING Tab

| Group | Buttons |
|---|---|
| Load Cases | Define (`FileText`), Combos (`Layers`) |
| Nodal Loads | Force (`ArrowDown`), Moment (`RotateCcw`) |
| Member Loads | UDL (`BarChart`), Trapezoidal (`Triangle`), Point (`ArrowDown`) |
| Area Loads | Floor Load (`Grid`) |
| Generate | Self Weight (`Weight`), Wind IS 875 (`Wind`), ASCE7 Seismic (`Activity`), IS 1893 (`Activity`), Combinations (`Layers`) |

#### ANALYSIS Tab

| Group | Buttons | Notes |
|---|---|---|
| Run | **RUN ANALYSIS** (large, animated accent gradient), Modal (stacked), P-Delta (stacked) | RUN button has pulsing border |
| Advanced | Buckling, Response Spectrum, Pushover | |
| Results | Deformed, Diagrams, Output, Export | |

#### DESIGN Tab

| Group | Buttons |
|---|---|
| Code Check | Design Codes, D/C Ratios |
| Steel Design | Steel Studio |
| RC Design | RC Studio |
| Connection | Connections |
| Foundation | Foundation |
| Advanced | Detailed, Curved |

#### CIVIL Tab

| Group | Buttons |
|---|---|
| Civil Engineering | Civil Hub, Geotech, Hydraulics |
| Infrastructure | Transport, Construction |
| Design | Steel, Concrete, Connect |
| Advanced AI | AI Architect, Generative, Seismic |

### 3.6 Sub-Components

**ToolGroup:**
- Container: vertical layout with label (`text-[9px] text-slate-500 dark:text-slate-400 mt-1`) centered below
- Separator: `w-px h-12 bg-slate-200 dark:bg-slate-700 mx-1` between groups

**StackedButtons:**
- Two `MiniButton` instances vertically stacked
- Each: `h-8 px-2 text-[10px] flex items-center gap-1`

**MiniButton:**
- `h-8 px-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px]`

**Tooltip:**
- Appears on hover for all buttons
- Shows button name + keyboard shortcut if available
- `bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg`

---

## 4. Workflow Sidebar

**File:** `apps/web/src/components/toolbar/WorkflowSidebar.tsx` (244 lines)

### 4.1 Structure

```
┌──────────────┐
│  Workflow     │
│  ANALYTICAL   │
│  MODELING     │
├──────────────┤
│ ☑ Geometry   │  ← Box icon
│ ☑ Properties │  ← Layers icon
│ ☑ Materials  │  ← Database icon
│ ☐ Specs      │  ← Settings icon
│ ☐ Supports   │  ← Anchor icon
│ ☐ Loading    │  ← Download icon
│ ☐ Analysis   │  ← BarChart3 icon
│ ☐ Design     │  ← Ruler icon
│ ☐ Civil Engg │  ← Globe icon
├──────────────┤
│ 🟢 Online    │
└──────────────┘
```

### 4.2 Dimensions

| State | Width | Content |
|---|---|---|
| Expanded | `w-48` (192px) | Icons + text labels |
| Collapsed | `w-12` (48px) | Icons only |

### 4.3 Step Item Spec

| Part | Classes |
|---|---|
| Container | `flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all` |
| Active step | `bg-blue-500/10 text-blue-400 border-l-2 border-blue-500` |
| Completed step | Green `Check` icon (replaces step icon) |
| Inactive step | `text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800` |
| Step label | `text-sm font-medium` |
| Step icon | `w-5 h-5` |

### 4.4 Completion Logic

Steps auto-complete based on model state:
- **Geometry:** `nodes.size > 0`
- **Properties:** At least one member has a sectionId
- **Materials:** At least one member has material assigned
- **Supports:** At least one node has restraints
- **Loading:** At least one load exists

### 4.5 Category Mapping

Clicking a step sets the ribbon category:
| Step | Category |
|---|---|
| Geometry | MODELING |
| Properties, Materials, Specs | PROPERTIES |
| Supports | SUPPORTS (opens `boundaryConditionsDialog`) |
| Loading | LOADING |
| Analysis | ANALYSIS |
| Design | DESIGN |
| Civil Engg | CIVIL |

### 4.6 Bottom Section

- Connection status indicator
- `Online` label with green dot: `w-2 h-2 rounded-full bg-green-500`
- Container: `absolute bottom-0 left-0 right-0 p-3 border-t border-slate-200 dark:border-slate-700`

---

## 5. Inspector Panel (Right Panel)

**Defined inline in `ModernModeler.tsx`**

### 5.1 Dimensions

| State | Width |
|---|---|
| Expanded | `w-[280px]` |
| Collapsed | `w-[10px]` with hover handle |

### 5.2 Structure

```
┌─────────────────┐
│ Inspector   ▸/◂ │  ← Collapse toggle
├─────────────────┤
│ CategorySwitcher│
│ ┌─Tab─┬─Tab──┐  │
│ │ MOD │ PROP │  │
│ └─────┴──────┘  │
├─────────────────┤
│ Context-        │
│ sensitive       │
│ properties      │
│ panel           │
│                 │
│ (shows selected │
│  element props) │
└─────────────────┘
```

### 5.3 CategorySwitcher

5 compact tabs displayed horizontally:
| Tab | Label |
|---|---|
| MODELING | `MOD` |
| PROPERTIES | `PROP` |
| LOADING | `LOAD` |
| ANALYSIS | `ANLY` |
| DESIGN | `DSGN` |

- Active: `bg-blue-600 text-white text-[10px] px-2 py-1 rounded`
- Inactive: `text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] px-2 py-1 rounded`

### 5.4 Collapse Toggle

- Position: left edge of panel
- Expanded icon: `ChevronRight` (click collapses)
- Collapsed icon: `ChevronLeft` (click expands)
- `absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-blue-600 text-white rounded-full cursor-pointer shadow-md`

---

## 6. Status Bar

**Defined inline in `ModernModeler.tsx`**

### 6.1 Layout

```
┌───────────────────────────────────────────────────────────────────┐
│ ● Ready │ Mode: SELECT │ Tool: None │ 3 sel │ X:___ Y:___ Z:___ │
│ ⊡ Snap  │ N:5 M:3 P:0 │ LC:1 │ kN,m │ Zoom: 100% │ 🟢🟢🟢   │
└───────────────────────────────────────────────────────────────────┘
```

### 6.2 Zones

| Zone | Content | Classes |
|---|---|---|
| Status | Colored dot + "Ready" / "Analyzing..." / "Error" | `flex items-center gap-1 text-xs` |
| Mode | `Mode: {SELECT\|DRAW_NODE\|DRAW_BEAM\|...}` | `text-xs font-mono` |
| Tool | `Tool: {activeTool}` | `text-xs` |
| Selection | `{count} sel` | `text-xs text-blue-400` |
| Coordinates | `X:` `Y:` `Z:` input fields | `w-16 text-xs font-mono bg-transparent border-b` |
| Snap Toggle | `⊡ Snap` checkbox | `text-xs` |
| Counters | `N:{nodes} M:{members} P:{plates}` | `text-xs font-mono text-slate-500` |
| Load Case | `LC: {caseIndex}` | `text-xs` |
| Units | `kN, m` / `kip, ft` | `text-xs` |
| Zoom | `Zoom: {zoom}%` | `text-xs font-mono` |
| Backend Health | 3 colored dots (API/WASM/Worker) | `w-2 h-2 rounded-full` |

### 6.3 Backend Health Dots

| Dot | Green | Red | Yellow |
|---|---|---|---|
| API | Connected | Disconnected | Connecting |
| WASM | Loaded | Failed | Loading |
| Worker | Active | Inactive | — |

### 6.4 Container

```
Classes: h-6 flex items-center justify-between px-4
         bg-slate-100 dark:bg-slate-900
         border-t border-slate-200 dark:border-slate-800
         text-xs text-slate-500 dark:text-slate-400
```

---

## 7. Modeling Toolbar (Floating)

**File:** `apps/web/src/components/toolbar/ModelingToolbar.tsx` (284 lines)

### 7.1 Visibility

Only visible when `activeCategory === "MODELING"`

### 7.2 Position

Floating in viewport area — `absolute top-4 left-4` (after sidebar)

### 7.3 Container

```
Classes: bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm
         rounded-lg border border-slate-200 dark:border-slate-700
         shadow-lg p-2
```

### 7.4 Quick Access Tools

| Tool | Icon | Shortcut | Active Classes |
|---|---|---|---|
| SELECT | `MousePointer` | V | `bg-blue-600 text-white` |
| DRAW_NODE | `Circle` | N | `bg-blue-600 text-white` |
| DRAW_BEAM | `Minus` | B | `bg-blue-600 text-white` |
| DRAW_COLUMN | `ArrowUpDown` | C | `bg-blue-600 text-white` |
| DELETE | `Trash2` | Del | `bg-red-600 text-white` |

**Inactive button:** `text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700`  
**Button size:** `p-2 rounded-lg`

### 7.5 Tool Group Dropdowns

Loaded from `../../data/ToolGroups` (`MODELING_TOOL_GROUPS`)  
Each group: button with `ChevronDown` indicator → dropdown with sub-tools

---

## 8. Context Menus

**File:** `apps/web/src/components/ui/ContextMenu.tsx` (491 lines)

### 8.1 Rendering

Rendered via `createPortal(document.body)` at cursor position

### 8.2 Container

```
Classes: bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl
         rounded-lg shadow-2xl min-w-[200px]
         border border-slate-200 dark:border-slate-700
         py-1
```

### 8.3 Menu Item Spec

| Part | Classes |
|---|---|
| Container | `flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors` |
| Hover | `bg-slate-100 dark:bg-slate-800` |
| Icon | `w-4 h-4 text-slate-400` |
| Label | `flex-1 text-sm text-slate-700 dark:text-slate-200` |
| Shortcut | `text-xs text-slate-400 ml-auto` |
| Danger item | `text-red-500 hover:bg-red-500/10` |
| Separator | `h-px bg-slate-200 dark:bg-slate-700 my-1` |

### 8.4 Node Context Menu

| Item | Icon | Shortcut | Type |
|---|---|---|---|
| Edit Coordinates | `Pencil` | — | normal |
| Add Beam from Here | `Minus` | B | normal |
| Assign Support | `Anchor` | — | normal |
| Assign Load | `ArrowDown` | — | normal |
| Merge Selected Nodes | `GitMerge` | — | normal |
| — separator — | | | |
| Delete Node | `Trash2` | Del | danger |

### 8.5 Member Context Menu

| Item | Icon | Shortcut | Type |
|---|---|---|---|
| Edit Properties | `Settings` | — | normal |
| Assign Section | `Database` | S | normal |
| Assign Material | `Layers` | — | normal |
| Member Releases | `Unlock` | — | normal |
| Insert Node | `PlusCircle` | — | normal |
| Split at Nodes | `Scissors` | — | normal |
| Member Specifications | `FileText` | — | normal |
| Add Load | `ArrowDown` | L | normal |
| — separator — | | | |
| Delete Member | `Trash2` | Del | danger |

### 8.6 Empty Canvas Context Menu

| Item | Icon | Shortcut | Type |
|---|---|---|---|
| Add Node Here | `Circle` | N | normal |
| Paste | `Clipboard` | Ctrl+V | normal |
| Fit View | `Maximize` | Home | normal |
| View Options | `Eye` | → | submenu |

**View Options Submenu:**
| Item | Shortcut |
|---|---|
| Toggle Grid | G |
| View Settings | — |

### 8.7 Keyboard Navigation

| Key | Action |
|---|---|
| `Escape` | Close menu |
| `ArrowUp` | Previous item |
| `ArrowDown` | Next item |
| `Enter` / `Space` | Execute item |
| `Home` | First item |
| `End` | Last item |

### 8.8 Submenu Positioning

- Appears on hover: `left-full top-0`
- Same container styling as parent
- Animated: `opacity 0→1` on mount

---

## 9. Command Palette

**File:** `apps/web/src/components/ui/CommandPalette.tsx` (694 lines)

### 9.1 Trigger

`Cmd+K` (macOS) / `Ctrl+K` (Windows/Linux)

### 9.2 Container

```
Overlay: fixed inset-0 z-50 bg-black/50 backdrop-blur-sm
Dialog:  max-w-2xl w-full mx-auto mt-[15vh]
         bg-white dark:bg-slate-900 rounded-xl shadow-2xl
         border border-slate-200 dark:border-slate-700
         overflow-hidden
```

### 9.3 Search Input

```
Classes: w-full px-6 py-4 text-lg bg-transparent
         border-b border-slate-200 dark:border-slate-700
         text-slate-900 dark:text-white
         placeholder-slate-400
         focus:outline-none
Placeholder: "Type a command..."
Left icon: Search (w-5 h-5 text-slate-400)
```

### 9.4 Categories

| Category | Emoji | Label |
|---|---|---|
| Recently Used | 🕐 | Recently Used |
| Quick Actions | ⚡ | Quick Actions |
| Modeling | 📐 | Modeling |
| Properties | 🔧 | Properties |
| Loading | 📊 | Loading |
| Analysis | 🔬 | Analysis |
| Design | 🏗️ | Design |

### 9.5 Command List (30+ Commands)

#### Quick Actions
| Command | Shortcut | Action |
|---|---|---|
| Run Analysis | ⌘⏎ | Execute analysis |
| New Project | ⌘N | New project |
| Save to Cloud | ⌘S | Cloud save |

#### Category Switching
5 commands to switch between MODELING, PROPERTIES, LOADING, ANALYSIS, DESIGN

#### Structure Templates
| Command | Action |
|---|---|
| Open Gallery | Open structure gallery |
| Structure Wizard | Open wizard |

#### Load Generators
| Command | Notes |
|---|---|
| Wind Load (IS 875) | |
| Seismic Load (IS 1893) | |
| ASCE 7 Wind | |
| ASCE 7 Seismic | |
| Moving Load | |
| Load Combinations | |
| Loading Manager | |

#### Special
| Command | Badge |
|---|---|
| Railway Bridge | PRO |
| Foundation Design | — |

#### Analysis
| Command | Badge |
|---|---|
| Modal Analysis | PRO |
| Advanced Analysis | PRO |

#### Design Codes
| Command |
|---|
| IS 456 (Concrete) |
| IS 800 (Steel) |
| AISC 360 |
| Eurocode (EN 1992 / EN 1993) |

#### Import / Export
| Command |
|---|
| Import DXF |
| Import IFC |
| Import JSON |
| Export Project |

#### Tools
| Command | Badge |
|---|---|
| Geometry Tools | — |
| FEA Meshing | PRO |

#### Drawing Tools
| Command | Shortcut |
|---|---|
| Select | V |
| Draw Node | N |
| Draw Beam | B |
| Delete | ⌫ |

### 9.6 Command Item Spec

```
Container: px-4 py-3 cursor-pointer transition-colors
Hover:     bg-slate-100 dark:bg-slate-800
Active:    bg-blue-100 dark:bg-blue-900/30 (keyboard focus)

Icon:      w-5 h-5 text-slate-400 mr-3
Label:     text-sm text-slate-900 dark:text-white font-medium
Shortcut:  text-xs text-slate-400 ml-auto font-mono
           bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded
```

### 9.7 Fuzzy Search

- Match highlighting: `<mark className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">`
- No results: "No commands found" — `text-center py-8 text-slate-500`

### 9.8 Recent Commands

- Stored in `localStorage` key `beamlab-recent-commands`
- Max 5 items
- Displayed at top with 🕐 category header

### 9.9 Footer

```
Classes: flex items-center justify-between px-4 py-2
         border-t border-slate-200 dark:border-slate-700
         text-xs text-slate-400

Left:    "↑↓ Navigate  ↵ Select  ESC Close"
Right:   "{count} commands"
```

---

## 10. Results Toolbar (Post-Analysis)

**File:** `apps/web/src/components/results/ResultsToolbar.tsx` (1686 lines)

### 10.1 Position

Fixed bottom-right: `fixed bottom-4 right-4 z-40`

### 10.2 States

| State | Appearance |
|---|---|
| Collapsed | 3 small buttons: `Model`, `Results`, `X` |
| Expanded | `w-80` card with full controls |
| Hidden | When `analysisResults` is null |

### 10.3 Expanded Container

```
Classes: w-80 bg-white dark:bg-slate-900
         rounded-xl shadow-2xl
         border border-slate-200 dark:border-slate-800
         overflow-hidden
```

### 10.4 Header

```
Classes: flex items-center justify-between px-4 py-3
         bg-gradient-to-r from-blue-600 to-purple-600 text-white
```

| Element | Spec |
|---|---|
| Icon | `BarChart2` w-4 h-4 |
| Title | `"Analysis Results"` font-medium |
| Version badge | `text-[9px] bg-white/20 rounded px-1.5 py-0.5 font-mono` → `v3.0` |
| Minimize button | `Minimize2` w-4 h-4, `hover:bg-white/20` |
| Close button | `X` w-4 h-4, `hover:bg-white/20` |

### 10.5 Back to Model Button

```
Classes: w-full flex items-center gap-2 px-4 py-2
         text-sm font-medium text-blue-300
         hover:text-slate-900 dark:hover:text-white
         hover:bg-slate-200 dark:hover:bg-slate-800
         border-b border-slate-200 dark:border-slate-800
```
Icon: `ArrowLeft` w-4 h-4, text: "Back to Model"

### 10.6 Diagram Toggles

Section header: `text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider` → "Diagrams"

**Grid: `grid grid-cols-6 gap-1`** (6 columns for 8 items, wraps to 2 rows)

| Diagram ID | Label | Icon | Color |
|---|---|---|---|
| `deflection` | Deflected | `TrendingDown` | `text-blue-500` |
| `bmd` | BMD (Mz) | `BarChart2` | `text-green-500` |
| `sfd` | SFD (Vy) | `Activity` | `text-orange-500` |
| `bmd_my` | BMD (My) | `BarChart3` | `text-teal-500` |
| `sfd_vz` | SFD (Vz) | `Waves` | `text-cyan-500` |
| `reactions` | Reactions | `ArrowDownToLine` | `text-purple-500` |
| `axial` | Axial | `SlidersHorizontal` | `text-red-500` |
| `heatmap` | Heat Map | `Flame` | `text-yellow-500` |

**Active toggle:**
```
bg-slate-100 dark:bg-blue-500 dark:text-white
dark:ring-2 dark:ring-blue-400
```
**Inactive:** `hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-400`

**Button layout:** `flex flex-col items-center gap-1 p-2 rounded-lg`  
Icon: `w-4 h-4`  
Label: `text-[9px]`

### 10.7 Heat Map Type Selector

Shown only when `activeDiagram === "heatmap"`

3 type buttons in `flex gap-1`:

| Type | Label | Gradient (active) |
|---|---|---|
| `displacement` | Displacement | `from-[#1e3a8a] via-[#06b6d4] via-[#22c55e] via-[#eab308] to-[#dc2626]` |
| `stress` | Stress | Same as displacement |
| `utilization` | Utilization | `from-[#22c55e] via-[#3b82f6] via-[#f59e0b] via-[#f97316] to-[#ef4444]` |

**Color scale legend bar:**
- `h-2 rounded bg-gradient-to-r`
- Labels: "Low" ← → "High" in `text-[9px] text-slate-500 dark:text-slate-400`

### 10.8 Scale Slider

Section: `px-4 py-3 border-b`
- Label: "Scale" + `{scale}x` in `text-xs font-mono`
- `<input type="range" min="1" max="200">`
- Tick labels: `1x` — `100x` — `200x` in `text-[10px]`
- Slider: `w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600`

### 10.9 Animation Controls

| Button | State | Classes |
|---|---|---|
| Animate | Not animating | `bg-blue-100 dark:bg-blue-900/30 text-blue-600`, `Play` icon |
| Stop | Animating | `bg-red-100 dark:bg-red-900/30 text-red-600`, `Pause` icon |
| Reset | Always | `bg-slate-100 dark:bg-slate-800 text-slate-500`, `RotateCcw` icon |

### 10.10 Quick Stats

Grid: `grid grid-cols-2 gap-2`

| Card | Background | Text Colors |
|---|---|---|
| Max Displacement | `bg-blue-50 dark:bg-blue-900/20` | label: `text-[10px] text-blue-600 dark:text-blue-400`, value: `text-sm font-bold text-blue-700 dark:text-blue-300` |
| Max Reaction | `bg-purple-50 dark:bg-purple-900/20` | label: `text-purple-600 dark:text-purple-400`, value: `text-purple-700 dark:text-purple-300` |

### 10.11 Support Reactions Table

Shown only when `activeDiagram === "reactions"`

- Header: `text-xs font-medium text-purple-400 uppercase tracking-wider`
- Icon: `ArrowDownToLine` w-3 h-3
- Count: `({n} supports)`
- Max height: `max-h-48 overflow-y-auto`

Each support card:
```
Container: p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg
Node ID:   text-[10px] font-medium text-purple-600 dark:text-purple-300
Values:    grid grid-cols-3 gap-1 text-[9px]
           Label: text-slate-500 dark:text-slate-400
           Value: font-mono text-slate-900 dark:text-white
           Format: Fx: X.XX kN, Fy: X.XX kN, Mz: X.XX kN·m
           Only shown if |value| > 0.001
```

### 10.12 Export Results

| Button | Icon | Classes |
|---|---|---|
| Export PDF Report | `FileText` | `bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg` |
| Export CSV Data | `FileSpreadsheet` | `bg-green-600 hover:bg-green-700 text-white` |

Loading state: `Loader` w-4 h-4 `animate-spin`

### 10.13 Next Steps Buttons

| Button | Icon | Classes | Action |
|---|---|---|---|
| Member Force Diagrams | `Eye` | `from-orange-500 to-red-500` gradient | Opens `MemberDetailPanel` dialog |
| Full Results Dashboard | `LayoutDashboard` | `from-indigo-500 to-purple-600` gradient | Opens `AnalysisResultsDashboard` dialog |
| Advanced Analysis | `Zap` | `bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300` | Opens `advancedAnalysis` modal |
| Design Code Check | `FileCheck` | `bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300` | Opens `designCodes` modal |
| Post-Processing Design Studio | `BarChart3` | `from-emerald-500 to-teal-600` gradient | Opens `PostProcessingDesignStudio` |
| Open Design Hub | `Zap` | `from-blue-600 to-indigo-600` gradient | Navigates to `/design-hub` |

### 10.14 Collapsed State

```
Position: fixed bottom-4 right-4 z-40 flex items-center gap-2
```

3 buttons:
1. **Model** — `ArrowLeft` icon + "Model" text, `bg-white dark:bg-slate-900`
2. **Results** — `BarChart2` icon + "Results" + `Maximize2` icon, `bg-white dark:bg-slate-900`
3. **Close** — `X` icon

### 10.15 Connected Modals

**Full Results Dashboard:** `Dialog` → `max-w-[1800px] w-[95vw] h-[90vh] p-0`  
**Member Detail Panel:** `Dialog` → `max-w-[900px] w-[90vw] h-[85vh] p-0`  
**Post-Processing Design Studio:** Rendered directly (not in Dialog)

---

## 11. Analysis Panels

### 11.1 Panel Inventory

| Panel | File | Style System | Accent |
|---|---|---|---|
| BucklingAnalysisPanel | `analysis/BucklingAnalysisPanel.tsx` | Inline CSS (dark) | Green #4CAF50 |
| CableAnalysisPanel | `analysis/CableAnalysisPanel.tsx` | Inline CSS (dark) | Blue #2196F3 |
| PDeltaAnalysisPanel | `analysis/PDeltaAnalysisPanel.tsx` | Inline CSS (dark) | Orange #FF5722 |
| ModalAnalysisPanel | `analysis/ModalAnalysisPanel.tsx` | Tailwind (dialog) | Indigo |
| SeismicAnalysisPanel | `analysis/SeismicAnalysisPanel.tsx` | Tailwind | Red-Orange |
| TimeHistoryPanel | `analysis/TimeHistoryPanel.tsx` | Tailwind | Blue-Cyan |
| PINNPanel | `analysis/PINNPanel.tsx` | Tailwind | Purple-Indigo |
| StructuralAnalysisViewer | `analysis/StructuralAnalysisViewer.tsx` | Tailwind + framer-motion | Blue |

### 11.2 Inline CSS Dark Panels (Buckling, Cable, P-Delta)

These three panels use **inline styles** (not Tailwind):

| Token | Value |
|---|---|
| Page background | `background: '#1e1e1e'`, `color: '#fff'` |
| Card | `background: '#2d2d2d'`, `padding: '20px'`, `borderRadius: '8px'` |
| Input | `background: '#1e1e1e'`, `border: '1px solid #444'`, `borderRadius: '4px'`, `padding: '8px'` |
| Error bar | `background: '#d32f2f'` |
| Info box | `background: '#424242'`, `text: '#bbb'` |
| Table header | `borderBottom: '2px solid #555'` |
| Blue value | `color: '#4fc3f7'` |
| Green badge | `color: '#4caf50'` |
| Orange warn | `color: '#ff9800'` |
| Rust badge | `fontSize: '12px'`, `color: '#888'`, text: "⚡ Powered by Rust (20x faster than Python)" |

### 11.3 Tailwind Analysis Panels

All share these patterns:
- Root: `min-h-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 space-y-6`
- Header icon container: `w-10 h-10 rounded-lg bg-gradient-to-br from-{a} to-{b}`
- Title: `text-xl font-bold`
- Inputs: `bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2`
- Labels: `text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider`
- Result cards: `bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg p-4`
- Value typography: `text-2xl font-bold text-{accent}`

| Panel | Header Gradient | Run Button Gradient |
|---|---|---|
| Seismic | `from-red-500 to-orange-500` | `from-red-600 to-orange-600` |
| Time History | `from-blue-500 to-cyan-500` | `from-blue-600 to-cyan-600` |
| PINN | `from-purple-600 to-indigo-600` | `bg-indigo-600 hover:bg-indigo-500` |
| Modal | `from-indigo-900/50 to-purple-900/50` | `bg-indigo-600 hover:bg-indigo-500` |

### 11.4 Modal Analysis Summary

See [Appendix D](#appendix-d--analysis-panels-deep-spec) for full micro-detail.

**Key differentiator:** Uses Dialog component (`max-w-4xl max-h-[80vh]`), not full page.

**Summary footer (3 cards):**
| Card | Icon | Color | Label |
|---|---|---|---|
| Fundamental Frequency | `Gauge` | `text-cyan-400` | `{freq.toFixed(2)} Hz` |
| Fundamental Period | `Building2` | `text-emerald-400` | `{period.toFixed(3)} s` |
| Mass Participation | `BarChart2` | `text-purple-400` | `{percent.toFixed(0)}%` |

**Mode participation bars:**
- X-direction: `bg-red-500`, container `w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full`
- Y-direction: `bg-blue-500`, same container

---

## 12. Design Panels & Dialogs

### 12.1 Studio Dialogs Pattern

All "Studio" dialogs share this architecture:

```
┌─────────────────────────────────────────────┐
│ 🔵 {Icon} │ {Title}            │     [X]   │
│           │ {Subtitle / codes}  │           │
├─────────────────────────────────────────────┤
│  Tab1  │  Tab2  │  Tab3  │  Tab4  │  Tab5  │
├─────────────────────────────────────────────┤
│                                             │
│          Tab Content Area                   │
│          (lazy-loaded components)           │
│                                             │
└─────────────────────────────────────────────┘
```

**Shared dimensions:**

| Dialog | Max Width | Width | Height |
|---|---|---|---|
| Steel Design Studio | `max-w-6xl` | `w-[95vw]` | `h-[90vh]` |
| Concrete Design Studio | `max-w-6xl` | `w-[95vw]` | `h-[90vh]` |
| Connection Design | `max-w-4xl` | `w-[95vw]` | `h-[85vh]` |
| Civil Engineering Hub | `max-w-6xl` | `w-[95vw]` | `h-[90vh]` |

**Overlay:** `fixed inset-0 z-50`, backdrop: `bg-black/60 backdrop-blur-sm`

### 12.2 Steel Design Studio

**File:** `apps/web/src/components/dialogs/SteelDesignDialog.tsx`

**Header gradient:** `from-blue-600/10 to-purple-600/10`  
**Icon container:** `w-10 h-10 rounded-lg bg-blue-600/20` → `Columns3` w-5 h-5 `text-blue-400`  
**Title:** "Steel Design Studio"  
**Subtitle:** "IS 800 · AISC 360 · Eurocode 3 — Beam, Column & Composite Design"

**Tabs:**
| Tab | Label | Icon | Active Color |
|---|---|---|---|
| `beam` | Beam Design | `Ruler` | `text-blue-400 border-blue-500 bg-blue-600/10` |
| `column` | Column Design | `Columns3` | same |
| `slab` | Composite Slab | `LayoutGrid` | same |
| `compliance` | Code Compliance | `Shield` | same |

**Inactive tab:** `text-slate-500 dark:text-slate-400`

**Content mapping:**
- `beam` → `<SteelMemberDesigner />`
- `column` → Placeholder card + "Open Column Designer" button → opens `EnhancedColumnDesignDialog`
- `slab` → Placeholder card + "Open Slab Designer" button → opens `EnhancedSlabDesignDialog`
- `compliance` → `<CodeCompliancePanel />`

**Loading fallback:** `Loader2` w-8 h-8 `text-blue-400 animate-spin` + "Loading design module..."

### 12.3 Concrete Design Studio

**File:** `apps/web/src/components/dialogs/ConcreteDesignDialog.tsx`

**Header gradient:** `from-orange-600/10 to-amber-600/10`  
**Icon container:** `bg-orange-600/20` → `Building2` w-5 h-5 `text-orange-400`  
**Title:** "Concrete Design Studio"  
**Subtitle:** "IS 456 · ACI 318 · Eurocode 2 — RC Beam, Column, Slab, Footing & Prestressed"

**Tabs:**
| Tab | Label | Icon | Active Color |
|---|---|---|---|
| `beam` | RC Beam | `Ruler` | `text-orange-400 border-orange-500 bg-orange-600/10` |
| `column` | RC Column | `Building2` | same |
| `slab` | RC Slab | `LayoutGrid` | same |
| `footing` | Footing | `Landmark` | same |
| `prestressed` | Prestressed | `Zap` | same |

Tab bar: `overflow-x-auto`, tabs have `min-w-fit whitespace-nowrap`

**Content:** Each tab renders its lazy component directly:
- `beam` → `<RCBeamDesigner />`
- `column` → `<RCColumnDesigner />`
- `slab` → `<RCSlabDesigner />`
- `footing` → `<RCFootingDesigner />`
- `prestressed` → `<PrestressedDesigner />`

### 12.4 Connection Design

**File:** `apps/web/src/components/dialogs/ConnectionDesignDialog.tsx`

**Header gradient:** `from-purple-600/10 to-indigo-600/10`  
**Icon container:** `bg-purple-600/20` → `Link2` w-5 h-5 `text-purple-400`  
**Title:** "Connection Design"  
**Subtitle:** "IS 800 — Shear Bolt, Moment Bolt & Base Plate Connections"

**No tab bar** — single content area renders `<ConnectionDesignPanel />`

### 12.5 Civil Engineering Hub

**File:** `apps/web/src/components/dialogs/CivilEngineeringDialog.tsx`

**Header gradient:** `from-green-600/10 to-teal-600/10`  
**Icon container:** `bg-green-600/20` → `Globe` w-5 h-5 `text-green-400`  
**Title:** "Civil Engineering Hub"  
**Subtitle:** "Geotechnical · Hydraulics · Transportation · Construction Management"

**Tabs:**
| Tab | Label | Icon | Active Color |
|---|---|---|---|
| `geotechnical` | Geotechnical | `Mountain` | `text-green-400 border-green-500 bg-green-600/10` |
| `hydraulics` | Hydraulics | `Droplets` | same |
| `transportation` | Transportation | `Car` | same |
| `construction` | Construction Mgmt | `HardHat` | same |

**Content:**
- `geotechnical` → `<BearingCapacityCalculator />`
- `hydraulics` → `<HydraulicsDesigner />`
- `transportation` → `<TransportationDesigner />`
- `construction` → `<ConstructionManager />`

**Special:** Uses `text-gray-500` (not `text-slate-500`) for loading text, `p-4` (not `p-6`) for content padding.

### 12.6 Enhanced Beam Design Dialog

**File:** `apps/web/src/components/design/EnhancedBeamDesignDialog.tsx`

Uses `framer-motion` for tab animations (`AnimatePresence mode="wait"`)

**Root:** `w-full max-w-4xl mx-auto bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-xl`

**Header:** `bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4`
- Title: "RC Beam Design" + `Calculator` icon
- Code selector: `px-4 py-2 bg-white/20 text-slate-900 dark:text-white rounded-lg`

**3 Tabs:** Input (`Settings`), Results (`BarChart2`), Detailing (`Grid3X3`)
- Active: `text-blue-600 border-b-2 border-blue-600 bg-blue-50/50`

**Design codes:** IS 456:2000, ACI 318-19, EC2 / EN 1992-1-1

**Concrete grades:** M20, M25, M30, M35, M40, M45, M50  
**Steel grades:** Fe415, Fe500, Fe550, Fe600  
**Bar diameters:** 10, 12, 16, 20, 25, 28, 32 mm

**Input Tab:** 2-column grid with SVG cross-section preview:
- SVG `viewBox="0 0 200 120"` showing rectangle, dashed effective depth line, 3 red rebar circles
- Fields: Width (200–600mm), Depth (300–1500mm), Cover (25–75mm), Span (1000+mm)
- Advanced collapsible: Beam Type, Exposure Condition, Service Moment

**Results Tab:** StatusBadge (PASS/FAIL/REVIEW), Utilization bars, Check items with color coding:
- ≤ 0.7 → green, ≤ 1.0 → amber, > 1.0 → red
- Animated `motion.div` with `duration: 0.5, ease: 'easeOut'`

**Detailing Tab:** Cross-section SVG `viewBox="0 0 300 250"` with:
- Hatch pattern, stirrups (dashed green), tension bars (red), compression bars (purple)
- Export buttons: Report, Download DXF, Save Design

**Sub-components:**
| Component | Props | Key Visual |
|---|---|---|
| `StatusBadge` | `status: PASS\|FAIL\|REVIEW` | PASS: green bg + `Check`, FAIL: red bg + `X`, REVIEW: amber bg + `AlertTriangle` |
| `InputField` | `label, name, value, unit, tooltip` | `Info` icon hover → 48px tooltip popup |
| `CheckItem` | `check` | pass=green bg, fail=red bg, warning=amber bg |
| `UtilizationBar` | `value, max, label` | Animated bar with conditional coloring |

### 12.7 Enhanced Column Design Dialog

**File:** `apps/web/src/components/design/EnhancedColumnDesignDialog.tsx`

**Dialog:** `max-w-5xl max-h-[90vh]`

**Header icon:** `Columns` w-5 h-5 `text-amber-400` in `bg-amber-500/20`  
**Title:** "RCC Column Design"

**Tabs:** Input (`Settings`), Results (`FileText`), Interaction (`TrendingUp`)
- Active: `text-blue-400 border-b-2 border-blue-400 bg-blue-500/5`

**Design codes:** IS 456, ACI 318, EN 1992, AS 3600  
**Concrete grades:** 20–60 MPa  
**Steel grades:** Fe415, Fe500, Fe550

**Input Tab (3-column grid):**
- Column 1 — Section: Shape toggle (rectangular/circular), Width, Depth, Height, Eff Length, Cover
- Column 2 — Material & Loads: Concrete/Steel Grade, Pu, Mux, Muy, Bracing toggle
- Column 3 — SVG cross-section preview + slenderness info panel

**Results Tab (2-column):**
- Left: Adequacy banner (`CheckCircle2` green / `AlertTriangle` red), reinforcement summary, capacity
- Right: Cross-section SVG, design notes

**Interaction Tab:** P-M Interaction diagram SVG `width={300} height={250}`
- Parabolic curve: `stroke="#3b82f6"`, `fill="#3b82f6" opacity=0.1`
- Design point: adequate → `fill="#10b981"`, inadequate → `fill="#ef4444"`

**Footer:** Reset + Export + "Design Column" gradient button (`from-blue-600 to-cyan-600`)

### 12.8 Enhanced Slab Design Dialog

**File:** `apps/web/src/components/design/EnhancedSlabDesignDialog.tsx`

**Same structure as Column dialog** with slab-specific content:

**Title:** "RCC Slab Design"  
**Tabs:** Input, Results, Detailing

**Slab types:** One-Way, Two-Way, Flat  
**Support conditions:** Simply Supported, One Edge Continuous, Two Edges Continuous, All Edges Continuous, Cantilever  
**Bar diameters:** 8, 10, 12, 16 mm

**SVG slab plan:** rect fill `#fef3c7` stroke `#f59e0b`, reinforcement grid (blue X-dir, green Y-dir)

**Results:** Reinforcement cards with direction icons:
- X-Direction bottom: `ArrowLeftRight` in `bg-blue-500/10`
- Y-Direction bottom: `ArrowUpDown` in `bg-emerald-500/10`
- X-Direction top: `ArrowLeftRight` in `bg-amber-500/10`
- Y-Direction top: `ArrowUpDown` in `bg-purple-500/10`

### 12.9 Foundation Design Panel

**File:** `apps/web/src/components/design/FoundationDesignPanel.tsx`

Full-page panel (no dialog wrapper):
- Title: "Foundation Design (IS 456)" — `bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent`
- 2-column grid: Input (left) + Results (right)
- Inputs: Axial Load (kN), SBC (kPa), Moment Mx/My (kNm)
- Button: `bg-blue-600 hover:bg-blue-500 w-full py-3 rounded-lg font-semibold`
- Results: Status (PASS green / FAIL red), Dimensions (L/W/D), Reinforcement, Checks
- API: `POST /design/foundation/check`

### 12.10 RC Design Panel

**File:** `apps/web/src/components/design/RCDesignPanel.tsx`

Full-page panel:
- Title: "RC Beam/Column Design (IS 456)" — `bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent`
- Inputs: Width (300mm), Depth (450mm), Moment (100 kNm), Shear (50 kN), Axial (0 kN)
- Button: `bg-emerald-600 hover:bg-emerald-500`
- Results: Status, Reinforcement details (key-value grid), Checks with ratio coloring
- API: `POST /design/concrete/check`

### 12.11 Connection Design Panel

**File:** `apps/web/src/components/design/ConnectionDesignPanel.tsx`

Embedded inside ConnectionDesignDialog:
- Connection type select: `shear_bolt`, `moment_bolt`, `base_plate`
- 8 form fields for bolt/plate parameters
- API: `POST /design/connection/check`
- Results: PASS/FAIL with color coding

### 12.12 Design Code Results Panel

**File:** `apps/web/src/components/design/DesignCodeResultsPanel.tsx`

- Code selector tabs: IS 800, AISC 360, EC3
- Member results with expandable checks
- Summary cards: PASS (green), WARNING (yellow), FAIL (red)
- Utilization color coding: ≤0.7 → green, ≤0.9 → yellow, >0.9 → red

---

## 13. Civil Engineering Panel

**File:** `apps/web/src/components/civil/CivilPanel.tsx` (472 lines)

### 13.1 Header

- Icon Container: `bg-yellow-600/20 rounded-lg p-2`
- Icon: `HardHat` w-5 h-5 `text-yellow-600`
- Title: "Civil Engineering"
- Subtitle: "Multi-disciplinary analysis & design"

### 13.2 Sub-Panels (7)

| Panel | Icon | Title | Button Text | Button Color | Key Formula/Output |
|---|---|---|---|---|---|
| GeotechPanel | — | Foundation Analysis | "Calculate & Visualize" | `bg-yellow-600` | Q_allow (kPa), Safety Factor |
| TransportPanel | — | Highway Design | "Design & Draw Horizontal Curve" | `bg-blue-600` | Generates curve nodes+members |
| HydraulicsPanel | — | Channel Flow | "Calculate & Draw Channel" | `bg-cyan-600` | Discharge, Velocity, Flow Regime |
| EnvironmentalPanel | — | WTP Design | "Design Treatment Plant" | `bg-green-600` | Treatment units, Sludge production |
| ConstructionPanel | — | Project Scheduling (CPM) | "Calculate Critical Path" | `bg-orange-600` | Total Duration, Critical Path tags |
| SurveyPanel | — | Surveying | "Plot Closed Traverse" | `bg-purple-600` | Generates square traverse |
| PINNPanel | — | AI Physics Engine | "Start AI Training" | `bg-indigo-600` | Neural network beam prediction |

### 13.3 GeotechPanel Detail

**Inputs:**
| Field | Default | Unit |
|---|---|---|
| Foundation Width | — | m |
| Foundation Depth | — | m |

**Results display:**
- Q_allow: `text-lg font-bold` value + "kPa" unit
- Safety Factor: value display
- Action: Creates 3D plate element for footing visualization

### 13.4 HydraulicsPanel Detail

**Inputs:**
| Field | Default | Unit |
|---|---|---|
| Base Width | — | m |
| Water Depth | — | m |

**Results:**
- Discharge (m³/s), Velocity (m/s), Flow Regime (Subcritical/Supercritical/Critical)

### 13.5 Quick Tools Grid

4 quick-access tool buttons at bottom:

| Tool | Description |
|---|---|
| Unit Converter | Opens unit conversion utility |
| Manning's Calc | Manning's equation calculator |
| Wind Rose | Wind direction analysis |
| Traffic LOS | Level of Service calculator |

### 13.6 Services Integration

- `geotechnical`, `transportation`, `hydraulics`, `environmental`, `construction`, `surveying` from civil services
- `GenerativeDesignService` for AI-powered design
- `voiceInput` for voice commands
- `sequentialLearning` for optimization

---

## 14. Empty Workspace Overlay

**Defined inline in `ModernModeler.tsx`**

### 14.1 Visibility

Shown when `nodes.size === 0` (no geometry exists)

### 14.2 Layout

```
┌──────────────────────────────────┐
│          BeamLab                 │
│    Start your structural         │
│    analysis journey              │
│                                  │
│  ┌──────────┐  ┌──────────┐     │
│  │ ○ Draw   │  │ 🪄 Wizard │     │
│  │   Nodes  │  │          │     │
│  └──────────┘  └──────────┘     │
│  ┌──────────┐  ┌──────────┐     │
│  │ 📁 Gallery│  │ 📥 Import │     │
│  │          │  │   File   │     │
│  └──────────┘  └──────────┘     │
│                                  │
│       ⌘K to open commands        │
└──────────────────────────────────┘
```

### 14.3 Spec

**Container:** `absolute inset-0 flex items-center justify-center`  
**Card:** `bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-8 max-w-md shadow-lg`

**4-button grid:** `grid grid-cols-2 gap-4`

| Button | Icon | Action |
|---|---|---|
| Draw Nodes | `Circle` | Set tool to DRAW_NODE |
| Structure Wizard | `Wand2` | Open StructureWizard |
| Gallery | `LayoutGrid` | Open StructureGallery |
| Import File | `Upload` | Open InteroperabilityDialog |

**Button classes:**
```
flex flex-col items-center gap-2 p-4
bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/30
rounded-xl transition-colors cursor-pointer
text-sm text-slate-700 dark:text-slate-300
```

**Cmd+K hint:** `text-xs text-slate-400 mt-4` → "Press ⌘K to open commands"

---

## 15. 3D Viewport & Canvas

### 15.1 Technology

- React Three Fiber (R3F) — `@react-three/fiber`
- Three.js based 3D rendering
- `@react-three/drei` for helpers (OrbitControls, Grid, etc.)

### 15.2 Viewport Overlays

Overlays are rendered as HTML elements positioned over the 3D canvas:

| Overlay | Position | Z-Index | Condition |
|---|---|---|---|
| ModelingToolbar | top-left | `z-10` | MODELING category |
| SelectionToolbar | top-center | `z-10` | Elements selected |
| ResultsToolbar | bottom-right | `z-40` | After analysis |
| ResultsTableDock | bottom-center | `z-30` | After analysis |
| EmptyOverlay | center | `z-20` | No nodes |
| ContextMenu | cursor pos | `z-50` | Right-click |

### 15.3 Grid

- Visible by default (toggleable via Grid shortcut `G`)
- XZ plane grid for structural frame modeling

---

## Appendix A — Icon Reference Table

All icons are from `lucide-react` unless noted.

### Shell & Navigation

| Icon | Component | Usage |
|---|---|---|
| `BarChart2` | ResultsToolbar | Header icon, SFD toggle |
| `BarChart3` | ResultsToolbar | BMD My toggle |
| `Activity` | StructuralAnalysisViewer, ResultsToolbar | Structural Analysis title, SFD Vy toggle |
| `TrendingDown` | ResultsToolbar | Deflected shape toggle |
| `ArrowDownToLine` | ResultsToolbar | Reactions toggle |
| `SlidersHorizontal` | ResultsToolbar | Axial toggle |
| `Flame` | ResultsToolbar | Heat map toggle |
| `Waves` | ResultsToolbar, ModalAnalysisPanel | SFD Vz toggle, Modal empty state |
| `Crown` | CommandPalette, EngineeringRibbon | PRO badge |
| `Search` | CommandPalette | Search input icon |
| `MousePointer` | ModelingToolbar | Select tool |
| `ChevronDown` | ModelingToolbar | Dropdown indicator |
| `ChevronRight` / `ChevronLeft` | InspectorPanel | Collapse toggles |
| `Minimize2` / `Maximize2` | ResultsToolbar | Collapse/expand controls |
| `ArrowLeft` | ResultsToolbar | Back to Model |
| `Play` / `Pause` | ResultsToolbar, ModalAnalysisPanel | Animation / Analysis controls |
| `RotateCcw` | ResultsToolbar, Column/Slab dialogs | Reset button |
| `X` | All dialogs | Close button |
| `Loader2` | All studio dialogs | Loading spinner |
| `Eye` | ResultsToolbar | Member force diagrams |
| `LayoutDashboard` | ResultsToolbar | Full dashboard |
| `FileText` | ResultsToolbar, various | PDF export, tab icon |
| `FileSpreadsheet` | ResultsToolbar | CSV export |
| `FileCheck` | ResultsToolbar | Design code check |
| `Zap` | ResultsToolbar, ConcreteDesign | Advanced analysis, Prestressed |
| `Link` | ResultsToolbar | Open Design Hub |

### Analysis Panel Icons

| Icon | Panel | Usage |
|---|---|---|
| `Brain` | PINNPanel | Header (white on purple-indigo gradient) |
| `CheckCircle` | PINNPanel | Success result |
| `BarChart` | PINNPanel | Prediction section |
| `Gauge` | ModalAnalysisPanel | Fundamental Frequency card |
| `Building2` | ModalAnalysisPanel, ConcreteDesign | Period card, Column icon |
| `Loader2` | ModalAnalysisPanel | Run button loading |

### Design Dialog Icons

| Icon | Dialog | Usage |
|---|---|---|
| `Columns3` | SteelDesignDialog | Header, Column tab |
| `Ruler` | SteelDesign, ConcreteDesign | Beam tab |
| `LayoutGrid` | SteelDesign, ConcreteDesign | Slab tab, Gallery |
| `Shield` | SteelDesignDialog | Code Compliance tab |
| `Link2` | ConnectionDesignDialog | Header icon |
| `Mountain` | CivilEngineeringDialog | Geotechnical tab |
| `Droplets` | CivilEngineeringDialog | Hydraulics tab |
| `Car` | CivilEngineeringDialog | Transportation tab |
| `HardHat` | CivilEngineeringDialog, CivilPanel | Construction tab, Civil header |
| `Globe` | CivilEngineeringDialog | Hub header |
| `Landmark` | ConcreteDesignDialog | Footing tab |
| `Calculator` | EnhancedBeamDesign | Header, Design button |
| `Settings` | EnhancedBeamDesign, Column, Slab | Input tab |
| `Grid3X3` | EnhancedBeamDesign | Detailing tab |
| `Layers` | EnhancedSlabDesign, Various | Materials, Section Properties |
| `Box` | EnhancedBeamDesign | Section Geometry |
| `Square` | EnhancedColumnDesign, Slab | Section shape, Geometry |
| `Columns` | EnhancedColumnDesign | Header icon |
| `TrendingUp` | EnhancedColumnDesign | Interaction diagram tab |
| `CircleDot` | EnhancedColumnDesign | Circular section |
| `ArrowLeftRight` | EnhancedSlabDesign | X-direction reinforcement |
| `ArrowUpDown` | EnhancedSlabDesign | Y-direction reinforcement |
| `Download` | Various | Export, DXF download |
| `Save` | EnhancedBeamDesign | Save design |
| `RefreshCw` | EnhancedBeamDesign | Calculating spinner |
| `Info` | Various | Tooltips, info callouts |
| `AlertTriangle` | Various | Warnings, REVIEW status |
| `CheckCircle2` | Column, Slab dialogs | Adequacy pass |
| `Check` | EnhancedBeamDesign | PASS status badge |

### Context Menu Icons

| Icon | Menu Item |
|---|---|
| `Pencil` | Edit Coordinates |
| `Minus` | Add Beam |
| `Anchor` | Assign Support |
| `ArrowDown` | Assign Load, Add Load |
| `GitMerge` | Merge Nodes |
| `Trash2` | Delete (danger) |
| `Settings` | Edit Properties |
| `Database` | Assign Section |
| `Layers` | Assign Material |
| `Unlock` | Member Releases |
| `PlusCircle` | Insert Node |
| `Scissors` | Split |
| `FileText` | Member Specifications |
| `Circle` | Add Node |
| `Clipboard` | Paste |
| `Maximize` | Fit View |
| `Eye` | View Options |

---

## Appendix B — Keyboard Shortcuts Map

### Global

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open Command Palette |
| `⌘S` / `Ctrl+S` | Save to Cloud |
| `⌘N` / `Ctrl+N` | New Project |
| `⌘Z` / `Ctrl+Z` | Undo |
| `⌘⇧Z` / `Ctrl+Y` | Redo |
| `⌘⏎` / `Ctrl+Enter` | Run Analysis |
| `Escape` | Close current dialog/menu |
| `Delete` / `Backspace` | Delete selected elements |

### Drawing / Selection

| Shortcut | Action |
|---|---|
| `V` | Select tool |
| `N` | Draw Node |
| `B` | Draw Beam |
| `C` | Draw Column |
| `S` | Assign Section |
| `L` | Add Load |
| `G` | Toggle Grid |
| `Home` | Fit View |
| `Ctrl+V` | Paste |

### Command Palette Navigation

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate items |
| `Enter` | Execute selected command |
| `Escape` | Close palette |

### Context Menu Navigation

| Key | Action |
|---|---|
| `↑` / `↓` | Move selection |
| `Enter` / `Space` | Execute |
| `Home` / `End` | First / Last item |
| `Escape` | Close menu |

---

## Appendix C — Color Token Glossary

### Status Colors

| Status | Light BG | Dark BG | Text Color |
|---|---|---|---|
| PASS | `bg-green-100` | `bg-green-900/20` | `text-green-700` (light) / `text-green-400` (dark) |
| FAIL | `bg-red-100` | `bg-red-900/20` | `text-red-700` / `text-red-400` |
| WARNING | `bg-amber-100` | `bg-amber-900/20` | `text-amber-700` / `text-amber-400` |
| REVIEW | `bg-amber-100` | `bg-amber-900/20` | `text-amber-700` / `text-amber-400` |

### Utilization Bar Colors

| Range | Bar Color | Text Color |
|---|---|---|
| ≤ 0.7 | `bg-green-500` | `text-green-600` |
| 0.7 – 1.0 | `bg-amber-500` | `text-amber-600` |
| > 1.0 | `bg-red-500` | `text-red-600` |

### Heat Map Gradients

| Type | Gradient Stops |
|---|---|
| Displacement / Stress | `#1e3a8a` → `#06b6d4` → `#22c55e` → `#eab308` → `#dc2626` |
| Utilization | `#22c55e` → `#3b82f6` → `#f59e0b` → `#f97316` → `#ef4444` |

### Diagram Colors

| Diagram | Line/Fill Color |
|---|---|
| Deflected Shape | `text-blue-500` (#3b82f6) |
| BMD (Mz) | `text-green-500` (#22c55e) |
| SFD (Vy) | `text-orange-500` (#f97316) |
| BMD (My) | `text-teal-500` (#14b8a6) |
| SFD (Vz) | `text-cyan-500` (#06b6d4) |
| Reactions | `text-purple-500` (#a855f7) |
| Axial | `text-red-500` (#ef4444) |
| Heat Map | `text-yellow-500` (#eab308) |

### SVG Viewer Colors (StructuralAnalysisViewer)

| Element | Stroke/Fill |
|---|---|
| Members | `#1e293b` stroke-3, selected: `#3b82f6` stroke-4 |
| Nodes | `#1e293b` fill, `white` stroke-2, selected: `#3b82f6` fill |
| Grid | `#e2e8f0` stroke-0.5 |
| Deflected | `#10b981` stroke-3 dashed |
| BMD fill | `rgba(239, 68, 68, 0.2)`, stroke `#ef4444` |
| SFD fill | `rgba(59, 130, 246, 0.2)`, stroke `#3b82f6` |
| Point loads | `text-red-500` |
| UDL loads | `text-blue-500` |
| Reactions | `text-green-600` |

### Inline Dark Theme (Analysis Panels)

| Token | Hex | Usage |
|---|---|---|
| Page bg | `#1e1e1e` | Buckling, Cable, PDelta backgrounds |
| Card bg | `#2d2d2d` | Section cards |
| Input bg | `#1e1e1e` | Form inputs |
| Border | `#444` | Input borders |
| Error | `#d32f2f` | Error bar |
| Info | `#424242` | About boxes |
| Text secondary | `#bbb` | Info descriptions |
| Text muted | `#888` / `#999` | Rust badge, empty states |
| Value blue | `#4fc3f7` | PDelta displacement values |
| Value green | `#4caf50` | Converged, buckling safe |
| Value orange | `#ff9800` | Amplification factor, not converged |
| Run green | `#4CAF50` | Buckling run button |
| Run blue | `#2196F3` | Cable run button |
| Run orange | `#FF5722` | PDelta run button |
| Status green bg | `#1b5e20` | PDelta converged bg |
| Status orange bg | `#e65100` | PDelta not-converged bg |

---

## Appendix D — Analysis Panels Deep Spec

### D.1 Buckling Analysis Panel

**State:** `{ modes: 5, analyzing: false, results: null, error: '' }`

**Header emoji:** 📊  
**Run button:** `#4CAF50` green, text "▶️ Run Buckling Analysis" / "🔄 Analyzing..."  
**Rust badge:** "⚡ Powered by Rust (20x faster than Python)"

**Results table:**
| Column | Format |
|---|---|
| Mode | Integer |
| Load Factor | `.toFixed(4)` |
| Critical Load (kN) | `.toFixed(2)` |

**Interpretation (5 bullets):**
1. Load Factor > 1: Structure is stable under applied loads
2. Load Factor < 1: Buckling occurs before full load is applied
3. Higher modes typically have higher load factors
4. Critical load = Applied Load × Load Factor
5. Consider first mode (lowest factor) for design

**About box:** Text explaining elastic buckling theory, eigenvalue approach, Euler formula reference.

### D.2 Cable Analysis Panel

**State:** `{ cableModulus: 200000, tensionOnly: true, sag: 0.05, iterations: 20, analyzing: false, results: null, error: '' }`

**Header emoji:** 🔗  
**Run button:** `#2196F3` blue

**Results table:**
| Column | Format |
|---|---|
| Cable ID | String |
| Tension (kN) | `.toFixed(2)` |
| Sag Ratio | `.toFixed(4)` |
| Length (m) | `.toFixed(3)` |
| Status | `taut` (green) / `slack` (red) |

**Convergence info:**
- Converged: ✓ green `#4caf50`
- Not converged: ⚠️ orange `#ff9800`
- Shows iteration count

### D.3 P-Delta Analysis Panel

**State:** `{ maxIterations: 10, tolerance: 1e-6, damping: 0.5, analyzing: false, results: null, error: '' }`

**Run button:** `#FF5722` deep orange

**Results:**
- Convergence status bar: green `#1b5e20` (converged) / orange `#e65100` (not converged)
- Maximum displacements grid (3 cards): DX, DY, DZ in mm, `fontSize: '20px'`, `color: '#4fc3f7'`
- Amplification factor: `color: '#ff9800'`, warning if > 1.4, OK if ≤ 1.4
- Comparison: First-Order vs Second-Order (4 bullet points)

### D.4 Modal Analysis Panel

**Dialog:** `max-w-4xl max-h-[80vh]`

**Controls bar:**
- Use API checkbox
- Number of Modes select: 3, 6, 10, 20
- Run button: `bg-indigo-600 hover:bg-indigo-500 text-white`
- Model info: `{nodes.size} nodes, {members.size} members`

**Results table columns:** Mode, Frequency (Hz), Period (s), Participation X, Participation Y, Description

**Mode number badge:** `w-6 h-6 rounded-full bg-indigo-600` + white number  
**Frequency:** `font-mono text-cyan-400` `.toFixed(3)`  
**Period:** `font-mono text-emerald-400` `.toFixed(4)`

**Mode descriptions:**
| Mode | Description |
|---|---|
| 1 | "1st Translational (Sway)" |
| 2 | "2nd Translational" |
| 3 | "1st Torsional" |
| 4 | "2nd Bending" |
| 5 | "Higher Mode" |
| 6+ | "Mode {n}" |

### D.5 Seismic Analysis Panel

**Header gradient:** `from-red-500 to-orange-500`

**Parameters (5 selects):**
| Select | Options |
|---|---|
| Seismic Zone | Zone II (Low), III (Moderate), IV (Severe), V (Very Severe) |
| Soil Type | Type I (Rock), II (Medium), III (Soft) |
| Importance | Ordinary (I=1.0), Important (I=1.2), Essential (I=1.5) |
| Response Reduction | SMRF (R=5.0), OMRF (R=3.0), Braced Frame (R=4.0), Shear Wall (R=4.0) |
| Combination Method | CQC, SRSS, ABS |

**Run button:** `from-red-600 to-orange-600` gradient

**Results (3 cards):**
- Max Base Shear: `text-red-400`, `{value.toFixed(1)} kN`
- Code Base Shear: `text-orange-400`
- Max Displacement: `text-amber-400`, `{value.toFixed(4)} m`

**Table columns:** Mode, Period (s), Sa/g, Base Shear (kN)

### D.6 Time-History Panel

**Header gradient:** `from-blue-500 to-cyan-500`

**Parameters (4 inputs):**
| Input | Type | Default |
|---|---|---|
| Integration Method | Select: Newmark-Beta, Wilson-Theta, Central Difference | `newmark` |
| Time Step (s) | Number, step 0.01, min 0.001 | 0.1 |
| Damping Alpha | Number, step 0.01 | 0.1 |
| Damping Beta | Number, step 0.001 | 0.01 |

**Results (3 cards):**
- Max Displacement: `text-blue-400`, `{value.toFixed(4)} m`
- Max Velocity: `text-cyan-400`, `{value.toFixed(4)} m/s`
- Max Acceleration: `text-emerald-400`, `{value.toFixed(4)} m/s²`

**Time step table:** Shows first 10 of N steps, truncation notice if > 10

### D.7 PINN Panel (AI Physics Engine)

**Header:** `Brain` icon (white) on `bg-gradient-to-br from-purple-600 to-indigo-600`

**Configuration:**
- Length (m): number input, default 10
- Load (N/m): number input, default 10000
- Training Epochs: range slider 500–5000, step 500, default 2000
  - Tick labels: "Fast (500)" — "{current}" (purple-400) — "Accurate (5000)"

**Start button:** `bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20`
- Loading: "Toaching Physics... {progress}%" (note: typo in source)
- Normal: "Start AI Training"

**Results:**
- Success banner: `bg-green-500/10 border-green-500/20`
- Prediction cards (2-col):
  - Max Deflection: `font-mono text-purple-400 text-sm`, `{(value * 1000).toFixed(2)} mm`
  - Inference Time: `font-mono text-blue-400 text-sm`, `{value.toFixed(3)} ms`
- Footnote: italic, "* This result was predicted by a 3-layer neural network, not FEM."

---

## Appendix E — Design Dialogs Deep Spec

### E.1 Shared Dialog Pattern

All "Enhanced" design dialogs share:

**Footer pattern:**
```
Classes: flex items-center justify-between px-6 py-4
         border-t border-slate-200 dark:border-slate-800
         bg-slate-50 dark:bg-slate-900/50
```
Left: Reset button (outline, `RotateCcw` icon)  
Right: Export button (outline, conditional) + Design button (gradient)

**Design button gradient:** `from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500`  
**Loading state:** Spinner icon + "Calculating..."  
**Normal state:** `Calculator` icon + "Design {Element}"  
**Shadow:** `shadow-lg shadow-blue-500/25`

### E.2 Validation Rules (Beam)

| Field | Min | Max | Error Text |
|---|---|---|---|
| Width | 200mm | 600mm | "Minimum width is 200mm" / "Maximum width is 600mm" |
| Depth | 300mm | 1500mm | "Minimum depth is 300mm" / "Maximum depth is 1500mm" |
| Cover | 25mm | — | "Minimum cover is 25mm" |
| Ultimate Moment | > 0 | — | "Moment must be positive" |
| Ultimate Shear | > 0 | — | "Shear must be positive" |
| Span | 1000mm | — | "Minimum span is 1000mm" |

### E.3 Slenderness Limits by Code (Column)

| Code | Name | Slenderness Limit |
|---|---|---|
| IS 456 | IS 456:2000 | 12 |
| ACI 318 | ACI 318-19 | 22 |
| EN 1992 | Eurocode 2 | 25 |
| AS 3600 | AS 3600:2018 | 25 |

### E.4 Deflection Factors by Code (Slab)

| Code | Deflection Factor |
|---|---|
| IS 456 | 20 |
| ACI 318 | 20 |
| EN 1992 | 18 |
| AS 3600 | 16.7 |

### E.5 Two-Way Slab Coefficients

Full table for `interior`, `oneEdge`, `twoEdges`, `simplySS` with aspect ratios 1.0–2.0 and αX/αY values.

---

## Appendix F — Results & Post-Processing Deep Spec

> **Scope:** 19 component files, ~11,000 lines of results UI code. This appendix covers every panel, dialog, overlay, table, chart, and 3D renderer in the results system.

---

### F.1 Results Toolbar — `ResultsToolbar.tsx` (1685 lines)

**Purpose:** Floating toolbar that appears post-analysis. Serves as command center for all results visualization.

#### F.1.1 Collapsed State

**Container:** `fixed bottom-4 right-4 z-40 flex items-center gap-2`

| Button | Classes | Icon | Purpose |
|---|---|---|---|
| Back | `px-3 py-2 bg-white dark:bg-slate-900 text-blue-300 rounded-lg shadow-lg hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700` | `ArrowLeft` | Return to modeling |
| Expand | `px-4 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg shadow-lg hover:bg-slate-200 dark:hover:bg-slate-800` | `Maximize2` | Open full toolbar |
| Close | `p-2 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-lg shadow-lg hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700` | `X` | Exit results mode |

#### F.1.2 Expanded State

**Root:** `fixed bottom-4 right-4 z-40 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden`

**Header Bar:**
- Background: `bg-gradient-to-r from-blue-600 to-purple-600 text-white`
- Title: "Results" + version badge `text-[9px] bg-white/20 rounded px-1.5 py-0.5 font-mono`
- Minimize/Close buttons: `p-1 rounded hover:bg-white/20`

**Back to Model Button:**
```
w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-300
hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800
border-b border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500
```

#### F.1.3 Diagram Toggle Grid

**Container:** `px-4 py-3 border-b border-slate-200 dark:border-slate-800`
**Label:** `text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider`
**Grid:** `grid grid-cols-6 gap-1`

| ID | Label | Icon | Color |
|---|---|---|---|
| `deflection` | Deflected | `TrendingDown` | `text-blue-500` |
| `bmd` | BMD (Mz) | `BarChart2` | `text-green-500` |
| `sfd` | SFD (Vy) | `Activity` | `text-orange-500` |
| `bmd_my` | BMD (My) | `BarChart3` | `text-teal-500` |
| `sfd_vz` | SFD (Vz) | `Waves` | `text-cyan-500` |
| `reactions` | Reactions | `ArrowDownToLine` | `text-purple-500` |
| `axial` | Axial | `SlidersHorizontal` | `text-red-500` |
| `heatmap` | Heat Map | `Flame` | `text-yellow-500` |

**Each toggle button:**
- Active: `bg-slate-100 dark:bg-blue-500 dark:text-white dark:ring-2 dark:ring-blue-400`
- Inactive: `hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-400`
- Icon: `w-4 h-4`, Label: `text-[9px]`

#### F.1.4 Scale Slider Section

**Container:** `px-4 py-3 border-b border-slate-200 dark:border-slate-800`
**Range input:** `w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600`
- Min: 1, Max: 200
**Tick labels:** `text-[10px] text-slate-500 dark:text-slate-400`

#### F.1.5 Animation Controls

| Button | Classes |
|---|---|
| Play | `bg-blue-100 dark:bg-blue-900/30 text-blue-600` — `Play` icon |
| Stop | `bg-red-100 dark:bg-red-900/30 text-red-600` — `Pause` icon |
| Reset | `p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700` — `RotateCcw` icon |

#### F.1.6 Quick Stats

**Grid:** `grid grid-cols-2 gap-2`

| Card | Background | Label Color | Value Color |
|---|---|---|---|
| Displacement | `bg-blue-50 dark:bg-blue-900/20` | `text-blue-600 dark:text-blue-400 text-[10px]` | `text-blue-700 dark:text-blue-300 text-sm font-bold` |
| Reaction | `bg-purple-50 dark:bg-purple-900/20` | `text-purple-600 dark:text-purple-400` | `text-purple-700 dark:text-purple-300` |

#### F.1.7 Heat Map Type Selector (conditional)

Appears when `heatmap` toggle is active.
**Container:** `mt-3 pt-3 border-t border-slate-200 dark:border-slate-700`
**Type buttons:** `flex-1 px-2 py-1.5 text-[10px] font-medium rounded`
**Active gets gradient background per type.**
**Color scale legend bar:** `flex-1 h-2 rounded bg-gradient-to-r` with specific color stops per type.

#### F.1.8 Support Reactions Table (conditional)

Appears when `reactions` toggle is active.
**Container:** `px-4 py-3 border-b border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto scroll-smooth`
**Each card:** `p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg`
**Values:** `font-mono text-slate-900 dark:text-white`, labels `text-slate-500 dark:text-slate-400 text-[9px]`

#### F.1.9 Export Section

| Button | Classes |
|---|---|
| Export PDF | `bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 shadow-lg text-sm font-medium` |
| Export CSV | `bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium` |

#### F.1.10 Next Steps Links

| Action | Classes |
|---|---|
| Member Diagrams | `bg-gradient-to-r from-orange-500 to-red-500` |
| Dashboard | `bg-gradient-to-r from-indigo-500 to-purple-600` |
| Advanced | `bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300` |
| Design Code | `bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300` |
| Post-Processing | `bg-gradient-to-r from-emerald-500 to-teal-600` |
| Design Hub | `bg-gradient-to-r from-blue-600 to-indigo-600` |

#### F.1.11 Modals Launched

| Modal | Dialog Size | Content |
|---|---|---|
| Dashboard | `max-w-[1800px] w-[95vw] h-[90vh] p-0` | `AnalysisResultsDashboard` |
| Member Detail | `max-w-[900px] w-[90vw] h-[85vh] p-0` | `MemberDetailPanel` |
| Design Studio | Inline render | `PostProcessingDesignStudio` |

---

### F.2 Results Table Dock — `ResultsTableDock.tsx` (642 lines)

**Purpose:** Bottom-docked panel showing tabular analysis results.

#### F.2.1 States

**Collapsed (default):**
- Height: `h-7`
- Bar: `flex items-center justify-between px-3 bg-slate-900 border-t border-slate-700`
- Shows: node/member count chips + equilibrium status badge
- Click/drag-up → expanded

**Expanded:**
- Default height: `h-[240px]`
- Maximized height: `h-[60vh]`
- Animation: `animate-[slideInUp_200ms_ease-out]`

#### F.2.2 Tab Bar

3 tabs with colored ID indicators:

| Tab | ID Color | Columns |
|---|---|---|
| Displacements | `cyan-400` | Node, δx, δy, δz (m), θx, θy, θz (rad) |
| Member Forces | `blue-400` | Member, Fx, Fy, Fz (kN), Mx, My, Mz (kN·m) |
| Reactions | `amber-400` | Node, Rx, Ry, Rz (kN), MRx, MRy, MRz (kN·m) |

**Tab button active:** Blue-600 underline + white text
**Tab button inactive:** `text-slate-400 hover:text-white`

#### F.2.3 Table Styling

**Header:** `sticky top-0 bg-slate-800 z-10`
**Sort header:** `SortHeader` component with `ArrowUpDown` icon (`w-3 h-3`)
**Filter input:** `w-24` text field for ID search
**Cell font:** `font-mono text-xs`

**Heat-map cell coloring:**
- > 0.8 of max → `text-red-400`
- > 0.5 of max → `text-orange-400`
- > 0.2 of max → `text-yellow-400`
- ≤ 0.2 of max → default `text-slate-300`

**Summary footer rows (sticky tfoot):**
| Tab | Label | Color |
|---|---|---|
| Reactions | `ΣR` | `text-emerald-400` |
| Member Forces | `Max` | `text-red-400` |
| Displacements | `Max` | `text-orange-400` |

#### F.2.4 Action Buttons

| Button | Icon | Behavior |
|---|---|---|
| Export CSV | `Download` | Per-tab CSV export |
| Print | `Printer` | — |
| Maximize/Minimize | `Maximize2`/`Minimize2` | Toggle `h-[60vh]` |
| Collapse | `ChevronDown` | Return to `h-7` bar |
| Close | `X` | `hover:text-red-400` |

**Row click:** `useModelStore.getState().selectNode(r.id)` — selects corresponding node in 3D viewport.

---

### F.3 Results Control Panel — `ResultsControlPanel.tsx` (796 lines)

**Purpose:** STAAD-like sidebar for results visualization settings.

#### F.3.1 Header
- Icon: `Sliders` + "Results Display" title
- Status badge: `analyzed` (green-400 dot) or `no-results` (slate-500)

#### F.3.2 Sub-components

**ScaleSlider:** Range input with `ZoomIn`/`ZoomOut` icon buttons.
**ToggleButton:** Cyan active style (`bg-cyan-600/20 text-cyan-400 border-cyan-500/30`).
**SummaryCard:** `p-3 rounded-lg border` with ok/warning/error status icon + value display.
**CollapsibleSection:** Expandable section with `ChevronRight`/`ChevronDown` toggle.

#### F.3.3 Diagram Types — 3-col Grid

8 types in `grid grid-cols-3 gap-2`:

| Type | Color | Label |
|---|---|---|
| `none` | — | Off |
| `SFD` | `#00aaff` | SFD |
| `BMD` | `#ff8800` | BMD |
| `AFD` | `#00ff00` | AFD |
| `TORSION` | `#ff00ff` | Torsion |
| `DEFLECTION` | `#ffff00` | Deflection |
| `BMD_MY` | `#00cccc` | My |
| `SFD_VZ` | `#0088cc` | Vz |

#### F.3.4 Five Collapsible Sections

| # | Section | Default | Contents |
|---|---|---|---|
| 1 | Summary | Open | 2×2 SummaryCards (Max Displacement mm, Max Shear kN, Max Moment kNm + utilization status, Max Axial kN) |
| 2 | Force Diagrams | Open | 3-col diagram type grid, scale slider (0.001–0.2), deflection magnification (1–200×), display toggles (Labels, Critical Pts, Fill, Baseline) |
| 3 | Color Scheme | Closed | 4 radio options: Standard, Stress Gradient, Utilization, Force Intensity |
| 4 | Animation | Closed | Animate Deflection toggle (custom `w-12 h-6` switch), speed slider (0.1–3×) |
| 5 | View Options | Closed | Show original shape checkbox, Quick Views: Quad View / Full 3D / Isometric buttons |
| 6 | Model Info | Closed | Nodes / Members / DOFs / Analysis Status |

#### F.3.5 DisplaySettings Interface

```typescript
{
  showDiagram: DiagramType,
  diagramScale: number,        // default 0.05
  showLabels: boolean,
  showCriticalPoints: boolean,
  showFill: boolean,
  showBaseline: boolean,
  colorMode: 'standard'|'gradient'|'utilization'|'intensity',
  deflectedShapeScale: number, // default 50
  showOriginalShape: boolean,
  animateDeflection: boolean,
  animationSpeed: number       // default 1.0
}
```

#### F.3.6 Footer

**Reset button:** `RefreshCw` icon + "Reset Display Settings"

---

### F.4 Analysis Results Dashboard — `AnalysisResultsDashboard.tsx` (4076 lines)

**Purpose:** THE MAIN COMPREHENSIVE RESULTS HUB — largest single component in the app.

**Container:** `rounded-xl border overflow-hidden h-full flex flex-col`
**Launched in:** Dialog `max-w-[1800px] w-[95vw] h-[90vh]`

#### F.4.1 Header Bar

- Status icon: `CheckCircle` (emerald) / `AlertTriangle` (amber) / `XCircle` (red)
- Title: "Analysis Results"
- Metrics: `{nodes} nodes · {members} members · {dof} DOF`, analysis time
- Legend toggle button
- Export PDF button (blue gradient)
- Close button (`X`)

#### F.4.2 Tab Bar — 8 View Modes

| Tab | Icon | Label |
|---|---|---|
| Overview | `Grid3X3` | Overview |
| Force Diagrams | `BarChart2` | Diagrams |
| Heat Map | `Flame` | Heat Map |
| Reactions | `ArrowDown` | Reactions |
| D/C Summary | `ArrowUpDown` | D/C Ratio |
| Stability | `Activity` | Stability |
| Load Combos | `Layers` | Load Combos |
| Detailed | `FileText` | Detailed |

**Tab styling:**
- Active: `bg-white text-black border-white`
- Inactive: `border-slate-700 text-slate-400 hover:text-white`

#### F.4.3 Overview Tab

**Summary Cards:** `grid-cols-5` top row:
| Card | Value | Color |
|---|---|---|
| Max Displacement | mm | `text-blue-400` |
| Max Stress | MPa | `text-red-400` |
| Max Utilization | % | `text-amber-400` |
| Total Members | count | `text-cyan-400` |
| Analysis Time | ms | `text-emerald-400` |

**Quick Action Buttons:** row of action shortcuts

**Member Overview Grid:** `grid-cols-3`, paginated 16/page with Prev/Next + page counter

**MemberDiagramMini** (Canvas-based):
- Canvas: 280×90px
- High-DPI: `canvas.width = rect.width * devicePixelRatio`
- Background: `transparent`
- Grid: subtle gray lines
- Gradient fill for +/- values (positive green, negative red)
- Peak annotations: font-mono value labels
- X-axis position labels in meters

**ExpandedDiagram** (on member click):
- 2×2 grid of chart canvases: SFD, BMD, AFD, DEFLECTION
- 5th canvas: weak-axis (if data exists)
- Interactive crosshair tooltips on canvas mouse move (6 canvas refs + 6 overlay refs)

**Node Displacement Table:** Top 8 most displaced nodes, columns: Node ID, dx, dy, dz, total

**Structure Statistics:** 4-col grid (total weight, node count, member count, analysis status)

**Equilibrium Verification:** 6-col grid for Fx/Fy/Fz/Mx/My/Mz
- Each column: Applied load, Reaction, Residual
- Condition number warning banner if high

**Serviceability Checks Table:** Sorted by worst ratio
- Columns: Member, Deflection, L/240 Limit, L/360 Limit, Status

#### F.4.4 Diagrams Tab

- 4 diagram type buttons (SFD, BMD, AFD, DEFLECTION)
- Member search input: `w-56`
- Filtered members in `grid-cols-3` with `MemberDiagramMini`

**Diagram colors:**
| Type | Hex |
|---|---|
| SFD | `#f97316` |
| BMD | `#22c55e` |
| AFD | `#ef4444` |
| DEFLECTION | `#3b82f6` |
| BMD_MY | `#14b8a6` |
| SFD_VZ | `#0891b2` |

#### F.4.5 Reactions Tab

**ReactionDisplay component:**
- Auto-detects 2D vs 3D from presence of Fz/Mx/My
- Reaction totals row (equilibrium check)
- Per-node reaction cards in `grid-cols-2`
- Each card: Node ID, Forces subgroup (Fx, Fy, Fz), Moments subgroup (Mx, My, Mz)
- Support displacement/settlement check table

#### F.4.6 Stability Tab

**Euler Buckling Check Table:**
| Column | Description |
|---|---|
| Member | ID |
| Pcr | π²EI/L² |
| Slenderness λ | L/r |
| P/Pcr | Demand/capacity ratio |
| Status | SAFE (green) / BUCKLE (red) |

**P-M Interaction Diagram (SVG 320×240):**
- Parabolic envelope curve
- Linear AISC H1-1a line
- Demand points colored by interaction ratio
- Axes: P/Py (vertical), M/Mp (horizontal)

**Natural Frequency Estimates:**
- Beam formula: $f_1 = \frac{\pi}{2L^2}\sqrt{\frac{EI}{\rho A}}$
- Rayleigh approximation
- Building period: $T \approx 0.1N$ (N = number of stories)

**Design Response Spectrum (SVG 400×200):**
| Code | Parameters |
|---|---|
| IS 1893 | Zone IV, Soil Type II |
| ASCE 7-22 | S_DS=1.0, S_D1=0.5 |
| EC8 | Type 1, a_g=0.25g, Soil B |

Three colored curves plotted on Period (s) vs Sa/g axes.

#### F.4.7 Load Combinations Tab

**Code tables:**
| Code System | Standards |
|---|---|
| Indian | IS 875 / IS 456 |
| American | ASCE 7-22 / ACI 318 |
| European | Eurocode EN 1990 |

**Combo type badges:**
- Strength: red
- Service: green
- Seismic: purple

**Factor summary:** 3-col grid showing typical DL/LL/WL/EQ factors per combo type

#### F.4.8 D/C Ratio Tab

**Status Count Cards (4):**
| Status | Threshold | Color |
|---|---|---|
| Safe | ≤ 70% | emerald |
| Warning | 70–90% | amber |
| Critical | 90–100% | orange |
| Failed | > 100% | red |

**D/C Ratio Table:**
- Columns: Member, D/C Ratio (with utilization bar), Governing Check (Bending/Shear/Axial), Status badge

**Deflection Limit Checks:**
| Limit | Code | Ratio |
|---|---|---|
| Floor | ASCE 7 / IS 800 | L/240 |
| Roof | General | L/180 |
| Cantilever | General | L/120 |
| Sensitive | ACI 318 / IS 456 | L/360 |

**Inter-Story Drift Check:**
- Groups nodes by Y-coordinate (±0.1m tolerance)
- IS 1893 limit: H/400
- ASCE 7 limit: H/500

#### F.4.9 Heat Map Tab

**SVG Structural Layout:**
- Auto-projected 2D from 3D node coordinates
- Member lines: thickness proportional to utilization (1–6px)
- Utilization coloring: continuous gradient
- Support triangles at restrained nodes
- Node circles at intersections

**Utilization Color Gradient:**
```
0.0 → cyan (#06b6d4)
0.3 → green (#22c55e)
0.5 → yellow (#eab308)
0.7 → orange (#f97316)
1.0 → red (#ef4444)
```

**Section-Type Group Summary:** 3-col grid
**Utilization Bar List:** Sorted descending, each with label + horizontal bar

#### F.4.10 Detailed Tab

**DetailedMemberTable** (virtualized with `@tanstack/react-virtual`):
- `estimateSize`: 36px per row
- `overscan`: 8 rows
- `MAX_VISIBLE_HEIGHT`: 480px

**12 Sortable Columns:**
| Column | Unit | Align |
|---|---|---|
| ID | — | left |
| Section | — | left |
| Length | m | right |
| Vy | kN | right |
| Vz | kN | right |
| Mz | kN·m | right |
| My | kN·m | right |
| Axial | kN | right |
| Torsion | kN·m | right |
| Deflection | mm | right |
| Stress | MPa | right |
| D/C | ratio | right |

#### F.4.11 Footer Bar

| Button | Icon | Action |
|---|---|---|
| Export CSV | `FileDown` | Download CSV |
| Export JSON | `FileJson` | Download JSON |
| Print Report | `Printer` | Print dialog |
| Share | `Share2` | Copy link |

---

### F.5 Results Visualization — `ResultsVisualization.tsx` (829 lines)

**Purpose:** Standalone results page with multiple view modes. Uses framer-motion throughout.

#### F.5.1 View Modes (4 Tabs)

| Tab | Icon | Label |
|---|---|---|
| Summary | 📊 | Summary |
| Diagrams | 📈 | Diagrams |
| Tables | 📋 | Tables |
| Modes | 🎵 | Modal |

#### F.5.2 SummaryCard Component

- `motion.div` with `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}`
- Colored icon background circle
- Critical badge: `animate-pulse bg-red-500 text-white text-xs px-1.5 rounded-full`
- Value: `text-2xl font-bold font-mono`

#### F.5.3 Summary View

**Stability Check Banner:**
- Stable: green bg + `CheckCircle` + "Structure is stable"
- Unstable: red bg + `AlertTriangle` + "Instability detected"

**6 SummaryCards** in 2×3 grid:
| Card | Color | Critical Flag |
|---|---|---|
| Max Displacement | blue | No |
| Max Moment | orange | No |
| Max Shear | purple | No |
| Max Axial | red | No |
| Max Reaction | green | No |
| Max Utilization | amber | Yes if > 0.9 |

**Structure Summary:** Weight (kg), Members, Nodes, Load Cases

#### F.5.4 Diagram View

**5 type buttons:** BMD 📐, SFD ✂️, Axial ↕️, Deflection 〰️, Utilization 📊

**DiagramCanvas (SVG viewBox 600×400):**
- Grid pattern fill
- Structure outline
- Animated path: `motion.path` with `pathLength: 0→1` transition
- Filled area for BMD polygon
- Utilization color bars per segment
- Support triangles
- Max value annotation arrow + label
- Auto legend

#### F.5.5 Tables View

4 `ResultsTable` instances:
- Displacements (Node, dx, dy, dz, total)
- Reactions (Node, Fx, Fy, Fz, Mx, My, Mz)
- Member Forces (Member, Axial, ShearY, ShearZ, MomentZ, MomentY, Torsion)
- Stresses & Utilization (Member, Stress, Utilization, Status)

**ResultsTable features:**
- Sortable columns with arrow indicators
- Filter input
- Row count footer
- Highlighted max values (bold + colored)

#### F.5.6 Modal Results View

**Mode Cards (3):**
- Frequency in Hz (large)
- Period in seconds
- Mass participation bars: X-direction (blue), Y-direction (green)
- Participation bar height proportional to percentage

**Full Modal Table:**
| Column |
|---|
| Mode |
| Frequency (Hz) |
| Period (s) |
| Mass Part. X (%) |
| Mass Part. Y (%) |
| Cumulative X (%) |
| Cumulative Y (%) |

#### F.5.7 Export Bar

Segmented button group: PDF / Excel / JSON

#### F.5.8 Utilization Color Scale

```
< 0.5 → green (#22c55e)
< 0.7 → yellow (#eab308)
< 0.9 → orange (#f97316)
≥ 0.9 → red (#ef4444)
```

---

### F.6 Member Detail Panel — `MemberDetailPanel.tsx` (528 lines)

**Purpose:** Complete member analysis view in a dialog.

#### F.6.1 Header

- Navigation: `ChevronLeft` / `ChevronRight` (Prev/Next member)
- Member info: ID + section name + length
- Design code selector: `IS800` | `IS456` | `EC3` | `AISC360`
- Download button, Close button

#### F.6.2 Design Status Banner

Full-width colored banner:
- PASS: green bg + `CheckCircle` icon
- FAIL: red bg + `AlertTriangle` icon
- Shows overall utilization percentage

#### F.6.3 Diagram Type Selector

4 buttons in a row: ALL / SFD / BMD / AFD
- Active: `bg-blue-600 text-white`
- Inactive: `bg-slate-700 text-slate-400`

#### F.6.4 Force Summary Grid

6-column grid of force cards:

| Card | Value | Color |
|---|---|---|
| Axial | kN | green (tension) / red (compression) |
| Shear Y | kN | blue |
| Shear Z | kN | blue |
| Moment Y | kN·m | purple |
| Moment Z | kN·m | purple |
| Torsion | kN·m | orange |

All values: `font-mono text-xl font-bold`

#### F.6.5 Force Diagrams

Integrates `ForceDiagramRenderer` with config:
```typescript
{ showShear: true, showMoment: true, showAxial: true, colorScheme: 'engineering' }
```

#### F.6.6 Section Cut Query

**Container:** Gradient panel `bg-gradient-to-r from-blue-900/30 to-purple-900/30`
**Position slider:** Range 0–1, step 0.01
**Display:** Position in meters + percentage

**8 Interpolated Values** in 4×2 grid:
| Value | Unit |
|---|---|
| Shear Y | kN |
| Shear Z | kN |
| Moment Y | kN·m |
| Moment Z | kN·m |
| Axial | kN |
| Torsion | kN·m |
| Deflection Y | mm |
| Deflection Z | mm |

#### F.6.7 Design Checks

Collapsible section with per-check cards:
- Left border: 3px colored (green PASS / red FAIL / amber WARNING)
- Check name + status badge
- Utilization bar: `w-24 h-2 rounded-full`
  - ≤0.6: `bg-emerald-500`
  - ≤0.8: `bg-lime-500`
  - ≤0.9: `bg-amber-500`
  - ≤1.0: `bg-orange-500`
  - >1.0: `bg-red-500`
- Formula display: `font-mono text-xs`
- Description text

#### F.6.8 Reinforcement Design (concrete members)

2-col layout:
| Column | Contents |
|---|---|
| Main Bars | Count × Ø diameter, area (mm²), ratio (%) |
| Stirrups | Ø diameter @ spacing mm, N-legged |

#### F.6.9 Recommendations

Blue info box: `bg-blue-900/15 border-blue-500/30`
- Header: "Recommendations" in `text-blue-400 uppercase`
- Bullet list with blue dot markers

---

### F.7 Results Table Panel — `ResultsTablePanel.tsx` (894 lines)

**Purpose:** Standalone comprehensive table view for all analysis data.

#### F.7.1 Container

`bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden`

#### F.7.2 Header

- `Table` icon (size 18)
- Title: `font-semibold text-slate-700 dark:text-slate-200`
- Search input: `pl-8 pr-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-md w-32` with `Search` icon (size 14) absolutely positioned
- Copy button: `p-1.5 text-slate-500 hover:text-slate-700` — copied state shows `"✓ Copied!"` in `text-green-500`
- Export button (disabled): `p-1.5 text-slate-400 cursor-not-allowed`

#### F.7.3 Tab System

3 tabs: `nodes`, `members`, `reactions`

**Tab indicators:**
| Tab | Indicator |
|---|---|
| Nodes | `w-2 h-2 rounded-full bg-cyan-400` |
| Members | `w-4 h-0.5 bg-amber-400 rounded` |
| Reactions | `w-2 h-2 bg-green-400 rotate-45` |

**Active tab:** `text-cyan-400 border-b-2 border-cyan-400 bg-slate-100/30 dark:bg-slate-800/30`
**Inactive tab:** `text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50`

#### F.7.4 Table Styling

**Header row:** `bg-slate-100 dark:bg-slate-800`
**Sort indicators:** `ArrowUp`/`ArrowDown` (size 12) or `ArrowUpDown` (size 12, opacity 30)
**Alternating rows:** odd `bg-slate-100/30 dark:bg-slate-800/30`, even `bg-slate-100/50 dark:bg-slate-800/50`
**Hover:** `hover:bg-slate-200/50 dark:hover:bg-slate-700/50`
**Max value row:** `bg-red-900/30`
**Over-utilized:** `bg-red-900/30`, Warning: `bg-amber-900/20`

**Cell Colors:**
| Data | Color |
|---|---|
| Displacements (dx,dy,dz) | `text-cyan-400` |
| Rotations (rx,ry,rz) | `text-amber-400` |
| Total displacement | `text-emerald-400` (or `text-red-400` if max) |
| Axial (compression) | `text-blue-400` |
| Axial (tension) | `text-red-400` |
| Shear | `text-cyan-400` / `text-cyan-300` (max) |
| Moment | `text-amber-400` / `text-amber-300` (max) |
| Torsion | `text-purple-400` |
| Utilization OK | `text-emerald-400` |
| Utilization warning | `text-amber-400` |
| Utilization fail | `text-red-400` |
| Reaction Fx | `text-red-400` |
| Reaction Fy | `text-green-400` |
| Reaction Fz | `text-blue-400` |
| Reaction Moments | `text-amber-400` |
| Reaction Total | `text-emerald-400` |

**Overflow:** `max-h-[400px]` with `sticky top-0` headers
**Footer:** `px-4 py-2 border-t text-xs text-slate-500 dark:text-slate-400` — shows row count

---

### F.8 Results Split View — `ResultsSplitView.tsx` (259 lines)

**Purpose:** Full-screen split-pane layout for results with resizable panels.

#### F.8.1 Root Layout

`fixed inset-0 z-50 bg-white dark:bg-slate-950` (with `p-4` when not fullscreen)

#### F.8.2 Header Bar (h-12)

`bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4`
- Title: `text-lg font-semibold text-slate-900 dark:text-white`
- Status pill: `w-2 h-2 rounded-full bg-emerald-400` + `text-sm text-slate-500`
- Action buttons: `p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded`
- Close button: `hover:text-white hover:bg-red-800`
- Separator: `w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1`

#### F.8.3 Panels

| Panel | Default Size | Range | Position |
|---|---|---|---|
| Left | 400px wide | 280–600px | `border-r` |
| Bottom | 280px tall | 150–450px | `border-t` |

**Resize handles:**
- Vertical: `w-1 bg-slate-200 dark:bg-slate-700 hover:bg-cyan-500 cursor-col-resize`
- Horizontal: `h-1 bg-slate-200 dark:bg-slate-700 hover:bg-cyan-500 cursor-row-resize`

#### F.8.4 DockableResultsPanel

- Horizontal: default `h-80`, collapsed `h-10`
- Vertical: default `w-96`, collapsed `w-10`
- Collapse button: `absolute top-2 right-2 z-10 p-1 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700`
- Transition: `transition-all duration-300`
- Icons: `PanelLeftClose`/`PanelLeftOpen`, `PanelBottomClose`/`PanelBottomOpen` (size 14)

---

### F.9 Enhanced Diagram Viewer — `EnhancedDiagramViewer.tsx` (885 lines)

**Purpose:** Full-featured force diagram viewer with Canvas 2D rendering.

#### F.9.1 Container

`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden`
Fullscreen mode: `fixed inset-4 z-50`

#### F.9.2 Header

`flex items-center justify-between px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800`
- Title: `font-semibold text-slate-900 dark:text-white` with member span in `text-slate-500 text-sm`
- Action icons: `p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700` — `ZoomIn`, `ZoomOut`, `Maximize2`, `Download`, `Copy`

#### F.9.3 Diagram Type Tabs (framer-motion)

`<motion.button>` with `whileHover={{ scale: 1.02 }}`, `whileTap={{ scale: 0.98 }}`

| Type | Stroke | Positive | Negative | Fill |
|---|---|---|---|---|
| SFD | `#ef4444` | `#ef4444` | `#3b82f6` | `rgba(239,68,68,0.2)` |
| BMD | `#22c55e` | `#22c55e` | `#8b5cf6` | `rgba(34,197,94,0.2)` |
| AFD | `#f97316` | `#f97316` | `#06b6d4` | `rgba(249,115,22,0.2)` |
| DEFLECTION | `#6366f1` | `#6366f1` | `#ec4899` | `rgba(99,102,241,0.2)` |

**Active tab:** `border-transparent text-slate-900 dark:text-white shadow-lg` + gradient bg
**Inactive tab:** `border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900`

#### F.9.4 Canvas Rendering

**Padding:** `{ top: 60, right: 80, bottom: 80, left: 80 }`
**Grid lines:** `rgba(255,255,255,0.1)`, lineWidth 1
**Baseline (y=0):** `rgba(255,255,255,0.5)`, lineWidth 2, dashed `[5,5]`
**Member axis:** `#fff`, lineWidth 4
**Pin support:** white filled triangle
**Roller support:** white filled circle, radius 8
**Diagram line:** lineWidth 3, `lineCap=round`, `lineJoin=round`
**Critical points:** filled circles, radius 6
**Scanner:** dashed vertical line `[4,4]`, white point radius 8
**Tooltip:** rounded rect (`radius=8`), bg `rgba(0,0,0,0.8)`, stroke `colors.stroke`, lineWidth 2
**Fonts:** `'bold 12px Inter, sans-serif'`, `'bold 14px Inter, sans-serif'`, `'11px Inter, sans-serif'`
**Cursor:** `cursor-crosshair`

#### F.9.5 Stats Bar

`flex items-center gap-6 px-4 py-2 bg-slate-100/30 dark:bg-slate-800/30 border-b`
Values: `font-mono font-bold` with inline colors by sign

#### F.9.6 Section Values Panel

**Idle:** `px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700` with `Crosshair` icon + "Hover over diagram"
**Active:** `motion.div` with `initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}`
- Position + value separated by divider `h-6 w-px bg-slate-200 dark:bg-slate-700`
- Value: `font-mono font-bold text-lg` with inline color

---

### F.10 Enhanced Heat Map — `EnhancedHeatMap.tsx` (634 lines)

**Purpose:** Interactive structural heat map with member cards and summary stats.

#### F.10.1 Container

`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden`

#### F.10.2 Header

Title icon: `Flame w-5 h-5 text-orange-500`
Sort button: `px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-200`

#### F.10.3 Heat Map Types

`'stress' | 'displacement' | 'utilization' | 'axial' | 'moment' | 'shear'`

**Active type button:** `bg-orange-500/20 border-orange-500/50 text-orange-400`

#### F.10.4 Color Scales

| Scale | Stops |
|---|---|
| STRESS | `#3b82f6` → `#22c55e` → `#eab308` → `#f97316` → `#ef4444` |
| DIVERGING | `#3b82f6` → `#ffffff` → `#ef4444` |
| SEQUENTIAL | `#1e3a5f` → `#3b82f6` → `#22c55e` → `#eab308` → `#ef4444` |

#### F.10.5 Color Legend

Gradient bar: `h-4 rounded-full overflow-hidden border w-[200px]`
Ticks: `flex justify-between text-xs font-mono`

#### F.10.6 MemberCard (framer-motion)

`motion.div` with `layout`, `initial={{ opacity:0, scale:0.9 }}`, `animate={{ opacity:1, scale:1 }}`, `whileHover={{ scale:1.02 }}`
- Container: `relative p-3 rounded-lg border cursor-pointer`
- Selected: `border-blue-500 bg-blue-500/10`
- Default: `border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50`
- Color bar: `absolute left-0 top-0 bottom-0 w-1 rounded-l-lg` with inline bg
- Circle badge: `w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold`

#### F.10.7 Summary Stats

`grid grid-cols-4 gap-4`:
| Stat | Color |
|---|---|
| Max | `text-red-400` |
| Min | `text-blue-400` |
| Average | `text-green-400` |
| Utilization | conditional: > threshold `text-red-400` else `text-green-400` |

**Member grid:** `p-4 max-h-[400px] overflow-y-auto` → `grid grid-cols-3 gap-3` with `<AnimatePresence mode="popLayout">`

#### F.10.8 Status Icons

| Utilization | Icon | Color |
|---|---|---|
| ≤ 0.7 | `CheckCircle w-4 h-4` | `text-green-500` |
| 0.7–0.9 | `AlertTriangle w-4 h-4` | `text-yellow-500` |
| 0.9–1.0 | `AlertTriangle w-4 h-4` | `text-orange-500` |
| > 1.0 | `XCircle w-4 h-4` | `text-red-500` |

---

### F.11 Animated Deflection — `AnimatedDeflection.tsx` (575 lines)

**Purpose:** 3D animated deflected shape renderer in R3F canvas.

#### F.11.1 Color Constants (THREE.Color)

| Name | Hex | Usage |
|---|---|---|
| `COLOR_MIN` | `#3b82f6` | Low displacement (blue) |
| `COLOR_MID` | `#22c55e` | Medium displacement (green) |
| `COLOR_HIGH` | `#ef4444` | High displacement (red) |
| `ORIGINAL_COLOR` | `#6b7280` | Ghost/reference shape (gray) |

#### F.11.2 AnimatedMemberLine

**Original shape:** `<Line>` drei — `color=#6b7280`, `lineWidth=1`, dashed (`dashSize=0.1`, `gapSize=0.05`, `opacity=0.5`)
**Animated line:** `lineBasicMaterial` with `vertexColors`, `linewidth=3`

#### F.11.3 AnimatedNode

- Geometry: `sphereGeometry args=[0.05, 16, 16]` (hovered: `0.08`)
- Material: `meshStandardMaterial` with emissive color (normal: `emissiveIntensity=0.2`, hovered: `0.5`)
- Label: `<Html>` overlay — `bg-black/80 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap`
- Value format: `{(magnitude * 1000).toFixed(2)} mm`

#### F.11.4 Animation

`useFrame` loop: `phase += delta * animationSpeed * Math.PI * 2`
Oscillation: `Math.sin(phase)` applied to displacement scale

#### F.11.5 DeflectionControls Panel

`bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur rounded-lg p-4 space-y-4`

| Control | Type | Range |
|---|---|---|
| Scale | Range input | 1–200 |
| Speed | Range input | 0.1–3.0 (step 0.1) |
| Show Original | Checkbox | boolean |
| Show Labels | Checkbox | boolean |

**Range input style:** `w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer`
**Value display:** `font-mono text-slate-600 dark:text-slate-300`
**Max displacement footer:** `text-xs text-slate-500`, value in `text-cyan-400 font-mono`

---

### F.12 Diagram Overlay — `DiagramOverlay.tsx` (608 lines)

**Purpose:** 3D force diagram overlay rendered in R3F scene.

#### F.12.1 Color System

| Token | Hex | Usage |
|---|---|---|
| `POSITIVE_COLOR` | `#3b82f6` | Sagging/positive |
| `NEGATIVE_COLOR` | `#ef4444` | Hogging/negative |
| `NEUTRAL_COLOR` | `#888888` | Zero crossing |
| `DIAGRAM_OPACITY` | 0.2 | Fill transparency |
| `SCANNER_LINE_COLOR` | `#ffffff` | Interactive scanner |
| `TOOLTIP_BG` | `rgba(0,0,0,0.85)` | Value tooltip |

#### F.12.2 Diagram Types

`'BMD' | 'SFD' | 'deflection' | 'ShearY' | 'ShearZ' | 'MomentY' | 'MomentZ' | 'Axial' | 'Torsion' | 'DeflectionY' | 'DeflectionZ'`

#### F.12.3 Sub-components

**ValueLabel:** `<Text>` drei — `fontSize=0.2`, `outlineWidth=0.02`, `outlineColor=#000000`, `anchorX="center"`, `anchorY="bottom"`

**CriticalPointMarker:** `<mesh>` + `sphereGeometry args=[0.08, 16, 16]` + `meshBasicMaterial`

**ScannerLine:** `<Line>` drei — `color=#ffffff`, `lineWidth=2`, dashed (`dashSize=0.1`, `gapSize=0.05`)

**Tooltip (Html):** `background: rgba(0,0,0,0.85)`, `color: white`, `padding: 8px 12px`, `borderRadius: 6px`, `fontSize: 12px`, `fontFamily: monospace`, `boxShadow: 0 4px 12px rgba(0,0,0,0.3)`, `border: 1px solid rgba(255,255,255,0.2)`

#### F.12.4 3D Mesh

**Fill mesh:** `meshStandardMaterial vertexColors transparent opacity=0.2 side=DoubleSide depthWrite=false`
**Outline:** `lineSegments` → `lineBasicMaterial color=#ffffff transparent opacity=0.3`
**Interactive:** `onPointerMove` (scanner position), `onPointerLeave`

#### F.12.5 DiagramOverlayGroup

Groups BMD + SFD + Deflection with per-type scale:
- `bmdScale`: 0.05
- `sfdScale`: 0.03
- `deflectionScale`: 0.1

---

### F.13 Stress Contour Renderer — `StressContourRenderer.tsx` (806 lines)

**Purpose:** 3D stress visualization with contour coloring, critical member highlighting, and UI panels.

#### F.13.1 Stress Types

`'vonMises' | 'principal1' | 'principal2' | 'principal3' | 'axial' | 'bending' | 'shear' | 'combined' | 'utilization'`

#### F.13.2 Contour Color Scale (7-stop rainbow)

| Position | Color |
|---|---|
| 0.0 | `#1e3a8a` (navy) |
| 0.167 | `#2563eb` (blue) |
| 0.333 | `#06b6d4` (cyan) |
| 0.5 | `#22c55e` (green) |
| 0.667 | `#eab308` (yellow) |
| 0.833 | `#f97316` (orange) |
| 1.0 | `#dc2626` (red) |

#### F.13.3 StressMember (3D)

- Geometry: `TubeGeometry` (radius 0.03, 8 radial segments)
- Material: `meshStandardMaterial vertexColors roughness=0.6 metalness=0.2`
- Critical pulse: `emissive=#ff0000`, `emissiveIntensity` oscillates 0.1–0.5 via `useFrame`
- Critical label: `<Html>` → `bg-red-600 text-white text-xs px-2 py-1 rounded-full animate-pulse` + `AlertTriangle size=12`
- Hover info: `<Html>` → `bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap`

#### F.13.4 Peak Value Labels

Positioned at each member's critical location via `<Html>`:
- Font: `monospace fontSize:10 fontWeight:600`
- Border color by utilization: < 60% `#22c55e`, 60–90% `#eab308`, > 90% `#ef4444`
- `backdropFilter: blur(4px)`

#### F.13.5 StressTypeSelector UI

**Trigger button:** `px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 rounded-lg text-sm border border-slate-600`
**Dropdown:** `motion.div` — `w-64 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50`
- `initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}`
- Active item: `bg-cyan-600/20 text-cyan-400`
- Inactive: `hover:bg-slate-200/50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300`

#### F.13.6 StressContourPanel

**Container:** `bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden`
**Header:** `px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b` — `Layers w-5 h-5 text-cyan-500` icon
**Controls:**
- Contour intervals slider: `h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none`
- Show contour lines checkbox: `rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-cyan-500`
- Highlight critical checkbox
**Summary grid:** `grid grid-cols-2 gap-4` — stress range (blue→red arrow), critical count

#### F.13.7 Floating Legend (in R3F)

`<Html>` positioned `fixed right-16 top-50%`:
- Panel: `bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-300/60 dark:border-slate-700/60 shadow-2xl p-3 w-[200px]`
- Select: `w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-cyan-500`
- Stats: `text-[10px]` — colors: `text-red-400`, `text-green-400`, `text-cyan-400`

---

### F.14 Stress Overlay — `StressOverlay.tsx` (590 lines)

**Purpose:** Combined stress/diagram/deflection overlay for 3D viewport.

#### F.14.1 Visualization Modes

`'none' | 'stress' | 'diagram_moment' | 'diagram_shear' | 'deflected'`

#### F.14.2 Color Constants

| Name | Hex |
|---|---|
| `COLOR_LOW` | `#3b82f6` |
| `COLOR_MID` | `#22c55e` |
| `COLOR_HIGH` | `#ef4444` |
| `DEFLECTED_COLOR` | `#f97316` |
| `DIAGRAM_POSITIVE` | `#ef4444` |
| `DIAGRAM_NEGATIVE` | `#3b82f6` |

#### F.14.3 ForcesDiagram (3D)

- Fill: `meshBasicMaterial vertexColors transparent opacity=0.5 side=DoubleSide depthWrite=false`
- Outline: `<Line> color=#ffffff lineWidth=1`

#### F.14.4 DeflectedMember (3D)

`<Line> color=#f97316 lineWidth=3 transparent opacity=0.7 dashed dashSize=0.2 gapSize=0.1`

#### F.14.5 DeflectedNode (3D)

`sphereGeometry args=[0.05, 16, 16]` + `meshStandardMaterial color=#f97316 transparent opacity=0.8 emissive=#f97316 emissiveIntensity=0.3`

#### F.14.6 ScaleSlider (Html overlay)

Inline styles: `fixed bottom:80px left:50% translateX(-50%)`, `background: rgba(0,0,0,0.8)`, `padding: 12px 20px`, `borderRadius: 8px`, `color: white`, `fontFamily: monospace`, `fontSize: 12px`
Range: `width:150px accentColor:#f97316`

#### F.14.7 ColorBar (Html overlay)

Inline: `fixed right:20px top:50% translateY(-50%)`, `background: rgba(0,0,0,0.8)`, `padding: 12px`, `borderRadius: 8px`
Gradient bar: `width:20px height:150px linear-gradient(to bottom, #ef4444, #22c55e, #3b82f6) borderRadius:4px`

---

### F.15 Mode Shape Renderer — `ModeShapeRenderer.tsx` (405 lines)

**Purpose:** 3D animated mode shape visualization.

#### F.15.1 Color Gradient (5-stop)

| Name | Hex | Position |
|---|---|---|
| `MIN_COLOR` | `#3b82f6` | 0% |
| `MID_CYAN_COLOR` | `#06b6d4` | 25% |
| `MID_GREEN_COLOR` | `#22c55e` | 50% |
| `MID_YELLOW_COLOR` | `#eab308` | 75% |
| `MAX_COLOR` | `#ef4444` | 100% |
| `ORIGINAL_COLOR` | `#6b7280` | Ghost |

#### F.15.2 3D Elements

**Original wireframe:** `<Line>` drei — `color=#6b7280`, `lineWidth=1`, dashed (`dashSize=0.1`, `gapSize=0.05`)
**Deformed line:** `lineWidth=3`, vertex colors from 5-stop gradient
**Node markers:** `sphereGeometry args=[0.05, 16, 16]`, only shown for nodes with > 50% of max displacement

#### F.15.3 ModeShapeControls

**Container:** `absolute bottom-4 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 shadow-lg`

| Control | Type | Range |
|---|---|---|
| Scale | Slider | 0.1–5.0, step 0.1 |
| Animate | Toggle | `bg-blue-500 text-white` (active) / `bg-gray-200 dark:bg-gray-700` (inactive) |
| Show Original | Toggle | `bg-gray-500 text-white` (active) |

**Mode info:** Mode number `text-sm font-medium`, frequency/period `text-xs text-gray-500`
**Color legend:** `h-2 rounded` bar with `linear-gradient(to right, #3b82f6, #ef4444)`, Min/Max labels `text-xs`

---

### F.16 Viewport Overlays — `ResultsViewportOverlay.tsx` (401 lines)

**Purpose:** Composites all diagram overlays for the 3D viewport.

#### F.16.1 AllResultsOverlay

Master component that renders `MemberDiagramOverlay` for each member + optional `StressColorOverlay`.

**Props:** `diagramType`, `scale` (0.05), `showLabels`, `showCriticalPoints`, `showFill`, `showStressColors`

#### F.16.2 SectionScanner

- Scanner line: `<Line> points=[[0,-1,0],[0,1,0]] color=#ffff00 lineWidth=2 dashed`
- Tooltip: `<Html>` — `background: rgba(0,0,0,0.9)`, `color: #ffff00`, `padding: 4px 8px`, `borderRadius: 4px`, `fontSize: 11px`, `fontWeight: bold`, `fontFamily: monospace`, `border: 1px solid #ffff00`

#### F.16.3 DiagramDisplayType

`'SFD' | 'BMD' | 'BMD_MY' | 'SFD_VZ' | 'AFD' | 'DEFLECTION' | 'STRESS'`

---

### F.17 Diagram Utilities — `DiagramUtils.ts` (46 lines)

Pure math utility: `calculateLocalAxes(start, end, betaAngleDeg)` → computes `localX`, `localY`, `localZ` vectors for member orientation. Handles vertical vs non-vertical members.

---

### F.18 Data & Export

#### F.18.1 Analysis Data Conversion

`convertToAnalysisResultsData()` transforms raw results:

```typescript
{
  nodes: Array<{ id, x, y, z, displacement: { dx, dy, dz, rx, ry, rz },
                 reaction?: { fx, fy, fz, mx, my, mz } }>,
  members: Array<{ id, startNodeId, endNodeId, length, sectionType,
                   maxShear, minShear, maxMoment, minMoment,
                   maxAxial, minAxial, maxDeflection,
                   sectionProps: { A, I, Iy, E, fy },
                   stress, utilization, diagramData }>,
  summary: { totalNodes, totalMembers, totalDOF, maxDisplacement,
             maxStress, maxUtilization, analysisTime, status },
  equilibriumCheck, conditionNumber, serviceabilityChecks
}
```

#### F.18.2 Serviceability Limits

| Limit | Code | Ratio |
|---|---|---|
| Floor beams | IS 800 / ASCE 7 | L/240 |
| Roof beams | IS 800 / ASCE 7 | L/180 |
| Sensitive finishes | ACI 318 / IS 456 | L/360 |
| Cantilevers | General | L/120 |

#### F.18.3 Stress Computation

$\sigma_{bending} = \frac{M \cdot (h/2)}{I}$, $\sigma_{axial} = \frac{N}{A}$, $\sigma_{total} = \sigma_{bending} + \sigma_{axial}$, $utilization = \frac{\sigma_{total}}{f_y}$ (default $f_y$ = 250 MPa)

#### F.18.4 PDF Report Structure

1. Header + Project Info
2. Nodes Table
3. Members Table
4. Cross-Sectional Details (E, A, Iy, Iz, J, length)
5. Free Body Diagram (SVG)
6. Detailed Reactions Table with Equilibrium Check
7. Member Forces Table (axial, shearY/Z, momentY/Z, torsion)
8. Combined Structure Diagrams (SFD, BMD, AFD)
9. Detailed Individual Member Diagrams (top 10 by force magnitude)

#### F.18.5 Export Formats

**CSV:** `BeamLab_Analysis_{date}.csv` — nodes, members, displacements (6 DOF), reactions (6 DOF), member forces (6 components)
**JSON:** `BeamLab_Results_{date}.json` — full `convertToAnalysisResultsData()` output

---

## Appendix G — Structural Analysis Viewer

**File:** `apps/web/src/components/analysis/StructuralAnalysisViewer.tsx`

### G.1 View Settings

| Setting | Type | Default |
|---|---|---|
| showGrid | boolean | true |
| showNodeLabels | boolean | true |
| showMemberLabels | boolean | true |
| showLoads | boolean | true |
| showReactions | boolean | true |
| showDeflectedShape | boolean | false |
| showBMD | boolean | false |
| showSFD | boolean | false |
| showAFD | boolean | false |
| deflectionScale | number | 100 (range: 10–500) |
| diagramScale | number | 50 (range: 10–200) |

### G.2 Zoom

- Min: 0.25, Max: 4, Step: 0.25
- Reset: `Maximize2` button
- Display: `"Zoom: {(zoom * 100).toFixed(0)}%"`

### G.3 SVG Rendering Order (back to front)

1. Grid lines (`#e2e8f0`, strokeWidth 0.5)
2. Deflected shape (`#10b981`, strokeWidth 3, dashed `5,5`, opacity 0.7)
3. BMD polygon (`rgba(239,68,68,0.2)` fill, `#ef4444` stroke)
4. SFD polygon (`rgba(59,130,246,0.2)` fill, `#3b82f6` stroke)
5. Members (`#1e293b`, strokeWidth 3; selected: `#3b82f6`, strokeWidth 4)
6. Support symbols (fixed ▿▿, pinned △, roller ○)
7. Nodes (r=6, `#1e293b` fill, white stroke-2; selected: `#3b82f6` fill)
8. Point load arrows (`text-red-500`, arrowSize 10, length 50)
9. UDL arrows (`text-blue-500`, 5 arrows + connecting line)
10. Reaction arrows (`text-green-600`)

### G.4 Label Typography

| Label | Fill | Font Size | Font Weight | Anchor |
|---|---|---|---|---|
| Node labels | `#64748b` | 11 | 600 | middle |
| Member labels | `#64748b` | 12 | — | middle |
| Load values | inherit | 12 | 600 | — |
| Reaction values | inherit | 11 | 600 | — |
| BMD values | `#ef4444` | 10 | 600 | — |

Load format: `{value.toFixed(1)} kN` or `{value.toFixed(1)} kN/m`  
Reaction format: `{Ry.toFixed(1)} kN`, `{Mz.toFixed(1)} kNm`

### G.5 Settings Panel (Animated)

- Width: `280px` (animated from 0)
- Animation: `framer-motion`, `width: 0→280, opacity: 0→1`
- 4 sections: Display Options (5 checkboxes), Diagrams (4 colored checkboxes), Scale (2 sliders), Selected Element Info

### G.6 Results Summary Bar

Appears when analysis result exists:
- Animation: `height: 0→auto, opacity: 0→1`
- 3 metrics with dividers:
  1. Max Moment: `text-red-500` label, `{value.toFixed(2)} kNm`
  2. Max Shear: `text-blue-500` label, `{value.toFixed(2)} kN`
  3. Max Deflection: `text-green-500` label, `{value.toFixed(3)} mm`

### G.7 Tab System

3 tabs: `structure`, `results`, `table`  
Content varies by tab (structure = SVG viewer, results = data panels, table = tabular data)

---

## Appendix H — Post-Processing Design Studio

**File:** `apps/web/src/components/results/PostProcessingDesignStudio.tsx` (2467 lines)

> STAAD-Pro-class post-processing & design panel. Fullscreen dialog.

### H.1 Dialog Shell

**No results state:**
- `Dialog` + `DialogContent` `max-w-md`
- `AlertTriangle w-12 h-12 text-amber-400` centered
- "No analysis results available." text
- Close button

**Active state:**
- `DialogContent` `max-w-none w-screen h-screen p-0 rounded-none flex flex-col gap-0`

### H.2 Title Bar

`flex items-center justify-between px-5 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700/60`
- Icon: `Shield w-5 h-5 text-blue-400`
- Title: `text-lg font-bold text-slate-900 dark:text-slate-100` — "Post-Processing Design Studio"
- Member count badge: `text-xs text-slate-500 bg-slate-200 dark:bg-slate-700/50 px-2 py-0.5 rounded-full`
- Export Report button: `px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg` + `Download w-4 h-4`

### H.3 Tab Bar

`flex items-center gap-1 px-5 py-1.5 bg-slate-100/60 dark:bg-slate-800/60 border-b overflow-x-auto`

| Tab ID | Label | Icon |
|---|---|---|
| `summary` | Design Summary | `BarChart3` |
| `rcBeam` | RC Beam Design | `Building2` |
| `steel` | Steel Design | `Columns3` |
| `section` | Section Properties | `Layers` |
| `deflection` | Deflection Check | `Ruler` |

**Active tab:** `bg-blue-600 text-white shadow`
**Inactive tab:** `text-slate-500 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50`

### H.4 Utilization Color System

| Range | Bar Color | Text Color |
|---|---|---|
| ≤ 0.6 | `bg-emerald-500` | `text-emerald-400` |
| ≤ 0.8 | `bg-lime-500` | `text-lime-400` |
| ≤ 0.9 | `bg-amber-500` | `text-amber-400` |
| ≤ 1.0 | `bg-orange-500` | `text-orange-400` |
| > 1.0 | `bg-red-500` | `text-red-400` |

### H.5 Status Colors

| Status | Background | Text |
|---|---|---|
| PASS | `bg-emerald-500/20` | `text-emerald-400` |
| FAIL | `bg-red-500/20` | `text-red-400` |
| WARNING | `bg-amber-500/20` | `text-amber-400` |

### H.6 Summary Tab

**KPI Banner:** 3 status dots showing pass/warn/fail counts
**Search:** Text input for member filter
**Status filter:** Dropdown (All / PASS / FAIL / WARNING)

**Sortable Table — 9 Columns:**

| Column | Content | Align |
|---|---|---|
| Member | `font-mono font-medium` | left |
| Type | capitalize material type | left |
| Length | `{length.toFixed(2)} m` | right |
| Axial | `fmtForce(value) kN` | right |
| Shear | `fmtForce(value) kN` | right |
| Moment | `fmtForce(value) kN·m` | right |
| Utilization | bar (`h-2 rounded-full`) | center |
| Status | badge with icon (CheckCircle/XCircle/AlertTriangle) | center |
| Governing | check name text | left |

**Empty state:** "No members match filter criteria."

### H.7 RC Beam Tab

#### H.7.1 Layout
Left sidebar: `w-56` member list  
Right panel: scrollable design detail

#### H.7.2 Member Sidebar
Each member card shows:
- Label (mono font)
- Section type (`text-[10px] text-slate-500`)
- Force summary: `text-[10px]` — Mu/Vu/Nu values

**Selected member:** `bg-blue-900/30 border-l-2 border-blue-500`

#### H.7.3 Design Panel Header
- Member name + length + design code selector (`IS456` / `ACI318`)

#### H.7.4 Material & Section Parameters (5-col grid)

| Parameter | Range | Default |
|---|---|---|
| fck (MPa) | 15–100 | 25 |
| fy (MPa) | 250–600 | 415 |
| Cover (mm) | 20–75 | 40 |
| Width b (mm) | 150–1000 | 230 |
| Depth D (mm) | 200–2000 | 450 |

#### H.7.5 Applied Forces (3 Cards)

| Card | Color | Unit |
|---|---|---|
| Mu (Moment) | `text-purple-400` | kN·m |
| Vu (Shear) | `text-blue-400` | kN |
| Nu (Axial) | `text-green-400` (tension) / `text-red-400` (compression) | kN |

Card style: `bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-3 text-center border`
Value: `text-xl font-bold font-mono`

#### H.7.6 Flexure Design Results

| Field | Description |
|---|---|
| As,req | Required steel area (mm²) |
| As,prov | Provided steel area |
| As,min | Minimum per code |
| As,max | Maximum per code |
| Bars | `{count} × Ø{diameter}` |
| Steel ratio ρ | Percentage |
| N.A. depth | Neutral axis (mm) |
| Compression block a | Whitney block depth (mm) |
| φMn | Design capacity (kN·m) |
| Mu/φMn | Demand/capacity ratio |

**Includes RCBeamCrossSection SVG** — see H.10.

#### H.7.7 Shear Design

| Field | Value |
|---|---|
| Vu | Design shear (kN) |
| φVc | Concrete capacity (kN) |
| Vs,req | Required stirrup capacity |
| Stirrup size | Ø diameter (mm) |
| Spacing | mm c/c |
| Max spacing | Per code limit |
| Number of legs | Integer |

**Capacity Breakdown Bars (3):**
| Bar | Color | Label |
|---|---|---|
| Concrete | cyan | φVc |
| Steel | blue | φVs |
| Demand | amber | Vu |

#### H.7.8 Reinforcement Summary

`IS 456 notation: {count}Ø{dia} | ACI notation: {count}#{barNo}`
Reinforcement string in `text-emerald-400 font-mono`

### H.8 Steel Design Tab

#### H.8.1 Layout
Left sidebar: `w-56` with mini utilization bar per member
Right panel: design detail

#### H.8.2 Applied Forces (3 cards)

| Card | Label | Color |
|---|---|---|
| Pu/Nu | Axial | `text-green-400` |
| Vu | Shear | `text-blue-400` |
| Mu | Moment | `text-purple-400` |

#### H.8.3 Design Checks

Each check card: `border-l-[3px]` colored by status
- Left color: PASS `#10b981`, FAIL `#ef4444`, WARNING `#f59e0b`
- Utilization bar: `w-28 h-2 bg-slate-200 dark:bg-slate-700 rounded-full`
- Utilization text: `text-xs font-bold font-mono w-12 text-right`
- Formula: `font-mono text-xs text-slate-600`
- Description text below

#### H.8.4 Recommendations

`bg-blue-900/15 border border-blue-500/30 rounded-xl p-4`
Header: `text-xs font-semibold text-blue-400 uppercase tracking-wider`
Bullet list with blue dot markers

### H.9 Section Properties Tab

#### H.9.1 Table Headers (9 columns)

| Column | Align | Unit |
|---|---|---|
| (expand icon) | — | — |
| Member | left | M{id} |
| Section | left | icon + name |
| Length | right | m |
| A | right | m² |
| Iz | right | m⁴ |
| Iy | right | m⁴ |
| J | right | m⁴ |
| E | right | kN/m² |

**Section icons by type:**
| Type | Icon | Color |
|---|---|---|
| I-BEAM | `Columns3` | `text-blue-400` |
| RECTANGLE | `Box` | `text-amber-400` |
| CIRCLE | `CircleDot` | `text-green-400` |
| TUBE | `Grid3X3` | `text-purple-400` |
| C-CHANNEL | `Minus` | `text-cyan-400` |
| L-ANGLE | `Plus` | `text-orange-400` |
| Default | `Box` | `text-slate-500` |

**Values:** `font-mono`, scientific notation (`.toExponential(3)`)

#### H.9.2 Expanded Detail (3-col grid)

| Column 1 | Column 2 | Column 3 |
|---|---|---|
| **Geometric Properties** | **Section Dimensions** | **Material Properties** |
| Area (A) m², Iz m⁴, Iy m⁴, J m⁴, rz (gyration) mm, Zz (elastic) m³ | Height mm, Width mm, Web tw mm, Flange tf mm, Diameter mm, Thickness mm | Material (auto-detect: E < 50 GPa → concrete), E GPa, G GPa, ρ kg/m³, β rotation °, Releases |

**Expanded row bg:** `bg-slate-100/40 dark:bg-slate-800/40`
**Click to expand:** toggle `ChevronRight` ↔ `ChevronDown`

### H.10 RC Beam Cross-Section SVG (~270 lines)

Parametric cross-section drawing:

| Element | Rendering |
|---|---|
| Concrete body | Rectangle with hatch pattern (45° lines, spacing 8, stroke `#94a3b8` opacity 0.15) |
| Stirrup | Inner rectangle with 135° hook paths at corners |
| Bottom bars (tension) | Red circles, max 4/row then 2nd layer, fill `#ef4444` |
| Top bars (hanger) | Orange circles, fill `#f97316` |
| Neutral axis | Yellow dashed line (`#eab308`), label "N.A." |
| Cover annotations | Cyan dimensioning arrows (`#06b6d4`) |
| Width/depth dims | Gray dimension lines and labels |
| Bar callouts | Text labels referencing bar count × diameter |

**Color Legend (bottom of SVG):**
| Swatch | Label |
|---|---|
| `#ef4444` | Tension bars |
| `#f97316` | Compression bars |
| `#64748b` | Stirrups |
| `#eab308` | Neutral Axis |

### H.11 Deflection Check Tab

#### H.11.1 Header

`Ruler w-4 h-4 text-blue-400` + "Deflection Compliance"
Limit selector dropdown: 6 options

| Option | Value | Code |
|---|---|---|
| L/180 | 180 | Floor, live load |
| L/240 | 240 | Floor, total load |
| L/250 | 250 | IS 800 |
| L/300 | 300 | Roof, snow load |
| L/325 | 325 | IS 456 |
| L/360 | 360 | AISC floor |

**Pass/Fail counts:** `text-emerald-400` / `text-red-400`

#### H.11.2 Table (7 columns)

| Column | Align | Content |
|---|---|---|
| Member | left | `font-mono` label |
| Span | right | `{length.toFixed(3)} m` |
| Max Defl | right | `{deflMM.toFixed(3)} mm` |
| Allowable | right | `{allowableMM.toFixed(2)} mm` |
| Actual L/δ | right | `L/{ratio}` or `∞` |
| Ratio | center | utilization bar + percentage |
| Status | center | PASS/FAIL badge with `CheckCircle`/`XCircle` icon |

**Row hover:** `hover:bg-slate-100/60 dark:hover:bg-slate-800/60`

### H.12 Export Report (Text)

Generated by `handleExport()` — plain text file:
1. Header: "STRUCTURAL DESIGN REPORT"
2. Summary: date, member count, pass/fail/warning counts
3. Member summary table (fixed-width columns)
4. Detailed per-member design checks with formulas
5. Reinforcement details (if concrete)
6. Filename: `Design_Report_{date}.txt`

---

## Appendix I — Barrel Exports (`results/index.ts`)

All results components are re-exported from a single barrel file:

| Export | Source |
|---|---|
| `DiagramOverlay`, `DiagramOverlayGroup`, `DiagramData`, `DiagramType` | `DiagramOverlay.tsx` |
| `StressOverlay`, `getStressColor`, `getStressColorHex`, `VisualizationMode`, `NodeDisplacement`, `MemberForces`, `NodePosition`, `MemberGeometry` | `StressOverlay.tsx` |
| `ModeShapeRenderer`, `ModeShapeControls`, `ModeShapeData` | `ModeShapeRenderer.tsx` |
| `ResultsToolbar` | `ResultsToolbar.tsx` |
| `EnhancedDiagramViewer`, `EnhancedDiagramPoint` | `EnhancedDiagramViewer.tsx` |
| `EnhancedHeatMap`, `HeatMapMemberData`, `HeatMapType` | `EnhancedHeatMap.tsx` |
| `AnalysisResultsDashboard`, `AnalysisResultsData`, `NodeResult`, `MemberResult` | `AnalysisResultsDashboard.tsx` |
| `MemberDiagramOverlay`, `StressColorOverlay`, `SectionScanner`, `AllResultsOverlay` | `ResultsViewportOverlay.tsx` |
| `ResultsTablePanel` | `ResultsTablePanel.tsx` |
| `ResultsControlPanel` | `ResultsControlPanel.tsx` |
| `ResultsSplitView`, `DockableResultsPanel` | `ResultsSplitView.tsx` |

---

## Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2025-01-XX | Initial comprehensive spec covering all panels, views, and pages |
| 2.0 | 2025-01-XX | Massive expansion: Appendix F expanded from 70 to 1200+ lines covering all 19 results component files with micro-detail accuracy. New Appendix H (Post-Processing Design Studio with 12 sub-sections). New Appendix I (Barrel Exports). |

---

*This document is the companion to `WORKFLOW_BUTTONS_DESIGN_SPEC.md`. Together they provide complete micro-detail-level Figma reproduction specifications for the entire BeamLab application.*
