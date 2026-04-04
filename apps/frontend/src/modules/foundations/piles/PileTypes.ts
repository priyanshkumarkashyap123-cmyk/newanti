/**
 * Pile Foundation Design Type Definitions
 * Per ACI 318-19 and ASCE 7-22
 * 
 * Includes:
 * - Driven piles (steel H-piles, concrete piles, timber)
 * - Drilled shafts (caissons)
 * - Pile group analysis
 * - Lateral pile analysis
 * - Pile cap design
 */

/**
 * Pile types
 */
export enum PileType {
  // Driven piles
  STEEL_H_PILE = 'STEEL_H_PILE',
  STEEL_PIPE_PILE = 'STEEL_PIPE_PILE',
  PRECAST_CONCRETE = 'PRECAST_CONCRETE',
  PRESTRESSED_CONCRETE = 'PRESTRESSED_CONCRETE',
  TIMBER = 'TIMBER',
  
  // Cast-in-place
  DRILLED_SHAFT = 'DRILLED_SHAFT',
  AUGER_CAST = 'AUGER_CAST',
  MICROPILE = 'MICROPILE',
}

/**
 * Soil types for capacity calculations
 */
export enum SoilType {
  CLAY_SOFT = 'CLAY_SOFT',
  CLAY_MEDIUM = 'CLAY_MEDIUM',
  CLAY_STIFF = 'CLAY_STIFF',
  SAND_LOOSE = 'SAND_LOOSE',
  SAND_MEDIUM = 'SAND_MEDIUM',
  SAND_DENSE = 'SAND_DENSE',
  GRAVEL = 'GRAVEL',
  ROCK_WEATHERED = 'ROCK_WEATHERED',
  ROCK_SOUND = 'ROCK_SOUND',
}

/**
 * Installation method
 */
export enum InstallationMethod {
  DRIVEN_IMPACT = 'DRIVEN_IMPACT',
  DRIVEN_VIBRATORY = 'DRIVEN_VIBRATORY',
  DRILLED_DRY = 'DRILLED_DRY',
  DRILLED_WET = 'DRILLED_WET',
  DRILLED_CASED = 'DRILLED_CASED',
  AUGERED = 'AUGERED',
  JETTED = 'JETTED',
}

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
 * Soil layer properties
 */
export interface SoilLayer {
  depth_top: number;        // Depth to top of layer, ft
  depth_bottom: number;     // Depth to bottom of layer, ft
  soilType: SoilType;
  
  // Strength parameters
  Su?: number;              // Undrained shear strength (clay), psf
  phi?: number;             // Friction angle (sand/gravel), degrees
  N60?: number;             // SPT blow count (corrected)
  
  // Unit weights
  gamma: number;            // Total unit weight, pcf
  gamma_sub?: number;       // Submerged unit weight, pcf
  
  // Additional parameters
  K0?: number;              // At-rest earth pressure coefficient
  delta?: number;           // Pile-soil friction angle, degrees
}

/**
 * Pile section properties
 */
export interface PileSectionProperties {
  pileType: PileType;
  
  // Geometry
  diameter?: number;        // Diameter for circular piles, in
  width?: number;           // Width for H-piles, in
  depth?: number;           // Depth for H-piles, in
  wallThickness?: number;   // Wall thickness for pipe piles, in
  
  // Areas
  Ag: number;               // Gross area, in²
  Ap: number;               // Perimeter, in
  Ix: number;               // Moment of inertia, in⁴
  Sx: number;               // Section modulus, in³
  
  // Material properties
  fc?: number;              // Concrete strength, psi (for concrete piles)
  Fy?: number;              // Steel yield strength, ksi (for steel piles)
  E?: number;               // Elastic modulus, ksi
}

/**
 * Pile geometry input
 */
export interface PileGeometry {
  length: number;           // Total pile length, ft
  embedmentDepth: number;   // Depth into bearing stratum, ft
  cutoffElevation?: number; // Pile cutoff elevation, ft
  
  // For battered piles
  batterAngle?: number;     // Batter angle from vertical, degrees
  
  // For drilled shafts
  bellDiameter?: number;    // Bell diameter (if belled), in
  bellHeight?: number;      // Bell height, in
  socketLength?: number;    // Rock socket length, ft
}

/**
 * Pile loading
 */
export interface PileLoading {
  Pu: number;               // Factored axial load, kips (positive = compression)
  Mux?: number;             // Factored moment about x-axis, kip-ft
  Muy?: number;             // Factored moment about y-axis, kip-ft
  Hu?: number;              // Factored lateral load, kips
  Tu?: number;              // Factored torsion, kip-ft
  
  // Service loads (for settlement)
  P_service?: number;       // Service axial load, kips
}

/**
 * Pile capacity input
 */
export interface PileCapacityInput {
  // Pile properties
  section: PileSectionProperties;
  geometry: PileGeometry;
  installationMethod: InstallationMethod;
  
  // Soil profile
  soilLayers: SoilLayer[];
  waterTableDepth?: number; // Depth to water table, ft
  
  // Loading
  loads: PileLoading;
  
  // Design parameters
  designMethod: 'LRFD' | 'ASD';
  
  // Options
  checkSettlement?: boolean;
  checkLateral?: boolean;
  checkGroup?: boolean;
}

/**
 * Axial capacity breakdown
 */
export interface AxialCapacityResult {
  Qp: number;               // End bearing (tip) capacity, kips
  Qs: number;               // Shaft friction capacity, kips
  Qn: number;               // Total nominal capacity, kips
  phi_Qn: number;           // Design axial capacity, kips
  Pu: number;               // Required strength, kips
  ratio: number;            // Pu / φQn
  isAdequate: boolean;
  
  // Breakdown by layer
  Qs_byLayer: { layer: number; Qs: number }[];
  
  // Parameters
  qp: number;               // Unit end bearing, ksf
  fs_avg: number;           // Average unit shaft friction, ksf
}

/**
 * Lateral capacity result
 */
export interface LateralCapacityResult {
  Hu_allowable: number;     // Allowable lateral capacity, kips
  phi_Hn: number;           // Design lateral capacity, kips
  Hu: number;               // Required lateral strength, kips
  ratio: number;
  isAdequate: boolean;
  
  // Deflection
  delta_top: number;        // Lateral deflection at pile top, in
  delta_allowable: number;  // Allowable deflection, in
  
  // Bending
  M_max: number;            // Maximum moment in pile, kip-ft
  depthToMax: number;       // Depth to maximum moment, ft
}

/**
 * Structural capacity result
 */
export interface StructuralCapacityResult {
  Pn: number;               // Nominal axial capacity, kips
  phi_Pn: number;           // Design axial capacity, kips
  Mn?: number;              // Nominal moment capacity, kip-ft
  phi_Mn?: number;          // Design moment capacity, kip-ft
  ratio_axial: number;
  ratio_combined?: number;  // P-M interaction
  isAdequate: boolean;
  
  // Limit state
  limitState: 'COMPRESSION' | 'BUCKLING' | 'COMBINED';
}

/**
 * Settlement result
 */
export interface SettlementResult {
  elastic: number;          // Elastic compression of pile, in
  tip: number;              // Settlement at pile tip, in
  total: number;            // Total settlement, in
  allowable: number;        // Allowable settlement, in
  isAdequate: boolean;
}

/**
 * Pile group parameters
 */
export interface PileGroupInput {
  nPiles: number;           // Number of piles
  nRows: number;            // Number of rows
  nCols: number;            // Number of columns
  spacing_x: number;        // Spacing in x-direction, ft
  spacing_y: number;        // Spacing in y-direction, ft
  
  // Pile cap
  capThickness: number;     // Cap thickness, ft
  embedment?: number;       // Pile embedment into cap, in
}

/**
 * Pile group efficiency
 */
export interface PileGroupResult {
  efficiency: number;       // Group efficiency factor η
  Qg: number;               // Group capacity, kips
  phi_Qg: number;           // Design group capacity, kips
  Pu_group: number;         // Required group strength, kips
  ratio: number;
  isAdequate: boolean;
  
  // Individual pile loads
  maxPileLoad: number;      // Maximum pile load, kips
  minPileLoad: number;      // Minimum pile load, kips
  
  // Block failure capacity (for clay)
  Qblock?: number;
}

/**
 * Complete pile design result
 */
export interface PileDesignResult {
  isAdequate: boolean;
  pileType: PileType;
  
  // Capacity results
  axialCapacity: AxialCapacityResult;
  structuralCapacity: StructuralCapacityResult;
  lateralCapacity?: LateralCapacityResult;
  settlement?: SettlementResult;
  groupEfficiency?: PileGroupResult;
  
  // Governing ratios
  governingRatio: number;
  governingCondition: string;
  
  // Recommendations
  recommendations: string[];
  
  calculations: CalculationStep[];
  codeReference: string;
}

/**
 * Resistance factors per AASHTO LRFD
 */
export const PILE_RESISTANCE_FACTORS = {
  // Driven piles
  driven_end_bearing_clay: 0.70,
  driven_end_bearing_sand: 0.55,
  driven_side_friction_clay: 0.65,
  driven_side_friction_sand: 0.55,
  
  // Drilled shafts
  drilled_end_bearing_clay: 0.55,
  drilled_end_bearing_sand: 0.50,
  drilled_side_friction_clay: 0.55,
  drilled_side_friction_sand: 0.55,
  drilled_rock_socket: 0.55,
  
  // Structural
  structural_compression: 0.75,
  structural_combined: 0.75,
  
  // Lateral
  lateral: 0.65,
  
  // Group
  group: 0.65,
};

/**
 * Bearing capacity factors
 */
export const BEARING_CAPACITY_FACTORS = {
  // Nc for clay (undrained, φ = 0)
  Nc: 9.0,
  
  // Nq for sand (varies with φ)
  Nq: {
    28: 14.7,
    30: 18.4,
    32: 23.2,
    34: 29.4,
    36: 37.7,
    38: 48.9,
    40: 64.2,
    42: 85.4,
    45: 134.9,
  } as Record<number, number>,
  
  // Limiting unit end bearing (ksf)
  qp_limit_sand: 200,
  qp_limit_clay: 200,
};

/**
 * Shaft friction factors
 */
export const SHAFT_FRICTION_FACTORS = {
  // Alpha method for clay (α vs Su)
  alpha: [
    { Su_max: 500, alpha: 1.0 },
    { Su_max: 1000, alpha: 0.9 },
    { Su_max: 1500, alpha: 0.75 },
    { Su_max: 2000, alpha: 0.55 },
    { Su_max: 3000, alpha: 0.45 },
    { Su_max: 5000, alpha: 0.35 },
  ],
  
  // Beta method for sand (β = K × tan(δ))
  // K values for driven piles
  K_driven_displacement: 1.0,
  K_driven_low_displacement: 0.8,
  K_drilled: 0.7,
  
  // δ/φ ratios
  delta_phi_steel: 0.67,
  delta_phi_concrete: 0.80,
  delta_phi_timber: 0.75,
};

/**
 * Standard H-pile sections
 */
export const H_PILE_SECTIONS: Record<string, PileSectionProperties> = {
  'HP14X117': { pileType: PileType.STEEL_H_PILE, width: 14.89, depth: 14.21, Ag: 34.4, Ap: 58.2, Ix: 1220, Sx: 172, Fy: 50 },
  'HP14X102': { pileType: PileType.STEEL_H_PILE, width: 14.78, depth: 14.01, Ag: 30.0, Ap: 57.6, Ix: 1050, Sx: 150, Fy: 50 },
  'HP14X89': { pileType: PileType.STEEL_H_PILE, width: 14.70, depth: 13.83, Ag: 26.1, Ap: 57.1, Ix: 904, Sx: 131, Fy: 50 },
  'HP14X73': { pileType: PileType.STEEL_H_PILE, width: 14.58, depth: 13.61, Ag: 21.4, Ap: 56.4, Ix: 729, Sx: 107, Fy: 50 },
  'HP12X84': { pileType: PileType.STEEL_H_PILE, width: 12.28, depth: 12.28, Ag: 24.6, Ap: 49.1, Ix: 650, Sx: 106, Fy: 50 },
  'HP12X74': { pileType: PileType.STEEL_H_PILE, width: 12.22, depth: 12.13, Ag: 21.8, Ap: 48.7, Ix: 569, Sx: 93.8, Fy: 50 },
  'HP12X63': { pileType: PileType.STEEL_H_PILE, width: 12.13, depth: 11.94, Ag: 18.4, Ap: 48.1, Ix: 472, Sx: 79.1, Fy: 50 },
  'HP12X53': { pileType: PileType.STEEL_H_PILE, width: 12.05, depth: 11.78, Ag: 15.5, Ap: 47.7, Ix: 393, Sx: 66.7, Fy: 50 },
  'HP10X57': { pileType: PileType.STEEL_H_PILE, width: 10.22, depth: 10.01, Ag: 16.8, Ap: 40.5, Ix: 294, Sx: 58.8, Fy: 50 },
  'HP10X42': { pileType: PileType.STEEL_H_PILE, width: 10.08, depth: 9.70, Ag: 12.4, Ap: 39.6, Ix: 210, Sx: 43.4, Fy: 50 },
};
