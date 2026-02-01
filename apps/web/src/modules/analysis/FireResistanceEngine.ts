/**
 * ============================================================================
 * FIRE RESISTANCE DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive fire design and analysis for structural members including:
 * - Temperature-dependent material properties
 * - Heat transfer analysis
 * - Fire resistance ratings
 * - Protected and unprotected member design
 * - Structural capacity at elevated temperatures
 * 
 * Design Codes:
 * - IS 456:2000 Annex E - Fire Resistance
 * - IS 800:2007 Section 16 - Fire Resistance
 * - EN 1992-1-2 (Eurocode 2) - Fire Design of Concrete
 * - EN 1993-1-2 (Eurocode 3) - Fire Design of Steel
 * - EN 1994-1-2 (Eurocode 4) - Fire Design of Composite
 * - ASCE/SEI/SFPE 29 - Fire Protection
 * - BS 5950-8 - Fire Resistance Steel
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FireExposure {
  type: 'standard' | 'hydrocarbon' | 'external' | 'parametric' | 'localized';
  duration: number; // minutes
  exposedSides: 1 | 2 | 3 | 4; // Number of sides exposed
  compartmentParams?: {
    floorArea: number; // m²
    openingFactor: number; // m^0.5
    thermalInertia: number; // J/m²s^0.5K
    fireLoad: number; // MJ/m²
  };
}

export interface FireProtection {
  type: 'none' | 'board' | 'spray' | 'intumescent' | 'concrete-encasement' | 'hollow-fill';
  thickness: number; // mm
  density?: number; // kg/m³
  thermalConductivity?: number; // W/mK
  specificHeat?: number; // J/kgK
  moistureContent?: number; // %
}

export interface SteelSectionFire {
  sectionType: string;
  area: number; // mm²
  perimeter: number; // mm (heated perimeter)
  sectionFactor: number; // Am/V (1/m)
  boxSectionFactor?: number; // Ap/V for boxed section
  thickness?: number; // mm (for plate elements)
}

export interface ConcreteSectionFire {
  type: 'beam' | 'column' | 'slab' | 'wall';
  width: number; // mm
  depth: number; // mm
  cover: number; // mm to reinforcement
  reinforcement: {
    area: number; // mm²
    position: 'corner' | 'mid-face' | 'distributed';
    size: number; // mm diameter
  };
  aggregateType: 'siliceous' | 'calcareous' | 'lightweight';
}

export interface FireDesignResult {
  fireRating: number; // minutes
  criticalTemperature: number; // °C
  timeToReachCritical: number; // minutes
  capacityRatios: {
    ambient: number;
    fire: number;
    reduction: number;
  };
  temperatureProfile?: {
    time: number;
    surface: number;
    core: number;
    rebar?: number;
  }[];
  status: 'ADEQUATE' | 'INADEQUATE';
  recommendations: string[];
}

// ============================================================================
// FIRE TEMPERATURE CURVES
// ============================================================================

export class FireTemperatureCurves {
  /**
   * ISO 834 Standard Fire Curve (EN 1991-1-2)
   */
  static standardCurve(t: number): number {
    // t in minutes
    return 20 + 345 * Math.log10(8 * t + 1);
  }

  /**
   * Hydrocarbon Fire Curve
   */
  static hydrocarbonCurve(t: number): number {
    return 20 + 1080 * (1 - 0.325 * Math.exp(-0.167 * t) - 0.675 * Math.exp(-2.5 * t));
  }

  /**
   * External Fire Curve
   */
  static externalCurve(t: number): number {
    return 20 + 660 * (1 - 0.687 * Math.exp(-0.32 * t) - 0.313 * Math.exp(-3.8 * t));
  }

  /**
   * Parametric Fire Curve (EN 1991-1-2 Annex A)
   */
  static parametricCurve(
    t: number,
    params: {
      openingFactor: number; // O = Av√h / At (m^0.5)
      thermalInertia: number; // b = √(ρcλ) (J/m²s^0.5K)
      fireLoad: number; // qt,d (MJ/m²)
    }
  ): number {
    const { openingFactor, thermalInertia, fireLoad } = params;
    
    // Time factor
    const Gamma = Math.pow(openingFactor / 0.04, 2) / Math.pow(thermalInertia / 1160, 2);
    const tStar = t * Gamma;

    // Maximum temperature time
    const tlim = 0.2e-3 * fireLoad / openingFactor;
    const tmax = Math.max(0.2 * Gamma, tlim);

    // Heating phase
    if (t <= tmax) {
      return 20 + 1325 * (1 - 0.324 * Math.exp(-0.2 * tStar) - 
                         0.204 * Math.exp(-1.7 * tStar) - 
                         0.472 * Math.exp(-19 * tStar));
    }

    // Cooling phase
    const thetaMax = 20 + 1325 * (1 - 0.324 * Math.exp(-0.2 * tmax * Gamma) - 
                                 0.204 * Math.exp(-1.7 * tmax * Gamma) - 
                                 0.472 * Math.exp(-19 * tmax * Gamma));
    
    const x = tmax <= 0.5 ? 1.0 : tmax <= 2.0 ? (2 - tmax) / 3 + 1 : 1.0;
    
    return thetaMax - 625 * (t - tmax) * x / Gamma;
  }

  /**
   * Get temperature at time t
   */
  static getTemperature(exposure: FireExposure, t: number): number {
    switch (exposure.type) {
      case 'standard':
        return this.standardCurve(t);
      case 'hydrocarbon':
        return this.hydrocarbonCurve(t);
      case 'external':
        return this.externalCurve(t);
      case 'parametric':
        if (!exposure.compartmentParams) {
          return this.standardCurve(t);
        }
        return this.parametricCurve(t, exposure.compartmentParams);
      default:
        return this.standardCurve(t);
    }
  }
}

// ============================================================================
// MATERIAL PROPERTIES AT ELEVATED TEMPERATURE
// ============================================================================

export class SteelPropertiesFire {
  /**
   * Steel strength reduction factor at temperature θ (EN 1993-1-2)
   */
  static yieldReduction(theta: number): number {
    if (theta <= 400) return 1.0;
    if (theta <= 500) return 1.0 - 0.22 * (theta - 400) / 100;
    if (theta <= 600) return 0.78 - 0.31 * (theta - 500) / 100;
    if (theta <= 700) return 0.47 - 0.24 * (theta - 600) / 100;
    if (theta <= 800) return 0.23 - 0.12 * (theta - 700) / 100;
    if (theta <= 900) return 0.11 - 0.05 * (theta - 800) / 100;
    if (theta <= 1000) return 0.06 - 0.02 * (theta - 900) / 100;
    if (theta <= 1100) return 0.04 - 0.02 * (theta - 1000) / 100;
    return 0.02;
  }

  /**
   * Steel modulus reduction factor at temperature θ
   */
  static modulusReduction(theta: number): number {
    if (theta <= 100) return 1.0;
    if (theta <= 200) return 1.0 - 0.1 * (theta - 100) / 100;
    if (theta <= 300) return 0.9 - 0.1 * (theta - 200) / 100;
    if (theta <= 400) return 0.8 - 0.1 * (theta - 300) / 100;
    if (theta <= 500) return 0.7 - 0.1 * (theta - 400) / 100;
    if (theta <= 600) return 0.6 - 0.29 * (theta - 500) / 100;
    if (theta <= 700) return 0.31 - 0.18 * (theta - 600) / 100;
    if (theta <= 800) return 0.13 - 0.04 * (theta - 700) / 100;
    if (theta <= 900) return 0.09 - 0.0225 * (theta - 800) / 100;
    return 0.0675 * Math.max(0, (1100 - theta) / 200);
  }

  /**
   * Thermal conductivity of steel (W/mK)
   */
  static thermalConductivity(theta: number): number {
    if (theta < 800) {
      return 54 - 3.33e-2 * theta;
    }
    return 27.3;
  }

  /**
   * Specific heat of steel (J/kgK)
   */
  static specificHeat(theta: number): number {
    if (theta < 600) {
      return 425 + 7.73e-1 * theta - 1.69e-3 * theta * theta + 2.22e-6 * Math.pow(theta, 3);
    } else if (theta < 735) {
      return 666 + 13002 / (738 - theta);
    } else if (theta < 900) {
      return 545 + 17820 / (theta - 731);
    }
    return 650;
  }

  /**
   * Critical temperature for steel member
   */
  static criticalTemperature(utilizationFactor: number): number {
    // mu0 is the degree of utilization
    if (utilizationFactor <= 0) return 1200;
    if (utilizationFactor >= 1) return 20;
    
    // EN 1993-1-2 Eq. 4.22
    return 39.19 * Math.log(1 / Math.pow(0.9674 * Math.pow(utilizationFactor, 3.833) - 1, 0.0278)) + 482;
  }
}

export class ConcretePropertiesFire {
  /**
   * Concrete compressive strength reduction (EN 1992-1-2)
   */
  static strengthReduction(theta: number, aggregate: 'siliceous' | 'calcareous'): number {
    if (aggregate === 'siliceous') {
      if (theta <= 100) return 1.0;
      if (theta <= 200) return 1.0 - 0.05 * (theta - 100) / 100;
      if (theta <= 300) return 0.95 - 0.1 * (theta - 200) / 100;
      if (theta <= 400) return 0.85 - 0.1 * (theta - 300) / 100;
      if (theta <= 500) return 0.75 - 0.15 * (theta - 400) / 100;
      if (theta <= 600) return 0.60 - 0.15 * (theta - 500) / 100;
      if (theta <= 700) return 0.45 - 0.15 * (theta - 600) / 100;
      if (theta <= 800) return 0.30 - 0.15 * (theta - 700) / 100;
      if (theta <= 900) return 0.15 - 0.07 * (theta - 800) / 100;
      if (theta <= 1000) return 0.08 - 0.04 * (theta - 900) / 100;
      return 0.04;
    } else {
      // Calcareous aggregate - slightly better performance
      if (theta <= 100) return 1.0;
      if (theta <= 200) return 1.0 - 0.03 * (theta - 100) / 100;
      if (theta <= 300) return 0.97 - 0.06 * (theta - 200) / 100;
      if (theta <= 400) return 0.91 - 0.06 * (theta - 300) / 100;
      if (theta <= 500) return 0.85 - 0.11 * (theta - 400) / 100;
      if (theta <= 600) return 0.74 - 0.14 * (theta - 500) / 100;
      if (theta <= 700) return 0.60 - 0.17 * (theta - 600) / 100;
      if (theta <= 800) return 0.43 - 0.16 * (theta - 700) / 100;
      if (theta <= 900) return 0.27 - 0.12 * (theta - 800) / 100;
      return 0.15 * Math.max(0, (1200 - theta) / 300);
    }
  }

  /**
   * Reinforcement strength reduction at temperature
   */
  static rebarStrengthReduction(theta: number, hotRolled: boolean = true): number {
    if (hotRolled) {
      // Class N reinforcement
      if (theta <= 400) return 1.0;
      if (theta <= 500) return 1.0 - 0.22 * (theta - 400) / 100;
      if (theta <= 600) return 0.78 - 0.31 * (theta - 500) / 100;
      if (theta <= 700) return 0.47 - 0.24 * (theta - 600) / 100;
      if (theta <= 800) return 0.23 - 0.12 * (theta - 700) / 100;
      return 0.11 * Math.max(0, (1200 - theta) / 400);
    } else {
      // Cold-worked reinforcement (Class X)
      if (theta <= 400) return 1.0;
      if (theta <= 500) return 1.0 - 0.22 * (theta - 400) / 100;
      if (theta <= 550) return 0.78 - 0.26 * (theta - 500) / 50;
      if (theta <= 600) return 0.52 - 0.14 * (theta - 550) / 50;
      if (theta <= 700) return 0.38 - 0.2 * (theta - 600) / 100;
      return 0.18 * Math.max(0, (1000 - theta) / 300);
    }
  }

  /**
   * Thermal conductivity of concrete (W/mK)
   */
  static thermalConductivity(theta: number): number {
    // Upper limit (siliceous)
    return 2 - 0.2451 * (theta / 100) + 0.0107 * Math.pow(theta / 100, 2);
  }

  /**
   * Specific heat of concrete (J/kgK)
   */
  static specificHeat(theta: number, moistureContent: number = 3): number {
    // Dry concrete
    let c_p: number;
    if (theta <= 100) {
      c_p = 900;
    } else if (theta <= 200) {
      c_p = 900 + (theta - 100);
    } else if (theta <= 400) {
      c_p = 1000 + (theta - 200) / 2;
    } else {
      c_p = 1100;
    }

    // Moisture peak (around 100-115°C)
    if (theta >= 100 && theta <= 115) {
      c_p += moistureContent * 500 * (1 - (theta - 100) / 15);
    }

    return c_p;
  }
}

// ============================================================================
// STEEL MEMBER TEMPERATURE CALCULATOR
// ============================================================================

export class SteelTemperatureCalculator {
  /**
   * Calculate unprotected steel temperature using step method
   */
  static unprotectedTemperature(
    section: SteelSectionFire,
    exposure: FireExposure,
    timeStep: number = 1 // minutes
  ): {
    temperatures: { time: number; theta: number }[];
    timeTo350: number;
    timeTo550: number;
  } {
    const temperatures: { time: number; theta: number }[] = [];
    let theta = 20; // Initial temperature
    let timeTo350 = -1;
    let timeTo550 = -1;

    const rhoS = 7850; // Steel density kg/m³
    const Am_V = section.sectionFactor; // 1/m

    for (let t = 0; t <= exposure.duration; t += timeStep) {
      const thetaG = FireTemperatureCurves.getTemperature(exposure, t);
      
      // Heat transfer coefficient
      const epsilon = 0.7; // Emissivity
      const alpha_c = 25; // Convective coefficient W/m²K
      const sigma = 5.67e-8; // Stefan-Boltzmann constant

      // Radiative heat transfer
      const h_net = alpha_c * (thetaG - theta) + 
                   epsilon * sigma * (Math.pow(thetaG + 273, 4) - Math.pow(theta + 273, 4));

      // Temperature increment
      const c_a = SteelPropertiesFire.specificHeat(theta);
      const deltaTheta = Am_V * h_net * timeStep * 60 / (rhoS * c_a);

      theta += deltaTheta;
      temperatures.push({ time: t, theta });

      // Track critical temperatures
      if (theta >= 350 && timeTo350 < 0) timeTo350 = t;
      if (theta >= 550 && timeTo550 < 0) timeTo550 = t;
    }

    return { temperatures, timeTo350, timeTo550 };
  }

  /**
   * Calculate protected steel temperature
   */
  static protectedTemperature(
    section: SteelSectionFire,
    protection: FireProtection,
    exposure: FireExposure,
    timeStep: number = 1
  ): {
    temperatures: { time: number; theta: number }[];
    timeToCritical: number;
    criticalTemperature: number;
  } {
    const temperatures: { time: number; theta: number }[] = [];
    let theta = 20;
    const thetaP_prev = 20;

    const rhoS = 7850;
    const Am_V = section.sectionFactor;
    const dp = protection.thickness / 1000; // Convert to m
    const lambdaP = protection.thermalConductivity || 0.2;
    const rhoP = protection.density || 500;
    const cP = protection.specificHeat || 1200;

    // Moisture delay (if applicable)
    const moistureDelay = (protection.moistureContent || 0) * 2; // minutes

    for (let t = 0; t <= exposure.duration; t += timeStep) {
      const thetaG = FireTemperatureCurves.getTemperature(exposure, t);
      
      // Protection thermal properties
      const phi = cP * rhoP / (rhoS * SteelPropertiesFire.specificHeat(theta));
      const phiPrime = phi * dp * Am_V;

      // Temperature increment (EN 1993-1-2 Eq. 4.25)
      let deltaTheta: number;
      
      if (t < moistureDelay) {
        deltaTheta = 0;
      } else {
        const dTheta_g = t > timeStep ? 
          FireTemperatureCurves.getTemperature(exposure, t) - 
          FireTemperatureCurves.getTemperature(exposure, t - timeStep) : 0;

        deltaTheta = (lambdaP * Am_V / dp) * (thetaG - theta) * timeStep * 60 / 
                    (rhoS * SteelPropertiesFire.specificHeat(theta) * (1 + phiPrime / 3)) -
                    (Math.exp(phiPrime / 10) - 1) * dTheta_g;
        
        deltaTheta = Math.max(0, deltaTheta);
      }

      theta += deltaTheta;
      temperatures.push({ time: t, theta });
    }

    // Find time to critical temperature
    const criticalTemperature = 550; // Default critical temperature
    const timeToCritical = temperatures.find(t => t.theta >= criticalTemperature)?.time || -1;

    return { temperatures, timeToCritical, criticalTemperature };
  }
}

// ============================================================================
// CONCRETE TEMPERATURE CALCULATOR
// ============================================================================

export class ConcreteTemperatureCalculator {
  /**
   * Calculate temperature profile in concrete section
   * Using simplified zone method (500°C isotherm)
   */
  static temperatureProfile(
    section: ConcreteSectionFire,
    exposure: FireExposure
  ): {
    surfaceTemp: number;
    rebarTemp: number;
    coreTemp: number;
    reducedWidth: number; // After 500°C isotherm
    reducedDepth: number;
  } {
    const { width, depth, cover } = section;
    const t = exposure.duration;

    // Surface temperature (approximately fire temperature)
    const surfaceTemp = FireTemperatureCurves.getTemperature(exposure, t) * 0.95;

    // Depth of 500°C isotherm (simplified)
    // Based on tabulated data from EN 1992-1-2
    let a500: number; // mm
    if (t <= 30) {
      a500 = 5 + 0.5 * t;
    } else if (t <= 60) {
      a500 = 20 + 0.33 * (t - 30);
    } else if (t <= 90) {
      a500 = 30 + 0.5 * (t - 60);
    } else if (t <= 120) {
      a500 = 45 + 0.5 * (t - 90);
    } else {
      a500 = 60 + 0.3 * (t - 120);
    }

    // Reduced section dimensions
    const reducedWidth = exposure.exposedSides >= 2 ? width - 2 * a500 : width - a500;
    const reducedDepth = exposure.exposedSides >= 3 ? depth - 2 * a500 : 
                        exposure.exposedSides >= 1 ? depth - a500 : depth;

    // Rebar temperature (based on cover and position)
    const rebarDepth = cover + section.reinforcement.size / 2;
    let rebarTemp: number;
    
    if (rebarDepth <= a500) {
      rebarTemp = 500 + (surfaceTemp - 500) * (1 - rebarDepth / a500);
    } else {
      // Temperature decreases exponentially beyond 500°C isotherm
      const dist = rebarDepth - a500;
      rebarTemp = 500 * Math.exp(-dist / 50);
    }

    // Core temperature
    const coreTemp = Math.min(rebarTemp * 0.3, 100);

    return {
      surfaceTemp,
      rebarTemp,
      coreTemp,
      reducedWidth: Math.max(0, reducedWidth),
      reducedDepth: Math.max(0, reducedDepth)
    };
  }

  /**
   * Calculate temperature at specific depth (1D heat transfer)
   */
  static temperatureAtDepth(
    depth: number, // mm from surface
    time: number, // minutes
    aggregate: 'siliceous' | 'calcareous' = 'siliceous'
  ): number {
    // Simplified based on tabulated data
    const thetaS = FireTemperatureCurves.standardCurve(time) * 0.95;
    
    // Thermal diffusivity (m²/s)
    const alpha = 0.417e-6;
    
    // Dimensionless depth
    const x = depth / 1000; // m
    const Fo = alpha * time * 60 / (0.1 * 0.1); // Fourier number (normalized)
    
    // Approximate solution
    const theta = thetaS * Math.exp(-x / (0.05 + 0.002 * Math.sqrt(time)));
    
    return Math.max(20, theta);
  }
}

// ============================================================================
// FIRE RESISTANCE DESIGN CHECKER
// ============================================================================

export class FireResistanceChecker {
  /**
   * Check fire resistance of steel beam
   */
  static checkSteelBeam(params: {
    section: SteelSectionFire;
    protection?: FireProtection;
    loads: {
      Mfi: number; // Fire design moment kNm
      Vfi: number; // Fire design shear kN
    };
    capacity: {
      Mrd: number; // Ambient moment capacity kNm
      Vrd: number; // Ambient shear capacity kN
    };
    requiredRating: number; // minutes
    fy: number; // Yield strength MPa
    exposure: FireExposure;
  }): FireDesignResult {
    const { section, protection, loads, capacity, requiredRating, fy, exposure } = params;
    const recommendations: string[] = [];

    // Calculate utilization at ambient
    const mu0 = Math.max(loads.Mfi / capacity.Mrd, loads.Vfi / capacity.Vrd);

    // Critical temperature
    const thetaCr = SteelPropertiesFire.criticalTemperature(mu0);

    // Calculate temperature development
    let tempResult: { temperatures: { time: number; theta: number }[]; };
    let timeToCritical: number;

    if (!protection || protection.type === 'none') {
      const result = SteelTemperatureCalculator.unprotectedTemperature(
        section, exposure
      );
      tempResult = result;
      timeToCritical = result.temperatures.find(t => t.theta >= thetaCr)?.time || -1;
    } else {
      const result = SteelTemperatureCalculator.protectedTemperature(
        section, protection, exposure
      );
      tempResult = result;
      timeToCritical = result.temperatures.find(t => t.theta >= thetaCr)?.time || -1;
    }

    // Calculate capacity at fire conditions
    const thetaAtRequired = tempResult.temperatures.find(t => t.time >= requiredRating)?.theta || 0;
    const kyTheta = SteelPropertiesFire.yieldReduction(thetaAtRequired);
    const fiCapacity = capacity.Mrd * kyTheta;

    // Determine fire rating
    const fireRating = timeToCritical > 0 ? timeToCritical : exposure.duration;

    // Status check
    const status = fireRating >= requiredRating ? 'ADEQUATE' : 'INADEQUATE';

    // Recommendations
    if (status === 'INADEQUATE') {
      if (!protection || protection.type === 'none') {
        recommendations.push('Add fire protection to achieve required rating');
        const requiredThickness = this.estimateProtectionThickness(
          section, requiredRating, thetaCr
        );
        recommendations.push(`Estimated protection thickness: ${requiredThickness.toFixed(0)} mm`);
      } else {
        recommendations.push('Increase protection thickness or use higher performance material');
      }
    }

    if (section.sectionFactor > 200) {
      recommendations.push('High section factor - member heats quickly. Consider larger section.');
    }

    return {
      fireRating,
      criticalTemperature: thetaCr,
      timeToReachCritical: timeToCritical,
      capacityRatios: {
        ambient: 1 / mu0,
        fire: fiCapacity / loads.Mfi,
        reduction: kyTheta
      },
      temperatureProfile: tempResult.temperatures.map(t => ({
        time: t.time,
        surface: t.theta,
        core: t.theta // Uniform for steel
      })),
      status,
      recommendations
    };
  }

  /**
   * Check fire resistance of RC beam/slab
   */
  static checkConcreteBeam(params: {
    section: ConcreteSectionFire;
    loads: {
      Mfi: number; // kNm
    };
    capacity: {
      Mrd: number; // Ambient capacity kNm
    };
    requiredRating: number;
    exposure: FireExposure;
    fck: number;
    fyk: number;
  }): FireDesignResult {
    const { section, loads, capacity, requiredRating, exposure, fck, fyk } = params;
    const recommendations: string[] = [];

    // Calculate temperature profile
    const tempProfile = ConcreteTemperatureCalculator.temperatureProfile(section, exposure);

    // Concrete and rebar strength reduction
    const aggregateType = section.aggregateType === 'lightweight' ? 'calcareous' : section.aggregateType;
    const kc = ConcretePropertiesFire.strengthReduction(
      tempProfile.coreTemp, aggregateType
    );
    const ks = ConcretePropertiesFire.rebarStrengthReduction(tempProfile.rebarTemp, true);

    // Reduced capacity (simplified approach)
    const Mfi_Rd = capacity.Mrd * ks * 
                   (tempProfile.reducedDepth / section.depth) *
                   (tempProfile.reducedWidth / section.width);

    // Fire rating based on tabular data (EN 1992-1-2 Table 5.5)
    let fireRating: number;
    if (section.cover >= 60) fireRating = 120;
    else if (section.cover >= 45) fireRating = 90;
    else if (section.cover >= 35) fireRating = 60;
    else if (section.cover >= 25) fireRating = 30;
    else fireRating = 15;

    // Also check minimum dimensions
    if (section.width < 200) fireRating = Math.min(fireRating, 60);
    if (section.width < 160) fireRating = Math.min(fireRating, 30);

    const status = fireRating >= requiredRating && Mfi_Rd >= loads.Mfi ? 
                  'ADEQUATE' : 'INADEQUATE';

    // Recommendations
    if (status === 'INADEQUATE') {
      if (section.cover < 40) {
        recommendations.push(`Increase cover to reinforcement. Current: ${section.cover}mm, Recommended: 40-50mm`);
      }
      if (section.width < 200) {
        recommendations.push(`Increase beam width. Current: ${section.width}mm, Recommended: ≥200mm`);
      }
      recommendations.push('Consider use of calcareous aggregate for better fire performance');
    }

    if (section.cover < 25) {
      recommendations.push('Warning: Cover less than 25mm may cause explosive spalling');
    }

    return {
      fireRating,
      criticalTemperature: 500, // Reference temperature
      timeToReachCritical: fireRating,
      capacityRatios: {
        ambient: capacity.Mrd / loads.Mfi,
        fire: Mfi_Rd / loads.Mfi,
        reduction: ks * kc
      },
      temperatureProfile: [{
        time: requiredRating,
        surface: tempProfile.surfaceTemp,
        core: tempProfile.coreTemp,
        rebar: tempProfile.rebarTemp
      }],
      status,
      recommendations
    };
  }

  /**
   * Check fire resistance of steel column
   */
  static checkSteelColumn(params: {
    section: SteelSectionFire;
    protection?: FireProtection;
    loads: {
      Nfi: number; // Axial load kN
      Mfi?: number; // Moment kNm
    };
    capacity: {
      Nrd: number; // Ambient axial capacity kN
      Mrd?: number; // Moment capacity kNm
    };
    requiredRating: number;
    buckling: {
      length: number; // mm
      chi: number; // Buckling reduction factor
    };
    fy: number;
    exposure: FireExposure;
  }): FireDesignResult {
    const { section, protection, loads, capacity, requiredRating, buckling, fy, exposure } = params;
    const recommendations: string[] = [];

    // Calculate utilization
    const mu0 = loads.Nfi / capacity.Nrd;

    // Critical temperature (lower for columns due to buckling)
    let thetaCr = SteelPropertiesFire.criticalTemperature(mu0);
    
    // Reduce critical temperature for slender columns
    const slenderness = buckling.length / Math.sqrt(section.area);
    if (slenderness > 60) {
      thetaCr *= 0.9;
    }
    if (slenderness > 100) {
      thetaCr *= 0.85;
    }

    // Temperature calculation
    let tempResult: { temperatures: { time: number; theta: number }[] };
    
    if (!protection || protection.type === 'none') {
      tempResult = SteelTemperatureCalculator.unprotectedTemperature(section, exposure);
    } else {
      tempResult = SteelTemperatureCalculator.protectedTemperature(section, protection, exposure);
    }

    const timeToCritical = tempResult.temperatures.find(t => t.theta >= thetaCr)?.time || -1;
    const fireRating = timeToCritical > 0 ? timeToCritical : exposure.duration;

    const status = fireRating >= requiredRating ? 'ADEQUATE' : 'INADEQUATE';

    // Capacity at required rating
    const thetaAtRequired = tempResult.temperatures.find(t => t.time >= requiredRating)?.theta || 20;
    const kyTheta = SteelPropertiesFire.yieldReduction(thetaAtRequired);
    const kETheta = SteelPropertiesFire.modulusReduction(thetaAtRequired);

    // Recommendations
    if (status === 'INADEQUATE') {
      recommendations.push('Consider one of the following:');
      recommendations.push('- Add or increase fire protection');
      recommendations.push('- Use concrete-filled steel section');
      recommendations.push('- Increase section size to reduce section factor');
    }

    if (slenderness > 80) {
      recommendations.push('High slenderness ratio reduces fire resistance significantly');
    }

    return {
      fireRating,
      criticalTemperature: thetaCr,
      timeToReachCritical: timeToCritical,
      capacityRatios: {
        ambient: 1 / mu0,
        fire: kyTheta * buckling.chi,
        reduction: kyTheta
      },
      temperatureProfile: tempResult.temperatures.map(t => ({
        time: t.time,
        surface: t.theta,
        core: t.theta
      })),
      status,
      recommendations
    };
  }

  /**
   * Estimate required protection thickness
   */
  private static estimateProtectionThickness(
    section: SteelSectionFire,
    requiredRating: number,
    criticalTemperature: number
  ): number {
    // Simplified estimation based on section factor
    const Am_V = section.sectionFactor;
    
    // Base thickness for different ratings (typical board protection)
    let baseThickness: number;
    if (requiredRating <= 30) baseThickness = 10;
    else if (requiredRating <= 60) baseThickness = 15;
    else if (requiredRating <= 90) baseThickness = 25;
    else if (requiredRating <= 120) baseThickness = 35;
    else baseThickness = 45;

    // Adjust for section factor
    const sfFactor = Math.sqrt(Am_V / 150);
    
    return baseThickness * sfFactor;
  }
}

// ============================================================================
// TABULATED FIRE RATINGS
// ============================================================================

export class TabulatedFireRatings {
  /**
   * Get minimum dimensions for RC beams (EN 1992-1-2 Table 5.5)
   */
  static rcBeamMinDimensions(rating: number): {
    width: number;
    cover: number;
    notes: string;
  }[] {
    const ratings: Record<number, { width: number; cover: number; notes: string }[]> = {
      30: [
        { width: 80, cover: 25, notes: 'Simply supported' },
        { width: 160, cover: 15, notes: 'Continuous' }
      ],
      60: [
        { width: 120, cover: 35, notes: 'Simply supported' },
        { width: 200, cover: 25, notes: 'Continuous' }
      ],
      90: [
        { width: 150, cover: 45, notes: 'Simply supported' },
        { width: 250, cover: 35, notes: 'Continuous' }
      ],
      120: [
        { width: 200, cover: 55, notes: 'Simply supported' },
        { width: 300, cover: 45, notes: 'Continuous' }
      ],
      180: [
        { width: 240, cover: 65, notes: 'Simply supported' },
        { width: 400, cover: 55, notes: 'Continuous' }
      ],
      240: [
        { width: 280, cover: 75, notes: 'Simply supported' },
        { width: 500, cover: 65, notes: 'Continuous' }
      ]
    };

    return ratings[rating] || ratings[60];
  }

  /**
   * Get minimum dimensions for RC columns (EN 1992-1-2 Table 5.2a)
   */
  static rcColumnMinDimensions(rating: number, exposedSides: number = 4): {
    width: number;
    cover: number;
    mufi_max: number;
  } {
    const data: Record<number, Record<number, { width: number; cover: number; mufi_max: number }>> = {
      30: {
        4: { width: 200, cover: 25, mufi_max: 0.7 },
        1: { width: 155, cover: 25, mufi_max: 0.7 }
      },
      60: {
        4: { width: 250, cover: 30, mufi_max: 0.7 },
        1: { width: 155, cover: 25, mufi_max: 0.7 }
      },
      90: {
        4: { width: 300, cover: 38, mufi_max: 0.7 },
        1: { width: 155, cover: 31, mufi_max: 0.7 }
      },
      120: {
        4: { width: 350, cover: 45, mufi_max: 0.7 },
        1: { width: 175, cover: 40, mufi_max: 0.7 }
      },
      180: {
        4: { width: 450, cover: 57, mufi_max: 0.7 },
        1: { width: 230, cover: 55, mufi_max: 0.7 }
      },
      240: {
        4: { width: 600, cover: 70, mufi_max: 0.7 },
        1: { width: 295, cover: 70, mufi_max: 0.7 }
      }
    };

    return data[rating]?.[exposedSides] || data[60][4];
  }

  /**
   * Get IS 456 minimum cover requirements for fire
   */
  static is456FireCover(rating: number, memberType: 'beam' | 'column' | 'slab' | 'wall'): {
    minCover: number;
    minWidth: number;
  } {
    const data: Record<string, Record<number, { minCover: number; minWidth: number }>> = {
      beam: {
        30: { minCover: 20, minWidth: 80 },
        60: { minCover: 30, minWidth: 120 },
        90: { minCover: 40, minWidth: 150 },
        120: { minCover: 50, minWidth: 200 },
        180: { minCover: 60, minWidth: 240 },
        240: { minCover: 70, minWidth: 280 }
      },
      column: {
        30: { minCover: 25, minWidth: 200 },
        60: { minCover: 35, minWidth: 250 },
        90: { minCover: 40, minWidth: 300 },
        120: { minCover: 50, minWidth: 350 },
        180: { minCover: 55, minWidth: 400 },
        240: { minCover: 65, minWidth: 450 }
      },
      slab: {
        30: { minCover: 20, minWidth: 75 },
        60: { minCover: 25, minWidth: 95 },
        90: { minCover: 35, minWidth: 110 },
        120: { minCover: 45, minWidth: 125 },
        180: { minCover: 55, minWidth: 150 },
        240: { minCover: 65, minWidth: 175 }
      },
      wall: {
        30: { minCover: 20, minWidth: 100 },
        60: { minCover: 25, minWidth: 120 },
        90: { minCover: 30, minWidth: 140 },
        120: { minCover: 40, minWidth: 160 },
        180: { minCover: 50, minWidth: 200 },
        240: { minCover: 60, minWidth: 240 }
      }
    };

    return data[memberType]?.[rating] || data[memberType][60];
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  FireTemperatureCurves,
  SteelPropertiesFire,
  ConcretePropertiesFire,
  SteelTemperatureCalculator,
  ConcreteTemperatureCalculator,
  FireResistanceChecker,
  TabulatedFireRatings
};
