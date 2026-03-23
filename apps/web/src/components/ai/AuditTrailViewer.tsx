/**
 * AuditTrailViewer.tsx
 * 
 * UI component for viewing audit trail entries and generating PE-signable reports
 */

import React, { useState, useMemo } from 'react';
import { auditTrail, AuditEntry } from '../../services/AuditTrailService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

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
            case 'session': return 'text-[#869ab8]';
            default: return 'text-[#869ab8]';
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
        <div className="border border-[#1a2333] rounded-lg overflow-hidden mb-2">
            <button type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 flex items-center gap-3 bg-[#131b2e] hover:bg-slate-200 dark:hover:bg-slate-750 transition-colors"
            >
                <span className="text-xl">{getTypeIcon()}</span>
                <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium tracking-wide uppercase ${getTypeColor()}`}>
                            {entry.type.replace('_', ' ')}
                        </span>
                        {entry.aiGenerated && (
                            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">AI</span>
                        )}
                    </div>
                    <div className="text-[#dae2fd] text-sm">{entry.action}</div>
                </div>
                <span className="text-slate-500 dark:text-slate-500 text-xs">{formatTime(entry.timestamp)}</span>
                <svg
                    className={`w-5 h-5 text-[#869ab8] transition-transform ${expanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-850 border-t border-[#1a2333] text-sm">
                    <div className="mb-2">
                        <span className="text-[#869ab8]">Details: </span>
                        <span className="text-[#adc6ff]">{entry.details}</span>
                    </div>
                    {entry.confidence !== undefined && (
                        <div className="mb-2">
                            <span className="text-[#869ab8]">Confidence: </span>
                            <span className="text-[#dae2fd]">{(entry.confidence * 100).toFixed(0)}%</span>
                        </div>
                    )}
                    {entry.metadata && (
                        <div className="mt-2">
                            <span className="text-[#869ab8] block mb-1">Metadata:</span>
                            <pre className="bg-[#0b1326] text-[#adc6ff] p-2 rounded text-xs overflow-x-auto">
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
        <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-[#131b2e] border-b border-[#1a2333] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                    <h3 className="font-semibold text-[#dae2fd]">Audit Trail</h3>
                    <span className="text-[#869ab8] text-sm">({entries.length} entries)</span>
                </div>
                <button type="button"
                    onClick={() => setShowExportDialog(true)}
                    className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-500"
                >
                    Export Report
                </button>
            </div>

            {/* Stats Bar */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-850 border-b border-[#1a2333] flex gap-4 text-xs">
                <div>
                    <span className="text-[#869ab8]">Total: </span>
                    <span className="text-[#dae2fd]">{stats.total}</span>
                </div>
                <div>
                    <span className="text-[#869ab8]">AI Decisions: </span>
                    <span className="text-cyan-400">{stats.aiGenerated}</span>
                </div>
                <div>
                    <span className="text-[#869ab8]">Overrides: </span>
                    <span className="text-orange-400">{stats.userOverrides}</span>
                </div>
            </div>

            {/* Filter */}
            <div className="px-4 py-2 border-b border-[#1a2333]">
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value as any)}
                    className="bg-[#131b2e] border border-[#1a2333] rounded-lg px-3 py-1.5 text-sm text-[#dae2fd]"
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
                    <div className="text-center py-8 text-[#869ab8]">
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
            <Dialog open={showExportDialog} onOpenChange={(open) => !open && setShowExportDialog(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Generate PE-Signable Report</DialogTitle>
                        <DialogDescription>Enter your professional engineer details for the report.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label className="text-[#869ab8] text-sm block mb-1">Engineer Name</Label>
                            <Input
                                type="text"
                                value={engineerName}
                                onChange={e => setEngineerName(e.target.value)}
                                placeholder="John Smith, PE"
                            />
                        </div>

                        <div>
                            <Label className="text-[#869ab8] text-sm block mb-1">License Number</Label>
                            <Input
                                type="text"
                                value={licenseNumber}
                                onChange={e => setLicenseNumber(e.target.value)}
                                placeholder="PE-12345"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowExportDialog(false)}>Cancel</Button>
                        <Button onClick={handleExport} className="bg-amber-600 hover:bg-amber-500 text-white">Generate Report</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AuditTrailViewer;
