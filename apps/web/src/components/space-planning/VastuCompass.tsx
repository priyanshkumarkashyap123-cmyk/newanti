/**
 * VastuCompass.tsx - Interactive Vastu Purusha Mandala Visualization
 *
 * - 8-zone directional compass
 * - Room compliance heat map
 * - Violation markers
 * - Element/planet/deity info per zone
 * - Color recommendations per direction
 */

import { FC, useState } from 'react';
import type {
  VastuAnalysis,
  VastuZone,
  CardinalDirection,
} from '../../services/space-planning/types';

interface VastuCompassProps {
  analysis: VastuAnalysis;
  className?: string;
}

const DIRECTION_ANGLES: Record<CardinalDirection, number> = {
  N: 270,
  NE: 315,
  E: 0,
  SE: 45,
  S: 90,
  SW: 135,
  W: 180,
  NW: 225,
};

const DIRECTION_OFFSET: Record<CardinalDirection, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  NE: { x: 0.7, y: -0.7 },
  E: { x: 1, y: 0 },
  SE: { x: 0.7, y: 0.7 },
  S: { x: 0, y: 1 },
  SW: { x: -0.7, y: 0.7 },
  W: { x: -1, y: 0 },
  NW: { x: -0.7, y: -0.7 },
};

const ELEMENT_EMOJI: Record<string, string> = {
  water: '💧',
  fire: '🔥',
  earth: '🏔️',
  air: '💨',
  space: '✨',
};

export const VastuCompass: FC<VastuCompassProps> = ({ analysis, className = '' }) => {
  const [selectedZone, setSelectedZone] = useState<VastuZone | null>(null);

  const cx = 160;
  const cy = 160;
  const outerR = 130;
  const innerR = 50;

  const scoreColor =
    analysis.overallScore >= 80
      ? '#22C55E'
      : analysis.overallScore >= 60
        ? '#EAB308'
        : analysis.overallScore >= 40
          ? '#F97316'
          : '#EF4444';

  return (
    <div className={`flex flex-col lg:flex-row gap-4 ${className}`}>
      {/* Mandala */}
      <div className="flex-shrink-0">
        <svg width={320} height={320} viewBox="0 0 320 320">
          {/* Background circle */}
          <circle cx={cx} cy={cy} r={outerR + 8} fill="none" stroke="#E5E7EB" strokeWidth={1} />

          {/* Zones */}
          {analysis.zones.map((zone, i) => {
            const startAngle = DIRECTION_ANGLES[zone.direction] - 22.5;
            const endAngle = startAngle + 45;
            const start = polarToCartesian(cx, cy, outerR, startAngle);
            const end = polarToCartesian(cx, cy, outerR, endAngle);
            const startInner = polarToCartesian(cx, cy, innerR, startAngle);
            const endInner = polarToCartesian(cx, cy, innerR, endAngle);

            // Check for violations in this zone
            const zoneViolations = analysis.violations.filter(
              (v) => v.direction === zone.direction,
            );
            const hasViolation = zoneViolations.length > 0;
            const isCritical = zoneViolations.some((v) => v.severity === 'critical');

            const fillColor = isCritical ? '#FEE2E2' : hasViolation ? '#FEF3C7' : '#ECFDF5';
            const strokeColor = isCritical ? '#EF4444' : hasViolation ? '#EAB308' : '#22C55E';

            const offset = DIRECTION_OFFSET[zone.direction];
            const labelX = cx + (offset.x * (outerR + innerR)) / 2;
            const labelY = cy + (offset.y * (outerR + innerR)) / 2;

            return (
              <g
                key={zone.direction}
                onClick={() => setSelectedZone(zone === selectedZone ? null : zone)}
                className="cursor-pointer"
              >
                <path
                  d={`M ${startInner.x} ${startInner.y} L ${start.x} ${start.y} A ${outerR} ${outerR} 0 0 1 ${end.x} ${end.y} L ${endInner.x} ${endInner.y} A ${innerR} ${innerR} 0 0 0 ${startInner.x} ${startInner.y}`}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={zone === selectedZone ? 2.5 : 1}
                  opacity={zone === selectedZone ? 1 : 0.8}
                />
                {/* Direction label */}
                <text
                  x={labelX}
                  y={labelY - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="bold"
                  fill="#374151"
                >
                  {zone.direction}
                </text>
                {/* Element */}
                <text x={labelX} y={labelY + 5} textAnchor="middle" fontSize={12}>
                  {ELEMENT_EMOJI[zone.element]}
                </text>
                {/* Violation indicator */}
                {hasViolation && (
                  <circle
                    cx={labelX + 14}
                    cy={labelY - 14}
                    r={5}
                    fill={isCritical ? '#EF4444' : '#EAB308'}
                  >
                    <title>{zoneViolations.length} violation(s)</title>
                  </circle>
                )}
              </g>
            );
          })}

          {/* Center - Brahmasthan */}
          <circle cx={cx} cy={cy} r={innerR} fill="#FFFBEB" stroke="#D97706" strokeWidth={1.5} />
          <text x={cx} y={cy - 8} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#92400E">
            BRAHMA
          </text>
          <text x={cx} y={cy + 2} textAnchor="middle" fontSize={7} fill="#92400E">
            STHAN
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize={18}>
            {analysis.overallScore}%
          </text>
          <text
            x={cx}
            y={cy + 26}
            textAnchor="middle"
            fontSize={7}
            fill={scoreColor}
            fontWeight="bold"
          >
            {analysis.overallScore >= 80
              ? 'EXCELLENT'
              : analysis.overallScore >= 60
                ? 'GOOD'
                : analysis.overallScore >= 40
                  ? 'FAIR'
                  : 'POOR'}
          </text>

          {/* Cardinal direction labels on outer ring */}
          {(['N', 'S', 'E', 'W'] as const).map((dir) => {
            const offset = DIRECTION_OFFSET[dir];
            return (
              <text
                key={`outer-${dir}`}
                x={cx + offset.x * (outerR + 16)}
                y={cy + offset.y * (outerR + 16) + 3}
                textAnchor="middle"
                fontSize={11}
                fontWeight="bold"
                fill="#4B5563"
              >
                {dir}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Details panel */}
      <div className="flex-1 min-w-0">
        {selectedZone ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {selectedZone.direction} - {selectedZone.element.toUpperCase()} Zone
              </h3>
              <button
                onClick={() => setSelectedZone(null)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                <div className="text-slate-400 mb-0.5">Planet</div>
                <div className="font-medium text-slate-700 dark:text-slate-300">
                  {selectedZone.planet}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                <div className="text-slate-400 mb-0.5">Deity</div>
                <div className="font-medium text-slate-700 dark:text-slate-300">
                  {selectedZone.deity}
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Recommended rooms</div>
              <div className="flex flex-wrap gap-1">
                {selectedZone.recommendedRooms.map((r) => (
                  <span
                    key={r}
                    className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] rounded"
                  >
                    {r.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Avoid placing</div>
              <div className="flex flex-wrap gap-1">
                {selectedZone.avoidRooms.map((r) => (
                  <span
                    key={r}
                    className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] rounded"
                  >
                    {r.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Recommended colors</div>
              <div className="flex gap-1">
                {selectedZone.colors.map((c, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded border border-slate-300"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Materials</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {selectedZone.materials.join(', ')}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Vastu Compliance Summary
            </h3>
            {/* Compliance checks */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'Entrance', ok: analysis.entranceAuspicious },
                { label: 'Kitchen (SE)', ok: analysis.kitchenCompliant },
                { label: 'Master Bed (SW)', ok: analysis.masterBedCompliant },
                { label: 'Pooja (NE)', ok: analysis.poojaCompliant },
                { label: 'Staircase', ok: analysis.staircaseCompliant },
                { label: 'Toilet', ok: analysis.toiletCompliant },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs ${item.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}
                >
                  <span>{item.ok ? '✓' : '✗'}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Violations */}
            {analysis.violations.length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-1">
                  Violations ({analysis.violations.length})
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {analysis.violations.map((v) => (
                    <div
                      key={v.id}
                      className={`text-[10px] px-2 py-1 rounded ${v.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : v.severity === 'major' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700' : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700'}`}
                    >
                      <span className="font-semibold uppercase">{v.severity}:</span> {v.issue}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div>
              <div className="text-xs text-slate-400 mb-1">Recommendations</div>
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {analysis.recommendations.slice(0, 6).map((r, i) => (
                  <div
                    key={i}
                    className="text-[10px] text-slate-600 dark:text-slate-400 flex gap-1"
                  >
                    <span className="text-blue-500">●</span> {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default VastuCompass;
