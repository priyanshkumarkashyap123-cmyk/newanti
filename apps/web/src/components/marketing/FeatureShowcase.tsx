/**
 * FeatureShowcase.tsx
 * 
 * Interactive feature demonstrations for the landing page
 * Showcases key product capabilities with animations
 */

import { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  Zap,
  Globe,
  Shield,
  Users,
  BarChart3,
  Layers,
  Brain,
  Smartphone,
  Cloud,
  Lock,
  Sparkles,
  Play,
  ChevronRight
} from 'lucide-react';

// ============================================
// COMPETITIVE ADVANTAGE SECTION
// ============================================

export const CompetitiveAdvantage: FC = () => {
  const competitors = [
    { name: 'ETABS/SAP2000', weaknesses: ['Expensive licenses', 'Desktop-only', 'Slow updates'] },
    { name: 'Robot Structural', weaknesses: ['Complex UI', 'Limited collaboration', 'Resource heavy'] },
    { name: 'STAAD.Pro', weaknesses: ['Outdated interface', 'License servers', 'No cloud'] },
  ];

  const advantages = [
    { icon: <Globe className="w-5 h-5" />, text: 'Works everywhere - browser based' },
    { icon: <Zap className="w-5 h-5" />, text: '10x faster with Rust/WASM engine' },
    { icon: <Users className="w-5 h-5" />, text: 'Real-time collaboration built-in' },
    { icon: <Brain className="w-5 h-5" />, text: 'AI-powered design assistance' },
    { icon: <Smartphone className="w-5 h-5" />, text: 'AR/VR visualization included' },
    { icon: <Cloud className="w-5 h-5" />, text: 'Auto-save & cloud backup' },
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block text-blue-400 text-sm font-semibold uppercase tracking-wider mb-4">
            Why BeamLab?
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Built for the Modern Engineer
          </h2>
          <p className="text-slate-300 max-w-2xl mx-auto">
            We studied what's broken in existing tools and built something better.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Competitor Pain Points */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-300 mb-6">
              Traditional tools are holding you back
            </h3>
            {competitors.map((comp, i) => (
              <motion.div
                key={comp.name}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-4 rounded-xl bg-red-500/5 border border-red-500/20"
              >
                <p className="font-medium text-slate-300 mb-2">{comp.name}</p>
                <div className="flex flex-wrap gap-2">
                  {comp.weaknesses.map((w) => (
                    <span key={w} className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400">
                      ✗ {w}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* BeamLab Advantages */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-6">
              BeamLab changes the game
            </h3>
            <div className="grid gap-3">
              {advantages.map((adv, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20"
                >
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                    {adv.icon}
                  </div>
                  <span className="text-slate-300">{adv.text}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ============================================
// PERFORMANCE METRICS SECTION
// ============================================

export const PerformanceMetrics: FC = () => {
  const metrics = [
    { value: '0.3ms', label: '100-DOF Solve Time', comparison: 'vs 5ms traditional' },
    { value: '300K+', label: 'Max Elements', comparison: 'GPU-accelerated' },
    { value: '15x', label: 'Faster with WebGPU', comparison: 'Matrix operations' },
    { value: '99.9%', label: 'Uptime SLA', comparison: 'Enterprise tier' },
  ];

  return (
    <section className="py-20 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {metrics.map((metric, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center p-6 rounded-2xl bg-slate-900/50 border border-slate-800"
            >
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                {metric.value}
              </div>
              <div className="text-white font-medium mb-1">{metric.label}</div>
              <div className="text-xs text-slate-400">{metric.comparison}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// INTERACTIVE DEMO SECTION
// ============================================

export const InteractiveDemo: FC = () => {
  const [activeDemo, setActiveDemo] = useState('analysis');

  const demos = [
    {
      id: 'analysis',
      title: '3D Analysis',
      description: 'Real-time structural analysis with instant results',
      features: ['Stress visualization', 'Deformation animation', 'Interactive inspection']
    },
    {
      id: 'ai',
      title: 'AI Assistant',
      description: 'Describe structures in plain English',
      features: ['Natural language input', 'Auto-generation', 'Smart suggestions']
    },
    {
      id: 'collab',
      title: 'Collaboration',
      description: 'Work together in real-time',
      features: ['Live cursors', 'Version control', 'Team comments']
    },
    {
      id: 'reports',
      title: 'Reports',
      description: 'Professional documentation in one click',
      features: ['Custom branding', 'Code compliance', 'Vector diagrams']
    }
  ];

  return (
    <section className="py-24 bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-blue-400 text-sm font-semibold uppercase tracking-wider mb-4">
            See It In Action
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Powerful Features, Simple Interface
          </h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Demo Selector */}
          <div className="space-y-3">
            {demos.map((demo) => (
              <button
                key={demo.id}
                onClick={() => setActiveDemo(demo.id)}
                className={`w-full text-left p-4 rounded-xl transition-all ${activeDemo === demo.id
                    ? 'bg-blue-500/20 border-2 border-blue-500'
                    : 'bg-slate-900 border-2 border-slate-800 hover:border-slate-700'
                  }`}
              >
                <h4 className={`font-semibold mb-1 ${activeDemo === demo.id ? 'text-blue-400' : 'text-white'
                  }`}>
                  {demo.title}
                </h4>
                <p className="text-sm text-slate-400">{demo.description}</p>
              </button>
            ))}
          </div>

          {/* Demo Preview */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeDemo}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="relative rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden aspect-video"
              >
                {/* Placeholder for actual demo */}
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                  <div className="text-center">
                    <button className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 mx-auto hover:bg-blue-500/30 transition-colors">
                      <Play className="w-6 h-6 text-blue-400 ml-1" />
                    </button>
                    <p className="text-slate-400">
                      Click to watch {demos.find(d => d.id === activeDemo)?.title} demo
                    </p>
                  </div>
                </div>

                {/* Feature Pills */}
                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                  {demos.find(d => d.id === activeDemo)?.features.map((f, i) => (
                    <span key={i} className="px-3 py-1 rounded-full bg-slate-800/80 backdrop-blur text-xs text-slate-300">
                      {f}
                    </span>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

// ============================================
// TESTIMONIALS SECTION
// ============================================

export const Testimonials: FC = () => {
  const testimonials = [
    {
      quote: "BeamLab has transformed how our team collaborates on structural projects. The real-time features are game-changing.",
      author: "Priya Sharma",
      role: "Senior Structural Engineer",
      company: "Thornton Tomasetti India",
      avatar: "PS",
      gradient: "from-pink-500 to-rose-500"
    },
    {
      quote: "Finally, a structural analysis tool that feels modern. The AI assistant alone has saved me hours on every project.",
      author: "James Chen",
      role: "Principal Engineer",
      company: "Arup Singapore",
      avatar: "JC",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      quote: "We switched from ETABS and haven't looked back. The browser-based approach makes our remote team incredibly efficient.",
      author: "Maria Rodriguez",
      role: "Structural Lead",
      company: "WSP Mexico",
      avatar: "MR",
      gradient: "from-emerald-500 to-teal-500"
    }
  ];

  return (
    <section className="py-24 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block text-blue-400 text-sm font-semibold uppercase tracking-wider mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Loved by Engineers Worldwide
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-all duration-300 hover-lift"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Sparkles key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400 group-hover:scale-110 transition-transform" style={{ transitionDelay: `${j * 50}ms` }} />
                ))}
              </div>
              <p className="text-slate-300 mb-6 leading-relaxed">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className={`relative w-12 h-12`}>
                  <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${t.gradient} blur-sm opacity-50 group-hover:opacity-100 transition-opacity`} />
                  <div className={`relative w-12 h-12 rounded-full bg-gradient-to-r ${t.gradient} flex items-center justify-center text-white font-bold text-sm ring-2 ring-slate-800`}>
                    {t.avatar}
                  </div>
                </div>
                <div>
                  <p className="font-medium text-white">{t.author}</p>
                  <p className="text-xs text-slate-400">{t.role}, {t.company}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// SECURITY & COMPLIANCE SECTION
// ============================================

export const SecurityCompliance: FC = () => {
  const badges = [
    { icon: <Lock className="w-6 h-6" />, label: 'SOC 2 Type II', desc: 'Enterprise security' },
    { icon: <Shield className="w-6 h-6" />, label: 'GDPR Compliant', desc: 'Data protection' },
    { icon: <Cloud className="w-6 h-6" />, label: '99.9% Uptime', desc: 'SLA guaranteed' },
    { icon: <Cpu className="w-6 h-6" />, label: 'ISO 27001', desc: 'Info security' },
  ];

  return (
    <section className="py-16 bg-slate-900/30 border-y border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Enterprise-Grade Security
            </h3>
            <p className="text-slate-400 text-sm">
              Your data is encrypted at rest and in transit. We take security seriously.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            {badges.map((badge, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-slate-400">{badge.icon}</div>
                <div>
                  <p className="text-sm font-medium text-white">{badge.label}</p>
                  <p className="text-xs text-slate-400">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ============================================
// CTA BANNER
// ============================================

export const CTABanner: FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => (
  <section className="py-20 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20" />
    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

    <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <h2 id="cta-heading" className="text-4xl md:text-5xl font-bold text-white mb-6">
          Ready to modernize your<br />structural workflow?
        </h2>
        <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
          Join 300,000+ engineers who've already made the switch. Start free, no credit card required.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto px-10 py-4 rounded-full bg-white text-slate-950 font-bold text-lg hover:bg-slate-100 transition-all shadow-2xl shadow-white/10 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-95"
          >
            Start Free Trial <ChevronRight className="w-5 h-5" />
          </button>
          <button className="w-full sm:w-auto px-10 py-4 rounded-full border-2 border-slate-600 text-white font-medium hover:bg-slate-800 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-95">
            Schedule Demo
          </button>
        </div>

        <p className="text-slate-400 text-sm mt-6">
          14-day Pro trial included • No credit card • Cancel anytime
        </p>
      </motion.div>
    </div>
  </section>
);

export default {
  CompetitiveAdvantage,
  PerformanceMetrics,
  InteractiveDemo,
  Testimonials,
  SecurityCompliance,
  CTABanner
};
