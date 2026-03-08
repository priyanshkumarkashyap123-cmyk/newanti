# COMPREHENSIVE UI COMPONENT AUDIT — BeamLab Web Application

**Application Type:** Structural Engineering Analysis Tool (STAAD Pro / ETABS equivalent)  
**Tech Stack:** React 18 + TypeScript, Three.js/R3F, Zustand, Tailwind CSS, Rust WASM Solver, Monaco Editor  
**Total Component Files:** 337 `.tsx` files across 40+ subdirectories  
**Total Lines of Code:** ~162,000 lines (components only)  
**Audit Date:** June 2025  

---

## TABLE OF CONTENTS

1. [Application Shell & Layout](#1-application-shell--layout)
2. [Main Workspace — ModernModeler](#2-main-workspace--modernmodeler)
3. [WorkflowSidebar](#3-workflowsidebar)
4. [EngineeringRibbon](#4-engineeringribbon)
5. [ViewportManager & 3D Canvas](#5-viewportmanager--3d-canvas)
6. [StatusBar (embedded in ModernModeler)](#6-statusbar)
7. [InspectorPanel (Right Sidebar)](#7-inspectorpanel)
8. [Structure Wizard](#8-structure-wizard)
9. [Analysis Engine & Progress](#9-analysis-engine--progress)
10. [Results System](#10-results-system)
11. [Design Panels](#11-design-panels)
12. [Load Dialogs & Generators](#12-load-dialogs--generators)
13. [Selection & Geometry Tools](#13-selection--geometry-tools)
14. [AI & Chat Components](#14-ai--chat-components)
15. [Context Menu & Quick Commands](#15-context-menu--quick-commands)
16. [Modals & Dialogs (Global)](#16-modals--dialogs-global)
17. [Viewer / 3D Rendering Components](#17-viewer--3d-rendering)
18. [Enhanced / Advanced Components](#18-enhanced--advanced-components)
19. [Civil Engineering Hub](#19-civil-engineering-hub)
20. [Dashboard & User Components](#20-dashboard--user-components)
21. [Routing & Pages](#21-routing--pages)
22. [Stores (State Management)](#22-stores)
23. [Complete File Inventory](#23-complete-file-inventory)

---

## 1. APPLICATION SHELL & LAYOUT

### App.tsx (896 lines)
- **PURPOSE:** Root application component with React Router v6 routing, providers, and lazy-loaded pages.
- **LAYOUT:** Full-screen, wrapped in `<ClerkProvider>` → `<AnalyticsProvider>` → `<ErrorBoundary>` → `<BrowserRouter>`.
- **PROVIDERS (outermost to innermost):** ClerkProvider, AnalyticsProvider, ErrorBoundary, BrowserRouter, CookieConsent, OfflineBanner.
- **ROUTES (~80+ routes):**
  - `/` → Landing/Home page
  - `/app` → `<ModernModeler>` (RequireAuth) — **Main workspace**
  - `/demo` → `<ModernModeler>` (no auth required)
  - `/stream` → `<UnifiedDashboard>` (RequireAuth)
  - `/sign-in`, `/sign-up` → Clerk authentication
  - `/dashboard` → UserDashboard
  - `/pricing` → PricingPage
  - `/capabilities` → CapabilitiesPage
  - **Design routes:** `/design/steel`, `/design/concrete`, `/design/foundation`, `/design/connections`, `/design/detailing`
  - **Analysis routes:** `/analysis/modal`, `/analysis/time-history`, `/analysis/seismic`, `/analysis/buckling`, `/analysis/pdelta`, `/analysis/pushover`, `/analysis/plate-shell`
  - **Enterprise routes:** `/bim`, `/collaboration`, `/cad`, `/materials`, `/compliance`
  - **Civil engineering:** `/civil/*` (geotech, hydraulics, transport, construction, surveying, environmental subroutes)
  - **Tools:** `/script-editor`, `/health`, `/import-export`
  - `/docs` → Documentation page
  - `*` → NotFound (404 page)
- **LAZY LOADING:** All route components use `React.lazy()` for code splitting.
- **GLOBAL COMPONENTS:** `<CookieConsent>` at bottom, `<OfflineBanner>` when offline detected.

---

## 2. MAIN WORKSPACE — ModernModeler

### ModernModeler.tsx (3,712 lines) — THE CENTRAL COMPONENT
- **PURPOSE:** Main structural modeling workspace. Contains the entire IDE-like interface for structural analysis.
- **LAYOUT (top to bottom, left to right):**
  ```
  ┌─────────────────────────────────────────────┐
  │  MultiplayerProvider wrapper                │
  │ ┌──────┬──────────────────────────┬────────┐│
  │ │      │  EngineeringRibbon       │        ││
  │ │ Work │  (category tabs + tools) │ Inspec ││
  │ │ flow │ ┌──────────────────────┐ │ tor    ││
  │ │ Side │ │ ModelingToolbar (TL) │ │ Panel  ││
  │ │ bar  │ │                      │ │ (280px)││
  │ │      │ │   ViewportManager    │ │        ││
  │ │ (w-  │ │   (3D Canvas)        │ │ Proper ││
  │ │ 48)  │ │                      │ │ ties   ││
  │ │      │ │  ViewControlsOverlay │ │ Panel  ││
  │ │      │ │  StatusBar (bottom)  │ │        ││
  │ │      │ └──────────────────────┘ │        ││
  │ │      │  ResultsTableDock        │        ││
  │ └──────┴──────────────────────────┴────────┘│
  │  ~40 conditional modals/dialogs             │
  │  CommandPalette (Cmd+K)                     │
  └─────────────────────────────────────────────┘
  ```
- **CSS:** `h-screen w-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden relative`
- **ACCESSIBILITY:** Skip-to-main-content link (`#main-viewport`), `role="navigation"` on sidebar.

#### Key State Variables:
| Variable | Type | Default | Purpose |
|---|---|---|---|
| `isAnalyzingLocal` | boolean | false | Local analysis running flag |
| `analysisStage` | AnalysisStage | 'idle' | Current solver step |
| `analysisProgress` | number | 0 | Progress percentage 0-100 |
| `analysisError` | string\|null | null | Error message if analysis fails |
| `analysisStats` | object\|null | null | {nodes, members, dof, timeMs} |
| `showProgressModal` | boolean | false | Show analysis progress overlay |
| `showResultsToolbar` | boolean | false | Show results toolbar after analysis |
| `showResultsDock` | boolean | false | Show bottom results table panel |
| `showQuickStart` | boolean | false | Welcome/quick start modal |
| `showCloudManager` | boolean | false | Cloud project manager |
| `showProjectDetails` | boolean | false | Project details dialog |
| `showExportDialog` | boolean | false | Export dialog |
| `showModalAnalysis` | boolean | false | Modal analysis panel |
| `showValidationDialog` | boolean | false | Pre-analysis validation |
| `showStressVisualization` | boolean | false | Stress viz panel |
| `showShortcuts` | boolean | false | Keyboard shortcuts overlay |
| `showAIArchitect` | boolean | false | AI panel (right side) |
| `showLoadDialog` | boolean | false | UDL load input |
| `showSplitDialog` | boolean | false | Split member dialog |
| `showSpecDialog` | boolean | false | Member specifications |
| `diagnosticsOpen` | boolean | false | Backend diagnostics |
| `inspectorCollapsed` | boolean | false | Right panel collapsed |
| `isSidebarOpen` | boolean | false | Mobile sidebar state |
| `commandPalette.isOpen` | boolean | false | Cmd+K palette |

#### Analysis Engine (lines 1000-2500):
- **Primary solver:** Rust WASM via `wasmSolverService.analyzeStructure()`
- **Fallback 1:** `EnhancedAnalysisEngine` (TypeScript)
- **Fallback 2:** TypeScript Worker via `analysisService.analyze()`
- **Pipeline:** Model data conversion → WASM call → Result parsing → FEF correction → Diagram generation
- **Units:** Internal N/mm → Display kN/m
- **Features:** 6-DOF frame elements, QUAD4 plate elements, member releases, distributed loads, floor load distribution, point load equivalence, pin support moment zeroing

#### ~40 Conditional Modal/Dialog Renders:
| Dialog | Trigger (modals key) | Component |
|---|---|---|
| Structure Wizard | `structureWizard` | `<StructureWizard>` |
| Foundation Design | `foundationDesign` | `<FoundationDesignDialog>` |
| IS 875 Loads | `is875Load` | `<IS875LoadDialog>` |
| Geometry Tools | `geometryTools` | `<GeometryToolsPanel>` |
| Import/Export | `interoperability` | `<InteroperabilityDialog>` |
| Railway Bridge | `railwayBridge` | `<RailwayBridgeDialog>` |
| FEA Meshing | `meshing` | `<MeshingPanel>` |
| Plate Creation | `plateDialog` | `<PlateCreationDialog>` |
| Floor Slab | `floorSlabDialog` | `<FloorSlabDialog>` |
| Load Dialog | `loadDialog` | `<LoadDialog>` |
| Wind Load | `windLoadDialog` | `<WindLoadDialog>` |
| Seismic Load | `seismicLoadDialog` | `<SeismicLoadDialog>` |
| Moving Load | `movingLoadDialog` | `<MovingLoadDialog>` |
| Boundary Conditions | `boundaryConditionsDialog` | `<BoundaryConditionsDialog>` |
| Selection Toolbar | `selectionToolbar` | `<SelectionToolbar>` |
| Dead Load Gen | `deadLoadGenerator` | `<DeadLoadGenerator>` |
| Advanced Analysis | `advancedAnalysis` | `<AdvancedAnalysisDialog>` |
| P-Delta | `pDeltaAnalysis` | (same dialog, different tab) |
| Buckling | `bucklingAnalysis` | (same dialog, different tab) |
| Design Codes | `designCodes` | `<DesignCodesDialog>` |
| ASCE 7 Seismic | `asce7SeismicDialog` | `<ASCE7SeismicLoadDialog>` |
| ASCE 7 Wind | `asce7WindDialog` | `<ASCE7WindLoadDialog>` |
| Load Combinations | `loadCombinationsDialog` | `<LoadCombinationsDialog>` |
| IS 1893 Seismic | `is1893SeismicDialog` | `<IS1893SeismicLoadDialog>` |
| Section Browser | `sectionBrowserDialog` | `<SectionBrowserDialog>` |
| Steel Design | `steelDesign` | `<SteelDesignDialog>` |
| Concrete Design | `concreteDesign` | `<ConcreteDesignDialog>` |
| Connection Design | `connectionDesign` | `<ConnectionDesignDialog>` |
| Civil Engineering | `civilEngineering` | `<CivilEngineeringDialog>` |
| Generative Design | `generativeDesign` | `<GenerativeDesignPanel>` |
| Seismic Studio | `seismicStudio` | `<SeismicDesignStudio>` |
| Structure Gallery | `structureGallery` | `<StructureGallery>` |
| Curved Structure | `curvedStructure` | `<CurvedStructureDialog>` |
| Detailed Design | `detailedDesign` | `<DetailedDesignPanel>` |

#### Keyboard Shortcuts:
| Key | Action |
|---|---|
| `Cmd+K` | Command Palette |
| `Space` | Quick Commands Toolbar |
| `?` or `Shift+/` | Keyboard Shortcuts Overlay |
| `F1` | Keyboard Shortcuts Help |
| `Delete` / `Backspace` | Delete selection |
| `F` | Fit view |

#### Event Listeners (CustomEvent dispatch):
| Event | Action |
|---|---|
| `trigger-analysis` | Run analysis |
| `trigger-modal-analysis` | Open modal analysis |
| `trigger-export` | Open export dialog |
| `trigger-save` | Save project |
| `trigger-cloud-open` | Open cloud project manager |
| `trigger-delete` | Delete selected elements |
| `trigger-copy` | Duplicate selected with 1m X offset |
| `trigger-move` | Switch to select tool |
| `trigger-split` | Split selected members at midpoint |
| `toggle-deformed` | Toggle deflected shape |
| `toggle-diagrams` | Toggle SFD + BMD |
| `toggle-sidebar` | Toggle mobile sidebar |
| `toggle-ai-architect` | Toggle AI panel |
| `trigger-upgrade` | Open upgrade modal |
| `fit-view` | Camera fit to content |
| `toggle-grid` | Toggle grid visibility |

#### URL Parameter Handling:
| Parameter | Values | Action |
|---|---|---|
| `tool` | foundation, wind, seismic, geometry, import, export, architect | Opens corresponding dialog |
| `mode` | loading, analysis, ai, design, geometry | Opens corresponding panel |
| `panel` | templates | Opens Structure Wizard |
| `export` | any | Opens interoperability dialog |
| `type` | (with mode=analysis) | Triggers analysis |
| `code` | (with mode=design) | Opens design with code |
| `upgrade` | true | Opens upgrade modal |

---

## 3. WORKFLOWSIDEBAR

### layout/WorkflowSidebar.tsx (243 lines)
- **PURPOSE:** Left navigation sidebar showing engineering workflow steps (like STAAD's workflow tree).
- **LAYOUT:** Vertical sidebar, `w-48` expanded / `w-12` collapsed. Collapsible via chevron button.
- **BACKGROUND:** `bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950`
- **BORDER:** `border-r border-slate-800/60`

#### Workflow Steps (9 items):
| # | ID | Label | Subtext | Icon | Category Mapping |
|---|---|---|---|---|---|
| 1 | MODELING | Geometry | Nodes & Beams | Box | MODELING |
| 2 | PROPERTIES | Properties | Sections | Layers | PROPERTIES |
| 3 | MATERIALS | Materials | Concrete/Steel | Database | PROPERTIES |
| 4 | SPECS | Specifications | Releases | Settings | PROPERTIES |
| 5 | SUPPORTS | Supports | Restraints | Anchor | Opens `boundaryConditionsDialog` modal |
| 6 | LOADING | Loading | Load Cases | Download | LOADING |
| 7 | ANALYSIS | Analysis | Run Solver | BarChart3 | ANALYSIS |
| 8 | DESIGN | Design | Code Check | Ruler | DESIGN |
| 9 | CIVIL | Civil Engg | Geo/Hydro/Trans | Globe | CIVIL |

#### Step Completion Tracking:
- Checkmarks (green ✓) appear when step is done.
- MODELING: `nodes.size > 0 || members.size > 0`
- PROPERTIES/MATERIALS/SPECS: `members.size > 0`
- SUPPORTS: Any node has restraints
- LOADING: `loads.length > 0 || memberLoads.length > 0`
- ANALYSIS/DESIGN: `analysisResults` exists

#### Active Step Styling:
- Active: `bg-blue-500/10 text-blue-400 border-l-2 border-blue-500`
- Inactive: `text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60`

#### Header Section:
- Title: "Workflow" (10px bold uppercase)
- Subtitle: "ANALYTICAL MODELING" (9px mono)
- Collapse button: `<ChevronsLeft>` / `<ChevronsRight>`

#### Footer Section:
- Connection status indicator: green pulsing dot + "Online"

---

## 4. ENGINEERINGRIBBON

### layout/EngineeringRibbon.tsx (756 lines)
- **PURPOSE:** Microsoft Office-style ribbon toolbar with category-specific tool groups.
- **LAYOUT:** Full-width bar, 2 rows: Title bar (h-8) + Tools area (h-[100px]).
- **BACKGROUND:** `bg-white/98 dark:bg-slate-900/98 backdrop-blur-md border-b border-slate-200/40 dark:border-slate-700/40`

#### Title Bar (top row):
- **Left:** Mobile hamburger menu (md:hidden), BeamLab logo link → `/stream`, badge "ULTIMATE"
- **Center:** Category tab buttons (6 tabs):
  | Tab | Label | Color (active) |
  |---|---|---|
  | MODELING | GEOMETRY | blue, border-t-2 border-t-blue-500 |
  | PROPERTIES | PROPERTIES | purple, border-t-2 border-t-purple-500 |
  | LOADING | LOADING | orange, border-t-2 border-t-orange-500 |
  | ANALYSIS | ANALYSIS | emerald, border-t-2 border-t-emerald-500 |
  | DESIGN | DESIGN | rose, border-t-2 border-t-rose-500 |
  | CIVIL | CIVIL ENGG | amber, border-t-2 border-t-amber-500 |
- **Right:** Crown icon "Upgrade" button, "Auto-Saved" text.

#### Tools Area — GEOMETRY Tab:
| Group | Tools |
|---|---|
| **File** | Save (Ctrl+S), Open (Ctrl+O), Export, Undo (Ctrl+Z), Redo (Ctrl+Shift+Z) |
| **Structure** | Wizard (large, Ctrl+Shift+W), Gallery |
| **Create** | Node (N), Beam (M), Plate (P), Slab |
| **Select** | Select (V), Advanced Selection |
| **Edit** | Copy (Ctrl+C), Move, Mirror, Rotate, Split, Delete (Del) |
| **Supports** | Boundary (opens boundary conditions dialog) |

#### Tools Area — PROPERTIES Tab:
| Group | Tools |
|---|---|
| **Section** | Library (large, opens Section Browser), Assign, Section Builder |
| **Material** | Material, Assign, Properties |
| **Specifications** | Beta Angle, Releases, Offsets |

#### Tools Area — LOADING Tab:
| Group | Tools |
|---|---|
| **Load Cases** | Define (large, opens IS 875), Combos |
| **Nodal Loads** | Force (L), Moment |
| **Member Loads** | UDL (U), Trapezoidal, Point |
| **Area Loads** | Floor Load |
| **Generate** | Self Weight, Wind (IS 875-III/ASCE 7-22), ASCE 7 Seismic, IS 1893 Seismic, Combinations |

#### Tools Area — ANALYSIS Tab:
| Group | Tools |
|---|---|
| **Run** | RUN ANALYSIS (large, F5, green glow animation), Modal, P-Delta |
| **Advanced** | Buckling, Response, Pushover |
| **Results** | Deformed, Diagrams, Output, Export |

#### Tools Area — DESIGN Tab:
| Group | Tools |
|---|---|
| **Code Check** | Design Codes (large), D/C Ratios |
| **Steel Design** | Steel Studio (large) |
| **RC Design** | RC Studio (large) |
| **Connection** | Connections |
| **Foundation** | Foundation |
| **Advanced** | Detailed, Curved |

#### Tools Area — CIVIL ENGG Tab:
| Group | Tools |
|---|---|
| **Civil Engineering** | Civil Hub (large), Geotech, Hydraulics |
| **Infrastructure** | Transport, Construction |
| **Design** | Steel, Concrete, Connect |
| **Advanced AI** | AI Architect, Generative, Seismic |

#### Sub-Components:
- `ToolButton`: 3 sizes (large: 56x56, normal: 50x50, compact: h-8 row). Active: `bg-blue-600/15 border-blue-500/30 text-blue-300`. Has Tooltip with optional shortcut display.
- `ToolGroup`: Column flex container with bottom label (10px uppercase tracking-wider).
- `StackedButtons`: Two `MiniButton` stacked vertically.
- `MiniButton`: Compact row button (9px label) for secondary actions.

---

## 5. VIEWPORTMANAGER & 3D CANVAS

### ViewportManager.tsx (798 lines)
- **PURPOSE:** Manages 3D structural model viewport(s) using React Three Fiber.
- **LAYOUT:** Full container (`flex-1 relative`) with either SINGLE or QUAD viewport layout.
- **TWO LAYOUTS:**
  - **SINGLE:** One full-screen perspective viewport.
  - **QUAD:** CSS Grid 2×2 (`grid-cols-2 grid-rows-2`):
    - Top-left: Perspective (free orbit)
    - Top-right: Top view (orthographic, XZ plane)
    - Bottom-left: Front view (orthographic, XY plane)
    - Bottom-right: Right view (orthographic, YZ plane)

#### Display Settings Panel (floating overlay, bottom-right):
| Setting | Type | Options |
|---|---|---|
| Renderer | Toggle | WebGL / WebGPU |
| Member Display | Toggle | Wire / Solid |
| Layout | Toggle | Single / Quad |

#### R3F Canvas Configuration:
- `camera={{ position: [10, 8, 10], fov: 50 }}`
- `gl={{ alpha: false, antialias: true, precision: 'highp', stencil: false, depth: true }}`
- `dpr={[1, 1.5]}` (device pixel ratio)
- `shadows` enabled
- `className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#0a0e1a] dark:to-[#0d1320]"`

#### Scene Components (per viewport):
- `<View>` wrapper (React Three Fiber multi-viewport)
- `<OrbitControls>` with `enableDamping`, `dampingFactor={0.05}`
- `<SharedScene>` — the main structural model rendering
- `<BoxSelector>` — rectangular selection tool
- `<CameraFitController>` — auto-fit camera to model bounds

#### WebGL Support Check:
- Detects WebGL availability via `document.createElement('canvas').getContext('webgl2')`
- Retry logic: "Try Again" button + "Use Basic Renderer" fallback
- Fallback UI: wireframe diagram of the model

#### Error Handling:
- `<SafeCanvasWrapper>` wraps each canvas in an error boundary
- Graceful fallback to 2D representation on WebGL failure

---

## 6. STATUSBAR

### Embedded in ModernModeler.tsx (CategorySwitcher + StatusBar sub-components)
- **PURPOSE:** Bottom status bar showing model info, tool state, and backend health.
- **LAYOUT:** `absolute bottom-0 w-full z-10`, single row.
- **BACKGROUND:** `bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200/40 dark:border-slate-700/40`

#### Sections (left to right):
| Section | Content |
|---|---|
| Model Stats | `N: {nodeCount}  M: {memberCount}  P: {plateCount}` |
| Active Tool | e.g. "Select", "Node", "Member" with tool icon |
| Zoom Level | Percentage display |
| Unit System | `kN, m` |
| Backend Health | 3 colored dots: Node (green/red), Python (green/red), Rust (green/red) — click opens diagnostics |
| Coordinate Input | X/Y/Z input fields for precise node placement |
| Selection Info | Count of selected nodes/members |
| Grid/Snap Status | Grid on/off, snap on/off indicators |
| Load Case | Current active load case name |

---

## 7. INSPECTORPANEL (RIGHT SIDEBAR)

### Embedded in ModernModeler.tsx (InspectorPanel sub-component, ~280px wide)
- **PURPOSE:** Context-aware properties panel showing details of selected elements.
- **LAYOUT:** Right side, `w-[280px]`, collapsible with toggle button.
- **CONTENT:** `<PropertiesPanel>` component (from `./PropertiesPanel`).
- **BEHAVIOR:** Shows properties of currently selected node/member/plate. Collapses to thin strip when toggled.

---

## 8. STRUCTURE WIZARD

### StructureWizard.tsx (1,186 lines)
- **PURPOSE:** Parametric structure generator for common structural configurations.
- **LAYOUT:** Dialog (`max-w-[720px] max-h-[90vh]`), Radix Dialog component.
- **HEADER:** Sparkles icon + "Structure Wizard" title + "Choose a template, configure and generate" description.

#### Category Tabs (3):
| Category | Icon | Color | Templates |
|---|---|---|---|
| Beams | Ruler | text-emerald-400 | 6 templates |
| Trusses | Triangle | text-amber-400 | 2 templates |
| Frames | Building2 | text-blue-400 | 3 templates |

#### Templates (11 total):
| ID | Name | Category | Parameters |
|---|---|---|---|
| `ss_beam` | Simply Supported Beam | beam | Span (1-30m, default 6), UDL (0-100 kN/m, default 10) |
| `cantilever` | Cantilever Beam | beam | Length (1-20m, default 4), Tip Load (0-200 kN, default 20) |
| `fixed_beam` | Fixed Beam | beam | Span (1-30m, default 6), UDL (0-100 kN/m, default 10) |
| `propped_cantilever` | Propped Cantilever | beam | Span (1-30m, default 6), UDL (0-100 kN/m, default 10) |
| `overhanging` | Overhanging Beam | beam | Main Span (2-20m, default 6), Overhang (0.5-8m, default 2), UDL (0-100 kN/m, default 10) |
| `continuous` | Continuous Beam | beam | Span/bay (2-15m, default 5), Spans (2-6, default 3), UDL (0-100 kN/m, default 10) |
| `truss` | Warren Truss | truss | Span (6-60m, default 24), Height (1-10m, default 4), Panels (4-16, default 6), Top chord UDL (0-50 kN/m, default 5) |
| `pratt_truss` | Pratt Truss | truss | Span (6-60m, default 24), Height (1-10m, default 4), Panels (4-16, default 6), Top chord UDL (0-50 kN/m, default 5) |
| `portal` | Portal Frame | frame | Span (6-40m, default 15), Ridge Height (4-15m, default 8), Roof Load (0-30 kN/m, default 5) |
| `building` | Multi-Story Frame | frame | Stories (1-15, default 3), Bays X (1-8, default 2), Bays Y (0-6, 0=2D, default 0), Story Height (2.5-5m, default 3.5), Bay Width (3-10m, default 6), Floor Load (0-20 kN/m², default 5) |
| `braced_frame` | Braced Frame | frame | Stories (1-10, default 3), Bays (1-6, default 2), Story Height (2.5-5m, default 3.5), Bay Width (3-10m, default 6), Floor UDL (0-50 kN/m, default 10) |

#### Default Section Properties (hardcoded):
- Beams: ISMB300 (E=200e6, A=0.00587, I=0.0000867, Iy=4.53e-6, J=19.7e-8 m⁴)
- Columns: ISHB300 (E=200e6, A=0.00749, I=0.000130, Iy=4.49e-6 m⁴)
- Braces: ISA150×150×20 (E=200e6, A=0.00569 m²)
- Truss chords: CHS168.3×6.3 (E=200e6, A=0.00321, I=6.13e-6 m⁴)

#### SVG Preview:
- Live SVG rendering (400×200 viewBox) showing:
  - Member lines (color-coded: green=beam, blue=column, amber=brace)
  - Node dots (orange for supports, grey for free)
  - Support symbols (triangle for pin/roller, rectangle for fixed)
  - UDL arrows (red) with connecting lines
  - Nodal load arrows (red, directional)
- Auto-scales and centers the structure preview.

#### Stats Grid (5 columns):
| Stat | Display |
|---|---|
| Nodes | Count |
| Members | Count |
| Supports | Count |
| Loads | Count |
| Total Load | Sum in kN |

#### Footer Buttons:
- Cancel (variant=outline)
- "Generate and Load" (Sparkles icon, emerald-to-blue gradient, disabled if no preview)

---

## 9. ANALYSIS ENGINE & PROGRESS

### AnalysisProgressModal.tsx (254 lines)
- **PURPOSE:** Overlay modal showing real-time analysis progress.
- **LAYOUT:** Radix Dialog, centered fullscreen overlay.

#### Analysis Stages:
| Stage | Label | Progress | Icon |
|---|---|---|---|
| validating | Validating Model | 10% | CheckCircle |
| assembling | Assembling Stiffness | 30% | Cpu |
| solving | Solving System | 70% | Activity |
| computing | Computing Results | 90% | BarChart |
| complete | Analysis Complete | 100% | CheckCircle (green) |
| error | Analysis Failed | — | AlertCircle (red) |

#### UI Elements:
- Gradient progress bar (blue-500 to indigo-500, animated shimmer)
- Stage list with check/spinner/circle icons
- Cancel button (triggers `AbortController.abort()`)
- Stats grid on completion: Nodes, Members, DOF, Time (ms)
- Error display with red styling when failed

### AnalysisWorkflow.tsx (248 lines)
- **PURPOSE:** 5-step horizontal workflow stepper for analysis pipeline.
- **STEPS:** Geometry → Supports → Loads → Analyze → Results
- **COLORS:** Each step color-coded (blue, yellow, orange, green, purple)
- **VALIDATION:** Each step checks prerequisite conditions before proceeding
- **BUTTONS:** "Run Analysis" at final step

### ValidationDialog.tsx (217 lines)
- **PURPOSE:** Pre-analysis validation dialog showing structural errors/warnings.
- **SECTIONS:**
  - Critical errors (red): Block analysis
  - Regular errors (red): Show details
  - Warnings (yellow): Informational
  - Quick Fixes guide (blue): Unstable, zero-length, disconnected, mechanism tips
- **BUTTONS:** Close, Auto-Fix (calls `autoFixModel()`), Proceed Anyway (only if no critical errors)
- **AUTO-FIX:** Shows green success card listing what was fixed, then revalidates

---

## 10. RESULTS SYSTEM

### results/ subdirectory (19 files, ~17,167 lines total)

#### ResultsToolbar.tsx (1,686 lines)
- **PURPOSE:** Floating post-analysis results toolbar with toggle buttons.
- **TOGGLE BUTTONS:** Deflected Shape, BMD (Mz), SFD (Vy), BMD_My, SFD_Vz, Reactions, Axial, Heatmap
- **CONTROLS:** Scale slider for diagram visualization, animation controls (play/pause/reset)
- **QUICK ACCESS:** Advanced Analysis button, Design button
- **SUB-PANELS:** Opens AnalysisResultsDashboard, MemberDetailPanel, PostProcessingDesignStudio in dialogs

#### ResultsTableDock.tsx (642 lines)
- **PURPOSE:** Docked bottom panel for analysis results tables.
- **LAYOUT:** Bottom of viewport, collapsible (chevron up/down), maximizable.
- **TABS (3):**
  | Tab | Columns |
  |---|---|
  | Displacements | Node, δx(m), δy(m), δz(m), θx(rad), θy(rad), θz(rad) |
  | Member Forces | Member, Fx(kN), Fy(kN), Fz(kN), Mx(kN·m), My(kN·m), Mz(kN·m) |
  | Reactions | Node, Rx(kN), Ry(kN), Rz(kN), MRx(kN·m), MRy(kN·m), MRz(kN·m) |
- **FEATURES:** Column sorting (asc/desc), text filter by ID, CSV export, equilibrium check indicator (pass/fail)
- **NUMBER FORMAT:** 4 decimal places, values < 1e-10 shown as "0.0000"

#### AnalysisResultsDashboard.tsx (4,076 lines)
- **PURPOSE:** Comprehensive results visualization hub.
- **VIEW MODES (8):** Overview, Force Diagrams, Heat Map, Reactions, D/C Summary, Stability, Load Combos, Detailed
- **DIAGRAM TYPES:** SFD, BMD, AFD, DEFLECTION, BMD_MY, SFD_VZ
- **FEATURES:** Summary cards, interactive diagrams, heat maps, deflected shape, reactions display, export (PDF/Excel/JSON)
- **DEFLECTION LIMITS:** L/240 (floor), L/180 (roof), L/120 (cantilever), L/360 (sensitive finishes)
- **LOAD COMBINATIONS:** IS, ASCE, EC combinations from LoadCombinationsService

#### ResultsTable.tsx (361 lines — root component)
- **PURPOSE:** Virtualized TanStack Table for results data.
- **TABS:** Displacements, Reactions, Forces
- **FEATURES:** Column sorting, CSV export, 35px row height virtualization via `@tanstack/react-virtual`

#### Other Results Components:
| Component | Lines | Purpose |
|---|---|---|
| PostProcessingDesignStudio | 2,466 | Full design studio with D/C ratios and code checks |
| EnhancedDiagramViewer | 885 | Interactive SFD/BMD/AFD diagram viewer |
| ResultsVisualization | 828 | 3D results visualization on model |
| StressContourRenderer | 806 | 3D stress contour rendering on elements |
| ResultsControlPanel | 795 | Results display controls and settings |
| EnhancedHeatMap | 634 | Color-mapped stress/displacement heat map |
| DiagramOverlay | 608 | Force diagram overlay on 3D model |
| StressOverlay | 590 | Stress color overlay on members |
| AnimatedDeflection | 575 | Animated deflected shape playback |
| MemberDetailPanel | 527 | Detailed single-member force display |
| ModeShapeRenderer | 405 | Modal analysis mode shape animation |
| ResultsViewportOverlay | 401 | Results info overlay on viewport |
| ResultsSplitView | 259 | Split-screen: model + results side-by-side |
| DiagramRenderer | 346 | Three.js 3D force/moment diagram lines (root) |

---

## 11. DESIGN PANELS

### SteelDesignPanel.tsx (608 lines)
- **PURPOSE:** IS 800:2007 / AISC 360-16 steel member design check.
- **TABS/SECTIONS:**
  - Design Code selector: IS 800:2007, AISC 360-16
  - Steel Grade selector: Fe250/E250, Fe345/E345, Fe410/E410, Fe450/E450
  - Section Library: 18 Indian standard sections (ISMB100-600, ISMC75-400, ISA50-150)
  - Section Classification: Class 1 (Plastic), 2 (Compact), 3 (Semi-compact), 4 (Slender)
  - 5 Design Checks with utilization bars:
    | Check | Description |
    |---|---|
    | Tension | Td = Ag × fy / γm0 |
    | Compression | Pd via column buckling curves |
    | Bending | Md via lateral-torsional buckling |
    | Shear | Vd = Av × fy / (√3 × γm0) |
    | Combined | Interaction checks |
  - Utilization bar colors: green (<60%), lime (60-75%), yellow (75-85%), orange (85-100%), red (>100%)

### IS456DesignPanel.tsx (482 lines)
- **PURPOSE:** IS 456:2000 concrete design with smart optimization.
- **DEFAULTS:** M25 concrete (fck=25 MPa), Fe500 rebar (fy=500 MPa)
- **FEATURES:**
  - Smart Optimize toggle (self-learning via `useSmartDesign` hook)
  - Extra FoS slider (1.0-2.0)
  - Knowledge base cache stats display
  - Pro feature gating with Crown icon
- **RESULTS:** Summary grid (Total/Passing/Warnings/Failing), expandable member cards with demand/capacity/ratio

### DetailedDesignPanel.tsx (1,429 lines)
- **PURPOSE:** Comprehensive section design for RC Beam, RC Slab, RC Column, and Steel sections.
- **TABS (4):** RC Beam, RC Slab, RC Column, Steel

#### RC Beam Design:
- **Inputs:** Width b (150-1000mm), Depth d (200-1500mm), Cover (25-75mm), Span (1-20m), fck (M15-M80), fy (Fe250-Fe550), Mu (0-5000 kN·m), Vu (0-2000 kN)
- **Results:** Flexural design (Ast, bar count/size/spacing), Shear design (Vus, stirrup spacing), Deflection check (L/span, αe), Crack width check
- **SVG:** Cross-section sketch with reinforcement bars

#### RC Slab Design:
- **Inputs:** Lx (1-15m), Ly (1-15m), Thickness (100-400mm), Cover (15-50mm), Live load (1-25 kN/m²), fck, fy
- **Results:** Slab type (One-way/Two-way), Moment coefficients (αx/αy), Ast per direction, distribution steel, deflection check

#### RC Column Design:
- **Inputs:** Width (200-1500mm), Depth (200-1500mm), Length (2-30m), Pu (0-30000 kN), Mux (kN·m), Muy, fck, fy
- **Results:** Classification (Short/Slender), Steel design (pt%, Ast, bar layout), Biaxial check (IS 456 Cl. 39.6), Interaction diagram SVG, Detailing notes

#### Steel Section Design:
- **Inputs:** Depth d, Width bf, Web tw, Flange tf, fy (230-550 MPa), fu (350-700 MPa), Length, Lb (unbraced), Cb (gradient factor 1.0-2.5), K (effective length 0.5-2.5), Pu (kN), Mu (kN·m), Vu (kN), Code (IS800/AISC360)
- **Results:** Section Classification (Class 1-4), Capacities (Td, Pd, Md, Vd), LTB check (Mcr, λLT, χLT), Interaction check, Web bearing/buckling, Stiffener requirements, Connection force demands

### design/ subdirectory (7 files, ~4,000 lines):
| Component | Lines | Purpose |
|---|---|---|
| EnhancedBeamDesignDialog | 1,171 | Advanced beam design with optimization |
| EnhancedSlabDesignDialog | 1,068 | Advanced slab design with two-way analysis |
| EnhancedColumnDesignDialog | 932 | Advanced column design with biaxial checks |
| DesignCodeResultsPanel | 261 | Design code compliance results display |
| ConnectionDesignPanel | 216 | Bolt/weld connection design |
| RCDesignPanel | 185 | Quick RC design panel |
| FoundationDesignPanel | 166 | Foundation design interface |

---

## 12. LOAD DIALOGS & GENERATORS

### DeadLoadGenerator.tsx (317 lines)
- **PURPOSE:** Automatic dead load application from self-weight and floor loads.
- **INPUTS:**
  | Field | Type | Default | Description |
  |---|---|---|---|
  | Include Self-Weight | Checkbox | true | Calculate from section area × 7850 kg/m³ |
  | Floor Load | Number | 2.0 kN/m² | Uniform floor load on horizontal members |
  | Apply to Selection | Checkbox | false | Only visible when elements are selected |
- **PRESETS:** Residential (2.0), Office (4.0), Retail (5.0), None (0)
- **OUTPUT:** UDL member loads in `global_y` direction (negative = downward)
- **FOOTER:** Cancel, "Generate Dead Loads" (amber-600)

### MeshingPanel.tsx (470 lines)
- **PURPOSE:** FEA mesh generation for plate/shell elements.
- **MESH TYPES:** Plate (Quad NxM grid), Triangulate (Delaunay)
- **INPUTS:**
  | Field | Range | Default |
  |---|---|---|
  | Divisions X | 1-20 | 4 |
  | Divisions Y | 1-20 | 4 |
  | Snap to existing nodes | checkbox | true |
  | Use Python backend | checkbox | true |
- **API:** POST `/mesh/plate` and `/mesh/triangulate` with fallback to local `MesherService`
- **GENERATED ELEMENTS:** QUAD4 plates (E=25e6 kPa, thickness=0.15m, ν=0.2)

### TimeHistoryPanel.tsx (549 lines)
- **PURPOSE:** Dynamic time history analysis.
- **EARTHQUAKE RECORDS (8):**
  | Record | PGA | Notes |
  |---|---|---|
  | El Centro 1940 | 0.319g | Imperial Valley |
  | Bhuj 2001 | 0.106g | Gujarat, India |
  | Northridge 1994 | 0.568g | California |
  | Kobe 1995 | 0.611g | Japan |
  | Chi-Chi 1999 | 0.364g | Taiwan |
  | Loma Prieta 1989 | 0.367g | San Francisco |
  | Christchurch 2011 | 0.8g | New Zealand |
  | Nepal 2015 | 0.164g | Gorkha |
- **STRUCTURE TYPES (8):** Steel MRF (ζ=2%), RC MRF (5%), Shear Wall (4%), Braced (3%), Masonry (5%), Timber (4%), Base Isolated (10%), Composite (3%)
- **INPUTS:**
  | Field | Options/Range |
  |---|---|
  | Earthquake Record | 8 dropdown options |
  | Structure Type | 8 dropdown options |
  | Scale Factor | 0.1-5.0, default 1.0 |
  | Damping Ratio | Auto from structure type |
  | Time Step | 0.005/0.01/0.02s |
  | Number of Modes | 1-20, default 5 |
  | Method | Newmark-β (γ=0.5, β=0.25) / Modal Superposition (CQC) |
- **API:** POST `${PYTHON_API}/analyze/time-history`
- **RESULTS:** SVG displacement time history chart, response spectrum, JSON download

### BucklingAnalysisPanel.tsx (499 lines)
- **PURPOSE:** Linear buckling eigenvalue analysis.
- **INPUTS:** Number of modes (1-20)
- **REFERENCE TABLE:** Effective length factors (K):
  | Condition | K |
  |---|---|
  | Fixed-Fixed | 0.5 |
  | Fixed-Pinned | 0.7 |
  | Pinned-Pinned | 1.0 |
  | Fixed-Free | 2.0 |
  | Fixed-Guided | 1.0 |
  | Partial restraint | 0.8-1.2 |
- **EULER CALCULATOR:** Inputs L, E, I, K → Computes Pcr = π²EI/(KL)²
- **RESULTS:** Stability indicator (Stable/Marginal/Unstable), mode cards with λ factor, critical load, visualization button
- **SOLVER:** WASM `analyzeBuckling`, PRO feature gating

### PDeltaAnalysisPanel.tsx (482 lines)
- **PURPOSE:** P-Delta geometric nonlinear (second-order) analysis.
- **INPUTS:** Max Iterations (5-100, default 20), Tolerance (1e-3 to 1e-6)
- **RESULTS:** Convergence chart (SVG, log-scale), amplification factor (safe/warning/critical per IS 800 Cl.4.4.2), comparison bars (1st vs 2nd order displacement/moment)
- **CODE REFS:** IS 800 Cl.4.4.2, AISC 360 App. 8

### ModalAnalysisPanel.tsx (466 lines)
- **PURPOSE:** Eigenvalue modal analysis.
- **INPUTS:** Number of modes (1-50)
- **VIEW MODES:** Cards, Table
- **MODE CARDS:** Frequency (Hz), Period (s), participation factors (X/Y/Z %), effective mass
- **TABLE:** Mode/Freq/Period/Action columns with animate button per mode (play/pause)
- **CUMULATIVE MASS CHART:** SVG bar chart showing cumulative effective mass percentage
- **PRO FEATURE** gating

---

## 13. SELECTION & GEOMETRY TOOLS

### SelectionToolbar.tsx (637 lines)
- **PURPOSE:** Advanced element selection dialog.
- **LAYOUT:** Dialog (`max-w-2xl`), 4 tabs.
- **TABS:**
  | Tab | Method | Examples |
  |---|---|---|
  | By ID | Parse ranges | "N1-N10,N15,M1-M5" |
  | By Level | Y-coordinate + tolerance | Quick-pick level buttons |
  | Parallel | X/Y/Z axis filter | For beams/columns |
  | Property | sectionId/sectionType filter | By section assignment |
- **QUICK ACTIONS:** Select All, Clear Selection, Invert Selection
- **OPTIONS:** Add-to-selection mode checkbox
- **FOOTER:** Selection counts (nodes/members/plates)

### GeometryToolsPanel.tsx (461 lines)
- **PURPOSE:** Geometry manipulation tools.
- **LAYOUT:** Dialog (`max-w-2xl`).
- **COORD SYSTEM:** Toggle Cartesian / Cylindrical
- **TOOLS (5):**
  | Tool | Inputs |
  |---|---|
  | Extrude | Axis (X/Y/Z), Spacing, Steps, Link members |
  | Rotate Copy | Axis, Angle, Copies, Center point (x/y/z) |
  | Mirror | Plane (XY/YZ/XZ) |
  | Split Member | Ratio slider (10-90%) |
  | Renumber | Scope (Nodes/Members/Both), Spatial sort (Y→Z→X) |
- **ENGINE:** Uses `extrudeGeometry`, `rotateCopy`, `mirror` from geometry engine

---

## 14. AI & CHAT COMPONENTS

### ai/ subdirectory (25 files, ~9,776 lines)

#### ChatPanel.tsx (608 lines — root component)
- **PURPOSE:** AI Engineering Copilot chat panel.
- **LAYOUT:** Right-side sliding panel (w-[380px]), dark background.
- **API:** POST `/api/ai/diagnose` (with model analysis data) and POST `/api/ai/chat`
- **FEATURES:** Message history, fix suggestions with pros/cons/implementation/priority, expandable cards, fallback to local mock responses
- **INPUT:** Text area with send button, markdown rendering of responses

#### Key AI Components:
| Component | Lines | Purpose |
|---|---|---|
| AIArchitectPanel | 1,683 | Full-featured AI sidebar with Generate/Modify/Chat modes |
| AutonomousAIAgent | 1,167 | Self-directed AI agent that can modify the model autonomously |
| PowerAIPanel | 883 | High-performance AI interface |
| AdvancedAIBrain | 617 | AI reasoning engine UI |
| AIAssistantChat | 602 | Alternative AI chat interface |
| GenerativeDesignPanel | 596 | AI topology optimization / generative design |
| AISessionHistoryPanel | 431 | AI conversation history browser |
| AICommandCenter | 416 | AI command dispatch center |
| AIDesignWizard | 396 | AI-guided structural design |
| AIPowerDashboard | 386 | AI capabilities dashboard |
| ValidationDashboard | 352 | AI-powered design validation |
| FeedbackPanel | 347 | User feedback for AI responses |
| CodeCompliancePanel | 343 | AI code compliance checker |
| ConnectedValidationDashboard | 337 | Real-time validation with AI |
| AuditTrailViewer | 282 | Design change audit trail |
| MobileAIPanel | 280 | Mobile-optimized AI chat |
| SelfImprovementDashboard | 227 | AI self-improvement metrics |
| SketchUploadPanel | 223 | Upload hand-drawn sketches for AI analysis |
| VoiceInputButton | 208 | Voice-to-text for AI commands |

---

## 15. CONTEXT MENU & QUICK COMMANDS

### ContextMenu.tsx (428 lines)
- **PURPOSE:** Right-click context menu rendered via `createPortal`.
- **HOOK:** `useContextMenu()` — manages position, visibility, items.
- **3 CONTEXT TYPES:**

  **Node Context:**
  | Item | Icon | Shortcut |
  |---|---|---|
  | Edit Coordinates | Pencil | — |
  | Add Beam From Here | Spline | — |
  | Assign Support | Anchor | — |
  | Assign Load | ArrowDown | — |
  | Merge Nodes | Merge | (only when 2+ nodes selected) |
  | Delete | Trash2 | Del |

  **Member Context:**
  | Item | Icon | Shortcut |
  |---|---|---|
  | Edit Properties | Pencil | — |
  | Assign Section | Layers | — |
  | Assign Material | Database | — |
  | Member Releases | Link2 | — |
  | Insert Node | Plus | — |
  | Split Member | Scissors | — |
  | Specifications | Settings | — |
  | Add Load | ArrowDown | — |
  | Delete | Trash2 | Del |

  **Empty Context (clicked on empty space):**
  | Item | Icon |
  |---|---|
  | Add Node Here | Plus |
  | Paste | Clipboard |
  | Fit View | Maximize2 |
  | View Options (submenu) | Eye |

### QuickCommandsToolbar.tsx (367 lines)
- **PURPOSE:** Spacebar-activated floating command palette.
- **HOOK:** `useQuickCommands()` — keyboard listener for Space key.
- **COMMAND GROUPS:**
  | Group | Commands |
  |---|---|
  | Geometry | Add Node, Add Beam |
  | Properties | Assign Section, Assign Support |
  | Loading | Add Load |
  | Analysis | Run Analysis |
  | View | Fit View, Toggle Grid |
  | Tools | Select, Move |
- **NAVIGATION:** Arrow keys, Enter to execute, Escape to close, 1-9 number shortcuts.

### CommandPalette.tsx (632 lines)
- **PURPOSE:** Global command palette (Cmd+K).
- **~25 COMMANDS acros categories:**
  | Category | Commands |
  |---|---|
  | Quick Actions | New Project, Open, Save, Import, Export |
  | Modeling | Add Node, Add Member, Structure Wizard |
  | Properties | Section Library, Material, Supports |
  | Loading | Nodal Load, UDL, IS 875, Dead Load |
  | Analysis | Run Analysis, Modal Analysis, P-Delta, Buckling |
  | Design | Steel Design, Concrete Design, Foundation |
- **FEATURES:** Fuzzy search, keyboard navigation (up/down/enter/escape), PRO badges, category filtering.

---

## 16. MODALS & DIALOGS (GLOBAL)

### QuickStartModal.tsx (285 lines)
- **PURPOSE:** First-time user welcome screen.
- **LAYOUT:** Dialog (`max-w-2xl`), centered.
- **QUICK ACTIONS (6):**
  | Action | Icon | Border Color |
  |---|---|---|
  | New Project | Plus | blue on hover |
  | Resume Last / Open File | RotateCcw / FileText | green |
  | Tutorial | Play | purple |
  | Structure Wizard | Building2 | orange |
  | Foundation Design | Layers | amber |
  | IS 875 Loads | Weight | cyan |
- **SAMPLE STRUCTURES:** Grid of pre-built templates from `ALL_SAMPLES`, single-click select, double-click load.
- **FOOTER:** Template name + stats + "Load Template" button.

### DemoModelsPanel.tsx (302 lines)
- **PURPOSE:** Demo model library (STAAD.Pro-style).
- **LAYOUT:** Dialog (`max-w-6xl`).
- **TABS (6):** All Models, Frames, Trusses, Bridges, Towers, Buildings
- **CARD FIELDS:** Name, difficulty badge (beginner/intermediate/advanced/expert with green/blue/orange/red colors), description, real-world structure, location, year built, height, span, designer, learning objectives.
- **DETAIL VIEW:** Nested dialog with full metadata grid, learning objectives list, model stats (Nodes/Members/Difficulty).
- **BUTTON:** "Load Model" per card.

### BackendHealthDashboard.tsx (290 lines)
- **PURPOSE:** Real-time monitoring of all backend services.
- **3 SERVICE CARDS:**
  | Service | URL |
  |---|---|
  | Node.js API | API_CONFIG.baseUrl |
  | Python API | API_CONFIG.pythonUrl |
  | Rust Engine | API_CONFIG.rustUrl |
- **PER CARD:** Status (online/offline/degraded/checking with colored dots), Latency (green <200ms, yellow <1000ms, red >1000ms), Version, Error messages.
- **JOB QUEUE METRICS:** Queued, Running, Completed, Failed (from Rust API).
- **AUTO-REFRESH:** Toggle, 30-second interval. "Refresh Now" button.
- **ENDPOINT CONFIG:** Shows all URLs with status icons.

### dialogs/ subdirectory (7 files, ~2,482 lines):
| Component | Lines | Purpose |
|---|---|---|
| EnhancedFoundationDesignDialog | 1,254 | Foundation design (Isolated, Combined, Pile) |
| FloorSlabDialog | 329 | Auto-detect floor panels & create slabs |
| PlateCreationDialog | 258 | Create plate/shell elements manually |
| SteelDesignDialog | 213 | Steel design wrapper dialog |
| CivilEngineeringDialog | 177 | Civil engineering hub wrapper |
| ConcreteDesignDialog | 165 | Concrete design wrapper dialog |
| ConnectionDesignDialog | 86 | Connection design wrapper |

---

## 17. VIEWER / 3D RENDERING

### viewer/ subdirectory (17 files, ~5,756 lines):
| Component | Lines | Purpose |
|---|---|---|
| StructuralMesh | 723 | Main structural model mesh (nodes + members + plates as 3D geometry) |
| LoadPlacementLayer | 594 | 3D visualization of loads (arrows, UDL diagrams, moments) |
| ConnectionVisualizer | 487 | Visualize member-to-member connections |
| StructuralCanvas | 479 | Canvas setup with lighting, grid helpers, axis helpers |
| UltraLightMembersRenderer | 424 | Performance-optimized member rendering using instanced geometry |
| InteractionLayer | 418 | Mouse interaction layer (click, hover, drag on 3D elements) |
| UltraLightNodesRenderer | 411 | Performance-optimized node rendering using instanced spheres |
| InstancedMembersRenderer | 347 | GPU-instanced member cylinders for large models |
| CameraFitController | 328 | Auto-fit camera to model bounds, responds to `fit-view` events |
| SafeCanvasWrapper | 316 | Error boundary wrapper for R3F Canvas |
| InstancedNodesRenderer | 285 | GPU-instanced node spheres for large models |
| ViewCube | 236 | 3D orientation cube (like AutoCAD ViewCube) |
| PlateRenderer | 216 | Render plate/shell elements as 3D surfaces |
| Overlays | 199 | Node labels, member labels, dimension annotations |
| WgpuCanvas | 189 | WebGPU rendering canvas (experimental) |
| StatusBar | 104 | Viewer-specific status indicator |

### Root-level viewer components:
| Component | Lines | Purpose |
|---|---|---|
| MembersRenderer | 386 | Default member rendering (line/cylinder geometry) |
| NodesRenderer | 201 | Default node rendering (sphere geometry) |
| LoadRenderer | 144 | Default load arrow rendering |
| SupportRenderer | 116 | Support symbol rendering (pin triangles, fixed hatching, roller circles) |
| MemberLoadRenderer | 291 | UDL/point load visualization on members |
| ModelRenderer | 71 | Top-level model scene composition |
| PlateResultsVisualization | 83 | Plate stress/displacement visualization |

---

## 18. ENHANCED / ADVANCED COMPONENTS

### enhanced/ subdirectory (10 files, ~9,066 lines):
| Component | Lines | Purpose |
|---|---|---|
| InteractiveResultsDashboard | 1,375 | Advanced interactive results with filtering/sorting/export |
| UltraModernDesignStudio | 1,165 | Complete design studio combining all design codes |
| AdvancedMemberDesignWizard | 1,146 | Step-by-step member design with auto-optimization |
| Advanced3DStructuralViewer | 1,132 | Enhanced 3D viewer with measurement tools |
| RealTimeAnalysisPanel | 966 | Live analysis feedback during modeling |
| SeismicDesignStudio | 855 | Seismic design per IS 1893 / ASCE 7 / EC8 |
| AdvancedReportGenerator | 844 | PDF/Word report generation with templates |
| ModernLoadCombinator | 827 | Load combination generator with code presets |
| AIDesignAssistant | 756 | AI-assisted design optimization |

### parametric/ subdirectory (5 files, ~790 lines):
| Component | Lines | Purpose |
|---|---|---|
| VisualScriptingEditor | 423 | Node-based visual programming for parametric design |
| FrameRepeaterNode | 130 | Repeating frame pattern node |
| LineConnectorNode | 97 | Line connection node |
| PointGeneratorNode | 84 | Point generation node |
| NumberInputNode | 56 | Number input for visual scripting |

### analysis/ subdirectory (8 files, ~2,636 lines):
| Component | Lines | Purpose |
|---|---|---|
| StructuralAnalysisViewer | 1,078 | Complete analysis visualization workspace |
| ModalAnalysisPanel | 308 | Modal analysis (subdirectory copy) |
| PDeltaAnalysisPanel | 251 | P-Delta analysis (subdirectory copy) |
| CableAnalysisPanel | 226 | Cable/catenary analysis |
| SeismicAnalysisPanel | 222 | Seismic response analysis |
| TimeHistoryPanel | 193 | Time history (subdirectory copy) |
| PINNPanel | 190 | Physics-Informed Neural Network analysis |
| BucklingAnalysisPanel | 168 | Buckling analysis (subdirectory copy) |

---

## 19. CIVIL ENGINEERING HUB

### CivilEngineeringDialog (177 lines in dialogs/)
- **PURPOSE:** Civil engineering design center wrapper.
- **SUBDOMAINS:** Geotechnical, Hydraulics, Transportation, Construction Management
- **ROUTE INTEGRATION:** Links to `/civil/geotech`, `/civil/hydraulics`, `/civil/transport`, `/civil/construction`

---

## 20. DASHBOARD & USER COMPONENTS

### UserDashboard.tsx (328 lines)
- **PURPOSE:** User profile and subscription dashboard.
- **API:** GET `/api/user/profile`
- **SECTIONS:**
  - Tier status: Free / Pro (with Crown icon)
  - Usage limits: Daily Analyses, Max Nodes, Projects
  - Stats cards: Projects count, analyses run, last active
  - Recent activity timeline

### StressVisualization.tsx (536 lines)
- **PURPOSE:** Member stress visualization panel.
- **STRESS TYPES (5):** Von Mises, Max Principal (σ₁), Min Principal (σ₃), Axial (σₓ), Max Shear (τ_max)
- **UI:** Member selector dropdown, statistics grid (Min/Max/Allowable stress, Utilization %), color legend (blue→cyan→green→yellow→red), critical points warning, SVG stress distribution chart.
- **EXPORT:** JSON export, PDF Report (coming soon/disabled).

### ScriptEditor.tsx (381 lines)
- **PURPOSE:** STAAD-format script editor.
- **EDITOR:** Monaco Editor with custom `staad` language tokenizer and `staad-dark` theme.
- **FEATURES:** Syntax highlighting (keywords, commands, numbers, comments), autocomplete snippets, "Run" button that parses via `CommandParser` and executes on model store.
- **LANGUAGE TOKENS:** STAAD, JOINT COORDINATES, MEMBER INCIDENCES, MEMBER PROPERTIES, SUPPORTS, LOADING, PERFORM ANALYSIS, etc.

### IntegratedWorkspace.tsx (311 lines)
- **PURPOSE:** Alternative workspace layout with analysis workflow integration.
- **FEATURES:** Voice control toggle (`beamlab.voice`), collaboration overlay, report generation (`beamlab.reports`), results summary panel (Max Deflection, Utilization, Status).

---

## 21. ROUTING & PAGES

### ~70 page files in pages/ directory
All pages are lazy-loaded via React.lazy() in App.tsx. Key pages include:
- Landing, Pricing, Capabilities, Documentation
- Design pages (Steel, Concrete, Foundation, Connections, Detailing)
- Analysis pages (Modal, Time History, Seismic, Buckling, P-Delta, Pushover, Plate/Shell)
- Civil Engineering pages (Geotech, Hydraulics, Transport, Construction, Surveying, Environmental)
- Enterprise pages (BIM, Collaboration, CAD, Materials, Compliance)

---

## 22. STORES (STATE MANAGEMENT)

### useModelStore (Zustand) — model.ts
- **PURPOSE:** Structural model data state.
- **KEY STATE:** nodes (Map), members (Map), plates (Map), loads (array), memberLoads (array), floorLoads (array), analysisResults, selectedIds (Set), activeTool, showDeflectedShape, showSFD, showBMD, modelSettings
- **ACTIONS:** addNode, addMember, addLoad, addMemberLoad, removeMember, removeNode, clearModel, loadStructure, setTool, deleteSelection, mergeNodes, splitMemberById, autoFixModel, undo, redo (temporal middleware)

### useUIStore (Zustand) — uiStore.ts
- **PURPOSE:** UI state management.
- **KEY STATE:** activeCategory (MODELING/PROPERTIES/LOADING/ANALYSIS/DESIGN/CIVIL), activeStep, modals (Record<string, boolean>), activeOverlay, analysisResults (gate for design)
- **ACTIONS:** setCategory, setActiveStep, openModal, closeModal, setAnalysisResults, setActiveOverlay

---

## 23. COMPLETE FILE INVENTORY

### Root components/ (40+ files):
```
ModernModeler.tsx          3,712 lines
DetailedDesignPanel.tsx    1,429
StructureWizard.tsx        1,186
App.tsx                      896
ViewportManager.tsx          798
DetailedCalculationView.tsx  754
AnalysisDesignPanel.tsx      724
SelectionToolbar.tsx         637
CommandPalette.tsx           632
SteelDesignPanel.tsx         608
ChatPanel.tsx                608
TimeHistoryPanel.tsx         549
StressVisualization.tsx      536
BucklingAnalysisPanel.tsx    499
IS456DesignPanel.tsx         482
PDeltaAnalysisPanel.tsx      482
MeshingPanel.tsx             470
ModalAnalysisPanel.tsx       466
GeometryToolsPanel.tsx       461
ContextMenu.tsx              428
MembersRenderer.tsx          386
ScriptEditor.tsx             381
QuickCommandsToolbar.tsx     367
CarbonHeatmap.tsx            367
ResultsTable.tsx             361
DiagramRenderer.tsx          346
UserDashboard.tsx            328
DeadLoadGenerator.tsx        317
IntegratedWorkspace.tsx      311
DemoModelsPanel.tsx          302
BackendHealthDashboard.tsx   290
MemberLoadRenderer.tsx       291
QuickStartModal.tsx          285
FeatureOverviewPanel.tsx     250
AnalysisWorkflow.tsx         248
AdvancedSelectionPanel.tsx   236
DeterminacyPanel.tsx         222
DynamicsPanel.tsx            218
ValidationDialog.tsx         217
DesignSettingsPanel.tsx      204
NodesRenderer.tsx            201
AnalysisProgressModal.tsx    254
UpgradeModal.tsx             172
CloudProjectManager.tsx      178
MaterialSelector.tsx         163
SelectionPanel.tsx           164
NonLinearAnalysisPanel.tsx   160
ModalControls.tsx            153
LoadRenderer.tsx             144
SupportRenderer.tsx          116
PlateResultsVisualization.tsx 83
ModelRenderer.tsx             71
SelectionTransform.tsx        50
```

### Subdirectory totals:
```
results/                  17,167 lines (19 files)
ai/                        9,776 lines (25 files)
enhanced/                  9,066 lines (10 files)
viewer/                    5,756 lines (17 files)
layout/                    4,095 lines (10 files)
design/                    3,999 lines (7 files)
analysis/                  2,636 lines (8 files)
dialogs/                   2,482 lines (7 files)
structural/                 ~4,000 lines (28 files, engine code)
reporting/                  ~2,000 lines (6 files)
visualization/              ~1,500 lines (6 files)
rc-design/                  ~1,500 lines (6 files)
parametric/                   790 lines (5 files)
dashboard/                    ~800 lines (5 files)
workspace/                    ~600 lines (5 files)
export/                       ~400 lines (3 files)
steel-design/                 ~300 lines (2 files)
onboarding/                   ~300 lines (2 files)
ui/                         ~5,000 lines (70+ primitives)
```

### GRAND TOTAL: ~162,000 lines across 337 .tsx component files

---

## COLOR SYSTEM SUMMARY

| Usage | Light Mode | Dark Mode |
|---|---|---|
| Background | bg-white | bg-slate-950 |
| Text | text-slate-900 | text-white |
| Secondary text | text-slate-500 | text-slate-400 |
| Borders | border-slate-200 | border-slate-700/border-slate-800 |
| Active/Selected | bg-blue-500/10 text-blue-400 | bg-blue-600/15 text-blue-300 |
| Success/Pass | text-green-600 bg-green-50 | text-green-400 bg-green-900/20 |
| Warning | text-yellow-600 bg-yellow-50 | text-yellow-400 bg-yellow-900/20 |
| Error/Fail | text-red-600 bg-red-50 | text-red-400 bg-red-900/20 |
| Pro/Premium | text-amber-400 | text-amber-400 |
| Gradient accents | from-blue-500 to-indigo-600 | from-blue-500 to-indigo-600 |
| Sidebar | bg-slate-50 | bg-gradient-to-b from-slate-900 to-slate-950 |
| Ribbon | bg-white/98 | bg-slate-900/98 |
| Viewport canvas | from-slate-100 to-slate-200 | from-[#0a0e1a] to-[#0d1320] |
| Utilization <60% | text-green-400 | same |
| Utilization 60-75% | text-lime-400 | same |
| Utilization 75-85% | text-yellow-400 | same |
| Utilization 85-100% | text-orange-400 | same |
| Utilization >100% | text-red-400 | same |
| Force diagrams: Shear | blue lines | same |
| Force diagrams: Moment | orange lines | same |
| Stress legend | blue→cyan→green→yellow→red | same |

---

*END OF COMPREHENSIVE UI AUDIT*
