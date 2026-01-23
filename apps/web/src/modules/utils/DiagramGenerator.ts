/**
 * ============================================================================
 * DIAGRAM GENERATOR - STRUCTURAL ENGINEERING VISUALIZATION
 * ============================================================================
 * 
 * Generates SVG diagrams for structural engineering calculations
 * 
 * DIAGRAM TYPES:
 * - Cross-section diagrams (beams, columns, piles)
 * - Stress block diagrams
 * - Bending moment diagrams
 * - Shear force diagrams  
 * - Deflection curves
 * - Interaction diagrams
 * - Reinforcement layouts
 * - Connection details
 * 
 * @author BeamLab Engineering Team
 * @version 1.0.0
 */

import { DiagramType, DiagramData } from '../core/CalculationEngine';

// ============================================================================
// SVG CONSTANTS
// ============================================================================

export const SVG_DEFAULTS = {
  viewBox: {
    width: 600,
    height: 400,
  },
  padding: {
    top: 40,
    right: 40,
    bottom: 60,
    left: 60,
  },
  colors: {
    concrete: '#8B8B8B',
    steel: '#4A5568',
    stirrup: '#2D3748',
    tension: '#E53E3E',
    compression: '#3182CE',
    neutral: '#718096',
    dimension: '#2D3748',
    grid: '#E2E8F0',
    fill_concrete: '#D1D5DB',
    fill_steel: '#374151',
    moment_positive: '#10B981',
    moment_negative: '#EF4444',
    shear_positive: '#3B82F6',
    shear_negative: '#F59E0B',
  },
  fonts: {
    title: '14px Arial, sans-serif',
    label: '12px Arial, sans-serif',
    dimension: '10px Arial, sans-serif',
    annotation: '9px Arial, sans-serif',
  },
  stroke: {
    thick: 2,
    medium: 1.5,
    thin: 1,
    hairline: 0.5,
  },
} as const;

// ============================================================================
// INTERFACES
// ============================================================================

export interface BeamCrossSectionData {
  width: number;         // mm
  depth: number;         // mm
  cover: number;         // mm
  top_bars: number[];    // Array of bar diameters
  bottom_bars: number[]; // Array of bar diameters
  stirrup_diameter: number;
  stirrup_spacing: number;
  neutral_axis?: number; // Distance from top (mm)
  compression_zone?: number; // xu (mm)
}

export interface ColumnCrossSectionData {
  width: number;         // mm (B)
  depth: number;         // mm (D)
  cover: number;         // mm
  bars: {
    diameter: number;
    positions: { x: number; y: number }[]; // Normalized 0-1
  };
  tie_diameter: number;
  tie_spacing: number;
  cross_ties?: boolean;
}

export interface StressBlockData {
  depth: number;         // mm - Total depth
  xu: number;            // mm - Neutral axis depth
  fck: number;           // MPa
  fy: number;            // MPa
  As: number;            // mm² - Tension steel area
  d: number;             // mm - Effective depth
  code: 'IS456' | 'ACI' | 'EC2';
}

export interface MomentDiagramData {
  span: number;          // mm
  moments: { x: number; M: number }[]; // x in mm, M in kN·m
  max_positive: number;  // kN·m
  max_negative: number;  // kN·m
  inflection_points?: number[]; // x positions in mm
}

export interface ShearDiagramData {
  span: number;          // mm
  shears: { x: number; V: number }[]; // x in mm, V in kN
  max_positive: number;  // kN
  max_negative: number;  // kN
}

export interface DeflectionData {
  span: number;          // mm
  deflections: { x: number; delta: number }[]; // x in mm, delta in mm
  max_deflection: number;
  limit: number;         // Allowable deflection (mm)
}

export interface InteractionDiagramData {
  points: { P: number; M: number }[]; // P in kN, M in kN·m
  design_point: { P: number; M: number };
  balanced_point: { P: number; M: number };
  pure_compression: number;
  pure_tension: number;
  pure_bending: number;
}

export interface ReinforcementLayoutData {
  width: number;
  depth: number;
  layers: {
    y: number;           // Distance from bottom (mm)
    bars: { diameter: number; spacing: number }[];
  }[];
  stirrups: {
    diameter: number;
    spacing: number;
    legs: number;
  };
}

// ============================================================================
// SVG HELPER FUNCTIONS
// ============================================================================

/**
 * Create SVG element string
 */
export function createSvgElement(
  tag: string,
  attributes: Record<string, string | number>,
  content?: string
): string {
  const attrs = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  
  if (content) {
    return `<${tag} ${attrs}>${content}</${tag}>`;
  }
  return `<${tag} ${attrs} />`;
}

/**
 * Create SVG group element
 */
export function createGroup(
  transform: string,
  children: string[]
): string {
  return `<g transform="${transform}">${children.join('')}</g>`;
}

/**
 * Create dimension line with text
 */
export function createDimensionLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  text: string,
  offset: number = 20
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  
  // Perpendicular offset
  const nx = -dy / length * offset;
  const ny = dx / length * offset;
  
  const elements: string[] = [];
  
  // Extension lines
  elements.push(createSvgElement('line', {
    x1: x1, y1: y1,
    x2: x1 + nx, y2: y1 + ny,
    stroke: SVG_DEFAULTS.colors.dimension,
    'stroke-width': SVG_DEFAULTS.stroke.hairline,
  }));
  
  elements.push(createSvgElement('line', {
    x1: x2, y1: y2,
    x2: x2 + nx, y2: y2 + ny,
    stroke: SVG_DEFAULTS.colors.dimension,
    'stroke-width': SVG_DEFAULTS.stroke.hairline,
  }));
  
  // Dimension line with arrows
  elements.push(createSvgElement('line', {
    x1: x1 + nx, y1: y1 + ny,
    x2: x2 + nx, y2: y2 + ny,
    stroke: SVG_DEFAULTS.colors.dimension,
    'stroke-width': SVG_DEFAULTS.stroke.thin,
    'marker-start': 'url(#arrowStart)',
    'marker-end': 'url(#arrowEnd)',
  }));
  
  // Dimension text
  const midX = (x1 + x2) / 2 + nx;
  const midY = (y1 + y2) / 2 + ny;
  
  elements.push(createSvgElement('text', {
    x: midX,
    y: midY - 5,
    'text-anchor': 'middle',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '10',
    transform: `rotate(${angle}, ${midX}, ${midY})`,
  }, text));
  
  return elements.join('');
}

/**
 * Create arrow markers definition
 */
export function createArrowMarkers(): string {
  return `
    <defs>
      <marker id="arrowStart" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
        <path d="M6,0 L6,6 L0,3 Z" fill="${SVG_DEFAULTS.colors.dimension}" />
      </marker>
      <marker id="arrowEnd" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L6,3 Z" fill="${SVG_DEFAULTS.colors.dimension}" />
      </marker>
      <pattern id="concrete-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="${SVG_DEFAULTS.colors.grid}" stroke-width="0.5" />
      </pattern>
    </defs>
  `;
}

// ============================================================================
// DIAGRAM GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate beam cross-section diagram
 * Shows concrete section with reinforcement
 */
export function generateBeamCrossSection(
  data: BeamCrossSectionData,
  title?: string
): string {
  const { width, depth, cover, top_bars, bottom_bars, stirrup_diameter, neutral_axis, compression_zone } = data;
  
  // Scale to fit viewport
  const maxDim = Math.max(width, depth);
  const scale = 250 / maxDim;
  const scaledW = width * scale;
  const scaledD = depth * scale;
  
  const offsetX = (SVG_DEFAULTS.viewBox.width - scaledW) / 2;
  const offsetY = 60;
  
  const elements: string[] = [];
  
  // Add markers
  elements.push(createArrowMarkers());
  
  // Concrete section
  elements.push(createSvgElement('rect', {
    x: offsetX,
    y: offsetY,
    width: scaledW,
    height: scaledD,
    fill: SVG_DEFAULTS.colors.fill_concrete,
    stroke: SVG_DEFAULTS.colors.concrete,
    'stroke-width': SVG_DEFAULTS.stroke.thick,
  }));
  
  // Stirrups (outer rectangle)
  const stirrupOffset = cover * scale;
  elements.push(createSvgElement('rect', {
    x: offsetX + stirrupOffset,
    y: offsetY + stirrupOffset,
    width: scaledW - 2 * stirrupOffset,
    height: scaledD - 2 * stirrupOffset,
    fill: 'none',
    stroke: SVG_DEFAULTS.colors.stirrup,
    'stroke-width': SVG_DEFAULTS.stroke.medium,
    'stroke-dasharray': '5,5',
  }));
  
  // Top bars
  const topBarY = offsetY + cover * scale + stirrup_diameter * scale / 2;
  const topBarSpacing = (scaledW - 2 * cover * scale - 2 * stirrup_diameter * scale) / (top_bars.length - 1 || 1);
  top_bars.forEach((dia, i) => {
    const barX = offsetX + cover * scale + stirrup_diameter * scale + (top_bars.length > 1 ? i * topBarSpacing : (scaledW - 2 * cover * scale) / 2);
    elements.push(createSvgElement('circle', {
      cx: barX,
      cy: topBarY + dia * scale / 2,
      r: dia * scale / 2,
      fill: SVG_DEFAULTS.colors.fill_steel,
      stroke: SVG_DEFAULTS.colors.steel,
      'stroke-width': 1,
    }));
  });
  
  // Bottom bars
  const bottomBarY = offsetY + scaledD - cover * scale - stirrup_diameter * scale / 2;
  const bottomBarSpacing = (scaledW - 2 * cover * scale - 2 * stirrup_diameter * scale) / (bottom_bars.length - 1 || 1);
  bottom_bars.forEach((dia, i) => {
    const barX = offsetX + cover * scale + stirrup_diameter * scale + (bottom_bars.length > 1 ? i * bottomBarSpacing : (scaledW - 2 * cover * scale) / 2);
    elements.push(createSvgElement('circle', {
      cx: barX,
      cy: bottomBarY - dia * scale / 2,
      r: dia * scale / 2,
      fill: SVG_DEFAULTS.colors.fill_steel,
      stroke: SVG_DEFAULTS.colors.steel,
      'stroke-width': 1,
    }));
  });
  
  // Neutral axis (if provided)
  if (neutral_axis) {
    const naY = offsetY + neutral_axis * scale;
    elements.push(createSvgElement('line', {
      x1: offsetX - 20,
      y1: naY,
      x2: offsetX + scaledW + 20,
      y2: naY,
      stroke: SVG_DEFAULTS.colors.neutral,
      'stroke-width': SVG_DEFAULTS.stroke.thin,
      'stroke-dasharray': '8,4',
    }));
    elements.push(createSvgElement('text', {
      x: offsetX + scaledW + 25,
      y: naY + 4,
      fill: SVG_DEFAULTS.colors.neutral,
      'font-size': '10',
    }, 'N.A.'));
  }
  
  // Compression zone (if provided)
  if (compression_zone) {
    const compHeight = compression_zone * scale;
    elements.push(createSvgElement('rect', {
      x: offsetX,
      y: offsetY,
      width: scaledW,
      height: compHeight,
      fill: SVG_DEFAULTS.colors.compression,
      opacity: 0.2,
    }));
  }
  
  // Dimension lines
  // Width dimension
  elements.push(createDimensionLine(
    offsetX, offsetY + scaledD + 30,
    offsetX + scaledW, offsetY + scaledD + 30,
    `${width} mm`
  ));
  
  // Depth dimension
  elements.push(createDimensionLine(
    offsetX - 30, offsetY,
    offsetX - 30, offsetY + scaledD,
    `${depth} mm`,
    -25
  ));
  
  // Title
  if (title) {
    elements.push(createSvgElement('text', {
      x: SVG_DEFAULTS.viewBox.width / 2,
      y: 25,
      'text-anchor': 'middle',
      fill: SVG_DEFAULTS.colors.dimension,
      'font-size': '14',
      'font-weight': 'bold',
    }, title));
  }
  
  // Legend
  const legendY = offsetY + scaledD + 60;
  elements.push(createSvgElement('text', {
    x: offsetX,
    y: legendY,
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '10',
  }, `Top: ${top_bars.length}-${top_bars[0] || 0}mm | Bottom: ${bottom_bars.length}-${bottom_bars[0] || 0}mm | Stirrups: ${stirrup_diameter}mm @ ${data.stirrup_spacing}mm c/c`));
  
  return `<svg viewBox="0 0 ${SVG_DEFAULTS.viewBox.width} ${SVG_DEFAULTS.viewBox.height}" xmlns="http://www.w3.org/2000/svg">${elements.join('')}</svg>`;
}

/**
 * Generate stress block diagram per IS 456
 */
export function generateStressBlockDiagram(
  data: StressBlockData,
  title?: string
): string {
  const { depth, xu, fck, fy, As, d, code } = data;
  
  const elements: string[] = [];
  elements.push(createArrowMarkers());
  
  const scale = 200 / depth;
  const beamWidth = 80;
  const offsetX = 80;
  const offsetY = 50;
  const scaledD = depth * scale;
  const scaledXu = xu * scale;
  const scaledEffD = d * scale;
  
  // Beam section (simplified rectangle)
  elements.push(createSvgElement('rect', {
    x: offsetX,
    y: offsetY,
    width: beamWidth,
    height: scaledD,
    fill: SVG_DEFAULTS.colors.fill_concrete,
    stroke: SVG_DEFAULTS.colors.concrete,
    'stroke-width': SVG_DEFAULTS.stroke.thick,
  }));
  
  // Neutral axis
  elements.push(createSvgElement('line', {
    x1: offsetX - 10,
    y1: offsetY + scaledXu,
    x2: offsetX + beamWidth + 10,
    y2: offsetY + scaledXu,
    stroke: SVG_DEFAULTS.colors.neutral,
    'stroke-width': SVG_DEFAULTS.stroke.thin,
    'stroke-dasharray': '5,3',
  }));
  
  // Strain diagram
  const strainX = offsetX + beamWidth + 50;
  const strainWidth = 60;
  
  // Strain triangle
  const ecu = code === 'IS456' ? 0.0035 : 0.003;
  const strain_y_top = offsetY;
  const strain_y_na = offsetY + scaledXu;
  const strain_y_steel = offsetY + scaledEffD;
  
  elements.push(createSvgElement('polygon', {
    points: `${strainX},${strain_y_top} ${strainX + strainWidth},${strain_y_top} ${strainX},${strain_y_na}`,
    fill: SVG_DEFAULTS.colors.compression,
    opacity: 0.3,
    stroke: SVG_DEFAULTS.colors.compression,
    'stroke-width': 1,
  }));
  
  // Tension strain
  const es = (d - xu) / xu * ecu;
  const strainTensionWidth = Math.min(es / ecu * strainWidth, strainWidth * 2);
  elements.push(createSvgElement('polygon', {
    points: `${strainX},${strain_y_na} ${strainX - strainTensionWidth},${strain_y_steel} ${strainX},${strain_y_steel}`,
    fill: SVG_DEFAULTS.colors.tension,
    opacity: 0.3,
    stroke: SVG_DEFAULTS.colors.tension,
    'stroke-width': 1,
  }));
  
  // Strain labels
  elements.push(createSvgElement('text', {
    x: strainX + strainWidth + 5,
    y: strain_y_top + 10,
    fill: SVG_DEFAULTS.colors.compression,
    'font-size': '10',
  }, `εcu = ${ecu}`));
  
  elements.push(createSvgElement('text', {
    x: strainX - strainTensionWidth - 30,
    y: strain_y_steel,
    fill: SVG_DEFAULTS.colors.tension,
    'font-size': '10',
  }, `εs = ${es.toFixed(4)}`));
  
  elements.push(createSvgElement('text', {
    x: strainX + strainWidth / 2,
    y: offsetY + scaledD + 20,
    'text-anchor': 'middle',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '11',
    'font-weight': 'bold',
  }, 'Strain'));
  
  // Stress block
  const stressX = strainX + strainWidth + 80;
  const stressWidth = 50;
  
  // IS 456 parabolic-rectangular stress block (simplified as rectangle)
  const stressBlockDepth = code === 'IS456' ? 0.42 * scaledXu : 0.85 * scaledXu;
  const stressFactor = code === 'IS456' ? 0.36 : 0.85 * 0.85;
  const fc_design = stressFactor * fck;
  
  elements.push(createSvgElement('rect', {
    x: stressX,
    y: offsetY,
    width: stressWidth,
    height: stressBlockDepth * (code === 'IS456' ? 1 / 0.42 : 1),
    fill: SVG_DEFAULTS.colors.compression,
    opacity: 0.4,
    stroke: SVG_DEFAULTS.colors.compression,
    'stroke-width': 1,
  }));
  
  // Compression force arrow
  const Cu = fc_design * beamWidth * xu / 1000; // Approximate
  const Cu_y = offsetY + stressBlockDepth;
  elements.push(createSvgElement('line', {
    x1: stressX + stressWidth,
    y1: Cu_y,
    x2: stressX + stressWidth + 40,
    y2: Cu_y,
    stroke: SVG_DEFAULTS.colors.compression,
    'stroke-width': 2,
    'marker-end': 'url(#arrowEnd)',
  }));
  elements.push(createSvgElement('text', {
    x: stressX + stressWidth + 45,
    y: Cu_y + 4,
    fill: SVG_DEFAULTS.colors.compression,
    'font-size': '10',
  }, `Cu`));
  
  // Tension force arrow  
  const Tu_y = offsetY + scaledEffD;
  elements.push(createSvgElement('line', {
    x1: stressX + stressWidth + 40,
    y1: Tu_y,
    x2: stressX + stressWidth,
    y2: Tu_y,
    stroke: SVG_DEFAULTS.colors.tension,
    'stroke-width': 2,
    'marker-end': 'url(#arrowEnd)',
  }));
  elements.push(createSvgElement('text', {
    x: stressX + stressWidth + 45,
    y: Tu_y + 4,
    fill: SVG_DEFAULTS.colors.tension,
    'font-size': '10',
  }, `Tu`));
  
  // Lever arm
  const z = d - (code === 'IS456' ? 0.42 * xu : 0.425 * xu);
  elements.push(createSvgElement('line', {
    x1: stressX + stressWidth + 60,
    y1: Cu_y,
    x2: stressX + stressWidth + 60,
    y2: Tu_y,
    stroke: SVG_DEFAULTS.colors.dimension,
    'stroke-width': 1,
    'stroke-dasharray': '3,2',
  }));
  elements.push(createSvgElement('text', {
    x: stressX + stressWidth + 65,
    y: (Cu_y + Tu_y) / 2,
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '9',
  }, `z = ${(z / scale).toFixed(0)}mm`));
  
  elements.push(createSvgElement('text', {
    x: stressX + stressWidth / 2,
    y: offsetY + scaledD + 20,
    'text-anchor': 'middle',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '11',
    'font-weight': 'bold',
  }, 'Stress'));
  
  // Section label
  elements.push(createSvgElement('text', {
    x: offsetX + beamWidth / 2,
    y: offsetY + scaledD + 20,
    'text-anchor': 'middle',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '11',
    'font-weight': 'bold',
  }, 'Section'));
  
  // Dimension: xu
  elements.push(createSvgElement('line', {
    x1: offsetX - 20,
    y1: offsetY,
    x2: offsetX - 20,
    y2: offsetY + scaledXu,
    stroke: SVG_DEFAULTS.colors.dimension,
    'stroke-width': 1,
  }));
  elements.push(createSvgElement('text', {
    x: offsetX - 25,
    y: offsetY + scaledXu / 2,
    'text-anchor': 'end',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '10',
  }, `xu=${xu.toFixed(0)}`));
  
  // Title
  const titleText = title || `Stress Block - ${code}`;
  elements.push(createSvgElement('text', {
    x: SVG_DEFAULTS.viewBox.width / 2,
    y: 25,
    'text-anchor': 'middle',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '14',
    'font-weight': 'bold',
  }, titleText));
  
  // Parameters
  const paramsY = offsetY + scaledD + 45;
  elements.push(createSvgElement('text', {
    x: offsetX,
    y: paramsY,
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '10',
  }, `fck = ${fck} MPa | fy = ${fy} MPa | d = ${d} mm | xu = ${xu.toFixed(1)} mm | xu/d = ${(xu/d).toFixed(3)}`));
  
  return `<svg viewBox="0 0 ${SVG_DEFAULTS.viewBox.width} ${SVG_DEFAULTS.viewBox.height}" xmlns="http://www.w3.org/2000/svg">${elements.join('')}</svg>`;
}

/**
 * Generate bending moment diagram
 */
export function generateMomentDiagram(
  data: MomentDiagramData,
  title?: string
): string {
  const { span, moments, max_positive, max_negative } = data;
  
  const elements: string[] = [];
  elements.push(createArrowMarkers());
  
  const plotWidth = SVG_DEFAULTS.viewBox.width - SVG_DEFAULTS.padding.left - SVG_DEFAULTS.padding.right;
  const plotHeight = SVG_DEFAULTS.viewBox.height - SVG_DEFAULTS.padding.top - SVG_DEFAULTS.padding.bottom - 40;
  
  const offsetX = SVG_DEFAULTS.padding.left;
  const baseY = SVG_DEFAULTS.padding.top + plotHeight / 2 + 20;
  
  const xScale = plotWidth / span;
  const maxM = Math.max(Math.abs(max_positive), Math.abs(max_negative));
  const yScale = (plotHeight / 2 - 10) / maxM;
  
  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = baseY - (i - 2) * (plotHeight / 4);
    elements.push(createSvgElement('line', {
      x1: offsetX,
      y1: y,
      x2: offsetX + plotWidth,
      y2: y,
      stroke: SVG_DEFAULTS.colors.grid,
      'stroke-width': SVG_DEFAULTS.stroke.hairline,
    }));
  }
  
  // Baseline (zero line)
  elements.push(createSvgElement('line', {
    x1: offsetX,
    y1: baseY,
    x2: offsetX + plotWidth,
    y2: baseY,
    stroke: SVG_DEFAULTS.colors.dimension,
    'stroke-width': SVG_DEFAULTS.stroke.medium,
  }));
  
  // Moment curve
  if (moments.length > 1) {
    // Build path for positive moments (below baseline - sagging)
    let pathPositive = `M ${offsetX},${baseY}`;
    let pathNegative = `M ${offsetX},${baseY}`;
    
    moments.forEach((pt) => {
      const x = offsetX + pt.x * xScale;
      const y = baseY - pt.M * yScale; // Negative M goes up (hogging)
      
      if (pt.M >= 0) {
        pathPositive += ` L ${x},${y}`;
      } else {
        pathNegative += ` L ${x},${y}`;
      }
    });
    
    // Fill area under curve
    const pathPoints = moments.map(pt => {
      const x = offsetX + pt.x * xScale;
      const y = baseY - pt.M * yScale;
      return `${x},${y}`;
    });
    
    const fillPath = `M ${offsetX},${baseY} L ${pathPoints.join(' L ')} L ${offsetX + plotWidth},${baseY} Z`;
    
    // Separate positive and negative fills
    elements.push(createSvgElement('path', {
      d: fillPath,
      fill: 'url(#momentGradient)',
      opacity: 0.3,
    }));
    
    // Main curve
    const curvePath = `M ${pathPoints.join(' L ')}`;
    elements.push(createSvgElement('path', {
      d: curvePath,
      fill: 'none',
      stroke: SVG_DEFAULTS.colors.moment_positive,
      'stroke-width': SVG_DEFAULTS.stroke.thick,
    }));
  }
  
  // Max positive annotation
  if (max_positive > 0) {
    const maxPosPt = moments.find(pt => Math.abs(pt.M - max_positive) < 0.1);
    if (maxPosPt) {
      const x = offsetX + maxPosPt.x * xScale;
      const y = baseY - maxPosPt.M * yScale;
      elements.push(createSvgElement('circle', {
        cx: x,
        cy: y,
        r: 4,
        fill: SVG_DEFAULTS.colors.moment_positive,
      }));
      elements.push(createSvgElement('text', {
        x: x,
        y: y + 15,
        'text-anchor': 'middle',
        fill: SVG_DEFAULTS.colors.moment_positive,
        'font-size': '10',
      }, `+${max_positive.toFixed(1)} kN·m`));
    }
  }
  
  // Max negative annotation
  if (max_negative < 0) {
    const maxNegPt = moments.find(pt => Math.abs(pt.M - max_negative) < 0.1);
    if (maxNegPt) {
      const x = offsetX + maxNegPt.x * xScale;
      const y = baseY - maxNegPt.M * yScale;
      elements.push(createSvgElement('circle', {
        cx: x,
        cy: y,
        r: 4,
        fill: SVG_DEFAULTS.colors.moment_negative,
      }));
      elements.push(createSvgElement('text', {
        x: x,
        y: y - 10,
        'text-anchor': 'middle',
        fill: SVG_DEFAULTS.colors.moment_negative,
        'font-size': '10',
      }, `${max_negative.toFixed(1)} kN·m`));
    }
  }
  
  // X-axis labels
  elements.push(createSvgElement('text', {
    x: offsetX,
    y: baseY + 25,
    'text-anchor': 'start',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '10',
  }, '0'));
  
  elements.push(createSvgElement('text', {
    x: offsetX + plotWidth / 2,
    y: baseY + 25,
    'text-anchor': 'middle',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '10',
  }, `${(span / 2 / 1000).toFixed(2)} m`));
  
  elements.push(createSvgElement('text', {
    x: offsetX + plotWidth,
    y: baseY + 25,
    'text-anchor': 'end',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '10',
  }, `${(span / 1000).toFixed(2)} m`));
  
  // Y-axis label
  elements.push(createSvgElement('text', {
    x: 15,
    y: baseY,
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '10',
    transform: `rotate(-90, 15, ${baseY})`,
  }, 'Moment (kN·m)'));
  
  // Title
  const titleText = title || 'Bending Moment Diagram';
  elements.push(createSvgElement('text', {
    x: SVG_DEFAULTS.viewBox.width / 2,
    y: 25,
    'text-anchor': 'middle',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '14',
    'font-weight': 'bold',
  }, titleText));
  
  // Legend
  elements.push(createSvgElement('rect', {
    x: offsetX + plotWidth - 120,
    y: SVG_DEFAULTS.padding.top,
    width: 10,
    height: 10,
    fill: SVG_DEFAULTS.colors.moment_positive,
  }));
  elements.push(createSvgElement('text', {
    x: offsetX + plotWidth - 105,
    y: SVG_DEFAULTS.padding.top + 9,
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '10',
  }, 'Sagging (+ve)'));
  
  elements.push(createSvgElement('rect', {
    x: offsetX + plotWidth - 120,
    y: SVG_DEFAULTS.padding.top + 15,
    width: 10,
    height: 10,
    fill: SVG_DEFAULTS.colors.moment_negative,
  }));
  elements.push(createSvgElement('text', {
    x: offsetX + plotWidth - 105,
    y: SVG_DEFAULTS.padding.top + 24,
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '10',
  }, 'Hogging (-ve)'));
  
  // Add gradient definition
  const defs = `
    <defs>
      ${createArrowMarkers()}
      <linearGradient id="momentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:${SVG_DEFAULTS.colors.moment_negative};stop-opacity:0.5" />
        <stop offset="50%" style="stop-color:white;stop-opacity:0" />
        <stop offset="100%" style="stop-color:${SVG_DEFAULTS.colors.moment_positive};stop-opacity:0.5" />
      </linearGradient>
    </defs>
  `;
  
  return `<svg viewBox="0 0 ${SVG_DEFAULTS.viewBox.width} ${SVG_DEFAULTS.viewBox.height}" xmlns="http://www.w3.org/2000/svg">${defs}${elements.join('')}</svg>`;
}

/**
 * Generate column interaction diagram
 */
export function generateInteractionDiagram(
  data: InteractionDiagramData,
  title?: string
): string {
  const { points, design_point, balanced_point, pure_compression, pure_tension, pure_bending } = data;
  
  const elements: string[] = [];
  elements.push(createArrowMarkers());
  
  const plotWidth = SVG_DEFAULTS.viewBox.width - SVG_DEFAULTS.padding.left - SVG_DEFAULTS.padding.right;
  const plotHeight = SVG_DEFAULTS.viewBox.height - SVG_DEFAULTS.padding.top - SVG_DEFAULTS.padding.bottom;
  
  const offsetX = SVG_DEFAULTS.padding.left;
  const offsetY = SVG_DEFAULTS.padding.top;
  
  // Find scales
  const maxP = Math.max(pure_compression, ...points.map(p => p.P));
  const minP = Math.min(pure_tension, ...points.map(p => p.P));
  const maxM = Math.max(pure_bending, ...points.map(p => Math.abs(p.M)));
  
  const pRange = maxP - minP;
  const yScale = plotHeight / pRange;
  const xScale = plotWidth / maxM;
  
  const zeroY = offsetY + maxP * yScale;
  
  // Grid
  for (let i = 0; i <= 5; i++) {
    const y = offsetY + i * plotHeight / 5;
    elements.push(createSvgElement('line', {
      x1: offsetX,
      y1: y,
      x2: offsetX + plotWidth,
      y2: y,
      stroke: SVG_DEFAULTS.colors.grid,
      'stroke-width': SVG_DEFAULTS.stroke.hairline,
    }));
    
    const x = offsetX + i * plotWidth / 5;
    elements.push(createSvgElement('line', {
      x1: x,
      y1: offsetY,
      x2: x,
      y2: offsetY + plotHeight,
      stroke: SVG_DEFAULTS.colors.grid,
      'stroke-width': SVG_DEFAULTS.stroke.hairline,
    }));
  }
  
  // Axes
  elements.push(createSvgElement('line', {
    x1: offsetX,
    y1: offsetY,
    x2: offsetX,
    y2: offsetY + plotHeight,
    stroke: SVG_DEFAULTS.colors.dimension,
    'stroke-width': SVG_DEFAULTS.stroke.medium,
    'marker-end': 'url(#arrowEnd)',
  }));
  
  elements.push(createSvgElement('line', {
    x1: offsetX,
    y1: zeroY,
    x2: offsetX + plotWidth,
    y2: zeroY,
    stroke: SVG_DEFAULTS.colors.dimension,
    'stroke-width': SVG_DEFAULTS.stroke.medium,
    'marker-end': 'url(#arrowEnd)',
  }));
  
  // Interaction curve
  const curvePoints = points.map(pt => {
    const x = offsetX + Math.abs(pt.M) * xScale;
    const y = offsetY + (maxP - pt.P) * yScale;
    return `${x},${y}`;
  });
  
  elements.push(createSvgElement('polygon', {
    points: curvePoints.join(' '),
    fill: SVG_DEFAULTS.colors.compression,
    opacity: 0.2,
    stroke: SVG_DEFAULTS.colors.compression,
    'stroke-width': SVG_DEFAULTS.stroke.thick,
  }));
  
  // Balanced point
  const bpX = offsetX + Math.abs(balanced_point.M) * xScale;
  const bpY = offsetY + (maxP - balanced_point.P) * yScale;
  elements.push(createSvgElement('circle', {
    cx: bpX,
    cy: bpY,
    r: 5,
    fill: SVG_DEFAULTS.colors.moment_positive,
    stroke: 'white',
    'stroke-width': 1,
  }));
  elements.push(createSvgElement('text', {
    x: bpX + 10,
    y: bpY,
    fill: SVG_DEFAULTS.colors.moment_positive,
    'font-size': '10',
  }, 'Balanced'));
  
  // Design point
  const dpX = offsetX + Math.abs(design_point.M) * xScale;
  const dpY = offsetY + (maxP - design_point.P) * yScale;
  elements.push(createSvgElement('circle', {
    cx: dpX,
    cy: dpY,
    r: 6,
    fill: SVG_DEFAULTS.colors.tension,
    stroke: 'white',
    'stroke-width': 2,
  }));
  elements.push(createSvgElement('text', {
    x: dpX + 10,
    y: dpY - 5,
    fill: SVG_DEFAULTS.colors.tension,
    'font-size': '10',
    'font-weight': 'bold',
  }, `Design Point`));
  elements.push(createSvgElement('text', {
    x: dpX + 10,
    y: dpY + 8,
    fill: SVG_DEFAULTS.colors.tension,
    'font-size': '9',
  }, `(${design_point.M.toFixed(0)}, ${design_point.P.toFixed(0)})`));
  
  // Axis labels
  elements.push(createSvgElement('text', {
    x: offsetX - 10,
    y: offsetY + plotHeight / 2,
    'text-anchor': 'middle',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '11',
    transform: `rotate(-90, ${offsetX - 30}, ${offsetY + plotHeight / 2})`,
  }, 'Axial Load P (kN)'));
  
  elements.push(createSvgElement('text', {
    x: offsetX + plotWidth / 2,
    y: offsetY + plotHeight + 40,
    'text-anchor': 'middle',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '11',
  }, 'Bending Moment M (kN·m)'));
  
  // Title
  const titleText = title || 'Column Interaction Diagram';
  elements.push(createSvgElement('text', {
    x: SVG_DEFAULTS.viewBox.width / 2,
    y: 20,
    'text-anchor': 'middle',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '14',
    'font-weight': 'bold',
  }, titleText));
  
  // Key values
  elements.push(createSvgElement('text', {
    x: offsetX + plotWidth - 10,
    y: offsetY + 15,
    'text-anchor': 'end',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '9',
  }, `Pu,max = ${pure_compression.toFixed(0)} kN`));
  
  elements.push(createSvgElement('text', {
    x: offsetX + plotWidth - 10,
    y: offsetY + plotHeight - 5,
    'text-anchor': 'end',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '9',
  }, `Tu,max = ${Math.abs(pure_tension).toFixed(0)} kN`));
  
  return `<svg viewBox="0 0 ${SVG_DEFAULTS.viewBox.width} ${SVG_DEFAULTS.viewBox.height}" xmlns="http://www.w3.org/2000/svg">${elements.join('')}</svg>`;
}

/**
 * Generate reinforcement detailing diagram
 */
export function generateReinforcementDetail(
  data: ReinforcementLayoutData,
  title?: string
): string {
  const { width, depth, layers, stirrups } = data;
  
  const elements: string[] = [];
  elements.push(createArrowMarkers());
  
  const scale = 200 / Math.max(width, depth);
  const scaledW = width * scale;
  const scaledD = depth * scale;
  
  const offsetX = (SVG_DEFAULTS.viewBox.width - scaledW) / 2;
  const offsetY = 60;
  
  // Concrete outline
  elements.push(createSvgElement('rect', {
    x: offsetX,
    y: offsetY,
    width: scaledW,
    height: scaledD,
    fill: 'none',
    stroke: SVG_DEFAULTS.colors.concrete,
    'stroke-width': SVG_DEFAULTS.stroke.thick,
  }));
  
  // Stirrups
  const cover = 40 * scale;
  elements.push(createSvgElement('rect', {
    x: offsetX + cover,
    y: offsetY + cover,
    width: scaledW - 2 * cover,
    height: scaledD - 2 * cover,
    fill: 'none',
    stroke: SVG_DEFAULTS.colors.stirrup,
    'stroke-width': SVG_DEFAULTS.stroke.medium,
  }));
  
  // Draw layers of reinforcement
  layers.forEach((layer) => {
    const layerY = offsetY + scaledD - layer.y * scale;
    
    layer.bars.forEach((bar) => {
      const numBars = Math.floor((width - 2 * 40) / bar.spacing) + 1;
      const actualSpacing = (scaledW - 2 * cover) / (numBars - 1);
      
      for (let i = 0; i < numBars; i++) {
        const barX = offsetX + cover + i * actualSpacing;
        const barRadius = bar.diameter * scale / 2;
        
        elements.push(createSvgElement('circle', {
          cx: barX,
          cy: layerY,
          r: Math.max(barRadius, 4),
          fill: SVG_DEFAULTS.colors.fill_steel,
          stroke: SVG_DEFAULTS.colors.steel,
          'stroke-width': 1,
        }));
      }
    });
  });
  
  // Annotations
  elements.push(createSvgElement('text', {
    x: offsetX + scaledW / 2,
    y: offsetY + scaledD + 30,
    'text-anchor': 'middle',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '10',
  }, `${width}mm × ${depth}mm | Stirrups: ${stirrups.diameter}mm-${stirrups.legs} legs @ ${stirrups.spacing}mm c/c`));
  
  // Title
  const titleText = title || 'Reinforcement Detail';
  elements.push(createSvgElement('text', {
    x: SVG_DEFAULTS.viewBox.width / 2,
    y: 25,
    'text-anchor': 'middle',
    fill: SVG_DEFAULTS.colors.dimension,
    'font-size': '14',
    'font-weight': 'bold',
  }, titleText));
  
  return `<svg viewBox="0 0 ${SVG_DEFAULTS.viewBox.width} ${SVG_DEFAULTS.viewBox.height}" xmlns="http://www.w3.org/2000/svg">${elements.join('')}</svg>`;
}

// ============================================================================
// MAIN DIAGRAM DISPATCHER
// ============================================================================

/**
 * Generate diagram based on type
 */
export function generateDiagram(diagramData: DiagramData): string {
  const { type, data, title } = diagramData;
  
  switch (type) {
    case DiagramType.CROSS_SECTION:
      return generateBeamCrossSection(data as BeamCrossSectionData, title);
    case DiagramType.STRESS_BLOCK:
      return generateStressBlockDiagram(data as StressBlockData, title);
    case DiagramType.BENDING_MOMENT:
      return generateMomentDiagram(data as MomentDiagramData, title);
    case DiagramType.INTERACTION:
      return generateInteractionDiagram(data as InteractionDiagramData, title);
    case DiagramType.REINFORCEMENT_LAYOUT:
      return generateReinforcementDetail(data as ReinforcementLayoutData, title);
    default:
      return `<svg viewBox="0 0 400 200"><text x="200" y="100" text-anchor="middle">Diagram type not supported</text></svg>`;
  }
}

export default {
  generateBeamCrossSection,
  generateStressBlockDiagram,
  generateMomentDiagram,
  generateInteractionDiagram,
  generateReinforcementDetail,
  generateDiagram,
};