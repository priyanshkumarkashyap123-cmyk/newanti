/**
 * ============================================================================
 * STRUCTURAL VISUALIZATION ENGINE
 * ============================================================================
 * 
 * Comprehensive 3D visualization for structural engineering:
 * - Structure geometry rendering
 * - Deformed shape visualization
 * - Stress/strain contour plots
 * - Bending moment/shear force diagrams
 * - Mode shape animation
 * - Load visualization
 * - Section renderer
 * 
 * Uses WebGL/Three.js compatible data structures
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Color {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a?: number; // 0-1
}

export interface Node {
  id: number;
  position: Point3D;
  displacement?: Vector3D;
  rotation?: Vector3D;
  restraint?: { x: boolean; y: boolean; z: boolean; rx: boolean; ry: boolean; rz: boolean };
}

export interface Element {
  id: number;
  type: 'beam' | 'column' | 'truss' | 'plate' | 'shell' | 'solid';
  nodeIds: number[];
  section?: string;
  material?: string;
  results?: {
    stress?: number[];
    strain?: number[];
    forces?: { axial: number; shearY: number; shearZ: number; moment: number; torsion: number };
  };
}

export interface GeometryData {
  vertices: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
  colors?: Float32Array;
  uvs?: Float32Array;
}

export interface DiagramPoint {
  x: number;
  y: number;
  value: number;
}

export interface ContourLevel {
  value: number;
  color: Color;
}

export interface VisualizationOptions {
  scale: number;
  deformationScale: number;
  showNodes: boolean;
  showElements: boolean;
  showLoads: boolean;
  showRestraints: boolean;
  showLabels: boolean;
  colorScheme: 'rainbow' | 'jet' | 'hot' | 'cool' | 'grayscale';
  elementColor: Color;
  nodeSize: number;
  lineWidth: number;
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

export class ColorMapper {
  private scheme: string;
  private minValue: number;
  private maxValue: number;

  constructor(
    scheme: 'rainbow' | 'jet' | 'hot' | 'cool' | 'grayscale' = 'jet',
    minValue: number = 0,
    maxValue: number = 1
  ) {
    this.scheme = scheme;
    this.minValue = minValue;
    this.maxValue = maxValue;
  }

  /**
   * Map value to color
   */
  getColor(value: number): Color {
    // Normalize value to 0-1 range
    const t = Math.max(0, Math.min(1, (value - this.minValue) / (this.maxValue - this.minValue)));

    switch (this.scheme) {
      case 'rainbow':
        return this.rainbowColor(t);
      case 'jet':
        return this.jetColor(t);
      case 'hot':
        return this.hotColor(t);
      case 'cool':
        return this.coolColor(t);
      case 'grayscale':
        return { r: t, g: t, b: t };
      default:
        return this.jetColor(t);
    }
  }

  /**
   * Generate color legend
   */
  generateLegend(steps: number = 10): { value: number; color: Color }[] {
    const legend: { value: number; color: Color }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const value = this.minValue + t * (this.maxValue - this.minValue);
      legend.push({ value, color: this.getColor(value) });
    }
    return legend;
  }

  private rainbowColor(t: number): Color {
    const h = (1 - t) * 270; // Hue from 270 (violet) to 0 (red)
    return this.hslToRgb(h / 360, 1, 0.5);
  }

  private jetColor(t: number): Color {
    let r: number, g: number, b: number;

    if (t < 0.25) {
      r = 0;
      g = 4 * t;
      b = 1;
    } else if (t < 0.5) {
      r = 0;
      g = 1;
      b = 1 - 4 * (t - 0.25);
    } else if (t < 0.75) {
      r = 4 * (t - 0.5);
      g = 1;
      b = 0;
    } else {
      r = 1;
      g = 1 - 4 * (t - 0.75);
      b = 0;
    }

    return { r, g, b };
  }

  private hotColor(t: number): Color {
    let r: number, g: number, b: number;

    if (t < 0.33) {
      r = 3 * t;
      g = 0;
      b = 0;
    } else if (t < 0.67) {
      r = 1;
      g = 3 * (t - 0.33);
      b = 0;
    } else {
      r = 1;
      g = 1;
      b = 3 * (t - 0.67);
    }

    return { r, g, b };
  }

  private coolColor(t: number): Color {
    return { r: t, g: 1 - t, b: 1 };
  }

  private hslToRgb(h: number, s: number, l: number): Color {
    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return { r, g, b };
  }
}

// ============================================================================
// GEOMETRY GENERATORS
// ============================================================================

export class GeometryGenerator {
  /**
   * Generate line geometry for frame elements
   */
  static generateFrameLines(
    nodes: Map<number, Node>,
    elements: Element[],
    deformed: boolean = false,
    scale: number = 1
  ): { positions: number[]; colors: number[] } {
    const positions: number[] = [];
    const colors: number[] = [];

    for (const element of elements) {
      if (element.nodeIds.length < 2) continue;

      const node1 = nodes.get(element.nodeIds[0]);
      const node2 = nodes.get(element.nodeIds[1]);

      if (!node1 || !node2) continue;

      // Start point
      let x1 = node1.position.x * scale;
      let y1 = node1.position.y * scale;
      let z1 = node1.position.z * scale;

      // End point
      let x2 = node2.position.x * scale;
      let y2 = node2.position.y * scale;
      let z2 = node2.position.z * scale;

      // Apply deformation if available
      if (deformed && node1.displacement && node2.displacement) {
        x1 += node1.displacement.x * scale;
        y1 += node1.displacement.y * scale;
        z1 += node1.displacement.z * scale;
        x2 += node2.displacement.x * scale;
        y2 += node2.displacement.y * scale;
        z2 += node2.displacement.z * scale;
      }

      positions.push(x1, y1, z1, x2, y2, z2);

      // Default color (blue for beams, red for columns)
      const color = element.type === 'column' ? [1, 0, 0] : [0, 0, 1];
      colors.push(...color, ...color);
    }

    return { positions, colors };
  }

  /**
   * Generate 3D beam geometry with sections
   */
  static generateBeam3D(
    start: Point3D,
    end: Point3D,
    section: { width: number; height: number },
    segments: number = 16
  ): GeometryData {
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    // Calculate beam direction
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Local axes
    const dirZ = { x: dx / length, y: dy / length, z: dz / length };
    
    // Find perpendicular vectors
    let dirX: Vector3D;
    if (Math.abs(dirZ.y) < 0.99) {
      // Cross with Y-axis
      dirX = this.normalize(this.cross({ x: 0, y: 1, z: 0 }, dirZ));
    } else {
      // Cross with X-axis
      dirX = this.normalize(this.cross({ x: 1, y: 0, z: 0 }, dirZ));
    }
    const dirY = this.cross(dirZ, dirX);

    const hw = section.width / 2;
    const hh = section.height / 2;

    // Generate vertices for rectangular section at start and end
    const corners = [
      { u: -hw, v: -hh },
      { u: hw, v: -hh },
      { u: hw, v: hh },
      { u: -hw, v: hh }
    ];

    // Start face vertices
    for (const corner of corners) {
      vertices.push(
        start.x + corner.u * dirX.x + corner.v * dirY.x,
        start.y + corner.u * dirX.y + corner.v * dirY.y,
        start.z + corner.u * dirX.z + corner.v * dirY.z
      );
      normals.push(-dirZ.x, -dirZ.y, -dirZ.z);
    }

    // End face vertices
    for (const corner of corners) {
      vertices.push(
        end.x + corner.u * dirX.x + corner.v * dirY.x,
        end.y + corner.u * dirX.y + corner.v * dirY.y,
        end.z + corner.u * dirX.z + corner.v * dirY.z
      );
      normals.push(dirZ.x, dirZ.y, dirZ.z);
    }

    // Indices for start and end faces
    indices.push(0, 1, 2, 0, 2, 3); // Start face
    indices.push(4, 6, 5, 4, 7, 6); // End face

    // Side faces
    for (let i = 0; i < 4; i++) {
      const i0 = i;
      const i1 = (i + 1) % 4;
      const i2 = i0 + 4;
      const i3 = i1 + 4;
      indices.push(i0, i2, i1, i1, i2, i3);
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      normals: new Float32Array(normals)
    };
  }

  /**
   * Generate I-section geometry
   */
  static generateISection(
    start: Point3D,
    end: Point3D,
    section: {
      flangeWidth: number;
      flangeThickness: number;
      webHeight: number;
      webThickness: number;
    }
  ): GeometryData {
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    // Calculate direction
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const dirZ = { x: dx / length, y: dy / length, z: dz / length };
    
    let dirX: Vector3D;
    if (Math.abs(dirZ.y) < 0.99) {
      dirX = this.normalize(this.cross({ x: 0, y: 1, z: 0 }, dirZ));
    } else {
      dirX = this.normalize(this.cross({ x: 1, y: 0, z: 0 }, dirZ));
    }
    const dirY = this.cross(dirZ, dirX);

    const { flangeWidth: bf, flangeThickness: tf, webHeight: hw, webThickness: tw } = section;
    const totalHeight = hw + 2 * tf;

    // I-section outline points (12 points for outline)
    const outline = [
      { u: -bf / 2, v: -totalHeight / 2 },
      { u: bf / 2, v: -totalHeight / 2 },
      { u: bf / 2, v: -totalHeight / 2 + tf },
      { u: tw / 2, v: -totalHeight / 2 + tf },
      { u: tw / 2, v: totalHeight / 2 - tf },
      { u: bf / 2, v: totalHeight / 2 - tf },
      { u: bf / 2, v: totalHeight / 2 },
      { u: -bf / 2, v: totalHeight / 2 },
      { u: -bf / 2, v: totalHeight / 2 - tf },
      { u: -tw / 2, v: totalHeight / 2 - tf },
      { u: -tw / 2, v: -totalHeight / 2 + tf },
      { u: -bf / 2, v: -totalHeight / 2 + tf }
    ];

    // Generate vertices at start and end
    for (const point of outline) {
      vertices.push(
        start.x + point.u * dirX.x + point.v * dirY.x,
        start.y + point.u * dirX.y + point.v * dirY.y,
        start.z + point.u * dirX.z + point.v * dirY.z
      );
    }

    for (const point of outline) {
      vertices.push(
        end.x + point.u * dirX.x + point.v * dirY.x,
        end.y + point.u * dirX.y + point.v * dirY.y,
        end.z + point.u * dirX.z + point.v * dirY.z
      );
    }

    // Generate indices for I-section
    // End faces would need triangulation of the I-shape
    // Side faces
    const n = outline.length;
    for (let i = 0; i < n; i++) {
      const i0 = i;
      const i1 = (i + 1) % n;
      const i2 = i0 + n;
      const i3 = i1 + n;
      indices.push(i0, i2, i1, i1, i2, i3);
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      normals: new Float32Array(normals)
    };
  }

  /**
   * Generate support/restraint symbols
   */
  static generateSupport(
    position: Point3D,
    type: 'fixed' | 'pinned' | 'roller' | 'spring',
    scale: number = 1
  ): { positions: number[]; type: string } {
    const positions: number[] = [];
    const s = scale;

    switch (type) {
      case 'fixed':
        // Rectangle at base
        positions.push(
          position.x - s, position.y, position.z,
          position.x + s, position.y, position.z,
          position.x + s, position.y, position.z,
          position.x + s, position.y - s * 0.3, position.z,
          position.x + s, position.y - s * 0.3, position.z,
          position.x - s, position.y - s * 0.3, position.z,
          position.x - s, position.y - s * 0.3, position.z,
          position.x - s, position.y, position.z
        );
        // Hatching
        for (let i = 0; i < 5; i++) {
          const x = position.x - s + (i + 0.5) * (2 * s / 5);
          positions.push(
            x, position.y, position.z,
            x - s * 0.15, position.y - s * 0.3, position.z
          );
        }
        break;

      case 'pinned':
        // Triangle
        positions.push(
          position.x, position.y, position.z,
          position.x - s * 0.5, position.y - s, position.z,
          position.x - s * 0.5, position.y - s, position.z,
          position.x + s * 0.5, position.y - s, position.z,
          position.x + s * 0.5, position.y - s, position.z,
          position.x, position.y, position.z
        );
        break;

      case 'roller':
        // Triangle + circle
        positions.push(
          position.x, position.y, position.z,
          position.x - s * 0.5, position.y - s * 0.7, position.z,
          position.x - s * 0.5, position.y - s * 0.7, position.z,
          position.x + s * 0.5, position.y - s * 0.7, position.z,
          position.x + s * 0.5, position.y - s * 0.7, position.z,
          position.x, position.y, position.z
        );
        // Circle approximation
        const circleY = position.y - s * 0.85;
        for (let i = 0; i < 16; i++) {
          const angle1 = (i / 16) * 2 * Math.PI;
          const angle2 = ((i + 1) / 16) * 2 * Math.PI;
          positions.push(
            position.x + Math.cos(angle1) * s * 0.15, circleY + Math.sin(angle1) * s * 0.15, position.z,
            position.x + Math.cos(angle2) * s * 0.15, circleY + Math.sin(angle2) * s * 0.15, position.z
          );
        }
        break;

      case 'spring':
        // Zigzag pattern
        const springHeight = s;
        const zigzags = 4;
        for (let i = 0; i < zigzags * 2; i++) {
          const y1 = position.y - (i / (zigzags * 2)) * springHeight;
          const y2 = position.y - ((i + 1) / (zigzags * 2)) * springHeight;
          const x1 = i % 2 === 0 ? position.x - s * 0.3 : position.x + s * 0.3;
          const x2 = i % 2 === 0 ? position.x + s * 0.3 : position.x - s * 0.3;
          positions.push(x1, y1, position.z, x2, y2, position.z);
        }
        break;
    }

    return { positions, type };
  }

  // Helper methods
  private static cross(a: Vector3D, b: Vector3D): Vector3D {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  private static normalize(v: Vector3D): Vector3D {
    const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return { x: v.x / length, y: v.y / length, z: v.z / length };
  }
}

// ============================================================================
// DIAGRAM GENERATORS
// ============================================================================

export class DiagramGenerator {
  /**
   * Generate bending moment diagram
   */
  static generateBMD(
    spanLength: number,
    moments: { x: number; value: number }[],
    scale: number = 1
  ): { outline: Point3D[]; fill: Point3D[]; labels: { position: Point3D; value: string }[] } {
    const outline: Point3D[] = [];
    const fill: Point3D[] = [];
    const labels: { position: Point3D; value: string }[] = [];

    // Sort by x
    const sorted = [...moments].sort((a, b) => a.x - b.x);

    // Baseline
    outline.push({ x: 0, y: 0, z: 0 });

    // Diagram outline
    for (const point of sorted) {
      outline.push({ x: point.x * scale, y: point.value * scale, z: 0 });
      
      // Fill triangles (from baseline to curve)
      fill.push({ x: point.x * scale, y: 0, z: 0 });
      fill.push({ x: point.x * scale, y: point.value * scale, z: 0 });
    }

    // Close baseline
    outline.push({ x: spanLength * scale, y: 0, z: 0 });

    // Find max/min for labels
    const maxPoint = sorted.reduce((max, p) => p.value > max.value ? p : max, sorted[0]);
    const minPoint = sorted.reduce((min, p) => p.value < min.value ? p : min, sorted[0]);

    if (Math.abs(maxPoint.value) > 0.001) {
      labels.push({
        position: { x: maxPoint.x * scale, y: maxPoint.value * scale, z: 0 },
        value: `${maxPoint.value.toFixed(2)} kNm`
      });
    }

    if (Math.abs(minPoint.value) > 0.001 && minPoint !== maxPoint) {
      labels.push({
        position: { x: minPoint.x * scale, y: minPoint.value * scale, z: 0 },
        value: `${minPoint.value.toFixed(2)} kNm`
      });
    }

    return { outline, fill, labels };
  }

  /**
   * Generate shear force diagram
   */
  static generateSFD(
    spanLength: number,
    shears: { x: number; value: number }[],
    scale: number = 1
  ): { outline: Point3D[]; fill: Point3D[]; labels: { position: Point3D; value: string }[] } {
    const outline: Point3D[] = [];
    const fill: Point3D[] = [];
    const labels: { position: Point3D; value: string }[] = [];

    const sorted = [...shears].sort((a, b) => a.x - b.x);

    outline.push({ x: 0, y: 0, z: 0 });

    for (const point of sorted) {
      outline.push({ x: point.x * scale, y: point.value * scale, z: 0 });
    }

    outline.push({ x: spanLength * scale, y: 0, z: 0 });

    // Labels at ends and max values
    if (sorted.length > 0) {
      labels.push({
        position: { x: sorted[0].x * scale, y: sorted[0].value * scale, z: 0 },
        value: `${sorted[0].value.toFixed(2)} kN`
      });

      const lastPoint = sorted[sorted.length - 1];
      labels.push({
        position: { x: lastPoint.x * scale, y: lastPoint.value * scale, z: 0 },
        value: `${lastPoint.value.toFixed(2)} kN`
      });
    }

    return { outline, fill, labels };
  }

  /**
   * Generate deflected shape
   */
  static generateDeflectedShape(
    nodes: { x: number; y: number; displacement: number }[],
    scale: number = 1,
    deformationScale: number = 100
  ): { original: Point3D[]; deflected: Point3D[] } {
    const original: Point3D[] = [];
    const deflected: Point3D[] = [];

    for (const node of nodes) {
      original.push({ x: node.x * scale, y: node.y * scale, z: 0 });
      deflected.push({
        x: node.x * scale,
        y: (node.y + node.displacement * deformationScale) * scale,
        z: 0
      });
    }

    return { original, deflected };
  }

  /**
   * Generate mode shape for dynamic analysis
   */
  static generateModeShape(
    nodes: { x: number; y: number }[],
    modeShape: number[],
    amplitude: number = 1,
    phase: number = 0
  ): Point3D[] {
    const points: Point3D[] = [];
    const phaseMultiplier = Math.sin(phase);

    for (let i = 0; i < nodes.length; i++) {
      const displacement = modeShape[i] * amplitude * phaseMultiplier;
      points.push({
        x: nodes[i].x,
        y: nodes[i].y + displacement,
        z: 0
      });
    }

    return points;
  }
}

// ============================================================================
// CONTOUR GENERATOR
// ============================================================================

export class ContourGenerator {
  private colorMapper: ColorMapper;

  constructor(minValue: number, maxValue: number, scheme: 'rainbow' | 'jet' | 'hot' | 'cool' | 'grayscale' = 'jet') {
    this.colorMapper = new ColorMapper(scheme, minValue, maxValue);
  }

  /**
   * Generate stress contours for 2D elements
   */
  generateStressContour(
    mesh: {
      nodes: { id: number; x: number; y: number }[];
      elements: { nodeIds: number[]; stress: number }[];
    }
  ): { vertices: number[]; colors: number[]; indices: number[] } {
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const nodeMap = new Map(mesh.nodes.map(n => [n.id, n]));
    let vertexIndex = 0;

    for (const element of mesh.elements) {
      const color = this.colorMapper.getColor(element.stress);
      
      for (const nodeId of element.nodeIds) {
        const node = nodeMap.get(nodeId);
        if (node) {
          vertices.push(node.x, node.y, 0);
          colors.push(color.r, color.g, color.b);
        }
      }

      // Triangulate (assuming quad elements)
      if (element.nodeIds.length === 4) {
        indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        indices.push(vertexIndex, vertexIndex + 2, vertexIndex + 3);
        vertexIndex += 4;
      } else if (element.nodeIds.length === 3) {
        indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        vertexIndex += 3;
      }
    }

    return { vertices, colors, indices };
  }

  /**
   * Generate nodal stress contour with smoothing
   */
  generateNodalContour(
    nodes: { id: number; x: number; y: number; stress: number }[],
    elements: { nodeIds: number[] }[]
  ): { vertices: number[]; colors: number[]; indices: number[] } {
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    let vertexIndex = 0;

    for (const element of elements) {
      const startIndex = vertexIndex;

      for (const nodeId of element.nodeIds) {
        const node = nodeMap.get(nodeId);
        if (node) {
          const color = this.colorMapper.getColor(node.stress);
          vertices.push(node.x, node.y, 0);
          colors.push(color.r, color.g, color.b);
          vertexIndex++;
        }
      }

      // Triangulate
      if (element.nodeIds.length === 4) {
        indices.push(startIndex, startIndex + 1, startIndex + 2);
        indices.push(startIndex, startIndex + 2, startIndex + 3);
      } else if (element.nodeIds.length === 3) {
        indices.push(startIndex, startIndex + 1, startIndex + 2);
      }
    }

    return { vertices, colors, indices };
  }

  /**
   * Generate contour lines (iso-lines)
   */
  generateIsoLines(
    field: { x: number; y: number; value: number }[][],
    levels: number[]
  ): Map<number, Point3D[][]> {
    const isoLines = new Map<number, Point3D[][]>();

    for (const level of levels) {
      const lines: Point3D[][] = [];
      
      for (let i = 0; i < field.length - 1; i++) {
        for (let j = 0; j < field[i].length - 1; j++) {
          const cell = [
            field[i][j],
            field[i + 1][j],
            field[i + 1][j + 1],
            field[i][j + 1]
          ];

          const segments = this.marchingSquares(cell, level);
          if (segments.length > 0) {
            lines.push(...segments);
          }
        }
      }

      isoLines.set(level, lines);
    }

    return isoLines;
  }

  private marchingSquares(
    cell: { x: number; y: number; value: number }[],
    level: number
  ): Point3D[][] {
    const segments: Point3D[][] = [];

    // Calculate case index
    let caseIndex = 0;
    for (let i = 0; i < 4; i++) {
      if (cell[i].value >= level) {
        caseIndex |= (1 << i);
      }
    }

    // Linear interpolation helper
    const interpolate = (p1: typeof cell[0], p2: typeof cell[0]): Point3D => {
      const t = (level - p1.value) / (p2.value - p1.value);
      return {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
        z: 0
      };
    };

    // Generate segments based on case
    const edges: [number, number][][] = [
      [], // 0
      [[0, 3]], // 1
      [[0, 1]], // 2
      [[1, 3]], // 3
      [[1, 2]], // 4
      [[0, 1], [2, 3]], // 5 (ambiguous)
      [[0, 2]], // 6
      [[2, 3]], // 7
      [[2, 3]], // 8
      [[0, 2]], // 9
      [[0, 3], [1, 2]], // 10 (ambiguous)
      [[1, 2]], // 11
      [[1, 3]], // 12
      [[0, 1]], // 13
      [[0, 3]], // 14
      [] // 15
    ];

    const edgeToNodes: [number, number][] = [
      [0, 1], // Edge 0: bottom
      [1, 2], // Edge 1: right
      [2, 3], // Edge 2: top
      [3, 0]  // Edge 3: left
    ];

    for (const edgePair of edges[caseIndex]) {
      const [e1, e2] = edgePair;
      const [n1a, n1b] = edgeToNodes[e1];
      const [n2a, n2b] = edgeToNodes[e2];

      const p1 = interpolate(cell[n1a], cell[n1b]);
      const p2 = interpolate(cell[n2a], cell[n2b]);

      segments.push([p1, p2]);
    }

    return segments;
  }
}

// ============================================================================
// LOAD VISUALIZER
// ============================================================================

export class LoadVisualizer {
  /**
   * Generate point load arrow
   */
  static generatePointLoad(
    position: Point3D,
    direction: Vector3D,
    magnitude: number,
    scale: number = 1
  ): { shaft: Point3D[]; head: Point3D[] } {
    const arrowLength = Math.abs(magnitude) * scale;
    const headLength = arrowLength * 0.2;
    const headWidth = arrowLength * 0.1;

    // Normalize direction
    const len = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
    const dir = {
      x: direction.x / len,
      y: direction.y / len,
      z: direction.z / len
    };

    // Find perpendicular vector
    let perp: Vector3D;
    if (Math.abs(dir.x) < 0.9) {
      perp = { x: 1, y: 0, z: 0 };
    } else {
      perp = { x: 0, y: 1, z: 0 };
    }

    // Cross product for true perpendicular
    perp = {
      x: dir.y * perp.z - dir.z * perp.y,
      y: dir.z * perp.x - dir.x * perp.z,
      z: dir.x * perp.y - dir.y * perp.x
    };
    const perpLen = Math.sqrt(perp.x ** 2 + perp.y ** 2 + perp.z ** 2);
    perp = { x: perp.x / perpLen, y: perp.y / perpLen, z: perp.z / perpLen };

    // Arrow shaft
    const shaftEnd = {
      x: position.x + dir.x * (arrowLength - headLength),
      y: position.y + dir.y * (arrowLength - headLength),
      z: position.z + dir.z * (arrowLength - headLength)
    };

    const shaft: Point3D[] = [position, shaftEnd];

    // Arrow head
    const headBase = shaftEnd;
    const tip = {
      x: position.x + dir.x * arrowLength,
      y: position.y + dir.y * arrowLength,
      z: position.z + dir.z * arrowLength
    };

    const head: Point3D[] = [
      tip,
      {
        x: headBase.x + perp.x * headWidth,
        y: headBase.y + perp.y * headWidth,
        z: headBase.z + perp.z * headWidth
      },
      tip,
      {
        x: headBase.x - perp.x * headWidth,
        y: headBase.y - perp.y * headWidth,
        z: headBase.z - perp.z * headWidth
      }
    ];

    return { shaft, head };
  }

  /**
   * Generate distributed load
   */
  static generateUDL(
    start: Point3D,
    end: Point3D,
    direction: Vector3D,
    intensity: number,
    scale: number = 1,
    arrowCount: number = 5
  ): { arrows: { shaft: Point3D[]; head: Point3D[] }[]; outline: Point3D[] } {
    const arrows: { shaft: Point3D[]; head: Point3D[] }[] = [];
    const outline: Point3D[] = [];

    // Direction vector along member
    const memberDir = {
      x: end.x - start.x,
      y: end.y - start.y,
      z: end.z - start.z
    };

    // Generate arrows
    for (let i = 0; i < arrowCount; i++) {
      const t = (i + 0.5) / arrowCount;
      const pos = {
        x: start.x + t * memberDir.x,
        y: start.y + t * memberDir.y,
        z: start.z + t * memberDir.z
      };

      const arrow = this.generatePointLoad(pos, direction, intensity * 0.3, scale);
      arrows.push(arrow);

      // Outline points
      outline.push({
        x: pos.x + direction.x * intensity * 0.3 * scale,
        y: pos.y + direction.y * intensity * 0.3 * scale,
        z: pos.z + direction.z * intensity * 0.3 * scale
      });
    }

    return { arrows, outline };
  }

  /**
   * Generate moment symbol
   */
  static generateMoment(
    position: Point3D,
    axis: 'x' | 'y' | 'z',
    magnitude: number,
    scale: number = 1
  ): Point3D[] {
    const points: Point3D[] = [];
    const radius = Math.abs(magnitude) * scale * 0.3;
    const segments = 24;
    const arcAngle = Math.PI * 1.5; // 270 degrees

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * arcAngle;
      let x: number, y: number, z: number;

      switch (axis) {
        case 'z':
          x = position.x + radius * Math.cos(angle);
          y = position.y + radius * Math.sin(angle);
          z = position.z;
          break;
        case 'y':
          x = position.x + radius * Math.cos(angle);
          y = position.y;
          z = position.z + radius * Math.sin(angle);
          break;
        case 'x':
          x = position.x;
          y = position.y + radius * Math.cos(angle);
          z = position.z + radius * Math.sin(angle);
          break;
      }

      points.push({ x, y, z });
    }

    // Add arrowhead at end
    const lastPoint = points[points.length - 1];
    const arrowSize = radius * 0.3;
    
    // Direction tangent to circle at end
    const endAngle = arcAngle;
    let tangent: Vector3D;
    switch (axis) {
      case 'z':
        tangent = { x: -Math.sin(endAngle), y: Math.cos(endAngle), z: 0 };
        break;
      case 'y':
        tangent = { x: -Math.sin(endAngle), y: 0, z: Math.cos(endAngle) };
        break;
      case 'x':
        tangent = { x: 0, y: -Math.sin(endAngle), z: Math.cos(endAngle) };
        break;
    }

    if (magnitude < 0) {
      tangent = { x: -tangent.x, y: -tangent.y, z: -tangent.z };
    }

    points.push({
      x: lastPoint.x + tangent.x * arrowSize,
      y: lastPoint.y + tangent.y * arrowSize,
      z: lastPoint.z + tangent.z * arrowSize
    });

    return points;
  }
}

// ============================================================================
// SECTION RENDERER
// ============================================================================

export class SectionRenderer {
  /**
   * Generate 2D section outline
   */
  static generateSectionOutline(
    section: {
      type: 'rectangular' | 'circular' | 'I' | 'T' | 'L' | 'C' | 'hollow-rect' | 'pipe';
      dimensions: Record<string, number>;
    },
    scale: number = 1
  ): Point3D[] {
    const points: Point3D[] = [];
    const d = section.dimensions;

    switch (section.type) {
      case 'rectangular':
        points.push(
          { x: -d.width / 2 * scale, y: -d.height / 2 * scale, z: 0 },
          { x: d.width / 2 * scale, y: -d.height / 2 * scale, z: 0 },
          { x: d.width / 2 * scale, y: d.height / 2 * scale, z: 0 },
          { x: -d.width / 2 * scale, y: d.height / 2 * scale, z: 0 },
          { x: -d.width / 2 * scale, y: -d.height / 2 * scale, z: 0 }
        );
        break;

      case 'circular':
        for (let i = 0; i <= 32; i++) {
          const angle = (i / 32) * 2 * Math.PI;
          points.push({
            x: d.diameter / 2 * Math.cos(angle) * scale,
            y: d.diameter / 2 * Math.sin(angle) * scale,
            z: 0
          });
        }
        break;

      case 'I':
        const { flangeWidth: bf, flangeThickness: tf, webHeight: hw, webThickness: tw } = d;
        const h = hw + 2 * tf;
        points.push(
          { x: -bf / 2 * scale, y: -h / 2 * scale, z: 0 },
          { x: bf / 2 * scale, y: -h / 2 * scale, z: 0 },
          { x: bf / 2 * scale, y: (-h / 2 + tf) * scale, z: 0 },
          { x: tw / 2 * scale, y: (-h / 2 + tf) * scale, z: 0 },
          { x: tw / 2 * scale, y: (h / 2 - tf) * scale, z: 0 },
          { x: bf / 2 * scale, y: (h / 2 - tf) * scale, z: 0 },
          { x: bf / 2 * scale, y: h / 2 * scale, z: 0 },
          { x: -bf / 2 * scale, y: h / 2 * scale, z: 0 },
          { x: -bf / 2 * scale, y: (h / 2 - tf) * scale, z: 0 },
          { x: -tw / 2 * scale, y: (h / 2 - tf) * scale, z: 0 },
          { x: -tw / 2 * scale, y: (-h / 2 + tf) * scale, z: 0 },
          { x: -bf / 2 * scale, y: (-h / 2 + tf) * scale, z: 0 },
          { x: -bf / 2 * scale, y: -h / 2 * scale, z: 0 }
        );
        break;

      // Add more section types as needed
    }

    return points;
  }

  /**
   * Generate reinforcement layout
   */
  static generateReinforcementLayout(
    section: { width: number; height: number; cover: number },
    bars: { x: number; y: number; diameter: number }[],
    scale: number = 1
  ): { outline: Point3D[]; bars: { center: Point3D; radius: number }[] } {
    const outline = this.generateSectionOutline(
      { type: 'rectangular', dimensions: section },
      scale
    );

    const barCircles = bars.map(bar => ({
      center: { x: bar.x * scale, y: bar.y * scale, z: 0 },
      radius: bar.diameter / 2 * scale
    }));

    return { outline, bars: barCircles };
  }
}

// ============================================================================
// EXPORTS - Classes already exported at declaration
// ============================================================================

export default {
  ColorMapper,
  GeometryGenerator,
  DiagramGenerator,
  ContourGenerator,
  LoadVisualizer,
  SectionRenderer
};
