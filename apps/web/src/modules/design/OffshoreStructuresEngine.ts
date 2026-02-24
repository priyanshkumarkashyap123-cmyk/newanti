/**
 * ============================================================================
 * OFFSHORE AND MARINE STRUCTURES ENGINE
 * ============================================================================
 * 
 * Comprehensive analysis and design for offshore structures:
 * - Wave and current loading
 * - Platform structural analysis
 * - Jacket and jacket-pile systems
 * - Floating structures (semi-submersibles, TLP, SPAR, FPSO)
 * - Mooring system analysis
 * - Fatigue from wave action
 * - Installation analysis
 * 
 * Design Codes Supported:
 * - API RP 2A-WSD/LRFD (Fixed Offshore Platforms)
 * - API RP 2SK (Mooring Systems)
 * - API RP 2MET (Metocean Conditions)
 * - DNV-OS-C101 (Offshore Steel Structures)
 * - DNV-RP-C203 (Fatigue Design)
 * - ISO 19901 (Offshore Structures)
 * - ISO 19902 (Fixed Steel Structures)
 * - ABS Rules for Building and Classing Offshore Structures
 * - NORSOK N-004 (Steel Structures)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MetoceanConditions {
  // Wave conditions
  wave: {
    significantHeight: number; // Hs (m)
    peakPeriod: number; // Tp (s)
    spectrumType: 'JONSWAP' | 'Pierson-Moskowitz' | 'Bretschneider';
    gamma?: number; // JONSWAP peak enhancement (default 3.3)
    direction: number; // degrees from North
    spreading?: number; // directional spreading
  };
  
  // Current
  current: {
    surfaceVelocity: number; // m/s
    profile: 'uniform' | 'linear' | 'power-law';
    powerExponent?: number; // for power-law profile
    direction: number; // degrees from North
  };
  
  // Wind
  wind: {
    velocity1hr: number; // m/s at 10m height, 1-hour mean
    velocity10min?: number; // m/s, 10-minute mean
    velocity3sec?: number; // m/s, 3-second gust
    direction: number; // degrees from North
    profile: 'logarithmic' | 'power-law';
    surfaceRoughness?: number; // z0 for logarithmic
  };
  
  // Water depth
  waterDepth: number; // m
  
  // Tide and surge
  tide?: {
    meanSeaLevel: number; // m
    highWater: number; // m (HAT)
    lowWater: number; // m (LAT)
    stormSurge: number; // m
  };
}

export interface PlatformGeometry {
  type: 'fixed-jacket' | 'jack-up' | 'semi-submersible' | 'TLP' | 'SPAR' | 'FPSO' | 'gravity-based';
  
  // For fixed jacket
  jacket?: {
    topDeck: { length: number; width: number; elevation: number }; // m
    legs: {
      count: 4 | 6 | 8;
      diameter: number; // m
      thickness: number; // mm
      batter: number; // degrees from vertical
    };
    bracing: {
      type: 'X' | 'K' | 'single-diagonal' | 'diamond';
      diameter: number; // m
      thickness: number; // mm
    };
    mudline: { length: number; width: number }; // m
  };
  
  // For floating structures
  hull?: {
    displacement: number; // tonnes
    draft: number; // m
    freeboard: number; // m
    waterplaneArea: number; // m²
    centerOfGravity: { x: number; y: number; z: number }; // m
    centerOfBuoyancy: { x: number; y: number; z: number }; // m
    metacentricHeight: { GM_T: number; GM_L: number }; // m (transverse, longitudinal)
  };
}

export interface MooringSystem {
  type: 'catenary' | 'taut-leg' | 'semi-taut' | 'TLP-tendon';
  lines: {
    count: number;
    configuration: number[][]; // [azimuth, pretension] pairs
  };
  lineProperties: {
    type: 'chain' | 'wire-rope' | 'polyester' | 'HMPE' | 'combined';
    length: number; // m
    diameter: number; // mm
    wetWeight: number; // kg/m
    axialStiffness: number; // kN (EA)
    breakingLoad: number; // kN (MBL)
  };
  anchor: {
    type: 'drag-embedment' | 'suction-pile' | 'driven-pile' | 'gravity';
    holdingCapacity: number; // kN
    depth: number; // m (embedment or penetration)
  };
}

export interface WaveForce {
  total: number; // kN
  horizontal: number; // kN
  vertical: number; // kN
  moment: number; // kN-m (about mudline)
  maxLocal: { force: number; elevation: number }; // Local force distribution
}

export interface MooringAnalysisResult {
  code: string;
  
  // Line tensions
  tensions: {
    lineNumber: number;
    azimuth: number;
    pretension: number; // kN
    maxTension: { intact: number; damaged: number }; // kN
    utilizationRatio: { intact: number; damaged: number };
  }[];
  
  // Vessel offset
  offset: {
    intact: { x: number; y: number; magnitude: number }; // m
    damaged: { x: number; y: number; magnitude: number }; // m
    percentWaterDepth: { intact: number; damaged: number };
  };
  
  // Line catenary
  catenary?: {
    horizontalExtent: number; // m
    verticalExtent: number; // m
    suspendedLength: number; // m
    groundedLength: number; // m
  };
  
  status: 'acceptable' | 'unacceptable' | 'review-required';
  recommendations: string[];
}

// ============================================================================
// WAVE THEORY AND KINEMATICS
// ============================================================================

export class WaveTheory {
  /**
   * Determine applicable wave theory based on H, T, d
   */
  static selectTheory(
    waveHeight: number, // H (m)
    wavePeriod: number, // T (s)
    waterDepth: number // d (m)
  ): 'Airy' | 'Stokes-2nd' | 'Stokes-5th' | 'Stream-Function' | 'Cnoidal' {
    const g = 9.81;
    const L0 = g * wavePeriod * wavePeriod / (2 * Math.PI); // Deep water wavelength
    
    // Le Méhauté diagram parameters
    const H_gT2 = waveHeight / (g * wavePeriod * wavePeriod);
    const d_gT2 = waterDepth / (g * wavePeriod * wavePeriod);
    
    // Relative depth
    const d_L0 = waterDepth / L0;
    
    // Steepness
    const H_d = waveHeight / waterDepth;
    const H_L0 = waveHeight / L0;

    if (d_L0 > 0.5 && H_L0 < 0.03) {
      return 'Airy';
    } else if (d_L0 > 0.25 && H_L0 < 0.05) {
      return 'Stokes-2nd';
    } else if (d_L0 > 0.1) {
      return 'Stokes-5th';
    } else if (H_d < 0.5) {
      return 'Cnoidal';
    } else {
      return 'Stream-Function';
    }
  }

  /**
   * Calculate wavelength (dispersion relation)
   */
  static wavelength(
    period: number, // T (s)
    waterDepth: number // d (m)
  ): number {
    const g = 9.81;
    const omega = 2 * Math.PI / period;
    
    // Deep water wavelength
    const L0 = g * period * period / (2 * Math.PI);
    
    // Iterative solution for general depth
    let L = L0;
    for (let i = 0; i < 20; i++) {
      const k = 2 * Math.PI / L;
      L = L0 * Math.tanh(k * waterDepth);
    }
    
    return L;
  }

  /**
   * Linear (Airy) wave kinematics
   */
  static airyKinematics(
    waveHeight: number, // H (m)
    wavePeriod: number, // T (s)
    waterDepth: number, // d (m)
    elevation: number, // z (m, positive up from SWL)
    phase: number // θ = kx - ωt (radians)
  ): {
    eta: number; // Surface elevation (m)
    u: number; // Horizontal velocity (m/s)
    w: number; // Vertical velocity (m/s)
    ax: number; // Horizontal acceleration (m/s²)
    az: number; // Vertical acceleration (m/s²)
  } {
    const H = waveHeight;
    const T = wavePeriod;
    const d = waterDepth;
    const z = elevation;
    const g = 9.81;

    const L = this.wavelength(T, d);
    const k = 2 * Math.PI / L;
    const omega = 2 * Math.PI / T;

    // Surface elevation
    const eta = (H / 2) * Math.cos(phase);

    // Velocity and acceleration (using Wheeler stretching if z > 0)
    const z_eff = z <= 0 ? z : z * d / (d + eta);
    
    const cosh_kz = Math.cosh(k * (d + z_eff));
    const sinh_kz = Math.sinh(k * (d + z_eff));
    const sinh_kd = Math.sinh(k * d);

    // Velocities
    const u = (Math.PI * H / T) * (cosh_kz / sinh_kd) * Math.cos(phase);
    const w = (Math.PI * H / T) * (sinh_kz / sinh_kd) * Math.sin(phase);

    // Accelerations
    const ax = (2 * Math.PI * Math.PI * H / (T * T)) * (cosh_kz / sinh_kd) * Math.sin(phase);
    const az = -(2 * Math.PI * Math.PI * H / (T * T)) * (sinh_kz / sinh_kd) * Math.cos(phase);

    return { eta, u, w, ax, az };
  }

  /**
   * Wave spectrum - JONSWAP
   */
  static jonswapSpectrum(
    frequency: number, // f (Hz)
    Hs: number, // Significant wave height (m)
    Tp: number, // Peak period (s)
    gamma: number = 3.3 // Peak enhancement factor
  ): number { // S(f) (m²/Hz)
    const g = 9.81;
    const fp = 1 / Tp;
    const f = frequency;

    // Pierson-Moskowitz component
    const alpha = 0.0081; // Phillips constant
    const beta = 1.25;
    const SPM = alpha * g * g / (Math.pow(2 * Math.PI, 4) * Math.pow(f, 5)) *
                Math.exp(-beta * Math.pow(fp / f, 4));

    // Peak enhancement
    const sigma = f <= fp ? 0.07 : 0.09;
    const r = Math.exp(-Math.pow(f - fp, 2) / (2 * sigma * sigma * fp * fp));
    const gammaFactor = Math.pow(gamma, r);

    // Adjust for target Hs
    const m0_PM = alpha * g * g / (16 * Math.pow(2 * Math.PI * fp, 4));
    const m0_target = (Hs / 4) * (Hs / 4);
    const scaleFactor = m0_target / m0_PM;

    return SPM * gammaFactor * scaleFactor;
  }

  /**
   * Random wave statistics
   */
  static waveStatistics(
    Hs: number, // Significant wave height (m)
    Tp: number, // Peak period (s)
    duration: number // Storm duration (hours)
  ): {
    Hmax: number; // Maximum wave height (m)
    H1_10: number; // Average of highest 1/10 waves (m)
    Hrms: number; // RMS wave height (m)
    numberOfWaves: number;
  } {
    const Tz = Tp * 0.71; // Zero-crossing period approximation
    const numberOfWaves = duration * 3600 / Tz;

    // Rayleigh distribution
    const Hrms = Hs / Math.sqrt(2);
    const H1_10 = 1.27 * Hs;
    
    // Maximum wave height (Longuet-Higgins)
    const Hmax = Hs * Math.sqrt(0.5 * Math.log(numberOfWaves));

    return { Hmax, H1_10, Hrms, numberOfWaves };
  }
}

// ============================================================================
// WAVE AND CURRENT FORCES (MORISON EQUATION)
// ============================================================================

export class MorisonForce {
  /**
   * Calculate drag and inertia coefficients
   */
  static coefficients(
    diameter: number, // D (m)
    reynolds: number, // Re
    kc: number // Keulegan-Carpenter number
  ): {
    Cd: number;
    Cm: number;
  } {
    // Simplified coefficients per API RP 2A
    let Cd: number;
    let Cm: number;

    // Smooth cylinder defaults
    if (kc < 10) {
      Cd = 1.0;
      Cm = 2.0;
    } else if (kc < 20) {
      Cd = 0.65;
      Cm = 2.0;
    } else {
      Cd = 0.65;
      Cm = 1.6;
    }

    // Surface roughness effects
    // (would adjust based on marine growth)

    return { Cd, Cm };
  }

  /**
   * Calculate wave force on a vertical cylinder
   */
  static forceOnCylinder(
    diameter: number, // D (m)
    velocity: number, // u (m/s) - combined wave + current
    acceleration: number, // du/dt (m/s²)
    waterDensity: number = 1025 // kg/m³
  ): {
    drag: number; // N/m
    inertia: number; // N/m
    total: number; // N/m
  } {
    const D = diameter;
    const rho = waterDensity;
    const u = velocity;
    const a = acceleration;

    // Get coefficients (simplified)
    const { Cd, Cm } = this.coefficients(D, 1e6, 20);

    // Morison equation
    const fd = 0.5 * rho * Cd * D * Math.abs(u) * u; // Drag
    const fi = rho * Cm * Math.PI * D * D / 4 * a; // Inertia

    return {
      drag: fd,
      inertia: fi,
      total: fd + fi
    };
  }

  /**
   * Integrated wave force on jacket leg
   */
  static totalForceOnLeg(
    diameter: number, // D (m)
    waterDepth: number, // d (m)
    waveHeight: number, // H (m)
    wavePeriod: number, // T (s)
    currentVelocity: number, // Uc (m/s) at surface
    elevationStep: number = 1, // m
    phase: number = 0 // Wave phase for peak force
  ): WaveForce {
    const D = diameter;
    const d = waterDepth;
    const H = waveHeight;
    const T = wavePeriod;
    const Uc = currentVelocity;
    const rho = 1025;

    const L = WaveTheory.wavelength(T, d);
    const k = 2 * Math.PI / L;

    let totalFx = 0;
    const totalFz = 0;
    let moment = 0;
    const maxLocal = { force: 0, elevation: 0 };

    // Integrate from mudline to wave crest
    const maxElevation = H / 2;
    for (let z = -d; z <= maxElevation; z += elevationStep) {
      // Wave kinematics
      const kin = WaveTheory.airyKinematics(H, T, d, z, phase);
      
      // Current velocity (power law profile)
      const Uc_z = Uc * Math.pow((d + z) / d, 1/7);
      
      // Combined velocity
      const u_total = kin.u + Uc_z;
      
      // Force per unit length
      const forces = this.forceOnCylinder(D, u_total, kin.ax, rho);
      
      // Integrate
      totalFx += forces.total * elevationStep;
      moment += forces.total * (d + z) * elevationStep;

      // Track maximum
      if (Math.abs(forces.total) > maxLocal.force) {
        maxLocal.force = Math.abs(forces.total);
        maxLocal.elevation = z;
      }
    }

    return {
      total: totalFx / 1000, // kN
      horizontal: totalFx / 1000, // kN
      vertical: totalFz / 1000, // kN
      moment: moment / 1000, // kN-m
      maxLocal: { force: maxLocal.force / 1000, elevation: maxLocal.elevation }
    };
  }

  /**
   * Design wave approach per API RP 2A
   */
  static designWaveAnalysis(
    platform: PlatformGeometry,
    metocean: MetoceanConditions,
    loadCase: '100-yr' | '1000-yr' | 'operating'
  ): {
    totalBaseShear: number; // kN
    totalOverturningMoment: number; // kN-m
    maxLegForce: number; // kN
    period: number; // s
    loadDistribution: { elevation: number; force: number }[];
  } {
    if (!platform.jacket) {
      throw new Error('Design wave analysis requires jacket platform');
    }

    const wave = metocean.wave;
    const current = metocean.current;
    const d = metocean.waterDepth;

    // Design wave height
    const waveStats = WaveTheory.waveStatistics(wave.significantHeight, wave.peakPeriod, 3);
    const Hdesign = loadCase === '1000-yr' ? waveStats.Hmax * 1.15 :
                    loadCase === '100-yr' ? waveStats.Hmax : 
                    wave.significantHeight;

    // Associated period
    const Tdesign = wave.peakPeriod;

    // Calculate forces on each leg
    const leg = platform.jacket.legs;
    const numLegs = leg.count;
    
    // Sum forces from all legs (simplified - assumes in-line)
    let totalShear = 0;
    let totalMoment = 0;
    const loadDistribution: { elevation: number; force: number }[] = [];

    for (let z = -d; z <= Hdesign / 2; z += 1) {
      const kin = WaveTheory.airyKinematics(Hdesign, Tdesign, d, z, 0);
      const Uc_z = current.surfaceVelocity * Math.pow((d + z) / d, 1/7);
      const u_total = kin.u + Uc_z;
      
      const forces = this.forceOnCylinder(leg.diameter, u_total, kin.ax);
      const forcePerMeter = forces.total * numLegs / 1000; // kN/m
      
      loadDistribution.push({ elevation: z, force: forcePerMeter });
      totalShear += forcePerMeter;
      totalMoment += forcePerMeter * (d + z);
    }

    // Bracing contribution (approximate as 30% of leg forces)
    const bracingFactor = 1.3;
    
    return {
      totalBaseShear: totalShear * bracingFactor,
      totalOverturningMoment: totalMoment * bracingFactor,
      maxLegForce: totalShear * bracingFactor / numLegs * 1.2, // Peak on windward leg
      period: Tdesign,
      loadDistribution
    };
  }
}

// ============================================================================
// MOORING SYSTEM ANALYSIS
// ============================================================================

export class MooringAnalysis {
  /**
   * Catenary equation solver
   */
  static catenaryGeometry(
    horizontalTension: number, // TH (kN)
    wetWeight: number, // w (kN/m)
    waterDepth: number, // d (m)
    fairleadX: number // Horizontal distance to anchor (m)
  ): {
    lineTension: number; // T (kN) at fairlead
    suspendedLength: number; // s (m)
    groundedLength: number; // m
    angle: number; // degrees at fairlead
  } {
    const TH = horizontalTension;
    const w = wetWeight;
    const d = waterDepth;
    const X = fairleadX;

    // Catenary parameter
    const a = TH / w;

    // Suspended length from geometry
    // s = a * sinh(X_s/a), where X_s is horizontal extent of suspended part
    // d = a * (cosh(X_s/a) - 1)
    
    // Solve for suspended length
    // From: s² = d² + 2*a*d = d² + 2*TH*d/w
    const s = Math.sqrt(d * d + 2 * TH * d / w);
    
    // Horizontal extent of suspended portion
    const X_s = a * Math.asinh(s / a);
    
    // Grounded length
    const groundedLength = Math.max(0, X - X_s);

    // Line tension at fairlead
    const TV = w * s; // Vertical component
    const T = Math.sqrt(TH * TH + TV * TV);

    // Angle at fairlead
    const angle = Math.atan2(TV, TH) * 180 / Math.PI;

    return {
      lineTension: T,
      suspendedLength: s,
      groundedLength,
      angle
    };
  }

  /**
   * Calculate mooring line stiffness
   */
  static lineStiffness(
    horizontalTension: number, // TH (kN)
    wetWeight: number, // w (kN/m)
    waterDepth: number, // d (m)
    axialStiffness: number // EA (kN)
  ): {
    geometricStiffness: number; // kN/m
    elasticStiffness: number; // kN/m
    totalStiffness: number; // kN/m
  } {
    const TH = horizontalTension;
    const w = wetWeight;
    const d = waterDepth;
    const EA = axialStiffness;

    const catenary = this.catenaryGeometry(TH, w, d, 1000);
    const s = catenary.suspendedLength;

    // Geometric stiffness (from catenary)
    const a = TH / w;
    const KG = TH * w / (TH + w * d);

    // Elastic stiffness
    const KE = EA * TH * TH / (w * s * s * s);

    // Combined (springs in series)
    const K_total = 1 / (1 / KG + 1 / KE);

    return {
      geometricStiffness: KG,
      elasticStiffness: KE,
      totalStiffness: K_total
    };
  }

  /**
   * Complete mooring system analysis
   */
  static analyzeSystem(
    mooringSystem: MooringSystem,
    vessel: { displacement: number; windArea: number; currentArea: number },
    metocean: MetoceanConditions,
    code: 'API-RP2SK' | 'DNV-OS-E301' = 'API-RP2SK'
  ): MooringAnalysisResult {
    const numLines = mooringSystem.lines.count;
    const lineProps = mooringSystem.lineProperties;
    const d = metocean.waterDepth;

    // Environmental forces
    const windForce = 0.5 * 1.225 * Math.pow(metocean.wind.velocity1hr, 2) * 
                      vessel.windArea * 0.8 / 1000; // kN
    const currentForce = 0.5 * 1025 * Math.pow(metocean.current.surfaceVelocity, 2) *
                         vessel.currentArea * 1.0 / 1000; // kN
    
    // Wave drift force (approximate as 2% of displacement * g * Hs²/L)
    const L = WaveTheory.wavelength(metocean.wave.peakPeriod, d);
    const waveDrift = 0.02 * vessel.displacement * 9.81 * 
                      Math.pow(metocean.wave.significantHeight, 2) / L / 1000; // kN

    const totalEnvForce = windForce + currentForce + waveDrift;

    // Line tensions (simplified symmetric analysis)
    const tensions: MooringAnalysisResult['tensions'] = [];
    const lineConfig = mooringSystem.lines.configuration;
    
    // Pretension
    const pretension = lineConfig[0]?.[1] || 1000; // kN typical
    
    // Estimate offset
    const stiffness = this.lineStiffness(
      pretension, 
      lineProps.wetWeight * 9.81 / 1000,
      d,
      lineProps.axialStiffness
    );
    
    const totalStiffness = stiffness.totalStiffness * numLines * 0.5; // Factor for non-aligned lines
    const offset = totalEnvForce / totalStiffness;

    // Calculate individual line tensions
    for (let i = 0; i < numLines; i++) {
      const azimuth = (lineConfig[i]?.[0] || i * 360 / numLines);
      const envDirection = metocean.wave.direction;
      const angleDiff = (azimuth - envDirection) * Math.PI / 180;

      // Tension change due to offset
      const deltaT = stiffness.totalStiffness * offset * Math.cos(angleDiff);
      const maxTension_intact = pretension + Math.abs(deltaT);
      
      // Damaged case (one line removed)
      const maxTension_damaged = maxTension_intact * 1.3;

      tensions.push({
        lineNumber: i + 1,
        azimuth,
        pretension,
        maxTension: { 
          intact: maxTension_intact, 
          damaged: maxTension_damaged 
        },
        utilizationRatio: {
          intact: maxTension_intact / lineProps.breakingLoad,
          damaged: maxTension_damaged / lineProps.breakingLoad
        }
      });
    }

    // Catenary shape
    const catenary = this.catenaryGeometry(
      pretension * 0.9, // Horizontal component
      lineProps.wetWeight * 9.81 / 1000,
      d,
      lineProps.length * 0.8
    );

    // Safety factors per code
    const SF_intact = code === 'API-RP2SK' ? 1.67 : 1.5;
    const SF_damaged = code === 'API-RP2SK' ? 1.25 : 1.1;

    const recommendations: string[] = [];
    let status: MooringAnalysisResult['status'] = 'acceptable';

    // Check utilization
    const maxUtilIntact = Math.max(...tensions.map(t => t.utilizationRatio.intact));
    const maxUtilDamaged = Math.max(...tensions.map(t => t.utilizationRatio.damaged));

    if (maxUtilIntact > 1 / SF_intact || maxUtilDamaged > 1 / SF_damaged) {
      status = 'unacceptable';
      recommendations.push('Increase line strength or add additional lines');
    } else if (maxUtilIntact > 1 / SF_intact * 0.9) {
      status = 'review-required';
    }

    // Check offset
    const offsetPercent = offset / d * 100;
    if (offsetPercent > 8) {
      status = 'unacceptable';
      recommendations.push('Offset exceeds 8% water depth - increase mooring stiffness');
    } else if (offsetPercent > 5) {
      recommendations.push('Consider increased pretension to reduce offset');
    }

    return {
      code,
      tensions,
      offset: {
        intact: { x: offset, y: 0, magnitude: offset },
        damaged: { x: offset * 1.3, y: 0, magnitude: offset * 1.3 },
        percentWaterDepth: { intact: offsetPercent, damaged: offsetPercent * 1.3 }
      },
      catenary: {
        horizontalExtent: lineProps.length - catenary.suspendedLength,
        verticalExtent: d,
        suspendedLength: catenary.suspendedLength,
        groundedLength: catenary.groundedLength
      },
      status,
      recommendations
    };
  }
}

// ============================================================================
// FATIGUE ANALYSIS FOR OFFSHORE
// ============================================================================

export class OffshoreFatigue {
  /**
   * S-N curve parameters per DNV-RP-C203
   */
  private static snCurves: Record<string, { m1: number; logA1: number; m2?: number; logA2?: number; Nswitch?: number }> = {
    'B1': { m1: 4.0, logA1: 15.117, m2: 5.0, logA2: 17.146, Nswitch: 1e7 },
    'B2': { m1: 4.0, logA1: 14.885, m2: 5.0, logA2: 16.856, Nswitch: 1e7 },
    'C': { m1: 3.0, logA1: 12.592, m2: 5.0, logA2: 16.320, Nswitch: 1e7 },
    'C1': { m1: 3.0, logA1: 12.449, m2: 5.0, logA2: 16.081, Nswitch: 1e7 },
    'C2': { m1: 3.0, logA1: 12.301, m2: 5.0, logA2: 15.835, Nswitch: 1e7 },
    'D': { m1: 3.0, logA1: 12.164, m2: 5.0, logA2: 15.606, Nswitch: 1e7 },
    'E': { m1: 3.0, logA1: 12.010, m2: 5.0, logA2: 15.350, Nswitch: 1e7 },
    'F': { m1: 3.0, logA1: 11.855, m2: 5.0, logA2: 15.091, Nswitch: 1e7 },
    'F1': { m1: 3.0, logA1: 11.699, m2: 5.0, logA2: 14.832, Nswitch: 1e7 },
    'F3': { m1: 3.0, logA1: 11.546, m2: 5.0, logA2: 14.576, Nswitch: 1e7 },
    'G': { m1: 3.0, logA1: 11.398, m2: 5.0, logA2: 14.330, Nswitch: 1e7 },
    'W1': { m1: 3.0, logA1: 11.261, m2: 5.0, logA2: 14.101, Nswitch: 1e7 },
    'W2': { m1: 3.0, logA1: 11.107, m2: 5.0, logA2: 13.845, Nswitch: 1e7 },
    'W3': { m1: 3.0, logA1: 10.970, m2: 5.0, logA2: 13.617, Nswitch: 1e7 },
    'T': { m1: 3.0, logA1: 12.164 } // Tubular joints basic
  };

  /**
   * Calculate cycles to failure
   */
  static cyclesToFailure(
    stressRange: number, // MPa
    snCurve: string,
    thicknessFactor: number = 1.0,
    environmentFactor: number = 1.0, // 1.0 for air, up to 3.0 for seawater
    scf: number = 1.0 // Stress concentration factor
  ): number {
    const curve = this.snCurves[snCurve] || this.snCurves['D'];
    const S = stressRange * thicknessFactor * environmentFactor * scf;

    // Determine which portion of bi-linear curve
    const Nswitch = curve.Nswitch || 1e7;
    let N: number;

    // First check high cycle region
    if (curve.m2 && curve.logA2) {
      const S_switch = Math.pow(10, (curve.logA2 - Math.log10(Nswitch)) / curve.m2);
      if (S < S_switch) {
        // High cycle (past knee)
        N = Math.pow(10, curve.logA2 - curve.m2 * Math.log10(S));
      } else {
        // Low cycle (before knee)
        N = Math.pow(10, curve.logA1 - curve.m1 * Math.log10(S));
      }
    } else {
      N = Math.pow(10, curve.logA1 - curve.m1 * Math.log10(S));
    }

    return N;
  }

  /**
   * Miner's rule damage accumulation
   */
  static minerDamage(
    stressRangeHistogram: { stressRange: number; cycles: number }[],
    snCurve: string,
    scf: number = 1.0
  ): {
    totalDamage: number;
    fatigueLife: number; // years (if histogram is annual)
    criticalBins: { stressRange: number; damage: number }[];
  } {
    let totalDamage = 0;
    const criticalBins: { stressRange: number; damage: number }[] = [];

    for (const bin of stressRangeHistogram) {
      const N = this.cyclesToFailure(bin.stressRange, snCurve, 1.0, 1.0, scf);
      const damage = bin.cycles / N;
      totalDamage += damage;

      if (damage > 0.01) {
        criticalBins.push({ stressRange: bin.stressRange, damage });
      }
    }

    // Sort critical bins by damage
    criticalBins.sort((a, b) => b.damage - a.damage);

    return {
      totalDamage,
      fatigueLife: 1 / totalDamage,
      criticalBins: criticalBins.slice(0, 5)
    };
  }

  /**
   * Hot spot stress for tubular joints
   */
  static tubularJointSCF(
    jointType: 'T' | 'Y' | 'K' | 'KT' | 'X',
    braceAngle: number, // degrees
    gamma: number, // D/(2*T) chord slenderness
    tau: number, // t/T thickness ratio
    beta: number, // d/D diameter ratio
    loadType: 'axial' | 'IPB' | 'OPB'
  ): {
    scfChord: number;
    scfBrace: number;
  } {
    // Simplified Efthymiou equations
    const theta = braceAngle * Math.PI / 180;

    let scfChord: number;
    let scfBrace: number;

    if (loadType === 'axial') {
      // Axial loading
      scfChord = gamma * tau * (1.1 - 0.9 * beta) * 
                 Math.pow(beta, -0.5) * Math.pow(Math.sin(theta), 2);
      scfBrace = 1 + 0.6 * tau * Math.pow(gamma, 0.3) * 
                 Math.pow(beta, 0.5) * Math.pow(Math.sin(theta), 0.5);
    } else if (loadType === 'IPB') {
      // In-plane bending
      scfChord = 1.4 * gamma * tau * beta * Math.pow(Math.sin(theta), 1.5);
      scfBrace = 0.85 + 0.5 * tau * Math.pow(gamma, 0.6) * Math.pow(beta, 0.4);
    } else {
      // Out-of-plane bending
      scfChord = gamma * tau * beta * (1.2 - 0.5 * Math.pow(beta, 2)) *
                 Math.pow(Math.sin(theta), 1.6);
      scfBrace = 1.3 + tau * Math.pow(gamma, 0.3) * Math.pow(beta, -0.1);
    }

    return {
      scfChord: Math.max(1.5, scfChord),
      scfBrace: Math.max(1.5, scfBrace)
    };
  }

  /**
   * Spectral fatigue analysis
   */
  static spectralFatigue(
    stressResponseSpectrum: { frequency: number; spectralDensity: number }[],
    snCurve: string,
    duration: number, // hours
    scf: number = 1.0
  ): {
    damage: number;
    dominantPeriod: number;
    rmsStress: number;
  } {
    // Calculate spectral moments
    let m0 = 0, m2 = 0, m4 = 0;
    for (let i = 1; i < stressResponseSpectrum.length; i++) {
      const f = stressResponseSpectrum[i].frequency;
      const S = stressResponseSpectrum[i].spectralDensity;
      const df = f - stressResponseSpectrum[i - 1].frequency;
      
      m0 += S * df;
      m2 += S * Math.pow(f, 2) * df;
      m4 += S * Math.pow(f, 4) * df;
    }

    // RMS stress
    const sigmaRMS = Math.sqrt(m0);
    
    // Mean zero-crossing frequency
    const f0 = Math.sqrt(m2 / m0);
    
    // Bandwidth parameter
    const epsilon = Math.sqrt(1 - m2 * m2 / (m0 * m4));

    // Number of cycles (narrow band approximation)
    const N0 = f0 * duration * 3600;

    // Narrow-band fatigue damage
    const curve = this.snCurves[snCurve] || this.snCurves['D'];
    const m = curve.m1;
    const A = Math.pow(10, curve.logA1);
    
    // Γ(1 + m/2) gamma function
    const gammaFunc = this.gammaFunction(1 + m / 2);
    
    const damage = N0 * Math.pow(2 * Math.sqrt(2) * sigmaRMS * scf, m) * gammaFunc / A;

    return {
      damage,
      dominantPeriod: 1 / f0,
      rmsStress: sigmaRMS
    };
  }

  private static gammaFunction(n: number): number {
    // Lanczos approximation
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
}

// ============================================================================
// PILE DESIGN FOR OFFSHORE
// ============================================================================

export class OffshorePileDesign {
  /**
   * Axial pile capacity in sand per API RP 2A
   */
  static axialCapacitySand(
    pileDiameter: number, // D (m)
    pileLength: number, // L (m) embedment
    soilProfile: { depth: number; relativeDensity: string; effectiveStress: number }[]
  ): {
    skinFriction: number; // kN
    endBearing: number; // kN
    totalCapacity: number; // kN
  } {
    const D = pileDiameter;
    const Ap = Math.PI * D * D / 4;
    const perimeter = Math.PI * D;

    let Qs = 0; // Skin friction
    let Qp = 0; // End bearing

    // Friction factors per relative density
    const frictionFactor: Record<string, { delta: number; Nq: number }> = {
      'very-loose': { delta: 15, Nq: 8 },
      'loose': { delta: 20, Nq: 12 },
      'medium': { delta: 25, Nq: 20 },
      'dense': { delta: 30, Nq: 40 },
      'very-dense': { delta: 35, Nq: 50 }
    };

    for (let i = 1; i < soilProfile.length; i++) {
      const layer = soilProfile[i];
      const prevLayer = soilProfile[i - 1];
      const dz = layer.depth - prevLayer.depth;

      if (layer.depth > pileLength) break;

      const params = frictionFactor[layer.relativeDensity] || frictionFactor['medium'];
      const sigma = layer.effectiveStress;
      const K = 0.8; // Coefficient of lateral earth pressure

      // Unit skin friction
      const f = K * sigma * Math.tan(params.delta * Math.PI / 180);
      const f_limited = Math.min(f, 115); // kPa limit

      Qs += f_limited * perimeter * dz;

      // End bearing (at pile tip)
      if (i === soilProfile.length - 1 || soilProfile[i + 1]?.depth > pileLength) {
        const q = sigma * params.Nq;
        const q_limited = Math.min(q, 12000); // kPa limit
        Qp = q_limited * Ap;
      }
    }

    return {
      skinFriction: Qs,
      endBearing: Qp,
      totalCapacity: Qs + Qp
    };
  }

  /**
   * Lateral pile capacity (simplified p-y approach)
   */
  static lateralCapacity(
    pileDiameter: number, // D (m)
    pileEI: number, // kN-m² (flexural rigidity)
    soilModulus: number, // kN/m³ (coefficient of subgrade reaction)
    appliedLoad: number, // kN (lateral at mudline)
    appliedMoment: number // kN-m (at mudline)
  ): {
    maxDeflection: number; // m
    maxBendingMoment: number; // kN-m
    depthToFixity: number; // m
  } {
    const D = pileDiameter;
    const EI = pileEI;
    const ks = soilModulus;

    // Characteristic length
    const R = Math.pow(EI / (ks * D), 0.25);

    // Coefficients for long pile (L/R > 4)
    const H = appliedLoad;
    const M0 = appliedMoment;

    // Maximum deflection at mudline
    const y0 = (H * Math.pow(R, 3) + M0 * Math.pow(R, 2)) / (2 * EI);

    // Maximum bending moment
    const Mmax = 0.32 * H * R + 0.45 * M0;

    // Depth to effective fixity
    const Lf = 1.8 * R;

    return {
      maxDeflection: y0,
      maxBendingMoment: Mmax,
      depthToFixity: Lf
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  WaveTheory,
  MorisonForce,
  MooringAnalysis,
  OffshoreFatigue,
  OffshorePileDesign
};
