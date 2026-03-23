/**
 * ============================================================================
 * INDUSTRY-STANDARD FORM COMPONENTS
 * ============================================================================
 * 
 * Reusable form components with:
 * - Zod schema validation
 * - Accessible form controls
 * - Error state handling
 * - Loading states
 * - Consistent styling
 * 
 * @version 1.0.0
 */

import React, { forwardRef, useId, useState } from 'react';
import { z } from 'zod';
import { AlertCircle, Check, Eye, EyeOff, Loader2, Info } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  maxLength?: number;
  showCount?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: string;
}

export interface RadioGroupProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; description?: string; disabled?: boolean }[];
  error?: string;
  orientation?: 'horizontal' | 'vertical';
}

// ============================================================================
// FORM FIELD WRAPPER
// ============================================================================

export function FormField({ label, error, hint, required, className = '', children }: FormFieldProps) {
  const id = useId();
  
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label 
        htmlFor={id}
        className="block text-sm font-medium tracking-wide text-slate-700 dark:text-slate-200"
      >
        {label}
        {required && <span className="text-red-400 ml-1" aria-hidden="true">*</span>}
      </label>
      
      {React.cloneElement(children as React.ReactElement, { id, 'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined })}
      
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
      
      {hint && !error && (
        <p id={`${id}-hint`} className="flex items-center gap-1.5 text-sm text-[#869ab8]">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          {hint}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// INPUT COMPONENT
// ============================================================================

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className = '', type = 'text', ...props }, ref) => {
    const id = useId();
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    
    return (
      <div className="space-y-1.5">
        <label 
          htmlFor={id}
          className="block text-sm font-medium tracking-wide text-slate-700 dark:text-slate-200"
        >
          {label}
          {props.required && <span className="text-red-400 ml-1" aria-hidden="true">*</span>}
        </label>
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#869ab8] pointer-events-none">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            id={id}
            type={isPassword && showPassword ? 'text' : type}
            className={`
              w-full px-3 py-2 
              bg-[#131b2e] border rounded-lg
              text-[#dae2fd] placeholder-slate-400 dark:placeholder-slate-500
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon || isPassword ? 'pr-10' : ''}
              ${error ? 'border-red-500' : 'border-[#1a2333] hover:border-slate-300 dark:hover:border-slate-600'}
              ${className}
            `}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            {...props}
          />
          
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a9bcde] hover:text-[#dae2fd]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          
          {rightIcon && !isPassword && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#869ab8] pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>
        
        {error && (
          <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </p>
        )}
        
        {hint && !error && (
          <p id={`${id}-hint`} className="text-sm text-[#869ab8]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ============================================================================
// TEXTAREA COMPONENT
// ============================================================================

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, maxLength, showCount = false, className = '', ...props }, ref) => {
    const id = useId();
    const [charCount, setCharCount] = useState(String(props.value || props.defaultValue || '').length);
    
    return (
      <div className="space-y-1.5">
        <label 
          htmlFor={id}
          className="block text-sm font-medium tracking-wide text-slate-700 dark:text-slate-200"
        >
          {label}
          {props.required && <span className="text-red-400 ml-1" aria-hidden="true">*</span>}
        </label>
        
        <textarea
          ref={ref}
          id={id}
          className={`
            w-full px-3 py-2 
            bg-[#131b2e] border rounded-lg
            text-[#dae2fd] placeholder-slate-400 dark:placeholder-slate-500
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            resize-y min-h-[100px]
            ${error ? 'border-red-500' : 'border-[#1a2333] hover:border-slate-300 dark:hover:border-slate-600'}
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          maxLength={maxLength}
          onChange={(e) => {
            setCharCount(e.target.value.length);
            props.onChange?.(e);
          }}
          {...props}
        />
        
        <div className="flex justify-between">
          <div>
            {error && (
              <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </p>
            )}
            
            {hint && !error && (
              <p id={`${id}-hint`} className="text-sm text-[#869ab8]">
                {hint}
              </p>
            )}
          </div>
          
          {showCount && maxLength && (
            <span className={`text-sm ${charCount >= maxLength ? 'text-red-400' : 'text-[#869ab8]'}`}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

// ============================================================================
// SELECT COMPONENT
// ============================================================================

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className = '', ...props }, ref) => {
    const id = useId();
    
    return (
      <div className="space-y-1.5">
        <label 
          htmlFor={id}
          className="block text-sm font-medium tracking-wide text-slate-700 dark:text-slate-200"
        >
          {label}
          {props.required && <span className="text-red-400 ml-1" aria-hidden="true">*</span>}
        </label>
        
        <select
          ref={ref}
          id={id}
          className={`
            w-full px-3 py-2 
            bg-[#131b2e] border rounded-lg
            text-[#dae2fd]
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : 'border-[#1a2333] hover:border-slate-300 dark:hover:border-slate-600'}
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
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
        
        {error && (
          <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </p>
        )}
        
        {hint && !error && (
          <p id={`${id}-hint`} className="text-sm text-[#869ab8]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

// ============================================================================
// CHECKBOX COMPONENT
// ============================================================================

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, className = '', ...props }, ref) => {
    const id = useId();
    
    return (
      <div className={`flex items-start gap-3 ${className}`}>
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className={`
            mt-1 w-4 h-4 
            bg-[#131b2e] border-slate-600 rounded
            text-blue-500 
            focus:ring-2 focus:ring-blue-500 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          aria-describedby={description ? `${id}-description` : undefined}
          {...props}
        />
        
        <div className="flex-1">
          <label htmlFor={id} className="text-sm font-medium tracking-wide text-slate-700 dark:text-slate-200 cursor-pointer">
            {label}
          </label>
          {description && (
            <p id={`${id}-description`} className="text-sm text-[#869ab8] mt-0.5">
              {description}
            </p>
          )}
          {error && (
            <p className="flex items-center gap-1.5 text-sm text-red-400 mt-1" role="alert">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

// ============================================================================
// RADIO GROUP COMPONENT
// ============================================================================

export function RadioGroup({ 
  label, 
  name, 
  value, 
  onChange, 
  options, 
  error, 
  orientation = 'vertical' 
}: RadioGroupProps) {
  const groupId = useId();
  
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium tracking-wide text-slate-700 dark:text-slate-200">{label}</legend>
      
      <div className={`${orientation === 'horizontal' ? 'flex flex-wrap gap-4' : 'space-y-2'}`}>
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`;
          
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={`
                flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                ${value === option.value 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-[#1a2333] bg-slate-100/50 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600'
                }
                ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input
                id={optionId}
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={(e) => onChange(e.target.value)}
                disabled={option.disabled}
                className="mt-1 w-4 h-4 text-blue-500 bg-[#131b2e] border-slate-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium tracking-wide text-slate-700 dark:text-slate-200">{option.label}</span>
                {option.description && (
                  <p className="text-sm text-[#869ab8] mt-0.5">{option.description}</p>
                )}
              </div>
            </label>
          );
        })}
      </div>
      
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </fieldset>
  );
}

// ============================================================================
// SUBMIT BUTTON
// ============================================================================

export interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  success?: boolean;
  loadingText?: string;
  successText?: string;
}

export function SubmitButton({
  children,
  loading = false,
  success = false,
  loadingText = 'Submitting...',
  successText = 'Success!',
  disabled,
  className = '',
  ...props
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={`
        relative w-full px-4 py-2.5
        bg-gradient-to-r from-[#4d8eff] to-[#3b72cc] hover:from-[#3b72cc] hover:to-[#2a5599] text-white shadow-[0_0_15px_rgba(77,142,255,0.3)] hover:shadow-[0_0_20px_rgba(77,142,255,0.5)] font-medium tracking-wide rounded-lg
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900
        disabled:opacity-50 disabled:cursor-not-allowed
        ${success ? 'bg-green-600 hover:bg-green-600' : ''}
        ${className}
      `}
      {...props}
    >
      <span className={`flex items-center justify-center gap-2 ${loading ? 'opacity-0' : ''}`}>
        {success && <Check className="w-4 h-4" />}
        {success ? successText : children}
      </span>
      
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingText}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// FORM VALIDATION HOOK
// ============================================================================

export interface UseFormValidationOptions<T> {
  schema: z.ZodSchema<T>;
  onSubmit: (data: T) => void | Promise<void>;
}

export function useFormValidation<T extends Record<string, unknown>>(
  options: UseFormValidationOptions<T>
) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = (data: Record<string, unknown>): data is T => {
    const result = options.schema.safeParse(data);
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }
    
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    if (!validate(data)) return;
    
    setIsSubmitting(true);
    setIsSuccess(false);
    
    try {
      await options.onSubmit(data as T);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
    } catch (error) {
      if (error instanceof Error) {
        setErrors({ _form: error.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    errors,
    isSubmitting,
    isSuccess,
    handleSubmit,
    setErrors,
    clearErrors: () => setErrors({}),
  };
}

export default {
  FormField,
  Input,
  TextArea,
  Select,
  Checkbox,
  RadioGroup,
  SubmitButton,
  useFormValidation,
};
