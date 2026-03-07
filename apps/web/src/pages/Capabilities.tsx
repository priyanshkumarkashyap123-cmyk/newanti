/**
 * Capabilities.tsx - Feature Grid Component
 * 
 * Displays all website capabilities in a beautiful grid layout
 * with category filtering, glassmorphism card design, and
 * clickable navigation to specific app sections.
 */

import { FC, useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
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
type Maturity = 'production' | 'beta' | 'preview' | 'planned';

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
    maturity: Maturity;
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
        available: true,
        maturity: 'beta'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'beta'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'beta'
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
        available: true,
        maturity: 'production'
    },
    {
        title: "Space Planning",
        description: "Complete house & building design with architectural, structural, MEP, and Vastu layouts.",
        icon: Building2,
        category: 'design',
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        route: "/space-planning",
        routeLabel: "Start Space Planning",
        available: true,
        maturity: 'beta'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'production'
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
        available: true,
        maturity: 'preview'
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
        available: true,
        maturity: 'production'
    }
];

const MATURITY_BADGES: Record<Maturity, { label: string; className: string }> = {
    production: { label: 'Production', className: 'bg-green-500/10 text-green-400' },
    beta:       { label: 'Beta', className: 'bg-amber-500/10 text-amber-400' },
    preview:    { label: 'Preview', className: 'bg-blue-500/10 text-blue-400' },
    planned:    { label: 'Planned', className: 'bg-slate-500/10 text-slate-400' },
};

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
                bg-white dark:bg-slate-900/50 backdrop-blur-md
                border border-slate-200 dark:border-slate-800 hover:border-blue-500/50
                rounded-2xl p-6
                transition-all duration-300
                hover:shadow-lg hover:shadow-blue-500/10
                hover:-translate-y-1
                h-full flex flex-col
            ">
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                    {feature.available ? (
                        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${MATURITY_BADGES[feature.maturity].className}`}>
                            {feature.maturity === 'production' && <CheckCircle className="w-3 h-3" />}
                            {MATURITY_BADGES[feature.maturity].label}
                        </span>
                    ) : (
                        <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium">
                            Planned
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
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 pr-20">
                    {feature.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed flex-grow">
                    {feature.description}
                </p>

                {/* Launch Button */}
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/50">
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
    useEffect(() => { document.title = 'Capabilities - BeamLab'; }, []);

    const [activeCategory, setActiveCategory] = useState<Category>('all');
    const navigate = useNavigate();

    // Filter features
    const filteredFeatures = activeCategory === 'all'
        ? FEATURES
        : FEATURES.filter(f => f.category === activeCategory);

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950">
            {/* Navigation Header */}
            <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-slate-900 dark:text-white">BeamLab</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link to="/pricing" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors">
                            Pricing
                        </Link>
                        <Link to="/help" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors">
                            Help
                        </Link>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => navigate('/app')}
                        >
                            <Play className="w-4 h-4" />
                            Open App
                        </Button>
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
                            className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm mb-6 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Home
                        </Link>
                        <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
                            Engineering{' '}
                            <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                                Superpowers
                            </span>
                        </h2>
                        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
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
                            <Button
                                key={cat.id}
                                variant={activeCategory === cat.id ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setActiveCategory(cat.id)}
                                className="rounded-full"
                            >
                                {cat.label}
                            </Button>
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
                        <p className="text-slate-500 dark:text-slate-400 mb-4">Ready to supercharge your workflow?</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button
                                variant="premium"
                                onClick={() => navigate('/app')}
                                className="rounded-full"
                            >
                                <Play className="w-5 h-5" />
                                Start Modeling Now
                            </Button>
                            <Button asChild variant="outline" className="rounded-full">
                                <Link
                                    to="/pricing"
                                    className="flex items-center justify-center gap-2"
                                >
                                    View Pricing
                                    <ExternalLink className="w-4 h-4" />
                                </Link>
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default memo(Capabilities);
