import { describe, expect, it } from 'vitest';
import {
  APP_FEATURE_ITEMS,
  findFeatureByPath,
  getRouteTitle,
  isPublicRoute,
} from '../appRouteMeta';
import appRoutesSource from '../../App.tsx?raw';
import analysisRoutesSource from '../../app/routes/AnalysisRoutes.tsx?raw';
import designRoutesSource from '../../app/routes/DesignRoutes.tsx?raw';
import featureRoutesSource from '../../app/routes/FeatureRoutes.tsx?raw';
import infoRoutesSource from '../../app/routes/InfoRoutes.tsx?raw';
import routeAliasesSource from '../../app/routes/routeAliases.ts?raw';

const ROUTE_FILE_SOURCES = {
  app: appRoutesSource,
  analysis: analysisRoutesSource,
  design: designRoutesSource,
  feature: featureRoutesSource,
  info: infoRoutesSource,
  aliases: routeAliasesSource,
};

const PRIVATE_INFRA_ROUTES = new Set(['/app', '/demo', '/settings-enhanced', '/settings/advanced']);
const CORE_PUBLIC_TITLE_ROUTES = new Set([
  '/',
  '/pricing',
  '/help',
  '/about',
  '/contact',
  '/sign-in',
  '/sign-up',
  '/sitemap',
]);

const ROUTE_PATH_REGEX = /path\s*=\s*['"`]([^'"`]+)['"`]/g;
const ALIAS_FROM_REGEX = /from:\s*['"`]([^'"`]+)['"`]/g;

function extractMatches(source: string, regex: RegExp): string[] {
  const paths: string[] = [];

  for (const match of source.matchAll(regex)) {
    const value = match[1];
    if (value && value.startsWith('/')) {
      paths.push(value);
    }
  }

  return paths;
}

function getStaticRoutePathsFromSource(source: string): string[] {
  return extractMatches(source, ROUTE_PATH_REGEX).filter((routePath) => {
    return routePath !== '*' && !routePath.includes(':');
  });
}

function getAliasFromPaths(source: string): string[] {
  return extractMatches(source, ALIAS_FROM_REGEX);
}

function getDeclaredStaticRoutes(): Set<string> {
  const appRoutes = getStaticRoutePathsFromSource(ROUTE_FILE_SOURCES.app);
  const analysisRoutes = getStaticRoutePathsFromSource(ROUTE_FILE_SOURCES.analysis);
  const designRoutes = getStaticRoutePathsFromSource(ROUTE_FILE_SOURCES.design);
  const featureRoutes = getStaticRoutePathsFromSource(ROUTE_FILE_SOURCES.feature);
  const infoRoutes = getStaticRoutePathsFromSource(ROUTE_FILE_SOURCES.info);
  const aliasFromRoutes = getAliasFromPaths(ROUTE_FILE_SOURCES.aliases);

  return new Set([
    ...appRoutes,
    ...analysisRoutes,
    ...designRoutes,
    ...featureRoutes,
    ...infoRoutes,
    ...aliasFromRoutes,
  ]);
}

describe('route parity guard', () => {
  it('keeps all metadata feature paths backed by declared routes', () => {
    const declaredRoutes = getDeclaredStaticRoutes();
    const featurePaths = [...new Set(APP_FEATURE_ITEMS.map((feature) => feature.path))];

    const missingFromRouter = featurePaths.filter((featurePath) => !declaredRoutes.has(featurePath));
    expect(missingFromRouter).toEqual([]);
  });

  it('keeps all declared routes covered by metadata/public/alias policy', () => {
    const declaredRoutes = getDeclaredStaticRoutes();
    const featurePaths = new Set(APP_FEATURE_ITEMS.map((feature) => feature.path));
    const aliasFromRoutes = new Set(getAliasFromPaths(ROUTE_FILE_SOURCES.aliases));

    const uncoveredRoutes = [...declaredRoutes].filter((routePath) => {
      const coveredByFeature = featurePaths.has(routePath) && Boolean(findFeatureByPath(routePath));
      const coveredByPublic = isPublicRoute(routePath);
      const coveredByAlias = aliasFromRoutes.has(routePath);
      const coveredByInfra = PRIVATE_INFRA_ROUTES.has(routePath);

      return !coveredByFeature && !coveredByPublic && !coveredByAlias && !coveredByInfra;
    });

    expect(uncoveredRoutes).toEqual([]);
  });

  it('keeps route titles available for all non-infra declared static routes', () => {
    const declaredRoutes = getDeclaredStaticRoutes();
    const featurePaths = new Set(APP_FEATURE_ITEMS.map((feature) => feature.path));

    const untitledRoutes = [...declaredRoutes].filter((routePath) => {
      if (PRIVATE_INFRA_ROUTES.has(routePath)) {
        return false;
      }

      const mustHaveExplicitTitle =
        featurePaths.has(routePath) || CORE_PUBLIC_TITLE_ROUTES.has(routePath);

      if (!mustHaveExplicitTitle) {
        return false;
      }

      return getRouteTitle(routePath) === 'BeamLab';
    });

    expect(untitledRoutes).toEqual([]);
  });
});