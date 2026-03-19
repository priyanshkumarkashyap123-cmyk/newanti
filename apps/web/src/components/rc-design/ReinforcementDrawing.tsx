import React from "react";

export type ReinforcementType = 'beam' | 'column' | 'slab';

export interface ReinforcementData {
  type: ReinforcementType;
  geometry: {
    b: number; // width or diameter
    D: number; // depth or length
    d?: number; // effective depth
    cover: number;
    L?: number; // span
  };
  reinforcement: {
    main?: string; // e.g. "4-T16" or "Longitudinal: 8-T20"
    secondary?: string; // e.g. "2-T12" or "Ties: T8 @ 150"
    links?: string; // e.g. "T8 @ 150"
    [key: string]: any;
  };
}

const ReinforcementDrawing = React.memo(function ReinforcementDrawing({
  data,
}: {
  data: ReinforcementData;
}) {
  const { type, geometry, reinforcement } = data;
  const b = geometry.b || 300;
  const D = geometry.D || 450;
  const cover = geometry.cover || 40;
  const L = geometry.L || 3000;

  const renderBeamDetailing = () => {
     const csW = 300;
     const csH = 300;
     const scale = Math.min(220 / b, 220 / D);
     const drawW = b * scale;
     const drawH = D * scale;
     const ox = (csW - drawW) / 2;
     const oy = (csH - drawH) / 2;
     const coverPx = cover * scale;

     return (
       <g>
          <text x={150} y={20} textAnchor="middle" fontSize="12" fill="currentColor" className="text-slate-400 font-bold uppercase tracking-wider">Beam Cross-Section</text>
          {/* Concrete Body */}
          <rect x={ox} y={oy} width={drawW} height={drawH} fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400" />
          {/* Stirrup */}
          <rect x={ox + coverPx} y={oy + coverPx} width={drawW - 2*coverPx} height={drawH - 2*coverPx} fill="none" stroke="#3b82f6" strokeWidth="1.5" rx="2" />
          {/* Top Bars (Hangers) */}
          <circle cx={ox + coverPx + 5} cy={oy + coverPx + 5} r="4" fill="#f97316" />
          <circle cx={ox + drawW - coverPx - 5} cy={oy + coverPx + 5} r="4" fill="#f97316" />
          {/* Bottom Bars (Main) */}
          <circle cx={ox + coverPx + 5} cy={oy + drawH - coverPx - 5} r="6" fill="#ef4444" />
          <circle cx={ox + drawW/2} cy={oy + drawH - coverPx - 5} r="6" fill="#ef4444" />
          <circle cx={ox + drawW - coverPx - 5} cy={oy + drawH - coverPx - 5} r="6" fill="#ef4444" />
          
          {/* Labels */}
          <g transform={`translate(${ox + drawW + 10}, ${oy})`}>
             <text y={20} fontSize="8" fill="currentColor" className="text-slate-500">Top: {reinforcement.secondary || '2-T12'}</text>
             <text y={40} fontSize="8" fill="currentColor" className="text-slate-500">Bot: {reinforcement.main}</text>
             <text y={60} fontSize="8" fill="currentColor" className="text-slate-500">Stirrups: {reinforcement.links}</text>
          </g>
       </g>
     );
  };

  const renderColumnDetailing = () => {
     const csW = 300;
     const csH = 300;
     const scale = Math.min(200 / b, 200 / D);
     const drawW = b * scale;
     const drawH = D * scale;
     const ox = (csW - drawW) / 2;
     const oy = (csH - drawH) / 2;
     const coverPx = cover * scale;

     return (
       <g>
          <text x={150} y={20} textAnchor="middle" fontSize="12" fill="currentColor" className="text-slate-400 font-bold uppercase tracking-wider">Column Section</text>
          <rect x={ox} y={oy} width={drawW} height={drawH} fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400" />
          <rect x={ox + coverPx} y={oy + coverPx} width={drawW - 2*coverPx} height={drawH - 2*coverPx} fill="none" stroke="#6366f1" strokeWidth="1.5" rx="2" />
          {/* 8 bars configuration for "premium" look */}
          <circle cx={ox + coverPx} cy={oy + coverPx} r="5" fill="#ef4444" />
          <circle cx={ox + drawW - coverPx} cy={oy + coverPx} r="5" fill="#ef4444" />
          <circle cx={ox + coverPx} cy={oy + drawH - coverPx} r="5" fill="#ef4444" />
          <circle cx={ox + drawW - coverPx} cy={oy + drawH - coverPx} r="5" fill="#ef4444" />
          <circle cx={ox + drawW/2} cy={oy + coverPx} r="5" fill="#ef4444" />
          <circle cx={ox + drawW/2} cy={oy + drawH - coverPx} r="5" fill="#ef4444" />
          
          <text x={150} y={oy + drawH + 30} textAnchor="middle" fontSize="9" fill="currentColor" className="text-slate-500">
            {reinforcement.main} | {reinforcement.links}
          </text>
       </g>
     );
  };

  const renderSlabDetailing = () => {
     return (
       <g>
          <text x={150} y={40} textAnchor="middle" fontSize="12" fill="currentColor" className="text-slate-400 font-bold uppercase tracking-wider">Slab Detailing</text>
          <rect x={30} y={80} width={240} height={40} fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400" />
          {/* Main bars at bottom */}
          {[0,1,2,3,4,5,6].map(i => (
            <circle key={i} cx={50 + i*30} cy={105} r="3" fill="#ef4444" />
          ))}
          <line x1={30} y1={110} x2={270} y2={110} stroke="#ef4444" strokeWidth="1" />
          {/* Distribution bars */}
          <line x1={30} y1={90} x2={270} y2={90} stroke="#f97316" strokeWidth="1" strokeDasharray="4 2" />
          
          <g transform="translate(150, 150)">
             <text textAnchor="middle" y={0} fontSize="9" fill="currentColor" className="text-slate-500">Main: {reinforcement.main}</text>
             <text textAnchor="middle" y={15} fontSize="9" fill="currentColor" className="text-slate-500">Dist: {reinforcement.secondary}</text>
          </g>
       </g>
     );
  };

  return (
    <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-white/5 rounded-xl p-4 transition-all hover:bg-white/80 dark:hover:bg-slate-900/80">
      <svg viewBox="0 0 300 240" className="w-full max-w-[400px] mx-auto overflow-visible">
        {type === 'beam' && renderBeamDetailing()}
        {type === 'column' && renderColumnDetailing()}
        {type === 'slab' && renderSlabDetailing()}
      </svg>
    </div>
  );
});

export { ReinforcementDrawing };
