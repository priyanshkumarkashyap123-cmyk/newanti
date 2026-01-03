/**
 * LandingPageEnhanced - BeamLab Ultimate Landing Page (Advanced Template)
 * Professional SaaS homepage with enhanced gradients, social proof, and advanced features
 */

import { FC, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { useAuth, isUsingClerk } from '../providers/AuthProvider';

// Animation variants
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

export const LandingPageEnhanced: FC = () => {
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { isSignedIn, isLoaded, signOut } = useAuth();
    const isClerkEnabled = isUsingClerk();

    const handleGetStarted = () => {
        if (isSignedIn) {
            navigate('/dashboard');
        } else {
            navigate('/sign-up');
        }
    };

    const renderAuthButtons = () => {
        if (!isLoaded) return null;

        if (isSignedIn) {
            return (
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex h-10 items-center justify-center rounded-lg bg-steel-blue px-4 text-sm font-bold text-white transition-all hover:bg-steel-blue/90"
                    >
                        Open Dashboard
                    </button>
                    {isClerkEnabled ? (
                        <UserButton afterSignOutUrl="/" />
                    ) : (
                        <button
                            onClick={() => signOut()}
                            className="text-sm font-medium text-steel-blue/80 hover:text-steel-blue"
                        >
                            Sign Out
                        </button>
                    )}
                </div>
            );
        }

        if (isClerkEnabled) {
            return (
                <>
                    <SignInButton mode="modal">
                        <button className="text-sm font-bold text-steel-blue hover:underline">Log in</button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                        <button className="flex h-10 items-center justify-center rounded-lg bg-steel-blue px-4 text-sm font-bold text-white transition-all hover:bg-steel-blue/90 hover:shadow-md">
                            Get Started
                        </button>
                    </SignUpButton>
                </>
            );
        }

        return (
            <>
                <Link to="/sign-in" className="text-sm font-bold text-steel-blue hover:underline">Log in</Link>
                <Link
                    to="/sign-up"
                    className="flex h-10 items-center justify-center rounded-lg bg-steel-blue px-4 text-sm font-bold text-white transition-all hover:bg-steel-blue/90 hover:shadow-md"
                >
                    Get Started
                </Link>
            </>
        );
    };

    return (
        <div className="min-h-screen bg-background-light font-display">
            {/* NAVBAR */}
            <header className="sticky top-0 z-50 w-full border-b border-border-light bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-steel-blue">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>architecture</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-steel-blue">BeamLab Ultimate</span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm font-medium text-steel-blue/80 hover:text-steel-blue transition-colors">Features</a>
                        <a href="#pricing" className="text-sm font-medium text-steel-blue/80 hover:text-steel-blue transition-colors">Pricing</a>
                        <Link to="/capabilities" className="text-sm font-medium text-steel-blue/80 hover:text-steel-blue transition-colors">Docs</Link>
                    </nav>

                    <div className="hidden md:flex items-center gap-4">
                        {renderAuthButtons()}
                    </div>

                    <button
                        className="md:hidden p-2"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
                    </button>
                </div>

                {mobileMenuOpen && (
                    <div className="md:hidden bg-white border-t border-border-light py-4 px-4">
                        <div className="flex flex-col gap-4">
                            <a href="#features" className="text-steel-blue font-medium">Features</a>
                            <a href="#pricing" className="text-steel-blue font-medium">Pricing</a>
                            <Link to="/capabilities" className="text-steel-blue font-medium">Docs</Link>
                            <hr className="border-border-light" />
                            <button
                                onClick={handleGetStarted}
                                className="bg-steel-blue text-white rounded-lg px-4 py-2 font-bold w-full"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                )}
            </header>

            {/* HERO SECTION - ENHANCED */}
            <section className="relative flex min-h-[700px] flex-col justify-center overflow-hidden bg-gradient-to-br from-background-light via-white to-blue-50 pt-20 pb-24 lg:pt-32 lg:pb-40">
                {/* Animated gradient orbs */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-accent/30 to-primary/20 rounded-full blur-3xl opacity-50 animate-float"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-primary/20 to-accent/30 rounded-full blur-3xl opacity-40 animate-float" style={{ animationDelay: '2s' }}></div>

                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 mb-8"
                    >
                        <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-semibold text-green-700 uppercase tracking-wider">🚀 v2.0 Now Live</span>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mx-auto max-w-5xl text-5xl font-bold leading-tight tracking-tight text-steel-blue sm:text-6xl lg:text-7xl"
                    >
                        Professional Structural Analysis{' '}
                        <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                            In Your Browser
                        </span>
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mx-auto mt-6 max-w-3xl text-xl text-steel-blue/70 leading-relaxed"
                    >
                        Free, instant, and professional-grade FEA. No downloads, no waiting. Create, analyze, and export structural models in seconds.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
                    >
                        <button
                            onClick={handleGetStarted}
                            className="group flex h-14 min-w-[220px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-blue-600 px-8 text-base font-bold text-white transition-all hover:shadow-2xl hover:shadow-primary/40 hover:scale-105"
                        >
                            Start Analyzing for Free
                            <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
                        </button>
                        <button className="flex h-14 min-w-[220px] items-center justify-center gap-2 rounded-xl border-2 border-steel-blue/20 bg-white px-8 text-base font-bold text-steel-blue transition-all hover:bg-gray-50 hover:border-steel-blue/40">
                            <span className="material-symbols-outlined">play_circle</span>
                            Watch Demo
                        </button>
                    </motion.div>

                    {/* Social Proof */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-16 flex flex-col items-center gap-4"
                    >
                        <p className="text-sm text-steel-blue/60 uppercase tracking-wider font-semibold">Trusted by engineers at</p>
                        <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
                            {TRUSTED_COMPANIES.map((company) => (
                                <div key={company} className="px-4 py-2 text-lg font-bold text-steel-blue/70">
                                    {company}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* FEATURES SECTION */}
            <section id="features" className="bg-white py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-2xl text-center mb-16">
                        <h2 className="text-4xl font-bold tracking-tight text-steel-blue">Powerful Features for Modern Engineers</h2>
                        <p className="mt-4 text-lg text-steel-blue/70">Everything you need to design, analyze, and verify your structures.</p>
                    </div>

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={staggerContainer}
                        className="grid grid-cols-1 gap-8 md:grid-cols-3"
                    >
                        {FEATURES.map((feature) => (
                            <motion.div
                                key={feature.title}
                                variants={fadeInUp}
                                className="group relative rounded-2xl border border-steel-blue/10 bg-gradient-to-br from-white to-gray-50 p-8 transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10"
                            >
                                <div className={`mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl ${feature.bgColor} group-hover:scale-110 transition-transform`}>
                                    <span className="material-symbols-outlined text-[36px]">{feature.icon}</span>
                                </div>
                                <h3 className="text-xl font-bold text-steel-blue mb-3">{feature.title}</h3>
                                <p className="text-steel-blue/70 mb-4">{feature.description}</p>
                                <ul className="space-y-2">
                                    {feature.bullets.map((bullet) => (
                                        <li key={bullet} className="flex items-center gap-2 text-sm text-steel-blue/80">
                                            <span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span>
                                            {bullet}
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* PRICING SECTION - ENHANCED */}
            <section id="pricing" className="py-24 bg-gradient-to-b from-gray-50 to-white">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl font-bold tracking-tight text-steel-blue mb-4">
                            Simple, Transparent Pricing
                        </h2>
                        <p className="text-lg text-steel-blue/70 max-w-2xl mx-auto">
                            Choose the perfect plan for your engineering needs. All plans include core analysis features.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {PRICING_TIERS.map((tier) => (
                            <div
                                key={tier.name}
                                className={`relative flex flex-col rounded-3xl p-8 ${tier.popular
                                    ? 'bg-gradient-to-br from-primary to-blue-600 text-white shadow-2xl shadow-primary/30 transform md:scale-110 z-10 border-4 border-white'
                                    : 'bg-white border-2 border-gray-200 hover:border-primary/30 hover:shadow-xl transition-all'
                                    }`}
                            >
                                {tier.popular && (
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-accent text-steel-blue text-xs font-bold px-4 py-2 rounded-full shadow-lg uppercase tracking-wider">
                                        ⭐ Most Popular
                                    </div>
                                )}
                                <div className="mb-6">
                                    <h3 className={`text-2xl font-bold mb-2 ${tier.popular ? 'text-white' : 'text-steel-blue'}`}>{tier.name}</h3>
                                    <p className={`text-sm ${tier.popular ? 'text-white/80' : 'text-steel-blue/60'}`}>{tier.description}</p>
                                </div>
                                <div className={`mb-6 ${tier.popular ? 'text-white' : 'text-steel-blue'}`}>
                                    <span className="text-5xl font-black tracking-tight">{tier.price}</span>
                                    {tier.period && <span className="text-lg font-bold opacity-70">/{tier.period}</span>}
                                </div>
                                <button
                                    onClick={handleGetStarted}
                                    className={`w-full py-4 rounded-xl font-bold text-base transition-all mb-8 ${tier.popular
                                        ? 'bg-white text-primary hover:bg-gray-100 shadow-lg'
                                        : 'bg-steel-blue text-white hover:bg-steel-blue/90'
                                        }`}
                                >
                                    {tier.cta}
                                </button>
                                <ul className="space-y-4 flex-1">
                                    {tier.features.map((feature) => (
                                        <li key={feature} className={`flex items-start gap-3 text-sm ${tier.popular ? 'text-white' : 'text-steel-blue/80'}`}>
                                            <span className={`material-symbols-outlined text-[20px] mt-0.5 ${tier.popular ? 'text-accent' : 'text-green-500'}`}>check_circle</span>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    <p className="text-center text-sm text-steel-blue/60 mt-12">
                        All plans include 24/7 support and regular updates. Cancel anytime.
                    </p>
                </div>
            </section>

            {/* CTA SECTION */}
            <section className="bg-gradient-to-r from-primary to-blue-600 py-20">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-4xl font-bold text-white mb-6">
                        Ready to Transform Your Workflow?
                    </h2>
                    <p className="text-xl text-white/90 mb-10">
                        Join thousands of engineers using BeamLab Ultimate for their structural analysis needs.
                    </p>
                    <button
                        onClick={handleGetStarted}
                        className="inline-flex items-center gap-3 h-16 px-10 bg-accent hover:bg-accent-dark text-steel-blue rounded-xl text-lg font-bold transition-all hover:scale-105 shadow-2xl shadow-black/20"
                    >
                        Get Started Free
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                    <p className="text-white/70 text-sm mt-6">No credit card required • Free forever plan available</p>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="border-t border-gray-200 bg-steel-blue text-white">
                <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {/* Brand */}
                        <div className="col-span-2">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="flex h-8 w-8 items-center justify-center rounded bg-accent">
                                    <span className="material-symbols-outlined text-steel-blue" style={{ fontSize: '20px' }}>architecture</span>
                                </div>
                                <span className="text-xl font-bold">BeamLab Ultimate</span>
                            </div>
                            <p className="text-sm text-slate-300 max-w-sm mb-6">
                                Professional structural analysis software, reimagined for the modern web. Fast, accurate, and accessible anywhere.
                            </p>
                            <div className="flex gap-4">
                                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined">mail</span>
                                </a>
                                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined">public</span>
                                </a>
                            </div>
                        </div>

                        {/* Links */}
                        <div>
                            <h4 className="font-bold mb-4">Product</h4>
                            <ul className="space-y-3 text-sm">
                                <li><a href="#features" className="text-slate-300 hover:text-white transition-colors">Features</a></li>
                                <li><a href="#pricing" className="text-slate-300 hover:text-white transition-colors">Pricing</a></li>
                                <li><Link to="/capabilities" className="text-slate-300 hover:text-white transition-colors">Documentation</Link></li>
                                <li><Link to="/workspace-demo" className="text-slate-300 hover:text-white transition-colors">Workspace Demo</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold mb-4">Company</h4>
                            <ul className="space-y-3 text-sm">
                                <li><Link to="/privacy" className="text-slate-300 hover:text-white transition-colors">Privacy Policy</Link></li>
                                <li><a href="#" className="text-slate-300 hover:text-white transition-colors">Terms of Service</a></li>
                                <li><Link to="/help" className="text-slate-300 hover:text-white transition-colors">Help Center</Link></li>
                                <li><a href="#" className="text-slate-300 hover:text-white transition-colors">Contact Us</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-xs text-slate-400">© 2025 BeamLab Ultimate. All rights reserved.</p>
                        <p className="text-xs text-slate-400">Built with ❤️ for structural engineers worldwide</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

// DATA
const TRUSTED_COMPANIES = ['AECOM', 'Bechtel', 'Fluor', 'WSP', 'Jacobs'];

const FEATURES = [
    {
        title: 'True 3D Visualization',
        description: 'Realistic I-beams, channels, and custom sections rendered in real-time with professional graphics.',
        icon: 'view_in_ar',
        bgColor: 'bg-blue-500/20 text-blue-600',
        bullets: ['Real-time deformation', 'Stress heatmaps', 'Multiple viewports'],
    },
    {
        title: 'Transparent Math',
        description: 'See every formula, step, and calculation. No black boxes, just clear engineering.',
        icon: 'calculate',
        bgColor: 'bg-orange-500/20 text-orange-600',
        bullets: ['Step-by-step calcs', 'Moment distribution', 'Full traceability'],
    },
    {
        title: 'Instant Reports',
        description: 'Export professional PDF reports in one click with diagrams, calculations, and branding.',
        icon: 'picture_as_pdf',
        bgColor: 'bg-green-500/20 text-green-600',
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
        features: ['Unlimited projects', 'Advanced 3D analysis', 'P-Delta & buckling', 'Custom PDF branding', 'Priority email support', 'Cloud storage', 'Code check modules'],
        cta: 'Start Free Trial',
        popular: true,
    },
    {
        name: 'Enterprise',
        description: 'For teams and organizations',
        price: 'Custom',
        period: null,
        features: ['Everything in Professional', 'SSO & user management', 'API access', 'Custom integrations', 'Dedicated account manager', 'Training & onboarding', 'SLA guarantee'],
        cta: 'Contact Sales',
        popular: false,
    },
];

export default LandingPageEnhanced;
