/**
 * modelTypes.ts — All type definitions for the structural model store.
 * Extracted from model.ts to reduce file size and improve import ergonomics.
 */

export interface ProjectInfo {
  name: string;
  client: string;
  engineer: string;
  jobNo: string;
  rev: string;
  date: Date;
  description: string;
  cloudId?: string; // ID from database if saved
  // Design configuration
  designCode?: string;       // e.g., 'IS', 'AISC', 'Eurocode', 'ACI'
  steelCode?: string;        // e.g., 'IS 800:2007', 'AISC 360-16', 'EN 1993-1-1'
  concreteCode?: string;     // e.g., 'IS 456:2000', 'ACI 318-19', 'EN 1992-1-1'
  seismicCode?: string;      // e.g., 'IS 1893:2016', 'ASCE 7-22'
  unitSystem?: string;       // e.g., 'SI_kN_m', 'SI_N_mm', 'Imperial_kip_ft'
  primaryMaterial?: string;  // e.g., 'Steel', 'Concrete', 'Composite', 'Timber'
  steelGrade?: string;       // e.g., 'Fe250', 'Fe415', 'A992', 'S355'
  concreteGrade?: string;    // e.g., 'M20', 'M25', 'M30', 'C30/37'
}

export interface Restraints {
  fx: boolean;
  fy: boolean;
  fz: boolean;
  mx: boolean;
  my: boolean;
  mz: boolean;
}

/** Optional elastic spring stiffness at a node (kN/m for translational, kN·m/rad for rotational) */
export interface SpringStiffness {
  kx?: number;
  ky?: number;
  kz?: number;
  kmx?: number;
  kmy?: number;
  kmz?: number;
}

export interface Node {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints?: Restraints; // Optional: Support conditions
  springStiffness?: SpringStiffness; // Optional: elastic spring supports

  // Master/slave constraint
  masterSlaveConstraint?: {
    role: 'master' | 'slave';
    masterNodeId?: string; // set on slave nodes
    coupledDOFs: { fx: boolean; fy: boolean; fz: boolean;
                   mx: boolean; my: boolean; mz: boolean; };
  };
}

export interface NodeLoad {
  id: string;
  nodeId: string;
  fx?: number;
  fy?: number;
  fz?: number; // Forces (kN)
  mx?: number;
  my?: number;
  mz?: number; // Moments (kN-m)
  loadCase?: string; // Optional: Link to load case ID
}

// Member Loads (applied on members)
export type MemberLoadType = "UDL" | "UVL" | "point" | "moment";

export interface MemberLoad {
  id: string;
  memberId: string;
  type: MemberLoadType;
  // For distributed loads (UDL/UVL)
  w1?: number; // Intensity at start (kN/m) - for UDL, w1 = w2
  w2?: number; // Intensity at end (kN/m)
  // For point loads
  P?: number; // Point load magnitude (kN)
  M?: number; // Point moment magnitude (kN·m)
  a?: number; // Distance from start node (m or as ratio 0-1)
  // Direction: 'local_y' is perpendicular to member, 'global_y' is vertical
  direction:
    | "local_y"
    | "local_z"
    | "global_x"
    | "global_y"
    | "global_z"
    | "axial";
  // Start and end positions for partial loads (0-1 as ratio of length)
  startPos?: number; // Default 0
  endPos?: number; // Default 1
  loadCaseId?: string; // NEW: Link to load case ID
}

// Load Cases & Combinations (industry standard feature)
export type LoadCaseType =
  | "dead"
  | "live"
  | "wind"
  | "seismic"
  | "snow"
  | "temperature"
  | "self_weight"
  | "custom";

export interface LoadCase {
  id: string;
  name: string;
  type: LoadCaseType;
  loads: NodeLoad[];
  memberLoads: MemberLoad[];
  selfWeight?: boolean; // Auto-compute self-weight for this case
  factor?: number; // Scale factor (default 1.0)
}

export type CombinationCode = "IS456" | "ASCE7_LRFD" | "ASCE7_ASD" | "Eurocode" | "Custom";

export interface LoadFactor {
  load_case_id: string; // Must be snake_case exactly as mapped in Rust schema
  factor: number;
}

export interface LoadCombination {
  id: string;
  name: string;
  code: CombinationCode;
  factors: LoadFactor[];
  is_service: boolean;
}

export type PropertyAssignmentScopeMode =
  | "selected"
  | "view"
  | "cursor"
  | "group"
  | "manual_range";

export type MaterialFamily =
  | "steel"
  | "concrete"
  | "composite"
  | "timber"
  | "custom";

export interface PropertyReductionFactors {
  axial?: number; // EA multiplier (0-1)
  shearY?: number; // GAy multiplier (0-1)
  shearZ?: number; // GAz multiplier (0-1)
  torsion?: number; // GJ multiplier (0-1)
  bendingY?: number; // EIy multiplier (0-1)
  bendingZ?: number; // EIz multiplier (0-1)
}

export interface SectionMechanics {
  // SI family — keep units explicit in names
  area_m2: number;
  iyy_m4: number;
  izz_m4: number;
  j_m4: number;
  ay_m2?: number;
  az_m2?: number;
  zy_m3?: number;
  zz_m3?: number;
  zpy_m3?: number;
  zpz_m3?: number;
  ry_m?: number;
  rz_m?: number;
}

export interface PropertyAssignmentPayload {
  id: string;
  name: string;
  sectionType: SectionType;
  dimensions: SectionDimensions;
  mechanics: SectionMechanics;
  material: {
    id: string;
    family: MaterialFamily;
    E_kN_m2: number;
    nu: number;
    G_kN_m2?: number; // If omitted, derive as E/(2(1+nu))
    rho_kg_m3?: number;
    fy_mpa?: number;
    fck_mpa?: number;
  };
  behavior?: {
    tensionOnly?: boolean;
    compressionOnly?: boolean;
  };
  reductionFactors?: PropertyReductionFactors;
  orientation?: {
    betaAngleDeg?: number;
  };
  offsets?: {
    startGlobal_m?: { x: number; y: number; z: number };
    endGlobal_m?: { x: number; y: number; z: number };
    startLocal_m?: { x: number; y: number; z: number };
    endLocal_m?: { x: number; y: number; z: number };
  };
  assignment: {
    mode: PropertyAssignmentScopeMode;
    memberIds?: string[];
    groupIds?: string[];
    manualRange?: string; // e.g. "1 TO 50"
  };
  source?: "database" | "computed" | "user";
  codeContext?: {
    designCode?: string;
    steelCode?: string;
    concreteCode?: string;
  };
}

// Floor / Area Load (distributed to beams via yield-line method at analysis time)
export interface FloorLoad {
  id: string;
  pressure: number; // Load intensity (kN/m²) — negative = downward
  yLevel: number; // Floor Y coordinate (m)
  xMin: number; // Bounding box min X (-Infinity for all)
  xMax: number;
  zMin: number;
  zMax: number;
  distributionOverride?:
    | "one_way"
    | "two_way_triangular"
    | "two_way_trapezoidal";
  loadCase?: string;
}

export type SectionType =
  | "I-BEAM"
  | "TUBE"
  | "L-ANGLE"
  | "RECTANGLE"
  | "CIRCLE"
  | "C-CHANNEL"
  | "T-SECTION"
  | "DOUBLE-ANGLE"
  | "PIPE"
  | "TAPERED"
  | "BUILT-UP";

export interface SectionDimensions {
  // I-BEAM dimensions
  height?: number;
  width?: number;
  webThickness?: number;
  flangeThickness?: number;

  // TUBE/BOX dimensions
  outerWidth?: number;
  outerHeight?: number;
  thickness?: number;

  // L-ANGLE dimensions
  legWidth?: number;
  legHeight?: number;

  // RECTANGLE/PLATE dimensions
  rectWidth?: number;
  rectHeight?: number;

  // CIRCLE/CABLE dimensions
  diameter?: number;

  // C-CHANNEL dimensions
  channelHeight?: number;
  channelWidth?: number;
  channelThickness?: number;

  // T-SECTION dimensions
  tFlangeWidth?: number;
  tFlangeThickness?: number;
  tStemHeight?: number;
  tStemThickness?: number;

  // DOUBLE-ANGLE dimensions
  daLegWidth?: number;
  daLegHeight?: number;
  daThickness?: number;
  daGap?: number; // gap between angles (mm)

  // PIPE dimensions (circular hollow)
  pipeOuterDiameter?: number;
  pipeWallThickness?: number;

  // TAPERED section (haunched beams)
  startDepth?: number;
  endDepth?: number;
  taperFlangeWidth?: number;
  taperWebThickness?: number;
  taperFlangeThickness?: number;

  // BUILT-UP composite section
  builtUpType?: "plate_girder" | "box_girder" | "compound";
  builtUpWebHeight?: number;
  builtUpWebThickness?: number;
  builtUpTopFlangeWidth?: number;
  builtUpTopFlangeThickness?: number;
  builtUpBotFlangeWidth?: number;
  builtUpBotFlangeThickness?: number;
}

// ─── Partial Release DOF ────────────────────────────────────────────────────

export interface PartialReleaseDOF {
  mode: 'fixed' | 'released' | 'partial';
  factor?: number; // 0.001–0.999, only when mode === 'partial'
}

export interface PartialReleaseEndSpec {
  fx?: PartialReleaseDOF;
  fy?: PartialReleaseDOF;
  fz?: PartialReleaseDOF;
  mx?: PartialReleaseDOF;
  my?: PartialReleaseDOF;
  mz?: PartialReleaseDOF;
}

// ─── Diaphragm ──────────────────────────────────────────────────────────────

export type DiaphragmType = 'rigid' | 'semi-rigid' | 'flexible';
export type DiaphragmPlane = 'XY' | 'XZ' | 'YZ';

export interface DiaphragmSpec {
  id: string;
  type: DiaphragmType;
  plane: DiaphragmPlane;
  storyLabel: string;
  nodeIds: string[];
}

// ─── Built-Up Section ───────────────────────────────────────────────────────

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

export interface Member {
  id: string;
  startNodeId: string;
  endNodeId: string;
  sectionId?: string; // Made optional with default 'Default'

  // Property assignment binding (Phase B)
  propertyAssignmentId?: string; // Explicit binding to PropertyAssignmentPayload.id
  groupId?: string;              // Group-level property resolution

  // Section geometry for 3D rendering
  sectionType?: SectionType;
  materialType?: "steel" | "concrete" | "custom";
  dimensions?: SectionDimensions;

  // Default properties for analysis
  E?: number; // Young's Modulus (kN/m²)
  A?: number; // Cross-sectional Area (m²)
  I?: number; // Moment of Inertia (m⁴)
  Iy?: number; // Moment of inertia about local y-axis (m⁴)
  Iz?: number; // Moment of inertia about local z-axis (m⁴)
  J?: number; // Torsion constant (m⁴)
  G?: number; // Shear Modulus (kN/m²)
  rho?: number; // Material density (kg/m³), default 7850 for steel
  // Member releases (hinges) - full 3D releases for all 6 DOFs at each end
  releases?: {
    startMoment?: boolean; // Legacy: Release moment at start
    endMoment?: boolean; // Legacy: Release moment at end
    // Full 3D releases
    fxStart?: boolean;
    fyStart?: boolean;
    fzStart?: boolean;
    mxStart?: boolean;
    myStart?: boolean;
    mzStart?: boolean;
    fxEnd?: boolean;
    fyEnd?: boolean;
    fzEnd?: boolean;
    mxEnd?: boolean;
    myEnd?: boolean;
    mzEnd?: boolean;
  };
  // Rigid zone offsets (for beam-column connections)
  startOffset?: { x: number; y: number; z: number };
  endOffset?: { x: number; y: number; z: number };
  betaAngle?: number; // Rotation angle in degrees

  // ── STAAD.Pro parity extensions ──

  // Axial behavior (tension-only / compression-only)
  axialBehavior?: 'tension-only' | 'compression-only' | 'normal';

  // Inactive member specification
  inactive?: {
    scope: 'global' | 'load_cases';
    loadCaseIds?: string[];
  };

  // Partial moment releases (extends existing releases)
  partialReleases?: {
    start: PartialReleaseEndSpec;
    end: PartialReleaseEndSpec;
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

// ─── Member Groups ──────────────────────────────────────────────────────────

export interface MemberGroup {
  id: string;
  name: string;
  memberIds: string[];
  propertyAssignmentId?: string; // Group-level property binding
  color?: string;                // UI color for visualization
}

// Plate/Shell element (quadrilateral)
export interface Plate {
  id: string;
  nodeIds: [string, string, string, string]; // 4 corner nodes (CCW order)
  thickness: number; // Plate thickness (m)
  E?: number; // Young's Modulus (kN/m²), default 200e6 for steel
  nu?: number; // Poisson's ratio, default 0.3
  pressure?: number; // Applied pressure (kN/m²), positive = downward
  materialType?: "steel" | "concrete" | "custom";
}

// Member Force Results with diagram data
export interface MemberForceData {
  // Primary values (typically start-end values; kept for backward compat)
  axial: number;
  shearY: number;
  shearZ: number;
  momentY: number;
  momentZ: number;
  torsion: number;
  // Start / end forces (preserves full information from solver)
  startForces?: {
    axial: number;
    shearY: number;
    shearZ?: number;
    momentY?: number;
    momentZ: number;
    torsion?: number;
  };
  endForces?: {
    axial: number;
    shearY: number;
    shearZ?: number;
    momentY?: number;
    momentZ: number;
    torsion?: number;
  };
  // Diagram data arrays for visualization (SFD, BMD, deflection)
  diagramData?: {
    x_values: number[];
    shear_y: number[];
    shear_z: number[];
    moment_y: number[];
    moment_z: number[];
    axial: number[];
    torsion: number[];
    deflection_y: number[];
    deflection_z: number[];
  };
}

// Analysis Results
export interface AnalysisResults {
  displacements: Map<
    string,
    { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }
  >;
  reactions: Map<
    string,
    { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }
  >;
  memberForces: Map<string, MemberForceData>;
  // Plate/shell element results (optional)
  plateResults?: Record<
    string,
    {
      stress_xx?: number;
      stress_yy?: number;
      stress_xy?: number;
      stress_x?: number;
      stress_y?: number;
      moment_xx?: number;
      moment_yy?: number;
      moment_xy?: number;
      displacement?: number;
      von_mises?: number;
    }
  >;
  // Industry-standard equilibrium verification
  equilibriumCheck?: {
    applied_forces: number[]; // [Fx, Fy, Fz, Mx, My, Mz] in N/N·m
    reaction_forces: number[]; // [Fx, Fy, Fz, Mx, My, Mz] in N/N·m
    residual: number[]; // should be ~0
    error_percent: number; // < 0.1% is acceptable
    pass: boolean;
  };
  // Condition number estimate for numerical quality
  conditionNumber?: number;
  stats?: {
    solveTimeMs: number;
    assemblyTimeMs?: number;
    totalTimeMs?: number;
    method?: string;
    usedCloud?: boolean;
    fallbackFromLocal?: boolean;
  };
  completed?: boolean;
  timestamp?: number;
}

// Modal Analysis Results
export interface ModeShape {
  modeNumber: number;
  frequency: number; // Hz
  period: number; // seconds
  angularFrequency: number; // rad/s
  shape: Map<string, number[]>; // nodeId -> [dx, dy, dz, rx, ry, rz]
}

export interface ModalResult {
  modes: ModeShape[];
  totalMass: number;
}

// Civil Engineering Data (Results/State)
export interface CivilResult {
  id: string;
  moduleId:
    | "geotech"
    | "transport"
    | "hydraulics"
    | "enviro"
    | "const"
    | "survey";
  type: string; // e.g. 'footing', 'curve'
  timestamp: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  linkedElementIds?: string[]; // IDs of 3D elements generated (e.g. Plate P1)
}

// Saved project data structure (for localStorage / cloud persistence)
export interface SavedProjectData {
  schema_version?: number;
  projectInfo: ProjectInfo;
  nodes: [string, Node][];
  members: [string, Member][];
  loads: NodeLoad[];
  memberLoads: MemberLoad[];
  loadCases?: LoadCase[];
  loadCombinations?: LoadCombination[];
  propertyAssignments?: PropertyAssignmentPayload[];
  memberGroups?: MemberGroup[];
  plates?: [string, Plate][];
  floorLoads?: FloorLoad[];
  savedAt: string;
}

// Geometry operation contracts
export interface TranslationalRepeatRequest {
  nodeIds?: string[];
  memberIds?: string[];
  axis: { x: number; y: number; z: number };
  spacing_m: number;
  steps: number;
  linkSteps: boolean;
}

export interface TranslationalRepeatResult {
  createdNodeIds: string[];
  createdMemberIds: string[];
}

export interface CircularRepeatRequest {
  nodeIds?: string[];
  memberIds?: string[];
  axis: { x: number; y: number; z: number };
  center_m: { x: number; y: number; z: number };
  angleDeg: number;
  steps: number;
  linkSteps: boolean;
  closeLoop?: boolean;
}

export interface CircularRepeatResult {
  createdNodeIds: string[];
  createdMemberIds: string[];
}

export interface IntersectionSplitResult {
  createdNodeIds: string[];
  createdMemberIds: string[];
  deletedMemberIds: string[];
  intersectionCount: number;
}
