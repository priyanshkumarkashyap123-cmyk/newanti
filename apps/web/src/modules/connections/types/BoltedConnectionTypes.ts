/**
 * ============================================================================
 * BOLTED CONNECTION TYPES - Comprehensive Type Definitions
 * ============================================================================
 * 
 * Chief Engineering Standards for Bolted Connection Analysis & Design
 * Supports: AISC 360, Eurocode 3, IS 800, AS 4100
 * 
 * @author BeamLab Engineering Team
 * @version 1.0.0
 */

// ============================================================================
// ENUMERATIONS
// ============================================================================

/**
 * Bolt grade specifications per various standards
 */
export enum BoltGrade {
  // ASTM Standards (USA)
  ASTM_A307 = 'A307',           // Low carbon steel, 60 ksi tensile
  ASTM_A325 = 'A325',           // High-strength, 120 ksi tensile (Type 1)
  ASTM_A325_TYPE3 = 'A325-T3',  // Weathering steel
  ASTM_A490 = 'A490',           // High-strength, 150 ksi tensile
  ASTM_A490_TYPE3 = 'A490-T3',  // Weathering steel
  ASTM_F3125_A325 = 'F3125-A325',
  ASTM_F3125_A490 = 'F3125-A490',
  
  // ISO/Metric Grades (International)
  ISO_4_6 = '4.6',              // 400 MPa tensile
  ISO_5_6 = '5.6',              // 500 MPa tensile
  ISO_8_8 = '8.8',              // 800 MPa tensile (equiv. A325)
  ISO_10_9 = '10.9',            // 1000 MPa tensile (equiv. A490)
  ISO_12_9 = '12.9',            // 1200 MPa tensile
  
  // Indian Standards
  IS_4_6 = 'IS_4.6',
  IS_8_8 = 'IS_8.8',
  IS_10_9 = 'IS_10.9',
  
  // Australian Standards
  AS_4_6 = 'AS_4.6',
  AS_8_8 = 'AS_8.8/TF',
  AS_8_8_TB = 'AS_8.8/TB',
}

/**
 * Bolt hole types
 */
export enum BoltHoleType {
  STANDARD = 'STD',             // Standard holes (d + 1/16" or d + 2mm)
  OVERSIZED = 'OVS',            // Oversized holes
  SHORT_SLOTTED = 'SSL',        // Short-slotted holes
  LONG_SLOTTED = 'LSL',         // Long-slotted holes
  SHORT_SLOTTED_TRANSVERSE = 'SSLT',
  SHORT_SLOTTED_PARALLEL = 'SSLP',
  LONG_SLOTTED_TRANSVERSE = 'LSLT',
  LONG_SLOTTED_PARALLEL = 'LSLP',
}

/**
 * Connection types by force transfer mechanism
 */
export enum ConnectionType {
  // Shear Connections
  SINGLE_PLATE_SHEAR = 'SINGLE_PLATE',      // Tab/Shear tab
  DOUBLE_ANGLE_SHEAR = 'DOUBLE_ANGLE',      // Double angle connection
  SINGLE_ANGLE_SHEAR = 'SINGLE_ANGLE',      // Single angle
  UNSTIFFENED_SEAT = 'UNSTIFFENED_SEAT',    // Unstiffened seated
  STIFFENED_SEAT = 'STIFFENED_SEAT',        // Stiffened seated
  END_PLATE_SHEAR = 'END_PLATE_SHEAR',      // Flexible end plate
  TEE_SHEAR = 'TEE_SHEAR',                  // WT/Tee shear connection
  
  // Moment Connections
  EXTENDED_END_PLATE = 'EXTENDED_END_PLATE',     // 4 bolt/8 bolt extended
  FLUSH_END_PLATE = 'FLUSH_END_PLATE',           // Flush end plate
  DIRECTLY_WELDED_FLANGE = 'DIRECT_WELD',        // WUF-W, WUF-B
  BOLTED_FLANGE_PLATE = 'BOLTED_FLANGE_PLATE',   // BFP
  REDUCED_BEAM_SECTION = 'RBS',                   // Dogbone
  
  // Splice Connections
  COLUMN_SPLICE = 'COLUMN_SPLICE',
  BEAM_SPLICE = 'BEAM_SPLICE',
  FLANGE_PLATE_SPLICE = 'FLANGE_SPLICE',
  WEB_PLATE_SPLICE = 'WEB_SPLICE',
  
  // Bracing Connections
  GUSSET_PLATE = 'GUSSET',
  CHEVRON_GUSSET = 'CHEVRON_GUSSET',
  KNIFE_PLATE = 'KNIFE_PLATE',
  
  // Base Plates
  COLUMN_BASE_PLATE = 'BASE_PLATE',
  ANCHOR_BOLT = 'ANCHOR_BOLT',
  
  // Miscellaneous
  BEAM_BEARING = 'BEAM_BEARING',
  HANGER = 'HANGER',
  BRACKET = 'BRACKET',
}

/**
 * Connection loading condition
 */
export enum LoadingType {
  SHEAR_ONLY = 'SHEAR',
  TENSION_ONLY = 'TENSION',
  COMBINED_SHEAR_TENSION = 'COMBINED',
  MOMENT = 'MOMENT',
  MOMENT_AND_SHEAR = 'MOMENT_SHEAR',
  AXIAL_COMPRESSION = 'COMPRESSION',
  AXIAL_TENSION = 'AXIAL_TENSION',
  BIAXIAL = 'BIAXIAL',
}

/**
 * Slip-critical vs bearing-type connection
 */
export enum BoltBehavior {
  BEARING_TYPE_N = 'BEARING_N',   // Threads in shear plane
  BEARING_TYPE_X = 'BEARING_X',   // Threads excluded from shear plane
  SLIP_CRITICAL_A = 'SLIP_A',     // Class A faying surface (μ = 0.30)
  SLIP_CRITICAL_B = 'SLIP_B',     // Class B faying surface (μ = 0.50)
  SLIP_CRITICAL_C = 'SLIP_C',     // Class C faying surface (μ = 0.35)
}

/**
 * Design code standards
 */
export enum DesignCode {
  AISC_360_22 = 'AISC_360_22',     // AISC 360-22
  AISC_360_16 = 'AISC_360_16',     // AISC 360-16
  AISC_360_10 = 'AISC_360_10',     // AISC 360-10
  EUROCODE_3 = 'EC3_EN1993',       // Eurocode 3
  IS_800_2007 = 'IS_800_2007',     // Indian Standard
  AS_4100 = 'AS_4100',             // Australian Standard
  CSA_S16 = 'CSA_S16',             // Canadian Standard
  AISC_SEISMIC = 'AISC_341',       // Seismic provisions
}

/**
 * Failure modes for bolted connections
 */
export enum FailureMode {
  // Bolt failures
  BOLT_SHEAR = 'BOLT_SHEAR',
  BOLT_TENSION = 'BOLT_TENSION',
  BOLT_COMBINED = 'BOLT_COMBINED',
  BOLT_SLIP = 'BOLT_SLIP',
  
  // Plate failures
  BEARING_YIELDING = 'BEARING_YIELD',
  BEARING_TEAROUT = 'BEARING_TEAROUT',
  BLOCK_SHEAR = 'BLOCK_SHEAR',
  NET_SECTION_RUPTURE = 'NET_RUPTURE',
  GROSS_SECTION_YIELDING = 'GROSS_YIELD',
  
  // Connection geometry failures
  EDGE_DISTANCE = 'EDGE_DISTANCE',
  BOLT_SPACING = 'BOLT_SPACING',
  PRYING_ACTION = 'PRYING',
  
  // Weld failures (hybrid connections)
  WELD_RUPTURE = 'WELD_RUPTURE',
  BASE_METAL_RUPTURE = 'BASE_METAL_RUPTURE',
  
  // Overall connection failures
  CONNECTION_ROTATION = 'ROTATION_CAPACITY',
  DUCTILITY_LIMIT = 'DUCTILITY',
}

// ============================================================================
// BOLT SPECIFICATIONS
// ============================================================================

/**
 * Material properties for bolts
 */
export interface BoltMaterialProperties {
  /** Bolt grade designation */
  grade: BoltGrade;
  /** Nominal tensile strength Fnt (MPa or ksi) */
  tensileStrength: number;
  /** Nominal shear strength Fnv (MPa or ksi) */
  shearStrength: number;
  /** Yield strength Fy (MPa or ksi) */
  yieldStrength: number;
  /** Modulus of elasticity E (MPa or ksi) */
  elasticModulus: number;
  /** Proof load (MPa or ksi) */
  proofLoad: number;
  /** Unit system indicator */
  unitSystem: 'METRIC' | 'IMPERIAL';
}

/**
 * Bolt geometry and dimensions
 */
export interface BoltGeometry {
  /** Nominal bolt diameter (mm or inches) */
  diameter: number;
  /** Bolt designation (e.g., "M20", "3/4") */
  designation: string;
  /** Nominal/gross area Ab (mm² or in²) */
  nominalArea: number;
  /** Threaded (tensile stress) area At (mm² or in²) */
  tensileArea: number;
  /** Shank area (mm² or in²) */
  shankArea: number;
  /** Thread pitch (mm or TPI) */
  threadPitch: number;
  /** Thread length (mm or inches) */
  threadLength: number;
  /** Head height (mm or inches) */
  headHeight: number;
  /** Head width across flats (mm or inches) */
  headWidth: number;
  /** Nut height (mm or inches) */
  nutHeight: number;
  /** Washer outer diameter (mm or inches) */
  washerOD: number;
  /** Washer inner diameter (mm or inches) */
  washerID: number;
  /** Washer thickness (mm or inches) */
  washerThickness: number;
}

/**
 * Complete bolt specification
 */
export interface BoltSpecification {
  id: string;
  geometry: BoltGeometry;
  material: BoltMaterialProperties;
  holeType: BoltHoleType;
  behavior: BoltBehavior;
  /** Pretension/clamping force (kN or kips) */
  pretension?: number;
  /** Installation method */
  installationMethod?: 'TURN_OF_NUT' | 'CALIBRATED_WRENCH' | 'TENSION_INDICATOR' | 'TWIST_OFF';
  /** Surface condition */
  surfaceCondition?: 'UNPAINTED' | 'GALVANIZED' | 'PAINTED' | 'BLAST_CLEANED';
}

// ============================================================================
// PLATE/MEMBER SPECIFICATIONS
// ============================================================================

/**
 * Steel material properties
 */
export interface SteelMaterialProperties {
  /** Material grade designation (e.g., "A36", "A992", "S355") */
  grade: string;
  /** Yield strength Fy (MPa or ksi) */
  yieldStrength: number;
  /** Ultimate tensile strength Fu (MPa or ksi) */
  ultimateStrength: number;
  /** Modulus of elasticity E (MPa or ksi) */
  elasticModulus: number;
  /** Shear modulus G (MPa or ksi) */
  shearModulus: number;
  /** Poisson's ratio ν */
  poissonRatio: number;
  /** Density (kg/m³ or lb/ft³) */
  density: number;
  /** Coefficient of thermal expansion (per °C or °F) */
  thermalExpansion: number;
}

/**
 * Connection plate definition
 */
export interface ConnectionPlate {
  id: string;
  /** Plate type identifier */
  type: 'GUSSET' | 'END_PLATE' | 'SHEAR_TAB' | 'FLANGE_PLATE' | 'WEB_PLATE' | 'STIFFENER' | 'BASE_PLATE';
  /** Material properties */
  material: SteelMaterialProperties;
  /** Plate thickness (mm or inches) */
  thickness: number;
  /** Plate width (mm or inches) */
  width: number;
  /** Plate height/length (mm or inches) */
  height: number;
  /** Gross area (mm² or in²) */
  grossArea: number;
  /** Net area accounting for holes (mm² or in²) */
  netArea?: number;
  /** Effective net area Ae (mm² or in²) */
  effectiveNetArea?: number;
  /** Shear lag factor U */
  shearLagFactor?: number;
  /** Position relative to connection origin */
  position?: Vector3D;
  /** Rotation angles */
  rotation?: Vector3D;
}

/**
 * 3D vector for positioning
 */
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

// ============================================================================
// BOLT PATTERN DEFINITION
// ============================================================================

/**
 * Individual bolt position in a pattern
 */
export interface BoltPosition {
  id: string;
  /** Row index (1-based) */
  row: number;
  /** Column index (1-based) */
  column: number;
  /** X coordinate from pattern origin (mm or inches) */
  x: number;
  /** Y coordinate from pattern origin (mm or inches) */
  y: number;
  /** Z coordinate (for 3D patterns) */
  z?: number;
  /** Edge distance to nearest horizontal edge (mm or inches) */
  edgeDistanceHorizontal: number;
  /** Edge distance to nearest vertical edge (mm or inches) */
  edgeDistanceVertical: number;
  /** Is this bolt position active? */
  isActive: boolean;
  /** Individual bolt specification override */
  boltSpec?: BoltSpecification;
}

/**
 * Bolt pattern/group definition
 */
export interface BoltPattern {
  id: string;
  /** Pattern name/description */
  name: string;
  /** Number of rows */
  numRows: number;
  /** Number of columns */
  numColumns: number;
  /** Total number of bolts */
  totalBolts: number;
  /** Vertical spacing between rows (mm or inches) */
  pitchVertical: number;
  /** Horizontal spacing between columns (mm or inches) */
  pitchHorizontal: number;
  /** Edge distance from top (mm or inches) */
  edgeDistanceTop: number;
  /** Edge distance from bottom (mm or inches) */
  edgeDistanceBottom: number;
  /** Edge distance from left (mm or inches) */
  edgeDistanceLeft: number;
  /** Edge distance from right (mm or inches) */
  edgeDistanceRight: number;
  /** Gage (transverse spacing for structural shapes) */
  gage?: number;
  /** Default bolt specification for pattern */
  defaultBoltSpec: BoltSpecification;
  /** Individual bolt positions */
  positions: BoltPosition[];
  /** Pattern geometry type */
  geometryType: 'RECTANGULAR' | 'STAGGERED' | 'CIRCULAR' | 'CUSTOM';
  /** Instantaneous center for eccentric loading (mm or inches from centroid) */
  instantaneousCenter?: Vector3D;
  /** Pattern centroid location */
  centroid: Vector3D;
  /** Polar moment of inertia Ip (mm⁴ or in⁴) */
  polarMomentOfInertia: number;
  /** Coefficient of the bolt group C */
  eccentricityCoefficient?: number;
}

// ============================================================================
// LOADS AND FORCES
// ============================================================================

/**
 * Applied loads at connection
 */
export interface ConnectionLoads {
  /** Load case identifier */
  loadCase: string;
  /** Load combination name */
  loadCombination?: string;
  /** Factored load indicator */
  isFactored: boolean;
  /** Shear force Vu/Vn (kN or kips) */
  shearForce?: {
    Vx: number;  // In-plane horizontal
    Vy: number;  // In-plane vertical
    Vz?: number; // Out-of-plane
  };
  /** Axial force Pu/Pn (kN or kips) - positive = tension */
  axialForce?: number;
  /** Moment Mu/Mn (kN-m or kip-ft) */
  moment?: {
    Mx: number;  // About X-axis
    My: number;  // About Y-axis
    Mz?: number; // Torsion
  };
  /** Eccentricity of load (mm or inches) */
  eccentricity?: {
    ex: number;
    ey: number;
  };
  /** Service load for slip-critical check */
  serviceLoad?: {
    shear: number;
    axial: number;
    moment: number;
  };
}

/**
 * Forces on individual bolt
 */
export interface BoltForces {
  boltId: string;
  /** Direct shear (kN or kips) */
  directShear: number;
  /** Torsional shear from eccentricity (kN or kips) */
  torsionalShear: number;
  /** Resultant shear (kN or kips) */
  resultantShear: number;
  /** Shear angle from horizontal (degrees) */
  shearAngle: number;
  /** Direct tension (kN or kips) */
  directTension: number;
  /** Prying tension (kN or kips) */
  pryingTension: number;
  /** Total tension (kN or kips) */
  totalTension: number;
  /** Combined stress ratio */
  combinedRatio: number;
}

// ============================================================================
// CAPACITY AND DESIGN RESULTS
// ============================================================================

/**
 * Bolt capacity calculation results
 */
export interface BoltCapacity {
  /** Nominal shear strength per bolt Rn (kN or kips) */
  nominalShearStrength: number;
  /** Design shear strength φRn or Rn/Ω (kN or kips) */
  designShearStrength: number;
  /** Nominal tensile strength per bolt Rn (kN or kips) */
  nominalTensileStrength: number;
  /** Design tensile strength φRn or Rn/Ω (kN or kips) */
  designTensileStrength: number;
  /** Slip resistance per bolt (kN or kips) for slip-critical */
  slipResistance?: number;
  /** Number of shear planes */
  numShearPlanes: number;
  /** Threads in shear plane? */
  threadsInShearPlane: boolean;
  /** Reduction factors applied */
  reductionFactors: {
    phi?: number;     // LRFD resistance factor
    omega?: number;   // ASD safety factor
    fillerPlate?: number;
    longConnection?: number;
  };
}

/**
 * Bearing capacity at bolt holes
 */
export interface BearingCapacity {
  /** Nominal bearing strength Rn (kN or kips) */
  nominalStrength: number;
  /** Design bearing strength (kN or kips) */
  designStrength: number;
  /** Bearing deformation considered? */
  deformationConsidered: boolean;
  /** Clear distance to edge Lc (mm or inches) */
  clearDistance: number;
  /** Tearout strength (kN or kips) */
  tearoutStrength: number;
  /** Governing mode */
  governingMode: 'BEARING' | 'TEAROUT';
}

/**
 * Block shear capacity
 */
export interface BlockShearCapacity {
  /** Gross area in shear Agv (mm² or in²) */
  grossShearArea: number;
  /** Net area in shear Anv (mm² or in²) */
  netShearArea: number;
  /** Gross area in tension Agt (mm² or in²) */
  grossTensionArea: number;
  /** Net area in tension Ant (mm² or in²) */
  netTensionArea: number;
  /** Nominal block shear strength Rn (kN or kips) */
  nominalStrength: number;
  /** Design block shear strength (kN or kips) */
  designStrength: number;
  /** Tension stress distribution factor Ubs */
  tensionStressFactor: number;
  /** Failure path description */
  failurePath: string;
}

/**
 * Prying action analysis results
 */
export interface PryingActionResults {
  /** Is prying significant? */
  isPryingSignificant: boolean;
  /** Prying force Q (kN or kips) */
  pryingForce: number;
  /** Prying ratio Q/T */
  pryingRatio: number;
  /** Required flange/plate thickness for no prying (mm or inches) */
  requiredThicknessNoPrying: number;
  /** Actual flange/plate thickness (mm or inches) */
  actualThickness: number;
  /** Tributary length per bolt b' (mm or inches) */
  tributaryLength: number;
  /** Distance from bolt to edge a (mm or inches) */
  distanceToEdge: number;
  /** Distance from bolt to web/stiffener b (mm or inches) */
  distanceToWeb: number;
  /** Flange flexibility parameter α' */
  flexibilityParameter: number;
  /** Effective tee stub length (mm or inches) */
  effectiveTeeLength: number;
}

// ============================================================================
// COMPLETE CONNECTION DEFINITION
// ============================================================================

/**
 * Complete bolted connection definition and results
 */
export interface BoltedConnection {
  id: string;
  name: string;
  description?: string;
  
  // Classification
  connectionType: ConnectionType;
  loadingType: LoadingType;
  designCode: DesignCode;
  designMethod: 'LRFD' | 'ASD';
  
  // Geometry
  boltPattern: BoltPattern;
  plates: ConnectionPlate[];
  connectedMembers: {
    beam?: ConnectedMember;
    column?: ConnectedMember;
    brace?: ConnectedMember;
  };
  
  // Loads
  loads: ConnectionLoads[];
  governingLoadCase?: string;
  
  // Capacities
  boltCapacities: Map<string, BoltCapacity>;
  bearingCapacities: Map<string, BearingCapacity>;
  blockShearCapacity?: BlockShearCapacity;
  pryingResults?: PryingActionResults;
  
  // Forces
  boltForces: Map<string, BoltForces>;
  maxBoltForce?: BoltForces;
  
  // Design checks
  designChecks: DesignCheck[];
  governingCheck?: DesignCheck;
  
  // Overall results
  overallDCR: number;  // Demand-to-capacity ratio
  isAdequate: boolean;
  failureModes: FailureMode[];
  recommendations?: string[];
  
  // Metadata
  createdAt: Date;
  modifiedAt: Date;
  createdBy?: string;
  notes?: string;
}

/**
 * Connected structural member
 */
export interface ConnectedMember {
  id: string;
  name: string;
  /** Section designation (e.g., "W14x90", "HEA 300") */
  section: string;
  /** Member type */
  type: 'BEAM' | 'COLUMN' | 'BRACE' | 'GIRDER';
  /** Material properties */
  material: SteelMaterialProperties;
  /** Section properties */
  properties: SectionProperties;
  /** Coped/cut dimensions */
  cope?: {
    top: { depth: number; length: number };
    bottom: { depth: number; length: number };
  };
}

/**
 * Section properties for connected member
 */
export interface SectionProperties {
  /** Gross area A (mm² or in²) */
  area: number;
  /** Moment of inertia Ix (mm⁴ or in⁴) */
  Ix: number;
  /** Moment of inertia Iy (mm⁴ or in⁴) */
  Iy: number;
  /** Section modulus Sx (mm³ or in³) */
  Sx: number;
  /** Section modulus Sy (mm³ or in³) */
  Sy: number;
  /** Plastic modulus Zx (mm³ or in³) */
  Zx: number;
  /** Plastic modulus Zy (mm³ or in³) */
  Zy: number;
  /** Radius of gyration rx (mm or inches) */
  rx: number;
  /** Radius of gyration ry (mm or inches) */
  ry: number;
  /** Depth d (mm or inches) */
  depth: number;
  /** Flange width bf (mm or inches) */
  flangeWidth: number;
  /** Flange thickness tf (mm or inches) */
  flangeThickness: number;
  /** Web thickness tw (mm or inches) */
  webThickness: number;
  /** Fillet radius k (mm or inches) */
  filletRadius: number;
}

/**
 * Individual design check result
 */
export interface DesignCheck {
  id: string;
  /** Check description */
  name: string;
  /** Limit state being checked */
  limitState: FailureMode;
  /** Required/demand value */
  demand: number;
  /** Available/capacity value */
  capacity: number;
  /** Demand-to-capacity ratio */
  dcr: number;
  /** Pass/fail status */
  passed: boolean;
  /** Utilization percentage */
  utilization: number;
  /** Code reference (clause number) */
  codeReference: string;
  /** Detailed calculation steps */
  calculationSteps?: CalculationStep[];
  /** Warning messages */
  warnings?: string[];
}

/**
 * Step-by-step calculation for documentation
 */
export interface CalculationStep {
  stepNumber: number;
  description: string;
  formula: string;
  variables: Record<string, { value: number; unit: string; description: string }>;
  result: number;
  unit: string;
}

// ============================================================================
// DESIGN REQUIREMENTS & CODE PROVISIONS
// ============================================================================

/**
 * Minimum edge distance requirements
 */
export interface EdgeDistanceRequirements {
  /** Minimum edge distance (mm or inches) */
  minimum: number;
  /** Preferred edge distance (mm or inches) */
  preferred: number;
  /** Maximum edge distance (mm or inches) */
  maximum: number;
  /** Based on bolt diameter multiplier */
  multiplier: number;
  /** Edge type */
  edgeType: 'SHEARED' | 'ROLLED' | 'GAS_CUT' | 'SAWN';
}

/**
 * Minimum spacing requirements
 */
export interface SpacingRequirements {
  /** Minimum spacing (mm or inches) */
  minimum: number;
  /** Preferred spacing (mm or inches) */
  preferred: number;
  /** Maximum spacing (mm or inches) */
  maximum: number;
  /** Based on bolt diameter multiplier */
  multiplier: number;
}

/**
 * Code-specific design parameters
 */
export interface DesignCodeParameters {
  code: DesignCode;
  
  // Resistance/safety factors
  phiBoltShear: number;      // φ for bolt shear (LRFD)
  phiBoltTension: number;    // φ for bolt tension (LRFD)
  phiBearing: number;        // φ for bearing (LRFD)
  phiBlockShear: number;     // φ for block shear (LRFD)
  phiSlip: number;           // φ for slip (LRFD)
  
  omegaBoltShear: number;    // Ω for bolt shear (ASD)
  omegaBoltTension: number;  // Ω for bolt tension (ASD)
  omegaBearing: number;      // Ω for bearing (ASD)
  omegaBlockShear: number;   // Ω for block shear (ASD)
  omegaSlip: number;         // Ω for slip (ASD)
  
  // Edge distance requirements
  edgeDistanceRequirements: Map<number, EdgeDistanceRequirements>;
  
  // Spacing requirements
  spacingRequirements: Map<number, SpacingRequirements>;
  
  // Hole size additions
  standardHoleAddition: number;
  oversizedHoleAddition: number;
  
  // Faying surface coefficients
  classASurface: number;     // μ for Class A
  classBSurface: number;     // μ for Class B
  classCsurface: number;     // μ for Class C
  
  // Combined stress interaction equation coefficients
  combinedStressCoefficients: {
    shearExponent: number;
    tensionExponent: number;
  };
}

// ============================================================================
// ANALYSIS OPTIONS & SETTINGS
// ============================================================================

/**
 * Analysis options and preferences
 */
export interface ConnectionAnalysisOptions {
  /** Design method */
  designMethod: 'LRFD' | 'ASD';
  /** Include prying action analysis */
  includePrying: boolean;
  /** Include second-order effects */
  includeSecondOrder: boolean;
  /** Consider deformation at bolt holes */
  considerBoltHoleDeformation: boolean;
  /** Slip-critical at service or strength level */
  slipCheckLevel: 'SERVICE' | 'STRENGTH';
  /** Include fatigue checks */
  includeFatigue: boolean;
  /** Seismic design category */
  seismicCategory?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  /** Require special seismic detailing */
  requireSeismicDetailing: boolean;
  /** Output calculation details */
  outputDetailedCalculations: boolean;
  /** Unit system */
  unitSystem: 'SI' | 'IMPERIAL';
  /** Significant figures for output */
  significantFigures: number;
}

// ============================================================================
// STANDARD BOLT DATA TABLES
// ============================================================================

/**
 * Pre-defined bolt data for common sizes
 */
export interface StandardBoltTable {
  grade: BoltGrade;
  data: {
    designation: string;
    diameter: number;
    area: number;
    tensileArea: number;
    tensileStrength: number;
    shearStrength: number;
    pretension: number;
    minEdgeDistance: number;
    minSpacing: number;
  }[];
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Connection design report data
 */
export interface ConnectionReport {
  connection: BoltedConnection;
  title: string;
  projectInfo: {
    projectName: string;
    projectNumber: string;
    engineer: string;
    checker?: string;
    date: Date;
  };
  summary: {
    connectionType: string;
    designCode: string;
    overallResult: 'ADEQUATE' | 'INADEQUATE' | 'NEEDS_REVIEW';
    criticalCheck: string;
    maxDCR: number;
  };
  detailedChecks: DesignCheck[];
  sketches: {
    planView?: string;    // SVG or base64 image
    elevation?: string;
    section?: string;
    details?: string[];
  };
  calculations: CalculationStep[];
  notes: string[];
  revisions: {
    rev: string;
    date: Date;
    description: string;
    by: string;
  }[];
}

export default BoltedConnection;

// ============================================================================
// CONVENIENCE TYPE ALIASES & ADDITIONAL EXPORTS
// ============================================================================

/**
 * Design method type alias for easier imports
 */
export type DesignMethod = 'LRFD' | 'ASD';

/**
 * Common steel grades for quick selection
 */
export enum SteelGrade {
  // ASTM Grades (USA)
  A36 = 'A36',
  A572_50 = 'A572-50',
  A572_65 = 'A572-65',
  A992 = 'A992',
  A500_B = 'A500B',
  A500_C = 'A500C',
  A514 = 'A514',
  
  // European Grades
  S235 = 'S235',
  S275 = 'S275',
  S355 = 'S355',
  S420 = 'S420',
  S460 = 'S460',
  
  // Indian Grades
  E250 = 'E250',
  E300 = 'E300',
  E350 = 'E350',
  E410 = 'E410',
  E450 = 'E450',
}

/**
 * Simplified bolt grade aliases for common usage
 * Maps common shorthand names to full enum values
 */
export const BoltGradeAlias = {
  A307: BoltGrade.ASTM_A307,
  A325: BoltGrade.ASTM_A325,
  A490: BoltGrade.ASTM_A490,
  '4.6': BoltGrade.ISO_4_6,
  '8.8': BoltGrade.ISO_8_8,
  '10.9': BoltGrade.ISO_10_9,
} as const;

/**
 * Simplified connection model for UI forms
 * This is a flattened representation easier to work with in forms
 */
export interface ConnectionFormData {
  // Basic info
  name: string;
  description?: string;
  connectionType: ConnectionType;
  loadingType: LoadingType;
  designCode: DesignCode;
  designMethod: DesignMethod;
  
  // Geometry (flattened for form binding)
  geometry: {
    plateWidth: number;
    plateHeight: number;
    plateThickness: number;
    numRows: number;
    numColumns: number;
    pitchVertical: number;
    pitchHorizontal: number;
    edgeDistanceTop: number;
    edgeDistanceBottom: number;
    edgeDistanceLeft: number;
    edgeDistanceRight: number;
  };
  
  // Bolt properties (flattened)
  bolt: {
    diameter: number;
    grade: BoltGrade;
    holeType: BoltHoleType;
    behavior: BoltBehavior;
  };
  
  // Plate material
  plate: {
    grade: SteelGrade;
    thickness: number;
  };
  
  // Loads (simplified single load case)
  loads: {
    shearX: number;
    shearY: number;
    axial: number;
    momentX: number;
    momentY: number;
  };
}

/**
 * Helper function to convert form data to full BoltedConnection
 */
export function formDataToConnection(formData: ConnectionFormData): Partial<BoltedConnection> {
  const boltSpec: BoltSpecification = {
    id: `bolt-${formData.bolt.diameter}-${formData.bolt.grade}`,
    geometry: {
      diameter: formData.bolt.diameter,
      designation: `M${formData.bolt.diameter}`,
      nominalArea: Math.PI * Math.pow(formData.bolt.diameter / 2, 2),
      tensileArea: Math.PI * Math.pow(formData.bolt.diameter / 2, 2) * 0.75,
      shankArea: Math.PI * Math.pow(formData.bolt.diameter / 2, 2),
      threadPitch: formData.bolt.diameter <= 16 ? 2 : 2.5,
      threadLength: formData.bolt.diameter * 2,
      headHeight: formData.bolt.diameter * 0.65,
      headWidth: formData.bolt.diameter * 1.5,
      nutHeight: formData.bolt.diameter * 0.8,
      washerOD: formData.bolt.diameter * 2,
      washerID: formData.bolt.diameter + 1,
      washerThickness: 3,
    },
    material: getBoltMaterialProperties(formData.bolt.grade),
    holeType: formData.bolt.holeType,
    behavior: formData.bolt.behavior,
  };

  return {
    id: `conn-${Date.now()}`,
    name: formData.name,
    description: formData.description,
    connectionType: formData.connectionType,
    loadingType: formData.loadingType,
    designCode: formData.designCode,
    designMethod: formData.designMethod,
    boltPattern: {
      id: `pattern-${Date.now()}`,
      name: 'Main Pattern',
      numRows: formData.geometry.numRows,
      numColumns: formData.geometry.numColumns,
      totalBolts: formData.geometry.numRows * formData.geometry.numColumns,
      pitchVertical: formData.geometry.pitchVertical,
      pitchHorizontal: formData.geometry.pitchHorizontal,
      edgeDistanceTop: formData.geometry.edgeDistanceTop,
      edgeDistanceBottom: formData.geometry.edgeDistanceBottom,
      edgeDistanceLeft: formData.geometry.edgeDistanceLeft,
      edgeDistanceRight: formData.geometry.edgeDistanceRight,
      defaultBoltSpec: boltSpec,
      positions: [],
      geometryType: 'RECTANGULAR',
      centroid: { x: 0, y: 0, z: 0 },
      polarMomentOfInertia: 0,
    },
    plates: [{
      id: 'main-plate',
      type: 'GUSSET',
      material: getSteelMaterialProperties(formData.plate.grade),
      thickness: formData.plate.thickness,
      width: formData.geometry.plateWidth,
      height: formData.geometry.plateHeight,
      grossArea: formData.geometry.plateWidth * formData.plate.thickness,
    }],
    loads: [{
      loadCase: 'LC1',
      isFactored: true,
      shearForce: {
        Vx: formData.loads.shearX,
        Vy: formData.loads.shearY,
      },
      axialForce: formData.loads.axial,
      moment: {
        Mx: formData.loads.momentX,
        My: formData.loads.momentY,
      },
    }],
    createdAt: new Date(),
    modifiedAt: new Date(),
  };
}

/**
 * Get bolt material properties from grade
 */
export function getBoltMaterialProperties(grade: BoltGrade): BoltMaterialProperties {
  const properties: Record<string, BoltMaterialProperties> = {
    [BoltGrade.ASTM_A307]: {
      grade: BoltGrade.ASTM_A307,
      tensileStrength: 414,
      shearStrength: 248,
      yieldStrength: 248,
      elasticModulus: 200000,
      proofLoad: 207,
      unitSystem: 'METRIC',
    },
    [BoltGrade.ASTM_A325]: {
      grade: BoltGrade.ASTM_A325,
      tensileStrength: 827,
      shearStrength: 457,
      yieldStrength: 634,
      elasticModulus: 200000,
      proofLoad: 586,
      unitSystem: 'METRIC',
    },
    [BoltGrade.ASTM_A490]: {
      grade: BoltGrade.ASTM_A490,
      tensileStrength: 1034,
      shearStrength: 579,
      yieldStrength: 896,
      elasticModulus: 200000,
      proofLoad: 827,
      unitSystem: 'METRIC',
    },
    [BoltGrade.ISO_8_8]: {
      grade: BoltGrade.ISO_8_8,
      tensileStrength: 800,
      shearStrength: 440,
      yieldStrength: 640,
      elasticModulus: 200000,
      proofLoad: 580,
      unitSystem: 'METRIC',
    },
    [BoltGrade.ISO_10_9]: {
      grade: BoltGrade.ISO_10_9,
      tensileStrength: 1000,
      shearStrength: 560,
      yieldStrength: 900,
      elasticModulus: 200000,
      proofLoad: 830,
      unitSystem: 'METRIC',
    },
  };
  
  return properties[grade] || properties[BoltGrade.ASTM_A325];
}

/**
 * Get steel material properties from grade
 */
export function getSteelMaterialProperties(grade: SteelGrade): SteelMaterialProperties {
  const properties: Record<string, SteelMaterialProperties> = {
    [SteelGrade.A36]: {
      grade: 'A36',
      yieldStrength: 250,
      ultimateStrength: 400,
      elasticModulus: 200000,
      shearModulus: 77000,
      poissonRatio: 0.3,
      density: 7850,
      thermalExpansion: 12e-6,
    },
    [SteelGrade.A992]: {
      grade: 'A992',
      yieldStrength: 345,
      ultimateStrength: 450,
      elasticModulus: 200000,
      shearModulus: 77000,
      poissonRatio: 0.3,
      density: 7850,
      thermalExpansion: 12e-6,
    },
    [SteelGrade.S355]: {
      grade: 'S355',
      yieldStrength: 355,
      ultimateStrength: 490,
      elasticModulus: 210000,
      shearModulus: 81000,
      poissonRatio: 0.3,
      density: 7850,
      thermalExpansion: 12e-6,
    },
    [SteelGrade.E350]: {
      grade: 'E350',
      yieldStrength: 350,
      ultimateStrength: 490,
      elasticModulus: 200000,
      shearModulus: 77000,
      poissonRatio: 0.3,
      density: 7850,
      thermalExpansion: 12e-6,
    },
  };
  
  return properties[grade] || properties[SteelGrade.A36];
}

/**
 * Analysis result summary for UI display
 */
export interface ConnectionAnalysisResult {
  connectionId: string;
  isAdequate: boolean;
  overallDCR: number;
  criticalCheck: {
    name: string;
    dcr: number;
    failureMode: FailureMode;
    codeReference: string;
  };
  checks: DesignCheck[];
  boltForces: {
    maxShear: number;
    maxTension: number;
    maxCombined: number;
  };
  capacities: {
    boltShear: number;
    boltTension: number;
    bearing: number;
    blockShear: number;
    slipResistance?: number;
  };
  warnings: string[];
  recommendations: string[];
}
