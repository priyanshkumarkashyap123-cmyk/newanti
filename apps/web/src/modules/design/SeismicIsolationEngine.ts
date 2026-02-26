/**
 * ============================================================================
 * SEISMIC ISOLATION AND ENERGY DISSIPATION ENGINE
 * ============================================================================
 * 
 * Comprehensive seismic protection systems analysis:
 * - Base isolation systems (LRB, FPS, HDRB)
 * - Supplemental damping devices
 * - Tuned mass dampers (TMD)
 * - Viscous fluid dampers
 * - Friction dampers
 * - Buckling-restrained braces (BRB)
 * - Shape memory alloy devices
 * 
 * Design Codes Supported:
 * - ASCE 7-22 Chapter 17 (Seismic Design Requirements for Seismically Isolated Structures)
 * - ASCE 7-22 Chapter 18 (Damping Systems)
 * - EN 15129 (Anti-seismic devices)
 * - EN 1998-1 (Eurocode 8)
 * - AASHTO Guide Specifications for Seismic Isolation Design
 * - FEMA P-751 (NEHRP Provisions)
 * - Japan Building Standard Law
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface IsolationSystem {
  type: 'LRB' | 'FPS' | 'HDRB' | 'SlidingBearing' | 'Hybrid';
  devices: IsolatorDevice[];
  totalWeight: number; // kN (supported weight)
  targetPeriod: number; // seconds (isolated period)
  designDisplacement: number; // mm
  effectiveDamping: number; // % critical
}

export interface IsolatorDevice {
  id: string;
  type: 'LRB' | 'FPS' | 'HDRB' | 'Sliding';
  location: { x: number; y: number; z: number };
  axialLoad: number; // kN (vertical load)
  properties: LRBProperties | FPSProperties | HDRBProperties;
}

export interface LRBProperties {
  type: 'LRB';
  diameter: number; // mm (overall)
  leadCoreDiameter: number; // mm
  rubberLayerThickness: number; // mm (single layer)
  numberOfLayers: number;
  steelShimThickness: number; // mm
  rubberShearModulus: number; // MPa
  leadYieldStress: number; // MPa
  coverThickness: number; // mm
}

export interface FPSProperties {
  type: 'FPS';
  radius: number; // mm (radius of curvature)
  frictionCoefficient: number; // dimensionless
  sliderDiameter: number; // mm
  capacity: number; // kN (vertical)
  displacementCapacity: number; // mm
  numberOfPendulum: 1 | 2 | 3; // Single, Double, Triple FP
  secondaryRadius?: number; // mm (for Double/Triple)
}

export interface HDRBProperties {
  type: 'HDRB';
  diameter: number; // mm
  totalRubberHeight: number; // mm
  shapeFactorS1: number;
  shapeFactorS2: number;
  rubberType: 'low' | 'medium' | 'high'; // damping level
  equivalentDamping: number; // % at design shear
  shearModulusAt100: number; // MPa at 100% shear
  shearModulusAt250: number; // MPa at 250% shear
}

export interface DamperDevice {
  id: string;
  type: 'ViscousFluid' | 'Friction' | 'Viscoelastic' | 'Metallic' | 'SMA';
  location: { x: number; y: number; level: number };
  orientation: number; // degrees from horizontal
  properties: ViscousDamperProps | FrictionDamperProps | BRBProps | SMADamperProps;
}

export interface ViscousDamperProps {
  type: 'ViscousFluid';
  dampingCoefficient: number; // kN/(m/s)^α
  velocityExponent: number; // α (typically 0.15 to 1.0)
  strokeCapacity: number; // mm
  forceCapacity: number; // kN
  diameter: number; // mm (piston)
}

export interface FrictionDamperProps {
  type: 'Friction';
  slipForce: number; // kN
  frictionCoefficient: number;
  normalForce: number; // kN
  slotLength: number; // mm
  dampingType: 'Pall' | 'Sumitomo' | 'EDR';
}

export interface BRBProps {
  type: 'BRB';
  coreArea: number; // mm²
  coreYieldStress: number; // MPa
  yieldForce: number; // kN
  strainHardeningRatio: number;
  cumulativeDuctility: number;
  length: number; // mm
}

export interface SMADamperProps {
  type: 'SMA';
  alloyType: 'NiTi' | 'CuAlMn' | 'FeNiCoAlTaB';
  wireArea: number; // mm² (total)
  transformationStress: number; // MPa
  recoveryStrain: number; // %
  equivalentDamping: number; // %
  operatingTemp: { min: number; max: number }; // °C
}

export interface TMDProperties {
  massRatio: number; // μ = m_d / M (typically 0.01-0.05)
  frequencyRatio: number; // f = ω_d / ω_n (optimal ~1/(1+μ))
  dampingRatio: number; // ξ (optimal depends on μ)
  damperMass: number; // kg
  springStiffness: number; // kN/m
  dampingCoefficient: number; // kN-s/m
}

export interface IsolationDesignResult {
  code: string;
  
  // Period and displacement
  isolatedPeriod: number; // s
  fixedBasePeriod: number; // s
  designDisplacement: number; // mm
  maximumDisplacement: number; // mm
  
  // Force reduction
  reducedBaseShear: number; // kN
  fixedBaseShear: number; // kN
  reductionFactor: number;
  
  // Damping
  effectiveDamping: number; // %
  dampingReductionFactor: number; // B_D
  
  // Device properties
  effectiveStiffness: number; // kN/m
  characteristicStrength: number; // kN
  postYieldStiffness: number; // kN/m
  
  // Stability checks
  overturningRatio: number;
  tensionOccurs: boolean;
  
  status: 'acceptable' | 'unacceptable' | 'review-required';
  recommendations: string[];
}

// ============================================================================
// LEAD RUBBER BEARING (LRB) DESIGN
// ============================================================================

export class LeadRubberBearing {
  /**
   * Calculate LRB hysteretic properties
   */
  static calculateProperties(
    props: LRBProperties,
    axialLoad: number, // kN
    shearStrain: number // % (design shear strain)
  ): {
    Keff: number; // kN/m (effective stiffness)
    Qd: number; // kN (characteristic strength)
    Kd: number; // kN/m (post-yield stiffness)
    Ku: number; // kN/m (initial stiffness)
    effectiveDamping: number; // % critical
    displacement: number; // mm (at design shear)
  } {
    const {
      diameter,
      leadCoreDiameter,
      rubberLayerThickness,
      numberOfLayers,
      rubberShearModulus,
      leadYieldStress
    } = props;

    // Geometric calculations
    const Ar = Math.PI * (diameter * diameter - leadCoreDiameter * leadCoreDiameter) / 4; // mm² rubber area
    const Al = Math.PI * leadCoreDiameter * leadCoreDiameter / 4; // mm² lead area
    const Tr = rubberLayerThickness * numberOfLayers; // mm total rubber height

    // Displacement at design shear
    const displacement = Tr * shearStrain / 100; // mm

    // Rubber shear stiffness
    const Kr = Ar * rubberShearModulus / Tr; // kN/m

    // Lead core contribution
    const Qd = Al * leadYieldStress / 1000; // kN (characteristic strength)
    
    // Post-yield stiffness (rubber dominates)
    const Kd = Kr; // kN/m

    // Initial stiffness (before lead yields)
    // Lead shear modulus ~130 GPa / 12 ≈ 11000 MPa in shear
    const Kl = Al * 11000 / Tr; // kN/m
    const Ku = Kr + Kl; // kN/m

    // Effective stiffness at design displacement
    const Keff = Kd + Qd * 1000 / displacement; // kN/m

    // Energy dissipation per cycle
    const Wd = 4 * Qd * (displacement - Qd * 1000 / Ku) / 1000; // kN-m

    // Effective damping
    const effectiveDamping = Wd / (2 * Math.PI * Keff * displacement * displacement / 1e6) * 100;

    return {
      Keff,
      Qd,
      Kd,
      Ku,
      effectiveDamping,
      displacement
    };
  }

  /**
   * Check LRB stability under combined loading
   */
  static checkStability(
    props: LRBProperties,
    axialLoad: number, // kN
    lateralDisplacement: number // mm
  ): {
    criticalBucklingLoad: number; // kN
    reducedBucklingLoad: number; // kN (at displacement)
    safetyFactor: number;
    rolloutCheck: boolean;
    stableConfiguration: boolean;
  } {
    const { diameter, rubberLayerThickness, numberOfLayers, rubberShearModulus } = props;
    const Tr = rubberLayerThickness * numberOfLayers;
    const Ar = Math.PI * diameter * diameter / 4; // Full area for compression

    // Shape factor
    const S = diameter / (4 * rubberLayerThickness);

    // Compression modulus
    const Ec = rubberShearModulus * (1 + 2 * S * S);

    // Euler buckling load (no displacement)
    const Is = Math.PI * Math.pow(diameter, 4) / 64; // mm⁴
    const PE = Math.PI * Math.PI * Ec * Is / (Tr * Tr) / 1e9; // kN

    // Shear stiffness
    const PS = rubberShearModulus * Ar / 1e3; // kN

    // Critical buckling load (Haringx formula)
    const Pcr0 = Math.sqrt(PE * PS);

    // Reduced area at displacement
    const reducedArea = Ar * (1 - lateralDisplacement / diameter);
    const reductionFactor = reducedArea / Ar;

    // Reduced buckling capacity
    const PcrD = Pcr0 * Math.pow(reductionFactor, 1.5);

    // Rollout check
    const rolloutDisplacement = diameter * 0.7; // Approximate rollout limit
    const rolloutCheck = lateralDisplacement < rolloutDisplacement;

    return {
      criticalBucklingLoad: Pcr0,
      reducedBucklingLoad: PcrD,
      safetyFactor: PcrD / axialLoad,
      rolloutCheck,
      stableConfiguration: PcrD > 3 * axialLoad && rolloutCheck
    };
  }

  /**
   * Design LRB for target performance
   */
  static design(
    targetPeriod: number, // s
    targetDamping: number, // %
    totalWeight: number, // kN
    maxDisplacement: number, // mm
    numberOfDevices: number
  ): LRBProperties {
    const W = totalWeight;
    const M = W / 9.81; // tonnes

    // Target stiffness from period
    const Keff_total = 4 * Math.PI * Math.PI * M * 1000 / (targetPeriod * targetPeriod); // kN/m
    const Keff_single = Keff_total / numberOfDevices;

    // Estimate Qd from damping (iterative)
    // β = 2 * Qd * (D - Dy) / (π * Keff * D²)
    const D = maxDisplacement;
    const Dy = D * 0.05; // Assume yield displacement ~5% of max
    const Qd = targetDamping / 100 * Math.PI * Keff_single * D * D / (2 * (D - Dy)) / 1000; // kN

    // Post-yield stiffness
    const Kd = Keff_single - Qd * 1000 / D; // kN/m

    // Size lead core
    const leadYieldStress = 10; // MPa typical
    const Al = Qd * 1000 / leadYieldStress; // mm²
    const leadCoreDiameter = Math.sqrt(4 * Al / Math.PI);

    // Size rubber
    const rubberShearModulus = 0.4; // MPa (typical low-damping)
    const shearStrain = 1.5; // Design shear strain 150%
    const Tr = D / shearStrain;
    
    // Required rubber area
    const Ar_needed = Kd * Tr / rubberShearModulus; // mm²
    const totalArea = Ar_needed + Al;
    const diameter = Math.sqrt(4 * totalArea / Math.PI);

    // Layer configuration
    const rubberLayerThickness = 10; // mm typical
    const numberOfLayers = Math.ceil(Tr / rubberLayerThickness);

    return {
      type: 'LRB',
      diameter: Math.ceil(diameter / 50) * 50, // Round to 50mm
      leadCoreDiameter: Math.ceil(leadCoreDiameter / 10) * 10,
      rubberLayerThickness,
      numberOfLayers,
      steelShimThickness: 3, // mm typical
      rubberShearModulus,
      leadYieldStress,
      coverThickness: 10
    };
  }
}

// ============================================================================
// FRICTION PENDULUM SYSTEM (FPS)
// ============================================================================

export class FrictionPendulumSystem {
  /**
   * Calculate FPS effective properties
   */
  static calculateProperties(
    props: FPSProperties,
    axialLoad: number, // kN
    displacement: number // mm
  ): {
    Keff: number; // kN/m
    isolatedPeriod: number; // s
    effectiveDamping: number; // %
    restoringForce: number; // kN
    frictionForce: number; // kN
  } {
    const { radius, frictionCoefficient, numberOfPendulum } = props;
    const R = radius / 1000; // m
    const μ = frictionCoefficient;
    const W = axialLoad;
    const D = displacement / 1000; // m

    let Reff: number;
    if (numberOfPendulum === 1) {
      Reff = R;
    } else if (numberOfPendulum === 2) {
      Reff = 2 * R; // Double pendulum
    } else {
      Reff = 4 * R; // Triple pendulum (approximate)
    }

    // Restoring stiffness
    const Kr = W / Reff; // kN/m

    // Friction force
    const Ff = μ * W; // kN

    // Effective stiffness
    const Keff = Kr + Ff / D * 1000; // kN/m (when D in m, convert to mm)

    // Isolated period
    const T = 2 * Math.PI * Math.sqrt(Reff / 9.81);

    // Effective damping
    const β = 2 * μ / (Math.PI * (D / Reff + μ)) * 100;

    return {
      Keff,
      isolatedPeriod: T,
      effectiveDamping: Math.min(β, 30), // Cap at 30%
      restoringForce: W * D / Reff,
      frictionForce: Ff
    };
  }

  /**
   * Triple Friction Pendulum analysis
   */
  static tripleFPAnalysis(
    radii: [number, number, number, number], // [R1, R2, R3, R4] mm
    frictions: [number, number, number, number], // [μ1, μ2, μ3, μ4]
    axialLoad: number,
    displacement: number
  ): {
    regime: number; // 1-5 behavior regime
    effectiveRadius: number; // mm
    effectiveFriction: number;
    restoringForce: number; // kN
  } {
    const [R1, R2, R3, R4] = radii.map(r => r / 1000); // m
    const [μ1, μ2, μ3, μ4] = frictions;
    const W = axialLoad;
    const D = displacement / 1000; // m

    // Determine regime based on displacement
    // Regime 1: Small D, sliding on inner surfaces only
    // Regime 2-4: Intermediate
    // Regime 5: Large D, sliding on all surfaces

    let regime: number;
    let Reff: number;
    let μeff: number;

    // Transition displacements (simplified)
    const D1 = (μ2 - μ1) * R1;
    const D2 = (μ2 - μ1) * R2;
    const D5 = R3 + R4; // Maximum before rigid slider limit

    if (D < D1) {
      regime = 1;
      Reff = R1 * 1000;
      μeff = μ1;
    } else if (D < D2) {
      regime = 2;
      Reff = (R1 + R2) * 1000;
      μeff = (μ1 + μ2) / 2;
    } else if (D < D5 * 0.5) {
      regime = 3;
      Reff = (R1 + R2 + R3) * 1000;
      μeff = (μ1 + μ2 + μ3) / 3;
    } else {
      regime = 5;
      Reff = (R1 + R2 + R3 + R4) * 1000;
      μeff = (μ1 + μ2 + μ3 + μ4) / 4;
    }

    return {
      regime,
      effectiveRadius: Reff,
      effectiveFriction: μeff,
      restoringForce: W * D / (Reff / 1000)
    };
  }

  /**
   * Design FPS for target performance
   */
  static design(
    targetPeriod: number, // s
    targetFriction: number, // coefficient
    maxDisplacement: number, // mm
    axialLoad: number // kN per device
  ): FPSProperties {
    // Required radius from period
    // T = 2π√(R/g)
    const R = 9.81 * targetPeriod * targetPeriod / (4 * Math.PI * Math.PI); // m

    // For double/triple pendulum, adjust radius
    const numberOfPendulum = targetPeriod > 4 ? 3 : targetPeriod > 2 ? 2 : 1;
    const effectiveR = R / numberOfPendulum;

    return {
      type: 'FPS',
      radius: Math.ceil(effectiveR * 1000 / 100) * 100, // Round to 100mm
      frictionCoefficient: targetFriction,
      sliderDiameter: Math.max(300, Math.ceil(Math.sqrt(axialLoad / 50) * 100)), // Based on bearing pressure
      capacity: axialLoad * 1.5,
      displacementCapacity: Math.ceil(maxDisplacement * 1.25 / 50) * 50,
      numberOfPendulum
    };
  }
}

// ============================================================================
// HIGH DAMPING RUBBER BEARING (HDRB)
// ============================================================================

export class HighDampingRubberBearing {
  /**
   * Calculate strain-dependent properties
   */
  static calculateProperties(
    props: HDRBProperties,
    shearStrain: number // %
  ): {
    effectiveShearModulus: number; // MPa
    effectiveDamping: number; // %
    Keff: number; // kN/m
  } {
    const { diameter, totalRubberHeight, shearModulusAt100, shearModulusAt250 } = props;
    
    // Interpolate shear modulus (nonlinear behavior)
    let G: number;
    if (shearStrain <= 100) {
      // Higher stiffness at low strains
      G = shearModulusAt100 * (1 + 0.5 * (1 - shearStrain / 100));
    } else if (shearStrain <= 250) {
      // Interpolate
      G = shearModulusAt100 - (shearModulusAt100 - shearModulusAt250) * 
          (shearStrain - 100) / 150;
    } else {
      // Strain softening
      G = shearModulusAt250 * 0.8;
    }

    // Effective damping varies with strain
    const baseDamping = props.equivalentDamping;
    let damping: number;
    if (shearStrain <= 50) {
      damping = baseDamping * 0.7;
    } else if (shearStrain <= 150) {
      damping = baseDamping;
    } else {
      damping = baseDamping * 1.1;
    }

    // Stiffness
    const Ar = Math.PI * diameter * diameter / 4;
    const Keff = G * Ar / totalRubberHeight;

    return {
      effectiveShearModulus: G,
      effectiveDamping: Math.min(damping, 25),
      Keff
    };
  }

  /**
   * Check shape factors for stability
   */
  static checkShapeFactors(
    props: HDRBProperties
  ): {
    S1: number;
    S2: number;
    bucklingOK: boolean;
    shearStrainLimit: number;
  } {
    const { diameter, totalRubberHeight, shapeFactorS1, shapeFactorS2 } = props;

    // S1: Primary shape factor (loaded area / force-free area)
    // S2: Secondary shape factor (diameter / total rubber height)
    const S2_calc = diameter / totalRubberHeight;

    // Requirements
    const S1_min = 10; // Minimum for adequate vertical stiffness
    const S2_min = 3; // Minimum for buckling stability

    const bucklingOK = shapeFactorS1 >= S1_min && S2_calc >= S2_min;

    // Maximum allowable shear strain
    const shearStrainLimit = S2_calc > 5 ? 250 : S2_calc > 4 ? 200 : 150;

    return {
      S1: shapeFactorS1,
      S2: S2_calc,
      bucklingOK,
      shearStrainLimit
    };
  }
}

// ============================================================================
// VISCOUS FLUID DAMPERS
// ============================================================================

export class ViscousFluidDamper {
  /**
   * Calculate damper force
   * F = C * V^α
   */
  static force(
    C: number, // Damping coefficient
    velocity: number, // m/s
    alpha: number // Velocity exponent
  ): number {
    return C * Math.pow(Math.abs(velocity), alpha) * Math.sign(velocity);
  }

  /**
   * Energy dissipated per cycle
   */
  static energyPerCycle(
    C: number,
    alpha: number,
    amplitude: number, // mm
    frequency: number // Hz
  ): number {
    const omega = 2 * Math.PI * frequency;
    const V0 = omega * amplitude / 1000; // m/s peak velocity

    // Lambda factor (depends on alpha)
    const lambda = Math.pow(2, 2 - alpha) * Math.pow(Math.PI, 1 - alpha) *
                   this.gammaFunction(1 + alpha / 2) / this.gammaFunction(1 + alpha);

    return lambda * C * Math.pow(V0, 1 + alpha) * amplitude / 1000;
  }

  private static gammaFunction(n: number): number {
    // Lanczos approximation for gamma function
    if (n < 0.5) {
      return Math.PI / (Math.sin(Math.PI * n) * this.gammaFunction(1 - n));
    }
    n -= 1;
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
               771.32342877765313, -176.61502916214059, 12.507343278686905,
               -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    let x = c[0];
    for (let i = 1; i < g + 2; i++) {
      x += c[i] / (n + i);
    }
    const t = n + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, n + 0.5) * Math.exp(-t) * x;
  }

  /**
   * Equivalent viscous damping ratio
   */
  static equivalentDampingRatio(
    C: number,
    alpha: number,
    structuralStiffness: number, // kN/m
    structuralMass: number, // tonnes
    amplitude: number, // mm
    omega: number // rad/s (structural frequency)
  ): number {
    const V0 = omega * amplitude / 1000;
    const M = structuralMass * 1000; // kg
    const K = structuralStiffness * 1000; // N/m

    // Lambda factor
    const lambda = Math.pow(2, 2 - alpha) * Math.pow(Math.PI, 1 - alpha) *
                   this.gammaFunction(1 + alpha / 2) / this.gammaFunction(1 + alpha);

    // Equivalent viscous damping
    const beta_eq = lambda * C * Math.pow(V0, alpha - 1) / (2 * M * omega);

    return beta_eq * 100; // percent
  }

  /**
   * Design damper for target supplemental damping
   */
  static design(
    targetDamping: number, // % additional damping
    structuralFrequency: number, // Hz
    structuralMass: number, // tonnes
    expectedDisplacement: number, // mm
    numberOfDampers: number,
    alpha: number = 0.3
  ): ViscousDamperProps {
    const omega = 2 * Math.PI * structuralFrequency;
    const M = structuralMass * 1000; // kg
    const D = expectedDisplacement / 1000; // m
    const V0 = omega * D;

    // Lambda factor
    const lambda = Math.pow(2, 2 - alpha) * Math.pow(Math.PI, 1 - alpha) *
                   this.gammaFunction(1 + alpha / 2) / this.gammaFunction(1 + alpha);

    // Required total C
    const beta = targetDamping / 100;
    const C_total = beta * 2 * M * omega / (lambda * Math.pow(V0, alpha - 1));
    const C_single = C_total / numberOfDampers;

    // Force capacity
    const F_max = C_single * Math.pow(V0, alpha);

    return {
      type: 'ViscousFluid',
      dampingCoefficient: C_single / 1000, // Convert to kN/(m/s)^α
      velocityExponent: alpha,
      strokeCapacity: Math.ceil(expectedDisplacement * 1.5 / 50) * 50,
      forceCapacity: Math.ceil(F_max / 100) * 100 / 1000, // kN
      diameter: Math.max(150, Math.ceil(Math.sqrt(F_max / 30)))
    };
  }
}

// ============================================================================
// TUNED MASS DAMPER (TMD)
// ============================================================================

export class TunedMassDamper {
  /**
   * Optimal TMD parameters (Den Hartog formulas)
   */
  static optimalParameters(
    structuralMass: number, // tonnes
    structuralFrequency: number, // Hz
    massRatio: number // μ (typically 0.01-0.05)
  ): TMDProperties {
    const M = structuralMass * 1000; // kg
    const fn = structuralFrequency;
    const μ = massRatio;

    // Optimal frequency ratio (Den Hartog)
    const f_opt = 1 / (1 + μ);

    // Optimal damping ratio
    const zeta_opt = Math.sqrt(3 * μ / (8 * (1 + μ)));

    // TMD mass
    const md = μ * M;

    // TMD frequency
    const fd = f_opt * fn;
    const omega_d = 2 * Math.PI * fd;

    // Spring stiffness
    const kd = md * omega_d * omega_d;

    // Damping coefficient
    const cd = 2 * zeta_opt * md * omega_d;

    return {
      massRatio: μ,
      frequencyRatio: f_opt,
      dampingRatio: zeta_opt,
      damperMass: md,
      springStiffness: kd / 1000, // kN/m
      dampingCoefficient: cd / 1000 // kN-s/m
    };
  }

  /**
   * Calculate response reduction
   */
  static responseReduction(
    structuralDamping: number, // % critical
    massRatio: number,
    excitationRatio: number // ω/ωn
  ): {
    withoutTMD: number;
    withTMD: number;
    reductionFactor: number;
  } {
    const zeta_s = structuralDamping / 100;
    const μ = massRatio;
    const r = excitationRatio;

    // Optimal TMD parameters
    const f = 1 / (1 + μ);
    const zeta_d = Math.sqrt(3 * μ / (8 * (1 + μ)));

    // Without TMD (SDOF)
    const H1 = 1 / Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(2 * zeta_s * r, 2));

    // With TMD (2-DOF) - simplified at resonance
    const H2 = Math.sqrt(1 + Math.pow(2 * zeta_d * f, 2)) /
               Math.sqrt(μ * (1 + 4 * zeta_d * zeta_d));

    return {
      withoutTMD: H1,
      withTMD: H2,
      reductionFactor: H2 / H1
    };
  }

  /**
   * Pendulum TMD design (for tall buildings)
   */
  static pendulumTMD(
    targetFrequency: number, // Hz
    damperMass: number, // tonnes
    dampingRatio: number
  ): {
    pendulumLength: number; // m
    viscousDamping: number; // kN-s/m
    horizontalClearance: number; // m (for 1m amplitude)
  } {
    const f = targetFrequency;
    const m = damperMass * 1000; // kg

    // Pendulum length from frequency
    // f = 1/(2π) * √(g/L)
    const L = 9.81 / Math.pow(2 * Math.PI * f, 2);

    // Viscous damping coefficient
    const omega = 2 * Math.PI * f;
    const c = 2 * dampingRatio * m * omega;

    // Horizontal clearance for 1m amplitude swing
    const amplitude = 1.0; // m
    const clearance = amplitude * 1.2;

    return {
      pendulumLength: L,
      viscousDamping: c / 1000,
      horizontalClearance: clearance
    };
  }
}

// ============================================================================
// BUCKLING-RESTRAINED BRACES (BRB)
// ============================================================================

export class BucklingRestrainedBrace {
  /**
   * Calculate BRB properties
   */
  static calculateProperties(
    props: BRBProps
  ): {
    yieldForce: number; // kN
    adjustedCompression: number; // kN (with ω factor)
    adjustedTension: number; // kN (with ω factor)
    yieldDisplacement: number; // mm
    ultimateDisplacement: number; // mm
    effectiveStiffness: number; // kN/m
  } {
    const { coreArea, coreYieldStress, length, strainHardeningRatio } = props;

    const Asc = coreArea; // mm²
    const Fysc = coreYieldStress; // MPa
    const E = 200000; // MPa
    const Lw = length * 0.7; // Yield length (approximate)

    // Yield force
    const Pysc = Asc * Fysc / 1000; // kN

    // Compression adjustment factors (β * ω)
    // β accounts for compression overstrength (≈1.1)
    // ω accounts for strain hardening (≈1.25 at 2% strain)
    const beta = 1.1;
    const omega = 1 + strainHardeningRatio * 2; // At 2% core strain

    const adjustedCompression = beta * omega * Pysc;
    const adjustedTension = omega * Pysc;

    // Yield displacement
    const yieldDisplacement = Fysc * Lw / E; // mm

    // Ultimate displacement (at 2% core strain)
    const ultimateDisplacement = 0.02 * Lw;

    // Elastic stiffness
    const effectiveStiffness = Asc * E / (Lw * 1000); // kN/m

    return {
      yieldForce: Pysc,
      adjustedCompression,
      adjustedTension,
      yieldDisplacement,
      ultimateDisplacement,
      effectiveStiffness
    };
  }

  /**
   * Energy dissipation capacity
   */
  static cumulativeEnergy(
    props: BRBProps,
    cycleHistory: { amplitude: number; count: number }[] // amplitude as multiple of yield
  ): {
    energyDissipated: number; // kN-m
    remainingCapacity: number; // % of cumulative ductility
  } {
    const { coreArea, coreYieldStress, length, cumulativeDuctility } = props;
    
    const Pysc = coreArea * coreYieldStress / 1000; // kN
    const E = 200000;
    const Lw = length * 0.7;
    const deltaY = coreYieldStress * Lw / E; // mm

    // Calculate cumulative plastic deformation
    let totalPlastic = 0;
    let totalEnergy = 0;

    for (const cycle of cycleHistory) {
      const delta = cycle.amplitude * deltaY;
      const plasticPerCycle = 4 * (delta - deltaY);
      totalPlastic += plasticPerCycle * cycle.count;
      
      // Energy per cycle (parallelogram approximation)
      const energyPerCycle = 4 * Pysc * (delta - deltaY) / 1000;
      totalEnergy += energyPerCycle * cycle.count;
    }

    // Cumulative ductility demand
    const muCum = totalPlastic / deltaY;
    const remainingCapacity = Math.max(0, (cumulativeDuctility - muCum) / cumulativeDuctility * 100);

    return {
      energyDissipated: totalEnergy,
      remainingCapacity
    };
  }

  /**
   * Design BRB for target ductility demand
   */
  static design(
    targetForce: number, // kN (brace force at design drift)
    braceLength: number, // mm
    targetDuctility: number // design ductility demand
  ): BRBProps {
    // Core yield stress (typical steel)
    const Fysc = 240; // MPa (low-yield steel for high ductility)
    
    // Adjustment for overstrength
    const omega = 1.4;
    const Pysc = targetForce / omega;

    // Core area
    const Asc = Pysc * 1000 / Fysc;

    return {
      type: 'BRB',
      coreArea: Math.ceil(Asc / 100) * 100,
      coreYieldStress: Fysc,
      yieldForce: Pysc,
      strainHardeningRatio: 0.03,
      cumulativeDuctility: 200, // Typical capacity
      length: braceLength
    };
  }
}

// ============================================================================
// ISOLATION SYSTEM DESIGN PER ASCE 7
// ============================================================================

export class IsolationSystemDesign {
  /**
   * Complete isolation system design per ASCE 7-22 Chapter 17
   */
  static design(
    system: IsolationSystem,
    siteParams: {
      S1: number; // 1-second spectral acceleration
      SMS: number; // Maximum Considered Earthquake spectral acceleration (short)
      SM1: number; // MCE at 1-second
    },
    structureParams: {
      fixedBasePeriod: number; // s
      fixedBaseDamping: number; // %
      importanceFactor: number;
    }
  ): IsolationDesignResult {
    const { totalWeight, targetPeriod, effectiveDamping } = system;
    const { S1, SM1 } = siteParams;
    const { fixedBasePeriod, importanceFactor } = structureParams;

    const W = totalWeight;
    const TD = targetPeriod;
    const betaD = effectiveDamping;

    // Damping reduction factor BD
    const BD = this.dampingFactor(betaD);

    // Design displacement (DBE)
    const g = 9810; // mm/s²
    const SD1 = 2/3 * SM1; // Design level
    const DD = g * SD1 * TD / (4 * Math.PI * Math.PI * BD);

    // Maximum displacement (MCE)
    const TM = TD * 1.5; // MCE period elongation estimate
    const BM = this.dampingFactor(betaD);
    const DM = g * SM1 * TM / (4 * Math.PI * Math.PI * BM);

    // Total displacement including torsion
    const DTD = DD * 1.1; // 10% torsion amplification (simplified)
    const DTM = DM * 1.1;

    // Minimum lateral force
    const Vb_DBE = W * SD1 / (TD * BD);
    const Vb_MCE = W * SM1 / (TM * BM);

    // Fixed base shear for comparison
    const Vb_fixed = W * SD1 / fixedBasePeriod;

    // Effective stiffness
    const Keff = 4 * Math.PI * Math.PI * (W / 9.81) * 1000 / (TD * TD);

    // Check stability
    const overturningHeight = 10; // m (assumed)
    const overturningRatio = Vb_DBE * overturningHeight / (W * DD / 1000);

    // Check for tension
    const eccentricity = 0.05 * 50; // 5% of 50m assumed dimension
    const maxAxialVariation = Vb_DBE * overturningHeight / (50 * 50); // simplified
    const tensionOccurs = maxAxialVariation > W / 100;

    const recommendations: string[] = [];
    if (betaD < 15) {
      recommendations.push('Consider higher damping isolators to reduce displacement');
    }
    if (DD > 400) {
      recommendations.push('Large displacement - verify isolator capacity');
    }
    if (TD / fixedBasePeriod < 3) {
      recommendations.push('Period ratio < 3 - may need longer isolated period');
    }
    if (tensionOccurs) {
      recommendations.push('Tension predicted - verify isolator uplift capacity');
    }

    let status: IsolationDesignResult['status'] = 'acceptable';
    if (DM > system.designDisplacement || overturningRatio > 0.8) {
      status = 'unacceptable';
    } else if (DD > 350 || betaD > 30) {
      status = 'review-required';
    }

    return {
      code: 'ASCE 7-22 Chapter 17',
      isolatedPeriod: TD,
      fixedBasePeriod,
      designDisplacement: DD,
      maximumDisplacement: DM,
      reducedBaseShear: Vb_DBE,
      fixedBaseShear: Vb_fixed,
      reductionFactor: Vb_fixed / Vb_DBE,
      effectiveDamping: betaD,
      dampingReductionFactor: BD,
      effectiveStiffness: Keff,
      characteristicStrength: Keff * DD / 1000 * 0.1, // Approximate Qd
      postYieldStiffness: Keff * 0.1,
      overturningRatio,
      tensionOccurs,
      status,
      recommendations
    };
  }

  /**
   * Damping reduction factor per ASCE 7
   */
  static dampingFactor(betaEff: number): number {
    // Table 17.5-1
    if (betaEff <= 2) return 0.8;
    if (betaEff <= 5) return 0.8 + (1.0 - 0.8) * (betaEff - 2) / 3;
    if (betaEff <= 10) return 1.0 + (1.2 - 1.0) * (betaEff - 5) / 5;
    if (betaEff <= 20) return 1.2 + (1.5 - 1.2) * (betaEff - 10) / 10;
    if (betaEff <= 30) return 1.5 + (1.7 - 1.5) * (betaEff - 20) / 10;
    if (betaEff <= 40) return 1.7 + (1.9 - 1.7) * (betaEff - 30) / 10;
    return 1.9 + (2.0 - 1.9) * (betaEff - 40) / 10;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  LeadRubberBearing,
  FrictionPendulumSystem,
  HighDampingRubberBearing,
  ViscousFluidDamper,
  TunedMassDamper,
  BucklingRestrainedBrace,
  IsolationSystemDesign
};
