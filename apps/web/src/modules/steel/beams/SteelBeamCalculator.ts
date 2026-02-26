/**
 * Steel Beam Design Calculator
 * Per AISC 360-22 Chapters F, G
 * 
 * Features:
 * - Flexural strength (yielding, LTB, FLB)
 * - Shear strength
 * - Compactness classification
 * - Deflection check
 */

import {
  CompactnessClass,
  LateralBracing,
  SteelBeamInput,
  SteelBeamResult,
  FlexuralStrengthResult,
  ShearStrengthResult,
  CompactnessResult,
  DeflectionResult,
  CalculationStep,
  RESISTANCE_FACTORS,
  COMPACTNESS_LIMITS,
  CB_VALUES,
} from './SteelBeamTypes';

export class SteelBeamCalculator {
  private input: SteelBeamInput;
  private calculations: CalculationStep[] = [];
  private stepCounter = 1;
  
  constructor(input: SteelBeamInput) {
    this.input = input;
  }
  
  /**
   * Main design method
   */
  public design(): SteelBeamResult {
    this.calculations = [];
    this.stepCounter = 1;
    
    const { section, material, geometry, loads, designMethod } = this.input;
    
    // Step 1: Check compactness
    const compactness = this.checkCompactness();
    
    // Step 2: Calculate flexural strength
    const flexure = this.calculateFlexuralStrength(compactness);
    
    // Step 3: Calculate shear strength
    const shear = this.calculateShearStrength();
    
    // Step 4: Check deflection
    let deflection: DeflectionResult | undefined;
    if (this.input.checkDeflection) {
      deflection = this.checkDeflection();
    }
    
    // Capacity ratios
    const capacityRatios = {
      flexure: flexure.ratio,
      shear: shear.ratio,
      combined: Math.max(flexure.ratio, shear.ratio),
    };
    
    // Overall adequacy
    const isAdequate = 
      flexure.isAdequate && 
      shear.isAdequate && 
      (!deflection || deflection.isAdequate);
    
    return {
      isAdequate,
      section: section.designation,
      material: {
        grade: material.grade,
        Fy: material.Fy,
        Fu: material.Fu,
      },
      compactness,
      flexure,
      shear,
      deflection,
      capacityRatios,
      calculations: this.calculations,
      codeReference: 'AISC 360-22 Chapters F, G',
    };
  }
  
  /**
   * Check section compactness
   */
  private checkCompactness(): CompactnessResult {
    const { section, material } = this.input;
    const E = material.E || 29000;
    const Fy = material.Fy;
    
    const sqrtEFy = Math.sqrt(E / Fy);
    
    // Flange slenderness (bf/2tf)
    const lambda_f = section.bf / (2 * section.tf);
    const lambda_pf = COMPACTNESS_LIMITS.flange_rolled.lambda_p_factor * sqrtEFy;
    const lambda_rf = COMPACTNESS_LIMITS.flange_rolled.lambda_r_factor * sqrtEFy;
    
    let flangeClass: CompactnessClass;
    if (lambda_f <= lambda_pf) flangeClass = CompactnessClass.COMPACT;
    else if (lambda_f <= lambda_rf) flangeClass = CompactnessClass.NON_COMPACT;
    else flangeClass = CompactnessClass.SLENDER;
    
    // Web slenderness (h/tw)
    const h = section.d - 2 * section.tf; // Clear depth between flanges
    const lambda_w = h / section.tw;
    const lambda_pw = COMPACTNESS_LIMITS.web_flexure.lambda_p_factor * sqrtEFy;
    const lambda_rw = COMPACTNESS_LIMITS.web_flexure.lambda_r_factor * sqrtEFy;
    
    let webClass: CompactnessClass;
    if (lambda_w <= lambda_pw) webClass = CompactnessClass.COMPACT;
    else if (lambda_w <= lambda_rw) webClass = CompactnessClass.NON_COMPACT;
    else webClass = CompactnessClass.SLENDER;
    
    this.addStep(
      'Check section compactness',
      'λ = bf/2tf (flange), h/tw (web)',
      { 
        lambda_f: lambda_f.toFixed(2), 
        lambda_pf: lambda_pf.toFixed(2),
        lambda_w: lambda_w.toFixed(2),
        lambda_pw: lambda_pw.toFixed(2),
      },
      `Flange: ${flangeClass}, Web: ${webClass}`,
      undefined,
      'AISC 360-22 Table B4.1b'
    );
    
    return {
      flange: {
        class: flangeClass,
        lambda: lambda_f,
        lambda_p: lambda_pf,
        lambda_r: lambda_rf,
      },
      web: {
        class: webClass,
        lambda: lambda_w,
        lambda_p: lambda_pw,
        lambda_r: lambda_rw,
      },
    };
  }
  
  /**
   * Calculate flexural strength
   */
  private calculateFlexuralStrength(compactness: CompactnessResult): FlexuralStrengthResult {
    const { section, material, geometry, loads, designMethod } = this.input;
    const E = material.E || 29000;
    const Fy = material.Fy;
    
    const phi_b = RESISTANCE_FACTORS.phi_b;
    const omega_b = RESISTANCE_FACTORS.omega_b;
    
    // Plastic moment
    const Mp = section.Zx * Fy / 12; // kip-ft
    
    this.addStep(
      'Calculate plastic moment',
      'Mp = Fy × Zx',
      { Fy, Zx: section.Zx },
      Mp.toFixed(1),
      'kip-ft',
      'AISC 360-22 Eq. F2-1'
    );
    
    // Limiting unbraced lengths
    const Lp = 1.76 * section.ry * Math.sqrt(E / Fy) / 12; // ft
    
    const c = 1.0; // Doubly symmetric I-shape
    const rts = section.rts;
    const ho = section.ho;
    const J = section.J;
    const Sx = section.Sx;
    
    const Lr = 1.95 * rts * (E / (0.7 * Fy)) * 
      Math.sqrt(J * c / (Sx * ho) + 
        Math.sqrt(Math.pow(J * c / (Sx * ho), 2) + 
          6.76 * Math.pow(0.7 * Fy / E, 2))) / 12; // ft
    
    this.addStep(
      'Calculate limiting unbraced lengths',
      'Lp = 1.76ry√(E/Fy), Lr per Eq. F2-6',
      { Lp: Lp.toFixed(2) + ' ft', Lr: Lr.toFixed(2) + ' ft' },
      `Lp = ${Lp.toFixed(2)} ft, Lr = ${Lr.toFixed(2)} ft`,
      undefined,
      'AISC 360-22 Eq. F2-5, F2-6'
    );
    
    // Unbraced length and Cb
    const Lb = geometry.Lb;
    let Cb = geometry.Cb || 1.0;
    
    if (geometry.bracingType === LateralBracing.CONTINUOUSLY_BRACED) {
      Cb = 1.0;
    } else if (!geometry.Cb) {
      // Default Cb based on loading
      Cb = CB_VALUES.simple_uniform;
    }
    
    // Determine limit state and Mn
    let Mn: number;
    let limitState: FlexuralStrengthResult['limitState'];
    
    if (Lb <= Lp) {
      // Yielding (plastic moment)
      Mn = Mp;
      limitState = 'YIELDING';
      
      this.addStep(
        'Check LTB: Lb ≤ Lp (Yielding governs)',
        'Mn = Mp (no LTB)',
        { Lb, Lp: Lp.toFixed(2) },
        Mn.toFixed(1),
        'kip-ft',
        'AISC 360-22 F2.1'
      );
    } else if (Lb <= Lr) {
      // Inelastic LTB
      const Mr = 0.7 * Fy * Sx / 12; // kip-ft
      Mn = Cb * (Mp - (Mp - Mr) * (Lb - Lp) / (Lr - Lp));
      Mn = Math.min(Mn, Mp); // Cannot exceed Mp
      limitState = 'LTB_INELASTIC';
      
      this.addStep(
        'Check LTB: Lp < Lb ≤ Lr (Inelastic LTB)',
        'Mn = Cb[Mp - (Mp - 0.7FySx)(Lb - Lp)/(Lr - Lp)] ≤ Mp',
        { Lb, Cb: Cb.toFixed(2), Mp: Mp.toFixed(1) },
        Mn.toFixed(1),
        'kip-ft',
        'AISC 360-22 Eq. F2-2'
      );
    } else {
      // Elastic LTB
      const Fcr = (Cb * Math.PI * Math.PI * E / Math.pow(Lb * 12 / rts, 2)) *
        Math.sqrt(1 + 0.078 * (J * c / (Sx * ho)) * Math.pow(Lb * 12 / rts, 2));
      Mn = Fcr * Sx / 12; // kip-ft
      Mn = Math.min(Mn, Mp);
      limitState = 'LTB_ELASTIC';
      
      this.addStep(
        'Check LTB: Lb > Lr (Elastic LTB)',
        'Mn = FcrSx ≤ Mp',
        { Lb, Fcr: Fcr.toFixed(1) + ' ksi' },
        Mn.toFixed(1),
        'kip-ft',
        'AISC 360-22 Eq. F2-3, F2-4'
      );
    }
    
    // Check flange local buckling if non-compact
    if (compactness.flange.class === CompactnessClass.NON_COMPACT) {
      const lambda = compactness.flange.lambda;
      const lambda_pf = compactness.flange.lambda_p;
      const lambda_rf = compactness.flange.lambda_r;
      const Mn_FLB = Mp - (Mp - 0.7 * Fy * section.Sx / 12) * 
        (lambda - lambda_pf) / (lambda_rf - lambda_pf);
      
      if (Mn_FLB < Mn) {
        Mn = Mn_FLB;
        limitState = 'FLB';
      }
    }
    
    // Design/allowable strength
    const phi_Mn = phi_b * Mn;
    const Mn_omega = Mn / omega_b;
    
    const Mu = loads.Mu;
    const capacity = designMethod === 'LRFD' ? phi_Mn : Mn_omega;
    const ratio = Mu / capacity;
    
    this.addStep(
      'Calculate design flexural strength',
      designMethod === 'LRFD' ? 'φbMn = 0.90 × Mn' : 'Mn/Ωb = Mn/1.67',
      { Mn: Mn.toFixed(1), phi_b: designMethod === 'LRFD' ? phi_b : '1/' + omega_b },
      `${designMethod === 'LRFD' ? 'φMn' : 'Mn/Ω'} = ${capacity.toFixed(1)} kip-ft`,
      undefined,
      'AISC 360-22 F1'
    );
    
    return {
      Mn,
      phi_Mn,
      Mn_omega,
      Mu,
      ratio,
      isAdequate: ratio <= 1.0,
      limitState,
      Lp,
      Lr,
      Lb,
      Cb,
      Mp,
    };
  }
  
  /**
   * Calculate shear strength
   */
  private calculateShearStrength(): ShearStrengthResult {
    const { section, material, loads, designMethod } = this.input;
    const E = material.E || 29000;
    const Fy = material.Fy;
    
    const phi_v = RESISTANCE_FACTORS.phi_v;
    const omega_v = RESISTANCE_FACTORS.omega_v;
    
    // Web area
    const h = section.d - 2 * section.tf;
    const Aw = section.d * section.tw;
    const h_tw = h / section.tw;
    
    // Web shear coefficient Cv1 (AISC 360-22 G2.1)
    const kv = 5.34; // Unstiffened web
    const limit1 = 2.24 * Math.sqrt(E / Fy);
    const limit2 = 1.10 * Math.sqrt(kv * E / Fy);
    
    let Cv1: number;
    if (h_tw <= limit1) {
      Cv1 = 1.0;
    } else if (h_tw <= limit2) {
      Cv1 = 1.0; // Still in yielding range for most rolled shapes
    } else {
      Cv1 = 1.10 * Math.sqrt(kv * E / Fy) / h_tw;
    }
    
    // Nominal shear strength
    const Vn = 0.6 * Fy * Aw * Cv1; // kips
    
    this.addStep(
      'Calculate nominal shear strength',
      'Vn = 0.6FyAwCv1',
      { Fy, Aw: Aw.toFixed(2), Cv1: Cv1.toFixed(3), h_tw: h_tw.toFixed(1) },
      Vn.toFixed(1),
      'kips',
      'AISC 360-22 Eq. G2-1'
    );
    
    // Design/allowable strength
    const phi_Vn = phi_v * Vn;
    const Vn_omega = Vn / omega_v;
    
    const Vu = loads.Vu;
    const capacity = designMethod === 'LRFD' ? phi_Vn : Vn_omega;
    const ratio = Vu / capacity;
    
    this.addStep(
      'Calculate design shear strength',
      designMethod === 'LRFD' ? 'φvVn = 1.0 × Vn' : 'Vn/Ωv = Vn/1.50',
      { Vn: Vn.toFixed(1), phi_v: designMethod === 'LRFD' ? phi_v : '1/' + omega_v },
      `${designMethod === 'LRFD' ? 'φVn' : 'Vn/Ω'} = ${capacity.toFixed(1)} kips`,
      undefined,
      'AISC 360-22 G1'
    );
    
    return {
      Vn,
      phi_Vn,
      Vn_omega,
      Vu,
      ratio,
      isAdequate: ratio <= 1.0,
      Cv1,
      Aw,
      h_tw,
    };
  }
  
  /**
   * Check deflection
   */
  private checkDeflection(): DeflectionResult {
    const { section, material, geometry, loads } = this.input;
    const E = material.E || 29000;
    const I = section.Ix;
    const L = geometry.L * 12; // inches
    
    // Deflection limits
    const limit_total = this.input.deflectionLimit_L || 240;
    const limit_L = this.input.deflectionLimit_LL || 360;
    
    // Calculate deflections (uniform load case)
    // Δ = 5wL⁴ / (384EI)
    const wD = (loads.wD || 0) / 12; // kip/in
    const wL = (loads.wL || 0) / 12; // kip/in
    
    const delta_D = wD > 0 ? (5 * wD * Math.pow(L, 4)) / (384 * E * I) : 0;
    const delta_L = wL > 0 ? (5 * wL * Math.pow(L, 4)) / (384 * E * I) : 0;
    const delta_total = delta_D + delta_L;
    
    const L_delta_total = delta_total > 0 ? L / delta_total : Infinity;
    const L_delta_L = delta_L > 0 ? L / delta_L : Infinity;
    
    const isAdequate = L_delta_total >= limit_total && L_delta_L >= limit_L;
    
    this.addStep(
      'Check deflection',
      'Δ = 5wL⁴/(384EI)',
      { 
        delta_D: delta_D.toFixed(3) + ' in', 
        delta_L: delta_L.toFixed(3) + ' in',
        'L/Δtotal': L_delta_total.toFixed(0),
        'L/ΔL': L_delta_L.toFixed(0),
      },
      isAdequate ? 'OK' : 'NG',
      undefined,
      'AISC Design Guide 3'
    );
    
    return {
      delta_D,
      delta_L,
      delta_total,
      L_delta_total,
      L_delta_L,
      limit_total,
      limit_L,
      isAdequate,
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
export function designSteelBeam(input: SteelBeamInput): SteelBeamResult {
  const calculator = new SteelBeamCalculator(input);
  return calculator.design();
}
