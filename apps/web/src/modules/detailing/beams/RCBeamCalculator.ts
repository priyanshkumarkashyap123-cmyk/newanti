/**
 * RC Beam Design Calculator
 * Per ACI 318-19 Chapters 9, 18, 22
 * 
 * Design process:
 * 1. Calculate effective depth
 * 2. Design flexural reinforcement
 * 3. Design shear reinforcement
 * 4. Check torsion (if applicable)
 * 5. Check deflection
 * 6. Determine bar cutoff locations
 */

import {
  RCBeamInput,
  RCBeamResult,
  FlexuralDesignResult,
  ShearDesignResult,
  TorsionDesignResult,
  DeflectionResult,
  BarCutoffResult,
  CalculationStep,
  BeamType,
  TorsionCategory,
  SeismicBeamCategory,
  ACI_BEAM_LIMITS,
  SEISMIC_BEAM_REQUIREMENTS,
  REBAR_DATA_BEAM,
} from './BeamDesignTypes';

export class RCBeamCalculator {
  private phi_f = 0.90; // Flexure (tension-controlled)
  private phi_v = 0.75; // Shear
  private phi_t = 0.75; // Torsion
  private beta1 = 0.85; // Default for f'c ≤ 4000 psi
  
  /**
   * Main calculation method for RC beam design
   */
  calculate(input: RCBeamInput): RCBeamResult {
    const steps: CalculationStep[] = [];
    
    // Update beta1 for high-strength concrete
    this.beta1 = this.calculateBeta1(input.materials.fc);
    
    // Step 1: Calculate effective depth
    const d = this.calculateEffectiveDepth(input, steps);
    const section = {
      b: input.geometry.b,
      h: input.geometry.h,
      d,
      beff: input.geometry.beff,
      type: input.geometry.type,
    };
    
    // Step 2: Design positive flexural reinforcement
    const flexure_pos = this.designFlexure(input, d, input.loads.Mu_pos, 'POSITIVE', steps);
    
    // Step 3: Design negative flexural reinforcement (if applicable)
    let flexure_neg_left: FlexuralDesignResult | undefined;
    let flexure_neg_right: FlexuralDesignResult | undefined;
    
    if (input.loads.Mu_neg_left && input.loads.Mu_neg_left > 0) {
      flexure_neg_left = this.designFlexure(input, d, input.loads.Mu_neg_left, 'NEG_LEFT', steps);
    }
    if (input.loads.Mu_neg_right && input.loads.Mu_neg_right > 0) {
      flexure_neg_right = this.designFlexure(input, d, input.loads.Mu_neg_right, 'NEG_RIGHT', steps);
    }
    
    // Step 4: Design shear reinforcement
    const shear = this.designShear(input, d, steps);
    
    // Step 5: Check torsion (if applicable)
    let torsion: TorsionDesignResult | undefined;
    if (input.loads.Tu && input.loads.Tu > 0) {
      torsion = this.checkTorsion(input, d, shear, steps);
    }
    
    // Step 6: Check deflection (if requested)
    let deflection: DeflectionResult | undefined;
    if (input.checkDeflection) {
      deflection = this.checkDeflection(input, d, flexure_pos, steps);
    }
    
    // Step 7: Determine bar cutoff locations
    const barCutoff = this.determineBarCutoff(input, d, flexure_pos, flexure_neg_left, flexure_neg_right, steps);
    
    // Seismic details (if applicable)
    let seismicDetails;
    if (input.seismicCategory !== SeismicBeamCategory.ORDINARY) {
      seismicDetails = this.getSeismicDetails(input, d, flexure_pos);
    }
    
    // Overall adequacy
    const isAdequate = 
      flexure_pos.isAdequate &&
      (!flexure_neg_left || flexure_neg_left.isAdequate) &&
      (!flexure_neg_right || flexure_neg_right.isAdequate) &&
      shear.isAdequate &&
      (!torsion || torsion.isAdequate) &&
      (!deflection || deflection.isAdequate);
    
    return {
      isAdequate,
      section,
      flexure: {
        positive: flexure_pos,
        negative_left: flexure_neg_left,
        negative_right: flexure_neg_right,
      },
      shear,
      torsion,
      deflection,
      barCutoff,
      seismicDetails,
      calculations: steps,
      codeReference: 'ACI 318-19 Chapters 9, 18, 22'
    };
  }
  
  /**
   * Calculate beta1 for stress block depth
   */
  private calculateBeta1(fc: number): number {
    if (fc <= 4000) return 0.85;
    if (fc >= 8000) return 0.65;
    return 0.85 - 0.05 * (fc - 4000) / 1000;
  }
  
  /**
   * Calculate effective depth
   */
  private calculateEffectiveDepth(
    input: RCBeamInput,
    steps: CalculationStep[]
  ): number {
    if (input.geometry.d) return input.geometry.d;
    
    const h = input.geometry.h;
    const cover = input.geometry.cover;
    
    // Estimate: cover + stirrup + half bar diameter
    // Assume #4 stirrup, #8 bars
    const d = h - cover - 0.5 - 0.5;
    
    steps.push({
      step: 1,
      description: 'Effective depth calculation',
      formula: 'd = h - cover - d_stirrup - db/2',
      values: { h, cover },
      result: d,
      unit: 'in'
    });
    
    return d;
  }
  
  /**
   * Design flexural reinforcement
   */
  private designFlexure(
    input: RCBeamInput,
    d: number,
    Mu: number,
    location: 'POSITIVE' | 'NEG_LEFT' | 'NEG_RIGHT',
    steps: CalculationStep[]
  ): FlexuralDesignResult {
    const fc = input.materials.fc;
    const fy = input.materials.fy;
    const b = input.geometry.b;
    const h = input.geometry.h;
    
    // Use effective width for T-beam in positive moment
    const b_design = (location === 'POSITIVE' && input.geometry.beff) 
      ? input.geometry.beff 
      : b;
    
    // Minimum steel (ACI 318 9.6.1.2)
    const As_min = Math.max(
      3 * Math.sqrt(fc) / fy * b * d,
      200 / fy * b * d
    );
    
    // Maximum steel (tension-controlled limit)
    const rho_max = 0.85 * this.beta1 * fc / fy * (0.003 / (0.003 + 0.005));
    const As_max = rho_max * b * d;
    
    // Required steel from moment
    // Mu = φ × As × fy × (d - a/2)
    // a = As × fy / (0.85 × f'c × b)
    
    // Solve quadratic
    const R = Mu * 12000 / (this.phi_f * b_design * d * d); // psi
    const rho_required = 0.85 * fc / fy * (1 - Math.sqrt(1 - 2 * R / (0.85 * fc)));
    let As_required = rho_required * b_design * d;
    
    // Apply minimum
    As_required = Math.max(As_required, As_min);
    
    // Check against maximum
    if (As_required > As_max) {
      // Need compression steel or increase section
      As_required = As_max;
    }
    
    // Select bars
    const bars = this.selectFlexuralBars(As_required, b, input.geometry.cover, input.maxBarSize);
    const As_provided = bars.quantity * REBAR_DATA_BEAM[bars.size].Ab;
    
    // Calculate actual capacity
    const a = As_provided * fy / (0.85 * fc * b_design);
    const c = a / this.beta1;
    const epsilon_t = 0.003 * (d - c) / c;
    const phi_actual = epsilon_t >= 0.005 ? 0.90 : 0.65 + (epsilon_t - 0.002) * 250 / 3;
    const phi_Mn = phi_actual * As_provided * fy * (d - a / 2) / 12000;
    
    const stepNum = location === 'POSITIVE' ? 2 : (location === 'NEG_LEFT' ? 3 : 4);
    steps.push({
      step: stepNum,
      description: `Flexural design - ${location}`,
      formula: 'Mu = φ × As × fy × (d - a/2)',
      values: { 
        Mu,
        As_required: As_required.toFixed(2),
        As_provided: As_provided.toFixed(2),
        a: a.toFixed(2)
      },
      result: `${bars.quantity}-${bars.size}`,
      reference: 'ACI 318-19 22.2'
    });
    
    return {
      location,
      Mu,
      phi_Mn,
      ratio: Mu / phi_Mn,
      isAdequate: Mu <= phi_Mn && As_required <= As_max,
      As_required,
      As_min,
      As_max,
      As_provided,
      bars,
      a,
      c,
      epsilon_t,
      isCompressionControlled: epsilon_t < 0.002
    };
  }
  
  /**
   * Select flexural reinforcement bars
   */
  private selectFlexuralBars(
    As_required: number,
    b: number,
    cover: number,
    maxSize?: string
  ): { size: string; quantity: number; layers: number } {
    const sizes = ['#6', '#7', '#8', '#9', '#10', '#11'];
    const availableSizes = maxSize 
      ? sizes.filter(s => REBAR_DATA_BEAM[s].db <= REBAR_DATA_BEAM[maxSize].db)
      : sizes;
    
    for (const size of availableSizes) {
      const Ab = REBAR_DATA_BEAM[size].Ab;
      const db = REBAR_DATA_BEAM[size].db;
      
      // Calculate maximum bars in one layer
      const clearWidth = b - 2 * cover - 2 * 0.5; // 0.5" stirrup
      const minSpacing = Math.max(db, 1, 1); // db, 1", 1" (assume 1" aggregate)
      const maxBarsPerLayer = Math.floor((clearWidth + minSpacing) / (db + minSpacing));
      
      const n_required = Math.ceil(As_required / Ab);
      
      if (n_required <= maxBarsPerLayer) {
        return { size, quantity: n_required, layers: 1 };
      } else if (n_required <= 2 * maxBarsPerLayer) {
        return { size, quantity: n_required, layers: 2 };
      }
    }
    
    // Default: largest size, multiple layers
    return { 
      size: '#11', 
      quantity: Math.ceil(As_required / REBAR_DATA_BEAM['#11'].Ab),
      layers: 2
    };
  }
  
  /**
   * Design shear reinforcement
   */
  private designShear(
    input: RCBeamInput,
    d: number,
    steps: CalculationStep[]
  ): ShearDesignResult {
    const fc = input.materials.fc;
    const fyt = input.materials.fyt;
    const b = input.geometry.b;
    const lambda = input.materials.lambda || 1.0;
    
    // Critical shear at d from face of support
    const Vu_max = Math.max(input.loads.Vu_left, input.loads.Vu_right);
    const Vu = Vu_max; // Simplified - should interpolate
    
    // Concrete contribution (ACI 318 22.5.5.1)
    const Vc = 2 * lambda * Math.sqrt(fc) * b * d / 1000;
    const phi_Vc = this.phi_v * Vc;
    
    // Check if shear reinforcement is required
    const Vu_threshold = phi_Vc / 2;
    
    // Required Vs
    const Vs_required = (Vu / this.phi_v) - Vc;
    const Vs_max = 8 * Math.sqrt(fc) * b * d / 1000;
    
    // Design stirrups
    const stirrupSize = input.preferredStirrupSize || '#4';
    const Av = 2 * REBAR_DATA_BEAM[stirrupSize].Ab; // 2-leg stirrup
    
    let s_max: number;
    let s_required: number;
    
    if (Vs_required <= 0) {
      // Minimum shear reinforcement
      s_max = Math.min(d / 2, 24);
      s_required = s_max;
    } else if (Vs_required <= 4 * Math.sqrt(fc) * b * d / 1000) {
      // Vs ≤ 4√f'c × bw × d
      s_max = Math.min(d / 2, 24);
      s_required = Av * fyt * d / (Vs_required * 1000);
      s_required = Math.min(s_required, s_max);
    } else if (Vs_required <= Vs_max) {
      // 4√f'c × bw × d < Vs ≤ 8√f'c × bw × d
      s_max = Math.min(d / 4, 12);
      s_required = Av * fyt * d / (Vs_required * 1000);
      s_required = Math.min(s_required, s_max);
    } else {
      // Vs > 8√f'c × bw × d - section too small
      s_required = 0;
      s_max = 0;
    }
    
    // Round to practical spacing
    const s_provided = Math.floor(s_required / 0.5) * 0.5;
    
    // Calculate actual Vs
    const Vs_provided = Av * fyt * d / (s_provided * 1000);
    const phi_Vs = this.phi_v * Vs_provided;
    const phi_Vn = phi_Vc + phi_Vs;
    
    steps.push({
      step: 5,
      description: 'Shear design',
      formula: 'Vs = Av × fyt × d / s',
      values: { 
        Vu,
        phi_Vc: phi_Vc.toFixed(1),
        Vs_required: Vs_required.toFixed(1),
        s_provided
      },
      result: `${stirrupSize} @ ${s_provided}"`,
      reference: 'ACI 318-19 22.5'
    });
    
    // Define stirrup regions
    const regions = this.defineStirrupRegions(input, d, Vu_max, phi_Vc, stirrupSize, fyt);
    
    return {
      Vu,
      phi_Vc,
      phi_Vs,
      phi_Vn,
      ratio: Vu / phi_Vn,
      isAdequate: Vu <= phi_Vn && Vs_required <= Vs_max,
      stirrups: {
        size: stirrupSize,
        legs: 2,
        spacing_max: s_max,
        spacing_min: s_provided,
        spacing_provided: s_provided
      },
      regions
    };
  }
  
  /**
   * Define stirrup spacing regions
   */
  private defineStirrupRegions(
    input: RCBeamInput,
    d: number,
    Vu_max: number,
    phi_Vc: number,
    stirrupSize: string,
    fyt: number
  ): ShearDesignResult['regions'] {
    const L = input.geometry.L * 12; // Convert to inches
    const Av = 2 * REBAR_DATA_BEAM[stirrupSize].Ab;
    
    const regions: ShearDesignResult['regions'] = [];
    
    // For continuous beam with varying shear
    // Simplified: three regions
    
    // Region 1: Near supports (high shear)
    const Vs_end = (Vu_max / this.phi_v) - phi_Vc / this.phi_v;
    const s_end = Vs_end > 0 ? Math.min(Av * fyt * d / (Vs_end * 1000), d / 2) : d / 2;
    
    regions.push({
      start: 0,
      end: L * 0.25,
      spacing: Math.floor(s_end / 0.5) * 0.5,
      stirrupSize
    });
    
    // Region 2: Middle (lower shear)
    const s_mid = Math.min(d / 2, 12);
    regions.push({
      start: L * 0.25,
      end: L * 0.75,
      spacing: s_mid,
      stirrupSize
    });
    
    // Region 3: Other end
    regions.push({
      start: L * 0.75,
      end: L,
      spacing: Math.floor(s_end / 0.5) * 0.5,
      stirrupSize
    });
    
    return regions;
  }
  
  /**
   * Check torsion
   */
  private checkTorsion(
    input: RCBeamInput,
    d: number,
    shear: ShearDesignResult,
    steps: CalculationStep[]
  ): TorsionDesignResult {
    const fc = input.materials.fc;
    const fyt = input.materials.fyt;
    const fy = input.materials.fy;
    const b = input.geometry.b;
    const h = input.geometry.h;
    const Tu = input.loads.Tu || 0;
    const lambda = input.materials.lambda || 1.0;
    
    // Section properties for torsion
    const Acp = b * h;
    const pcp = 2 * (b + h);
    
    // Cracking torque (ACI 318 22.7.5.1)
    const Tcr = 4 * lambda * Math.sqrt(fc) * Acp * Acp / pcp / 1000;
    const phi_Tcr = this.phi_t * Tcr;
    
    // Check if torsion can be neglected
    if (Tu < 0.25 * phi_Tcr) {
      return {
        category: TorsionCategory.NEGLIGIBLE,
        Tu,
        phi_Tcr,
        phi_Tn: phi_Tcr,
        ratio: Tu / phi_Tcr,
        isAdequate: true,
        Al_required: 0,
        At_s_required: 0
      };
    }
    
    // Torsion must be considered
    // Assume thin-walled tube model
    const cover = input.geometry.cover;
    const Aoh = (b - 2 * cover) * (h - 2 * cover);
    const ph = 2 * ((b - 2 * cover) + (h - 2 * cover));
    const Ao = 0.85 * Aoh;
    
    // Required At/s for torsion
    const theta = 45; // Assume 45° strut angle
    const At_s_torsion = Tu * 12 / (2 * Ao * fyt * Math.cos(theta * Math.PI / 180) * Math.sin(theta * Math.PI / 180));
    
    // Combined with shear stirrups
    const Av_s_shear = shear.stirrups.legs * REBAR_DATA_BEAM[shear.stirrups.size].Ab / shear.stirrups.spacing_provided;
    
    // Longitudinal steel for torsion
    const Al_required = At_s_torsion * ph * fyt / fy * Math.pow(Math.cos(theta * Math.PI / 180), 2);
    
    // Torsional capacity
    const Tn = 2 * Ao * At_s_torsion * fyt / 12 * 1000; // Approximate
    const phi_Tn = this.phi_t * Tn;
    
    steps.push({
      step: 6,
      description: 'Torsion check',
      formula: 'Tn = 2 × Ao × (At/s) × fyt × cotθ',
      values: { 
        Tu,
        phi_Tcr: phi_Tcr.toFixed(1),
        Ao,
        At_s_torsion: At_s_torsion.toFixed(4)
      },
      result: Tu <= phi_Tn ? 'OK' : 'NG',
      reference: 'ACI 318-19 22.7'
    });
    
    return {
      category: Tu <= phi_Tcr ? TorsionCategory.COMPATIBILITY : TorsionCategory.EQUILIBRIUM,
      Tu,
      phi_Tcr,
      phi_Tn,
      ratio: Tu / phi_Tn,
      isAdequate: Tu <= phi_Tn,
      Al_required,
      At_s_required: At_s_torsion,
      combinedStirrups: {
        size: shear.stirrups.size,
        legs: shear.stirrups.legs + 2, // Add closed stirrup for torsion
        spacing: shear.stirrups.spacing_provided
      }
    };
  }
  
  /**
   * Check deflection
   */
  private checkDeflection(
    input: RCBeamInput,
    d: number,
    flexure: FlexuralDesignResult,
    steps: CalculationStep[]
  ): DeflectionResult {
    const fc = input.materials.fc;
    const Es = (input.materials.Es || 29000) * 1000; // psi
    const b = input.geometry.b;
    const h = input.geometry.h;
    const L = input.geometry.L * 12; // inches
    const wD = input.loads.wD / 12; // kip/in
    const wL = input.loads.wL / 12;
    
    // Modulus of rupture
    const fr = 7.5 * Math.sqrt(fc);
    
    // Modular ratio
    const Ec = 57000 * Math.sqrt(fc);
    const n = Es / Ec;
    
    // Gross moment of inertia
    const Ig = b * h * h * h / 12;
    
    // Cracking moment
    const yt = h / 2;
    const Mcr = fr * Ig / yt / 12000; // kip-ft
    
    // Service moment (approximate)
    const Ma = (wD + wL) * L * L / 8 / 12; // kip-ft
    
    // Effective moment of inertia (ACI 318 24.2.3.5)
    let Ie: number;
    if (Ma <= Mcr) {
      Ie = Ig;
    } else {
      // Cracked moment of inertia
      const As = flexure.As_provided;
      const rho = As / (b * d);
      const k = Math.sqrt(2 * rho * n + (rho * n) * (rho * n)) - rho * n;
      const Icr = b * Math.pow(k * d, 3) / 3 + n * As * Math.pow(d - k * d, 2);
      
      Ie = Math.pow(Mcr / Ma, 3) * Ig + (1 - Math.pow(Mcr / Ma, 3)) * Icr;
      Ie = Math.min(Ie, Ig);
    }
    
    // Immediate deflection (simply supported, uniform load)
    const delta_imm = 5 * (wD + wL) * 1000 * Math.pow(L, 4) / (384 * Ec * Ie);
    
    // Long-term deflection
    const rho_prime = 0; // Assume no compression steel
    const xi = 2.0; // 5 years or more
    const lambda_LT = xi / (1 + 50 * rho_prime);
    const delta_LT = lambda_LT * 5 * wD * 1000 * Math.pow(L, 4) / (384 * Ec * Ie);
    
    const delta_total = delta_imm + delta_LT;
    const limit = L / (input.deflectionLimit || 240);
    
    steps.push({
      step: 7,
      description: 'Deflection check',
      formula: 'Δ = 5wL⁴ / (384EcIe)',
      values: { 
        Ie: Ie.toFixed(0),
        delta_imm: delta_imm.toFixed(3),
        delta_LT: delta_LT.toFixed(3),
        limit: limit.toFixed(2)
      },
      result: delta_total <= limit ? 'OK' : 'NG',
      reference: 'ACI 318-19 24.2'
    });
    
    return {
      Ie,
      delta_imm,
      delta_LT,
      delta_total,
      limit,
      ratio: delta_total / limit,
      isAdequate: delta_total <= limit
    };
  }
  
  /**
   * Determine bar cutoff locations
   */
  private determineBarCutoff(
    input: RCBeamInput,
    d: number,
    flexure_pos: FlexuralDesignResult,
    flexure_neg_left: FlexuralDesignResult | undefined,
    flexure_neg_right: FlexuralDesignResult | undefined,
    steps: CalculationStep[]
  ): BarCutoffResult {
    const L = input.geometry.L * 12;
    const db = REBAR_DATA_BEAM[flexure_pos.bars.size].db;
    
    // Development length (simplified)
    const fc = input.materials.fc;
    const fy = input.materials.fy;
    const ld = (fy / (25 * Math.sqrt(fc))) * db;
    
    // Bottom bars: extend at least ld past theoretical cutoff
    // For simply supported: all bars to support
    // For continuous: some may be cut off
    
    const bottom = {
      fullLength: Math.ceil(flexure_pos.bars.quantity * 0.5), // Half continue full length
      cutoff: [{
        quantity: flexure_pos.bars.quantity - Math.ceil(flexure_pos.bars.quantity * 0.5),
        location: L * 0.15, // Cut at 15% from support
        developmentOK: L * 0.15 >= ld
      }]
    };
    
    // Top bars at negative moment regions
    const inflectionPoint = L * 0.25; // Approximate
    const top_cutoff = Math.max(inflectionPoint + d, inflectionPoint + 12 * db, inflectionPoint + L / 16) + ld;
    
    const top = {
      left: {
        quantity: flexure_neg_left?.bars.quantity || 0,
        cutoffLocation: Math.min(top_cutoff, L * 0.4)
      },
      right: {
        quantity: flexure_neg_right?.bars.quantity || 0,
        cutoffLocation: Math.min(top_cutoff, L * 0.4)
      }
    };
    
    steps.push({
      step: 8,
      description: 'Bar cutoff locations',
      values: { 
        ld: ld.toFixed(1),
        bottom_cutoff: bottom.cutoff[0].location.toFixed(0),
        top_cutoff: top.left.cutoffLocation.toFixed(0)
      },
      result: 'See details',
      reference: 'ACI 318-19 9.7.3'
    });
    
    return { bottom, top };
  }
  
  /**
   * Get seismic detailing requirements
   */
  private getSeismicDetails(
    input: RCBeamInput,
    d: number,
    flexure: FlexuralDesignResult
  ): RCBeamResult['seismicDetails'] {
    const h = input.geometry.h;
    const db_long = REBAR_DATA_BEAM[flexure.bars.size].db;
    
    const reqs = input.seismicCategory === SeismicBeamCategory.SPECIAL
      ? SEISMIC_BEAM_REQUIREMENTS.SMF
      : SEISMIC_BEAM_REQUIREMENTS.IMF;
    
    return {
      rho_max: reqs.rho_max,
      clearSpacing_min: Math.max(1.5 * db_long, 1.5, 1),
      stirrup_s_max: Math.min(d / 4, 8 * db_long, 24 * 0.5, 12),
      hinge_length: reqs.hinge_length_factor * h
    };
  }
}

// Export singleton instance
export const rcBeamCalculator = new RCBeamCalculator();
