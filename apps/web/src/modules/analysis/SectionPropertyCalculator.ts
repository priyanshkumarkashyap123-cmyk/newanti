/**
 * ============================================================================
 * ADVANCED SECTION PROPERTY CALCULATOR
 * ============================================================================
 * 
 * Comprehensive cross-section analysis for structural members:
 * - Standard section properties (I, Z, r, A)
 * - Composite section analysis
 * - Plastic section modulus
 * - Shear center and torsional properties
 * - Warping constants
 * - Effective section for local buckling
 * - Cracked section analysis for RC
 * 
 * Supports:
 * - Standard steel sections (I, C, L, T, Box, Pipe)
 * - Custom arbitrary sections
 * - Reinforced concrete sections
 * - Composite steel-concrete sections
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Point2D {
  x: number;
  y: number;
}

export interface SectionProperties {
  // Geometric properties
  A: number; // Area (mm²)
  Ix: number; // Second moment about x-axis (mm⁴)
  Iy: number; // Second moment about y-axis (mm⁴)
  Ixy: number; // Product of inertia (mm⁴)
  
  // Centroid
  Cx: number; // X-coordinate of centroid (mm)
  Cy: number; // Y-coordinate of centroid (mm)
  
  // Section moduli
  Zx_top: number; // Elastic section modulus about x, top fiber (mm³)
  Zx_bot: number; // Elastic section modulus about x, bottom fiber (mm³)
  Zy_left: number; // Elastic section modulus about y, left fiber (mm³)
  Zy_right: number; // Elastic section modulus about y, right fiber (mm³)
  
  // Plastic section moduli
  Zpx: number; // Plastic section modulus about x (mm³)
  Zpy: number; // Plastic section modulus about y (mm³)
  
  // Radius of gyration
  rx: number; // About x-axis (mm)
  ry: number; // About y-axis (mm)
  rz: number; // Minimum (mm)
  
  // Principal axes
  Iu: number; // Principal moment of inertia, major (mm⁴)
  Iv: number; // Principal moment of inertia, minor (mm⁴)
  theta: number; // Angle to principal axes (radians)
  
  // Torsional properties
  J: number; // Torsional constant (mm⁴)
  Cw: number; // Warping constant (mm⁶)
  
  // Shear center
  ex: number; // X-coordinate of shear center (mm)
  ey: number; // Y-coordinate of shear center (mm)
}

export interface RectangleDefinition {
  type: 'rectangle';
  width: number;
  height: number;
  cx?: number;
  cy?: number;
}

export interface CircleDefinition {
  type: 'circle';
  diameter: number;
  cx?: number;
  cy?: number;
}

export interface HollowCircleDefinition {
  type: 'hollow-circle';
  outerDiameter: number;
  innerDiameter: number;
  cx?: number;
  cy?: number;
}

export interface ISectionDefinition {
  type: 'I-section';
  flangeWidth: number;
  flangeThickness: number;
  webHeight: number;
  webThickness: number;
}

export interface TSectionDefinition {
  type: 'T-section';
  flangeWidth: number;
  flangeThickness: number;
  stemHeight: number;
  stemThickness: number;
}

export interface ChannelDefinition {
  type: 'channel';
  flangeWidth: number;
  flangeThickness: number;
  webHeight: number;
  webThickness: number;
}

export interface AngleDefinition {
  type: 'angle';
  legWidth: number;
  legHeight: number;
  thickness: number;
}

export interface BoxDefinition {
  type: 'box';
  outerWidth: number;
  outerHeight: number;
  thickness: number;
}

export interface PolygonDefinition {
  type: 'polygon';
  vertices: Point2D[];
  holes?: Point2D[][];
}

export type SectionDefinition = 
  | RectangleDefinition 
  | CircleDefinition 
  | HollowCircleDefinition
  | ISectionDefinition 
  | TSectionDefinition 
  | ChannelDefinition 
  | AngleDefinition 
  | BoxDefinition
  | PolygonDefinition;

export interface Material {
  E: number; // Modulus of elasticity (MPa)
  G?: number; // Shear modulus (MPa)
  fy?: number; // Yield strength (MPa)
  fu?: number; // Ultimate strength (MPa)
}

// ============================================================================
// SECTION PROPERTY CALCULATOR
// ============================================================================

export class SectionPropertyCalculator {
  /**
   * Calculate properties for any section type
   */
  static calculate(section: SectionDefinition): SectionProperties {
    switch (section.type) {
      case 'rectangle':
        return this.calculateRectangle(section);
      case 'circle':
        return this.calculateCircle(section);
      case 'hollow-circle':
        return this.calculateHollowCircle(section);
      case 'I-section':
        return this.calculateISection(section);
      case 'T-section':
        return this.calculateTSection(section);
      case 'channel':
        return this.calculateChannel(section);
      case 'angle':
        return this.calculateAngle(section);
      case 'box':
        return this.calculateBox(section);
      case 'polygon':
        return this.calculatePolygon(section);
      default:
        throw new Error('Unsupported section type');
    }
  }

  /**
   * Rectangle section
   */
  static calculateRectangle(section: RectangleDefinition): SectionProperties {
    const { width: b, height: h } = section;
    const cx = section.cx ?? 0;
    const cy = section.cy ?? 0;

    const A = b * h;
    const Ix = (b * h ** 3) / 12;
    const Iy = (h * b ** 3) / 12;
    const J = (b * h ** 3) / 3 * (1 - 0.63 * (h / b) * (1 - (h ** 4) / (12 * b ** 4))); // Approx for rectangle

    return {
      A,
      Ix,
      Iy,
      Ixy: 0,
      Cx: cx,
      Cy: cy,
      Zx_top: Ix / (h / 2),
      Zx_bot: Ix / (h / 2),
      Zy_left: Iy / (b / 2),
      Zy_right: Iy / (b / 2),
      Zpx: (b * h ** 2) / 4,
      Zpy: (h * b ** 2) / 4,
      rx: Math.sqrt(Ix / A),
      ry: Math.sqrt(Iy / A),
      rz: Math.min(Math.sqrt(Ix / A), Math.sqrt(Iy / A)),
      Iu: Math.max(Ix, Iy),
      Iv: Math.min(Ix, Iy),
      theta: 0,
      J: J > 0 ? J : (b * h ** 3) / 3,
      Cw: 0, // Solid rectangle has negligible warping
      ex: cx,
      ey: cy
    };
  }

  /**
   * Solid circle section
   */
  static calculateCircle(section: CircleDefinition): SectionProperties {
    const { diameter: d } = section;
    const r = d / 2;
    const cx = section.cx ?? 0;
    const cy = section.cy ?? 0;

    const A = Math.PI * r ** 2;
    const I = (Math.PI * d ** 4) / 64;
    const J = (Math.PI * d ** 4) / 32;

    return {
      A,
      Ix: I,
      Iy: I,
      Ixy: 0,
      Cx: cx,
      Cy: cy,
      Zx_top: I / r,
      Zx_bot: I / r,
      Zy_left: I / r,
      Zy_right: I / r,
      Zpx: (d ** 3) / 6,
      Zpy: (d ** 3) / 6,
      rx: r / 2,
      ry: r / 2,
      rz: r / 2,
      Iu: I,
      Iv: I,
      theta: 0,
      J,
      Cw: 0,
      ex: cx,
      ey: cy
    };
  }

  /**
   * Hollow circular section (pipe/tube)
   */
  static calculateHollowCircle(section: HollowCircleDefinition): SectionProperties {
    const { outerDiameter: D, innerDiameter: d } = section;
    const R = D / 2;
    const r = d / 2;
    const cx = section.cx ?? 0;
    const cy = section.cy ?? 0;

    const A = Math.PI * (R ** 2 - r ** 2);
    const I = (Math.PI / 64) * (D ** 4 - d ** 4);
    const J = (Math.PI / 32) * (D ** 4 - d ** 4);

    return {
      A,
      Ix: I,
      Iy: I,
      Ixy: 0,
      Cx: cx,
      Cy: cy,
      Zx_top: I / R,
      Zx_bot: I / R,
      Zy_left: I / R,
      Zy_right: I / R,
      Zpx: (D ** 3 - d ** 3) / 6,
      Zpy: (D ** 3 - d ** 3) / 6,
      rx: Math.sqrt(I / A),
      ry: Math.sqrt(I / A),
      rz: Math.sqrt(I / A),
      Iu: I,
      Iv: I,
      theta: 0,
      J,
      Cw: 0,
      ex: cx,
      ey: cy
    };
  }

  /**
   * I-section (doubly symmetric)
   */
  static calculateISection(section: ISectionDefinition): SectionProperties {
    const { flangeWidth: bf, flangeThickness: tf, webHeight: hw, webThickness: tw } = section;
    const h = hw + 2 * tf; // Total height

    // Area
    const A_flange = bf * tf;
    const A_web = hw * tw;
    const A = 2 * A_flange + A_web;

    // Centroid (at geometric center for doubly symmetric)
    const Cx = bf / 2;
    const Cy = h / 2;

    // Second moment of area about centroidal x-axis
    const Ix_flanges = 2 * ((bf * tf ** 3) / 12 + A_flange * ((h - tf) / 2) ** 2);
    const Ix_web = (tw * hw ** 3) / 12;
    const Ix = Ix_flanges + Ix_web;

    // Second moment about y-axis
    const Iy_flanges = 2 * (tf * bf ** 3) / 12;
    const Iy_web = (hw * tw ** 3) / 12;
    const Iy = Iy_flanges + Iy_web;

    // Section moduli
    const Zx = Ix / (h / 2);
    const Zy = Iy / (bf / 2);

    // Plastic section modulus
    const Zpx = 2 * (bf * tf * (h - tf) / 2) + tw * (hw ** 2) / 4;
    const Zpy = 2 * (tf * (bf ** 2) / 4) + hw * (tw ** 2) / 4;

    // Torsional constant (thin-walled approximation)
    const J = (2 * bf * tf ** 3 + hw * tw ** 3) / 3;

    // Warping constant
    const Cw = (tf * bf ** 3 * (h - tf) ** 2) / 24;

    // Shear center (at centroid for doubly symmetric)
    const ex = Cx;
    const ey = Cy;

    return {
      A,
      Ix,
      Iy,
      Ixy: 0,
      Cx,
      Cy,
      Zx_top: Zx,
      Zx_bot: Zx,
      Zy_left: Zy,
      Zy_right: Zy,
      Zpx,
      Zpy,
      rx: Math.sqrt(Ix / A),
      ry: Math.sqrt(Iy / A),
      rz: Math.sqrt(Iy / A),
      Iu: Ix,
      Iv: Iy,
      theta: 0,
      J,
      Cw,
      ex,
      ey
    };
  }

  /**
   * T-section
   */
  static calculateTSection(section: TSectionDefinition): SectionProperties {
    const { flangeWidth: bf, flangeThickness: tf, stemHeight: hs, stemThickness: tw } = section;
    const h = tf + hs; // Total height

    // Areas
    const A_flange = bf * tf;
    const A_stem = hs * tw;
    const A = A_flange + A_stem;

    // Centroid (measuring from bottom of stem)
    const y_flange = hs + tf / 2;
    const y_stem = hs / 2;
    const Cy = (A_flange * y_flange + A_stem * y_stem) / A;
    const Cx = bf / 2;

    // Distance from centroid to extreme fibers
    const y_top = h - Cy;
    const y_bot = Cy;

    // Second moment about centroidal x-axis
    const Ix_flange = (bf * tf ** 3) / 12 + A_flange * (y_flange - Cy) ** 2;
    const Ix_stem = (tw * hs ** 3) / 12 + A_stem * (Cy - y_stem) ** 2;
    const Ix = Ix_flange + Ix_stem;

    // Second moment about y-axis
    const Iy_flange = (tf * bf ** 3) / 12;
    const Iy_stem = (hs * tw ** 3) / 12;
    const Iy = Iy_flange + Iy_stem;

    // Torsional constant
    const J = (bf * tf ** 3 + hs * tw ** 3) / 3;

    // Plastic section modulus (approximate)
    const Zpx = A * Cy / 2 + A * (h - Cy) / 2;

    return {
      A,
      Ix,
      Iy,
      Ixy: 0,
      Cx,
      Cy,
      Zx_top: Ix / y_top,
      Zx_bot: Ix / y_bot,
      Zy_left: Iy / (bf / 2),
      Zy_right: Iy / (bf / 2),
      Zpx,
      Zpy: (tf * bf ** 2 + hs * tw ** 2) / 4,
      rx: Math.sqrt(Ix / A),
      ry: Math.sqrt(Iy / A),
      rz: Math.sqrt(Iy / A),
      Iu: Ix,
      Iv: Iy,
      theta: 0,
      J,
      Cw: 0, // T-sections have minimal warping resistance
      ex: Cx,
      ey: Cy + (tf * bf ** 3 * (h - Cy - tf / 2)) / (3 * Ix) // Approximate shear center
    };
  }

  /**
   * Channel section
   */
  static calculateChannel(section: ChannelDefinition): SectionProperties {
    const { flangeWidth: bf, flangeThickness: tf, webHeight: hw, webThickness: tw } = section;
    const h = hw + 2 * tf; // Total height

    // Areas
    const A_flanges = 2 * bf * tf;
    const A_web = hw * tw;
    const A = A_flanges + A_web;

    // Centroid
    const Cy = h / 2;
    const Cx = (2 * bf * tf * bf / 2 + hw * tw * tw / 2) / A;

    // Second moments
    const Ix_flanges = 2 * ((bf * tf ** 3) / 12 + bf * tf * ((h - tf) / 2) ** 2);
    const Ix_web = (tw * hw ** 3) / 12;
    const Ix = Ix_flanges + Ix_web;

    const Iy_flanges = 2 * ((tf * bf ** 3) / 12 + bf * tf * (bf / 2 - Cx) ** 2);
    const Iy_web = (hw * tw ** 3) / 12 + hw * tw * (tw / 2 - Cx) ** 2;
    const Iy = Iy_flanges + Iy_web;

    // Torsional constant
    const J = (2 * bf * tf ** 3 + hw * tw ** 3) / 3;

    // Shear center (outside the section)
    const ex = Cx - (3 * bf ** 2 * tf) / (hw * tw + 6 * bf * tf);

    return {
      A,
      Ix,
      Iy,
      Ixy: 0,
      Cx,
      Cy,
      Zx_top: Ix / (h / 2),
      Zx_bot: Ix / (h / 2),
      Zy_left: Iy / Cx,
      Zy_right: Iy / (bf - Cx),
      Zpx: 2 * bf * tf * (h - tf) / 2 + tw * hw ** 2 / 4,
      Zpy: 2 * tf * bf ** 2 / 4 + hw * tw ** 2 / 4,
      rx: Math.sqrt(Ix / A),
      ry: Math.sqrt(Iy / A),
      rz: Math.sqrt(Iy / A),
      Iu: Ix,
      Iv: Iy,
      theta: 0,
      J,
      Cw: (h - tf) ** 2 * bf ** 3 * tf / 12 * (hw * tw + 2 * bf * tf) / (hw * tw + 6 * bf * tf),
      ex,
      ey: Cy
    };
  }

  /**
   * Angle section (equal or unequal leg)
   */
  static calculateAngle(section: AngleDefinition): SectionProperties {
    const { legWidth: b, legHeight: d, thickness: t } = section;

    // Areas
    const A_vert = d * t;
    const A_horiz = (b - t) * t;
    const A = A_vert + A_horiz;

    // Centroid
    const Cx = (A_vert * t / 2 + A_horiz * ((b - t) / 2 + t)) / A;
    const Cy = (A_vert * d / 2 + A_horiz * t / 2) / A;

    // Second moments about centroidal axes
    const Ix_vert = (t * d ** 3) / 12 + A_vert * (d / 2 - Cy) ** 2;
    const Ix_horiz = ((b - t) * t ** 3) / 12 + A_horiz * (Cy - t / 2) ** 2;
    const Ix = Ix_vert + Ix_horiz;

    const Iy_vert = (d * t ** 3) / 12 + A_vert * (Cx - t / 2) ** 2;
    const Iy_horiz = (t * (b - t) ** 3) / 12 + A_horiz * ((b - t) / 2 + t - Cx) ** 2;
    const Iy = Iy_vert + Iy_horiz;

    // Product of inertia
    const Ixy_vert = A_vert * (t / 2 - Cx) * (d / 2 - Cy);
    const Ixy_horiz = A_horiz * ((b + t) / 2 - Cx) * (t / 2 - Cy);
    const Ixy = Ixy_vert + Ixy_horiz;

    // Principal axes
    const theta = 0.5 * Math.atan2(2 * Ixy, Iy - Ix);
    const Iavg = (Ix + Iy) / 2;
    const Idiff = Math.sqrt(((Ix - Iy) / 2) ** 2 + Ixy ** 2);
    const Iu = Iavg + Idiff;
    const Iv = Iavg - Idiff;

    // Torsional constant
    const J = (d + b - t) * t ** 3 / 3;

    return {
      A,
      Ix,
      Iy,
      Ixy,
      Cx,
      Cy,
      Zx_top: Ix / (d - Cy),
      Zx_bot: Ix / Cy,
      Zy_left: Iy / Cx,
      Zy_right: Iy / (b - Cx),
      Zpx: A * (d - Cy) / 2 + A * Cy / 2,
      Zpy: A * (b - Cx) / 2 + A * Cx / 2,
      rx: Math.sqrt(Ix / A),
      ry: Math.sqrt(Iy / A),
      rz: Math.sqrt(Iv / A),
      Iu,
      Iv,
      theta,
      J,
      Cw: 0, // Angles have negligible warping resistance
      ex: Cx - t / 2, // Approximate
      ey: Cy - t / 2
    };
  }

  /**
   * Box/rectangular hollow section
   */
  static calculateBox(section: BoxDefinition): SectionProperties {
    const { outerWidth: B, outerHeight: H, thickness: t } = section;
    const b = B - 2 * t;
    const h = H - 2 * t;

    const A = B * H - b * h;

    const Ix = (B * H ** 3 - b * h ** 3) / 12;
    const Iy = (H * B ** 3 - h * b ** 3) / 12;

    const Cx = B / 2;
    const Cy = H / 2;

    // Torsional constant for closed section
    const Am = (B - t) * (H - t); // Mean enclosed area
    const s = 2 * (B + H) - 4 * t; // Mean perimeter
    const J = (4 * Am ** 2 * t) / s;

    return {
      A,
      Ix,
      Iy,
      Ixy: 0,
      Cx,
      Cy,
      Zx_top: Ix / (H / 2),
      Zx_bot: Ix / (H / 2),
      Zy_left: Iy / (B / 2),
      Zy_right: Iy / (B / 2),
      Zpx: (B * H ** 2 - b * h ** 2) / 4,
      Zpy: (H * B ** 2 - h * b ** 2) / 4,
      rx: Math.sqrt(Ix / A),
      ry: Math.sqrt(Iy / A),
      rz: Math.min(Math.sqrt(Ix / A), Math.sqrt(Iy / A)),
      Iu: Math.max(Ix, Iy),
      Iv: Math.min(Ix, Iy),
      theta: 0,
      J,
      Cw: 0, // Closed sections have negligible warping
      ex: Cx,
      ey: Cy
    };
  }

  /**
   * General polygon section (using numerical integration)
   */
  static calculatePolygon(section: PolygonDefinition): SectionProperties {
    const { vertices, holes = [] } = section;

    // Calculate area and centroid using shoelace formula
    let A = this.polygonArea(vertices);
    let Cx = this.polygonCentroidX(vertices, A);
    let Cy = this.polygonCentroidY(vertices, A);

    // Subtract holes
    for (const hole of holes) {
      const holeArea = this.polygonArea(hole);
      const holeCx = this.polygonCentroidX(hole, holeArea);
      const holeCy = this.polygonCentroidY(hole, holeArea);

      Cx = (Cx * A - holeCx * Math.abs(holeArea)) / (A - Math.abs(holeArea));
      Cy = (Cy * A - holeCy * Math.abs(holeArea)) / (A - Math.abs(holeArea));
      A -= Math.abs(holeArea);
    }

    // Calculate moments of inertia
    let Ix = this.polygonIx(vertices, Cy);
    let Iy = this.polygonIy(vertices, Cx);
    let Ixy = this.polygonIxy(vertices, Cx, Cy);

    for (const hole of holes) {
      Ix -= this.polygonIx(hole, Cy);
      Iy -= this.polygonIy(hole, Cx);
      Ixy -= this.polygonIxy(hole, Cx, Cy);
    }

    // Find extreme points
    const yMax = Math.max(...vertices.map(v => v.y));
    const yMin = Math.min(...vertices.map(v => v.y));
    const xMax = Math.max(...vertices.map(v => v.x));
    const xMin = Math.min(...vertices.map(v => v.x));

    // Principal axes
    const theta = 0.5 * Math.atan2(2 * Ixy, Iy - Ix);
    const Iavg = (Ix + Iy) / 2;
    const Idiff = Math.sqrt(((Ix - Iy) / 2) ** 2 + Ixy ** 2);
    const Iu = Iavg + Idiff;
    const Iv = Iavg - Idiff;

    return {
      A,
      Ix,
      Iy,
      Ixy,
      Cx,
      Cy,
      Zx_top: Ix / (yMax - Cy),
      Zx_bot: Ix / (Cy - yMin),
      Zy_left: Iy / (Cx - xMin),
      Zy_right: Iy / (xMax - Cx),
      Zpx: this.estimatePlasticModulus(vertices, holes, 'x'),
      Zpy: this.estimatePlasticModulus(vertices, holes, 'y'),
      rx: Math.sqrt(Ix / A),
      ry: Math.sqrt(Iy / A),
      rz: Math.sqrt(Iv / A),
      Iu,
      Iv,
      theta,
      J: this.estimateTorsionalConstant(vertices, holes),
      Cw: 0, // Would need more complex calculation
      ex: Cx,
      ey: Cy
    };
  }

  // Helper methods for polygon calculations
  private static polygonArea(vertices: Point2D[]): number {
    let area = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }
    return Math.abs(area) / 2;
  }

  private static polygonCentroidX(vertices: Point2D[], area: number): number {
    let cx = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const cross = vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
      cx += (vertices[i].x + vertices[j].x) * cross;
    }
    return cx / (6 * area);
  }

  private static polygonCentroidY(vertices: Point2D[], area: number): number {
    let cy = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const cross = vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
      cy += (vertices[i].y + vertices[j].y) * cross;
    }
    return cy / (6 * area);
  }

  private static polygonIx(vertices: Point2D[], cy: number): number {
    // Numerical integration approach
    let Ix = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const xi = vertices[i].x, yi = vertices[i].y - cy;
      const xj = vertices[j].x, yj = vertices[j].y - cy;
      Ix += (xi * yj - xj * yi) * (yi ** 2 + yi * yj + yj ** 2);
    }
    return Math.abs(Ix) / 12;
  }

  private static polygonIy(vertices: Point2D[], cx: number): number {
    let Iy = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const xi = vertices[i].x - cx, yi = vertices[i].y;
      const xj = vertices[j].x - cx, yj = vertices[j].y;
      Iy += (xi * yj - xj * yi) * (xi ** 2 + xi * xj + xj ** 2);
    }
    return Math.abs(Iy) / 12;
  }

  private static polygonIxy(vertices: Point2D[], cx: number, cy: number): number {
    let Ixy = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const xi = vertices[i].x - cx, yi = vertices[i].y - cy;
      const xj = vertices[j].x - cx, yj = vertices[j].y - cy;
      Ixy += (xi * yj - xj * yi) * (xi * yj + 2 * xi * yi + 2 * xj * yj + xj * yi);
    }
    return Ixy / 24;
  }

  private static estimatePlasticModulus(vertices: Point2D[], holes: Point2D[][], axis: 'x' | 'y'): number {
    // Simplified estimation
    const area = this.polygonArea(vertices);
    const yMax = Math.max(...vertices.map(v => v.y));
    const yMin = Math.min(...vertices.map(v => v.y));
    const xMax = Math.max(...vertices.map(v => v.x));
    const xMin = Math.min(...vertices.map(v => v.x));

    if (axis === 'x') {
      return area * (yMax - yMin) / 4;
    } else {
      return area * (xMax - xMin) / 4;
    }
  }

  private static estimateTorsionalConstant(vertices: Point2D[], holes: Point2D[][]): number {
    // Very approximate for arbitrary section
    const area = this.polygonArea(vertices);
    const perimeter = this.polygonPerimeter(vertices);
    return (4 * area ** 2) / perimeter; // Approximate as thin-walled
  }

  private static polygonPerimeter(vertices: Point2D[]): number {
    let perimeter = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = vertices[j].x - vertices[i].x;
      const dy = vertices[j].y - vertices[i].y;
      perimeter += Math.sqrt(dx ** 2 + dy ** 2);
    }
    return perimeter;
  }
}

// ============================================================================
// COMPOSITE SECTION CALCULATOR
// ============================================================================

export class CompositeSectionCalculator {
  /**
   * Calculate transformed section properties for composite sections
   */
  static calculateTransformed(
    sections: { properties: SectionProperties; material: Material; offsetX?: number; offsetY?: number }[],
    referenceMaterial: Material
  ): SectionProperties & { transformedAreas: number[] } {
    const n_ratios = sections.map(s => s.material.E / referenceMaterial.E);
    const transformedAreas: number[] = [];

    // Calculate transformed areas and centroids
    let totalArea = 0;
    let sumAx = 0;
    let sumAy = 0;

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const n = n_ratios[i];
      const A_tr = s.properties.A * n;
      transformedAreas.push(A_tr);

      const x = s.properties.Cx + (s.offsetX || 0);
      const y = s.properties.Cy + (s.offsetY || 0);

      totalArea += A_tr;
      sumAx += A_tr * x;
      sumAy += A_tr * y;
    }

    const Cx = sumAx / totalArea;
    const Cy = sumAy / totalArea;

    // Calculate transformed moments of inertia
    let Ix = 0;
    let Iy = 0;
    let Ixy = 0;

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const n = n_ratios[i];
      const dx = s.properties.Cx + (s.offsetX || 0) - Cx;
      const dy = s.properties.Cy + (s.offsetY || 0) - Cy;

      Ix += n * (s.properties.Ix + s.properties.A * dy ** 2);
      Iy += n * (s.properties.Iy + s.properties.A * dx ** 2);
      Ixy += n * (s.properties.Ixy + s.properties.A * dx * dy);
    }

    // Find extreme fibers (approximate)
    let yMax = 0, yMin = 0, xMax = 0, xMin = 0;
    for (const s of sections) {
      const y = s.properties.Cy + (s.offsetY || 0);
      const x = s.properties.Cx + (s.offsetX || 0);
      // Approximate based on typical section dimensions
      yMax = Math.max(yMax, y + 200);
      yMin = Math.min(yMin, y - 200);
      xMax = Math.max(xMax, x + 200);
      xMin = Math.min(xMin, x - 200);
    }

    return {
      A: totalArea,
      Ix,
      Iy,
      Ixy,
      Cx,
      Cy,
      Zx_top: Ix / (yMax - Cy),
      Zx_bot: Ix / (Cy - yMin),
      Zy_left: Iy / (Cx - xMin),
      Zy_right: Iy / (xMax - Cx),
      Zpx: 0, // Complex for composite
      Zpy: 0,
      rx: Math.sqrt(Ix / totalArea),
      ry: Math.sqrt(Iy / totalArea),
      rz: Math.sqrt(Math.min(Ix, Iy) / totalArea),
      Iu: Math.max(Ix, Iy),
      Iv: Math.min(Ix, Iy),
      theta: 0.5 * Math.atan2(2 * Ixy, Iy - Ix),
      J: 0, // Complex for composite
      Cw: 0,
      ex: Cx,
      ey: Cy,
      transformedAreas
    };
  }
}

// ============================================================================
// CRACKED SECTION ANALYZER (RC)
// ============================================================================

export class CrackedSectionAnalyzer {
  /**
   * Calculate cracked section properties for reinforced concrete
   */
  static analyze(
    section: { width: number; depth: number; cover: number },
    reinforcement: {
      tension: { area: number; depth: number }[];
      compression?: { area: number; depth: number }[];
    },
    materials: { Ec: number; Es: number }
  ): {
    neutralAxisDepth: number;
    Icr: number;
    crackedMomentOfInertia: number;
    effectiveDepth: number;
  } {
    const { width: b, depth: h, cover } = section;
    const { Ec, Es } = materials;
    const n = Es / Ec; // Modular ratio

    // Calculate effective depth
    const As = reinforcement.tension.reduce((sum, r) => sum + r.area, 0);
    const d = h - cover;

    // Compression steel
    const As_prime = reinforcement.compression?.reduce((sum, r) => sum + r.area, 0) || 0;
    const d_prime = cover;

    // Solve for neutral axis (quadratic equation for cracked section)
    // b*x²/2 + (n-1)*As'*(x-d') = n*As*(d-x)
    // b*x²/2 + n*As*x - n*As*d + (n-1)*As'*x - (n-1)*As'*d' = 0
    // b*x²/2 + (n*As + (n-1)*As')*x - (n*As*d + (n-1)*As'*d') = 0

    const a = b / 2;
    const bCoef = n * As + (n - 1) * As_prime;
    const c = -(n * As * d + (n - 1) * As_prime * d_prime);

    const x = (-bCoef + Math.sqrt(bCoef ** 2 - 4 * a * c)) / (2 * a);

    // Cracked moment of inertia
    const Icr = (b * x ** 3) / 3 + 
                n * As * (d - x) ** 2 + 
                (n - 1) * As_prime * (x - d_prime) ** 2;

    return {
      neutralAxisDepth: x,
      Icr,
      crackedMomentOfInertia: Icr,
      effectiveDepth: d
    };
  }

  /**
   * Calculate effective moment of inertia (Branson's equation)
   */
  static effectiveMomentOfInertia(
    Mcr: number, // Cracking moment
    Ma: number, // Applied moment
    Ig: number, // Gross moment of inertia
    Icr: number // Cracked moment of inertia
  ): number {
    if (Ma <= Mcr) {
      return Ig;
    }

    const ratio = Mcr / Ma;
    const Ie = (ratio ** 3) * Ig + (1 - ratio ** 3) * Icr;

    return Math.min(Ie, Ig);
  }
}

// ============================================================================
// EFFECTIVE SECTION FOR LOCAL BUCKLING
// ============================================================================

export class EffectiveSectionCalculator {
  /**
   * Calculate effective width for local buckling (thin-walled sections)
   * Based on Winter's formula
   */
  static effectiveWidth(
    width: number,
    thickness: number,
    fy: number,
    E: number,
    stressRatio: number = 1, // Compression stress ratio
    k: number = 4 // Buckling coefficient
  ): { effectiveWidth: number; slenderness: number; reductionFactor: number } {
    // Plate slenderness
    const lambda_p = (width / thickness) * Math.sqrt(fy / E);
    
    // Reference slenderness
    const lambda_ref = 1.052 * Math.sqrt(k) / Math.sqrt(stressRatio);

    // Reduction factor (Winter's formula)
    let rho = 1;
    if (lambda_p > lambda_ref) {
      rho = (1 - 0.22 / (lambda_p / lambda_ref)) / (lambda_p / lambda_ref);
      rho = Math.min(rho, 1);
    }

    return {
      effectiveWidth: width * rho,
      slenderness: lambda_p,
      reductionFactor: rho
    };
  }

  /**
   * Calculate effective section for Class 4 steel section
   */
  static calculateEffectiveISection(
    section: ISectionDefinition,
    fy: number,
    E: number = 200000
  ): SectionProperties {
    const { flangeWidth, flangeThickness, webHeight, webThickness } = section;

    // Check flange (outstand)
    const flangeOutstand = (flangeWidth - webThickness) / 2;
    const flangeEffective = this.effectiveWidth(flangeOutstand, flangeThickness, fy, E, 1, 0.43);

    // Check web (internal compression)
    const webEffective = this.effectiveWidth(webHeight, webThickness, fy, E, 1, 4);

    // Create effective section
    const effectiveSection: ISectionDefinition = {
      type: 'I-section',
      flangeWidth: webThickness + 2 * flangeEffective.effectiveWidth,
      flangeThickness,
      webHeight: webEffective.effectiveWidth,
      webThickness
    };

    return SectionPropertyCalculator.calculateISection(effectiveSection);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================


export default {
  SectionPropertyCalculator,
  CompositeSectionCalculator,
  CrackedSectionAnalyzer,
  EffectiveSectionCalculator
};
