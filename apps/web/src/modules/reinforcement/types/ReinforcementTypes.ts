/**
 * ============================================================================
 * REINFORCEMENT DESIGN TYPES - Comprehensive Type Definitions
 * ============================================================================
 * 
 * Complete type system for reinforced concrete design including:
 * - Shear reinforcement (stirrups/links)
 * - Development lengths
 * - Lap splices
 * - Anchorage
 * 
 * Supports: ACI 318, Eurocode 2, IS 456, BS 8110
 * 
 * @author BeamLab Engineering Team
 * @version 1.0.0
 */

// ============================================================================
// ENUMERATIONS
// ============================================================================

/**
 * Design codes for reinforced concrete
 */
export enum ConcreteDesignCode {
  ACI_318_19 = 'ACI_318_19',      // ACI 318-19 (USA)
  ACI_318_14 = 'ACI_318_14',      // ACI 318-14 (USA)
  EUROCODE_2 = 'EC2_EN1992',      // Eurocode 2 EN 1992-1-1
  IS_456_2000 = 'IS_456_2000',    // IS 456:2000 (India)
  BS_8110 = 'BS_8110',            // BS 8110 (UK - legacy)
  AS_3600 = 'AS_3600',            // AS 3600 (Australia)
  CSA_A23 = 'CSA_A23',            // CSA A23.3 (Canada)
}

/**
 * Reinforcement bar grades/types
 */
export enum RebarGrade {
  // US Grades (ASTM A615/A706)
  GRADE_40 = 'GR40',              // 40 ksi (276 MPa)
  GRADE_60 = 'GR60',              // 60 ksi (420 MPa)
  GRADE_75 = 'GR75',              // 75 ksi (517 MPa)
  GRADE_80 = 'GR80',              // 80 ksi (550 MPa)
  GRADE_100 = 'GR100',            // 100 ksi (690 MPa)
  
  // Metric Grades
  FE_250 = 'Fe250',               // 250 MPa (mild steel)
  FE_415 = 'Fe415',               // 415 MPa
  FE_500 = 'Fe500',               // 500 MPa
  FE_550 = 'Fe550',               // 550 MPa
  FE_600 = 'Fe600',               // 600 MPa
  
  // European Grades
  B500A = 'B500A',                // 500 MPa Class A
  B500B = 'B500B',                // 500 MPa Class B
  B500C = 'B500C',                // 500 MPa Class C (high ductility)
  
  // Stainless Steel
  SS_316 = 'SS316',               // Stainless 316
  SS_304 = 'SS304',               // Stainless 304
}

/**
 * Standard bar sizes (US customary)
 */
export enum USBarSize {
  NO_3 = '#3',   // 3/8" = 9.5mm
  NO_4 = '#4',   // 1/2" = 12.7mm
  NO_5 = '#5',   // 5/8" = 15.9mm
  NO_6 = '#6',   // 3/4" = 19.1mm
  NO_7 = '#7',   // 7/8" = 22.2mm
  NO_8 = '#8',   // 1" = 25.4mm
  NO_9 = '#9',   // 1-1/8" = 28.7mm
  NO_10 = '#10', // 1-1/4" = 32.3mm
  NO_11 = '#11', // 1-3/8" = 35.8mm
  NO_14 = '#14', // 1-3/4" = 43.0mm
  NO_18 = '#18', // 2-1/4" = 57.3mm
}

/**
 * Standard bar sizes (Metric)
 */
export enum MetricBarSize {
  D6 = '6mm',
  D8 = '8mm',
  D10 = '10mm',
  D12 = '12mm',
  D14 = '14mm',
  D16 = '16mm',
  D20 = '20mm',
  D22 = '22mm',
  D25 = '25mm',
  D28 = '28mm',
  D32 = '32mm',
  D36 = '36mm',
  D40 = '40mm',
}

/**
 * Stirrup/link configurations
 */
export enum StirrupType {
  TWO_LEGGED = '2L',              // Standard 2-leg stirrup
  FOUR_LEGGED = '4L',             // 4-leg for wide beams
  SIX_LEGGED = '6L',              // 6-leg for very wide beams
  CLOSED = 'CLOSED',              // Closed stirrup (torsion)
  OPEN = 'OPEN',                  // Open U-stirrup
  SPIRAL = 'SPIRAL',              // Spiral reinforcement
  HELICAL = 'HELICAL',            // Helical ties
  DIAMOND = 'DIAMOND',            // Diamond pattern
}

/**
 * Hook types for anchorage
 */
export enum HookType {
  STANDARD_90 = '90DEG',          // 90° hook
  STANDARD_180 = '180DEG',        // 180° hook (U-hook)
  STIRRUP_90 = 'STIRRUP_90',      // 90° stirrup hook
  STIRRUP_135 = 'STIRRUP_135',    // 135° seismic hook
  HEADED = 'HEADED',              // Headed bar (mechanical)
  NONE = 'STRAIGHT',              // Straight bar (no hook)
}

/**
 * Bar coating types
 */
export enum BarCoating {
  UNCOATED = 'UNCOATED',
  EPOXY_COATED = 'EPOXY',
  GALVANIZED = 'GALVANIZED',
  ZINC_EPOXY = 'ZINC_EPOXY',
}

/**
 * Concrete exposure conditions
 */
export enum ExposureCondition {
  INTERIOR_DRY = 'INTERIOR_DRY',
  INTERIOR_HUMID = 'INTERIOR_HUMID',
  EXTERIOR_NORMAL = 'EXTERIOR',
  MARINE = 'MARINE',
  AGGRESSIVE = 'AGGRESSIVE',
  FREEZE_THAW = 'FREEZE_THAW',
}

/**
 * Lap splice class/type
 */
export enum LapSpliceClass {
  CLASS_A = 'A',                  // Minimum lap (low stress)
  CLASS_B = 'B',                  // Standard lap (high stress)
  CONTACT = 'CONTACT',            // Bars in contact
  NON_CONTACT = 'NON_CONTACT',    // Bars spaced apart
  TENSION = 'TENSION',
  COMPRESSION = 'COMPRESSION',
}

/**
 * Member types for detailing
 */
export enum MemberType {
  BEAM = 'BEAM',
  COLUMN = 'COLUMN',
  SLAB = 'SLAB',
  WALL = 'WALL',
  FOOTING = 'FOOTING',
  PILE = 'PILE',
  RETAINING_WALL = 'RETAINING',
}

/**
 * Seismic design category
 */
export enum SeismicCategory {
  SDC_A = 'A',
  SDC_B = 'B',
  SDC_C = 'C',
  SDC_D = 'D',
  SDC_E = 'E',
  SDC_F = 'F',
  NON_SEISMIC = 'NONE',
}

// ============================================================================
// MATERIAL PROPERTIES
// ============================================================================

/**
 * Concrete material properties
 */
export interface ConcreteProperties {
  /** Characteristic compressive strength f'c or fck (MPa) */
  compressiveStrength: number;
  /** Concrete grade designation (e.g., "M30", "C30/37") */
  grade: string;
  /** Modulus of elasticity Ec (MPa) */
  elasticModulus: number;
  /** Tensile strength ft (MPa) */
  tensileStrength: number;
  /** Density (kg/m³) */
  density: number;
  /** Aggregate type */
  aggregateType: 'NORMAL' | 'LIGHTWEIGHT' | 'HEAVYWEIGHT';
  /** Maximum aggregate size (mm) */
  maxAggregateSize: number;
  /** Unit system */
  unitSystem: 'SI' | 'IMPERIAL';
}

/**
 * Reinforcement bar properties
 */
export interface RebarProperties {
  /** Bar size designation */
  size: USBarSize | MetricBarSize | string;
  /** Nominal diameter (mm or inches) */
  diameter: number;
  /** Cross-sectional area (mm² or in²) */
  area: number;
  /** Perimeter (mm or inches) */
  perimeter: number;
  /** Weight per unit length (kg/m or lb/ft) */
  unitWeight: number;
  /** Grade/strength */
  grade: RebarGrade;
  /** Yield strength fy (MPa or ksi) */
  yieldStrength: number;
  /** Ultimate strength fu (MPa or ksi) */
  ultimateStrength: number;
  /** Modulus of elasticity Es (MPa or ksi) */
  elasticModulus: number;
  /** Coating type */
  coating: BarCoating;
}

// ============================================================================
// SHEAR REINFORCEMENT (STIRRUPS)
// ============================================================================

/**
 * Shear design input parameters
 */
export interface ShearDesignInput {
  /** Factored shear force Vu (kN or kips) */
  factoredShear: number;
  /** Factored axial force Nu (kN or kips) - positive = compression */
  factoredAxial?: number;
  /** Factored torsion Tu (kN-m or kip-ft) */
  factoredTorsion?: number;
  /** Beam width bw (mm or inches) */
  webWidth: number;
  /** Effective depth d (mm or inches) */
  effectiveDepth: number;
  /** Total depth h (mm or inches) */
  totalDepth: number;
  /** Concrete properties */
  concrete: ConcreteProperties;
  /** Stirrup bar properties */
  stirrupBar: RebarProperties;
  /** Longitudinal bar properties (for torsion) */
  longitudinalBar?: RebarProperties;
  /** Design code */
  designCode: ConcreteDesignCode;
  /** Member type */
  memberType: MemberType;
  /** Seismic category */
  seismicCategory?: SeismicCategory;
  /** Clear cover to stirrups (mm or inches) */
  cover: number;
}

/**
 * Stirrup design result
 */
export interface StirrupDesignResult {
  /** Is shear reinforcement required? */
  reinforcementRequired: boolean;
  /** Concrete shear capacity Vc (kN or kips) */
  concreteCapacity: number;
  /** Required steel shear capacity Vs (kN or kips) */
  requiredSteelCapacity: number;
  /** Maximum allowed Vs (kN or kips) */
  maxSteelCapacity: number;
  /** Total shear capacity φVn (kN or kips) */
  totalCapacity: number;
  /** Strength reduction factor φ */
  phiFactor: number;
  
  /** Recommended stirrup configuration */
  stirrupConfig: {
    type: StirrupType;
    barSize: string;
    legs: number;
    spacing: number;
    maxSpacing: number;
    minSpacing: number;
  };
  
  /** Required area of stirrups per unit length Av/s (mm²/mm or in²/in) */
  requiredAvs: number;
  /** Provided area of stirrups per unit length */
  providedAvs: number;
  
  /** Region classifications */
  regions: StirrupRegion[];
  
  /** Design checks */
  checks: ShearDesignCheck[];
  
  /** Is design adequate? */
  isAdequate: boolean;
  
  /** Utilization ratio */
  utilization: number;
  
  /** Warnings */
  warnings: string[];
  
  /** Calculation steps */
  calculations: CalculationStep[];
}

/**
 * Stirrup region along beam length
 */
export interface StirrupRegion {
  /** Start position from support (mm or inches) */
  startPosition: number;
  /** End position from support (mm or inches) */
  endPosition: number;
  /** Region type */
  type: 'CRITICAL' | 'TRANSITION' | 'STANDARD' | 'MINIMUM';
  /** Stirrup spacing in this region (mm or inches) */
  spacing: number;
  /** Number of stirrups in region */
  count: number;
  /** Shear force at start of region (kN or kips) */
  shearAtStart: number;
  /** Shear force at end of region (kN or kips) */
  shearAtEnd: number;
}

/**
 * Individual shear design check
 */
export interface ShearDesignCheck {
  name: string;
  description: string;
  required: number;
  provided: number;
  limit?: number;
  passed: boolean;
  utilization: number;
  codeReference: string;
}

// ============================================================================
// DEVELOPMENT LENGTH
// ============================================================================

/**
 * Development length input parameters
 */
export interface DevelopmentLengthInput {
  /** Bar properties */
  bar: RebarProperties;
  /** Concrete properties */
  concrete: ConcreteProperties;
  /** Design code */
  designCode: ConcreteDesignCode;
  /** Bar location factor */
  barLocation: 'TOP' | 'BOTTOM' | 'OTHER';
  /** Coating factor */
  coating: BarCoating;
  /** Lightweight concrete factor */
  lightweightFactor?: number;
  /** Clear cover to bar (mm or inches) */
  cover: number;
  /** Clear spacing between bars (mm or inches) */
  clearSpacing: number;
  /** Transverse reinforcement index Ktr */
  transverseIndex?: number;
  /** Excess reinforcement factor As_required/As_provided */
  excessRebarFactor?: number;
  /** Is bar in tension or compression? */
  stressType: 'TENSION' | 'COMPRESSION';
  /** Hook type if applicable */
  hookType?: HookType;
  /** Confinement by transverse reinforcement */
  isConfined?: boolean;
  /** Member type */
  memberType: MemberType;
  /** Seismic requirements */
  seismicCategory?: SeismicCategory;
}

/**
 * Development length result
 */
export interface DevelopmentLengthResult {
  /** Basic development length (mm or inches) */
  basicLength: number;
  /** Modified development length (mm or inches) */
  modifiedLength: number;
  /** Minimum development length (mm or inches) */
  minimumLength: number;
  /** Required development length ld (mm or inches) */
  requiredLength: number;
  
  /** Modification factors applied */
  factors: {
    name: string;
    symbol: string;
    value: number;
    description: string;
  }[];
  
  /** For hooked bars */
  hookedLength?: {
    straightPortion: number;
    hookExtension: number;
    insideBendDiameter: number;
    totalLength: number;
  };
  
  /** Headed bar anchorage */
  headedBarLength?: {
    developmentLength: number;
    headBearingArea: number;
    headThickness: number;
  };
  
  /** Calculation steps */
  calculations: CalculationStep[];
  
  /** Code reference */
  codeReference: string;
}

// ============================================================================
// LAP SPLICE
// ============================================================================

/**
 * Lap splice input parameters
 */
export interface LapSpliceInput {
  /** Bar properties */
  bar: RebarProperties;
  /** Concrete properties */
  concrete: ConcreteProperties;
  /** Design code */
  designCode: ConcreteDesignCode;
  /** Splice class */
  spliceClass: LapSpliceClass;
  /** Percentage of bars spliced at same location */
  percentSpliced: number;
  /** Bar location */
  barLocation: 'TOP' | 'BOTTOM' | 'OTHER';
  /** Coating */
  coating: BarCoating;
  /** Clear cover (mm or inches) */
  cover: number;
  /** Clear spacing between bars (mm or inches) */
  clearSpacing: number;
  /** Transverse reinforcement provided? */
  hasTransverseReinf: boolean;
  /** Member type */
  memberType: MemberType;
  /** Seismic category */
  seismicCategory?: SeismicCategory;
  /** Stress type */
  stressType: 'TENSION' | 'COMPRESSION';
  /** Bar stress level ratio fs/fy */
  stressRatio?: number;
}

/**
 * Lap splice result
 */
export interface LapSpliceResult {
  /** Required lap length (mm or inches) */
  requiredLength: number;
  /** Minimum lap length (mm or inches) */
  minimumLength: number;
  /** Development length used as base (mm or inches) */
  developmentLength: number;
  
  /** Splice multiplier applied */
  spliceMultiplier: number;
  
  /** Modification factors */
  factors: {
    name: string;
    value: number;
    description: string;
  }[];
  
  /** For compression splices */
  compressionSplice?: {
    basicLength: number;
    endBearingAllowed: boolean;
    reducedLength?: number;
  };
  
  /** Stagger requirements */
  staggerRequirements: {
    minStagger: number;
    maxPercentAtLocation: number;
  };
  
  /** Calculation steps */
  calculations: CalculationStep[];
  
  /** Code reference */
  codeReference: string;
}

// ============================================================================
// CALCULATION DOCUMENTATION
// ============================================================================

/**
 * Step-by-step calculation for documentation
 */
export interface CalculationStep {
  stepNumber: number;
  description: string;
  formula: string;
  variables: Record<string, {
    value: number;
    unit: string;
    description: string;
  }>;
  result: number;
  unit: string;
}

// ============================================================================
// BAR DATA TABLES
// ============================================================================

/**
 * Standard bar dimension data
 */
export interface BarDimensionTable {
  size: string;
  diameter_mm: number;
  diameter_in: number;
  area_mm2: number;
  area_in2: number;
  perimeter_mm: number;
  weight_kg_m: number;
  weight_lb_ft: number;
}

/**
 * Complete bar data for standard sizes
 */
export const US_BAR_DATA: BarDimensionTable[] = [
  { size: '#3', diameter_mm: 9.5, diameter_in: 0.375, area_mm2: 71, area_in2: 0.11, perimeter_mm: 29.8, weight_kg_m: 0.56, weight_lb_ft: 0.376 },
  { size: '#4', diameter_mm: 12.7, diameter_in: 0.500, area_mm2: 129, area_in2: 0.20, perimeter_mm: 39.9, weight_kg_m: 0.99, weight_lb_ft: 0.668 },
  { size: '#5', diameter_mm: 15.9, diameter_in: 0.625, area_mm2: 199, area_in2: 0.31, perimeter_mm: 49.9, weight_kg_m: 1.55, weight_lb_ft: 1.043 },
  { size: '#6', diameter_mm: 19.1, diameter_in: 0.750, area_mm2: 284, area_in2: 0.44, perimeter_mm: 59.8, weight_kg_m: 2.24, weight_lb_ft: 1.502 },
  { size: '#7', diameter_mm: 22.2, diameter_in: 0.875, area_mm2: 387, area_in2: 0.60, perimeter_mm: 69.8, weight_kg_m: 3.04, weight_lb_ft: 2.044 },
  { size: '#8', diameter_mm: 25.4, diameter_in: 1.000, area_mm2: 509, area_in2: 0.79, perimeter_mm: 79.8, weight_kg_m: 3.97, weight_lb_ft: 2.670 },
  { size: '#9', diameter_mm: 28.7, diameter_in: 1.128, area_mm2: 645, area_in2: 1.00, perimeter_mm: 90.0, weight_kg_m: 5.06, weight_lb_ft: 3.400 },
  { size: '#10', diameter_mm: 32.3, diameter_in: 1.270, area_mm2: 819, area_in2: 1.27, perimeter_mm: 101.3, weight_kg_m: 6.41, weight_lb_ft: 4.303 },
  { size: '#11', diameter_mm: 35.8, diameter_in: 1.410, area_mm2: 1006, area_in2: 1.56, perimeter_mm: 112.5, weight_kg_m: 7.91, weight_lb_ft: 5.313 },
  { size: '#14', diameter_mm: 43.0, diameter_in: 1.693, area_mm2: 1452, area_in2: 2.25, perimeter_mm: 135.1, weight_kg_m: 11.38, weight_lb_ft: 7.650 },
  { size: '#18', diameter_mm: 57.3, diameter_in: 2.257, area_mm2: 2581, area_in2: 4.00, perimeter_mm: 180.1, weight_kg_m: 20.24, weight_lb_ft: 13.600 },
];

export const METRIC_BAR_DATA: BarDimensionTable[] = [
  { size: '6mm', diameter_mm: 6, diameter_in: 0.236, area_mm2: 28.3, area_in2: 0.044, perimeter_mm: 18.8, weight_kg_m: 0.222, weight_lb_ft: 0.149 },
  { size: '8mm', diameter_mm: 8, diameter_in: 0.315, area_mm2: 50.3, area_in2: 0.078, perimeter_mm: 25.1, weight_kg_m: 0.395, weight_lb_ft: 0.265 },
  { size: '10mm', diameter_mm: 10, diameter_in: 0.394, area_mm2: 78.5, area_in2: 0.122, perimeter_mm: 31.4, weight_kg_m: 0.617, weight_lb_ft: 0.414 },
  { size: '12mm', diameter_mm: 12, diameter_in: 0.472, area_mm2: 113.1, area_in2: 0.175, perimeter_mm: 37.7, weight_kg_m: 0.888, weight_lb_ft: 0.596 },
  { size: '14mm', diameter_mm: 14, diameter_in: 0.551, area_mm2: 153.9, area_in2: 0.239, perimeter_mm: 44.0, weight_kg_m: 1.21, weight_lb_ft: 0.813 },
  { size: '16mm', diameter_mm: 16, diameter_in: 0.630, area_mm2: 201.1, area_in2: 0.312, perimeter_mm: 50.3, weight_kg_m: 1.58, weight_lb_ft: 1.061 },
  { size: '20mm', diameter_mm: 20, diameter_in: 0.787, area_mm2: 314.2, area_in2: 0.487, perimeter_mm: 62.8, weight_kg_m: 2.47, weight_lb_ft: 1.659 },
  { size: '22mm', diameter_mm: 22, diameter_in: 0.866, area_mm2: 380.1, area_in2: 0.589, perimeter_mm: 69.1, weight_kg_m: 2.98, weight_lb_ft: 2.002 },
  { size: '25mm', diameter_mm: 25, diameter_in: 0.984, area_mm2: 490.9, area_in2: 0.761, perimeter_mm: 78.5, weight_kg_m: 3.85, weight_lb_ft: 2.586 },
  { size: '28mm', diameter_mm: 28, diameter_in: 1.102, area_mm2: 615.8, area_in2: 0.955, perimeter_mm: 88.0, weight_kg_m: 4.83, weight_lb_ft: 3.244 },
  { size: '32mm', diameter_mm: 32, diameter_in: 1.260, area_mm2: 804.2, area_in2: 1.247, perimeter_mm: 100.5, weight_kg_m: 6.31, weight_lb_ft: 4.239 },
  { size: '36mm', diameter_mm: 36, diameter_in: 1.417, area_mm2: 1017.9, area_in2: 1.578, perimeter_mm: 113.1, weight_kg_m: 7.99, weight_lb_ft: 5.367 },
  { size: '40mm', diameter_mm: 40, diameter_in: 1.575, area_mm2: 1256.6, area_in2: 1.948, perimeter_mm: 125.7, weight_kg_m: 9.87, weight_lb_ft: 6.630 },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get bar data by size
 */
export function getBarData(size: string): BarDimensionTable | undefined {
  return US_BAR_DATA.find(b => b.size === size) || 
         METRIC_BAR_DATA.find(b => b.size === size);
}

/**
 * Get concrete modulus of elasticity
 */
export function getConcreteModulus(fc: number, unitSystem: 'SI' | 'IMPERIAL'): number {
  if (unitSystem === 'SI') {
    // Ec = 4700√f'c (MPa) per ACI 318
    return 4700 * Math.sqrt(fc);
  } else {
    // Ec = 57000√f'c (psi)
    return 57000 * Math.sqrt(fc);
  }
}

/**
 * Get concrete tensile strength
 */
export function getConcreteTensileStrength(fc: number, unitSystem: 'SI' | 'IMPERIAL'): number {
  if (unitSystem === 'SI') {
    // fr = 0.62√f'c (MPa) per ACI 318
    return 0.62 * Math.sqrt(fc);
  } else {
    // fr = 7.5√f'c (psi)
    return 7.5 * Math.sqrt(fc);
  }
}

/**
 * Create rebar properties from size and grade
 */
export function createRebarProperties(
  size: string,
  grade: RebarGrade,
  coating: BarCoating = BarCoating.UNCOATED
): RebarProperties | null {
  const barData = getBarData(size);
  if (!barData) return null;
  
  // Get yield strength based on grade
  const yieldStrengths: Record<RebarGrade, number> = {
    [RebarGrade.GRADE_40]: 276,
    [RebarGrade.GRADE_60]: 420,
    [RebarGrade.GRADE_75]: 517,
    [RebarGrade.GRADE_80]: 550,
    [RebarGrade.GRADE_100]: 690,
    [RebarGrade.FE_250]: 250,
    [RebarGrade.FE_415]: 415,
    [RebarGrade.FE_500]: 500,
    [RebarGrade.FE_550]: 550,
    [RebarGrade.FE_600]: 600,
    [RebarGrade.B500A]: 500,
    [RebarGrade.B500B]: 500,
    [RebarGrade.B500C]: 500,
    [RebarGrade.SS_316]: 450,
    [RebarGrade.SS_304]: 400,
  };
  
  const fy = yieldStrengths[grade] || 420;
  
  return {
    size,
    diameter: barData.diameter_mm,
    area: barData.area_mm2,
    perimeter: barData.perimeter_mm,
    unitWeight: barData.weight_kg_m,
    grade,
    yieldStrength: fy,
    ultimateStrength: fy * 1.25, // Approximate
    elasticModulus: 200000, // Steel Es
    coating,
  };
}

/**
 * Create concrete properties from grade
 */
export function createConcreteProperties(
  fc: number,
  aggregateType: 'NORMAL' | 'LIGHTWEIGHT' = 'NORMAL',
  maxAggregateSize: number = 20
): ConcreteProperties {
  return {
    compressiveStrength: fc,
    grade: `M${fc}`,
    elasticModulus: getConcreteModulus(fc, 'SI'),
    tensileStrength: getConcreteTensileStrength(fc, 'SI'),
    density: aggregateType === 'LIGHTWEIGHT' ? 1850 : 2400,
    aggregateType,
    maxAggregateSize,
    unitSystem: 'SI',
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  US_BAR_DATA,
  METRIC_BAR_DATA,
  getBarData,
  getConcreteModulus,
  getConcreteTensileStrength,
  createRebarProperties,
  createConcreteProperties,
};
