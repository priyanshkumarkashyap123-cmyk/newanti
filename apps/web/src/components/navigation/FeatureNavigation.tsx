/**
 * FeatureNavigation.tsx - Comprehensive feature navigation component
 * Provides easy access to all pages and features organized by category
 */

import React, { FC, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { prefetchRoute, prefetchRoutes } from '../../utils/routePrefetch';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Search,
  BarChart3,
  Wrench,
  FileText,
  Settings,
  Users,
  Building2,
  Triangle,
  Box,
  Columns,
  Zap,
  BookOpen,
  Compass,
  Grid3X3,
  Cable,
  Mountain,
  Activity,
  PieChart,
  Network,
  Clock,
  TrendingUp,
  Workflow,
  Code2,
  Database,
  Shield,
  MapPin,
  Home,
  Layout,
} from 'lucide-react';

interface Feature {
  id: string;
  label: string;
  path: string;
  description?: string;
  icon: React.ReactNode;
  badge?: string;
  category: string;
}

interface FeatureCategory {
  id: string;
  label: string;
  description?: string;
  features: Feature[];
}

const FEATURE_CATEGORIES: FeatureCategory[] = [
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
        icon: <Layout className="w-4 h-4" />,
        category: 'workspace',
      },
      {
        id: 'modeler',
        label: '3D Modeler',
        path: '/app',
        description: 'Interactive structural modeling',
        icon: <Building2 className="w-4 h-4" />,
        category: 'workspace',
        badge: 'Core',
      },
      {
        id: 'projects',
        label: 'My Projects',
        path: '/stream',
        description: 'View and manage all projects',
        icon: <Database className="w-4 h-4" />,
        category: 'workspace',
      },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    description: 'Structural analysis & simulation',
    features: [
      {
        id: 'modal',
        label: 'Modal Analysis',
        path: '/analysis/modal',
        description: 'Dynamic modal analysis',
        icon: <Activity className="w-4 h-4" />,
        category: 'analysis',
      },
      {
        id: 'time-history',
        label: 'Time History',
        path: '/analysis/time-history',
        description: 'Earthquake time-history analysis',
        icon: <Clock className="w-4 h-4" />,
        category: 'analysis',
      },
      {
        id: 'seismic',
        label: 'Seismic Analysis',
        path: '/analysis/seismic',
        description: 'Seismic design analysis',
        icon: <Zap className="w-4 h-4" />,
        category: 'analysis',
      },
      {
        id: 'buckling',
        label: 'Buckling',
        path: '/analysis/buckling',
        description: 'Elastic/inelastic buckling analysis',
        icon: <TrendingUp className="w-4 h-4" />,
        category: 'analysis',
      },
      {
        id: 'pdelta',
        label: 'P-Delta & Nonlinear',
        path: '/analysis/pdelta',
        description: 'Second-order & nonlinear analysis',
        icon: <PieChart className="w-4 h-4" />,
        category: 'analysis',
      },
      {
        id: 'pushover',
        label: 'Pushover Analysis',
        path: '/analysis/pushover',
        description: 'Nonlinear static pushover',
        icon: <BarChart3 className="w-4 h-4" />,
        category: 'analysis',
      },
      {
        id: 'cable',
        label: 'Cable Analysis',
        path: '/analysis/cable',
        description: 'Cable structure analysis',
        icon: <Cable className="w-4 h-4" />,
        category: 'analysis',
      },
      {
        id: 'plate-shell',
        label: 'Plate & Shell FEM',
        path: '/analysis/plate-shell',
        description: '2D plate/shell finite element analysis',
        icon: <Grid3X3 className="w-4 h-4" />,
        category: 'analysis',
        badge: 'New',
      },
      {
        id: 'optimization',
        label: 'Sensitivity & Optimization',
        path: '/analysis/sensitivity-optimization',
        description: 'Parameter optimization',
        icon: <Network className="w-4 h-4" />,
        category: 'analysis',
      },
    ],
  },
  {
    id: 'design',
    label: 'Design',
    description: 'Structural member & connection design',
    features: [
      {
        id: 'concrete',
        label: 'RC Design',
        path: '/design/concrete',
        description: 'IS 456/ACI 318 reinforced concrete',
        icon: <Columns className="w-4 h-4" />,
        category: 'design',
      },
      {
        id: 'foundation',
        label: 'Foundation Design',
        path: '/design/foundation',
        description: 'Footing & foundation design',
        icon: <Mountain className="w-4 h-4" />,
        category: 'design',
      },
      {
        id: 'steel',
        label: 'Steel Design',
        path: '/design/steel',
        description: 'AISC/IS 800 steel members',
        icon: <Box className="w-4 h-4" />,
        category: 'design',
      },
      {
        id: 'connections',
        label: 'Connection Design',
        path: '/design/connections',
        description: 'Bolted & welded connections',
        icon: <Grid3X3 className="w-4 h-4" />,
        category: 'design',
      },
      {
        id: 'reinforcement',
        label: 'Reinforcement',
        path: '/design/reinforcement',
        description: 'Stirrups & development length',
        icon: <Workflow className="w-4 h-4" />,
        category: 'design',
      },
      {
        id: 'detailing',
        label: 'RC Detailing',
        path: '/design/detailing',
        description: 'Detailed reinforcement drawings',
        icon: <Code2 className="w-4 h-4" />,
        category: 'design',
      },
      {
        id: 'design-center',
        label: 'Design Center',
        path: '/design-center',
        description: 'Unified design interface',
        icon: <Compass className="w-4 h-4" />,
        category: 'design',
      },
      {
        id: 'design-hub',
        label: 'Post-Analysis Hub',
        path: '/design-hub',
        description: 'STAAD.Pro workflow',
        icon: <Workflow className="w-4 h-4" />,
        category: 'design',
      },
    ],
  },
  {
    id: 'tools',
    label: 'Tools & Utilities',
    description: 'Engineering calculators and databases',
    features: [
      {
        id: 'load-combinations',
        label: 'Load Combinations',
        path: '/tools/load-combinations',
        description: 'IS 1893/ASCE 7 combinations',
        icon: <BarChart3 className="w-4 h-4" />,
        category: 'tools',
      },
      {
        id: 'section-database',
        label: 'Section Database',
        path: '/tools/section-database',
        description: 'ISMB/AISC/IPE properties',
        icon: <Database className="w-4 h-4" />,
        category: 'tools',
      },
      {
        id: 'bar-bending',
        label: 'Bar Bending Schedule',
        path: '/tools/bar-bending',
        description: 'IS 2502 BBS generator',
        icon: <FileText className="w-4 h-4" />,
        category: 'tools',
        badge: 'New',
      },
      {
        id: 'meshing',
        label: 'Advanced Meshing',
        path: '/tools/advanced-meshing',
        description: 'Mesh generation & control',
        icon: <Grid3X3 className="w-4 h-4" />,
        category: 'tools',
      },
      {
        id: 'print-export',
        label: 'Print & Export',
        path: '/tools/print-export',
        description: 'Generate & export reports',
        icon: <FileText className="w-4 h-4" />,
        category: 'tools',
      },
      {
        id: 'space-planning',
        label: 'Space Planning',
        path: '/space-planning',
        description: 'House & facility layout',
        icon: <MapPin className="w-4 h-4" />,
        category: 'tools',
        badge: 'New',
      },
    ],
  },
  {
    id: 'enterprise',
    label: 'Enterprise Features',
    description: 'Team collaboration & integration',
    features: [
      {
        id: 'collaboration',
        label: 'Collaboration Hub',
        path: '/collaboration',
        description: 'Team workspace & projects',
        icon: <Users className="w-4 h-4" />,
        category: 'enterprise',
      },
      {
        id: 'bim',
        label: 'BIM Integration',
        path: '/bim',
        description: 'BIM import/export',
        icon: <Building2 className="w-4 h-4" />,
        category: 'enterprise',
      },
      {
        id: 'cad',
        label: 'CAD Integration',
        path: '/cad/integration',
        description: 'CAD file integration',
        icon: <Code2 className="w-4 h-4" />,
        category: 'enterprise',
      },
      {
        id: 'api',
        label: 'API Integration',
        path: '/integrations/api-dashboard',
        description: 'API connections & webhooks',
        icon: <Network className="w-4 h-4" />,
        category: 'enterprise',
      },
      {
        id: 'materials',
        label: 'Materials Database',
        path: '/materials/database',
        description: 'Material properties library',
        icon: <Database className="w-4 h-4" />,
        category: 'enterprise',
      },
      {
        id: 'compliance',
        label: 'Code Compliance',
        path: '/compliance/checker',
        description: 'Design code validation',
        icon: <Shield className="w-4 h-4" />,
        category: 'enterprise',
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reports & Documentation',
    description: 'Report generation and export',
    features: [
      {
        id: 'reports',
        label: 'Reports',
        path: '/reports',
        description: 'Report management',
        icon: <FileText className="w-4 h-4" />,
        category: 'reports',
      },
      {
        id: 'report-builder',
        label: 'Report Builder',
        path: '/reports/builder',
        description: 'Custom report builder',
        icon: <FileText className="w-4 h-4" />,
        category: 'reports',
      },
      {
        id: 'professional-reports',
        label: 'Professional Reports',
        path: '/reports/professional',
        description: 'Industry-standard reports',
        icon: <FileText className="w-4 h-4" />,
        category: 'reports',
      },
      {
        id: 'visualization',
        label: '3D Visualization',
        path: '/visualization/3d-engine',
        description: 'Advanced 3D rendering',
        icon: <Building2 className="w-4 h-4" />,
        category: 'reports',
      },
      {
        id: 'animation',
        label: 'Result Animation',
        path: '/visualization/result-animation',
        description: 'Animation playback viewer',
        icon: <Activity className="w-4 h-4" />,
        category: 'reports',
      },
    ],
  },
  {
    id: 'civil',
    label: 'Civil Engineering',
    description: 'Specialized civil modules',
    features: [
      {
        id: 'hydraulics',
        label: 'Hydraulics Designer',
        path: '/civil/hydraulics',
        description: 'Hydraulic system design',
        icon: <Activity className="w-4 h-4" />,
        category: 'civil',
      },
      {
        id: 'transportation',
        label: 'Transportation Designer',
        path: '/civil/transportation',
        description: 'Road & highway design',
        icon: <Database className="w-4 h-4" />,
        category: 'civil',
      },
      {
        id: 'construction',
        label: 'Construction Manager',
        path: '/civil/construction',
        description: 'Construction planning',
        icon: <Building2 className="w-4 h-4" />,
        category: 'civil',
      },
      {
        id: 'quantity-survey',
        label: 'Quantity Survey',
        path: '/quantity',
        description: 'Material quantity takeoff',
        icon: <BarChart3 className="w-4 h-4" />,
        category: 'civil',
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI Features',
    description: 'Artificial intelligence tools',
    features: [
      {
        id: 'ai-dashboard',
        label: 'AI Dashboard',
        path: '/ai-dashboard',
        description: 'C-suite AI analytics',
        icon: <Zap className="w-4 h-4" />,
        category: 'ai',
        badge: 'New',
      },
      {
        id: 'ai-power',
        label: 'AI Power Panel',
        path: '/ai-power',
        description: 'Next-gen AI interface',
        icon: <Zap className="w-4 h-4" />,
        category: 'ai',
        badge: 'New',
      },
    ],
  },
  {
    id: 'learning',
    label: 'Learning & Support',
    description: 'Documentation and tutorials',
    features: [
      {
        id: 'learning-center',
        label: 'Learning Center',
        path: '/learning',
        description: 'Tutorials and courses',
        icon: <BookOpen className="w-4 h-4" />,
        category: 'learning',
      },
      {
        id: 'help',
        label: 'Help Center',
        path: '/help',
        description: 'FAQs and support',
        icon: <BookOpen className="w-4 h-4" />,
        category: 'learning',
      },
    ],
  },
];

interface FeatureNavigationProps {
  onNavigate?: () => void;
  searchable?: boolean;
  className?: string;
}

/**
 * FeatureNavigation - Main component
 */
export const FeatureNavigation: FC<FeatureNavigationProps> = ({
  onNavigate,
  searchable = true,
  className = '',
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(FEATURE_CATEGORIES.map((c) => c.id))
  );

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return FEATURE_CATEGORIES;

    const query = searchQuery.toLowerCase();
    return FEATURE_CATEGORIES.map((category) => ({
      ...category,
      features: category.features.filter(
        (feature) =>
          feature.label.toLowerCase().includes(query) ||
          feature.description?.toLowerCase().includes(query) ||
          feature.id.toLowerCase().includes(query)
      ),
    })).filter((category) => category.features.length > 0);
  }, [searchQuery]);

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
    onNavigate?.();
  }, [navigate, onNavigate]);

  // Prefetch all routes in a category when hovering the category header
  const handleCategoryHover = useCallback((category: typeof FEATURE_CATEGORIES[0]) => {
    prefetchRoutes(category.features.map(f => f.path));
  }, []);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Search Bar */}
      {searchable && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-4">
          <AnimatePresence>
            {filteredCategories.map((category) => (
              <div key={category.id}>
                {/* Category Header */}
                <motion.button
                  onClick={() => toggleCategory(category.id)}
                  onMouseEnter={() => handleCategoryHover(category)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                >
                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      expandedCategories.has(category.id) ? 'rotate-90' : ''
                    }`}
                  />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white flex-1 text-left">
                    {category.label}
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded group-hover:bg-slate-200 dark:group-hover:bg-slate-700">
                    {category.features.length}
                  </span>
                </motion.button>

                {/* Category Features */}
                <AnimatePresence>
                  {expandedCategories.has(category.id) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1 pl-4 mt-1"
                    >
                      {category.features.map((feature) => (
                        <motion.button
                          key={feature.id}
                          onClick={() => handleNavigate(feature.path)}
                          onMouseEnter={() => prefetchRoute(feature.path)}
                          onFocus={() => prefetchRoute(feature.path)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
                        >
                          <div className="flex-shrink-0 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {feature.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                              {feature.label}
                              {feature.badge && (
                                <span className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                  {feature.badge}
                                </span>
                              )}
                            </div>
                            {feature.description && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {feature.description}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 flex-shrink-0" />
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default FeatureNavigation;
