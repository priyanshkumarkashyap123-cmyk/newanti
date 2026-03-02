/**
 * ViewCube.tsx - 3D Navigation View Cube (STAAD.Pro/AutoCAD Style)
 * 
 * Professional 3D view cube with:
 * - Interactive click-to-orient
 * - Smooth animation transitions
 * - Edge and corner selection
 * - Compass ring with North indicator
 * - Home view button
 * - View presets dropdown
 * - Mini-axis indicator
 */

import React from 'react';
import { FC, useState, useCallback, useMemo, memo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, ChevronDown, Eye, RotateCw, Maximize2, Grid3X3, Box, Compass
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type ViewOrientation = 
  | 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right'
  | 'iso-front-right' | 'iso-front-left' | 'iso-back-right' | 'iso-back-left'
  | 'front-top' | 'front-bottom' | 'back-top' | 'back-bottom'
  | 'left-top' | 'left-bottom' | 'right-top' | 'right-bottom'
  | 'front-left' | 'front-right' | 'back-left' | 'back-right';

interface ViewCubeProps {
  currentView?: ViewOrientation;
  rotation?: { x: number; y: number; z: number };
  onViewChange?: (view: ViewOrientation) => void;
  onRotationChange?: (rotation: { x: number; y: number; z: number }) => void;
  onHomeView?: () => void;
  onFitAll?: () => void;
  showCompass?: boolean;
  compassNorth?: number; // Degrees from Y-axis
  size?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  interactive?: boolean;
}

interface CubeFace {
  id: ViewOrientation;
  label: string;
  shortLabel: string;
  position: [number, number, number];
  rotation: [number, number, number];
}

interface CubeEdge {
  id: ViewOrientation;
  label: string;
  position: [number, number, number];
  size: [number, number];
}

// ============================================
// CONSTANTS
// ============================================

const CUBE_FACES: CubeFace[] = [
  { id: 'front', label: 'FRONT', shortLabel: 'F', position: [0, 0, 50], rotation: [0, 0, 0] },
  { id: 'back', label: 'BACK', shortLabel: 'B', position: [0, 0, -50], rotation: [0, 180, 0] },
  { id: 'top', label: 'TOP', shortLabel: 'T', position: [0, 50, 0], rotation: [-90, 0, 0] },
  { id: 'bottom', label: 'BOTTOM', shortLabel: 'Bo', position: [0, -50, 0], rotation: [90, 0, 0] },
  { id: 'right', label: 'RIGHT', shortLabel: 'R', position: [50, 0, 0], rotation: [0, 90, 0] },
  { id: 'left', label: 'LEFT', shortLabel: 'L', position: [-50, 0, 0], rotation: [0, -90, 0] },
];

const VIEW_PRESETS = [
  { id: 'front', label: 'Front View', shortcut: '1' },
  { id: 'back', label: 'Back View', shortcut: '' },
  { id: 'top', label: 'Top View', shortcut: '2' },
  { id: 'bottom', label: 'Bottom View', shortcut: '' },
  { id: 'left', label: 'Left View', shortcut: '' },
  { id: 'right', label: 'Right View', shortcut: '3' },
  { id: 'divider', label: '', shortcut: '' },
  { id: 'iso-front-right', label: 'Isometric (Front-Right)', shortcut: '0' },
  { id: 'iso-front-left', label: 'Isometric (Front-Left)', shortcut: '' },
  { id: 'iso-back-right', label: 'Isometric (Back-Right)', shortcut: '' },
  { id: 'iso-back-left', label: 'Isometric (Back-Left)', shortcut: '' },
];

// Calculate camera rotation for each view
const VIEW_ROTATIONS: Record<ViewOrientation, { x: number; y: number; z: number }> = {
  'front': { x: 0, y: 0, z: 0 },
  'back': { x: 0, y: 180, z: 0 },
  'top': { x: -90, y: 0, z: 0 },
  'bottom': { x: 90, y: 0, z: 0 },
  'left': { x: 0, y: -90, z: 0 },
  'right': { x: 0, y: 90, z: 0 },
  'iso-front-right': { x: -30, y: 45, z: 0 },
  'iso-front-left': { x: -30, y: -45, z: 0 },
  'iso-back-right': { x: -30, y: 135, z: 0 },
  'iso-back-left': { x: -30, y: -135, z: 0 },
  'front-top': { x: -45, y: 0, z: 0 },
  'front-bottom': { x: 45, y: 0, z: 0 },
  'back-top': { x: -45, y: 180, z: 0 },
  'back-bottom': { x: 45, y: 180, z: 0 },
  'left-top': { x: -45, y: -90, z: 0 },
  'left-bottom': { x: 45, y: -90, z: 0 },
  'right-top': { x: -45, y: 90, z: 0 },
  'right-bottom': { x: 45, y: 90, z: 0 },
  'front-left': { x: 0, y: -45, z: 0 },
  'front-right': { x: 0, y: 45, z: 0 },
  'back-left': { x: 0, y: -135, z: 0 },
  'back-right': { x: 0, y: 135, z: 0 },
};

// ============================================
// VIEW CUBE FACE COMPONENT
// ============================================

const CubeFaceComponent: FC<{
  face: CubeFace;
  isActive: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHover: (hovered: boolean) => void;
}> = memo(({ face, isActive, isHovered, onClick, onHover }) => {
  const transform = `
    translate3d(${face.position[0]}px, ${face.position[1]}px, ${face.position[2]}px)
    rotateX(${face.rotation[0]}deg)
    rotateY(${face.rotation[1]}deg)
    rotateZ(${face.rotation[2]}deg)
    translateZ(0)
  `;

  return (
    <div
      className={`
        absolute w-[100px] h-[100px] -ml-[50px] -mt-[50px]
        flex items-center justify-center cursor-pointer
        text-[10px] font-bold tracking-wider
        border border-slate-600/50 transition-colors duration-150
        ${isActive 
          ? 'bg-blue-500/40 text-blue-200 border-blue-400' 
          : isHovered 
            ? 'bg-slate-600/60 text-slate-100' 
            : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400'
        }
      `}
      style={{ 
        transform,
        backfaceVisibility: 'hidden',
      }}
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {face.label}
    </div>
  );
});

CubeFaceComponent.displayName = 'CubeFaceComponent';

// ============================================
// COMPASS RING COMPONENT
// ============================================

const CompassRing: FC<{
  rotation: number;
  north: number;
  size: number;
}> = memo(({ rotation, north, size }) => {
  const radius = size / 2 + 20;
  const directions = [
    { label: 'N', angle: 0 },
    { label: 'E', angle: 90 },
    { label: 'S', angle: 180 },
    { label: 'W', angle: 270 },
  ];

  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ transform: `rotateZ(${-rotation + north}deg)` }}
    >
      {/* Ring */}
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${size + 60} ${size + 60}`}>
        <circle
          cx={(size + 60) / 2}
          cy={(size + 60) / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
        {/* Tick marks */}
        {Array.from({ length: 36 }).map((_, i) => {
          const angle = (i * 10 * Math.PI) / 180;
          const isMajor = i % 9 === 0;
          const innerR = radius - (isMajor ? 8 : 4);
          const outerR = radius;
          const cx = (size + 60) / 2;
          const cy = (size + 60) / 2;
          
          return (
            <line
              key={i}
              x1={cx + Math.sin(angle) * innerR}
              y1={cy - Math.cos(angle) * innerR}
              x2={cx + Math.sin(angle) * outerR}
              y2={cy - Math.cos(angle) * outerR}
              stroke={isMajor ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}
              strokeWidth={isMajor ? 2 : 1}
            />
          );
        })}
      </svg>

      {/* Direction Labels */}
      {directions.map(dir => {
        const angle = (dir.angle * Math.PI) / 180;
        const labelRadius = radius + 12;
        const cx = (size + 60) / 2;
        const cy = (size + 60) / 2;
        const x = cx + Math.sin(angle) * labelRadius;
        const y = cy - Math.cos(angle) * labelRadius;
        
        return (
          <div
            key={dir.label}
            className={`absolute text-[10px] font-bold transform -translate-x-1/2 -translate-y-1/2 ${
              dir.label === 'N' ? 'text-red-400' : 'text-slate-500 dark:text-slate-400'
            }`}
            style={{ left: x, top: y }}
          >
            {dir.label}
          </div>
        );
      })}
    </div>
  );
});

CompassRing.displayName = 'CompassRing';

// ============================================
// MINI AXIS INDICATOR
// ============================================

const MiniAxisIndicator: FC<{
  rotation: { x: number; y: number; z: number };
  size?: number;
}> = memo(({ rotation, size = 40 }) => {
  const length = size * 0.4;
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div 
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${-rotation.x}deg) rotateY(${-rotation.y}deg) rotateZ(${rotation.z}deg)`,
        }}
      >
        {/* X Axis (Red) */}
        <div 
          className="absolute bg-red-500 origin-left"
          style={{
            width: length,
            height: 2,
            left: '50%',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          <span className="absolute -right-2 -top-2 text-[8px] text-red-400 font-bold">X</span>
        </div>
        
        {/* Y Axis (Green) */}
        <div 
          className="absolute bg-emerald-500 origin-bottom"
          style={{
            width: 2,
            height: length,
            left: '50%',
            bottom: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <span className="absolute -top-2 left-1 text-[8px] text-emerald-400 font-bold">Y</span>
        </div>
        
        {/* Z Axis (Blue) */}
        <div 
          className="absolute bg-blue-500 origin-center"
          style={{
            width: 2,
            height: length,
            left: '50%',
            top: '50%',
            transform: 'translateX(-50%) rotateX(-90deg)',
            transformOrigin: 'center top',
          }}
        >
          <span className="absolute -bottom-2 left-1 text-[8px] text-blue-400 font-bold">Z</span>
        </div>
      </div>
    </div>
  );
});

MiniAxisIndicator.displayName = 'MiniAxisIndicator';

// ============================================
// VIEW PRESETS DROPDOWN
// ============================================

const ViewPresetsDropdown: FC<{
  onViewChange: (view: ViewOrientation) => void;
}> = memo(({ onViewChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded transition-colors"
        title="View Presets"
      >
        <ChevronDown className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full right-0 mt-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden z-50"
          >
            {VIEW_PRESETS.map((preset, index) => {
              if (preset.id === 'divider') {
                return <div key={index} className="h-px bg-slate-200 dark:bg-slate-700 my-1" />;
              }
              return (
                <button type="button"
                  key={preset.id}
                  onClick={() => {
                    onViewChange(preset.id as ViewOrientation);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <span>{preset.label}</span>
                  {preset.shortcut && (
                    <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">
                      {preset.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ViewPresetsDropdown.displayName = 'ViewPresetsDropdown';

// ============================================
// MAIN VIEW CUBE COMPONENT
// ============================================

export const ViewCube: FC<ViewCubeProps> = ({
  currentView = 'iso-front-right',
  rotation: externalRotation,
  onViewChange,
  onRotationChange,
  onHomeView,
  onFitAll,
  showCompass = true,
  compassNorth = 0,
  size = 120,
  position = 'top-right',
  interactive = true
}) => {
  const [hoveredFace, setHoveredFace] = useState<ViewOrientation | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [internalRotation, setInternalRotation] = useState(VIEW_ROTATIONS[currentView]);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const rotation = externalRotation || internalRotation;

  // Handle view change
  const handleFaceClick = useCallback((viewId: ViewOrientation) => {
    if (!interactive) return;
    
    const targetRotation = VIEW_ROTATIONS[viewId];
    if (externalRotation) {
      onRotationChange?.(targetRotation);
    } else {
      setInternalRotation(targetRotation);
    }
    onViewChange?.(viewId);
  }, [interactive, externalRotation, onRotationChange, onViewChange]);

  // Handle drag rotation
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!interactive) return;
    setIsDragging(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, [interactive]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      const newRotation = {
        x: rotation.x - deltaY * 0.5,
        y: rotation.y + deltaX * 0.5,
        z: rotation.z
      };

      if (externalRotation) {
        onRotationChange?.(newRotation);
      } else {
        setInternalRotation(newRotation);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, rotation, externalRotation, onRotationChange]);

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div 
      ref={containerRef}
      className={`absolute ${positionClasses[position]} z-20`}
      style={{ width: size + 60, height: size + 80 }}
    >
      {/* View Cube Container */}
      <div 
        className="relative mx-auto"
        style={{ 
          width: size, 
          height: size,
          perspective: 400,
          marginTop: 30,
        }}
      >
        {/* Compass Ring */}
        {showCompass && (
          <CompassRing
            rotation={rotation.y}
            north={compassNorth}
            size={size}
          />
        )}

        {/* 3D Cube */}
        <div
          className={`relative w-full h-full ${interactive ? 'cursor-grab' : ''} ${isDragging ? 'cursor-grabbing' : ''}`}
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Faces */}
          {CUBE_FACES.map(face => (
            <CubeFaceComponent
              key={face.id}
              face={face}
              isActive={currentView === face.id}
              isHovered={hoveredFace === face.id}
              onClick={() => handleFaceClick(face.id)}
              onHover={(hovered) => setHoveredFace(hovered ? face.id : null)}
            />
          ))}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-center gap-1 mt-2">
        {/* Home View */}
        <button type="button"
          onClick={onHomeView || (() => handleFaceClick('iso-front-right'))}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded transition-colors"
          title="Home View"
        >
          <Home className="w-4 h-4" />
        </button>

        {/* Fit All */}
        <button type="button"
          onClick={onFitAll}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded transition-colors"
          title="Fit All"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* View Presets */}
        <ViewPresetsDropdown onViewChange={handleFaceClick} />
      </div>

      {/* Mini Axis Indicator */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
        <MiniAxisIndicator rotation={rotation} size={40} />
      </div>
    </div>
  );
};

// ============================================
// SIMPLIFIED VIEW CUBE (Lightweight Version)
// ============================================

export const MiniViewCube: FC<{
  rotation: { x: number; y: number; z: number };
  size?: number;
  onViewChange?: (view: ViewOrientation) => void;
}> = memo(({ rotation, size = 60, onViewChange }) => {
  const handleClick = (view: ViewOrientation) => {
    onViewChange?.(view);
  };

  return (
    <div 
      className="relative"
      style={{ 
        width: size, 
        height: size,
        perspective: 200,
      }}
    >
      <div
        className="w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transition: 'transform 0.3s ease-out',
        }}
      >
        {/* Simplified faces */}
        {['front', 'back', 'top', 'bottom', 'left', 'right'].map((face) => {
          const faceData = CUBE_FACES.find(f => f.id === face)!;
          const scale = size / 100;
          
          return (
            <div
              key={face}
              className="absolute bg-slate-100 dark:bg-slate-800 border border-slate-600/50 text-[8px] text-slate-500 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:text-slate-200"
              style={{
                width: size,
                height: size,
                transform: `
                  translate3d(${faceData.position[0] * scale}px, ${faceData.position[1] * scale}px, ${faceData.position[2] * scale}px)
                  rotateX(${faceData.rotation[0]}deg)
                  rotateY(${faceData.rotation[1]}deg)
                  translateZ(0)
                `,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                backfaceVisibility: 'hidden',
              }}
              onClick={() => handleClick(face as ViewOrientation)}
            >
              {faceData.shortLabel}
            </div>
          );
        })}
      </div>
    </div>
  );
});

MiniViewCube.displayName = 'MiniViewCube';

export default ViewCube;
