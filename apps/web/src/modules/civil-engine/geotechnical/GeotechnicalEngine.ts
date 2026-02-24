/**
 * ============================================================================
 * GEOTECHNICAL ENGINEERING MODULE
 * ============================================================================
 * 
 * Comprehensive geotechnical calculations including:
 * - Soil mechanics
 * - Foundation analysis
 * - Slope stability
 * - Earth pressure calculations
 * - Settlement analysis
 * - Pile design
 * 
 * @version 2.0.0
 */

import { PHYSICAL_CONSTANTS } from '../core/CivilEngineeringCore';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface SoilLayer {
  id: number;
  name: string;
  thickness: number;           // m
  unitWeight: number;          // kN/m³
  saturatedUnitWeight: number; // kN/m³
  cohesion: number;            // kPa
  frictionAngle: number;       // degrees
  elasticModulus: number;      // MPa
  poissonRatio: number;
  compressionIndex?: number;   // Cc
  recompressionIndex?: number; // Cr
  voidRatio?: number;          // e0
  preconsolidationPressure?: number; // kPa
  coefficientOfConsolidation?: number; // m²/year (Cv)
  sptN?: number;               // SPT N value
  liquidLimit?: number;        // LL
  plasticLimit?: number;       // PL
  waterContent?: number;       // w%
}

export interface FoundationParams {
  type: 'strip' | 'square' | 'rectangular' | 'circular';
  width: number;              // B (m)
  length?: number;            // L (m) for rectangular
  depth: number;              // Df (m)
  baseElevation?: number;     // m
}

export interface PileParams {
  type: 'driven' | 'bored' | 'CFA';
  diameter: number;           // m
  length: number;             // m
  numberOfPiles: number;
  spacing: number;            // m
  capThickness?: number;      // m
}

export interface SlopeParams {
  height: number;             // m
  angle: number;              // degrees
  soilProperties: SoilLayer;
  waterTableDepth?: number;   // m from top
  surcharge?: number;         // kPa
}

export interface RetainingWallParams {
  type: 'gravity' | 'cantilever' | 'counterfort' | 'anchored';
  height: number;             // m
  backfillAngle: number;      // degrees
  backfillProperties: SoilLayer;
  wallFrictionAngle?: number; // degrees
  surcharge?: number;         // kPa
  waterTableDepth?: number;   // m from top
}

// =============================================================================
// SOIL MECHANICS
// =============================================================================

export class SoilMechanics {
  /**
   * Calculate effective stress at depth
   */
  static effectiveStress(
    layers: SoilLayer[],
    depth: number,
    waterTableDepth: number
  ): { total: number; poreWater: number; effective: number } {
    let totalStress = 0;
    let currentDepth = 0;
    const gammaW = 9.81; // kN/m³
    
    for (const layer of layers) {
      const layerBottom = currentDepth + layer.thickness;
      
      if (depth <= currentDepth) break;
      
      const depthInLayer = Math.min(depth - currentDepth, layer.thickness);
      
      if (currentDepth >= waterTableDepth) {
        // Fully below water table
        totalStress += layer.saturatedUnitWeight * depthInLayer;
      } else if (layerBottom <= waterTableDepth) {
        // Fully above water table
        totalStress += layer.unitWeight * depthInLayer;
      } else {
        // Partially submerged
        const aboveWT = waterTableDepth - currentDepth;
        const belowWT = depthInLayer - aboveWT;
        totalStress += layer.unitWeight * aboveWT + layer.saturatedUnitWeight * belowWT;
      }
      
      currentDepth = layerBottom;
    }
    
    const poreWaterPressure = depth > waterTableDepth 
      ? gammaW * (depth - waterTableDepth) 
      : 0;
    
    return {
      total: totalStress,
      poreWater: poreWaterPressure,
      effective: totalStress - poreWaterPressure,
    };
  }

  /**
   * Calculate soil classification (USCS)
   */
  static classifySoilUSCS(
    finesContent: number,      // % passing #200 sieve
    d60: number,               // mm
    d30: number,               // mm
    d10: number,               // mm
    liquidLimit?: number,
    plasticityIndex?: number,
    isOrganic?: boolean
  ): { symbol: string; name: string } {
    const Cu = d60 / d10; // Coefficient of uniformity
    const Cc = (d30 * d30) / (d60 * d10); // Coefficient of curvature
    
    if (finesContent < 5) {
      // Coarse-grained, clean
      if (d60 > 4.75) {
        // Gravel
        if (Cu >= 4 && Cc >= 1 && Cc <= 3) {
          return { symbol: 'GW', name: 'Well-graded gravel' };
        }
        return { symbol: 'GP', name: 'Poorly-graded gravel' };
      } else {
        // Sand
        if (Cu >= 6 && Cc >= 1 && Cc <= 3) {
          return { symbol: 'SW', name: 'Well-graded sand' };
        }
        return { symbol: 'SP', name: 'Poorly-graded sand' };
      }
    } else if (finesContent >= 50) {
      // Fine-grained
      if (liquidLimit && plasticityIndex !== undefined) {
        const A_line = 0.73 * (liquidLimit - 20);
        
        if (liquidLimit < 50) {
          if (plasticityIndex > 7 && plasticityIndex > A_line) {
            return { symbol: 'CL', name: 'Lean clay' };
          }
          return { symbol: 'ML', name: 'Silt' };
        } else {
          if (plasticityIndex > A_line) {
            return { symbol: 'CH', name: 'Fat clay' };
          }
          return { symbol: 'MH', name: 'Elastic silt' };
        }
      }
    }
    
    // Dual classification for borderline cases
    return { symbol: 'SC/SM', name: 'Silty/Clayey sand' };
  }

  /**
   * Calculate plasticity index
   */
  static plasticityIndex(liquidLimit: number, plasticLimit: number): number {
    return liquidLimit - plasticLimit;
  }

  /**
   * Calculate activity of clay
   */
  static activityOfClay(plasticityIndex: number, clayFraction: number): number {
    return plasticityIndex / clayFraction;
  }

  /**
   * Calculate relative density from SPT
   */
  static relativeDensityFromSPT(N: number, effectiveStress: number): number {
    // Meyerhof correlation
    const Dr = 21 * Math.sqrt(N / (0.7 + effectiveStress / 100));
    return Math.min(100, Dr);
  }

  /**
   * Correlate undrained shear strength from SPT
   */
  static undrainedShearStrengthFromSPT(N: number, method: 'Terzaghi' | 'Hara'): number {
    if (method === 'Terzaghi') {
      return N * 6.25; // kPa
    }
    return N * 29 / 4.5; // Hara correlation, kPa
  }

  /**
   * Calculate coefficient of earth pressure at rest (K0)
   */
  static K0(frictionAngle: number, OCR: number = 1, method: 'Jaky' | 'Mayne'): number {
    const phi_rad = frictionAngle * Math.PI / 180;
    
    if (method === 'Jaky') {
      return (1 - Math.sin(phi_rad)) * Math.pow(OCR, Math.sin(phi_rad));
    }
    // Mayne & Kulhawy
    return (1 - Math.sin(phi_rad)) * Math.pow(OCR, 0.5);
  }

  /**
   * Calculate permeability from grain size (Hazen's formula)
   */
  static permeabilityHazen(d10: number, C: number = 100): number {
    // d10 in mm, result in cm/s
    return C * d10 * d10;
  }
}

// =============================================================================
// BEARING CAPACITY
// =============================================================================

export class BearingCapacity {
  /**
   * Terzaghi bearing capacity factors
   */
  static terzaghiFactors(phi: number): { Nc: number; Nq: number; Ngamma: number } {
    const phi_rad = phi * Math.PI / 180;
    
    const Nq = Math.exp(Math.PI * Math.tan(phi_rad)) * 
               Math.pow(Math.tan(Math.PI / 4 + phi_rad / 2), 2);
    const Nc = (Nq - 1) / Math.tan(phi_rad);
    const Ngamma = 2 * (Nq + 1) * Math.tan(phi_rad);
    
    return { Nc: phi === 0 ? 5.7 : Nc, Nq, Ngamma };
  }

  /**
   * Meyerhof bearing capacity factors
   */
  static meyerhofFactors(phi: number): { Nc: number; Nq: number; Ngamma: number } {
    const phi_rad = phi * Math.PI / 180;
    
    const Nq = Math.exp(Math.PI * Math.tan(phi_rad)) * 
               Math.pow(Math.tan(Math.PI / 4 + phi_rad / 2), 2);
    const Nc = (Nq - 1) / Math.tan(phi_rad);
    const Ngamma = (Nq - 1) * Math.tan(1.4 * phi_rad);
    
    return { Nc: phi === 0 ? 5.14 : Nc, Nq, Ngamma };
  }

  /**
   * Hansen bearing capacity factors
   */
  static hansenFactors(phi: number): { Nc: number; Nq: number; Ngamma: number } {
    const phi_rad = phi * Math.PI / 180;
    
    const Nq = Math.exp(Math.PI * Math.tan(phi_rad)) * 
               Math.pow(Math.tan(Math.PI / 4 + phi_rad / 2), 2);
    const Nc = (Nq - 1) / Math.tan(phi_rad);
    const Ngamma = 1.5 * (Nq - 1) * Math.tan(phi_rad);
    
    return { Nc: phi === 0 ? 5.14 : Nc, Nq, Ngamma };
  }

  /**
   * Shape factors for bearing capacity
   */
  static shapeFactors(
    foundation: FoundationParams,
    phi: number
  ): { sc: number; sq: number; sgamma: number } {
    const B = foundation.width;
    const L = foundation.length || B;
    const phi_rad = phi * Math.PI / 180;
    
    if (foundation.type === 'circular') {
      return {
        sc: 1 + 0.2 * Math.tan(Math.PI / 4 + phi_rad / 2),
        sq: 1 + Math.tan(phi_rad),
        sgamma: 0.6,
      };
    }
    
    // Rectangular/square
    const { Nq, Nc } = this.hansenFactors(phi);
    
    return {
      sc: 1 + (B / L) * (Nq / Nc),
      sq: 1 + (B / L) * Math.tan(phi_rad),
      sgamma: 1 - 0.4 * (B / L),
    };
  }

  /**
   * Depth factors for bearing capacity
   */
  static depthFactors(
    foundation: FoundationParams,
    phi: number
  ): { dc: number; dq: number; dgamma: number } {
    const B = foundation.width;
    const Df = foundation.depth;
    const k = Df / B <= 1 ? Df / B : Math.atan(Df / B);
    const phi_rad = phi * Math.PI / 180;
    
    return {
      dc: 1 + 0.4 * k,
      dq: 1 + 2 * Math.tan(phi_rad) * Math.pow(1 - Math.sin(phi_rad), 2) * k,
      dgamma: 1,
    };
  }

  /**
   * Calculate ultimate bearing capacity (Terzaghi method)
   */
  static ultimateBearingCapacityTerzaghi(
    foundation: FoundationParams,
    soil: SoilLayer,
    waterTableDepth?: number
  ): {
    qu: number;
    qult_gross: number;
    qult_net: number;
    components: { cohesion: number; surcharge: number; selfWeight: number };
  } {
    const { Nc, Nq, Ngamma } = this.terzaghiFactors(soil.frictionAngle);
    const B = foundation.width;
    const Df = foundation.depth;
    const c = soil.cohesion;
    
    // Calculate effective unit weight considering water table
    let gamma = soil.unitWeight;
    let gammaBelow = soil.unitWeight;
    
    if (waterTableDepth !== undefined) {
      const gammaW = 9.81;
      if (waterTableDepth <= Df) {
        gamma = soil.saturatedUnitWeight - gammaW;
        gammaBelow = gamma;
      } else if (waterTableDepth < Df + B) {
        gammaBelow = (soil.saturatedUnitWeight - gammaW);
      }
    }
    
    // Surcharge at foundation level
    const q = gamma * Df;
    
    // Shape factors
    let sc = 1, sgamma = 1;
    const sq = 1;
    if (foundation.type === 'square') {
      sc = 1.3;
      sgamma = 0.8;
    } else if (foundation.type === 'circular') {
      sc = 1.3;
      sgamma = 0.6;
    }
    
    // Components
    const cohesionTerm = c * Nc * sc;
    const surchargeTerm = q * Nq * sq;
    const selfWeightTerm = 0.5 * gammaBelow * B * Ngamma * sgamma;
    
    const qu = cohesionTerm + surchargeTerm + selfWeightTerm;
    const qNet = qu - q;
    
    return {
      qu,
      qult_gross: qu,
      qult_net: qNet,
      components: {
        cohesion: cohesionTerm,
        surcharge: surchargeTerm,
        selfWeight: selfWeightTerm,
      },
    };
  }

  /**
   * Calculate ultimate bearing capacity (Hansen method)
   */
  static ultimateBearingCapacityHansen(
    foundation: FoundationParams,
    soil: SoilLayer,
    waterTableDepth?: number,
    inclination?: { horizontal: number; vertical: number }
  ): {
    qu: number;
    components: { cohesion: number; surcharge: number; selfWeight: number };
  } {
    const phi = soil.frictionAngle;
    const { Nc, Nq, Ngamma } = this.hansenFactors(phi);
    const { sc, sq, sgamma } = this.shapeFactors(foundation, phi);
    const { dc, dq, dgamma } = this.depthFactors(foundation, phi);
    
    const B = foundation.width;
    const Df = foundation.depth;
    const c = soil.cohesion;
    
    // Effective unit weight
    let gamma = soil.unitWeight;
    const gammaW = 9.81;
    
    if (waterTableDepth !== undefined && waterTableDepth <= Df + B) {
      gamma = soil.saturatedUnitWeight - gammaW;
    }
    
    const q = gamma * Df;
    
    // Inclination factors (simplified)
    let ic = 1, iq = 1, igamma = 1;
    if (inclination) {
      const alpha = Math.atan(inclination.horizontal / inclination.vertical);
      iq = Math.pow(1 - 0.5 * alpha / (Math.PI / 2), 2);
      igamma = Math.pow(1 - 0.7 * alpha / (Math.PI / 2), 2);
      ic = iq - (1 - iq) / (Nq - 1);
    }
    
    const cohesionTerm = c * Nc * sc * dc * ic;
    const surchargeTerm = q * Nq * sq * dq * iq;
    const selfWeightTerm = 0.5 * gamma * B * Ngamma * sgamma * dgamma * igamma;
    
    return {
      qu: cohesionTerm + surchargeTerm + selfWeightTerm,
      components: { cohesion: cohesionTerm, surcharge: surchargeTerm, selfWeight: selfWeightTerm },
    };
  }

  /**
   * Calculate safe bearing capacity
   */
  static safeBearingCapacity(
    qu: number,
    factorOfSafety: number = 3
  ): number {
    return qu / factorOfSafety;
  }

  /**
   * Bearing capacity from SPT (Meyerhof)
   */
  static bearingCapacityFromSPT(
    N: number,
    foundation: FoundationParams,
    Df: number
  ): number {
    const B = foundation.width;
    const Fd = 1 + 0.33 * (Df / B);
    
    if (B <= 1.2) {
      return 12 * N * Fd; // kPa
    }
    return 8 * N * Math.pow((B + 0.3) / B, 2) * Fd; // kPa
  }
}

// =============================================================================
// SETTLEMENT ANALYSIS
// =============================================================================

export class SettlementAnalysis {
  /**
   * Calculate immediate settlement (elastic)
   */
  static immediateSettlement(
    q: number,            // Applied pressure (kPa)
    B: number,            // Foundation width (m)
    Es: number,           // Soil elastic modulus (kPa)
    nu: number,           // Poisson's ratio
    Ip: number = 1        // Influence factor
  ): number {
    // Se = q * B * (1 - ν²) * Ip / Es
    return q * B * (1 - nu * nu) * Ip / Es * 1000; // mm
  }

  /**
   * Calculate consolidation settlement
   */
  static consolidationSettlement(
    layers: SoilLayer[],
    deltaStress: number,       // Stress increase (kPa)
    depthToCenter: number[]    // Depth to center of each layer (m)
  ): { primary: number; details: { layer: number; settlement: number }[] } {
    let totalSettlement = 0;
    const details: { layer: number; settlement: number }[] = [];
    
    layers.forEach((layer, index) => {
      if (layer.compressionIndex && layer.voidRatio !== undefined) {
        const H = layer.thickness;
        const Cc = layer.compressionIndex;
        const e0 = layer.voidRatio;
        const sigma0 = depthToCenter[index] * layer.unitWeight;
        const sigma_p = layer.preconsolidationPressure || sigma0;
        
        let settlement: number;
        
        if (sigma0 + deltaStress <= sigma_p) {
          // Recompression only
          const Cr = layer.recompressionIndex || Cc / 5;
          settlement = (Cr * H / (1 + e0)) * Math.log10((sigma0 + deltaStress) / sigma0);
        } else if (sigma0 >= sigma_p) {
          // Virgin compression only
          settlement = (Cc * H / (1 + e0)) * Math.log10((sigma0 + deltaStress) / sigma0);
        } else {
          // Combined recompression and virgin compression
          const Cr = layer.recompressionIndex || Cc / 5;
          const settlement1 = (Cr * H / (1 + e0)) * Math.log10(sigma_p / sigma0);
          const settlement2 = (Cc * H / (1 + e0)) * Math.log10((sigma0 + deltaStress) / sigma_p);
          settlement = settlement1 + settlement2;
        }
        
        totalSettlement += settlement * 1000; // Convert to mm
        details.push({ layer: index + 1, settlement: settlement * 1000 });
      }
    });
    
    return { primary: totalSettlement, details };
  }

  /**
   * Calculate time for consolidation
   */
  static timeForConsolidation(
    Cv: number,           // Coefficient of consolidation (m²/year)
    H: number,            // Drainage path (m)
    U: number,            // Degree of consolidation (0-1)
    drainage: 'single' | 'double' = 'double'
  ): number {
    const Hdr = drainage === 'double' ? H / 2 : H;
    
    // Time factor from degree of consolidation
    let Tv: number;
    if (U <= 0.6) {
      Tv = (Math.PI / 4) * U * U;
    } else {
      Tv = -0.933 * Math.log10(1 - U) - 0.085;
    }
    
    // t = Tv * Hdr² / Cv
    return Tv * Hdr * Hdr / Cv; // years
  }

  /**
   * Calculate secondary compression settlement
   */
  static secondarySettlement(
    Calpha: number,       // Secondary compression index
    H: number,            // Layer thickness (m)
    e0: number,           // Initial void ratio
    t1: number,           // End of primary consolidation (years)
    t2: number            // Time of interest (years)
  ): number {
    return (Calpha * H / (1 + e0)) * Math.log10(t2 / t1) * 1000; // mm
  }

  /**
   * Stress distribution using 2:1 method
   */
  static stressDistribution2to1(
    q: number,            // Surface pressure (kPa)
    B: number,            // Foundation width (m)
    L: number,            // Foundation length (m)
    z: number             // Depth below foundation (m)
  ): number {
    return q * B * L / ((B + z) * (L + z));
  }

  /**
   * Stress distribution using Boussinesq
   */
  static stressDistributionBoussinesq(
    Q: number,            // Point load (kN)
    z: number,            // Depth (m)
    r: number             // Radial distance (m)
  ): number {
    const R = Math.sqrt(r * r + z * z);
    return (3 * Q * z * z * z) / (2 * Math.PI * Math.pow(R, 5));
  }
}

// =============================================================================
// EARTH PRESSURE
// =============================================================================

export class EarthPressure {
  /**
   * Calculate Rankine active earth pressure coefficient
   */
  static Ka(phi: number): number {
    const phi_rad = phi * Math.PI / 180;
    return Math.pow(Math.tan(Math.PI / 4 - phi_rad / 2), 2);
  }

  /**
   * Calculate Rankine passive earth pressure coefficient
   */
  static Kp(phi: number): number {
    const phi_rad = phi * Math.PI / 180;
    return Math.pow(Math.tan(Math.PI / 4 + phi_rad / 2), 2);
  }

  /**
   * Calculate Coulomb active earth pressure coefficient
   */
  static KaCoulomb(
    phi: number,          // Soil friction angle
    delta: number,        // Wall friction angle
    alpha: number = 0,    // Backfill slope angle
    beta: number = 90     // Wall inclination from horizontal
  ): number {
    const phi_rad = phi * Math.PI / 180;
    const delta_rad = delta * Math.PI / 180;
    const alpha_rad = alpha * Math.PI / 180;
    const beta_rad = beta * Math.PI / 180;
    
    const num = Math.pow(Math.sin(beta_rad - phi_rad), 2);
    const den1 = Math.pow(Math.sin(beta_rad), 2) * Math.sin(beta_rad + delta_rad);
    const term = Math.sqrt((Math.sin(phi_rad + delta_rad) * Math.sin(phi_rad - alpha_rad)) /
                          (Math.sin(beta_rad + delta_rad) * Math.sin(beta_rad + alpha_rad)));
    const den2 = Math.pow(1 + term, 2);
    
    return num / (den1 * den2);
  }

  /**
   * Calculate active earth pressure distribution
   */
  static activePressureDistribution(
    wall: RetainingWallParams,
    depths: number[]
  ): { depth: number; pressure: number; moment: number }[] {
    const Ka = this.Ka(wall.backfillProperties.frictionAngle);
    const gamma = wall.backfillProperties.unitWeight;
    const c = wall.backfillProperties.cohesion;
    
    return depths.map(z => {
      // σa = Ka * γ * z - 2c√Ka + q * Ka
      const surcharge = wall.surcharge || 0;
      const pressure = Ka * gamma * z - 2 * c * Math.sqrt(Ka) + surcharge * Ka;
      const moment = Math.max(0, pressure) * (wall.height - z);
      
      return { depth: z, pressure: Math.max(0, pressure), moment };
    });
  }

  /**
   * Calculate total active thrust
   */
  static totalActiveThrust(
    wall: RetainingWallParams
  ): { force: number; location: number } {
    const Ka = this.Ka(wall.backfillProperties.frictionAngle);
    const gamma = wall.backfillProperties.unitWeight;
    const H = wall.height;
    const c = wall.backfillProperties.cohesion;
    const q = wall.surcharge || 0;
    
    // Triangular pressure from soil
    const Pa1 = 0.5 * Ka * gamma * H * H;
    const y1 = H / 3;
    
    // Reduction from cohesion
    const zc = 2 * c / (gamma * Math.sqrt(Ka)); // Depth of tension crack
    
    // Rectangular pressure from surcharge
    const Pa2 = q * Ka * H;
    const y2 = H / 2;
    
    const totalForce = Pa1 + Pa2;
    const location = (Pa1 * y1 + Pa2 * y2) / totalForce;
    
    return { force: totalForce, location };
  }

  /**
   * Calculate passive earth pressure
   */
  static totalPassiveThrust(
    phi: number,
    gamma: number,
    H: number,
    c: number = 0
  ): { force: number; location: number } {
    const Kp = this.Kp(phi);
    
    const Pp = 0.5 * Kp * gamma * H * H + 2 * c * Math.sqrt(Kp) * H;
    
    return { force: Pp, location: H / 3 };
  }

  /**
   * Calculate at-rest earth pressure
   */
  static atRestPressure(
    gamma: number,
    H: number,
    K0: number
  ): { force: number; location: number } {
    const P0 = 0.5 * K0 * gamma * H * H;
    return { force: P0, location: H / 3 };
  }
}

// =============================================================================
// SLOPE STABILITY
// =============================================================================

export class SlopeStability {
  /**
   * Infinite slope analysis (dry)
   */
  static infiniteSlopeDry(
    beta: number,         // Slope angle (degrees)
    phi: number           // Friction angle (degrees)
  ): number {
    const beta_rad = beta * Math.PI / 180;
    const phi_rad = phi * Math.PI / 180;
    
    return Math.tan(phi_rad) / Math.tan(beta_rad);
  }

  /**
   * Infinite slope analysis (with seepage parallel to slope)
   */
  static infiniteSlopeWithSeepage(
    beta: number,
    phi: number,
    gamma: number,
    gammaSat: number
  ): number {
    const beta_rad = beta * Math.PI / 180;
    const phi_rad = phi * Math.PI / 180;
    const gammaW = 9.81;
    const gammaSub = gammaSat - gammaW;
    
    return (gammaSub / gammaSat) * (Math.tan(phi_rad) / Math.tan(beta_rad));
  }

  /**
   * Culmann method for planar failure
   */
  static culmannMethod(
    H: number,            // Slope height (m)
    beta: number,         // Slope angle (degrees)
    phi: number,          // Friction angle (degrees)
    c: number,            // Cohesion (kPa)
    gamma: number         // Unit weight (kN/m³)
  ): { FOS: number; criticalAngle: number } {
    const beta_rad = beta * Math.PI / 180;
    const phi_rad = phi * Math.PI / 180;
    
    // Critical angle
    const theta_cr = (beta + phi) / 2;
    const theta_rad = theta_cr * Math.PI / 180;
    
    // For maximum height
    const Hcr = (4 * c / gamma) * (Math.sin(beta_rad) * Math.cos(phi_rad)) /
                (1 - Math.cos(beta_rad - phi_rad));
    
    return {
      FOS: Hcr / H,
      criticalAngle: theta_cr,
    };
  }

  /**
   * Swedish Circle (Fellenius) Method
   */
  static fellenius(
    slices: {
      width: number;
      height: number;
      alpha: number;      // Base angle (degrees)
      c: number;
      phi: number;
      gamma: number;
      waterPressure?: number;
    }[]
  ): number {
    let resistingMoment = 0;
    let drivingMoment = 0;
    
    slices.forEach(slice => {
      const W = slice.gamma * slice.width * slice.height;
      const alpha_rad = slice.alpha * Math.PI / 180;
      const phi_rad = slice.phi * Math.PI / 180;
      const l = slice.width / Math.cos(alpha_rad);
      const u = slice.waterPressure || 0;
      
      // Resisting force
      const N = W * Math.cos(alpha_rad) - u * l;
      const S = slice.c * l + N * Math.tan(phi_rad);
      resistingMoment += S;
      
      // Driving force
      drivingMoment += W * Math.sin(alpha_rad);
    });
    
    return resistingMoment / drivingMoment;
  }

  /**
   * Bishop Simplified Method
   */
  static bishopSimplified(
    slices: {
      width: number;
      height: number;
      alpha: number;
      c: number;
      phi: number;
      gamma: number;
      waterPressure?: number;
    }[],
    tolerance: number = 0.001,
    maxIterations: number = 100
  ): number {
    let FOS = 1.5; // Initial guess
    
    for (let iter = 0; iter < maxIterations; iter++) {
      let numerator = 0;
      let denominator = 0;
      
      slices.forEach(slice => {
        const W = slice.gamma * slice.width * slice.height;
        const alpha_rad = slice.alpha * Math.PI / 180;
        const phi_rad = slice.phi * Math.PI / 180;
        const b = slice.width;
        const u = slice.waterPressure || 0;
        
        const m_alpha = Math.cos(alpha_rad) + 
                       (Math.sin(alpha_rad) * Math.tan(phi_rad)) / FOS;
        
        numerator += (slice.c * b + (W - u * b) * Math.tan(phi_rad)) / m_alpha;
        denominator += W * Math.sin(alpha_rad);
      });
      
      const newFOS = numerator / denominator;
      
      if (Math.abs(newFOS - FOS) < tolerance) {
        return newFOS;
      }
      
      FOS = newFOS;
    }
    
    return FOS;
  }

  /**
   * Taylor's Stability Charts (simplified)
   */
  static taylorStabilityNumber(
    H: number,
    c: number,
    gamma: number,
    FOS: number
  ): number {
    return c / (FOS * gamma * H);
  }
}

// =============================================================================
// PILE FOUNDATION
// =============================================================================

export class PileFoundation {
  /**
   * Calculate pile capacity (static formula)
   */
  static staticCapacity(
    pile: PileParams,
    soilLayers: SoilLayer[],
    method: 'alpha' | 'beta' | 'lambda'
  ): {
    skinFriction: number;
    endBearing: number;
    ultimate: number;
    allowable: number;
  } {
    const D = pile.diameter;
    const L = pile.length;
    const Ap = Math.PI * D * D / 4;
    const perimeter = Math.PI * D;
    
    let skinFriction = 0;
    let currentDepth = 0;
    
    for (const layer of soilLayers) {
      const layerTop = currentDepth;
      const layerBottom = currentDepth + layer.thickness;
      
      if (layerTop >= L) break;
      
      const effectiveLength = Math.min(L, layerBottom) - layerTop;
      if (effectiveLength <= 0) continue;
      
      const avgDepth = (layerTop + Math.min(L, layerBottom)) / 2;
      const sigma_v = avgDepth * layer.unitWeight;
      
      let fs: number;
      
      if (method === 'alpha') {
        // Alpha method for cohesive soils
        const Su = layer.cohesion;
        let alpha = 1;
        if (Su > 25) alpha = 0.55;
        if (Su > 70) alpha = 0.35;
        fs = alpha * Su;
      } else if (method === 'beta') {
        // Beta method for cohesionless soils
        const K = 1 - Math.sin(layer.frictionAngle * Math.PI / 180);
        const beta = K * Math.tan(layer.frictionAngle * Math.PI / 180);
        fs = beta * sigma_v;
      } else {
        // Lambda method (combined)
        const lambda = 0.2; // Simplified
        fs = lambda * (sigma_v + 2 * layer.cohesion);
      }
      
      skinFriction += fs * perimeter * effectiveLength;
      currentDepth = layerBottom;
    }
    
    // End bearing
    const tipLayer = soilLayers[soilLayers.length - 1];
    const Nc = 9; // For deep foundations
    const Nq = BearingCapacity.meyerhofFactors(tipLayer.frictionAngle).Nq;
    const sigma_v_tip = L * tipLayer.unitWeight;
    
    const qp = tipLayer.cohesion * Nc + sigma_v_tip * Nq;
    const endBearing = qp * Ap;
    
    const ultimate = skinFriction + endBearing;
    const allowable = ultimate / 2.5;
    
    return { skinFriction, endBearing, ultimate, allowable };
  }

  /**
   * Calculate pile capacity from SPT
   */
  static capacityFromSPT(
    pile: PileParams,
    avgN: number,
    tipN: number
  ): { ultimate: number; allowable: number } {
    const D = pile.diameter;
    const L = pile.length;
    const Ap = Math.PI * D * D / 4;
    const perimeter = Math.PI * D;
    
    // Meyerhof method
    const fs = 2 * avgN; // kPa
    const qp = 400 * tipN; // kPa (limited)
    
    const skinFriction = fs * perimeter * L;
    const endBearing = Math.min(qp, 15000) * Ap;
    
    const ultimate = skinFriction + endBearing;
    
    return { ultimate, allowable: ultimate / 2.5 };
  }

  /**
   * Calculate pile group efficiency
   */
  static groupEfficiency(
    n: number,             // Number of piles in a row
    m: number,             // Number of rows
    s: number,             // Spacing (m)
    d: number              // Pile diameter (m)
  ): number {
    // Converse-Labarre formula
    const theta = Math.atan(d / s) * 180 / Math.PI;
    return 1 - (theta / 90) * ((m - 1) * n + (n - 1) * m) / (2 * m * n);
  }

  /**
   * Calculate pile settlement
   */
  static pileSettlement(
    Q: number,             // Load (kN)
    pile: PileParams,
    Es: number             // Soil modulus (kPa)
  ): number {
    const D = pile.diameter;
    const L = pile.length;
    const Ap = Math.PI * D * D / 4;
    const Ep = 30000000;   // Pile modulus (kPa) - concrete
    
    // Elastic shortening
    const elastic = Q * L / (Ap * Ep);
    
    // Settlement at tip (simplified)
    const Ip = 0.5; // Influence factor
    const tipSettlement = Q * Ip / (Es * D);
    
    return (elastic + tipSettlement) * 1000; // mm
  }

  /**
   * Calculate negative skin friction
   */
  static negativeSkinFriction(
    pile: PileParams,
    fillThickness: number,
    fillUnitWeight: number,
    beta: number = 0.25
  ): number {
    const perimeter = Math.PI * pile.diameter;
    const sigma_v = fillThickness * fillUnitWeight;
    
    return beta * sigma_v * perimeter * fillThickness;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const soilMechanics = new SoilMechanics();
export default {
  SoilMechanics,
  BearingCapacity,
  SettlementAnalysis,
  EarthPressure,
  SlopeStability,
  PileFoundation,
};
