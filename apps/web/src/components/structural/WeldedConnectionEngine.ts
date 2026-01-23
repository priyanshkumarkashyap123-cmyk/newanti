/**
 * ============================================================================
 * WELDED CONNECTION DESIGN ENGINE
 * ============================================================================
 * 
 * Fillet and Groove Weld Design per IS 800:2007
 * Includes weld groups and eccentric loading
 * 
 * @version 1.0.0
 */

import { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface WeldedConnectionInput {
  // Weld Type
  weldType: 'fillet' | 'butt_full' | 'butt_partial';
  
  // Loading (Factored)
  shearForce?: number;      // kN - parallel to weld
  axialForce?: number;      // kN - perpendicular to weld
  moment?: number;          // kN·m - causing rotation
  
  // Weld Properties
  weldSize: number;         // mm - leg size for fillet, throat for butt
  weldLength: number;       // mm - total effective length
  
  // Weld Pattern (for moment connections)
  weldPattern: 'linear' | 'C_shape' | 'box' | 'circular';
  patternDepth?: number;    // mm - D for C/box pattern
  patternWidth?: number;    // mm - B for box pattern
  
  // Materials
  fy_weld: number;          // MPa - weld metal yield (typically ≥ base metal)
  fu_weld: number;          // MPa - weld metal ultimate (E41: 410, E51: 510)
  fu_base: number;          // MPa - base metal ultimate
  
  // Plate Thicknesses
  thicknessLarger: number;  // mm
  thicknessSmaller: number; // mm
  
  // Options
  weldPosition: 'shop' | 'field';
  inspectionLevel: 'visual' | 'partial_UT' | 'full_UT';
}

export interface WeldedConnectionResult extends CalculationResult {
  weldStrength: {
    shear: number;          // kN/mm
    design: number;         // kN (total)
  };
  stresses: {
    direct: number;         // MPa
    torsional: number;      // MPa
    combined: number;       // MPa
    allowable: number;      // MPa
  };
  weldDetails: {
    effectiveThroat: number;
    effectiveLength: number;
    minSize: number;
    maxSize: number;
  };
}

// ============================================================================
// WELD STRENGTH TABLE (IS 800:2007)
// ============================================================================

// Minimum weld sizes based on thicker plate (Table 21)
const MIN_WELD_SIZE = [
  { thickness: 10, minSize: 3 },
  { thickness: 20, minSize: 5 },
  { thickness: 32, minSize: 6 },
  { thickness: 50, minSize: 8 },
  { thickness: Infinity, minSize: 10 },
];

// ============================================================================
// WELDED CONNECTION ENGINE
// ============================================================================

export class WeldedConnectionEngine {
  
  /**
   * Design welded connection per IS 800:2007
   */
  calculate(input: WeldedConnectionInput): WeldedConnectionResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    const { weldType, shearForce = 0, axialForce = 0, moment = 0, weldSize, weldLength,
            weldPattern, patternDepth = 0, patternWidth = 0,
            fy_weld, fu_weld, fu_base, thicknessLarger, thicknessSmaller, weldPosition, inspectionLevel } = input;
    
    const s = weldSize; // Weld leg size
    const L = weldLength;
    
    // Partial safety factors
    const gamma_mw = 1.25; // Welds (shop)
    const gamma_mw_field = 1.50; // Welds (field)
    const gamma = weldPosition === 'shop' ? gamma_mw : gamma_mw_field;
    
    // ----- STEP 1: Effective Throat Thickness -----
    let te: number; // Effective throat
    
    if (weldType === 'fillet') {
      // Throat = 0.7s for fillet weld at 45°
      te = 0.7 * s;
    } else if (weldType === 'butt_full') {
      // Full penetration butt weld
      te = thicknessSmaller;
    } else {
      // Partial penetration
      te = s; // As specified
    }
    
    // Minimum and maximum fillet weld sizes
    const minWeldEntry = MIN_WELD_SIZE.find(entry => thicknessLarger <= entry.thickness);
    const minSize = minWeldEntry?.minSize || 3;
    const maxSize = Math.min(thicknessSmaller - 1.5, 16); // 1.5mm less than thinner part
    
    steps.push({
      title: 'Step 1: Weld Geometry',
      description: 'Calculate effective throat thickness',
      formula: weldType === 'fillet' ? 't_e = 0.7 × s' : 't_e = plate thickness',
      values: {
        'Weld Type': weldType,
        'Weld Size (s)': `${s} mm`,
        'Effective Throat (t_e)': `${te.toFixed(1)} mm`,
        'Minimum Size': `${minSize} mm`,
        'Maximum Size': `${maxSize.toFixed(1)} mm`,
        'Size OK': s >= minSize && s <= maxSize ? 'YES' : 'NO',
      },
      reference: 'IS 800:2007 Cl. 10.5.3',
    });
    
    if (s < minSize) {
      warnings.push(`Weld size ${s}mm is less than minimum ${minSize}mm for ${thicknessLarger}mm plate.`);
    }
    if (s > maxSize) {
      warnings.push(`Weld size ${s}mm exceeds maximum ${maxSize.toFixed(1)}mm for ${thicknessSmaller}mm plate.`);
    }
    
    codeChecks.push({
      clause: 'IS 800 Table 21',
      description: 'Minimum weld size',
      required: `≥ ${minSize} mm`,
      provided: `${s} mm`,
      status: s >= minSize ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 2: Effective Length -----
    // Effective length = actual length - 2s (for fillet welds)
    let Le: number;
    
    if (weldType === 'fillet') {
      Le = Math.max(L - 2 * s, 4 * s); // Minimum 4s
    } else {
      Le = L;
    }
    
    // Check minimum length
    const minLength = 4 * s;
    
    steps.push({
      title: 'Step 2: Effective Length',
      description: 'Calculate effective weld length',
      formula: 'L_e = L - 2s (for fillet), min = 4s',
      values: {
        'Actual Length': `${L} mm`,
        'Effective Length (L_e)': `${Le.toFixed(0)} mm`,
        'Minimum Length': `${minLength} mm`,
      },
      reference: 'IS 800:2007 Cl. 10.5.4',
    });
    
    // ----- STEP 3: Design Strength per Unit Length -----
    // For fillet welds: f_wd = f_u / (√3 × γ_mw)
    // Weld strength is based on lower of weld metal and base metal
    const fu_design = Math.min(fu_weld, fu_base);
    const fwd = fu_design / (Math.sqrt(3) * gamma);
    
    // Strength per unit length = fwd × te
    const strength_per_mm = fwd * te / 1000; // kN/mm
    
    steps.push({
      title: 'Step 3: Weld Design Strength',
      description: 'Calculate weld capacity per unit length',
      formula: 'f_wd = f_u / (√3 × γ_mw), Strength = f_wd × t_e',
      values: {
        'Weld Metal f_u': `${fu_weld} MPa`,
        'Base Metal f_u': `${fu_base} MPa`,
        'Design f_u': `${fu_design} MPa`,
        'f_wd': `${fwd.toFixed(1)} MPa`,
        'Strength per mm': `${strength_per_mm.toFixed(3)} kN/mm`,
        'Weld Position': weldPosition,
        'γ_mw': gamma.toFixed(2),
      },
      reference: 'IS 800:2007 Cl. 10.5.7',
    });
    
    // ----- STEP 4: Stress Analysis -----
    // Total weld throat area
    const Aw = te * Le; // mm²
    
    // Direct stresses
    const f_direct_shear = shearForce > 0 ? (shearForce * 1000) / Aw : 0; // MPa
    const f_direct_axial = axialForce > 0 ? (axialForce * 1000) / Aw : 0; // MPa
    
    // Torsional stress from moment (for weld groups)
    let f_torsional = 0;
    let J_weld = 0; // Polar moment of inertia
    
    if (moment > 0 && weldPattern !== 'linear') {
      const D = patternDepth;
      const B = patternWidth || 0;
      
      if (weldPattern === 'C_shape') {
        // Two vertical welds
        J_weld = te * D * D * D / 6;
      } else if (weldPattern === 'box') {
        // Four welds forming a rectangle
        J_weld = te * (D * D * D + B * B * D * 3) / 6;
      }
      
      const r_max = Math.sqrt(Math.pow(D / 2, 2) + Math.pow((B || 0) / 2, 2));
      f_torsional = (moment * 1e6 * r_max) / J_weld;
    }
    
    // Combined resultant stress
    const f_resultant = Math.sqrt(
      Math.pow(f_direct_shear + f_torsional * Math.cos(Math.PI / 4), 2) +
      Math.pow(f_direct_axial + f_torsional * Math.sin(Math.PI / 4), 2)
    );
    
    steps.push({
      title: 'Step 4: Stress Analysis',
      description: 'Calculate stresses in weld',
      formula: 'f_resultant = √(f_direct² + f_torsion²)',
      values: {
        'Weld Area': `${Aw.toFixed(0)} mm²`,
        'Direct Shear Stress': `${f_direct_shear.toFixed(1)} MPa`,
        'Direct Axial Stress': `${f_direct_axial.toFixed(1)} MPa`,
        'Torsional Stress': `${f_torsional.toFixed(1)} MPa`,
        'Resultant Stress': `${f_resultant.toFixed(1)} MPa`,
        'Design Strength': `${fwd.toFixed(1)} MPa`,
      },
      reference: 'IS 800:2007 Cl. 10.5.9',
    });
    
    // ----- STEP 5: Capacity Check -----
    const stressRatio = f_resultant / fwd;
    const isAdequate = f_resultant <= fwd;
    
    // Total connection capacity (for shear only)
    const totalCapacity = strength_per_mm * Le; // kN
    
    steps.push({
      title: 'Step 5: Adequacy Check',
      description: 'Verify weld against design strength',
      formula: 'f_resultant ≤ f_wd',
      values: {
        'Resultant Stress': `${f_resultant.toFixed(1)} MPa`,
        'Design Strength': `${fwd.toFixed(1)} MPa`,
        'Stress Ratio': `${(stressRatio * 100).toFixed(1)}%`,
        'Total Shear Capacity': `${totalCapacity.toFixed(2)} kN`,
        'Status': isAdequate ? 'ADEQUATE' : 'INADEQUATE',
      },
      reference: 'IS 800:2007 Cl. 10.5.7',
    });
    
    codeChecks.push({
      clause: 'IS 800 Cl. 10.5.7',
      description: 'Weld stress check',
      required: `≤ ${fwd.toFixed(1)} MPa`,
      provided: `${f_resultant.toFixed(1)} MPa`,
      status: isAdequate ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 6: Detailing Requirements -----
    // End returns for fillet welds
    if (weldType === 'fillet' && weldPattern !== 'circular') {
      const returnLength = 2 * s;
      steps.push({
        title: 'Step 6: Detailing',
        description: 'End return and run-off requirements',
        formula: 'End return ≥ 2s',
        values: {
          'Minimum End Return': `${returnLength} mm`,
          'Recommendation': 'Provide returns at exposed ends',
          'Inspection': inspectionLevel,
        },
        reference: 'IS 800:2007 Cl. 10.5.5',
      });
    }
    
    if (!isAdequate) {
      warnings.push('Weld inadequate. Consider: (1) Increase weld size, (2) Increase weld length, (3) Change to full penetration butt weld');
    }
    
    return {
      isAdequate,
      utilization: stressRatio,
      capacity: totalCapacity,
      demand: Math.sqrt(shearForce * shearForce + axialForce * axialForce),
      status: isAdequate ? 'OK' : 'FAIL',
      message: isAdequate 
        ? `Weld adequate. ${s}mm fillet × ${Le}mm length. Utilization: ${(stressRatio * 100).toFixed(1)}%`
        : 'Weld inadequate. Increase size or length.',
      steps,
      codeChecks,
      warnings,
      weldStrength: {
        shear: strength_per_mm,
        design: totalCapacity,
      },
      stresses: {
        direct: Math.sqrt(f_direct_shear * f_direct_shear + f_direct_axial * f_direct_axial),
        torsional: f_torsional,
        combined: f_resultant,
        allowable: fwd,
      },
      weldDetails: {
        effectiveThroat: te,
        effectiveLength: Le,
        minSize,
        maxSize,
      },
    };
  }
}

export const weldedConnectionEngine = new WeldedConnectionEngine();
