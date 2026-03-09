import { describe, expect, it } from 'vitest';
import {
  findFeatureByPath,
  getBreadcrumbsForPath,
  getRouteTitle,
  getSearchItems,
  isFullScreenRoute,
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
});
