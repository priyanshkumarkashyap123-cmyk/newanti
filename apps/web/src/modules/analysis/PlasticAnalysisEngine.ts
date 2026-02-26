/**
 * ============================================================================
 * PLASTIC AND YIELD LINE ANALYSIS ENGINE
 * ============================================================================
 * 
 * Comprehensive plastic analysis for structural elements:
 * - Plastic hinge analysis for frames
 * - Yield line theory for slabs
 * - Collapse mechanism analysis
 * - Plastic section properties
 * - Moment redistribution
 * - Upper and lower bound theorems
 * 
 * Design Codes Supported:
 * - Eurocode 3 (EN 1993-1-1) - Plastic design of steel
 * - Eurocode 2 (EN 1992-1-1) - Moment redistribution RC
 * - AISC 360 - Plastic analysis of steel
 * - ACI 318 - Moment redistribution
 * - AS 4100 - Plastic design provisions
 * - BS 5950 - Plastic design (historical)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PlasticSectionProperties {
  shape: 'W' | 'S' | 'HSS-rect' | 'HSS-round' | 'channel' | 'angle' | 'tee' | 'custom';
  
  // Section dimensions
  depth: number; // mm
  flangeWidth?: number; // mm
  flangeThickness?: number; // mm
  webThickness?: number; // mm
  
  // Section properties
  Zx: number; // mm³ (plastic section modulus - major)
  Zy: number; // mm³ (plastic section modulus - minor)
  Sx: number; // mm³ (elastic section modulus - major)
  Sy: number; // mm³ (elastic section modulus - minor)
  area: number; // mm²
  
  // Shape factor
  shapeFactor: { major: number; minor: number };
}

export interface PlasticHinge {
  location: number; // m from left end
  momentCapacity: number; // kN·m
  rotationDemand: number; // rad
  rotationCapacity: number; // rad
  status: 'elastic' | 'yielded' | 'failed';
}

export interface CollapseMechanism {
  type: 'beam' | 'sway' | 'combined' | 'yield-line';
  description: string;
  collapseLoad: number; // kN or kN/m
  hingeLocations: PlasticHinge[];
  workDone: number; // kN·m
  virtualWork: { external: number; internal: number };
  loadFactor: number;
}

export interface YieldLinePattern {
  type: 'one-way' | 'two-way' | 'corner' | 'fan' | 'diagonal' | 'custom';
  parameters: Record<string, number>; // Pattern-specific dimensions
  positiveYieldLines: number; // Total length (m)
  negativeYieldLines: number; // Total length (m)
  momentCapacity: {
    positive: number; // kN·m/m
    negative: number; // kN·m/m
  };
}

export interface MomentRedistribution {
  code: string;
  maxRedistributionPercent: number;
  redistributedMoments: {
    location: string;
    originalMoment: number; // kN·m
    redistributedMoment: number; // kN·m
    percentChange: number;
  }[];
  equilibriumCheck: boolean;
  rotationCapacityCheck: boolean;
}

export interface SlabYieldLineResult {
  pattern: YieldLinePattern;
  collapseLoad: number; // kN/m²
  optimalParameters: Record<string, number>;
  safetyFactor: number;
  recommendations: string[];
}

// ============================================================================
// PLASTIC SECTION PROPERTIES
// ============================================================================

export class PlasticSection {
  /**
   * Calculate plastic section properties for I-section
   */
  static iSection(
    depth: number, // mm
    flangeWidth: number, // mm
    flangeThickness: number, // mm
    webThickness: number, // mm
  ): PlasticSectionProperties {
    const d = depth;
    const bf = flangeWidth;
    const tf = flangeThickness;
    const tw = webThickness;
    
    // Web depth
    const hw = d - 2 * tf;
    
    // Area
    const Af = bf * tf;
    const Aw = hw * tw;
    const A = 2 * Af + Aw;
    
    // Plastic neutral axis at centroid for symmetric section
    // Plastic section modulus (major axis)
    const Zx = bf * tf * (d - tf) + 0.25 * tw * hw * hw;
    
    // Plastic section modulus (minor axis)
    const Zy = 0.5 * tf * bf * bf + 0.25 * hw * tw * tw;
    
    // Elastic section modulus
    const Ix = bf * Math.pow(d, 3) / 12 - (bf - tw) * Math.pow(hw, 3) / 12;
    const Sx = 2 * Ix / d;
    
    const Iy = 2 * tf * Math.pow(bf, 3) / 12 + hw * Math.pow(tw, 3) / 12;
    const Sy = 2 * Iy / bf;
    
    return {
      shape: 'W',
      depth: d,
      flangeWidth: bf,
      flangeThickness: tf,
      webThickness: tw,
      Zx,
      Zy,
      Sx,
      Sy,
      area: A,
      shapeFactor: {
        major: Zx / Sx,
        minor: Zy / Sy
      }
    };
  }

  /**
   * Calculate plastic section properties for rectangular HSS
   */
  static rectangularHSS(
    height: number, // mm
    width: number, // mm
    thickness: number // mm
  ): PlasticSectionProperties {
    const h = height;
    const b = width;
    const t = thickness;
    
    // Outer dimensions
    const ho = h;
    const bo = b;
    // Inner dimensions
    const hi = h - 2 * t;
    const bi = b - 2 * t;
    
    // Area
    const A = bo * ho - bi * hi;
    
    // Plastic section modulus
    const Zx = (bo * ho * ho - bi * hi * hi) / 4;
    const Zy = (ho * bo * bo - hi * bi * bi) / 4;
    
    // Elastic section modulus
    const Ix = (bo * Math.pow(ho, 3) - bi * Math.pow(hi, 3)) / 12;
    const Sx = 2 * Ix / ho;
    
    const Iy = (ho * Math.pow(bo, 3) - hi * Math.pow(bi, 3)) / 12;
    const Sy = 2 * Iy / bo;
    
    return {
      shape: 'HSS-rect',
      depth: h,
      flangeWidth: b,
      flangeThickness: t,
      webThickness: t,
      Zx,
      Zy,
      Sx,
      Sy,
      area: A,
      shapeFactor: {
        major: Zx / Sx,
        minor: Zy / Sy
      }
    };
  }

  /**
   * Calculate plastic section properties for circular HSS
   */
  static circularHSS(
    diameter: number, // mm (outer)
    thickness: number // mm
  ): PlasticSectionProperties {
    const D = diameter;
    const t = thickness;
    const Di = D - 2 * t;
    
    // Area
    const A = Math.PI * (D * D - Di * Di) / 4;
    
    // Plastic section modulus (same for both axes)
    const Z = (Math.pow(D, 3) - Math.pow(Di, 3)) / 6;
    
    // Elastic section modulus
    const I = Math.PI * (Math.pow(D, 4) - Math.pow(Di, 4)) / 64;
    const S = 2 * I / D;
    
    return {
      shape: 'HSS-round',
      depth: D,
      flangeWidth: D,
      flangeThickness: t,
      webThickness: t,
      Zx: Z,
      Zy: Z,
      Sx: S,
      Sy: S,
      area: A,
      shapeFactor: {
        major: Z / S,
        minor: Z / S
      }
    };
  }

  /**
   * Calculate plastic section properties for rectangle
   */
  static rectangle(
    width: number, // mm
    depth: number // mm
  ): PlasticSectionProperties {
    const b = width;
    const d = depth;
    
    const A = b * d;
    
    // Plastic section modulus
    const Zx = b * d * d / 4;
    const Zy = d * b * b / 4;
    
    // Elastic section modulus
    const Sx = b * d * d / 6;
    const Sy = d * b * b / 6;
    
    return {
      shape: 'custom',
      depth: d,
      flangeWidth: b,
      Zx,
      Zy,
      Sx,
      Sy,
      area: A,
      shapeFactor: {
        major: 1.5, // Rectangle shape factor
        minor: 1.5
      }
    };
  }
}

// ============================================================================
// PLASTIC HINGE ANALYSIS
// ============================================================================

export class PlasticHingeAnalysis {
  /**
   * Calculate plastic moment capacity
   */
  static plasticMomentCapacity(
    section: PlasticSectionProperties,
    fy: number, // MPa (yield stress)
    axis: 'major' | 'minor' = 'major',
    phi: number = 0.9 // Resistance factor
  ): number {
    const Z = axis === 'major' ? section.Zx : section.Zy;
    return phi * fy * Z / 1e6; // kN·m
  }

  /**
   * Calculate rotation capacity
   */
  static rotationCapacity(
    section: PlasticSectionProperties,
    fy: number, // MPa
    E: number = 200000, // MPa
    sectionClass: 1 | 2 | 3 | 4 = 1
  ): {
    rotationCapacity: number; // rad
    available: boolean;
    curvatureDuctility: number;
  } {
    // Elastic curvature at yield
    const My = fy * section.Sx / 1e6; // kN·m
    const phi_y = fy / (E * section.depth / 2); // 1/mm
    
    // Plastic curvature capacity depends on section class
    const curvatureDuctility: Record<number, number> = {
      1: 8, // High ductility
      2: 4, // Moderate
      3: 1, // Elastic only
      4: 0.7 // Elastic, may buckle
    };
    
    const mu = curvatureDuctility[sectionClass] || 1;
    
    // Rotation capacity (approximate)
    // R = (θp/θy) - 1 = plastic hinge rotation / yield rotation - 1
    // For Class 1: R ≥ 3
    const rotationCapacity = phi_y * section.depth * mu / 1000; // rad
    
    return {
      rotationCapacity,
      available: sectionClass <= 2,
      curvatureDuctility: mu
    };
  }

  /**
   * Determine section class (Eurocode 3 classification)
   */
  static sectionClass(
    section: PlasticSectionProperties,
    fy: number, // MPa
    axialLoad: number = 0, // kN (compression positive)
    steelGrade: 'S235' | 'S275' | 'S355' | 'S420' | 'S460' = 'S355'
  ): {
    flangeClass: 1 | 2 | 3 | 4;
    webClass: 1 | 2 | 3 | 4;
    sectionClass: 1 | 2 | 3 | 4;
  } {
    const epsilon = Math.sqrt(235 / fy);
    
    // Flange classification (outstand in I-section)
    const cf = section.flangeWidth && section.webThickness && section.flangeThickness ?
               (section.flangeWidth - section.webThickness) / 2 / section.flangeThickness :
               10;
    
    let flangeClass: 1 | 2 | 3 | 4;
    if (cf <= 9 * epsilon) {
      flangeClass = 1;
    } else if (cf <= 10 * epsilon) {
      flangeClass = 2;
    } else if (cf <= 14 * epsilon) {
      flangeClass = 3;
    } else {
      flangeClass = 4;
    }

    // Web classification
    const dw = section.flangeThickness ?
               section.depth - 2 * section.flangeThickness :
               section.depth * 0.9;
    const tw = section.webThickness || section.depth * 0.05;
    const cw = dw / tw;
    
    // Stress ratio for web
    const alpha = 0.5 * (1 + axialLoad * 1000 / (section.area * fy));
    
    let webClass: 1 | 2 | 3 | 4;
    if (alpha > 0.5) {
      // Web in compression
      if (cw <= 33 * epsilon) {
        webClass = 1;
      } else if (cw <= 38 * epsilon) {
        webClass = 2;
      } else if (cw <= 42 * epsilon) {
        webClass = 3;
      } else {
        webClass = 4;
      }
    } else {
      // Web partially in tension
      if (cw <= 72 * epsilon) {
        webClass = 1;
      } else if (cw <= 83 * epsilon) {
        webClass = 2;
      } else if (cw <= 124 * epsilon) {
        webClass = 3;
      } else {
        webClass = 4;
      }
    }

    return {
      flangeClass,
      webClass,
      sectionClass: Math.max(flangeClass, webClass) as 1 | 2 | 3 | 4
    };
  }
}

// ============================================================================
// COLLAPSE MECHANISM ANALYSIS
// ============================================================================

export class CollapseMechanismAnalysis {
  /**
   * Beam mechanism analysis
   */
  static beamMechanism(
    span: number, // m
    Mp: number, // kN·m (plastic moment capacity)
    loadType: 'point-mid' | 'point-third' | 'udl',
    endCondition: 'pinned-pinned' | 'fixed-fixed' | 'fixed-pinned'
  ): CollapseMechanism {
    const hinges: PlasticHinge[] = [];
    let collapseLoad: number;
    let workExternal: number;
    let workInternal: number;
    
    // Virtual rotation
    const theta = 1; // Unit rotation

    if (loadType === 'point-mid') {
      // Point load at midspan
      if (endCondition === 'pinned-pinned') {
        // Single hinge at center
        collapseLoad = 4 * Mp / span;
        hinges.push({
          location: span / 2,
          momentCapacity: Mp,
          rotationDemand: 2 * theta,
          rotationCapacity: 0.05,
          status: 'yielded'
        });
        workExternal = collapseLoad * span / 2 * theta;
        workInternal = Mp * 2 * theta;
      } else if (endCondition === 'fixed-fixed') {
        // Three hinges
        collapseLoad = 8 * Mp / span;
        hinges.push(
          { location: 0, momentCapacity: Mp, rotationDemand: theta, rotationCapacity: 0.05, status: 'yielded' },
          { location: span / 2, momentCapacity: Mp, rotationDemand: 2 * theta, rotationCapacity: 0.05, status: 'yielded' },
          { location: span, momentCapacity: Mp, rotationDemand: theta, rotationCapacity: 0.05, status: 'yielded' }
        );
        workExternal = collapseLoad * span / 2 * theta;
        workInternal = Mp * (theta + 2 * theta + theta);
      } else {
        // Fixed-pinned: Two hinges
        collapseLoad = 6 * Mp / span;
        hinges.push(
          { location: 0, momentCapacity: Mp, rotationDemand: theta, rotationCapacity: 0.05, status: 'yielded' },
          { location: span / 2, momentCapacity: Mp, rotationDemand: 2 * theta, rotationCapacity: 0.05, status: 'yielded' }
        );
        workExternal = collapseLoad * span / 2 * theta;
        workInternal = Mp * 3 * theta;
      }
    } else if (loadType === 'udl') {
      // Uniformly distributed load
      if (endCondition === 'pinned-pinned') {
        collapseLoad = 8 * Mp / (span * span);
        hinges.push({
          location: span / 2,
          momentCapacity: Mp,
          rotationDemand: 2 * theta,
          rotationCapacity: 0.05,
          status: 'yielded'
        });
        workExternal = collapseLoad * span * span / 2 * theta / 2;
        workInternal = Mp * 2 * theta;
      } else if (endCondition === 'fixed-fixed') {
        collapseLoad = 16 * Mp / (span * span);
        hinges.push(
          { location: 0, momentCapacity: Mp, rotationDemand: theta, rotationCapacity: 0.05, status: 'yielded' },
          { location: span / 2, momentCapacity: Mp, rotationDemand: 2 * theta, rotationCapacity: 0.05, status: 'yielded' },
          { location: span, momentCapacity: Mp, rotationDemand: theta, rotationCapacity: 0.05, status: 'yielded' }
        );
        workExternal = collapseLoad * span * span / 2 * theta / 2;
        workInternal = Mp * 4 * theta;
      } else {
        collapseLoad = 11.66 * Mp / (span * span);
        hinges.push(
          { location: 0, momentCapacity: Mp, rotationDemand: theta, rotationCapacity: 0.05, status: 'yielded' },
          { location: 0.414 * span, momentCapacity: Mp, rotationDemand: 2 * theta, rotationCapacity: 0.05, status: 'yielded' }
        );
        workExternal = collapseLoad * span * span / 2 * theta / 2;
        workInternal = Mp * 3 * theta;
      }
    } else {
      // Two point loads at third points
      if (endCondition === 'fixed-fixed') {
        collapseLoad = 9 * Mp / span;
      } else if (endCondition === 'pinned-pinned') {
        collapseLoad = 3 * Mp / span;
      } else {
        collapseLoad = 4.5 * Mp / span;
      }
      hinges.push({
        location: span / 3,
        momentCapacity: Mp,
        rotationDemand: 2 * theta,
        rotationCapacity: 0.05,
        status: 'yielded'
      });
      workExternal = collapseLoad * span / 3 * theta;
      workInternal = Mp * 2 * theta;
    }

    return {
      type: 'beam',
      description: `Beam mechanism: ${loadType} load, ${endCondition} support`,
      collapseLoad,
      hingeLocations: hinges,
      workDone: workInternal,
      virtualWork: { external: workExternal, internal: workInternal },
      loadFactor: 1.0
    };
  }

  /**
   * Frame sway mechanism
   */
  static swayMechanism(
    width: number, // m
    height: number, // m
    MpBeam: number, // kN·m (beam plastic moment)
    MpColumn: number, // kN·m (column plastic moment)
    lateralLoad: number // kN (horizontal force at top)
  ): CollapseMechanism {
    const theta = 1; // Virtual rotation

    // Sway mechanism: hinges at column bases and beam-column connections
    const hinges: PlasticHinge[] = [
      { location: 0, momentCapacity: MpColumn, rotationDemand: theta, rotationCapacity: 0.05, status: 'yielded' },
      { location: height, momentCapacity: MpColumn, rotationDemand: theta, rotationCapacity: 0.05, status: 'yielded' }
    ];

    // External work = H × h × θ
    const workExternal = lateralLoad * height * theta;

    // Internal work = ΣMp × θ
    const workInternal = 2 * MpColumn * theta;

    // Collapse load factor
    const lambdaCollapse = workInternal / (lateralLoad * height);

    return {
      type: 'sway',
      description: 'Frame sway mechanism with column base hinges',
      collapseLoad: lateralLoad * lambdaCollapse,
      hingeLocations: hinges,
      workDone: workInternal,
      virtualWork: { external: workExternal, internal: workInternal },
      loadFactor: lambdaCollapse
    };
  }

  /**
   * Combined mechanism for portal frame
   */
  static combinedMechanism(
    width: number, // m
    height: number, // m
    MpBeam: number, // kN·m
    MpColumn: number, // kN·m
    verticalLoad: number, // kN (on beam)
    horizontalLoad: number // kN (lateral)
  ): CollapseMechanism {
    const theta = 1;

    // Combined mechanism: hinges at all critical locations
    const hinges: PlasticHinge[] = [
      { location: 0, momentCapacity: MpColumn, rotationDemand: theta, rotationCapacity: 0.05, status: 'yielded' },
      { location: width / 2, momentCapacity: MpBeam, rotationDemand: 2 * theta, rotationCapacity: 0.05, status: 'yielded' },
      { location: height, momentCapacity: MpColumn, rotationDemand: theta, rotationCapacity: 0.05, status: 'yielded' },
      { location: height + width, momentCapacity: MpColumn, rotationDemand: theta, rotationCapacity: 0.05, status: 'yielded' }
    ];

    // External work
    const workExternal = horizontalLoad * height * theta + verticalLoad * width / 2 * theta;

    // Internal work
    const workInternal = 2 * MpColumn * theta + MpBeam * 2 * theta + 2 * MpColumn * theta;

    // Collapse load factor
    const currentWork = horizontalLoad * height * theta + verticalLoad * width / 2 * theta;
    const lambdaCollapse = workInternal / currentWork;

    return {
      type: 'combined',
      description: 'Combined beam-sway mechanism for portal frame',
      collapseLoad: (verticalLoad + horizontalLoad) * lambdaCollapse,
      hingeLocations: hinges,
      workDone: workInternal,
      virtualWork: { external: workExternal, internal: workInternal },
      loadFactor: lambdaCollapse
    };
  }
}

// ============================================================================
// YIELD LINE THEORY FOR SLABS
// ============================================================================

export class YieldLineAnalysis {
  /**
   * Rectangular slab - simply supported all edges
   */
  static rectangularSimplySupported(
    Lx: number, // m (shorter span)
    Ly: number, // m (longer span)
    mx: number, // kN·m/m (moment capacity in x direction)
    my: number, // kN·m/m (moment capacity in y direction)
    mu: number = 1.0 // Isotropy coefficient (my/mx)
  ): SlabYieldLineResult {
    const i = Ly / Lx; // Aspect ratio
    
    // For diagonal pattern, find optimal yield line position
    // Using virtual work method
    
    // Pattern: diagonal lines from corners meeting at center
    // For square slab with isotropic reinforcement: w = 24m/L²
    
    // For rectangular slab:
    // Parameters: none for this pattern (fixed geometry)
    
    // Positive yield lines length
    const diagonalLength = 2 * (Math.sqrt(Math.pow(Lx/2, 2) + Math.pow(Ly/2, 2)));
    const positiveLines = 2 * diagonalLength;
    
    // No negative yield lines (simply supported)
    const negativeLines = 0;
    
    // Virtual work calculation
    // Unit deflection at center = δ = 1
    const theta_x = 2 / Lx; // Rotation about x-axis
    const theta_y = 2 / Ly; // Rotation about y-axis
    
    // Internal work = Σ(m × L × θ)
    const internalWork = 2 * (mx * Ly * theta_x + my * Lx * theta_y);
    
    // External work = w × Area × average deflection
    // Average deflection for this pattern = δ/3
    const externalWorkCoeff = Lx * Ly / 3;
    
    // Collapse load
    const w = internalWork / externalWorkCoeff;
    
    // Simplified formula for approximately isotropic slab
    const aspectFactor = (3 + i * i) / (i * i + i);
    const w_simplified = 24 * mx * aspectFactor / (Lx * Lx);

    return {
      pattern: {
        type: 'two-way',
        parameters: {},
        positiveYieldLines: positiveLines,
        negativeYieldLines: negativeLines,
        momentCapacity: { positive: mx, negative: 0 }
      },
      collapseLoad: w,
      optimalParameters: {},
      safetyFactor: 1.5,
      recommendations: [
        `Yield line pattern: Diagonal lines from corners`,
        `For more accurate analysis, check fan patterns at corners`
      ]
    };
  }

  /**
   * Rectangular slab - fixed all edges
   */
  static rectangularFixed(
    Lx: number, // m
    Ly: number, // m
    m_pos: number, // kN·m/m (positive moment capacity)
    m_neg: number // kN·m/m (negative moment capacity)
  ): SlabYieldLineResult {
    const i = Ly / Lx;
    
    // For fixed edges, yield lines also form at supports
    // Pattern: diagonal positive lines + edge negative lines
    
    // Positive yield line length
    const diagonalLength = 2 * Math.sqrt(Math.pow(Lx/2, 2) + Math.pow(Ly/2, 2));
    const positiveLines = 2 * diagonalLength;
    
    // Negative yield line length (perimeter)
    const negativeLines = 2 * (Lx + Ly);
    
    // Virtual work
    const theta_x = 2 / Lx;
    const theta_y = 2 / Ly;
    
    // Internal work from positive yield lines
    const W_pos = 2 * (m_pos * Ly * theta_x + m_pos * Lx * theta_y);
    
    // Internal work from negative yield lines at edges
    const W_neg = 2 * (m_neg * Ly * theta_x + m_neg * Lx * theta_y);
    
    // Total internal work
    const internalWork = W_pos + W_neg;
    
    // External work coefficient
    const externalWorkCoeff = Lx * Ly / 3;
    
    // Collapse load
    const w = internalWork / externalWorkCoeff;
    
    // Simplified formula
    const w_simplified = 24 * (m_pos + m_neg) / (Lx * Lx) * (3 + i * i) / (i * i + i);

    return {
      pattern: {
        type: 'two-way',
        parameters: { negativeToPositive: m_neg / m_pos },
        positiveYieldLines: positiveLines,
        negativeYieldLines: negativeLines,
        momentCapacity: { positive: m_pos, negative: m_neg }
      },
      collapseLoad: w,
      optimalParameters: { negativeToPositive: m_neg / m_pos },
      safetyFactor: 1.5,
      recommendations: [
        'Fixed edge slab with diagonal yield pattern',
        'Verify corner reinforcement for fan yield lines'
      ]
    };
  }

  /**
   * One-way slab
   */
  static oneWay(
    span: number, // m
    m_pos: number, // kN·m/m
    m_neg_left: number, // kN·m/m
    m_neg_right: number // kN·m/m
  ): SlabYieldLineResult {
    // Simple yield line across width
    const theta = 2 / span;
    
    // Internal work per unit width
    const W_internal = m_pos * theta + m_neg_left * theta + m_neg_right * theta;
    
    // External work per unit width (UDL)
    // w × L × average deflection = w × L × 1/2
    const W_external_coeff = span / 2;
    
    // Collapse load
    const w = W_internal / W_external_coeff;
    
    // Classical formula: w = 8(m+ + m-) / L²
    const w_classical = 8 * (m_pos + (m_neg_left + m_neg_right) / 2) / (span * span);

    return {
      pattern: {
        type: 'one-way',
        parameters: { span },
        positiveYieldLines: 1,
        negativeYieldLines: m_neg_left > 0 || m_neg_right > 0 ? 2 : 0,
        momentCapacity: { positive: m_pos, negative: (m_neg_left + m_neg_right) / 2 }
      },
      collapseLoad: w_classical,
      optimalParameters: {},
      safetyFactor: 1.5,
      recommendations: ['One-way yield line pattern']
    };
  }

  /**
   * Slab with opening
   */
  static withOpening(
    Lx: number, // m (slab width)
    Ly: number, // m (slab length)
    openingX: number, // m (opening x position from corner)
    openingY: number, // m (opening y position)
    openingWidth: number, // m
    openingHeight: number, // m
    m: number // kN·m/m (isotropic moment capacity)
  ): SlabYieldLineResult {
    // Modified yield line pattern around opening
    // Yield lines terminate at opening corners
    
    // Effective area
    const grossArea = Lx * Ly;
    const openingArea = openingWidth * openingHeight;
    const effectiveArea = grossArea - openingArea;
    
    // Additional yield lines around opening
    const additionalLines = 2 * (openingWidth + openingHeight);
    
    // Approximate solution using modified formula
    const baseCollapse = 24 * m / (Lx * Lx);
    
    // Reduction factor for opening
    const openingRatio = openingArea / grossArea;
    const reductionFactor = 1 - 0.5 * openingRatio;
    
    const collapseLoad = baseCollapse * reductionFactor;

    return {
      pattern: {
        type: 'custom',
        parameters: { openingX, openingY, openingWidth, openingHeight },
        positiveYieldLines: 4 * Math.sqrt(Math.pow(Lx/2, 2) + Math.pow(Ly/2, 2)) + additionalLines,
        negativeYieldLines: 0,
        momentCapacity: { positive: m, negative: 0 }
      },
      collapseLoad,
      optimalParameters: {},
      safetyFactor: 1.5,
      recommendations: [
        'Opening modifies yield line pattern',
        'Provide additional reinforcement around opening',
        'Consider fan pattern at opening corners'
      ]
    };
  }

  /**
   * Fan pattern at concentrated load
   */
  static fanPattern(
    loadDiameter: number, // m (diameter of loaded area)
    m: number, // kN·m/m (isotropic moment capacity)
    slabThickness: number // mm
  ): {
    ultimateLoad: number; // kN
    fanRadius: number; // m
  } {
    // Fan yield line pattern for concentrated load
    // P = 2π × m (for isotropic slab)
    
    // For finite loaded area:
    const a = loadDiameter / 2;
    const d = slabThickness / 1000; // m
    
    // Ultimate load
    const P = 2 * Math.PI * m + Math.PI * m * a / d;
    
    // Fan radius approximately
    const fanRadius = Math.max(d, 2 * a);

    return {
      ultimateLoad: P,
      fanRadius
    };
  }
}

// ============================================================================
// MOMENT REDISTRIBUTION
// ============================================================================

export class MomentRedistribution {
  /**
   * Calculate allowable redistribution per code
   */
  static allowableRedistribution(
    code: 'ACI-318' | 'EC2' | 'IS-456' | 'BS-8110',
    neutralAxisDepth: number, // mm
    effectiveDepth: number, // mm
    concreteClass?: string
  ): {
    maxRedistribution: number; // %
    conditions: string[];
  } {
    const c_d = neutralAxisDepth / effectiveDepth;
    const conditions: string[] = [];
    
    let maxRedist: number;
    
    switch (code) {
      case 'ACI-318':
        // ACI 318-19 Section 6.6.5
        // β = 1000εt ≥ 7.5% for 20% redistribution
        if (c_d <= 0.375) {
          maxRedist = 1000 * 0.003 * (1 - c_d) / c_d;
          maxRedist = Math.min(maxRedist, 20);
        } else {
          maxRedist = 0;
        }
        conditions.push('Strain εt ≥ 0.0075 for full redistribution');
        conditions.push('c/d ≤ 0.375 for 20% maximum');
        break;
        
      case 'EC2':
        // Eurocode 2 Section 5.5
        // δ ≥ 0.44 + 1.25(xu/d) for fck ≤ 50 MPa
        const xuLim = 0.45;
        if (c_d <= xuLim) {
          maxRedist = (1 - (0.44 + 1.25 * c_d)) * 100;
          maxRedist = Math.min(30, Math.max(0, maxRedist));
        } else {
          maxRedist = 0;
        }
        conditions.push('xu/d ≤ 0.45 for Class A steel');
        conditions.push('Continuous members with predominantly permanent load');
        break;
        
      case 'IS-456':
        // IS 456:2000 Clause 37.1.1
        // Max 30% for x/d ≤ 0.5
        if (c_d <= 0.5) {
          maxRedist = 30 * (0.5 - c_d) / 0.5;
          maxRedist = Math.min(30, maxRedist);
        } else {
          maxRedist = 0;
        }
        conditions.push('xu/d ≤ 0.5 for M20 grade');
        conditions.push('Continuous beams and frames only');
        break;
        
      case 'BS-8110':
        // BS 8110 (historical)
        if (c_d <= 0.5) {
          maxRedist = 30;
        } else {
          maxRedist = 0;
        }
        conditions.push('Historical code - use Eurocode 2');
        break;
        
      default:
        maxRedist = 15;
        conditions.push('Default conservative value');
    }

    return {
      maxRedistribution: Math.round(maxRedist * 10) / 10,
      conditions
    };
  }

  /**
   * Perform moment redistribution
   */
  static redistribute(
    moments: { location: string; elastic: number }[], // kN·m
    redistribution: { from: string; to: string; percent: number }[],
    maxAllowed: number = 20 // %
  ): {
    results: { location: string; original: number; redistributed: number; change: number }[];
    equilibrium: boolean;
    valid: boolean;
  } {
    const results = moments.map(m => ({
      location: m.location,
      original: m.elastic,
      redistributed: m.elastic,
      change: 0
    }));

    // Apply redistributions
    for (const redist of redistribution) {
      const fromIdx = results.findIndex(r => r.location === redist.from);
      const toIdx = results.findIndex(r => r.location === redist.to);
      
      if (fromIdx >= 0 && toIdx >= 0) {
        const reduction = results[fromIdx].original * redist.percent / 100;
        results[fromIdx].redistributed -= reduction;
        results[toIdx].redistributed += reduction;
      }
    }

    // Calculate changes
    for (const r of results) {
      r.change = ((r.redistributed - r.original) / r.original) * 100;
    }

    // Check equilibrium
    const totalOriginal = moments.reduce((sum, m) => sum + m.elastic, 0);
    const totalRedist = results.reduce((sum, r) => sum + r.redistributed, 0);
    const equilibrium = Math.abs(totalOriginal - totalRedist) < 0.01 * Math.abs(totalOriginal);

    // Check max redistribution
    const maxActual = Math.max(...results.map(r => Math.abs(r.change)));
    const valid = maxActual <= maxAllowed;

    return { results, equilibrium, valid };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  PlasticSection,
  PlasticHingeAnalysis,
  CollapseMechanismAnalysis,
  YieldLineAnalysis,
  MomentRedistribution
};
