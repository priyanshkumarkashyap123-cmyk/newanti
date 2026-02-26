/**
 * ============================================================================
 * FLAT SLAB DESIGN ENGINE
 * ============================================================================
 * 
 * RC Flat Slab Design per IS 456:2000 and ACI 318
 * Direct Design Method (DDM) and Equivalent Frame Method concepts
 * Includes drop panels and column capitals
 * 
 * @version 1.0.0
 */

import { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface FlatSlabDesignInput {
  // Panel Geometry
  spanX: number;            // mm - span in X direction (L1)
  spanY: number;            // mm - span in Y direction (L2)
  slabThickness: number;    // mm
  
  // Column
  columnSize: number;       // mm - square column dimension
  
  // Drop Panel (optional)
  hasDropPanel: boolean;
  dropPanelWidth?: number;  // mm - width (must be ≥ L/3)
  dropPanelDepth?: number;  // mm - projection below slab
  
  // Column Capital (optional)
  hasColumnCapital: boolean;
  capitalDiameter?: number; // mm
  capitalDepth?: number;    // mm
  
  // Materials
  fck: number;              // MPa
  fy: number;               // MPa
  
  // Loading
  liveLoad: number;         // kN/m² - unfactored
  superimposedDL: number;   // kN/m² - finishes, partitions
  
  // Options
  panelType: 'interior' | 'exterior_edge' | 'exterior_corner';
  designCode: 'IS456' | 'ACI318';
}

export interface FlatSlabDesignResult extends CalculationResult {
  geometry: {
    effectiveDepth: number;
    columnStrip: { width: number };
    middleStrip: { width: number };
    clearSpan: { Lnx: number; Lny: number };
  };
  moments: {
    totalMoment: number;
    negativeMoment: number;
    positiveMoment: number;
    columnStripNegative: number;
    columnStripPositive: number;
    middleStripNegative: number;
    middleStripPositive: number;
  };
  reinforcement: {
    columnStripTop: { area: number; diameter: number; spacing: number };
    columnStripBottom: { area: number; diameter: number; spacing: number };
    middleStripTop: { area: number; diameter: number; spacing: number };
    middleStripBottom: { area: number; diameter: number; spacing: number };
  };
}

// ============================================================================
// FLAT SLAB DESIGN CALCULATOR
// ============================================================================

export class FlatSlabDesignEngine {
  
  /**
   * Design flat slab using Direct Design Method
   */
  calculate(input: FlatSlabDesignInput): FlatSlabDesignResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    const { spanX, spanY, slabThickness, columnSize, fck, fy, liveLoad, superimposedDL, panelType, designCode } = input;
    
    const L1 = Math.max(spanX, spanY); // Longer span
    const L2 = Math.min(spanX, spanY); // Shorter span
    const h = slabThickness;
    const c = columnSize;
    
    // ----- STEP 1: Check DDM Applicability -----
    // IS 456 Cl. 31.4.1 / ACI 318 Cl. 8.10.2
    const spanRatio = L1 / L2;
    const minSpans = 3; // Minimum 3 continuous spans
    const ddmApplicable = spanRatio <= 2.0;
    
    steps.push({
      title: 'Step 1: Direct Design Method Applicability',
      description: 'Verify conditions for DDM application',
      formula: 'L_longer / L_shorter ≤ 2.0',
      values: {
        'Longer Span (L1)': `${L1} mm`,
        'Shorter Span (L2)': `${L2} mm`,
        'Span Ratio': spanRatio.toFixed(2),
        'DDM Applicable': ddmApplicable ? 'YES' : 'NO - Use Equivalent Frame Method',
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 31.4.1' : 'ACI 318-19 Cl. 8.10.2',
    });
    
    if (!ddmApplicable) {
      warnings.push('Span ratio > 2.0. Equivalent Frame Method recommended for more accurate analysis.');
    }
    
    // ----- STEP 2: Effective Depth and Clear Spans -----
    const cover = 20;
    const barDia = 12;
    const d = h - cover - barDia / 2;
    
    // Clear spans
    const Lnx = spanX - c; // Clear span in X
    const Lny = spanY - c; // Clear span in Y
    const Ln = Math.max(Lnx, Lny); // Longer clear span
    
    // Check minimum slab thickness
    let h_min: number;
    if (input.hasDropPanel) {
      h_min = Ln / 36;
    } else {
      h_min = Ln / 30;
    }
    
    steps.push({
      title: 'Step 2: Geometry and Minimum Thickness',
      description: 'Calculate clear spans and verify slab thickness',
      formula: input.hasDropPanel ? 'h_min = L_n / 36 (with drop)' : 'h_min = L_n / 30 (without drop)',
      values: {
        'Slab Thickness': `${h} mm`,
        'Effective Depth (d)': `${d.toFixed(0)} mm`,
        'Clear Span X': `${Lnx} mm`,
        'Clear Span Y': `${Lny} mm`,
        'Minimum Thickness': `${h_min.toFixed(0)} mm`,
        'Status': h >= h_min ? 'OK' : 'INCREASE THICKNESS',
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 31.2' : 'ACI 318-19 Cl. 8.3.1',
    });
    
    codeChecks.push({
      clause: designCode === 'IS456' ? 'IS 456 Cl. 31.2' : 'ACI 318 Cl. 8.3.1',
      description: 'Minimum slab thickness',
      required: `≥ ${h_min.toFixed(0)} mm`,
      provided: `${h} mm`,
      status: h >= h_min ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 3: Strip Widths -----
    // Column strip: width = 0.5L2 on each side of column centerline, limited to 0.25L1
    const halfColumnStrip = Math.min(L2 / 4, L1 / 4);
    const columnStripWidth = 2 * halfColumnStrip;
    const middleStripWidth = L2 - columnStripWidth;
    
    // Drop panel verification (if present)
    if (input.hasDropPanel) {
      const minDropWidth = L2 / 3;
      if (input.dropPanelWidth && input.dropPanelWidth < minDropWidth) {
        warnings.push(`Drop panel width (${input.dropPanelWidth}mm) < L2/3 (${minDropWidth.toFixed(0)}mm)`);
      }
      const minDropProjection = h / 4;
      if (input.dropPanelDepth && input.dropPanelDepth < minDropProjection) {
        warnings.push(`Drop panel projection (${input.dropPanelDepth}mm) < h/4 (${minDropProjection.toFixed(0)}mm)`);
      }
    }
    
    steps.push({
      title: 'Step 3: Strip Widths Definition',
      description: 'Define column strip and middle strip',
      formula: 'Column strip width = 2 × min(L2/4, L1/4)',
      values: {
        'Column Strip Width': `${columnStripWidth} mm`,
        'Middle Strip Width': `${middleStripWidth} mm`,
        'Drop Panel': input.hasDropPanel ? `${input.dropPanelWidth} × ${input.dropPanelDepth} mm` : 'None',
        'Column Capital': input.hasColumnCapital ? `Ø${input.capitalDiameter} mm` : 'None',
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 31.1.2' : 'ACI 318-19 Cl. 8.4.1',
    });
    
    // ----- STEP 4: Total Design Load -----
    const selfWeight = (h / 1000) * 25; // kN/m² (concrete density 25 kN/m³)
    const totalDL = selfWeight + superimposedDL;
    const totalLL = liveLoad;
    const factoredLoad = 1.5 * totalDL + 1.5 * totalLL; // IS 456 load factors
    
    steps.push({
      title: 'Step 4: Design Load',
      description: 'Calculate factored design load',
      formula: 'w_u = 1.5 × (DL + SDL) + 1.5 × LL',
      values: {
        'Self Weight': `${selfWeight.toFixed(2)} kN/m²`,
        'Superimposed DL': `${superimposedDL.toFixed(2)} kN/m²`,
        'Live Load': `${totalLL.toFixed(2)} kN/m²`,
        'Factored Load (w_u)': `${factoredLoad.toFixed(2)} kN/m²`,
      },
      reference: 'IS 456:2000 Cl. 36.4',
    });
    
    // ----- STEP 5: Total Static Moment -----
    // M_o = w_u × L2 × Ln² / 8
    const Mo = factoredLoad * (L2 / 1000) * Math.pow(Ln / 1000, 2) / 8;
    
    steps.push({
      title: 'Step 5: Total Static Moment',
      description: 'Calculate total design moment for the span',
      formula: 'M_o = w_u × L2 × L_n² / 8',
      values: {
        'Factored Load': `${factoredLoad.toFixed(2)} kN/m²`,
        'Transverse Span (L2)': `${L2} mm`,
        'Clear Span (L_n)': `${Ln} mm`,
        'Total Static Moment (M_o)': `${Mo.toFixed(2)} kN·m`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 31.4.2' : 'ACI 318-19 Cl. 8.10.3',
    });
    
    // ----- STEP 6: Moment Distribution -----
    // Negative and positive moment factors (Interior panel)
    let negFactor: number;
    let posFactor: number;
    
    if (panelType === 'interior') {
      negFactor = 0.65;
      posFactor = 0.35;
    } else if (panelType === 'exterior_edge') {
      // Exterior span without edge beam
      negFactor = 0.70; // At first interior support
      posFactor = 0.50;
    } else { // corner
      negFactor = 0.65;
      posFactor = 0.35;
    }
    
    const M_neg = negFactor * Mo;
    const M_pos = posFactor * Mo;
    
    // Column strip percentages (interior panel without beams)
    const colStripNegPct = 0.75; // 75% of negative moment to column strip
    const colStripPosPct = 0.60; // 60% of positive moment to column strip
    
    const M_cs_neg = colStripNegPct * M_neg;
    const M_cs_pos = colStripPosPct * M_pos;
    const M_ms_neg = (1 - colStripNegPct) * M_neg;
    const M_ms_pos = (1 - colStripPosPct) * M_pos;
    
    steps.push({
      title: 'Step 6: Moment Distribution',
      description: 'Distribute moments to column and middle strips',
      formula: 'M_neg = 0.65×M_o, M_pos = 0.35×M_o (interior)',
      values: {
        'Negative Moment': `${M_neg.toFixed(2)} kN·m (${(negFactor * 100).toFixed(0)}%)`,
        'Positive Moment': `${M_pos.toFixed(2)} kN·m (${(posFactor * 100).toFixed(0)}%)`,
        'Column Strip Negative': `${M_cs_neg.toFixed(2)} kN·m (${(colStripNegPct * 100).toFixed(0)}%)`,
        'Column Strip Positive': `${M_cs_pos.toFixed(2)} kN·m (${(colStripPosPct * 100).toFixed(0)}%)`,
        'Middle Strip Negative': `${M_ms_neg.toFixed(2)} kN·m`,
        'Middle Strip Positive': `${M_ms_pos.toFixed(2)} kN·m`,
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 31.4.3' : 'ACI 318-19 Table 8.10.5.2',
    });
    
    // ----- STEP 7: Reinforcement Design -----
    // Helper function to calculate steel area
    const calcSteel = (M: number, width: number, depth: number): number => {
      const Mu_max = 0.138 * fck * width * depth * depth / 1e6;
      if (M > Mu_max) {
        warnings.push(`Moment ${M.toFixed(1)} kN·m exceeds singly reinforced limit. Consider increasing depth.`);
      }
      const term = 4.6 * M * 1e6 / (fck * width * depth * depth);
      if (term > 1) return width * depth * 0.01; // 1% as fallback
      const Ast = 0.5 * (fck / fy) * (1 - Math.sqrt(1 - term)) * width * depth;
      // Minimum steel 0.12%
      const Ast_min = 0.0012 * width * h;
      return Math.max(Ast, Ast_min);
    };
    
    // Effective depth for drop panel region
    const d_drop = input.hasDropPanel && input.dropPanelDepth 
      ? d + input.dropPanelDepth 
      : d;
    
    // Calculate steel for each strip
    const Ast_cs_top = calcSteel(M_cs_neg, columnStripWidth, d_drop);
    const Ast_cs_bot = calcSteel(M_cs_pos, columnStripWidth, d);
    const Ast_ms_top = calcSteel(M_ms_neg, middleStripWidth, d);
    const Ast_ms_bot = calcSteel(M_ms_pos, middleStripWidth, d);
    
    // Select reinforcement
    const selectReinf = (Ast: number, width: number) => {
      const barDiameters = [10, 12, 16, 20];
      for (const dia of barDiameters) {
        const areaPerBar = Math.PI * dia * dia / 4;
        const numBars = Math.ceil(Ast / areaPerBar);
        const spacing = Math.floor(width / numBars);
        if (spacing >= 75 && spacing <= 300) {
          return { area: numBars * areaPerBar, diameter: dia, spacing };
        }
      }
      // Default to 12mm
      const spacing = Math.floor(width * Math.PI * 144 / (4 * Ast));
      return { area: Ast, diameter: 12, spacing: Math.max(75, Math.min(spacing, 300)) };
    };
    
    const reinf_cs_top = selectReinf(Ast_cs_top, columnStripWidth);
    const reinf_cs_bot = selectReinf(Ast_cs_bot, columnStripWidth);
    const reinf_ms_top = selectReinf(Ast_ms_top, middleStripWidth);
    const reinf_ms_bot = selectReinf(Ast_ms_bot, middleStripWidth);
    
    steps.push({
      title: 'Step 7: Reinforcement Design',
      description: 'Calculate steel area for each strip',
      formula: 'A_st = 0.5 × (fck/fy) × [1 - √(1 - 4.6M/(fck×b×d²))] × b × d',
      values: {
        'Column Strip Top': `${Ast_cs_top.toFixed(0)} mm² → ${reinf_cs_top.diameter}mm @ ${reinf_cs_top.spacing}mm`,
        'Column Strip Bottom': `${Ast_cs_bot.toFixed(0)} mm² → ${reinf_cs_bot.diameter}mm @ ${reinf_cs_bot.spacing}mm`,
        'Middle Strip Top': `${Ast_ms_top.toFixed(0)} mm² → ${reinf_ms_top.diameter}mm @ ${reinf_ms_top.spacing}mm`,
        'Middle Strip Bottom': `${Ast_ms_bot.toFixed(0)} mm² → ${reinf_ms_bot.diameter}mm @ ${reinf_ms_bot.spacing}mm`,
      },
      reference: 'IS 456:2000 Cl. 31.5',
    });
    
    // ----- STEP 8: Punching Shear Check -----
    // Check at d/2 from column face
    const punchingPerimeter = 4 * (c + d);
    const punchingArea = factoredLoad * (L1 / 1000) * (L2 / 1000);
    const Vu = punchingArea - factoredLoad * Math.pow((c + d) / 1000, 2);
    const tau_v = (Vu * 1000) / (punchingPerimeter * d);
    
    // Allowable punching shear stress
    const ks = Math.min(1, 0.5 + 1); // βc = 1 for square column
    const tau_c = ks * 0.25 * Math.sqrt(fck);
    
    const punchingOk = tau_v <= tau_c;
    
    steps.push({
      title: 'Step 8: Punching Shear Check',
      description: 'Verify punching shear at critical section',
      formula: 'τ_v = V_u / (b_o × d) ≤ k_s × 0.25√fck',
      values: {
        'Critical Perimeter (b_o)': `${punchingPerimeter} mm`,
        'Punching Shear (V_u)': `${Vu.toFixed(2)} kN`,
        'Shear Stress (τ_v)': `${tau_v.toFixed(3)} MPa`,
        'Allowable (τ_c)': `${tau_c.toFixed(3)} MPa`,
        'Status': punchingOk ? 'OK' : 'ADD DROP PANEL OR INCREASE SLAB',
      },
      reference: designCode === 'IS456' ? 'IS 456:2000 Cl. 31.6' : 'ACI 318-19 Cl. 22.6',
    });
    
    codeChecks.push({
      clause: designCode === 'IS456' ? 'IS 456 Cl. 31.6' : 'ACI 318 Cl. 22.6',
      description: 'Punching shear',
      required: `≤ ${tau_c.toFixed(3)} MPa`,
      provided: `${tau_v.toFixed(3)} MPa`,
      status: punchingOk ? 'PASS' : 'FAIL',
    });
    
    if (!punchingOk) {
      warnings.push('Punching shear inadequate. Consider: (1) Add/enlarge drop panel, (2) Add column capital, (3) Increase slab thickness, (4) Add shear reinforcement');
    }
    
    // ----- DETERMINE OVERALL ADEQUACY -----
    const isAdequate = h >= h_min && punchingOk;
    const utilization = Math.max(h_min / h, tau_v / tau_c);
    
    return {
      isAdequate,
      utilization,
      capacity: tau_c * punchingPerimeter * d / 1000,
      demand: Vu,
      status: isAdequate ? 'OK' : 'FAIL',
      message: isAdequate 
        ? `Flat slab design adequate. Total moment M_o = ${Mo.toFixed(1)} kN·m.`
        : 'Design inadequate. Review thickness and punching shear.',
      steps,
      codeChecks,
      warnings,
      geometry: {
        effectiveDepth: d,
        columnStrip: { width: columnStripWidth },
        middleStrip: { width: middleStripWidth },
        clearSpan: { Lnx, Lny },
      },
      moments: {
        totalMoment: Mo,
        negativeMoment: M_neg,
        positiveMoment: M_pos,
        columnStripNegative: M_cs_neg,
        columnStripPositive: M_cs_pos,
        middleStripNegative: M_ms_neg,
        middleStripPositive: M_ms_pos,
      },
      reinforcement: {
        columnStripTop: reinf_cs_top,
        columnStripBottom: reinf_cs_bot,
        middleStripTop: reinf_ms_top,
        middleStripBottom: reinf_ms_bot,
      },
    };
  }
}

export const flatSlabDesignEngine = new FlatSlabDesignEngine();
