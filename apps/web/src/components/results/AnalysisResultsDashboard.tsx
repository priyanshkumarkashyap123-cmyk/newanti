/**
 * AnalysisResultsDashboard.tsx - Comprehensive Results Visualization Hub
 * 
 * A professional, visually stunning dashboard for structural analysis results:
 * - Summary cards with key metrics
 * - Interactive force diagrams (SFD, BMD, AFD)
 * - Heat map visualizations
 * - Deflected shape view
 * - Support reactions display
 * - Export capabilities
 * 
 * This is the main entry point for result visualization that engineers will love.
 */

import React, { FC, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart2,
    Activity,
    TrendingDown,
    ArrowUpDown,
    Flame,
    FileText,
    Download,
    Share2,
    Printer,
    CheckCircle,
    AlertTriangle,
    XCircle,
    ArrowDown,
    ArrowUp,
    ChevronRight,
    Maximize2,
    Eye,
    EyeOff,
    RefreshCw,
    Layers,
    Grid3X3
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface NodeResult {
    id: string;
    x: number;
    y: number;
    z: number;
    displacement: {
        dx: number;
        dy: number;
        dz: number;
        rx?: number;
        ry?: number;
        rz?: number;
    };
    reaction?: {
        fx: number;
        fy: number;
        fz: number;
        mx?: number;
        my?: number;
        mz?: number;
    };
}

export interface MemberResult {
    id: string;
    startNodeId: string;
    endNodeId: string;
    length: number;
    maxShear: number;
    minShear: number;
    maxMoment: number;
    minMoment: number;
    maxAxial: number;
    minAxial: number;
    maxDeflection: number;
    stress: number;
    utilization: number;
    diagramData?: {
        x_values: number[];
        shear_values: number[];
        moment_values: number[];
        axial_values: number[];
        deflection_values: number[];
    };
}

export interface AnalysisResultsData {
    nodes: NodeResult[];
    members: MemberResult[];
    summary: {
        totalNodes: number;
        totalMembers: number;
        totalDOF: number;
        maxDisplacement: number;
        maxStress: number;
        maxUtilization: number;
        analysisTime: number;
        status: 'success' | 'warning' | 'error';
    };
}

type ViewMode = 'overview' | 'diagrams' | 'heatmap' | 'reactions' | 'detailed';
type DiagramType = 'SFD' | 'BMD' | 'AFD' | 'DEFLECTION';

interface AnalysisResultsDashboardProps {
    results: AnalysisResultsData;
    onClose?: () => void;
    onExport?: (format: 'pdf' | 'excel' | 'json') => void;
    onMemberSelect?: (memberId: string) => void;
}

// ============================================
// CONSTANTS
// ============================================

const VIEW_MODES = [
    { id: 'overview' as const, label: 'Overview', icon: Grid3X3 },
    { id: 'diagrams' as const, label: 'Force Diagrams', icon: BarChart2 },
    { id: 'heatmap' as const, label: 'Heat Map', icon: Flame },
    { id: 'reactions' as const, label: 'Reactions', icon: ArrowDown },
    { id: 'detailed' as const, label: 'Detailed', icon: FileText }
];

const STATUS_COLORS = {
    success: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', icon: CheckCircle },
    warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: AlertTriangle },
    error: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: XCircle }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatNumber = (value: number, precision: number = 2): string => {
    if (Math.abs(value) < 0.01) return '0';
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
    return value.toFixed(precision);
};

const getUtilizationStatus = (util: number): 'safe' | 'warning' | 'critical' | 'failed' => {
    if (util <= 0.7) return 'safe';
    if (util <= 0.9) return 'warning';
    if (util <= 1.0) return 'critical';
    return 'failed';
};

// ============================================
// SUMMARY CARD COMPONENT
// ============================================

interface SummaryCardProps {
    title: string;
    value: string;
    unit?: string;
    icon: React.ElementType;
    color: string;
    trend?: 'up' | 'down' | 'neutral';
    subtitle?: string;
}

const SummaryCard: FC<SummaryCardProps> = ({ 
    title, 
    value, 
    unit, 
    icon: Icon, 
    color,
    trend,
    subtitle 
}) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-4 hover:border-zinc-600 transition-colors"
    >
        <div className="flex items-start justify-between">
            <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">
                    {title}
                </p>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white font-mono">
                        {value}
                    </span>
                    {unit && (
                        <span className="text-sm text-zinc-400">{unit}</span>
                    )}
                </div>
                {subtitle && (
                    <p className="text-xs text-zinc-400 mt-1">{subtitle}</p>
                )}
            </div>
            <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
        {trend && (
            <div className="flex items-center gap-1 mt-2 text-xs">
                {trend === 'up' && <ArrowUp className="w-3 h-3 text-red-400" />}
                {trend === 'down' && <ArrowDown className="w-3 h-3 text-green-400" />}
                <span className={trend === 'up' ? 'text-red-400' : 'text-green-400'}>
                    Within limits
                </span>
            </div>
        )}
    </motion.div>
);

// ============================================
// MEMBER DIAGRAM MINI CARD
// ============================================

interface MemberDiagramMiniProps {
    member: MemberResult;
    type: DiagramType;
    isSelected: boolean;
    onClick: () => void;
}

const MemberDiagramMini: FC<MemberDiagramMiniProps> = ({ 
    member, 
    type, 
    isSelected, 
    onClick 
}) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    
    // Draw mini diagram
    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !member.diagramData) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Get values based on type
        let values: number[];
        switch (type) {
            case 'SFD': values = member.diagramData.shear_values; break;
            case 'BMD': values = member.diagramData.moment_values; break;
            case 'AFD': values = member.diagramData.axial_values; break;
            case 'DEFLECTION': values = member.diagramData.deflection_values; break;
        }
        
        if (!values || values.length === 0) return;
        
        const maxAbs = Math.max(...values.map(Math.abs), 0.001);
        const midY = height / 2;
        const scale = (height / 2 - 4) / maxAbs;
        
        // Draw baseline
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();
        
        // Draw filled area
        ctx.beginPath();
        ctx.moveTo(0, midY);
        
        values.forEach((v, i) => {
            const x = (i / (values.length - 1)) * width;
            const y = midY - v * scale;
            ctx.lineTo(x, y);
        });
        
        ctx.lineTo(width, midY);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
        gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.1)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = isSelected ? '#fff' : '#888';
        ctx.lineWidth = isSelected ? 2 : 1;
        
        values.forEach((v, i) => {
            const x = (i / (values.length - 1)) * width;
            const y = midY - v * scale;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
    }, [member, type, isSelected]);
    
    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            onClick={onClick}
            className={`
                relative p-3 rounded-lg border cursor-pointer transition-all
                ${isSelected 
                    ? 'border-blue-500 bg-blue-500/10' 
                    : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                }
            `}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">M{member.id}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                    member.utilization <= 0.7 ? 'bg-green-500/20 text-green-400' :
                    member.utilization <= 0.9 ? 'bg-yellow-500/20 text-yellow-400' :
                    member.utilization <= 1.0 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-red-500/20 text-red-400'
                }`}>
                    {(member.utilization * 100).toFixed(0)}%
                </span>
            </div>
            
            <canvas 
                ref={canvasRef} 
                width={120} 
                height={40}
                className="w-full h-10 rounded bg-zinc-900"
            />
            
            <div className="flex justify-between mt-2 text-xs text-zinc-400">
                <span>Max: {formatNumber(type === 'SFD' ? member.maxShear : 
                                        type === 'BMD' ? member.maxMoment : 
                                        type === 'AFD' ? member.maxAxial :
                                        member.maxDeflection)}</span>
                <span>L: {formatNumber(member.length)}m</span>
            </div>
        </motion.div>
    );
};

// ============================================
// REACTION DISPLAY COMPONENT
// ============================================

interface ReactionDisplayProps {
    nodes: NodeResult[];
}

const ReactionDisplay: FC<ReactionDisplayProps> = ({ nodes }) => {
    const supportNodes = useMemo(() => 
        nodes.filter(n => n.reaction && (
            Math.abs(n.reaction.fx) > 0.01 ||
            Math.abs(n.reaction.fy) > 0.01 ||
            Math.abs(n.reaction.fz) > 0.01 ||
            Math.abs(n.reaction.mx ?? 0) > 0.01 ||
            Math.abs(n.reaction.my ?? 0) > 0.01 ||
            Math.abs(n.reaction.mz ?? 0) > 0.01
        )),
        [nodes]
    );

    // Detect if any node has 3D reactions (Fz, Mx, My)
    const is3D = useMemo(() =>
        supportNodes.some(n => n.reaction && (
            Math.abs(n.reaction.fz) > 0.01 ||
            Math.abs(n.reaction.mx ?? 0) > 0.01 ||
            Math.abs(n.reaction.my ?? 0) > 0.01
        )),
        [supportNodes]
    );

    // Reaction cell helper
    const ReactionCell: FC<{ label: string; value: number; unit: string; colorPos: string; colorNeg: string }> = 
        ({ label, value, unit, colorPos, colorNeg }) => (
        <div className="text-center p-2 bg-zinc-900 rounded">
            <div className="text-xs text-zinc-400 mb-1">{label}</div>
            <div className={`font-mono font-bold ${value >= 0 ? colorPos : colorNeg}`}>
                {formatNumber(value)}
            </div>
            <div className="text-xs text-zinc-500">{unit}</div>
        </div>
    );

    // Reaction sum row
    const totals = useMemo(() => {
        const sum = { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 };
        supportNodes.forEach(n => {
            if (!n.reaction) return;
            sum.fx += n.reaction.fx;
            sum.fy += n.reaction.fy;
            sum.fz += n.reaction.fz;
            sum.mx += n.reaction.mx ?? 0;
            sum.my += n.reaction.my ?? 0;
            sum.mz += n.reaction.mz ?? 0;
        });
        return sum;
    }, [supportNodes]);
    
    return (
        <div className="space-y-4">
            {/* Summary totals */}
            <div className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-3">
                <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
                    Reaction Totals (Equilibrium Check)
                </div>
                <div className={`grid ${is3D ? 'grid-cols-6' : 'grid-cols-3'} gap-2 text-center text-xs`}>
                    <div><span className="text-zinc-400">ΣFx =</span> <span className="font-mono text-white">{formatNumber(totals.fx)} kN</span></div>
                    <div><span className="text-zinc-400">ΣFy =</span> <span className="font-mono text-white">{formatNumber(totals.fy)} kN</span></div>
                    {is3D && <div><span className="text-zinc-400">ΣFz =</span> <span className="font-mono text-white">{formatNumber(totals.fz)} kN</span></div>}
                    {is3D && <div><span className="text-zinc-400">ΣMx =</span> <span className="font-mono text-white">{formatNumber(totals.mx)} kNm</span></div>}
                    {is3D && <div><span className="text-zinc-400">ΣMy =</span> <span className="font-mono text-white">{formatNumber(totals.my)} kNm</span></div>}
                    <div><span className="text-zinc-400">ΣMz =</span> <span className="font-mono text-white">{formatNumber(totals.mz)} kNm</span></div>
                </div>
            </div>

            {/* Per-node reaction cards */}
            <div className="grid grid-cols-2 gap-4">
                {supportNodes.map(node => (
                    <motion.div
                        key={node.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-zinc-800/50 rounded-lg border border-zinc-700 p-4"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-white">Node {node.id}</span>
                            <span className="text-xs text-zinc-400">
                                ({formatNumber(node.x)}, {formatNumber(node.y)}, {formatNumber(node.z)})
                            </span>
                        </div>
                        
                        {node.reaction && (
                            <div className="space-y-2">
                                {/* Forces row */}
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Forces</div>
                                <div className={`grid ${is3D ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                                    <ReactionCell label="Fx" value={node.reaction.fx} unit="kN" colorPos="text-blue-400" colorNeg="text-red-400" />
                                    <ReactionCell label="Fy" value={node.reaction.fy} unit="kN" colorPos="text-green-400" colorNeg="text-red-400" />
                                    {is3D && <ReactionCell label="Fz" value={node.reaction.fz} unit="kN" colorPos="text-cyan-400" colorNeg="text-red-400" />}
                                </div>
                                {/* Moments row */}
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Moments</div>
                                <div className={`grid ${is3D ? 'grid-cols-3' : 'grid-cols-1'} gap-2`}>
                                    {is3D && <ReactionCell label="Mx" value={node.reaction.mx ?? 0} unit="kNm" colorPos="text-purple-400" colorNeg="text-orange-400" />}
                                    {is3D && <ReactionCell label="My" value={node.reaction.my ?? 0} unit="kNm" colorPos="text-purple-400" colorNeg="text-orange-400" />}
                                    <ReactionCell label="Mz" value={node.reaction.mz ?? 0} unit="kNm" colorPos="text-purple-400" colorNeg="text-orange-400" />
                                </div>
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// ============================================
// DETAILED MEMBER TABLE
// ============================================

interface DetailedMemberTableProps {
    members: MemberResult[];
    onSelect: (memberId: string) => void;
}

const DetailedMemberTable: FC<DetailedMemberTableProps> = ({ members, onSelect }) => {
    const [sortField, setSortField] = useState<keyof MemberResult>('id');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    
    const sortedMembers = useMemo(() => {
        return [...members].sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDir === 'asc' 
                    ? aVal.localeCompare(bVal) 
                    : bVal.localeCompare(aVal);
            }
            
            const numA = Number(aVal) || 0;
            const numB = Number(bVal) || 0;
            return sortDir === 'asc' ? numA - numB : numB - numA;
        });
    }, [members, sortField, sortDir]);
    
    const handleSort = (field: keyof MemberResult) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };
    
    const columns: { key: keyof MemberResult; label: string; unit?: string }[] = [
        { key: 'id', label: 'ID' },
        { key: 'length', label: 'Length', unit: 'm' },
        { key: 'maxShear', label: 'Max Shear', unit: 'kN' },
        { key: 'maxMoment', label: 'Max Moment', unit: 'kNm' },
        { key: 'maxAxial', label: 'Max Axial', unit: 'kN' },
        { key: 'maxDeflection', label: 'Deflection', unit: 'mm' },
        { key: 'stress', label: 'Stress', unit: 'MPa' },
        { key: 'utilization', label: 'Util. Ratio' }
    ];
    
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-zinc-700">
                        {columns.map(col => (
                            <th 
                                key={col.key}
                                onClick={() => handleSort(col.key)}
                                className="px-3 py-2 text-left text-zinc-400 font-medium cursor-pointer hover:text-white transition-colors"
                            >
                                <div className="flex items-center gap-1">
                                    {col.label}
                                    {col.unit && <span className="text-zinc-500">({col.unit})</span>}
                                    {sortField === col.key && (
                                        <ChevronRight className={`w-3 h-3 transform ${
                                            sortDir === 'asc' ? '-rotate-90' : 'rotate-90'
                                        }`} />
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedMembers.map(member => {
                        const status = getUtilizationStatus(member.utilization);
                        
                        return (
                            <motion.tr
                                key={member.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                onClick={() => onSelect(member.id)}
                                className="border-b border-zinc-800 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                            >
                                <td className="px-3 py-2 font-medium text-white">M{member.id}</td>
                                <td className="px-3 py-2 font-mono text-zinc-300">{formatNumber(member.length)}</td>
                                <td className="px-3 py-2 font-mono text-zinc-300">{formatNumber(member.maxShear)}</td>
                                <td className="px-3 py-2 font-mono text-zinc-300">{formatNumber(member.maxMoment)}</td>
                                <td className="px-3 py-2 font-mono text-zinc-300">{formatNumber(member.maxAxial)}</td>
                                <td className="px-3 py-2 font-mono text-zinc-300">{formatNumber(member.maxDeflection)}</td>
                                <td className="px-3 py-2 font-mono text-zinc-300">{formatNumber(member.stress)}</td>
                                <td className="px-3 py-2">
                                    <span className={`
                                        px-2 py-0.5 rounded text-xs font-medium
                                        ${status === 'safe' ? 'bg-green-500/20 text-green-400' : ''}
                                        ${status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                                        ${status === 'critical' ? 'bg-orange-500/20 text-orange-400' : ''}
                                        ${status === 'failed' ? 'bg-red-500/20 text-red-400' : ''}
                                    `}>
                                        {(member.utilization * 100).toFixed(1)}%
                                    </span>
                                </td>
                            </motion.tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export const AnalysisResultsDashboard: FC<AnalysisResultsDashboardProps> = ({
    results,
    onClose,
    onExport,
    onMemberSelect
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>('overview');
    const [selectedDiagramType, setSelectedDiagramType] = useState<DiagramType>('BMD');
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [showLegend, setShowLegend] = useState(true);
    
    const { summary, members, nodes } = results;
    const statusConfig = STATUS_COLORS[summary.status];
    const StatusIcon = statusConfig.icon;
    
    const handleMemberSelect = useCallback((memberId: string) => {
        setSelectedMemberId(memberId);
        onMemberSelect?.(memberId);
    }, [onMemberSelect]);
    
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-zinc-800/50 border-b border-zinc-800">
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${statusConfig.bg} ${statusConfig.border} border`}>
                        <StatusIcon className={`w-6 h-6 ${statusConfig.text}`} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Analysis Results</h2>
                        <p className="text-sm text-zinc-400">
                            {summary.totalNodes} nodes • {summary.totalMembers} members • {summary.totalDOF} DOF
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <span>Analysis time:</span>
                        <span className="font-mono text-white">{summary.analysisTime.toFixed(0)}ms</span>
                    </div>
                    
                    <div className="h-6 w-px bg-zinc-700" />
                    
                    <button
                        onClick={() => setShowLegend(!showLegend)}
                        className={`p-2 rounded-lg transition-colors ${
                            showLegend ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        {showLegend ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    
                    <button
                        onClick={() => onExport?.('pdf')}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </div>
            
            {/* View Mode Tabs */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-zinc-800 bg-zinc-800/30">
                {VIEW_MODES.map(mode => {
                    const Icon = mode.icon;
                    const isActive = viewMode === mode.id;
                    
                    return (
                        <motion.button
                            key={mode.id}
                            onClick={() => setViewMode(mode.id)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                                transition-all border
                                ${isActive 
                                    ? 'bg-white text-black border-white' 
                                    : 'border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600'
                                }
                            `}
                        >
                            <Icon className="w-4 h-4" />
                            {mode.label}
                        </motion.button>
                    );
                })}
            </div>
            
            {/* Content Area */}
            <div className="p-6">
                <AnimatePresence mode="wait">
                    {/* Overview Mode */}
                    {viewMode === 'overview' && (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6"
                        >
                            {/* Summary Cards */}
                            <div className="grid grid-cols-5 gap-4">
                                <SummaryCard
                                    title="Max Displacement"
                                    value={formatNumber(summary.maxDisplacement)}
                                    unit="mm"
                                    icon={TrendingDown}
                                    color="bg-blue-500/20 text-blue-400"
                                    trend="down"
                                />
                                <SummaryCard
                                    title="Max Stress"
                                    value={formatNumber(summary.maxStress)}
                                    unit="MPa"
                                    icon={Activity}
                                    color="bg-orange-500/20 text-orange-400"
                                />
                                <SummaryCard
                                    title="Max Utilization"
                                    value={(summary.maxUtilization * 100).toFixed(1)}
                                    unit="%"
                                    icon={Flame}
                                    color={summary.maxUtilization > 1 
                                        ? 'bg-red-500/20 text-red-400' 
                                        : 'bg-green-500/20 text-green-400'
                                    }
                                    trend={summary.maxUtilization > 1 ? 'up' : 'down'}
                                />
                                <SummaryCard
                                    title="Total Nodes"
                                    value={summary.totalNodes.toString()}
                                    icon={Layers}
                                    color="bg-purple-500/20 text-purple-400"
                                />
                                <SummaryCard
                                    title="Total Members"
                                    value={summary.totalMembers.toString()}
                                    icon={Grid3X3}
                                    color="bg-cyan-500/20 text-cyan-400"
                                />
                            </div>
                            
                            {/* Quick Actions */}
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setViewMode('diagrams')}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition-colors"
                                >
                                    <BarChart2 className="w-4 h-4" />
                                    View Force Diagrams
                                </button>
                                <button
                                    onClick={() => setViewMode('heatmap')}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition-colors"
                                >
                                    <Flame className="w-4 h-4" />
                                    View Heat Map
                                </button>
                                <button
                                    onClick={() => setViewMode('reactions')}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition-colors"
                                >
                                    <ArrowDown className="w-4 h-4" />
                                    View Reactions
                                </button>
                            </div>
                            
                            {/* Member Overview Grid */}
                            <div>
                                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-3">
                                    Member Overview (click for details)
                                </h3>
                                <div className="grid grid-cols-4 gap-3 max-h-[300px] overflow-y-auto">
                                    {members.slice(0, 12).map(member => (
                                        <MemberDiagramMini
                                            key={member.id}
                                            member={member}
                                            type="BMD"
                                            isSelected={selectedMemberId === member.id}
                                            onClick={() => handleMemberSelect(member.id)}
                                        />
                                    ))}
                                </div>
                                {members.length > 12 && (
                                    <p className="text-xs text-zinc-400 mt-2 text-center">
                                        + {members.length - 12} more members. Click "Detailed" tab to see all.
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                    
                    {/* Diagrams Mode */}
                    {viewMode === 'diagrams' && (
                        <motion.div
                            key="diagrams"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-4"
                        >
                            {/* Diagram Type Selector */}
                            <div className="flex items-center gap-2">
                                {(['SFD', 'BMD', 'AFD', 'DEFLECTION'] as DiagramType[]).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setSelectedDiagramType(type)}
                                        className={`
                                            px-4 py-2 rounded-lg text-sm font-medium transition-all
                                            ${selectedDiagramType === type 
                                                ? 'bg-white text-black' 
                                                : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                            }
                                        `}
                                    >
                                        {type === 'DEFLECTION' ? 'Deflection' : type}
                                    </button>
                                ))}
                            </div>
                            
                            {/* Member Diagram Grid */}
                            <div className="grid grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
                                {members.map(member => (
                                    <MemberDiagramMini
                                        key={member.id}
                                        member={member}
                                        type={selectedDiagramType}
                                        isSelected={selectedMemberId === member.id}
                                        onClick={() => handleMemberSelect(member.id)}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}
                    
                    {/* Reactions Mode */}
                    {viewMode === 'reactions' && (
                        <motion.div
                            key="reactions"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-4">
                                Support Reactions
                            </h3>
                            <ReactionDisplay nodes={nodes} />
                        </motion.div>
                    )}
                    
                    {/* Detailed Table Mode */}
                    {viewMode === 'detailed' && (
                        <motion.div
                            key="detailed"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-4">
                                Detailed Member Results
                            </h3>
                            <DetailedMemberTable 
                                members={members} 
                                onSelect={handleMemberSelect}
                            />
                        </motion.div>
                    )}
                    
                    {/* Heat Map Mode — member stress/utilization color table */}
                    {viewMode === 'heatmap' && (
                        <motion.div
                            key="heatmap"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-4"
                        >
                            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
                                Stress / Utilization Heat Map
                            </h3>
                            {/* Color legend */}
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-zinc-400">Low</span>
                                <div className="flex-1 h-3 rounded-full" style={{
                                    background: 'linear-gradient(to right, #22d3ee, #22c55e, #eab308, #f97316, #ef4444)'
                                }} />
                                <span className="text-zinc-400">High</span>
                            </div>
                            {/* Member bars sorted by utilization */}
                            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-2">
                                {[...members]
                                    .sort((a, b) => b.utilization - a.utilization)
                                    .map(m => {
                                        const pct = Math.min(m.utilization, 1.5) / 1.5 * 100;
                                        const hue = Math.max(0, 120 - m.utilization * 120); // 120=green → 0=red
                                        const status = getUtilizationStatus(m.utilization);
                                        return (
                                            <div
                                                key={m.id}
                                                onClick={() => handleMemberSelect(m.id)}
                                                className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 cursor-pointer transition-colors"
                                            >
                                                <span className="text-xs font-medium text-white w-12">M{m.id}</span>
                                                <div className="flex-1 h-4 bg-zinc-900 rounded-full overflow-hidden relative">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${pct}%`,
                                                            backgroundColor: `hsl(${hue}, 85%, 50%)`
                                                        }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-mono w-14 text-right ${
                                                    status === 'safe' ? 'text-green-400' :
                                                    status === 'warning' ? 'text-yellow-400' :
                                                    status === 'critical' ? 'text-orange-400' :
                                                    'text-red-400'
                                                }`}>
                                                    {(m.utilization * 100).toFixed(1)}%
                                                </span>
                                                <span className="text-xs text-zinc-500 w-20 text-right">
                                                    {formatNumber(m.stress)} MPa
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 bg-zinc-800/30 border-t border-zinc-800 text-xs text-zinc-400">
                <span>Analysis completed successfully</span>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => onExport?.('excel')}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Export to Excel
                    </button>
                    <button 
                        onClick={() => onExport?.('pdf')}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        Print Report
                    </button>
                    <button className="flex items-center gap-1 hover:text-white transition-colors">
                        <Share2 className="w-3.5 h-3.5" />
                        Share
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default AnalysisResultsDashboard;
