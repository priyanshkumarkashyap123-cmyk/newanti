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
    id: z.union([z.string(), z.number()]),
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional().default(0),
    restraints: restraintsSchema,
});

const memberSchema = z.object({
    id: z.union([z.string(), z.number()]),
    startNodeId: z.union([z.string(), z.number()]),
    endNodeId: z.union([z.string(), z.number()]),
    E: z.number().positive().optional().default(200e6),
    A: z.number().positive().optional().default(0.01),
    I: z.number().positive().optional().default(1e-4),
});

const loadSchema = z.object({
    nodeId: z.union([z.string(), z.number()]),
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
    }).optional(),
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
    })),
    numModes: z.number().int().positive().optional().default(3),
});

// Re-export Zod for convenience
export { z };
