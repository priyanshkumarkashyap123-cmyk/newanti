/**
 * ViewControlsOverlay.tsx — Professional 3D View Controls
 * 
 * Industry-standard viewport controls similar to STAAD Pro / ETABS / Revit.
 * Self-contained: reads from Zustand stores and dispatches CustomEvents
 * for camera operations handled by CameraFitController.
 */

import { FC, memo, useState, useCallback } from 'react';
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid3X3,
  Box,
  Axis3D,
  Camera,
  Eye,
} from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

// ============================================
// VIEW CUBE — Quick Orientation Switcher
// ============================================

const VIEWS = [
  { id: 'front', label: 'Front (XY)', short: 'F' },
  { id: 'back', label: 'Back', short: 'B' },
  { id: 'left', label: 'Left (YZ)', short: 'L' },
  { id: 'right', label: 'Right', short: 'R' },
  { id: 'top', label: 'Top (XZ)', short: 'T' },
  { id: 'bottom', label: 'Bottom', short: 'Bo' },
  { id: 'iso', label: '3D Perspective', short: '3D' },
] as const;

const ViewCube: FC<{ activeView: string; onViewChange: (view: string) => void }> = memo(({ activeView, onViewChange }) => (
  <div className="flex flex-col gap-0.5 w-20">
    <div className="text-[7px] text-slate-500 uppercase tracking-widest font-bold text-center mb-0.5">
      View
    </div>
    <div className="grid grid-cols-3 gap-px">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          onClick={() => onViewChange(v.id)}
          title={v.label}
          className={`
            w-[26px] h-[26px] rounded text-[9px] font-bold
            border transition-all duration-100 active:scale-95
            flex items-center justify-center
            ${activeView === v.id
              ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
              : 'bg-slate-100/60 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-blue-600/20 hover:text-blue-300 hover:border-blue-500/30 border-slate-300/30 dark:border-slate-700/30'
            }
          `}
        >
          {v.short}
        </button>
      ))}
    </div>
  </div>
));
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
      w-8 h-8 rounded-md flex items-center justify-center
      border border-transparent transition-all duration-100
      active:scale-95
      ${isActive
        ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
        : 'bg-slate-100/60 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 hover:text-slate-700 dark:hover:text-slate-200 border-slate-300/30 dark:border-slate-700/30'
      }
    `}
  >
    <Icon className="w-3.5 h-3.5" />
  </button>
));
CompactBtn.displayName = 'CompactBtn';

// ============================================
// MAIN VIEW CONTROLS OVERLAY (Self-Contained)
// ============================================

export const ViewControlsOverlay: FC = memo(() => {
  // Store bindings
  const showGrid = useUIStore((s) => s.showGrid);
  const toggleGrid = useUIStore((s) => s.toggleGrid);
  const renderMode3D = useUIStore((s) => s.renderMode3D);
  const setRenderMode3D = useUIStore((s) => s.setRenderMode3D);

  // Local state for features not in global store
  const [showAxes, setShowAxes] = useState(true);
  const [activeView, setActiveView] = useState('iso');
  const [isPerspective, setIsPerspective] = useState(true);

  // --- Camera operations via CustomEvents (handled by CameraFitController) ---

  const handleViewChange = useCallback((view: string) => {
    setActiveView(view);
    document.dispatchEvent(new CustomEvent('change-view', { detail: { view } }));
  }, []);

  const handleZoomIn = useCallback(() => {
    document.dispatchEvent(new CustomEvent('zoom-in'));
  }, []);

  const handleZoomOut = useCallback(() => {
    document.dispatchEvent(new CustomEvent('zoom-out'));
  }, []);

  const handleFitView = useCallback(() => {
    document.dispatchEvent(new CustomEvent('fit-view'));
  }, []);

  const handleResetView = useCallback(() => {
    setActiveView('iso');
    document.dispatchEvent(new CustomEvent('reset-view'));
  }, []);

  // --- Display toggles ---

  const handleToggleAxes = useCallback(() => {
    const next = !showAxes;
    setShowAxes(next);
    document.dispatchEvent(new CustomEvent('toggle-axes', { detail: { showAxes: next } }));
  }, [showAxes]);

  const handleToggle3D = useCallback(() => {
    setRenderMode3D(!renderMode3D);
  }, [renderMode3D, setRenderMode3D]);

  const handleTogglePerspective = useCallback(() => {
    const next = !isPerspective;
    setIsPerspective(next);
    document.dispatchEvent(new CustomEvent('toggle-perspective', { detail: { perspective: next } }));
  }, [isPerspective]);

  const handleScreenshot = useCallback(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `beamlab-screenshot-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      console.warn('Screenshot failed — canvas may be tainted');
    }
  }, []);

  return (
    <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
      {/* View Cube */}
      <div className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-200/30 dark:border-slate-700/30 p-2 shadow-lg">
        <ViewCube activeView={activeView} onViewChange={handleViewChange} />
      </div>

      {/* Zoom Controls */}
      <div className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-200/30 dark:border-slate-700/30 p-1.5 shadow-lg flex flex-col gap-0.5">
        <CompactBtn icon={ZoomIn} label="Zoom In (+)" onClick={handleZoomIn} />
        <CompactBtn icon={ZoomOut} label="Zoom Out (−)" onClick={handleZoomOut} />
        <CompactBtn icon={Maximize2} label="Fit All (F)" onClick={handleFitView} />
        <CompactBtn icon={RotateCcw} label="Reset View (Home)" onClick={handleResetView} />
      </div>

      {/* Display Toggles */}
      <div className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-200/30 dark:border-slate-700/30 p-1.5 shadow-lg flex flex-col gap-0.5">
        <CompactBtn icon={Grid3X3} label="Toggle Grid (G)" onClick={toggleGrid} isActive={showGrid} />
        <CompactBtn icon={Axis3D} label="Toggle Axes" onClick={handleToggleAxes} isActive={showAxes} />
        <CompactBtn icon={Eye} label={isPerspective ? 'Orthographic' : 'Perspective'} onClick={handleTogglePerspective} isActive={!isPerspective} />
        <CompactBtn icon={Box} label="3D Render Mode" onClick={handleToggle3D} isActive={renderMode3D} />
        <CompactBtn icon={Camera} label="Screenshot (PNG)" onClick={handleScreenshot} />
      </div>
    </div>
  );
});
ViewControlsOverlay.displayName = 'ViewControlsOverlay';

export default ViewControlsOverlay;
