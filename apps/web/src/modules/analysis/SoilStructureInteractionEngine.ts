/**
 * ============================================================================
 * SOIL-STRUCTURE INTERACTION ENGINE
 * ============================================================================
 * 
 * Comprehensive soil-structure interaction analysis:
 * - Foundation impedance functions
 * - Kinematic interaction effects
 * - Inertial interaction analysis
 * - Pile group interaction
 * - Soil spring models (Winkler)
 * - Deep foundation SSI
 * - Seismic SSI analysis
 * - Radiation damping
 * 
 * Reference Standards:
 * - ASCE 4-16 (Seismic Analysis of Safety-Related Nuclear)
 * - ASCE 7-22 Chapter 19 (Soil-Structure Interaction)
 * - ASCE 41-17 (Seismic Evaluation and Retrofit)
 * - FEMA P-2091 (SSI Guidelines)
 * - EN 1998-5 (Eurocode 8 Foundations)
 * - ATC-40 (Seismic Evaluation)
 * - NIST GCR 12-917-21 (SSI for Building Structures)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SoilProfile {
  layers: SoilLayer[];
  waterTable: number; // depth in meters
  bedrock: {
    depth: number; // m
    vs: number; // m/s - shear wave velocity
    density: number; // kg/m³
  } | null;
}

export interface SoilLayer {
  thickness: number; // m
  soilType: 'gravel' | 'sand' | 'silt' | 'clay' | 'rock';
  density: number; // kg/m³
  vs: number; // shear wave velocity m/s
  vp: number; // compression wave velocity m/s
  shearModulus: number; // MPa - G
  poissonRatio: number;
  damping: number; // material damping ratio
  plasticityIndex?: number; // for clays
  relativeDensity?: number; // for sands (%)
  undrainedShearStrength?: number; // kPa for clays
}

export interface FoundationGeometry {
  type: 'mat' | 'spread-footing' | 'pile-group' | 'caisson';
  length: number; // m (B)
  width: number; // m (L)
  embedment: number; // m (D)
  piles?: {
    count: number;
    diameter: number; // m
    length: number; // m
    spacing: number; // m
    arrangement: 'square' | 'rectangular' | 'circular';
  };
}

export interface ImpedanceFunction {
  frequency: number; // Hz
  horizontal: { stiffness: number; damping: number };
  vertical: { stiffness: number; damping: number };
  rocking: { stiffness: number; damping: number };
  torsion: { stiffness: number; damping: number };
  coupled?: { stiffness: number; damping: number }; // horizontal-rocking
}

export interface SSIResult {
  method: string;
  effectivePeriod: number; // sec
  effectiveDamping: number; // ratio
  baseShearReduction: number; // ratio
  foundationInput: {
    translationalRatio: number;
    rotationalRatio: number;
  };
  impedance: ImpedanceFunction;
  recommendations: string[];
}

// ============================================================================
// SOIL DYNAMIC PROPERTIES
// ============================================================================

export class SoilDynamicProperties {
  /**
   * Calculate shear modulus from shear wave velocity
   */
  static shearModulus(vs: number, density: number): number {
    // G = ρ × Vs²
    return density * vs * vs / 1e6; // MPa
  }

  /**
   * Calculate effective shear modulus considering strain level
   */
  static effectiveShearModulus(
    G0: number, // MPa - small strain modulus
    shearStrain: number, // decimal (e.g., 0.001 = 0.1%)
    soilType: 'sand' | 'clay',
    plasticityIndex: number = 0
  ): { G_Gmax: number; G_eff: number; damping: number } {
    // Seed & Idriss (1970) type curves
    let G_Gmax: number;
    let damping: number;
    
    if (soilType === 'sand') {
      // Sand modulus reduction (Seed & Idriss)
      const gamma_r = 0.0001; // Reference strain
      G_Gmax = 1 / (1 + (shearStrain / gamma_r));
      damping = 0.02 + 0.2 * (1 - G_Gmax);
    } else {
      // Clay modulus reduction (Vucetic & Dobry)
      const gamma_r = 0.0002 + 0.000015 * plasticityIndex;
      G_Gmax = 1 / (1 + Math.pow(shearStrain / gamma_r, 0.9));
      damping = 0.03 + 0.15 * (1 - G_Gmax);
    }
    
    return {
      G_Gmax,
      G_eff: G0 * G_Gmax,
      damping: Math.min(damping, 0.25)
    };
  }

  /**
   * Site period (fundamental period of soil column)
   */
  static sitePeriod(profile: SoilProfile): number {
    // T = 4H / Vs_avg
    const totalThickness = profile.layers.reduce((sum, l) => sum + l.thickness, 0);
    
    // Time-averaged Vs
    let travelTime = 0;
    for (const layer of profile.layers) {
      travelTime += layer.thickness / layer.vs;
    }
    
    const vs_avg = totalThickness / travelTime;
    return 4 * totalThickness / vs_avg;
  }

  /**
   * Equivalent uniform soil properties
   */
  static equivalentProperties(
    profile: SoilProfile,
    effectiveDepth: number // m
  ): { vs: number; G: number; density: number; nu: number } {
    let totalThickness = 0;
    let weightedVs = 0;
    let weightedDensity = 0;
    let weightedNu = 0;
    
    for (const layer of profile.layers) {
      if (totalThickness >= effectiveDepth) break;
      
      const layerContribution = Math.min(layer.thickness, effectiveDepth - totalThickness);
      weightedVs += layerContribution / layer.vs; // For harmonic average
      weightedDensity += layerContribution * layer.density;
      weightedNu += layerContribution * layer.poissonRatio;
      totalThickness += layerContribution;
    }
    
    const vs = totalThickness / weightedVs;
    const density = weightedDensity / totalThickness;
    const nu = weightedNu / totalThickness;
    
    return {
      vs,
      G: this.shearModulus(vs, density),
      density,
      nu
    };
  }

  /**
   * Soil class per ASCE 7
   */
  static siteClass(vs30: number): 'A' | 'B' | 'BC' | 'C' | 'CD' | 'D' | 'DE' | 'E' {
    if (vs30 >= 1524) return 'A';
    if (vs30 >= 762) return 'B';
    if (vs30 >= 488) return 'BC';
    if (vs30 >= 366) return 'C';
    if (vs30 >= 244) return 'CD';
    if (vs30 >= 183) return 'D';
    if (vs30 >= 107) return 'DE';
    return 'E';
  }
}

// ============================================================================
// FOUNDATION IMPEDANCE (Shallow Foundations)
// ============================================================================

export class FoundationImpedance {
  /**
   * Static stiffness for surface foundation on half-space
   * Gazetas (1991) formulations
   */
  static surfaceStiffness(
    L: number, // m - half-length (longer dimension)
    B: number, // m - half-width
    G: number, // MPa - shear modulus
    nu: number // Poisson's ratio
  ): {
    Kx: number; // horizontal along L (kN/m)
    Ky: number; // horizontal along B (kN/m)
    Kz: number; // vertical (kN/m)
    Krx: number; // rocking about L axis (kN·m/rad)
    Kry: number; // rocking about B axis (kN·m/rad)
    Kt: number; // torsion (kN·m/rad)
  } {
    const G_kN = G * 1000; // Convert to kN/m²
    const Ab = L * B; // Base area (quarter)
    const Ib_L = B * L * L * L / 3; // Moment of inertia about L axis
    const Ib_B = L * B * B * B / 3; // Moment of inertia about B axis
    
    // Aspect ratio
    const ratio = L / B;
    
    // Vertical stiffness
    const Kz = (G_kN * L / (1 - nu)) * (0.73 + 1.54 * Math.pow(B / L, 0.75));
    
    // Horizontal stiffness along L
    const Kx = (G_kN * L / (2 - nu)) * (2 + 2.5 * Math.pow(B / L, 0.85));
    
    // Horizontal stiffness along B
    const Ky = Kx - (G_kN * L / (0.75 - nu / 2)) * (0.1 * (1 - B / L));
    
    // Rocking stiffness about L axis
    const Krx = (G_kN * Ib_B / (1 - nu)) * (0.4 * ratio + 0.1);
    
    // Rocking stiffness about B axis
    const Kry = (G_kN * Ib_L / (1 - nu)) * (0.4 / ratio + 0.1);
    
    // Torsional stiffness
    const Kt = G_kN * Math.pow(B * L, 1.5) * (4 + 11 * (1 - Math.pow(B / L, 10)));

    return {
      Kx: Math.round(Kx),
      Ky: Math.round(Ky),
      Kz: Math.round(Kz),
      Krx: Math.round(Krx),
      Kry: Math.round(Kry),
      Kt: Math.round(Kt)
    };
  }

  /**
   * Embedment correction factors
   */
  static embedmentFactors(
    D: number, // embedment depth (m)
    B: number, // foundation half-width (m)
    L: number, // foundation half-length (m)
    h: number // wall height (m, typically = D)
  ): {
    etaX: number;
    etaY: number;
    etaZ: number;
    etaRx: number;
    etaRy: number;
    etaTorsion: number;
  } {
    const d = D; // embedment
    const Aw = 2 * (2 * L + 2 * B) * h; // Wall surface area
    
    // Vertical embedment factor
    const etaZ = 1 + (0.25 + 0.25 * B / L) * Math.pow(d / B, 0.8);
    
    // Horizontal embedment factors
    const etaX = 1 + (0.33 + 1.34 / (1 + Math.pow(L / B, 2))) * Math.pow(d / B, 0.8);
    const etaY = etaX;
    
    // Rocking embedment factors
    const etaRx = 1 + d / B * (1.6 + 3.5 * Math.pow(d / (B + L), 0.5));
    const etaRy = 1 + d / L * (1.6 + 3.5 * Math.pow(d / (B + L), 0.5));
    
    // Torsional embedment factor
    const etaTorsion = 1 + 2.5 * (d / B) * Math.pow(1 + B / L, -0.5);

    return {
      etaX: Math.min(etaX, 3.0),
      etaY: Math.min(etaY, 3.0),
      etaZ: Math.min(etaZ, 2.5),
      etaRx: Math.min(etaRx, 5.0),
      etaRy: Math.min(etaRy, 5.0),
      etaTorsion: Math.min(etaTorsion, 3.0)
    };
  }

  /**
   * Dynamic stiffness modification factors
   * Frequency-dependent stiffness reduction
   */
  static dynamicModificationFactors(
    frequency: number, // Hz
    B: number, // m
    L: number, // m
    vs: number // m/s - shear wave velocity
  ): {
    alphaX: number;
    alphaY: number;
    alphaZ: number;
    alphaRx: number;
    alphaRy: number;
  } {
    // Dimensionless frequency
    const a0_x = 2 * Math.PI * frequency * B / vs;
    const a0_z = 2 * Math.PI * frequency * Math.sqrt(B * L) / vs;
    
    // Vertical (approximately constant for low frequencies)
    const alphaZ = a0_z < 1.5 ? 1 - 0.2 * a0_z : 0.7;
    
    // Horizontal
    const alphaX = a0_x < 1.0 ? 1.0 : 1 - 0.15 * (a0_x - 1);
    const alphaY = alphaX;
    
    // Rocking (relatively insensitive to frequency)
    const alphaRx = 1.0;
    const alphaRy = 1.0;

    return {
      alphaX: Math.max(alphaX, 0.5),
      alphaY: Math.max(alphaY, 0.5),
      alphaZ: Math.max(alphaZ, 0.5),
      alphaRx,
      alphaRy
    };
  }

  /**
   * Radiation damping coefficients
   */
  static radiationDamping(
    frequency: number, // Hz
    B: number, // m
    L: number, // m
    G: number, // MPa
    nu: number,
    density: number, // kg/m³
    staticStiffness: ReturnType<typeof FoundationImpedance.surfaceStiffness>
  ): {
    Cx: number; // kN·s/m
    Cy: number;
    Cz: number;
    Crx: number; // kN·m·s/rad
    Cry: number;
    Ct: number;
  } {
    const omega = 2 * Math.PI * frequency;
    const vs = Math.sqrt(G * 1e6 / density);
    const vp = vs * Math.sqrt(2 * (1 - nu) / (1 - 2 * nu));
    const vLa = 3.4 * vs / (Math.PI * (1 - nu)); // Lysmer's analog velocity
    
    // Equivalent radius
    const r0_z = Math.sqrt(4 * B * L / Math.PI);
    const r0_x = Math.sqrt(4 * B * L / Math.PI);
    const r0_rx = Math.pow(4 * B * L * L * L / (3 * Math.PI), 0.25);
    const r0_ry = Math.pow(4 * L * B * B * B / (3 * Math.PI), 0.25);
    
    // Dimensionless frequency
    const a0 = omega * r0_z / vs;
    
    // Radiation damping ratios (Gazetas)
    const betaZ = 0.85 * Math.pow(a0, 0.25) / (Math.pow(a0, 2) + 1);
    const betaX = 0.576 * a0 / (Math.pow(a0, 2) + 1);
    const betaRx = 0.3 / (1 + Math.pow(a0, -2));
    const betaRy = 0.3 / (1 + Math.pow(a0, -2));
    
    // Convert to dashpot coefficients
    const Cz = 2 * betaZ * staticStiffness.Kz / omega;
    const Cx = 2 * betaX * staticStiffness.Kx / omega;
    const Cy = 2 * betaX * staticStiffness.Ky / omega;
    const Crx = 2 * betaRx * staticStiffness.Krx / omega;
    const Cry = 2 * betaRy * staticStiffness.Kry / omega;
    const Ct = 2 * 0.2 * staticStiffness.Kt / omega;

    return {
      Cx: Math.round(Cx),
      Cy: Math.round(Cy),
      Cz: Math.round(Cz),
      Crx: Math.round(Crx),
      Cry: Math.round(Cry),
      Ct: Math.round(Ct)
    };
  }

  /**
   * Complete impedance function at a given frequency
   */
  static impedanceFunction(
    frequency: number,
    foundation: FoundationGeometry,
    soilProps: { G: number; nu: number; vs: number; density: number; damping: number }
  ): ImpedanceFunction {
    const { G, nu, vs, density, damping } = soilProps;
    const L = foundation.length / 2;
    const B = foundation.width / 2;
    const D = foundation.embedment;
    
    // Static stiffness
    const staticK = this.surfaceStiffness(L, B, G, nu);
    
    // Embedment factors
    const embed = this.embedmentFactors(D, B, L, D);
    
    // Dynamic factors
    const dynamic = this.dynamicModificationFactors(frequency, B, L, vs);
    
    // Radiation damping
    const radiation = this.radiationDamping(frequency, B, L, G, nu, density, staticK);
    
    // Combine: K_dyn = K_static × embed × dynamic
    // Total damping = radiation + material
    const omega = 2 * Math.PI * frequency;
    
    const Kx_eff = staticK.Kx * embed.etaX * dynamic.alphaX;
    const Kz_eff = staticK.Kz * embed.etaZ * dynamic.alphaZ;
    const Krx_eff = staticK.Krx * embed.etaRx * dynamic.alphaRx;
    
    // Add material damping contribution
    const Cx_total = radiation.Cx + damping * 2 * Kx_eff / omega;
    const Cz_total = radiation.Cz + damping * 2 * Kz_eff / omega;
    const Crx_total = radiation.Crx + damping * 2 * Krx_eff / omega;

    return {
      frequency,
      horizontal: {
        stiffness: Math.round(Kx_eff),
        damping: Math.round(Cx_total)
      },
      vertical: {
        stiffness: Math.round(Kz_eff),
        damping: Math.round(Cz_total)
      },
      rocking: {
        stiffness: Math.round(Krx_eff),
        damping: Math.round(Crx_total)
      },
      torsion: {
        stiffness: Math.round(staticK.Kt * embed.etaTorsion),
        damping: Math.round(radiation.Ct)
      }
    };
  }
}

// ============================================================================
// PILE GROUP INTERACTION
// ============================================================================

export class PileGroupInteraction {
  /**
   * Single pile lateral stiffness (Poulos method)
   */
  static singlePileLateralStiffness(
    diameter: number, // m
    length: number, // m
    Ep: number, // MPa - pile modulus
    Es: number, // MPa - soil modulus (average)
    headFixity: 'free' | 'fixed'
  ): { stiffness: number; criticalLength: number } {
    const Ip = Math.PI * Math.pow(diameter, 4) / 64;
    
    // Characteristic length (Hetenyi)
    const k_es = Es / diameter; // Subgrade reaction (simplified)
    const lambda = Math.pow(k_es / (4 * Ep * Ip * 1e6), 0.25);
    const Lc = 1 / lambda;
    
    // Pile length factor
    const Lp_Lc = length / Lc;
    
    let stiffness: number;
    if (headFixity === 'fixed') {
      // Fixed head pile
      stiffness = Lp_Lc > 3 ? 
        2 * Ep * Ip * 1e6 * Math.pow(lambda, 3) :
        0.5 * Ep * Ip * 1e6 * Math.pow(lambda, 3) * Lp_Lc;
    } else {
      // Free head pile
      stiffness = Lp_Lc > 3 ?
        Ep * Ip * 1e6 * Math.pow(lambda, 3) :
        0.25 * Ep * Ip * 1e6 * Math.pow(lambda, 3) * Lp_Lc;
    }

    return {
      stiffness: stiffness / 1000, // kN/m
      criticalLength: Lc
    };
  }

  /**
   * Pile-to-pile interaction factors (Randolph & Poulos)
   */
  static interactionFactor(
    spacing: number, // m
    diameter: number, // m
    length: number, // m
    Es: number, // MPa - soil modulus
    Ep: number, // MPa - pile modulus
    loading: 'lateral' | 'axial'
  ): number {
    const s_d = spacing / diameter;
    const L_d = length / diameter;
    const Ep_Es = Ep / Es;
    
    if (loading === 'lateral') {
      // Lateral interaction (Poulos 1971)
      const alpha_L = 0.5 * Math.pow(diameter / spacing, 0.5) * 
                      Math.exp(-0.5 * Math.pow(spacing / length, 0.5));
      return Math.max(0, Math.min(alpha_L, 0.5));
    } else {
      // Axial interaction (Randolph & Wroth)
      const rm = 2.5 * length * (1 - 0.3) * Math.pow(Ep_Es, 0.25);
      const alpha_v = Math.log(rm / spacing) / Math.log(rm / (diameter / 2));
      return Math.max(0, Math.min(alpha_v, 0.5));
    }
  }

  /**
   * Group stiffness matrix
   */
  static groupStiffness(
    singlePileStiffness: { lateral: number; axial: number },
    pilePositions: { x: number; y: number }[], // m from centroid
    pileDiameter: number,
    pileLength: number,
    Es: number,
    Ep: number
  ): {
    Kx: number; // group lateral stiffness (kN/m)
    Ky: number;
    Kz: number; // group vertical stiffness (kN/m)
    Krx: number; // group rocking stiffness (kN·m/rad)
    Kry: number;
  } {
    const n = pilePositions.length;
    
    // Calculate interaction factors
    const alphaMatrix_lat: number[][] = [];
    const alphaMatrix_axial: number[][] = [];
    
    for (let i = 0; i < n; i++) {
      alphaMatrix_lat[i] = [];
      alphaMatrix_axial[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          alphaMatrix_lat[i][j] = 1;
          alphaMatrix_axial[i][j] = 1;
        } else {
          const dx = pilePositions[i].x - pilePositions[j].x;
          const dy = pilePositions[i].y - pilePositions[j].y;
          const spacing = Math.sqrt(dx * dx + dy * dy);
          
          alphaMatrix_lat[i][j] = this.interactionFactor(
            spacing, pileDiameter, pileLength, Es, Ep, 'lateral'
          );
          alphaMatrix_axial[i][j] = this.interactionFactor(
            spacing, pileDiameter, pileLength, Es, Ep, 'axial'
          );
        }
      }
    }
    
    // Group efficiency
    let sumAlpha_lat = 0;
    let sumAlpha_axial = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        sumAlpha_lat += alphaMatrix_lat[i][j];
        sumAlpha_axial += alphaMatrix_axial[i][j];
      }
    }
    
    const eta_lat = n / sumAlpha_lat;
    const eta_axial = n / sumAlpha_axial;
    
    // Group stiffness
    const Kx = singlePileStiffness.lateral * n * eta_lat;
    const Ky = Kx;
    const Kz = singlePileStiffness.axial * n * eta_axial;
    
    // Rocking stiffness from pile vertical stiffness
    let Ixx = 0, Iyy = 0;
    for (const pos of pilePositions) {
      Ixx += pos.y * pos.y;
      Iyy += pos.x * pos.x;
    }
    
    const Krx = singlePileStiffness.axial * Ixx * eta_axial;
    const Kry = singlePileStiffness.axial * Iyy * eta_axial;

    return {
      Kx: Math.round(Kx),
      Ky: Math.round(Ky),
      Kz: Math.round(Kz),
      Krx: Math.round(Krx),
      Kry: Math.round(Kry)
    };
  }
}

// ============================================================================
// SSI ANALYSIS (ASCE 7 & FEMA Methods)
// ============================================================================

export class SSIAnalysis {
  /**
   * Flexible base period per ASCE 7-22
   */
  static flexibleBasePeriod(
    fixedBasePeriod: number, // sec
    effectiveHeight: number, // m (from base to centroid of first mode)
    Kx: number, // lateral foundation stiffness (kN/m)
    Krocking: number, // rocking stiffness (kN·m/rad)
    effectiveWeight: number // kN (modal effective weight)
  ): number {
    const g = 9.81;
    const omega_fixed = 2 * Math.PI / fixedBasePeriod;
    
    // Structure stiffness from fixed-base period
    const Kstructure = effectiveWeight * Math.pow(omega_fixed, 2) / g;
    
    // Period lengthening
    // T̃/T = sqrt(1 + K/Kx + K·h²/Kθ)
    const T_ratio = Math.sqrt(
      1 + Kstructure / Kx + Kstructure * effectiveHeight * effectiveHeight / Krocking
    );

    return fixedBasePeriod * T_ratio;
  }

  /**
   * Foundation damping per ASCE 7-22
   */
  static foundationDamping(
    flexibleBasePeriod: number,
    fixedBasePeriod: number,
    radiationDampingRatio: number, // βf
    structuralDamping: number = 0.05
  ): number {
    // β̃ = β0 + βf / (T̃/T)³
    const T_ratio = flexibleBasePeriod / fixedBasePeriod;
    const effectiveDamping = structuralDamping + radiationDampingRatio / Math.pow(T_ratio, 3);
    
    // Limit per ASCE 7
    return Math.min(effectiveDamping, 0.20);
  }

  /**
   * Kinematic interaction transfer function
   * FEMA P-2091 / NIST GCR 12-917-21
   */
  static kinematicInteraction(
    frequency: number, // Hz
    foundationWidth: number, // m
    embedment: number, // m
    vs: number // m/s - shear wave velocity
  ): { translationalRatio: number; rotationalRatio: number } {
    const omega = 2 * Math.PI * frequency;
    const k_s = omega / vs; // shear wavenumber
    
    // Base slab averaging (Veletsos & Prasad)
    const a0 = omega * foundationWidth / vs;
    
    // Translational transfer function
    // H_u(ω) ≈ 1 for a0 < 1, reduces for higher frequencies
    const Hu = a0 < 0.5 ? 1.0 : Math.sin(0.5 * a0) / (0.5 * a0);
    
    // Rotational transfer function (from embedment)
    const Hphi = embedment > 0 ? Math.exp(-0.5 * k_s * embedment) : 1.0;
    
    return {
      translationalRatio: Math.max(Hu, 0.4),
      rotationalRatio: Math.max(Hphi * 0.9, 0.3)
    };
  }

  /**
   * Base shear reduction factor per ASCE 7-22 Section 19
   */
  static baseShearReduction(
    flexibleBasePeriod: number,
    fixedBasePeriod: number,
    effectiveDamping: number,
    spectralShape: 'constant-velocity' | 'constant-acceleration' | 'descending' = 'constant-velocity'
  ): number {
    const T_ratio = flexibleBasePeriod / fixedBasePeriod;
    const damping_ratio = effectiveDamping / 0.05;
    
    // Damping modification (B factor)
    const B = Math.pow(4 / (5.6 - Math.log(effectiveDamping * 100)), 0.5);
    
    let reduction: number;
    
    if (spectralShape === 'constant-acceleration') {
      // In constant acceleration region, no period benefit
      reduction = 1 / B;
    } else if (spectralShape === 'constant-velocity') {
      // In constant velocity region, Sa ∝ 1/T
      reduction = (1 / T_ratio) / B;
    } else {
      // In descending region, Sa ∝ 1/T²
      reduction = (1 / (T_ratio * T_ratio)) / B;
    }
    
    // ASCE 7 limits
    return Math.max(reduction, 0.7);
  }

  /**
   * Complete SSI analysis per ASCE 7-22
   */
  static performSSIAnalysis(
    structure: {
      fixedBasePeriod: number; // sec
      effectiveHeight: number; // m
      effectiveWeight: number; // kN
      structuralDamping: number;
      siteClass: 'A' | 'B' | 'BC' | 'C' | 'CD' | 'D' | 'DE' | 'E';
    },
    foundation: FoundationGeometry,
    soilProfile: SoilProfile
  ): SSIResult {
    // Get equivalent soil properties
    const effDepth = Math.min(30, 2 * (foundation.length + foundation.width));
    const soilProps = SoilDynamicProperties.equivalentProperties(soilProfile, effDepth);
    
    // Calculate impedance at structure frequency
    const structureFreq = 1 / structure.fixedBasePeriod;
    const impedance = FoundationImpedance.impedanceFunction(
      structureFreq, 
      foundation, 
      { ...soilProps, damping: 0.05 }
    );
    
    // Flexible base period
    const T_flex = this.flexibleBasePeriod(
      structure.fixedBasePeriod,
      structure.effectiveHeight,
      impedance.horizontal.stiffness,
      impedance.rocking.stiffness,
      structure.effectiveWeight
    );
    
    // Foundation damping (radiation + material)
    const omega = 2 * Math.PI / T_flex;
    const beta_rad_x = impedance.horizontal.damping * omega / (2 * impedance.horizontal.stiffness);
    const beta_rad_r = impedance.rocking.damping * omega / (2 * impedance.rocking.stiffness);
    const beta_foundation = (beta_rad_x + beta_rad_r) / 2;
    
    // Effective damping
    const beta_eff = this.foundationDamping(
      T_flex,
      structure.fixedBasePeriod,
      beta_foundation,
      structure.structuralDamping
    );
    
    // Base shear reduction
    const Vratio = this.baseShearReduction(
      T_flex,
      structure.fixedBasePeriod,
      beta_eff
    );
    
    // Kinematic interaction
    const kinematic = this.kinematicInteraction(
      structureFreq,
      foundation.width,
      foundation.embedment,
      soilProps.vs
    );

    return {
      method: 'ASCE 7-22 Section 19',
      effectivePeriod: Math.round(T_flex * 1000) / 1000,
      effectiveDamping: Math.round(beta_eff * 1000) / 1000,
      baseShearReduction: Math.round(Vratio * 100) / 100,
      foundationInput: kinematic,
      impedance,
      recommendations: [
        `Period lengthening: ${Math.round((T_flex / structure.fixedBasePeriod - 1) * 100)}%`,
        `Effective damping: ${Math.round(beta_eff * 100)}%`,
        `Base shear may be reduced to ${Math.round(Vratio * 100)}% of fixed-base value`,
        `Foundation translational input motion: ${Math.round(kinematic.translationalRatio * 100)}% of free-field`,
        'SSI effects are beneficial for this structure'
      ]
    };
  }
}

// ============================================================================
// WINKLER SPRING MODEL
// ============================================================================

export class WinklerSpringModel {
  /**
   * Subgrade modulus for mats per Vesic
   */
  static subgradeModulus(
    Es: number, // MPa - soil Young's modulus
    nu: number, // Poisson's ratio
    Ef: number, // MPa - foundation modulus
    B: number, // m - foundation width
    If: number // m⁴ - foundation moment of inertia
  ): number {
    // Vesic (1961)
    const k = (0.65 / (1 - nu * nu)) * Es * 1000 * 
              Math.pow((Es * B * B * B * B) / (Ef * If), 1/12) / B;
    return k; // kN/m³
  }

  /**
   * Subgrade modulus from plate load test
   */
  static subgradeFromPLT(
    k_plate: number, // kN/m³ from 300mm plate
    foundationWidth: number // m
  ): number {
    // Terzaghi correction for sandy soils
    const plateSize = 0.3; // 300mm plate
    const ratio = (foundationWidth + plateSize) / (2 * foundationWidth);
    return k_plate * ratio * ratio;
  }

  /**
   * Generate spring distribution for mat foundation
   */
  static matSpringDistribution(
    length: number, // m
    width: number, // m
    k_uniform: number, // kN/m³ - uniform subgrade modulus
    gridSpacing: number // m
  ): {
    position: { x: number; y: number };
    stiffness: number; // kN/m
  }[] {
    const springs: { position: { x: number; y: number }; stiffness: number }[] = [];
    
    const nx = Math.ceil(length / gridSpacing);
    const ny = Math.ceil(width / gridSpacing);
    const dx = length / nx;
    const dy = width / ny;
    
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= ny; j++) {
        const x = -length / 2 + i * dx;
        const y = -width / 2 + j * dy;
        
        // Tributary area
        let area = dx * dy;
        if (i === 0 || i === nx) area *= 0.5;
        if (j === 0 || j === ny) area *= 0.5;
        
        // Edge stiffening factor (optional)
        const edgeFactor = 1.0;
        
        springs.push({
          position: { x, y },
          stiffness: k_uniform * area * edgeFactor
        });
      }
    }

    return springs;
  }

  /**
   * P-Y curves for laterally loaded piles
   */
  static pyCurve(
    depth: number, // m
    soilType: 'soft-clay' | 'stiff-clay' | 'sand',
    soilProps: {
      undrained_shear?: number; // kPa for clay
      friction_angle?: number; // degrees for sand
      submerged_weight: number; // kN/m³
    },
    pileDiameter: number // m
  ): { y: number[]; p: number[] } {
    const D = pileDiameter;
    const y_values: number[] = [];
    const p_values: number[] = [];
    
    // Generate curve points
    for (let y = 0; y <= 0.2 * D; y += 0.005 * D) {
      y_values.push(y);
      
      let p: number;
      
      if (soilType === 'soft-clay') {
        // Matlock (1970)
        const Su = soilProps.undrained_shear || 25;
        const gamma = soilProps.submerged_weight;
        const Np = Math.min(3 + gamma * depth / Su + 0.5 * depth / D, 9);
        const pu = Np * Su * D;
        const y50 = 2.5 * 0.005 * D; // ε50 ≈ 0.005 to 0.02
        p = 0.5 * pu * Math.pow(y / y50, 1/3);
        
      } else if (soilType === 'stiff-clay') {
        // Reese (1975)
        const Su = soilProps.undrained_shear || 100;
        const pu = 9 * Su * D;
        const y50 = 0.007 * D;
        if (y < 0.6 * y50) {
          p = 0.5 * pu * Math.pow(y / y50, 0.5);
        } else {
          p = pu;
        }
        
      } else {
        // Sand - API (2000)
        const phi = (soilProps.friction_angle || 30) * Math.PI / 180;
        const gamma = soilProps.submerged_weight;
        const C1 = 1.5;
        const C2 = 2.5;
        const C3 = 30;
        const A = 3 - 0.8 * depth / D; // Cyclic
        const pu = Math.min(
          C1 * depth + C2 * D * gamma * depth,
          C3 * D * gamma * depth
        );
        const k = depth < D ? 5500 * depth / D : 5500;
        p = A * pu * Math.tanh(k * depth * y / (A * pu));
      }
      
      p_values.push(Math.min(p, 1e6));
    }

    return { y: y_values, p: p_values };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  SoilDynamicProperties,
  FoundationImpedance,
  PileGroupInteraction,
  SSIAnalysis,
  WinklerSpringModel
};
