/**
 * ============================================================================
 * NUCLEAR AND POWER PLANT STRUCTURES ENGINE
 * ============================================================================
 * 
 * Specialized structural analysis for nuclear and power plant facilities:
 * - Containment structure design
 * - Seismic Category I structures
 * - Radiation shielding calculations
 * - Thermal gradient analysis
 * - Aircraft impact assessment
 * - Beyond design basis events
 * 
 * Design Codes Supported:
 * - ACI 349 (Nuclear Safety-Related Concrete Structures)
 * - ASME BPVC Section III Division 2 (Concrete Containments)
 * - ASCE 4 (Seismic Analysis for Nuclear Structures)
 * - ASCE 43 (Seismic Design Criteria for SSCs)
 * - NEI 07-13 (Aircraft Impact Assessment)
 * - NRC Regulatory Guides
 * - IAEA Safety Standards
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface NuclearStructure {
  type: 'containment' | 'auxiliary' | 'control' | 'turbine' | 'cooling-tower' | 'spent-fuel';
  seismicCategory: 'I' | 'II' | 'III' | 'non-seismic';
  safetyClass: 'safety-related' | 'non-safety' | 'risk-significant';
  geometry: ContainmentGeometry | RectangularGeometry | CoolingTowerGeometry;
  materials: NuclearMaterial[];
  loads: NuclearLoadCombinations;
}

export interface ContainmentGeometry {
  type: 'cylindrical' | 'spherical' | 'hybrid';
  innerRadius: number; // m
  wallThickness: number; // m
  height: number; // m
  domeRadius?: number; // m
  baseMatThickness: number; // m
  linerThickness: number; // mm (steel liner)
  prestressed: boolean;
  tendons?: {
    horizontal: { count: number; area: number; spacing: number };
    vertical: { count: number; area: number; spacing: number };
    dome: { count: number; area: number };
  };
}

export interface RectangularGeometry {
  type: 'rectangular';
  length: number; // m
  width: number; // m
  height: number; // m
  wallThicknesses: {
    exterior: number; // m
    interior: number; // m
  };
  baseMatThickness: number; // m
}

export interface CoolingTowerGeometry {
  type: 'natural-draft' | 'mechanical-draft';
  baseRadius: number; // m
  throatRadius: number; // m
  topRadius: number; // m
  height: number; // m
  shellThickness: number; // mm (varies with height)
}

export interface NuclearMaterial {
  component: 'containment-wall' | 'basemat' | 'dome' | 'liner' | 'tendons' | 'rebar';
  concrete?: {
    fc: number; // Compressive strength (MPa)
    type: 'normal' | 'high-density' | 'lightweight';
    density: number; // kg/m³
    thermalExpansion: number; // per °C
    creepCoefficient: number;
    shrinkageStrain: number;
  };
  steel?: {
    type: 'rebar' | 'prestressing' | 'liner' | 'structural';
    fy: number; // Yield strength (MPa)
    fu: number; // Ultimate strength (MPa)
    fpu?: number; // Prestressing ultimate (MPa)
  };
}

export interface NuclearLoadCombinations {
  normalOperation: {
    dead: number; // factor
    live: number;
    temperature: number;
    prestress: number;
  };
  extremeEnvironmental: {
    SSE: number; // Safe Shutdown Earthquake
    tornado: number;
    flood: number;
  };
  abnormal: {
    LOCA: number; // Loss of Coolant Accident
    SRV: number; // Safety Relief Valve discharge
    turbineMissile: number;
  };
}

export interface ShieldingResult {
  attenuationFactor: number;
  doseRate: number; // mSv/hr
  requiredThickness: number; // cm
  buildup: number;
  materialContribution: {
    material: string;
    percentage: number;
  }[];
}

export interface ContainmentDesignResult {
  code: string;
  category: string;
  
  // Capacity checks
  hoop: {
    demand: number;
    capacity: number;
    dcr: number;
  };
  meridional: {
    demand: number;
    capacity: number;
    dcr: number;
  };
  shear: {
    demand: number;
    capacity: number;
    dcr: number;
  };
  
  // Pressure capacity
  designPressure: number; // kPa
  ultimatePressure: number; // kPa
  testPressure: number; // kPa
  
  // Leak tightness
  linerStrain: number;
  linerStrainLimit: number;
  
  // Seismic performance
  seismicDCR: number;
  slidingFOS: number;
  overturningFOS: number;
  
  status: 'acceptable' | 'unacceptable' | 'review-required';
  recommendations: string[];
}

// ============================================================================
// CONTAINMENT PRESSURE CAPACITY
// ============================================================================

export class ContainmentPressure {
  /**
   * Calculate hoop stress in cylindrical containment
   */
  static hoopStress(
    pressure: number, // kPa (internal)
    radius: number, // m (inner)
    thickness: number // m
  ): number {
    // σ_θ = p * r / t (thin shell approximation)
    return (pressure * radius) / thickness; // kPa
  }

  /**
   * Calculate meridional (axial) stress
   */
  static meridionalStress(
    pressure: number,
    radius: number,
    thickness: number
  ): number {
    // σ_m = p * r / (2 * t) for cylinder
    return (pressure * radius) / (2 * thickness);
  }

  /**
   * Calculate design internal pressure per ASME BPVC Section III Div 2
   */
  static designPressureCapacity(
    geometry: ContainmentGeometry,
    materials: NuclearMaterial[]
  ): {
    serviceLevel: { A: number; B: number; C: number; D: number };
    factored: number;
    ultimate: number;
  } {
    const { innerRadius, wallThickness, prestressed } = geometry;
    const r = innerRadius;
    const t = wallThickness;

    // Find concrete and steel materials
    const concreteMatl = materials.find(m => m.component === 'containment-wall' && m.concrete);
    const rebarMatl = materials.find(m => m.component === 'rebar' && m.steel);
    const tendonMatl = materials.find(m => m.component === 'tendons' && m.steel);

    const fc = concreteMatl?.concrete?.fc || 35; // MPa
    const fy = rebarMatl?.steel?.fy || 420; // MPa
    const fpu = tendonMatl?.steel?.fpu || 1860; // MPa

    // Assume reinforcement ratio
    const rhoRebar = 0.01; // 1% mild steel
    const rhoPrestress = prestressed ? 0.003 : 0; // 0.3% prestressing

    // Pressure capacity (simplified)
    // P = (f * A_s + fpu * A_ps) / r
    const steelContribution = fy * rhoRebar * t * 1000; // kN/m
    const prestressContribution = fpu * 0.7 * rhoPrestress * t * 1000; // kN/m (70% effective)

    const ultimatePressure = (steelContribution + prestressContribution) / r; // kPa

    // Service levels per ASME
    return {
      serviceLevel: {
        A: ultimatePressure / 3.0, // Normal
        B: ultimatePressure / 2.5, // Upset
        C: ultimatePressure / 2.0, // Emergency  
        D: ultimatePressure / 1.5  // Faulted
      },
      factored: ultimatePressure / 1.5,
      ultimate: ultimatePressure
    };
  }

  /**
   * Calculate LOCA pressure-temperature response
   */
  static locaPressureTime(
    containmentVolume: number, // m³
    energyRelease: number, // MJ
    timePoints: number[]
  ): { time: number[]; pressure: number[]; temperature: number[] } {
    // Simplified thermodynamic model
    const airMass = containmentVolume * 1.2; // kg (at atmospheric)
    const cv = 718; // J/(kg·K) for air
    const R = 287; // J/(kg·K)

    const T0 = 300; // K initial
    const P0 = 101.3; // kPa initial

    const pressure: number[] = [];
    const temperature: number[] = [];

    // Energy decay model
    for (const t of timePoints) {
      // Energy release decays exponentially
      const energyAtTime = energyRelease * (1 - Math.exp(-t / 10)) * Math.exp(-t / 100) * 1e6; // J
      
      // Temperature rise
      const deltaT = energyAtTime / (airMass * cv);
      const T = T0 + deltaT * 0.3; // Heat transfer reduces effective rise
      
      // Pressure from ideal gas law
      const P = P0 * (T / T0);
      
      pressure.push(P);
      temperature.push(T - 273); // °C
    }

    return { time: timePoints, pressure, temperature };
  }
}

// ============================================================================
// RADIATION SHIELDING
// ============================================================================

export class RadiationShielding {
  /**
   * Gamma radiation attenuation coefficients (cm⁻¹)
   */
  private static attenuationCoefficients: Record<string, Record<string, number>> = {
    // Energy levels in MeV
    'concrete': { '0.5': 0.204, '1.0': 0.149, '2.0': 0.106, '5.0': 0.067 },
    'steel': { '0.5': 0.655, '1.0': 0.469, '2.0': 0.333, '5.0': 0.242 },
    'lead': { '0.5': 1.64, '1.0': 0.771, '2.0': 0.518, '5.0': 0.485 },
    'water': { '0.5': 0.097, '1.0': 0.071, '2.0': 0.049, '5.0': 0.030 },
    'barite-concrete': { '0.5': 0.306, '1.0': 0.224, '2.0': 0.159, '5.0': 0.100 }
  };

  /**
   * Buildup factors for common materials
   */
  private static buildupFactors: Record<string, Record<string, number>> = {
    'concrete': { '1': 2.0, '2': 4.5, '5': 15, '10': 45 },
    'steel': { '1': 1.5, '2': 2.5, '5': 6, '10': 15 },
    'lead': { '1': 1.3, '2': 1.8, '5': 3.5, '10': 8 },
    'water': { '1': 2.5, '2': 6, '5': 25, '10': 80 }
  };

  /**
   * Calculate shielding thickness required
   */
  static calculateShielding(
    sourceStrength: number, // Bq (or Ci * 3.7e10)
    gammaEnergy: number, // MeV
    distance: number, // m (source to shield surface)
    targetDoseRate: number, // mSv/hr
    material: 'concrete' | 'steel' | 'lead' | 'water' | 'barite-concrete'
  ): ShieldingResult {
    // Gamma constant for typical fission products
    const gammaConstant = 0.5e-12; // Sv·m²/(hr·Bq) approximate

    // Unshielded dose rate at distance
    const unshieldedDose = gammaConstant * sourceStrength / (distance * distance) * 1000; // mSv/hr

    // Required attenuation factor
    const requiredAttenuation = targetDoseRate / unshieldedDose;

    // Get attenuation coefficient
    const energyKey = gammaEnergy <= 0.5 ? '0.5' :
                      gammaEnergy <= 1.0 ? '1.0' :
                      gammaEnergy <= 2.0 ? '2.0' : '5.0';
    const mu = this.attenuationCoefficients[material][energyKey];

    // Calculate thickness (considering buildup)
    // I = I0 * B * exp(-μx)
    // Iterative solution for thickness
    let thickness = Math.log(1 / requiredAttenuation) / mu; // First estimate (no buildup)
    
    for (let iter = 0; iter < 10; iter++) {
      const mfp = thickness * mu; // Mean free paths
      const B = this.getBuildup(material, mfp);
      const newThickness = Math.log(B / requiredAttenuation) / mu;
      if (Math.abs(newThickness - thickness) < 0.1) break;
      thickness = newThickness;
    }

    thickness = Math.max(0, thickness);

    // Final attenuation and dose
    const B = this.getBuildup(material, thickness * mu);
    const attenuation = B * Math.exp(-mu * thickness);
    const finalDose = unshieldedDose * attenuation;

    return {
      attenuationFactor: attenuation,
      doseRate: finalDose,
      requiredThickness: thickness,
      buildup: B,
      materialContribution: [
        { material, percentage: 100 }
      ]
    };
  }

  private static getBuildup(material: string, mfp: number): number {
    const factors = this.buildupFactors[material] || this.buildupFactors['concrete'];
    
    if (mfp <= 1) return factors['1'];
    if (mfp <= 2) return factors['1'] + (factors['2'] - factors['1']) * (mfp - 1);
    if (mfp <= 5) return factors['2'] + (factors['5'] - factors['2']) * (mfp - 2) / 3;
    if (mfp <= 10) return factors['5'] + (factors['10'] - factors['5']) * (mfp - 5) / 5;
    return factors['10'] * Math.pow(mfp / 10, 1.5);
  }

  /**
   * Composite shield calculation
   */
  static compositeShield(
    layers: { material: string; thickness: number }[],
    gammaEnergy: number,
    sourceStrength: number,
    distance: number
  ): ShieldingResult {
    const gammaConstant = 0.5e-12;
    const unshieldedDose = gammaConstant * sourceStrength / (distance * distance) * 1000;

    let totalAttenuation = 1.0;
    const contributions: { material: string; percentage: number }[] = [];

    for (const layer of layers) {
      const energyKey = gammaEnergy <= 0.5 ? '0.5' :
                        gammaEnergy <= 1.0 ? '1.0' :
                        gammaEnergy <= 2.0 ? '2.0' : '5.0';
      const mu = this.attenuationCoefficients[layer.material as keyof typeof RadiationShielding.attenuationCoefficients]?.[energyKey] || 0.1;
      const B = this.getBuildup(layer.material, layer.thickness * mu);
      const layerAtten = Math.exp(-mu * layer.thickness);
      
      contributions.push({
        material: layer.material,
        percentage: (1 - layerAtten) * 100
      });
      
      totalAttenuation *= B * layerAtten;
    }

    return {
      attenuationFactor: totalAttenuation,
      doseRate: unshieldedDose * totalAttenuation,
      requiredThickness: layers.reduce((sum, l) => sum + l.thickness, 0),
      buildup: 1.0,
      materialContribution: contributions
    };
  }
}

// ============================================================================
// SEISMIC CATEGORY I DESIGN
// ============================================================================

export class SeismicCategoryI {
  /**
   * Design basis earthquake parameters per ASCE 4
   */
  static designSpectra(
    site: {
      ss: number; // Short-period spectral acceleration
      s1: number; // 1-second spectral acceleration
      siteClass: 'A' | 'B' | 'C' | 'D' | 'E';
    },
    damping: number = 0.05
  ): { periods: number[]; accelerations: number[] } {
    const { ss, s1, siteClass } = site;

    // Site coefficients
    const Fa: Record<string, number> = {
      'A': 0.8, 'B': 1.0, 'C': 1.2, 'D': 1.4, 'E': 2.0
    };
    const Fv: Record<string, number> = {
      'A': 0.8, 'B': 1.0, 'C': 1.5, 'D': 2.0, 'E': 3.0
    };

    const Sms = Fa[siteClass] * ss;
    const Sm1 = Fv[siteClass] * s1;

    // Spectral parameters
    const Sds = 2/3 * Sms;
    const Sd1 = 2/3 * Sm1;
    const T0 = 0.2 * Sd1 / Sds;
    const Ts = Sd1 / Sds;
    const TL = 6.0; // Long period transition

    // Damping modification (for 5% reference)
    const B = damping === 0.05 ? 1.0 :
              4 / (5.6 - Math.log(100 * damping));

    // Generate spectrum
    const periods: number[] = [];
    const accelerations: number[] = [];

    for (let T = 0.01; T <= 10; T *= 1.1) {
      periods.push(T);
      
      let Sa: number;
      if (T < T0) {
        Sa = Sds * (0.4 + 0.6 * T / T0);
      } else if (T <= Ts) {
        Sa = Sds;
      } else if (T <= TL) {
        Sa = Sd1 / T;
      } else {
        Sa = Sd1 * TL / (T * T);
      }
      
      accelerations.push(Sa / B);
    }

    return { periods, accelerations };
  }

  /**
   * Soil-structure interaction analysis (simplified)
   */
  static soilStructureInteraction(
    foundationDimension: number, // m (equivalent radius)
    embedmentDepth: number, // m
    soilShearModulus: number, // MPa
    soilDensity: number, // kg/m³
    structuralMass: number, // tonnes
    fixedBaseFrequency: number // Hz
  ): {
    ssiFrequency: number;
    foundationDamping: number;
    kinematicFactor: number;
  } {
    const R = foundationDimension;
    const D = embedmentDepth;
    const G = soilShearModulus * 1e6; // Pa
    const rho = soilDensity;
    const Vs = Math.sqrt(G / rho); // Shear wave velocity

    // Foundation stiffness (horizontal)
    const Kh = 8 * G * R / (2 - 0.3) * (1 + 0.5 * D / R);
    
    // Foundation stiffness (rocking)
    const Kr = 8 * G * Math.pow(R, 3) / (3 * (1 - 0.3)) * (1 + D / (2 * R));

    // SSI frequency reduction
    const m = structuralMass * 1000; // kg
    const omega_fixed = 2 * Math.PI * fixedBaseFrequency;
    const k_struct = m * omega_fixed * omega_fixed;

    // Combined system frequency
    const omega_ssi = omega_fixed / Math.sqrt(1 + k_struct / Kh);
    const ssiFrequency = omega_ssi / (2 * Math.PI);

    // Radiation damping
    const foundationDamping = 0.3 * Math.pow(R * omega_ssi / Vs, 2);

    // Kinematic interaction factor
    const lambda = 2 * Math.PI * R / (Vs / fixedBaseFrequency);
    const kinematicFactor = Math.max(0.5, 1 - 0.05 * lambda * lambda);

    return {
      ssiFrequency,
      foundationDamping: Math.min(0.3, foundationDamping),
      kinematicFactor
    };
  }

  /**
   * Calculate seismic demand per ASCE 43
   */
  static seismicDemand(
    spectralAcceleration: number, // g
    mass: number, // tonnes
    seismicDesignCategory: 'SDC-1' | 'SDC-2' | 'SDC-3' | 'SDC-4' | 'SDC-5',
    limitState: 'LS-A' | 'LS-B' | 'LS-C' | 'LS-D'
  ): {
    designForce: number; // kN
    inelasticDeformationRatio: number;
    limitStateProbability: number;
  } {
    // Target performance probabilities per ASCE 43
    const targetHCLPF: Record<string, number> = {
      'SDC-1': 0.1, 'SDC-2': 0.1, 'SDC-3': 0.1, 'SDC-4': 0.05, 'SDC-5': 0.01
    };

    // Limit state demand factors
    const Fp: Record<string, number> = {
      'LS-A': 2.0, 'LS-B': 1.5, 'LS-C': 1.0, 'LS-D': 0.67
    };

    const W = mass * 9.81; // kN
    const designForce = Fp[limitState] * spectralAcceleration * W;

    // Inelastic energy absorption factor
    const mu: Record<string, number> = {
      'LS-A': 1.0, 'LS-B': 1.25, 'LS-C': 1.5, 'LS-D': 2.0
    };

    return {
      designForce,
      inelasticDeformationRatio: mu[limitState],
      limitStateProbability: targetHCLPF[seismicDesignCategory]
    };
  }
}

// ============================================================================
// AIRCRAFT IMPACT ASSESSMENT
// ============================================================================

export class AircraftImpact {
  /**
   * Riera loading function for aircraft impact
   */
  static rieraLoadingFunction(
    aircraftType: 'commercial-large' | 'commercial-medium' | 'military-fighter' | 'general-aviation',
    impactVelocity: number // m/s
  ): { time: number[]; force: number[] } {
    // Aircraft parameters
    const aircraft: Record<string, { mass: number; length: number; crushStrength: number }> = {
      'commercial-large': { mass: 200000, length: 60, crushStrength: 150 }, // kg, m, MPa
      'commercial-medium': { mass: 80000, length: 40, crushStrength: 100 },
      'military-fighter': { mass: 20000, length: 15, crushStrength: 200 },
      'general-aviation': { mass: 2000, length: 8, crushStrength: 50 }
    };

    const ac = aircraft[aircraftType];
    const m = ac.mass;
    const L = ac.length;
    const Pc = ac.crushStrength * 1e6; // Pa

    // Impact duration
    const t_impact = L / impactVelocity;
    const dt = t_impact / 100;

    const time: number[] = [];
    const force: number[] = [];

    // Riera function: F(t) = Pc * A(x) + μ(x) * v(t)²
    // Simplified triangular-trapezoidal shape
    for (let i = 0; i <= 100; i++) {
      const t = i * dt;
      time.push(t);

      // Normalized position along aircraft
      const x = impactVelocity * t / L;

      // Crushing force (triangular distribution of mass)
      let F: number;
      if (x < 0.1) {
        // Nose section
        F = Pc * x / 0.1 * 5; // m² effective area
      } else if (x < 0.3) {
        // Forward fuselage
        F = Pc * 5 + (x - 0.1) / 0.2 * 0.5 * m * impactVelocity * impactVelocity / L;
      } else if (x < 0.7) {
        // Wing and center
        F = Pc * 10 + 0.4 * m * impactVelocity * impactVelocity / L;
      } else if (x < 0.9) {
        // Rear fuselage
        F = Pc * 5 + (0.9 - x) / 0.2 * 0.3 * m * impactVelocity * impactVelocity / L;
      } else {
        // Tail
        F = Pc * (1 - x) / 0.1 * 3;
      }

      force.push(F / 1e6); // MN
    }

    return { time, force };
  }

  /**
   * Local perforation check (modified NDRC formula)
   */
  static perforationCheck(
    missileWeight: number, // kg
    missileDiameter: number, // m
    missileVelocity: number, // m/s
    targetThickness: number, // m
    concreteStrength: number // MPa
  ): {
    penetrationDepth: number; // m
    perforationThickness: number; // m
    scallopingThickness: number; // m
    adequate: boolean;
  } {
    const W = missileWeight * 9.81 / 1000; // kN
    const d = missileDiameter * 1000; // mm
    const V = missileVelocity * 3.28084; // ft/s
    const fc = concreteStrength * 0.145038; // ksi
    const T = targetThickness * 1000; // mm

    // NDRC penetration formula (modified)
    const x = 4 * W * d / (fc * Math.pow(d, 2)) * Math.pow(V / 1000, 1.8);
    const penetrationDepth = x * d / 1000; // m

    // Perforation thickness
    const e = x <= 2 ? 3.19 * x - 0.718 * x * x : 1.32 + 1.24 * x;
    const perforationThickness = e * d / 1000; // m

    // Scabbing/scalloping thickness
    const s = x <= 0.65 ? 7.91 * x - 5.06 * x * x : 2.12 + 1.36 * x;
    const scallopingThickness = s * d / 1000; // m

    const adequate = T / 1000 >= perforationThickness * 1.2;

    return {
      penetrationDepth,
      perforationThickness,
      scallopingThickness,
      adequate
    };
  }

  /**
   * Global structural response to aircraft impact
   */
  static globalResponse(
    peakForce: number, // MN
    impulseDuration: number, // s
    structuralMass: number, // tonnes
    naturalFrequency: number, // Hz
    ultimateCapacity: number // MN
  ): {
    maxDisplacement: number; // m
    maxAcceleration: number; // g
    ductilityDemand: number;
    adequate: boolean;
  } {
    const M = structuralMass * 1000; // kg
    const omega = 2 * Math.PI * naturalFrequency;
    const K = M * omega * omega;
    const Pu = ultimateCapacity * 1e6; // N
    const P = peakForce * 1e6; // N
    const td = impulseDuration;

    // Dynamic load factor
    const ratio = td * naturalFrequency;
    let DLF: number;
    if (ratio < 0.25) {
      DLF = 2 * Math.PI * ratio;
    } else if (ratio < 1) {
      DLF = 2.0;
    } else {
      DLF = 1.5;
    }

    // Maximum displacement (elastic)
    const maxDisplacement = P * DLF / K;

    // Maximum acceleration
    const maxAcceleration = (P * DLF / M) / 9.81; // g

    // Ductility demand
    const yieldDisp = Pu / K;
    const ductilityDemand = maxDisplacement / yieldDisp;

    // Check adequacy (ductility limit of 2 for safety-related structures)
    const adequate = ductilityDemand <= 2.0 && P * DLF <= Pu;

    return {
      maxDisplacement,
      maxAcceleration,
      ductilityDemand,
      adequate
    };
  }
}

// ============================================================================
// THERMAL GRADIENT ANALYSIS
// ============================================================================

export class ThermalAnalysis {
  /**
   * Calculate thermal stresses in containment
   */
  static thermalStress(
    innerTemp: number, // °C
    outerTemp: number, // °C
    wallThickness: number, // m
    materialProps: {
      E: number; // MPa
      alpha: number; // per °C
      nu: number; // Poisson's ratio
    }
  ): {
    innerSurfaceStress: number; // MPa
    outerSurfaceStress: number; // MPa
    maxStress: number; // MPa
  } {
    const { E, alpha, nu } = materialProps;
    const deltaT = innerTemp - outerTemp;

    // Linear temperature gradient through wall
    // Thermal stress = E * α * ΔT / (1 - ν) for restrained condition
    const factor = E * alpha / (1 - nu);

    // For linear gradient, stress varies linearly
    const innerSurfaceStress = -factor * deltaT / 2;
    const outerSurfaceStress = factor * deltaT / 2;

    return {
      innerSurfaceStress,
      outerSurfaceStress,
      maxStress: Math.max(Math.abs(innerSurfaceStress), Math.abs(outerSurfaceStress))
    };
  }

  /**
   * Calculate thermal moments for design
   */
  static thermalMoment(
    gradient: number, // °C/m through thickness
    thickness: number, // m
    E: number, // MPa
    alpha: number, // per °C
    nu: number
  ): number { // kN-m/m
    // M = E * α * gradient * t² / [12 * (1 - ν)]
    const M = E * 1000 * alpha * gradient * thickness * thickness / (12 * (1 - nu));
    return M;
  }

  /**
   * LOCA thermal transient effects
   */
  static locaThermalEffects(
    initialTemp: number, // °C
    peakTemp: number, // °C
    riseTime: number, // seconds
    wallThickness: number, // m
    diffusivity: number = 1e-6 // m²/s for concrete
  ): {
    surfaceTemp: number[];
    coreTemp: number[];
    thermalShock: number;
    spallRisk: boolean;
  } {
    const numPoints = 20;
    const surfaceTemp: number[] = [];
    const coreTemp: number[] = [];

    const timeStep = riseTime / numPoints;
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i * timeStep;
      
      // Surface temperature (rapid rise)
      const Ts = initialTemp + (peakTemp - initialTemp) * 
                 (1 - Math.exp(-3 * t / riseTime));
      surfaceTemp.push(Ts);

      // Core temperature (delayed, damped)
      const penetration = Math.sqrt(4 * diffusivity * t);
      const dampFactor = Math.min(1, penetration / wallThickness);
      const Tc = initialTemp + (peakTemp - initialTemp) * 
                 dampFactor * (1 - Math.exp(-t / riseTime));
      coreTemp.push(Tc);
    }

    // Thermal shock = max temperature gradient
    const thermalShock = Math.max(...surfaceTemp.map((s, i) => 
      Math.abs(s - coreTemp[i]) / (wallThickness * 1000)
    ));

    // Spall risk if gradient exceeds 5°C/cm
    const spallRisk = thermalShock > 0.05;

    return { surfaceTemp, coreTemp, thermalShock, spallRisk };
  }
}

// ============================================================================
// CONTAINMENT DESIGN CHECK
// ============================================================================

export class ContainmentDesignCheck {
  /**
   * Complete containment design verification
   */
  static verify(
    structure: NuclearStructure,
    designPressure: number,
    seismicDemand: { Sa: number; Sv: number },
    temperature: { inside: number; outside: number }
  ): ContainmentDesignResult {
    const geometry = structure.geometry as ContainmentGeometry;
    const materials = structure.materials;
    const recommendations: string[] = [];

    // Pressure capacity
    const pressureCapacity = ContainmentPressure.designPressureCapacity(
      geometry, materials
    );

    // Hoop stress check
    const hoopDemand = ContainmentPressure.hoopStress(
      designPressure, geometry.innerRadius, geometry.wallThickness
    );
    const hoopCapacity = pressureCapacity.factored * geometry.wallThickness / geometry.innerRadius;
    const hoopDCR = hoopDemand / hoopCapacity;

    // Meridional stress check
    const meridionalDemand = ContainmentPressure.meridionalStress(
      designPressure, geometry.innerRadius, geometry.wallThickness
    );
    const meridionalCapacity = hoopCapacity * 0.6;
    const meridionalDCR = meridionalDemand / meridionalCapacity;

    // Shear check (simplified)
    const shearDemand = seismicDemand.Sa * 100; // kPa (simplified)
    const shearCapacity = 300; // kPa (typical)
    const shearDCR = shearDemand / shearCapacity;

    // Liner strain check
    const thermalStress = ThermalAnalysis.thermalStress(
      temperature.inside, temperature.outside, geometry.wallThickness,
      { E: 200000, alpha: 12e-6, nu: 0.3 }
    );
    const linerStrain = thermalStress.maxStress / 200000 + designPressure * geometry.innerRadius / 
                        (200000 * 1000 * (geometry.linerThickness / 1000));
    const linerStrainLimit = 0.004; // 0.4%

    // Seismic DCR
    const seismicDCR = seismicDemand.Sa / 0.3; // Assume 0.3g capacity

    // Sliding and overturning
    const weight = 2500 * Math.PI * 2 * geometry.innerRadius * geometry.height * geometry.wallThickness * 9.81 / 1000; // kN
    const baseShear = seismicDemand.Sa * weight / 9.81;
    const frictionCoeff = 0.5;
    const slidingFOS = frictionCoeff * weight / baseShear;
    const overturningMoment = baseShear * geometry.height * 0.7;
    const resistingMoment = weight * geometry.innerRadius;
    const overturningFOS = resistingMoment / overturningMoment;

    // Status
    let status: ContainmentDesignResult['status'] = 'acceptable';
    if (hoopDCR > 1.0 || meridionalDCR > 1.0 || shearDCR > 1.0) {
      status = 'unacceptable';
    } else if (hoopDCR > 0.9 || linerStrain > linerStrainLimit * 0.9) {
      status = 'review-required';
    }

    // Recommendations
    if (hoopDCR > 0.85) {
      recommendations.push('Consider increasing wall thickness or prestress');
    }
    if (linerStrain > linerStrainLimit * 0.8) {
      recommendations.push('Verify liner anchorage and thermal insulation');
    }
    if (slidingFOS < 1.5) {
      recommendations.push('Increase base friction or add shear keys');
    }
    if (seismicDCR > 0.8) {
      recommendations.push('Review seismic isolation options');
    }

    return {
      code: 'ACI 349 / ASME BPVC III Div 2',
      category: structure.seismicCategory,
      hoop: { demand: hoopDemand, capacity: hoopCapacity, dcr: hoopDCR },
      meridional: { demand: meridionalDemand, capacity: meridionalCapacity, dcr: meridionalDCR },
      shear: { demand: shearDemand, capacity: shearCapacity, dcr: shearDCR },
      designPressure: pressureCapacity.serviceLevel.C,
      ultimatePressure: pressureCapacity.ultimate,
      testPressure: pressureCapacity.serviceLevel.B * 1.15,
      linerStrain,
      linerStrainLimit,
      seismicDCR,
      slidingFOS,
      overturningFOS,
      status,
      recommendations
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ContainmentPressure,
  RadiationShielding,
  SeismicCategoryI,
  AircraftImpact,
  ThermalAnalysis,
  ContainmentDesignCheck
};
