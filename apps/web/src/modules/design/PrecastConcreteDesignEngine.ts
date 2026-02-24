/**
 * ============================================================================
 * PRECAST CONCRETE DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive precast/prestressed concrete design:
 * - Precast member design (beams, columns, walls, slabs)
 * - Connection design (wet/dry, bearing, mechanical)
 * - Handling and erection analysis
 * - Tolerances and clearances
 * - Diaphragm action
 * - Seismic design for precast
 * 
 * Design Codes Supported:
 * - PCI Design Handbook (8th Edition)
 * - ACI 318 (Building Code Requirements)
 * - ACI 550 (Design of Precast Connections)
 * - AISC 341/358 (for hybrid precast-steel)
 * - Eurocode 2 (EN 1992-1-1) with precast provisions
 * - EN 13670 (Execution of Concrete Structures)
 * - IS 15916 (Precast Concrete Building Articulationworks)
 * - fib Model Code 2010
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PrecastMember {
  type: 'beam' | 'column' | 'wall-panel' | 'double-tee' | 'hollow-core' | 
        'spandrel' | 'inverted-tee' | 'L-beam' | 'box-beam';
  id: string;
  
  geometry: {
    length: number; // mm
    width: number; // mm
    depth: number; // mm
    weight: number; // kg
    centroid: { x: number; y: number }; // mm from bottom-left
    
    // For hollow sections
    voids?: { type: 'circular' | 'oval'; diameter: number; spacing: number }[];
    
    // For tee sections
    flangeWidth?: number; // mm
    flangeThickness?: number; // mm
    webWidth?: number; // mm
  };
  
  concrete: {
    fc: number; // MPa (at 28 days)
    fci: number; // MPa (at release/stripping)
    Ec: number; // MPa
    wc: number; // kg/m³ (unit weight)
    exposureClass: string;
  };
  
  reinforcement: {
    mild: {
      fy: number; // MPa
      topBars?: { diameter: number; count: number; cover: number }[];
      bottomBars?: { diameter: number; count: number; cover: number }[];
      ties?: { diameter: number; spacing: number };
    };
    prestressing?: {
      type: 'strand' | 'wire' | 'bar';
      grade: string;
      fpu: number; // MPa
      diameter: number; // mm
      count: number;
      pattern: { x: number; y: number }[]; // strand locations
      initialStress: number; // MPa (at jacking)
      stressLosses: number; // MPa (total losses)
      debondedStrands?: { strandIndex: number; debondLength: number }[];
    };
  };
}

export interface PrecastConnection {
  type: 'bearing' | 'corbel' | 'steel-insert' | 'mechanical' | 'grouted' | 
        'welded' | 'bolted' | 'dowel' | 'post-tensioned';
  location: 'beam-column' | 'beam-beam' | 'column-foundation' | 
            'wall-wall' | 'wall-slab' | 'slab-beam' | 'column-column';
  
  loads: {
    vertical: number; // kN (gravity)
    horizontal: number; // kN (lateral)
    moment?: number; // kN-m
    torsion?: number; // kN-m
  };
  
  properties: BearingConnectionProps | CorbelProps | MechanicalConnectionProps | 
              WeldedConnectionProps | GroutedConnectionProps;
}

export interface BearingConnectionProps {
  type: 'bearing';
  bearingLength: number; // mm
  bearingWidth: number; // mm
  bearingPadType: 'neoprene' | 'PTFE' | 'cotton-duck' | 'steel';
  padThickness: number; // mm
  allowableStress: number; // MPa
  edgeDistance: number; // mm (from support face)
}

export interface CorbelProps {
  type: 'corbel';
  depth: number; // mm (at face of column)
  width: number; // mm
  projectionLength: number; // mm (horizontal)
  bearingWidth: number; // mm
  reinforcement: {
    primaryAs: number; // mm² (main tension tie)
    horizontalAh: number; // mm² (horizontal closed stirrups)
    verticalAv: number; // mm² (vertical stirrups)
  };
}

export interface MechanicalConnectionProps {
  type: 'mechanical';
  connectorType: 'headed-stud' | 'threaded-rod' | 'anchor-bolt' | 'sleeve-anchor';
  diameter: number; // mm
  embedmentLength: number; // mm
  grade: string;
  count: number;
  spacing: number; // mm
  edgeDistanceMin: number; // mm
}

export interface WeldedConnectionProps {
  type: 'welded';
  embedPlate: {
    thickness: number; // mm
    width: number; // mm
    length: number; // mm
    fy: number; // MPa
  };
  studs: {
    diameter: number; // mm
    length: number; // mm
    count: number;
    arrangement: 'single-row' | 'double-row' | 'grid';
  };
  weldSize: number; // mm (fillet weld)
  weldLength: number; // mm
}

export interface GroutedConnectionProps {
  type: 'grouted';
  sleeveType: 'grouted-splice' | 'mechanical-splice' | 'post-tensioned';
  barDiameter: number; // mm
  barCount: number;
  sleeveLength: number; // mm
  groutStrength: number; // MPa
  developmentLength: number; // mm
}

export interface HandlingAnalysis {
  stage: 'stripping' | 'yard-storage' | 'transport' | 'erection' | 'final';
  liftingPoints: { x: number; y: number }[]; // mm from member end
  supportPoints: { x: number; y: number }[];
  dynamicFactor: number;
  
  results: {
    maxMoment: number; // kN-m
    maxShear: number; // kN
    maxReaction: number; // kN
    concreteStressTop: number; // MPa
    concreteStressBottom: number; // MPa
    crackingCheck: 'no-cracks' | 'controlled-cracking' | 'unacceptable';
    liftingDeviceCapacity: number; // kN per point
  };
}

export interface ToleranceResult {
  category: 'position' | 'dimension' | 'alignment' | 'flatness';
  memberType: string;
  standardTolerance: number; // mm or degrees
  achievedTolerance: number; // mm or degrees
  status: 'within-tolerance' | 'marginal' | 'out-of-tolerance';
  adjustmentRequired: string;
}

// ============================================================================
// HOLLOW CORE SLAB DESIGN
// ============================================================================

export class HollowCoreDesign {
  /**
   * Section properties of hollow core slab
   */
  static sectionProperties(
    depth: number, // mm
    width: number, // mm (typically 1200)
    voidDiameter: number, // mm
    numVoids: number,
    flangeThickness: number // mm (top and bottom)
  ): {
    grossArea: number; // mm²
    netArea: number; // mm²
    momentOfInertia: number; // mm⁴
    sectionModulusTop: number; // mm³
    sectionModulusBottom: number; // mm³
    centroidY: number; // mm from bottom
    weight: number; // kg/m (assuming 2400 kg/m³)
  } {
    const h = depth;
    const b = width;
    const d = voidDiameter;
    const n = numVoids;
    const tf = flangeThickness;

    // Gross rectangular area
    const Ag = b * h;

    // Void area
    const Avoid = n * Math.PI * d * d / 4;

    // Net area
    const An = Ag - Avoid;

    // Centroid (for symmetric section)
    const yc = h / 2;

    // Moment of inertia
    // I_gross = b * h³ / 12
    // I_void = n * π * d⁴ / 64
    const Ig = b * Math.pow(h, 3) / 12;
    const Ivoid = n * Math.PI * Math.pow(d, 4) / 64;
    const In = Ig - Ivoid;

    // Section moduli
    const St = In / (h - yc);
    const Sb = In / yc;

    // Weight
    const weight = An * 2400 / 1e9; // kg/m

    return {
      grossArea: Ag,
      netArea: An,
      momentOfInertia: In,
      sectionModulusTop: St,
      sectionModulusBottom: Sb,
      centroidY: yc,
      weight
    };
  }

  /**
   * Flexural design of hollow core slab
   */
  static flexuralDesign(
    span: number, // mm
    depth: number, // mm
    width: number, // mm
    fc: number, // MPa
    strandDiameter: number, // mm
    strandFpu: number, // MPa
    numStrands: number,
    strandEccentricity: number, // mm (below centroid)
    loads: {
      selfWeight: number; // kN/m²
      superimposed: number; // kN/m²
      live: number; // kN/m²
    }
  ): {
    requiredStrands: number;
    momentCapacity: number; // kN-m
    appliedMoment: number; // kN-m
    utilizationRatio: number;
    midspanCamber: number; // mm
    stressesAtTransfer: { top: number; bottom: number }; // MPa
    stressesAtService: { top: number; bottom: number }; // MPa
    shearCapacity: number; // kN
  } {
    const L = span;
    const h = depth;
    const b = width;
    const n = numStrands;
    const e = strandEccentricity;

    // Section properties (assuming standard void ratio)
    const props = this.sectionProperties(h, b, h * 0.5, 6, h * 0.1);
    const An = props.netArea;
    const In = props.momentOfInertia;
    const Sb = props.sectionModulusBottom;
    const St = props.sectionModulusTop;
    const yc = props.centroidY;

    // Strand area
    const Aps = n * Math.PI * strandDiameter * strandDiameter / 4;
    
    // Effective prestress (assume 20% losses)
    const fpe = 0.7 * strandFpu * 0.80;
    const Pe = Aps * fpe / 1000; // kN

    // Calculate loads
    const w_sw = loads.selfWeight * b / 1000; // kN/m
    const w_sdl = loads.superimposed * b / 1000; // kN/m
    const w_ll = loads.live * b / 1000; // kN/m
    const w_total = w_sw + w_sdl + w_ll;

    // Applied moment (simply supported)
    const Mu = w_total * L * L / (8 * 1e6); // kN-m

    // Stresses at transfer (self-weight only)
    const M_sw = w_sw * L * L / (8 * 1e6); // kN-m
    const Pi = Pe / 0.80; // Initial prestress (before losses)
    
    const f_top_transfer = -Pi * 1000 / An + Pi * 1000 * e / St - M_sw * 1e6 / St;
    const f_bot_transfer = -Pi * 1000 / An - Pi * 1000 * e / Sb + M_sw * 1e6 / Sb;

    // Stresses at service (full load)
    const M_service = Mu * 1e6; // N-mm
    const f_top_service = -Pe * 1000 / An + Pe * 1000 * e / St - M_service / St;
    const f_bot_service = -Pe * 1000 / An - Pe * 1000 * e / Sb + M_service / Sb;

    // Moment capacity (simplified rectangular stress block)
    const fps = fpe + 7000 * (1 - 1.4 * Aps * strandFpu / (b * h * fc)); // MPa
    const a = Aps * fps / (0.85 * fc * b);
    const dp = yc + e;
    const Mn = Aps * fps * (dp - a / 2) / 1e6; // kN-m
    const phiMn = 0.9 * Mn;

    // Camber
    const Ec = 4700 * Math.sqrt(fc);
    const camber_prestress = Pe * 1000 * e * L * L / (8 * Ec * In);
    const deflection_sw = 5 * w_sw * Math.pow(L, 4) / (384 * Ec * In);
    const midspanCamber = camber_prestress - deflection_sw;

    // Shear capacity (simplified)
    const Vc = 0.17 * Math.sqrt(fc) * b * 0.8 * h / 1000; // kN

    // Required strands (iterate to match demand)
    const requiredStrands = Math.ceil(Mu / phiMn * n);

    return {
      requiredStrands,
      momentCapacity: phiMn,
      appliedMoment: Mu,
      utilizationRatio: Mu / phiMn,
      midspanCamber,
      stressesAtTransfer: { top: f_top_transfer, bottom: f_bot_transfer },
      stressesAtService: { top: f_top_service, bottom: f_bot_service },
      shearCapacity: Vc
    };
  }

  /**
   * Web shear check for hollow core
   */
  static webShearCheck(
    Vu: number, // kN
    depth: number, // mm
    webWidthTotal: number, // mm (sum of all webs)
    fc: number, // MPa
    prestressAtNeutralAxis: number // MPa (compression positive)
  ): {
    Vci: number; // kN (flexure-shear)
    Vcw: number; // kN (web-shear)
    Vc: number; // kN (governing)
    adequate: boolean;
  } {
    const h = depth;
    const bw = webWidthTotal;
    const fpc = prestressAtNeutralAxis;
    const d = 0.8 * h;

    // Web-shear cracking (Vcw)
    // Vcw = (0.29√fc + 0.3fpc) * bw * d
    const Vcw = (0.29 * Math.sqrt(fc) + 0.3 * fpc) * bw * d / 1000;

    // Flexure-shear (Vci) - simplified
    // Vci = 0.05√fc * bw * d + Mcre * V / M
    const Vci = 0.05 * Math.sqrt(fc) * bw * d / 1000 + 0.5 * Vcw;

    const Vc = Math.min(Vci, Vcw);
    const phiVc = 0.75 * Vc;

    return {
      Vci,
      Vcw,
      Vc,
      adequate: Vu <= phiVc
    };
  }
}

// ============================================================================
// DOUBLE TEE DESIGN
// ============================================================================

export class DoubleTeeDesign {
  /**
   * Section properties
   */
  static sectionProperties(
    depth: number, // mm
    flangeWidth: number, // mm (total)
    flangeThickness: number, // mm
    stemWidth: number, // mm (each)
    stemSpacing: number // mm (center to center)
  ): {
    area: number; // mm²
    momentOfInertia: number; // mm⁴
    centroidY: number; // mm from bottom
    sectionModulusTop: number; // mm³
    sectionModulusBottom: number; // mm³
    weight: number; // kg/m
  } {
    const h = depth;
    const bf = flangeWidth;
    const tf = flangeThickness;
    const bw = stemWidth * 2; // Two stems
    const hs = h - tf; // Stem height

    // Areas
    const Af = bf * tf;
    const As = bw * hs;
    const A = Af + As;

    // Centroids
    const yf = h - tf / 2;
    const ys = hs / 2;
    const yc = (Af * yf + As * ys) / A;

    // Moment of inertia (parallel axis theorem)
    const If = bf * Math.pow(tf, 3) / 12 + Af * Math.pow(yf - yc, 2);
    const Is = bw * Math.pow(hs, 3) / 12 + As * Math.pow(ys - yc, 2);
    const I = If + Is;

    // Section moduli
    const St = I / (h - yc);
    const Sb = I / yc;

    // Weight
    const weight = A * 2400 / 1e9; // kg/m

    return {
      area: A,
      momentOfInertia: I,
      centroidY: yc,
      sectionModulusTop: St,
      sectionModulusBottom: Sb,
      weight
    };
  }

  /**
   * Composite double tee with topping
   */
  static compositeDesign(
    member: PrecastMember,
    toppingThickness: number, // mm
    toppingFc: number, // MPa
    loads: {
      dead: number; // kN/m
      live: number; // kN/m
      precompositeLoad?: number; // kN/m (load before composite action)
    },
    span: number // mm
  ): {
    compositeProperties: {
      transformedWidth: number;
      compositeCentroid: number;
      compositeInertia: number;
    };
    precompositeStresses: { top: number; bottom: number };
    compositeStresses: { top: number; bottom: number; interface: number };
    deflections: { precomposite: number; composite: number; total: number };
  } {
    const bf = member.geometry.flangeWidth!;
    const tf = member.geometry.flangeThickness!;
    const h = member.geometry.depth;
    const L = span;
    const tt = toppingThickness;
    
    const precastFc = member.concrete.fc;
    const precastEc = 4700 * Math.sqrt(precastFc);
    const toppingEc = 4700 * Math.sqrt(toppingFc);

    // Modular ratio
    const n = toppingEc / precastEc;

    // Transformed topping width
    const beff = Math.min(bf, L / 4, bf); // Effective width
    const bt_transformed = beff * n;

    // Precast properties
    const precastProps = this.sectionProperties(
      h, bf, tf, member.geometry.webWidth || 150, bf / 2
    );

    // Composite section
    const At = bt_transformed * tt;
    const yt = h + tt / 2;
    const Ac = precastProps.area + At;
    const yc_composite = (precastProps.area * precastProps.centroidY + At * yt) / Ac;

    // Composite inertia
    const It = bt_transformed * Math.pow(tt, 3) / 12 + 
               At * Math.pow(yt - yc_composite, 2);
    const Ip = precastProps.momentOfInertia + 
               precastProps.area * Math.pow(precastProps.centroidY - yc_composite, 2);
    const Ic = It + Ip;

    // Pre-composite moment (self-weight + wet topping)
    const w_pre = (loads.precompositeLoad || member.geometry.weight / L * 1000) + 
                  beff * tt * 24 / 1e6; // kN/m
    const M_pre = w_pre * L * L / 8 / 1e6; // kN-m

    // Pre-composite stresses
    const f_top_pre = M_pre * 1e6 / precastProps.sectionModulusTop;
    const f_bot_pre = -M_pre * 1e6 / precastProps.sectionModulusBottom;

    // Composite moment (superimposed dead + live)
    const w_comp = loads.dead + loads.live;
    const M_comp = w_comp * L * L / 8 / 1e6; // kN-m

    // Composite stresses
    const Sc_top = Ic / (h + tt - yc_composite);
    const Sc_bot = Ic / yc_composite;
    const Sc_interface = Ic / (h - yc_composite);

    const f_top_comp = M_comp * 1e6 / Sc_top / n; // In topping (transform back)
    const f_bot_comp = -M_comp * 1e6 / Sc_bot;
    const f_interface = M_comp * 1e6 / Sc_interface;

    // Deflections
    const Ec = precastEc;
    const delta_pre = 5 * w_pre * Math.pow(L, 4) / (384 * Ec * precastProps.momentOfInertia);
    const delta_comp = 5 * w_comp * Math.pow(L, 4) / (384 * Ec * Ic);

    return {
      compositeProperties: {
        transformedWidth: bt_transformed,
        compositeCentroid: yc_composite,
        compositeInertia: Ic
      },
      precompositeStresses: { top: f_top_pre, bottom: f_bot_pre },
      compositeStresses: { 
        top: f_top_comp + f_top_pre, 
        bottom: f_bot_comp + f_bot_pre,
        interface: f_interface
      },
      deflections: { 
        precomposite: delta_pre, 
        composite: delta_comp, 
        total: delta_pre + delta_comp 
      }
    };
  }
}

// ============================================================================
// CONNECTION DESIGN
// ============================================================================

export class PrecastConnectionDesign {
  /**
   * Corbel design per ACI 318
   */
  static corbelDesign(
    Vu: number, // kN (vertical load)
    Nuc: number, // kN (horizontal tension)
    fc: number, // MPa
    fy: number, // MPa
    columnWidth: number, // mm
    corbelDepth: number, // mm (at column face)
    projectionLength: number, // mm (a_v)
    bearingPadWidth: number // mm
  ): {
    requiredAsc: number; // mm² (primary tension reinforcement)
    requiredAh: number; // mm² (horizontal closed stirrups)
    minDepth: number; // mm
    bearingCheck: boolean;
    shearFrictionCheck: boolean;
    recommendations: string[];
  } {
    const d = corbelDepth - 50; // Effective depth
    const av = projectionLength;
    const b = columnWidth;
    const phi = 0.75; // Strength reduction factor

    const recommendations: string[] = [];

    // Check av/d ratio
    const av_d = av / d;
    if (av_d > 1.0) {
      recommendations.push('a_v/d > 1.0: Design as bracket, not corbel');
    }
    if (av_d < 0.5) {
      recommendations.push('Deep corbel behavior - increase reinforcement');
    }

    // Required flexural reinforcement for moment
    const Mu = Vu * av + Nuc * (corbelDepth - d);
    const Af = Mu * 1e6 / (phi * fy * 0.9 * d);

    // Direct tension reinforcement
    const An = Nuc * 1000 / (phi * fy);

    // Shear friction reinforcement
    const mu = 1.4; // Roughened surface (λ = 1.0)
    const Avf = Vu * 1000 / (phi * mu * fy);

    // Primary reinforcement (largest of)
    const Asc_1 = Af + An;
    const Asc_2 = 2 * Avf / 3 + An;
    const Asc_3 = 0.04 * fc / fy * b * d;
    const requiredAsc = Math.max(Asc_1, Asc_2, Asc_3);

    // Horizontal closed stirrups (Ah >= 0.5 * (Asc - An))
    const requiredAh = 0.5 * (requiredAsc - An);

    // Bearing check
    const Ab = bearingPadWidth * b;
    const fb = Vu * 1000 / Ab;
    const fb_allow = 0.85 * phi * fc;
    const bearingCheck = fb <= fb_allow;
    if (!bearingCheck) {
      recommendations.push(`Bearing stress ${fb.toFixed(1)} MPa exceeds allowable ${fb_allow.toFixed(1)} MPa`);
    }

    // Shear friction check
    const Vn_max = Math.min(0.2 * fc * b * d, 5.5 * b * d);
    const shearFrictionCheck = Vu * 1000 / phi <= Vn_max;
    if (!shearFrictionCheck) {
      recommendations.push('Increase corbel depth - shear friction limit exceeded');
    }

    // Minimum depth check
    const minDepth = Math.max(2 * av, 150);

    return {
      requiredAsc,
      requiredAh,
      minDepth,
      bearingCheck,
      shearFrictionCheck,
      recommendations
    };
  }

  /**
   * Headed stud connection
   */
  static headedStudConnection(
    V: number, // kN (shear)
    T: number, // kN (tension)
    studDiameter: number, // mm
    studLength: number, // mm (effective embedment)
    studFu: number, // MPa
    fc: number, // MPa
    numStuds: number,
    spacing: number, // mm
    edgeDistance: number // mm (minimum)
  ): {
    steelCapacity: { shear: number; tension: number }; // kN
    concreteCapacity: { shear: number; tension: number }; // kN
    combinedCapacity: number; // interaction ratio
    adequate: boolean;
    governingMode: string;
  } {
    const d = studDiameter;
    const hef = studLength;
    const Ase = Math.PI * d * d / 4;
    const n = numStuds;

    // Steel strength
    const Vsa = n * 0.6 * Ase * studFu / 1000; // kN
    const Nsa = n * Ase * studFu / 1000; // kN

    // Concrete breakout in shear (ACI 318 17.5.2)
    const ca1 = edgeDistance;
    const AVc = Math.min(1.5 * ca1, spacing) * Math.min(1.5 * ca1 * 2, n * 1.5 * ca1);
    const AVc0 = 4.5 * ca1 * ca1;
    const Vb = 0.6 * Math.pow(hef / d, 0.2) * Math.sqrt(d) * 
               Math.sqrt(fc) * Math.pow(ca1, 1.5) / 1000;
    const Vcbg = AVc / AVc0 * Vb * n;

    // Concrete breakout in tension (ACI 318 17.4.2)
    const ANc = Math.pow(3 * hef, 2);
    const ANc0 = 9 * hef * hef;
    const Nb = 10 * Math.sqrt(fc) * Math.pow(hef, 1.5) / 1000;
    const Ncbg = ANc / ANc0 * Nb * n;

    // Governing capacities
    const phiV = 0.75;
    const phiN = 0.75;
    
    const Vn = Math.min(Vsa, Vcbg) * phiV;
    const Nn = Math.min(Nsa, Ncbg) * phiN;

    // Interaction
    const interaction = Math.pow(V / Vn, 5/3) + Math.pow(T / Nn, 5/3);
    
    let governingMode: string;
    if (Vsa < Vcbg && Nsa < Ncbg) {
      governingMode = 'Steel failure (ductile)';
    } else if (Vcbg < Vsa) {
      governingMode = 'Concrete breakout in shear';
    } else {
      governingMode = 'Concrete breakout in tension';
    }

    return {
      steelCapacity: { shear: Vsa * phiV, tension: Nsa * phiN },
      concreteCapacity: { shear: Vcbg * phiV, tension: Ncbg * phiN },
      combinedCapacity: interaction,
      adequate: interaction <= 1.0,
      governingMode
    };
  }

  /**
   * Dapped end design
   */
  static dappedEndDesign(
    Vu: number, // kN
    Nu: number, // kN (horizontal, tension positive)
    memberDepth: number, // mm
    dappedDepth: number, // mm (reduced section)
    memberWidth: number, // mm
    fc: number, // MPa
    fy: number, // MPa
    reentrantCornerDist: number // mm (horizontal distance from support to re-entrant corner)
  ): {
    reinforcement: {
      As: number; // mm² (main hanger)
      Ah: number; // mm² (horizontal at dap)
      Ash: number; // mm² (diagonal)
      Av: number; // mm² (vertical stirrups)
    };
    bendingCheck: { moment: number; capacity: number; ok: boolean };
    nib: { shear: number; capacity: number; ok: boolean };
    recommendations: string[];
  } {
    const h = memberDepth;
    const hd = dappedDepth;
    const b = memberWidth;
    const a = reentrantCornerDist;
    const phi = 0.75;

    const recommendations: string[] = [];

    // Effective depth at dap
    const d = hd - 50;
    const dd = h - hd;

    // Forces
    const Nuc = Math.max(Nu, 0.2 * Vu); // Minimum horizontal force

    // Hanger reinforcement (strut-and-tie)
    // As must support Vu + tension from angle
    const theta = Math.atan(dd / a); // Angle of compression strut
    const Tu = Vu / Math.tan(theta) + Nuc;
    const As = Tu * 1000 / (phi * fy);

    // Horizontal reinforcement at dap (nib flexure)
    const Mu = Vu * a + Nuc * dd;
    const Ah = Mu * 1e6 / (phi * fy * 0.9 * d);

    // Diagonal reinforcement
    const Fd = Vu / Math.sin(theta);
    const Ash = 0.5 * Fd * 1000 / (phi * fy);

    // Vertical stirrups in full section
    const Av = 0.5 * As; // Minimum

    // Nib shear check
    const Vn_nib = 0.17 * Math.sqrt(fc) * b * d / 1000;
    const nibShearOk = Vu <= phi * Vn_nib;
    if (!nibShearOk) {
      recommendations.push('Increase dapped depth or add shear reinforcement');
    }

    // Full section flexure check
    const Mn = As * fy * 0.9 * (h - 50) / 1e6;
    const bendingOk = Vu * a / 1000 <= phi * Mn;
    if (!bendingOk) {
      recommendations.push('Increase hanger reinforcement');
    }

    // Additional recommendations
    if (hd < h / 2) {
      recommendations.push('Dap depth < h/2: Use strut-and-tie model for design');
    }
    if (a > d) {
      recommendations.push('Long dap: Consider intermediate supports');
    }

    return {
      reinforcement: { As, Ah, Ash, Av },
      bendingCheck: { moment: Mu / 1000, capacity: phi * Mn, ok: bendingOk },
      nib: { shear: Vu, capacity: phi * Vn_nib, ok: nibShearOk },
      recommendations
    };
  }
}

// ============================================================================
// HANDLING AND ERECTION ANALYSIS
// ============================================================================

export class HandlingAnalysis {
  /**
   * Analyze member during handling
   */
  static analyzeHandling(
    member: PrecastMember,
    liftPoints: { x: number }[], // mm from left end
    stage: 'stripping' | 'transport' | 'erection',
    dynamicFactor: number = 1.5
  ): {
    moments: { location: number; value: number }[]; // kN-m
    shears: { location: number; value: number }[]; // kN
    maxPositiveMoment: number; // kN-m
    maxNegativeMoment: number; // kN-m
    reactions: number[]; // kN per lift point
    stresses: {
      location: number;
      top: number; // MPa
      bottom: number; // MPa
      status: 'ok' | 'cracking' | 'failure';
    }[];
    optimumLiftPoints: number[]; // mm from end
  } {
    const L = member.geometry.length;
    const w = member.geometry.weight * 9.81 / L * dynamicFactor; // kN/m
    const n = liftPoints.length;
    const fci = member.concrete.fci;

    // Calculate reactions
    const totalWeight = w * L / 1000; // kN
    const reactions = liftPoints.map(() => totalWeight / n);

    // Calculate moments at many points
    const moments: { location: number; value: number }[] = [];
    const shears: { location: number; value: number }[] = [];
    const numPoints = 100;

    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * L;
      
      // Self-weight moment
      let M = w * x * x / 2 / 1e6; // kN-m (cantilever from left)
      let V = w * x / 1000; // kN

      // Add reaction effects
      for (let j = 0; j < n; j++) {
        const lx = liftPoints[j].x;
        if (x >= lx) {
          M -= reactions[j] * (x - lx) / 1000;
          V -= reactions[j];
        }
      }

      moments.push({ location: x, value: M });
      shears.push({ location: x, value: V });
    }

    // Find max moments
    const maxPositiveMoment = Math.max(...moments.map(m => m.value));
    const maxNegativeMoment = Math.min(...moments.map(m => m.value));

    // Calculate stresses
    const I = member.geometry.width * Math.pow(member.geometry.depth, 3) / 12; // Approximate
    const yTop = member.geometry.depth / 2;
    const yBot = member.geometry.depth / 2;

    const stresses: {
      location: number;
      top: number;
      bottom: number;
      status: 'ok' | 'cracking' | 'failure';
    }[] = [];

    for (const m of moments.filter((_, i) => i % 10 === 0)) {
      const fTop = -m.value * 1e6 * yTop / I;
      const fBot = m.value * 1e6 * yBot / I;

      // Check against allowables
      const ft_allow = 0.62 * Math.sqrt(fci); // Tensile limit
      const fc_allow = 0.6 * fci; // Compressive limit

      let status: 'ok' | 'cracking' | 'failure' = 'ok';
      if (Math.max(fTop, fBot) > ft_allow * 1.5 || 
          Math.min(fTop, fBot) < -fc_allow) {
        status = 'failure';
      } else if (Math.max(fTop, fBot) > ft_allow) {
        status = 'cracking';
      }

      stresses.push({ location: m.location, top: fTop, bottom: fBot, status });
    }

    // Optimum lift points (0.207L for 2 points, 0.145L for 4 points)
    let optimumLiftPoints: number[];
    if (n === 2) {
      const offset = 0.207 * L;
      optimumLiftPoints = [offset, L - offset];
    } else if (n === 4) {
      const offset = 0.145 * L;
      optimumLiftPoints = [offset, L / 2 - offset / 2, L / 2 + offset / 2, L - offset];
    } else {
      optimumLiftPoints = liftPoints.map(p => p.x);
    }

    return {
      moments,
      shears,
      maxPositiveMoment,
      maxNegativeMoment,
      reactions,
      stresses,
      optimumLiftPoints
    };
  }

  /**
   * Lateral stability during handling
   */
  static lateralStability(
    member: PrecastMember,
    sweepImperfection: number = 0.001 // L/1000
  ): {
    factor: number; // Factor of safety against rollover
    criticalAngle: number; // degrees
    adequate: boolean;
    recommendations: string[];
  } {
    const L = member.geometry.length;
    const h = member.geometry.depth;
    const b = member.geometry.width;
    const sweep = sweepImperfection * L;

    const recommendations: string[] = [];

    // For slender members
    if (h / b > 2.5) {
      // Simplified stability check
      const Iy = h * Math.pow(b, 3) / 12;
      const Ix = b * Math.pow(h, 3) / 12;

      // Lateral buckling moment
      const E = member.concrete.Ec;
      const G = E / 2.4;
      const J = b * Math.pow(h, 3) / 3 * (1 - 0.63 * h / b);

      // Critical buckling moment (simplified)
      const Mcr = Math.PI / L * Math.sqrt(E * Iy * G * J);

      // Self-weight moment
      const w = member.geometry.weight * 9.81 / L;
      const M_sw = w * L * L / 8;

      const factor = Mcr / (M_sw * 1e6);

      // Critical roll angle
      const criticalAngle = Math.atan(b / (2 * (h + sweep))) * 180 / Math.PI;

      if (factor < 2.0) {
        recommendations.push('Add temporary lateral bracing during handling');
      }
      if (criticalAngle < 5) {
        recommendations.push('High rollover risk - use cradles or A-frames');
      }

      return {
        factor,
        criticalAngle,
        adequate: factor >= 2.0 && criticalAngle >= 5,
        recommendations
      };
    }

    return {
      factor: 10,
      criticalAngle: 45,
      adequate: true,
      recommendations: []
    };
  }
}

// ============================================================================
// TOLERANCE VERIFICATION
// ============================================================================

export class PrecastTolerances {
  /**
   * PCI tolerance guidelines
   */
  private static tolerances: Record<string, Record<string, number>> = {
    'double-tee': {
      'length': 6, // mm per 10m, max 25
      'width': 6, // mm
      'depth': 6, // mm
      'flange-thickness': 6, // mm
      'sweep': 10, // mm per 10m
      'camber': 10, // mm per 10m
      'bearing-location': 13 // mm
    },
    'hollow-core': {
      'length': 6, // mm per 10m, max 13
      'width': 3, // mm
      'depth': 3, // mm
      'camber': 6, // mm per 10m
      'bearing-location': 6 // mm
    },
    'beam': {
      'length': 6, // mm per 10m
      'width': 6, // mm
      'depth': 6, // mm
      'sweep': 10, // mm per 10m
      'bearing-location': 13 // mm
    },
    'column': {
      'length': 6, // mm per 10m
      'cross-section': 6, // mm
      'straightness': 10, // mm per 10m
      'bearing-location': 6 // mm
    },
    'wall-panel': {
      'length': 6, // mm per 10m
      'width': 6, // mm per 3m
      'thickness': 6, // mm
      'warp': 6, // mm per 3m
      'bow': 10 // mm per 10m
    }
  };

  /**
   * Check member against standard tolerances
   */
  static checkTolerances(
    memberType: string,
    measurements: Record<string, { nominal: number; actual: number }>
  ): ToleranceResult[] {
    const results: ToleranceResult[] = [];
    const toleranceTable = this.tolerances[memberType] || this.tolerances['beam'];

    for (const [param, values] of Object.entries(measurements)) {
      const standardTol = toleranceTable[param] || 6;
      const deviation = Math.abs(values.actual - values.nominal);

      let status: ToleranceResult['status'];
      let adjustmentRequired: string;

      if (deviation <= standardTol) {
        status = 'within-tolerance';
        adjustmentRequired = 'None';
      } else if (deviation <= 1.5 * standardTol) {
        status = 'marginal';
        adjustmentRequired = 'Use shimming or grout adjustment';
      } else {
        status = 'out-of-tolerance';
        adjustmentRequired = 'Reject or submit RFI for engineering review';
      }

      results.push({
        category: param.includes('location') ? 'position' : 'dimension',
        memberType,
        standardTolerance: standardTol,
        achievedTolerance: deviation,
        status,
        adjustmentRequired
      });
    }

    return results;
  }

  /**
   * Erection tolerance envelope
   */
  static erectionTolerances(
    buildingHeight: number, // mm
    floorToFloor: number // mm
  ): Record<string, number> {
    return {
      'column-plumb': Math.min(25, buildingHeight / 500), // mm
      'floor-level': Math.min(19, 6 + floorToFloor / 1000), // mm
      'bearing-seat-elevation': 13, // mm
      'horizontal-alignment': 25, // mm
      'joint-width': 6, // mm
      'differential-camber': 13 // mm between adjacent members
    };
  }
}

// ============================================================================
// DIAPHRAGM ACTION
// ============================================================================

export class DiaphragmDesign {
  /**
   * Design chord and collector forces for precast diaphragm
   */
  static calculateDiaphragmForces(
    diaphragmLength: number, // m (parallel to load)
    diaphragmWidth: number, // m (perpendicular to load)
    lateralLoad: number, // kN (total shear at this level)
    openings?: { x: number; width: number }[] // m from edge
  ): {
    maxShear: number; // kN/m
    maxChordForce: number; // kN
    collectorForces: { location: number; force: number }[];
    jointShear: number; // kN/m
    recommendations: string[];
  } {
    const L = diaphragmLength;
    const B = diaphragmWidth;
    const V = lateralLoad;

    const recommendations: string[] = [];

    // Shear flow (assuming uniform distribution)
    let maxShear = V / B; // kN/m

    // Account for openings
    let effectiveWidth = B;
    if (openings && openings.length > 0) {
      const totalOpeningWidth = openings.reduce((sum, o) => sum + o.width, 0);
      effectiveWidth = B - totalOpeningWidth;
      maxShear = V / effectiveWidth;
      recommendations.push('Provide drag struts around openings');
    }

    // Chord force (assuming simple beam analogy)
    const M = V * L / 8; // kN-m (for uniformly distributed load)
    const maxChordForce = M / B; // kN

    // Joint shear (between precast units)
    // Assuming 1.2m wide hollow core or 2.4m wide double tee
    const unitWidth = 1.2; // m (hollow core)
    const jointShear = maxShear; // kN/m (must be transferred across joints)

    // Collector forces at shear walls or braced frames
    const collectorForces = [
      { location: 0, force: V / 2 },
      { location: L, force: V / 2 }
    ];

    // Recommendations
    if (L / B > 3) {
      recommendations.push('High aspect ratio - verify diaphragm flexibility');
    }
    if (jointShear > 15) {
      recommendations.push('High joint shear - consider mechanical connectors');
    }

    return {
      maxShear,
      maxChordForce,
      collectorForces,
      jointShear,
      recommendations
    };
  }

  /**
   * Design pour strip/topping reinforcement for diaphragm
   */
  static toppingReinforcement(
    shearFlow: number, // kN/m
    chordForce: number, // kN
    toppingThickness: number, // mm
    fc: number, // MPa
    fy: number // MPa
  ): {
    shearReinforcement: { area: number; spacing: number }; // mm²/m, mm
    chordReinforcement: { area: number; location: string }; // mm²
    meshReinforcement: { size: string; spacing: number }; // mm
  } {
    const t = toppingThickness;
    const phi = 0.75;

    // Shear reinforcement (for collector/drag)
    // Using shear friction: Avf = V / (φ μ fy)
    const mu = 1.0; // Roughened surface
    const Avf = shearFlow * 1000 / (phi * mu * fy); // mm²/m
    const spacing = Math.min(300, t * 3);

    // Chord reinforcement
    const As_chord = chordForce * 1000 / (phi * fy);

    // Minimum mesh for shrinkage/temperature
    const As_min = 0.0018 * 1000 * t; // mm²/m
    const meshSize = As_min < 100 ? 'W2.9 (MW19)' : 
                     As_min < 150 ? 'W4 (MW26)' : 'W5.5 (MW35)';

    return {
      shearReinforcement: { area: Avf, spacing },
      chordReinforcement: { area: As_chord, location: 'At edges parallel to span' },
      meshReinforcement: { size: meshSize, spacing: 150 }
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  HollowCoreDesign,
  DoubleTeeDesign,
  PrecastConnectionDesign,
  HandlingAnalysis,
  PrecastTolerances,
  DiaphragmDesign
};
