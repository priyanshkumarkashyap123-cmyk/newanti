import React from 'react';
import { SectionProperties } from '../data/SectionDatabase';

interface SteelSectionPreviewProps {
  section: SectionProperties;
  width?: number;
  height?: number;
}

export const SteelSectionPreview: React.FC<SteelSectionPreviewProps> = ({ 
  section, 
  width = 200, 
  height = 200 
}) => {
  const margin = 20;
  const drawW = width - margin * 2;
  const drawH = height - margin * 2;

  // Render logic based on section type
  const renderPath = () => {
    switch (section.type) {
      case 'W':
      case 'ISMB':
      case 'ISLB':
      case 'ISJB':
      case 'ISHB':
      case 'IPE':
      case 'HEA':
      case 'HEB': {
        const d = section.d || 100;
        const bf = section.bf || 50;
        const tf = section.tf || 5;
        const tw = section.tw || 3;

        const scale = Math.min(drawW / bf, drawH / d);
        const sW = bf * scale;
        const sH = d * scale;
        const sTf = tf * scale;
        const sTw = tw * scale;

        const ox = (width - sW) / 2;
        const oy = (height - sH) / 2;

        return (
          <path
            d={`
              M ${ox},${oy} 
              L ${ox + sW},${oy} 
              L ${ox + sW},${oy + sTf} 
              L ${ox + sW/2 + sTw/2},${oy + sTf} 
              L ${ox + sW/2 + sTw/2},${oy + sH - sTf} 
              L ${ox + sW},${oy + sH - sTf} 
              L ${ox + sW},${oy + sH} 
              L ${ox},${oy + sH} 
              L ${ox},${oy + sH - sTf} 
              L ${ox + sW/2 - sTw/2},${oy + sH - sTf} 
              L ${ox + sW/2 - sTw/2},${oy + sTf} 
              L ${ox},${oy + sTf} 
              Z
            `}
            fill="currentColor"
            className="text-blue-500/80 dark:text-blue-400/80"
            stroke="currentColor"
            strokeWidth="1"
          />
        );
      }

      case 'ISMC':
      case 'C':
      case 'MC':
      case 'UPN': {
        const d = section.d || 100;
        const bf = section.bf || 50;
        const tf = section.tf || 5;
        const tw = section.tw || 3;

        const scale = Math.min(drawW / bf, drawH / d);
        const sW = bf * scale;
        const sH = d * scale;
        const sTf = tf * scale;
        const sTw = tw * scale;

        const ox = (width - sW) / 2;
        const oy = (height - sH) / 2;

        return (
          <path
            d={`
              M ${ox},${oy} 
              L ${ox + sW},${oy} 
              L ${ox + sW},${oy + sTf} 
              L ${ox + sTw},${oy + sTf} 
              L ${ox + sTw},${oy + sH - sTf} 
              L ${ox + sW},${oy + sH - sTf} 
              L ${ox + sW},${oy + sH} 
              L ${ox},${oy + sH} 
              Z
            `}
            fill="currentColor"
            className="text-indigo-500/80 dark:text-indigo-400/80"
            stroke="currentColor"
            strokeWidth="1"
          />
        );
      }

      case 'HSS-RECT':
      case 'RECT-CONCRETE': {
        const b = section.b || section.bf || 50;
        const h = section.h || section.d || 100;
        const t = section.t || 5;

        const scale = Math.min(drawW / b, drawH / h);
        const sW = b * scale;
        const sH = h * scale;
        const sT = t * scale;

        const ox = (width - sW) / 2;
        const oy = (height - sH) / 2;

        return (
          <path
            d={`
              M ${ox},${oy} L ${ox + sW},${oy} L ${ox + sW},${oy + sH} L ${ox},${oy + sH} Z
              M ${ox + sT},${oy + sT} L ${ox + sW - sT},${oy + sT} L ${ox + sW - sT},${oy + sH - sT} L ${ox + sT},${oy + sH - sT} Z
            `}
            fillRule="evenodd"
            fill="currentColor"
            className="text-emerald-500/80 dark:text-emerald-400/80"
            stroke="currentColor"
            strokeWidth="1"
          />
        );
      }

      case 'PIPE':
      case 'HSS-ROUND':
      case 'CIRC-CONCRETE': {
        const D = section.D || section.d || 100;
        const t = section.t || 5;

        const scale = Math.min(drawW / D, drawH / D);
        const sD = D * scale;
        const sT = t * scale;

        const cx = width / 2;
        const cy = height / 2;

        return (
          <g className="text-amber-500/80 dark:text-amber-400/80">
            <circle cx={cx} cy={cy} r={sD / 2} fill="currentColor" stroke="currentColor" strokeWidth="1" />
            <circle cx={cx} cy={cy} r={sD / 2 - sT} fill="white" className="dark:fill-slate-900" />
          </g>
        );
      }

      default:
        return <rect x={margin} y={margin} width={drawW} height={drawH} fill="#ccc" />;
    }
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-800" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {renderPath()}
      </svg>
      <div className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
        {section.name} Profile
      </div>
    </div>
  );
};
