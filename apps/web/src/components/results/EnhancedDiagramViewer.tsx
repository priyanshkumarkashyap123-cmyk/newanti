/**
 * EnhancedDiagramViewer.tsx - Professional Force Diagram Visualization
 * 
 * A comprehensive, visually stunning diagram viewer for structural analysis:
 * - Interactive BMD, SFD, Axial Force diagrams
 * - Real-time section scanner with exact values
 * - Color gradients (Red = Tension/Sagging, Blue = Compression/Hogging)
 * - Smooth animations and transitions
 * - Critical points highlighting (max, min, zero crossings)
 * - Professional engineering annotations
 */

import React, { FC, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart2,
    Activity,
    ArrowUpDown,
    TrendingDown,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Download,
    Copy,
    Info,
    Target,
    Crosshair
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface DiagramPoint {
    x: number;           // Position along member (0 to L)
    shear: number;       // Shear force (kN)
    moment: number;      // Bending moment (kNm)
    axial: number;       // Axial force (kN)
    deflection: number;  // Deflection (mm)
}

export interface CriticalPoint {
    x: number;
    value: number;
    type: 'max' | 'min' | 'zero' | 'load';
    label: string;
}

export type DiagramType = 'SFD' | 'BMD' | 'AFD' | 'DEFLECTION';

interface EnhancedDiagramViewerProps {
    memberLength: number;
    memberId: string;
    data: DiagramPoint[];
    activeType: DiagramType;
    onTypeChange: (type: DiagramType) => void;
    units?: {
        force: string;
        moment: string;
        length: string;
        deflection: string;
    };
}

// ============================================
// CONSTANTS
// ============================================

const DIAGRAM_COLORS = {
    SFD: {
        positive: '#ef4444',  // Red - Positive shear
        negative: '#3b82f6',  // Blue - Negative shear
        gradient: ['#fca5a5', '#ef4444', '#b91c1c'],
        fill: 'rgba(239, 68, 68, 0.2)',
        stroke: '#ef4444',
        label: 'Shear Force'
    },
    BMD: {
        positive: '#22c55e',  // Green - Sagging (positive moment)
        negative: '#8b5cf6',  // Purple - Hogging (negative moment)
        gradient: ['#86efac', '#22c55e', '#15803d'],
        fill: 'rgba(34, 197, 94, 0.2)',
        stroke: '#22c55e',
        label: 'Bending Moment'
    },
    AFD: {
        positive: '#f97316',  // Orange - Tension
        negative: '#06b6d4',  // Cyan - Compression
        gradient: ['#fdba74', '#f97316', '#c2410c'],
        fill: 'rgba(249, 115, 22, 0.2)',
        stroke: '#f97316',
        label: 'Axial Force'
    },
    DEFLECTION: {
        positive: '#6366f1',  // Indigo
        negative: '#ec4899',  // Pink
        gradient: ['#a5b4fc', '#6366f1', '#4338ca'],
        fill: 'rgba(99, 102, 241, 0.2)',
        stroke: '#6366f1',
        label: 'Deflection'
    }
};

const PADDING = { top: 60, right: 80, bottom: 80, left: 80 };

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatValue = (value: number, precision: number = 2): string => {
    if (Math.abs(value) < 0.01) return '0';
    return value.toFixed(precision);
};

const getValueAtPosition = (data: DiagramPoint[], x: number, type: DiagramType): number => {
    if (data.length === 0) return 0;
    
    // Find bracketing points and interpolate
    for (let i = 0; i < data.length - 1; i++) {
        const p1 = data[i];
        const p2 = data[i + 1];
        if (p1 && p2 && x >= p1.x && x <= p2.x) {
            const t = (x - p1.x) / (p2.x - p1.x);
            switch (type) {
                case 'SFD': return p1.shear + t * (p2.shear - p1.shear);
                case 'BMD': return p1.moment + t * (p2.moment - p1.moment);
                case 'AFD': return p1.axial + t * (p2.axial - p1.axial);
                case 'DEFLECTION': return p1.deflection + t * (p2.deflection - p1.deflection);
            }
        }
    }
    return 0;
};

const findCriticalPoints = (data: DiagramPoint[], type: DiagramType): CriticalPoint[] => {
    if (data.length === 0) return [];
    
    const criticals: CriticalPoint[] = [];
    const getValue = (p: DiagramPoint) => {
        switch (type) {
            case 'SFD': return p.shear;
            case 'BMD': return p.moment;
            case 'AFD': return p.axial;
            case 'DEFLECTION': return p.deflection;
        }
    };
    
    let maxVal = -Infinity, minVal = Infinity;
    let maxPoint: DiagramPoint | null = null;
    let minPoint: DiagramPoint | null = null;
    
    // Find max, min, and zero crossings
    for (let i = 0; i < data.length; i++) {
        const p = data[i];
        if (!p) continue;
        const val = getValue(p);
        
        if (val > maxVal) {
            maxVal = val;
            maxPoint = p;
        }
        if (val < minVal) {
            minVal = val;
            minPoint = p;
        }
        
        // Check for zero crossings
        if (i > 0) {
            const prevP = data[i - 1];
            if (prevP) {
                const prevVal = getValue(prevP);
                if ((prevVal > 0 && val < 0) || (prevVal < 0 && val > 0)) {
                    // Linear interpolation to find zero crossing
                    const t = prevVal / (prevVal - val);
                    const zeroX = prevP.x + t * (p.x - prevP.x);
                    criticals.push({
                        x: zeroX,
                        value: 0,
                        type: 'zero',
                        label: 'Zero Point'
                    });
                }
            }
        }
    }
    
    if (maxPoint && maxVal > 0) {
        criticals.push({
            x: maxPoint.x,
            value: maxVal,
            type: 'max',
            label: `Max: ${formatValue(maxVal)}`
        });
    }
    
    if (minPoint && minVal < 0) {
        criticals.push({
            x: minPoint.x,
            value: minVal,
            type: 'min',
            label: `Min: ${formatValue(minVal)}`
        });
    }
    
    return criticals;
};

// ============================================
// DIAGRAM CANVAS COMPONENT
// ============================================

interface DiagramCanvasProps {
    data: DiagramPoint[];
    type: DiagramType;
    memberLength: number;
    width: number;
    height: number;
    onHover: (x: number | null, value: number | null) => void;
}

const DiagramCanvas: FC<DiagramCanvasProps> = ({
    data,
    type,
    memberLength,
    width,
    height,
    onHover
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
    
    const colors = DIAGRAM_COLORS[type];
    
    // Calculate diagram bounds
    const bounds = useMemo(() => {
        if (data.length === 0) return { minVal: -1, maxVal: 1 };
        
        const values = data.map(p => {
            switch (type) {
                case 'SFD': return p.shear;
                case 'BMD': return p.moment;
                case 'AFD': return p.axial;
                case 'DEFLECTION': return p.deflection;
            }
        });
        
        const minVal = Math.min(...values, 0);
        const maxVal = Math.max(...values, 0);
        const padding = Math.max(Math.abs(maxVal), Math.abs(minVal)) * 0.1 || 1;
        
        return {
            minVal: minVal - padding,
            maxVal: maxVal + padding
        };
    }, [data, type]);
    
    // Critical points
    const criticalPoints = useMemo(() => findCriticalPoints(data, type), [data, type]);
    
    // Transform functions
    const xToCanvas = useCallback((x: number) => {
        return PADDING.left + (x / memberLength) * (width - PADDING.left - PADDING.right);
    }, [memberLength, width]);
    
    const yToCanvas = useCallback((val: number) => {
        const range = bounds.maxVal - bounds.minVal;
        const normalized = (bounds.maxVal - val) / range;
        return PADDING.top + normalized * (height - PADDING.top - PADDING.bottom);
    }, [bounds, height]);
    
    const canvasToX = useCallback((canvasX: number) => {
        return ((canvasX - PADDING.left) / (width - PADDING.left - PADDING.right)) * memberLength;
    }, [memberLength, width]);
    
    // Draw diagram
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Clear
        ctx.clearRect(0, 0, width, height);
        
        // Enable anti-aliasing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        // Vertical grid lines
        const xStep = memberLength / 10;
        for (let x = 0; x <= memberLength; x += xStep) {
            const canvasX = xToCanvas(x);
            ctx.beginPath();
            ctx.moveTo(canvasX, PADDING.top);
            ctx.lineTo(canvasX, height - PADDING.bottom);
            ctx.stroke();
        }
        
        // Horizontal grid lines
        const yRange = bounds.maxVal - bounds.minVal;
        const yStep = yRange / 8;
        for (let v = bounds.minVal; v <= bounds.maxVal; v += yStep) {
            const canvasY = yToCanvas(v);
            ctx.beginPath();
            ctx.moveTo(PADDING.left, canvasY);
            ctx.lineTo(width - PADDING.right, canvasY);
            ctx.stroke();
        }
        
        // Draw baseline (y = 0)
        const baselineY = yToCanvas(0);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(PADDING.left, baselineY);
        ctx.lineTo(width - PADDING.right, baselineY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw member axis (thick line at bottom)
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(PADDING.left, height - PADDING.bottom + 20);
        ctx.lineTo(width - PADDING.right, height - PADDING.bottom + 20);
        ctx.stroke();
        
        // Draw support symbols
        ctx.fillStyle = '#fff';
        // Left support (pin)
        ctx.beginPath();
        ctx.moveTo(PADDING.left, height - PADDING.bottom + 20);
        ctx.lineTo(PADDING.left - 10, height - PADDING.bottom + 35);
        ctx.lineTo(PADDING.left + 10, height - PADDING.bottom + 35);
        ctx.closePath();
        ctx.fill();
        
        // Right support (roller)
        ctx.beginPath();
        ctx.arc(width - PADDING.right, height - PADDING.bottom + 30, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw filled area under curve
        if (data.length > 1) {
            ctx.beginPath();
            ctx.moveTo(xToCanvas(data[0]?.x ?? 0), baselineY);
            
            for (const p of data) {
                if (!p) continue;
                let val: number;
                switch (type) {
                    case 'SFD': val = p.shear; break;
                    case 'BMD': val = p.moment; break;
                    case 'AFD': val = p.axial; break;
                    case 'DEFLECTION': val = p.deflection; break;
                }
                ctx.lineTo(xToCanvas(p.x), yToCanvas(val));
            }
            
            const lastPoint = data[data.length - 1];
            if (lastPoint) {
                ctx.lineTo(xToCanvas(lastPoint.x), baselineY);
            }
            ctx.closePath();
            
            // Create gradient fill
            const gradient = ctx.createLinearGradient(0, PADDING.top, 0, height - PADDING.bottom);
            gradient.addColorStop(0, colors.fill.replace('0.2', '0.4'));
            gradient.addColorStop(0.5, colors.fill);
            gradient.addColorStop(1, colors.fill.replace('0.2', '0.1'));
            ctx.fillStyle = gradient;
            ctx.fill();
        }
        
        // Draw diagram line
        if (data.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = colors.stroke;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            let isFirst = true;
            for (const p of data) {
                if (!p) continue;
                let val: number;
                switch (type) {
                    case 'SFD': val = p.shear; break;
                    case 'BMD': val = p.moment; break;
                    case 'AFD': val = p.axial; break;
                    case 'DEFLECTION': val = p.deflection; break;
                }
                
                const x = xToCanvas(p.x);
                const y = yToCanvas(val);
                
                if (isFirst) {
                    ctx.moveTo(x, y);
                    isFirst = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
        
        // Draw critical points
        for (const cp of criticalPoints) {
            const x = xToCanvas(cp.x);
            const y = yToCanvas(cp.value);
            
            // Draw point
            ctx.beginPath();
            ctx.fillStyle = cp.type === 'max' ? colors.positive : 
                           cp.type === 'min' ? colors.negative : '#fff';
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw label
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            
            const labelY = cp.type === 'min' ? y + 20 : y - 12;
            ctx.fillText(cp.label, x, labelY);
        }
        
        // Draw X axis labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        
        for (let x = 0; x <= memberLength; x += xStep) {
            const canvasX = xToCanvas(x);
            ctx.fillText(`${x.toFixed(1)}m`, canvasX, height - PADDING.bottom + 50);
        }
        
        // Draw Y axis labels
        ctx.textAlign = 'right';
        for (let v = bounds.minVal; v <= bounds.maxVal; v += yStep) {
            const canvasY = yToCanvas(v);
            ctx.fillText(formatValue(v), PADDING.left - 10, canvasY + 4);
        }
        
        // Draw scanner line if hovering
        if (mousePos) {
            const x = canvasToX(mousePos.x);
            if (x >= 0 && x <= memberLength) {
                const val = getValueAtPosition(data, x, type);
                const canvasX = xToCanvas(x);
                const canvasY = yToCanvas(val);
                
                // Vertical line
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(canvasX, PADDING.top);
                ctx.lineTo(canvasX, height - PADDING.bottom);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Point on curve
                ctx.beginPath();
                ctx.fillStyle = '#fff';
                ctx.arc(canvasX, canvasY, 8, 0, Math.PI * 2);
                ctx.fill();
                
                // Value tooltip
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.strokeStyle = colors.stroke;
                ctx.lineWidth = 2;
                
                const tooltipWidth = 120;
                const tooltipHeight = 50;
                const tooltipX = Math.min(canvasX + 15, width - PADDING.right - tooltipWidth);
                const tooltipY = Math.max(canvasY - tooltipHeight - 10, PADDING.top);
                
                // Rounded rectangle
                const radius = 8;
                ctx.beginPath();
                ctx.moveTo(tooltipX + radius, tooltipY);
                ctx.lineTo(tooltipX + tooltipWidth - radius, tooltipY);
                ctx.quadraticCurveTo(tooltipX + tooltipWidth, tooltipY, tooltipX + tooltipWidth, tooltipY + radius);
                ctx.lineTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight - radius);
                ctx.quadraticCurveTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight, tooltipX + tooltipWidth - radius, tooltipY + tooltipHeight);
                ctx.lineTo(tooltipX + radius, tooltipY + tooltipHeight);
                ctx.quadraticCurveTo(tooltipX, tooltipY + tooltipHeight, tooltipX, tooltipY + tooltipHeight - radius);
                ctx.lineTo(tooltipX, tooltipY + radius);
                ctx.quadraticCurveTo(tooltipX, tooltipY, tooltipX + radius, tooltipY);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                // Tooltip text
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 14px Inter, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(formatValue(val, 3), tooltipX + 10, tooltipY + 22);
                
                ctx.font = '11px Inter, sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.fillText(`@ x = ${formatValue(x, 2)}m`, tooltipX + 10, tooltipY + 40);
            }
        }
        
    }, [data, type, width, height, bounds, colors, criticalPoints, mousePos, xToCanvas, yToCanvas, canvasToX, memberLength]);
    
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setMousePos({ x, y });
            
            const memberX = canvasToX(x);
            if (memberX >= 0 && memberX <= memberLength) {
                const val = getValueAtPosition(data, memberX, type);
                onHover(memberX, val);
            }
        }
    }, [canvasToX, memberLength, data, type, onHover]);
    
    const handleMouseLeave = useCallback(() => {
        setMousePos(null);
        onHover(null, null);
    }, [onHover]);
    
    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="cursor-crosshair"
        />
    );
};

// ============================================
// TYPE SELECTOR TAB
// ============================================

interface TypeTabProps {
    type: DiagramType;
    active: boolean;
    onClick: () => void;
}

const TypeTab: FC<TypeTabProps> = ({ type, active, onClick }) => {
    const config = DIAGRAM_COLORS[type];
    const icons = {
        SFD: Activity,
        BMD: BarChart2,
        AFD: ArrowUpDown,
        DEFLECTION: TrendingDown
    };
    const Icon = icons[type];
    
    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                transition-all duration-200 border
                ${active 
                    ? 'border-transparent text-slate-900 dark:text-white shadow-lg'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'
                }
            `}
            style={{
                background: active 
                    ? `linear-gradient(135deg, ${config.gradient[0]}, ${config.gradient[1]})` 
                    : 'transparent'
            }}
        >
            <Icon className="w-4 h-4" />
            {config.label}
        </motion.button>
    );
};

// ============================================
// LEGEND COMPONENT
// ============================================

interface LegendProps {
    type: DiagramType;
    units: {
        force: string;
        moment: string;
        length: string;
        deflection: string;
    };
}

const Legend: FC<LegendProps> = ({ type, units }) => {
    const colors = DIAGRAM_COLORS[type];
    
    const getUnit = () => {
        switch (type) {
            case 'SFD': return units.force;
            case 'BMD': return units.moment;
            case 'AFD': return units.force;
            case 'DEFLECTION': return units.deflection;
        }
    };
    
    const getLabels = () => {
        switch (type) {
            case 'SFD': return { positive: 'Positive Shear', negative: 'Negative Shear' };
            case 'BMD': return { positive: 'Sagging (+)', negative: 'Hogging (-)' };
            case 'AFD': return { positive: 'Tension', negative: 'Compression' };
            case 'DEFLECTION': return { positive: 'Upward', negative: 'Downward' };
        }
    };
    
    const labels = getLabels();
    
    return (
        <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
                <div 
                    className="w-4 h-4 rounded"
                    style={{ background: colors.positive }}
                />
                <span className="text-slate-500 dark:text-slate-400">{labels.positive}</span>
            </div>
            <div className="flex items-center gap-2">
                <div 
                    className="w-4 h-4 rounded"
                    style={{ background: colors.negative }}
                />
                <span className="text-slate-500 dark:text-slate-400">{labels.negative}</span>
            </div>
            <div className="text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700 pl-4">
                Units: <span className="text-slate-600 dark:text-slate-300">{getUnit()}</span>
            </div>
        </div>
    );
};

// ============================================
// SECTION VALUES PANEL
// ============================================

interface SectionValuesPanelProps {
    x: number | null;
    value: number | null;
    type: DiagramType;
    memberLength: number;
    units: {
        force: string;
        moment: string;
        length: string;
        deflection: string;
    };
}

const SectionValuesPanel: FC<SectionValuesPanelProps> = ({ 
    x, 
    value, 
    type, 
    memberLength,
    units 
}) => {
    const colors = DIAGRAM_COLORS[type];
    
    const getUnit = () => {
        switch (type) {
            case 'SFD': return units.force;
            case 'BMD': return units.moment;
            case 'AFD': return units.force;
            case 'DEFLECTION': return units.deflection;
        }
    };
    
    if (x === null || value === null) {
        return (
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <Crosshair className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400 text-sm">Hover over diagram to see section values</span>
            </div>
        );
    }
    
    const ratio = x / memberLength;
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-6 px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
        >
            <div className="flex items-center gap-2">
                <Target className="w-4 h-4" style={{ color: colors.stroke }} />
                <span className="text-slate-500 dark:text-slate-400 text-sm">Section at</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">x = {formatValue(x, 2)} m</span>
                <span className="text-slate-500 dark:text-slate-400 text-sm">({(ratio * 100).toFixed(1)}%)</span>
            </div>
            
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            
            <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400 text-sm">{colors.label}:</span>
                <span 
                    className="font-mono font-bold text-lg"
                    style={{ color: value >= 0 ? colors.positive : colors.negative }}
                >
                    {value >= 0 ? '+' : ''}{formatValue(value, 3)} {getUnit()}
                </span>
            </div>
        </motion.div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const EnhancedDiagramViewer: FC<EnhancedDiagramViewerProps> = ({
    memberLength,
    memberId,
    data,
    activeType,
    onTypeChange,
    units = {
        force: 'kN',
        moment: 'kNm',
        length: 'm',
        deflection: 'mm'
    }
}) => {
    const [sectionX, setSectionX] = useState<number | null>(null);
    const [sectionValue, setSectionValue] = useState<number | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const handleHover = useCallback((x: number | null, value: number | null) => {
        setSectionX(x);
        setSectionValue(value);
    }, []);
    
    // Get summary stats
    const stats = useMemo(() => {
        if (data.length === 0) return null;
        
        const getVal = (p: DiagramPoint) => {
            switch (activeType) {
                case 'SFD': return p.shear;
                case 'BMD': return p.moment;
                case 'AFD': return p.axial;
                case 'DEFLECTION': return p.deflection;
            }
        };
        
        const values = data.map(getVal);
        const max = Math.max(...values);
        const min = Math.min(...values);
        const maxAbs = Math.max(Math.abs(max), Math.abs(min));
        
        return { max, min, maxAbs };
    }, [data, activeType]);
    
    const colors = DIAGRAM_COLORS[activeType];
    
    return (
        <motion.div 
            ref={containerRef}
            layout
            className={`
                bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden
                ${isFullscreen ? 'fixed inset-4 z-50' : ''}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <BarChart2 className="w-5 h-5" style={{ color: colors.stroke }} />
                        Force Diagram Analysis
                    </h3>
                    <span className="text-slate-500 dark:text-slate-400 text-sm">Member: {memberId}</span>
                </div>
                
                <div className="flex items-center gap-2">
                    <button type="button"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                    <button type="button" aria-label="Download" title="Download" className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <Download className="w-4 h-4" />
                    </button>
                    <button type="button" aria-label="Copy" title="Copy" className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            {/* Type Selector */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    {(['SFD', 'BMD', 'AFD', 'DEFLECTION'] as DiagramType[]).map(type => (
                        <TypeTab
                            key={type}
                            type={type}
                            active={activeType === type}
                            onClick={() => onTypeChange(type)}
                        />
                    ))}
                </div>
                
                <Legend type={activeType} units={units} />
            </div>
            
            {/* Stats Bar */}
            {stats && (
                <div className="flex items-center gap-6 px-4 py-2 bg-slate-100/30 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Max:</span>
                        <span className="font-mono font-bold" style={{ color: colors.positive }}>
                            {formatValue(stats.max, 2)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Min:</span>
                        <span className="font-mono font-bold" style={{ color: colors.negative }}>
                            {formatValue(stats.min, 2)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">|Max|:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {formatValue(stats.maxAbs, 2)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Length:</span>
                        <span className="font-mono text-slate-900 dark:text-white">
                            {formatValue(memberLength, 2)} {units.length}
                        </span>
                    </div>
                </div>
            )}
            
            {/* Diagram Canvas */}
            <div className="p-4">
                <div className="bg-white dark:bg-slate-950 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                    <DiagramCanvas
                        data={data}
                        type={activeType}
                        memberLength={memberLength}
                        width={isFullscreen ? window.innerWidth - 64 : 800}
                        height={isFullscreen ? window.innerHeight - 300 : 400}
                        onHover={handleHover}
                    />
                </div>
            </div>
            
            {/* Section Values Panel */}
            <div className="px-4 pb-4">
                <SectionValuesPanel
                    x={sectionX}
                    value={sectionValue}
                    type={activeType}
                    memberLength={memberLength}
                    units={units}
                />
            </div>
        </motion.div>
    );
};

export default EnhancedDiagramViewer;
