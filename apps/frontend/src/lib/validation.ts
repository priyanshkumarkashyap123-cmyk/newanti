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
// Design Engine Input Schemas
// ============================================================================

/**
 * Composite beam input — AISC 360 Chapter I
 */
export const compositeBeamInput = z.object({
  steelSection: z.string().min(1),
  As: positiveNumber.describe('Steel area (mm²)'),
  d: positiveNumber.describe('Beam depth (mm)'),
  tw: positiveNumber.describe('Web thickness (mm)'),
  bf: positiveNumber.describe('Flange width (mm)'),
  tf: positiveNumber.describe('Flange thickness (mm)'),
  Ix: positiveNumber.describe('Moment of inertia (mm⁴)'),
  Fy: positiveNumber.describe('Yield strength (MPa)'),
  Fu: positiveNumber.describe('Ultimate strength (MPa)'),
  slabWidth: positiveNumber.describe('Effective slab width (mm)'),
  slabThickness: positiveNumber.describe('Slab thickness (mm)'),
  fc: positiveNumber.describe('Concrete compressive strength (MPa)'),
  deckType: z.enum(['solid', 'metal_deck']),
  deckRibHeight: positiveNumber.optional(),
  deckRibWidth: positiveNumber.optional(),
  studDiameter: positiveNumber,
  studHeight: positiveNumber,
  studFu: positiveNumber,
  studSpacing: positiveNumber,
  span: positiveNumber.describe('Span (m)'),
  unbragedLength: positiveNumber.optional(),
}).refine(
  (d) => d.deckType !== 'metal_deck' || (d.deckRibHeight != null && d.deckRibWidth != null),
  { message: 'Metal deck requires rib height and width' }
).refine(
  (d) => d.Fu > d.Fy,
  { message: 'Fu must exceed Fy' }
);

/**
 * Composite column input — AISC 360 I2
 */
export const compositeColumnInput = z.object({
  type: z.enum(['encased', 'filled_rectangular', 'filled_circular']),
  steelSection: z.string().optional(),
  tubeDimensions: z.object({
    width: positiveNumber,
    depth: positiveNumber.optional(),
    thickness: positiveNumber,
  }).optional(),
  Fy: positiveNumber,
  fc: positiveNumber,
  rebarArea: nonNegativeNumber.optional(),
  rebarFy: positiveNumber.optional(),
  length: positiveNumber.describe('Column length (m)'),
  K: positiveNumber.describe('Effective length factor'),
  Pu: z.number().describe('Axial load (kN)'),
  Mux: z.number().describe('Moment about X (kN·m)'),
  Muy: z.number().describe('Moment about Y (kN·m)'),
}).refine(
  (d) => d.type === 'encased' ? d.steelSection != null : d.tubeDimensions != null,
  { message: 'Encased columns need steelSection; filled columns need tubeDimensions' }
);

/**
 * Timber member input — NDS 2018 / EN 1995
 */
export const timberMemberInput = z.object({
  type: z.enum(['sawn', 'glulam', 'clt', 'lvl']),
  species: z.string().optional(),
  grade: z.string().min(1),
  width: positiveNumber.describe('Width b (mm)'),
  depth: positiveNumber.describe('Depth d (mm)'),
  length: positiveNumber.describe('Length (m)'),
  cltLayers: z.number().int().positive().optional(),
  cltLayerThickness: positiveNumber.optional(),
  lateralSupport: z.enum(['continuous', 'discrete', 'none']),
  unbragedLength: positiveNumber.optional(),
  loadDuration: z.enum(['permanent', 'long_term', 'medium_term', 'short_term', 'instantaneous']),
  moistureCondition: z.enum(['dry', 'wet']),
  temperature: z.enum(['normal', 'elevated']),
}).refine(
  (d) => d.type !== 'clt' || (d.cltLayers != null && d.cltLayerThickness != null),
  { message: 'CLT requires layers and layer thickness' }
);

/**
 * Timber connection input — NDS 2018 / EN 1995
 */
export const timberConnectionInput = z.object({
  type: z.enum(['nailed', 'screwed', 'bolted', 'lag_screwed', 'doweled', 'glued']),
  fastenerDiameter: positiveNumber.optional(),
  fastenerLength: positiveNumber.optional(),
  fastenerCount: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
  spacing: positiveNumber.optional(),
  edgeDistance: positiveNumber.optional(),
  endDistance: positiveNumber.optional(),
  mainMemberThickness: positiveNumber,
  sideMemberThickness: positiveNumber,
  mainMemberSpecies: z.string().min(1),
  sideMemberSpecies: z.string().min(1),
  sideMemberType: z.enum(['wood', 'steel']),
  loadAngle: z.number().min(0).max(360),
  loadType: z.enum(['lateral', 'withdrawal']),
});

/**
 * Bolted connection input — IS 800:2007
 */
export const boltedConnectionInput = z.object({
  bolt_grade: z.string().min(1),
  bolt_diameter: positiveNumber.describe('Bolt diameter (mm)'),
  num_bolts: z.number().int().positive(),
  bolt_rows: z.number().int().positive(),
  bolt_columns: z.number().int().positive(),
  plate_thickness: positiveNumber,
  plate_fu: positiveNumber,
  plate_fy: positiveNumber,
  connection_type: z.enum(['bearing', 'friction', 'combined']),
  shear_plane: z.enum(['threads_in', 'threads_excluded']),
  num_shear_planes: z.number().int().positive(),
  shear_force: nonNegativeNumber,
  tension_force: nonNegativeNumber.optional(),
  moment: z.number().optional(),
  edge_distance: positiveNumber,
  pitch: positiveNumber,
  gauge: positiveNumber.optional(),
  hole_type: z.string().optional(),
  surface_treatment: z.string().optional(),
}).refine(
  (d) => d.num_bolts === d.bolt_rows * d.bolt_columns,
  { message: 'num_bolts must equal bolt_rows × bolt_columns' }
).refine(
  (d) => d.plate_fu > d.plate_fy,
  { message: 'Plate fu must exceed fy' }
);

/**
 * Welded connection input — IS 800:2007
 */
export const weldedConnectionInput = z.object({
  weld_type: z.enum(['fillet', 'butt', 'plug', 'slot']),
  weld_size: positiveNumber,
  weld_length: positiveNumber,
  electrode_grade: z.string().min(1),
  plate_fu: positiveNumber,
  plate_thickness: positiveNumber,
  shear_force: nonNegativeNumber.optional(),
  tension_force: nonNegativeNumber.optional(),
  resultant_force: nonNegativeNumber.optional(),
  weld_position: z.enum(['longitudinal', 'transverse', 'oblique']),
  inspection_level: z.enum(['visual', 'ut', 'rt']).optional(),
});

/**
 * Base plate input — IS 800:2007
 */
export const basePlateInput = z.object({
  column_section: z.string().min(1),
  column_depth: positiveNumber,
  column_flange_width: positiveNumber,
  column_flange_thickness: positiveNumber,
  column_web_thickness: positiveNumber,
  fy_column: positiveNumber,
  fy_plate: positiveNumber,
  fck: positiveNumber,
  axial_load: positiveNumber,
  moment: z.number().optional(),
  shear: nonNegativeNumber.optional(),
  plate_length: positiveNumber.optional(),
  plate_width: positiveNumber.optional(),
  plate_thickness: positiveNumber.optional(),
});

/**
 * Footing design input — IS 456:2000
 */
export const footingDesignInput = z.object({
  columnWidth: positiveNumber,
  columnDepth: positiveNumber,
  axialLoad: positiveNumber,
  momentX: z.number().optional(),
  momentY: z.number().optional(),
  bearingCapacity: positiveNumber,
  soilDensity: positiveNumber,
  foundationDepth: positiveNumber,
  frictionAngle: z.number().min(0).max(50).optional(),
  cohesion: nonNegativeNumber.optional(),
  elasticModulus: positiveNumber.optional(),
  poissonRatio: z.number().min(0).max(0.5).optional(),
  horizontalLoad: nonNegativeNumber.optional(),
  fck: positiveNumber,
  fy: positiveNumber,
  footingType: z.enum(['isolated_square', 'isolated_rectangular', 'combined']),
  minCover: positiveNumber,
});

/**
 * Shear design input — IS 456 / ACI 318 / EN 1992
 */
export const shearDesignInput = z.object({
  factoredShear: positiveNumber,
  factoredAxial: z.number().optional(),
  factoredTorsion: nonNegativeNumber.optional(),
  webWidth: positiveNumber,
  effectiveDepth: positiveNumber,
  totalDepth: positiveNumber,
  concrete: z.object({
    fck: positiveNumber,
  }).passthrough(),
  stirrupBar: z.object({
    diameter: positiveNumber,
    fy: positiveNumber,
  }).passthrough(),
  designCode: z.enum(['IS456', 'ACI318', 'EN1992']),
  memberType: z.string().min(1),
  cover: positiveNumber,
}).refine(
  (d) => d.totalDepth > d.effectiveDepth,
  { message: 'Total depth must exceed effective depth' }
);

export type CompositeBeamInput = z.infer<typeof compositeBeamInput>;
export type CompositeColumnInput = z.infer<typeof compositeColumnInput>;
export type TimberMemberInput = z.infer<typeof timberMemberInput>;
export type TimberConnectionInput = z.infer<typeof timberConnectionInput>;
export type BoltedConnectionInput = z.infer<typeof boltedConnectionInput>;
export type WeldedConnectionInput = z.infer<typeof weldedConnectionInput>;
export type BasePlateInput = z.infer<typeof basePlateInput>;
export type FootingDesignInput = z.infer<typeof footingDesignInput>;
export type ShearDesignInput = z.infer<typeof shearDesignInput>;

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

  // Design engine inputs
  compositeBeamInput,
  compositeColumnInput,
  timberMemberInput,
  timberConnectionInput,
  boltedConnectionInput,
  weldedConnectionInput,
  basePlateInput,
  footingDesignInput,
  shearDesignInput,
};
