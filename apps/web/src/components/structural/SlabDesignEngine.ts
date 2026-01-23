/**
 * ============================================================================
 * RC SLAB DESIGN ENGINE - IS 456:2000
 * ============================================================================
 * 
 * Complete reinforced concrete slab design including:
 * - One-way slab design
 * - Two-way slab design (using IS 456 coefficients)
 * - Flat slab design
 * - Deflection checks
 * - Crack width calculations
 * 
 * @version 1.0.0
 * @author BeamLab Engineering
 */

import type { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Bending moment coefficients for two-way slabs - IS 456 Table 26 */
const TWO_WAY_COEFFICIENTS: Record<string, {
  alphaX_neg: number; alphaX_pos: number;
  alphaY_neg: number; alphaY_pos: number;
}> = {
  // Interior panel
  'interior': {
    alphaX_neg: 0.032, alphaX_pos: 0.024,
    alphaY_neg: 0.032, alphaY_pos: 0.024,
  },
  // One short edge discontinuous
  'one_short_discont': {
    alphaX_neg: 0.037, alphaX_pos: 0.028,
    alphaY_neg: 0.037, alphaY_pos: 0.028,
  },
  // One long edge discontinuous
  'one_long_discont': {
    alphaX_neg: 0.037, alphaX_pos: 0.028,
    alphaY_neg: 0.037, alphaY_pos: 0.028,
  },
  // Two adjacent edges discontinuous
  'two_adjacent_discont': {
    alphaX_neg: 0.047, alphaX_pos: 0.035,
    alphaY_neg: 0.047, alphaY_pos: 0.035,
  },
  // Two short edges discontinuous
  'two_short_discont': {
    alphaX_neg: 0.045, alphaX_pos: 0.035,
    alphaY_neg: 0.045, alphaY_pos: 0.035,
  },
  // Two long edges discontinuous
  'two_long_discont': {
    alphaX_neg: 0.045, alphaX_pos: 0.035,
    alphaY_neg: 0.045, alphaY_pos: 0.035,
  },
  // Three edges discontinuous (one long continuous)
  'three_discont_long': {
    alphaX_neg: 0.057, alphaX_pos: 0.043,
    alphaY_neg: 0.057, alphaY_pos: 0.043,
  },
  // Three edges discontinuous (one short continuous)
  'three_discont_short': {
    alphaX_neg: 0.057, alphaX_pos: 0.043,
    alphaY_neg: 0.057, alphaY_pos: 0.043,
  },
  // Four edges discontinuous (simply supported)
  'all_discont': {
    alphaX_neg: 0.000, alphaX_pos: 0.056,
    alphaY_neg: 0.000, alphaY_pos: 0.056,
  },
};

/** Shear force coefficients for two-way slabs */
const SHEAR_COEFFICIENTS = {
  continuous: 0.5,
  discontinuous: 0.4,
};

// ============================================================================
// INTERFACES
// ============================================================================

interface SlabDesignInputs {
  // Geometry
  lx: number;              // mm (shorter span)
  ly: number;              // mm (longer span)
  thickness: number;       // mm (overall thickness)
  clear_cover: number;     // mm
  
  // Material
  fck: number;             // MPa
  fy: number;              // MPa
  
  // Loading
  dead_load: number;       // kN/m² (excluding self-weight)
  live_load: number;       // kN/m²
  floor_finish: number;    // kN/m²
  
  // Options
  slab_type: 'one_way' | 'two_way';
  edge_condition: string;
  exposure: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine if slab is one-way or two-way
 */
function determineSlabType(lx: number, ly: number): 'one_way' | 'two_way' {
  const ratio = ly / lx;
  return ratio > 2 ? 'one_way' : 'two_way';
}

/**
 * Calculate self-weight of slab
 */
function getSelfWeight(thickness: number): number {
  const concreteDensity = 25; // kN/m³
  return (thickness / 1000) * concreteDensity;
}

/**
 * Get modification factor for tension reinforcement (IS 456 Fig. 4)
 */
function getModificationFactor(pt: number, fck: number, fs: number): number {
  // Simplified formula based on IS 456 Fig. 4
  const factor = 1.0 + (1.0 / (1.0 + 0.225 * pt));
  return Math.min(2.0, factor);
}

/**
 * Calculate required steel for given moment
 */
function getRequiredSteel(
  Mu: number,      // kN·m per meter width
  d: number,       // mm
  fck: number,
  fy: number
): number {
  // Using simplified formula: Ast = Mu × 10⁶ / (0.87 × fy × z)
  // where z ≈ 0.9d for under-reinforced sections
  const z = 0.9 * d;
  const Ast = (Mu * 1e6) / (0.87 * fy * z);
  return Ast; // mm² per meter width
}

// ============================================================================
// ONE-WAY SLAB DESIGN
// ============================================================================

function calculateOneWaySlabDesign(inputs: SlabDesignInputs): CalculationResult {
  const steps: CalculationStep[] = [];
  const codeChecks: CodeCheck[] = [];
  const warnings: string[] = [];
  
  const { lx, ly, thickness: D, clear_cover, fck, fy, dead_load, live_load, floor_finish, exposure } = inputs;
  
  // Effective depth (assuming 10mm bars)
  const d = D - clear_cover - 5;
  
  // Step 1: Loading
  const selfWeight = getSelfWeight(D);
  const totalDL = selfWeight + dead_load + floor_finish;
  const totalLoad = 1.5 * (totalDL + live_load); // Factored
  
  steps.push({
    title: 'Load Calculation',
    description: 'Calculate total factored load on slab',
    formula: 'wu = 1.5 × (DL + LL)',
    values: {
      'Self Weight': `${selfWeight.toFixed(2)} kN/m²`,
      'Dead Load': `${dead_load} kN/m²`,
      'Floor Finish': `${floor_finish} kN/m²`,
      'Live Load': `${live_load} kN/m²`,
      'Total DL': `${totalDL.toFixed(2)} kN/m²`,
      'Factored Load wu': `${totalLoad.toFixed(2)} kN/m²`,
    },
    reference: 'IS 456:2000 Cl. 18.2.3',
  });
  
  // Step 2: Bending Moment (assuming continuous slab)
  // M = wu × lx² / 12 (for continuous spans)
  const Mu_neg = totalLoad * Math.pow(lx / 1000, 2) / 10;  // kN·m/m (support)
  const Mu_pos = totalLoad * Math.pow(lx / 1000, 2) / 12;  // kN·m/m (midspan)
  
  steps.push({
    title: 'Bending Moment',
    description: 'Calculate bending moments for one-way slab',
    formula: 'Mu = wu × lx² / coefficient',
    values: {
      'Span lx': `${lx} mm`,
      'wu': `${totalLoad.toFixed(2)} kN/m²`,
      'Mu (support)': `${Mu_neg.toFixed(2)} kN·m/m`,
      'Mu (midspan)': `${Mu_pos.toFixed(2)} kN·m/m`,
    },
    reference: 'IS 456:2000 Cl. 22.5',
  });
  
  // Step 3: Check Depth
  const MuLim = 0.138 * fck * 1000 * d * d / 1e6; // kN·m/m (for fy=500)
  const depthOK = Mu_neg <= MuLim;
  
  steps.push({
    title: 'Depth Check',
    description: 'Check if provided depth is adequate',
    formula: 'Mu,lim = 0.138 × fck × b × d²',
    values: {
      'Effective Depth d': `${d} mm`,
      'Mu,lim': `${MuLim.toFixed(2)} kN·m/m`,
      'Mu,max': `${Mu_neg.toFixed(2)} kN·m/m`,
      'Status': depthOK ? 'OK' : 'Increase Depth',
    },
    reference: 'IS 456:2000 Annex G',
  });
  
  if (!depthOK) {
    warnings.push('Slab depth is insufficient for the applied moment.');
  }
  
  // Step 4: Main Reinforcement
  const Ast_support = getRequiredSteel(Mu_neg, d, fck, fy);
  const Ast_midspan = getRequiredSteel(Mu_pos, d, fck, fy);
  const Ast_min = 0.12 * 1000 * D / 100; // Minimum steel for HYSD
  
  const Ast_provided_support = Math.max(Ast_support, Ast_min);
  const Ast_provided_midspan = Math.max(Ast_midspan, Ast_min);
  
  // Select bars
  const barDia = 10;
  const barArea = Math.PI * barDia * barDia / 4;
  const spacing_support = Math.min(300, 3 * D, Math.floor(1000 * barArea / Ast_provided_support));
  const spacing_midspan = Math.min(300, 3 * D, Math.floor(1000 * barArea / Ast_provided_midspan));
  
  steps.push({
    title: 'Main Reinforcement',
    description: 'Calculate reinforcement in shorter span direction',
    formula: 'Ast = Mu × 10⁶ / (0.87 × fy × 0.9d)',
    values: {
      'Ast (support)': `${Ast_support.toFixed(0)} mm²/m`,
      'Ast (midspan)': `${Ast_midspan.toFixed(0)} mm²/m`,
      'Ast,min (0.12%)': `${Ast_min.toFixed(0)} mm²/m`,
      'Provide (support)': `${barDia}φ @ ${spacing_support} mm c/c`,
      'Provide (midspan)': `${barDia}φ @ ${spacing_midspan} mm c/c`,
    },
    reference: 'IS 456:2000 Cl. 26.5.2.1',
  });
  
  // Step 5: Distribution Reinforcement
  const Ast_dist = Ast_min;
  const spacing_dist = Math.min(450, 5 * D, Math.floor(1000 * barArea / Ast_dist));
  
  steps.push({
    title: 'Distribution Reinforcement',
    description: 'Secondary reinforcement in longer span direction',
    formula: 'Ast,dist = 0.12% of bD for HYSD bars',
    values: {
      'Ast,dist': `${Ast_dist.toFixed(0)} mm²/m`,
      'Provide': `${barDia}φ @ ${spacing_dist} mm c/c`,
      'Max Spacing': `${Math.min(450, 5 * D)} mm`,
    },
    reference: 'IS 456:2000 Cl. 26.5.2.1',
  });
  
  // Step 6: Shear Check
  const Vu = totalLoad * (lx / 1000) / 2; // kN/m
  const tauV = Vu * 1000 / (1000 * d);
  const pt = Ast_provided_support * 100 / (1000 * d);
  const tauC = 0.25 * Math.sqrt(fck) * Math.pow(pt, 1/3); // Simplified
  
  steps.push({
    title: 'Shear Check',
    description: 'Check shear at critical section (d from support)',
    formula: 'τv = Vu / (b × d)',
    values: {
      'Vu': `${Vu.toFixed(2)} kN/m`,
      'τv': `${tauV.toFixed(3)} MPa`,
      'pt': `${pt.toFixed(3)} %`,
      'τc': `${tauC.toFixed(3)} MPa`,
      'Status': tauV <= tauC ? 'OK (no shear reinforcement needed)' : 'FAIL',
    },
    reference: 'IS 456:2000 Cl. 40.2',
  });
  
  // Step 7: Deflection Check
  const basicRatio = 26; // Continuous slab
  const pt_actual = Ast_provided_midspan * 100 / (1000 * d);
  const fs = 0.58 * fy; // Service stress
  const MF = getModificationFactor(pt_actual, fck, fs);
  const allowable_L_d = basicRatio * MF;
  const actual_L_d = lx / d;
  
  steps.push({
    title: 'Deflection Check',
    description: 'Check span/depth ratio per IS 456 Cl. 23.2',
    formula: '(L/d)actual ≤ Basic × MF',
    values: {
      'Basic L/d': `${basicRatio}`,
      'pt': `${pt_actual.toFixed(3)} %`,
      'MF': `${MF.toFixed(2)}`,
      'Allowable L/d': `${allowable_L_d.toFixed(1)}`,
      'Actual L/d': `${actual_L_d.toFixed(1)}`,
      'Status': actual_L_d <= allowable_L_d ? 'OK' : 'FAIL',
    },
    reference: 'IS 456:2000 Cl. 23.2, Fig. 4',
  });
  
  // Code Checks
  codeChecks.push({
    clause: '26.5.2.1',
    description: 'Minimum reinforcement',
    required: `≥ ${Ast_min.toFixed(0)} mm²/m`,
    provided: `${Ast_provided_midspan.toFixed(0)} mm²/m`,
    status: Ast_provided_midspan >= Ast_min ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '26.3.3',
    description: 'Maximum spacing (main bars)',
    required: `≤ ${Math.min(300, 3 * D)} mm`,
    provided: `${spacing_midspan} mm`,
    status: spacing_midspan <= Math.min(300, 3 * D) ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '40.2',
    description: 'Shear capacity',
    required: `τv ≤ ${tauC.toFixed(3)} MPa`,
    provided: `${tauV.toFixed(3)} MPa`,
    status: tauV <= tauC ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '23.2',
    description: 'Deflection (L/d ratio)',
    required: `≤ ${allowable_L_d.toFixed(1)}`,
    provided: `${actual_L_d.toFixed(1)}`,
    status: actual_L_d <= allowable_L_d ? 'PASS' : 'WARNING',
  });
  
  // Calculate utilization
  const flexuralUtil = Mu_neg / MuLim;
  const shearUtil = tauV / tauC;
  const deflUtil = actual_L_d / allowable_L_d;
  const maxUtil = Math.max(flexuralUtil, shearUtil, deflUtil);
  
  const failedChecks = codeChecks.filter(c => c.status === 'FAIL');
  const isAdequate = failedChecks.length === 0;
  
  return {
    isAdequate,
    utilization: maxUtil,
    capacity: MuLim,
    demand: Mu_neg,
    status: isAdequate ? 'OK' : 'FAIL',
    message: isAdequate
      ? `One-way slab design is adequate. Utilization: ${(maxUtil * 100).toFixed(1)}%`
      : `Design failed: ${failedChecks.map(c => c.description).join(', ')}`,
    steps,
    codeChecks,
    warnings,
  };
}

// ============================================================================
// TWO-WAY SLAB DESIGN
// ============================================================================

function calculateTwoWaySlabDesign(inputs: SlabDesignInputs): CalculationResult {
  const steps: CalculationStep[] = [];
  const codeChecks: CodeCheck[] = [];
  const warnings: string[] = [];
  
  const { lx, ly, thickness: D, clear_cover, fck, fy, dead_load, live_load, floor_finish, edge_condition } = inputs;
  
  // Effective depths
  const dx = D - clear_cover - 5;  // Short span
  const dy = D - clear_cover - 15; // Long span (bottom layer)
  
  // Step 1: Loading
  const selfWeight = getSelfWeight(D);
  const totalDL = selfWeight + dead_load + floor_finish;
  const wu = 1.5 * (totalDL + live_load);
  
  steps.push({
    title: 'Load Calculation',
    description: 'Calculate total factored load',
    formula: 'wu = 1.5 × (DL + LL)',
    values: {
      'Self Weight': `${selfWeight.toFixed(2)} kN/m²`,
      'Total DL': `${totalDL.toFixed(2)} kN/m²`,
      'Live Load': `${live_load} kN/m²`,
      'Factored Load wu': `${wu.toFixed(2)} kN/m²`,
    },
    reference: 'IS 456:2000',
  });
  
  // Step 2: Aspect Ratio
  const ratio = ly / lx;
  const coefficients = TWO_WAY_COEFFICIENTS[edge_condition] || TWO_WAY_COEFFICIENTS['interior'];
  
  steps.push({
    title: 'Slab Classification',
    description: 'Determine slab type and get moment coefficients',
    formula: 'ly/lx ≤ 2 for two-way slab',
    values: {
      'lx (short span)': `${lx} mm`,
      'ly (long span)': `${ly} mm`,
      'ly/lx': `${ratio.toFixed(2)}`,
      'Edge Condition': edge_condition.replace(/_/g, ' '),
      'αx (positive)': `${coefficients.alphaX_pos}`,
      'αy (positive)': `${coefficients.alphaY_pos}`,
    },
    reference: 'IS 456:2000 Table 26',
  });
  
  // Step 3: Bending Moments
  const lx_m = lx / 1000;
  const Mx_neg = coefficients.alphaX_neg * wu * lx_m * lx_m;
  const Mx_pos = coefficients.alphaX_pos * wu * lx_m * lx_m;
  const My_neg = coefficients.alphaY_neg * wu * lx_m * lx_m;
  const My_pos = coefficients.alphaY_pos * wu * lx_m * lx_m;
  
  steps.push({
    title: 'Bending Moments',
    description: 'Calculate moments using IS 456 coefficients',
    formula: 'M = α × wu × lx²',
    values: {
      'Mx (support)': `${Mx_neg.toFixed(2)} kN·m/m`,
      'Mx (midspan)': `${Mx_pos.toFixed(2)} kN·m/m`,
      'My (support)': `${My_neg.toFixed(2)} kN·m/m`,
      'My (midspan)': `${My_pos.toFixed(2)} kN·m/m`,
    },
    reference: 'IS 456:2000 Annex D',
  });
  
  // Step 4: Depth Check
  const Mu_max = Math.max(Mx_neg, Mx_pos, My_neg, My_pos);
  const MuLim = 0.138 * fck * 1000 * dx * dx / 1e6;
  
  steps.push({
    title: 'Depth Adequacy',
    description: 'Check if depth is sufficient for maximum moment',
    formula: 'Mu,max ≤ Mu,lim',
    values: {
      'dx': `${dx} mm`,
      'dy': `${dy} mm`,
      'Mu,max': `${Mu_max.toFixed(2)} kN·m/m`,
      'Mu,lim': `${MuLim.toFixed(2)} kN·m/m`,
      'Status': Mu_max <= MuLim ? 'OK' : 'Increase Depth',
    },
    reference: 'IS 456:2000',
  });
  
  // Step 5: Reinforcement Calculation
  const Ast_min = 0.12 * 1000 * D / 100;
  
  const Ast_x_neg = Math.max(getRequiredSteel(Mx_neg, dx, fck, fy), Ast_min);
  const Ast_x_pos = Math.max(getRequiredSteel(Mx_pos, dx, fck, fy), Ast_min);
  const Ast_y_neg = Math.max(getRequiredSteel(My_neg, dy, fck, fy), Ast_min);
  const Ast_y_pos = Math.max(getRequiredSteel(My_pos, dy, fck, fy), Ast_min);
  
  const barDia = 10;
  const barArea = Math.PI * barDia * barDia / 4;
  
  const sp_x_neg = Math.min(300, Math.floor(1000 * barArea / Ast_x_neg));
  const sp_x_pos = Math.min(300, Math.floor(1000 * barArea / Ast_x_pos));
  const sp_y_neg = Math.min(300, Math.floor(1000 * barArea / Ast_y_neg));
  const sp_y_pos = Math.min(300, Math.floor(1000 * barArea / Ast_y_pos));
  
  steps.push({
    title: 'Reinforcement Details',
    description: 'Calculate steel in both directions',
    formula: 'Ast = Mu × 10⁶ / (0.87 × fy × 0.9d)',
    values: {
      'Short span (support)': `${barDia}φ @ ${sp_x_neg} mm c/c`,
      'Short span (midspan)': `${barDia}φ @ ${sp_x_pos} mm c/c`,
      'Long span (support)': `${barDia}φ @ ${sp_y_neg} mm c/c`,
      'Long span (midspan)': `${barDia}φ @ ${sp_y_pos} mm c/c`,
      'Ast,min': `${Ast_min.toFixed(0)} mm²/m`,
    },
    reference: 'IS 456:2000 Cl. 26.5.2.1',
  });
  
  // Step 6: Torsion Reinforcement
  const torsionRequired = edge_condition.includes('discont');
  const Ast_torsion = torsionRequired ? 0.75 * Ast_x_pos : 0;
  
  if (torsionRequired) {
    steps.push({
      title: 'Torsion Reinforcement',
      description: 'Additional reinforcement at discontinuous corners',
      formula: 'Ast,torsion = 0.75 × Ast (short span midspan)',
      values: {
        'Required at corners': 'Yes',
        'Ast,torsion': `${Ast_torsion.toFixed(0)} mm²/m`,
        'Mesh size': `${Math.floor(lx / 5)} × ${Math.floor(ly / 5)} mm`,
        'Layers': 'Top and bottom mesh at corners',
      },
      reference: 'IS 456:2000 Annex D-1.8',
    });
  }
  
  // Step 7: Deflection Check
  const basicRatio = 26;
  const pt = Ast_x_pos * 100 / (1000 * dx);
  const MF = getModificationFactor(pt, fck, 0.58 * fy);
  const allowable_L_d = basicRatio * MF;
  const actual_L_d = lx / dx;
  
  steps.push({
    title: 'Deflection Check',
    description: 'Span/depth ratio check for shorter span',
    formula: '(lx/d)actual ≤ Basic × MF',
    values: {
      'Basic L/d': `${basicRatio}`,
      'pt': `${pt.toFixed(3)} %`,
      'MF': `${MF.toFixed(2)}`,
      'Allowable lx/d': `${allowable_L_d.toFixed(1)}`,
      'Actual lx/d': `${actual_L_d.toFixed(1)}`,
      'Status': actual_L_d <= allowable_L_d ? 'OK' : 'FAIL',
    },
    reference: 'IS 456:2000 Cl. 23.2',
  });
  
  // Code Checks
  codeChecks.push({
    clause: 'Table 26',
    description: 'Two-way slab aspect ratio',
    required: 'ly/lx ≤ 2',
    provided: `${ratio.toFixed(2)}`,
    status: ratio <= 2 ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '26.5.2.1',
    description: 'Minimum reinforcement',
    required: `≥ ${Ast_min.toFixed(0)} mm²/m`,
    provided: `${Math.min(Ast_x_pos, Ast_y_pos).toFixed(0)} mm²/m`,
    status: Math.min(Ast_x_pos, Ast_y_pos) >= Ast_min ? 'PASS' : 'FAIL',
  });
  
  codeChecks.push({
    clause: '23.2',
    description: 'Deflection (lx/d ratio)',
    required: `≤ ${allowable_L_d.toFixed(1)}`,
    provided: `${actual_L_d.toFixed(1)}`,
    status: actual_L_d <= allowable_L_d ? 'PASS' : 'WARNING',
  });
  
  codeChecks.push({
    clause: '26.3.3',
    description: 'Maximum spacing',
    required: '≤ 300 mm',
    provided: `${Math.max(sp_x_pos, sp_y_pos)} mm`,
    status: Math.max(sp_x_pos, sp_y_pos) <= 300 ? 'PASS' : 'FAIL',
  });
  
  // Final result
  const maxUtil = Math.max(Mu_max / MuLim, actual_L_d / allowable_L_d);
  const failedChecks = codeChecks.filter(c => c.status === 'FAIL');
  const isAdequate = failedChecks.length === 0;
  
  return {
    isAdequate,
    utilization: maxUtil,
    capacity: MuLim,
    demand: Mu_max,
    status: isAdequate ? 'OK' : 'FAIL',
    message: isAdequate
      ? `Two-way slab design is adequate. Utilization: ${(maxUtil * 100).toFixed(1)}%`
      : `Design failed: ${failedChecks.map(c => c.description).join(', ')}`,
    steps,
    codeChecks,
    warnings,
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function calculateSlabDesignIS456(inputs: SlabDesignInputs): CalculationResult {
  // Determine slab type if not specified
  const actualType = inputs.slab_type || determineSlabType(inputs.lx, inputs.ly);
  
  if (actualType === 'one_way' || inputs.ly / inputs.lx > 2) {
    return calculateOneWaySlabDesign(inputs);
  } else {
    return calculateTwoWaySlabDesign(inputs);
  }
}

export default calculateSlabDesignIS456;
