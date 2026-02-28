/**
 * Enhanced Form Input Components
 * 
 * A comprehensive set of form input components including:
 * - Input (text, email, password, number)
 * - TextArea
 * - Select/Dropdown
 * - Checkbox
 * - Radio
 * - Switch/Toggle
 * - NumberInput with increment/decrement
 * 
 * All components feature:
 * - Consistent styling
 * - Error states
 * - Helper text
 * - Labels
 * - Accessibility
 */


import React, { forwardRef, useState, useId, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ChevronDown, Minus, Plus, AlertCircle, Check, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface BaseInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

// ============================================================================
// INPUT COMPONENT
// ============================================================================

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, BaseInputProps {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      required,
      leftIcon,
      rightIcon,
      className,
      type = 'text',
      disabled,
      id: externalId,
      ...props
    },
    ref
  ) => {
    const internalId = useId();
    const id = externalId || internalId;
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className={cn(
              'block text-sm font-medium mb-1.5',
              error ? 'text-red-400' : 'text-slate-600 dark:text-slate-300'
            )}
          >
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={id}
            type={inputType}
            disabled={disabled}
            className={cn(
              'w-full rounded-lg border bg-slate-100 dark:bg-slate-800 px-3 py-2.5',
              'text-sm text-zinc-900 dark:text-white placeholder:text-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              'transition-colors duration-200',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-200 dark:disabled:bg-slate-900',
              leftIcon && 'pl-10',
              (rightIcon || isPassword) && 'pr-10',
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-slate-600 focus:border-blue-500 focus:ring-blue-500/20',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          {rightIcon && !isPassword && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              id={`${id}-error`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-1.5 text-xs text-red-400 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" />
              {error}
            </motion.p>
          )}
          {!error && helperText && (
            <motion.p
              id={`${id}-helper`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"
            >
              <Info className="w-3 h-3" />
              {helperText}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
Input.displayName = 'Input';

// ============================================================================
// TEXTAREA COMPONENT
// ============================================================================

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseInputProps {
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    { label, error, helperText, required, resize = 'vertical', className, id: externalId, ...props },
    ref
  ) => {
    const internalId = useId();
    const id = externalId || internalId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className={cn(
              'block text-sm font-medium mb-1.5',
              error ? 'text-red-400' : 'text-slate-600 dark:text-slate-300'
            )}
          >
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={cn(
            'w-full rounded-lg border bg-slate-100 dark:bg-slate-800 px-3 py-2.5',
            'text-sm text-zinc-900 dark:text-white placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'transition-colors duration-200 min-h-[100px]',
            resize === 'none' && 'resize-none',
            resize === 'vertical' && 'resize-y',
            resize === 'horizontal' && 'resize-x',
            resize === 'both' && 'resize',
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              : 'border-slate-600 focus:border-blue-500 focus:ring-blue-500/20',
            className
          )}
          {...props}
        />
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-1.5 text-xs text-red-400 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
TextArea.displayName = 'TextArea';

// ============================================================================
// SELECT COMPONENT
// ============================================================================

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'>, BaseInputProps {
  options: SelectOption[];
  placeholder?: string;
  onChange?: (value: string) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, helperText, required, options, placeholder, className, onChange, id: externalId, ...props },
    ref
  ) => {
    const internalId = useId();
    const id = externalId || internalId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className={cn(
              'block text-sm font-medium mb-1.5',
              error ? 'text-red-400' : 'text-slate-600 dark:text-slate-300'
            )}
          >
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            className={cn(
              'w-full rounded-lg border bg-slate-100 dark:bg-slate-800 px-3 py-2.5 pr-10',
              'text-sm text-zinc-900 dark:text-white appearance-none cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              'transition-colors duration-200',
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-slate-600 focus:border-blue-500 focus:ring-blue-500/20',
              className
            )}
            onChange={(e) => onChange?.(e.target.value)}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400 pointer-events-none" />
        </div>
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-1.5 text-xs text-red-400 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
Select.displayName = 'Select';

// ============================================================================
// CHECKBOX COMPONENT
// ============================================================================

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label: string;
  description?: string;
  error?: string;
  onChange?: (checked: boolean) => void;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, checked, onChange, disabled, className, id: externalId, ...props }, ref) => {
    const internalId = useId();
    const id = externalId || internalId;

    return (
      <div className={cn('flex items-start', className)}>
        <div className="flex h-5 items-center">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange?.(e.target.checked)}
            className="sr-only peer"
            {...props}
          />
          <div
            className={cn(
              'w-5 h-5 rounded border flex items-center justify-center cursor-pointer',
              'transition-all duration-200',
              checked
                ? 'bg-blue-600 border-blue-600'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-600 hover:border-slate-500',
              disabled && 'opacity-50 cursor-not-allowed',
              error && 'border-red-500'
            )}
            onClick={() => !disabled && onChange?.(!checked)}
          >
            <motion.div
              initial={false}
              animate={{ scale: checked ? 1 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <Check className="w-3 h-3 text-zinc-900 dark:text-white" />
            </motion.div>
          </div>
        </div>
        <div className="ml-3">
          <label
            htmlFor={id}
            className={cn(
              'text-sm font-medium cursor-pointer',
              disabled ? 'text-slate-500 dark:text-slate-400 cursor-not-allowed' : 'text-zinc-900 dark:text-white'
            )}
          >
            {label}
          </label>
          {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
          {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
        </div>
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

// ============================================================================
// SWITCH/TOGGLE COMPONENT
// ============================================================================

export interface SwitchProps {
  label?: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className,
}) => {
  const id = useId();

  const sizeClasses = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' },
    md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' },
    lg: { track: 'w-14 h-7', thumb: 'w-6 h-6', translate: 'translate-x-7' },
  };

  const { track, thumb, translate } = sizeClasses[size];

  return (
    <div className={cn('flex items-center', className)}>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 rounded-full border-2 border-transparent',
          'cursor-pointer transition-colors duration-200 ease-in-out',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900',
          checked ? 'bg-blue-600' : 'bg-slate-600',
          disabled && 'opacity-50 cursor-not-allowed',
          track
        )}
      >
        <motion.span
          layout
          className={cn(
            'pointer-events-none inline-block rounded-full bg-white shadow-lg',
            'ring-0 transition-transform duration-200',
            thumb
          )}
          animate={{ x: checked ? parseInt(translate.split('-x-')[1]) * 4 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
      {(label || description) && (
        <div className="ml-3">
          {label && (
            <label
              htmlFor={id}
              className={cn(
                'text-sm font-medium cursor-pointer',
                disabled ? 'text-slate-500 dark:text-slate-400 cursor-not-allowed' : 'text-zinc-900 dark:text-white'
              )}
            >
              {label}
            </label>
          )}
          {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// NUMBER INPUT COMPONENT
// ============================================================================

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'>, BaseInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    { label, error, helperText, required, value, onChange, min, max, step = 1, unit, disabled, className, ...props },
    ref
  ) => {
    const id = useId();

    const increment = () => {
      const newValue = value + step;
      if (max !== undefined && newValue > max) return;
      onChange(newValue);
    };

    const decrement = () => {
      const newValue = value - step;
      if (min !== undefined && newValue < min) return;
      onChange(newValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      if (isNaN(newValue)) return;
      if (min !== undefined && newValue < min) return;
      if (max !== undefined && newValue > max) return;
      onChange(newValue);
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className={cn(
              'block text-sm font-medium mb-1.5',
              error ? 'text-red-400' : 'text-slate-600 dark:text-slate-300'
            )}
          >
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}
        <div className="flex">
          <button
            type="button"
            onClick={decrement}
            disabled={disabled || (min !== undefined && value <= min)}
            className={cn(
              'px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg',
              'text-zinc-900 dark:text-white hover:bg-slate-600 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            ref={ref}
            id={id}
            type="number"
            value={value}
            onChange={handleChange}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            className={cn(
              'flex-1 border-y bg-slate-100 dark:bg-slate-800 px-3 py-2.5 text-center',
              'text-sm text-zinc-900 dark:text-white',
              'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500',
              '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
              error ? 'border-red-500' : 'border-slate-600',
              className
            )}
            {...props}
          />
          {unit && (
            <span className="flex items-center px-3 py-2.5 bg-slate-200 dark:bg-slate-700 border border-l-0 border-slate-600 text-sm text-slate-500 dark:text-slate-400">
              {unit}
            </span>
          )}
          <button
            type="button"
            onClick={increment}
            disabled={disabled || (max !== undefined && value >= max)}
            className={cn(
              'px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-l-0 border-slate-600',
              unit ? '' : 'rounded-r-lg',
              'text-zinc-900 dark:text-white hover:bg-slate-600 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-1.5 text-xs text-red-400 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
NumberInput.displayName = 'NumberInput';

// ============================================================================
// RADIO GROUP COMPONENT
// ============================================================================

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  label?: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  label,
  options,
  value,
  onChange,
  error,
  direction = 'vertical',
  className,
}) => {
  const name = useId();

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">{label}</label>
      )}
      <div className={cn('flex gap-4', direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap')}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex items-start cursor-pointer group',
              option.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => !option.disabled && onChange(option.value)}
              disabled={option.disabled}
              className="sr-only peer"
            />
            <div
              className={cn(
                'w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center',
                'transition-all duration-200',
                value === option.value
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-slate-500 group-hover:border-slate-400'
              )}
            >
              <motion.div
                initial={false}
                animate={{ scale: value === option.value ? 1 : 0 }}
                className="w-2 h-2 rounded-full bg-white"
              />
            </div>
            <div className="ml-3">
              <span className="text-sm font-medium text-zinc-900 dark:text-white">{option.label}</span>
              {option.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{option.description}</p>
              )}
            </div>
          </label>
        ))}
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;
