/**
 * ============================================================================
 * ANIMATION CONTROLS COMPONENT
 * ============================================================================
 * 
 * Comprehensive animation controls for structural visualization:
 * - Mode shape animations
 * - Deflection animations
 * - Time history playback
 * - Dynamic response visualization
 * - Animation recording/export
 * 
 * @version 1.0.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    FastForward,
    Repeat,
    Rewind,
    Film,
    Settings,
    Download,
    Square,
    Circle,
    Camera,
    Maximize2,
    Minimize2,
    Clock,
    Sliders,
    Activity,
    Zap
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type AnimationType = 'mode-shape' | 'deflection' | 'time-history' | 'dynamic' | 'pushover';

export type PlaybackState = 'stopped' | 'playing' | 'paused' | 'recording';

export interface AnimationFrame {
    time: number;
    values: number[];
    maxValue: number;
    minValue: number;
}

export interface AnimationConfig {
    type: AnimationType;
    speed: number; // 0.25 - 4.0x
    loop: boolean;
    reverse: boolean;
    scaleFactor: number;
    fps: number;
    showTrail: boolean;
    trailLength: number;
    smoothing: 'none' | 'linear' | 'bezier';
    colorByValue: boolean;
}

export interface ModeShapeConfig extends AnimationConfig {
    modeNumber: number;
    frequency: number;
    amplitude: number;
    phaseAngle: number;
}

export interface TimeHistoryConfig extends AnimationConfig {
    startTime: number;
    endTime: number;
    currentTime: number;
    timeStep: number;
}

export interface RecordingConfig {
    format: 'gif' | 'webm' | 'mp4' | 'frames';
    quality: 'low' | 'medium' | 'high';
    width: number;
    height: number;
    fps: number;
    duration: number;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
    type: 'mode-shape',
    speed: 1.0,
    loop: true,
    reverse: false,
    scaleFactor: 10.0,
    fps: 60,
    showTrail: false,
    trailLength: 10,
    smoothing: 'bezier',
    colorByValue: true
};

const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
    format: 'webm',
    quality: 'high',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5
};

// ============================================================================
// PLAYBACK CONTROL BAR
// ============================================================================

interface PlaybackControlBarProps {
    state: PlaybackState;
    progress: number;
    currentFrame: number;
    totalFrames: number;
    speed: number;
    loop: boolean;
    onPlay: () => void;
    onPause: () => void;
    onStop: () => void;
    onSeek: (progress: number) => void;
    onSpeedChange: (speed: number) => void;
    onLoopToggle: () => void;
    onStepForward: () => void;
    onStepBackward: () => void;
}

const PlaybackControlBar: React.FC<PlaybackControlBarProps> = ({
    state,
    progress,
    currentFrame,
    totalFrames,
    speed,
    loop,
    onPlay,
    onPause,
    onStop,
    onSeek,
    onSpeedChange,
    onLoopToggle,
    onStepForward,
    onStepBackward
}) => {
    const progressBarRef = useRef<HTMLDivElement>(null);
    
    const handleProgressClick = (e: React.MouseEvent) => {
        if (!progressBarRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const clickPosition = (e.clientX - rect.left) / rect.width;
        onSeek(Math.max(0, Math.min(1, clickPosition)));
    };
    
    const formatTime = (frame: number, fps: number = 30) => {
        const seconds = frame / fps;
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2);
        return `${mins}:${secs.padStart(5, '0')}`;
    };
    
    const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 4.0];
    
    return (
        <div className="bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            {/* Progress Bar */}
            <div
                ref={progressBarRef}
                onClick={handleProgressClick}
                className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full cursor-pointer mb-3 relative overflow-hidden group"
            >
                {/* Buffer indicator */}
                <div 
                    className="absolute h-full bg-slate-600 rounded-full"
                    style={{ width: '100%' }}
                />
                {/* Progress indicator */}
                <div 
                    className="absolute h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                    style={{ width: `${progress * 100}%` }}
                />
                {/* Handle */}
                <div 
                    className="absolute w-4 h-4 bg-white rounded-full shadow-lg transform -translate-y-1 -translate-x-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `${progress * 100}%` }}
                />
            </div>
            
            <div className="flex items-center justify-between gap-4">
                {/* Left Controls */}
                <div className="flex items-center gap-2">
                    {/* Play/Pause */}
                    <button
                        onClick={state === 'playing' ? onPause : onPlay}
                        className="p-2.5 bg-cyan-500 text-white rounded-lg hover:bg-cyan-400 transition-colors"
                    >
                        {state === 'playing' ? (
                            <Pause className="w-5 h-5" />
                        ) : (
                            <Play className="w-5 h-5" />
                        )}
                    </button>
                    
                    {/* Stop */}
                    <button
                        onClick={onStop}
                        className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        <Square className="w-4 h-4" />
                    </button>
                    
                    {/* Step Backward */}
                    <button
                        onClick={onStepBackward}
                        className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"
                        title="Previous Frame"
                    >
                        <SkipBack className="w-4 h-4" />
                    </button>
                    
                    {/* Step Forward */}
                    <button
                        onClick={onStepForward}
                        className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"
                        title="Next Frame"
                    >
                        <SkipForward className="w-4 h-4" />
                    </button>
                </div>
                
                {/* Center - Time Display */}
                <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-900 dark:text-white font-mono">
                        {formatTime(currentFrame)}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">/</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                        {formatTime(totalFrames)}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs ml-2">
                        Frame {currentFrame} / {totalFrames}
                    </span>
                </div>
                
                {/* Right Controls */}
                <div className="flex items-center gap-2">
                    {/* Speed Control */}
                    <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-700 rounded-lg p-1">
                        <FastForward className="w-4 h-4 text-slate-500 dark:text-slate-400 ml-1" />
                        <select
                            value={speed}
                            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                            className="bg-transparent text-slate-900 dark:text-white text-sm px-2 py-1 focus:outline-none cursor-pointer"
                        >
                            {SPEED_OPTIONS.map(s => (
                                <option key={s} value={s} className="bg-slate-100 dark:bg-slate-800">
                                    {s}x
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Loop Toggle */}
                    <button
                        onClick={onLoopToggle}
                        className={`p-2 rounded-lg transition-colors ${
                            loop 
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        title={loop ? 'Loop: On' : 'Loop: Off'}
                    >
                        <Repeat className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// MODE SHAPE SELECTOR
// ============================================================================

interface ModeShapeSelectorProps {
    modes: Array<{
        number: number;
        frequency: number;
        period: number;
        participationMass: number;
        description?: string;
    }>;
    selectedMode: number;
    onSelectMode: (mode: number) => void;
}

const ModeShapeSelector: React.FC<ModeShapeSelectorProps> = ({
    modes,
    selectedMode,
    onSelectMode
}) => {
    return (
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Mode Shapes
            </h4>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
                {modes.map(mode => (
                    <button
                        key={mode.number}
                        onClick={() => onSelectMode(mode.number)}
                        className={`
                            w-full flex items-center justify-between p-3 rounded-lg text-left transition-all
                            ${selectedMode === mode.number
                                ? 'bg-cyan-500/10 border border-cyan-500/30 text-slate-900 dark:text-white'
                                : 'bg-slate-200/50 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-transparent'
                            }
                        `}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`
                                w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                                ${selectedMode === mode.number ? 'bg-cyan-500 text-white' : 'bg-slate-600 text-slate-600 dark:text-slate-300'}
                            `}>
                                {mode.number}
                            </div>
                            <div>
                                <div className="text-sm font-medium">
                                    Mode {mode.number}
                                    {mode.description && (
                                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">({mode.description})</span>
                                    )}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    f = {mode.frequency.toFixed(3)} Hz • T = {mode.period.toFixed(3)} s
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`text-sm font-medium ${
                                mode.participationMass > 0.7 ? 'text-green-400' :
                                mode.participationMass > 0.3 ? 'text-yellow-400' :
                                'text-slate-500 dark:text-slate-400'
                            }`}>
                                {(mode.participationMass * 100).toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">Mass Part.</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// ANIMATION SETTINGS PANEL
// ============================================================================

interface AnimationSettingsPanelProps {
    config: AnimationConfig;
    onConfigChange: (config: AnimationConfig) => void;
}

const AnimationSettingsPanel: React.FC<AnimationSettingsPanelProps> = ({
    config,
    onConfigChange
}) => {
    const updateConfig = <K extends keyof AnimationConfig>(key: K, value: AnimationConfig[K]) => {
        onConfigChange({ ...config, [key]: value });
    };
    
    return (
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Animation Settings
            </h4>
            
            <div className="space-y-4">
                {/* Scale Factor */}
                <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Scale Factor: {config.scaleFactor.toFixed(1)}x
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="100"
                        step="0.5"
                        value={config.scaleFactor}
                        onChange={(e) => updateConfig('scaleFactor', parseFloat(e.target.value))}
                        className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span>1x</span>
                        <span>50x</span>
                        <span>100x</span>
                    </div>
                </div>
                
                {/* FPS */}
                <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Target FPS</label>
                    <select
                        value={config.fps}
                        onChange={(e) => updateConfig('fps', parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                    >
                        <option value={24}>24 fps (Film)</option>
                        <option value={30}>30 fps (Standard)</option>
                        <option value={60}>60 fps (Smooth)</option>
                        <option value={120}>120 fps (High)</option>
                    </select>
                </div>
                
                {/* Smoothing */}
                <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Smoothing</label>
                    <select
                        value={config.smoothing}
                        onChange={(e) => updateConfig('smoothing', e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                    >
                        <option value="none">None (Discrete)</option>
                        <option value="linear">Linear</option>
                        <option value="bezier">Smooth (Bezier)</option>
                    </select>
                </div>
                
                {/* Toggles */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.showTrail}
                            onChange={(e) => updateConfig('showTrail', e.target.checked)}
                            className="rounded bg-slate-600 border-slate-500 text-cyan-500"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Show motion trail</span>
                    </label>
                    
                    {config.showTrail && (
                        <div className="ml-6">
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                                Trail Length: {config.trailLength} frames
                            </label>
                            <input
                                type="range"
                                min="2"
                                max="30"
                                value={config.trailLength}
                                onChange={(e) => updateConfig('trailLength', parseInt(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    )}
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.colorByValue}
                            onChange={(e) => updateConfig('colorByValue', e.target.checked)}
                            className="rounded bg-slate-600 border-slate-500 text-cyan-500"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Color by displacement</span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.reverse}
                            onChange={(e) => updateConfig('reverse', e.target.checked)}
                            className="rounded bg-slate-600 border-slate-500 text-cyan-500"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Reverse direction</span>
                    </label>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// RECORDING PANEL
// ============================================================================

interface RecordingPanelProps {
    isRecording: boolean;
    recordingConfig: RecordingConfig;
    onRecordingConfigChange: (config: RecordingConfig) => void;
    onStartRecording: () => void;
    onStopRecording: () => void;
    recordingProgress: number;
}

const RecordingPanel: React.FC<RecordingPanelProps> = ({
    isRecording,
    recordingConfig,
    onRecordingConfigChange,
    onStartRecording,
    onStopRecording,
    recordingProgress
}) => {
    return (
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Film className="w-4 h-4 text-red-400" />
                Recording
                {isRecording && (
                    <span className="ml-auto flex items-center gap-1.5 text-red-400">
                        <Circle className="w-2 h-2 fill-current animate-pulse" />
                        <span className="text-xs">REC</span>
                    </span>
                )}
            </h4>
            
            {!isRecording ? (
                <div className="space-y-4">
                    {/* Format */}
                    <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Format</label>
                        <select
                            value={recordingConfig.format}
                            onChange={(e) => onRecordingConfigChange({
                                ...recordingConfig,
                                format: e.target.value as RecordingConfig['format']
                            })}
                            className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        >
                            <option value="webm">WebM Video</option>
                            <option value="gif">Animated GIF</option>
                            <option value="mp4">MP4 Video</option>
                            <option value="frames">PNG Frames (ZIP)</option>
                        </select>
                    </div>
                    
                    {/* Quality */}
                    <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Quality</label>
                        <div className="flex gap-2">
                            {(['low', 'medium', 'high'] as const).map(q => (
                                <button
                                    key={q}
                                    onClick={() => onRecordingConfigChange({
                                        ...recordingConfig,
                                        quality: q
                                    })}
                                    className={`
                                        flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                                        ${recordingConfig.quality === q
                                            ? 'bg-cyan-500 text-white'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-600'
                                        }
                                    `}
                                >
                                    {q.charAt(0).toUpperCase() + q.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Resolution */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Width</label>
                            <input
                                type="number"
                                value={recordingConfig.width}
                                onChange={(e) => onRecordingConfigChange({
                                    ...recordingConfig,
                                    width: parseInt(e.target.value)
                                })}
                                className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Height</label>
                            <input
                                type="number"
                                value={recordingConfig.height}
                                onChange={(e) => onRecordingConfigChange({
                                    ...recordingConfig,
                                    height: parseInt(e.target.value)
                                })}
                                className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                            />
                        </div>
                    </div>
                    
                    {/* Duration */}
                    <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                            Duration: {recordingConfig.duration} seconds
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="30"
                            value={recordingConfig.duration}
                            onChange={(e) => onRecordingConfigChange({
                                ...recordingConfig,
                                duration: parseInt(e.target.value)
                            })}
                            className="w-full"
                        />
                    </div>
                    
                    {/* Start Recording Button */}
                    <button
                        onClick={onStartRecording}
                        className="w-full py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-400 transition-colors flex items-center justify-center gap-2"
                    >
                        <Circle className="w-4 h-4 fill-current" />
                        Start Recording
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Recording Progress */}
                    <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-slate-500 dark:text-slate-400">Recording...</span>
                            <span className="text-slate-900 dark:text-white font-medium">
                                {Math.round(recordingProgress * 100)}%
                            </span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-red-500 transition-all"
                                style={{ width: `${recordingProgress * 100}%` }}
                            />
                        </div>
                    </div>
                    
                    {/* Stop Recording Button */}
                    <button
                        onClick={onStopRecording}
                        className="w-full py-3 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold rounded-lg hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <Square className="w-4 h-4" />
                        Stop Recording
                    </button>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// MAIN ANIMATION CONTROLS COMPONENT
// ============================================================================

interface AnimationControlsProps {
    type?: AnimationType;
    modes?: Array<{
        number: number;
        frequency: number;
        period: number;
        participationMass: number;
        description?: string;
    }>;
    frames?: AnimationFrame[];
    onFrameChange?: (frame: number) => void;
    onModeChange?: (mode: number) => void;
    onConfigChange?: (config: AnimationConfig) => void;
    onExport?: (config: RecordingConfig) => Promise<Blob>;
}

export const AnimationControls: React.FC<AnimationControlsProps> = ({
    type = 'mode-shape',
    modes = [],
    frames = [],
    onFrameChange,
    onModeChange,
    onConfigChange
}) => {
    const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
    const [currentFrame, setCurrentFrame] = useState(0);
    const [selectedMode, setSelectedMode] = useState(1);
    const [showSettings, setShowSettings] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    const [config, setConfig] = useState<AnimationConfig>(DEFAULT_ANIMATION_CONFIG);
    const [recordingConfig, setRecordingConfig] = useState<RecordingConfig>(DEFAULT_RECORDING_CONFIG);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingProgress, setRecordingProgress] = useState(0);
    
    const animationRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    
    const totalFrames = frames.length || 120; // Default 120 frames for mode shapes
    
    // Animation effect - handles the animation loop
    useEffect(() => {
        if (playbackState !== 'playing') {
            return;
        }
        
        lastTimeRef.current = performance.now();
        
        const animate = (timestamp: number) => {
            const elapsed = timestamp - lastTimeRef.current;
            const frameTime = 1000 / config.fps;
            
            if (elapsed >= frameTime / config.speed) {
                lastTimeRef.current = timestamp;
                
                setCurrentFrame(prev => {
                    let next = config.reverse ? prev - 1 : prev + 1;
                    
                    if (next >= totalFrames) {
                        if (config.loop) {
                            next = 0;
                        } else {
                            queueMicrotask(() => setPlaybackState('stopped'));
                            return totalFrames - 1;
                        }
                    } else if (next < 0) {
                        if (config.loop) {
                            next = totalFrames - 1;
                        } else {
                            queueMicrotask(() => setPlaybackState('stopped'));
                            return 0;
                        }
                    }
                    
                    if (onFrameChange) {
                        onFrameChange(next);
                    }
                    
                    return next;
                });
            }
            
            animationRef.current = requestAnimationFrame(animate);
        };
        
        animationRef.current = requestAnimationFrame(animate);
        
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [playbackState, config, totalFrames, onFrameChange]);
    
    const handlePlay = useCallback(() => {
        if (currentFrame >= totalFrames - 1) {
            setCurrentFrame(0);
        }
        setPlaybackState('playing');
    }, [currentFrame, totalFrames]);
    
    const handlePause = useCallback(() => setPlaybackState('paused'), []);
    
    const handleStop = useCallback(() => {
        setPlaybackState('stopped');
        setCurrentFrame(0);
        if (onFrameChange) onFrameChange(0);
    }, [onFrameChange]);
    
    const handleSeek = (progress: number) => {
        const frame = Math.floor(progress * (totalFrames - 1));
        setCurrentFrame(frame);
        if (onFrameChange) onFrameChange(frame);
    };
    
    const handleSpeedChange = (speed: number) => {
        setConfig(prev => ({ ...prev, speed }));
    };
    
    const handleLoopToggle = () => {
        setConfig(prev => ({ ...prev, loop: !prev.loop }));
    };
    
    const handleStepForward = () => {
        const next = Math.min(currentFrame + 1, totalFrames - 1);
        setCurrentFrame(next);
        if (onFrameChange) onFrameChange(next);
    };
    
    const handleStepBackward = () => {
        const prev = Math.max(currentFrame - 1, 0);
        setCurrentFrame(prev);
        if (onFrameChange) onFrameChange(prev);
    };
    
    const handleModeSelect = (mode: number) => {
        setSelectedMode(mode);
        setCurrentFrame(0);
        if (onModeChange) onModeChange(mode);
    };
    
    const handleConfigChange = (newConfig: AnimationConfig) => {
        setConfig(newConfig);
        if (onConfigChange) onConfigChange(newConfig);
    };
    
    const handleStopRecording = useCallback(() => {
        setIsRecording(false);
        handlePause();
        setRecordingProgress(0);
        // Here you would trigger the actual export
    }, [handlePause]);
    
    const handleStartRecording = useCallback(async () => {
        setIsRecording(true);
        setRecordingProgress(0);
        handlePlay();
        
        // Simulate recording progress
        const totalMs = recordingConfig.duration * 1000;
        const startTime = performance.now(); // Use performance.now() instead of Date.now()
        
        const updateProgress = (timestamp: number) => {
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / totalMs, 1);
            setRecordingProgress(progress);
            
            if (progress < 1) {
                requestAnimationFrame(updateProgress);
            } else {
                handleStopRecording();
            }
        };
        
        requestAnimationFrame(updateProgress);
    }, [recordingConfig.duration, handlePlay, handleStopRecording]);
    
    const selectedModeData = modes.find(m => m.number === selectedMode);
    
    return (
        <div className={`
            bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden
            ${isFullscreen ? 'fixed inset-4 z-50' : ''}
        `}>
            {/* Header */}
            <div className="px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/10 rounded-lg">
                        <Zap className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">Animation Controls</h3>
                        {selectedModeData && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Mode {selectedMode} • {selectedModeData.frequency.toFixed(3)} Hz
                            </p>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-lg transition-colors ${
                            showSettings ? 'bg-cyan-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-white'
                        }`}
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                    
                    <button
                        onClick={() => {}}
                        className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg"
                        title="Take Screenshot"
                    >
                        <Camera className="w-4 h-4" />
                    </button>
                    
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg"
                    >
                        {isFullscreen ? (
                            <Minimize2 className="w-4 h-4" />
                        ) : (
                            <Maximize2 className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>
            
            <div className="flex">
                {/* Main Content */}
                <div className="flex-1 p-4 space-y-4">
                    {/* Playback Controls */}
                    <PlaybackControlBar
                        state={playbackState}
                        progress={currentFrame / (totalFrames - 1)}
                        currentFrame={currentFrame}
                        totalFrames={totalFrames}
                        speed={config.speed}
                        loop={config.loop}
                        onPlay={handlePlay}
                        onPause={handlePause}
                        onStop={handleStop}
                        onSeek={handleSeek}
                        onSpeedChange={handleSpeedChange}
                        onLoopToggle={handleLoopToggle}
                        onStepForward={handleStepForward}
                        onStepBackward={handleStepBackward}
                    />
                    
                    {/* Mode Shape Selector (for mode-shape type) */}
                    {type === 'mode-shape' && modes.length > 0 && (
                        <ModeShapeSelector
                            modes={modes}
                            selectedMode={selectedMode}
                            onSelectMode={handleModeSelect}
                        />
                    )}
                </div>
                
                {/* Settings Sidebar */}
                {showSettings && (
                    <div className="w-72 border-l border-slate-200 dark:border-slate-800 p-4 space-y-4">
                        <AnimationSettingsPanel
                            config={config}
                            onConfigChange={handleConfigChange}
                        />
                        
                        <RecordingPanel
                            isRecording={isRecording}
                            recordingConfig={recordingConfig}
                            onRecordingConfigChange={setRecordingConfig}
                            onStartRecording={handleStartRecording}
                            onStopRecording={handleStopRecording}
                            recordingProgress={recordingProgress}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnimationControls;
export { PlaybackControlBar, ModeShapeSelector, AnimationSettingsPanel, RecordingPanel };
