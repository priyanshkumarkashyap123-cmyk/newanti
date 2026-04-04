/**
 * Input Component - Compact Engineering Input
 * 
 * Height: h-8 (32px) for high density layouts.
 * Based on Radix/Shadcn patterns with enhanced accessibility.
 */

import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
    errorMessage?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    label?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, error, errorMessage, leftIcon, rightIcon, label, id, ...props }, ref) => {
        const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
        const errorId = errorMessage ? `${inputId}-error` : undefined;
        
        return (
            <div className="w-full">
                {label && (
                    <label 
                        htmlFor={inputId}
                        className="block text-xs font-medium tracking-wide text-[#869ab8] mb-1"
                    >
                        {label}
                    </label>
                )}
                <div className="relative flex items-center">
                    {leftIcon && (
                        <div className="absolute left-2 text-[#869ab8] pointer-events-none" aria-hidden="true">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        id={inputId}
                        type={type}
                        aria-invalid={error}
                        aria-describedby={errorId}
                        className={cn(
                            // Base styles - 8px radius, semi-transparent bg per Figma §2.2
                            'h-10 w-full rounded-lg border bg-white/90 dark:bg-[rgba(15,23,42,0.8)]',
                            'px-4 py-3 text-sm',
                            // Font
                            'font-mono text-slate-900 dark:text-slate-100',
                            // Placeholder
                            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
                            // Focus — 3px glow ring per Figma, bg becomes more opaque
                            'focus-visible:outline-none focus-visible:border-blue-500 focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] focus-visible:bg-white dark:focus-visible:bg-[rgba(15,23,42,0.95)]',
                            // Border — white alpha in dark mode per Figma
                            'border-slate-200 dark:border-white/[0.08]',
                            // Disabled
                            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800',
                            // Error state with shake animation
                            error && 'border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.12)] animate-[inputShake_300ms_ease-out]',
                            // Icon padding
                            leftIcon && 'pl-9',
                            rightIcon && 'pr-9',
                            // Transition
                            'transition-all duration-200',
                            className
                        )}
                        ref={ref}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute right-2 text-[#869ab8] pointer-events-none" aria-hidden="true">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {errorMessage && (
                    <p id={errorId} className="mt-1 text-[11px] text-red-400 flex items-center gap-1" role="alert">
                        {errorMessage}
                    </p>
                )}
            </div>
        );
    }
);
Input.displayName = 'Input';

// ============================================
// NUMBER INPUT - For Engineering Values
// ============================================

export interface NumberInputProps extends Omit<InputProps, 'type' | 'onChange'> {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
    ({ value, onChange, min, max, step = 1, unit, className, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = parseFloat(e.target.value);
            if (!isNaN(newValue)) {
                if (min !== undefined && newValue < min) return;
                if (max !== undefined && newValue > max) return;
                onChange(newValue);
            }
        };

        return (
            <div className="relative flex items-center">
                <input
                    ref={ref}
                    type="number"
                    value={value}
                    onChange={handleChange}
                    min={min}
                    max={max}
                    step={step}
                    className={cn(
                        // Match Input component dimensions & style
                        'h-9 w-full rounded-lg border bg-white/90 dark:bg-[rgba(15,23,42,0.8)]',
                        'px-3 py-2 text-sm text-right',
                        'font-mono text-slate-900 dark:text-slate-100',
                        // Match Input border treatment
                        'border-slate-200 dark:border-white/[0.08]',
                        // Match Input focus style (3px glow ring)
                        'focus-visible:outline-none focus-visible:border-blue-500 focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] focus-visible:bg-white dark:focus-visible:bg-[rgba(15,23,42,0.95)]',
                        // Disabled
                        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800',
                        'transition-all duration-200',
                        // Hide spin buttons
                        '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                        unit && 'pr-8',
                        className
                    )}
                    {...props}
                />
                {unit && (
                    <span className="absolute right-2 text-xs text-[#869ab8] pointer-events-none">
                        {unit}
                    </span>
                )}
            </div>
        );
    }
);
NumberInput.displayName = 'NumberInput';

export { Input, NumberInput };
