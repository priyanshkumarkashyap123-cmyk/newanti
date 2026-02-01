/**
 * Steel Column Design Type Definitions
 * Per AISC 360-22 Chapters E, H
 * 
 * Includes:
 * - Column buckling (flexural, torsional)
 * - Compression strength
 * - Combined axial + bending (P-M interaction)
 * - Effective length factors
 */

import { SteelGrade, CompactnessClass } from '../beams/SteelBeamTypes';
import type { WShapeProperties, CalculationStep } from '../beams/SteelBeamTypes';

// Re-export common types
export { SteelGrade, CompactnessClass };
export type { WShapeProperties, CalculationStep };

/**
 * Column boundary conditions
 */
export enum BoundaryCondition {
  FIXED_FIXED = 'FIXED_FIXED',
  FIXED_PINNED = 'FIXED_PINNED',
  FIXED_FREE = 'FIXED_FREE',
  PINNED_PINNED = 'PINNED_PINNED',
  FIXED_ROLLER = 'FIXED_ROLLER',
}

/**
 * Frame type for effective length
 */
export enum FrameType {
  BRACED = 'BRACED',           // Sidesway inhibited
  UNBRACED = 'UNBRACED',       // Sidesway uninhibited
  MOMENT_FRAME = 'MOMENT_FRAME',
}

/**
 * Analysis method for K factor
 */
export enum KFactorMethod {
  THEORETICAL = 'THEORETICAL',
  RECOMMENDED = 'RECOMMENDED',
  ALIGNMENT_CHART = 'ALIGNMENT_CHART',
}

/**
 * Column limit state
 */
export type ColumnLimitState = 
  | 'YIELDING'
  | 'FLEXURAL_BUCKLING'
  | 'INELASTIC_BUCKLING'
  | 'ELASTIC_BUCKLING'
  | 'TORSIONAL_BUCKLING'
  | 'FLB'
  | 'LOCAL_BUCKLING';

/**
 * Theoretical K factors
 */
export const THEORETICAL_K_FACTORS: Record<BoundaryCondition, number> = {
  [BoundaryCondition.FIXED_FIXED]: 0.5,
  [BoundaryCondition.FIXED_PINNED]: 0.7,
  [BoundaryCondition.FIXED_FREE]: 2.0,
  [BoundaryCondition.PINNED_PINNED]: 1.0,
  [BoundaryCondition.FIXED_ROLLER]: 1.0,
};

/**
 * Recommended K factors (for design)
 */
export const RECOMMENDED_K_FACTORS: Record<BoundaryCondition, number> = {
  [BoundaryCondition.FIXED_FIXED]: 0.65,
  [BoundaryCondition.FIXED_PINNED]: 0.80,
  [BoundaryCondition.FIXED_FREE]: 2.10,
  [BoundaryCondition.PINNED_PINNED]: 1.0,
  [BoundaryCondition.FIXED_ROLLER]: 1.2,
};

/**
 * Steel column input parameters
 */
export interface SteelColumnInput {
  // Section properties
  section: WShapeProperties;
  
  // Material properties
  material: {
    grade: SteelGrade;
    Fy: number;  // ksi
    Fu: number;  // ksi
    E?: number;  // ksi (default 29000)
    G?: number;  // ksi (default 11200)
  };
  
  // Geometry
  geometry: {
    L: number;           // Unbraced length, ft
    Kx?: number;         // Effective length factor, x-axis
    Ky?: number;         // Effective length factor, y-axis
    Kz?: number;         // Effective length factor, torsional
    Lx?: number;         // Unbraced length x-axis, ft (if different)
    Ly?: number;         // Unbraced length y-axis, ft (if different)
    boundaryX?: BoundaryCondition;
    boundaryY?: BoundaryCondition;
    frameType?: FrameType;
  };
  
  // Applied loads
  loads: {
    Pu: number;          // Required axial strength, kips
    Mux?: number;        // Required moment strength x-axis, kip-ft
    Muy?: number;        // Required moment strength y-axis, kip-ft
    Cm_x?: number;       // Moment modification factor x-axis
    Cm_y?: number;       // Moment modification factor y-axis
  };
  
  // Design method
  designMethod: 'LRFD' | 'ASD';
  
  // Options
  checkPM?: boolean;     // Check P-M interaction
  secondOrder?: boolean; // Apply second-order amplification
}

/**
 * Compression strength result
 */
export interface CompressionStrengthResult {
  Pn: number;             // Nominal compression strength, kips
  phi_Pn: number;         // Design strength (LRFD), kips
  Pn_omega: number;       // Allowable strength (ASD), kips
  Pu: number;             // Required strength, kips
  ratio: number;          // Pu / capacity
  isAdequate: boolean;
  
  // Critical parameters
  Fcr: number;            // Critical stress, ksi
  Fe: number;             // Elastic buckling stress, ksi
  KL_r: number;           // Governing slenderness ratio
  KL_r_x: number;         // Slenderness ratio x-axis
  KL_r_y: number;         // Slenderness ratio y-axis
  
  // Effective lengths
  Kx: number;
  Ky: number;
  Lc_x: number;           // Effective length x-axis, ft
  Lc_y: number;           // Effective length y-axis, ft
  
  limitState: ColumnLimitState;
}

/**
 * P-M interaction result
 */
export interface PMInteractionResult {
  ratio: number;          // Interaction ratio
  isAdequate: boolean;
  
  // Compression
  Pu: number;
  Pc: number;             // Available compression strength
  Pu_Pc: number;          // Axial ratio
  
  // Bending
  Mux: number;
  Muy: number;
  Mcx: number;            // Available moment strength x-axis
  Mcy: number;            // Available moment strength y-axis
  
  // Amplified moments (second-order)
  Mrx?: number;           // Amplified moment x-axis
  Mry?: number;           // Amplified moment y-axis
  B1x?: number;           // Amplification factor x
  B1y?: number;           // Amplification factor y
  
  // Interaction equation used
  equation: 'H1-1a' | 'H1-1b';
}

/**
 * Element compactness for columns
 */
export interface ColumnCompactnessResult {
  flange: {
    class: CompactnessClass;
    lambda: number;
    lambda_r: number;
    Qs?: number;           // Slender element factor
  };
  web: {
    class: CompactnessClass;
    lambda: number;
    lambda_r: number;
    Qa?: number;           // Slender element factor
  };
  Q: number;               // Net reduction factor
}

/**
 * Complete column design result
 */
export interface SteelColumnResult {
  isAdequate: boolean;
  section: string;
  material: {
    grade: SteelGrade;
    Fy: number;
    Fu: number;
  };
  
  compactness: ColumnCompactnessResult;
  compression: CompressionStrengthResult;
  interaction?: PMInteractionResult;
  
  capacityRatios: {
    axial: number;
    interaction?: number;
    governing: number;
  };
  
  calculations: CalculationStep[];
  codeReference: string;
}

/**
 * Resistance factors for columns
 */
export const COLUMN_RESISTANCE_FACTORS = {
  phi_c: 0.90,    // Compression (LRFD)
  omega_c: 1.67,  // Compression (ASD)
  phi_b: 0.90,    // Flexure (LRFD)
  omega_b: 1.67,  // Flexure (ASD)
};

/**
 * Compression compactness limits
 * Per AISC 360-22 Table B4.1a
 */
export const COMPRESSION_COMPACTNESS_LIMITS = {
  // Flanges of rolled I-shapes
  flange_rolled: {
    lambda_r_factor: 0.56,  // 0.56√(E/Fy) - nonslender limit
  },
  // Webs of doubly symmetric I-shapes
  web_uniform: {
    lambda_r_factor: 1.49,  // 1.49√(E/Fy) - nonslender limit
  },
};

/**
 * Cm factors for different loading conditions
 */
export const CM_FACTORS = {
  // Members with transverse loading
  braced_no_transverse: 0.6,        // No transverse, single curvature
  braced_reverse_curvature: 0.85,   // No transverse, reverse curvature
  unbraced: 1.0,                    // Sidesway not prevented
  
  // Members with transverse loading (conservative)
  braced_transverse_pinned: 1.0,
  braced_transverse_fixed: 0.85,
};

/**
 * Common W-shapes for columns with additional properties
 */
export const W_SHAPES_COLUMNS: Record<string, WShapeProperties & { 
  rx: number;   // Radius of gyration x-axis, in
  ry: number;   // Radius of gyration y-axis, in
}> = {
  'W14X730': { designation: 'W14X730', weight: 730, A: 215, d: 22.4, bf: 17.9, tf: 4.91, tw: 3.07, Ix: 14300, Sx: 1280, Zx: 1660, Iy: 4720, Sy: 527, Zy: 816, J: 1710, Cw: 168000, rts: 5.41, ho: 17.5, rx: 8.17, ry: 4.69 },
  'W14X500': { designation: 'W14X500', weight: 500, A: 147, d: 19.6, bf: 17.0, tf: 3.50, tw: 2.19, Ix: 8210, Sx: 838, Zx: 1050, Iy: 2880, Sy: 339, Zy: 522, J: 644, Cw: 89300, rts: 5.17, ho: 16.1, rx: 7.48, ry: 4.43 },
  'W14X370': { designation: 'W14X370', weight: 370, A: 109, d: 17.9, bf: 16.5, tf: 2.66, tw: 1.66, Ix: 5440, Sx: 607, Zx: 736, Iy: 1990, Sy: 241, Zy: 370, J: 323, Cw: 56900, rts: 4.99, ho: 15.2, rx: 7.07, ry: 4.27 },
  'W14X283': { designation: 'W14X283', weight: 283, A: 83.3, d: 16.7, bf: 16.1, tf: 2.07, tw: 1.29, Ix: 3840, Sx: 459, Zx: 542, Iy: 1440, Sy: 179, Zy: 274, J: 179, Cw: 38200, rts: 4.85, ho: 14.6, rx: 6.79, ry: 4.17 },
  'W14X211': { designation: 'W14X211', weight: 211, A: 62.0, d: 15.7, bf: 15.8, tf: 1.56, tw: 0.980, Ix: 2660, Sx: 338, Zx: 390, Iy: 1030, Sy: 130, Zy: 198, J: 87.3, Cw: 25800, rts: 4.71, ho: 14.1, rx: 6.55, ry: 4.07 },
  'W14X159': { designation: 'W14X159', weight: 159, A: 46.7, d: 14.98, bf: 15.6, tf: 1.19, tw: 0.745, Ix: 1900, Sx: 254, Zx: 287, Iy: 748, Sy: 96.2, Zy: 146, J: 45.2, Cw: 17600, rts: 4.58, ho: 13.8, rx: 6.38, ry: 4.00 },
  'W14X120': { designation: 'W14X120', weight: 120, A: 35.3, d: 14.48, bf: 14.7, tf: 0.940, tw: 0.590, Ix: 1380, Sx: 190, Zx: 212, Iy: 495, Sy: 67.5, Zy: 102, J: 23.9, Cw: 11100, rts: 4.28, ho: 13.5, rx: 6.24, ry: 3.74 },
  'W14X90': { designation: 'W14X90', weight: 90, A: 26.5, d: 14.02, bf: 14.5, tf: 0.710, tw: 0.440, Ix: 999, Sx: 143, Zx: 157, Iy: 362, Sy: 49.9, Zy: 75.6, J: 11.7, Cw: 7780, rts: 4.15, ho: 13.3, rx: 6.14, ry: 3.70 },
  'W14X68': { designation: 'W14X68', weight: 68, A: 20.0, d: 14.04, bf: 10.0, tf: 0.720, tw: 0.415, Ix: 722, Sx: 103, Zx: 115, Iy: 121, Sy: 24.2, Zy: 36.9, J: 7.09, Cw: 2540, rts: 2.80, ho: 13.3, rx: 6.01, ry: 2.46 },
  'W14X48': { designation: 'W14X48', weight: 48, A: 14.1, d: 13.79, bf: 8.03, tf: 0.595, tw: 0.340, Ix: 484, Sx: 70.2, Zx: 78.4, Iy: 51.4, Sy: 12.8, Zy: 19.6, J: 3.26, Cw: 1090, rts: 2.22, ho: 13.2, rx: 5.85, ry: 1.91 },
  'W12X336': { designation: 'W12X336', weight: 336, A: 98.8, d: 16.8, bf: 13.4, tf: 2.96, tw: 1.78, Ix: 4060, Sx: 483, Zx: 603, Iy: 1190, Sy: 177, Zy: 274, J: 389, Cw: 25700, rts: 4.14, ho: 13.8, rx: 6.41, ry: 3.47 },
  'W12X252': { designation: 'W12X252', weight: 252, A: 74.0, d: 15.4, bf: 13.0, tf: 2.25, tw: 1.40, Ix: 2720, Sx: 353, Zx: 428, Iy: 828, Sy: 127, Zy: 196, J: 197, Cw: 16400, rts: 3.99, ho: 13.2, rx: 6.06, ry: 3.34 },
  'W12X190': { designation: 'W12X190', weight: 190, A: 55.8, d: 14.4, bf: 12.7, tf: 1.74, tw: 1.06, Ix: 1890, Sx: 263, Zx: 311, Iy: 589, Sy: 93.0, Zy: 143, J: 100, Cw: 10800, rts: 3.87, ho: 12.6, rx: 5.82, ry: 3.25 },
  'W12X152': { designation: 'W12X152', weight: 152, A: 44.7, d: 13.7, bf: 12.5, tf: 1.40, tw: 0.870, Ix: 1430, Sx: 209, Zx: 243, Iy: 454, Sy: 72.8, Zy: 111, J: 55.0, Cw: 7940, rts: 3.77, ho: 12.3, rx: 5.66, ry: 3.19 },
  'W12X120': { designation: 'W12X120', weight: 120, A: 35.2, d: 13.1, bf: 12.3, tf: 1.11, tw: 0.710, Ix: 1070, Sx: 163, Zx: 186, Iy: 345, Sy: 56.0, Zy: 85.4, J: 28.0, Cw: 5770, rts: 3.67, ho: 12.0, rx: 5.51, ry: 3.13 },
  'W12X96': { designation: 'W12X96', weight: 96, A: 28.2, d: 12.7, bf: 12.2, tf: 0.900, tw: 0.550, Ix: 833, Sx: 131, Zx: 147, Iy: 270, Sy: 44.4, Zy: 67.5, J: 16.8, Cw: 4350, rts: 3.59, ho: 11.8, rx: 5.44, ry: 3.09 },
  'W12X72': { designation: 'W12X72', weight: 72, A: 21.1, d: 12.3, bf: 12.0, tf: 0.670, tw: 0.430, Ix: 597, Sx: 97.4, Zx: 108, Iy: 195, Sy: 32.4, Zy: 49.2, J: 8.00, Cw: 3020, rts: 3.49, ho: 11.6, rx: 5.31, ry: 3.04 },
  'W12X53': { designation: 'W12X53', weight: 53, A: 15.6, d: 12.06, bf: 9.99, tf: 0.575, tw: 0.345, Ix: 425, Sx: 70.6, Zx: 77.9, Iy: 95.8, Sy: 19.2, Zy: 29.1, J: 4.00, Cw: 1450, rts: 2.82, ho: 11.5, rx: 5.23, ry: 2.48 },
  'W10X112': { designation: 'W10X112', weight: 112, A: 32.9, d: 11.4, bf: 10.4, tf: 1.25, tw: 0.755, Ix: 716, Sx: 126, Zx: 147, Iy: 236, Sy: 45.3, Zy: 69.2, J: 28.0, Cw: 3490, rts: 3.18, ho: 10.2, rx: 4.66, ry: 2.68 },
  'W10X88': { designation: 'W10X88', weight: 88, A: 25.9, d: 10.8, bf: 10.3, tf: 0.990, tw: 0.605, Ix: 534, Sx: 98.5, Zx: 113, Iy: 179, Sy: 34.8, Zy: 53.1, J: 15.0, Cw: 2500, rts: 3.10, ho: 9.84, rx: 4.54, ry: 2.63 },
  'W10X68': { designation: 'W10X68', weight: 68, A: 20.0, d: 10.4, bf: 10.1, tf: 0.770, tw: 0.470, Ix: 394, Sx: 75.7, Zx: 85.3, Iy: 134, Sy: 26.4, Zy: 40.1, J: 7.78, Cw: 1780, rts: 3.02, ho: 9.62, rx: 4.44, ry: 2.59 },
  'W10X49': { designation: 'W10X49', weight: 49, A: 14.4, d: 9.98, bf: 10.0, tf: 0.560, tw: 0.340, Ix: 272, Sx: 54.6, Zx: 60.4, Iy: 93.4, Sy: 18.7, Zy: 28.3, J: 3.26, Cw: 1170, rts: 2.92, ho: 9.42, rx: 4.35, ry: 2.54 },
  'W10X33': { designation: 'W10X33', weight: 33, A: 9.71, d: 9.73, bf: 7.96, tf: 0.435, tw: 0.290, Ix: 171, Sx: 35.0, Zx: 38.8, Iy: 36.6, Sy: 9.20, Zy: 14.0, J: 1.22, Cw: 481, rts: 2.19, ho: 9.30, rx: 4.19, ry: 1.94 },
  'W8X67': { designation: 'W8X67', weight: 67, A: 19.7, d: 9.00, bf: 8.28, tf: 0.935, tw: 0.570, Ix: 272, Sx: 60.4, Zx: 70.1, Iy: 88.6, Sy: 21.4, Zy: 32.7, J: 10.0, Cw: 1050, rts: 2.53, ho: 8.07, rx: 3.72, ry: 2.12 },
  'W8X48': { designation: 'W8X48', weight: 48, A: 14.1, d: 8.50, bf: 8.11, tf: 0.685, tw: 0.400, Ix: 184, Sx: 43.2, Zx: 49.0, Iy: 60.9, Sy: 15.0, Zy: 22.9, J: 4.52, Cw: 679, rts: 2.45, ho: 7.82, rx: 3.61, ry: 2.08 },
  'W8X31': { designation: 'W8X31', weight: 31, A: 9.13, d: 8.00, bf: 7.99, tf: 0.435, tw: 0.285, Ix: 110, Sx: 27.5, Zx: 30.4, Iy: 37.1, Sy: 9.27, Zy: 14.1, J: 1.34, Cw: 395, rts: 2.34, ho: 7.57, rx: 3.47, ry: 2.02 },
};
