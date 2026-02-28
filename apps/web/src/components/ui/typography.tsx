/**
 * Design System - Typography Utilities
 * 
 * Engineering-optimized typography with Inter font family.
 * High density for data-heavy interfaces.
 */

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { FC, HTMLAttributes } from 'react';

// ============================================
// TYPOGRAPHY VARIANTS
// ============================================

export const typographyVariants = cva('', {
    variants: {
        variant: {
            h1: 'text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50',
            h2: 'text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50',
            h3: 'text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50',
            h4: 'text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50',
            h5: 'text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50',
            h6: 'text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 uppercase',
            body: 'text-sm text-zinc-700 dark:text-zinc-300',
            bodySmall: 'text-xs text-zinc-500 dark:text-zinc-400',
            caption: 'text-[11px] text-zinc-500 dark:text-zinc-400',
            code: 'text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded',
            label: 'text-xs font-medium text-zinc-500 dark:text-zinc-400',
            value: 'text-sm font-medium text-zinc-900 dark:text-zinc-100 font-mono',
            unit: 'text-[10px] text-zinc-500 dark:text-zinc-400 ml-0.5'
        }
    },
    defaultVariants: {
        variant: 'body'
    }
});

// ============================================
// TYPOGRAPHY COMPONENT
// ============================================

export interface TypographyProps
    extends HTMLAttributes<HTMLElement>,
    VariantProps<typeof typographyVariants> {
    as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'label' | 'code';
}

export const Typography: FC<TypographyProps> = ({
    className,
    variant,
    as: Component = 'p',
    ...props
}) => {
    return (
        <Component
            className={cn(typographyVariants({ variant }), className)}
            {...props}
        />
    );
};

// ============================================
// SEMANTIC HEADING COMPONENTS
// ============================================

export const H1: FC<HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
    <h1 className={cn(typographyVariants({ variant: 'h1' }), className)} {...props} />
);

export const H2: FC<HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
    <h2 className={cn(typographyVariants({ variant: 'h2' }), className)} {...props} />
);

export const H3: FC<HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
    <h3 className={cn(typographyVariants({ variant: 'h3' }), className)} {...props} />
);

export const H4: FC<HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
    <h4 className={cn(typographyVariants({ variant: 'h4' }), className)} {...props} />
);

// ============================================
// VALUE DISPLAY (for engineering data)
// ============================================

interface ValueDisplayProps {
    value: string | number;
    unit?: string;
    precision?: number;
    className?: string;
}

export const ValueDisplay: FC<ValueDisplayProps> = ({
    value,
    unit,
    precision = 3,
    className
}) => {
    const displayValue = typeof value === 'number'
        ? value.toFixed(precision)
        : value;

    return (
        <span className={cn('inline-flex items-baseline', className)}>
            <span className={typographyVariants({ variant: 'value' })}>
                {displayValue}
            </span>
            {unit && (
                <span className={typographyVariants({ variant: 'unit' })}>
                    {unit}
                </span>
            )}
        </span>
    );
};

export default Typography;
