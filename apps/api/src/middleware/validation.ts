/**
 * Zod Validation Middleware
 * 
 * Industry standard: Validate ALL incoming request bodies at runtime
 * using Zod schemas before they reach route handlers. This prevents
 * malformed data from causing crashes or security vulnerabilities.
 */

import { z } from 'zod';
import { Request, Response, NextFunction, RequestHandler } from 'express';

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * On failure, returns a 400 with structured error details.
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            const errors = result.error.issues.map(issue => ({
                path: issue.path.join('.'),
                message: issue.message,
                code: issue.code,
            }));

            res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors,
            });
            return;
        }

        // Replace req.body with the parsed (and coerced) data
        req.body = result.data;
        next();
    };
}

// ============================================
// ANALYSIS SCHEMAS
// ============================================

const restraintsSchema = z.object({
    fx: z.boolean().optional().default(false),
    fy: z.boolean().optional().default(false),
    fz: z.boolean().optional().default(false),
    mx: z.boolean().optional().default(false),
    my: z.boolean().optional().default(false),
    mz: z.boolean().optional().default(false),
}).optional();

const nodeSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional().default(0),
    restraints: restraintsSchema,
});

const memberSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    startNodeId: z.union([z.string(), z.number()]).transform(String),
    endNodeId: z.union([z.string(), z.number()]).transform(String),
    E: z.number().positive().optional().default(200e6),
    A: z.number().positive().optional().default(0.01),
    I: z.number().positive().optional().default(1e-4),
}).refine(data => data.startNodeId !== data.endNodeId, {
    message: "Start and end nodes cannot be the same",
    path: ["endNodeId"]
});

const loadSchema = z.object({
    nodeId: z.union([z.string(), z.number()]).transform(String),
    fx: z.number().finite().optional().default(0),
    fy: z.number().finite().optional().default(0),
    fz: z.number().finite().optional().default(0),
    mx: z.number().finite().optional().default(0),
    my: z.number().finite().optional().default(0),
    mz: z.number().finite().optional().default(0),
});

export const analyzeRequestSchema = z.object({
    nodes: z.array(nodeSchema).min(2, 'At least 2 nodes are required'),
    members: z.array(memberSchema).min(1, 'At least 1 member is required'),
    loads: z.array(loadSchema).optional().default([]),
    dofPerNode: z.number().int().min(1).max(6).optional().default(3),
    options: z.object({
        method: z.enum(['spsolve', 'cg', 'gmres']).optional().default('spsolve'),
    }).optional(),
});

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
    nodes: z.array(advancedNodeSchema).min(2),
    members: z.array(advancedMemberSchema).min(1),
    supports: z.array(supportSchema).min(1),
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
    nodes: z.array(advancedNodeSchema).min(2),
    members: z.array(advancedMemberSchema).min(1),
    supports: z.array(supportSchema).min(1),
    masses: z.array(z.object({
        nodeId: z.number(),
        mass: z.number().positive(),
    })).optional().default([]),
    numModes: z.number().int().positive().optional().default(5),
    massType: z.enum(['lumped', 'consistent']).optional().default('lumped'),
});

export const bucklingSchema = z.object({
    nodes: z.array(advancedNodeSchema).min(2),
    members: z.array(advancedMemberSchema).min(1),
    supports: z.array(supportSchema).min(1),
    loads: z.array(z.object({
        nodeId: z.number(),
        fx: z.number().finite().optional(),
        fy: z.number().finite().optional(),
        fz: z.number().finite().optional(),
    })).min(1),
    numModes: z.number().int().positive().optional().default(3),
});

export const cableSchema = z.object({
    nodes: z.array(advancedNodeSchema).min(2),
    members: z.array(advancedMemberSchema).min(1),
    supports: z.array(supportSchema).min(1),
    cables: z.array(z.object({
        memberId: z.number(),
        weight: z.number().positive().optional().default(10),
        pretension: z.number().finite().optional().default(0),
        sagRatio: z.number().positive().optional(),
    })).min(1),
    loads: z.array(z.object({
        nodeId: z.number(),
        fx: z.number().finite().optional(),
        fy: z.number().finite().optional(),
        fz: z.number().finite().optional(),
    })).optional().default([]),
});

export const spectrumSchema = z.object({
    nodes: z.array(advancedNodeSchema).min(2),
    members: z.array(advancedMemberSchema).min(1),
    supports: z.array(supportSchema).min(1),
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
    firstName: z.string().min(1, 'First name is required').trim(),
    lastName: z.string().min(1, 'Last name is required').trim(),
    company: z.string().trim().optional(),
    phone: z.string().trim().optional(),
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
        req.query = result.data;
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
    data: z.record(z.unknown()).optional().default({}),
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
