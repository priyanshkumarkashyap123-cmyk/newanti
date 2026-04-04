/**
 * ============================================================================
 * RETAINING WALL DESIGN ENGINE
 * ============================================================================
 * 
 * Cantilever Retaining Wall Design per IS 456:2000 and Rankine/Coulomb Theory
 * Includes stability checks and structural design
 * 
 * @version 1.0.0
 */

import { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface RetainingWallDesignInput {
  // Geometry
  totalHeight: number;      // mm - H (from base to top of stem)
  stemThicknessTop: number; // mm
  stemThicknessBot: number; // mm (can be same or tapered)
  toeLength: number;        // mm
  heelLength: number;       // mm
  baseThickness: number;    // mm
  
  // Soil Properties (Backfill)
  soilUnitWeight: number;   // kN/m³ - γ
  soilFriction: number;     // degrees - φ
  surchageLoad: number;     // kN/m² - q (surcharge)
  
  // Foundation Soil
  foundationBearing: number; // kN/m² - allowable bearing
  coeffFriction: number;    // μ - base friction coefficient
  passiveEnabled: boolean;  // Consider passive pressure on toe?
  
  // Materials
  fck: number;              // MPa
  fy: number;               // MPa
  
  // Options
  wallType: 'cantilever' | 'gravity';
  backfillSlope: number;    // degrees (β) - slope of backfill
  waterTable?: number;      // mm - depth below ground (if present)
}

export interface RetainingWallResult extends CalculationResult {
  pressures: {
    Ka: number;             // Active pressure coefficient
    Kp: number;             // Passive pressure coefficient
    activeForce: number;    // kN/m
    passiveForce: number;   // kN/m
  };
  stability: {
    overturningMoment: number;
    resistingMoment: number;
    fosFOT: number;         // Factor of safety against overturning
    fosSliding: number;     // Factor of safety against sliding
    fosBearing: number;     // Factor of safety against bearing
    basePressureMax: number; // kN/m²
    basePressureMin: number; // kN/m²
  };
  reinforcement: {
    stem: { main: number; dist: number; spacing: number };
    heel: { main: number; dist: number; spacing: number };
    toe: { main: number; dist: number; spacing: number };
  };
}

// ============================================================================
// RETAINING WALL DESIGN CALCULATOR
// ============================================================================

export class RetainingWallDesignEngine {
  
  /**
   * Design cantilever retaining wall
   */
  calculate(input: RetainingWallDesignInput): RetainingWallResult {
    const steps: CalculationStep[] = [];
    const codeChecks: CodeCheck[] = [];
    const warnings: string[] = [];
    
    const { totalHeight, stemThicknessTop, stemThicknessBot, toeLength, heelLength, baseThickness, 
            soilUnitWeight, soilFriction, surchageLoad, foundationBearing, coeffFriction, passiveEnabled, fck, fy, backfillSlope } = input;
    
    const H = totalHeight / 1000;        // m
    const D = baseThickness / 1000;      // m
    const B = (toeLength + stemThicknessBot + heelLength) / 1000; // m - total base width
    const gamma = soilUnitWeight;
    const phi = soilFriction * Math.PI / 180; // radians
    const beta = backfillSlope * Math.PI / 180;
    const q = surchageLoad;
    
    // Concrete unit weight
    const gamma_c = 25; // kN/m³
    
    // ----- STEP 1: Earth Pressure Coefficients -----
    // Rankine's theory
    let Ka: number;
    let Kp: number;
    
    if (backfillSlope === 0) {
      Ka = (1 - Math.sin(phi)) / (1 + Math.sin(phi));
      Kp = (1 + Math.sin(phi)) / (1 - Math.sin(phi));
    } else {
      // With sloping backfill
      const cosB = Math.cos(beta);
      const cosPhi = Math.cos(phi);
      Ka = cosB * (cosB - Math.sqrt(cosB * cosB - cosPhi * cosPhi)) / 
           (cosB + Math.sqrt(cosB * cosB - cosPhi * cosPhi));
      Kp = (1 + Math.sin(phi)) / (1 - Math.sin(phi));
    }
    
    steps.push({
      title: 'Step 1: Earth Pressure Coefficients',
      description: 'Calculate Rankine active and passive pressure coefficients',
      formula: 'K_a = (1 - sinφ)/(1 + sinφ), K_p = (1 + sinφ)/(1 - sinφ)',
      values: {
        'Soil Friction Angle (φ)': `${soilFriction}°`,
        'Backfill Slope (β)': `${backfillSlope}°`,
        'Active Coefficient (K_a)': Ka.toFixed(3),
        'Passive Coefficient (K_p)': Kp.toFixed(3),
      },
      reference: 'Rankine Theory',
    });
    
    // ----- STEP 2: Earth Pressure Forces -----
    // Active earth pressure (triangular distribution)
    const H_total = H + D; // Total height including embedment
    const Pa_soil = 0.5 * Ka * gamma * H_total * H_total; // kN/m
    const Pa_surcharge = Ka * q * H_total; // kN/m
    const Pa_total = Pa_soil + Pa_surcharge;
    
    // Lever arms from base
    const ya_soil = H_total / 3;
    const ya_surcharge = H_total / 2;
    
    // Passive pressure on toe (if enabled)
    const Pp = passiveEnabled ? 0.5 * Kp * gamma * D * D : 0;
    
    steps.push({
      title: 'Step 2: Earth Pressure Forces',
      description: 'Calculate active and passive earth pressure forces',
      formula: 'P_a = 0.5 × K_a × γ × H² + K_a × q × H',
      values: {
        'Height for Pressure': `${H_total.toFixed(2)} m`,
        'Active (Soil)': `${Pa_soil.toFixed(2)} kN/m at ${ya_soil.toFixed(2)}m`,
        'Active (Surcharge)': `${Pa_surcharge.toFixed(2)} kN/m at ${ya_surcharge.toFixed(2)}m`,
        'Total Active (P_a)': `${Pa_total.toFixed(2)} kN/m`,
        'Passive (P_p)': `${Pp.toFixed(2)} kN/m`,
      },
      reference: 'IS 456:2000 & Soil Mechanics',
    });
    
    // ----- STEP 3: Calculate Weights -----
    // Stem weight
    const stemArea = 0.5 * (stemThicknessTop + stemThicknessBot) / 1000 * H;
    const W_stem = stemArea * gamma_c;
    const x_stem = toeLength / 1000 + (stemThicknessTop + 2 * stemThicknessBot) / (3 * (stemThicknessTop + stemThicknessBot)) * (stemThicknessBot / 1000);
    
    // Base weight
    const W_base = B * D * gamma_c;
    const x_base = B / 2;
    
    // Soil on heel
    const heelSoilHeight = H;
    const W_heelSoil = (heelLength / 1000) * heelSoilHeight * gamma;
    const x_heelSoil = toeLength / 1000 + stemThicknessBot / 1000 + (heelLength / 1000) / 2;
    
    // Surcharge on heel
    const W_surcharge = q * (heelLength / 1000);
    const x_surcharge = x_heelSoil;
    
    // Total vertical load
    const W_total = W_stem + W_base + W_heelSoil + W_surcharge;
    
    steps.push({
      title: 'Step 3: Vertical Loads',
      description: 'Calculate weights and their moment arms from toe',
      formula: 'W = Volume × Unit Weight',
      values: {
        'Stem Weight': `${W_stem.toFixed(2)} kN/m at x = ${x_stem.toFixed(2)}m`,
        'Base Weight': `${W_base.toFixed(2)} kN/m at x = ${x_base.toFixed(2)}m`,
        'Soil on Heel': `${W_heelSoil.toFixed(2)} kN/m at x = ${x_heelSoil.toFixed(2)}m`,
        'Surcharge Load': `${W_surcharge.toFixed(2)} kN/m at x = ${x_surcharge.toFixed(2)}m`,
        'Total (W)': `${W_total.toFixed(2)} kN/m`,
      },
      reference: 'Structural Analysis',
    });
    
    // ----- STEP 4: Stability - Overturning -----
    // Overturning moment about toe
    const Mo = Pa_soil * ya_soil + Pa_surcharge * ya_surcharge;
    
    // Resisting moment about toe
    const Mr = W_stem * x_stem + W_base * x_base + W_heelSoil * x_heelSoil + W_surcharge * x_surcharge + Pp * D / 3;
    
    const FOS_OT = Mr / Mo;
    const fosOtOk = FOS_OT >= 2.0;
    
    steps.push({
      title: 'Step 4: Stability Against Overturning',
      description: 'Check factor of safety against overturning about toe',
      formula: 'FOS = M_resisting / M_overturning ≥ 2.0',
      values: {
        'Overturning Moment (M_o)': `${Mo.toFixed(2)} kN·m/m`,
        'Resisting Moment (M_r)': `${Mr.toFixed(2)} kN·m/m`,
        'Factor of Safety': FOS_OT.toFixed(2),
        'Status': fosOtOk ? 'SAFE' : 'UNSAFE - Increase heel length',
      },
      reference: 'Foundation Engineering',
    });
    
    codeChecks.push({
      clause: 'Stability',
      description: 'Factor of safety against overturning',
      required: '≥ 2.0',
      provided: FOS_OT.toFixed(2),
      status: fosOtOk ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 5: Stability - Sliding -----
    // Sliding resistance
    const Fr = coeffFriction * W_total + Pp;
    const Fs = Pa_total;
    
    const FOS_SL = Fr / Fs;
    const fosSlOk = FOS_SL >= 1.5;
    
    steps.push({
      title: 'Step 5: Stability Against Sliding',
      description: 'Check factor of safety against sliding',
      formula: 'FOS = (μW + P_p) / P_a ≥ 1.5',
      values: {
        'Friction Coefficient (μ)': coeffFriction.toFixed(2),
        'Friction Resistance': `${(coeffFriction * W_total).toFixed(2)} kN/m`,
        'Passive Resistance': `${Pp.toFixed(2)} kN/m`,
        'Total Resistance': `${Fr.toFixed(2)} kN/m`,
        'Sliding Force': `${Fs.toFixed(2)} kN/m`,
        'Factor of Safety': FOS_SL.toFixed(2),
        'Status': fosSlOk ? 'SAFE' : 'UNSAFE - Add shear key',
      },
      reference: 'Foundation Engineering',
    });
    
    codeChecks.push({
      clause: 'Stability',
      description: 'Factor of safety against sliding',
      required: '≥ 1.5',
      provided: FOS_SL.toFixed(2),
      status: fosSlOk ? 'PASS' : 'FAIL',
    });
    
    if (!fosSlOk) {
      warnings.push('Consider adding a shear key below the base to increase sliding resistance.');
    }
    
    // ----- STEP 6: Base Pressure Check -----
    // Eccentricity
    const e = B / 2 - (Mr - Mo) / W_total;
    const e_limit = B / 6;
    
    // Base pressures
    let q_max: number;
    let q_min: number;
    
    if (e <= e_limit) {
      // Resultant within middle third - full contact
      q_max = W_total / B * (1 + 6 * e / B);
      q_min = W_total / B * (1 - 6 * e / B);
    } else {
      // Resultant outside middle third - partial contact
      const L_contact = 3 * (B / 2 - e);
      q_max = 2 * W_total / L_contact;
      q_min = 0;
      warnings.push('Resultant outside middle third. Partial base contact.');
    }
    
    const FOS_BR = foundationBearing / q_max;
    const fosBrOk = q_max <= foundationBearing;
    
    steps.push({
      title: 'Step 6: Base Pressure',
      description: 'Check bearing pressure under base',
      formula: 'q = W/B × (1 ± 6e/B)',
      values: {
        'Base Width (B)': `${B.toFixed(2)} m`,
        'Eccentricity (e)': `${e.toFixed(3)} m`,
        'e_limit (B/6)': `${e_limit.toFixed(3)} m`,
        'Max Pressure (q_max)': `${q_max.toFixed(2)} kN/m²`,
        'Min Pressure (q_min)': `${q_min.toFixed(2)} kN/m²`,
        'Allowable Bearing': `${foundationBearing} kN/m²`,
        'Status': fosBrOk ? 'SAFE' : 'UNSAFE - Widen base',
      },
      reference: 'Foundation Engineering',
    });
    
    codeChecks.push({
      clause: 'Bearing',
      description: 'Base pressure vs allowable bearing',
      required: `≤ ${foundationBearing} kN/m²`,
      provided: `${q_max.toFixed(2)} kN/m²`,
      status: fosBrOk ? 'PASS' : 'FAIL',
    });
    
    // ----- STEP 7: Structural Design - Stem -----
    // Moment at base of stem
    const h_stem = H * 1000; // mm
    const d_stem = stemThicknessBot - 50 - 8; // Effective depth (mm)
    
    // Earth pressure at base of stem
    const M_stem = (0.5 * Ka * gamma * Math.pow(H, 3) / 6 + Ka * q * H * H / 2) * 1.5; // Factored (kN·m/m)
    
    // Steel area for stem (per meter width)
    const b_stem = 1000; // mm (per meter)
    const Ast_stem = M_stem * 1e6 / (0.87 * fy * 0.9 * d_stem);
    const Ast_min_stem = 0.0012 * b_stem * stemThicknessBot;
    const Ast_stem_req = Math.max(Ast_stem, Ast_min_stem);
    
    // Select bars
    const stemBarDia = 16;
    const stemSpacing = Math.floor(1000 * Math.PI * stemBarDia * stemBarDia / (4 * Ast_stem_req));
    const stemSpacingProvided = Math.min(Math.max(stemSpacing, 100), 200);
    
    steps.push({
      title: 'Step 7: Stem Reinforcement',
      description: 'Design main reinforcement for stem (earth face)',
      formula: 'M_stem = 0.5 × K_a × γ × H³/6 + K_a × q × H²/2',
      values: {
        'Design Moment': `${M_stem.toFixed(2)} kN·m/m`,
        'Effective Depth': `${d_stem} mm`,
        'A_st Required': `${Ast_stem_req.toFixed(0)} mm²/m`,
        'Main Steel': `${stemBarDia}mm @ ${stemSpacingProvided}mm c/c`,
        'Distribution': `12mm @ 200mm c/c (0.12%)`,
      },
      reference: 'IS 456:2000 Cl. 26',
    });
    
    // ----- STEP 8: Structural Design - Heel -----
    // Upward pressure minus weight of soil and base
    const avgPressureHeel = (q_max + q_min) / 2;
    const netUpHeel = avgPressureHeel - gamma * H - gamma_c * D;
    const heelLen = heelLength / 1000;
    const M_heel = Math.abs(netUpHeel * heelLen * heelLen / 2) * 1.5; // Factored
    
    const d_heel = baseThickness - 75;
    const Ast_heel = M_heel * 1e6 / (0.87 * fy * 0.9 * d_heel);
    const Ast_min_heel = 0.0012 * 1000 * baseThickness;
    const Ast_heel_req = Math.max(Ast_heel, Ast_min_heel);
    
    const heelBarDia = 16;
    const heelSpacing = Math.floor(1000 * Math.PI * heelBarDia * heelBarDia / (4 * Ast_heel_req));
    const heelSpacingProvided = Math.min(Math.max(heelSpacing, 100), 200);
    
    steps.push({
      title: 'Step 8: Heel Slab Reinforcement',
      description: 'Design reinforcement for heel (top steel)',
      formula: 'M_heel = Net pressure × heel² / 2',
      values: {
        'Design Moment': `${M_heel.toFixed(2)} kN·m/m`,
        'A_st Required': `${Ast_heel_req.toFixed(0)} mm²/m`,
        'Top Steel': `${heelBarDia}mm @ ${heelSpacingProvided}mm c/c`,
      },
      reference: 'IS 456:2000',
    });
    
    // ----- STEP 9: Structural Design - Toe -----
    const toeLen = toeLength / 1000;
    const M_toe = (q_max * toeLen * toeLen / 2 - gamma_c * D * toeLen * toeLen / 2) * 1.5;
    
    const d_toe = baseThickness - 75;
    const Ast_toe = M_toe * 1e6 / (0.87 * fy * 0.9 * d_toe);
    const Ast_min_toe = 0.0012 * 1000 * baseThickness;
    const Ast_toe_req = Math.max(Ast_toe, Ast_min_toe);
    
    const toeBarDia = 12;
    const toeSpacing = Math.floor(1000 * Math.PI * toeBarDia * toeBarDia / (4 * Ast_toe_req));
    const toeSpacingProvided = Math.min(Math.max(toeSpacing, 100), 200);
    
    steps.push({
      title: 'Step 9: Toe Slab Reinforcement',
      description: 'Design reinforcement for toe (bottom steel)',
      formula: 'M_toe = (q_max - self weight) × toe² / 2',
      values: {
        'Design Moment': `${M_toe.toFixed(2)} kN·m/m`,
        'A_st Required': `${Ast_toe_req.toFixed(0)} mm²/m`,
        'Bottom Steel': `${toeBarDia}mm @ ${toeSpacingProvided}mm c/c`,
      },
      reference: 'IS 456:2000',
    });
    
    // ----- DETERMINE OVERALL ADEQUACY -----
    const isAdequate = fosOtOk && fosSlOk && fosBrOk;
    const utilization = Math.max(2.0 / FOS_OT, 1.5 / FOS_SL, q_max / foundationBearing);
    
    return {
      isAdequate,
      utilization,
      capacity: foundationBearing,
      demand: q_max,
      status: isAdequate ? 'OK' : 'FAIL',
      message: isAdequate 
        ? `Retaining wall design adequate. FOS(OT)=${FOS_OT.toFixed(2)}, FOS(SL)=${FOS_SL.toFixed(2)}, q_max=${q_max.toFixed(1)} kN/m²`
        : 'Design inadequate. Check stability factors.',
      steps,
      codeChecks,
      warnings,
      pressures: {
        Ka,
        Kp,
        activeForce: Pa_total,
        passiveForce: Pp,
      },
      stability: {
        overturningMoment: Mo,
        resistingMoment: Mr,
        fosFOT: FOS_OT,
        fosSliding: FOS_SL,
        fosBearing: FOS_BR,
        basePressureMax: q_max,
        basePressureMin: q_min,
      },
      reinforcement: {
        stem: { main: Ast_stem_req, dist: 0.0012 * 1000 * stemThicknessBot, spacing: stemSpacingProvided },
        heel: { main: Ast_heel_req, dist: 0.0012 * 1000 * baseThickness, spacing: heelSpacingProvided },
        toe: { main: Ast_toe_req, dist: 0.0012 * 1000 * baseThickness, spacing: toeSpacingProvided },
      },
    };
  }
}

export const retainingWallDesignEngine = new RetainingWallDesignEngine();
