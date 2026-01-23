/**
 * Wind Load Calculator
 * Per ASCE 7-22 Chapters 26-27
 * 
 * Features:
 * - Directional Procedure for MWFRS
 * - Velocity pressure calculation
 * - Gust effect factor (rigid/flexible)
 * - External/internal pressure coefficients
 * - Base shear and overturning moment
 */

import {
  WindExposureCategory,
  EnclosureClassification,
  BuildingType,
  WindLoadInput,
  WindLoadResult,
  VelocityPressureResult,
  GustFactorResult,
  PressureCoefficients,
  InternalPressure,
  DesignPressure,
  BaseShearResult,
  CalculationStep,
  VELOCITY_PRESSURE_COEFFICIENTS,
  INTERNAL_PRESSURE_COEFF,
  WALL_PRESSURE_COEFF,
} from './WindLoadTypes';

export class WindLoadCalculator {
  private input: WindLoadInput;
  private calculations: CalculationStep[] = [];
  private stepCounter = 1;
  
  constructor(input: WindLoadInput) {
    this.input = input;
  }
  
  /**
   * Main calculation method
   */
  public calculate(): WindLoadResult {
    this.calculations = [];
    this.stepCounter = 1;
    
    const { site, building, enclosure, buildingType } = this.input;
    
    // Step 1: Velocity pressure
    const velocityPressure = this.calculateVelocityPressure();
    
    // Step 2: Gust effect factor
    const gustFactor = this.calculateGustFactor(velocityPressure.qh);
    
    // Step 3: Pressure coefficients
    const externalCoeffs = this.getExternalPressureCoefficients();
    const internalPressure = this.getInternalPressureCoefficients();
    
    // Step 4: Design pressures
    const designPressures = this.calculateDesignPressures(
      velocityPressure.qh,
      gustFactor.G,
      externalCoeffs,
      internalPressure
    );
    
    // Step 5: Base shear
    const baseShearX = this.calculateBaseShear('X', velocityPressure, gustFactor.G, externalCoeffs);
    const baseShearY = this.calculateBaseShear('Y', velocityPressure, gustFactor.G, externalCoeffs);
    
    // Summary
    const allPressures = designPressures.map(p => [p.p_positive, p.p_negative]).flat();
    
    return {
      isAdequate: true,
      parameters: {
        V: site.V,
        Kd: site.Kd,
        Kzt: site.Kzt,
        Ke: site.Ke,
        exposure: site.exposure,
      },
      velocityPressure,
      gustFactor,
      externalCoefficients: externalCoeffs,
      internalPressure,
      designPressures,
      baseShear: {
        X: baseShearX,
        Y: baseShearY,
      },
      summary: {
        qh: velocityPressure.qh,
        maxPressure: Math.max(...allPressures),
        minPressure: Math.min(...allPressures),
        totalBaseShear: Math.max(baseShearX.V, baseShearY.V),
      },
      calculations: this.calculations,
      codeReference: 'ASCE 7-22 Chapter 27',
    };
  }
  
  /**
   * Calculate velocity pressure at height z
   */
  private calculateVelocityPressure(): VelocityPressureResult {
    const { site, building } = this.input;
    const h = building.h;
    
    // Get exposure constants
    const expConst = VELOCITY_PRESSURE_COEFFICIENTS[site.exposure];
    
    // Kz = 2.01 × (z/zg)^(2/α) for z ≥ 15 ft
    // Kz = 2.01 × (15/zg)^(2/α) for z < 15 ft
    const z = Math.max(h, 15);
    const Kz = 2.01 * Math.pow(z / expConst.zg, 2 / expConst.alpha);
    
    this.addStep(
      'Calculate velocity pressure coefficient Kz',
      'Kz = 2.01 × (z/zg)^(2/α)',
      { z, zg: expConst.zg, alpha: expConst.alpha },
      Kz.toFixed(3),
      undefined,
      'ASCE 7-22 Table 26.10-1'
    );
    
    // qz = 0.00256 × Kz × Kzt × Kd × Ke × V²
    const qz = 0.00256 * Kz * site.Kzt * site.Kd * site.Ke * Math.pow(site.V, 2);
    const qh = qz; // At mean roof height
    
    this.addStep(
      'Calculate velocity pressure qh',
      'qh = 0.00256 × Kz × Kzt × Kd × Ke × V²',
      { Kz: Kz.toFixed(3), Kzt: site.Kzt, Kd: site.Kd, Ke: site.Ke, V: site.V },
      qh.toFixed(2),
      'psf',
      'ASCE 7-22 Eq. 26.10-1'
    );
    
    return { z, Kz, qz, qh };
  }
  
  /**
   * Calculate gust effect factor
   */
  private calculateGustFactor(qh: number): GustFactorResult {
    const { building, buildingType, naturalFrequency, dampingRatio } = this.input;
    const expConst = VELOCITY_PRESSURE_COEFFICIENTS[this.input.site.exposure];
    
    if (buildingType === BuildingType.RIGID) {
      // Rigid building: G = 0.85 (permitted simplification)
      this.addStep(
        'Determine gust effect factor (rigid building)',
        'G = 0.85 for rigid buildings (n1 > 1 Hz)',
        { buildingType: 'RIGID' },
        0.85,
        undefined,
        'ASCE 7-22 26.11.1'
      );
      
      return {
        G: 0.85,
        n1: naturalFrequency || 1.0,
        method: 'RIGID',
      };
    }
    
    // Flexible building calculation
    const h = building.h;
    const n1 = naturalFrequency || 46 / h; // Approximate if not given
    const beta = dampingRatio || 0.01;
    
    // Simplified calculation for flexible buildings
    // Gf calculated per ASCE 7-22 26.11.5
    const Iz_bar = expConst.c * Math.pow(33 / h, 1 / 6);
    const Lz_bar = expConst.l * Math.pow(h / 33, expConst.epsilon);
    const gQ = 3.4;
    const gR = 3.4; // Simplified
    
    // Background response Q
    const Q = Math.sqrt(1 / (1 + 0.63 * Math.pow((building.B + h) / Lz_bar, 0.63)));
    
    // Resonant response factor R (simplified)
    const R = 0.5; // Conservative for flexible buildings
    
    const Gf = 0.925 * (1 + 1.7 * Iz_bar * Math.sqrt(gQ * gQ * Q * Q + gR * gR * R * R)) /
               (1 + 1.7 * gQ * Iz_bar);
    
    this.addStep(
      'Calculate gust effect factor (flexible building)',
      'Gf = 0.925 × [1 + 1.7Iz√(gQ²Q² + gR²R²)] / [1 + 1.7gQIz]',
      { n1: n1.toFixed(2), beta, Q: Q.toFixed(3) },
      Gf.toFixed(3),
      undefined,
      'ASCE 7-22 Eq. 26.11-10'
    );
    
    return {
      G: Math.max(Gf, 0.85),
      Gf,
      n1,
      method: 'FLEXIBLE',
    };
  }
  
  /**
   * Get external pressure coefficients
   */
  private getExternalPressureCoefficients(): PressureCoefficients {
    const { building } = this.input;
    const L_B = building.L / building.B;
    
    // Windward wall
    const Cp_windward = WALL_PRESSURE_COEFF.windward;
    
    // Leeward wall (varies with L/B)
    let Cp_leeward: number;
    if (L_B <= 1) {
      Cp_leeward = -0.5;
    } else if (L_B <= 2) {
      Cp_leeward = -0.5 + (0.2) * (L_B - 1);
    } else {
      Cp_leeward = -0.3 + (0.1) * Math.min(L_B - 2, 2) / 2;
    }
    Cp_leeward = Math.max(Cp_leeward, -0.2);
    
    // Sidewall
    const Cp_sidewall = WALL_PRESSURE_COEFF.sidewall;
    
    // Roof (simplified for flat/low slope)
    const theta = building.roofAngle;
    let Cp_roof_windward: number;
    let Cp_roof_leeward: number;
    
    if (theta <= 10) {
      Cp_roof_windward = -0.9; // Zone 1
      Cp_roof_leeward = -0.5;
    } else if (theta <= 27) {
      Cp_roof_windward = -0.7 + 0.7 * (theta - 10) / 17;
      Cp_roof_leeward = -0.6;
    } else {
      Cp_roof_windward = 0.0 + 0.4 * (theta - 27) / 18;
      Cp_roof_leeward = -0.6;
    }
    
    this.addStep(
      'Determine external pressure coefficients',
      'Cp from ASCE 7-22 Figure 27.3-1',
      { L_B: L_B.toFixed(2), theta },
      `Cp,w=${Cp_windward}, Cp,l=${Cp_leeward.toFixed(2)}`,
      undefined,
      'ASCE 7-22 Fig. 27.3-1'
    );
    
    return {
      Cp_windward,
      Cp_leeward,
      Cp_sidewall,
      Cp_roof_windward,
      Cp_roof_leeward,
    };
  }
  
  /**
   * Get internal pressure coefficients
   */
  private getInternalPressureCoefficients(): InternalPressure {
    const { enclosure } = this.input;
    const coeffs = INTERNAL_PRESSURE_COEFF[enclosure];
    
    this.addStep(
      'Determine internal pressure coefficient',
      'GCpi from ASCE 7-22 Table 26.13-1',
      { enclosure },
      `±${Math.abs(coeffs.positive)}`,
      undefined,
      'ASCE 7-22 Table 26.13-1'
    );
    
    return {
      GCpi_positive: coeffs.positive,
      GCpi_negative: coeffs.negative,
    };
  }
  
  /**
   * Calculate design pressures on each surface
   */
  private calculateDesignPressures(
    qh: number,
    G: number,
    Cp: PressureCoefficients,
    GCpi: InternalPressure
  ): DesignPressure[] {
    // p = q × G × Cp - qi × (GCpi)
    // For enclosed buildings: qi = qh
    const qi = qh;
    
    const surfaces: { name: string; Cp: number }[] = [
      { name: 'Windward Wall', Cp: Cp.Cp_windward },
      { name: 'Leeward Wall', Cp: Cp.Cp_leeward },
      { name: 'Side Walls', Cp: Cp.Cp_sidewall },
      { name: 'Roof (Windward)', Cp: Cp.Cp_roof_windward },
      { name: 'Roof (Leeward)', Cp: Cp.Cp_roof_leeward },
    ];
    
    const results: DesignPressure[] = [];
    
    for (const surface of surfaces) {
      // External pressure
      const p_ext = qh * G * surface.Cp;
      
      // Net pressure with positive internal pressure
      const p_positive = p_ext - qi * GCpi.GCpi_positive;
      
      // Net pressure with negative internal pressure
      const p_negative = p_ext - qi * GCpi.GCpi_negative;
      
      // Net pressure (use larger magnitude)
      const p_net = Math.abs(p_positive) > Math.abs(p_negative) ? p_positive : p_negative;
      
      results.push({
        surface: surface.name,
        p_positive,
        p_negative,
        p_net,
      });
    }
    
    this.addStep(
      'Calculate design pressures',
      'p = qh × G × Cp - qi × GCpi',
      { qh: qh.toFixed(2), G: G.toFixed(3) },
      `Max = ${Math.max(...results.map(r => r.p_positive)).toFixed(2)} psf`,
      undefined,
      'ASCE 7-22 Eq. 27.3-1'
    );
    
    return results;
  }
  
  /**
   * Calculate base shear and overturning moment
   */
  private calculateBaseShear(
    direction: 'X' | 'Y',
    vp: VelocityPressureResult,
    G: number,
    Cp: PressureCoefficients
  ): BaseShearResult {
    const { building, site } = this.input;
    const expConst = VELOCITY_PRESSURE_COEFFICIENTS[site.exposure];
    
    // Building dimensions based on direction
    const B = direction === 'X' ? building.B : building.L;
    const L = direction === 'X' ? building.L : building.B;
    const h = building.h;
    
    // Calculate pressure at multiple heights
    const heights = [0.25 * h, 0.5 * h, 0.75 * h, h];
    const pressureDistribution: { height: number; pressure: number; force: number }[] = [];
    
    let totalForce = 0;
    let totalMoment = 0;
    
    for (let i = 0; i < heights.length; i++) {
      const z = heights[i];
      const Kz = 2.01 * Math.pow(Math.max(z, 15) / expConst.zg, 2 / expConst.alpha);
      const qz = 0.00256 * Kz * site.Kzt * site.Kd * site.Ke * Math.pow(site.V, 2);
      
      // Net pressure (windward + leeward)
      const p_windward = qz * G * Cp.Cp_windward;
      const p_leeward = vp.qh * G * Cp.Cp_leeward;
      const p_net = p_windward - p_leeward;
      
      // Tributary height
      const h_trib = i === 0 ? heights[0] : heights[i] - heights[i - 1];
      
      // Force = pressure × area (per foot of width)
      const force = p_net * h_trib * B / 1000; // kips
      
      pressureDistribution.push({
        height: z,
        pressure: p_net,
        force,
      });
      
      totalForce += force;
      totalMoment += force * z;
    }
    
    // Total base shear
    const V = totalForce;
    const M_base = totalMoment;
    
    this.addStep(
      `Calculate base shear (${direction}-direction)`,
      'V = Σ(p × A), M = Σ(F × h)',
      { B: B.toFixed(0), h: h.toFixed(0) },
      `V = ${V.toFixed(1)} kips, M = ${M_base.toFixed(0)} kip-ft`,
      undefined,
      'ASCE 7-22 27.3'
    );
    
    return {
      direction,
      V,
      M_base,
      pressureDistribution,
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
export function calculateWindLoads(input: WindLoadInput): WindLoadResult {
  const calculator = new WindLoadCalculator(input);
  return calculator.calculate();
}
