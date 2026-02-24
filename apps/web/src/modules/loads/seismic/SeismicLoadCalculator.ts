/**
 * Seismic Load Calculator
 * Per ASCE 7-22 Chapters 11-12
 * 
 * Features:
 * - Seismic Design Category determination
 * - Equivalent Lateral Force (ELF) procedure
 * - Vertical distribution of forces
 * - Story drift calculations
 * - Redundancy factor
 */

import {
  SiteClass,
  RiskCategory,
  SeismicDesignCategory,
  SeismicLoadInput,
  SeismicLoadResult,
  SpectralAccelerations,
  DesignCoefficients,
  PeriodResult,
  BaseShearResult,
  VerticalDistribution,
  StoryDriftResult,
  CalculationStep,
  SITE_COEFFICIENT_FA,
  SITE_COEFFICIENT_FV,
  RESPONSE_FACTORS,
  IMPORTANCE_FACTOR_SEISMIC,
  PERIOD_COEFFICIENT_CU,
  APPROXIMATE_PERIOD_PARAMS,
  ALLOWABLE_DRIFT,
} from './SeismicLoadTypes';

export class SeismicLoadCalculator {
  private input: SeismicLoadInput;
  private calculations: CalculationStep[] = [];
  private stepCounter = 1;
  
  constructor(input: SeismicLoadInput) {
    this.input = input;
  }
  
  /**
   * Main calculation method
   */
  public calculate(): SeismicLoadResult {
    this.calculations = [];
    this.stepCounter = 1;
    
    // Step 1: Calculate spectral accelerations
    const spectral = this.calculateSpectralAccelerations();
    
    // Step 2: Determine Seismic Design Category
    const SDC = this.determineSDC(spectral);
    
    // Step 3: Get design coefficients
    const coefficients = this.getDesignCoefficients(spectral);
    
    // Step 4: Calculate period
    const period = this.calculatePeriod();
    
    // Step 5: Calculate base shear
    const baseShear = this.calculateBaseShear(spectral, coefficients, period);
    
    // Step 6: Vertical distribution
    const distribution = this.calculateVerticalDistribution(baseShear.V, period.T_design);
    
    // Step 7: Story drift (if stiffness provided)
    let drift: StoryDriftResult[] | undefined;
    if (this.input.stories.some(s => s.stiffness)) {
      drift = this.calculateStoryDrift(distribution, coefficients);
    }
    
    // Check adequacy
    const isAdequate = !drift || drift.every(d => d.isAdequate);
    
    return {
      isAdequate,
      SDC,
      spectral,
      coefficients,
      period,
      baseShear,
      distribution,
      drift,
      summary: {
        SDC,
        SDS: spectral.SDS,
        SD1: spectral.SD1,
        T: period.T_design,
        V: baseShear.V,
        V_per_W: (baseShear.V / this.input.building.W) * 100,
      },
      calculations: this.calculations,
      codeReference: 'ASCE 7-22 Chapters 11-12',
    };
  }
  
  /**
   * Calculate spectral accelerations
   */
  private calculateSpectralAccelerations(): SpectralAccelerations {
    const { Ss, S1, siteClass } = this.input.site;
    
    // Get site coefficients
    const Fa = this.getSiteCoefficient(SITE_COEFFICIENT_FA, siteClass, Ss);
    const Fv = this.getSiteCoefficient(SITE_COEFFICIENT_FV, siteClass, S1);
    
    this.addStep(
      'Determine site coefficients',
      'Fa and Fv from ASCE 7-22 Tables 11.4-1 & 11.4-2',
      { siteClass, Ss, S1 },
      `Fa = ${Fa.toFixed(2)}, Fv = ${Fv.toFixed(2)}`,
      undefined,
      'ASCE 7-22 11.4.4'
    );
    
    // MCE spectral accelerations
    const SMS = Fa * Ss;
    const SM1 = Fv * S1;
    
    this.addStep(
      'Calculate MCE spectral accelerations',
      'SMS = Fa × Ss, SM1 = Fv × S1',
      { Fa: Fa.toFixed(2), Ss, Fv: Fv.toFixed(2), S1 },
      `SMS = ${SMS.toFixed(3)}g, SM1 = ${SM1.toFixed(3)}g`,
      undefined,
      'ASCE 7-22 Eq. 11.4-1, 11.4-2'
    );
    
    // Design spectral accelerations
    const SDS = (2/3) * SMS;
    const SD1 = (2/3) * SM1;
    
    this.addStep(
      'Calculate design spectral accelerations',
      'SDS = ⅔SMS, SD1 = ⅔SM1',
      { SMS: SMS.toFixed(3), SM1: SM1.toFixed(3) },
      `SDS = ${SDS.toFixed(3)}g, SD1 = ${SD1.toFixed(3)}g`,
      undefined,
      'ASCE 7-22 Eq. 11.4-3, 11.4-4'
    );
    
    return { Ss, S1, Fa, Fv, SMS, SM1, SDS, SD1 };
  }
  
  /**
   * Determine Seismic Design Category
   */
  private determineSDC(spectral: SpectralAccelerations): SeismicDesignCategory {
    const { riskCategory } = this.input;
    const { SDS, SD1 } = spectral;
    
    // SDC based on SDS (Table 11.6-1)
    let SDC_SDS: SeismicDesignCategory;
    if (SDS < 0.167) SDC_SDS = SeismicDesignCategory.A;
    else if (SDS < 0.33) SDC_SDS = SeismicDesignCategory.B;
    else if (SDS < 0.50) SDC_SDS = SeismicDesignCategory.C;
    else SDC_SDS = SeismicDesignCategory.D;
    
    // SDC based on SD1 (Table 11.6-2)
    let SDC_SD1: SeismicDesignCategory;
    if (SD1 < 0.067) SDC_SD1 = SeismicDesignCategory.A;
    else if (SD1 < 0.133) SDC_SD1 = SeismicDesignCategory.B;
    else if (SD1 < 0.20) SDC_SD1 = SeismicDesignCategory.C;
    else SDC_SD1 = SeismicDesignCategory.D;
    
    // Governing SDC (higher category)
    const sdcOrder = ['A', 'B', 'C', 'D', 'E', 'F'];
    const SDC = sdcOrder.indexOf(SDC_SDS) >= sdcOrder.indexOf(SDC_SD1) ? SDC_SDS : SDC_SD1;
    
    // Adjust for Risk Category IV
    let finalSDC = SDC;
    if (riskCategory === RiskCategory.IV && (SDC === SeismicDesignCategory.C || SDC === SeismicDesignCategory.D)) {
      finalSDC = SeismicDesignCategory.D;
    }
    
    this.addStep(
      'Determine Seismic Design Category',
      'Higher of SDC from SDS and SD1',
      { SDC_SDS, SDC_SD1, riskCategory },
      finalSDC,
      undefined,
      'ASCE 7-22 Tables 11.6-1, 11.6-2'
    );
    
    return finalSDC;
  }
  
  /**
   * Get design coefficients (R, Cd, Ω0, Ie, ρ)
   */
  private getDesignCoefficients(spectral: SpectralAccelerations): DesignCoefficients {
    const { building, riskCategory } = this.input;
    const systemFactors = RESPONSE_FACTORS[building.structuralSystem];
    const Ie = IMPORTANCE_FACTOR_SEISMIC[riskCategory];
    
    // Redundancy factor (simplified - detailed check per 12.3.4)
    const rho = this.calculateRedundancy(spectral);
    
    // Seismic response coefficient (preliminary - will be refined in base shear calc)
    const Cs = spectral.SDS / (systemFactors.R / Ie);
    
    this.addStep(
      'Determine response factors',
      'R, Cd, Ω0 from ASCE 7-22 Table 12.2-1',
      { system: building.structuralSystem },
      `R = ${systemFactors.R}, Cd = ${systemFactors.Cd}, Ω0 = ${systemFactors.omega_0}`,
      undefined,
      'ASCE 7-22 Table 12.2-1'
    );
    
    return {
      R: systemFactors.R,
      Cd: systemFactors.Cd,
      omega_0: systemFactors.omega_0,
      Ie,
      rho,
      Cs,
    };
  }
  
  /**
   * Calculate building period
   */
  private calculatePeriod(): PeriodResult {
    const { building } = this.input;
    const { T, hn, structuralSystem } = building;
    
    // Approximate period Ta = Ct × hn^x
    let params = APPROXIMATE_PERIOD_PARAMS.other;
    if (structuralSystem.includes('MOMENT_FRAME')) {
      if (structuralSystem.includes('STEEL')) {
        params = APPROXIMATE_PERIOD_PARAMS.steel_moment_frame;
      } else {
        params = APPROXIMATE_PERIOD_PARAMS.concrete_moment_frame;
      }
    } else if (structuralSystem.includes('ECCENTRICALLY_BRACED')) {
      params = APPROXIMATE_PERIOD_PARAMS.steel_eccentrically_braced;
    }
    
    const Ta = params.Ct * Math.pow(hn, params.x);
    
    this.addStep(
      'Calculate approximate period',
      'Ta = Ct × hn^x',
      { Ct: params.Ct, hn, x: params.x },
      Ta.toFixed(3),
      's',
      'ASCE 7-22 Eq. 12.8-8'
    );
    
    // Upper limit coefficient Cu
    const SD1 = this.input.site.S1 * 0.8; // Approximate SD1
    let Cu: number;
    if (SD1 >= 0.4) Cu = 1.4;
    else if (SD1 >= 0.3) Cu = 1.4;
    else if (SD1 >= 0.2) Cu = 1.5;
    else if (SD1 >= 0.15) Cu = 1.6;
    else Cu = 1.7;
    
    const T_upper = Cu * Ta;
    
    // Design period
    let T_design: number;
    let method: string;
    
    if (T && T > 0) {
      // Use calculated period if provided, but limit by Cu × Ta
      if (this.input.allowTperiodLimit !== false && T > T_upper) {
        T_design = T_upper;
        method = 'Calculated period limited by Cu × Ta';
      } else {
        T_design = T;
        method = 'Calculated period';
      }
    } else {
      T_design = Ta;
      method = 'Approximate period Ta';
    }
    
    this.addStep(
      'Determine design period',
      `T ≤ Cu × Ta = ${T_upper.toFixed(3)}s`,
      { T_calc: T || 'N/A', Ta: Ta.toFixed(3), Cu },
      T_design.toFixed(3),
      's',
      'ASCE 7-22 12.8.2'
    );
    
    return {
      T_calc: T || Ta,
      Ta,
      Cu,
      T_upper,
      T_design,
      method,
    };
  }
  
  /**
   * Calculate seismic base shear
   */
  private calculateBaseShear(
    spectral: SpectralAccelerations,
    coeff: DesignCoefficients,
    period: PeriodResult
  ): BaseShearResult {
    const { building, site } = this.input;
    const { SDS, SD1 } = spectral;
    const { R, Ie } = coeff;
    const T = period.T_design;
    const TL = site.TL;
    const W = building.W;
    
    // Cs = SDS / (R/Ie) - Maximum
    const Cs_max = SDS / (R / Ie);
    
    // Cs minimum values
    const Cs_min1 = 0.044 * SDS * Ie; // Eq. 12.8-5
    const Cs_min2 = Math.max(Cs_min1, 0.01); // 0.01 minimum
    let Cs_min = Cs_min2;
    
    // Additional minimum for S1 ≥ 0.6g (Eq. 12.8-6)
    if (spectral.S1 >= 0.6) {
      const Cs_min3 = 0.5 * spectral.S1 / (R / Ie);
      Cs_min = Math.max(Cs_min, Cs_min3);
    }
    
    // Cs calculated
    let Cs_calc: number;
    if (T <= SD1 / SDS) {
      // Short period
      Cs_calc = SDS / (R / Ie);
    } else if (T <= TL) {
      // Intermediate period
      Cs_calc = SD1 / (T * (R / Ie));
    } else {
      // Long period
      Cs_calc = SD1 * TL / (T * T * (R / Ie));
    }
    
    // Apply limits
    let Cs: number;
    let governs: 'UPPER' | 'LOWER' | 'CALCULATED';
    
    if (Cs_calc > Cs_max) {
      Cs = Cs_max;
      governs = 'UPPER';
    } else if (Cs_calc < Cs_min) {
      Cs = Cs_min;
      governs = 'LOWER';
    } else {
      Cs = Cs_calc;
      governs = 'CALCULATED';
    }
    
    // Base shear V = Cs × W
    const V = Cs * W;
    
    this.addStep(
      'Calculate seismic base shear',
      'V = Cs × W',
      { 
        Cs_max: Cs_max.toFixed(4), 
        Cs_min: Cs_min.toFixed(4), 
        Cs_calc: Cs_calc.toFixed(4),
        Cs: Cs.toFixed(4),
        W 
      },
      V.toFixed(1),
      'kips',
      'ASCE 7-22 Eq. 12.8-1'
    );
    
    return {
      Cs,
      Cs_min,
      Cs_max,
      V,
      W,
      governs,
    };
  }
  
  /**
   * Calculate vertical distribution of seismic forces
   */
  private calculateVerticalDistribution(V: number, T: number): VerticalDistribution[] {
    const { stories } = this.input;
    
    // Exponent k (ASCE 7-22 12.8.3)
    let k: number;
    if (T <= 0.5) k = 1;
    else if (T >= 2.5) k = 2;
    else k = 1 + (T - 0.5) / 2;
    
    // Calculate wxhx^k for all levels
    const wxhxk_values = stories.map(s => s.weight * Math.pow(s.height, k));
    const sum_wxhxk = wxhxk_values.reduce((sum, v) => sum + v, 0);
    
    // Distribution
    const distribution: VerticalDistribution[] = [];
    let cumulative_shear = 0;
    let cumulative_moment = 0;
    
    // Process from top to bottom
    const sortedStories = [...stories].sort((a, b) => b.height - a.height);
    
    for (const story of sortedStories) {
      const wxhxk = story.weight * Math.pow(story.height, k);
      const Cvx = wxhxk / sum_wxhxk;
      const Fx = Cvx * V;
      cumulative_shear += Fx;
      
      // Find height difference to next level below
      const prevHeight = distribution.length > 0 
        ? sortedStories[distribution.length - 1].height 
        : story.height;
      cumulative_moment += cumulative_shear * (prevHeight - story.height);
      
      distribution.push({
        level: story.level,
        wx: story.weight,
        hx: story.height,
        wxhxk,
        Cvx,
        Fx,
        Vx: cumulative_shear,
        Mx: cumulative_moment,
      });
    }
    
    this.addStep(
      'Calculate vertical distribution',
      'Fx = Cvx × V, Cvx = wxhx^k / Σwxhx^k',
      { k: k.toFixed(2), sum_wxhxk: sum_wxhxk.toFixed(0) },
      `k = ${k.toFixed(2)}, V_base = ${V.toFixed(1)} kips`,
      undefined,
      'ASCE 7-22 Eq. 12.8-11, 12.8-12'
    );
    
    return distribution;
  }
  
  /**
   * Calculate story drift
   */
  private calculateStoryDrift(
    distribution: VerticalDistribution[],
    coeff: DesignCoefficients
  ): StoryDriftResult[] {
    const { stories, riskCategory, building } = this.input;
    const Cd = coeff.Cd;
    const Ie = coeff.Ie;
    
    // Allowable drift
    const stories_count = building.stories;
    const allowable_key = stories_count >= 4 ? 'other_4+' : 'other_under4';
    const allowable_ratio = ALLOWABLE_DRIFT[riskCategory][allowable_key];
    
    const results: StoryDriftResult[] = [];
    let prev_delta = 0;
    
    // Sort by height (bottom to top)
    const sortedDist = [...distribution].sort((a, b) => a.hx - b.hx);
    
    for (let i = 0; i < sortedDist.length; i++) {
      const dist = sortedDist[i];
      const story = stories.find(s => s.level === dist.level);
      
      if (!story?.stiffness) continue;
      
      // Elastic displacement δxe = Vx / k
      const delta_xe = (dist.Vx * 1000) / story.stiffness; // inches
      
      // Amplified displacement δx = Cd × δxe / Ie
      const delta_x = (Cd * delta_xe) / Ie;
      
      // Story drift Δ = δx - δx-1
      const delta = delta_x - prev_delta;
      prev_delta = delta_x;
      
      // Story height
      const h_story = i === 0 
        ? dist.hx * 12 
        : (dist.hx - sortedDist[i - 1].hx) * 12; // in inches
      
      // Drift ratio
      const drift_ratio = delta / h_story;
      
      results.push({
        level: dist.level,
        delta_xe,
        delta_x,
        delta,
        drift_ratio,
        allowable: allowable_ratio,
        isAdequate: drift_ratio <= allowable_ratio,
      });
    }
    
    this.addStep(
      'Calculate story drift',
      'δx = Cd × δxe / Ie, Δ/hsx ≤ allowable',
      { Cd, Ie, allowable: allowable_ratio },
      results.every(r => r.isAdequate) ? 'All levels OK' : 'Check drift limits',
      undefined,
      'ASCE 7-22 12.8.6, Table 12.12-1'
    );
    
    return results;
  }
  
  /**
   * Calculate redundancy factor
   */
  private calculateRedundancy(spectral: SpectralAccelerations): number {
    // Simplified - full calculation requires structural analysis
    // ρ = 1.0 for SDC B, C
    // ρ = 1.3 for SDC D, E, F unless conditions of 12.3.4.2 are met
    
    const SDC = this.determineSDC(spectral);
    
    if (['A', 'B', 'C'].includes(SDC)) {
      return 1.0;
    }
    
    // Conservative for higher SDC
    return 1.3;
  }
  
  /**
   * Get site coefficient by interpolation
   */
  private getSiteCoefficient(
    table: Record<SiteClass, Record<string, number>>,
    siteClass: SiteClass,
    spectralValue: number
  ): number {
    const coeffs = table[siteClass];
    const keys = Object.keys(coeffs).map(k => parseFloat(k)).sort((a, b) => a - b);
    
    // Find bracketing values
    if (spectralValue <= keys[0]) return coeffs[keys[0].toString()];
    if (spectralValue >= keys[keys.length - 1]) return coeffs[keys[keys.length - 1].toString()];
    
    // Interpolate
    for (let i = 0; i < keys.length - 1; i++) {
      if (spectralValue >= keys[i] && spectralValue <= keys[i + 1]) {
        const ratio = (spectralValue - keys[i]) / (keys[i + 1] - keys[i]);
        const v1 = coeffs[keys[i].toString()];
        const v2 = coeffs[keys[i + 1].toString()];
        return v1 + ratio * (v2 - v1);
      }
    }
    
    return 1.0; // Default
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
export function calculateSeismicLoads(input: SeismicLoadInput): SeismicLoadResult {
  const calculator = new SeismicLoadCalculator(input);
  return calculator.calculate();
}
