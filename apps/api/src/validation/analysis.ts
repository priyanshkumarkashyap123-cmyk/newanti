import { z } from 'zod';
import {
  idString,
  boolDefaultFalse,
  finiteNumber,
  positiveNumber,
  propertyAssignmentScopeSchema,
  sectionMechanicsSchema,
  propertyReductionFactorsSchema,
  loadSchema,
  windProfileSchema,
  seismicProfileSchema,
  materialSchema,
  behaviorSchema,
  offsetsSchema,
  memberLoadDirectionSchema,
} from './common.js';

export const restraintsSchema = z.object({
  fx: boolDefaultFalse,
  fy: boolDefaultFalse,
  fz: boolDefaultFalse,
  mx: boolDefaultFalse,
  my: boolDefaultFalse,
  mz: boolDefaultFalse,
}).optional();

export const nodeSchema = z.object({
  id: idString,
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber.optional().default(0),
  restraints: restraintsSchema,
});

export const memberSchema = z.object({
  id: idString,
  startNodeId: idString,
  endNodeId: idString,
  E: positiveNumber.optional().default(200e6),
  A: positiveNumber.optional().default(0.01),
  I: positiveNumber.optional().default(1e-4),
}).refine(data => data.startNodeId !== data.endNodeId, {
  message: 'Start and end nodes cannot be the same',
  path: ['endNodeId'],
});

export const propertyAssignmentSchema = z.object({
  id: idString,
  name: z.string().min(1),
  sectionType: z.enum([
    'I-BEAM', 'TUBE', 'L-ANGLE', 'RECTANGLE', 'CIRCLE', 'C-CHANNEL', 'T-SECTION', 'DOUBLE-ANGLE', 'PIPE', 'TAPERED', 'BUILT-UP',
  ]),
  dimensions: z.record(finiteNumber).optional().default({}),
  mechanics: sectionMechanicsSchema,
  material: materialSchema,
  behavior: behaviorSchema,
  reductionFactors: propertyReductionFactorsSchema.optional(),
  orientation: z.object({
    betaAngleDeg: finiteNumber.optional().default(0),
  }).optional(),
  offsets: offsetsSchema.optional(),
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

export const memberGroupSchema = z.object({
  id: idString,
  name: z.string().min(1),
  memberIds: z.array(idString),
  propertyAssignmentId: idString.optional(),
  color: z.string().optional(),
});

export const memberLoadSchema = z.object({
  id: idString,
  memberId: idString,
  type: z.enum(['UDL', 'UVL', 'point', 'moment']),
  w1: finiteNumber.optional(),
  w2: finiteNumber.optional(),
  P: finiteNumber.optional(),
  M: finiteNumber.optional(),
  a: z.number().min(0).max(1).optional(),
  direction: memberLoadDirectionSchema,
  startPos: z.number().min(0).max(1).optional().default(0),
  endPos: z.number().min(0).max(1).optional().default(1),
});

export const floorLoadSchema = z.object({
  id: idString,
  pressure: finiteNumber,
  yLevel: finiteNumber,
  xMin: finiteNumber,
  xMax: finiteNumber,
  zMin: finiteNumber,
  zMax: finiteNumber,
  distributionOverride: z.enum(['one_way', 'two_way_triangular', 'two_way_trapezoidal']).optional(),
  loadCase: z.string().optional(),
});

export const loadCaseSchema = z.object({
  id: idString,
  name: z.string().min(1),
  type: z.enum(['dead', 'live', 'wind', 'seismic', 'snow', 'temperature', 'self_weight', 'custom']),
  loads: z.array(z.object({
    id: z.string(),
    nodeId: z.string(),
    fx: finiteNumber.optional().default(0),
    fy: finiteNumber.optional().default(0),
    fz: finiteNumber.optional().default(0),
    mx: finiteNumber.optional().default(0),
    my: finiteNumber.optional().default(0),
    mz: finiteNumber.optional().default(0),
  })).optional().default([]),
  memberLoads: z.array(memberLoadSchema).optional().default([]),
  selfWeight: z.boolean().optional(),
  factor: finiteNumber.optional().default(1.0),
});

export const loadCombinationSchema = z.object({
  id: idString,
  name: z.string().min(1),
  code: z.string().optional(),
  factors: z.array(z.object({
    loadCaseId: z.string(),
    factor: finiteNumber,
  })),
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

  model.memberLoads.forEach((ml, idx) => {
    if (!memberIds.has(ml.memberId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Member load references unknown memberId: ${ml.memberId}`,
        path: ['memberLoads', idx, 'memberId'],
      });
    }
  });

  model.loads.forEach((load, idx) => {
    if (!nodeIds.has(load.nodeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Load references unknown nodeId: ${load.nodeId}`,
        path: ['loads', idx, 'nodeId'],
      });
    }
  });

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