/**
 * LandingPage - BeamLab Landing Page
 * Premium Dark SaaS homepage with vibrant gradients
 * Merged with Enhanced features (v3.0)
 * Updated to match Figma spec 03_LANDING_MARKETING
 */

import { FC, useState, useEffect, useCallback, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, Variants } from "framer-motion";
import { UserButton } from "@clerk/clerk-react";
import { useAuth, isUsingClerk } from "../providers/AuthProvider";
import {
  CheckCircle,
  Menu,
  X,
  ArrowRight,
  Zap,
  Globe2,
  Shield,
  Layers,
  Cpu,
  Play,
  Terminal,
  Users,
  Cloud,
  FileText,
  Building,
  Database,
  Smartphone,
  Linkedin,
  Youtube,
  Star,
  Ruler,
  PenTool,
  Download,
  BarChart3,
  Compass,
  Activity,
} from "lucide-react";
import { Logo } from "../components/branding";
import { Button } from "../components/ui/button";
import {
  InteractiveDemo,
  CTABanner,
  PerformanceMetrics,
} from "../components/marketing/FeatureShowcase";

// Animation variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.6, -0.05, 0.01, 0.99] },
  },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

export const LandingPage: FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    document.title = 'BeamLab – Professional Structural Analysis Platform';
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const { isSignedIn, isLoaded, signOut } = useAuth();
  const isClerkEnabled = isUsingClerk();

  const handleGetStarted = useCallback(() => {
    if (isSignedIn) {
      navigate("/app");
    } else {
      navigate("/sign-up");
    }
  }, [isSignedIn, navigate]);

  const renderAuthButtons = () => {
    if (!isLoaded) return null;

    if (isSignedIn) {
      return (
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate("/app")}
            variant="default"
            size="sm"
            className="hidden md:flex gap-2"
          >
            Go to App <ArrowRight className="w-4 h-4" />
          </Button>
          {isClerkEnabled ? (
            <UserButton afterSignOutUrl="/" />
          ) : (
            <Button
              onClick={() => signOut()}
              variant="ghost"
              size="sm"
            >
              Sign Out
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-4">
        <Link
          to="/sign-in"
          className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors relative group"
        >
          Log in
          <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-500 transition-all group-hover:w-full" />
        </Link>
        <Button asChild variant="premium" size="default">
          <Link to="/sign-up" className="flex items-center gap-2">
            Get Started
          </Link>
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-blue-500/30">
      {/* Skip to main content - Accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Navbar - transparent at top, blurred on scroll */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl backdrop-saturate-150 border-b border-slate-200/60 dark:border-white/[0.06]'
            : 'bg-transparent border-b border-transparent'
        }`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Logo size="sm" />

            {/* Desktop Links - Properly centered with consistent spacing */}
            <div className="hidden md:flex items-center justify-center flex-1 px-8">
              <div className="flex items-center gap-6">
                <a href="#features" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1">Features</a>
                <a href="#tools" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1">Tools</a>
                <a href="#screenshots" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1">Screenshots</a>
                <a href="#pricing" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1">Pricing</a>
                <a href="#reviews" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1">Reviews</a>
                <a href="#compare" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1">Compare</a>
                <Link to="/demo" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1">Demo</Link>
              </div>
            </div>

            {/* Auth - Right aligned */}
            <div className="hidden md:flex items-center flex-shrink-0">
              {renderAuthButtons()}
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={
                mobileMenuOpen
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Menu className="w-5 h-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu - Improved design with accessibility */}
        {mobileMenuOpen && (
          <nav
            id="mobile-menu"
            className="md:hidden bg-slate-50 dark:bg-slate-900/95 backdrop-blur-xl border-b border-white/10 p-6 space-y-4"
            role="navigation"
            aria-label="Mobile navigation"
          >
            {[
              { href: '#features', label: 'Features' },
              { href: '#tools', label: 'Tools' },
              { href: '#screenshots', label: 'Screenshots' },
              { href: '#pricing', label: 'Pricing' },
              { href: '#reviews', label: 'Reviews' },
              { href: '#compare', label: 'Compare' },
            ].map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}
                className="block text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                {item.label}
              </a>
            ))}
            <Link to="/demo" onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              Demo
            </Link>
            <hr className="border-white/10 my-4" aria-hidden="true" />
            <div className="space-y-3">
              <Link
                to="/sign-in"
                className="block text-center text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-100 dark:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Log in
              </Link>
              <Button
                onClick={handleGetStarted}
                variant="premium"
                size="lg"
                className="w-full"
              >
                Get Started Free
              </Button>
            </div>
          </nav>
        )}
      </nav>

      {/* Hero Section */}
      <main id="main-content" role="main">
        <section
          className="relative pt-28 pb-20 lg:pt-44 lg:pb-36 overflow-hidden"
          aria-labelledby="hero-heading"
        >
          {/* Animated gradient mesh background */}
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-3xl will-change-transform"
            />
            <div
              className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-3xl will-change-transform"
            />
            <div
              className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-3xl will-change-transform"
            />
            {/* Subtle grid */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)",
                backgroundSize: "60px 60px",
              }}
            />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-10 backdrop-blur-sm"
              role="status"
              aria-label="Version 3.0 now live — open beta"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              v3.0 Now Live — Reactions, 3D Frames & More
            </motion.div>

            <motion.h1
              id="hero-heading"
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] xl:text-[5rem] font-extrabold tracking-[-0.02em] mb-8 leading-[1.08]"
            >
              The Future of Structural <br className="hidden sm:block" />
              <span
                className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 animate-gradient"
                style={{ backgroundSize: "200% auto" }}
              >
                Engineering is Here
              </span>
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-12 leading-relaxed px-4"
            >
              Professional-grade structural analysis and design platform.
              STAAD.Pro level power, browser-native. AI-powered. Cloud-first.
              Indian standards built-in.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4"
            >
              <Button
                onClick={handleGetStarted}
                variant="premium"
                size="xl"
                className="w-full sm:w-auto group"
              >
                <span className="flex items-center gap-2.5">
                  Start Analyzing Free
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
              <Button
                onClick={() => navigate("/demo")}
                variant="glass"
                size="xl"
                className="w-full sm:w-auto group"
              >
                <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                View Live Demo
              </Button>
            </motion.div>

            {/* Hero Image / App Preview — Animated UI Mock */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="mt-16 relative max-w-5xl mx-auto"
            >
              <div className="rounded-xl border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden bg-slate-900/80 backdrop-blur-sm">
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 border-b border-white/[0.06]">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="bg-slate-700/60 rounded-md px-4 py-1 text-[11px] text-slate-400 font-mono">
                      beamlab.app/workspace
                    </div>
                  </div>
                </div>
                {/* App body */}
                <div className="aspect-[16/9] bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex relative overflow-hidden">
                  {/* Sidebar mock */}
                  <div className="w-14 bg-slate-800/60 border-r border-white/[0.04] flex flex-col items-center py-3 gap-3">
                    {[Layers, FileText, Shield, Cpu].map((Icon, i) => (
                      <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-blue-500/20 text-blue-400' : 'text-slate-600 hover:text-slate-400'} transition-colors`} aria-hidden="true">
                        <Icon className="w-4 h-4" />
                      </div>
                    ))}
                  </div>
                  {/* Main viewport */}
                  <div className="flex-1 relative">
                    <div className="absolute inset-0 grid-pattern opacity-20" />
                    {/* Animated beam visualization */}
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 450" fill="none" aria-hidden="true">
                      {/* Grid */}
                      <defs>
                        <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="0.5" />
                        </pattern>
                      </defs>
                      <rect width="800" height="450" fill="url(#hero-grid)" />
                      {/* Beam structure */}
                      <motion.line x1="150" y1="250" x2="650" y2="250" stroke="#3b82f6" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 1.2, ease: "easeInOut" }} />
                      {/* Supports */}
                      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
                        <polygon points="150,255 140,275 160,275" fill="#3b82f6" opacity="0.6" />
                        <polygon points="650,255 640,275 660,275" fill="#3b82f6" opacity="0.6" />
                        <line x1="135" y1="275" x2="165" y2="275" stroke="#3b82f6" strokeWidth="1.5" opacity="0.4" />
                        <line x1="635" y1="275" x2="665" y2="275" stroke="#3b82f6" strokeWidth="1.5" opacity="0.4" />
                      </motion.g>
                      {/* Load arrows */}
                      <motion.g initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8, duration: 0.5 }}>
                        {[250, 350, 400, 450, 550].map((x, i) => (
                          <g key={i}>
                            <line x1={x} y1="170" x2={x} y2="245" stroke="#f59e0b" strokeWidth="1.5" opacity="0.7" />
                            <polygon points={`${x-4},245 ${x+4},245 ${x},252`} fill="#f59e0b" opacity="0.7" />
                          </g>
                        ))}
                        <text x="400" y="160" textAnchor="middle" className="text-[11px]" fill="#f59e0b" opacity="0.8">UDL = 25 kN/m</text>
                      </motion.g>
                      {/* BMD curve (parabola) */}
                      <motion.path
                        d="M 150 320 Q 250 290 400 280 Q 550 290 650 320"
                        stroke="#a78bfa"
                        strokeWidth="2"
                        fill="rgba(167,139,250,0.08)"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ delay: 2.2, duration: 1 }}
                      />
                      <motion.text x="400" y="275" textAnchor="middle" className="text-[10px]" fill="#a78bfa" opacity="0.7" initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: 3 }}>BMD</motion.text>
                      {/* Dimension labels */}
                      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }}>
                        <text x="400" y="340" textAnchor="middle" className="text-[10px]" fill="#64748b">L = 6.0 m</text>
                        <line x1="150" y1="330" x2="650" y2="330" stroke="#475569" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
                      </motion.g>
                    </svg>
                    {/* Results panel overlay */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 2.8, duration: 0.5 }}
                      className="absolute top-4 right-4 w-48 bg-slate-800/90 backdrop-blur-md rounded-lg border border-white/[0.08] p-3 text-[11px]"
                    >
                      <div className="text-blue-400 font-semibold mb-2 text-xs">Analysis Results</div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Max Moment</span>
                          <span className="text-slate-300 font-mono">112.5 kN·m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Max Shear</span>
                          <span className="text-slate-300 font-mono">75.0 kN</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Deflection</span>
                          <span className="text-emerald-400 font-mono">2.4 mm ✓</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Unity Check</span>
                          <span className="text-emerald-400 font-mono">0.72 ✓</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
              {/* Shadow glow beneath */}
              <div className="absolute -bottom-4 left-8 right-8 h-8 bg-blue-500/10 blur-2xl rounded-full" />
            </motion.div>

            {/* Animated Stats Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
            >
              {STATS.map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1">{stat.value}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Trust Bar */}
        <section className="py-12 border-y border-slate-200/60 dark:border-white/[0.04] bg-slate-50/50 dark:bg-slate-900/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-8">
              Trusted by engineers at
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {TRUST_LOGOS.map((logo, i) => (
                <span
                  key={i}
                  className="text-slate-500 dark:text-slate-400/50 hover:text-slate-700 dark:hover:text-slate-300 transition-all duration-300 text-lg font-semibold tracking-wide cursor-default select-none"
                >
                  {logo}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ===== NEW: How Structural Analysis Works Section ===== */}
        <section className="py-24 sm:py-32 bg-gradient-to-b from-slate-950 to-slate-900 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="inline-block text-emerald-400 text-xs font-semibold uppercase tracking-[0.2em] mb-5"
              >
                Fundamentals
              </motion.span>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl sm:text-4xl font-bold text-white dark:text-white mb-6"
              >
                How Structural Analysis Works
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-lg text-slate-400 max-w-2xl mx-auto"
              >
                Whether you're new to engineering or already experienced, understand the fundamentals that power professional structural design.
              </motion.p>
            </div>

            <div className="grid md:grid-cols-2 gap-10 mb-12">
              {/* Educational Content */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-6"
              >
                <div className="rounded-xl bg-white/5 border border-white/10 p-6">
                  <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-blue-500 text-white w-6 h-6 flex items-center justify-center text-sm">1</span>
                    Define Loads
                  </h3>
                  <p className="text-slate-400">
                    What forces act on your structure? Point loads, distributed loads, wind, earthquakes—each has specific rules for application and combination per Indian Design Codes (IS 875, IS 1893).
                  </p>
                </div>

                <div className="rounded-xl bg-white/5 border border-white/10 p-6">
                  <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-purple-500 text-white w-6 h-6 flex items-center justify-center text-sm">2</span>
                    Set Supports
                  </h3>
                  <p className="text-slate-400">
                    How is the structure held up? Pinned, fixed, or roller supports each create different reaction patterns. Proper support definition is critical for accurate analysis.
                  </p>
                </div>

                <div className="rounded-xl bg-white/5 border border-white/10 p-6">
                  <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-orange-500 text-white w-6 h-6 flex items-center justify-center text-sm">3</span>
                    Analyze Forces
                  </h3>
                  <p className="text-slate-400">
                    BeamLab solves equilibrium equations (ΣF=0, ΣM=0) to find reactions, shear forces, and bending moments throughout your structure using finite element analysis.
                  </p>
                </div>

                <div className="rounded-xl bg-white/5 border border-white/10 p-6">
                  <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-green-500 text-white w-6 h-6 flex items-center justify-center text-sm">4</span>
                    Design Members
                  </h3>
                  <p className="text-slate-400">
                    Using results from analysis, design members per IS 800 (steel), IS 456 (concrete), or AISC. Our built-in design checks verify code compliance automatically.
                  </p>
                </div>
              </motion.div>

              {/* Visual Example */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex flex-col justify-center"
              >
                <div className="rounded-xl bg-white/5 border border-white/10 p-8 mb-6">
                  <h3 className="font-bold text-white mb-4">Simple Beam Example</h3>
                  
                  {/* SVG Diagram */}
                  <svg viewBox="0 0 400 180" className="w-full mb-4 bg-slate-900/20 rounded p-3">
                    {/* Structure */}
                    <line x1="40" y1="80" x2="360" y2="80" stroke="white" strokeWidth="3" />
                    
                    {/* Supports */}
                    <circle cx="40" cy="80" r="4" fill="white" />
                    <polygon points="40,80 30,95 50,95" fill="white" />
                    
                    <circle cx="360" cy="80" r="4" fill="white" />
                    <line x1="355" y1="85" x2="365" y2="85" stroke="white" strokeWidth="2" />
                    <line x1="355" y1="90" x2="365" y2="90" stroke="white" strokeWidth="2" />
                    
                    {/* Load */}
                    <line x1="200" y1="10" x2="200" y2="60" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrowhead-blue)" />
                    <text x="210" y="35" fill="#3b82f6" fontSize="12" fontWeight="bold">10 kN</text>
                    
                    {/* Labels */}
                    <text x="30" y="110" fill="#94a3b8" fontSize="11">Pin</text>
                    <text x="350" y="110" fill="#94a3b8" fontSize="11">Roller</text>
                    <text x="185" y="145" fill="#94a3b8" fontSize="11">L = 10m</text>
                  </svg>

                  {/* Results */}
                  <div className="bg-slate-800/50 rounded p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Reaction A (Left):</span>
                      <span className="text-emerald-400 font-mono">5.0 kN ↑</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Reaction B (Right):</span>
                      <span className="text-emerald-400 font-mono">5.0 kN ↑</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Max Moment (Center):</span>
                      <span className="text-blue-400 font-mono">12.5 kNm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Max Deflection:</span>
                      <span className="text-purple-400 font-mono">2.48 mm</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/learning')}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-lg hover:from-emerald-500 hover:to-teal-500 transition-all"
                  >
                    Start Learning Path
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 px-6 py-3 border border-white/20 text-white font-medium rounded-lg hover:bg-white/5 transition-all"
                  >
                    View Example
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 sm:py-32 bg-white dark:bg-slate-950 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14 sm:mb-20">
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="inline-block text-blue-400 text-xs font-semibold uppercase tracking-[0.2em] mb-5"
              >
                Features
              </motion.span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 px-4 tracking-[-0.02em]">
                Everything You Need for Structural Engineering
              </h2>
              <p className="mt-5 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-sm sm:text-base px-4 leading-relaxed">
                Professional-grade structural analysis tools powered by modern
                web technologies. From simple beams to complex 3D frames — we've
                got you covered.
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

        {/* ===== Tools Showcase Section ===== */}
        <section id="tools" className="py-24 sm:py-32 bg-gradient-to-b from-slate-950 to-slate-900 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                className="inline-block text-cyan-400 text-xs font-semibold uppercase tracking-[0.2em] mb-5">
                Complete Engineering Suite
              </motion.span>
              <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 tracking-[-0.02em]">
                Every Tool a Structural Engineer Needs
              </motion.h2>
              <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="text-lg text-slate-400 max-w-3xl mx-auto">
                From geometry creation to final design reports — BeamLab covers the entire structural engineering workflow, matching and exceeding STAAD.Pro capabilities.
              </motion.p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {TOOLS_SHOWCASE.map((tool, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: idx * 0.05 }}
                  className="group relative rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-cyan-500/30 p-6 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/5">
                  <div className={`w-12 h-12 rounded-xl ${tool.gradient} flex items-center justify-center mb-4`}>
                    {tool.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{tool.title}</h3>
                  <p className="text-sm text-slate-400 mb-4">{tool.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {tool.capabilities.map((cap, i) => (
                      <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.05] text-slate-300 border border-white/[0.08]">{cap}</span>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="mt-4 text-cyan-400 hover:text-cyan-300 p-0 h-auto"
                    onClick={() => navigate(tool.link)}>
                    {tool.cta} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Screenshots & Visual Showcase ===== */}
        <section id="screenshots" className="py-24 sm:py-32 bg-white dark:bg-slate-950 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                className="inline-block text-violet-400 text-xs font-semibold uppercase tracking-[0.2em] mb-5">
                See It In Action
              </motion.span>
              <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6 tracking-[-0.02em]">
                Professional-Grade Analysis & Design
              </motion.h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Real screenshots from BeamLab showing 3D models, analysis results, force diagrams, and design reports.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {SCREENSHOT_CARDS.map((card, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
                  className="group rounded-2xl overflow-hidden border border-slate-200/60 dark:border-white/[0.06] bg-slate-50 dark:bg-slate-900/50 hover:shadow-xl transition-all duration-300">
                  {/* Mock screenshot area */}
                  <div className={`aspect-[16/10] ${card.bgGradient} relative overflow-hidden`}>
                    {/* Window chrome */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-black/20">
                      <div className="flex gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-500/70" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" /><div className="w-2.5 h-2.5 rounded-full bg-green-500/70" /></div>
                      <span className="text-[10px] text-white/50 font-mono ml-2">{card.windowTitle}</span>
                    </div>
                    {/* Screenshot content placeholder */}
                    <div className="absolute inset-0 mt-8 p-4">
                      {card.mockContent}
                    </div>
                  </div>
                  <div className="p-5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400 mb-2 block">{card.category}</span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{card.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{card.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Button onClick={() => navigate('/demo')} variant="premium" size="lg" className="group">
                Try Live Demo <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </section>

        {/* ===== Reviews & Testimonials ===== */}
        <section id="reviews" className="py-24 sm:py-32 bg-gradient-to-b from-slate-900 to-slate-950 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                className="inline-block text-amber-400 text-xs font-semibold uppercase tracking-[0.2em] mb-5">
                Trusted by Engineers
              </motion.span>
              <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
                What Engineers Are Saying
              </motion.h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {REVIEWS.map((review, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 hover:border-amber-500/20 transition-all">
                  <div className="flex gap-1 mb-4">
                    {[...Array(review.stars)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-4 italic">"{review.text}"</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-white/[0.06]">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {review.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">{review.name}</div>
                      <div className="text-xs text-slate-500">{review.role} — {review.company}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section id="compare" className="py-24 sm:py-32 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="inline-block text-blue-400 text-xs font-semibold uppercase tracking-[0.2em] mb-5">
                Compare
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-[-0.02em]">
                Why Engineers Switch to BeamLab
              </h2>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-white/[0.06]">
              <table className="w-full text-sm" aria-label="Feature comparison between structural analysis platforms">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/60">
                    <th scope="col" className="text-left py-4 px-6 font-semibold text-slate-900 dark:text-white">Feature</th>
                    <th scope="col" className="text-center py-4 px-4 font-medium text-slate-500 dark:text-slate-400">STAAD.Pro</th>
                    <th scope="col" className="text-center py-4 px-4 font-medium text-slate-500 dark:text-slate-400">ETABS</th>
                    <th scope="col" className="text-center py-4 px-4 font-medium text-slate-500 dark:text-slate-400">SkyCiv</th>
                    <th scope="col" className="text-center py-4 px-4 font-semibold text-blue-400">BeamLab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.06]">
                  {COMPARISON_DATA.map((row, i) => (
                    <tr key={i} className="bg-white dark:bg-slate-950/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-6 font-medium text-slate-700 dark:text-slate-300">{row.feature}</td>
                      <td className="text-center py-3 px-4" aria-label={`STAAD.Pro: ${row.staad === '✅' ? 'Yes' : row.staad === '❌' ? 'No' : row.staad === '⚠️' ? 'Partial' : row.staad}`}>{row.staad}</td>
                      <td className="text-center py-3 px-4" aria-label={`ETABS: ${row.etabs === '✅' ? 'Yes' : row.etabs === '❌' ? 'No' : row.etabs === '⚠️' ? 'Partial' : row.etabs}`}>{row.etabs}</td>
                      <td className="text-center py-3 px-4" aria-label={`SkyCiv: ${row.skyciv === '✅' ? 'Yes' : row.skyciv === '❌' ? 'No' : row.skyciv === '⚠️' ? 'Partial' : row.skyciv}`}>{row.skyciv}</td>
                      <td className="text-center py-3 px-4" aria-label={`BeamLab: ${row.beamlab === '✅' ? 'Yes' : row.beamlab === '❌' ? 'No' : row.beamlab === '✨' ? 'Best in class' : row.beamlab}`}>{row.beamlab}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Interactive Demo */}
        <InteractiveDemo />

        {/* Performance Metrics */}
        <PerformanceMetrics />

        {/* Pricing Section */}
        <section id="pricing" className="py-24 sm:py-32 bg-slate-50 dark:bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14 sm:mb-20">
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="inline-block text-blue-400 text-xs font-semibold uppercase tracking-[0.2em] mb-5"
              >
                Pricing
              </motion.span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-5 px-4 tracking-[-0.02em]">
                Simple, Transparent Pricing
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-sm sm:text-base px-4 leading-relaxed mb-8">
                Choose the perfect plan for your engineering needs. All plans
                include core analysis features.
              </p>

              {/* Monthly / Yearly Toggle */}
              <div className="inline-flex items-center bg-slate-200 dark:bg-slate-800 rounded-full p-1" role="radiogroup" aria-label="Billing cycle">
                <button
                  type="button"
                  role="radio"
                  aria-checked={billingCycle === 'monthly'}
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={billingCycle === 'yearly'}
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                    billingCycle === 'yearly'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Yearly
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">Save 20%</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
              {PRICING_TIERS.map((tier, index) => (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative flex flex-col rounded-2xl sm:rounded-3xl p-6 sm:p-8 ${
                    tier.popular
                      ? "bg-slate-50 dark:bg-slate-900/90 border-2 border-blue-500/50 shadow-[0_0_80px_rgba(59,130,246,0.15)] lg:scale-105 z-10 backdrop-blur-sm"
                      : "bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12] transition-all duration-300"
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg uppercase tracking-wider whitespace-nowrap">
                      Most Popular
                    </div>
                  )}
                  <div className="mb-6">
                    <h3
                      className={`text-xl sm:text-2xl font-bold mb-2 ${tier.popular ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-200"}`}
                    >
                      {tier.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{tier.description}</p>
                  </div>
                  <div className="mb-6 sm:mb-8">
                    <span className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                      {tier.price === "₹0" ? "₹0" : billingCycle === 'yearly' ? tier.yearlyPrice : tier.price}
                    </span>
                    {tier.period && (
                      <span className="text-slate-600 dark:text-slate-400 ml-1">
                        /{billingCycle === 'yearly' && tier.price !== "₹0" ? 'mo' : tier.period}
                      </span>
                    )}
                    {billingCycle === 'yearly' && tier.price !== "₹0" && (
                      <span className="block text-xs text-emerald-400 mt-1">Billed annually</span>
                    )}
                  </div>

                  <Button
                    onClick={handleGetStarted}
                    variant={tier.popular ? "premium" : "outline"}
                    size="lg"
                    className="w-full mb-6 sm:mb-8"
                  >
                    {tier.cta}
                  </Button>

                  <ul className="space-y-3 sm:space-y-4 flex-1">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300"
                      >
                        <CheckCircle
                          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${tier.popular ? "text-blue-400" : "text-slate-500"}`}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link to="/pricing" className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors inline-flex items-center gap-1">
                View Full Feature Comparison <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <CTABanner onGetStarted={handleGetStarted} />
      </main>

      {/* Footer */}
      <footer
        className="border-t border-slate-200/60 dark:border-white/[0.06] py-14 sm:py-20 bg-slate-50 dark:bg-slate-900"
        role="contentinfo"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
            {/* Brand Column */}
            <div className="col-span-2">
              <Logo size="sm" clickable={false} className="mb-6" />
              <p className="text-slate-600 dark:text-slate-400 text-sm max-w-sm leading-relaxed mb-6">
                Professional structural analysis software, reimagined for the modern web. Fast, accurate, and accessible anywhere — no installation required.
              </p>
              <div className="flex gap-4">
                <a href="https://github.com" className="text-slate-400 hover:text-slate-100 transition-colors p-1" aria-label="GitHub">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </a>
                <a href="https://twitter.com" className="text-slate-400 hover:text-slate-100 transition-colors p-1" aria-label="Twitter">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                </a>
                <a href="https://linkedin.com" className="text-slate-400 hover:text-slate-100 transition-colors p-1" aria-label="LinkedIn">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href="https://youtube.com" className="text-slate-400 hover:text-slate-100 transition-colors p-1" aria-label="YouTube">
                  <Youtube className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Product</h3>
              <ul className="space-y-1 text-[13px]">
                <li><a href="#features" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Features</a></li>
                <li><a href="#pricing" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Pricing</a></li>
                <li><Link to="/help" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Documentation</Link></li>
                <li><Link to="/demo" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Live Demo</Link></li>
                <li><Link to="/help" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Downloads</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Resources</h3>
              <ul className="space-y-1 text-[13px]">
                <li><Link to="/help" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">API Reference</Link></li>
                <li><Link to="/help" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Changelog</Link></li>
                <li><Link to="/help" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Community</Link></li>
                <li><Link to="/help" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Tutorials</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Company</h3>
              <ul className="space-y-1 text-[13px]">
                <li><Link to="/about" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">About</Link></li>
                <li><Link to="/contact" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Contact</Link></li>
                <li><Link to="/contact" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Blog</Link></li>
                <li><Link to="/contact" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Careers</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Legal</h3>
              <ul className="space-y-1 text-[13px]">
                <li><Link to="/privacy" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Terms of Service</Link></li>
                <li><Link to="/contact" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-block py-1.5">Contact Us</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              © 2026 BeamLab. All rights reserved.
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-xs">
              Made with ❤️ in India
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// --- DATA & COMPONENTS ---

const STATS = [
  { value: "200+", label: "Engineering Features" },
  { value: "10K+", label: "Members Supported" },
  { value: "< 1s", label: "Analysis Time" },
  { value: "99.9%", label: "Uptime" },
];

const TRUST_LOGOS = ["L&T", "Tata Projects", "AECOM", "Jacobs", "Arup", "Mott MacDonald"];

const COMPARISON_DATA = [
  { feature: "Web-based (No Install)", staad: "❌", etabs: "❌", skyciv: "✅", beamlab: "✨" },
  { feature: "AI-Powered Design", staad: "❌", etabs: "❌", skyciv: "❌", beamlab: "✨" },
  { feature: "Indian Design Codes", staad: "✅", etabs: "✅", skyciv: "⚠️", beamlab: "✅" },
  { feature: "Real-time Collaboration", staad: "❌", etabs: "❌", skyciv: "✅", beamlab: "✨" },
  { feature: "Free Tier Available", staad: "❌", etabs: "❌", skyciv: "⚠️", beamlab: "✅" },
  { feature: "3D FEM Analysis", staad: "✅", etabs: "✅", skyciv: "✅", beamlab: "✅" },
  { feature: "Nonlinear (P-Delta)", staad: "✅", etabs: "✅", skyciv: "⚠️", beamlab: "✅" },
  { feature: "Steel & RC Design", staad: "✅", etabs: "✅", skyciv: "✅", beamlab: "✅" },
  { feature: "Starting Price", staad: "₹2L+/yr", etabs: "₹3L+/yr", skyciv: "$59/mo", beamlab: "₹0 Free" },
];

// Tools Showcase Data
const TOOLS_SHOWCASE = [
  {
    title: "Geometry Modelling",
    description: "Create nodes, beams, plates, and complex 3D geometry with STAAD-style tools — select, copy, mirror, rotate, split, extrude, and more.",
    icon: <PenTool className="w-6 h-6 text-white" />,
    gradient: "bg-gradient-to-br from-blue-500 to-cyan-500",
    capabilities: ["Add Node", "Add Beam", "Add Plate", "Copy", "Mirror", "Rotate", "Split", "Extrude", "DXF Import"],
    link: "/app",
    cta: "Start Modelling",
  },
  {
    title: "Section & Material Properties",
    description: "800+ steel sections database (IS, AISC, EU). Assign materials, sections, beta angles, and member end releases to all members.",
    icon: <Database className="w-6 h-6 text-white" />,
    gradient: "bg-gradient-to-br from-violet-500 to-purple-600",
    capabilities: ["Section Library", "Material Assign", "IS Sections", "AISC Sections", "Custom Sections", "Releases"],
    link: "/app?tool=sections",
    cta: "Browse Sections",
  },
  {
    title: "Loading & Load Combinations",
    description: "Apply dead, live, wind, earthquake loads. Point loads at any point on beam, UDL on members. Create IS 875/IS 1893/ASCE 7 load combinations.",
    icon: <Download className="w-6 h-6 text-white" />,
    gradient: "bg-gradient-to-br from-orange-500 to-red-500",
    capabilities: ["Dead Load", "Live Load", "Wind Load", "Seismic Load", "Point Load", "UDL", "Load Combos", "IS 875"],
    link: "/app?category=LOADING",
    cta: "Define Loads",
  },
  {
    title: "Analysis Engine",
    description: "Run linear/nonlinear analysis with sub-second performance. P-Delta, buckling, modal, response spectrum, pushover, and time history analysis.",
    icon: <BarChart3 className="w-6 h-6 text-white" />,
    gradient: "bg-gradient-to-br from-emerald-500 to-teal-600",
    capabilities: ["Linear Analysis", "P-Delta", "Buckling", "Modal Analysis", "Response Spectrum", "Pushover", "Time History"],
    link: "/app?category=ANALYSIS",
    cta: "Run Analysis",
  },
  {
    title: "Design & Code Check",
    description: "Automatic design checks per IS 800, IS 456, AISC 360, Eurocode 3/2, ACI 318. Utilization ratios, pass/fail, and auto-optimization.",
    icon: <Shield className="w-6 h-6 text-white" />,
    gradient: "bg-gradient-to-br from-pink-500 to-rose-600",
    capabilities: ["IS 800 Steel", "IS 456 RC", "AISC 360", "Eurocode", "Utilization", "Auto-Optimize"],
    link: "/design-hub",
    cta: "Design Check",
  },
  {
    title: "Results & Diagrams",
    description: "View SFD, BMD, AFD, deflection diagrams plotted over all members. Support reactions, equilibrium checks, and detailed force tables.",
    icon: <Activity className="w-6 h-6 text-white" />,
    gradient: "bg-gradient-to-br from-cyan-500 to-blue-600",
    capabilities: ["SFD Diagram", "BMD Diagram", "AFD Diagram", "Deflection", "Reactions", "Stress Heatmap"],
    link: "/app?category=ANALYSIS",
    cta: "View Results",
  },
  {
    title: "Professional Reports",
    description: "Export branded PDF reports with your logo, project details, engineer name, client name, date, revision. Include calculations, diagrams, and design results.",
    icon: <FileText className="w-6 h-6 text-white" />,
    gradient: "bg-gradient-to-br from-amber-500 to-orange-600",
    capabilities: ["PDF Export", "Branded Header", "Calculation Sheets", "Diagrams", "Design Report", "CSV Export"],
    link: "/tools/print-export",
    cta: "Generate Reports",
  },
  {
    title: "Detail Drawings",
    description: "Auto-generated detailing drawings for RCC sections with reinforcement, bar diameters, spacing, clear cover. Steel connection details with bolts and welds.",
    icon: <Ruler className="w-6 h-6 text-white" />,
    gradient: "bg-gradient-to-br from-indigo-500 to-blue-700",
    capabilities: ["RCC Detailing", "Reinforcement", "Bar Bending Schedule", "Steel Connections", "Bolt Details", "Weld Details"],
    link: "/design/detailing",
    cta: "View Drawings",
  },
  {
    title: "Civil Engineering Suite",
    description: "Complete civil engineering tools — geotechnical, transportation, hydraulics, construction management. Design calculations for foundations, retaining walls, and more.",
    icon: <Compass className="w-6 h-6 text-white" />,
    gradient: "bg-gradient-to-br from-teal-500 to-green-600",
    capabilities: ["Geotechnical", "Transportation", "Hydraulics", "Foundation Design", "Retaining Walls", "Construction"],
    link: "/civil-engineering/library",
    cta: "Explore Civil",
  },
];

// Screenshot Cards Data
const SCREENSHOT_CARDS = [
  {
    title: "3D Frame Model with Loads Applied",
    description: "Multi-story steel frame with UDL, point loads, and supports clearly visualized on the 3D canvas with category-based workflow sidebar.",
    category: "Modelling",
    windowTitle: "beamlab.app/workspace — Project: G+3 Office Block",
    bgGradient: "bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950",
    mockContent: (
      <svg viewBox="0 0 600 300" className="w-full h-full">
        <defs><pattern id="sg" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="0.5" /></pattern></defs>
        <rect width="600" height="300" fill="url(#sg)" />
        {/* Frame structure */}
        <line x1="80" y1="250" x2="80" y2="60" stroke="#3b82f6" strokeWidth="2.5" />
        <line x1="250" y1="250" x2="250" y2="60" stroke="#3b82f6" strokeWidth="2.5" />
        <line x1="420" y1="250" x2="420" y2="60" stroke="#3b82f6" strokeWidth="2.5" />
        <line x1="80" y1="60" x2="420" y2="60" stroke="#3b82f6" strokeWidth="2.5" />
        <line x1="80" y1="130" x2="420" y2="130" stroke="#3b82f6" strokeWidth="2" />
        <line x1="80" y1="190" x2="420" y2="190" stroke="#3b82f6" strokeWidth="2" />
        {/* Loads */}
        {[120, 160, 200, 280, 320, 360].map((x, i) => <line key={i} x1={x} y1="30" x2={x} y2="55" stroke="#f59e0b" strokeWidth="1" />)}
        <text x="240" y="24" textAnchor="middle" fill="#f59e0b" fontSize="9" fontWeight="bold">25 kN/m</text>
        {/* Supports */}
        <polygon points="75,255 85,255 80,265" fill="#22c55e" opacity="0.8" />
        <polygon points="245,255 255,255 250,265" fill="#22c55e" opacity="0.8" />
        <polygon points="415,255 425,255 420,265" fill="#22c55e" opacity="0.8" />
        {/* Labels */}
        <text x="460" y="70" fill="#94a3b8" fontSize="8">ISMB 300</text>
        <text x="460" y="140" fill="#94a3b8" fontSize="8">ISMB 250</text>
        {/* Results panel */}
        <rect x="460" y="160" width="120" height="100" rx="6" fill="rgba(15,23,42,0.9)" stroke="rgba(255,255,255,0.1)" />
        <text x="475" y="178" fill="#3b82f6" fontSize="8" fontWeight="bold">Results</text>
        <text x="475" y="195" fill="#94a3b8" fontSize="7">Max M: 156.2 kN·m</text>
        <text x="475" y="210" fill="#94a3b8" fontSize="7">Max V: 87.5 kN</text>
        <text x="475" y="225" fill="#22c55e" fontSize="7">δmax: 3.2 mm ✓</text>
        <text x="475" y="240" fill="#22c55e" fontSize="7">Unity: 0.68 ✓</text>
      </svg>
    ),
  },
  {
    title: "Bending Moment & Shear Force Diagrams",
    description: "Color-coded SFD and BMD plotted directly over the structural members with maximum values annotated. Deflection shape visualization included.",
    category: "Analysis Results",
    windowTitle: "beamlab.app/workspace — BMD/SFD View",
    bgGradient: "bg-gradient-to-br from-purple-900 via-slate-900 to-indigo-950",
    mockContent: (
      <svg viewBox="0 0 600 300" className="w-full h-full">
        <defs><pattern id="sg2" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="0.5" /></pattern></defs>
        <rect width="600" height="300" fill="url(#sg2)" />
        {/* Beam line */}
        <line x1="60" y1="100" x2="540" y2="100" stroke="#64748b" strokeWidth="2" />
        {/* BMD curve */}
        <path d="M 60 100 Q 200 20 300 40 Q 400 60 540 100" stroke="#a78bfa" strokeWidth="2" fill="rgba(167,139,250,0.1)" />
        <text x="280" y="35" fill="#a78bfa" fontSize="9" fontWeight="bold">BMD</text>
        <text x="200" y="16" fill="#a78bfa" fontSize="8">Mmax = 112.5 kN·m</text>
        {/* SFD */}
        <line x1="60" y1="200" x2="540" y2="200" stroke="#64748b" strokeWidth="1" strokeDasharray="4 4" />
        <path d="M 60 160 L 200 160 L 200 240 L 400 240 L 400 160 L 540 160" stroke="#f472b6" strokeWidth="2" fill="rgba(244,114,182,0.1)" />
        <text x="280" y="270" fill="#f472b6" fontSize="9" fontWeight="bold">SFD</text>
        <text x="130" y="155" fill="#f472b6" fontSize="8">+75 kN</text>
        <text x="300" y="255" fill="#f472b6" fontSize="8">-75 kN</text>
        {/* Supports */}
        <polygon points="55,105 65,105 60,115" fill="#22c55e" />
        <polygon points="535,105 545,105 540,115" fill="#22c55e" />
        <circle cx="60" cy="100" r="3" fill="#22c55e" />
        <circle cx="540" cy="100" r="3" fill="#22c55e" />
      </svg>
    ),
  },
  {
    title: "Steel Section Design Check Results",
    description: "IS 800:2007 / AISC 360 design results with clause-by-clause utilization ratios, color-coded pass/fail indicators, and optimization suggestions.",
    category: "Design",
    windowTitle: "beamlab.app/design-hub — Steel Design Checks",
    bgGradient: "bg-gradient-to-br from-emerald-900 via-slate-900 to-teal-950",
    mockContent: (
      <svg viewBox="0 0 600 300" className="w-full h-full">
        {/* Design result cards mock */}
        <rect x="20" y="10" width="170" height="130" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(34,197,94,0.3)" />
        <text x="35" y="32" fill="#22c55e" fontSize="10" fontWeight="bold">M1 — ISMB 300</text>
        <text x="35" y="50" fill="#94a3b8" fontSize="8">IS 800:2007 Check</text>
        <rect x="35" y="60" width="120" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="35" y="60" width="82" height="6" rx="3" fill="#22c55e" />
        <text x="35" y="80" fill="#94a3b8" fontSize="7">Util: 0.68 — PASS</text>
        <text x="35" y="95" fill="#94a3b8" fontSize="7">Gov: Flexure Cl.8.2.1</text>
        <text x="35" y="110" fill="#94a3b8" fontSize="7">Comp: 0.42 | Shear: 0.31</text>
        <text x="35" y="125" fill="#22c55e" fontSize="7">✓ All checks passed</text>

        <rect x="210" y="10" width="170" height="130" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(239,68,68,0.3)" />
        <text x="225" y="32" fill="#ef4444" fontSize="10" fontWeight="bold">M4 — ISMC 200</text>
        <text x="225" y="50" fill="#94a3b8" fontSize="8">IS 800:2007 Check</text>
        <rect x="225" y="60" width="120" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="225" y="60" width="130" height="6" rx="3" fill="#ef4444" />
        <text x="225" y="80" fill="#ef4444" fontSize="7">Util: 1.12 — FAIL</text>
        <text x="225" y="95" fill="#94a3b8" fontSize="7">Gov: Combined Cl.9.3.1</text>
        <text x="225" y="110" fill="#94a3b8" fontSize="7">Comp: 0.89 | Flex: 1.12</text>
        <text x="225" y="125" fill="#f59e0b" fontSize="7">⚠ Upgrade to ISMC 250</text>

        <rect x="400" y="10" width="170" height="130" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(34,197,94,0.3)" />
        <text x="415" y="32" fill="#22c55e" fontSize="10" fontWeight="bold">M7 — ISHB 350</text>
        <text x="415" y="50" fill="#94a3b8" fontSize="8">IS 800:2007 Check</text>
        <rect x="415" y="60" width="120" height="6" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="415" y="60" width="96" height="6" rx="3" fill="#22c55e" />
        <text x="415" y="80" fill="#94a3b8" fontSize="7">Util: 0.80 — PASS</text>
        <text x="415" y="95" fill="#94a3b8" fontSize="7">Gov: Buckling Cl.7.1.2</text>
        <text x="415" y="110" fill="#94a3b8" fontSize="7">Comp: 0.80 | Flex: 0.55</text>
        <text x="415" y="125" fill="#22c55e" fontSize="7">✓ Economical (80%)</text>

        {/* Summary bar */}
        <rect x="20" y="160" width="560" height="40" rx="6" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" />
        <text x="40" y="185" fill="white" fontSize="10" fontWeight="bold">Summary: 6/8 PASS</text>
        <text x="260" y="185" fill="#f59e0b" fontSize="9">2 members need optimization</text>
        <rect x="460" y="170" width="100" height="22" rx="4" fill="rgba(34,197,94,0.2)" />
        <text x="480" y="185" fill="#22c55e" fontSize="9" fontWeight="bold">Auto-Optimize</text>
      </svg>
    ),
  },
  {
    title: "RCC Detailing Drawing — Beam Section",
    description: "Automated reinforcement detailing with bar diameter, spacing, clear cover, stirrup arrangement, and cross-section views as per IS 456:2000.",
    category: "Detailing",
    windowTitle: "beamlab.app/design/detailing — RCC Beam B1",
    bgGradient: "bg-gradient-to-br from-amber-900 via-slate-900 to-orange-950",
    mockContent: (
      <svg viewBox="0 0 600 300" className="w-full h-full">
        {/* Beam elevation */}
        <rect x="40" y="60" width="400" height="120" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
        <text x="240" y="50" textAnchor="middle" fill="#f59e0b" fontSize="10" fontWeight="bold">BEAM B1 — ELEVATION</text>
        {/* Main bars */}
        <line x1="50" y1="75" x2="430" y2="75" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="8 4" />
        <line x1="50" y1="165" x2="430" y2="165" stroke="#ef4444" strokeWidth="2" />
        <text x="440" y="78" fill="#ef4444" fontSize="7">2-16φ (top)</text>
        <text x="440" y="168" fill="#ef4444" fontSize="7">3-20φ (bottom)</text>
        {/* Stirrups */}
        {[80, 110, 140, 170, 200, 230, 260, 290, 320, 350, 380, 410].map((x, i) => (
          <rect key={i} x={x-3} y="68" width="6" height="100" fill="none" stroke="#3b82f6" strokeWidth="0.8" />
        ))}
        <text x="240" y="195" textAnchor="middle" fill="#3b82f6" fontSize="7">8φ @ 150 c/c (stirrups)</text>
        {/* Dimensions */}
        <line x1="40" y1="210" x2="440" y2="210" stroke="#94a3b8" strokeWidth="0.5" />
        <text x="240" y="225" textAnchor="middle" fill="#94a3b8" fontSize="8">L = 5000 mm</text>
        <line x1="460" y1="60" x2="460" y2="180" stroke="#94a3b8" strokeWidth="0.5" />
        <text x="480" y="125" fill="#94a3b8" fontSize="8">400mm</text>
        {/* Cross section */}
        <rect x="500" y="60" width="60" height="100" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
        <text x="530" y="50" textAnchor="middle" fill="#f59e0b" fontSize="8">SECTION</text>
        <circle cx="512" cy="72" r="3" fill="#ef4444" /><circle cx="548" cy="72" r="3" fill="#ef4444" />
        <circle cx="510" cy="148" r="3.5" fill="#ef4444" /><circle cx="530" cy="148" r="3.5" fill="#ef4444" /><circle cx="550" cy="148" r="3.5" fill="#ef4444" />
        <text x="530" y="175" textAnchor="middle" fill="#94a3b8" fontSize="7">230 × 400</text>
        <text x="530" y="188" textAnchor="middle" fill="#94a3b8" fontSize="7">Cover: 25mm</text>
      </svg>
    ),
  },
];

// Reviews Data
const REVIEWS = [
  {
    name: "Rajesh Sharma",
    role: "Senior Structural Engineer",
    company: "L&T Infrastructure",
    stars: 5,
    text: "BeamLab has completely transformed how we approach structural analysis. The speed of the analysis engine is incredible — what used to take 15 minutes in STAAD now runs in under 2 seconds. The IS code integration is spot-on.",
  },
  {
    name: "Priya Nair",
    role: "Design Consultant",
    company: "Arup India",
    stars: 5,
    text: "The AI-powered design suggestions saved us hours on a recent high-rise project. Being browser-based means our team can collaborate from anywhere. The section database with all IS sections is very comprehensive.",
  },
  {
    name: "Amit Patel",
    role: "Associate Professor",
    company: "IIT Bombay",
    stars: 5,
    text: "I use BeamLab for teaching my structural analysis courses. Students love the transparent calculation steps — they can see every stiffness matrix, every FEM. The free academic tier is a game-changer for education.",
  },
  {
    name: "Sarah Chen",
    role: "Project Manager",
    company: "AECOM Asia Pacific",
    stars: 4,
    text: "Switching from ETABS for frame analysis was seamless. The cloud-native approach means no more license servers, and the PDF reports are professional quality. Would love to see more plate element types.",
  },
  {
    name: "Vikram Singh",
    role: "Independent Consultant",
    company: "VS Structural Consultants",
    stars: 5,
    text: "As a solo consultant, BeamLab's pricing is unbeatable. The ₹999/mo plan gives me everything I need — nonlinear analysis, IS 800/456 design checks, and branded reports with my firm's logo.",
  },
  {
    name: "Dr. Ananya Desai",
    role: "Structural R&D Lead",
    company: "Tata Projects",
    stars: 5,
    text: "The P-Delta and buckling analysis are production-quality. We validated results against our NAFEMS benchmarks and the accuracy is within 0.1%. The response spectrum analysis for IS 1893 seismic is particularly well-implemented.",
  },
];

const FeatureCard = ({
  icon,
  title,
  desc,
  bullets,
}: {
  icon: any;
  title: string;
  desc: string;
  bullets: string[];
}) => (
  <motion.div
    variants={fadeInUp}
    className="relative p-6 sm:p-8 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-white/[0.06] hover:border-blue-500/40 transition-all duration-300 group h-full flex flex-col hover-lift focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:ring-offset-white dark:focus-within:ring-offset-slate-950 overflow-hidden hover:shadow-lg hover:shadow-blue-500/5"
  >
    {/* Top gradient accent */}
    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="w-11 h-11 rounded-xl bg-blue-500/[0.08] border border-blue-500/10 flex items-center justify-center mb-5 group-hover:bg-blue-500/15 group-hover:border-blue-500/20 group-hover:text-blue-400 text-slate-600 dark:text-slate-400 transition-all duration-300 flex-shrink-0" aria-hidden="true">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2.5 tracking-[-0.01em]">
      {title}
    </h3>
    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[0.8125rem] mb-6 flex-grow">
      {desc}
    </p>
    <ul className="space-y-2.5 mt-auto">
      {bullets.map((bullet, i) => (
        <li
          key={i}
          className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400"
        >
          <CheckCircle className="w-3.5 h-3.5 text-blue-400/70 flex-shrink-0" />
          <span>{bullet}</span>
        </li>
      ))}
    </ul>
  </motion.div>
);

const FEATURES = [
  {
    title: "3D Frame Analysis",
    desc: "Full 6-DOF analysis with biaxial bending (Iy & Iz), torsion (J), and proper 12×12 stiffness matrices. Support reactions computed via R = K·u − F.",
    icon: <Layers className="w-6 h-6" />,
    bullets: [
      "Biaxial bending & torsion",
      "Support reactions table",
      "12×12 3D stiffness",
    ],
  },
  {
    title: "Transparent Analysis",
    desc: "See every formula, step, and calculation. Full Fixed-End Moments, stiffness matrices, and equilibrium equations — no black boxes.",
    icon: <Terminal className="w-6 h-6" />,
    bullets: [
      "Step-by-step calculations",
      "Member releases",
      "Full traceability",
    ],
  },
  {
    title: "AI-Powered Design",
    desc: "Describe your structure in plain English. Our Gemini-powered AI generates complete 3D models with proper sections and supports.",
    icon: <Zap className="w-6 h-6" />,
    bullets: [
      "Natural language input",
      "Smart modifications",
      "Auto optimization",
    ],
  },
  {
    title: "Professional Reports",
    desc: "Export PDF reports with SFD, BMD, AFD diagrams, reactions table, and code compliance. CSV export included.",
    icon: <Globe2 className="w-6 h-6" />,
    bullets: [
      "SFD / BMD / AFD diagrams",
      "Reactions & deflections",
      "CSV & PDF export",
    ],
  },
  {
    title: "Advanced Loads & P-Delta",
    desc: "UDL, triangular, trapezoidal, and point loads with member releases. Geometric nonlinearity via P-Delta iteration for stability analysis.",
    icon: <Shield className="w-6 h-6" />,
    bullets: ["P-Delta analysis", "Member end releases", "Load combinations"],
  },
  {
    title: "Large Structures",
    desc: "Handle complex models with thousands of members using WebAssembly sparse solvers and instanced rendering for smooth 3D performance.",
    icon: <Cpu className="w-6 h-6" />,
    bullets: ["10K+ members", "Sparse matrix solvers", "WebGPU acceleration"],
  },
  {
    title: "Indian Design Codes",
    desc: "Built-in IS 800, IS 456, IS 1893 seismic, and IS 875 wind codes. Design checks run automatically with every analysis.",
    icon: <FileText className="w-6 h-6" />,
    bullets: ["IS 800 steel design", "IS 456 RC design", "IS 1893 seismic"],
  },
  {
    title: "Real-time Collaboration",
    desc: "Work on the same model simultaneously with live cursors, comments, and version history. No file merging needed.",
    icon: <Users className="w-6 h-6" />,
    bullets: ["Live multi-user editing", "Comments & annotations", "Version history"],
  },
  {
    title: "Cloud Native",
    desc: "Auto-save, cloud backup, and access from any device. Your projects are always safe and always available.",
    icon: <Cloud className="w-6 h-6" />,
    bullets: ["Auto-save & backup", "Access anywhere", "No data loss"],
  },
  {
    title: "BIM Integration",
    desc: "Import and export IFC, Revit, and Tekla formats. Bi-directional sync keeps your structural model in sync with architectural BIM.",
    icon: <Building className="w-6 h-6" />,
    bullets: ["IFC import/export", "Revit sync", "STAAD import"],
  },
  {
    title: "Section Database",
    desc: "800+ steel sections from IS, AISC, and European standards. Custom sections with arbitrary polygon support.",
    icon: <Database className="w-6 h-6" />,
    bullets: ["IS sections built-in", "AISC & EU sections", "Custom profiles"],
  },
  {
    title: "Works on Any Device",
    desc: "Fully responsive layout works on desktop, tablet, and mobile. Review results on-site from your phone.",
    icon: <Smartphone className="w-6 h-6" />,
    bullets: ["Desktop & tablet", "Mobile review mode", "Touch-optimized"],
  },
];

const PRICING_TIERS = [
  {
    name: "Academic & Hobbyist",
    description: "Perfect for students and learning the fundamentals",
    price: "₹0",
    yearlyPrice: "₹0",
    period: "forever",
    features: [
      "Up to 3 active projects",
      "2D beam & frame analysis",
      "Basic load combinations",
      "IS 456 & ACI 318 design codes",
      "Standard PDF reports",
    ],
    cta: "Start Learning Free",
    popular: false,
  },
  {
    name: "Professional",
    description: "For independent practicing structural engineers",
    price: "₹999",
    yearlyPrice: "₹799",
    period: "month",
    features: [
      "Unlimited projects & storage",
      "Full 3D nonlinear analysis engine",
      "All international design codes",
      "P-Delta, buckling & modal analysis",
      "AI-powered design assistant",
      "Custom branded engineering reports",
    ],
    cta: "Start 14-Day Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    description: "For growing engineering firms and consultancies",
    price: "₹1,999",
    yearlyPrice: "₹1,599",
    period: "month",
    features: [
      "Everything in Professional",
      "Up to 10 team members included",
      "Advanced team project sharing",
      "Centralized admin dashboard",
      "REST API access for automation",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export default memo(LandingPage);
