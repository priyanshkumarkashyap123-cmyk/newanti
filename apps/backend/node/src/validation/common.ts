import { z } from 'zod';

export const idString = z.union([z.string(), z.number()]).transform(String);

export const boolDefaultFalse = z.boolean().optional().default(false);

export const nonNegativeNumber = z.number().nonnegative();

export const finiteNumber = z.number().finite();

export const positiveNumber = z.number().positive();

export const materialSchema = z.object({
  id: idString,
  family: z.enum(['steel', 'concrete', 'composite', 'timber', 'custom']),
  E_kN_m2: positiveNumber,
  nu: z.number().positive().lt(0.5),
  G_kN_m2: positiveNumber.optional(),
  rho_kg_m3: positiveNumber.optional(),
  fy_mpa: positiveNumber.optional(),
  fck_mpa: positiveNumber.optional(),
});

export const offsetVectorSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
});

export const propertyReductionFactorsSchema = z.object({
  axial: z.number().min(0).max(1).optional(),
  shearY: z.number().min(0).max(1).optional(),
  shearZ: z.number().min(0).max(1).optional(),
  torsion: z.number().min(0).max(1).optional(),
  bendingY: z.number().min(0).max(1).optional(),
  bendingZ: z.number().min(0).max(1).optional(),
});

export const orientationSchema = z.object({
  betaAngleDeg: finiteNumber.optional().default(0),
});

export const memberLoadDirectionSchema = z.enum([
  'local_x', 'local_y', 'local_z',
  'global_x', 'global_y', 'global_z', 'axial',
]);

export const restraintsSchema = z.object({
  fx: boolDefaultFalse,
  fy: boolDefaultFalse,
  fz: boolDefaultFalse,
  mx: boolDefaultFalse,
  my: boolDefaultFalse,
  mz: boolDefaultFalse,
}).optional();

export const sectionMechanicsSchema = z.object({
  area_m2: positiveNumber,
  iyy_m4: positiveNumber,
  izz_m4: positiveNumber,
  j_m4: positiveNumber,
  ay_m2: positiveNumber.optional(),
  az_m2: positiveNumber.optional(),
  zy_m3: positiveNumber.optional(),
  zz_m3: positiveNumber.optional(),
  zpy_m3: positiveNumber.optional(),
  zpz_m3: positiveNumber.optional(),
  ry_m: positiveNumber.optional(),
  rz_m: positiveNumber.optional(),
});

export const propertyAssignmentScopeSchema = z.object({
  mode: z.enum(['selected', 'view', 'cursor', 'group', 'manual_range']),
  memberIds: z.array(idString).optional().default([]),
  groupIds: z.array(z.string().min(1)).optional().default([]),
  manualRange: z.string().min(1).optional(),
});

export const behaviorSchema = z.object({
  tensionOnly: z.boolean().optional().default(false),
  compressionOnly: z.boolean().optional().default(false),
}).optional();

export const offsetsSchema = z.object({
  startGlobal_m: offsetVectorSchema.optional(),
  endGlobal_m: offsetVectorSchema.optional(),
  startLocal_m: offsetVectorSchema.optional(),
  endLocal_m: offsetVectorSchema.optional(),
}).optional();

export const orientationAndOffsets = z.object({
  orientation: orientationSchema.optional(),
  offsets: offsetsSchema.optional(),
});

export const loadSchema = z.object({
  nodeId: idString,
  fx: finiteNumber.optional().default(0),
  fy: finiteNumber.optional().default(0),
  fz: finiteNumber.optional().default(0),
  mx: finiteNumber.optional().default(0),
  my: finiteNumber.optional().default(0),
  mz: finiteNumber.optional().default(0),
});

export const windProfileSchema = z.object({
  code: z.enum(['IS_875_3', 'ASCE_7', 'EC1']).optional().default('IS_875_3'),
  basicWindSpeed_m_s: positiveNumber,
  terrainCategory: z.number().int().min(1).max(4),
  buildingClass: z.enum(['A', 'B', 'C']).optional().default('B'),
  topography: z.enum(['flat', 'hill', 'ridge', 'cliff']).optional().default('flat'),
  riskCoefficient: positiveNumber.optional().default(1.0),
  heightPressures: z.array(z.object({
    height_m: nonNegativeNumber,
    pressure_kN_m2: finiteNumber,
  })).optional(),
});

export const seismicProfileSchema = z.object({
  code: z.enum(['IS_1893', 'ASCE_7', 'EC8']).optional().default('IS_1893'),
  zone: z.enum(['II', 'III', 'IV', 'V']),
  soilType: z.enum(['hard', 'medium', 'soft']),
  importanceFactor: positiveNumber,
  responseReduction: positiveNumber,
  buildingHeight_m: positiveNumber,
  buildingType: z.enum(['rc_frame', 'steel_frame', 'masonry', 'infill']).optional().default('rc_frame'),
  baseDimension_m: positiveNumber.optional(),
  storyWeights: z.array(z.object({
    storyId: z.string(),
    height_m: positiveNumber,
    weight_kN: positiveNumber,
  })).optional(),
});