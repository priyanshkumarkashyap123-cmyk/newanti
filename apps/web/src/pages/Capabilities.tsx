/**
 * Capabilities.tsx - Feature Grid Component
 * 
 * Displays all website capabilities in a beautiful grid layout
 * with category filtering, glassmorphism card design, and
 * clickable navigation to specific app sections.
 */

import { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import {
    Sparkles,
    Brain,
    Zap,
    BarChart3,
    FileText,
    Shield,
    Ruler,
    Calculator,
    Wind,
    Building2,
    Layers,
    GitBranch,
    Target,
    Workflow,
    Download,
    Globe,
    Code2,
    Cpu,
    ArrowRight,
    LucideIcon,
    Play,
    ExternalLink,
    CheckCircle,
    ArrowLeft,
    Table2,
    Grid3X3,
    Database,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

type Category = 'all' | 'ai' | 'analysis' | 'design' | 'reporting';

interface Feature {
    title: string;
    description: string;
    icon: LucideIcon;
    category: Category;
    color: string;
    bgColor: string;
    route: string;
    routeLabel: string;
    available: boolean;
}

// ============================================
// FEATURE DATA
// ============================================

const FEATURES: Feature[] = [
    // AI & Automation
    {
        title: "AI Architect",
        description: "Text-to-BIM generation. Describe your structure in plain English and watch it materialize.",
        icon: Sparkles,
        category: 'ai',
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
        route: "/app?mode=ai&tool=architect",
        routeLabel: "Launch AI Architect",
        available: true
    },
    {
        title: "Smart Templates",
        description: "50+ parametric templates for beams, trusses, frames generated mathematically on-demand.",
        icon: Brain,
        category: 'ai',
        color: "text-violet-500",
        bgColor: "bg-violet-500/10",
        route: "/app?mode=modeling&panel=templates",
        routeLabel: "Browse Templates",
        available: true
    },
    {
        title: "Auto Load Combinations",
        description: "Automatically generate code-compliant load combinations per ASCE 7, IS 875, or Eurocode.",
        icon: Zap,
        category: 'ai',
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
        route: "/app?mode=loading&tool=combinations",
        routeLabel: "Generate Combinations",
        available: true
    },
    {
        title: "Design Optimization",
        description: "AI-powered section optimization to minimize weight while meeting code requirements.",
        icon: Target,
        category: 'ai',
        color: "text-pink-500",
        bgColor: "bg-pink-500/10",
        route: "/app?mode=design&tool=optimizer",
        routeLabel: "Start Optimization",
        available: true
    },

    // Analysis
    {
        title: "Linear Static Analysis",
        description: "Fast finite element solver for displacement, reactions, and internal forces.",
        icon: BarChart3,
        category: 'analysis',
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        route: "/app?mode=analysis&type=static",
        routeLabel: "Run Static Analysis",
        available: true
    },
    {
        title: "Modal Analysis",
        description: "Extract natural frequencies and mode shapes for dynamic behavior assessment.",
        icon: Workflow,
        category: 'analysis',
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
        route: "/app?mode=analysis&type=modal",
        routeLabel: "Run Modal Analysis",
        available: true
    },
    {
        title: "P-Delta Analysis",
        description: "Second-order geometric nonlinearity for slender structures and stability checks.",
        icon: GitBranch,
        category: 'analysis',
        color: "text-teal-500",
        bgColor: "bg-teal-500/10",
        route: "/app?mode=analysis&type=pdelta",
        routeLabel: "Run P-Delta Analysis",
        available: true
    },
    {
        title: "Response Spectrum",
        description: "Seismic analysis using code-defined response spectra (IS 1893, ASCE 7, EC8).",
        icon: Zap,
        category: 'analysis',
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
        route: "/app?mode=analysis&type=spectrum",
        routeLabel: "Run Seismic Analysis",
        available: true
    },

    // Design Codes
    {
        title: "Steel Design (IS 800)",
        description: "Comprehensive steel member checks per IS 800:2007 with utilization ratios.",
        icon: Ruler,
        category: 'design',
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        route: "/app?mode=design&code=is800",
        routeLabel: "Open IS 800 Design",
        available: true
    },
    {
        title: "Steel Design (AISC 360)",
        description: "American steel design checks for W-shapes, HSS, and angles per AISC 360-16.",
        icon: Shield,
        category: 'design',
        color: "text-indigo-500",
        bgColor: "bg-indigo-500/10",
        route: "/app?mode=design&code=aisc360",
        routeLabel: "Open AISC 360 Design",
        available: true
    },
    {
        title: "Concrete Design (ACI 318)",
        description: "Reinforced concrete beam and column design with rebar detailing.",
        icon: Building2,
        category: 'design',
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
        route: "/app?mode=design&code=aci318",
        routeLabel: "Open ACI 318 Design",
        available: true
    },
    {
        title: "Wind Load (IS 875)",
        description: "Automated wind pressure calculation based on terrain, height, and building shape.",
        icon: Wind,
        category: 'design',
        color: "text-sky-500",
        bgColor: "bg-sky-500/10",
        route: "/app?mode=loading&tool=wind",
        routeLabel: "Calculate Wind Loads",
        available: true
    },
    {
        title: "Seismic Load (IS 1893)",
        description: "Base shear and vertical distribution per IS 1893:2016 with zone factors.",
        icon: Zap,
        category: 'design',
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        route: "/app?mode=loading&tool=seismic",
        routeLabel: "Calculate Seismic Loads",
        available: true
    },
    {
        title: "Foundation Design",
        description: "Isolated and combined footing design with soil bearing capacity checks.",
        icon: Layers,
        category: 'design',
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
        route: "/app?mode=design&tool=foundation",
        routeLabel: "Design Foundation",
        available: true
    },
    {
        title: "Bar Bending Schedule",
        description: "IS 2502-compliant BBS generation for beams, columns, and slabs with cutting lengths and wastage.",
        icon: Table2,
        category: 'design',
        color: "text-teal-500",
        bgColor: "bg-teal-500/10",
        route: "/tools/bar-bending",
        routeLabel: "Generate BBS",
        available: true
    },
    {
        title: "Plate/Shell FEM Analysis",
        description: "2D finite element analysis for plates and shells with Kirchhoff, Mindlin-Reissner, DKT/DKQ formulations.",
        icon: Grid3X3,
        category: 'analysis',
        color: "text-violet-500",
        bgColor: "bg-violet-500/10",
        route: "/analysis/plate-shell",
        routeLabel: "Run Plate/Shell Analysis",
        available: true
    },
    {
        title: "Steel Section Database",
        description: "500+ steel sections across IS 808, AISC, and Eurocode standards with full properties.",
        icon: Database,
        category: 'design',
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
        route: "/tools/section-database",
        routeLabel: "Browse Sections",
        available: true
    },

    // Reporting
    {
        title: "PDF Reports",
        description: "Professional calculation reports with diagrams, tables, and code references.",
        icon: FileText,
        category: 'reporting',
        color: "text-rose-500",
        bgColor: "bg-rose-500/10",
        route: "/reports",
        routeLabel: "View Reports",
        available: true
    },
    {
        title: "DXF Export",
        description: "Export your model to AutoCAD-compatible DXF format for documentation.",
        icon: Download,
        category: 'reporting',
        color: "text-fuchsia-500",
        bgColor: "bg-fuchsia-500/10",
        route: "/app?export=dxf",
        routeLabel: "Export DXF",
        available: true
    },
    {
        title: "API Access",
        description: "REST API for integration with your existing workflows and automation scripts.",
        icon: Code2,
        category: 'reporting',
        color: "text-lime-500",
        bgColor: "bg-lime-500/10",
        route: "/help#api",
        routeLabel: "View API Docs",
        available: true
    },
    {
        title: "Cloud Sync",
        description: "Real-time collaboration with automatic cloud backup and version history.",
        icon: Globe,
        category: 'reporting',
        color: "text-blue-400",
        bgColor: "bg-blue-400/10",
        route: "/dashboard",
        routeLabel: "Open Dashboard",
        available: true
    }
];

// ============================================
// FILTER TABS
// ============================================

const CATEGORIES: { id: Category; label: string }[] = [
    { id: 'all', label: 'All Features' },
    { id: 'ai', label: 'AI & Automation' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'design', label: 'Design Codes' },
    { id: 'reporting', label: 'Reporting' }
];

// ============================================
// FEATURE CARD COMPONENT
// ============================================

interface FeatureCardProps {
    feature: Feature;
    index: number;
}

const FeatureCard: FC<FeatureCardProps> = ({ feature, index }) => {
    const Icon = feature.icon;
    const navigate = useNavigate();

    const handleClick = () => {
        navigate(feature.route);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
                duration: 0.4,
                delay: index * 0.05,
                ease: [0.25, 0.1, 0.25, 1]
            }}
            onClick={handleClick}
            className="group relative cursor-pointer"
        >
            <div className="
                bg-white dark:bg-zinc-900/50 backdrop-blur-md
                border border-zinc-200 dark:border-zinc-800 hover:border-blue-500/50
                rounded-2xl p-6
                transition-all duration-300
                hover:shadow-lg hover:shadow-blue-500/10
                hover:-translate-y-1
                h-full flex flex-col
            ">
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                    {feature.available ? (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                            <CheckCircle className="w-3 h-3" />
                            Available
                        </span>
                    ) : (
                        <span className="px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
                            Coming Soon
                        </span>
                    )}
                </div>

                {/* Icon */}
                <div className={`
                    ${feature.bgColor} ${feature.color}
                    w-12 h-12 rounded-full
                    flex items-center justify-center
                    mb-4
                    ring-4 ring-transparent
                    group-hover:ring-current/20
                    transition-all duration-300
                `}>
                    <Icon className="w-6 h-6" />
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2 pr-20">
                    {feature.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed flex-grow">
                    {feature.description}
                </p>

                {/* Launch Button */}
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/50">
                    <div className={`
                        flex items-center justify-between
                        ${feature.color}
                        group-hover:translate-x-1
                        transition-transform duration-300
                    `}>
                        <span className="text-sm font-semibold">{feature.routeLabel}</span>
                        <div className={`
                            ${feature.bgColor}
                            p-2 rounded-full
                            group-hover:scale-110
                            transition-transform duration-300
                        `}>
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ============================================
// MAIN CAPABILITIES COMPONENT
// ============================================

export const Capabilities: FC = () => {
    const [activeCategory, setActiveCategory] = useState<Category>('all');
    const navigate = useNavigate();

    // Filter features
    const filteredFeatures = activeCategory === 'all'
        ? FEATURES
        : FEATURES.filter(f => f.category === activeCategory);

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950">
            {/* Navigation Header */}
            <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white">BeamLab Ultimate</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link to="/pricing" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-sm font-medium transition-colors">
                            Pricing
                        </Link>
                        <Link to="/help" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-sm font-medium transition-colors">
                            Help
                        </Link>
                        <button
                            onClick={() => navigate('/app')}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors"
                        >
                            <Play className="w-4 h-4" />
                            Open App
                        </button>
                    </div>
                </div>
            </header>

            <div className="py-20 px-4">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-12"
                    >
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-sm mb-6 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Home
                        </Link>
                        <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4">
                            Engineering{' '}
                            <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                                Superpowers
                            </span>
                        </h2>
                        <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto">
                            Click any feature to jump directly into the tool.
                            Powered by AI and built for speed.
                        </p>
                    </motion.div>

                    {/* Filter Tabs */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex flex-wrap justify-center gap-2 mb-12"
                    >
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`
                                    px-5 py-2.5 rounded-full text-sm font-medium
                                    transition-all duration-300
                                    ${activeCategory === cat.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                        : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
                                    }
                                `}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </motion.div>

                    {/* Feature Grid */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeCategory}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {filteredFeatures.map((feature, index) => (
                                <FeatureCard
                                    key={feature.title}
                                    feature={feature}
                                    index={index}
                                />
                            ))}
                        </motion.div>
                    </AnimatePresence>

                    {/* Bottom CTA */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-center mt-16"
                    >
                        <p className="text-zinc-500 dark:text-zinc-400 mb-4">Ready to supercharge your workflow?</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={() => navigate('/app')}
                                className="
                                    px-8 py-3 
                                    bg-gradient-to-r from-blue-600 to-purple-600
                                    hover:from-blue-500 hover:to-purple-500
                                    text-white font-semibold rounded-full
                                    shadow-lg shadow-blue-600/30
                                    transition-all duration-300
                                    hover:scale-105
                                    flex items-center justify-center gap-2
                                "
                            >
                                <Play className="w-5 h-5" />
                                Start Modeling Now
                            </button>
                            <Link
                                to="/pricing"
                                className="
                                    px-8 py-3 
                                    bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700
                                    text-zinc-900 dark:text-white font-semibold rounded-full
                                    border border-zinc-300 dark:border-zinc-700
                                    transition-all duration-300
                                    flex items-center justify-center gap-2
                                "
                            >
                                View Pricing
                                <ExternalLink className="w-4 h-4" />
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default Capabilities;
