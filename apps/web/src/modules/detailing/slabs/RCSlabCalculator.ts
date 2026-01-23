/**
 * RC Slab Design Calculator
 * Comprehensive slab design per ACI 318-19
 * 
 * Features:
 * - One-way slab design
 * - Two-way slab design (Direct Design Method)
 * - Punching shear check
 * - Deflection check
 * - Reinforcement selection
 */

import {
  SlabType,
  SpanCondition,
  PunchingShearReinf,
  RCSlabInput,
  RCSlabResult,
  OneWaySlabResult,
  TwoWaySlabResult,
  PunchingShearResult,
  SlabDeflectionResult,
  CalculationStep,
  DDM_MOMENT_FACTORS,
  PUNCHING_SHEAR,
  TEMP_SHRINKAGE,
  REBAR_DATA_SLAB,
} from './SlabDesignTypes';

export class RCSlabCalculator {
  private input: RCSlabInput;
  private calculations: CalculationStep[] = [];
  private stepCounter = 1;
  
  constructor(input: RCSlabInput) {
    this.input = input;
  }
  
  /**
   * Main design method
   */
  public design(): RCSlabResult {
    this.calculations = [];
    this.stepCounter = 1;
    
    const { geometry, materials } = this.input;
    const lambda = materials.lambda || 1.0;
    
    // Determine slab direction
    const aspectRatio = geometry.Ly / geometry.Lx;
    const isOneWay = aspectRatio >= 2.0 || geometry.type === SlabType.ONE_WAY;
    
    this.addStep(
      'Determine slab type',
      'Ly/Lx = aspectRatio',
      { Ly: geometry.Ly, Lx: geometry.Lx, aspectRatio },
      `${isOneWay ? 'One-way' : 'Two-way'} slab`,
      undefined,
      'ACI 318-19 8.3.1.1'
    );
    
    // Effective depth
    const db_assumed = 0.5; // Assume #4 bars
    const d = geometry.h - geometry.cover - db_assumed / 2;
    
    this.addStep(
      'Calculate effective depth',
      'd = h - cover - db/2',
      { h: geometry.h, cover: geometry.cover, db: db_assumed },
      d,
      'in',
      'ACI 318-19 20.6.1'
    );
    
    // Design based on slab type
    let oneWayResult: OneWaySlabResult | undefined;
    let twoWayResult: { xDirection: TwoWaySlabResult; yDirection: TwoWaySlabResult } | undefined;
    
    if (isOneWay) {
      oneWayResult = this.designOneWay(d);
    } else {
      twoWayResult = this.designTwoWay(d);
    }
    
    // Punching shear for flat plates/slabs
    let punchingResult: PunchingShearResult | undefined;
    if (this.input.checkPunching && geometry.column && 
        (geometry.type === SlabType.FLAT_PLATE || geometry.type === SlabType.FLAT_SLAB)) {
      punchingResult = this.checkPunchingShear(d);
    }
    
    // Deflection check
    let deflectionResult: SlabDeflectionResult | undefined;
    if (this.input.checkDeflection) {
      deflectionResult = this.checkDeflection(d, isOneWay);
    }
    
    // Compile reinforcement schedule
    const reinforcement = this.compileReinforcement(
      isOneWay,
      oneWayResult,
      twoWayResult
    );
    
    // Determine overall adequacy
    const isAdequate = this.checkOverallAdequacy(
      oneWayResult,
      twoWayResult,
      punchingResult,
      deflectionResult
    );
    
    return {
      isAdequate,
      slabType: isOneWay ? SlabType.ONE_WAY : geometry.type,
      section: {
        h: geometry.h,
        d,
        aspectRatio,
      },
      oneWay: oneWayResult,
      twoWay: twoWayResult,
      punching: punchingResult,
      deflection: deflectionResult,
      reinforcement,
      calculations: this.calculations,
      codeReference: 'ACI 318-19 Chapter 8',
    };
  }
  
  /**
   * Design one-way slab
   */
  private designOneWay(d: number): OneWaySlabResult {
    const { geometry, materials, loads, panel } = this.input;
    
    const Ln = geometry.Lx * 12; // Clear span in inches (spanning short direction)
    const fc = materials.fc;
    const fy = materials.fy;
    const wu = loads.wu / 12; // psf to plf for 1-ft strip
    
    // ACI moment coefficients for continuous slabs
    const momentCoeffs = this.getOneWayMomentCoefficients(panel.spanCondition);
    
    // Calculate moments (per foot width)
    const Mu_pos = momentCoeffs.pos * wu * Math.pow(Ln / 12, 2) / 1000; // kip-ft/ft
    const Mu_neg = momentCoeffs.neg * wu * Math.pow(Ln / 12, 2) / 1000;
    
    this.addStep(
      'Calculate one-way moments',
      'Mu = C × wu × Ln²',
      { 
        C_pos: momentCoeffs.pos,
        C_neg: momentCoeffs.neg,
        wu: wu.toFixed(1) + ' plf',
        Ln: (Ln / 12).toFixed(2) + ' ft'
      },
      `Mu+ = ${Mu_pos.toFixed(2)}, Mu- = ${Mu_neg.toFixed(2)}`,
      'kip-ft/ft',
      'ACI 318-19 6.5'
    );
    
    // Design reinforcement
    const As_pos = this.calculateFlexuralSteel(Mu_pos, d, fc, fy, 12);
    const As_neg = this.calculateFlexuralSteel(Mu_neg, d, fc, fy, 12);
    
    // Check minimum reinforcement
    const As_min = this.getMinimumSteel(d, fc, fy, 12);
    const As_pos_final = Math.max(As_pos, As_min);
    const As_neg_final = Math.max(As_neg, As_min);
    
    this.addStep(
      'Calculate required steel',
      'As = ρ × b × d',
      { As_pos, As_neg, As_min },
      `As,pos = ${As_pos_final.toFixed(2)}, As,neg = ${As_neg_final.toFixed(2)}`,
      'in²/ft',
      'ACI 318-19 9.6.1'
    );
    
    // Select bars
    const bars_pos = this.selectBars(As_pos_final, d);
    const bars_neg = this.selectBars(As_neg_final, d);
    
    // Temperature/shrinkage steel (perpendicular)
    const rho_temp = fy >= 60000 ? TEMP_SHRINKAGE.grade_60 : TEMP_SHRINKAGE.grade_40_50;
    const As_temp = rho_temp * geometry.h * 12;
    const bars_temp = this.selectBars(As_temp, d, '#4');
    
    this.addStep(
      'Temperature/shrinkage steel',
      'As,temp = ρ × Ag',
      { rho: rho_temp, h: geometry.h },
      As_temp.toFixed(2),
      'in²/ft',
      'ACI 318-19 24.4.3'
    );
    
    return {
      direction: 'X',
      strip: 'ENTIRE',
      Mu_pos,
      Mu_neg,
      As_pos: As_pos_final,
      As_neg: As_neg_final,
      bars_pos,
      bars_neg,
      As_temp,
      bars_temp,
    };
  }
  
  /**
   * Design two-way slab using Direct Design Method
   */
  private designTwoWay(d: number): { xDirection: TwoWaySlabResult; yDirection: TwoWaySlabResult } {
    const { geometry, materials, loads, panel } = this.input;
    
    const L1 = geometry.Lx * 12; // Span in direction of analysis
    const L2 = geometry.Ly * 12; // Span perpendicular
    const fc = materials.fc;
    const fy = materials.fy;
    const wu = loads.wu / 144; // psf to psi
    
    // Verify DDM applicability
    this.verifyDDMApplicability();
    
    // Calculate total static moment for each direction
    const Mo_x = this.calculateTotalStaticMoment(wu, L2, L1);
    const Mo_y = this.calculateTotalStaticMoment(wu, L1, L2);
    
    this.addStep(
      'Calculate total static moment (x-direction)',
      'Mo = wu × L2 × Ln² / 8',
      { wu: loads.wu + ' psf', L2: (L2 / 12).toFixed(1) + ' ft', Ln: (L1 / 12).toFixed(1) + ' ft' },
      Mo_x.toFixed(2),
      'kip-ft',
      'ACI 318-19 8.10.3.2'
    );
    
    // Distribute moments
    const xDirection = this.distributeMoments(Mo_x, L1, L2, d, fc, fy, 'X');
    const yDirection = this.distributeMoments(Mo_y, L2, L1, d, fc, fy, 'Y');
    
    return { xDirection, yDirection };
  }
  
  /**
   * Calculate total static moment
   */
  private calculateTotalStaticMoment(wu: number, L2: number, L1: number): number {
    // Assume column dimension = L1/10 for clear span
    const c = L1 / 10;
    const Ln = L1 - c;
    
    // Mo = wu * L2 * Ln² / 8 (convert to kip-ft)
    return (wu * L2 * Math.pow(Ln, 2) / 8) / 12000;
  }
  
  /**
   * Distribute moments to column and middle strips
   */
  private distributeMoments(
    Mo: number,
    L1: number,
    L2: number,
    d: number,
    fc: number,
    fy: number,
    direction: 'X' | 'Y'
  ): TwoWaySlabResult {
    const { panel, geometry } = this.input;
    
    // Moment distribution factors (DDM)
    const isInterior = panel.spanCondition === SpanCondition.INTERIOR;
    const factors = isInterior 
      ? DDM_MOMENT_FACTORS.totalMoment.interior
      : DDM_MOMENT_FACTORS.totalMoment.end_discontinuous;
    
    // Panel moments
    const Mu_neg_int = factors.negative * Mo;
    const Mu_pos = factors.positive * Mo;
    const Mu_neg_ext = 'exterior_neg' in factors ? factors.exterior_neg * Mo : undefined;
    
    this.addStep(
      `Distribute moments (${direction}-direction)`,
      'Mu = factor × Mo',
      { Mo: Mo.toFixed(2), neg_factor: factors.negative, pos_factor: factors.positive },
      `Mu- = ${Mu_neg_int.toFixed(2)}, Mu+ = ${Mu_pos.toFixed(2)}`,
      'kip-ft',
      'ACI 318-19 8.10.4'
    );
    
    // Strip widths
    const columnStripWidth = Math.min(L1, L2) / 2;
    const middleStripWidth = L2 - columnStripWidth;
    
    // Column strip distribution (flat plate - no beams)
    const csNegFactor = DDM_MOMENT_FACTORS.columnStrip.negative_interior.alpha_0;
    const csPosFactor = DDM_MOMENT_FACTORS.columnStrip.positive.alpha_0;
    
    // Column strip moments (per foot)
    const cs_Mu_neg = (csNegFactor * Mu_neg_int) / (columnStripWidth / 12);
    const cs_Mu_pos = (csPosFactor * Mu_pos) / (columnStripWidth / 12);
    
    // Middle strip moments (per foot)
    const ms_Mu_neg = ((1 - csNegFactor) * Mu_neg_int) / (middleStripWidth / 12);
    const ms_Mu_pos = ((1 - csPosFactor) * Mu_pos) / (middleStripWidth / 12);
    
    // Calculate steel
    const stripWidth = 12; // Design per foot
    const cs_As_pos = this.calculateFlexuralSteel(cs_Mu_pos, d, fc, fy, stripWidth);
    const cs_As_neg = this.calculateFlexuralSteel(cs_Mu_neg, d, fc, fy, stripWidth);
    const ms_As_pos = this.calculateFlexuralSteel(ms_Mu_pos, d, fc, fy, stripWidth);
    const ms_As_neg = this.calculateFlexuralSteel(ms_Mu_neg, d, fc, fy, stripWidth);
    
    // Check minimum
    const As_min = this.getMinimumSteel(d, fc, fy, stripWidth);
    
    return {
      columnStrip: {
        width: columnStripWidth,
        Mu_pos: cs_Mu_pos,
        Mu_neg_int: cs_Mu_neg,
        Mu_neg_ext: Mu_neg_ext !== undefined 
          ? (DDM_MOMENT_FACTORS.columnStrip.negative_exterior.alpha_0 * Mu_neg_ext) / (columnStripWidth / 12)
          : undefined,
        As_pos: Math.max(cs_As_pos, As_min),
        As_neg: Math.max(cs_As_neg, As_min),
        bars_pos: this.selectBars(Math.max(cs_As_pos, As_min), d),
        bars_neg: this.selectBars(Math.max(cs_As_neg, As_min), d),
      },
      middleStrip: {
        width: middleStripWidth,
        Mu_pos: ms_Mu_pos,
        Mu_neg: ms_Mu_neg,
        As_pos: Math.max(ms_As_pos, As_min),
        As_neg: Math.max(ms_As_neg, As_min),
        bars_pos: this.selectBars(Math.max(ms_As_pos, As_min), d),
        bars_neg: this.selectBars(Math.max(ms_As_neg, As_min), d),
      },
    };
  }
  
  /**
   * Check punching shear at column
   */
  private checkPunchingShear(d: number): PunchingShearResult {
    const { geometry, materials, loads } = this.input;
    
    if (!geometry.column || !loads.Vu_col) {
      throw new Error('Column dimensions and Vu required for punching check');
    }
    
    const fc = materials.fc;
    const lambda = materials.lambda || 1.0;
    const c1 = geometry.column.c1;
    const c2 = geometry.column.c2;
    const Vu = loads.Vu_col;
    
    // Critical section at d/2 from column face
    const b1 = c1 + d;
    const b2 = c2 + d;
    const bo = 2 * (b1 + b2); // Interior column
    
    this.addStep(
      'Calculate critical perimeter',
      'bo = 2(c1 + d) + 2(c2 + d)',
      { c1, c2, d, b1, b2 },
      bo.toFixed(1),
      'in',
      'ACI 318-19 22.6.4.1'
    );
    
    // Shear stress on critical section
    const vu = (Vu * 1000) / (bo * d);
    
    // Concrete shear strength (ACI 318-19 22.6.5.2)
    const beta_c = Math.max(c1, c2) / Math.min(c1, c2);
    const alpha_s = PUNCHING_SHEAR.alpha_s.interior;
    
    const vc1 = 4 * lambda * Math.sqrt(fc);
    const vc2 = (2 + 4 / beta_c) * lambda * Math.sqrt(fc);
    const vc3 = (2 + alpha_s * d / bo) * lambda * Math.sqrt(fc);
    const vc = Math.min(vc1, vc2, vc3);
    
    this.addStep(
      'Calculate concrete shear strength',
      'vc = min(4√fc, (2+4/β)√fc, (2+αs×d/bo)√fc)',
      { vc1: vc1.toFixed(1), vc2: vc2.toFixed(1), vc3: vc3.toFixed(1) },
      vc.toFixed(1),
      'psi',
      'ACI 318-19 22.6.5.2'
    );
    
    const phi = 0.75; // Shear
    const phi_Vc = phi * vc * bo * d / 1000; // kips
    
    // Check if reinforcement needed
    let reinforcement: PunchingShearResult['reinforcement'];
    let phi_Vn = phi_Vc;
    
    if (Vu > phi_Vc) {
      // Need shear reinforcement
      const Vs_req = (Vu - phi_Vc) / phi;
      
      // Use headed studs (most effective)
      const vc_studs = PUNCHING_SHEAR.vc_with_studs * lambda * Math.sqrt(fc);
      const phi_Vc_studs = phi * vc_studs * bo * d / 1000;
      const phi_Vs = Vu - phi_Vc_studs;
      
      reinforcement = {
        type: PunchingShearReinf.HEADED_STUDS,
        phi_Vs,
        details: `Provide headed shear studs. Vs,req = ${(Vs_req).toFixed(1)} kips`,
      };
      
      phi_Vn = phi_Vc_studs + phi_Vs;
    }
    
    // Moment transfer
    const gamma_f = 1 / (1 + (2/3) * Math.sqrt(b1 / b2));
    const gamma_v = 1 - gamma_f;
    
    const ratio = Vu / phi_Vn;
    
    return {
      Vu,
      phi_Vc,
      phi_Vn,
      ratio,
      isAdequate: ratio <= 1.0,
      criticalSection: {
        type: 'INTERIOR',
        bo,
        d,
        location: d / 2,
      },
      reinforcement,
      momentTransfer: loads.Mu_unbalanced ? {
        gamma_f,
        gamma_v,
        b1,
        b2,
      } : undefined,
    };
  }
  
  /**
   * Check slab deflection
   */
  private checkDeflection(d: number, isOneWay: boolean): SlabDeflectionResult {
    const { geometry, materials, loads } = this.input;
    
    const fc = materials.fc;
    const Ec = 57000 * Math.sqrt(fc) / 1000; // ksi
    const fr = 7.5 * Math.sqrt(fc); // psi
    
    const b = 12; // per foot
    const h = geometry.h;
    const L = isOneWay ? geometry.Lx * 12 : Math.min(geometry.Lx, geometry.Ly) * 12;
    
    // Gross moment of inertia
    const Ig = b * Math.pow(h, 3) / 12;
    
    // Cracking moment
    const yt = h / 2;
    const Mcr = fr * Ig / yt / 12000; // kip-ft/ft
    
    // Service moment (approximate)
    const w_service = loads.DL_super + loads.LL + 150 * h / 12; // psf
    const Ma = w_service * Math.pow(L / 12, 2) / 8 / 1000; // kip-ft/ft
    
    // Effective moment of inertia (Branson's equation)
    let Ie: number;
    if (Ma <= Mcr) {
      Ie = Ig;
    } else {
      const ratio = Math.pow(Mcr / Ma, 3);
      // Assume As provides some cracked Icr
      const Icr = 0.35 * Ig; // Approximate for slabs
      Ie = ratio * Ig + (1 - ratio) * Icr;
      Ie = Math.min(Ie, Ig);
    }
    
    this.addStep(
      'Calculate effective moment of inertia',
      'Ie = (Mcr/Ma)³×Ig + [1-(Mcr/Ma)³]×Icr',
      { Ig: Ig.toFixed(0), Mcr: Mcr.toFixed(2), Ma: Ma.toFixed(2) },
      Ie.toFixed(1),
      'in⁴/ft',
      'ACI 318-19 24.2.3.5'
    );
    
    // Immediate deflection
    // For uniform load: 5wL⁴/(384EI)
    const delta_imm = (5 * w_service * Math.pow(L, 4)) / (384 * Ec * 1000 * Ie);
    
    // Long-term deflection (ACI multiplier)
    const xi = 2.0; // Time-dependent factor (5+ years)
    const rho_prime = 0; // Typically no compression steel in slabs
    const lambda_delta = xi / (1 + 50 * rho_prime);
    const delta_LT = lambda_delta * delta_imm * 0.5; // 50% sustained load
    
    const delta_total = delta_imm + delta_LT;
    
    // Allowable deflection (L/240 for floors)
    const limit = L / 240;
    
    this.addStep(
      'Calculate deflections',
      'δ_imm = 5wL⁴/(384EI), δ_LT = λ×δ_D',
      { delta_imm: delta_imm.toFixed(3), delta_LT: delta_LT.toFixed(3) },
      delta_total.toFixed(3),
      'in',
      'ACI 318-19 24.2'
    );
    
    return {
      Ie,
      delta_imm,
      delta_LT,
      delta_total,
      limit,
      ratio: delta_total / limit,
      isAdequate: delta_total <= limit,
    };
  }
  
  /**
   * Get one-way slab moment coefficients
   */
  private getOneWayMomentCoefficients(condition: SpanCondition): { pos: number; neg: number } {
    // ACI coefficients for continuous slabs
    switch (condition) {
      case SpanCondition.INTERIOR:
        return { pos: 1/16, neg: 1/11 };
      case SpanCondition.END:
        return { pos: 1/14, neg: 1/10 }; // Negative at interior support
      case SpanCondition.EDGE:
        return { pos: 1/11, neg: 1/11 };
      default:
        return { pos: 1/8, neg: 0 }; // Simply supported
    }
  }
  
  /**
   * Calculate flexural steel required
   */
  private calculateFlexuralSteel(
    Mu: number,
    d: number,
    fc: number,
    fy: number,
    b: number
  ): number {
    const phi = 0.9;
    const Mn_req = Mu / phi;
    
    // From Mu = phi * As * fy * (d - a/2)
    // Assume a = 0.1d initially for iteration
    let a = 0.1 * d;
    let As = (Mn_req * 12) / (fy / 1000 * (d - a / 2));
    
    // Iterate for actual a
    for (let i = 0; i < 5; i++) {
      a = (As * fy) / (0.85 * fc * b);
      As = (Mn_req * 12) / (fy / 1000 * (d - a / 2));
    }
    
    return As;
  }
  
  /**
   * Get minimum steel per ACI
   */
  private getMinimumSteel(d: number, fc: number, fy: number, b: number): number {
    const As_min1 = 0.0018 * b * (d + 1); // Based on gross area (h ≈ d + 1")
    const As_min2 = (3 * Math.sqrt(fc) / fy) * b * d;
    const As_min3 = (200 / fy) * b * d;
    
    return Math.max(As_min1, As_min2, As_min3);
  }
  
  /**
   * Select bar size and spacing
   */
  private selectBars(As: number, d: number, preferSize?: string): { size: string; spacing: number } {
    const sizes = preferSize ? [preferSize] : ['#4', '#5', '#6'];
    
    for (const size of sizes) {
      const bar = REBAR_DATA_SLAB[size];
      if (!bar) continue;
      
      // Calculate spacing for required As per foot (12")
      const spacing = (bar.Ab / As) * 12;
      
      // Check spacing limits
      const maxSpacing = Math.min(3 * (d + 1), 18); // 3h or 18" max
      const minSpacing = Math.max(bar.db, 1); // Min 1" or bar diameter
      
      if (spacing >= minSpacing && spacing <= maxSpacing) {
        // Round down to practical spacing
        const practicalSpacing = Math.floor(spacing * 2) / 2; // Round to 0.5"
        return { 
          size, 
          spacing: Math.min(practicalSpacing, maxSpacing) 
        };
      }
    }
    
    // Default to #5 @ 6"
    return { size: '#5', spacing: 6 };
  }
  
  /**
   * Verify DDM applicability (ACI 8.10.2)
   */
  private verifyDDMApplicability(): void {
    const { geometry, panel } = this.input;
    
    const checks: string[] = [];
    
    // Check 1: 3 or more continuous spans (assume satisfied)
    
    // Check 2: Aspect ratio ≤ 2
    const aspectRatio = geometry.Ly / geometry.Lx;
    if (aspectRatio > 2) {
      checks.push(`Aspect ratio ${aspectRatio.toFixed(2)} > 2`);
    }
    
    // Check 3: Successive span lengths (assume satisfied)
    
    this.addStep(
      'Verify DDM applicability',
      'Check ACI 318-19 8.10.2 requirements',
      { aspectRatio: aspectRatio.toFixed(2), maxRatio: 2 },
      checks.length === 0 ? 'DDM applicable' : `Warnings: ${checks.join(', ')}`,
      undefined,
      'ACI 318-19 8.10.2'
    );
  }
  
  /**
   * Compile reinforcement schedule
   */
  private compileReinforcement(
    isOneWay: boolean,
    oneWay?: OneWaySlabResult,
    twoWay?: { xDirection: TwoWaySlabResult; yDirection: TwoWaySlabResult }
  ): RCSlabResult['reinforcement'] {
    if (isOneWay && oneWay) {
      return {
        bottom_x: oneWay.bars_pos,
        bottom_y: oneWay.bars_temp,
        top_x: oneWay.bars_neg,
        top_y: oneWay.bars_temp,
        temp: oneWay.bars_temp,
      };
    }
    
    if (twoWay) {
      return {
        bottom_x: twoWay.xDirection.columnStrip.bars_pos,
        bottom_y: twoWay.yDirection.columnStrip.bars_pos,
        top_x: twoWay.xDirection.columnStrip.bars_neg,
        top_y: twoWay.yDirection.columnStrip.bars_neg,
      };
    }
    
    // Default
    return {
      bottom_x: { size: '#4', spacing: 12 },
      bottom_y: { size: '#4', spacing: 12 },
      top_x: { size: '#4', spacing: 12 },
      top_y: { size: '#4', spacing: 12 },
    };
  }
  
  /**
   * Check overall adequacy
   */
  private checkOverallAdequacy(
    oneWay?: OneWaySlabResult,
    twoWay?: { xDirection: TwoWaySlabResult; yDirection: TwoWaySlabResult },
    punching?: PunchingShearResult,
    deflection?: SlabDeflectionResult
  ): boolean {
    if (punching && !punching.isAdequate) return false;
    if (deflection && !deflection.isAdequate) return false;
    
    // Additional checks could be added here
    return true;
  }
  
  /**
   * Helper to add calculation step
   */
  private addStep(
    description: string,
    formula?: string,
    values?: Record<string, number | string>,
    result?: number | string,
    unit?: string,
    reference?: string
  ): void {
    this.calculations.push({
      step: this.stepCounter++,
      description,
      formula,
      values,
      result: result ?? '',
      unit,
      reference,
    });
  }
}

// Export convenience function
export function designRCSlab(input: RCSlabInput): RCSlabResult {
  const calculator = new RCSlabCalculator(input);
  return calculator.design();
}
