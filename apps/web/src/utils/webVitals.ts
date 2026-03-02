/**
 * Web Vitals Performance Monitoring
 *
 * Tracks Core Web Vitals (LCP, FID, CLS, FCP, TTFB, INP) and reports
 * them to the console in development and to the analytics endpoint in production.
 *
 * @see https://web.dev/articles/vitals
 */

import type { Metric } from 'web-vitals';

// Threshold ratings per Google's Web Vitals guidelines
const THRESHOLDS: Record<string, { good: number; poor: number }> = {
  CLS:  { good: 0.1,  poor: 0.25 },
  FCP:  { good: 1800, poor: 3000 },
  FID:  { good: 100,  poor: 300  },
  INP:  { good: 200,  poor: 500  },
  LCP:  { good: 2500, poor: 4000 },
  TTFB: { good: 800,  poor: 1800 },
};

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const t = THRESHOLDS[name];
  if (!t) return 'needs-improvement';
  if (value <= t.good) return 'good';
  if (value >= t.poor) return 'poor';
  return 'needs-improvement';
}

const RATING_COLORS: Record<string, string> = {
  good: '#0cce6b',
  'needs-improvement': '#ffa400',
  poor: '#ff4e42',
};

/**
 * Send metrics to analytics endpoint (batched)
 */
const metricsQueue: Metric[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function queueMetric(metric: Metric) {
  metricsQueue.push(metric);

  // Debounce: flush after 2s of no new metrics
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushMetrics, 2000);
}

function flushMetrics() {
  if (metricsQueue.length === 0) return;

  const batch = metricsQueue.splice(0);

  // Use sendBeacon for reliability (survives page unload)
  const apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && typeof navigator.sendBeacon === 'function') {
    const payload = JSON.stringify({
      metrics: batch.map(m => ({
        name: m.name,
        value: m.value,
        rating: m.rating,
        delta: m.delta,
        id: m.id,
        navigationType: m.navigationType,
        timestamp: Date.now(),
        url: window.location.pathname,
      })),
    });
    navigator.sendBeacon(`${apiUrl}/api/v1/analytics/web-vitals`, payload);
  }
}

/**
 * Console reporter for development
 */
function reportToConsole(metric: Metric) {
  const rating = getRating(metric.name, metric.value);
  const color = RATING_COLORS[rating];
  const value = metric.name === 'CLS' ? metric.value.toFixed(3) : `${Math.round(metric.value)}ms`;

  console.log(
    `%c[Web Vitals] %c${metric.name} %c${value} %c(${rating})`,
    'color: #888',
    'color: #fff; font-weight: bold',
    `color: ${color}; font-weight: bold`,
    `color: ${color}`,
  );
}

/**
 * Initialize Web Vitals tracking.
 * Call once in main.tsx after app mount.
 */
export async function initWebVitals() {
  try {
    // web-vitals v5: onFID removed (replaced by INP)
    const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import('web-vitals');

    const handler = (metric: Metric) => {
      // Always log in dev
      if (import.meta.env.DEV) {
        reportToConsole(metric);
      }

      // Always queue for production reporting
      queueMetric(metric);
    };

    onCLS(handler);
    onFCP(handler);
    onINP(handler);
    onLCP(handler);
    onTTFB(handler);

    // Flush remaining metrics before page unload
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushMetrics();
      }
    });
  } catch (e) {
    // web-vitals is non-critical
    console.warn('⚠️ Web Vitals initialization failed:', e);
  }
}
