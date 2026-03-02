/**
 * CoordinateInputBar.tsx — Professional Coordinate Input
 * 
 * Industry-standard coordinate input like STAAD Pro / AutoCAD.
 * Shows current cursor position and allows direct coordinate entry.
 * Supports Cartesian (X, Y, Z) and Cylindrical coordinate systems.
 */

import { FC, memo, useState, useCallback, KeyboardEvent, useRef } from 'react';
import { Crosshair, Hash, Navigation } from 'lucide-react';

interface CoordinateInputBarProps {
  x?: number;
  y?: number;
  z?: number;
  onCoordinateSubmit?: (x: number, y: number, z: number) => void;
  coordinateSystem?: 'cartesian' | 'cylindrical';
  onSystemChange?: (system: 'cartesian' | 'cylindrical') => void;
  snapActive?: boolean;
  gridSize?: number;
}

export const CoordinateInputBar: FC<CoordinateInputBarProps> = memo(({
  x = 0,
  y = 0,
  z = 0,
  onCoordinateSubmit,
  coordinateSystem = 'cartesian',
  onSystemChange,
  snapActive = false,
  gridSize = 1,
}) => {
  const [inputMode, setInputMode] = useState(false);
  const [inputX, setInputX] = useState('');
  const [inputY, setInputY] = useState('');
  const [inputZ, setInputZ] = useState('');
  const xRef = useRef<HTMLInputElement>(null);
  const yRef = useRef<HTMLInputElement>(null);
  const zRef = useRef<HTMLInputElement>(null);

  const handleActivate = useCallback(() => {
    setInputMode(true);
    setInputX(x.toFixed(3));
    setInputY(y.toFixed(3));
    setInputZ(z.toFixed(3));
    setTimeout(() => xRef.current?.select(), 50);
  }, [x, y, z]);

  const handleSubmit = useCallback(() => {
    const nx = parseFloat(inputX) || 0;
    const ny = parseFloat(inputY) || 0;
    const nz = parseFloat(inputZ) || 0;
    onCoordinateSubmit?.(nx, ny, nz);
    setInputMode(false);
  }, [inputX, inputY, inputZ, onCoordinateSubmit]);

  const handleKeyDown = useCallback((e: KeyboardEvent, field: 'x' | 'y' | 'z') => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      if (field === 'x') yRef.current?.select();
      else if (field === 'y') zRef.current?.select();
      else handleSubmit();
    } else if (e.key === 'Escape') {
      setInputMode(false);
    }
  }, [handleSubmit]);

  const fmt = (v: number) => {
    if (Math.abs(v) < 0.0005) return '0.000';
    return v.toFixed(3);
  };

  return (
    <div className="flex items-center gap-2 h-full select-none">
      {/* Coordinate System Toggle */}
      <button type="button"
        onClick={() => onSystemChange?.(coordinateSystem === 'cartesian' ? 'cylindrical' : 'cartesian')}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold 
                   text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
        title={`Switch to ${coordinateSystem === 'cartesian' ? 'Cylindrical' : 'Cartesian'} coordinates`}
      >
        <Navigation className="w-3 h-3" />
        {coordinateSystem === 'cartesian' ? 'XYZ' : 'RθZ'}
      </button>

      <span className="h-3.5 w-px bg-slate-100 dark:bg-slate-800" />

      {/* Coordinate Display / Input */}
      <div
        className="coord-input-bar"
        onClick={!inputMode ? handleActivate : undefined}
        role="group"
        aria-label="Coordinate input"
      >
        <Crosshair className="w-3 h-3 text-slate-600 mr-0.5" />

        {inputMode ? (
          <>
            <label className="text-blue-400 font-bold">X:</label>
            <input
              ref={xRef}
              value={inputX}
              onChange={(e) => setInputX(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'x')}
              className="!w-16"
              autoFocus
            />
            <span className="text-slate-700">|</span>
            <label className="text-emerald-400 font-bold">Y:</label>
            <input
              ref={yRef}
              value={inputY}
              onChange={(e) => setInputY(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'y')}
              className="!w-16"
            />
            <span className="text-slate-700">|</span>
            <label className="text-amber-400 font-bold">Z:</label>
            <input
              ref={zRef}
              value={inputZ}
              onChange={(e) => setInputZ(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, 'z')}
              className="!w-16"
            />
            <button type="button"
              onClick={handleSubmit}
              className="ml-1 px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded text-[9px] font-bold hover:bg-blue-600/30 transition-colors"
            >
              ↵
            </button>
          </>
        ) : (
          <>
            <label>X:</label>
            <span className="text-slate-500 dark:text-slate-400 font-mono w-14 text-right tabular-nums">{fmt(x)}</span>
            <span className="text-slate-700">|</span>
            <label>Y:</label>
            <span className="text-slate-500 dark:text-slate-400 font-mono w-14 text-right tabular-nums">{fmt(y)}</span>
            <span className="text-slate-700">|</span>
            <label>Z:</label>
            <span className="text-slate-500 dark:text-slate-400 font-mono w-14 text-right tabular-nums">{fmt(z)}</span>
          </>
        )}
      </div>

      <span className="h-3.5 w-px bg-slate-100 dark:bg-slate-800" />

      {/* Snap & Grid Info */}
      <div className="flex items-center gap-1.5 text-[9px]">
        <span className={`flex items-center gap-0.5 ${snapActive ? 'text-blue-400' : 'text-slate-600'}`}>
          <Hash className="w-3 h-3" />
          <span className="font-semibold">SNAP</span>
        </span>
        <span className="text-slate-600">
          Grid: {gridSize}m
        </span>
      </div>
    </div>
  );
});
CoordinateInputBar.displayName = 'CoordinateInputBar';

export default CoordinateInputBar;
