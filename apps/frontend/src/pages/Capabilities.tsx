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
import { PageHeader } from '../components/layout/PageHeader';
import { SEO } from '../components/SEO';
import {
    Sparkles,
    Brain,
    Zap,
    BarChart3,
    FileText,
    Shield,
    Ruler,
    Wind,
    Building2,
    Layers,
    GitBranch,
    Target,
    Workflow,
    Download,
    Globe,
    Code2,
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
    {
        title: "Space Planning",
        description: "Complete house & building design with architectural, structural, MEP, and Vastu layouts.",
        icon: Building2,
        category: 'design',
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        route: "/space-planning",
        routeLabel: "Start Space Planning",
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
                bg-[#0b1326] backdrop-blur-md
                border border-[#1a2333] hover:border-blue-500/50
                rounded-2xl p-6
                transition-all duration-300
                hover:shadow-lg hover:shadow-blue-500/10
                hover:-translate-y-1
                h-full flex flex-col
            ">
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium tracking-wide">
                        <CheckCircle className="w-3 h-3" />
                        Available
                    </span>
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
                <h3 className="text-lg font-bold text-[#dae2fd] mb-2 pr-20">
                    {feature.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-[#869ab8] leading-relaxed flex-grow">
                    {feature.description}
                </p>

                {/* Launch Button */}
                <div className="mt-4 pt-4 border-t border-[#1a2333]/50">
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
        <div className="min-h-screen bg-[#0b1326]">
            <SEO
                title="Capabilities"
                description="Explore BeamLab's structural engineering capabilities: RC design, steel design, seismic analysis, 3D modeling, BIM integration, and 27+ calculation engines."
                path="/capabilities"
            />
            <PageHeader
                navLinks={[
                    { to: '/pricing', label: 'Pricing' },
                    { to: '/help', label: 'Help' },
                ]}
                actions={(
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate('/app')}
                        className="hidden md:inline-flex"
                    >
                        <Play className="w-4 h-4" />
                        Open App
                    </Button>
                )}
                transparent={false}
                showAuth={false}
            />

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
                            className="inline-flex items-center gap-2 text-[#869ab8] hover:text-slate-900 dark:hover:text-white text-sm mb-6 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Home
                        </Link>
                        <h2 className="text-4xl md:text-5xl font-bold text-[#dae2fd] mb-4">
                            Engineering{' '}
                            <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                                Superpowers
                            </span>
                        </h2>
                        <p className="text-lg text-[#869ab8] max-w-2xl mx-auto">
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

                    {/* STAAD.Pro vs BeamLab Ultimate Comparison */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="mt-14 p-6 bg-[#0f1a35] border border-[#1a2333] rounded-2xl"
                    >
                        <h3 className="text-2xl font-bold text-[#dae2fd] mb-4">STAAD.Pro UI/UX Deep Comparison</h3>
                        <p className="text-[#a6b4d7] mb-4">
                            The following table captures a complete, feature-level comparison between STAAD.Pro (CONNECT Edition) and BeamLab Ultimate, focused on 3D/2D views,
                            modeling, geometry, properties, loading, analysis, design engine, and post-processing workflows.
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#1d2a4a]">
                                        <th className="p-3 text-sm font-semibold text-[#c3d2ef] border border-[#273451]">Capability</th>
                                        <th className="p-3 text-sm font-semibold text-[#c3d2ef] border border-[#273451]">STAAD.Pro (Legacy / Modern)</th>
                                        <th className="p-3 text-sm font-semibold text-[#c3d2ef] border border-[#273451]">BeamLab Ultimate (Web-first)</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm text-[#dce4f8]">
                                    <tr className="even:bg-[#101a34] odd:bg-[#0d162b]">
                                        <td className="p-3 border border-[#273451]">Modeling Flow</td>
                                        <td className="p-3 border border-[#273451]">
                                            Physical Modeler + Analytical Modeler separation, manual re-sync
                                            and result invalidation on geometry updates.
                                        </td>
                                        <td className="p-3 border border-[#273451]">
                                            Unified real-time physical-analytical sync; direct 3D manipulation + automatic solver updates.
                                        </td>
                                    </tr>
                                    <tr className="even:bg-[#101a34] odd:bg-[#0d162b]">
                                        <td className="p-3 border border-[#273451]">3D/2D Views & Navigation</td>
                                        <td className="p-3 border border-[#273451]">
                                            View panels with ribbon commands, orientation cube, separate postprocessing mode.
                                        </td>
                                        <td className="p-3 border border-[#273451]">
                                            Single interactive canvas with seamless XY/XZ/YZ toggle, orbit/pan/zoom, overlay diagrams.
                                        </td>
                                    </tr>
                                    <tr className="even:bg-[#101a34] odd:bg-[#0d162b]">
                                        <td className="p-3 border border-[#273451]">Property Assignment</td>
                                        <td className="p-3 border border-[#273451]">
                                            Section database, user table, and explicit assign-then-apply interface.
                                        </td>
                                        <td className="p-3 border border-[#273451]">
                                            Context panel + drag-and-drop libraries with instant updates and smart assignment feedback.
                                        </td>
                                    </tr>
                                    <tr className="even:bg-[#101a34] odd:bg-[#0d162b]">
                                        <td className="p-3 border border-[#273451]">Loading and Combos</td>
                                        <td className="p-3 border border-[#273451]">
                                            Load & Definition dialog, primary/ref/combination cases, REPEAT LOAD vs LOAD COMBINATION distinction.
                                        </td>
                                        <td className="p-3 border border-[#273451]">
                                            Visual load painting, auto code combos, auto non-linear combination selection (P-Delta aware).
                                        </td>
                                    </tr>
                                    <tr className="even:bg-[#101a34] odd:bg-[#0d162b]">
                                        <td className="p-3 border border-[#273451]">Analysis and Result Delivery</td>
                                        <td className="p-3 border border-[#273451]">
                                            Separate solve window, text output file requiring manual review, followed by post-processing mode.
                                        </td>
                                        <td className="p-3 border border-[#273451]">
                                            Cloud solver with live updates, overlay diagrams, click-to-query element results, and AI insight pane.
                                        </td>
                                    </tr>
                                    <tr className="even:bg-[#101a34] odd:bg-[#0d162b]">
                                        <td className="p-3 border border-[#273451]">Design Workflow</td>
                                        <td className="p-3 border border-[#273451]">
                                            Design code command structure (CHECK CODE/MEMBER SELECTION/GROUP) requiring manual param assignment.
                                        </td>
                                        <td className="p-3 border border-[#273451]">
                                            Auto-design suggestions, single-panel code parameters, intelligent refinement with utilization tracking.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-5 text-[#9db4d6] text-sm">
                            <p className="mb-2"><strong>Key Takeaway:</strong> BeamLab marketing can claim optimized UI/UX superiority with precise statements, e.g., “No context switching between physical and analytical modes; models update instantly as you edit geometry.”</p>
                            <p className="mb-0"><strong>Implementation callout:</strong> replicate STAAD-Pro capabilities in BeamLab with feature modules: Grid & Wizard, 3D View Controls, Section Properties / Support Wizards, Load Builder, Combination Generator, Live Solver and Post-Loaded Result Overlay.</p>
                        </div>

                        {/* Deep inventory */}
                        <div className="mt-8 p-5 bg-[#0d1c3e] border border-[#243751] rounded-xl">
                            <h4 className="text-xl font-semibold text-[#e0e9ff] mb-4">STAAD.Pro Atomic UI Inventory</h4>
                            <ul className="list-disc ml-5 text-[#c3d2ef] space-y-2">
                                <li>Backstage (File) - New/Open/Save, Unit Configuration, ISM ProjectSync, Import/Export formats (STAAD, DXF, CIS/2)</li>
                                <li>Ribbon main tabs: Home, Geometry, View, Select, Specification, Loading, Analysis/Design, Results, Report, Utilities</li>
                                <li>Quick Access Toolbar: Run Analysis, Save, Undo/Redo, Pan/Zoom/Rotate, Label toggles</li>
                                <li>Workflow sidebar: physical vs analytical mode switch, page control (modeling, loading, analysis, postprocessing)</li>
                                <li>View control cube & view states: isometric/top/front/side, perspective orthographic toggle</li>
                                <li>Selection cursors: Nodes/Beams/Plates/Surfaces/Load points; selection modes (box/line/polygon)</li>
                                <li>Property manager: section database (IS, AISC, Eurocode), user section table, material list, local axis/Beta angle</li>
                                <li>Load manager: case tree (primary/reference/combination), load item dialog (uniform/concentrated/trapezoid/area/temperature/hydrostatic), auto combo generator</li>
                                <li>Support & release dialogs: fixed/pinned/roller, fixed-but, member releases at start/end, hinge conditions</li>
                                <li>Analysis commands dialog: Linear/P-Delta/Buckling/Cable/Nonlinear/Dynamic/Modal, Print/Report commands</li>
                                <li>Design commands: code selection (AISC, IS, ACI, Eurocode), define parameters (FYLD, FC, LY/LZ, UNL), CHECK CODE, MEMBER SELECTION, GROUP</li>
                                <li>Post-processing panels: Node displacements/reactions, beam results, plate results, contour maps, deflected shape animation</li>
                                <li>Advanced tools: Annotate, Query, Plot, Create AVI, Section Cut, View Compare, Filtering, Isolate/Hide/Show</li>
                                <li>Status bar: coordinates, current cursor, active load case, model units, warning/error counts</li>
                                <li>Keyboard shortcuts: Ctrl+S Save, Ctrl+O Open, Ctrl+N New, Ctrl+F5 Run analysis, Shift+L labels, Shift+E beam orientation, F2 hide/show elements</li>
                            </ul>
                        </div>

                        <div className="mt-5 text-[#9db4d6] text-sm">
                            <p className="mb-2"><strong>BeamLab roadmap alignment:</strong> implement these atomic elements as modular UI components (ribbon conditionals, sidebar explorer, floating property card, context action menu, MRU favorites, live status bar).</p>
                            <p className="mb-0"><strong>Delivery checklist:</strong> 1) complete 3D physically modeled canvas + orthographic planes; 2) plug-in property library and section database; 3) load builder with live visualization; 4) cloud solver with time-slicing, 5) single-stage results overlay with interactive queries.</p>
                        </div>
                    </motion.section>

                    {/* Bottom CTA */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-center mt-16"
                    >
                        <p className="text-[#869ab8] mb-4">Ready to supercharge your workflow?</p>
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
