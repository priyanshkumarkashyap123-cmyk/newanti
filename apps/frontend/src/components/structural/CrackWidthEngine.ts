/**
 * ============================================================================
 * CRACK WIDTH CALCULATION ENGINE
 * ============================================================================
 * 
 * Serviceability crack width calculation per IS 456:2000 and EC2
 * Ensures durability and aesthetic requirements
 * 
 * @version 1.0.0
 */

import { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface CrackWidthInput {
  // Geometry
  width: number;           // mm
  depth: number;           // mm
  effectiveDepth: number;  // mm
  clearCover: number;      // mm
  
  // Reinforcement
  barDiameter: number;     // mm
  barSpacing: number;      // mm
  steelArea: number;       // mm²
  
  // Materials
  fck: number;             // MPa
  fy: number;              // MPa
  Es: number;              // MPa - steel modulus (default 200000)
  
  // Loading (Service Load)
  serviceMoment: number;   // kN·m
  
  // Options
  exposureCondition: 'mild' | 'moderate' | 'severe' | 'very_severe' | 'extreme';
  designCode: 'IS456' | 'EC2';
  memberType: 'beam' | 'slab' | 'wall';
}

export interface CrackWidthResult extends CalculationResult {
  crackWidth: {
    calculated: number;    // mm
    allowable: number;     // mm
  };
  stresses: {
    fs: number;           // MPa - steel stress
    fc: number;           // MPa - concrete stress
    neutralAxis: number;  // mm
  };
}

// ============================================================================
// CRACK WIDTH CALCULATOR
// ============================================================================

export class CrackWidthEngine {
  
  /**
   * Calculate crack width per design code
   */
  calculate(input: CrackWidthInput): CrackWidthResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    const { width, depth, effectiveDepth, clearCover, barDiameter, barSpacing, steelArea, fck, fy, Es, serviceMoment, exposureCondition, designCode } = input;
    
    const b = width;
    const d = effectiveDepth;
    const D = depth;
    const Ast = steelArea;
    const phi = barDiameter;
    const c = clearCover;
    
    // ----- STEP 1: Determine Allowable Crack Width -----
    let w_max: number;
    
    if (designCode === 'IS456') {
      // IS 456 Annex F
      switch (exposureCondition) {
        case 'mild':
          w_max = 0.3;
          break;
        case 'moderate':
          w_max = 0.3;
          break;
        case 'severe':
          w_max = 0.2;
          break;
        case 'very_severe':
        case 'extreme':
          w_max = 0.1;
          break;
        default:
          w_max = 0.3;
      }
    } else {
      // EC2 Table 7.1N
      switch (exposureCondition) {
        case 'mild':
          w_max = 0.4;
          break;
        case 'moderate':
          w_max = 0.3;
          break;
        case 'severe':
        case 'very_severe':
        case 'extreme':
          w_max = 0.2;
          break;
        default:
          w_max = 0.3;
      }
    }
    
    steps.push({
      title: 'Step 1: Allowable Crack Width',
      description: `Maximum crack width for ${exposureCondition} exposure`,
      formula: `w_max per ${designCode === 'IS456' ? 'IS 456 Annex F' : 'EC2 Table 7.1N'}`,
      values: {
        'Exposure Condition': exposureCondition,
        'Allowable Crack Width': `${w_max.toFixed(2)} mm`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 35.3.2' : 'EN 1992-1-1 Cl. 7.3.1',
    });
    
    // ----- STEP 2: Cracked Section Analysis -----
    // Modular ratio
    const Ec = 5000 * Math.sqrt(fck); // Short-term modulus
    const m = Es / Ec;
    
    // Neutral axis depth (cracked section)
    // b*x²/2 = m*Ast*(d-x)
    // x² + (2m*Ast/b)*x - (2m*Ast*d/b) = 0
    const term = 2 * m * Ast / b;
    const x = (-term + Math.sqrt(term * term + 4 * term * d)) / 2;
    
    // Lever arm
    const z = d - x / 3;
    
    // Moment of inertia of cracked section
    const Icr = b * Math.pow(x, 3) / 3 + m * Ast * Math.pow(d - x, 2);
    
    steps.push({
      title: 'Step 2: Cracked Section Properties',
      description: 'Analyze transformed cracked section',
      formula: 'x from: b×x²/2 = m×Ast×(d-x)',
      values: {
        'Modular Ratio (m)': m.toFixed(2),
        'Neutral Axis Depth (x)': `${x.toFixed(1)} mm`,
        'Lever Arm (z)': `${z.toFixed(1)} mm`,
        'Cracked I (I_cr)': `${(Icr / 1e6).toFixed(2)} × 10⁶ mm⁴`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Annex F' : 'EN 1992-1-1 Cl. 7.3.2',
    });
    
    // ----- STEP 3: Calculate Stresses -----
    const M = serviceMoment * 1e6; // N·mm
    
    // Steel stress
    const fs = m * M * (d - x) / Icr;
    
    // Concrete stress at extreme fiber
    const fc_max = M * x / Icr;
    
    // Check allowable stresses
    const fs_allow = 0.6 * fy; // Simplified service stress limit
    const fc_allow = 0.45 * fck;
    
    steps.push({
      title: 'Step 3: Service Stresses',
      description: 'Calculate stresses under service moment',
      formula: 'f_s = m × M × (d - x) / I_cr',
      values: {
        'Service Moment': `${serviceMoment.toFixed(2)} kN·m`,
        'Steel Stress (f_s)': `${fs.toFixed(1)} MPa`,
        'Concrete Stress (f_c)': `${fc_max.toFixed(2)} MPa`,
        'Allowable Steel': `${fs_allow.toFixed(0)} MPa`,
        'Allowable Concrete': `${fc_allow.toFixed(1)} MPa`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 43' : 'EN 1992-1-1 Cl. 7.2',
    });
    
    if (fs > fs_allow) {
      warnings.push(`Steel stress (${fs.toFixed(0)} MPa) exceeds allowable (${fs_allow.toFixed(0)} MPa)`);
    }
    
    // ----- STEP 4: Calculate Crack Width -----
    let w_calc: number;
    
    if (designCode === 'IS456') {
      // IS 456 Annex F formula
      // a_cr = distance from point considered to surface of nearest bar
      // h = total depth
      // x = neutral axis depth (from step 2)
      
      // Distance from tension face to center of reinforcement
      const d1 = D - d; // distance to centroid of tension steel
      
      // Strain at tension face
      const epsilon_m = fs / Es;
      
      // Distance from nearest bar surface (corner or face)
      // For beam with bars at bottom: acr = √((s/2)² + d1²) - φ/2
      const acr = Math.sqrt(Math.pow(barSpacing / 2, 2) + Math.pow(d1, 2)) - phi / 2;
      
      // Crack width formula (IS 456 Annex F.1)
      const epsilon_1 = epsilon_m; // Simplified (ignoring concrete contribution)
      const cmin = c;
      
      // w = 3 × acr × εm / (1 + 2(acr - cmin)/(h - x))
      w_calc = 3 * acr * epsilon_1 / (1 + 2 * (acr - cmin) / (D - x));
      
      steps.push({
        title: 'Step 4: Crack Width Calculation (IS 456)',
        description: 'Calculate surface crack width per Annex F',
        formula: 'w = 3 × a_cr × ε_m / [1 + 2(a_cr - c_min)/(h - x)]',
        values: {
          'Steel Strain (ε_m)': epsilon_m.toExponential(4),
          'Distance to Bar (a_cr)': `${acr.toFixed(1)} mm`,
          'Crack Width (w)': `${w_calc.toFixed(3)} mm`,
        },
        reference: 'IS 456:2000 Annex F, Cl. F-1',
      });
      
    } else {
      // EC2 Cl. 7.3.4
      // w_k = s_r,max × (ε_sm - ε_cm)
      
      // Effective tension area
      const hc_eff = Math.min(2.5 * (D - d), (D - x) / 3, D / 2);
      const Ac_eff = b * hc_eff;
      const rho_p_eff = Ast / Ac_eff;
      
      // Mean strain difference (simplified)
      const kt = 0.4; // Long-term loading
      const fct_eff = 0.3 * Math.pow(fck, 2/3); // Mean tensile strength
      
      const epsilon_sm_cm = Math.max(
        (fs - kt * fct_eff * (1 + m * rho_p_eff) / rho_p_eff) / Es,
        0.6 * fs / Es
      );
      
      // Maximum crack spacing
      const k1 = 0.8; // High bond bars
      const k2 = 0.5; // Bending
      const k3 = 3.4;
      const k4 = 0.425;
      
      const sr_max = k3 * c + k1 * k2 * k4 * phi / rho_p_eff;
      
      w_calc = sr_max * epsilon_sm_cm;
      
      steps.push({
        title: 'Step 4: Crack Width Calculation (EC2)',
        description: 'Calculate characteristic crack width per Cl. 7.3.4',
        formula: 'w_k = s_r,max × (ε_sm - ε_cm)',
        values: {
          'Effective Tension Area': `${Ac_eff.toFixed(0)} mm²`,
          'ρ_p,eff': rho_p_eff.toFixed(4),
          'Max Crack Spacing (s_r,max)': `${sr_max.toFixed(0)} mm`,
          'Mean Strain Difference': epsilon_sm_cm.toExponential(4),
          'Crack Width (w_k)': `${w_calc.toFixed(3)} mm`,
        },
        reference: 'EN 1992-1-1 Cl. 7.3.4',
      });
    }
    
    // ----- STEP 5: Adequacy Check -----
    const isPassing = w_calc <= w_max;
    const utilization = w_calc / w_max;
    
    steps.push({
      title: 'Step 5: Crack Width Adequacy',
      description: 'Compare calculated with allowable crack width',
      formula: 'w_calc ≤ w_max',
      values: {
        'Calculated Width': `${w_calc.toFixed(3)} mm`,
        'Allowable Width': `${w_max.toFixed(2)} mm`,
        'Utilization': `${(utilization * 100).toFixed(1)}%`,
        'Status': isPassing ? 'SATISFACTORY' : 'EXCESSIVE',
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 35.3.2' : 'EN 1992-1-1 Cl. 7.3.1',
    });
    
    codeChecks.push({
      clause: designCode === 'IS456' ? 'IS 456 Cl. 35.3.2' : 'EC2 Cl. 7.3.1',
      description: 'Crack width limit',
      required: `≤ ${w_max.toFixed(2)} mm`,
      provided: `${w_calc.toFixed(3)} mm`,
      status: isPassing ? 'PASS' : 'FAIL',
    });
    
    if (!isPassing) {
      warnings.push('To reduce crack width: (1) Reduce bar spacing, (2) Use smaller diameter bars, (3) Increase steel area, (4) Reduce service stress');
    }
    
    return {
      isAdequate: isPassing,
      utilization,
      capacity: w_max,
      demand: w_calc,
      status: isPassing ? 'OK' : 'FAIL',
      message: isPassing 
        ? `Crack width satisfactory: ${w_calc.toFixed(3)} mm ≤ ${w_max} mm`
        : `Crack width excessive: ${w_calc.toFixed(3)} mm > ${w_max} mm. Review reinforcement detailing.`,
      steps,
      codeChecks,
      warnings,
      crackWidth: {
        calculated: w_calc,
        allowable: w_max,
      },
      stresses: {
        fs,
        fc: fc_max,
        neutralAxis: x,
      },
    };
  }
}

export const crackWidthEngine = new CrackWidthEngine();
