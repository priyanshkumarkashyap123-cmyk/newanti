/**
 * Button Component - Multi-variant Button
 * 
 * Compact button with multiple variants for engineering interfaces.
 * Enhanced with accessibility, loading states, and micro-interactions.
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
    // Base styles with press feedback animation and enhanced accessibility
    [
        'inline-flex items-center justify-center gap-1.5',
        'rounded-md text-sm font-medium',
        'transition-all duration-150',
        'active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        'disabled:pointer-events-none disabled:opacity-50',
        'select-none', // Prevent text selection on buttons
        'relative overflow-hidden' // For ripple effect
    ].join(' '),
    {
        variants: {
            variant: {
                default: 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm shadow-blue-500/20',
                destructive: 'bg-red-600 text-white hover:bg-red-500 shadow-sm shadow-red-500/20',
                outline: 'border border-zinc-200 dark:border-zinc-700 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
                secondary: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700',
                ghost: 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
                link: 'text-blue-600 underline-offset-4 hover:underline',
                success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-500/20'
            },
            size: {
                default: 'h-9 px-4 py-2',
                sm: 'h-8 px-3 text-xs',
                lg: 'h-11 px-6 text-base',
                icon: 'h-9 w-9 p-0'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    loading?: boolean;
    loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, loading = false, loadingText, children, disabled, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        
        // If loading, show spinner and optional loading text
        const content = loading ? (
            <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span className="sr-only">Loading</span>
                {loadingText && <span>{loadingText}</span>}
            </>
        ) : children;
        
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={disabled || loading}
                aria-busy={loading}
                aria-disabled={disabled || loading}
                {...props}
            >
                {content}
            </Comp>
        );
    }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
