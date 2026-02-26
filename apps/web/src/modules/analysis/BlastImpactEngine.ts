/**
 * ============================================================================
 * BLAST AND IMPACT ANALYSIS ENGINE
 * ============================================================================
 * 
 * Comprehensive blast and impact loading analysis for protective design:
 * - Blast wave propagation and loading
 * - Progressive collapse analysis
 * - Vehicle impact assessment
 * - Debris impact calculations
 * - Dynamic response analysis
 * 
 * Design Codes Supported:
 * - UFC 3-340-02 (Structures to Resist Blast Effects)
 * - ASCE/SEI 59-22 (Blast Protection)
 * - GSA Progressive Collapse Guidelines
 * - Eurocode 1-1-7 (Accidental Actions)
 * - DoD Antiterrorism Standards
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BlastSource {
  type: 'hemispherical' | 'spherical' | 'cylindrical';
  chargeWeight: number; // kg TNT equivalent
  standoffDistance: number; // m
  heightOfBurst: number; // m (0 = surface burst)
  confinement: 'unconfined' | 'partially-confined' | 'fully-confined';
}

export interface BlastLoading {
  peakOverpressure: number; // kPa
  positiveImpulse: number; // kPa-ms
  negativePressure: number; // kPa
  negativeImpulse: number; // kPa-ms
  arrivalTime: number; // ms
  positiveDuration: number; // ms
  negativeDuration: number; // ms
  dynamicPressure: number; // kPa
  reflectedPressure: number; // kPa
  reflectedImpulse: number; // kPa-ms
}

export interface MemberResponse {
  maxDeflection: number;
  maxRotation: number; // degrees
  ductilityDemand: number;
  supportReaction: number;
  responseCategory: 'elastic' | 'superficial' | 'moderate' | 'heavy' | 'hazardous' | 'blowout';
  damageLevelDescription: string;
}

export interface ImpactLoad {
  type: 'vehicle' | 'debris' | 'aircraft' | 'missile' | 'falling-object';
  mass: number; // kg
  velocity: number; // m/s
  contactArea: number; // m²
  duration?: number; // ms
  angle?: number; // degrees from normal
}

export interface ProgressiveCollapseResult {
  dcr: number; // Demand-Capacity Ratio
  redundancy: number;
  susceptibility: 'low' | 'medium' | 'high';
  alternateLoadPath: boolean;
  keyElements: string[];
  recommendations: string[];
}

// ============================================================================
// BLAST WAVE CALCULATIONS (UFC 3-340-02)
// ============================================================================

export class BlastWaveCalculator {
  /**
   * Calculate scaled distance (Hopkinson-Cranz scaling)
   */
  static scaledDistance(distance: number, chargeWeight: number): number {
    return distance / Math.pow(chargeWeight, 1 / 3);
  }

  /**
   * Calculate incident (side-on) blast parameters from scaled distance
   * Based on UFC 3-340-02 Figure 2-15
   */
  static incidentBlastParameters(
    Z: number, // Scaled distance (m/kg^1/3)
    chargeWeight: number,
    burstType: 'surface' | 'air' = 'surface'
  ): {
    peakOverpressure: number; // kPa
    positiveImpulse: number; // kPa-ms
    positiveDuration: number; // ms
    arrivalTime: number; // ms
  } {
    // Hemispherical (surface) burst has 1.8x effect of spherical
    const burstFactor = burstType === 'surface' ? 1.8 : 1.0;
    const W = chargeWeight * burstFactor;

    // Kingery-Bulmash equations (simplified)
    let Pso: number; // Peak overpressure (kPa)
    let is: number; // Positive impulse (kPa-ms/kg^1/3)
    let ta: number; // Arrival time (ms/kg^1/3)
    let to: number; // Positive phase duration (ms/kg^1/3)

    if (Z < 0.5) {
      // Near field
      Pso = 22072 * Math.pow(Z, -1.13);
      is = 760 * Math.pow(Z, -0.26);
      ta = 0.0;
      to = 0.5 * Math.pow(chargeWeight, 1 / 3);
    } else if (Z < 2) {
      // Close-in region
      Pso = 4832 * Math.pow(Z, -1.32);
      is = 657 * Math.pow(Z, -0.89);
      ta = 0.185 * Math.pow(chargeWeight, 1 / 3) * Math.pow(Z, 2.23);
      to = 1.35 * Math.pow(chargeWeight, 1 / 3) * Math.pow(Z, 0.35);
    } else if (Z < 10) {
      // Intermediate region
      Pso = 1117 * Math.pow(Z, -1.69);
      is = 258 * Math.pow(Z, -1.08);
      ta = 0.185 * Math.pow(chargeWeight, 1 / 3) * Math.pow(Z, 2.23);
      to = 2.34 * Math.pow(chargeWeight, 1 / 3) * Math.pow(Z, 0.13);
    } else {
      // Far field
      Pso = 79.5 * Math.pow(Z, -1.09);
      is = 49.3 * Math.pow(Z, -0.96);
      ta = 0.185 * Math.pow(chargeWeight, 1 / 3) * Math.pow(Z, 2.23);
      to = 3.67 * Math.pow(chargeWeight, 1 / 3);
    }

    return {
      peakOverpressure: Pso,
      positiveImpulse: is * Math.pow(chargeWeight, 1 / 3),
      positiveDuration: to,
      arrivalTime: ta
    };
  }

  /**
   * Calculate reflected blast parameters
   * Based on UFC 3-340-02 for normal reflection
   */
  static reflectedBlastParameters(
    incident: ReturnType<typeof BlastWaveCalculator.incidentBlastParameters>,
    angleOfIncidence: number = 0 // degrees
  ): {
    reflectedPressure: number;
    reflectedImpulse: number;
    reflectionCoefficient: number;
  } {
    const Pso = incident.peakOverpressure;
    
    // Calculate reflection coefficient for normal reflection
    // Cr = (8 * Pso / P0 + 14) / (Pso / P0 + 7)
    const P0 = 101.3; // Atmospheric pressure (kPa)
    const ratio = Pso / P0;
    
    let Cr = (8 * ratio + 14) / (ratio + 7);
    
    // Adjust for angle of incidence (simplified)
    if (angleOfIncidence > 0) {
      const angleRad = (angleOfIncidence * Math.PI) / 180;
      Cr = Cr * Math.cos(angleRad) + 1 * Math.sin(angleRad);
    }
    
    // Limit reflection coefficient
    Cr = Math.min(Cr, 8);

    return {
      reflectedPressure: Cr * Pso,
      reflectedImpulse: Cr * incident.positiveImpulse * 0.9, // Slightly reduced for impulse
      reflectionCoefficient: Cr
    };
  }

  /**
   * Calculate dynamic (drag) pressure
   */
  static dynamicPressure(peakOverpressure: number): number {
    const P0 = 101.3; // Atmospheric pressure (kPa)
    const gamma = 1.4; // Ratio of specific heats
    
    const Pso = peakOverpressure;
    const qo = (5 * Pso * Pso) / (2 * (7 * P0 + Pso));
    
    return qo;
  }

  /**
   * Calculate negative phase parameters
   */
  static negativePhaseParameters(
    positivePressure: number,
    positiveDuration: number
  ): {
    negativePressure: number;
    negativeDuration: number;
    negativeImpulse: number;
  } {
    // Simplified approximation
    const negativePressure = 0.35 * positivePressure;
    const negativeDuration = 2.5 * positiveDuration;
    const negativeImpulse = 0.5 * negativePressure * negativeDuration * 0.5;

    return {
      negativePressure,
      negativeDuration,
      negativeImpulse
    };
  }

  /**
   * Complete blast loading calculation
   */
  static calculateBlastLoading(source: BlastSource): BlastLoading {
    const Z = this.scaledDistance(source.standoffDistance, source.chargeWeight);
    const burstType = source.heightOfBurst === 0 ? 'surface' : 'air';
    
    const incident = this.incidentBlastParameters(Z, source.chargeWeight, burstType);
    const reflected = this.reflectedBlastParameters(incident);
    const dynamic = this.dynamicPressure(incident.peakOverpressure);
    const negative = this.negativePhaseParameters(
      incident.peakOverpressure,
      incident.positiveDuration
    );

    // Apply confinement factor
    let confinementFactor = 1.0;
    if (source.confinement === 'partially-confined') {
      confinementFactor = 1.3;
    } else if (source.confinement === 'fully-confined') {
      confinementFactor = 1.8;
    }

    return {
      peakOverpressure: incident.peakOverpressure * confinementFactor,
      positiveImpulse: incident.positiveImpulse * confinementFactor,
      negativePressure: negative.negativePressure,
      negativeImpulse: negative.negativeImpulse,
      arrivalTime: incident.arrivalTime,
      positiveDuration: incident.positiveDuration,
      negativeDuration: negative.negativeDuration,
      dynamicPressure: dynamic * confinementFactor,
      reflectedPressure: reflected.reflectedPressure * confinementFactor,
      reflectedImpulse: reflected.reflectedImpulse * confinementFactor
    };
  }
}

// ============================================================================
// SDOF RESPONSE ANALYSIS
// ============================================================================

export class SDOFBlastResponse {
  /**
   * Calculate equivalent SDOF parameters for structural member
   */
  static equivalentSDOF(
    memberType: 'beam' | 'plate' | 'wall',
    boundaryCondition: 'simply-supported' | 'fixed-fixed' | 'cantilever' | 'fixed-pinned',
    span: number,
    tributaryWidth: number,
    mass: number, // Total mass
    stiffness: number // Elastic stiffness
  ): {
    KLM: number; // Load-mass factor
    KL: number; // Load factor
    KM: number; // Mass factor
    ke: number; // Equivalent stiffness
    me: number; // Equivalent mass
    naturalPeriod: number;
  } {
    // Load-mass factors from UFC 3-340-02 Table 3-12
    let KL: number, KM: number;

    if (memberType === 'beam') {
      switch (boundaryCondition) {
        case 'simply-supported':
          KL = 0.64; KM = 0.50;
          break;
        case 'fixed-fixed':
          KL = 0.53; KM = 0.41;
          break;
        case 'cantilever':
          KL = 0.40; KM = 0.26;
          break;
        case 'fixed-pinned':
          KL = 0.58; KM = 0.45;
          break;
        default:
          KL = 0.64; KM = 0.50;
      }
    } else {
      // Plate/Wall - simplified one-way action
      switch (boundaryCondition) {
        case 'simply-supported':
          KL = 0.45; KM = 0.33;
          break;
        case 'fixed-fixed':
          KL = 0.33; KM = 0.21;
          break;
        default:
          KL = 0.45; KM = 0.33;
      }
    }

    const KLM = KL / KM;
    const ke = stiffness * KL;
    const me = mass * KM;
    const naturalPeriod = 2 * Math.PI * Math.sqrt(me / ke);

    return { KLM, KL, KM, ke, me, naturalPeriod };
  }

  /**
   * Calculate maximum response using P-I diagram approach
   */
  static maxResponsePIDiagram(
    peakLoad: number, // Total peak load (kN)
    impulse: number, // Total impulse (kN-ms)
    resistance: number, // Ultimate resistance (kN)
    ke: number, // Equivalent stiffness (kN/m)
    me: number, // Equivalent mass (kg)
    ductilityLimit: number = 20
  ): {
    maxDeflection: number;
    ductilityDemand: number;
    responseRegime: 'impulsive' | 'dynamic' | 'quasi-static';
    loadToResistanceRatio: number;
  } {
    const T = 2 * Math.PI * Math.sqrt(me / ke);
    const yeq = resistance / ke; // Yield deflection
    
    // Calculate characteristic loading duration
    const td = 2 * impulse / peakLoad;
    
    // Determine response regime
    let responseRegime: 'impulsive' | 'dynamic' | 'quasi-static';
    if (td / T < 0.1) {
      responseRegime = 'impulsive';
    } else if (td / T > 3) {
      responseRegime = 'quasi-static';
    } else {
      responseRegime = 'dynamic';
    }

    let maxDeflection: number;

    if (responseRegime === 'impulsive') {
      // Impulsive loading - response governed by impulse
      const velocity = impulse / me;
      maxDeflection = velocity * Math.sqrt(me / ke);
      
      if (maxDeflection > yeq) {
        // Plastic deformation
        const KE = 0.5 * me * velocity * velocity;
        const elasticEnergy = 0.5 * resistance * yeq;
        const plasticWork = KE - elasticEnergy;
        maxDeflection = yeq + plasticWork / resistance;
      }
    } else if (responseRegime === 'quasi-static') {
      // Quasi-static - response governed by peak load
      maxDeflection = peakLoad / ke;
      
      if (peakLoad > resistance) {
        // DLF approximately 1.0 for long duration
        maxDeflection = peakLoad / ke * 1.0;
      }
    } else {
      // Dynamic regime - use DLF approach
      const DLF = this.dynamicLoadFactor(td, T, ductilityLimit);
      maxDeflection = (peakLoad * DLF) / ke;
    }

    const ductilityDemand = maxDeflection / yeq;

    return {
      maxDeflection,
      ductilityDemand,
      responseRegime,
      loadToResistanceRatio: peakLoad / resistance
    };
  }

  /**
   * Dynamic load factor for blast loading
   */
  static dynamicLoadFactor(td: number, T: number, ductility: number = 1): number {
    const ratio = td / T;
    
    // For elastic response
    if (ductility <= 1) {
      if (ratio < 0.25) {
        return 2 * Math.PI * ratio;
      } else if (ratio < 1) {
        return 2.0;
      } else if (ratio < 3) {
        return 1.5;
      } else {
        return 1.0;
      }
    }
    
    // For plastic response (ductility > 1)
    const elasticDLF = ratio < 1 ? 2.0 : (ratio < 3 ? 1.5 : 1.0);
    const reductionFactor = Math.sqrt(2 * ductility - 1) / ductility;
    
    return elasticDLF / reductionFactor;
  }

  /**
   * Classify response category per UFC 3-340-02
   */
  static classifyResponse(
    ductilityDemand: number,
    supportRotation: number, // degrees
    memberType: 'concrete' | 'steel' | 'masonry'
  ): MemberResponse['responseCategory'] {
    // UFC 3-340-02 Table 5-8 to 5-12 criteria
    if (memberType === 'concrete') {
      if (supportRotation < 2 && ductilityDemand < 3) return 'superficial';
      if (supportRotation < 5 && ductilityDemand < 6) return 'moderate';
      if (supportRotation < 10 && ductilityDemand < 12) return 'heavy';
      if (supportRotation < 15) return 'hazardous';
      return 'blowout';
    } else if (memberType === 'steel') {
      if (supportRotation < 2 && ductilityDemand < 3) return 'superficial';
      if (supportRotation < 6 && ductilityDemand < 10) return 'moderate';
      if (supportRotation < 12 && ductilityDemand < 20) return 'heavy';
      return 'hazardous';
    } else {
      // Masonry - more brittle
      if (ductilityDemand < 1.5) return 'superficial';
      if (ductilityDemand < 2) return 'moderate';
      if (ductilityDemand < 3) return 'heavy';
      return 'blowout';
    }
  }

  /**
   * Calculate support rotation
   */
  static supportRotation(maxDeflection: number, span: number): number {
    // Assume parabolic deflected shape
    const rotation = Math.atan(2 * maxDeflection / span) * 180 / Math.PI;
    return rotation;
  }
}

// ============================================================================
// IMPACT LOADING ANALYSIS
// ============================================================================

export class ImpactLoadCalculator {
  /**
   * Calculate equivalent static impact force
   */
  static equivalentStaticForce(
    impact: ImpactLoad,
    targetStiffness: number, // kN/m
    targetMass: number, // kg
    coefficientOfRestitution: number = 0.2
  ): {
    peakForce: number;
    impulseDuration: number;
    totalImpulse: number;
    energyAbsorbed: number;
  } {
    const m1 = impact.mass;
    const v1 = impact.velocity;
    const m2 = targetMass;
    const k = targetStiffness * 1000; // Convert to N/m
    const e = coefficientOfRestitution;

    // Contact stiffness (Hertz theory approximation)
    const kc = Math.sqrt(k * m2) * 2;

    // Contact duration
    const tc = 2.94 * Math.pow((m1 * m2 / (m1 + m2)) / kc, 0.5) * 
               Math.pow((m1 + m2) / m2, 0.4) *
               Math.pow(v1, 0.2);

    // Peak contact force
    const Fmax = 1.5 * m1 * v1 / tc;

    // Impulse
    const I = m1 * v1 * (1 + e);

    // Energy absorbed
    const KE = 0.5 * m1 * v1 * v1;
    const KErebound = 0.5 * m1 * Math.pow(e * v1, 2);
    const energyAbsorbed = KE - KErebound;

    return {
      peakForce: Fmax / 1000, // kN
      impulseDuration: tc * 1000, // ms
      totalImpulse: I / 1000, // kN-s
      energyAbsorbed: energyAbsorbed / 1000 // kJ
    };
  }

  /**
   * Vehicle impact force per Eurocode 1-1-7
   */
  static vehicleImpactForceEC1(
    vehicleCategory: 'car' | 'van' | 'truck' | 'train',
    impactSpeed: number // m/s
  ): {
    horizontalForce: number; // kN
    verticalForce: number; // kN
    impactHeight: number; // m
    vehicleMass: number; // kg
  } {
    // Table 4.1 of EN 1991-1-7
    const vehicleData = {
      'car': { mass: 1500, F0: 500, height: 0.5 },
      'van': { mass: 3000, F0: 750, height: 0.5 },
      'truck': { mass: 20000, F0: 1500, height: 1.25 },
      'train': { mass: 200000, F0: 4000, height: 1.8 }
    };

    const data = vehicleData[vehicleCategory];
    
    // Adjust for impact speed (reference is typically 4.5 m/s for cars)
    const refSpeed = vehicleCategory === 'car' ? 4.5 : 2.0;
    const speedFactor = Math.pow(impactSpeed / refSpeed, 2);

    const horizontalForce = data.F0 * speedFactor;
    const verticalForce = horizontalForce * 0.5; // Simplified vertical component

    return {
      horizontalForce,
      verticalForce,
      impactHeight: data.height,
      vehicleMass: data.mass
    };
  }

  /**
   * Debris impact analysis
   */
  static debrisImpact(
    debrisMass: number, // kg
    debrisVelocity: number, // m/s
    debrisType: 'timber' | 'steel' | 'masonry' | 'glass',
    targetMaterial: 'concrete' | 'steel' | 'timber'
  ): {
    impactForce: number;
    penetrationDepth: number;
    perforation: boolean;
    requiredThickness: number;
  } {
    // Missile impact coefficients
    const missileModulus: Record<string, number> = {
      'timber': 1.0,
      'steel': 3.0,
      'masonry': 1.5,
      'glass': 0.5
    };

    const targetStrength: Record<string, number> = {
      'concrete': 40, // MPa (compressive)
      'steel': 250, // MPa (yield)
      'timber': 30 // MPa (compression parallel)
    };

    const KE = 0.5 * debrisMass * debrisVelocity * debrisVelocity;
    const Mm = missileModulus[debrisType];
    const fc = targetStrength[targetMaterial] * 1000; // kPa

    // Empirical penetration formula
    const debrisRadius = Math.pow(debrisMass / (1000 * Math.PI), 1 / 3); // Assumed sphere
    const penetrationDepth = (KE * Mm) / (fc * Math.PI * debrisRadius * debrisRadius * 1000);

    // Impact force (simplified)
    const contactTime = 0.005; // 5 ms assumed
    const impactForce = debrisMass * debrisVelocity / contactTime / 1000;

    // Perforation check
    const perforationThreshold = targetMaterial === 'steel' ? 0.02 : 0.15;
    const perforation = penetrationDepth > perforationThreshold;

    // Required thickness
    const requiredThickness = penetrationDepth * 2.5; // Safety factor

    return {
      impactForce,
      penetrationDepth,
      perforation,
      requiredThickness
    };
  }
}

// ============================================================================
// PROGRESSIVE COLLAPSE ANALYSIS
// ============================================================================

export class ProgressiveCollapseAnalyzer {
  /**
   * GSA Linear static analysis procedure
   */
  static linearStaticAnalysis(
    removedColumnDCR: number[], // DCR values after column removal
    initialDCR: number[], // DCR values before column removal
    memberConnectivity: number[][] // Connectivity matrix
  ): ProgressiveCollapseResult {
    // Maximum DCR after column removal
    const maxDCR = Math.max(...removedColumnDCR);
    
    // Calculate redundancy
    const avgDCRIncrease = removedColumnDCR.reduce((sum, dcr, i) => 
      sum + (dcr - initialDCR[i]), 0) / removedColumnDCR.length;
    const redundancy = 1 / (1 + avgDCRIncrease);

    // Identify key elements (those with high DCR increase)
    const keyElements: string[] = [];
    for (let i = 0; i < removedColumnDCR.length; i++) {
      if (removedColumnDCR[i] / initialDCR[i] > 1.5) {
        keyElements.push(`Member ${i + 1}`);
      }
    }

    // Determine susceptibility
    let susceptibility: ProgressiveCollapseResult['susceptibility'];
    if (maxDCR < 1.5) {
      susceptibility = 'low';
    } else if (maxDCR < 2.0) {
      susceptibility = 'medium';
    } else {
      susceptibility = 'high';
    }

    // Check alternate load path
    const alternateLoadPath = maxDCR < 2.0;

    // Generate recommendations
    const recommendations: string[] = [];
    if (!alternateLoadPath) {
      recommendations.push('Structure lacks adequate alternate load path');
      recommendations.push('Consider adding moment connections or transfer beams');
    }
    if (keyElements.length > 0) {
      recommendations.push(`Key elements requiring special attention: ${keyElements.join(', ')}`);
    }
    if (susceptibility === 'high') {
      recommendations.push('Nonlinear dynamic analysis recommended');
      recommendations.push('Consider local hardening of key elements');
    }

    return {
      dcr: maxDCR,
      redundancy,
      susceptibility,
      alternateLoadPath,
      keyElements,
      recommendations
    };
  }

  /**
   * UFC 4-023-03 tie force method
   */
  static tieForceMethod(
    floorArea: number, // m²
    numStoreys: number,
    loadCombination: {
      deadLoad: number; // kN/m²
      liveLoad: number; // kN/m²
    },
    tieSpacing: {
      internal: number; // m
      peripheral: number; // m
      vertical: number; // m (storey height)
    }
  ): {
    internalTieForce: number;
    peripheralTieForce: number;
    verticalTieForce: number;
    cornerColumnForce: number;
  } {
    const qk = loadCombination.deadLoad + 0.5 * loadCombination.liveLoad;
    const L = tieSpacing.internal;
    const La = tieSpacing.peripheral;
    const h = tieSpacing.vertical;

    // Internal tie force (kN/m)
    const internalTieForce = 0.8 * (loadCombination.deadLoad + loadCombination.liveLoad) * L;

    // Peripheral tie force (kN)
    const Ft = Math.max(20, 60 * numStoreys); // Basic tie force (kN)
    const peripheralTieForce = Ft * La / 2.5;

    // Vertical tie force per column
    const tributaryArea = L * L;
    const verticalTieForce = 1.0 * qk * tributaryArea;

    // Corner column tie
    const cornerColumnForce = 1.5 * peripheralTieForce;

    return {
      internalTieForce,
      peripheralTieForce,
      verticalTieForce,
      cornerColumnForce
    };
  }

  /**
   * Risk category determination per ASCE/SEI 7
   */
  static riskCategory(
    occupancyCategory: 'I' | 'II' | 'III' | 'IV',
    buildingHeight: number,
    numOccupants: number
  ): {
    category: 'Exempt' | 'Standard' | 'Enhanced' | 'Hardened';
    analysisRequired: string[];
  } {
    let category: 'Exempt' | 'Standard' | 'Enhanced' | 'Hardened';
    const analysisRequired: string[] = [];

    if (occupancyCategory === 'I' || (buildingHeight < 10 && numOccupants < 100)) {
      category = 'Exempt';
      analysisRequired.push('No specific progressive collapse analysis required');
    } else if (occupancyCategory === 'II') {
      category = 'Standard';
      analysisRequired.push('Tie force method');
      analysisRequired.push('Linear static analysis for column removal');
    } else if (occupancyCategory === 'III') {
      category = 'Enhanced';
      analysisRequired.push('Alternate load path method');
      analysisRequired.push('Linear static with DCR limits');
      if (buildingHeight > 30) {
        analysisRequired.push('Nonlinear static analysis');
      }
    } else {
      category = 'Hardened';
      analysisRequired.push('Nonlinear dynamic analysis');
      analysisRequired.push('Enhanced local resistance');
      analysisRequired.push('Minimum tie force requirements');
      analysisRequired.push('Specific threat analysis');
    }

    return { category, analysisRequired };
  }
}

// ============================================================================
// BLAST-RESISTANT DESIGN
// ============================================================================

export class BlastResistantDesign {
  /**
   * Reinforced concrete wall design for blast
   */
  static rcWallDesign(
    blastLoading: BlastLoading,
    wallProperties: {
      span: number; // m
      height: number; // m
      thickness: number; // mm
      concreteStrength: number; // MPa
      steelStrength: number; // MPa
      rebarRatio: number; // percentage
    },
    protectionLevel: 'low' | 'medium' | 'high'
  ): {
    adequate: boolean;
    ductilityDemand: number;
    supportRotation: number;
    responseCategory: MemberResponse['responseCategory'];
    requiredThickness: number;
    recommendations: string[];
  } {
    const { span, height, thickness, concreteStrength, steelStrength, rebarRatio } = wallProperties;
    
    // Calculate resistance
    const d = thickness * 0.85; // Effective depth (mm)
    const As = (rebarRatio / 100) * 1000 * thickness; // mm²/m
    const Mu = As * steelStrength * (d - As * steelStrength / (1.7 * concreteStrength * 1000)); // N-mm/m
    const Ru = 8 * Mu / (span * span * 1e6); // kN/m² (for fixed-fixed)

    // Wall properties
    const density = 2400; // kg/m³
    const mass = density * thickness / 1000 * height; // kg/m²
    const I = 1000 * Math.pow(thickness, 3) / 12; // mm⁴/m
    const E = 4700 * Math.sqrt(concreteStrength) * 1e6; // kPa
    const stiffness = 384 * E * I * 1e-12 / (5 * Math.pow(span, 4)); // kN/m per m²

    // SDOF parameters
    const sdof = SDOFBlastResponse.equivalentSDOF(
      'wall', 'fixed-fixed', span, height, mass, stiffness
    );

    // Peak load and impulse
    const peakLoad = blastLoading.reflectedPressure * span * height;
    const impulse = blastLoading.reflectedImpulse * span * height;
    const resistance = Ru * span * height;

    // Response
    const response = SDOFBlastResponse.maxResponsePIDiagram(
      peakLoad, impulse, resistance, sdof.ke, sdof.me
    );

    const supportRotation = SDOFBlastResponse.supportRotation(response.maxDeflection, span);
    const responseCategory = SDOFBlastResponse.classifyResponse(
      response.ductilityDemand, supportRotation, 'concrete'
    );

    // Protection level criteria
    const allowableRotation: Record<string, number> = {
      'low': 10,
      'medium': 6,
      'high': 2
    };

    const allowableDuctility: Record<string, number> = {
      'low': 12,
      'medium': 6,
      'high': 3
    };

    const adequate = supportRotation <= allowableRotation[protectionLevel] &&
                    response.ductilityDemand <= allowableDuctility[protectionLevel];

    // Estimate required thickness if inadequate
    let requiredThickness = thickness;
    if (!adequate) {
      // Simplified iteration
      const scaleFactor = Math.max(
        supportRotation / allowableRotation[protectionLevel],
        response.ductilityDemand / allowableDuctility[protectionLevel]
      );
      requiredThickness = thickness * Math.pow(scaleFactor, 0.5);
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (!adequate) {
      recommendations.push(`Increase wall thickness to ${Math.ceil(requiredThickness / 50) * 50} mm`);
      if (rebarRatio < 0.5) {
        recommendations.push('Increase reinforcement ratio to minimum 0.5%');
      }
      recommendations.push('Consider using higher strength concrete (≥40 MPa)');
    }
    if (responseCategory === 'heavy' || responseCategory === 'hazardous') {
      recommendations.push('Add anti-spall reinforcement on protected face');
    }

    return {
      adequate,
      ductilityDemand: response.ductilityDemand,
      supportRotation,
      responseCategory,
      requiredThickness,
      recommendations
    };
  }

  /**
   * Steel beam design for blast
   */
  static steelBeamDesign(
    blastLoading: BlastLoading,
    beamProperties: {
      span: number; // m
      tributaryWidth: number; // m
      section: {
        area: number; // mm²
        Ix: number; // mm⁴
        Zx: number; // mm³
        depth: number; // mm
      };
      steelGrade: number; // MPa yield
    },
    protectionLevel: 'low' | 'medium' | 'high'
  ): {
    adequate: boolean;
    ductilityDemand: number;
    supportRotation: number;
    responseCategory: MemberResponse['responseCategory'];
    recommendations: string[];
  } {
    const { span, tributaryWidth, section, steelGrade } = beamProperties;

    // Dynamic increase factors (UFC 3-340-02)
    const DIF = 1.20; // For bending
    const SIF = 1.10; // Strain-rate increase factor

    const fds = steelGrade * DIF * SIF; // Dynamic design strength

    // Plastic moment capacity
    const Mp = fds * section.Zx / 1e6; // kN-m

    // Resistance (fixed-fixed beam)
    const Ru = 16 * Mp / span; // kN

    // Mass and stiffness
    const steelDensity = 7850; // kg/m³
    const mass = section.area * 1e-6 * span * steelDensity; // kg
    const E = 200000; // MPa
    const stiffness = 384 * E * section.Ix * 1e-12 / (5 * Math.pow(span, 4)); // kN/m

    // SDOF
    const sdof = SDOFBlastResponse.equivalentSDOF(
      'beam', 'fixed-fixed', span, tributaryWidth, mass, stiffness
    );

    // Loading
    const totalLoad = blastLoading.reflectedPressure * tributaryWidth;
    const impulse = blastLoading.reflectedImpulse * tributaryWidth * span;
    const resistance = Ru;

    const response = SDOFBlastResponse.maxResponsePIDiagram(
      totalLoad * span, impulse, resistance, sdof.ke, sdof.me
    );

    const supportRotation = SDOFBlastResponse.supportRotation(response.maxDeflection, span);
    const responseCategory = SDOFBlastResponse.classifyResponse(
      response.ductilityDemand, supportRotation, 'steel'
    );

    // Criteria
    const allowableRotation: Record<string, number> = {
      'low': 12,
      'medium': 6,
      'high': 2
    };

    const adequate = supportRotation <= allowableRotation[protectionLevel];

    const recommendations: string[] = [];
    if (!adequate) {
      recommendations.push('Consider using deeper section or higher grade steel');
      recommendations.push('Verify connection capacity for dynamic reactions');
    }
    recommendations.push('Check local flange buckling under dynamic loads');
    recommendations.push('Ensure web stiffeners at supports for shear');

    return {
      adequate,
      ductilityDemand: response.ductilityDemand,
      supportRotation,
      responseCategory,
      recommendations
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  BlastWaveCalculator,
  SDOFBlastResponse,
  ImpactLoadCalculator,
  ProgressiveCollapseAnalyzer,
  BlastResistantDesign
};
