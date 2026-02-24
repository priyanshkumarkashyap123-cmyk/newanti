/**
 * ============================================================================
 * CIVIL ENGINEERING MODULE - NAVIGATION CONFIGURATION
 * ============================================================================
 * 
 * Navigation routes and menu structure for civil engineering modules
 * 
 * @version 1.0.0
 */

import { CIVIL_ENGINE_MODULES } from './index';

// =============================================================================
// ROUTE DEFINITIONS
// =============================================================================

export const CIVIL_ENGINE_ROUTES = {
  root: '/civil-engineering',
  
  // Structural Analysis
  structural: {
    root: '/civil-engineering/structural',
    frameAnalysis: '/civil-engineering/structural/frame-analysis',
    trussAnalysis: '/civil-engineering/structural/truss-analysis',
    beamAnalysis: '/civil-engineering/structural/beam-analysis',
    columnDesign: '/civil-engineering/structural/column-design',
    influenceLines: '/civil-engineering/structural/influence-lines',
  },
  
  // Geotechnical Engineering
  geotechnical: {
    root: '/civil-engineering/geotechnical',
    bearingCapacity: '/civil-engineering/geotechnical/bearing-capacity',
    settlement: '/civil-engineering/geotechnical/settlement',
    slopeStability: '/civil-engineering/geotechnical/slope-stability',
    earthPressure: '/civil-engineering/geotechnical/earth-pressure',
    pileFoundation: '/civil-engineering/geotechnical/pile-foundation',
    retainingWall: '/civil-engineering/geotechnical/retaining-wall',
  },
  
  // Hydraulics & Hydrology
  hydraulics: {
    root: '/civil-engineering/hydraulics',
    channelFlow: '/civil-engineering/hydraulics/channel-flow',
    pipeFlow: '/civil-engineering/hydraulics/pipe-flow',
    hydrology: '/civil-engineering/hydraulics/hydrology',
    hydraulicStructures: '/civil-engineering/hydraulics/structures',
    floodRouting: '/civil-engineering/hydraulics/flood-routing',
    waterDistribution: '/civil-engineering/hydraulics/water-distribution',
  },
  
  // Transportation Engineering
  transportation: {
    root: '/civil-engineering/transportation',
    geometricDesign: '/civil-engineering/transportation/geometric-design',
    pavementDesign: '/civil-engineering/transportation/pavement-design',
    trafficAnalysis: '/civil-engineering/transportation/traffic-analysis',
    signalDesign: '/civil-engineering/transportation/signal-design',
    railway: '/civil-engineering/transportation/railway',
    airport: '/civil-engineering/transportation/airport',
  },
  
  // Surveying & Geodesy
  surveying: {
    root: '/civil-engineering/surveying',
    traverse: '/civil-engineering/surveying/traverse',
    leveling: '/civil-engineering/surveying/leveling',
    curveSetting: '/civil-engineering/surveying/curve-setting',
    earthwork: '/civil-engineering/surveying/earthwork',
    coordinates: '/civil-engineering/surveying/coordinates',
    gps: '/civil-engineering/surveying/gps',
  },
};

// =============================================================================
// NAVIGATION MENU STRUCTURE
// =============================================================================

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  description?: string;
  badge?: string;
  children?: NavItem[];
}

export const CIVIL_ENGINE_NAV: NavItem[] = [
  {
    id: 'civil-engineering',
    label: 'Civil Engineering',
    icon: '🏗️',
    path: CIVIL_ENGINE_ROUTES.root,
    description: 'Comprehensive civil engineering design center',
    children: [
      {
        id: 'structural',
        label: 'Structural Analysis',
        icon: '🏛️',
        path: CIVIL_ENGINE_ROUTES.structural.root,
        description: 'Frame, truss, and beam analysis',
        children: [
          {
            id: 'frame-analysis',
            label: '2D Frame Analysis',
            icon: '🏗️',
            path: CIVIL_ENGINE_ROUTES.structural.frameAnalysis,
            description: 'Direct stiffness method for 2D frames',
          },
          {
            id: 'truss-analysis',
            label: 'Truss Analysis',
            icon: '📐',
            path: CIVIL_ENGINE_ROUTES.structural.trussAnalysis,
            description: 'Method of joints and sections',
          },
          {
            id: 'beam-analysis',
            label: 'Continuous Beam',
            icon: '━━━',
            path: CIVIL_ENGINE_ROUTES.structural.beamAnalysis,
            description: 'Three-moment equation analysis',
          },
          {
            id: 'column-design',
            label: 'Column Design',
            icon: '▮',
            path: CIVIL_ENGINE_ROUTES.structural.columnDesign,
            description: 'RC and steel column design',
          },
          {
            id: 'influence-lines',
            label: 'Influence Lines',
            icon: '〰️',
            path: CIVIL_ENGINE_ROUTES.structural.influenceLines,
            description: 'Moving load analysis',
            badge: 'New',
          },
        ],
      },
      {
        id: 'geotechnical',
        label: 'Geotechnical',
        icon: '🏔️',
        path: CIVIL_ENGINE_ROUTES.geotechnical.root,
        description: 'Soil mechanics and foundation engineering',
        children: [
          {
            id: 'bearing-capacity',
            label: 'Bearing Capacity',
            icon: '⚡',
            path: CIVIL_ENGINE_ROUTES.geotechnical.bearingCapacity,
            description: 'Terzaghi, Meyerhof, Hansen, Vesic',
          },
          {
            id: 'settlement',
            label: 'Settlement Analysis',
            icon: '📉',
            path: CIVIL_ENGINE_ROUTES.geotechnical.settlement,
            description: 'Immediate and consolidation settlement',
          },
          {
            id: 'slope-stability',
            label: 'Slope Stability',
            icon: '⛰️',
            path: CIVIL_ENGINE_ROUTES.geotechnical.slopeStability,
            description: 'Bishop, Fellenius, and more',
          },
          {
            id: 'earth-pressure',
            label: 'Earth Pressure',
            icon: '↔️',
            path: CIVIL_ENGINE_ROUTES.geotechnical.earthPressure,
            description: 'Rankine and Coulomb methods',
          },
          {
            id: 'pile-foundation',
            label: 'Pile Foundation',
            icon: '⬇️',
            path: CIVIL_ENGINE_ROUTES.geotechnical.pileFoundation,
            description: 'Pile capacity and group analysis',
          },
          {
            id: 'retaining-wall',
            label: 'Retaining Wall',
            icon: '🧱',
            path: CIVIL_ENGINE_ROUTES.geotechnical.retainingWall,
            description: 'Gravity and cantilever walls',
            badge: 'New',
          },
        ],
      },
      {
        id: 'hydraulics',
        label: 'Hydraulics',
        icon: '🌊',
        path: CIVIL_ENGINE_ROUTES.hydraulics.root,
        description: 'Fluid mechanics and hydrology',
        children: [
          {
            id: 'channel-flow',
            label: 'Open Channel Flow',
            icon: '🌊',
            path: CIVIL_ENGINE_ROUTES.hydraulics.channelFlow,
            description: "Manning's equation and critical flow",
          },
          {
            id: 'pipe-flow',
            label: 'Pipe Flow',
            icon: '🔵',
            path: CIVIL_ENGINE_ROUTES.hydraulics.pipeFlow,
            description: 'Darcy-Weisbach and Hazen-Williams',
          },
          {
            id: 'hydrology',
            label: 'Hydrology',
            icon: '🌧️',
            path: CIVIL_ENGINE_ROUTES.hydraulics.hydrology,
            description: 'Rational method and SCS',
          },
          {
            id: 'hydraulic-structures',
            label: 'Hydraulic Structures',
            icon: '🌉',
            path: CIVIL_ENGINE_ROUTES.hydraulics.hydraulicStructures,
            description: 'Weirs, spillways, culverts',
          },
          {
            id: 'flood-routing',
            label: 'Flood Routing',
            icon: '📈',
            path: CIVIL_ENGINE_ROUTES.hydraulics.floodRouting,
            description: 'Muskingum and level pool',
          },
          {
            id: 'water-distribution',
            label: 'Water Distribution',
            icon: '💧',
            path: CIVIL_ENGINE_ROUTES.hydraulics.waterDistribution,
            description: 'Pipe network analysis',
            badge: 'New',
          },
        ],
      },
      {
        id: 'transportation',
        label: 'Transportation',
        icon: '🛣️',
        path: CIVIL_ENGINE_ROUTES.transportation.root,
        description: 'Highway and traffic engineering',
        children: [
          {
            id: 'geometric-design',
            label: 'Geometric Design',
            icon: '🛣️',
            path: CIVIL_ENGINE_ROUTES.transportation.geometricDesign,
            description: 'Horizontal and vertical alignments',
          },
          {
            id: 'pavement-design',
            label: 'Pavement Design',
            icon: '🚗',
            path: CIVIL_ENGINE_ROUTES.transportation.pavementDesign,
            description: 'AASHTO and IRC methods',
          },
          {
            id: 'traffic-analysis',
            label: 'Traffic Analysis',
            icon: '🚦',
            path: CIVIL_ENGINE_ROUTES.transportation.trafficAnalysis,
            description: 'Flow, density, LOS analysis',
          },
          {
            id: 'signal-design',
            label: 'Signal Design',
            icon: '🚥',
            path: CIVIL_ENGINE_ROUTES.transportation.signalDesign,
            description: "Webster's method",
          },
          {
            id: 'railway',
            label: 'Railway Engineering',
            icon: '🚂',
            path: CIVIL_ENGINE_ROUTES.transportation.railway,
            description: 'Track geometry and design',
          },
          {
            id: 'airport',
            label: 'Airport Planning',
            icon: '✈️',
            path: CIVIL_ENGINE_ROUTES.transportation.airport,
            description: 'Runway and taxiway design',
            badge: 'New',
          },
        ],
      },
      {
        id: 'surveying',
        label: 'Surveying',
        icon: '📍',
        path: CIVIL_ENGINE_ROUTES.surveying.root,
        description: 'Land surveying and geodesy',
        children: [
          {
            id: 'traverse',
            label: 'Traverse Computation',
            icon: '📍',
            path: CIVIL_ENGINE_ROUTES.surveying.traverse,
            description: 'Closure and adjustment',
          },
          {
            id: 'leveling',
            label: 'Leveling',
            icon: '⚖️',
            path: CIVIL_ENGINE_ROUTES.surveying.leveling,
            description: 'Differential leveling calculations',
          },
          {
            id: 'curve-setting',
            label: 'Curve Setting Out',
            icon: '↪️',
            path: CIVIL_ENGINE_ROUTES.surveying.curveSetting,
            description: 'Horizontal and vertical curves',
          },
          {
            id: 'earthwork',
            label: 'Earthwork Volumes',
            icon: '📊',
            path: CIVIL_ENGINE_ROUTES.surveying.earthwork,
            description: 'Cut and fill calculations',
          },
          {
            id: 'coordinates',
            label: 'Coordinate Transform',
            icon: '🌐',
            path: CIVIL_ENGINE_ROUTES.surveying.coordinates,
            description: 'UTM, geographic, ECEF',
          },
          {
            id: 'gps',
            label: 'GPS Processing',
            icon: '📡',
            path: CIVIL_ENGINE_ROUTES.surveying.gps,
            description: 'GNSS coordinate processing',
            badge: 'New',
          },
        ],
      },
    ],
  },
];

// =============================================================================
// BREADCRUMB CONFIGURATION
// =============================================================================

export function getBreadcrumbs(path: string): { label: string; path: string }[] {
  const segments = path.split('/').filter(Boolean);
  const breadcrumbs: { label: string; path: string }[] = [];
  
  let currentPath = '';
  
  for (const segment of segments) {
    currentPath += `/${segment}`;
    
    // Find matching nav item
    const item = findNavItem(CIVIL_ENGINE_NAV, currentPath);
    if (item) {
      breadcrumbs.push({
        label: item.label,
        path: item.path,
      });
    } else {
      // Format segment as title
      breadcrumbs.push({
        label: segment.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        path: currentPath,
      });
    }
  }
  
  return breadcrumbs;
}

function findNavItem(items: NavItem[], path: string): NavItem | null {
  for (const item of items) {
    if (item.path === path) {
      return item;
    }
    if (item.children) {
      const found = findNavItem(item.children, path);
      if (found) return found;
    }
  }
  return null;
}

// =============================================================================
// QUICK ACCESS SHORTCUTS
// =============================================================================

export const QUICK_ACCESS_ITEMS = [
  {
    id: 'frame-analysis',
    label: '2D Frame',
    icon: '🏗️',
    path: CIVIL_ENGINE_ROUTES.structural.frameAnalysis,
    color: 'blue',
  },
  {
    id: 'bearing-capacity',
    label: 'Bearing',
    icon: '🏔️',
    path: CIVIL_ENGINE_ROUTES.geotechnical.bearingCapacity,
    color: 'amber',
  },
  {
    id: 'channel-flow',
    label: 'Channel',
    icon: '🌊',
    path: CIVIL_ENGINE_ROUTES.hydraulics.channelFlow,
    color: 'cyan',
  },
  {
    id: 'geometric-design',
    label: 'Highway',
    icon: '🛣️',
    path: CIVIL_ENGINE_ROUTES.transportation.geometricDesign,
    color: 'green',
  },
  {
    id: 'traverse',
    label: 'Traverse',
    icon: '📍',
    path: CIVIL_ENGINE_ROUTES.surveying.traverse,
    color: 'purple',
  },
];

// =============================================================================
// MODULE CAPABILITIES FOR HELP SYSTEM
// =============================================================================

export const MODULE_HELP = {
  structural: {
    title: 'Structural Analysis',
    description: 'Analyze 2D frames, trusses, and continuous beams using matrix methods.',
    features: CIVIL_ENGINE_MODULES.structural.capabilities,
    examples: [
      'Portal frame analysis under lateral and gravity loads',
      'Pratt, Howe, and Warren truss analysis',
      'Multi-span continuous beam design',
    ],
  },
  geotechnical: {
    title: 'Geotechnical Engineering',
    description: 'Foundation design, slope stability, and earth retaining structures.',
    features: CIVIL_ENGINE_MODULES.geotechnical.capabilities,
    examples: [
      'Shallow foundation bearing capacity',
      'Consolidation settlement prediction',
      'Cut slope stability analysis',
    ],
  },
  hydraulics: {
    title: 'Hydraulics & Hydrology',
    description: 'Open channel flow, pipe networks, and rainfall-runoff analysis.',
    features: CIVIL_ENGINE_MODULES.hydraulics.capabilities,
    examples: [
      'Channel sizing for given discharge',
      'Pipe network head loss calculation',
      'Peak runoff estimation for urban drainage',
    ],
  },
  transportation: {
    title: 'Transportation Engineering',
    description: 'Highway geometric design, pavement structures, and traffic analysis.',
    features: CIVIL_ENGINE_MODULES.transportation.capabilities,
    examples: [
      'Horizontal curve superelevation design',
      'Flexible pavement thickness design',
      'Intersection signal timing optimization',
    ],
  },
  surveying: {
    title: 'Surveying & Geodesy',
    description: 'Traverse computations, leveling, and coordinate transformations.',
    features: CIVIL_ENGINE_MODULES.surveying.capabilities,
    examples: [
      'Closed traverse adjustment',
      'Profile leveling for road alignment',
      'UTM to geographic coordinate conversion',
    ],
  },
};

export default {
  routes: CIVIL_ENGINE_ROUTES,
  navigation: CIVIL_ENGINE_NAV,
  quickAccess: QUICK_ACCESS_ITEMS,
  help: MODULE_HELP,
  getBreadcrumbs,
};
