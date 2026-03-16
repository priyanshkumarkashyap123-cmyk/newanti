import { describe, expect, it } from 'vitest';
import {
  APP_FEATURE_CATEGORIES,
  findFeatureByPath,
  getBundleCollections,
  getBreadcrumbsForPath,
  getFeatureCategories,
  getRouteTitle,
  getSearchItems,
  isFullScreenRoute,
  isCategoryAccessibleForTier,
  isPublicRoute,
} from '../appRouteMeta';

describe('appRouteMeta helpers', () => {
  it('normalizes path for public route checks', () => {
    expect(isPublicRoute('/help')).toBe(true);
    expect(isPublicRoute('/help/')).toBe(true);
    expect(isPublicRoute('/help?x=1')).toBe(true);
    expect(isPublicRoute('/not-a-public-route')).toBe(false);
  });

  it('normalizes path for fullscreen route checks', () => {
    expect(isFullScreenRoute('/app')).toBe(true);
    expect(isFullScreenRoute('/app/')).toBe(true);
    expect(isFullScreenRoute('/workspace/structural')).toBe(true);
    expect(isFullScreenRoute('/stream')).toBe(false);
  });

  it('returns feature title even with trailing slash/query/hash', () => {
    expect(getRouteTitle('/design/steel')).toBe('Steel Design');
    expect(getRouteTitle('/design/steel/')).toBe('Steel Design');
    expect(getRouteTitle('/design/steel?tab=checks')).toBe('Steel Design');
    expect(getRouteTitle('/design/steel#section')).toBe('Steel Design');
  });

  it('finds features by normalized paths', () => {
    const feature = findFeatureByPath('/analysis/modal/?v=1');
    expect(feature?.id).toBe('modal');
    expect(feature?.label).toBe('Modal Analysis');
  });

  it('returns metadata breadcrumb for feature routes', () => {
    const crumbs = getBreadcrumbsForPath('/analysis/modal?foo=bar');
    expect(crumbs[0]?.label).toBe('Dashboard');
    expect(crumbs[1]?.label).toBe('Analysis');
    expect(crumbs[2]?.label).toBe('Modal Analysis');
    expect(crumbs[2]?.current).toBe(true);
  });

  it('filters search items by label or path', () => {
    const byLabel = getSearchItems('steel');
    const byPath = getSearchItems('/analysis/modal');

    expect(byLabel.some((item) => item.path === '/design/steel')).toBe(true);
    expect(byPath.some((item) => item.path === '/analysis/modal')).toBe(true);
  });

  it('returns explicit titles for newly hardened routes', () => {
    expect(getRouteTitle('/design-center')).toBe('Design Center');
    expect(getRouteTitle('/design-hub')).toBe('Post-Analysis Design Hub');
    expect(getRouteTitle('/error-report')).toBe('Error Report');
    expect(getRouteTitle('/account-locked')).toBe('Account Locked');
  });

  it('returns breadcrumb overrides for post-analysis and diagnostics flows', () => {
    const designHubCrumbs = getBreadcrumbsForPath('/design-hub');
    const errorReportCrumbs = getBreadcrumbsForPath('/error-report');

    expect(designHubCrumbs.map((crumb) => crumb.label)).toEqual([
      'Dashboard',
      'Design',
      'Post-Analysis Hub',
    ]);
    expect(designHubCrumbs[2]?.current).toBe(true);

    expect(errorReportCrumbs.map((crumb) => crumb.label)).toEqual([
      'Dashboard',
      'Diagnostics',
    ]);
    expect(errorReportCrumbs[1]?.path).toBe('/error-report');
    expect(errorReportCrumbs[1]?.current).toBe(true);
  });

  it('keeps geotechnical design route discoverable in titles, breadcrumbs, and search', () => {
    expect(getRouteTitle('/design/geotechnical')).toBe('Geotechnical Design');

    const crumbs = getBreadcrumbsForPath('/design/geotechnical');
    expect(crumbs.map((crumb) => crumb.label)).toEqual([
      'Dashboard',
      'Design',
      'Geotechnical Design',
    ]);
    expect(crumbs[2]?.current).toBe(true);

    const searchResults = getSearchItems('geotech');
    expect(searchResults.some((item) => item.path === '/design/geotechnical')).toBe(true);
  });

  it('keeps feature ids and paths unique across categories', () => {
    const ids = APP_FEATURE_CATEGORIES.flatMap((category) =>
      category.features.map((feature) => feature.id),
    );
    const paths = APP_FEATURE_CATEGORIES.flatMap((category) =>
      category.features.map((feature) => feature.path),
    );
    const duplicatePaths = paths.filter((path, index) => paths.indexOf(path) !== index);

    expect(new Set(ids).size).toBe(ids.length);
    expect([...new Set(duplicatePaths)]).toEqual(['/stream']);
  });

  it('supports plan-aware category filtering for intelligent bundling', () => {
    const freePrimary = getFeatureCategories({
      prominence: 'primary',
      tier: 'free',
      includeLocked: false,
    });

    expect(freePrimary.some((category) => category.id === 'ai')).toBe(false);
    expect(freePrimary.every((category) => isCategoryAccessibleForTier(category, 'free'))).toBe(true);

    const proPrimary = getFeatureCategories({
      prominence: 'primary',
      tier: 'pro',
      includeLocked: false,
    });
    expect(proPrimary.some((category) => category.id === 'ai')).toBe(true);
  });

  it('returns prominence-based bundle collections', () => {
    const bundles = getBundleCollections({ tier: 'free', includeLocked: true });

    expect(bundles.primary.every((category) => category.prominence === 'primary')).toBe(true);
    expect(bundles.secondary.every((category) => category.prominence === 'secondary')).toBe(true);
    expect(bundles.advanced.every((category) => category.prominence === 'advanced')).toBe(true);
    expect(bundles.primary.some((category) => category.id === 'workspace')).toBe(true);
    expect(bundles.advanced.some((category) => category.id === 'enterprise')).toBe(true);
  });
});
