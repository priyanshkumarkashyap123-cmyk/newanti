/**
 * AnalysisFeedback.tsx - Real-time Feedback and Results Interpretation
 * 
 * Features:
 * - Real-time analysis progress tracking
 * - Results interpretation with recommendations
 * - Warning/error explanations with suggested fixes
 * - Quick actions for common next steps
 * - Educational tooltips for engineering concepts
 */

import React, { FC, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle,
    AlertCircle,
    AlertTriangle,
    XCircle,
    Info,
    ChevronDown,
    ChevronRight,
    Lightbulb,
    ArrowRight,
    RefreshCw,
    Download,
    Eye,
    ZoomIn,
    Settings,
    BookOpen,
    HelpCircle,
    TrendingUp,
    TrendingDown,
    Activity,
    Shield,
    Target,
    Ruler
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface AnalysisStatus {
    state: 'idle' | 'running' | 'complete' | 'error' | 'warning';
    progress: number;
    currentPhase: string;
    elapsedTime: number;
    estimatedTotal?: number;
}

export interface ResultsInterpretation {
    overallStatus: 'pass' | 'warning' | 'fail';
    score: number; // 0-100
    summary: string;
    findings: Finding[];
    recommendations: Recommendation[];
}

export interface Finding {
    id: string;
    type: 'error' | 'warning' | 'info' | 'success';
    category: 'deflection' | 'stress' | 'stability' | 'capacity' | 'other';
    title: string;
    description: string;
    value?: string;
    limit?: string;
    ratio?: number;
    memberId?: string;
    nodeId?: string;
    learnMoreUrl?: string;
}

export interface Recommendation {
    id: string;
    priority: 'high' | 'medium' | 'low';
    action: string;
    reason: string;
    impact: string;
}

export interface QuickAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
}

// ============================================
// ENGINEERING EXPLANATIONS
// ============================================

const CONCEPT_EXPLANATIONS: Record<string, { title: string; explanation: string; formula?: string }> = {
    deflection: {
        title: 'Deflection Limit',
        explanation: 'Maximum allowable displacement under load, typically L/360 for floor beams and L/240 for roof beams per IS 800. Excessive deflection can cause serviceability issues.',
        formula: 'δ_max ≤ L/360'
    },
    'unity-check': {
        title: 'Unity Check (Utilization Ratio)',
        explanation: 'Ratio of applied stress to allowable stress. Values ≤ 1.0 indicate the member is within capacity. Values > 1.0 indicate overstress.',
        formula: 'UR = σ_applied / σ_allowable ≤ 1.0'
    },
    'von-mises': {
        title: 'Von Mises Stress',
        explanation: 'Combined stress criterion used for ductile materials like steel. Accounts for all stress components and represents equivalent uniaxial stress.',
        formula: 'σ_vm = √(σ₁² + σ₂² - σ₁σ₂ + 3τ²)'
    },
    stability: {
        title: 'Structural Stability',
        explanation: 'Ability of structure to maintain equilibrium. Unstable structures will collapse even under small loads. Check for mechanism formation.',
    },
    'slenderness': {
        title: 'Slenderness Ratio',
        explanation: 'Ratio of effective length to radius of gyration (L_eff/r). High slenderness indicates susceptibility to buckling. Limit is typically 180-200 for compression members.',
        formula: 'λ = L_eff / r_min ≤ 180'
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStatusIcon(type: Finding['type']) {
    switch (type) {
        case 'error': return <XCircle size={16} className="text-red-400" />;
        case 'warning': return <AlertTriangle size={16} className="text-yellow-400" />;
        case 'info': return <Info size={16} className="text-blue-400" />;
        case 'success': return <CheckCircle size={16} className="text-green-400" />;
    }
}

function getCategoryIcon(category: Finding['category']) {
    switch (category) {
        case 'deflection': return <Ruler size={14} />;
        case 'stress': return <Activity size={14} />;
        case 'stability': return <Shield size={14} />;
        case 'capacity': return <Target size={14} />;
        default: return <Info size={14} />;
    }
}

function formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

// ============================================
// PROGRESS INDICATOR
// ============================================

interface ProgressIndicatorProps {
    status: AnalysisStatus;
    onCancel?: () => void;
}

export const ProgressIndicator: FC<ProgressIndicatorProps> = ({ status, onCancel }) => {
    const phases = [
        { id: 'validating', label: 'Validating Model' },
        { id: 'assembling', label: 'Assembling Stiffness Matrix' },
        { id: 'solving', label: 'Solving Equations' },
        { id: 'postprocessing', label: 'Computing Results' }
    ];

    const currentIndex = phases.findIndex(p => p.id === status.currentPhase);

    if (status.state === 'idle') return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gradient-to-r from-slate-800 to-slate-50 dark:to-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700"
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {status.state === 'running' && (
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                            <RefreshCw size={16} className="text-cyan-400" />
                        </motion.div>
                    )}
                    {status.state === 'complete' && <CheckCircle size={16} className="text-green-400" />}
                    {status.state === 'error' && <XCircle size={16} className="text-red-400" />}
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {status.state === 'running' ? 'Analysis in Progress' :
                         status.state === 'complete' ? 'Analysis Complete' :
                         status.state === 'error' ? 'Analysis Failed' : ''}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatTime(status.elapsedTime)}
                        {status.estimatedTotal && status.state === 'running' && (
                            <span> / ~{formatTime(status.estimatedTotal)}</span>
                        )}
                    </span>
                    {onCancel && status.state === 'running' && (
                        <button
                            onClick={onCancel}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                <motion.div
                    className={`h-full ${
                        status.state === 'error' ? 'bg-red-500' :
                        status.state === 'complete' ? 'bg-green-500' :
                        'bg-gradient-to-r from-cyan-500 to-blue-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${status.progress}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>

            {/* Phase indicators */}
            <div className="flex justify-between">
                {phases.map((phase, idx) => (
                    <div 
                        key={phase.id}
                        className={`flex items-center gap-1 text-xs ${
                            idx < currentIndex ? 'text-cyan-400' :
                            idx === currentIndex ? 'text-slate-900 dark:text-white font-medium' :
                            'text-slate-500 dark:text-slate-400'
                        }`}
                    >
                        <div className={`w-1.5 h-1.5 rounded-full ${
                            idx < currentIndex ? 'bg-cyan-400' :
                            idx === currentIndex ? 'bg-cyan-400 animate-pulse' :
                            'bg-slate-600'
                        }`} />
                        {phase.label}
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

// ============================================
// FINDING CARD
// ============================================

interface FindingCardProps {
    finding: Finding;
    onHighlight?: (memberId?: string, nodeId?: string) => void;
}

export const FindingCard: FC<FindingCardProps> = ({ finding, onHighlight }) => {
    const [expanded, setExpanded] = useState(false);
    const [showConcept, setShowConcept] = useState(false);

    const conceptKey = finding.category === 'deflection' ? 'deflection' :
                       finding.category === 'capacity' ? 'unity-check' :
                       finding.category === 'stress' ? 'von-mises' : null;

    const concept = conceptKey ? CONCEPT_EXPLANATIONS[conceptKey] : null;

    return (
        <motion.div
            layout
            className={`rounded-lg border overflow-hidden ${
                finding.type === 'error' ? 'border-red-500/30 bg-red-900/10' :
                finding.type === 'warning' ? 'border-yellow-500/30 bg-yellow-900/10' :
                finding.type === 'success' ? 'border-green-500/30 bg-green-900/10' :
                'border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50'
            }`}
        >
            {/* Header */}
            <div 
                className="p-3 flex items-start gap-3 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="mt-0.5">
                    {getStatusIcon(finding.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                            finding.type === 'error' ? 'text-red-300' :
                            finding.type === 'warning' ? 'text-yellow-300' :
                            finding.type === 'success' ? 'text-green-300' :
                            'text-slate-700 dark:text-slate-200'
                        }`}>
                            {finding.title}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 
                                       px-1.5 py-0.5 rounded">
                            {getCategoryIcon(finding.category)}
                            {finding.category}
                        </span>
                    </div>
                    
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{finding.description}</p>

                    {/* Value display */}
                    {finding.value && (
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm font-mono text-slate-600 dark:text-slate-300">
                                {finding.value}
                            </span>
                            {finding.limit && (
                                <>
                                    <span className="text-slate-500 dark:text-slate-400">/</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        Limit: {finding.limit}
                                    </span>
                                </>
                            )}
                            {finding.ratio !== undefined && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    finding.ratio <= 0.8 ? 'bg-green-900/50 text-green-400' :
                                    finding.ratio <= 1.0 ? 'bg-yellow-900/50 text-yellow-400' :
                                    'bg-red-900/50 text-red-400'
                                }`}>
                                    {(finding.ratio * 100).toFixed(0)}%
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {(finding.memberId || finding.nodeId) && onHighlight && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onHighlight(finding.memberId, finding.nodeId);
                            }}
                            className="p-1 text-slate-500 dark:text-slate-400 hover:text-cyan-400 transition-colors"
                            title="Highlight in viewer"
                        >
                            <Eye size={14} />
                        </button>
                    )}
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
            </div>

            {/* Expanded content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-200/50 dark:border-slate-700/50"
                    >
                        <div className="p-3 space-y-3">
                            {/* Learn more about concept */}
                            {concept && (
                                <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-3">
                                    <button
                                        onClick={() => setShowConcept(!showConcept)}
                                        className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300"
                                    >
                                        <BookOpen size={12} />
                                        Learn about {concept.title}
                                        {showConcept ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    </button>
                                    
                                    <AnimatePresence>
                                        {showConcept && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="mt-2 text-xs text-slate-500 dark:text-slate-400"
                                            >
                                                <p>{concept.explanation}</p>
                                                {concept.formula && (
                                                    <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900 rounded font-mono text-slate-600 dark:text-slate-300">
                                                        {concept.formula}
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            {/* Member/Node reference */}
                            {(finding.memberId || finding.nodeId) && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Location: {finding.memberId && `Member ${finding.memberId}`}
                                    {finding.memberId && finding.nodeId && ' at '}
                                    {finding.nodeId && `Node ${finding.nodeId}`}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ============================================
// RECOMMENDATION CARD
// ============================================

interface RecommendationCardProps {
    recommendation: Recommendation;
    onApply?: () => void;
}

export const RecommendationCard: FC<RecommendationCardProps> = ({ recommendation, onApply }) => {
    const priorityColors = {
        high: 'border-red-500/30 bg-red-900/10',
        medium: 'border-yellow-500/30 bg-yellow-900/10',
        low: 'border-blue-500/30 bg-blue-900/10'
    };

    const priorityBadge = {
        high: 'bg-red-900/50 text-red-400',
        medium: 'bg-yellow-900/50 text-yellow-400',
        low: 'bg-blue-900/50 text-blue-400'
    };

    return (
        <div className={`rounded-lg border p-3 ${priorityColors[recommendation.priority]}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                    <Lightbulb size={16} className="text-yellow-400 mt-0.5" />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {recommendation.action}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${priorityBadge[recommendation.priority]}`}>
                                {recommendation.priority}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{recommendation.reason}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-green-400">
                            <TrendingUp size={12} />
                            {recommendation.impact}
                        </div>
                    </div>
                </div>

                {onApply && (
                    <button
                        onClick={onApply}
                        className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 
                                 text-slate-700 dark:text-slate-200 rounded transition-colors"
                    >
                        Apply
                    </button>
                )}
            </div>
        </div>
    );
};

// ============================================
// RESULTS SUMMARY
// ============================================

interface ResultsSummaryProps {
    interpretation: ResultsInterpretation;
    onHighlight?: (memberId?: string, nodeId?: string) => void;
}

export const ResultsSummary: FC<ResultsSummaryProps> = ({ interpretation, onHighlight }) => {
    const [showFindings, setShowFindings] = useState(true);
    const [showRecommendations, setShowRecommendations] = useState(true);
    const [filterType, setFilterType] = useState<Finding['type'] | 'all'>('all');

    const filteredFindings = filterType === 'all' 
        ? interpretation.findings 
        : interpretation.findings.filter(f => f.type === filterType);

    const errorCount = interpretation.findings.filter(f => f.type === 'error').length;
    const warningCount = interpretation.findings.filter(f => f.type === 'warning').length;

    return (
        <div className="space-y-4">
            {/* Overall status card */}
            <div className={`rounded-lg p-4 border ${
                interpretation.overallStatus === 'pass' 
                    ? 'border-green-500/30 bg-gradient-to-r from-green-100/20 dark:from-green-900/20 to-slate-50 dark:to-slate-900' 
                    : interpretation.overallStatus === 'warning'
                        ? 'border-yellow-500/30 bg-gradient-to-r from-yellow-100/20 dark:from-yellow-900/20 to-slate-50 dark:to-slate-900'
                        : 'border-red-500/30 bg-gradient-to-r from-red-100/20 dark:from-red-900/20 to-slate-50 dark:to-slate-900'
            }`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {interpretation.overallStatus === 'pass' && (
                            <div className="w-12 h-12 rounded-full bg-green-900/50 flex items-center justify-center">
                                <CheckCircle size={24} className="text-green-400" />
                            </div>
                        )}
                        {interpretation.overallStatus === 'warning' && (
                            <div className="w-12 h-12 rounded-full bg-yellow-900/50 flex items-center justify-center">
                                <AlertTriangle size={24} className="text-yellow-400" />
                            </div>
                        )}
                        {interpretation.overallStatus === 'fail' && (
                            <div className="w-12 h-12 rounded-full bg-red-900/50 flex items-center justify-center">
                                <XCircle size={24} className="text-red-400" />
                            </div>
                        )}
                        
                        <div>
                            <h3 className={`text-lg font-semibold ${
                                interpretation.overallStatus === 'pass' ? 'text-green-400' :
                                interpretation.overallStatus === 'warning' ? 'text-yellow-400' :
                                'text-red-400'
                            }`}>
                                {interpretation.overallStatus === 'pass' ? 'All Checks Passed' :
                                 interpretation.overallStatus === 'warning' ? 'Passed with Warnings' :
                                 'Design Checks Failed'}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{interpretation.summary}</p>
                        </div>
                    </div>

                    {/* Score badge */}
                    <div className="text-center">
                        <div className={`text-3xl font-bold ${
                            interpretation.score >= 80 ? 'text-green-400' :
                            interpretation.score >= 60 ? 'text-yellow-400' :
                            'text-red-400'
                        }`}>
                            {interpretation.score}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Score</div>
                    </div>
                </div>

                {/* Quick stats */}
                <div className="flex gap-4 mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex items-center gap-2">
                        <XCircle size={14} className="text-red-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-300">{errorCount} errors</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={14} className="text-yellow-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-300">{warningCount} warnings</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                            {interpretation.findings.filter(f => f.type === 'success').length} passed
                        </span>
                    </div>
                </div>
            </div>

            {/* Findings section */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <button
                    onClick={() => setShowFindings(!showFindings)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-slate-100/50 dark:bg-slate-800/50 
                             hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                    <span className="font-medium text-slate-700 dark:text-slate-200">Detailed Findings</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            {interpretation.findings.length} items
                        </span>
                        {showFindings ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                </button>

                <AnimatePresence>
                    {showFindings && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            {/* Filter tabs */}
                            <div className="px-4 py-2 flex gap-2 border-b border-slate-200/50 dark:border-slate-700/50">
                                {(['all', 'error', 'warning', 'info', 'success'] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(type)}
                                        className={`px-2 py-1 text-xs rounded capitalize transition-colors ${
                                            filterType === type 
                                                ? 'bg-cyan-600 text-white' 
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>

                            {/* Findings list */}
                            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                                {filteredFindings.map((finding) => (
                                    <FindingCard 
                                        key={finding.id} 
                                        finding={finding} 
                                        onHighlight={onHighlight}
                                    />
                                ))}
                                {filteredFindings.length === 0 && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                                        No findings of this type
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Recommendations section */}
            {interpretation.recommendations.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button
                        onClick={() => setShowRecommendations(!showRecommendations)}
                        className="w-full px-4 py-3 flex items-center justify-between bg-slate-100/50 dark:bg-slate-800/50 
                                 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Lightbulb size={16} className="text-yellow-400" />
                            <span className="font-medium text-slate-700 dark:text-slate-200">Recommendations</span>
                        </div>
                        {showRecommendations ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    <AnimatePresence>
                        {showRecommendations && (
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="p-4 space-y-2">
                                    {interpretation.recommendations.map((rec) => (
                                        <RecommendationCard key={rec.id} recommendation={rec} />
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

// ============================================
// QUICK ACTIONS BAR
// ============================================

interface QuickActionsBarProps {
    actions: QuickAction[];
}

export const QuickActionsBar: FC<QuickActionsBarProps> = ({ actions }) => {
    return (
        <div className="flex flex-wrap gap-2 p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            {actions.map((action) => (
                <button
                    key={action.id}
                    onClick={action.onClick}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm 
                              transition-colors ${
                        action.variant === 'primary' 
                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white' 
                            : action.variant === 'danger'
                                ? 'bg-red-600 hover:bg-red-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-200'
                    }`}
                >
                    {action.icon}
                    {action.label}
                </button>
            ))}
        </div>
    );
};

// ============================================
// MAIN FEEDBACK PANEL
// ============================================

interface AnalysisFeedbackPanelProps {
    status: AnalysisStatus;
    interpretation?: ResultsInterpretation;
    onCancel?: () => void;
    onRerun?: () => void;
    onExport?: () => void;
    onHighlight?: (memberId?: string, nodeId?: string) => void;
}

export const AnalysisFeedbackPanel: FC<AnalysisFeedbackPanelProps> = ({
    status,
    interpretation,
    onCancel,
    onRerun,
    onExport,
    onHighlight
}) => {
    const quickActions: QuickAction[] = useMemo(() => {
        const actions: QuickAction[] = [];

        if (status.state === 'complete') {
            if (onExport) {
                actions.push({
                    id: 'export',
                    label: 'Export Results',
                    icon: <Download size={14} />,
                    onClick: onExport,
                    variant: 'primary'
                });
            }
            if (onRerun) {
                actions.push({
                    id: 'rerun',
                    label: 'Run Again',
                    icon: <RefreshCw size={14} />,
                    onClick: onRerun
                });
            }
        }

        return actions;
    }, [status.state, onExport, onRerun]);

    return (
        <div className="space-y-4">
            {/* Progress indicator */}
            <AnimatePresence>
                {(status.state === 'running' || status.state === 'error') && (
                    <ProgressIndicator status={status} onCancel={onCancel} />
                )}
            </AnimatePresence>

            {/* Results interpretation */}
            {status.state === 'complete' && interpretation && (
                <>
                    <ResultsSummary interpretation={interpretation} onHighlight={onHighlight} />
                    
                    {quickActions.length > 0 && (
                        <QuickActionsBar actions={quickActions} />
                    )}
                </>
            )}

            {/* Error state */}
            {status.state === 'error' && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <XCircle size={20} className="text-red-400 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-red-300">Analysis Failed</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                An error occurred during analysis. Please check your model for issues.
                            </p>
                            {onRerun && (
                                <button
                                    onClick={onRerun}
                                    className="mt-3 flex items-center gap-2 text-sm text-cyan-400 
                                             hover:text-cyan-300 transition-colors"
                                >
                                    <RefreshCw size={14} />
                                    Try Again
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalysisFeedbackPanel;
