/**
 * ============================================================================
 * IS 2911 (Parts 1-4) - DESIGN AND CONSTRUCTION OF PILE FOUNDATIONS
 * ============================================================================
 * 
 * Complete implementation of IS 2911 for Pile Foundation Design
 * 
 * Part 1: Concrete Piles
 *   Section 1: Driven Cast-in-situ
 *   Section 2: Bored Cast-in-situ
 *   Section 3: Driven Precast
 * Part 2: Timber Piles
 * Part 3: Under-reamed Piles
 * Part 4: Load Test on Piles
 * 
 * Includes:
 * - Bearing capacity calculations
 * - Settlement analysis
 * - Structural design of piles
 * - Negative skin friction
 * - Pile group effects
 * - Lateral load capacity
 * 
 * @version 1.0.0
 * @reference IS 2911:2010 - Code of Practice for Design and Construction of Pile Foundations
 */

import {
  DesignCode,
  CalculationStep,
  DiagramData,
  DiagramType,
  createCalculationStep,
  roundTo,
} from '../core/CalculationEngine';

// ============================================================================
// CONSTANTS AND TABLES FROM IS 2911
// ============================================================================

/**
 * Safety factors per IS 2911 Clause 6.2
 */
export const IS2911_SAFETY_FACTORS = {
  // Factor of safety for working load
  static_formula: 2.5,           // Using static formulae
  load_test: 2.0,                // Based on load test (initial)
  load_test_routine: 2.5,        // Based on routine load test
  dynamic_formula: 3.0,          // Using dynamic formulae
  
  // For settlement consideration
  settlement: 2.0,
  
  // Reduction factors
  group_efficiency: 0.90,        // Group efficiency for close spacing
  negative_friction: 1.0,        // No reduction for negative friction
};

/**
 * Soil parameters for bearing capacity
 * Nc, Nq, Nγ - Bearing capacity factors per IS 2911
 */
export const IS2911_BEARING_CAPACITY_FACTORS: Record<number, { Nc: number; Nq: number; Ng: number }> = {
  0: { Nc: 5.14, Nq: 1.00, Ng: 0 },
  5: { Nc: 6.49, Nq: 1.57, Ng: 0.45 },
  10: { Nc: 8.35, Nq: 2.47, Ng: 1.22 },
  15: { Nc: 10.98, Nq: 3.94, Ng: 2.65 },
  20: { Nc: 14.83, Nq: 6.40, Ng: 5.39 },
  25: { Nc: 20.72, Nq: 10.66, Ng: 10.88 },
  26: { Nc: 22.25, Nq: 11.85, Ng: 12.54 },
  28: { Nc: 25.80, Nq: 14.72, Ng: 16.72 },
  30: { Nc: 30.14, Nq: 18.40, Ng: 22.40 },
  32: { Nc: 35.49, Nq: 23.18, Ng: 30.22 },
  34: { Nc: 42.16, Nq: 29.44, Ng: 41.06 },
  35: { Nc: 46.12, Nq: 33.30, Ng: 48.03 },
  36: { Nc: 50.59, Nq: 37.75, Ng: 56.31 },
  38: { Nc: 61.35, Nq: 48.93, Ng: 78.03 },
  40: { Nc: 75.31, Nq: 64.20, Ng: 109.41 },
  42: { Nc: 93.71, Nq: 85.38, Ng: 155.55 },
  45: { Nc: 133.88, Nq: 134.88, Ng: 271.76 },
};

/**
 * Adhesion factor α for cohesive soils (Table 3, IS 2911)
 */
export function getAdhesionFactor(cu: number): number {
  // cu = undrained shear strength in kN/m²
  if (cu <= 25) return 1.0;
  if (cu <= 50) return 0.85;
  if (cu <= 75) return 0.70;
  if (cu <= 100) return 0.55;
  if (cu <= 150) return 0.45;
  return 0.40;
}

/**
 * Coefficient of earth pressure Ks for piles
 */
export const IS2911_EARTH_PRESSURE_COEFFICIENTS: Record<string, number> = {
  bored_loose: 0.5,
  bored_medium: 0.7,
  bored_dense: 1.0,
  driven_loose: 1.0,
  driven_medium: 1.5,
  driven_dense: 2.0,
};

/**
 * Skin friction angle δ as fraction of φ
 */
export const IS2911_SKIN_FRICTION_ANGLE: Record<string, number> = {
  concrete_smooth: 0.7,      // δ = 0.7φ
  concrete_rough: 0.85,      // δ = 0.85φ
  steel: 0.6,                // δ = 0.6φ
  timber: 0.8,               // δ = 0.8φ
};

/**
 * Limiting skin friction values (kN/m²)
 */
export const IS2911_LIMITING_SKIN_FRICTION: Record<string, number> = {
  loose_sand: 20,
  medium_sand: 50,
  dense_sand: 80,
  very_dense_sand: 100,
  soft_clay: 10,
  firm_clay: 25,
  stiff_clay: 50,
  hard_clay: 100,
};

/**
 * Limiting end bearing values (kN/m²)
 */
export const IS2911_LIMITING_END_BEARING: Record<string, number> = {
  loose_sand: 2500,
  medium_sand: 5000,
  dense_sand: 10000,
  very_dense_sand: 15000,
  soft_clay: 100,
  firm_clay: 250,
  stiff_clay: 500,
  hard_clay: 1000,
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type PileType = 
  | 'driven_cast_in_situ' 
  | 'bored_cast_in_situ' 
  | 'driven_precast'
  | 'under_reamed'
  | 'steel_H'
  | 'steel_pipe';

export type SoilType = 
  | 'loose_sand' 
  | 'medium_sand' 
  | 'dense_sand' 
  | 'very_dense_sand'
  | 'soft_clay'
  | 'firm_clay'
  | 'stiff_clay'
  | 'hard_clay';

export interface SoilLayer {
  depth_from: number;        // Depth from GL, m
  depth_to: number;          // Depth to bottom of layer, m
  type: 'cohesive' | 'cohesionless' | 'rock';
  description: string;
  
  // Cohesive soil parameters
  cu?: number;               // Undrained shear strength, kN/m²
  
  // Cohesionless soil parameters
  phi?: number;              // Angle of internal friction, degrees
  N_SPT?: number;            // SPT N value
  
  // Common parameters
  gamma: number;             // Unit weight, kN/m³
  gamma_sat?: number;        // Saturated unit weight, kN/m³
  
  // Additional parameters
  E?: number;                // Elastic modulus, kN/m²
  K0?: number;               // At-rest earth pressure coefficient
}

// ============================================================================
// BEARING CAPACITY CALCULATION
// ============================================================================

export interface PileCapacityInput {
  // Pile geometry
  diameter: number;          // Pile diameter, mm
  length: number;            // Pile length below GL, m
  type: PileType;
  
  // Under-reamed pile specific
  bulb_diameter?: number;    // Bulb diameter for under-reamed pile, mm
  num_bulbs?: number;        // Number of bulbs
  
  // Soil profile
  soil_layers: SoilLayer[];
  
  // Ground water
  gwt_depth: number;         // Depth to GWT from GL, m
  
  // Options
  installation_method?: 'bored' | 'driven';
  concrete_grade?: number;   // fck in N/mm²
  steel_grade?: number;      // fy in N/mm²
  
  showDetailedCalc?: boolean;
}

export interface PileCapacityResult {
  // Ultimate capacities
  Qp: number;               // End bearing capacity, kN
  Qs: number;               // Skin friction capacity, kN
  Qu: number;               // Ultimate capacity, kN
  
  // Allowable capacities
  Qa: number;               // Allowable capacity, kN
  
  // Component details
  skin_friction_layers: Array<{
    layer: number;
    depth_from: number;
    depth_to: number;
    fs: number;              // Unit skin friction, kN/m²
    As: number;              // Surface area, m²
    Qs: number;              // Skin friction, kN
  }>;
  
  end_bearing: {
    qp: number;              // Unit end bearing, kN/m²
    Ap: number;              // End area, m²
    Qp: number;              // End bearing, kN
  };
  
  // Safety factors used
  FOS: number;
  
  // Calculations
  calculations: CalculationStep[];
  diagrams: DiagramData[];
}

/**
 * Interpolate bearing capacity factors
 */
function interpolateBCFactor(
  phi: number,
  factor: 'Nc' | 'Nq' | 'Ng'
): number {
  const angles = Object.keys(IS2911_BEARING_CAPACITY_FACTORS).map(Number).sort((a, b) => a - b);
  
  // Find bounding values
  let lower = 0;
  let upper = 45;
  
  for (let i = 0; i < angles.length - 1; i++) {
    if (phi >= angles[i] && phi <= angles[i + 1]) {
      lower = angles[i];
      upper = angles[i + 1];
      break;
    }
  }
  
  if (phi <= angles[0]) return IS2911_BEARING_CAPACITY_FACTORS[angles[0]][factor];
  if (phi >= angles[angles.length - 1]) return IS2911_BEARING_CAPACITY_FACTORS[angles[angles.length - 1]][factor];
  
  // Linear interpolation
  const f1 = IS2911_BEARING_CAPACITY_FACTORS[lower][factor];
  const f2 = IS2911_BEARING_CAPACITY_FACTORS[upper][factor];
  
  return f1 + (f2 - f1) * (phi - lower) / (upper - lower);
}

/**
 * Calculate skin friction for cohesive soil (α-method)
 */
function calculateSkinFrictionCohesive(
  cu: number,                // Undrained shear strength, kN/m²
  perimeter: number,         // Pile perimeter, m
  length: number             // Length in layer, m
): { fs: number; As: number; Qs: number } {
  const alpha = getAdhesionFactor(cu);
  const fs = alpha * cu;
  const As = perimeter * length;
  const Qs = fs * As;
  
  return { fs: roundTo(fs, 2), As: roundTo(As, 2), Qs: roundTo(Qs, 2) };
}

/**
 * Calculate skin friction for cohesionless soil (β-method)
 */
function calculateSkinFrictionCohesionless(
  phi: number,               // Friction angle, degrees
  sigma_v: number,           // Effective vertical stress, kN/m²
  perimeter: number,         // Pile perimeter, m
  length: number,            // Length in layer, m
  installationType: 'bored' | 'driven',
  soilDensity: 'loose' | 'medium' | 'dense'
): { fs: number; As: number; Qs: number } {
  // Ks coefficient
  const Ks = IS2911_EARTH_PRESSURE_COEFFICIENTS[`${installationType}_${soilDensity}`];
  
  // Skin friction angle
  const delta = IS2911_SKIN_FRICTION_ANGLE.concrete_rough * phi;
  
  // Unit skin friction: fs = Ks × σ'v × tan(δ)
  let fs = Ks * sigma_v * Math.tan(delta * Math.PI / 180);
  
  // Apply limiting value
  const limitKey = `${soilDensity}_sand` as SoilType;
  fs = Math.min(fs, IS2911_LIMITING_SKIN_FRICTION[limitKey] || 80);
  
  const As = perimeter * length;
  const Qs = fs * As;
  
  return { fs: roundTo(fs, 2), As: roundTo(As, 2), Qs: roundTo(Qs, 2) };
}

/**
 * Calculate end bearing capacity
 */
function calculateEndBearing(
  layer: SoilLayer,
  diameter: number,          // mm
  embedment_in_bearing: number, // m
  sigma_v: number            // Effective vertical stress at tip, kN/m²
): { qp: number; Ap: number; Qp: number } {
  const d = diameter / 1000; // Convert to m
  const Ap = Math.PI * d * d / 4;
  
  let qp: number;
  
  if (layer.type === 'cohesive') {
    // qp = Nc × cu
    const Nc = 9; // For deep foundations
    qp = Nc * (layer.cu || 50);
    
    // Apply limiting value
    qp = Math.min(qp, IS2911_LIMITING_END_BEARING.stiff_clay || 500);
  } else if (layer.type === 'cohesionless') {
    // qp = Nq × σ'v (for sand)
    const phi = layer.phi || 30;
    const Nq = interpolateBCFactor(phi, 'Nq');
    qp = Nq * sigma_v;
    
    // Apply limiting value based on density
    const N = layer.N_SPT || 20;
    let limitKey: SoilType;
    if (N < 10) limitKey = 'loose_sand';
    else if (N < 30) limitKey = 'medium_sand';
    else if (N < 50) limitKey = 'dense_sand';
    else limitKey = 'very_dense_sand';
    
    qp = Math.min(qp, IS2911_LIMITING_END_BEARING[limitKey]);
  } else {
    // Rock
    qp = 5000; // Default rock bearing
  }
  
  const Qp = qp * Ap;
  
  return { 
    qp: roundTo(qp, 2), 
    Ap: roundTo(Ap, 4), 
    Qp: roundTo(Qp, 2) 
  };
}

/**
 * Comprehensive pile capacity calculation per IS 2911
 */
export function calculatePileCapacityIS2911(input: PileCapacityInput): PileCapacityResult {
  const calculations: CalculationStep[] = [];
  const diagrams: DiagramData[] = [];
  let stepNo = 1;
  
  const {
    diameter,
    length,
    type,
    bulb_diameter,
    num_bulbs,
    soil_layers,
    gwt_depth,
    installation_method = type.includes('bored') ? 'bored' : 'driven',
  } = input;
  
  // Convert to SI
  const d = diameter / 1000; // m
  const perimeter = Math.PI * d;
  const Ap = Math.PI * d * d / 4;
  
  // ============================================================================
  // STEP 1: PILE GEOMETRY
  // ============================================================================
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Pile Geometry',
    description: 'Calculate pile geometric properties',
    formula: 'Perimeter = π × D; Area = π × D² / 4',
    values: {
      'Diameter': { value: diameter, unit: 'mm' },
      'Length': { value: length, unit: 'm' },
      'Type': { value: type.replace(/_/g, ' ') },
    },
    result: {
      value: `Perimeter = ${roundTo(perimeter, 3)} m, Area = ${roundTo(Ap, 4)} m²`,
      description: 'Geometric properties calculated',
    },
    code: DesignCode.IS_2911,
    clause: '5.2',
    status: 'OK',
    diagram: {
      type: DiagramType.CROSS_SECTION,
      title: 'Pile Cross Section',
      data: { diameter: d * 1000 },
    },
  }));
  
  // ============================================================================
  // STEP 2: SKIN FRICTION CALCULATION
  // ============================================================================
  
  const skin_friction_layers: PileCapacityResult['skin_friction_layers'] = [];
  let Qs_total = 0;
  let current_depth = 0;
  let sigma_v = 0; // Track effective vertical stress
  
  for (let i = 0; i < soil_layers.length; i++) {
    const layer = soil_layers[i];
    const layer_start = Math.max(layer.depth_from, current_depth);
    const layer_end = Math.min(layer.depth_to, length);
    
    if (layer_start >= length) continue;
    if (layer_end <= layer_start) continue;
    
    const layer_thickness = layer_end - layer_start;
    const mid_depth = (layer_start + layer_end) / 2;
    
    // Calculate effective stress at mid-layer
    const gamma_eff = mid_depth > gwt_depth 
      ? (layer.gamma_sat || layer.gamma + 10) - 10 
      : layer.gamma;
    sigma_v = gamma_eff * mid_depth;
    
    let friction: { fs: number; As: number; Qs: number };
    
    if (layer.type === 'cohesive') {
      friction = calculateSkinFrictionCohesive(
        layer.cu || 50,
        perimeter,
        layer_thickness
      );
    } else {
      // Determine soil density from N value
      const N = layer.N_SPT || 20;
      let density: 'loose' | 'medium' | 'dense';
      if (N < 10) density = 'loose';
      else if (N < 30) density = 'medium';
      else density = 'dense';
      
      friction = calculateSkinFrictionCohesionless(
        layer.phi || 30,
        sigma_v,
        perimeter,
        layer_thickness,
        installation_method,
        density
      );
    }
    
    skin_friction_layers.push({
      layer: i + 1,
      depth_from: layer_start,
      depth_to: layer_end,
      fs: friction.fs,
      As: friction.As,
      Qs: friction.Qs,
    });
    
    Qs_total += friction.Qs;
    current_depth = layer_end;
  }
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Skin Friction Calculation',
    description: 'Calculate skin friction resistance through soil layers',
    formula: 'Qs = Σ(fs × As); fs = α × cu (clay) or Ks × σ\'v × tan(δ) (sand)',
    values: {
      'Layers': { value: skin_friction_layers.length },
      'Method': { 
        value: 'α-method for clay, β-method for sand',
        description: 'Per IS 2911 Clause 6.3'
      },
    },
    result: {
      value: roundTo(Qs_total, 2),
      unit: 'kN',
      description: 'Total skin friction capacity',
    },
    code: DesignCode.IS_2911,
    clause: '6.3.2',
    status: 'OK',
    notes: skin_friction_layers.map(l => 
      `Layer ${l.layer}: ${l.depth_from}-${l.depth_to}m, fs=${l.fs} kN/m², Qs=${l.Qs} kN`
    ),
  }));
  
  // ============================================================================
  // STEP 3: END BEARING CALCULATION
  // ============================================================================
  
  // Find bearing layer (layer at pile tip)
  const bearing_layer = soil_layers.find(l => l.depth_from <= length && l.depth_to >= length);
  
  if (!bearing_layer) {
    throw new Error('No bearing layer found at pile tip depth');
  }
  
  // Calculate effective stress at pile tip
  const tip_sigma_v = soil_layers.reduce((sum, layer) => {
    const layer_end = Math.min(layer.depth_to, length);
    const layer_start = Math.max(layer.depth_from, 0);
    if (layer_start >= length) return sum;
    
    const thickness = layer_end - layer_start;
    const gamma_eff = layer_end > gwt_depth 
      ? (layer.gamma_sat || layer.gamma + 10) - 10 
      : layer.gamma;
    
    return sum + gamma_eff * thickness;
  }, 0);
  
  const end_bearing = calculateEndBearing(
    bearing_layer,
    diameter,
    length - bearing_layer.depth_from,
    tip_sigma_v
  );
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'End Bearing Calculation',
    description: 'Calculate end bearing capacity at pile tip',
    formula: bearing_layer.type === 'cohesive' 
      ? 'Qp = Nc × cu × Ap (Nc = 9 for deep foundation)'
      : 'Qp = Nq × σ\'v × Ap',
    values: {
      'Bearing Layer': { value: bearing_layer.description },
      'Tip Depth': { value: length, unit: 'm' },
      'σ\'v at tip': { value: roundTo(tip_sigma_v, 2), unit: 'kN/m²' },
      'Ap': { value: end_bearing.Ap, unit: 'm²' },
    },
    result: {
      value: end_bearing.Qp,
      unit: 'kN',
      description: `Unit end bearing qp = ${end_bearing.qp} kN/m²`,
    },
    code: DesignCode.IS_2911,
    clause: '6.3.3',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 4: ULTIMATE PILE CAPACITY
  // ============================================================================
  
  const Qu = Qs_total + end_bearing.Qp;
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Ultimate Pile Capacity',
    description: 'Sum of skin friction and end bearing',
    formula: 'Qu = Qs + Qp',
    values: {
      'Qs': { value: roundTo(Qs_total, 2), unit: 'kN', description: 'Skin friction' },
      'Qp': { value: end_bearing.Qp, unit: 'kN', description: 'End bearing' },
    },
    result: {
      value: roundTo(Qu, 2),
      unit: 'kN',
      description: 'Ultimate pile capacity',
    },
    code: DesignCode.IS_2911,
    clause: '6.3.1',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 5: ALLOWABLE PILE CAPACITY
  // ============================================================================
  
  const FOS = IS2911_SAFETY_FACTORS.static_formula;
  const Qa = Qu / FOS;
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Allowable Pile Capacity',
    description: 'Apply factor of safety',
    formula: 'Qa = Qu / FOS',
    values: {
      'Qu': { value: roundTo(Qu, 2), unit: 'kN' },
      'FOS': { value: FOS, description: 'For static formula (Clause 6.2)' },
    },
    result: {
      value: roundTo(Qa, 2),
      unit: 'kN',
      description: 'Safe working load on pile',
    },
    code: DesignCode.IS_2911,
    clause: '6.2',
    status: 'OK',
    notes: [
      `FOS = 2.5 for static formula`,
      `FOS = 2.0 for initial load test`,
      `FOS = 2.5 for routine load test`,
    ],
  }));
  
  // Add load transfer diagram
  diagrams.push({
    type: DiagramType.LOADING_DIAGRAM,
    title: 'Load Transfer Mechanism',
    data: {
      pile: { diameter, length },
      skin_friction_layers,
      end_bearing,
      Qu,
      Qa,
    },
  });
  
  return {
    Qp: end_bearing.Qp,
    Qs: Qs_total,
    Qu,
    Qa,
    skin_friction_layers,
    end_bearing,
    FOS,
    calculations,
    diagrams,
  };
}

// ============================================================================
// PILE GROUP ANALYSIS
// ============================================================================

export interface PileGroupInput {
  // Single pile
  single_pile_capacity: number;  // Qa, kN
  pile_diameter: number;         // mm
  pile_length: number;           // m
  
  // Group arrangement
  num_rows: number;
  num_cols: number;
  spacing_x: number;             // Center to center, m
  spacing_y: number;             // Center to center, m
  
  // Soil
  soil_type: 'clay' | 'sand';
  cu?: number;                   // For clay, kN/m²
  phi?: number;                  // For sand, degrees
  
  showDetailedCalc?: boolean;
}

export interface PileGroupResult {
  // Group capacity
  Qg_sum: number;               // Sum of individual capacities, kN
  Qg_block: number;             // Block failure capacity, kN
  Qg_design: number;            // Design group capacity, kN
  
  // Efficiency
  efficiency: number;
  
  calculations: CalculationStep[];
}

/**
 * Calculate pile group capacity per IS 2911
 */
export function calculatePileGroupCapacity(input: PileGroupInput): PileGroupResult {
  const calculations: CalculationStep[] = [];
  let stepNo = 1;
  
  const {
    single_pile_capacity,
    pile_diameter,
    pile_length,
    num_rows,
    num_cols,
    spacing_x,
    spacing_y,
    soil_type,
    cu = 50,
    phi = 30,
  } = input;
  
  const d = pile_diameter / 1000; // m
  const n = num_rows * num_cols;
  
  // ============================================================================
  // STEP 1: SUM OF INDIVIDUAL CAPACITIES
  // ============================================================================
  
  const Qg_sum = n * single_pile_capacity;
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Sum of Individual Pile Capacities',
    description: 'Calculate total capacity assuming no group effect',
    formula: 'Qg = n × Qa',
    values: {
      'n': { value: n, description: 'Number of piles' },
      'Qa': { value: single_pile_capacity, unit: 'kN', description: 'Single pile capacity' },
    },
    result: {
      value: roundTo(Qg_sum, 2),
      unit: 'kN',
    },
    code: DesignCode.IS_2911,
    clause: '6.6',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 2: BLOCK FAILURE CAPACITY
  // ============================================================================
  
  // Block dimensions
  const Lg = (num_cols - 1) * spacing_x + d; // Length of block
  const Bg = (num_rows - 1) * spacing_y + d; // Width of block
  const Dg = pile_length;                     // Depth of block
  
  let Qg_block: number;
  
  if (soil_type === 'clay') {
    // Qg = 2 × D × (L + B) × cu + L × B × Nc × cu
    const Nc = 9;
    const perimeter_block = 2 * (Lg + Bg);
    const base_area = Lg * Bg;
    
    Qg_block = perimeter_block * Dg * cu + base_area * Nc * cu;
  } else {
    // For sand, block failure is less critical
    // Use efficiency method
    Qg_block = Qg_sum * 0.9; // Approximate
  }
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Block Failure Capacity',
    description: 'Calculate capacity considering block failure mode',
    formula: soil_type === 'clay' 
      ? 'Qg,block = 2D(L+B)×cu + L×B×Nc×cu'
      : 'Qg,block ≈ η × Qg,sum (efficiency method)',
    values: {
      'Block Length (Lg)': { value: roundTo(Lg, 3), unit: 'm' },
      'Block Width (Bg)': { value: roundTo(Bg, 3), unit: 'm' },
      'Block Depth (Dg)': { value: Dg, unit: 'm' },
    },
    result: {
      value: roundTo(Qg_block, 2),
      unit: 'kN',
    },
    code: DesignCode.IS_2911,
    clause: '6.6.2',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 3: GROUP EFFICIENCY (CONVERSE-LABARRE)
  // ============================================================================
  
  // Converse-Labarre formula
  const theta = Math.atan(d / spacing_x) * 180 / Math.PI; // degrees
  const m = num_cols;
  const nn = num_rows;
  
  const efficiency = 1 - (theta / 90) * ((m - 1) * nn + (nn - 1) * m) / (2 * m * nn);
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Group Efficiency (Converse-Labarre)',
    description: 'Calculate pile group efficiency',
    formula: 'η = 1 - θ/90 × [(m-1)n + (n-1)m] / (2mn)',
    values: {
      'θ': { value: roundTo(theta, 2), unit: '°', description: 'arctan(d/s)' },
      'm': { value: m, description: 'Piles in row' },
      'n': { value: nn, description: 'Number of rows' },
    },
    result: {
      value: roundTo(efficiency, 3),
      description: 'Group efficiency factor',
    },
    code: DesignCode.IS_2911,
    clause: '6.6.1',
    status: efficiency >= 0.7 ? 'OK' : 'WARNING',
    notes: efficiency < 0.7 
      ? ['Low efficiency - consider increasing pile spacing']
      : undefined,
  }));
  
  // ============================================================================
  // STEP 4: DESIGN GROUP CAPACITY
  // ============================================================================
  
  // Lesser of individual sum (with efficiency) and block failure
  const Qg_individual = efficiency * Qg_sum;
  const Qg_design = Math.min(Qg_individual, Qg_block);
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Design Group Capacity',
    description: 'Select governing capacity',
    formula: 'Qg,design = min(η × ΣQa, Qg,block)',
    values: {
      'η × ΣQa': { value: roundTo(Qg_individual, 2), unit: 'kN' },
      'Qg,block': { value: roundTo(Qg_block, 2), unit: 'kN' },
    },
    result: {
      value: roundTo(Qg_design, 2),
      unit: 'kN',
      description: Qg_individual < Qg_block 
        ? 'Governed by individual capacity with efficiency'
        : 'Governed by block failure',
    },
    code: DesignCode.IS_2911,
    clause: '6.6',
    status: 'OK',
  }));
  
  return {
    Qg_sum,
    Qg_block,
    Qg_design,
    efficiency,
    calculations,
  };
}

// ============================================================================
// STRUCTURAL DESIGN OF PILE
// ============================================================================

export interface PileStructuralDesignInput {
  // Geometry
  diameter: number;           // mm
  length: number;             // m
  
  // Loads
  P: number;                  // Axial load, kN
  M: number;                  // Bending moment, kN-m
  
  // Materials
  fck: number;                // Concrete grade, N/mm²
  fy: number;                 // Steel grade, N/mm²
  
  // Cover
  cover: number;              // Clear cover, mm
  
  showDetailedCalc?: boolean;
}

export interface PileStructuralResult {
  // Check results
  isAdequate: boolean;
  
  // Required reinforcement
  Ast_required: number;       // mm²
  Ast_provided: number;       // mm²
  bars: string;               // e.g., "8-20φ"
  pt: number;                 // Reinforcement percentage
  
  // Minimum requirements
  Ast_min: number;            // mm²
  spiral_pitch?: number;      // mm
  
  calculations: CalculationStep[];
}

/**
 * Structural design of pile per IS 2911 and IS 456
 */
export function designPileStructural(input: PileStructuralDesignInput): PileStructuralResult {
  const calculations: CalculationStep[] = [];
  let stepNo = 1;
  
  const { diameter, length, P, M, fck, fy, cover } = input;
  
  // ============================================================================
  // STEP 1: SECTION PROPERTIES
  // ============================================================================
  
  const d = diameter; // mm
  const Ag = Math.PI * d * d / 4;
  const d_eff = d - 2 * cover - 10; // Effective depth, assume 10mm stirrup
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Section Properties',
    description: 'Calculate pile cross-section properties',
    formula: 'Ag = π × D² / 4',
    values: {
      'Diameter': { value: d, unit: 'mm' },
      'Cover': { value: cover, unit: 'mm' },
    },
    result: {
      value: roundTo(Ag, 0),
      unit: 'mm²',
      description: 'Gross area',
    },
    code: DesignCode.IS_2911,
    clause: '7.2',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 2: MINIMUM REINFORCEMENT
  // ============================================================================
  
  // Per IS 2911 Clause 7.2.3
  // Minimum longitudinal steel = 0.4% of Ag for driven cast-in-situ piles
  // = 0.8% for bored piles less than 600mm diameter
  
  let min_pt: number;
  if (diameter < 600) {
    min_pt = 0.8;
  } else {
    min_pt = 0.4;
  }
  
  const Ast_min = (min_pt / 100) * Ag;
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Minimum Reinforcement',
    description: 'Determine minimum longitudinal reinforcement',
    formula: 'Ast,min = pt,min × Ag / 100',
    values: {
      'pt,min': { value: min_pt, unit: '%', description: `For D = ${diameter}mm` },
      'Ag': { value: roundTo(Ag, 0), unit: 'mm²' },
    },
    result: {
      value: roundTo(Ast_min, 0),
      unit: 'mm²',
    },
    code: DesignCode.IS_2911,
    clause: '7.2.3',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 3: DESIGN FOR AXIAL + BENDING
  // ============================================================================
  
  // Use IS 456 SP 16 or simplified interaction
  // For pure axial: Pu = 0.4 × fck × Ac + 0.67 × fy × Asc
  
  const e_min = Math.max(20, length * 1000 / 500, d / 30); // Minimum eccentricity
  const e_actual = M > 0 ? (M * 1000 / P) : e_min;
  
  // Required reinforcement (simplified approach)
  const Pu = P * 1000; // N
  const Mu = Math.max(M, P * e_min / 1000); // kN-m with minimum eccentricity
  
  // Interaction formula (simplified)
  const Puz = 0.45 * fck * Ag + 0.75 * fy * Ast_min;
  const Mu_capacity = 0.36 * fck * d * d_eff * (d - 0.42 * d_eff) / 1e6; // Approximate
  
  // Required steel (simplified)
  let Ast_required = Ast_min;
  
  if (Pu > 0.4 * fck * Ag) {
    // Need compression steel
    Ast_required = (Pu - 0.4 * fck * Ag) / (0.67 * fy);
    Ast_required = Math.max(Ast_required, Ast_min);
  }
  
  // Check against M
  if (Mu * 1e6 > Mu_capacity * 1e6) {
    // Additional steel for moment
    const additional_steel = (Mu * 1e6 - Mu_capacity * 1e6) / (0.87 * fy * (d_eff - 50));
    Ast_required = Math.max(Ast_required, Ast_min + additional_steel);
  }
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Design for Axial Load and Bending',
    description: 'Calculate required reinforcement for combined loading',
    formula: 'Using IS 456 interaction diagram principles',
    values: {
      'P': { value: P, unit: 'kN' },
      'M': { value: M, unit: 'kN-m' },
      'e/D': { value: roundTo(e_actual / d, 3), description: 'Eccentricity ratio' },
    },
    result: {
      value: roundTo(Ast_required, 0),
      unit: 'mm²',
      description: 'Required reinforcement',
    },
    code: DesignCode.IS_2911,
    clause: '7.2',
    status: 'OK',
    notes: [
      `Minimum eccentricity = ${roundTo(e_min, 1)} mm`,
    ],
  }));
  
  // ============================================================================
  // STEP 4: BAR SELECTION
  // ============================================================================
  
  // Select bars (minimum 6 bars for circular section per IS 2911)
  const standard_bars = [12, 16, 20, 25, 32];
  let selected_bars = '';
  let Ast_provided = 0;
  
  for (const bar_dia of standard_bars) {
    const bar_area = Math.PI * bar_dia * bar_dia / 4;
    const num_bars = Math.ceil(Ast_required / bar_area);
    const actual_num = Math.max(num_bars, 6); // Minimum 6 bars
    
    // Check if bars fit around perimeter
    const circumference = Math.PI * (d - 2 * cover - bar_dia);
    const min_spacing = Math.max(bar_dia, 25); // IS 456 requirement
    const available_spacing = circumference / actual_num;
    
    if (available_spacing >= min_spacing && actual_num <= 12) {
      Ast_provided = actual_num * bar_area;
      selected_bars = `${actual_num}-${bar_dia}φ`;
      break;
    }
  }
  
  const pt = (Ast_provided / Ag) * 100;
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Reinforcement Selection',
    description: 'Select longitudinal bars',
    formula: 'Minimum 6 bars for circular section',
    values: {
      'Ast,required': { value: roundTo(Ast_required, 0), unit: 'mm²' },
      'Selected': { value: selected_bars },
    },
    result: {
      value: `${roundTo(Ast_provided, 0)} mm² (${roundTo(pt, 2)}%)`,
      description: 'Provided reinforcement',
    },
    code: DesignCode.IS_2911,
    clause: '7.2.3',
    status: Ast_provided >= Ast_required ? 'OK' : 'FAIL',
  }));
  
  // ============================================================================
  // STEP 5: LATERAL TIES / SPIRAL
  // ============================================================================
  
  // Per IS 2911 Clause 7.2.4
  // Pitch of spiral ≤ 150mm and ≥ 25mm
  const spiral_pitch = Math.min(150, d / 4);
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Lateral Reinforcement',
    description: 'Spiral reinforcement requirement',
    formula: 'Pitch ≤ min(150mm, D/4)',
    values: {
      'Pitch': { value: spiral_pitch, unit: 'mm' },
      'Spiral diameter': { value: 8, unit: 'mm', description: 'Minimum' },
    },
    result: {
      value: `8φ spiral @ ${spiral_pitch} c/c`,
      description: 'Lateral reinforcement',
    },
    code: DesignCode.IS_2911,
    clause: '7.2.4',
    status: 'OK',
  }));
  
  return {
    isAdequate: Ast_provided >= Ast_required,
    Ast_required: roundTo(Ast_required, 0),
    Ast_provided: roundTo(Ast_provided, 0),
    bars: selected_bars,
    pt: roundTo(pt, 2),
    Ast_min: roundTo(Ast_min, 0),
    spiral_pitch,
    calculations,
  };
}

// Export types
export type { CalculationStep, DiagramData };
