/**
 * StatusBar.tsx - Professional Status Bar (STAAD.Pro/SkyCiv Style)
 * 
 * Enterprise-grade status bar with:
 * - Analysis progress and status indicators
 * - Model statistics (nodes, members, loads)
 * - Coordinate display (cursor position)
 * - Unit system selector
 * - Zoom level indicator
 * - Memory/performance metrics
 * - Quick toggles (snap, grid, ortho)
 * - Notifications area
 */

import React from 'react';
import { FC, useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle2, Circle, Clock, Cpu,
  Crosshair, Database, FileText, Grid, HardDrive, Info, Layers, Loader2,
  Lock, Magnet, MousePointer2, Move, Play, Settings, Square, Target,
  ToggleLeft, ToggleRight, XCircle, Zap, Maximize2, ZoomIn, Globe,
  Ruler, RotateCw, Eye, Compass
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

type AnalysisStatus = 'idle' | 'running' | 'completed' | 'error' | 'warning';
type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface Coordinates {
  x: number;
  y: number;
  z: number;
}

interface ModelStatistics {
  nodes: number;
  members: number;
  plates: number;
  loads: number;
  loadCases: number;
  supports: number;
}

interface AnalysisProgress {
  status: AnalysisStatus;
  progress: number; // 0-100
  currentStep?: string;
  elapsedTime?: number; // seconds
  estimatedTime?: number; // seconds
  warnings?: number;
  errors?: number;
}

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: Date;
  persistent?: boolean;
}

interface QuickToggle {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ElementType;
  activeIcon?: React.ElementType;
  enabled: boolean;
}

interface UnitSystem {
  id: string;
  label: string;
  length: string;
  force: string;
  moment: string;
}

interface StatusBarProps {
  // Model data
  modelStats?: ModelStatistics;
  cursorCoordinates?: Coordinates;
  
  // Analysis state
  analysisProgress?: AnalysisProgress;
  lastAnalysisTime?: Date;
  
  // Display settings
  zoomLevel?: number;
  unitSystem?: string;
  
  // Quick toggles state
  gridEnabled?: boolean;
  snapEnabled?: boolean;
  orthoEnabled?: boolean;
  
  // Notifications
  notifications?: Notification[];
  
  // Callbacks
  onToggleGrid?: () => void;
  onToggleSnap?: () => void;
  onToggleOrtho?: () => void;
  onUnitSystemChange?: (unitId: string) => void;
  onZoomChange?: (zoom: number) => void;
  onCoordinateClick?: () => void;
  onNotificationDismiss?: (id: string) => void;
  onAnalysisClick?: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const UNIT_SYSTEMS: UnitSystem[] = [
  { id: 'si-metric', label: 'SI Metric', length: 'm', force: 'kN', moment: 'kN·m' },
  { id: 'si-mm', label: 'SI (mm)', length: 'mm', force: 'N', moment: 'N·mm' },
  { id: 'imperial', label: 'Imperial', length: 'ft', force: 'kip', moment: 'kip·ft' },
  { id: 'mks', label: 'MKS', length: 'm', force: 'kgf', moment: 'kgf·m' },
];

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 400];

// ============================================
// STATUS INDICATOR COMPONENT
// ============================================

const StatusIndicator: FC<{
  status: AnalysisStatus;
  progress?: number;
  currentStep?: string;
  onClick?: () => void;
}> = memo(({ status, progress = 0, currentStep, onClick }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'running':
        return {
          icon: Loader2,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/20',
          label: currentStep || 'Analyzing...',
          animate: true
        };
      case 'completed':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/20',
          label: 'Analysis Complete',
          animate: false
        };
      case 'error':
        return {
          icon: XCircle,
          color: 'text-red-400',
          bgColor: 'bg-red-500/20',
          label: 'Analysis Failed',
          animate: false
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/20',
          label: 'Completed with Warnings',
          animate: false
        };
      default:
        return {
          icon: Circle,
          color: 'text-[#869ab8]',
          bgColor: 'bg-slate-500/20',
          label: 'Ready',
          animate: false
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <button type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-2 py-1 rounded ${config.bgColor} hover:opacity-80 transition-opacity`}
    >
      <Icon 
        className={`w-3.5 h-3.5 ${config.color} ${config.animate ? 'animate-spin' : ''}`} 
      />
      <span className={`text-xs font-medium tracking-wide tracking-wide ${config.color}`}>
        {config.label}
      </span>
      {status === 'running' && progress > 0 && (
        <span className="text-xs text-[#869ab8]">
          {progress.toFixed(0)}%
        </span>
      )}
    </button>
  );
});

StatusIndicator.displayName = 'StatusIndicator';

// ============================================
// COORDINATE DISPLAY
// ============================================

const CoordinateDisplay: FC<{
  coordinates: Coordinates;
  unit: string;
  onClick?: () => void;
}> = memo(({ coordinates, unit, onClick }) => (
  <button type="button"
    onClick={onClick}
    className="flex items-center gap-2 px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
    title="Click to input coordinates"
  >
    <Crosshair className="w-3.5 h-3.5 text-[#869ab8]" />
    <div className="flex items-center gap-1.5 text-xs font-mono">
      <span className="text-red-400">X:</span>
      <span className="text-slate-600 dark:text-slate-300 w-16 text-right">{coordinates.x.toFixed(3)}</span>
      <span className="text-emerald-400">Y:</span>
      <span className="text-slate-600 dark:text-slate-300 w-16 text-right">{coordinates.y.toFixed(3)}</span>
      <span className="text-blue-400">Z:</span>
      <span className="text-slate-600 dark:text-slate-300 w-16 text-right">{coordinates.z.toFixed(3)}</span>
      <span className="text-[#869ab8] text-[10px]">{unit}</span>
    </div>
  </button>
));

CoordinateDisplay.displayName = 'CoordinateDisplay';

// ============================================
// MODEL STATS DISPLAY
// ============================================

const ModelStatsDisplay: FC<{ stats: ModelStatistics }> = memo(({ stats }) => (
  <div className="flex items-center gap-3 text-xs text-[#869ab8]">
    <div className="flex items-center gap-1" title="Nodes">
      <Circle className="w-3 h-3" />
      <span>{stats.nodes}</span>
    </div>
    <div className="flex items-center gap-1" title="Members">
      <Layers className="w-3 h-3" />
      <span>{stats.members}</span>
    </div>
    {stats.plates > 0 && (
      <div className="flex items-center gap-1" title="Plates">
        <Square className="w-3 h-3" />
        <span>{stats.plates}</span>
      </div>
    )}
    <div className="flex items-center gap-1" title="Loads">
      <Zap className="w-3 h-3" />
      <span>{stats.loads}</span>
    </div>
    <div className="flex items-center gap-1" title="Load Cases">
      <FileText className="w-3 h-3" />
      <span>{stats.loadCases}</span>
    </div>
  </div>
));

ModelStatsDisplay.displayName = 'ModelStatsDisplay';

// ============================================
// QUICK TOGGLE BUTTON
// ============================================

const QuickToggleButton: FC<{
  toggle: QuickToggle;
  onToggle: () => void;
}> = memo(({ toggle, onToggle }) => {
  const Icon = toggle.enabled && toggle.activeIcon ? toggle.activeIcon : toggle.icon;
  
  return (
    <button type="button"
      onClick={onToggle}
      className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs transition-all ${
        toggle.enabled
          ? 'bg-blue-500/30 text-blue-300'
          : 'text-[#869ab8] hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
      }`}
      title={`${toggle.label}${toggle.shortcut ? ` (${toggle.shortcut})` : ''}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{toggle.label}</span>
    </button>
  );
});

QuickToggleButton.displayName = 'QuickToggleButton';

// ============================================
// UNIT SYSTEM SELECTOR
// ============================================

const UnitSystemSelector: FC<{
  currentUnit: string;
  onChange: (unitId: string) => void;
}> = memo(({ currentUnit, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentSystem = UNIT_SYSTEMS.find(u => u.id === currentUnit) || UNIT_SYSTEMS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
      >
        <Ruler className="w-3.5 h-3.5" />
        <span>{currentSystem.length} / {currentSystem.force}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full left-0 mb-1 w-48 bg-[#0b1326] border border-[#1a2333] rounded-lg shadow-xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-[#1a2333] text-xs font-semibold text-[#869ab8] uppercase tracking-wider">
              Unit System
            </div>
            {UNIT_SYSTEMS.map(system => (
              <button type="button"
                key={system.id}
                onClick={() => {
                  onChange(system.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${
                  system.id === currentUnit ? 'bg-blue-500/20 text-blue-300' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <span>{system.label}</span>
                <span className="text-[#869ab8]">{system.length}, {system.force}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

UnitSystemSelector.displayName = 'UnitSystemSelector';

// ============================================
// ZOOM SELECTOR
// ============================================

const ZoomSelector: FC<{
  zoom: number;
  onChange: (zoom: number) => void;
}> = memo(({ zoom, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors min-w-[60px] justify-center"
      >
        <ZoomIn className="w-3.5 h-3.5" />
        <span>{zoom}%</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-24 bg-[#0b1326] border border-[#1a2333] rounded-lg shadow-xl overflow-hidden"
          >
            {ZOOM_PRESETS.map(preset => (
              <button type="button"
                key={preset}
                onClick={() => {
                  onChange(preset);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-xs text-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${
                  preset === zoom ? 'bg-blue-500/20 text-blue-300' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {preset}%
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ZoomSelector.displayName = 'ZoomSelector';

// ============================================
// NOTIFICATION BADGE
// ============================================

const NotificationBadge: FC<{
  notifications: Notification[];
  onDismiss: (id: string) => void;
}> = memo(({ notifications, onDismiss }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const warningCount = notifications.filter(n => n.type === 'warning').length;
  const errorCount = notifications.filter(n => n.type === 'error').length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (notifications.length === 0) return null;

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'error': return XCircle;
      case 'warning': return AlertTriangle;
      case 'success': return CheckCircle2;
      default: return Info;
    }
  };

  const getColor = (type: NotificationType) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-amber-400';
      case 'success': return 'text-emerald-400';
      default: return 'text-blue-400';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
      >
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <XCircle className="w-3.5 h-3.5" />
            <span className="text-xs">{errorCount}</span>
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-xs">{warningCount}</span>
          </span>
        )}
        {errorCount === 0 && warningCount === 0 && (
          <span className="flex items-center gap-1 text-blue-400">
            <Info className="w-3.5 h-3.5" />
            <span className="text-xs">{notifications.length}</span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full right-0 mb-1 w-80 max-h-64 overflow-auto bg-[#0b1326] border border-[#1a2333] rounded-lg shadow-xl"
          >
            <div className="px-3 py-2 border-b border-[#1a2333] text-xs font-semibold text-[#869ab8] uppercase tracking-wider">
              Notifications
            </div>
            {notifications.map(notification => {
              const Icon = getIcon(notification.type);
              return (
                <div
                  key={notification.id}
                  className="flex items-start gap-2 px-3 py-2 border-b border-[#1a2333] last:border-0 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                >
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${getColor(notification.type)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-600 dark:text-slate-300">{notification.message}</p>
                    <p className="text-[10px] text-[#869ab8] mt-0.5">
                      {notification.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  {!notification.persistent && (
                    <button type="button"
                      onClick={() => onDismiss(notification.id)}
                      className="text-[#869ab8] hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

NotificationBadge.displayName = 'NotificationBadge';

// ============================================
// PERFORMANCE INDICATOR
// ============================================

const PerformanceIndicator: FC = memo(() => {
  const [memory, setMemory] = useState<number>(0);
  const [fps, setFps] = useState<number>(60);

  useEffect(() => {
    const updatePerformance = () => {
      // Memory usage (if available)
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        const usedMB = Math.round(memInfo.usedJSHeapSize / 1024 / 1024);
        setMemory(usedMB);
      }
    };

    // FPS counter
    let frameCount = 0;
    let lastTime = performance.now();
    const measureFps = () => {
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = currentTime;
      }
      requestAnimationFrame(measureFps);
    };
    const animationId = requestAnimationFrame(measureFps);

    const interval = setInterval(updatePerformance, 5000);
    updatePerformance();

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-[#869ab8]">
      <div className="flex items-center gap-1" title="FPS">
        <Activity className="w-3 h-3" />
        <span className={fps < 30 ? 'text-amber-400' : fps < 15 ? 'text-red-400' : ''}>
          {fps}
        </span>
      </div>
      {memory > 0 && (
        <div className="flex items-center gap-1" title="Memory Usage">
          <HardDrive className="w-3 h-3" />
          <span>{memory}MB</span>
        </div>
      )}
    </div>
  );
});

PerformanceIndicator.displayName = 'PerformanceIndicator';

// ============================================
// MAIN STATUS BAR COMPONENT
// ============================================

export const StatusBar: FC<StatusBarProps> = ({
  modelStats = { nodes: 0, members: 0, plates: 0, loads: 0, loadCases: 0, supports: 0 },
  cursorCoordinates = { x: 0, y: 0, z: 0 },
  analysisProgress = { status: 'idle', progress: 0 },
  zoomLevel = 100,
  unitSystem = 'si-metric',
  gridEnabled = true,
  snapEnabled = true,
  orthoEnabled = false,
  notifications = [],
  onToggleGrid,
  onToggleSnap,
  onToggleOrtho,
  onUnitSystemChange,
  onZoomChange,
  onCoordinateClick,
  onNotificationDismiss,
  onAnalysisClick
}) => {
  const currentUnitSystem = UNIT_SYSTEMS.find(u => u.id === unitSystem) || UNIT_SYSTEMS[0];

  const quickToggles: QuickToggle[] = [
    { 
      id: 'grid', 
      label: 'Grid', 
      shortcut: 'G', 
      icon: Grid, 
      enabled: gridEnabled 
    },
    { 
      id: 'snap', 
      label: 'Snap', 
      shortcut: 'S', 
      icon: Magnet, 
      enabled: snapEnabled 
    },
    { 
      id: 'ortho', 
      label: 'Ortho', 
      shortcut: 'O', 
      icon: Move, 
      enabled: orthoEnabled 
    },
  ];

  const handleToggle = (toggleId: string) => {
    switch (toggleId) {
      case 'grid':
        onToggleGrid?.();
        break;
      case 'snap':
        onToggleSnap?.();
        break;
      case 'ortho':
        onToggleOrtho?.();
        break;
    }
  };

  return (
    <div className="h-6 bg-[#0b1326] border-t border-[#1a2333] flex items-center justify-between px-2 text-xs select-none">
      {/* Left Section - Status & Model Stats */}
      <div className="flex items-center gap-3">
        <StatusIndicator
          status={analysisProgress.status}
          progress={analysisProgress.progress}
          currentStep={analysisProgress.currentStep}
          onClick={onAnalysisClick}
        />
        
        <div className="h-4 w-px bg-[#131b2e]" />
        
        <ModelStatsDisplay stats={modelStats} />
      </div>

      {/* Center Section - Coordinates */}
      <div className="flex items-center">
        <CoordinateDisplay
          coordinates={cursorCoordinates}
          unit={currentUnitSystem.length}
          onClick={onCoordinateClick}
        />
      </div>

      {/* Right Section - Controls & Settings */}
      <div className="flex items-center gap-2">
        {/* Quick Toggles */}
        <div className="flex items-center gap-1">
          {quickToggles.map(toggle => (
            <QuickToggleButton
              key={toggle.id}
              toggle={toggle}
              onToggle={() => handleToggle(toggle.id)}
            />
          ))}
        </div>

        <div className="h-4 w-px bg-[#131b2e]" />

        {/* Unit System */}
        <UnitSystemSelector
          currentUnit={unitSystem}
          onChange={onUnitSystemChange || (() => {})}
        />

        {/* Zoom */}
        <ZoomSelector
          zoom={zoomLevel}
          onChange={onZoomChange || (() => {})}
        />

        <div className="h-4 w-px bg-[#131b2e]" />

        {/* Notifications */}
        <NotificationBadge
          notifications={notifications}
          onDismiss={onNotificationDismiss || (() => {})}
        />

        {/* Performance */}
        <PerformanceIndicator />
      </div>
    </div>
  );
};

// ============================================
// EXTENDED STATUS BAR (With Analysis Panel)
// ============================================

export const ExtendedStatusBar: FC<StatusBarProps & {
  showAnalysisPanel?: boolean;
  onToggleAnalysisPanel?: () => void;
}> = (props) => {
  const { showAnalysisPanel, onToggleAnalysisPanel, analysisProgress, ...statusBarProps } = props;

  return (
    <div className="flex flex-col">
      {/* Analysis Progress Panel (when running) */}
      <AnimatePresence>
        {showAnalysisPanel && analysisProgress?.status === 'running' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#0b1326] border-t border-[#1a2333] overflow-hidden"
          >
            <div className="px-4 py-2 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium tracking-wide tracking-wide">
                    {analysisProgress.currentStep || 'Running analysis...'}
                  </span>
                  <span className="text-xs text-[#869ab8]">
                    {analysisProgress.progress?.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#131b2e] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${analysisProgress.progress || 0}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
              {analysisProgress.elapsedTime !== undefined && (
                <div className="flex items-center gap-1 text-xs text-[#869ab8]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{Math.floor(analysisProgress.elapsedTime)}s</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Status Bar */}
      <StatusBar {...statusBarProps} analysisProgress={analysisProgress} />
    </div>
  );
};

export default StatusBar;
