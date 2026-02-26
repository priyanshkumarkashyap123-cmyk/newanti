/**
 * ============================================================================
 * PERFORMANCE MONITORING UTILITY
 * ============================================================================
 * 
 * Industry-standard performance monitoring with:
 * - Web Vitals tracking (Core Web Vitals)
 * - Custom performance marks
 * - Resource timing
 * - Long task detection
 * 
 * @version 1.0.0
 */

import { logger } from './logger';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private readonly enabled: boolean;

  constructor() {
    this.enabled = typeof window !== 'undefined' && 'performance' in window;
    
    if (this.enabled) {
      this.initWebVitals();
      this.initLongTaskDetection();
    }
  }

  /**
   * Initialize Core Web Vitals monitoring
   */
  private initWebVitals(): void {
    // Largest Contentful Paint (LCP)
    this.observeLCP();
    
    // First Input Delay (FID)
    this.observeFID();
    
    // Cumulative Layout Shift (CLS)
    this.observeCLS();
    
    // Time to First Byte (TTFB)
    this.observeTTFB();
  }

  private observeLCP(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime: number; loadTime: number };
        const lcp = lastEntry.renderTime || lastEntry.loadTime;
        
        this.reportMetric({
          name: 'LCP',
          value: lcp,
          rating: lcp <= 2500 ? 'good' : lcp <= 4000 ? 'needs-improvement' : 'poor',
          timestamp: Date.now(),
        });
      });

      try {
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // Ignore errors in browsers that don't support this
      }
    }
  }

  private observeFID(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fid = (entry as PerformanceEventTiming).processingStart - entry.startTime;
          
          this.reportMetric({
            name: 'FID',
            value: fid,
            rating: fid <= 100 ? 'good' : fid <= 300 ? 'needs-improvement' : 'poor',
            timestamp: Date.now(),
          });
        });
      });

      try {
        observer.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        // Ignore errors
      }
    }
  }

  private observeCLS(): void {
    if ('PerformanceObserver' in window) {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as LayoutShift).hadRecentInput) {
            clsValue += (entry as LayoutShift).value;
          }
        }
        
        this.reportMetric({
          name: 'CLS',
          value: clsValue,
          rating: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor',
          timestamp: Date.now(),
        });
      });

      try {
        observer.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        // Ignore errors
      }
    }
  }

  private observeTTFB(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const ttfb = (entry as PerformanceNavigationTiming).responseStart;
          
          this.reportMetric({
            name: 'TTFB',
            value: ttfb,
            rating: ttfb <= 800 ? 'good' : ttfb <= 1800 ? 'needs-improvement' : 'poor',
            timestamp: Date.now(),
          });
        });
      });

      try {
        observer.observe({ entryTypes: ['navigation'] });
      } catch (e) {
        // Ignore errors
      }
    }
  }

  /**
   * Detect long tasks (>50ms)
   */
  private initLongTaskDetection(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              logger.warn('Long task detected', {
                name: entry.name,
                duration: entry.duration,
                startTime: entry.startTime,
              });
            }
          }
        });

        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // Not supported in all browsers
      }
    }
  }

  /**
   * Report metric to analytics
   */
  private reportMetric(metric: PerformanceMetric): void {
    logger.info('Performance metric', metric);

    // Send to analytics service (Google Analytics, etc.)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', metric.name, {
        value: Math.round(metric.value),
        metric_rating: metric.rating,
        metric_delta: metric.value,
      });
    }
  }

  /**
   * Mark the start of a custom performance measurement
   */
  mark(name: string): void {
    if (!this.enabled) return;

    const timestamp = performance.now();
    this.marks.set(name, timestamp);
    performance.mark(name);
    
    logger.debug(`Performance mark: ${name}`, { timestamp });
  }

  /**
   * Measure time between two marks or from a mark to now
   */
  measure(name: string, startMark?: string, endMark?: string): number | null {
    if (!this.enabled) return null;

    try {
      if (startMark && endMark) {
        performance.measure(name, startMark, endMark);
      } else if (startMark) {
        performance.measure(name, startMark);
      }

      const measure = performance.getEntriesByName(name, 'measure')[0];
      if (measure) {
        logger.debug(`Performance measure: ${name}`, { duration: measure.duration });
        return measure.duration;
      }
    } catch (e) {
      logger.error('Performance measurement failed', e);
    }

    return null;
  }

  /**
   * Get resource timing information
   */
  getResourceTiming(): PerformanceResourceTiming[] {
    if (!this.enabled) return [];
    return performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  }

  /**
   * Get navigation timing
   */
  getNavigationTiming(): PerformanceNavigationTiming | null {
    if (!this.enabled) return null;
    const entries = performance.getEntriesByType('navigation');
    return entries[0] as PerformanceNavigationTiming || null;
  }

  /**
   * Clear all marks and measures
   */
  clear(): void {
    if (!this.enabled) return;
    
    this.marks.clear();
    performance.clearMarks();
    performance.clearMeasures();
  }

  /**
   * Get memory usage (Chrome only)
   */
  getMemoryUsage(): MemoryInfo | null {
    if (!this.enabled) return null;
    return (performance as Performance & { memory?: MemoryInfo }).memory || null;
  }
}

// Type definitions
interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

// Extend Window for gtag
declare global {
  interface Window {
    gtag?: (
      command: string,
      eventName: string,
      params?: Record<string, unknown>
    ) => void;
  }
}

// Export singleton
export const performanceMonitor = new PerformanceMonitor();

/**
 * Higher-order function to measure component render time
 */
export function measureRender<T extends (...args: unknown[]) => unknown>(
  fn: T,
  componentName: string
): T {
  return ((...args: unknown[]) => {
    performanceMonitor.mark(`${componentName}-start`);
    const result = fn(...args);
    performanceMonitor.mark(`${componentName}-end`);
    performanceMonitor.measure(
      `${componentName}-render`,
      `${componentName}-start`,
      `${componentName}-end`
    );
    return result;
  }) as T;
}
