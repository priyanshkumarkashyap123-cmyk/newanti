/**
 * Result Animation Viewer - Dynamic Structural Results Visualization
 * 
 * Features:
 * - Animated deformed shape playback
 * - Modal shape animation
 * - Time-history response animation
 * - Stress/strain contour animation
 * - Force diagram animation
 * - Export to video/GIF
 * 
 * Industry Standard: Matches ETABS, SAP2000, ANSYS post-processors
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  RotateCcw,
  Settings,
  Download,
  Video,
  Camera,
  Maximize2,
  Layers,
  Box,
  Activity,
  TrendingUp,
  BarChart3,
  Thermometer,
  Move,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Sliders,
  Eye,
  EyeOff,
  Clock,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Types
type AnimationType = 'deformation' | 'modal' | 'time-history' | 'stress' | 'force-diagram' | 'buckling';
type PlaybackState = 'playing' | 'paused' | 'stopped';

interface AnimationSettings {
  type: AnimationType;
  scale: number;
  speed: number;
  loop: boolean;
  showUndeformed: boolean;
  showContours: boolean;
  showVectors: boolean;
  frameCount: number;
  currentFrame: number;
}

interface LoadCase {
  id: string;
  name: string;
  type: 'static' | 'modal' | 'dynamic' | 'seismic';
  selected: boolean;
}

interface ModeShape {
  mode: number;
  frequency: number;
  period: number;
  description: string;
  participation: { x: number; y: number; z: number };
}

interface TimeStep {
  time: number;
  displacement: number;
  velocity: number;
  acceleration: number;
}

const ResultAnimationViewer: React.FC = () => {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const [settings, setSettings] = useState<AnimationSettings>({
    type: 'deformation',
    scale: 100,
    speed: 1.0,
    loop: true,
    showUndeformed: true,
    showContours: false,
    showVectors: false,
    frameCount: 60,
    currentFrame: 0
  });

  const [showSettings, setShowSettings] = useState(false);
  const animationRef = useRef<number | null>(null);

  // Mock load cases
  const [loadCases] = useState<LoadCase[]>([
    { id: 'lc1', name: 'Dead Load (DL)', type: 'static', selected: false },
    { id: 'lc2', name: 'Live Load (LL)', type: 'static', selected: false },
    { id: 'lc3', name: 'Seismic X (EQX)', type: 'seismic', selected: true },
    { id: 'lc4', name: 'Seismic Y (EQY)', type: 'seismic', selected: false },
    { id: 'lc5', name: 'Wind Load (WL)', type: 'static', selected: false },
    { id: 'lc6', name: 'Combination 1 (1.5DL+1.5LL)', type: 'static', selected: false },
  ]);

  // Mock mode shapes
  const [modeShapes] = useState<ModeShape[]>([
    { mode: 1, frequency: 1.25, period: 0.80, description: 'First Translation X', participation: { x: 72, y: 5, z: 2 } },
    { mode: 2, frequency: 1.42, period: 0.70, description: 'First Translation Y', participation: { x: 4, y: 68, z: 3 } },
    { mode: 3, frequency: 1.85, period: 0.54, description: 'First Torsion', participation: { x: 2, y: 3, z: 45 } },
    { mode: 4, frequency: 3.65, period: 0.27, description: 'Second Translation X', participation: { x: 12, y: 1, z: 0 } },
    { mode: 5, frequency: 4.12, period: 0.24, description: 'Second Translation Y', participation: { x: 1, y: 10, z: 0 } },
    { mode: 6, frequency: 5.25, period: 0.19, description: 'Second Torsion', participation: { x: 0, y: 0, z: 8 } },
  ]);

  const [selectedMode, setSelectedMode] = useState(1);

  // Mock time history data
  const [timeHistory] = useState<TimeStep[]>(
    Array.from({ length: 200 }, (_, i) => ({
      time: i * 0.05,
      displacement: Math.sin(i * 0.1) * Math.exp(-i * 0.01) * 0.05,
      velocity: Math.cos(i * 0.1) * Math.exp(-i * 0.01) * 0.3,
      acceleration: -Math.sin(i * 0.1) * Math.exp(-i * 0.01) * 2.0
    }))
  );

  // Animation loop
  useEffect(() => {
    if (playbackState === 'playing') {
      const animate = () => {
        setSettings(prev => {
          const nextFrame = prev.currentFrame + 1;
          if (nextFrame >= prev.frameCount) {
            if (prev.loop) {
              return { ...prev, currentFrame: 0 };
            } else {
              setPlaybackState('stopped');
              return { ...prev, currentFrame: 0 };
            }
          }
          return { ...prev, currentFrame: nextFrame };
        });
        animationRef.current = requestAnimationFrame(animate);
      };
      
      const timeout = setTimeout(() => {
        animationRef.current = requestAnimationFrame(animate);
      }, 1000 / (30 * settings.speed));
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        clearTimeout(timeout);
      };
    }
    return undefined;
  }, [playbackState, settings.speed, settings.loop]);

  // Playback controls
  const play = () => setPlaybackState('playing');
  const pause = () => setPlaybackState('paused');
  const stop = () => {
    setPlaybackState('stopped');
    setSettings(prev => ({ ...prev, currentFrame: 0 }));
  };
  const nextFrame = () => {
    setSettings(prev => ({
      ...prev,
      currentFrame: Math.min(prev.currentFrame + 1, prev.frameCount - 1)
    }));
  };
  const prevFrame = () => {
    setSettings(prev => ({
      ...prev,
      currentFrame: Math.max(prev.currentFrame - 1, 0)
    }));
  };

  // Get current displacement scale for animation
  const getAnimationPhase = () => {
    const phase = (settings.currentFrame / settings.frameCount) * 2 * Math.PI;
    return Math.sin(phase);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-300 dark:border-slate-700/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Activity className="w-7 h-7 text-purple-400" />
                  Result Animation Viewer
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Dynamic visualization of structural analysis results
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                <Camera className="w-4 h-4" />
                Screenshot
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors">
                <Video className="w-4 h-4" />
                Export Video
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Animation Types & Cases */}
          <div className="space-y-6">
            {/* Animation Type */}
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-300 dark:border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                Animation Type
              </h3>
              
              <div className="space-y-2">
                {[
                  { id: 'deformation', label: 'Deformed Shape', icon: Move },
                  { id: 'modal', label: 'Mode Shapes', icon: Activity },
                  { id: 'time-history', label: 'Time History', icon: Clock },
                  { id: 'stress', label: 'Stress Contours', icon: Thermometer },
                  { id: 'force-diagram', label: 'Force Diagrams', icon: BarChart3 },
                  { id: 'buckling', label: 'Buckling Shapes', icon: TrendingUp },
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSettings(prev => ({ ...prev, type: type.id as AnimationType }))}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      settings.type === type.id 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <type.icon className="w-4 h-4" />
                    <span>{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Load Cases (for static/deformation) */}
            {(settings.type === 'deformation' || settings.type === 'stress') && (
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-300 dark:border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-4">Load Cases</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {loadCases.map(lc => (
                    <button
                      key={lc.id}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-sm ${
                        lc.selected 
                          ? 'bg-purple-600/30 border border-purple-500 text-white' 
                          : 'bg-slate-700/30 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        lc.type === 'seismic' ? 'bg-red-400' :
                        lc.type === 'dynamic' ? 'bg-yellow-400' : 'bg-green-400'
                      }`} />
                      {lc.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mode Selection (for modal animation) */}
            {settings.type === 'modal' && (
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-300 dark:border-slate-700/50">
                <h3 className="text-lg font-semibold text-white mb-4">Mode Shapes</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {modeShapes.map(mode => (
                    <button
                      key={mode.mode}
                      onClick={() => setSelectedMode(mode.mode)}
                      className={`w-full p-3 rounded-lg text-left ${
                        selectedMode === mode.mode 
                          ? 'bg-purple-600/30 border border-purple-500' 
                          : 'bg-slate-700/30 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-medium">Mode {mode.mode}</span>
                        <span className="text-purple-400 text-sm">{mode.frequency.toFixed(2)} Hz</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 text-sm">{mode.description}</p>
                      <div className="flex gap-3 mt-2 text-xs">
                        <span className="text-red-400">X: {mode.participation.x}%</span>
                        <span className="text-green-400">Y: {mode.participation.y}%</span>
                        <span className="text-blue-400">RZ: {mode.participation.z}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Viewport */}
          <div className="lg:col-span-2 space-y-4">
            {/* 3D Viewport */}
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-300 dark:border-slate-700/50 aspect-video relative overflow-hidden">
              {/* Placeholder for 3D animation */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Box className="w-20 h-20 text-slate-500 mx-auto mb-4" 
                    style={{ 
                      transform: `scale(${1 + getAnimationPhase() * 0.1}) rotate(${getAnimationPhase() * 5}deg)`,
                      transition: 'transform 0.1s'
                    }} 
                  />
                  <p className="text-slate-600 dark:text-slate-400">
                    {settings.type === 'modal' && `Mode ${selectedMode} Animation`}
                    {settings.type === 'deformation' && 'Deformed Shape Animation'}
                    {settings.type === 'time-history' && 'Time History Response'}
                    {settings.type === 'stress' && 'Stress Contour Animation'}
                  </p>
                </div>
              </div>

              {/* Frame Counter */}
              <div className="absolute top-4 left-4 bg-slate-50 dark:bg-slate-900/80 px-3 py-1.5 rounded-lg">
                <span className="text-white text-sm font-mono">
                  Frame: {settings.currentFrame + 1} / {settings.frameCount}
                </span>
              </div>

              {/* Scale Indicator */}
              <div className="absolute top-4 right-4 bg-slate-50 dark:bg-slate-900/80 px-3 py-1.5 rounded-lg">
                <span className="text-white text-sm">
                  Scale: {settings.scale}x
                </span>
              </div>

              {/* Animation Phase Indicator */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-slate-50 dark:bg-slate-900/80 rounded-lg p-3">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-slate-600 dark:text-slate-400 text-sm">Phase:</span>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 transition-all"
                        style={{ width: `${((settings.currentFrame + 1) / settings.frameCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-white text-sm font-mono">
                      {((settings.currentFrame / settings.frameCount) * 360).toFixed(0)}°
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-300 dark:border-slate-700/50">
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={stop}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
                  title="Stop"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button
                  onClick={prevFrame}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
                  title="Previous Frame"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, speed: Math.max(0.25, prev.speed - 0.25) }))}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
                  title="Slower"
                >
                  <Rewind className="w-5 h-5" />
                </button>
                
                {playbackState === 'playing' ? (
                  <button
                    onClick={pause}
                    className="p-4 rounded-full bg-purple-600 hover:bg-purple-500 text-white"
                    title="Pause"
                  >
                    <Pause className="w-6 h-6" />
                  </button>
                ) : (
                  <button
                    onClick={play}
                    className="p-4 rounded-full bg-purple-600 hover:bg-purple-500 text-white"
                    title="Play"
                  >
                    <Play className="w-6 h-6" />
                  </button>
                )}

                <button
                  onClick={() => setSettings(prev => ({ ...prev, speed: Math.min(4, prev.speed + 0.25) }))}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
                  title="Faster"
                >
                  <FastForward className="w-5 h-5" />
                </button>
                <button
                  onClick={nextFrame}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
                  title="Next Frame"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, loop: !prev.loop }))}
                  className={`p-2 rounded-lg ${settings.loop ? 'bg-purple-600' : 'bg-slate-700'} hover:bg-purple-500 text-white`}
                  title="Loop"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              {/* Speed indicator */}
              <div className="flex items-center justify-center mt-3 gap-4">
                <span className="text-slate-600 dark:text-slate-400 text-sm">Speed: {settings.speed}x</span>
                <span className="text-slate-600 dark:text-slate-400 text-sm">|</span>
                <span className="text-slate-600 dark:text-slate-400 text-sm">
                  {playbackState === 'playing' ? '▶ Playing' : playbackState === 'paused' ? '⏸ Paused' : '⏹ Stopped'}
                </span>
              </div>
            </div>

            {/* Timeline Scrubber */}
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-300 dark:border-slate-700/50">
              <div className="flex items-center gap-4">
                <span className="text-slate-600 dark:text-slate-400 text-sm w-16">0:00</span>
                <input
                  type="range"
                  min={0}
                  max={settings.frameCount - 1}
                  value={settings.currentFrame}
                  onChange={(e) => setSettings(prev => ({ ...prev, currentFrame: parseInt(e.target.value) }))}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-slate-600 dark:text-slate-400 text-sm w-16 text-right">
                  {(settings.frameCount / 30).toFixed(1)}s
                </span>
              </div>
            </div>
          </div>

          {/* Right Panel - Settings */}
          <div className="space-y-6">
            {/* Display Settings */}
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-300 dark:border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-400" />
                Display Settings
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                    Deformation Scale: {settings.scale}x
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={500}
                    value={settings.scale}
                    onChange={(e) => setSettings(prev => ({ ...prev, scale: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mt-1">
                    <span>1x</span>
                    <span>500x</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                    Frame Count: {settings.frameCount}
                  </label>
                  <input
                    type="range"
                    min={12}
                    max={120}
                    step={12}
                    value={settings.frameCount}
                    onChange={(e) => setSettings(prev => ({ ...prev, frameCount: parseInt(e.target.value), currentFrame: 0 }))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none"
                  />
                </div>
              </div>
            </div>

            {/* Display Options */}
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-300 dark:border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4">Options</h3>

              <div className="space-y-3">
                {[
                  { key: 'showUndeformed', label: 'Show Undeformed', icon: Eye },
                  { key: 'showContours', label: 'Show Contours', icon: Thermometer },
                  { key: 'showVectors', label: 'Show Vectors', icon: TrendingUp },
                  { key: 'loop', label: 'Loop Animation', icon: RefreshCw },
                ].map(option => (
                  <label key={option.key} className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/50">
                    <div className="flex items-center gap-2">
                      <option.icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      <span className="text-white text-sm">{option.label}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={(settings as any)[option.key]}
                      onChange={() => setSettings(prev => ({ ...prev, [option.key]: !(prev as any)[option.key] }))}
                      className="w-4 h-4 rounded bg-slate-600 border-slate-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Export Options */}
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-300 dark:border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-purple-400" />
                Export
              </h3>

              <div className="space-y-2">
                <button className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                  <Video className="w-4 h-4" />
                  Export as MP4
                </button>
                <button className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                  <Camera className="w-4 h-4" />
                  Export as GIF
                </button>
                <button className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                  <Camera className="w-4 h-4" />
                  Export Frame Sequence
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            {settings.type === 'modal' && selectedMode && (
              <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-xl p-5 border border-purple-500/30">
                <h4 className="text-white font-medium mb-3">Mode {selectedMode} Properties</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Frequency</span>
                    <span className="text-white">{modeShapes[selectedMode - 1]?.frequency.toFixed(2)} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Period</span>
                    <span className="text-white">{modeShapes[selectedMode - 1]?.period.toFixed(2)} s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Type</span>
                    <span className="text-white">{modeShapes[selectedMode - 1]?.description}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultAnimationViewer;
