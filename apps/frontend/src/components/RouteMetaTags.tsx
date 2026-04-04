/**
 * RouteMetaTags — auto-injects per-route <title>, description, and OG meta
 * using route feature definitions from appRouteMeta.ts.
 * Renders inside <HelmetProvider> (already mounted in main.tsx).
 */
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import {
  findFeatureByPath,
  getRouteTitle,
} from '../config/appRouteMeta';

const SITE_NAME = 'BeamLab';
const OG_IMAGE = 'https://beamlabultimate.tech/og-image.png';

/** Descriptions for key routes that aren't in APP_FEATURE_CATEGORIES */
const STATIC_DESCRIPTIONS: Record<string, string> = {
  '/': 'BeamLab — professional structural engineering platform for RC, steel, foundation, and seismic design per IS 456, IS 800, ACI 318, AISC 360, and Eurocode.',
  '/sign-in': 'Sign in to BeamLab to access your structural engineering projects.',
  '/sign-up': 'Create a BeamLab account and start designing structures in minutes.',
  '/stream': 'Your BeamLab dashboard — manage projects, run analyses, and review recent work.',
  '/pricing': 'Flexible plans for individual engineers and enterprise teams.',
  '/blog': 'Structural engineering insights, code updates, and BeamLab tutorials.',
  '/design-center': 'Unified design hub for RC, steel, composite, timber, and foundation design workflows.',
  '/design-hub': 'Post-analysis design hub — member sizing, optimisation, and code checks.',
  '/app': '3D structural modeler — build frames, apply loads, and run FEM analysis in the browser.',
  '/settings': 'Manage your BeamLab account, preferences, and integrations.',
  '/help': 'Help centre — guides, FAQs, and support for BeamLab users.',
  '/about': 'Learn about BeamLab and the team building the future of structural engineering software.',
};

export function RouteMetaTags() {
  const { pathname } = useLocation();

  const feature = findFeatureByPath(pathname);
  const title = feature ? feature.label : getRouteTitle(pathname);
  const description =
    (feature?.description) ??
    STATIC_DESCRIPTIONS[pathname] ??
    'BeamLab — professional structural analysis and design platform.';

  const fullTitle = title === SITE_NAME ? SITE_NAME : `${title} | ${SITE_NAME}`;

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: 'https://beamlabultimate.tech',
    logo: 'https://beamlabultimate.tech/logo.png',
    sameAs: ['https://beamlabultimate.tech'],
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: 'https://beamlabultimate.tech',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://beamlabultimate.tech/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={OG_IMAGE} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />
      <script type="application/ld+json">
        {JSON.stringify(organizationJsonLd)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(websiteJsonLd)}
      </script>
    </Helmet>
  );
}
