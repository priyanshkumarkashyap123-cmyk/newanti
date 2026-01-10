/**
 * LandingPage - BeamLab Ultimate Landing Page
 * Premium Dark SaaS homepage with vibrant gradients
 * Merged with Enhanced features (v2.0)
 */

import { FC, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { useAuth, isUsingClerk } from '../providers/AuthProvider';
import {
    CheckCircle,
    ChevronRight,
    Menu,
    X,
    ArrowRight,
    Zap,
    Globe2,
    Shield,
    Layers,
    Cpu,
    Play,
    Terminal
} from 'lucide-react';
import beamLabLogo from '../assets/beamlab_logo.png';

// Animation variants
const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.6, -0.05, 0.01, 0.99] } }
};

const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
};

export const LandingPage: FC = () => {
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { isSignedIn, isLoaded, signOut } = useAuth();
    const isClerkEnabled = isUsingClerk();

    const handleGetStarted = () => {
        if (isSignedIn) {
            navigate('/app');
        } else {
            navigate('/sign-up');
        }
    };

    const renderAuthButtons = () => {
        if (!isLoaded) return null;

        if (isSignedIn) {
            return (
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/app')}
                        className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
                    >
                        Go to App <ArrowRight className="w-4 h-4" />
                    </button>
                    {isClerkEnabled ? (
                        <UserButton afterSignOutUrl="/" />
                    ) : (
                        <button
                            onClick={() => signOut()}
                            className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
                        >
                            Sign Out
                        </button>
                    )}
                </div>
            );
        }

        return (
            <div className="flex items-center gap-4">
                <Link to="/sign-in" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                    Log in
                </Link>
                <Link
                    to="/sign-up"
                    className="flex items-center gap-2 px-5 py-2 rounded-full bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.5)]"
                >
                    Get Started
                </Link>
            </div>
        );
    };


    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
            {/* Navbar */}
            <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="relative w-8 h-8 flex items-center justify-center rounded-lg shadow-lg group-hover:shadow-blue-500/25 transition-all overflow-hidden">
                                <img src={beamLabLogo} alt="BeamLab" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                                BeamLab Ultimate
                            </span>
                        </Link>

                        {/* Desktop Links */}
                        <div className="hidden md:flex items-center gap-8">
                            <a href="#features" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Features</a>
                            <a href="#pricing" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Pricing</a>
                            <Link to="/help" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Docs</Link>
                        </div>

                        {/* Auth */}
                        <div className="hidden md:flex items-center">
                            {renderAuthButtons()}
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden p-2 text-slate-400 hover:text-white"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden bg-slate-900 border-b border-white/5 p-4 space-y-4">
                        <a href="#features" className="block text-slate-400 hover:text-white">Features</a>
                        <a href="#pricing" className="block text-slate-400 hover:text-white">Pricing</a>
                        <Link to="/help" className="block text-slate-400 hover:text-white">Docs</Link>
                        <hr className="border-white/10" />
                        <button onClick={handleGetStarted} className="w-full py-2 bg-blue-600 rounded-lg font-semibold">
                            Get Started
                        </button>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
                    <div className="absolute top-20 left-10 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px] opacity-40 mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
                    <div className="absolute top-40 right-10 w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-[100px] opacity-40 mix-blend-screen animate-pulse" style={{ animationDuration: '7s' }} />
                </div>

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={fadeInUp}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold uppercase tracking-wider mb-8"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        v2.0 Now Live
                    </motion.div>

                    <motion.h1
                        initial="hidden"
                        animate="visible"
                        variants={fadeInUp}
                        className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
                    >
                        Structural Analysis <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400">
                            Reimagined for Web
                        </span>
                    </motion.h1>

                    <motion.p
                        initial="hidden"
                        animate="visible"
                        variants={fadeInUp}
                        className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 mb-10 leading-relaxed"
                    >
                        Free, instant, and professional-grade FEA in your browser.
                        No installation required. Real-time visualization, cloud collaboration,
                        and professional reporting.
                    </motion.p>

                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={fadeInUp}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <button
                            onClick={handleGetStarted}
                            className="h-14 px-8 rounded-full bg-white text-slate-950 font-bold text-base hover:bg-slate-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] flex items-center gap-2"
                        >
                            Start Analyzing Free <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => navigate('/demo')}
                            className="h-14 px-8 rounded-full bg-slate-800 border border-slate-700 text-white font-medium hover:bg-slate-700 transition-all flex items-center gap-2"
                        >
                            <Play className="w-4 h-4 fill-current" /> View Live Demo
                        </button>
                    </motion.div>

                    {/* Social Proof */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="mt-16 flex flex-col items-center gap-4"
                    >
                        <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Trusted by engineers at</p>
                        <div className="flex flex-wrap items-center justify-center gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                            {TRUSTED_COMPANIES.map((company) => (
                                <div key={company} className="px-4 py-2 text-lg font-bold text-slate-300">
                                    {company}
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Dashboard Preview */}
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.8 }}
                        className="mt-20 relative mx-auto max-w-5xl group"
                    >
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
                        <div className="relative rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur shadow-2xl overflow-hidden aspect-video flex items-center justify-center">
                            <span className="text-slate-600 font-mono text-sm">Interactive 3D Canvas Preview</span>
                            {/* In a real app, put an <img> or <video> here */}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-slate-950 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            Powerful Features for Modern Engineers
                        </h2>
                        <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
                            Everything you need to design, analyze, and verify your structures using modern web technologies.
                        </p>
                    </div>

                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-8"
                    >
                        {FEATURES.map((feature, idx) => (
                            <FeatureCard key={idx} {...feature} />
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-24 bg-slate-900/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Simple, Transparent Pricing
                        </h2>
                        <p className="text-slate-400 max-w-2xl mx-auto">
                            Choose the perfect plan for your engineering needs. All plans include core analysis features.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {PRICING_TIERS.map((tier) => (
                            <div
                                key={tier.name}
                                className={`relative flex flex-col rounded-3xl p-8 ${tier.popular
                                    ? 'bg-slate-900 border border-blue-500/50 shadow-2xl shadow-blue-500/10 transform md:scale-110 z-10'
                                    : 'bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all'
                                    }`}
                            >
                                {tier.popular && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg uppercase tracking-wider">
                                        Most Popular
                                    </div>
                                )}
                                <div className="mb-6">
                                    <h3 className={`text-2xl font-bold mb-2 ${tier.popular ? 'text-white' : 'text-slate-200'}`}>
                                        {tier.name}
                                    </h3>
                                    <p className="text-sm text-slate-400">{tier.description}</p>
                                </div>
                                <div className="mb-8">
                                    <span className="text-4xl font-bold text-white">{tier.price}</span>
                                    {tier.period && <span className="text-slate-500 ml-1">/{tier.period}</span>}
                                </div>

                                <button
                                    onClick={handleGetStarted}
                                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all mb-8 ${tier.popular
                                        ? 'bg-white text-slate-950 hover:bg-slate-100'
                                        : 'bg-slate-800 text-white hover:bg-slate-700'
                                        }`}
                                >
                                    {tier.cta}
                                </button>

                                <ul className="space-y-4 flex-1">
                                    {tier.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm text-slate-300">
                                            <CheckCircle className={`w-5 h-5 flex-shrink-0 ${tier.popular ? 'text-blue-400' : 'text-slate-600'}`} />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-purple-900/20" />
                <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
                    <h2 className="text-4xl font-bold text-white mb-6">
                        Ready to Transform Your Workflow?
                    </h2>
                    <p className="text-xl text-slate-300 mb-10">
                        Join thousands of engineers using BeamLab Ultimate for their structural analysis needs.
                    </p>
                    <button
                        onClick={handleGetStarted}
                        className="inline-flex items-center gap-3 h-14 px-10 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-full text-lg font-bold transition-all hover:scale-105 shadow-2xl shadow-blue-500/20"
                    >
                        Get Started Free
                        <ArrowRight className="w-5 h-5" />
                    </button>
                    <p className="text-slate-500 text-sm mt-6">No credit card required • Free forever plan available</p>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-800 py-16 bg-slate-950">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                        <div className="col-span-2">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg">
                                    <Cpu className="w-5 h-5 text-blue-400" />
                                </div>
                                <span className="text-xl font-bold text-white">BeamLab Ultimate</span>
                            </div>
                            <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
                                Professional structural analysis software, reimagined for the modern web.
                                Fast, accurate, and accessible anywhere.
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-white mb-4">Product</h4>
                            <ul className="space-y-3 text-sm">
                                <li><a href="#features" className="text-slate-400 hover:text-white transition-colors">Features</a></li>
                                <li><a href="#pricing" className="text-slate-400 hover:text-white transition-colors">Pricing</a></li>
                                <li><Link to="/help" className="text-slate-400 hover:text-white transition-colors">Documentation</Link></li>
                                <li><Link to="/workspace-demo" className="text-slate-400 hover:text-white transition-colors">Workspace Demo</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-white mb-4">Company</h4>
                            <ul className="space-y-3 text-sm">
                                <li><Link to="/privacy" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</Link></li>
                                <li><Link to="/terms" className="text-slate-400 hover:text-white transition-colors">Terms of Service</Link></li>
                                <li><Link to="/contact" className="text-slate-400 hover:text-white transition-colors">Contact Us</Link></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-slate-500 text-sm">© 2025 BeamLab Ultimate. All rights reserved.</p>
                        <p className="text-slate-600 text-xs">Built for structural engineers.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

// --- DATA & COMPONENTS ---

const FeatureCard = ({ icon, title, desc, bullets }: { icon: any, title: string, desc: string, bullets: string[] }) => (
    <motion.div
        variants={fadeInUp}
        className="p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/30 hover:bg-slate-800/50 transition-all group"
    >
        <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
            {icon}
        </div>
        <h3 className="text-xl font-bold text-slate-100 mb-3">{title}</h3>
        <p className="text-slate-400 leading-relaxed text-sm mb-6">{desc}</p>
        <ul className="space-y-2">
            {bullets.map((bullet, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-500/50" />
                    {bullet}
                </li>
            ))}
        </ul>
    </motion.div>
);

const TRUSTED_COMPANIES = ['AECOM', 'Bechtel', 'Fluor', 'WSP', 'Jacobs'];

const FEATURES = [
    {
        title: 'True 3D Visualization',
        desc: 'Realistic I-beams, channels, and custom sections rendered in real-time with professional graphics.',
        icon: <Layers className="w-6 h-6" />,
        bullets: ['Real-time deformation', 'Stress heatmaps', 'Multiple viewports'],
    },
    {
        title: 'Transparent Math',
        desc: 'See every formula, step, and calculation. No black boxes, just clear engineering.',
        icon: <Terminal className="w-6 h-6" />,
        bullets: ['Step-by-step calcs', 'Moment distribution', 'Full traceability'],
    },
    {
        title: 'Instant Reports',
        desc: 'Export professional PDF reports in one click with diagrams, calculations, and branding.',
        icon: <Zap className="w-6 h-6" />,
        bullets: ['Customizable headers', 'Vector diagrams', 'Code compliance'],
    },
];

const PRICING_TIERS = [
    {
        name: 'Free',
        description: 'Perfect for students and quick checks',
        price: '$0',
        period: 'forever',
        features: ['Up to 5 projects', 'Basic beam & frame analysis', '2D structural models', 'Community support', 'Standard reports'],
        cta: 'Get Started',
        popular: false,
    },
    {
        name: 'Professional',
        description: 'For practicing engineers',
        price: '$49',
        period: 'month',
        features: ['Unlimited projects', 'Advanced 3D analysis', 'P-Delta & buckling', 'Custom PDF branding', 'Priority email support', 'Cloud storage'],
        cta: 'Start Free Trial',
        popular: true,
    },
    {
        name: 'Enterprise',
        description: 'For teams and organizations',
        price: 'Custom',
        period: null,
        features: ['Everything in Professional', 'SSO & user management', 'API access', 'Custom integrations', 'Dedicated account manager'],
        cta: 'Contact Sales',
        popular: false,
    },
];

export default LandingPage;
