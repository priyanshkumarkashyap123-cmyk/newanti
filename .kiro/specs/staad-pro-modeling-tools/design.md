# Design Document: STAAD.Pro Modeling Tools Parity

## Overview

This feature brings Beamlab Ultimate's structural modeling workspace to parity with STAAD.Pro's
analytical modeling capabilities across eight work areas:

1. **Tool placement fixes** — wire six existing panel components into the toolbar.
2. **Missing property-assignment tools** — partial releases, tension/compression-only, inactive,
   diaphragm, master/slave, property reduction factors.
3. **Missing load generators** — floor load, area load, snow load.
4. **Missing analysis types** — response spectrum, pushover, steady-state, imperfection analysis.
5. **Post-processing tools** — story drift, force envelopes, section forces at fractions, mode
   shape animation, center of rigidity.
6. **Structure Wizard templates** — Fink, North Light, King Post, Queen Post, Scissors trusses +
   Cylindrical Frame + Spherical Surface.
7. **Built-up section tool** in Section Builder.
8. **Additional design codes** — GB 50017, BS 5950, AIJ, SNiP, CSA A23.3, SP 52-101, IS 13920,
   AASHTO LRFD, US Aluminum, EC5 Timber.

All changes follow the existing ToolGroups → ModernModeler → uiStore → dialog pattern and are
backward-compatible with the current model store schema.

---

## Architecture

### Integration Pattern

All new tools follow the same three-layer wiring pattern already used throughout the codebase:

```
ToolGroups.ts          uiStore.ts             ModernModeler.tsx
─────────────          ──────────             ─────────────────
TOOL_DEFINITIONS  ──►  modals map        ──►  useEffect(activeTool)
  + new tool IDs       + new modal keys        + openModal() calls
                                               + DOM event listeners
                                               + dialog JSX
```

```
┌──────────────────────────────────────────────────────────────────┐
│  ModelingToolbar (reads TOOL_DEFINITIONS + MODELING_TOOL_GROUPS) │
│    └─► setActiveTool(toolId)  ──►  uiStore.activeTool            │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  ModernModeler.tsx                                               │
│    useEffect([activeTool]) ──► openModal(modalName)              │
│    DOM event listeners    ──► openModal(modalName)               │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  uiStore.modals  (Zustand, persisted)                            │
│    modalName: boolean                                            │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  ModalPortal / lazy dialog component                             │
│    reads modals.modalName, renders dialog                        │
└──────────────────────────────────────────────────────────────────┘
```

### Analysis Guard Pattern

Tools that require completed analysis (post-processing, response spectrum, pushover, etc.) use a
shared guard before opening their modal:

```typescript
// In ModernModeler.tsx useEffect([activeTool])
const requiresAnalysis = [
  'PDELTA_ANALYSIS', 'BUCKLING_ANALYSIS', 'TIME_HISTORY_ANALYSIS',
  'NONLINEAR_ANALYSIS', 'DYNAMICS_PANEL', 'PLATE_STRESS_CONTOUR',
  'VIEW_STORY_DRIFT', 'VIEW_FORCE_ENVELOPE', 'VIEW_SECTION_FORCES',
  'ANIMATE_MODE_SHAPE',
];
if (requiresAnalysis.includes(activeTool) && !analysisResults?.completed) {
  showNotification('warning', 'Run analysis first before viewing results.');
  setActiveTool('SELECT');
  return;
}
```

### New Analysis Types Routing

New analysis types (response spectrum, pushover, steady-state, imperfection) are dispatched
through the existing `useAnalysisExecution` hook by extending its `AnalysisType` discriminant
and forwarding to the Python API's `/analysis/advanced` endpoint:

```
ResponseSpectrumDialog ──► dispatchEvent('trigger-response-spectrum', params)
                      ──► useAnalysisExecution.handleAdvancedAnalysis(type, params)
                      ──► POST /api/analysis/advanced { type, params }
                      ──► Python FastAPI ──► solver ──► results stored in modelStore
```

---

## Components and Interfaces

### 1. ToolGroups.ts Additions

New tool IDs to add to `TOOL_DEFINITIONS` and their groups:

**Analysis group additions** (category: `'ANALYSIS'`):
```
PDELTA_ANALYSIS          → group: 'analysis', icon: TrendingUp
BUCKLING_ANALYSIS        → group: 'analysis', icon: Layers
TIME_HISTORY_ANALYSIS    → group: 'analysis', icon: Activity
NONLINEAR_ANALYSIS       → group: 'analysis', icon: Workflow
DYNAMICS_PANEL           → group: 'analysis', icon: Waves
PLATE_STRESS_CONTOUR     → group: 'analysis', icon: Grid
RESPONSE_SPECTRUM_ANALYSIS → group: 'analysis', icon: BarChart2
PUSHOVER_ANALYSIS        → group: 'analysis', icon: TrendingUp
STEADY_STATE_ANALYSIS    → group: 'analysis', icon: Radio
IMPERFECTION_ANALYSIS    → group: 'analysis', icon: AlertTriangle
VIEW_STORY_DRIFT         → group: 'analysis', icon: Building
VIEW_FORCE_ENVELOPE      → group: 'analysis', icon: BarChart
VIEW_SECTION_FORCES      → group: 'analysis', icon: Scissors
ANIMATE_MODE_SHAPE       → group: 'analysis', icon: Play
```

**Properties group additions** (category: `'PROPERTIES'`):
```
ASSIGN_PARTIAL_RELEASE   → group: 'properties', icon: Sliders
ASSIGN_TENSION_ONLY      → group: 'properties', icon: ArrowUp
ASSIGN_COMPRESSION_ONLY  → group: 'properties', icon: ArrowDown
ASSIGN_INACTIVE          → group: 'properties', icon: EyeOff
ASSIGN_DIAPHRAGM         → group: 'properties', icon: LayoutGrid
ASSIGN_MASTER_SLAVE      → group: 'properties', icon: Link2
ASSIGN_PROPERTY_REDUCTION → group: 'properties', icon: Percent
```

**Loading group additions** (category: `'LOADING'`):
```
ADD_FLOOR_LOAD           → group: 'loading', icon: Layers
ADD_AREA_LOAD            → group: 'loading', icon: Square
ADD_SNOW_LOAD            → group: 'loading', icon: Snowflake
```

### 2. uiStore.ts Modal Key Additions

New keys to add to the `modals` object (all default `false`):

```typescript
// Analysis panels (wiring existing components)
pDeltaAnalysisPanel: boolean;
bucklingAnalysisPanel: boolean;
timeHistoryPanel: boolean;
nonLinearAnalysisPanel: boolean;
dynamicsPanel: boolean;
plateResultsVisualization: boolean;
// New analysis dialogs
responseSpectrumDialog: boolean;
pushoverAnalysisDialog: boolean;
steadyStateDialog: boolean;       // already exists in uiStore
imperfectionAnalysisDialog: boolean;
// Post-processing panels
storyDriftPanel: boolean;
forceEnvelopePanel: boolean;
sectionForcesPanel: boolean;
modeShapeAnimationPanel: boolean;
// Property assignment dialogs
partialReleaseDialog: boolean;
inactiveMemberDialog: boolean;
diaphragmAssignmentDialog: boolean;
masterSlaveDialog: boolean;
propertyReductionDialog: boolean;
// Load generator dialogs
floorLoadDialog: boolean;
areaLoadDialog: boolean;
snowLoadDialog: boolean;          // already exists in uiStore
```

### 3. New Dialog Component Interfaces

#### PartialReleaseDialog

```typescript
interface PartialReleaseDOF {
  mode: 'fixed' | 'released' | 'partial';
  factor?: number; // 0.001–0.999, only when mode === 'partial'
}

interface PartialReleaseSpec {
  start: { fx: PartialReleaseDOF; fy: PartialReleaseDOF; fz: PartialReleaseDOF;
           mx: PartialReleaseDOF; my: PartialReleaseDOF; mz: PartialReleaseDOF; };
  end:   { fx: PartialReleaseDOF; fy: PartialReleaseDOF; fz: PartialReleaseDOF;
           mx: PartialReleaseDOF; my: PartialReleaseDOF; mz: PartialReleaseDOF; };
}

interface PartialReleaseDialogProps {
  open: boolean;
  onClose: () => void;
  selectedMemberIds: string[];
  onConfirm: (spec: PartialReleaseSpec) => void;
}
```

#### InactiveMemberDialog

```typescript
interface InactiveMemberSpec {
  scope: 'global' | 'load_cases';
  loadCaseIds?: string[]; // when scope === 'load_cases'
}

interface InactiveMemberDialogProps {
  open: boolean;
  onClose: () => void;
  selectedMemberIds: string[];
  availableLoadCases: { id: string; name: string }[];
  onConfirm: (spec: InactiveMemberSpec) => void;
}
```

#### DiaphragmAssignmentDialog

```typescript
type DiaphragmType = 'rigid' | 'semi-rigid' | 'flexible';
type DiaphragmPlane = 'XY' | 'XZ' | 'YZ';

interface DiaphragmSpec {
  id: string;
  type: DiaphragmType;
  plane: DiaphragmPlane;
  storyLabel: string;
  nodeIds: string[];
}

interface DiaphragmAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  selectedNodeIds: string[];
  onConfirm: (spec: DiaphragmSpec) => void;
}
```

#### MasterSlaveDialog

```typescript
interface MasterSlaveSpec {
  masterNodeId: string;
  slaveNodeIds: string[];
  coupledDOFs: { fx: boolean; fy: boolean; fz: boolean;
                 mx: boolean; my: boolean; mz: boolean; };
}

interface MasterSlaveDialogProps {
  open: boolean;
  onClose: () => void;
  selectedNodeIds: string[];
  onConfirm: (spec: MasterSlaveSpec) => void;
}
```

#### PropertyReductionDialog

```typescript
interface PropertyReductionSpec {
  rax?: number; // axial area factor 0.01–1.00
  rix?: number; // torsional inertia factor
  riy?: number; // weak-axis bending inertia factor
  riz?: number; // strong-axis bending inertia factor
}

interface PropertyReductionDialogProps {
  open: boolean;
  onClose: () => void;
  selectedMemberIds: string[];
  onConfirm: (spec: PropertyReductionSpec) => void;
}
```

#### FloorLoadDialog

```typescript
type FloorDistributionMethod = 'two_way_yield_line' | 'one_way_x' | 'one_way_z';

interface FloorLoadDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (params: {
    boundaryMemberIds: string[];
    pressure: number;           // kN/m²
    method: FloorDistributionMethod;
    loadCaseId: string;
  }) => void;
}
```

#### AreaLoadDialog

```typescript
interface AreaLoadDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (params: {
    memberIds: string[];
    pressure: number;           // kN/m²
    spanDirection: 'X' | 'Z';
    loadCaseId: string;
  }) => void;
}
```

#### SnowLoadDialog

```typescript
type SnowCode = 'ASCE7' | 'IS875_4';

interface SnowLoadParams {
  code: SnowCode;
  // ASCE 7-22
  pg?: number;   // ground snow load (kN/m²)
  Ce?: number;   // exposure factor
  Ct?: number;   // thermal factor
  Is?: number;   // importance factor
  roofSlope?: number; // degrees
  // IS 875 Part 4
  basicSnowLoad?: number;
  shapeCoefficient?: number;
  exposureReduction?: number;
}

interface SnowLoadDialogProps {
  open: boolean;
  onClose: () => void;
  selectedMemberIds: string[];
  onConfirm: (params: SnowLoadParams & { loadCaseId: string }) => void;
}
```

#### ResponseSpectrumDialog

```typescript
type SpectrumCode = 'IS1893' | 'ASCE7' | 'EN1998';
type ModalCombination = 'SRSS' | 'CQC';

interface ResponseSpectrumDialogProps {
  open: boolean;
  onClose: () => void;
  onRun: (params: {
    spectrumCode: SpectrumCode;
    combination: ModalCombination;
    numModes: number;
    scaleX: number; scaleY: number; scaleZ: number;
  }) => void;
}
```

#### StoryDriftPanel, ForceEnvelopePanel, SectionForcesPanel, ModeShapeAnimationPanel

```typescript
interface StoryDriftPanelProps {
  open: boolean;
  onClose: () => void;
  driftLimit?: number; // default 1/400
}

interface ForceEnvelopePanelProps {
  open: boolean;
  onClose: () => void;
  selectedMemberIds: string[];
}

interface SectionForcesPanelProps {
  open: boolean;
  onClose: () => void;
  memberId: string;
  fractions: number[]; // 0.0–1.0, up to 20 values
}

interface ModeShapeAnimationPanelProps {
  open: boolean;
  onClose: () => void;
}
```

---

## Data Models

### Member Type Extensions (`modelTypes.ts`)

The `Member` interface gains the following optional fields:

```typescript
export interface Member {
  // ... existing fields ...

  // Axial behavior (tension-only / compression-only)
  axialBehavior?: 'tension-only' | 'compression-only' | 'normal';

  // Inactive member specification
  inactive?: {
    scope: 'global' | 'load_cases';
    loadCaseIds?: string[];
  };

  // Partial moment releases (extends existing releases)
  partialReleases?: {
    start: {
      fx?: { mode: 'fixed' | 'released' | 'partial'; factor?: number };
      fy?: { mode: 'fixed' | 'released' | 'partial'; factor?: number };
      fz?: { mode: 'fixed' | 'released' | 'partial'; factor?: number };
      mx?: { mode: 'fixed' | 'released' | 'partial'; factor?: number };
      my?: { mode: 'fixed' | 'released' | 'partial'; factor?: number };
      mz?: { mode: 'fixed' | 'released' | 'partial'; factor?: number };
    };
    end: {
      fx?: { mode: 'fixed' | 'released' | 'partial'; factor?: number };
      fy?: { mode: 'fixed' | 'released' | 'partial'; factor?: number };
      fz?: { mode: 'fixed' | 'released' | 'partial'; factor?: number };
      mx?: { mode: 'fixed' | 'released' | 'partial'; factor?: number };
      my?: { mode: 'fixed' | 'released' | 'partial'; factor?: number };
      mz?: { mode: 'fixed' | 'released' | 'partial'; factor?: number };
    };
  };

  // Property reduction factors (cracked section, AISC DAM)
  propertyReductionFactors?: {
    rax?: number; // axial area multiplier (0.01–1.00)
    rix?: number; // torsional inertia multiplier
    riy?: number; // weak-axis bending inertia multiplier
    riz?: number; // strong-axis bending inertia multiplier
  };

  // Diaphragm assignment
  diaphragmId?: string; // references DiaphragmSpec.id
}
```

### Node Type Extensions (`modelTypes.ts`)

```typescript
export interface Node {
  // ... existing fields ...

  // Master/slave constraint
  masterSlaveConstraint?: {
    role: 'master' | 'slave';
    masterNodeId?: string; // set on slave nodes
    coupledDOFs: { fx: boolean; fy: boolean; fz: boolean;
                   mx: boolean; my: boolean; mz: boolean; };
  };
}
```

### New Top-Level Store Collections

Added to `ModelState` in `model.ts`:

```typescript
// Diaphragm definitions
diaphragms: DiaphragmSpec[];
addDiaphragm: (d: DiaphragmSpec) => void;
removeDiaphragm: (id: string) => void;

// Center of rigidity results (computed post-analysis)
centerOfRigidity: Map<string, { x: number; z: number; y: number }>; // diaphragmId → CR coords
```

### Built-Up Section Shape (`modelTypes.ts`)

```typescript
export interface BuiltUpComponent {
  shapeType: SectionType;
  dimensions: SectionDimensions;
  offsetX: number; // centroid offset from reference point (mm)
  offsetY: number;
}

export interface BuiltUpSectionDef {
  id: string;
  name: string;
  components: BuiltUpComponent[];
  // Computed combined properties (mm units for section builder)
  combinedArea?: number;       // mm²
  combinedIxx?: number;        // mm⁴
  combinedIyy?: number;        // mm⁴
  combinedCentroidX?: number;  // mm
  combinedCentroidY?: number;  // mm
}
```

---

## Load Generation Algorithms

### Floor Load — Two-Way Yield-Line Distribution

For a rectangular panel with dimensions `Lx × Lz` and uniform pressure `p` (kN/m²):

The yield-line method divides the panel into triangular and trapezoidal tributary zones. For a
panel with `Lx ≤ Lz` (short span in X direction):

```
α = Lx / (2 × Lz)   (aspect ratio parameter)

Short-side beams (parallel to Z, length Lz):
  w_short = p × Lx / 3   (triangular distribution, peak at midspan)
  Equivalent UDL = p × Lx / 3

Long-side beams (parallel to X, length Lx):
  w_long_end = p × Lx / 6   (trapezoidal, end intensity)
  w_long_mid = p × Lx / 3   (trapezoidal, mid intensity)
  Equivalent UDL = p × Lx × (3 - (Lx/Lz)²) / 6
```

For non-rectangular panels, the algorithm:
1. Computes the centroid of the polygon.
2. Draws yield lines from each corner to the centroid.
3. Assigns the tributary area of each triangular/trapezoidal zone to the adjacent beam.
4. Converts area load to linear UDL: `w_beam = p × tributary_area / beam_length`.

### Area Load — Tributary Width

For one-way distribution in direction D (X or Z):

```
For each beam i with length Li perpendicular to D:
  tributary_width_i = (gap_left_i + gap_right_i) / 2
  where gap = distance to adjacent parallel beam (or panel edge)
  UDL_i = pressure × tributary_width_i   (kN/m)
```

### Snow Load Formulas

**ASCE 7-22 (Section 7.3):**
```
Flat roof snow load:  pf = 0.7 × Ce × Ct × Is × pg
Sloped roof:          ps = Cs × pf
  where Cs = 1.0 for slope ≤ 5°
        Cs = (70° - slope) / 65  for 5° < slope ≤ 70°
        Cs = 0  for slope > 70°
```

**IS 875 Part 4:**
```
Design snow load:  S = μ × S0 × k1
  where S0 = basic ground snow load (kN/m²)
        μ  = shape coefficient (1.0 for flat, 0.8 for pitched)
        k1 = exposure reduction factor (0.8–1.2)
```

---

## Analysis Routing

### New Analysis Types in `useAnalysisExecution`

The hook gains a new `handleAdvancedAnalysis` method:

```typescript
type AdvancedAnalysisType =
  | 'response_spectrum'
  | 'pushover'
  | 'steady_state'
  | 'imperfection';

async function handleAdvancedAnalysis(
  type: AdvancedAnalysisType,
  params: Record<string, unknown>
): Promise<void> {
  setIsAnalyzing(true);
  try {
    const token = await getToken();
    const response = await fetch('/api/analysis/advanced', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, params, model: serializeModel() }),
    });
    const result = await response.json();
    setAnalysisResults({ ...analysisResults, advancedResults: result, completed: true });
  } finally {
    setIsAnalyzing(false);
  }
}
```

### Response Spectrum Analysis Flow

```
1. Check modal results exist (run modal analysis if not)
2. POST /api/analysis/advanced { type: 'response_spectrum', params: { spectrumCode, combination, numModes, scaleX/Y/Z } }
3. Python solver: modal superposition → SRSS or CQC combination
4. Return: { baseshear, storyForces, memberForces, modalParticipation }
5. Store in analysisResults.advancedResults.responseSpectrum
```

### Pushover Analysis Flow

```
1. POST /api/analysis/advanced { type: 'pushover', params: { loadPattern, targetDisp, hingeProps } }
2. Python solver: incremental lateral load application
   - Form plastic hinges at member ends when Mp is reached
   - Track base shear vs. roof displacement
   - Stop at target displacement or mechanism formation
3. Return: { capacityCurve: [{disp, shear}], performancePoint, collapseLoad? }
4. Store in analysisResults.advancedResults.pushover
```

### Imperfection Analysis Flow

```
1. User specifies notional load coefficient α (default 0.002) and stiffness reduction τ (default 0.8)
2. Pre-processing: add notional lateral loads = α × ΣGravity to specified load cases
3. Modify stiffness: EI_eff = τ × EI, EA_eff = τ × EA for all members
4. Run standard static analysis with modified stiffness + notional loads
5. Flag results as 'direct_analysis_method' in analysisResults
```

---

## Structure Wizard Template Geometry

### Fink Truss

A Fink truss has a central vertical, two main rafters, and two sub-diagonals per half-span.
For span `L`, rise `H`, and `n` panels per half (must be even):

```
Bottom chord nodes: x = 0, L/n, 2L/n, ..., L  at y = 0
Top chord nodes:    apex at (L/2, H); intermediate at (L/4, H/2), (3L/4, H/2)
Verticals:          from bottom chord up to top chord at quarter-points
Sub-diagonals:      from bottom quarter-point to top apex (each half)
```

Parametric inputs: `span`, `rise`, `panels` (even integer ≥ 4).

### North Light Truss

Asymmetric truss with a steep north-facing glazing slope and a shallow south slope.
For span `L`, north rise `Hn`, south rise `Hs` (Hn > Hs):

```
Bottom chord: x = 0 to L at y = 0
North rafter: from (0, 0) to (L/3, Hn)  (steep)
South rafter: from (L/3, Hn) to (L, Hs) (shallow)
Verticals:    at x = L/3, 2L/3
Diagonals:    Warren pattern on south half
```

Parametric inputs: `span`, `northRise`, `southRise`, `panels`.

### King Post Truss

Simplest pitched truss: two rafters, one king post, two tie beams.

```
Nodes: N1(0,0), N2(L,0), N3(L/2,H)
Members: M1(N1→N3) rafter, M2(N3→N2) rafter, M3(N1→N2) tie, M4(N3→midpoint of N1N2) king post
```

Parametric inputs: `span`, `rise`.

### Queen Post Truss

Two rafters, two queen posts, one top tie, one bottom tie.

```
Nodes: N1(0,0), N2(L,0), N3(L/3,H), N4(2L/3,H), N5(L/3,0), N6(2L/3,0)
Members: rafters N1→N3, N3→N4, N4→N2; top tie N3→N4; queen posts N3→N5, N4→N6;
         bottom tie N1→N5, N5→N6, N6→N2
```

Parametric inputs: `span`, `rise`.

### Scissors Truss

Two crossing rafters with an internal scissors tie creating a vaulted ceiling effect.

```
Nodes: N1(0,0), N2(L,0), N3(L/2,H), N4(L/4,H/3), N5(3L/4,H/3)
Members: rafters N1→N3, N2→N3; bottom chords N1→N5, N2→N4;
         scissors ties N4→N3, N5→N3; strut N4→N5
```

Parametric inputs: `span`, `rise`, `vaultHeight` (height of scissors intersection).

### Cylindrical Frame

```
For radius R, height H, nBays bays around circumference, nStories stories:

Node at (floor, bay):
  x = R × cos(2π × bay / nBays)
  y = floor × H / nStories
  z = R × sin(2π × bay / nBays)

Members:
  Columns: (floor, bay) → (floor+1, bay)  for all floors, bays
  Circumferential beams: (floor, bay) → (floor, (bay+1) % nBays)  for all floors > 0, bays
  Vertical braces (optional): diagonal members in each bay panel
```

Parametric inputs: `radius`, `height`, `nBays` (≥ 3), `nStories` (≥ 1).

### Spherical Surface

```
For radius R, nMeridional meridional divisions, nParallel parallel divisions:

Node at (i, j):
  φ = π × i / nMeridional          (polar angle, 0 = north pole)
  θ = 2π × j / nParallel           (azimuthal angle)
  x = R × sin(φ) × cos(θ)
  y = R × cos(φ)
  z = R × sin(φ) × sin(θ)

Members:
  Meridional: (i,j) → (i+1,j)  for i < nMeridional
  Parallel:   (i,j) → (i,(j+1)%nParallel)  for i > 0 and i < nMeridional
```

Parametric inputs: `radius`, `nMeridional` (≥ 3), `nParallel` (≥ 3).

---

## Built-Up Section Computation

### Parallel Axis Theorem

For a built-up section with `n` component shapes, each with individual properties
`(A_i, Ixx_i, Iyy_i)` and centroid at `(cx_i, cy_i)` relative to the reference origin:

```
Step 1 — Combined centroid:
  A_total = Σ A_i
  CX = Σ (A_i × cx_i) / A_total
  CY = Σ (A_i × cy_i) / A_total

Step 2 — Combined second moments (parallel axis theorem):
  Ixx_total = Σ (Ixx_i + A_i × (cy_i - CY)²)
  Iyy_total = Σ (Iyy_i + A_i × (cx_i - CX)²)
  Ixy_total = Σ (Ixy_i + A_i × (cx_i - CX) × (cy_i - CY))

Step 3 — Section moduli:
  Zxx = Ixx_total / max(CY, depth - CY)
  Zyy = Iyy_total / max(CX, width - CX)
```

### Overlap Detection

Two component shapes overlap if their axis-aligned bounding boxes intersect AND their actual
polygon outlines intersect. The check uses the Separating Axis Theorem (SAT) on the convex
hulls of each component's outline polygon.

```typescript
function shapesOverlap(a: BuiltUpComponent, b: BuiltUpComponent): boolean {
  const polyA = getOutlinePolygon(a);
  const polyB = getOutlinePolygon(b);
  return !separatingAxisExists(polyA, polyB);
}
```

---

## Design Codes Configuration Additions

New entries to add to `structural-ui.config.ts` `DESIGN_CODES`:

```typescript
// Additional steel codes
steel: {
  // ... existing ...
  'GB50017': { name: 'GB 50017-2017', country: 'China', description: 'Steel Structure Design', beta: false },
  'BS5950':  { name: 'BS 5950-1:2000', country: 'UK', description: 'Structural Steel (Legacy)', beta: false },
  'AIJ':     { name: 'AIJ LSD 2002', country: 'Japan', description: 'Architectural Institute of Japan', beta: true },
  'SNIP':    { name: 'SNiP 2.23-81', country: 'Russia', description: 'Steel Structures', beta: true },
  'AASHTO_LRFD': { name: 'AASHTO LRFD 9th Ed', country: 'USA', description: 'Bridge Steel Design', beta: false },
  'AA_ADM1': { name: 'AA ADM1-2020', country: 'USA', description: 'Aluminum Design Manual', beta: true },
},

// Additional concrete codes
concrete: {
  // ... existing ...
  'CSA_A23': { name: 'CSA A23.3-19', country: 'Canada', description: 'Concrete Structures', beta: false },
  'SP52101': { name: 'SP 52-101-2003', country: 'Russia', description: 'Concrete Structures', beta: true },
  'IS13920': { name: 'IS 13920:2016', country: 'India', description: 'Ductile Detailing (Seismic)', beta: false },
},

// New timber category
timber: {
  'EC5': { name: 'EN 1995-1-1 (EC5)', country: 'Europe', description: 'Eurocode 5 Timber', beta: false },
},
```

Each code entry gains an optional `beta?: boolean` flag. When `beta: true`, the Design Codes
dialog renders a "Beta" badge next to the code name and performs only basic utilization ratio
checks using the code's primary interaction equation.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a
system — essentially, a formal statement about what the system should do. Properties serve as the
bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: All new tool IDs are registered with correct category

*For any* tool ID in the set of 23 new tool IDs defined in this spec, `TOOL_DEFINITIONS[id]`
SHALL exist and `TOOL_DEFINITIONS[id].category` SHALL equal the category specified for that tool
(ANALYSIS, PROPERTIES, or LOADING).

**Validates: Requirements 1.8, 2.1, 3.1, 3.2, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 12.1,
13.1, 14.1, 15.1, 16.1, 17.1, 18.1, 23.1–23.3**

---

### Property 2: No duplicate tool IDs across all groups

*For any* valid `MODELING_TOOL_GROUPS` configuration, collecting all tool IDs from all groups
SHALL produce a list with no duplicate values (i.e., `allIds.length === new Set(allIds).size`).

**Validates: Requirements 23.4**

---

### Property 3: Analysis guard prevents panel opening without results

*For any* tool ID in the set of analysis-result-dependent tools (PDELTA_ANALYSIS,
BUCKLING_ANALYSIS, TIME_HISTORY_ANALYSIS, NONLINEAR_ANALYSIS, DYNAMICS_PANEL,
PLATE_STRESS_CONTOUR, VIEW_STORY_DRIFT, VIEW_FORCE_ENVELOPE, VIEW_SECTION_FORCES,
ANIMATE_MODE_SHAPE), when `analysisResults.completed` is `false`, activating that tool SHALL
NOT set any modal key to `true` in `uiStore.modals`.

**Validates: Requirements 1.7, 15.5, 16.2, 17.2, 18.6**

---

### Property 4: Partial release factor validation

*For any* numeric value `v`, the partial release factor validator SHALL accept `v` if and only if
`0.001 ≤ v ≤ 0.999`. For any `v < 0.001` or `v > 0.999`, the validator SHALL return an error
and the value SHALL NOT be stored on the member.

**Validates: Requirements 2.4, 2.5**

---

### Property 5: Axial behavior mutual exclusion

*For any* member with `axialBehavior = 'tension-only'`, applying `ASSIGN_COMPRESSION_ONLY` SHALL
result in `axialBehavior = 'compression-only'` and SHALL NOT leave the member with both flags
simultaneously.

**Validates: Requirements 3.7**

---

### Property 6: Diaphragm assignment covers all selected nodes

*For any* set of selected node IDs `S` and a confirmed diaphragm spec with `id = D`, after
assignment every node in `S` SHALL have `diaphragmId === D` in the model store.

**Validates: Requirements 5.5**

---

### Property 7: Master/slave requires at least two nodes

*For any* selection with `|selectedNodeIds| < 2`, activating `ASSIGN_MASTER_SLAVE` SHALL NOT
open `masterSlaveDialog` and SHALL display an error notification.

**Validates: Requirements 6.6**

---

### Property 8: Property reduction factor validation

*For any* numeric value `v`, the property reduction factor validator SHALL accept `v` if and only
if `0.01 ≤ v ≤ 1.00`. For any `v < 0.01` or `v > 1.00`, the validator SHALL return an error
and the value SHALL NOT be stored on the member.

**Validates: Requirements 7.4, 7.5**

---

### Property 9: Floor load polygon closure validation

*For any* set of boundary member IDs that do NOT form a closed polygon (i.e., the graph of
member endpoints has at least one node with degree ≠ 2), the floor load generator SHALL return
a validation error and SHALL NOT produce any `MemberLoad` records.

**Validates: Requirements 8.8**

---

### Property 10: Area load UDL equals pressure times tributary width

*For any* beam with tributary width `w` (m) and applied pressure `p` (kN/m²), the resulting
UDL intensity stored on that beam SHALL equal `p × w` (kN/m) within floating-point tolerance
(|computed - expected| < 1e-6).

**Validates: Requirements 9.4**

---

### Property 11: ASCE 7 snow load formula correctness

*For any* valid combination of `(pg, Ce, Ct, Is, slope)` where `pg > 0`, `0.7 ≤ Ce ≤ 1.3`,
`0.85 ≤ Ct ≤ 1.3`, `0.8 ≤ Is ≤ 1.2`, and `0° ≤ slope ≤ 70°`, the computed flat roof snow
load SHALL equal `0.7 × Ce × Ct × Is × pg` and the sloped roof load SHALL equal `Cs × pf`
where `Cs = max(0, (70 - slope) / 65)` for `slope > 5°`.

**Validates: Requirements 10.4**

---

### Property 12: Story drift flag correctness

*For any* story with computed drift ratio `d` and user-specified limit `L`, the story SHALL be
flagged as exceeding the limit if and only if `d > L`.

**Validates: Requirements 15.4**

---

### Property 13: Section forces fractional position validation

*For any* numeric value `f`, the fractional position validator SHALL accept `f` if and only if
`0.0 ≤ f ≤ 1.0`. For any `f < 0.0` or `f > 1.0`, the validator SHALL return an error and
SHALL NOT compute forces at that position.

**Validates: Requirements 17.3, 17.6**

---

### Property 14: Structure Wizard generates valid member references

*For any* valid set of template parameters for any of the seven new templates (Fink, North Light,
King Post, Queen Post, Scissors, Cylindrical Frame, Spherical Surface), every generated member's
`startNodeId` and `endNodeId` SHALL reference a node ID that exists in the generated node list.

**Validates: Requirements 20.3, 20.6**

---

### Property 15: Built-up section parallel axis theorem

*For any* built-up section with `n ≥ 2` non-overlapping component shapes, the computed
`combinedIxx` SHALL equal `Σ(Ixx_i + A_i × (cy_i - CY)²)` within floating-point tolerance
(relative error < 1e-9), where `CY` is the computed combined centroid Y coordinate.

**Validates: Requirements 21.3**

---

### Property 16: Built-up section overlap detection

*For any* pair of component shapes `(a, b)` whose outline polygons intersect, the overlap
detector SHALL return `true`. For any pair whose outlines do not intersect, it SHALL return
`false`.

**Validates: Requirements 21.6**

---

### Property 17: All required design codes are present in DESIGN_CODES

*For any* code key in the set {GB50017, BS5950, AIJ, SNIP, AASHTO_LRFD, AA_ADM1, CSA_A23,
SP52101, IS13920, EC5}, `DESIGN_CODES` SHALL contain an entry for that key with non-empty
`name`, `country`, and `description` fields.

**Validates: Requirements 22.1, 22.2, 22.3**

---

## Error Handling

### Tool Activation Guards

- **Analysis-required tools**: If `analysisResults?.completed` is falsy, show a `warning`
  notification ("Run analysis first"), reset `activeTool` to `'SELECT'`, and do not open the
  modal. This is enforced in the `useEffect([activeTool])` block in `ModernModeler.tsx`.

- **Modal analysis required** (response spectrum, mode shape animation): If `modalResults` is
  null, auto-trigger modal analysis before proceeding, or show a warning if the model has no
  dynamic mass assigned.

- **Insufficient selection** (master/slave < 2 nodes, diaphragm < 2 nodes): Show an `error`
  notification and do not open the dialog.

### Validation Errors in Dialogs

All dialogs use inline validation with red helper text beneath the offending field. The confirm
button is disabled while any field has a validation error. No toast is shown for field-level
errors — only for successful saves or system-level failures.

### Floor Load Polygon Validation

The polygon closure check runs on the client before any API call. If the boundary members do not
form a closed loop, the dialog shows: "Selected members do not form a closed polygon. Please
ensure all boundary beams are connected end-to-end."

### Analysis Failures

Advanced analysis types (response spectrum, pushover, steady-state) follow the same error
handling as the existing `useAnalysisExecution` hook:
- Network error: show `error` notification with retry button.
- Solver error (non-convergence, mechanism): show the solver's error message in the results
  panel with a "View Details" link.
- Timeout (> 5 minutes): cancel the request and show a timeout notification.

### Built-Up Section Overlap

When overlap is detected between two components, the Section Builder highlights both shapes in
red in the preview canvas and shows: "Components [A] and [B] overlap. Adjust offsets to
eliminate overlap before saving."

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. Unit tests cover specific examples,
integration points, and error conditions. Property-based tests verify universal correctness
across all inputs. Together they provide comprehensive coverage.

### Property-Based Testing Library

- **Frontend (TypeScript/React)**: [fast-check](https://github.com/dubzzz/fast-check)
- Minimum **100 iterations** per property test.
- Each property test references its design document property via a tag comment.

**Tag format**: `Feature: staad-pro-modeling-tools, Property {N}: {property_text}`

### Property Test Implementations

```typescript
import fc from 'fast-check';

// Property 1: All new tool IDs registered with correct category
// Feature: staad-pro-modeling-tools, Property 1: tool IDs registered with correct category
it('all new tool IDs exist in TOOL_DEFINITIONS with correct category', () => {
  const analysisTools = [
    'PDELTA_ANALYSIS', 'BUCKLING_ANALYSIS', 'TIME_HISTORY_ANALYSIS',
    'NONLINEAR_ANALYSIS', 'DYNAMICS_PANEL', 'PLATE_STRESS_CONTOUR',
    'RESPONSE_SPECTRUM_ANALYSIS', 'PUSHOVER_ANALYSIS', 'STEADY_STATE_ANALYSIS',
    'IMPERFECTION_ANALYSIS', 'VIEW_STORY_DRIFT', 'VIEW_FORCE_ENVELOPE',
    'VIEW_SECTION_FORCES', 'ANIMATE_MODE_SHAPE',
  ];
  const propertyTools = [
    'ASSIGN_PARTIAL_RELEASE', 'ASSIGN_TENSION_ONLY', 'ASSIGN_COMPRESSION_ONLY',
    'ASSIGN_INACTIVE', 'ASSIGN_DIAPHRAGM', 'ASSIGN_MASTER_SLAVE',
    'ASSIGN_PROPERTY_REDUCTION',
  ];
  const loadingTools = ['ADD_FLOOR_LOAD', 'ADD_AREA_LOAD', 'ADD_SNOW_LOAD'];

  fc.assert(fc.property(
    fc.constantFrom(...analysisTools),
    (toolId) => TOOL_DEFINITIONS[toolId]?.category === 'ANALYSIS'
  ), { numRuns: 100 });

  fc.assert(fc.property(
    fc.constantFrom(...propertyTools),
    (toolId) => TOOL_DEFINITIONS[toolId]?.category === 'PROPERTIES'
  ), { numRuns: 100 });

  fc.assert(fc.property(
    fc.constantFrom(...loadingTools),
    (toolId) => TOOL_DEFINITIONS[toolId]?.category === 'LOADING'
  ), { numRuns: 100 });
});

// Property 2: No duplicate tool IDs
// Feature: staad-pro-modeling-tools, Property 2: no duplicate tool IDs
it('MODELING_TOOL_GROUPS has no duplicate tool IDs', () => {
  const allIds = MODELING_TOOL_GROUPS.flatMap(g => g.tools);
  expect(allIds.length).toBe(new Set(allIds).size);
});

// Property 4: Partial release factor validation
// Feature: staad-pro-modeling-tools, Property 4: partial release factor validation
it('partial release factor accepts [0.001, 0.999] and rejects outside', () => {
  fc.assert(fc.property(
    fc.float({ min: 0.001, max: 0.999, noNaN: true }),
    (v) => validatePartialReleaseFactor(v).valid === true
  ), { numRuns: 100 });

  fc.assert(fc.property(
    fc.oneof(
      fc.float({ max: 0.0009, noNaN: true }),
      fc.float({ min: 1.0001, noNaN: true })
    ),
    (v) => validatePartialReleaseFactor(v).valid === false
  ), { numRuns: 100 });
});

// Property 8: Property reduction factor validation
// Feature: staad-pro-modeling-tools, Property 8: property reduction factor validation
it('property reduction factor accepts [0.01, 1.00] and rejects outside', () => {
  fc.assert(fc.property(
    fc.float({ min: 0.01, max: 1.0, noNaN: true }),
    (v) => validateReductionFactor(v).valid === true
  ), { numRuns: 100 });

  fc.assert(fc.property(
    fc.float({ max: 0.009, noNaN: true }).filter(v => v >= 0),
    (v) => validateReductionFactor(v).valid === false
  ), { numRuns: 100 });
});

// Property 10: Area load UDL = pressure × tributary width
// Feature: staad-pro-modeling-tools, Property 10: area load UDL computation
it('area load UDL equals pressure times tributary width', () => {
  fc.assert(fc.property(
    fc.float({ min: 0.1, max: 100, noNaN: true }),  // pressure kN/m²
    fc.float({ min: 0.5, max: 20, noNaN: true }),   // tributary width m
    (pressure, width) => {
      const udl = computeAreaLoadUDL(pressure, width);
      return Math.abs(udl - pressure * width) < 1e-6;
    }
  ), { numRuns: 100 });
});

// Property 11: ASCE 7 snow load formula
// Feature: staad-pro-modeling-tools, Property 11: ASCE 7 snow load formula
it('ASCE 7 flat roof snow load equals 0.7 × Ce × Ct × Is × pg', () => {
  fc.assert(fc.property(
    fc.float({ min: 0.1, max: 5.0, noNaN: true }),   // pg
    fc.float({ min: 0.7, max: 1.3, noNaN: true }),   // Ce
    fc.float({ min: 0.85, max: 1.3, noNaN: true }),  // Ct
    fc.float({ min: 0.8, max: 1.2, noNaN: true }),   // Is
    (pg, Ce, Ct, Is) => {
      const pf = computeASCE7FlatRoofSnow({ pg, Ce, Ct, Is });
      return Math.abs(pf - 0.7 * Ce * Ct * Is * pg) < 1e-9;
    }
  ), { numRuns: 100 });
});

// Property 13: Fractional position validation
// Feature: staad-pro-modeling-tools, Property 13: fractional position validation
it('fractional position accepts [0.0, 1.0] and rejects outside', () => {
  fc.assert(fc.property(
    fc.float({ min: 0.0, max: 1.0, noNaN: true }),
    (f) => validateFractionalPosition(f).valid === true
  ), { numRuns: 100 });

  fc.assert(fc.property(
    fc.oneof(
      fc.float({ max: -0.001, noNaN: true }),
      fc.float({ min: 1.001, noNaN: true })
    ),
    (f) => validateFractionalPosition(f).valid === false
  ), { numRuns: 100 });
});

// Property 14: Structure Wizard generates valid member references
// Feature: staad-pro-modeling-tools, Property 14: wizard generates valid member references
it('all generated members reference existing node IDs', () => {
  const templates = ['fink', 'northLight', 'kingPost', 'queenPost', 'scissors',
                     'cylindrical', 'spherical'];
  fc.assert(fc.property(
    fc.constantFrom(...templates),
    fc.integer({ min: 4, max: 12 }),  // panels / divisions
    (template, divisions) => {
      const structure = generateTemplate(template, { span: 12, rise: 3, panels: divisions });
      const nodeIds = new Set(structure.nodes.map(n => n.id));
      return structure.members.every(
        m => nodeIds.has(m.startNodeId) && nodeIds.has(m.endNodeId)
      );
    }
  ), { numRuns: 100 });
});

// Property 15: Built-up section parallel axis theorem
// Feature: staad-pro-modeling-tools, Property 15: parallel axis theorem
it('combined Ixx equals sum of (Ixx_i + A_i × dy_i²)', () => {
  fc.assert(fc.property(
    fc.array(
      fc.record({
        area: fc.float({ min: 100, max: 10000, noNaN: true }),
        ixx: fc.float({ min: 1e4, max: 1e8, noNaN: true }),
        cy: fc.float({ min: -200, max: 200, noNaN: true }),
      }),
      { minLength: 2, maxLength: 5 }
    ),
    (components) => {
      const { combinedIxx, centroidY } = computeBuiltUpProperties(components);
      const expected = components.reduce(
        (sum, c) => sum + c.ixx + c.area * Math.pow(c.cy - centroidY, 2), 0
      );
      return Math.abs(combinedIxx - expected) / expected < 1e-9;
    }
  ), { numRuns: 100 });
});
```

### Unit Tests

Unit tests focus on:
- **Specific examples**: King Post truss with span=6m produces exactly 4 members; Fink truss
  with 4 panels produces the correct node count.
- **Integration points**: `ModernModeler` `useEffect` correctly maps each new tool ID to its
  modal key; `uiStore.openModal` sets the correct boolean.
- **Edge cases**: Floor load with 3-node polygon (triangle) distributes correctly; snow load
  with slope = 70° produces `Cs = 0`; built-up section with 2 identical shapes at same offset
  triggers overlap warning.
- **Design codes**: `DESIGN_CODES.steel.GB50017` exists and has `beta: false`; `DESIGN_CODES.timber.EC5` exists.

Avoid writing unit tests that duplicate what property tests already cover (e.g., do not write
individual unit tests for each valid/invalid reduction factor value — the property test handles
that range).
