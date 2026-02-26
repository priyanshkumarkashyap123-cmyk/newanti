/**
 * SVGPrimitives.tsx — Reusable SVG drawing components for structural detailing
 *
 * Industry-standard drawing primitives following:
 *   IS 456:2000, SP 34:1987, IS 2502:1963 (Bar Bending), IS 962:1989 (Drawing Practice)
 *   ACI 318-19 Detailing Manual, ACI SP-66
 *
 * Includes:
 *  - DimensionLine (with ticks, extension lines, centered text)
 *  - RebarCircle (filled with diameter label)
 *  - StirrupDetail (with 135° seismic hooks per IS 13920)
 *  - ConcreteHatch (45° line pattern)
 *  - CoverAnnotation (arrow + "CLR COVER = xx mm")
 *  - BarBendShape (IS 2502 standard shapes)
 *  - SectionCutMarker (A—A line indicator)
 *  - LeaderLine (callout with text)
 *  - CentrelineMarker (chain-dot line)
 *  - RebarLayer (row of circles with spacing calc)
 *  - GroundHatch (below footing)
 *  - SupportSymbol (triangle/roller)
 */

import React, { FC, memo } from 'react';

// ================================================================
// CONSTANTS
// ================================================================

/** Standard drawing colors (dark-mode optimized) */
export const COLORS = {
  concrete: '#94a3b8',        // slate-400 — concrete outline
  concreteFill: '#334155',    // slate-700 — concrete fill
  hatch: '#64748b',           // slate-500 — hatch lines
  mainBar: '#ef4444',         // red-500 — tension / main bars
  mainBarStroke: '#991b1b',   // red-800 — bar outline
  compBar: '#f97316',         // orange-500 — compression bars
  compBarStroke: '#9a3412',   // orange-800
  stirrup: '#3b82f6',         // blue-500 — stirrups/ties
  stirrupFill: 'none',
  dimension: '#a1a1aa',       // zinc-400 — dimension lines/text
  dimTick: '#a1a1aa',
  leader: '#71717a',          // zinc-500
  cover: '#22d3ee',           // cyan-400 — cover arrows
  centerline: '#6366f1',      // indigo-400
  sectionCut: '#f43f5e',      // rose-500
  soil: '#78716c',            // stone-500
  NA: '#facc15',              // yellow-400 — neutral axis
  label: '#e2e8f0',           // slate-200
  sublabel: '#94a3b8',        // slate-400
  bg: '#0f172a',              // slate-900
};

export const FONT = {
  family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  dim: 10,
  label: 11,
  title: 13,
  small: 8,
};

// ================================================================
// CONCRETE HATCH PATTERN (defs)
// ================================================================

/** 45° line hatch pattern for concrete cross-sections — add inside <defs> */
export const ConcreteHatchDef: FC<{ id?: string; spacing?: number; color?: string }> = memo(({
  id = 'concrete-hatch',
  spacing = 6,
  color = COLORS.hatch,
}) => (
  <pattern id={id} width={spacing} height={spacing} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1={0} y1={0} x2={0} y2={spacing} stroke={color} strokeWidth={0.4} />
  </pattern>
));
ConcreteHatchDef.displayName = 'ConcreteHatchDef';

/** Cross-hatch (two directions) for cut sections */
export const CrossHatchDef: FC<{ id?: string; spacing?: number }> = memo(({ id = 'cross-hatch', spacing = 6 }) => (
  <pattern id={id} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
    <line x1={0} y1={0} x2={spacing} y2={spacing} stroke={COLORS.hatch} strokeWidth={0.3} />
    <line x1={spacing} y1={0} x2={0} y2={spacing} stroke={COLORS.hatch} strokeWidth={0.3} />
  </pattern>
));
CrossHatchDef.displayName = 'CrossHatchDef';

/** Ground/soil hatch (diagonal lines, heavier) */
export const SoilHatchDef: FC<{ id?: string }> = memo(({ id = 'soil-hatch' }) => (
  <pattern id={id} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
    <line x1={0} y1={0} x2={0} y2={8} stroke={COLORS.soil} strokeWidth={0.6} />
  </pattern>
));
SoilHatchDef.displayName = 'SoilHatchDef';

// ================================================================
// DIMENSION LINE
// ================================================================

export interface DimensionLineProps {
  x1: number; y1: number;       // start point
  x2: number; y2: number;       // end point
  offset?: number;              // perpendicular offset from the object
  label: string;                // dimension text
  side?: 'left' | 'right' | 'top' | 'bottom'; // which side to place
  tickSize?: number;
  color?: string;
  fontSize?: number;
  extensionGap?: number;        // gap between object and extension line start
}

/** Industry-standard dimension line with extension lines, ticks, and centered label */
export const DimensionLine: FC<DimensionLineProps> = memo(({
  x1, y1, x2, y2, offset = 20, label,
  side = 'bottom',
  tickSize = 4,
  color = COLORS.dimension,
  fontSize = FONT.dim,
  extensionGap = 3,
}) => {
  const isHorizontal = side === 'top' || side === 'bottom';
  const isNeg = side === 'top' || side === 'left';
  const off = isNeg ? -offset : offset;

  if (isHorizontal) {
    // Horizontal dim
    const dy = y1 + off;
    const midX = (x1 + x2) / 2;
    const gap = isNeg ? extensionGap : -extensionGap;
    return (
      <g className="dimension-line">
        {/* Extension lines */}
        <line x1={x1} y1={y1 - gap} x2={x1} y2={dy} stroke={color} strokeWidth={0.5} />
        <line x1={x2} y1={y2 - gap} x2={x2} y2={dy} stroke={color} strokeWidth={0.5} />
        {/* Dimension line */}
        <line x1={x1} y1={dy} x2={x2} y2={dy} stroke={color} strokeWidth={0.6} />
        {/* Ticks (45° slash style per IS 962) */}
        <line x1={x1 - tickSize / 2} y1={dy + tickSize / 2} x2={x1 + tickSize / 2} y2={dy - tickSize / 2} stroke={color} strokeWidth={0.8} />
        <line x1={x2 - tickSize / 2} y1={dy + tickSize / 2} x2={x2 + tickSize / 2} y2={dy - tickSize / 2} stroke={color} strokeWidth={0.8} />
        {/* Label */}
        <text
          x={midX} y={dy + (isNeg ? -4 : fontSize + 2)}
          textAnchor="middle" fontSize={fontSize} fill={color}
          fontFamily={FONT.family} fontWeight={500}
        >
          {label}
        </text>
      </g>
    );
  } else {
    // Vertical dim
    const dx = x1 + off;
    const midY = (y1 + y2) / 2;
    const gap = isNeg ? extensionGap : -extensionGap;
    return (
      <g className="dimension-line">
        {/* Extension lines */}
        <line x1={x1 - gap} y1={y1} x2={dx} y2={y1} stroke={color} strokeWidth={0.5} />
        <line x1={x2 - gap} y1={y2} x2={dx} y2={y2} stroke={color} strokeWidth={0.5} />
        {/* Dimension line */}
        <line x1={dx} y1={y1} x2={dx} y2={y2} stroke={color} strokeWidth={0.6} />
        {/* Ticks */}
        <line x1={dx - tickSize / 2} y1={y1 + tickSize / 2} x2={dx + tickSize / 2} y2={y1 - tickSize / 2} stroke={color} strokeWidth={0.8} />
        <line x1={dx - tickSize / 2} y1={y2 + tickSize / 2} x2={dx + tickSize / 2} y2={y2 - tickSize / 2} stroke={color} strokeWidth={0.8} />
        {/* Label (rotated) */}
        <text
          x={dx + (isNeg ? -(fontSize + 2) : fontSize + 2)} y={midY}
          textAnchor="middle" fontSize={fontSize} fill={color}
          fontFamily={FONT.family} fontWeight={500}
          transform={`rotate(-90, ${dx + (isNeg ? -(fontSize + 2) : fontSize + 2)}, ${midY})`}
        >
          {label}
        </text>
      </g>
    );
  }
});
DimensionLine.displayName = 'DimensionLine';

// ================================================================
// REBAR CIRCLE
// ================================================================

export interface RebarCircleProps {
  cx: number;
  cy: number;
  diameter: number;         // actual bar diameter in mm
  scale: number;            // px per mm
  color?: string;
  strokeColor?: string;
  label?: string;           // e.g. "T16"
  labelSide?: 'top' | 'bottom' | 'right' | 'left';
  showCross?: boolean;      // cross through bar (section convention)
}

/** Rebar shown in cross-section: filled circle with optional label & cross-mark */
export const RebarCircle: FC<RebarCircleProps> = memo(({
  cx, cy, diameter, scale,
  color = COLORS.mainBar,
  strokeColor = COLORS.mainBarStroke,
  label, labelSide = 'bottom',
  showCross = false,
}) => {
  const r = Math.max((diameter * scale) / 2, 3.5);
  return (
    <g className="rebar-circle">
      <circle cx={cx} cy={cy} r={r} fill={color} stroke={strokeColor} strokeWidth={0.8} />
      {showCross && (
        <>
          <line x1={cx - r * 0.6} y1={cy - r * 0.6} x2={cx + r * 0.6} y2={cy + r * 0.6} stroke="#fff" strokeWidth={0.6} />
          <line x1={cx + r * 0.6} y1={cy - r * 0.6} x2={cx - r * 0.6} y2={cy + r * 0.6} stroke="#fff" strokeWidth={0.6} />
        </>
      )}
      {label && (
        <text
          x={labelSide === 'left' ? cx - r - 3 : labelSide === 'right' ? cx + r + 3 : cx}
          y={labelSide === 'top' ? cy - r - 3 : labelSide === 'bottom' ? cy + r + FONT.small + 2 : cy + 3}
          textAnchor={labelSide === 'left' ? 'end' : labelSide === 'right' ? 'start' : 'middle'}
          fontSize={FONT.small} fill={COLORS.sublabel}
          fontFamily={FONT.family}
        >
          {label}
        </text>
      )}
    </g>
  );
});
RebarCircle.displayName = 'RebarCircle';

// ================================================================
// REBAR LAYER — Row of evenly spaced rebar circles
// ================================================================

export interface RebarLayerProps {
  startX: number;           // first bar center X
  endX: number;             // last bar center X
  y: number;                // center Y
  count: number;            // number of bars
  diameter: number;         // mm
  scale: number;            // px per mm
  color?: string;
  strokeColor?: string;
  labelFirst?: string;      // label on first bar
}

/** Evenly-spaced row of rebar circles */
export const RebarLayer: FC<RebarLayerProps> = memo(({
  startX, endX, y, count, diameter, scale,
  color = COLORS.mainBar,
  strokeColor = COLORS.mainBarStroke,
  labelFirst,
}) => {
  if (count <= 0) return null;
  const spacing = count > 1 ? (endX - startX) / (count - 1) : 0;
  return (
    <g className="rebar-layer">
      {Array.from({ length: count }).map((_, i) => {
        const cx = count === 1 ? (startX + endX) / 2 : startX + i * spacing;
        return (
          <RebarCircle
            key={i}
            cx={cx} cy={y}
            diameter={diameter} scale={scale}
            color={color} strokeColor={strokeColor}
            label={i === 0 ? labelFirst : undefined}
            labelSide="bottom"
          />
        );
      })}
    </g>
  );
});
RebarLayer.displayName = 'RebarLayer';

// ================================================================
// STIRRUP DETAIL — Rectangular stirrup with 135° hooks
// ================================================================

export interface StirrupDetailProps {
  x: number;                // top-left X of stirrup
  y: number;                // top-left Y
  width: number;            // px
  height: number;           // px
  strokeWidth?: number;
  color?: string;
  hookLength?: number;      // px — length of 135° hook tail
  cornerRadius?: number;    // px — bend radius
  showHooks?: boolean;      // render 135° seismic hooks (IS 13920)
}

/** Rectangular stirrup with 135° hooks (IS 13920 Fig. 7A compliance) */
export const StirrupDetail: FC<StirrupDetailProps> = memo(({
  x, y, width, height,
  strokeWidth = 1.5,
  color = COLORS.stirrup,
  hookLength = 12,
  cornerRadius = 4,
  showHooks = true,
}) => {
  const r = cornerRadius;
  const hl = hookLength;

  // Main stirrup path with rounded corners
  const d = `
    M ${x + r} ${y}
    L ${x + width - r} ${y}
    Q ${x + width} ${y} ${x + width} ${y + r}
    L ${x + width} ${y + height - r}
    Q ${x + width} ${y + height} ${x + width - r} ${y + height}
    L ${x + r} ${y + height}
    Q ${x} ${y + height} ${x} ${y + height - r}
    L ${x} ${y + r}
    Q ${x} ${y} ${x + r} ${y}
    Z
  `;

  return (
    <g className="stirrup-detail">
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} />
      {showHooks && (
        <>
          {/* Top-left 135° hook */}
          <line
            x1={x + r + 2} y1={y}
            x2={x + r + 2 + hl * Math.cos(Math.PI * 0.75)} y2={y + hl * Math.sin(Math.PI * 0.75)}
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          />
          {/* Top-right 135° hook */}
          <line
            x1={x + width - r - 2} y1={y}
            x2={x + width - r - 2 - hl * Math.cos(Math.PI * 0.75)} y2={y + hl * Math.sin(Math.PI * 0.75)}
            stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
});
StirrupDetail.displayName = 'StirrupDetail';

// ================================================================
// COVER ANNOTATION — Arrow + "CLR COVER" label
// ================================================================

export interface CoverAnnotationProps {
  x: number;
  y: number;
  length: number;          // px length of arrow
  direction: 'up' | 'down' | 'left' | 'right';
  coverMM: number;         // actual cover in mm
  color?: string;
}

/** Clear cover annotation with arrow and text */
export const CoverAnnotation: FC<CoverAnnotationProps> = memo(({
  x, y, length, direction, coverMM,
  color = COLORS.cover,
}) => {
  const arrowSize = 3;
  let x2 = x, y2 = y;
  let tx = x, ty = y;
  let anchor: 'start' | 'middle' | 'end' = 'start';

  switch (direction) {
    case 'right': x2 = x + length; tx = x + length / 2; ty = y - 5; anchor = 'middle'; break;
    case 'left':  x2 = x - length; tx = x - length / 2; ty = y - 5; anchor = 'middle'; break;
    case 'down':  y2 = y + length; tx = x + 5; ty = y + length / 2; anchor = 'start'; break;
    case 'up':    y2 = y - length; tx = x + 5; ty = y - length / 2; anchor = 'start'; break;
  }

  return (
    <g className="cover-annotation">
      <line x1={x} y1={y} x2={x2} y2={y2} stroke={color} strokeWidth={0.8} markerEnd="url(#arrow-cover)" />
      <defs>
        <marker id="arrow-cover" viewBox="0 0 10 10" refX={10} refY={5}
          markerWidth={arrowSize} markerHeight={arrowSize} orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      <text
        x={tx} y={ty}
        textAnchor={anchor} fontSize={FONT.small - 1} fill={color}
        fontFamily={FONT.family} fontWeight={600}
      >
        {coverMM}
      </text>
    </g>
  );
});
CoverAnnotation.displayName = 'CoverAnnotation';

// ================================================================
// LEADER LINE — Callout with text
// ================================================================

export interface LeaderLineProps {
  fromX: number; fromY: number;
  toX: number; toY: number;
  text: string;
  textSide?: 'left' | 'right';
  color?: string;
  fontSize?: number;
}

/** Leader/callout line pointing from text to a feature */
export const LeaderLine: FC<LeaderLineProps> = memo(({
  fromX, fromY, toX, toY, text,
  textSide = 'right',
  color = COLORS.leader,
  fontSize = FONT.small,
}) => {
  const arrowSize = 3;
  const shelfLen = 20;
  const shelfX = textSide === 'right' ? toX + shelfLen : toX - shelfLen;

  return (
    <g className="leader-line">
      {/* Arrow marker */}
      <defs>
        <marker id="arrow-leader" viewBox="0 0 10 10" refX={10} refY={5}
          markerWidth={arrowSize} markerHeight={arrowSize} orient="auto-start-reverse">
          <path d="M 0 2 L 10 5 L 0 8 z" fill={color} />
        </marker>
      </defs>
      {/* Line from target to elbow */}
      <line x1={fromX} y1={fromY} x2={toX} y2={toY} stroke={color} strokeWidth={0.6} markerStart="url(#arrow-leader)" />
      {/* Shelf line */}
      <line x1={toX} y1={toY} x2={shelfX} y2={toY} stroke={color} strokeWidth={0.6} />
      {/* Text */}
      <text
        x={shelfX + (textSide === 'right' ? 3 : -3)} y={toY + 3}
        textAnchor={textSide === 'right' ? 'start' : 'end'}
        fontSize={fontSize} fill={COLORS.label}
        fontFamily={FONT.family}
      >
        {text}
      </text>
    </g>
  );
});
LeaderLine.displayName = 'LeaderLine';

// ================================================================
// SECTION CUT MARKER — "A" ——— "A" indicator
// ================================================================

export interface SectionCutMarkerProps {
  x1: number; y1: number;
  x2: number; y2: number;
  label?: string;           // e.g. "A"
  color?: string;
}

/** Section cut indicator line (chain-dot with circles at ends) */
export const SectionCutMarker: FC<SectionCutMarkerProps> = memo(({
  x1, y1, x2, y2, label = 'A',
  color = COLORS.sectionCut,
}) => {
  const r = 7;
  return (
    <g className="section-cut">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.8} strokeDasharray="8,3,2,3" />
      {/* Start circle + label */}
      <circle cx={x1} cy={y1} r={r} fill="none" stroke={color} strokeWidth={1} />
      <text x={x1} y={y1 + 3.5} textAnchor="middle" fontSize={FONT.dim} fill={color} fontFamily={FONT.family} fontWeight={700}>{label}</text>
      {/* End circle + label */}
      <circle cx={x2} cy={y2} r={r} fill="none" stroke={color} strokeWidth={1} />
      <text x={x2} y={y2 + 3.5} textAnchor="middle" fontSize={FONT.dim} fill={color} fontFamily={FONT.family} fontWeight={700}>{label}</text>
    </g>
  );
});
SectionCutMarker.displayName = 'SectionCutMarker';

// ================================================================
// CENTRELINE MARKER (chain-dot)
// ================================================================

export interface CentrelineProps {
  x1: number; y1: number;
  x2: number; y2: number;
  color?: string;
}

export const Centreline: FC<CentrelineProps> = memo(({
  x1, y1, x2, y2, color = COLORS.centerline,
}) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.5} strokeDasharray="12,3,3,3" />
));
Centreline.displayName = 'Centreline';

// ================================================================
// NEUTRAL AXIS
// ================================================================

export const NeutralAxis: FC<{ x1: number; y: number; x2: number }> = memo(({ x1, y, x2 }) => (
  <g className="neutral-axis">
    <line x1={x1} y1={y} x2={x2} y2={y} stroke={COLORS.NA} strokeWidth={0.8} strokeDasharray="6,4" />
    <text x={x2 + 4} y={y + 3} fontSize={FONT.small} fill={COLORS.NA} fontFamily={FONT.family}>N.A.</text>
  </g>
));
NeutralAxis.displayName = 'NeutralAxis';

// ================================================================
// GROUND / SOIL HATCH (below footings)
// ================================================================

export const GroundHatch: FC<{ x: number; y: number; width: number; height: number; hatchId?: string }> = memo(({
  x, y, width, height, hatchId = 'soil-hatch',
}) => (
  <g className="ground-hatch">
    <rect x={x} y={y} width={width} height={height} fill={`url(#${hatchId})`} />
    <line x1={x} y1={y} x2={x + width} y2={y} stroke={COLORS.soil} strokeWidth={1.5} />
  </g>
));
GroundHatch.displayName = 'GroundHatch';

// ================================================================
// SUPPORT SYMBOL
// ================================================================

export const SupportTriangle: FC<{ cx: number; cy: number; size?: number; isRoller?: boolean }> = memo(({
  cx, cy, size = 12, isRoller = false,
}) => (
  <g className="support-symbol">
    <polygon
      points={`${cx},${cy} ${cx - size / 2},${cy + size} ${cx + size / 2},${cy + size}`}
      fill="none" stroke={COLORS.dimension} strokeWidth={1}
    />
    {isRoller && (
      <>
        <circle cx={cx - size / 4} cy={cy + size + 3} r={2} fill="none" stroke={COLORS.dimension} strokeWidth={0.8} />
        <circle cx={cx + size / 4} cy={cy + size + 3} r={2} fill="none" stroke={COLORS.dimension} strokeWidth={0.8} />
      </>
    )}
    {!isRoller && (
      <line x1={cx - size / 2 - 4} y1={cy + size + 2} x2={cx + size / 2 + 4} y2={cy + size + 2} stroke={COLORS.dimension} strokeWidth={1} />
    )}
  </g>
));
SupportTriangle.displayName = 'SupportTriangle';

// ================================================================
// TITLE BLOCK (small, for embedded drawing titles)
// ================================================================

export const DrawingTitle: FC<{ x: number; y: number; title: string; subtitle?: string }> = memo(({
  x, y, title, subtitle,
}) => (
  <g className="drawing-title">
    <text x={x} y={y} textAnchor="middle" fontSize={FONT.title} fill={COLORS.label} fontFamily={FONT.family} fontWeight={700}>
      {title}
    </text>
    {subtitle && (
      <text x={x} y={y + FONT.label + 4} textAnchor="middle" fontSize={FONT.small} fill={COLORS.sublabel} fontFamily={FONT.family}>
        {subtitle}
      </text>
    )}
  </g>
));
DrawingTitle.displayName = 'DrawingTitle';

// ================================================================
// BAR BEND SHAPE (IS 2502 standard shapes)
// ================================================================

export interface BarBendShapeProps {
  x: number; y: number;
  shapeCode: 'straight' | 'bent-up' | 'crank' | 'stirrup-2L' | 'stirrup-4L' | 'L-bar' | 'U-bar' | 'hook';
  width?: number;
  height?: number;
  color?: string;
}

/** Renders IS 2502 standard bar bend shapes */
export const BarBendShape: FC<BarBendShapeProps> = memo(({
  x, y, shapeCode, width = 60, height = 30, color = COLORS.mainBar,
}) => {
  const sw = 1.5;
  switch (shapeCode) {
    case 'straight':
      return <line x1={x} y1={y + height / 2} x2={x + width} y2={y + height / 2} stroke={color} strokeWidth={sw} strokeLinecap="round" />;
    case 'L-bar':
      return (
        <polyline
          points={`${x},${y} ${x},${y + height} ${x + width},${y + height}`}
          fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"
        />
      );
    case 'U-bar':
      return (
        <path
          d={`M ${x} ${y} L ${x} ${y + height - 5} Q ${x} ${y + height} ${x + 5} ${y + height} L ${x + width - 5} ${y + height} Q ${x + width} ${y + height} ${x + width} ${y + height - 5} L ${x + width} ${y}`}
          fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        />
      );
    case 'hook':
      return (
        <path
          d={`M ${x + width} ${y + height / 2} L ${x + 8} ${y + height / 2} Q ${x} ${y + height / 2} ${x} ${y + height / 2 - 8} L ${x} ${y}`}
          fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        />
      );
    case 'bent-up':
      return (
        <polyline
          points={`${x},${y + height} ${x + width * 0.3},${y + height} ${x + width * 0.7},${y} ${x + width},${y}`}
          fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"
        />
      );
    case 'crank':
      return (
        <polyline
          points={`${x},${y + height} ${x + width * 0.35},${y + height} ${x + width * 0.5},${y} ${x + width},${y}`}
          fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"
        />
      );
    case 'stirrup-2L': {
      const m = 4;
      return (
        <g>
          <rect x={x + m} y={y + m} width={width - 2 * m} height={height - 2 * m} rx={3} fill="none" stroke={color} strokeWidth={sw} />
          {/* 135° hooks */}
          <line x1={x + m + 6} y1={y + m} x2={x + m} y2={y + m + 8} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <line x1={x + width - m - 6} y1={y + m} x2={x + width - m} y2={y + m + 8} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
    }
    case 'stirrup-4L': {
      const m = 4;
      const mw = width / 2 - m;
      return (
        <g>
          <rect x={x + m} y={y + m} width={width - 2 * m} height={height - 2 * m} rx={3} fill="none" stroke={color} strokeWidth={sw} />
          <line x1={x + width / 2} y1={y + m} x2={x + width / 2} y2={y + height - m} stroke={color} strokeWidth={sw} />
          {/* hooks */}
          <line x1={x + m + 4} y1={y + m} x2={x + m} y2={y + m + 6} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <line x1={x + width - m - 4} y1={y + m} x2={x + width - m} y2={y + m + 6} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </g>
      );
    }
    default:
      return null;
  }
});
BarBendShape.displayName = 'BarBendShape';

export default {
  ConcreteHatchDef,
  CrossHatchDef,
  SoilHatchDef,
  DimensionLine,
  RebarCircle,
  RebarLayer,
  StirrupDetail,
  CoverAnnotation,
  LeaderLine,
  SectionCutMarker,
  Centreline,
  NeutralAxis,
  GroundHatch,
  SupportTriangle,
  DrawingTitle,
  BarBendShape,
  COLORS,
  FONT,
};
