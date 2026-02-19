/**
 * IntegrationDiagnostics.tsx
 *
 * Lightweight modal that pings all backend health endpoints and
 * displays latency, status, and version information.
 *
 * Accessible from the status bar "Backends" indicator.
 */

import { FC, useState, useCallback, useEffect, memo } from 'react';
import { X, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { API_CONFIG } from '../config/env';

// ============================================
// Types
// ============================================

interface ServiceResult {
    name: string;
    url: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'loading';
    latencyMs: number | null;
    version?: string;
    detail?: string;
}

interface IntegrationDiagnosticsProps {
    open: boolean;
    onClose: () => void;
}

// ============================================
// Helpers
// ============================================

async function probeService(name: string, baseUrl: string): Promise<ServiceResult> {
    const url = `${baseUrl.replace(/\/$/, '')}/health`;
    const t0 = performance.now();
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - t0);
        if (!res.ok) {
            return { name, url, status: 'degraded', latencyMs, detail: `HTTP ${res.status}` };
        }
        try {
            const body = await res.json();
            return {
                name,
                url,
                status: 'healthy',
                latencyMs,
                version: body.version || body.service || undefined,
                detail: body.status || 'ok',
            };
        } catch {
            return { name, url, status: 'healthy', latencyMs, detail: 'ok (non-JSON)' };
        }
    } catch (err: any) {
        const latencyMs = Math.round(performance.now() - t0);
        return {
            name,
            url,
            status: 'unhealthy',
            latencyMs,
            detail: err?.name === 'AbortError' ? 'Timeout (>5 s)' : (err?.message || 'unreachable'),
        };
    }
}

// ============================================
// Component
// ============================================

export const IntegrationDiagnostics: FC<IntegrationDiagnosticsProps> = memo(({ open, onClose }) => {
    const [results, setResults] = useState<ServiceResult[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [pyDeps, setPyDeps] = useState<Record<string, any> | null>(null);

    const runProbes = useCallback(async () => {
        setRefreshing(true);
        setPyDeps(null);

        const services: { name: string; url: string }[] = [
            { name: 'Node API', url: API_CONFIG.baseUrl },
            { name: 'Python API', url: API_CONFIG.pythonUrl },
            { name: 'Rust API', url: API_CONFIG.rustUrl },
        ];

        // Mark all loading
        setResults(services.map((s) => ({ ...s, status: 'loading' as const, latencyMs: null })));

        const probed = await Promise.all(services.map((s) => probeService(s.name, s.url)));
        setResults(probed);

        // Also fetch Python's dependency health
        try {
            const depUrl = `${API_CONFIG.pythonUrl.replace(/\/$/, '')}/health/dependencies`;
            const depRes = await fetch(depUrl, { cache: 'no-store' });
            if (depRes.ok) {
                setPyDeps(await depRes.json());
            }
        } catch {
            // ignore
        }

        setRefreshing(false);
    }, []);

    useEffect(() => {
        if (open) runProbes();
    }, [open, runProbes]);

    if (!open) return null;

    const overallHealthy = results.every((r) => r.status === 'healthy');
    const anyUnhealthy = results.some((r) => r.status === 'unhealthy');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                        {overallHealthy ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : anyUnhealthy ? (
                            <XCircle className="w-4 h-4 text-red-400" />
                        ) : (
                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        )}
                        Integration Diagnostics
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={runProbes}
                            disabled={refreshing}
                            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition disabled:opacity-40"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Service rows */}
                <div className="px-5 py-4 space-y-3">
                    {results.map((r) => (
                        <div
                            key={r.name}
                            className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg border border-slate-700/50"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <StatusIcon status={r.status} />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{r.name}</p>
                                    <p className="text-[11px] text-slate-400 truncate font-mono">{r.url}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end ml-3 flex-shrink-0">
                                {r.status === 'loading' ? (
                                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                                ) : (
                                    <>
                                        <span className={`text-xs font-mono ${latencyColor(r.latencyMs)}`}>
                                            {r.latencyMs !== null ? `${r.latencyMs} ms` : '—'}
                                        </span>
                                        {r.version && (
                                            <span className="text-[10px] text-slate-500">{r.version}</span>
                                        )}
                                        {r.detail && r.status !== 'healthy' && (
                                            <span className="text-[10px] text-yellow-400 max-w-[140px] truncate">
                                                {r.detail}
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Dependency cross-check */}
                {pyDeps && (
                    <div className="px-5 pb-4">
                        <p className="text-[11px] text-slate-500 mb-1.5">Python → Backends Cross-Check</p>
                        <div className="flex gap-3 text-xs">
                            <span className="flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${pyDeps.node === 'ok' ? 'bg-green-400' : 'bg-red-400'}`} />
                                Node: {pyDeps.node}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${pyDeps.rust === 'ok' ? 'bg-green-400' : 'bg-red-400'}`} />
                                Rust: {pyDeps.rust}
                            </span>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="px-5 py-2.5 border-t border-slate-700 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Auto-refresh every 30 s in status bar</span>
                    <span>
                        {overallHealthy
                            ? 'All systems operational'
                            : anyUnhealthy
                                ? 'Service outage detected'
                                : 'Partial degradation'}
                    </span>
                </div>
            </div>
        </div>
    );
});

IntegrationDiagnostics.displayName = 'IntegrationDiagnostics';

// ============================================
// Sub-components
// ============================================

const StatusIcon: FC<{ status: ServiceResult['status'] }> = ({ status }) => {
    if (status === 'loading') return <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />;
    if (status === 'healthy') return <CheckCircle2 className="w-5 h-5 text-green-400" />;
    if (status === 'degraded') return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    return <XCircle className="w-5 h-5 text-red-400" />;
};

function latencyColor(ms: number | null): string {
    if (ms === null) return 'text-slate-500';
    if (ms < 100) return 'text-green-400';
    if (ms < 300) return 'text-yellow-400';
    return 'text-red-400';
}

export default IntegrationDiagnostics;
