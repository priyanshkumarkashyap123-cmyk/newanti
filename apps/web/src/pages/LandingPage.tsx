/**
 * LandingPage - BeamLab Ultimate Landing Page
 * Professional SaaS homepage with construction yellow accent
 */

import { FC, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { useAuth, isUsingClerk } from '../providers/AuthProvider';
import useTierAccess from '../hooks/useTierAccess';

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

    // Use unified auth hook
    const { isSignedIn, isLoaded, signOut } = useAuth();
    const useClerk = isUsingClerk();

    // Get user tier for tier-aware UI
    const { isPro, isEnterprise, isFree } = useTierAccess();

    const handleGetStarted = () => {
        if (isSignedIn) {
            navigate('/stream');  // Go to Stream Dashboard
        } else {
            navigate('/sign-up');
        }
    };

    // Render auth buttons based on auth provider
    const renderAuthButtons = () => {
        if (!isLoaded) return null;

        if (isSignedIn) {
            return (
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/app')}
                        className="flex h-10 items-center justify-center rounded-lg bg-steel-blue px-4 text-sm font-bold text-white transition-all hover:bg-steel-blue/90"
                    >
                        Open App
                    </button>
                    {useClerk ? (
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

        // Not signed in
        if (useClerk) {
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

        // In-house auth buttons
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
            {/* ================================================
                NAVBAR
                ================================================ */}
            <header className="sticky top-0 z-50 w-full border-b border-border-light bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-steel-blue">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>architecture</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-steel-blue">BeamLab Ultimate</span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm font-medium text-steel-blue/80 hover:text-steel-blue transition-colors">Features</a>
                        <a href="#pricing" className="text-sm font-medium text-steel-blue/80 hover:text-steel-blue transition-colors">Pricing</a>
                        <Link to="/capabilities" className="text-sm font-medium text-steel-blue/80 hover:text-steel-blue transition-colors">Docs</Link>
                    </nav>

                    {/* Auth Buttons */}
                    <div className="hidden md:flex items-center gap-4">
                        {renderAuthButtons()}
                    </div>

                    {/* Mobile Menu */}
                    <button
                        className="md:hidden p-2"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
                    </button>
                </div>

                {/* Mobile Menu Dropdown */}
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

            {/* ================================================
                HERO SECTION
                ================================================ */}
            <section className="relative flex min-h-[600px] flex-col justify-center overflow-hidden bg-background-light pt-16 pb-20 lg:pt-24 lg:pb-32">
                {/* Grid Background */}
                <div className="absolute inset-0 grid-pattern opacity-50" />

                {/* Yellow Gradient */}
                <div className="absolute right-0 top-0 -z-10 h-full w-1/2 translate-x-1/4 opacity-10 blur-3xl">
                    <div className="h-full w-full bg-gradient-to-bl from-accent to-transparent" />
                </div>

                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 rounded-full border border-steel-blue/10 bg-white px-3 py-1 mb-8 shadow-sm"
                    >
                        <span className="flex h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-xs font-semibold text-steel-blue/70 uppercase tracking-wider">v2.0 Now Available</span>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mx-auto max-w-4xl text-5xl font-bold leading-tight tracking-tight text-steel-blue sm:text-6xl lg:text-7xl"
                    >
                        Structural Analysis{' '}
                        <span className="relative whitespace-nowrap text-steel-blue">
                            <svg aria-hidden="true" className="absolute left-0 top-2/3 h-[0.58em] w-full fill-accent/40" preserveAspectRatio="none" viewBox="0 0 418 42">
                                <path d="M203.371.916c-26.013-2.078-76.686 1.963-124.73 9.946L67.3 12.749C61.16 13.643 45.698 15.696 20.916 20.457c-13.437 2.61-3.696.536-12.261 2.308-4.303.882-8.586 1.763-12.869 2.646L0 27.63c21.841-3.837 83.189-13.313 184.073-19.167 122.42-7.1 233.15 1.166 306.924 10.375 19.336 2.416 34.405 4.544 45.214 6.386 10.809 1.842 17.202 3.09 19.181 3.743l-4.223 9.172c-1.979-.653-8.372-1.901-19.181-3.743-10.809-1.842-25.878-3.97-45.214-6.386-73.774-9.209-184.504-17.475-306.924-10.375-100.884 5.854-162.232 15.33-184.073 19.167l-4.223-2.22c4.283-.883 8.566-1.764 12.869-2.646 8.565-1.772 -1.176.302 12.261-2.308 24.782-4.761 40.244-6.814 46.384-7.708l11.341-1.887c48.044-7.983 98.717-12.024 124.73-9.946l2.126-10.59z"></path>
                            </svg>
                            <span className="relative">in Your Browser</span>
                        </span>
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mx-auto mt-6 max-w-2xl text-lg text-steel-blue/70 sm:text-xl"
                    >
                        Free, instant, and professional grade. Perform complex structural calculations without the heavy software downloads.
                    </motion.p>

                    {/* CTA Buttons - Tier Aware */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
                    >
                        {(isPro || isEnterprise) && isSignedIn ? (
                            // Pro/Enterprise users see "Open Workspace"
                            <button
                                onClick={() => navigate('/app')}
                                className="group flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-lg bg-steel-blue px-8 text-base font-bold text-white transition-all hover:bg-steel-blue/90 hover:scale-105 shadow-lg"
                            >
                                Open Workspace
                                <span className="material-symbols-outlined transition-transform group-hover:translate-x-1" style={{ fontSize: '20px' }}>arrow_forward</span>
                            </button>
                        ) : (
                            // Free users and guests see "Start Analyzing for Free"
                            <button
                                onClick={handleGetStarted}
                                className="group flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-lg bg-accent px-8 text-base font-bold text-steel-blue transition-all hover:bg-accent-dark hover:scale-105 shadow-lg shadow-accent/20"
                            >
                                Start Analyzing for Free
                                <span className="material-symbols-outlined transition-transform group-hover:translate-x-1" style={{ fontSize: '20px' }}>arrow_forward</span>
                            </button>
                        )}

                        {/* Show upgrade button for free users who are signed in */}
                        {isFree && isSignedIn ? (
                            <Link
                                to="/pricing"
                                className="flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-lg border-2 border-accent bg-white px-8 text-base font-bold text-steel-blue transition-all hover:bg-accent/10"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>bolt</span>
                                Upgrade to Pro
                            </Link>
                        ) : (
                            <button className="flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-lg border-2 border-steel-blue/10 bg-white px-8 text-base font-bold text-steel-blue transition-all hover:bg-gray-50">
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>play_circle</span>
                                Watch Demo
                            </button>
                        )}
                    </motion.div>

                    {/* Browser Mockup */}
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                        className="relative mx-auto mt-16 max-w-5xl lg:mt-24"
                    >
                        <div className="relative overflow-hidden rounded-xl border border-steel-blue/10 bg-white shadow-2xl">
                            {/* Browser Header */}
                            <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-4 py-3">
                                <div className="h-3 w-3 rounded-full bg-red-400" />
                                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                                <div className="h-3 w-3 rounded-full bg-green-400" />
                                <div className="ml-4 h-6 w-full max-w-lg rounded-md bg-white shadow-sm border border-gray-100" />
                            </div>

                            {/* Screenshot Area */}
                            <div className="aspect-[16/9] w-full bg-gradient-to-br from-background-dark to-surface-dark relative group overflow-hidden">
                                {/* Placeholder Grid Pattern */}
                                <div className="absolute inset-0 grid-pattern opacity-30" />

                                {/* Mock UI Elements */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                        <span className="material-symbols-outlined text-6xl text-primary/60">deployed_code</span>
                                        <p className="text-white/60 text-lg mt-4 font-medium">3D Structural Analysis</p>
                                        <p className="text-white/40 text-sm mt-2">Click "Start Analyzing" to begin</p>
                                    </div>
                                </div>

                                {/* Floating Property Panel Mock */}
                                <div className="absolute right-4 top-4 w-48 bg-surface-dark/90 backdrop-blur rounded-lg shadow-lg p-4 hidden sm:block border border-border-dark">
                                    <div className="h-2 w-20 bg-primary/40 rounded mb-3" />
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-text-muted">Material</span>
                                            <span className="text-white font-mono">Steel S355</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-text-muted">Section</span>
                                            <span className="text-white font-mono">IPE 300</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Floating Status */}
                                <div className="absolute bottom-4 right-4 bg-primary text-white p-3 rounded-lg shadow-lg flex items-center gap-3">
                                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: '20px' }}>sync</span>
                                    <span className="text-sm font-medium">Ready to Analyze</span>
                                </div>
                            </div>
                        </div>

                        {/* Decorative Blurs */}
                        <div className="absolute -top-12 -left-12 -z-10 h-[300px] w-[300px] rounded-full bg-accent/20 blur-3xl filter" />
                        <div className="absolute -bottom-12 -right-12 -z-10 h-[300px] w-[300px] rounded-full bg-primary/20 blur-3xl filter" />
                    </motion.div>
                </div>
            </section>


            {/* ================================================
                FEATURES SECTION
                ================================================ */}
            <section id="features" className="bg-background-light py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-steel-blue sm:text-4xl">Powerful Features for Modern Engineers</h2>
                        <p className="mt-4 text-lg text-steel-blue/70">Everything you need to design, analyze, and verify your structures, right from your web browser.</p>
                    </div>

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={staggerContainer}
                        className="mx-auto mt-16 max-w-7xl"
                    >
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                            {FEATURES.map((feature) => (
                                <motion.div
                                    key={feature.title}
                                    variants={fadeInUp}
                                    className="group relative rounded-2xl border border-steel-blue/10 bg-white p-8 transition-all hover:-translate-y-1 hover:shadow-xl"
                                >
                                    <div className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl ${feature.bgColor} group-hover:bg-accent group-hover:text-steel-blue transition-colors`}>
                                        <span className="material-symbols-outlined text-[32px]">{feature.icon}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-steel-blue">{feature.title}</h3>
                                    <p className="mt-4 text-steel-blue/70">{feature.description}</p>
                                    <ul className="mt-6 space-y-2">
                                        {feature.bullets.map((bullet) => (
                                            <li key={bullet} className="flex items-center gap-2 text-sm text-steel-blue/80">
                                                <span className="material-symbols-outlined text-green-500" style={{ fontSize: '18px' }}>check_circle</span>
                                                {bullet}
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ================================================
                PRICING SECTION
                ================================================ */}
            <section id="pricing" className="py-24 bg-white">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold tracking-tight text-steel-blue sm:text-4xl">
                            Engineering-grade precision, priced for scale.
                        </h2>
                        <p className="mt-4 text-lg text-steel-blue/70">
                            Choose the right plan for your structural analysis needs.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {PRICING_TIERS.map((tier) => (
                            <div
                                key={tier.name}
                                className={`relative flex flex-col gap-6 rounded-2xl p-8 ${tier.popular
                                    ? 'border-2 border-accent bg-white shadow-xl transform md:-translate-y-4 z-10'
                                    : 'border border-border-light bg-white hover:shadow-lg transition-shadow'
                                    }`}
                            >
                                {tier.popular && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-steel-blue text-xs font-bold px-4 py-1.5 rounded-full shadow-sm uppercase tracking-wide">
                                        Most Popular
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-xl font-bold text-steel-blue">{tier.name}</h3>
                                    <p className="text-steel-blue/60 text-sm mt-1">{tier.description}</p>
                                    <div className="mt-4 flex items-baseline gap-1 text-steel-blue">
                                        <span className="text-4xl font-black tracking-tight">{tier.price}</span>
                                        {tier.period && <span className="text-base font-bold text-steel-blue/60">/{tier.period}</span>}
                                    </div>
                                </div>
                                <button
                                    onClick={handleGetStarted}
                                    className={`w-full py-3 rounded-lg font-bold transition-all ${tier.popular
                                        ? 'bg-accent hover:bg-accent-dark text-steel-blue shadow-md hover:shadow-lg'
                                        : 'bg-steel-blue hover:bg-steel-blue/90 text-white'
                                        }`}
                                >
                                    {tier.cta}
                                </button>
                                <ul className="space-y-3">
                                    {tier.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm text-steel-blue/80">
                                            <span className="material-symbols-outlined text-accent" style={{ fontSize: '20px' }}>check_circle</span>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ================================================
                FOOTER
                ================================================ */}
            <footer className="border-t border-gray-100 bg-steel-blue text-white">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                        {/* Brand */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-steel-blue">
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>architecture</span>
                                </div>
                                <span className="text-xl font-bold tracking-tight">BeamLab Ultimate</span>
                            </div>
                            <p className="text-sm leading-6 text-slate-300 max-w-xs">
                                Empowering civil and structural engineers with cloud-native analysis tools.
                            </p>
                        </div>

                        {/* Links */}
                        <div className="flex flex-col md:items-center">
                            <div className="flex gap-8">
                                <a href="#features" className="text-sm font-semibold text-white hover:text-accent transition-colors">Features</a>
                                <a href="#pricing" className="text-sm font-semibold text-white hover:text-accent transition-colors">Pricing</a>
                                <Link to="/capabilities" className="text-sm font-semibold text-white hover:text-accent transition-colors">Docs</Link>
                                <Link to="/help" className="text-sm font-semibold text-white hover:text-accent transition-colors">Support</Link>
                            </div>
                        </div>

                        {/* Socials */}
                        <div className="flex flex-col md:items-end gap-4">
                            <div className="flex space-x-6">
                                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined">mail</span>
                                </a>
                                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined">public</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Bar with Legal Links */}
                    <div className="mt-8 border-t border-white/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <p className="text-xs leading-5 text-slate-400">© 2025 BeamLab Ultimate. All rights reserved.</p>
                        <div className="flex gap-6">
                            <Link to="/terms" className="text-xs text-slate-400 hover:text-white transition-colors">Terms of Service</Link>
                            <Link to="/privacy" className="text-xs text-slate-400 hover:text-white transition-colors">Privacy Policy</Link>
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

const FEATURES = [
    {
        title: 'True 3D Visualization',
        description: 'Realistic I-beams, channels, and custom sections rendered in real-time. Visualize actual steel and timber members in 3D space.',
        icon: 'view_in_ar',
        bgColor: 'bg-primary/20 text-primary',
        bullets: ['Real-time deformation', 'Stress heatmaps'],
    },
    {
        title: 'Transparent Math',
        description: 'No black boxes here. See the formulas, logic, and intermediate steps for every calculation, just like hand calcs.',
        icon: 'calculate',
        bgColor: 'bg-orange-100 text-orange-600',
        bullets: ['Step-by-step calcs', 'Moment distribution'],
    },
    {
        title: 'Instant Reports',
        description: 'Export professional, branded PDF engineering reports in one click with diagrams, load cases, and calculation steps.',
        icon: 'picture_as_pdf',
        bgColor: 'bg-green-100 text-green-600',
        bullets: ['Customizable headers', 'Vector quality diagrams'],
    },
];

const PRICING_TIERS = [
    {
        name: 'Free',
        description: 'Perfect for students and quick checks.',
        price: '$0',
        period: 'mo',
        features: ['Basic beam calculations', '2D Frame analysis', 'Community support forums'],
        cta: 'Sign Up Free',
        popular: false,
    },
    {
        name: 'Pro',
        description: 'For professional engineers & firms.',
        price: '$49',
        period: 'mo',
        features: ['Everything in Free, plus:', 'Advanced 3D analysis engine', 'Customizable PDF reports', 'Priority email support', 'Unlimited project storage'],
        cta: 'Start Pro Trial',
        popular: true,
    },
    {
        name: 'Enterprise',
        description: 'Maximum power and control.',
        price: 'Custom',
        period: null,
        features: ['Everything in Pro, plus:', 'API Access & Integrations', 'Multi-user management (SSO)', 'Dedicated account manager'],
        cta: 'Contact Sales',
        popular: false,
    },
];

export default LandingPage;
