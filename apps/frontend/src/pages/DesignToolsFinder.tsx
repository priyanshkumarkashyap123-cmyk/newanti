/**
 * ============================================================================
 * DESIGN TOOLS FINDER - UNIFIED DISCOVERY & NAVIGATION
 * ============================================================================
 * 
 * Intelligent design tool discovery interface that helps users find and access
 * the right design tool based on:
 * - Project type
 * - Member type
 * - Material
 * - Design code/standard
 * - Quick access to recent tools
 * 
 * @version 1.0.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Clock,
  Star,
  ArrowRight,
  Grid3X3,
  List,
  Home,
  Zap,
  TrendingUp,
  BookOpen,
  Truck,
  RotateCw,
  Mountain,
  Layers,
  Wrench,
  Database,
  Cable,
  Boxes,
  AlertCircle,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import styles from '../styles/design-page.module.css';

interface DesignTool {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  route: string;
  codes: string[];
  memberType: string[];
  material: string[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
  tags: string[];
  status: 'new' | 'beta' | 'stable';
  color: string;
  gradient: string;
}

// Helper component for Square icon
const Square: React.FC<{ className: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
  </svg>
);

const DESIGN_TOOLS: DesignTool[] = [
  // ── RC DESIGN ──
  {
    id: 'beam',
    name: 'Beam Design',
    description: 'Flexural, shear, torsion, and deflection design for RC beams',
    category: 'RC Design',
    icon: <Boxes className="w-6 h-6" />,
    route: '/design/concrete?section=beam',
    codes: ['IS 456', 'ACI 318', 'EN 1992'],
    memberType: ['Beam'],
    material: ['RC'],
    difficulty: 'intermediate',
    tags: ['flexure', 'shear', 'torsion', 'deflection'],
    status: 'stable',
    color: '#3b82f6',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'column',
    name: 'Column Design',
    description: 'P-M interaction, slenderness, biaxial bending for RC columns',
    category: 'RC Design',
    icon: <Layers className="w-6 h-6" />,
    route: '/design/concrete?section=column',
    codes: ['IS 456', 'ACI 318', 'EN 1992'],
    memberType: ['Column'],
    material: ['RC'],
    difficulty: 'intermediate',
    tags: ['p-m interaction', 'biaxial', 'slenderness'],
    status: 'stable',
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'slab',
    name: 'Slab Design',
    description: 'One-way, two-way, and flat slab design per IS 456 / ACI 318',
    category: 'RC Design',
    icon: <Square className="w-6 h-6" />,
    route: '/design/concrete?section=slab',
    codes: ['IS 456', 'ACI 318', 'EN 1992'],
    memberType: ['Slab'],
    material: ['RC'],
    difficulty: 'basic',
    tags: ['one-way', 'two-way', 'flat-slab'],
    status: 'stable',
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-teal-500',
  },
  {
    id: 'torsion',
    name: 'Torsion Design',
    description: 'St. Venant and warping torsion with P-M-T interaction',
    category: 'RC Design',
    icon: <RotateCw className="w-6 h-6" />,
    route: '/design/torsion',
    codes: ['IS 456', 'ACI 318'],
    memberType: ['Beam'],
    material: ['RC'],
    difficulty: 'advanced',
    tags: ['torsion', 'pmt-interaction', 'skew-bending'],
    status: 'new',
    color: '#f97316',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    id: 'staircase',
    name: 'Staircase Design',
    description: 'Dog-legged and open-well staircase design (IS 456 Cl. 34)',
    category: 'RC Design',
    icon: <Layers className="w-6 h-6" />,
    route: '/design/staircase',
    codes: ['IS 456'],
    memberType: ['Staircase'],
    material: ['RC'],
    difficulty: 'intermediate',
    tags: ['dog-legged', 'open-well', 'landing'],
    status: 'new',
    color: '#a855f7',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    id: 'retaining-wall',
    name: 'Retaining Wall',
    description: 'Cantilever and counterfort wall design with stability checks',
    category: 'Geotechnical',
    icon: <Mountain className="w-6 h-6" />,
    route: '/design/retaining-wall',
    codes: ['IS 456', 'IS 3370'],
    memberType: ['Wall'],
    material: ['RC'],
    difficulty: 'intermediate',
    tags: ['cantilever', 'counterfort', 'stability', 'earth-pressure'],
    status: 'new',
    color: '#b45309',
    gradient: 'from-amber-600 to-orange-600',
  },
  {
    id: 'footing',
    name: 'Footing Design',
    description: 'Isolated, combined, and raft foundation design',
    category: 'Foundation',
    icon: <Boxes className="w-6 h-6" />,
    route: '/design/foundation?section=footing',
    codes: ['IS 456', 'ACI 318'],
    memberType: ['Footing'],
    material: ['RC'],
    difficulty: 'intermediate',
    tags: ['isolated', 'combined', 'raft'],
    status: 'stable',
    color: '#84cc16',
    gradient: 'from-lime-500 to-green-500',
  },

  // ── BRIDGE DESIGN ──
  {
    id: 'moving-load',
    name: 'Moving Load Analysis',
    description: 'Vehicle load envelopes for bridges (IRC, AASHTO, Eurocode)',
    category: 'Bridge Design',
    icon: <Truck className="w-6 h-6" />,
    route: '/design/moving-load',
    codes: ['IRC 6:2017', 'AASHTO', 'EN 1991-2'],
    memberType: ['Bridge deck', 'Girder'],
    material: ['RC', 'Steel'],
    difficulty: 'intermediate',
    tags: ['vehicle-load', 'envelope', 'critical-positions'],
    status: 'new',
    color: '#0284c7',
    gradient: 'from-sky-500 to-blue-500',
  },

  // ── STEEL DESIGN ──
  {
    id: 'steel-member',
    name: 'Steel Member Design',
    description: 'Flexure, compression, tension, and combined stresses (IS 800)',
    category: 'Steel Design',
    icon: <Database className="w-6 h-6" />,
    route: '/design/steel',
    codes: ['IS 800', 'AISC 360'],
    memberType: ['Column', 'Beam', 'Tier'],
    material: ['Steel'],
    difficulty: 'intermediate',
    tags: ['flexure', 'compression', 'buckling'],
    status: 'stable',
    color: '#64748b',
    gradient: 'from-slate-500 to-gray-600',
  },
  {
    id: 'connection',
    name: 'Connection Design',
    description: 'Bolted and welded connection design per codes',
    category: 'Steel Design',
    icon: <Wrench className="w-6 h-6" />,
    route: '/design/connections',
    codes: ['IS 800', 'AISC 360'],
    memberType: ['Connection'],
    material: ['Steel'],
    difficulty: 'advanced',
    tags: ['bolted', 'welded', 'moment-connection'],
    status: 'stable',
    color: '#7c3aed',
    gradient: 'from-violet-500 to-purple-600',
  },

  // ── ANALYSIS TOOLS ──
  {
    id: 'analysis-static',
    name: 'Static Analysis',
    description: '3D frame analysis with automated load combinations',
    category: 'Analysis',
    icon: <Zap className="w-6 h-6" />,
    route: '/app?section=analysis',
    codes: ['IS 456', 'IS 875'],
    memberType: ['All'],
    material: ['RC', 'Steel', 'Timber'],
    difficulty: 'intermediate',
    tags: ['linear', 'load-case', '3d-frame'],
    status: 'stable',
    color: '#22c55e',
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    id: 'analysis-modal',
    name: 'Modal Analysis',
    description: 'Eigenvalue analysis for natural frequencies and modes',
    category: 'Analysis',
    icon: <TrendingUp className="w-6 h-6" />,
    route: '/app?section=modal',
    codes: ['IS 1893'],
    memberType: ['All'],
    material: ['RC', 'Steel'],
    difficulty: 'advanced',
    tags: ['frequencies', 'modal-shapes', 'participation'],
    status: 'stable',
    color: '#ec4899',
    gradient: 'from-pink-500 to-rose-500',
  },
];

export const DesignToolsFinder: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Get unique categories, codes, difficulty levels
  const categories = useMemo(() => [...new Set(DESIGN_TOOLS.map((t) => t.category))], []);
  const codes = useMemo(() => [...new Set(DESIGN_TOOLS.flatMap((t) => t.codes))].sort(), []);
  const difficulties = ['basic', 'intermediate', 'advanced'];

  // Filter tools
  const filteredTools = useMemo(() => {
    return DESIGN_TOOLS.filter((tool) => {
      const matchesSearch =
        searchQuery === '' ||
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === null || tool.category === selectedCategory;
      const matchesDifficulty = selectedDifficulty === null || tool.difficulty === selectedDifficulty;
      const matchesCode = selectedCode === null || tool.codes.includes(selectedCode);

      return matchesSearch && matchesCategory && matchesDifficulty && matchesCode;
    });
  }, [searchQuery, selectedCategory, selectedDifficulty, selectedCode]);

  const handleToolClick = (tool: DesignTool) => {
    navigate(tool.route);
  };

  return (
    <div className={styles['design-page']} style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 px-6 py-4 shadow-sm"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/app')}
                className="mr-2"
              >
                <Home className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Design Tools</h1>
                <p className="text-sm text-gray-600">
                  {filteredTools.length} of {DESIGN_TOOLS.length} tools available
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="gap-2"
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
            </Button>
          </div>

          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search tools, codes, materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full bg-white"
              />
            </div>
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-b border-gray-200 px-6 py-4"
          >
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Category Filter */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Category</p>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        selectedCategory === null ? 'bg-blue-100 text-blue-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      All Categories
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`w-full text-left px-3 py-2 rounded text-sm ${
                          selectedCategory === cat ? 'bg-blue-100 text-blue-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code Filter */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Design Code</p>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedCode(null)}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        selectedCode === null ? 'bg-blue-100 text-blue-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      All Codes
                    </button>
                    {codes.map((code) => (
                      <button
                        key={code}
                        onClick={() => setSelectedCode(code)}
                        className={`w-full text-left px-3 py-2 rounded text-sm truncate ${
                          selectedCode === code ? 'bg-blue-100 text-blue-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty Filter */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Difficulty</p>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedDifficulty(null)}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        selectedDifficulty === null ? 'bg-blue-100 text-blue-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      All Levels
                    </button>
                    {difficulties.map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setSelectedDifficulty(diff)}
                        className={`w-full text-left px-3 py-2 rounded text-sm capitalize ${
                          selectedDifficulty === diff ? 'bg-blue-100 text-blue-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear All Button */}
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory(null);
                      setSelectedDifficulty(null);
                      setSelectedCode(null);
                    }}
                    className="w-full"
                  >
                    Clear All Filters
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tools Grid/List */}
      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {filteredTools.length > 0 ? (
            <motion.div
              layout
              className={`grid gap-6 ${
                viewMode === 'grid'
                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-1'
              }`}
            >
              {filteredTools.map((tool, idx) => (
                <motion.div
                  key={tool.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleToolClick(tool)}
                  className="cursor-pointer group"
                >
                  <div
                    className={`relative h-full rounded-lg border-2 border-gray-200 p-6 transition-all hover:border-gray-400 hover:shadow-lg bg-white overflow-hidden`}
                  >
                    {/* Background gradient accent */}
                    <div
                      className="absolute inset-0 opacity-5"
                      style={{ background: `linear-gradient(135deg, ${tool.color}, ${tool.color}99)` }}
                    />

                    {/* Content */}
                    <div className="relative z-10">
                      {/* Header with Icon and Badge */}
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-white"
                          style={{ background: `linear-gradient(135deg, ${tool.color}, #333)` }}
                        >
                          {tool.icon}
                        </div>
                        <div className="flex gap-2">
                          {tool.status === 'new' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <Zap className="w-3 h-3" />
                              New
                            </span>
                          )}
                          {tool.status === 'beta' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                              Beta
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title and Description */}
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {tool.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{tool.description}</p>

                      {/* Category and Difficulty */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {tool.category}
                        </span>
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            tool.difficulty === 'basic'
                              ? 'bg-green-100 text-green-700'
                              : tool.difficulty === 'intermediate'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {tool.difficulty.charAt(0).toUpperCase() + tool.difficulty.slice(1)}
                        </span>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {tool.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="inline-block px-2 py-1 rounded text-xs text-gray-600 bg-gray-50 border border-gray-200">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {/* Codes */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {tool.codes.map((code) => (
                          <span key={code} className="inline-block px-2 py-1 rounded text-xs font-medium text-gray-700 bg-blue-50 border border-blue-200">
                            {code}
                          </span>
                        ))}
                      </div>

                      {/* CTA Button */}
                      <Button
                        onClick={() => handleToolClick(tool)}
                        className="w-full gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold mt-4 group-hover:shadow-lg transition-all"
                      >
                        Open Tool
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No tools found</h3>
              <p className="text-gray-600">Try adjusting your filters or search query</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};



export default DesignToolsFinder;
