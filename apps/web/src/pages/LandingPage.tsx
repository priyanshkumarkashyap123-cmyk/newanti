/**
 * LandingPage - BeamLab Ultimate Landing Page
 * Premium Dark SaaS homepage with vibrant gradients
 */

import { FC, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { useAuth, isUsingClerk } from '../providers/AuthProvider';
import useTierAccess from '../hooks/useTierAccess';
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
    Cpu
} from 'lucide-react';

const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
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
    const { isPro } = useTierAccess();

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
                            <div className="relative w-8 h-8 flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow-lg group-hover:shadow-blue-500/25 transition-all">
                                <Cpu className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                                BeamLab Ultimate
                            </span>
                        </Link>

                        {/* Desktop Links */}
                        <div className="hidden md:flex items-center gap-8">
                            <a href="#features" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Features</a>
                            <a href="#pricing" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Pricing</a>
                            <Link to="/docs" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Docs</Link>
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
                        <Link to="/docs" className="block text-slate-400 hover:text-white">Docs</Link>
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
                    <div className="absolute top-20 left-10 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px] opacity-50 mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
                    <div className="absolute top-40 right-10 w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-[100px] opacity-50 mix-blend-screen animate-pulse" style={{ animationDuration: '7s' }} />
                </div>

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={fadeInUp}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-8"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        v2.0 Now Available
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
                        Perform complex finite element analysis directly in your browser.
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
                            className="h-12 px-8 rounded-full bg-white text-slate-950 font-bold text-base hover:bg-slate-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] flex items-center gap-2"
                        >
                            Start Analyzing Free <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => navigate('/demo')}
                            className="h-12 px-8 rounded-full bg-slate-800 border border-slate-700 text-white font-medium hover:bg-slate-700 transition-all"
                        >
                            View Live Demo
                        </button>
                    </motion.div>

                    {/* Dashboard Preview */}
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.8 }}
                        className="mt-20 relative mx-auto max-w-5xl"
                    >
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-30" />
                        <div className="relative rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur shadow-2xl overflow-hidden aspect-video">
                            {/* Placeholder for actual screenshot */}
                            <div className="w-full h-full flex items-center justify-center bg-slate-900/50">
                                <span className="text-slate-500">Dashboard Preview Image</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-slate-950 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Everything you need</h2>
                        <p className="mt-4 text-slate-400">Professional grade tools, modernized for the web era.</p>
                    </div>

                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-8"
                    >
                        <FeatureCard
                            icon={<Zap className="w-6 h-6 text-yellow-400" />}
                            title="Instant Results"
                            desc="Real-time solver feedback. See displacements and stresses update instantly as you design."
                        />
                        <FeatureCard
                            icon={<Globe2 className="w-6 h-6 text-cyan-400" />}
                            title="Cloud Native"
                            desc="Access your projects from anywhere. Share with team members via simple links."
                        />
                        <FeatureCard
                            icon={<Layers className="w-6 h-6 text-purple-400" />}
                            title="Advanced FEM"
                            desc="Full 6-DOF analysis with support for trusses, frames, and plates. Linear and non-linear."
                        />
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-800 py-12 bg-slate-900/30">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-slate-500 text-sm">© 2024 BeamLab Ultimate. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc }: { icon: any, title: string, desc: string }) => (
    <motion.div
        variants={fadeInUp}
        className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-all group"
    >
        <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <h3 className="text-xl font-bold text-slate-100 mb-2">{title}</h3>
        <p className="text-slate-400 leading-relaxed">{desc}</p>
    </motion.div>
);
