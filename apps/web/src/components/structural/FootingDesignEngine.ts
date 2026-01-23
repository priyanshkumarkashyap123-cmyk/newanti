/**
 * ============================================================================
 * FOOTING DESIGN ENGINE
 * ============================================================================
 * 
 * Isolated and Combined Footing Design per IS 456:2000
 * Includes bearing check, punching shear, one-way shear, and flexure
 * 
 * @version 1.0.0
 */

import { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface FootingDesignInput {
  // Column Properties
  columnWidth: number;      // mm (Cx)
  columnDepth: number;      // mm (Cy)
  
  // Loading (Service Load - Unfactored)
  axialLoad: number;        // kN
  momentX?: number;         // kN·m (about X-axis)
  momentY?: number;         // kN·m (about Y-axis)
  
  // Soil Properties
  bearingCapacity: number;  // kN/m² - safe bearing capacity
  soilDensity: number;      // kN/m³
  foundationDepth: number;  // mm - depth below ground
  
  // Materials
  fck: number;              // MPa
  fy: number;               // MPa
  
  // Options
  footingType: 'isolated_square' | 'isolated_rectangular' | 'combined';
  minCover: number;         // mm
}

export interface FootingDesignResult extends CalculationResult {
  dimensions: {
    length: number;         // mm (L)
    width: number;          // mm (B)
    depth: number;          // mm (D)
    effectiveDepth: number; // mm (d)
  };
  pressures: {
    grossPressure: number;  // kN/m²
    netPressure: number;    // kN/m²
    maxPressure: number;    // kN/m²
    minPressure: number;    // kN/m²
  };
  reinforcement: {
    alongLength: { area: number; diameter: number; spacing: number };
    alongWidth: { area: number; diameter: number; spacing: number };
  };
  shearChecks: {
    oneWayShear: { stress: number; capacity: number; ok: boolean };
    twoWayShear: { stress: number; capacity: number; ok: boolean };
  };
}

// ============================================================================
// FOOTING DESIGN CALCULATOR
// ============================================================================

export class FootingDesignEngine {
  
  /**
   * Design isolated footing
   */
  calculate(input: FootingDesignInput): FootingDesignResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    const { columnWidth, columnDepth, axialLoad, momentX = 0, momentY = 0, bearingCapacity, soilDensity, foundationDepth, fck, fy, footingType, minCover } = input;
    
    const Cx = columnWidth;
    const Cy = columnDepth;
    const P = axialLoad;
    const Mx = momentX;
    const My = momentY;
    const qa = bearingCapacity;
    const gamma_s = soilDensity;
    const Df = foundationDepth / 1000; // m
    
    // ----- STEP 1: Determine Footing Size -----
    // Net allowable bearing (deduct self-weight and overburden)
    const gamma_c = 25; // kN/m³
    const assumedFootingDepth = 0.5; // m (initial assumption)
    const selfWeightAllowance = 0.1 * P; // 10% of column load for footing self-weight
    
    const qn = qa - gamma_s * Df - gamma_c * assumedFootingDepth;
    
    // Required area
    const A_req = (P + selfWeightAllowance) / qn; // m²
    
    // Determine dimensions
    let L: number; // mm
    let B: number; // mm
    
    if (footingType === 'isolated_square') {
      const side = Math.sqrt(A_req) * 1000;
      L = Math.ceil(side / 100) * 100; // Round up to nearest 100mm
      B = L;
    } else {
      // Rectangular - use column aspect ratio
      const ratio = Cx / Cy;
      B = Math.sqrt(A_req / ratio) * 1000;
      L = ratio * B;
      B = Math.ceil(B / 100) * 100;
      L = Math.ceil(L / 100) * 100;
    }
    
    steps.push({
      title: 'Step 1: Footing Size',
      description: 'Determine plan dimensions based on bearing capacity',
      formula: 'A_req = (P + self weight) / q_net',
      values: {
        'Service Load (P)': `${P.toFixed(2)} kN`,
        'Safe Bearing (q_a)': `${qa} kN/m²`,
        'Net Bearing (q_n)': `${qn.toFixed(2)} kN/m²`,
        'Required Area': `${A_req.toFixed(3)} m²`,
        'Footing Size': `${L} × ${B} mm`,
        'Provided Area': `${(L * B / 1e6).toFixed(3)} m²`,
      },
      reference: 'IS 456:2000 & Foundation Engineering',
    });
    
    // ----- STEP 2: Base Pressure Distribution -----
    const A = L * B / 1e6; // m²
    const Zx = (L / 1000) * Math.pow(B / 1000, 2) / 6; // Section modulus about X
    const Zy = (B / 1000) * Math.pow(L / 1000, 2) / 6; // Section modulus about Y
    
    // Service pressures (for size check)
    const q_avg = P / A;
    const q_max = P / A + Mx / Zx + My / Zy;
    const q_min = P / A - Mx / Zx - My / Zy;
    
    // Check for tension
    if (q_min < 0) {
      warnings.push('Negative pressure (tension) at edge. Eccentricity too large. Increase footing size.');
    }
    
    steps.push({
      title: 'Step 2: Base Pressure Check',
      description: 'Verify bearing pressure under service loads',
      formula: 'q = P/A ± M_x/Z_x ± M_y/Z_y',
      values: {
        'Average Pressure': `${q_avg.toFixed(2)} kN/m²`,
        'Maximum Pressure': `${q_max.toFixed(2)} kN/m²`,
        'Minimum Pressure': `${q_min.toFixed(2)} kN/m²`,
        'Allowable': `${qa} kN/m²`,
        'Status': q_max <= qa ? 'OK' : 'INCREASE SIZE',
      },
      reference: 'Foundation Engineering',
    });
    
    codeChecks.push({
      clause: 'Bearing',
      description: 'Max bearing pressure',
      required: `≤ ${qa} kN/m²`,
      provided: `${q_max.toFixed(2)} kN/m²`,
      status: q_max <= qa ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 3: Factored Design -----
    // Factored load
    const Pu = 1.5 * P;
    const Mux = 1.5 * Mx;
    const Muy = 1.5 * My;
    
    // Net upward pressure for design (uniform for simplicity)
    const qu_net = Pu / A; // kN/m² (factored net upward)
    
    steps.push({
      title: 'Step 3: Factored Design Load',
      description: 'Calculate factored loads and net upward pressure',
      formula: 'P_u = 1.5 × P, q_u = P_u / A',
      values: {
        'Factored Load (P_u)': `${Pu.toFixed(2)} kN`,
        'Factored M_x': `${Mux.toFixed(2)} kN·m`,
        'Factored M_y': `${Muy.toFixed(2)} kN·m`,
        'Net Upward Pressure (q_u)': `${qu_net.toFixed(2)} kN/m²`,
      },
      reference: 'IS 456:2000 Cl. 36.4',
    });
    
    // ----- STEP 4: Depth for One-Way Shear -----
    // Critical section at d from column face
    // Projection beyond column face
    const projectionL = (L - Cx) / 2; // mm
    const projectionB = (B - Cy) / 2; // mm
    
    // One-way shear check (longer projection governs)
    const maxProjection = Math.max(projectionL, projectionB);
    
    // Assume depth and iterate
    let D = 500; // Initial assumption (mm)
    let d = D - minCover - 8; // Effective depth
    
    // Shear at d from column face
    const shearLength = maxProjection - d; // mm
    
    // Allowable shear stress (IS 456 Table 19)
    const pt_assumed = 0.25; // Assume 0.25% steel
    const tau_c = 0.36 * Math.pow(fck, 0.5) * Math.pow(pt_assumed, 1/3); // Simplified
    const tau_c_design = Math.min(tau_c, 0.4); // Conservative
    
    // Required depth for one-way shear
    // Vu = qu × B × (projection - d) = tau_c × B × d
    // d² + d × (projection) = qu × B × projection / (tau_c × B)
    // Simplified: d = qu × shearLength / tau_c
    
    // Iterate to find d
    for (let i = 0; i < 5; i++) {
      const Vu_oneway = qu_net * (B / 1000) * Math.max(0, (maxProjection - d) / 1000); // kN
      const tau_v = (Vu_oneway * 1000) / (B * d);
      if (tau_v <= tau_c_design) break;
      d = Vu_oneway * 1000 / (B * tau_c_design);
      D = d + minCover + 8;
    }
    
    D = Math.ceil(D / 50) * 50; // Round up to 50mm
    d = D - minCover - 8;
    
    // Final one-way shear check
    const Vu_oneway_final = qu_net * (B / 1000) * Math.max(0, (maxProjection - d) / 1000);
    const tau_v_oneway = (Vu_oneway_final * 1000) / (B * d);
    const oneWayOk = tau_v_oneway <= tau_c_design;
    
    steps.push({
      title: 'Step 4: One-Way Shear',
      description: 'Check beam shear at d from column face',
      formula: 'V_u = q_u × B × (projection - d), τ_v = V_u / (B × d)',
      values: {
        'Footing Depth (D)': `${D} mm`,
        'Effective Depth (d)': `${d} mm`,
        'Critical Section': `${d} mm from column face`,
        'Shear Force (V_u)': `${Vu_oneway_final.toFixed(2)} kN`,
        'Shear Stress (τ_v)': `${tau_v_oneway.toFixed(3)} MPa`,
        'Allowable (τ_c)': `${tau_c_design.toFixed(3)} MPa`,
        'Status': oneWayOk ? 'OK' : 'INCREASE DEPTH',
      },
      reference: 'IS 456:2000 Cl. 34.2.4',
    });
    
    codeChecks.push({
      clause: 'IS 456 Cl. 34.2.4',
      description: 'One-way shear',
      required: `≤ ${tau_c_design.toFixed(3)} MPa`,
      provided: `${tau_v_oneway.toFixed(3)} MPa`,
      status: oneWayOk ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 5: Two-Way (Punching) Shear -----
    // Critical section at d/2 from column face
    const b0 = 2 * (Cx + d) + 2 * (Cy + d); // Critical perimeter
    const Ac = b0 * d;
    
    // Punching shear force
    const punchingArea = (Cx + d) * (Cy + d) / 1e6; // m²
    const Vu_punching = Pu - qu_net * punchingArea;
    
    // Punching shear stress
    const tau_v_punching = (Vu_punching * 1000) / Ac;
    
    // Allowable punching shear (IS 456 Cl. 31.6.3)
    const ks = Math.min(1, 0.5 + Cx / Cy);
    const tau_c_punching = ks * 0.25 * Math.sqrt(fck);
    
    const twoWayOk = tau_v_punching <= tau_c_punching;
    
    steps.push({
      title: 'Step 5: Two-Way (Punching) Shear',
      description: 'Check punching shear at d/2 from column face',
      formula: 'V_u = P_u - q_u × punching area, τ_v = V_u / (b_0 × d)',
      values: {
        'Critical Perimeter (b_0)': `${b0} mm`,
        'Punching Shear (V_u)': `${Vu_punching.toFixed(2)} kN`,
        'Shear Stress (τ_v)': `${tau_v_punching.toFixed(3)} MPa`,
        'k_s Factor': ks.toFixed(3),
        'Allowable (τ_c)': `${tau_c_punching.toFixed(3)} MPa`,
        'Status': twoWayOk ? 'OK' : 'INCREASE DEPTH',
      },
      reference: 'IS 456:2000 Cl. 31.6.3',
    });
    
    codeChecks.push({
      clause: 'IS 456 Cl. 31.6.3',
      description: 'Two-way (punching) shear',
      required: `≤ ${tau_c_punching.toFixed(3)} MPa`,
      provided: `${tau_v_punching.toFixed(3)} MPa`,
      status: twoWayOk ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 6: Flexural Design -----
    // Moment at column face (cantilever moment)
    // Along length (moment about X-axis)
    const M_L = qu_net * (B / 1000) * Math.pow(projectionL / 1000, 2) / 2; // kN·m
    
    // Along width (moment about Y-axis)
    const M_B = qu_net * (L / 1000) * Math.pow(projectionB / 1000, 2) / 2; // kN·m
    
    // Steel along length (resist M_L)
    const Ast_L = M_L * 1e6 / (0.87 * fy * 0.9 * d);
    const Ast_min = 0.0012 * B * D; // Min steel 0.12% of gross area
    const Ast_L_req = Math.max(Ast_L, Ast_min);
    
    // Steel along width (resist M_B)
    const Ast_B = M_B * 1e6 / (0.87 * fy * 0.9 * d);
    const Ast_B_req = Math.max(Ast_B, Ast_min);
    
    // Select reinforcement
    const selectReinf = (Ast: number, width: number) => {
      const barDiameters = [12, 16, 20, 25];
      for (const dia of barDiameters) {
        const areaPerBar = Math.PI * dia * dia / 4;
        const numBars = Math.ceil(Ast / areaPerBar);
        const spacing = Math.floor(width / numBars);
        if (spacing >= 100 && spacing <= 300) {
          return { area: numBars * areaPerBar, diameter: dia, spacing };
        }
      }
      return { area: Ast, diameter: 16, spacing: 150 };
    };
    
    const reinf_L = selectReinf(Ast_L_req, B);
    const reinf_B = selectReinf(Ast_B_req, L);
    
    steps.push({
      title: 'Step 6: Flexural Design',
      description: 'Calculate bending reinforcement',
      formula: 'M = q_u × width × projection² / 2',
      values: {
        'Moment along L': `${M_L.toFixed(2)} kN·m`,
        'Moment along B': `${M_B.toFixed(2)} kN·m`,
        'A_st along L': `${Ast_L_req.toFixed(0)} mm² → ${reinf_L.diameter}mm @ ${reinf_L.spacing}mm`,
        'A_st along B': `${Ast_B_req.toFixed(0)} mm² → ${reinf_B.diameter}mm @ ${reinf_B.spacing}mm`,
      },
      reference: 'IS 456:2000 Cl. 34.2.3',
    });
    
    // ----- STEP 7: Development Length Check -----
    const Ld = (0.87 * fy * reinf_L.diameter) / (4 * 1.6 * Math.sqrt(fck));
    const availableLength = projectionL - minCover;
    
    steps.push({
      title: 'Step 7: Development Length',
      description: 'Check bar anchorage length',
      formula: 'L_d = 0.87 × fy × φ / (4 × τ_bd)',
      values: {
        'Development Length (L_d)': `${Ld.toFixed(0)} mm`,
        'Available Length': `${availableLength.toFixed(0)} mm`,
        'Status': availableLength >= Ld ? 'OK' : 'PROVIDE BENT-UP BARS',
      },
      reference: 'IS 456:2000 Cl. 26.2',
    });
    
    if (availableLength < Ld) {
      warnings.push('Development length not available. Provide bent-up bars or hooks.');
    }
    
    // ----- DETERMINE OVERALL ADEQUACY -----
    const isAdequate = q_max <= qa && oneWayOk && twoWayOk;
    const utilization = Math.max(q_max / qa, tau_v_oneway / tau_c_design, tau_v_punching / tau_c_punching);
    
    return {
      isAdequate,
      utilization,
      capacity: qa,
      demand: q_max,
      status: isAdequate ? 'OK' : 'FAIL',
      message: isAdequate 
        ? `Footing design adequate. Size: ${L}×${B}×${D}mm. Max pressure: ${q_max.toFixed(1)} kN/m²`
        : 'Design inadequate. Review bearing/shear checks.',
      steps,
      codeChecks,
      warnings,
      dimensions: {
        length: L,
        width: B,
        depth: D,
        effectiveDepth: d,
      },
      pressures: {
        grossPressure: q_max,
        netPressure: qu_net,
        maxPressure: q_max,
        minPressure: q_min,
      },
      reinforcement: {
        alongLength: reinf_L,
        alongWidth: reinf_B,
      },
      shearChecks: {
        oneWayShear: { stress: tau_v_oneway, capacity: tau_c_design, ok: oneWayOk },
        twoWayShear: { stress: tau_v_punching, capacity: tau_c_punching, ok: twoWayOk },
      },
    };
  }
}

export const footingDesignEngine = new FootingDesignEngine();
