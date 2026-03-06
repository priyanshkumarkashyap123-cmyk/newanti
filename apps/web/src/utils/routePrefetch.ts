/**
 * Route Prefetch Utility
 * Prefetches lazy-loaded route chunks on hover/focus for instant navigation.
 * Uses a cache to avoid duplicate imports and requestIdleCallback for non-blocking loading.
 */

const prefetchedRoutes = new Set<string>();

// Maps route paths to their dynamic import functions
const routeImportMap: Record<string, () => Promise<unknown>> = {
  // Design modules
  '/design/steel': () => import('../pages/SteelDesignPage'),
  '/design/connections': () => import('../pages/ConnectionDesignPage'),
  '/design/welded-connections': () => import('../pages/ConnectionDesignPage'),
  '/design/reinforcement': () => import('../pages/DetailingDesignPage'),
  '/design/detailing': () => import('../pages/DetailingDesignPage'),
  '/design/concrete': () => import('../pages/ConcreteDesignPage'),
  '/design/foundation': () => import('../pages/FoundationDesignPage'),
  '/design-center': () => import('../pages/StructuralDesignCenter'),

  // Analysis modules
  '/analysis/pushover': () => import('../pages/PushoverAnalysisPage'),
  '/analysis/time-history': () => import('../pages/TimeHistoryAnalysisPage'),
  '/analysis/modal': () => import('../pages/ModalAnalysisPage'),
  '/analysis/plate-shell': () => import('../pages/PlateShellAnalysisPage'),

  // Tools
  '/tools/load-combinations': () => import('../pages/LoadCombinationPage'),
  '/tools/section-database': () => import('../pages/SectionDatabasePage'),
  '/tools/bar-bending': () => import('../pages/BarBendingSchedulePage'),

  // Other pages
  '/reports': () => import('../pages/ReportsPage'),
  '/settings': () => import('../pages/SettingsPageEnhanced'),
  '/pricing': () => import('../pages/EnhancedPricingPage'),
};

/**
 * Prefetch a route's chunk on idle. No-ops if already prefetched.
 * Uses requestIdleCallback to avoid blocking user interactions.
 */
export function prefetchRoute(path: string): void {
  if (prefetchedRoutes.has(path)) return;

  const importFn = routeImportMap[path];
  if (!importFn) return;

  prefetchedRoutes.add(path);

  const doFetch = () => {
    importFn().catch(() => {
      // Remove from cache so retry is possible on next hover
      prefetchedRoutes.delete(path);
    });
  };

  if ('requestIdleCallback' in window) {
    (window as Window).requestIdleCallback(doFetch, { timeout: 2000 });
  } else {
    setTimeout(doFetch, 100);
  }
}

/**
 * Returns an onMouseEnter handler that prefetches the route chunk.
 * Use on navigation buttons/links:
 *   <button onMouseEnter={createPrefetchHandler('/design/steel')} onClick={...}>
 */
export function createPrefetchHandler(path: string): () => void {
  return () => prefetchRoute(path);
}

/**
 * Prefetch multiple routes at once (e.g., when a category is expanded).
 */
export function prefetchRoutes(paths: string[]): void {
  paths.forEach(prefetchRoute);
}

/**
 * Prefetch all design routes when the Design category is hovered.
 */
export function prefetchDesignRoutes(): void {
  prefetchRoutes([
    '/design/steel',
    '/design/connections',
    '/design/detailing',
    '/design/concrete',
    '/design/foundation',
  ]);
}
