/**
 * FloorPlanRenderer.tsx - SVG-based 2D Floor Plan Drawing
 *
 * Professional architectural plan rendering with:
 * - Room layouts with color coding
 * - Wall thickness rendering (external 230mm, internal 115mm)
 * - Door swing arcs & window representations
 * - Column/beam grid overlay
 * - Dimension lines & labels
 * - Compass rose for orientation
 * - Room labels with area callouts
 * - Furniture placement hints
 * - Grid background (structural grid)
 */

import { FC, useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type {
  FloorPlan,
  PlacedRoom,
  WallSegment,
  StructuralPlan,
  SiteOrientation,
  PlotDimensions,
  SiteConstraints,
  SectionLine,
  ElectricalPlan,
  PlumbingPlan,
  HVACPlan,
} from '../../services/space-planning/types';

// ============================================
// CONSTANTS
// ============================================

const SCALE = 40; // pixels per meter
const GRID_SIZE = 0.25; // 250mm grid
const WALL_STROKE = '#1F2937';
const EXTERNAL_WALL_COLOR = '#374151';
const INTERNAL_WALL_COLOR = '#6B7280';
const COLUMN_COLOR = '#4B5563';
const BEAM_COLOR = '#9CA3AF';
const GRID_COLOR = '#E5E7EB';
const DIMENSION_COLOR = '#2563EB';
const COMPASS_SIZE = 60;

// ============================================
// TYPES
// ============================================

export type OverlayMode =
  | 'none'
  | 'structural'
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'vastu'
  | 'sunlight';

interface FloorPlanRendererProps {
  floorPlan: FloorPlan;
  plot: PlotDimensions;
  constraints: SiteConstraints;
  orientation: SiteOrientation;
  structural?: StructuralPlan;
  electrical?: ElectricalPlan;
  plumbing?: PlumbingPlan;
  hvac?: HVACPlan;
  overlayMode?: OverlayMode;
  sectionLines?: SectionLine[];
  selectedRoomId?: string | null;
  onRoomSelect?: (roomId: string | null) => void;
  showGrid?: boolean;
  showDimensions?: boolean;
  showCompass?: boolean;
  showLabels?: boolean;
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

export const FloorPlanRenderer: FC<FloorPlanRendererProps> = ({
  floorPlan,
  plot,
  constraints,
  orientation,
  structural,
  electrical,
  plumbing,
  hvac,
  overlayMode = 'none',
  sectionLines = [],
  selectedRoomId = null,
  onRoomSelect,
  showGrid = true,
  showDimensions = true,
  showCompass = true,
  showLabels = true,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const svgWidth = (plot.width + 4) * SCALE;
  const svgHeight = (plot.depth + 4) * SCALE;

  // Pan/zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.3, Math.min(5, z * delta)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      }
    },
    [isPanning, panStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Memoized room render
  const renderedRooms = useMemo(() => {
    return floorPlan.rooms.map((room) => (
      <RoomShape
        key={room.id}
        room={room}
        isSelected={selectedRoomId === room.id}
        onClick={() => onRoomSelect?.(room.id === selectedRoomId ? null : room.id)}
        showLabel={showLabels}
      />
    ));
  }, [floorPlan.rooms, selectedRoomId, showLabels, onRoomSelect]);

  return (
    <div
      className={`relative overflow-hidden bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 ${className}`}
    >
      {/* Toolbar */}
      <div className="absolute top-2 left-2 z-10 flex gap-1 bg-white/90 dark:bg-slate-800/90 rounded-lg shadow-sm p-1 backdrop-blur-sm">
        <button
          onClick={() => setZoom((z) => Math.min(5, z * 1.2))}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.3, z * 0.8))}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300"
          title="Zoom Out"
        >
          −
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 40, y: 40 });
          }}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-300"
          title="Reset View"
        >
          ⟲
        </button>
        <span className="text-[10px] text-slate-400 self-center px-1">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Floor label */}
      <div className="absolute top-2 right-2 z-10 bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded shadow">
        {floorPlan.label}
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${-pan.x / zoom} ${-pan.y / zoom} ${svgWidth / zoom} ${svgHeight / zoom}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="cursor-grab active:cursor-grabbing"
        style={{ minHeight: 500 }}
      >
        <defs>
          {/* Hatch patterns */}
          <pattern
            id="hatch-brick"
            width="8"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(0)"
          >
            <rect width="8" height="4" fill="#D97706" opacity="0.15" />
            <line x1="0" y1="2" x2="8" y2="2" stroke="#92400E" strokeWidth="0.3" opacity="0.3" />
            <line x1="4" y1="0" x2="4" y2="2" stroke="#92400E" strokeWidth="0.3" opacity="0.3" />
            <line x1="0" y1="2" x2="0" y2="4" stroke="#92400E" strokeWidth="0.3" opacity="0.2" />
          </pattern>
          <pattern id="hatch-concrete" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.4" fill="#6B7280" opacity="0.3" />
            <circle cx="4" cy="4" r="0.4" fill="#6B7280" opacity="0.3" />
            <circle cx="3" cy="1" r="0.3" fill="#9CA3AF" opacity="0.2" />
          </pattern>
          <pattern id="hatch-tile" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="none" />
            <line x1="0" y1="4" x2="8" y2="4" stroke="#CBD5E1" strokeWidth="0.3" />
            <line x1="4" y1="0" x2="4" y2="8" stroke="#CBD5E1" strokeWidth="0.3" />
          </pattern>
          {/* Arrow marker for dimensions */}
          <marker
            id="dim-arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill={DIMENSION_COLOR} />
          </marker>
          {/* Door arc */}
          <marker
            id="door-tick"
            viewBox="0 0 4 8"
            refX="2"
            refY="4"
            markerWidth="4"
            markerHeight="8"
            orient="auto"
          >
            <line x1="2" y1="0" x2="2" y2="8" stroke="#78350F" strokeWidth="1" />
          </marker>
        </defs>

        {/* Background grid */}
        {showGrid && (
          <g opacity={0.4}>
            {Array.from({ length: Math.ceil(plot.width / GRID_SIZE) + 1 }, (_, i) => (
              <line
                key={`gv-${i}`}
                x1={i * GRID_SIZE * SCALE}
                y1={0}
                x2={i * GRID_SIZE * SCALE}
                y2={plot.depth * SCALE}
                stroke={i % 4 === 0 ? '#CBD5E1' : GRID_COLOR}
                strokeWidth={i % 4 === 0 ? 0.5 : 0.2}
              />
            ))}
            {Array.from({ length: Math.ceil(plot.depth / GRID_SIZE) + 1 }, (_, i) => (
              <line
                key={`gh-${i}`}
                x1={0}
                y1={i * GRID_SIZE * SCALE}
                x2={plot.width * SCALE}
                y2={i * GRID_SIZE * SCALE}
                stroke={i % 4 === 0 ? '#CBD5E1' : GRID_COLOR}
                strokeWidth={i % 4 === 0 ? 0.5 : 0.2}
              />
            ))}
          </g>
        )}

        {/* Plot boundary */}
        <rect
          x={0}
          y={0}
          width={plot.width * SCALE}
          height={plot.depth * SCALE}
          fill="none"
          stroke="#94A3B8"
          strokeWidth={1.5}
          strokeDasharray="8 4"
        />

        {/* Setback lines */}
        <rect
          x={constraints.setbacks.left * SCALE}
          y={constraints.setbacks.front * SCALE}
          width={(plot.width - constraints.setbacks.left - constraints.setbacks.right) * SCALE}
          height={(plot.depth - constraints.setbacks.front - constraints.setbacks.rear) * SCALE}
          fill="none"
          stroke="#3B82F6"
          strokeWidth={0.8}
          strokeDasharray="4 4"
          opacity={0.5}
        />

        {/* Setback labels */}
        {showDimensions && (
          <g className="text-[8px]" fill="#64748B" fontFamily="monospace">
            <text
              x={(constraints.setbacks.left * SCALE) / 2}
              y={(plot.depth * SCALE) / 2}
              textAnchor="middle"
              transform={`rotate(-90, ${(constraints.setbacks.left * SCALE) / 2}, ${(plot.depth * SCALE) / 2})`}
              fontSize={7}
            >
              {constraints.setbacks.left}m
            </text>
            <text
              x={plot.width * SCALE - (constraints.setbacks.right * SCALE) / 2}
              y={(plot.depth * SCALE) / 2}
              textAnchor="middle"
              transform={`rotate(90, ${plot.width * SCALE - (constraints.setbacks.right * SCALE) / 2}, ${(plot.depth * SCALE) / 2})`}
              fontSize={7}
            >
              {constraints.setbacks.right}m
            </text>
            <text
              x={(plot.width * SCALE) / 2}
              y={(constraints.setbacks.front * SCALE) / 2 + 3}
              textAnchor="middle"
              fontSize={7}
            >
              {constraints.setbacks.front}m
            </text>
            <text
              x={(plot.width * SCALE) / 2}
              y={plot.depth * SCALE - (constraints.setbacks.rear * SCALE) / 2 + 3}
              textAnchor="middle"
              fontSize={7}
            >
              {constraints.setbacks.rear}m
            </text>
          </g>
        )}

        {/* Rooms */}
        <g>{renderedRooms}</g>

        {/* Corridors */}
        {floorPlan.corridors.map((c, i) => (
          <rect
            key={`corr-${i}`}
            x={c.x * SCALE}
            y={c.y * SCALE}
            width={c.width * SCALE}
            height={c.height * SCALE}
            fill="#F9FAFB"
            fillOpacity={0.5}
            stroke="#CBD5E1"
            strokeWidth={0.5}
            strokeDasharray="3 3"
          />
        ))}

        {/* Walls */}
        <WallsLayer walls={floorPlan.walls} />

        {/* Structural overlay */}
        {overlayMode === 'structural' && structural && (
          <StructuralOverlay structural={structural} />
        )}

        {/* Electrical overlay */}
        {overlayMode === 'electrical' && electrical && (
          <ElectricalOverlay electrical={electrical} />
        )}

        {/* Plumbing overlay */}
        {overlayMode === 'plumbing' && plumbing && <PlumbingOverlay plumbing={plumbing} />}

        {/* HVAC overlay */}
        {overlayMode === 'hvac' && hvac && <HVACOverlay hvac={hvac} />}

        {/* Section lines */}
        {sectionLines.map((sl) => (
          <g key={sl.id}>
            <line
              x1={sl.startX * SCALE}
              y1={sl.startY * SCALE}
              x2={sl.endX * SCALE}
              y2={sl.endY * SCALE}
              stroke="#DC2626"
              strokeWidth={1.5}
              strokeDasharray="10 4"
            />
            <circle cx={sl.startX * SCALE} cy={sl.startY * SCALE} r={8} fill="#DC2626" />
            <circle cx={sl.endX * SCALE} cy={sl.endY * SCALE} r={8} fill="#DC2626" />
            <text
              x={sl.startX * SCALE}
              y={sl.startY * SCALE + 3}
              textAnchor="middle"
              fill="white"
              fontSize={8}
              fontWeight="bold"
            >
              {sl.label.charAt(0)}
            </text>
            <text
              x={sl.endX * SCALE}
              y={sl.endY * SCALE + 3}
              textAnchor="middle"
              fill="white"
              fontSize={8}
              fontWeight="bold"
            >
              {sl.label.charAt(0)}
            </text>
          </g>
        ))}

        {/* Dimension lines */}
        {showDimensions && (
          <g>
            {/* Plot width */}
            <DimensionLine
              x1={0}
              y1={plot.depth * SCALE + 20}
              x2={plot.width * SCALE}
              y2={plot.depth * SCALE + 20}
              label={`${plot.width.toFixed(1)}m`}
            />
            {/* Plot depth - vertical */}
            <DimensionLine
              x1={-20}
              y1={0}
              x2={-20}
              y2={plot.depth * SCALE}
              label={`${plot.depth.toFixed(1)}m`}
              vertical
            />
          </g>
        )}

        {/* Compass rose */}
        {showCompass && (
          <CompassRose
            x={plot.width * SCALE - COMPASS_SIZE - 10}
            y={10}
            size={COMPASS_SIZE}
            northAngle={orientation.northDirection}
          />
        )}

        {/* North direction label */}
        {showCompass && (
          <text
            x={plot.width * SCALE - COMPASS_SIZE / 2 - 10}
            y={COMPASS_SIZE + 22}
            textAnchor="middle"
            fill="#64748B"
            fontSize={8}
            fontFamily="monospace"
          >
            Plot faces: {orientation.plotFacing}
          </text>
        )}
      </svg>
    </div>
  );
};

// ============================================
// SUB-COMPONENTS
// ============================================

const RoomShape: FC<{
  room: PlacedRoom;
  isSelected: boolean;
  onClick: () => void;
  showLabel: boolean;
}> = ({ room, isSelected, onClick, showLabel }) => {
  const x = room.x * SCALE;
  const y = room.y * SCALE;
  const w = room.width * SCALE;
  const h = room.height * SCALE;
  const area = (room.width * room.height).toFixed(1);

  return (
    <g onClick={onClick} className="cursor-pointer" role="button" aria-label={room.spec.name}>
      {/* Room fill */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={room.color}
        fillOpacity={isSelected ? 0.9 : 0.7}
        stroke={isSelected ? '#2563EB' : '#9CA3AF'}
        strokeWidth={isSelected ? 2 : 0.8}
        rx={1}
      />

      {/* Tile pattern for bathrooms/kitchen */}
      {['bathroom', 'toilet', 'kitchen'].includes(room.spec.type) && (
        <rect x={x} y={y} width={w} height={h} fill="url(#hatch-tile)" opacity={0.5} />
      )}

      {/* Doors */}
      {room.doors.map((door) => (
        <DoorSymbol key={door.id} door={door} room={room} />
      ))}

      {/* Windows */}
      {room.windows.map((win) => (
        <WindowSymbol key={win.id} window={win} room={room} />
      ))}

      {/* Room label */}
      {showLabel && (
        <g>
          <text
            x={x + w / 2}
            y={y + h / 2 - 4}
            textAnchor="middle"
            fill="#1F2937"
            fontSize={Math.min(10, w / 6)}
            fontWeight="600"
            fontFamily="system-ui"
          >
            {room.spec.name}
          </text>
          <text
            x={x + w / 2}
            y={y + h / 2 + 8}
            textAnchor="middle"
            fill="#6B7280"
            fontSize={Math.min(8, w / 8)}
            fontFamily="monospace"
          >
            {room.width.toFixed(1)}×{room.height.toFixed(1)}m ({area}m²)
          </text>
          {/* Ceiling height */}
          <text
            x={x + w / 2}
            y={y + h / 2 + 18}
            textAnchor="middle"
            fill="#9CA3AF"
            fontSize={6}
            fontFamily="monospace"
          >
            CH: {room.ceilingHeight}m
          </text>
        </g>
      )}
    </g>
  );
};

const DoorSymbol: FC<{
  door: import('../../services/space-planning/types').DoorSpec;
  room: PlacedRoom;
}> = ({ door, room }) => {
  const doorWidth = door.width * SCALE;
  let dx: number, dy: number;
  let angle = 0;

  switch (door.wallSide) {
    case 'S':
      dx = room.x * SCALE + door.position * SCALE;
      dy = room.y * SCALE;
      angle = 0;
      break;
    case 'N':
      dx = room.x * SCALE + door.position * SCALE;
      dy = (room.y + room.height) * SCALE;
      angle = 180;
      break;
    case 'E':
      dx = (room.x + room.width) * SCALE;
      dy = room.y * SCALE + door.position * SCALE;
      angle = 90;
      break;
    case 'W':
      dx = room.x * SCALE;
      dy = room.y * SCALE + door.position * SCALE;
      angle = -90;
      break;
  }

  return (
    <g transform={`translate(${dx}, ${dy}) rotate(${angle})`}>
      {/* Door opening */}
      <line x1={0} y1={0} x2={doorWidth} y2={0} stroke="none" />
      {/* Door arc (90 degree swing) */}
      <path
        d={`M 0,0 L ${doorWidth},0 A ${doorWidth},${doorWidth} 0 0,1 0,${doorWidth}`}
        fill="none"
        stroke={door.type === 'main_entry' ? '#B45309' : '#78350F'}
        strokeWidth={door.type === 'main_entry' ? 1.2 : 0.8}
        strokeDasharray={door.type === 'sliding' ? '3 2' : 'none'}
      />
      {/* Door leaf */}
      <line x1={0} y1={0} x2={0} y2={doorWidth} stroke="#78350F" strokeWidth={1.5} />
      {/* Gap in wall */}
      <rect x={-1} y={-2} width={doorWidth + 2} height={4} fill="white" opacity={0.8} />
    </g>
  );
};

const WindowSymbol: FC<{
  window: import('../../services/space-planning/types').WindowSpec;
  room: PlacedRoom;
}> = ({ window: win, room }) => {
  const winW = win.width * SCALE;
  let x: number, y: number;
  let isVertical = false;

  switch (win.wallSide) {
    case 'S':
      x = room.x * SCALE + win.position * SCALE;
      y = room.y * SCALE;
      break;
    case 'N':
      x = room.x * SCALE + win.position * SCALE;
      y = (room.y + room.height) * SCALE;
      break;
    case 'E':
      x = (room.x + room.width) * SCALE;
      y = room.y * SCALE + win.position * SCALE;
      isVertical = true;
      break;
    case 'W':
      x = room.x * SCALE;
      y = room.y * SCALE + win.position * SCALE;
      isVertical = true;
      break;
  }

  if (isVertical) {
    return (
      <g>
        <rect x={x - 3} y={y} width={6} height={winW} fill="white" />
        <line x1={x - 3} y1={y} x2={x - 3} y2={y + winW} stroke="#3B82F6" strokeWidth={1.5} />
        <line x1={x + 3} y1={y} x2={x + 3} y2={y + winW} stroke="#3B82F6" strokeWidth={1.5} />
        <line x1={x} y1={y} x2={x} y2={y + winW} stroke="#93C5FD" strokeWidth={0.5} />
      </g>
    );
  }

  return (
    <g>
      <rect x={x} y={y - 3} width={winW} height={6} fill="white" />
      <line x1={x} y1={y - 3} x2={x + winW} y2={y - 3} stroke="#3B82F6" strokeWidth={1.5} />
      <line x1={x} y1={y + 3} x2={x + winW} y2={y + 3} stroke="#3B82F6" strokeWidth={1.5} />
      <line x1={x} y1={y} x2={x + winW} y2={y} stroke="#93C5FD" strokeWidth={0.5} />
    </g>
  );
};

const WallsLayer: FC<{ walls: WallSegment[] }> = ({ walls }) => (
  <g>
    {walls.map((wall) => {
      const t = wall.thickness * SCALE;
      const isHorizontal = Math.abs(wall.startY - wall.endY) < 0.01;
      const isExternal = wall.type === 'external';

      if (isHorizontal) {
        const minX = Math.min(wall.startX, wall.endX) * SCALE;
        const maxX = Math.max(wall.startX, wall.endX) * SCALE;
        const y = wall.startY * SCALE;
        return (
          <rect
            key={wall.id}
            x={minX}
            y={y - t / 2}
            width={maxX - minX}
            height={t}
            fill={isExternal ? 'url(#hatch-brick)' : '#D1D5DB'}
            stroke={isExternal ? EXTERNAL_WALL_COLOR : INTERNAL_WALL_COLOR}
            strokeWidth={isExternal ? 1.2 : 0.6}
          />
        );
      }

      const minY = Math.min(wall.startY, wall.endY) * SCALE;
      const maxY = Math.max(wall.startY, wall.endY) * SCALE;
      const x = wall.startX * SCALE;
      return (
        <rect
          key={wall.id}
          x={x - t / 2}
          y={minY}
          width={t}
          height={maxY - minY}
          fill={isExternal ? 'url(#hatch-brick)' : '#D1D5DB'}
          stroke={isExternal ? EXTERNAL_WALL_COLOR : INTERNAL_WALL_COLOR}
          strokeWidth={isExternal ? 1.2 : 0.6}
        />
      );
    })}
  </g>
);

const StructuralOverlay: FC<{ structural: StructuralPlan }> = ({ structural }) => (
  <g opacity={0.85}>
    {/* Beams */}
    {structural.beams.map((beam) => (
      <line
        key={beam.id}
        x1={beam.startX * SCALE}
        y1={beam.startY * SCALE}
        x2={beam.endX * SCALE}
        y2={beam.endY * SCALE}
        stroke={BEAM_COLOR}
        strokeWidth={beam.width * SCALE}
        strokeLinecap="round"
      />
    ))}
    {/* Columns */}
    {structural.columns.map((col) => (
      <g key={col.id}>
        <rect
          x={(col.x - col.width / 2) * SCALE}
          y={(col.y - col.depth / 2) * SCALE}
          width={col.width * SCALE}
          height={col.depth * SCALE}
          fill={COLUMN_COLOR}
          stroke="#1F2937"
          strokeWidth={1}
        />
        <text
          x={col.x * SCALE}
          y={col.y * SCALE + 3}
          textAnchor="middle"
          fill="white"
          fontSize={6}
          fontWeight="bold"
        >
          {col.id}
        </text>
      </g>
    ))}
    {/* Foundations */}
    {structural.foundations.map((f) => (
      <rect
        key={f.id}
        x={f.x * SCALE}
        y={f.y * SCALE}
        width={f.width * SCALE}
        height={f.depth * SCALE}
        fill="url(#hatch-concrete)"
        stroke="#6B7280"
        strokeWidth={0.5}
        strokeDasharray="4 2"
        opacity={0.5}
      />
    ))}
  </g>
);

const ElectricalOverlay: FC<{ electrical: ElectricalPlan }> = ({ electrical }) => {
  const iconMap: Record<string, string> = {
    light_point: '💡',
    fan_point: '🔄',
    switch: '⬜',
    socket: '⬛',
    ac_point: '❄️',
    exhaust_fan: '🌀',
    geyser_point: '🔥',
    tv_point: '📺',
    data_point: '📶',
    smoke_detector: '🔔',
    emergency_light: '🚨',
    bell_point: '🔔',
    chimney: '🏭',
    ev_charging: '⚡',
  };

  return (
    <g opacity={0.9}>
      {/* Wiring runs between fixtures in same circuit */}
      {electrical.circuits.map((circuit) => {
        const circuitFixtures = electrical.fixtures.filter((f) => circuit.fixtures.includes(f.id));
        if (circuitFixtures.length < 2) return null;
        const color =
          circuit.type === 'lighting'
            ? '#EAB308'
            : circuit.type === 'power'
              ? '#EF4444'
              : circuit.type === 'ac'
                ? '#3B82F6'
                : '#22C55E';
        return (
          <g key={circuit.id}>
            {circuitFixtures.map((f, i) => {
              if (i === 0) return null;
              const prev = circuitFixtures[i - 1];
              return (
                <line
                  key={`wire-${f.id}`}
                  x1={prev.x * SCALE}
                  y1={prev.y * SCALE}
                  x2={f.x * SCALE}
                  y2={f.y * SCALE}
                  stroke={color}
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  opacity={0.6}
                />
              );
            })}
          </g>
        );
      })}
      {/* Fixtures */}
      {electrical.fixtures.map((f) => (
        <g key={f.id}>
          <circle
            cx={f.x * SCALE}
            cy={f.y * SCALE}
            r={5}
            fill="white"
            stroke="#EAB308"
            strokeWidth={0.8}
          />
          <text x={f.x * SCALE} y={f.y * SCALE + 3} textAnchor="middle" fontSize={7}>
            {iconMap[f.type] || '⊕'}
          </text>
        </g>
      ))}
      {/* Panels */}
      {electrical.panels.map((p) => (
        <g key={p.id}>
          <rect
            x={p.x * SCALE - 6}
            y={p.y * SCALE - 8}
            width={12}
            height={16}
            fill="#FEF3C7"
            stroke="#D97706"
            strokeWidth={1}
            rx={2}
          />
          <text
            x={p.x * SCALE}
            y={p.y * SCALE + 1}
            textAnchor="middle"
            fontSize={5}
            fontWeight="bold"
            fill="#92400E"
          >
            DB
          </text>
        </g>
      ))}
    </g>
  );
};

const PlumbingOverlay: FC<{ plumbing: PlumbingPlan }> = ({ plumbing }) => {
  const iconMap: Record<string, string> = {
    wash_basin: '🚿',
    wc: '🚽',
    shower: '🚿',
    bathtub: '🛁',
    kitchen_sink: '🚰',
    utility_sink: '🚰',
    washing_machine: '🧺',
    floor_trap: '⊙',
    water_heater: '🔥',
    garden_tap: '🚿',
  };

  return (
    <g opacity={0.9}>
      {/* Supply pipes */}
      {plumbing.pipes
        .filter((p) => p.type === 'water_supply' || p.type === 'hot_water')
        .map((pipe) => (
          <line
            key={pipe.id}
            x1={pipe.startX * SCALE}
            y1={pipe.startY * SCALE}
            x2={pipe.endX * SCALE}
            y2={pipe.endY * SCALE}
            stroke={pipe.type === 'hot_water' ? '#EF4444' : '#3B82F6'}
            strokeWidth={pipe.diameter / 15}
            strokeLinecap="round"
          />
        ))}
      {/* Drain pipes */}
      {plumbing.pipes
        .filter((p) => p.type === 'drainage')
        .map((pipe) => (
          <line
            key={pipe.id}
            x1={pipe.startX * SCALE}
            y1={pipe.startY * SCALE}
            x2={pipe.endX * SCALE}
            y2={pipe.endY * SCALE}
            stroke="#22C55E"
            strokeWidth={pipe.diameter / 15}
            strokeDasharray="5 3"
            strokeLinecap="round"
          />
        ))}
      {/* Fixtures */}
      {plumbing.fixtures.map((f) => (
        <g key={f.id}>
          <circle
            cx={f.x * SCALE}
            cy={f.y * SCALE}
            r={6}
            fill="white"
            stroke="#3B82F6"
            strokeWidth={0.8}
          />
          <text x={f.x * SCALE} y={f.y * SCALE + 3} textAnchor="middle" fontSize={8}>
            {iconMap[f.type] || '●'}
          </text>
        </g>
      ))}
    </g>
  );
};

const HVACOverlay: FC<{ hvac: HVACPlan }> = ({ hvac }) => {
  const iconMap: Record<string, string> = {
    split_ac: '❄️',
    ceiling_fan: '🔄',
    exhaust_fan: '🌀',
    chimney: '🏭',
    window_ac: '❄️',
    vrf_unit: '❄️',
    thermostat: '🌡️',
  };

  return (
    <g opacity={0.85}>
      {/* Ventilation paths */}
      {hvac.ventilationPaths.map((vp) => (
        <g key={vp.id}>{/* Airflow arrow (simplified) */}</g>
      ))}
      {/* Equipment */}
      {hvac.equipment.map((eq) => (
        <g key={eq.id}>
          <rect
            x={eq.x * SCALE - 8}
            y={eq.y * SCALE - 8}
            width={16}
            height={16}
            fill="#DBEAFE"
            stroke="#3B82F6"
            strokeWidth={0.8}
            rx={eq.type === 'ceiling_fan' ? 8 : 2}
          />
          <text x={eq.x * SCALE} y={eq.y * SCALE + 3} textAnchor="middle" fontSize={9}>
            {iconMap[eq.type] || '⊕'}
          </text>
        </g>
      ))}
    </g>
  );
};

const DimensionLine: FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  vertical?: boolean;
}> = ({ x1, y1, x2, y2, label, vertical }) => (
  <g>
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={DIMENSION_COLOR}
      strokeWidth={0.8}
      markerStart="url(#dim-arrow)"
      markerEnd="url(#dim-arrow)"
    />
    {/* Extension lines */}
    {!vertical && (
      <>
        <line x1={x1} y1={y1 - 8} x2={x1} y2={y1 + 4} stroke={DIMENSION_COLOR} strokeWidth={0.3} />
        <line x1={x2} y1={y2 - 8} x2={x2} y2={y2 + 4} stroke={DIMENSION_COLOR} strokeWidth={0.3} />
      </>
    )}
    {vertical && (
      <>
        <line x1={x1 - 4} y1={y1} x2={x1 + 8} y2={y1} stroke={DIMENSION_COLOR} strokeWidth={0.3} />
        <line x1={x2 - 4} y1={y2} x2={x2 + 8} y2={y2} stroke={DIMENSION_COLOR} strokeWidth={0.3} />
      </>
    )}
    {/* Label */}
    <text
      x={vertical ? x1 - 8 : (x1 + x2) / 2}
      y={vertical ? (y1 + y2) / 2 : y1 - 4}
      textAnchor="middle"
      fill={DIMENSION_COLOR}
      fontSize={8}
      fontFamily="monospace"
      fontWeight="bold"
      transform={vertical ? `rotate(-90, ${x1 - 8}, ${(y1 + y2) / 2})` : undefined}
    >
      {label}
    </text>
  </g>
);

const CompassRose: FC<{ x: number; y: number; size: number; northAngle: number }> = ({
  x,
  y,
  size,
  northAngle,
}) => {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2 - 4;

  return (
    <g transform={`rotate(${-northAngle}, ${cx}, ${cy})`}>
      <circle
        cx={cx}
        cy={cy}
        r={r + 2}
        fill="white"
        fillOpacity={0.9}
        stroke="#CBD5E1"
        strokeWidth={0.5}
      />
      {/* N pointer */}
      <polygon points={`${cx},${cy - r} ${cx - 4},${cy} ${cx + 4},${cy}`} fill="#DC2626" />
      {/* S pointer */}
      <polygon points={`${cx},${cy + r} ${cx - 4},${cy} ${cx + 4},${cy}`} fill="#CBD5E1" />
      {/* E-W line */}
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#94A3B8" strokeWidth={0.5} />
      {/* Labels */}
      <text x={cx} y={cy - r - 3} textAnchor="middle" fill="#DC2626" fontSize={9} fontWeight="bold">
        N
      </text>
      <text x={cx} y={cy + r + 8} textAnchor="middle" fill="#64748B" fontSize={7}>
        S
      </text>
      <text x={cx + r + 5} y={cy + 3} textAnchor="start" fill="#64748B" fontSize={7}>
        E
      </text>
      <text x={cx - r - 5} y={cy + 3} textAnchor="end" fill="#64748B" fontSize={7}>
        W
      </text>
    </g>
  );
};

export default FloorPlanRenderer;
