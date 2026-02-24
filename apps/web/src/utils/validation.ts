/**
 * ============================================================================
 * INPUT VALIDATION & SANITIZATION
 * ============================================================================
 * 
 * Industry-standard input validation with:
 * - Zod schema validation
 * - Type-safe validation
 * - Custom validators
 * - Sanitization utilities
 * 
 * @version 1.0.0
 */

import { z } from 'zod';

/**
 * Common validation schemas
 */
export const schemas = {
  // Email validation
  email: z.string().email('Invalid email address').min(1, 'Email is required'),

  // Password validation (min 8 chars, uppercase, lowercase, number, special char)
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),

  // Phone number (international format)
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),

  // URL validation
  url: z.string().url('Invalid URL'),

  // Positive number
  positiveNumber: z.number().positive('Must be a positive number'),

  // Non-negative number
  nonNegativeNumber: z.number().nonnegative('Must be non-negative'),

  // Integer
  integer: z.number().int('Must be an integer'),

  // String with length constraints
  stringWithLength: (min: number, max: number) =>
    z.string().min(min, `Must be at least ${min} characters`).max(max, `Must be at most ${max} characters`),

  // Enum validation
  enum: <T extends [string, ...string[]]>(values: T) =>
    z.enum(values, { errorMap: () => ({ message: `Must be one of: ${values.join(', ')}` }) }),

  // Date validation
  date: z.date().or(z.string().datetime()),

  // File validation
  file: (maxSizeMB: number, allowedTypes: string[]) =>
    z.custom<File>(
      (file) => file instanceof File,
      'Must be a valid file'
    ).refine(
      (file) => file.size <= maxSizeMB * 1024 * 1024,
      `File must be smaller than ${maxSizeMB}MB`
    ).refine(
      (file) => allowedTypes.includes(file.type),
      `File type must be one of: ${allowedTypes.join(', ')}`
    ),
};

/**
 * Engineering-specific validation schemas
 */
export const engineeringSchemas = {
  // Structural dimensions (mm)
  dimension: z
    .number()
    .positive('Dimension must be positive')
    .max(100000, 'Dimension too large (max 100m)'),

  // Material strength (MPa)
  concreteStrength: z
    .number()
    .min(15, 'Concrete strength must be at least M15')
    .max(100, 'Concrete strength cannot exceed M100'),

  // Steel grade
  steelGrade: z.enum(['Fe250', 'Fe415', 'Fe500', 'Fe550', 'Fe600']),

  // Load value (kN)
  load: z.number().finite('Load must be a finite number'),

  // Reinforcement percentage
  reinforcementRatio: z
    .number()
    .min(0, 'Reinforcement ratio must be non-negative')
    .max(6, 'Reinforcement ratio too high (max 6%)'),

  // Safety factor
  safetyFactor: z
    .number()
    .min(1, 'Safety factor must be at least 1.0')
    .max(10, 'Safety factor too high'),
};

/**
 * Sanitization utilities
 */
export const sanitize = {
  /**
   * Remove HTML tags and dangerous characters
   */
  html: (input: string): string => {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  },

  /**
   * Remove SQL injection patterns
   */
  sql: (input: string): string => {
    return input
      .replace(/['";]/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .trim();
  },

  /**
   * Sanitize file name
   */
  fileName: (input: string): string => {
    return input
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255)
      .trim();
  },

  /**
   * Trim and normalize whitespace
   */
  whitespace: (input: string): string => {
    return input.replace(/\s+/g, ' ').trim();
  },

  /**
   * Remove non-numeric characters (keep decimal point)
   */
  numeric: (input: string): string => {
    return input.replace(/[^0-9.-]/g, '');
  },
};

/**
 * Type-safe validation result
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodError };

/**
 * Validate data against a schema
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Async validation
 */
export async function validateAsync<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<ValidationResult<T>> {
  try {
    const parsedData = await schema.parseAsync(data);
    return { success: true, data: parsedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

/**
 * Get user-friendly error messages from Zod errors
 */
export function getValidationErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(err.message);
  });

  return errors;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(error: z.ZodError): string {
  return error.errors.map((err) => {
    const path = err.path.join('.') || 'Input';
    return `${path}: ${err.message}`;
  }).join('\n');
}
