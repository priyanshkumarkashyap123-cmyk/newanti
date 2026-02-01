/**
 * AuditTrailViewer.tsx
 * 
 * UI component for viewing audit trail entries and generating PE-signable reports
 */

import React, { useState, useMemo } from 'react';
import { auditTrail, AuditEntry } from '../../services/AuditTrailService';

// ============================================
// TYPES
// ============================================

interface AuditTrailViewerProps {
    maxEntries?: number;
    filterType?: AuditEntry['type'];
    onExportReport?: (report: string) => void;
}

// ============================================
// ENTRY ROW COMPONENT
// ============================================

const AuditEntryRow: React.FC<{ entry: AuditEntry }> = ({ entry }) => {
    const [expanded, setExpanded] = useState(false);

    const getTypeIcon = () => {
        switch (entry.type) {
            case 'model_creation': return '🏗️';
            case 'model_modification': return '✏️';
            case 'analysis_request': return '📤';
            case 'analysis_result': return '📊';
            case 'design_check': return '✅';
            case 'optimization': return '⚡';
            case 'ai_recommendation': return '🤖';
            case 'user_override': return '👤';
            case 'export': return '📁';
            case 'session': return '🕐';
            default: return '📋';
        }
    };

    const getTypeColor = () => {
        switch (entry.type) {
            case 'model_creation': return 'text-blue-400';
            case 'model_modification': return 'text-indigo-400';
            case 'analysis_request': return 'text-violet-400';
            case 'analysis_result': return 'text-purple-400';
            case 'design_check': return 'text-green-400';
            case 'optimization': return 'text-yellow-400';
            case 'ai_recommendation': return 'text-cyan-400';
            case 'user_override': return 'text-orange-400';
            case 'export': return 'text-pink-400';
            case 'session': return 'text-slate-400';
            default: return 'text-gray-400';
        }
    };

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    return (
        <div className="border border-gray-700 rounded-lg overflow-hidden mb-2">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 flex items-center gap-3 bg-gray-800 hover:bg-gray-750 transition-colors"
            >
                <span className="text-xl">{getTypeIcon()}</span>
                <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium uppercase ${getTypeColor()}`}>
                            {entry.type.replace('_', ' ')}
                        </span>
                        {entry.aiGenerated && (
                            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">AI</span>
                        )}
                    </div>
                    <div className="text-white text-sm">{entry.action}</div>
                </div>
                <span className="text-gray-500 text-xs">{formatTime(entry.timestamp)}</span>
                <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className="px-4 py-3 bg-gray-850 border-t border-gray-700 text-sm">
                    <div className="mb-2">
                        <span className="text-gray-400">Details: </span>
                        <span className="text-gray-300">{entry.details}</span>
                    </div>
                    {entry.confidence !== undefined && (
                        <div className="mb-2">
                            <span className="text-gray-400">Confidence: </span>
                            <span className="text-white">{(entry.confidence * 100).toFixed(0)}%</span>
                        </div>
                    )}
                    {entry.metadata && (
                        <div className="mt-2">
                            <span className="text-gray-400 block mb-1">Metadata:</span>
                            <pre className="bg-gray-900 text-gray-300 p-2 rounded text-xs overflow-x-auto">
                                {JSON.stringify(entry.metadata, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN VIEWER COMPONENT
// ============================================

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({
    maxEntries = 50,
    filterType,
    onExportReport
}) => {
    const [typeFilter, setTypeFilter] = useState<AuditEntry['type'] | 'all'>(filterType || 'all');
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [engineerName, setEngineerName] = useState('');
    const [licenseNumber, setLicenseNumber] = useState('');

    const entries = useMemo(() => {
        let all = auditTrail.getEntries();
        if (typeFilter !== 'all') {
            all = all.filter(e => e.type === typeFilter);
        }
        return all.slice(-maxEntries).reverse();
    }, [typeFilter, maxEntries]);

    const stats = useMemo(() => auditTrail.getStats(), [entries]);

    const handleExport = () => {
        const report = auditTrail.generateReportMarkdown(engineerName, licenseNumber);

        if (onExportReport) {
            onExportReport(report);
        } else {
            // Download as markdown
            const blob = new Blob([report], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `calculation_report_${new Date().toISOString().split('T')[0]}.md`;
            link.click();
            URL.revokeObjectURL(url);
        }

        setShowExportDialog(false);
    };

    const typeOptions: Array<AuditEntry['type'] | 'all'> = [
        'all', 'model_creation', 'model_modification', 'analysis_request', 'analysis_result', 'design_check',
        'optimization', 'ai_recommendation', 'user_override'
    ];

    // ==========================================
    // RENDER
    // ==========================================

    return (
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                    <h3 className="font-semibold text-white">Audit Trail</h3>
                    <span className="text-gray-400 text-sm">({entries.length} entries)</span>
                </div>
                <button
                    onClick={() => setShowExportDialog(true)}
                    className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-500"
                >
                    Export Report
                </button>
            </div>

            {/* Stats Bar */}
            <div className="px-4 py-2 bg-gray-850 border-b border-gray-700 flex gap-4 text-xs">
                <div>
                    <span className="text-gray-400">Total: </span>
                    <span className="text-white">{stats.total}</span>
                </div>
                <div>
                    <span className="text-gray-400">AI Decisions: </span>
                    <span className="text-cyan-400">{stats.aiGenerated}</span>
                </div>
                <div>
                    <span className="text-gray-400">Overrides: </span>
                    <span className="text-orange-400">{stats.userOverrides}</span>
                </div>
            </div>

            {/* Filter */}
            <div className="px-4 py-2 border-b border-gray-700">
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value as any)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
                >
                    {typeOptions.map(opt => (
                        <option key={opt} value={opt}>
                            {opt === 'all' ? 'All Types' : opt.replace('_', ' ').toUpperCase()}
                        </option>
                    ))}
                </select>
            </div>

            {/* Entries List */}
            <div className="p-4 max-h-96 overflow-y-auto">
                {entries.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <p>No audit entries yet</p>
                        <p className="text-sm mt-2">Actions will be logged as you work</p>
                    </div>
                ) : (
                    entries.map(entry => (
                        <AuditEntryRow key={entry.id} entry={entry} />
                    ))
                )}
            </div>

            {/* Export Dialog */}
            {showExportDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 w-96 border border-gray-700">
                        <h3 className="text-white font-semibold mb-4">Generate PE-Signable Report</h3>

                        <div className="mb-4">
                            <label className="text-gray-400 text-sm block mb-1">Engineer Name</label>
                            <input
                                type="text"
                                value={engineerName}
                                onChange={e => setEngineerName(e.target.value)}
                                placeholder="John Smith, PE"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                            />
                        </div>

                        <div className="mb-6">
                            <label className="text-gray-400 text-sm block mb-1">License Number</label>
                            <input
                                type="text"
                                value={licenseNumber}
                                onChange={e => setLicenseNumber(e.target.value)}
                                placeholder="PE-12345"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowExportDialog(false)}
                                className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExport}
                                className="flex-1 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500"
                            >
                                Generate Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditTrailViewer;
