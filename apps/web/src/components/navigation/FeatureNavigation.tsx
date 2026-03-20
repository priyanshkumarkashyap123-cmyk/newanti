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
  Crown,
  Lock,
} from 'lucide-react';
import {
  APP_FEATURE_CATEGORIES,
  getBundleCollections,
  isCategoryAccessibleForTier,
  type AppFeatureCategory,
  type FeatureIconKey,
} from '../../config/appRouteMeta';
import { useSubscription } from '../../hooks/useSubscription';
import { useJourney } from '../../hooks/useJourney';

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
  const { subscription } = useSubscription();
  const { journey, showAdvanced, setShowAdvanced } = useJourney();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(
      APP_FEATURE_CATEGORIES.filter((c) => c.prominence !== 'advanced').map((c) => c.id),
    )
  );

  const bundleCollections = useMemo(
    () =>
      getBundleCollections({
        query: deferredSearchQuery,
        tier: subscription.tier,
        includeLocked: true,
        journey,
        showAdvanced,
      }),
    [deferredSearchQuery, subscription.tier, journey, showAdvanced],
  );

  const sections = useMemo(
    () => [
      { id: 'primary', label: 'Core Workflows', categories: bundleCollections.primary },
      { id: 'secondary', label: 'Specialist Suites', categories: bundleCollections.secondary },
      { id: 'advanced', label: 'Advanced & Enterprise', categories: bundleCollections.advanced },
    ]
      .filter((section) => section.categories.length > 0),
    [bundleCollections],
  );

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
        <div className="p-4 border-b border-[#424754]/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c909f]" />
            <input
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded bg-[#060e20] border border-[#424754]/30 text-[#dae2fd] placeholder-[#8c909f] focus:outline-none focus:border-[#adc6ff]/50 focus:ring-1 focus:ring-[#adc6ff]"
            />
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {(journey === 'newbie' || journey === 'professional') && !showAdvanced && (
            <div className="rounded border border-[#4d8eff]/30 bg-[#4d8eff]/10 p-3">
              <p className="text-[11px] text-[#adc6ff]">
                Guided mode is on. Showing essential workflows first.
              </p>
              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className="mt-2 text-xs font-bold text-[#adc6ff] hover:underline"
              >
                Show advanced features
              </button>
            </div>
          )}

          {(journey === 'newbie' || journey === 'professional') && showAdvanced && (
            <div className="rounded border border-[#92002a]/30 bg-[#5b0017] p-3">
              <p className="text-[11px] text-[#ffb2b7]">
                Advanced features are visible.
              </p>
              <button
                type="button"
                onClick={() => setShowAdvanced(false)}
                className="mt-2 text-xs font-bold text-[#ffb2b7] hover:underline"
              >
                Back to guided mode
              </button>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.id} className="space-y-2">
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#8c909f]">
                {section.label}
              </div>
              <AnimatePresence>
                {section.categories.map((category) => {
                  const accessible = isCategoryAccessibleForTier(category, subscription.tier);

                  return (
                    <div key={category.id}>
                      <motion.button
                        onClick={() => toggleCategory(category.id)}
                        onMouseEnter={() => handleCategoryHover(category)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[#222a3d] transition-colors group"
                      >
                        <ChevronRight
                          className={`w-4 h-4 text-[#8c909f] transition-transform ${
                            expandedCategories.has(category.id) ? 'rotate-90' : ''
                          }`}
                        />
                        <span className="text-[13px] font-bold text-[#dae2fd] font-['Manrope'] flex-1 text-left group-hover:text-[#adc6ff]">
                          {category.label}
                        </span>
                        {category.planRequired && (
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide border ${
                              accessible
                                ? 'bg-[#00a572]/20 text-[#6ffbbe] border-[#00a572]/30'
                                : category.planRequired === 'enterprise'
                                  ? 'bg-[#00285d] text-[#adc6ff] border-[#4d8eff]/30'
                                  : 'bg-[#5b0017] text-[#ffb2b7] border-[#92002a]/30'
                            }`}
                          >
                            {accessible ? <Crown className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                            {accessible ? 'Unlocked' : category.planRequired === 'enterprise' ? 'Enterprise' : 'Pro'}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-[#8c909f] bg-[#0b1326] border border-[#424754]/30 px-2 py-0.5 rounded">
                          {category.features.length}
                        </span>
                      </motion.button>

                      <AnimatePresence>
                        {expandedCategories.has(category.id) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-1 pl-4 mt-1 border-l border-[#424754]/30 ml-4"
                          >
                            {category.features.map((feature) => (
                              <motion.button
                                key={feature.id}
                                onClick={() => handleNavigate(feature.path)}
                                onMouseEnter={() => prefetchRoute(feature.path)}
                                onFocus={() => prefetchRoute(feature.path)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded text-left text-sm hover:bg-[#222a3d] transition-all group border border-transparent hover:border-[#424754]/50"
                              >
                                <div className="flex-shrink-0 text-[#8c909f] group-hover:text-[#adc6ff]">
                                  {renderFeatureIcon(feature.iconKey)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-medium text-[#dae2fd] flex items-center gap-2 flex-wrap group-hover:text-[#adc6ff] transition-colors">
                                    {feature.label}
                                    {feature.badge && (
                                      <span className="text-[9px] font-bold uppercase tracking-wider bg-[#5b0017] border border-[#92002a]/30 text-[#ffb2b7] px-1.5 py-[1px] rounded">
                                        {feature.badge}
                                      </span>
                                    )}
                                  </div>
                                  {feature.description && (
                                    <div className="text-[11px] font-medium text-[#8c909f] truncate mt-0.5">
                                      {feature.description}
                                    </div>
                                  )}
                                </div>
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(FeatureNavigation);
