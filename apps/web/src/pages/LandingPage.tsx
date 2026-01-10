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
            <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-slate-950/90 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
                            <div className="relative w-9 h-9 flex items-center justify-center rounded-lg shadow-lg group-hover:shadow-blue-500/25 transition-all overflow-hidden">
                                <img src={beamLabLogo} alt="BeamLab" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 whitespace-nowrap">
                                BeamLab Ultimate
                            </span>
                        </Link>

                        {/* Desktop Links - Properly centered with consistent spacing */}
                        <div className="hidden md:flex items-center justify-center flex-1 px-8">
                            <div className="flex items-center gap-8">
                                <a href="#features" className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-2 py-1">
                                    Features
                                </a>
                                <a href="#pricing" className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-2 py-1">
                                    Pricing
                                </a>
                                <Link to="/help" className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-2 py-1">
                                    Docs
                                </Link>
                                <Link to="/demo" className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-2 py-1">
                                    Demo
                                </Link>
                            </div>
                        </div>

                        {/* Auth - Right aligned */}
                        <div className="hidden md:flex items-center flex-shrink-0">
                            {renderAuthButtons()}
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Toggle menu"
                        >
                            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu - Improved design */}
                {mobileMenuOpen && (
                    <div className="md:hidden bg-slate-900/95 backdrop-blur-xl border-b border-white/10 p-6 space-y-4">
                        <a href="#features" className="block text-slate-300 hover:text-white text-base font-medium py-2 px-3 rounded-lg hover:bg-slate-800 transition-colors">
                            Features
                        </a>
                        <a href="#pricing" className="block text-slate-300 hover:text-white text-base font-medium py-2 px-3 rounded-lg hover:bg-slate-800 transition-colors">
                            Pricing
                        </a>
                        <Link to="/help" className="block text-slate-300 hover:text-white text-base font-medium py-2 px-3 rounded-lg hover:bg-slate-800 transition-colors">
                            Docs
                        </Link>
                        <Link to="/demo" className="block text-slate-300 hover:text-white text-base font-medium py-2 px-3 rounded-lg hover:bg-slate-800 transition-colors">
                            Demo
                        </Link>
                        <hr className="border-white/10 my-4" />
                        <div className="space-y-3">
                            <Link to="/sign-in" className="block text-center text-slate-300 hover:text-white text-base font-medium py-2 px-3 rounded-lg hover:bg-slate-800 transition-colors">
                                Log in
                            </Link>
                            <button onClick={handleGetStarted} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-white shadow-lg shadow-blue-500/20 transition-all">
                                Get Started Free
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="relative pt-28 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
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
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold uppercase tracking-wider mb-8"
                    >
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        v2.0 Now Live — 300K+ Members Supported
                    </motion.div>

                    <motion.h1
                        initial="hidden"
                        animate="visible"
                        variants={fadeInUp}
                        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
                    >
                        Structural Analysis{' '}
                        <br className="hidden sm:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400">
                            Reimagined for Web
                        </span>
                    </motion.h1>

                    <motion.p
                        initial="hidden"
                        animate="visible"
                        variants={fadeInUp}
                        className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-slate-400 mb-10 leading-relaxed px-4"
                    >
                        Free, instant, and professional-grade FEA in your browser.
                        No installation required. Real-time 3D visualization, AI-powered design,
                        and professional reporting — all in one platform.
                    </motion.p>

                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={fadeInUp}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4"
                    >
                        <button
                            onClick={handleGetStarted}
                            className="w-full sm:w-auto h-14 px-8 rounded-full bg-white text-slate-950 font-bold text-base hover:bg-slate-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] flex items-center justify-center gap-2"
                        >
                            Start Analyzing Free <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => navigate('/demo')}
                            className="w-full sm:w-auto h-14 px-8 rounded-full bg-slate-800 border border-slate-700 text-white font-medium hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
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
            <section id="features" className="py-20 sm:py-24 bg-slate-950 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12 sm:mb-16">
                        <motion.span 
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            className="inline-block text-blue-400 text-sm font-semibold uppercase tracking-wider mb-4"
                        >
                            Features
                        </motion.span>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 px-4">
                            Everything Engineers Need
                        </h2>
                        <p className="mt-4 text-slate-400 max-w-2xl mx-auto text-sm sm:text-base px-4">
                            Professional-grade structural analysis tools powered by modern web technologies. 
                            From simple beams to complex 3D frames — we've got you covered.
                        </p>
                    </div>

                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
                    >
                        {FEATURES.map((feature, idx) => (
                            <FeatureCard key={idx} {...feature} />
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-20 sm:py-24 bg-slate-900/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12 sm:mb-16">
                        <motion.span 
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            className="inline-block text-blue-400 text-sm font-semibold uppercase tracking-wider mb-4"
                        >
                            Pricing
                        </motion.span>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 px-4">
                            Simple, Transparent Pricing
                        </h2>
                        <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base px-4">
                            Choose the perfect plan for your engineering needs. All plans include core analysis features.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
                        {PRICING_TIERS.map((tier, index) => (
                            <motion.div
                                key={tier.name}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className={`relative flex flex-col rounded-2xl sm:rounded-3xl p-6 sm:p-8 ${tier.popular
                                    ? 'bg-slate-900 border-2 border-blue-500/50 shadow-2xl shadow-blue-500/10 lg:scale-105 z-10'
                                    : 'bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all'
                                    }`}
                            >
                                {tier.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg uppercase tracking-wider whitespace-nowrap">
                                        Most Popular
                                    </div>
                                )}
                                <div className="mb-6">
                                    <h3 className={`text-xl sm:text-2xl font-bold mb-2 ${tier.popular ? 'text-white' : 'text-slate-200'}`}>
                                        {tier.name}
                                    </h3>
                                    <p className="text-sm text-slate-400">{tier.description}</p>
                                </div>
                                <div className="mb-6 sm:mb-8">
                                    <span className="text-3xl sm:text-4xl font-bold text-white">{tier.price}</span>
                                    {tier.period && <span className="text-slate-500 ml-1">/{tier.period}</span>}
                                </div>

                                <button
                                    onClick={handleGetStarted}
                                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all mb-6 sm:mb-8 ${tier.popular
                                        ? 'bg-white text-slate-950 hover:bg-slate-100 shadow-lg'
                                        : 'bg-slate-800 text-white hover:bg-slate-700'
                                        }`}
                                >
                                    {tier.cta}
                                </button>

                                <ul className="space-y-3 sm:space-y-4 flex-1">
                                    {tier.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm text-slate-300">
                                            <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${tier.popular ? 'text-blue-400' : 'text-slate-600'}`} />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
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
            <footer className="border-t border-slate-800 py-12 sm:py-16 bg-slate-950">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                        <div className="col-span-2">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-9 h-9 flex items-center justify-center rounded-lg overflow-hidden">
                                    <img src={beamLabLogo} alt="BeamLab" className="w-full h-full object-cover" />
                                </div>
                                <span className="text-xl font-bold text-white">BeamLab Ultimate</span>
                            </div>
                            <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-6">
                                Professional structural analysis software, reimagined for the modern web.
                                Fast, accurate, and accessible anywhere — no installation required.
                            </p>
                            <div className="flex gap-4">
                                <a href="https://github.com" className="text-slate-500 hover:text-white transition-colors" aria-label="GitHub">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                                </a>
                                <a href="https://twitter.com" className="text-slate-500 hover:text-white transition-colors" aria-label="Twitter">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                                </a>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Product</h4>
                            <ul className="space-y-3 text-sm">
                                <li><a href="#features" className="text-slate-400 hover:text-white transition-colors">Features</a></li>
                                <li><a href="#pricing" className="text-slate-400 hover:text-white transition-colors">Pricing</a></li>
                                <li><Link to="/help" className="text-slate-400 hover:text-white transition-colors">Documentation</Link></li>
                                <li><Link to="/demo" className="text-slate-400 hover:text-white transition-colors">Live Demo</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Legal</h4>
                            <ul className="space-y-3 text-sm">
                                <li><Link to="/privacy" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</Link></li>
                                <li><Link to="/terms" className="text-slate-400 hover:text-white transition-colors">Terms of Service</Link></li>
                                <li><Link to="/contact" className="text-slate-400 hover:text-white transition-colors">Contact Us</Link></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <p className="text-slate-500 text-sm">© 2026 BeamLab Ultimate. All rights reserved.</p>
                        <p className="text-slate-600 text-xs">Made with ❤️ for structural engineers worldwide</p>
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
        className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/30 hover:bg-slate-800/50 transition-all group h-full flex flex-col"
    >
        <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors flex-shrink-0">
            {icon}
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-slate-100 mb-3">{title}</h3>
        <p className="text-slate-400 leading-relaxed text-sm mb-6 flex-grow">{desc}</p>
        <ul className="space-y-2 mt-auto">
            {bullets.map((bullet, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-500/50 flex-shrink-0" />
                    <span>{bullet}</span>
                </li>
            ))}
        </ul>
    </motion.div>
);

const TRUSTED_COMPANIES = ['AECOM', 'Bechtel', 'Fluor', 'WSP', 'Jacobs'];

const FEATURES = [
    {
        title: '3D Visualization',
        desc: 'Realistic I-beams, channels, and custom sections rendered in real-time with GPU-accelerated graphics. See stress heatmaps and deformed shapes instantly.',
        icon: <Layers className="w-6 h-6" />,
        bullets: ['Real-time deformation', 'Stress heatmaps', 'GPU instanced rendering'],
    },
    {
        title: 'Transparent Analysis',
        desc: 'See every formula, step, and calculation. Full Fixed-End Moments, stiffness matrices, and equilibrium equations — no black boxes.',
        icon: <Terminal className="w-6 h-6" />,
        bullets: ['Step-by-step calculations', 'Moment distribution', 'Full traceability'],
    },
    {
        title: 'AI-Powered Design',
        desc: 'Describe your structure in plain English. Our Gemini-powered AI generates complete 3D models with proper sections and supports.',
        icon: <Zap className="w-6 h-6" />,
        bullets: ['Natural language input', 'Smart modifications', 'Auto optimization'],
    },
    {
        title: 'Professional Reports',
        desc: 'Export comprehensive PDF reports with diagrams, calculations, and your branding in one click. Code compliance included.',
        icon: <Globe2 className="w-6 h-6" />,
        bullets: ['Customizable headers', 'Vector diagrams', 'Code compliance'],
    },
    {
        title: 'Advanced Loads',
        desc: 'Full support for UDL, triangular, trapezoidal, and point loads with proper Fixed-End Moment conversion. Seismic and wind loads included.',
        icon: <Shield className="w-6 h-6" />,
        bullets: ['Dead loads & live loads', 'Seismic (IS 1893)', 'Wind (ASCE 7)'],
    },
    {
        title: 'Large Structures',
        desc: 'Handle massive models with up to 300,000 members using GPU-accelerated sparse solvers and instanced rendering.',
        icon: <Cpu className="w-6 h-6" />,
        bullets: ['300K+ members', 'Sparse matrix solvers', 'WebGPU acceleration'],
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
