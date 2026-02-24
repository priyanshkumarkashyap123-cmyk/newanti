/**
 * Deep Beam and Strut-and-Tie Model Design Type Definitions
 * Per ACI 318-19 Chapter 23 (Strut-and-Tie Method)
 * Per ACI 318-19 Section 9.9 (Deep Beams)
 * 
 * For members where plane sections do not remain plane:
 * - Deep beams (ln/d ≤ 4 or concentrated loads within 2d)
 * - Transfer girders
 * - Pile caps
 * - Corbels and brackets
 * - Dapped-end beams
 */

/**
 * D-region types where STM applies
 */
export enum DRegionType {
  DEEP_BEAM = 'DEEP_BEAM',
  PILE_CAP = 'PILE_CAP',
  CORBEL = 'CORBEL',
  DAPPED_END = 'DAPPED_END',
  BEAM_COLUMN_JOINT = 'BEAM_COLUMN_JOINT',
  WALL_WITH_OPENING = 'WALL_WITH_OPENING',
  TRANSFER_GIRDER = 'TRANSFER_GIRDER',
}

/**
 * Strut types per ACI 318-19 Table 23.4.3
 */
export enum StrutType {
  PRISMATIC = 'PRISMATIC',              // Uniform cross-section
  BOTTLE_SHAPED_REINFORCED = 'BOTTLE_SHAPED_REINFORCED',  // With crack control
  BOTTLE_SHAPED_UNREINFORCED = 'BOTTLE_SHAPED_UNREINFORCED', // Without crack control
}

/**
 * Node types per ACI 318-19 Table 23.9.2
 */
export enum NodeType {
  CCC = 'CCC',   // All struts - compression only
  CCT = 'CCT',   // Two struts + one tie
  CTT = 'CTT',   // One strut + two ties
  TTT = 'TTT',   // All ties (rarely used)
}

/**
 * Strut effectiveness factors (βs) per ACI 318-19 Table 23.4.3
 */
export const STRUT_EFFECTIVENESS_FACTORS: Record<StrutType, number> = {
  [StrutType.PRISMATIC]: 1.0,
  [StrutType.BOTTLE_SHAPED_REINFORCED]: 0.75,
  [StrutType.BOTTLE_SHAPED_UNREINFORCED]: 0.60,  // λ = 1.0 for normal weight
};

/**
 * Node effectiveness factors (βn) per ACI 318-19 Table 23.9.2
 */
export const NODE_EFFECTIVENESS_FACTORS: Record<NodeType, number> = {
  [NodeType.CCC]: 0.85,
  [NodeType.CCT]: 0.65,
  [NodeType.CTT]: 0.45,
  [NodeType.TTT]: 0.45,
};

/**
 * Calculation step for detailed output
 */
export interface CalculationStep {
  step: number;
  description: string;
  formula?: string;
  values?: Record<string, number | string>;
  result: number | string;
  unit?: string;
  reference?: string;
}

/**
 * Material properties
 */
export interface STMMaterialProperties {
  fc: number;              // Concrete compressive strength, psi
  fy: number;              // Steel yield strength, psi
  fyt?: number;            // Transverse reinforcement yield strength, psi
  lambda?: number;         // Lightweight concrete factor (1.0 normal weight)
  Es?: number;             // Steel modulus, psi (default 29,000,000)
}

/**
 * Strut definition
 */
export interface StrutDefinition {
  id: string;
  type: StrutType;
  
  // Geometry
  length: number;          // Strut length, in
  width: number;           // Strut width perpendicular to axis, in
  angle: number;           // Angle from horizontal, degrees
  
  // Force
  Fu: number;              // Required strength, kips (positive = compression)
  
  // Nodes at ends
  startNode: string;
  endNode: string;
  
  // Reinforcement (for bottle-shaped)
  Asi?: number;            // Area of crack control reinforcement, in²
  si?: number;             // Spacing of crack control reinforcement, in
}

/**
 * Tie definition
 */
export interface TieDefinition {
  id: string;
  
  // Geometry
  length: number;          // Tie length, in
  width: number;           // Width of tie zone, in
  angle: number;           // Angle from horizontal, degrees
  
  // Force
  Tu: number;              // Required strength, kips (positive = tension)
  
  // Nodes at ends
  startNode: string;
  endNode: string;
  
  // Reinforcement
  As?: number;             // Area of tie reinforcement provided, in²
  barSize?: string;        // Bar designation
  nBars?: number;          // Number of bars
}

/**
 * Node definition
 */
export interface NodeDefinition {
  id: string;
  type: NodeType;
  
  // Location
  x: number;               // X coordinate, in
  y: number;               // Y coordinate, in
  
  // Geometry
  width: number;           // Node width (bearing length), in
  height: number;          // Node height, in
  
  // Connected elements
  struts: string[];        // IDs of connected struts
  ties: string[];          // IDs of connected ties
  
  // External force (if any)
  Pu?: number;             // Vertical force, kips (positive = down)
  Vu?: number;             // Horizontal force, kips
}

/**
 * Deep beam geometry
 */
export interface DeepBeamGeometry {
  ln: number;              // Clear span, in
  h: number;               // Overall depth, in
  bw: number;              // Web width, in
  d: number;               // Effective depth, in
  a_load?: number;         // Distance from support to load, in
  c_min?: number;          // Clear cover to reinforcement, in
}

/**
 * Deep beam loading
 */
export interface DeepBeamLoading {
  Pu: number;              // Total factored load, kips
  loadType: 'SINGLE_POINT' | 'TWO_POINT' | 'UNIFORM';
  loadPosition?: number;   // Distance from left support, in (for single point)
  loadSpacing?: number;    // Spacing between loads, in (for two point)
}

/**
 * Strut-and-Tie model input
 */
export interface STMInput {
  // Type of D-region
  regionType: DRegionType;
  
  // Materials
  materials: STMMaterialProperties;
  
  // Geometry (for deep beams)
  geometry?: DeepBeamGeometry;
  
  // Loading (for deep beams)
  loading?: DeepBeamLoading;
  
  // Truss model (for custom STM)
  struts?: StrutDefinition[];
  ties?: TieDefinition[];
  nodes?: NodeDefinition[];
  
  // Design options
  designMethod?: 'LRFD';  // ACI 318 uses strength design only
  checkCracking?: boolean;
  
  // Bearing plate sizes
  bearingPlateWidth?: number;  // in
  bearingPlateDepth?: number;  // in
}

/**
 * Strut capacity result
 */
export interface StrutCapacityResult {
  strutId: string;
  strutType: StrutType;
  
  // Capacity
  fce: number;             // Effective compressive strength, psi
  Fns: number;             // Nominal strut strength, kips
  phi_Fns: number;         // Design strut strength, kips
  Fu: number;              // Required strength, kips
  ratio: number;           // Fu / φFns
  isAdequate: boolean;
  
  // Parameters
  beta_s: number;          // Strut coefficient
  Acs: number;             // Effective cross-sectional area, in²
  angle: number;           // Strut angle, degrees
}

/**
 * Tie capacity result
 */
export interface TieCapacityResult {
  tieId: string;
  
  // Capacity
  Fnt: number;             // Nominal tie strength, kips
  phi_Fnt: number;         // Design tie strength, kips
  Tu: number;              // Required strength, kips
  ratio: number;           // Tu / φFnt
  isAdequate: boolean;
  
  // Reinforcement
  As_required: number;     // Required reinforcement area, in²
  As_provided: number;     // Provided reinforcement area, in²
  barSize: string;
  nBars: number;
  
  // Anchorage
  ldh?: number;            // Development length, in
}

/**
 * Node capacity result
 */
export interface NodeCapacityResult {
  nodeId: string;
  nodeType: NodeType;
  
  // Capacity
  fce: number;             // Effective compressive strength, psi
  Fnn: number;             // Nominal node strength, kips
  phi_Fnn: number;         // Design node strength, kips
  Fn: number;              // Maximum force at node, kips
  ratio: number;           // Fn / φFnn
  isAdequate: boolean;
  
  // Parameters
  beta_n: number;          // Node coefficient
  Anz: number;             // Nodal zone area, in²
}

/**
 * Complete STM design result
 */
export interface STMResult {
  isAdequate: boolean;
  regionType: DRegionType;
  
  // Element results
  struts: StrutCapacityResult[];
  ties: TieCapacityResult[];
  nodes: NodeCapacityResult[];
  
  // Governing ratios
  strutRatio: number;      // Maximum strut ratio
  tieRatio: number;        // Maximum tie ratio
  nodeRatio: number;       // Maximum node ratio
  governingRatio: number;  // Maximum of all
  governingElement: string; // ID of governing element
  
  // Deep beam specific
  isDeepBeam?: boolean;
  spanToDepthRatio?: number;
  
  // Minimum reinforcement
  minSkinReinf?: {
    Ash: number;           // Horizontal skin reinforcement, in²/ft
    Asv: number;           // Vertical skin reinforcement, in²/ft
  };
  
  calculations: CalculationStep[];
  codeReference: string;
}

/**
 * Resistance factors per ACI 318-19 Table 21.2.1
 */
export const STM_RESISTANCE_FACTORS = {
  phi_strut: 0.75,         // Struts and nodes (ties governed by nodes)
  phi_tie: 0.75,           // Ties
  phi_node: 0.75,          // Nodal zones
};

/**
 * Minimum reinforcement ratios per ACI 318-19 Section 9.9.3.1
 */
export const DEEP_BEAM_MIN_REINFORCEMENT = {
  rho_h: 0.0025,           // Horizontal (distributed) ρh ≥ 0.0025
  rho_v: 0.0025,           // Vertical (distributed) ρv ≥ 0.0025
  max_spacing_h: 12,       // Maximum spacing, in (or d/5)
  max_spacing_v: 12,       // Maximum spacing, in (or d/5)
};

/**
 * Standard rebar areas for tie design
 */
export const REBAR_AREAS: Record<string, number> = {
  '#3': 0.11,
  '#4': 0.20,
  '#5': 0.31,
  '#6': 0.44,
  '#7': 0.60,
  '#8': 0.79,
  '#9': 1.00,
  '#10': 1.27,
  '#11': 1.56,
  '#14': 2.25,
  '#18': 4.00,
};

/**
 * Check if member qualifies as deep beam
 * Per ACI 318-19 Section 9.9.1.1
 */
export function isDeepBeam(geometry: DeepBeamGeometry): boolean {
  const ln_d = geometry.ln / geometry.d;
  return ln_d <= 4;
}

/**
 * Calculate minimum strut angle
 * Per ACI 318-19 Section 23.2.7
 */
export function minimumStrutAngle(): number {
  return 25; // degrees - recommended minimum
}
