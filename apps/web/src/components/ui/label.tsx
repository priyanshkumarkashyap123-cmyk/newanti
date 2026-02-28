/**
 * Label Component - Compact Form Labels
 * 
 * Uses text-xs with zinc-500 for engineering density.
 */

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '../../lib/utils';

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
    required?: boolean;
}

const Label = React.forwardRef<
    React.ElementRef<typeof LabelPrimitive.Root>,
    LabelProps
>(({ className, required, children, ...props }, ref) => (
    <LabelPrimitive.Root
        ref={ref}
        className={cn(
            'text-xs font-medium text-zinc-500 dark:text-zinc-400',
            'leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
            className
        )}
        {...props}
    >
        {children}
        {required && <span className="text-red-500 ml-0.5">*</span>}
    </LabelPrimitive.Root>
));
Label.displayName = 'Label';

// ============================================
// FORM FIELD - Label + Input combo
// ============================================

export interface FormFieldProps {
    label: string;
    htmlFor?: string;
    required?: boolean;
    error?: string;
    hint?: string;
    children: React.ReactNode;
    className?: string;
}

const FormField: React.FC<FormFieldProps> = ({
    label,
    htmlFor,
    required,
    error,
    hint,
    children,
    className
}) => {
    return (
        <div className={cn('space-y-1', className)}>
            <Label htmlFor={htmlFor} required={required}>
                {label}
            </Label>
            {children}
            {error && (
                <p className="text-xs text-red-500">{error}</p>
            )}
            {hint && !error && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>
            )}
        </div>
    );
};

export { Label, FormField };
