/**
 * ============================================================================
 * STRUCTURAL DETAILING AND REINFORCEMENT DRAWING ENGINE
 * ============================================================================
 * 
 * Comprehensive detailing rules and reinforcement schedules:
 * - Reinforcement detailing rules
 * - Bar bending schedules
 * - Lap and anchorage calculations
 * - Cover requirements
 * - Bar spacing checks
 * - Standard hooks and bends
 * - Bar cut lengths
 * - Quantity estimation
 * 
 * Design Codes Supported:
 * - ACI 318 (Detailing Requirements)
 * - IS 456 / SP 34 (Indian Standard Detailing)
 * - EN 1992-1-1 / EC2 (Eurocode Detailing)
 * - BS 8666 (Bar Scheduling)
 * - AS 3600 (Australian Detailing)
 * - CRSI Manual of Standard Practice
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Bar {
  mark: string;
  diameter: number; // mm
  noOfBars: number;
  length: number; // mm (total cut length)
  shape: BarShape;
  material: 'mild-steel' | 'HYSD' | 'stainless' | 'epoxy-coated';
  grade: number; // MPa (yield strength)
}

export interface BarShape {
  code: string; // BS 8666 shape code (e.g., "00", "11", "21", etc.)
  dimensions: Record<string, number>; // Shape dimensions (A, B, C, etc.)
  bendingRadius: number; // mm
  description: string;
}

export interface ConcreteElement {
  type: 'beam' | 'column' | 'slab' | 'footing' | 'wall' | 'staircase';
  id: string;
  dimensions: {
    length?: number; // mm
    width?: number; // mm
    height?: number; // mm (or depth)
    span?: number; // mm
  };
  concrete: {
    grade: number; // MPa (fc or fck)
    cover: {
      top: number; // mm
      bottom: number; // mm
      side: number; // mm
    };
    exposureClass: string;
  };
}

export interface ReinforcementSchedule {
  element: ConcreteElement;
  bars: Bar[];
  totalWeight: number; // kg
  steelRatio: number; // %
  summary: {
    byDiameter: { diameter: number; totalLength: number; weight: number }[];
    byShape: { shape: string; count: number }[];
  };
}

export interface LapSpliceResult {
  code: string;
  basicLength: number; // mm
  modifiedLength: number; // mm
  factors: {
    description: string;
    value: number;
  }[];
  classOfLap: 'A' | 'B' | 'C' | 'contact' | 'non-contact';
  recommendations: string[];
}

export interface AnchorageResult {
  code: string;
  straightLength: number; // mm
  withHook: {
    length: number; // mm
    hookType: 'standard-90' | 'standard-180' | 'stirrup-hook';
    hookDimension: number; // mm
  };
  withHeadedBar?: {
    length: number; // mm
    headDimension: number; // mm
  };
  recommendations: string[];
}

export interface CoverRequirements {
  code: string;
  minimumCover: number; // mm
  nominalCover: number; // mm
  factors: string[];
  fireRating?: string;
}

// ============================================================================
// BAR PROPERTIES
// ============================================================================

export class BarProperties {
  /**
   * Standard bar areas
   */
  static readonly AREAS: Record<number, number> = {
    6: 28.3,
    8: 50.3,
    10: 78.5,
    12: 113.1,
    16: 201.1,
    20: 314.2,
    25: 490.9,
    28: 615.8,
    32: 804.2,
    36: 1017.9,
    40: 1256.6
  };

  /**
   * Bar unit weights (kg/m)
   */
  static readonly UNIT_WEIGHTS: Record<number, number> = {
    6: 0.222,
    8: 0.395,
    10: 0.617,
    12: 0.888,
    16: 1.579,
    20: 2.466,
    25: 3.854,
    28: 4.834,
    32: 6.313,
    36: 7.990,
    40: 9.864
  };

  /**
   * Get bar area
   */
  static getArea(diameter: number): number {
    return this.AREAS[diameter] || Math.PI * diameter * diameter / 4;
  }

  /**
   * Get bar weight per meter
   */
  static getUnitWeight(diameter: number): number {
    return this.UNIT_WEIGHTS[diameter] || 0.00617 * diameter * diameter;
  }

  /**
   * Calculate total weight
   */
  static getWeight(diameter: number, length: number, quantity: number): number {
    return this.getUnitWeight(diameter) * length / 1000 * quantity;
  }

  /**
   * Get minimum bend radius
   */
  static minBendRadius(
    diameter: number,
    grade: number,
    code: 'ACI' | 'EC2' | 'IS' = 'ACI'
  ): number {
    // Minimum bend diameter (multiply by 0.5 for radius)
    if (code === 'ACI') {
      // ACI 318 Table 25.3.1
      if (diameter <= 16) {
        return 3 * diameter;
      } else if (diameter <= 25) {
        return 4 * diameter;
      } else {
        return 5 * diameter;
      }
    } else if (code === 'EC2') {
      // EN 1992-1-1 Table 8.1N
      if (diameter <= 16) {
        return 2 * diameter;
      } else {
        return 3.5 * diameter;
      }
    } else {
      // IS 456 Clause 26.2.2.3
      if (grade <= 250) {
        return 2 * diameter;
      } else {
        return 4 * diameter;
      }
    }
  }

  /**
   * Standard bar lengths available
   */
  static standardLengths(region: 'US' | 'UK' | 'IN' | 'EU' = 'US'): number[] {
    switch (region) {
      case 'US':
        return [6096, 9144, 12192, 18288]; // 20', 30', 40', 60'
      case 'UK':
      case 'EU':
        return [6000, 9000, 12000]; // 6m, 9m, 12m
      case 'IN':
        return [6000, 9000, 12000]; // 6m, 9m, 12m
      default:
        return [6000, 12000];
    }
  }
}

// ============================================================================
// BAR SHAPES (BS 8666)
// ============================================================================

export class BarShapes {
  /**
   * Get shape details per BS 8666
   */
  static getShape(
    shapeCode: string,
    dimensions: Record<string, number>,
    diameter: number
  ): BarShape {
    const r = BarProperties.minBendRadius(diameter, 500, 'EC2');
    const n = Math.ceil(r / diameter);
    
    const shapes: Record<string, { desc: string; formula: (d: Record<string, number>, db: number, r: number) => number }> = {
      '00': {
        desc: 'Straight bar',
        formula: (d) => d.A
      },
      '11': {
        desc: '90° bend at one end',
        formula: (d, db, r) => d.A + d.B - 0.5 * r - db
      },
      '12': {
        desc: '90° bends at both ends (same direction)',
        formula: (d, db, r) => d.A + d.B + d.C - r - 2 * db
      },
      '13': {
        desc: '90° bends at both ends (opposite directions)',
        formula: (d, db, r) => d.A + d.B + d.C - r - 2 * db
      },
      '21': {
        desc: 'Crank',
        formula: (d, db, r) => d.A + d.C + 0.57 * d.B - r - 2 * db
      },
      '22': {
        desc: 'Double crank',
        formula: (d, db, r) => d.A + 2 * (0.57 * d.B + d.C) - 2 * r - 4 * db
      },
      '31': {
        desc: 'L-shape',
        formula: (d, db, r) => d.A + d.B - 0.5 * r - db
      },
      '33': {
        desc: 'U-shape',
        formula: (d, db, r) => 2 * d.A + d.B + d.C - 2.5 * r - 4 * db
      },
      '41': {
        desc: 'Standard hook (180°)',
        formula: (d, db, r) => d.A + 10 * db
      },
      '51': {
        desc: 'Stirrup/link',
        formula: (d, db, r) => 2 * (d.A + d.B) + 12 * db
      },
      '61': {
        desc: 'Helical bar (spring)',
        formula: (d) => d.A * d.B
      },
      '81': {
        desc: 'Pile cage ring',
        formula: (d) => Math.PI * d.A + 2 * d.B
      }
    };
    
    const shape = shapes[shapeCode] || shapes['00'];
    const length = shape.formula(dimensions, diameter, r);

    return {
      code: shapeCode,
      dimensions,
      bendingRadius: r,
      description: shape.desc
    };
  }

  /**
   * Standard stirrup shapes
   */
  static stirrup(
    width: number, // mm (inside dimension)
    height: number, // mm (inside dimension)
    diameter: number,
    legs: 2 | 4 | 6 = 2
  ): BarShape {
    const r = BarProperties.minBendRadius(diameter, 500, 'EC2');
    const hookExtension = 10 * diameter; // Standard stirrup hook
    
    // BS 8666 Shape 51
    const cutLength = 2 * (width + height) + 2 * hookExtension + 8 * r;

    return {
      code: '51',
      dimensions: {
        A: width + 2 * r,
        B: height + 2 * r,
        C: hookExtension
      },
      bendingRadius: r,
      description: `Stirrup ${width}×${height}, ${legs} legs, hooks`
    };
  }

  /**
   * Calculate stirrup cut length
   */
  static stirrupCutLength(
    width: number,
    height: number,
    diameter: number,
    hookType: '90deg' | '135deg' | '180deg' = '135deg'
  ): number {
    const r = BarProperties.minBendRadius(diameter, 500, 'EC2');
    
    // Hook length
    let hookLength: number;
    switch (hookType) {
      case '90deg':
        hookLength = 6 * diameter;
        break;
      case '135deg':
        hookLength = 10 * diameter;
        break;
      case '180deg':
        hookLength = 4 * diameter;
        break;
    }
    
    // 4 corners = 4 × (π/2 × r) = 2πr
    // 2 hooks = 2 × hookLength
    // Perimeter = 2(width + height)
    
    return 2 * (width + height) + 2 * Math.PI * r + 2 * hookLength;
  }
}

// ============================================================================
// LAP AND DEVELOPMENT LENGTH
// ============================================================================

export class LapAndDevelopment {
  /**
   * Development length per ACI 318-19
   */
  static developmentLengthACI(
    diameter: number, // mm
    fy: number, // MPa
    fc: number, // MPa
    position: 'top' | 'bottom',
    coating: 'uncoated' | 'epoxy' | 'zinc-galv',
    concreteType: 'normal' | 'lightweight',
    cover: number, // mm (clear cover to bar)
    spacing: number // mm (clear spacing between bars)
  ): AnchorageResult {
    const db = diameter;
    
    // Modification factors
    // ψt - casting position
    const psi_t = position === 'top' && cover < 300 ? 1.3 : 1.0;
    
    // ψe - coating
    let psi_e: number;
    if (coating === 'epoxy' && cover < 3 * db) {
      psi_e = 1.5;
    } else if (coating === 'epoxy') {
      psi_e = 1.2;
    } else if (coating === 'zinc-galv') {
      psi_e = 1.0;
    } else {
      psi_e = 1.0;
    }
    
    // ψt × ψe ≤ 1.7
    const psi_te = Math.min(1.7, psi_t * psi_e);
    
    // ψs - bar size
    const psi_s = db <= 19 ? 0.8 : 1.0;
    
    // λ - lightweight concrete
    const lambda = concreteType === 'lightweight' ? 0.75 : 1.0;
    
    // cb - cover term
    const cb = Math.min(cover + db / 2, spacing / 2 + db / 2, 2.5 * db);
    
    // Ktr - transverse reinforcement index (simplified, assume 0)
    const Ktr = 0;
    
    // Development length (ACI 318-19 Eq. 25.4.2.3a)
    const ld = (db / 1.1) * (fy / (lambda * Math.sqrt(fc))) * 
               (psi_te * psi_s / ((cb + Ktr) / db));
    
    // Minimum
    const ld_min = Math.max(ld, 300);
    
    // With standard hook (90°)
    const ldh = (0.24 * fy / (lambda * Math.sqrt(fc))) * db * psi_te;
    const ldh_min = Math.max(ldh, 8 * db, 150);
    
    return {
      code: 'ACI 318-19',
      straightLength: Math.ceil(ld_min),
      withHook: {
        length: Math.ceil(ldh_min),
        hookType: 'standard-90',
        hookDimension: 12 * db
      },
      withHeadedBar: {
        length: Math.ceil(0.7 * ld_min),
        headDimension: 3 * db
      },
      recommendations: [
        `Development length = ${Math.ceil(ld_min)} mm`,
        `With hook = ${Math.ceil(ldh_min)} mm`
      ]
    };
  }

  /**
   * Development length per IS 456
   */
  static developmentLengthIS(
    diameter: number, // mm
    fy: number, // MPa
    fck: number, // MPa
    barType: 'plain' | 'deformed'
  ): AnchorageResult {
    const db = diameter;
    const sigma_s = 0.87 * fy;
    
    // Bond stress (Table 26.2.1.1)
    let tau_bd: number;
    if (fck <= 15) {
      tau_bd = barType === 'deformed' ? 1.0 : 0.6;
    } else if (fck <= 20) {
      tau_bd = barType === 'deformed' ? 1.2 : 0.8;
    } else if (fck <= 25) {
      tau_bd = barType === 'deformed' ? 1.4 : 0.9;
    } else if (fck <= 30) {
      tau_bd = barType === 'deformed' ? 1.5 : 1.0;
    } else {
      tau_bd = barType === 'deformed' ? 1.7 : 1.1;
    }
    
    // For bars in tension
    const Ld = sigma_s * db / (4 * tau_bd);
    
    // Compression development (reduce by 25%)
    const Ld_compression = 0.75 * Ld;
    
    // With standard hook
    const Ld_hook = 0.7 * Ld;

    return {
      code: 'IS 456:2000',
      straightLength: Math.ceil(Ld),
      withHook: {
        length: Math.ceil(Ld_hook),
        hookType: 'standard-90',
        hookDimension: 8 * db
      },
      recommendations: [
        `Ld tension = ${Math.ceil(Ld)} mm (${Math.ceil(Ld / db)}φ)`,
        `Ld compression = ${Math.ceil(Ld_compression)} mm`,
        `With hook = ${Math.ceil(Ld_hook)} mm`
      ]
    };
  }

  /**
   * Development length per Eurocode 2
   */
  static developmentLengthEC2(
    diameter: number, // mm
    fyk: number, // MPa
    fck: number, // MPa
    bondCondition: 'good' | 'poor',
    position: 'tension' | 'compression'
  ): AnchorageResult {
    const db = diameter;
    const gamma_c = 1.5;
    const gamma_s = 1.15;
    
    // Design values
    const fyd = fyk / gamma_s;
    const fctm = 0.3 * Math.pow(fck, 2/3);
    const fctk = 0.7 * fctm;
    const fctd = fctk / gamma_c;
    
    // Bond stress
    const eta1 = bondCondition === 'good' ? 1.0 : 0.7;
    const eta2 = db <= 32 ? 1.0 : (132 - db) / 100;
    const fbd = 2.25 * eta1 * eta2 * fctd;
    
    // Basic anchorage length
    const lb_rqd = (db / 4) * (fyd / fbd);
    
    // Design anchorage length
    const alpha_1 = 1.0; // Shape of bars
    const alpha_2 = 1.0; // Cover
    const alpha_3 = 1.0; // Transverse reinforcement
    const alpha_4 = 1.0; // Welded transverse bars
    const alpha_5 = position === 'compression' ? 0.7 : 1.0;
    
    const lbd = alpha_1 * alpha_2 * alpha_3 * alpha_4 * alpha_5 * lb_rqd;
    const lbd_min = position === 'tension' ? 
                    Math.max(0.3 * lb_rqd, 10 * db, 100) :
                    Math.max(0.6 * lb_rqd, 10 * db, 100);
    
    // With hook
    const alpha_1_hook = 0.7;
    const lbd_hook = alpha_1_hook * lbd;

    return {
      code: 'EN 1992-1-1',
      straightLength: Math.ceil(Math.max(lbd, lbd_min)),
      withHook: {
        length: Math.ceil(lbd_hook),
        hookType: 'standard-90',
        hookDimension: 5 * db
      },
      recommendations: [
        `Basic length lb,rqd = ${Math.ceil(lb_rqd)} mm`,
        `Design length lbd = ${Math.ceil(lbd)} mm`,
        `Bond condition: ${bondCondition}`
      ]
    };
  }

  /**
   * Lap splice length
   */
  static lapSplice(
    developmentLength: number, // mm
    percentageOfBarsLapped: number, // %
    code: 'ACI' | 'IS' | 'EC2'
  ): LapSpliceResult {
    const Ld = developmentLength;
    let factor = 1.0;
    let lapClass: LapSpliceResult['classOfLap'] = 'contact';
    const factors: LapSpliceResult['factors'] = [];
    
    if (code === 'ACI') {
      // ACI 318-19 Section 25.5
      if (percentageOfBarsLapped <= 50) {
        factor = 1.0;
        lapClass = 'A';
      } else {
        factor = 1.3;
        lapClass = 'B';
      }
      factors.push({ description: 'Class B splice', value: factor });
    } else if (code === 'IS') {
      // IS 456 Clause 26.2.5
      if (percentageOfBarsLapped <= 25) {
        factor = 1.0;
      } else if (percentageOfBarsLapped <= 50) {
        factor = 1.15;
      } else if (percentageOfBarsLapped <= 75) {
        factor = 1.30;
      } else {
        factor = 1.45;
      }
      factors.push({ description: `${percentageOfBarsLapped}% bars lapped`, value: factor });
    } else {
      // Eurocode 2
      const alpha_6 = Math.sqrt(percentageOfBarsLapped / 25);
      factor = Math.max(1.0, alpha_6);
      factors.push({ description: 'α6 factor', value: factor });
    }
    
    const lapLength = Ld * factor;

    return {
      code: code === 'ACI' ? 'ACI 318-19' : code === 'IS' ? 'IS 456' : 'EN 1992-1-1',
      basicLength: Ld,
      modifiedLength: Math.ceil(lapLength),
      factors,
      classOfLap: lapClass,
      recommendations: [
        `Lap length = ${Math.ceil(lapLength)} mm`,
        `Stagger laps where possible`
      ]
    };
  }
}

// ============================================================================
// COVER REQUIREMENTS
// ============================================================================

export class CoverRequirements {
  /**
   * Minimum cover per ACI 318
   */
  static coverACI(
    exposureCategory: 'F0' | 'F1' | 'F2' | 'F3' | 'S0' | 'S1' | 'S2' | 'S3' | 'C0' | 'C1' | 'C2' | 'W0' | 'W1' | 'W2',
    elementType: 'cast-against-soil' | 'exposed-to-weather' | 'not-exposed',
    barDiameter: number
  ): CoverRequirements {
    let minCover: number;
    const factors: string[] = [];
    
    if (elementType === 'cast-against-soil') {
      minCover = 75;
      factors.push('Cast against ground');
    } else if (elementType === 'exposed-to-weather') {
      if (barDiameter <= 16) {
        minCover = 40;
      } else {
        minCover = 50;
      }
      factors.push('Exposed to weather');
    } else {
      if (barDiameter <= 36) {
        minCover = 40; // Beams, columns
      } else {
        minCover = 40;
      }
    }
    
    // Exposure adjustments
    if (exposureCategory.startsWith('S') || exposureCategory.startsWith('C')) {
      minCover = Math.max(minCover, 50);
      factors.push('Corrosive environment');
    }
    
    // Nominal cover = minimum + tolerance
    const nominalCover = minCover + 10;

    return {
      code: 'ACI 318-19',
      minimumCover: minCover,
      nominalCover,
      factors
    };
  }

  /**
   * Cover requirements per IS 456
   */
  static coverIS(
    exposure: 'mild' | 'moderate' | 'severe' | 'very-severe' | 'extreme',
    elementType: 'slab' | 'beam' | 'column' | 'foundation'
  ): CoverRequirements {
    // IS 456 Table 16 and Table 16A
    const covers: Record<string, Record<string, number>> = {
      'mild': { slab: 20, beam: 25, column: 40, foundation: 50 },
      'moderate': { slab: 30, beam: 30, column: 40, foundation: 50 },
      'severe': { slab: 45, beam: 45, column: 45, foundation: 75 },
      'very-severe': { slab: 50, beam: 50, column: 50, foundation: 75 },
      'extreme': { slab: 75, beam: 75, column: 75, foundation: 75 }
    };
    
    const minCover = covers[exposure]?.[elementType] || 40;
    const factors: string[] = [`${exposure} exposure`, `${elementType} element`];

    return {
      code: 'IS 456:2000',
      minimumCover: minCover,
      nominalCover: minCover + 10,
      factors
    };
  }

  /**
   * Cover requirements per Eurocode 2
   */
  static coverEC2(
    exposureClass: 'XC1' | 'XC2' | 'XC3' | 'XC4' | 'XD1' | 'XD2' | 'XD3' | 'XS1' | 'XS2' | 'XS3',
    structuralClass: 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' = 'S4',
    barDiameter: number = 20
  ): CoverRequirements {
    // EN 1992-1-1 Table 4.4N
    const cminDur: Record<string, Record<string, number>> = {
      'XC1': { S1: 10, S2: 10, S3: 10, S4: 15, S5: 20, S6: 25 },
      'XC2': { S1: 10, S2: 15, S3: 20, S4: 25, S5: 30, S6: 35 },
      'XC3': { S1: 10, S2: 15, S3: 20, S4: 25, S5: 30, S6: 35 },
      'XC4': { S1: 15, S2: 20, S3: 25, S4: 30, S5: 35, S6: 40 },
      'XD1': { S1: 20, S2: 25, S3: 30, S4: 35, S5: 40, S6: 45 },
      'XD2': { S1: 25, S2: 30, S3: 35, S4: 40, S5: 45, S6: 50 },
      'XD3': { S1: 30, S2: 35, S3: 40, S4: 45, S5: 50, S6: 55 },
      'XS1': { S1: 20, S2: 25, S3: 30, S4: 35, S5: 40, S6: 45 },
      'XS2': { S1: 25, S2: 30, S3: 35, S4: 40, S5: 45, S6: 50 },
      'XS3': { S1: 30, S2: 35, S3: 40, S4: 45, S5: 50, S6: 55 }
    };
    
    const cmin_dur = cminDur[exposureClass]?.[structuralClass] || 35;
    const cmin_b = barDiameter; // Minimum cover for bond
    const cmin = Math.max(cmin_dur, cmin_b, 10);
    
    // Nominal cover
    const deltaCdev = 10; // Allowance for deviation
    const cnom = cmin + deltaCdev;

    return {
      code: 'EN 1992-1-1',
      minimumCover: cmin,
      nominalCover: cnom,
      factors: [
        `Exposure class: ${exposureClass}`,
        `Structural class: ${structuralClass}`,
        `cmin,dur = ${cmin_dur} mm`,
        `cmin,b = ${cmin_b} mm`
      ]
    };
  }
}

// ============================================================================
// BAR SPACING REQUIREMENTS
// ============================================================================

export class BarSpacing {
  /**
   * Minimum bar spacing per ACI 318
   */
  static minimumSpacingACI(
    barDiameter: number,
    maxAggregateSize: number = 20 // mm
  ): {
    horizontal: number;
    vertical: number;
    bundled: number;
  } {
    const db = barDiameter;
    const dagg = maxAggregateSize;
    
    // ACI 318-19 Section 25.2
    const horizontal = Math.max(db, 1.33 * dagg, 25);
    const vertical = Math.max(db, 25);
    
    // Bundled bars - treat as single bar of equivalent diameter
    const bundled = 1.5 * horizontal;

    return {
      horizontal: Math.ceil(horizontal),
      vertical: Math.ceil(vertical),
      bundled: Math.ceil(bundled)
    };
  }

  /**
   * Maximum bar spacing per code
   */
  static maximumSpacing(
    elementType: 'slab' | 'beam' | 'wall',
    thickness: number, // mm
    code: 'ACI' | 'IS' | 'EC2'
  ): number {
    if (code === 'ACI') {
      if (elementType === 'slab' || elementType === 'wall') {
        return Math.min(3 * thickness, 450);
      } else {
        return Math.min(thickness, 300);
      }
    } else if (code === 'IS') {
      if (elementType === 'slab') {
        return Math.min(3 * thickness, 300);
      } else {
        return 300;
      }
    } else {
      // EC2
      if (elementType === 'slab') {
        return Math.min(3.5 * thickness, 400);
      } else {
        return 400;
      }
    }
  }

  /**
   * Check bar arrangement fits in section
   */
  static checkArrangement(
    sectionWidth: number, // mm
    cover: number, // mm
    stirrupDiameter: number, // mm
    mainBars: { diameter: number; count: number }[],
    minSpacing: number
  ): {
    fits: boolean;
    requiredWidth: number;
    actualSpacing: number;
    layers: number;
    recommendation: string;
  } {
    const clearWidth = sectionWidth - 2 * cover - 2 * stirrupDiameter;
    
    // Total bar diameter in one layer
    const totalBars = mainBars.reduce((sum, b) => sum + b.count, 0);
    const avgDiameter = mainBars.reduce((sum, b) => sum + b.count * b.diameter, 0) / totalBars;
    
    // Required width for single layer
    const requiredWidth = totalBars * avgDiameter + (totalBars - 1) * minSpacing;
    
    if (requiredWidth <= clearWidth) {
      const actualSpacing = (clearWidth - totalBars * avgDiameter) / (totalBars - 1);
      return {
        fits: true,
        requiredWidth,
        actualSpacing: Math.floor(actualSpacing),
        layers: 1,
        recommendation: `Single layer with ${Math.floor(actualSpacing)}mm clear spacing`
      };
    } else {
      // Need multiple layers
      const barsPerLayer = Math.floor((clearWidth + minSpacing) / (avgDiameter + minSpacing));
      const layers = Math.ceil(totalBars / barsPerLayer);
      const actualSpacing = (clearWidth - barsPerLayer * avgDiameter) / (barsPerLayer - 1);
      
      return {
        fits: false,
        requiredWidth,
        actualSpacing: Math.max(minSpacing, Math.floor(actualSpacing)),
        layers,
        recommendation: `Use ${layers} layers with ${barsPerLayer} bars per layer`
      };
    }
  }
}

// ============================================================================
// BAR BENDING SCHEDULE
// ============================================================================

export class BarBendingSchedule {
  /**
   * Generate bar bending schedule for beam
   */
  static beamSchedule(
    beam: {
      id: string;
      span: number; // mm
      width: number; // mm
      depth: number; // mm
      cover: number; // mm
    },
    reinforcement: {
      top: { diameter: number; count: number };
      bottom: { diameter: number; count: number };
      stirrups: { diameter: number; spacing: number };
      bentBars?: { diameter: number; count: number };
    }
  ): ReinforcementSchedule {
    const bars: Bar[] = [];
    const { span, width, depth, cover } = beam;
    const stirrupDia = reinforcement.stirrups.diameter;
    
    // Bottom bars (straight or with hooks)
    const bottomLength = span - 2 * cover + 2 * 12 * reinforcement.bottom.diameter;
    bars.push({
      mark: 'A',
      diameter: reinforcement.bottom.diameter,
      noOfBars: reinforcement.bottom.count,
      length: Math.ceil(bottomLength),
      shape: {
        code: '11',
        dimensions: { A: span - 2 * cover, B: 12 * reinforcement.bottom.diameter },
        bendingRadius: 4 * reinforcement.bottom.diameter,
        description: 'Bottom bar with 90° hooks'
      },
      material: 'HYSD',
      grade: 500
    });
    
    // Top bars
    const topLength = span - 2 * cover + 2 * 12 * reinforcement.top.diameter;
    bars.push({
      mark: 'B',
      diameter: reinforcement.top.diameter,
      noOfBars: reinforcement.top.count,
      length: Math.ceil(topLength),
      shape: {
        code: '11',
        dimensions: { A: span - 2 * cover, B: 12 * reinforcement.top.diameter },
        bendingRadius: 4 * reinforcement.top.diameter,
        description: 'Top bar with 90° hooks'
      },
      material: 'HYSD',
      grade: 500
    });
    
    // Stirrups
    const stirrupWidth = width - 2 * cover - 2 * stirrupDia;
    const stirrupHeight = depth - 2 * cover - 2 * stirrupDia;
    const stirrupLength = BarShapes.stirrupCutLength(stirrupWidth, stirrupHeight, stirrupDia);
    const noOfStirrups = Math.ceil((span - 2 * cover) / reinforcement.stirrups.spacing) + 1;
    
    bars.push({
      mark: 'C',
      diameter: stirrupDia,
      noOfBars: noOfStirrups,
      length: Math.ceil(stirrupLength),
      shape: BarShapes.stirrup(stirrupWidth, stirrupHeight, stirrupDia),
      material: 'HYSD',
      grade: 500
    });
    
    // Bent-up bars (if specified)
    if (reinforcement.bentBars) {
      const bentLength = span * 1.41; // Approximate for 45° bend
      bars.push({
        mark: 'D',
        diameter: reinforcement.bentBars.diameter,
        noOfBars: reinforcement.bentBars.count,
        length: Math.ceil(bentLength),
        shape: {
          code: '21',
          dimensions: { A: span / 3, B: depth * 0.707, C: span / 3 },
          bendingRadius: 4 * reinforcement.bentBars.diameter,
          description: 'Bent-up bar at 45°'
        },
        material: 'HYSD',
        grade: 500
      });
    }
    
    // Calculate weights
    const totalWeight = bars.reduce((sum, bar) => 
      sum + BarProperties.getWeight(bar.diameter, bar.length, bar.noOfBars), 0);
    
    // Steel ratio
    const totalArea = bars.reduce((sum, bar) => 
      sum + BarProperties.getArea(bar.diameter) * bar.noOfBars, 0);
    const steelRatio = (totalArea / (width * depth)) * 100;
    
    // Summary by diameter
    const byDiameter: Map<number, { length: number; weight: number }> = new Map();
    for (const bar of bars) {
      const existing = byDiameter.get(bar.diameter) || { length: 0, weight: 0 };
      existing.length += bar.length * bar.noOfBars / 1000;
      existing.weight += BarProperties.getWeight(bar.diameter, bar.length, bar.noOfBars);
      byDiameter.set(bar.diameter, existing);
    }

    return {
      element: {
        type: 'beam',
        id: beam.id,
        dimensions: { length: span, width, height: depth },
        concrete: {
          grade: 30,
          cover: { top: cover, bottom: cover, side: cover },
          exposureClass: 'XC1'
        }
      },
      bars,
      totalWeight: Math.ceil(totalWeight * 10) / 10,
      steelRatio: Math.round(steelRatio * 100) / 100,
      summary: {
        byDiameter: Array.from(byDiameter.entries()).map(([d, v]) => ({
          diameter: d,
          totalLength: Math.ceil(v.length * 10) / 10,
          weight: Math.ceil(v.weight * 10) / 10
        })),
        byShape: bars.map(b => ({
          shape: b.shape.code,
          count: b.noOfBars
        }))
      }
    };
  }

  /**
   * Generate schedule for column
   */
  static columnSchedule(
    column: {
      id: string;
      width: number;
      depth: number;
      height: number; // floor height
      cover: number;
    },
    reinforcement: {
      main: { diameter: number; count: number };
      ties: { diameter: number; spacing: number };
    },
    lapZone: 'bottom' | 'middle' | 'top' = 'bottom'
  ): ReinforcementSchedule {
    const bars: Bar[] = [];
    const { width, depth, height, cover } = column;
    const tieDia = reinforcement.ties.diameter;
    
    // Main bars with lap
    const lapLength = 50 * reinforcement.main.diameter;
    const mainLength = height + lapLength;
    
    bars.push({
      mark: 'M1',
      diameter: reinforcement.main.diameter,
      noOfBars: reinforcement.main.count,
      length: Math.ceil(mainLength),
      shape: {
        code: '00',
        dimensions: { A: mainLength },
        bendingRadius: 0,
        description: 'Straight main bar with lap'
      },
      material: 'HYSD',
      grade: 500
    });
    
    // Ties
    const tieWidth = width - 2 * cover - tieDia;
    const tieDepth = depth - 2 * cover - tieDia;
    const tieLength = BarShapes.stirrupCutLength(tieWidth, tieDepth, tieDia, '135deg');
    const noOfTies = Math.ceil(height / reinforcement.ties.spacing) + 1;
    
    bars.push({
      mark: 'T1',
      diameter: tieDia,
      noOfBars: noOfTies,
      length: Math.ceil(tieLength),
      shape: BarShapes.stirrup(tieWidth, tieDepth, tieDia),
      material: 'HYSD',
      grade: 500
    });
    
    // Crosstie if needed
    if (reinforcement.main.count > 4) {
      const crosstieLength = depth - 2 * cover - 2 * tieDia + 2 * 6 * tieDia;
      bars.push({
        mark: 'CT',
        diameter: tieDia,
        noOfBars: noOfTies,
        length: Math.ceil(crosstieLength),
        shape: {
          code: '11',
          dimensions: { A: depth - 2 * cover - 2 * tieDia, B: 6 * tieDia },
          bendingRadius: 4 * tieDia,
          description: 'Crosstie with 135° hooks'
        },
        material: 'HYSD',
        grade: 500
      });
    }
    
    // Calculate totals
    const totalWeight = bars.reduce((sum, bar) => 
      sum + BarProperties.getWeight(bar.diameter, bar.length, bar.noOfBars), 0);
    
    const totalArea = reinforcement.main.count * BarProperties.getArea(reinforcement.main.diameter);
    const steelRatio = (totalArea / (width * depth)) * 100;

    return {
      element: {
        type: 'column',
        id: column.id,
        dimensions: { width, height: depth, length: height },
        concrete: {
          grade: 40,
          cover: { top: cover, bottom: cover, side: cover },
          exposureClass: 'XC1'
        }
      },
      bars,
      totalWeight: Math.ceil(totalWeight * 10) / 10,
      steelRatio: Math.round(steelRatio * 100) / 100,
      summary: {
        byDiameter: bars.reduce((acc, bar) => {
          const existing = acc.find(d => d.diameter === bar.diameter);
          const weight = BarProperties.getWeight(bar.diameter, bar.length, bar.noOfBars);
          if (existing) {
            existing.totalLength += bar.length * bar.noOfBars / 1000;
            existing.weight += weight;
          } else {
            acc.push({
              diameter: bar.diameter,
              totalLength: bar.length * bar.noOfBars / 1000,
              weight
            });
          }
          return acc;
        }, [] as { diameter: number; totalLength: number; weight: number }[]),
        byShape: bars.map(b => ({ shape: b.shape.code, count: b.noOfBars }))
      }
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  BarProperties,
  BarShapes,
  LapAndDevelopment,
  CoverRequirements,
  BarSpacing,
  BarBendingSchedule
};
