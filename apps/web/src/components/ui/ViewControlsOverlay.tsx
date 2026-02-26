/**
 * ViewControlsOverlay.tsx — Professional 3D View Controls
 * 
 * Industry-standard viewport controls similar to STAAD Pro / ETABS / Revit.
 * Provides quick view switching, zoom controls, and rendering toggles.
 */

import { FC, memo } from 'react';
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  Grid3X3,
  Box,
  Axis3D,
  Layers,
  Sun,
  Camera,
} from 'lucide-react';

// ============================================
// VIEW CUBE — Quick Orientation Switcher
// ============================================

interface ViewCubeProps {
  onViewChange: (view: string) => void;
}

const ViewCube: FC<ViewCubeProps> = memo(({ onViewChange }) => {
  const views = [
    { id: 'front', label: 'Front', short: 'F' },
    { id: 'back', label: 'Back', short: 'B' },
    { id: 'left', label: 'Left', short: 'L' },
    { id: 'right', label: 'Right', short: 'R' },
    { id: 'top', label: 'Top', short: 'T' },
    { id: 'iso', label: '3D', short: '3D' },
  ];

  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[7px] text-slate-500 uppercase tracking-widest font-bold text-center mb-0.5">
        View
      </div>
      <div className="grid grid-cols-3 gap-0.5">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            title={v.label}
            className="
              w-7 h-7 rounded text-[9px] font-bold
              bg-slate-800/60 text-slate-400
              hover:bg-blue-600/20 hover:text-blue-300 hover:border-blue-500/30
              border border-slate-700/30
              transition-all duration-100 active:scale-95
              flex items-center justify-center
            "
          >
            {v.short}
          </button>
        ))}
      </div>
    </div>
  );
});
ViewCube.displayName = 'ViewCube';

// ============================================
// COMPACT TOOL BUTTON
// ============================================

interface CompactBtnProps {
  icon: FC<{ className?: string }>;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}

const CompactBtn: FC<CompactBtnProps> = memo(({ icon: Icon, label, onClick, isActive = false }) => (
  <button
    onClick={onClick}
    title={label}
    className={`
      w-7 h-7 rounded flex items-center justify-center
      border border-transparent transition-all duration-100
      active:scale-95
      ${isActive
        ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
        : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 border-slate-700/30'
      }
    `}
  >
    <Icon className="w-3.5 h-3.5" />
  </button>
));
CompactBtn.displayName = 'CompactBtn';

// ============================================
// MAIN VIEW CONTROLS OVERLAY
// ============================================

interface ViewControlsOverlayProps {
  showGrid?: boolean;
  showAxes?: boolean;
  renderMode3D?: boolean;
  onToggleGrid?: () => void;
  onToggleAxes?: () => void;
  onToggle3D?: () => void;
  onFitView?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
  onViewChange?: (view: string) => void;
  onScreenshot?: () => void;
}

export const ViewControlsOverlay: FC<ViewControlsOverlayProps> = memo(({
  showGrid = true,
  showAxes = true,
  renderMode3D = false,
  onToggleGrid,
  onToggleAxes,
  onToggle3D,
  onFitView,
  onZoomIn,
  onZoomOut,
  onResetView,
  onViewChange,
  onScreenshot,
}) => {
  return (
    <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
      {/* View Cube */}
      <div className="bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-700/30 p-2 shadow-lg">
        <ViewCube onViewChange={onViewChange || (() => {})} />
      </div>

      {/* Zoom Controls */}
      <div className="bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-700/30 p-1.5 shadow-lg flex flex-col gap-0.5">
        <CompactBtn icon={ZoomIn} label="Zoom In" onClick={onZoomIn || (() => {})} />
        <CompactBtn icon={ZoomOut} label="Zoom Out" onClick={onZoomOut || (() => {})} />
        <CompactBtn icon={Maximize2} label="Fit All (F)" onClick={onFitView || (() => document.dispatchEvent(new CustomEvent('fit-view')))} />
        <CompactBtn icon={RotateCcw} label="Reset View" onClick={onResetView || (() => {})} />
      </div>

      {/* Display Toggles */}
      <div className="bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-700/30 p-1.5 shadow-lg flex flex-col gap-0.5">
        <CompactBtn icon={Grid3X3} label="Toggle Grid" onClick={onToggleGrid || (() => {})} isActive={showGrid} />
        <CompactBtn icon={Axis3D} label="Toggle Axes" onClick={onToggleAxes || (() => {})} isActive={showAxes} />
        <CompactBtn icon={Box} label="3D Render" onClick={onToggle3D || (() => {})} isActive={renderMode3D} />
        <CompactBtn icon={Camera} label="Screenshot" onClick={onScreenshot || (() => {})} />
      </div>
    </div>
  );
});
ViewControlsOverlay.displayName = 'ViewControlsOverlay';

export default ViewControlsOverlay;
