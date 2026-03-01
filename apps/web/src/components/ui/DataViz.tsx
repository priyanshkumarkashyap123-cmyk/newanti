/**
 * Data Visualization Components
 * Charts, progress indicators, and statistics displays
 */

import { FC, ReactNode, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// ============================================
// Progress Ring
// ============================================

interface ProgressRingProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
    showLabel?: boolean;
    label?: string;
    className?: string;
}

export const ProgressRing: FC<ProgressRingProps> = ({
    progress,
    size = 80,
    strokeWidth = 8,
    color = 'blue',
    showLabel = true,
    label,
    className = '',
}) => {
    const [animatedProgress, setAnimatedProgress] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setAnimatedProgress(progress), 100);
        return () => clearTimeout(timer);
    }, [progress]);

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (animatedProgress / 100) * circumference;

    const colors = {
        blue: 'stroke-blue-500',
        green: 'stroke-green-500',
        yellow: 'stroke-yellow-500',
        red: 'stroke-red-500',
        purple: 'stroke-purple-500',
    };

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`}>
            <svg width={size} height={size} className="-rotate-90">
                {/* Background Ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-slate-700"
                />
                {/* Progress Ring */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                    className={colors[color]}
                />
            </svg>
            {showLabel && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                        {Math.round(animatedProgress)}%
                    </span>
                    {label && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// Linear Progress Bar
// ============================================

interface ProgressBarProps {
    progress: number;
    label?: string;
    showValue?: boolean;
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'gradient';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const ProgressBar: FC<ProgressBarProps> = ({
    progress,
    label,
    showValue = true,
    color = 'blue',
    size = 'md',
    className = '',
}) => {
    const heights = { sm: 'h-1', md: 'h-2', lg: 'h-3' };
    const colors = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        yellow: 'bg-yellow-500',
        red: 'bg-red-500',
        gradient: 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500',
    };

    return (
        <div className={`space-y-1.5 ${className}`}>
            {(label || showValue) && (
                <div className="flex items-center justify-between text-sm">
                    {label && <span className="text-slate-500 dark:text-slate-400">{label}</span>}
                    {showValue && (
                        <span className="text-slate-900 dark:text-white font-medium">{Math.round(progress)}%</span>
                    )}
                </div>
            )}
            <div className={`w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ${heights[size]}`}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className={`h-full rounded-full ${colors[color]}`}
                />
            </div>
        </div>
    );
};

// ============================================
// Stat Card
// ============================================

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: ReactNode;
    trend?: { value: number; label?: string };
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
    className?: string;
}

export const StatCard: FC<StatCardProps> = ({
    title,
    value,
    subtitle,
    icon,
    trend,
    color = 'blue',
    className = '',
}) => {
    const bgColors = {
        blue: 'bg-blue-500/10',
        green: 'bg-green-500/10',
        yellow: 'bg-yellow-500/10',
        red: 'bg-red-500/10',
        purple: 'bg-purple-500/10',
    };

    const iconColors = {
        blue: 'text-blue-400',
        green: 'text-green-400',
        yellow: 'text-yellow-400',
        red: 'text-red-400',
        purple: 'text-purple-400',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            className={`
                p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl
                transition-shadow hover:shadow-lg hover:shadow-slate-900/50
                ${className}
            `}
        >
            <div className="flex items-start justify-between mb-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">{title}</span>
                {icon && (
                    <div className={`p-2 rounded-lg ${bgColors[color]}`}>
                        <span className={iconColors[color]}>{icon}</span>
                    </div>
                )}
            </div>

            <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">{value}</span>
                {subtitle && (
                    <span className="text-sm text-slate-500 dark:text-slate-400 mb-1">{subtitle}</span>
                )}
            </div>

            {trend && (
                <div className={`flex items-center gap-1 text-sm ${trend.value > 0 ? 'text-green-400' : trend.value < 0 ? 'text-red-400' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                    {trend.value > 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                    ) : trend.value < 0 ? (
                        <ArrowDownRight className="w-4 h-4" />
                    ) : (
                        <Minus className="w-4 h-4" />
                    )}
                    <span>{Math.abs(trend.value)}%</span>
                    {trend.label && (
                        <span className="text-slate-500 dark:text-slate-400">{trend.label}</span>
                    )}
                </div>
            )}
        </motion.div>
    );
};

// ============================================
// Sparkline Chart
// ============================================

interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    color?: 'blue' | 'green' | 'red';
    showArea?: boolean;
    className?: string;
}

export const Sparkline: FC<SparklineProps> = ({
    data,
    width = 100,
    height = 30,
    color = 'blue',
    showArea = true,
    className = '',
}) => {
    if (data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => ({
        x: (index / (data.length - 1)) * width,
        y: height - ((value - min) / range) * height * 0.8 - height * 0.1,
    }));

    const pathD = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ');

    const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

    const colors = {
        blue: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.1)' },
        green: { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.1)' },
        red: { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.1)' },
    };

    return (
        <svg width={width} height={height} className={className}>
            {showArea && (
                <motion.path
                    d={areaD}
                    fill={colors[color].fill}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                />
            )}
            <motion.path
                d={pathD}
                fill="none"
                stroke={colors[color].stroke}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, ease: 'easeOut' }}
            />
            {/* End dot */}
            <motion.circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r={3}
                fill={colors[color].stroke}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.8 }}
            />
        </svg>
    );
};

// ============================================
// Bar Chart (Simple)
// ============================================

interface BarChartProps {
    data: Array<{ label: string; value: number; color?: string }>;
    height?: number;
    showLabels?: boolean;
    showValues?: boolean;
    className?: string;
}

export const BarChart: FC<BarChartProps> = ({
    data,
    height = 120,
    showLabels = true,
    showValues = true,
    className = '',
}) => {
    const maxValue = Math.max(...data.map(d => d.value));

    return (
        <div className={`${className}`}>
            <div className="flex items-end gap-2" style={{ height }}>
                {data.map((item, index) => {
                    const barHeight = (item.value / maxValue) * 100;

                    return (
                        <div key={item.label} className="flex-1 flex flex-col items-center gap-1">
                            {showValues && (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: index * 0.1 + 0.5 }}
                                    className="text-xs text-slate-500 dark:text-slate-400 font-mono"
                                >
                                    {item.value}
                                </motion.span>
                            )}
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${barHeight}%` }}
                                transition={{ delay: index * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                className="w-full rounded-t-lg"
                                style={{
                                    backgroundColor: item.color || '#3b82f6',
                                    minHeight: 4,
                                }}
                            />
                        </div>
                    );
                })}
            </div>
            {showLabels && (
                <div className="flex gap-2 mt-2">
                    {data.map((item) => (
                        <span key={item.label} className="flex-1 text-xs text-slate-500 dark:text-slate-400 text-center truncate">
                            {item.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================
// Gauge Chart
// ============================================

interface GaugeProps {
    value: number;
    min?: number;
    max?: number;
    label?: string;
    unit?: string;
    thresholds?: Array<{ value: number; color: string }>;
    size?: number;
    className?: string;
}

export const Gauge: FC<GaugeProps> = ({
    value,
    min = 0,
    max = 100,
    label,
    unit,
    thresholds = [
        { value: 30, color: '#22c55e' },
        { value: 70, color: '#eab308' },
        { value: 100, color: '#ef4444' },
    ],
    size = 120,
    className = '',
}) => {
    const percentage = ((value - min) / (max - min)) * 100;
    const angle = (percentage / 100) * 180 - 90;

    // Determine color based on thresholds
    let color = thresholds[0].color;
    for (const threshold of thresholds) {
        if (value <= (threshold.value / 100) * (max - min) + min) {
            color = threshold.color;
            break;
        }
    }

    return (
        <div className={`relative ${className}`} style={{ width: size, height: size / 2 + 20 }}>
            {/* Background Arc */}
            <svg width={size} height={size / 2 + 10} className="overflow-visible">
                <path
                    d={`M ${size * 0.1} ${size / 2} A ${size * 0.4} ${size * 0.4} 0 0 1 ${size * 0.9} ${size / 2}`}
                    fill="none"
                    stroke="#334155"
                    strokeWidth={size * 0.08}
                    strokeLinecap="round"
                />
                <motion.path
                    d={`M ${size * 0.1} ${size / 2} A ${size * 0.4} ${size * 0.4} 0 0 1 ${size * 0.9} ${size / 2}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={size * 0.08}
                    strokeLinecap="round"
                    strokeDasharray={`${size * 1.26 * (percentage / 100)} ${size * 1.26}`}
                    initial={{ strokeDasharray: `0 ${size * 1.26}` }}
                    animate={{ strokeDasharray: `${size * 1.26 * (percentage / 100)} ${size * 1.26}` }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                />
            </svg>

            {/* Value Display */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {value.toFixed(0)}
                    {unit && <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">{unit}</span>}
                </div>
                {label && <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>}
            </div>
        </div>
    );
};

export default {
    ProgressRing,
    ProgressBar,
    StatCard,
    Sparkline,
    BarChart,
    Gauge,
};
