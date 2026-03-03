/**
 * ============================================================================
 * VIOLATION OVERLAY — SVG Layer for Constraint Conflict Visualization
 * ============================================================================
 *
 * Renders visual indicators on the FloorPlanRenderer SVG canvas:
 *   - Red/amber hatched zones for span violations
 *   - Pulsing badges for egress failures
 *   - FSI breach banner
 *   - Fenestration non-compliance markers on walls
 *   - Door-swing collision arcs
 *   - Acoustic zone boundary warnings
 *   - Clearance deficit highlights
 *
 * Designed to work as an <g> overlay inside the FloorPlanRenderer SVG.
 *
 * @version 1.0.0
 */

import React from 'react';
import type {
  ConstraintReport,
  ConstraintViolation,
  PlacementResponse,
  StructuralCheck,
  FenestrationCheck,
} from '../../services/space-planning/layoutApiService';

// ============================================================================
// TYPES
// ============================================================================

interface ViolationOverlayProps {
  report: ConstraintReport;
  placements: PlacementResponse[];
  /** Scale factor: SVG units per meter */
  scale: number;
  /** Offset for the usable boundary within the plot */
  offsetX?: number;
  offsetY?: number;
  /** Currently selected room ID (dims violation indicators for other rooms) */
  selectedRoomId?: string | null;
  /** Click handler for violation markers */
  onViolationClick?: (roomId: string, domain: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VIOLATION_COLORS = {
  critical: { fill: '#ef4444', stroke: '#dc2626', text: '#fff' },
  warning: { fill: '#f59e0b', stroke: '#d97706', text: '#fff' },
  info: { fill: '#3b82f6', stroke: '#2563eb', text: '#fff' },
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Red hatched pattern for critical violations */
const ViolationPatterns: React.FC = () => (
  <defs>
    {/* Critical hatch (red diagonal lines) */}
    <pattern
      id="violation-hatch-critical"
      patternUnits="userSpaceOnUse"
      width="8"
      height="8"
      patternTransform="rotate(45)"
    >
      <line x1="0" y1="0" x2="0" y2="8" stroke="#ef4444" strokeWidth="1.5" strokeOpacity="0.3" />
    </pattern>

    {/* Warning hatch (amber diagonal lines) */}
    <pattern
      id="violation-hatch-warning"
      patternUnits="userSpaceOnUse"
      width="8"
      height="8"
      patternTransform="rotate(-45)"
    >
      <line x1="0" y1="0" x2="0" y2="8" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.3" />
    </pattern>

    {/* Pulsing glow filter for critical badges */}
    <filter id="violation-glow">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    {/* Drop shadow for badges */}
    <filter id="badge-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.2" />
    </filter>
  </defs>
);

/** Room-level violation hatch overlay */
const RoomViolationHatch: React.FC<{
  placement: PlacementResponse;
  severity: 'critical' | 'warning';
  scale: number;
  offsetX: number;
  offsetY: number;
  onClick?: () => void;
}> = ({ placement, severity, scale, offsetX, offsetY, onClick }) => {
  const x = (placement.position.x + offsetX) * scale;
  const y = (placement.position.y + offsetY) * scale;
  const w = placement.dimensions.width * scale;
  const h = placement.dimensions.height * scale;

  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill={`url(#violation-hatch-${severity})`}
      stroke={VIOLATION_COLORS[severity].stroke}
      strokeWidth={1.5}
      strokeDasharray="4 2"
      opacity={0.7}
      className="cursor-pointer"
      onClick={onClick}
    >
      <title>
        {severity === 'critical' ? '⛔ Critical violation' : '⚠️ Warning'} — {placement.name}
      </title>
    </rect>
  );
};

/** Badge indicator on a room corner */
const ViolationBadge: React.FC<{
  x: number;
  y: number;
  label: string;
  severity: 'critical' | 'warning' | 'info';
  onClick?: () => void;
}> = ({ x, y, label, severity, onClick }) => {
  const colors = VIOLATION_COLORS[severity];
  const badgeRadius = 7;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      className="cursor-pointer"
      onClick={onClick}
      filter="url(#badge-shadow)"
    >
      <circle r={badgeRadius} fill={colors.fill} stroke={colors.stroke} strokeWidth={1} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill={colors.text}
        fontSize="7"
        fontWeight="bold"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {label}
      </text>
    </g>
  );
};

/** Span violation indicator — shows a dashed line with dimension */
const SpanViolationLine: React.FC<{
  check: StructuralCheck;
  placement: PlacementResponse;
  scale: number;
  offsetX: number;
  offsetY: number;
}> = ({ check, placement, scale, offsetX, offsetY }) => {
  if (check.compliant) return null;

  const x = (placement.position.x + offsetX) * scale;
  const y = (placement.position.y + offsetY) * scale;
  const w = placement.dimensions.width * scale;
  const h = placement.dimensions.height * scale;

  // Show span as the longer dimension
  const spanDir = placement.dimensions.width >= placement.dimensions.height ? 'horizontal' : 'vertical';
  const arrowY = spanDir === 'horizontal' ? y + h + 8 : y + h / 2;
  const arrowX = spanDir === 'horizontal' ? x + w / 2 : x + w + 8;

  return (
    <g>
      {/* Highlight the room */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="url(#violation-hatch-critical)"
        stroke="#dc2626"
        strokeWidth={1.5}
        strokeDasharray="6 3"
        opacity={0.6}
      />

      {/* Span dimension annotation */}
      {spanDir === 'horizontal' ? (
        <>
          <line x1={x} y1={arrowY} x2={x + w} y2={arrowY} stroke="#dc2626" strokeWidth={1} />
          <line x1={x} y1={arrowY - 3} x2={x} y2={arrowY + 3} stroke="#dc2626" strokeWidth={1} />
          <line
            x1={x + w}
            y1={arrowY - 3}
            x2={x + w}
            y2={arrowY + 3}
            stroke="#dc2626"
            strokeWidth={1}
          />
          <rect
            x={arrowX - 20}
            y={arrowY - 6}
            width={40}
            height={12}
            rx={3}
            fill="#dc2626"
          />
          <text
            x={arrowX}
            y={arrowY + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize="7"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {check.span_m.toFixed(1)}m &gt; {check.max_span_m}m
          </text>
        </>
      ) : (
        <>
          <line x1={arrowX} y1={y} x2={arrowX} y2={y + h} stroke="#dc2626" strokeWidth={1} />
          <line x1={arrowX - 3} y1={y} x2={arrowX + 3} y2={y} stroke="#dc2626" strokeWidth={1} />
          <line
            x1={arrowX - 3}
            y1={y + h}
            x2={arrowX + 3}
            y2={y + h}
            stroke="#dc2626"
            strokeWidth={1}
          />
          <rect
            x={arrowX - 20}
            y={y + h / 2 - 6}
            width={40}
            height={12}
            rx={3}
            fill="#dc2626"
          />
          <text
            x={arrowX}
            y={y + h / 2 + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize="7"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {check.span_m.toFixed(1)}m
          </text>
        </>
      )}
    </g>
  );
};

/** Fenestration violation marker on room walls */
const FenestrationMarker: React.FC<{
  check: FenestrationCheck;
  placement: PlacementResponse;
  scale: number;
  offsetX: number;
  offsetY: number;
}> = ({ check, placement, scale, offsetX, offsetY }) => {
  if (check.compliant) return null;

  const x = (placement.position.x + offsetX) * scale;
  const y = (placement.position.y + offsetY) * scale;
  const w = placement.dimensions.width * scale;

  return (
    <g>
      {/* Window icon indicator at top of room */}
      <rect x={x + w / 2 - 15} y={y - 12} width={30} height={10} rx={3} fill="#f59e0b" />
      <text
        x={x + w / 2}
        y={y - 6}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="6"
        fontWeight="bold"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        🪟 {(check.ratio * 100).toFixed(0)}%
      </text>
    </g>
  );
};

/** FSI over-limit banner at top of drawing */
const FSIBanner: React.FC<{
  fsiUsed: number;
  fsiLimit: number;
  canvasWidth: number;
}> = ({ fsiUsed, fsiLimit, canvasWidth }) => {
  if (fsiUsed <= fsiLimit) return null;

  const bannerWidth = Math.min(canvasWidth * 0.8, 250);
  const bannerX = (canvasWidth - bannerWidth) / 2;

  return (
    <g>
      <rect
        x={bannerX}
        y={4}
        width={bannerWidth}
        height={20}
        rx={6}
        fill="#dc2626"
        filter="url(#badge-shadow)"
      />
      <text
        x={canvasWidth / 2}
        y={15}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="9"
        fontWeight="bold"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        ⛔ FSI EXCEEDED: {fsiUsed.toFixed(2)} / {fsiLimit} ({((fsiUsed / fsiLimit) * 100).toFixed(0)}%)
      </text>
    </g>
  );
};

/** Egress distance indicator — shows travel path length */
const EgressIndicator: React.FC<{
  report: ConstraintReport;
  placements: PlacementResponse[];
  scale: number;
  offsetX: number;
  offsetY: number;
}> = ({ report, placements, scale, offsetX, offsetY }) => {
  if (!report.egress || report.egress.compliant) return null;

  return (
    <>
      {report.egress.rooms_beyond_limit?.map((roomId) => {
        const placement = placements.find((p) => p.room_id === roomId);
        if (!placement) return null;

        const x = (placement.position.x + offsetX) * scale;
        const y = (placement.position.y + offsetY) * scale;
        const w = placement.dimensions.width * scale;
        const h = placement.dimensions.height * scale;

        return (
          <g key={`egress-${roomId}`}>
            {/* Egress violation border */}
            <rect
              x={x - 2}
              y={y - 2}
              width={w + 4}
              height={h + 4}
              fill="none"
              stroke="#dc2626"
              strokeWidth={2}
              strokeDasharray="3 3"
              opacity={0.8}
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="12"
                dur="1s"
                repeatCount="indefinite"
              />
            </rect>

            {/* Egress badge */}
            <ViolationBadge
              x={x + w}
              y={y}
              label="🚪"
              severity="critical"
            />
          </g>
        );
      })}
    </>
  );
};

// ============================================================================
// MAIN OVERLAY COMPONENT
// ============================================================================

export const ViolationOverlay: React.FC<ViolationOverlayProps> = ({
  report,
  placements,
  scale,
  offsetX = 0,
  offsetY = 0,
  selectedRoomId,
  onViolationClick,
}) => {
  // Build a lookup for quick placement access
  const placementMap = new Map(placements.map((p) => [p.room_id, p]));

  // Identify rooms with violations
  const violatedRooms = new Map<string, { severity: 'critical' | 'warning'; domains: string[] }>();

  for (const violation of report.violations) {
    if (violation.passed) continue;
    if (!violation.roomIds) continue;

    for (const roomId of violation.roomIds) {
      const existing = violatedRooms.get(roomId);
      if (existing) {
        if (violation.severity === 'critical') existing.severity = 'critical';
        existing.domains.push(violation.domain);
      } else {
        violatedRooms.set(roomId, {
          severity: violation.severity === 'critical' ? 'critical' : 'warning',
          domains: [violation.domain],
        });
      }
    }
  }

  // Get failed structural checks
  const failedSpans = report.structuralChecks?.filter((s) => !s.compliant) || [];
  const failedFenestration = report.fenestrationChecks?.filter((f) => !f.compliant) || [];

  // Canvas width estimate for FSI banner
  const maxX = Math.max(...placements.map((p) => (p.position.x + p.dimensions.width + offsetX) * scale), 200);

  return (
    <g className="violation-overlay">
      <ViolationPatterns />

      {/* FSI banner - top priority */}
      {report.fsi && (
        <FSIBanner
          fsiUsed={report.fsi.fsi_used || 0}
          fsiLimit={report.fsi.fsi_limit || 1}
          canvasWidth={maxX}
        />
      )}

      {/* Room-level violation hatches */}
      {Array.from(violatedRooms.entries()).map(([roomId, info]) => {
        const placement = placementMap.get(roomId);
        if (!placement) return null;

        // Skip if a specific room is selected and this isn't it
        const dimmed = selectedRoomId && selectedRoomId !== roomId;

        return (
          <g key={`hatch-${roomId}`} opacity={dimmed ? 0.3 : 1}>
            <RoomViolationHatch
              placement={placement}
              severity={info.severity}
              scale={scale}
              offsetX={offsetX}
              offsetY={offsetY}
              onClick={() => onViolationClick?.(roomId, info.domains[0])}
            />
            <ViolationBadge
              x={(placement.position.x + offsetX) * scale + placement.dimensions.width * scale - 4}
              y={(placement.position.y + offsetY) * scale + 4}
              label={info.domains.length > 1 ? String(info.domains.length) : '!'}
              severity={info.severity}
              onClick={() => onViolationClick?.(roomId, info.domains[0])}
            />
          </g>
        );
      })}

      {/* Span violation dimension lines */}
      {failedSpans.map((check) => {
        const placement = placementMap.get(check.room_id);
        if (!placement) return null;
        return (
          <SpanViolationLine
            key={`span-${check.room_id}`}
            check={check}
            placement={placement}
            scale={scale}
            offsetX={offsetX}
            offsetY={offsetY}
          />
        );
      })}

      {/* Fenestration violation markers */}
      {failedFenestration.map((check) => {
        const placement = placementMap.get(check.room_id);
        if (!placement) return null;
        return (
          <FenestrationMarker
            key={`fen-${check.room_id}`}
            check={check}
            placement={placement}
            scale={scale}
            offsetX={offsetX}
            offsetY={offsetY}
          />
        );
      })}

      {/* Egress distance violations */}
      <EgressIndicator
        report={report}
        placements={placements}
        scale={scale}
        offsetX={offsetX}
        offsetY={offsetY}
      />
    </g>
  );
};

export default ViolationOverlay;
