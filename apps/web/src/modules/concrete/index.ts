/**
 * ============================================================================
 * RC DESIGN MODULE - MAIN EXPORTS
 * ============================================================================
 * 
 * Complete Reinforced Concrete Design System
 * Supporting IS 456, ACI 318, EN 1992, and AS 3600
 * 
 * @version 1.0.0
 * @author Head of Engineering
 */

// =============================================================================
// EXISTING MODULES
// =============================================================================

// Deep Beams / Strut-and-Tie
export * from './deep-beams';

// =============================================================================
// DESIGN CONSTANTS & MATERIALS
// =============================================================================

export {
  // Types
  type DesignCode,
  type ExposureClass,
  type ConcreteGrade,
  type SteelGrade,
  type RebarSize,
  type CoverRequirement,
  type PartialSafetyFactors,
  
  // Constants
  REBAR_SIZES,
  CONCRETE_GRADES_IS456,
  CONCRETE_GRADES_ACI318,
  CONCRETE_GRADES_EN1992,
  STEEL_GRADES_IS456,
  STEEL_GRADES_ACI318,
  STEEL_GRADES_EN1992,
  SAFETY_FACTORS,
  ACI_PHI_FACTORS,
  STRESS_BLOCK,
  DESIGN_LIMITS,
  COVER_REQUIREMENTS_IS456,
  
  // Utility Functions
  getRebarByDiameter,
  calculateRebarArea,
  getConcreteGrades,
  getSteelGrades,
  selectBars,
  getDesignStrength,
  getDesignYieldStrength,
} from './RCDesignConstants';

// Re-export aliases for backwards compatibility  
export { CONCRETE_GRADES_IS456 as CONCRETE_GRADES_AS3600 } from './RCDesignConstants';
export { STEEL_GRADES_IS456 as STEEL_GRADES_AS3600 } from './RCDesignConstants';
export { COVER_REQUIREMENTS_IS456 as COVER_REQUIREMENTS } from './RCDesignConstants';

// =============================================================================
// BEAM DESIGN ENGINE
// =============================================================================

export {
  // Types
  type BeamType,
  type BeamGeometry,
  type BeamLoading,
  type BeamMaterials,
  type FlexuralDesignResult,
  type ShearDesignResult,
  type TorsionDesignResult,
  type DeflectionCheckResult,
  type CrackWidthResult,
  type BeamDesignResult,
  
  // Engine Class
  RCBeamDesignEngine,
  
  // Factory Functions
  designRectangularBeam,
  designTBeam,
} from './RCBeamDesignEngine';

// Re-export type aliases for backwards compatibility
export type DeflectionResult = import('./RCBeamDesignEngine').DeflectionCheckResult;
export type BeamDesignInput = import('./RCBeamDesignEngine').BeamMaterials;

// =============================================================================
// COLUMN DESIGN ENGINE
// =============================================================================

export {
  // Types
  type ColumnType,
  type ColumnGeometry,
  type ColumnLoading,
  type ColumnMaterials,
  type SlendernessResult,
  type ColumnDesignResult,
  type InteractionPoint,
  
  // Engine Class
  RCColumnDesignEngine,
  
  // Factory Function
  designRectangularColumn,
} from './RCColumnDesignEngine';

// Backward compat type aliases for column module
export type InteractionDiagramPoint = import('./RCColumnDesignEngine').InteractionPoint;
export type ColumnDesignInput = import('./RCColumnDesignEngine').ColumnMaterials;

// =============================================================================
// SLAB DESIGN ENGINE
// =============================================================================

export {
  // Types
  type SlabType,
  type SupportCondition,
  type SlabGeometry,
  type SlabLoading,
  type SlabMaterials,
  type MomentCoefficients,
  type SlabMoments,
  type SlabReinforcementResult,
  type PunchingShearResult,
  type SlabDesignResult,
  
  // Engine Class
  RCSlabDesignEngine,
  
  // Factory Functions
  designTwoWaySlab,
  designFlatSlab,
} from './RCSlabDesignEngine';

// Backward compat type aliases for slab module
export type SlabDesignInput = import('./RCSlabDesignEngine').SlabMaterials;
export const IS456_MOMENT_COEFFICIENTS = {}; // Placeholder for backwards compat

// =============================================================================
// FOOTING DESIGN ENGINE
// =============================================================================

export {
  // Types
  type FootingType,
  type SoilType,
  type FootingGeometry,
  type FootingLoading,
  type SoilProperties,
  type FootingMaterials,
  type BearingPressureResult,
  type OneWayShearResult,
  type TwoWayShearResult,
  type FootingReinforcementResult,
  type DevelopmentLengthResult as FootingDevelopmentLengthResult,
  type FootingDesignResult,
  
  // Engine Class
  RCFootingDesignEngine,
  
  // Factory Functions
  designIsolatedFooting,
  designRectangularFooting,
} from './RCFootingDesignEngine';

// Backward compat type alias for footing module
export type FootingDesignInput = import('./RCFootingDesignEngine').FootingMaterials;

// =============================================================================
// SPECIAL STRUCTURES ENGINE
// =============================================================================

export {
  // Retaining Wall Types
  type RetainingWallType,
  type BackfillType,
  type RetainingWallGeometry,
  type BackfillProperties,
  type FoundationSoil,
  type RetainingWallMaterials,
  type EarthPressureResult,
  type StabilityResult,
  type StemDesignResult,
  type BaseSlabDesignResult,
  type RetainingWallDesignResult,
  
  // Water Tank Types
  type TankType,
  type TankCondition,
  type TankGeometry,
  type TankLoading,
  type TankDesignResult,
  
  // Staircase Types
  type StaircaseType,
  type StaircaseGeometry,
  type StaircaseLoading,
  type StaircaseDesignResult,
  
  // Engine Classes
  RCRetainingWallEngine,
  RCWaterTankEngine,
  RCStaircaseEngine,
  
  // Factory Functions
  designCantileverRetainingWall,
  designRectangularWaterTank,
  designDogLeggedStaircase,
} from './RCSpecialStructuresEngine';

// =============================================================================
// PRESTRESSED CONCRETE ENGINE
// =============================================================================

export {
  // Types
  type PrestressType,
  type TendonType,
  type TendonProfile,
  type BondType,
  type StressClass,
  type PrestressingStrand,
  type PrestressedSectionGeometry,
  type TendonLayout,
  type PrestressedMaterials,
  type ImmediateLosses,
  type TimeDependentLosses,
  type TotalLosses,
  type StressCheckResult,
  type UltimateCapacityResult,
  type PrestressedShearResult,
  type PrestressedDeflectionResult,
  type PrestressedDesignInput,
  type PrestressedDesignResult,
  
  // Constants
  PRESTRESSING_STRANDS,
  STRESS_LIMITS,
  
  // Engine Class
  PrestressedConcreteEngine,
  
  // Factory Functions
  designPretensionedBeam,
  designPosttensionedBeam,
  calculatePrestressLosses,
} from './PrestressedConcreteEngine';

// =============================================================================
// CONVENIENCE AGGREGATES
// =============================================================================

import type { DesignCode } from './RCDesignConstants';

/**
 * Quick design functions for common elements
 */
export const QuickDesign = {
  beam: async (b: number, D: number, L: number, Mu: number, Vu: number, fck: number, fy: number, code: DesignCode = 'IS456') => {
    const { designRectangularBeam } = await import('./RCBeamDesignEngine');
    return designRectangularBeam(b, D, L, Mu, Vu, fck, fy, code);
  },
  
  column: async (b: number, D: number, L: number, Pu: number, Mux: number, Muy: number, fck: number, fy: number, code: DesignCode = 'IS456') => {
    const { designRectangularColumn } = await import('./RCColumnDesignEngine');
    return designRectangularColumn(b, D, L, Pu, Mux, Muy, fck, fy, code);
  },
  
  slab: async (Lx: number, Ly: number, D: number, deadLoad: number, liveLoad: number, fck: number, fy: number, support?: string, code: DesignCode = 'IS456') => {
    const { designTwoWaySlab } = await import('./RCSlabDesignEngine');
    return designTwoWaySlab(Lx, Ly, D, deadLoad, liveLoad, fck, fy, support as any, code);
  },
  
  footing: async (P: number, M: number, SBC: number, fck: number, fy: number, code: DesignCode = 'IS456') => {
    const { designIsolatedFooting } = await import('./RCFootingDesignEngine');
    return designIsolatedFooting(P, M, SBC, fck, fy, code);
  },
  
  retainingWall: async (height: number, backfillAngle: number, backfillWeight: number, SBC: number, fck: number, fy: number, code: DesignCode = 'IS456') => {
    const { designCantileverRetainingWall } = await import('./RCSpecialStructuresEngine');
    return designCantileverRetainingWall(height, backfillAngle, backfillWeight, SBC, fck, fy, code);
  },
  
  waterTank: async (L: number, B: number, H: number, fck: number, fy: number, code?: DesignCode) => {
    const { designRectangularWaterTank } = await import('./RCSpecialStructuresEngine');
    return designRectangularWaterTank(L, B, H, fck, fy, code);
  },
  
  staircase: async (floorHeight: number, stairWidth: number, fck: number, fy: number, code?: DesignCode) => {
    const { designDogLeggedStaircase } = await import('./RCSpecialStructuresEngine');
    return designDogLeggedStaircase(floorHeight, stairWidth, fck, fy, code);
  },
  
  pretensionedBeam: async (b: number, h: number, span: number, deadLoad: number, liveLoad: number, numStrands: number, eccentricity: number, fci?: number, fc28?: number, code?: DesignCode) => {
    const { designPretensionedBeam } = await import('./PrestressedConcreteEngine');
    return designPretensionedBeam(b, h, span, deadLoad, liveLoad, numStrands, eccentricity, fci, fc28, code);
  },
  
  posttensionedBeam: async (sectionType: 'rectangular' | 'I-section' | 'T-section' | 'box', dimensions: any, span: number, deadLoad: number, liveLoad: number, numStrands: number, e_end: number, e_mid: number, profile?: any, fci?: number, fc28?: number, code?: DesignCode) => {
    const { designPosttensionedBeam } = await import('./PrestressedConcreteEngine');
    return designPosttensionedBeam(sectionType, dimensions, span, deadLoad, liveLoad, numStrands, e_end, e_mid, profile, fci, fc28, code);
  },
};

/**
 * Version information
 */
export const RC_DESIGN_VERSION = {
  version: '1.1.0',
  releaseDate: '2025-01-25',
  supportedCodes: ['IS 456:2000', 'IS 1343:2012', 'ACI 318-19', 'EN 1992-1-1:2004', 'AS 3600:2018'],
  modules: [
    'RCDesignConstants',
    'RCBeamDesignEngine',
    'RCColumnDesignEngine',
    'RCSlabDesignEngine',
    'RCFootingDesignEngine',
    'RCSpecialStructuresEngine',
    'PrestressedConcreteEngine',
  ],
  elements: [
    'Rectangular Beam',
    'T-Beam',
    'L-Beam',
    'Rectangular Column',
    'Circular Column',
    'One-Way Slab',
    'Two-Way Slab',
    'Flat Slab',
    'Ribbed Slab',
    'Isolated Footing',
    'Combined Footing',
    'Cantilever Retaining Wall',
    'Counterfort Retaining Wall',
    'Rectangular Water Tank',
    'Dog-Legged Staircase',
    'Pre-tensioned Beam',
    'Post-tensioned Beam',
    'Post-tensioned I-Girder',
    'Post-tensioned Box Girder',
  ],
  features: [
    'Multi-code support',
    'Real-time calculations',
    'Reinforcement optimization',
    'Bar bending schedules',
    'Interaction diagrams',
    'Crack width checks',
    'Deflection verification',
    'Punching shear analysis',
    'Slenderness analysis',
    'Stability checks',
    'Prestress loss calculations',
    'Stress checks at transfer & service',
    'Ultimate capacity analysis',
    'Tendon profile optimization',
    'Camber and deflection prediction',
  ],
};
