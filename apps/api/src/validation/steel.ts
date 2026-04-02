import { z } from 'zod';
import { finiteNumber, positiveNumber } from './common.js';

export const sectionPropertiesSchema = z.object({
  name: z.string().min(1),
  area: positiveNumber,
  depth: positiveNumber,
  width: positiveNumber,
  webThickness: positiveNumber,
  flangeThickness: positiveNumber,
  Iy: positiveNumber,
  Iz: positiveNumber,
  Zy: positiveNumber.optional(),
  Zz: positiveNumber.optional(),
  ry: positiveNumber,
  rz: positiveNumber,
});

export const designForcesSchema = z.object({
  N: finiteNumber,
  Vy: finiteNumber,
  Vz: finiteNumber,
  My: finiteNumber,
  Mz: finiteNumber,
  T: finiteNumber.optional().default(0),
});

export const steelDesignSchema = z.object({
  section: sectionPropertiesSchema,
  forces: designForcesSchema,
  code: z.enum(['IS_800', 'AISC_360', 'EC3']).optional().default('IS_800'),
  designType: z.enum(['LRFD', 'ASD']).optional().default('LRFD'),
});

export const connectionDesignSchema = z.object({
  type: z.enum(['bolted', 'welded']),
  bolts: z.object({
    grade: z.string().optional(),
    diameter: positiveNumber.optional(),
  }).optional(),
  weld: z.object({
    size: positiveNumber.optional(),
    length: positiveNumber.optional(),
  }).optional(),
  forces: designForcesSchema,
});