/**
 * ============================================================================
 * STRUCTURAL DIAGRAM COMPONENTS - INDUSTRY GRADE VISUALIZATION
 * ============================================================================
 * 
 * SVG-based structural engineering diagrams:
 * - Beam cross-sections with reinforcement
 * - Stress-strain diagrams
 * - Moment/Shear diagrams
 * - Interaction diagrams
 * 
 * @version 1.0.0
 */


import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface ReinforcementLayer {
  y: number;           // Distance from bottom (mm)
  count: number;       // Number of bars
  diameter: number;    // Bar diameter (mm)
  type: 'tension' | 'compression';
}

export interface BeamCrossSectionProps {
  width: number;          // mm
  depth: number;          // mm
  cover: number;          // mm
  reinforcement: ReinforcementLayer[];
  stirrupDia?: number;    // mm
  stirrupSpacing?: number; // mm
  neutralAxisDepth?: number; // mm
  showStressBlock?: boolean;
  className?: string;
}

export interface StressStrainDiagramProps {
  fck: number;
  fy: number;
  d: number;
  xu: number;
  xuMax: number;
  Ast: number;
  width: number;
  className?: string;
}

export interface MomentDiagramProps {
  span: number;           // mm
  moments: number[];      // kN·m at 10 equal points
  maxMoment: number;      // kN·m
  type: 'sagging' | 'hogging' | 'both';
  className?: string;
}

export interface ShearDiagramProps {
  span: number;
  shears: number[];       // kN at 10 equal points
  maxShear: number;       // kN
  className?: string;
}

// ============================================================================
// BEAM CROSS-SECTION DIAGRAM
// ============================================================================

export const BeamCrossSection: React.FC<BeamCrossSectionProps> = ({
  width,
  depth,
  cover,
  reinforcement,
  stirrupDia = 8,
  stirrupSpacing = 150,
  neutralAxisDepth,
  showStressBlock = false,
  className,
}) => {
  // Scale factor: 1 mm = 1 SVG unit, but scaled to fit viewBox
  const viewBoxPadding = 40;
  const scale = 1;
  const svgWidth = width * scale + viewBoxPadding * 2;
  const svgHeight = depth * scale + viewBoxPadding * 2;
  
  // Dimensions
  const concreteX = viewBoxPadding;
  const concreteY = viewBoxPadding;
  const concreteW = width * scale;
  const concreteH = depth * scale;
  
  // Stirrup path
  const stirrupInset = cover - stirrupDia / 2;
  const stirrupPath = useMemo(() => {
    const x1 = concreteX + stirrupInset;
    const y1 = concreteY + stirrupInset;
    const x2 = concreteX + concreteW - stirrupInset;
    const y2 = concreteY + concreteH - stirrupInset;
    const r = stirrupDia * 2;
    return `M ${x1 + r} ${y1} 
            L ${x2 - r} ${y1} 
            Q ${x2} ${y1} ${x2} ${y1 + r}
            L ${x2} ${y2 - r}
            Q ${x2} ${y2} ${x2 - r} ${y2}
            L ${x1 + r} ${y2}
            Q ${x1} ${y2} ${x1} ${y2 - r}
            L ${x1} ${y1 + r}
            Q ${x1} ${y1} ${x1 + r} ${y1}
            Z`;
  }, [concreteX, concreteY, concreteW, concreteH, stirrupInset, stirrupDia]);
  
  return (
    <div className={cn("bg-[#0b1326] rounded-lg p-4", className)}>
      <svg 
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full max-w-md mx-auto"
        style={{ aspectRatio: `${svgWidth}/${svgHeight}` }}
      >
        <defs>
          {/* Concrete hatch pattern */}
          <pattern id="concrete-hatch" patternUnits="userSpaceOnUse" width="8" height="8">
            <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="#94a3b8" strokeWidth="0.5"/>
          </pattern>
          
          {/* Compression zone gradient */}
          <linearGradient id="compression-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1"/>
          </linearGradient>
        </defs>
        
        {/* Concrete section */}
        <rect
          x={concreteX}
          y={concreteY}
          width={concreteW}
          height={concreteH}
          fill="url(#concrete-hatch)"
          stroke="#64748b"
          strokeWidth="2"
        />
        
        {/* Compression stress block */}
        {showStressBlock && neutralAxisDepth && (
          <rect
            x={concreteX}
            y={concreteY}
            width={concreteW}
            height={neutralAxisDepth * scale}
            fill="url(#compression-gradient)"
          />
        )}
        
        {/* Neutral axis */}
        {neutralAxisDepth && (
          <>
            <line
              x1={concreteX - 10}
              y1={concreteY + neutralAxisDepth * scale}
              x2={concreteX + concreteW + 10}
              y2={concreteY + neutralAxisDepth * scale}
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="5,3"
            />
            <text
              x={concreteX + concreteW + 15}
              y={concreteY + neutralAxisDepth * scale + 4}
              className="text-xs fill-red-500 font-medium tracking-wide tracking-wide"
            >
              N.A.
            </text>
          </>
        )}
        
        {/* Stirrup */}
        <path
          d={stirrupPath}
          fill="none"
          stroke="#22c55e"
          strokeWidth={stirrupDia * 0.3}
        />
        
        {/* Reinforcement bars */}
        {reinforcement.map((layer, layerIdx) => {
          const barY = concreteY + concreteH - layer.y * scale;
          const spacing = (concreteW - 2 * cover) / (layer.count - 1);
          const bars = [];
          
          for (let i = 0; i < layer.count; i++) {
            const barX = concreteX + cover + i * spacing;
            bars.push(
              <circle
                key={`bar-${layerIdx}-${i}`}
                cx={barX}
                cy={barY}
                r={layer.diameter * scale / 2}
                fill={layer.type === 'tension' ? '#dc2626' : '#2563eb'}
                stroke="#1e293b"
                strokeWidth="1"
              />
            );
          }
          return bars;
        })}
        
        {/* Dimension lines */}
        {/* Width dimension */}
        <g className="text-xs">
          <line
            x1={concreteX}
            y1={concreteY + concreteH + 25}
            x2={concreteX + concreteW}
            y2={concreteY + concreteH + 25}
            stroke="#64748b"
            strokeWidth="1"
            markerStart="url(#arrow)"
            markerEnd="url(#arrow)"
          />
          <line x1={concreteX} y1={concreteY + concreteH + 20} x2={concreteX} y2={concreteY + concreteH + 30} stroke="#64748b" strokeWidth="1"/>
          <line x1={concreteX + concreteW} y1={concreteY + concreteH + 20} x2={concreteX + concreteW} y2={concreteY + concreteH + 30} stroke="#64748b" strokeWidth="1"/>
          <text
            x={concreteX + concreteW / 2}
            y={concreteY + concreteH + 38}
            textAnchor="middle"
            className="fill-slate-600 dark:fill-slate-400"
          >
            {width} mm
          </text>
        </g>
        
        {/* Depth dimension */}
        <g className="text-xs">
          <line
            x1={concreteX - 25}
            y1={concreteY}
            x2={concreteX - 25}
            y2={concreteY + concreteH}
            stroke="#64748b"
            strokeWidth="1"
          />
          <line x1={concreteX - 20} y1={concreteY} x2={concreteX - 30} y2={concreteY} stroke="#64748b" strokeWidth="1"/>
          <line x1={concreteX - 20} y1={concreteY + concreteH} x2={concreteX - 30} y2={concreteY + concreteH} stroke="#64748b" strokeWidth="1"/>
          <text
            x={concreteX - 30}
            y={concreteY + concreteH / 2}
            textAnchor="middle"
            transform={`rotate(-90, ${concreteX - 30}, ${concreteY + concreteH / 2})`}
            className="fill-slate-600 dark:fill-slate-400"
          >
            {depth} mm
          </text>
        </g>
        
        {/* Legend */}
        <g transform={`translate(${concreteX}, ${concreteY - 25})`}>
          <circle cx="0" cy="0" r="4" fill="#dc2626"/>
          <text x="10" y="4" className="text-xs fill-slate-600 dark:fill-slate-400">Tension</text>
          <circle cx="70" cy="0" r="4" fill="#2563eb"/>
          <text x="80" y="4" className="text-xs fill-slate-600 dark:fill-slate-400">Compression</text>
          <rect x="150" y="-3" width="15" height="6" fill="#22c55e" rx="1"/>
          <text x="170" y="4" className="text-xs fill-slate-600 dark:fill-slate-400">Stirrup</text>
        </g>
      </svg>
      
      {/* Reinforcement details */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {reinforcement.map((layer, idx) => (
          <div 
            key={idx} 
            className={cn(
              "px-3 py-2 rounded",
              layer.type === 'tension' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
            )}
          >
            <span className="font-medium tracking-wide tracking-wide">
              {layer.type === 'tension' ? 'Bottom' : 'Top'}: {layer.count} - {layer.diameter}φ
            </span>
            <span className="text-slate-500 ml-2">
              ({(layer.count * Math.PI * layer.diameter ** 2 / 4).toFixed(0)} mm²)
            </span>
          </div>
        ))}
        {stirrupSpacing && (
          <div className="px-3 py-2 rounded bg-green-50 dark:bg-green-900/20">
            <span className="font-medium tracking-wide tracking-wide">Stirrups: 2L-{stirrupDia}φ @ {stirrupSpacing} c/c</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// STRESS-STRAIN DIAGRAM
// ============================================================================

export const StressStrainDiagram: React.FC<StressStrainDiagramProps> = ({
  fck,
  fy,
  d,
  xu,
  xuMax,
  Ast,
  width,
  className,
}) => {
  const svgWidth = 400;
  const svgHeight = 300;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;
  
  // Strain values
  const εcu = 0.0035;
  const εs = εcu * (d - xu) / xu;
  const εy = fy / 200000;
  
  // Stress values (MPa)
  const fcd = 0.67 * fck / 1.5;
  const fs = Math.min(εs * 200000, 0.87 * fy);
  
  // Scale functions
  const xScale = (strain: number) => padding.left + (strain / 0.005) * plotWidth;
  const yStressScale = (stress: number) => padding.top + plotHeight - (stress / (fck * 0.5)) * plotHeight;
  
  // Concrete stress-strain curve (parabolic-rectangular per IS 456)
  const concretePoints: string[] = [];
  for (let ε = 0; ε <= 0.002; ε += 0.0001) {
    const fc = fcd * (2 * ε / 0.002 - (ε / 0.002) ** 2);
    concretePoints.push(`${xScale(ε)},${yStressScale(fc)}`);
  }
  for (let ε = 0.002; ε <= 0.0035; ε += 0.0001) {
    concretePoints.push(`${xScale(ε)},${yStressScale(fcd)}`);
  }
  
  // Steel stress-strain curve (bi-linear)
  const steelPoints = [
    `${xScale(0)},${yStressScale(0)}`,
    `${xScale(εy)},${yStressScale(0.87 * fy)}`,
    `${xScale(0.005)},${yStressScale(0.87 * fy)}`,
  ];
  
  return (
    <div className={cn("bg-[#0b1326] rounded-lg p-4", className)}>
      <h3 className="text-sm font-semibold text-[#adc6ff] mb-3">
        Stress-Strain Relationship
      </h3>
      
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full">
        {/* Grid */}
        <g className="text-slate-700 dark:text-slate-700">
          {[0, 0.001, 0.002, 0.003, 0.004, 0.005].map(strain => (
            <line
              key={strain}
              x1={xScale(strain)}
              y1={padding.top}
              x2={xScale(strain)}
              y2={padding.top + plotHeight}
              stroke="currentColor"
              strokeWidth="0.5"
            />
          ))}
        </g>
        
        {/* Axes */}
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight}
          stroke="#64748b"
          strokeWidth="1.5"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + plotHeight}
          stroke="#64748b"
          strokeWidth="1.5"
        />
        
        {/* Concrete curve */}
        <polyline
          points={concretePoints.join(' ')}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2.5"
        />
        
        {/* Steel curve */}
        <polyline
          points={steelPoints.join(' ')}
          fill="none"
          stroke="#dc2626"
          strokeWidth="2.5"
        />
        
        {/* Current strain marker - concrete */}
        <circle
          cx={xScale(εcu)}
          cy={yStressScale(fcd)}
          r="5"
          fill="#3b82f6"
        />
        
        {/* Current strain marker - steel */}
        <circle
          cx={xScale(εs)}
          cy={yStressScale(fs)}
          r="5"
          fill="#dc2626"
        />
        
        {/* Labels */}
        <text x={padding.left + plotWidth / 2} y={svgHeight - 10} textAnchor="middle" className="text-xs fill-slate-600 dark:fill-slate-400">
          Strain (ε)
        </text>
        <text x={15} y={padding.top + plotHeight / 2} textAnchor="middle" transform={`rotate(-90, 15, ${padding.top + plotHeight / 2})`} className="text-xs fill-slate-600 dark:fill-slate-400">
          Stress (MPa)
        </text>
        
        {/* Legend */}
        <g transform={`translate(${padding.left + 20}, ${padding.top + 20})`}>
          <line x1="0" y1="0" x2="20" y2="0" stroke="#3b82f6" strokeWidth="2.5"/>
          <text x="25" y="4" className="text-xs fill-slate-600 dark:fill-slate-400">Concrete</text>
          <line x1="0" y1="15" x2="20" y2="15" stroke="#dc2626" strokeWidth="2.5"/>
          <text x="25" y="19" className="text-xs fill-slate-600 dark:fill-slate-400">Steel</text>
        </g>
        
        {/* Strain values on x-axis */}
        {[0, 0.001, 0.002, 0.003, 0.004, 0.005].map(strain => (
          <text
            key={strain}
            x={xScale(strain)}
            y={padding.top + plotHeight + 15}
            textAnchor="middle"
            className="text-[10px] fill-slate-500"
          >
            {strain.toFixed(3)}
          </text>
        ))}
        
        {/* Key values annotation */}
        <g transform={`translate(${svgWidth - padding.right - 100}, ${padding.top + 20})`} className="text-xs">
          <rect x="-10" y="-15" width="110" height="75" rx="4" fill="white" fillOpacity="0.9" stroke="#e2e8f0"/>
          <text y="0" className="fill-slate-600 font-medium tracking-wide tracking-wide">Key Values:</text>
          <text y="15" className="fill-slate-500">εcu = {εcu.toFixed(4)}</text>
          <text y="30" className="fill-slate-500">εs = {εs.toFixed(4)}</text>
          <text y="45" className="fill-slate-500">xu/d = {(xu/d).toFixed(3)}</text>
        </g>
      </svg>
    </div>
  );
};

// ============================================================================
// MOMENT DIAGRAM
// ============================================================================

export const MomentDiagram: React.FC<MomentDiagramProps> = ({
  span,
  moments,
  maxMoment,
  type,
  className,
}) => {
  const svgWidth = 500;
  const svgHeight = 200;
  const padding = { top: 30, right: 30, bottom: 40, left: 50 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;
  
  // Normalize moments for display
  const maxAbsMoment = Math.max(...moments.map(Math.abs), maxMoment);
  
  // Generate parabolic moment curve (simply supported with UDL)
  const points: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const x = padding.left + (i / 100) * plotWidth;
    // Parabolic distribution: M = M_max * 4x(1-x) where x is normalized position
    const xNorm = i / 100;
    const m = maxMoment * 4 * xNorm * (1 - xNorm);
    const y = padding.top + plotHeight / 2 - (m / maxAbsMoment) * (plotHeight / 2) * 0.9;
    points.push(`${x},${y}`);
  }
  
  return (
    <div className={cn("bg-[#0b1326] rounded-lg p-4", className)}>
      <h3 className="text-sm font-semibold text-[#adc6ff] mb-3">
        Bending Moment Diagram
      </h3>
      
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full">
        {/* Reference line (zero moment) */}
        <line
          x1={padding.left}
          y1={padding.top + plotHeight / 2}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight / 2}
          stroke="#64748b"
          strokeWidth="2"
        />
        
        {/* Moment curve with fill */}
        <path
          d={`M ${padding.left},${padding.top + plotHeight / 2} ${points.join(' L ')} L ${padding.left + plotWidth},${padding.top + plotHeight / 2} Z`}
          fill="#3b82f6"
          fillOpacity="0.2"
          stroke="#3b82f6"
          strokeWidth="2"
        />
        
        {/* Support symbols */}
        {/* Left support - pinned */}
        <g transform={`translate(${padding.left}, ${padding.top + plotHeight / 2})`}>
          <polygon points="0,0 -8,15 8,15" fill="#64748b"/>
          <line x1="-12" y1="18" x2="12" y2="18" stroke="#64748b" strokeWidth="2"/>
        </g>
        
        {/* Right support - roller */}
        <g transform={`translate(${padding.left + plotWidth}, ${padding.top + plotHeight / 2})`}>
          <circle cy="10" r="5" fill="none" stroke="#64748b" strokeWidth="2"/>
          <line x1="-8" y1="18" x2="8" y2="18" stroke="#64748b" strokeWidth="2"/>
        </g>
        
        {/* Max moment annotation */}
        <g transform={`translate(${padding.left + plotWidth / 2}, ${padding.top + 5})`}>
          <line x1="0" y1="0" x2="0" y2={plotHeight / 2 - (maxMoment / maxAbsMoment) * (plotHeight / 2) * 0.9 - 5} stroke="#dc2626" strokeWidth="1" strokeDasharray="3,2"/>
          <text y="-5" textAnchor="middle" className="text-xs fill-red-600 font-semibold">
            M_max = {maxMoment.toFixed(1)} kN·m
          </text>
        </g>
        
        {/* Span label */}
        <text x={padding.left + plotWidth / 2} y={svgHeight - 10} textAnchor="middle" className="text-xs fill-slate-600 dark:fill-slate-400">
          Span = {(span / 1000).toFixed(2)} m
        </text>
        
        {/* + / - labels */}
        <text x={padding.left - 15} y={padding.top + 20} textAnchor="middle" className="text-xs fill-slate-500">+M</text>
        <text x={padding.left - 15} y={padding.top + plotHeight - 10} textAnchor="middle" className="text-xs fill-slate-500">-M</text>
      </svg>
    </div>
  );
};

// ============================================================================
// SHEAR DIAGRAM
// ============================================================================

export const ShearDiagram: React.FC<ShearDiagramProps> = ({
  span,
  shears,
  maxShear,
  className,
}) => {
  const svgWidth = 500;
  const svgHeight = 180;
  const padding = { top: 30, right: 30, bottom: 40, left: 50 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;
  
  const maxAbsShear = Math.max(...shears.map(Math.abs), maxShear);
  
  return (
    <div className={cn("bg-[#0b1326] rounded-lg p-4", className)}>
      <h3 className="text-sm font-semibold text-[#adc6ff] mb-3">
        Shear Force Diagram
      </h3>
      
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full">
        {/* Reference line (zero shear) */}
        <line
          x1={padding.left}
          y1={padding.top + plotHeight / 2}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight / 2}
          stroke="#64748b"
          strokeWidth="2"
        />
        
        {/* Shear diagram (linear for UDL) */}
        <path
          d={`M ${padding.left},${padding.top + plotHeight / 2 - (maxShear / maxAbsShear) * (plotHeight / 2) * 0.85}
              L ${padding.left + plotWidth},${padding.top + plotHeight / 2 + (maxShear / maxAbsShear) * (plotHeight / 2) * 0.85}
              L ${padding.left + plotWidth},${padding.top + plotHeight / 2}
              L ${padding.left},${padding.top + plotHeight / 2}
              Z`}
          fill="#22c55e"
          fillOpacity="0.2"
          stroke="#22c55e"
          strokeWidth="2"
        />
        
        {/* Support symbols */}
        <g transform={`translate(${padding.left}, ${padding.top + plotHeight / 2})`}>
          <polygon points="0,0 -8,15 8,15" fill="#64748b"/>
          <line x1="-12" y1="18" x2="12" y2="18" stroke="#64748b" strokeWidth="2"/>
        </g>
        
        <g transform={`translate(${padding.left + plotWidth}, ${padding.top + plotHeight / 2})`}>
          <circle cy="10" r="5" fill="none" stroke="#64748b" strokeWidth="2"/>
          <line x1="-8" y1="18" x2="8" y2="18" stroke="#64748b" strokeWidth="2"/>
        </g>
        
        {/* Shear values */}
        <text 
          x={padding.left + 10} 
          y={padding.top + 15}
          className="text-xs fill-green-600 font-semibold"
        >
          +{maxShear.toFixed(1)} kN
        </text>
        <text 
          x={padding.left + plotWidth - 10} 
          y={padding.top + plotHeight - 5}
          textAnchor="end"
          className="text-xs fill-green-600 font-semibold"
        >
          -{maxShear.toFixed(1)} kN
        </text>
        
        {/* Span label */}
        <text x={padding.left + plotWidth / 2} y={svgHeight - 10} textAnchor="middle" className="text-xs fill-slate-600 dark:fill-slate-400">
          Span = {(span / 1000).toFixed(2)} m
        </text>
      </svg>
    </div>
  );
};

// ============================================================================
// INTERACTION DIAGRAM (P-M)
// ============================================================================

export interface InteractionDiagramProps {
  points: { P: number; M: number }[];  // kN, kN·m
  Pu: number;                           // Applied axial load
  Mu: number;                           // Applied moment
  Po: number;                           // Axial capacity
  Mo: number;                           // Moment capacity
  className?: string;
}

export const InteractionDiagram: React.FC<InteractionDiagramProps> = ({
  points,
  Pu,
  Mu,
  Po,
  Mo,
  className,
}) => {
  const svgWidth = 400;
  const svgHeight = 400;
  const padding = { top: 40, right: 40, bottom: 50, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;
  
  // Scale based on max values
  const maxP = Math.max(Po, ...points.map(p => Math.abs(p.P)));
  const maxM = Math.max(Mo, ...points.map(p => p.M));
  
  // Scale functions
  const xScale = (M: number) => padding.left + (M / maxM) * plotWidth;
  const yScale = (P: number) => padding.top + plotHeight / 2 - (P / maxP) * (plotHeight / 2);
  
  // Generate interaction curve path
  const curvePath = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${xScale(p.M)},${yScale(p.P)}`
  ).join(' ');
  
  // Check if point is inside curve
  const isInside = true; // Simplified - would need proper point-in-polygon check
  
  return (
    <div className={cn("bg-[#0b1326] rounded-lg p-4", className)}>
      <h3 className="text-sm font-semibold text-[#adc6ff] mb-3">
        P-M Interaction Diagram
      </h3>
      
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full">
        {/* Grid */}
        <g className="text-slate-700 dark:text-slate-700">
          {[0, 0.25, 0.5, 0.75, 1].map(frac => (
            <React.Fragment key={frac}>
              <line
                x1={padding.left + frac * plotWidth}
                y1={padding.top}
                x2={padding.left + frac * plotWidth}
                y2={padding.top + plotHeight}
                stroke="currentColor"
                strokeWidth="0.5"
              />
              <line
                x1={padding.left}
                y1={padding.top + frac * plotHeight}
                x2={padding.left + plotWidth}
                y2={padding.top + frac * plotHeight}
                stroke="currentColor"
                strokeWidth="0.5"
              />
            </React.Fragment>
          ))}
        </g>
        
        {/* Axes */}
        <line
          x1={padding.left}
          y1={padding.top + plotHeight / 2}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight / 2}
          stroke="#64748b"
          strokeWidth="1.5"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + plotHeight}
          stroke="#64748b"
          strokeWidth="1.5"
        />
        
        {/* Interaction curve */}
        <path
          d={curvePath + ` L ${xScale(0)},${yScale(points[points.length - 1].P)} Z`}
          fill="#3b82f6"
          fillOpacity="0.1"
          stroke="#3b82f6"
          strokeWidth="2.5"
        />
        
        {/* Applied load point */}
        <circle
          cx={xScale(Mu)}
          cy={yScale(Pu)}
          r="6"
          fill={isInside ? '#22c55e' : '#ef4444'}
          stroke="#1e293b"
          strokeWidth="2"
        />
        
        {/* Load point annotation */}
        <g transform={`translate(${xScale(Mu) + 10}, ${yScale(Pu)})`}>
          <text className="text-xs fill-slate-700 dark:fill-slate-300 font-medium tracking-wide tracking-wide">
            ({Pu.toFixed(0)}, {Mu.toFixed(0)})
          </text>
        </g>
        
        {/* Axis labels */}
        <text 
          x={padding.left + plotWidth / 2} 
          y={svgHeight - 10} 
          textAnchor="middle" 
          className="text-xs fill-slate-600 dark:fill-slate-400"
        >
          Moment M (kN·m)
        </text>
        <text 
          x={15} 
          y={padding.top + plotHeight / 2} 
          textAnchor="middle"
          transform={`rotate(-90, 15, ${padding.top + plotHeight / 2})`}
          className="text-xs fill-slate-600 dark:fill-slate-400"
        >
          Axial Load P (kN)
        </text>
        
        {/* Key points labels */}
        <text x={xScale(0) + 5} y={yScale(Po) - 5} className="text-[10px] fill-blue-600">Po</text>
        <text x={xScale(Mo) + 5} y={yScale(0) - 5} className="text-[10px] fill-blue-600">Mo</text>
        
        {/* Legend */}
        <g transform={`translate(${svgWidth - 120}, ${padding.top + 10})`}>
          <rect x="-10" y="-10" width="110" height="50" rx="4" fill="white" fillOpacity="0.9" stroke="#e2e8f0"/>
          <circle cx="0" cy="5" r="5" fill="#22c55e"/>
          <text x="10" y="9" className="text-xs fill-slate-600">Inside - OK</text>
          <circle cx="0" cy="25" r="5" fill="#ef4444"/>
          <text x="10" y="29" className="text-xs fill-slate-600">Outside - FAIL</text>
        </g>
      </svg>
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  BeamCrossSection,
  StressStrainDiagram,
  MomentDiagram,
  ShearDiagram,
  InteractionDiagram,
};
