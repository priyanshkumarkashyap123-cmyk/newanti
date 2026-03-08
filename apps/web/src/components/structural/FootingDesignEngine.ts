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
  bearingCapacity: number;  // kN/m² - safe bearing capacity (used if frictionAngle not given)
  soilDensity: number;      // kN/m³
  foundationDepth: number;  // mm - depth below ground
  frictionAngle?: number;   // degrees — soil friction angle φ (triggers Meyerhof computation)
  cohesion?: number;        // kN/m² — soil cohesion c
  elasticModulus?: number;  // kN/m² — soil elastic modulus E_s (for settlement)
  poissonRatio?: number;    // Poisson's ratio μ (default 0.3)
  horizontalLoad?: number;  // kN — horizontal load for inclination factors per IS 6403
  
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

// IS 456 Table 19 — Design shear strength τc (N/mm²)
const TABLE_19_PT = [0.15, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00];
const TABLE_19_DATA: Record<number, number[]> = {
  15: [0.28, 0.35, 0.46, 0.54, 0.60, 0.64, 0.68, 0.71, 0.71, 0.71, 0.71, 0.71, 0.71],
  20: [0.28, 0.36, 0.48, 0.56, 0.62, 0.67, 0.72, 0.75, 0.79, 0.81, 0.82, 0.82, 0.82],
  25: [0.29, 0.36, 0.49, 0.57, 0.64, 0.70, 0.74, 0.78, 0.82, 0.85, 0.88, 0.90, 0.92],
  30: [0.29, 0.37, 0.50, 0.59, 0.66, 0.71, 0.76, 0.80, 0.84, 0.88, 0.91, 0.94, 0.96],
  35: [0.29, 0.37, 0.50, 0.59, 0.67, 0.73, 0.78, 0.82, 0.86, 0.90, 0.93, 0.96, 0.99],
  40: [0.30, 0.38, 0.51, 0.60, 0.68, 0.74, 0.79, 0.84, 0.88, 0.92, 0.95, 0.98, 1.01],
};

function lerpVal(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

/** IS 456 Table 19 interpolated τc */
function getTauC_IS456(pt: number, fck: number): number {
  const ptClamped = Math.max(0.15, Math.min(pt, 3.0));
  const fcks = [15, 20, 25, 30, 35, 40];
  const fckLow = fcks.reduce((p, c) => c <= fck ? c : p, 15);
  const fckHigh = fcks.find(g => g >= fck) ?? 40;
  let ptIdx = 0;
  for (let i = 0; i < TABLE_19_PT.length - 1; i++) {
    if (ptClamped >= TABLE_19_PT[i] && ptClamped <= TABLE_19_PT[i + 1]) { ptIdx = i; break; }
    if (i === TABLE_19_PT.length - 2) ptIdx = i;
  }
  const p0 = TABLE_19_PT[ptIdx], p1 = TABLE_19_PT[ptIdx + 1];
  const tL = lerpVal(ptClamped, p0, p1, TABLE_19_DATA[fckLow][ptIdx], TABLE_19_DATA[fckLow][ptIdx + 1]);
  if (fckLow === fckHigh) return tL;
  const tH = lerpVal(ptClamped, p0, p1, TABLE_19_DATA[fckHigh][ptIdx], TABLE_19_DATA[fckHigh][ptIdx + 1]);
  return lerpVal(fck, fckLow, fckHigh, tL, tH);
}

/** Meyerhof bearing capacity factors — φ in degrees */
function getMeyerhofFactors(phi: number): { Nc: number; Nq: number; Ngamma: number } {
  const phiRad = phi * Math.PI / 180;
  const Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
  const Nc = (Nq - 1) / Math.tan(phiRad + 1e-10);
  const Ngamma = 2 * (Nq + 1) * Math.tan(phiRad);
  return { Nc, Nq, Ngamma };
}

/** Depth correction factors (Meyerhof 1963) */
function getDepthFactors(Df_m: number, B_m: number): { dc: number; dq: number; dgamma: number } {
  const ratio = Df_m / B_m;
  const dc = 1 + 0.4 * ratio;
  const dq = 1 + 2 * Math.tan(Math.PI / 4) * Math.pow(1 - Math.sin(Math.PI / 4), 2) * ratio;
  const dgamma = 1;
  return { dc, dq, dgamma };
}

/** Shape correction factors for rectangular footings */
function getShapeFactors(L_m: number, B_m: number, Nq: number, Nc: number): { sc: number; sq: number; sgamma: number } {
  const sc = 1 + (B_m / L_m) * (Nq / Nc);
  const sq = 1 + (B_m / L_m) * Math.tan(Math.PI / 6); // For φ ~ 30
  const sgamma = 1 - 0.4 * B_m / L_m;
  return { sc, sq, sgamma };
}

/** Inclination factors for inclined loading per IS 6403:2016 */
function getInclinationFactors(H: number, V: number, B_m: number, L_m: number, c: number): { ic: number; iq: number; igamma: number } {
  if (H <= 0) return { ic: 1, iq: 1, igamma: 1 };
  const theta = Math.atan2(H, V);
  const thetaDeg = theta * 180 / Math.PI;
  const ic = Math.pow(1 - thetaDeg / 90, 2);
  const iq = ic;
  const igamma = Math.pow(1 - thetaDeg / (c > 0 ? 90 : Math.atan2(V, B_m * L_m * c + 1e-6) * 180 / Math.PI), 2);
  return { ic, iq, igamma: Math.max(igamma, 0) };
}

/** Elastic settlement estimation (Bowles, 5th ed.): Se = q·B·(1-μ²)·Iw / E_s */
function estimateSettlement(qNet_kPa: number, B_m: number, L_m: number, Es_kPa: number, mu: number): number {
  // Iw (influence factor) for center of flexible footing
  const m_ = L_m / B_m;
  const Iw = Math.log(m_ + Math.sqrt(m_ * m_ + 1)) / Math.PI + m_ * Math.log(1 + Math.sqrt(m_ * m_ + 1)) / (Math.PI * m_);
  return qNet_kPa * B_m * (1 - mu * mu) * Iw * 1000 / Es_kPa; // mm
}

export class FootingDesignEngine {
  
  /**
   * Design isolated footing per IS 456:2000
   */
  calculate(input: FootingDesignInput): FootingDesignResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    const { columnWidth, columnDepth, axialLoad, momentX = 0, momentY = 0, bearingCapacity, soilDensity, foundationDepth, fck, fy, footingType, minCover } = input;
    const phi = input.frictionAngle;
    const cohesion = input.cohesion ?? 0;
    const Es = input.elasticModulus;
    const mu_soil = input.poissonRatio ?? 0.3;
    const H_load = input.horizontalLoad ?? 0;
    
    const Cx = columnWidth;
    const Cy = columnDepth;
    const P = axialLoad;
    const Mx = momentX;
    const My = momentY;
    const gamma_s = soilDensity;
    const Df = foundationDepth / 1000; // m
    
    // ----- STEP 1: Determine Footing Size -----
    const gamma_c = 25; // kN/m³
    const assumedFootingDepth = 0.5; // m (initial assumption)
    const selfWeightAllowance = 0.1 * P; // 10% of column load for footing self-weight
    
    // Determine bearing capacity: Meyerhof if φ given, else user-provided qa
    let qa: number;
    let bearingStepValues: Record<string, string> = {};
    
    if (phi !== undefined && phi > 0) {
      // Meyerhof's general bearing capacity: q_ult = c·Nc·sc·dc·ic + q·Nq·sq·dq·iq + 0.5·γ·B·Nγ·sγ·dγ·iγ
      // First pass: assume B to get factors, then iterate
      let B_est = Math.sqrt((P + selfWeightAllowance) / bearingCapacity) * 1000; // initial guess mm
      B_est = Math.ceil(B_est / 100) * 100;
      const L_est = footingType === 'isolated_square' ? B_est : B_est * Cx / Cy;
      const B_m = B_est / 1000;
      const L_m = L_est / 1000;
      
      const { Nc, Nq, Ngamma } = getMeyerhofFactors(phi);
      const { dc, dq, dgamma } = getDepthFactors(Df, B_m);
      const { sc, sq, sgamma } = getShapeFactors(L_m, B_m, Nq, Nc);
      const { ic, iq, igamma } = getInclinationFactors(H_load, P, B_m, L_m, cohesion);
      
      const q_surcharge = gamma_s * Df; // kN/m²
      const q_ult = cohesion * Nc * sc * dc * ic
        + q_surcharge * Nq * sq * dq * iq
        + 0.5 * gamma_s * B_m * Ngamma * sgamma * dgamma * igamma;
      
      const FOS = 2.5; // Factor of safety per IS 6403:2016
      qa = q_ult / FOS;
      
      bearingStepValues = {
        'φ (friction angle)': `${phi}°`,
        'c (cohesion)': `${cohesion} kN/m²`,
        'Nc / Nq / Nγ': `${Nc.toFixed(2)} / ${Nq.toFixed(2)} / ${Ngamma.toFixed(2)}`,
        'Shape (sc/sq/sγ)': `${sc.toFixed(3)} / ${sq.toFixed(3)} / ${sgamma.toFixed(3)}`,
        'Depth (dc/dq/dγ)': `${dc.toFixed(3)} / ${dq.toFixed(3)} / ${dgamma.toFixed(3)}`,
        'Incl. (ic/iq/iγ)': `${ic.toFixed(3)} / ${iq.toFixed(3)} / ${igamma.toFixed(3)}`,
        'q_ult (Meyerhof)': `${q_ult.toFixed(2)} kN/m²`,
        'FOS': `${FOS}`,
        'Safe Bearing (q_a)': `${qa.toFixed(2)} kN/m²`,
      };
    } else {
      qa = bearingCapacity;
      bearingStepValues = {
        'Safe Bearing (q_a)': `${qa} kN/m² (user-provided)`,
      };
    }
    
    const qn = qa - gamma_s * Df - gamma_c * assumedFootingDepth;
    
    // Required area
    const A_req = (P + selfWeightAllowance) / qn; // m²
    
    // Determine dimensions
    let L: number; // mm
    let B: number; // mm
    
    if (footingType === 'isolated_square') {
      const side = Math.sqrt(A_req) * 1000;
      L = Math.ceil(side / 100) * 100;
      B = L;
    } else {
      const ratio = Cx / Cy;
      B = Math.sqrt(A_req / ratio) * 1000;
      L = ratio * B;
      B = Math.ceil(B / 100) * 100;
      L = Math.ceil(L / 100) * 100;
    }
    
    steps.push({
      title: 'Step 1: Footing Size & Bearing Capacity',
      description: phi ? 'Meyerhof bearing capacity with depth/shape/inclination factors (IS 6403:2016)' : 'User-provided safe bearing capacity',
      formula: phi ? 'q_ult = c·Nc·sc·dc·ic + q̄·Nq·sq·dq·iq + 0.5·γ·B·Nγ·sγ·dγ·iγ' : 'A_req = (P + self weight) / q_net',
      values: {
        'Service Load (P)': `${P.toFixed(2)} kN`,
        ...bearingStepValues,
        'Net Bearing (q_n)': `${qn.toFixed(2)} kN/m²`,
        'Required Area': `${A_req.toFixed(3)} m²`,
        'Footing Size': `${L} × ${B} mm`,
        'Provided Area': `${(L * B / 1e6).toFixed(3)} m²`,
      },
      reference: phi ? 'IS 6403:2016 & Meyerhof (1963)' : 'IS 456:2000 & Foundation Engineering',
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
    
    // ----- STEP 4: Depth for One-Way Shear (IS 456 Table 19) -----
    const projectionL = (L - Cx) / 2; // mm
    const projectionB = (B - Cy) / 2; // mm
    const maxProjection = Math.max(projectionL, projectionB);
    
    // Iteratively determine depth using IS 456 Table 19
    const pt_assumed = 0.25; // Initial assumption 0.25%
    let D = 500; // Initial assumption (mm)
    let d = D - minCover - 8; // Effective depth assuming 8mm stirrup
    let tau_c_design = getTauC_IS456(pt_assumed, fck);
    
    for (let i = 0; i < 10; i++) {
      const Vu_oneway = qu_net * (B / 1000) * Math.max(0, (maxProjection - d) / 1000);
      const tau_v = (Vu_oneway * 1000) / (B * d);
      if (tau_v <= tau_c_design) break;
      d = Vu_oneway * 1000 / (B * tau_c_design);
      D = d + minCover + 8;
    }
    
    D = Math.ceil(D / 50) * 50;
    d = D - minCover - 8;
    
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
    
    // ----- STEP 8: Settlement Estimation (Elastic) -----
    let settlementMm: number | undefined;
    if (Es) {
      const qNet_service = P / A - gamma_s * Df; // kN/m²
      settlementMm = estimateSettlement(qNet_service, B / 1000, L / 1000, Es, mu_soil);
      const allowableSettlement = 25; // mm per IS 1904 for isolated footings on sand
      
      steps.push({
        title: 'Step 8: Settlement Estimation',
        description: 'Elastic settlement per Bowles (5th ed.) — Se = q·B·(1−μ²)·Iw / Es',
        formula: 'Se = q_net × B × (1 − μ²) × Iw / E_s',
        values: {
          'Net contact pressure': `${qNet_service.toFixed(2)} kN/m²`,
          'E_s': `${Es} kN/m²`,
          'μ (Poisson)': `${mu_soil}`,
          'Estimated Settlement': `${settlementMm.toFixed(2)} mm`,
          'Allowable (IS 1904)': `${allowableSettlement} mm`,
          'Status': settlementMm <= allowableSettlement ? 'OK' : 'EXCEEDS LIMIT',
        },
        reference: 'IS 1904:1986 & Bowles (5th ed.)',
      });
      
      if (settlementMm > allowableSettlement) {
        warnings.push(`Estimated settlement ${settlementMm.toFixed(1)} mm exceeds allowable ${allowableSettlement} mm.`);
      }
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
