/**
 * Capabilities.tsx - Feature Grid Component
 * 
 * Displays all website capabilities in a beautiful grid layout
 * with category filtering and glassmorphism card design.
 */

import { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    LucideIcon
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
        bgColor: "bg-purple-500/10"
    },
    {
        title: "Smart Templates",
        description: "50+ parametric templates for beams, trusses, frames generated mathematically on-demand.",
        icon: Brain,
        category: 'ai',
        color: "text-violet-500",
        bgColor: "bg-violet-500/10"
    },
    {
        title: "Auto Load Combinations",
        description: "Automatically generate code-compliant load combinations per ASCE 7, IS 875, or Eurocode.",
        icon: Zap,
        category: 'ai',
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10"
    },
    {
        title: "Design Optimization",
        description: "AI-powered section optimization to minimize weight while meeting code requirements.",
        icon: Target,
        category: 'ai',
        color: "text-pink-500",
        bgColor: "bg-pink-500/10"
    },

    // Analysis
    {
        title: "Linear Static Analysis",
        description: "Fast finite element solver for displacement, reactions, and internal forces.",
        icon: BarChart3,
        category: 'analysis',
        color: "text-green-500",
        bgColor: "bg-green-500/10"
    },
    {
        title: "Modal Analysis",
        description: "Extract natural frequencies and mode shapes for dynamic behavior assessment.",
        icon: Workflow,
        category: 'analysis',
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10"
    },
    {
        title: "P-Delta Analysis",
        description: "Second-order geometric nonlinearity for slender structures and stability checks.",
        icon: GitBranch,
        category: 'analysis',
        color: "text-teal-500",
        bgColor: "bg-teal-500/10"
    },
    {
        title: "Response Spectrum",
        description: "Seismic analysis using code-defined response spectra (IS 1893, ASCE 7, EC8).",
        icon: Zap,
        category: 'analysis',
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10"
    },

    // Design Codes
    {
        title: "Steel Design (IS 800)",
        description: "Comprehensive steel member checks per IS 800:2007 with utilization ratios.",
        icon: Ruler,
        category: 'design',
        color: "text-blue-500",
        bgColor: "bg-blue-500/10"
    },
    {
        title: "Steel Design (AISC 360)",
        description: "American steel design checks for W-shapes, HSS, and angles per AISC 360-16.",
        icon: Shield,
        category: 'design',
        color: "text-indigo-500",
        bgColor: "bg-indigo-500/10"
    },
    {
        title: "Concrete Design (ACI 318)",
        description: "Reinforced concrete beam and column design with rebar detailing.",
        icon: Building2,
        category: 'design',
        color: "text-orange-500",
        bgColor: "bg-orange-500/10"
    },
    {
        title: "Wind Load (IS 875)",
        description: "Automated wind pressure calculation based on terrain, height, and building shape.",
        icon: Wind,
        category: 'design',
        color: "text-sky-500",
        bgColor: "bg-sky-500/10"
    },
    {
        title: "Seismic Load (IS 1893)",
        description: "Base shear and vertical distribution per IS 1893:2016 with zone factors.",
        icon: Zap,
        category: 'design',
        color: "text-red-500",
        bgColor: "bg-red-500/10"
    },
    {
        title: "Foundation Design",
        description: "Isolated and combined footing design with soil bearing capacity checks.",
        icon: Layers,
        category: 'design',
        color: "text-amber-500",
        bgColor: "bg-amber-500/10"
    },

    // Reporting
    {
        title: "PDF Reports",
        description: "Professional calculation reports with diagrams, tables, and code references.",
        icon: FileText,
        category: 'reporting',
        color: "text-rose-500",
        bgColor: "bg-rose-500/10"
    },
    {
        title: "DXF Export",
        description: "Export your model to AutoCAD-compatible DXF format for documentation.",
        icon: Download,
        category: 'reporting',
        color: "text-fuchsia-500",
        bgColor: "bg-fuchsia-500/10"
    },
    {
        title: "API Access",
        description: "REST API for integration with your existing workflows and automation scripts.",
        icon: Code2,
        category: 'reporting',
        color: "text-lime-500",
        bgColor: "bg-lime-500/10"
    },
    {
        title: "Cloud Sync",
        description: "Real-time collaboration with automatic cloud backup and version history.",
        icon: Globe,
        category: 'reporting',
        color: "text-blue-400",
        bgColor: "bg-blue-400/10"
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
            className="group relative"
        >
            <div className="
                bg-zinc-900/50 backdrop-blur-md
                border border-zinc-800 hover:border-blue-500/50
                rounded-2xl p-6
                transition-all duration-300
                hover:shadow-lg hover:shadow-blue-500/10
                hover:-translate-y-1
            ">
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
                <h3 className="text-lg font-bold text-white mb-2">
                    {feature.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-zinc-400 leading-relaxed">
                    {feature.description}
                </p>

                {/* Launch Arrow (appears on hover) */}
                <div className="
                    absolute bottom-6 right-6
                    opacity-0 group-hover:opacity-100
                    transform translate-x-2 group-hover:translate-x-0
                    transition-all duration-300
                ">
                    <div className={`
                        ${feature.bgColor} ${feature.color}
                        p-2 rounded-full
                    `}>
                        <ArrowRight className="w-4 h-4" />
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

    // Filter features
    const filteredFeatures = activeCategory === 'all'
        ? FEATURES
        : FEATURES.filter(f => f.category === activeCategory);

    return (
        <div className="min-h-screen bg-zinc-950 py-20 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                        Engineering{' '}
                        <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                            Superpowers
                        </span>
                    </h2>
                    <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                        Everything you need to analyze, design, and report.
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
                                    : 'bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700/50'
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
                    <p className="text-zinc-500 mb-4">Ready to supercharge your workflow?</p>
                    <button className="
                        px-8 py-3 
                        bg-gradient-to-r from-blue-600 to-purple-600
                        hover:from-blue-500 hover:to-purple-500
                        text-white font-semibold rounded-full
                        shadow-lg shadow-blue-600/30
                        transition-all duration-300
                        hover:scale-105
                    ">
                        Start Free Trial
                    </button>
                </motion.div>
            </div>
        </div>
    );
};

export default Capabilities;
