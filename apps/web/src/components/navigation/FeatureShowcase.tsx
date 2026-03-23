import React, { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Activity, Zap, Building2, Users, FileText, BookOpen, Cog } from 'lucide-react';

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  gradient: string;
  badge?: string;
  features?: string[];
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    id: 'analysis',
    title: 'Analysis Tools',
    description: 'Modal, seismic, time-history, and advanced analysis',
    icon: <Activity className="w-6 h-6" />,
    path: '/analysis/modal',
    gradient: 'from-blue-500 to-cyan-500',
    badge: '10+ Types',
    features: ['Modal', 'Seismic', 'Time-History', 'Pushover'],
  },
  {
    id: 'design',
    title: 'Design Modules',
    description: 'RC, steel, connections, and foundation design',
    icon: <Building2 className="w-6 h-6" />,
    path: '/design-center',
    gradient: 'from-orange-500 to-red-500',
    badge: 'Industry Standard',
    features: ['RC Beams', 'Columns', 'Steel Members'],
  },
  {
    id: 'tools',
    title: 'Engineering Tools',
    description: 'Load combinations, section database, BBS generator',
    icon: <Zap className="w-6 h-6" />,
    path: '/tools/load-combinations',
    gradient: 'from-amber-500 to-yellow-500',
    badge: 'Pro Tools',
    features: ['Load Combinations', 'Section Database'],
  },
  {
    id: 'reports',
    title: 'Reports & Visualization',
    description: '3D visualization, animations, and reports',
    icon: <FileText className="w-6 h-6" />,
    path: '/reports/professional',
    gradient: 'from-purple-500 to-pink-500',
    badge: 'Premium',
    features: ['Professional Reports', '3D Visualization'],
  },
  {
    id: 'collaboration',
    title: 'Team Collaboration',
    description: 'Share projects, collaborate real-time, BIM integration',
    icon: <Users className="w-6 h-6" />,
    path: '/collaboration',
    gradient: 'from-green-500 to-emerald-500',
    badge: 'Enterprise',
    features: ['Team Workspace', 'BIM/CAD', 'API'],
  },
  {
    id: 'ai',
    title: 'AI Features',
    description: 'AI-powered design and optimization tools',
    icon: <Zap className="w-6 h-6" />,
    path: '/ai-dashboard',
    gradient: 'from-violet-500 to-purple-500',
    badge: 'New',
    features: ['AI Dashboard', 'AI Power Panel'],
  },
];

interface FeatureShowcaseProps {
  className?: string;
  maxColumns?: 2 | 3 | 4;
}

const FeatureCardComponent: FC<{ card: FeatureCard; index: number }> = ({ card, index }) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      onClick={() => navigate(card.path)}
      className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.02] to-white/[0.01] backdrop-blur-sm cursor-pointer transition-all hover:border-white/[0.12] hover:bg-white/[0.04]"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />

      <div className="relative p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-lg bg-gradient-to-br ${card.gradient} opacity-90 group-hover:opacity-100 transition-opacity`}>
            <div className="text-white">{card.icon}</div>
          </div>
          {card.badge && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/20">
              {card.badge}
            </span>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#dae2fd] group-hover:text-slate-700 dark:group-hover:text-slate-100 transition-colors">
            {card.title}
          </h3>
          <p className="text-xs text-[#869ab8] mt-1 line-clamp-2">
            {card.description}
          </p>
        </div>

        {card.features && card.features.length > 0 && (
          <div className="pt-2 space-y-1">
            {card.features.slice(0, 2).map((feature, i) => (
              <div key={i} className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-blue-400" />
                {feature}
              </div>
            ))}
          </div>
        )}

        <div className="pt-1 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs font-medium tracking-wide text-blue-600 dark:text-blue-400">
            Explore
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
};

export const FeatureShowcase: FC<FeatureShowcaseProps> = ({ className = '', maxColumns = 4 }) => {
  const columnsClass: Record<number, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-[#dae2fd]">
          Feature Modules
        </h2>
        <p className="text-[#869ab8]">
          Access all available tools and modules. Click any card to explore.
        </p>
      </div>

      <div className={`grid gap-4 ${columnsClass[maxColumns]}`}>
        {FEATURE_CARDS.map((card, index) => (
          <FeatureCardComponent key={card.id} card={card} index={index} />
        ))}
      </div>

      <div className="rounded-lg border border-blue-500/20 bg-blue-50/10 dark:bg-blue-500/10 p-4">
        <p className="text-sm text-blue-600 dark:text-blue-300">
          💡 <strong>Tip:</strong> Click any card to explore features, or use search to find what you need.
        </p>
      </div>
    </div>
  );
};

export default FeatureShowcase;
