/**
 * CivilDesignHubPage.tsx — Unified Civil Engineering Dashboard
 *
 * Central hub linking all civil engineering disciplines:
 * Geotechnical, Transportation, Hydraulics, Construction Management,
 * Surveying, Environmental Engineering
 *
 * Each card links to existing modules or shows "Coming Soon" badge.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Mountain,
  Truck,
  Droplets,
  HardHat,
  MapPin,
  Leaf,
  ArrowRight,
  Search,
  Clock,
  Sparkles,
  Star,
  Lock,
  ChevronRight,
  Building2,
  GraduationCap,
  Layers,
  Activity,
  Gauge,
  Globe,
  Shield,
  TrendingUp,
  Compass,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Types & Data
// ─────────────────────────────────────────────

interface Discipline {
  id: string;
  label: string;
  description: string;
  icon: typeof Mountain;
  gradient: string;
  shadowColor: string;
  route: string;
  capabilities: string[];
  status: 'active' | 'coming-soon';
  badge?: string;
  stats?: { label: string; value: string }[];
}

const DISCIPLINES: Discipline[] = [
  {
    id: 'geotechnical',
    label: 'Geotechnical Engineering',
    description:
      'Soil analysis, foundation design, slope stability, bearing capacity, settlement analysis, and liquefaction screening. Powered by FEM-based simulation engine.',
    icon: Mountain,
    gradient: 'from-amber-500 to-orange-600',
    shadowColor: 'shadow-amber-500/20',
    route: '/design/geotechnical',
    status: 'active',
    badge: 'AI-Enhanced',
    capabilities: [
      'SPT/CPT Correlation',
      'Bearing Capacity (Terzaghi)',
      'Slope Stability Analysis',
      'Consolidation Settlement',
      'Liquefaction Screening',
      'Pile Axial Capacity',
      'Earth Pressure (Rankine/Coulomb)',
      'Retaining Wall Stability',
    ],
    stats: [
      { label: 'Design Checks', value: '9' },
      { label: 'Soil Models', value: '12+' },
      { label: 'Codes', value: 'IS/ASCE' },
    ],
  },
  {
    id: 'transportation',
    label: 'Transportation Engineering',
    description:
      'Road geometry design, intersection analysis, traffic simulation, pavement design, and highway capacity analysis. Includes generative alignment optimization.',
    icon: Truck,
    gradient: 'from-blue-500 to-indigo-600',
    shadowColor: 'shadow-blue-500/20',
    route: '/civil/transportation',
    status: 'active',
    capabilities: [
      'Horizontal & Vertical Alignment',
      'Sight Distance Analysis',
      'Superelevation Design',
      'Pavement Thickness (AASHTO)',
      'Traffic Signal Timing',
      'Intersection Level of Service',
      'Earthwork Quantities',
      'Cross-Section Generation',
    ],
    stats: [
      { label: 'Modules', value: '8' },
      { label: 'Standards', value: 'IRC/AASHTO' },
      { label: 'Analysis', value: 'Real-time' },
    ],
  },
  {
    id: 'hydraulics',
    label: 'Hydraulic Engineering',
    description:
      'Open channel flow, pipe network analysis, stormwater management, flood modeling, and water distribution system design with AI-powered optimization.',
    icon: Droplets,
    gradient: 'from-cyan-500 to-teal-600',
    shadowColor: 'shadow-cyan-500/20',
    route: '/civil/hydraulics',
    status: 'active',
    badge: 'Popular',
    capabilities: [
      'Manning\'s Open Channel Flow',
      'Pipe Flow (Darcy-Weisbach)',
      'Pipe Network Analysis',
      'Hardy Cross Method',
      'Stormwater Drainage Design',
      'Hydraulic Jump Analysis',
      'Pump Selection & Sizing',
      'Water Hammer Analysis',
    ],
    stats: [
      { label: 'Calculators', value: '10+' },
      { label: 'Methods', value: 'FEM/HEC' },
      { label: 'Network', value: 'Real-time' },
    ],
  },
  {
    id: 'construction',
    label: 'Construction Management',
    description:
      'Project scheduling (CPM/PERT), resource allocation, cost estimation, quality management, and site safety planning with AI-powered risk prediction.',
    icon: HardHat,
    gradient: 'from-violet-500 to-purple-600',
    shadowColor: 'shadow-violet-500/20',
    route: '/civil/construction',
    status: 'active',
    capabilities: [
      'CPM/PERT Scheduling',
      'Resource Leveling',
      'Cost Estimation (BOQ)',
      'Earned Value Analysis',
      'Risk Assessment Matrix',
      'Quality Control Plans',
      'Safety Compliance',
      'Progress Tracking',
    ],
    stats: [
      { label: 'Tools', value: '12' },
      { label: 'Templates', value: '25+' },
      { label: 'Reports', value: 'Auto' },
    ],
  },
  {
    id: 'surveying',
    label: 'Surveying & GIS',
    description:
      'Topographic surveys, coordinate transformations, area/volume computations, GIS data integration, and drone-assisted site mapping.',
    icon: MapPin,
    gradient: 'from-emerald-500 to-green-600',
    shadowColor: 'shadow-emerald-500/20',
    route: '/civil/surveying',
    status: 'coming-soon',
    badge: 'Coming Soon',
    capabilities: [
      'Coordinate Geometry (COGO)',
      'Leveling & Traverse',
      'Area & Volume Calculation',
      'Contour Generation',
      'GIS Data Import/Export',
      'Drone Survey Processing',
      'Point Cloud Analysis',
      'Datum Transformations',
    ],
  },
  {
    id: 'environmental',
    label: 'Environmental Engineering',
    description:
      'Environmental impact assessment, wastewater treatment design, air quality modeling, solid waste management, and sustainability analysis.',
    icon: Leaf,
    gradient: 'from-lime-500 to-emerald-600',
    shadowColor: 'shadow-lime-500/20',
    route: '/civil/environmental',
    status: 'coming-soon',
    badge: 'Coming Soon',
    capabilities: [
      'EIA Report Generation',
      'Wastewater Treatment Design',
      'BOD/COD Analysis',
      'Air Quality Dispersion',
      'Noise Mapping',
      'Carbon Footprint Calculator',
      'Green Building Assessment',
      'Waste Management Plans',
    ],
  },
];

const RECENT_ACTIVITY = [
  { action: 'Bearing capacity check completed', module: 'Geotechnical', time: '2 hours ago', icon: Mountain },
  { action: 'Pipe network analyzed (12 nodes)', module: 'Hydraulics', time: '5 hours ago', icon: Droplets },
  { action: 'Road alignment exported', module: 'Transportation', time: '1 day ago', icon: Truck },
  { action: 'CPM schedule updated', module: 'Construction', time: '2 days ago', icon: HardHat },
];

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function CivilDesignHubPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Civil Design Hub | BeamLab';
  }, []);

  const filteredDisciplines = useMemo(() => {
    if (!searchQuery.trim()) return DISCIPLINES;
    const q = searchQuery.toLowerCase();
    return DISCIPLINES.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.capabilities.some((c) => c.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  const activeCount = DISCIPLINES.filter((d) => d.status === 'active').length;
  const totalCapabilities = DISCIPLINES.reduce((sum, d) => sum + d.capabilities.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Hero Banner */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 via-blue-700/90 to-cyan-600/90" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudy5vcmcvMjAwMC9zdmciPjxnIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+PGcgZmlsbD0iI2ZmZmZmZiIgZmlsbC1vcGFjaXR5PSIwLjA1Ij48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYyaDR2MmgtNHptMC0zMGgydjJoLTJ2LTJ6bS0yIDZoMnYyaC0ydi0yem0tNiA2aDJ2MmgtMnYtMnptMTIgMGgydjJoLTJ2LTJ6bS02IDZoMnYyaC0ydi0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />

        <div className="relative max-w-7xl mx-auto px-6 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 text-white/90 text-xs font-medium mb-6">
              <Compass className="w-3 h-3" />
              {activeCount} Active Disciplines • {totalCapabilities}+ Design Checks
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
              Civil Design{' '}
              <span className="bg-gradient-to-r from-cyan-300 to-blue-200 bg-clip-text text-transparent">
                Hub
              </span>
            </h1>
            <p className="text-sm sm:text-base text-blue-100/80 max-w-xl mx-auto mb-8 leading-relaxed">
              Unified engineering platform for geotechnical, transportation, hydraulic, and
              construction analysis — all powered by AI and connected in one workspace.
            </p>

            {/* Search */}
            <div className="max-w-md mx-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search disciplines, tools, or capabilities…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/40 text-sm outline-none focus:ring-2 focus:ring-cyan-300/40 focus:bg-white/15 transition-all"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Discipline Cards Grid */}
      <div className="max-w-7xl mx-auto px-6 -mt-8 relative z-10 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredDisciplines.map((discipline, index) => {
            const Icon = discipline.icon;
            const isActive = discipline.status === 'active';
            const isHovered = hoveredId === discipline.id;

            return (
              <motion.div
                key={discipline.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                onMouseEnter={() => setHoveredId(discipline.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer ${
                  isActive
                    ? `border-slate-200/50 dark:border-slate-700/30 hover:border-blue-300/50 dark:hover:border-blue-500/30 hover:shadow-xl ${discipline.shadowColor}`
                    : 'border-dashed border-slate-300/50 dark:border-slate-600/30 opacity-80'
                }`}
                onClick={() => isActive && navigate(discipline.route)}
                role="button"
                tabIndex={0}
                aria-label={`${discipline.label}${isActive ? '' : ' — Coming Soon'}`}
                onKeyDown={(e) => e.key === 'Enter' && isActive && navigate(discipline.route)}
              >
                {/* Badge */}
                {discipline.badge && (
                  <div
                    className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      discipline.badge === 'Coming Soon'
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        : discipline.badge === 'Popular'
                          ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          : 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300'
                    }`}
                  >
                    {discipline.badge === 'Coming Soon' && <Lock className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />}
                    {discipline.badge === 'Popular' && <Star className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />}
                    {discipline.badge === 'AI-Enhanced' && <Sparkles className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />}
                    {discipline.badge}
                  </div>
                )}

                <div className="p-5">
                  {/* Icon + Title */}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${discipline.gradient} flex items-center justify-center shadow-lg ${discipline.shadowColor} flex-shrink-0`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                        {discipline.label}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {discipline.description}
                      </p>
                    </div>
                  </div>

                  {/* Stats Row */}
                  {discipline.stats && (
                    <div className="flex gap-3 mb-3">
                      {discipline.stats.map((stat) => (
                        <div key={stat.label} className="text-center">
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{stat.value}</div>
                          <div className="text-[9px] text-slate-400">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Capabilities Tags */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {discipline.capabilities.slice(0, isHovered ? 6 : 3).map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-0.5 rounded-md text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/30"
                      >
                        {cap}
                      </span>
                    ))}
                    {discipline.capabilities.length > (isHovered ? 6 : 3) && (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-medium text-slate-400">
                        +{discipline.capabilities.length - (isHovered ? 6 : 3)} more
                      </span>
                    )}
                  </div>

                  {/* CTA */}
                  <div
                    className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {isActive ? (
                      <>
                        Enter Module
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" />
                        Available Soon
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/30 p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Recent Engineering Activity</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {RECENT_ACTIVITY.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/30"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">{item.action}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-blue-500 font-medium">{item.module}</span>
                      <span className="text-[9px] text-slate-400">•</span>
                      <span className="text-[9px] text-slate-400">{item.time}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
