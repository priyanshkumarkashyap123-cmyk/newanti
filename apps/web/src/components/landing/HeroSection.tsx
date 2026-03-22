/**
 * HeroSection — Landing page hero with headline, CTA buttons, and animated beam visualization.
 * Extracted from LandingPage.tsx for code splitting and maintainability.
 */

import { FC, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Play, Sparkles, Activity } from 'lucide-react';
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
  { value: '10x', label: 'Faster Workflow' },
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

          <motion.div
            variants={fadeInUp}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold tracking-wider uppercase animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.15)]">
               <Sparkles className="w-3 h-3" />
               Next-Gen Structural Intelligence
            </div>
          </motion.div>

          <motion.h1
            id="hero-heading"
            variants={fadeInUp}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mb-7 leading-[1.08]"
          >
            Design the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400">Future</span>
            <br className="hidden sm:block" /> of Structural Engineering
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-[#869ab8] text-base sm:text-lg md:text-xl max-w-3xl mb-10 leading-relaxed"
          >
            The world's most performant cloud-native structural analysis platform.
            Analyze multi-story structures, foundations, and steel connections with
            high-fidelity results and a dramatically faster design loop.
          </motion.p>

          <motion.div 
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
          >
            <Button 
               size="lg" 
               className="h-13 px-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-500/30 text-base font-semibold group min-w-[220px]"
               onClick={handleGetStarted}
            >
              Start Designing <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
               variant="outline" 
               size="lg" 
               className="h-13 px-8 rounded-full border-[#1a2333] hover:bg-slate-50 dark:hover:bg-slate-900 text-base font-semibold backdrop-blur-sm min-w-[220px]"
            >
              <Play className="mr-2 w-5 h-5 text-blue-500" /> Watch Demo
            </Button>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl mb-16"
          >
            {STATS.map((stat) => (
              <div key={stat.label} className="ui-surface rounded-xl px-4 py-3 text-left">
                <p className="text-lg sm:text-xl font-extrabold text-[#dae2fd] leading-tight">{stat.value}</p>
                <p className="text-[11px] sm:text-xs text-[#869ab8] uppercase tracking-wider mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Interactive 3D structural mockup */}
          <motion.div
            variants={fadeInUp}
            className="relative w-full max-w-5xl aspect-video rounded-3xl overflow-hidden border border-white/20 dark:border-slate-800/50 bg-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.45)] group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-transparent to-slate-950/80 pointer-events-none z-10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-4/5 h-4/5 grid grid-cols-12 gap-1 opacity-20">
                {Array.from({ length: 144 }).map((_, i) => (
                  <div key={i} className="border border-blue-500/20 rounded-sm" />
                ))}
              </div>
              <motion.div
                animate={{ rotateY: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="absolute w-[60%] h-[60%] preserve-3d"
              >
                 <div className="absolute inset-0 border-2 border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.2)] skew-x-12" />
                 <div className="absolute inset-0 border-2 border-indigo-500/20 translate-z-20 -translate-y-10" />
                 <div className="absolute inset-0 border-2 border-violet-500/10 -translate-z-20 translate-y-10" />
              </motion.div>
            </div>
            <div className="absolute top-6 left-6 z-20 flex gap-2">
               <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
               <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
               <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="absolute bottom-6 right-6 z-20">
               <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-xl flex items-center gap-3">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <span className="text-white text-xs font-medium tracking-wide">Auto-Optimized Member M231 (IS 800)</span>
               </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
