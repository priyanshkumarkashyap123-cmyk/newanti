/**
 * FeatureCard.tsx - Reusable Feature Card Component
 * 
 * Displays feature information with icon, description, and action.
 * Used throughout the UI for consistent feature presentation.
 */

import React from 'react';
import { Crown, ChevronRight, Info } from 'lucide-react';

export interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    isPro?: boolean;
    shortcut?: string;
    onClick: () => void;
    variant?: 'default' | 'compact' | 'expanded';
    colorScheme?: 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'red' | 'amber' | 'teal';
    disabled?: boolean;
    badge?: string;
}

// Color scheme mappings
const colorSchemes = {
    blue: {
        bg: 'bg-blue-500/10',
        hover: 'hover:bg-blue-500/20',
        border: 'border-blue-500/30',
        text: 'text-blue-400',
        iconBg: 'bg-blue-500/20'
    },
    green: {
        bg: 'bg-green-500/10',
        hover: 'hover:bg-green-500/20',
        border: 'border-green-500/30',
        text: 'text-green-400',
        iconBg: 'bg-green-500/20'
    },
    purple: {
        bg: 'bg-purple-500/10',
        hover: 'hover:bg-purple-500/20',
        border: 'border-purple-500/30',
        text: 'text-purple-400',
        iconBg: 'bg-purple-500/20'
    },
    orange: {
        bg: 'bg-orange-500/10',
        hover: 'hover:bg-orange-500/20',
        border: 'border-orange-500/30',
        text: 'text-orange-400',
        iconBg: 'bg-orange-500/20'
    },
    cyan: {
        bg: 'bg-cyan-500/10',
        hover: 'hover:bg-cyan-500/20',
        border: 'border-cyan-500/30',
        text: 'text-cyan-400',
        iconBg: 'bg-cyan-500/20'
    },
    red: {
        bg: 'bg-red-500/10',
        hover: 'hover:bg-red-500/20',
        border: 'border-red-500/30',
        text: 'text-red-400',
        iconBg: 'bg-red-500/20'
    },
    amber: {
        bg: 'bg-amber-500/10',
        hover: 'hover:bg-amber-500/20',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        iconBg: 'bg-amber-500/20'
    },
    teal: {
        bg: 'bg-teal-500/10',
        hover: 'hover:bg-teal-500/20',
        border: 'border-teal-500/30',
        text: 'text-teal-400',
        iconBg: 'bg-teal-500/20'
    }
};

export const FeatureCard: React.FC<FeatureCardProps> = ({
    icon,
    title,
    description,
    isPro = false,
    shortcut,
    onClick,
    variant = 'default',
    colorScheme = 'blue',
    disabled = false,
    badge
}) => {
    const colors = colorSchemes[colorScheme];

    if (variant === 'compact') {
        return (
            <button
                onClick={onClick}
                disabled={disabled}
                className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg
                    transition-all duration-200 border
                    ${disabled
                        ? 'opacity-50 cursor-not-allowed bg-zinc-800/30 border-zinc-700/30'
                        : `${colors.bg} ${colors.hover} ${colors.border} ${colors.text}`
                    }
                `}
                title={description}
            >
                <span className={`flex-shrink-0 ${colors.text}`}>{icon}</span>
                <span className="truncate font-medium">{title}</span>
                {isPro && (
                    <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />
                )}
                {shortcut && (
                    <kbd className="ml-auto text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-zinc-400">
                        {shortcut}
                    </kbd>
                )}
            </button>
        );
    }

    if (variant === 'expanded') {
        return (
            <button
                onClick={onClick}
                disabled={disabled}
                className={`
                    w-full flex flex-col gap-2 p-4 text-left rounded-xl
                    transition-all duration-200 border group
                    ${disabled
                        ? 'opacity-50 cursor-not-allowed bg-zinc-800/30 border-zinc-700/30'
                        : `${colors.bg} ${colors.hover} ${colors.border}`
                    }
                `}
            >
                <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg ${colors.iconBg}`}>
                        {icon}
                    </div>
                    {isPro && (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full">
                            <Crown className="w-3 h-3" />
                            PRO
                        </span>
                    )}
                    {badge && !isPro && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                            {badge}
                        </span>
                    )}
                </div>
                <div>
                    <h4 className={`font-semibold ${colors.text}`}>{title}</h4>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{description}</p>
                </div>
                {shortcut && (
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                        Shortcut: <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">{shortcut}</kbd>
                    </div>
                )}
            </button>
        );
    }

    // Default variant
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg
                transition-all duration-200 border group
                ${disabled
                    ? 'opacity-50 cursor-not-allowed bg-zinc-800/30 border-zinc-700/30'
                    : `${colors.bg} ${colors.hover} ${colors.border}`
                }
            `}
        >
            <div className={`flex-shrink-0 p-1.5 rounded-md ${colors.iconBg}`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${colors.text} truncate`}>{title}</span>
                    {isPro && (
                        <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    )}
                </div>
                <span className="text-xs text-zinc-500 truncate block">{description}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
    );
};

// ============================================
// FEATURE GROUP COMPONENT
// ============================================

export interface FeatureGroupProps {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    badge?: number;
}

export const FeatureGroup: React.FC<FeatureGroupProps> = ({
    title,
    icon,
    children,
    defaultOpen = true,
    badge
}) => {
    const [isOpen, setIsOpen] = React.useState(defaultOpen);

    return (
        <div className="border-b border-zinc-800 last:border-b-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            >
                <ChevronRight
                    className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                />
                {icon && <span className="text-zinc-400">{icon}</span>}
                <span>{title}</span>
                {badge !== undefined && badge > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium bg-zinc-700 text-zinc-300 rounded">
                        {badge}
                    </span>
                )}
            </button>
            {isOpen && (
                <div className="px-3 pb-3 space-y-1.5">
                    {children}
                </div>
            )}
        </div>
    );
};

// ============================================
// QUICK TIP COMPONENT
// ============================================

export interface QuickTipProps {
    icon?: React.ReactNode;
    message: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export const QuickTip: React.FC<QuickTipProps> = ({ icon, message, action }) => {
    return (
        <div className="flex items-start gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs">
            <span className="text-blue-400 mt-0.5">{icon || <Info className="w-4 h-4" />}</span>
            <div className="flex-1">
                <p className="text-blue-300">{message}</p>
                {action && (
                    <button
                        onClick={action.onClick}
                        className="mt-1 text-blue-400 hover:text-blue-300 font-medium underline"
                    >
                        {action.label}
                    </button>
                )}
            </div>
        </div>
    );
};

export default FeatureCard;
