/**
 * LandingPage - BeamLab Landing Page
 * Premium Dark SaaS homepage with vibrant gradients
 * Merged with Enhanced features (v3.0)
 * Updated to match Figma spec 03_LANDING_MARKETING
 */

import { FC, useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, Variants, useInView } from "framer-motion";
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
  Box,
  FileText,
  Building,
  Database,
  Smartphone,
  Linkedin,
  Youtube,
} from "lucide-react";
import { Logo } from "../components/branding";
import { Button } from "../components/ui/button";
import {
  CompetitiveAdvantage,
  InteractiveDemo,
  Testimonials,
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

  const handleGetStarted = () => {
    if (isSignedIn) {
      navigate("/app");
    } else {
      navigate("/sign-up");
    }
  };

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
              <div className="flex items-center gap-8">
                <a
                  href="#features"
                  className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1"
                >
                  Features
                </a>
                <a
                  href="#pricing"
                  className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1"
                >
                  Pricing
                </a>
                <Link
                  to="/help"
                  className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1"
                >
                  Docs
                </Link>
                <Link
                  to="/demo"
                  className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1"
                >
                  Demo
                </Link>
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
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-100 dark:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-100 dark:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Pricing
            </a>
            <Link
              to="/help"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-100 dark:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Docs
            </Link>
            <Link
              to="/demo"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-100 dark:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
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
                      <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-blue-500/20 text-blue-400' : 'text-slate-600 hover:text-slate-400'} transition-colors`}>
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

        {/* Comparison Table */}
        <section className="py-24 sm:py-32 bg-slate-50/50 dark:bg-slate-900/20">
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/60">
                    <th className="text-left py-4 px-6 font-semibold text-slate-900 dark:text-white">Feature</th>
                    <th className="text-center py-4 px-4 font-medium text-slate-500 dark:text-slate-400">STAAD.Pro</th>
                    <th className="text-center py-4 px-4 font-medium text-slate-500 dark:text-slate-400">ETABS</th>
                    <th className="text-center py-4 px-4 font-medium text-slate-500 dark:text-slate-400">SkyCiv</th>
                    <th className="text-center py-4 px-4 font-semibold text-blue-400">BeamLab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.06]">
                  {COMPARISON_DATA.map((row, i) => (
                    <tr key={i} className="bg-white dark:bg-slate-950/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-6 font-medium text-slate-700 dark:text-slate-300">{row.feature}</td>
                      <td className="text-center py-3 px-4">{row.staad}</td>
                      <td className="text-center py-3 px-4">{row.etabs}</td>
                      <td className="text-center py-3 px-4">{row.skyciv}</td>
                      <td className="text-center py-3 px-4">{row.beamlab}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Interactive Demo */}
        <InteractiveDemo />

        {/* Testimonials */}
        <Testimonials />

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
              <div className="inline-flex items-center bg-slate-200 dark:bg-slate-800 rounded-full p-1">
                <button
                  type="button"
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
              © {new Date().getFullYear()} BeamLab. All rights reserved.
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
    <div className="w-11 h-11 rounded-xl bg-blue-500/[0.08] border border-blue-500/10 flex items-center justify-center mb-5 group-hover:bg-blue-500/15 group-hover:border-blue-500/20 group-hover:text-blue-400 text-slate-600 dark:text-slate-400 transition-all duration-300 flex-shrink-0">
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

export default LandingPage;
