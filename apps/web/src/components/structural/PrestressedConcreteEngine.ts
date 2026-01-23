/**
 * ============================================================================
 * PRESTRESSED CONCRETE DESIGN ENGINE
 * ============================================================================
 * 
 * Pre-tensioned and Post-tensioned Member Design per IS 1343:2012
 * Includes stress checks at transfer, service, and ultimate states
 * 
 * @version 1.0.0
 */

import { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface PrestressedDesignInput {
  // Section Properties
  sectionType: 'rectangular' | 'I_section' | 'T_section' | 'box';
  totalDepth: number;       // mm (D)
  width: number;            // mm (b) - flange width for T/I
  webWidth?: number;        // mm (bw) - for T/I/box
  flangeThickness?: number; // mm (Df)
  
  // Span
  span: number;             // mm
  
  // Prestressing
  prestressType: 'pretension' | 'posttension';
  strandType: '12.7mm_7wire' | '15.2mm_7wire' | '15.7mm_7wire';
  numStrands: number;
  cgs_from_bottom: number;  // mm - CG of strands from bottom
  initialPrestress: number; // MPa - jacking stress
  
  // Materials
  fck: number;              // MPa - concrete grade (M30, M35, M40, etc.)
  fci: number;              // MPa - concrete strength at transfer
  fpu: number;              // MPa - ultimate strand strength (typically 1860)
  
  // Loading (Service - Unfactored)
  deadLoad: number;         // kN/m - self-weight + SDL
  liveLoad: number;         // kN/m
  
  // Losses
  lossAtTransfer: number;   // % - immediate losses
  lossLongTerm: number;     // % - time-dependent losses
  
  // Options
  environment: 'moderate' | 'severe';
}

export interface PrestressedDesignResult extends CalculationResult {
  sectionProperties: {
    A: number;              // mm²
    I: number;              // mm⁴
    yt: number;             // mm - NA to top
    yb: number;             // mm - NA to bottom
    Zt: number;             // mm³ - section modulus top
    Zb: number;             // mm³ - section modulus bottom
  };
  prestressForces: {
    Pi: number;             // kN - initial prestress
    Pe: number;             // kN - effective prestress
    eccentricity: number;   // mm
  };
  stressChecks: {
    atTransfer: { top: number; bottom: number; status: string };
    atService: { top: number; bottom: number; status: string };
  };
  ultimateCapacity: {
    Mu: number;             // kN·m
    adequacy: boolean;
  };
}

// ============================================================================
// STRAND PROPERTIES
// ============================================================================

const STRAND_DATA = {
  '12.7mm_7wire': { diameter: 12.7, area: 98.7, fpu: 1860 },
  '15.2mm_7wire': { diameter: 15.2, area: 140, fpu: 1860 },
  '15.7mm_7wire': { diameter: 15.7, area: 150, fpu: 1860 },
};

// ============================================================================
// PRESTRESSED CONCRETE DESIGN ENGINE
// ============================================================================

export class PrestressedConcreteEngine {
  
  /**
   * Design prestressed concrete member per IS 1343:2012
   */
  calculate(input: PrestressedDesignInput): PrestressedDesignResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    const { sectionType, totalDepth, width, webWidth, flangeThickness = 0,
            span, prestressType, strandType, numStrands, cgs_from_bottom, initialPrestress,
            fck, fci, deadLoad, liveLoad, lossAtTransfer, lossLongTerm, environment } = input;
    
    const D = totalDepth;
    const b = width;
    const bw = webWidth || width;
    const Df = flangeThickness;
    const L = span / 1000; // m
    
    // Strand properties
    const strand = STRAND_DATA[strandType];
    const Aps = numStrands * strand.area; // Total strand area
    
    // ----- STEP 1: Section Properties -----
    let A: number, I: number, yt: number, yb: number;
    
    if (sectionType === 'rectangular') {
      A = b * D;
      I = b * D * D * D / 12;
      yt = D / 2;
      yb = D / 2;
    } else if (sectionType === 'T_section' || sectionType === 'I_section') {
      // Simplified T-section
      const Af = b * Df;
      const Aw = bw * (D - Df);
      A = Af + Aw;
      
      // Centroid from bottom
      yb = (Aw * (D - Df) / 2 + Af * (D - Df / 2)) / A;
      yt = D - yb;
      
      // Moment of inertia about NA
      I = (b * Df * Df * Df / 12 + Af * Math.pow(D - Df / 2 - yb, 2)) +
          (bw * Math.pow(D - Df, 3) / 12 + Aw * Math.pow((D - Df) / 2 - yb, 2));
    } else {
      // Box section (simplified as hollow rectangle)
      const tw = (b - (bw || b / 2)) / 2; // Wall thickness
      A = b * D - (b - 2 * tw) * (D - 2 * Df);
      I = (b * D * D * D - (b - 2 * tw) * Math.pow(D - 2 * Df, 3)) / 12;
      yt = D / 2;
      yb = D / 2;
    }
    
    // Section moduli
    const Zt = I / yt;
    const Zb = I / yb;
    
    steps.push({
      title: 'Step 1: Section Properties',
      description: 'Calculate geometric properties of prestressed section',
      formula: 'I = bD³/12 (rectangular), Z = I/y',
      values: {
        'Section Type': sectionType,
        'Total Depth': `${D} mm`,
        'Area (A)': `${(A / 1e6).toFixed(4)} m²`,
        'Moment of Inertia (I)': `${(I / 1e12).toFixed(6)} m⁴`,
        'y_top': `${yt.toFixed(1)} mm`,
        'y_bottom': `${yb.toFixed(1)} mm`,
        'Z_top': `${(Zt / 1e6).toFixed(3)} × 10⁶ mm³`,
        'Z_bottom': `${(Zb / 1e6).toFixed(3)} × 10⁶ mm³`,
      },
      reference: 'IS 1343:2012',
    });
    
    // ----- STEP 2: Prestressing Force -----
    // Initial prestress (at jacking)
    const fpi = initialPrestress; // MPa
    
    // Maximum jacking stress limit
    const fpi_max = 0.8 * strand.fpu;
    if (fpi > fpi_max) {
      warnings.push(`Initial prestress ${fpi} MPa exceeds 0.8fpu = ${fpi_max} MPa`);
    }
    
    // Prestress force at transfer (after immediate losses)
    const Pi = fpi * (1 - lossAtTransfer / 100) * Aps / 1000; // kN
    
    // Effective prestress (after all losses)
    const Pe = fpi * (1 - (lossAtTransfer + lossLongTerm) / 100) * Aps / 1000; // kN
    
    // Eccentricity
    const e = yb - cgs_from_bottom;
    
    steps.push({
      title: 'Step 2: Prestressing Force',
      description: 'Calculate initial and effective prestress',
      formula: 'P = f_pi × A_ps × (1 - losses)',
      values: {
        'Strand Type': strandType,
        'Number of Strands': numStrands,
        'Total Strand Area (A_ps)': `${Aps.toFixed(1)} mm²`,
        'Initial Stress (f_pi)': `${fpi} MPa`,
        'Loss at Transfer': `${lossAtTransfer}%`,
        'Long-term Loss': `${lossLongTerm}%`,
        'P_i (at transfer)': `${Pi.toFixed(1)} kN`,
        'P_e (effective)': `${Pe.toFixed(1)} kN`,
        'Eccentricity (e)': `${e.toFixed(1)} mm`,
      },
      reference: 'IS 1343:2012 Cl. 18',
    });
    
    // ----- STEP 3: Permissible Stresses -----
    // At Transfer (IS 1343 Cl. 22.1)
    const fct_transfer = 0.5 * Math.sqrt(fci); // Tension limit at transfer
    const fcc_transfer = 0.5 * fci; // Compression limit at transfer
    
    // At Service (IS 1343 Cl. 22.1)
    const fct_service = environment === 'moderate' ? 0 : 0; // Class 1 - no tension
    const fcc_service = 0.33 * fck; // Compression limit at service
    
    steps.push({
      title: 'Step 3: Permissible Stresses',
      description: 'Determine stress limits per IS 1343',
      formula: 'f_ct = 0.5√f_ci (transfer), f_cc = 0.5f_ci',
      values: {
        'At Transfer - Tension': `${fct_transfer.toFixed(2)} MPa`,
        'At Transfer - Compression': `${fcc_transfer.toFixed(1)} MPa`,
        'At Service - Tension': `${fct_service} MPa (Class 1)`,
        'At Service - Compression': `${fcc_service.toFixed(1)} MPa`,
      },
      reference: 'IS 1343:2012 Cl. 22.1',
    });
    
    // ----- STEP 4: Stress at Transfer -----
    // Self-weight moment at midspan
    const w_sw = (A / 1e6) * 25; // kN/m (concrete density 25 kN/m³)
    const M_sw = w_sw * L * L / 8; // kN·m
    
    // Stresses at transfer (P_i + self-weight)
    // f = P/A ± P.e/Z ± M/Z
    // Top fiber: compression from P is -, tension from P.e is +, compression from M is -
    const f_top_transfer = -Pi * 1000 / A + Pi * 1000 * e / Zt - M_sw * 1e6 / Zt;
    const f_bottom_transfer = -Pi * 1000 / A - Pi * 1000 * e / Zb + M_sw * 1e6 / Zb;
    
    // Check limits
    const topTransferOk = f_top_transfer >= -fcc_transfer && f_top_transfer <= fct_transfer;
    const bottomTransferOk = f_bottom_transfer >= -fcc_transfer && f_bottom_transfer <= fct_transfer;
    
    steps.push({
      title: 'Step 4: Stress at Transfer',
      description: 'Check stresses immediately after transfer',
      formula: 'f = -P/A ± P×e/Z ± M_sw/Z',
      values: {
        'Self-weight': `${w_sw.toFixed(2)} kN/m`,
        'SW Moment (M_sw)': `${M_sw.toFixed(2)} kN·m`,
        'Stress at Top': `${f_top_transfer.toFixed(2)} MPa (${f_top_transfer < 0 ? 'Comp' : 'Tension'})`,
        'Stress at Bottom': `${f_bottom_transfer.toFixed(2)} MPa (${f_bottom_transfer < 0 ? 'Comp' : 'Tension'})`,
        'Top Status': topTransferOk ? 'OK' : 'EXCEEDS LIMIT',
        'Bottom Status': bottomTransferOk ? 'OK' : 'EXCEEDS LIMIT',
      },
      reference: 'IS 1343:2012 Cl. 22.1.1',
    });
    
    codeChecks.push({
      clause: 'IS 1343 Cl. 22.1.1',
      description: 'Stress at transfer',
      required: `${-fcc_transfer} to ${fct_transfer} MPa`,
      provided: `Top: ${f_top_transfer.toFixed(2)}, Bottom: ${f_bottom_transfer.toFixed(2)} MPa`,
      status: topTransferOk && bottomTransferOk ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 5: Stress at Service -----
    // Total service moment
    const w_total = deadLoad + liveLoad;
    const M_service = w_total * L * L / 8; // kN·m
    
    // Stresses at service (P_e + full load)
    const f_top_service = -Pe * 1000 / A + Pe * 1000 * e / Zt - M_service * 1e6 / Zt;
    const f_bottom_service = -Pe * 1000 / A - Pe * 1000 * e / Zb + M_service * 1e6 / Zb;
    
    // Check limits
    const topServiceOk = f_top_service >= -fcc_service && f_top_service <= fct_service;
    const bottomServiceOk = f_bottom_service >= -fcc_service && f_bottom_service <= fct_service;
    
    steps.push({
      title: 'Step 5: Stress at Service',
      description: 'Check stresses under full service load',
      formula: 'f = -P_e/A ± P_e×e/Z ± M_service/Z',
      values: {
        'Total Load': `${w_total.toFixed(2)} kN/m`,
        'Service Moment': `${M_service.toFixed(2)} kN·m`,
        'Stress at Top': `${f_top_service.toFixed(2)} MPa (${f_top_service < 0 ? 'Comp' : 'Tension'})`,
        'Stress at Bottom': `${f_bottom_service.toFixed(2)} MPa (${f_bottom_service < 0 ? 'Comp' : 'Tension'})`,
        'Top Status': topServiceOk ? 'OK' : 'EXCEEDS LIMIT',
        'Bottom Status': bottomServiceOk ? 'OK' : 'EXCEEDS LIMIT',
      },
      reference: 'IS 1343:2012 Cl. 22.1.2',
    });
    
    codeChecks.push({
      clause: 'IS 1343 Cl. 22.1.2',
      description: 'Stress at service',
      required: `${-fcc_service} to ${fct_service} MPa`,
      provided: `Top: ${f_top_service.toFixed(2)}, Bottom: ${f_bottom_service.toFixed(2)} MPa`,
      status: topServiceOk && bottomServiceOk ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 6: Ultimate Moment Capacity -----
    // Factored moment
    const Mu_demand = 1.5 * M_service; // kN·m
    
    // Ultimate capacity (simplified)
    // fps = fpu × (1 - γp/β1 × (fpu/fck) × (Aps/bd))
    const gamma_p = prestressType === 'pretension' ? 0.55 : 0.55;
    const beta_1 = 0.85 - 0.05 * (fck - 30) / 5; // Approximately 0.8 for high strength
    const fps = strand.fpu * (1 - gamma_p * (strand.fpu / fck) * (Aps / (b * (D - cgs_from_bottom))));
    
    // Depth of compression block
    const a = fps * Aps / (0.36 * fck * b);
    
    // Ultimate moment capacity
    const Mu_capacity = fps * Aps * ((D - cgs_from_bottom) - a / 2) / 1e6; // kN·m
    
    const ultimateOk = Mu_capacity >= Mu_demand;
    
    steps.push({
      title: 'Step 6: Ultimate Moment Capacity',
      description: 'Check flexural strength at ultimate limit state',
      formula: 'M_u = f_ps × A_ps × (d_p - a/2)',
      values: {
        'Ultimate Strand Stress (f_ps)': `${fps.toFixed(0)} MPa`,
        'Compression Block (a)': `${a.toFixed(1)} mm`,
        'M_u Capacity': `${Mu_capacity.toFixed(2)} kN·m`,
        'M_u Demand (1.5×M)': `${Mu_demand.toFixed(2)} kN·m`,
        'Status': ultimateOk ? 'ADEQUATE' : 'INADEQUATE',
      },
      reference: 'IS 1343:2012 Cl. 23',
    });
    
    codeChecks.push({
      clause: 'IS 1343 Cl. 23',
      description: 'Ultimate moment capacity',
      required: `≥ ${Mu_demand.toFixed(2)} kN·m`,
      provided: `${Mu_capacity.toFixed(2)} kN·m`,
      status: ultimateOk ? 'PASS' : 'FAIL',
    });
    
    // ----- DETERMINE OVERALL ADEQUACY -----
    const isAdequate = topTransferOk && bottomTransferOk && topServiceOk && bottomServiceOk && ultimateOk;
    const utilization = Mu_demand / Mu_capacity;
    
    if (!isAdequate) {
      if (!topServiceOk || !bottomServiceOk) {
        warnings.push('Service stress limits exceeded. Consider increasing prestress or section size.');
      }
      if (!ultimateOk) {
        warnings.push('Ultimate capacity insufficient. Increase number of strands or section depth.');
      }
    }
    
    return {
      isAdequate,
      utilization,
      capacity: Mu_capacity,
      demand: Mu_demand,
      status: isAdequate ? 'OK' : 'FAIL',
      message: isAdequate 
        ? `Prestressed design adequate. ${numStrands} × ${strandType} strands. Mu = ${Mu_capacity.toFixed(1)} kN·m`
        : 'Design inadequate. Review stress checks and capacity.',
      steps,
      codeChecks,
      warnings,
      sectionProperties: {
        A,
        I,
        yt,
        yb,
        Zt,
        Zb,
      },
      prestressForces: {
        Pi,
        Pe,
        eccentricity: e,
      },
      stressChecks: {
        atTransfer: { 
          top: f_top_transfer, 
          bottom: f_bottom_transfer, 
          status: topTransferOk && bottomTransferOk ? 'OK' : 'FAIL' 
        },
        atService: { 
          top: f_top_service, 
          bottom: f_bottom_service, 
          status: topServiceOk && bottomServiceOk ? 'OK' : 'FAIL' 
        },
      },
      ultimateCapacity: {
        Mu: Mu_capacity,
        adequacy: ultimateOk,
      },
    };
  }
}

export const prestressedConcreteEngine = new PrestressedConcreteEngine();
