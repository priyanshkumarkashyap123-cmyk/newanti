/**
 * ============================================================================
 * STAIRCASE DESIGN ENGINE
 * ============================================================================
 * 
 * RC Staircase design per IS 456:2000
 * Supports: Dog-leg, Open well, Spiral staircases
 * 
 * @version 1.0.0
 */

import { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface StaircaseInput {
  // Geometry
  staircaseType: 'dog_leg' | 'open_well' | 'straight';
  floorHeight: number;      // mm - floor to floor height
  numRisers: number;        // number of risers
  treadWidth: number;       // mm - going
  riserHeight: number;      // mm - computed from floorHeight/numRisers
  waistThickness: number;   // mm - waist slab thickness
  landingWidth: number;     // mm - landing width
  landingLength: number;    // mm - landing length (span direction)
  stairWidth: number;       // mm - width of stair
  
  // Materials
  fck: number;              // MPa
  fy: number;               // MPa
  clearCover: number;       // mm
  
  // Loading
  liveLoad: number;         // kN/m² - typically 3-5
  finishLoad: number;       // kN/m² - typically 1.0-1.5
  
  // Support conditions
  supportCondition: 'simply_supported' | 'continuous' | 'fixed';
}

export interface StaircaseResult extends CalculationResult {
  geometry: {
    effectiveSpan: number;
    goingAngle: number;
    riserHeight: number;
    treadDepth: number;
  };
  loads: {
    deadLoad: number;
    liveLoad: number;
    factoredLoad: number;
  };
  reinforcement: {
    mainBar: {
      diameter: number;
      spacing: number;
      area: number;
      areaProvided: number;
    };
    distributionBar: {
      diameter: number;
      spacing: number;
    };
  };
  deflection: {
    spanDepthRatio: {
      required: number;
      provided: number;
      status: 'OK' | 'FAIL';
    };
  };
}

// ============================================================================
// STAIRCASE DESIGN CALCULATOR
// ============================================================================

export class StaircaseDesignEngine {
  
  /**
   * Design RC staircase per IS 456:2000
   */
  calculate(input: StaircaseInput): StaircaseResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    // ----- STEP 1: Geometry Check -----
    const riserHeight = input.floorHeight / input.numRisers;
    const goingAngle = Math.atan(riserHeight / input.treadWidth) * (180 / Math.PI);
    
    // Check riser-tread relationship (2R + T = 550-700mm)
    const treadRiserSum = 2 * riserHeight + input.treadWidth;
    
    steps.push({
      title: 'Step 1: Geometry Verification',
      description: 'Check riser-tread relationship per IS 456',
      formula: '2R + T = 550 to 700 mm',
      values: {
        'Riser (R)': `${riserHeight.toFixed(0)} mm`,
        'Tread (T)': `${input.treadWidth} mm`,
        '2R + T': `${treadRiserSum.toFixed(0)} mm`,
        'Going Angle': `${goingAngle.toFixed(1)}°`,
      },
      reference: 'IS 456:2000 Cl. 33.3',
    });
    
    if (treadRiserSum < 550 || treadRiserSum > 700) {
      warnings.push(`Tread-riser sum (${treadRiserSum.toFixed(0)}mm) outside recommended range 550-700mm`);
    }
    
    if (riserHeight > 200) {
      warnings.push(`Riser height (${riserHeight.toFixed(0)}mm) exceeds recommended maximum of 200mm`);
    }
    
    if (input.treadWidth < 250) {
      warnings.push(`Tread width (${input.treadWidth}mm) less than recommended minimum of 250mm`);
    }
    
    // ----- STEP 2: Effective Span -----
    // For simply supported: c/c of supports
    // For dog-leg: going + landing/2 at each end
    let effectiveSpan: number;
    
    if (input.staircaseType === 'dog_leg') {
      const numTreads = input.numRisers / 2; // Half flight
      const goingLength = numTreads * input.treadWidth;
      effectiveSpan = goingLength + input.landingLength / 2;
    } else {
      effectiveSpan = input.numRisers * input.treadWidth + input.landingLength;
    }
    
    steps.push({
      title: 'Step 2: Effective Span Calculation',
      description: 'Determine effective span for bending moment',
      formula: 'L_eff = Going + Landing/2 (for dog-leg)',
      values: {
        'Staircase Type': input.staircaseType.replace('_', ' '),
        'Effective Span': `${effectiveSpan.toFixed(0)} mm`,
      },
      reference: 'IS 456:2000 Cl. 33.1',
    });
    
    // ----- STEP 3: Load Calculation -----
    const waistOnSlope = input.waistThickness / Math.cos(goingAngle * Math.PI / 180);
    const stepWeight = 0.5 * riserHeight * input.treadWidth * 25 / 1000000; // kN/m² (assuming step triangular area)
    
    const deadLoadWaist = waistOnSlope * 25 / 1000; // kN/m² (concrete density 25 kN/m³)
    const deadLoadSteps = stepWeight;
    const deadLoadFinish = input.finishLoad;
    const totalDeadLoad = deadLoadWaist + deadLoadSteps + deadLoadFinish;
    
    const totalLoad = totalDeadLoad + input.liveLoad;
    const factoredLoad = 1.5 * totalLoad; // IS 456 load factor
    
    steps.push({
      title: 'Step 3: Load Calculation',
      description: 'Calculate factored design load per unit area',
      formula: 'w_u = 1.5 × (DL + LL)',
      values: {
        'Waist Slab DL': `${deadLoadWaist.toFixed(2)} kN/m²`,
        'Steps DL': `${deadLoadSteps.toFixed(2)} kN/m²`,
        'Finish Load': `${deadLoadFinish.toFixed(2)} kN/m²`,
        'Live Load': `${input.liveLoad.toFixed(2)} kN/m²`,
        'Total DL': `${totalDeadLoad.toFixed(2)} kN/m²`,
        'Factored Load (w_u)': `${factoredLoad.toFixed(2)} kN/m²`,
      },
      reference: 'IS 456:2000 Table 4',
    });
    
    // ----- STEP 4: Bending Moment -----
    const spanM = effectiveSpan / 1000; // Convert to meters
    const loadPerMeter = factoredLoad * (input.stairWidth / 1000); // kN/m
    
    let momentMu: number;
    let momentCoeff: string;
    
    if (input.supportCondition === 'simply_supported') {
      momentMu = (factoredLoad * spanM * spanM) / 8;
      momentCoeff = 'wL²/8';
    } else if (input.supportCondition === 'continuous') {
      momentMu = (factoredLoad * spanM * spanM) / 10; // Approximate for continuous
      momentCoeff = 'wL²/10';
    } else {
      momentMu = (factoredLoad * spanM * spanM) / 12;
      momentCoeff = 'wL²/12';
    }
    
    // Per meter width
    const momentPerMeter = momentMu;
    
    steps.push({
      title: 'Step 4: Design Bending Moment',
      description: `Calculate factored moment for ${input.supportCondition.replace('_', ' ')} condition`,
      formula: `M_u = ${momentCoeff}`,
      values: {
        'Span (L)': `${spanM.toFixed(2)} m`,
        'Factored Load (w)': `${factoredLoad.toFixed(2)} kN/m²`,
        'Moment (M_u)': `${momentPerMeter.toFixed(2)} kN·m/m`,
      },
      reference: 'IS 456:2000 Annex D',
    });
    
    // ----- STEP 5: Effective Depth Check -----
    // d = √(M_u / (0.138 × fck × b))
    const dRequired = Math.sqrt((momentPerMeter * 1e6) / (0.138 * input.fck * 1000));
    const dProvided = input.waistThickness - input.clearCover - 6; // Assuming 12mm bar
    
    steps.push({
      title: 'Step 5: Effective Depth Check',
      description: 'Check adequacy of waist slab thickness',
      formula: 'd_req = √(M_u / (0.138 × fck × b))',
      values: {
        'd_required': `${dRequired.toFixed(0)} mm`,
        'd_provided': `${dProvided.toFixed(0)} mm`,
        'Status': dProvided >= dRequired ? 'OK' : 'REVISE',
      },
      reference: 'IS 456:2000 Annex G',
    });
    
    const depthAdequate = dProvided >= dRequired;
    if (!depthAdequate) {
      warnings.push(`Effective depth (${dProvided.toFixed(0)}mm) insufficient. Increase waist thickness.`);
    }
    
    codeChecks.push({
      clause: 'IS 456 Annex G',
      description: 'Effective depth for flexure',
      required: `≥ ${dRequired.toFixed(0)} mm`,
      provided: `${dProvided.toFixed(0)} mm`,
      status: depthAdequate ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 6: Main Reinforcement -----
    // Ast = 0.5 × fck/fy × [1 - √(1 - 4.6×Mu/(fck×b×d²))] × b × d
    const bd2 = 1000 * dProvided * dProvided;
    const term = 4.6 * momentPerMeter * 1e6 / (input.fck * bd2);
    
    let Ast_required: number;
    if (term > 1) {
      // Section insufficient
      Ast_required = 9999;
      warnings.push('Section is heavily reinforced or insufficient');
    } else {
      Ast_required = 0.5 * (input.fck / input.fy) * (1 - Math.sqrt(1 - term)) * 1000 * dProvided;
    }
    
    // Minimum steel (0.12% for HYSD)
    const Ast_min = 0.12 * input.waistThickness * 1000 / 100;
    Ast_required = Math.max(Ast_required, Ast_min);
    
    // Select bar diameter and spacing
    const barDiameters = [8, 10, 12, 16, 20];
    let selectedBar = 10;
    let spacing = 150;
    
    for (const dia of barDiameters) {
      const area = Math.PI * dia * dia / 4;
      const reqSpacing = (area / Ast_required) * 1000;
      if (reqSpacing >= 100 && reqSpacing <= 300) {
        selectedBar = dia;
        spacing = Math.floor(reqSpacing / 25) * 25; // Round to 25mm
        break;
      }
    }
    
    const Ast_provided = (Math.PI * selectedBar * selectedBar / 4) * (1000 / spacing);
    
    steps.push({
      title: 'Step 6: Main Reinforcement Design',
      description: 'Calculate required area of tension steel',
      formula: 'A_st = 0.5 × (fck/fy) × [1 - √(1 - 4.6M_u/(fck×b×d²))] × b × d',
      values: {
        'A_st required': `${Ast_required.toFixed(0)} mm²/m`,
        'A_st minimum': `${Ast_min.toFixed(0)} mm²/m`,
        'Bar Diameter': `${selectedBar} mm`,
        'Spacing': `${spacing} mm c/c`,
        'A_st provided': `${Ast_provided.toFixed(0)} mm²/m`,
      },
      reference: 'IS 456:2000 Cl. 26.5.1.1',
    });
    
    const mainReinfAdequate = Ast_provided >= Ast_required;
    codeChecks.push({
      clause: 'IS 456 Cl. 26.5.1.1',
      description: 'Main reinforcement area',
      required: `≥ ${Ast_required.toFixed(0)} mm²/m`,
      provided: `${Ast_provided.toFixed(0)} mm²/m`,
      status: mainReinfAdequate ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 7: Distribution Reinforcement -----
    const Ast_dist = 0.12 * input.waistThickness * 1000 / 100; // 0.12% for HYSD
    const distBar = 8;
    const distSpacing = Math.floor(((Math.PI * distBar * distBar / 4) / Ast_dist) * 1000 / 25) * 25;
    
    steps.push({
      title: 'Step 7: Distribution Reinforcement',
      description: 'Secondary reinforcement perpendicular to main bars',
      formula: 'A_st,dist = 0.12% of gross area (HYSD)',
      values: {
        'A_st,dist required': `${Ast_dist.toFixed(0)} mm²/m`,
        'Bar Diameter': `${distBar} mm`,
        'Spacing': `${Math.min(distSpacing, 450)} mm c/c`,
      },
      reference: 'IS 456:2000 Cl. 26.5.2.1',
    });
    
    // ----- STEP 8: Deflection Check -----
    // Basic L/d ratio
    let basicRatio = 20; // Simply supported
    if (input.supportCondition === 'continuous') basicRatio = 26;
    if (input.supportCondition === 'fixed') basicRatio = 7; // Cantilever
    
    // Modification factor (simplified)
    const pt = (Ast_provided / (1000 * dProvided)) * 100;
    const fs = 0.58 * input.fy * (Ast_required / Ast_provided);
    const modFactor = Math.min(2.0, 1.0 + (input.fck - 10) / 40); // Simplified
    
    const allowableRatio = basicRatio * modFactor;
    const actualRatio = effectiveSpan / dProvided;
    
    steps.push({
      title: 'Step 8: Deflection Control',
      description: 'Check span-to-depth ratio for serviceability',
      formula: 'L/d ≤ Basic ratio × Modification factor',
      values: {
        'Basic L/d ratio': `${basicRatio}`,
        'Modification Factor': `${modFactor.toFixed(2)}`,
        'Allowable L/d': `${allowableRatio.toFixed(1)}`,
        'Actual L/d': `${actualRatio.toFixed(1)}`,
        'Status': actualRatio <= allowableRatio ? 'OK' : 'REVISE',
      },
      reference: 'IS 456:2000 Cl. 23.2.1',
    });
    
    const deflectionOk = actualRatio <= allowableRatio;
    codeChecks.push({
      clause: 'IS 456 Cl. 23.2.1',
      description: 'Deflection control (L/d ratio)',
      required: `≤ ${allowableRatio.toFixed(1)}`,
      provided: `${actualRatio.toFixed(1)}`,
      status: deflectionOk ? 'PASS' : 'FAIL',
    });
    
    // ----- DETERMINE OVERALL ADEQUACY -----
    const isAdequate = depthAdequate && mainReinfAdequate && deflectionOk;
    const utilization = Math.max(
      dRequired / dProvided,
      Ast_required / Ast_provided,
      actualRatio / allowableRatio
    );
    
    return {
      isAdequate,
      utilization,
      capacity: Ast_provided,
      demand: Ast_required,
      status: isAdequate ? 'OK' : 'FAIL',
      message: isAdequate 
        ? `Staircase design adequate. Provide ${selectedBar}mm @ ${spacing}mm c/c main bars.`
        : 'Design inadequate. Review warnings and increase section/reinforcement.',
      steps,
      codeChecks,
      warnings,
      geometry: {
        effectiveSpan,
        goingAngle,
        riserHeight,
        treadDepth: input.treadWidth,
      },
      loads: {
        deadLoad: totalDeadLoad,
        liveLoad: input.liveLoad,
        factoredLoad,
      },
      reinforcement: {
        mainBar: {
          diameter: selectedBar,
          spacing,
          area: Ast_required,
          areaProvided: Ast_provided,
        },
        distributionBar: {
          diameter: distBar,
          spacing: Math.min(distSpacing, 450),
        },
      },
      deflection: {
        spanDepthRatio: {
          required: allowableRatio,
          provided: actualRatio,
          status: deflectionOk ? 'OK' : 'FAIL',
        },
      },
    };
  }
}

export const staircaseDesignEngine = new StaircaseDesignEngine();
