/**
 * Button Component — Premium Multi-variant Button System
 *
 * A world-class button with 10 visual variants, 6 sizes, icon slots,
 * CSS ripple effect, variant-matched focus rings, and loading states.
 * Built on CVA + Radix Slot + Tailwind CSS v4.
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Ripple & animation CSS — injected once via <style> tag            */
/* ------------------------------------------------------------------ */

const RIPPLE_STYLE_ID = 'btn-ripple-style';

const rippleCSS = `
/* ripple burst on click */
.btn-ripple::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(255,255,255,0.35) 10%, transparent 70%);
  opacity: 0;
  transform: scale(0);
  border-radius: inherit;
  pointer-events: none;
}
.btn-ripple:active::after {
  opacity: 1;
  transform: scale(2.5);
  transition: transform 0.45s ease-out, opacity 0.45s ease-out;
}
/* premium shimmer */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
/* glow pulse */
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 8px 2px var(--glow-color, rgba(99,102,241,0.45)); }
  50%      { box-shadow: 0 0 18px 6px var(--glow-color, rgba(99,102,241,0.7)); }
}
/* loading spinner pulse */
@keyframes spinner-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}
.btn-spinner-pulse {
  animation: spinner-pulse 1.4s ease-in-out infinite, spin 0.75s linear infinite;
}
`;

// Inject ripple + animation CSS once at module load (not per-render)
if (typeof document !== 'undefined' && !document.getElementById(RIPPLE_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = RIPPLE_STYLE_ID;
  style.textContent = rippleCSS;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  CVA variant map                                                   */
/* ------------------------------------------------------------------ */

const buttonVariants = cva(
    [
        'inline-flex items-center justify-center gap-1.5',
        'rounded-md text-sm font-medium tracking-[0.01em]',
        'transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]',
        'hover:-translate-y-px active:translate-y-0 active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
        'disabled:pointer-events-none disabled:opacity-50',
        'select-none',
        'relative overflow-hidden',
        'cursor-pointer',
        'btn-ripple',
    ].join(' '),
    {
        variants: {
            variant: {
                /* ---- core ---- */
                default: [
                    'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
                    'shadow-sm shadow-blue-500/25 hover:shadow-md hover:shadow-blue-500/30',
                    'focus-visible:ring-blue-500',
                ].join(' '),
                destructive: [
                    'bg-red-600 text-white hover:bg-red-700',
                    'shadow-sm shadow-red-500/25',
                    'focus-visible:ring-red-400',
                ].join(' '),
                outline: [
                    'border border-slate-300 dark:border-white/[0.1] bg-transparent',
                    'hover:bg-slate-100 dark:hover:bg-white/[0.04]',
                    'hover:border-slate-400 dark:hover:border-white/[0.15]',
                    'text-slate-600 dark:text-slate-300',
                    'focus-visible:ring-slate-400',
                ].join(' '),
                secondary: [
                    'bg-slate-100 dark:bg-slate-800',
                    'text-slate-700 dark:text-slate-100',
                    'hover:bg-slate-200 dark:hover:bg-slate-700',
                    'border border-slate-200 dark:border-white/[0.06]',
                    'focus-visible:ring-slate-400',
                ].join(' '),
                ghost: [
                    'hover:bg-slate-100 dark:hover:bg-white/[0.04]',
                    'text-slate-500 hover:text-slate-700 dark:text-slate-200',
                    'focus-visible:ring-slate-400',
                ].join(' '),
                link: [
                    'text-blue-500 dark:text-blue-400 underline-offset-4',
                    'hover:underline hover:text-blue-600 dark:hover:text-blue-300',
                    'focus-visible:ring-blue-400',
                ].join(' '),
                success: [
                    'bg-emerald-500 text-white hover:bg-emerald-600',
                    'shadow-sm shadow-emerald-500/25',
                    'focus-visible:ring-emerald-400',
                ].join(' '),
                /* ---- premium variants ---- */
                premium: [
                    'text-white font-semibold',
                    'bg-[linear-gradient(135deg,#f59e0b,#d97706)]',
                    'hover:brightness-110',
                    'shadow-md shadow-amber-500/30 hover:shadow-lg hover:shadow-amber-500/40',
                    'focus-visible:ring-amber-500',
                ].join(' '),
                glow: [
                    'bg-slate-900 dark:bg-slate-800 text-white',
                    'border border-indigo-500/50',
                    'hover:border-indigo-400',
                    '[--glow-color:rgba(99,102,241,0.45)]',
                    'hover:[--glow-color:rgba(99,102,241,0.7)]',
                    '[animation:glow-pulse_2.5s_ease-in-out_infinite]',
                    'focus-visible:ring-indigo-500',
                ].join(' '),
                glass: [
                    'bg-white/10 dark:bg-white/[0.08]',
                    'backdrop-blur-lg',
                    'border border-white/20 dark:border-white/[0.12]',
                    'text-slate-800 dark:text-white',
                    'hover:bg-white/20 dark:hover:bg-white/[0.14]',
                    'shadow-sm',
                    'focus-visible:ring-white/50',
                ].join(' '),
            },
            size: {
                xs: 'h-7 px-2.5 text-xs rounded-md',
                sm: 'h-8 px-3 text-xs',
                default: 'h-9 px-4 py-2',
                lg: 'h-11 px-6 text-base rounded-lg',
                xl: 'h-14 px-10 text-lg rounded-2xl',
                icon: 'h-9 w-9 p-0',
                'icon-sm': 'h-7 w-7 p-0 rounded-md',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

/* ------------------------------------------------------------------ */
/*  Icon size map — Tailwind dimension classes per button size         */
/* ------------------------------------------------------------------ */

const ICON_SIZE: Record<string, string> = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    default: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-5 h-5',
    icon: 'w-4 h-4',
};

/* ------------------------------------------------------------------ */
/*  Spinner colour map — keeps spinner legible on each variant bg     */
/* ------------------------------------------------------------------ */

const SPINNER_COLOR: Record<string, string> = {
    default: 'text-white',
    destructive: 'text-white',
    outline: 'text-slate-500 dark:text-slate-300',
    secondary: 'text-slate-600 dark:text-slate-200',
    ghost: 'text-slate-500 dark:text-slate-300',
    link: 'text-blue-500 dark:text-blue-400',
    success: 'text-white',
    premium: 'text-white',
    glow: 'text-white',
    glass: 'text-slate-800 dark:text-white',
};

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    /** Render as Radix Slot (compose with child element) */
    asChild?: boolean;
    /** Show a loading spinner and disable the button */
    loading?: boolean;
    /** Optional text shown beside the spinner while loading */
    loadingText?: string;
    /** Icon element rendered before the label */
    icon?: React.ReactNode;
    /** Icon element rendered after the label (e.g. arrow-right) */
    iconRight?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant,
            size,
            asChild = false,
            loading = false,
            loadingText,
            icon,
            iconRight,
            children,
            disabled,
            ...props
        },
        ref,
    ) => {
        const Comp = asChild ? Slot : 'button';
        const resolvedSize = (size ?? 'default') as string;
        const resolvedVariant = (variant ?? 'default') as string;
        const iconCls = ICON_SIZE[resolvedSize] ?? ICON_SIZE.default;
        const spinnerCls = SPINNER_COLOR[resolvedVariant] ?? SPINNER_COLOR.default;

        const content = loading ? (
            <>
                <Loader2
                    className={cn(iconCls, spinnerCls, 'btn-spinner-pulse')}
                    aria-hidden="true"
                />
                <span className="sr-only">Loading</span>
                {loadingText && <span>{loadingText}</span>}
            </>
        ) : (
            <>
                {icon && (
                    <span className={cn('shrink-0', iconCls)} aria-hidden="true">
                        {icon}
                    </span>
                )}
                {children}
                {iconRight && (
                    <span className={cn('shrink-0', iconCls)} aria-hidden="true">
                        {iconRight}
                    </span>
                )}
            </>
        );

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
    },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
