/**
 * EnhancedHeatMap.tsx - Professional Stress/Displacement Heat Map Visualization
 * 
 * Features:
 * - Continuous color gradient from Blue (low) → Green → Yellow → Red (high)
 * - Interactive legend with value scale
 * - Member-by-member coloring based on stress/displacement/utilization
 * - Tooltips showing exact values
 * - Animated transitions between visualization modes
 * - Support for multiple heat map types
 */

import React, { FC, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Flame,
    Thermometer,
    Activity,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Info,
    RefreshCw
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface MemberData {
    id: string;
    startPos: [number, number, number];
    endPos: [number, number, number];
    stress: number;           // MPa
    maxStress: number;        // MPa (capacity)
    displacement: number;     // mm
    utilization: number;      // ratio (0-1+)
    axialForce: number;       // kN
    maxMoment: number;        // kNm
    maxShear: number;         // kN
}

export type HeatMapType = 'stress' | 'displacement' | 'utilization' | 'axial' | 'moment' | 'shear';

interface HeatMapConfig {
    id: HeatMapType;
    label: string;
    unit: string;
    icon: React.ElementType;
    colorScale: 'stress' | 'diverging' | 'sequential';
    description: string;
}

interface EnhancedHeatMapProps {
    members: MemberData[];
    activeType: HeatMapType;
    onTypeChange: (type: HeatMapType) => void;
    onMemberClick?: (memberId: string) => void;
    allowableStress?: number;    // MPa
    maxDisplacement?: number;    // mm (L/250 or similar)
}

// ============================================
// CONSTANTS
// ============================================

const HEAT_MAP_CONFIGS: HeatMapConfig[] = [
    {
        id: 'stress',
        label: 'Stress',
        unit: 'MPa',
        icon: Activity,
        colorScale: 'stress',
        description: 'Von Mises stress distribution'
    },
    {
        id: 'displacement',
        label: 'Displacement',
        unit: 'mm',
        icon: Thermometer,
        colorScale: 'sequential',
        description: 'Total nodal displacement'
    },
    {
        id: 'utilization',
        label: 'Utilization',
        unit: '%',
        icon: Flame,
        colorScale: 'stress',
        description: 'Design capacity utilization ratio'
    },
    {
        id: 'axial',
        label: 'Axial Force',
        unit: 'kN',
        icon: Activity,
        colorScale: 'diverging',
        description: 'Tension (+) / Compression (-)'
    },
    {
        id: 'moment',
        label: 'Bending Moment',
        unit: 'kNm',
        icon: Activity,
        colorScale: 'sequential',
        description: 'Maximum bending moment'
    },
    {
        id: 'shear',
        label: 'Shear Force',
        unit: 'kN',
        icon: Activity,
        colorScale: 'sequential',
        description: 'Maximum shear force'
    }
];

// Color scales
const STRESS_COLORS = [
    { pos: 0.0, color: '#3b82f6' },   // Blue - Low
    { pos: 0.25, color: '#22c55e' },  // Green
    { pos: 0.5, color: '#eab308' },   // Yellow
    { pos: 0.75, color: '#f97316' },  // Orange
    { pos: 1.0, color: '#ef4444' }    // Red - High
];

const DIVERGING_COLORS = [
    { pos: 0.0, color: '#3b82f6' },   // Blue - Compression
    { pos: 0.5, color: '#ffffff' },   // White - Zero
    { pos: 1.0, color: '#ef4444' }    // Red - Tension
];

const SEQUENTIAL_COLORS = [
    { pos: 0.0, color: '#1e3a5f' },   // Dark blue
    { pos: 0.25, color: '#3b82f6' },  // Blue
    { pos: 0.5, color: '#22c55e' },   // Green
    { pos: 0.75, color: '#eab308' },  // Yellow
    { pos: 1.0, color: '#ef4444' }    // Red
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

const interpolateColor = (colors: typeof STRESS_COLORS, t: number): string => {
    const clampedT = Math.max(0, Math.min(1, t));
    
    // Find bracketing colors
    let c1 = colors[0]!;
    let c2 = colors[colors.length - 1]!;
    
    for (let i = 0; i < colors.length - 1; i++) {
        if (clampedT >= colors[i]!.pos && clampedT <= colors[i + 1]!.pos) {
            c1 = colors[i]!;
            c2 = colors[i + 1]!;
            break;
        }
    }
    
    // Interpolate
    const localT = (clampedT - c1.pos) / (c2.pos - c1.pos);
    
    // Parse colors
    const parseHex = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    };
    
    const col1 = parseHex(c1.color);
    const col2 = parseHex(c2.color);
    
    const r = Math.round(col1.r + localT * (col2.r - col1.r));
    const g = Math.round(col1.g + localT * (col2.g - col1.g));
    const b = Math.round(col1.b + localT * (col2.b - col1.b));
    
    return `rgb(${r}, ${g}, ${b})`;
};

const getColor = (
    value: number, 
    minVal: number, 
    maxVal: number, 
    colorScale: 'stress' | 'diverging' | 'sequential'
): string => {
    let t: number;
    let colors: typeof STRESS_COLORS;
    
    switch (colorScale) {
        case 'diverging':
            // For diverging, center is 0
            const absMax = Math.max(Math.abs(minVal), Math.abs(maxVal));
            t = (value + absMax) / (2 * absMax);
            colors = DIVERGING_COLORS;
            break;
        case 'sequential':
        case 'stress':
        default:
            t = maxVal > minVal ? (value - minVal) / (maxVal - minVal) : 0;
            colors = colorScale === 'stress' ? STRESS_COLORS : SEQUENTIAL_COLORS;
            break;
    }
    
    return interpolateColor(colors, t);
};

const formatValue = (value: number, unit: string): string => {
    if (unit === '%') {
        return `${(value * 100).toFixed(1)}%`;
    }
    if (Math.abs(value) >= 1000) {
        return `${(value / 1000).toFixed(2)}k`;
    }
    return value.toFixed(2);
};

const getStatusIcon = (utilization: number): React.ReactNode => {
    if (utilization <= 0.7) {
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (utilization <= 0.9) {
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    } else if (utilization <= 1.0) {
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    } else {
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
};

// ============================================
// COLOR LEGEND COMPONENT
// ============================================

interface ColorLegendProps {
    minVal: number;
    maxVal: number;
    unit: string;
    colorScale: 'stress' | 'diverging' | 'sequential';
    label: string;
}

const ColorLegend: FC<ColorLegendProps> = ({ minVal, maxVal, unit, colorScale, label }) => {
    const gradientStops = useMemo(() => {
        const colors = colorScale === 'diverging' ? DIVERGING_COLORS :
                      colorScale === 'sequential' ? SEQUENTIAL_COLORS : STRESS_COLORS;
        return colors.map(c => `${c.color} ${c.pos * 100}%`).join(', ');
    }, [colorScale]);
    
    const ticks = useMemo(() => {
        const numTicks = 5;
        const result = [];
        for (let i = 0; i <= numTicks; i++) {
            const t = i / numTicks;
            const value = minVal + t * (maxVal - minVal);
            result.push({ t, value });
        }
        return result;
    }, [minVal, maxVal]);
    
    return (
        <div className="flex flex-col gap-2">
            <div className="text-xs font-medium tracking-wide tracking-wide text-[#869ab8] uppercase tracking-wide">
                {label} ({unit})
            </div>
            
            {/* Color bar */}
            <div 
                className="h-4 rounded-full overflow-hidden border border-[#1a2333]"
                style={{
                    background: `linear-gradient(to right, ${gradientStops})`,
                    width: '200px'
                }}
            />
            
            {/* Tick labels */}
            <div className="flex justify-between text-xs text-[#869ab8]" style={{ width: '200px' }}>
                {ticks.map((tick, i) => (
                    <span key={i} className="font-mono">
                        {formatValue(tick.value, unit === '%' ? '%' : '')}
                    </span>
                ))}
            </div>
        </div>
    );
};

// ============================================
// MEMBER CARD COMPONENT
// ============================================

interface MemberCardProps {
    member: MemberData;
    type: HeatMapType;
    config: HeatMapConfig;
    minVal: number;
    maxVal: number;
    isSelected: boolean;
    onClick: () => void;
}

const MemberCard: FC<MemberCardProps> = ({ 
    member, 
    type, 
    config, 
    minVal, 
    maxVal, 
    isSelected, 
    onClick 
}) => {
    const value = useMemo(() => {
        switch (type) {
            case 'stress': return member.stress;
            case 'displacement': return member.displacement;
            case 'utilization': return member.utilization;
            case 'axial': return member.axialForce;
            case 'moment': return member.maxMoment;
            case 'shear': return member.maxShear;
        }
    }, [member, type]);
    
    const color = getColor(value, minVal, maxVal, config.colorScale);
    
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            onClick={onClick}
            className={`
                relative p-3 rounded-lg border cursor-pointer transition-all
                ${isSelected 
                    ? 'border-blue-500 bg-blue-500/10' 
                    : 'border-[#1a2333] hover:border-slate-300 dark:hover:border-slate-600 bg-slate-100/50 dark:bg-slate-800/50'
                }
            `}
        >
            {/* Color indicator bar */}
            <div 
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                style={{ background: color }}
            />
            
            <div className="pl-3 flex items-center justify-between">
                <div>
                    <div className="text-sm font-medium tracking-wide tracking-wide text-[#dae2fd]">
                        Member {member.id}
                    </div>
                    <div className="text-xs text-[#869ab8]">
                        {formatValue(value, config.unit)} {config.unit}
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {type === 'utilization' && getStatusIcon(member.utilization)}
                    <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ 
                            background: color,
                            color: value > (maxVal - minVal) / 2 + minVal ? '#000' : '#fff'
                        }}
                    >
                        {type === 'utilization' 
                            ? `${Math.round(member.utilization * 100)}%`
                            : Math.round(value)
                        }
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ============================================
// SUMMARY STATS COMPONENT
// ============================================

interface SummaryStatsProps {
    members: MemberData[];
    type: HeatMapType;
    config: HeatMapConfig;
}

const SummaryStats: FC<SummaryStatsProps> = ({ members, type, config }) => {
    const stats = useMemo(() => {
        const values = members.map(m => {
            switch (type) {
                case 'stress': return m.stress;
                case 'displacement': return m.displacement;
                case 'utilization': return m.utilization;
                case 'axial': return m.axialForce;
                case 'moment': return m.maxMoment;
                case 'shear': return m.maxShear;
            }
        });
        
        const max = Math.max(...values);
        const min = Math.min(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        
        let critical = 0;
        if (type === 'utilization') {
            critical = members.filter(m => m.utilization > 1.0).length;
        }
        
        return { max, min, avg, critical, total: members.length };
    }, [members, type]);
    
    return (
        <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-3 border border-[#1a2333]">
                <div className="text-xs text-[#869ab8] uppercase tracking-wide mb-1">Maximum</div>
                <div className="text-lg font-bold text-red-400 font-mono">
                    {formatValue(stats.max, config.unit)} <span className="text-xs font-normal">{config.unit}</span>
                </div>
            </div>
            
            <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-3 border border-[#1a2333]">
                <div className="text-xs text-[#869ab8] uppercase tracking-wide mb-1">Minimum</div>
                <div className="text-lg font-bold text-blue-400 font-mono">
                    {formatValue(stats.min, config.unit)} <span className="text-xs font-normal">{config.unit}</span>
                </div>
            </div>
            
            <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-3 border border-[#1a2333]">
                <div className="text-xs text-[#869ab8] uppercase tracking-wide mb-1">Average</div>
                <div className="text-lg font-bold text-green-400 font-mono">
                    {formatValue(stats.avg, config.unit)} <span className="text-xs font-normal">{config.unit}</span>
                </div>
            </div>
            
            {type === 'utilization' ? (
                <div className={`rounded-lg p-3 border ${
                    stats.critical > 0 
                        ? 'bg-red-500/10 border-red-500/50' 
                        : 'bg-green-500/10 border-green-500/50'
                }`}>
                    <div className="text-xs text-[#869ab8] uppercase tracking-wide mb-1">Status</div>
                    <div className={`text-lg font-bold ${
                        stats.critical > 0 ? 'text-red-400' : 'text-green-400'
                    }`}>
                        {stats.critical > 0 ? (
                            <span className="flex items-center gap-2">
                                <XCircle className="w-5 h-5" />
                                {stats.critical} Failed
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5" />
                                All OK
                            </span>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-3 border border-[#1a2333]">
                    <div className="text-xs text-[#869ab8] uppercase tracking-wide mb-1">Members</div>
                    <div className="text-lg font-bold text-[#dae2fd] font-mono">
                        {stats.total}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const EnhancedHeatMap: FC<EnhancedHeatMapProps> = ({
    members,
    activeType,
    onTypeChange,
    onMemberClick,
    allowableStress = 250,
    maxDisplacement = 10
}) => {
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'id' | 'value'>('value');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    
    const config = useMemo(() => 
        HEAT_MAP_CONFIGS.find(c => c.id === activeType) || HEAT_MAP_CONFIGS[0]!,
        [activeType]
    );
    
    // Calculate min/max for color scaling
    const { minVal, maxVal, sortedMembers } = useMemo(() => {
        const getValue = (m: MemberData) => {
            switch (activeType) {
                case 'stress': return m.stress;
                case 'displacement': return m.displacement;
                case 'utilization': return m.utilization;
                case 'axial': return m.axialForce;
                case 'moment': return m.maxMoment;
                case 'shear': return m.maxShear;
            }
        };
        
        const values = members.map(getValue);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        
        // Sort members
        const sorted = [...members].sort((a, b) => {
            if (sortBy === 'id') {
                return sortOrder === 'asc' 
                    ? a.id.localeCompare(b.id) 
                    : b.id.localeCompare(a.id);
            } else {
                const va = getValue(a);
                const vb = getValue(b);
                return sortOrder === 'asc' ? va - vb : vb - va;
            }
        });
        
        return { minVal, maxVal, sortedMembers: sorted };
    }, [members, activeType, sortBy, sortOrder]);
    
    const handleMemberClick = useCallback((memberId: string) => {
        setSelectedMemberId(memberId === selectedMemberId ? null : memberId);
        onMemberClick?.(memberId);
    }, [selectedMemberId, onMemberClick]);
    
    const toggleSort = useCallback(() => {
        if (sortBy === 'value') {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy('value');
            setSortOrder('desc');
        }
    }, [sortBy]);
    
    return (
        <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-[#1a2333]">
                <div className="flex items-center gap-4">
                    <h3 className="font-semibold text-[#dae2fd] flex items-center gap-2">
                        <Flame className="w-5 h-5 text-orange-500" />
                        Heat Map Analysis
                    </h3>
                </div>
                
                <div className="flex items-center gap-2">
                    <button type="button"
                        onClick={toggleSort}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Sort by {sortBy === 'value' ? 'Value' : 'ID'} ({sortOrder})
                    </button>
                </div>
            </div>
            
            {/* Type Selector */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1a2333] overflow-x-auto">
                {HEAT_MAP_CONFIGS.map(cfg => {
                    const Icon = cfg.icon;
                    const isActive = activeType === cfg.id;
                    
                    return (
                        <motion.button
                            key={cfg.id}
                            onClick={() => onTypeChange(cfg.id)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium tracking-wide tracking-wide
                                whitespace-nowrap transition-all border
                                ${isActive 
                                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' 
                                    : 'border-[#1a2333] text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'
                                }
                            `}
                        >
                            <Icon className="w-4 h-4" />
                            {cfg.label}
                        </motion.button>
                    );
                })}
            </div>
            
            {/* Description */}
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100/30 dark:bg-slate-800/30 border-b border-[#1a2333] text-sm">
                <Info className="w-4 h-4 text-[#869ab8]" />
                <span className="text-[#869ab8]">{config.description}</span>
            </div>
            
            {/* Summary Stats */}
            <div className="p-4 border-b border-[#1a2333]">
                <SummaryStats members={members} type={activeType} config={config} />
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2333]">
                <ColorLegend
                    minVal={minVal}
                    maxVal={maxVal}
                    unit={config.unit}
                    colorScale={config.colorScale}
                    label={config.label}
                />
                
                <div className="text-xs text-[#869ab8]">
                    {members.length} members analyzed
                </div>
            </div>
            
            {/* Member Grid */}
            <div className="p-4 max-h-[400px] overflow-y-auto">
                <div className="grid grid-cols-3 gap-3">
                    <AnimatePresence mode="popLayout">
                        {sortedMembers.map(member => (
                            <MemberCard
                                key={member.id}
                                member={member}
                                type={activeType}
                                config={config}
                                minVal={minVal}
                                maxVal={maxVal}
                                isSelected={selectedMemberId === member.id}
                                onClick={() => handleMemberClick(member.id)}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default EnhancedHeatMap;
