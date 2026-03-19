/**
 * HeroSection — Landing page hero with headline, CTA buttons, and animated beam visualization.
 * Extracted from LandingPage.tsx for code splitting and maintainability.
 */

import { FC, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../ui/button';

const fadeInUp: import("framer-motion").Variants = {
  hidden: { opacity: 0, y: 40, filter: 'blur(5px)' },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: [0.3, 0.05, 0.1, 0.99] as any } 
  },
};

const staggerContainer: import("framer-motion").Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
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
  const { isSignedIn } = useAuth();
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
  const y2 = useTransform(scrollY, [0, 1000], [0, -100]);

  const handleGetStarted = useCallback(() => {
    if (onGetStarted) { onGetStarted(); return; }
    navigate(isSignedIn ? '/stream' : '/sign-up');
  }, [isSignedIn, navigate, onGetStarted]);

  return (
    <section
      className="relative pt-28 pb-20 lg:pt-44 lg:pb-36 overflow-hidden perspective-1000"
      aria-labelledby="hero-heading"
    >
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <motion.div 
          style={{ y: y1 }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[100px]" 
        />
        <motion.div 
          style={{ y: y2 }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.2, 0.15] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[100px]" 
        />
        <motion.div 
          animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[100px]" 
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
        <motion.div
           variants={staggerContainer}
           initial="hidden"
           animate="visible"
           className="flex flex-col items-center"
        >
          <motion.div
            variants={fadeInUp}
            whileHover={{ scale: 1.05 }}
            className="inline-flex items-center gap-2.5 px-6 py-2 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-10 backdrop-blur-sm cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all hover:bg-emerald-500/[0.12] hover:shadow-[0_0_25px_rgba(16,185,129,0.25)]"
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
            variants={fadeInUp}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] xl:text-[5rem] font-extrabold tracking-[-0.02em] mb-8 leading-[1.05]"
          >
            The Future of Structural <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 animate-gradient-x drop-shadow-sm">
              Engineering is Here
            </span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-12 leading-relaxed px-4"
          >
            Professional-grade structural analysis and design platform.
            STAAD.Pro level power, browser-native. AI-powered. Cloud-first.
            Indian standards built-in.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-5 px-4 w-full sm:w-auto"
          >
            <Button onClick={handleGetStarted} variant="premium" size="xl" className="w-full sm:w-auto group relative overflow-hidden">
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-500/0 via-white/20 to-blue-500/0 -translate-x-[150%] skew-x-[-30deg] animate-[shimmer_2s_infinite]" />
              <span className="flex items-center gap-2.5 relative z-10 font-semibold tracking-wide">
                {isSignedIn ? 'Open Dashboard' : 'Get Started'}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
            <Button
              onClick={() => navigate(isSignedIn ? '/app' : '/pricing')}
              variant="outline"
              size="xl"
              className="w-full sm:w-auto group border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-semibold"
            >
              <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform mr-2" />
              {isSignedIn ? 'Open 3D Workspace' : 'View Pricing'}
            </Button>
          </motion.div>

          {/* Animated Stats Bar */}
          <motion.div
            variants={fadeInUp}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto w-full pt-10 border-t border-slate-200/50 dark:border-slate-800/50"
          >
            {STATS.map((stat, i) => (
              <motion.div 
                key={i} 
                className="text-center"
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 mb-2">{stat.value}</div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
