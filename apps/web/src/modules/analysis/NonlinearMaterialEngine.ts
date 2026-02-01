/**
 * ============================================================================
 * NONLINEAR MATERIAL MODELS ENGINE
 * ============================================================================
 * 
 * Comprehensive nonlinear material constitutive models:
 * - Concrete damage plasticity
 * - Steel plasticity models
 * - Fiber section models
 * - Hysteretic models
 * - Creep and shrinkage
 * - Tension stiffening
 * - Compression softening
 * - Confinement models
 * - Cyclic degradation
 * 
 * Reference Standards:
 * - ACI 318 (Concrete stress-strain)
 * - EN 1992-1-1 (Parabola-rectangle, tension stiffening)
 * - fib Model Code 2010 (Time-dependent effects)
 * - Mander et al. (Confined concrete)
 * - OpenSees material models
 * - PERFORM-3D material calibration
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MaterialPoint {
  strain: number;
  stress: number;
  tangent: number;
  plasticStrain: number;
  damageVariable?: number;
}

export interface HystereticState {
  maxPositiveStrain: number;
  minNegativeStrain: number;
  maxPositiveStress: number;
  minNegativeStress: number;
  unloadingStiffness: number;
  reloadingStiffness: number;
  energyDissipated: number;
  cycleCount: number;
}

export interface FiberProperties {
  area: number; // mm²
  y: number; // mm - distance from NA
  z: number; // mm - distance from NA
  material: 'concrete' | 'steel' | 'FRP';
  materialModel: string;
}

export interface SectionResponse {
  axialForce: number; // N
  momentY: number; // N·mm
  momentZ: number; // N·mm
  curvatureY: number; // 1/mm
  curvatureZ: number; // 1/mm
  axialStrain: number;
  neutralAxis: number; // mm from reference
}

export interface TimeDependent {
  age: number; // days
  creepCoefficient: number;
  shrinkageStrain: number;
  effectiveModulus: number;
  ageAdjustedModulus: number;
}

// ============================================================================
// CONCRETE MATERIAL MODELS
// ============================================================================

export class ConcreteMaterial {
  /**
   * Hognestad parabolic stress-strain curve
   */
  static hognestad(
    epsilon: number, // strain
    fc: number, // MPa - peak stress
    epsilon_0: number = 0.002, // strain at peak
    epsilon_u: number = 0.0035 // ultimate strain
  ): MaterialPoint {
    if (epsilon <= 0) {
      // Tension - assume linear elastic up to cracking
      const ft = 0.33 * Math.sqrt(fc);
      const E0 = 2 * fc / epsilon_0;
      const epsilon_cr = ft / E0;
      
      if (epsilon > -epsilon_cr) {
        return {
          strain: epsilon,
          stress: E0 * epsilon,
          tangent: E0,
          plasticStrain: 0
        };
      } else {
        return {
          strain: epsilon,
          stress: 0,
          tangent: 0,
          plasticStrain: epsilon
        };
      }
    }
    
    // Compression
    if (epsilon <= epsilon_0) {
      // Ascending branch - parabolic
      const ratio = epsilon / epsilon_0;
      const stress = fc * (2 * ratio - ratio * ratio);
      const tangent = 2 * fc / epsilon_0 * (1 - ratio);
      
      return {
        strain: epsilon,
        stress,
        tangent,
        plasticStrain: 0
      };
    } else if (epsilon <= epsilon_u) {
      // Descending branch - linear
      const Z = 0.5 / (3 + 0.29 * fc / (145 * fc - 1000));
      const stress = fc * (1 - Z * (epsilon - epsilon_0));
      const tangent = -fc * Z;
      
      return {
        strain: epsilon,
        stress: Math.max(stress, 0.2 * fc),
        tangent,
        plasticStrain: 0
      };
    } else {
      // Crushed
      return {
        strain: epsilon,
        stress: 0.2 * fc,
        tangent: 0,
        plasticStrain: epsilon - 0.2 * fc / (2 * fc / epsilon_0)
      };
    }
  }

  /**
   * Eurocode 2 parabola-rectangle model
   */
  static eurocode2(
    epsilon: number, // strain
    fck: number, // MPa - characteristic strength
    concreteClass: 'normal' | 'high' = 'normal'
  ): MaterialPoint {
    // EC2 parameters
    const epsilon_c2 = fck <= 50 ? 0.002 : 0.002 + 0.000085 * Math.pow(fck - 50, 0.53);
    const epsilon_cu2 = fck <= 50 ? 0.0035 : 0.0026 + 0.035 * Math.pow((90 - fck) / 100, 4);
    const n = fck <= 50 ? 2.0 : 1.4 + 23.4 * Math.pow((90 - fck) / 100, 4);
    
    if (epsilon <= 0) {
      // Tension - linear elastic
      const fctm = 0.3 * Math.pow(fck, 2/3);
      const Ecm = 22000 * Math.pow((fck + 8) / 10, 0.3);
      
      if (epsilon > -fctm / Ecm) {
        return {
          strain: epsilon,
          stress: Ecm * epsilon,
          tangent: Ecm,
          plasticStrain: 0
        };
      } else {
        return {
          strain: epsilon,
          stress: 0,
          tangent: 0,
          plasticStrain: epsilon
        };
      }
    }
    
    // Compression
    const fcd = fck / 1.5; // Design strength
    
    if (epsilon <= epsilon_c2) {
      // Parabolic branch
      const ratio = epsilon / epsilon_c2;
      const stress = fcd * (1 - Math.pow(1 - ratio, n));
      const tangent = fcd * n * Math.pow(1 - ratio, n - 1) / epsilon_c2;
      
      return {
        strain: epsilon,
        stress,
        tangent,
        plasticStrain: 0
      };
    } else if (epsilon <= epsilon_cu2) {
      // Constant (rectangular)
      return {
        strain: epsilon,
        stress: fcd,
        tangent: 0,
        plasticStrain: epsilon - epsilon_c2
      };
    } else {
      // Crushed
      return {
        strain: epsilon,
        stress: 0,
        tangent: 0,
        plasticStrain: epsilon
      };
    }
  }

  /**
   * Mander confined concrete model
   */
  static manderConfined(
    epsilon: number, // strain
    fc: number, // MPa - unconfined strength
    fl: number, // MPa - lateral confining pressure
    epsilon_co: number = 0.002 // unconfined peak strain
  ): MaterialPoint {
    // Confinement effectiveness
    const K = (fl > 0) ? 
      -1.254 + 2.254 * Math.sqrt(1 + 7.94 * fl / fc) - 2 * fl / fc :
      1.0;
    
    const fcc = K * fc; // Confined strength
    const epsilon_cc = epsilon_co * (1 + 5 * (K - 1)); // Confined peak strain
    
    // Secant modulus at peak
    const Ec = 5000 * Math.sqrt(fc);
    const Esec = fcc / epsilon_cc;
    
    // Shape factor
    const r = Ec / (Ec - Esec);
    
    // Mander equation
    const x = epsilon / epsilon_cc;
    const stress = fcc * x * r / (r - 1 + Math.pow(x, r));
    
    // Tangent
    const tangent = fcc * r * (r - 1 + Math.pow(x, r) - x * r * Math.pow(x, r - 1)) / 
                    Math.pow(r - 1 + Math.pow(x, r), 2) / epsilon_cc;
    
    // Ultimate strain (energy balance)
    const epsilon_cu = 0.004 + 1.4 * fl * 0.004 / fcc;
    
    if (epsilon > epsilon_cu) {
      return {
        strain: epsilon,
        stress: 0,
        tangent: 0,
        plasticStrain: epsilon,
        damageVariable: 1.0
      };
    }

    return {
      strain: epsilon,
      stress: Math.max(stress, 0),
      tangent: Math.max(tangent, 0),
      plasticStrain: epsilon > epsilon_cc ? epsilon - stress / Ec : 0,
      damageVariable: epsilon > epsilon_cc ? 1 - stress / fcc : 0
    };
  }

  /**
   * Kent-Scott-Park model with confinement
   */
  static kentPark(
    epsilon: number,
    fc: number, // MPa
    rho_s: number, // volumetric ratio of stirrups
    fyh: number, // MPa - stirrup yield strength
    sh: number // mm - stirrup spacing
  ): MaterialPoint {
    // Confinement factor
    const K = 1 + rho_s * fyh / fc;
    
    const fcc = K * fc;
    const epsilon_0 = 0.002 * K;
    const epsilon_20 = epsilon_0 + 0.75 * rho_s * Math.sqrt(sh);
    
    if (epsilon <= 0) {
      // Tension - cracked
      const ft = 0.33 * Math.sqrt(fc);
      const Ec = 2 * fc / 0.002;
      if (epsilon > -ft / Ec) {
        return { strain: epsilon, stress: Ec * epsilon, tangent: Ec, plasticStrain: 0 };
      }
      return { strain: epsilon, stress: 0, tangent: 0, plasticStrain: epsilon };
    }
    
    if (epsilon <= epsilon_0) {
      // Ascending
      const ratio = epsilon / epsilon_0;
      const stress = fcc * (2 * ratio - ratio * ratio);
      const tangent = 2 * fcc / epsilon_0 * (1 - ratio);
      return { strain: epsilon, stress, tangent, plasticStrain: 0 };
    }
    
    // Descending
    const Zm = 0.5 / (3 + 0.29 * fc / (145 * fc - 1000) + 0.75 * rho_s * Math.sqrt(sh / epsilon_0) - epsilon_0);
    const stress = fcc * (1 - Zm * (epsilon - epsilon_0));
    
    return {
      strain: epsilon,
      stress: Math.max(stress, 0.2 * fcc),
      tangent: -fcc * Zm,
      plasticStrain: epsilon - stress / (2 * fcc / epsilon_0)
    };
  }

  /**
   * Tension stiffening model (Collins & Mitchell)
   */
  static tensionStiffening(
    epsilon: number, // strain (positive = tension)
    fc: number, // MPa
    rho: number, // reinforcement ratio
    db: number // mm - bar diameter
  ): { stress: number; crackWidth: number } {
    const fct = 0.33 * Math.sqrt(fc);
    const Ec = 4700 * Math.sqrt(fc);
    const epsilon_cr = fct / Ec;
    
    if (epsilon <= epsilon_cr) {
      return {
        stress: Ec * epsilon,
        crackWidth: 0
      };
    }
    
    // Post-cracking (tension stiffening)
    const alpha_1 = 1.0; // Bond factor
    const alpha_2 = 0.4; // Duration factor
    
    const stress = alpha_1 * alpha_2 * fct / (1 + Math.sqrt(500 * epsilon));
    
    // Crack width estimate
    const s_m = 50 + 0.25 * db / rho; // Average crack spacing
    const crackWidth = s_m * epsilon;

    return { stress, crackWidth };
  }
}

// ============================================================================
// STEEL MATERIAL MODELS
// ============================================================================

export class SteelMaterial {
  /**
   * Bilinear steel with strain hardening
   */
  static bilinear(
    epsilon: number,
    fy: number, // MPa
    Es: number = 200000, // MPa
    Esh: number = 2000, // MPa - hardening modulus
    epsilon_sh: number = 0.02, // strain at onset of hardening
    epsilon_u: number = 0.15 // ultimate strain
  ): MaterialPoint {
    const epsilon_y = fy / Es;
    const absEps = Math.abs(epsilon);
    const sign = Math.sign(epsilon);
    
    if (absEps <= epsilon_y) {
      // Elastic
      return {
        strain: epsilon,
        stress: Es * epsilon,
        tangent: Es,
        plasticStrain: 0
      };
    } else if (absEps <= epsilon_sh) {
      // Yield plateau
      return {
        strain: epsilon,
        stress: sign * fy,
        tangent: 0,
        plasticStrain: epsilon - sign * epsilon_y
      };
    } else if (absEps <= epsilon_u) {
      // Strain hardening
      const stress = sign * (fy + Esh * (absEps - epsilon_sh));
      return {
        strain: epsilon,
        stress,
        tangent: Esh,
        plasticStrain: epsilon - sign * epsilon_y
      };
    } else {
      // Fractured
      return {
        strain: epsilon,
        stress: 0,
        tangent: 0,
        plasticStrain: epsilon,
        damageVariable: 1.0
      };
    }
  }

  /**
   * Menegotto-Pinto steel model (smooth hysteretic)
   */
  static menegottoPinto(
    epsilon: number,
    strainHistory: { eps_0: number; sig_0: number; eps_r: number; sig_r: number },
    fy: number,
    Es: number = 200000,
    b: number = 0.01, // strain hardening ratio
    R0: number = 20, // initial curvature parameter
    cR1: number = 18.5,
    cR2: number = 0.15
  ): MaterialPoint {
    const { eps_0, sig_0, eps_r, sig_r } = strainHistory;
    
    // Reference strain and stress differences
    const eps_diff = eps_r - eps_0;
    const sig_diff = sig_r - sig_0;
    
    if (Math.abs(eps_diff) < 1e-10) {
      return {
        strain: epsilon,
        stress: Es * epsilon,
        tangent: Es,
        plasticStrain: 0
      };
    }
    
    // Normalized strain
    const xi = (epsilon - eps_r) / eps_diff;
    
    // Curvature parameter (degrades with cycling)
    const R = R0; // Simplified - should track cycles
    
    // Menegotto-Pinto equation
    const sigma_star = b * xi + (1 - b) * xi / Math.pow(1 + Math.pow(Math.abs(xi), R), 1/R);
    
    const stress = sig_r + sigma_star * sig_diff;
    
    // Tangent
    const denom = Math.pow(1 + Math.pow(Math.abs(xi), R), 1 + 1/R);
    const tangent = (b + (1 - b) / denom) * sig_diff / eps_diff;
    
    const epsilon_y = fy / Es;
    const plasticStrain = Math.abs(epsilon) > epsilon_y ? 
                          epsilon - Math.sign(epsilon) * epsilon_y : 0;

    return {
      strain: epsilon,
      stress,
      tangent,
      plasticStrain
    };
  }

  /**
   * Dodd-Restrepo steel model with buckling
   */
  static doddRestrepo(
    epsilon: number,
    fy: number,
    fu: number,
    Es: number = 200000,
    epsilon_sh: number = 0.02,
    epsilon_u: number = 0.10,
    bucklingStrain: number = -0.02 // Compression buckling strain
  ): MaterialPoint {
    const epsilon_y = fy / Es;
    const sign = Math.sign(epsilon);
    const absEps = Math.abs(epsilon);
    
    // Check for compression buckling
    if (epsilon < bucklingStrain) {
      const degradedStress = fy * Math.exp(-10 * (bucklingStrain - epsilon));
      return {
        strain: epsilon,
        stress: -degradedStress,
        tangent: -10 * degradedStress,
        plasticStrain: epsilon - bucklingStrain,
        damageVariable: 1 - degradedStress / fy
      };
    }
    
    if (absEps <= epsilon_y) {
      return {
        strain: epsilon,
        stress: Es * epsilon,
        tangent: Es,
        plasticStrain: 0
      };
    }
    
    if (absEps <= epsilon_sh) {
      return {
        strain: epsilon,
        stress: sign * fy,
        tangent: 0,
        plasticStrain: epsilon - sign * epsilon_y
      };
    }
    
    if (absEps <= epsilon_u) {
      // Hardening with Dodd-Restrepo curve
      const p = epsilon_sh + 0.5 * (epsilon_u - epsilon_sh);
      const fsu = fu;
      
      const term = (absEps - epsilon_sh) / (p - epsilon_sh);
      const stress = sign * (fy + (fsu - fy) * (2 * term - term * term));
      const tangent = (fsu - fy) * 2 * (1 - term) / (p - epsilon_sh);
      
      return {
        strain: epsilon,
        stress,
        tangent,
        plasticStrain: epsilon - sign * epsilon_y
      };
    }
    
    // Fractured
    return {
      strain: epsilon,
      stress: 0,
      tangent: 0,
      plasticStrain: epsilon,
      damageVariable: 1.0
    };
  }

  /**
   * Cyclic degradation model (Kunnath)
   */
  static cyclicDegradation(
    cumulativePlasticStrain: number,
    initialStrength: number,
    degradationParameter: number = 0.1
  ): { strengthRatio: number; stiffnessRatio: number } {
    // Energy-based degradation
    const strengthRatio = Math.exp(-degradationParameter * cumulativePlasticStrain);
    const stiffnessRatio = Math.pow(strengthRatio, 0.5);

    return {
      strengthRatio: Math.max(strengthRatio, 0.2),
      stiffnessRatio: Math.max(stiffnessRatio, 0.3)
    };
  }
}

// ============================================================================
// HYSTERETIC MODELS
// ============================================================================

export class HystereticModels {
  /**
   * Takeda hysteretic model
   */
  static takeda(
    strain: number,
    state: HystereticState,
    fy: number,
    K0: number, // Initial stiffness
    alpha: number = 0.5, // Unloading stiffness exponent
    beta: number = 0.0 // Reloading stiffness exponent
  ): { stress: number; tangent: number; newState: HystereticState } {
    const eps_y = fy / K0;
    
    // Unloading stiffness
    const mu = Math.max(
      Math.abs(state.maxPositiveStrain) / eps_y,
      Math.abs(state.minNegativeStrain) / eps_y,
      1.0
    );
    const Ku = K0 * Math.pow(mu, -alpha);
    
    // Determine loading/unloading
    let stress: number;
    let tangent: number;
    
    if (strain > state.maxPositiveStrain) {
      // Loading positive beyond maximum
      if (strain > eps_y) {
        stress = fy + 0.01 * K0 * (strain - eps_y);
        tangent = 0.01 * K0;
      } else {
        stress = K0 * strain;
        tangent = K0;
      }
      state.maxPositiveStrain = strain;
      state.maxPositiveStress = stress;
    } else if (strain < state.minNegativeStrain) {
      // Loading negative beyond minimum
      if (strain < -eps_y) {
        stress = -fy + 0.01 * K0 * (strain + eps_y);
        tangent = 0.01 * K0;
      } else {
        stress = K0 * strain;
        tangent = K0;
      }
      state.minNegativeStrain = strain;
      state.minNegativeStress = stress;
    } else {
      // Unloading/reloading
      tangent = Ku;
      stress = state.maxPositiveStress - Ku * (state.maxPositiveStrain - strain);
      
      // Check for targeting opposite peak
      if (strain < 0 && stress < state.minNegativeStress) {
        const Kr = (state.minNegativeStress - 0) / (state.minNegativeStrain - 0);
        tangent = Kr;
        stress = Kr * strain;
      }
    }
    
    state.unloadingStiffness = Ku;

    return {
      stress,
      tangent,
      newState: state
    };
  }

  /**
   * Pivot hysteretic model
   */
  static pivot(
    strain: number,
    state: HystereticState,
    fy: number,
    K0: number,
    pivotPoint: number = 0.5 // Fraction of yield for pivot
  ): { stress: number; tangent: number; newState: HystereticState } {
    const eps_y = fy / K0;
    const sig_pivot = pivotPoint * fy;
    const eps_pivot = sig_pivot / K0;
    
    let stress: number;
    let tangent: number;
    
    // Determine loading direction and state
    const loading = strain >= 0;
    const peakStrain = loading ? state.maxPositiveStrain : state.minNegativeStrain;
    const peakStress = loading ? state.maxPositiveStress : state.minNegativeStress;
    
    if ((loading && strain > peakStrain) || (!loading && strain < peakStrain)) {
      // Loading beyond peak
      if (Math.abs(strain) > eps_y) {
        const sign = Math.sign(strain);
        stress = sign * fy + 0.01 * K0 * (strain - sign * eps_y);
        tangent = 0.01 * K0;
      } else {
        stress = K0 * strain;
        tangent = K0;
      }
      
      if (loading) {
        state.maxPositiveStrain = strain;
        state.maxPositiveStress = stress;
      } else {
        state.minNegativeStrain = strain;
        state.minNegativeStress = stress;
      }
    } else {
      // Unloading - target pivot point on opposite side
      const oppPivotStrain = loading ? -eps_pivot : eps_pivot;
      const oppPivotStress = loading ? -sig_pivot : sig_pivot;
      
      tangent = (peakStress - oppPivotStress) / (peakStrain - oppPivotStrain);
      stress = peakStress + tangent * (strain - peakStrain);
    }

    return { stress, tangent, newState: state };
  }

  /**
   * Bouc-Wen hysteretic model
   */
  static boucWen(
    displacement: number,
    velocity: number,
    z: number, // Hysteretic variable
    K0: number,
    fy: number,
    alpha: number = 0.1, // Post-yield stiffness ratio
    beta: number = 0.5,
    gamma: number = 0.5,
    n: number = 2,
    dt: number = 0.01
  ): { force: number; zNew: number } {
    const xy = fy / K0;
    const A = 1.0;
    
    // Bouc-Wen equation: dz/dt = (A - (β·sign(ẋ·z) + γ)|z|^n) · ẋ / xy
    const signTerm = Math.sign(velocity * z);
    const dzdt = (A - (beta * signTerm + gamma) * Math.pow(Math.abs(z), n)) * velocity / xy;
    
    const zNew = z + dzdt * dt;
    
    // Force
    const force = alpha * K0 * displacement + (1 - alpha) * fy * zNew;

    return { force, zNew };
  }
}

// ============================================================================
// FIBER SECTION ANALYSIS
// ============================================================================

export class FiberSection {
  private fibers: FiberProperties[];
  
  constructor(fibers: FiberProperties[]) {
    this.fibers = fibers;
  }

  /**
   * Add fiber
   */
  addFiber(fiber: FiberProperties): void {
    this.fibers.push(fiber);
  }

  /**
   * Create rectangular concrete section with steel
   */
  static rectangularRCSection(
    width: number, // mm
    height: number, // mm
    cover: number, // mm
    rebarDiameters: number[], // mm
    rebarPositions: { y: number; z: number }[], // mm from centroid
    fc: number, // MPa
    fy: number, // MPa
    nFibersY: number = 10,
    nFibersZ: number = 1
  ): FiberSection {
    const fibers: FiberProperties[] = [];
    
    // Concrete fibers
    const fiberHeight = height / nFibersY;
    const fiberWidth = width / nFibersZ;
    const concreteArea = fiberHeight * fiberWidth;
    
    for (let i = 0; i < nFibersY; i++) {
      for (let j = 0; j < nFibersZ; j++) {
        const y = -height / 2 + fiberHeight / 2 + i * fiberHeight;
        const z = -width / 2 + fiberWidth / 2 + j * fiberWidth;
        
        // Check if fiber overlaps with rebar
        let isSteel = false;
        for (let k = 0; k < rebarPositions.length; k++) {
          if (Math.abs(y - rebarPositions[k].y) < fiberHeight / 2 &&
              Math.abs(z - rebarPositions[k].z) < fiberWidth / 2) {
            isSteel = true;
            break;
          }
        }
        
        if (!isSteel) {
          fibers.push({
            area: concreteArea,
            y,
            z,
            material: 'concrete',
            materialModel: 'hognestad'
          });
        }
      }
    }
    
    // Steel fibers
    for (let k = 0; k < rebarPositions.length; k++) {
      const As = Math.PI * rebarDiameters[k] * rebarDiameters[k] / 4;
      fibers.push({
        area: As,
        y: rebarPositions[k].y,
        z: rebarPositions[k].z,
        material: 'steel',
        materialModel: 'bilinear'
      });
    }

    return new FiberSection(fibers);
  }

  /**
   * Section analysis at given strain state
   */
  analyze(
    axialStrain: number,
    curvatureY: number,
    curvatureZ: number,
    fc: number,
    fy: number
  ): SectionResponse {
    let axialForce = 0;
    let momentY = 0;
    let momentZ = 0;
    
    for (const fiber of this.fibers) {
      // Strain at fiber location
      const strain = axialStrain + curvatureY * fiber.y + curvatureZ * fiber.z;
      
      // Get stress from material model
      let stress: number;
      if (fiber.material === 'concrete') {
        const result = ConcreteMaterial.hognestad(strain, fc);
        stress = result.stress;
      } else {
        const result = SteelMaterial.bilinear(strain, fy);
        stress = result.stress;
      }
      
      // Integrate
      const force = stress * fiber.area;
      axialForce += force;
      momentY += force * fiber.y;
      momentZ += force * fiber.z;
    }

    return {
      axialForce,
      momentY,
      momentZ,
      curvatureY,
      curvatureZ,
      axialStrain,
      neutralAxis: this.findNeutralAxis(axialStrain, curvatureY, fc, fy)
    };
  }

  /**
   * Find neutral axis location
   */
  private findNeutralAxis(
    axialStrain: number,
    curvature: number,
    fc: number,
    fy: number
  ): number {
    if (Math.abs(curvature) < 1e-10) return 0;
    
    // Newton-Raphson iteration to find NA where strain = 0
    return -axialStrain / curvature;
  }

  /**
   * Moment-curvature analysis
   */
  momentCurvature(
    axialLoad: number, // N
    fc: number,
    fy: number,
    maxCurvature: number = 0.0001, // 1/mm
    steps: number = 100
  ): { curvature: number[]; moment: number[] } {
    const curvatures: number[] = [];
    const moments: number[] = [];
    
    for (let i = 0; i <= steps; i++) {
      const phi = maxCurvature * i / steps;
      
      // Find axial strain that gives target axial load
      let epsilon = 0;
      for (let iter = 0; iter < 50; iter++) {
        const response = this.analyze(epsilon, phi, 0, fc, fy);
        const error = response.axialForce - axialLoad;
        
        if (Math.abs(error) < 0.01 * Math.abs(axialLoad) || Math.abs(error) < 100) {
          curvatures.push(phi * 1000); // 1/m
          moments.push(response.momentY / 1e6); // kN·m
          break;
        }
        
        // Adjust axial strain
        epsilon -= error / (1e6); // Simple iteration
      }
    }

    return { curvature: curvatures, moment: moments };
  }
}

// ============================================================================
// CREEP AND SHRINKAGE
// ============================================================================

export class TimeEffects {
  /**
   * ACI 209 creep coefficient
   */
  static aci209Creep(
    t: number, // days - time after loading
    t0: number, // days - age at loading
    humidity: number, // %
    volumeSurfaceRatio: number, // mm
    slump: number, // mm
    fineAggregateRatio: number, // %
    airContent: number // %
  ): number {
    // Ultimate creep coefficient
    const la = 1.25 * Math.pow(t0, -0.118);
    const lh = 1.27 - 0.0067 * humidity;
    const lvs = 2/3 * (1 + 1.13 * Math.exp(-0.0213 * volumeSurfaceRatio));
    const ls = 0.82 + 0.00264 * slump;
    const lpsi = 0.88 + 0.0024 * fineAggregateRatio;
    const lalpha = 0.46 + 0.09 * airContent;
    
    const nu_u = 2.35 * la * lh * lvs * ls * lpsi * lalpha;
    
    // Time development
    const psi = 0.6; // Power for moist-cured
    const d = 10; // Days for half ultimate
    const nu_t = nu_u * Math.pow(t, psi) / (d + Math.pow(t, psi));

    return nu_t;
  }

  /**
   * ACI 209 shrinkage strain
   */
  static aci209Shrinkage(
    t: number, // days from end of curing
    humidity: number, // %
    volumeSurfaceRatio: number, // mm
    slump: number, // mm
    fineAggregateRatio: number, // %
    cementContent: number, // kg/m³
    airContent: number // %
  ): number {
    // Ultimate shrinkage
    const sh_u = 780e-6; // Base value
    
    // Correction factors
    const gamma_h = 1.40 - 0.01 * humidity; // Humidity > 40%
    const gamma_vs = 1.2 * Math.exp(-0.00472 * volumeSurfaceRatio);
    const gamma_s = 0.89 + 0.00161 * slump;
    const gamma_psi = 0.30 + 0.014 * fineAggregateRatio;
    const gamma_c = 0.75 + 0.00061 * cementContent;
    const gamma_alpha = 0.95 + 0.008 * airContent;
    
    const esh_u = sh_u * gamma_h * gamma_vs * gamma_s * gamma_psi * gamma_c * gamma_alpha;
    
    // Time development
    const f = 35; // Days for moist curing
    const esh_t = esh_u * t / (f + t);

    return esh_t;
  }

  /**
   * Eurocode 2 / fib creep
   */
  static fibCreep(
    t: number, // days
    t0: number, // days - loading age
    h0: number, // mm - notional size
    RH: number, // % - relative humidity
    fcm: number, // MPa - mean compressive strength
    cementType: 'R' | 'N' | 'S' = 'N' // Rapid, Normal, Slow
  ): TimeDependent {
    // Cement type factor
    const alpha: Record<string, number> = { 'R': 1, 'N': 0, 'S': -1 };
    const t0_adj = t0 * Math.pow(9 / (2 + Math.pow(t0, 1.2)) + 1, alpha[cementType]);
    
    // Notional creep coefficient components
    const phi_RH = (1 + (1 - RH / 100) / (0.1 * Math.pow(h0, 1/3))) *
                   (1 + 0.1 * Math.pow(35 / fcm, 0.7));
    
    const beta_fcm = 16.8 / Math.sqrt(fcm);
    const beta_t0 = 1 / (0.1 + Math.pow(t0_adj, 0.2));
    
    const phi_0 = phi_RH * beta_fcm * beta_t0;
    
    // Time development
    const beta_H = Math.min(1.5 * (1 + Math.pow(0.012 * RH, 18)) * h0 + 250, 1500);
    const beta_c = Math.pow((t - t0) / (beta_H + t - t0), 0.3);
    
    const phi = phi_0 * beta_c;
    
    // Effective modulus
    const Ecm = 22000 * Math.pow(fcm / 10, 0.3);
    const Ec_eff = Ecm / (1 + phi);
    
    // Age-adjusted
    const chi = 0.8; // Aging coefficient
    const Ec_adj = Ecm / (1 + chi * phi);

    return {
      age: t,
      creepCoefficient: phi,
      shrinkageStrain: 0, // Calculated separately
      effectiveModulus: Ec_eff,
      ageAdjustedModulus: Ec_adj
    };
  }

  /**
   * fib shrinkage
   */
  static fibShrinkage(
    t: number, // days from end of curing
    ts: number, // days - start of drying
    h0: number, // mm - notional size
    RH: number, // %
    fcm: number // MPa
  ): number {
    // Drying shrinkage
    const beta_RH = 1.55 * (1 - Math.pow(RH / 100, 3));
    const eps_cd0 = 0.85 * ((220 + 110 * 1) * Math.exp(-0.012 * fcm)) * 1e-6 * beta_RH;
    
    const beta_ds = (t - ts) / ((t - ts) + 0.035 * h0 * h0);
    const eps_cd = eps_cd0 * beta_ds;
    
    // Autogenous shrinkage
    const eps_ca_inf = 2.5 * (fcm - 10) * 1e-6;
    const eps_ca = eps_ca_inf * (1 - Math.exp(-0.2 * Math.sqrt(t)));
    
    // Total
    return eps_cd + eps_ca;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ConcreteMaterial,
  SteelMaterial,
  HystereticModels,
  FiberSection,
  TimeEffects
};
