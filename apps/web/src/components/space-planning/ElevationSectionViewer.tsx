/**
 * ElevationSectionViewer.tsx - Architectural Elevation & Section Drawings
 *
 * Professional CAD-style rendering of:
 * - Front/Rear/Left/Right elevations
 * - Cross sections (A-A, B-B)
 * - Foundation details
 * - Dimension annotations
 * - Material hatching
 * - Floor level markers
 */

import { FC, useState, useMemo } from 'react';
import type { ElevationView, ViewType } from '../../services/space-planning/types';

// ============================================
// TYPES
// ============================================

interface ElevationSectionViewerProps {
  views: ElevationView[];
  activeView?: ViewType;
  onViewChange?: (view: ViewType) => void;
  className?: string;
}

const VIEW_LABELS: Record<ViewType, string> = {
  plan: 'Floor Plan',
  front_elevation: 'Front Elevation',
  rear_elevation: 'Rear Elevation',
  left_elevation: 'Left Elevation',
  right_elevation: 'Right Elevation',
  section_AA: 'Section A-A',
  section_BB: 'Section B-B',
  cross_section: 'Cross Section',
};

const SCALE_PX = 35; // pixels per meter

// ============================================
// COMPONENT
// ============================================

export const ElevationSectionViewer: FC<ElevationSectionViewerProps> = ({
  views,
  activeView,
  onViewChange,
  className = '',
}) => {
  const [selectedView, setSelectedView] = useState<ViewType>(
    activeView || views[0]?.type || 'front_elevation',
  );

  const currentView = useMemo(
    () => views.find((v) => v.type === selectedView) || views[0],
    [views, selectedView],
  );

  const handleViewChange = (vt: ViewType) => {
    setSelectedView(vt);
    onViewChange?.(vt);
  };

  if (!currentView) {
    return (
      <div
        className={`flex items-center justify-center h-64 bg-slate-50 dark:bg-slate-800 rounded-lg ${className}`}
      >
        <p className="text-slate-400">No elevation views generated</p>
      </div>
    );
  }

  // Calculate bounds for viewBox (guard against empty elements)
  const allPoints = currentView.elements.flatMap((e) => e.points);
  const minX = allPoints.length > 0 ? Math.min(...allPoints.map((p) => p.x)) - 2 : -2;
  const maxX = allPoints.length > 0 ? Math.max(...allPoints.map((p) => p.x)) + 3 : 13;
  const minY = allPoints.length > 0 ? Math.min(...allPoints.map((p) => p.y)) - 1 : -2;
  const maxY = allPoints.length > 0 ? Math.max(...allPoints.map((p) => p.y)) + 2 : 10;

  const svgWidth = (maxX - minX) * SCALE_PX;
  const svgHeight = (maxY - minY) * SCALE_PX;

  return (
    <div
      className={`flex flex-col bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 ${className}`}
    >
      {/* View tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-slate-200 dark:border-slate-700">
        {views.map((v) => (
          <button
            key={v.type}
            onClick={() => handleViewChange(v.type)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              selectedView === v.type
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {VIEW_LABELS[v.type]}
          </button>
        ))}
      </div>

      {/* Drawing title block */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {VIEW_LABELS[selectedView]}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">Scale 1:{currentView.scale}</span>
      </div>

      {/* SVG Drawing */}
      <div className="overflow-auto p-4" style={{ maxHeight: 600 }}>
        <svg
          width={Math.max(svgWidth, 400)}
          height={Math.max(svgHeight, 300)}
          viewBox={`${minX * SCALE_PX - 20} ${-(maxY * SCALE_PX + 20)} ${svgWidth + 40} ${svgHeight + 40}`}
          className="mx-auto"
        >
          <defs>
            <pattern id="elev-hatch-concrete" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.4" fill="#6B7280" opacity="0.4" />
              <circle cx="4" cy="4" r="0.3" fill="#9CA3AF" opacity="0.3" />
            </pattern>
            <pattern id="elev-hatch-brick" width="8" height="4" patternUnits="userSpaceOnUse">
              <rect width="8" height="4" fill="#FDE68A" opacity="0.3" />
              <line x1="0" y1="2" x2="8" y2="2" stroke="#B45309" strokeWidth="0.3" opacity="0.4" />
              <line x1="4" y1="0" x2="4" y2="2" stroke="#B45309" strokeWidth="0.2" opacity="0.3" />
            </pattern>
            <pattern id="elev-hatch-ground" width="10" height="5" patternUnits="userSpaceOnUse">
              <line x1="0" y1="5" x2="5" y2="0" stroke="#374151" strokeWidth="0.5" opacity="0.3" />
              <line x1="5" y1="5" x2="10" y2="0" stroke="#374151" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>

          {/* Ground line */}
          <line
            x1={(minX - 1) * SCALE_PX}
            y1={0}
            x2={(maxX + 1) * SCALE_PX}
            y2={0}
            stroke="#374151"
            strokeWidth={2}
          />
          {/* Ground hatch below */}
          <rect
            x={(minX - 1) * SCALE_PX}
            y={0}
            width={(maxX - minX + 2) * SCALE_PX}
            height={10}
            fill="url(#elev-hatch-ground)"
          />

          {/* Elements */}
          {currentView.elements.map((el, i) => {
            const pts = el.points.map((p) => `${p.x * SCALE_PX},${-p.y * SCALE_PX}`).join(' ');
            const hatchId =
              el.hatch === 'concrete'
                ? 'url(#elev-hatch-concrete)'
                : el.hatch === 'brick'
                  ? 'url(#elev-hatch-brick)'
                  : el.hatch === 'ground'
                    ? 'url(#elev-hatch-ground)'
                    : undefined;

            return (
              <g key={`el-${i}`}>
                <polygon
                  points={pts}
                  fill={el.fill || 'none'}
                  stroke={el.stroke}
                  strokeWidth={el.lineWeight}
                />
                {hatchId && <polygon points={pts} fill={hatchId} stroke="none" />}
              </g>
            );
          })}

          {/* Dimensions */}
          {currentView.dimensions.map((dim, i) => (
            <g key={`dim-${i}`}>
              <line
                x1={dim.startX * SCALE_PX}
                y1={-dim.startY * SCALE_PX}
                x2={dim.endX * SCALE_PX}
                y2={-dim.endY * SCALE_PX}
                stroke="#2563EB"
                strokeWidth={0.6}
              />
              {/* Ticks */}
              <line
                x1={dim.startX * SCALE_PX - 3}
                y1={-dim.startY * SCALE_PX - 3}
                x2={dim.startX * SCALE_PX + 3}
                y2={-dim.startY * SCALE_PX + 3}
                stroke="#2563EB"
                strokeWidth={0.8}
              />
              <line
                x1={dim.endX * SCALE_PX - 3}
                y1={-dim.endY * SCALE_PX - 3}
                x2={dim.endX * SCALE_PX + 3}
                y2={-dim.endY * SCALE_PX + 3}
                stroke="#2563EB"
                strokeWidth={0.8}
              />
              <text
                x={((dim.startX + dim.endX) / 2) * SCALE_PX + dim.offset * 10}
                y={(-(dim.startY + dim.endY) / 2) * SCALE_PX - 4}
                textAnchor="middle"
                fill="#2563EB"
                fontSize={7}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {dim.value}
              </text>
            </g>
          ))}

          {/* Labels */}
          {currentView.labels.map((lbl, i) => (
            <text
              key={`lbl-${i}`}
              x={lbl.x * SCALE_PX}
              y={-lbl.y * SCALE_PX}
              textAnchor={lbl.anchor}
              fill="#374151"
              fontSize={lbl.fontSize * 0.8}
              fontFamily="monospace"
              transform={
                lbl.rotation
                  ? `rotate(${-lbl.rotation}, ${lbl.x * SCALE_PX}, ${-lbl.y * SCALE_PX})`
                  : undefined
              }
            >
              {lbl.text}
            </text>
          ))}

          {/* GL label */}
          <text
            x={(minX - 0.5) * SCALE_PX}
            y={12}
            fill="#6B7280"
            fontSize={8}
            fontFamily="monospace"
            fontWeight="bold"
          >
            ± 0.000 GL
          </text>
        </svg>
      </div>

      {/* Drawing info footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <span className="text-[10px] text-slate-400">
          Elements: {currentView.elements.length} | Dimensions: {currentView.dimensions.length}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          BeamLab — {new Date().toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};

export default ElevationSectionViewer;
