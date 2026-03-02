/**
 * JobHistoryPanel — Shows recent analysis job history
 *
 * Consumes GET /api/analyze/jobs via useAnalysisJobs hook.
 * Shows job status, timing, error codes, and element count.
 * Failed jobs show structured error details with a "Show in 3D" action
 * that highlights problem elements via useModelStore.setErrorElementIds.
 */

import { FC, useState } from 'react';
import { RefreshCw, Clock, CheckCircle2, XCircle, Loader2, AlertTriangle, Eye } from 'lucide-react';
import { useAnalysisJobs, type AnalysisJob } from '../../hooks/useAnalysisJobs';
import { useModelStore } from '../../store/model';

// ============================================
// Helpers
// ============================================

function relativeTime(isoDate: string): string {
    const ms = Date.now() - new Date(isoDate).getTime();
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function durationLabel(job: AnalysisJob): string {
    if (!job.completedAt) return '—';
    const ms = new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
    completed: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Passed' },
    failed:    { icon: XCircle,      color: 'text-red-500',     label: 'Failed' },
    running:   { icon: Loader2,      color: 'text-blue-400',    label: 'Running' },
    pending:   { icon: Clock,        color: 'text-slate-400',   label: 'Queued' },
};

// ============================================
// Component
// ============================================

export const JobHistoryPanel: FC<{ className?: string }> = ({ className = '' }) => {
    const { jobs, loading, error, refresh } = useAnalysisJobs();
    const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
    const setErrorElementIds = useModelStore((s) => s.setErrorElementIds);

    const handleShowInViewport = (elementIds: string[]) => {
        setErrorElementIds(elementIds);
    };

    return (
        <div className={`bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Analysis History
                </h3>
                <button type="button"
                    onClick={() => refresh()}
                    disabled={loading}
                    className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    aria-label="Refresh job history"
                >
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Content */}
            <div className="max-h-80 overflow-y-auto">
                {error && (
                    <div className="px-4 py-3 text-xs text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {error}
                    </div>
                )}

                {!error && jobs.length === 0 && !loading && (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">
                        No analysis jobs yet
                    </div>
                )}

                {loading && jobs.length === 0 && (
                    <div className="px-4 py-8 flex items-center justify-center gap-2 text-sm text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading…
                    </div>
                )}

                {jobs.map((job) => {
                    const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
                    const StatusIcon = cfg.icon;
                    const isExpanded = expandedJobId === job.id;
                    const hasErrorDetails = job.errorDetails && job.errorDetails.length > 0;
                    const allElementIds = job.errorDetails
                        ?.flatMap((d) => d.elementIds || [])
                        .filter(Boolean) || [];

                    return (
                        <div
                            key={job.id}
                            className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                            <div
                                className="flex items-center gap-3 cursor-pointer"
                                onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                            >
                                <StatusIcon
                                    className={`w-4 h-4 shrink-0 ${cfg.color} ${job.status === 'running' ? 'animate-spin' : ''}`}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="font-mono text-slate-500 dark:text-slate-400">
                                            {job.nodeCount}N / {job.memberCount}M
                                        </span>
                                        <span className="text-slate-400 dark:text-slate-500">·</span>
                                        <span className="text-slate-400 dark:text-slate-500">
                                            {relativeTime(job.createdAt)}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400 font-mono">
                                    {durationLabel(job)}
                                </div>
                            </div>

                            {/* Expanded error details */}
                            {isExpanded && job.status === 'failed' && (
                                <div className="mt-2 ml-7 space-y-1.5">
                                    {job.errorCode && (
                                        <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono bg-red-500/10 text-red-400 rounded">
                                            {job.errorCode}
                                        </span>
                                    )}
                                    {hasErrorDetails && job.errorDetails!.map((detail, i) => (
                                        <p key={i} className="text-xs text-slate-400 dark:text-slate-500">
                                            {detail.message}
                                        </p>
                                    ))}
                                    {job.error && !hasErrorDetails && (
                                        <p className="text-xs text-slate-400 dark:text-slate-500">
                                            {job.error}
                                        </p>
                                    )}
                                    {allElementIds.length > 0 && (
                                        <button type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleShowInViewport(allElementIds);
                                            }}
                                            className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 mt-1"
                                        >
                                            <Eye className="w-3 h-3" />
                                            Highlight {allElementIds.length} element{allElementIds.length > 1 ? 's' : ''} in 3D
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default JobHistoryPanel;
