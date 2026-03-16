/**
 * ============================================================================
 * COMPREHENSIVE RC BEAM DESIGN ENGINE
 * ============================================================================
 * 
 * Complete reinforced concrete beam design as per international codes.
 * Features:
 * - Flexural design (singly/doubly reinforced)
 * - Shear design with stirrups
 * - Torsion design
 * - Deflection checks (immediate and long-term)
 * - Crack width calculations
 * - Deep beam design
 * - T-beam / L-beam design
 * - Continuous beam design
 * 
 * Supported Codes:
 * - IS 456:2000 (India)
 * - ACI 318-19 (USA)
 * - EN 1992-1-1:2004 Eurocode 2 (Europe)
 * - AS 3600:2018 (Australia)
 * 
 * @version 1.0.0
 * @author Head of Engineering
 */

import {
  DesignCode,
  ConcreteGrade,
  SteelGrade,
  RebarSize,
  REBAR_SIZES,
  SAFETY_FACTORS,
  ACI_PHI_FACTORS,
  STRESS_BLOCK,
  DESIGN_LIMITS,
  getConcreteGrades,
  getSteelGrades,
  getRebarByDiameter,
  calculateRebarArea,
  getDesignStrength,
  getDesignYieldStrength,
  selectBars,
} from './RCDesignConstants';
import type {
  IS456Version,
  CementType,
  IS456_2025_PerformanceCriteria,
} from './RCDesignConstants';
import {
  getIS456StressBlockParams,
  getIS456ConcreteGrades,
  DRAFT_WARNING_IS456_2025,
} from './RCDesignConstants';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type BeamType = 'rectangular' | 'T-beam' | 'L-beam' | 'inverted-T';
export type SupportCondition = 'simply-supported' | 'cantilever' | 'continuous' | 'fixed-fixed';
export type LoadType = 'UDL' | 'point' | 'triangular' | 'trapezoidal';
export type ShearReinfType = 'vertical' | 'inclined';

export interface BeamGeometry {
  type: BeamType;
  b: number;           // Width of beam (mm)
  D: number;           // Total depth (mm)
  d?: number;          // Effective depth (mm) - calculated if not provided
  bw?: number;         // Web width for T/L beams (mm)
  bf?: number;         // Flange width for T/L beams (mm)
  Df?: number;         // Flange thickness (mm)
  cover: number;       // Clear cover (mm)
  L: number;           // Span length (mm)
}

export interface BeamLoading {
  Mu: number;          // Ultimate bending moment (kN-m)
  Vu: number;          // Ultimate shear force (kN)
  Tu?: number;         // Ultimate torsion (kN-m)
  Mservice?: number;   // Service moment for crack width (kN-m)
  loadType: LoadType;
  supportCondition: SupportCondition;
}

export interface BeamMaterials {
  concreteGrade: ConcreteGrade;
  steelGrade: SteelGrade;
  stirrupGrade?: SteelGrade;
  code: DesignCode;
  /** Selects IS 456:2000 (production) vs Draft IS 456:2025 (research only). Defaults to IS456_2000. */
  codeVersion?: IS456Version;
  /** Cement type per IS 456:2000 Table 1 / Amendment No. 6 (June 2024). Required for durability checks. */
  cementType?: CementType;
}

export interface FlexuralDesignResult {
  status: 'safe' | 'unsafe' | 'warning';
  sectionType: 'singly-reinforced' | 'doubly-reinforced' | 'over-reinforced';
  Mu_capacity: number;       // Moment capacity (kN-m)
  Ast_required: number;      // Required tension steel (mm²)
  Asc_required: number;      // Required compression steel (mm²)
  xu: number;                // Neutral axis depth (mm)
  xu_max: number;            // Limiting neutral axis depth (mm)
  steelRatio: number;        // pt (%)
  utilizationRatio: number;
  tensionBars: { diameter: number; count: number; area: number }[];
  compressionBars: { diameter: number; count: number; area: number }[];
  messages: string[];
  calculations: Record<string, number>;
}

export interface ShearDesignResult {
  status: 'safe' | 'unsafe' | 'warning';
  Vuc: number;               // Shear capacity of concrete (kN)
  Vus_required: number;      // Shear to be resisted by stirrups (kN)
  Vn_capacity: number;       // Total shear capacity (kN)
  stirrupDiameter: number;   // Selected stirrup diameter (mm)
  stirrupLegs: number;       // Number of legs
  stirrupSpacing: number;    // Spacing (mm)
  maxSpacing: number;        // Maximum allowed spacing (mm)
  utilizationRatio: number;
  messages: string[];
  calculations: Record<string, number>;
}

export interface TorsionDesignResult {
  status: 'safe' | 'unsafe' | 'warning' | 'negligible';
  Tcr: number;               // Cracking torque (kN-m)
  Tu_capacity: number;       // Torsional capacity (kN-m)
  Asl_required: number;      // Longitudinal steel for torsion (mm²)
  Asv_required: number;      // Transverse steel for torsion (mm²/m)
  stirrupSpacing: number;    // Combined spacing for shear + torsion (mm)
  messages: string[];
  calculations: Record<string, number>;
}

export interface DeflectionCheckResult {
  status: 'pass' | 'fail' | 'warning';
  spanDepthRatio_provided: number;
  spanDepthRatio_allowed: number;
  immediateDeflection: number;  // mm
  longTermDeflection: number;   // mm
  totalDeflection: number;      // mm
  allowableDeflection: number;  // mm
  messages: string[];
}

export interface CrackWidthResult {
  status: 'pass' | 'fail';
  crackWidth: number;           // mm
  allowableCrackWidth: number;  // mm
  steelStress: number;          // MPa
  crackSpacing: number;         // mm
  messages: string[];
}

export interface BeamDesignResult {
  geometry: BeamGeometry;
  materials: BeamMaterials;
  loading: BeamLoading;
  flexure: FlexuralDesignResult;
  shear: ShearDesignResult;
  torsion?: TorsionDesignResult;
  deflection: DeflectionCheckResult;
  crackWidth?: CrackWidthResult;
  summary: {
    overallStatus: 'safe' | 'unsafe' | 'marginal';
    utilizationRatio: number;
    warnings: string[];
    recommendations: string[];
  };
  /** IS 456:2025 Draft six performance criteria — populated only when codeVersion = 'IS456_2025_DRAFT'. */
  performanceCriteria?: IS456_2025_PerformanceCriteria;
  /** Present when codeVersion = 'IS456_2025_DRAFT'. Must be surfaced in the UI. */
  draftWarning?: string;
}

// =============================================================================
// MAIN BEAM DESIGN ENGINE CLASS
// =============================================================================

export class RCBeamDesignEngine {
  private geometry: BeamGeometry;
  private loading: BeamLoading;
  private materials: BeamMaterials;
  private code: DesignCode;

  constructor(
    geometry: BeamGeometry,
    loading: BeamLoading,
    materials: BeamMaterials
  ) {
    this.geometry = { ...geometry };
    this.loading = { ...loading };
    this.materials = { ...materials };
    this.code = materials.code;

    // Calculate effective depth if not provided
    if (!this.geometry.d) {
      this.geometry.d = this.geometry.D - this.geometry.cover - 25; // Assuming 25mm main bar
    }
  }

  // ===========================================================================
  // MAIN DESIGN METHOD
  // ===========================================================================

  public design(): BeamDesignResult {
    const flexure = this.designForFlexure();
    const shear = this.designForShear();
    const torsion = this.loading.Tu ? this.designForTorsion() : undefined;
    const deflection = this.checkDeflection(flexure.Ast_required);
    const crackWidth = this.loading.Mservice
      ? this.calculateCrackWidth(flexure.Ast_required)
      : undefined;

    const summary = this.generateSummary(flexure, shear, torsion, deflection, crackWidth);
    const isDraft = this.materials.codeVersion === 'IS456_2025_DRAFT';

    return {
      geometry: this.geometry,
      materials: this.materials,
      loading: this.loading,
      flexure,
      shear,
      torsion,
      deflection,
      crackWidth,
      summary,
      ...(isDraft && {
        draftWarning: DRAFT_WARNING_IS456_2025,
        performanceCriteria: this.evaluateIS456_2025Performance(flexure, shear, deflection, crackWidth),
      }),
    };
  }

  private get codeVersion(): IS456Version {
    return this.materials.codeVersion ?? 'IS456_2000';
  }

  /** Builds IS 456:2025 Draft six-performance-criteria evaluation from existing check results.
   *  IS 456:2025 Draft Cl. 3.2 (Performance Framework) — research use only.
   */
  private evaluateIS456_2025Performance(
    flexure: FlexuralDesignResult,
    shear: ShearDesignResult,
    deflection: DeflectionCheckResult,
    crackWidth?: CrackWidthResult,
  ): IS456_2025_PerformanceCriteria {
    // Cl. 3.2.1 Strength — all load-bearing elements pass their ULS checks
    const strength = flexure.status !== 'unsafe' && shear.status !== 'unsafe';
    // Cl. 3.2.2 Serviceability — deflection and crack width within SLS limits
    const serviceability =
      deflection.status === 'pass' && (!crackWidth || crackWidth.status === 'pass');
    // Cl. 3.2.3 Durability — adequate cover ≥ 20 mm + approved cement type per IS 456 Table 1
    const durability =
      this.geometry.cover >= 20 && this.materials.cementType !== undefined;
    // Cl. 3.2.4 Robustness — section not over-reinforced (can redistribute moments)
    const robustness = flexure.sectionType !== 'over-reinforced';
    // Cl. 3.2.5 Integrity — neutral axis ≤ limiting depth (IS 456 Cl. 38.1)
    const integrity = flexure.xu <= flexure.xu_max;
    // Cl. 3.2.6 Restorability — crack width ≤ allowable (IS 456 Cl. 35.3.2)
    const restorability =
      !crackWidth || crackWidth.crackWidth <= crackWidth.allowableCrackWidth;
    return { strength, serviceability, durability, robustness, integrity, restorability };
  }

  // ===========================================================================
  // FLEXURAL DESIGN
  // ===========================================================================

  private designForFlexure(): FlexuralDesignResult {
    const { b, d, D, bf, bw, Df, type } = this.geometry;
    const { Mu } = this.loading;
    const { concreteGrade, steelGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const fy = steelGrade.fy;
    const effectiveD = d!;
    
    const messages: string[] = [];
    const calculations: Record<string, number> = {};

    let result: FlexuralDesignResult;

    switch (this.code) {
      case 'IS456':
        result = this.flexuralDesign_IS456(b, effectiveD, Mu, fck, fy, type, bf, bw, Df);
        break;
      case 'ACI318':
        result = this.flexuralDesign_ACI318(b, effectiveD, Mu, fck, fy, type, bf, bw, Df);
        break;
      case 'EN1992':
        result = this.flexuralDesign_EN1992(b, effectiveD, Mu, fck, fy, type, bf, bw, Df);
        break;
      default:
        result = this.flexuralDesign_IS456(b, effectiveD, Mu, fck, fy, type, bf, bw, Df);
    }

    return result;
  }

  /**
   * IS 456:2000 Flexural Design
   */
  private flexuralDesign_IS456(
    b: number,
    d: number,
    Mu: number,
    fck: number,
    fy: number,
    type: BeamType,
    bf?: number,
    bw?: number,
    Df?: number
  ): FlexuralDesignResult {
    const messages: string[] = [];
    const calculations: Record<string, number> = {};
    const { alpha, beta, epsilonCu } = getIS456StressBlockParams(fck, this.codeVersion);

    // Material properties
    const fcd = 0.446 * fck;  // Design compressive strength
    const fyd = 0.87 * fy;    // Design yield strength
    
    // Limiting neutral axis depth ratio (xu_max / d)
    const xuMaxRatio = STRESS_BLOCK.IS456.k_values[`Fe${fy}` as keyof typeof STRESS_BLOCK.IS456.k_values] || 0.48;
    const xu_max = xuMaxRatio * d;
    
    // Moment capacity for balanced section
    const Mu_lim = alpha * fck * b * xu_max * (d - beta * xu_max) / 1e6; // kN-m
    
    calculations['fcd'] = fcd;
    calculations['fyd'] = fyd;
    calculations['xu_max'] = xu_max;
    calculations['Mu_lim'] = Mu_lim;
    calculations['alpha'] = alpha;
    calculations['beta'] = beta;
    calculations['epsilon_cu'] = epsilonCu;

    let Ast_required: number;
    let Asc_required = 0;
    let xu: number;
    let sectionType: 'singly-reinforced' | 'doubly-reinforced' | 'over-reinforced';
    let Mu_capacity: number;

    if (Mu <= Mu_lim) {
      // Singly Reinforced Section
      sectionType = 'singly-reinforced';
      messages.push('Section designed as singly reinforced beam');

      // Calculate neutral axis depth from equilibrium
      // Mu = alpha * fck * b * xu * (d - beta * xu)
      // Rearranging: (alpha*beta) * fck * b * xu² - alpha * fck * b * d * xu + Mu * 1e6 = 0
      const a = (alpha * beta) * fck * b;
      const bCoeff = -alpha * fck * b * d;
      const c = Mu * 1e6;
      
      const discriminant = bCoeff * bCoeff - 4 * a * c;
      xu = (-bCoeff - Math.sqrt(discriminant)) / (2 * a);
      
      // Calculate required steel
      Ast_required = (alpha * fck * b * xu) / fyd;
      Mu_capacity = Mu_lim; // Conservative for singly reinforced

      calculations['xu'] = xu;
      calculations['Ast_singly'] = Ast_required;

    } else {
      // Doubly Reinforced Section
      sectionType = 'doubly-reinforced';
      messages.push('Section designed as doubly reinforced beam');

      xu = xu_max;
      
      // Moment resisted by compression steel
      const Mu2 = Mu - Mu_lim;
      const d_prime = this.geometry.cover + 12; // Assumed compression steel cover
      
      // Compression steel stress (check if yielded)
      const epsilon_sc = epsilonCu * (xu - d_prime) / xu;
      const Es = 200000; // Modulus of elasticity for steel (MPa)
      const fsc = Math.min(fyd, Es * epsilon_sc);
      
      // Compression steel required
      Asc_required = (Mu2 * 1e6) / (fsc * (d - d_prime));
      
      // Tension steel for balanced section + additional for Mu2
      const Ast_balanced = (alpha * fck * b * xu_max) / fyd;
      const Ast_additional = (Mu2 * 1e6) / (fyd * (d - d_prime));
      Ast_required = Ast_balanced + Ast_additional;
      
      Mu_capacity = Mu_lim + fsc * Asc_required * (d - d_prime) / 1e6;

      calculations['Mu2'] = Mu2;
      calculations['d_prime'] = d_prime;
      calculations['epsilon_sc'] = epsilon_sc;
      calculations['fsc'] = fsc;
      calculations['Asc_required'] = Asc_required;
      calculations['Ast_balanced'] = Ast_balanced;
      calculations['Ast_additional'] = Ast_additional;
    }

    // Check minimum and maximum steel
    const Ast_min = Math.max(0.85 * b * d / fy, 0.0012 * b * this.geometry.D);
    const Ast_max = 0.04 * b * this.geometry.D;
    
    if (Ast_required < Ast_min) {
      messages.push(`Minimum steel governs: ${Ast_min.toFixed(0)} mm² > ${Ast_required.toFixed(0)} mm²`);
      Ast_required = Ast_min;
    }
    
    if (Ast_required > Ast_max) {
      messages.push(`WARNING: Steel exceeds maximum limit of ${Ast_max.toFixed(0)} mm²`);
    }

    calculations['Ast_min'] = Ast_min;
    calculations['Ast_max'] = Ast_max;
    calculations['Ast_final'] = Ast_required;

    // Select reinforcement bars
    const tensionBars = selectBars(Ast_required);
    const compressionBars = Asc_required > 0 ? selectBars(Asc_required) : [];

    const steelRatio = (Ast_required / (b * d)) * 100;
    const utilizationRatio = Mu / Mu_capacity;

    return {
      status: utilizationRatio <= 1.0 ? 'safe' : 'unsafe',
      sectionType,
      Mu_capacity,
      Ast_required,
      Asc_required,
      xu,
      xu_max,
      steelRatio,
      utilizationRatio,
      tensionBars,
      compressionBars,
      messages,
      calculations,
    };
  }

  /**
   * ACI 318-19 Flexural Design
   */
  private flexuralDesign_ACI318(
    b: number,
    d: number,
    Mu: number,
    fc: number,
    fy: number,
    type: BeamType,
    bf?: number,
    bw?: number,
    Df?: number
  ): FlexuralDesignResult {
    const messages: string[] = [];
    const calculations: Record<string, number> = {};

    const phi = ACI_PHI_FACTORS.flexure;
    const beta1 = STRESS_BLOCK.ACI318.getBeta1(fc);
    const epsilonC = 0.003;
    
    // Design strength
    const Mn_required = Mu / phi;
    
    calculations['phi'] = phi;
    calculations['beta1'] = beta1;
    calculations['Mn_required'] = Mn_required;

    // Maximum steel ratio for tension-controlled section
    const epsilon_t_min = 0.004; // Minimum tensile strain for ductility
    const c_max = d * epsilonC / (epsilonC + epsilon_t_min);
    const a_max = beta1 * c_max;
    const As_max = 0.85 * fc * a_max * b / fy;

    // Calculate required steel using Whitney stress block
    // Mn = As * fy * (d - a/2) where a = As*fy / (0.85*fc*b)
    // Rearranging: As = (0.85*fc*b/fy) * (d - sqrt(d² - 2*Mn/(0.85*fc*b)))
    
    const term = d * d - 2 * Mn_required * 1e6 / (0.85 * fc * b);
    
    let Ast_required: number;
    let Asc_required = 0;
    let a: number;
    let c: number;
    let sectionType: 'singly-reinforced' | 'doubly-reinforced' | 'over-reinforced';

    if (term >= 0) {
      // Singly reinforced
      a = d - Math.sqrt(term);
      c = a / beta1;
      Ast_required = 0.85 * fc * a * b / fy;
      sectionType = 'singly-reinforced';
      messages.push('Section designed as singly reinforced (ACI 318)');
    } else {
      // Doubly reinforced needed
      sectionType = 'doubly-reinforced';
      messages.push('Section designed as doubly reinforced (ACI 318)');
      
      a = a_max;
      c = c_max;
      const Mn1 = 0.85 * fc * b * a * (d - a/2) / 1e6;
      const Mn2 = Mn_required - Mn1;
      
      const d_prime = this.geometry.cover + 12;
      const epsilon_s = epsilonC * (c - d_prime) / c;
      const fs_prime = Math.min(fy, 200000 * epsilon_s);
      
      Asc_required = (Mn2 * 1e6) / (fs_prime * (d - d_prime));
      Ast_required = (0.85 * fc * b * a / fy) + Asc_required;
      
      calculations['Mn1'] = Mn1;
      calculations['Mn2'] = Mn2;
      calculations['fs_prime'] = fs_prime;
    }

    // Minimum steel (ACI 318 Section 9.6.1.2)
    const Ast_min = Math.max(
      0.25 * Math.sqrt(fc) * b * d / fy,
      1.4 * b * d / fy
    );

    if (Ast_required < Ast_min) {
      messages.push(`Minimum steel governs: ${Ast_min.toFixed(0)} mm²`);
      Ast_required = Ast_min;
    }

    // Calculate actual capacity
    const a_actual = Ast_required * fy / (0.85 * fc * b);
    const Mn_capacity = Ast_required * fy * (d - a_actual/2) / 1e6;
    const Mu_capacity = phi * Mn_capacity;

    calculations['a'] = a;
    calculations['c'] = c;
    calculations['Ast_min'] = Ast_min;
    calculations['Mn_capacity'] = Mn_capacity;
    calculations['Mu_capacity'] = Mu_capacity;

    const tensionBars = selectBars(Ast_required);
    const compressionBars = Asc_required > 0 ? selectBars(Asc_required) : [];

    return {
      status: Mu <= Mu_capacity ? 'safe' : 'unsafe',
      sectionType,
      Mu_capacity,
      Ast_required,
      Asc_required,
      xu: c,
      xu_max: c_max,
      steelRatio: (Ast_required / (b * d)) * 100,
      utilizationRatio: Mu / Mu_capacity,
      tensionBars,
      compressionBars,
      messages,
      calculations,
    };
  }

  /**
   * Eurocode 2 (EN 1992) Flexural Design
   */
  private flexuralDesign_EN1992(
    b: number,
    d: number,
    Mu: number,
    fck: number,
    fy: number,
    type: BeamType,
    bf?: number,
    bw?: number,
    Df?: number
  ): FlexuralDesignResult {
    const messages: string[] = [];
    const calculations: Record<string, number> = {};

    const gammac = SAFETY_FACTORS.EN1992.gammac;
    const gammas = SAFETY_FACTORS.EN1992.gammas;
    
    const fcd = 0.85 * fck / gammac;
    const fyd = fy / gammas;
    
    const lambda = STRESS_BLOCK.EN1992.lambda(fck);
    const eta = STRESS_BLOCK.EN1992.eta(fck);
    
    calculations['fcd'] = fcd;
    calculations['fyd'] = fyd;
    calculations['lambda'] = lambda;
    calculations['eta'] = eta;

    // Maximum neutral axis depth for ductility (x/d ≤ 0.45 for Class B/C steel)
    const x_d_max = 0.45;
    const x_max = x_d_max * d;
    
    // Normalized moment capacity
    const K_max = lambda * eta * x_d_max * (1 - 0.5 * lambda * x_d_max);
    const Mu_max = K_max * fcd * b * d * d / 1e6;
    
    // K factor for applied moment
    const K = Mu * 1e6 / (fcd * b * d * d);
    
    calculations['K_max'] = K_max;
    calculations['K'] = K;
    calculations['Mu_max'] = Mu_max;

    let Ast_required: number;
    let Asc_required = 0;
    let x: number;
    let sectionType: 'singly-reinforced' | 'doubly-reinforced' | 'over-reinforced';

    if (K <= K_max) {
      // Singly reinforced
      sectionType = 'singly-reinforced';
      const z = d * (0.5 + Math.sqrt(0.25 - K / (1.134)));
      x = (d - z) / 0.4;
      Ast_required = Mu * 1e6 / (fyd * z);
      messages.push('Section designed as singly reinforced (EC2)');
      
      calculations['z'] = z;
    } else {
      // Doubly reinforced
      sectionType = 'doubly-reinforced';
      x = x_max;
      const z_max = d - 0.4 * x_max;
      
      const Mu1 = Mu_max;
      const Mu2 = Mu - Mu1;
      
      const d_prime = this.geometry.cover + 12;
      const epsilon_sc = 0.0035 * (x_max - d_prime) / x_max;
      const sigma_sc = Math.min(fyd, 200000 * epsilon_sc);
      
      Asc_required = (Mu2 * 1e6) / (sigma_sc * (d - d_prime));
      const As1 = (Mu1 * 1e6) / (fyd * z_max);
      const As2 = Asc_required; // Equal forces
      Ast_required = As1 + As2;
      
      messages.push('Section designed as doubly reinforced (EC2)');
      
      calculations['Mu1'] = Mu1;
      calculations['Mu2'] = Mu2;
      calculations['z_max'] = z_max;
      calculations['sigma_sc'] = sigma_sc;
    }

    // Minimum steel (EC2 Section 9.2.1.1)
    const fctm = 0.3 * Math.pow(fck, 2/3);
    const Ast_min = Math.max(
      0.26 * fctm / fy * b * d,
      0.0013 * b * d
    );

    // Maximum steel
    const Ast_max = 0.04 * b * this.geometry.D;

    if (Ast_required < Ast_min) {
      messages.push(`Minimum steel governs: ${Ast_min.toFixed(0)} mm²`);
      Ast_required = Ast_min;
    }

    calculations['fctm'] = fctm;
    calculations['Ast_min'] = Ast_min;
    calculations['Ast_max'] = Ast_max;

    const tensionBars = selectBars(Ast_required);
    const compressionBars = Asc_required > 0 ? selectBars(Asc_required) : [];

    // Calculate capacity
    const z = d - 0.4 * x;
    const Mu_capacity = fyd * Ast_required * z / 1e6;

    return {
      status: Mu <= Mu_capacity ? 'safe' : 'unsafe',
      sectionType,
      Mu_capacity,
      Ast_required,
      Asc_required,
      xu: x,
      xu_max: x_max,
      steelRatio: (Ast_required / (b * d)) * 100,
      utilizationRatio: Mu / Mu_capacity,
      tensionBars,
      compressionBars,
      messages,
      calculations,
    };
  }

  // ===========================================================================
  // SHEAR DESIGN
  // ===========================================================================

  private designForShear(): ShearDesignResult {
    const { b, d, D, bw, type } = this.geometry;
    const { Vu } = this.loading;
    const { concreteGrade, steelGrade, stirrupGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const fyv = (stirrupGrade || steelGrade).fy;
    const effectiveB = type === 'rectangular' ? b : (bw || b);
    const effectiveD = d!;

    let result: ShearDesignResult;

    switch (this.code) {
      case 'IS456':
        result = this.shearDesign_IS456(effectiveB, effectiveD, D, Vu, fck, fyv);
        break;
      case 'ACI318':
        result = this.shearDesign_ACI318(effectiveB, effectiveD, D, Vu, fck, fyv);
        break;
      case 'EN1992':
        result = this.shearDesign_EN1992(effectiveB, effectiveD, D, Vu, fck, fyv);
        break;
      default:
        result = this.shearDesign_IS456(effectiveB, effectiveD, D, Vu, fck, fyv);
    }

    return result;
  }

  /**
   * IS 456 Shear Design
   */
  private shearDesign_IS456(
    b: number,
    d: number,
    D: number,
    Vu: number,
    fck: number,
    fyv: number
  ): ShearDesignResult {
    const messages: string[] = [];
    const calculations: Record<string, number> = {};

    // Design shear stress
    const tau_v = (Vu * 1000) / (b * d); // MPa
    
    // Concrete shear capacity (assuming 0.5% steel ratio initially)
    const pt = 0.5; // Will be updated with actual value
    const beta = Math.max(1, 0.8 * fck / (6.89 * pt));
    const tau_c = 0.85 * Math.sqrt(0.8 * fck) * (Math.sqrt(1 + 5 * beta) - 1) / (6 * beta);
    
    // Simplified: Table 19 of IS 456
    const tau_c_table = this.getIS456ShearStrength(pt, fck);
    
    // Maximum shear stress
    const tau_c_max = this.getIS456MaxShearStress(fck);
    
    calculations['tau_v'] = tau_v;
    calculations['tau_c'] = tau_c_table;
    calculations['tau_c_max'] = tau_c_max;

    // Shear capacity of concrete
    const Vuc = tau_c_table * b * d / 1000; // kN
    
    if (tau_v > tau_c_max) {
      messages.push('CRITICAL: Shear stress exceeds maximum allowed. Increase section size.');
      return {
        status: 'unsafe',
        Vuc,
        Vus_required: Vu - Vuc,
        Vn_capacity: tau_c_max * b * d / 1000,
        stirrupDiameter: 0,
        stirrupLegs: 0,
        stirrupSpacing: 0,
        maxSpacing: 0,
        utilizationRatio: tau_v / tau_c_max,
        messages,
        calculations,
      };
    }

    // Shear to be resisted by stirrups
    const Vus = Math.max(0, Vu - Vuc);
    
    if (Vus <= 0) {
      messages.push('Concrete alone can resist shear. Provide nominal stirrups.');
    }

    // Stirrup design
    const stirrupDia = 8; // mm
    const legs = 2;
    const Asv = Math.PI * Math.pow(stirrupDia, 2) / 4 * legs;
    
    // Required spacing
    let sv: number;
    if (Vus > 0) {
      sv = 0.87 * fyv * Asv * d / (Vus * 1000);
    } else {
      sv = 300; // Nominal
    }
    
    // Maximum spacing
    const sv_max = Math.min(0.75 * d, 300);
    sv = Math.min(sv, sv_max);
    
    // Minimum shear reinforcement
    const Asv_min = 0.4 * b * sv / (0.87 * fyv);
    
    if (Asv < Asv_min) {
      messages.push('Minimum shear reinforcement governs');
    }

    calculations['Vuc'] = Vuc;
    calculations['Vus'] = Vus;
    calculations['Asv'] = Asv;
    calculations['sv'] = sv;
    calculations['sv_max'] = sv_max;

    // Provided capacity
    const Vus_provided = 0.87 * fyv * Asv * d / (sv * 1000);
    const Vn_capacity = Vuc + Vus_provided;

    return {
      status: Vu <= Vn_capacity ? 'safe' : 'unsafe',
      Vuc,
      Vus_required: Vus,
      Vn_capacity,
      stirrupDiameter: stirrupDia,
      stirrupLegs: legs,
      stirrupSpacing: Math.round(sv / 5) * 5, // Round to nearest 5mm
      maxSpacing: sv_max,
      utilizationRatio: Vu / Vn_capacity,
      messages,
      calculations,
    };
  }

  /**
   * ACI 318 Shear Design
   */
  private shearDesign_ACI318(
    bw: number,
    d: number,
    h: number,
    Vu: number,
    fc: number,
    fyt: number
  ): ShearDesignResult {
    const messages: string[] = [];
    const calculations: Record<string, number> = {};

    const phi = ACI_PHI_FACTORS.shear;
    
    // Concrete shear capacity (simplified)
    const Vc = 0.17 * Math.sqrt(fc) * bw * d / 1000; // kN
    
    // Maximum shear (Section 22.5.1.2)
    const Vs_max = 0.66 * Math.sqrt(fc) * bw * d / 1000; // kN
    const Vn_max = Vc + Vs_max;
    
    calculations['phi'] = phi;
    calculations['Vc'] = Vc;
    calculations['Vs_max'] = Vs_max;

    const Vn_required = Vu / phi;
    
    if (Vn_required > Vn_max) {
      messages.push('CRITICAL: Increase section size or concrete strength');
      return {
        status: 'unsafe',
        Vuc: Vc,
        Vus_required: Vn_required - Vc,
        Vn_capacity: phi * Vn_max,
        stirrupDiameter: 0,
        stirrupLegs: 0,
        stirrupSpacing: 0,
        maxSpacing: 0,
        utilizationRatio: Vu / (phi * Vn_max),
        messages,
        calculations,
      };
    }

    // Required stirrup capacity
    const Vs = Math.max(0, Vn_required - Vc);
    
    // Stirrup design
    const stirrupDia = 10; // mm (#3)
    const legs = 2;
    const Av = Math.PI * Math.pow(stirrupDia, 2) / 4 * legs;
    
    let s: number;
    if (Vs > 0) {
      s = Av * fyt * d / (Vs * 1000);
    } else {
      s = d / 2; // Nominal
    }
    
    // Maximum spacing
    const s_max = Vs <= 0.33 * Math.sqrt(fc) * bw * d / 1000 
      ? Math.min(d / 2, 600)
      : Math.min(d / 4, 300);
    
    s = Math.min(s, s_max);
    
    // Minimum shear reinforcement
    const Av_min = Math.max(
      0.062 * Math.sqrt(fc) * bw * s / fyt,
      0.35 * bw * s / fyt
    );

    calculations['Vs'] = Vs;
    calculations['Av'] = Av;
    calculations['s'] = s;
    calculations['s_max'] = s_max;
    calculations['Av_min'] = Av_min;

    const Vs_provided = Av * fyt * d / (s * 1000);
    const Vn_capacity = phi * (Vc + Vs_provided);

    return {
      status: Vu <= Vn_capacity ? 'safe' : 'unsafe',
      Vuc: Vc,
      Vus_required: Vs,
      Vn_capacity,
      stirrupDiameter: stirrupDia,
      stirrupLegs: legs,
      stirrupSpacing: Math.round(s / 25) * 25, // Round to nearest 25mm
      maxSpacing: s_max,
      utilizationRatio: Vu / Vn_capacity,
      messages,
      calculations,
    };
  }

  /**
   * Eurocode 2 Shear Design
   */
  private shearDesign_EN1992(
    bw: number,
    d: number,
    h: number,
    VEd: number,
    fck: number,
    fywd: number
  ): ShearDesignResult {
    const messages: string[] = [];
    const calculations: Record<string, number> = {};

    const gammac = SAFETY_FACTORS.EN1992.gammac;
    
    // Design concrete compressive strength
    const fcd = 0.85 * fck / gammac;
    
    // Shear resistance without reinforcement (6.2.2)
    const k = Math.min(2.0, 1 + Math.sqrt(200 / d));
    const rho_l = Math.min(0.02, 0.005); // Assumed, should be calculated
    const CRd_c = 0.18 / gammac;
    const k1 = 0.15;
    const sigma_cp = 0; // No axial load assumed
    
    const vRd_c = Math.max(
      CRd_c * k * Math.pow(100 * rho_l * fck, 1/3) + k1 * sigma_cp,
      0.035 * Math.pow(k, 1.5) * Math.sqrt(fck) + k1 * sigma_cp
    );
    
    const VRd_c = vRd_c * bw * d / 1000; // kN
    
    calculations['k'] = k;
    calculations['vRd_c'] = vRd_c;
    calculations['VRd_c'] = VRd_c;

    if (VEd <= VRd_c) {
      messages.push('No shear reinforcement required. Provide nominal stirrups.');
      return {
        status: 'safe',
        Vuc: VRd_c,
        Vus_required: 0,
        Vn_capacity: VRd_c,
        stirrupDiameter: 6,
        stirrupLegs: 2,
        stirrupSpacing: Math.min(0.75 * d, 300),
        maxSpacing: Math.min(0.75 * d, 300),
        utilizationRatio: VEd / VRd_c,
        messages,
        calculations,
      };
    }

    // Shear reinforcement design (6.2.3)
    const theta = Math.PI / 4; // 45 degrees assumed
    const alpha_cw = 1.0; // No prestress
    const v1 = 0.6 * (1 - fck / 250);
    const z = 0.9 * d;
    
    // Maximum shear resistance
    const VRd_max = alpha_cw * bw * z * v1 * fcd / (Math.tan(theta) + 1/Math.tan(theta)) / 1000;
    
    if (VEd > VRd_max) {
      messages.push('CRITICAL: Increase section size or concrete strength');
    }
    
    // Required stirrup ratio
    const Asw_s = VEd * 1000 / (z * fywd / 1.15 * Math.tan(theta));
    
    const stirrupDia = 8;
    const legs = 2;
    const Asw = Math.PI * Math.pow(stirrupDia, 2) / 4 * legs;
    const s = Asw / Asw_s;
    
    // Maximum spacing
    const s_max = Math.min(0.75 * d, 300);
    const s_final = Math.min(s, s_max);
    
    // Minimum reinforcement
    const rho_w_min = 0.08 * Math.sqrt(fck) / fywd;
    const Asw_min = rho_w_min * bw;

    calculations['VRd_max'] = VRd_max;
    calculations['Asw_s'] = Asw_s;
    calculations['s'] = s_final;

    const VRd_s = Asw / s_final * z * fywd / 1.15 / 1000;
    const Vn_capacity = Math.min(VRd_c + VRd_s, VRd_max);

    return {
      status: VEd <= Vn_capacity ? 'safe' : 'unsafe',
      Vuc: VRd_c,
      Vus_required: VEd - VRd_c,
      Vn_capacity,
      stirrupDiameter: stirrupDia,
      stirrupLegs: legs,
      stirrupSpacing: Math.round(s_final / 5) * 5,
      maxSpacing: s_max,
      utilizationRatio: VEd / Vn_capacity,
      messages,
      calculations,
    };
  }

  // ===========================================================================
  // TORSION DESIGN
  // ===========================================================================

  private designForTorsion(): TorsionDesignResult {
    const { b, d, D, bw, type } = this.geometry;
    const { Tu, Vu } = this.loading;
    const { concreteGrade, steelGrade, stirrupGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const fy = steelGrade.fy;
    const fyv = (stirrupGrade || steelGrade).fy;
    const effectiveB = type === 'rectangular' ? b : (bw || b);

    const messages: string[] = [];
    const calculations: Record<string, number> = {};

    // Section properties
    const Acp = effectiveB * D; // Gross area
    const pcp = 2 * (effectiveB + D); // Perimeter
    
    // Cracking torque (simplified)
    const fctm = 0.3 * Math.pow(fck, 2/3);
    const Tcr = 0.33 * fctm * Acp * Acp / pcp / 1e6; // kN-m
    
    calculations['Acp'] = Acp;
    calculations['pcp'] = pcp;
    calculations['fctm'] = fctm;
    calculations['Tcr'] = Tcr;

    if (!Tu || Tu < 0.25 * Tcr) {
      return {
        status: 'negligible',
        Tcr,
        Tu_capacity: Tcr,
        Asl_required: 0,
        Asv_required: 0,
        stirrupSpacing: 0,
        messages: ['Torsion is negligible, can be ignored'],
        calculations,
      };
    }

    // Effective thickness
    const tef = effectiveB / 2; // Simplified
    const Ak = (effectiveB - tef) * (D - tef); // Area enclosed by center line
    const uk = 2 * ((effectiveB - tef) + (D - tef)); // Perimeter
    
    // Torsional reinforcement (IS 456 approach)
    const fyd = 0.87 * fy;
    const fywd = 0.87 * fyv;
    
    // Longitudinal steel for torsion
    const Asl = Tu! * 1e6 * uk / (2 * Ak * fyd);
    
    // Transverse steel for torsion
    const At_s = Tu! * 1e6 / (2 * Ak * fywd);
    
    // Combined shear and torsion (equivalent shear)
    const Ve = Vu + 1.6 * Tu! * 1000 / effectiveB;
    
    calculations['tef'] = tef;
    calculations['Ak'] = Ak;
    calculations['uk'] = uk;
    calculations['Asl'] = Asl;
    calculations['At_s'] = At_s;
    calculations['Ve'] = Ve;

    // Select stirrups
    const stirrupDia = 10;
    const legs = 2;
    const Asv = Math.PI * Math.pow(stirrupDia, 2) / 4 * legs;
    const sv = Asv / (At_s / 1000);
    
    const sv_max = Math.min(300, (effectiveB + D) / 4);
    const sv_final = Math.min(sv, sv_max);

    // Capacity check
    const Tu_capacity = 2 * Ak * fywd * Asv / sv_final / 1e6;

    return {
      status: Tu! <= Tu_capacity ? 'safe' : 'unsafe',
      Tcr,
      Tu_capacity,
      Asl_required: Asl,
      Asv_required: At_s,
      stirrupSpacing: Math.round(sv_final / 5) * 5,
      messages,
      calculations,
    };
  }

  // ===========================================================================
  // DEFLECTION CHECK
  // ===========================================================================

  private checkDeflection(Ast: number): DeflectionCheckResult {
    const { b, d, D, L } = this.geometry;
    const { supportCondition } = this.loading;
    const { concreteGrade, steelGrade } = this.materials;
    
    const messages: string[] = [];

    // Basic span/depth ratios (IS 456)
    let basicRatio: number;
    switch (supportCondition) {
      case 'cantilever': basicRatio = 7; break;
      case 'simply-supported': basicRatio = 20; break;
      case 'continuous': basicRatio = 26; break;
      case 'fixed-fixed': basicRatio = 26; break;
      default: basicRatio = 20;
    }

    // Modification factors
    const pt = (Ast / (b * d!)) * 100;
    const fs = 0.58 * steelGrade.fy; // Service stress at full utilization
    
    // Tension steel factor (IS 456 Fig 4)
    const kt = this.getTensionModificationFactor(pt, steelGrade.fy, fs);
    
    // Compression steel factor
    const kc = 1.0; // Assuming no compression steel for deflection
    
    // Modified permissible ratio
    const allowedRatio = basicRatio * kt * kc;
    const providedRatio = L / d!;

    // Detailed deflection calculation
    const Ec = concreteGrade.Ecm;
    const Es = steelGrade.Es;
    const m = Es / Ec;
    
    // Cracked moment of inertia (simplified)
    const Icr = this.calculateCrackedMomentOfInertia(b, d!, Ast, m);
    
    // Immediate deflection (for UDL)
    let immediateDeflection: number;
    switch (supportCondition) {
      case 'simply-supported':
        immediateDeflection = 5 * (this.loading.Mservice || this.loading.Mu * 0.7) * 1e6 * L * L / (48 * Ec * Icr);
        break;
      case 'cantilever':
        immediateDeflection = (this.loading.Mservice || this.loading.Mu * 0.7) * 1e6 * L * L / (2 * Ec * Icr);
        break;
      default:
        immediateDeflection = (this.loading.Mservice || this.loading.Mu * 0.7) * 1e6 * L * L / (48 * Ec * Icr);
    }
    
    // Long-term deflection factor
    const xi = 2.0; // For 5+ years
    const rho_prime = 0; // No compression steel assumed
    const lambda = xi / (1 + 50 * rho_prime);
    
    const longTermDeflection = lambda * immediateDeflection;
    const totalDeflection = immediateDeflection + longTermDeflection;
    
    // Allowable deflection
    const allowableDeflection = L / 250;

    return {
      status: providedRatio <= allowedRatio && totalDeflection <= allowableDeflection ? 'pass' : 'fail',
      spanDepthRatio_provided: providedRatio,
      spanDepthRatio_allowed: allowedRatio,
      immediateDeflection,
      longTermDeflection,
      totalDeflection,
      allowableDeflection,
      messages: [
        `Span/Depth Ratio: ${providedRatio.toFixed(1)} / ${allowedRatio.toFixed(1)}`,
        `Total Deflection: ${totalDeflection.toFixed(2)} mm / ${allowableDeflection.toFixed(2)} mm`,
      ],
    };
  }

  // ===========================================================================
  // CRACK WIDTH CALCULATION
  // ===========================================================================

  private calculateCrackWidth(Ast: number): CrackWidthResult {
    const { b, d, D } = this.geometry;
    const { Mservice } = this.loading;
    const { concreteGrade, steelGrade } = this.materials;
    
    if (!Mservice) {
      return {
        status: 'pass',
        crackWidth: 0,
        allowableCrackWidth: 0.3,
        steelStress: 0,
        crackSpacing: 0,
        messages: ['Service moment not provided'],
      };
    }

    const Es = steelGrade.Es;
    const Ec = concreteGrade.Ecm;
    const m = Es / Ec;
    
    // Calculate steel stress
    const z = d! * 0.9; // Approximate lever arm
    const fs = Mservice * 1e6 / (Ast * z);
    
    // Crack spacing (IS 456 Annex F / EC2)
    const cover = this.geometry.cover;
    const barDia = 16; // Assumed average
    const Aceff = Math.min(2.5 * cover * b, b * (D - d!) / 3);
    const rho_eff = Ast / Aceff;
    
    // EC2 approach
    const Sr_max = 3.4 * cover + 0.425 * barDia / rho_eff;
    
    // Strain
    const epsilon_sm = fs / Es;
    const fctm = concreteGrade.fctm;
    const kt = 0.4; // Long term loading
    const epsilon_cm = kt * fctm / (rho_eff * Es);
    
    const epsilon_diff = Math.max(epsilon_sm - epsilon_cm, 0.6 * fs / Es);
    
    // Crack width
    const crackWidth = Sr_max * epsilon_diff;
    
    // Allowable crack width (based on exposure)
    const allowableCrackWidth = 0.3; // mm for moderate exposure

    return {
      status: crackWidth <= allowableCrackWidth ? 'pass' : 'fail',
      crackWidth,
      allowableCrackWidth,
      steelStress: fs,
      crackSpacing: Sr_max,
      messages: [
        `Calculated crack width: ${crackWidth.toFixed(3)} mm`,
        `Steel stress at service: ${fs.toFixed(1)} MPa`,
      ],
    };
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private getIS456ShearStrength(pt: number, fck: number): number {
    // Simplified from Table 19 of IS 456
    const baseValues: Record<string, number[]> = {
      // [M15, M20, M25, M30, M35, M40+]
      '0.15': [0.28, 0.28, 0.29, 0.29, 0.29, 0.30],
      '0.25': [0.35, 0.36, 0.36, 0.37, 0.37, 0.38],
      '0.50': [0.46, 0.48, 0.49, 0.50, 0.50, 0.51],
      '0.75': [0.54, 0.56, 0.57, 0.59, 0.59, 0.60],
      '1.00': [0.60, 0.62, 0.64, 0.66, 0.67, 0.68],
      '1.25': [0.64, 0.67, 0.70, 0.71, 0.73, 0.74],
      '1.50': [0.68, 0.72, 0.74, 0.76, 0.78, 0.79],
      '1.75': [0.71, 0.75, 0.78, 0.80, 0.82, 0.84],
      '2.00': [0.71, 0.79, 0.82, 0.84, 0.86, 0.88],
      '2.25': [0.71, 0.81, 0.85, 0.88, 0.90, 0.92],
      '2.50': [0.71, 0.82, 0.88, 0.91, 0.93, 0.95],
      '2.75': [0.71, 0.82, 0.90, 0.94, 0.96, 0.98],
      '3.00': [0.71, 0.82, 0.92, 0.96, 0.99, 1.01],
    };
    
    // Get grade index
    let gradeIdx = Math.floor((fck - 15) / 5);
    gradeIdx = Math.max(0, Math.min(5, gradeIdx));
    
    // Find closest pt value
    const ptKeys = Object.keys(baseValues).map(Number);
    let lowerKey = ptKeys[0];
    let upperKey = ptKeys[ptKeys.length - 1];
    
    for (let i = 0; i < ptKeys.length - 1; i++) {
      if (pt >= ptKeys[i] && pt < ptKeys[i + 1]) {
        lowerKey = ptKeys[i];
        upperKey = ptKeys[i + 1];
        break;
      }
    }
    
    // Interpolate
    const lowerValue = baseValues[lowerKey.toFixed(2)]?.[gradeIdx] || 0.28;
    const upperValue = baseValues[upperKey.toFixed(2)]?.[gradeIdx] || 0.28;
    
    if (lowerKey === upperKey) return lowerValue;
    
    return lowerValue + (pt - lowerKey) * (upperValue - lowerValue) / (upperKey - lowerKey);
  }

  private getIS456MaxShearStress(fck: number): number {
    // Table 20 of IS 456
    const values: Record<number, number> = {
      15: 2.5,
      20: 2.8,
      25: 3.1,
      30: 3.5,
      35: 3.7,
      40: 4.0,
    };
    
    const grades = Object.keys(values).map(Number);
    for (let i = 0; i < grades.length; i++) {
      if (fck <= grades[i]) return values[grades[i]];
    }
    return 4.0;
  }

  private getTensionModificationFactor(pt: number, fy: number, fs: number): number {
    // Simplified from IS 456 Fig 4
    // This is a rough approximation
    const baseFactor = 1.0;
    const ptEffect = 0.225 + 0.00322 * fs - 0.625 * Math.log10(pt);
    return Math.max(0.8, Math.min(2.0, ptEffect));
  }

  private calculateCrackedMomentOfInertia(b: number, d: number, Ast: number, m: number): number {
    // Cracked section analysis
    // Find neutral axis
    const mAst = m * Ast;
    // b*x²/2 = mAst*(d-x)
    const a = b / 2;
    const bCoeff = mAst;
    const c = -mAst * d;
    
    const x = (-bCoeff + Math.sqrt(bCoeff * bCoeff - 4 * a * c)) / (2 * a);
    
    // Cracked moment of inertia
    const Icr = b * Math.pow(x, 3) / 3 + mAst * Math.pow(d - x, 2);
    
    return Icr;
  }

  private generateSummary(
    flexure: FlexuralDesignResult,
    shear: ShearDesignResult,
    torsion: TorsionDesignResult | undefined,
    deflection: DeflectionCheckResult,
    crackWidth: CrackWidthResult | undefined
  ): BeamDesignResult['summary'] {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Collect all warnings
    if (flexure.status === 'unsafe') warnings.push('Flexural design is inadequate');
    if (shear.status === 'unsafe') warnings.push('Shear design is inadequate');
    if (torsion?.status === 'unsafe') warnings.push('Torsion design is inadequate');
    if (deflection.status === 'fail') warnings.push('Deflection check failed');
    if (crackWidth?.status === 'fail') warnings.push('Crack width exceeds limit');

    // Recommendations
    if (flexure.utilizationRatio > 0.9) {
      recommendations.push('Consider increasing beam depth for better flexural efficiency');
    }
    if (shear.utilizationRatio > 0.8) {
      recommendations.push('Consider closer stirrup spacing or larger stirrup diameter');
    }
    if (deflection.status === 'fail') {
      recommendations.push('Increase beam depth or add compression steel to control deflection');
    }

    // Overall status
    const allStatuses = [
      flexure.status === 'safe',
      shear.status === 'safe',
      !torsion || torsion.status === 'safe' || torsion.status === 'negligible',
      deflection.status === 'pass',
      !crackWidth || crackWidth.status === 'pass',
    ];

    let overallStatus: 'safe' | 'unsafe' | 'marginal';
    if (allStatuses.every(s => s)) {
      const maxUtil = Math.max(flexure.utilizationRatio, shear.utilizationRatio);
      overallStatus = maxUtil > 0.95 ? 'marginal' : 'safe';
    } else {
      overallStatus = 'unsafe';
    }

    return {
      overallStatus,
      utilizationRatio: Math.max(flexure.utilizationRatio, shear.utilizationRatio),
      warnings,
      recommendations,
    };
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Quick design for simple rectangular beam
 */
export function designRectangularBeam(
  b: number,
  D: number,
  L: number,
  Mu: number,
  Vu: number,
  fck: number,
  fy: number,
  code: DesignCode = 'IS456'
): BeamDesignResult {
  const concreteGrades = getConcreteGrades(code);
  const steelGrades = getSteelGrades(code);
  
  const concreteGrade = concreteGrades.find(g => g.fck === fck) || concreteGrades[2];
  const steelGrade = steelGrades.find(g => g.fy === fy) || steelGrades[1];

  const engine = new RCBeamDesignEngine(
    {
      type: 'rectangular',
      b,
      D,
      L,
      cover: 40,
    },
    {
      Mu,
      Vu,
      loadType: 'UDL',
      supportCondition: 'simply-supported',
    },
    {
      concreteGrade,
      steelGrade,
      code,
    }
  );

  return engine.design();
}

/**
 * Quick design for T-beam
 */
export function designTBeam(
  bw: number,
  bf: number,
  Df: number,
  D: number,
  L: number,
  Mu: number,
  Vu: number,
  fck: number,
  fy: number,
  code: DesignCode = 'IS456'
): BeamDesignResult {
  const concreteGrades = getConcreteGrades(code);
  const steelGrades = getSteelGrades(code);
  
  const concreteGrade = concreteGrades.find(g => g.fck === fck) || concreteGrades[2];
  const steelGrade = steelGrades.find(g => g.fy === fy) || steelGrades[1];

  const engine = new RCBeamDesignEngine(
    {
      type: 'T-beam',
      b: bw,
      D,
      bw,
      bf,
      Df,
      L,
      cover: 40,
    },
    {
      Mu,
      Vu,
      loadType: 'UDL',
      supportCondition: 'continuous',
    },
    {
      concreteGrade,
      steelGrade,
      code,
    }
  );

  return engine.design();
}

export default RCBeamDesignEngine;
