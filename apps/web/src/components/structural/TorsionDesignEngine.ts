/**
 * ============================================================================
 * TORSION DESIGN ENGINE
 * ============================================================================
 * 
 * RC Beam Torsion Design per IS 456:2000
 * Combined bending, shear, and torsion design
 * 
 * @version 1.0.0
 */

import { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface TorsionDesignInput {
  // Geometry
  width: number;           // mm - beam width
  depth: number;           // mm - overall depth
  effectiveDepth: number;  // mm - d
  span: number;            // mm
  clearCover: number;      // mm
  
  // Materials
  fck: number;             // MPa
  fy: number;              // MPa
  
  // Loading
  factoredMoment: number;  // kN·m
  factoredShear: number;   // kN
  factoredTorsion: number; // kN·m
  
  // Options
  sectionType: 'rectangular' | 'flanged';
  flangeWidth?: number;    // mm - for T/L beams
  flangeThickness?: number; // mm
}

export interface TorsionDesignResult extends CalculationResult {
  torsionalCapacity: {
    Tu_v: number;          // Equivalent shear due to torsion
    Te: number;            // Equivalent torsion
    Me: number;            // Equivalent moment
    Ve: number;            // Equivalent shear
  };
  reinforcement: {
    longitudinal: {
      area: number;
      diameter: number;
      count: number;
    };
    transverse: {
      area: number;
      diameter: number;
      spacing: number;
      legs: number;
    };
  };
}

// ============================================================================
// TORSION DESIGN CALCULATOR
// ============================================================================

export class TorsionDesignEngine {
  
  /**
   * Design RC beam for torsion per IS 456:2000 Clause 41
   */
  calculate(input: TorsionDesignInput): TorsionDesignResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    const { width, depth, effectiveDepth, fck, fy, factoredMoment, factoredShear, factoredTorsion } = input;
    const b = width;
    const D = depth;
    const d = effectiveDepth;
    const d1 = input.clearCover + 8; // Centroid of corner bar from surface
    
    // ----- STEP 1: Check if Torsion Design Required -----
    // Minimum torsion per IS 456 Cl. 41.1
    const Tu_min = (fck ** 0.5) * b * d / (8 * 1000); // kN·m
    
    steps.push({
      title: 'Step 1: Check Torsion Significance',
      description: 'Determine if torsion design is required per IS 456 Cl. 41.1',
      formula: 'T_u,min = √fck × b × d / 8',
      values: {
        'Factored Torsion (T_u)': `${factoredTorsion.toFixed(2)} kN·m`,
        'Minimum Torsion (T_min)': `${Tu_min.toFixed(2)} kN·m`,
        'Torsion Design': factoredTorsion > Tu_min ? 'Required' : 'Not Required',
      },
      reference: 'IS 456:2000 Cl. 41.1',
    });
    
    if (factoredTorsion <= Tu_min) {
      warnings.push('Torsion is below threshold. Design for shear and flexure only.');
    }
    
    // ----- STEP 2: Equivalent Shear due to Torsion -----
    // Ve = Vu + 1.6(Tu/b)
    const Tu_v = 1.6 * factoredTorsion / (b / 1000); // kN
    const Ve = factoredShear + Tu_v;
    
    steps.push({
      title: 'Step 2: Equivalent Shear',
      description: 'Calculate equivalent shear including torsion effect',
      formula: 'V_e = V_u + 1.6 × T_u / b',
      values: {
        'Factored Shear (V_u)': `${factoredShear.toFixed(2)} kN`,
        'Torsional Shear (1.6T/b)': `${Tu_v.toFixed(2)} kN`,
        'Equivalent Shear (V_e)': `${Ve.toFixed(2)} kN`,
      },
      reference: 'IS 456:2000 Cl. 41.3.1',
    });
    
    // ----- STEP 3: Check Maximum Shear Stress -----
    const tau_ve = (Ve * 1000) / (b * d); // MPa
    const tau_max = Math.min(0.62 * Math.sqrt(fck), 4.0); // IS 456 max shear stress
    
    steps.push({
      title: 'Step 3: Maximum Shear Stress Check',
      description: 'Verify section capacity for combined shear and torsion',
      formula: 'τ_ve = V_e / (b × d) ≤ τ_max',
      values: {
        'Equivalent Shear Stress (τ_ve)': `${tau_ve.toFixed(3)} MPa`,
        'Maximum Allowable (τ_max)': `${tau_max.toFixed(2)} MPa`,
        'Status': tau_ve <= tau_max ? 'OK' : 'INCREASE SECTION',
      },
      reference: 'IS 456:2000 Cl. 40.2.3',
    });
    
    const shearStressOk = tau_ve <= tau_max;
    codeChecks.push({
      clause: 'IS 456 Cl. 40.2.3',
      description: 'Maximum shear stress',
      required: `≤ ${tau_max.toFixed(2)} MPa`,
      provided: `${tau_ve.toFixed(3)} MPa`,
      status: shearStressOk ? 'PASS' : 'FAIL',
    });
    
    if (!shearStressOk) {
      warnings.push('Section inadequate for combined shear and torsion. Increase width or depth.');
    }
    
    // ----- STEP 4: Equivalent Bending Moment -----
    // Me = Mu + Mt, where Mt = Tu × (1 + D/b) / 1.7
    const Mt = factoredTorsion * (1 + D / b) / 1.7;
    const Me = factoredMoment + Mt;
    
    steps.push({
      title: 'Step 4: Equivalent Bending Moment',
      description: 'Calculate equivalent moment including torsion',
      formula: 'M_e = M_u + M_t, where M_t = T_u × (1 + D/b) / 1.7',
      values: {
        'Factored Moment (M_u)': `${factoredMoment.toFixed(2)} kN·m`,
        'Torsional Moment (M_t)': `${Mt.toFixed(2)} kN·m`,
        'Equivalent Moment (M_e)': `${Me.toFixed(2)} kN·m`,
      },
      reference: 'IS 456:2000 Cl. 41.4.2',
    });
    
    // ----- STEP 5: Longitudinal Reinforcement -----
    // Design for Me using standard flexure formula
    const Mu_lim = 0.138 * fck * b * d * d / 1e6; // kN·m
    
    let Ast_required: number;
    if (Me <= Mu_lim) {
      // Singly reinforced
      const term = 4.6 * Me * 1e6 / (fck * b * d * d);
      if (term > 1) {
        Ast_required = 9999;
        warnings.push('Section inadequate for equivalent moment');
      } else {
        Ast_required = 0.5 * (fck / fy) * (1 - Math.sqrt(1 - term)) * b * d;
      }
    } else {
      // Doubly reinforced needed
      Ast_required = Me * 1e6 / (0.87 * fy * 0.9 * d); // Simplified
      warnings.push('Doubly reinforced section required');
    }
    
    // Additional longitudinal steel for torsion (corner bars)
    // At corners: x1 = b - 2×cover, y1 = d - 2×cover
    const x1 = b - 2 * input.clearCover;
    const y1 = D - 2 * input.clearCover;
    
    // Side face reinforcement if D > 450mm
    if (D > 450) {
      const sideArea = 0.1 * Ast_required; // 10% of tension steel
      warnings.push(`Side face reinforcement required: ${sideArea.toFixed(0)} mm² on each side`);
    }
    
    // Select bars
    const barDiameters = [12, 16, 20, 25, 32];
    let selectedBar = 16;
    let barCount = 4; // Minimum 4 corner bars for torsion
    
    for (const dia of barDiameters) {
      const areaPerBar = Math.PI * dia * dia / 4;
      const reqCount = Math.ceil(Ast_required / areaPerBar);
      if (reqCount >= 4) {
        selectedBar = dia;
        barCount = Math.max(4, reqCount);
        break;
      }
    }
    
    const Ast_provided = barCount * Math.PI * selectedBar * selectedBar / 4;
    
    steps.push({
      title: 'Step 5: Longitudinal Reinforcement',
      description: 'Design main steel for equivalent moment',
      formula: 'A_st = 0.5 × (fck/fy) × [1 - √(1 - 4.6M_e/(fck×b×d²))] × b × d',
      values: {
        'M_u,lim': `${Mu_lim.toFixed(2)} kN·m`,
        'A_st required': `${Ast_required.toFixed(0)} mm²`,
        'Bar Size': `${selectedBar} mm`,
        'Number of Bars': `${barCount}`,
        'A_st provided': `${Ast_provided.toFixed(0)} mm²`,
      },
      reference: 'IS 456:2000 Cl. 41.4.2',
    });
    
    codeChecks.push({
      clause: 'IS 456 Cl. 41.4.2',
      description: 'Longitudinal steel for torsion',
      required: `≥ ${Ast_required.toFixed(0)} mm²`,
      provided: `${Ast_provided.toFixed(0)} mm²`,
      status: Ast_provided >= Ast_required ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 6: Transverse Reinforcement (Closed Stirrups) -----
    // Asv/sv = (Tu × 1000) / (b1 × d1 × fy × 0.87) + Vu / (2.5 × d1 × fy × 0.87)
    const b1 = x1;
    
    // Shear strength of concrete
    const pt = (Ast_provided / (b * d)) * 100;
    const tau_c = 0.25 * Math.sqrt(fck); // Simplified
    const Vus = Ve - tau_c * b * d / 1000;
    
    // Combined Asv/sv for torsion + shear
    const Asv_sv_torsion = (factoredTorsion * 1e6) / (b1 * (D - 2 * d1) * 0.87 * fy);
    const Asv_sv_shear = Vus > 0 ? (Vus * 1000) / (0.87 * fy * d) : 0;
    const Asv_sv_total = Asv_sv_torsion + Asv_sv_shear;
    
    // Select stirrup
    const stirrupDia = 10;
    const legsCount = 2; // Closed stirrup
    const Asv_per_stirrup = legsCount * Math.PI * stirrupDia * stirrupDia / 4;
    const spacing = Math.min(
      Math.floor(Asv_per_stirrup / Asv_sv_total),
      x1,
      (x1 + y1) / 4,
      300
    );
    
    // Minimum spacing check
    const spacingProvided = Math.max(75, Math.min(spacing, 300));
    
    steps.push({
      title: 'Step 6: Transverse Reinforcement',
      description: 'Design closed stirrups for combined torsion and shear',
      formula: 'A_sv/s_v = T_u/(b1×d1×0.87×fy) + V_us/(2.5×d1×0.87×fy)',
      values: {
        'Torsion component': `${Asv_sv_torsion.toFixed(4)} mm²/mm`,
        'Shear component': `${Asv_sv_shear.toFixed(4)} mm²/mm`,
        'Total A_sv/s_v': `${Asv_sv_total.toFixed(4)} mm²/mm`,
        'Stirrup Diameter': `${stirrupDia} mm`,
        'Legs': `${legsCount}`,
        'Spacing': `${spacingProvided} mm c/c`,
      },
      reference: 'IS 456:2000 Cl. 41.4.3',
    });
    
    // Check stirrup spacing limits
    const maxSpacing = Math.min(x1, (x1 + y1) / 4, 300);
    codeChecks.push({
      clause: 'IS 456 Cl. 26.5.1.6',
      description: 'Stirrup spacing for torsion',
      required: `≤ ${maxSpacing.toFixed(0)} mm`,
      provided: `${spacingProvided} mm`,
      status: spacingProvided <= maxSpacing ? 'PASS' : 'FAIL',
    });
    
    // ----- DETERMINE OVERALL ADEQUACY -----
    const isAdequate = shearStressOk && Ast_provided >= Ast_required && spacingProvided <= maxSpacing;
    const utilization = Math.max(
      tau_ve / tau_max,
      Ast_required / Ast_provided,
      spacingProvided / maxSpacing
    );
    
    return {
      isAdequate,
      utilization,
      capacity: Ast_provided,
      demand: Ast_required,
      status: isAdequate ? 'OK' : 'FAIL',
      message: isAdequate 
        ? `Torsion design adequate. Provide ${barCount}-${selectedBar}mm bars with ${stirrupDia}mm closed stirrups @ ${spacingProvided}mm c/c.`
        : 'Design inadequate. Review warnings.',
      steps,
      codeChecks,
      warnings,
      torsionalCapacity: {
        Tu_v,
        Te: factoredTorsion,
        Me,
        Ve,
      },
      reinforcement: {
        longitudinal: {
          area: Ast_provided,
          diameter: selectedBar,
          count: barCount,
        },
        transverse: {
          area: Asv_per_stirrup,
          diameter: stirrupDia,
          spacing: spacingProvided,
          legs: legsCount,
        },
      },
    };
  }
}

export const torsionDesignEngine = new TorsionDesignEngine();
