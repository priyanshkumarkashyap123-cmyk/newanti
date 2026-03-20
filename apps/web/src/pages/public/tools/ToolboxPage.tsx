/**
 * ToolboxPage - Free Engineering Calculators Landing Page
 * 
 * Public SEO-optimized page showcasing engineering tools.
 * No authentication required.
 */

import { FC, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Search,
    Calculator,
    Ruler,
    Wind,
    Layers,
    ArrowRight,
    Zap,
    Building2,
    Box,
    Scale,
    Compass,
    FileSpreadsheet,
    Grid3x3,
    Star
} from 'lucide-react';
import { PAYMENT_CONFIG } from '../../../config/env';

// ============================================
// METADATA (for SEO)
// ============================================

export const toolboxMeta = {
    title: 'Free Engineering Calculators | BeamLab Tools',
    description: 'Free online structural engineering tools: beam calculator, section properties, unit converter, wind load generator (IS 875), and more.',
    keywords: 'beam calculator, section properties, wind load IS 875, engineering tools, structural calculator'
};

// ============================================
// TOOL DEFINITIONS
// ============================================

interface Tool {
    id: string;
    name: string;
    description: string;
    icon: typeof Calculator;
    path: string;
    category: 'calculator' | 'reference' | 'generator';
    featured?: boolean;
}

const TOOLS: Tool[] = [
    {
        id: 'simple-beam',
        name: 'Simple Beam Calculator',
        description: 'Calculate reactions, shear force, bending moment diagrams for simply supported, cantilever, and continuous beams.',
        icon: Ruler,
        path: '/tools/beam-calculator',
        category: 'calculator',
        featured: true
    },
    {
        id: 'section-library',
        name: 'Section Property Library',
        description: 'Browse 500+ standard steel sections (IS 808, AISC, European). Get area, moment of inertia, section modulus instantly.',
        icon: Layers,
        path: '/tools/section-database',
        category: 'reference',
        featured: true
    },
    {
        id: 'unit-converter',
        name: 'Unit Converter',
        description: 'Convert between SI and Imperial units for length, force, stress, moment, and more engineering quantities.',
        icon: Scale,
        path: '/tools/unit-converter',
        category: 'calculator'
    },
    {
        id: 'wind-load',
        name: 'Wind Load Generator (IS 875)',
        description: 'Calculate design wind pressure as per IS 875 Part 3. Input terrain, height, and get Vb, Vz, pd values.',
        icon: Wind,
        path: '/tools/wind-load',
        category: 'generator',
        featured: true
    },
    {
        id: 'concrete-mix',
        name: 'Concrete Mix Design',
        description: 'Design concrete mix proportions as per IS 10262. Calculate cement, aggregate, and water content.',
        icon: Box,
        path: '/tools/concrete-mix',
        category: 'calculator'
    },
    {
        id: 'column-design',
        name: 'Column Load Calculator',
        description: 'Quick column load estimation based on tributary area and floor loads. Supports multi-story buildings.',
        icon: Building2,
        path: '/tools/column-load',
        category: 'calculator'
    },
    {
        id: 'deflection-check',
        name: 'Deflection Checker',
        description: 'Check beam and slab deflection limits as per IS 456 and IS 800 provisions.',
        icon: Compass,
        path: '/tools/deflection',
        category: 'calculator'
    },
    {
        id: 'bar-bending',
        name: 'Bar Bending Schedule',
        description: 'Generate IS 2502-compliant BBS with cutting lengths, weights, and shapes for RCC detailing.',
        icon: FileSpreadsheet,
        path: '/tools/bar-bending',
        category: 'generator',
    },
    {
        id: 'plate-shell',
        name: 'Plate/Shell FEM Analysis',
        description: 'Finite element analysis for 2D plates and shells with Kirchhoff, Mindlin-Reissner, DKT/DKQ formulations.',
        icon: Grid3x3,
        path: '/analysis/plate-shell',
        category: 'calculator',
    }
];

const CATEGORIES = {
    calculator: { label: 'Calculators', color: 'bg-blue-500' },
    reference: { label: 'Reference', color: 'bg-purple-500' },
    generator: { label: 'Generators', color: 'bg-green-500' }
};

// ============================================
// COMPONENTS
// ============================================

const ToolCard: FC<{ tool: Tool }> = ({ tool }) => {
    const Icon = tool.icon;
    const cat = CATEGORIES[tool.category];

    return (
        <Link
            to={tool.path}
            className="group relative bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 border border-[#1a2333] hover:border-slate-300 dark:hover:border-slate-600 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1"
        >
            {/* Featured badge */}
            {tool.featured && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 rounded-full p-1.5">
                    <Star className="w-3 h-3 text-yellow-900 fill-current" />
                </div>
            )}

            {/* Icon */}
            <div className={`w-12 h-12 ${cat.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6 text-[#dae2fd]" />
            </div>

            {/* Category tag */}
            <div className="text-xs text-[#869ab8] uppercase tracking-wider mb-2">
                {cat.label}
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-[#dae2fd] mb-2 group-hover:text-blue-400 transition-colors">
                {tool.name}
            </h3>

            {/* Description */}
            <p className="text-sm text-[#869ab8] leading-relaxed mb-4">
                {tool.description}
            </p>

            {/* CTA */}
            <div className="flex items-center text-blue-400 text-sm font-medium tracking-wide tracking-wide">
                Open Tool
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
        </Link>
    );
};

// ============================================
// MAIN PAGE
// ============================================

export const ToolboxPage: FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const forcePaymentTestMode = PAYMENT_CONFIG.forcePaymentTestMode;

    // Filter tools
    const filteredTools = useMemo(() => {
        return TOOLS.filter(tool => {
            const matchesSearch = !searchQuery ||
                tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tool.description.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory = !selectedCategory || tool.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }, [searchQuery, selectedCategory]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 dark:from-slate-900 via-slate-100 dark:via-slate-900 to-white dark:to-slate-950">
            {/* SEO Hidden Tags */}
            <h1 className="sr-only">{toolboxMeta.title}</h1>

            {/* Header */}
            <header className="border-b border-[#1a2333] bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <Link to="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-white font-bold text-xl">BeamLab</span>
                        </Link>

                        <nav className="hidden md:flex items-center gap-8">
                            <Link to="/tools" className="text-blue-400 font-medium tracking-wide tracking-wide">Tools</Link>
                            <Link to="/pricing" className="text-[#869ab8] hover:text-slate-900 dark:hover:text-white transition-colors">Pricing</Link>
                            <Link to="/help" className="text-[#869ab8] hover:text-slate-900 dark:hover:text-white transition-colors">Docs</Link>
                        </nav>

                        <div className="flex items-center gap-3">
                            <Link
                                to="/login"
                                className="text-[#869ab8] hover:text-slate-900 dark:hover:text-white transition-colors text-sm"
                            >
                                Sign In
                            </Link>
                            <Link
                                to="/pricing"
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium tracking-wide tracking-wide transition-colors"
                            >
                                Subscribe Now
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative overflow-hidden py-20 lg:py-28">
                {/* Background effects */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 border border-[#1a2333] rounded-full px-4 py-2 mb-8">
                        <Calculator className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                            {forcePaymentTestMode ? 'Paid checkout currently enabled for upgrades' : 'Public engineering calculators'}
                        </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#dae2fd] mb-6">
                        Free Engineering
                        <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Calculators
                        </span>
                    </h2>

                    {/* Subtitle */}
                    <p className="text-lg md:text-xl text-[#869ab8] max-w-2xl mx-auto mb-10">
                        Professional structural engineering tools trusted by 50,000+ engineers.
                        Quick calculations, Indian Standard codes, and instant results.
                    </p>

                    {/* Search Bar */}
                    <div className="max-w-xl mx-auto relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#869ab8]" />
                        <input
                            type="text"
                            placeholder="What do you need to calculate?"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-100/80 dark:bg-slate-800/80 border border-[#1a2333] rounded-2xl text-[#dae2fd] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                        />
                    </div>
                </div>
            </section>

            {/* Category Filter */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[#869ab8] text-sm">Filter:</span>
                    <button type="button"
                        onClick={() => setSelectedCategory(null)}
                        className={`px-4 py-2 rounded-full text-sm font-medium tracking-wide tracking-wide transition-colors ${!selectedCategory
                                ? 'bg-blue-600 text-white'
                                : 'bg-[#131b2e] text-[#869ab8] hover:text-slate-900 dark:hover:text-white'
                            }`}
                    >
                        All Tools
                    </button>
                    {Object.entries(CATEGORIES).map(([key, { label, color }]) => (
                        <button type="button"
                            key={key}
                            onClick={() => setSelectedCategory(key)}
                            className={`px-4 py-2 rounded-full text-sm font-medium tracking-wide tracking-wide transition-colors ${selectedCategory === key
                                    ? `${color} text-[#dae2fd]`
                                    : 'bg-[#131b2e] text-[#869ab8] hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </section>

            {/* Tools Grid */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
                {filteredTools.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredTools.map(tool => (
                            <ToolCard key={tool.id} tool={tool} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <Search className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                        <p className="text-[#869ab8]">No tools found matching "{searchQuery}"</p>
                        <button type="button"
                            onClick={() => setSearchQuery('')}
                            className="text-blue-400 mt-2 hover:underline"
                        >
                            Clear search
                        </button>
                    </div>
                )}
            </section>

            {/* Featured CTA */}
            <section className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-y border-[#1a2333]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div>
                            <h3 className="text-2xl md:text-3xl font-bold text-[#dae2fd] mb-3">
                                Need More Power?
                            </h3>
                            <p className="text-[#869ab8] max-w-lg">
                                Try BeamLab Pro for advanced 3D modeling, FEA analysis,
                                steel design checks, and collaboration features.
                            </p>
                        </div>
                        <Link
                            to="/pricing"
                            className="flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-slate-100 transition-colors whitespace-nowrap"
                        >
                            <Zap className="w-5 h-5" />
                            Subscribe Now
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-[#869ab8] text-sm">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
                            <Zap className="w-4 h-4 text-white" />
                        </div>
                        <span>© {new Date().getFullYear()} BeamLab. Made for Engineers, by Engineers.</span>
                    </div>
                    <div className="flex items-center gap-6 text-[#869ab8] text-sm">
                        <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms</Link>
                        <Link to="/contact" className="hover:text-slate-900 dark:hover:text-white transition-colors">Contact</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default ToolboxPage;
