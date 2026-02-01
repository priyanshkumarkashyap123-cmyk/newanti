/**
 * ============================================================================
 * CORE ENGINEERING MODULES - INDEX
 * ============================================================================
 * 
 * Central export point for all core engineering utilities.
 * 
 * @version 3.0.0
 */

// Precision Mathematics
export {
  PrecisionMath,
  UnitConverter,
  EngineeringMath,
  ValidationUtils,
  ENGINEERING_CONSTANTS,
  type ValidationResult as PrecisionValidationResult,
} from './PrecisionMath';

// Error Handling
export {
  EngineeringErrorHandler,
  ErrorSeverity,
  ErrorCategory,
  ERROR_CODES,
  type EngineeringError,
} from './EngineeringErrorHandler';

// Steel Design
export {
  AdvancedSteelDesignEngine,
  createSteelDesignEngine,
  STEEL_GRADES,
  type SteelDesignCode,
  type SectionType,
  type MemberType,
  type SteelGrade,
  type SectionProperties,
  type MemberLoads,
  type BracingCondition,
  type SteelDesignConfig,
  type SteelDesignResult,
  type DesignCheckResult,
} from './AdvancedSteelDesignEngine';

// Concrete Design
export {
  AdvancedConcreteDesignEngine,
  createConcreteDesignEngine,
  CONCRETE_GRADES,
  REBAR_GRADES,
  STANDARD_BAR_DIAMETERS,
  type ConcreteDesignCode,
  type MemberType as ConcreteMemberType,
  type BeamType,
  type ColumnType,
  type SlabType,
  type ExposureCondition,
  type ConcreteGrade,
  type RebarGrade,
  type BeamSection,
  type ColumnSection,
  type SlabSection,
  type DesignLoads,
  type ReinforcementResult,
  type ConcreteDesignResult,
} from './AdvancedConcreteDesignEngine';

// Structural Analysis
export {
  AdvancedStructuralAnalysisEngine,
  createStructuralAnalysis,
  type AnalysisType,
  type SupportType,
  type LoadType,
  type Node,
  type Member,
  type PointLoad,
  type DistributedLoad,
  type MomentLoad,
  type Load,
  type LoadCombination as StructuralLoadCombination,
  type AnalysisInput,
  type NodeDisplacement,
  type MemberForce,
  type Reaction,
  type AnalysisResult,
} from './AdvancedStructuralAnalysisEngine';

// Load Combinations
export {
  AdvancedLoadCombinationEngine,
  createLoadCombinationEngine,
  type LoadCombinationCode,
  type LoadCategory,
  type LimitState,
  type OccupancyCategory,
  type LoadCase,
  type LoadFactor,
  type LoadCombination,
  type CombinedLoads,
  type LiveLoadReductionParams,
  type LoadCombinationConfig,
} from './AdvancedLoadCombinationEngine';

// Foundation Design
export {
  AdvancedFoundationDesignEngine,
  createFoundationDesignEngine,
  SOIL_CONSTANTS,
  FOUNDATION_CODE_FACTORS,
  type FoundationCode,
  type FoundationType,
  type PileType,
  type SoilType,
  type SoilProfile,
  type SoilLayer,
  type IsolatedFootingInput,
  type BearingCapacityResult,
  type IsolatedFootingResult,
} from './AdvancedFoundationDesignEngine';

// Connection Design
export {
  AdvancedConnectionDesignEngine,
  createConnectionDesignEngine,
  BOLT_PROPERTIES,
  CONNECTION_CODE_FACTORS,
  type ConnectionCode,
  type ConnectionType,
  type BoltGrade,
  type WeldType,
  type BoltedShearConnectionInput,
  type WeldedConnectionInput,
  type BoltedConnectionResult,
  type WeldedConnectionResult,
} from './AdvancedConnectionDesignEngine';

// Wind Load Analysis
export {
  AdvancedWindLoadEngine,
  createWindLoadEngine,
  IS875_RISK_COEFFICIENTS,
  IS875_TERRAIN_FACTORS,
  PRESSURE_COEFFICIENTS,
  INTERNAL_PRESSURE_COEFFICIENTS,
  ASCE7_KZ_FACTORS,
  type WindLoadCode,
  type TerrainCategory,
  type BuildingClass,
  type RoofType,
  type StructureType,
  type WindSiteData,
  type BuildingGeometry,
  type WindPressureResult,
  type WindForceResult,
  type WindLoadResult,
} from './AdvancedWindLoadEngine';

// Finite Element Analysis
export {
  AdvancedFEAEngine,
  createFEAEngine,
  type ElementType,
  type AnalysisType2 as FEAAnalysisType,
  type MaterialModel,
  type FEANode,
  type FEAMaterial,
  type FEASection,
  type FEAElement,
  type NodeDisplacement as FEANodeDisplacement,
  type ElementStress,
  type ElementStrain,
  type FEAResult,
  type MeshConfig,
} from './AdvancedFEAEngine';

// Stability Analysis
export {
  AdvancedStabilityEngine,
  createStabilityEngine,
  EFFECTIVE_LENGTH_FACTORS,
  IS800_BUCKLING_CURVES,
  EN1993_IMPERFECTION_FACTORS,
  SECTION_CLASS_LIMITS,
  type StabilityCode,
  type BucklingMode,
  type EndCondition,
  type FrameType,
  type SectionClass,
  type MemberProperties,
  type BucklingInput,
  type EffectiveLengthResult,
  type EulerBucklingResult,
  type InelasticBucklingResult,
  type LTBResult as StabilityLTBResult,
  type LocalBucklingResult,
  type FrameStabilityResult,
  type StabilityAnalysisResult,
} from './AdvancedStabilityEngine';

// Dynamic Analysis
export {
  AdvancedDynamicEngine,
  createDynamicEngine,
  generateIS1893Spectrum,
  generateSyntheticGroundMotion,
  IS1893_SPECTRUM,
  ASCE7_SITE_COEFFICIENTS,
  NEWMARK_PARAMS,
  type DynamicAnalysisType,
  type IntegrationMethod,
  type DampingType,
  type MassMatrix,
  type StiffnessMatrix,
  type DampingMatrix,
  type TimeHistoryInput,
  type ResponseSpectrumInput,
  type ModalProperties,
  type TimeHistoryResult,
  type ResponseSpectrumResult,
  type HarmonicResult,
  type DynamicAnalysisResult,
  type StructuralSystem,
} from './AdvancedDynamicEngine';

// Utility Types
export interface CalculationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: EngineeringError[];
  warnings?: string[];
  metadata?: {
    calculationTime: number;
    engine: string;
    version: string;
  };
}

// Engineering Units
export const UNITS = {
  force: {
    N: 1,
    kN: 1000,
    MN: 1000000,
    kgf: 9.80665,
    lbf: 4.44822,
    kip: 4448.22,
  },
  length: {
    mm: 1,
    cm: 10,
    m: 1000,
    in: 25.4,
    ft: 304.8,
  },
  stress: {
    Pa: 1,
    kPa: 1000,
    MPa: 1000000,
    GPa: 1000000000,
    psi: 6894.76,
    ksi: 6894760,
  },
  moment: {
    'N·mm': 1,
    'N·m': 1000,
    'kN·m': 1000000,
    'kN·mm': 1000,
    'kip·ft': 1355817.95,
    'kip·in': 112984.83,
  },
} as const;

// ============================================================================
// PHASE 1 EXTENSIONS
// ============================================================================

// Seismic Extensions
export {
  calculateAccidentalTorsion,
  detectIrregularities,
  checkDiaphragmFlexibility,
  type PDeltaResult,
  type ModalCombinationResult,
  type DiaphragmFlexibilityResult,
  type IrregularityCheck,
} from './SeismicExtensions';

// Steel Extensions
export {
  calculateLTB,
  designBoltConnection,
  calculateBlockShear,
  designFilletWeld,
  designBasePlate,
  type BlockShearResult,
} from './SteelExtensions';

// Concrete Extensions
export {
  designShearIS456,
  checkPunchingShear,
  calculateCrackWidth,
  calculateDevelopmentLength,
  getCoverRequirements,
  type ShearDesignResult,
  type PunchingShearResult,
  type CrackWidthResult,
  type DevelopmentLengthResult,
} from './ConcreteExtensions';

// Geotech Extensions
export {
  calculateNegativeSkinFriction,
  calculateSettlement,
  assessLiquefaction,
  type SeismicEarthPressureResult,
  type NegativeSkinFrictionResult,
  type SettlementResult,
  type LiquefactionResult,
} from './GeotechExtensions';

// Offshore Extensions
export {
  calculateFatigueDamage,
  rainflowCount,
  calculateMorisonForce,
  checkNaturalFrequency,
  getOffshoreLoadCombinations,
  DNV_LOAD_COMBINATIONS,
  type FatigueResult,
  type StressRange,
  type MorisonResult,
  type NaturalFrequencyResult,
  type OffshoreLoadCombination,
} from './OffshoreExtensions';

// Security Middleware
export {
  RateLimiter,
  RateLimiters,
  auditLogger,
  validateInputs,
  ValidationSchemas,
  secureCalculation,
  createThrottler,
  type RateLimitResult,
  type AuditLogEntry,
  type AuditAction,
  type ValidationRule,
  type SecureCalculationOptions,
} from './SecurityMiddleware';

// ============================================================================
// PHASE 2 EXTENSIONS
// ============================================================================

// Report Generator
export {
  ReportBuilder,
  buildClauseCitation,
  formatClauseTable,
  calculateDCR,
  buildDCRTable,
  formatDCRTable,
  createBeamDesignReport,
  DESIGN_CODE_REFERENCES,
  type ReportSection,
  type ReportContent,
  type ReportMetadata,
  type CalculationReport,
  type Reference,
  type ClauseCitation,
  type DCREntry,
} from './ReportGenerator';

// AI Guardrails
export {
  AIGuardrails,
  guardrails,
  validateBeamInputs,
  validateSeismicInputs,
  validatePileInputs,
  getConfidenceLabel,
  STRUCTURAL_BOUNDS,
  type GuardrailCheck,
  type GuardrailResult,
  type ParameterBounds,
} from './AIGuardrails';

// Calculation Cache
export {
  CalculationCache,
  structuralCache,
  seismicCache,
  modalCache,
  geotechCache,
  pruneAllCaches,
  getAllCacheStats,
  clearAllCaches,
  type CacheEntry,
  type CacheStats,
  type CacheConfig,
} from './CalculationCache';

// Calculation Worker
export {
  CalculationWorkerPool,
  getWorkerPool,
  initializeWorkerPool,
  executeWithWorkerFallback,
  type WorkerTask,
  type WorkerResult,
  type WorkerError,
  type WorkerResponse,
  type WorkerPoolConfig,
} from './CalculationWorker';

// ============================================================================
// PHASE 3 EXTENSIONS
// ============================================================================

// Composite Design (Stub)
export {
  designCompositeBeam,
  designCompositeColumn,
  calculateStudCapacity,
  calculateEffectiveSlabWidth,
  type CompositeBeamInput,
  type CompositeBeamResult,
  type CompositeColumnInput,
  type CompositeColumnResult,
} from './CompositeDesignEngine';

// Timber Design (Stub)
export {
  designTimberBeam,
  designTimberColumn,
  designTimberConnection,
  LOAD_DURATION_FACTORS,
  KMOD_VALUES,
  type TimberGrade,
  type TimberSpecies,
  type TimberMemberInput,
  type TimberBeamResult,
  type TimberColumnResult,
  type TimberConnectionInput,
  type TimberConnectionResult,
} from './TimberDesignEngine';

// Stamping Workflow
export {
  StampingWorkflow,
  stampingWorkflow,
  getRecommendedStampPlacement,
  DISCLAIMER_TEMPLATES,
  type DocumentStatus,
  type ReviewAction,
  type ProfessionalEngineer,
  type DocumentMetadata,
  type ReviewComment,
  type WorkflowEvent,
  type StampRecord,
  type StampPlacement,
} from './StampingWorkflow';

// Type alias for backwards compatibility
export type ValidationResultLegacy = import('./SecurityMiddleware').ValidationRule;

// Version Info
export const CORE_VERSION = '4.2.0';
export const CORE_BUILD_DATE = '2025-01-15';
export const ENGINE_CAPABILITIES = {
  structural: ['2D_frame', '3D_frame', 'truss', 'continuous_beam', 'portal_frame', 'P-Delta', 'modal'],
  concrete: ['beam', 'column', 'slab', 'footing', 'retaining_wall', 'shear', 'punching', 'crack_width'],
  steel: ['tension', 'compression', 'flexure', 'combined', 'connections', 'LTB', 'block_shear'],
  foundation: ['isolated_footing', 'combined_footing', 'raft', 'pile', 'bearing_capacity', 'settlement', 'liquefaction'],
  connection: ['bolted', 'welded', 'base_plate', 'moment', 'shear'],
  wind: ['IS875', 'ASCE7', 'EN1991', 'AS1170'],
  fea: ['TRI3', 'QUAD4', 'PLATE4', 'BEAM2D', 'TRUSS2D'],
  stability: ['flexural', 'torsional', 'LTB', 'local_buckling', 'frame_stability', 'P-Delta'],
  dynamic: ['modal', 'time_history', 'response_spectrum', 'harmonic', 'CQC', 'SRSS'],
  seismic: ['base_shear', 'torsion', 'vertical_EQ', 'P-Delta', 'irregularity', 'diaphragm'],
  offshore: ['fatigue', 'hydrodynamics', 'natural_frequency', 'ULS', 'FLS'],
  composite: ['beam', 'column', 'stud_capacity', 'effective_width'],
  timber: ['beam', 'column', 'connection', 'NDS', 'EN1995'],
  governance: ['stamping', 'review', 'audit_trail', 'versioning'],
} as const;

// Type guard utilities
export const isEngineeringError = (obj: unknown): obj is EngineeringError => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'code' in obj &&
    'message' in obj &&
    'severity' in obj
  );
};

import type { EngineeringError } from './EngineeringErrorHandler';
