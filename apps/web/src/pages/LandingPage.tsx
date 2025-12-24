/**
 * LandingPage - SkyCiv-Style Landing Page
 * Professional SaaS homepage with clean design
 */

import { FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ChevronDown,
    Box,
    Ruler,
    Layers,
    Columns3,
    Hammer,
    ArrowRight,
    Play,
    Menu,
    X,
    Puzzle
} from 'lucide-react';
import { useAuth, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';

// ============================================
// ANIMATION VARIANTS
// ============================================

const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
};

// ============================================
// LANDING PAGE COMPONENT
// ============================================

export const LandingPage: FC = () => {
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [productsOpen, setProductsOpen] = useState(false);

    // Handle Clerk auth gracefully
    let isSignedIn = false;
    let isLoaded = true;
    let hasClerk = false;

    try {
        const auth = useAuth();
        isSignedIn = auth.isSignedIn ?? false;
        isLoaded = auth.isLoaded;
        hasClerk = true;
    } catch {
        // Not in ClerkProvider - run in demo mode
    }

    const handleGetStarted = () => {
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-white">
            {/* ================================================
                SECTION 1: NAVBAR (Sticky & Clean)
                ================================================ */}
            <nav className="sticky top-0 z-50 flex flex-row justify-between items-center h-16 bg-white shadow-sm px-4 lg:px-8">
                {/* Left: Logo */}
                <a href="/" className="font-bold text-2xl text-blue-600">
                    BeamLab
                </a>

                {/* Center Links (Desktop) */}
                <div className="hidden lg:flex items-center gap-8">
                    {/* Products Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setProductsOpen(!productsOpen)}
                            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                        >
                            Products
                            <ChevronDown className={`w-4 h-4 transition-transform ${productsOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {productsOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-50">
                                <a href="/demo" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                                    <Box className="w-5 h-5 text-blue-600" />
                                    <div>
                                        <div className="font-medium text-gray-900">Structural 3D</div>
                                        <div className="text-sm text-gray-500">Full 3D frame analysis</div>
                                    </div>
                                </a>
                                <a href="/demo" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                                    <Ruler className="w-5 h-5 text-green-600" />
                                    <div>
                                        <div className="font-medium text-gray-900">Beam Tool</div>
                                        <div className="text-sm text-gray-500">Quick beam analysis</div>
                                    </div>
                                </a>
                                <a href="/demo" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                                    <Layers className="w-5 h-5 text-orange-600" />
                                    <div>
                                        <div className="font-medium text-gray-900">Section Builder</div>
                                        <div className="text-sm text-gray-500">Custom cross-sections</div>
                                    </div>
                                </a>
                            </div>
                        )}
                    </div>

                    <a href="#" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                        Enterprise
                    </a>
                    <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                        Pricing
                    </a>
                    <a href="#" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                        Resources
                    </a>
                </div>

                {/* Right Actions */}
                <div className="hidden lg:flex items-center gap-4">
                    {hasClerk && isLoaded && !isSignedIn ? (
                        <>
                            <SignInButton mode="modal">
                                <button className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                                    Login
                                </button>
                            </SignInButton>
                            <SignUpButton mode="modal">
                                <button className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 font-medium transition-colors">
                                    Sign Up Free
                                </button>
                            </SignUpButton>
                        </>
                    ) : hasClerk && isLoaded && isSignedIn ? (
                        <>
                            <button
                                onClick={handleGetStarted}
                                className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 font-medium transition-colors"
                            >
                                Open Dashboard
                            </button>
                            <UserButton afterSignOutUrl="/" />
                        </>
                    ) : !hasClerk ? (
                        <button
                            onClick={handleGetStarted}
                            className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 font-medium transition-colors"
                        >
                            Try Demo →
                        </button>
                    ) : (
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="lg:hidden p-2"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </nav>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="lg:hidden bg-white border-b border-gray-200 py-4 px-4">
                    <div className="flex flex-col gap-4">
                        <a href="#" className="text-gray-600 font-medium">Products</a>
                        <a href="#" className="text-gray-600 font-medium">Enterprise</a>
                        <a href="#pricing" className="text-gray-600 font-medium">Pricing</a>
                        <a href="#" className="text-gray-600 font-medium">Resources</a>
                        <hr className="border-gray-200" />
                        {hasClerk && isLoaded && !isSignedIn ? (
                            <>
                                <SignInButton mode="modal">
                                    <button className="text-gray-600 font-medium text-left">Login</button>
                                </SignInButton>
                                <SignUpButton mode="modal">
                                    <button className="bg-blue-600 text-white rounded-md px-4 py-2 font-medium w-full">
                                        Sign Up Free
                                    </button>
                                </SignUpButton>
                            </>
                        ) : hasClerk && isSignedIn ? (
                            <>
                                <button
                                    onClick={handleGetStarted}
                                    className="bg-blue-600 text-white rounded-md px-4 py-2 font-medium w-full"
                                >
                                    Open Dashboard
                                </button>
                                <div className="flex justify-center">
                                    <UserButton afterSignOutUrl="/" />
                                </div>
                            </>
                        ) : (
                            <button
                                onClick={handleGetStarted}
                                className="bg-blue-600 text-white rounded-md px-4 py-2 font-medium w-full"
                            >
                                Try Demo →
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ================================================
                SECTION 2: HERO (Split Screen)
                ================================================ */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    {/* Left Column (Text) */}
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={staggerContainer}
                    >
                        <motion.h1
                            variants={fadeInUp}
                            className="text-5xl font-extrabold text-gray-900 leading-tight"
                        >
                            Structural Analysis & Design Software{' '}
                            <span className="text-blue-600">on the Cloud.</span>
                        </motion.h1>

                        <motion.p
                            variants={fadeInUp}
                            className="text-xl text-gray-500 mt-4"
                        >
                            Powerful, easy to use, and accessible from anywhere. No installation required.
                        </motion.p>

                        <motion.div
                            variants={fadeInUp}
                            className="flex flex-wrap gap-4 mt-8"
                        >
                            <button
                                onClick={handleGetStarted}
                                className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-6 py-3 hover:bg-blue-700 font-semibold transition-all shadow-lg shadow-blue-600/25"
                            >
                                Start Free Trial
                                <ArrowRight className="w-5 h-5" />
                            </button>
                            <button className="flex items-center gap-2 border-2 border-gray-300 text-gray-700 rounded-lg px-6 py-3 hover:border-gray-400 font-semibold transition-all">
                                <Play className="w-5 h-5" />
                                Book a Demo
                            </button>
                        </motion.div>
                    </motion.div>

                    {/* Right Column (Visual Placeholder) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <div className="bg-gray-100 rounded-xl shadow-2xl h-96 flex items-center justify-center overflow-hidden">
                            {/* Placeholder for React-Three-Fiber auto-rotating truss */}
                            <div className="text-center">
                                <svg viewBox="0 0 200 150" className="w-64 h-48 mx-auto">
                                    <defs>
                                        <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#3B82F6" />
                                            <stop offset="100%" stopColor="#60A5FA" />
                                        </linearGradient>
                                    </defs>

                                    {/* Grid Background */}
                                    {[...Array(8)].map((_, i) => (
                                        <line key={`h${i}`} x1="0" y1={i * 20} x2="200" y2={i * 20} stroke="#E5E7EB" strokeWidth="0.5" />
                                    ))}
                                    {[...Array(10)].map((_, i) => (
                                        <line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2="150" stroke="#E5E7EB" strokeWidth="0.5" />
                                    ))}

                                    {/* Truss Structure */}
                                    <g stroke="url(#heroGrad)" strokeWidth="3" strokeLinecap="round">
                                        <line x1="20" y1="120" x2="180" y2="120" />
                                        <line x1="40" y1="60" x2="160" y2="60" />
                                        <line x1="20" y1="120" x2="40" y2="60" />
                                        <line x1="60" y1="120" x2="60" y2="60" />
                                        <line x1="100" y1="120" x2="100" y2="60" />
                                        <line x1="140" y1="120" x2="140" y2="60" />
                                        <line x1="180" y1="120" x2="160" y2="60" />
                                        <line x1="40" y1="60" x2="60" y2="120" opacity="0.6" />
                                        <line x1="60" y1="60" x2="100" y2="120" opacity="0.6" />
                                        <line x1="100" y1="60" x2="140" y2="120" opacity="0.6" />
                                    </g>

                                    {/* Nodes */}
                                    <g fill="#22C55E">
                                        <circle cx="20" cy="120" r="5" />
                                        <circle cx="180" cy="120" r="5" />
                                        {[60, 100, 140].map(x => (
                                            <circle key={x} cx={x} cy="120" r="4" />
                                        ))}
                                        {[40, 60, 100, 140, 160].map(x => (
                                            <circle key={x} cx={x} cy="60" r="4" />
                                        ))}
                                    </g>

                                    {/* Supports */}
                                    <polygon points="20,120 12,135 28,135" fill="#FACC15" />
                                    <polygon points="180,120 172,135 188,135" fill="#FACC15" />
                                </svg>
                                <p className="text-gray-400 text-sm mt-4">Interactive 3D Viewer Coming Soon</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ================================================
                SECTION 3: MODULE GRID (SkyCiv Signature)
                ================================================ */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                {/* Header */}
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900">
                        Everything you need in one platform.
                    </h2>
                    <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
                        Integrated tools for structural analysis, design, and documentation
                    </p>
                </div>

                {/* Grid */}
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={staggerContainer}
                    className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12"
                >
                    {MODULES.map((module) => (
                        <motion.div
                            key={module.id}
                            variants={fadeInUp}
                            onClick={() => navigate(`/workspace/${module.id}`)}
                            className="bg-white rounded-xl border border-gray-100 p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                        >
                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${module.bgColor}`}>
                                <module.icon className={`w-6 h-6 ${module.iconColor}`} />
                            </div>

                            {/* Title */}
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{module.title}</h3>

                            {/* Description */}
                            <p className="text-gray-500 mb-4">{module.description}</p>

                            {/* Learn More Link */}
                            <a
                                href="#"
                                className="inline-flex items-center gap-1 text-blue-600 font-medium hover:gap-2 transition-all"
                                onClick={(e) => e.stopPropagation()}
                            >
                                Learn More <ArrowRight className="w-4 h-4" />
                            </a>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* ================================================
                SECTION 4: TRUST SIGNALS
                ================================================ */}
            <section className="bg-gray-50 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <p className="text-center text-gray-500 font-medium mb-8">
                        Trusted by 500+ Engineers
                    </p>

                    <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16">
                        {TRUST_LOGOS.map((logo) => (
                            <div
                                key={logo}
                                className="text-2xl font-bold text-gray-400 opacity-50"
                            >
                                {logo}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ================================================
                SECTION 5: PRICING (Optional)
                ================================================ */}
            <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900">
                        Simple, Transparent Pricing
                    </h2>
                    <p className="text-gray-500 mt-4">
                        Start free, upgrade when you need more
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {PRICING_TIERS.map((tier) => (
                        <div
                            key={tier.name}
                            className={`rounded-2xl p-8 ${tier.popular ? 'bg-blue-600 text-white ring-4 ring-blue-600 ring-offset-4' : 'bg-white border border-gray-200'}`}
                        >
                            {tier.popular && (
                                <span className="text-sm font-medium text-blue-200 mb-2 block">Most Popular</span>
                            )}
                            <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                            <p className={`text-sm mb-6 ${tier.popular ? 'text-blue-200' : 'text-gray-500'}`}>
                                {tier.description}
                            </p>
                            <div className="mb-6">
                                <span className="text-4xl font-bold">{tier.price}</span>
                                {tier.period && (
                                    <span className={tier.popular ? 'text-blue-200' : 'text-gray-500'}>/{tier.period}</span>
                                )}
                            </div>
                            <ul className="space-y-3 mb-8">
                                {tier.features.map((feature) => (
                                    <li key={feature} className="flex items-center gap-2 text-sm">
                                        <svg className={`w-5 h-5 ${tier.popular ? 'text-blue-300' : 'text-green-500'}`} fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={handleGetStarted}
                                className={`w-full py-3 rounded-lg font-semibold transition-all ${tier.popular ? 'bg-white text-blue-600 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                            >
                                {tier.cta}
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* ================================================
                FOOTER
                ================================================ */}
            <footer className="bg-gray-900 text-white py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                        <div>
                            <h4 className="font-bold text-lg mb-4">BeamLab</h4>
                            <p className="text-gray-400 text-sm">
                                Professional structural engineering software for the cloud.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Product</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li><a href="#" className="hover:text-white transition-colors">Structural 3D</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Beam Tool</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Section Builder</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">RC Design</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Company</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-4">Resources</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Tutorials</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-gray-400 text-sm">
                            © 2025 BeamLab. All rights reserved.
                        </p>
                        <div className="flex gap-6 text-gray-400 text-sm">
                            <a href="#" className="hover:text-white transition-colors">Terms</a>
                            <a href="#" className="hover:text-white transition-colors">Privacy</a>
                            <a href="#" className="hover:text-white transition-colors">Cookies</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

// ============================================
// DATA
// ============================================

const MODULES = [
    {
        id: 'structural-3d',
        title: 'Structural 3D',
        description: 'Full 3D frame and truss analysis with advanced FEM solvers.',
        icon: Box,
        bgColor: 'bg-blue-100',
        iconColor: 'text-blue-500',
    },
    {
        id: 'beam',
        title: 'Beam Tool',
        description: 'Quick beam analysis for simple span calculations.',
        icon: Ruler,
        bgColor: 'bg-orange-100',
        iconColor: 'text-orange-500',
    },
    {
        id: 'section-builder',
        title: 'Section Builder',
        description: 'Create custom cross-sections and calculate properties.',
        icon: Layers,
        bgColor: 'bg-cyan-100',
        iconColor: 'text-cyan-500',
    },
    {
        id: 'rc-design',
        title: 'RC Design',
        description: 'Concrete beam and column design per IS 456 / ACI 318.',
        icon: Columns3,
        bgColor: 'bg-green-100',
        iconColor: 'text-green-500',
    },
    {
        id: 'steel-design',
        title: 'Steel Design',
        description: 'Steel member checks per IS 800 / AISC 360.',
        icon: Hammer,
        bgColor: 'bg-red-100',
        iconColor: 'text-red-500',
    },
    {
        id: 'connection',
        title: 'Connection',
        description: 'Steel connection design and verification.',
        icon: Puzzle,
        bgColor: 'bg-purple-100',
        iconColor: 'text-purple-500',
    },
];

const TRUST_LOGOS = [
    'BuildCorp',
    'CivilEng',
    'StructPro',
    'DesignWorks',
    'EngiTech'
];

const PRICING_TIERS = [
    {
        name: 'Free',
        description: 'For students and learning',
        price: '$0',
        period: 'month',
        features: ['3 Projects', '100 Nodes', '2D Analysis', 'Community Support'],
        cta: 'Get Started',
        popular: false,
    },
    {
        name: 'Professional',
        description: 'For freelancers and small teams',
        price: '$29',
        period: 'month',
        features: ['Unlimited Projects', 'Unlimited Nodes', '3D Analysis', 'All Design Codes', 'Priority Support'],
        cta: 'Start Free Trial',
        popular: true,
    },
    {
        name: 'Enterprise',
        description: 'For large organizations',
        price: 'Custom',
        period: null,
        features: ['Everything in Pro', 'API Access', 'SSO Integration', 'Dedicated Support', 'On-premise Option'],
        cta: 'Contact Sales',
        popular: false,
    },
];

export default LandingPage;
