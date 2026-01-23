/**
 * RC Column Design Calculator
 * Per ACI 318-19 Chapters 6, 10, 18, 22
 * 
 * Design process:
 * 1. Check slenderness and determine if moment magnification needed
 * 2. Calculate moment magnification factors
 * 3. Check P-M interaction capacity
 * 4. Design transverse reinforcement
 * 5. Check shear capacity
 * 6. Determine splice requirements
 */

import {
  RCColumnInput,
  RCColumnResult,
  SlendernessResult,
  MomentMagnificationResult,
  CapacityResult,
  ConfinementResult,
  ShearResult,
  InteractionPoint,
  CalculationStep,
  ColumnCategory,
  FrameType,
  SeismicDetailingCategory,
  ACI_COLUMN_LIMITS,
  SEISMIC_COLUMN_REQUIREMENTS,
  EFFECTIVE_LENGTH_CHARTS,
  REBAR_DATA_COL,
} from './ColumnDesignTypes';

export class RCColumnCalculator {
  private phi_c = 0.65; // Compression-controlled (tied)
  private phi_c_spiral = 0.75; // Spiral column
  private phi_t = 0.90; // Tension-controlled
  private phi_v = 0.75; // Shear
  private E_c_factor = 57000; // Ec = 57000 × √f'c
  
  /**
   * Main calculation method for RC column design
   */
  calculate(input: RCColumnInput): RCColumnResult {
    const steps: CalculationStep[] = [];
    
    // Step 1: Section properties
    const section = this.calculateSectionProperties(input, steps);
    
    // Step 2: Select/verify longitudinal reinforcement
    const longitudinal = this.designLongitudinalReinf(input, section, steps);
    
    // Step 3: Check slenderness
    const slenderness = this.checkSlenderness(input, steps);
    
    // Step 4: Moment magnification (if slender)
    let momentMagnification: MomentMagnificationResult | undefined;
    if (slenderness.isSlender) {
      momentMagnification = this.calculateMomentMagnification(input, slenderness, steps);
    }
    
    // Step 5: Check P-M interaction capacity
    const Mu_design_x = momentMagnification?.Mc_x || input.loads.Mux;
    const Mu_design_y = momentMagnification?.Mc_y || input.loads.Muy;
    const capacity = this.checkCapacity(input, longitudinal, Mu_design_x, Mu_design_y, steps);
    
    // Step 6: Design transverse reinforcement
    const confinement = this.designConfinement(input, longitudinal, steps);
    
    // Step 7: Check shear
    const shear = this.checkShear(input, confinement, steps);
    
    // Step 8: Determine splice requirements
    const splice = this.determineSplice(input, longitudinal, steps);
    
    // Overall adequacy
    const isAdequate = 
      longitudinal.isAdequate &&
      capacity.isAdequate &&
      confinement.isAdequate &&
      shear.isAdequate;
    
    return {
      isAdequate,
      section,
      longitudinal,
      slenderness,
      momentMagnification,
      capacity,
      confinement,
      shear,
      splice,
      calculations: steps,
      codeReference: 'ACI 318-19 Chapters 10, 18, 22'
    };
  }
  
  /**
   * Calculate section properties
   */
  private calculateSectionProperties(
    input: RCColumnInput,
    steps: CalculationStep[]
  ): RCColumnResult['section'] {
    const { b, h } = input.geometry;
    const Ag = b * h;
    
    steps.push({
      step: 1,
      description: 'Gross section area',
      formula: 'Ag = b × h',
      values: { b, h },
      result: Ag,
      unit: 'in²'
    });
    
    return {
      b,
      h,
      Ag,
      Ast: 0, // Will be calculated
      rho_g: 0
    };
  }
  
  /**
   * Design or verify longitudinal reinforcement
   */
  private designLongitudinalReinf(
    input: RCColumnInput,
    section: RCColumnResult['section'],
    steps: CalculationStep[]
  ): RCColumnResult['longitudinal'] {
    const { b, h, Ag } = section;
    const cover = input.geometry.cover;
    const fc = input.materials.fc;
    const fy = input.materials.fy;
    
    // Reinforcement limits
    const rho_max = input.frame.seismicCategory === SeismicDetailingCategory.SPECIAL 
      ? ACI_COLUMN_LIMITS.rho_g_max_seismic 
      : ACI_COLUMN_LIMITS.rho_g_max;
    
    let bars: { size: string; quantity: number };
    let Ast: number;
    
    if (input.longitudinalBars) {
      // Use provided reinforcement
      bars = input.longitudinalBars;
      Ast = bars.quantity * REBAR_DATA_COL[bars.size].Ab;
    } else {
      // Design reinforcement
      // Start with minimum and check capacity
      Ast = ACI_COLUMN_LIMITS.rho_g_min * Ag;
      bars = this.selectBars(Ast, b, h, cover);
      Ast = bars.quantity * REBAR_DATA_COL[bars.size].Ab;
    }
    
    const rho_g = Ast / Ag;
    
    // Check limits
    const rho_ok = rho_g >= ACI_COLUMN_LIMITS.rho_g_min && rho_g <= rho_max;
    const n_ok = bars.quantity >= ACI_COLUMN_LIMITS.min_bars_tied;
    
    // Check bar spacing
    const db = REBAR_DATA_COL[bars.size].db;
    const bars_per_face = Math.ceil(bars.quantity / 4); // Approximate
    const clearSpacing = (b - 2 * cover - 2 * db) / (bars_per_face - 1) - db;
    const spacing_ok = clearSpacing >= Math.max(1.5 * db, 1.5, 4/3 * 1); // Assume 1" max aggregate
    
    steps.push({
      step: 2,
      description: 'Longitudinal reinforcement design',
      formula: 'ρg = Ast / Ag',
      values: { 
        Ast: Ast.toFixed(2), 
        Ag, 
        rho_g: (rho_g * 100).toFixed(2),
        rho_min: (ACI_COLUMN_LIMITS.rho_g_min * 100).toFixed(2),
        rho_max: (rho_max * 100).toFixed(2)
      },
      result: `${bars.quantity}-${bars.size}`,
      reference: 'ACI 318-19 10.6.1'
    });
    
    // Update section
    section.Ast = Ast;
    section.rho_g = rho_g;
    
    return {
      bars,
      Ast,
      rho_g,
      arrangement: 'UNIFORM',
      clearSpacing,
      isAdequate: rho_ok && n_ok && spacing_ok
    };
  }
  
  /**
   * Select reinforcement bars
   */
  private selectBars(
    As_required: number,
    b: number,
    h: number,
    cover: number
  ): { size: string; quantity: number } {
    const sizes = ['#7', '#8', '#9', '#10', '#11'];
    
    for (const size of sizes) {
      const Ab = REBAR_DATA_COL[size].Ab;
      const db = REBAR_DATA_COL[size].db;
      
      // Try different quantities (minimum 4 for tied column)
      for (let n = 4; n <= 20; n += 2) {
        const Ast = n * Ab;
        if (Ast >= As_required) {
          // Check if bars fit
          const bars_per_face = Math.ceil(n / 4);
          const face_width = Math.min(b, h) - 2 * cover;
          const spacing = (face_width - bars_per_face * db) / (bars_per_face - 1);
          
          if (spacing >= 1.5 * db && spacing >= 1.5) {
            return { size, quantity: n };
          }
        }
      }
    }
    
    // Default
    return { size: '#8', quantity: 8 };
  }
  
  /**
   * Check column slenderness
   */
  private checkSlenderness(
    input: RCColumnInput,
    steps: CalculationStep[]
  ): SlendernessResult {
    const { b, h, L_clear } = input.geometry;
    const Lu = L_clear * 12; // Convert to inches
    
    // Radius of gyration
    const r_x = h / Math.sqrt(12);
    const r_y = b / Math.sqrt(12);
    
    // Effective length factor
    let k_x: number;
    let k_y: number;
    
    if (input.frame.frameType === FrameType.NONSWAY) {
      // Use alignment charts or simplified
      k_x = this.calculateK_nonsway(input.frame.psi_top, input.frame.psi_bottom);
      k_y = k_x; // Simplified - same in both directions
    } else {
      // Sway frame
      k_x = this.calculateK_sway(input.frame.psi_top, input.frame.psi_bottom);
      k_y = k_x;
    }
    
    // Slenderness ratios
    const kLu_r_x = k_x * Lu / r_x;
    const kLu_r_y = k_y * Lu / r_y;
    
    // Slenderness limit
    let limit: number;
    if (input.frame.frameType === FrameType.NONSWAY) {
      // Limit depends on M1/M2 ratio
      const M1 = input.loads.M1x || 0;
      const M2 = input.loads.M2x || input.loads.Mux;
      const ratio = M2 !== 0 ? M1 / M2 : 0;
      limit = Math.min(34 - 12 * ratio, 40);
    } else {
      limit = ACI_COLUMN_LIMITS.slender_limit_sway;
    }
    
    const isSlender = Math.max(kLu_r_x, kLu_r_y) > limit;
    const governingAxis = kLu_r_x >= kLu_r_y ? 'X' : 'Y';
    
    steps.push({
      step: 3,
      description: 'Slenderness check',
      formula: 'kLu/r vs limit',
      values: { 
        k_x: k_x.toFixed(2),
        Lu,
        r_x: r_x.toFixed(2),
        kLu_r_x: kLu_r_x.toFixed(1),
        kLu_r_y: kLu_r_y.toFixed(1),
        limit
      },
      result: isSlender ? 'SLENDER' : 'SHORT',
      reference: 'ACI 318-19 6.2.5'
    });
    
    return {
      category: isSlender ? ColumnCategory.SLENDER : ColumnCategory.SHORT,
      kx: k_x,
      ky: k_y,
      r_x,
      r_y,
      kLu_r_x,
      kLu_r_y,
      limit,
      isSlender,
      governingAxis
    };
  }
  
  /**
   * Calculate effective length factor for non-sway frames
   */
  private calculateK_nonsway(psi_top: number, psi_bottom: number): number {
    // Jackson-Moreland alignment chart approximation
    const psi_avg = (psi_top + psi_bottom) / 2;
    
    if (psi_top === 0 && psi_bottom === 0) return 0.5; // Fixed-fixed
    if (psi_top === Infinity || psi_bottom === Infinity) return 1.0; // Pinned
    
    // Simplified formula for braced frames
    const k = 0.7 + 0.05 * (psi_top + psi_bottom);
    return Math.min(k, 1.0);
  }
  
  /**
   * Calculate effective length factor for sway frames
   */
  private calculateK_sway(psi_top: number, psi_bottom: number): number {
    // For sway frames
    if (psi_top === 0 && psi_bottom === 0) return 1.0;
    
    const psi_avg = (psi_top + psi_bottom) / 2;
    
    // Simplified formula for unbraced frames
    if (psi_avg < 2) {
      return 0.9 * Math.sqrt(1 + psi_avg);
    } else {
      return 0.9 * Math.sqrt(1 + psi_avg) * Math.sqrt(0.85 + 0.05 * psi_avg);
    }
  }
  
  /**
   * Calculate moment magnification factors
   */
  private calculateMomentMagnification(
    input: RCColumnInput,
    slenderness: SlendernessResult,
    steps: CalculationStep[]
  ): MomentMagnificationResult {
    const fc = input.materials.fc;
    const Es = input.materials.Es || 29000000; // psi
    const { b, h } = input.geometry;
    const Lu = input.geometry.L_clear * 12;
    
    // Moment of inertia
    const Ig_x = b * Math.pow(h, 3) / 12;
    const Ig_y = h * Math.pow(b, 3) / 12;
    
    // Effective stiffness (ACI 318-19 6.6.4.4.4)
    const Ec = this.E_c_factor * Math.sqrt(fc);
    const beta_dns = 0.6; // Sustained load factor (conservative)
    
    const EI_x = 0.4 * Ec * Ig_x / (1 + beta_dns);
    const EI_y = 0.4 * Ec * Ig_y / (1 + beta_dns);
    
    // Critical buckling load
    const Pc_x = Math.PI * Math.PI * EI_x / Math.pow(slenderness.kx * Lu, 2) / 1000; // kips
    const Pc_y = Math.PI * Math.PI * EI_y / Math.pow(slenderness.ky * Lu, 2) / 1000;
    
    // Cm factor
    const M1x = input.loads.M1x || input.loads.Mux * 0.5;
    const M2x = input.loads.M2x || input.loads.Mux;
    const M1y = input.loads.M1y || input.loads.Muy * 0.5;
    const M2y = input.loads.M2y || input.loads.Muy;
    
    const Cm_x = 0.6 + 0.4 * (M1x / M2x);
    const Cm_y = 0.6 + 0.4 * (M1y / M2y);
    
    // Moment magnification factors (non-sway)
    const Pu = input.loads.Pu;
    const delta_ns_x = Math.max(Cm_x / (1 - Pu / (0.75 * Pc_x)), 1.0);
    const delta_ns_y = Math.max(Cm_y / (1 - Pu / (0.75 * Pc_y)), 1.0);
    
    // Magnified moments
    const Mc_x = delta_ns_x * Math.abs(input.loads.Mux);
    const Mc_y = delta_ns_y * Math.abs(input.loads.Muy);
    
    steps.push({
      step: 4,
      description: 'Moment magnification (non-sway)',
      formula: 'δns = Cm / (1 - Pu/0.75Pc)',
      values: { 
        Cm_x: Cm_x.toFixed(2),
        Pc_x: Pc_x.toFixed(0),
        Pu,
        delta_ns_x: delta_ns_x.toFixed(3)
      },
      result: `Mc_x = ${Mc_x.toFixed(1)} kip-ft`,
      reference: 'ACI 318-19 6.6.4.5'
    });
    
    return {
      required: true,
      Mc_x,
      Mc_y,
      delta_ns_x,
      delta_ns_y,
      Pc_x,
      Pc_y
    };
  }
  
  /**
   * Check P-M interaction capacity
   */
  private checkCapacity(
    input: RCColumnInput,
    longitudinal: RCColumnResult['longitudinal'],
    Mu_x: number,
    Mu_y: number,
    steps: CalculationStep[]
  ): CapacityResult {
    const fc = input.materials.fc;
    const fy = input.materials.fy;
    const { b, h } = input.geometry;
    const cover = input.geometry.cover;
    const Ast = longitudinal.Ast;
    const Pu = input.loads.Pu;
    const Ag = b * h;
    
    // Simplified capacity calculation
    // For detailed P-M interaction, use strain compatibility
    
    // Maximum compression (axially loaded)
    const phi = this.phi_c;
    const phi_Pn_max = phi * 0.80 * (0.85 * fc * (Ag - Ast) / 1000 + fy * Ast / 1000);
    
    // Maximum tension
    const phi_Pn_t = this.phi_t * fy * Ast / 1000;
    
    // Moment capacity at given axial load (simplified)
    // Use Whitney stress block approach
    const d = h - cover - 0.5; // Approximate effective depth
    const d_prime = cover + 0.5;
    const As = Ast / 2; // Steel on tension side (approximate)
    const As_prime = As; // Steel on compression side
    
    // For compression + moment, estimate capacity
    const a_max = 0.85 * fc * b / fy * (As_prime + As) / 1000;
    const e = Pu > 0 ? Mu_x * 12 / Pu : 1000; // Eccentricity (in)
    
    // Approximate moment capacity at Pu
    let phi_Mn_x: number;
    if (Pu > 0.5 * phi_Pn_max) {
      // Compression-controlled
      phi_Mn_x = phi * (0.85 * fc / 1000 * b * 0.5 * h * (h / 2 - 0.25 * h) + 
                        As_prime * fy / 1000 * (h / 2 - d_prime)) / 12;
    } else {
      // Tension or balanced
      const a = As * fy / (0.85 * fc * b);
      phi_Mn_x = this.phi_t * As * fy / 1000 * (d - a / 2) / 12;
    }
    
    // Y-direction (swap b and h)
    const phi_Mn_y = phi_Mn_x * b / h; // Simplified proportion
    
    // Biaxial interaction (Bresler equation)
    // 1/Pr = 1/Prx + 1/Pry - 1/Pr0
    const Pr0 = phi_Pn_max;
    const Prx = this.getAxialAtMoment(phi_Pn_max, phi_Mn_x, Mu_x);
    const Pry = this.getAxialAtMoment(phi_Pn_max, phi_Mn_y, Mu_y);
    
    let interactionRatio: number;
    if (Mu_x > 0 && Mu_y > 0) {
      // Biaxial bending
      const Pr_biaxial = 1 / (1/Prx + 1/Pry - 1/Pr0);
      interactionRatio = Pu / Pr_biaxial;
    } else if (Mu_x > 0) {
      interactionRatio = Pu / Prx;
    } else if (Mu_y > 0) {
      interactionRatio = Pu / Pry;
    } else {
      interactionRatio = Pu / phi_Pn_max;
    }
    
    // Simplified check using load contour method
    const ratio_P = Pu / phi_Pn_max;
    const ratio_Mx = Mu_x / phi_Mn_x;
    const ratio_My = Mu_y / phi_Mn_y;
    
    // Load contour: (Mx/Mnx)^α + (My/Mny)^α ≤ 1.0 at given P
    const alpha = 1.0 + ratio_P; // Varies from 1 to 2
    const interaction_check = Math.pow(ratio_Mx, alpha) + Math.pow(ratio_My, alpha);
    
    steps.push({
      step: 5,
      description: 'P-M interaction check',
      formula: 'Load contour: (Mx/Mnx)^α + (My/Mny)^α ≤ 1.0',
      values: { 
        Pu,
        phi_Pn_max: phi_Pn_max.toFixed(0),
        Mu_x: Mu_x.toFixed(1),
        phi_Mn_x: phi_Mn_x.toFixed(1),
        ratio_P: ratio_P.toFixed(3),
        ratio_Mx: ratio_Mx.toFixed(3)
      },
      result: interaction_check.toFixed(3),
      reference: 'ACI 318-19 22.4'
    });
    
    return {
      phi_Pn_max,
      phi_Pn_t,
      phi_Mn_x,
      phi_Mn_y,
      interactionRatio: interaction_check,
      isAdequate: interaction_check <= 1.0 && Pu <= phi_Pn_max
    };
  }
  
  /**
   * Get axial capacity at given moment (simplified)
   */
  private getAxialAtMoment(Pn_max: number, Mn: number, Mu: number): number {
    if (Mu <= 0) return Pn_max;
    const ratio = Mu / Mn;
    if (ratio >= 1) return 0;
    return Pn_max * (1 - ratio);
  }
  
  /**
   * Design transverse reinforcement (ties/spirals)
   */
  private designConfinement(
    input: RCColumnInput,
    longitudinal: RCColumnResult['longitudinal'],
    steps: CalculationStep[]
  ): ConfinementResult {
    const { b, h, cover } = input.geometry;
    const fc = input.materials.fc;
    const fyt = input.materials.fyt;
    const db_long = REBAR_DATA_COL[longitudinal.bars.size].db;
    
    // Core dimensions
    const bc = b - 2 * cover;
    const hc = h - 2 * cover;
    const Ag = b * h;
    const Ach = bc * hc;
    
    // Tie size
    const tieSize = db_long <= REBAR_DATA_COL['#10'].db ? '#3' : '#4';
    const db_tie = REBAR_DATA_COL[tieSize].db;
    const Ab_tie = REBAR_DATA_COL[tieSize].Ab;
    
    // Determine spacing and legs
    let s_max: number;
    let legs_x: number;
    let legs_y: number;
    let Ash_required_x: number;
    let Ash_required_y: number;
    let specialReqs: ConfinementResult['specialRequirements'];
    
    if (input.frame.seismicCategory === SeismicDetailingCategory.SPECIAL) {
      // SMF column requirements (ACI 318-19 18.7.5)
      const lo = Math.max(h, input.geometry.L_clear * 12 / 6, 18);
      
      // Maximum spacing in confinement zone
      const so = 4 + (14 - REBAR_DATA_COL[longitudinal.bars.size].db) / 3;
      s_max = Math.min(h / 4, 6 * db_long, so);
      
      // Required Ash (ACI 318-19 18.7.5.4)
      Ash_required_x = Math.max(
        0.3 * s_max * bc * fc / fyt * (Ag / Ach - 1),
        0.09 * s_max * bc * fc / fyt
      );
      Ash_required_y = Math.max(
        0.3 * s_max * hc * fc / fyt * (Ag / Ach - 1),
        0.09 * s_max * hc * fc / fyt
      );
      
      specialReqs = {
        lo,
        s_max_conf: s_max,
        s_max_other: Math.min(6 * db_long, 6)
      };
      
    } else if (input.frame.seismicCategory === SeismicDetailingCategory.INTERMEDIATE) {
      // IMF requirements
      s_max = Math.min(8 * db_long, 24, h / 2);
      Ash_required_x = 0.06 * s_max * bc * fc / fyt;
      Ash_required_y = 0.06 * s_max * hc * fc / fyt;
      
    } else {
      // Ordinary (non-seismic)
      s_max = Math.min(16 * db_long, 48 * db_tie, Math.min(b, h));
      Ash_required_x = 0; // No Ash requirement
      Ash_required_y = 0;
    }
    
    // Calculate required legs
    legs_x = Math.max(Math.ceil(Ash_required_x / Ab_tie), 2);
    legs_y = Math.max(Math.ceil(Ash_required_y / Ab_tie), 2);
    
    // Ensure bars at corners and intermediate bars supported
    const bars_per_face = Math.ceil(longitudinal.bars.quantity / 4);
    legs_x = Math.max(legs_x, bars_per_face);
    legs_y = Math.max(legs_y, bars_per_face);
    
    const Ash_provided_x = legs_x * Ab_tie;
    const Ash_provided_y = legs_y * Ab_tie;
    
    steps.push({
      step: 6,
      description: 'Transverse reinforcement design',
      formula: 'Ash = 0.3 × s × bc × f\'c/fyt × (Ag/Ach - 1)',
      values: { 
        s_max,
        bc,
        Ash_required_x: Ash_required_x.toFixed(2),
        legs_x,
        Ash_provided_x: Ash_provided_x.toFixed(2)
      },
      result: `${tieSize} ties @ ${s_max}" with ${legs_x} legs`,
      reference: 'ACI 318-19 18.7.5'
    });
    
    return {
      tieSize,
      tieSpacing: s_max,
      tieLegsx: legs_x,
      tieLegsy: legs_y,
      Ash_provided_x,
      Ash_provided_y,
      Ash_required_x,
      Ash_required_y,
      isAdequate: Ash_provided_x >= Ash_required_x && Ash_provided_y >= Ash_required_y,
      specialRequirements: specialReqs
    };
  }
  
  /**
   * Check shear capacity
   */
  private checkShear(
    input: RCColumnInput,
    confinement: ConfinementResult,
    steps: CalculationStep[]
  ): ShearResult {
    const fc = input.materials.fc;
    const fyt = input.materials.fyt;
    const { b, h, cover } = input.geometry;
    const Vu = input.loads.Vu;
    const Nu = input.loads.Pu * 1000; // Convert to lbs
    const Ag = b * h;
    
    // Effective depth
    const d = h - cover - 0.5;
    
    // Concrete shear strength with axial (ACI 318-19 22.5.6)
    const Vc = 2 * (1 + Nu / (2000 * Ag)) * Math.sqrt(fc) * b * d / 1000;
    const phi_Vc = this.phi_v * Vc;
    
    // Shear reinforcement contribution
    const Av = confinement.tieLegsx * REBAR_DATA_COL[confinement.tieSize].Ab;
    const s = confinement.tieSpacing;
    const Vs = Av * fyt * d / s / 1000;
    const phi_Vs = this.phi_v * Vs;
    
    const phi_Vn = phi_Vc + phi_Vs;
    const ratio = Vu / phi_Vn;
    
    steps.push({
      step: 7,
      description: 'Shear capacity check',
      formula: 'φVn = φVc + φVs',
      values: { 
        Vu,
        phi_Vc: phi_Vc.toFixed(1),
        phi_Vs: phi_Vs.toFixed(1),
        phi_Vn: phi_Vn.toFixed(1)
      },
      result: ratio.toFixed(3),
      reference: 'ACI 318-19 22.5'
    });
    
    return {
      Vu,
      phi_Vc,
      phi_Vs,
      phi_Vn,
      ratio,
      isAdequate: Vu <= phi_Vn,
      shearReinfRequired: Vu > phi_Vc / 2
    };
  }
  
  /**
   * Determine splice requirements
   */
  private determineSplice(
    input: RCColumnInput,
    longitudinal: RCColumnResult['longitudinal'],
    steps: CalculationStep[]
  ): RCColumnResult['splice'] {
    const fc = input.materials.fc;
    const fy = input.materials.fy;
    const db = REBAR_DATA_COL[longitudinal.bars.size].db;
    
    // Development length
    const ld = (fy / (25 * Math.sqrt(fc))) * db;
    
    // Splice class depends on stress level and percentage spliced
    // Assume Class B (typical)
    const spliceClass = 'B' as 'A' | 'B';
    const spliceFactor = spliceClass === 'A' ? 1.0 : 1.3;
    
    // Compression splice (typical for columns)
    // ACI 318-19 25.5.5
    const fy_compression_lap = Math.max(0.0005 * fy * db, 12);
    const compressionLap = Math.max(
      ld,
      0.0005 * fy * db,
      12
    );
    
    // For seismic, use tension splice at potential hinge locations
    let spliceLength: number;
    if (input.frame.seismicCategory === SeismicDetailingCategory.SPECIAL) {
      // Tension lap splice
      spliceLength = 1.3 * ld;
    } else {
      spliceLength = compressionLap;
    }
    
    steps.push({
      step: 8,
      description: 'Splice requirements',
      values: { 
        db,
        ld: ld.toFixed(1),
        spliceClass,
        spliceLength: spliceLength.toFixed(1)
      },
      result: `Class ${spliceClass}, ${Math.ceil(spliceLength)}"`,
      reference: 'ACI 318-19 25.5'
    });
    
    return {
      class: spliceClass,
      length: Math.ceil(spliceLength),
      location: input.frame.seismicCategory === SeismicDetailingCategory.SPECIAL
        ? 'Center half of column height'
        : 'Any location meeting lap requirements'
    };
  }
}

// Export singleton instance
export const rcColumnCalculator = new RCColumnCalculator();
