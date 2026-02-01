/**
 * ============================================================================
 * CIVIL ENGINEERING VISUALIZATION ENGINE
 * ============================================================================
 * 
 * Comprehensive visualization system for civil engineering including:
 * - 2D Drawing generation (plan views, elevations, sections)
 * - Structural diagrams (BMD, SFD, AFD)
 * - Geotechnical visualizations
 * - Hydraulic profiles
 * - 3D rendering support
 * - Interactive canvas operations
 * 
 * @version 2.0.0
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

export interface Line {
  start: Point2D;
  end: Point2D;
  style?: LineStyle;
}

export interface LineStyle {
  color: string;
  width: number;
  dashArray?: number[];
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
}

export interface TextStyle {
  font: string;
  size: number;
  color: string;
  align?: 'left' | 'center' | 'right';
  baseline?: 'top' | 'middle' | 'bottom';
  rotation?: number;
}

export interface FillStyle {
  color: string;
  pattern?: 'solid' | 'hatch' | 'crosshatch' | 'dots';
  opacity?: number;
}

export interface ViewportSettings {
  width: number;
  height: number;
  scale: number;
  origin: Point2D;
  rotation: number;
}

export interface DrawingLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
  elements: DrawingElement[];
}

export type DrawingElement = 
  | { type: 'line'; data: Line }
  | { type: 'polyline'; data: { points: Point2D[]; closed: boolean; style?: LineStyle } }
  | { type: 'circle'; data: { center: Point2D; radius: number; style?: LineStyle; fill?: FillStyle } }
  | { type: 'arc'; data: { center: Point2D; radius: number; startAngle: number; endAngle: number; style?: LineStyle } }
  | { type: 'rectangle'; data: { origin: Point2D; width: number; height: number; style?: LineStyle; fill?: FillStyle } }
  | { type: 'text'; data: { position: Point2D; text: string; style: TextStyle } }
  | { type: 'dimension'; data: DimensionData }
  | { type: 'hatch'; data: { boundary: Point2D[]; pattern: string; scale: number; angle: number } };

export interface DimensionData {
  type: 'linear' | 'angular' | 'radial' | 'diameter';
  points: Point2D[];
  offset: number;
  text?: string;
  style?: TextStyle;
}

// =============================================================================
// COLOR SCHEMES
// =============================================================================

export const COLOR_SCHEMES = {
  structural: {
    concrete: '#808080',
    steel: '#4169E1',
    rebar: '#8B0000',
    loads: '#FF4500',
    reactions: '#228B22',
    moments: '#FF1493',
    shear: '#9400D3',
    deflection: '#00CED1',
    tension: '#FF0000',
    compression: '#0000FF',
  },
  geotechnical: {
    soil: '#8B4513',
    clay: '#A0522D',
    sand: '#F4A460',
    gravel: '#708090',
    rock: '#696969',
    water: '#4169E1',
    foundation: '#808080',
    pile: '#2F4F4F',
  },
  hydraulic: {
    water: '#1E90FF',
    channel: '#8B4513',
    pipe: '#696969',
    velocity: '#00FF7F',
    pressure: '#FF6347',
    flowDirection: '#00BFFF',
  },
  transportation: {
    pavement: '#2F2F2F',
    shoulder: '#696969',
    lane: '#FFFFFF',
    curb: '#A9A9A9',
    centerline: '#FFFF00',
    edgeline: '#FFFFFF',
  },
};

// =============================================================================
// DRAWING PRIMITIVES
// =============================================================================

export class DrawingPrimitives {
  /**
   * Generate SVG path for a line
   */
  static linePath(line: Line): string {
    return `M ${line.start.x} ${line.start.y} L ${line.end.x} ${line.end.y}`;
  }

  /**
   * Generate SVG path for a polyline
   */
  static polylinePath(points: Point2D[], closed: boolean = false): string {
    if (points.length === 0) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    if (closed) path += ' Z';
    
    return path;
  }

  /**
   * Generate SVG path for an arc
   */
  static arcPath(
    center: Point2D,
    radius: number,
    startAngle: number,
    endAngle: number
  ): string {
    const startRad = startAngle * Math.PI / 180;
    const endRad = endAngle * Math.PI / 180;
    
    const start = {
      x: center.x + radius * Math.cos(startRad),
      y: center.y + radius * Math.sin(startRad),
    };
    const end = {
      x: center.x + radius * Math.cos(endRad),
      y: center.y + radius * Math.sin(endRad),
    };
    
    const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
    const sweep = endAngle > startAngle ? 1 : 0;
    
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
  }

  /**
   * Generate circle SVG element
   */
  static circleSVG(center: Point2D, radius: number, style?: LineStyle, fill?: FillStyle): string {
    const strokeStyle = style ? 
      `stroke="${style.color}" stroke-width="${style.width}"` : 
      'stroke="black" stroke-width="1"';
    const fillStyle = fill ? `fill="${fill.color}" fill-opacity="${fill.opacity || 1}"` : 'fill="none"';
    
    return `<circle cx="${center.x}" cy="${center.y}" r="${radius}" ${strokeStyle} ${fillStyle}/>`;
  }

  /**
   * Generate rectangle SVG element
   */
  static rectangleSVG(
    origin: Point2D,
    width: number,
    height: number,
    style?: LineStyle,
    fill?: FillStyle
  ): string {
    const strokeStyle = style ?
      `stroke="${style.color}" stroke-width="${style.width}"` :
      'stroke="black" stroke-width="1"';
    const fillStyle = fill ? `fill="${fill.color}" fill-opacity="${fill.opacity || 1}"` : 'fill="none"';
    
    return `<rect x="${origin.x}" y="${origin.y}" width="${width}" height="${height}" ${strokeStyle} ${fillStyle}/>`;
  }

  /**
   * Generate text SVG element
   */
  static textSVG(position: Point2D, text: string, style: TextStyle): string {
    const transform = style.rotation ? 
      `transform="rotate(${style.rotation} ${position.x} ${position.y})"` : '';
    
    return `<text x="${position.x}" y="${position.y}" 
            font-family="${style.font}" font-size="${style.size}" 
            fill="${style.color}" text-anchor="${style.align || 'start'}"
            dominant-baseline="${style.baseline || 'auto'}" ${transform}>${text}</text>`;
  }

  /**
   * Generate hatch pattern
   */
  static hatchPattern(
    id: string,
    type: 'hatch' | 'crosshatch' | 'dots',
    spacing: number = 10,
    angle: number = 45,
    color: string = '#000000'
  ): string {
    const angleRad = angle * Math.PI / 180;
    
    switch (type) {
      case 'hatch':
        return `
          <pattern id="${id}" width="${spacing}" height="${spacing}" 
                   patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
            <line x1="0" y1="0" x2="${spacing}" y2="0" stroke="${color}" stroke-width="0.5"/>
          </pattern>`;
      
      case 'crosshatch':
        return `
          <pattern id="${id}" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="${spacing}" y2="${spacing}" stroke="${color}" stroke-width="0.5"/>
            <line x1="${spacing}" y1="0" x2="0" y2="${spacing}" stroke="${color}" stroke-width="0.5"/>
          </pattern>`;
      
      case 'dots':
        return `
          <pattern id="${id}" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse">
            <circle cx="${spacing/2}" cy="${spacing/2}" r="1" fill="${color}"/>
          </pattern>`;
      
      default:
        return '';
    }
  }
}

// =============================================================================
// STRUCTURAL DIAGRAMS
// =============================================================================

export class StructuralDiagrams {
  /**
   * Generate Bending Moment Diagram (BMD)
   */
  static generateBMD(
    spans: { length: number; moments: number[] }[],
    scale: { x: number; y: number },
    options: {
      baselineY: number;
      color?: string;
      fillPositive?: string;
      fillNegative?: string;
      showValues?: boolean;
      showZeroLine?: boolean;
    }
  ): string {
    const color = options.color || COLOR_SCHEMES.structural.moments;
    const fillPos = options.fillPositive || 'rgba(255,20,147,0.3)';
    const fillNeg = options.fillNegative || 'rgba(255,20,147,0.1)';
    
    let svg = '';
    let currentX = 0;
    
    // Zero line
    if (options.showZeroLine) {
      const totalLength = spans.reduce((sum, s) => sum + s.length, 0);
      svg += `<line x1="0" y1="${options.baselineY}" x2="${totalLength * scale.x}" 
              y2="${options.baselineY}" stroke="#999" stroke-dasharray="5,5"/>`;
    }
    
    spans.forEach((span, spanIndex) => {
      const points: Point2D[] = [];
      const numPoints = span.moments.length;
      const dx = span.length / (numPoints - 1) * scale.x;
      
      for (let i = 0; i < numPoints; i++) {
        points.push({
          x: currentX + i * dx,
          y: options.baselineY - span.moments[i] * scale.y,
        });
      }
      
      // Fill area
      const fillPath = `M ${currentX} ${options.baselineY} ` +
        points.map(p => `L ${p.x} ${p.y}`).join(' ') +
        ` L ${currentX + span.length * scale.x} ${options.baselineY} Z`;
      
      svg += `<path d="${fillPath}" fill="${fillPos}" stroke="none"/>`;
      
      // Diagram line
      svg += `<path d="${DrawingPrimitives.polylinePath(points)}" 
              fill="none" stroke="${color}" stroke-width="2"/>`;
      
      // Values at key points
      if (options.showValues) {
        const maxMoment = Math.max(...span.moments.map(Math.abs));
        const maxIndex = span.moments.findIndex(m => Math.abs(m) === maxMoment);
        
        if (maxIndex >= 0) {
          svg += DrawingPrimitives.textSVG(
            { 
              x: points[maxIndex].x, 
              y: points[maxIndex].y - 10 * Math.sign(span.moments[maxIndex])
            },
            `M = ${span.moments[maxIndex].toFixed(2)} kN·m`,
            { font: 'Arial', size: 10, color: color, align: 'center' }
          );
        }
      }
      
      currentX += span.length * scale.x;
    });
    
    return svg;
  }

  /**
   * Generate Shear Force Diagram (SFD)
   */
  static generateSFD(
    spans: { length: number; shearForces: number[] }[],
    scale: { x: number; y: number },
    options: {
      baselineY: number;
      color?: string;
      showValues?: boolean;
    }
  ): string {
    const color = options.color || COLOR_SCHEMES.structural.shear;
    let svg = '';
    let currentX = 0;
    
    // Zero line
    const totalLength = spans.reduce((sum, s) => sum + s.length, 0);
    svg += `<line x1="0" y1="${options.baselineY}" x2="${totalLength * scale.x}" 
            y2="${options.baselineY}" stroke="#999" stroke-dasharray="5,5"/>`;
    
    spans.forEach(span => {
      const points: Point2D[] = [];
      const numPoints = span.shearForces.length;
      const dx = span.length / (numPoints - 1) * scale.x;
      
      // Start from baseline
      points.push({ x: currentX, y: options.baselineY });
      
      for (let i = 0; i < numPoints; i++) {
        points.push({
          x: currentX + i * dx,
          y: options.baselineY - span.shearForces[i] * scale.y,
        });
      }
      
      // End at baseline
      points.push({ x: currentX + span.length * scale.x, y: options.baselineY });
      
      // Fill
      svg += `<path d="${DrawingPrimitives.polylinePath(points, true)}" 
              fill="rgba(148,0,211,0.2)" stroke="none"/>`;
      
      // Line (excluding baseline points)
      const linePoints = points.slice(1, -1);
      svg += `<path d="${DrawingPrimitives.polylinePath(linePoints)}" 
              fill="none" stroke="${color}" stroke-width="2"/>`;
      
      // Values
      if (options.showValues) {
        svg += DrawingPrimitives.textSVG(
          { x: currentX + 5, y: options.baselineY - span.shearForces[0] * scale.y - 5 },
          `V = ${span.shearForces[0].toFixed(2)} kN`,
          { font: 'Arial', size: 9, color: color }
        );
      }
      
      currentX += span.length * scale.x;
    });
    
    return svg;
  }

  /**
   * Generate Axial Force Diagram (AFD)
   */
  static generateAFD(
    members: { start: Point2D; end: Point2D; force: number }[],
    scale: number,
    options: {
      tensionColor?: string;
      compressionColor?: string;
      width?: number;
    }
  ): string {
    const tensionColor = options.tensionColor || COLOR_SCHEMES.structural.tension;
    const compressionColor = options.compressionColor || COLOR_SCHEMES.structural.compression;
    const width = options.width || 10;
    
    let svg = '';
    
    members.forEach(member => {
      const dx = member.end.x - member.start.x;
      const dy = member.end.y - member.start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      // Perpendicular offset for force visualization
      const forceWidth = Math.abs(member.force) * scale;
      const perpX = -Math.sin(angle) * forceWidth / 2;
      const perpY = Math.cos(angle) * forceWidth / 2;
      
      const color = member.force > 0 ? tensionColor : compressionColor;
      
      // Draw force rectangle along member
      const points = [
        { x: member.start.x + perpX, y: member.start.y + perpY },
        { x: member.end.x + perpX, y: member.end.y + perpY },
        { x: member.end.x - perpX, y: member.end.y - perpY },
        { x: member.start.x - perpX, y: member.start.y - perpY },
      ];
      
      svg += `<path d="${DrawingPrimitives.polylinePath(points, true)}" 
              fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="1"/>`;
      
      // Force value
      const midX = (member.start.x + member.end.x) / 2;
      const midY = (member.start.y + member.end.y) / 2;
      svg += DrawingPrimitives.textSVG(
        { x: midX, y: midY - forceWidth / 2 - 5 },
        `${Math.abs(member.force).toFixed(2)} kN (${member.force > 0 ? 'T' : 'C'})`,
        { font: 'Arial', size: 9, color: color, align: 'center' }
      );
    });
    
    return svg;
  }

  /**
   * Generate deflected shape diagram
   */
  static generateDeflectedShape(
    originalNodes: Point2D[],
    originalMembers: { start: number; end: number }[],
    displacements: { dx: number; dy: number }[],
    scale: number,
    options: {
      originalColor?: string;
      deflectedColor?: string;
      showDisplacements?: boolean;
    }
  ): string {
    const originalColor = options.originalColor || '#CCCCCC';
    const deflectedColor = options.deflectedColor || COLOR_SCHEMES.structural.deflection;
    
    let svg = '';
    
    // Original structure (dashed)
    originalMembers.forEach(member => {
      svg += `<line 
        x1="${originalNodes[member.start].x}" y1="${originalNodes[member.start].y}"
        x2="${originalNodes[member.end].x}" y2="${originalNodes[member.end].y}"
        stroke="${originalColor}" stroke-width="2" stroke-dasharray="5,5"/>`;
    });
    
    // Deflected shape
    const deflectedNodes = originalNodes.map((node, i) => ({
      x: node.x + displacements[i].dx * scale,
      y: node.y + displacements[i].dy * scale,
    }));
    
    originalMembers.forEach(member => {
      svg += `<line 
        x1="${deflectedNodes[member.start].x}" y1="${deflectedNodes[member.start].y}"
        x2="${deflectedNodes[member.end].x}" y2="${deflectedNodes[member.end].y}"
        stroke="${deflectedColor}" stroke-width="2"/>`;
    });
    
    // Displacement annotations
    if (options.showDisplacements) {
      displacements.forEach((disp, i) => {
        const mag = Math.sqrt(disp.dx * disp.dx + disp.dy * disp.dy);
        if (mag > 0.001) {
          svg += DrawingPrimitives.textSVG(
            { x: deflectedNodes[i].x + 5, y: deflectedNodes[i].y - 5 },
            `δ = ${(mag * 1000).toFixed(2)} mm`,
            { font: 'Arial', size: 8, color: deflectedColor }
          );
        }
      });
    }
    
    return svg;
  }
}

// =============================================================================
// GEOTECHNICAL VISUALIZATIONS
// =============================================================================

export class GeotechnicalVisualizations {
  /**
   * Generate soil profile
   */
  static generateSoilProfile(
    layers: { name: string; thickness: number; type: string }[],
    width: number,
    scale: number,
    options: {
      showLabels?: boolean;
      showDepths?: boolean;
      startY?: number;
    }
  ): string {
    let svg = '';
    let currentY = options.startY || 0;
    
    // Pattern definitions
    const patterns: Record<string, { pattern: string; color: string }> = {
      'clay': { pattern: 'horizontal', color: COLOR_SCHEMES.geotechnical.clay },
      'sand': { pattern: 'dots', color: COLOR_SCHEMES.geotechnical.sand },
      'gravel': { pattern: 'circles', color: COLOR_SCHEMES.geotechnical.gravel },
      'rock': { pattern: 'diagonal', color: COLOR_SCHEMES.geotechnical.rock },
      'silt': { pattern: 'horizontal', color: '#C4A484' },
    };
    
    // Add pattern definitions to SVG defs
    svg += '<defs>';
    Object.entries(patterns).forEach(([type, { color }]) => {
      svg += DrawingPrimitives.hatchPattern(`soil-${type}`, 'hatch', 8, 0, color);
    });
    svg += '</defs>';
    
    layers.forEach((layer, index) => {
      const layerHeight = layer.thickness * scale;
      const patternId = `soil-${layer.type}`;
      const fillColor = patterns[layer.type]?.color || COLOR_SCHEMES.geotechnical.soil;
      
      // Layer rectangle
      svg += `<rect x="0" y="${currentY}" width="${width}" height="${layerHeight}" 
              fill="${fillColor}" fill-opacity="0.5" stroke="black" stroke-width="1"/>`;
      
      // Layer label
      if (options.showLabels) {
        svg += DrawingPrimitives.textSVG(
          { x: width / 2, y: currentY + layerHeight / 2 },
          layer.name,
          { font: 'Arial', size: 12, color: '#000', align: 'center', baseline: 'middle' }
        );
      }
      
      // Depth annotation
      if (options.showDepths) {
        const depth = layers.slice(0, index + 1).reduce((sum, l) => sum + l.thickness, 0);
        svg += DrawingPrimitives.textSVG(
          { x: width + 10, y: currentY + layerHeight },
          `${depth.toFixed(1)} m`,
          { font: 'Arial', size: 10, color: '#666' }
        );
      }
      
      currentY += layerHeight;
    });
    
    return svg;
  }

  /**
   * Generate foundation diagram
   */
  static generateFoundationDiagram(
    foundation: {
      type: 'isolated' | 'strip' | 'combined' | 'raft';
      width: number;
      length?: number;
      depth: number;
      columnWidth?: number;
    },
    scale: number,
    options: {
      showDimensions?: boolean;
      showPressure?: boolean;
      pressureValue?: number;
    }
  ): string {
    let svg = '';
    
    const W = foundation.width * scale;
    const D = foundation.depth * scale;
    const colW = (foundation.columnWidth || foundation.width * 0.3) * scale;
    
    // Ground level line
    svg += `<line x1="-50" y1="0" x2="${W + 50}" y2="0" stroke="#000" stroke-width="2"/>`;
    
    // Ground hatch
    svg += '<defs>';
    svg += DrawingPrimitives.hatchPattern('ground', 'hatch', 10, 45, '#666');
    svg += '</defs>';
    svg += `<rect x="-50" y="0" width="${W + 100}" height="20" fill="url(#ground)"/>`;
    
    // Foundation
    svg += `<rect x="0" y="0" width="${W}" height="${D}" 
            fill="${COLOR_SCHEMES.geotechnical.foundation}" stroke="black" stroke-width="2"/>`;
    
    // Column
    const colX = (W - colW) / 2;
    svg += `<rect x="${colX}" y="${-D}" width="${colW}" height="${D}" 
            fill="${COLOR_SCHEMES.structural.concrete}" stroke="black" stroke-width="2"/>`;
    
    // Dimensions
    if (options.showDimensions) {
      // Width dimension
      svg += `<line x1="0" y1="${D + 20}" x2="${W}" y2="${D + 20}" 
              stroke="black" stroke-width="1" marker-start="url(#arrow)" marker-end="url(#arrow)"/>`;
      svg += DrawingPrimitives.textSVG(
        { x: W / 2, y: D + 35 },
        `B = ${foundation.width} m`,
        { font: 'Arial', size: 10, color: '#000', align: 'center' }
      );
      
      // Depth dimension
      svg += `<line x1="${W + 20}" y1="0" x2="${W + 20}" y2="${D}" 
              stroke="black" stroke-width="1" marker-start="url(#arrow)" marker-end="url(#arrow)"/>`;
      svg += DrawingPrimitives.textSVG(
        { x: W + 30, y: D / 2 },
        `D = ${foundation.depth} m`,
        { font: 'Arial', size: 10, color: '#000', rotation: -90 }
      );
    }
    
    // Pressure distribution
    if (options.showPressure && options.pressureValue) {
      const pressureArrows = 5;
      const arrowSpacing = W / (pressureArrows + 1);
      
      for (let i = 1; i <= pressureArrows; i++) {
        const x = i * arrowSpacing;
        svg += `<line x1="${x}" y1="${D + 40}" x2="${x}" y2="${D}" 
                stroke="${COLOR_SCHEMES.structural.loads}" stroke-width="2"/>`;
        svg += `<polygon points="${x - 5},${D + 10} ${x},${D} ${x + 5},${D + 10}" 
                fill="${COLOR_SCHEMES.structural.loads}"/>`;
      }
      
      svg += DrawingPrimitives.textSVG(
        { x: W / 2, y: D + 55 },
        `q = ${options.pressureValue.toFixed(2)} kPa`,
        { font: 'Arial', size: 10, color: COLOR_SCHEMES.structural.loads, align: 'center' }
      );
    }
    
    return svg;
  }

  /**
   * Generate retaining wall diagram
   */
  static generateRetainingWall(
    wall: {
      height: number;
      topWidth: number;
      bottomWidth: number;
      backfillAngle: number;
    },
    scale: number,
    pressureData?: { active: number[]; passive?: number[] }
  ): string {
    let svg = '';
    const H = wall.height * scale;
    const Wt = wall.topWidth * scale;
    const Wb = wall.bottomWidth * scale;
    
    // Wall shape (trapezoidal)
    const wallPoints = [
      { x: 0, y: 0 },
      { x: Wt, y: 0 },
      { x: Wb, y: H },
      { x: 0, y: H },
    ];
    
    svg += `<path d="${DrawingPrimitives.polylinePath(wallPoints, true)}" 
            fill="${COLOR_SCHEMES.structural.concrete}" stroke="black" stroke-width="2"/>`;
    
    // Backfill
    const backfillAngleRad = wall.backfillAngle * Math.PI / 180;
    const backfillExtent = H * 1.5;
    const backfillPoints = [
      { x: Wt, y: 0 },
      { x: Wt + backfillExtent, y: 0 },
      { x: Wt + backfillExtent, y: H },
      { x: Wb, y: H },
    ];
    
    svg += `<path d="${DrawingPrimitives.polylinePath(backfillPoints, true)}" 
            fill="${COLOR_SCHEMES.geotechnical.sand}" fill-opacity="0.5" stroke="none"/>`;
    
    // Pressure diagram
    if (pressureData) {
      const pressureScale = H / Math.max(...pressureData.active) * 0.3;
      
      // Active pressure
      const pressurePoints = pressureData.active.map((p, i) => ({
        x: Wt + p * pressureScale,
        y: i * H / (pressureData.active.length - 1),
      }));
      
      svg += `<path d="M ${Wt} 0 ${pressurePoints.map(p => `L ${p.x} ${p.y}`).join(' ')} L ${Wt} ${H} Z" 
              fill="rgba(255,0,0,0.2)" stroke="red" stroke-width="1"/>`;
    }
    
    return svg;
  }
}

// =============================================================================
// HYDRAULIC VISUALIZATIONS
// =============================================================================

export class HydraulicVisualizations {
  /**
   * Generate channel cross-section
   */
  static generateChannelSection(
    section: {
      type: 'rectangular' | 'trapezoidal' | 'triangular' | 'circular';
      bottomWidth?: number;
      depth: number;
      sideSlope?: number;
      diameter?: number;
    },
    waterDepth: number,
    scale: number
  ): string {
    let svg = '';
    
    if (section.type === 'rectangular') {
      const W = (section.bottomWidth || 4) * scale;
      const D = section.depth * scale;
      const waterH = waterDepth * scale;
      
      // Channel walls
      svg += `<polyline points="0,0 0,${D} ${W},${D} ${W},0" 
              fill="none" stroke="${COLOR_SCHEMES.hydraulic.channel}" stroke-width="3"/>`;
      
      // Water
      svg += `<rect x="0" y="${D - waterH}" width="${W}" height="${waterH}" 
              fill="${COLOR_SCHEMES.hydraulic.water}" fill-opacity="0.6"/>`;
      
    } else if (section.type === 'trapezoidal') {
      const B = (section.bottomWidth || 4) * scale;
      const D = section.depth * scale;
      const z = section.sideSlope || 1.5;
      const topW = B + 2 * z * D;
      const waterH = waterDepth * scale;
      const waterTopW = B + 2 * z * waterH;
      
      // Channel
      const channelPoints = [
        { x: -topW / 2 + B / 2, y: 0 },
        { x: -B / 2, y: D },
        { x: B / 2, y: D },
        { x: topW / 2 - B / 2 + B, y: 0 },
      ];
      
      svg += `<path d="${DrawingPrimitives.polylinePath(channelPoints)}" 
              fill="none" stroke="${COLOR_SCHEMES.hydraulic.channel}" stroke-width="3"/>`;
      
      // Water
      const waterOffset = (B / 2 - waterTopW / 2) + B / 2;
      const waterPoints = [
        { x: -waterTopW / 2 + B / 2, y: D - waterH },
        { x: -B / 2, y: D },
        { x: B / 2, y: D },
        { x: waterTopW / 2 + B / 2, y: D - waterH },
      ];
      
      svg += `<path d="${DrawingPrimitives.polylinePath(waterPoints, true)}" 
              fill="${COLOR_SCHEMES.hydraulic.water}" fill-opacity="0.6"/>`;
    }
    
    return svg;
  }

  /**
   * Generate longitudinal profile
   */
  static generateLongitudinalProfile(
    profile: { distance: number; invert: number; waterSurface?: number }[],
    scale: { x: number; y: number },
    options: {
      showWaterSurface?: boolean;
      showEnergyLine?: boolean;
      velocityHead?: number[];
    }
  ): string {
    let svg = '';
    
    // Channel bed
    const bedPoints = profile.map(p => ({
      x: p.distance * scale.x,
      y: -p.invert * scale.y,
    }));
    
    svg += `<path d="${DrawingPrimitives.polylinePath(bedPoints)}" 
            fill="none" stroke="${COLOR_SCHEMES.hydraulic.channel}" stroke-width="3"/>`;
    
    // Water surface
    if (options.showWaterSurface && profile.some(p => p.waterSurface !== undefined)) {
      const wsPoints = profile
        .filter(p => p.waterSurface !== undefined)
        .map(p => ({
          x: p.distance * scale.x,
          y: -p.waterSurface! * scale.y,
        }));
      
      svg += `<path d="${DrawingPrimitives.polylinePath(wsPoints)}" 
              fill="none" stroke="${COLOR_SCHEMES.hydraulic.water}" stroke-width="2"/>`;
      
      // Fill between bed and water surface
      const fillPoints = [...bedPoints, ...wsPoints.reverse()];
      svg += `<path d="${DrawingPrimitives.polylinePath(fillPoints, true)}" 
              fill="${COLOR_SCHEMES.hydraulic.water}" fill-opacity="0.3"/>`;
    }
    
    // Energy line
    if (options.showEnergyLine && options.velocityHead) {
      const elPoints = profile.map((p, i) => ({
        x: p.distance * scale.x,
        y: -(p.waterSurface || p.invert + 1) * scale.y - (options.velocityHead![i] || 0) * scale.y,
      }));
      
      svg += `<path d="${DrawingPrimitives.polylinePath(elPoints)}" 
              fill="none" stroke="red" stroke-width="1" stroke-dasharray="5,3"/>`;
    }
    
    return svg;
  }

  /**
   * Generate pipe network schematic
   */
  static generatePipeNetwork(
    nodes: { id: string; x: number; y: number; type: 'junction' | 'tank' | 'reservoir' | 'pump' }[],
    pipes: { id: string; from: string; to: string; diameter: number; flow?: number }[],
    scale: number
  ): string {
    let svg = '';
    
    // Draw pipes
    pipes.forEach(pipe => {
      const fromNode = nodes.find(n => n.id === pipe.from);
      const toNode = nodes.find(n => n.id === pipe.to);
      
      if (fromNode && toNode) {
        const lineWidth = Math.max(1, pipe.diameter * 100); // Scale diameter
        
        svg += `<line x1="${fromNode.x * scale}" y1="${fromNode.y * scale}" 
                x2="${toNode.x * scale}" y2="${toNode.y * scale}"
                stroke="${COLOR_SCHEMES.hydraulic.pipe}" stroke-width="${lineWidth}"/>`;
        
        // Flow direction arrow
        if (pipe.flow) {
          const midX = (fromNode.x + toNode.x) / 2 * scale;
          const midY = (fromNode.y + toNode.y) / 2 * scale;
          const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x) * 180 / Math.PI;
          
          svg += `<polygon points="${midX},${midY - 5} ${midX + 10},${midY} ${midX},${midY + 5}" 
                  fill="${COLOR_SCHEMES.hydraulic.flowDirection}" 
                  transform="rotate(${angle} ${midX} ${midY})"/>`;
        }
        
        // Pipe label
        const labelX = (fromNode.x + toNode.x) / 2 * scale;
        const labelY = (fromNode.y + toNode.y) / 2 * scale - 10;
        svg += DrawingPrimitives.textSVG(
          { x: labelX, y: labelY },
          `${pipe.id}: Ø${(pipe.diameter * 1000).toFixed(0)}mm`,
          { font: 'Arial', size: 8, color: '#333', align: 'center' }
        );
      }
    });
    
    // Draw nodes
    nodes.forEach(node => {
      const x = node.x * scale;
      const y = node.y * scale;
      
      switch (node.type) {
        case 'junction':
          svg += `<circle cx="${x}" cy="${y}" r="5" fill="#333"/>`;
          break;
        case 'tank':
          svg += `<rect x="${x - 15}" y="${y - 20}" width="30" height="25" 
                  fill="${COLOR_SCHEMES.hydraulic.water}" stroke="black"/>`;
          break;
        case 'reservoir':
          svg += `<path d="M ${x - 20} ${y + 10} L ${x - 20} ${y - 10} L ${x} ${y - 20} L ${x + 20} ${y - 10} L ${x + 20} ${y + 10} Z" 
                  fill="${COLOR_SCHEMES.hydraulic.water}" stroke="black"/>`;
          break;
        case 'pump':
          svg += `<circle cx="${x}" cy="${y}" r="12" fill="white" stroke="black"/>`;
          svg += `<path d="M ${x - 8} ${y} L ${x + 8} ${y} M ${x} ${y - 8} L ${x} ${y + 8}" stroke="black" stroke-width="2"/>`;
          break;
      }
      
      // Node label
      svg += DrawingPrimitives.textSVG(
        { x: x, y: y + 20 },
        node.id,
        { font: 'Arial', size: 9, color: '#333', align: 'center' }
      );
    });
    
    return svg;
  }
}

// =============================================================================
// TRANSPORTATION VISUALIZATIONS
// =============================================================================

export class TransportationVisualizations {
  /**
   * Generate highway cross-section
   */
  static generateHighwayCrossSection(
    highway: {
      laneWidth: number;
      numberOfLanes: number;
      shoulderWidth: number;
      medianWidth?: number;
      crossSlope: number;
      superelevation?: number;
    },
    scale: number
  ): string {
    let svg = '';
    
    const laneW = highway.laneWidth * scale;
    const numLanes = highway.numberOfLanes;
    const shoulderW = highway.shoulderWidth * scale;
    const medianW = (highway.medianWidth || 0) * scale;
    const totalWidth = numLanes * laneW + 2 * shoulderW + medianW;
    
    let currentX = -totalWidth / 2;
    
    // Left shoulder
    svg += `<rect x="${currentX}" y="0" width="${shoulderW}" height="10" 
            fill="${COLOR_SCHEMES.transportation.shoulder}"/>`;
    currentX += shoulderW;
    
    // Lanes
    for (let i = 0; i < numLanes; i++) {
      svg += `<rect x="${currentX}" y="0" width="${laneW}" height="10" 
              fill="${COLOR_SCHEMES.transportation.pavement}"/>`;
      
      // Lane marking
      if (i > 0) {
        svg += `<line x1="${currentX}" y1="0" x2="${currentX}" y2="10" 
                stroke="${COLOR_SCHEMES.transportation.lane}" stroke-width="1" 
                stroke-dasharray="10,10"/>`;
      }
      
      currentX += laneW;
    }
    
    // Median (if dual carriageway)
    if (medianW > 0) {
      svg += `<rect x="${currentX}" y="0" width="${medianW}" height="10" 
              fill="#228B22"/>`;
      currentX += medianW;
    }
    
    // Right shoulder
    svg += `<rect x="${currentX}" y="0" width="${shoulderW}" height="10" 
            fill="${COLOR_SCHEMES.transportation.shoulder}"/>`;
    
    // Edge lines
    svg += `<line x1="${-totalWidth / 2 + shoulderW}" y1="0" x2="${-totalWidth / 2 + shoulderW}" y2="10" 
            stroke="${COLOR_SCHEMES.transportation.edgeline}" stroke-width="2"/>`;
    svg += `<line x1="${totalWidth / 2 - shoulderW}" y1="0" x2="${totalWidth / 2 - shoulderW}" y2="10" 
            stroke="${COLOR_SCHEMES.transportation.edgeline}" stroke-width="2"/>`;
    
    return svg;
  }

  /**
   * Generate vertical alignment profile
   */
  static generateVerticalAlignment(
    alignment: { station: number; elevation: number; grade?: number }[],
    scale: { x: number; y: number },
    curveData?: { start: number; end: number; type: 'crest' | 'sag' }[]
  ): string {
    let svg = '';
    
    // Profile line
    const points = alignment.map(p => ({
      x: p.station * scale.x,
      y: -p.elevation * scale.y,
    }));
    
    svg += `<path d="${DrawingPrimitives.polylinePath(points)}" 
            fill="none" stroke="${COLOR_SCHEMES.transportation.pavement}" stroke-width="3"/>`;
    
    // Vertical curves
    if (curveData) {
      curveData.forEach(curve => {
        const startPt = points.find((_, i) => alignment[i].station >= curve.start);
        const endPt = points.find((_, i) => alignment[i].station >= curve.end);
        
        if (startPt && endPt) {
          svg += `<line x1="${curve.start * scale.x}" y1="${-100}" 
                  x2="${curve.start * scale.x}" y2="${100}" 
                  stroke="green" stroke-width="1" stroke-dasharray="5,5"/>`;
          svg += `<line x1="${curve.end * scale.x}" y1="${-100}" 
                  x2="${curve.end * scale.x}" y2="${100}" 
                  stroke="red" stroke-width="1" stroke-dasharray="5,5"/>`;
        }
      });
    }
    
    // Grade labels
    alignment.forEach((pt, i) => {
      if (pt.grade !== undefined && i % 2 === 0) {
        svg += DrawingPrimitives.textSVG(
          { x: pt.station * scale.x, y: -pt.elevation * scale.y - 15 },
          `${pt.grade > 0 ? '+' : ''}${pt.grade.toFixed(2)}%`,
          { font: 'Arial', size: 9, color: '#333', align: 'center' }
        );
      }
    });
    
    return svg;
  }

  /**
   * Generate intersection layout
   */
  static generateIntersection(
    intersection: {
      type: 'T' | 'cross' | 'roundabout';
      approaches: number;
      laneConfig: { approach: number; leftTurn: number; through: number; rightTurn: number }[];
    },
    scale: number
  ): string {
    let svg = '';
    
    const roadWidth = 14 * scale; // Typical 2-lane road width
    
    if (intersection.type === 'cross') {
      // Main road (horizontal)
      svg += `<rect x="${-100}" y="${-roadWidth / 2}" width="200" height="${roadWidth}" 
              fill="${COLOR_SCHEMES.transportation.pavement}"/>`;
      
      // Cross road (vertical)
      svg += `<rect x="${-roadWidth / 2}" y="${-100}" width="${roadWidth}" height="200" 
              fill="${COLOR_SCHEMES.transportation.pavement}"/>`;
      
      // Center intersection
      svg += `<rect x="${-roadWidth / 2}" y="${-roadWidth / 2}" width="${roadWidth}" height="${roadWidth}" 
              fill="${COLOR_SCHEMES.transportation.pavement}"/>`;
      
      // Crosswalks
      const stripWidth = 2;
      const stripGap = 2;
      for (let i = 0; i < 5; i++) {
        const offset = -roadWidth / 2 + i * (stripWidth + stripGap);
        // North crosswalk
        svg += `<rect x="${offset}" y="${-roadWidth / 2 - 3}" width="${stripWidth}" height="3" fill="white"/>`;
        // South crosswalk
        svg += `<rect x="${offset}" y="${roadWidth / 2}" width="${stripWidth}" height="3" fill="white"/>`;
        // East crosswalk
        svg += `<rect x="${roadWidth / 2}" y="${offset}" width="3" height="${stripWidth}" fill="white"/>`;
        // West crosswalk
        svg += `<rect x="${-roadWidth / 2 - 3}" y="${offset}" width="3" height="${stripWidth}" fill="white"/>`;
      }
    }
    
    return svg;
  }
}

// =============================================================================
// 3D VISUALIZATION SUPPORT
// =============================================================================

export class Visualization3D {
  /**
   * Project 3D point to 2D (isometric)
   */
  static isometricProjection(point: Point3D, scale: number = 1): Point2D {
    const angle = Math.PI / 6; // 30 degrees
    return {
      x: (point.x - point.y) * Math.cos(angle) * scale,
      y: (point.x + point.y) * Math.sin(angle) * scale - point.z * scale,
    };
  }

  /**
   * Project 3D point to 2D (perspective)
   */
  static perspectiveProjection(
    point: Point3D,
    camera: { x: number; y: number; z: number; focalLength: number }
  ): Point2D {
    const dx = point.x - camera.x;
    const dy = point.y - camera.y;
    const dz = point.z - camera.z;
    
    const scale = camera.focalLength / dz;
    
    return {
      x: dx * scale,
      y: dy * scale,
    };
  }

  /**
   * Generate 3D wireframe structure
   */
  static generateWireframe(
    nodes: Point3D[],
    edges: { start: number; end: number }[],
    projectionType: 'isometric' | 'perspective' = 'isometric',
    scale: number = 1
  ): string {
    let svg = '';
    
    const projectedNodes = nodes.map(node => 
      projectionType === 'isometric' 
        ? this.isometricProjection(node, scale)
        : this.perspectiveProjection(node, { x: 0, y: 0, z: -100, focalLength: 100 })
    );
    
    // Draw edges
    edges.forEach(edge => {
      const start = projectedNodes[edge.start];
      const end = projectedNodes[edge.end];
      
      svg += `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" 
              stroke="black" stroke-width="1"/>`;
    });
    
    // Draw nodes
    projectedNodes.forEach((node, i) => {
      svg += `<circle cx="${node.x}" cy="${node.y}" r="3" fill="black"/>`;
      svg += DrawingPrimitives.textSVG(
        { x: node.x + 5, y: node.y - 5 },
        `${i + 1}`,
        { font: 'Arial', size: 8, color: '#333' }
      );
    });
    
    return svg;
  }
}

// =============================================================================
// SVG DOCUMENT GENERATOR
// =============================================================================

export class SVGDocumentGenerator {
  private width: number;
  private height: number;
  private viewBox: { x: number; y: number; width: number; height: number };
  private elements: string[] = [];
  private definitions: string[] = [];

  constructor(width: number = 800, height: number = 600) {
    this.width = width;
    this.height = height;
    this.viewBox = { x: 0, y: 0, width, height };
  }

  setViewBox(x: number, y: number, width: number, height: number): this {
    this.viewBox = { x, y, width, height };
    return this;
  }

  addDefinition(def: string): this {
    this.definitions.push(def);
    return this;
  }

  addElement(element: string): this {
    this.elements.push(element);
    return this;
  }

  addGroup(elements: string[], transform?: string, id?: string): this {
    const transformAttr = transform ? `transform="${transform}"` : '';
    const idAttr = id ? `id="${id}"` : '';
    this.elements.push(`<g ${idAttr} ${transformAttr}>${elements.join('')}</g>`);
    return this;
  }

  generate(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${this.width}" height="${this.height}"
     viewBox="${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}">
  <defs>
    <!-- Arrow marker for dimensions -->
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" 
            orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="black"/>
    </marker>
    ${this.definitions.join('\n')}
  </defs>
  ${this.elements.join('\n')}
</svg>`;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  DrawingPrimitives,
  StructuralDiagrams,
  GeotechnicalVisualizations,
  HydraulicVisualizations,
  TransportationVisualizations,
  Visualization3D,
  SVGDocumentGenerator,
  COLOR_SCHEMES,
};
