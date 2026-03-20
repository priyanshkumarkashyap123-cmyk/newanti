/**
 * ProductTour.tsx
 * 
 * Interactive product tour for new users
 * Highlights key features and guides through the interface
 */

import React from 'react';
import { FC, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Layers, 
  Calculator,
  FileText,
  Users,
  Lightbulb,
  CheckCircle2
} from 'lucide-react';

// ============================================
// TOUR STEP DATA
// ============================================

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right';
  actionText?: string;
  tip?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to BeamLab!',
    description: 'Let us show you around the most powerful structural analysis platform. This quick tour will help you get started.',
    icon: <Sparkles className="w-6 h-6" />,
    tip: 'You can skip this tour anytime and access it later from Help menu.'
  },
  {
    id: 'modeling',
    title: '3D Modeling Canvas',
    description: 'Create your structural model visually. Add nodes, beams, columns, and supports with simple click-and-drag. The canvas supports real-time 3D manipulation.',
    icon: <Layers className="w-6 h-6" />,
    targetSelector: '[data-tour="canvas"]',
    position: 'right',
    tip: 'Pro tip: Hold Shift to snap nodes to grid, or use AI to generate structures from text!'
  },
  {
    id: 'analysis',
    title: 'Run Analysis',
    description: 'Click the Analyze button to run finite element analysis. See displacement, forces, and stresses in real-time with our high-performance solver.',
    icon: <Calculator className="w-6 h-6" />,
    targetSelector: '[data-tour="analyze-button"]',
    position: 'bottom',
    actionText: 'Try: Run your first analysis',
    tip: 'Supports: Static, P-Delta, Buckling, Modal, Time History, and more!'
  },
  {
    id: 'results',
    title: 'Visualize Results',
    description: 'View deformed shapes, stress heatmaps, and force diagrams. Toggle between different result types and view detailed values at any point.',
    icon: <Lightbulb className="w-6 h-6" />,
    targetSelector: '[data-tour="results-panel"]',
    position: 'left',
    tip: 'Click on any member to see detailed force diagrams and values.'
  },
  {
    id: 'reports',
    title: 'Generate Reports',
    description: 'Export professional PDF reports with your company branding. Includes all calculations, diagrams, and code compliance checks.',
    icon: <FileText className="w-6 h-6" />,
    targetSelector: '[data-tour="export-button"]',
    position: 'bottom',
    tip: 'Enterprise users can customize report templates.'
  },
  {
    id: 'collaboration',
    title: 'Collaborate with Team',
    description: 'Share projects with team members and work together in real-time. Leave comments, track changes, and manage versions.',
    icon: <Users className="w-6 h-6" />,
    targetSelector: '[data-tour="share-button"]',
    position: 'bottom',
    tip: 'Available on Pro and Enterprise plans.'
  },
  {
    id: 'complete',
    title: "You're Ready!",
    description: "That's the basics! Start by creating a new project or importing an existing model. Need help? Check our documentation or AI assistant.",
    icon: <CheckCircle2 className="w-6 h-6" />,
    actionText: 'Start Creating'
  }
];

// ============================================
// PRODUCT TOUR COMPONENT
// ============================================

interface ProductTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const ProductTour: FC<ProductTourProps> = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  // Update highlight position when step changes
  useEffect(() => {
    queueMicrotask(() => {
      if (step.targetSelector) {
        const element = document.querySelector(step.targetSelector);
        if (element) {
          const rect = element.getBoundingClientRect();
          setHighlightRect(rect);
        } else {
          setHighlightRect(null);
        }
      } else {
        setHighlightRect(null);
      }
    });
  }, [currentStep, step.targetSelector]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50">
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleSkip}
        />

        {/* Highlight cutout (if targeting an element) */}
        {highlightRect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute border-2 border-blue-500 rounded-lg pointer-events-none"
            style={{
              left: highlightRect.left - 8,
              top: highlightRect.top - 8,
              width: highlightRect.width + 16,
              height: highlightRect.height + 16,
              boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.8), 0 0 30px rgba(59, 130, 246, 0.5)'
            }}
          />
        )}

        {/* Tour Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={`absolute bg-[#0b1326] border border-[#1a2333] rounded-2xl shadow-2xl max-w-[320px] p-6 ${
            highlightRect 
              ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
              : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
          }`}
        >
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentStep 
                    ? 'w-6 bg-blue-500' 
                    : i < currentStep 
                    ? 'bg-blue-500/50' 
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 mx-auto text-white">
            {step.icon}
          </div>

          {/* Content */}
          <h3 className="text-xl font-bold text-[#dae2fd] text-center mb-2">
            {step.title}
          </h3>
          <p className="text-[#869ab8] text-center mb-4 leading-relaxed">
            {step.description}
          </p>

          {/* Tip */}
          {step.tip && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 mb-6">
              <p className="text-blue-400 text-sm">
                💡 {step.tip}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-4">
            <button type="button"
              onClick={handleSkip}
              className="text-sm text-[#869ab8] hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-3">
              {!isFirstStep && (
                <button type="button"
                  onClick={handlePrevious}
                  className="p-2 rounded-lg border border-[#1a2333] text-[#869ab8] hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <button type="button"
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all"
              >
                {isLastStep ? step.actionText || 'Get Started' : 'Next'}
                {!isLastStep && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Close button */}
          <button type="button"
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 text-[#869ab8] hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// ============================================
// HOOK FOR TOUR STATE
// ============================================

const TOUR_COMPLETED_KEY = 'beamlab_tour_completed';

export const useProductTour = () => {
  const [showTour, setShowTour] = useState(false);
  const [hasCompletedTour, setHasCompletedTour] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOUR_COMPLETED_KEY) === 'true';
    }
    return false;
  });

  const startTour = () => {
    setShowTour(true);
  };

  const closeTour = () => {
    setShowTour(false);
  };

  const completeTour = () => {
    setHasCompletedTour(true);
    localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
    setShowTour(false);
  };

  const resetTour = () => {
    setHasCompletedTour(false);
    localStorage.removeItem(TOUR_COMPLETED_KEY);
  };

  // Auto-start tour for new users
  useEffect(() => {
    if (!hasCompletedTour) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        setShowTour(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [hasCompletedTour]);

  return {
    showTour,
    startTour,
    closeTour,
    completeTour,
    resetTour,
    hasCompletedTour
  };
};

export default ProductTour;
