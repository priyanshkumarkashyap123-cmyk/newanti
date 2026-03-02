/**
 * Spotlight Component
 * Onboarding highlight/tooltip for new user guidance
 */

import React from 'react';
import { FC, ReactNode, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Lightbulb } from 'lucide-react';

// ============================================
// Types
// ============================================

interface SpotlightStep {
    target: string; // CSS selector for target element
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

interface SpotlightProps {
    steps: SpotlightStep[];
    isActive: boolean;
    onComplete: () => void;
    onSkip?: () => void;
}

// ============================================
// Tooltip Positions
// ============================================

const getTooltipPosition = (
    targetRect: DOMRect,
    position: SpotlightStep['position'] = 'bottom'
) => {
    const offset = 12;

    switch (position) {
        case 'top':
            return {
                top: targetRect.top - offset,
                left: targetRect.left + targetRect.width / 2,
                transform: 'translate(-50%, -100%)',
            };
        case 'bottom':
            return {
                top: targetRect.bottom + offset,
                left: targetRect.left + targetRect.width / 2,
                transform: 'translate(-50%, 0)',
            };
        case 'left':
            return {
                top: targetRect.top + targetRect.height / 2,
                left: targetRect.left - offset,
                transform: 'translate(-100%, -50%)',
            };
        case 'right':
            return {
                top: targetRect.top + targetRect.height / 2,
                left: targetRect.right + offset,
                transform: 'translate(0, -50%)',
            };
        default:
            return {
                top: targetRect.bottom + offset,
                left: targetRect.left + targetRect.width / 2,
                transform: 'translate(-50%, 0)',
            };
    }
};

// ============================================
// Spotlight Component
// ============================================

export const Spotlight: FC<SpotlightProps> = ({
    steps,
    isActive,
    onComplete,
    onSkip
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
    const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});

    const step = steps[currentStep];

    useEffect(() => {
        if (!isActive || !step) return;

        const updatePosition = () => {
            const target = document.querySelector(step.target);
            if (target) {
                const rect = target.getBoundingClientRect();

                // Highlight position
                setHighlightStyle({
                    top: rect.top - 4,
                    left: rect.left - 4,
                    width: rect.width + 8,
                    height: rect.height + 8,
                });

                // Tooltip position
                setTooltipStyle(getTooltipPosition(rect, step.position));
            }
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isActive, step, currentStep]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    if (!isActive || !step) return null;

    return (
        <AnimatePresence>
            {/* Overlay */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[999] pointer-events-auto"
            >
                {/* Dark overlay with cutout */}
                <div className="absolute inset-0 bg-black/70" />

                {/* Highlight Ring */}
                <motion.div
                    layoutId="spotlight"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="absolute rounded-lg ring-2 ring-blue-500 ring-offset-4 ring-offset-black/0 pointer-events-none"
                    style={{
                        ...highlightStyle,
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
                    }}
                />

                {/* Tooltip */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ delay: 0.1 }}
                    className="fixed w-80 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[1000]"
                    style={tooltipStyle}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-yellow-400" />
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Step {currentStep + 1} of {steps.length}
                            </span>
                        </div>
                        <button type="button"
                            onClick={onSkip}
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        <h4 className="text-slate-900 dark:text-white font-bold mb-2">{step.title}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{step.content}</p>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-100/30 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800">
                        <button type="button"
                            onClick={handlePrevious}
                            disabled={currentStep === 0}
                            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>
                        <button type="button"
                            onClick={handleNext}
                            className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                            {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Progress Dots */}
                    <div className="flex justify-center gap-1.5 pb-3">
                        {steps.map((_, index) => (
                            <div
                                key={index}
                                className={`w-1.5 h-1.5 rounded-full transition-colors ${index === currentStep
                                        ? 'bg-blue-500'
                                        : index < currentStep
                                            ? 'bg-blue-500/50'
                                            : 'bg-slate-600'
                                    }`}
                            />
                        ))}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ============================================
// Quick Tip Component (Simpler tooltip)
// ============================================

interface QuickTipProps {
    children: ReactNode;
    tip: string;
    show?: boolean;
}

export const QuickTip: FC<QuickTipProps> = ({ children, tip, show = false }) => {
    const [isVisible, setIsVisible] = useState(show);

    return (
        <div className="relative inline-block">
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 whitespace-nowrap"
                    >
                        <div className="flex items-center gap-2 text-sm">
                            <Lightbulb className="w-3 h-3 text-yellow-400" />
                            <span className="text-slate-700 dark:text-slate-200">{tip}</span>
                        </div>
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                            <div className="border-8 border-transparent border-t-slate-800" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <button type="button"
                onClick={() => setIsVisible(!isVisible)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center hover:bg-blue-400 transition-colors"
            >
                ?
            </button>
        </div>
    );
};

export default Spotlight;
