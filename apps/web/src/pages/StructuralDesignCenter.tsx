/**
 * ============================================================================
 * STRUCTURAL DESIGN CENTER - UNIFIED UI
 * ============================================================================
 * 
 * Complete structural engineering design interface combining all modules:
 * - RC Design (Beams, Columns, Slabs, Footings)
 * - Steel Design (Members, Connections)
 * - Bridge Design (Deck, Substructure)
 * - Foundation Design
 * - Analysis Tools
 * 
 * @version 1.0.0
 * @author Head of Engineering
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  // Icons
  Calculator,
  Box,
  Columns,
  Layers,
  Building2,
  Boxes,
  Grid3X3,
  Activity,
  Wind,
  Mountain,
  Cable,
  Anchor,
  Ruler,
  FileText,
  Settings,
  ChevronRight,
  ChevronDown,
  Search,
  Star,
  Clock,
  TrendingUp,
  Download,
  Share2,
  BookOpen,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Zap,
  Shield,
  RefreshCw,
  ArrowLeft,
  Home,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import RC Design Components
import RCBeamDesigner from '@/components/rc-design/RCBeamDesigner';
import RCColumnDesigner from '@/components/rc-design/RCColumnDesigner';
import RCSlabDesigner from '@/components/rc-design/RCSlabDesigner';
import RCFootingDesigner from '@/components/rc-design/RCFootingDesigner';

// Import Steel Design Components
import SteelMemberDesigner from '@/components/steel-design/SteelMemberDesigner';
import PrestressedDesigner from '@/components/rc-design/PrestressedDesigner';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type DesignModule = 
  | 'dashboard'
  | 'rc-beam' 
  | 'rc-column' 
  | 'rc-slab' 
  | 'rc-footing'
  | 'rc-prestressed'
  | 'rc-retaining-wall'
  | 'rc-staircase'
  | 'steel-member'
  | 'steel-connection'
  | 'steel-base-plate'
  | 'bridge-deck'
  | 'bridge-pier'
  | 'foundation'
  | 'cable-design'
  | 'analysis';

interface NavCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  gradient: string;
  items: NavItem[];
}

interface NavItem {
  id: DesignModule;
  label: string;
  description: string;
  codes: string[];
  badge?: 'new' | 'beta' | 'pro';
}

interface RecentProject {
  id: string;
  name: string;
  module: DesignModule;
  timestamp: Date;
  status: 'safe' | 'warning' | 'unsafe';
}

// =============================================================================
// NAVIGATION CONFIG
// =============================================================================

const NAVIGATION: NavCategory[] = [
  {
    id: 'concrete',
    label: 'RC Design',
    icon: Box,
    color: '#3b82f6',
    gradient: 'from-blue-500 to-cyan-500',
    items: [
      { id: 'rc-beam', label: 'Beam Design', description: 'Flexure, shear, torsion, deflection', codes: ['IS 456', 'ACI 318', 'EN 1992'] },
      { id: 'rc-column', label: 'Column Design', description: 'P-M interaction, slenderness, biaxial', codes: ['IS 456', 'ACI 318', 'EN 1992'] },
      { id: 'rc-slab', label: 'Slab Design', description: 'One-way, two-way, flat slabs', codes: ['IS 456', 'ACI 318', 'EN 1992'] },
      { id: 'rc-footing', label: 'Footing Design', description: 'Isolated, combined, raft', codes: ['IS 456', 'ACI 318'], badge: 'new' },
      { id: 'rc-prestressed', label: 'Prestressed Concrete', description: 'Pre/post-tensioned design', codes: ['IS 1343', 'ACI 318'], badge: 'pro' },
      { id: 'rc-retaining-wall', label: 'Retaining Wall', description: 'Cantilever, counterfort walls', codes: ['IS 456', 'IS 3370'], badge: 'new' },
      { id: 'rc-staircase', label: 'Staircase Design', description: 'Dog-legged, open-well stairs', codes: ['IS 456'], badge: 'new' },
    ],
  },
  {
    id: 'steel',
    label: 'Steel Design',
    icon: Columns,
    color: '#f97316',
    gradient: 'from-orange-500 to-amber-500',
    items: [
      { id: 'steel-member', label: 'Member Design', description: 'Tension, compression, beam-column', codes: ['IS 800', 'AISC 360', 'EN 1993'] },
      { id: 'steel-connection', label: 'Connections', description: 'Bolted and welded joints', codes: ['IS 800', 'AISC 360'] },
      { id: 'steel-base-plate', label: 'Base Plate', description: 'Column base connections', codes: ['IS 800', 'AISC 360'], badge: 'beta' },
    ],
  },
  {
    id: 'bridge',
    label: 'Bridge Design',
    icon: Building2,
    color: '#8b5cf6',
    gradient: 'from-purple-500 to-violet-500',
    items: [
      { id: 'bridge-deck', label: 'Deck & Girder', description: 'Slab, composite, box girders', codes: ['AASHTO', 'EN 1991-2'], badge: 'pro' },
      { id: 'bridge-pier', label: 'Substructure', description: 'Piers, abutments, bearings', codes: ['AASHTO', 'EN 1998-2'], badge: 'pro' },
    ],
  },
  {
    id: 'foundation',
    label: 'Foundation',
    icon: Mountain,
    color: '#10b981',
    gradient: 'from-emerald-500 to-teal-500',
    items: [
      { id: 'foundation', label: 'Foundation Design', description: 'Bearing capacity, settlement, piles', codes: ['IS 6403', 'IS 2911', 'EN 1997'] },
    ],
  },
  {
    id: 'cable',
    label: 'Cable & Suspension',
    icon: Cable,
    color: '#ec4899',
    gradient: 'from-pink-500 to-rose-500',
    items: [
      { id: 'cable-design', label: 'Cable Design', description: 'Stay cables, suspension systems', codes: ['PTI', 'fib'], badge: 'pro' },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: Activity,
    color: '#6366f1',
    gradient: 'from-indigo-500 to-purple-500',
    items: [
      { id: 'analysis', label: 'Structural Analysis', description: 'Matrix, FEM, modal, seismic', codes: ['IS 1893', 'ASCE 7', 'EN 1998'] },
    ],
  },
];

// =============================================================================
// COMPONENT: MAIN DESIGN CENTER
// =============================================================================

export default function StructuralDesignCenter() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeModule = (searchParams.get('module') as DesignModule) || 'dashboard';
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['concrete']);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Recent projects (mock data)
  const [recentProjects] = useState<RecentProject[]>(() => {
    const now = Date.now();
    return [
      { id: '1', name: 'Office Building Beam B1', module: 'rc-beam', timestamp: new Date(), status: 'safe' },
      { id: '2', name: 'Basement Column C12', module: 'rc-column', timestamp: new Date(now - 3600000), status: 'warning' },
      { id: '3', name: 'Terrace Slab S3', module: 'rc-slab', timestamp: new Date(now - 86400000), status: 'safe' },
    ];
  });
  
  // Toggle category expansion
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  }, []);
  
  // Navigate to module
  const navigateToModule = useCallback((moduleId: DesignModule) => {
    setSearchParams({ module: moduleId });
  }, [setSearchParams]);
  
  // Filter navigation by search
  const filteredNavigation = useMemo(() => {
    if (!searchQuery) return NAVIGATION;
    
    const query = searchQuery.toLowerCase();
    return NAVIGATION.map(category => ({
      ...category,
      items: category.items.filter(item => 
        item.label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.codes.some(code => code.toLowerCase().includes(query))
      )
    })).filter(category => category.items.length > 0);
  }, [searchQuery]);
  
  // Render active module content
  const renderModuleContent = () => {
    switch (activeModule) {
      case 'rc-beam':
        return <RCBeamDesigner />;
      case 'rc-column':
        return <RCColumnDesigner />;
      case 'rc-slab':
        return <RCSlabDesigner />;
      case 'rc-footing':
        return <RCFootingDesigner />;
      case 'rc-prestressed':
        return <PrestressedDesigner />;
      case 'steel-member':
        return <SteelMemberDesigner />;
      case 'dashboard':
      default:
        return <DashboardContent onNavigate={navigateToModule} recentProjects={recentProjects} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 bottom-0 z-40 bg-slate-800/95 backdrop-blur-xl border-r border-slate-700/50 transition-all duration-300",
        sidebarOpen ? "w-72" : "w-16"
      )}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700/50">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                <Calculator className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white">Design Center</h1>
                <p className="text-xs text-slate-400">Structural Engineering</p>
              </div>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5 text-slate-400" /> : <Menu className="w-5 h-5 text-slate-400" />}
          </button>
        </div>
        
        {/* Search */}
        {sidebarOpen && (
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
        )}
        
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          {/* Home Button */}
          <button
            onClick={() => navigateToModule('dashboard')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-2 transition-colors",
              activeModule === 'dashboard' 
                ? "bg-blue-500/20 text-blue-400" 
                : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
            )}
          >
            <Home className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Dashboard</span>}
          </button>
          
          {/* Categories */}
          {filteredNavigation.map((category) => (
            <div key={category.id} className="mb-2">
              <button
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                )}
              >
                <category.icon className="w-5 h-5 flex-shrink-0" style={{ color: category.color }} />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-sm font-medium text-left">{category.label}</span>
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform",
                      expandedCategories.includes(category.id) ? "rotate-0" : "-rotate-90"
                    )} />
                  </>
                )}
              </button>
              
              {/* Items */}
              <AnimatePresence>
                {sidebarOpen && expandedCategories.includes(category.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {category.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => navigateToModule(item.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 pl-11 rounded-lg transition-colors text-left",
                          activeModule === item.id 
                            ? "bg-slate-700/70 text-white" 
                            : "text-slate-400 hover:bg-slate-700/30 hover:text-slate-200"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm truncate">{item.label}</span>
                            {item.badge && (
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
                                item.badge === 'new' && "bg-emerald-500/20 text-emerald-400",
                                item.badge === 'beta' && "bg-amber-500/20 text-amber-400",
                                item.badge === 'pro' && "bg-purple-500/20 text-purple-400"
                              )}>
                                {item.badge}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>
        
        {/* Footer */}
        {sidebarOpen && (
          <div className="p-3 border-t border-slate-700/50">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>v4.0.0</span>
              <div className="flex items-center gap-2">
                <button className="hover:text-slate-300"><HelpCircle className="w-4 h-4" /></button>
                <button className="hover:text-slate-300"><Settings className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}
      </aside>
      
      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        sidebarOpen ? "ml-72" : "ml-16"
      )}>
        {/* Top Bar */}
        <header className="h-16 bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            {activeModule !== 'dashboard' && (
              <button
                onClick={() => navigateToModule('dashboard')}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </button>
            )}
            <h2 className="text-lg font-semibold text-white">
              {activeModule === 'dashboard' ? 'Structural Design Dashboard' : getModuleLabel(activeModule)}
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Docs
            </button>
            <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg text-sm text-white font-medium transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </header>
        
        {/* Module Content */}
        <div className="min-h-[calc(100vh-4rem)]">
          {renderModuleContent()}
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// COMPONENT: DASHBOARD CONTENT
// =============================================================================

function DashboardContent({ 
  onNavigate, 
  recentProjects 
}: { 
  onNavigate: (module: DesignModule) => void;
  recentProjects: RecentProject[];
}) {
  return (
    <div className="p-6 space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Design Codes"
          value="12+"
          subtitle="International codes supported"
          icon={Shield}
          color="blue"
        />
        <StatCard
          title="RC Modules"
          value="7"
          subtitle="Beam, column, slab, footing..."
          icon={Box}
          color="cyan"
        />
        <StatCard
          title="Steel Modules"
          value="3"
          subtitle="Member, connection, base plate"
          icon={Columns}
          color="orange"
        />
        <StatCard
          title="Analysis Tools"
          value="6"
          subtitle="Matrix, FEM, modal, seismic"
          icon={Activity}
          color="purple"
        />
      </div>
      
      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {NAVIGATION.slice(0, 3).map((category) => (
          <QuickAccessCard
            key={category.id}
            category={category}
            onSelect={onNavigate}
          />
        ))}
      </div>
      
      {/* Recent Projects */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            Recent Designs
          </h3>
          <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            View All
          </button>
        </div>
        
        <div className="space-y-3">
          {recentProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => onNavigate(project.module)}
              className="w-full flex items-center gap-4 p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-xl transition-colors"
            >
              <div className={cn(
                "p-2 rounded-lg",
                project.status === 'safe' && "bg-emerald-500/20",
                project.status === 'warning' && "bg-amber-500/20",
                project.status === 'unsafe' && "bg-red-500/20"
              )}>
                {project.status === 'safe' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                {project.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {project.status === 'unsafe' && <AlertTriangle className="w-5 h-5 text-red-400" />}
              </div>
              <div className="flex-1 text-left">
                <p className="text-white font-medium">{project.name}</p>
                <p className="text-sm text-slate-400">{getModuleLabel(project.module)}</p>
              </div>
              <span className="text-xs text-slate-400">
                {formatTimeAgo(project.timestamp)}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          ))}
        </div>
      </div>
      
      {/* All Modules Grid */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">All Design Modules</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {NAVIGATION.flatMap(category => 
            category.items.map(item => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="p-4 bg-slate-700/30 hover:bg-slate-700/50 rounded-xl transition-all hover:scale-105 text-left group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className={cn(
                      "px-1 py-0.5 rounded text-[9px] font-bold uppercase",
                      item.badge === 'new' && "bg-emerald-500/20 text-emerald-400",
                      item.badge === 'beta' && "bg-amber-500/20 text-amber-400",
                      item.badge === 'pro' && "bg-purple-500/20 text-purple-400"
                    )}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{item.description}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color 
}: { 
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-cyan-500/20 text-blue-400',
    cyan: 'from-cyan-500/20 to-teal-500/20 text-cyan-400',
    orange: 'from-orange-500/20 to-amber-500/20 text-orange-400',
    purple: 'from-purple-500/20 to-violet-500/20 text-purple-400',
  }[color] || 'from-slate-500/20 to-slate-400/20 text-slate-400';
  
  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        </div>
        <div className={cn("p-3 rounded-xl bg-gradient-to-br", colorClasses)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function QuickAccessCard({ 
  category, 
  onSelect 
}: { 
  category: NavCategory;
  onSelect: (module: DesignModule) => void;
}) {
  return (
    <div className={cn(
      "bg-gradient-to-br rounded-2xl p-[1px]",
      category.gradient
    )}>
      <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-5 h-full">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn("p-2 rounded-lg bg-gradient-to-br", category.gradient)}>
            <category.icon className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white">{category.label}</h3>
        </div>
        
        <div className="space-y-2">
          {category.items.slice(0, 4).map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/50 transition-colors group"
            >
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                {item.label}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            </button>
          ))}
        </div>
        
        {category.items.length > 4 && (
          <button className="w-full mt-3 text-sm text-slate-400 hover:text-white transition-colors">
            +{category.items.length - 4} more modules
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getModuleLabel(moduleId: DesignModule): string {
  const labels: Record<DesignModule, string> = {
    'dashboard': 'Dashboard',
    'rc-beam': 'RC Beam Design',
    'rc-column': 'RC Column Design',
    'rc-slab': 'RC Slab Design',
    'rc-footing': 'RC Footing Design',
    'rc-prestressed': 'Prestressed Concrete',
    'rc-retaining-wall': 'Retaining Wall Design',
    'rc-staircase': 'Staircase Design',
    'steel-member': 'Steel Member Design',
    'steel-connection': 'Steel Connection Design',
    'steel-base-plate': 'Base Plate Design',
    'bridge-deck': 'Bridge Deck Design',
    'bridge-pier': 'Bridge Substructure',
    'foundation': 'Foundation Design',
    'cable-design': 'Cable Design',
    'analysis': 'Structural Analysis',
  };
  return labels[moduleId] || moduleId;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
