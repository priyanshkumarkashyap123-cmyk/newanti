/**
 * Zod Validation Middleware
 * 
 * Industry standard: Validate ALL incoming request bodies at runtime
 * using Zod schemas before they reach route handlers. This prevents
 * malformed data from causing crashes or security vulnerabilities.
 */

import { z } from 'zod';
import { Request, Response, NextFunction, RequestHandler } from 'express';
// Temporary re-export barrel: keep existing imports working while schemas move to src/validation/*
export {
    idString,
    boolDefaultFalse,
    nonNegativeNumber,
    finiteNumber,
    positiveNumber,
    materialSchema,
    offsetVectorSchema,
    propertyReductionFactorsSchema,
    orientationSchema,
    memberLoadDirectionSchema,
    restraintsSchema,
    sectionMechanicsSchema,
    propertyAssignmentScopeSchema,
    behaviorSchema,
    offsetsSchema,
    orientationAndOffsets,
} from '../validation/common.js';
export {
    restraintsSchema as analysisRestraintsSchema,
    nodeSchema,
    memberSchema,
    propertyAssignmentSchema,
    analyzeRequestSchema,
} from '../validation/analysis.js';
export {
    sectionPropertiesSchema,
    designForcesSchema,
} from '../validation/steel.js';

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * On failure, returns HTTP 400 with { error: 'VALIDATION_ERROR', fields: [...] }.
 * Requirements: 17.4
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            const fields = result.error.issues.map(issue => ({
                field: issue.path.join('.'),
                message: issue.message,
            }));

            res.status(400).json({
                error: 'VALIDATION_ERROR',
                fields,
            });
            return;
        }

        // Replace req.body with the parsed (and coerced) data
        req.body = result.data;
        next();
    };
}

// Schemas have moved to src/validation/*. Keep this file focused on middleware and legacy exports.

// ─── Member Group Schema ────────────────────────────────────────────────────

// (legacy schema moved to validation package)
export const memberGroupSchema = z.never();

// ─── Member Load Schemas ────────────────────────────────────────────────────

const memberLoadDirectionSchema = z.enum([
    'local_x', 'local_y', 'local_z',
    'global_x', 'global_y', 'global_z', 'axial',
]);

export const memberLoadSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    memberId: z.union([z.string(), z.number()]).transform(String),
    type: z.enum(['UDL', 'UVL', 'point', 'moment']),
    w1: z.number().finite().optional(),
    w2: z.number().finite().optional(),
    P: z.number().finite().optional(),
    M: z.number().finite().optional(),
    a: z.number().min(0).max(1).optional(),
    direction: memberLoadDirectionSchema,
    startPos: z.number().min(0).max(1).optional().default(0),
    endPos: z.number().min(0).max(1).optional().default(1),
});

// ─── Floor Load Schema ──────────────────────────────────────────────────────

export const floorLoadSchema = z.never();

// ─── Load Case & Combination Schemas ────────────────────────────────────────

export const loadCaseSchema = z.never();

export const loadCombinationSchema = z.never();

// ─── Seismic Profile Schema ─────────────────────────────────────────────────

export const seismicProfileSchema = z.object({
    code: z.enum(['IS_1893', 'ASCE_7', 'EC8']).optional().default('IS_1893'),
    zone: z.enum(['II', 'III', 'IV', 'V']),
    soilType: z.enum(['hard', 'medium', 'soft']),
    importanceFactor: z.number().positive(),
    responseReduction: z.number().positive(),
    buildingHeight_m: z.number().positive(),
    buildingType: z.enum(['rc_frame', 'steel_frame', 'masonry', 'infill']).optional().default('rc_frame'),
    baseDimension_m: z.number().positive().optional(),
    storyWeights: z.array(z.object({
        storyId: z.string(),
        height_m: z.number().positive(),
        weight_kN: z.number().positive(),
    })).optional(),
});

// ─── Wind Profile Schema ────────────────────────────────────────────────────

export const windProfileSchema = z.object({
    code: z.enum(['IS_875_3', 'ASCE_7', 'EC1']).optional().default('IS_875_3'),
    basicWindSpeed_m_s: z.number().positive(),
    terrainCategory: z.number().int().min(1).max(4),
    buildingClass: z.enum(['A', 'B', 'C']).optional().default('B'),
    topography: z.enum(['flat', 'hill', 'ridge', 'cliff']).optional().default('flat'),
    riskCoefficient: z.number().positive().optional().default(1.0),
    heightPressures: z.array(z.object({
        height_m: z.number().nonnegative(),
        pressure_kN_m2: z.number().finite(),
    })).optional(),
});

export const loadSchema = z.never();

// All schemas moved; legacy exports are provided via ../validation/index.

// ============================================
// STEEL DESIGN SCHEMAS
// ============================================

const sectionPropertiesSchema = z.object({
    name: z.string().min(1),
    area: z.number().positive(),
    depth: z.number().positive(),
    width: z.number().positive(),
    webThickness: z.number().positive(),
    flangeThickness: z.number().positive(),
    Iy: z.number().positive(),
    Iz: z.number().positive(),
    Zy: z.number().positive().optional(),
    Zz: z.number().positive().optional(),
    ry: z.number().positive(),
    rz: z.number().positive(),
});

const designForcesSchema = z.object({
    N: z.number().finite(),
    Vy: z.number().finite(),
    Vz: z.number().finite(),
    My: z.number().finite(),
    Mz: z.number().finite(),
});

export const steelDesignSchema = z.object({
    code: z.enum(['IS800', 'AISC360']),
    section: sectionPropertiesSchema,
    geometry: z.object({
        length: z.number().positive(),
        effectiveLengthY: z.number().positive().optional(),
        effectiveLengthZ: z.number().positive().optional(),
        unbracedLength: z.number().positive().optional(),
        Cb: z.number().positive().optional().default(1.0),
    }),
    forces: designForcesSchema,
    material: z.object({
        fy: z.number().positive(),
        fu: z.number().positive(),
        E: z.number().positive().optional().default(200000),
    }),
    designMethod: z.enum(['LRFD', 'ASD']).optional().default('LRFD'),
});

// ============================================
// CONCRETE DESIGN SCHEMAS
// ============================================

export const concreteBeamSchema = z.object({
    version: z.enum(['VCurrent', 'V2025Sandbox']).optional().default('VCurrent'),
    section: z.object({
        width: z.number().positive(),
        depth: z.number().positive(),
        effectiveDepth: z.number().positive(),
        cover: z.number().positive().optional().default(40),
    }),
    forces: z.object({
        Mu: z.number().finite(),
        Vu: z.number().finite(),
    }),
    material: z.object({
        fck: z.number().positive(),
        fy: z.number().positive(),
    }),
});

export const concreteColumnSchema = z.object({
    version: z.enum(['VCurrent', 'V2025Sandbox']).optional().default('VCurrent'),
    section: z.object({
        width: z.number().positive(),
        depth: z.number().positive(),
        cover: z.number().positive().optional().default(40),
    }),
    forces: z.object({
        Pu: z.number().finite(),
        Mux: z.number().finite(),
        Muy: z.number().finite(),
    }),
    geometry: z.object({
        unsupportedLength: z.number().positive(),
        effectiveLengthFactor: z.number().positive().optional().default(1.0),
    }),
    material: z.object({
        fck: z.number().positive(),
        fy: z.number().positive(),
    }),
});

// ============================================
// CONNECTION DESIGN SCHEMAS
// ============================================

export const connectionDesignSchema = z.object({
    type: z.enum(['bolted_shear', 'bolted_moment', 'welded', 'base_plate']),
    forces: z.object({
        shear: z.number().finite().optional(),
        tension: z.number().finite().optional(),
        moment: z.number().finite().optional(),
        axial: z.number().finite().optional(),
    }),
    bolt: z.object({
        diameter: z.number().positive(),
        grade: z.string(),
        numBolts: z.number().int().positive().optional(),
        rows: z.number().int().positive().optional(),
        columns: z.number().int().positive().optional(),
        pitch: z.number().positive().optional(),
        gauge: z.number().positive().optional(),
    }).optional(),
    weld: z.object({
        size: z.number().positive(),
        length: z.number().positive(),
        type: z.enum(['fillet', 'butt']),
    }).optional(),
    plate: z.object({
        thickness: z.number().positive(),
        fy: z.number().positive(),
        width: z.number().positive().optional(),
        length: z.number().positive().optional(),
    }).optional(),
    material: z.object({
        fu: z.number().positive(),
        fy: z.number().positive(),
    }).optional(),
});

// ============================================
// FOUNDATION DESIGN SCHEMAS
// ============================================

export const foundationDesignSchema = z.object({
    type: z.enum(['isolated', 'combined', 'mat']),
    loads: z.array(z.object({
        P: z.number().finite(),
        Mx: z.number().finite().optional().default(0),
        My: z.number().finite().optional().default(0),
        x: z.number().finite().optional(),
        y: z.number().finite().optional(),
    })).min(1),
    columnSize: z.object({
        width: z.number().positive(),
        depth: z.number().positive(),
    }),
    soil: z.object({
        bearingCapacity: z.number().positive(),
        soilType: z.string().optional(),
    }),
    material: z.object({
        fck: z.number().positive(),
        fy: z.number().positive(),
    }),
    minDepth: z.number().positive().optional(),
});

// ============================================
// GEOTECHNICAL DESIGN SCHEMAS
// ============================================

export const geotechSptSchema = z.object({
    n60: z.number().positive(),
    fines_percent: z.number().min(0).max(100).optional(),
    groundwater_depth_m: z.number().nonnegative().optional(),
});

export const geotechInfiniteSlopeSchema = z.object({
    slope_angle_deg: z.number().gt(0).lt(89),
    friction_angle_deg: z.number().gt(0).lt(60),
    cohesion_kpa: z.number().min(0),
    unit_weight_kn_m3: z.number().positive(),
    depth_m: z.number().positive(),
    ru: z.number().min(0).lt(1).optional(),
    required_fs: z.number().positive().optional(),
});

export const geotechBearingCapacitySchema = z.object({
    cohesion_kpa: z.number().min(0),
    friction_angle_deg: z.number().min(0).max(50),
    unit_weight_kn_m3: z.number().positive(),
    footing_width_m: z.number().positive(),
    embedment_depth_m: z.number().min(0),
    applied_pressure_kpa: z.number().min(0),
    safety_factor: z.number().gt(1).optional(),
});

export const geotechRetainingWallSchema = z.object({
    wall_height_m: z.number().positive(),
    backfill_unit_weight_kn_m3: z.number().positive(),
    backfill_friction_angle_deg: z.number().gt(0).lt(50),
    surcharge_kpa: z.number().min(0).optional(),
    base_width_m: z.number().positive(),
    total_vertical_load_kn_per_m: z.number().positive(),
    stabilizing_moment_knm_per_m: z.number().positive(),
    base_friction_coeff: z.number().positive(),
    allowable_bearing_kpa: z.number().positive(),
    required_fs_overturning: z.number().positive().optional(),
    required_fs_sliding: z.number().positive().optional(),
});

export const geotechSettlementSchema = z.object({
    layer_thickness_m: z.number().positive(),
    initial_void_ratio: z.number().positive(),
    compression_index: z.number().positive(),
    initial_effective_stress_kpa: z.number().positive(),
    stress_increment_kpa: z.number().positive(),
    drainage_path_m: z.number().positive(),
    cv_m2_per_year: z.number().positive(),
    time_years: z.number().min(0),
    required_max_settlement_mm: z.number().positive().optional(),
});

export const geotechLiquefactionSchema = z.object({
    magnitude_mw: z.number().min(5).max(9).optional(),
    pga_g: z.number().gt(0).max(1.5),
    depth_m: z.number().gt(0).max(30),
    total_stress_kpa: z.number().positive(),
    effective_stress_kpa: z.number().positive(),
    n1_60cs: z.number().gt(0).max(50),
    rd: z.number().min(0.3).max(1.0).optional(),
    required_fs: z.number().positive().optional(),
}).refine((data) => data.total_stress_kpa >= data.effective_stress_kpa, {
    message: 'total_stress_kpa must be >= effective_stress_kpa',
    path: ['total_stress_kpa'],
});

export const geotechPileAxialSchema = z.object({
    diameter_m: z.number().positive(),
    length_m: z.number().positive(),
    unit_skin_friction_kpa: z.number().positive(),
    unit_end_bearing_kpa: z.number().positive(),
    applied_load_kn: z.number().min(0),
    safety_factor: z.number().gt(1).optional(),
});

export const geotechRankineSchema = z.object({
    friction_angle_deg: z.number().gt(0).lt(50),
    unit_weight_kn_m3: z.number().positive(),
    retained_height_m: z.number().positive(),
    surcharge_kpa: z.number().min(0).optional(),
});

export const geotechSeismicEarthPressureSchema = z.object({
    unit_weight_kn_m3: z.number().positive(),
    retained_height_m: z.number().positive(),
    kh: z.number().min(0).max(0.6),
    kv: z.number().min(-0.5).max(0.5).optional(),
    static_active_thrust_kn_per_m: z.number().min(0),
});

// ============================================
// ADVANCED ANALYSIS SCHEMAS
// ============================================

const advancedNodeSchema = z.object({
    id: z.number(),
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional().default(0),
});

const advancedMemberSchema = z.object({
    id: z.number(),
    startNode: z.number(),
    endNode: z.number(),
    E: z.number().positive(),
    A: z.number().positive(),
    I: z.number().positive(),
    J: z.number().positive().optional(),
    behavior: z.enum(['normal', 'tension_only', 'compression_only', 'cable']).optional().default('normal'),
});

const supportSchema = z.object({
    nodeId: z.number(),
    fx: z.boolean(),
    fy: z.boolean(),
    fz: z.boolean(),
    mx: z.boolean().optional().default(false),
    my: z.boolean().optional().default(false),
    mz: z.boolean().optional().default(false),
});

export const pDeltaSchema = z.object({
    nodes: z.array(advancedNodeSchema).min(2).max(50000),
    members: z.array(advancedMemberSchema).min(1).max(100000),
    supports: z.array(supportSchema).min(1).max(50000),
    loads: z.array(z.object({
        nodeId: z.number(),
        fx: z.number().finite().optional(),
        fy: z.number().finite().optional(),
        fz: z.number().finite().optional(),
    })),
    options: z.object({
        maxIterations: z.number().int().positive().optional().default(10),
        tolerance: z.number().positive().optional().default(1e-4),
    }).optional().default({}),
});

export const modalSchema = z.object({
    nodes: z.array(advancedNodeSchema).min(2).max(50000),
    members: z.array(advancedMemberSchema).min(1).max(100000),
    supports: z.array(supportSchema).min(1).max(50000),
    masses: z.array(z.object({
        nodeId: z.number(),
        mass: z.number().positive(),
    })).optional().default([]),
    numModes: z.number().int().positive().optional().default(5),
    massType: z.enum(['lumped', 'consistent']).optional().default('lumped'),
});

export const bucklingSchema = z.object({
    nodes: z.array(advancedNodeSchema).min(2).max(50000),
    members: z.array(advancedMemberSchema).min(1).max(100000),
    supports: z.array(supportSchema).min(1).max(50000),
    loads: z.array(z.object({
        nodeId: z.number(),
        fx: z.number().finite().optional(),
        fy: z.number().finite().optional(),
        fz: z.number().finite().optional(),
    })).min(1),
    numModes: z.number().int().positive().optional().default(3),
});

export const cableSchema = z.object({
    nodes: z.array(advancedNodeSchema).min(2).max(50000),
    members: z.array(advancedMemberSchema).min(1).max(100000),
    supports: z.array(supportSchema).min(1).max(50000),
    cables: z.array(z.object({
        memberId: z.number(),
        weight: z.number().positive().optional().default(10),
        pretension: z.number().finite().optional().default(0),
        sagRatio: z.number().positive().optional(),
    })).min(1).max(100000),
    loads: z.array(z.object({
        nodeId: z.number(),
        fx: z.number().finite().optional(),
        fy: z.number().finite().optional(),
        fz: z.number().finite().optional(),
    })).optional().default([]),
});

export const spectrumSchema = z.object({
    nodes: z.array(advancedNodeSchema).min(2).max(50000),
    members: z.array(advancedMemberSchema).min(1).max(100000),
    supports: z.array(supportSchema).min(1).max(50000),
    numModes: z.number().int().positive().optional().default(12),
    spectrum: z.object({
        type: z.enum(['IS1893', 'custom']),
        zoneLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
        soilType: z.enum(['I', 'II', 'III']).optional(),
        dampingRatio: z.number().min(0).max(1).optional().default(0.05),
        customCurve: z.array(z.object({
            period: z.number().positive(),
            acceleration: z.number().positive(),
        })).optional(),
    }),
    combinationMethod: z.enum(['CQC', 'SRSS']).optional().default('CQC'),
});

// ============================================
// AUTH SCHEMAS
// ============================================

const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number');

export const signUpSchema = z.object({
    email: z.string().email('Please enter a valid email address').transform(e => e.toLowerCase().trim()),
    password: passwordSchema,
    firstName: z.string().min(1, 'First name is required').max(100).trim(),
    lastName: z.string().min(1, 'Last name is required').max(100).trim(),
    company: z.string().max(200).trim().optional(),
    phone: z.string().max(20).trim().optional(),
});

export const signInSchema = z.object({
    email: z.string().email('Please enter a valid email address').transform(e => e.toLowerCase().trim()),
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
    email: z.string().email('Please enter a valid email address').transform(e => e.toLowerCase().trim()),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema,
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
});

export const verifyEmailSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    code: z.string().length(6, 'Verification code must be 6 digits'),
});

export const updateProfileSchema = z.object({
    firstName: z.string().min(1).trim().optional(),
    lastName: z.string().min(1).trim().optional(),
    company: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    avatarUrl: z.string().url().optional(),
});

// ============================================
// QUERY PARAM VALIDATION
// ============================================

/**
 * Express middleware factory that validates req.query against a Zod schema.
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            const errors = result.error.issues.map(issue => ({
                path: issue.path.join('.'),
                message: issue.message,
                code: issue.code,
            }));
            res.status(400).json({ success: false, error: 'Query validation failed', details: errors });
            return;
        }
        // Express 5: req.query is a read-only getter — shadow on instance
        Object.defineProperty(req, 'query', {
            value: result.data,
            writable: true,
            configurable: true,
        });
        next();
    };
}

// Re-export Zod for convenience
export { z };

// ============================================
// PROJECT SCHEMAS
// ============================================

export const createProjectSchema = z.object({
    name: z.string().min(1, 'Project name is required').max(200).trim(),
    description: z.string().max(2000).trim().optional(),
    data: z.record(z.unknown()).optional().default({}).refine(
        (val) => JSON.stringify(val).length <= 10_000_000,
        'Project data must be under 10MB'
    ),
    thumbnail: z.string().url().optional(),
});

export const updateProjectSchema = z.object({
    name: z.string().min(1).max(200).trim().optional(),
    description: z.string().max(2000).trim().optional(),
    data: z.record(z.unknown()).optional(),
    thumbnail: z.string().url().optional(),
}).refine(obj => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided for update',
});

// ============================================
// USER ACTIVITY SCHEMAS
// ============================================

export const userLoginSchema = z.object({
    email: z.string().email().transform(e => e.toLowerCase().trim()).optional(),
});

export const recordAnalysisSchema = z.object({
    nodeCount: z.number().int().min(0).max(1_000_000),
    memberCount: z.number().int().min(0).max(1_000_000),
    solverType: z.string().max(50).optional(),
    duration: z.number().min(0).optional(),
});

export const checkModelLimitsSchema = z.object({
    nodeCount: z.number().int().min(0),
    memberCount: z.number().int().min(0),
});

export const recordExportSchema = z.object({
    format: z.string().min(1).max(20),
    fileSize: z.number().int().min(0).optional(),
});

export const adminUpgradeSchema = z.object({
    email: z.string().email('Valid email is required').transform(e => e.toLowerCase().trim()),
    tier: z.enum(['free', 'pro', 'enterprise', 'master'], {
        errorMap: () => ({ message: 'Tier must be one of: free, pro, enterprise, master' }),
    }),
});

// ============================================
// COLLABORATION SCHEMAS
// ============================================

export const collaborationInviteSchema = z.object({
    email: z.string().email('Valid email is required').transform(e => e.toLowerCase().trim()),
});

export const subscriptionUpgradeSchema = z.object({
    tier: z.enum(['free', 'pro', 'enterprise'], {
        errorMap: () => ({ message: 'Tier must be one of: free, pro, enterprise' }),
    }),
});

// ============================================
// BILLING SCHEMAS
// ============================================

const billingPlanCycleSchema = z.enum(['monthly', 'yearly']);
const billingPlanIdSchema = z.enum(['pro', 'business']);
const checkoutPlanIdSchema = z.enum([
    'pro_monthly',
    'pro_yearly',
    'business_monthly',
    'business_yearly',
]);

export const billingInitiateSchema = z.object({
    email: z.string().email('Valid email is required').transform((e) => e.toLowerCase().trim()),
    planType: billingPlanCycleSchema,
    planId: billingPlanIdSchema.optional(),
    checkoutPlanId: checkoutPlanIdSchema.optional(),
});

export const billingCreateOrderSchema = z.object({
    email: z.string().email('Valid email is required').transform((e) => e.toLowerCase().trim()).optional(),
    planType: billingPlanCycleSchema,
    planId: billingPlanIdSchema.optional(),
    checkoutPlanId: checkoutPlanIdSchema.optional(),
});

export const billingVerifySchema = z.object({
    merchantTransactionId: z.string().min(1, 'merchantTransactionId is required'),
    planType: billingPlanCycleSchema.optional(),
    planId: billingPlanIdSchema.optional(),
    checkoutPlanId: checkoutPlanIdSchema.optional(),
});


// ============================================
// CONSENT SCHEMA
// ============================================

export const recordConsentSchema = z.object({
    consentType: z.enum(['terms', 'privacy', 'cookies', 'marketing'], {
        errorMap: () => ({ message: 'consentType must be one of: terms, privacy, cookies, marketing' }),
    }),
    termsVersion: z.string().max(20).optional(),
    userAgent: z.string().max(500).optional(),
    ipAddress: z.string().max(45).optional(),
});

// ============================================
// AI SESSION SCHEMAS
// ============================================

export const createAiSessionSchema = z.object({
    name: z.string().min(1).max(200).trim(),
    projectId: z.string().optional(),
    projectSnapshot: z.record(z.unknown()).optional(),
});

export const updateAiSessionSchema = z.object({
    name: z.string().min(1).max(200).trim().optional(),
    projectSnapshot: z.record(z.unknown()).optional(),
});

export const addAiMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(50_000),
    metadata: z.record(z.unknown()).optional(),
});
