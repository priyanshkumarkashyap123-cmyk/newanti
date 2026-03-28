/**
 * FeaturesSection — Features grid/cards for the landing page.
 * Extracted from LandingPage.tsx for lazy loading.
 */

import { FC } from 'react';
import { motion } from 'framer-motion';
import { Zap, Globe2, Shield, Layers, Cpu, Cloud, FileText, Building, Database } from 'lucide-react';

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const FEATURES = [
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Lightning-Fast Analysis',
    description: 'WASM-powered in-browser solver for instant results on small models. Rust backend for large-scale analysis.',
    gradient: 'from-yellow-500/20 to-orange-500/20',
    iconColor: 'text-yellow-400',
  },
  {
    icon: <Globe2 className="w-6 h-6" />,
    title: 'International Design Codes',
    description: 'IS 456, IS 800, ACI 318, AISC 360, Eurocode 2/3/8, AS 4100 — all built-in and regularly updated.',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-blue-400',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Code-Compliant Design',
    description: 'Automated design checks with clause references. Every calculation traceable to the source standard.',
    gradient: 'from-green-500/20 to-emerald-500/20',
    iconColor: 'text-green-400',
  },
  {
    icon: <Layers className="w-6 h-6" />,
    title: '3D Frame & Plate Analysis',
    description: 'Full 3D structural analysis including plates, shells, and complex frame geometries.',
    gradient: 'from-purple-500/20 to-violet-500/20',
    iconColor: 'text-purple-400',
  },
  {
    icon: <Cpu className="w-6 h-6" />,
    title: 'AI Design Assistant',
    description: 'AI-powered suggestions for section selection, load optimization, and code compliance.',
    gradient: 'from-pink-500/20 to-rose-500/20',
    iconColor: 'text-pink-400',
  },
  {
    icon: <Cloud className="w-6 h-6" />,
    title: 'Cloud-First Collaboration',
    description: 'Real-time collaboration, cloud storage, and multi-device sync for engineering teams.',
    gradient: 'from-sky-500/20 to-blue-500/20',
    iconColor: 'text-sky-400',
  },
  {
    icon: <FileText className="w-6 h-6" />,
    title: 'Professional Reports',
    description: 'Generate branded PDF reports with calculations, diagrams, and design summaries.',
    gradient: 'from-amber-500/20 to-yellow-500/20',
    iconColor: 'text-amber-400',
  },
  {
    icon: <Building className="w-6 h-6" />,
    title: 'BIM Integration',
    description: 'Import/export IFC files. Integrate with Revit, AutoCAD, and other BIM tools.',
    gradient: 'from-teal-500/20 to-cyan-500/20',
    iconColor: 'text-teal-400',
  },
  {
    icon: <Database className="w-6 h-6" />,
    title: 'Section Database',
    description: 'Comprehensive database of IS, AISC, and European steel sections with search and filtering.',
    gradient: 'from-indigo-500/20 to-blue-500/20',
    iconColor: 'text-indigo-400',
  },
];

const FeatureCard: FC<typeof FEATURES[0]> = ({ icon, title, description, gradient, iconColor }) => {
  return (
    <motion.div
      variants={fadeInUp}
      className={`rounded-2xl bg-gradient-to-br ${gradient} border border-white/[0.08] p-6 hover:border-white/[0.14] transition-all duration-300 min-h-[220px] flex flex-col`}
    >
      <div className={`w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4 ${iconColor}`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-[#dae2fd] mb-2">{title}</h3>
      <p className="text-sm text-[#869ab8] leading-relaxed mt-auto">{description}</p>
    </motion.div>
  );
};

export const FeaturesSection: FC = () => (
  <section id="features" className="py-24 sm:py-32 bg-canvas relative">
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
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-slate-800 to-slate-500 dark:from-white dark:to-slate-300 px-4 tracking-[-0.02em]">
          Everything You Need for Structural Engineering
        </h2>
        <p className="mt-5 text-[#869ab8] max-w-2xl mx-auto text-sm sm:text-base px-4 leading-relaxed">
          Professional-grade structural analysis tools powered by modern web technologies.
          From simple beams to complex 3D frames — we've got you covered.
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
);

export default FeaturesSection;
