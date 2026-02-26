/**
 * ============================================================================
 * DEEP BEAM DESIGN ENGINE
 * ============================================================================
 * 
 * RC Deep Beam Design per IS 456:2000 and ACI 318
 * For beams with L/D ≤ 2.5 (simply supported) or L/D ≤ 2.0 (continuous)
 * Uses strut-and-tie model
 * 
 * @version 1.0.0
 */

import { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface DeepBeamDesignInput {
  // Geometry
  span: number;             // mm - clear span (L)
  depth: number;            // mm - overall depth (D)
  width: number;            // mm - beam width (b)
  clearCover: number;       // mm
  
  // Materials
  fck: number;              // MPa
  fy: number;               // MPa
  
  // Loading
  loadType: 'point' | 'udl' | 'two_point';
  factoredLoad: number;     // kN - total factored load
  loadPosition?: number;    // mm - distance from support for point load
  
  // Support
  supportType: 'simple' | 'continuous';
  supportWidth: number;     // mm - bearing width
  
  // Options
  designCode: 'IS456' | 'ACI318';
}

export interface DeepBeamDesignResult extends CalculationResult {
  classification: {
    spanDepthRatio: number;
    isDeepBeam: boolean;
  };
  reinforcement: {
    mainTension: {
      area: number;
      diameter: number;
      count: number;
      layers: number;
    };
    horizontalWeb: {
      area: number;
      diameter: number;
      spacing: number;
    };
    verticalWeb: {
      area: number;
      diameter: number;
      spacing: number;
    };
  };
  strutAndTie: {
    strutCapacity: number;
    tieForce: number;
    nodalZoneStress: number;
  };
}

// ============================================================================
// DEEP BEAM DESIGN CALCULATOR
// ============================================================================

export class DeepBeamDesignEngine {
  
  /**
   * Design deep beam using strut-and-tie model
   */
  calculate(input: DeepBeamDesignInput): DeepBeamDesignResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    const { span, depth, width, clearCover, fck, fy, loadType, factoredLoad, supportType, supportWidth, designCode } = input;
    
    const L = span;
    const D = depth;
    const b = width;
    const c = clearCover;
    const W = factoredLoad;
    
    // Effective depth
    const d = D - c - 25; // Assuming 25mm bar + cover
    
    // ----- STEP 1: Deep Beam Classification -----
    const spanDepthRatio = L / D;
    const limitRatio = supportType === 'simple' ? 2.5 : 2.0;
    const isDeepBeam = spanDepthRatio <= limitRatio;
    
    steps.push({
      title: 'Step 1: Deep Beam Classification',
      description: 'Check if beam qualifies as deep beam',
      formula: supportType === 'simple' ? 'L/D ≤ 2.5 for simply supported' : 'L/D ≤ 2.0 for continuous',
      values: {
        'Clear Span (L)': `${L} mm`,
        'Overall Depth (D)': `${D} mm`,
        'L/D Ratio': spanDepthRatio.toFixed(2),
        'Limit': limitRatio.toFixed(1),
        'Classification': isDeepBeam ? 'DEEP BEAM' : 'REGULAR BEAM (use standard design)',
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 29.1' : 'ACI 318-19 Cl. 9.9.1',
    });
    
    if (!isDeepBeam) {
      warnings.push(`L/D = ${spanDepthRatio.toFixed(2)} > ${limitRatio}. Use standard beam design procedures.`);
    }
    
    codeChecks.push({
      clause: designCode === 'IS456' ? 'IS 456 Cl. 29.1' : 'ACI 318 Cl. 9.9.1',
      description: 'Deep beam classification',
      required: `L/D ≤ ${limitRatio}`,
      provided: spanDepthRatio.toFixed(2),
      status: isDeepBeam ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 2: Lever Arm Calculation -----
    // For deep beams, lever arm is not 0.87d but depends on L/D
    let z: number;
    
    if (designCode === 'IS456') {
      // IS 456 Cl. 29.2
      // z = 0.2(L + 2D) for L/D ≤ 1
      // z = 0.6L + 0.4D for 1 < L/D ≤ 2.5
      if (spanDepthRatio <= 1) {
        z = 0.2 * (L + 2 * D);
      } else {
        z = 0.6 * L + 0.4 * D;
      }
      z = Math.min(z, 0.87 * d); // Cap at normal beam value
    } else {
      // ACI approach - STM
      z = 0.9 * d * Math.min(1, 2 / (spanDepthRatio + 1));
    }
    
    steps.push({
      title: 'Step 2: Lever Arm for Deep Beam',
      description: 'Calculate modified lever arm for deep beam action',
      formula: designCode === 'IS456' 
        ? (spanDepthRatio <= 1 ? 'z = 0.2(L + 2D)' : 'z = 0.6L + 0.4D')
        : 'z from strut-and-tie geometry',
      values: {
        'L/D Ratio': spanDepthRatio.toFixed(2),
        'Lever Arm (z)': `${z.toFixed(0)} mm`,
        'z/d Ratio': (z / d).toFixed(3),
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 29.2' : 'ACI 318-19 Cl. 23.4',
    });
    
    // ----- STEP 3: Forces from STM -----
    // Maximum moment and reaction
    let Mu: number;
    let R: number; // Reaction
    
    if (loadType === 'udl') {
      Mu = W * L / 8 / 1000; // kN·m
      R = W / 2;
    } else if (loadType === 'point') {
      const a = input.loadPosition || L / 2;
      Mu = W * a * (L - a) / L / 1000;
      R = W * (L - a) / L;
    } else { // two_point
      Mu = W * L / 6 / 1000; // Approximate
      R = W / 2;
    }
    
    // Tie force (tension in bottom steel)
    const T = Mu * 1e6 / z; // N
    
    // Strut force (compression)
    const theta = Math.atan(z / (L / 2)); // Strut angle
    const C = T / Math.cos(theta);
    
    steps.push({
      title: 'Step 3: Strut-and-Tie Forces',
      description: 'Calculate forces in strut-and-tie model',
      formula: 'T = M_u / z, C = T / cos(θ)',
      values: {
        'Factored Load': `${W.toFixed(2)} kN`,
        'Max Moment (M_u)': `${Mu.toFixed(2)} kN·m`,
        'Reaction': `${R.toFixed(2)} kN`,
        'Tie Force (T)': `${(T / 1000).toFixed(2)} kN`,
        'Strut Angle (θ)': `${(theta * 180 / Math.PI).toFixed(1)}°`,
        'Strut Force (C)': `${(C / 1000).toFixed(2)} kN`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 29' : 'ACI 318-19 Cl. 23',
    });
    
    // ----- STEP 4: Main Tension Reinforcement -----
    const Ast_required = T / (0.87 * fy);
    
    // Minimum steel for deep beams
    const Ast_min = 0.2 * b * d / 100; // 0.2% minimum
    const Ast_design = Math.max(Ast_required, Ast_min);
    
    // Select bars
    const barDiameters = [16, 20, 25, 32];
    let selectedBar = 25;
    let barCount = 4;
    let layers = 1;
    
    for (const dia of barDiameters) {
      const areaPerBar = Math.PI * dia * dia / 4;
      const reqCount = Math.ceil(Ast_design / areaPerBar);
      // Check if bars fit in width (max ~5 bars per layer)
      if (reqCount <= 10) {
        selectedBar = dia;
        barCount = reqCount;
        layers = Math.ceil(reqCount / 5);
        break;
      }
    }
    
    const Ast_provided = barCount * Math.PI * selectedBar * selectedBar / 4;
    
    steps.push({
      title: 'Step 4: Main Tension Reinforcement',
      description: 'Design bottom tension steel (tie)',
      formula: 'A_st = T / (0.87 × fy)',
      values: {
        'Tie Force': `${(T / 1000).toFixed(2)} kN`,
        'A_st Required': `${Ast_required.toFixed(0)} mm²`,
        'A_st Minimum': `${Ast_min.toFixed(0)} mm²`,
        'Bar Size': `${selectedBar} mm`,
        'Number of Bars': `${barCount} (${layers} layer${layers > 1 ? 's' : ''})`,
        'A_st Provided': `${Ast_provided.toFixed(0)} mm²`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 29.3' : 'ACI 318-19 Cl. 9.9.3',
    });
    
    codeChecks.push({
      clause: designCode === 'IS456' ? 'IS 456 Cl. 29.3' : 'ACI 318 Cl. 9.9.3',
      description: 'Main tension steel',
      required: `≥ ${Ast_design.toFixed(0)} mm²`,
      provided: `${Ast_provided.toFixed(0)} mm²`,
      status: Ast_provided >= Ast_design ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 5: Horizontal Web Reinforcement -----
    // IS 456 Cl. 29.4: 0.2% to 0.25% of web area
    const Ash_min = 0.002 * b * D; // Total horizontal web steel
    const horizontalDia = 12;
    const Ash_per_bar = 2 * Math.PI * horizontalDia * horizontalDia / 4; // 2-legged
    
    // Spacing calculation
    const numHorizBars = Math.ceil(Ash_min / Ash_per_bar);
    const horizSpacing = Math.min(
      Math.floor((D - 2 * c) / numHorizBars),
      D / 5,
      450
    );
    
    steps.push({
      title: 'Step 5: Horizontal Web Reinforcement',
      description: 'Minimum horizontal steel for crack control',
      formula: 'A_sh ≥ 0.2% × b × D, spacing ≤ min(D/5, 450mm)',
      values: {
        'A_sh Minimum': `${Ash_min.toFixed(0)} mm²`,
        'Bar Size': `${horizontalDia} mm (2-legged)`,
        'Spacing': `${horizSpacing} mm c/c`,
        'Distribution': `Throughout depth both faces`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 29.4.2' : 'ACI 318-19 Cl. 9.9.4',
    });
    
    // ----- STEP 6: Vertical Web Reinforcement -----
    // IS 456 Cl. 29.4: 0.12% minimum
    const Asv_min = 0.0012 * b * L; // Total vertical web steel
    const verticalDia = 12;
    const Asv_per_bar = 2 * Math.PI * verticalDia * verticalDia / 4;
    
    const numVertBars = Math.ceil(Asv_min / Asv_per_bar);
    const vertSpacing = Math.min(
      Math.floor(L / numVertBars),
      D / 5,
      450
    );
    
    steps.push({
      title: 'Step 6: Vertical Web Reinforcement',
      description: 'Minimum vertical steel for crack control',
      formula: 'A_sv ≥ 0.12% × b × L, spacing ≤ min(D/5, 450mm)',
      values: {
        'A_sv Minimum': `${Asv_min.toFixed(0)} mm²`,
        'Bar Size': `${verticalDia} mm (2-legged)`,
        'Spacing': `${vertSpacing} mm c/c`,
        'Distribution': `Throughout span both faces`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 29.4.3' : 'ACI 318-19 Cl. 9.9.4',
    });
    
    // ----- STEP 7: Nodal Zone Check -----
    // Check stress at support (CCC or CCT node)
    const nodalArea = supportWidth * b;
    const nodalStress = (R * 1000) / nodalArea;
    
    // Allowable nodal stress
    // CCC: 0.85 × β_n × f'c where β_n = 1.0
    // CCT: β_n = 0.8
    const beta_n = 0.8; // Conservative CCT
    const fce = 0.85 * beta_n * fck; // Effective strength
    const allowableNodalStress = designCode === 'ACI318' ? 0.75 * fce : fce;
    
    steps.push({
      title: 'Step 7: Nodal Zone Check',
      description: 'Verify bearing stress at support node',
      formula: 'σ_n = R / (support_width × b) ≤ f_ce',
      values: {
        'Support Width': `${supportWidth} mm`,
        'Nodal Area': `${nodalArea} mm²`,
        'Nodal Stress': `${nodalStress.toFixed(2)} MPa`,
        'Allowable (f_ce)': `${allowableNodalStress.toFixed(2)} MPa`,
        'Status': nodalStress <= allowableNodalStress ? 'OK' : 'INCREASE SUPPORT WIDTH',
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 34.4' : 'ACI 318-19 Cl. 23.9',
    });
    
    codeChecks.push({
      clause: designCode === 'IS456' ? 'IS 456 Cl. 34.4' : 'ACI 318 Cl. 23.9',
      description: 'Nodal zone stress',
      required: `≤ ${allowableNodalStress.toFixed(2)} MPa`,
      provided: `${nodalStress.toFixed(2)} MPa`,
      status: nodalStress <= allowableNodalStress ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 8: Strut Capacity Check -----
    // Strut width (bottle-shaped)
    const strutWidth = 0.8 * supportWidth; // Approximate
    const strutArea = strutWidth * b;
    const strutStress = C / strutArea;
    
    // Effective strut strength
    const beta_s = 0.6; // Bottle-shaped strut
    const fcs = 0.85 * beta_s * fck;
    const allowableStrutStress = designCode === 'ACI318' ? 0.75 * fcs : fcs;
    
    steps.push({
      title: 'Step 8: Strut Capacity Check',
      description: 'Verify compressive strut adequacy',
      formula: 'f_strut = C / A_strut ≤ f_cs',
      values: {
        'Strut Force': `${(C / 1000).toFixed(2)} kN`,
        'Strut Area': `${strutArea.toFixed(0)} mm²`,
        'Strut Stress': `${strutStress.toFixed(2)} MPa`,
        'Allowable (f_cs)': `${allowableStrutStress.toFixed(2)} MPa`,
        'Status': strutStress <= allowableStrutStress ? 'OK' : 'NEEDS REVISION',
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 29' : 'ACI 318-19 Cl. 23.5',
    });
    
    // ----- DETERMINE OVERALL ADEQUACY -----
    const isAdequate = isDeepBeam && 
                       Ast_provided >= Ast_design && 
                       nodalStress <= allowableNodalStress &&
                       strutStress <= allowableStrutStress;
    
    const utilization = Math.max(
      Ast_design / Ast_provided,
      nodalStress / allowableNodalStress,
      strutStress / allowableStrutStress
    );
    
    return {
      isAdequate,
      utilization,
      capacity: Ast_provided,
      demand: Ast_design,
      status: isAdequate ? 'OK' : 'FAIL',
      message: isAdequate 
        ? `Deep beam design adequate. Provide ${barCount}-${selectedBar}mm main bars + ${horizontalDia}mm horizontal @ ${horizSpacing}mm + ${verticalDia}mm vertical @ ${vertSpacing}mm.`
        : 'Design inadequate. Review warnings and STM model.',
      steps,
      codeChecks,
      warnings,
      classification: {
        spanDepthRatio,
        isDeepBeam,
      },
      reinforcement: {
        mainTension: {
          area: Ast_provided,
          diameter: selectedBar,
          count: barCount,
          layers,
        },
        horizontalWeb: {
          area: numHorizBars * Ash_per_bar,
          diameter: horizontalDia,
          spacing: horizSpacing,
        },
        verticalWeb: {
          area: numVertBars * Asv_per_bar,
          diameter: verticalDia,
          spacing: vertSpacing,
        },
      },
      strutAndTie: {
        strutCapacity: allowableStrutStress * strutArea / 1000,
        tieForce: T / 1000,
        nodalZoneStress: nodalStress,
      },
    };
  }
}

export const deepBeamDesignEngine = new DeepBeamDesignEngine();
