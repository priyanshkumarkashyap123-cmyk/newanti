/**
 * SelfImprovementDashboard.tsx
 * 
 * UI for monitoring and controlling AI self-improvement
 */

import React, { useState, useEffect } from 'react';
import { selfImprovement, OptimizationAction, PerformanceMetrics } from '../../services/ml/SelfImprovementEngine';
import { vertexAI } from '../../services/ml/VertexAIService';
import { knowledgeGraph } from '../../services/ml/KnowledgeGraphService';

export const SelfImprovementDashboard: React.FC = () => {
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
    const [actions, setActions] = useState<OptimizationAction[]>([]);
    const [knowledgeStats, setKnowledgeStats] = useState<any>(null);
    const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

    const loadData = async () => {
        const report = await selfImprovement.generateReport(7);
        queueMicrotask(() => {
            setMetrics(report.metrics);
            setActions(selfImprovement.getActionHistory(20));
            setKnowledgeStats(knowledgeGraph.getStats());
        });
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, []);

    const toggleMonitoring = () => {
        if (isMonitoring) {
            selfImprovement.stopMonitoring();
        } else {
            selfImprovement.startMonitoring();
        }
        setIsMonitoring(!isMonitoring);
    };

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'improving': return '📈';
            case 'declining': return '📉';
            default: return '➡️';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-400';
            case 'failed': return 'text-red-400';
            case 'in_progress': return 'text-yellow-400';
            default: return 'text-slate-500 dark:text-slate-400';
        }
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                    </svg>
                    <h3 className="font-semibold text-slate-900 dark:text-white">AI Self-Improvement</h3>
                    {isMonitoring && (
                        <span className="animate-pulse text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                            Monitoring
                        </span>
                    )}
                </div>
                <button type="button"
                    onClick={toggleMonitoring}
                    className={`px-3 py-1 rounded text-sm font-medium ${isMonitoring
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        }`}
                >
                    {isMonitoring ? 'Stop' : 'Start'} Monitoring
                </button>
            </div>

            <div className="p-4 space-y-4">
                {/* Performance Cards */}
                <div className="grid grid-cols-5 gap-3">
                    {metrics.map(m => (
                        <div
                            key={m.feature}
                            onClick={() => setSelectedFeature(m.feature)}
                            className={`bg-slate-100 dark:bg-slate-800 rounded-lg p-3 cursor-pointer transition-colors ${selectedFeature === m.feature ? 'ring-2 ring-purple-500' : 'hover:bg-slate-750'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-slate-500 dark:text-slate-400 text-xs capitalize">{m.feature.replace('_', ' ')}</span>
                                <span>{getTrendIcon(m.ratingTrend)}</span>
                            </div>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">
                                {m.avgRating.toFixed(1)}
                                <span className="text-sm text-slate-500">/5</span>
                            </div>
                            <div className="text-xs text-slate-500">
                                {(m.correctionRate * 100).toFixed(0)}% corrections
                            </div>
                        </div>
                    ))}
                </div>

                {/* Selected Feature Details */}
                {selectedFeature && (
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                        <h4 className="text-slate-900 dark:text-white font-medium mb-3 capitalize">
                            {selectedFeature.replace('_', ' ')} Details
                        </h4>
                        {metrics.filter(m => m.feature === selectedFeature).map(m => (
                            <div key={m.feature} className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400">Avg Rating</span>
                                    <div className={`font-bold ${m.avgRating >= 4 ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {m.avgRating.toFixed(2)}/5
                                    </div>
                                </div>
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400">Correction Rate</span>
                                    <div className={`font-bold ${m.correctionRate < 0.15 ? 'text-green-400' : 'text-red-400'}`}>
                                        {(m.correctionRate * 100).toFixed(1)}%
                                    </div>
                                </div>
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400">Error Rate</span>
                                    <div className={`font-bold ${m.errorRate < 0.05 ? 'text-green-400' : 'text-red-400'}`}>
                                        {(m.errorRate * 100).toFixed(1)}%
                                    </div>
                                </div>
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400">Trend</span>
                                    <div className={`font-bold ${m.ratingTrend === 'improving' ? 'text-green-400' :
                                            m.ratingTrend === 'declining' ? 'text-red-400' : 'text-slate-500 dark:text-slate-400'
                                        }`}>
                                        {m.ratingTrend}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Knowledge Graph Stats */}
                {knowledgeStats && (
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                        <h4 className="text-slate-900 dark:text-white font-medium mb-2">Knowledge Graph</h4>
                        <div className="flex gap-4 text-sm">
                            <div>
                                <span className="text-slate-500 dark:text-slate-400">Nodes:</span>
                                <span className="ml-2 text-slate-900 dark:text-white font-bold">{knowledgeStats.nodeCount}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 dark:text-slate-400">Edges:</span>
                                <span className="ml-2 text-slate-900 dark:text-white font-bold">{knowledgeStats.edgeCount}</span>
                            </div>
                            {Object.entries(knowledgeStats.byType).map(([type, count]) => (
                                <div key={type}>
                                    <span className="text-slate-500 dark:text-slate-400 capitalize">{type}:</span>
                                    <span className="ml-1 text-slate-900 dark:text-white">{count as number}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Actions */}
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                    <h4 className="text-slate-900 dark:text-white font-medium mb-3">Recent Optimization Actions</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {actions.length === 0 ? (
                            <p className="text-slate-500 text-sm">No actions yet. Start monitoring to enable auto-optimization.</p>
                        ) : (
                            actions.slice().reverse().map(action => (
                                <div key={action.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${action.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                                action.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                                    'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {action.type}
                                        </span>
                                        <span className="text-slate-600 dark:text-slate-300 text-sm">{action.feature}</span>
                                        <span className="text-slate-500 text-xs">{action.reason.substring(0, 40)}...</span>
                                    </div>
                                    <span className={`text-sm font-medium ${getStatusColor(action.status)}`}>
                                        {action.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-3">
                    <button type="button"
                        onClick={() => selfImprovement.runMonitoringCycle()}
                        className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 font-medium text-sm"
                    >
                        Run Check Now
                    </button>
                    <button type="button"
                        onClick={async () => {
                            const report = await selfImprovement.generateReport(30);
// console.log('Improvement Report:', report);
                            alert(`Report generated with ${report.recommendations.length} recommendations`);
                        }}
                        className="flex-1 py-2 bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-600 font-medium text-sm"
                    >
                        Generate Report
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SelfImprovementDashboard;
