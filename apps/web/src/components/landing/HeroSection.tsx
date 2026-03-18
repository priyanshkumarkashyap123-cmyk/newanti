/**
 * HeroSection — Landing page hero with headline, CTA buttons, and animated beam visualization.
 * Extracted from LandingPage.tsx for code splitting and maintainability.
 */

import { FC, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Play, Layers, FileText, Shield, Cpu } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../ui/button';

const fadeInUp: import("framer-motion").Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.6, -0.05, 0.01, 0.99] as any } },
};

const STATS = [
  { value: '50K+', label: 'Engineers' },
  { value: '2M+', label: 'Analyses Run' },
  { value: '99.9%', label: 'Uptime' },
  { value: '10x', label: 'Faster than STAAD' },
];

interface HeroSectionProps {
  onGetStarted?: () => void;
}

export const HeroSection: FC<HeroSectionProps> = ({ onGetStarted }) => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();

  const handleGetStarted = useCallback(() => {
    if (onGetStarted) { onGetStarted(); return; }
    navigate(isSignedIn ? '/stream' : '/sign-up');
  }, [isSignedIn, navigate, onGetStarted]);

  return (
    <section
      className="relative pt-28 pb-20 lg:pt-44 lg:pb-36 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)',
            backgroundSize: '60px 60px',
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
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400">
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
          <Button onClick={handleGetStarted} variant="premium" size="xl" className="w-full sm:w-auto group">
            <span className="flex items-center gap-2.5">
              {isSignedIn ? 'Open Dashboard' : 'Get Started'}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Button>
          <Button
            onClick={() => navigate(isSignedIn ? '/app' : '/pricing')}
            variant="glass"
            size="xl"
            className="w-full sm:w-auto group"
          >
            <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
            {isSignedIn ? 'Open 3D Workspace' : 'View Pricing'}
          </Button>
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
  );
};

export default HeroSection;
