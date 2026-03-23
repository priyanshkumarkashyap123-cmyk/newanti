# STAAD Phase 3 — Ribbon Deep Inventory (Atomic Coverage)

## Scope completed in this pass

Detailed atomic inventory for the following domains:

- `View` tab
- `Select` tab
- `Specification` tab
- `Loading` tab
- `Analysis and Design` tab
- `Results` tab
- `Postprocessing workflow` context

> This phase focuses on command/dialog/transition granularity and preserves separate shell-level behavior already captured in Phase 2.

## 1) View tab (navigation, visualization, display controls)

### Label controls
- Labels Settings (opens Diagrams -> Labels)
- Node Labels (`Shift+N`)
- Beam Labels (`Shift+B`)
- Plate Labels (`Shift+P`)
- Solid Labels (`Shift+C`)
- Individual node/beam/plate/solid labeling modes

### Zoom and camera controls
- Zoom Window
- Whole Structure
- Zoom In / Zoom Out (scroll wheel)
- Pan
- Zoom Extents
- Zoom Factor (dialog)
- Zoom Previous
- Dynamic Zoom
- Magnifying Glass

### View presets and rotations
- Isometric / Front / Left / Top / Back / Right / Bottom
- Rotate Up/Down/Left/Right (arrow keys)
- Spin Left/Right (`Ctrl+Left`, `Ctrl+Right`)
- Toggle View Rotation Mode
- Orientation dialog (`F4`)
- Always Fit in Current Window (toggle)

### View window management and display options
- Open View / New View / Selected Objects
- View Management: Detach, Add to View, Save View, Rename View
- Display Options (units/graphics display options)
- Set Structure Colors (Color Manager)
- Structural Tooltip Options
- Cascade / Tile Horizontal / Tile Vertical / Structure Only
- Tables dialog
- 3D Rendering (`Ctrl+4`)

## 2) Select tab (selection model and filters)

### Cursor modes
- Nodes / Beam / Plate / Solid cursor
- Geometry cursor (mixed object-type selection)
- Members cursor (physical member grouping behavior)
- Plates & Solids cursor
- Text select mode
- Previous selection recall
- Load edit cursor

### Bulk and relational selection
- All / Inverse / List for geometry classes
- Parallel selectors (global axis/plane)
- Connected selectors (node/beam/plate/solid relation)
- Highlight sequence (Visual Check)

### Entity-scoped selectors
- Node set: All / Inverse / List / Supports
- Beam set: All / Inverse / List / Parallel / Connected
- Plate set: All / Inverse / List / Parallel / Connected
- Solid set: All / Inverse / List / Connected

### Advanced filtering and modes
- Filtered selection cursor (predefined filter params)
- Group selection
- Property-name-based selection
- Missing property selector (QA-focused)
- Drag Box / Drag Line / Region modes

## 3) Specification tab (property, constants, specs, supports)

### Member/section assignment
- Standard and Legacy section galleries
- Prismatic section dialog
- Tapered I section dialog
- User table manager and assign-from-user-table
- Assign profile (member selection/design linkage)
- Plate thickness property assignment

### Material constants
- Young’s modulus
- Shear modulus
- Poisson ratio
- Density
- Thermal coefficient
- Damping ratio

### Node/beam/plate specifications
- Node control/dependent specification add/remove
- Beam specs: beta angle, reference point, cable, compression-only, tension-only, truss, imperfection, cracked property, release, offset, inactive, fireproofing
- Plate specs: plate reference point, release, ignore in-plane rotation, rigid in-plane rotation, plane stress, ignore stiffness

### Supports and section tools
- Fixed / Pinned / Custom / Foundation / One-way spring
- Other supports: Inclined / Multilinear spring / Enforced / Custom enforced
- Section Wizard launcher
- Section Database Manager launcher

## 4) Loading tab (case lifecycle, generators, dynamic definitions)

### Load case and item lifecycle
- Primary load case creation
- Combination load case (result combination semantics)
- Reference load case
- Load items creation

### Automated generators and code helpers
- Vehicle load generator
- Wind load generation (IS 875 Part 3:2015, GB50009:2012)
- Mass model generator
- Primary load type assignment
- Automatic combinations add/edit rules

### Definitions
- Wind definitions
- Direct analysis definitions
- Snow definitions
- Vehicle definitions
- Seismic definitions (country-code set)
- Pushover definitions
- Enclosed zone definition

### Dynamic loading definitions
- Time history forcing function
- Time history parameters
- Modal damping
- Active load selector + View Loading Diagram toggle

## 5) Analysis and Design tab (execution controls + code-selection dialogs)

### Analysis/print command setup
- Analysis commands
- Pre-analysis print commands
- Post-analysis print commands

### Miscellaneous command set
- Input width / Output width
- Floor diaphragm options
- Set NL / Set Echo / Set Z Up
- Set displacement tolerance
- Floor load length/angle tolerances
- Set SDAMP / Set Warp / Set Shear
- Set ITERLIM / Set NoWarning / Set Eigen Method
- Cut Off Mode Shape / Frequency / Time
- Clear Above Commands
- Load List

### Execute and cloud workflow
- Run Analysis (`Ctrl+F5`)
- Run Cloud Analysis
- Download & Load Results
- Download Results To local

### Design code dialogs
- Steel design
- Concrete design
- Aluminium design
- Timber design

## 6) Results tab (diagram, layout, dynamic, annotation, reporting)

### Core result overlays
- Load selector + View Loading Diagram
- Deflection / Displacement
- Utilization Ratio
- Force diagrams: FX/FY/FZ, moments MX/MY/MZ
- Beam Stress / Plate Stress / Solid Stress

### Layout bundles (page-equivalent transitions)
- Displacement
- Reaction
- Instability
- Base Pressure
- Beam Forces
- Beam Stress
- Utilization
- Graphs
- Plate Stress
- Results Along Line
- Solid Stress
- Node Displacement

### Dynamic / pushover / steady-state bundles
- Mode + Mode Shape + Relative Response + Time Steps
- Dynamic layouts: mode shape/displacement/velocity/acceleration/floor spectrum
- Pushover layouts: loads/graphs/node results/beam results
- Steady state: displacement/velocity/acceleration
- Buckling

### Presentation and setup
- Animation
- Select Load Case (Results Setup)
- Structure (Diagrams)
- Scale
- Annotate
- Update Properties (with workflow re-entry implications)

### Reports group
- Node Displacement
- Support Reaction
- Beam Property
- Beam End Forces
- Section Displacement
- Section Forces
- Beam Stresses
- Column Transfer Force
- Plate/Principal Stresses
- Floor Vibration Report

## 7) Postprocessing workflow context

- Workflow purpose: graphical verification, visualization, and custom report generation
- Result domains linked in docs: Nodal, Beam, Plate, Solid, Dynamic, Reports
- Supports reporting paths including tables and graphics export context

## Evidence mapping output

- Command-level atomic rows for this phase are appended to:
  - `docs/research/STAAD_RESEARCH_EVIDENCE_LEDGER.csv`
- New row prefix used:
  - `STAAD-P3-*`

## Notes

- This pass emphasizes command coverage and transition semantics for the six core tabs.
- Additional deep-dive child-dialog internals can be expanded in a Phase 3B if needed (e.g., per-code seismic/wind dialog parameter matrices).
