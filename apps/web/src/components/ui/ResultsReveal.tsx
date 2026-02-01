/**
 * ResultsReveal Component
 * Animated reveal for analysis results with value counters and status indicators
 */

import { FC, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Activity } from 'lucide-react';

// ============================================
// Types
// ============================================

interface ResultValue {
    label: string;
    value: number;
    unit: string;
    status?: 'pass' | 'warning' | 'fail';
    trend?: 'up' | 'down' | 'neutral';
}

interface ResultsRevealProps {
    results: ResultValue[];
    title?: string;
    isVisible: boolean;
    delay?: number;
}

// ============================================
// Animated Counter Hook
// ============================================

const useAnimatedCounter = (end: number, duration: number = 1000, start: number = 0) => {
    const [value, setValue] = useState(start);

    useEffect(() => {
        const startTime = Date.now();
        const endValue = end;

        const updateValue = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);

            // Easing function (ease-out cubic)
            const eased = 1 - Math.pow(1 - progress, 3);

            setValue(start + (endValue - start) * eased);

            if (progress < 1) {
                requestAnimationFrame(updateValue);
            }
        };

        requestAnimationFrame(updateValue);
    }, [end, duration, start]);

    return value;
};

// ============================================
// Result Value Card
// ============================================

const ResultCard: FC<{
    result: ResultValue;
    index: number;
    isVisible: boolean;
}> = ({ result, index, isVisible }) => {
    const animatedValue = useAnimatedCounter(
        isVisible ? result.value : 0,
        1500,
        0
    );

    const statusColors = {
        pass: 'border-green-500/30 bg-green-500/5',
        warning: 'border-yellow-500/30 bg-yellow-500/5',
        fail: 'border-red-500/30 bg-red-500/5',
    };

    const statusIcons = {
        pass: <CheckCircle className="w-5 h-5 text-green-400" />,
        warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
        fail: <AlertTriangle className="w-5 h-5 text-red-400" />,
    };

    const trendIcons = {
        up: <TrendingUp className="w-4 h-4 text-green-400" />,
        down: <TrendingDown className="w-4 h-4 text-red-400" />,
        neutral: <Activity className="w-4 h-4 text-slate-400" />,
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={isVisible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.95 }}
            transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: [0.22, 1, 0.36, 1]
            }}
            className={`
                relative overflow-hidden rounded-xl border p-5
                bg-slate-900/50 backdrop-blur-sm
                ${result.status ? statusColors[result.status] : 'border-slate-800'}
            `}
        >
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800/20 to-transparent pointer-events-none" />

            {/* Content */}
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400 font-medium">
                        {result.label}
                    </span>
                    {result.status && statusIcons[result.status]}
                </div>

                <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-white tabular-nums">
                        {animatedValue.toFixed(result.value % 1 === 0 ? 0 : 2)}
                    </span>
                    <span className="text-sm text-slate-500 mb-1">
                        {result.unit}
                    </span>
                    {result.trend && (
                        <span className="ml-auto">
                            {trendIcons[result.trend]}
                        </span>
                    )}
                </div>
            </div>

            {/* Animated Shine Effect */}
            {isVisible && (
                <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ duration: 1, delay: index * 0.1 + 0.5 }}
                    className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none"
                />
            )}
        </motion.div>
    );
};

// ============================================
// Main Results Reveal Component
// ============================================

export const ResultsReveal: FC<ResultsRevealProps> = ({
    results,
    title = 'Analysis Results',
    isVisible,
    delay = 0
}) => {
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => setShowContent(true), delay);
            return () => clearTimeout(timer);
        } else {
            setShowContent(false);
        }
        return undefined;
    }, [isVisible, delay]);

    return (
        <AnimatePresence>
            {showContent && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                >
                    {/* Title */}
                    <motion.h3
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4 }}
                        className="text-lg font-bold text-white flex items-center gap-2"
                    >
                        <Activity className="w-5 h-5 text-blue-400" />
                        {title}
                    </motion.h3>

                    {/* Results Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {results.map((result, index) => (
                            <ResultCard
                                key={result.label}
                                result={result}
                                index={index}
                                isVisible={showContent}
                            />
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// ============================================
// Success Banner
// ============================================

export const SuccessBanner: FC<{
    message: string;
    subMessage?: string;
    isVisible: boolean;
    onDismiss?: () => void;
}> = ({ message, subMessage, isVisible, onDismiss }) => (
    <AnimatePresence>
        {isVisible && (
            <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="relative overflow-hidden rounded-xl border border-green-500/30 bg-green-500/10 p-4"
            >
                <div className="flex items-start gap-3">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    >
                        <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                    </motion.div>
                    <div className="flex-1">
                        <p className="font-semibold text-green-300">{message}</p>
                        {subMessage && (
                            <p className="text-sm text-green-400/70 mt-1">{subMessage}</p>
                        )}
                    </div>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="text-green-400/50 hover:text-green-400 transition-colors"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Animated Background */}
                <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ duration: 1.5, delay: 0.3 }}
                    className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-green-400/10 to-transparent skew-x-12 pointer-events-none"
                />
            </motion.div>
        )}
    </AnimatePresence>
);

export default ResultsReveal;
