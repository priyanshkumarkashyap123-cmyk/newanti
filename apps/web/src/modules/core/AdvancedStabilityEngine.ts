/**
 * ============================================================================
 * ADVANCED STABILITY ANALYSIS ENGINE V3.0
 * ============================================================================
 * 
 * Comprehensive structural stability analysis:
 * - Elastic Critical Load Analysis
 * - Buckling Analysis (Euler, Inelastic)
 * - Effective Length Calculations
 * - Frame Stability (Sway/Non-sway)
 * - P-Delta Effects
 * - Lateral Torsional Buckling
 * - Local Buckling (Plate Elements)
 * - Second-Order Effects
 * 
 * Design Codes:
 * - IS 800:2007
 * - AISC 360-22
 * - EN 1993-1-1
 * - AS 4100
 * 
 * @version 3.0.0
 */

import { PrecisionMath, EngineeringMath, ENGINEERING_CONSTANTS } from './PrecisionMath';
import { EngineeringErrorHandler, ErrorSeverity } from './EngineeringErrorHandler';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type StabilityCode = 'IS800' | 'AISC360' | 'EN1993' | 'AS4100';

export type BucklingMode = 
  | 'FLEXURAL_MAJOR'
  | 'FLEXURAL_MINOR'
  | 'TORSIONAL'
  | 'FLEXURAL_TORSIONAL'
  | 'LATERAL_TORSIONAL'
  | 'LOCAL_FLANGE'
  | 'LOCAL_WEB';

export type EndCondition = 
  | 'FIXED_FIXED'
  | 'FIXED_PINNED'
  | 'PINNED_PINNED'
  | 'FIXED_FREE'
  | 'FIXED_GUIDED';

export type FrameType = 'BRACED' | 'UNBRACED' | 'PARTIALLY_BRACED';

export type SectionClass = 1 | 2 | 3 | 4;  // EN 1993 classification

export interface MemberProperties {
  length: number;           // mm
  
  // Section properties
  area: number;             // mm²
  Ixx: number;              // mm⁴ (major axis)
  Iyy: number;              // mm⁴ (minor axis)
  J?: number;               // mm⁴ (torsion constant)
  Cw?: number;              // mm⁶ (warping constant)
  
  // Radii of gyration
  rx: number;               // mm
  ry: number;               // mm
  
  // Section dimensions
  d?: number;               // mm (depth)
  bf?: number;              // mm (flange width)
  tf?: number;              // mm (flange thickness)
  tw?: number;              // mm (web thickness)
  
  // Material properties
  E: number;                // MPa
  G?: number;               // MPa (shear modulus)
  fy: number;               // MPa (yield strength)
}

export interface BucklingInput {
  member: MemberProperties;
  endCondition: EndCondition;
  frameType: FrameType;
  unbracedLengthMajor: number;   // mm
  unbracedLengthMinor: number;   // mm
  unbracedLengthLTB?: number;    // mm (for lateral-torsional buckling)
  Cb?: number;                   // Moment modification factor
  axialLoad?: number;            // kN (for combined analysis)
  momentMajor?: number;          // kN·m
  momentMinor?: number;          // kN·m
}

export interface EffectiveLengthResult {
  Kx: number;                    // Effective length factor (major axis)
  Ky: number;                    // Effective length factor (minor axis)
  Leff_x: number;                // Effective length (mm, major axis)
  Leff_y: number;                // Effective length (mm, minor axis)
  slendernessX: number;          // L/rx
  slendernessY: number;          // L/ry
  governingAxis: 'X' | 'Y';
}

export interface EulerBucklingResult {
  Pcr_x: number;                 // Critical load (kN, major axis)
  Pcr_y: number;                 // Critical load (kN, minor axis)
  Pcr_governing: number;         // Governing critical load (kN)
  sigmaCr: number;               // Critical stress (MPa)
  lambdaBar: number;             // Non-dimensional slenderness
  governingMode: BucklingMode;
}

export interface InelasticBucklingResult {
  Pn: number;                    // Nominal compressive strength (kN)
  Fcr: number;                   // Critical buckling stress (MPa)
  phi: number;                   // Resistance factor
  phiPn: number;                 // Design compressive strength (kN)
  bucklingCurve: string;         // IS800: a, b, c, d
  reductionFactor: number;       // chi or χ
}

export interface LTBResult {
  Mcr: number;                   // Elastic critical moment (kN·m)
  Mn: number;                    // Nominal moment capacity (kN·m)
  phiMn: number;                 // Design moment capacity (kN·m)
  lambdaLT: number;              // LTB slenderness
  chiLT: number;                 // LTB reduction factor
  Lp: number;                    // Limiting unbraced length for yielding (mm)
  Lr: number;                    // Limiting unbraced length for inelastic LTB (mm)
  zone: 'PLASTIC' | 'INELASTIC' | 'ELASTIC';
}

export interface LocalBucklingResult {
  sectionClass: SectionClass;
  flangeSlenderness: number;
  webSlenderness: number;
  flangeLimit: number;
  webLimit: number;
  flangeStatus: 'COMPACT' | 'NONCOMPACT' | 'SLENDER';
  webStatus: 'COMPACT' | 'NONCOMPACT' | 'SLENDER';
  effectiveArea?: number;        // mm² (for Class 4 sections)
  reductionFactorFlange?: number;
  reductionFactorWeb?: number;
}

export interface FrameStabilityResult {
  frameType: FrameType;
  elasticCriticalLoad: number;   // kN
  stabilityIndex: number;        // Q or theta_cr
  amplificationFactor: number;   // B2 or alpha_cr
  secondOrderEffects: boolean;   // Is second-order analysis required?
  recommendation: string;
}

export interface StabilityAnalysisResult {
  code: StabilityCode;
  effectiveLength: EffectiveLengthResult;
  eulerBuckling: EulerBucklingResult;
  inelasticBuckling: InelasticBucklingResult;
  ltbResult?: LTBResult;
  localBuckling: LocalBucklingResult;
  frameStability?: FrameStabilityResult;
  
  utilizationRatio: number;
  status: 'ADEQUATE' | 'INADEQUATE' | 'WARNING';
  
  summary: string;
  recommendations: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Effective length factors for ideal conditions
export const EFFECTIVE_LENGTH_FACTORS: Record<EndCondition, { theoretical: number; recommended: number }> = {
  'FIXED_FIXED': { theoretical: 0.5, recommended: 0.65 },
  'FIXED_PINNED': { theoretical: 0.7, recommended: 0.8 },
  'PINNED_PINNED': { theoretical: 1.0, recommended: 1.0 },
  'FIXED_FREE': { theoretical: 2.0, recommended: 2.1 },
  'FIXED_GUIDED': { theoretical: 1.0, recommended: 1.2 },
};

// IS 800:2007 Buckling curves
export const IS800_BUCKLING_CURVES: Record<string, { alpha: number; lambda0: number }> = {
  'a': { alpha: 0.21, lambda0: 0.2 },
  'b': { alpha: 0.34, lambda0: 0.2 },
  'c': { alpha: 0.49, lambda0: 0.2 },
  'd': { alpha: 0.76, lambda0: 0.2 },
};

// EN 1993 Imperfection factors
export const EN1993_IMPERFECTION_FACTORS: Record<string, number> = {
  'a0': 0.13,
  'a': 0.21,
  'b': 0.34,
  'c': 0.49,
  'd': 0.76,
};

// Section classification limits (EN 1993)
export const SECTION_CLASS_LIMITS = {
  flangeCompression: {
    class1: 9,
    class2: 10,
    class3: 14,
  },
  webCompression: {
    class1: 33,
    class2: 38,
    class3: 42,
  },
  webBending: {
    class1: 72,
    class2: 83,
    class3: 124,
  },
};

// ============================================================================
// STABILITY ANALYSIS ENGINE CLASS
// ============================================================================

export class AdvancedStabilityEngine {
  private code: StabilityCode;
  private errorHandler: EngineeringErrorHandler;

  constructor(code: StabilityCode = 'IS800') {
    this.code = code;
    this.errorHandler = new EngineeringErrorHandler({
      context: { module: 'StabilityEngine', function: 'constructor' }
    });
  }

  // --------------------------------------------------------------------------
  // MAIN ANALYSIS METHOD
  // --------------------------------------------------------------------------

  public analyzeStability(input: BucklingInput): StabilityAnalysisResult {
    // Validate inputs
    this.validateInput(input);
    
    // Calculate effective lengths
    const effectiveLength = this.calculateEffectiveLength(input);
    
    // Euler (elastic) buckling
    const eulerBuckling = this.calculateEulerBuckling(input, effectiveLength);
    
    // Inelastic buckling
    const inelasticBuckling = this.calculateInelasticBuckling(input, eulerBuckling);
    
    // Lateral-torsional buckling (if applicable)
    let ltbResult: LTBResult | undefined;
    if (input.momentMajor && input.momentMajor > 0) {
      ltbResult = this.calculateLTB(input);
    }
    
    // Local buckling check
    const localBuckling = this.checkLocalBuckling(input.member);
    
    // Calculate utilization
    const utilizationRatio = this.calculateUtilization(input, inelasticBuckling, ltbResult);
    
    // Determine status
    const status = utilizationRatio <= 0.9 ? 'ADEQUATE' : utilizationRatio <= 1.0 ? 'WARNING' : 'INADEQUATE';
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      effectiveLength,
      eulerBuckling,
      inelasticBuckling,
      localBuckling,
      utilizationRatio
    );
    
    return {
      code: this.code,
      effectiveLength,
      eulerBuckling,
      inelasticBuckling,
      ltbResult,
      localBuckling,
      utilizationRatio: PrecisionMath.round(utilizationRatio, 3),
      status,
      summary: this.generateSummary(utilizationRatio, eulerBuckling.governingMode),
      recommendations,
    };
  }

  // --------------------------------------------------------------------------
  // EFFECTIVE LENGTH CALCULATION
  // --------------------------------------------------------------------------

  private calculateEffectiveLength(input: BucklingInput): EffectiveLengthResult {
    const { member, endCondition, frameType, unbracedLengthMajor, unbracedLengthMinor } = input;
    
    // Get base effective length factors
    let Kx = EFFECTIVE_LENGTH_FACTORS[endCondition].recommended;
    let Ky = EFFECTIVE_LENGTH_FACTORS[endCondition].recommended;
    
    // Adjust for frame type
    if (frameType === 'UNBRACED') {
      // For unbraced frames, use larger K values
      if (endCondition === 'FIXED_FIXED') {
        Kx = 1.2;
        Ky = 1.2;
      } else if (endCondition === 'FIXED_PINNED') {
        Kx = 2.0;
        Ky = 2.0;
      }
    } else if (frameType === 'PARTIALLY_BRACED') {
      Kx *= 1.1;
      Ky *= 1.1;
    }
    
    const Leff_x = Kx * unbracedLengthMajor;
    const Leff_y = Ky * unbracedLengthMinor;
    
    const slendernessX = Leff_x / member.rx;
    const slendernessY = Leff_y / member.ry;
    
    const governingAxis = slendernessY > slendernessX ? 'Y' : 'X';
    
    return {
      Kx: PrecisionMath.round(Kx, 2),
      Ky: PrecisionMath.round(Ky, 2),
      Leff_x: PrecisionMath.round(Leff_x, 0),
      Leff_y: PrecisionMath.round(Leff_y, 0),
      slendernessX: PrecisionMath.round(slendernessX, 1),
      slendernessY: PrecisionMath.round(slendernessY, 1),
      governingAxis,
    };
  }

  // --------------------------------------------------------------------------
  // EULER BUCKLING
  // --------------------------------------------------------------------------

  private calculateEulerBuckling(
    input: BucklingInput,
    effectiveLength: EffectiveLengthResult
  ): EulerBucklingResult {
    const { member } = input;
    const { Leff_x, Leff_y, slendernessX, slendernessY, governingAxis } = effectiveLength;
    
    // Euler critical load: Pcr = π²EI / (KL)²
    const Pcr_x = Math.PI * Math.PI * member.E * member.Ixx / (Leff_x * Leff_x) / 1000; // kN
    const Pcr_y = Math.PI * Math.PI * member.E * member.Iyy / (Leff_y * Leff_y) / 1000; // kN
    
    const Pcr_governing = Math.min(Pcr_x, Pcr_y);
    const sigmaCr = Pcr_governing * 1000 / member.area; // MPa
    
    // Non-dimensional slenderness
    const lambdaBar = Math.sqrt(member.fy / sigmaCr);
    
    // Determine governing buckling mode
    let governingMode: BucklingMode = governingAxis === 'X' ? 'FLEXURAL_MAJOR' : 'FLEXURAL_MINOR';
    
    // Check for torsional/flexural-torsional buckling (for open sections)
    if (member.J && member.Cw && member.J > 0) {
      const G = member.G || member.E / (2 * (1 + 0.3));
      
      // Torsional buckling load
      const Pe_t = (Math.PI * Math.PI * member.E * member.Cw / (Leff_y * Leff_y) + G * member.J) 
                   / (member.Ixx + member.Iyy) * member.area / 1000;
      
      if (Pe_t < Pcr_governing) {
        governingMode = 'TORSIONAL';
      }
    }
    
    return {
      Pcr_x: PrecisionMath.round(Pcr_x, 1),
      Pcr_y: PrecisionMath.round(Pcr_y, 1),
      Pcr_governing: PrecisionMath.round(Pcr_governing, 1),
      sigmaCr: PrecisionMath.round(sigmaCr, 1),
      lambdaBar: PrecisionMath.round(lambdaBar, 3),
      governingMode,
    };
  }

  // --------------------------------------------------------------------------
  // INELASTIC BUCKLING
  // --------------------------------------------------------------------------

  private calculateInelasticBuckling(
    input: BucklingInput,
    eulerResult: EulerBucklingResult
  ): InelasticBucklingResult {
    const { member } = input;
    const { lambdaBar } = eulerResult;
    
    switch (this.code) {
      case 'IS800':
        return this.is800InelasticBuckling(member, lambdaBar);
      case 'AISC360':
        return this.aisc360InelasticBuckling(member, eulerResult);
      case 'EN1993':
        return this.en1993InelasticBuckling(member, lambdaBar);
      case 'AS4100':
        return this.as4100InelasticBuckling(member, lambdaBar);
      default:
        return this.is800InelasticBuckling(member, lambdaBar);
    }
  }

  private is800InelasticBuckling(member: MemberProperties, lambdaBar: number): InelasticBucklingResult {
    // Determine buckling curve (simplified - based on section type)
    const bucklingCurve = this.determineBucklingCurve(member);
    const { alpha, lambda0 } = IS800_BUCKLING_CURVES[bucklingCurve];
    
    // IS 800:2007 Clause 7.1.2.1
    // φ = 0.5 × [1 + α × (λ - 0.2) + λ²]
    const phi_calc = 0.5 * (1 + alpha * (lambdaBar - lambda0) + lambdaBar * lambdaBar);
    
    // χ = 1 / [φ + √(φ² - λ²)]
    const chi = Math.min(1.0, 1 / (phi_calc + Math.sqrt(phi_calc * phi_calc - lambdaBar * lambdaBar)));
    
    // Design compressive stress
    const Fcd = chi * member.fy / 1.1; // γm0 = 1.1
    
    // Design compressive strength
    const Pd = Fcd * member.area / 1000; // kN
    
    return {
      Pn: PrecisionMath.round(chi * member.fy * member.area / 1000, 1),
      Fcr: PrecisionMath.round(chi * member.fy, 1),
      phi: 1 / 1.1,
      phiPn: PrecisionMath.round(Pd, 1),
      bucklingCurve,
      reductionFactor: PrecisionMath.round(chi, 3),
    };
  }

  private aisc360InelasticBuckling(member: MemberProperties, eulerResult: EulerBucklingResult): InelasticBucklingResult {
    const { sigmaCr, lambdaBar } = eulerResult;
    const Fe = sigmaCr; // Elastic buckling stress
    
    let Fcr: number;
    
    // AISC 360-22 Eq. E3-2 and E3-3
    if (member.fy / Fe <= 2.25) {
      // Inelastic buckling
      Fcr = member.fy * Math.pow(0.658, member.fy / Fe);
    } else {
      // Elastic buckling
      Fcr = 0.877 * Fe;
    }
    
    const Pn = Fcr * member.area / 1000; // kN
    const phiPn = 0.9 * Pn; // LRFD, φc = 0.9
    
    return {
      Pn: PrecisionMath.round(Pn, 1),
      Fcr: PrecisionMath.round(Fcr, 1),
      phi: 0.9,
      phiPn: PrecisionMath.round(phiPn, 1),
      bucklingCurve: 'AISC-Single',
      reductionFactor: PrecisionMath.round(Fcr / member.fy, 3),
    };
  }

  private en1993InelasticBuckling(member: MemberProperties, lambdaBar: number): InelasticBucklingResult {
    // Determine imperfection factor
    const bucklingCurve = this.determineBucklingCurve(member);
    const alpha = EN1993_IMPERFECTION_FACTORS[bucklingCurve] || 0.34;
    
    // EN 1993-1-1 Clause 6.3.1.2
    const phi_calc = 0.5 * (1 + alpha * (lambdaBar - 0.2) + lambdaBar * lambdaBar);
    const chi = Math.min(1.0, 1 / (phi_calc + Math.sqrt(phi_calc * phi_calc - lambdaBar * lambdaBar)));
    
    // Nb,Rd = χ × A × fy / γM1
    const gammaM1 = 1.0; // Partial safety factor
    const NbRd = chi * member.area * member.fy / gammaM1 / 1000; // kN
    
    return {
      Pn: PrecisionMath.round(chi * member.fy * member.area / 1000, 1),
      Fcr: PrecisionMath.round(chi * member.fy, 1),
      phi: 1 / gammaM1,
      phiPn: PrecisionMath.round(NbRd, 1),
      bucklingCurve,
      reductionFactor: PrecisionMath.round(chi, 3),
    };
  }

  private as4100InelasticBuckling(member: MemberProperties, lambdaBar: number): InelasticBucklingResult {
    // AS 4100:2020 Section 6
    const lambdaN = 90 * Math.sqrt(250 / member.fy); // Non-dimensionalized slenderness
    const lambdaE = lambdaBar * lambdaN;
    
    // Member slenderness reduction factor αc
    const eta = 0.00326 * (lambdaN - 13.5); // Imperfection parameter (approximate)
    const xi = ((lambdaE / lambdaN) * (lambdaE / lambdaN) + 1 + eta) / 2;
    const alphaC = xi - Math.sqrt(xi * xi - (lambdaE / lambdaN) * (lambdaE / lambdaN));
    
    const Nc = Math.min(1.0, alphaC) * member.area * member.fy / 1000; // kN
    const phiNc = 0.9 * Nc;
    
    return {
      Pn: PrecisionMath.round(Nc, 1),
      Fcr: PrecisionMath.round(alphaC * member.fy, 1),
      phi: 0.9,
      phiPn: PrecisionMath.round(phiNc, 1),
      bucklingCurve: 'AS4100',
      reductionFactor: PrecisionMath.round(Math.min(1.0, alphaC), 3),
    };
  }

  // --------------------------------------------------------------------------
  // LATERAL-TORSIONAL BUCKLING
  // --------------------------------------------------------------------------

  private calculateLTB(input: BucklingInput): LTBResult {
    const { member, unbracedLengthLTB, Cb = 1.0 } = input;
    const Lb = unbracedLengthLTB || input.unbracedLengthMinor;
    
    const E = member.E;
    const G = member.G || E / (2 * (1 + 0.3));
    const J = member.J || 0;
    const Cw = member.Cw || 0;
    const Sx = member.Ixx / ((member.d || 300) / 2);
    const ry = member.ry;
    const fy = member.fy;
    
    // Elastic critical moment (simplified formula)
    // Mcr = (Cb × π / Lb) × √(E × Iy × G × J + (π × E / Lb)² × Iy × Cw)
    const term1 = E * member.Iyy * G * J;
    const term2 = Math.pow(Math.PI * E / Lb, 2) * member.Iyy * Cw;
    const Mcr = (Cb * Math.PI / Lb) * Math.sqrt(term1 + term2) / 1e6; // kN·m
    
    // Plastic moment
    const Zx = 1.15 * Sx; // Approximate plastic modulus
    const Mp = Zx * fy / 1e6; // kN·m
    
    // Limiting unbraced lengths
    const Lp = 1.76 * ry * Math.sqrt(E / fy); // mm
    const Lr = 1.95 * ry * (E / (0.7 * fy)) * Math.sqrt(J / (Sx * (member.d || 300))) * 
               Math.sqrt(1 + Math.sqrt(1 + 6.76 * Math.pow(0.7 * fy * Sx * (member.d || 300) / (E * J), 2)));
    
    // Determine zone and calculate Mn
    let Mn: number;
    let zone: LTBResult['zone'];
    let lambdaLT: number;
    let chiLT: number;
    
    if (Lb <= Lp) {
      // Plastic zone - no LTB
      Mn = Mp;
      zone = 'PLASTIC';
      lambdaLT = 0;
      chiLT = 1.0;
    } else if (Lb <= Lr) {
      // Inelastic LTB zone
      Mn = Cb * (Mp - (Mp - 0.7 * fy * Sx / 1e6) * (Lb - Lp) / (Lr - Lp));
      Mn = Math.min(Mn, Mp);
      zone = 'INELASTIC';
      lambdaLT = Math.sqrt(Mp / Mcr);
      chiLT = Mn / Mp;
    } else {
      // Elastic LTB zone
      Mn = Mcr;
      Mn = Math.min(Mn, Mp);
      zone = 'ELASTIC';
      lambdaLT = Math.sqrt(Mp / Mcr);
      chiLT = Mcr / Mp;
    }
    
    const phi = this.code === 'AISC360' ? 0.9 : 1 / 1.1;
    const phiMn = phi * Mn;
    
    return {
      Mcr: PrecisionMath.round(Mcr, 2),
      Mn: PrecisionMath.round(Mn, 2),
      phiMn: PrecisionMath.round(phiMn, 2),
      lambdaLT: PrecisionMath.round(lambdaLT, 3),
      chiLT: PrecisionMath.round(chiLT, 3),
      Lp: PrecisionMath.round(Lp, 0),
      Lr: PrecisionMath.round(Lr, 0),
      zone,
    };
  }

  // --------------------------------------------------------------------------
  // LOCAL BUCKLING
  // --------------------------------------------------------------------------

  private checkLocalBuckling(member: MemberProperties): LocalBucklingResult {
    const epsilon = Math.sqrt(235 / member.fy); // EN 1993 material factor
    
    // Flange slenderness (outstand or internal)
    const bf = member.bf || 150;
    const tf = member.tf || 10;
    const flangeSlenderness = (bf / 2) / tf;
    
    // Web slenderness
    const d = member.d || 300;
    const tw = member.tw || 8;
    const webSlenderness = d / tw;
    
    // Classification limits (for compression)
    const flangeLimit1 = SECTION_CLASS_LIMITS.flangeCompression.class1 * epsilon;
    const flangeLimit2 = SECTION_CLASS_LIMITS.flangeCompression.class2 * epsilon;
    const flangeLimit3 = SECTION_CLASS_LIMITS.flangeCompression.class3 * epsilon;
    
    const webLimit1 = SECTION_CLASS_LIMITS.webCompression.class1 * epsilon;
    const webLimit2 = SECTION_CLASS_LIMITS.webCompression.class2 * epsilon;
    const webLimit3 = SECTION_CLASS_LIMITS.webCompression.class3 * epsilon;
    
    // Determine flange status
    let flangeStatus: LocalBucklingResult['flangeStatus'];
    if (flangeSlenderness <= flangeLimit1) {
      flangeStatus = 'COMPACT';
    } else if (flangeSlenderness <= flangeLimit3) {
      flangeStatus = 'NONCOMPACT';
    } else {
      flangeStatus = 'SLENDER';
    }
    
    // Determine web status
    let webStatus: LocalBucklingResult['webStatus'];
    if (webSlenderness <= webLimit1) {
      webStatus = 'COMPACT';
    } else if (webSlenderness <= webLimit3) {
      webStatus = 'NONCOMPACT';
    } else {
      webStatus = 'SLENDER';
    }
    
    // Determine overall section class
    let sectionClass: SectionClass;
    if (flangeStatus === 'COMPACT' && webStatus === 'COMPACT') {
      sectionClass = 1;
    } else if (flangeStatus !== 'SLENDER' && webStatus !== 'SLENDER') {
      sectionClass = flangeSlenderness <= flangeLimit2 && webSlenderness <= webLimit2 ? 2 : 3;
    } else {
      sectionClass = 4;
    }
    
    // Calculate effective area for Class 4 sections
    let effectiveArea: number | undefined;
    let reductionFactorFlange: number | undefined;
    let reductionFactorWeb: number | undefined;
    
    if (sectionClass === 4) {
      // Winter formula for effective width
      if (flangeStatus === 'SLENDER') {
        const lambdaP_f = flangeSlenderness / (28.4 * epsilon);
        reductionFactorFlange = Math.min(1.0, (lambdaP_f - 0.055 * 4) / (lambdaP_f * lambdaP_f));
      }
      
      if (webStatus === 'SLENDER') {
        const lambdaP_w = webSlenderness / (28.4 * epsilon);
        reductionFactorWeb = Math.min(1.0, (lambdaP_w - 0.055 * 4) / (lambdaP_w * lambdaP_w));
      }
      
      const flangeArea = 2 * bf * tf;
      const webArea = d * tw;
      effectiveArea = (reductionFactorFlange || 1) * flangeArea + (reductionFactorWeb || 1) * webArea;
    }
    
    return {
      sectionClass,
      flangeSlenderness: PrecisionMath.round(flangeSlenderness, 1),
      webSlenderness: PrecisionMath.round(webSlenderness, 1),
      flangeLimit: PrecisionMath.round(flangeLimit3, 1),
      webLimit: PrecisionMath.round(webLimit3, 1),
      flangeStatus,
      webStatus,
      effectiveArea: effectiveArea ? PrecisionMath.round(effectiveArea, 0) : undefined,
      reductionFactorFlange,
      reductionFactorWeb,
    };
  }

  // --------------------------------------------------------------------------
  // FRAME STABILITY
  // --------------------------------------------------------------------------

  public analyzeFrameStability(
    storeyHeight: number,
    totalVerticalLoad: number,
    horizontalStiffness: number,
    deltaH: number
  ): FrameStabilityResult {
    // Stability index Q (IS 800) or θ (other codes)
    // Q = (ΣP × Δ) / (H × ΣH)
    const stabilityIndex = (totalVerticalLoad * deltaH) / (storeyHeight * horizontalStiffness);
    
    // Elastic critical load
    const Pcr = horizontalStiffness * storeyHeight / deltaH;
    
    // Amplification factor (B2 in AISC, α in others)
    // B2 = 1 / (1 - Q)  or  1 / (1 - ΣP/Pcr)
    const loadRatio = totalVerticalLoad / Pcr;
    const amplificationFactor = 1 / (1 - loadRatio);
    
    // Determine frame type and if second-order analysis is needed
    let frameType: FrameType;
    let secondOrderEffects: boolean;
    let recommendation: string;
    
    if (stabilityIndex <= 0.05) {
      frameType = 'BRACED';
      secondOrderEffects = false;
      recommendation = 'First-order analysis is adequate. Frame is considered braced (non-sway).';
    } else if (stabilityIndex <= 0.20) {
      frameType = 'PARTIALLY_BRACED';
      secondOrderEffects = true;
      recommendation = 'P-Delta effects should be considered. Use amplified first-order analysis or direct second-order analysis.';
    } else {
      frameType = 'UNBRACED';
      secondOrderEffects = true;
      recommendation = 'Second-order analysis is mandatory. Consider using advanced analysis methods.';
    }
    
    return {
      frameType,
      elasticCriticalLoad: PrecisionMath.round(Pcr, 1),
      stabilityIndex: PrecisionMath.round(stabilityIndex, 4),
      amplificationFactor: PrecisionMath.round(amplificationFactor, 3),
      secondOrderEffects,
      recommendation,
    };
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  private validateInput(input: BucklingInput): void {
    const { member } = input;
    
    this.errorHandler.validateNumber(member.length, 'Member Length', { min: 100, max: 50000 });
    this.errorHandler.validateNumber(member.area, 'Cross-sectional Area', { min: 100 });
    this.errorHandler.validateNumber(member.Ixx, 'Moment of Inertia Ixx', { min: 1e4 });
    this.errorHandler.validateNumber(member.Iyy, 'Moment of Inertia Iyy', { min: 1e4 });
    this.errorHandler.validateNumber(member.E, 'Elastic Modulus', { min: 100000, max: 300000 });
    this.errorHandler.validateNumber(member.fy, 'Yield Strength', { min: 200, max: 700 });
  }

  private determineBucklingCurve(member: MemberProperties): string {
    // Simplified selection based on section proportions
    // In practice, this depends on section type, fabrication method, and axis of buckling
    
    const d = member.d || 300;
    const bf = member.bf || 150;
    const tf = member.tf || 10;
    
    if (d / bf <= 1.2) {
      return 'a'; // Thick flanges, low depth/width ratio
    } else if (tf >= 40) {
      return 'd'; // Very thick flanges
    } else if (d / bf >= 2.0) {
      return 'c'; // Deep sections
    } else {
      return 'b'; // General case
    }
  }

  private calculateUtilization(
    input: BucklingInput,
    inelasticBuckling: InelasticBucklingResult,
    ltbResult?: LTBResult
  ): number {
    const P = input.axialLoad || 0;
    const Mx = input.momentMajor || 0;
    const My = input.momentMinor || 0;
    
    // Axial utilization
    const axialUtil = P / inelasticBuckling.phiPn;
    
    if (Mx === 0 && My === 0) {
      return axialUtil;
    }
    
    // Combined utilization (interaction equation)
    // P/Pn + Mx/Mn_x + My/Mn_y <= 1.0
    
    const Mn_x = ltbResult?.phiMn || (input.member.fy * input.member.Ixx / ((input.member.d || 300) / 2) / 1e6);
    const Mn_y = input.member.fy * input.member.Iyy / ((input.member.bf || 150) / 2) / 1e6;
    
    // AISC H1-1 interaction
    if (axialUtil >= 0.2) {
      return axialUtil + (8 / 9) * (Math.abs(Mx) / Mn_x + Math.abs(My) / Mn_y);
    } else {
      return axialUtil / 2 + (Math.abs(Mx) / Mn_x + Math.abs(My) / Mn_y);
    }
  }

  private generateRecommendations(
    effectiveLength: EffectiveLengthResult,
    eulerBuckling: EulerBucklingResult,
    inelasticBuckling: InelasticBucklingResult,
    localBuckling: LocalBucklingResult,
    utilization: number
  ): string[] {
    const recommendations: string[] = [];
    
    // Slenderness recommendations
    if (effectiveLength.slendernessY > 200) {
      recommendations.push('Slenderness ratio exceeds 200. Consider adding intermediate bracing or increasing section size.');
    } else if (effectiveLength.slendernessY > 150) {
      recommendations.push('High slenderness ratio. Consider reducing unbraced length or using larger section.');
    }
    
    // Local buckling recommendations
    if (localBuckling.sectionClass === 4) {
      recommendations.push('Section is Class 4 (slender). Effective area should be used in design. Consider using a more compact section.');
    } else if (localBuckling.sectionClass === 3) {
      recommendations.push('Section is Class 3. Elastic section properties apply. Full plastic capacity cannot be developed.');
    }
    
    // Buckling curve recommendations
    if (inelasticBuckling.reductionFactor < 0.5) {
      recommendations.push('Low buckling reduction factor. Member is highly susceptible to buckling. Consider reducing effective length.');
    }
    
    // Utilization recommendations
    if (utilization > 1.0) {
      recommendations.push('Member is OVERSTRESSED. Increase section size or reduce loads/effective length.');
    } else if (utilization > 0.9) {
      recommendations.push('Member utilization > 90%. Consider adding safety margin by using larger section.');
    } else if (utilization < 0.5) {
      recommendations.push('Member utilization < 50%. Section may be optimized for economy.');
    }
    
    return recommendations;
  }

  private generateSummary(utilization: number, governingMode: BucklingMode): string {
    const modeDescriptions: Record<BucklingMode, string> = {
      'FLEXURAL_MAJOR': 'major axis flexural buckling',
      'FLEXURAL_MINOR': 'minor axis flexural buckling',
      'TORSIONAL': 'torsional buckling',
      'FLEXURAL_TORSIONAL': 'flexural-torsional buckling',
      'LATERAL_TORSIONAL': 'lateral-torsional buckling',
      'LOCAL_FLANGE': 'local flange buckling',
      'LOCAL_WEB': 'local web buckling',
    };
    
    const status = utilization <= 1.0 ? 'ADEQUATE' : 'INADEQUATE';
    const modeDesc = modeDescriptions[governingMode];
    
    return `Stability analysis complete. Status: ${status}. Governing mode: ${modeDesc}. Utilization ratio: ${(utilization * 100).toFixed(1)}%.`;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createStabilityEngine(code: StabilityCode = 'IS800'): AdvancedStabilityEngine {
  return new AdvancedStabilityEngine(code);
}

export default AdvancedStabilityEngine;
