/**
 * Code Splitting and Dynamic Import Utilities
 * Industry-standard lazy loading patterns
 * 
 * Features:
 * - Named lazy imports with preloading
 * - Route-based code splitting
 * - Component prefetching
 * - Error boundaries for lazy components
 * - Loading skeletons
 */

import React, { Suspense, lazy, ComponentType, LazyExoticComponent } from 'react';

// ============================================================================
// Types
// ============================================================================

interface LazyComponentOptions {
  /** Fallback component to show while loading */
  fallback?: React.ReactNode;
  /** Minimum delay before showing component (prevents flash) */
  minDelay?: number;
  /** Error fallback when component fails to load */
  errorFallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

interface PreloadableComponent<T extends ComponentType<unknown>> {
  Component: LazyExoticComponent<T>;
  preload: () => Promise<{ default: T }>;
}

type ModuleFactory<T> = () => Promise<{ default: T }>;

// ============================================================================
// Delayed Import
// ============================================================================

/**
 * Creates a lazy component with optional minimum delay
 * Prevents loading flash for fast connections
 */
function delayedImport<T extends ComponentType<unknown>>(
  factory: ModuleFactory<T>,
  minDelay = 0
): Promise<{ default: T }> {
  return Promise.all([
    factory(),
    minDelay > 0 ? new Promise((resolve) => setTimeout(resolve, minDelay)) : Promise.resolve(),
  ]).then(([module]) => module);
}

// ============================================================================
// Lazy with Preload
// ============================================================================

/**
 * Creates a lazy component with preload capability
 * 
 * @example
 * const { Component: Dashboard, preload } = lazyWithPreload(
 *   () => import('./pages/Dashboard')
 * );
 * 
 * // Preload on hover
 * <button onMouseEnter={preload}>Go to Dashboard</button>
 */
export function lazyWithPreload<T extends ComponentType<unknown>>(
  factory: ModuleFactory<T>
): PreloadableComponent<T> {
  let modulePromise: Promise<{ default: T }> | null = null;

  const preload = (): Promise<{ default: T }> => {
    if (!modulePromise) {
      modulePromise = factory();
    }
    return modulePromise;
  };

  const Component = lazy(() => preload());

  return { Component, preload };
}

// ============================================================================
// Lazy with Error Boundary
// ============================================================================

interface LazyLoadState {
  hasError: boolean;
  error: Error | null;
}

class LazyErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ComponentType<{ error: Error; retry: () => void }> },
  LazyLoadState
> {
  constructor(props: { children: React.ReactNode; fallback: React.ComponentType<{ error: Error; retry: () => void }> }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): LazyLoadState {
    return { hasError: true, error };
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      const Fallback = this.props.fallback;
      return <Fallback error={this.state.error} retry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

// ============================================================================
// Create Lazy Component
// ============================================================================

/**
 * Creates a fully configured lazy component
 * 
 * @example
 * const LazyDashboard = createLazyComponent(
 *   () => import('./pages/Dashboard'),
 *   {
 *     fallback: <DashboardSkeleton />,
 *     errorFallback: LoadError,
 *     minDelay: 300,
 *   }
 * );
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLazyComponent<T extends ComponentType<any>>(
  factory: ModuleFactory<T>,
  options: LazyComponentOptions = {}
): React.FC<React.ComponentProps<T>> {
  const {
    fallback = <DefaultLoadingFallback />,
    minDelay = 0,
    errorFallback = DefaultErrorFallback,
  } = options;

  const LazyComponent = lazy(() => delayedImport(factory, minDelay));

  const WrappedComponent = (props: React.ComponentProps<T>) => (
    <LazyErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    </LazyErrorBoundary>
  );

  WrappedComponent.displayName = 'LazyComponent';

  return WrappedComponent;
}

// ============================================================================
// Route-based Code Splitting
// ============================================================================

interface RouteConfig {
  path: string;
  factory: ModuleFactory<ComponentType<unknown>>;
  preloadOn?: 'hover' | 'visible' | 'idle';
}

/**
 * Create route components with automatic code splitting
 */
export function createRoutes(configs: RouteConfig[]) {
  return configs.map((config) => {
    const { Component, preload } = lazyWithPreload(config.factory);
    
    return {
      path: config.path,
      Component,
      preload,
      preloadOn: config.preloadOn ?? 'hover',
    };
  });
}

// ============================================================================
// Prefetch on Idle
// ============================================================================

/**
 * Prefetch components during browser idle time
 */
export function prefetchOnIdle(preloadFns: Array<() => Promise<unknown>>): void {
  if ('requestIdleCallback' in window) {
    preloadFns.forEach((preload) => {
      window.requestIdleCallback(() => {
        preload().catch(() => {
          // Silently fail - this is just prefetching
        });
      });
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      preloadFns.forEach((preload) => {
        preload().catch(() => {});
      });
    }, 2000);
  }
}

// ============================================================================
// Prefetch on Visible
// ============================================================================

/**
 * Hook to prefetch component when element becomes visible
 */
export function usePrefetchOnVisible(
  ref: React.RefObject<Element>,
  preload: () => Promise<unknown>
): void {
  React.useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          preload().catch(() => {});
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, preload]);
}

// ============================================================================
// Default Fallback Components
// ============================================================================

function DefaultLoadingFallback(): JSX.Element {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

function DefaultErrorFallback({ error, retry }: { error: Error; retry: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-6 text-center">
      <svg
        className="w-12 h-12 text-red-500 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Failed to load component
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {error.message}
      </p>
      <button
        onClick={retry}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

// ============================================================================
// Loading Skeletons
// ============================================================================

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: number | string;
  height?: number | string;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps): JSX.Element {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

interface PageSkeletonProps {
  className?: string;
}

export function PageSkeleton({ className = '' }: PageSkeletonProps): JSX.Element {
  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton width={200} height={32} />
        <Skeleton width={120} height={36} variant="rectangular" />
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <Skeleton width="60%" height={20} className="mb-4" />
            <Skeleton width="100%" height={80} className="mb-3" />
            <Skeleton width="40%" height={16} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <Skeleton width={150} height={24} />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700"
          >
            <Skeleton width={40} height={40} variant="circular" className="mr-4" />
            <div className="flex-1 space-y-2">
              <Skeleton width="30%" height={16} />
              <Skeleton width="50%" height={12} />
            </div>
            <Skeleton width={80} height={28} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton(): JSX.Element {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <Skeleton width="40%" height={20} className="mb-4" />
      <div className="space-y-3">
        <Skeleton width="100%" height={16} />
        <Skeleton width="80%" height={16} />
        <Skeleton width="60%" height={16} />
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
        <Skeleton width={100} height={32} />
      </div>
    </div>
  );
}

export function TableRowSkeleton(): JSX.Element {
  return (
    <tr>
      <td className="px-4 py-3">
        <Skeleton width={40} height={40} variant="circular" />
      </td>
      <td className="px-4 py-3">
        <Skeleton width="80%" height={16} />
      </td>
      <td className="px-4 py-3">
        <Skeleton width="60%" height={16} />
      </td>
      <td className="px-4 py-3">
        <Skeleton width={80} height={24} />
      </td>
    </tr>
  );
}

// ============================================================================
// Export Utilities
// ============================================================================

export { DefaultLoadingFallback, DefaultErrorFallback };
