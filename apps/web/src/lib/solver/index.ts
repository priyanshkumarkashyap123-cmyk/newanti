/**
 * Ultra-Fast Structural Analysis Solver Suite
 * 
 * Performance Targets:
 * - 20 nodes:   < 100μs  (0.1ms)
 * - 100 nodes:  < 1ms
 * - 1000 nodes: < 10ms
 * 
 * Components:
 * - HybridAnalysisEngine: Auto-selects optimal solver
 * - GPUAcceleratedSolver: WebGPU compute shaders
 * - UltraFastBenchmark: Performance testing suite
 * - AdvancedModelingEngine: Professional modeling tools
 * - EnhancedAnalysisEngine: P-Delta, Modal, Response Spectrum
 * - ModelValidator: Comprehensive model validation
 * - AnalysisDebugger: Debugging and profiling utilities
 */

// ============================================
// MAIN ANALYSIS ENGINE
// ============================================

export { 
  hybridEngine, 
  HybridAnalysisEngine,
  type Node3D,
  type Element3D,
  type NodalLoad,
  type DistributedLoad,
  type AnalysisOptions,
  type AnalysisResult,
  type MemberForces,
  type PerformanceMetrics,
} from './HybridAnalysisEngine';

// ============================================
// GPU ACCELERATION
// ============================================

export { 
  gpuSolver, 
  hybridSolver,
  GPUAcceleratedSolver,
  HybridStructuralSolver,
  type GPUSolverOptions,
  type GPUAnalysisResult,
} from './GPUAcceleratedSolver';

// ============================================
// ADVANCED MODELING
// ============================================

export {
  AdvancedModelingEngine,
  modelingEngine,
  type ModelNode,
  type ModelElement,
  type ElementType,
  type NodeRestraint,
  type SpringStiffness,
  type NodeMass,
  type MemberReleases,
  type ReleaseCondition,
  type RigidZones,
  type MemberOffsets,
  type MeshingControl,
  type SectionDefinition,
  type SectionShape,
  type SectionProperties,
  type SectionDimensions,
  type ReinforcementData,
  type MaterialDefinition,
  type MaterialType,
  type MaterialProperties,
  type LoadPattern,
  type LoadPatternType,
  type LoadDefinition,
  type NodalLoadDef,
  type MemberLoadDef,
  type AreaLoadDef,
  type TemperatureLoadDef,
  type LoadCombination,
  type CombinationType,
  type ModelStatistics,
} from './AdvancedModelingEngine';

// ============================================
// ENHANCED ANALYSIS
// ============================================

export {
  EnhancedAnalysisEngine,
  enhancedAnalysisEngine,
  type AnalysisType,
  type EnhancedAnalysisOptions,
  type PDeltaOptions,
  type ModalOptions,
  type ResponseSpectrumOptions,
  type SpectrumPoint,
  type TimeHistoryOptions,
  type GroundMotionRecord,
  type StagedConstructionOptions,
  type ConstructionStage,
  type MovingLoadOptions,
  type VehicleType,
  type CustomVehicle,
  type LaneDefinition,
  type EnhancedAnalysisResult,
  type ModalResult,
  type ResponseSpectrumResult,
  type TimeHistoryResult,
  type MovingLoadEnvelope,
  type InfluenceLineResult,
} from './EnhancedAnalysisEngine';

// ============================================
// MODEL VALIDATION
// ============================================

export {
  ModelValidator,
  ModelDebugger,
  ValidationCodes,
  validator,
  type ValidationConfig,
  type ValidationResult,
  type ValidationIssue,
  type ValidationSeverity,
  type ValidationSummary,
} from './ModelValidator';

// ============================================
// DEBUGGING & PROFILING
// ============================================

export {
  AnalysisDebugger,
  PerformanceProfiler,
  analysisDebugger,
  performanceProfiler,
  type DebugConfig,
  type AnalysisTrace,
  type AnalysisPhase,
  type MatrixInfo,
  type NumericalDiagnosis,
  type ResultDiagnosis,
} from './AnalysisDebugger';

// ============================================
// BENCHMARKING
// ============================================

export {
  runBenchmarkSuite,
  benchmarkGPU,
  benchmarkMemory,
  generateGridFrame,
  generateBuildingFrame,
  type BenchmarkSuiteResult,
} from './UltraFastBenchmark';

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick analysis function
 */
export async function analyze(
  nodes: import('./HybridAnalysisEngine').Node3D[],
  elements: import('./HybridAnalysisEngine').Element3D[],
  loads: import('./HybridAnalysisEngine').NodalLoad[],
  options?: import('./HybridAnalysisEngine').AnalysisOptions
) {
  const { hybridEngine } = await import('./HybridAnalysisEngine');
  await hybridEngine.initialize();
  return hybridEngine.analyze(nodes, elements, loads, [], options);
}

/**
 * Create a new structural model
 */
export function createModel() {
  const { AdvancedModelingEngine } = require('./AdvancedModelingEngine');
  return new AdvancedModelingEngine();
}

/**
 * Validate a model before analysis
 */
export function validateModel(
  nodes: Map<string, import('./AdvancedModelingEngine').ModelNode>,
  elements: Map<string, import('./AdvancedModelingEngine').ModelElement>,
  sections: Map<string, import('./AdvancedModelingEngine').SectionDefinition>,
  materials: Map<string, import('./AdvancedModelingEngine').MaterialDefinition>,
  loadPatterns: Map<string, import('./AdvancedModelingEngine').LoadPattern>
) {
  const { ModelValidator } = require('./ModelValidator');
  const validator = new ModelValidator();
  return validator.validate(nodes, elements, sections, materials, loadPatterns);
}

/**
 * Run enhanced analysis (P-Delta, Modal, etc.)
 */
export async function analyzeEnhanced(
  nodes: import('./HybridAnalysisEngine').Node3D[],
  elements: import('./HybridAnalysisEngine').Element3D[],
  loads: import('./HybridAnalysisEngine').NodalLoad[],
  distributedLoads: import('./HybridAnalysisEngine').DistributedLoad[],
  options: import('./EnhancedAnalysisEngine').EnhancedAnalysisOptions
) {
  const { enhancedAnalysisEngine } = await import('./EnhancedAnalysisEngine');
  return enhancedAnalysisEngine.analyze(nodes, elements, loads, distributedLoads, options);
}

// ============================================
// MODULE VERSION
// ============================================

export const SOLVER_VERSION = '3.0.0';
export const SOLVER_FEATURES = [
  'Hybrid Analysis Engine (WASM + GPU)',
  'WebGPU Acceleration',
  'Advanced Modeling Tools',
  'P-Delta Analysis (Geometric Nonlinearity)',
  'Buckling Analysis',
  'Modal Analysis',
  'Response Spectrum Analysis',
  'Moving Load Analysis',
  'Influence Line Generation',
  'Comprehensive Model Validation',
  'Debugging & Profiling Tools',
  'Performance Benchmarking',
];
