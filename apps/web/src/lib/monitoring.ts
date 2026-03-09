/**
 * ============================================================================
 * MONITORING & OBSERVABILITY CONFIGURATION
 * ============================================================================
 * 
 * Centralized monitoring setup for production observability:
 * - Sentry error tracking configuration
 * - Custom metrics collection
 * - Performance monitoring
 * - User session tracking
 * - Alert thresholds
 * 
 * @version 1.0.0
 */

import * as Sentry from '@sentry/react';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface MonitoringConfig {
  sentryDsn?: string;
  environment: 'development' | 'production' | 'staging';
  release?: string;
  tracesSampleRate: number;
  enablePerformanceMonitoring: boolean;
  enableSessionReplay: boolean;
}

/**
 * Initialize monitoring for production
 */
export function initializeMonitoring(config: MonitoringConfig): void {
  const { sentryDsn, environment, release, tracesSampleRate, enablePerformanceMonitoring } = config;

  if (!sentryDsn) {
    if (import.meta.env.DEV) console.warn('Sentry DSN not configured - monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment,
    release,
    
    // Performance sampling
    tracesSampleRate: enablePerformanceMonitoring ? tracesSampleRate : 0,
    
    // Filter out noise
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'Non-Error promise rejection captured',
      // Network errors (already handled by API client)
      'Network request failed',
      'Failed to fetch',
      // User aborted requests
      'AbortError',
      'The user aborted a request',
    ],
    
    // Custom error filtering
    beforeSend(event, hint) {
      // Don't send events in development
      if (environment === 'development') {
        return null;
      }
      
      // Filter out non-critical errors
      if (event.level === 'warning') {
        return null;
      }
      
      return event;
    },
    
    // Attach custom context
    beforeBreadcrumb(breadcrumb, hint) {
      // Sanitize sensitive data from breadcrumbs
      if (breadcrumb.data) {
        delete breadcrumb.data.password;
        delete breadcrumb.data.token;
        delete breadcrumb.data.apiKey;
      }
      return breadcrumb;
    },
  });

  if (import.meta.env.DEV) console.log(`Monitoring initialized: ${environment}`);
}

// ============================================================================
// CUSTOM METRICS
// ============================================================================

export interface CustomMetric {
  name: string;
  value: number;
  unit: 'milliseconds' | 'bytes' | 'count';
  tags?: Record<string, string>;
}

/**
 * Track custom business metric
 */
export function trackMetric(metric: CustomMetric): void {
  // Send to monitoring service if available
  if (typeof (Sentry as any).metrics !== 'undefined') {
    try {
      (Sentry as any).metrics.gauge(metric.name, metric.value);
    } catch (e) {
      // Fallback if metrics API not available
    }
  }
  
  // Also log for debugging
  console.debug(`Metric: ${metric.name} = ${metric.value} ${metric.unit}`, metric.tags);
}

/**
 * Track API call metrics
 */
export function trackApiCall(endpoint: string, duration: number, status: number): void {
  trackMetric({
    name: 'api.call.duration',
    value: duration,
    unit: 'milliseconds',
    tags: {
      endpoint,
      status: String(status),
      success: status < 400 ? 'true' : 'false',
    },
  });
}

/**
 * Track analysis metrics
 */
export function trackAnalysis(type: string, duration: number, nodeCount: number, memberCount: number): void {
  trackMetric({
    name: 'analysis.duration',
    value: duration,
    unit: 'milliseconds',
    tags: {
      type,
      complexity: nodeCount > 100 ? 'high' : nodeCount > 50 ? 'medium' : 'low',
    },
  });
  
  trackMetric({
    name: 'analysis.model_size',
    value: nodeCount + memberCount,
    unit: 'count',
    tags: { type },
  });
}

// ============================================================================
// USER CONTEXT
// ============================================================================

/**
 * Set user context for error tracking
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  subscriptionTier?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    subscriptionTier: user.subscriptionTier,
  });
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

// ============================================================================
// CUSTOM ALERTS
// ============================================================================

export interface AlertThreshold {
  metric: string;
  threshold: number;
  severity: 'warning' | 'error' | 'critical';
}

const ALERT_THRESHOLDS: AlertThreshold[] = [
  { metric: 'api.error_rate', threshold: 0.05, severity: 'warning' },    // 5% error rate
  { metric: 'api.error_rate', threshold: 0.10, severity: 'error' },      // 10% error rate
  { metric: 'api.latency_p95', threshold: 2000, severity: 'warning' },   // 2s p95 latency
  { metric: 'api.latency_p95', threshold: 5000, severity: 'error' },     // 5s p95 latency
  { metric: 'memory.usage_percent', threshold: 80, severity: 'warning' }, // 80% memory
  { metric: 'memory.usage_percent', threshold: 90, severity: 'critical' },// 90% memory
];

/**
 * Check if metric exceeds threshold and alert
 */
export function checkThreshold(metric: string, value: number): void {
  const thresholds = ALERT_THRESHOLDS.filter(t => t.metric === metric);
  
  for (const threshold of thresholds) {
    if (value >= threshold.threshold) {
      const level = threshold.severity === 'critical' ? 'error' : threshold.severity;
      Sentry.captureMessage(
        `Threshold exceeded: ${metric} = ${value} (threshold: ${threshold.threshold})`,
        level as Sentry.SeverityLevel
      );
    }
  }
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Track page load performance
 */
export function trackPageLoad(route: string): void {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  
  if (navigation) {
    const loadTime = navigation.loadEventEnd - navigation.fetchStart;
    const domReady = navigation.domContentLoadedEventEnd - navigation.fetchStart;
    const ttfb = navigation.responseStart - navigation.requestStart;
    
    trackMetric({
      name: 'page.load_time',
      value: loadTime,
      unit: 'milliseconds',
      tags: { route },
    });
    
    trackMetric({
      name: 'page.dom_ready',
      value: domReady,
      unit: 'milliseconds',
      tags: { route },
    });
    
    trackMetric({
      name: 'page.ttfb',
      value: ttfb,
      unit: 'milliseconds',
      tags: { route },
    });
  }
}

/**
 * Create transaction for distributed tracing
 */
export function createTransaction(name: string, op: string): any {
  // Transactions deprecated in favor of startSpan
  return { name, op, startChild: () => ({ finish: () => {} }), finish: () => {} };
}

/**
 * Add span to active transaction
 */
export function addSpan(transaction: any, name: string, op: string, callback: () => void): void {
  const span = transaction.startChild({ op, description: name });
  try {
    callback();
  } finally {
    span.finish();
  }
}

// ============================================================================
// ERROR REPORTING
// ============================================================================

/**
 * Manually capture exception
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  Sentry.captureException(error, {
    contexts: context,
  });
}

/**
 * Capture message (non-error)
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  Sentry.captureMessage(message, level);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

// ============================================================================
// HEALTH CHECKS
// ============================================================================

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
  timestamp: number;
}

/**
 * Run system health checks
 */
export async function runHealthChecks(): Promise<HealthCheckResult> {
  const checks: Record<string, boolean> = {};
  
  // Check API connectivity
  try {
    const response = await fetch('/health', { method: 'GET' });
    checks['api'] = response.ok;
  } catch {
    checks['api'] = false;
  }
  
  // Check IndexedDB
  try {
    await indexedDB.open('health-check-test');
    checks['indexeddb'] = true;
  } catch {
    checks['indexeddb'] = false;
  }
  
  // Check localStorage
  try {
    localStorage.setItem('health-check', 'test');
    localStorage.removeItem('health-check');
    checks['localstorage'] = true;
  } catch {
    checks['localstorage'] = false;
  }
  
  // Check memory
  const memory = (performance as any).memory;
  if (memory) {
    checks['memory'] = memory.usedJSHeapSize / memory.jsHeapSizeLimit < 0.9;
  }
  
  const healthyCount = Object.values(checks).filter(Boolean).length;
  const totalCount = Object.values(checks).length;
  
  let status: HealthCheckResult['status'] = 'healthy';
  if (healthyCount === 0) status = 'unhealthy';
  else if (healthyCount < totalCount) status = 'degraded';
  
  return {
    status,
    checks,
    timestamp: Date.now(),
  };
}
