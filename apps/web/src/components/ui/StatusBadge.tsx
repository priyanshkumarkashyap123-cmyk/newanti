/**
 * StatusBadge - Professional status indicator badges
 * Used for analysis results, design checks, and workflow states
 */

import { FC, ReactNode } from 'react';

export type BadgeVariant =
    | 'pass'
    | 'fail'
    | 'warning'
    | 'info'
    | 'analyzing'
    | 'draft'
    | 'final'
    | 'ok'
    | 'critical';

export interface StatusBadgeProps {
    variant: BadgeVariant;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg';
    icon?: ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
    pass: 'bg-green-500/20 text-green-400 border-green-500/30',
    ok: 'bg-green-500/20 text-green-400 border-green-500/30',
    fail: 'bg-red-500/20 text-red-500 border-red-500/30',
    critical: 'bg-red-500/20 text-red-500 border-red-500/30',
    warning: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    analyzing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    draft: 'bg-accent/20 text-accent border-accent/30',
    final: 'bg-primary/20 text-primary border-primary/30',
};

const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-0.5 text-xs',
    lg: 'px-2.5 py-1 text-sm',
};

export const StatusBadge: FC<StatusBadgeProps> = ({
    variant,
    children,
    size = 'md',
    icon,
}) => {
    return (
        <span
            className={`
                inline-flex items-center gap-1 rounded font-bold border
                ${variantStyles[variant]}
                ${sizeStyles[size]}
            `}
        >
            {icon}
            {children}
        </span>
    );
};

export default StatusBadge;
