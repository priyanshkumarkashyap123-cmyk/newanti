/**
 * ============================================================================
 * CORBEL DESIGN ENGINE
 * ============================================================================
 * 
 * RC Corbel (Bracket) Design per IS 456:2000 and ACI 318
 * Short cantilever projection from column for supporting beams/girders
 * 
 * @version 1.0.0
 */

import { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface CorbelDesignInput {
  // Geometry
  columnWidth: number;      // mm - width of supporting column
  corbelWidth: number;      // mm - width of corbel (usually = column width)
  corbelDepth: number;      // mm - depth at column face
  projectionLength: number; // mm - horizontal projection (a)
  
  // Materials
  fck: number;              // MPa
  fy: number;               // MPa
  
  // Loading
  verticalLoad: number;     // kN - Vu (factored)
  horizontalLoad: number;   // kN - Nuc (factored horizontal, e.g., shrinkage)
  
  // Options
  bearingPlateWidth?: number;  // mm
  bearingPlateLength?: number; // mm
  designCode: 'IS456' | 'ACI318';
}

export interface CorbelDesignResult extends CalculationResult {
  geometry: {
    shearSpanRatio: number;  // a/d
    isCorbel: boolean;       // a/d ≤ 1
  };
  reinforcement: {
    mainTension: {
      area: number;
      diameter: number;
      count: number;
    };
    horizontalTies: {
      area: number;
      diameter: number;
      spacing: number;
    };
    anchorage: {
      type: string;
      length: number;
    };
  };
}

// ============================================================================
// CORBEL DESIGN CALCULATOR
// ============================================================================

export class CorbelDesignEngine {
  
  /**
   * Design corbel per IS 456 / ACI 318 strut-and-tie model
   */
  calculate(input: CorbelDesignInput): CorbelDesignResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    const { columnWidth, corbelWidth, corbelDepth, projectionLength, fck, fy, verticalLoad, horizontalLoad, designCode } = input;
    
    const b = corbelWidth;
    const D = corbelDepth;
    const a = projectionLength;
    const Vu = verticalLoad;
    const Nuc = Math.max(horizontalLoad, 0.2 * Vu); // Minimum horizontal per code
    
    // Effective depth (assume 50mm cover + 25mm bar)
    const cover = 40;
    const mainBarDia = 20;
    const d = D - cover - mainBarDia / 2;
    
    // ----- STEP 1: Geometry Verification -----
    const shearSpanRatio = a / d;
    const isCorbel = shearSpanRatio <= 1.0;
    const isBracket = shearSpanRatio > 1.0 && shearSpanRatio <= 2.0;
    
    steps.push({
      title: 'Step 1: Geometry Classification',
      description: 'Verify corbel/bracket classification based on a/d ratio',
      formula: 'Corbel: a/d ≤ 1.0, Bracket: 1.0 < a/d ≤ 2.0',
      values: {
        'Projection (a)': `${a} mm`,
        'Effective Depth (d)': `${d.toFixed(0)} mm`,
        'Shear Span Ratio (a/d)': shearSpanRatio.toFixed(3),
        'Classification': isCorbel ? 'CORBEL' : isBracket ? 'BRACKET' : 'BEAM (use standard design)',
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 34.5' : 'ACI 318-19 Cl. 16.5.2',
    });
    
    if (!isCorbel && !isBracket) {
      warnings.push('a/d > 2.0: This is a regular cantilever beam, not a corbel. Use standard beam design.');
    }
    
    codeChecks.push({
      clause: designCode === 'IS456' ? 'IS 456 Cl. 34.5' : 'ACI 318 Cl. 16.5.2',
      description: 'Corbel geometry (a/d)',
      required: '≤ 1.0 for corbel, ≤ 2.0 for bracket',
      provided: shearSpanRatio.toFixed(3),
      status: (isCorbel || isBracket) ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 2: Check Bearing Stress -----
    let bearingWidth = input.bearingPlateWidth || 100;
    let bearingLength = input.bearingPlateLength || b;
    const bearingArea = bearingWidth * bearingLength;
    const bearingStress = (Vu * 1000) / bearingArea;
    const allowableBearing = 0.4 * fck;
    
    steps.push({
      title: 'Step 2: Bearing Check',
      description: 'Verify bearing stress under applied load',
      formula: 'σ_b = V_u / A_bearing ≤ 0.4 × fck',
      values: {
        'Bearing Area': `${bearingArea} mm²`,
        'Bearing Stress': `${bearingStress.toFixed(2)} MPa`,
        'Allowable': `${allowableBearing.toFixed(1)} MPa`,
        'Status': bearingStress <= allowableBearing ? 'OK' : 'INCREASE BEARING AREA',
      },
      reference: 'IS 456:2000 Cl. 34.4',
    });
    
    // ----- STEP 3: Design Moment -----
    // Mu = Vu × a + Nuc × (D - d)
    const Mu = Vu * (a / 1000) + Nuc * ((D - d) / 1000);
    
    steps.push({
      title: 'Step 3: Design Moment',
      description: 'Calculate moment at column face',
      formula: 'M_u = V_u × a + N_uc × (h - d)',
      values: {
        'Vertical Load (V_u)': `${Vu.toFixed(2)} kN`,
        'Horizontal Load (N_uc)': `${Nuc.toFixed(2)} kN`,
        'Projection': `${a} mm`,
        'Design Moment (M_u)': `${Mu.toFixed(2)} kN·m`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 34.5' : 'ACI 318-19 Cl. 16.5.3',
    });
    
    // ----- STEP 4: Primary Tension Steel -----
    // Area for flexure
    const Af = Mu * 1e6 / (0.87 * fy * 0.9 * d);
    
    // Area for direct tension
    const An = Nuc * 1000 / (0.87 * fy);
    
    // Total required area
    // ACI: Asc = larger of (Af + An) or (2Avf/3 + An) or (Vf/0.33fy)
    // Simplified: Asc = Af + An
    const Asc = Af + An;
    
    // Minimum steel
    const Asc_min = 0.04 * (fck / fy) * b * d;
    const Asc_required = Math.max(Asc, Asc_min);
    
    // Select bars
    const barDiameters = [16, 20, 25, 32];
    let selectedBar = 20;
    let barCount = 4;
    
    for (const dia of barDiameters) {
      const areaPerBar = Math.PI * dia * dia / 4;
      const reqCount = Math.ceil(Asc_required / areaPerBar);
      if (reqCount >= 2 && reqCount <= 6) {
        selectedBar = dia;
        barCount = Math.max(2, reqCount);
        break;
      }
    }
    
    const Asc_provided = barCount * Math.PI * selectedBar * selectedBar / 4;
    
    steps.push({
      title: 'Step 4: Primary Tension Reinforcement',
      description: 'Design main steel at top of corbel',
      formula: 'A_sc = A_f + A_n = M_u/(0.87×fy×jd) + N_uc/(0.87×fy)',
      values: {
        'Flexure Steel (A_f)': `${Af.toFixed(0)} mm²`,
        'Tension Steel (A_n)': `${An.toFixed(0)} mm²`,
        'Total Required': `${Asc_required.toFixed(0)} mm²`,
        'Bar Size': `${selectedBar} mm`,
        'Number of Bars': `${barCount}`,
        'A_sc Provided': `${Asc_provided.toFixed(0)} mm²`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 34.5.2' : 'ACI 318-19 Cl. 16.5.4',
    });
    
    codeChecks.push({
      clause: designCode === 'IS456' ? 'IS 456 Cl. 34.5.2' : 'ACI 318 Cl. 16.5.4',
      description: 'Primary tension steel',
      required: `≥ ${Asc_required.toFixed(0)} mm²`,
      provided: `${Asc_provided.toFixed(0)} mm²`,
      status: Asc_provided >= Asc_required ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 5: Horizontal Stirrups / Ties -----
    // Closed stirrups in upper 2d/3 of corbel
    // Ah ≥ 0.5 × (Asc - An)
    const Ah = 0.5 * (Asc_provided - An);
    const Ah_min = 0.4 * Asc_provided; // Alternative minimum
    const Ah_required = Math.max(Ah, Ah_min);
    
    // Distribute in upper 2d/3
    const distribution_depth = 2 * d / 3;
    const stirrupDia = 10;
    const Asv_per_stirrup = 2 * Math.PI * stirrupDia * stirrupDia / 4; // 2-legged
    const numStirrups = Math.ceil(Ah_required / Asv_per_stirrup);
    const stirrupSpacing = Math.floor(distribution_depth / numStirrups);
    
    steps.push({
      title: 'Step 5: Horizontal Stirrups',
      description: 'Design closed horizontal ties in upper 2d/3',
      formula: 'A_h ≥ 0.5 × (A_sc - A_n) or 0.4 × A_sc',
      values: {
        'A_h Required': `${Ah_required.toFixed(0)} mm²`,
        'Distribution Zone': `Upper ${distribution_depth.toFixed(0)} mm`,
        'Stirrup Size': `${stirrupDia} mm dia`,
        'Number of Stirrups': `${numStirrups}`,
        'Spacing': `${stirrupSpacing} mm c/c`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 34.5.3' : 'ACI 318-19 Cl. 16.5.5',
    });
    
    // ----- STEP 6: Shear Friction Check -----
    // Vn = Avf × fy × μ
    // μ = 1.4 for concrete cast monolithically
    const mu = 1.4;
    const phi_v = designCode === 'ACI318' ? 0.75 : 1.0;
    const Avf = Vu * 1000 / (phi_v * fy * mu);
    
    // Primary steel must exceed shear friction requirement
    const shearFrictionOk = Asc_provided >= Avf;
    
    steps.push({
      title: 'Step 6: Shear Friction Verification',
      description: 'Check primary steel for shear transfer',
      formula: 'A_vf = V_u / (φ × fy × μ), where μ = 1.4',
      values: {
        'Shear Friction Coeff (μ)': mu.toFixed(1),
        'A_vf Required': `${Avf.toFixed(0)} mm²`,
        'A_sc Provided': `${Asc_provided.toFixed(0)} mm²`,
        'Status': shearFrictionOk ? 'OK' : 'INSUFFICIENT',
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 34.4' : 'ACI 318-19 Cl. 22.9',
    });
    
    codeChecks.push({
      clause: designCode === 'IS456' ? 'IS 456 Cl. 34.4' : 'ACI 318 Cl. 22.9',
      description: 'Shear friction',
      required: `≥ ${Avf.toFixed(0)} mm²`,
      provided: `${Asc_provided.toFixed(0)} mm²`,
      status: shearFrictionOk ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 7: Anchorage of Main Steel -----
    // Primary steel must be anchored: welded cross bar, plate, or hooked
    const Ld = (0.87 * fy * selectedBar) / (4 * 1.5 * Math.sqrt(fck)); // Basic development length
    const anchorageLength = Math.max(Ld, 8 * selectedBar, 150);
    
    steps.push({
      title: 'Step 7: Anchorage Requirements',
      description: 'Ensure full anchorage of primary tension steel',
      formula: 'L_d = 0.87 × fy × φ / (4 × τ_bd)',
      values: {
        'Development Length': `${Ld.toFixed(0)} mm`,
        'Required Anchorage': `${anchorageLength.toFixed(0)} mm`,
        'Recommendation': 'Use welded anchor bar or plate at front face',
      },
      reference: 'IS 456:2000 Cl. 26.2',
    });
    
    // ----- DETERMINE OVERALL ADEQUACY -----
    const isAdequate = (isCorbel || isBracket) && 
                       Asc_provided >= Asc_required && 
                       shearFrictionOk &&
                       bearingStress <= allowableBearing;
    
    const utilization = Math.max(
      Asc_required / Asc_provided,
      Avf / Asc_provided,
      bearingStress / allowableBearing
    );
    
    return {
      isAdequate,
      utilization,
      capacity: Asc_provided,
      demand: Asc_required,
      status: isAdequate ? 'OK' : 'FAIL',
      message: isAdequate 
        ? `Corbel design adequate. Provide ${barCount}-${selectedBar}mm main bars with ${stirrupDia}mm horizontal ties @ ${stirrupSpacing}mm c/c.`
        : 'Design inadequate. Review warnings and increase reinforcement or section.',
      steps,
      codeChecks,
      warnings,
      geometry: {
        shearSpanRatio,
        isCorbel,
      },
      reinforcement: {
        mainTension: {
          area: Asc_provided,
          diameter: selectedBar,
          count: barCount,
        },
        horizontalTies: {
          area: numStirrups * Asv_per_stirrup,
          diameter: stirrupDia,
          spacing: stirrupSpacing,
        },
        anchorage: {
          type: 'Welded anchor bar or mechanical anchorage',
          length: anchorageLength,
        },
      },
    };
  }
}

export const corbelDesignEngine = new CorbelDesignEngine();
