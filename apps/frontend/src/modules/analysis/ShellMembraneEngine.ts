/**
 * ============================================================================
 * SHELL AND MEMBRANE STRUCTURES ENGINE
 * ============================================================================
 * 
 * Advanced shell and membrane structural analysis:
 * - Thin shell theory (membrane + bending)
 * - Cylindrical shells
 * - Spherical domes
 * - Conical shells
 * - Hyperbolic paraboloids
 * - Folded plates
 * - Membrane stress analysis
 * - Buckling of shells
 * - Edge beam effects
 * 
 * Reference Standards:
 * - ACI 334.1R (Concrete Shell Roofs)
 * - IASS Recommendations (Shell Structures)
 * - EN 1993-1-6 (Shell Buckling)
 * - DIN 18800-4 (Steel Shell Stability)
 * - AS 4100 (Shell Buckling)
 * - API 650 (Tank Shell Design)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ShellGeometry {
  type: 'cylindrical' | 'spherical' | 'conical' | 'hyppar' | 'toroidal' | 'ellipsoidal';
  thickness: number; // mm
  dimensions: {
    radius?: number; // mm (for cylindrical, spherical)
    length?: number; // mm (for cylindrical)
    rise?: number; // mm (for domes)
    span?: number; // mm
    apex_angle?: number; // radians (for conical)
    edge_length?: number; // mm (for hyppar)
    curvature1?: number; // 1/mm (principal curvature 1)
    curvature2?: number; // 1/mm (principal curvature 2)
  };
}

export interface ShellMaterial {
  type: 'concrete' | 'steel' | 'aluminum' | 'GFRP';
  E: number; // MPa - Young's modulus
  nu: number; // Poisson's ratio
  fy?: number; // MPa - yield strength
  fc?: number; // MPa - concrete compressive strength
  density: number; // kg/m³
}

export interface ShellLoads {
  selfWeight: boolean;
  uniformPressure?: number; // kPa (positive = outward)
  internalPressure?: number; // kPa (tanks, silos)
  windPressure?: number; // kPa
  snow?: number; // kPa (projected area)
  temperature?: {
    deltaT: number; // °C - uniform temperature change
    gradient?: number; // °C/mm through thickness
  };
  concentrated?: {
    location: { x: number; y: number; z: number };
    force: { Fx: number; Fy: number; Fz: number };
  }[];
}

export interface MembraneStressResult {
  Nx: number; // N/mm - force per unit length in x
  Ny: number; // N/mm - force per unit length in y
  Nxy: number; // N/mm - shear force per unit length
  sigma_x: number; // MPa
  sigma_y: number; // MPa
  tau_xy: number; // MPa
  vonMises: number; // MPa
  principal: {
    sigma1: number; // MPa
    sigma2: number; // MPa
    angle: number; // radians
  };
}

export interface BendingStressResult {
  Mx: number; // N·mm/mm - moment per unit length about y
  My: number; // N·mm/mm - moment per unit length about x
  Mxy: number; // N·mm/mm - twisting moment
  Qx: number; // N/mm - transverse shear
  Qy: number; // N/mm - transverse shear
  bendingStress: {
    top: { sigma_x: number; sigma_y: number };
    bottom: { sigma_x: number; sigma_y: number };
  };
}

export interface ShellBucklingResult {
  criticalLoad: number; // N/mm or kPa
  knockdownFactor: number;
  designLoad: number; // N/mm or kPa
  bucklingMode: string;
  safetyFactor: number;
  classification: 'elastic' | 'elastic-plastic' | 'plastic';
}

// ============================================================================
// SHELL GEOMETRY UTILITIES
// ============================================================================

export class ShellGeometryUtils {
  /**
   * Gaussian curvature
   */
  static gaussianCurvature(k1: number, k2: number): number {
    return k1 * k2;
  }

  /**
   * Mean curvature
   */
  static meanCurvature(k1: number, k2: number): number {
    return (k1 + k2) / 2;
  }

  /**
   * Shell surface area - cylindrical
   */
  static cylindricalArea(radius: number, length: number, subtendedAngle: number): number {
    return radius * subtendedAngle * length; // mm²
  }

  /**
   * Shell surface area - spherical cap
   */
  static sphericalCapArea(radius: number, rise: number): number {
    return 2 * Math.PI * radius * rise; // mm²
  }

  /**
   * Shell classification by R/t ratio
   */
  static shellClassification(
    radius: number,
    thickness: number,
    code: 'EN1993-1-6' | 'API650' | 'general' = 'general'
  ): { classification: string; r_t: number; limits: string } {
    const r_t = radius / thickness;
    
    if (code === 'EN1993-1-6') {
      if (r_t < 50) {
        return { classification: 'Thick shell', r_t, limits: 'R/t < 50' };
      } else if (r_t < 250) {
        return { classification: 'Medium-length shell', r_t, limits: '50 ≤ R/t < 250' };
      } else if (r_t < 1000) {
        return { classification: 'Thin shell', r_t, limits: '250 ≤ R/t < 1000' };
      } else {
        return { classification: 'Very thin shell', r_t, limits: 'R/t ≥ 1000' };
      }
    } else {
      if (r_t < 20) {
        return { classification: 'Thick shell (use plate theory)', r_t, limits: 'R/t < 20' };
      } else if (r_t < 300) {
        return { classification: 'Moderately thin shell', r_t, limits: '20 ≤ R/t < 300' };
      } else {
        return { classification: 'Very thin shell (membrane dominant)', r_t, limits: 'R/t ≥ 300' };
      }
    }
  }

  /**
   * Characteristic length for shells
   */
  static characteristicLength(radius: number, thickness: number): number {
    // √(R·t) for cylindrical shells
    return Math.sqrt(radius * thickness);
  }

  /**
   * Bending boundary layer width
   */
  static boundaryLayerWidth(radius: number, thickness: number): number {
    // ~2.5√(R·t) where bending effects decay
    return 2.5 * Math.sqrt(radius * thickness);
  }
}

// ============================================================================
// CYLINDRICAL SHELL ANALYSIS
// ============================================================================

export class CylindricalShellAnalysis {
  /**
   * Membrane stresses under uniform internal pressure
   */
  static membraneStressPressure(
    radius: number, // mm
    thickness: number, // mm
    pressure: number // MPa
  ): MembraneStressResult {
    // Hoop stress (circumferential) - maximum
    const sigma_theta = pressure * radius / thickness;
    
    // Longitudinal stress (axial) - half of hoop
    const sigma_z = pressure * radius / (2 * thickness);
    
    // Membrane forces
    const N_theta = pressure * radius; // N/mm
    const N_z = pressure * radius / 2; // N/mm

    return {
      Nx: N_z,
      Ny: N_theta,
      Nxy: 0,
      sigma_x: sigma_z,
      sigma_y: sigma_theta,
      tau_xy: 0,
      vonMises: Math.sqrt(sigma_theta * sigma_theta - sigma_theta * sigma_z + sigma_z * sigma_z),
      principal: {
        sigma1: sigma_theta,
        sigma2: sigma_z,
        angle: Math.PI / 2 // Hoop is principal
      }
    };
  }

  /**
   * Stresses under axial load
   */
  static membraneStressAxial(
    radius: number, // mm
    thickness: number, // mm
    axialForce: number // N (total)
  ): MembraneStressResult {
    const circumference = 2 * Math.PI * radius;
    const N_z = axialForce / circumference; // N/mm
    const sigma_z = N_z / thickness;

    return {
      Nx: N_z,
      Ny: 0,
      Nxy: 0,
      sigma_x: sigma_z,
      sigma_y: 0,
      tau_xy: 0,
      vonMises: Math.abs(sigma_z),
      principal: {
        sigma1: Math.max(sigma_z, 0),
        sigma2: Math.min(sigma_z, 0),
        angle: 0
      }
    };
  }

  /**
   * Wind pressure distribution on cylinder (Cp distribution)
   */
  static windPressureDistribution(
    qz: number, // kPa - velocity pressure
    theta_values: number[] // angles from windward (radians)
  ): { theta: number; Cp: number; pressure: number }[] {
    // Typical Cp distribution for circular cylinder
    return theta_values.map(theta => {
      // Simplified pressure coefficient distribution
      let Cp: number;
      const deg = theta * 180 / Math.PI;
      
      if (deg <= 35) {
        Cp = 1 - 2.5 * Math.pow(deg / 35, 2);
      } else if (deg <= 90) {
        Cp = -0.5 - 1.0 * (deg - 35) / 55;
      } else if (deg <= 135) {
        Cp = -1.5 + 0.7 * (deg - 90) / 45;
      } else {
        Cp = -0.8;
      }

      return {
        theta,
        Cp,
        pressure: qz * Cp
      };
    });
  }

  /**
   * Edge disturbance (semi-infinite cylinder with edge moment/force)
   */
  static edgeDisturbance(
    radius: number, // mm
    thickness: number, // mm
    E: number, // MPa
    nu: number,
    edgeLoad: { M0?: number; H0?: number } // N·mm/mm, N/mm
  ): {
    decay: number;
    wavelength: number;
    maxBendingStress: number;
  } {
    const D = E * Math.pow(thickness, 3) / (12 * (1 - nu * nu)); // Bending rigidity
    const beta = Math.pow(3 * (1 - nu * nu) / (radius * radius * thickness * thickness), 0.25);
    
    const wavelength = Math.PI / beta; // mm
    const decay = 1 / beta; // Characteristic decay length
    
    // Maximum bending stress from edge moment
    let maxBending = 0;
    if (edgeLoad.M0) {
      maxBending = 6 * edgeLoad.M0 / (thickness * thickness);
    }
    if (edgeLoad.H0) {
      // Edge force creates bending
      const M_from_H = edgeLoad.H0 / (2 * beta);
      maxBending = Math.max(maxBending, 6 * M_from_H / (thickness * thickness));
    }

    return {
      decay,
      wavelength,
      maxBendingStress: maxBending
    };
  }

  /**
   * Buckling under axial compression (classical)
   */
  static axialBucklingClassical(
    radius: number, // mm
    thickness: number, // mm
    E: number, // MPa
    nu: number
  ): number {
    // Classical critical stress (Timoshenko)
    // σ_cr = E·t / (R·√(3(1-ν²)))
    return E * thickness / (radius * Math.sqrt(3 * (1 - nu * nu)));
  }

  /**
   * Buckling with knockdown factor per EN 1993-1-6
   */
  static axialBucklingDesign(
    radius: number, // mm
    length: number, // mm
    thickness: number, // mm
    E: number, // MPa
    fy: number, // MPa
    imperfectionClass: 'A' | 'B' | 'C' = 'B'
  ): ShellBucklingResult {
    const r_t = radius / thickness;
    const L_r = length / radius;
    
    // Classical critical stress
    const sigma_cr = 0.605 * E * thickness / radius;
    
    // Elastic imperfection factor (EN 1993-1-6)
    const Q: Record<string, number> = { 'A': 40, 'B': 25, 'C': 16 };
    const alpha_x = 0.62 / (1 + 1.91 * Math.pow(thickness / radius, 1.44));
    
    // Knockdown factor
    const kd = 1 / (1 + 1.8 * Math.pow(r_t / Q[imperfectionClass], 0.8));
    
    // Design critical stress
    const sigma_Rd = alpha_x * sigma_cr * kd;
    
    // Plasticity interaction
    const lambda = Math.sqrt(fy / sigma_Rd);
    let chi: number;
    if (lambda <= 0.2) {
      chi = 1.0;
    } else if (lambda < 1.0) {
      chi = 1 - 0.6 * (lambda - 0.2) / 0.8;
    } else {
      chi = 0.4 / (lambda * lambda);
    }
    
    const bucklingStrength = chi * fy;
    
    // Classification
    let classification: 'elastic' | 'elastic-plastic' | 'plastic';
    if (lambda > 1.0) classification = 'elastic';
    else if (lambda > 0.2) classification = 'elastic-plastic';
    else classification = 'plastic';

    return {
      criticalLoad: sigma_cr,
      knockdownFactor: kd * alpha_x,
      designLoad: bucklingStrength,
      bucklingMode: 'Axial compression',
      safetyFactor: bucklingStrength / sigma_Rd,
      classification
    };
  }

  /**
   * External pressure buckling
   */
  static externalPressureBuckling(
    radius: number, // mm
    length: number, // mm
    thickness: number, // mm
    E: number, // MPa
    nu: number
  ): ShellBucklingResult {
    // Windenburg approximation
    const L_D = length / (2 * radius);
    const t_D = thickness / (2 * radius);
    
    // Number of circumferential waves
    let n_opt = 2;
    let p_cr_min = Infinity;
    
    for (let n = 2; n <= 20; n++) {
      const term1 = (n * n - 1) / (n * n * (1 + Math.pow(Math.PI * 2 * radius / (n * length), 2)));
      const term2 = Math.pow(thickness / radius, 2) * 
                    (n * n * (1 + Math.pow(length / (Math.PI * 2 * radius), 2) / (n * n)) - 1);
      
      const p_cr = E * term1 / (12 * (1 - nu * nu)) * (term2 + 1);
      
      if (p_cr < p_cr_min) {
        p_cr_min = p_cr;
        n_opt = n;
      }
    }
    
    // Simplified formula for design
    const p_cr_design = 2.42 * E * Math.pow(t_D, 2.5) / 
                        (Math.pow(1 - nu * nu, 0.75) * Math.pow(L_D - 0.45 * Math.sqrt(t_D), 1));
    
    // Knockdown factor for external pressure
    const kd = 0.8;

    return {
      criticalLoad: p_cr_min,
      knockdownFactor: kd,
      designLoad: p_cr_design * kd,
      bucklingMode: `External pressure (n=${n_opt} waves)`,
      safetyFactor: 1.5,
      classification: 'elastic'
    };
  }
}

// ============================================================================
// SPHERICAL SHELL ANALYSIS
// ============================================================================

export class SphericalShellAnalysis {
  /**
   * Membrane stresses in spherical dome under self-weight
   */
  static membraneStressSelfWeight(
    radius: number, // mm
    thickness: number, // mm
    phi: number, // radians from apex
    weight: number // kN/m² (unit weight × thickness)
  ): MembraneStressResult {
    // Meridional stress (N_phi)
    const q = weight / 1e6; // Convert to N/mm²
    const N_phi = -q * radius / (1 + Math.cos(phi));
    
    // Hoop stress (N_theta)
    const N_theta = -q * radius * (Math.cos(phi) - 1 / (1 + Math.cos(phi)));
    
    // Stresses
    const sigma_phi = N_phi / thickness;
    const sigma_theta = N_theta / thickness;

    return {
      Nx: N_phi,
      Ny: N_theta,
      Nxy: 0,
      sigma_x: sigma_phi,
      sigma_y: sigma_theta,
      tau_xy: 0,
      vonMises: Math.sqrt(sigma_phi * sigma_phi - sigma_phi * sigma_theta + sigma_theta * sigma_theta),
      principal: {
        sigma1: Math.max(sigma_phi, sigma_theta),
        sigma2: Math.min(sigma_phi, sigma_theta),
        angle: sigma_phi > sigma_theta ? 0 : Math.PI / 2
      }
    };
  }

  /**
   * Membrane stresses under uniform pressure
   */
  static membraneStressPressure(
    radius: number, // mm
    thickness: number, // mm
    pressure: number // MPa (positive = outward)
  ): MembraneStressResult {
    // For sphere: σ = pR/(2t) in both directions
    const sigma = pressure * radius / (2 * thickness);
    const N = pressure * radius / 2;

    return {
      Nx: N,
      Ny: N,
      Nxy: 0,
      sigma_x: sigma,
      sigma_y: sigma,
      tau_xy: 0,
      vonMises: sigma, // Equal biaxial = sigma
      principal: {
        sigma1: sigma,
        sigma2: sigma,
        angle: 0
      }
    };
  }

  /**
   * Thrust at dome base (ring beam design)
   */
  static baseThrust(
    radius: number, // mm
    thickness: number, // mm
    phi_base: number, // radians (half-angle at base)
    totalLoad: number // kN - total vertical load on dome
  ): {
    horizontalThrust: number; // kN/m
    verticalReaction: number; // kN/m
    ringTension: number; // kN (total ring force)
  } {
    // Load per unit circumference
    const circumference = 2 * Math.PI * radius * Math.sin(phi_base);
    const q_vert = totalLoad * 1000 / circumference; // N/mm
    
    // Horizontal thrust = V × cot(φ)
    const H = q_vert * Math.cos(phi_base) / Math.sin(phi_base);
    
    // Ring tension = H × R_base
    const R_base = radius * Math.sin(phi_base);
    const ringTension = H * R_base / 1000; // kN

    return {
      horizontalThrust: H / 1000, // kN/mm → kN/m
      verticalReaction: q_vert / 1000,
      ringTension
    };
  }

  /**
   * Buckling of spherical shell under external pressure
   */
  static externalPressureBuckling(
    radius: number, // mm
    thickness: number, // mm
    E: number, // MPa
    nu: number
  ): ShellBucklingResult {
    // Classical Zoelly-Timoshenko formula
    const p_cr = 2 * E * (thickness / radius) * (thickness / radius) / Math.sqrt(3 * (1 - nu * nu));
    
    // Knockdown factor (very sensitive to imperfections)
    const kd = 0.15 + 0.1 * Math.log10(radius / thickness);
    
    // Design pressure
    const p_design = p_cr * kd;

    return {
      criticalLoad: p_cr,
      knockdownFactor: kd,
      designLoad: p_design,
      bucklingMode: 'External pressure (spherical)',
      safetyFactor: 3.0, // Typically high for spheres
      classification: 'elastic'
    };
  }

  /**
   * Design of spherical dome per ACI 334.1R
   */
  static domeDesignACI(
    span: number, // mm
    rise: number, // mm
    thickness: number, // mm
    fc: number, // MPa
    deadLoad: number, // kPa
    liveLoad: number // kPa
  ): {
    radius: number;
    maxMeridionalStress: number;
    maxHoopStress: number;
    buckling: ShellBucklingResult;
    minimumThickness: number;
    utilization: number;
  } {
    // Radius from span and rise
    const radius = (span * span / 4 + rise * rise) / (2 * rise);
    const phi_base = Math.asin(span / (2 * radius));
    
    // Load
    const totalLoad = (deadLoad + liveLoad) * Math.PI * (span / 2) * (span / 2) / 1e6; // kN
    
    // Stresses at base (worst case for hoop)
    const stressBase = this.membraneStressSelfWeight(
      radius, thickness, phi_base,
      (deadLoad + liveLoad) * thickness / 1000
    );
    
    // Stresses at apex (uniform for pressure load)
    const stressApex = this.membraneStressPressure(
      radius, thickness,
      (deadLoad + liveLoad) / 1000
    );
    
    // Buckling check
    const E_c = 4700 * Math.sqrt(fc);
    const buckling = this.externalPressureBuckling(radius, thickness, E_c, 0.2);
    
    // Minimum thickness per ACI 334.1R
    const t_min = Math.max(75, radius / 400);
    
    // Allowable stress
    const f_allow = 0.4 * fc; // ACI 334.1R
    
    // Utilization
    const utilization = Math.max(
      Math.abs(stressBase.sigma_x) / f_allow,
      Math.abs(stressBase.sigma_y) / f_allow,
      (deadLoad + liveLoad) / buckling.designLoad
    );

    return {
      radius,
      maxMeridionalStress: stressBase.sigma_x,
      maxHoopStress: stressBase.sigma_y,
      buckling,
      minimumThickness: t_min,
      utilization
    };
  }
}

// ============================================================================
// CONICAL SHELL ANALYSIS
// ============================================================================

export class ConicalShellAnalysis {
  /**
   * Membrane stresses under self-weight
   */
  static membraneStressSelfWeight(
    s: number, // mm - slant distance from apex
    alpha: number, // radians - half apex angle
    thickness: number, // mm
    weight: number // kN/m² - surface load
  ): MembraneStressResult {
    const q = weight / 1e6; // N/mm²
    const R = s * Math.sin(alpha); // Local radius
    
    // Meridional force
    const N_s = -q * s / 2;
    
    // Hoop force
    const N_theta = -q * s * Math.cos(alpha) * Math.cos(alpha) / Math.sin(alpha);
    
    const sigma_s = N_s / thickness;
    const sigma_theta = N_theta / thickness;

    return {
      Nx: N_s,
      Ny: N_theta,
      Nxy: 0,
      sigma_x: sigma_s,
      sigma_y: sigma_theta,
      tau_xy: 0,
      vonMises: Math.sqrt(sigma_s * sigma_s - sigma_s * sigma_theta + sigma_theta * sigma_theta),
      principal: {
        sigma1: Math.max(sigma_s, sigma_theta),
        sigma2: Math.min(sigma_s, sigma_theta),
        angle: 0
      }
    };
  }

  /**
   * Stresses under hydrostatic pressure (hoppers, bunkers)
   */
  static hydrostaticStress(
    depth: number, // mm - vertical depth from surface
    alpha: number, // radians - half apex angle
    thickness: number, // mm
    gamma: number // kN/m³ - unit weight of material
  ): MembraneStressResult {
    const g = gamma / 1e9; // N/mm³
    const p = g * depth; // Pressure
    
    // Local radius
    const R = depth * Math.tan(alpha);
    
    // Meridional and hoop stresses
    const sigma_s = p * R / (2 * thickness * Math.sin(alpha));
    const sigma_theta = p * R / (thickness * Math.sin(alpha));

    return {
      Nx: sigma_s * thickness,
      Ny: sigma_theta * thickness,
      Nxy: 0,
      sigma_x: sigma_s,
      sigma_y: sigma_theta,
      tau_xy: 0,
      vonMises: Math.sqrt(sigma_s * sigma_s - sigma_s * sigma_theta + sigma_theta * sigma_theta),
      principal: {
        sigma1: sigma_theta,
        sigma2: sigma_s,
        angle: Math.PI / 2
      }
    };
  }
}

// ============================================================================
// HYPERBOLIC PARABOLOID (HYPPAR) ANALYSIS
// ============================================================================

export class HyperboloidParaboloidAnalysis {
  /**
   * Curvatures for hyppar
   */
  static curvatures(
    a: number, // mm - half length along x
    b: number, // mm - half length along y  
    c: number // mm - rise (z = c·xy/(a·b))
  ): { k1: number; k2: number; twist: number } {
    // For z = c·xy/(a·b), the twist is constant
    const twist = c / (a * b);
    
    // Principal curvatures (at corners)
    const k1 = twist;
    const k2 = -twist;

    return { k1, k2, twist };
  }

  /**
   * Membrane stresses under uniform load
   */
  static membraneStressUniform(
    a: number, // mm
    b: number, // mm
    c: number, // mm - rise
    thickness: number, // mm
    load: number // kPa - uniform vertical load
  ): MembraneStressResult {
    const q = load / 1e6; // N/mm²
    
    // For hyppar: N_xy = q·a·b / (2·c)
    const N_xy = q * a * b / (2 * c);
    const tau_xy = N_xy / thickness;
    
    // N_x and N_y are zero for pure uniform load on hyppar
    const N_x = 0;
    const N_y = 0;

    return {
      Nx: N_x,
      Ny: N_y,
      Nxy: N_xy,
      sigma_x: 0,
      sigma_y: 0,
      tau_xy,
      vonMises: tau_xy * Math.sqrt(3), // Pure shear
      principal: {
        sigma1: tau_xy,
        sigma2: -tau_xy,
        angle: Math.PI / 4 // 45° to edges
      }
    };
  }

  /**
   * Edge beam forces
   */
  static edgeBeamForces(
    a: number, // mm
    b: number, // mm
    c: number, // mm
    load: number // kPa
  ): {
    compressionEdge: number; // N/mm
    tensionEdge: number; // N/mm
    maxEdgeForce: number; // N
  } {
    const q = load / 1e6; // N/mm²
    
    // Shear flow from membrane
    const N_xy = q * a * b / (2 * c);
    
    // Edge beam forces (compression and tension diagonals)
    const diagonal = Math.sqrt(a * a + b * b);
    const maxEdgeForce = N_xy * diagonal;

    return {
      compressionEdge: N_xy,
      tensionEdge: N_xy,
      maxEdgeForce
    };
  }
}

// ============================================================================
// FOLDED PLATE ANALYSIS
// ============================================================================

export class FoldedPlateAnalysis {
  /**
   * Stresses in prismatic folded plate
   */
  static prismFoldedPlate(
    span: number, // mm - longitudinal span
    width: number, // mm - width of each plate
    angle: number, // radians - angle from horizontal
    thickness: number, // mm
    load: number // kPa
  ): {
    transverseBending: number; // MPa
    longitudinalMembrane: number; // MPa
    ridgeMoment: number; // N·mm/mm
  } {
    const q = load / 1e6; // N/mm²
    
    // Transverse (plate) bending
    const h = width * Math.sin(angle);
    const w_trans = q * width;
    const M_trans = w_trans * width * width / 8;
    const sigma_trans = 6 * M_trans / (thickness * thickness);
    
    // Longitudinal (beam) action
    const I_fold = thickness * Math.pow(h, 3) / 12; // Approx
    const M_long = q * width * span * span / 8;
    const sigma_long = M_long * h / (2 * I_fold);
    
    // Ridge moment (compatibility)
    const M_ridge = q * width * width / 12;

    return {
      transverseBending: sigma_trans,
      longitudinalMembrane: sigma_long,
      ridgeMoment: M_ridge
    };
  }

  /**
   * V-shaped folded plate analysis
   */
  static vFoldedPlate(
    span: number, // mm
    halfWidth: number, // mm
    depth: number, // mm (vertical depth at center)
    thickness: number, // mm
    load: number // kPa
  ): {
    valleyTension: number; // N/mm
    ridgeCompression: number; // N/mm
    maxStress: number; // MPa
  } {
    const q = load / 1e6; // N/mm²
    const alpha = Math.atan(depth / halfWidth);
    const plateWidth = Math.sqrt(halfWidth * halfWidth + depth * depth);
    
    // Membrane forces
    const N_ridge = -q * span * halfWidth / (8 * depth);
    const N_valley = q * span * halfWidth / (8 * depth);
    
    const maxStress = Math.max(Math.abs(N_ridge), N_valley) / thickness;

    return {
      valleyTension: N_valley,
      ridgeCompression: N_ridge,
      maxStress
    };
  }
}

// ============================================================================
// SHELL DESIGN ENGINE
// ============================================================================

export class ShellDesignEngine {
  /**
   * Complete shell analysis
   */
  static analyzeShell(
    geometry: ShellGeometry,
    material: ShellMaterial,
    loads: ShellLoads
  ): {
    membraneStress: MembraneStressResult;
    buckling?: ShellBucklingResult;
    classification: ReturnType<typeof ShellGeometryUtils.shellClassification>;
    utilization: number;
    recommendations: string[];
  } {
    const { type, thickness, dimensions } = geometry;
    const { E, nu, fy, density } = material;
    
    let membraneStress: MembraneStressResult;
    let buckling: ShellBucklingResult | undefined;
    
    // Self-weight load
    const selfWeight = loads.selfWeight ? density * 9.81 * thickness / 1e6 : 0; // kPa
    const totalLoad = selfWeight + (loads.uniformPressure || 0);
    
    if (type === 'cylindrical') {
      const radius = dimensions.radius!;
      const length = dimensions.length!;
      
      membraneStress = CylindricalShellAnalysis.membraneStressPressure(
        radius, thickness, totalLoad / 1000
      );
      
      if (fy) {
        buckling = CylindricalShellAnalysis.axialBucklingDesign(
          radius, length, thickness, E, fy
        );
      }
    } else if (type === 'spherical') {
      const radius = dimensions.radius!;
      const phi = dimensions.rise ? Math.asin(dimensions.span! / (2 * radius)) : Math.PI / 4;
      
      membraneStress = SphericalShellAnalysis.membraneStressSelfWeight(
        radius, thickness, phi, totalLoad
      );
      
      buckling = SphericalShellAnalysis.externalPressureBuckling(
        radius, thickness, E, nu
      );
    } else if (type === 'hyppar') {
      const a = dimensions.edge_length! / 2;
      const b = dimensions.edge_length! / 2;
      const c = dimensions.rise!;
      
      membraneStress = HyperboloidParaboloidAnalysis.membraneStressUniform(
        a, b, c, thickness, totalLoad
      );
    } else {
      // Default to simple pressure vessel
      const radius = dimensions.radius || 5000;
      membraneStress = CylindricalShellAnalysis.membraneStressPressure(
        radius, thickness, totalLoad / 1000
      );
    }
    
    // Classification
    const radius = dimensions.radius || dimensions.span! / 2;
    const classification = ShellGeometryUtils.shellClassification(radius, thickness);
    
    // Utilization
    const allowable = fy ? 0.6 * fy : 0.4 * (material.fc || 30);
    const utilization = membraneStress.vonMises / allowable;
    
    // Recommendations
    const recommendations: string[] = [];
    if (utilization > 1.0) {
      recommendations.push('Increase shell thickness');
    }
    if (classification.classification.includes('Very thin')) {
      recommendations.push('Shell is imperfection-sensitive - consider stiffeners');
    }
    if (buckling && membraneStress.vonMises > buckling.designLoad * 0.5) {
      recommendations.push('Buckling governs design - add ring stiffeners');
    }
    recommendations.push(`Shell classification: ${classification.classification}`);

    return {
      membraneStress,
      buckling,
      classification,
      utilization,
      recommendations
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ShellGeometryUtils,
  CylindricalShellAnalysis,
  SphericalShellAnalysis,
  ConicalShellAnalysis,
  HyperboloidParaboloidAnalysis,
  FoldedPlateAnalysis,
  ShellDesignEngine
};
