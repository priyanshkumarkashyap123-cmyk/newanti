/**
 * ViewControlsBar.tsx - Reusable Render Mode & Display Controls
 *
 * Provides consistent rendering mode selection and display toggles
 * across all analysis and modeling components.
 *
 * Features:
 * - Standard view shortcuts (XY, XZ, YZ, 3D)
 * - Render mode selector (Analytical/Wireframe/Solid)
 * - Display toggles (Node #, Member #, Loads, Supports, Dimensions)
 * - Tooltips with keyboard shortcuts
 * - Dark mode support
 */

import { FC } from 'react';
import { Minus, Box, Hexagon, Hash, Tag, ArrowDown, Triangle, Ruler } from 'lucide-react';

export type RenderMode = 'wireframe' | 'solid' | 'analytical';

export interface ViewControlsBarProps {
  /** Current render mode */
  renderMode: RenderMode;
  /** Callback when render mode changes */
  onRenderModeChange: (mode: RenderMode) => void;
  /** Display toggle states (nodeNumbers, memberNumbers, loads, supports, dimensions) */
  displayToggles: Record<string, boolean>;
  /** Callback when display toggle changes */
  onDisplayToggle: (key: string) => void;
  /** Callback when standard view is selected */
  onStandardView: (view: string) => void;
}

/**
 * ViewControlsBar Component
 *
 * Renders a compact toolbar with:
 * - Standard view buttons (1=XY, 2=XZ, 3=YZ, 0=3D)
 * - Render mode buttons (analytical/wireframe/solid)
 * - Display toggle buttons for various visualization options
 */
export const ViewControlsBar: FC<ViewControlsBarProps> = ({
  renderMode,
  onRenderModeChange,
  displayToggles,
  onDisplayToggle,
  onStandardView,
}) => (
  <div className="flex items-center gap-1">
    {/* Standard Views */}
    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-md">
      {[
        { id: 'front', label: 'XY', shortcut: '1' },
        { id: 'top', label: 'XZ', shortcut: '2' },
        { id: 'right', label: 'YZ', shortcut: '3' },
        { id: 'iso', label: '3D', shortcut: '0' },
      ].map((v) => (
        <button
          type="button"
          key={v.id}
          onClick={() => onStandardView(v.id)}
          className="px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wide text-[#869ab8] hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white transition-colors"
          title={`${v.label} View (${v.shortcut})`}
        >
          {v.label}
        </button>
      ))}
    </div>

    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />

    {/* Render Modes */}
    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-md">
      {[
        { id: 'analytical' as RenderMode, icon: Minus, label: 'Line' },
        { id: 'wireframe' as RenderMode, icon: Box, label: 'Wire' },
        { id: 'solid' as RenderMode, icon: Hexagon, label: 'Solid' },
      ].map((rm) => {
        const Icon = rm.icon;
        return (
          <button
            type="button"
            key={rm.id}
            onClick={() => onRenderModeChange(rm.id)}
            className={`p-1 rounded transition-all ${
              renderMode === rm.id
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={`${rm.label} mode`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>

    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />

    {/* Display Toggles */}
    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-md">
      {[
        { key: 'nodeNumbers', icon: Hash, label: 'Node #' },
        { key: 'memberNumbers', icon: Tag, label: 'Mem #' },
        { key: 'loads', icon: ArrowDown, label: 'Loads' },
        { key: 'supports', icon: Triangle, label: 'Supports' },
        { key: 'dimensions', icon: Ruler, label: 'Dim' },
      ].map((dt) => {
        const Icon = dt.icon;
        const isOn = displayToggles[dt.key] ?? true;
        return (
          <button
            type="button"
            key={dt.key}
            onClick={() => onDisplayToggle(dt.key)}
            className={`p-1 rounded transition-all ${
              isOn
                ? 'text-emerald-400'
                : 'text-slate-500 hover:text-slate-400'
            }`}
            title={`${isOn ? 'Hide' : 'Show'} ${dt.label}`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  </div>
);

export default ViewControlsBar;
