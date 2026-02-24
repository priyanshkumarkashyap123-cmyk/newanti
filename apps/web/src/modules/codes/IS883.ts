/**
 * ============================================================================
 * IS 883:1994 - DESIGN OF STRUCTURAL TIMBER IN BUILDING
 * ============================================================================
 * 
 * Design of timber structural elements per Indian Standard
 * 
 * SCOPE:
 * - Timber beams and joists
 * - Timber columns and struts  
 * - Timber connections
 * - Grade stresses and modifiers
 * - Deflection limits
 * 
 * @reference IS 883:1994 - Bureau of Indian Standards
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
// TIMBER GRADES AND PROPERTIES - IS 883:1994
// ============================================================================

/**
 * Permissible stresses for structural timber (inside location)
 * Table 1 - IS 883:1994
 * All values in MPa
 */
export const IS883_PERMISSIBLE_STRESSES = {
  // Grade I - Select Grade
  Grade_I: {
    bending: 15.0,                    // MPa
    tension_parallel: 11.0,           // MPa
    tension_perpendicular: 0.6,       // MPa
    compression_parallel: 9.6,        // MPa
    compression_perpendicular: 2.7,   // MPa
    horizontal_shear: 1.0,            // MPa
    average_modulus: 12500,           // MPa (E)
    minimum_modulus: 10200,           // MPa (E_min)
  },
  
  // Grade II - Standard Grade
  Grade_II: {
    bending: 10.5,
    tension_parallel: 7.8,
    tension_perpendicular: 0.45,
    compression_parallel: 6.6,
    compression_perpendicular: 2.1,
    horizontal_shear: 0.7,
    average_modulus: 10000,
    minimum_modulus: 8000,
  },
  
  // Select Structural - Group A Species
  Select_A: {
    bending: 18.0,
    tension_parallel: 13.5,
    tension_perpendicular: 0.75,
    compression_parallel: 12.0,
    compression_perpendicular: 3.3,
    horizontal_shear: 1.2,
    average_modulus: 15000,
    minimum_modulus: 12500,
  },
  
  // Select Structural - Group B Species  
  Select_B: {
    bending: 12.0,
    tension_parallel: 9.0,
    tension_perpendicular: 0.50,
    compression_parallel: 8.0,
    compression_perpendicular: 2.2,
    horizontal_shear: 0.85,
    average_modulus: 11000,
    minimum_modulus: 9000,
  },
} as const;

export type TimberGrade = keyof typeof IS883_PERMISSIBLE_STRESSES;

/**
 * Species groupings per IS 883
 * Partial list of common species
 */
export const IS883_TIMBER_SPECIES = {
  Group_A: {
    name: 'Group A - High Strength',
    species: ['Sal', 'Laurel', 'Teak', 'Rosewood', 'Sisso', 'Ironwood'],
    density_range: '700-900 kg/m³',
  },
  Group_B: {
    name: 'Group B - Medium Strength',
    species: ['Deodar', 'Pine', 'Spruce', 'Silver Fir', 'Chir', 'Kail'],
    density_range: '500-700 kg/m³',
  },
  Group_C: {
    name: 'Group C - Low Strength',
    species: ['Mango', 'Poplar', 'Balsa'],
    density_range: '350-500 kg/m³',
  },
} as const;

/**
 * Modification factors
 * Table 3, 4, 5 - IS 883:1994
 */
export const IS883_MODIFICATION_FACTORS = {
  // Duration of load factor (K1) - Table 3
  duration_of_load: {
    permanent: 1.0,           // Dead load, long-term storage
    normal: 1.15,             // Dead + normal live loads
    short_term: 1.25,         // Wind + snow
    impact: 1.50,             // Earthquake, impact
  },
  
  // Wet service factor (K2) - for permanently wet conditions
  wet_service: {
    dry: 1.0,                 // MC < 19%
    wet: 0.8,                 // MC > 19%
  },
  
  // Temperature factor (K3)
  temperature: {
    normal: 1.0,              // Up to 40°C
    moderate: 0.9,            // 40-50°C
    high: 0.75,               // Above 50°C
  },
  
  // Size factor (K4) for flexural members
  // Reference depth = 300mm
  size_factor: (depth: number): number => {
    if (depth <= 150) return 1.3;
    if (depth >= 300) return 1.0;
    return 1.3 - (depth - 150) * 0.002; // Linear interpolation
  },
  
  // Form factor (K5) - for non-rectangular sections
  form_factor: {
    rectangular: 1.0,
    circular: 1.18,
    diamond: 1.41,
    I_section: 1.0, // Depends on section
  },
  
  // Bearing area factor (K6)
  bearing_factor: (bearing_length: number, depth: number): number => {
    const ratio = bearing_length / depth;
    if (ratio >= 1.0) return 1.0;
    if (ratio <= 0.25) return 1.33;
    return 1.0 + (1.0 - ratio) * 0.44;
  },
};

/**
 * Effective length factors for compression members
 * Table 7 - IS 883:1994
 */
export const IS883_EFFECTIVE_LENGTH_FACTORS: Record<string, number> = {
  'both_ends_pinned': 1.0,
  'both_ends_fixed': 0.65,
  'one_end_fixed_one_pinned': 0.80,
  'one_end_fixed_one_free': 2.0,
  'one_end_pinned_one_lateral': 1.0,
};

/**
 * Deflection limits
 * Clause 7.3 - IS 883:1994
 */
export const IS883_DEFLECTION_LIMITS = {
  floor_beams: 240,           // L/240
  roof_beams_plastered: 300,  // L/300
  roof_beams_unplastered: 180, // L/180
  cantilevers: 120,           // L/120
  purlins: 150,               // L/150
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

export interface TimberBeamInput {
  // Section properties
  width: number;            // mm
  depth: number;            // mm
  span: number;             // mm
  
  // Loading
  point_loads?: { P: number; position: number }[]; // kN, mm from left
  distributed_load?: number;  // kN/m (total UDL including self-weight)
  
  // Material
  grade: TimberGrade;
  
  // Conditions
  load_duration: 'permanent' | 'normal' | 'short_term' | 'impact';
  moisture_condition: 'dry' | 'wet';
  temperature: 'normal' | 'moderate' | 'high';
  support_type: 'simple' | 'continuous' | 'cantilever';
  
  // Deflection requirement
  deflection_limit?: number;  // Override default
}

export interface TimberBeamResult {
  isAdequate: boolean;
  status: string;
  
  // Section properties
  section_modulus: number;    // mm³
  moment_of_inertia: number;  // mm⁴
  
  // Applied effects  
  max_moment: number;         // kN·m
  max_shear: number;          // kN
  max_deflection: number;     // mm
  
  // Permissible values
  permissible_bending: number;    // MPa
  permissible_shear: number;      // MPa
  allowable_deflection: number;   // mm
  
  // Actual stresses
  actual_bending: number;     // MPa
  actual_shear: number;       // MPa
  
  // Utilization ratios
  bending_utilization: number;
  shear_utilization: number;
  deflection_utilization: number;
  
  steps: CalculationStep[];
}

export interface TimberColumnInput {
  // Section properties
  width: number;            // mm (smaller dimension)
  depth: number;            // mm (larger dimension)
  length: number;           // mm (unbraced length)
  
  // Loading
  axial_load: number;       // kN
  moment_x?: number;        // kN·m (about x-axis)
  moment_y?: number;        // kN·m (about y-axis)
  
  // Material
  grade: TimberGrade;
  
  // Support conditions
  end_condition_x: keyof typeof IS883_EFFECTIVE_LENGTH_FACTORS;
  end_condition_y: keyof typeof IS883_EFFECTIVE_LENGTH_FACTORS;
  
  // Service conditions
  load_duration: 'permanent' | 'normal' | 'short_term' | 'impact';
  moisture_condition: 'dry' | 'wet';
}

export interface TimberColumnResult {
  isAdequate: boolean;
  status: string;
  
  // Section properties
  area: number;               // mm²
  slenderness_x: number;
  slenderness_y: number;
  governing_slenderness: number;
  
  // Buckling
  euler_stress: number;       // MPa
  buckling_factor: number;
  
  // Stresses
  permissible_compression: number;  // MPa
  actual_compression: number;       // MPa
  combined_stress_ratio: number;
  
  capacity: number;           // kN
  utilization: number;
  
  steps: CalculationStep[];
}

export interface NailedConnectionInput {
  // Nail properties
  nail_diameter: number;      // mm
  nail_length: number;        // mm
  nail_type: 'wire' | 'cut';
  
  // Loading
  load_per_nail: number;      // kN
  load_direction: 'lateral' | 'withdrawal';
  
  // Connection geometry
  number_of_nails: number;
  spacing: number;            // mm
  edge_distance: number;      // mm
  end_distance: number;       // mm
  
  // Material
  timber_grade: TimberGrade;
  moisture_condition: 'dry' | 'wet';
}

export interface NailedConnectionResult {
  isAdequate: boolean;
  
  permissible_load_per_nail: number;  // kN
  total_connection_capacity: number;  // kN
  required_capacity: number;          // kN
  utilization: number;
  
  spacing_check: string;
  edge_distance_check: string;
  
  steps: CalculationStep[];
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate section properties for rectangular timber
 */
export function calculateTimberSectionProperties(
  width: number,
  depth: number
): { area: number; Zxx: number; Zyy: number; Ixx: number; Iyy: number; rxx: number; ryy: number } {
  const area = width * depth;
  const Ixx = (width * Math.pow(depth, 3)) / 12;
  const Iyy = (depth * Math.pow(width, 3)) / 12;
  const Zxx = (width * Math.pow(depth, 2)) / 6;
  const Zyy = (depth * Math.pow(width, 2)) / 6;
  const rxx = depth / Math.sqrt(12);
  const ryy = width / Math.sqrt(12);
  
  return {
    area,
    Zxx: roundTo(Zxx, 0),
    Zyy: roundTo(Zyy, 0),
    Ixx: roundTo(Ixx, 0),
    Iyy: roundTo(Iyy, 0),
    rxx: roundTo(rxx, 2),
    ryy: roundTo(ryy, 2),
  };
}

/**
 * Get modification factors for timber design
 */
export function getModificationFactors(
  load_duration: 'permanent' | 'normal' | 'short_term' | 'impact',
  moisture: 'dry' | 'wet',
  temperature: 'normal' | 'moderate' | 'high',
  depth?: number
): { K1: number; K2: number; K3: number; K4: number; combined: number; step: CalculationStep } {
  const K1 = IS883_MODIFICATION_FACTORS.duration_of_load[load_duration];
  const K2 = IS883_MODIFICATION_FACTORS.wet_service[moisture];
  const K3 = IS883_MODIFICATION_FACTORS.temperature[temperature];
  const K4 = depth ? IS883_MODIFICATION_FACTORS.size_factor(depth) : 1.0;
  
  const combined = K1 * K2 * K3 * K4;
  
  const step = createCalculationStep(
    'Modification Factors',
    `Per IS 883 Tables 3-6: Combined modification factor for service conditions`,
    `K_{combined} = K_1 \\times K_2 \\times K_3 \\times K_4 = ${K1} \\times ${K2} \\times ${K3} \\times ${roundTo(K4, 3)} = ${roundTo(combined, 3)}`,
    {
      'Duration of load (K1)': `${K1} (${load_duration})`,
      'Wet service (K2)': `${K2} (${moisture})`,
      'Temperature (K3)': `${K3} (${temperature})`,
      'Size factor (K4)': depth ? `${roundTo(K4, 3)} (depth=${depth}mm)` : '1.0 (not applicable)',
      'Combined factor': roundTo(combined, 3),
    },
    'IS 883 Tables 3-6'
  );
  
  return { K1, K2, K3, K4, combined, step };
}

/**
 * Calculate simply supported beam actions
 */
function calculateSimpleBeamActions(
  span: number,
  udl: number,
  E: number,
  I: number
): { M_max: number; V_max: number; delta_max: number } {
  // UDL in kN/m, span in mm
  const w = udl / 1000; // kN/mm
  const M_max = (w * span * span) / 8 / 1000; // kN·m
  const V_max = (w * span) / 2; // kN
  const delta_max = (5 * w * Math.pow(span, 4)) / (384 * E * I); // mm
  
  return {
    M_max: roundTo(M_max, 2),
    V_max: roundTo(V_max, 2),
    delta_max: roundTo(delta_max, 2),
  };
}

/**
 * Design timber beam per IS 883:1994
 */
export function designTimberBeamIS883(input: TimberBeamInput): TimberBeamResult {
  const steps: CalculationStep[] = [];
  const {
    width, depth, span,
    distributed_load = 0,
    grade,
    load_duration, moisture_condition, temperature,
    support_type,
    deflection_limit
  } = input;
  
  // Step 1: Section properties
  const section = calculateTimberSectionProperties(width, depth);
  steps.push(createCalculationStep(
    'Section Properties',
    `Rectangular timber section ${width} × ${depth} mm`,
    `Z_{xx} = \\frac{bd^2}{6} = \\frac{${width} \\times ${depth}^2}{6} = ${section.Zxx} \\text{ mm}^3`,
    {
      'Width (b)': `${width} mm`,
      'Depth (d)': `${depth} mm`,
      'Area': `${section.area} mm²`,
      'Section modulus (Zxx)': `${section.Zxx} mm³`,
      'Moment of inertia (Ixx)': `${section.Ixx} mm⁴`,
      'Radius of gyration (rxx)': `${section.rxx} mm`,
    },
    'IS 883'
  ));
  
  // Step 2: Material properties
  const material = IS883_PERMISSIBLE_STRESSES[grade];
  steps.push(createCalculationStep(
    'Material Properties',
    `Timber grade: ${grade}`,
    `f_b = ${material.bending} \\text{ MPa}, E = ${material.average_modulus} \\text{ MPa}`,
    {
      'Grade': grade,
      'Bending stress (fb)': `${material.bending} MPa`,
      'Shear stress': `${material.horizontal_shear} MPa`,
      'Modulus of elasticity (E)': `${material.average_modulus} MPa`,
    },
    'IS 883 Table 1'
  ));
  
  // Step 3: Modification factors
  const mods = getModificationFactors(load_duration, moisture_condition, temperature, depth);
  steps.push(mods.step);
  
  // Step 4: Modified permissible stresses
  const permissible_bending = material.bending * mods.combined;
  const permissible_shear = material.horizontal_shear * mods.K1 * mods.K2 * mods.K3;
  
  steps.push(createCalculationStep(
    'Modified Permissible Stresses',
    'Apply modification factors to basic stresses',
    `f_{b,mod} = f_b \\times K = ${material.bending} \\times ${roundTo(mods.combined, 3)} = ${roundTo(permissible_bending, 2)} \\text{ MPa}`,
    {
      'Basic bending stress': `${material.bending} MPa`,
      'Modified bending stress': `${roundTo(permissible_bending, 2)} MPa`,
      'Modified shear stress': `${roundTo(permissible_shear, 2)} MPa`,
    },
    'IS 883 Cl. 6'
  ));
  
  // Step 5: Load effects (for simple beam with UDL)
  const { M_max, V_max, delta_max } = calculateSimpleBeamActions(
    span, distributed_load, material.average_modulus, section.Ixx
  );
  
  steps.push(createCalculationStep(
    'Load Effects',
    `Simply supported beam with UDL = ${distributed_load} kN/m`,
    `M_{max} = \\frac{wL^2}{8} = ${roundTo(M_max, 2)} \\text{ kN·m}`,
    {
      'Span (L)': `${span} mm`,
      'UDL (w)': `${distributed_load} kN/m`,
      'Maximum moment': `${M_max} kN·m`,
      'Maximum shear': `${V_max} kN`,
      'Maximum deflection': `${delta_max} mm`,
    },
    'IS 883'
  ));
  
  // Step 6: Actual stresses
  const actual_bending = (M_max * 1e6) / section.Zxx; // MPa
  const actual_shear = (1.5 * V_max * 1000) / section.area; // MPa (rectangular section)
  
  const bending_utilization = actual_bending / permissible_bending;
  const shear_utilization = actual_shear / permissible_shear;
  
  steps.push(createCalculationStep(
    'Stress Check',
    'Compare actual stresses with permissible values',
    `\\sigma_b = \\frac{M}{Z} = \\frac{${M_max} \\times 10^6}{${section.Zxx}} = ${roundTo(actual_bending, 2)} \\text{ MPa}`,
    {
      'Actual bending stress': `${roundTo(actual_bending, 2)} MPa`,
      'Permissible bending': `${roundTo(permissible_bending, 2)} MPa`,
      'Bending utilization': `${roundTo(bending_utilization * 100, 1)}%`,
      'Actual shear stress': `${roundTo(actual_shear, 2)} MPa`,
      'Permissible shear': `${roundTo(permissible_shear, 2)} MPa`,
      'Shear utilization': `${roundTo(shear_utilization * 100, 1)}%`,
    },
    'IS 883 Cl. 6.2'
  ));
  
  // Step 7: Deflection check
  const limit_ratio = support_type === 'cantilever' 
    ? IS883_DEFLECTION_LIMITS.cantilevers 
    : IS883_DEFLECTION_LIMITS.floor_beams;
  const allowable_deflection = deflection_limit || (span / limit_ratio);
  const deflection_utilization = delta_max / allowable_deflection;
  
  steps.push(createCalculationStep(
    'Deflection Check',
    `Per IS 883 Clause 7.3: Deflection limit = L/${limit_ratio}`,
    `\\delta_{allow} = \\frac{L}{${limit_ratio}} = \\frac{${span}}{${limit_ratio}} = ${roundTo(allowable_deflection, 2)} \\text{ mm}`,
    {
      'Span': `${span} mm`,
      'Deflection limit': `L/${limit_ratio}`,
      'Allowable deflection': `${roundTo(allowable_deflection, 2)} mm`,
      'Actual deflection': `${delta_max} mm`,
      'Deflection utilization': `${roundTo(deflection_utilization * 100, 1)}%`,
      'Status': deflection_utilization <= 1.0 ? 'OK ✓' : 'EXCEEDS ✗',
    },
    'IS 883 Cl. 7.3'
  ));
  
  // Determine adequacy
  const isAdequate = bending_utilization <= 1.0 && shear_utilization <= 1.0 && deflection_utilization <= 1.0;
  
  let status: string;
  if (isAdequate) {
    status = 'Beam is adequate for all checks';
  } else if (bending_utilization > 1.0) {
    status = 'FAIL: Bending stress exceeds permissible';
  } else if (shear_utilization > 1.0) {
    status = 'FAIL: Shear stress exceeds permissible';
  } else {
    status = 'FAIL: Deflection exceeds allowable limit';
  }
  
  return {
    isAdequate,
    status,
    section_modulus: section.Zxx,
    moment_of_inertia: section.Ixx,
    max_moment: M_max,
    max_shear: V_max,
    max_deflection: delta_max,
    permissible_bending: roundTo(permissible_bending, 2),
    permissible_shear: roundTo(permissible_shear, 2),
    allowable_deflection: roundTo(allowable_deflection, 2),
    actual_bending: roundTo(actual_bending, 2),
    actual_shear: roundTo(actual_shear, 2),
    bending_utilization: roundTo(bending_utilization, 3),
    shear_utilization: roundTo(shear_utilization, 3),
    deflection_utilization: roundTo(deflection_utilization, 3),
    steps,
  };
}

/**
 * Design timber column per IS 883:1994
 */
export function designTimberColumnIS883(input: TimberColumnInput): TimberColumnResult {
  const steps: CalculationStep[] = [];
  const {
    width, depth, length,
    axial_load, moment_x, moment_y,
    grade,
    end_condition_x, end_condition_y,
    load_duration, moisture_condition
  } = input;
  
  // Step 1: Section properties
  const section = calculateTimberSectionProperties(width, depth);
  steps.push(createCalculationStep(
    'Section Properties',
    `Rectangular column ${width} × ${depth} mm`,
    `A = b \\times d = ${width} \\times ${depth} = ${section.area} \\text{ mm}^2`,
    {
      'Width (b)': `${width} mm`,
      'Depth (d)': `${depth} mm`,
      'Area': `${section.area} mm²`,
      'rxx': `${section.rxx} mm`,
      'ryy': `${section.ryy} mm`,
    },
    'IS 883'
  ));
  
  // Step 2: Effective lengths
  const kx = IS883_EFFECTIVE_LENGTH_FACTORS[end_condition_x];
  const ky = IS883_EFFECTIVE_LENGTH_FACTORS[end_condition_y];
  const Le_x = kx * length;
  const Le_y = ky * length;
  
  steps.push(createCalculationStep(
    'Effective Length',
    'Per IS 883 Table 7: Based on end conditions',
    `L_{e,x} = k_x \\times L = ${kx} \\times ${length} = ${Le_x} \\text{ mm}`,
    {
      'Actual length (L)': `${length} mm`,
      'End condition X': end_condition_x,
      'Effective length factor kx': kx,
      'Effective length Lx': `${Le_x} mm`,
      'End condition Y': end_condition_y,
      'Effective length factor ky': ky,
      'Effective length Ly': `${Le_y} mm`,
    },
    'IS 883 Table 7'
  ));
  
  // Step 3: Slenderness ratio
  const slenderness_x = Le_x / section.rxx;
  const slenderness_y = Le_y / section.ryy;
  const governing_slenderness = Math.max(slenderness_x, slenderness_y);
  
  const slenderness_limit = 180; // Short column limit
  
  steps.push(createCalculationStep(
    'Slenderness Ratio',
    'Determine governing slenderness',
    `\\lambda = \\frac{L_e}{r}`,
    {
      'λx = Le_x/rxx': roundTo(slenderness_x, 2),
      'λy = Le_y/ryy': roundTo(slenderness_y, 2),
      'Governing λ': roundTo(governing_slenderness, 2),
      'Maximum allowed': slenderness_limit,
      'Status': governing_slenderness <= slenderness_limit ? 'OK ✓' : 'EXCEEDS ✗',
    },
    'IS 883 Cl. 6.3'
  ));
  
  // Step 4: Material properties
  const material = IS883_PERMISSIBLE_STRESSES[grade];
  const { K1, K2, K3 } = getModificationFactors(load_duration, moisture_condition, 'normal');
  
  // Step 5: Euler buckling stress
  const euler_stress = (Math.PI * Math.PI * material.minimum_modulus) / 
                       (governing_slenderness * governing_slenderness);
  
  steps.push(createCalculationStep(
    'Euler Buckling Stress',
    'Per IS 883 Clause 6.3',
    `\\sigma_e = \\frac{\\pi^2 E_{min}}{\\lambda^2} = \\frac{\\pi^2 \\times ${material.minimum_modulus}}{${roundTo(governing_slenderness, 2)}^2} = ${roundTo(euler_stress, 2)} \\text{ MPa}`,
    {
      'Minimum modulus (Emin)': `${material.minimum_modulus} MPa`,
      'Governing slenderness (λ)': roundTo(governing_slenderness, 2),
      'Euler stress (σe)': `${roundTo(euler_stress, 2)} MPa`,
    },
    'IS 883 Cl. 6.3'
  ));
  
  // Step 6: Permissible compression stress (with buckling)
  const fc_basic = material.compression_parallel * K1 * K2 * K3;
  
  // Using Perry-Robertson formula (simplified)
  // For short columns (λ ≤ 11): No reduction
  // For intermediate: Use interaction formula
  let permissible_compression: number;
  let buckling_factor: number;
  
  if (governing_slenderness <= 11) {
    // Short column
    permissible_compression = fc_basic;
    buckling_factor = 1.0;
  } else {
    // Use Euler-based reduction
    // fc = fc_basic × (1 - fc_basic/(2×σe))
    buckling_factor = 1 / (1 + Math.pow(fc_basic / euler_stress, 2));
    permissible_compression = fc_basic * Math.sqrt(buckling_factor);
  }
  
  steps.push(createCalculationStep(
    'Permissible Compression',
    'Including buckling reduction per IS 883',
    `f_{c,perm} = f_c \\times k_{buckling} = ${roundTo(fc_basic, 2)} \\times ${roundTo(buckling_factor, 3)} = ${roundTo(permissible_compression, 2)} \\text{ MPa}`,
    {
      'Basic compression (fc)': `${material.compression_parallel} MPa`,
      'Modified compression': `${roundTo(fc_basic, 2)} MPa`,
      'Buckling factor': roundTo(buckling_factor, 3),
      'Permissible compression': `${roundTo(permissible_compression, 2)} MPa`,
    },
    'IS 883 Cl. 6.3'
  ));
  
  // Step 7: Actual stress and utilization
  const actual_compression = (axial_load * 1000) / section.area;
  let combined_ratio = actual_compression / permissible_compression;
  
  // Add bending interaction if moments present
  if (moment_x || moment_y) {
    const fb_perm = material.bending * K1 * K2 * K3;
    const stress_mx = moment_x ? (moment_x * 1e6) / section.Zxx : 0;
    const stress_my = moment_y ? (moment_y * 1e6) / section.Zyy : 0;
    
    // Combined stress ratio (linear interaction)
    combined_ratio = (actual_compression / permissible_compression) +
                     (stress_mx / fb_perm) + (stress_my / fb_perm);
    
    steps.push(createCalculationStep(
      'Combined Stress Check',
      'Axial + bending interaction per IS 883',
      `\\frac{\\sigma_c}{f_{c,perm}} + \\frac{\\sigma_{bx}}{f_{b,perm}} + \\frac{\\sigma_{by}}{f_{b,perm}} \\leq 1.0`,
      {
        'Axial ratio': roundTo(actual_compression / permissible_compression, 3),
        'Bending X ratio': roundTo(stress_mx / fb_perm, 3),
        'Bending Y ratio': roundTo(stress_my / fb_perm, 3),
        'Combined ratio': roundTo(combined_ratio, 3),
        'Status': combined_ratio <= 1.0 ? 'OK ✓' : 'EXCEEDS ✗',
      },
      'IS 883 Cl. 6.3.4'
    ));
  }
  
  const capacity = permissible_compression * section.area / 1000; // kN
  const utilization = axial_load / capacity;
  
  steps.push(createCalculationStep(
    'Capacity Check',
    'Compare applied load with permissible capacity',
    `P_{perm} = f_{c,perm} \\times A = ${roundTo(permissible_compression, 2)} \\times ${section.area} / 1000 = ${roundTo(capacity, 1)} \\text{ kN}`,
    {
      'Applied load (P)': `${axial_load} kN`,
      'Permissible capacity': `${roundTo(capacity, 1)} kN`,
      'Actual stress': `${roundTo(actual_compression, 2)} MPa`,
      'Utilization': `${roundTo(utilization * 100, 1)}%`,
    },
    'IS 883'
  ));
  
  const isAdequate = utilization <= 1.0 && combined_ratio <= 1.0 && governing_slenderness <= slenderness_limit;
  
  return {
    isAdequate,
    status: isAdequate ? 'Column is adequate' : 'Column is inadequate',
    area: section.area,
    slenderness_x: roundTo(slenderness_x, 2),
    slenderness_y: roundTo(slenderness_y, 2),
    governing_slenderness: roundTo(governing_slenderness, 2),
    euler_stress: roundTo(euler_stress, 2),
    buckling_factor: roundTo(buckling_factor, 3),
    permissible_compression: roundTo(permissible_compression, 2),
    actual_compression: roundTo(actual_compression, 2),
    combined_stress_ratio: roundTo(combined_ratio, 3),
    capacity: roundTo(capacity, 1),
    utilization: roundTo(utilization, 3),
    steps,
  };
}

/**
 * Design nailed connection per IS 883:1994
 */
export function designNailedConnectionIS883(input: NailedConnectionInput): NailedConnectionResult {
  const steps: CalculationStep[] = [];
  const {
    nail_diameter, nail_length, nail_type,
    load_per_nail, load_direction,
    number_of_nails, spacing, edge_distance, end_distance,
    timber_grade, moisture_condition
  } = input;
  
  // Basic permissible load per nail (lateral)
  // Simplified formula from IS 883 Table 8
  let basic_load: number;
  
  if (load_direction === 'lateral') {
    // Lateral load capacity (kN) - simplified
    // Based on nail diameter and penetration
    const penetration = nail_length * 0.6; // Assuming 60% penetration
    basic_load = 0.045 * nail_diameter * penetration / 1000; // kN
    
    if (nail_type === 'cut') {
      basic_load *= 1.25; // Cut nails have higher capacity
    }
  } else {
    // Withdrawal resistance (much lower)
    const penetration = nail_length * 0.6;
    basic_load = 0.005 * nail_diameter * penetration / 1000; // kN
  }
  
  // Apply moisture factor
  const K2 = IS883_MODIFICATION_FACTORS.wet_service[moisture_condition];
  const permissible_load = basic_load * K2;
  
  steps.push(createCalculationStep(
    'Permissible Load per Nail',
    `Per IS 883 Table 8: ${load_direction} loading`,
    `P_{perm} = P_{basic} \\times K_2 = ${roundTo(basic_load * 1000, 0)} \\times ${K2} = ${roundTo(permissible_load * 1000, 0)} \\text{ N}`,
    {
      'Nail diameter': `${nail_diameter} mm`,
      'Nail length': `${nail_length} mm`,
      'Nail type': nail_type,
      'Load direction': load_direction,
      'Basic load': `${roundTo(basic_load, 3)} kN`,
      'Moisture factor (K2)': K2,
      'Permissible load per nail': `${roundTo(permissible_load, 3)} kN`,
    },
    'IS 883 Table 8'
  ));
  
  // Connection capacity
  const total_capacity = permissible_load * number_of_nails;
  const required_capacity = load_per_nail * number_of_nails;
  const utilization = required_capacity / total_capacity;
  
  // Spacing checks
  const min_spacing = 10 * nail_diameter;
  const min_edge = 5 * nail_diameter;
  const min_end = 10 * nail_diameter;
  
  const spacing_ok = spacing >= min_spacing;
  const edge_ok = edge_distance >= min_edge;
  const end_ok = end_distance >= min_end;
  
  steps.push(createCalculationStep(
    'Spacing Requirements',
    'Per IS 883 Clause 9: Minimum spacing requirements',
    `s_{min} = 10d = 10 \\times ${nail_diameter} = ${min_spacing} \\text{ mm}`,
    {
      'Provided spacing': `${spacing} mm`,
      'Required spacing': `${min_spacing} mm`,
      'Spacing check': spacing_ok ? 'OK ✓' : 'INADEQUATE ✗',
      'Provided edge distance': `${edge_distance} mm`,
      'Required edge distance': `${min_edge} mm`,
      'Edge check': edge_ok ? 'OK ✓' : 'INADEQUATE ✗',
      'Provided end distance': `${end_distance} mm`,
      'Required end distance': `${min_end} mm`,
      'End check': end_ok ? 'OK ✓' : 'INADEQUATE ✗',
    },
    'IS 883 Cl. 9'
  ));
  
  const isAdequate = utilization <= 1.0 && spacing_ok && edge_ok && end_ok;
  
  return {
    isAdequate,
    permissible_load_per_nail: roundTo(permissible_load, 3),
    total_connection_capacity: roundTo(total_capacity, 2),
    required_capacity: roundTo(required_capacity, 2),
    utilization: roundTo(utilization, 3),
    spacing_check: spacing_ok ? 'ADEQUATE' : 'INADEQUATE',
    edge_distance_check: edge_ok ? 'ADEQUATE' : 'INADEQUATE',
    steps,
  };
}

// ============================================================================
// QUICK REFERENCE
// ============================================================================

export const IS883_QUICK_REFERENCE = {
  grades: ['Grade_I', 'Grade_II', 'Select_A', 'Select_B'],
  slenderness_limit: 180,
  deflection_limits: {
    floor: 'L/240',
    roof: 'L/180 to L/300',
    cantilever: 'L/120',
  },
  minimum_nail_penetration: '8d',
  minimum_nail_spacing: '10d',
  minimum_edge_distance: '5d',
  minimum_end_distance: '10d',
  species_groups: ['A (High strength)', 'B (Medium strength)', 'C (Low strength)'],
};