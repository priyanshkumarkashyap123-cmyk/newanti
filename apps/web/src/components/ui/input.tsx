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
                        className="block text-sm font-medium text-zinc-300 mb-1.5"
                    >
                        {label}
                    </label>
                )}
                <div className="relative flex items-center">
                    {leftIcon && (
                        <div className="absolute left-2 text-zinc-400 pointer-events-none" aria-hidden="true">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        id={inputId}
                        type={type}
                        aria-invalid={error}
                        aria-describedby={errorId}
                        className={cn(
                            // Base styles - compact height
                            'h-9 w-full rounded-md border bg-white dark:bg-zinc-900',
                            'px-3 py-2 text-sm',
                            // Font
                            'font-mono text-zinc-900 dark:text-zinc-100',
                            // Placeholder
                            'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
                            // Focus - enhanced visibility
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                            // Border
                            'border-zinc-200 dark:border-zinc-700',
                            // Disabled
                            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-zinc-100 dark:disabled:bg-zinc-800',
                            // Error state
                            error && 'border-red-500 focus-visible:ring-red-500',
                            // Icon padding
                            leftIcon && 'pl-9',
                            rightIcon && 'pr-9',
                            // Transition
                            'transition-all duration-150',
                            className
                        )}
                        ref={ref}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute right-2 text-zinc-400 pointer-events-none" aria-hidden="true">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {errorMessage && (
                    <p id={errorId} className="mt-1.5 text-sm text-red-400 flex items-center gap-1" role="alert">
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
                        'h-8 w-full rounded-md border bg-white dark:bg-zinc-900',
                        'px-2.5 py-1 text-sm text-right',
                        'font-mono text-zinc-900 dark:text-zinc-100',
                        'border-zinc-200 dark:border-zinc-700',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                        'transition-colors',
                        // Hide spin buttons
                        '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                        unit && 'pr-8',
                        className
                    )}
                    {...props}
                />
                {unit && (
                    <span className="absolute right-2 text-xs text-zinc-400 pointer-events-none">
                        {unit}
                    </span>
                )}
            </div>
        );
    }
);
NumberInput.displayName = 'NumberInput';

export { Input, NumberInput };
