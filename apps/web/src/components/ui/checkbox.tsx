/**
 * Checkbox Component - Enhanced per Figma §2.8 & §21
 *
 * Features:
 *   - Size variants (sm / default / lg)
 *   - Indeterminate state styling
 *   - Checkmark pop-in animation
 *   - Dark-mode border color
 *   - Hover state on unchecked
 */

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const checkboxVariants = cva(
    [
        'peer shrink-0 rounded-sm border ring-offset-white dark:ring-offset-slate-950',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-all duration-200',
        // Unchecked
        'border-slate-300 dark:border-slate-600',
        'hover:border-blue-400 dark:hover:border-blue-400',
        // Checked
        'data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white',
        // Indeterminate
        'data-[state=indeterminate]:bg-blue-600 data-[state=indeterminate]:border-blue-600 data-[state=indeterminate]:text-white',
    ].join(' '),
    {
        variants: {
            size: {
                sm: 'h-4 w-4',
                default: 'h-5 w-5',
                lg: 'h-6 w-6',
            },
        },
        defaultVariants: {
            size: 'default',
        },
    }
);

const iconSizeMap = { sm: 'h-3 w-3', default: 'h-4 w-4', lg: 'h-5 w-5' } as const;

interface CheckboxProps
    extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
        VariantProps<typeof checkboxVariants> {}

const Checkbox = React.forwardRef<
    React.ElementRef<typeof CheckboxPrimitive.Root>,
    CheckboxProps
>(({ className, size, ...props }, ref) => {
    const iconCls = iconSizeMap[size ?? 'default'];

    return (
        <CheckboxPrimitive.Root
            ref={ref}
            className={cn(checkboxVariants({ size }), className)}
            {...props}
        >
            <CheckboxPrimitive.Indicator
                className={cn(
                    'flex items-center justify-center text-current',
                    'data-[state=checked]:animate-checkbox-pop data-[state=indeterminate]:animate-checkbox-pop'
                )}
            >
                {props.checked === 'indeterminate' ? (
                    <Minus className={iconCls} />
                ) : (
                    <Check className={iconCls} />
                )}
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox, checkboxVariants };
