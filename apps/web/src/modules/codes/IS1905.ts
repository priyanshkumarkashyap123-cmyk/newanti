/**
 * ============================================================================
 * IS 1905:1987 - STRUCTURAL USE OF UNREINFORCED MASONRY
 * ============================================================================
 * 
 * Design of load-bearing masonry walls and columns per Indian Standard
 * 
 * SCOPE:
 * - Load-bearing walls
 * - Masonry columns and pillars
 * - Slenderness effects
 * - Eccentricity calculations
 * - Opening reductions
 * 
 * @reference IS 1905:1987 - Bureau of Indian Standards
 * @author BeamLab Engineering Team
 * @version 1.0.0
 */

import {
  createSimpleStep,
  roundTo,
  SimpleCalculationStep,
} from '../core/CalculationEngine';

// Alias for backward compatibility
type CalculationStep = SimpleCalculationStep;
const createCalculationStep = createSimpleStep;

// ============================================================================
// MATERIAL PROPERTIES - IS 1905:1987
// ============================================================================

/**
 * Basic compressive strength of masonry (fb)
 * Table 8 - IS 1905:1987
 * Values in MPa for different mortar types
 */
export const IS1905_BASIC_COMPRESSIVE_STRENGTH: Record<string, Record<string, number>> = {
  // Brick unit strength in MPa
  '3.5': { H1: 0.35, H2: 0.30, M1: 0.25, M2: 0.20, M3: 0.15, L1: 0.10, L2: 0.07 },
  '5.0': { H1: 0.50, H2: 0.45, M1: 0.40, M2: 0.30, M3: 0.25, L1: 0.15, L2: 0.10 },
  '7.5': { H1: 0.75, H2: 0.70, M1: 0.60, M2: 0.50, M3: 0.40, L1: 0.25, L2: 0.15 },
  '10.0': { H1: 1.00, H2: 0.90, M1: 0.80, M2: 0.65, M3: 0.55, L1: 0.35, L2: 0.20 },
  '12.5': { H1: 1.10, H2: 1.00, M1: 0.90, M2: 0.75, M3: 0.65, L1: 0.40, L2: 0.25 },
  '15.0': { H1: 1.25, H2: 1.15, M1: 1.00, M2: 0.85, M3: 0.75, L1: 0.45, L2: 0.30 },
  '17.5': { H1: 1.35, H2: 1.25, M1: 1.10, M2: 0.95, M3: 0.80, L1: 0.50, L2: 0.35 },
  '20.0': { H1: 1.50, H2: 1.35, M1: 1.20, M2: 1.00, M3: 0.90, L1: 0.55, L2: 0.38 },
  '25.0': { H1: 1.75, H2: 1.55, M1: 1.40, M2: 1.15, M3: 1.00, L1: 0.65, L2: 0.45 },
  '30.0': { H1: 1.90, H2: 1.70, M1: 1.55, M2: 1.30, M3: 1.10, L1: 0.70, L2: 0.50 },
  '35.0': { H1: 2.10, H2: 1.85, M1: 1.65, M2: 1.40, M3: 1.20, L1: 0.75, L2: 0.55 },
  '40.0': { H1: 2.25, H2: 2.00, M1: 1.80, M2: 1.50, M3: 1.30, L1: 0.85, L2: 0.58 },
};

/**
 * Mortar designations per IS 2250
 */
export const IS1905_MORTAR_TYPES = {
  H1: { cement_lime_sand: '1:0:3', compressive_strength: 10.0, description: 'High strength' },
  H2: { cement_lime_sand: '1:0.5:4.5', compressive_strength: 7.5, description: 'High strength with lime' },
  M1: { cement_lime_sand: '1:1:6', compressive_strength: 5.0, description: 'Medium strength' },
  M2: { cement_lime_sand: '1:2:9', compressive_strength: 3.0, description: 'Medium-low strength' },
  M3: { cement_lime_sand: '1:3:12', compressive_strength: 1.5, description: 'Low strength' },
  L1: { cement_lime_sand: 'Lime mortar', compressive_strength: 0.7, description: 'Lime mortar' },
  L2: { cement_lime_sand: 'Mud mortar', compressive_strength: 0.5, description: 'Mud/Clay mortar' },
} as const;

/**
 * Shape modification factor (ks)
 * Table 10 - IS 1905:1987
 */
export const IS1905_SHAPE_FACTOR: Record<string, number> = {
  'solid_rectangular': 1.0,
  'solid_square': 1.0,
  'hollow_35_void': 0.9,
  'hollow_35_50_void': 0.8,
  'cellular': 1.0,
};

/**
 * Stress reduction factor (ks) for slenderness
 * Table 9 - IS 1905:1987
 */
export const IS1905_STRESS_REDUCTION: Record<number, Record<number, number>> = {
  // Slenderness ratio: { eccentricity/thickness: factor }
  6: { 0: 1.00, 0.05: 0.99, 0.10: 0.97, 0.15: 0.93, 0.20: 0.87, 0.25: 0.79, 0.30: 0.69, 0.33: 0.62 },
  8: { 0: 1.00, 0.05: 0.95, 0.10: 0.89, 0.15: 0.82, 0.20: 0.73, 0.25: 0.63, 0.30: 0.51, 0.33: 0.43 },
  10: { 0: 0.97, 0.05: 0.90, 0.10: 0.81, 0.15: 0.71, 0.20: 0.60, 0.25: 0.47, 0.30: 0.32, 0.33: 0.24 },
  12: { 0: 0.93, 0.05: 0.84, 0.10: 0.74, 0.15: 0.62, 0.20: 0.49, 0.25: 0.35, 0.30: 0.19, 0.33: 0.10 },
  14: { 0: 0.89, 0.05: 0.78, 0.10: 0.67, 0.15: 0.54, 0.20: 0.40, 0.25: 0.25, 0.30: 0.08, 0.33: 0.00 },
  16: { 0: 0.84, 0.05: 0.73, 0.10: 0.60, 0.15: 0.47, 0.20: 0.32, 0.25: 0.17, 0.30: 0.00, 0.33: 0.00 },
  18: { 0: 0.78, 0.05: 0.67, 0.10: 0.54, 0.15: 0.40, 0.20: 0.25, 0.25: 0.09, 0.30: 0.00, 0.33: 0.00 },
  20: { 0: 0.73, 0.05: 0.61, 0.10: 0.48, 0.15: 0.33, 0.20: 0.18, 0.25: 0.03, 0.30: 0.00, 0.33: 0.00 },
  22: { 0: 0.67, 0.05: 0.55, 0.10: 0.42, 0.15: 0.28, 0.20: 0.13, 0.25: 0.00, 0.30: 0.00, 0.33: 0.00 },
  24: { 0: 0.62, 0.05: 0.50, 0.10: 0.36, 0.15: 0.23, 0.20: 0.08, 0.25: 0.00, 0.30: 0.00, 0.33: 0.00 },
  26: { 0: 0.56, 0.05: 0.44, 0.10: 0.31, 0.15: 0.18, 0.20: 0.04, 0.25: 0.00, 0.30: 0.00, 0.33: 0.00 },
  27: { 0: 0.53, 0.05: 0.41, 0.10: 0.29, 0.15: 0.15, 0.20: 0.02, 0.25: 0.00, 0.30: 0.00, 0.33: 0.00 },
};

/**
 * Permissible shear stress
 * Clause 5.4.3 - IS 1905:1987
 */
export const IS1905_PERMISSIBLE_SHEAR: Record<string, number> = {
  H1: 0.50, // MPa
  H2: 0.45,
  M1: 0.35,
  M2: 0.25,
  M3: 0.20,
  L1: 0.10,
  L2: 0.07,
};

/**
 * Permissible tensile stress (flexural)
 * Clause 5.4.4 - IS 1905:1987
 */
export const IS1905_PERMISSIBLE_TENSION = {
  normal_to_bed_joint: 0.07, // MPa (perpendicular to bed joint)
  parallel_to_bed_joint: 0.14, // MPa (parallel to bed joint)
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

export interface MasonryWallInput {
  // Geometry
  height: number;           // mm - Clear height
  thickness: number;        // mm - Wall thickness
  length: number;           // mm - Wall length
  
  // Support conditions
  lateral_support: 'both_ends' | 'one_end' | 'cantilever';
  top_support: 'continuous' | 'partial' | 'none';
  
  // Material
  brick_strength: number;   // MPa - Compressive strength of brick unit
  mortar_type: keyof typeof IS1905_MORTAR_TYPES;
  unit_type: keyof typeof IS1905_SHAPE_FACTOR;
  
  // Loading
  axial_load: number;       // kN - Total axial load
  eccentricity: number;     // mm - Load eccentricity (if any)
  
  // Openings (optional)
  openings?: {
    width: number;          // mm
    height: number;         // mm
    from_edge: number;      // mm - Distance from wall edge
  }[];
}

export interface MasonryWallResult {
  isAdequate: boolean;
  status: string;
  
  // Effective properties
  effective_height: number;     // mm
  effective_thickness: number;  // mm
  slenderness_ratio: number;
  
  // Stresses
  basic_stress: number;         // MPa (fb)
  permissible_stress: number;   // MPa
  actual_stress: number;        // MPa
  utilization: number;
  
  // Capacity
  capacity: number;             // kN
  
  steps: CalculationStep[];
}

export interface MasonryColumnInput {
  // Geometry
  height: number;           // mm - Clear height
  width: number;            // mm - Column width (smaller dimension)
  depth: number;            // mm - Column depth (larger dimension)
  
  // Support
  end_conditions: 'fixed_fixed' | 'fixed_pinned' | 'pinned_pinned';
  
  // Material
  brick_strength: number;   // MPa
  mortar_type: keyof typeof IS1905_MORTAR_TYPES;
  
  // Loading
  axial_load: number;       // kN
  moment?: number;          // kN·m (if any)
}

export interface MasonryColumnResult {
  isAdequate: boolean;
  status: string;
  
  slenderness_ratio: number;
  effective_length: number;     // mm
  area_factor: number;          // Area reduction factor
  stress_reduction_factor: number;
  
  permissible_load: number;     // kN
  actual_stress: number;        // MPa
  utilization: number;
  
  steps: CalculationStep[];
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Get effective height of masonry wall
 * Clause 4.4.1 - IS 1905:1987
 */
export function getEffectiveHeight(
  height: number,
  lateral_support: 'both_ends' | 'one_end' | 'cantilever',
  thickness: number
): { heff: number; step: CalculationStep } {
  let factor: number;
  let description: string;
  
  switch (lateral_support) {
    case 'both_ends':
      factor = 0.75; // When supported top and bottom
      description = 'Wall supported at both ends (top and bottom)';
      break;
    case 'one_end':
      factor = 1.0; // When supported at one end only
      description = 'Wall supported at one end only';
      break;
    case 'cantilever':
      factor = 2.0; // Cantilever wall
      description = 'Cantilever wall';
      break;
  }
  
  const heff = factor * height;
  
  const step = createCalculationStep(
    'Effective Height',
    `Per IS 1905 Clause 4.4.1: ${description}
    heff = ${factor} × h`,
    `h_{eff} = ${factor} \\times ${height} = ${roundTo(heff, 0)} \\text{ mm}`,
    {
      'Actual height (h)': `${height} mm`,
      'Support condition': lateral_support,
      'Effective height factor': factor,
      'Effective height (heff)': `${roundTo(heff, 0)} mm`,
    },
    'IS 1905 Cl. 4.4.1'
  );
  
  return { heff, step };
}

/**
 * Get effective thickness considering engaged/bonded walls
 * Clause 4.4.2 - IS 1905:1987
 */
export function getEffectiveThickness(
  thickness: number,
  stiffening_type: 'none' | 'pier' | 'cross_wall'
): number {
  // For simple wall without stiffening
  if (stiffening_type === 'none') {
    return thickness;
  }
  
  // For stiffened walls, effective thickness increases
  // This is a simplified approach
  return thickness * 1.2;
}

/**
 * Calculate slenderness ratio
 * Clause 4.4.3 - IS 1905:1987
 */
export function calculateSlendernessRatio(
  effective_height: number,
  effective_thickness: number
): { SR: number; isWithinLimit: boolean; step: CalculationStep } {
  const SR = effective_height / effective_thickness;
  const limit = 27; // Maximum slenderness ratio per IS 1905
  
  const step = createCalculationStep(
    'Slenderness Ratio',
    `Per IS 1905 Clause 4.4.3: SR = heff / teff
    Maximum permissible SR = 27`,
    `SR = \\frac{${effective_height}}{${effective_thickness}} = ${roundTo(SR, 2)}`,
    {
      'Effective height (heff)': `${effective_height} mm`,
      'Effective thickness (teff)': `${effective_thickness} mm`,
      'Slenderness ratio': roundTo(SR, 2),
      'Maximum allowed': limit,
      'Status': SR <= limit ? 'OK ✓' : 'EXCEEDS LIMIT ✗',
    },
    'IS 1905 Cl. 4.4.3'
  );
  
  return { SR: roundTo(SR, 2), isWithinLimit: SR <= limit, step };
}

/**
 * Get basic compressive stress from brick and mortar combination
 */
export function getBasicCompressiveStress(
  brick_strength: number,
  mortar_type: string
): { fb: number; step: CalculationStep } {
  // Find closest brick strength in table
  const strengths = Object.keys(IS1905_BASIC_COMPRESSIVE_STRENGTH).map(Number);
  const closest = strengths.reduce((prev, curr) => 
    Math.abs(curr - brick_strength) < Math.abs(prev - brick_strength) ? curr : prev
  );
  
  const fb = IS1905_BASIC_COMPRESSIVE_STRENGTH[closest.toString()][mortar_type] || 0.5;
  
  const step = createCalculationStep(
    'Basic Compressive Stress',
    `Per IS 1905 Table 8: Basic compressive stress (fb) based on
    brick unit strength and mortar type`,
    `f_b = ${roundTo(fb, 3)} \\text{ MPa}`,
    {
      'Brick strength': `${brick_strength} MPa`,
      'Mortar type': mortar_type,
      'Basic stress (fb)': `${roundTo(fb, 3)} MPa`,
    },
    'IS 1905 Table 8'
  );
  
  return { fb: roundTo(fb, 3), step };
}

/**
 * Get stress reduction factor from Table 9
 */
export function getStressReductionFactor(
  slenderness_ratio: number,
  eccentricity_ratio: number  // e/t ratio
): number {
  // Find closest values in table
  const srValues = Object.keys(IS1905_STRESS_REDUCTION).map(Number);
  const closestSR = srValues.reduce((prev, curr) => 
    Math.abs(curr - slenderness_ratio) < Math.abs(prev - slenderness_ratio) ? curr : prev
  );
  
  const eccValues = Object.keys(IS1905_STRESS_REDUCTION[closestSR]).map(Number);
  const closestEcc = eccValues.reduce((prev, curr) => 
    Math.abs(curr - eccentricity_ratio) < Math.abs(prev - eccentricity_ratio) ? curr : prev
  );
  
  return IS1905_STRESS_REDUCTION[closestSR][closestEcc];
}

/**
 * Calculate area reduction for openings
 * Clause 4.4.4 - IS 1905:1987
 */
export function calculateOpeningReduction(
  wall_length: number,
  wall_height: number,
  openings: { width: number; height: number }[]
): { factor: number; step: CalculationStep } {
  const wall_area = wall_length * wall_height;
  const opening_area = openings.reduce((sum, op) => sum + op.width * op.height, 0);
  
  const opening_ratio = opening_area / wall_area;
  
  // Reduction factor based on opening ratio
  let factor: number;
  if (opening_ratio <= 0.15) {
    factor = 1.0;
  } else if (opening_ratio <= 0.25) {
    factor = 0.9;
  } else if (opening_ratio <= 0.35) {
    factor = 0.8;
  } else if (opening_ratio <= 0.50) {
    factor = 0.7;
  } else {
    factor = 0.5;
  }
  
  const step = createCalculationStep(
    'Opening Area Reduction',
    `Per IS 1905 Clause 4.4.4: Area reduction for openings`,
    `\\text{Opening ratio} = \\frac{${opening_area}}{${wall_area}} = ${roundTo(opening_ratio * 100, 1)}\\%`,
    {
      'Wall area': `${wall_area} mm²`,
      'Opening area': `${opening_area} mm²`,
      'Opening ratio': `${roundTo(opening_ratio * 100, 1)}%`,
      'Reduction factor': factor,
    },
    'IS 1905 Cl. 4.4.4'
  );
  
  return { factor, step };
}

/**
 * Design masonry wall per IS 1905:1987
 */
export function designMasonryWallIS1905(
  input: MasonryWallInput
): MasonryWallResult {
  const steps: CalculationStep[] = [];
  const {
    height, thickness, length,
    lateral_support, top_support,
    brick_strength, mortar_type, unit_type,
    axial_load, eccentricity,
    openings
  } = input;
  
  // Step 1: Effective height
  const { heff, step: heffStep } = getEffectiveHeight(height, lateral_support, thickness);
  steps.push(heffStep);
  
  // Step 2: Effective thickness
  const teff = getEffectiveThickness(thickness, 'none');
  steps.push(createCalculationStep(
    'Effective Thickness',
    'Per IS 1905 Clause 4.4.2: For plain wall without stiffening',
    `t_{eff} = ${teff} \\text{ mm}`,
    {
      'Actual thickness': `${thickness} mm`,
      'Effective thickness': `${teff} mm`,
    },
    'IS 1905 Cl. 4.4.2'
  ));
  
  // Step 3: Slenderness ratio
  const { SR, isWithinLimit, step: srStep } = calculateSlendernessRatio(heff, teff);
  steps.push(srStep);
  
  if (!isWithinLimit) {
    return {
      isAdequate: false,
      status: 'Slenderness ratio exceeds maximum limit of 27',
      effective_height: heff,
      effective_thickness: teff,
      slenderness_ratio: SR,
      basic_stress: 0,
      permissible_stress: 0,
      actual_stress: 0,
      utilization: 999,
      capacity: 0,
      steps,
    };
  }
  
  // Step 4: Basic compressive stress
  const { fb, step: fbStep } = getBasicCompressiveStress(brick_strength, mortar_type);
  steps.push(fbStep);
  
  // Step 5: Shape modification factor
  const ks = IS1905_SHAPE_FACTOR[unit_type] || 1.0;
  steps.push(createCalculationStep(
    'Shape Modification Factor',
    'Per IS 1905 Table 10: Based on masonry unit type',
    `k_s = ${ks}`,
    {
      'Unit type': unit_type,
      'Shape factor (ks)': ks,
    },
    'IS 1905 Table 10'
  ));
  
  // Step 6: Stress reduction factor for slenderness and eccentricity
  const ecc_ratio = eccentricity / thickness;
  const ka = getStressReductionFactor(SR, ecc_ratio);
  steps.push(createCalculationStep(
    'Stress Reduction Factor',
    'Per IS 1905 Table 9: Based on slenderness ratio and eccentricity',
    `k_a = ${roundTo(ka, 3)}`,
    {
      'Slenderness ratio (SR)': SR,
      'Eccentricity ratio (e/t)': roundTo(ecc_ratio, 3),
      'Stress reduction factor (ka)': roundTo(ka, 3),
    },
    'IS 1905 Table 9'
  ));
  
  // Step 7: Opening reduction (if applicable)
  let kp = 1.0;
  if (openings && openings.length > 0) {
    const { factor, step: openingStep } = calculateOpeningReduction(length, height, openings);
    kp = factor;
    steps.push(openingStep);
  }
  
  // Step 8: Permissible stress
  const permissible_stress = fb * ks * ka * kp;
  steps.push(createCalculationStep(
    'Permissible Compressive Stress',
    'Per IS 1905: f_perm = fb × ks × ka × kp',
    `f_{perm} = ${fb} \\times ${ks} \\times ${roundTo(ka, 3)} \\times ${kp} = ${roundTo(permissible_stress, 3)} \\text{ MPa}`,
    {
      'Basic stress (fb)': `${fb} MPa`,
      'Shape factor (ks)': ks,
      'Area reduction (ka)': roundTo(ka, 3),
      'Opening factor (kp)': kp,
      'Permissible stress': `${roundTo(permissible_stress, 3)} MPa`,
    },
    'IS 1905 Cl. 5.4.1'
  ));
  
  // Step 9: Actual stress
  const area = length * thickness; // mm²
  const actual_stress = (axial_load * 1000) / area; // MPa
  const utilization = actual_stress / permissible_stress;
  
  steps.push(createCalculationStep(
    'Stress Check',
    'Compare actual stress with permissible stress',
    `\\sigma_{actual} = \\frac{P}{A} = \\frac{${axial_load} \\times 1000}{${area}} = ${roundTo(actual_stress, 3)} \\text{ MPa}`,
    {
      'Axial load (P)': `${axial_load} kN`,
      'Wall area (A)': `${area} mm²`,
      'Actual stress': `${roundTo(actual_stress, 3)} MPa`,
      'Permissible stress': `${roundTo(permissible_stress, 3)} MPa`,
      'Utilization': `${roundTo(utilization * 100, 1)}%`,
      'Status': utilization <= 1.0 ? 'ADEQUATE ✓' : 'OVERSTRESSED ✗',
    },
    'IS 1905'
  ));
  
  // Capacity
  const capacity = permissible_stress * area / 1000; // kN
  
  const isAdequate = utilization <= 1.0;
  
  return {
    isAdequate,
    status: isAdequate ? 'Wall is adequate for applied load' : 'Wall is overstressed - increase thickness or reduce load',
    effective_height: heff,
    effective_thickness: teff,
    slenderness_ratio: SR,
    basic_stress: fb,
    permissible_stress: roundTo(permissible_stress, 3),
    actual_stress: roundTo(actual_stress, 3),
    utilization: roundTo(utilization, 3),
    capacity: roundTo(capacity, 1),
    steps,
  };
}

/**
 * Design masonry column per IS 1905:1987
 */
export function designMasonryColumnIS1905(
  input: MasonryColumnInput
): MasonryColumnResult {
  const steps: CalculationStep[] = [];
  const {
    height, width, depth,
    end_conditions,
    brick_strength, mortar_type,
    axial_load, moment
  } = input;
  
  // Effective length factors
  const kFactors: Record<string, number> = {
    'fixed_fixed': 0.65,
    'fixed_pinned': 0.80,
    'pinned_pinned': 1.00,
  };
  
  const k = kFactors[end_conditions];
  const effective_length = k * height;
  
  steps.push(createCalculationStep(
    'Effective Length',
    `Per IS 1905: Effective length based on end conditions`,
    `L_{eff} = k \\times h = ${k} \\times ${height} = ${roundTo(effective_length, 0)} \\text{ mm}`,
    {
      'Actual height': `${height} mm`,
      'End condition': end_conditions,
      'Effective length factor (k)': k,
      'Effective length': `${roundTo(effective_length, 0)} mm`,
    },
    'IS 1905'
  ));
  
  // Slenderness ratio (about weaker axis)
  const t = Math.min(width, depth); // Least dimension
  const SR = effective_length / t;
  
  steps.push(createCalculationStep(
    'Slenderness Ratio',
    `SR = Leff / t (about weaker axis)`,
    `SR = \\frac{${effective_length}}{${t}} = ${roundTo(SR, 2)}`,
    {
      'Effective length': `${effective_length} mm`,
      'Least dimension (t)': `${t} mm`,
      'Slenderness ratio': roundTo(SR, 2),
      'Maximum allowed': 27,
      'Status': SR <= 27 ? 'OK ✓' : 'EXCEEDS LIMIT ✗',
    },
    'IS 1905'
  ));
  
  // Area factor for columns (Table 11)
  let area_factor = 1.0;
  const area = width * depth;
  if (area < 0.1e6) {
    area_factor = 0.7;
  } else if (area < 0.2e6) {
    area_factor = 0.8;
  } else if (area < 0.5e6) {
    area_factor = 0.9;
  }
  
  steps.push(createCalculationStep(
    'Area Factor',
    'Per IS 1905 Table 11: Reduction for small column cross-sections',
    `k_c = ${area_factor}`,
    {
      'Column area': `${area} mm² = ${roundTo(area / 1e6, 3)} m²`,
      'Area factor': area_factor,
    },
    'IS 1905 Table 11'
  ));
  
  // Eccentricity from moment
  let ecc_ratio = 0;
  if (moment) {
    const e = (moment * 1e6) / (axial_load * 1000); // mm
    ecc_ratio = e / t;
  }
  
  // Basic compressive stress
  const { fb, step: fbStep } = getBasicCompressiveStress(brick_strength, mortar_type);
  steps.push(fbStep);
  
  // Stress reduction factor
  const ka = getStressReductionFactor(Math.min(SR, 27), Math.min(ecc_ratio, 0.33));
  
  steps.push(createCalculationStep(
    'Stress Reduction Factor',
    'Per IS 1905 Table 9',
    `k_a = ${roundTo(ka, 3)}`,
    {
      'Slenderness ratio': roundTo(SR, 2),
      'Eccentricity ratio': roundTo(ecc_ratio, 3),
      'Stress reduction': roundTo(ka, 3),
    },
    'IS 1905 Table 9'
  ));
  
  // Permissible stress
  const permissible_stress = fb * area_factor * ka;
  const permissible_load = permissible_stress * area / 1000; // kN
  
  // Actual stress
  const actual_stress = (axial_load * 1000) / area;
  const utilization = axial_load / permissible_load;
  
  steps.push(createCalculationStep(
    'Load Capacity Check',
    'Compare applied load with permissible load',
    `P_{perm} = f_{perm} \\times A = ${roundTo(permissible_stress, 3)} \\times ${area} / 1000 = ${roundTo(permissible_load, 1)} \\text{ kN}`,
    {
      'Permissible stress': `${roundTo(permissible_stress, 3)} MPa`,
      'Column area': `${area} mm²`,
      'Permissible load': `${roundTo(permissible_load, 1)} kN`,
      'Applied load': `${axial_load} kN`,
      'Utilization': `${roundTo(utilization * 100, 1)}%`,
      'Status': utilization <= 1.0 ? 'ADEQUATE ✓' : 'OVERSTRESSED ✗',
    },
    'IS 1905'
  ));
  
  const isAdequate = utilization <= 1.0 && SR <= 27;
  
  return {
    isAdequate,
    status: isAdequate ? 'Column is adequate' : 'Column is inadequate',
    slenderness_ratio: roundTo(SR, 2),
    effective_length: roundTo(effective_length, 0),
    area_factor,
    stress_reduction_factor: roundTo(ka, 3),
    permissible_load: roundTo(permissible_load, 1),
    actual_stress: roundTo(actual_stress, 3),
    utilization: roundTo(utilization, 3),
    steps,
  };
}

// ============================================================================
// EXPORT QUICK REFERENCE
// ============================================================================

export const IS1905_QUICK_REFERENCE = {
  slenderness_limit: 27,
  eccentricity_limit: '0.33t (one-third of thickness)',
  mortar_types: ['H1', 'H2', 'M1', 'M2', 'M3', 'L1', 'L2'],
  permissible_shear: '0.07 to 0.50 MPa based on mortar',
  permissible_tension: {
    perpendicular: '0.07 MPa',
    parallel: '0.14 MPa',
  },
  min_thickness: {
    load_bearing_external: '230 mm',
    load_bearing_internal: '115 mm',
    partition: '75 mm',
  },
};