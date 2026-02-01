/**
 * ============================================================================
 * RESULTS DASHBOARD
 * ============================================================================
 * 
 * Comprehensive dashboard for viewing and analyzing structural analysis results:
 * - Summary statistics and KPIs
 * - Quick access to all result types
 * - Interactive filtering and search
 * - Comparison views
 * - Export integration
 * 
 * @version 1.0.0
 */

import React, { useState, useMemo } from 'react';
import {
    LayoutDashboard,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Activity,
    BarChart3,
    Layers,
    Box,
    GitBranch,
    Zap,
    Target,
    Filter,
    Search,
    SortAsc,
    SortDesc,
    ChevronRight,
    Download,
    FileText,
    Eye,
    Settings,
    RefreshCw,
    Clock,
    Maximize2,
    Grid3X3,
    List
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type ResultCategory = 
    | 'displacements' 
    | 'reactions' 
    | 'member-forces' 
    | 'stresses' 
    | 'utilization' 
    | 'modal' 
    | 'dynamic'
    | 'code-check';

export interface ResultsSummary {
    category: ResultCategory;
    label: string;
    description: string;
    icon: React.ReactNode;
    stats: {
        total: number;
        passed: number;
        warnings: number;
        failed: number;
    };
    keyMetrics: Array<{
        name: string;
        value: number;
        unit: string;
        status: 'ok' | 'warning' | 'critical';
        location?: string;
    }>;
    lastUpdated: Date;
}

export interface MemberResult {
    id: string;
    name: string;
    type: string;
    utilizationRatio: number;
    maxStress: number;
    maxDeflection: number;
    status: 'pass' | 'warning' | 'fail';
    criticalCheck?: string;
    section: string;
    material: string;
    length: number;
}

export interface LoadCaseResult {
    id: string;
    name: string;
    type: 'static' | 'dynamic' | 'response-spectrum' | 'time-history';
    factor: number;
    maxReaction: number;
    maxDisplacement: number;
    status: 'analyzed' | 'pending' | 'error';
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_RESULTS_SUMMARY: ResultsSummary[] = [
    {
        category: 'displacements',
        label: 'Displacements',
        description: 'Nodal displacements and drifts',
        icon: <TrendingUp className="w-5 h-5" />,
        stats: { total: 245, passed: 238, warnings: 5, failed: 2 },
        keyMetrics: [
            { name: 'Max. Total Disp.', value: 23.5, unit: 'mm', status: 'ok', location: 'Node 156 (Roof)' },
            { name: 'Max. Story Drift', value: 0.0018, unit: 'rad', status: 'warning', location: 'Level 3' },
            { name: 'Max. Lateral Disp.', value: 18.2, unit: 'mm', status: 'ok', location: 'Grid A-5' }
        ],
        lastUpdated: new Date()
    },
    {
        category: 'reactions',
        label: 'Reactions',
        description: 'Support reactions and base shear',
        icon: <GitBranch className="w-5 h-5" />,
        stats: { total: 48, passed: 48, warnings: 0, failed: 0 },
        keyMetrics: [
            { name: 'Max. Vertical', value: 2450, unit: 'kN', status: 'ok', location: 'Support S-12' },
            { name: 'Total Base Shear X', value: 1856, unit: 'kN', status: 'ok', location: 'All Supports' },
            { name: 'Max. Moment', value: 324.5, unit: 'kN·m', status: 'ok', location: 'Fixed End' }
        ],
        lastUpdated: new Date()
    },
    {
        category: 'member-forces',
        label: 'Member Forces',
        description: 'Axial, shear, and moment diagrams',
        icon: <BarChart3 className="w-5 h-5" />,
        stats: { total: 312, passed: 298, warnings: 10, failed: 4 },
        keyMetrics: [
            { name: 'Max. Axial Force', value: 1250, unit: 'kN', status: 'ok', location: 'Column C-15' },
            { name: 'Max. Shear Force', value: 185, unit: 'kN', status: 'ok', location: 'Beam B-23' },
            { name: 'Max. Moment', value: 456, unit: 'kN·m', status: 'warning', location: 'Beam B-45' }
        ],
        lastUpdated: new Date()
    },
    {
        category: 'stresses',
        label: 'Stresses',
        description: 'Normal, shear, and combined stresses',
        icon: <Zap className="w-5 h-5" />,
        stats: { total: 312, passed: 295, warnings: 12, failed: 5 },
        keyMetrics: [
            { name: 'Max. Normal Stress', value: 248, unit: 'MPa', status: 'warning', location: 'Beam B-45' },
            { name: 'Max. Shear Stress', value: 95, unit: 'MPa', status: 'ok', location: 'Column C-8' },
            { name: 'Max. Von Mises', value: 285, unit: 'MPa', status: 'critical', location: 'Connection J-12' }
        ],
        lastUpdated: new Date()
    },
    {
        category: 'utilization',
        label: 'Utilization',
        description: 'Member capacity utilization ratios',
        icon: <Target className="w-5 h-5" />,
        stats: { total: 312, passed: 285, warnings: 18, failed: 9 },
        keyMetrics: [
            { name: 'Max. Utilization', value: 0.98, unit: '', status: 'critical', location: 'Beam B-45' },
            { name: 'Avg. Utilization', value: 0.62, unit: '', status: 'ok', location: 'All Members' },
            { name: 'Over 90%', value: 15, unit: 'members', status: 'warning' }
        ],
        lastUpdated: new Date()
    },
    {
        category: 'modal',
        label: 'Modal Analysis',
        description: 'Natural frequencies and mode shapes',
        icon: <Activity className="w-5 h-5" />,
        stats: { total: 12, passed: 12, warnings: 0, failed: 0 },
        keyMetrics: [
            { name: '1st Mode Freq.', value: 0.85, unit: 'Hz', status: 'ok', location: 'Translational X' },
            { name: '2nd Mode Freq.', value: 0.92, unit: 'Hz', status: 'ok', location: 'Translational Y' },
            { name: '3rd Mode Freq.', value: 1.15, unit: 'Hz', status: 'ok', location: 'Torsional' }
        ],
        lastUpdated: new Date()
    },
    {
        category: 'code-check',
        label: 'Code Checks',
        description: 'Design code compliance verification',
        icon: <CheckCircle2 className="w-5 h-5" />,
        stats: { total: 1248, passed: 1180, warnings: 52, failed: 16 },
        keyMetrics: [
            { name: 'Compliance Rate', value: 98.7, unit: '%', status: 'ok' },
            { name: 'Critical Failures', value: 3, unit: 'checks', status: 'critical' },
            { name: 'Warnings', value: 52, unit: 'checks', status: 'warning' }
        ],
        lastUpdated: new Date()
    }
];

const MOCK_MEMBER_RESULTS: MemberResult[] = [
    { id: 'B-45', name: 'Beam B-45', type: 'Beam', utilizationRatio: 0.98, maxStress: 285, maxDeflection: 12.5, status: 'fail', criticalCheck: 'Combined Stress', section: 'W24x68', material: 'A992 Gr50', length: 8.5 },
    { id: 'C-15', name: 'Column C-15', type: 'Column', utilizationRatio: 0.82, maxStress: 195, maxDeflection: 3.2, status: 'warning', criticalCheck: 'P-M Interaction', section: 'W14x90', material: 'A992 Gr50', length: 4.2 },
    { id: 'B-23', name: 'Beam B-23', type: 'Beam', utilizationRatio: 0.75, maxStress: 185, maxDeflection: 8.8, status: 'pass', section: 'W21x50', material: 'A992 Gr50', length: 7.2 },
    { id: 'C-08', name: 'Column C-08', type: 'Column', utilizationRatio: 0.68, maxStress: 165, maxDeflection: 2.8, status: 'pass', section: 'W14x82', material: 'A992 Gr50', length: 4.2 },
    { id: 'BR-12', name: 'Brace BR-12', type: 'Brace', utilizationRatio: 0.91, maxStress: 245, maxDeflection: 0.8, status: 'warning', criticalCheck: 'Slenderness', section: 'HSS6x6x3/8', material: 'A500 Gr C', length: 5.6 },
];

// ============================================================================
// SUMMARY CARD COMPONENT
// ============================================================================

interface SummaryCardProps {
    summary: ResultsSummary;
    onClick: () => void;
    isSelected: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ summary, onClick, isSelected }) => {
    const { stats, keyMetrics } = summary;
    const passRate = (stats.passed / stats.total) * 100;
    
    const getStatusColor = (status: 'ok' | 'warning' | 'critical') => {
        switch (status) {
            case 'ok': return 'text-green-400';
            case 'warning': return 'text-yellow-400';
            case 'critical': return 'text-red-400';
        }
    };
    
    return (
        <button
            onClick={onClick}
            className={`
                w-full p-4 rounded-xl text-left transition-all
                ${isSelected 
                    ? 'bg-cyan-500/10 border-2 border-cyan-500' 
                    : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
                }
            `}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-400'}`}>
                        {summary.icon}
                    </div>
                    <div>
                        <h4 className="font-semibold text-white">{summary.label}</h4>
                        <p className="text-xs text-slate-400">{summary.description}</p>
                    </div>
                </div>
                <ChevronRight className={`w-5 h-5 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
            </div>
            
            {/* Stats Bar */}
            <div className="mb-3">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden flex">
                    <div 
                        className="bg-green-500 transition-all"
                        style={{ width: `${(stats.passed / stats.total) * 100}%` }}
                    />
                    <div 
                        className="bg-yellow-500 transition-all"
                        style={{ width: `${(stats.warnings / stats.total) * 100}%` }}
                    />
                    <div 
                        className="bg-red-500 transition-all"
                        style={{ width: `${(stats.failed / stats.total) * 100}%` }}
                    />
                </div>
                <div className="flex justify-between mt-1 text-[10px]">
                    <span className="text-green-400">{stats.passed} passed</span>
                    <span className="text-yellow-400">{stats.warnings} warnings</span>
                    <span className="text-red-400">{stats.failed} failed</span>
                </div>
            </div>
            
            {/* Top Metrics */}
            <div className="space-y-1">
                {keyMetrics.slice(0, 2).map((metric, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{metric.name}</span>
                        <span className={getStatusColor(metric.status)}>
                            {typeof metric.value === 'number' && metric.value < 1 && metric.unit === ''
                                ? `${(metric.value * 100).toFixed(0)}%`
                                : `${metric.value} ${metric.unit}`
                            }
                        </span>
                    </div>
                ))}
            </div>
        </button>
    );
};

// ============================================================================
// KPI CARD COMPONENT
// ============================================================================

interface KPICardProps {
    title: string;
    value: string | number;
    unit?: string;
    change?: number;
    status?: 'ok' | 'warning' | 'critical';
    icon: React.ReactNode;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, unit, change, status = 'ok', icon }) => {
    const statusColors = {
        ok: 'from-green-500/20 to-green-500/5 border-green-500/30',
        warning: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30',
        critical: 'from-red-500/20 to-red-500/5 border-red-500/30'
    };
    
    const textColors = {
        ok: 'text-green-400',
        warning: 'text-yellow-400',
        critical: 'text-red-400'
    };
    
    return (
        <div className={`p-4 rounded-xl bg-gradient-to-br ${statusColors[status]} border`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">{title}</span>
                <div className={textColors[status]}>{icon}</div>
            </div>
            <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${textColors[status]}`}>{value}</span>
                {unit && <span className="text-sm text-slate-400">{unit}</span>}
            </div>
            {change !== undefined && (
                <div className="flex items-center gap-1 mt-1 text-xs">
                    {change >= 0 ? (
                        <TrendingUp className="w-3 h-3 text-green-400" />
                    ) : (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={change >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {Math.abs(change)}% from previous
                    </span>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// MEMBER RESULTS TABLE
// ============================================================================

interface MemberResultsTableProps {
    results: MemberResult[];
    onViewDetails: (member: MemberResult) => void;
}

const MemberResultsTable: React.FC<MemberResultsTableProps> = ({ results, onViewDetails }) => {
    const [sortBy, setSortBy] = useState<keyof MemberResult>('utilizationRatio');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'warning' | 'fail'>('all');
    
    const sortedResults = useMemo(() => {
        const filtered = results.filter(r => 
            (statusFilter === 'all' || r.status === statusFilter) &&
            (r.name.toLowerCase().includes(filter.toLowerCase()) ||
             r.type.toLowerCase().includes(filter.toLowerCase()))
        );
        
        return filtered.sort((a, b) => {
            const aVal = a[sortBy];
            const bVal = b[sortBy];
            
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            
            return sortOrder === 'asc' 
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });
    }, [results, sortBy, sortOrder, filter, statusFilter]);
    
    const toggleSort = (column: keyof MemberResult) => {
        if (sortBy === column) {
            setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };
    
    const getStatusBadge = (status: 'pass' | 'warning' | 'fail') => {
        const styles = {
            pass: 'bg-green-500/20 text-green-400 border-green-500/30',
            warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            fail: 'bg-red-500/20 text-red-400 border-red-500/30'
        };
        
        const icons = {
            pass: <CheckCircle2 className="w-3 h-3" />,
            warning: <AlertTriangle className="w-3 h-3" />,
            fail: <XCircle className="w-3 h-3" />
        };
        
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${styles[status]}`}>
                {icons[status]}
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };
    
    const getUtilizationColor = (ratio: number): string => {
        if (ratio <= 0.7) return 'text-green-400';
        if (ratio <= 0.9) return 'text-yellow-400';
        return 'text-red-400';
    };
    
    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b border-slate-700 flex items-center gap-4">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Search members..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-cyan-500"
                    />
                </div>
                
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                    >
                        <option value="all">All Status</option>
                        <option value="pass">Passed</option>
                        <option value="warning">Warning</option>
                        <option value="fail">Failed</option>
                    </select>
                </div>
                
                <span className="text-sm text-slate-400 ml-auto">
                    {sortedResults.length} of {results.length} members
                </span>
            </div>
            
            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-800/80">
                            {[
                                { key: 'name', label: 'Member' },
                                { key: 'type', label: 'Type' },
                                { key: 'section', label: 'Section' },
                                { key: 'utilizationRatio', label: 'Utilization' },
                                { key: 'maxStress', label: 'Max Stress' },
                                { key: 'maxDeflection', label: 'Max Deflection' },
                                { key: 'status', label: 'Status' }
                            ].map(col => (
                                <th
                                    key={col.key}
                                    onClick={() => toggleSort(col.key as keyof MemberResult)}
                                    className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                                >
                                    <div className="flex items-center gap-1">
                                        {col.label}
                                        {sortBy === col.key && (
                                            sortOrder === 'asc' 
                                                ? <SortAsc className="w-3 h-3" />
                                                : <SortDesc className="w-3 h-3" />
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {sortedResults.map(member => (
                            <tr 
                                key={member.id} 
                                className="hover:bg-slate-800/50 transition-colors"
                            >
                                <td className="px-4 py-3">
                                    <div className="font-medium text-white">{member.name}</div>
                                    {member.criticalCheck && (
                                        <div className="text-xs text-red-400">{member.criticalCheck}</div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-300">{member.type}</td>
                                <td className="px-4 py-3 text-sm text-slate-300">{member.section}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full ${
                                                    member.utilizationRatio > 1 ? 'bg-red-500' :
                                                    member.utilizationRatio > 0.9 ? 'bg-yellow-500' :
                                                    'bg-green-500'
                                                }`}
                                                style={{ width: `${Math.min(member.utilizationRatio * 100, 100)}%` }}
                                            />
                                        </div>
                                        <span className={`text-sm font-medium ${getUtilizationColor(member.utilizationRatio)}`}>
                                            {(member.utilizationRatio * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-300">
                                    {member.maxStress.toFixed(0)} MPa
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-300">
                                    {member.maxDeflection.toFixed(1)} mm
                                </td>
                                <td className="px-4 py-3">
                                    {getStatusBadge(member.status)}
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => onViewDetails(member)}
                                        className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg transition-colors"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ============================================================================
// MAIN RESULTS DASHBOARD COMPONENT
// ============================================================================

interface ResultsDashboardProps {
    projectName?: string;
    analysisDate?: Date;
    onViewCategory?: (category: ResultCategory) => void;
    onViewMember?: (memberId: string) => void;
    onExport?: () => void;
    onRefresh?: () => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
    projectName = 'Sample Project',
    analysisDate = new Date(),
    onViewCategory,
    onViewMember,
    onExport,
    onRefresh
}) => {
    const [selectedCategory, setSelectedCategory] = useState<ResultCategory | null>('utilization');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    
    const selectedSummary = MOCK_RESULTS_SUMMARY.find(s => s.category === selectedCategory);
    
    // Calculate overall statistics
    const overallStats = useMemo(() => {
        const totals = MOCK_RESULTS_SUMMARY.reduce((acc, s) => ({
            total: acc.total + s.stats.total,
            passed: acc.passed + s.stats.passed,
            warnings: acc.warnings + s.stats.warnings,
            failed: acc.failed + s.stats.failed
        }), { total: 0, passed: 0, warnings: 0, failed: 0 });
        
        return {
            ...totals,
            passRate: ((totals.passed / totals.total) * 100).toFixed(1)
        };
    }, []);
    
    return (
        <div className="min-h-screen bg-slate-950 p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-500/10 rounded-xl">
                            <LayoutDashboard className="w-8 h-8 text-cyan-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Analysis Results</h1>
                            <p className="text-slate-400">{projectName}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Clock className="w-4 h-4" />
                            Last analyzed: {analysisDate.toLocaleString()}
                        </div>
                        
                        <button
                            onClick={onRefresh}
                            className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                        
                        <button
                            onClick={onExport}
                            className="px-4 py-2 bg-cyan-500 text-white font-medium rounded-lg hover:bg-cyan-400 transition-colors flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Export Results
                        </button>
                    </div>
                </div>
            </div>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-5 gap-4 mb-8">
                <KPICard
                    title="Total Checks"
                    value={overallStats.total}
                    icon={<Layers className="w-5 h-5" />}
                    status="ok"
                />
                <KPICard
                    title="Pass Rate"
                    value={overallStats.passRate}
                    unit="%"
                    change={2.5}
                    icon={<CheckCircle2 className="w-5 h-5" />}
                    status="ok"
                />
                <KPICard
                    title="Passed"
                    value={overallStats.passed}
                    icon={<CheckCircle2 className="w-5 h-5" />}
                    status="ok"
                />
                <KPICard
                    title="Warnings"
                    value={overallStats.warnings}
                    icon={<AlertTriangle className="w-5 h-5" />}
                    status="warning"
                />
                <KPICard
                    title="Failed"
                    value={overallStats.failed}
                    icon={<XCircle className="w-5 h-5" />}
                    status={overallStats.failed > 0 ? 'critical' : 'ok'}
                />
            </div>
            
            {/* Main Content */}
            <div className="grid grid-cols-12 gap-6">
                {/* Category Sidebar */}
                <div className="col-span-4 space-y-3">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">Result Categories</h2>
                        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                            >
                                <Grid3X3 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    
                    {MOCK_RESULTS_SUMMARY.map(summary => (
                        <SummaryCard
                            key={summary.category}
                            summary={summary}
                            isSelected={selectedCategory === summary.category}
                            onClick={() => {
                                setSelectedCategory(summary.category);
                                if (onViewCategory) onViewCategory(summary.category);
                            }}
                        />
                    ))}
                </div>
                
                {/* Detail View */}
                <div className="col-span-8">
                    {selectedSummary && (
                        <div className="space-y-6">
                            {/* Category Header */}
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
                                            {selectedSummary.icon}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white">{selectedSummary.label}</h2>
                                            <p className="text-slate-400">{selectedSummary.description}</p>
                                        </div>
                                    </div>
                                    
                                    <button className="p-2 bg-slate-700 text-slate-400 hover:text-white rounded-lg">
                                        <Maximize2 className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                {/* Key Metrics */}
                                <div className="grid grid-cols-3 gap-4">
                                    {selectedSummary.keyMetrics.map((metric, idx) => (
                                        <div 
                                            key={idx}
                                            className="p-4 bg-slate-900/50 rounded-xl"
                                        >
                                            <div className="text-sm text-slate-400 mb-1">{metric.name}</div>
                                            <div className={`text-xl font-bold ${
                                                metric.status === 'ok' ? 'text-green-400' :
                                                metric.status === 'warning' ? 'text-yellow-400' :
                                                'text-red-400'
                                            }`}>
                                                {typeof metric.value === 'number' && metric.value < 1 && metric.unit === ''
                                                    ? `${(metric.value * 100).toFixed(0)}%`
                                                    : `${metric.value} ${metric.unit}`
                                                }
                                            </div>
                                            {metric.location && (
                                                <div className="text-xs text-slate-500 mt-1">{metric.location}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Member Results Table */}
                            <MemberResultsTable
                                results={MOCK_MEMBER_RESULTS}
                                onViewDetails={(member) => {
                                    if (onViewMember) onViewMember(member.id);
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResultsDashboard;
export { SummaryCard, KPICard, MemberResultsTable };
