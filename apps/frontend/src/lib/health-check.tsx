/**
 * Health Check Utilities
 * Industry-standard health monitoring for frontend apps
 * 
 * Features:
 * - API health monitoring
 * - Dependency health checks
 * - Reconnection logic
 * - Status indicators
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  lastCheck: Date;
}

export interface SystemHealth {
  overall: HealthStatus;
  checks: HealthCheckResult[];
  timestamp: Date;
}

export interface HealthCheckConfig {
  name: string;
  url: string;
  timeout?: number;
  interval?: number;
  expectedStatus?: number;
}

// ============================================================================
// Health Check Functions
// ============================================================================

/**
 * Perform a single health check
 */
export async function performHealthCheck(
  config: HealthCheckConfig
): Promise<HealthCheckResult> {
  const { name, url, timeout = 5000, expectedStatus = 200 } = config;
  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      // Note: Avoid sending Cache-Control header as it triggers CORS preflight
      // which Azure platform-level CORS may block. Use cache: 'no-store' instead.
      cache: 'no-store',
    });

    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - startTime);

    if (response.status === expectedStatus) {
      return {
        name,
        status: 'healthy',
        latency,
        lastCheck: new Date(),
      };
    }

    return {
      name,
      status: 'degraded',
      latency,
      message: `Unexpected status: ${response.status}`,
      lastCheck: new Date(),
    };
  } catch (error) {
    const latency = Math.round(performance.now() - startTime);
    const message = error instanceof Error ? error.message : 'Unknown error';

    return {
      name,
      status: 'unhealthy',
      latency,
      message,
      lastCheck: new Date(),
    };
  }
}

/**
 * Perform multiple health checks
 */
export async function performHealthChecks(
  configs: HealthCheckConfig[]
): Promise<SystemHealth> {
  const checks = await Promise.all(
    configs.map((config) => performHealthCheck(config))
  );

  const overall = determineOverallStatus(checks);

  return {
    overall,
    checks,
    timestamp: new Date(),
  };
}

/**
 * Determine overall system status from individual checks
 */
function determineOverallStatus(checks: HealthCheckResult[]): HealthStatus {
  const unhealthyCount = checks.filter((c) => c.status === 'unhealthy').length;
  const degradedCount = checks.filter((c) => c.status === 'degraded').length;

  if (unhealthyCount > checks.length / 2) {
    return 'unhealthy';
  }

  if (unhealthyCount > 0 || degradedCount > checks.length / 2) {
    return 'degraded';
  }

  if (degradedCount > 0) {
    return 'degraded';
  }

  return 'healthy';
}

// ============================================================================
// React Hook
// ============================================================================

interface UseHealthCheckOptions {
  configs: HealthCheckConfig[];
  interval?: number;
  enabled?: boolean;
}

export function useHealthCheck(options: UseHealthCheckOptions): {
  health: SystemHealth | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const { configs, interval = 30000, enabled = true } = options;
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await performHealthChecks(configs);
      setHealth(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Health check failed'));
    } finally {
      setIsLoading(false);
    }
  }, [configs]);

  useEffect(() => {
    if (!enabled) return;

    refresh();

    const intervalId = setInterval(refresh, interval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, interval, refresh]);

  return { health, isLoading, error, refresh };
}

// ============================================================================
// Health Status Component
// ============================================================================

interface HealthIndicatorProps {
  status: HealthStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function HealthIndicator({
  status,
  size = 'md',
  showLabel = false,
}: HealthIndicatorProps): JSX.Element {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const statusColors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    unhealthy: 'bg-red-500',
    unknown: 'bg-slate-500',
  };

  const statusLabels = {
    healthy: 'All systems operational',
    degraded: 'Some systems degraded',
    unhealthy: 'System issues detected',
    unknown: 'Status unknown',
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block rounded-full ${sizeClasses[size]} ${statusColors[status]} ${
          status === 'healthy' ? '' : 'animate-pulse'
        }`}
        aria-hidden="true"
      />
      {showLabel && (
        <span className="text-sm text-[#869ab8]">{statusLabels[status]}</span>
      )}
      <span className="sr-only">{statusLabels[status]}</span>
    </div>
  );
}

// ============================================================================
// Default Health Check Configurations
// ============================================================================

export const defaultHealthChecks: HealthCheckConfig[] = [
  {
    name: 'API',
    url: '/api/v1/health',
    timeout: 5000,
    interval: 30000,
  },
  {
    name: 'Auth',
    url: '/api/v1/auth/status',
    timeout: 5000,
    interval: 60000,
  },
];

// ============================================================================
// Connection Monitor
// ============================================================================

export function useConnectionMonitor(): {
  isOnline: boolean;
  wasOffline: boolean;
} {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (!wasOffline) {
        setWasOffline(true);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}
