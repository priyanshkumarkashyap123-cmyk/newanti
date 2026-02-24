/**
 * Data Validation Layer
 * Industry-standard validation using Zod with custom extensions
 * 
 * Features:
 * - Type-safe validation schemas
 * - Custom validators for structural engineering
 * - Form integration helpers
 * - Error message formatting
 * - Async validation support
 */

import { z } from 'zod';

// ============================================================================
// Custom Validation Helpers
// ============================================================================

/**
 * Positive number validation
 */
export const positiveNumber = z.number().positive('Must be a positive number');

/**
 * Non-negative number validation
 */
export const nonNegativeNumber = z.number().min(0, 'Cannot be negative');

/**
 * Percentage validation (0-100)
 */
export const percentage = z
  .number()
  .min(0, 'Cannot be less than 0%')
  .max(100, 'Cannot be more than 100%');

/**
 * Email validation with better error messages
 */
export const email = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address');

/**
 * Password validation with strength requirements
 */
export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * UUID validation
 */
export const uuid = z.string().uuid('Invalid ID format');

/**
 * Date string validation (ISO 8601)
 */
export const dateString = z.string().datetime({ message: 'Invalid date format' });

/**
 * URL validation
 */
export const url = z.string().url('Please enter a valid URL');

// ============================================================================
// Structural Engineering Validations
// ============================================================================

/**
 * Coordinate validation (3D point)
 */
export const coordinate = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

/**
 * Material properties validation
 */
export const materialProperties = z.object({
  name: z.string().min(1, 'Material name is required'),
  E: positiveNumber.describe('Young\'s Modulus (MPa)'),
  nu: z.number().min(0).max(0.5, 'Poisson\'s ratio must be between 0 and 0.5'),
  fy: positiveNumber.describe('Yield strength (MPa)'),
  fu: positiveNumber.describe('Ultimate strength (MPa)'),
  density: positiveNumber.describe('Density (kg/m³)'),
  alpha: z.number().optional().describe('Thermal expansion coefficient'),
});

/**
 * Section properties validation
 */
export const sectionProperties = z.object({
  name: z.string().min(1, 'Section name is required'),
  area: positiveNumber.describe('Cross-sectional area (mm²)'),
  Ix: positiveNumber.describe('Moment of inertia about X-axis (mm⁴)'),
  Iy: positiveNumber.describe('Moment of inertia about Y-axis (mm⁴)'),
  J: positiveNumber.describe('Torsional constant (mm⁴)'),
  Sx: positiveNumber.optional().describe('Section modulus X (mm³)'),
  Sy: positiveNumber.optional().describe('Section modulus Y (mm³)'),
  Zx: positiveNumber.optional().describe('Plastic modulus X (mm³)'),
  Zy: positiveNumber.optional().describe('Plastic modulus Y (mm³)'),
});

/**
 * Node validation
 */
export const node = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  z: z.number().default(0),
  restraints: z.object({
    dx: z.boolean().default(false),
    dy: z.boolean().default(false),
    dz: z.boolean().default(false),
    rx: z.boolean().default(false),
    ry: z.boolean().default(false),
    rz: z.boolean().default(false),
  }).optional(),
});

/**
 * Member/Element validation
 */
export const member = z.object({
  id: z.string().min(1),
  startNode: z.string().min(1, 'Start node is required'),
  endNode: z.string().min(1, 'End node is required'),
  section: z.string().min(1, 'Section is required'),
  material: z.string().min(1, 'Material is required'),
  releases: z.object({
    startMoment: z.boolean().default(false),
    endMoment: z.boolean().default(false),
    axial: z.boolean().default(false),
  }).optional(),
}).refine(
  (data) => data.startNode !== data.endNode,
  { message: 'Start and end nodes must be different' }
);

/**
 * Load validation
 */
export const load = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('point'),
    nodeId: z.string().min(1),
    fx: z.number().default(0),
    fy: z.number().default(0),
    fz: z.number().default(0),
    mx: z.number().default(0),
    my: z.number().default(0),
    mz: z.number().default(0),
  }),
  z.object({
    type: z.literal('distributed'),
    memberId: z.string().min(1),
    wx: z.number().default(0),
    wy: z.number().default(0),
    wz: z.number().default(0),
    startPosition: percentage.optional(),
    endPosition: percentage.optional(),
  }),
  z.object({
    type: z.literal('temperature'),
    memberId: z.string().min(1),
    deltaT: z.number().describe('Temperature change (°C)'),
    gradient: z.number().optional().describe('Temperature gradient (°C/mm)'),
  }),
]);

/**
 * Load case validation
 */
export const loadCase = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Load case name is required'),
  type: z.enum(['dead', 'live', 'wind', 'seismic', 'snow', 'temperature', 'custom']),
  loads: z.array(load),
  factor: positiveNumber.default(1.0),
});

/**
 * Load combination validation
 */
export const loadCombination = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Combination name is required'),
  type: z.enum(['service', 'ultimate', 'accidental']),
  factors: z.record(z.string(), z.number()),
});

/**
 * Project validation
 */
export const project = z.object({
  id: uuid.optional(),
  name: z.string().min(1, 'Project name is required').max(100),
  description: z.string().max(500).optional(),
  code: z.enum(['IS456', 'IS800', 'IS1893', 'ACI318', 'AISC360', 'EC2', 'EC3']).optional(),
  units: z.enum(['SI', 'Imperial']).default('SI'),
  createdAt: dateString.optional(),
  updatedAt: dateString.optional(),
});

/**
 * Analysis settings validation
 */
export const analysisSettings = z.object({
  type: z.enum(['linear', 'nonlinear', 'modal', 'buckling', 'dynamic']),
  solver: z.enum(['direct', 'iterative', 'frontal']).default('direct'),
  tolerance: positiveNumber.default(1e-6),
  maxIterations: z.number().int().positive().default(100),
  includeShearDeformation: z.boolean().default(true),
  includeGeometricNonlinearity: z.boolean().default(false),
  dampingRatio: percentage.optional(),
  numberOfModes: z.number().int().positive().max(100).optional(),
});

// ============================================================================
// Form Validation Helpers
// ============================================================================

/**
 * Extract error messages from Zod validation result
 */
export function getValidationErrors(
  result: z.SafeParseReturnType<unknown, unknown>
): Record<string, string> {
  if (result.success) return {};
  
  const errors: Record<string, string> = {};
  
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  
  return errors;
}

/**
 * Get first error message for a field
 */
export function getFieldError(
  result: z.SafeParseReturnType<unknown, unknown>,
  field: string
): string | undefined {
  if (result.success) return undefined;
  
  const issue = result.error.issues.find(
    (i) => i.path.join('.') === field
  );
  
  return issue?.message;
}

/**
 * Validate a single field
 */
export function validateField<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown
): { valid: boolean; error?: string } {
  const result = schema.safeParse(value);
  
  if (result.success) {
    return { valid: true };
  }
  
  return {
    valid: false,
    error: result.error.issues[0]?.message,
  };
}

// ============================================================================
// Async Validation
// ============================================================================

/**
 * Create an async validator that checks for uniqueness
 */
export function createUniqueValidator<T>(
  checkFn: (value: T) => Promise<boolean>,
  message = 'This value is already taken'
): z.ZodEffects<z.ZodType<T>, T, T> {
  return z.any().refine(
    async (value: T) => {
      const isUnique = await checkFn(value);
      return isUnique;
    },
    { message }
  ) as z.ZodEffects<z.ZodType<T>, T, T>;
}

/**
 * Debounced async validation
 */
export function createDebouncedValidator<T>(
  validator: (value: T) => Promise<{ valid: boolean; error?: string }>,
  delay = 300
): (value: T) => Promise<{ valid: boolean; error?: string }> {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (value: T) => {
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        const result = await validator(value);
        resolve(result);
      }, delay);
    });
  };
}

// ============================================================================
// Schema Composition Utilities
// ============================================================================

/**
 * Make all fields optional (for partial updates)
 */
export function makePartial<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial();
}

/**
 * Pick specific fields from a schema
 */
export function pickFields<T extends z.ZodRawShape, K extends keyof T>(
  schema: z.ZodObject<T>,
  keys: K[]
) {
  const mask = keys.reduce<Record<string, true>>((acc, key) => {
    acc[key as string] = true;
    return acc;
  }, {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return schema.pick(mask as any);
}

/**
 * Omit specific fields from a schema
 */
export function omitFields<T extends z.ZodRawShape, K extends keyof T>(
  schema: z.ZodObject<T>,
  keys: K[]
) {
  const mask = keys.reduce<Record<string, true>>((acc, key) => {
    acc[key as string] = true;
    return acc;
  }, {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return schema.omit(mask as any);
}

// ============================================================================
// Type Exports
// ============================================================================

export type Coordinate = z.infer<typeof coordinate>;
export type MaterialProperties = z.infer<typeof materialProperties>;
export type SectionProperties = z.infer<typeof sectionProperties>;
export type Node = z.infer<typeof node>;
export type Member = z.infer<typeof member>;
export type Load = z.infer<typeof load>;
export type LoadCase = z.infer<typeof loadCase>;
export type LoadCombination = z.infer<typeof loadCombination>;
export type Project = z.infer<typeof project>;
export type AnalysisSettings = z.infer<typeof analysisSettings>;

// ============================================================================
// Validation Schema Registry
// ============================================================================

export const schemas = {
  // Primitives
  positiveNumber,
  nonNegativeNumber,
  percentage,
  email,
  password,
  uuid,
  dateString,
  url,
  
  // Structural
  coordinate,
  materialProperties,
  sectionProperties,
  node,
  member,
  load,
  loadCase,
  loadCombination,
  project,
  analysisSettings,
};
