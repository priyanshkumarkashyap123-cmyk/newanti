/**
 * ============================================================================
 * PUNCHING SHEAR ENGINE
 * ============================================================================
 * 
 * Flat slab punching shear check per IS 456:2000 and ACI 318
 * Checks slab-column connections under gravity and unbalanced moments
 * 
 * @version 1.0.0
 */

import { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface PunchingShearInput {
  // Slab Properties
  slabThickness: number;    // mm
  effectiveDepth: number;   // mm
  fck: number;              // MPa
  fy: number;               // MPa - not used directly but for info
  
  // Column Properties
  columnWidth: number;      // mm (c1 - in direction of moment)
  columnDepth: number;      // mm (c2 - perpendicular)
  columnType: 'interior' | 'edge' | 'corner';
  
  // Loading
  factoredShear: number;    // kN - Vu
  unbalancedMoment?: number; // kN·m - Mu (moment transfer)
  
  // Options
  hasShearReinforcement: boolean;
  hasDropPanel: boolean;
  dropPanelDepth?: number;  // mm - additional depth
  dropPanelWidth?: number;  // mm
  
  designCode: 'IS456' | 'ACI318';
}

export interface PunchingShearResult extends CalculationResult {
  criticalPerimeter: {
    bo: number;           // mm
    d_critical: number;   // mm (distance from column face)
    Ac: number;           // mm² - critical area
  };
  stresses: {
    vu: number;           // MPa - applied shear stress
    vc: number;           // MPa - concrete shear strength
    vn: number;           // MPa - nominal strength with reinforcement
  };
  momentTransfer: {
    gamma_v: number;      // fraction of moment transferred by shear
    vuv: number;          // MPa - stress due to moment transfer
  };
}

// ============================================================================
// PUNCHING SHEAR CALCULATOR
// ============================================================================

export class PunchingShearEngine {
  
  /**
   * Check punching shear at slab-column connection
   */
  calculate(input: PunchingShearInput): PunchingShearResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    const { slabThickness, effectiveDepth, fck, columnWidth, columnDepth, columnType, factoredShear, designCode } = input;
    
    const c1 = columnWidth;
    const c2 = columnDepth;
    const d = input.hasDropPanel && input.dropPanelDepth 
      ? effectiveDepth + input.dropPanelDepth 
      : effectiveDepth;
    
    // ----- STEP 1: Define Critical Section -----
    // IS 456: at d/2 from column face
    // ACI 318: at d/2 from column face
    const criticalDistance = d / 2;
    
    // Critical perimeter based on column position
    let bo: number;
    let alpha_s: number; // ACI factor
    
    if (columnType === 'interior') {
      bo = 2 * (c1 + d) + 2 * (c2 + d);
      alpha_s = 40;
    } else if (columnType === 'edge') {
      bo = (c1 + d / 2) + 2 * (c2 + d);
      alpha_s = 30;
    } else { // corner
      bo = (c1 + d / 2) + (c2 + d / 2);
      alpha_s = 20;
    }
    
    const Ac = bo * d; // Critical section area
    
    steps.push({
      title: 'Step 1: Critical Section Definition',
      description: `Critical perimeter at d/2 from column face for ${columnType} column`,
      formula: columnType === 'interior' 
        ? 'b_o = 2(c1 + d) + 2(c2 + d)'
        : columnType === 'edge'
          ? 'b_o = (c1 + d/2) + 2(c2 + d)'
          : 'b_o = (c1 + d/2) + (c2 + d/2)',
      values: {
        'Column Size': `${c1} × ${c2} mm`,
        'Effective Depth': `${d} mm`,
        'Critical Distance': `${criticalDistance} mm from face`,
        'Critical Perimeter (b_o)': `${bo.toFixed(0)} mm`,
        'Critical Area (A_c)': `${(Ac / 1e6).toFixed(4)} m²`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 31.6.2' : 'ACI 318-19 Cl. 22.6.4',
    });
    
    // ----- STEP 2: Applied Shear Stress -----
    const vu = (factoredShear * 1000) / Ac; // MPa
    
    steps.push({
      title: 'Step 2: Applied Punching Shear Stress',
      description: 'Calculate shear stress at critical section',
      formula: 'v_u = V_u / (b_o × d)',
      values: {
        'Factored Shear (V_u)': `${factoredShear.toFixed(2)} kN`,
        'Critical Area': `${Ac.toFixed(0)} mm²`,
        'Applied Stress (v_u)': `${vu.toFixed(3)} MPa`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 31.6.2' : 'ACI 318-19 Cl. 22.6.5',
    });
    
    // ----- STEP 3: Concrete Punching Shear Strength -----
    let vc: number;
    const beta_c = c1 / c2; // Aspect ratio
    
    if (designCode === 'IS456') {
      // IS 456 Cl. 31.6.3: τ_c = ks × 0.25√fck
      // where ks = 0.5 + βc but ≤ 1.0
      const ks = Math.min(0.5 + beta_c, 1.0);
      vc = ks * 0.25 * Math.sqrt(fck);
      
      steps.push({
        title: 'Step 3: Concrete Shear Strength (IS 456)',
        description: 'Calculate permissible punching shear stress',
        formula: 'τ_c = k_s × 0.25√fck, where k_s = min(0.5 + βc, 1.0)',
        values: {
          'Aspect Ratio (βc)': beta_c.toFixed(2),
          'k_s': ks.toFixed(3),
          'fck': `${fck} MPa`,
          'τ_c': `${vc.toFixed(3)} MPa`,
        },
        reference: 'IS 456:2000 Cl. 31.6.3.1',
      });
    } else {
      // ACI 318-19 Cl. 22.6.5: 
      // vc = min of (a) 0.33√f'c, (b) (0.17 + 0.33/βc)√f'c, (c) (0.17 + αs×d/bo)×(√f'c/6)
      const vc_a = 0.33 * Math.sqrt(fck);
      const vc_b = (0.17 + 0.33 / beta_c) * Math.sqrt(fck);
      const vc_c = (0.083 * (alpha_s * d / bo + 2)) * Math.sqrt(fck);
      vc = Math.min(vc_a, vc_b, vc_c);
      
      steps.push({
        title: 'Step 3: Concrete Shear Strength (ACI 318)',
        description: 'Calculate nominal punching shear strength - minimum of three criteria',
        formula: 'v_c = min[(a) 0.33√f\'c, (b) (0.17+0.33/βc)√f\'c, (c) 0.083(αs×d/bo+2)√f\'c]',
        values: {
          'Criterion (a)': `${vc_a.toFixed(3)} MPa`,
          'Criterion (b)': `${vc_b.toFixed(3)} MPa`,
          'Criterion (c)': `${vc_c.toFixed(3)} MPa`,
          'Governing v_c': `${vc.toFixed(3)} MPa`,
        },
        reference: 'ACI 318-19 Cl. 22.6.5.2',
      });
    }
    
    // ----- STEP 4: Moment Transfer (if applicable) -----
    let gamma_v = 0;
    let vuv = 0;
    
    if (input.unbalancedMoment && input.unbalancedMoment > 0) {
      // Fraction of moment transferred by shear
      gamma_v = 1 - 1 / (1 + (2/3) * Math.sqrt((c1 + d) / (c2 + d)));
      
      // Additional shear stress due to moment
      // Jc = property of critical section (polar moment for shear flow)
      // Simplified: Jc ≈ (b_o × d³)/6 + (b_o × d × c_AB²)/2
      // For interior: c_AB = (c1 + d)/2
      const c_AB = columnType === 'interior' ? (c1 + d) / 2 : c1 / 2;
      const Jc = (d * Math.pow(c1 + d, 3)) / 6 + 
                 (Math.pow(c1 + d, 2) * d * (c2 + d)) / 2 +
                 d * (c2 + d) * Math.pow(c1 + d, 2) / 2;
      
      vuv = (gamma_v * input.unbalancedMoment * 1e6 * c_AB) / Jc;
      
      steps.push({
        title: 'Step 4: Moment Transfer Effect',
        description: 'Additional shear stress from unbalanced moment',
        formula: 'γ_v = 1 - 1/[1 + (2/3)√((c1+d)/(c2+d))], v_uv = γ_v × M_u × c / J_c',
        values: {
          'Unbalanced Moment': `${input.unbalancedMoment.toFixed(2)} kN·m`,
          'γ_v': gamma_v.toFixed(3),
          'Additional Stress (v_uv)': `${vuv.toFixed(3)} MPa`,
          'Total Stress': `${(vu + vuv).toFixed(3)} MPa`,
        },
        reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 31.6.2.2' : 'ACI 318-19 Cl. 8.4.4.2',
      });
    }
    
    const totalStress = vu + vuv;
    
    // ----- STEP 5: Shear Reinforcement (if needed) -----
    let vn = vc; // Nominal strength
    
    if (input.hasShearReinforcement && totalStress > vc) {
      // With shear reinforcement (stirrups or shear studs)
      // Maximum vc with reinforcement: 0.5√fck (IS) or 0.5√f'c (ACI)
      const vc_max = 0.5 * Math.sqrt(fck);
      
      if (totalStress > vc_max) {
        warnings.push('Punching shear exceeds maximum even with reinforcement. Increase slab thickness or add drop panel.');
      }
      
      // Shear reinforcement contribution (simplified)
      const vs = totalStress - vc;
      vn = Math.min(vc + vs, vc_max);
      
      steps.push({
        title: 'Step 5: Shear Reinforcement',
        description: 'Required shear reinforcement contribution',
        formula: 'v_s = v_u - v_c, v_n ≤ v_c,max',
        values: {
          'Required v_s': `${vs.toFixed(3)} MPa`,
          'Maximum v_c': `${vc_max.toFixed(3)} MPa`,
          'Nominal Strength v_n': `${vn.toFixed(3)} MPa`,
        },
        reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 31.6.3.2' : 'ACI 318-19 Cl. 22.6.6',
      });
    }
    
    // ----- STEP 6: Final Check -----
    const phi = designCode === 'ACI318' ? 0.75 : 1.0; // Strength reduction factor
    const designStrength = phi * vn;
    
    const isPassing = totalStress <= designStrength;
    const utilization = totalStress / designStrength;
    
    steps.push({
      title: 'Step 6: Punching Shear Adequacy',
      description: 'Compare applied stress with design strength',
      formula: designCode === 'ACI318' ? 'v_u ≤ φ × v_n' : 'τ_v ≤ τ_c',
      values: {
        'Applied Stress': `${totalStress.toFixed(3)} MPa`,
        'Design Strength': `${designStrength.toFixed(3)} MPa`,
        'Utilization': `${(utilization * 100).toFixed(1)}%`,
        'Status': isPassing ? 'ADEQUATE' : 'INADEQUATE',
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 31.6' : 'ACI 318-19 Cl. 8.5.1',
    });
    
    codeChecks.push({
      clause: designCode === 'IS456' ? 'IS 456 Cl. 31.6' : 'ACI 318-19 Cl. 8.5',
      description: 'Punching shear capacity',
      required: `≤ ${designStrength.toFixed(3)} MPa`,
      provided: `${totalStress.toFixed(3)} MPa`,
      status: isPassing ? 'PASS' : 'FAIL',
    });
    
    if (!isPassing) {
      warnings.push('Consider: (1) Increase slab thickness, (2) Add drop panel, (3) Increase column size, (4) Add shear reinforcement');
    }
    
    return {
      isAdequate: isPassing,
      utilization,
      capacity: designStrength * Ac / 1000, // kN
      demand: factoredShear,
      status: isPassing ? 'OK' : 'FAIL',
      message: isPassing 
        ? `Punching shear adequate. Utilization: ${(utilization * 100).toFixed(1)}%`
        : `Punching shear inadequate. Demand/Capacity = ${utilization.toFixed(2)}`,
      steps,
      codeChecks,
      warnings,
      criticalPerimeter: {
        bo,
        d_critical: criticalDistance,
        Ac,
      },
      stresses: {
        vu: totalStress,
        vc,
        vn,
      },
      momentTransfer: {
        gamma_v,
        vuv,
      },
    };
  }
}

export const punchingShearEngine = new PunchingShearEngine();
