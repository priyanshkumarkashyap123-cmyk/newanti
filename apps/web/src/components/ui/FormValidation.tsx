/**
 * FormValidation Components
 * Animated form field validation with success/error states
 */

import { FC, ReactNode, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, Eye, EyeOff, Info } from 'lucide-react';

// ============================================
// Types
// ============================================

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

interface ValidatedInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: 'text' | 'email' | 'password' | 'number';
    validate?: (value: string) => string | null; // Returns error message or null
    asyncValidate?: (value: string) => Promise<string | null>;
    hint?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
}

// ============================================
// Validated Input Component
// ============================================

export const ValidatedInput: FC<ValidatedInputProps> = ({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
    validate,
    asyncValidate,
    hint,
    required = false,
    disabled = false,
    className = '',
}) => {
    const [state, setState] = useState<ValidationState>('idle');
    const [error, setError] = useState<string | null>(null);
    const [touched, setTouched] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Validate on value change (debounced for async)
    useEffect(() => {
        if (!touched) return undefined;

        // Sync validation
        if (validate) {
            const syncError = validate(value);
            if (syncError) {
                setState('invalid');
                setError(syncError);
                return undefined;
            }
        }

        // Async validation
        if (asyncValidate) {
            setState('validating');
            const timeout = setTimeout(async () => {
                try {
                    const asyncError = await asyncValidate(value);
                    if (asyncError) {
                        setState('invalid');
                        setError(asyncError);
                    } else {
                        setState('valid');
                        setError(null);
                    }
                } catch {
                    setState('invalid');
                    setError('Validation failed');
                }
            }, 500);
            return () => clearTimeout(timeout);
        }

        // No async validation, mark as valid
        if (!validate || !validate(value)) {
            setState(value ? 'valid' : 'idle');
            setError(null);
        }
        return undefined;
    }, [value, touched, validate, asyncValidate]);

    const handleBlur = () => {
        setTouched(true);
    };

    const inputType = type === 'password' && showPassword ? 'text' : type;

    const borderColors = {
        idle: 'border-slate-700 focus:border-blue-500',
        validating: 'border-blue-500',
        valid: 'border-green-500',
        invalid: 'border-red-500',
    };

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Label */}
            <div className="flex items-center justify-between">
                <label htmlFor={`input-${label.toLowerCase().replace(/\s+/g, '-')}`} className="text-sm font-medium text-slate-300">
                    {label}
                    {required && <span className="text-red-400 ml-1" aria-hidden="true">*</span>}
                    {required && <span className="sr-only">(required)</span>}
                </label>
                {hint && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Info className="w-3 h-3" aria-hidden="true" />
                        {hint}
                    </span>
                )}
            </div>

            {/* Input Container */}
            <div className="relative">
                <input
                    id={`input-${label.toLowerCase().replace(/\s+/g, '-')}`}
                    type={inputType}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    aria-invalid={state === 'invalid'}
                    aria-describedby={error && touched ? `error-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined}
                    className={`
                        w-full px-4 py-3 pr-12
                        bg-slate-800 rounded-lg
                        text-white placeholder:text-slate-500
                        border-2 transition-colors duration-200
                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-blue-500
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${borderColors[state]}
                    `}
                />

                {/* Status Icon */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {type === 'password' && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-slate-500 hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            aria-pressed={showPassword}
                        >
                            {showPassword ? (
                                <EyeOff className="w-5 h-5" aria-hidden="true" />
                            ) : (
                                <Eye className="w-5 h-5" aria-hidden="true" />
                            )}
                        </button>
                    )}

                    <AnimatePresence mode="wait">
                        {state === 'validating' && (
                            <motion.div
                                key="validating"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
                                role="status"
                                aria-label="Validating input"
                            />
                        )}
                        {state === 'valid' && (
                            <motion.div
                                key="valid"
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                                transition={{ type: 'spring', stiffness: 300 }}
                                aria-label="Input is valid"
                            >
                                <Check className="w-5 h-5 text-green-500" aria-hidden="true" />
                            </motion.div>
                        )}
                        {state === 'invalid' && (
                            <motion.div
                                key="invalid"
                                initial={{ opacity: 0, scale: 0, rotate: -90 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                exit={{ opacity: 0, scale: 0 }}
                                transition={{ type: 'spring', stiffness: 300 }}
                                aria-label="Input is invalid"
                            >
                                <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
                {error && touched && (
                    <motion.p
                        id={`error-${label.toLowerCase().replace(/\s+/g, '-')}`}
                        role="alert"
                        aria-live="polite"
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        className="text-sm text-red-400 flex items-center gap-1"
                    >
                        <AlertCircle className="w-3 h-3" aria-hidden="true" />
                        {error}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
};

// ============================================
// Password Strength Indicator
// ============================================

interface PasswordStrengthProps {
    password: string;
}

export const PasswordStrength: FC<PasswordStrengthProps> = ({ password }) => {
    const getStrength = (pwd: string) => {
        let score = 0;
        if (pwd.length >= 8) score++;
        if (pwd.length >= 12) score++;
        if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
        if (/\d/.test(pwd)) score++;
        if (/[^a-zA-Z0-9]/.test(pwd)) score++;
        return score;
    };

    const strength = getStrength(password);
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = [
        'bg-red-500',
        'bg-orange-500',
        'bg-yellow-500',
        'bg-lime-500',
        'bg-green-500',
    ];

    if (!password) return null;

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-2"
        >
            {/* Bars */}
            <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                    <motion.div
                        key={i}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={`h-1.5 flex-1 rounded-full origin-left ${i < strength ? colors[strength - 1] : 'bg-slate-700'
                            }`}
                    />
                ))}
            </div>
            {/* Label */}
            <p className={`text-xs font-medium ${strength < 3 ? 'text-orange-400' : 'text-green-400'}`}>
                {labels[strength - 1] || 'Very Weak'}
            </p>
        </motion.div>
    );
};

// ============================================
// Form Submit Button
// ============================================

interface SubmitButtonProps {
    children: ReactNode;
    isLoading?: boolean;
    isDisabled?: boolean;
    isSuccess?: boolean;
    onClick?: () => void;
    type?: 'button' | 'submit';
    className?: string;
}

export const SubmitButton: FC<SubmitButtonProps> = ({
    children,
    isLoading = false,
    isDisabled = false,
    isSuccess = false,
    onClick,
    type = 'submit',
    className = '',
}) => (
    <motion.button
        type={type}
        onClick={onClick}
        disabled={isDisabled || isLoading}
        whileTap={{ scale: 0.98 }}
        className={`
            relative w-full py-3 px-6 rounded-lg font-semibold
            transition-all duration-300
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isSuccess
                ? 'bg-green-600 hover:bg-green-500'
                : 'bg-blue-600 hover:bg-blue-500'
            }
            text-white
            ${className}
        `}
    >
        <AnimatePresence mode="wait">
            {isLoading ? (
                <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2"
                >
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                </motion.span>
            ) : isSuccess ? (
                <motion.span
                    key="success"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2"
                >
                    <Check className="w-5 h-5" />
                    Success!
                </motion.span>
            ) : (
                <motion.span
                    key="default"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {children}
                </motion.span>
            )}
        </AnimatePresence>
    </motion.button>
);

// ============================================
// Form Error Summary
// ============================================

interface FormErrorSummaryProps {
    errors: string[];
    isVisible: boolean;
}

export const FormErrorSummary: FC<FormErrorSummaryProps> = ({ errors, isVisible }) => (
    <AnimatePresence>
        {isVisible && errors.length > 0 && (
            <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
            >
                <h4 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Please fix the following errors:
                </h4>
                <ul className="space-y-1">
                    {errors.map((error, index) => (
                        <motion.li
                            key={error}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="text-sm text-red-300/80 flex items-center gap-2"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            {error}
                        </motion.li>
                    ))}
                </ul>
            </motion.div>
        )}
    </AnimatePresence>
);

export default ValidatedInput;
