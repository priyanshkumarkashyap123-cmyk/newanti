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
}

export interface Restraints {
  fx: boolean;
  fy: boolean;
  fz: boolean;
  mx: boolean;
  my: boolean;
  mz: boolean;
}

export interface Node {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints?: Restraints; // Optional: Support conditions
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

export interface LoadCombination {
  id: string;
  name: string;
  code?: string; // Design code reference (e.g., 'IS 875', 'ASCE 7', 'ASCE 7-22')
  factors: { loadCaseId: string; factor: number }[];
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

export interface Member {
  id: string;
  startNodeId: string;
  endNodeId: string;
  sectionId?: string; // Made optional with default 'Default'

  // Section geometry for 3D rendering
  sectionType?: SectionType;
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
  projectInfo: ProjectInfo;
  nodes: [string, Node][];
  members: [string, Member][];
  loads: NodeLoad[];
  memberLoads: MemberLoad[];
  loadCases?: LoadCase[];
  loadCombinations?: LoadCombination[];
  plates?: [string, Plate][];
  floorLoads?: FloorLoad[];
  savedAt: string;
}
