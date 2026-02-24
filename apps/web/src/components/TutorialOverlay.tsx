/**
 * TutorialOverlay.tsx - First-Time User Tutorial
 * Multi-step onboarding overlay with feature spotlights
 */

import { FC, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, ArrowRight, ArrowLeft, MousePointer2, Box,
    Zap, BarChart2, FileText, CheckCircle, Sparkles
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface TutorialStep {
    id: number;
    title: string;
    description: string;
    icon: FC<{ className?: string }>;
    highlight?: 'sidebar' | 'viewport' | 'toolbar' | 'none';
}

interface TutorialOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

// ============================================
// TUTORIAL STEPS
// ============================================

const STEPS: TutorialStep[] = [
    {
        id: 1,
        title: "Welcome to BeamLab Ultimate!",
        description: "Let's take a quick tour of the essential features that will transform your structural engineering workflow.",
        icon: Sparkles,
        highlight: 'none',
    },
    {
        id: 2,
        title: "Build Your Models",
        description: "Use the Smart Sidebar on the left to add nodes, members, and define your structure. You can also use templates or describe your structure to the AI.",
        icon: Box,
        highlight: 'sidebar',
    },
    {
        id: 3,
        title: "Apply Loads & Supports",
        description: "Switch to the Loading tab to apply point loads, distributed loads, and moments. Define supports with our intuitive constraint system.",
        icon: MousePointer2,
        highlight: 'toolbar',
    },
    {
        id: 4,
        title: "Run Analysis Instantly",
        description: "Click the 'Run Analysis' button or press Ctrl+Enter. Our cloud-native solver returns results in seconds, even for complex models.",
        icon: Zap,
        highlight: 'toolbar',
    },
    {
        id: 5,
        title: "Visualize Results",
        description: "View shear force, bending moment, and deflection diagrams directly on your 3D model. Toggle between different result types easily.",
        icon: BarChart2,
        highlight: 'viewport',
    },
    {
        id: 6,
        title: "Generate Reports",
        description: "Export professional PDF reports with diagrams, calculations, and code compliance checks. Perfect for client presentations and documentation.",
        icon: FileText,
        highlight: 'none',
    },
];

// ============================================
// PROGRESS INDICATOR
// ============================================

const ProgressIndicator: FC<{ current: number; total: number }> = ({ current, total }) => (
    <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
            <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i < current ? 'w-6 bg-blue-500' : 'w-1.5 bg-zinc-600'
                    }`}
            />
        ))}
    </div>
);

// ============================================
// STEP CARD
// ============================================

const StepCard: FC<{ step: TutorialStep; isActive: boolean }> = ({ step, isActive }) => {
    const Icon = step.icon;

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col items-center text-center"
        >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-600/30 mb-6">
                <Icon className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                {step.title}
            </h2>
            <p className="text-zinc-400 text-base md:text-lg max-w-md leading-relaxed">
                {step.description}
            </p>
        </motion.div>
    );
};

// ============================================
// MAIN TUTORIAL OVERLAY COMPONENT
// ============================================

export const TutorialOverlay: FC<TutorialOverlayProps> = ({ isOpen, onClose, onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSkip = () => {
        onClose();
    };

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            queueMicrotask(() => setCurrentStep(0));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const step = STEPS[currentStep];
    const isLastStep = currentStep === STEPS.length - 1;
    const isFirstStep = currentStep === 0;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center"
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md" />

                {/* Highlight Overlay */}
                {step.highlight === 'sidebar' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute left-0 top-0 w-72 h-full border-r-2 border-blue-500 bg-blue-500/5 pointer-events-none z-10"
                    />
                )}
                {step.highlight === 'toolbar' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute right-8 top-20 w-64 h-14 rounded-lg border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-10"
                    />
                )}
                {step.highlight === 'viewport' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-xl border-2 border-blue-500 bg-blue-500/5 pointer-events-none z-10"
                    />
                )}

                {/* Modal Card */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative z-20 w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Close Button */}
                    <button
                        onClick={handleSkip}
                        className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Content */}
                    <div className="p-8 md:p-12">
                        {/* Step Number */}
                        <div className="text-center mb-6">
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-sm font-medium">
                                Step {currentStep + 1} of {STEPS.length}
                            </span>
                        </div>

                        {/* Step Content */}
                        <AnimatePresence mode="wait">
                            <StepCard key={step.id} step={step} isActive={true} />
                        </AnimatePresence>

                        {/* Progress Indicator */}
                        <div className="flex justify-center mt-8">
                            <ProgressIndicator current={currentStep + 1} total={STEPS.length} />
                        </div>
                    </div>

                    {/* Footer / Navigation */}
                    <div className="px-8 py-5 bg-zinc-800/50 border-t border-zinc-800 flex items-center justify-between">
                        <button
                            onClick={handleSkip}
                            className="text-zinc-400 hover:text-white text-sm font-medium transition-colors"
                        >
                            Skip Tutorial
                        </button>

                        <div className="flex items-center gap-3">
                            {!isFirstStep && (
                                <button
                                    onClick={handlePrev}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white text-sm font-medium transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Previous
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-600/20 transition-all"
                            >
                                {isLastStep ? (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        Get Started
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence >
    );
};

export default TutorialOverlay;
