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

const propertyAssignmentScopeSchema = z.object({
    mode: z.enum(['selected', 'view', 'cursor', 'group', 'manual_range']),
    memberIds: z.array(z.union([z.string(), z.number()]).transform(String)).optional().default([]),
    groupIds: z.array(z.string().min(1)).optional().default([]),
    manualRange: z.string().min(1).optional(),
});

const sectionMechanicsSchema = z.object({
    area_m2: z.number().positive(),
    iyy_m4: z.number().positive(),
    izz_m4: z.number().positive(),
    j_m4: z.number().positive(),
    ay_m2: z.number().positive().optional(),
    az_m2: z.number().positive().optional(),
    zy_m3: z.number().positive().optional(),
    zz_m3: z.number().positive().optional(),
    zpy_m3: z.number().positive().optional(),
    zpz_m3: z.number().positive().optional(),
    ry_m: z.number().positive().optional(),
    rz_m: z.number().positive().optional(),
});

const propertyReductionFactorsSchema = z.object({
    axial: z.number().min(0).max(1).optional(),
    shearY: z.number().min(0).max(1).optional(),
    shearZ: z.number().min(0).max(1).optional(),
    torsion: z.number().min(0).max(1).optional(),
    bendingY: z.number().min(0).max(1).optional(),
    bendingZ: z.number().min(0).max(1).optional(),
});

const offsetVectorSchema = z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
});

const propertyAssignmentSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    name: z.string().min(1),
    sectionType: z.enum([
        'I-BEAM', 'TUBE', 'L-ANGLE', 'RECTANGLE', 'CIRCLE', 'C-CHANNEL', 'T-SECTION', 'DOUBLE-ANGLE', 'PIPE', 'TAPERED', 'BUILT-UP',
    ]),
    dimensions: z.record(z.number().finite()).optional().default({}),
    mechanics: sectionMechanicsSchema,
    material: z.object({
        id: z.union([z.string(), z.number()]).transform(String),
        family: z.enum(['steel', 'concrete', 'composite', 'timber', 'custom']),
        E_kN_m2: z.number().positive(),
        nu: z.number().positive().lt(0.5),
        G_kN_m2: z.number().positive().optional(),
        rho_kg_m3: z.number().positive().optional(),
        fy_mpa: z.number().positive().optional(),
        fck_mpa: z.number().positive().optional(),
    }),
    behavior: z.object({
        tensionOnly: z.boolean().optional().default(false),
        compressionOnly: z.boolean().optional().default(false),
    }).optional(),
    reductionFactors: propertyReductionFactorsSchema.optional(),
    orientation: z.object({
        betaAngleDeg: z.number().finite().optional().default(0),
    }).optional(),
    offsets: z.object({
        startGlobal_m: offsetVectorSchema.optional(),
        endGlobal_m: offsetVectorSchema.optional(),
        startLocal_m: offsetVectorSchema.optional(),
        endLocal_m: offsetVectorSchema.optional(),
    }).optional(),
    assignment: propertyAssignmentScopeSchema,
    source: z.enum(['database', 'computed', 'user']).optional().default('user'),
    codeContext: z.object({
        designCode: z.string().optional(),
        steelCode: z.string().optional(),
        concreteCode: z.string().optional(),
    }).optional(),
}).superRefine((payload, ctx) => {
    if (payload.behavior?.tensionOnly && payload.behavior?.compressionOnly) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'tensionOnly and compressionOnly cannot both be true',
            path: ['behavior'],
        });
    }
});

// ─── Member Group Schema ────────────────────────────────────────────────────

const memberGroupSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    name: z.string().min(1),
    memberIds: z.array(z.union([z.string(), z.number()]).transform(String)),
    propertyAssignmentId: z.union([z.string(), z.number()]).transform(String).optional(),
    color: z.string().optional(),
});

// ─── Member Load Schemas ────────────────────────────────────────────────────

const memberLoadDirectionSchema = z.enum([
    'local_x', 'local_y', 'local_z',
    'global_x', 'global_y', 'global_z', 'axial',
]);

const memberLoadSchema = z.object({
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

const floorLoadSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    pressure: z.number().finite(),
    yLevel: z.number().finite(),
    xMin: z.number().finite(),
    xMax: z.number().finite(),
    zMin: z.number().finite(),
    zMax: z.number().finite(),
    distributionOverride: z.enum(['one_way', 'two_way_triangular', 'two_way_trapezoidal']).optional(),
    loadCase: z.string().optional(),
});

// ─── Load Case & Combination Schemas ────────────────────────────────────────

const loadCaseSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    name: z.string().min(1),
    type: z.enum(['dead', 'live', 'wind', 'seismic', 'snow', 'temperature', 'self_weight', 'custom']),
    loads: z.array(z.object({
        id: z.string(),
        nodeId: z.string(),
        fx: z.number().finite().optional().default(0),
        fy: z.number().finite().optional().default(0),
        fz: z.number().finite().optional().default(0),
        mx: z.number().finite().optional().default(0),
        my: z.number().finite().optional().default(0),
        mz: z.number().finite().optional().default(0),
    })).optional().default([]),
    memberLoads: z.array(memberLoadSchema).optional().default([]),
    selfWeight: z.boolean().optional(),
    factor: z.number().finite().optional().default(1.0),
});

const loadCombinationSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    name: z.string().min(1),
    code: z.string().optional(),
    factors: z.array(z.object({
        loadCaseId: z.string(),
        factor: z.number().finite(),
    })),
}).superRefine((combo, ctx) => {
    // IS 1893 Cl. 6.3.2: Wind and seismic must not appear simultaneously
    // This requires load case type lookup, deferred to analysis route handler
});

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
    schema_version: z.number().int().optional().default(2),
    nodes: z.array(nodeSchema).min(2, 'At least 2 nodes are required').max(50000, 'Maximum 50,000 nodes allowed'),
    members: z.array(memberSchema).min(1, 'At least 1 member is required').max(100000, 'Maximum 100,000 members allowed'),
    loads: z.array(loadSchema).max(100000, 'Maximum 100,000 loads allowed').optional().default([]),
    memberLoads: z.array(memberLoadSchema).max(100000, 'Maximum 100,000 member loads allowed').optional().default([]),
    floorLoads: z.array(floorLoadSchema).max(10000, 'Maximum 10,000 floor loads allowed').optional().default([]),
    propertyAssignments: z.array(propertyAssignmentSchema).max(100000, 'Maximum 100,000 property assignments allowed').optional().default([]),
    memberGroups: z.array(memberGroupSchema).max(10000, 'Maximum 10,000 member groups allowed').optional().default([]),
    loadCases: z.array(loadCaseSchema).max(500, 'Maximum 500 load cases allowed').optional().default([]),
    loadCombinations: z.array(loadCombinationSchema).max(5000, 'Maximum 5,000 load combinations allowed').optional().default([]),
    seismicProfile: seismicProfileSchema.optional(),
    windProfile: windProfileSchema.optional(),
    dofPerNode: z.number().int().min(1).max(6).optional().default(3),
    options: z.object({
        method: z.enum(['spsolve', 'cg', 'gmres']).optional().default('spsolve'),
        includeSelfWeight: z.boolean().optional().default(false),
        pDelta: z.boolean().optional().default(false),
        pDeltaIterations: z.number().int().min(1).max(50).optional().default(10),
        pDeltaTolerance: z.number().positive().optional().default(0.001),
    }).optional(),
}).superRefine((model, ctx) => {
    const memberIds = new Set(model.members.map((m) => m.id));
    const nodeIds = new Set(model.nodes.map((n) => n.id));

    // Validate property assignment member references
    model.propertyAssignments.forEach((assignment, idx) => {
        assignment.assignment.memberIds.forEach((memberId, midx) => {
            if (!memberIds.has(memberId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Property assignment references unknown memberId: ${memberId}`,
                    path: ['propertyAssignments', idx, 'assignment', 'memberIds', midx],
                });
            }
        });
    });

    // Validate member group member references
    model.memberGroups.forEach((group, gidx) => {
        group.memberIds.forEach((memberId, midx) => {
            if (!memberIds.has(memberId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Member group "${group.name}" references unknown memberId: ${memberId}`,
                    path: ['memberGroups', gidx, 'memberIds', midx],
                });
            }
        });
    });

    // Validate member load references
    model.memberLoads.forEach((ml, idx) => {
        if (!memberIds.has(ml.memberId)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Member load references unknown memberId: ${ml.memberId}`,
                path: ['memberLoads', idx, 'memberId'],
            });
        }
    });

    // Validate load node references
    model.loads.forEach((load, idx) => {
        if (!nodeIds.has(load.nodeId)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Load references unknown nodeId: ${load.nodeId}`,
                path: ['loads', idx, 'nodeId'],
            });
        }
    });

    // IS 1893 Cl. 6.3.2: Wind + seismic cannot appear in the same combination
    const loadCaseTypeById = new Map<string, string>();
    model.loadCases.forEach((lc) => loadCaseTypeById.set(lc.id, lc.type));

    model.loadCombinations.forEach((combo, cidx) => {
        const types = combo.factors.map((f) => loadCaseTypeById.get(f.loadCaseId)).filter(Boolean);
        const hasWind = types.includes('wind');
        const hasSeismic = types.includes('seismic');
        if (hasWind && hasSeismic) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Load combination "${combo.name}" combines wind and seismic loads simultaneously, violating IS 1893 Cl. 6.3.2`,
                path: ['loadCombinations', cidx],
            });
        }
    });
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
