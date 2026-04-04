/**
 * ============================================================================
 * ENHANCED FORM VALIDATION SYSTEM
 * ============================================================================
 * 
 * Industry-standard form validation with:
 * - Zod schema integration
 * - Real-time validation
 * - Field-level and form-level errors
 * - ARIA accessibility support
 * - Touch state tracking
 * - Dirty state tracking
 * - Submit handling
 * 
 * @version 1.0.0
 */

import {
  useState,
  useCallback,
  useRef,
  useMemo,
  createContext,
  useContext,
  ReactNode,
  FormEvent,
  ChangeEvent,
  FocusEvent,
} from 'react';
import { z, ZodSchema, ZodError, ZodIssue } from 'zod';
import { announce } from '@/utils/accessibility';

// ============================================================================
// TYPES
// ============================================================================

export type FieldValue = string | number | boolean | Date | null | undefined;

export interface FieldState<T = FieldValue> {
  value: T;
  error: string | null;
  touched: boolean;
  dirty: boolean;
  validating: boolean;
}

export interface FormState<T extends Record<string, FieldValue>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  dirty: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isSubmitting: boolean;
  isValidating: boolean;
  submitCount: number;
  isDirty: boolean;
  isTouched: boolean;
}

export interface FieldHandlers {
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onBlur: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onFocus: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}

export interface FieldProps<T = FieldValue> extends FieldState<T>, FieldHandlers {
  name: string;
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

export interface UseFormOptions<T extends Record<string, FieldValue>> {
  initialValues: T;
  validationSchema?: ZodSchema<T>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  validateOnMount?: boolean;
  onSubmit?: (values: T) => void | Promise<void>;
  onError?: (errors: Partial<Record<keyof T, string>>) => void;
}

export interface UseFormReturn<T extends Record<string, FieldValue>> {
  // State
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  
  // Field helpers
  getFieldProps: (name: keyof T) => FieldProps;
  getFieldState: (name: keyof T) => FieldState;
  getFieldError: (name: keyof T) => string | null;
  
  // Actions
  setFieldValue: (name: keyof T, value: FieldValue) => void;
  setFieldError: (name: keyof T, error: string | null) => void;
  setFieldTouched: (name: keyof T, touched?: boolean) => void;
  setValues: (values: Partial<T>) => void;
  setErrors: (errors: Partial<Record<keyof T, string>>) => void;
  
  // Validation
  validateField: (name: keyof T) => Promise<string | null>;
  validateForm: () => Promise<boolean>;
  
  // Submit
  handleSubmit: (e?: FormEvent) => Promise<void>;
  resetForm: (nextValues?: T) => void;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useForm<T extends Record<string, FieldValue>>(
  options: UseFormOptions<T>
): UseFormReturn<T> {
  const {
    initialValues,
    validationSchema,
    validateOnChange = true,
    validateOnBlur = true,
    validateOnMount = false,
    onSubmit,
    onError,
  } = options;

  // State
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrorsState] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [dirty, setDirty] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const submitCountRef = useRef(0);

  // Derived state
  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);
  const isDirty = useMemo(() => Object.values(dirty).some(Boolean), [dirty]);

  // Validate single field
  const validateField = useCallback(
    async (name: keyof T): Promise<string | null> => {
      if (!validationSchema) return null;

      try {
        // Use safeParse to avoid throwing for expected validation errors
        const result = await validationSchema.safeParseAsync(values);
        if (result.success) {
          return null;
        }
        const fieldError = result.error.errors.find(
          (e) => e.path[0] === name
        );
        return fieldError?.message || null;
      } catch (error) {
        // Catch truly unexpected errors (not validation errors)
        return null;
      }
    },
    [validationSchema, values]
  );

  // Validate entire form
  const validateForm = useCallback(async (): Promise<boolean> => {
    if (!validationSchema) return true;

    setIsValidating(true);

    try {
      await validationSchema.parseAsync(values);
      setErrorsState({});
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: Partial<Record<keyof T, string>> = {};
        error.errors.forEach((issue: ZodIssue) => {
          const fieldName = issue.path[0] as keyof T;
          if (!fieldErrors[fieldName]) {
            fieldErrors[fieldName] = issue.message;
          }
        });
        setErrorsState(fieldErrors);
        
        // Announce first error to screen readers
        const firstError = Object.values(fieldErrors)[0];
        if (firstError) {
          announce(`Form validation error: ${firstError}`, 'assertive');
        }
        
        onError?.(fieldErrors);
        return false;
      }
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [validationSchema, values, onError]);

  // Validate on mount
  useMemo(() => {
    if (validateOnMount) {
      validateForm();
    }
     
  }, [validateOnMount]);

  // Set field value
  const setFieldValue = useCallback(
    (name: keyof T, value: FieldValue) => {
      setValuesState((prev) => ({ ...prev, [name]: value }));
      setDirty((prev) => ({ ...prev, [name]: value !== initialValues[name] }));

      if (validateOnChange) {
        validateField(name).then((error) => {
          setErrorsState((prev) => {
            const next = { ...prev };
            if (error) {
              next[name] = error;
            } else {
              delete next[name];
            }
            return next;
          });
        });
      }
    },
    [initialValues, validateOnChange, validateField]
  );

  // Set field error
  const setFieldError = useCallback((name: keyof T, error: string | null) => {
    setErrorsState((prev) => {
      const next = { ...prev };
      if (error) {
        next[name] = error;
      } else {
        delete next[name];
      }
      return next;
    });
  }, []);

  // Set field touched
  const setFieldTouched = useCallback(
    (name: keyof T, isTouched = true) => {
      setTouched((prev) => ({ ...prev, [name]: isTouched }));

      if (validateOnBlur && isTouched) {
        validateField(name).then((error) => {
          setErrorsState((prev) => {
            const next = { ...prev };
            if (error) {
              next[name] = error;
            } else {
              delete next[name];
            }
            return next;
          });
        });
      }
    },
    [validateOnBlur, validateField]
  );

  // Bulk setters
  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...newValues }));
  }, []);

  const setErrors = useCallback((newErrors: Partial<Record<keyof T, string>>) => {
    setErrorsState(newErrors);
  }, []);

  // Get field props for input binding
  const getFieldProps = useCallback(
    (name: keyof T): FieldProps => {
      const error = errors[name] || null;
      const fieldTouched = touched[name] || false;
      const fieldDirty = dirty[name] || false;
      const errorId = error ? `${String(name)}-error` : undefined;

      return {
        name: String(name),
        id: String(name),
        value: values[name] as FieldValue,
        error,
        touched: fieldTouched,
        dirty: fieldDirty,
        validating: isValidating,
        'aria-invalid': Boolean(error && fieldTouched),
        'aria-describedby': errorId,
        onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
          const target = e.target;
          const value = target.type === 'checkbox' 
            ? (target as HTMLInputElement).checked 
            : target.value;
          setFieldValue(name, value as FieldValue);
        },
        onBlur: () => {
          setFieldTouched(name, true);
        },
        onFocus: () => {
          // Track focus for analytics/UX
        },
      };
    },
    [values, errors, touched, dirty, isValidating, setFieldValue, setFieldTouched]
  );

  // Get field state
  const getFieldState = useCallback(
    (name: keyof T): FieldState => ({
      value: values[name],
      error: errors[name] || null,
      touched: touched[name] || false,
      dirty: dirty[name] || false,
      validating: isValidating,
    }),
    [values, errors, touched, dirty, isValidating]
  );

  // Get field error
  const getFieldError = useCallback(
    (name: keyof T): string | null => {
      return touched[name] ? (errors[name] || null) : null;
    },
    [errors, touched]
  );

  // Handle submit
  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      submitCountRef.current += 1;

      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {} as Partial<Record<keyof T, boolean>>
      );
      setTouched(allTouched);

      setIsSubmitting(true);

      try {
        const isFormValid = await validateForm();

        if (isFormValid && onSubmit) {
          await onSubmit(values);
          announce('Form submitted successfully', 'polite');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Submission failed';
        announce(`Form submission error: ${errorMessage}`, 'assertive');
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validateForm, onSubmit]
  );

  // Reset form
  const resetForm = useCallback(
    (nextValues?: T) => {
      setValuesState(nextValues || initialValues);
      setErrorsState({});
      setTouched({});
      setDirty({});
      submitCountRef.current = 0;
    },
    [initialValues]
  );

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    isDirty,
    getFieldProps,
    getFieldState,
    getFieldError,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    setValues,
    setErrors,
    validateField,
    validateForm,
    handleSubmit,
    resetForm,
  };
}

// ============================================================================
// FORM CONTEXT
// ============================================================================

interface FormContextValue<T extends Record<string, FieldValue>> extends UseFormReturn<T> {}

const FormContext = createContext<FormContextValue<Record<string, FieldValue>> | null>(null);

export interface FormProviderProps<T extends Record<string, FieldValue>> {
  form: UseFormReturn<T>;
  children: ReactNode;
}

export function FormProvider<T extends Record<string, FieldValue>>({
  form,
  children,
}: FormProviderProps<T>) {
  return (
    <FormContext.Provider value={form as unknown as FormContextValue<Record<string, FieldValue>>}>
      {children}
    </FormContext.Provider>
  );
}

export function useFormContext<T extends Record<string, FieldValue>>(): UseFormReturn<T> {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within FormProvider');
  }
  return context as unknown as UseFormReturn<T>;
}

// ============================================================================
// FIELD COMPONENT HELPERS
// ============================================================================

export interface FormFieldProps {
  name: string;
  label?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: FieldProps) => ReactNode;
}

export function FormField({
  name,
  label,
  hint,
  required = false,
  className = '',
  children,
}: FormFieldProps) {
  const form = useFormContext();
  const fieldProps = form.getFieldProps(name);
  const error = form.getFieldError(name);

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium tracking-wide text-slate-600 dark:text-slate-300"
        >
          {label}
          {required && <span className="text-red-400 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      
      {children(fieldProps)}
      
      {hint && !error && (
        <p className="text-sm text-[#869ab8]" id={`${name}-hint`}>
          {hint}
        </p>
      )}
      
      {error && (
        <p
          className="text-sm text-red-400"
          id={`${name}-error`}
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export const validators = {
  required: (message = 'This field is required') =>
    z.string().min(1, message),

  email: (message = 'Please enter a valid email') =>
    z.string().email(message),

  minLength: (min: number, message?: string) =>
    z.string().min(min, message || `Must be at least ${min} characters`),

  maxLength: (max: number, message?: string) =>
    z.string().max(max, message || `Must be no more than ${max} characters`),

  pattern: (regex: RegExp, message = 'Invalid format') =>
    z.string().regex(regex, message),

  number: (message = 'Must be a number') =>
    z.string().refine((val: string) => !isNaN(Number(val)), message),

  integer: (message = 'Must be a whole number') =>
    z.string().refine((val: string) => Number.isInteger(Number(val)), message),

  positive: (message = 'Must be a positive number') =>
    z.string().refine((val: string) => Number(val) > 0, message),

  url: (message = 'Please enter a valid URL') =>
    z.string().url(message),

  password: (options?: { minLength?: number; requireNumbers?: boolean; requireSpecial?: boolean }) => {
    const { minLength = 8, requireNumbers = true, requireSpecial = true } = options || {};
    
    let schema = z.string().min(minLength, `Password must be at least ${minLength} characters`);
    
    if (requireNumbers) {
      schema = schema.regex(/\d/, 'Password must contain at least one number');
    }
    if (requireSpecial) {
      schema = schema.regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character');
    }
    
    return schema;
  },

  phone: (message = 'Please enter a valid phone number') =>
    z.string().regex(/^\+?[\d\s-()]{10,}$/, message),

  date: (message = 'Please enter a valid date') =>
    z.string().refine((val: string) => !isNaN(Date.parse(val)), message),

  futureDate: (message = 'Date must be in the future') =>
    z.string().refine((val: string) => new Date(val) > new Date(), message),

  pastDate: (message = 'Date must be in the past') =>
    z.string().refine((val: string) => new Date(val) < new Date(), message),
};

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const commonSchemas = {
  loginForm: z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional(),
  }),

  signupForm: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain uppercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),

  contactForm: z.object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Invalid email'),
    subject: z.string().min(5, 'Subject must be at least 5 characters'),
    message: z.string().min(20, 'Message must be at least 20 characters'),
  }),

  profileForm: z.object({
    displayName: z.string().min(2, 'Name must be at least 2 characters'),
    bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
    website: z.string().url('Invalid URL').or(z.literal('')).optional(),
    company: z.string().optional(),
    location: z.string().optional(),
  }),
};

export default {
  useForm,
  FormProvider,
  useFormContext,
  FormField,
  validators,
  commonSchemas,
};
