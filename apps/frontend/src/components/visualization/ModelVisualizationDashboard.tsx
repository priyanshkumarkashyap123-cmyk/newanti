/**
 * ============================================================================
 * MODEL VISUALIZATION DASHBOARD
 * ============================================================================
 * 
 * Comprehensive 3D visualization dashboard with:
 * - Multiple view presets (Plan, Elevation, Isometric, Custom)
 * - Section cuts and clipping planes
 * - Exploded view for complex structures
 * - Screenshot capture and export
 * - Annotation tools
 * - Measurement tools
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
    OrbitControls,
    PerspectiveCamera,
    OrthographicCamera,
    Grid,
    Environment,
    GizmoHelper,
    GizmoViewport,
    Html,
    Line,
    Text,
    Edges
} from '@react-three/drei';
import * as THREE from 'three';
import {
    Eye,
    Camera,
    Download,
    Maximize2,
    Minimize2,
    RotateCcw,
    Box,
    Layers,
    Ruler,
    Edit3,
    Sun,
    Moon,
    Grid as GridIcon,
    Move3d,
    Scissors,
    ZoomIn,
    ZoomOut,
    Home,
    ChevronDown,
    ChevronUp,
    Settings,
    Palette,
    Type
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type ViewPreset = 
    | 'isometric' 
    | 'front' 
    | 'back' 
    | 'left' 
    | 'right' 
    | 'top' 
    | 'bottom'
    | 'perspective';

export type RenderMode = 
    | 'shaded' 
    | 'wireframe' 
    | 'shaded-wireframe' 
    | 'hidden-line';

export type ColorScheme = 
    | 'material' 
    | 'section' 
    | 'stress' 
    | 'utilization' 
    | 'deflection';

interface ClippingPlane {
    id: string;
    normal: [number, number, number];
    position: number;
    enabled: boolean;
    color: string;
}

interface Annotation {
    id: string;
    position: [number, number, number];
    text: string;
    color: string;
    visible: boolean;
}

interface Measurement {
    id: string;
    start: [number, number, number];
    end: [number, number, number];
    value: number;
    unit: 'm' | 'mm' | 'ft' | 'in';
}

interface ViewSettings {
    viewPreset: ViewPreset;
    renderMode: RenderMode;
    colorScheme: ColorScheme;
    showGrid: boolean;
    showAxes: boolean;
    showNodes: boolean;
    showLabels: boolean;
    showLoads: boolean;
    showSupports: boolean;
    showDimensions: boolean;
    backgroundColor: string;
    ambientOcclusion: boolean;
    shadows: boolean;
    explodeFactor: number;
    nodeSize: number;
    memberThickness: number;
}

interface ModelVisualizationDashboardProps {
    children?: React.ReactNode;
    onScreenshot?: (dataUrl: string) => void;
    onViewChange?: (view: ViewPreset) => void;
    initialSettings?: Partial<ViewSettings>;
}

// ============================================================================
// VIEW PRESETS
// ============================================================================

const VIEW_CAMERA_POSITIONS: Record<ViewPreset, { position: [number, number, number]; target: [number, number, number] }> = {
    isometric: { position: [15, 15, 15], target: [0, 0, 0] },
    front: { position: [0, 0, 30], target: [0, 0, 0] },
    back: { position: [0, 0, -30], target: [0, 0, 0] },
    left: { position: [-30, 0, 0], target: [0, 0, 0] },
    right: { position: [30, 0, 0], target: [0, 0, 0] },
    top: { position: [0, 30, 0], target: [0, 0, 0] },
    bottom: { position: [0, -30, 0], target: [0, 0, 0] },
    perspective: { position: [20, 12, 20], target: [0, 0, 0] }
};

const DEFAULT_SETTINGS: ViewSettings = {
    viewPreset: 'isometric',
    renderMode: 'shaded',
    colorScheme: 'material',
    showGrid: true,
    showAxes: true,
    showNodes: true,
    showLabels: false,
    showLoads: true,
    showSupports: true,
    showDimensions: false,
    backgroundColor: '#1e293b',
    ambientOcclusion: false,
    shadows: true,
    explodeFactor: 0,
    nodeSize: 0.15,
    memberThickness: 1.0
};

// ============================================================================
// CAMERA CONTROLLER
// ============================================================================

interface CameraControllerProps {
    viewPreset: ViewPreset;
    onViewChange?: (view: ViewPreset) => void;
}

const CameraController: React.FC<CameraControllerProps> = ({ viewPreset }) => {
    const { camera } = useThree();
    const controlsRef = useRef<any>(null);
    
    useEffect(() => {
        const preset = VIEW_CAMERA_POSITIONS[viewPreset];
        if (preset && camera) {
            camera.position.set(...preset.position);
            camera.lookAt(...preset.target);
            if (controlsRef.current) {
                controlsRef.current.target.set(...preset.target);
                controlsRef.current.update();
            }
        }
    }, [viewPreset, camera]);
    
    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.05}
            minDistance={5}
            maxDistance={200}
        />
    );
};

// ============================================================================
// CLIPPING PLANE COMPONENT
// ============================================================================

interface ClippingPlaneVisualizerProps {
    plane: ClippingPlane;
    size?: number;
}

const ClippingPlaneVisualizer: React.FC<ClippingPlaneVisualizerProps> = ({ 
    plane, 
    size = 20 
}) => {
    if (!plane.enabled) return null;
    
    const normal = new THREE.Vector3(...plane.normal).normalize();
    const position = normal.clone().multiplyScalar(plane.position);
    
    // Create rotation from normal
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        normal
    );
    
    return (
        <group position={position.toArray()} quaternion={quaternion}>
            <mesh>
                <planeGeometry args={[size, size]} />
                <meshBasicMaterial 
                    color={plane.color} 
                    transparent 
                    opacity={0.2} 
                    side={THREE.DoubleSide}
                />
            </mesh>
            <Edges color={plane.color} threshold={15} />
        </group>
    );
};

// ============================================================================
// MEASUREMENT LINE
// ============================================================================

interface MeasurementLineProps {
    measurement: Measurement;
}

const MeasurementLine: React.FC<MeasurementLineProps> = ({ measurement }) => {
    const midpoint: [number, number, number] = [
        (measurement.start[0] + measurement.end[0]) / 2,
        (measurement.start[1] + measurement.end[1]) / 2 + 0.5,
        (measurement.start[2] + measurement.end[2]) / 2
    ];
    
    const label = `${measurement.value.toFixed(2)} ${measurement.unit}`;
    
    return (
        <group>
            <Line
                points={[measurement.start, measurement.end]}
                color="#22d3ee"
                lineWidth={2}
                dashed
                dashSize={0.2}
                gapSize={0.1}
            />
            <Html position={midpoint} center>
                <div className="bg-cyan-500 text-white text-xs px-2 py-1 rounded shadow-lg">
                    {label}
                </div>
            </Html>
        </group>
    );
};

// ============================================================================
// ANNOTATION MARKER
// ============================================================================

interface AnnotationMarkerProps {
    annotation: Annotation;
    onClick?: () => void;
}

const AnnotationMarker: React.FC<AnnotationMarkerProps> = ({ annotation, onClick }) => {
    if (!annotation.visible) return null;
    
    return (
        <Html position={annotation.position} center>
            <div 
                onClick={onClick}
                className="cursor-pointer group"
            >
                <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[#dae2fd] text-xs font-bold shadow-lg group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: annotation.color }}
                >
                    !
                </div>
                <div className="absolute left-8 top-0 bg-[#131b2e] text-[#dae2fd] text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {annotation.text}
                </div>
            </div>
        </Html>
    );
};

// ============================================================================
// SCREENSHOT CAPTURE
// ============================================================================

const useScreenshot = (onScreenshot?: (dataUrl: string) => void) => {
    const { gl, scene, camera } = useThree();
    
    const capture = useCallback(() => {
        gl.render(scene, camera);
        const dataUrl = gl.domElement.toDataURL('image/png');
        onScreenshot?.(dataUrl);
        return dataUrl;
    }, [gl, scene, camera, onScreenshot]);
    
    return capture;
};

// ============================================================================
// TOOLBAR BUTTON
// ============================================================================

interface ToolbarButtonProps {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick: () => void;
    disabled?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
    icon,
    label,
    active = false,
    onClick,
    disabled = false
}) => (
    <button type="button"
        onClick={onClick}
        disabled={disabled}
        title={label}
        className={`
            p-2 rounded-lg transition-all duration-200
            ${active 
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' 
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
    >
        {icon}
    </button>
);

// ============================================================================
// VIEW SELECTOR
// ============================================================================

interface ViewSelectorProps {
    currentView: ViewPreset;
    onViewChange: (view: ViewPreset) => void;
}

const ViewSelector: React.FC<ViewSelectorProps> = ({ currentView, onViewChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const views: { id: ViewPreset; label: string }[] = [
        { id: 'isometric', label: 'Isometric' },
        { id: 'perspective', label: 'Perspective' },
        { id: 'front', label: 'Front (XY)' },
        { id: 'back', label: 'Back' },
        { id: 'left', label: 'Left (YZ)' },
        { id: 'right', label: 'Right' },
        { id: 'top', label: 'Top (XZ)' },
        { id: 'bottom', label: 'Bottom' }
    ];
    
    return (
        <div className="relative">
            <button type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
                <Eye className="w-4 h-4" />
                <span className="text-sm">{views.find(v => v.id === currentView)?.label}</span>
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-[#131b2e] rounded-lg shadow-xl border border-[#1a2333] py-1 z-50">
                    {views.map(view => (
                        <button type="button"
                            key={view.id}
                            onClick={() => {
                                onViewChange(view.id);
                                setIsOpen(false);
                            }}
                            className={`
                                w-full px-3 py-2 text-left text-sm transition-colors
                                ${currentView === view.id 
                                    ? 'bg-cyan-500/20 text-cyan-400' 
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }
                            `}
                        >
                            {view.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// SETTINGS PANEL
// ============================================================================

interface SettingsPanelProps {
    settings: ViewSettings;
    onSettingsChange: (settings: ViewSettings) => void;
    isOpen: boolean;
    onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
    settings,
    onSettingsChange,
    isOpen,
    onClose
}) => {
    if (!isOpen) return null;
    
    const updateSetting = <K extends keyof ViewSettings>(key: K, value: ViewSettings[K]) => {
        onSettingsChange({ ...settings, [key]: value });
    };
    
    return (
        <div className="absolute right-4 top-16 w-72 bg-[#131b2e] rounded-xl shadow-2xl border border-[#1a2333] overflow-hidden z-50">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-200/50 dark:bg-slate-700/50 border-b border-[#1a2333]">
                <h3 className="font-semibold text-[#dae2fd] flex items-center gap-2">
                    <Settings className="w-4 h-4 text-cyan-400" />
                    Display Settings
                </h3>
                <button type="button" onClick={onClose} className="text-[#869ab8] hover:text-slate-900 dark:hover:text-white">
                    ×
                </button>
            </div>
            
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Render Mode */}
                <div>
                    <label className="text-xs text-[#869ab8] uppercase tracking-wider">Render Mode</label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        {(['shaded', 'wireframe', 'shaded-wireframe', 'hidden-line'] as RenderMode[]).map(mode => (
                            <button type="button"
                                key={mode}
                                onClick={() => updateSetting('renderMode', mode)}
                                className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                                    settings.renderMode === mode
                                        ? 'bg-cyan-500 text-white'
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-600'
                                }`}
                            >
                                {mode.replace('-', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* Color Scheme */}
                <div>
                    <label className="text-xs text-[#869ab8] uppercase tracking-wider">Color Scheme</label>
                    <select
                        value={settings.colorScheme}
                        onChange={(e) => updateSetting('colorScheme', e.target.value as ColorScheme)}
                        className="w-full mt-2 px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm text-[#dae2fd] border-none focus:ring-2 focus:ring-cyan-500"
                    >
                        <option value="material">By Material</option>
                        <option value="section">By Section</option>
                        <option value="stress">By Stress</option>
                        <option value="utilization">By Utilization</option>
                        <option value="deflection">By Deflection</option>
                    </select>
                </div>
                
                {/* Toggles */}
                <div className="space-y-2">
                    <label className="text-xs text-[#869ab8] uppercase tracking-wider">Display Options</label>
                    {[
                        { key: 'showGrid' as const, label: 'Grid' },
                        { key: 'showAxes' as const, label: 'Axes' },
                        { key: 'showNodes' as const, label: 'Nodes' },
                        { key: 'showLabels' as const, label: 'Labels' },
                        { key: 'showLoads' as const, label: 'Loads' },
                        { key: 'showSupports' as const, label: 'Supports' },
                        { key: 'showDimensions' as const, label: 'Dimensions' },
                        { key: 'shadows' as const, label: 'Shadows' }
                    ].map(({ key, label }) => (
                        <label key={key} className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
                            <input
                                type="checkbox"
                                checked={settings[key]}
                                onChange={(e) => updateSetting(key, e.target.checked)}
                                className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                            />
                        </label>
                    ))}
                </div>
                
                {/* Sliders */}
                <div className="space-y-3">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-[#869ab8]">Explode Factor</span>
                            <span className="text-slate-600 dark:text-slate-300">{settings.explodeFactor.toFixed(1)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={settings.explodeFactor}
                            onChange={(e) => updateSetting('explodeFactor', parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-[#869ab8]">Node Size</span>
                            <span className="text-slate-600 dark:text-slate-300">{settings.nodeSize.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="0.05"
                            max="0.5"
                            step="0.05"
                            value={settings.nodeSize}
                            onChange={(e) => updateSetting('nodeSize', parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-[#869ab8]">Member Thickness</span>
                            <span className="text-slate-600 dark:text-slate-300">{settings.memberThickness.toFixed(1)}x</span>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.1"
                            value={settings.memberThickness}
                            onChange={(e) => updateSetting('memberThickness', parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
                
                {/* Background Color */}
                <div>
                    <label className="text-xs text-[#869ab8] uppercase tracking-wider">Background</label>
                    <div className="flex gap-2 mt-2">
                        {['#1e293b', '#0f172a', '#18181b', '#1c1917', '#0c4a6e'].map(color => (
                            <button type="button"
                                key={color}
                                onClick={() => updateSetting('backgroundColor', color)}
                                className={`w-8 h-8 rounded-lg border-2 transition-colors ${
                                    settings.backgroundColor === color 
                                        ? 'border-cyan-400' 
                                        : 'border-transparent hover:border-slate-500'
                                }`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ModelVisualizationDashboard: React.FC<ModelVisualizationDashboardProps> = ({
    children,
    onScreenshot,
    onViewChange,
    initialSettings
}) => {
    const [settings, setSettings] = useState<ViewSettings>({
        ...DEFAULT_SETTINGS,
        ...initialSettings
    });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [clippingPlanes, setClippingPlanes] = useState<ClippingPlane[]>([]);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [measurements, setMeasurements] = useState<Measurement[]>([]);
    const [activeTool, setActiveTool] = useState<'select' | 'measure' | 'annotate' | null>(null);
    
    const containerRef = useRef<HTMLDivElement>(null);
    
    const handleViewChange = useCallback((view: ViewPreset) => {
        setSettings(s => ({ ...s, viewPreset: view }));
        onViewChange?.(view);
    }, [onViewChange]);
    
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);
    
    const resetView = useCallback(() => {
        setSettings(s => ({ ...s, viewPreset: 'isometric' }));
    }, []);
    
    const addClippingPlane = useCallback((normal: [number, number, number]) => {
        const newPlane: ClippingPlane = {
            id: `clip-${Date.now()}`,
            normal,
            position: 0,
            enabled: true,
            color: '#ef4444'
        };
        setClippingPlanes(planes => [...planes, newPlane]);
    }, []);
    
    return (
        <div 
            ref={containerRef}
            className={`relative w-full h-full bg-[#0b1326] rounded-xl overflow-hidden ${
                isFullscreen ? 'fixed inset-0 z-50' : ''
            }`}
        >
            {/* Main Toolbar */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-40">
                {/* Left: View Controls */}
                <div className="flex items-center gap-2">
                    <ViewSelector 
                        currentView={settings.viewPreset} 
                        onViewChange={handleViewChange} 
                    />
                    
                    <div className="h-6 w-px bg-slate-600" />
                    
                    <ToolbarButton
                        icon={<Home className="w-4 h-4" />}
                        label="Reset View"
                        onClick={resetView}
                    />
                    <ToolbarButton
                        icon={<ZoomIn className="w-4 h-4" />}
                        label="Zoom In"
                        onClick={() => {/* Implement zoom */}}
                    />
                    <ToolbarButton
                        icon={<ZoomOut className="w-4 h-4" />}
                        label="Zoom Out"
                        onClick={() => {/* Implement zoom */}}
                    />
                </div>
                
                {/* Center: Tools */}
                <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur rounded-lg p-1">
                    <ToolbarButton
                        icon={<Move3d className="w-4 h-4" />}
                        label="Select"
                        active={activeTool === 'select'}
                        onClick={() => setActiveTool(activeTool === 'select' ? null : 'select')}
                    />
                    <ToolbarButton
                        icon={<Ruler className="w-4 h-4" />}
                        label="Measure"
                        active={activeTool === 'measure'}
                        onClick={() => setActiveTool(activeTool === 'measure' ? null : 'measure')}
                    />
                    <ToolbarButton
                        icon={<Edit3 className="w-4 h-4" />}
                        label="Annotate"
                        active={activeTool === 'annotate'}
                        onClick={() => setActiveTool(activeTool === 'annotate' ? null : 'annotate')}
                    />
                    <ToolbarButton
                        icon={<Scissors className="w-4 h-4" />}
                        label="Section Cut"
                        onClick={() => addClippingPlane([0, 1, 0])}
                    />
                </div>
                
                {/* Right: Display Controls */}
                <div className="flex items-center gap-2">
                    <ToolbarButton
                        icon={<GridIcon className="w-4 h-4" />}
                        label="Toggle Grid"
                        active={settings.showGrid}
                        onClick={() => setSettings(s => ({ ...s, showGrid: !s.showGrid }))}
                    />
                    <ToolbarButton
                        icon={<Layers className="w-4 h-4" />}
                        label="Toggle Wireframe"
                        active={settings.renderMode.includes('wireframe')}
                        onClick={() => setSettings(s => ({ 
                            ...s, 
                            renderMode: s.renderMode === 'shaded' ? 'wireframe' : 'shaded' 
                        }))}
                    />
                    <ToolbarButton
                        icon={settings.shadows ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        label="Toggle Shadows"
                        onClick={() => setSettings(s => ({ ...s, shadows: !s.shadows }))}
                    />
                    
                    <div className="h-6 w-px bg-slate-600" />
                    
                    <ToolbarButton
                        icon={<Camera className="w-4 h-4" />}
                        label="Screenshot"
                        onClick={() => {/* Trigger screenshot */}}
                    />
                    <ToolbarButton
                        icon={<Settings className="w-4 h-4" />}
                        label="Settings"
                        active={showSettings}
                        onClick={() => setShowSettings(!showSettings)}
                    />
                    <ToolbarButton
                        icon={isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        onClick={toggleFullscreen}
                    />
                </div>
            </div>
            
            {/* Settings Panel */}
            <SettingsPanel
                settings={settings}
                onSettingsChange={setSettings}
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
            
            {/* 3D Canvas */}
            <Canvas
                shadows={settings.shadows}
                dpr={[1, 1.5]}
                gl={{
                    preserveDrawingBuffer: false,
                    antialias: true,
                    alpha: false,
                    powerPreference: 'low-power',
                }}
                style={{ background: settings.backgroundColor }}
            >
                <CameraController viewPreset={settings.viewPreset} />
                
                {/* Lighting */}
                <ambientLight intensity={0.4} />
                <directionalLight
                    position={[10, 20, 10]}
                    intensity={1}
                    castShadow={settings.shadows}
                    shadow-mapSize={[2048, 2048]}
                />
                <directionalLight position={[-10, 10, -10]} intensity={0.3} />
                
                {/* Grid */}
                {settings.showGrid && (
                    <Grid
                        args={[50, 50]}
                        cellSize={1}
                        cellThickness={0.5}
                        cellColor="#334155"
                        sectionSize={5}
                        sectionThickness={1}
                        sectionColor="#475569"
                        fadeDistance={50}
                        fadeStrength={1}
                        position={[0, -0.01, 0]}
                    />
                )}
                
                {/* Axes Helper via Gizmo */}
                {settings.showAxes && (
                    <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
                        <GizmoViewport
                            axisColors={['#ef4444', '#22c55e', '#3b82f6']}
                            labelColor="white"
                        />
                    </GizmoHelper>
                )}
                
                {/* Clipping Planes */}
                {clippingPlanes.map(plane => (
                    <ClippingPlaneVisualizer key={plane.id} plane={plane} />
                ))}
                
                {/* Measurements */}
                {measurements.map(measurement => (
                    <MeasurementLine key={measurement.id} measurement={measurement} />
                ))}
                
                {/* Annotations */}
                {annotations.map(annotation => (
                    <AnnotationMarker key={annotation.id} annotation={annotation} />
                ))}
                
                {/* Model Content */}
                {children}
            </Canvas>
            
            {/* Bottom Status Bar */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-[#869ab8]">
                <div className="flex items-center gap-4">
                    <span>View: {settings.viewPreset}</span>
                    <span>Render: {settings.renderMode}</span>
                    <span>Color: {settings.colorScheme}</span>
                </div>
                <div className="flex items-center gap-4">
                    {clippingPlanes.length > 0 && (
                        <span className="text-amber-400">{clippingPlanes.length} section cut(s)</span>
                    )}
                    {annotations.length > 0 && (
                        <span>{annotations.length} annotation(s)</span>
                    )}
                    {measurements.length > 0 && (
                        <span>{measurements.length} measurement(s)</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModelVisualizationDashboard;
