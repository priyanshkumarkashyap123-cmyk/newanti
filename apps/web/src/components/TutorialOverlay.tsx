/**
 * TutorialOverlay.tsx - First-Time User Tutorial
 * Multi-step onboarding overlay with feature spotlights
 */

import { FC, useState, useEffect } from 'react';
import {
    ArrowRight, ArrowLeft, MousePointer2, Box,
    Zap, BarChart2, FileText, CheckCircle, Sparkles
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

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
        title: "Welcome to BeamLab!",
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
                className={`h-1.5 rounded-full transition-all duration-300 ${i < current ? 'w-6 bg-blue-500' : 'w-1.5 bg-slate-300 dark:bg-slate-600'
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
        <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-600/30 mb-6">
                <Icon className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                {step.title}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg max-w-md leading-relaxed">
                {step.description}
            </p>
        </div>
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

    const step = STEPS[currentStep];
    const isLastStep = currentStep === STEPS.length - 1;
    const isFirstStep = currentStep === 0;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg p-0 overflow-hidden">
                <DialogHeader className="sr-only">
                    <DialogTitle>Tutorial</DialogTitle>
                    <DialogDescription>Step-by-step onboarding guide</DialogDescription>
                </DialogHeader>

                {/* Content */}
                <div className="p-8 md:p-12">
                    {/* Step Number */}
                    <div className="text-center mb-6">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-medium">
                            Step {currentStep + 1} of {STEPS.length}
                        </span>
                    </div>

                    {/* Step Content */}
                    <StepCard key={step.id} step={step} isActive={true} />

                    {/* Progress Indicator */}
                    <div className="flex justify-center mt-8">
                        <ProgressIndicator current={currentStep + 1} total={STEPS.length} />
                    </div>
                </div>

                {/* Footer / Navigation */}
                <DialogFooter className="px-8 py-5 bg-slate-100 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        onClick={handleSkip}
                        className="text-slate-500 dark:text-slate-400"
                    >
                        Skip Tutorial
                    </Button>

                    <div className="flex items-center gap-3">
                        {!isFirstStep && (
                            <Button
                                variant="outline"
                                onClick={handlePrev}
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Previous
                            </Button>
                        )}
                        <Button
                            onClick={handleNext}
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
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default TutorialOverlay;
