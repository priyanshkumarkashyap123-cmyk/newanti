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
  isCategoryAccessibleForJourney,
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

  it('supports journey-based category accessibility rules', () => {
    const primaryCategory = APP_FEATURE_CATEGORIES.find((category) => category.prominence === 'primary');
    const secondaryCategory = APP_FEATURE_CATEGORIES.find((category) => category.prominence === 'secondary');
    const advancedCategory = APP_FEATURE_CATEGORIES.find((category) => category.prominence === 'advanced');

    expect(primaryCategory).toBeDefined();
    expect(secondaryCategory).toBeDefined();
    expect(advancedCategory).toBeDefined();

    expect(isCategoryAccessibleForJourney(primaryCategory!, 'newbie', false)).toBe(true);
    expect(isCategoryAccessibleForJourney(secondaryCategory!, 'newbie', false)).toBe(false);
    expect(isCategoryAccessibleForJourney(advancedCategory!, 'newbie', false)).toBe(false);

    expect(isCategoryAccessibleForJourney(secondaryCategory!, 'professional', false)).toBe(true);
    expect(isCategoryAccessibleForJourney(advancedCategory!, 'professional', false)).toBe(false);
    expect(isCategoryAccessibleForJourney(advancedCategory!, 'professional', true)).toBe(true);

    expect(isCategoryAccessibleForJourney(advancedCategory!, 'advanced', false)).toBe(true);
  });

  it('filters bundle collections by journey and showAdvanced toggle', () => {
    const newbieGuided = getBundleCollections({
      tier: 'free',
      includeLocked: true,
      journey: 'newbie',
      showAdvanced: false,
    });
    expect(newbieGuided.secondary).toHaveLength(0);
    expect(newbieGuided.advanced).toHaveLength(0);
    expect(newbieGuided.primary.length).toBeGreaterThan(0);

    const newbieAdvancedOn = getBundleCollections({
      tier: 'free',
      includeLocked: true,
      journey: 'newbie',
      showAdvanced: true,
    });
    expect(newbieAdvancedOn.secondary.length).toBeGreaterThan(0);
    expect(newbieAdvancedOn.advanced.length).toBeGreaterThan(0);

    const professionalGuided = getBundleCollections({
      tier: 'free',
      includeLocked: true,
      journey: 'professional',
      showAdvanced: false,
    });
    expect(professionalGuided.secondary.length).toBeGreaterThan(0);
    expect(professionalGuided.advanced).toHaveLength(0);

    const professionalAdvancedOn = getBundleCollections({
      tier: 'free',
      includeLocked: true,
      journey: 'professional',
      showAdvanced: true,
    });
    expect(professionalAdvancedOn.advanced.length).toBeGreaterThan(0);

    const advancedJourney = getBundleCollections({
      tier: 'free',
      includeLocked: true,
      journey: 'advanced',
      showAdvanced: false,
    });
    expect(advancedJourney.secondary.length).toBeGreaterThan(0);
    expect(advancedJourney.advanced.length).toBeGreaterThan(0);
  });
});
