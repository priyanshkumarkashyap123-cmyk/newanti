/**
 * FeatureNavigation.tsx - Comprehensive feature navigation component
 * Provides easy access to all pages and features organized by category
 */

import React, { FC, useState, useMemo, useCallback, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  APP_FEATURE_CATEGORIES,
  getFeatureCategories,
  type AppFeatureCategory,
  type FeatureIconKey,
} from '../../config/appRouteMeta';

const ICONS: Record<FeatureIconKey, React.ComponentType<{ className?: string }>> = {
  layout: Layout,
  database: Database,
  building2: Building2,
  activity: Activity,
  clock: Clock,
  zap: Zap,
  trendingUp: TrendingUp,
  pieChart: PieChart,
  barChart3: BarChart3,
  cable: Cable,
  grid3x3: Grid3X3,
  network: Network,
  columns: Columns,
  mountain: Mountain,
  box: Box,
  workflow: Workflow,
  compass: Compass,
  fileText: FileText,
  mapPin: MapPin,
  home: Home,
  users: Users,
  code2: Code2,
  shield: Shield,
  bookOpen: BookOpen,
};

const renderFeatureIcon = (iconKey: FeatureIconKey): React.ReactNode => {
  const Icon = ICONS[iconKey];
  return <Icon className="w-4 h-4" />;
};

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
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(APP_FEATURE_CATEGORIES.map((c) => c.id))
  );

  const filteredCategories = useMemo(() => {
    return getFeatureCategories(deferredSearchQuery);
  }, [deferredSearchQuery]);

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
  const handleCategoryHover = useCallback((category: AppFeatureCategory) => {
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
                            {renderFeatureIcon(feature.iconKey)}
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

export default React.memo(FeatureNavigation);
