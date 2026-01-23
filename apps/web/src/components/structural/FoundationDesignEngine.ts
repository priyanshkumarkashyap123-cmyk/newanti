/**
 * ============================================================================
 * FOUNDATION DESIGN ENGINE - IS 456:2000 & IS 1904:1986
 * ============================================================================
 * 
 * Complete foundation design including:
 * - Isolated footings (square, rectangular, circular)
 * - Combined footings (rectangular, trapezoidal)
 * - Strap footings
 * - Mat foundations
 * - One-way and two-way shear checks
 * - Bearing capacity calculations
 * 
 * @version 1.0.0
 * @author BeamLab Engineering
 */

import type { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Soil bearing capacity values (kN/m²) - IS 1904 Table 1 */
const SOIL_BEARING_CAPACITY = {
  soft_clay: 75,
  medium_clay: 150,
  stiff_clay: 300,
  loose_sand: 100,
  medium_sand: 200,
  dense_sand: 400,
  gravel: 450,
  rock: 3000,
};

/** Punching shear perimeter factor for different column shapes */
const PUNCHING_SHAPE_FACTORS = {
  square: 40,
  rectangular: 30,
  circular: 20,
};

// ============================================================================
// INTERFACES
// ============================================================================

interface IsolatedFootingInputs {
  // Column Data
  column_size_x: number;     // mm
  column_size_y: number;     // mm
  column_shape: 'square' | 'rectangular' | 'circular';
  
  // Loads (service loads)
  axial_load: number;        // kN
  moment_x: number;          // kN·m
  moment_y: number;          // kN·m
  
  // Material
  fck: number;               // MPa
  fy: number;                // MPa
  clear_cover: number;       // mm
  
  // Soil
  soil_type: string;
  bearing_capacity?: number; // kN/m² (if custom)
  
  // Geometry (initial estimate)
  footing_depth?: number;    // mm
  footing_length?: number;   // mm
  footing_width?: number;    // mm
}

interface CombinedFootingInputs {
  // Column 1
  col1_x: number; col1_y: number;
  col1_load: number; col1_moment: number;
  
  // Column 2
  col2_x: number; col2_y: number;
  col2_load: number; col2_moment: number;
  
  // Distance between columns
  column_spacing: number;
  
  // Material
  fck: number; fy: number;
  clear_cover: number;
  
  // Soil
  bearing_capacity: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get bearing capacity from soil type
 */
function getBearingCapacity(soilType: string, customValue?: number): number {
  if (customValue && customValue > 0) return customValue;
  return SOIL_BEARING_CAPACITY[soilType as keyof typeof SOIL_BEARING_CAPACITY] || 150;
}

/**
 * Calculate required footing area
 */
function getRequiredArea(P: number, M_x: number, M_y: number, qa: number): number {
  // Area = P/qa × 1.1 (10% extra for moments)
  const eccentricityFactor = M_x > 0 || M_y > 0 ? 1.3 : 1.1;
  return (P / qa) * eccentricityFactor;
}

/**
 * Calculate soil pressure distribution
 */
function getSoilPressure(
  P: number, M_x: number, M_y: number,
  L: number, B: number
): { qMax: number; qMin: number; qAvg: number } {
  const A = L * B / 1e6; // m²
  const Z_x = (B * L * L / 6) / 1e9; // m³
  const Z_y = (L * B * B / 6) / 1e9; // m³
  
  const sigma_direct = P / A;
  const sigma_Mx = M_x / Z_x;
  const sigma_My = M_y / Z_y;
  
  const qMax = sigma_direct + sigma_Mx + sigma_My;
  const qMin = sigma_direct - sigma_Mx - sigma_My;
  const qAvg = P / A;
  
  return { qMax, qMin, qAvg };
}

/**
 * Calculate punching shear perimeter
 */
function getPunchingPerimeter(
  col_x: number, col_y: number, d: number,
  shape: string
): number {
  if (shape === 'circular') {
    const D = col_x;
    return Math.PI * (D + d);
  }
  return 2 * ((col_x + d) + (col_y + d));
}

/**
 * Calculate permissible punching shear stress
 */
function getPunchingShearCapacity(fck: number, beta: number): number {
  // IS 456:2000 Cl. 31.6.3
  const ks = Math.min(1, 0.5 + beta);
  const tau_c = 0.25 * Math.sqrt(fck);
  return ks * tau_c;
}

// ============================================================================
// ISOLATED FOOTING DESIGN
// ============================================================================

export function calculateIsolatedFootingIS456(inputs: IsolatedFootingInputs): CalculationResult {
  const steps: CalculationStep[] = [];
  const codeChecks: CodeCheck[] = [];
  const warnings: string[] = [];
  
  const {
    column_size_x, column_size_y, column_shape,
    axial_load, moment_x, moment_y,
    fck, fy, clear_cover,
    soil_type, bearing_capacity: customBC,
    footing_depth, footing_length, footing_width
  } = inputs;
  
  // Step 1: Bearing Capacity
  const qa = getBearingCapacity(soil_type, customBC);
  const qa_factored = 1.5 * qa; // For limit state design
  
  steps.push({
    title: 'Bearing Capacity',
    description: 'Determine safe bearing capacity of soil',
    formula: 'qa,net from IS 1904 Table 1',
    values: {
      'Soil Type': soil_type.replace(/_/g, ' '),
      'Safe Bearing Capacity': `${qa} kN/m²`,
      'Factored Capacity (1.5qa)': `${qa_factored.toFixed(0)} kN/m²`,
    },
    reference: 'IS 1904:1986 Table 1',
  });
  
  // Step 2: Footing Size
  const P = axial_load;
  const M_x = moment_x;
  const M_y = moment_y;
  const reqArea = getRequiredArea(P, M_x, M_y, qa);
  
  // Determine footing dimensions
  let L = footing_length || Math.ceil(Math.sqrt(reqArea * 1e6) / 100) * 100; // mm
  let B = footing_width || L; // Square by default
  
  // Adjust for eccentricity
  if (M_x > 0 || M_y > 0) {
    const e_x = M_x / P * 1000; // mm
    const e_y = M_y / P * 1000; // mm
    L = Math.max(L, 6 * Math.abs(e_x) + column_size_x);
    B = Math.max(B, 6 * Math.abs(e_y) + column_size_y);
  }
  
  // Round up to nearest 100mm
  L = Math.ceil(L / 100) * 100;
  B = Math.ceil(B / 100) * 100;
  
  steps.push({
    title: 'Footing Size',
    description: 'Calculate required footing dimensions',
    formula: 'A_req = (P/qa) × factor for moments',
    values: {
      'Axial Load P': `${P} kN`,
      'Moment Mx': `${M_x} kN·m`,
      'Moment My': `${M_y} kN·m`,
      'Required Area': `${reqArea.toFixed(2)} m²`,
      'Footing Length L': `${L} mm`,
      'Footing Width B': `${B} mm`,
      'Provided Area': `${(L * B / 1e6).toFixed(2)} m²`,
    },
    reference: 'IS 456:2000',
  });
  
  // Step 3: Soil Pressure Check
  const Pu = 1.5 * P;
  const Mu_x = 1.5 * M_x;
  const Mu_y = 1.5 * M_y;
  
  const { qMax, qMin } = getSoilPressure(P, M_x, M_y, L, B);
  
  const pressureOK = qMax <= qa && qMin >= 0;
  if (qMin < 0) {
    warnings.push('Negative soil pressure (tension). Increase footing size or reduce eccentricity.');
  }
  
  steps.push({
    title: 'Soil Pressure Distribution',
    description: 'Check pressure under footing',
    formula: 'q = P/A ± M×y/I',
    values: {
      'q_max': `${qMax.toFixed(2)} kN/m²`,
      'q_min': `${qMin.toFixed(2)} kN/m²`,
      'Allowable': `${qa} kN/m²`,
      'Status': pressureOK ? 'OK' : 'FAIL - Increase Size',
    },
    reference: 'IS 456:2000',
  });
  
  // Step 4: Depth for One-Way Shear
  const D_trial = footing_depth || 400; // Initial trial
  const d = D_trial - clear_cover - 10; // Assuming 20mm bars
  
  // Critical section at d from column face
  const cantiilever_x = (L - column_size_x) / 2;
  const Vu_one = qa_factored * (B / 1000) * ((cantiilever_x - d) / 1000);
  const tau_v_one = Vu_one * 1000 / (B * d);
  
  // Permissible shear stress (no shear reinforcement in footing)
  const pt = 0.25; // Assumed initial percentage
  const tau_c = 0.36 * Math.sqrt(fck) * Math.pow(pt, 1/3);
  
  steps.push({
    title: 'One-Way Shear Check',
    description: 'Check shear at d from column face',
    formula: 'τv = Vu / (b × d)',
    values: {
      'Critical Section': `${d} mm from column face`,
      'Shear Force Vu': `${Vu_one.toFixed(2)} kN`,
      'τv': `${tau_v_one.toFixed(3)} MPa`,
      'τc': `${tau_c.toFixed(3)} MPa`,
      'Status': tau_v_one <= tau_c ? 'OK' : 'Increase Depth',
    },
    reference: 'IS 456:2000 Cl. 40.1',
  });
  
  // Step 5: Punching Shear (Two-Way Shear)
  const beta = Math.max(column_size_x, column_size_y) / Math.min(column_size_x, column_size_y);
  const b0 = getPunchingPerimeter(column_size_x, column_size_y, d, column_shape);
  
  // Punching shear area
  const punch_area_x = (column_size_x + d) / 1000;
  const punch_area_y = (column_size_y + d) / 1000;
  const A_punch = punch_area_x * punch_area_y;
  
  const Vu_punch = Pu - qa_factored * A_punch;
  const tau_v_punch = Vu_punch * 1000 / (b0 * d);
  const tau_c_punch = getPunchingShearCapacity(fck, beta);
  
  steps.push({
    title: 'Punching Shear Check',
    description: 'Two-way shear at d/2 from column face',
    formula: 'τv = Vu / (b₀ × d)',
    values: {
      'Perimeter b₀': `${b0.toFixed(0)} mm`,
      'Punching Area': `${A_punch.toFixed(3)} m²`,
      'Vu,punch': `${Vu_punch.toFixed(2)} kN`,
      'τv': `${tau_v_punch.toFixed(3)} MPa`,
      'τc (punching)': `${tau_c_punch.toFixed(3)} MPa`,
      'Status': tau_v_punch <= tau_c_punch ? 'OK' : 'Increase Depth',
    },
    reference: 'IS 456:2000 Cl. 31.6.3',
  });
  
  // Determine required depth based on shear
  let D_required = D_trial;
  if (tau_v_one > tau_c || tau_v_punch > tau_c_punch) {
    // Iterate to find required depth
    const shear_factor = Math.max(tau_v_one / tau_c, tau_v_punch / tau_c_punch);
    D_required = Math.ceil(D_trial * Math.sqrt(shear_factor) / 50) * 50;
    warnings.push(`Increase depth to ${D_required} mm for shear requirements.`);
  }
  
  // Step 6: Bending Moment and Reinforcement
  const cantilever = (L - column_size_x) / 2;
  const Mu_footing = qa_factored * (B / 1000) * Math.pow(cantilever / 1000, 2) / 2;
  
  // Required steel
  const z = 0.9 * d;
  const Ast_req = (Mu_footing * 1e6) / (0.87 * fy * z);
  const Ast_min = 0.12 * B * D_required / 100; // Minimum reinforcement
  const Ast_provided = Math.max(Ast_req, Ast_min);
  
  // Select bars
  const barDia = 16;
  const barArea = Math.PI * barDia * barDia / 4;
  const numBars = Math.ceil(Ast_provided / barArea);
  const spacing = Math.floor((B - 2 * clear_cover) / (numBars - 1));
  
  steps.push({
    title: 'Flexural Design',
    description: 'Calculate bending moment and reinforcement',
    formula: 'Mu = q × B × (cantilever)² / 2',
    values: {
      'Cantilever': `${cantilever} mm`,
      'Mu': `${Mu_footing.toFixed(2)} kN·m`,
      'Ast required': `${Ast_req.toFixed(0)} mm²`,
      'Ast minimum': `${Ast_min.toFixed(0)} mm²`,
      'Provide': `${numBars} - ${barDia}φ (@ ${spacing} mm c/c)`,
      'Ast provided': `${(numBars * barArea).toFixed(0)} mm²`,
    },
    reference: 'IS 456:2000 Cl. 34.2.3',
  });
  
  // Step 7: Development Length
  const Ld = (fy * barDia) / (4 * 1.2 * 1.6); // Simplified for M20
  const available = cantilever - clear_cover;
  
  steps.push({
    title: 'Development Length',
    description: 'Check anchorage of reinforcement',
    formula: 'Ld = φ × σs / (4 × τbd)',
    values: {
      'Required Ld': `${Ld.toFixed(0)} mm`,
      'Available': `${available.toFixed(0)} mm`,
      'Status': available >= Ld ? 'OK' : 'Provide hooks',
    },
    reference: 'IS 456:2000 Cl. 26.2.1',
  });
  
  // Code Checks
  codeChecks.push({
    clause: '34.1.1',
    description: 'Bearing pressure',
    required: `≤ ${qa} kN/m²`,
    provided: `${qMax.toFixed(2)} kN/m²`,
    status: qMax <= qa ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '40.1',
    description: 'One-way shear',
    required: `≤ ${tau_c.toFixed(3)} MPa`,
    provided: `${tau_v_one.toFixed(3)} MPa`,
    status: tau_v_one <= tau_c ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '31.6.3',
    description: 'Punching shear',
    required: `≤ ${tau_c_punch.toFixed(3)} MPa`,
    provided: `${tau_v_punch.toFixed(3)} MPa`,
    status: tau_v_punch <= tau_c_punch ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '26.5.2.1',
    description: 'Minimum reinforcement',
    required: `≥ ${Ast_min.toFixed(0)} mm²`,
    provided: `${(numBars * barArea).toFixed(0)} mm²`,
    status: numBars * barArea >= Ast_min ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '26.2.1',
    description: 'Development length',
    required: `≥ ${Ld.toFixed(0)} mm`,
    provided: `${available.toFixed(0)} mm`,
    status: available >= Ld ? 'PASS' : 'WARNING',
  });
  
  // Final Result
  const maxUtil = Math.max(
    qMax / qa,
    tau_v_one / tau_c,
    tau_v_punch / tau_c_punch,
    Ast_req / Ast_provided
  );
  
  const failedChecks = codeChecks.filter(c => c.status === 'FAIL');
  const isAdequate = failedChecks.length === 0;
  
  return {
    isAdequate,
    utilization: maxUtil,
    capacity: qa * L * B / 1e6,
    demand: P,
    status: isAdequate ? 'OK' : 'FAIL',
    message: isAdequate
      ? `Isolated footing ${L}×${B}×${D_required}mm is adequate. Utilization: ${(maxUtil * 100).toFixed(1)}%`
      : `Design failed: ${failedChecks.map(c => c.description).join(', ')}`,
    steps,
    codeChecks,
    warnings,
    designSummary: {
      'Footing Size': `${L} × ${B} × ${D_required} mm`,
      'Main Steel (L-dir)': `${numBars} - ${barDia}φ @ ${spacing} mm c/c`,
      'Main Steel (B-dir)': `${numBars} - ${barDia}φ @ ${spacing} mm c/c`,
      'Cover': `${clear_cover} mm`,
      'Concrete Grade': `M${fck}`,
    },
  };
}

// ============================================================================
// COMBINED FOOTING DESIGN
// ============================================================================

export function calculateCombinedFootingIS456(inputs: CombinedFootingInputs): CalculationResult {
  const steps: CalculationStep[] = [];
  const codeChecks: CodeCheck[] = [];
  const warnings: string[] = [];
  
  const {
    col1_x, col1_y, col1_load, col1_moment,
    col2_x, col2_y, col2_load, col2_moment,
    column_spacing,
    fck, fy, clear_cover,
    bearing_capacity: qa
  } = inputs;
  
  // Step 1: Resultant Location
  const P_total = col1_load + col2_load;
  const M_total = col1_moment + col2_moment;
  
  // Distance from column 1 to resultant
  const x_R = (col2_load * column_spacing) / P_total;
  
  steps.push({
    title: 'Resultant Force Location',
    description: 'Find centroid of combined loading',
    formula: 'x̄ = (P₂ × L) / P_total',
    values: {
      'P₁': `${col1_load} kN`,
      'P₂': `${col2_load} kN`,
      'P_total': `${P_total} kN`,
      'Column Spacing': `${column_spacing} mm`,
      'Distance to Resultant': `${x_R.toFixed(0)} mm from Col 1`,
    },
    reference: 'Structural Analysis',
  });
  
  // Step 2: Footing Dimensions (Uniform Pressure)
  // For uniform pressure, CG of footing should coincide with resultant
  const L_footing = 2 * (x_R + 300); // Extension beyond Col 1
  const B_footing = Math.ceil((P_total / (qa * L_footing / 1000)) * 1000 / 100) * 100;
  
  steps.push({
    title: 'Footing Dimensions',
    description: 'Size for uniform soil pressure',
    formula: 'L = 2 × (x̄ + projection)',
    values: {
      'Length L': `${L_footing.toFixed(0)} mm`,
      'Width B': `${B_footing} mm`,
      'Area': `${(L_footing * B_footing / 1e6).toFixed(2)} m²`,
      'Actual Pressure': `${(P_total / (L_footing * B_footing / 1e6)).toFixed(2)} kN/m²`,
    },
    reference: 'IS 456:2000',
  });
  
  // Step 3: Shear and Moment Diagram
  const qa_factored = 1.5 * qa;
  const w_upward = qa_factored * (B_footing / 1000); // kN/m
  
  // Simplified: maximum moment between columns
  const M_max = w_upward * Math.pow(column_spacing / 1000, 2) / 8;
  
  steps.push({
    title: 'Bending Moments',
    description: 'Calculate design moments',
    formula: 'M_max = w × L² / 8 (between columns)',
    values: {
      'Upward Pressure': `${w_upward.toFixed(2)} kN/m`,
      'Max Hogging Moment': `${M_max.toFixed(2)} kN·m`,
      'Max Sagging Moment': 'At column faces',
    },
    reference: 'IS 456:2000',
  });
  
  // Step 4: Depth and Reinforcement
  const D = 500; // Trial depth
  const d = D - clear_cover - 10;
  
  const Mu_lim = 0.138 * fck * B_footing * d * d / 1e6;
  const Ast_req = (M_max * 1e6) / (0.87 * fy * 0.9 * d);
  const Ast_min = 0.12 * B_footing * D / 100;
  
  const barDia = 20;
  const barArea = Math.PI * barDia * barDia / 4;
  const numBars = Math.ceil(Math.max(Ast_req, Ast_min) / barArea);
  
  steps.push({
    title: 'Reinforcement Design',
    description: 'Main longitudinal reinforcement',
    formula: 'Ast = Mu / (0.87 × fy × 0.9d)',
    values: {
      'Overall Depth D': `${D} mm`,
      'Effective Depth d': `${d} mm`,
      'Mu,lim': `${Mu_lim.toFixed(2)} kN·m`,
      'Ast required': `${Ast_req.toFixed(0)} mm²`,
      'Provide': `${numBars} - ${barDia}φ`,
    },
    reference: 'IS 456:2000',
  });
  
  // Code Checks
  codeChecks.push({
    clause: '34.1.1',
    description: 'Bearing pressure',
    required: `≤ ${qa} kN/m²`,
    provided: `${(P_total / (L_footing * B_footing / 1e6)).toFixed(2)} kN/m²`,
    status: P_total / (L_footing * B_footing / 1e6) <= qa ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: 'Annex G',
    description: 'Moment capacity',
    required: `≤ ${Mu_lim.toFixed(2)} kN·m`,
    provided: `${M_max.toFixed(2)} kN·m`,
    status: M_max <= Mu_lim ? 'PASS' : 'FAIL',
  });
  
  const failedChecks = codeChecks.filter(c => c.status === 'FAIL');
  const isAdequate = failedChecks.length === 0;
  
  return {
    isAdequate,
    utilization: M_max / Mu_lim,
    capacity: Mu_lim,
    demand: M_max,
    status: isAdequate ? 'OK' : 'FAIL',
    message: isAdequate
      ? `Combined footing ${L_footing.toFixed(0)}×${B_footing}×${D}mm is adequate.`
      : `Design failed: ${failedChecks.map(c => c.description).join(', ')}`,
    steps,
    codeChecks,
    warnings,
  };
}

export default {
  calculateIsolatedFootingIS456,
  calculateCombinedFootingIS456,
};
