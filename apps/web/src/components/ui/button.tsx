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
        'rounded-lg text-sm font-medium',
        'transition-all duration-200',
        'active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        'disabled:pointer-events-none disabled:opacity-50',
        'select-none', // Prevent text selection on buttons
        'relative overflow-hidden', // For ripple effect
        'cursor-pointer'
    ].join(' '),
    {
        variants: {
            variant: {
                default: 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm shadow-blue-500/25 hover:shadow-md hover:shadow-blue-500/30',
                destructive: 'bg-red-600 text-white hover:bg-red-500 shadow-sm shadow-red-500/25',
                outline: 'border border-white/[0.1] bg-transparent hover:bg-white/[0.04] hover:border-white/[0.15] text-slate-300',
                secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-white/[0.06]',
                ghost: 'hover:bg-white/[0.04] text-slate-400 hover:text-slate-200',
                link: 'text-blue-400 underline-offset-4 hover:underline hover:text-blue-300',
                success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-500/25'
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
