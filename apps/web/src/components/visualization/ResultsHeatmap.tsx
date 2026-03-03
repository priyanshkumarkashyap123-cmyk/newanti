/**
 * ============================================================================
 * RESULTS HEATMAP VISUALIZATION
 * ============================================================================
 * 
 * Interactive heatmap visualization for structural analysis results:
 * - Stress distribution heatmap
 * - Utilization ratio heatmap
 * - Deflection contour map
 * - Member force distribution
 * - Custom color scales and legends
 * 
 * @version 1.0.0
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
    Thermometer,
    Palette,
    Eye,
    EyeOff,
    Settings,
    Maximize2,
    Download,
    Info,
    Layers,
    ZoomIn,
    ZoomOut,
    RotateCcw
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type HeatmapType = 'stress' | 'utilization' | 'deflection' | 'force' | 'moment' | 'custom';

export type ColorScale = 
    | 'rainbow' 
    | 'thermal' 
    | 'cool-warm' 
    | 'viridis' 
    | 'engineering' 
    | 'monochrome';

export interface HeatmapDataPoint {
    id: string;
    x: number;
    y: number;
    z?: number;
    value: number;
    label?: string;
    memberId?: string;
    nodeId?: string;
}

export interface HeatmapGridCell {
    row: number;
    col: number;
    value: number;
    count: number;
}

export interface HeatmapConfig {
    type: HeatmapType;
    colorScale: ColorScale;
    minValue?: number;
    maxValue?: number;
    steps: number;
    showGrid: boolean;
    showLabels: boolean;
    showContours: boolean;
    interpolation: 'nearest' | 'bilinear' | 'bicubic';
    opacity: number;
    contourLevels: number;
}

export interface LegendConfig {
    visible: boolean;
    position: 'left' | 'right' | 'top' | 'bottom';
    showValues: boolean;
    unit: string;
    title: string;
}

export interface TooltipData {
    x: number;
    y: number;
    value: number;
    label?: string;
    formattedValue: string;
    percentage: number;
}

// ============================================================================
// COLOR SCALES
// ============================================================================

const COLOR_SCALES: Record<ColorScale, string[]> = {
    rainbow: ['#0000FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF8000', '#FF0000'],
    thermal: ['#000033', '#0000FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF0000', '#FF00FF'],
    'cool-warm': ['#3B4CC0', '#6B8EE0', '#A8D0F0', '#F7F7F7', '#F7B89C', '#E26952', '#B40426'],
    viridis: ['#440154', '#482878', '#3E4A89', '#31688E', '#26828E', '#1F9E89', '#35B779', '#6DCD59', '#B4DE2C', '#FDE725'],
    engineering: ['#00FF00', '#7FFF00', '#FFFF00', '#FF7F00', '#FF0000'],
    monochrome: ['#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000']
};

const SCALE_LABELS: Record<ColorScale, string> = {
    rainbow: 'Rainbow',
    thermal: 'Thermal',
    'cool-warm': 'Cool-Warm (Diverging)',
    viridis: 'Viridis (Scientific)',
    engineering: 'Engineering (Green-Red)',
    monochrome: 'Monochrome'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Interpolate between two colors
 */
const interpolateColor = (color1: string, color2: string, factor: number): string => {
    const hex = (x: string) => parseInt(x, 16);
    const r1 = hex(color1.slice(1, 3));
    const g1 = hex(color1.slice(3, 5));
    const b1 = hex(color1.slice(5, 7));
    const r2 = hex(color2.slice(1, 3));
    const g2 = hex(color2.slice(3, 5));
    const b2 = hex(color2.slice(5, 7));
    
    const r = Math.round(r1 + factor * (r2 - r1));
    const g = Math.round(g1 + factor * (g2 - g1));
    const b = Math.round(b1 + factor * (b2 - b1));
    
    return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Get color from scale based on normalized value (0-1)
 */
const getColorFromScale = (value: number, scale: string[]): string => {
    const clampedValue = Math.max(0, Math.min(1, value));
    const index = clampedValue * (scale.length - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.min(lowerIndex + 1, scale.length - 1);
    const factor = index - lowerIndex;
    
    return interpolateColor(scale[lowerIndex], scale[upperIndex], factor);
};

/**
 * Format value with appropriate precision
 */
const formatValue = (value: number, precision: number = 2): string => {
    if (Math.abs(value) >= 1e6) {
        return (value / 1e6).toFixed(precision) + 'M';
    } else if (Math.abs(value) >= 1e3) {
        return (value / 1e3).toFixed(precision) + 'k';
    } else if (Math.abs(value) < 0.01 && value !== 0) {
        return value.toExponential(precision);
    }
    return value.toFixed(precision);
};

// ============================================================================
// COLOR SCALE LEGEND
// ============================================================================

interface ColorScaleLegendProps {
    config: HeatmapConfig;
    legendConfig: LegendConfig;
    minValue: number;
    maxValue: number;
}

const ColorScaleLegend: React.FC<ColorScaleLegendProps> = ({
    config,
    legendConfig,
    minValue,
    maxValue
}) => {
    const scale = COLOR_SCALES[config.colorScale];
    const steps = config.steps;
    const isVertical = legendConfig.position === 'left' || legendConfig.position === 'right';
    
    const gradientId = `heatmap-gradient-${config.colorScale}`;
    
    const values = useMemo(() => {
        const result: number[] = [];
        for (let i = 0; i <= steps; i++) {
            result.push(minValue + (maxValue - minValue) * (i / steps));
        }
        return result;
    }, [minValue, maxValue, steps]);
    
    if (!legendConfig.visible) return null;
    
    return (
        <div className={`
            flex items-center gap-2
            ${isVertical ? 'flex-row' : 'flex-col'}
        `}>
            {legendConfig.title && (
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {legendConfig.title}
                </div>
            )}
            
            <div className={`
                relative
                ${isVertical ? 'w-4 h-48' : 'h-4 w-48'}
            `}>
                {/* Gradient Background */}
                <svg width="100%" height="100%">
                    <defs>
                        <linearGradient 
                            id={gradientId} 
                            x1="0%" 
                            y1={isVertical ? "100%" : "0%"} 
                            x2={isVertical ? "0%" : "100%"} 
                            y2={isVertical ? "0%" : "0%"}
                        >
                            {scale.map((color, index) => (
                                <stop
                                    key={index}
                                    offset={`${(index / (scale.length - 1)) * 100}%`}
                                    stopColor={color}
                                />
                            ))}
                        </linearGradient>
                    </defs>
                    <rect
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        fill={`url(#${gradientId})`}
                        rx="2"
                    />
                </svg>
            </div>
            
            {/* Value Labels */}
            {legendConfig.showValues && (
                <div className={`
                    flex text-[10px] text-slate-500 dark:text-slate-400
                    ${isVertical ? 'flex-col justify-between h-48' : 'flex-row justify-between w-48'}
                `}>
                    {values.reverse().map((value, index) => (
                        <span key={index}>
                            {formatValue(value)} {legendConfig.unit}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// HEATMAP CELL
// ============================================================================

interface HeatmapCellProps {
    x: number;
    y: number;
    width: number;
    height: number;
    value: number;
    normalizedValue: number;
    colorScale: string[];
    opacity: number;
    showLabel: boolean;
    onHover: (data: TooltipData | null) => void;
}

const HeatmapCell: React.FC<HeatmapCellProps> = ({
    x,
    y,
    width,
    height,
    value,
    normalizedValue,
    colorScale,
    opacity,
    showLabel,
    onHover
}) => {
    const color = getColorFromScale(normalizedValue, colorScale);
    
    const handleMouseEnter = () => {
        onHover({
            x: x + width / 2,
            y: y + height / 2,
            value,
            formattedValue: formatValue(value),
            percentage: normalizedValue * 100
        });
    };
    
    return (
        <g onMouseEnter={handleMouseEnter} onMouseLeave={() => onHover(null)}>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={color}
                opacity={opacity}
                className="transition-opacity hover:opacity-100 cursor-pointer"
            />
            {showLabel && width > 30 && height > 20 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[9px] fill-white font-medium pointer-events-none"
                    style={{ textShadow: '0 0 2px rgba(0,0,0,0.8)' }}
                >
                    {formatValue(value, 1)}
                </text>
            )}
        </g>
    );
};

// ============================================================================
// HEATMAP TOOLTIP
// ============================================================================

interface HeatmapTooltipProps {
    data: TooltipData | null;
    unit: string;
}

const HeatmapTooltip: React.FC<HeatmapTooltipProps> = ({ data, unit }) => {
    if (!data) return null;
    
    return (
        <div
            className="absolute z-50 px-3 py-2 bg-slate-50/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl pointer-events-none -translate-y-full"
            style={{
                left: data.x + 10,
                top: data.y - 10,
            }}
        >
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {data.formattedValue} {unit}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
                {data.percentage.toFixed(1)}% of max
            </div>
            {data.label && (
                <div className="text-xs text-cyan-400 mt-1">{data.label}</div>
            )}
        </div>
    );
};

// ============================================================================
// SETTINGS PANEL
// ============================================================================

interface SettingsPanelProps {
    config: HeatmapConfig;
    legendConfig: LegendConfig;
    onConfigChange: (config: HeatmapConfig) => void;
    onLegendConfigChange: (config: LegendConfig) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
    config,
    legendConfig,
    onConfigChange,
    onLegendConfigChange
}) => {
    return (
        <div className="absolute top-4 right-4 w-64 bg-slate-50/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 z-40">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Heatmap Settings
            </h4>
            
            {/* Color Scale */}
            <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Color Scale</label>
                <select
                    value={config.colorScale}
                    onChange={(e) => onConfigChange({ ...config, colorScale: e.target.value as ColorScale })}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
                >
                    {Object.entries(SCALE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
            </div>
            
            {/* Opacity */}
            <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                    Opacity: {Math.round(config.opacity * 100)}%
                </label>
                <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={config.opacity}
                    onChange={(e) => onConfigChange({ ...config, opacity: parseFloat(e.target.value) })}
                    className="w-full"
                />
            </div>
            
            {/* Steps */}
            <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Legend Steps</label>
                <select
                    value={config.steps}
                    onChange={(e) => onConfigChange({ ...config, steps: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
                >
                    <option value={5}>5 steps</option>
                    <option value={10}>10 steps</option>
                    <option value={15}>15 steps</option>
                    <option value={20}>20 steps</option>
                </select>
            </div>
            
            {/* Toggles */}
            <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={config.showGrid}
                        onChange={(e) => onConfigChange({ ...config, showGrid: e.target.checked })}
                        className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-cyan-500"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-300">Show grid</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={config.showLabels}
                        onChange={(e) => onConfigChange({ ...config, showLabels: e.target.checked })}
                        className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-cyan-500"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-300">Show values</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={config.showContours}
                        onChange={(e) => onConfigChange({ ...config, showContours: e.target.checked })}
                        className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-cyan-500"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-300">Show contours</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={legendConfig.visible}
                        onChange={(e) => onLegendConfigChange({ ...legendConfig, visible: e.target.checked })}
                        className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-cyan-500"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-300">Show legend</span>
                </label>
            </div>
        </div>
    );
};

// ============================================================================
// MAIN HEATMAP COMPONENT
// ============================================================================

interface ResultsHeatmapProps {
    data: HeatmapDataPoint[];
    rows?: number;
    cols?: number;
    width?: number;
    height?: number;
    title?: string;
    unit?: string;
    type?: HeatmapType;
    onCellClick?: (point: HeatmapDataPoint) => void;
    onExport?: () => void;
}

export const ResultsHeatmap: React.FC<ResultsHeatmapProps> = ({
    data,
    rows = 10,
    cols = 10,
    width = 600,
    height = 400,
    title = 'Results Heatmap',
    unit = 'MPa',
    type = 'stress',
    onCellClick,
    onExport
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    
    const [config, setConfig] = useState<HeatmapConfig>({
        type,
        colorScale: 'engineering',
        steps: 10,
        showGrid: true,
        showLabels: false,
        showContours: false,
        interpolation: 'bilinear',
        opacity: 0.9,
        contourLevels: 5
    });
    
    const [legendConfig, setLegendConfig] = useState<LegendConfig>({
        visible: true,
        position: 'right',
        showValues: true,
        unit,
        title: type.charAt(0).toUpperCase() + type.slice(1)
    });
    
    // Calculate grid cells from data points
    const gridData = useMemo(() => {
        const grid: HeatmapGridCell[] = [];
        const cellWidth = (width - 80) / cols;
        const cellHeight = (height - 60) / rows;
        
        // Initialize grid
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                grid.push({ row, col, value: 0, count: 0 });
            }
        }
        
        // Map data points to grid cells
        data.forEach(point => {
            const normalizedX = Math.max(0, Math.min(cols - 1, Math.floor(point.x * cols)));
            const normalizedY = Math.max(0, Math.min(rows - 1, Math.floor(point.y * rows)));
            const cellIndex = normalizedY * cols + normalizedX;
            
            if (grid[cellIndex]) {
                grid[cellIndex].value += point.value;
                grid[cellIndex].count++;
            }
        });
        
        // Average values
        grid.forEach(cell => {
            if (cell.count > 0) {
                cell.value = cell.value / cell.count;
            }
        });
        
        return grid;
    }, [data, rows, cols, width, height]);
    
    // Calculate min/max values
    const { minValue, maxValue } = useMemo(() => {
        const values = gridData.map(cell => cell.value).filter(v => v !== 0);
        if (values.length === 0) return { minValue: 0, maxValue: 1 };
        return {
            minValue: config.minValue ?? Math.min(...values),
            maxValue: config.maxValue ?? Math.max(...values)
        };
    }, [gridData, config.minValue, config.maxValue]);
    
    const colorScale = COLOR_SCALES[config.colorScale];
    
    const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3));
    const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.5));
    const handleReset = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };
    
    const handleExport = useCallback(() => {
        if (!svgRef.current) return;
        
        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title.replace(/\s+/g, '_')}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        if (onExport) onExport();
    }, [title, onExport]);
    
    const cellWidth = (width - 80) / cols;
    const cellHeight = (height - 60) / rows;
    
    return (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button type="button"
                            onClick={handleZoomOut}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-slate-500 dark:text-slate-400 px-2 min-w-[50px] text-center">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button type="button"
                            onClick={handleZoomIn}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <button type="button"
                            onClick={handleReset}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                            title="Reset View"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                    
                    {/* Settings Toggle */}
                    <button type="button"
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-lg transition-colors ${
                            showSettings ? 'bg-cyan-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-white'
                        }`}
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                    
                    {/* Export */}
                    <button type="button"
                        onClick={handleExport}
                        className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg"
                        title="Export SVG"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            {/* Heatmap Container */}
            <div className="relative p-4">
                {showSettings && (
                    <SettingsPanel
                        config={config}
                        legendConfig={legendConfig}
                        onConfigChange={setConfig}
                        onLegendConfigChange={setLegendConfig}
                    />
                )}
                
                <div className="flex items-start gap-4">
                    {/* SVG Heatmap */}
                    <div 
                        className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                        style={{ 
                            width, 
                            height,
                            cursor: zoom > 1 ? 'move' : 'default'
                        }}
                    >
                        <svg
                            ref={svgRef}
                            width={width}
                            height={height}
                            className="bg-white dark:bg-slate-950 origin-center"
                            style={{ 
                                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`
                            }}
                        >
                            {/* Background */}
                            <rect x="0" y="0" width={width} height={height} fill="#0f172a" />
                            
                            {/* Y-Axis Labels */}
                            {Array.from({ length: rows + 1 }).map((_, i) => (
                                <text
                                    key={`y-${i}`}
                                    x="35"
                                    y={30 + (rows - i) * cellHeight}
                                    textAnchor="end"
                                    className="text-[10px] fill-slate-500"
                                >
                                    {(i / rows).toFixed(1)}
                                </text>
                            ))}
                            
                            {/* X-Axis Labels */}
                            {Array.from({ length: cols + 1 }).map((_, i) => (
                                <text
                                    key={`x-${i}`}
                                    x={40 + i * cellWidth}
                                    y={height - 15}
                                    textAnchor="middle"
                                    className="text-[10px] fill-slate-500"
                                >
                                    {(i / cols).toFixed(1)}
                                </text>
                            ))}
                            
                            {/* Heatmap Cells */}
                            <g transform="translate(40, 20)">
                                {gridData.map((cell, index) => {
                                    const normalizedValue = maxValue !== minValue
                                        ? (cell.value - minValue) / (maxValue - minValue)
                                        : 0.5;
                                    
                                    return (
                                        <HeatmapCell
                                            key={index}
                                            x={cell.col * cellWidth}
                                            y={(rows - 1 - cell.row) * cellHeight}
                                            width={cellWidth - (config.showGrid ? 1 : 0)}
                                            height={cellHeight - (config.showGrid ? 1 : 0)}
                                            value={cell.value}
                                            normalizedValue={normalizedValue}
                                            colorScale={colorScale}
                                            opacity={config.opacity}
                                            showLabel={config.showLabels}
                                            onHover={setTooltip}
                                        />
                                    );
                                })}
                                
                                {/* Contour Lines */}
                                {config.showContours && (
                                    <g className="pointer-events-none">
                                        {/* Simplified contour visualization */}
                                        {Array.from({ length: config.contourLevels }).map((_, i) => {
                                            const level = (i + 1) / (config.contourLevels + 1);
                                            const levelValue = minValue + level * (maxValue - minValue);
                                            
                                            return (
                                                <g key={`contour-${i}`}>
                                                    {gridData.map((cell, cellIndex) => {
                                                        const normalizedValue = maxValue !== minValue
                                                            ? (cell.value - minValue) / (maxValue - minValue)
                                                            : 0.5;
                                                        
                                                        // Check if this cell is near the contour level
                                                        if (Math.abs(normalizedValue - level) < 0.05) {
                                                            return (
                                                                <rect
                                                                    key={`contour-${i}-${cellIndex}`}
                                                                    x={cell.col * cellWidth}
                                                                    y={(rows - 1 - cell.row) * cellHeight}
                                                                    width={cellWidth}
                                                                    height={cellHeight}
                                                                    fill="none"
                                                                    stroke="white"
                                                                    strokeWidth="1"
                                                                    strokeOpacity="0.3"
                                                                />
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </g>
                                            );
                                        })}
                                    </g>
                                )}
                            </g>
                        </svg>
                    </div>
                    
                    {/* Legend */}
                    {legendConfig.visible && (
                        <div className="flex-shrink-0">
                            <ColorScaleLegend
                                config={config}
                                legendConfig={legendConfig}
                                minValue={minValue}
                                maxValue={maxValue}
                            />
                        </div>
                    )}
                </div>
                
                {/* Tooltip */}
                <HeatmapTooltip data={tooltip} unit={unit} />
            </div>
            
            {/* Footer Stats */}
            <div className="px-4 py-3 bg-slate-100/30 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-4">
                    <span>
                        <strong className="text-slate-900 dark:text-white">{data.length}</strong> data points
                    </span>
                    <span>
                        <strong className="text-slate-900 dark:text-white">{rows}×{cols}</strong> grid
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <span>
                        Min: <strong className="text-cyan-400">{formatValue(minValue)} {unit}</strong>
                    </span>
                    <span>
                        Max: <strong className="text-red-400">{formatValue(maxValue)} {unit}</strong>
                    </span>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// UTILIZATION HEATMAP (Specialized)
// ============================================================================

interface UtilizationHeatmapProps {
    memberUtilizations: Array<{
        memberId: string;
        memberName: string;
        utilization: number;
        stressRatio: number;
        deflectionRatio: number;
    }>;
    layout?: 'grid' | 'list';
    width?: number;
}

export const UtilizationHeatmap: React.FC<UtilizationHeatmapProps> = ({
    memberUtilizations,
    layout = 'grid',
    width = 800
}) => {
    const [sortBy, setSortBy] = useState<'name' | 'utilization'>('utilization');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    
    const sortedMembers = useMemo(() => {
        return [...memberUtilizations].sort((a, b) => {
            const aVal = sortBy === 'name' ? a.memberName : a.utilization;
            const bVal = sortBy === 'name' ? b.memberName : b.utilization;
            
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            
            return sortOrder === 'asc' 
                ? (aVal as number) - (bVal as number) 
                : (bVal as number) - (aVal as number);
        });
    }, [memberUtilizations, sortBy, sortOrder]);
    
    const getUtilizationColor = (ratio: number): string => {
        if (ratio <= 0.5) return '#22c55e'; // Green
        if (ratio <= 0.7) return '#84cc16'; // Lime
        if (ratio <= 0.85) return '#eab308'; // Yellow
        if (ratio <= 1.0) return '#f97316'; // Orange
        return '#ef4444'; // Red - over-utilized
    };
    
    const getUtilizationLabel = (ratio: number): string => {
        if (ratio <= 0.5) return 'Excellent';
        if (ratio <= 0.7) return 'Good';
        if (ratio <= 0.85) return 'Adequate';
        if (ratio <= 1.0) return 'Near Limit';
        return 'Over-utilized';
    };
    
    return (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden" style={{ width }}>
            <div className="px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-semibold text-slate-900 dark:text-white">Member Utilization Ratios</h3>
                </div>
                
                <div className="flex items-center gap-2">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'name' | 'utilization')}
                        className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white"
                    >
                        <option value="utilization">Sort by Utilization</option>
                        <option value="name">Sort by Name</option>
                    </select>
                    <button type="button"
                        onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                        className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded"
                    >
                        {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                </div>
            </div>
            
            <div className="p-4">
                {layout === 'grid' ? (
                    <div className="grid grid-cols-4 gap-2">
                        {sortedMembers.map(member => (
                            <div
                                key={member.memberId}
                                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer"
                                style={{
                                    background: `linear-gradient(135deg, ${getUtilizationColor(member.utilization)}15, ${getUtilizationColor(member.utilization)}05)`
                                }}
                            >
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{member.memberName}</div>
                                <div 
                                    className="text-2xl font-bold"
                                    style={{ color: getUtilizationColor(member.utilization) }}
                                >
                                    {(member.utilization * 100).toFixed(0)}%
                                </div>
                                <div 
                                    className="text-[10px] mt-1"
                                    style={{ color: getUtilizationColor(member.utilization) }}
                                >
                                    {getUtilizationLabel(member.utilization)}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sortedMembers.map(member => (
                            <div
                                key={member.memberId}
                                className="flex items-center gap-4 p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div className="w-32 text-sm text-slate-900 dark:text-white font-medium truncate">
                                    {member.memberName}
                                </div>
                                <div className="flex-1">
                                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full transition-all duration-500"
                                            style={{
                                                width: `${Math.min(member.utilization * 100, 100)}%`,
                                                background: getUtilizationColor(member.utilization)
                                            }}
                                        />
                                    </div>
                                </div>
                                <div 
                                    className="w-16 text-right font-semibold"
                                    style={{ color: getUtilizationColor(member.utilization) }}
                                >
                                    {(member.utilization * 100).toFixed(1)}%
                                </div>
                                <div 
                                    className="w-24 text-xs text-right"
                                    style={{ color: getUtilizationColor(member.utilization) }}
                                >
                                    {getUtilizationLabel(member.utilization)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Legend */}
            <div className="px-4 py-3 bg-slate-100/30 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-center gap-6 text-xs">
                    {[
                        { label: 'Excellent', range: '≤50%', color: '#22c55e' },
                        { label: 'Good', range: '≤70%', color: '#84cc16' },
                        { label: 'Adequate', range: '≤85%', color: '#eab308' },
                        { label: 'Near Limit', range: '≤100%', color: '#f97316' },
                        { label: 'Over-utilized', range: '>100%', color: '#ef4444' }
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-1.5">
                            <div 
                                className="w-3 h-3 rounded"
                                style={{ background: item.color }}
                            />
                            <span className="text-slate-500 dark:text-slate-400">{item.label}</span>
                            <span className="text-slate-500 dark:text-slate-400">({item.range})</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ResultsHeatmap;
export { ColorScaleLegend, COLOR_SCALES, SCALE_LABELS };
