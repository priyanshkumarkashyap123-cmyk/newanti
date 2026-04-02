/**
 * ColorSchemePanel.tsx
 * Displays color and material recommendations for different room types
 */

import type { ColorScheme } from '../../services/space-planning/types';

export const ColorSchemePanel: React.FC<{ schemes: ColorScheme[] }> = ({ schemes }) => {
  const uniqueSchemes = schemes.filter(
    (s, i, arr) => arr.findIndex((a) => a.roomType === s.roomType) === i,
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {uniqueSchemes.map((scheme) => (
        <div
          key={scheme.roomType}
          className="bg-[#0b1326] rounded-lg border border-[#1a2333] p-3"
        >
          <div className="text-xs font-semibold text-[#adc6ff] mb-2 capitalize">
            {scheme.roomType.replace(/_/g, ' ')}
            {scheme.direction && (
              <span className="text-[10px] text-slate-400 ml-1">({scheme.direction})</span>
            )}
          </div>
          <div className="flex gap-1.5 mb-2">
            {[
              { color: scheme.wallColor, label: 'Wall' },
              { color: scheme.ceilingColor, label: 'Ceiling' },
              { color: scheme.floorColor, label: 'Floor' },
              { color: scheme.accentColor, label: 'Accent' },
            ].map(({ color, label }) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <div
                  className="w-8 h-8 rounded border border-slate-300 shadow-sm"
                  style={{ backgroundColor: color }}
                  title={color}
                />
                <span className="text-[8px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                scheme.vastuCompatible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {scheme.vastuCompatible ? 'Vastu ✓' : 'Non-vastu'}
            </span>
            <span className="text-[10px] text-slate-400 capitalize">{scheme.mood}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
