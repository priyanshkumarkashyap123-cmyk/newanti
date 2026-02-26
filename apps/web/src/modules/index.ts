/**
 * ============================================================================
 * MODULES INDEX - COMPREHENSIVE STRUCTURAL ENGINEERING LIBRARY
 * ============================================================================
 * 
 * Central export for all engineering modules
 * 
 * INDIAN STANDARD CODES:
 * - IS 456:2000 - Plain and Reinforced Concrete
 * - IS 800:2007 - General Construction in Steel  
 * - IS 875:1987/2015 - Design Loads (Parts 1-3)
 * - IS 1893:2016 - Earthquake Resistant Design
 * - IS 2911:2010 - Pile Foundations
 * - IS 13920:2016 - Ductile Detailing of RC
 * - IS 14458:2015 - Retaining Walls
 * 
 * AMERICAN CODES:
 * - ACI 318-19 - Structural Concrete
 * - AISC 360-22 - Structural Steel
 * - ASCE 7-22 - Design Loads
 * 
 * Modules:
 * - Loads: Load combinations, wind loads, seismic loads
 * - Steel: Beams, columns, composite beams
 * - Concrete: Deep beams, strut-and-tie, RC design
 * - Foundations: Pile foundations, retaining walls
 * - Connections: Bolted, welded, moment, bracing, joints, splices
 * - Reinforcement: Stirrups, development length, lap splices
 * - Detailing: Foundations, columns, beams, slabs, walls
 * - Core: Calculation engine, units, diagrams
 * 
 * @author BeamLab Engineering Team
 * @version 4.0.0 - IS Code Integration
 */

// ============================================================================
// CORE CALCULATION ENGINE
// ============================================================================
export {
  DesignCode,
  UnitSystem,
  DiagramType,
  createCalculationStep,
  createSimpleStep,
  roundTo,
  formatWithUnit,
  convertUnit,
  CalculationReportBuilder,
  UNIT_CONVERSIONS,
  MATERIAL_PROPERTIES,
  SAFETY_FACTORS,
} from './core/CalculationEngine';

export type {
  CalculationStep,
  DiagramData,
  SimpleCalculationStep,
} from './core/CalculationEngine';

// ============================================================================
// IS 456:2000 - CONCRETE DESIGN
// ============================================================================
export {
  // Constants
  IS456_CONCRETE_GRADES,
  IS456_STEEL_GRADES,
  IS456_PARTIAL_SAFETY_FACTORS,
  IS456_DESIGN_CONSTANTS,
  IS456_CLEAR_COVER,
  IS456_XU_D_LIMIT,
  IS456_BOND_STRESS,
  IS456_SPAN_DEPTH_RATIO,
  
  // Functions
  getConcreteDesignStrength,
  getSteelDesignStrength,
  getConcreteModulus,
  getLimitingMoment,
  getNeutralAxisDepth,
  getMomentCapacity,
  getRequiredTensionSteel,
  getShearCapacity as getIS456ShearCapacity,
  getMaxShearStress,
  getShearReinforcement,
  getDevelopmentLength,
  checkDeflection,
  getModificationFactorTension,
  getModificationFactorCompression,
  
  // Design functions
  designBeamIS456,
} from './codes/IS456';

export type {
  IS456BeamInput,
  IS456BeamResult,
} from './codes/IS456';

// ============================================================================
// IS 800:2007 - STEEL DESIGN
// ============================================================================
export {
  // Constants
  IS800_STEEL_GRADES,
  IS800_PARTIAL_SAFETY_FACTORS,
  IS800_CLASSIFICATION_LIMITS,
  IS800_BUCKLING_CURVES,
  IS800_EFFECTIVE_LENGTH_FACTORS,
  IS800_MAX_SLENDERNESS,
  IS800_BOLT_GRADES,
  E_STEEL,
  G_STEEL,
  
  // Functions
  getReducedYieldStress,
  getEpsilon,
  classifySection,
  getBucklingClass,
  getTensionCapacityNetSection,
  getBlockShearCapacity,
  getNonDimensionalSlenderness,
  getStressReductionFactor,
  getCompressionCapacity,
  getPlasticModulusI,
  getBendingCapacity,
  getLTBCapacity,
  getElasticCriticalMoment,
  getShearCapacity as getIS800ShearCapacity,
  getShearBucklingStrength,
  checkCombinedForces,
  getBoltShearCapacity,
  getBoltBearingCapacity,
  getBoltTensionCapacity,
  checkBoltCombined,
  getFilletWeldStrength,
  getMinFilletWeldSize,
  
  // Design functions
  designBeamIS800,
} from './codes/IS800';

export type {
  IS800BeamInput,
  IS800BeamResult,
} from './codes/IS800';

// ============================================================================
// IS 1893:2016 - SEISMIC DESIGN
// ============================================================================
export {
  // Constants
  IS1893_ZONE_FACTORS,
  IS1893_IMPORTANCE_FACTORS,
  IS1893_RESPONSE_REDUCTION_FACTORS,
  IS1893_SOIL_TYPES,
  IS1893_DAMPING_FACTORS,
  IS1893_DRIFT_LIMITS,
  
  // Functions
  getSaOverG,
  getApproximateTimePeriod,
  getMaxAllowableTimePeriod,
  getLiveLoadFactor,
  getSeismicWeight,
  calculateBaseShearIS1893,
  checkStoreyDrift,
  getDesignEccentricity,
  checkTorsionalIrregularity,
  getCombinedHorizontalForces,
  getVerticalSeismicCoefficient,
} from './codes/IS1893';

export type {
  TimePeriodParams,
  FloorWeight,
  SeismicInputIS1893,
  SeismicResultIS1893,
  DriftCheckInput,
} from './codes/IS1893';

// ============================================================================
// IS 875 - DESIGN LOADS
// ============================================================================
export {
  // Dead loads
  IS875_UNIT_WEIGHTS,
  calculateFloorDeadLoad,
  
  // Live loads
  IS875_IMPOSED_LOADS,
  getImposedLoadReduction,
  
  // Wind loads
  IS875_BASIC_WIND_SPEEDS,
  IS875_TERRAIN_CATEGORIES,
  IS875_K1_FACTORS,
  IS875_FORCE_COEFFICIENTS,
  getK2Factor,
  getK3Factor,
  getK4Factor,
  getDesignWindSpeed,
  getDesignWindPressure,
  calculateWindLoadIS875,
} from './codes/IS875';

export type {
  FloorDeadLoadInput,
  WindLoadInputIS875,
  WindLoadResultIS875,
} from './codes/IS875';

// ============================================================================
// IS 2911 - PILE FOUNDATIONS
// ============================================================================
export {
  // Constants
  IS2911_SAFETY_FACTORS,
  IS2911_BEARING_CAPACITY_FACTORS,
  IS2911_EARTH_PRESSURE_COEFFICIENTS,
  IS2911_SKIN_FRICTION_ANGLE,
  IS2911_LIMITING_SKIN_FRICTION,
  IS2911_LIMITING_END_BEARING,
  
  // Functions
  getAdhesionFactor,
  calculatePileCapacityIS2911,
  calculatePileGroupCapacity,
  designPileStructural,
} from './codes/IS2911';

export type {
  PileType,
  SoilType,
  SoilLayer,
  PileCapacityInput,
  PileCapacityResult,
  PileGroupInput,
  PileGroupResult,
  PileStructuralDesignInput,
  PileStructuralResult,
} from './codes/IS2911';

// ============================================================================
// AMERICAN CODES - LOAD ANALYSIS (ASCE 7-22)
// ============================================================================
// Load combinations, wind loads, seismic loads
// Using namespace imports to avoid conflicts
export * as ASCE7 from './loads';

// ============================================================================
// AMERICAN CODES - STEEL DESIGN (AISC 360-22)
// ============================================================================
// Steel beams, columns, composite beams
export * as AISC360 from './steel';

// ============================================================================
// WEB LOCAL EFFECTS (IS 800 / AISC 360)
// ============================================================================
export {
  // Check functions
  checkWebLocalYielding,
  checkWebCrippling,
  checkWebSideswayBuckling,
  checkWebCompressionBuckling,
  checkWebStrength,
  
  // Stiffener design
  designBearingStiffener,
  
  // Constants
  WEB_RESISTANCE_FACTORS,
  AISC_RESISTANCE_FACTORS,
  WEB_CHECK_QUICK_REFERENCE,
} from './steel/WebCrippling';

export type {
  WebYieldingInput,
  WebYieldingResult,
  WebCripplingInput,
  WebCripplingResult,
  WebBucklingInput,
  WebBucklingResult,
  StiffenerDesignInput,
  StiffenerDesignResult,
  WebCheckInput,
  WebCheckResult,
} from './steel/WebCrippling';

// ============================================================================
// AMERICAN CODES - CONCRETE DESIGN (ACI 318-19)
// ============================================================================
// Deep beams, strut-and-tie models
export * as ACI318 from './concrete';

// ============================================================================
// FOUNDATION DESIGN (AASHTO/ACI)
// ============================================================================
// Pile foundations, retaining walls
export * as Foundations from './foundations';

// ============================================================================
// CONNECTIONS MODULE
// ============================================================================
// Connections (Bolted, Welded, Moment, Bracing, Joints, Splices)
export * as Connections from './connections';

// ============================================================================
// REINFORCEMENT MODULE
// ============================================================================
// Reinforcement (Stirrups, Development Length, Lap Splices)
export * as Reinforcement from './reinforcement';

// ============================================================================
// DETAILING MODULE
// ============================================================================
// Detailing (Foundations, Columns, Beams, Slabs, Walls)
export * as Detailing from './detailing';

// ============================================================================
// IS 13920:2016 - DUCTILE DETAILING
// ============================================================================
export {
  // Constants
  IS13920_REINFORCEMENT_LIMITS,
  IS13920_CONFINEMENT,
  IS13920_CAPACITY_DESIGN,
  IS13920_JOINT,
  IS13920_QUICK_REFERENCE,
  
  // Beam functions
  getMinBeamReinforcement,
  getMaxBeamReinforcement,
  getBeamCriticalLength,
  getBeamStirrupSpacingCritical,
  getBeamStirrupSpacingRegular,
  getCapacityDesignShear,
  designDuctileBeamIS13920,
  
  // Column functions
  getSpecialConfiningLength,
  getTieSpacingSpecial,
  getMinConfiningArea,
  designDuctileColumnIS13920,
  
  // Shear wall functions
  checkBoundaryElementRequired,
  getBoundaryElementLength,
  designShearWallIS13920,
  
  // Joint functions
  checkStrongColumnWeakBeam,
  checkJointShearStress,
} from './codes/IS13920';

export type {
  DuctileBeamInput,
  DuctileBeamResult,
  DuctileColumnInput,
  DuctileColumnResult,
  ShearWallInput,
  ShearWallResult,
} from './codes/IS13920';

// ============================================================================
// IS 1343:2012 - PRESTRESSED CONCRETE DESIGN
// ============================================================================
export {
  // Constants
  IS1343_CONCRETE_GRADES,
  IS1343_PRESTRESS_STEEL,
  IS1343_PERMISSIBLE_STRESSES,
  IS1343_STEEL_STRESS_LIMITS,
  IS1343_QUICK_REFERENCE,
  
  // Loss calculation functions
  calculateElasticShortening,
  calculateFrictionLoss,
  calculateAnchorageSlipLoss,
  calculateRelaxationLoss,
  calculateShrinkageLoss,
  calculateCreepLoss,
  calculateTotalPrestressLosses,
  
  // Design functions
  designPrestressedBeamIS1343,
  calculatePrestressedShearCapacity,
  calculateTransmissionLength,
} from './codes/IS1343';

export type {
  PrestressLossInput,
  PrestressLossResult,
  PrestressedBeamInput,
  PrestressedBeamResult,
  PrestressedShearInput,
} from './codes/IS1343';

// ============================================================================
// IS 1905:1987 - STRUCTURAL MASONRY DESIGN
// ============================================================================
export {
  // Constants
  IS1905_BASIC_COMPRESSIVE_STRENGTH,
  IS1905_MORTAR_TYPES,
  IS1905_SHAPE_FACTOR,
  IS1905_STRESS_REDUCTION,
  IS1905_PERMISSIBLE_SHEAR,
  IS1905_PERMISSIBLE_TENSION,
  IS1905_QUICK_REFERENCE,
  
  // Helper functions
  getEffectiveHeight,
  getEffectiveThickness,
  calculateSlendernessRatio,
  getBasicCompressiveStress,
  getStressReductionFactor as getMasonryStressReductionFactor,
  calculateOpeningReduction,
  
  // Design functions
  designMasonryWallIS1905,
  designMasonryColumnIS1905,
} from './codes/IS1905';

export type {
  MasonryWallInput,
  MasonryWallResult,
  MasonryColumnInput,
  MasonryColumnResult,
} from './codes/IS1905';

// ============================================================================
// IS 883:1994 - STRUCTURAL TIMBER DESIGN
// ============================================================================
export {
  // Constants
  IS883_PERMISSIBLE_STRESSES,
  IS883_TIMBER_SPECIES,
  IS883_MODIFICATION_FACTORS,
  IS883_EFFECTIVE_LENGTH_FACTORS,
  IS883_DEFLECTION_LIMITS,
  IS883_QUICK_REFERENCE,
  
  // Helper functions
  calculateTimberSectionProperties,
  getModificationFactors,
  
  // Design functions
  designTimberBeamIS883,
  designTimberColumnIS883,
  designNailedConnectionIS883,
} from './codes/IS883';

export type {
  TimberGrade,
  TimberBeamInput,
  TimberBeamResult,
  TimberColumnInput,
  TimberColumnResult,
  NailedConnectionInput,
  NailedConnectionResult,
} from './codes/IS883';

// ============================================================================
// INDIAN STANDARD STEEL SECTION DATABASE
// ============================================================================
export {
  // Section database
  ISMB_SECTIONS,
  ISMC_SECTIONS,
  ISA_EQUAL_SECTIONS,
  SHS_SECTIONS,
  RHS_SECTIONS,
  CHS_SECTIONS,
  ALL_IS_SECTIONS,
  
  // Utility functions
  getSectionsByType,
  getSectionByDesignation,
  findOptimalSection,
  calculateSectionUtilization,
} from './data/ISSteelSections';

export type {
  ISteelSection,
  SectionType,
  SectionFilter,
} from './data/ISSteelSections';

// ============================================================================
// DIAGRAM UTILITIES
// ============================================================================
export {
  SVG_DEFAULTS,
  createSvgElement,
  createGroup,
  createDimensionLine,
  createArrowMarkers,
  generateBeamCrossSection,
  generateStressBlockDiagram,
  generateMomentDiagram,
  generateInteractionDiagram,
  generateReinforcementDetail,
  generateDiagram,
} from './utils/DiagramGenerator';

export type {
  BeamCrossSectionData,
  ColumnCrossSectionData,
  StressBlockData,
  MomentDiagramData,
  ShearDiagramData,
  DeflectionData,
  InteractionDiagramData,
  ReinforcementLayoutData,
} from './utils/DiagramGenerator';

// ============================================================================
// CODE SELECTION UTILITY
// ============================================================================

/**
 * Available design code standards
 */
export const AVAILABLE_CODES = {
  indian: {
    concrete: 'IS_456',
    steel: 'IS_800',
    loads_dead: 'IS_875_1',
    loads_live: 'IS_875_2',
    loads_wind: 'IS_875_3',
    seismic: 'IS_1893',
    piles: 'IS_2911',
    ductile_detailing: 'IS_13920',
    retaining_walls: 'IS_14458',
  },
  american: {
    concrete: 'ACI_318',
    steel: 'AISC_360',
    loads: 'ASCE_7',
  },
  european: {
    concrete: 'EUROCODE_2',
    steel: 'EUROCODE_3',
    geotechnical: 'EUROCODE_7',
    seismic: 'EUROCODE_8',
  },
} as const;

/**
 * Code descriptions for UI
 */
export const CODE_DESCRIPTIONS = {
  IS_456: 'IS 456:2000 - Plain and Reinforced Concrete (Fourth Revision)',
  IS_800: 'IS 800:2007 - General Construction in Steel (Third Revision)',
  IS_875_1: 'IS 875-1:1987 - Dead Loads',
  IS_875_2: 'IS 875-2:1987 - Imposed Loads',
  IS_875_3: 'IS 875-3:2015 - Wind Loads (Third Revision)',
  IS_883: 'IS 883:1994 - Design of Structural Timber in Building',
  IS_1343: 'IS 1343:2012 - Prestressed Concrete (Second Revision)',
  IS_1893: 'IS 1893:2016 - Earthquake Resistant Design (Part 1)',
  IS_1905: 'IS 1905:1987 - Structural Use of Unreinforced Masonry',
  IS_2911: 'IS 2911:2010 - Design and Construction of Pile Foundations',
  IS_13920: 'IS 13920:2016 - Ductile Design and Detailing of RC Structures',
  IS_14458: 'IS 14458:2015 - Retaining Walls',
  ACI_318: 'ACI 318-19 - Building Code Requirements for Structural Concrete',
  AISC_360: 'AISC 360-22 - Specification for Structural Steel Buildings',
  ASCE_7: 'ASCE 7-22 - Minimum Design Loads and Associated Criteria',
} as const;

/**
 * Quick reference for IS 456 design constants
 */
export const IS456_QUICK_REFERENCE = {
  material_factors: { γc: 1.5, γs: 1.15 },
  stress_block: { depth_factor: 0.42, stress_factor: 0.36 },
  min_reinforcement: {
    beams_tension: '0.85bd/fy or 0.12% of bD',
    slabs: '0.12% for Fe415, 0.15% for Fe250',
    columns: '0.8% minimum, 6% maximum',
  },
  clear_cover: {
    slabs: '20mm (mild), 30mm (moderate)',
    beams: '25mm (mild), 30mm (moderate)',
    columns: '40mm (all)',
    foundations: '50mm (minimum)',
  },
};

/**
 * Quick reference for IS 800 design constants
 */
export const IS800_QUICK_REFERENCE = {
  material_factors: { γm0: 1.10, γm1: 1.25, γmw: 1.25, γmb: 1.25 },
  buckling_curves: { a: 'α = 0.21', b: 'α = 0.34', c: 'α = 0.49', d: 'α = 0.76' },
  max_slenderness: { compression: 180, tension: 400, bracing: 250 },
};

/**
 * Quick reference for IS 1893 parameters
 */
export const IS1893_QUICK_REFERENCE = {
  zones: { II: 'Z = 0.10', III: 'Z = 0.16', IV: 'Z = 0.24', V: 'Z = 0.36' },
  time_period: {
    RC_frame: 'Ta = 0.075h^0.75',
    steel_frame: 'Ta = 0.085h^0.75',
    shear_wall: 'Ta = 0.09h/√d',
  },
  drift_limit: '0.004h (storey height)',
};

// ============================================================================
// VERSION INFO
// ============================================================================

export const MODULE_VERSION = {
  version: '5.0.0',
  lastUpdated: '2024-01-20',
  codes: [
    'IS 456:2000', 'IS 800:2007', 'IS 875:1987/2015', 'IS 883:1994',
    'IS 1343:2012', 'IS 1893:2016', 'IS 1905:1987', 'IS 2911:2010', 'IS 13920:2016',
    'ACI 318-19', 'AISC 360-22', 'ASCE 7-22',
  ],
  features: [
    'Complete IS code implementation',
    'Prestressed concrete design (IS 1343)',
    'Masonry design (IS 1905)',
    'Timber design (IS 883)',
    'Indian Standard Steel Section database',
    'Detailed calculation steps with formulas',
    'LaTeX formula support',
    'Diagram generation',
    'Code clause references',
    'Unit conversion utilities',
    'Material property databases',
  ],
};
