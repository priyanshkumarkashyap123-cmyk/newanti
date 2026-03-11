/**
 * ============================================================================
 * NAVIGATION CONFIGURATION
 * ============================================================================
 * 
 * Centralized navigation configuration for the structural design application.
 * Defines all routes, menu items, breadcrumbs, and navigation helpers.
 * 
 * @version 1.0.0
 */

import {
  Calculator,
  Box,
  Columns,
  Layers,
  Building2,
  Grid3X3,
  Activity,
  Wind,
  Mountain,
  Cable,
  Anchor,
  Ruler,
  FileText,
  Settings,
  Home,
  BarChart3,
  Shield,
  Zap,
  type LucideIcon,
} from 'lucide-react';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface NavRoute {
  id: string;
  path: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  description?: string;
  category?: string;
  keywords?: string[];
  component?: string;
  requiresAuth?: boolean;
  badge?: string;
  isNew?: boolean;
  isBeta?: boolean;
}

export interface NavCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  gradient: string;
  description?: string;
  routes: NavRoute[];
}

// =============================================================================
// ROUTE DEFINITIONS
// =============================================================================

export const ROUTES: Record<string, NavRoute> = {
  // Home & Dashboard
  HOME: {
    id: 'home',
    path: '/',
    label: 'Home',
    icon: Home,
    description: 'Main dashboard',
    requiresAuth: true,
  },
  DASHBOARD: {
    id: 'dashboard',
    path: '/stream',
    label: 'Dashboard',
    icon: BarChart3,
    description: 'Project overview and analytics',
    requiresAuth: true,
  },
  DESIGN_CENTER: {
    id: 'design-center',
    path: '/design-center',
    label: 'Design Center',
    icon: Calculator,
    description: 'Unified structural design interface',
    requiresAuth: true,
    isNew: true,
  },
  
  // RC Design
  RC_BEAM: {
    id: 'rc-beam',
    path: '/design/concrete',
    label: 'RC Beam Design',
    shortLabel: 'Beam',
    icon: Box,
    description: 'Design reinforced concrete beams',
    category: 'rc-design',
    keywords: ['beam', 'flexure', 'shear', 'concrete', 'reinforcement'],
    requiresAuth: true,
  },
  RC_COLUMN: {
    id: 'rc-column',
    path: '/design/concrete',
    label: 'RC Column Design',
    shortLabel: 'Column',
    icon: Columns,
    description: 'Design reinforced concrete columns with P-M interaction',
    category: 'rc-design',
    keywords: ['column', 'axial', 'moment', 'interaction', 'biaxial'],
    requiresAuth: true,
  },
  RC_SLAB: {
    id: 'rc-slab',
    path: '/design/concrete',
    label: 'RC Slab Design',
    shortLabel: 'Slab',
    icon: Layers,
    description: 'Design one-way and two-way slabs',
    category: 'rc-design',
    keywords: ['slab', 'flat slab', 'ribbed', 'waffle', 'deflection'],
    requiresAuth: true,
  },
  RC_FOOTING: {
    id: 'rc-footing',
    path: '/design/foundation',
    label: 'RC Footing Design',
    shortLabel: 'Footing',
    icon: Mountain,
    description: 'Design isolated and combined footings',
    category: 'rc-design',
    keywords: ['footing', 'foundation', 'bearing', 'punching'],
    requiresAuth: true,
    isNew: true,
  },
  RC_PRESTRESSED: {
    id: 'rc-prestressed',
    path: '/design-center?module=rc-prestressed',
    label: 'Prestressed Concrete',
    shortLabel: 'Prestressed',
    icon: Zap,
    description: 'Design prestressed concrete members',
    category: 'rc-design',
    keywords: ['prestress', 'tendon', 'post-tension', 'pre-tension'],
    requiresAuth: true,
  },
  RC_RETAINING_WALL: {
    id: 'rc-retaining-wall',
    path: '/design-center?module=rc-retaining-wall',
    label: 'Retaining Wall',
    shortLabel: 'Retaining',
    icon: Shield,
    description: 'Design cantilever and gravity retaining walls',
    category: 'rc-design',
    keywords: ['retaining', 'wall', 'earth pressure', 'stability'],
    requiresAuth: true,
    isBeta: true,
  },
  RC_STAIRCASE: {
    id: 'rc-staircase',
    path: '/design-center?module=rc-staircase',
    label: 'Staircase Design',
    shortLabel: 'Staircase',
    icon: Activity,
    description: 'Design doglegged and other staircases',
    category: 'rc-design',
    keywords: ['staircase', 'steps', 'landing', 'waist slab'],
    requiresAuth: true,
    isBeta: true,
  },
  
  // Steel Design
  STEEL_MEMBER: {
    id: 'steel-member',
    path: '/design/steel',
    label: 'Steel Member Design',
    shortLabel: 'Member',
    icon: Ruler,
    description: 'Design steel beams and columns',
    category: 'steel-design',
    keywords: ['steel', 'beam', 'column', 'section', 'buckling'],
    requiresAuth: true,
    isNew: true,
  },
  STEEL_CONNECTION: {
    id: 'steel-connection',
    path: '/design/connections',
    label: 'Steel Connections',
    shortLabel: 'Connection',
    icon: Grid3X3,
    description: 'Design bolted and welded connections',
    category: 'steel-design',
    keywords: ['connection', 'bolt', 'weld', 'joint', 'moment'],
    requiresAuth: true,
    isBeta: true,
  },
  STEEL_BASE_PLATE: {
    id: 'steel-base-plate',
    path: '/design/connections',
    label: 'Base Plate Design',
    shortLabel: 'Base Plate',
    icon: Anchor,
    description: 'Design column base plates',
    category: 'steel-design',
    keywords: ['base plate', 'anchor', 'grout', 'column base'],
    requiresAuth: true,
    isBeta: true,
  },
  
  // Bridge Design
  BRIDGE_DECK: {
    id: 'bridge-deck',
    path: '/design-center?module=bridge-deck',
    label: 'Bridge Deck',
    shortLabel: 'Deck',
    icon: Building2,
    description: 'Design bridge deck systems',
    category: 'bridge-design',
    keywords: ['bridge', 'deck', 'slab', 'girder', 'composite'],
    requiresAuth: true,
    isBeta: true,
  },
  BRIDGE_PIER: {
    id: 'bridge-pier',
    path: '/design-center?module=bridge-pier',
    label: 'Bridge Pier',
    shortLabel: 'Pier',
    icon: Columns,
    description: 'Design bridge piers and substructure',
    category: 'bridge-design',
    keywords: ['pier', 'column', 'cap beam', 'bearing'],
    requiresAuth: true,
    isBeta: true,
  },
  
  // Foundation
  FOUNDATION: {
    id: 'foundation',
    path: '/design/foundation',
    label: 'Foundation Design',
    shortLabel: 'Foundation',
    icon: Mountain,
    description: 'Design various foundation types',
    category: 'foundation-design',
    keywords: ['foundation', 'pile', 'raft', 'caisson'],
    requiresAuth: true,
  },
  
  // Cable & Suspension
  CABLE_DESIGN: {
    id: 'cable-design',
    path: '/design-center?module=cable-design',
    label: 'Cable Design',
    shortLabel: 'Cable',
    icon: Cable,
    description: 'Design cable and suspension structures',
    category: 'cable-design',
    keywords: ['cable', 'suspension', 'catenary', 'tension'],
    requiresAuth: true,
    isBeta: true,
  },
  
  // Analysis
  ANALYSIS: {
    id: 'analysis',
    path: '/design-center?module=analysis',
    label: 'Structural Analysis',
    shortLabel: 'Analysis',
    icon: Activity,
    description: 'Structural analysis tools',
    category: 'analysis',
    keywords: ['analysis', 'FEM', 'stiffness', 'load combination'],
    requiresAuth: true,
  },
  
  // Settings & Config
  SETTINGS: {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    description: 'Application settings',
    requiresAuth: true,
  },
};

// =============================================================================
// NAVIGATION CATEGORIES
// =============================================================================

export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: 'rc-design',
    label: 'RC Design',
    icon: Box,
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-500',
    description: 'Reinforced concrete design modules',
    routes: [
      ROUTES.RC_BEAM,
      ROUTES.RC_COLUMN,
      ROUTES.RC_SLAB,
      ROUTES.RC_FOOTING,
      ROUTES.RC_PRESTRESSED,
      ROUTES.RC_RETAINING_WALL,
      ROUTES.RC_STAIRCASE,
    ],
  },
  {
    id: 'steel-design',
    label: 'Steel Design',
    icon: Ruler,
    color: 'indigo',
    gradient: 'from-indigo-500 to-purple-500',
    description: 'Structural steel design modules',
    routes: [
      ROUTES.STEEL_MEMBER,
      ROUTES.STEEL_CONNECTION,
      ROUTES.STEEL_BASE_PLATE,
    ],
  },
  {
    id: 'bridge-design',
    label: 'Bridge Design',
    icon: Building2,
    color: 'amber',
    gradient: 'from-amber-500 to-orange-500',
    description: 'Bridge engineering modules',
    routes: [
      ROUTES.BRIDGE_DECK,
      ROUTES.BRIDGE_PIER,
    ],
  },
  {
    id: 'foundation-design',
    label: 'Foundation',
    icon: Mountain,
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-500',
    description: 'Foundation design modules',
    routes: [
      ROUTES.FOUNDATION,
      ROUTES.RC_FOOTING,
    ],
  },
  {
    id: 'cable-design',
    label: 'Cable & Suspension',
    icon: Cable,
    color: 'rose',
    gradient: 'from-rose-500 to-pink-500',
    description: 'Cable structure design',
    routes: [
      ROUTES.CABLE_DESIGN,
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: Activity,
    color: 'violet',
    gradient: 'from-violet-500 to-purple-500',
    description: 'Structural analysis tools',
    routes: [
      ROUTES.ANALYSIS,
    ],
  },
];

// =============================================================================
// NAVIGATION HELPERS
// =============================================================================

/**
 * Get route by ID
 */
export function getRouteById(id: string): NavRoute | undefined {
  return Object.values(ROUTES).find(route => route.id === id);
}

/**
 * Get category by ID
 */
export function getCategoryById(id: string): NavCategory | undefined {
  return NAV_CATEGORIES.find(cat => cat.id === id);
}

/**
 * Get breadcrumbs for a route
 */
export function getBreadcrumbs(routeId: string): NavRoute[] {
  const route = getRouteById(routeId);
  if (!route) return [ROUTES.HOME];
  
  const breadcrumbs: NavRoute[] = [ROUTES.HOME];
  
  if (route.category) {
    // Add Design Center as intermediate
    breadcrumbs.push(ROUTES.DESIGN_CENTER);
  }
  
  if (route.id !== 'home') {
    breadcrumbs.push(route);
  }
  
  return breadcrumbs;
}

/**
 * Search routes by keyword
 */
export function searchRoutes(query: string): NavRoute[] {
  const lowerQuery = query.toLowerCase();
  
  return Object.values(ROUTES).filter(route => {
    if (route.label.toLowerCase().includes(lowerQuery)) return true;
    if (route.description?.toLowerCase().includes(lowerQuery)) return true;
    if (route.keywords?.some(k => k.toLowerCase().includes(lowerQuery))) return true;
    return false;
  });
}

/**
 * Get all routes in a category
 */
export function getRoutesByCategory(categoryId: string): NavRoute[] {
  return Object.values(ROUTES).filter(route => route.category === categoryId);
}

/**
 * Get quick access routes (frequently used)
 */
export function getQuickAccessRoutes(): NavRoute[] {
  return [
    ROUTES.RC_BEAM,
    ROUTES.RC_COLUMN,
    ROUTES.RC_SLAB,
    ROUTES.RC_FOOTING,
    ROUTES.STEEL_MEMBER,
    ROUTES.ANALYSIS,
  ];
}

/**
 * Get new features routes
 */
export function getNewFeatureRoutes(): NavRoute[] {
  return Object.values(ROUTES).filter(route => route.isNew);
}

/**
 * Get beta feature routes
 */
export function getBetaFeatureRoutes(): NavRoute[] {
  return Object.values(ROUTES).filter(route => route.isBeta);
}

export default ROUTES;
