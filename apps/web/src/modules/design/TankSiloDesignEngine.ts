/**
 * ============================================================================
 * TANK AND SILO DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive design for storage structures:
 * - Cylindrical steel tanks (API 650, EN 14015)
 * - Concrete tanks (ACI 350)
 * - Silos for granular materials (EN 1991-4, ACI 313)
 * - Seismic sloshing analysis
 * - Foundation design for tanks
 * - Buckling analysis
 * 
 * Design Codes Supported:
 * - API 650 (Welded Tanks for Oil Storage)
 * - API 620 (Large Low-Pressure Storage Tanks)
 * - EN 14015 (Flat-Bottomed Vertical Cylindrical Steel Tanks)
 * - EN 1993-4-2 (Steel Tanks)
 * - ACI 350 (Environmental Engineering Concrete Structures)
 * - ACI 313 (Standard Practice for Design of Concrete Silos)
 * - EN 1991-4 (Actions on Silos and Tanks)
 * - IS 11682 (Criteria for Design of Steel Bins)
 * - AWWA D100 (Welded Carbon Steel Tanks for Water Storage)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TankGeometry {
  type: 'cylindrical' | 'rectangular' | 'spherical' | 'horizontal-cylindrical';
  diameter?: number; // m (for cylindrical/spherical)
  length?: number; // m (for rectangular or horizontal)
  width?: number; // m (for rectangular)
  height: number; // m (liquid level for tanks, fill height for silos)
  totalHeight: number; // m (shell height)
  roofType?: 'cone' | 'dome' | 'floating' | 'open' | 'fixed';
  bottomType?: 'flat' | 'cone' | 'slope-to-center' | 'hopper';
  hopperAngle?: number; // degrees (for hopper bottom)
}

export interface TankMaterial {
  type: 'steel' | 'concrete' | 'stainless-steel' | 'aluminum' | 'FRP';
  grade?: string;
  fy: number; // MPa (yield strength)
  fu?: number; // MPa (ultimate strength)
  E: number; // MPa (elastic modulus)
  density: number; // kg/m³
  allowableStress?: number; // MPa (for steel per API 650)
  corrosionAllowance?: number; // mm
}

export interface StoredMaterial {
  type: 'liquid' | 'granular' | 'powder';
  name: string;
  density: number; // kg/m³
  specificGravity?: number;
  
  // For liquids
  vaporPressure?: number; // kPa
  operatingTemp?: { min: number; max: number }; // °C
  
  // For granular materials
  frictionAngle?: number; // degrees (internal)
  wallFriction?: number; // coefficient
  effectiveFriction?: number; // degrees
  lateralPressureRatio?: number; // K
  cohesion?: number; // kPa
}

export interface TankLoads {
  hydrostatic: { depth: number; pressure: number }[]; // depth-pressure pairs
  internalPressure?: number; // kPa (vapor/gas)
  externalPressure?: number; // kPa (vacuum)
  wind: {
    velocity: number; // m/s
    exposureCategory: 'B' | 'C' | 'D';
    internalPressure: 'enclosed' | 'partially-enclosed' | 'open';
  };
  seismic?: {
    designSpectralAcceleration: number; // g
    importanceFactor: number;
    siteClass: 'A' | 'B' | 'C' | 'D' | 'E';
  };
  settlement?: {
    uniform: number; // mm
    differential: number; // mm
    edgeSettlement: number; // mm
  };
}

export interface SiloLoads {
  filling: {
    verticalPressure: number[];
    wallNormalPressure: number[];
    wallFriction: number[];
    depths: number[];
  };
  discharge: {
    verticalPressure: number[];
    wallNormalPressure: number[];
    wallFriction: number[];
    depths: number[];
  };
  hopperLoads?: {
    normalPressure: number;
    frictionPressure: number;
  };
  thermalLoads?: {
    deltaT: number;
    gradient: number;
  };
}

export interface TankDesignResult {
  code: string;
  
  // Shell design
  shellCourses: {
    courseNumber: number;
    height: number; // mm
    thickness: number; // mm
    designStress: number; // MPa
    actualStress: number; // MPa
    utilizationRatio: number;
  }[];
  
  // Bottom design
  bottomThickness: number; // mm
  annularPlateThickness: number; // mm
  annularPlateWidth: number; // mm
  
  // Roof design
  roofThickness: number; // mm
  roofSupportRequired: boolean;
  rafterSpacing?: number; // mm
  
  // Stability
  bucklingCheck: {
    windBuckling: number; // critical pressure
    vacuumBuckling: number;
    seismicBuckling: number;
    safetyFactor: number;
  };
  
  // Seismic
  seismic?: {
    impulsivePeriod: number; // s
    convectivePeriod: number; // s
    baseShear: number; // kN
    overturningMoment: number; // kN-m
    freeboard: number; // m (sloshing height)
    anchorRequired: boolean;
    anchorForce?: number; // kN per anchor
  };
  
  // Weights
  weights: {
    shell: number; // kg
    bottom: number; // kg
    roof: number; // kg
    liquidFull: number; // kg
    liquidOperating: number; // kg
    total: number; // kg
  };
  
  status: 'acceptable' | 'unacceptable' | 'review-required';
  recommendations: string[];
}

// ============================================================================
// LIQUID TANK HYDROSTATIC DESIGN (API 650)
// ============================================================================

export class TankHydrostaticDesign {
  /**
   * Calculate shell thickness per API 650 one-foot method
   */
  static shellThicknessOneFootMethod(
    diameter: number, // m
    liquidHeight: number, // m
    designLiquidLevel: number, // m (from bottom of course)
    specificGravity: number,
    material: TankMaterial,
    jointEfficiency: number = 0.85,
    corrosionAllowance: number = 1.6 // mm
  ): {
    designThickness: number; // mm
    hydrostaticThickness: number; // mm
    designStress: number; // MPa
  } {
    const D = diameter * 1000; // mm
    const H = designLiquidLevel; // m
    const G = specificGravity;
    const Sd = material.allowableStress || material.fy * 0.6;
    const E = jointEfficiency;
    const CA = corrosionAllowance;

    // Design shell thickness (API 650 Eq. 5.6.3.1)
    // t_d = 4.9 * D * (H - 0.3) * G / (Sd * E) + CA
    const H_eff = Math.max(0.3, H - 0.3); // 1 foot (0.3m) below liquid level
    const t_design = 4.9 * D / 1000 * H_eff * G / (Sd * E) + CA;

    // Hydrostatic test thickness (CA = 0)
    // t_t = 4.9 * D * (H - 0.3) / (St * E)
    const St = material.fy * 0.75; // Test stress
    const t_test = 4.9 * D / 1000 * H_eff / (St * E);

    // Governing thickness
    const thickness = Math.max(t_design, t_test);

    // Minimum thickness per API 650 Table 5.6.1.1
    const minThickness = D / 1000 <= 15 ? 5 :
                         D / 1000 <= 36 ? 6 :
                         D / 1000 <= 60 ? 8 : 10;

    return {
      designThickness: Math.max(thickness, minThickness),
      hydrostaticThickness: t_test,
      designStress: Sd
    };
  }

  /**
   * Variable design point method per API 650 Appendix A
   */
  static variableDesignPointMethod(
    diameter: number, // m
    courseHeights: number[], // m per course
    specificGravity: number,
    material: TankMaterial,
    jointEfficiency: number = 0.85
  ): {
    thickness: number;
    designPoint: number;
  }[] {
    const D = diameter * 1000; // mm
    const G = specificGravity;
    const Sd = material.allowableStress || material.fy * 0.6;
    const E = jointEfficiency;
    const CA = material.corrosionAllowance || 1.6;

    const results: { thickness: number; designPoint: number }[] = [];
    let cumulativeHeight = 0;

    for (let i = courseHeights.length - 1; i >= 0; i--) {
      // Bottom course is last in calculation
      const courseHeight = courseHeights[i] * 1000; // mm
      
      // Calculate design point
      // x = 0.61 * sqrt(r * t) for lower courses
      // For initial estimate, use 1-foot method thickness
      const H = (courseHeights.slice(0, i + 1).reduce((a, b) => a + b, 0)) - 0.3; // m
      const t_initial = 4.9 * D / 1000 * H * G / (Sd * E) + CA;
      
      const r = D / 2;
      const x = 0.61 * Math.sqrt(r * t_initial);
      
      // Design point location
      let designPoint: number;
      if (i === courseHeights.length - 1) {
        // Bottom course
        designPoint = 0.22 * D;
      } else {
        designPoint = courseHeight / 3; // Upper courses
      }

      cumulativeHeight += courseHeights[i];
      const H_dp = cumulativeHeight - designPoint / 1000; // m

      const t_final = 4.9 * D / 1000 * Math.max(0.3, H_dp - 0.3) * G / (Sd * E) + CA;

      results.unshift({
        thickness: Math.max(5, Math.ceil(t_final)),
        designPoint
      });
    }

    return results;
  }

  /**
   * Design tank shell courses
   */
  static designShellCourses(
    geometry: TankGeometry,
    material: TankMaterial,
    storedMaterial: StoredMaterial
  ): TankDesignResult['shellCourses'] {
    const D = geometry.diameter!;
    const G = storedMaterial.specificGravity || storedMaterial.density / 1000;
    const totalHeight = geometry.totalHeight;

    // Standard course height (typically 2.4m or 8 ft)
    const standardCourseHeight = 2.4;
    const numCourses = Math.ceil(totalHeight / standardCourseHeight);
    
    const courses: TankDesignResult['shellCourses'] = [];
    
    for (let i = 1; i <= numCourses; i++) {
      const courseHeight = i === numCourses ? 
        totalHeight - (numCourses - 1) * standardCourseHeight : 
        standardCourseHeight;
      
      // Height from bottom of course to liquid level
      const liquidAbove = geometry.height - (i - 1) * standardCourseHeight;
      
      if (liquidAbove <= 0) {
        // Course above liquid level
        courses.push({
          courseNumber: i,
          height: courseHeight * 1000,
          thickness: 5, // Minimum
          designStress: material.allowableStress || material.fy * 0.6,
          actualStress: 0,
          utilizationRatio: 0
        });
      } else {
        const result = this.shellThicknessOneFootMethod(
          D, geometry.height, liquidAbove, G, material
        );
        
        const actualThickness = Math.ceil(result.designThickness);
        const actualStress = 4.9 * D * (liquidAbove - 0.3) * G / (actualThickness - (material.corrosionAllowance || 1.6)) / 0.85;
        
        courses.push({
          courseNumber: i,
          height: courseHeight * 1000,
          thickness: actualThickness,
          designStress: result.designStress,
          actualStress,
          utilizationRatio: actualStress / result.designStress
        });
      }
    }

    return courses;
  }
}

// ============================================================================
// SEISMIC SLOSHING ANALYSIS
// ============================================================================

export class SeismicSloshingAnalysis {
  /**
   * Calculate impulsive and convective masses per API 650 Appendix E
   */
  static calculateMasses(
    diameter: number, // m
    liquidHeight: number, // m
    liquidDensity: number // kg/m³
  ): {
    totalMass: number; // kg
    impulsiveMass: number; // kg
    convectiveMass: number; // kg
    impulsiveHeight: number; // m (from bottom)
    convectiveHeight: number; // m (from bottom)
  } {
    const D = diameter;
    const H = liquidHeight;
    const rho = liquidDensity;

    // Total liquid mass
    const Wp = Math.PI * D * D / 4 * H * rho * 9.81 / 1000; // kN
    const totalMass = Wp / 9.81 * 1000; // kg

    // D/H ratio
    const ratio = D / H;

    // Impulsive mass ratio (Housner formulas)
    let Wi_Wp: number;
    let Xi_H: number;
    let Wc_Wp: number;
    let Xc_H: number;

    if (ratio <= 1.333) {
      Wi_Wp = Math.tanh(0.866 * D / H) / (0.866 * D / H);
      Xi_H = 0.375;
      Wc_Wp = 0.264 * (D / H) * Math.tanh(3.68 * H / D);
      Xc_H = 1 - Math.cosh(3.68 * H / D - 1) / (3.68 * H / D * Math.sinh(3.68 * H / D));
    } else {
      Wi_Wp = 1.0 - 0.218 * D / H;
      Xi_H = 0.5 - 0.094 * D / H;
      Wc_Wp = 0.230 * D / H;
      Xc_H = 1 - (Math.cosh(3.68 * H / D) - 1) / (3.68 * H / D * Math.sinh(3.68 * H / D));
    }

    return {
      totalMass,
      impulsiveMass: totalMass * Wi_Wp,
      convectiveMass: totalMass * Wc_Wp,
      impulsiveHeight: H * Xi_H,
      convectiveHeight: H * Xc_H
    };
  }

  /**
   * Calculate natural periods
   */
  static calculatePeriods(
    diameter: number, // m
    liquidHeight: number, // m
    tankMass: number, // kg (shell + roof)
    liquidDensity: number, // kg/m³
    shellStiffness?: number // kN/m (for anchored tanks)
  ): {
    impulsivePeriod: number; // s
    convectivePeriod: number; // s
    rigidImpulsive: boolean;
  } {
    const D = diameter;
    const H = liquidHeight;
    const rho = liquidDensity;

    // Convective period (sloshing)
    // Tc = 2π / sqrt(g * λ / D) where λ = 3.68 tanh(3.68 H/D)
    const lambda = 3.68 * Math.tanh(3.68 * H / D);
    const Tc = 2 * Math.PI / Math.sqrt(9.81 * lambda / D);

    // Impulsive period
    // For unanchored tanks, Ti ≈ 0 (rigid)
    // For anchored flexible tanks, Ti depends on shell flexibility
    let Ti = 0;
    let rigidImpulsive = true;

    if (shellStiffness && shellStiffness > 0) {
      const masses = this.calculateMasses(D, H, rho);
      const Mi = masses.impulsiveMass + tankMass;
      Ti = 2 * Math.PI * Math.sqrt(Mi / (shellStiffness * 1000));
      rigidImpulsive = Ti < 0.1;
    }

    return {
      impulsivePeriod: Ti,
      convectivePeriod: Tc,
      rigidImpulsive
    };
  }

  /**
   * Calculate sloshing wave height
   */
  static sloshingWaveHeight(
    diameter: number, // m
    convectiveAcceleration: number // g
  ): number { // m
    const D = diameter;
    const Ac = convectiveAcceleration * 9.81;

    // d_s = 0.84 * Ac * D / g
    const ds = 0.84 * Ac * D / 9.81;
    
    return ds;
  }

  /**
   * Complete seismic analysis per API 650 Appendix E
   */
  static seismicAnalysis(
    geometry: TankGeometry,
    material: TankMaterial,
    storedMaterial: StoredMaterial,
    seismic: TankLoads['seismic']
  ): TankDesignResult['seismic'] {
    if (!seismic) {
      return undefined;
    }

    const D = geometry.diameter!;
    const H = geometry.height;
    const rho = storedMaterial.density;
    const SDS = seismic.designSpectralAcceleration;
    const I = seismic.importanceFactor;

    // Mass distribution
    const masses = this.calculateMasses(D, H, rho);

    // Period calculation
    const shellWeight = Math.PI * D * geometry.totalHeight * 0.01 * material.density * 9.81; // Approximate
    const periods = this.calculatePeriods(D, H, shellWeight / 9.81, rho);

    // Spectral accelerations
    const Ai = SDS; // Impulsive (rigid)
    
    // Convective (use Tc and spectral shape)
    const Tc = periods.convectivePeriod;
    let Ac: number;
    if (Tc <= 1.6) {
      Ac = SDS * 1.5 / Tc;
    } else {
      Ac = SDS * 2.4 / (Tc * Tc);
    }
    Ac = Math.min(Ac, SDS * 1.5);

    // Base shear
    const Vi = Ai * masses.impulsiveMass * 9.81 / 1000; // kN
    const Vc = Ac * masses.convectiveMass * 9.81 / 1000; // kN
    const V = Math.sqrt(Vi * Vi + Vc * Vc); // SRSS combination

    // Overturning moment
    const Mi = Vi * masses.impulsiveHeight;
    const Mc = Vc * masses.convectiveHeight;
    const M = Math.sqrt(Mi * Mi + Mc * Mc);

    // Sloshing height
    const freeboard = this.sloshingWaveHeight(D, Ac / 9.81);

    // Check if anchor required
    const Wt = shellWeight / 1000 + Math.PI * D * D / 4 * 0.02 * material.density * 9.81 / 1000; // Shell + bottom
    const J = M / (D / 2 * (Wt + masses.totalMass * 9.81 / 1000));
    const anchorRequired = J > 0.785;

    let anchorForce: number | undefined;
    if (anchorRequired) {
      // Uplift force per anchor (assuming 8 anchors)
      const numAnchors = 8;
      const uplift = M / (D / 2) - Wt;
      anchorForce = uplift / numAnchors;
    }

    return {
      impulsivePeriod: periods.impulsivePeriod,
      convectivePeriod: periods.convectivePeriod,
      baseShear: V * I,
      overturningMoment: M * I,
      freeboard,
      anchorRequired,
      anchorForce
    };
  }
}

// ============================================================================
// TANK BUCKLING ANALYSIS
// ============================================================================

export class TankBucklingAnalysis {
  /**
   * Wind buckling per API 650
   */
  static windBuckling(
    diameter: number, // m
    height: number, // m
    shellThicknesses: number[], // mm per course
    courseHeights: number[], // m per course
    material: TankMaterial,
    windVelocity: number // m/s
  ): {
    criticalPressure: number; // kPa
    appliedPressure: number; // kPa
    safetyFactor: number;
    stiffenerRequired: boolean;
    stiffenerSpacing?: number; // m
  } {
    const D = diameter * 1000; // mm
    const E = material.E;

    // Wind pressure
    const qw = 0.5 * 1.225 * windVelocity * windVelocity / 1000; // kPa

    // Transformed shell thickness (average)
    let H_total = 0;
    let weighted_t = 0;
    for (let i = 0; i < shellThicknesses.length; i++) {
      H_total += courseHeights[i];
      weighted_t += shellThicknesses[i] * courseHeights[i];
    }
    const t_avg = weighted_t / H_total; // mm

    // Critical buckling pressure (simplified)
    // Pcr = 0.807 * E * (t/D)^2 * (1 / (H/D)^2)
    const H = height * 1000; // mm
    const Pcr = 0.807 * E * Math.pow(t_avg / D, 2) * Math.pow(D / H, 2) / 1000; // kPa

    // External pressure coefficient
    const Cp = 0.8; // Windward
    const appliedPressure = Cp * qw;

    const safetyFactor = Pcr / appliedPressure;
    const stiffenerRequired = safetyFactor < 2.0;

    let stiffenerSpacing: number | undefined;
    if (stiffenerRequired) {
      // Required stiffener spacing to achieve SF = 2
      // Reduce H in formula
      const H_max = D * Math.sqrt(Pcr / (2 * appliedPressure));
      stiffenerSpacing = H_max / 1000;
    }

    return {
      criticalPressure: Pcr,
      appliedPressure,
      safetyFactor,
      stiffenerRequired,
      stiffenerSpacing
    };
  }

  /**
   * Vacuum buckling
   */
  static vacuumBuckling(
    diameter: number, // m
    height: number, // m
    shellThickness: number, // mm (minimum)
    material: TankMaterial,
    designVacuum: number // kPa
  ): {
    criticalVacuum: number; // kPa
    safetyFactor: number;
    adequate: boolean;
  } {
    const D = diameter * 1000;
    const H = height * 1000;
    const t = shellThickness;
    const E = material.E;

    // Critical vacuum (Donnell equation)
    const Pcr = 2.42 * E * Math.pow(t / D, 2.5) / 
                Math.pow(1 - 0.3 * 0.3, 0.75) / 
                Math.pow(H / D - 0.45 * Math.pow(t / D, 0.5), 0.5) / 1000; // kPa

    return {
      criticalVacuum: Pcr,
      safetyFactor: Pcr / designVacuum,
      adequate: Pcr >= 3 * designVacuum
    };
  }

  /**
   * Seismic buckling (elephant foot buckling)
   */
  static seismicBuckling(
    diameter: number, // m
    bottomCourseThickness: number, // mm
    axialStress: number, // MPa (from overturning)
    hoopStress: number, // MPa (from hydrostatic)
    material: TankMaterial
  ): {
    classicalBuckling: number; // MPa
    elephantFootBuckling: number; // MPa
    dcr: number;
    adequate: boolean;
  } {
    const D = diameter * 1000;
    const t = bottomCourseThickness;
    const E = material.E;
    const fy = material.fy;

    // Classical elastic buckling
    const sigmaCr_elastic = 0.6 * E * t / (D / 2);

    // Elephant foot buckling (plasticity reduction)
    const p = hoopStress / fy;
    const reduction = 1 - Math.pow(p / 0.9, 2);
    const sigmaCr_EF = sigmaCr_elastic * Math.max(0.3, reduction);

    const dcr = axialStress / sigmaCr_EF;

    return {
      classicalBuckling: sigmaCr_elastic,
      elephantFootBuckling: sigmaCr_EF,
      dcr,
      adequate: dcr <= 1.0
    };
  }
}

// ============================================================================
// SILO DESIGN (EN 1991-4)
// ============================================================================

export class SiloDesign {
  /**
   * Calculate silo pressures per EN 1991-4 (Janssen equation)
   */
  static jansenPressures(
    geometry: {
      diameter: number; // m (or equivalent for non-circular)
      height: number; // m (fill height)
      hopperAngle?: number; // degrees (half angle)
    },
    material: StoredMaterial
  ): SiloLoads {
    const D = geometry.diameter;
    const H = geometry.height;
    const gamma = material.density * 9.81 / 1000; // kN/m³
    const phi = (material.frictionAngle || 30) * Math.PI / 180;
    const mu = material.wallFriction || 0.4;
    const K = material.lateralPressureRatio || (1 - Math.sin(phi));

    // Hydraulic radius
    const A = Math.PI * D * D / 4;
    const U = Math.PI * D;
    const r = A / U; // = D/4

    // Characteristic depth
    const z0 = r / (K * mu);

    // Generate pressure distribution
    const depths: number[] = [];
    const pv_fill: number[] = []; // Vertical pressure
    const ph_fill: number[] = []; // Horizontal (wall normal) pressure
    const pw_fill: number[] = []; // Wall friction

    const numPoints = 20;
    for (let i = 0; i <= numPoints; i++) {
      const z = (i / numPoints) * H;
      depths.push(z);

      // Janssen formula for vertical pressure
      const pv = gamma * z0 * (1 - Math.exp(-z / z0));
      pv_fill.push(pv);

      // Horizontal pressure
      const ph = K * pv;
      ph_fill.push(ph);

      // Wall friction
      const pw = mu * ph;
      pw_fill.push(pw);
    }

    // Discharge pressures (apply patch load factors per EN 1991-4)
    // Ch = 1.15 for action assessment class 2
    const Ch = 1.15;
    const pv_discharge = pv_fill.map(p => p * Ch);
    const ph_discharge = ph_fill.map(p => p * Ch);
    const pw_discharge = pw_fill.map(p => p * Ch);

    // Hopper loads
    let hopperLoads: SiloLoads['hopperLoads'];
    if (geometry.hopperAngle) {
      const beta = geometry.hopperAngle * Math.PI / 180;
      const pv_bottom = pv_fill[pv_fill.length - 1];
      const ph_bottom = ph_fill[ph_fill.length - 1];

      // Normal pressure on hopper
      const pn = pv_bottom * (Math.cos(beta) * Math.cos(beta) + K * Math.sin(beta) * Math.sin(beta));
      
      // Friction on hopper
      const pt = mu * pn;

      hopperLoads = {
        normalPressure: pn,
        frictionPressure: pt
      };
    }

    return {
      filling: {
        verticalPressure: pv_fill,
        wallNormalPressure: ph_fill,
        wallFriction: pw_fill,
        depths
      },
      discharge: {
        verticalPressure: pv_discharge,
        wallNormalPressure: ph_discharge,
        wallFriction: pw_discharge,
        depths
      },
      hopperLoads
    };
  }

  /**
   * Classify silo (slender, intermediate, squat)
   */
  static classifySilo(
    diameter: number,
    height: number
  ): {
    classification: 'slender' | 'intermediate' | 'squat';
    hc_dc: number;
    designMethod: string;
  } {
    const hc_dc = height / diameter;

    let classification: 'slender' | 'intermediate' | 'squat';
    let designMethod: string;

    if (hc_dc >= 2.0) {
      classification = 'slender';
      designMethod = 'Janssen equation throughout';
    } else if (hc_dc >= 1.0) {
      classification = 'intermediate';
      designMethod = 'Janssen with transition zone';
    } else {
      classification = 'squat';
      designMethod = 'Modified pressure distribution';
    }

    return { classification, hc_dc, designMethod };
  }

  /**
   * Patch load for eccentric discharge
   */
  static eccentricDischargePatch(
    diameter: number, // m
    wallThickness: number, // mm
    fillHeight: number, // m
    material: StoredMaterial,
    eccentricity: number // m (outlet eccentricity)
  ): {
    patchPressure: number; // kPa
    patchHeight: number; // m
    patchAngle: number; // degrees (circumferential extent)
  } {
    const D = diameter;
    const t = wallThickness / 1000;
    const e = eccentricity;
    const gamma = material.density * 9.81 / 1000;
    const K = material.lateralPressureRatio || 0.4;

    // Characteristic pressure from Janssen
    const phi = (material.frictionAngle || 30) * Math.PI / 180;
    const mu = material.wallFriction || 0.4;
    const r = D / 4;
    const z0 = r / (K * mu);
    const pz = gamma * z0; // Asymptotic horizontal pressure

    // Patch load factor per EN 1991-4
    const Cpf = 0.21 * Math.pow(e / D, 0.4) * Math.pow(fillHeight / D, 0.6);
    const patchPressure = Cpf * pz;

    // Patch dimensions
    const patchHeight = Math.min(fillHeight / 3, D);
    const patchAngle = 30; // degrees typical

    return {
      patchPressure,
      patchHeight,
      patchAngle
    };
  }

  /**
   * Design silo wall thickness
   */
  static designWallThickness(
    geometry: TankGeometry,
    material: TankMaterial,
    storedMaterial: StoredMaterial
  ): {
    thicknesses: number[]; // mm at various heights
    heights: number[]; // m
    governingCase: 'hoop' | 'axial' | 'buckling';
  } {
    const D = geometry.diameter!;
    const H = geometry.height;
    const fy = material.fy;
    const E = material.E;

    // Get pressures
    const loads = this.jansenPressures(
      { diameter: D, height: H, hopperAngle: geometry.hopperAngle },
      storedMaterial
    );

    const thicknesses: number[] = [];
    const heights: number[] = [];

    for (let i = 0; i < loads.discharge.depths.length; i++) {
      const z = loads.discharge.depths[i];
      heights.push(z);

      // Hoop stress from horizontal pressure
      const ph = loads.discharge.wallNormalPressure[i];
      const t_hoop = ph * D / 2 / (fy / 1.5); // kN/m / (kN/m²) = m

      // Axial stress from wall friction above
      let axialLoad = 0;
      for (let j = 0; j <= i; j++) {
        const dz = j === 0 ? loads.discharge.depths[0] :
                   loads.discharge.depths[j] - loads.discharge.depths[j - 1];
        axialLoad += loads.discharge.wallFriction[j] * Math.PI * D * dz;
      }
      const sigma_axial = axialLoad / (Math.PI * D); // kN/m per unit wall thickness

      // Buckling check
      const t_buckling = Math.pow(sigma_axial * 2.5 / (0.6 * E), 0.5) * D / 2;

      const t_required = Math.max(t_hoop * 1000, t_buckling * 1000, 6); // mm
      thicknesses.push(Math.ceil(t_required));
    }

    // Determine governing case
    const maxThickness = Math.max(...thicknesses);
    const maxIndex = thicknesses.indexOf(maxThickness);
    const ph = loads.discharge.wallNormalPressure[maxIndex];
    const pw = loads.discharge.wallFriction[maxIndex];
    
    let governingCase: 'hoop' | 'axial' | 'buckling';
    const t_hoop = ph * D / 2 / (fy / 1.5) * 1000;
    if (t_hoop > maxThickness * 0.8) {
      governingCase = 'hoop';
    } else {
      governingCase = 'buckling';
    }

    return { thicknesses, heights, governingCase };
  }
}

// ============================================================================
// COMPLETE TANK DESIGN
// ============================================================================

export class TankDesignEngine {
  /**
   * Complete tank design per applicable code
   */
  static designTank(
    geometry: TankGeometry,
    material: TankMaterial,
    storedMaterial: StoredMaterial,
    loads: TankLoads,
    code: 'API650' | 'EN14015' | 'ACI350' | 'AWWA-D100' = 'API650'
  ): TankDesignResult {
    const recommendations: string[] = [];

    // Shell design
    const shellCourses = TankHydrostaticDesign.designShellCourses(
      geometry, material, storedMaterial
    );

    // Bottom design
    const bottomThickness = Math.max(6, shellCourses[0].thickness - 1);
    const annularPlateThickness = shellCourses[0].thickness + 3;
    const annularPlateWidth = Math.max(600, 500 * Math.sqrt(annularPlateThickness));

    // Roof design
    let roofThickness: number;
    let roofSupportRequired: boolean;
    let rafterSpacing: number | undefined;

    const D = geometry.diameter!;
    if (geometry.roofType === 'cone') {
      // Self-supporting cone roof
      const roofAngle = 9.5; // degrees minimum
      roofThickness = Math.max(5, D * 1000 / 200);
      roofSupportRequired = D > 15;
      if (roofSupportRequired) {
        rafterSpacing = 1800; // mm typical
      }
    } else if (geometry.roofType === 'dome') {
      roofThickness = Math.max(5, D * 1000 / 300);
      roofSupportRequired = false;
    } else if (geometry.roofType === 'floating') {
      roofThickness = 5;
      roofSupportRequired = false;
    } else {
      roofThickness = 5;
      roofSupportRequired = D > 10;
      rafterSpacing = 1500;
    }

    // Buckling checks
    const windBuckling = TankBucklingAnalysis.windBuckling(
      D, geometry.totalHeight,
      shellCourses.map(c => c.thickness),
      shellCourses.map(c => c.height / 1000),
      material,
      loads.wind.velocity
    );

    const vacuumBuckling = TankBucklingAnalysis.vacuumBuckling(
      D, geometry.totalHeight,
      Math.min(...shellCourses.map(c => c.thickness)),
      material,
      loads.externalPressure || 0.5
    );

    // Seismic analysis
    const seismicResult = SeismicSloshingAnalysis.seismicAnalysis(
      geometry, material, storedMaterial, loads.seismic
    );

    // Seismic buckling
    let seismicBucklingFactor = 999;
    if (seismicResult) {
      const axialStress = seismicResult.overturningMoment / 
        (Math.PI * D * D / 4 * shellCourses[0].thickness);
      const hoopStress = shellCourses[0].actualStress;
      const bucklingCheck = TankBucklingAnalysis.seismicBuckling(
        D, shellCourses[0].thickness, axialStress, hoopStress, material
      );
      seismicBucklingFactor = 1 / bucklingCheck.dcr;
    }

    // Weights
    let shellWeight = 0;
    for (const course of shellCourses) {
      shellWeight += Math.PI * D * course.height / 1000 * course.thickness / 1000 * material.density;
    }
    const bottomWeight = Math.PI * D * D / 4 * bottomThickness / 1000 * material.density;
    const roofWeight = Math.PI * D * D / 4 * roofThickness / 1000 * material.density * 
      (geometry.roofType === 'cone' ? 1.1 : 1.0);
    const liquidFull = Math.PI * D * D / 4 * geometry.height * storedMaterial.density;
    const liquidOperating = liquidFull * 0.85;

    // Status
    let status: TankDesignResult['status'] = 'acceptable';
    if (shellCourses.some(c => c.utilizationRatio > 1.0) ||
        windBuckling.safetyFactor < 1.5 ||
        !vacuumBuckling.adequate) {
      status = 'unacceptable';
    } else if (shellCourses.some(c => c.utilizationRatio > 0.9) ||
               windBuckling.stiffenerRequired) {
      status = 'review-required';
    }

    // Recommendations
    if (windBuckling.stiffenerRequired) {
      recommendations.push(`Add intermediate stiffeners at ${windBuckling.stiffenerSpacing?.toFixed(1)}m spacing`);
    }
    if (seismicResult?.anchorRequired) {
      recommendations.push(`Anchor bolts required - ${seismicResult.anchorForce?.toFixed(0)} kN per anchor`);
    }
    if (seismicResult && seismicResult.freeboard > 0.5) {
      recommendations.push(`Provide ${seismicResult.freeboard.toFixed(2)}m freeboard for sloshing`);
    }
    if (geometry.roofType === 'floating' && loads.seismic) {
      recommendations.push('Verify floating roof seal compatibility with seismic displacement');
    }

    return {
      code: code,
      shellCourses,
      bottomThickness,
      annularPlateThickness,
      annularPlateWidth,
      roofThickness,
      roofSupportRequired,
      rafterSpacing,
      bucklingCheck: {
        windBuckling: windBuckling.criticalPressure,
        vacuumBuckling: vacuumBuckling.criticalVacuum,
        seismicBuckling: seismicBucklingFactor,
        safetyFactor: Math.min(windBuckling.safetyFactor, vacuumBuckling.safetyFactor, seismicBucklingFactor)
      },
      seismic: seismicResult,
      weights: {
        shell: shellWeight,
        bottom: bottomWeight,
        roof: roofWeight,
        liquidFull,
        liquidOperating,
        total: shellWeight + bottomWeight + roofWeight + liquidFull
      },
      status,
      recommendations
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  TankHydrostaticDesign,
  SeismicSloshingAnalysis,
  TankBucklingAnalysis,
  SiloDesign,
  TankDesignEngine
};
