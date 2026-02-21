/**
 * LandingPage - BeamLab Ultimate Landing Page
 * Premium Dark SaaS homepage with vibrant gradients
 * Merged with Enhanced features (v3.0)
 */

import { FC, useState } from "react";
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
} from "lucide-react";
import beamLabLogo from "../assets/beamlab_logo.png";

// Marketing Components
import {
  CompetitiveAdvantage,
  PerformanceMetrics,
  Testimonials,
  SecurityCompliance,
  CTABanner,
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
          <button
            onClick={() => navigate("/app")}
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
        <Link
          to="/sign-in"
          className="text-sm font-medium text-slate-300 hover:text-white transition-colors relative group"
        >
          Log in
          <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-500 transition-all group-hover:w-full" />
        </Link>
        <Link
          to="/sign-up"
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-slate-950 text-sm font-bold hover:bg-blue-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95"
        >
          Get Started
        </Link>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
      {/* Skip to main content - Accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Navbar */}
      <nav
        className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-2xl backdrop-saturate-150"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-3 group flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
              aria-label="BeamLab Ultimate - Home"
            >
              <div className="relative w-9 h-9 flex items-center justify-center rounded-lg shadow-lg group-hover:shadow-blue-500/25 transition-all overflow-hidden">
                <img
                  src={beamLabLogo}
                  alt="BeamLab"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 whitespace-nowrap">
                BeamLab Ultimate
              </span>
            </Link>

            {/* Desktop Links - Properly centered with consistent spacing */}
            <div className="hidden md:flex items-center justify-center flex-1 px-8">
              <div className="flex items-center gap-8">
                <a
                  href="#features"
                  className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-2 py-1"
                >
                  Features
                </a>
                <a
                  href="#pricing"
                  className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-2 py-1"
                >
                  Pricing
                </a>
                <Link
                  to="/help"
                  className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-2 py-1"
                >
                  Docs
                </Link>
                <Link
                  to="/demo"
                  className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-2 py-1"
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
            <button
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
            </button>
          </div>
        </div>

        {/* Mobile Menu - Improved design with accessibility */}
        {mobileMenuOpen && (
          <nav
            id="mobile-menu"
            className="md:hidden bg-slate-900/95 backdrop-blur-xl border-b border-white/10 p-6 space-y-4"
            role="navigation"
            aria-label="Mobile navigation"
          >
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-300 hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-300 hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Pricing
            </a>
            <Link
              to="/help"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-300 hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Docs
            </Link>
            <Link
              to="/demo"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-300 hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Demo
            </Link>
            <hr className="border-white/10 my-4" aria-hidden="true" />
            <div className="space-y-3">
              <Link
                to="/sign-in"
                className="block text-center text-slate-300 hover:text-white text-base font-medium py-3 px-4 rounded-lg hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Log in
              </Link>
              <button
                onClick={handleGetStarted}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-white shadow-lg shadow-blue-500/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
              >
                Get Started Free
              </button>
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
              className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[120px] animate-pulse"
              style={{ animationDuration: "4s" }}
            />
            <div
              className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-[120px] animate-pulse"
              style={{ animationDuration: "6s" }}
            />
            <div
              className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px] animate-pulse"
              style={{ animationDuration: "8s" }}
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
              Structural Analysis <br className="hidden sm:block" />
              <span
                className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 animate-gradient"
                style={{ backgroundSize: "200% auto" }}
              >
                Reimagined for Web
              </span>
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-slate-400 mb-12 leading-relaxed px-4"
            >
              Professional-grade FEA in your browser — no install, no license
              servers. Full support reactions, 3D frame analysis with biaxial
              bending, member releases, P-Delta, and AI-powered design.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4"
            >
              <button
                onClick={handleGetStarted}
                className="group relative w-full sm:w-auto h-14 px-10 rounded-full bg-white text-slate-950 font-bold text-base hover:bg-blue-50 transition-all shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_4px_30px_rgba(59,130,246,0.15)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_8px_40px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2.5 overflow-hidden active:scale-[0.98]"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Start Analyzing Free{" "}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100/60 to-transparent -translate-x-full group-hover:animate-shimmer" />
              </button>
              <button
                onClick={() => navigate("/demo")}
                className="group w-full sm:w-auto h-14 px-8 rounded-full bg-white/[0.04] backdrop-blur-md border border-white/10 text-white font-medium hover:bg-white/[0.08] hover:border-white/20 transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />{" "}
                View Live Demo
              </button>
            </motion.div>

            {/* Social Proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-20 flex flex-col items-center gap-5"
            >
              <p className="text-xs text-slate-500 uppercase tracking-[0.2em] font-medium">
                Built for professionals across
              </p>
              <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
                {INDUSTRY_SEGMENTS.map((segment) => (
                  <div
                    key={segment}
                    className="px-3 py-1.5 text-base sm:text-lg font-bold text-slate-500/70 hover:text-slate-300 transition-colors duration-300 tracking-wide"
                  >
                    {segment}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Dashboard Preview — Realistic Product UI Mock */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.5,
                duration: 1,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="mt-24 relative mx-auto max-w-5xl group"
            >
              <div className="absolute -inset-px bg-gradient-to-r from-blue-500/50 via-violet-500/50 to-cyan-500/50 rounded-2xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-violet-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-40" />
              <div className="relative rounded-2xl border border-white/[0.08] bg-slate-900/90 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.5)] overflow-hidden aspect-video">
                {/* Title bar */}
                <div className="absolute top-0 inset-x-0 h-10 bg-slate-800/60 backdrop-blur-sm border-b border-white/[0.05] flex items-center px-4 gap-2 z-20">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-[11px] text-slate-500 font-medium">
                      BeamLab Ultimate — G+4 Residential Block.blp
                    </span>
                  </div>
                </div>

                {/* Left toolbar */}
                <div className="absolute top-10 left-0 bottom-0 w-12 bg-slate-800/40 border-r border-white/[0.05] flex flex-col items-center py-3 gap-3 z-10">
                  {[
                    "deployed_code",
                    "straighten",
                    "open_with",
                    "crop_free",
                    "visibility",
                    "grid_on",
                    "undo",
                  ].map((icon, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${i === 0 ? "bg-blue-500/20 text-blue-400" : "text-slate-600 hover:text-slate-400"} transition-colors`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {icon}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Right properties panel */}
                <div className="absolute top-10 right-0 bottom-0 w-52 bg-slate-800/30 border-l border-white/[0.05] p-3 z-10 hidden sm:block">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">
                    Properties
                  </div>
                  <div className="space-y-2">
                    <div className="bg-slate-900/50 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400 mb-1">
                        Section
                      </div>
                      <div className="text-[11px] text-white font-medium">
                        ISMB 300
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400 mb-1">
                        Material
                      </div>
                      <div className="text-[11px] text-white font-medium">
                        Fe 500 / M30
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400 mb-1">
                        Max Bending
                      </div>
                      <div className="text-[11px] text-emerald-400 font-mono font-medium">
                        142.6 kN·m
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400 mb-1">
                        Unity Check
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full w-[72%] bg-emerald-500 rounded-full" />
                        </div>
                        <span className="text-[11px] text-emerald-400 font-mono">
                          0.72
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400 mb-1">
                        Deflection
                      </div>
                      <div className="text-[11px] text-white font-mono">
                        L/386 <span className="text-emerald-400 ml-1">OK</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main viewport with frame structure */}
                <div className="absolute top-10 left-12 right-0 sm:right-52 bottom-8 bg-gradient-to-br from-slate-900 via-slate-800/80 to-slate-900">
                  <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)",
                      backgroundSize: "32px 32px",
                    }}
                  />
                  {/* 3-storey 2-bay frame structure */}
                  <svg
                    viewBox="0 0 400 280"
                    className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)]"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* Ground line */}
                    <line
                      x1="40"
                      y1="250"
                      x2="360"
                      y2="250"
                      stroke="#475569"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                    {/* Columns */}
                    {[100, 200, 300].map((x, i) => (
                      <g key={`col-${i}`}>
                        <line
                          x1={x}
                          y1="250"
                          x2={x}
                          y2="70"
                          stroke="#60a5fa"
                          strokeWidth="2.5"
                        />
                        {/* Nodes at floor levels */}
                        <circle cx={x} cy={250} r="3.5" fill="#3b82f6" />
                        <circle
                          cx={x}
                          cy={190}
                          r="3"
                          fill="#60a5fa"
                          className="animate-pulse"
                          style={{ animationDelay: `${i * 0.3}s` }}
                        />
                        <circle
                          cx={x}
                          cy={130}
                          r="3"
                          fill="#60a5fa"
                          className="animate-pulse"
                          style={{ animationDelay: `${i * 0.3 + 0.15}s` }}
                        />
                        <circle
                          cx={x}
                          cy={70}
                          r="3"
                          fill="#60a5fa"
                          className="animate-pulse"
                          style={{ animationDelay: `${i * 0.3 + 0.3}s` }}
                        />
                      </g>
                    ))}
                    {/* Beams — Floor 1 */}
                    <line
                      x1="100"
                      y1="190"
                      x2="200"
                      y2="190"
                      stroke="#a78bfa"
                      strokeWidth="2"
                    />
                    <line
                      x1="200"
                      y1="190"
                      x2="300"
                      y2="190"
                      stroke="#a78bfa"
                      strokeWidth="2"
                    />
                    {/* Beams — Floor 2 */}
                    <line
                      x1="100"
                      y1="130"
                      x2="200"
                      y2="130"
                      stroke="#a78bfa"
                      strokeWidth="2"
                    />
                    <line
                      x1="200"
                      y1="130"
                      x2="300"
                      y2="130"
                      stroke="#a78bfa"
                      strokeWidth="2"
                    />
                    {/* Beams — Roof */}
                    <line
                      x1="100"
                      y1="70"
                      x2="200"
                      y2="70"
                      stroke="#a78bfa"
                      strokeWidth="2"
                    />
                    <line
                      x1="200"
                      y1="70"
                      x2="300"
                      y2="70"
                      stroke="#a78bfa"
                      strokeWidth="2"
                    />
                    {/* Supports — Fixed */}
                    {[100, 200, 300].map((x, i) => (
                      <g key={`sup-${i}`}>
                        <rect
                          x={x - 6}
                          y={250}
                          width={12}
                          height={4}
                          fill="#60a5fa"
                          rx="1"
                        />
                        {[0, 1, 2, 3].map((j) => (
                          <line
                            key={j}
                            x1={x - 6 + j * 4}
                            y1={254}
                            x2={x - 8 + j * 4}
                            y2={258}
                            stroke="#60a5fa"
                            strokeWidth="1"
                          />
                        ))}
                      </g>
                    ))}
                    {/* Load arrows on roof */}
                    {[120, 150, 180, 220, 250, 280].map((x, i) => (
                      <g key={`load-${i}`} opacity={0.5}>
                        <line
                          x1={x}
                          y1="45"
                          x2={x}
                          y2="66"
                          stroke="#f87171"
                          strokeWidth="1"
                        />
                        <polygon
                          points={`${x - 3},66 ${x + 3},66 ${x},72`}
                          fill="#f87171"
                        />
                      </g>
                    ))}
                    {/* Deformed shape overlay */}
                    <path
                      d="M100,190 Q150,194 200,192 Q250,194 300,190"
                      stroke="#22d3ee"
                      strokeWidth="1"
                      fill="none"
                      strokeDasharray="3,3"
                      opacity="0.5"
                    />
                    <path
                      d="M100,130 Q150,133 200,132 Q250,133 300,130"
                      stroke="#22d3ee"
                      strokeWidth="1"
                      fill="none"
                      strokeDasharray="3,3"
                      opacity="0.5"
                    />
                    {/* Floor labels */}
                    <text
                      x="50"
                      y="193"
                      fill="#64748b"
                      fontSize="8"
                      textAnchor="end"
                    >
                      1F
                    </text>
                    <text
                      x="50"
                      y="133"
                      fill="#64748b"
                      fontSize="8"
                      textAnchor="end"
                    >
                      2F
                    </text>
                    <text
                      x="50"
                      y="73"
                      fill="#64748b"
                      fontSize="8"
                      textAnchor="end"
                    >
                      RF
                    </text>
                    {/* Dimension line */}
                    <line
                      x1="100"
                      y1="265"
                      x2="200"
                      y2="265"
                      stroke="#475569"
                      strokeWidth="0.5"
                    />
                    <text
                      x="150"
                      y="272"
                      fill="#64748b"
                      fontSize="7"
                      textAnchor="middle"
                    >
                      5.0 m
                    </text>
                  </svg>
                </div>

                {/* Status bar */}
                <div className="absolute bottom-0 inset-x-0 h-8 bg-slate-800/60 border-t border-white/[0.05] flex items-center px-4 justify-between z-20">
                  <div className="flex items-center gap-4 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{" "}
                      Analysis Complete
                    </span>
                    <span>Nodes: 12</span>
                    <span>Members: 15</span>
                  </div>
                  <div className="text-[10px] text-slate-600">
                    IS 456 : 2000 · IS 800 : 2007
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 sm:py-32 bg-slate-950 relative">
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
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 px-4 tracking-[-0.02em]">
                Everything Engineers Need
              </h2>
              <p className="mt-5 text-slate-400 max-w-2xl mx-auto text-sm sm:text-base px-4 leading-relaxed">
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

        {/* Competitive Advantage Section */}
        <section className="py-20 bg-slate-900/30">
          <CompetitiveAdvantage />
        </section>

        {/* Performance Metrics Section */}
        <section className="py-20 bg-slate-950">
          <PerformanceMetrics />
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 sm:py-32 bg-slate-900/30">
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
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 px-4 tracking-[-0.02em]">
                Simple, Transparent Pricing
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base px-4 leading-relaxed">
                Choose the perfect plan for your engineering needs. All plans
                include core analysis features.
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
                  className={`relative flex flex-col rounded-2xl sm:rounded-3xl p-6 sm:p-8 ${
                    tier.popular
                      ? "bg-slate-900/90 border-2 border-blue-500/40 shadow-[0_0_60px_rgba(59,130,246,0.12)] lg:scale-105 z-10 backdrop-blur-sm"
                      : "bg-slate-950/80 border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300"
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg uppercase tracking-wider whitespace-nowrap">
                      Most Popular
                    </div>
                  )}
                  <div className="mb-6">
                    <h3
                      className={`text-xl sm:text-2xl font-bold mb-2 ${tier.popular ? "text-white" : "text-slate-200"}`}
                    >
                      {tier.name}
                    </h3>
                    <p className="text-sm text-slate-400">{tier.description}</p>
                  </div>
                  <div className="mb-6 sm:mb-8">
                    <span className="text-3xl sm:text-4xl font-bold text-white">
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span className="text-slate-400 ml-1">
                        /{tier.period}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleGetStarted}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all mb-6 sm:mb-8 ${
                      tier.popular
                        ? "bg-white text-slate-950 hover:bg-slate-100 shadow-lg"
                        : "bg-slate-800 text-white hover:bg-slate-700"
                    }`}
                  >
                    {tier.cta}
                  </button>

                  <ul className="space-y-3 sm:space-y-4 flex-1">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3 text-sm text-slate-300"
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
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-20 bg-slate-900/30">
          <Testimonials />
        </section>

        {/* Security Compliance Section */}
        <section className="py-16 bg-slate-950">
          <SecurityCompliance />
        </section>

        {/* CTA Section */}
        <section
          className="py-24 relative overflow-hidden"
          aria-labelledby="cta-heading"
        >
          <CTABanner onGetStarted={handleGetStarted} />
        </section>
      </main>

      {/* Footer */}
      <footer
        className="border-t border-white/[0.06] py-14 sm:py-20 bg-slate-950"
        role="contentinfo"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 flex items-center justify-center rounded-lg overflow-hidden">
                  <img
                    src={beamLabLogo}
                    alt=""
                    className="w-full h-full object-cover"
                    aria-hidden="true"
                  />
                </div>
                <span className="text-xl font-bold text-white">
                  BeamLab Ultimate
                </span>
              </div>
              <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-6">
                Professional structural analysis software, reimagined for the
                modern web. Fast, accurate, and accessible anywhere — no
                installation required.
              </p>
              <div className="flex gap-4">
                <a
                  href="https://github.com"
                  className="text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-1"
                  aria-label="GitHub"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </a>
                <a
                  href="https://twitter.com"
                  className="text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-1"
                  aria-label="Twitter"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">
                Product
              </h3>
              <ul className="space-y-1 text-sm">
                <li>
                  <a
                    href="#features"
                    className="text-slate-400 hover:text-white transition-colors inline-block py-1.5"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="text-slate-400 hover:text-white transition-colors inline-block py-1.5"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <Link
                    to="/help"
                    className="text-slate-400 hover:text-white transition-colors inline-block py-1.5"
                  >
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link
                    to="/demo"
                    className="text-slate-400 hover:text-white transition-colors inline-block py-1.5"
                  >
                    Live Demo
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">
                Legal
              </h3>
              <ul className="space-y-1 text-sm">
                <li>
                  <Link
                    to="/privacy"
                    className="text-slate-400 hover:text-white transition-colors inline-block py-1.5"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="text-slate-400 hover:text-white transition-colors inline-block py-1.5"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="text-slate-400 hover:text-white transition-colors inline-block py-1.5"
                  >
                    Contact Us
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} BeamLab Ultimate. All rights
              reserved.
            </p>
            <p className="text-slate-400 text-xs">
              Made with ❤️ for structural engineers worldwide
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// --- DATA & COMPONENTS ---

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
    className="relative p-6 sm:p-8 rounded-2xl bg-slate-900/80 border border-white/[0.06] hover:border-blue-500/30 transition-all duration-300 group h-full flex flex-col hover-lift focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 overflow-hidden"
  >
    {/* Top gradient accent */}
    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="w-11 h-11 rounded-xl bg-blue-500/[0.08] border border-blue-500/10 flex items-center justify-center mb-5 group-hover:bg-blue-500/15 group-hover:border-blue-500/20 group-hover:text-blue-400 text-slate-400 transition-all duration-300 flex-shrink-0">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-white mb-2.5 tracking-[-0.01em]">
      {title}
    </h3>
    <p className="text-slate-400 leading-relaxed text-[0.8125rem] mb-6 flex-grow">
      {desc}
    </p>
    <ul className="space-y-2.5 mt-auto">
      {bullets.map((bullet, i) => (
        <li
          key={i}
          className="flex items-center gap-2.5 text-xs text-slate-400"
        >
          <CheckCircle className="w-3.5 h-3.5 text-blue-400/70 flex-shrink-0" />
          <span>{bullet}</span>
        </li>
      ))}
    </ul>
  </motion.div>
);

const INDUSTRY_SEGMENTS = [
  "Consulting Firms",
  "Universities",
  "Contractors",
  "Independent Engineers",
  "Research Labs",
];

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
];

const PRICING_TIERS = [
  {
    name: "Free",
    description: "Perfect for students and quick checks",
    price: "$0",
    period: "forever",
    features: [
      "Up to 5 projects",
      "Beam & frame analysis",
      "2D/3D structural models",
      "Support reactions table",
      "Standard reports",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Professional",
    description: "For practicing engineers",
    price: "$49",
    period: "month",
    features: [
      "Unlimited projects",
      "Advanced 3D analysis",
      "P-Delta & member releases",
      "Biaxial bending (Iy/Iz/J)",
      "Priority email support",
      "Cloud storage",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    description: "For teams and organizations",
    price: "Custom",
    period: null,
    features: [
      "Everything in Professional",
      "SSO & user management",
      "API access",
      "Custom integrations",
      "Dedicated account manager",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export default LandingPage;
