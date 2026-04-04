/**
 * ============================================================================
 * PRESTRESSED CONCRETE DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive design of prestressed concrete members including:
 * - Pre-tensioned members (pretensioning before concrete placement)
 * - Post-tensioned members (tensioning after concrete hardening)
 * - Serviceability checks (stresses, deflection, cracking)
 * - Ultimate strength design
 * - Prestress loss calculations
 * - Tendon profile optimization
 * 
 * Design Codes:
 * - IS 1343:2012 - Prestressed Concrete
 * - ACI 318-19 Chapter 20, 21, 22
 * - EN 1992-1-1 (Eurocode 2)
 * - AASHTO LRFD Bridge Design
 * - PTI/ASBI Standards
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PrestressedSection {
  type: 'rectangular' | 'T-beam' | 'I-beam' | 'box' | 'voided-slab' | 'custom';
  // Rectangular/I/T section
  b?: number; // Width mm
  h: number; // Total depth mm
  bw?: number; // Web width mm
  tf?: number; // Top flange thickness mm
  bf_top?: number; // Top flange width mm
  bf_bot?: number; // Bottom flange width mm
  tf_bot?: number; // Bottom flange thickness mm
  // Box section
  wallThickness?: number; // mm
  voidDiameter?: number; // mm for voided slabs
  numVoids?: number;
  // Custom section
  area?: number; // mm²
  Ig?: number; // mm⁴
  yTop?: number; // mm from centroid to top
  yBot?: number; // mm from centroid to bottom
}

export interface ConcreteProperties {
  fck: number; // Characteristic compressive strength MPa
  fci: number; // Strength at transfer MPa
  Ec: number; // Modulus of elasticity MPa
  Eci?: number; // Modulus at transfer MPa
  gamma: number; // Unit weight kN/m³
  creepCoeff?: number; // Creep coefficient (default 2.0)
  shrinkage?: number; // Shrinkage strain (default 0.0003)
}

export interface TendonProperties {
  type: 'strand-7wire' | 'strand-compact' | 'wire' | 'bar';
  grade: string; // e.g., '1860', '1725', '1080'
  fpk: number; // Characteristic tensile strength MPa
  fp01k: number; // 0.1% proof stress MPa
  Ep: number; // Modulus of elasticity MPa
  relaxation: 'Class1-Normal' | 'Class2-Low';
  diameter: number; // mm
  area: number; // Area per strand/wire mm²
}

export interface TendonLayout {
  numTendons: number;
  areaTotal: number; // Total area mm²
  profile: 'straight' | 'parabolic' | 'harped' | 'draped' | 'mixed';
  eccentricity: {
    atEnd: number; // mm (positive = below centroid)
    atMid: number; // mm
    atQuarter?: number; // mm (for harped profiles)
  };
  deviators?: { location: number; angle: number }[];
  anchorage: {
    type: 'single-strand' | 'multi-strand' | 'flat-slab';
    stressing: 'one-end' | 'both-ends';
  };
}

export interface PostTensionDuct {
  type: 'metal-sheathed' | 'plastic' | 'unbonded';
  internalDiameter: number; // mm
  frictionCoeff: number; // μ
  wobble: number; // K (1/m)
}

export interface PrestressForce {
  P_jack: number; // Jacking force kN
  P_i: number; // Initial prestress (after immediate losses) kN
  P_e: number; // Effective prestress (after all losses) kN
}

export interface StressLimits {
  code: 'IS1343' | 'ACI318' | 'EN1992' | 'AASHTO';
  // At transfer (temporary)
  ftt: number; // Tension in top fiber MPa
  fct: number; // Compression in top fiber MPa
  ftb: number; // Tension in bottom fiber MPa
  fcb: number; // Compression in bottom fiber MPa
  // At service (permanent)
  fts: number; // Tension at service MPa
  fcs: number; // Compression at service MPa
}

export interface PrestressDesignResult {
  sectionProperties: {
    A: number;
    I: number;
    yTop: number;
    yBot: number;
    Zt: number;
    Zb: number;
    r2: number; // Radius of gyration squared
    kb: number; // Kern point bottom
    kt: number; // Kern point top
  };
  losses: {
    elastic: number;
    friction: number;
    anchorSlip: number;
    relaxation: number;
    creep: number;
    shrinkage: number;
    totalImmediate: number;
    totalTimeDependent: number;
    totalPercentage: number;
  };
  stresses: {
    transfer: {
      top: number;
      bottom: number;
      status: 'OK' | 'FAIL';
    };
    service: {
      top: number;
      bottom: number;
      status: 'OK' | 'FAIL';
    };
  };
  ultimateCapacity: {
    Mu: number; // kNm
    Vu: number; // kN
    capacity: number;
    demand: number;
    ratio: number;
  };
  deflections: {
    camber: number; // mm (upward positive)
    deadLoad: number; // mm
    liveLoad: number; // mm
    longTerm: number; // mm
    netDeflection: number; // mm
  };
  crackedMoment: number; // Mcr kNm
}

// ============================================================================
// STRESS LIMITS DATABASE
// ============================================================================

const STRESS_LIMITS = {
  IS1343: (fck: number, fci: number): StressLimits => ({
    code: 'IS1343',
    ftt: 0, // No tension at transfer (Type 1)
    fct: 0.5 * fci, // Compression at transfer
    ftb: 0, // No tension at transfer (Type 1)
    fcb: 0.5 * fci,
    fts: 0, // No tension at service (Type 1)
    fcs: 0.33 * fck
  }),
  
  ACI318: (fck: number, fci: number): StressLimits => ({
    code: 'ACI318',
    ftt: 0.25 * Math.sqrt(fci), // √f'ci / 4
    fct: 0.60 * fci,
    ftb: 0.50 * Math.sqrt(fci),
    fcb: 0.60 * fci,
    fts: 0.50 * Math.sqrt(fck), // Class U
    fcs: 0.45 * fck
  }),

  EN1992: (fck: number, fci: number): StressLimits => ({
    code: 'EN1992',
    ftt: Math.min(1.0, 0.03 * fci), // fctm
    fct: 0.6 * fci,
    ftb: Math.min(1.0, 0.03 * fci),
    fcb: 0.6 * fci,
    fts: 0, // No decompression (XC2, XC3)
    fcs: 0.6 * fck
  }),

  AASHTO: (fck: number, fci: number): StressLimits => {
    const fci_psi = fci * 145;
    const fck_psi = fck * 145;
    return {
      code: 'AASHTO',
      ftt: 0.0948 * Math.sqrt(fci_psi) / 145, // 3√f'ci ksi
      fct: 0.60 * fci,
      ftb: 0.19 * Math.sqrt(fci_psi) / 145, // 6√f'ci ksi
      fcb: 0.60 * fci,
      fts: 0.19 * Math.sqrt(fck_psi) / 145,
      fcs: 0.45 * fck
    };
  }
};

// ============================================================================
// SECTION PROPERTIES CALCULATOR
// ============================================================================

export class PrestressSectionCalculator {
  static calculateProperties(section: PrestressedSection): {
    A: number;
    I: number;
    yTop: number;
    yBot: number;
    Zt: number;
    Zb: number;
    r2: number;
    kb: number;
    kt: number;
  } {
    let A: number, I: number, yTop: number, yBot: number;

    switch (section.type) {
      case 'rectangular': {
        const b = section.b || 300;
        const h = section.h;
        A = b * h;
        I = b * h * h * h / 12;
        yTop = h / 2;
        yBot = h / 2;
        break;
      }

      case 'T-beam': {
        const bf = section.bf_top || section.b || 1000;
        const tf = section.tf || 150;
        const bw = section.bw || 300;
        const h = section.h;
        const hw = h - tf;

        // Areas
        const Af = bf * tf;
        const Aw = bw * hw;
        A = Af + Aw;

        // Centroid from bottom
        const yf = h - tf / 2;
        const yw = hw / 2;
        const yCG = (Af * yf + Aw * yw) / A;
        yBot = yCG;
        yTop = h - yCG;

        // Moment of inertia about centroid
        const If = bf * tf * tf * tf / 12 + Af * (yf - yCG) * (yf - yCG);
        const Iw = bw * hw * hw * hw / 12 + Aw * (yw - yCG) * (yw - yCG);
        I = If + Iw;
        break;
      }

      case 'I-beam': {
        const bf_top = section.bf_top || 500;
        const tf_top = section.tf || 100;
        const bf_bot = section.bf_bot || 500;
        const tf_bot = section.tf_bot || 100;
        const bw = section.bw || 200;
        const h = section.h;
        const hw = h - tf_top - tf_bot;

        // Areas
        const At = bf_top * tf_top;
        const Ab = bf_bot * tf_bot;
        const Aw = bw * hw;
        A = At + Ab + Aw;

        // Centroid from bottom
        const yt = h - tf_top / 2;
        const yb = tf_bot / 2;
        const yw = tf_bot + hw / 2;
        const yCG = (At * yt + Ab * yb + Aw * yw) / A;
        yBot = yCG;
        yTop = h - yCG;

        // Moment of inertia
        const It = bf_top * Math.pow(tf_top, 3) / 12 + At * Math.pow(yt - yCG, 2);
        const Ib = bf_bot * Math.pow(tf_bot, 3) / 12 + Ab * Math.pow(yb - yCG, 2);
        const Iw = bw * Math.pow(hw, 3) / 12 + Aw * Math.pow(yw - yCG, 2);
        I = It + Ib + Iw;
        break;
      }

      case 'box': {
        const b = section.b || 2000;
        const h = section.h;
        const t = section.wallThickness || 200;
        
        // Outer - Inner
        const Ao = b * h;
        const Ai = (b - 2 * t) * (h - 2 * t);
        A = Ao - Ai;

        const Io = b * h * h * h / 12;
        const Ii = (b - 2 * t) * Math.pow(h - 2 * t, 3) / 12;
        I = Io - Ii;

        yTop = h / 2;
        yBot = h / 2;
        break;
      }

      case 'voided-slab': {
        const b = section.b || 1200;
        const h = section.h;
        const d = section.voidDiameter || h - 100;
        const n = section.numVoids || 1;

        const Aslab = b * h;
        const Avoid = n * Math.PI * d * d / 4;
        A = Aslab - Avoid;

        const Islab = b * h * h * h / 12;
        const Ivoid = n * Math.PI * Math.pow(d, 4) / 64;
        I = Islab - Ivoid;

        yTop = h / 2;
        yBot = h / 2;
        break;
      }

      default:
        A = section.area || 100000;
        I = section.Ig || 1e10;
        yTop = section.yTop || section.h / 2;
        yBot = section.yBot || section.h / 2;
    }

    const Zt = I / yTop;
    const Zb = I / yBot;
    const r2 = I / A; // Radius of gyration squared
    const kb = r2 / yTop; // Kern point from centroid toward bottom
    const kt = r2 / yBot; // Kern point from centroid toward top

    return { A, I, yTop, yBot, Zt, Zb, r2, kb, kt };
  }
}

// ============================================================================
// PRESTRESS LOSS CALCULATOR
// ============================================================================

export class PrestressLossEngine {
  /**
   * Calculate all prestress losses
   */
  static calculateAllLosses(params: {
    P_jack: number; // kN
    Ap: number; // mm²
    section: PrestressedSection;
    concrete: ConcreteProperties;
    tendon: TendonProperties;
    layout: TendonLayout;
    duct?: PostTensionDuct;
    span: number; // m
    type: 'pretension' | 'post-tension';
  }): {
    elastic: number;
    friction: number;
    anchorSlip: number;
    relaxation: number;
    creep: number;
    shrinkage: number;
    totalImmediate: number;
    totalTimeDependent: number;
    totalPercentage: number;
    P_i: number;
    P_e: number;
  } {
    const { P_jack, Ap, section, concrete, tendon, layout, duct, span, type } = params;
    const sectionProps = PrestressSectionCalculator.calculateProperties(section);
    
    const fp_jack = (P_jack * 1000) / Ap; // Jacking stress MPa
    const e = layout.eccentricity.atMid;
    const L = span * 1000; // Convert to mm

    // 1. Elastic Shortening
    let elastic: number;
    const n = tendon.Ep / (concrete.Eci || concrete.Ec * 0.9);
    const fcp = (P_jack * 1000 / sectionProps.A) + 
                (P_jack * 1000 * e * e / sectionProps.I);
    
    if (type === 'pretension') {
      elastic = n * fcp;
    } else {
      // For post-tension, depends on stressing sequence
      elastic = 0.5 * n * fcp; // Average for sequential stressing
    }

    // 2. Friction Losses (Post-tension only)
    let friction = 0;
    if (type === 'post-tension' && duct) {
      const mu = duct.frictionCoeff;
      const k = duct.wobble;
      
      // For parabolic profile
      const alpha = 8 * Math.abs(layout.eccentricity.atMid - layout.eccentricity.atEnd) / L;
      friction = fp_jack * (1 - Math.exp(-(mu * alpha + k * span)));
    }

    // 3. Anchor Slip Loss (Post-tension only)
    let anchorSlip = 0;
    if (type === 'post-tension') {
      const slip = 6; // mm typical
      anchorSlip = tendon.Ep * slip / L;
      
      // Affected length for slip
      if (friction > 0) {
        const L_affected = Math.sqrt(tendon.Ep * slip * L / (P_jack * 1000 / Ap));
        if (L_affected < span * 1000 / 2) {
          anchorSlip = 2 * friction * L_affected / L;
        }
      }
    }

    // Initial prestress after immediate losses
    const immediateLosses = elastic + friction + anchorSlip;
    const fp_i = fp_jack - immediateLosses;
    const P_i = fp_i * Ap / 1000;

    // 4. Relaxation Loss
    const rho1000 = tendon.relaxation === 'Class2-Low' ? 0.025 : 0.08;
    const sigma_pi = fp_i / tendon.fpk;
    // IS 1343 / EN 1992 relaxation formula
    const relaxation = rho1000 * fp_i * (sigma_pi - 0.55) * 100 * 0.75;

    // 5. Creep Loss
    const phi = concrete.creepCoeff || 2.0;
    const creep = n * phi * fcp * 0.8; // Reduced for stress relaxation

    // 6. Shrinkage Loss
    const eps_cs = concrete.shrinkage || 0.0003;
    const shrinkage = tendon.Ep * eps_cs;

    // Time-dependent losses
    const timeDependentLosses = relaxation + creep + shrinkage;

    // Effective prestress
    const totalLoss = immediateLosses + timeDependentLosses;
    const fp_e = fp_jack - totalLoss;
    const P_e = fp_e * Ap / 1000;

    return {
      elastic,
      friction,
      anchorSlip,
      relaxation,
      creep,
      shrinkage,
      totalImmediate: immediateLosses,
      totalTimeDependent: timeDependentLosses,
      totalPercentage: (totalLoss / fp_jack) * 100,
      P_i,
      P_e
    };
  }
}

// ============================================================================
// STRESS CHECK ENGINE
// ============================================================================

export class PrestressStressChecker {
  /**
   * Check stresses at transfer and service
   */
  static checkStresses(params: {
    section: PrestressedSection;
    concrete: ConcreteProperties;
    P_i: number; // Initial prestress kN
    P_e: number; // Effective prestress kN
    eccentricity: number; // mm
    M_sw: number; // Self-weight moment kNm
    M_sd: number; // Superimposed dead load kNm
    M_ll: number; // Live load moment kNm
    code: 'IS1343' | 'ACI318' | 'EN1992' | 'AASHTO';
  }): {
    transfer: { top: number; bottom: number; status: 'OK' | 'FAIL'; details: string };
    service: { top: number; bottom: number; status: 'OK' | 'FAIL'; details: string };
    limits: StressLimits;
  } {
    const { section, concrete, P_i, P_e, eccentricity, M_sw, M_sd, M_ll, code } = params;
    const props = PrestressSectionCalculator.calculateProperties(section);
    const limits = STRESS_LIMITS[code](concrete.fck, concrete.fci);

    // Convert to consistent units (N, mm)
    const Pi = P_i * 1000; // N
    const Pe = P_e * 1000; // N
    const e = eccentricity; // mm
    const Msw = M_sw * 1e6; // Nmm
    const Msd = M_sd * 1e6; // Nmm
    const Mll = M_ll * 1e6; // Nmm

    // Stress at Transfer (P_i + Self-weight)
    // σ = P/A ± P.e/Z ± M/Z
    // Compression positive, tension negative (for this calculation)
    const ftransfer_top = Pi / props.A - (Pi * e) / props.Zt + Msw / props.Zt;
    const ftransfer_bot = Pi / props.A + (Pi * e) / props.Zb - Msw / props.Zb;

    // Stress at Service (P_e + All loads)
    const M_total = Msw + Msd + Mll;
    const fservice_top = Pe / props.A - (Pe * e) / props.Zt + M_total / props.Zt;
    const fservice_bot = Pe / props.A + (Pe * e) / props.Zb - M_total / props.Zb;

    // Check transfer stresses
    let transferStatus: 'OK' | 'FAIL' = 'OK';
    let transferDetails = '';
    
    if (ftransfer_top < -limits.ftt) {
      transferStatus = 'FAIL';
      transferDetails += `Top fiber tension ${(-ftransfer_top).toFixed(2)} MPa exceeds limit ${limits.ftt.toFixed(2)} MPa. `;
    }
    if (ftransfer_top > limits.fct) {
      transferStatus = 'FAIL';
      transferDetails += `Top fiber compression ${ftransfer_top.toFixed(2)} MPa exceeds limit ${limits.fct.toFixed(2)} MPa. `;
    }
    if (ftransfer_bot < -limits.ftb) {
      transferStatus = 'FAIL';
      transferDetails += `Bottom fiber tension ${(-ftransfer_bot).toFixed(2)} MPa exceeds limit ${limits.ftb.toFixed(2)} MPa. `;
    }
    if (ftransfer_bot > limits.fcb) {
      transferStatus = 'FAIL';
      transferDetails += `Bottom fiber compression ${ftransfer_bot.toFixed(2)} MPa exceeds limit ${limits.fcb.toFixed(2)} MPa. `;
    }

    if (transferStatus === 'OK') transferDetails = 'All stresses within limits';

    // Check service stresses
    let serviceStatus: 'OK' | 'FAIL' = 'OK';
    let serviceDetails = '';

    if (fservice_top < -limits.fts) {
      serviceStatus = 'FAIL';
      serviceDetails += `Top fiber tension ${(-fservice_top).toFixed(2)} MPa exceeds limit ${limits.fts.toFixed(2)} MPa. `;
    }
    if (fservice_top > limits.fcs) {
      serviceStatus = 'FAIL';
      serviceDetails += `Top fiber compression ${fservice_top.toFixed(2)} MPa exceeds limit ${limits.fcs.toFixed(2)} MPa. `;
    }
    if (fservice_bot < -limits.fts) {
      serviceStatus = 'FAIL';
      serviceDetails += `Bottom fiber tension ${(-fservice_bot).toFixed(2)} MPa exceeds limit ${limits.fts.toFixed(2)} MPa. `;
    }
    if (fservice_bot > limits.fcs) {
      serviceStatus = 'FAIL';
      serviceDetails += `Bottom fiber compression ${fservice_bot.toFixed(2)} MPa exceeds limit ${limits.fcs.toFixed(2)} MPa. `;
    }

    if (serviceStatus === 'OK') serviceDetails = 'All stresses within limits';

    return {
      transfer: {
        top: ftransfer_top,
        bottom: ftransfer_bot,
        status: transferStatus,
        details: transferDetails
      },
      service: {
        top: fservice_top,
        bottom: fservice_bot,
        status: serviceStatus,
        details: serviceDetails
      },
      limits
    };
  }
}

// ============================================================================
// ULTIMATE STRENGTH CALCULATOR
// ============================================================================

export class PrestressUltimateStrength {
  /**
   * Calculate ultimate flexural capacity
   */
  static calculateMu(params: {
    section: PrestressedSection;
    concrete: ConcreteProperties;
    tendon: TendonProperties;
    Ap: number; // mm²
    dp: number; // Depth to tendon centroid mm
    As?: number; // Non-prestressed reinforcement mm²
    d?: number; // Depth to non-prestressed steel mm
    code: 'IS1343' | 'ACI318' | 'EN1992';
  }): {
    Mu: number; // kNm
    fps: number; // Stress in tendon at ultimate MPa
    c: number; // Neutral axis depth mm
    a: number; // Equivalent stress block depth mm
    ductility: number; // c/dp ratio
    mode: 'tension-controlled' | 'compression-controlled' | 'transition';
  } {
    const { section, concrete, tendon, Ap, dp, As = 0, d = dp, code } = params;
    const props = PrestressSectionCalculator.calculateProperties(section);
    
    const fck = concrete.fck;
    const fpk = tendon.fpk;
    const fp01k = tendon.fp01k;
    const Ep = tendon.Ep;
    const fpe = 0.65 * fpk; // Assume effective prestress

    // Get stress block parameters
    let alpha: number, beta: number;
    if (code === 'ACI318') {
      alpha = 0.85;
      beta = fck <= 28 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * (fck - 28) / 7);
    } else {
      alpha = 0.67;
      beta = 0.8;
    }

    // Effective width at compression zone
    const b = section.bf_top || section.b || 1000;
    const bw = section.bw || b;

    // Iterative solution for neutral axis
    let c = dp * 0.3; // Initial guess
    const eps_cu = 0.0035;
    const eps_pe = fpe / Ep;

    for (let iter = 0; iter < 20; iter++) {
      // Strain compatibility
      const eps_ps = eps_cu * (dp - c) / c + eps_pe;
      
      // Stress in prestressing steel
      let fps: number;
      const eps_py = fp01k / Ep + 0.001;
      
      if (eps_ps < eps_py) {
        fps = eps_ps * Ep;
      } else {
        // Bilinear curve
        fps = fp01k + (fpk - fp01k) * (eps_ps - eps_py) / (0.01 - eps_py);
        fps = Math.min(fps, fpk);
      }

      // Compression block
      const a = beta * c;
      let Cc: number;
      
      if (a <= (section.tf || section.h)) {
        Cc = alpha * fck * b * a;
      } else {
        // T-beam with neutral axis in web
        const Ccf = alpha * fck * (b - bw) * (section.tf || 0);
        const Ccw = alpha * fck * bw * a;
        Cc = Ccf + Ccw;
      }

      // Tension force
      const Tp = Ap * fps;
      const Ts = As * (fck < 30 ? 415 : 500); // Assumed fy

      // Force equilibrium
      const Ttotal = Tp + Ts;
      const error = Math.abs(Cc - Ttotal) / Ttotal;

      if (error < 0.001) {
        // Calculate moment
        const a_calc = beta * c;
        let Mu: number;
        
        if (a_calc <= (section.tf || section.h)) {
          Mu = Tp * (dp - a_calc / 2) + Ts * (d - a_calc / 2);
        } else {
          const yf = (section.tf || 0) / 2;
          const yw = (a_calc + (section.tf || 0)) / 2;
          const Ccf = alpha * fck * (b - bw) * (section.tf || 0);
          const Ccw = alpha * fck * bw * (a_calc - (section.tf || 0));
          Mu = Tp * dp + Ts * d - Ccf * yf - Ccw * yw;
        }

        // Ductility check
        const ductility = c / dp;
        let mode: 'tension-controlled' | 'compression-controlled' | 'transition';
        if (ductility < 0.375) mode = 'tension-controlled';
        else if (ductility > 0.6) mode = 'compression-controlled';
        else mode = 'transition';

        return {
          Mu: Mu / 1e6, // Convert to kNm
          fps,
          c,
          a: a_calc,
          ductility,
          mode
        };
      }

      // Adjust neutral axis
      if (Cc > Ttotal) c *= 0.95;
      else c *= 1.05;
    }

    // Return approximate result if not converged
    return {
      Mu: 0,
      fps: fpe,
      c,
      a: beta * c,
      ductility: c / dp,
      mode: 'tension-controlled'
    };
  }

  /**
   * Calculate ultimate shear capacity
   */
  static calculateVu(params: {
    section: PrestressedSection;
    concrete: ConcreteProperties;
    P_e: number; // kN
    eccentricity: number; // mm
    d: number; // Effective depth mm
    Mu: number; // Factored moment at section kNm
    Vu: number; // Factored shear at section kN
    Av?: number; // Stirrup area mm²
    s?: number; // Stirrup spacing mm
    fyt?: number; // Stirrup yield strength MPa
    code: 'IS1343' | 'ACI318' | 'EN1992';
  }): {
    Vc: number; // Concrete contribution kN
    Vs: number; // Steel contribution kN
    Vn: number; // Total nominal shear kN
    phi_Vn: number; // Design shear capacity kN
    status: 'OK' | 'FAIL';
  } {
    const { section, concrete, P_e, eccentricity, d, Mu, Vu,
            Av = 0, s = 200, fyt = 415, code } = params;
    const props = PrestressSectionCalculator.calculateProperties(section);
    const bw = section.bw || section.b || 300;
    const fck = concrete.fck;

    let Vc: number;
    let phi: number;

    if (code === 'ACI318') {
      phi = 0.75;
      
      // ACI 318-19 Eq. 22.5.6.1
      const fc_sqrt = Math.sqrt(fck * 0.8); // f'c in psi equivalent
      const Vci = 0.05 * fc_sqrt * bw * d + P_e * 1000 * d / (4 * props.A) + 
                  Vu * d / Math.max(Mu, 1);
      const Vcw = (0.29 * fc_sqrt + 0.3 * P_e * 1000 / props.A) * bw * d;
      
      Vc = Math.min(Vci, Vcw) / 1000;
    } else if (code === 'EN1992') {
      phi = 1.0; // Partial factor in Vc calculation
      
      // EN 1992-1-1 Eq. 6.2
      const sigma_cp = Math.min(P_e * 1000 / props.A, 0.2 * fck);
      const k = Math.min(2.0, 1 + Math.sqrt(200 / d));
      const rho_l = 0.01; // Assume 1% reinforcement
      
      const V_Rdc = (0.12 * k * Math.pow(100 * rho_l * fck, 1/3) + 
                   0.15 * sigma_cp) * bw * d;
      const V_Rdcmin = (0.035 * Math.pow(k, 1.5) * Math.sqrt(fck) + 
                       0.15 * sigma_cp) * bw * d;
      
      Vc = Math.max(V_Rdc, V_Rdcmin) / 1000;
    } else {
      // IS 1343
      phi = 1.0;
      
      const tau_c = 0.37 * Math.sqrt(fck);
      const f_t = 0.24 * Math.sqrt(fck);
      const f_cp = P_e * 1000 / props.A;
      
      const Vcr = 0.67 * bw * d * Math.sqrt(tau_c * tau_c + 0.8 * f_cp * f_t);
      const Vco = bw * d * tau_c + 0.3 * P_e;
      
      Vc = Math.min(Vcr, Vco) / 1000;
    }

    // Steel contribution
    let Vs = 0;
    if (Av > 0 && s > 0) {
      Vs = Av * fyt * d / s / 1000;
    }

    const Vn = Vc + Vs;
    const phi_Vn = phi * Vn;
    const status = phi_Vn >= Vu ? 'OK' : 'FAIL';

    return { Vc, Vs, Vn, phi_Vn, status };
  }
}

// ============================================================================
// DEFLECTION CALCULATOR
// ============================================================================

export class PrestressDeflectionCalculator {
  /**
   * Calculate deflections and camber
   */
  static calculateDeflections(params: {
    section: PrestressedSection;
    concrete: ConcreteProperties;
    P_i: number; // kN
    P_e: number; // kN
    eccentricityMid: number; // mm
    eccentricityEnd: number; // mm
    span: number; // m
    w_sw: number; // Self-weight kN/m
    w_sd: number; // Superimposed dead kN/m
    w_ll: number; // Live load kN/m
    profile: 'parabolic' | 'straight';
  }): {
    camber: number; // mm (upward positive)
    deadLoad: number; // mm (downward positive)
    liveLoad: number; // mm
    longTerm: number; // mm (including creep/shrinkage)
    netDeflection: number; // mm
    limitL_span: number;
    status: 'OK' | 'EXCESSIVE';
  } {
    const { section, concrete, P_i, P_e, eccentricityMid, eccentricityEnd,
            span, w_sw, w_sd, w_ll, profile } = params;
    const props = PrestressSectionCalculator.calculateProperties(section);
    const L = span * 1000; // Convert to mm
    const Ec = concrete.Ec;
    const I = props.I;

    // Prestress camber (upward)
    let camberP_i: number;
    if (profile === 'parabolic') {
      // Parabolic profile: δ = P·e·L²/(8·E·I)
      camberP_i = P_i * 1000 * eccentricityMid * L * L / (8 * Ec * I);
    } else {
      // Straight profile: δ = P·e·L²/(8·E·I) for uniform moment
      const e_avg = (2 * eccentricityMid + eccentricityEnd) / 3;
      camberP_i = P_i * 1000 * e_avg * L * L / (8 * Ec * I);
    }

    // Self-weight deflection: δ = 5·w·L⁴/(384·E·I)
    const delta_sw = 5 * w_sw * Math.pow(L, 4) / (384 * Ec * I);

    // Initial camber (at transfer)
    const camber = camberP_i - delta_sw;

    // Superimposed dead load
    const delta_sd = 5 * w_sd * Math.pow(L, 4) / (384 * Ec * I);

    // Live load
    const delta_ll = 5 * w_ll * Math.pow(L, 4) / (384 * Ec * I);

    // Long-term effects (using P_e for long-term prestress)
    const phi = concrete.creepCoeff || 2.0;
    const camberP_e = P_e * 1000 * eccentricityMid * L * L / (8 * Ec * I);
    
    // Long-term camber reduced due to creep
    const camberLT = camberP_e * (1 + 0.5 * phi);
    
    // Long-term dead load increased due to creep
    const deltaSwLT = delta_sw * (1 + phi);
    const deltaSdLT = delta_sd * (1 + phi);

    // Net long-term deflection
    const longTerm = deltaSwLT + deltaSdLT - camberLT;
    const netDeflection = longTerm + delta_ll;

    // Deflection limits
    const limitL_span = L / 250; // Typical limit
    const status = Math.abs(netDeflection) <= limitL_span ? 'OK' : 'EXCESSIVE';

    return {
      camber,
      deadLoad: delta_sw + delta_sd,
      liveLoad: delta_ll,
      longTerm,
      netDeflection,
      limitL_span,
      status
    };
  }
}

// ============================================================================
// MAIN PRESTRESSED DESIGNER
// ============================================================================

export class PrestressedConcreteDesigner {
  private section: PrestressedSection;
  private concrete: ConcreteProperties;
  private tendon: TendonProperties;
  private layout: TendonLayout;
  private duct?: PostTensionDuct;
  private type: 'pretension' | 'post-tension';
  private code: 'IS1343' | 'ACI318' | 'EN1992' | 'AASHTO';

  constructor(config: {
    section: PrestressedSection;
    concrete: ConcreteProperties;
    tendon: TendonProperties;
    layout: TendonLayout;
    duct?: PostTensionDuct;
    type: 'pretension' | 'post-tension';
    code: 'IS1343' | 'ACI318' | 'EN1992' | 'AASHTO';
  }) {
    this.section = config.section;
    this.concrete = config.concrete;
    this.tendon = config.tendon;
    this.layout = config.layout;
    this.duct = config.duct;
    this.type = config.type;
    this.code = config.code;
  }

  /**
   * Complete design check
   */
  design(params: {
    span: number; // m
    P_jack: number; // kN
    w_sw?: number; // Self-weight kN/m (auto-calculated if not provided)
    w_sd: number; // Superimposed dead kN/m
    w_ll: number; // Live load kN/m
    M_u?: number; // Factored moment kNm (for ultimate check)
    V_u?: number; // Factored shear kN (for ultimate check)
  }): PrestressDesignResult {
    const { span, P_jack, w_sd, w_ll, M_u, V_u } = params;
    
    // Section properties
    const sectionProps = PrestressSectionCalculator.calculateProperties(this.section);
    
    // Self-weight
    const w_sw = params.w_sw || 
                 (sectionProps.A / 1e6) * this.concrete.gamma;

    // Service moments
    const M_sw = w_sw * span * span / 8;
    const M_sd = w_sd * span * span / 8;
    const M_ll = w_ll * span * span / 8;

    // Calculate losses
    const losses = PrestressLossEngine.calculateAllLosses({
      P_jack,
      Ap: this.layout.areaTotal,
      section: this.section,
      concrete: this.concrete,
      tendon: this.tendon,
      layout: this.layout,
      duct: this.duct,
      span,
      type: this.type
    });

    // Stress checks
    const stresses = PrestressStressChecker.checkStresses({
      section: this.section,
      concrete: this.concrete,
      P_i: losses.P_i,
      P_e: losses.P_e,
      eccentricity: this.layout.eccentricity.atMid,
      M_sw,
      M_sd,
      M_ll,
      code: this.code
    });

    // Ultimate capacity
    const dp = sectionProps.yBot + this.layout.eccentricity.atMid;
    const ultimate = PrestressUltimateStrength.calculateMu({
      section: this.section,
      concrete: this.concrete,
      tendon: this.tendon,
      Ap: this.layout.areaTotal,
      dp,
      code: this.code === 'AASHTO' ? 'ACI318' : this.code
    });

    // Factored moment demand (if not provided)
    const Mu_demand = M_u || 1.5 * (M_sw + M_sd) + 1.8 * M_ll;

    // Deflections
    const deflections = PrestressDeflectionCalculator.calculateDeflections({
      section: this.section,
      concrete: this.concrete,
      P_i: losses.P_i,
      P_e: losses.P_e,
      eccentricityMid: this.layout.eccentricity.atMid,
      eccentricityEnd: this.layout.eccentricity.atEnd,
      span,
      w_sw,
      w_sd,
      w_ll,
      profile: this.layout.profile === 'straight' ? 'straight' : 'parabolic'
    });

    // Cracking moment
    const fr = 0.7 * Math.sqrt(this.concrete.fck);
    const fpe = losses.P_e * 1000 / sectionProps.A;
    const Mcr = (fr + fpe + losses.P_e * 1000 * this.layout.eccentricity.atMid / sectionProps.Zb) * 
                sectionProps.Zb / 1e6;

    return {
      sectionProperties: sectionProps,
      losses: {
        elastic: losses.elastic,
        friction: losses.friction,
        anchorSlip: losses.anchorSlip,
        relaxation: losses.relaxation,
        creep: losses.creep,
        shrinkage: losses.shrinkage,
        totalImmediate: losses.totalImmediate,
        totalTimeDependent: losses.totalTimeDependent,
        totalPercentage: losses.totalPercentage
      },
      stresses: {
        transfer: stresses.transfer,
        service: stresses.service
      },
      ultimateCapacity: {
        Mu: ultimate.Mu,
        Vu: 0, // Calculate if needed
        capacity: ultimate.Mu,
        demand: Mu_demand,
        ratio: ultimate.Mu / Mu_demand
      },
      deflections: {
        camber: deflections.camber,
        deadLoad: deflections.deadLoad,
        liveLoad: deflections.liveLoad,
        longTerm: deflections.longTerm,
        netDeflection: deflections.netDeflection
      },
      crackedMoment: Mcr
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  PrestressSectionCalculator,
  PrestressLossEngine,
  PrestressStressChecker,
  PrestressUltimateStrength,
  PrestressDeflectionCalculator,
  PrestressedConcreteDesigner
};
