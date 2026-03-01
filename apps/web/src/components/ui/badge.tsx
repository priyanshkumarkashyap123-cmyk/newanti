/**
 * Badge Component - Status Badge
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-blue-400',
    {
        variants: {
            variant: {
                default:
                    'border-transparent bg-blue-600 text-white shadow hover:bg-blue-700',
                secondary:
                    'border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-800/80',
                destructive:
                    'border-transparent bg-red-600/20 text-red-400 hover:bg-red-600/30',
                outline: 'text-slate-950 dark:text-slate-50',
                success:
                    'border-transparent bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30',
                warning:
                    'border-transparent bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/30',
                premium:
                    'border-transparent bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow hover:from-amber-600 hover:to-amber-700',
                info:
                    'border-transparent bg-blue-500/20 text-blue-700 dark:text-blue-400 hover:bg-blue-500/30',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {
    /** Show a 6px colored dot indicator */
    dot?: boolean;
    /** Color for the dot (CSS class or Tailwind color) */
    dotColor?: string;
    /** Show a dismiss/close button */
    onDismiss?: () => void;
    /** Optional icon before text */
    icon?: React.ReactNode;
}

function Badge({ className, variant, dot, dotColor, onDismiss, icon, children, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), 'gap-1.5', className)} {...props}>
            {dot && (
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor || 'bg-current')} />
            )}
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {children}
            {onDismiss && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                    className="ml-0.5 -mr-1 h-3.5 w-3.5 rounded-full inline-flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    aria-label="Dismiss"
                >
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
}

export { Badge, badgeVariants };
