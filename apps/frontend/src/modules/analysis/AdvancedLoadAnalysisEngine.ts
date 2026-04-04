/**
 * ============================================================================
 * ADVANCED LOAD ANALYSIS ENGINE
 * ============================================================================
 * 
 * Comprehensive load analysis for complex loading conditions covering:
 * - Moving load analysis (influence lines)
 * - Blast load analysis
 * - Impact and collision loads
 * - Vibration serviceability
 * - Thermal stress analysis
 * - Snow drift and ponding
 * 
 * Design Codes:
 * - IS 875 Parts 1-5 - Code of Practice for Design Loads
 * - IS 1893 - Seismic Loads
 * - ASCE 7 - Minimum Design Loads
 * - EN 1991 (Eurocode 1) - Actions on Structures
 * - IRC 6 - Bridge Loads
 * - UFC 3-340-02 - Blast Design
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MovingLoad {
  type: 'point' | 'uniform' | 'train';
  magnitude: number; // kN or kN/m
  length?: number; // m for uniform or train
  axleSpacing?: number[]; // m for train loads
  axleWeights?: number[]; // kN for train loads
  impactFactor?: number;
}

export interface InfluenceLinePoint {
  position: number; // Distance from support A
  value: number; // Influence ordinate
}

export interface VibrationParameters {
  naturalFrequency: number; // Hz
  dampingRatio: number;
  modalMass: number; // kg
  peakAcceleration?: number; // m/s²
}

export interface ThermalData {
  deltaT_uniform: number; // Uniform temperature change, °C
  deltaT_gradient?: number; // Temperature gradient through depth, °C
  thermalCoeff: number; // Coefficient of thermal expansion
  restraintType: 'free' | 'partial' | 'full';
}

export interface BlastParameters {
  chargeWeight: number; // kg TNT equivalent
  standoffDistance: number; // m
  surfaceType: 'free-air' | 'surface' | 'hemispherical';
}

// ============================================================================
// INFLUENCE LINE GENERATOR
// ============================================================================

export class InfluenceLineGenerator {
  /**
   * Generate influence line for reaction at support A of simply supported beam
   */
  static reactionAtSupportA(span: number, numPoints: number = 100): InfluenceLinePoint[] {
    const points: InfluenceLinePoint[] = [];
    const dx = span / numPoints;

    for (let i = 0; i <= numPoints; i++) {
      const x = i * dx;
      points.push({
        position: x,
        value: 1 - x / span // RA influence line: η = 1 - x/L
      });
    }

    return points;
  }

  /**
   * Generate influence line for bending moment at any section
   */
  static bendingMoment(
    span: number,
    sectionLocation: number, // Distance from support A
    numPoints: number = 100
  ): InfluenceLinePoint[] {
    const points: InfluenceLinePoint[] = [];
    const dx = span / numPoints;
    const a = sectionLocation;
    const b = span - sectionLocation;

    for (let i = 0; i <= numPoints; i++) {
      const x = i * dx;
      let value: number;

      if (x <= a) {
        // Load to the left of section
        value = x * b / span;
      } else {
        // Load to the right of section
        value = a * (span - x) / span;
      }

      points.push({ position: x, value });
    }

    return points;
  }

  /**
   * Generate influence line for shear at any section
   */
  static shearForce(
    span: number,
    sectionLocation: number,
    numPoints: number = 100
  ): InfluenceLinePoint[] {
    const points: InfluenceLinePoint[] = [];
    const dx = span / numPoints;
    const a = sectionLocation;

    for (let i = 0; i <= numPoints; i++) {
      const x = i * dx;
      let value: number;

      if (x < a) {
        // Load to the left of section
        value = -x / span;
      } else if (x > a) {
        // Load to the right of section
        value = 1 - x / span;
      } else {
        // Load at section - discontinuity
        value = 0; // Average of jump
      }

      points.push({ position: x, value });
    }

    return points;
  }

  /**
   * Generate influence line for deflection at any point
   */
  static deflection(
    span: number,
    deflectionPoint: number, // Where deflection is measured
    EI: number, // Flexural rigidity, kN·m²
    numPoints: number = 100
  ): InfluenceLinePoint[] {
    const points: InfluenceLinePoint[] = [];
    const dx = span / numPoints;
    const a = deflectionPoint;
    const L = span;

    for (let i = 0; i <= numPoints; i++) {
      const x = i * dx;
      let value: number;

      if (x <= a) {
        // Load at x, deflection at a (x ≤ a)
        value = (x * (L - a) * (L * L - (L - a) * (L - a) - x * x)) / (6 * L * EI);
      } else {
        // Load at x, deflection at a (x > a)
        value = (a * (L - x) * (L * L - a * a - (L - x) * (L - x))) / (6 * L * EI);
      }

      points.push({ position: x, value });
    }

    return points;
  }

  /**
   * Generate influence line for continuous beam using three-moment equation
   */
  static continuousBeamMoment(
    spans: number[], // Array of span lengths
    supportIndex: number, // Which support (0 to n)
    numPoints: number = 100
  ): InfluenceLinePoint[] {
    const points: InfluenceLinePoint[] = [];
    const totalLength = spans.reduce((a, b) => a + b, 0);
    const dx = totalLength / numPoints;

    // Simplified for 2-span continuous beam
    if (spans.length !== 2) {
      console.warn('Detailed IL for continuous beams with >2 spans requires matrix methods');
    }

    const L1 = spans[0];
    const L2 = spans.length > 1 ? spans[1] : L1;

    for (let i = 0; i <= numPoints; i++) {
      const x = i * dx;
      let value = 0;

      if (supportIndex === 1 && spans.length >= 2) {
        // Moment at interior support
        if (x <= L1) {
          // Load in first span
          const a = x;
          value = -a * (L1 - a) * (2 * L1 - a) / (4 * L1 * (L1 + L2));
        } else {
          // Load in second span
          const b = x - L1;
          value = -b * (L2 - b) * (2 * L2 - b) / (4 * L2 * (L1 + L2));
        }
      }

      points.push({ position: x, value });
    }

    return points;
  }
}

// ============================================================================
// MOVING LOAD ANALYZER
// ============================================================================

export class MovingLoadAnalyzer {
  /**
   * Find maximum effect from moving load using influence lines
   */
  static findMaximumEffect(
    influenceLine: InfluenceLinePoint[],
    movingLoad: MovingLoad
  ): {
    maxPositive: { value: number; position: number };
    maxNegative: { value: number; position: number };
    criticalLoadPositions: number[];
  } {
    let maxPositive = { value: 0, position: 0 };
    let maxNegative = { value: 0, position: 0 };
    const criticalPositions: number[] = [];

    if (movingLoad.type === 'point') {
      // Point load - find max ordinate
      for (const point of influenceLine) {
        const effect = movingLoad.magnitude * point.value;
        if (effect > maxPositive.value) {
          maxPositive = { value: effect, position: point.position };
        }
        if (effect < maxNegative.value) {
          maxNegative = { value: effect, position: point.position };
        }
      }
      criticalPositions.push(maxPositive.position, maxNegative.position);
    } else if (movingLoad.type === 'train' && movingLoad.axleWeights && movingLoad.axleSpacing) {
      // Train of loads - use influence line ordinates at each axle position
      const axles = movingLoad.axleWeights;
      const spacings = movingLoad.axleSpacing;
      
      // Calculate cumulative positions of axles
      const axlePositions = [0];
      for (let i = 0; i < spacings.length; i++) {
        axlePositions.push(axlePositions[i] + spacings[i]);
      }

      // Move train across and find maximum
      const span = influenceLine[influenceLine.length - 1].position;
      const trainLength = axlePositions[axlePositions.length - 1];
      const startPos = -trainLength;
      const endPos = span;
      const step = 0.1;

      for (let headPos = startPos; headPos <= endPos; headPos += step) {
        let effect = 0;

        for (let i = 0; i < axles.length; i++) {
          const axlePos = headPos + axlePositions[i];
          if (axlePos >= 0 && axlePos <= span) {
            // Interpolate influence line value
            const ilValue = this.interpolateIL(influenceLine, axlePos);
            effect += axles[i] * ilValue;
          }
        }

        if (effect > maxPositive.value) {
          maxPositive = { value: effect, position: headPos };
        }
        if (effect < maxNegative.value) {
          maxNegative = { value: effect, position: headPos };
        }
      }
    }

    // Apply impact factor if specified
    if (movingLoad.impactFactor) {
      maxPositive.value *= (1 + movingLoad.impactFactor);
      maxNegative.value *= (1 + movingLoad.impactFactor);
    }

    return { maxPositive, maxNegative, criticalLoadPositions: criticalPositions };
  }

  /**
   * Interpolate influence line value at given position
   */
  private static interpolateIL(il: InfluenceLinePoint[], position: number): number {
    if (position <= il[0].position) return il[0].value;
    if (position >= il[il.length - 1].position) return il[il.length - 1].value;

    for (let i = 0; i < il.length - 1; i++) {
      if (position >= il[i].position && position <= il[i + 1].position) {
        const t = (position - il[i].position) / (il[i + 1].position - il[i].position);
        return il[i].value + t * (il[i + 1].value - il[i].value);
      }
    }

    return 0;
  }

  /**
   * IRC standard loading analysis
   */
  static ircLoadingAnalysis(
    span: number,
    loadingClass: '70R' | 'Class-A' | 'Class-AA'
  ): {
    designLoad: number;
    impactFactor: number;
    maxBendingMoment: number;
    maxShearForce: number;
    criticalVehiclePosition: string;
  } {
    let wheelLoads: number[];
    let axleSpacing: number[];

    switch (loadingClass) {
      case '70R':
        // IRC 70R Tracked vehicle
        if (span <= 9) {
          wheelLoads = [350, 350]; // 700 kN total, simplified
          axleSpacing = [4.57];
        } else {
          wheelLoads = [170, 170, 170, 170]; // Wheeled alternative
          axleSpacing = [1.37, 3.05, 1.37];
        }
        break;
      case 'Class-A':
        // IRC Class A train
        wheelLoads = [27, 27, 114, 114, 68, 68, 68, 68];
        axleSpacing = [1.1, 3.2, 1.2, 4.3, 3.0, 3.0, 3.0];
        break;
      case 'Class-AA':
        // IRC Class AA tracked
        wheelLoads = [350, 350];
        axleSpacing = [3.6];
        break;
      default:
        wheelLoads = [100];
        axleSpacing = [];
    }

    // Impact factor per IRC 6
    let impactFactor: number;
    if (loadingClass === '70R' || loadingClass === 'Class-AA') {
      impactFactor = span <= 9 ? 0.25 : 0.10;
    } else {
      if (span <= 3) {
        impactFactor = 0.545;
      } else if (span <= 45) {
        impactFactor = 4.5 / (6 + span);
      } else {
        impactFactor = 0.088;
      }
    }

    // Generate influence lines and find max effects
    const ilMoment = InfluenceLineGenerator.bendingMoment(span, span / 2);
    const ilShear = InfluenceLineGenerator.shearForce(span, span / 4);

    const movingLoad: MovingLoad = {
      type: 'train',
      magnitude: 0,
      axleWeights: wheelLoads,
      axleSpacing: axleSpacing,
      impactFactor
    };

    const momentResult = this.findMaximumEffect(ilMoment, movingLoad);
    const shearResult = this.findMaximumEffect(ilShear, movingLoad);

    return {
      designLoad: wheelLoads.reduce((a, b) => a + b, 0),
      impactFactor,
      maxBendingMoment: momentResult.maxPositive.value,
      maxShearForce: shearResult.maxPositive.value,
      criticalVehiclePosition: `Head at ${momentResult.maxPositive.position.toFixed(2)}m from support A`
    };
  }
}

// ============================================================================
// BLAST LOAD CALCULATOR
// ============================================================================

export class BlastLoadCalculator {
  /**
   * Calculate blast parameters using UFC 3-340-02 charts (simplified)
   */
  static calculateBlastParameters(params: BlastParameters): {
    scaledDistance: number;
    peakOverpressure: number; // kPa
    positivePhaseDuration: number; // ms
    positiveImpulse: number; // kPa-ms
    reflectedPressure: number; // kPa
    dynamicPressure: number; // kPa
  } {
    const W = params.chargeWeight;
    const R = params.standoffDistance;

    // Scaled distance (Hopkinson-Cranz scaling)
    const Z = R / Math.pow(W, 1/3);

    // Peak overpressure (empirical fit to UFC data)
    let Pso: number;
    if (Z < 0.5) {
      Pso = 6784 * Math.pow(Z, -1.1); // Very close range
    } else if (Z < 2) {
      Pso = 1455 * Math.pow(Z, -1.4);
    } else if (Z < 10) {
      Pso = 585 * Math.pow(Z, -1.8);
    } else {
      Pso = 77 * Math.pow(Z, -1.3);
    }

    // Surface burst factor
    let surfaceFactor = 1.0;
    if (params.surfaceType === 'surface') {
      surfaceFactor = 1.8;
    } else if (params.surfaceType === 'hemispherical') {
      surfaceFactor = 2.0;
    }
    Pso *= surfaceFactor;

    // Positive phase duration (ms)
    const td = 1.67 * Math.pow(W, 1/3) * Math.pow(Z, 0.47);

    // Positive impulse (kPa-ms)
    const is = 200 * Math.pow(W, 1/3) / Z;

    // Reflected pressure
    const Cr = 2 + 6 * Pso / (Pso + 101.325); // Reflection coefficient
    const Pr = Cr * Pso;

    // Dynamic pressure
    const q = 5 * Pso * Pso / (2 * (Pso + 101.325));

    return {
      scaledDistance: Z,
      peakOverpressure: Pso,
      positivePhaseDuration: td,
      positiveImpulse: is,
      reflectedPressure: Pr,
      dynamicPressure: q
    };
  }

  /**
   * Calculate equivalent static load for design
   */
  static equivalentStaticLoad(
    blastPressure: number, // kPa
    structuralPeriod: number, // s
    positiveDuration: number, // ms
    ductilityFactor: number = 1.0
  ): {
    dynamicLoadFactor: number;
    equivalentPressure: number; // kPa
    designPressure: number; // kPa (with ductility)
    responseType: 'impulsive' | 'dynamic' | 'quasi-static';
  } {
    const T = structuralPeriod * 1000; // Convert to ms
    const td = positiveDuration;
    const ratio = td / T;

    let DLF: number;
    let responseType: 'impulsive' | 'dynamic' | 'quasi-static';

    if (ratio < 0.1) {
      // Impulsive regime
      DLF = 2 * Math.PI * ratio;
      responseType = 'impulsive';
    } else if (ratio < 3) {
      // Dynamic regime
      DLF = 2 * Math.sin(Math.PI * ratio / 2);
      DLF = Math.min(DLF, 2);
      responseType = 'dynamic';
    } else {
      // Quasi-static
      DLF = 2;
      responseType = 'quasi-static';
    }

    const equivalentPressure = blastPressure * DLF;
    const designPressure = equivalentPressure / ductilityFactor;

    return {
      dynamicLoadFactor: DLF,
      equivalentPressure,
      designPressure,
      responseType
    };
  }

  /**
   * Safe standoff distance calculation
   */
  static safeStandoff(
    chargeWeight: number, // kg TNT
    acceptablePressure: number, // kPa
    surfaceType: 'free-air' | 'surface' = 'free-air'
  ): {
    minimumDistance: number; // m
    evacRadius: number; // m
    fragmentRange: number; // m
  } {
    // Iteratively find distance for acceptable pressure
    let R = 1;
    let Pso = 10000;

    while (Pso > acceptablePressure && R < 1000) {
      const params = this.calculateBlastParameters({
        chargeWeight,
        standoffDistance: R,
        surfaceType
      });
      Pso = params.peakOverpressure;
      R += 0.5;
    }

    // Fragment range (simplified - typically larger than blast effect)
    const fragmentRange = 8 * Math.pow(chargeWeight, 0.35);

    // Evacuation radius (typically based on injuries from glass)
    const evacRadius = R * 1.5;

    return {
      minimumDistance: R,
      evacRadius,
      fragmentRange
    };
  }
}

// ============================================================================
// VIBRATION SERVICEABILITY CHECKER
// ============================================================================

export class VibrationServiceabilityChecker {
  /**
   * Check floor vibration acceptability per AISC Design Guide 11
   */
  static checkFloorVibration(
    span: number, // m
    beamSpacing: number, // m
    mass: number, // kg/m²
    EI: number, // Flexural rigidity, kN·m² per m width
    damping: number = 0.03 // 3% typical for composite floor
  ): {
    naturalFrequency: number; // Hz
    peakAcceleration: number; // m/s²
    accelerationLimit: number;
    status: 'ACCEPTABLE' | 'PERCEPTIBLE' | 'UNACCEPTABLE';
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // Natural frequency (simply supported beam)
    const L = span;
    const m = mass; // kg/m²
    const EI_total = EI * beamSpacing; // Per beam

    // Fundamental frequency
    const w = m * beamSpacing * 9.81 / 1000; // kN/m per beam
    const delta = 5 * w * Math.pow(L, 4) / (384 * EI_total); // Static deflection, m

    const fn = 0.18 * Math.sqrt(9.81 / delta); // Hz

    // Peak acceleration for walking excitation
    const W = 0.7; // Effective weight of walker, kN
    const alpha_i = 0.5; // Fourier coefficient for 2nd harmonic
    const beta = damping;

    // Walking frequency typically 1.5-2.2 Hz
    const fwalk = 2.0; // Hz (near resonance if fn ≈ 4 Hz)

    // Peak acceleration (resonance build-up limited by damping)
    let ap: number;
    if (fn < 3) {
      // Very flexible - avoid resonance
      ap = (0.29 * W) / (beta * m * beamSpacing * L) * 9.81; // m/s²
      recommendations.push('Floor frequency below 3 Hz - highly susceptible to walking vibration');
    } else if (fn < 9) {
      // Walking excitation relevant
      const R = 0.56 * Math.exp(-0.35 * fn); // Reduction factor
      ap = R * W * 9.81 / (beta * m * beamSpacing * L);
    } else {
      // High frequency - less affected
      ap = 0.02; // Low value
    }

    // Acceptance criteria (AISC DG11 / ISO 10137)
    let status: 'ACCEPTABLE' | 'PERCEPTIBLE' | 'UNACCEPTABLE';

    // Office/residential limit
    const limit = 0.005 * 9.81; // 0.5% g ≈ 0.05 m/s²

    if (ap < limit) {
      status = 'ACCEPTABLE';
    } else if (ap < 2 * limit) {
      status = 'PERCEPTIBLE';
      recommendations.push('Floor vibration may be perceptible but within tolerance');
    } else {
      status = 'UNACCEPTABLE';
      recommendations.push('Increase floor stiffness or add damping');
      recommendations.push('Consider tuned mass damper');
    }

    if (fn < 4) {
      recommendations.push('Consider increasing beam depth to raise natural frequency');
    }

    return {
      naturalFrequency: fn,
      peakAcceleration: ap,
      accelerationLimit: limit,
      status,
      recommendations
    };
  }

  /**
   * Footbridge vibration check per Sétra guidelines
   */
  static checkFootbridgeVibration(
    span: number,
    width: number,
    mass: number, // kg/m²
    EI: number, // kN·m²
    pedestrianClass: 'sparse' | 'moderate' | 'dense' | 'very-dense'
  ): {
    verticalFrequency: number;
    lateralFrequency: number;
    verticalAcceleration: number;
    lateralAcceleration: number;
    verticalLimit: number;
    lateralLimit: number;
    lockInRisk: boolean;
    status: 'PASS' | 'FAIL';
    recommendations: string[];
  } {
    const L = span;
    const m = mass * width; // kg/m (linear)
    const recommendations: string[] = [];

    // Frequencies
    const fv = (Math.PI / (2 * L * L)) * Math.sqrt(EI * 1000 / m);
    const fl = fv * 0.5; // Approximate lateral frequency

    // Pedestrian density
    const densityMap = {
      'sparse': 0.5,    // ped/m²
      'moderate': 0.8,
      'dense': 1.0,
      'very-dense': 1.5
    };
    const d = densityMap[pedestrianClass];

    // Number of equivalent synchronized pedestrians
    const n = d * L * width;
    const neq_v = 10.8 * Math.sqrt(0.01 * n); // Vertical
    const neq_l = 10.8 * Math.sqrt(0.01 * n); // Lateral

    // Force per pedestrian
    const F0_v = 280; // N (vertical)
    const F0_l = 35;  // N (lateral)

    // Peak accelerations (resonance)
    const beta = 0.01; // Damping (conservative)
    const phi = 1.0;   // Mode shape at midspan

    let av = neq_v * F0_v * phi / (2 * beta * m * L);
    let al = neq_l * F0_l * phi / (2 * beta * m * L);

    // Frequency-based reduction (away from walking frequency)
    if (fv < 1.7 || fv > 2.4) {
      av *= 0.5; // Outside primary walking frequency
    }
    if (fl < 0.5 || fl > 1.2) {
      al *= 0.5;
    }

    // Comfort limits (Sétra)
    const limitsV = { max: 2.5, min: 0.5 }; // m/s²
    const limitsL = { max: 0.8, min: 0.1 };

    // Lock-in check (Millennium Bridge phenomenon)
    const lockInRisk = fl >= 0.5 && fl <= 1.2 && n > 100;
    if (lockInRisk) {
      recommendations.push('WARNING: Lateral lock-in vibration risk');
      recommendations.push('Consider lateral dampers or stiffening');
    }

    let status: 'PASS' | 'FAIL' = 'PASS';
    if (av > limitsV.max || al > limitsL.max) {
      status = 'FAIL';
      recommendations.push('Vibration exceeds comfort limits');
    }

    if (fv < 3) {
      recommendations.push('Vertical frequency below 3 Hz - susceptible to walking resonance');
    }

    return {
      verticalFrequency: fv,
      lateralFrequency: fl,
      verticalAcceleration: av,
      lateralAcceleration: al,
      verticalLimit: limitsV.max,
      lateralLimit: limitsL.max,
      lockInRisk,
      status,
      recommendations
    };
  }
}

// ============================================================================
// THERMAL STRESS ANALYZER
// ============================================================================

export class ThermalStressAnalyzer {
  /**
   * Calculate thermal stresses in restrained member
   */
  static calculateThermalStress(
    thermal: ThermalData,
    E: number, // Elastic modulus, MPa
    sectionDepth: number // mm
  ): {
    axialStress: number; // MPa (from uniform temperature)
    bendingStress: number; // MPa (from gradient)
    totalStress: { top: number; bottom: number };
    axialForce: number; // kN per unit width
    bendingMoment: number; // kNm per unit width
  } {
    const alpha = thermal.thermalCoeff;
    const deltaT = thermal.deltaT_uniform;
    const deltaT_g = thermal.deltaT_gradient || 0;
    const d = sectionDepth;

    // Free thermal strain
    const epsilon_free = alpha * deltaT;
    const curvature_free = alpha * deltaT_g / d;

    // Restraint factors
    let Kr_axial: number; // Axial restraint factor
    let Kr_rot: number;   // Rotational restraint factor

    switch (thermal.restraintType) {
      case 'full':
        Kr_axial = 1.0;
        Kr_rot = 1.0;
        break;
      case 'partial':
        Kr_axial = 0.5;
        Kr_rot = 0.5;
        break;
      case 'free':
        Kr_axial = 0;
        Kr_rot = 0;
        break;
    }

    // Restrained axial stress
    const sigma_axial = Kr_axial * E * epsilon_free;

    // Restrained bending stress (self-equilibrating for gradient)
    const sigma_bending = E * curvature_free * (d / 2) * Kr_rot;

    // Total stresses
    const sigmaTop = sigma_axial - sigma_bending;
    const sigmaBottom = sigma_axial + sigma_bending;

    // Forces per unit width (assuming 1m width)
    const width = 1000; // mm
    const A = width * d;
    const I = width * d * d * d / 12;

    const axialForce = sigma_axial * A / 1e6; // kN/m
    const bendingMoment = sigma_bending * 2 * I / (d * 1e6); // kNm/m

    return {
      axialStress: sigma_axial,
      bendingStress: sigma_bending,
      totalStress: { top: sigmaTop, bottom: sigmaBottom },
      axialForce,
      bendingMoment
    };
  }

  /**
   * Calculate expansion joint spacing
   */
  static jointSpacing(
    thermalCoeff: number,
    temperatureRange: number, // Max-Min, °C
    allowableStrain: number, // Strain limit before jointing required
    frictionCoeff: number = 0.5
  ): {
    maxSpacing: number; // m
    expectedMovement: number; // mm per 10m
    jointWidth: number; // Recommended mm
  } {
    // Maximum length before strain limit reached (assuming partial restraint)
    const totalStrain = thermalCoeff * temperatureRange;
    const restraintFactor = 0.5; // Typical for partially restrained slab
    const effectiveStrain = totalStrain * restraintFactor;

    const maxSpacing = allowableStrain / effectiveStrain;

    // Expected movement
    const movementPer10m = thermalCoeff * temperatureRange * 10000; // mm

    // Joint width (accommodate full movement + tolerance)
    const jointWidth = Math.ceil(movementPer10m * 1.5 / 5) * 5;

    return {
      maxSpacing: Math.min(maxSpacing, 45), // Practical limit
      expectedMovement: movementPer10m,
      jointWidth: Math.max(jointWidth, 10)
    };
  }

  /**
   * Bridge thermal movements
   */
  static bridgeThermalMovement(
    bridgeLength: number, // m
    thermalCoeff: number,
    temperatureRange: { max: number; min: number; installation: number },
    bearingType: 'fixed' | 'guided' | 'free'
  ): {
    maxExpansion: number; // mm
    maxContraction: number; // mm
    totalRange: number; // mm
    bearingCapacity: number; // Required horizontal movement capacity
    forceAtFixedBearing: number; // kN (approximate)
  } {
    const L = bridgeLength * 1000; // mm
    const alpha = thermalCoeff;

    const T_install = temperatureRange.installation;
    const T_max = temperatureRange.max;
    const T_min = temperatureRange.min;

    const expansion = alpha * (T_max - T_install) * L;
    const contraction = alpha * (T_install - T_min) * L;

    // Bearing capacity
    let bearingCapacity = 0;
    if (bearingType === 'fixed') {
      bearingCapacity = 0;
    } else if (bearingType === 'guided') {
      bearingCapacity = Math.abs(expansion) + Math.abs(contraction);
    } else {
      bearingCapacity = Math.abs(expansion) + Math.abs(contraction);
    }

    // Force at fixed bearing (friction from expansion bearings)
    // Approximate: friction × deck weight
    const deckWeight = 20 * bridgeLength; // kN (approximate 20 kN/m)
    const frictionCoeff = 0.05; // Low friction bearing
    const forceAtFixed = frictionCoeff * deckWeight / 2; // Half at each end if symmetric

    return {
      maxExpansion: expansion,
      maxContraction: contraction,
      totalRange: expansion + contraction,
      bearingCapacity,
      forceAtFixedBearing: forceAtFixed
    };
  }
}

// ============================================================================
// SNOW AND PONDING ANALYZER
// ============================================================================

export class SnowPondingAnalyzer {
  /**
   * Calculate snow drift loads per IS 875/ASCE 7
   */
  static snowDriftLoads(
    groundSnowLoad: number, // kN/m²
    roofGeometry: {
      type: 'flat' | 'mono-slope' | 'duo-slope';
      slope: number; // degrees
      length: number; // m (in direction of drift)
      stepHeight?: number; // m (for stepped roofs)
    },
    exposure: 'sheltered' | 'partial' | 'exposed',
    importance: number = 1.0
  ): {
    balancedLoad: number; // kN/m²
    driftLoad: number; // kN/m² at peak
    driftLength: number; // m
    driftHeight: number; // m
    loadDiagram: { position: number; load: number }[];
  } {
    const pg = groundSnowLoad;
    const slope = roofGeometry.slope;

    // Exposure factor
    const exposureFactors = { 'sheltered': 1.2, 'partial': 1.0, 'exposed': 0.8 };
    const Ce = exposureFactors[exposure];

    // Thermal factor (heated building)
    const Ct = 1.0;

    // Slope factor (reduces for steep slopes)
    let Cs: number;
    if (slope <= 5) {
      Cs = 1.0;
    } else if (slope <= 30) {
      Cs = 1 - (slope - 5) / 65;
    } else if (slope <= 70) {
      Cs = 1 - (slope - 5) / 50;
    } else {
      Cs = 0;
    }

    // Balanced (uniform) snow load
    const pf = 0.7 * Ce * Ct * Cs * importance * pg;

    // Drift loads (for stepped roofs or parapets)
    const stepH = roofGeometry.stepHeight || 0;
    let hd = 0; // Drift height
    let driftLoad = 0;
    let driftLength = 0;

    if (stepH > 0) {
      // Leeward drift (behind higher portion)
      const lu = roofGeometry.length; // Upwind fetch
      const gamma = Math.min(0.426 * Math.pow(pg, 0.5) + 2.2, 4.7); // Snow density kN/m³
      
      hd = 0.75 * Math.pow(lu, 0.35) * Math.pow(pg, 0.25) - 1.5;
      hd = Math.min(hd, stepH);
      hd = Math.max(hd, 0.5);

      driftLength = 4 * hd;
      driftLoad = gamma * hd + pf; // Peak load at step
    }

    // Load diagram
    const diagram: { position: number; load: number }[] = [];
    const L = roofGeometry.length;
    
    if (stepH > 0) {
      // Triangular drift
      diagram.push({ position: 0, load: pf });
      diagram.push({ position: L - driftLength, load: pf });
      diagram.push({ position: L, load: driftLoad });
    } else {
      // Uniform load
      diagram.push({ position: 0, load: pf });
      diagram.push({ position: L, load: pf });
    }

    return {
      balancedLoad: pf,
      driftLoad,
      driftLength,
      driftHeight: hd,
      loadDiagram: diagram
    };
  }

  /**
   * Check roof ponding stability
   */
  static checkPondingStability(
    span: number, // m
    beamSpacing: number, // m
    EI: number, // kN·m² (beam flexural rigidity)
    drainCapacity: number, // L/s
    rainfallIntensity: number, // mm/hr
    roofSlope: number, // degrees
    code: 'ASCE7' | 'IS875' = 'ASCE7'
  ): {
    pondingRisk: boolean;
    flexibilityFactor: number;
    stabilityIndex: number;
    maxPondingDepth: number; // mm
    requiredDrainCapacity: number; // L/s
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    const L = span;
    const s = beamSpacing;
    const I = EI;

    // Water density
    const gammaW = 9.81; // kN/m³

    // Flexibility factor (ASCE 7)
    // Cp = (gammaW × L^4) / (π^4 × EI)
    const Cp_primary = (gammaW * Math.pow(L, 4)) / (Math.pow(Math.PI, 4) * I);

    // For flat or low-slope roofs (< 0.5 inch per foot ≈ 2.4°)
    const isLowSlope = roofSlope < 2.5;

    // Stability check
    // Sum of Cp should be less than 0.25 for stability
    const stabilityIndex = Cp_primary;

    let pondingRisk = false;
    if (isLowSlope && stabilityIndex > 0.25) {
      pondingRisk = true;
      recommendations.push('CRITICAL: Roof susceptible to ponding instability');
      recommendations.push('Increase beam stiffness or add roof slope');
    } else if (stabilityIndex > 0.15) {
      recommendations.push('Moderate ponding sensitivity - ensure adequate drainage');
    }

    // Required drain capacity
    const catchmentArea = L * s; // m²
    const runoff = (rainfallIntensity / 1000 / 3600) * catchmentArea * 1000; // L/s
    
    if (drainCapacity < runoff) {
      recommendations.push(`Increase drain capacity from ${drainCapacity} to ${runoff.toFixed(1)} L/s`);
    }

    // Maximum ponding depth (assuming blocked drain)
    // Assume 15 minute storm with maximum intensity
    const stormVolume = rainfallIntensity * 0.25 * catchmentArea / 1000; // m³ in 15 min
    const maxDepth = stormVolume / catchmentArea * 1000; // mm

    if (maxDepth > 50 && !isLowSlope) {
      recommendations.push('Consider secondary drainage or overflow scuppers');
    }

    return {
      pondingRisk,
      flexibilityFactor: Cp_primary,
      stabilityIndex,
      maxPondingDepth: maxDepth,
      requiredDrainCapacity: runoff,
      recommendations
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  InfluenceLineGenerator,
  MovingLoadAnalyzer,
  BlastLoadCalculator,
  VibrationServiceabilityChecker,
  ThermalStressAnalyzer,
  SnowPondingAnalyzer
};
