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
  features: AppFeatureItem[];
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
    description: 'Core modeling and analysis tools',
    features: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/stream',
        description: 'Project management & overview',
        iconKey: 'layout',
        category: 'workspace',
      },
      {
        id: 'modeler',
        label: '3D Modeler',
        path: '/app',
        description: 'Interactive structural modeling',
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
    features: [
      { id: 'modal', label: 'Modal Analysis', path: '/analysis/modal', description: 'Dynamic modal analysis', iconKey: 'activity', category: 'analysis' },
      { id: 'time-history', label: 'Time History', path: '/analysis/time-history', description: 'Earthquake time-history analysis', iconKey: 'clock', category: 'analysis' },
      { id: 'seismic', label: 'Seismic Analysis', path: '/analysis/seismic', description: 'Seismic design analysis', iconKey: 'zap', category: 'analysis' },
      { id: 'buckling', label: 'Buckling', path: '/analysis/buckling', description: 'Elastic/inelastic buckling analysis', iconKey: 'trendingUp', category: 'analysis' },
      { id: 'pdelta', label: 'P-Delta & Nonlinear', path: '/analysis/pdelta', description: 'Second-order & nonlinear analysis', iconKey: 'pieChart', category: 'analysis' },
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
    features: [
      { id: 'concrete', label: 'RC Design', path: '/design/concrete', description: 'IS 456/ACI 318 reinforced concrete', iconKey: 'columns', category: 'design' },
      { id: 'foundation', label: 'Foundation Design', path: '/design/foundation', description: 'Footing & foundation design', iconKey: 'mountain', category: 'design' },
      { id: 'steel', label: 'Steel Design', path: '/design/steel', description: 'AISC/IS 800 steel members', iconKey: 'box', category: 'design' },
      { id: 'connections', label: 'Connection Design', path: '/design/connections', description: 'Bolted & welded connections', iconKey: 'grid3x3', category: 'design' },
      { id: 'reinforcement', label: 'Reinforcement', path: '/design/reinforcement', description: 'Stirrups & development length', iconKey: 'workflow', category: 'design' },
      { id: 'detailing', label: 'RC Detailing', path: '/design/detailing', description: 'Detailed reinforcement drawings', iconKey: 'code2', category: 'design' },
      { id: 'design-center', label: 'Design Center', path: '/design-center', description: 'Unified design interface', iconKey: 'compass', category: 'design' },
      { id: 'design-hub', label: 'Post-Analysis Hub', path: '/design-hub', description: 'STAAD.Pro workflow', iconKey: 'workflow', category: 'design' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools & Utilities',
    description: 'Engineering calculators and databases',
    features: [
      { id: 'load-combinations', label: 'Load Combinations', path: '/tools/load-combinations', description: 'IS 1893/ASCE 7 combinations', iconKey: 'barChart3', category: 'tools' },
      { id: 'section-database', label: 'Section Database', path: '/tools/section-database', description: 'ISMB/AISC/IPE properties', iconKey: 'database', category: 'tools' },
      { id: 'bar-bending', label: 'Bar Bending Schedule', path: '/tools/bar-bending', description: 'IS 2502 BBS generator', iconKey: 'fileText', category: 'tools', badge: 'New' },
      { id: 'meshing', label: 'Advanced Meshing', path: '/tools/advanced-meshing', description: 'Mesh generation & control', iconKey: 'grid3x3', category: 'tools' },
      { id: 'print-export', label: 'Print & Export', path: '/tools/print-export', description: 'Generate & export reports', iconKey: 'fileText', category: 'tools' },
      { id: 'space-planning', label: 'Space Planning', path: '/space-planning', description: 'House & facility layout', iconKey: 'mapPin', category: 'tools', badge: 'New' },
      { id: 'room-planner', label: 'Room Planner', path: '/room-planner', description: 'Interactive room layout with furniture validation', iconKey: 'home', category: 'tools', badge: 'New' },
    ],
  },
  {
    id: 'enterprise',
    label: 'Enterprise Features',
    description: 'Team collaboration & integration',
    features: [
      { id: 'collaboration', label: 'Collaboration Hub', path: '/collaboration', description: 'Team workspace & projects', iconKey: 'users', category: 'enterprise' },
      { id: 'bim', label: 'BIM Integration', path: '/bim', description: 'BIM import/export', iconKey: 'building2', category: 'enterprise' },
      { id: 'cad', label: 'CAD Integration', path: '/cad/integration', description: 'CAD file integration', iconKey: 'code2', category: 'enterprise' },
      { id: 'api', label: 'API Integration', path: '/integrations/api-dashboard', description: 'API connections & webhooks', iconKey: 'network', category: 'enterprise' },
      { id: 'materials', label: 'Materials Database', path: '/materials/database', description: 'Material properties library', iconKey: 'database', category: 'enterprise' },
      { id: 'compliance', label: 'Code Compliance', path: '/compliance/checker', description: 'Design code validation', iconKey: 'shield', category: 'enterprise' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports & Documentation',
    description: 'Report generation and export',
    features: [
      { id: 'reports', label: 'Reports', path: '/reports', description: 'Report management', iconKey: 'fileText', category: 'reports' },
      { id: 'report-builder', label: 'Report Builder', path: '/reports/builder', description: 'Custom report builder', iconKey: 'fileText', category: 'reports' },
      { id: 'professional-reports', label: 'Professional Reports', path: '/reports/professional', description: 'Industry-standard reports', iconKey: 'fileText', category: 'reports' },
      { id: 'visualization', label: '3D Visualization', path: '/visualization/3d-engine', description: 'Advanced 3D rendering', iconKey: 'building2', category: 'reports' },
      { id: 'animation', label: 'Result Animation', path: '/visualization/result-animation', description: 'Animation playback viewer', iconKey: 'activity', category: 'reports' },
    ],
  },
  {
    id: 'civil',
    label: 'Civil Engineering',
    description: 'Specialized civil modules',
    features: [
      { id: 'hydraulics', label: 'Hydraulics Designer', path: '/civil/hydraulics', description: 'Hydraulic system design', iconKey: 'activity', category: 'civil' },
      { id: 'transportation', label: 'Transportation Designer', path: '/civil/transportation', description: 'Road & highway design', iconKey: 'database', category: 'civil' },
      { id: 'construction', label: 'Construction Manager', path: '/civil/construction', description: 'Construction planning', iconKey: 'building2', category: 'civil' },
      { id: 'quantity-survey', label: 'Quantity Survey', path: '/quantity', description: 'Material quantity takeoff', iconKey: 'barChart3', category: 'civil' },
    ],
  },
  {
    id: 'ai',
    label: 'AI Features',
    description: 'Artificial intelligence tools',
    features: [
      { id: 'ai-dashboard', label: 'AI Dashboard', path: '/ai-dashboard', description: 'C-suite AI analytics', iconKey: 'zap', category: 'ai', badge: 'New' },
      { id: 'ai-power', label: 'AI Power Panel', path: '/ai-power', description: 'Next-gen AI interface', iconKey: 'zap', category: 'ai', badge: 'New' },
    ],
  },
  {
    id: 'learning',
    label: 'Learning & Support',
    description: 'Documentation and tutorials',
    features: [
      { id: 'learning-center', label: 'Learning Center', path: '/learning', description: 'Tutorials and courses', iconKey: 'bookOpen', category: 'learning' },
      { id: 'help', label: 'Help Center', path: '/help', description: 'FAQs and support', iconKey: 'bookOpen', category: 'learning' },
    ],
  },
];

const APP_SEARCH_ACTION_ITEMS: SearchRouteItem[] = [
  { type: 'action', label: 'Open Workspace', path: '/app', shortcut: '⌘⇧W' },
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

export function getFeatureCategories(query?: string): AppFeatureCategory[] {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return APP_FEATURE_CATEGORIES;

  return APP_FEATURE_CATEGORIES.map((category) => ({
    ...category,
    features: category.features.filter((feature) => {
      return (
        feature.label.toLowerCase().includes(normalized) ||
        feature.description?.toLowerCase().includes(normalized) ||
        feature.id.toLowerCase().includes(normalized) ||
        feature.path.toLowerCase().includes(normalized)
      );
    }),
  })).filter((category) => category.features.length > 0);
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
  reports: 'Reports',
  ai: 'AI',
};

const CATEGORY_BREADCRUMB_PATH_OVERRIDES: Record<string, string> = {
  design: '/design-hub',
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
  '/visualization/3d-engine': '3D Engine',
  '/settings-enhanced': 'Enhanced Settings',
  '/settings/advanced': 'Advanced Settings',
  '/civil/hydraulics': 'Hydraulics',
  '/civil/transportation': 'Transportation',
  '/civil/construction': 'Construction',

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
    { label: '3D Workspace', path: '/app', current: true },
  ],

  '/settings': [
    { label: 'Dashboard', path: '/stream' },
    { label: 'Settings', path: '/settings', current: true },
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
