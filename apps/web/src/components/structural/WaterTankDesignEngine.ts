/**
 * ============================================================================
 * WATER TANK DESIGN ENGINE
 * ============================================================================
 * 
 * RC Water Tank Design per IS 3370 (Parts I-IV)
 * Ground-supported and elevated tanks
 * 
 * @version 1.0.0
 */

import { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface WaterTankDesignInput {
  // Tank Geometry
  tankType: 'rectangular' | 'circular';
  length: number;           // mm (L) - for rectangular
  width: number;            // mm (B) - for rectangular
  diameter?: number;        // mm - for circular
  waterDepth: number;       // mm (H) - depth of water
  freeboard: number;        // mm - additional height above water level
  
  // Tank Position
  position: 'ground' | 'underground' | 'elevated';
  
  // Materials
  fck: number;              // MPa - M25 minimum per IS 3370
  fy: number;               // MPa
  
  // Design Options
  crackWidthLimit: number;  // mm - typically 0.2mm for liquid retaining
  steelStressLimit?: number; // MPa - permissible steel stress
}

export interface WaterTankDesignResult extends CalculationResult {
  dimensions: {
    internalLength: number;
    internalWidth: number;
    totalHeight: number;
    wallThickness: number;
    baseThickness: number;
  };
  pressures: {
    maxWaterPressure: number;  // kN/m² at base
  };
  wallDesign: {
    moment: number;
    directTension: number;
    steelArea: number;
    distribution: number;
  };
  baseDesign: {
    moment: number;
    steelArea: number;
  };
}

// ============================================================================
// WATER TANK DESIGN CALCULATOR
// ============================================================================

export class WaterTankDesignEngine {
  
  /**
   * Design water tank per IS 3370
   */
  calculate(input: WaterTankDesignInput): WaterTankDesignResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    const { tankType, length, width, diameter, waterDepth, freeboard, position, fck, fy, crackWidthLimit } = input;
    
    // Unit weight of water
    const gamma_w = 10; // kN/m³
    
    // Convert to meters
    const L = length / 1000;
    const B = width / 1000;
    const H = waterDepth / 1000;
    const D = diameter ? diameter / 1000 : 0;
    
    // ----- STEP 1: Tank Classification -----
    // Check if long wall or short wall design governs
    let ratio: number;
    let designMethod: string;
    
    if (tankType === 'rectangular') {
      ratio = L / H;
      if (ratio >= 2) {
        designMethod = 'Bending Theory (L/H ≥ 2)';
      } else {
        designMethod = 'Combined Bending & Direct Tension';
      }
    } else {
      ratio = D / H;
      designMethod = 'Hoop Tension Design';
    }
    
    steps.push({
      title: 'Step 1: Tank Classification',
      description: 'Determine design method based on geometry',
      formula: 'L/H ratio determines if bending or direct tension governs',
      values: {
        'Tank Type': tankType,
        'L/H or D/H Ratio': ratio.toFixed(2),
        'Design Method': designMethod,
        'Position': position,
      },
      reference: 'IS 3370 (Part II):2009',
    });
    
    // ----- STEP 2: Wall Thickness (Preliminary) -----
    // Minimum wall thickness
    const minThickness = Math.max(150, H * 1000 / 30 + 75); // mm
    let wallThickness = Math.ceil(minThickness / 25) * 25; // Round to 25mm
    
    // For liquid retaining: use permissible stress method
    const sigma_ct = 1.5; // MPa - permissible tensile stress in concrete (IS 3370)
    const sigma_st = input.steelStressLimit || (fy === 415 ? 150 : 130); // MPa - steel stress limit for crack control
    
    steps.push({
      title: 'Step 2: Preliminary Wall Thickness',
      description: 'Determine minimum wall thickness',
      formula: 't_min ≥ max(150mm, H/30 + 75mm)',
      values: {
        'Water Depth (H)': `${H * 1000} mm`,
        'Minimum Thickness': `${minThickness.toFixed(0)} mm`,
        'Adopted Thickness': `${wallThickness} mm`,
        'Steel Stress Limit': `${sigma_st} MPa (for crack control)`,
      },
      reference: 'IS 3370 (Part II):2009 Cl. 6.1',
    });
    
    // ----- STEP 3: Water Pressure -----
    const maxPressure = gamma_w * H; // kN/m² at base
    
    steps.push({
      title: 'Step 3: Water Pressure',
      description: 'Calculate hydrostatic pressure distribution',
      formula: 'p = γ_w × H (triangular distribution)',
      values: {
        'Unit Weight of Water': `${gamma_w} kN/m³`,
        'Water Depth': `${H} m`,
        'Max Pressure at Base': `${maxPressure.toFixed(2)} kN/m²`,
      },
      reference: 'Hydraulics',
    });
    
    // ----- STEP 4: Design Forces (Rectangular Tank) -----
    let M_wall: number;      // Wall bending moment (kN·m/m)
    let T_direct: number;    // Direct tension (kN/m)
    let M_base: number;      // Base moment (kN·m/m)
    
    if (tankType === 'rectangular') {
      // Long wall design
      if (L >= B) {
        // Long wall spans horizontally, supported by short walls
        // Moment at mid-span (propped cantilever assumption)
        // Using coefficients from IS 3370 Part IV
        const coeffBM = 0.1; // Approximate BM coefficient
        M_wall = coeffBM * gamma_w * H * H * H; // kN·m/m at base (fixed)
        
        // Direct tension from water pressure
        T_direct = gamma_w * H * B / 2; // kN/m
      } else {
        M_wall = 0.1 * gamma_w * H * H * H;
        T_direct = gamma_w * H * L / 2;
      }
      
      // Base slab moment (upward water pressure when tank is full and ground water absent)
      M_base = gamma_w * H * Math.min(L, B) * Math.min(L, B) / 8;
      
      steps.push({
        title: 'Step 4: Design Forces (Rectangular)',
        description: 'Calculate bending moments and direct tension in walls',
        formula: 'M = coeff × γ_w × H³, T = γ_w × H × span / 2',
        values: {
          'Wall Moment': `${M_wall.toFixed(2)} kN·m/m`,
          'Direct Tension': `${T_direct.toFixed(2)} kN/m`,
          'Base Moment': `${M_base.toFixed(2)} kN·m/m`,
        },
        reference: 'IS 3370 (Part IV):2004',
      });
    } else {
      // Circular tank - hoop tension
      // At depth h from top: T = γ_w × h × D / 2
      T_direct = gamma_w * H * D / 2; // Maximum hoop tension at base
      M_wall = 0; // Negligible bending in circular tanks
      M_base = gamma_w * H * D * D / 64; // Circular slab moment
      
      steps.push({
        title: 'Step 4: Design Forces (Circular)',
        description: 'Calculate hoop tension in walls',
        formula: 'T = γ_w × H × D / 2 (max at base)',
        values: {
          'Max Hoop Tension': `${T_direct.toFixed(2)} kN/m`,
          'Wall Bending': `${M_wall.toFixed(2)} kN·m/m (negligible)`,
          'Base Moment': `${M_base.toFixed(2)} kN·m/m`,
        },
        reference: 'IS 3370 (Part IV):2004',
      });
    }
    
    // ----- STEP 5: Wall Reinforcement -----
    // Transformed section method for crack control
    const cover = 45; // mm (increased cover for water tightness)
    const d = wallThickness - cover - 8; // Effective depth
    
    // Modular ratio
    const m = 280 / (3 * fck);
    
    // Steel area for bending (if significant)
    let Ast_bending = 0;
    if (M_wall > 0) {
      Ast_bending = M_wall * 1e6 / (sigma_st * 0.9 * d);
    }
    
    // Steel area for direct tension
    const Ast_tension = T_direct * 1000 / sigma_st;
    
    // Combined requirement
    const Ast_wall = Ast_bending / 2 + Ast_tension; // On each face
    
    // Minimum steel (IS 3370)
    const Ast_min_wall = 0.003 * wallThickness * 1000; // 0.3% for liquid retaining
    const Ast_wall_req = Math.max(Ast_wall, Ast_min_wall);
    
    // Distribution steel (perpendicular)
    const Ast_dist = 0.002 * wallThickness * 1000; // 0.2%
    
    // Select bars
    const barDia = 12;
    const areaPerBar = Math.PI * barDia * barDia / 4;
    const wallSpacing = Math.floor(1000 * areaPerBar / (Ast_wall_req / 2)); // Per face
    const wallSpacingProvided = Math.min(Math.max(wallSpacing, 100), 150);
    
    steps.push({
      title: 'Step 5: Wall Reinforcement',
      description: 'Design steel for bending and direct tension',
      formula: 'A_st = T/(σ_st) + M/(σ_st × 0.9d)',
      values: {
        'Steel for Tension': `${Ast_tension.toFixed(0)} mm²/m`,
        'Steel for Bending': `${Ast_bending.toFixed(0)} mm²/m`,
        'Total Required': `${Ast_wall_req.toFixed(0)} mm²/m (both faces)`,
        'Main Steel': `${barDia}mm @ ${wallSpacingProvided}mm c/c (each face)`,
        'Distribution': `${barDia}mm @ 200mm c/c (vertical)`,
      },
      reference: 'IS 3370 (Part II):2009 Cl. 8',
    });
    
    codeChecks.push({
      clause: 'IS 3370 Cl. 8.1',
      description: 'Minimum steel for water tanks (0.3%)',
      required: `≥ ${Ast_min_wall.toFixed(0)} mm²/m`,
      provided: `${Ast_wall_req.toFixed(0)} mm²/m`,
      status: Ast_wall_req >= Ast_min_wall ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 6: Base Slab Design -----
    const baseThickness = Math.max(200, wallThickness + 50); // mm
    const d_base = baseThickness - cover - 8;
    
    // Steel for base
    const Ast_base = M_base * 1e6 / (sigma_st * 0.9 * d_base);
    const Ast_min_base = 0.003 * baseThickness * 1000;
    const Ast_base_req = Math.max(Ast_base, Ast_min_base);
    
    const baseSpacing = Math.floor(1000 * areaPerBar / Ast_base_req);
    const baseSpacingProvided = Math.min(Math.max(baseSpacing, 100), 150);
    
    steps.push({
      title: 'Step 6: Base Slab Design',
      description: 'Design base slab for upward pressure',
      formula: 'M_base = γ_w × H × span² / 8',
      values: {
        'Base Thickness': `${baseThickness} mm`,
        'Design Moment': `${M_base.toFixed(2)} kN·m/m`,
        'A_st Required': `${Ast_base_req.toFixed(0)} mm²/m`,
        'Bottom Steel': `${barDia}mm @ ${baseSpacingProvided}mm c/c (both ways)`,
      },
      reference: 'IS 3370 (Part II):2009',
    });
    
    // ----- STEP 7: Crack Width Check -----
    // Simplified crack width estimation
    const epsilon_st = sigma_st / 200000;
    const acr = Math.sqrt(Math.pow(wallSpacingProvided / 2, 2) + Math.pow(cover, 2)) - barDia / 2;
    const w_calc = 3 * acr * epsilon_st / (1 + 2 * acr / (wallThickness - d));
    
    const crackOk = w_calc <= crackWidthLimit;
    
    steps.push({
      title: 'Step 7: Crack Width Check',
      description: 'Verify serviceability for liquid tightness',
      formula: 'w = 3 × a_cr × ε_st / [1 + 2(a_cr)/(h-x)]',
      values: {
        'Steel Stress': `${sigma_st} MPa`,
        'Strain': epsilon_st.toExponential(4),
        'Calculated Crack Width': `${w_calc.toFixed(4)} mm`,
        'Allowable': `${crackWidthLimit} mm`,
        'Status': crackOk ? 'OK' : 'REDUCE BAR SPACING',
      },
      reference: 'IS 3370 (Part II):2009 Annex A',
    });
    
    codeChecks.push({
      clause: 'IS 3370 Annex A',
      description: 'Crack width for liquid retaining',
      required: `≤ ${crackWidthLimit} mm`,
      provided: `${w_calc.toFixed(4)} mm`,
      status: crackOk ? 'PASS' : 'FAIL',
    });
    
    if (!crackOk) {
      warnings.push('Crack width exceeds limit. Reduce bar spacing or increase wall thickness.');
    }
    
    // ----- STEP 8: Detailing Requirements -----
    steps.push({
      title: 'Step 8: Detailing Requirements',
      description: 'Additional IS 3370 requirements',
      formula: 'Construction joints, water stops, cover requirements',
      values: {
        'Min Cover': `${cover} mm (increased for durability)`,
        'Max Bar Spacing': '150 mm (for crack control)',
        'Construction Joints': 'Provide water bars at all joints',
        'Freeboard': `${freeboard} mm`,
        'Total Tank Height': `${(H * 1000 + freeboard)} mm`,
      },
      reference: 'IS 3370 (Part I):2009 Cl. 7',
    });
    
    // ----- DETERMINE OVERALL ADEQUACY -----
    const isAdequate = crackOk;
    const utilization = w_calc / crackWidthLimit;
    
    return {
      isAdequate,
      utilization,
      capacity: crackWidthLimit,
      demand: w_calc,
      status: isAdequate ? 'OK' : 'FAIL',
      message: isAdequate 
        ? `Water tank design adequate. Wall: ${wallThickness}mm thick with ${barDia}mm @ ${wallSpacingProvided}mm c/c`
        : 'Design needs revision for crack control.',
      steps,
      codeChecks,
      warnings,
      dimensions: {
        internalLength: length,
        internalWidth: width,
        totalHeight: waterDepth + freeboard,
        wallThickness,
        baseThickness,
      },
      pressures: {
        maxWaterPressure: maxPressure,
      },
      wallDesign: {
        moment: M_wall,
        directTension: T_direct,
        steelArea: Ast_wall_req,
        distribution: Ast_dist,
      },
      baseDesign: {
        moment: M_base,
        steelArea: Ast_base_req,
      },
    };
  }
}

export const waterTankDesignEngine = new WaterTankDesignEngine();
