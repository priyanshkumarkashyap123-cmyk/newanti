/**
 * ============================================================================
 * BACKEND HEALTH DASHBOARD
 * ============================================================================
 *
 * Real-time monitoring of all backend services (Node, Python, Rust).
 * Shows connection status, response times, and service capabilities.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_CONFIG } from '../config/env';
import rustApi from '../api/rustApi';

// ── Types ───────────────────────────────────────────────────────────────────

interface ServiceHealth {
  name: string;
  url: string;
  status: 'online' | 'offline' | 'checking' | 'degraded';
  responseTimeMs: number | null;
  lastChecked: Date | null;
  version?: string;
  capabilities?: string[];
  error?: string;
}

interface QueueMetrics {
  queued: number;
  running: number;
  completed: number;
  failed: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BackendHealthDashboard() {
  const [services, setServices] = useState<ServiceHealth[]>([
    { name: 'Node.js API', url: API_CONFIG.baseUrl, status: 'checking', responseTimeMs: null, lastChecked: null },
    { name: 'Python API', url: API_CONFIG.pythonUrl, status: 'checking', responseTimeMs: null, lastChecked: null },
    { name: 'Rust Engine', url: API_CONFIG.rustUrl, status: 'checking', responseTimeMs: null, lastChecked: null },
  ]);
  const [queue, setQueue] = useState<QueueMetrics | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const checkService = useCallback(async (index: number, url: string): Promise<ServiceHealth> => {
    const svc = services[index];
    const start = performance.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const healthUrl = url.endsWith('/') ? `${url}api/health` : `${url}/api/health`;
      const resp = await fetch(healthUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeout);

      const elapsed = Math.round(performance.now() - start);
      let data: any = {};
      try { data = await resp.json(); } catch { /* ignore parse errors */ }

      return {
        ...svc,
        status: resp.ok ? 'online' : 'degraded',
        responseTimeMs: elapsed,
        lastChecked: new Date(),
        version: data.version,
        capabilities: data.capabilities,
        error: resp.ok ? undefined : `HTTP ${resp.status}`,
      };
    } catch (e: any) {
      return {
        ...svc,
        status: 'offline',
        responseTimeMs: null,
        lastChecked: new Date(),
        error: e.name === 'AbortError' ? 'Timeout (5s)' : e.message,
      };
    }
  }, [services]);

  const checkAllServices = useCallback(async () => {
    setServices(prev => prev.map(s => ({ ...s, status: 'checking' as const })));

    const results = await Promise.all([
      checkService(0, API_CONFIG.baseUrl),
      checkService(1, API_CONFIG.pythonUrl),
      checkService(2, API_CONFIG.rustUrl),
    ]);
    setServices(results);

    // Also fetch queue metrics if Rust is available
    try {
      const queueStatus = await rustApi.getQueueStatus();
      setQueue(queueStatus);
    } catch {
      setQueue(null);
    }
  }, [checkService]);

  useEffect(() => {
    checkAllServices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(checkAllServices, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, checkAllServices]);

  const overallStatus = services.every(s => s.status === 'online')
    ? 'All Systems Operational'
    : services.some(s => s.status === 'online')
      ? 'Partial Outage'
      : services.every(s => s.status === 'checking')
        ? 'Checking...'
        : 'Major Outage';

  const statusColor = (s: ServiceHealth['status']) => {
    switch (s) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'degraded': return 'bg-yellow-500';
      case 'checking': return 'bg-blue-400 animate-pulse';
    }
  };

  const statusIcon = (s: ServiceHealth['status']) => {
    switch (s) {
      case 'online': return '●';
      case 'offline': return '○';
      case 'degraded': return '◐';
      case 'checking': return '◌';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            System Health
          </h2>
          <p className={`text-sm mt-1 font-medium ${
            overallStatus === 'All Systems Operational'
              ? 'text-green-600 dark:text-green-400'
              : overallStatus === 'Partial Outage'
                ? 'text-yellow-600 dark:text-yellow-400'
                : overallStatus === 'Checking...'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-red-600 dark:text-red-400'
          }`}>
            {overallStatus}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={checkAllServices}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       transition-colors text-sm font-medium shadow-sm"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {services.map((svc, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 
                       p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {svc.name}
              </h3>
              <span className={`w-3 h-3 rounded-full ${statusColor(svc.status)}`}
                    title={svc.status} />
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>Status</span>
                <span className="font-medium capitalize">{svc.status}</span>
              </div>

              {svc.responseTimeMs !== null && (
                <div className="flex justify-between text-gray-500 dark:text-gray-400">
                  <span>Latency</span>
                  <span className={`font-medium ${
                    svc.responseTimeMs < 200 ? 'text-green-600 dark:text-green-400' :
                    svc.responseTimeMs < 1000 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {svc.responseTimeMs}ms
                  </span>
                </div>
              )}

              {svc.version && (
                <div className="flex justify-between text-gray-500 dark:text-gray-400">
                  <span>Version</span>
                  <span className="font-mono text-xs">{svc.version}</span>
                </div>
              )}

              {svc.error && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 
                                dark:text-red-400 text-xs">
                  {svc.error}
                </div>
              )}

              {svc.lastChecked && (
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Checked: {svc.lastChecked.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Job Queue Metrics */}
      {queue && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Analysis Job Queue
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Queued" value={queue.queued} color="blue" />
            <MetricCard label="Running" value={queue.running} color="yellow" />
            <MetricCard label="Completed" value={queue.completed} color="green" />
            <MetricCard label="Failed" value={queue.failed} color="red" />
          </div>
        </div>
      )}

      {/* Connection Info */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
          Endpoint Configuration
        </h3>
        <div className="space-y-2 font-mono text-xs">
          {services.map((svc, i) => (
            <div key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <span className={`${statusIcon(svc.status)} text-sm`}>{statusIcon(svc.status)}</span>
              <span className="w-24 font-sans font-medium">{svc.name}</span>
              <span className="text-gray-400">{svc.url}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────────────────────────

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    yellow: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className={`rounded-lg p-3 text-center ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium opacity-75">{label}</div>
    </div>
  );
}
