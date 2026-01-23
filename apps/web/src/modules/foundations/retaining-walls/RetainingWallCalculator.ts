/**
 * Retaining Wall Design Calculator
 * Per ACI 318-19, AASHTO LRFD
 * 
 * Features:
 * - Earth pressure calculation (Rankine/Coulomb)
 * - Stability analysis (overturning, sliding, bearing)
 * - Stem design (flexure, shear)
 * - Footing design (heel, toe)
 */

import {
  RetainingWallType,
  BackfillSlope,
  EarthPressureTheory,
  RetainingWallInput,
  RetainingWallResult,
  EarthPressureResult,
  StabilityResult,
  StemDesignResult,
  HeelDesignResult,
  ToeDesignResult,
  CalculationStep,
  MINIMUM_FS,
  RETAINING_WALL_LOAD_FACTORS,
  RETAINING_WALL_RESISTANCE_FACTORS,
  REBAR_AREAS,
  calculateKa_Rankine,
  calculateKp_Rankine,
} from './RetainingWallTypes';

export class RetainingWallCalculator {
  private input: RetainingWallInput;
  private calculations: CalculationStep[] = [];
  private stepCounter = 1;
  
  // Intermediate results
  private weights: {
    W_stem: number;
    W_footing: number;
    W_soil_heel: number;
    W_total: number;
    x_resultant: number;
  } = { W_stem: 0, W_footing: 0, W_soil_heel: 0, W_total: 0, x_resultant: 0 };
  
  constructor(input: RetainingWallInput) {
    this.input = input;
  }
  
  /**
   * Main design method
   */
  public design(): RetainingWallResult {
    this.calculations = [];
    this.stepCounter = 1;
    
    // Step 1: Calculate earth pressures
    const earthPressure = this.calculateEarthPressure();
    
    // Step 2: Calculate weights
    this.calculateWeights();
    
    // Step 3: Check stability
    const stability = this.checkStability(earthPressure);
    
    // Step 4: Design stem
    const stem = this.designStem(earthPressure);
    
    // Step 5: Design heel
    const heel = this.designHeel(earthPressure, stability);
    
    // Step 6: Design toe
    const toe = this.designToe(stability);
    
    // Determine governing condition
    const ratios = [
      { ratio: 1 / stability.FS_overturning * MINIMUM_FS.overturning, condition: 'Overturning' },
      { ratio: 1 / stability.FS_sliding * MINIMUM_FS.sliding, condition: 'Sliding' },
      { ratio: stability.q_max / this.input.foundationSoil.qa, condition: 'Bearing' },
      { ratio: stem.ratio_flexure, condition: 'Stem flexure' },
      { ratio: heel.ratio, condition: 'Heel flexure' },
      { ratio: toe.ratio, condition: 'Toe flexure' },
    ];
    
    const governing = ratios.reduce((max, item) => 
      item.ratio > max.ratio ? item : max, ratios[0]);
    
    const isAdequate = 
      stability.isAdequate_overturning &&
      stability.isAdequate_sliding &&
      stability.isAdequate_bearing &&
      stability.isAdequate_eccentricity &&
      stem.isAdequate &&
      heel.isAdequate &&
      toe.isAdequate;
    
    return {
      isAdequate,
      wallType: this.input.wallType,
      earthPressure,
      stability,
      stem,
      heel,
      toe,
      governingRatio: governing.ratio,
      governingCondition: governing.condition,
      calculations: this.calculations,
      codeReference: 'ACI 318-19, AASHTO LRFD',
    };
  }
  
  /**
   * Calculate earth pressures
   */
  private calculateEarthPressure(): EarthPressureResult {
    const { geometry, backfill, surcharge, seismicCoeff, earthPressureTheory } = this.input;
    
    // Get slope angle
    let beta = 0;
    switch (geometry.backfillSlope) {
      case BackfillSlope.INCLINED_1V_3H: beta = Math.atan(1/3) * 180 / Math.PI; break;
      case BackfillSlope.INCLINED_1V_2H: beta = Math.atan(1/2) * 180 / Math.PI; break;
      case BackfillSlope.INCLINED_1V_1H: beta = 45; break;
      default: beta = geometry.slopeAngle || 0;
    }
    
    // Calculate Ka
    let Ka: number;
    if (backfill.Ka) {
      Ka = backfill.Ka;
    } else if (earthPressureTheory === EarthPressureTheory.RANKINE) {
      Ka = calculateKa_Rankine(backfill.phi, beta);
    } else {
      // Coulomb (simplified)
      Ka = calculateKa_Rankine(backfill.phi, beta) * 1.1; // Approximate
    }
    
    // Calculate Kp
    const Kp = backfill.Kp || calculateKp_Rankine(this.input.foundationSoil.phi);
    
    this.addStep(
      'Calculate earth pressure coefficients',
      earthPressureTheory === EarthPressureTheory.RANKINE ? 
        'Ka = (1-sinφ)/(1+sinφ) for β=0' : 'Coulomb theory',
      {
        phi: backfill.phi + '°',
        beta: beta.toFixed(1) + '°',
      },
      `Ka = ${Ka.toFixed(3)}, Kp = ${Kp.toFixed(2)}`,
      undefined,
      'AASHTO LRFD 3.11.5'
    );
    
    // Height for pressure calculation
    const H = geometry.H + geometry.t_f;
    
    // Active earth pressure
    const Pa = 0.5 * Ka * backfill.gamma * H * H / 1000; // kips/ft
    
    // For inclined backfill, resolve into components
    const delta = backfill.delta || 0;
    const Pa_h = Pa * Math.cos(delta * Math.PI / 180);
    const Pa_v = Pa * Math.sin(delta * Math.PI / 180);
    
    // Point of application (from base)
    const ya = H / 3;
    
    this.addStep(
      'Calculate active earth pressure',
      'Pa = 0.5 × Ka × γ × H²',
      {
        Ka: Ka.toFixed(3),
        gamma: backfill.gamma + ' pcf',
        H: H.toFixed(2) + ' ft',
      },
      Pa.toFixed(2),
      'kips/ft',
      'AASHTO LRFD 3.11.5.1'
    );
    
    // Surcharge pressure
    let Ps = 0;
    let ys = H / 2;
    if (surcharge?.uniform) {
      Ps = Ka * surcharge.uniform * H / 1000; // kips/ft
      ys = H / 2; // Uniform surcharge acts at H/2
      
      this.addStep(
        'Calculate surcharge pressure',
        'Ps = Ka × qs × H',
        {
          qs: surcharge.uniform + ' psf',
          H: H.toFixed(2) + ' ft',
        },
        Ps.toFixed(2),
        'kips/ft',
        'AASHTO LRFD 3.11.6'
      );
    }
    
    // Passive pressure (at toe)
    let Pp: number | undefined;
    let yp: number | undefined;
    if (geometry.toe > 0) {
      const D = geometry.t_f; // Depth of embedment (simplified)
      Pp = 0.5 * Kp * this.input.foundationSoil.gamma * D * D / 1000;
      yp = D / 3;
      
      // Often neglect passive pressure for conservative design
      Pp = 0; // Conservative
    }
    
    // Seismic (Mononobe-Okabe)
    let Pae: number | undefined;
    if (seismicCoeff) {
      const kh = seismicCoeff;
      const theta = Math.atan(kh);
      const Kae = Ka * (1 + kh); // Simplified
      Pae = 0.5 * Kae * backfill.gamma * H * H / 1000;
      
      this.addStep(
        'Calculate seismic earth pressure (Mononobe-Okabe)',
        'Pae = 0.5 × Kae × γ × H²',
        {
          kh,
          Kae: Kae.toFixed(3),
        },
        Pae.toFixed(2),
        'kips/ft',
        'AASHTO LRFD 11.6.5'
      );
    }
    
    return {
      Ka,
      Kp,
      Pa,
      Pa_h,
      Pa_v,
      ya,
      Pp,
      yp,
      Ps,
      ys,
      Pae,
    };
  }
  
  /**
   * Calculate component weights
   */
  private calculateWeights(): void {
    const { geometry, backfill } = this.input;
    const gamma_c = 150; // pcf for concrete
    
    // Stem (tapered)
    const t_avg = (geometry.t_stem_top + geometry.t_stem_bot) / 2 / 12; // ft
    const W_stem = gamma_c * t_avg * geometry.H / 1000; // kips/ft
    
    // Footing
    const W_footing = gamma_c * geometry.B * geometry.t_f / 1000; // kips/ft
    
    // Soil on heel
    const heel_width = geometry.heel;
    const soil_height = geometry.H;
    const W_soil_heel = backfill.gamma * heel_width * soil_height / 1000; // kips/ft
    
    // Total weight
    const W_total = W_stem + W_footing + W_soil_heel;
    
    // Calculate resultant location from toe
    const toe = geometry.toe;
    const stem_base = geometry.t_stem_bot / 12;
    
    // Moment arm of each component from toe
    const x_stem = toe + stem_base / 2;
    const x_footing = geometry.B / 2;
    const x_soil = toe + stem_base + heel_width / 2;
    
    const x_resultant = (W_stem * x_stem + W_footing * x_footing + W_soil_heel * x_soil) / W_total;
    
    this.weights = {
      W_stem,
      W_footing,
      W_soil_heel,
      W_total,
      x_resultant,
    };
    
    this.addStep(
      'Calculate component weights',
      'W = γ × Volume per foot',
      {
        W_stem: W_stem.toFixed(2) + ' kips/ft',
        W_footing: W_footing.toFixed(2) + ' kips/ft',
        W_soil: W_soil_heel.toFixed(2) + ' kips/ft',
      },
      `W_total = ${W_total.toFixed(2)} kips/ft, x̄ = ${x_resultant.toFixed(2)} ft from toe`,
      undefined,
      'Statics'
    );
  }
  
  /**
   * Check stability
   */
  private checkStability(earthPressure: EarthPressureResult): StabilityResult {
    const { geometry, foundationSoil, designMethod } = this.input;
    const { Pa_h, Pa_v, ya, Ps, ys } = earthPressure;
    const { W_total, x_resultant } = this.weights;
    
    const B = geometry.B;
    const toe = geometry.toe;
    
    // Horizontal forces
    const Fh = Pa_h + (Ps || 0);
    
    // Overturning check (about toe)
    const Mo = Pa_h * ya + (Ps || 0) * (ys || 0); // kip-ft/ft
    const Mr = W_total * x_resultant + Pa_v * B; // kip-ft/ft
    const FS_overturning = Mr / Mo;
    
    this.addStep(
      'Check overturning stability',
      'FS = Mr / Mo',
      {
        Mo: Mo.toFixed(2) + ' kip-ft/ft',
        Mr: Mr.toFixed(2) + ' kip-ft/ft',
        'FS_required': MINIMUM_FS.overturning,
      },
      FS_overturning.toFixed(2),
      undefined,
      'AASHTO LRFD 11.6.3.3'
    );
    
    // Sliding check
    const mu = foundationSoil.mu || Math.tan(foundationSoil.phi * Math.PI / 180 * 0.67);
    const N = W_total + Pa_v; // Normal force
    const Fr = mu * N; // Friction resistance
    const FS_sliding = Fr / Fh;
    
    this.addStep(
      'Check sliding stability',
      'FS = Fr / Fh = μN / Fh',
      {
        mu: mu.toFixed(3),
        N: N.toFixed(2) + ' kips/ft',
        Fr: Fr.toFixed(2) + ' kips/ft',
        Fh: Fh.toFixed(2) + ' kips/ft',
      },
      FS_sliding.toFixed(2),
      undefined,
      'AASHTO LRFD 11.6.3.2'
    );
    
    // Bearing check
    // Net moment about center of footing
    const M_net = Mr - Mo;
    const x_N = M_net / N; // Distance from toe to resultant
    const eccentricity = B / 2 - x_N;
    
    let q_toe: number;
    let q_heel: number;
    let B_eff: number;
    
    if (Math.abs(eccentricity) <= B / 6) {
      // Resultant in middle third - trapezoidal distribution
      B_eff = B;
      q_toe = (N / B) * (1 + 6 * eccentricity / B) * 1000; // psf
      q_heel = (N / B) * (1 - 6 * eccentricity / B) * 1000; // psf
    } else {
      // Resultant outside middle third - triangular distribution
      B_eff = 3 * (B / 2 - eccentricity);
      q_toe = 2 * N / B_eff * 1000; // psf
      q_heel = 0;
    }
    
    const q_max = Math.max(q_toe, q_heel);
    const FS_bearing = foundationSoil.qa / q_max;
    
    this.addStep(
      'Check bearing pressure',
      'q = N/B × (1 ± 6e/B)',
      {
        N: N.toFixed(2) + ' kips/ft',
        B: B.toFixed(2) + ' ft',
        e: eccentricity.toFixed(3) + ' ft',
        'B/6': (B/6).toFixed(3) + ' ft',
      },
      `q_max = ${q_max.toFixed(0)} psf, FS = ${FS_bearing.toFixed(2)}`,
      undefined,
      'AASHTO LRFD 10.6.3.1'
    );
    
    return {
      Mo,
      Mr,
      FS_overturning,
      Fh,
      Fr,
      FS_sliding,
      q_toe,
      q_heel,
      q_max,
      eccentricity,
      B_eff,
      FS_bearing,
      isAdequate_overturning: FS_overturning >= MINIMUM_FS.overturning,
      isAdequate_sliding: FS_sliding >= MINIMUM_FS.sliding,
      isAdequate_bearing: FS_bearing >= 1.0, // Using allowable, FS already included
      isAdequate_eccentricity: Math.abs(eccentricity) <= B / 6,
    };
  }
  
  /**
   * Design stem reinforcement
   */
  private designStem(earthPressure: EarthPressureResult): StemDesignResult {
    const { geometry, backfill, concrete, steel, designMethod } = this.input;
    const { Ka } = earthPressure;
    
    const phi_b = RETAINING_WALL_RESISTANCE_FACTORS.phi_b;
    const phi_v = RETAINING_WALL_RESISTANCE_FACTORS.phi_v;
    
    // Critical section at base of stem
    const H = geometry.H;
    const t = geometry.t_stem_bot;
    const d = t - concrete.cover - 0.5; // Effective depth (assume #8 bars)
    
    // Earth pressure at critical section
    const p_base = Ka * backfill.gamma * H; // psf
    const Pa_stem = 0.5 * p_base * H / 1000; // kips/ft
    
    // Load factors
    const gamma_EH = RETAINING_WALL_LOAD_FACTORS.gamma_EH_active;
    
    // Factored moment and shear
    const Mu = gamma_EH * Pa_stem * H / 3; // kip-ft/ft
    const Vu = gamma_EH * Pa_stem; // kips/ft
    
    // Required reinforcement
    const fc = concrete.fc / 1000; // ksi
    const fy = steel.fy / 1000; // ksi
    const b = 12; // in (per foot width)
    
    // Simplified design equation
    const Mn_required = Mu / phi_b;
    const Rn = Mn_required * 12000 / (b * d * d); // psi
    
    // Reinforcement ratio
    const rho = 0.85 * fc / fy * (1 - Math.sqrt(1 - 2 * Rn / (0.85 * fc * 1000)));
    const As_required = rho * b * d;
    
    // Minimum reinforcement
    const As_min = Math.max(
      0.0018 * b * t,  // Shrinkage/temperature
      200 / (steel.fy) * b * d  // ACI minimum
    );
    
    const As_design = Math.max(As_required, As_min);
    
    // Select reinforcement
    const { barSize, spacing, As_provided } = this.selectReinforcement(As_design);
    
    // Design moment capacity
    const a = As_provided * fy / (0.85 * fc * b);
    const phi_Mn = phi_b * As_provided * fy * (d - a / 2) / 12; // kip-ft/ft
    const ratio_flexure = Mu / phi_Mn;
    
    // Shear check
    const phi_Vc = phi_v * 2 * Math.sqrt(concrete.fc) * b * d / 1000; // kips/ft
    const ratio_shear = Vu / phi_Vc;
    
    // Horizontal reinforcement (shrinkage)
    const As_shrinkage = 0.0018 * b * t;
    
    this.addStep(
      'Design stem reinforcement',
      'Mu = γEH × Pa × H/3',
      {
        H: H.toFixed(2) + ' ft',
        Mu: Mu.toFixed(2) + ' kip-ft/ft',
        Vu: Vu.toFixed(2) + ' kips/ft',
        d: d.toFixed(2) + ' in',
      },
      `${barSize} @ ${spacing}" o.c., As = ${As_provided.toFixed(2)} in²/ft`,
      undefined,
      'ACI 318-19'
    );
    
    return {
      Mu,
      Vu,
      As_required,
      As_provided,
      phi_Mn,
      barSize,
      spacing,
      ratio_flexure,
      phi_Vc,
      ratio_shear,
      As_min,
      As_shrinkage,
      isAdequate: ratio_flexure <= 1.0 && ratio_shear <= 1.0,
    };
  }
  
  /**
   * Design heel reinforcement
   */
  private designHeel(earthPressure: EarthPressureResult, stability: StabilityResult): HeelDesignResult {
    const { geometry, backfill, concrete, steel } = this.input;
    
    const phi_b = RETAINING_WALL_RESISTANCE_FACTORS.phi_b;
    const heel = geometry.heel;
    const t_f = geometry.t_f * 12; // inches
    const d = t_f - concrete.cover - 0.5;
    
    // Loading on heel (per foot of wall)
    const w_soil = backfill.gamma * geometry.H / 1000; // kips/ft²
    const w_concrete = 150 * geometry.t_f / 1000; // kips/ft²
    
    // Net upward pressure (bearing pressure minus weight)
    const q_heel = stability.q_heel / 1000; // kips/ft²
    const w_net = w_soil + w_concrete - q_heel;
    
    // Factored moment (cantilever from stem face)
    const gamma_EV = RETAINING_WALL_LOAD_FACTORS.gamma_EV;
    const Mu = gamma_EV * w_net * heel * heel / 2; // kip-ft/ft
    const Vu = gamma_EV * w_net * heel; // kips/ft
    
    // Required reinforcement
    const fc = concrete.fc / 1000;
    const fy = steel.fy / 1000;
    const b = 12;
    
    const Mn_required = Mu / phi_b;
    const Rn = Mn_required * 12000 / (b * d * d);
    const rho = 0.85 * fc / fy * (1 - Math.sqrt(1 - 2 * Rn / (0.85 * fc * 1000)));
    const As_required = Math.max(rho * b * d, 0.0018 * b * t_f);
    
    // Select reinforcement
    const { barSize, spacing, As_provided } = this.selectReinforcement(As_required);
    
    // Design capacity
    const a = As_provided * fy / (0.85 * fc * b);
    const phi_Mn = phi_b * As_provided * fy * (d - a / 2) / 12;
    const ratio = Mu / phi_Mn;
    
    this.addStep(
      'Design heel reinforcement',
      'Mu = γEV × wnet × L²/2',
      {
        heel: heel.toFixed(2) + ' ft',
        w_net: w_net.toFixed(3) + ' ksf',
        Mu: Mu.toFixed(2) + ' kip-ft/ft',
      },
      `${barSize} @ ${spacing}" o.c. (top)`,
      undefined,
      'ACI 318-19'
    );
    
    return {
      w_soil,
      w_concrete,
      w_net,
      Mu,
      Vu,
      As_required,
      As_provided,
      barSize,
      spacing,
      ratio,
      isAdequate: ratio <= 1.0,
    };
  }
  
  /**
   * Design toe reinforcement
   */
  private designToe(stability: StabilityResult): ToeDesignResult {
    const { geometry, concrete, steel } = this.input;
    
    const phi_b = RETAINING_WALL_RESISTANCE_FACTORS.phi_b;
    const toe = geometry.toe;
    const t_f = geometry.t_f * 12;
    const d = t_f - concrete.cover - 0.5;
    
    // Bearing pressure on toe
    const q_toe = stability.q_toe / 1000; // kips/ft²
    const q_heel = stability.q_heel / 1000;
    
    // Average pressure under toe (linear variation)
    const q_at_stem = q_heel + (q_toe - q_heel) * (geometry.B - toe) / geometry.B;
    const q_avg = (q_toe + q_at_stem) / 2;
    
    // Net upward pressure (subtract concrete weight)
    const w_concrete = 150 * geometry.t_f / 1000;
    const w_net = q_avg - w_concrete;
    
    // Factored moment
    const gamma_DC = RETAINING_WALL_LOAD_FACTORS.gamma_DC;
    const Mu = gamma_DC * w_net * toe * toe / 2; // Conservative: assume uniform
    const Vu = gamma_DC * w_net * toe;
    
    // Required reinforcement
    const fc = concrete.fc / 1000;
    const fy = steel.fy / 1000;
    const b = 12;
    
    const Mn_required = Mu / phi_b;
    const Rn = Mn_required * 12000 / (b * d * d);
    const rho = 0.85 * fc / fy * (1 - Math.sqrt(1 - 2 * Rn / (0.85 * fc * 1000)));
    const As_required = Math.max(rho * b * d, 0.0018 * b * t_f);
    
    // Select reinforcement
    const { barSize, spacing, As_provided } = this.selectReinforcement(As_required);
    
    // Design capacity
    const a = As_provided * fy / (0.85 * fc * b);
    const phi_Mn = phi_b * As_provided * fy * (d - a / 2) / 12;
    const ratio = Mu / phi_Mn;
    
    this.addStep(
      'Design toe reinforcement',
      'Mu = γDC × wnet × L²/2',
      {
        toe: toe.toFixed(2) + ' ft',
        q_avg: (q_avg * 1000).toFixed(0) + ' psf',
        Mu: Mu.toFixed(2) + ' kip-ft/ft',
      },
      `${barSize} @ ${spacing}" o.c. (bottom)`,
      undefined,
      'ACI 318-19'
    );
    
    return {
      q_avg: q_avg * 1000, // psf
      Mu,
      Vu,
      As_required,
      As_provided,
      barSize,
      spacing,
      ratio,
      isAdequate: ratio <= 1.0,
    };
  }
  
  /**
   * Select reinforcement
   */
  private selectReinforcement(As_required: number): { barSize: string; spacing: number; As_provided: number } {
    const barSizes = ['#4', '#5', '#6', '#7', '#8'];
    const spacings = [6, 8, 10, 12];
    
    for (const barSize of barSizes) {
      const Ab = REBAR_AREAS[barSize];
      for (const spacing of spacings) {
        const As = Ab * 12 / spacing;
        if (As >= As_required) {
          return { barSize, spacing, As_provided: As };
        }
      }
    }
    
    // Default to #8 @ 6"
    return { barSize: '#8', spacing: 6, As_provided: REBAR_AREAS['#8'] * 2 };
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
export function designRetainingWall(input: RetainingWallInput): RetainingWallResult {
  const calculator = new RetainingWallCalculator(input);
  return calculator.design();
}
