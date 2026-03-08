/**
 * ============================================================================
 * PERFORMANCE MONITORING & OPTIMIZATION
 * ============================================================================
 * 
 * Utilities for measuring and optimizing frontend performance:
 * - Core Web Vitals tracking
 * - Component render profiling
 * - Bundle size analysis helpers
 * - Lazy loading utilities
 * - Performance budgets
 * 
 * @version 1.0.0
 */

// ============================================================================
// CORE WEB VITALS
// ============================================================================

export interface WebVitalsMetrics {
  // Largest Contentful Paint
  lcp?: number;
  // First Input Delay
  fid?: number;
  // Cumulative Layout Shift
  cls?: number;
  // First Contentful Paint
  fcp?: number;
  // Time to First Byte
  ttfb?: number;
  // Interaction to Next Paint
  inp?: number;
}

/**
 * Track Core Web Vitals and report to analytics
 */
export function trackWebVitals(onReport: (metric: { name: string; value: number; rating: string }) => void) {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return;
  }

  try {
    // LCP - Largest Contentful Paint (Good: <2.5s, Needs improvement: 2.5-4s, Poor: >4s)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      const lcp = lastEntry.renderTime || lastEntry.loadTime;
      const rating = lcp < 2500 ? 'good' : lcp < 4000 ? 'needs-improvement' : 'poor';
      onReport({ name: 'LCP', value: lcp, rating });
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // FID - First Input Delay (Good: <100ms, Needs improvement: 100-300ms, Poor: >300ms)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        const fid = entry.processingStart - entry.startTime;
        const rating = fid < 100 ? 'good' : fid < 300 ? 'needs-improvement' : 'poor';
        onReport({ name: 'FID', value: fid, rating });
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // CLS - Cumulative Layout Shift (Good: <0.1, Needs improvement: 0.1-0.25, Poor: >0.25)
    let clsValue = 0;
    let clsEntries: any[] = [];
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          clsEntries.push(entry);
        }
      });
      const rating = clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor';
      onReport({ name: 'CLS', value: clsValue, rating });
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    // FCP - First Contentful Paint (Good: <1.8s, Needs improvement: 1.8-3s, Poor: >3s)
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        const fcp = entry.startTime;
        const rating = fcp < 1800 ? 'good' : fcp < 3000 ? 'needs-improvement' : 'poor';
        onReport({ name: 'FCP', value: fcp, rating });
      });
    });
    fcpObserver.observe({ entryTypes: ['paint'] });

    // TTFB - Time to First Byte (Good: <800ms, Needs improvement: 800-1800ms, Poor: >1800ms)
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationEntry) {
      const ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
      const rating = ttfb < 800 ? 'good' : ttfb < 1800 ? 'needs-improvement' : 'poor';
      onReport({ name: 'TTFB', value: ttfb, rating });
    }
  } catch (error) {
    console.warn('Web Vitals tracking failed:', error);
  }
}

// ============================================================================
// COMPONENT PERFORMANCE
// ============================================================================

/**
 * Measure component render time
 */
export function measureRenderTime(componentName: string, fn: () => void): number {
  const start = performance.now();
  fn();
  const end = performance.now();
  const duration = end - start;
  
  if (duration > 16) { // More than 1 frame at 60fps
    console.warn(`Slow render: ${componentName} took ${duration.toFixed(2)}ms`);
  }
  
  return duration;
}

/**
 * React Profiler compatible onRender callback
 */
export function profileComponentRender(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  // Log slow renders (>50ms is noticeable)
  if (actualDuration > 50) {
    console.warn(`Slow ${phase} of ${id}:`, {
      actualMs: actualDuration.toFixed(2),
      baseMs: baseDuration.toFixed(2),
    });
  }
  
  // Send to monitoring service
  if (window.analytics) {
    window.analytics.track('component_render', {
      component: id,
      phase,
      duration: actualDuration,
    });
  }
}

// ============================================================================
// BUNDLE OPTIMIZATION
// ============================================================================

/**
 * Performance budget thresholds (in bytes)
 */
export const PERFORMANCE_BUDGET = {
  // Total bundle size
  totalJS: 500 * 1024,     // 500 KB
  totalCSS: 100 * 1024,    // 100 KB
  
  // Individual chunks
  mainChunk: 200 * 1024,   // 200 KB
  vendorChunk: 300 * 1024, // 300 KB
  
  // Assets
  images: 1024 * 1024,     // 1 MB per image
  fonts: 100 * 1024,       // 100 KB per font
} as const;

/**
 * Check if resource exceeds budget
 */
export function checkResourceBudget(
  resourceType: keyof typeof PERFORMANCE_BUDGET,
  size: number
): { withinBudget: boolean; percentage: number } {
  const budget = PERFORMANCE_BUDGET[resourceType];
  const percentage = (size / budget) * 100;
  return {
    withinBudget: size <= budget,
    percentage,
  };
}

// ============================================================================
// LAZY LOADING
// ============================================================================

/**
 * Intersection Observer based lazy loading
 */
export function createLazyLoader(
  options: IntersectionObserverInit = {}
): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px', // Start loading 50px before element is visible
    threshold: 0.01,
    ...options,
  };

  return new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const element = entry.target as HTMLElement;
        
        // Load image
        if (element.tagName === 'IMG') {
          const img = element as HTMLImageElement;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            delete img.dataset.src;
          }
        }
        
        // Load component
        if (element.dataset.component) {
          const event = new CustomEvent('lazy-load', {
            detail: { component: element.dataset.component },
          });
          element.dispatchEvent(event);
        }
        
        observer.unobserve(element);
      }
    });
  }, defaultOptions);
}

/**
 * Preload critical resources
 */
export function preloadResource(href: string, as: 'script' | 'style' | 'font' | 'image') {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  
  if (as === 'font') {
    link.crossOrigin = 'anonymous';
  }
  
  document.head.appendChild(link);
}

/**
 * Prefetch resources for next navigation
 */
export function prefetchResource(href: string) {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

// ============================================================================
// MEMORY MANAGEMENT
// ============================================================================

/**
 * Monitor memory usage (Chrome only)
 */
export function getMemoryUsage(): {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  percentage: number;
} | null {
  if ('memory' in performance && (performance as any).memory) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
    };
  }
  return null;
}

/**
 * Warn if memory usage is high
 */
export function checkMemoryPressure(): void {
  const memory = getMemoryUsage();
  if (memory && memory.percentage > 90) {
    console.warn('High memory usage detected:', memory);
    
    // Suggest garbage collection (if available)
    if ('gc' in window && typeof (window as any).gc === 'function') {
      console.info('Triggering manual garbage collection');
      (window as any).gc();
    }
  }
}

// ============================================================================
// NETWORK PERFORMANCE
// ============================================================================

/**
 * Detect effective connection type
 */
export function getConnectionType(): {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
} | null {
  if ('connection' in navigator || 'mozConnection' in navigator || 'webkitConnection' in navigator) {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    return {
      effectiveType: conn.effectiveType || 'unknown',
      downlink: conn.downlink || 0,
      rtt: conn.rtt || 0,
      saveData: conn.saveData || false,
    };
  }
  return null;
}

/**
 * Determine if user is on slow connection
 */
export function isSlowConnection(): boolean {
  const conn = getConnectionType();
  if (!conn) return false;
  
  // Consider 2G or slow-2g as slow connections
  return conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g';
}

/**
 * Adapt quality based on connection
 */
export function getAdaptiveQuality(): 'high' | 'medium' | 'low' {
  const conn = getConnectionType();
  if (!conn) return 'high';
  
  switch (conn.effectiveType) {
    case '4g':
      return 'high';
    case '3g':
      return 'medium';
    case '2g':
    case 'slow-2g':
      return 'low';
    default:
      return 'medium';
  }
}

// Extend window interface for analytics
declare global {
  interface Window {
    analytics?: {
      track: (event: string, properties?: Record<string, any>) => void;
    };
  }
}
