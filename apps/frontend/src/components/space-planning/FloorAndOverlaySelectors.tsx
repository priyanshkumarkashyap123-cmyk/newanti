/**
 * FloorAndOverlaySelectors.tsx
 * Floor and overlay mode selection controls for space planning page
 */

import { LayoutGrid, Building2, Zap, Droplets, Wind } from 'lucide-react';
import type { OverlayMode } from './FloorPlanRenderer';
import type { HousePlanProject } from '../../services/space-planning/types';

export const FloorSelector: React.FC<{
  floors: HousePlanProject['floorPlans'];
  selected: number;
  onChange: (floor: number) => void;
}> = ({ floors, selected, onChange }) => (
  <div className="flex gap-1">
    {floors.map((fp) => (
      <button
        key={fp.floor}
        onClick={() => onChange(fp.floor)}
        className={`px-3 py-1.5 text-xs font-medium tracking-wide rounded-lg ${
          selected === fp.floor
            ? 'bg-blue-600 text-white'
            : 'bg-surface text-slate-600 dark:text-slate-300 hover:bg-slate-200'
        }`}
      >
        {fp.label}
      </button>
    ))}
  </div>
);

export const OverlaySelector: React.FC<{
  current: OverlayMode;
  onChange: (mode: OverlayMode) => void;
}> = ({ current, onChange }) => (
  <div className="flex gap-1">
    {[
      { key: 'none' as const, label: 'Plan Only', icon: LayoutGrid },
      { key: 'structural' as const, label: 'Structural', icon: Building2 },
      { key: 'electrical' as const, label: 'Electrical', icon: Zap },
      { key: 'plumbing' as const, label: 'Plumbing', icon: Droplets },
      { key: 'hvac' as const, label: 'HVAC', icon: Wind },
    ].map((opt) => {
      const Icon = opt.icon;
      return (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          title={opt.label}
          className={`p-1.5 rounded ${current === opt.key ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      );
    })}
  </div>
);
