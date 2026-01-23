/**
 * Steel Column Design Calculator
 * Per AISC 360-22 Chapters E, H
 * 
 * Features:
 * - Compression strength (flexural buckling)
 * - Slender element reduction (Q factor)
 * - P-M interaction (H1-1)
 * - Second-order amplification (B1)
 */

import {
  CompactnessClass,
  ColumnLimitState,
  BoundaryCondition,
  FrameType,
  SteelColumnInput,
  SteelColumnResult,
  CompressionStrengthResult,
  PMInteractionResult,
  ColumnCompactnessResult,
  CalculationStep,
  COLUMN_RESISTANCE_FACTORS,
  COMPRESSION_COMPACTNESS_LIMITS,
  THEORETICAL_K_FACTORS,
  RECOMMENDED_K_FACTORS,
  W_SHAPES_COLUMNS,
} from './SteelColumnTypes';

export class SteelColumnCalculator {
  private input: SteelColumnInput;
  private calculations: CalculationStep[] = [];
  private stepCounter = 1;
  
  constructor(input: SteelColumnInput) {
    this.input = input;
  }
  
  /**
   * Main design method
   */
  public design(): SteelColumnResult {
    this.calculations = [];
    this.stepCounter = 1;
    
    const { section, material, geometry, loads, designMethod } = this.input;
    
    // Step 1: Check compactness for compression
    const compactness = this.checkCompactness();
    
    // Step 2: Calculate compression strength
    const compression = this.calculateCompressionStrength(compactness);
    
    // Step 3: Check P-M interaction if required
    let interaction: PMInteractionResult | undefined;
    if (this.input.checkPM && (loads.Mux || loads.Muy)) {
      interaction = this.checkPMInteraction(compression);
    }
    
    // Capacity ratios
    const capacityRatios = {
      axial: compression.ratio,
      interaction: interaction?.ratio,
      governing: interaction ? Math.max(compression.ratio, interaction.ratio) : compression.ratio,
    };
    
    // Overall adequacy
    const isAdequate = 
      compression.isAdequate && 
      (!interaction || interaction.isAdequate);
    
    return {
      isAdequate,
      section: section.designation,
      material: {
        grade: material.grade,
        Fy: material.Fy,
        Fu: material.Fu,
      },
      compactness,
      compression,
      interaction,
      capacityRatios,
      calculations: this.calculations,
      codeReference: 'AISC 360-22 Chapters E, H',
    };
  }
  
  /**
   * Check section compactness for compression
   */
  private checkCompactness(): ColumnCompactnessResult {
    const { section, material } = this.input;
    const E = material.E || 29000;
    const Fy = material.Fy;
    
    const sqrtEFy = Math.sqrt(E / Fy);
    
    // Flange slenderness (bf/2tf) - Table B4.1a Case 1
    const lambda_f = section.bf / (2 * section.tf);
    const lambda_rf = COMPRESSION_COMPACTNESS_LIMITS.flange_rolled.lambda_r_factor * sqrtEFy;
    
    let flangeClass: CompactnessClass;
    let Qs = 1.0;
    
    if (lambda_f <= lambda_rf) {
      flangeClass = CompactnessClass.NON_COMPACT;
    } else {
      flangeClass = CompactnessClass.SLENDER;
      // Calculate Qs per E7.1
      const limit1 = 0.56 * sqrtEFy;
      const limit2 = 1.03 * sqrtEFy;
      
      if (lambda_f <= limit2) {
        Qs = 1.415 - 0.74 * lambda_f * Math.sqrt(Fy / E);
      } else {
        Qs = 0.69 * E / (Fy * lambda_f * lambda_f);
      }
    }
    
    // Web slenderness (h/tw) - Table B4.1a Case 5
    const h = section.d - 2 * section.tf;
    const lambda_w = h / section.tw;
    const lambda_rw = COMPRESSION_COMPACTNESS_LIMITS.web_uniform.lambda_r_factor * sqrtEFy;
    
    let webClass: CompactnessClass;
    let Qa = 1.0;
    
    if (lambda_w <= lambda_rw) {
      webClass = CompactnessClass.NON_COMPACT;
    } else {
      webClass = CompactnessClass.SLENDER;
      // Calculate Qa per E7.2 (effective width method)
      const f = Fy; // Conservative: use Fy
      const be = 1.92 * section.tw * Math.sqrt(E / f) * 
        (1 - 0.34 / lambda_w * Math.sqrt(E / f));
      const be_limited = Math.min(be, h);
      const Ae = section.A - (h - be_limited) * section.tw;
      Qa = Ae / section.A;
    }
    
    const Q = Qs * Qa;
    
    this.addStep(
      'Check section compactness for compression',
      'λ = bf/2tf (flange), h/tw (web)',
      { 
        lambda_f: lambda_f.toFixed(2), 
        lambda_rf: lambda_rf.toFixed(2),
        lambda_w: lambda_w.toFixed(2),
        lambda_rw: lambda_rw.toFixed(2),
        Q: Q.toFixed(3),
      },
      `Flange: ${flangeClass}, Web: ${webClass}, Q = ${Q.toFixed(3)}`,
      undefined,
      'AISC 360-22 Table B4.1a'
    );
    
    return {
      flange: {
        class: flangeClass,
        lambda: lambda_f,
        lambda_r: lambda_rf,
        Qs,
      },
      web: {
        class: webClass,
        lambda: lambda_w,
        lambda_r: lambda_rw,
        Qa,
      },
      Q,
    };
  }
  
  /**
   * Calculate compression strength
   */
  private calculateCompressionStrength(compactness: ColumnCompactnessResult): CompressionStrengthResult {
    const { section, material, geometry, loads, designMethod } = this.input;
    const E = material.E || 29000;
    const Fy = material.Fy;
    
    const phi_c = COLUMN_RESISTANCE_FACTORS.phi_c;
    const omega_c = COLUMN_RESISTANCE_FACTORS.omega_c;
    
    // Get section properties with radii of gyration
    const sectionWithR = W_SHAPES_COLUMNS[section.designation] || {
      ...section,
      rx: Math.sqrt(section.Ix / section.A),
      ry: Math.sqrt(section.Iy / section.A),
    };
    
    const rx = sectionWithR.rx;
    const ry = sectionWithR.ry;
    
    // Effective length factors
    let Kx = geometry.Kx || 1.0;
    let Ky = geometry.Ky || 1.0;
    
    if (geometry.boundaryX) {
      Kx = RECOMMENDED_K_FACTORS[geometry.boundaryX];
    }
    if (geometry.boundaryY) {
      Ky = RECOMMENDED_K_FACTORS[geometry.boundaryY];
    }
    
    // Unbraced lengths
    const Lx = geometry.Lx || geometry.L;
    const Ly = geometry.Ly || geometry.L;
    
    // Effective lengths
    const Lc_x = Kx * Lx;
    const Lc_y = Ky * Ly;
    
    // Slenderness ratios
    const KL_r_x = (Lc_x * 12) / rx;
    const KL_r_y = (Lc_y * 12) / ry;
    const KL_r = Math.max(KL_r_x, KL_r_y);
    
    this.addStep(
      'Calculate slenderness ratios',
      '(KL/r)x = KxLx/rx, (KL/r)y = KyLy/ry',
      { 
        Kx: Kx.toFixed(2), 
        Ky: Ky.toFixed(2),
        Lc_x: Lc_x.toFixed(2) + ' ft',
        Lc_y: Lc_y.toFixed(2) + ' ft',
        rx: rx.toFixed(2) + ' in',
        ry: ry.toFixed(2) + ' in',
      },
      `(KL/r)x = ${KL_r_x.toFixed(1)}, (KL/r)y = ${KL_r_y.toFixed(1)}, Governing = ${KL_r.toFixed(1)}`,
      undefined,
      'AISC 360-22 E2'
    );
    
    // Check slenderness limit (KL/r ≤ 200 recommended)
    if (KL_r > 200) {
      this.addStep(
        'WARNING: Slenderness exceeds recommended limit',
        'KL/r ≤ 200 (recommended)',
        { KL_r: KL_r.toFixed(1) },
        'Consider increasing section size',
        undefined,
        'AISC 360-22 Commentary E2'
      );
    }
    
    // Elastic buckling stress
    const Fe = (Math.PI * Math.PI * E) / (KL_r * KL_r);
    
    this.addStep(
      'Calculate elastic buckling stress',
      'Fe = π²E/(KL/r)²',
      { E, KL_r: KL_r.toFixed(1) },
      Fe.toFixed(2),
      'ksi',
      'AISC 360-22 Eq. E3-4'
    );
    
    // Q factor for slender elements
    const Q = compactness.Q;
    
    // Critical stress Fcr
    let Fcr: number;
    let limitState: ColumnLimitState;
    
    const limit = 4.71 * Math.sqrt(E / (Q * Fy));
    
    if (KL_r <= limit || Q * Fy / Fe <= 2.25) {
      // Inelastic buckling
      Fcr = Q * 0.658 ** (Q * Fy / Fe) * Fy;
      limitState = Q < 1.0 ? 'LOCAL_BUCKLING' : 
        (KL_r <= 25 ? 'YIELDING' : 'INELASTIC_BUCKLING');
      
      this.addStep(
        'Calculate critical stress (inelastic buckling)',
        'Fcr = Q × (0.658^(QFy/Fe)) × Fy',
        { Q: Q.toFixed(3), Fy, Fe: Fe.toFixed(2), 'QFy/Fe': (Q * Fy / Fe).toFixed(3) },
        Fcr.toFixed(2),
        'ksi',
        'AISC 360-22 Eq. E3-2'
      );
    } else {
      // Elastic buckling
      Fcr = 0.877 * Fe;
      limitState = 'ELASTIC_BUCKLING';
      
      this.addStep(
        'Calculate critical stress (elastic buckling)',
        'Fcr = 0.877Fe',
        { Fe: Fe.toFixed(2) },
        Fcr.toFixed(2),
        'ksi',
        'AISC 360-22 Eq. E3-3'
      );
    }
    
    // Nominal strength
    const Ag = section.A;
    const Pn = Fcr * Ag;
    
    this.addStep(
      'Calculate nominal compression strength',
      'Pn = FcrAg',
      { Fcr: Fcr.toFixed(2) + ' ksi', Ag: Ag.toFixed(2) + ' in²' },
      Pn.toFixed(1),
      'kips',
      'AISC 360-22 Eq. E3-1'
    );
    
    // Design/allowable strength
    const phi_Pn = phi_c * Pn;
    const Pn_omega = Pn / omega_c;
    
    const Pu = loads.Pu;
    const capacity = designMethod === 'LRFD' ? phi_Pn : Pn_omega;
    const ratio = Pu / capacity;
    
    this.addStep(
      'Calculate design compression strength',
      designMethod === 'LRFD' ? 'φcPn = 0.90 × Pn' : 'Pn/Ωc = Pn/1.67',
      { Pn: Pn.toFixed(1), factor: designMethod === 'LRFD' ? phi_c : '1/' + omega_c },
      `${designMethod === 'LRFD' ? 'φPn' : 'Pn/Ω'} = ${capacity.toFixed(1)} kips`,
      undefined,
      'AISC 360-22 E1'
    );
    
    return {
      Pn,
      phi_Pn,
      Pn_omega,
      Pu,
      ratio,
      isAdequate: ratio <= 1.0,
      Fcr,
      Fe,
      KL_r,
      KL_r_x,
      KL_r_y,
      Kx,
      Ky,
      Lc_x,
      Lc_y,
      limitState,
    };
  }
  
  /**
   * Check P-M interaction
   */
  private checkPMInteraction(compression: CompressionStrengthResult): PMInteractionResult {
    const { section, material, geometry, loads, designMethod } = this.input;
    const E = material.E || 29000;
    const Fy = material.Fy;
    
    const phi_c = COLUMN_RESISTANCE_FACTORS.phi_c;
    const omega_c = COLUMN_RESISTANCE_FACTORS.omega_c;
    const phi_b = COLUMN_RESISTANCE_FACTORS.phi_b;
    const omega_b = COLUMN_RESISTANCE_FACTORS.omega_b;
    
    // Available compression strength
    const Pc = designMethod === 'LRFD' ? compression.phi_Pn : compression.Pn_omega;
    const Pu = loads.Pu;
    const Pu_Pc = Pu / Pc;
    
    // Available moment strengths (simplified - assume compact section)
    const Mpx = section.Zx * Fy / 12; // kip-ft
    const Mpy = section.Zy * Fy / 12; // kip-ft
    const Mcx = designMethod === 'LRFD' ? phi_b * Mpx : Mpx / omega_b;
    const Mcy = designMethod === 'LRFD' ? phi_b * Mpy : Mpy / omega_b;
    
    // Required moments
    let Mux = loads.Mux || 0;
    let Muy = loads.Muy || 0;
    
    // Second-order amplification if required
    let B1x: number | undefined;
    let B1y: number | undefined;
    let Mrx = Mux;
    let Mry = Muy;
    
    if (this.input.secondOrder) {
      // Calculate B1 factors per C2.1b
      const Cm_x = loads.Cm_x || 1.0;
      const Cm_y = loads.Cm_y || 1.0;
      
      // Euler buckling loads
      const Pe1_x = (Math.PI * Math.PI * E * section.Ix) / 
        Math.pow(compression.Lc_x * 12, 2);
      const Pe1_y = (Math.PI * Math.PI * E * section.Iy) / 
        Math.pow(compression.Lc_y * 12, 2);
      
      const alpha = designMethod === 'LRFD' ? 1.0 : 1.6;
      
      B1x = Cm_x / (1 - alpha * Pu / Pe1_x);
      B1y = Cm_y / (1 - alpha * Pu / Pe1_y);
      B1x = Math.max(B1x, 1.0);
      B1y = Math.max(B1y, 1.0);
      
      Mrx = B1x * Mux;
      Mry = B1y * Muy;
      
      this.addStep(
        'Calculate second-order amplification factors',
        'B1 = Cm/(1 - αPu/Pe1) ≥ 1.0',
        { 
          Cm_x, Cm_y, 
          B1x: B1x.toFixed(3), 
          B1y: B1y.toFixed(3),
          Pe1_x: Pe1_x.toFixed(0) + ' kips',
          Pe1_y: Pe1_y.toFixed(0) + ' kips',
        },
        `Mrx = ${Mrx.toFixed(1)} kip-ft, Mry = ${Mry.toFixed(1)} kip-ft`,
        undefined,
        'AISC 360-22 App. 8 Eq. C2-2'
      );
    }
    
    // P-M interaction check per H1.1
    let ratio: number;
    let equation: 'H1-1a' | 'H1-1b';
    
    if (Pu_Pc >= 0.2) {
      // Equation H1-1a
      ratio = Pu_Pc + (8 / 9) * (Mrx / Mcx + Mry / Mcy);
      equation = 'H1-1a';
      
      this.addStep(
        'Check P-M interaction (Pu/Pc ≥ 0.2)',
        'Pu/Pc + (8/9)(Mrx/Mcx + Mry/Mcy) ≤ 1.0',
        {
          'Pu/Pc': Pu_Pc.toFixed(3),
          'Mrx/Mcx': (Mrx / Mcx).toFixed(3),
          'Mry/Mcy': (Mry / Mcy).toFixed(3),
        },
        ratio.toFixed(3),
        undefined,
        'AISC 360-22 Eq. H1-1a'
      );
    } else {
      // Equation H1-1b
      ratio = Pu_Pc / 2 + (Mrx / Mcx + Mry / Mcy);
      equation = 'H1-1b';
      
      this.addStep(
        'Check P-M interaction (Pu/Pc < 0.2)',
        'Pu/2Pc + (Mrx/Mcx + Mry/Mcy) ≤ 1.0',
        {
          'Pu/2Pc': (Pu_Pc / 2).toFixed(3),
          'Mrx/Mcx': (Mrx / Mcx).toFixed(3),
          'Mry/Mcy': (Mry / Mcy).toFixed(3),
        },
        ratio.toFixed(3),
        undefined,
        'AISC 360-22 Eq. H1-1b'
      );
    }
    
    return {
      ratio,
      isAdequate: ratio <= 1.0,
      Pu,
      Pc,
      Pu_Pc,
      Mux,
      Muy,
      Mcx,
      Mcy,
      Mrx: this.input.secondOrder ? Mrx : undefined,
      Mry: this.input.secondOrder ? Mry : undefined,
      B1x,
      B1y,
      equation,
    };
  }
  
  /**
   * Add calculation step
   */
  private addStep(
    description: string,
    formula?: string,
    values?: Record<string, number | string>,
    result?: number | string,
    unit?: string,
    reference?: string
  ): void {
    this.calculations.push({
      step: this.stepCounter++,
      description,
      formula,
      values,
      result: result ?? '',
      unit,
      reference,
    });
  }
}

// Export convenience function
export function designSteelColumn(input: SteelColumnInput): SteelColumnResult {
  const calculator = new SteelColumnCalculator(input);
  return calculator.design();
}
