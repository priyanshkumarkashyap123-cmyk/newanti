/**
 * RC Shear Wall Design Calculator
 * Comprehensive wall design per ACI 318-19
 * 
 * Features:
 * - In-plane shear design
 * - Flexural design
 * - Boundary element design
 * - Out-of-plane analysis
 * - Coupling beam design
 */

import {
  WallType,
  SeismicDesignCategory,
  BoundaryElementType,
  WallReinforcementLayout,
  ShearWallInput,
  ShearWallResult,
  ShearDesignResult,
  FlexuralDesignResult,
  BoundaryElementResult,
  WallStabilityResult,
  OutOfPlaneResult,
  CouplingBeamResult,
  CalculationStep,
  WALL_REINFORCEMENT_LIMITS,
  SPECIAL_SHEAR_WALL,
  ORDINARY_SHEAR_WALL,
  REBAR_DATA_WALL,
} from './ShearWallTypes';

export class ShearWallCalculator {
  private input: ShearWallInput;
  private calculations: CalculationStep[] = [];
  private stepCounter = 1;
  
  constructor(input: ShearWallInput) {
    this.input = input;
  }
  
  /**
   * Main design method
   */
  public design(): ShearWallResult {
    this.calculations = [];
    this.stepCounter = 1;
    
    const { geometry, materials, loads, wallType, seismicCategory } = this.input;
    
    // Section properties
    const hw = geometry.hw * 12; // Height in inches
    const Lw = geometry.Lw * 12; // Length in inches
    const tw = geometry.tw;
    
    const Ag = Lw * tw;
    const Ig = tw * Math.pow(Lw, 3) / 12;
    const hw_Lw = geometry.hw / geometry.Lw;
    
    this.addStep(
      'Calculate section properties',
      'Ag = Lw × tw, Ig = tw × Lw³/12',
      { hw: geometry.hw + ' ft', Lw: geometry.Lw + ' ft', tw: tw + ' in' },
      `Ag = ${Ag.toFixed(0)} in², Ig = ${(Ig / 1e6).toFixed(2)} × 10⁶ in⁴`,
      undefined,
      'ACI 318-19 11.5.4'
    );
    
    // Design components
    const shearResult = this.designShear(Lw, tw, hw_Lw);
    const flexureResult = this.designFlexure(Lw, tw, Ag);
    
    // Boundary elements (for special shear walls or when required)
    let boundaryResult: BoundaryElementResult | undefined;
    if (this.input.checkBoundaryElements || 
        wallType === WallType.SHEAR_SPECIAL ||
        this.isSpecialSeismicCategory(seismicCategory)) {
      boundaryResult = this.designBoundaryElements(Lw, tw, Ag);
    }
    
    // Stability check
    const stabilityResult = this.checkStability(hw, tw);
    
    // Out-of-plane
    let outOfPlaneResult: OutOfPlaneResult | undefined;
    if (loads.wu_oop) {
      outOfPlaneResult = this.designOutOfPlane(tw);
    }
    
    // Coupling beam (if applicable)
    let couplingResult: CouplingBeamResult | undefined;
    if (this.input.designCoupling && this.input.couplingBeam) {
      couplingResult = this.designCouplingBeam();
    }
    
    // Compile reinforcement schedule
    const layers = tw >= WALL_REINFORCEMENT_LIMITS.double_layer_tw ? 2 : 1;
    
    const reinforcement: ShearWallResult['reinforcement'] = {
      vertical: {
        size: flexureResult.vertical_bars.size,
        spacing: flexureResult.vertical_bars.spacing,
        layers: layers as 1 | 2,
      },
      horizontal: {
        size: shearResult.horizontal_bars.size,
        spacing: shearResult.horizontal_bars.spacing,
        layers: layers as 1 | 2,
      },
    };
    
    if (boundaryResult?.required) {
      reinforcement.boundary = {
        longitudinal: boundaryResult.longitudinal.bars,
        transverse: boundaryResult.transverse 
          ? `${boundaryResult.transverse.size}@${boundaryResult.transverse.spacing}"` 
          : 'N/A',
      };
    }
    
    // Overall adequacy
    const isAdequate = 
      shearResult.isAdequate && 
      flexureResult.isAdequate &&
      (!boundaryResult || boundaryResult.required === false || (boundaryResult.longitudinal.As > 0)) &&
      (!outOfPlaneResult || outOfPlaneResult.isAdequate);
    
    return {
      isAdequate,
      wallType,
      seismicCategory,
      section: {
        hw: geometry.hw,
        Lw: geometry.Lw,
        tw,
        Ag,
        Ig,
        hw_Lw_ratio: hw_Lw,
      },
      shear: shearResult,
      flexure: flexureResult,
      boundary: boundaryResult,
      stability: stabilityResult,
      outOfPlane: outOfPlaneResult,
      couplingBeam: couplingResult,
      reinforcement,
      calculations: this.calculations,
      codeReference: 'ACI 318-19 Chapter 11 & 18',
    };
  }
  
  /**
   * Design for in-plane shear
   */
  private designShear(Lw: number, tw: number, hw_Lw: number): ShearDesignResult {
    const { materials, loads, wallType } = this.input;
    
    const fc = materials.fc;
    const fy = materials.fyt || materials.fy;
    const lambda = materials.lambda || 1.0;
    const Vu = loads.Vu;
    
    const phi = 0.75; // Shear
    
    // Effective shear area (ACI 318-19 11.5.4.2)
    const Acv = Lw * tw;
    
    // Coefficient αc (varies with hw/Lw)
    let alpha_c: number;
    if (hw_Lw <= 1.5) {
      alpha_c = ORDINARY_SHEAR_WALL.alpha_c_low;
    } else if (hw_Lw >= 2.0) {
      alpha_c = ORDINARY_SHEAR_WALL.alpha_c_high;
    } else {
      // Linear interpolation
      alpha_c = ORDINARY_SHEAR_WALL.alpha_c_low - 
        (ORDINARY_SHEAR_WALL.alpha_c_low - ORDINARY_SHEAR_WALL.alpha_c_high) * 
        (hw_Lw - 1.5) / 0.5;
    }
    
    this.addStep(
      'Determine shear coefficient αc',
      'αc varies from 3.0 (hw/Lw ≤ 1.5) to 2.0 (hw/Lw ≥ 2.0)',
      { hw_Lw: hw_Lw.toFixed(2) },
      alpha_c.toFixed(2),
      undefined,
      'ACI 318-19 11.5.4.3'
    );
    
    // Concrete shear contribution
    const Vc = alpha_c * lambda * Math.sqrt(fc) * Acv / 1000; // kips
    
    // Required steel contribution
    const Vs_req = (Vu / phi) - Vc;
    
    // Minimum horizontal steel ratio
    const rho_t_min = fy >= 60000 
      ? WALL_REINFORCEMENT_LIMITS.rho_t_min 
      : WALL_REINFORCEMENT_LIMITS.rho_t_min_40;
    
    // Calculate required horizontal steel ratio
    let rho_t: number;
    if (Vs_req > 0) {
      // ρt = Vs / (fy × Acv)
      rho_t = Math.max((Vs_req * 1000) / (fy * Acv), rho_t_min);
    } else {
      rho_t = rho_t_min;
    }
    
    // Steel contribution
    const Vs = rho_t * fy * Acv / 1000; // kips
    
    this.addStep(
      'Calculate shear reinforcement',
      'Vs = ρt × fy × Acv',
      { rho_t: rho_t.toFixed(4), fy, Acv: Acv.toFixed(0) },
      Vs.toFixed(1),
      'kips',
      'ACI 318-19 11.5.4.4'
    );
    
    // Total capacity
    const Vn = Vc + Vs;
    const phi_Vn = phi * Vn;
    
    // Check maximum (ACI limit: 10√f'c × Acv)
    const Vn_max = ORDINARY_SHEAR_WALL.Vn_limit_factor * lambda * Math.sqrt(fc) * Acv / 1000;
    const exceeds_limit = Vn > Vn_max;
    
    // Select horizontal bars
    const horizontal_bars = this.selectWallBars(rho_t, tw, 'horizontal');
    
    this.addStep(
      'Check shear capacity',
      'φVn = φ(Vc + Vs) ≥ Vu',
      { Vc: Vc.toFixed(1), Vs: Vs.toFixed(1), phi },
      `φVn = ${phi_Vn.toFixed(1)} kips`,
      undefined,
      'ACI 318-19 11.5.4'
    );
    
    return {
      Vu,
      phi_Vn,
      ratio: Vu / phi_Vn,
      isAdequate: Vu <= phi_Vn && !exceeds_limit,
      Vc,
      Vs,
      rho_t,
      horizontal_bars,
      Vn_max,
      exceeds_limit,
    };
  }
  
  /**
   * Design for in-plane flexure
   */
  private designFlexure(Lw: number, tw: number, Ag: number): FlexuralDesignResult {
    const { materials, loads } = this.input;
    
    const fc = materials.fc;
    const fy = materials.fy;
    const Pu = loads.Pu;
    const Mu = loads.Mu_base;
    
    const phi = 0.9; // Flexure (tension-controlled, check later)
    
    // Effective depth (approximate)
    const d = 0.8 * Lw;
    
    // Required Mn
    const Mn_req = Mu / phi;
    
    // Estimate required steel from simplified analysis
    // Mn ≈ As × fy × jd where jd ≈ 0.8d
    const jd = 0.8 * d;
    const As_req_flex = (Mn_req * 12000) / (fy * jd);
    
    // Minimum vertical steel
    const rho_l_min = WALL_REINFORCEMENT_LIMITS.rho_l_min;
    const As_min = rho_l_min * Ag;
    
    // Required steel (governing)
    const As_dist = Math.max(As_req_flex, As_min);
    
    // Calculate actual capacity with distributed steel
    const rho_l = As_dist / Ag;
    
    // Simplified P-M check
    // Phi × Mn = phi × [As × fy × (d - a/2) - Pu × (d - h/2)]
    const a = (As_dist * fy) / (0.85 * fc * tw);
    const Mn_capacity = (As_dist * fy * (d - a / 2) + Pu * 1000 * (d - Lw / 2)) / 12000;
    const phi_Mn = phi * Mn_capacity;
    
    this.addStep(
      'Calculate flexural capacity',
      'φMn = φ × As × fy × (d - a/2)',
      { As: As_dist.toFixed(2), fy, d: d.toFixed(1), a: a.toFixed(2) },
      phi_Mn.toFixed(1),
      'kip-ft',
      'ACI 318-19 11.5.2'
    );
    
    // Select vertical bars
    const vertical_bars = this.selectWallBars(rho_l, tw, 'vertical');
    
    // Count bars along wall length
    const bar_data = REBAR_DATA_WALL[vertical_bars.size];
    const total_each_face = Math.ceil((Lw / vertical_bars.spacing));
    
    return {
      Mu,
      phi_Mn,
      ratio: Mu / phi_Mn,
      isAdequate: Mu <= phi_Mn,
      rho_l,
      vertical_bars: {
        size: vertical_bars.size,
        spacing: vertical_bars.spacing,
        total_each_face,
      },
      As_dist,
    };
  }
  
  /**
   * Design boundary elements
   */
  private designBoundaryElements(Lw: number, tw: number, Ag: number): BoundaryElementResult {
    const { geometry, materials, loads, wallType, seismicCategory } = this.input;
    
    const fc = materials.fc;
    const fy = materials.fy;
    const Pu = loads.Pu;
    const Mu = loads.Mu_base;
    
    // Check if boundary elements are required
    // Method 1: Stress-based (ACI 318-19 11.7.4.3(a))
    const Ig = tw * Math.pow(Lw, 3) / 12;
    const c = Lw / 2; // Distance to extreme fiber
    
    // Maximum compressive stress
    const sigma_max = (Pu * 1000 / Ag) + (Mu * 12000 * c / Ig);
    const stress_limit = SPECIAL_SHEAR_WALL.stress_trigger * fc;
    const required_by_stress = sigma_max > stress_limit;
    
    this.addStep(
      'Check boundary element trigger (stress)',
      'fc,max = P/A + Mc/I vs 0.2f\'c',
      { sigma_max: sigma_max.toFixed(0) + ' psi', limit: stress_limit.toFixed(0) + ' psi' },
      required_by_stress ? 'Required by stress' : 'Not required by stress',
      undefined,
      'ACI 318-19 18.10.6.2'
    );
    
    // Determine if required
    const required = required_by_stress || 
      (wallType === WallType.SHEAR_SPECIAL && this.isSpecialSeismicCategory(seismicCategory));
    
    if (!required) {
      return {
        required: false,
        type: BoundaryElementType.NONE,
        length: 0,
        width: tw,
        longitudinal: { As: 0, bars: 'N/A', arrangement: 'N/A' },
        height_extent: 0,
      };
    }
    
    // Design boundary element
    const be_type = wallType === WallType.SHEAR_SPECIAL 
      ? BoundaryElementType.SPECIAL 
      : BoundaryElementType.ORDINARY;
    
    // Boundary element length (larger of c-0.1Lw or c/2)
    // Where c = depth of neutral axis from P-M analysis
    const c_na = this.estimateNeutralAxis(Lw, tw, fc, fy, Pu, Mu);
    const be_length_1 = c_na - 0.1 * Lw;
    const be_length_2 = c_na / 2;
    const be_length = Math.max(
      Math.max(be_length_1, be_length_2),
      SPECIAL_SHEAR_WALL.be_min_length
    );
    
    this.addStep(
      'Calculate boundary element length',
      'be ≥ max(c - 0.1Lw, c/2, 12")',
      { c: c_na.toFixed(1), be_1: be_length_1.toFixed(1), be_2: be_length_2.toFixed(1) },
      be_length.toFixed(1),
      'in',
      'ACI 318-19 18.10.6.4'
    );
    
    // Boundary element width
    const be_width = geometry.boundaryElement?.width || tw;
    
    // Longitudinal reinforcement
    const Abe = be_length * be_width;
    const rho_be_min = SPECIAL_SHEAR_WALL.rho_l_min_be;
    const As_be = rho_be_min * Abe;
    
    // Select boundary bars
    const be_bars = this.selectBoundaryBars(As_be, be_length, be_width);
    
    // Transverse reinforcement (confinement)
    let transverse: BoundaryElementResult['transverse'];
    if (be_type === BoundaryElementType.SPECIAL) {
      transverse = this.designBoundaryConfinement(be_length, be_width, fc, fy);
    }
    
    // Height extent (where boundary elements required)
    // Generally full height for SSW, or where stress exceeds trigger
    const height_extent = wallType === WallType.SHEAR_SPECIAL 
      ? geometry.hw 
      : geometry.hw * 0.5; // Conservative for ordinary
    
    return {
      required: true,
      type: be_type,
      triggerMethod: 'STRESS',
      length: be_length,
      width: be_width,
      longitudinal: {
        As: As_be,
        bars: be_bars.bars,
        arrangement: be_bars.arrangement,
      },
      transverse,
      height_extent,
    };
  }
  
  /**
   * Check wall stability (slenderness)
   */
  private checkStability(hw: number, tw: number): WallStabilityResult {
    const { materials, loads } = this.input;
    
    const fc = materials.fc;
    const Ec = 57000 * Math.sqrt(fc); // psi
    
    // Slenderness
    const k = 1.0; // Assume fixed-pinned
    const lu = hw;
    const r = tw / Math.sqrt(12); // Radius of gyration for rectangle
    const slenderness = k * lu / r;
    
    const isSlender = slenderness > 100; // Practical limit
    
    this.addStep(
      'Check wall slenderness',
      'klu/r = k × lu / r',
      { k, lu: lu.toFixed(0) + ' in', r: r.toFixed(2) + ' in' },
      slenderness.toFixed(1),
      undefined,
      'ACI 318-19 11.8'
    );
    
    // Euler buckling load
    const Ig_oop = 12 * Math.pow(tw, 3) / 12; // Per foot width
    const Pc = Math.PI * Math.PI * Ec * Ig_oop / Math.pow(k * lu, 2) / 1000; // kips/ft
    
    return {
      slenderness,
      isSlender,
      Pc,
    };
  }
  
  /**
   * Design for out-of-plane loading
   */
  private designOutOfPlane(tw: number): OutOfPlaneResult {
    const { materials, loads, geometry } = this.input;
    
    if (!loads.wu_oop) {
      return {
        Mu_oop: 0,
        isAdequate: true,
        As_req: 0,
        bars: { size: '#4', spacing: 18 },
      };
    }
    
    const fc = materials.fc;
    const fy = materials.fy;
    const wu = loads.wu_oop;
    const h = geometry.hw * 12;
    
    // Out-of-plane moment (assume simply supported top and bottom)
    const Mu_oop = wu * Math.pow(h / 12, 2) / 8 / 1000; // kip-ft/ft
    
    // Design steel
    const d = tw - 1.5; // Assume 1" cover + half bar
    const phi = 0.9;
    const Mn_req = Mu_oop / phi;
    
    // Required steel per foot
    const As_req = (Mn_req * 12000) / (fy * 0.9 * d);
    const As_min = 0.0012 * 12 * tw;
    const As_final = Math.max(As_req, As_min);
    
    // Select bars
    const bars = this.selectWallBars(As_final / (12 * tw), tw, 'vertical');
    
    // Check capacity
    const a = (As_final * fy) / (0.85 * fc * 12);
    const phi_Mn = phi * As_final * fy * (d - a / 2) / 12000;
    
    return {
      Mu_oop,
      isAdequate: Mu_oop <= phi_Mn,
      As_req: As_final,
      bars,
    };
  }
  
  /**
   * Design coupling beam
   */
  private designCouplingBeam(): CouplingBeamResult {
    const { materials, couplingBeam, wallType } = this.input;
    
    if (!couplingBeam) {
      throw new Error('Coupling beam dimensions required');
    }
    
    const fc = materials.fc;
    const fy = materials.fy;
    const Ln = couplingBeam.Ln;
    const h = couplingBeam.h;
    const b = couplingBeam.b;
    
    const aspect = Ln / h;
    
    // Estimate coupling beam shear from wall analysis
    // (Would need iterative analysis in practice)
    const Vu_beam = this.input.loads.Vu * 0.3; // Rough estimate
    
    this.addStep(
      'Check coupling beam aspect ratio',
      'Ln/h determines reinforcement type',
      { Ln, h, aspect: aspect.toFixed(2) },
      aspect <= SPECIAL_SHEAR_WALL.coupling_aspect_low 
        ? 'Diagonal reinforcement required' 
        : 'Conventional reinforcement acceptable',
      undefined,
      'ACI 318-19 18.10.7'
    );
    
    if (aspect <= SPECIAL_SHEAR_WALL.coupling_aspect_low && 
        wallType === WallType.SHEAR_SPECIAL) {
      // Diagonal reinforcement required
      const theta = Math.atan(h / Ln) * 180 / Math.PI;
      
      // Vn = 2 × Avd × fy × sin(α)
      const sin_alpha = Math.sin(theta * Math.PI / 180);
      const Avd_req = (Vu_beam * 1000) / (2 * fy * sin_alpha * 0.85);
      
      // Select diagonal bars
      const n_bars = Math.ceil(Avd_req / REBAR_DATA_WALL['#8'].Ab);
      const bars = `${n_bars}-#8 ea diagonal`;
      
      const Mn_beam = 2 * n_bars * REBAR_DATA_WALL['#8'].Ab * fy * sin_alpha * (h / 2) / 12000;
      
      return {
        Vu_beam,
        Mn_beam,
        isAdequate: true,
        diagonal: {
          As: n_bars * REBAR_DATA_WALL['#8'].Ab,
          bars,
          angle: theta,
        },
      };
    } else {
      // Conventional reinforcement
      const d = h - 2.5;
      const phi = 0.9;
      
      // Flexural steel
      const Mu_beam = Vu_beam * Ln / 12 / 2; // Approximate
      const As_flex = (Mu_beam / phi * 12000) / (fy * 0.9 * d);
      
      // Shear stirrups
      const Vc = 2 * Math.sqrt(fc) * b * d / 1000;
      const Vs_req = (Vu_beam / 0.75) - Vc;
      const Av = (Vs_req > 0) ? (Vs_req * 1000 * 6) / (fy * d) : 0.22; // Min at 6" spacing
      
      return {
        Vu_beam,
        Mn_beam: phi * As_flex * fy * 0.9 * d / 12000,
        isAdequate: true,
        conventional: {
          As_flex,
          Av,
          stirrups: { size: '#4', spacing: 6 },
        },
      };
    }
  }
  
  /**
   * Estimate neutral axis depth
   */
  private estimateNeutralAxis(
    Lw: number, 
    tw: number, 
    fc: number, 
    fy: number, 
    Pu: number, 
    Mu: number
  ): number {
    // Simplified estimation
    // For combined axial + moment, c varies
    // Use approximate formula: c ≈ Lw × (0.1 + 0.9 × Pu/(0.85 × fc × Ag))
    const Ag = Lw * tw;
    const P_ratio = (Pu * 1000) / (0.85 * fc * Ag);
    const c = Lw * (0.1 + 0.9 * Math.min(P_ratio, 0.4));
    
    return Math.max(c, Lw * 0.15); // Minimum 15% of wall length
  }
  
  /**
   * Select wall reinforcement bars
   */
  private selectWallBars(
    rho: number, 
    tw: number, 
    direction: 'vertical' | 'horizontal'
  ): { size: string; spacing: number } {
    const layers = tw >= WALL_REINFORCEMENT_LIMITS.double_layer_tw ? 2 : 1;
    
    // Available bar sizes
    const sizes = ['#4', '#5', '#6'];
    
    for (const size of sizes) {
      const bar = REBAR_DATA_WALL[size];
      if (!bar) continue;
      
      // Required As per foot = rho × tw × 12
      const As_req_ft = rho * tw * 12;
      
      // As provided per layer per foot
      const As_per_bar = bar.Ab * layers;
      
      // Spacing
      const spacing = (As_per_bar / As_req_ft) * 12;
      
      // Check limits
      const max_s = Math.min(
        WALL_REINFORCEMENT_LIMITS.s_max_vert,
        WALL_REINFORCEMENT_LIMITS.s_max_3tw * tw
      );
      
      if (spacing >= 6 && spacing <= max_s) {
        return { 
          size, 
          spacing: Math.floor(spacing) 
        };
      }
    }
    
    // Default
    return { size: '#5', spacing: 12 };
  }
  
  /**
   * Select boundary element bars
   */
  private selectBoundaryBars(
    As: number, 
    length: number, 
    width: number
  ): { bars: string; arrangement: string } {
    // Target 4-8 bars minimum
    const sizes = ['#6', '#7', '#8', '#9', '#10'];
    
    for (const size of sizes) {
      const bar = REBAR_DATA_WALL[size];
      if (!bar) continue;
      
      const n = Math.ceil(As / bar.Ab);
      
      if (n >= 4 && n <= 12) {
        // Determine arrangement
        const n_corners = 4;
        const n_per_side = Math.ceil((n - n_corners) / 2);
        
        return {
          bars: `${n}-${size}`,
          arrangement: `4 corner + ${n_per_side} ea face`,
        };
      }
    }
    
    return { bars: '8-#8', arrangement: '4 corner + 2 ea face' };
  }
  
  /**
   * Design boundary element confinement
   */
  private designBoundaryConfinement(
    length: number,
    width: number,
    fc: number,
    fy: number
  ): BoundaryElementResult['transverse'] {
    // Core dimensions (to centerline of perimeter hoop)
    const cover = 1.5;
    const bc1 = length - 2 * cover;
    const bc2 = width - 2 * cover;
    
    // Required Ash (ACI 318-19 18.10.6.4(f))
    // Ash = 0.09 × s × bc × f'c / fyt
    const fyt = fy; // Assume same as longitudinal
    
    // Try spacings
    const spacings = [4, 5, 6];
    
    for (const s of spacings) {
      const Ash_1 = SPECIAL_SHEAR_WALL.Ash_factor_1 * s * bc1 * fc / fyt;
      const Ash_2 = SPECIAL_SHEAR_WALL.Ash_factor_1 * s * bc2 * fc / fyt;
      const Ash_req = Math.max(Ash_1, Ash_2);
      
      // Select bar and number of legs
      for (const legs of [4, 6]) {
        const Ash_prov = legs * REBAR_DATA_WALL['#4'].Ab;
        
        if (Ash_prov >= Ash_req) {
          return {
            Ash_req,
            size: '#4',
            spacing: s,
            legs,
          };
        }
      }
    }
    
    // Default
    return {
      Ash_req: 0.5,
      size: '#4',
      spacing: 4,
      legs: 6,
    };
  }
  
  /**
   * Check if seismic category requires special detailing
   */
  private isSpecialSeismicCategory(sdc: SeismicDesignCategory): boolean {
    return sdc === SeismicDesignCategory.SDC_D ||
           sdc === SeismicDesignCategory.SDC_E ||
           sdc === SeismicDesignCategory.SDC_F;
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
export function designShearWall(input: ShearWallInput): ShearWallResult {
  const calculator = new ShearWallCalculator(input);
  return calculator.design();
}
