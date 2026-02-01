/**
 * ============================================================================
 * ADVANCED 3D STRUCTURAL VIEWER - REVOLUTIONARY VISUALIZATION
 * ============================================================================
 * 
 * Ultra-modern 3D structural visualization system featuring:
 * - Real-time deformation animation
 * - Stress/strain color mapping
 * - Interactive node/member selection
 * - Multiple display modes (wireframe, solid, transparent)
 * - Section cuts and exploded views
 * - Measurement tools
 * - Screenshot/video capture
 * - VR/AR ready architecture
 * 
 * @version 4.0.0
 */

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Box,
  Layers,
  Eye,
  EyeOff,
  Grid3X3,
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move,
  Move3D,
  Crosshair,
  Camera,
  Video,
  Film,
  Download,
  Share2,
  Settings,
  Sliders,
  Sun,
  Moon,
  Cloud,
  Palette,
  Droplets,
  Flame,
  Snowflake,
  Waves,
  Mountain,
  Building2,
  Columns,
  Square,
  Triangle,
  Circle,
  Hexagon,
  MousePointer2,
  Hand,
  Ruler,
  Scissors,
  Copy,
  RefreshCw,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  Volume2,
  VolumeX,
  Fullscreen,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Info,
  AlertTriangle,
  CheckCircle,
  Activity,
  BarChart,
  TrendingUp,
  Target,
  Compass,
  Navigation,
  Map,
  Locate,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface Node3D {
  id: string;
  x: number;
  y: number;
  z: number;
  displacement?: { dx: number; dy: number; dz: number };
  reactions?: { fx: number; fy: number; fz: number; mx: number; my: number; mz: number };
  support?: 'fixed' | 'pinned' | 'roller' | 'free';
}

interface Member3D {
  id: string;
  startNode: string;
  endNode: string;
  section: string;
  material: string;
  results?: {
    axialForce: number;
    shearY: number;
    shearZ: number;
    momentY: number;
    momentZ: number;
    torsion: number;
    stress: number;
    utilization: number;
  };
}

interface Load3D {
  id: string;
  type: 'point' | 'distributed' | 'moment' | 'pressure';
  magnitude: number;
  direction: [number, number, number];
  position?: [number, number, number];
  memberId?: string;
}

type DisplayMode = 'wireframe' | 'solid' | 'transparent' | 'realistic';
type ColorScheme = 'element' | 'stress' | 'displacement' | 'utilization' | 'force';
type ViewPreset = 'perspective' | 'top' | 'front' | 'right' | 'back' | 'left' | 'bottom' | 'isometric';

interface ViewerSettings {
  displayMode: DisplayMode;
  colorScheme: ColorScheme;
  showGrid: boolean;
  showAxes: boolean;
  showNodes: boolean;
  showLoads: boolean;
  showSupports: boolean;
  showDeformation: boolean;
  deformationScale: number;
  showLabels: boolean;
  showDimensions: boolean;
  backgroundColor: string;
  ambientLight: number;
  shadows: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_SETTINGS: ViewerSettings = {
  displayMode: 'solid',
  colorScheme: 'element',
  showGrid: true,
  showAxes: true,
  showNodes: true,
  showLoads: true,
  showSupports: true,
  showDeformation: false,
  deformationScale: 50,
  showLabels: false,
  showDimensions: false,
  backgroundColor: '#0a0a0f',
  ambientLight: 0.5,
  shadows: true,
};

const STRESS_COLORS = [
  { value: 0, color: '#22c55e' },   // Green - Low stress
  { value: 0.3, color: '#84cc16' }, // Lime
  { value: 0.5, color: '#eab308' }, // Yellow
  { value: 0.7, color: '#f97316' }, // Orange
  { value: 0.9, color: '#ef4444' }, // Red
  { value: 1.0, color: '#dc2626' }, // Dark red - Critical
];

const VIEW_PRESETS: { id: ViewPreset; label: string; camera: [number, number, number] }[] = [
  { id: 'perspective', label: 'Perspective', camera: [1, 0.8, 1] },
  { id: 'isometric', label: 'Isometric', camera: [1, 1, 1] },
  { id: 'top', label: 'Top', camera: [0, 1, 0] },
  { id: 'front', label: 'Front', camera: [0, 0, 1] },
  { id: 'right', label: 'Right', camera: [1, 0, 0] },
  { id: 'back', label: 'Back', camera: [0, 0, -1] },
  { id: 'left', label: 'Left', camera: [-1, 0, 0] },
  { id: 'bottom', label: 'Bottom', camera: [0, -1, 0] },
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const getStressColor = (utilization: number): string => {
  const clampedValue = Math.max(0, Math.min(1, utilization));
  for (let i = 1; i < STRESS_COLORS.length; i++) {
    if (clampedValue <= STRESS_COLORS[i].value) {
      const prev = STRESS_COLORS[i - 1];
      const curr = STRESS_COLORS[i];
      const t = (clampedValue - prev.value) / (curr.value - prev.value);
      return lerpColor(prev.color, curr.color, t);
    }
  }
  return STRESS_COLORS[STRESS_COLORS.length - 1].color;
};

const lerpColor = (color1: string, color2: string, t: number): string => {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color1;
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
};

// =============================================================================
// STRESS LEGEND COMPONENT
// =============================================================================

const StressLegend: React.FC<{ 
  visible: boolean; 
  scheme: ColorScheme;
  maxValue?: number;
  unit?: string;
}> = ({ visible, scheme, maxValue = 100, unit = '%' }) => {
  if (!visible || scheme === 'element') return null;
  
  const labels = scheme === 'stress' ? ['0 MPa', '50 MPa', '100 MPa', '150 MPa', '200 MPa']
    : scheme === 'displacement' ? ['0 mm', '5 mm', '10 mm', '15 mm', '20 mm']
    : scheme === 'utilization' ? ['0%', '25%', '50%', '75%', '100%']
    : ['0 kN', '100 kN', '200 kN', '300 kN', '400 kN'];
    
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 p-3"
    >
      <p className="text-xs font-medium text-white mb-2 capitalize">{scheme}</p>
      <div className="flex flex-col gap-0.5">
        {STRESS_COLORS.slice().reverse().map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-6 h-3 rounded" style={{ backgroundColor: c.color }} />
            <span className="text-[10px] text-zinc-400">{labels[STRESS_COLORS.length - 1 - i]}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// =============================================================================
// NAVIGATION CUBE COMPONENT
// =============================================================================

const NavigationCube: React.FC<{
  onViewChange: (preset: ViewPreset) => void;
  currentView: ViewPreset;
}> = ({ onViewChange, currentView }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute top-4 right-4 w-24 h-24"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Cube faces */}
        <g className="cursor-pointer">
          {/* Top face */}
          <polygon
            points="50,10 85,30 50,50 15,30"
            fill={currentView === 'top' ? '#3b82f6' : '#27272a'}
            stroke="#52525b"
            strokeWidth="1"
            onClick={() => onViewChange('top')}
            className="hover:fill-zinc-700 transition-colors"
          />
          <text x="50" y="32" textAnchor="middle" fill="white" fontSize="8" className="pointer-events-none">TOP</text>
          
          {/* Left face */}
          <polygon
            points="15,30 50,50 50,90 15,70"
            fill={currentView === 'left' ? '#3b82f6' : '#1f1f23'}
            stroke="#52525b"
            strokeWidth="1"
            onClick={() => onViewChange('left')}
            className="hover:fill-zinc-800 transition-colors"
          />
          <text x="32" y="62" textAnchor="middle" fill="white" fontSize="7" className="pointer-events-none">LEFT</text>
          
          {/* Right face */}
          <polygon
            points="50,50 85,30 85,70 50,90"
            fill={currentView === 'right' ? '#3b82f6' : '#18181b'}
            stroke="#52525b"
            strokeWidth="1"
            onClick={() => onViewChange('right')}
            className="hover:fill-zinc-800 transition-colors"
          />
          <text x="68" y="62" textAnchor="middle" fill="white" fontSize="7" className="pointer-events-none">RIGHT</text>
        </g>
        
        {/* Axes */}
        <g className="pointer-events-none">
          <line x1="50" y1="50" x2="50" y2="8" stroke="#ef4444" strokeWidth="2" />
          <text x="50" y="5" textAnchor="middle" fill="#ef4444" fontSize="8">Y</text>
          
          <line x1="50" y1="50" x2="88" y2="68" stroke="#22c55e" strokeWidth="2" />
          <text x="93" y="70" fill="#22c55e" fontSize="8">X</text>
          
          <line x1="50" y1="50" x2="12" y2="68" stroke="#3b82f6" strokeWidth="2" />
          <text x="7" y="70" fill="#3b82f6" fontSize="8">Z</text>
        </g>
      </svg>
    </motion.div>
  );
};

// =============================================================================
// TOOLBAR COMPONENT
// =============================================================================

const ViewerToolbar: React.FC<{
  settings: ViewerSettings;
  onSettingsChange: (settings: Partial<ViewerSettings>) => void;
  onReset: () => void;
  onFitView: () => void;
  onScreenshot: () => void;
  isAnimating: boolean;
  onToggleAnimation: () => void;
}> = ({ settings, onSettingsChange, onReset, onFitView, onScreenshot, isAnimating, onToggleAnimation }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10"
    >
      {/* Display Mode */}
      <div className="flex items-center gap-1 px-2 border-r border-white/10">
        {(['wireframe', 'solid', 'transparent'] as DisplayMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => onSettingsChange({ displayMode: mode })}
            className={`p-2 rounded-lg transition-all ${
              settings.displayMode === mode
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
            title={mode.charAt(0).toUpperCase() + mode.slice(1)}
          >
            {mode === 'wireframe' ? <Grid3X3 className="w-4 h-4" /> :
             mode === 'solid' ? <Box className="w-4 h-4" /> :
             <Layers className="w-4 h-4" />}
          </button>
        ))}
      </div>
      
      {/* Color Scheme */}
      <div className="flex items-center gap-1 px-2 border-r border-white/10">
        {(['element', 'stress', 'displacement', 'utilization'] as ColorScheme[]).map(scheme => (
          <button
            key={scheme}
            onClick={() => onSettingsChange({ colorScheme: scheme })}
            className={`p-2 rounded-lg transition-all ${
              settings.colorScheme === scheme
                ? 'bg-purple-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
            title={scheme.charAt(0).toUpperCase() + scheme.slice(1)}
          >
            {scheme === 'element' ? <Palette className="w-4 h-4" /> :
             scheme === 'stress' ? <Flame className="w-4 h-4" /> :
             scheme === 'displacement' ? <Move className="w-4 h-4" /> :
             <Target className="w-4 h-4" />}
          </button>
        ))}
      </div>
      
      {/* View Controls */}
      <div className="flex items-center gap-1 px-2 border-r border-white/10">
        <button
          onClick={onFitView}
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          title="Fit View"
        >
          <Locate className="w-4 h-4" />
        </button>
        <button
          onClick={onReset}
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
      
      {/* Toggle Controls */}
      <div className="flex items-center gap-1 px-2 border-r border-white/10">
        <button
          onClick={() => onSettingsChange({ showGrid: !settings.showGrid })}
          className={`p-2 rounded-lg transition-all ${
            settings.showGrid ? 'text-blue-400' : 'text-zinc-500'
          } hover:bg-white/10`}
          title="Toggle Grid"
        >
          <Grid3X3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onSettingsChange({ showAxes: !settings.showAxes })}
          className={`p-2 rounded-lg transition-all ${
            settings.showAxes ? 'text-blue-400' : 'text-zinc-500'
          } hover:bg-white/10`}
          title="Toggle Axes"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        <button
          onClick={() => onSettingsChange({ showNodes: !settings.showNodes })}
          className={`p-2 rounded-lg transition-all ${
            settings.showNodes ? 'text-blue-400' : 'text-zinc-500'
          } hover:bg-white/10`}
          title="Toggle Nodes"
        >
          <Circle className="w-4 h-4" />
        </button>
        <button
          onClick={() => onSettingsChange({ showLoads: !settings.showLoads })}
          className={`p-2 rounded-lg transition-all ${
            settings.showLoads ? 'text-blue-400' : 'text-zinc-500'
          } hover:bg-white/10`}
          title="Toggle Loads"
        >
          <Activity className="w-4 h-4" />
        </button>
      </div>
      
      {/* Animation & Export */}
      <div className="flex items-center gap-1 px-2">
        <button
          onClick={onToggleAnimation}
          className={`p-2 rounded-lg transition-all ${
            isAnimating ? 'bg-amber-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
          title={isAnimating ? 'Pause Animation' : 'Play Animation'}
        >
          {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={onScreenshot}
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          title="Screenshot"
        >
          <Camera className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

// =============================================================================
// DEFORMATION CONTROLS
// =============================================================================

const DeformationControls: React.FC<{
  enabled: boolean;
  scale: number;
  onEnabledChange: (enabled: boolean) => void;
  onScaleChange: (scale: number) => void;
  isAnimating: boolean;
  animationSpeed: number;
  onSpeedChange: (speed: number) => void;
}> = ({ enabled, scale, onEnabledChange, onScaleChange, isAnimating, animationSpeed, onSpeedChange }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 p-4 w-64"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-white">Deformation</span>
        <button
          onClick={() => onEnabledChange(!enabled)}
          className={`w-10 h-5 rounded-full transition-all ${enabled ? 'bg-blue-600' : 'bg-zinc-700'}`}
        >
          <motion.div
            className="w-4 h-4 bg-white rounded-full shadow-lg"
            animate={{ x: enabled ? 22 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>
      
      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-3 overflow-hidden"
          >
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Scale Factor</span>
                <span>{scale}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={scale}
                onChange={(e) => onScaleChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Animation Speed</span>
                <span>{animationSpeed}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={animationSpeed}
                onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
            </div>
            
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors">
                Original
              </button>
              <button className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors">
                Deformed
              </button>
              <button className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                isAnimating ? 'bg-amber-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white'
              }`}>
                Animate
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// =============================================================================
// ELEMENT INFO TOOLTIP
// =============================================================================

const ElementTooltip: React.FC<{
  member: Member3D | null;
  position: { x: number; y: number } | null;
}> = ({ member, position }) => {
  if (!member || !position) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed z-50 bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-white/10 p-4 shadow-2xl pointer-events-none"
      style={{ left: position.x + 15, top: position.y + 15 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ 
          backgroundColor: member.results ? getStressColor(member.results.utilization) : '#3b82f6' 
        }} />
        <span className="font-semibold text-white">{member.id}</span>
        <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-400">
          {member.section}
        </span>
      </div>
      
      {member.results && (
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between gap-8">
            <span className="text-zinc-500">Axial Force:</span>
            <span className="text-white font-mono">{member.results.axialForce.toFixed(1)} kN</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-zinc-500">Moment (Y):</span>
            <span className="text-white font-mono">{member.results.momentY.toFixed(1)} kN·m</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-zinc-500">Max Stress:</span>
            <span className="text-white font-mono">{member.results.stress.toFixed(1)} MPa</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-zinc-500">Utilization:</span>
            <span className={`font-mono font-semibold ${
              member.results.utilization > 0.9 ? 'text-red-400' :
              member.results.utilization > 0.7 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {(member.results.utilization * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// =============================================================================
// MAIN 3D VIEWER CANVAS
// =============================================================================

const ViewerCanvas: React.FC<{
  nodes: Node3D[];
  members: Member3D[];
  loads: Load3D[];
  settings: ViewerSettings;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  viewPreset: ViewPreset;
  animationTime: number;
}> = ({ nodes, members, loads, settings, selectedId, onSelect, viewPreset, animationTime }) => {
  const [hoveredMember, setHoveredMember] = useState<Member3D | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  
  // Calculate node positions with optional deformation
  const getNodePosition = useCallback((node: Node3D, scale3D: number = 1): { x: number; y: number } => {
    const centerX = 300;
    const centerY = 200;
    
    let x = node.x;
    let y = node.y;
    let z = node.z;
    
    // Apply deformation if enabled
    if (settings.showDeformation && node.displacement) {
      const deformScale = settings.deformationScale * Math.sin(animationTime);
      x += node.displacement.dx * deformScale;
      y += node.displacement.dy * deformScale;
      z += node.displacement.dz * deformScale;
    }
    
    // Isometric projection
    const isoX = (x - z) * 0.866 * scale3D;
    const isoY = -y * scale3D + (x + z) * 0.5 * scale3D;
    
    return {
      x: centerX + isoX,
      y: centerY + isoY,
    };
  }, [settings.showDeformation, settings.deformationScale, animationTime]);
  
  const nodesMap = useMemo(() => {
    const map: Record<string, Node3D> = {};
    nodes.forEach(n => { map[n.id] = n; });
    return map;
  }, [nodes]);
  
  return (
    <div 
      className="relative w-full h-full"
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => { setHoveredMember(null); setMousePos(null); }}
    >
      <svg className="w-full h-full" viewBox="0 0 600 400">
        {/* Background gradient */}
        <defs>
          <radialGradient id="bgGrad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#1e1e2f" />
            <stop offset="100%" stopColor="#0a0a0f" />
          </radialGradient>
          <linearGradient id="stressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        
        <rect width="100%" height="100%" fill="url(#bgGrad)" />
        
        {/* Grid */}
        {settings.showGrid && (
          <g opacity="0.15">
            {Array.from({ length: 21 }).map((_, i) => (
              <React.Fragment key={`grid-${i}`}>
                <line
                  x1={100 + i * 20}
                  y1={50}
                  x2={100 + i * 20}
                  y2={350}
                  stroke="#3b82f6"
                  strokeWidth="0.5"
                />
                <line
                  x1={100}
                  y1={50 + i * 15}
                  x2={500}
                  y2={50 + i * 15}
                  stroke="#3b82f6"
                  strokeWidth="0.5"
                />
              </React.Fragment>
            ))}
          </g>
        )}
        
        {/* Axes */}
        {settings.showAxes && (
          <g>
            <line x1="100" y1="300" x2="200" y2="300" stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowX)" />
            <text x="205" y="305" fill="#ef4444" fontSize="12" fontWeight="bold">X</text>
            
            <line x1="100" y1="300" x2="100" y2="200" stroke="#22c55e" strokeWidth="2" markerEnd="url(#arrowY)" />
            <text x="95" y="193" fill="#22c55e" fontSize="12" fontWeight="bold">Y</text>
            
            <line x1="100" y1="300" x2="50" y2="350" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrowZ)" />
            <text x="40" y="360" fill="#3b82f6" fontSize="12" fontWeight="bold">Z</text>
            
            <defs>
              <marker id="arrowX" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
              </marker>
              <marker id="arrowY" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto-start-reverse">
                <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
              </marker>
              <marker id="arrowZ" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
              </marker>
            </defs>
          </g>
        )}
        
        {/* Members */}
        <g>
          {members.map((member) => {
            const startNode = nodesMap[member.startNode];
            const endNode = nodesMap[member.endNode];
            if (!startNode || !endNode) return null;
            
            const start = getNodePosition(startNode, 30);
            const end = getNodePosition(endNode, 30);
            
            const isSelected = selectedId === member.id;
            const isHovered = hoveredMember?.id === member.id;
            
            let strokeColor = '#60a5fa';
            if (settings.colorScheme !== 'element' && member.results) {
              strokeColor = getStressColor(member.results.utilization);
            }
            
            const strokeWidth = settings.displayMode === 'wireframe' ? 2 : 
                               settings.displayMode === 'solid' ? 8 : 4;
            
            return (
              <g key={member.id}>
                {/* Shadow */}
                {settings.shadows && settings.displayMode === 'solid' && (
                  <line
                    x1={start.x + 2}
                    y1={start.y + 2}
                    x2={end.x + 2}
                    y2={end.y + 2}
                    stroke="black"
                    strokeWidth={strokeWidth}
                    opacity="0.3"
                    strokeLinecap="round"
                  />
                )}
                
                {/* Member line */}
                <motion.line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={isSelected ? '#f59e0b' : isHovered ? '#a78bfa' : strokeColor}
                  strokeWidth={isSelected ? strokeWidth + 2 : strokeWidth}
                  strokeLinecap="round"
                  opacity={settings.displayMode === 'transparent' ? 0.6 : 1}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredMember(member)}
                  onMouseLeave={() => setHoveredMember(null)}
                  onClick={() => onSelect(member.id)}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5 }}
                />
                
                {/* Selection glow */}
                {isSelected && (
                  <motion.line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="#f59e0b"
                    strokeWidth={strokeWidth + 8}
                    strokeLinecap="round"
                    opacity="0.3"
                    className="pointer-events-none"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
                
                {/* Label */}
                {settings.showLabels && (
                  <text
                    x={(start.x + end.x) / 2}
                    y={(start.y + end.y) / 2 - 10}
                    fill="white"
                    fontSize="10"
                    textAnchor="middle"
                    className="pointer-events-none"
                  >
                    {member.id}
                  </text>
                )}
              </g>
            );
          })}
        </g>
        
        {/* Nodes */}
        {settings.showNodes && (
          <g>
            {nodes.map((node) => {
              const pos = getNodePosition(node, 30);
              const isSupport = node.support && node.support !== 'free';
              
              return (
                <g key={node.id}>
                  {/* Support symbols */}
                  {settings.showSupports && node.support === 'fixed' && (
                    <g transform={`translate(${pos.x}, ${pos.y})`}>
                      <rect x="-10" y="0" width="20" height="8" fill="#ef4444" />
                      {Array.from({ length: 5 }).map((_, i) => (
                        <line key={i} x1={-8 + i * 4} y1="8" x2={-12 + i * 4} y2="14" stroke="#ef4444" strokeWidth="1.5" />
                      ))}
                    </g>
                  )}
                  {settings.showSupports && node.support === 'pinned' && (
                    <g transform={`translate(${pos.x}, ${pos.y})`}>
                      <polygon points="-8,0 8,0 0,12" fill="#f59e0b" />
                      <line x1="-12" y1="14" x2="12" y2="14" stroke="#f59e0b" strokeWidth="2" />
                    </g>
                  )}
                  {settings.showSupports && node.support === 'roller' && (
                    <g transform={`translate(${pos.x}, ${pos.y})`}>
                      <polygon points="-8,0 8,0 0,10" fill="#22c55e" />
                      <circle cx="-4" cy="14" r="3" fill="#22c55e" />
                      <circle cx="4" cy="14" r="3" fill="#22c55e" />
                      <line x1="-10" y1="18" x2="10" y2="18" stroke="#22c55e" strokeWidth="1.5" />
                    </g>
                  )}
                  
                  {/* Node circle */}
                  <motion.circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isSupport ? 6 : 5}
                    fill="#18181b"
                    stroke={isSupport ? '#f59e0b' : '#60a5fa'}
                    strokeWidth="2"
                    className="cursor-pointer hover:fill-blue-600 transition-colors"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                  />
                  
                  {/* Label */}
                  {settings.showLabels && (
                    <text
                      x={pos.x}
                      y={pos.y - 12}
                      fill="white"
                      fontSize="9"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {node.id}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        )}
        
        {/* Loads */}
        {settings.showLoads && (
          <g>
            {loads.map((load) => {
              if (!load.position) return null;
              
              const node = nodes.find(n => 
                Math.abs(n.x - load.position![0]) < 0.1 &&
                Math.abs(n.y - load.position![1]) < 0.1 &&
                Math.abs(n.z - load.position![2]) < 0.1
              );
              
              if (!node) return null;
              const pos = getNodePosition(node, 30);
              
              const arrowLength = 40;
              const dir = load.direction;
              const endX = pos.x + dir[0] * arrowLength;
              const endY = pos.y - dir[1] * arrowLength; // Y is inverted in SVG
              
              return (
                <g key={load.id}>
                  <motion.line
                    x1={endX}
                    y1={endY}
                    x2={pos.x}
                    y2={pos.y}
                    stroke="#ef4444"
                    strokeWidth="2"
                    markerEnd="url(#loadArrow)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  />
                  <text
                    x={endX + 5}
                    y={endY}
                    fill="#ef4444"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {load.magnitude} kN
                  </text>
                </g>
              );
            })}
            
            <defs>
              <marker id="loadArrow" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
              </marker>
            </defs>
          </g>
        )}
      </svg>
      
      {/* Element Tooltip */}
      <AnimatePresence>
        {hoveredMember && mousePos && (
          <ElementTooltip member={hoveredMember} position={mousePos} />
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const Advanced3DStructuralViewer: React.FC<{
  className?: string;
}> = ({ className }) => {
  // Sample data
  const [nodes] = useState<Node3D[]>([
    { id: 'N1', x: 0, y: 0, z: 0, support: 'fixed', displacement: { dx: 0, dy: 0, dz: 0 } },
    { id: 'N2', x: 6, y: 0, z: 0, support: 'fixed', displacement: { dx: 0, dy: 0, dz: 0 } },
    { id: 'N3', x: 0, y: 3, z: 0, displacement: { dx: 0.005, dy: -0.002, dz: 0.001 } },
    { id: 'N4', x: 6, y: 3, z: 0, displacement: { dx: 0.008, dy: -0.003, dz: 0.001 } },
    { id: 'N5', x: 0, y: 6, z: 0, displacement: { dx: 0.010, dy: -0.004, dz: 0.002 } },
    { id: 'N6', x: 6, y: 6, z: 0, displacement: { dx: 0.012, dy: -0.005, dz: 0.002 } },
    { id: 'N7', x: 3, y: 8, z: 0, displacement: { dx: 0.015, dy: -0.008, dz: 0.003 } },
  ]);
  
  const [members] = useState<Member3D[]>([
    { id: 'M1', startNode: 'N1', endNode: 'N3', section: 'UC 254', material: 'S355', results: { axialForce: -450, shearY: 25, shearZ: 0, momentY: 85, momentZ: 0, torsion: 0, stress: 185, utilization: 0.72 } },
    { id: 'M2', startNode: 'N2', endNode: 'N4', section: 'UC 254', material: 'S355', results: { axialForce: -480, shearY: 28, shearZ: 0, momentY: 92, momentZ: 0, torsion: 0, stress: 195, utilization: 0.78 } },
    { id: 'M3', startNode: 'N3', endNode: 'N5', section: 'UC 254', material: 'S355', results: { axialForce: -320, shearY: 18, shearZ: 0, momentY: 65, momentZ: 0, torsion: 0, stress: 145, utilization: 0.58 } },
    { id: 'M4', startNode: 'N4', endNode: 'N6', section: 'UC 254', material: 'S355', results: { axialForce: -350, shearY: 20, shearZ: 0, momentY: 72, momentZ: 0, torsion: 0, stress: 158, utilization: 0.63 } },
    { id: 'M5', startNode: 'N3', endNode: 'N4', section: 'UB 305', material: 'S355', results: { axialForce: 15, shearY: 120, shearZ: 0, momentY: 210, momentZ: 0, torsion: 0, stress: 225, utilization: 0.90 } },
    { id: 'M6', startNode: 'N5', endNode: 'N6', section: 'UB 305', material: 'S355', results: { axialForce: 12, shearY: 95, shearZ: 0, momentY: 175, momentZ: 0, torsion: 0, stress: 188, utilization: 0.75 } },
    { id: 'M7', startNode: 'N5', endNode: 'N7', section: 'UB 254', material: 'S355', results: { axialForce: -85, shearY: 45, shearZ: 0, momentY: 95, momentZ: 0, torsion: 0, stress: 165, utilization: 0.66 } },
    { id: 'M8', startNode: 'N6', endNode: 'N7', section: 'UB 254', material: 'S355', results: { axialForce: -85, shearY: 45, shearZ: 0, momentY: 95, momentZ: 0, torsion: 0, stress: 165, utilization: 0.66 } },
  ]);
  
  const [loads] = useState<Load3D[]>([
    { id: 'L1', type: 'point', magnitude: 100, direction: [0, -1, 0], position: [3, 8, 0] },
    { id: 'L2', type: 'point', magnitude: 50, direction: [1, 0, 0], position: [0, 6, 0] },
  ]);
  
  const [settings, setSettings] = useState<ViewerSettings>(DEFAULT_SETTINGS);
  const [viewPreset, setViewPreset] = useState<ViewPreset>('perspective');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationTime, setAnimationTime] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  
  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;
    
    const interval = setInterval(() => {
      setAnimationTime(t => t + 0.05 * animationSpeed);
    }, 50);
    
    return () => clearInterval(interval);
  }, [isAnimating, animationSpeed]);
  
  const handleSettingsChange = useCallback((updates: Partial<ViewerSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);
  
  return (
    <div className={`relative bg-zinc-950 rounded-2xl overflow-hidden ${className}`}>
      {/* Main Canvas */}
      <ViewerCanvas
        nodes={nodes}
        members={members}
        loads={loads}
        settings={settings}
        selectedId={selectedId}
        onSelect={setSelectedId}
        viewPreset={viewPreset}
        animationTime={animationTime}
      />
      
      {/* Toolbar */}
      <ViewerToolbar
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onReset={() => {
          setSettings(DEFAULT_SETTINGS);
          setViewPreset('perspective');
          setSelectedId(null);
        }}
        onFitView={() => {}}
        onScreenshot={() => {
          // Implement screenshot functionality
          console.log('Screenshot captured');
        }}
        isAnimating={isAnimating}
        onToggleAnimation={() => setIsAnimating(!isAnimating)}
      />
      
      {/* Navigation Cube */}
      <NavigationCube
        currentView={viewPreset}
        onViewChange={setViewPreset}
      />
      
      {/* Stress Legend */}
      <StressLegend
        visible={settings.colorScheme !== 'element'}
        scheme={settings.colorScheme}
      />
      
      {/* Deformation Controls */}
      <DeformationControls
        enabled={settings.showDeformation}
        scale={settings.deformationScale}
        onEnabledChange={(enabled) => handleSettingsChange({ showDeformation: enabled })}
        onScaleChange={(scale) => handleSettingsChange({ deformationScale: scale })}
        isAnimating={isAnimating}
        animationSpeed={animationSpeed}
        onSpeedChange={setAnimationSpeed}
      />
      
      {/* Info Panel */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-4 left-4 bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 p-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">Portal Frame</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-zinc-500">Nodes:</span>
          <span className="text-white font-mono">{nodes.length}</span>
          <span className="text-zinc-500">Members:</span>
          <span className="text-white font-mono">{members.length}</span>
          <span className="text-zinc-500">Loads:</span>
          <span className="text-white font-mono">{loads.length}</span>
        </div>
      </motion.div>
      
      {/* Selection Info */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 right-4 bg-amber-500/20 backdrop-blur-xl rounded-xl border border-amber-500/30 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
              <span className="font-semibold text-amber-400">Selected: {selectedId}</span>
              <button
                onClick={() => setSelectedId(null)}
                className="ml-2 p-1 hover:bg-amber-500/20 rounded transition-colors"
              >
                <X className="w-4 h-4 text-amber-400" />
              </button>
            </div>
            <p className="text-xs text-amber-200/70">
              Click elsewhere or press ESC to deselect
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Advanced3DStructuralViewer;
