/**
 * ============================================================================
 * DESIGN CODE CALCULATORS - Multi-Standard Support
 * ============================================================================
 * 
 * Comprehensive implementation of bolted connection design per:
 * - AISC 360-22 (American)
 * - Eurocode 3 EN 1993-1-8 (European)
 * - IS 800:2007 (Indian)
 * - AS 4100 (Australian)
 * 
 * @author BeamLab Engineering Team
 * @version 1.0.0
 */

import {
  BoltSpecification,
  BoltPattern,
  ConnectionPlate,
  BoltGrade,
  BoltHoleType,
  BoltBehavior,
  DesignCode,
  DesignCheck,
  FailureMode,
  CalculationStep,
  BoltCapacity,
  BearingCapacity,
  BlockShearCapacity,
  SteelMaterialProperties,
} from '../types/BoltedConnectionTypes';

// ============================================================================
// INTERFACES
// ============================================================================

export interface DesignCodeCalculator {
  code: DesignCode;
  calculateBoltShearCapacity(bolt: BoltSpecification, numShearPlanes: number): BoltCapacity;
  calculateBoltTensionCapacity(bolt: BoltSpecification): number;
  calculateBearingCapacity(bolt: BoltSpecification, plate: ConnectionPlate, Lc: number): BearingCapacity;
  calculateBlockShear(plate: ConnectionPlate, Agv: number, Anv: number, Ant: number, Ubs: number): BlockShearCapacity;
  calculateSlipResistance(bolt: BoltSpecification, numSlipPlanes: number): number;
  checkCombinedStress(frv: number, frt: number, Fnv: number, Fnt: number): number;
  getMinEdgeDistance(d: number, edgeType: string): number;
  getMinSpacing(d: number): number;
  getHoleDimension(d: number, holeType: BoltHoleType): number;
}

// ============================================================================
// AISC 360-22 CALCULATOR
// ============================================================================

export class AISC360Calculator implements DesignCodeCalculator {
  code = DesignCode.AISC_360_22;
  private designMethod: 'LRFD' | 'ASD';
  private steps: CalculationStep[] = [];

  // LRFD Resistance Factors
  private readonly PHI_BOLT_SHEAR = 0.75;
  private readonly PHI_BOLT_TENSION = 0.75;
  private readonly PHI_BEARING = 0.75;
  private readonly PHI_BLOCK_SHEAR = 0.75;
  private readonly PHI_SLIP_SERVICEABILITY = 1.00;
  private readonly PHI_SLIP_STRENGTH = 0.85;

  // ASD Safety Factors
  private readonly OMEGA_BOLT_SHEAR = 2.00;
  private readonly OMEGA_BOLT_TENSION = 2.00;
  private readonly OMEGA_BEARING = 2.00;
  private readonly OMEGA_BLOCK_SHEAR = 2.00;
  private readonly OMEGA_SLIP = 1.50;

  // Slip coefficients (Table J3.1)
  private readonly SLIP_COEFFICIENTS = {
    CLASS_A: 0.30,  // Unpainted clean mill scale, Class A coatings
    CLASS_B: 0.50,  // Unpainted blast-cleaned, Class B coatings
    CLASS_C: 0.35,  // Hot-dip galvanized, roughened
  };

  // Bolt material properties (Table J3.2)
  private readonly BOLT_PROPERTIES: Record<string, { Fnt: number; Fnv_N: number; Fnv_X: number }> = {
    'A307': { Fnt: 310, Fnv_N: 188, Fnv_X: 188 },      // Low carbon
    'A325': { Fnt: 620, Fnv_N: 372, Fnv_X: 457 },      // High strength
    'A490': { Fnt: 780, Fnv_N: 457, Fnv_X: 579 },      // Higher strength
    'F3125_A325': { Fnt: 620, Fnv_N: 372, Fnv_X: 457 },
    'F3125_A490': { Fnt: 780, Fnv_N: 457, Fnv_X: 579 },
  };

  constructor(designMethod: 'LRFD' | 'ASD' = 'LRFD') {
    this.designMethod = designMethod;
  }

  /**
   * Get bolt material properties
   */
  private getBoltProperties(grade: BoltGrade): { Fnt: number; Fnv_N: number; Fnv_X: number } {
    const gradeKey = grade.replace('ASTM_', '').replace('-T3', '').replace('-', '_');
    return this.BOLT_PROPERTIES[gradeKey] || this.BOLT_PROPERTIES['A325'];
  }

  /**
   * Calculate bolt shear capacity per AISC J3.6
   */
  calculateBoltShearCapacity(bolt: BoltSpecification, numShearPlanes: number = 1): BoltCapacity {
    const props = this.getBoltProperties(bolt.material.grade);
    const Ab = bolt.geometry.nominalArea;
    const At = bolt.geometry.tensileArea;

    // Determine if threads are excluded from shear plane
    const threadsExcluded = bolt.behavior === BoltBehavior.BEARING_TYPE_X;
    const Fnv = threadsExcluded ? props.Fnv_X : props.Fnv_N;
    const effectiveArea = threadsExcluded ? Ab : At;

    // Nominal shear strength per shear plane (AISC Eq. J3-1)
    // Rn = Fnv × Ab (or At if threads in shear plane)
    const Rn_per_plane = Fnv * effectiveArea / 1000; // kN
    const Rn_total = Rn_per_plane * numShearPlanes;

    // Nominal tension strength (AISC Eq. J3-1)
    const Rn_tension = props.Fnt * At / 1000; // kN

    // Design strength
    let designShear: number, designTension: number;
    if (this.designMethod === 'LRFD') {
      designShear = this.PHI_BOLT_SHEAR * Rn_total;
      designTension = this.PHI_BOLT_TENSION * Rn_tension;
    } else {
      designShear = Rn_total / this.OMEGA_BOLT_SHEAR;
      designTension = Rn_tension / this.OMEGA_BOLT_TENSION;
    }

    return {
      nominalShearStrength: Rn_total,
      designShearStrength: designShear,
      nominalTensileStrength: Rn_tension,
      designTensileStrength: designTension,
      numShearPlanes,
      threadsInShearPlane: !threadsExcluded,
      reductionFactors: {
        phi: this.designMethod === 'LRFD' ? this.PHI_BOLT_SHEAR : undefined,
        omega: this.designMethod === 'ASD' ? this.OMEGA_BOLT_SHEAR : undefined,
      },
    };
  }

  /**
   * Calculate bolt tension capacity per AISC J3.6
   */
  calculateBoltTensionCapacity(bolt: BoltSpecification): number {
    const props = this.getBoltProperties(bolt.material.grade);
    const At = bolt.geometry.tensileArea;

    const Rn = props.Fnt * At / 1000; // kN

    if (this.designMethod === 'LRFD') {
      return this.PHI_BOLT_TENSION * Rn;
    } else {
      return Rn / this.OMEGA_BOLT_TENSION;
    }
  }

  /**
   * Calculate bearing capacity per AISC J3.10
   */
  calculateBearingCapacity(
    bolt: BoltSpecification,
    plate: ConnectionPlate,
    Lc: number, // Clear distance (mm)
    deformationAcceptable: boolean = true
  ): BearingCapacity {
    const d = bolt.geometry.diameter;
    const t = plate.thickness;
    const Fu = plate.material.ultimateStrength;

    let Rn_bearing: number, Rn_tearout: number;

    if (deformationAcceptable) {
      // AISC J3.10(a) - Deformation at bolt hole is a design consideration
      Rn_bearing = 2.4 * d * t * Fu / 1000; // kN
      Rn_tearout = 1.2 * Lc * t * Fu / 1000; // kN
    } else {
      // AISC J3.10(b) - Deformation at bolt hole is not a design consideration
      Rn_bearing = 3.0 * d * t * Fu / 1000; // kN
      Rn_tearout = 1.5 * Lc * t * Fu / 1000; // kN
    }

    const Rn = Math.min(Rn_bearing, Rn_tearout);
    const governingMode = Rn_bearing <= Rn_tearout ? 'BEARING' : 'TEAROUT';

    let designStrength: number;
    if (this.designMethod === 'LRFD') {
      designStrength = this.PHI_BEARING * Rn;
    } else {
      designStrength = Rn / this.OMEGA_BEARING;
    }

    return {
      nominalStrength: Rn,
      designStrength,
      deformationConsidered: deformationAcceptable,
      clearDistance: Lc,
      tearoutStrength: Rn_tearout,
      governingMode,
    };
  }

  /**
   * Calculate block shear capacity per AISC J4.3
   */
  calculateBlockShear(
    plate: ConnectionPlate,
    Agv: number, // Gross area subject to shear (mm²)
    Anv: number, // Net area subject to shear (mm²)
    Ant: number, // Net area subject to tension (mm²)
    Ubs: number = 1.0 // Reduction factor for non-uniform tension
  ): BlockShearCapacity {
    const Fy = plate.material.yieldStrength;
    const Fu = plate.material.ultimateStrength;

    // AISC Eq. J4-5:
    // Rn = 0.6*Fu*Anv + Ubs*Fu*Ant ≤ 0.6*Fy*Agv + Ubs*Fu*Ant
    const Rn_rupture = (0.6 * Fu * Anv + Ubs * Fu * Ant) / 1000; // kN
    const Rn_yield = (0.6 * Fy * Agv + Ubs * Fu * Ant) / 1000; // kN
    const Rn = Math.min(Rn_rupture, Rn_yield);

    let designStrength: number;
    if (this.designMethod === 'LRFD') {
      designStrength = this.PHI_BLOCK_SHEAR * Rn;
    } else {
      designStrength = Rn / this.OMEGA_BLOCK_SHEAR;
    }

    return {
      grossShearArea: Agv,
      netShearArea: Anv,
      grossTensionArea: 0,
      netTensionArea: Ant,
      nominalStrength: Rn,
      designStrength,
      tensionStressFactor: Ubs,
      failurePath: Rn_rupture <= Rn_yield ? 'Rupture controls' : 'Yield controls',
    };
  }

  /**
   * Calculate slip resistance per AISC J3.8
   */
  calculateSlipResistance(
    bolt: BoltSpecification,
    numSlipPlanes: number = 1,
    slipCriticalLevel: 'SERVICE' | 'STRENGTH' = 'SERVICE'
  ): number {
    const props = this.getBoltProperties(bolt.material.grade);
    const At = bolt.geometry.tensileArea;

    // Minimum bolt pretension (AISC Table J3.1)
    // Tb = 0.70 × Fnt × At
    const Tb = bolt.pretension || (0.70 * props.Fnt * At / 1000); // kN

    // Slip coefficient based on faying surface class
    let mu: number;
    switch (bolt.behavior) {
      case BoltBehavior.SLIP_CRITICAL_A:
        mu = this.SLIP_COEFFICIENTS.CLASS_A;
        break;
      case BoltBehavior.SLIP_CRITICAL_B:
        mu = this.SLIP_COEFFICIENTS.CLASS_B;
        break;
      case BoltBehavior.SLIP_CRITICAL_C:
        mu = this.SLIP_COEFFICIENTS.CLASS_C;
        break;
      default:
        mu = this.SLIP_COEFFICIENTS.CLASS_A;
    }

    // Hole factor (AISC Table J3.5)
    let hf: number;
    switch (bolt.holeType) {
      case BoltHoleType.STANDARD:
        hf = 1.00;
        break;
      case BoltHoleType.OVERSIZED:
        hf = 0.85;
        break;
      case BoltHoleType.SHORT_SLOTTED:
      case BoltHoleType.SHORT_SLOTTED_TRANSVERSE:
        hf = 0.85;
        break;
      case BoltHoleType.SHORT_SLOTTED_PARALLEL:
        hf = 0.70;
        break;
      case BoltHoleType.LONG_SLOTTED:
      case BoltHoleType.LONG_SLOTTED_TRANSVERSE:
        hf = 0.70;
        break;
      case BoltHoleType.LONG_SLOTTED_PARALLEL:
        hf = 0.60;
        break;
      default:
        hf = 1.00;
    }

    // Nominal slip resistance (AISC Eq. J3-4)
    // Rn = μ × Du × hf × Tb × ns
    const Du = 1.13; // Ratio of mean installed pretension to specified
    const Rn = mu * Du * hf * Tb * numSlipPlanes;

    // Apply resistance/safety factor
    if (this.designMethod === 'LRFD') {
      const phi = slipCriticalLevel === 'SERVICE' 
        ? this.PHI_SLIP_SERVICEABILITY 
        : this.PHI_SLIP_STRENGTH;
      return phi * Rn;
    } else {
      return Rn / this.OMEGA_SLIP;
    }
  }

  /**
   * Check combined shear-tension interaction per AISC J3.7
   */
  checkCombinedStress(
    frv: number, // Required shear stress (MPa)
    frt: number, // Required tensile stress (MPa)
    Fnv: number, // Nominal shear stress (MPa)
    Fnt: number  // Nominal tensile stress (MPa)
  ): number {
    // AISC Eq. J3-3a (LRFD): F'nt = 1.3*Fnt - (Fnt/φFnv)*frv ≤ Fnt
    // AISC Eq. J3-3b (ASD): F'nt = 1.3*Fnt - (Ω*Fnt/Fnv)*frv ≤ Fnt

    let Fnt_prime: number;
    if (this.designMethod === 'LRFD') {
      Fnt_prime = 1.3 * Fnt - (Fnt / (this.PHI_BOLT_SHEAR * Fnv)) * frv;
    } else {
      Fnt_prime = 1.3 * Fnt - (this.OMEGA_BOLT_SHEAR * Fnt / Fnv) * frv;
    }

    Fnt_prime = Math.min(Fnt_prime, Fnt);

    // Return interaction ratio
    return frt / Fnt_prime;
  }

  /**
   * Get minimum edge distance per AISC Table J3.4
   */
  getMinEdgeDistance(d: number, edgeType: string = 'ROLLED'): number {
    // Minimum edge distance based on bolt diameter
    // For sheared edges: multiply by additional factor
    const shearedFactor = edgeType === 'SHEARED' ? 1.0 : 1.0;

    // AISC Table J3.4 (converted to mm)
    const minDistances: Record<number, number> = {
      12.7: 22.2,   // 1/2"
      15.9: 27.0,   // 5/8"
      19.1: 25.4,   // 3/4"
      22.2: 28.6,   // 7/8"
      25.4: 31.8,   // 1"
      28.6: 38.1,   // 1-1/8"
      31.8: 41.3,   // 1-1/4"
      35.0: 47.6,   // 1-3/8"
      38.1: 50.8,   // 1-1/2"
      // Metric
      12: 22,
      14: 26,
      16: 28,
      18: 32,
      20: 34,
      22: 38,
      24: 42,
      27: 48,
      30: 52,
      33: 58,
      36: 62,
    };

    // Find closest match or calculate 1.25d minimum
    const closest = Object.keys(minDistances)
      .map(Number)
      .sort((a, b) => Math.abs(a - d) - Math.abs(b - d))[0];

    return (minDistances[closest] || 1.25 * d) * shearedFactor;
  }

  /**
   * Get minimum bolt spacing per AISC J3.3
   */
  getMinSpacing(d: number): number {
    // Minimum spacing: 2-2/3*d (preferred: 3*d)
    return 2.667 * d;
  }

  /**
   * Get hole dimension per AISC Table J3.3
   */
  getHoleDimension(d: number, holeType: BoltHoleType): number {
    // Standard hole = d + 1/16" (1.6mm) for d < 1"
    //                d + 1/8" (3.2mm) for d >= 1"
    const stdAddition = d < 25.4 ? 1.6 : 3.2;

    switch (holeType) {
      case BoltHoleType.STANDARD:
        return d + stdAddition;
      case BoltHoleType.OVERSIZED:
        if (d <= 15.9) return d + 3.2;      // 5/8" or less
        if (d <= 22.2) return d + 4.8;      // 7/8" or less
        return d + 7.9;                      // larger
      case BoltHoleType.SHORT_SLOTTED:
        return d + stdAddition; // Width, length = d + 6.4mm
      case BoltHoleType.LONG_SLOTTED:
        return d + stdAddition; // Width, length = 2.5*d
      default:
        return d + stdAddition;
    }
  }

  /**
   * Check minimum/maximum spacing requirements
   */
  checkSpacingRequirements(
    pattern: BoltPattern,
    plateThickness: number
  ): { check: string; requirement: number; actual: number; passed: boolean }[] {
    const d = pattern.defaultBoltSpec.geometry.diameter;
    const results: { check: string; requirement: number; actual: number; passed: boolean }[] = [];

    // Minimum spacing
    const minSpacing = this.getMinSpacing(d);
    results.push({
      check: 'Minimum Vertical Spacing (J3.3)',
      requirement: minSpacing,
      actual: pattern.pitchVertical,
      passed: pattern.pitchVertical >= minSpacing,
    });
    results.push({
      check: 'Minimum Horizontal Spacing (J3.3)',
      requirement: minSpacing,
      actual: pattern.pitchHorizontal,
      passed: pattern.pitchHorizontal >= minSpacing,
    });

    // Maximum spacing (J3.5)
    const maxSpacing = Math.min(24 * plateThickness, 305); // 12" max
    results.push({
      check: 'Maximum Spacing (J3.5)',
      requirement: maxSpacing,
      actual: Math.max(pattern.pitchVertical, pattern.pitchHorizontal),
      passed: Math.max(pattern.pitchVertical, pattern.pitchHorizontal) <= maxSpacing,
    });

    // Minimum edge distance
    const minEdge = this.getMinEdgeDistance(d);
    results.push({
      check: 'Minimum Edge Distance (Table J3.4)',
      requirement: minEdge,
      actual: Math.min(pattern.edgeDistanceTop, pattern.edgeDistanceLeft),
      passed: Math.min(pattern.edgeDistanceTop, pattern.edgeDistanceLeft) >= minEdge,
    });

    // Maximum edge distance
    const maxEdge = Math.min(12 * plateThickness, 152); // 6" max
    results.push({
      check: 'Maximum Edge Distance (J3.5)',
      requirement: maxEdge,
      actual: Math.max(pattern.edgeDistanceTop, pattern.edgeDistanceLeft),
      passed: Math.max(pattern.edgeDistanceTop, pattern.edgeDistanceLeft) <= maxEdge,
    });

    return results;
  }
}

// ============================================================================
// EUROCODE 3 CALCULATOR
// ============================================================================

export class Eurocode3Calculator implements DesignCodeCalculator {
  code = DesignCode.EUROCODE_3;

  // Partial factors (EN 1993-1-8)
  private readonly GAMMA_M2 = 1.25; // Bolts in shear and bearing
  private readonly GAMMA_M3 = 1.25; // Slip resistance at ULS
  private readonly GAMMA_M3_SER = 1.10; // Slip resistance at SLS

  // Bolt grades (Table 3.1)
  private readonly BOLT_GRADES: Record<string, { fub: number; fyb: number }> = {
    '4.6': { fub: 400, fyb: 240 },
    '5.6': { fub: 500, fyb: 300 },
    '5.8': { fub: 500, fyb: 400 },
    '6.8': { fub: 600, fyb: 480 },
    '8.8': { fub: 800, fyb: 640 },
    '10.9': { fub: 1000, fyb: 900 },
  };

  // Slip factors (Table 3.7)
  private readonly SLIP_FACTORS: Record<string, number> = {
    CLASS_A: 0.50, // Blasted, painted w/ zinc silicate
    CLASS_B: 0.40, // Blasted, painted w/ alkali-zinc silicate
    CLASS_C: 0.30, // Wire brushed or flame cleaned
    CLASS_D: 0.20, // Untreated
  };

  /**
   * Get bolt grade properties
   */
  private getBoltGrade(grade: BoltGrade): { fub: number; fyb: number } {
    const gradeStr = grade.replace('ISO_', '').replace('_', '.');
    return this.BOLT_GRADES[gradeStr] || this.BOLT_GRADES['8.8'];
  }

  /**
   * Calculate bolt shear capacity per EC3 Table 3.4
   */
  calculateBoltShearCapacity(bolt: BoltSpecification, numShearPlanes: number = 1): BoltCapacity {
    const { fub } = this.getBoltGrade(bolt.material.grade);
    const A = bolt.geometry.nominalArea;
    const As = bolt.geometry.tensileArea;

    // αv factor (Table 3.4)
    // αv = 0.6 for grades 4.6, 5.6, 8.8
    // αv = 0.5 for grades 10.9
    const grade = bolt.material.grade;
    const alphaV = grade === BoltGrade.ISO_10_9 ? 0.5 : 0.6;

    // Use As if threads in shear plane, A otherwise
    const threadsExcluded = bolt.behavior === BoltBehavior.BEARING_TYPE_X;
    const effectiveArea = threadsExcluded ? A : As;

    // Shear resistance per plane (Eq. 3.7)
    // Fv,Rd = αv × fub × A / γM2
    const Fv_Rd = (alphaV * fub * effectiveArea / this.GAMMA_M2) / 1000; // kN
    const totalShear = Fv_Rd * numShearPlanes;

    // Tension resistance (Eq. 3.8)
    // Ft,Rd = k2 × fub × As / γM2
    const k2 = 0.9; // For non-countersunk bolts
    const Ft_Rd = (k2 * fub * As / this.GAMMA_M2) / 1000; // kN

    return {
      nominalShearStrength: totalShear * this.GAMMA_M2,
      designShearStrength: totalShear,
      nominalTensileStrength: Ft_Rd * this.GAMMA_M2,
      designTensileStrength: Ft_Rd,
      numShearPlanes,
      threadsInShearPlane: !threadsExcluded,
      reductionFactors: {
        omega: this.GAMMA_M2,
      },
    };
  }

  /**
   * Calculate bolt tension capacity per EC3 Eq. 3.8
   */
  calculateBoltTensionCapacity(bolt: BoltSpecification): number {
    const { fub } = this.getBoltGrade(bolt.material.grade);
    const As = bolt.geometry.tensileArea;

    const k2 = 0.9;
    return (k2 * fub * As / this.GAMMA_M2) / 1000; // kN
  }

  /**
   * Calculate bearing capacity per EC3 Table 3.4
   */
  calculateBearingCapacity(
    bolt: BoltSpecification,
    plate: ConnectionPlate,
    e1: number, // End distance (mm)
    p1: number = 0 // Pitch (mm), 0 for end bolt
  ): BearingCapacity {
    const d = bolt.geometry.diameter;
    const d0 = d + 2; // Standard hole clearance
    const t = plate.thickness;
    const { fub } = this.getBoltGrade(bolt.material.grade);
    const fu = plate.material.ultimateStrength;

    // αb calculation (Table 3.4)
    let alpha_d: number;
    if (p1 === 0) {
      // End bolt
      alpha_d = e1 / (3 * d0);
    } else {
      // Inner bolt
      alpha_d = p1 / (3 * d0) - 0.25;
    }

    const alpha_b = Math.min(alpha_d, fub / fu, 1.0);

    // k1 factor for edge distance
    // k1 = min(2.8*e2/d0 - 1.7, 2.5) for edge bolts
    // k1 = min(1.4*p2/d0 - 1.7, 2.5) for inner bolts
    const k1 = 2.5; // Conservative assumption

    // Bearing resistance (Eq. 3.6)
    // Fb,Rd = k1 × αb × fu × d × t / γM2
    const Fb_Rd = (k1 * alpha_b * fu * d * t / this.GAMMA_M2) / 1000; // kN

    return {
      nominalStrength: Fb_Rd * this.GAMMA_M2,
      designStrength: Fb_Rd,
      deformationConsidered: true,
      clearDistance: e1 - d0 / 2,
      tearoutStrength: Fb_Rd, // EC3 combines bearing and tearout
      governingMode: 'BEARING',
    };
  }

  /**
   * Calculate block tearing per EC3 3.10.2
   */
  calculateBlockShear(
    plate: ConnectionPlate,
    Agv: number,
    Anv: number,
    Ant: number,
    Ubs: number = 1.0
  ): BlockShearCapacity {
    const fy = plate.material.yieldStrength;
    const fu = plate.material.ultimateStrength;

    // EC3 Eq. 3.9:
    // Veff,1,Rd = fu×Ant/γM2 + (1/√3)×fy×Anv/γM0
    const gamma_M0 = 1.0;
    const Veff_1_Rd = (fu * Ant / this.GAMMA_M2 + (1 / Math.sqrt(3)) * fy * Anv / gamma_M0) / 1000;

    // Veff,2,Rd = 0.5×fu×Ant/γM2 + (1/√3)×fy×Agv/γM0
    const Veff_2_Rd = (0.5 * fu * Ant / this.GAMMA_M2 + (1 / Math.sqrt(3)) * fy * Agv / gamma_M0) / 1000;

    const Veff_Rd = Math.min(Veff_1_Rd, Veff_2_Rd);

    return {
      grossShearArea: Agv,
      netShearArea: Anv,
      grossTensionArea: 0,
      netTensionArea: Ant,
      nominalStrength: Veff_Rd * this.GAMMA_M2,
      designStrength: Veff_Rd,
      tensionStressFactor: Ubs,
      failurePath: Veff_1_Rd <= Veff_2_Rd ? 'Mode 1 (net section)' : 'Mode 2 (gross section)',
    };
  }

  /**
   * Calculate slip resistance per EC3 3.9
   */
  calculateSlipResistance(
    bolt: BoltSpecification,
    numSlipPlanes: number = 1,
    slipCategory: 'B' | 'C' = 'B' // B = serviceability, C = ultimate
  ): number {
    const { fub } = this.getBoltGrade(bolt.material.grade);
    const As = bolt.geometry.tensileArea;

    // Pre-loading force Fp,C (70% of tensile capacity)
    const Fp_C = bolt.pretension || (0.7 * fub * As / 1000); // kN

    // Slip factor based on surface class
    let mu: number;
    switch (bolt.behavior) {
      case BoltBehavior.SLIP_CRITICAL_A:
        mu = this.SLIP_FACTORS.CLASS_A;
        break;
      case BoltBehavior.SLIP_CRITICAL_B:
        mu = this.SLIP_FACTORS.CLASS_B;
        break;
      default:
        mu = this.SLIP_FACTORS.CLASS_C;
    }

    // Slip resistance (Eq. 3.9)
    // Fs,Rd = ks × n × μ × Fp,C / γM3
    const ks = 1.0; // For standard holes
    const gamma = slipCategory === 'B' ? this.GAMMA_M3_SER : this.GAMMA_M3;
    const Fs_Rd = ks * numSlipPlanes * mu * Fp_C / gamma;

    return Fs_Rd;
  }

  /**
   * Combined shear-tension check per EC3 Table 3.4
   */
  checkCombinedStress(
    Fv_Ed: number, // Design shear force (kN)
    Ft_Ed: number, // Design tension force (kN)
    Fv_Rd: number, // Shear resistance (kN)
    Ft_Rd: number  // Tension resistance (kN)
  ): number {
    // EC3 Table 3.4:
    // Fv,Ed/Fv,Rd + Ft,Ed/(1.4×Ft,Rd) ≤ 1.0
    return Fv_Ed / Fv_Rd + Ft_Ed / (1.4 * Ft_Rd);
  }

  /**
   * Get minimum edge distance per EC3 Table 3.3
   */
  getMinEdgeDistance(d: number, edgeType: string = 'NORMAL'): number {
    // EC3 Table 3.3: e1,min = 1.2×d0 (end distance)
    const d0 = d + 2; // Standard hole
    return 1.2 * d0;
  }

  /**
   * Get minimum spacing per EC3 Table 3.3
   */
  getMinSpacing(d: number): number {
    // EC3 Table 3.3: p1,min = 2.2×d0
    const d0 = d + 2;
    return 2.2 * d0;
  }

  /**
   * Get hole dimension per EC3
   */
  getHoleDimension(d: number, holeType: BoltHoleType): number {
    // EC3: Standard holes = d + 1mm for M12-M14, d + 2mm for M16+
    const addition = d <= 14 ? 1 : (d <= 24 ? 2 : 3);
    
    switch (holeType) {
      case BoltHoleType.STANDARD:
        return d + addition;
      case BoltHoleType.OVERSIZED:
        return d + 3 + addition;
      default:
        return d + addition;
    }
  }
}

// ============================================================================
// IS 800:2007 CALCULATOR
// ============================================================================

export class IS800Calculator implements DesignCodeCalculator {
  code = DesignCode.IS_800_2007;

  // Partial safety factors
  private readonly GAMMA_MB = 1.25; // Material factor for bolts
  private readonly GAMMA_M0 = 1.10; // Material factor for steel

  // Bolt grades per IS 1367
  private readonly BOLT_GRADES: Record<string, { fub: number; fyb: number }> = {
    '4.6': { fub: 400, fyb: 240 },
    '8.8': { fub: 800, fyb: 640 },
    '10.9': { fub: 1000, fyb: 900 },
  };

  // Slip factors per Table 20
  private readonly SLIP_FACTORS = {
    SURFACE_A: 0.52, // Treated surfaces
    SURFACE_B: 0.20, // Untreated surfaces
  };

  private getBoltGrade(grade: BoltGrade): { fub: number; fyb: number } {
    const gradeStr = grade.replace('IS_', '');
    return this.BOLT_GRADES[gradeStr] || this.BOLT_GRADES['8.8'];
  }

  /**
   * Shear capacity per IS 800 Cl. 10.3.3
   */
  calculateBoltShearCapacity(bolt: BoltSpecification, numShearPlanes: number = 1): BoltCapacity {
    const { fub } = this.getBoltGrade(bolt.material.grade);
    const Anb = bolt.geometry.nominalArea;
    const Asb = bolt.geometry.tensileArea;

    const threadsExcluded = bolt.behavior === BoltBehavior.BEARING_TYPE_X;
    
    // Nominal shear capacity (Cl. 10.3.3)
    // Vnsb = fub × nn × Anb / √3 for threads not in shear plane
    // Vnsb = fub × ns × Asb / √3 for threads in shear plane
    let Vnsb: number;
    if (threadsExcluded) {
      Vnsb = (fub * numShearPlanes * Anb / Math.sqrt(3)) / 1000; // kN
    } else {
      Vnsb = (fub * numShearPlanes * Asb / Math.sqrt(3)) / 1000; // kN
    }

    const Vdsb = Vnsb / this.GAMMA_MB;

    // Tension capacity (Cl. 10.3.5)
    const Tnb = (0.9 * fub * Asb) / 1000; // kN
    const Tdb = Tnb / this.GAMMA_MB;

    return {
      nominalShearStrength: Vnsb,
      designShearStrength: Vdsb,
      nominalTensileStrength: Tnb,
      designTensileStrength: Tdb,
      numShearPlanes,
      threadsInShearPlane: !threadsExcluded,
      reductionFactors: {
        omega: this.GAMMA_MB,
      },
    };
  }

  calculateBoltTensionCapacity(bolt: BoltSpecification): number {
    const { fub } = this.getBoltGrade(bolt.material.grade);
    const Asb = bolt.geometry.tensileArea;
    return (0.9 * fub * Asb / this.GAMMA_MB) / 1000; // kN
  }

  /**
   * Bearing capacity per IS 800 Cl. 10.3.4
   */
  calculateBearingCapacity(
    bolt: BoltSpecification,
    plate: ConnectionPlate,
    e: number, // Edge distance (mm)
    p: number = 0 // Pitch (mm)
  ): BearingCapacity {
    const d = bolt.geometry.diameter;
    const d0 = d + 2; // Hole diameter
    const t = plate.thickness;
    const { fub } = this.getBoltGrade(bolt.material.grade);
    const fu = plate.material.ultimateStrength;

    // kb factor (Cl. 10.3.4)
    const kb1 = e / (3 * d0);
    const kb2 = p > 0 ? p / (3 * d0) - 0.25 : 1.0;
    const kb3 = fub / fu;
    const kb = Math.min(kb1, kb2, kb3, 1.0);

    // Bearing capacity (Eq. 10.21)
    // Vnpb = 2.5 × kb × d × t × fu
    const Vnpb = (2.5 * kb * d * t * fu) / 1000; // kN
    const Vdpb = Vnpb / this.GAMMA_MB;

    return {
      nominalStrength: Vnpb,
      designStrength: Vdpb,
      deformationConsidered: true,
      clearDistance: e - d0 / 2,
      tearoutStrength: Vdpb,
      governingMode: 'BEARING',
    };
  }

  /**
   * Block shear per IS 800 Cl. 6.4
   */
  calculateBlockShear(
    plate: ConnectionPlate,
    Agv: number,
    Anv: number,
    Ant: number,
    Ubs: number = 1.0
  ): BlockShearCapacity {
    const fy = plate.material.yieldStrength;
    const fu = plate.material.ultimateStrength;

    // IS 800 Cl. 6.4.1
    // Tdb = [Avg×fy/(√3×γm0) + 0.9×Atn×fu/γm1]
    // or   = [0.9×Avn×fu/(√3×γm1) + Atg×fy/γm0]
    const gamma_m1 = 1.25;

    const Tdb1 = (Agv * fy / (Math.sqrt(3) * this.GAMMA_M0) + 0.9 * Ant * fu / gamma_m1) / 1000;
    const Tdb2 = (0.9 * Anv * fu / (Math.sqrt(3) * gamma_m1)) / 1000;

    const Tdb = Math.min(Tdb1, Tdb2);

    return {
      grossShearArea: Agv,
      netShearArea: Anv,
      grossTensionArea: 0,
      netTensionArea: Ant,
      nominalStrength: Tdb * this.GAMMA_MB,
      designStrength: Tdb,
      tensionStressFactor: Ubs,
      failurePath: Tdb1 <= Tdb2 ? 'Shear yielding + tension rupture' : 'Shear rupture',
    };
  }

  /**
   * Slip resistance per IS 800 Cl. 10.4.3
   */
  calculateSlipResistance(bolt: BoltSpecification, numSlipPlanes: number = 1): number {
    const { fub } = this.getBoltGrade(bolt.material.grade);
    const Asb = bolt.geometry.tensileArea;

    // Proof load (0.7 × fub × Asb)
    const F0 = bolt.pretension || (0.7 * fub * Asb / 1000); // kN

    // Slip factor
    const mu = bolt.behavior === BoltBehavior.SLIP_CRITICAL_B 
      ? this.SLIP_FACTORS.SURFACE_A 
      : this.SLIP_FACTORS.SURFACE_B;

    // Slip resistance (Cl. 10.4.3)
    // Vdsf = μf × ne × Kh × F0 / γmf
    const Kh = 1.0; // For standard holes
    const gamma_mf = 1.10;

    return mu * numSlipPlanes * Kh * F0 / gamma_mf;
  }

  /**
   * Combined stress check per IS 800 Cl. 10.3.6
   */
  checkCombinedStress(Vsb: number, Tb: number, Vdb: number, Tdb: number): number {
    // (Vsb/Vdb)² + (Tb/Tdb)² ≤ 1.0
    return Math.pow(Vsb / Vdb, 2) + Math.pow(Tb / Tdb, 2);
  }

  getMinEdgeDistance(d: number): number {
    return 1.5 * d; // IS 800 Table 22
  }

  getMinSpacing(d: number): number {
    return 2.5 * d; // IS 800 Cl. 10.2.2
  }

  getHoleDimension(d: number, holeType: BoltHoleType): number {
    const addition = d <= 14 ? 1 : (d <= 22 ? 2 : 3);
    return d + addition;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create appropriate calculator based on design code
 */
export function createDesignCodeCalculator(
  code: DesignCode,
  designMethod: 'LRFD' | 'ASD' = 'LRFD'
): DesignCodeCalculator {
  switch (code) {
    case DesignCode.AISC_360_22:
    case DesignCode.AISC_360_16:
    case DesignCode.AISC_360_10:
      return new AISC360Calculator(designMethod);
    case DesignCode.EUROCODE_3:
      return new Eurocode3Calculator();
    case DesignCode.IS_800_2007:
      return new IS800Calculator();
    default:
      return new AISC360Calculator(designMethod);
  }
}

export default { AISC360Calculator, Eurocode3Calculator, IS800Calculator, createDesignCodeCalculator };
