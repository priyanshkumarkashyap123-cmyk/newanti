/**
 * ============================================================================
 * ADVANCED STEEL DESIGN ENGINE V3.0
 * ============================================================================
 * STATUS: EXPERIMENTAL — Not wired to production UI. Zero production callers.
 * 
 * Canonical IS 800 engines:
 *  - components/structural/SteelDesignEngine.ts — Beam LTB design (primary)
 *  - utils/IS800_SteelDesignEngine.ts — Member checks for FSD optimizer
 *  - modules/codes/IS800.ts — Reference constants & utility functions
 * 
 * Comprehensive steel member design with multi-code compliance:
 * - IS 800:2007 (India)
 * - AISC 360-22 (USA)
 * - EN 1993-1-1 (Europe)
 * - AS 4100 (Australia)
 * 
 * Features:
 * - Precision mathematics
 * - Real-time validation
 * - Multiple section types
 * - Combined stress checks
 * - Detailed calculation reports
 * 
 * @version 3.0.0
 */

import { PrecisionMath, EngineeringMath, ENGINEERING_CONSTANTS, ValidationResult } from './PrecisionMath';
import { EngineeringErrorHandler, ErrorSeverity } from './EngineeringErrorHandler';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type SteelDesignCode = 'IS800' | 'AISC360' | 'EN1993' | 'AS4100';

export type SectionType = 
  | 'I_SECTION'
  | 'CHANNEL'
  | 'ANGLE'
  | 'TEE'
  | 'HSS_RECT'
  | 'HSS_SQUARE'
  | 'HSS_ROUND'
  | 'PIPE'
  | 'PLATE'
  | 'BUILT_UP';

export type MemberType = 'beam' | 'column' | 'beam_column' | 'brace' | 'tension_member';

export type LoadCombinationType = 'strength' | 'serviceability';

export interface SteelGrade {
  name: string;
  fy: number;      // Yield strength (MPa)
  fu: number;      // Ultimate strength (MPa)
  E: number;       // Elastic modulus (MPa)
  G: number;       // Shear modulus (MPa)
  density: number; // kg/m³
}

export interface SectionProperties {
  type: SectionType;
  name: string;
  
  // Dimensions
  D: number;       // Overall depth (mm)
  B: number;       // Flange width (mm)
  tw: number;      // Web thickness (mm)
  tf: number;      // Flange thickness (mm)
  r: number;       // Root radius (mm)
  
  // Area properties
  A: number;       // Cross-sectional area (mm²)
  
  // Moment of inertia
  Ix: number;      // Strong axis (mm⁴)
  Iy: number;      // Weak axis (mm⁴)
  Iz?: number;     // Polar (mm⁴)
  
  // Section modulus
  Zx: number;      // Elastic, strong axis (mm³)
  Zy: number;      // Elastic, weak axis (mm³)
  Zpx: number;     // Plastic, strong axis (mm³)
  Zpy: number;     // Plastic, weak axis (mm³)
  
  // Radius of gyration
  rx: number;      // Strong axis (mm)
  ry: number;      // Weak axis (mm)
  
  // Torsional properties
  J: number;       // Torsional constant (mm⁴)
  Cw?: number;     // Warping constant (mm⁶)
  
  // Centroid
  Cy?: number;     // From bottom (mm)
  Cx?: number;     // From left (mm)
}

export interface MemberLoads {
  Pu: number;      // Axial force (kN) - compression positive
  Mux: number;     // Moment about strong axis (kNm)
  Muy: number;     // Moment about weak axis (kNm)
  Vux: number;     // Shear in X (kN)
  Vuy: number;     // Shear in Y (kN)
  Tu?: number;     // Torsion (kNm)
}

export interface BracingCondition {
  Lx: number;      // Unbraced length, X-axis (mm)
  Ly: number;      // Unbraced length, Y-axis (mm)
  Lb: number;      // Unbraced length for LTB (mm)
  Kx: number;      // Effective length factor, X
  Ky: number;      // Effective length factor, Y
  lateralBracing: 'continuous' | 'discrete' | 'none';
  endRestraint: 'fixed_fixed' | 'fixed_pinned' | 'pinned_pinned' | 'cantilever';
}

export interface SteelDesignConfig {
  code: SteelDesignCode;
  memberType: MemberType;
  section: SectionProperties;
  steel: SteelGrade;
  loads: MemberLoads;
  bracing: BracingCondition;
  options?: {
    includeShearLag?: boolean;
    includeTorsion?: boolean;
    includeSecondOrder?: boolean;
    slendernessLimit?: number;
    deflectionLimit?: number;
  };
}

// ============================================================================
// DESIGN CHECK INTERFACES
// ============================================================================

export interface DesignCheckResult {
  name: string;
  clause: string;
  demand: number;
  capacity: number;
  ratio: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details?: string;
}

export interface SteelDesignResult {
  section: string;
  memberType: MemberType;
  code: SteelDesignCode;
  status: 'PASS' | 'FAIL' | 'REVIEW';
  
  capacities: {
    axialTension: number;       // kN
    axialCompression: number;   // kN
    momentX: number;            // kNm
    momentY: number;            // kNm
    shearX: number;             // kN
    shearY: number;             // kN
  };
  
  slenderness: {
    lambdaX: number;
    lambdaY: number;
    lambdaLTB?: number;
    classification: 'compact' | 'non_compact' | 'slender';
  };
  
  checks: DesignCheckResult[];
  interactionCheck?: {
    ratio: number;
    formula: string;
    status: 'PASS' | 'FAIL';
  };
  
  utilizationRatio: number;
  weight: number;              // kg/m
  recommendations?: string[];
}

// ============================================================================
// STANDARD STEEL GRADES
// ============================================================================

export const STEEL_GRADES: Record<string, SteelGrade> = {
  // Indian Standards
  'E250A': { name: 'E250A (IS 2062)', fy: 250, fu: 410, E: 200000, G: 76923, density: 7850 },
  'E300': { name: 'E300 (IS 2062)', fy: 300, fu: 440, E: 200000, G: 76923, density: 7850 },
  'E350': { name: 'E350 (IS 2062)', fy: 350, fu: 490, E: 200000, G: 76923, density: 7850 },
  'E410': { name: 'E410 (IS 2062)', fy: 410, fu: 540, E: 200000, G: 76923, density: 7850 },
  'E450': { name: 'E450 (IS 2062)', fy: 450, fu: 570, E: 200000, G: 76923, density: 7850 },
  
  // ASTM Standards
  'A36': { name: 'ASTM A36', fy: 250, fu: 400, E: 200000, G: 77200, density: 7850 },
  'A572_50': { name: 'ASTM A572 Gr.50', fy: 345, fu: 450, E: 200000, G: 77200, density: 7850 },
  'A992': { name: 'ASTM A992', fy: 345, fu: 450, E: 200000, G: 77200, density: 7850 },
  'A500B': { name: 'ASTM A500B', fy: 315, fu: 400, E: 200000, G: 77200, density: 7850 },
  
  // European Standards
  'S235': { name: 'S235 (EN 10025)', fy: 235, fu: 360, E: 210000, G: 80769, density: 7850 },
  'S275': { name: 'S275 (EN 10025)', fy: 275, fu: 430, E: 210000, G: 80769, density: 7850 },
  'S355': { name: 'S355 (EN 10025)', fy: 355, fu: 510, E: 210000, G: 80769, density: 7850 },
  'S460': { name: 'S460 (EN 10025)', fy: 460, fu: 540, E: 210000, G: 80769, density: 7850 },
};

// ============================================================================
// MAIN STEEL DESIGN ENGINE
// ============================================================================

export class AdvancedSteelDesignEngine {
  private config: SteelDesignConfig;
  private errorHandler: EngineeringErrorHandler;
  private partialFactors: {
    gammaM0: number;  // Resistance of cross-section
    gammaM1: number;  // Resistance of member to instability
    gammaM2: number;  // Resistance of connections
  };

  constructor(config: SteelDesignConfig) {
    this.config = config;
    this.errorHandler = new EngineeringErrorHandler({ 
      context: { module: 'SteelDesign', function: 'constructor', inputs: { code: config.code } } 
    });
    this.partialFactors = this.getPartialFactors(config.code);
    this.validateConfig();
  }

  private getPartialFactors(code: SteelDesignCode) {
    switch (code) {
      case 'IS800':
        // IS 800:2007 Table 5, Cl. 5.4.1
        return { gammaM0: 1.10, gammaM1: 1.25, gammaM2: 1.25 };
      case 'AISC360':
        return { gammaM0: 1.0 / 0.9, gammaM1: 1.0 / 0.9, gammaM2: 1.0 / 0.75 };
      case 'EN1993':
        return { gammaM0: 1.00, gammaM1: 1.00, gammaM2: 1.25 };
      case 'AS4100':
        return { gammaM0: 1.0 / 0.9, gammaM1: 1.0 / 0.9, gammaM2: 1.0 / 0.8 };
      default:
        return { gammaM0: 1.10, gammaM1: 1.25, gammaM2: 1.25 };
    }
  }

  private validateConfig(): void {
    const { section, steel, loads, bracing } = this.config;

    // Validate section properties
    this.errorHandler.validateNumber(section.A, 'Section Area', { positive: true });
    this.errorHandler.validateNumber(section.Ix, 'Moment of Inertia Ix', { positive: true });
    this.errorHandler.validateNumber(section.Iy, 'Moment of Inertia Iy', { positive: true });

    // Validate steel properties
    this.errorHandler.validateNumber(steel.fy, 'Yield Strength', { min: 200, max: 700 });
    this.errorHandler.validateNumber(steel.fu, 'Ultimate Strength', { min: steel.fy, max: 1000 });

    // Validate bracing
    this.errorHandler.validateNumber(bracing.Lx, 'Unbraced Length Lx', { positive: true });
    this.errorHandler.validateNumber(bracing.Ly, 'Unbraced Length Ly', { positive: true });
    this.errorHandler.validateNumber(bracing.Kx, 'Effective Length Factor Kx', { min: 0.5, max: 2.5 });
    this.errorHandler.validateNumber(bracing.Ky, 'Effective Length Factor Ky', { min: 0.5, max: 2.5 });
  }

  // --------------------------------------------------------------------------
  // MAIN DESIGN METHOD
  // --------------------------------------------------------------------------

  public design(): SteelDesignResult {
    const { memberType, section, steel, code } = this.config;
    const checks: DesignCheckResult[] = [];
    const recommendations: string[] = [];

    // Calculate section classification
    const classification = this.classifySection();
    
    // Calculate slenderness
    const slenderness = this.calculateSlenderness();
    
    // Check slenderness limits
    checks.push(this.checkSlendernessLimit(slenderness));

    // Calculate capacities based on member type
    const capacities = this.calculateCapacities(classification, slenderness);

    // Design checks based on member type
    switch (memberType) {
      case 'tension_member':
        checks.push(...this.checkTensionMember(capacities));
        break;
      case 'column':
        checks.push(...this.checkCompressionMember(capacities, slenderness));
        break;
      case 'beam':
        checks.push(...this.checkBeamMember(capacities, slenderness));
        break;
      case 'beam_column':
        checks.push(...this.checkBeamColumnMember(capacities, slenderness));
        break;
      case 'brace':
        checks.push(...this.checkBraceMember(capacities, slenderness));
        break;
    }

    // Combined stress check (interaction)
    const interactionCheck = this.checkCombinedStresses(capacities, slenderness);

    // Overall status
    const failedChecks = checks.filter(c => c.status === 'FAIL');
    const warningChecks = checks.filter(c => c.status === 'WARNING');
    
    let status: 'PASS' | 'FAIL' | 'REVIEW' = 'PASS';
    if (failedChecks.length > 0) {
      status = 'FAIL';
    } else if (warningChecks.length > 0) {
      status = 'REVIEW';
    }

    // Utilization ratio
    const utilizationRatio = Math.max(
      ...checks.map(c => c.ratio),
      interactionCheck?.ratio || 0
    );

    // Generate recommendations
    if (utilizationRatio > 0.95) {
      recommendations.push('Section is highly utilized. Consider larger section for future flexibility.');
    }
    if (utilizationRatio < 0.5) {
      recommendations.push('Section appears oversized. Consider smaller section for economy.');
    }
    if (classification === 'slender') {
      recommendations.push('Section is classified as slender. Consider compact section for better capacity.');
    }

    return {
      section: section.name,
      memberType,
      code,
      status,
      capacities,
      slenderness: {
        lambdaX: slenderness.lambdaX,
        lambdaY: slenderness.lambdaY,
        lambdaLTB: slenderness.lambdaLTB,
        classification,
      },
      checks,
      interactionCheck,
      utilizationRatio,
      weight: section.A * steel.density / 1e6,
      recommendations,
    };
  }

  // --------------------------------------------------------------------------
  // SECTION CLASSIFICATION
  // --------------------------------------------------------------------------

  private classifySection(): 'compact' | 'non_compact' | 'slender' {
    const { section, steel, code } = this.config;
    const epsilon = Math.sqrt(250 / steel.fy);

    // Flange classification (outstand)
    const bOverT = (section.B / 2 - section.tw / 2 - section.r) / section.tf;
    
    // Web classification
    const dOverTw = (section.D - 2 * section.tf - 2 * section.r) / section.tw;

    let flangeClass: 'compact' | 'non_compact' | 'slender';
    let webClass: 'compact' | 'non_compact' | 'slender';

    switch (code) {
      case 'IS800':
        // IS 800 Table 2
        flangeClass = bOverT <= 9.4 * epsilon ? 'compact' : 
                      bOverT <= 15.7 * epsilon ? 'non_compact' : 'slender';
        webClass = dOverTw <= 84 * epsilon ? 'compact' :
                   dOverTw <= 105 * epsilon ? 'non_compact' : 'slender';
        break;

      case 'AISC360':
        // AISC Table B4.1b
        flangeClass = bOverT <= 0.38 * Math.sqrt(steel.E / steel.fy) ? 'compact' :
                      bOverT <= 1.0 * Math.sqrt(steel.E / steel.fy) ? 'non_compact' : 'slender';
        webClass = dOverTw <= 3.76 * Math.sqrt(steel.E / steel.fy) ? 'compact' :
                   dOverTw <= 5.70 * Math.sqrt(steel.E / steel.fy) ? 'non_compact' : 'slender';
        break;

      case 'EN1993':
        // EN 1993 Table 5.2
        flangeClass = bOverT <= 9 * epsilon ? 'compact' :
                      bOverT <= 14 * epsilon ? 'non_compact' : 'slender';
        webClass = dOverTw <= 72 * epsilon ? 'compact' :
                   dOverTw <= 124 * epsilon ? 'non_compact' : 'slender';
        break;

      default:
        flangeClass = 'non_compact';
        webClass = 'non_compact';
    }

    // Overall classification is the worst of flange and web
    const classes = ['compact', 'non_compact', 'slender'] as const;
    const flangeIdx = classes.indexOf(flangeClass);
    const webIdx = classes.indexOf(webClass);

    return classes[Math.max(flangeIdx, webIdx)];
  }

  // --------------------------------------------------------------------------
  // SLENDERNESS CALCULATIONS
  // --------------------------------------------------------------------------

  private calculateSlenderness(): { lambdaX: number; lambdaY: number; lambdaLTB?: number } {
    const { section, steel, bracing } = this.config;

    // Effective lengths
    const LeX = bracing.Kx * bracing.Lx;
    const LeY = bracing.Ky * bracing.Ly;

    // Slenderness ratios
    const lambdaX = LeX / section.rx;
    const lambdaY = LeY / section.ry;

    // Non-dimensional slenderness per IS 800 Cl. 7.1.2 / EN 1993 Cl. 6.3.1
    // λ̄ = λ / λ₁ where λ₁ = π√(E/fy)
    const lambda1 = Math.PI * Math.sqrt(steel.E / steel.fy);
    const lambdaBar = Math.max(lambdaX, lambdaY) / lambda1;

    // Lateral-torsional buckling slenderness
    let lambdaLTB: number | undefined;
    if (this.config.memberType === 'beam' || this.config.memberType === 'beam_column') {
      lambdaLTB = this.calculateLTBSlenderness();
    }

    return { lambdaX, lambdaY, lambdaLTB };
  }

  private calculateLTBSlenderness(): number {
    const { section, steel, bracing } = this.config;
    
    // Elastic critical moment for LTB
    const Mcr = this.calculateElasticCriticalMoment();
    
    // Non-dimensional LTB slenderness
    const lambdaLT = Math.sqrt((steel.fy * section.Zpx) / Mcr);

    return lambdaLT;
  }

  private calculateElasticCriticalMoment(): number {
    const { section, steel, bracing } = this.config;
    const E = steel.E;
    const G = steel.G;
    const L = bracing.Lb;
    
    // C1 coefficient (depends on moment distribution, assume uniform = 1.0)
    const C1 = 1.0;
    
    // Mcr calculation (EN 1993 formula)
    const Iw = section.Cw || (section.Iy * Math.pow(section.D / 2, 2));
    const It = section.J;
    
    const term1 = Math.PI * Math.PI * E * section.Iy / (L * L);
    const term2 = Iw / section.Iy + L * L * G * It / (Math.PI * Math.PI * E * section.Iy);
    
    const Mcr = C1 * Math.sqrt(term1 * term2) / 1e6; // kNm
    
    return Math.max(Mcr, 0.1); // Prevent division by zero
  }

  // --------------------------------------------------------------------------
  // CAPACITY CALCULATIONS
  // --------------------------------------------------------------------------

  private calculateCapacities(
    classification: 'compact' | 'non_compact' | 'slender',
    slenderness: { lambdaX: number; lambdaY: number; lambdaLTB?: number }
  ) {
    const { section, steel, code } = this.config;
    const { gammaM0, gammaM1 } = this.partialFactors;

    // Yield and design strength
    const fy = steel.fy;
    const fu = steel.fu;

    // Axial tension capacity
    const Td = section.A * fy / (gammaM0 * 1000); // kN

    // Axial compression capacity (considering buckling)
    const chi = this.getBucklingReductionFactor(slenderness);
    const Pd = chi * section.A * fy / (gammaM1 * 1000); // kN

    // Moment capacity (strong axis)
    let Mdx: number;
    switch (classification) {
      case 'compact':
        Mdx = section.Zpx * fy / (gammaM0 * 1e6); // kNm
        break;
      case 'non_compact':
        Mdx = section.Zx * fy / (gammaM0 * 1e6); // kNm
        break;
      case 'slender':
        const Qfactor = this.getSlenderReductionFactor();
        Mdx = Qfactor * section.Zx * fy / (gammaM0 * 1e6); // kNm
        break;
    }

    // Moment capacity (weak axis)
    let Mdy: number;
    switch (classification) {
      case 'compact':
        Mdy = section.Zpy * fy / (gammaM0 * 1e6); // kNm
        break;
      default:
        Mdy = section.Zy * fy / (gammaM0 * 1e6); // kNm
    }

    // Shear capacity
    const Av = this.getShearArea('x');
    const Vdx = Av * fy / (Math.sqrt(3) * gammaM0 * 1000); // kN

    const Avz = this.getShearArea('y');
    const Vdy = Avz * fy / (Math.sqrt(3) * gammaM0 * 1000); // kN

    // LTB reduced moment (for beams)
    let MdxLTB = Mdx;
    if (slenderness.lambdaLTB && slenderness.lambdaLTB > 0.2) {
      const chiLT = this.getLTBReductionFactor(slenderness.lambdaLTB);
      MdxLTB = chiLT * Mdx;
    }

    return {
      axialTension: PrecisionMath.round(Td, 1),
      axialCompression: PrecisionMath.round(Pd, 1),
      momentX: PrecisionMath.round(Math.min(Mdx, MdxLTB), 1),
      momentY: PrecisionMath.round(Mdy, 1),
      shearX: PrecisionMath.round(Vdx, 1),
      shearY: PrecisionMath.round(Vdy, 1),
    };
  }

  private getBucklingReductionFactor(slenderness: { lambdaX: number; lambdaY: number }): number {
    const { steel, code } = this.config;
    const lambda = Math.max(slenderness.lambdaX, slenderness.lambdaY);
    
    // Non-dimensional slenderness per IS 800 Cl. 7.1.2 / EN 1993 Cl. 6.3.1
    // λ̄ = λ / λ₁ where λ₁ = π√(E/fy)
    const lambda1 = Math.PI * Math.sqrt(steel.E / steel.fy);
    const lambdaBar = lambda / lambda1;

    if (lambdaBar <= 0.2) {
      return 1.0;
    }

    // Imperfection factor (depends on buckling curve)
    const alpha = this.getImperfectionFactor();
    
    // Buckling reduction factor (EN 1993 / IS 800)
    const phi = 0.5 * (1 + alpha * (lambdaBar - 0.2) + lambdaBar * lambdaBar);
    const chi = 1 / (phi + Math.sqrt(phi * phi - lambdaBar * lambdaBar));

    return Math.min(chi, 1.0);
  }

  private getImperfectionFactor(): number {
    const { section, code } = this.config;
    
    // IS 800:2007 Table 10 / EN 1993 Table 6.1 — buckling curve imperfection factor α
    // For rolled I-sections: curve 'a' (α=0.21) about strong axis, curve 'b' (α=0.34) about weak axis
    // Simplified: use curve 'b' for general case (conservative)
    switch (code) {
      case 'IS800':
        // IS 800 Table 10 — rolled I/H: α = 0.34 (curve b) for tf ≤ 40mm, 0.49 (curve c) for tf > 40mm
        return section.tf <= 40 ? 0.34 : 0.49;
      case 'EN1993':
        return section.tf <= 40 ? 0.34 : 0.49;
      case 'AISC360':
        return 0.30;
      default:
        return 0.34;
    }
  }

  private getLTBReductionFactor(lambdaLT: number): number {
    if (lambdaLT <= 0.2) {
      return 1.0;
    }

    const alphaLT = 0.21; // Rolled I-sections
    const phiLT = 0.5 * (1 + alphaLT * (lambdaLT - 0.2) + lambdaLT * lambdaLT);
    const chiLT = 1 / (phiLT + Math.sqrt(phiLT * phiLT - lambdaLT * lambdaLT));

    return Math.min(chiLT, 1.0);
  }

  private getSlenderReductionFactor(): number {
    // Simplified effective area factor for slender sections
    return 0.8;
  }

  private getShearArea(direction: 'x' | 'y'): number {
    const { section } = this.config;
    
    if (direction === 'x') {
      // Shear parallel to web
      return section.D * section.tw;
    } else {
      // Shear parallel to flanges
      return 2 * section.B * section.tf;
    }
  }

  // --------------------------------------------------------------------------
  // DESIGN CHECKS
  // --------------------------------------------------------------------------

  private checkSlendernessLimit(slenderness: { lambdaX: number; lambdaY: number }): DesignCheckResult {
    const { code, memberType } = this.config;
    const lambda = Math.max(slenderness.lambdaX, slenderness.lambdaY);
    
    let limit: number;
    switch (memberType) {
      case 'tension_member':
        limit = 400;
        break;
      case 'column':
        limit = 180;
        break;
      case 'beam_column':
        limit = 180;
        break;
      default:
        limit = 300;
    }

    return {
      name: 'Slenderness Ratio',
      clause: this.getSlendernessClause(code),
      demand: lambda,
      capacity: limit,
      ratio: lambda / limit,
      status: lambda <= limit ? 'PASS' : 'FAIL',
      details: `λ_x = ${slenderness.lambdaX.toFixed(1)}, λ_y = ${slenderness.lambdaY.toFixed(1)}`,
    };
  }

  private checkTensionMember(capacities: SteelDesignResult['capacities']): DesignCheckResult[] {
    const { loads, code } = this.config;
    const checks: DesignCheckResult[] = [];

    // Tension capacity check
    const Pu = Math.abs(loads.Pu);
    checks.push({
      name: 'Axial Tension',
      clause: this.getTensionClause(code),
      demand: Pu,
      capacity: capacities.axialTension,
      ratio: Pu / capacities.axialTension,
      status: Pu <= capacities.axialTension ? 'PASS' : 'FAIL',
    });

    return checks;
  }

  private checkCompressionMember(
    capacities: SteelDesignResult['capacities'],
    slenderness: { lambdaX: number; lambdaY: number }
  ): DesignCheckResult[] {
    const { loads, code } = this.config;
    const checks: DesignCheckResult[] = [];

    // Compression capacity check
    const Pu = loads.Pu;
    checks.push({
      name: 'Axial Compression',
      clause: this.getCompressionClause(code),
      demand: Pu,
      capacity: capacities.axialCompression,
      ratio: Pu / capacities.axialCompression,
      status: Pu <= capacities.axialCompression ? 'PASS' : 'FAIL',
    });

    return checks;
  }

  private checkBeamMember(
    capacities: SteelDesignResult['capacities'],
    slenderness: { lambdaX: number; lambdaY: number; lambdaLTB?: number }
  ): DesignCheckResult[] {
    const { loads, code } = this.config;
    const checks: DesignCheckResult[] = [];

    // Moment capacity check (strong axis)
    const Mux = Math.abs(loads.Mux);
    checks.push({
      name: 'Bending Moment (Strong Axis)',
      clause: this.getMomentClause(code),
      demand: Mux,
      capacity: capacities.momentX,
      ratio: Mux / capacities.momentX,
      status: Mux <= capacities.momentX ? 'PASS' : 'FAIL',
    });

    // Moment capacity check (weak axis)
    const Muy = Math.abs(loads.Muy);
    if (Muy > 0) {
      checks.push({
        name: 'Bending Moment (Weak Axis)',
        clause: this.getMomentClause(code),
        demand: Muy,
        capacity: capacities.momentY,
        ratio: Muy / capacities.momentY,
        status: Muy <= capacities.momentY ? 'PASS' : 'FAIL',
      });
    }

    // Shear capacity check
    const Vuy = Math.abs(loads.Vuy);
    checks.push({
      name: 'Shear Force',
      clause: this.getShearClause(code),
      demand: Vuy,
      capacity: capacities.shearY,
      ratio: Vuy / capacities.shearY,
      status: Vuy <= capacities.shearY ? 'PASS' : 'FAIL',
    });

    return checks;
  }

  private checkBeamColumnMember(
    capacities: SteelDesignResult['capacities'],
    slenderness: { lambdaX: number; lambdaY: number; lambdaLTB?: number }
  ): DesignCheckResult[] {
    const { loads, code } = this.config;
    const checks: DesignCheckResult[] = [];

    // All compression checks
    checks.push(...this.checkCompressionMember(capacities, slenderness));

    // All beam checks
    checks.push(...this.checkBeamMember(capacities, slenderness));

    return checks;
  }

  private checkBraceMember(
    capacities: SteelDesignResult['capacities'],
    slenderness: { lambdaX: number; lambdaY: number }
  ): DesignCheckResult[] {
    const { loads, code } = this.config;
    const checks: DesignCheckResult[] = [];

    // Check both tension and compression
    if (loads.Pu > 0) {
      checks.push(...this.checkCompressionMember(capacities, slenderness));
    } else {
      checks.push(...this.checkTensionMember(capacities));
    }

    return checks;
  }

  // --------------------------------------------------------------------------
  // COMBINED STRESS CHECK
  // --------------------------------------------------------------------------

  private checkCombinedStresses(
    capacities: SteelDesignResult['capacities'],
    slenderness: { lambdaX: number; lambdaY: number; lambdaLTB?: number }
  ): SteelDesignResult['interactionCheck'] {
    const { loads, code, memberType } = this.config;

    if (memberType === 'tension_member' || memberType === 'brace') {
      return undefined;
    }

    const Pu = loads.Pu;
    const Mux = Math.abs(loads.Mux);
    const Muy = Math.abs(loads.Muy);

    const Pd = capacities.axialCompression;
    const Mdx = capacities.momentX;
    const Mdy = capacities.momentY;

    let ratio: number;
    let formula: string;

    switch (code) {
      case 'IS800':
        // IS 800 Clause 9.3.2
        if (Pu / Pd >= 0.2) {
          ratio = Pu / Pd + (8 / 9) * (Mux / Mdx + Muy / Mdy);
          formula = 'P/Pd + (8/9)(Mx/Mdx + My/Mdy) ≤ 1.0 (IS 800 Eq. 9.26)';
        } else {
          ratio = Pu / (2 * Pd) + Mux / Mdx + Muy / Mdy;
          formula = 'P/(2Pd) + Mx/Mdx + My/Mdy ≤ 1.0 (IS 800 Eq. 9.27)';
        }
        break;

      case 'AISC360':
        // AISC H1-1
        if (Pu / Pd >= 0.2) {
          ratio = Pu / Pd + (8 / 9) * (Mux / Mdx + Muy / Mdy);
          formula = 'Pr/Pc + (8/9)(Mrx/Mcx + Mry/Mcy) ≤ 1.0 (AISC H1-1a)';
        } else {
          ratio = Pu / (2 * Pd) + Mux / Mdx + Muy / Mdy;
          formula = 'Pr/(2Pc) + Mrx/Mcx + Mry/Mcy ≤ 1.0 (AISC H1-1b)';
        }
        break;

      case 'EN1993':
        // EN 1993 Eq. 6.61/6.62
        const kyy = 1.0; // Simplified
        const kzy = 1.0;
        ratio = Pu / Pd + kyy * Mux / Mdx + kzy * Muy / Mdy;
        formula = 'NEd/NRd + kyy×My,Ed/My,Rd + kzy×Mz,Ed/Mz,Rd ≤ 1.0 (EN 1993 Eq. 6.61)';
        break;

      default:
        ratio = Pu / Pd + Mux / Mdx + Muy / Mdy;
        formula = 'P/Pd + Mx/Mdx + My/Mdy ≤ 1.0';
    }

    return {
      ratio: PrecisionMath.round(ratio, 3),
      formula,
      status: ratio <= 1.0 ? 'PASS' : 'FAIL',
    };
  }

  // --------------------------------------------------------------------------
  // CODE REFERENCE HELPERS
  // --------------------------------------------------------------------------

  private getSlendernessClause(code: SteelDesignCode): string {
    const clauses: Record<SteelDesignCode, string> = {
      IS800: 'IS 800:2007 Cl. 3.8',
      AISC360: 'AISC 360-22 E2',
      EN1993: 'EN 1993-1-1 Cl. 6.3',
      AS4100: 'AS 4100 Cl. 6.6',
    };
    return clauses[code];
  }

  private getTensionClause(code: SteelDesignCode): string {
    const clauses: Record<SteelDesignCode, string> = {
      IS800: 'IS 800:2007 Cl. 6',
      AISC360: 'AISC 360-22 D',
      EN1993: 'EN 1993-1-1 Cl. 6.2.3',
      AS4100: 'AS 4100 Cl. 7',
    };
    return clauses[code];
  }

  private getCompressionClause(code: SteelDesignCode): string {
    const clauses: Record<SteelDesignCode, string> = {
      IS800: 'IS 800:2007 Cl. 7',
      AISC360: 'AISC 360-22 E',
      EN1993: 'EN 1993-1-1 Cl. 6.3.1',
      AS4100: 'AS 4100 Cl. 6',
    };
    return clauses[code];
  }

  private getMomentClause(code: SteelDesignCode): string {
    const clauses: Record<SteelDesignCode, string> = {
      IS800: 'IS 800:2007 Cl. 8.2',
      AISC360: 'AISC 360-22 F',
      EN1993: 'EN 1993-1-1 Cl. 6.2.5',
      AS4100: 'AS 4100 Cl. 5',
    };
    return clauses[code];
  }

  private getShearClause(code: SteelDesignCode): string {
    const clauses: Record<SteelDesignCode, string> = {
      IS800: 'IS 800:2007 Cl. 8.4',
      AISC360: 'AISC 360-22 G',
      EN1993: 'EN 1993-1-1 Cl. 6.2.6',
      AS4100: 'AS 4100 Cl. 5.11',
    };
    return clauses[code];
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export const createSteelDesignEngine = (config: SteelDesignConfig) => {
  return new AdvancedSteelDesignEngine(config);
};

export default AdvancedSteelDesignEngine;
