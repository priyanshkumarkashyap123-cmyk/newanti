/**
 * SpacePlanningLandingPage.tsx — Premium marketing entry page
 *
 * Showcases Space Planning capabilities before users enter the full tool.
 * Features hero with animated wireframe background, feature grid,
 * "How it works" steps, and CTA to the main space planning workspace.
 */

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Compass,
  Layers,
  Zap,
  Droplets,
  Wind,
  Sun,
  Ruler,
  Palette,
  Settings2,
  LayoutGrid,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Brain,
  Shield,
  Target,
  Eye,
  FileDown,
  Star,
  Users,
  Globe,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { SEO } from '../components/SEO';

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────

const FEATURES = [
  {
    icon: Brain,
    title: 'AI Generative Design',
    description: 'Generate optimized floor plans from minimal input using constraint-based AI solver with multiple layout variants.',
    color: 'from-violet-500 to-purple-600',
    shadow: 'shadow-violet-500/20',
  },
  {
    icon: Compass,
    title: 'Vastu & Orientation',
    description: 'Automated Vastu Shastra compliance with room placement optimization based on cardinal directions.',
    color: 'from-amber-500 to-orange-600',
    shadow: 'shadow-amber-500/20',
  },
  {
    icon: Zap,
    title: 'Electrical Planning',
    description: 'Complete electrical layout with circuit design, fixture placement, load calculations, and panel sizing.',
    color: 'from-yellow-500 to-amber-600',
    shadow: 'shadow-yellow-500/20',
  },
  {
    icon: Droplets,
    title: 'Plumbing Design',
    description: 'Supply/drainage network, fixture placement, rainwater harvesting, and pipe sizing per IS standards.',
    color: 'from-cyan-500 to-blue-600',
    shadow: 'shadow-cyan-500/20',
  },
  {
    icon: Wind,
    title: 'HVAC & Ventilation',
    description: 'Air conditioning sizing, duct routing, cross-ventilation study, and exhaust planning for every room.',
    color: 'from-teal-500 to-emerald-600',
    shadow: 'shadow-teal-500/20',
  },
  {
    icon: Sun,
    title: 'Sunlight Analysis',
    description: 'Shadow casting simulation, daylight factor analysis, and solar gain optimization for energy efficiency.',
    color: 'from-orange-500 to-red-500',
    shadow: 'shadow-orange-500/20',
  },
  {
    icon: Eye,
    title: '4 Elevation Views',
    description: 'Automatically generated front, rear, left, and right elevation drawings with material annotations.',
    color: 'from-blue-500 to-indigo-600',
    shadow: 'shadow-blue-500/20',
  },
  {
    icon: Palette,
    title: 'Color & Material',
    description: 'AI-recommended color schemes and material specifications for finishes, flooring, and facades.',
    color: 'from-pink-500 to-rose-600',
    shadow: 'shadow-pink-500/20',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Configure',
    description: 'Define plot dimensions, room count, Vastu preferences, and spatial constraints.',
    icon: Settings2,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
  },
  {
    step: '02',
    title: 'Generate',
    description: 'AI creates multiple layout variants with structural, MEP, and compliance analysis.',
    icon: Sparkles,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    step: '03',
    title: 'Refine & Export',
    description: 'Compare variants, adjust rooms, and export to DXF/PDF with complete drawings.',
    icon: FileDown,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
];

const COMPARISONS = [
  { feature: 'AI-Powered Layout Generation', beamlab: true, traditional: false },
  { feature: 'Vastu Compliance Check', beamlab: true, traditional: false },
  { feature: 'Integrated MEP (Electrical + Plumbing + HVAC)', beamlab: true, traditional: false },
  { feature: 'Multiple Variant Comparison', beamlab: true, traditional: false },
  { feature: 'Constraint Solver Optimization', beamlab: true, traditional: false },
  { feature: 'Sunlight & Shadow Analysis', beamlab: true, traditional: false },
  { feature: 'Automated Elevation Generation', beamlab: true, traditional: true },
  { feature: 'Real-time Floor Plan Editing', beamlab: true, traditional: true },
  { feature: 'DXF/PDF Export', beamlab: true, traditional: true },
];

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function SpacePlanningLandingPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    document.title = 'Space Planning — AI Floor Plan Generator | BeamLab';
  }, []);

  const handleCTA = () => {
    navigate(isSignedIn ? '/space-planning' : '/sign-up');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <SEO
        title="AI Space Planning — Floor Plan Generator"
        description="Generate optimized floor plans with AI. Includes Vastu compliance, MEP integration, sunlight analysis, and elevation views."
        path="/space-planning/landing"
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-20 px-6">
        {/* Animated grid background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
          <motion.div
            className="absolute top-20 right-1/4 w-96 h-96 rounded-full bg-gradient-radial from-violet-200/20 to-transparent dark:from-violet-900/10"
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-10 left-1/4 w-72 h-72 rounded-full bg-gradient-radial from-blue-200/20 to-transparent dark:from-blue-900/10"
            animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-50 dark:bg-violet-500/10 border border-violet-200/50 dark:border-violet-500/20 rounded-full text-violet-600 dark:text-violet-300 text-xs font-semibold mb-6">
              <Sparkles className="w-3 h-3" />
              AI-Powered Architecture
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-5 leading-[1.1]">
              Design your perfect space
              <br />
              <span className="bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                in minutes, not weeks
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
              From a simple configuration to complete architectural drawings — floor plans,
              elevations, MEP layouts, Vastu compliance, and sunlight analysis. All generated
              by AI with 35+ years of engineering wisdom.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleCTA}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold text-sm shadow-xl shadow-violet-500/20 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2"
              >
                {isSignedIn ? 'Open Space Planner' : 'Get Started Free'}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Learn More
              </button>
            </div>

            {/* Trust signals */}
            <div className="flex items-center justify-center gap-6 mt-10 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3" /> IS 456 / NBC 2016 Compliant
              </span>
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" /> Vastu Shastra Verified
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> 1000+ Plans Generated
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-3">
              Everything in one plan
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              Multi-disciplinary planning that covers architectural, structural, MEP, and
              environmental analysis — all from a single configuration.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="group p-5 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-lg border border-slate-200/50 dark:border-slate-700/30 hover:border-blue-200/50 dark:hover:border-blue-500/30 hover:shadow-lg transition-all duration-300"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg ${feature.shadow} mb-3`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1.5">
                    {feature.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-3">
              Three steps to your dream home
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              From configuration to complete architectural drawings in minutes.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="relative text-center p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-700/30"
                >
                  <div className={`w-12 h-12 rounded-xl ${step.bgColor} flex items-center justify-center mx-auto mb-4`}>
                    <Icon className={`w-6 h-6 ${step.color}`} />
                  </div>
                  <div className={`text-[10px] font-bold ${step.color} mb-2`}>STEP {step.step}</div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">{step.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{step.description}</p>

                  {/* Connector arrow */}
                  {i < STEPS.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-3.5 transform -translate-y-1/2 z-10">
                      <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-3">
              Why choose AI-powered planning?
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              See how BeamLab's Space Planning compares to traditional tools.
            </p>
          </motion.div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/50 dark:border-slate-700/30 bg-white dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Feature
                  </th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      BeamLab
                    </div>
                  </th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Traditional
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISONS.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={i % 2 === 0 ? '' : 'bg-slate-50/40 dark:bg-slate-800/20'}
                  >
                    <td className="px-5 py-2.5 text-[12px] text-slate-700 dark:text-slate-300">
                      {row.feature}
                    </td>
                    <td className="text-center px-4 py-2.5">
                      {row.beamlab ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="text-center px-4 py-2.5">
                      {row.traditional ? (
                        <CheckCircle2 className="w-4 h-4 text-slate-400 mx-auto" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center bg-gradient-to-br from-violet-600 to-blue-700 rounded-3xl p-10 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudy5vcmcvMjAwMC9zdmciPjxnIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+PGcgZmlsbD0iI2ZmZmZmZiIgZmlsbC1vcGFjaXR5PSIwLjA1Ij48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnYyaDR2MmgtNHptMC0zMGgydjJoLTJ2LTJ6bS0yIDZoMnYyaC0ydi0yem0tNiA2aDJ2MmgtMnYtMnptMTIgMGgydjJoLTJ2LTJ6bS02IDZoMnYyaC0ydi0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
          <div className="relative">
            <Building2 className="w-12 h-12 text-white/90 mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
              Ready to design your space?
            </h2>
            <p className="text-blue-100/80 text-sm mb-6 max-w-md mx-auto">
              Join thousands of architects and engineers using AI to create optimized,
              compliant, and beautiful floor plans.
            </p>
            <button
              type="button"
              onClick={handleCTA}
              className="px-8 py-3.5 rounded-xl bg-white text-violet-700 font-bold text-sm shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2 mx-auto"
            >
              {isSignedIn ? 'Open Space Planner' : 'Start Planning Free'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
