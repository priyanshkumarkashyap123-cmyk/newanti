/**
 * ============================================================================
 * INTERACTIVE RESULTS CHARTS
 * ============================================================================
 * 
 * Comprehensive chart components for structural analysis results:
 * - Force diagrams (SFD, BMD, AFD)
 * - Displacement profiles
 * - Mode shapes
 * - Time history plots
 * - Response spectra
 * - Interaction diagrams (P-M, M-M)
 * - Capacity curves (pushover)
 * 
 * @version 1.0.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    ScatterChart,
    Scatter,
    ComposedChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    ReferenceArea,
    Brush,
    Cell
} from 'recharts';
import {
    TrendingUp,
    Activity,
    BarChart3,
    Layers,
    Download,
    ZoomIn,
    ZoomOut,
    Maximize2,
    RefreshCw,
    Settings,
    Eye,
    EyeOff
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface DiagramDataPoint {
    position: number; // 0 to 1 along member
    x: number; // Actual distance
    value: number;
    label?: string;
}

export interface MemberDiagramData {
    memberId: string;
    memberLabel?: string;
    length: number;
    shearForce: DiagramDataPoint[];
    bendingMoment: DiagramDataPoint[];
    axialForce: DiagramDataPoint[];
    deflection: DiagramDataPoint[];
    criticalPoints?: {
        position: number;
        type: 'max' | 'min' | 'zero';
        value: number;
        label: string;
    }[];
}

export interface TimeHistoryData {
    time: number;
    displacement?: number;
    velocity?: number;
    acceleration?: number;
    baseShear?: number;
    roofDrift?: number;
}

export interface ResponseSpectrumData {
    period: number;
    sa: number; // Spectral acceleration
    sd?: number; // Spectral displacement
    sv?: number; // Spectral velocity
}

export interface InteractionPoint {
    P: number; // Axial force
    Mx?: number; // Moment about X
    My?: number; // Moment about Y
    M?: number; // Resultant moment
    utilization?: number;
}

export interface PushoverData {
    displacement: number; // Roof displacement
    baseShear: number;
    step: number;
    state?: 'elastic' | 'yielding' | 'collapse';
}

export interface ChartSettings {
    showGrid: boolean;
    showLegend: boolean;
    showTooltip: boolean;
    showBrush: boolean;
    showCriticalPoints: boolean;
    fillArea: boolean;
    lineWidth: number;
    animated: boolean;
}

// ============================================================================
// COLOR SCHEMES
// ============================================================================

const CHART_COLORS = {
    shearForce: '#ef4444', // Red
    bendingMoment: '#3b82f6', // Blue
    axialForce: '#22c55e', // Green
    deflection: '#f59e0b', // Amber
    torsion: '#8b5cf6', // Purple
    primary: '#06b6d4', // Cyan
    secondary: '#ec4899', // Pink
    grid: '#334155',
    text: '#94a3b8',
    background: '#1e293b',
    positive: '#22c55e',
    negative: '#ef4444',
    neutral: '#64748b'
};

const DEFAULT_CHART_SETTINGS: ChartSettings = {
    showGrid: true,
    showLegend: true,
    showTooltip: true,
    showBrush: false,
    showCriticalPoints: true,
    fillArea: true,
    lineWidth: 2,
    animated: true
};

// ============================================================================
// CUSTOM TOOLTIP
// ============================================================================

interface CustomTooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string | number;
    unit?: string;
    formatter?: (value: number) => string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
    active,
    payload,
    label,
    unit = '',
    formatter
}) => {
    if (!active || !payload?.length) return null;
    
    return (
        <div className="bg-[#131b2e] border border-[#1a2333] rounded-lg p-3 shadow-xl">
            <p className="text-xs text-[#869ab8] mb-2">Position: {typeof label === 'number' ? label.toFixed(2) : label} m</p>
            {payload.map((entry, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                    <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-slate-600 dark:text-slate-300">{entry.name}:</span>
                    <span className="text-[#dae2fd] font-medium tracking-wide">
                        {formatter ? formatter(entry.value) : entry.value.toFixed(2)} {unit}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ============================================================================
// CHART HEADER
// ============================================================================

interface ChartHeaderProps {
    title: string;
    icon?: React.ReactNode;
    settings: ChartSettings;
    onSettingsChange: (settings: ChartSettings) => void;
    onExport?: () => void;
    onFullscreen?: () => void;
}

const ChartHeader: React.FC<ChartHeaderProps> = ({
    title,
    icon,
    settings,
    onSettingsChange,
    onExport,
    onFullscreen
}) => {
    const [showSettings, setShowSettings] = useState(false);
    
    return (
        <div className="flex items-center justify-between px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-[#1a2333]">
            <div className="flex items-center gap-2">
                {icon || <BarChart3 className="w-5 h-5 text-cyan-400" />}
                <h3 className="font-semibold text-[#dae2fd]">{title}</h3>
            </div>
            
            <div className="flex items-center gap-1">
                <button type="button"
                    onClick={() => onSettingsChange({ ...settings, showGrid: !settings.showGrid })}
                    className={`p-1.5 rounded transition-colors ${
                        settings.showGrid ? 'text-cyan-400' : 'text-[#869ab8]'
                    } hover:bg-slate-200 dark:hover:bg-slate-700`}
                    title="Toggle Grid"
                >
                    <Activity className="w-4 h-4" />
                </button>
                <button type="button"
                    onClick={() => onSettingsChange({ ...settings, showLegend: !settings.showLegend })}
                    className={`p-1.5 rounded transition-colors ${
                        settings.showLegend ? 'text-cyan-400' : 'text-[#869ab8]'
                    } hover:bg-slate-200 dark:hover:bg-slate-700`}
                    title="Toggle Legend"
                >
                    {settings.showLegend ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button type="button"
                    onClick={() => onSettingsChange({ ...settings, fillArea: !settings.fillArea })}
                    className={`p-1.5 rounded transition-colors ${
                        settings.fillArea ? 'text-cyan-400' : 'text-[#869ab8]'
                    } hover:bg-slate-200 dark:hover:bg-slate-700`}
                    title="Toggle Fill"
                >
                    <Layers className="w-4 h-4" />
                </button>
                {onExport && (
                    <button type="button"
                        onClick={onExport}
                        className="p-1.5 rounded text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="Export"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                )}
                {onFullscreen && (
                    <button type="button"
                        onClick={onFullscreen}
                        className="p-1.5 rounded text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="Fullscreen"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// FORCE DIAGRAM CHART (SFD, BMD, AFD)
// ============================================================================

interface ForceDiagramChartProps {
    data: MemberDiagramData;
    diagramType: 'shearForce' | 'bendingMoment' | 'axialForce' | 'deflection';
    height?: number;
    settings?: Partial<ChartSettings>;
    onExport?: () => void;
}

export const ForceDiagramChart: React.FC<ForceDiagramChartProps> = ({
    data,
    diagramType,
    height = 300,
    settings: customSettings,
    onExport
}) => {
    const [settings, setSettings] = useState<ChartSettings>({
        ...DEFAULT_CHART_SETTINGS,
        ...customSettings
    });
    
    const chartData = useMemo(() => {
        return data[diagramType].map(point => ({
            x: point.x,
            value: point.value,
            position: point.position
        }));
    }, [data, diagramType]);
    
    const colorKey = diagramType as keyof typeof CHART_COLORS;
    const color = CHART_COLORS[colorKey] || CHART_COLORS.primary;
    
    const titles: Record<string, string> = {
        shearForce: 'Shear Force Diagram (SFD)',
        bendingMoment: 'Bending Moment Diagram (BMD)',
        axialForce: 'Axial Force Diagram (AFD)',
        deflection: 'Deflection Profile'
    };
    
    const units: Record<string, string> = {
        shearForce: 'kN',
        bendingMoment: 'kN·m',
        axialForce: 'kN',
        deflection: 'mm'
    };
    
    const { minValue, maxValue } = useMemo(() => {
        const values = chartData.map(d => d.value);
        return {
            minValue: Math.min(0, ...values),
            maxValue: Math.max(0, ...values)
        };
    }, [chartData]);
    
    return (
        <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] overflow-hidden">
            <ChartHeader
                title={titles[diagramType]}
                settings={settings}
                onSettingsChange={setSettings}
                onExport={onExport}
            />
            
            <div className="p-4" style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                        {settings.showGrid && (
                            <CartesianGrid 
                                strokeDasharray="3 3" 
                                stroke={CHART_COLORS.grid}
                                opacity={0.5}
                            />
                        )}
                        <XAxis
                            dataKey="x"
                            stroke={CHART_COLORS.text}
                            fontSize={11}
                            tickFormatter={(v: number) => `${v.toFixed(1)}`}
                            label={{ 
                                value: 'Distance (m)', 
                                position: 'insideBottomRight', 
                                offset: -5,
                                fill: CHART_COLORS.text,
                                fontSize: 10
                            }}
                        />
                        <YAxis
                            stroke={CHART_COLORS.text}
                            fontSize={11}
                            tickFormatter={(v: number) => `${v.toFixed(1)}`}
                            label={{ 
                                value: units[diagramType], 
                                angle: -90, 
                                position: 'insideLeft',
                                fill: CHART_COLORS.text,
                                fontSize: 10
                            }}
                            domain={[minValue * 1.1, maxValue * 1.1]}
                        />
                        
                        {settings.showTooltip && (
                            <Tooltip
                                content={
                                    <CustomTooltip 
                                        unit={units[diagramType]}
                                        formatter={(v) => v.toFixed(2)}
                                    />
                                }
                            />
                        )}
                        
                        {settings.showLegend && (
                            <Legend 
                                wrapperStyle={{ paddingTop: 10 }}
                                formatter={() => data.memberLabel || data.memberId}
                            />
                        )}
                        
                        {/* Zero reference line */}
                        <ReferenceLine y={0} stroke={CHART_COLORS.neutral} strokeWidth={1} />
                        
                        {settings.fillArea ? (
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={color}
                                strokeWidth={settings.lineWidth}
                                fill={color}
                                fillOpacity={0.3}
                                animationDuration={settings.animated ? 500 : 0}
                                name={titles[diagramType].split(' ')[0]}
                            />
                        ) : (
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={color}
                                strokeWidth={settings.lineWidth}
                                dot={false}
                                animationDuration={settings.animated ? 500 : 0}
                                name={titles[diagramType].split(' ')[0]}
                            />
                        )}
                        
                        {/* Critical points */}
                        {settings.showCriticalPoints && data.criticalPoints?.map((point, i) => (
                            <ReferenceLine
                                key={i}
                                x={point.position * data.length}
                                stroke={point.type === 'max' ? CHART_COLORS.negative : 
                                       point.type === 'min' ? CHART_COLORS.positive : 
                                       CHART_COLORS.neutral}
                                strokeDasharray="5 5"
                                label={{
                                    value: `${point.label}: ${point.value.toFixed(2)}`,
                                    fill: CHART_COLORS.text,
                                    fontSize: 9
                                }}
                            />
                        ))}
                        
                        {settings.showBrush && (
                            <Brush
                                dataKey="x"
                                height={20}
                                stroke={CHART_COLORS.primary}
                                fill={CHART_COLORS.background}
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            
            {/* Summary Stats */}
            <div className="px-4 py-3 bg-slate-100/30 dark:bg-slate-800/30 border-t border-[#1a2333] flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                    <span className="text-[#869ab8]">
                        Max: <span className="text-[#dae2fd] font-medium tracking-wide">{maxValue.toFixed(2)} {units[diagramType]}</span>
                    </span>
                    <span className="text-[#869ab8]">
                        Min: <span className="text-[#dae2fd] font-medium tracking-wide">{minValue.toFixed(2)} {units[diagramType]}</span>
                    </span>
                </div>
                <span className="text-[#869ab8]">
                    Member: {data.memberLabel || data.memberId} | Length: {data.length.toFixed(2)} m
                </span>
            </div>
        </div>
    );
};

// ============================================================================
// COMBINED FORCE DIAGRAMS
// ============================================================================

interface CombinedDiagramsChartProps {
    data: MemberDiagramData;
    height?: number;
    settings?: Partial<ChartSettings>;
}

export const CombinedDiagramsChart: React.FC<CombinedDiagramsChartProps> = ({
    data,
    height = 400,
    settings: customSettings
}) => {
    const [settings, setSettings] = useState<ChartSettings>({
        ...DEFAULT_CHART_SETTINGS,
        ...customSettings
    });
    
    const [visibleSeries, setVisibleSeries] = useState({
        shearForce: true,
        bendingMoment: true,
        axialForce: false,
        deflection: false
    });
    
    const chartData = useMemo(() => {
        // Combine all diagram types into one dataset
        const maxLength = Math.max(
            data.shearForce.length,
            data.bendingMoment.length,
            data.axialForce.length,
            data.deflection.length
        );
        
        return Array.from({ length: maxLength }, (_, i) => ({
            x: data.shearForce[i]?.x || 0,
            shearForce: data.shearForce[i]?.value || 0,
            bendingMoment: data.bendingMoment[i]?.value || 0,
            axialForce: data.axialForce[i]?.value || 0,
            deflection: data.deflection[i]?.value || 0
        }));
    }, [data]);
    
    const toggleSeries = (key: keyof typeof visibleSeries) => {
        setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
    };
    
    return (
        <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] overflow-hidden">
            <ChartHeader
                title="Combined Force Diagrams"
                icon={<TrendingUp className="w-5 h-5 text-cyan-400" />}
                settings={settings}
                onSettingsChange={setSettings}
            />
            
            {/* Series Toggle */}
            <div className="px-4 py-2 border-b border-[#1a2333] flex items-center gap-4">
                {Object.entries(visibleSeries).map(([key, visible]) => (
                    <button type="button"
                        key={key}
                        onClick={() => toggleSeries(key as keyof typeof visibleSeries)}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                            visible ? 'bg-slate-200 dark:bg-slate-700' : 'opacity-50'
                        }`}
                    >
                        <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[key as keyof typeof CHART_COLORS] }}
                        />
                        <span className="text-slate-600 dark:text-slate-300">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                    </button>
                ))}
            </div>
            
            <div className="p-4" style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                        {settings.showGrid && (
                            <CartesianGrid 
                                strokeDasharray="3 3" 
                                stroke={CHART_COLORS.grid}
                                opacity={0.5}
                            />
                        )}
                        <XAxis
                            dataKey="x"
                            stroke={CHART_COLORS.text}
                            fontSize={11}
                            tickFormatter={(v: number) => `${v.toFixed(1)}`}
                        />
                        <YAxis
                            stroke={CHART_COLORS.text}
                            fontSize={11}
                        />
                        
                        <ReferenceLine y={0} stroke={CHART_COLORS.neutral} />
                        
                        {settings.showTooltip && <Tooltip content={<CustomTooltip />} />}
                        {settings.showLegend && <Legend />}
                        
                        {visibleSeries.shearForce && (
                            <Area
                                type="monotone"
                                dataKey="shearForce"
                                stroke={CHART_COLORS.shearForce}
                                fill={CHART_COLORS.shearForce}
                                fillOpacity={settings.fillArea ? 0.2 : 0}
                                strokeWidth={settings.lineWidth}
                                name="Shear Force (kN)"
                            />
                        )}
                        
                        {visibleSeries.bendingMoment && (
                            <Area
                                type="monotone"
                                dataKey="bendingMoment"
                                stroke={CHART_COLORS.bendingMoment}
                                fill={CHART_COLORS.bendingMoment}
                                fillOpacity={settings.fillArea ? 0.2 : 0}
                                strokeWidth={settings.lineWidth}
                                name="Bending Moment (kN·m)"
                            />
                        )}
                        
                        {visibleSeries.axialForce && (
                            <Line
                                type="monotone"
                                dataKey="axialForce"
                                stroke={CHART_COLORS.axialForce}
                                strokeWidth={settings.lineWidth}
                                dot={false}
                                name="Axial Force (kN)"
                            />
                        )}
                        
                        {visibleSeries.deflection && (
                            <Line
                                type="monotone"
                                dataKey="deflection"
                                stroke={CHART_COLORS.deflection}
                                strokeWidth={settings.lineWidth}
                                strokeDasharray="5 5"
                                dot={false}
                                name="Deflection (mm)"
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// ============================================================================
// TIME HISTORY CHART
// ============================================================================

interface TimeHistoryChartProps {
    data: TimeHistoryData[];
    height?: number;
    showDisplacement?: boolean;
    showVelocity?: boolean;
    showAcceleration?: boolean;
    showBaseShear?: boolean;
}

export const TimeHistoryChart: React.FC<TimeHistoryChartProps> = ({
    data,
    height = 350,
    showDisplacement = true,
    showVelocity = false,
    showAcceleration = false,
    showBaseShear = false
}) => {
    const [settings, setSettings] = useState<ChartSettings>(DEFAULT_CHART_SETTINGS);
    
    return (
        <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] overflow-hidden">
            <ChartHeader
                title="Time History Response"
                icon={<Activity className="w-5 h-5 text-cyan-400" />}
                settings={settings}
                onSettingsChange={setSettings}
            />
            
            <div className="p-4" style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                        {settings.showGrid && (
                            <CartesianGrid 
                                strokeDasharray="3 3" 
                                stroke={CHART_COLORS.grid}
                                opacity={0.5}
                            />
                        )}
                        <XAxis
                            dataKey="time"
                            stroke={CHART_COLORS.text}
                            fontSize={11}
                            label={{ value: 'Time (s)', position: 'insideBottomRight', offset: -5 }}
                        />
                        <YAxis stroke={CHART_COLORS.text} fontSize={11} />
                        
                        <ReferenceLine y={0} stroke={CHART_COLORS.neutral} />
                        
                        {settings.showTooltip && <Tooltip content={<CustomTooltip />} />}
                        {settings.showLegend && <Legend />}
                        
                        {showDisplacement && (
                            <Line
                                type="monotone"
                                dataKey="displacement"
                                stroke={CHART_COLORS.primary}
                                strokeWidth={settings.lineWidth}
                                dot={false}
                                name="Displacement (mm)"
                            />
                        )}
                        
                        {showVelocity && (
                            <Line
                                type="monotone"
                                dataKey="velocity"
                                stroke={CHART_COLORS.secondary}
                                strokeWidth={settings.lineWidth}
                                dot={false}
                                name="Velocity (mm/s)"
                            />
                        )}
                        
                        {showAcceleration && (
                            <Line
                                type="monotone"
                                dataKey="acceleration"
                                stroke={CHART_COLORS.axialForce}
                                strokeWidth={settings.lineWidth}
                                dot={false}
                                name="Acceleration (g)"
                            />
                        )}
                        
                        {showBaseShear && (
                            <Line
                                type="monotone"
                                dataKey="baseShear"
                                stroke={CHART_COLORS.shearForce}
                                strokeWidth={settings.lineWidth}
                                dot={false}
                                name="Base Shear (kN)"
                            />
                        )}
                        
                        {settings.showBrush && (
                            <Brush
                                dataKey="time"
                                height={20}
                                stroke={CHART_COLORS.primary}
                            />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// ============================================================================
// RESPONSE SPECTRUM CHART
// ============================================================================

interface ResponseSpectrumChartProps {
    data: ResponseSpectrumData[];
    designSpectrum?: ResponseSpectrumData[];
    height?: number;
    logScale?: boolean;
}

export const ResponseSpectrumChart: React.FC<ResponseSpectrumChartProps> = ({
    data,
    designSpectrum,
    height = 350,
    logScale = false
}) => {
    const [settings, setSettings] = useState<ChartSettings>(DEFAULT_CHART_SETTINGS);
    
    return (
        <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] overflow-hidden">
            <ChartHeader
                title="Response Spectrum"
                icon={<TrendingUp className="w-5 h-5 text-cyan-400" />}
                settings={settings}
                onSettingsChange={setSettings}
            />
            
            <div className="p-4" style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                        {settings.showGrid && (
                            <CartesianGrid 
                                strokeDasharray="3 3" 
                                stroke={CHART_COLORS.grid}
                                opacity={0.5}
                            />
                        )}
                        <XAxis
                            dataKey="period"
                            stroke={CHART_COLORS.text}
                            fontSize={11}
                            scale={logScale ? 'log' : 'auto'}
                            domain={logScale ? [0.01, 10] : ['auto', 'auto']}
                            label={{ value: 'Period (s)', position: 'insideBottomRight', offset: -5 }}
                        />
                        <YAxis
                            stroke={CHART_COLORS.text}
                            fontSize={11}
                            label={{ value: 'Sa (g)', angle: -90, position: 'insideLeft' }}
                        />
                        
                        {settings.showTooltip && <Tooltip content={<CustomTooltip unit="g" />} />}
                        {settings.showLegend && <Legend />}
                        
                        {designSpectrum && (
                            <Area
                                type="monotone"
                                data={designSpectrum}
                                dataKey="sa"
                                stroke={CHART_COLORS.shearForce}
                                fill={CHART_COLORS.shearForce}
                                fillOpacity={0.1}
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                name="Design Spectrum"
                            />
                        )}
                        
                        <Line
                            type="monotone"
                            dataKey="sa"
                            stroke={CHART_COLORS.primary}
                            strokeWidth={settings.lineWidth}
                            dot={false}
                            name="Response Spectrum"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// ============================================================================
// P-M INTERACTION DIAGRAM
// ============================================================================

interface PMInteractionChartProps {
    capacity: InteractionPoint[];
    demand?: InteractionPoint[];
    height?: number;
    title?: string;
}

export const PMInteractionChart: React.FC<PMInteractionChartProps> = ({
    capacity,
    demand,
    height = 400,
    title = 'P-M Interaction Diagram'
}) => {
    const [settings, setSettings] = useState<ChartSettings>(DEFAULT_CHART_SETTINGS);
    
    // Check if demand points are within capacity
    const demandStatus = useMemo(() => {
        if (!demand) return [];
        return demand.map(d => {
            // Simplified check - in reality need point-in-polygon
            const utilization = d.utilization || 0;
            return {
                ...d,
                status: utilization <= 1.0 ? 'safe' : 'exceeded'
            };
        });
    }, [demand]);
    
    return (
        <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] overflow-hidden">
            <ChartHeader
                title={title}
                icon={<Activity className="w-5 h-5 text-cyan-400" />}
                settings={settings}
                onSettingsChange={setSettings}
            />
            
            <div className="p-4" style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                        {settings.showGrid && (
                            <CartesianGrid 
                                strokeDasharray="3 3" 
                                stroke={CHART_COLORS.grid}
                                opacity={0.5}
                            />
                        )}
                        <XAxis
                            type="number"
                            dataKey="M"
                            stroke={CHART_COLORS.text}
                            fontSize={11}
                            domain={['auto', 'auto']}
                            label={{ value: 'Moment (kN·m)', position: 'insideBottomRight', offset: -5 }}
                        />
                        <YAxis
                            type="number"
                            dataKey="P"
                            stroke={CHART_COLORS.text}
                            fontSize={11}
                            label={{ value: 'Axial Force (kN)', angle: -90, position: 'insideLeft' }}
                        />
                        
                        {settings.showTooltip && <Tooltip content={<CustomTooltip />} />}
                        {settings.showLegend && <Legend />}
                        
                        {/* Capacity curve */}
                        <Area
                            type="monotone"
                            data={capacity}
                            dataKey="P"
                            stroke={CHART_COLORS.primary}
                            fill={CHART_COLORS.primary}
                            fillOpacity={0.2}
                            strokeWidth={2}
                            name="Capacity"
                        />
                        
                        {/* Demand points */}
                        {demandStatus.length > 0 && (
                            <Scatter
                                data={demandStatus}
                                name="Demand"
                            >
                                {demandStatus.map((entry, index) => (
                                    <Cell 
                                        key={index}
                                        fill={entry.status === 'safe' ? CHART_COLORS.positive : CHART_COLORS.negative}
                                    />
                                ))}
                            </Scatter>
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            
            {/* Status Summary */}
            {demandStatus.length > 0 && (
                <div className="px-4 py-3 bg-slate-100/30 dark:bg-slate-800/30 border-t border-[#1a2333] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-[#869ab8]">Safe: {demandStatus.filter(d => d.status === 'safe').length}</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-[#869ab8]">Exceeded: {demandStatus.filter(d => d.status === 'exceeded').length}</span>
                        </span>
                    </div>
                    <span className="text-[#869ab8]">
                        Total Load Cases: {demandStatus.length}
                    </span>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// PUSHOVER CAPACITY CURVE
// ============================================================================

interface PushoverChartProps {
    data: PushoverData[];
    performancePoints?: { displacement: number; baseShear: number; label: string }[];
    height?: number;
}

export const PushoverChart: React.FC<PushoverChartProps> = ({
    data,
    performancePoints,
    height = 400
}) => {
    const [settings, setSettings] = useState<ChartSettings>(DEFAULT_CHART_SETTINGS);
    
    return (
        <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] overflow-hidden">
            <ChartHeader
                title="Pushover Capacity Curve"
                icon={<TrendingUp className="w-5 h-5 text-cyan-400" />}
                settings={settings}
                onSettingsChange={setSettings}
            />
            
            <div className="p-4" style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={data}
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                        {settings.showGrid && (
                            <CartesianGrid 
                                strokeDasharray="3 3" 
                                stroke={CHART_COLORS.grid}
                                opacity={0.5}
                            />
                        )}
                        <XAxis
                            dataKey="displacement"
                            stroke={CHART_COLORS.text}
                            fontSize={11}
                            label={{ value: 'Roof Displacement (mm)', position: 'insideBottomRight', offset: -5 }}
                        />
                        <YAxis
                            stroke={CHART_COLORS.text}
                            fontSize={11}
                            label={{ value: 'Base Shear (kN)', angle: -90, position: 'insideLeft' }}
                        />
                        
                        {settings.showTooltip && <Tooltip content={<CustomTooltip />} />}
                        {settings.showLegend && <Legend />}
                        
                        {/* Capacity curve with state-based coloring */}
                        <Area
                            type="monotone"
                            dataKey="baseShear"
                            stroke={CHART_COLORS.primary}
                            fill={CHART_COLORS.primary}
                            fillOpacity={settings.fillArea ? 0.2 : 0}
                            strokeWidth={settings.lineWidth}
                            name="Capacity"
                        />
                        
                        {/* Performance points */}
                        {performancePoints?.map((point, i) => (
                            <ReferenceLine
                                key={i}
                                x={point.displacement}
                                stroke={CHART_COLORS.secondary}
                                strokeDasharray="5 5"
                                label={{
                                    value: point.label,
                                    fill: CHART_COLORS.text,
                                    fontSize: 10,
                                    position: 'top'
                                }}
                            />
                        ))}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            
            {/* Performance Point Legend */}
            {performancePoints && performancePoints.length > 0 && (
                <div className="px-4 py-3 bg-slate-100/30 dark:bg-slate-800/30 border-t border-[#1a2333]">
                    <div className="flex flex-wrap gap-4 text-xs">
                        {performancePoints.map((point, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="w-3 h-0.5 bg-pink-500" />
                                <span className="text-[#869ab8]">
                                    {point.label}: {point.displacement.toFixed(1)} mm / {point.baseShear.toFixed(0)} kN
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// EXPORT ALL
// ============================================================================

export {
    CustomTooltip,
    ChartHeader,
    CHART_COLORS,
    DEFAULT_CHART_SETTINGS
};

export default {
    ForceDiagramChart,
    CombinedDiagramsChart,
    TimeHistoryChart,
    ResponseSpectrumChart,
    PMInteractionChart,
    PushoverChart
};
