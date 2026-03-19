export interface BreadcrumbItem {
  label: string;
  path: string;
  current?: boolean;
}

export interface SearchRouteItem {
  type: 'page' | 'action' | 'help';
  label: string;
  path: string;
  shortcut?: string;
}

export type FeatureIconKey =
  | 'layout'
  | 'database'
  | 'building2'
  | 'activity'
  | 'clock'
  | 'zap'
  | 'trendingUp'
  | 'pieChart'
  | 'barChart3'
  | 'cable'
  | 'grid3x3'
  | 'network'
  | 'columns'
  | 'mountain'
  | 'box'
  | 'workflow'
  | 'compass'
  | 'fileText'
  | 'mapPin'
  | 'home'
  | 'users'
  | 'code2'
  | 'shield'
  | 'bookOpen';

export interface AppFeatureItem {
  id: string;
  label: string;
  path: string;
  description?: string;
  iconKey: FeatureIconKey;
  badge?: string;
  category: string;
}

export interface AppFeatureCategory {
  id: string;
  label: string;
  description?: string;
  prominence?: 'primary' | 'secondary' | 'advanced';
  /** Minimum plan tier required to access this category's features */
  planRequired?: 'pro' | 'enterprise';
  features: AppFeatureItem[];
}

export type FeatureAudienceTier = 'free' | 'pro' | 'enterprise';
export type FeatureJourney = 'newbie' | 'professional' | 'advanced';

export interface FeatureCategoryQueryOptions {
  query?: string;
  prominence?: AppFeatureCategory['prominence'] | AppFeatureCategory['prominence'][];
  tier?: FeatureAudienceTier;
  includeLocked?: boolean;
  journey?: FeatureJourney;
  showAdvanced?: boolean;
}

export interface FeatureBundleCollections {
  primary: AppFeatureCategory[];
  secondary: AppFeatureCategory[];
  advanced: AppFeatureCategory[];
}

interface RoutePrefixTitle {
  prefix: string;
  title: string;
}

export const PUBLIC_PATHS: string[] = [
  '/',
  '/sign-in',
  '/sign-up',
  '/pricing',
  '/pricing-old',
  '/blog',
  '/forgot-password',
  '/reset-password',
  '/privacy-policy',
  '/privacy',
  '/terms-of-service',
  '/terms-and-conditions',
  '/terms',
  '/refund-cancellation',
  '/help',
  '/about',
  '/contact',
  '/capabilities',
  '/civil-engineering',
  '/account-locked',
  '/link-expired',
  '/auth/callback',
  '/verify-email',
  '/ui-showcase',
  '/error-report',
  '/rust-wasm-demo',
  '/nafems-benchmarks',
  '/worker-test',
  '/learning',
  '/sitemap',
];

export const FULL_SCREEN_PATHS: string[] = ['/app', '/demo', '/workspace/'];

export const APP_FEATURE_CATEGORIES: AppFeatureCategory[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    description: 'Project hub, modeler, and core entry points',
    prominence: 'primary',
    features: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/stream',
        description: 'Command center for projects, bundles, and recent work',
        iconKey: 'layout',
        category: 'workspace',
        badge: 'Start Here',
      },
      {
        id: 'modeler',
        label: '3D Modeler',
        path: '/app',
        description: 'Full-screen structural modeling workspace',
        iconKey: 'building2',
        category: 'workspace',
        badge: 'Core',
      },
      {
        id: 'projects',
        label: 'My Projects',
        path: '/stream',
        description: 'View and manage all projects',
        iconKey: 'database',
        category: 'workspace',
      },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    description: 'Structural analysis & simulation',
    prominence: 'primary',
    features: [
      { id: 'modal', label: 'Modal Analysis', path: '/analysis/modal', description: 'Dynamic modal analysis', iconKey: 'activity', category: 'analysis' },
      { id: 'time-history', label: 'Time History', path: '/analysis/time-history', description: 'Earthquake time-history analysis', iconKey: 'clock', category: 'analysis' },
      { id: 'seismic', label: 'Seismic Analysis', path: '/analysis/seismic', description: 'Seismic design analysis', iconKey: 'zap', category: 'analysis' },
      { id: 'buckling', label: 'Buckling', path: '/analysis/buckling', description: 'Elastic/inelastic buckling analysis', iconKey: 'trendingUp', category: 'analysis' },
      { id: 'pdelta', label: 'P-Delta', path: '/analysis/pdelta', description: 'Second-order geometric nonlinear analysis', iconKey: 'pieChart', category: 'analysis' },
      { id: 'nonlinear', label: 'Nonlinear Analysis', path: '/analysis/nonlinear', description: 'Material and geometric nonlinear workflows', iconKey: 'network', category: 'analysis' },
      { id: 'dynamic', label: 'Dynamic Analysis', path: '/analysis/dynamic', description: 'Dynamic load and response workflows', iconKey: 'activity', category: 'analysis' },
      { id: 'pushover', label: 'Pushover Analysis', path: '/analysis/pushover', description: 'Nonlinear static pushover', iconKey: 'barChart3', category: 'analysis' },
      { id: 'cable', label: 'Cable Analysis', path: '/analysis/cable', description: 'Cable structure analysis', iconKey: 'cable', category: 'analysis' },
      { id: 'plate-shell', label: 'Plate & Shell FEM', path: '/analysis/plate-shell', description: '2D plate/shell finite element analysis', iconKey: 'grid3x3', category: 'analysis', badge: 'New' },
      { id: 'optimization', label: 'Sensitivity & Optimization', path: '/analysis/sensitivity-optimization', description: 'Parameter optimization', iconKey: 'network', category: 'analysis' },
    ],
  },
  {
    id: 'design',
    label: 'Design',
    description: 'Structural member & connection design',
    prominence: 'primary',
    features: [
      { id: 'design-center', label: 'Design Center', path: '/design-center', description: 'Unified landing for all design workflows', iconKey: 'compass', category: 'design', badge: 'Start Here' },
      { id: 'concrete', label: 'RC Design', path: '/design/concrete', description: 'IS 456/ACI 318 reinforced concrete', iconKey: 'columns', category: 'design' },
      { id: 'steel', label: 'Steel Design', path: '/design/steel', description: 'AISC/IS 800 steel members', iconKey: 'box', category: 'design' },
      { id: 'foundation', label: 'Foundation Design', path: '/design/foundation', description: 'Footing & foundation design', iconKey: 'mountain', category: 'design' },
      { id: 'geotechnical', label: 'Geotechnical Design', path: '/design/geotechnical', description: 'Soil, slope, bearing, settlement, and liquefaction checks', iconKey: 'mountain', category: 'design', badge: 'New' },
      { id: 'composite', label: 'Composite Design', path: '/design/composite', description: 'Steel-concrete composite member design', iconKey: 'workflow', category: 'design', badge: 'New' },
      { id: 'timber', label: 'Timber Design', path: '/design/timber', description: 'Timber beam design and checks', iconKey: 'box', category: 'design', badge: 'New' },
      { id: 'connections', label: 'Connection Design', path: '/design/connections', description: 'Bolted & welded connections', iconKey: 'grid3x3', category: 'design' },
      { id: 'reinforcement', label: 'Reinforcement', path: '/design/reinforcement', description: 'Stirrups & development length', iconKey: 'workflow', category: 'design' },
      { id: 'detailing', label: 'RC Detailing', path: '/design/detailing', description: 'Detailed reinforcement drawings', iconKey: 'code2', category: 'design' },
      { id: 'design-hub', label: 'Post-Analysis Hub', path: '/design-hub', description: 'STAAD.Pro workflow', iconKey: 'workflow', category: 'design' },
    ],
  },
  {
    id: 'review',
    label: 'Reports & Review',
    description: 'Reports, visualization, exports, and deliverable review',
    prominence: 'primary',
    features: [
      { id: 'reports', label: 'Reports', path: '/reports', description: 'Report management and generated outputs', iconKey: 'fileText', category: 'review' },
      { id: 'report-builder', label: 'Report Builder', path: '/reports/builder', description: 'Custom report builder', iconKey: 'fileText', category: 'review' },
      { id: 'professional-reports', label: 'Professional Reports', path: '/reports/professional', description: 'Industry-standard engineering reports', iconKey: 'fileText', category: 'review', badge: 'Featured' },
      { id: 'print-export', label: 'Print & Export', path: '/tools/print-export', description: 'Generate and export deliverables', iconKey: 'fileText', category: 'review' },
      { id: 'visualization-hub', label: 'Visualization Hub', path: '/visualization', description: 'Visualization tools and presentation workflows', iconKey: 'building2', category: 'review' },
      { id: 'visualization', label: '3D Visualization', path: '/visualization/3d-engine', description: 'Advanced 3D rendering and review', iconKey: 'building2', category: 'review' },
      { id: 'animation', label: 'Result Animation', path: '/visualization/result-animation', description: 'Animation playback viewer', iconKey: 'activity', category: 'review' },
    ],
  },
  {
    id: 'tools',
    label: 'Libraries & Tools',
    description: 'Engineering databases, generators, and specialist utilities',
    prominence: 'secondary',
    features: [
      { id: 'load-combinations', label: 'Load Combinations', path: '/tools/load-combinations', description: 'IS 1893/ASCE 7 combinations', iconKey: 'barChart3', category: 'tools' },
      { id: 'section-database', label: 'Section Database', path: '/tools/section-database', description: 'ISMB/AISC/IPE properties', iconKey: 'database', category: 'tools' },
      { id: 'materials', label: 'Materials Database', path: '/materials/database', description: 'Material properties library', iconKey: 'database', category: 'tools' },
      { id: 'connection-database', label: 'Connection Database', path: '/connections/database', description: 'Reference connection details and design data', iconKey: 'grid3x3', category: 'tools' },
      { id: 'bar-bending', label: 'Bar Bending Schedule', path: '/tools/bar-bending', description: 'IS 2502 BBS generator', iconKey: 'fileText', category: 'tools', badge: 'New' },
      { id: 'meshing', label: 'Advanced Meshing', path: '/tools/advanced-meshing', description: 'Mesh generation and control', iconKey: 'grid3x3', category: 'tools' },
    ],
  },
  {
    id: 'ai',
    label: 'AI & Planning',
    description: 'AI copilots, planning, and generative workflows',
    prominence: 'primary',
    planRequired: 'pro',
    features: [
      { id: 'ai-dashboard', label: 'AI Dashboard', path: '/ai-dashboard', description: 'AI command center and insights', iconKey: 'zap', category: 'ai', badge: 'New' },
      { id: 'ai-power', label: 'AI Power Panel', path: '/ai-power', description: 'Advanced AI interface and generation tools', iconKey: 'zap', category: 'ai', badge: 'New' },
      { id: 'space-planning', label: 'Space Planning', path: '/space-planning', description: 'Facility and house layout planning', iconKey: 'mapPin', category: 'ai', badge: 'New' },
      { id: 'room-planner', label: 'Room Planner', path: '/room-planner', description: 'Interactive room layouts with validation', iconKey: 'home', category: 'ai', badge: 'New' },
    ],
  },
  {
    id: 'civil',
    label: 'Civil Suite',
    description: 'Specialized civil modules',
    prominence: 'secondary',
    features: [
      { id: 'civil-library', label: 'Civil Library', path: '/civil-engineering/library', description: 'Civil engineering suite entry point', iconKey: 'bookOpen', category: 'civil', badge: 'Suite' },
      { id: 'civil-book', label: 'Civil Book Interface', path: '/civil-engineering/book', description: 'Book-style civil engineering experience', iconKey: 'bookOpen', category: 'civil' },
      { id: 'civil-book-realistic', label: 'Civil Book (Realistic)', path: '/civil-engineering/book/realistic', description: 'Realistic civil engineering book mode', iconKey: 'bookOpen', category: 'civil' },
      { id: 'hydraulics', label: 'Hydraulics Designer', path: '/civil/hydraulics', description: 'Hydraulic system design', iconKey: 'activity', category: 'civil' },
      { id: 'transportation', label: 'Transportation Designer', path: '/civil/transportation', description: 'Road & highway design', iconKey: 'database', category: 'civil' },
      { id: 'construction', label: 'Construction Manager', path: '/civil/construction', description: 'Construction planning', iconKey: 'building2', category: 'civil' },
      { id: 'quantity-survey', label: 'Quantity Survey', path: '/quantity', description: 'Material quantity takeoff', iconKey: 'barChart3', category: 'civil' },
    ],
  },
  {
    id: 'account',
    label: 'Account & Workspace',
    description: 'Profile, alerts, and workspace preferences',
    prominence: 'secondary',
    features: [
      { id: 'settings', label: 'Settings', path: '/settings', description: 'Workspace and account settings', iconKey: 'users', category: 'account' },
      { id: 'notifications', label: 'Notifications', path: '/notifications', description: 'Review platform and project notifications', iconKey: 'activity', category: 'account' },
      { id: 'profile', label: 'Profile', path: '/profile', description: 'Manage your profile and identity details', iconKey: 'users', category: 'account' },
    ],
  },
  {
    id: 'enterprise',
    label: 'Enterprise & Integrations',
    description: 'Team collaboration, integrations, and operational tooling',
    prominence: 'advanced',
    planRequired: 'enterprise',
    features: [
      { id: 'collaboration', label: 'Collaboration Hub', path: '/collaboration', description: 'Team workspace and project collaboration', iconKey: 'users', category: 'enterprise' },
      { id: 'bim', label: 'BIM Integration', path: '/bim', description: 'BIM import and export workflows', iconKey: 'building2', category: 'enterprise' },
      { id: 'bim-export-enhanced', label: 'Enhanced BIM Export', path: '/bim/export-enhanced', description: 'Advanced BIM export options', iconKey: 'building2', category: 'enterprise' },
      { id: 'cad', label: 'CAD Integration', path: '/cad/integration', description: 'CAD file integration and exchange', iconKey: 'code2', category: 'enterprise' },
      { id: 'api', label: 'API Integration', path: '/integrations/api-dashboard', description: 'API connections and webhooks', iconKey: 'network', category: 'enterprise' },
      { id: 'compliance', label: 'Code Compliance', path: '/compliance/checker', description: 'Design code validation and checking', iconKey: 'shield', category: 'enterprise' },
      { id: 'cloud-storage', label: 'Cloud Storage', path: '/cloud-storage', description: 'Project storage and cloud workspace assets', iconKey: 'database', category: 'enterprise' },
      { id: 'digital-twin', label: 'Digital Twin', path: '/digital-twin', description: 'Operational twin and live asset monitoring', iconKey: 'network', category: 'enterprise' },
      { id: 'performance-monitor', label: 'Performance Monitor', path: '/performance/monitor', description: 'Runtime and platform performance monitoring', iconKey: 'activity', category: 'enterprise' },
    ],
  },
  {
    id: 'learning',
    label: 'Learn & Support',
    description: 'Documentation and tutorials',
    prominence: 'secondary',
    features: [
      { id: 'learning-center', label: 'Learning Center', path: '/learning', description: 'Tutorials and courses', iconKey: 'bookOpen', category: 'learning' },
      { id: 'blog', label: 'Engineering Blog', path: '/blog', description: 'Product updates and engineering insights', iconKey: 'fileText', category: 'learning' },
      { id: 'help', label: 'Help Center', path: '/help', description: 'FAQs and support', iconKey: 'bookOpen', category: 'learning' },
      { id: 'sitemap', label: 'Site Map', path: '/sitemap', description: 'Browse all major product areas', iconKey: 'compass', category: 'learning' },
    ],
  },
];

const APP_SEARCH_ACTION_ITEMS: SearchRouteItem[] = [
  { type: 'action', label: 'Open Dashboard', path: '/stream', shortcut: '⌘⇧D' },
  { type: 'action', label: 'Open 3D Workspace', path: '/app', shortcut: '⌘⇧W' },
  { type: 'action', label: 'Create New Project', path: '/stream', shortcut: '⌘N' },
];

const APP_FEATURE_SEARCH_ITEMS: SearchRouteItem[] = (() => {
  const seen = new Set<string>();

  return APP_FEATURE_CATEGORIES.flatMap((category) =>
    category.features
      .map((feature): SearchRouteItem => {
        const type: SearchRouteItem['type'] = category.id === 'learning' ? 'help' : 'page';
        return {
          type,
          label: feature.label,
          path: feature.path,
        };
      })
      .filter((item) => {
        const key = `${item.type}|${item.path}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
  );
})();

export const APP_SEARCH_ITEMS: SearchRouteItem[] = [
  ...APP_FEATURE_SEARCH_ITEMS,
  ...APP_SEARCH_ACTION_ITEMS,
];

export const APP_FEATURE_ITEMS: AppFeatureItem[] = APP_FEATURE_CATEGORIES.flatMap(
  (category) => category.features,
);

const PROMINENCE_ORDER: Record<NonNullable<AppFeatureCategory['prominence']>, number> = {
  primary: 0,
  secondary: 1,
  advanced: 2,
};

const TIER_ORDER: Record<FeatureAudienceTier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

const FEATURE_BY_PATH: Record<string, AppFeatureItem> = APP_FEATURE_ITEMS.reduce<
  Record<string, AppFeatureItem>
>((acc, feature) => {
  if (!acc[feature.path]) {
    acc[feature.path] = feature;
  }
  return acc;
}, {});

function normalizePathname(pathname: string): string {
  const [withoutQuery] = pathname.split('?');
  const [withoutHash] = withoutQuery.split('#');
  const trimmed = withoutHash.trim();

  if (!trimmed || trimmed === '/') return '/';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function findFeatureByPath(pathname: string): AppFeatureItem | undefined {
  const normalized = normalizePathname(pathname);
  return FEATURE_BY_PATH[normalized];
}

export function getFeatureCategoryById(
  categoryId: string,
): AppFeatureCategory | undefined {
  return APP_FEATURE_CATEGORIES.find((category) => category.id === categoryId);
}

export function isCategoryAccessibleForTier(
  category: AppFeatureCategory,
  tier: FeatureAudienceTier = 'free',
): boolean {
  if (!category.planRequired) return true;
  return TIER_ORDER[tier] >= TIER_ORDER[category.planRequired];
}

export function isCategoryAccessibleForJourney(
  category: AppFeatureCategory,
  journey: FeatureJourney = 'professional',
  showAdvanced = false,
): boolean {
  const prominence = category.prominence ?? 'secondary';

  if (journey === 'advanced') return true;
  if (journey === 'professional') {
    return prominence !== 'advanced' || showAdvanced;
  }

  if (prominence === 'primary') return true;
  return showAdvanced;
}

export function getFeatureCategories(
  queryOrOptions?: string | FeatureCategoryQueryOptions,
): AppFeatureCategory[] {
  const options: FeatureCategoryQueryOptions =
    typeof queryOrOptions === 'string' ? { query: queryOrOptions } : queryOrOptions ?? {};

  const normalized = options.query?.trim().toLowerCase();
  const prominenceFilter = options.prominence
    ? Array.isArray(options.prominence)
      ? options.prominence
      : [options.prominence]
    : null;
  const tier = options.tier ?? 'free';
  const includeLocked = options.includeLocked ?? true;
  const journey = options.journey;
  const showAdvanced = options.showAdvanced ?? false;

  return APP_FEATURE_CATEGORIES
    .filter((category) => {
      if (prominenceFilter && !prominenceFilter.includes(category.prominence)) {
        return false;
      }

      if (journey && !isCategoryAccessibleForJourney(category, journey, showAdvanced)) {
        return false;
      }

      if (!includeLocked && !isCategoryAccessibleForTier(category, tier)) {
        return false;
      }

      return true;
    })
    .map((category) => ({
      ...category,
      features: normalized
        ? category.features.filter((feature) => {
            return (
              feature.label.toLowerCase().includes(normalized) ||
              feature.description?.toLowerCase().includes(normalized) ||
              feature.id.toLowerCase().includes(normalized) ||
              feature.path.toLowerCase().includes(normalized) ||
              category.label.toLowerCase().includes(normalized)
            );
          })
        : category.features,
    }))
    .filter((category) => category.features.length > 0)
    .sort((a, b) => {
      const accessibilityDelta =
        Number(isCategoryAccessibleForTier(b, tier)) - Number(isCategoryAccessibleForTier(a, tier));
      if (accessibilityDelta !== 0) return accessibilityDelta;

      const prominenceDelta =
        PROMINENCE_ORDER[a.prominence ?? 'secondary'] -
        PROMINENCE_ORDER[b.prominence ?? 'secondary'];
      if (prominenceDelta !== 0) return prominenceDelta;

      return a.label.localeCompare(b.label);
    });
}

export function getBundleCollections(
  options?: Omit<FeatureCategoryQueryOptions, 'prominence'>,
): FeatureBundleCollections {
  return {
    primary: getFeatureCategories({ ...options, prominence: 'primary' }),
    secondary: getFeatureCategories({ ...options, prominence: 'secondary' }),
    advanced: getFeatureCategories({ ...options, prominence: 'advanced' }),
  };
}

export function getFeatureContextByPath(pathname: string): {
  feature?: AppFeatureItem;
  category?: AppFeatureCategory;
  accessible: boolean;
} {
  const feature = findFeatureByPath(pathname);
  const category = feature ? getFeatureCategoryById(feature.category) : undefined;

  return {
    feature,
    category,
    accessible: category ? isCategoryAccessibleForTier(category, 'free') : true,
  };
}

export function getSearchItems(query?: string): SearchRouteItem[] {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return APP_SEARCH_ITEMS;

  return APP_SEARCH_ITEMS.filter((item) => {
    return (
      item.label.toLowerCase().includes(normalized) ||
      item.path.toLowerCase().includes(normalized)
    );
  });
}

const FEATURE_ROUTE_TITLES: Record<string, string> = APP_FEATURE_CATEGORIES
  .flatMap((category) => category.features)
  .reduce<Record<string, string>>((acc, feature) => {
    if (!acc[feature.path]) {
      acc[feature.path] = feature.label;
    }
    return acc;
  }, {});

const CATEGORY_BREADCRUMB_LABEL_OVERRIDES: Record<string, string> = {
  tools: 'Tools',
  enterprise: 'Enterprise',
  review: 'Reports',
  ai: 'AI',
  civil: 'Civil',
  account: 'Account',
};

const CATEGORY_BREADCRUMB_PATH_OVERRIDES: Record<string, string> = {
  design: '/design-center',
};

const CATEGORY_BREADCRUMB_META: Record<string, { label: string; path: string }> =
  APP_FEATURE_CATEGORIES.reduce<Record<string, { label: string; path: string }>>(
    (acc, category) => {
      if (category.id === 'workspace' || category.id === 'learning') {
        return acc;
      }

      const firstPath = category.features[0]?.path;
      if (!firstPath) return acc;

      acc[category.id] = {
        label: CATEGORY_BREADCRUMB_LABEL_OVERRIDES[category.id] ?? category.label,
        path: CATEGORY_BREADCRUMB_PATH_OVERRIDES[category.id] ?? firstPath,
      };

      return acc;
    },
    {},
  );

const FEATURE_ROUTE_BREADCRUMBS: Record<string, BreadcrumbItem[]> = APP_FEATURE_CATEGORIES
  .flatMap((category) =>
    category.features.map((feature) => {
      if (feature.path === '/stream') {
        return {
          path: feature.path,
          breadcrumbs: [{ label: 'Dashboard', path: '/stream', current: true }],
        };
      }

      const categoryMeta = CATEGORY_BREADCRUMB_META[category.id];
      if (!categoryMeta) {
        return {
          path: feature.path,
          breadcrumbs: [
            { label: 'Dashboard', path: '/stream' },
            { label: feature.label, path: feature.path, current: true },
          ],
        };
      }

      return {
        path: feature.path,
        breadcrumbs: [
          { label: 'Dashboard', path: '/stream' },
          { label: categoryMeta.label, path: categoryMeta.path },
          { label: feature.label, path: feature.path, current: true },
        ],
      };
    }),
  )
  .reduce<Record<string, BreadcrumbItem[]>>((acc, entry) => {
    if (!acc[entry.path]) {
      acc[entry.path] = entry.breadcrumbs;
    }
    return acc;
  }, {});

const EXACT_ROUTE_TITLE_OVERRIDES: Record<string, string> = {
  '/': 'Home',
  '/analysis/time-history': 'Time History Analysis',
  '/analysis/pdelta': 'P-Delta Analysis',
  '/analysis/nonlinear': 'Nonlinear Analysis',
  '/analysis/dynamic': 'Dynamic Analysis',
  '/analysis/sensitivity-optimization': 'Optimization',
  '/connections/database': 'Connection Database',
  '/cloud-storage': 'Cloud Storage',
  '/digital-twin': 'Digital Twin',
  '/performance/monitor': 'Performance Monitor',
  '/space-planning': 'Space Planning',
  '/room-planner': 'Room Planner',
  '/visualization/3d-engine': '3D Engine',
  '/settings-enhanced': 'Enhanced Settings',
  '/settings/advanced': 'Advanced Settings',
  '/civil/hydraulics': 'Hydraulics',
  '/civil/transportation': 'Transportation',
  '/civil/construction': 'Construction',
  '/design-center': 'Design Center',
  '/design-hub': 'Post-Analysis Design Hub',
  '/design/welded-connections': 'Connection Design',
  '/account-locked': 'Account Locked',
  '/link-expired': 'Link Expired',
  '/verify-email': 'Verify Email',
  '/error-report': 'Error Report',

  // Non-feature static/auth/marketing routes
  '/help': 'Help & Tutorials',
  '/pricing': 'Pricing',
  '/about': 'About',
  '/contact': 'Contact',
  '/sitemap': 'Site Map',
  '/sign-in': 'Sign In',
  '/sign-up': 'Sign Up',
};

const EXACT_ROUTE_TITLES: Record<string, string> = {
  ...FEATURE_ROUTE_TITLES,
  ...EXACT_ROUTE_TITLE_OVERRIDES,
};

const PREFIX_ROUTE_TITLES: RoutePrefixTitle[] = [
  { prefix: '/sign-in/', title: 'Sign In' },
  { prefix: '/sign-up/', title: 'Sign Up' },
  { prefix: '/workspace/', title: 'Workspace' },
  { prefix: '/auth/callback/', title: 'Authentication' },
  { prefix: '/design/', title: 'Design' },
  { prefix: '/analysis/', title: 'Analysis' },
  { prefix: '/tools/', title: 'Tools' },
  { prefix: '/reports/', title: 'Reports' },
  { prefix: '/civil/', title: 'Civil Engineering' },
  { prefix: '/visualization/', title: 'Visualization' },
];

const ROUTE_BREADCRUMB_OVERRIDES: Record<string, BreadcrumbItem[]> = {
  '/app': [
    { label: 'Dashboard', path: '/stream' },
    { label: '3D Modeler', path: '/app', current: true },
  ],

  '/settings': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Settings', path: '/settings', current: true },
  ],
  '/design-center': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Design', path: '/design-center', current: true },
  ],
  '/design-hub': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Design', path: '/design-center' },
    { label: 'Post-Analysis Hub', path: '/design-hub', current: true },
  ],
  '/account-locked': [
    { label: 'Home', path: '/' },
    { label: 'Sign In', path: '/sign-in' },
    { label: 'Account Locked', path: '/account-locked', current: true },
  ],
  '/link-expired': [
    { label: 'Home', path: '/' },
    { label: 'Verify Email', path: '/verify-email' },
    { label: 'Link Expired', path: '/link-expired', current: true },
  ],
  '/verify-email': [
    { label: 'Home', path: '/' },
    { label: 'Verify Email', path: '/verify-email', current: true },
  ],
  '/error-report': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Diagnostics', path: '/error-report', current: true },
  ],
};

export const ROUTE_BREADCRUMBS: Record<string, BreadcrumbItem[]> = {
  ...FEATURE_ROUTE_BREADCRUMBS,
  ...ROUTE_BREADCRUMB_OVERRIDES,
};

export function isPublicRoute(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return PUBLIC_PATHS.some((p) => normalized === p || normalized.startsWith(`${p}/`));
}

export function isFullScreenRoute(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return (
    normalized === '/app' ||
    normalized === '/demo' ||
    normalized.startsWith('/workspace/')
  );
}

export function getRouteTitle(pathname: string): string {
  const normalized = normalizePathname(pathname);

  const exactTitle = EXACT_ROUTE_TITLES[normalized];
  if (exactTitle) return exactTitle;

  const feature = findFeatureByPath(normalized);
  if (feature) return feature.label;

  const prefixTitle = PREFIX_ROUTE_TITLES.find((entry) =>
    normalized.startsWith(entry.prefix),
  );
  if (prefixTitle) return prefixTitle.title;

  return 'BeamLab';
}

export function getBreadcrumbsForPath(pathname: string): BreadcrumbItem[] {
  const normalized = normalizePathname(pathname);

  const configured = ROUTE_BREADCRUMBS[normalized];
  if (configured) return configured;

  const feature = findFeatureByPath(normalized);
  if (feature) {
    const category = getFeatureCategoryById(feature.category);
    const categoryMeta =
      category?.id !== undefined ? CATEGORY_BREADCRUMB_META[category.id] : undefined;

    if (!categoryMeta) {
      return [
        { label: 'Dashboard', path: '/stream' },
        { label: feature.label, path: feature.path, current: true },
      ];
    }

    return [
      { label: 'Dashboard', path: '/stream' },
      { label: categoryMeta.label, path: categoryMeta.path },
      { label: feature.label, path: feature.path, current: true },
    ];
  }

  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) {
    return [{ label: 'Home', path: '/', current: true }];
  }

  return parts.map((part, index) => ({
    label: part
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase()),
    path: '/' + parts.slice(0, index + 1).join('/'),
    current: index === parts.length - 1,
  }));
}
