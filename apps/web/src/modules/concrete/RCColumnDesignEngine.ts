/**
 * ============================================================================
 * COMPREHENSIVE RC COLUMN DESIGN ENGINE
 * ============================================================================
 * 
 * Complete reinforced concrete column design as per international codes.
 * Features:
 * - Short column design (axial + uniaxial/biaxial bending)
 * - Slender column design with P-Δ effects
 * - Interaction diagrams
 * - Slenderness effects (moment magnification)
 * - Minimum eccentricity
 * - Biaxial bending using Bresler's method
 * - Circular and rectangular columns
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
  SAFETY_FACTORS,
  ACI_PHI_FACTORS,
  STRESS_BLOCK,
  getConcreteGrades,
  getSteelGrades,
  getRebarByDiameter,
  selectBars,
  getIS456ConcreteGrades,
  DRAFT_WARNING_IS456_2025,
} from './RCDesignConstants';
import type {
  IS456Version,
  CementType,
  IS456_2025_PerformanceCriteria,
} from './RCDesignConstants';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type ColumnType = 'rectangular' | 'circular' | 'L-shaped' | 'T-shaped';
export type EndCondition = 'fixed-fixed' | 'fixed-pinned' | 'pinned-pinned' | 'fixed-free';
export type BracingCondition = 'braced' | 'unbraced' | 'sway' | 'non-sway';

export interface ColumnGeometry {
  type: ColumnType;
  b: number;              // Width (mm) - or diameter for circular
  D: number;              // Depth (mm) - same as b for circular
  L: number;              // Unsupported length (mm)
  Leff?: number;          // Effective length (mm)
  cover: number;          // Clear cover (mm)
  endConditionX: EndCondition;
  endConditionY: EndCondition;
  bracingCondition: BracingCondition;
}

export interface ColumnLoading {
  Pu: number;             // Ultimate axial load (kN)
  Mux: number;            // Ultimate moment about X-axis (kN-m)
  Muy: number;            // Ultimate moment about Y-axis (kN-m)
  Mux_top?: number;       // Top moment about X (for slenderness)
  Mux_bottom?: number;    // Bottom moment about X
  Muy_top?: number;       // Top moment about Y
  Muy_bottom?: number;    // Bottom moment about Y
  loadCase: 'concentric' | 'uniaxial' | 'biaxial';
}

export interface ColumnMaterials {
  concreteGrade: ConcreteGrade;
  steelGrade: SteelGrade;
  tieGrade?: SteelGrade;
  code: DesignCode;
  /** Selects IS 456:2000 (production) vs Draft IS 456:2025 (research only). Defaults to IS456_2000. */
  codeVersion?: IS456Version;
  /** Cement type per IS 456 Table 1 / Amendment No. 6 (June 2024). */
  cementType?: CementType;
}

export interface ReinforcementLayout {
  arrangement: 'equal-spacing' | 'concentrated-corners' | 'two-faces';
  barDiameter: number;
  numberOfBars: number;
  totalArea: number;
  steelRatio: number;
  barPositions: { x: number; y: number }[];
}

export interface InteractionPoint {
  Pn: number;             // Nominal axial capacity (kN)
  Mn: number;             // Nominal moment capacity (kN-m)
  phi?: number;           // Strength reduction factor
  phiPn?: number;         // Design axial capacity
  phiMn?: number;         // Design moment capacity
  neutralAxis?: number;   // Neutral axis depth (mm)
  strainProfile?: number[];
}

export interface SlendernessResult {
  isSlender: boolean;
  slendernessRatio_X: number;
  slendernessRatio_Y: number;
  limitRatio: number;
  effectiveLength_X: number;
  effectiveLength_Y: number;
  k_X: number;            // Effective length factor
  k_Y: number;
  momentMagnifier_X?: number;
  momentMagnifier_Y?: number;
  magnifiedMoment_X?: number;
  magnifiedMoment_Y?: number;
  messages: string[];
}

export interface ColumnDesignResult {
  status: 'safe' | 'unsafe' | 'warning';
  geometry: ColumnGeometry;
  materials: ColumnMaterials;
  loading: ColumnLoading;
  slenderness: SlendernessResult;
  reinforcement: ReinforcementLayout;
  axialCapacity: number;          // kN
  momentCapacity_X: number;       // kN-m
  momentCapacity_Y: number;       // kN-m
  interactionRatio: number;       // Should be ≤ 1.0
  utilizationRatio: number;
  interactionDiagram: InteractionPoint[];
  ties: {
    diameter: number;
    spacing: number;
    pitch: number;
  };
  messages: string[];
  calculations: Record<string, number>;
  /** IS 456:2025 Draft six performance criteria — populated only when codeVersion = 'IS456_2025_DRAFT'. */
  performanceCriteria?: IS456_2025_PerformanceCriteria;
  /** Present only for IS 456:2025 Draft mode; must be surfaced in UI. */
  draftWarning?: string;
}

// =============================================================================
// MAIN COLUMN DESIGN ENGINE CLASS
// =============================================================================

export class RCColumnDesignEngine {
  private geometry: ColumnGeometry;
  private loading: ColumnLoading;
  private materials: ColumnMaterials;
  private code: DesignCode;

  constructor(
    geometry: ColumnGeometry,
    loading: ColumnLoading,
    materials: ColumnMaterials
  ) {
    this.geometry = { ...geometry };
    this.loading = { ...loading };
    this.materials = { ...materials };
    this.code = materials.code;

    // Calculate effective length if not provided
    if (!this.geometry.Leff) {
      const kX = this.getEffectiveLengthFactor(geometry.endConditionX, geometry.bracingCondition);
      const kY = this.getEffectiveLengthFactor(geometry.endConditionY, geometry.bracingCondition);
      this.geometry.Leff = Math.max(kX, kY) * geometry.L;
    }
  }

  // ===========================================================================
  // MAIN DESIGN METHOD
  // ===========================================================================

  public design(): ColumnDesignResult {
    const messages: string[] = [];
    const calculations: Record<string, number> = {};

    // Step 1: Check slenderness
    const slenderness = this.checkSlenderness();
    
    // Step 2: Calculate minimum reinforcement
    const minSteel = this.calculateMinimumSteel();
    
    // Step 3: Design for loading
    let result: ColumnDesignResult;
    
    switch (this.code) {
      case 'IS456':
        result = this.designColumn_IS456(slenderness);
        break;
      case 'ACI318':
        result = this.designColumn_ACI318(slenderness);
        break;
      case 'EN1992':
        result = this.designColumn_EN1992(slenderness);
        break;
      default:
        result = this.designColumn_IS456(slenderness);
    }

    const isDraftIS456 = this.code === 'IS456' && this.codeVersion === 'IS456_2025_DRAFT';
    if (!isDraftIS456) {
      return result;
    }

    const validDraftGrades = getIS456ConcreteGrades('IS456_2025_DRAFT').map((grade) => grade.fck);
    const fck = this.materials.concreteGrade.fck;
    if (!validDraftGrades.includes(fck)) {
      result.messages.push(
        `IS 456:2025 Draft concrete grade table does not include M${fck}; verify input grade selection.`,
      );
    }

    return {
      ...result,
      draftWarning: DRAFT_WARNING_IS456_2025,
      performanceCriteria: this.evaluateIS456_2025Performance(result),
    };
  }

  private get codeVersion(): IS456Version {
    return this.materials.codeVersion ?? 'IS456_2000';
  }

  /** Builds IS 456:2025 Draft six-performance-criteria evaluation from column check results. */
  private evaluateIS456_2025Performance(result: ColumnDesignResult): IS456_2025_PerformanceCriteria {
    // Strength / Integrity based on interaction utilization at ULS
    const strength = result.status !== 'unsafe' && result.interactionRatio <= 1.0;
    const integrity = result.interactionRatio <= 1.0;

    // Serviceability proxy for this engine: not slender with large magnification demand
    const serviceability =
      !result.slenderness.isSlender ||
      ((result.slenderness.momentMagnifier_X ?? 1) <= 1.4 && (result.slenderness.momentMagnifier_Y ?? 1) <= 1.4);

    // Durability proxy: column cover and cement type provided
    const durability = this.geometry.cover >= 40 && this.materials.cementType !== undefined;

    // Robustness: reinforcement ratio in practical ductile range
    const robustness = result.reinforcement.steelRatio >= 0.8 && result.reinforcement.steelRatio <= 6.0;

    // Restorability: no severe overstress and no unsafe status
    const restorability = result.utilizationRatio <= 1.0 && result.status !== 'unsafe';

    return { strength, serviceability, durability, robustness, integrity, restorability };
  }

  // ===========================================================================
  // SLENDERNESS CHECK
  // ===========================================================================

  private checkSlenderness(): SlendernessResult {
    const { b, D, L, endConditionX, endConditionY, bracingCondition } = this.geometry;
    const messages: string[] = [];

    // Effective length factors
    const k_X = this.getEffectiveLengthFactor(endConditionX, bracingCondition);
    const k_Y = this.getEffectiveLengthFactor(endConditionY, bracingCondition);

    // Radius of gyration
    const i_X = D / Math.sqrt(12); // For rectangular section about X
    const i_Y = b / Math.sqrt(12); // For rectangular section about Y

    // Effective lengths
    const Leff_X = k_X * L;
    const Leff_Y = k_Y * L;

    // Slenderness ratios
    const lambda_X = Leff_X / i_X;
    const lambda_Y = Leff_Y / i_Y;

    // Slenderness limits based on code
    let limitRatio: number;
    let isSlender: boolean;

    switch (this.code) {
      case 'IS456':
        // IS 456: Column is short if Leff/D ≤ 12 (braced) or ≤ 12 (unbraced)
        limitRatio = 12;
        isSlender = (Leff_X / D > limitRatio) || (Leff_Y / b > limitRatio);
        break;
      case 'ACI318':
        // ACI 318: kLu/r ≤ 22 for non-sway, ≤ 22 for sway
        limitRatio = bracingCondition === 'braced' ? 34 : 22;
        isSlender = (lambda_X > limitRatio) || (lambda_Y > limitRatio);
        break;
      case 'EN1992':
        // EC2: λ ≤ λlim (complex calculation)
        const fck = this.materials.concreteGrade.fck;
        const n = this.loading.Pu * 1000 / (b * D * fck);
        const A = 0.7; // Default
        const B = 1.1; // Default  
        const C = 0.7; // Default for braced
        limitRatio = 20 * A * B * C / Math.sqrt(n);
        limitRatio = Math.max(limitRatio, 15);
        isSlender = (lambda_X > limitRatio) || (lambda_Y > limitRatio);
        break;
      default:
        limitRatio = 12;
        isSlender = (Leff_X / D > limitRatio) || (Leff_Y / b > limitRatio);
    }

    if (isSlender) {
      messages.push('Column is SLENDER - moment magnification required');
    } else {
      messages.push('Column is SHORT - no moment magnification needed');
    }

    // Calculate moment magnifiers if slender
    let momentMagnifier_X: number | undefined;
    let momentMagnifier_Y: number | undefined;
    let magnifiedMoment_X: number | undefined;
    let magnifiedMoment_Y: number | undefined;

    if (isSlender) {
      const magnifiers = this.calculateMomentMagnifiers(Leff_X, Leff_Y);
      momentMagnifier_X = magnifiers.delta_X;
      momentMagnifier_Y = magnifiers.delta_Y;
      magnifiedMoment_X = this.loading.Mux * momentMagnifier_X;
      magnifiedMoment_Y = this.loading.Muy * momentMagnifier_Y;
    }

    return {
      isSlender,
      slendernessRatio_X: lambda_X,
      slendernessRatio_Y: lambda_Y,
      limitRatio,
      effectiveLength_X: Leff_X,
      effectiveLength_Y: Leff_Y,
      k_X,
      k_Y,
      momentMagnifier_X,
      momentMagnifier_Y,
      magnifiedMoment_X,
      magnifiedMoment_Y,
      messages,
    };
  }

  private getEffectiveLengthFactor(endCondition: EndCondition, bracing: BracingCondition): number {
    // Effective length factors from various codes
    if (bracing === 'braced' || bracing === 'non-sway') {
      switch (endCondition) {
        case 'fixed-fixed': return 0.65;
        case 'fixed-pinned': return 0.80;
        case 'pinned-pinned': return 1.00;
        case 'fixed-free': return 2.00;
        default: return 1.00;
      }
    } else {
      // Unbraced / sway frame
      switch (endCondition) {
        case 'fixed-fixed': return 1.20;
        case 'fixed-pinned': return 2.00;
        case 'pinned-pinned': return 1.00; // Unstable unless additional restraint
        case 'fixed-free': return 2.00;
        default: return 1.00;
      }
    }
  }

  private calculateMomentMagnifiers(Leff_X: number, Leff_Y: number): { delta_X: number; delta_Y: number } {
    const { b, D } = this.geometry;
    const { Pu, Mux, Muy, Mux_top, Mux_bottom, Muy_top, Muy_bottom } = this.loading;
    const { concreteGrade, steelGrade } = this.materials;

    const Ec = concreteGrade.Ecm;
    const fck = concreteGrade.fck;
    
    // Gross moment of inertia
    const Ig_X = b * Math.pow(D, 3) / 12;
    const Ig_Y = D * Math.pow(b, 3) / 12;

    // Effective stiffness (IS 456 / ACI approach)
    const EI_X = 0.4 * Ec * Ig_X;
    const EI_Y = 0.4 * Ec * Ig_Y;

    // Euler buckling load
    const Pc_X = Math.PI * Math.PI * EI_X / (Leff_X * Leff_X) / 1000; // kN
    const Pc_Y = Math.PI * Math.PI * EI_Y / (Leff_Y * Leff_Y) / 1000; // kN

    // Cm factor (end moment ratio)
    const Cm_X = Mux_top && Mux_bottom 
      ? 0.6 + 0.4 * Math.min(Mux_top, Mux_bottom) / Math.max(Mux_top, Mux_bottom)
      : 1.0;
    const Cm_Y = Muy_top && Muy_bottom
      ? 0.6 + 0.4 * Math.min(Muy_top, Muy_bottom) / Math.max(Muy_top, Muy_bottom)
      : 1.0;

    // Moment magnification factors
    const delta_X = Math.max(1.0, Cm_X / (1 - Pu / Pc_X));
    const delta_Y = Math.max(1.0, Cm_Y / (1 - Pu / Pc_Y));

    return { delta_X, delta_Y };
  }

  // ===========================================================================
  // IS 456 COLUMN DESIGN
  // ===========================================================================

  private designColumn_IS456(slenderness: SlendernessResult): ColumnDesignResult {
    const { b, D } = this.geometry;
    const { Pu, Mux, Muy, loadCase } = this.loading;
    const { concreteGrade, steelGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const fy = steelGrade.fy;
    const Ag = b * D;
    
    const messages: string[] = [];
    const calculations: Record<string, number> = {};

    // Design moments (with magnification if slender)
    const Mux_design = slenderness.magnifiedMoment_X || Mux;
    const Muy_design = slenderness.magnifiedMoment_Y || Muy;

    // Minimum eccentricity (IS 456 Clause 25.4)
    const emin_X = Math.max(this.geometry.L / 500 + D / 30, 20); // mm
    const emin_Y = Math.max(this.geometry.L / 500 + b / 30, 20); // mm
    
    const Mux_min = Pu * emin_X / 1000; // kN-m
    const Muy_min = Pu * emin_Y / 1000; // kN-m
    
    const Mux_final = Math.max(Mux_design, Mux_min);
    const Muy_final = Math.max(Muy_design, Muy_min);

    calculations['emin_X'] = emin_X;
    calculations['emin_Y'] = emin_Y;
    calculations['Mux_final'] = Mux_final;
    calculations['Muy_final'] = Muy_final;

    // Design approach based on load case
    let Ast_required: number;
    let axialCapacity: number;
    let momentCapacity_X: number;
    let momentCapacity_Y: number;
    let interactionRatio: number;

    if (loadCase === 'concentric') {
      // Pure axial compression (IS 456 Clause 39.3)
      // Pu = 0.4 * fck * Ac + 0.67 * fy * Asc
      // Start with minimum steel (0.8%)
      Ast_required = 0.008 * Ag;
      const Ac = Ag - Ast_required;
      axialCapacity = (0.4 * fck * Ac + 0.67 * fy * Ast_required) / 1000;
      
      if (Pu > axialCapacity) {
        // Need more steel
        // Pu*1000 = 0.4*fck*(Ag-Asc) + 0.67*fy*Asc
        // Pu*1000 = 0.4*fck*Ag + Asc*(0.67*fy - 0.4*fck)
        Ast_required = (Pu * 1000 - 0.4 * fck * Ag) / (0.67 * fy - 0.4 * fck);
      }
      
      axialCapacity = (0.4 * fck * (Ag - Ast_required) + 0.67 * fy * Ast_required) / 1000;
      momentCapacity_X = 0;
      momentCapacity_Y = 0;
      interactionRatio = Pu / axialCapacity;
      
    } else if (loadCase === 'uniaxial') {
      // Uniaxial bending - use SP 16 charts or direct calculation
      const result = this.designUniaxialColumn_IS456(b, D, Pu, Mux_final, fck, fy);
      Ast_required = result.Ast;
      axialCapacity = result.Pn;
      momentCapacity_X = result.Mn;
      momentCapacity_Y = 0;
      interactionRatio = result.interactionRatio;
      messages.push(...result.messages);
      
    } else {
      // Biaxial bending - use Bresler's method
      const result = this.designBiaxialColumn_IS456(b, D, Pu, Mux_final, Muy_final, fck, fy);
      Ast_required = result.Ast;
      axialCapacity = result.Pn;
      momentCapacity_X = result.Mnx;
      momentCapacity_Y = result.Mny;
      interactionRatio = result.interactionRatio;
      messages.push(...result.messages);
    }

    // Check steel limits
    const Ast_min = 0.008 * Ag;
    const Ast_max = 0.06 * Ag;
    
    if (Ast_required < Ast_min) {
      Ast_required = Ast_min;
      messages.push('Minimum steel ratio (0.8%) governs');
    }
    
    if (Ast_required > Ast_max) {
      messages.push('WARNING: Required steel exceeds 6% limit');
    }

    calculations['Ast_required'] = Ast_required;
    calculations['Ast_min'] = Ast_min;
    calculations['Ast_max'] = Ast_max;
    calculations['steelRatio'] = (Ast_required / Ag) * 100;

    // Select reinforcement
    const reinforcement = this.selectReinforcement(Ast_required, b, D);

    // Design ties/links
    const ties = this.designTies_IS456(reinforcement.barDiameter, b, D);

    // Generate interaction diagram
    const interactionDiagram = this.generateInteractionDiagram_IS456(
      b, D, reinforcement.totalArea, fck, fy, reinforcement.barPositions
    );

    return {
      status: interactionRatio <= 1.0 ? 'safe' : 'unsafe',
      geometry: this.geometry,
      materials: this.materials,
      loading: this.loading,
      slenderness,
      reinforcement,
      axialCapacity,
      momentCapacity_X,
      momentCapacity_Y,
      interactionRatio,
      utilizationRatio: interactionRatio,
      interactionDiagram,
      ties,
      messages,
      calculations,
    };
  }

  private designUniaxialColumn_IS456(
    b: number,
    D: number,
    Pu: number,
    Mu: number,
    fck: number,
    fy: number
  ): { Ast: number; Pn: number; Mn: number; interactionRatio: number; messages: string[] } {
    const messages: string[] = [];
    
    // Effective depth
    const d = D - this.geometry.cover - 12; // Assuming 12mm bar to center
    const d_prime = this.geometry.cover + 12;
    
    // Trial steel ratio (start with 1.5%)
    let p = 0.015;
    let iterCount = 0;
    const maxIter = 20;
    
    while (iterCount < maxIter) {
      const Ast = p * b * D;
      const Asc = Ast / 2; // Assumed equal on each face
      
      // Calculate capacity using IS 456 formula
      const { Pn, Mn } = this.calculateCapacity_IS456(b, D, d, d_prime, Ast, fck, fy, Pu);
      
      if (Mn >= Mu && Pn >= Pu) {
        return {
          Ast,
          Pn,
          Mn,
          interactionRatio: Math.sqrt(Math.pow(Pu / Pn, 2) + Math.pow(Mu / Mn, 2)),
          messages,
        };
      }
      
      p += 0.005;
      iterCount++;
    }
    
    // If iteration fails, return maximum steel
    const Ast = 0.04 * b * D;
    const { Pn, Mn } = this.calculateCapacity_IS456(b, D, d, d_prime, Ast, fck, fy, Pu);
    
    messages.push('WARNING: Maximum steel ratio reached');
    
    return {
      Ast,
      Pn,
      Mn,
      interactionRatio: Math.sqrt(Math.pow(Pu / Pn, 2) + Math.pow(Mu / Mn, 2)),
      messages,
    };
  }

  private designBiaxialColumn_IS456(
    b: number,
    D: number,
    Pu: number,
    Mux: number,
    Muy: number,
    fck: number,
    fy: number
  ): { Ast: number; Pn: number; Mnx: number; Mny: number; interactionRatio: number; messages: string[] } {
    const messages: string[] = [];
    
    // Using Bresler's reciprocal method
    // 1/Pn = 1/Pnx + 1/Pny - 1/Po
    
    const d = D - this.geometry.cover - 12;
    const d_prime = this.geometry.cover + 12;
    
    // Trial steel ratio
    let p = 0.02;
    let iterCount = 0;
    const maxIter = 20;
    
    while (iterCount < maxIter) {
      const Ast = p * b * D;
      
      // Pure axial capacity
      const Ac = b * D - Ast;
      const Po = (0.45 * fck * Ac + 0.75 * fy * Ast) / 1000;
      
      // Uniaxial capacities
      const resultX = this.calculateCapacity_IS456(b, D, d, d_prime, Ast, fck, fy, Pu);
      const resultY = this.calculateCapacity_IS456(D, b, b - this.geometry.cover - 12, this.geometry.cover + 12, Ast, fck, fy, Pu);
      
      const Pnx = resultX.Pn;
      const Pny = resultY.Pn;
      const Mnx = resultX.Mn;
      const Mny = resultY.Mn;
      
      // Check biaxial interaction (IS 456 Clause 39.6)
      const Mux1 = Mnx; // Moment capacity about X when Pu acts with Muy = 0
      const Muy1 = Mny; // Moment capacity about Y when Pu acts with Mux = 0
      
      // Puz = 0.45*fck*Ac + 0.75*fy*Asc (pure axial)
      const Puz = Po;
      
      // αn depends on Pu/Puz
      const ratio = Pu / Puz;
      let alphan: number;
      if (ratio <= 0.2) alphan = 1.0;
      else if (ratio >= 0.8) alphan = 2.0;
      else alphan = 1.0 + (ratio - 0.2) * (2.0 - 1.0) / (0.8 - 0.2);
      
      // Interaction check
      const interactionRatio = Math.pow(Mux / Mux1, alphan) + Math.pow(Muy / Muy1, alphan);
      
      if (interactionRatio <= 1.0) {
        return {
          Ast,
          Pn: Po,
          Mnx,
          Mny,
          interactionRatio,
          messages,
        };
      }
      
      p += 0.005;
      iterCount++;
    }
    
    // Maximum steel
    const Ast = 0.04 * b * D;
    const Ac = b * D - Ast;
    const Po = (0.45 * fck * Ac + 0.75 * fy * Ast) / 1000;
    
    messages.push('WARNING: Maximum steel reached, section may be inadequate');
    
    return {
      Ast,
      Pn: Po,
      Mnx: 0,
      Mny: 0,
      interactionRatio: 1.5,
      messages,
    };
  }

  private calculateCapacity_IS456(
    b: number,
    D: number,
    d: number,
    d_prime: number,
    Ast: number,
    fck: number,
    fy: number,
    Pu: number
  ): { Pn: number; Mn: number } {
    // Stress block parameters
    const fcd = 0.446 * fck;
    const fyd = 0.87 * fy;
    
    // Assuming equal steel on both faces
    const As = Ast / 2;
    const As_prime = Ast / 2;
    
    // Find neutral axis for given Pu using trial
    let xu = D / 2;
    const tolerance = 0.001;
    let error = 1;
    
    for (let i = 0; i < 50 && error > tolerance; i++) {
      // Concrete force
      const Cc = 0.36 * fck * b * xu;
      
      // Compression steel strain and stress
      const epsilon_sc = 0.0035 * (xu - d_prime) / xu;
      const fsc = Math.min(fyd, 200000 * Math.abs(epsilon_sc));
      const Cs = As_prime * (fsc - fcd); // Subtract concrete contribution
      
      // Tension steel strain and stress
      const epsilon_st = 0.0035 * (d - xu) / xu;
      let fst: number;
      if (epsilon_st >= 0) {
        fst = Math.min(fyd, 200000 * epsilon_st);
      } else {
        fst = -Math.min(fyd, 200000 * Math.abs(epsilon_st));
      }
      const Ts = As * fst;
      
      // Total axial force
      const Pn_calc = (Cc + Cs - Ts) / 1000;
      
      error = Math.abs(Pn_calc - Pu) / Pu;
      
      // Adjust neutral axis
      if (Pn_calc > Pu) {
        xu -= D / 100;
      } else {
        xu += D / 100;
      }
      xu = Math.max(0.1 * D, Math.min(D, xu));
    }
    
    // Calculate moment capacity
    const Cc = 0.36 * fck * b * xu;
    const epsilon_sc = 0.0035 * (xu - d_prime) / xu;
    const fsc = Math.min(fyd, 200000 * Math.abs(epsilon_sc));
    const Cs = As_prime * (fsc - fcd);
    
    const epsilon_st = 0.0035 * (d - xu) / xu;
    const fst = epsilon_st >= 0 
      ? Math.min(fyd, 200000 * epsilon_st)
      : -Math.min(fyd, 200000 * Math.abs(epsilon_st));
    const Ts = As * fst;
    
    const Pn = (Cc + Cs - Ts) / 1000;
    const Mn = (Cc * (D/2 - 0.42*xu) + Cs * (D/2 - d_prime) + Ts * (d - D/2)) / 1e6;
    
    return { Pn: Math.abs(Pn), Mn: Math.abs(Mn) };
  }

  // ===========================================================================
  // ACI 318 COLUMN DESIGN
  // ===========================================================================

  private designColumn_ACI318(slenderness: SlendernessResult): ColumnDesignResult {
    const { b, D } = this.geometry;
    const { Pu, Mux, Muy, loadCase } = this.loading;
    const { concreteGrade, steelGrade } = this.materials;
    
    const fc = concreteGrade.fck;
    const fy = steelGrade.fy;
    const Ag = b * D;
    
    const messages: string[] = [];
    const calculations: Record<string, number> = {};

    // Strength reduction factor
    const phi = ACI_PHI_FACTORS.compression_tied;

    // Magnified moments
    const Mux_design = slenderness.magnifiedMoment_X || Mux;
    const Muy_design = slenderness.magnifiedMoment_Y || Muy;

    // Minimum eccentricity (ACI doesn't have explicit minimum, but uses 0.1h)
    const emin = 0.1 * D;
    const Mux_min = Pu * emin / 1000;
    const Muy_min = Pu * 0.1 * b / 1000;
    
    const Mux_final = Math.max(Mux_design, Mux_min);
    const Muy_final = Math.max(Muy_design, Muy_min);

    // Maximum axial capacity (ACI 318-19 Section 22.4.2)
    // φPn,max = 0.80 * φ * (0.85*fc'*(Ag-Ast) + fy*Ast)
    
    // Start with 1% steel
    let Ast = 0.01 * Ag;
    let Pn_max = 0.80 * (0.85 * fc * (Ag - Ast) + fy * Ast) / 1000;
    let phiPn_max = phi * Pn_max;

    // Iterative design for required steel
    let iterCount = 0;
    while (iterCount < 20 && Pu > phiPn_max) {
      Ast += 0.005 * Ag;
      Pn_max = 0.80 * (0.85 * fc * (Ag - Ast) + fy * Ast) / 1000;
      phiPn_max = phi * Pn_max;
      iterCount++;
    }

    // Check moment capacity using interaction
    const d = D - this.geometry.cover - 16;
    const d_prime = this.geometry.cover + 16;
    
    const interactionResult = this.checkInteraction_ACI318(
      b, D, d, d_prime, Ast, fc, fy, Pu, Mux_final, Muy_final, phi
    );

    // Adjust steel if needed
    while (interactionResult.ratio > 1.0 && Ast < 0.06 * Ag) {
      Ast += 0.005 * Ag;
      const newResult = this.checkInteraction_ACI318(
        b, D, d, d_prime, Ast, fc, fy, Pu, Mux_final, Muy_final, phi
      );
      if (newResult.ratio <= 1.0) break;
    }

    // Limits
    const Ast_min = 0.01 * Ag;
    const Ast_max = 0.08 * Ag;
    
    if (Ast < Ast_min) {
      Ast = Ast_min;
      messages.push('Minimum steel (1%) governs');
    }
    
    if (Ast > Ast_max) {
      messages.push('WARNING: Steel exceeds 8% maximum');
    }

    calculations['Ast'] = Ast;
    calculations['phi'] = phi;
    calculations['Pn_max'] = Pn_max;

    const reinforcement = this.selectReinforcement(Ast, b, D);
    const ties = this.designTies_ACI318(reinforcement.barDiameter, b, D);
    
    const interactionDiagram = this.generateInteractionDiagram_ACI318(
      b, D, Ast, fc, fy, reinforcement.barPositions
    );

    const finalInteraction = this.checkInteraction_ACI318(
      b, D, d, d_prime, Ast, fc, fy, Pu, Mux_final, Muy_final, phi
    );

    return {
      status: finalInteraction.ratio <= 1.0 ? 'safe' : 'unsafe',
      geometry: this.geometry,
      materials: this.materials,
      loading: this.loading,
      slenderness,
      reinforcement,
      axialCapacity: phiPn_max,
      momentCapacity_X: finalInteraction.phiMnx,
      momentCapacity_Y: finalInteraction.phiMny,
      interactionRatio: finalInteraction.ratio,
      utilizationRatio: finalInteraction.ratio,
      interactionDiagram,
      ties,
      messages,
      calculations,
    };
  }

  private checkInteraction_ACI318(
    b: number, D: number, d: number, d_prime: number,
    Ast: number, fc: number, fy: number,
    Pu: number, Mux: number, Muy: number, phi: number
  ): { ratio: number; phiMnx: number; phiMny: number } {
    // Simplified biaxial check using contour method
    const As = Ast / 2;
    
    // Uniaxial moment capacities at given Pu
    const beta1 = STRESS_BLOCK.ACI318.getBeta1(fc);
    
    // About X-axis
    const c_x = this.findNeutralAxis_ACI318(b, D, d, d_prime, As, fc, fy, Pu, beta1);
    const a_x = beta1 * c_x;
    const Mnx = this.calculateMoment_ACI318(b, D, d, d_prime, As, fc, fy, c_x, a_x);
    const phiMnx = phi * Mnx;
    
    // About Y-axis (swap dimensions)
    const c_y = this.findNeutralAxis_ACI318(D, b, b - this.geometry.cover - 16, this.geometry.cover + 16, As, fc, fy, Pu, beta1);
    const a_y = beta1 * c_y;
    const Mny = this.calculateMoment_ACI318(D, b, b - this.geometry.cover - 16, this.geometry.cover + 16, As, fc, fy, c_y, a_y);
    const phiMny = phi * Mny;
    
    // Interaction ratio (ACI 318 uses linear approximation for biaxial)
    const ratio = loadCase === 'biaxial' 
      ? Mux / phiMnx + Muy / phiMny
      : Math.max(Mux / phiMnx, Muy / phiMny);
    
    return { ratio: Math.min(ratio, 2.0), phiMnx, phiMny };
  }

  private findNeutralAxis_ACI318(
    b: number, D: number, d: number, d_prime: number,
    As: number, fc: number, fy: number, Pu: number, beta1: number
  ): number {
    const epsilon_c = 0.003;
    let c = D / 2;
    
    for (let i = 0; i < 50; i++) {
      const a = beta1 * c;
      
      // Concrete compression
      const Cc = 0.85 * fc * b * a;
      
      // Compression steel
      const epsilon_s_prime = epsilon_c * (c - d_prime) / c;
      const fs_prime = Math.min(fy, 200000 * Math.abs(epsilon_s_prime));
      const Cs = As * fs_prime;
      
      // Tension steel
      const epsilon_s = epsilon_c * (d - c) / c;
      const fs = epsilon_s > 0 
        ? Math.min(fy, 200000 * epsilon_s)
        : -Math.min(fy, 200000 * Math.abs(epsilon_s));
      const Ts = As * fs;
      
      const Pn = (Cc + Cs - Ts) / 1000;
      
      if (Math.abs(Pn - Pu) < 1) break;
      
      if (Pn > Pu) c -= D / 100;
      else c += D / 100;
      
      c = Math.max(0.05 * D, Math.min(0.95 * D, c));
    }
    
    return c;
  }

  private calculateMoment_ACI318(
    b: number, D: number, d: number, d_prime: number,
    As: number, fc: number, fy: number, c: number, a: number
  ): number {
    const epsilon_c = 0.003;
    
    const Cc = 0.85 * fc * b * a;
    const epsilon_s_prime = epsilon_c * (c - d_prime) / c;
    const fs_prime = Math.min(fy, 200000 * Math.abs(epsilon_s_prime));
    const Cs = As * fs_prime;
    
    const epsilon_s = epsilon_c * (d - c) / c;
    const fs = epsilon_s > 0 ? Math.min(fy, 200000 * epsilon_s) : -Math.min(fy, 200000 * Math.abs(epsilon_s));
    const Ts = As * fs;
    
    // Moment about centroid
    const Mn = (Cc * (D/2 - a/2) + Cs * (D/2 - d_prime) + Ts * (d - D/2)) / 1e6;
    
    return Math.abs(Mn);
  }

  // ===========================================================================
  // EUROCODE 2 COLUMN DESIGN
  // ===========================================================================

  private designColumn_EN1992(slenderness: SlendernessResult): ColumnDesignResult {
    const { b, D } = this.geometry;
    const { Pu: NEd, Mux: MEdx, Muy: MEdy, loadCase } = this.loading;
    const { concreteGrade, steelGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const fyk = steelGrade.fy;
    const Ac = b * D;
    
    const gammac = SAFETY_FACTORS.EN1992.gammac;
    const gammas = SAFETY_FACTORS.EN1992.gammas;
    
    const fcd = 0.85 * fck / gammac;
    const fyd = fyk / gammas;
    
    const messages: string[] = [];
    const calculations: Record<string, number> = {};

    // Second order effects using simplified method (EC2 5.8.7)
    const MEd_x = slenderness.magnifiedMoment_X || MEdx;
    const MEd_y = slenderness.magnifiedMoment_Y || MEdy;

    // Minimum eccentricity
    const e0 = Math.max(20, D / 30);
    const M0Ed_x = Math.max(MEd_x, NEd * e0 / 1000);
    const M0Ed_y = Math.max(MEd_y, NEd * e0 / 1000);

    // Design using simplified method
    let As_required = 0.002 * Ac; // Start with minimum
    
    // Check capacity and iterate
    const d = D - this.geometry.cover - 16;
    const d_prime = this.geometry.cover + 16;
    
    for (let iter = 0; iter < 20; iter++) {
      const NRd = this.calculateAxialCapacity_EN1992(b, D, As_required, fcd, fyd);
      const MRdx = this.calculateMomentCapacity_EN1992(b, D, d, d_prime, As_required, fcd, fyd, NEd);
      const MRdy = this.calculateMomentCapacity_EN1992(D, b, b - this.geometry.cover - 16, this.geometry.cover + 16, As_required, fcd, fyd, NEd);
      
      // Biaxial check (EC2 5.8.9)
      const a_factor = this.getBiaxialExponent_EN1992(NEd, NRd);
      const interaction = Math.pow(M0Ed_x / MRdx, a_factor) + Math.pow(M0Ed_y / MRdy, a_factor);
      
      if (interaction <= 1.0 && NEd <= NRd) break;
      
      As_required += 0.002 * Ac;
    }

    // Check limits
    const As_min = Math.max(0.002 * Ac, 0.1 * NEd * 1000 / fyd);
    const As_max = 0.04 * Ac; // Can be 0.08 at laps
    
    if (As_required < As_min) {
      As_required = As_min;
      messages.push('Minimum steel governs (EC2 9.5.2)');
    }
    
    if (As_required > As_max) {
      messages.push('WARNING: Steel exceeds 4% limit');
    }

    const reinforcement = this.selectReinforcement(As_required, b, D);
    const ties = this.designTies_EN1992(reinforcement.barDiameter, b, D);
    
    const NRd = this.calculateAxialCapacity_EN1992(b, D, As_required, fcd, fyd);
    const MRdx = this.calculateMomentCapacity_EN1992(b, D, d, d_prime, As_required, fcd, fyd, NEd);
    const MRdy = this.calculateMomentCapacity_EN1992(D, b, b - this.geometry.cover - 16, this.geometry.cover + 16, As_required, fcd, fyd, NEd);
    
    const a_factor = this.getBiaxialExponent_EN1992(NEd, NRd);
    const interactionRatio = Math.pow(M0Ed_x / MRdx, a_factor) + Math.pow(M0Ed_y / MRdy, a_factor);

    const interactionDiagram = this.generateInteractionDiagram_EN1992(
      b, D, As_required, fck, fyk, reinforcement.barPositions
    );

    return {
      status: interactionRatio <= 1.0 ? 'safe' : 'unsafe',
      geometry: this.geometry,
      materials: this.materials,
      loading: this.loading,
      slenderness,
      reinforcement,
      axialCapacity: NRd,
      momentCapacity_X: MRdx,
      momentCapacity_Y: MRdy,
      interactionRatio,
      utilizationRatio: interactionRatio,
      interactionDiagram,
      ties,
      messages,
      calculations,
    };
  }

  private calculateAxialCapacity_EN1992(b: number, D: number, As: number, fcd: number, fyd: number): number {
    const Ac = b * D - As;
    return (fcd * Ac + fyd * As) / 1000;
  }

  private calculateMomentCapacity_EN1992(
    b: number, D: number, d: number, d_prime: number,
    As: number, fcd: number, fyd: number, NEd: number
  ): number {
    // Simplified calculation
    const As_half = As / 2;
    const z = 0.9 * (d - d_prime);
    const MRd = fyd * As_half * z / 1e6 + NEd * (D/2 - d_prime) / 1000;
    return Math.abs(MRd);
  }

  private getBiaxialExponent_EN1992(NEd: number, NRd: number): number {
    const ratio = NEd / NRd;
    if (ratio <= 0.1) return 1.0;
    if (ratio >= 0.7) return 2.0;
    return 1.0 + (ratio - 0.1) * (2.0 - 1.0) / (0.7 - 0.1);
  }

  // ===========================================================================
  // REINFORCEMENT SELECTION
  // ===========================================================================

  private calculateMinimumSteel(): number {
    const { b, D } = this.geometry;
    const Ag = b * D;
    
    switch (this.code) {
      case 'IS456': return 0.008 * Ag;
      case 'ACI318': return 0.01 * Ag;
      case 'EN1992': return 0.002 * Ag;
      default: return 0.008 * Ag;
    }
  }

  private selectReinforcement(Ast: number, b: number, D: number): ReinforcementLayout {
    const options = selectBars(Ast / 4, 4); // Quarter on each corner for rectangular
    const selected = options[0] || { diameter: 16, count: 4, area: 804 };
    
    // Total bars (minimum 4 for corners, more on faces if needed)
    const totalBars = Math.max(8, Math.ceil(Ast / selected.area) * 4 / selected.count);
    const actualArea = (selected.area / selected.count) * totalBars;
    
    // Generate bar positions
    const cover = this.geometry.cover + 8 + selected.diameter / 2; // Tie cover + half bar
    const barPositions: { x: number; y: number }[] = [];
    
    // Corner bars
    barPositions.push({ x: cover, y: cover });
    barPositions.push({ x: b - cover, y: cover });
    barPositions.push({ x: cover, y: D - cover });
    barPositions.push({ x: b - cover, y: D - cover });
    
    // Side bars if needed
    const sideBars = Math.max(0, Math.floor((totalBars - 4) / 4));
    if (sideBars > 0) {
      const spacingX = (b - 2 * cover) / (sideBars + 1);
      const spacingY = (D - 2 * cover) / (sideBars + 1);
      
      for (let i = 1; i <= sideBars; i++) {
        barPositions.push({ x: cover + i * spacingX, y: cover }); // Bottom
        barPositions.push({ x: cover + i * spacingX, y: D - cover }); // Top
        barPositions.push({ x: cover, y: cover + i * spacingY }); // Left
        barPositions.push({ x: b - cover, y: cover + i * spacingY }); // Right
      }
    }

    return {
      arrangement: sideBars > 0 ? 'equal-spacing' : 'concentrated-corners',
      barDiameter: selected.diameter,
      numberOfBars: barPositions.length,
      totalArea: actualArea,
      steelRatio: (actualArea / (b * D)) * 100,
      barPositions,
    };
  }

  // ===========================================================================
  // TIE DESIGN
  // ===========================================================================

  private designTies_IS456(mainBarDia: number, b: number, D: number): { diameter: number; spacing: number; pitch: number } {
    // IS 456 Clause 26.5.3.2
    const tieDia = Math.max(6, mainBarDia / 4);
    const pitch = Math.min(300, 16 * mainBarDia, Math.min(b, D));
    
    return {
      diameter: Math.ceil(tieDia / 2) * 2, // Round to even
      spacing: pitch,
      pitch,
    };
  }

  private designTies_ACI318(mainBarDia: number, b: number, D: number): { diameter: number; spacing: number; pitch: number } {
    // ACI 318 Section 25.7.2
    const tieDia = mainBarDia <= 32 ? 10 : 12; // #3 for up to #10, #4 for larger
    const spacing = Math.min(
      16 * mainBarDia,
      48 * tieDia,
      Math.min(b, D)
    );
    
    return {
      diameter: tieDia,
      spacing,
      pitch: spacing,
    };
  }

  private designTies_EN1992(mainBarDia: number, b: number, D: number): { diameter: number; spacing: number; pitch: number } {
    // EC2 9.5.3
    const tieDia = Math.max(6, mainBarDia / 4);
    const spacing = Math.min(
      20 * mainBarDia,
      Math.min(b, D),
      400
    );
    
    return {
      diameter: Math.ceil(tieDia),
      spacing,
      pitch: spacing,
    };
  }

  // ===========================================================================
  // INTERACTION DIAGRAMS
  // ===========================================================================

  private generateInteractionDiagram_IS456(
    b: number, D: number, Ast: number, fck: number, fy: number,
    barPositions: { x: number; y: number }[]
  ): InteractionPoint[] {
    const points: InteractionPoint[] = [];
    const d = D - this.geometry.cover - 12;
    const d_prime = this.geometry.cover + 12;
    const As = Ast / 2;
    
    // Pure compression
    const Ac = b * D - Ast;
    const Po = (0.45 * fck * Ac + 0.75 * fy * Ast) / 1000;
    points.push({ Pn: Po, Mn: 0 });
    
    // Various neutral axis depths
    const xuValues = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0];
    
    for (const xuRatio of xuValues) {
      const xu = xuRatio * D;
      const { Pn, Mn } = this.calculateCapacity_IS456(b, D, d, d_prime, Ast, fck, fy, 0);
      if (Pn > 0 && Mn > 0) {
        points.push({ Pn, Mn, neutralAxis: xu });
      }
    }
    
    // Pure bending (Pn ≈ 0)
    const { Mn: Mn_pure } = this.calculateCapacity_IS456(b, D, d, d_prime, Ast, fck, fy, 0);
    points.push({ Pn: 0, Mn: Mn_pure });
    
    // Pure tension
    const Pt = -0.87 * fy * Ast / 1000;
    points.push({ Pn: Pt, Mn: 0 });
    
    return points;
  }

  private generateInteractionDiagram_ACI318(
    b: number, D: number, Ast: number, fc: number, fy: number,
    barPositions: { x: number; y: number }[]
  ): InteractionPoint[] {
    const points: InteractionPoint[] = [];
    const d = D - this.geometry.cover - 16;
    const d_prime = this.geometry.cover + 16;
    const As = Ast / 2;
    const beta1 = STRESS_BLOCK.ACI318.getBeta1(fc);
    const phi_compression = ACI_PHI_FACTORS.compression_tied;
    const phi_tension = ACI_PHI_FACTORS.flexure;
    
    // Pure compression
    const Po = 0.85 * fc * (b * D - Ast) / 1000 + fy * Ast / 1000;
    const phiPo = 0.80 * phi_compression * Po;
    points.push({ Pn: Po, Mn: 0, phi: phi_compression, phiPn: phiPo, phiMn: 0 });
    
    // Various neutral axis depths
    const cValues = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(r => r * D);
    
    for (const c of cValues) {
      const a = beta1 * c;
      const Mn = this.calculateMoment_ACI318(b, D, d, d_prime, As, fc, fy, c, a);
      const Pn = this.calculateAxialForce_ACI318(b, D, d, d_prime, As, fc, fy, c, a);
      
      // Determine phi based on strain
      const epsilon_t = 0.003 * (d - c) / c;
      let phi: number;
      if (epsilon_t >= 0.005) phi = phi_tension;
      else if (epsilon_t <= 0.002) phi = phi_compression;
      else phi = phi_compression + (epsilon_t - 0.002) * (phi_tension - phi_compression) / 0.003;
      
      points.push({ Pn, Mn, phi, phiPn: phi * Pn, phiMn: phi * Mn, neutralAxis: c });
    }
    
    // Pure tension
    const Pt = -fy * Ast / 1000;
    points.push({ Pn: Pt, Mn: 0, phi: phi_tension, phiPn: phi_tension * Pt, phiMn: 0 });
    
    return points;
  }

  private calculateAxialForce_ACI318(
    b: number, D: number, d: number, d_prime: number,
    As: number, fc: number, fy: number, c: number, a: number
  ): number {
    const epsilon_c = 0.003;
    
    const Cc = 0.85 * fc * b * a;
    const epsilon_s_prime = epsilon_c * (c - d_prime) / c;
    const fs_prime = Math.min(fy, 200000 * Math.abs(epsilon_s_prime));
    const Cs = As * fs_prime;
    
    const epsilon_s = epsilon_c * (d - c) / c;
    const fs = epsilon_s > 0 ? Math.min(fy, 200000 * epsilon_s) : -Math.min(fy, 200000 * Math.abs(epsilon_s));
    const Ts = As * fs;
    
    return (Cc + Cs - Ts) / 1000;
  }

  private generateInteractionDiagram_EN1992(
    b: number, D: number, Ast: number, fck: number, fyk: number,
    barPositions: { x: number; y: number }[]
  ): InteractionPoint[] {
    // Similar structure to ACI
    const gammac = SAFETY_FACTORS.EN1992.gammac;
    const gammas = SAFETY_FACTORS.EN1992.gammas;
    const fcd = 0.85 * fck / gammac;
    const fyd = fyk / gammas;
    
    const points: InteractionPoint[] = [];
    const d = D - this.geometry.cover - 16;
    const d_prime = this.geometry.cover + 16;
    
    // Pure compression
    const NRd_max = this.calculateAxialCapacity_EN1992(b, D, Ast, fcd, fyd);
    points.push({ Pn: NRd_max, Mn: 0 });
    
    // Intermediate points
    for (let i = 0; i <= 10; i++) {
      const NEd = NRd_max * (10 - i) / 10;
      const MRd = this.calculateMomentCapacity_EN1992(b, D, d, d_prime, Ast, fcd, fyd, NEd);
      points.push({ Pn: NEd, Mn: MRd });
    }
    
    // Pure tension
    const NRd_tension = -fyd * Ast / 1000;
    points.push({ Pn: NRd_tension, Mn: 0 });
    
    return points;
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

const loadCase: 'concentric' | 'uniaxial' | 'biaxial' = 'uniaxial';

/**
 * Quick design for rectangular column
 */
export function designRectangularColumn(
  b: number,
  D: number,
  L: number,
  Pu: number,
  Mux: number,
  Muy: number,
  fck: number,
  fy: number,
  code: DesignCode = 'IS456'
): ColumnDesignResult {
  const concreteGrades = getConcreteGrades(code);
  const steelGrades = getSteelGrades(code);
  
  const concreteGrade = concreteGrades.find(g => g.fck === fck) || concreteGrades[2];
  const steelGrade = steelGrades.find(g => g.fy === fy) || steelGrades[1];

  const engine = new RCColumnDesignEngine(
    {
      type: 'rectangular',
      b,
      D,
      L,
      cover: 40,
      endConditionX: 'fixed-fixed',
      endConditionY: 'fixed-fixed',
      bracingCondition: 'braced',
    },
    {
      Pu,
      Mux,
      Muy,
      loadCase: Mux > 0 && Muy > 0 ? 'biaxial' : (Mux > 0 || Muy > 0 ? 'uniaxial' : 'concentric'),
    },
    {
      concreteGrade,
      steelGrade,
      code,
    }
  );

  return engine.design();
}

export default RCColumnDesignEngine;
