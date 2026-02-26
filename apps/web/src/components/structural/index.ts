/**
 * ============================================================================
 * STRUCTURAL ENGINEERING MODULES - BARREL EXPORT
 * ============================================================================
 * 
 * Central export point for all structural engineering UI components
 * Complete coverage of IS codes: 456, 800, 875, 1893
 */

// Core Calculator
export { 
  StructuralCalculator,
  type StructuralCalculatorProps,
  type CalculationType,
  type DesignCodeType,
  type CalculationInput,
  type CalculationResult,
  type CalculationStep,
  type CodeCheck,
  type InputField,
} from './StructuralCalculator';

// Main Calculation Engine & Beam Design
export {
  calculateBeamDesignIS456,
  performCalculation,
  AVAILABLE_CALCULATIONS,
} from './CalculationEngine';

// Column Design Engine - IS 456:2000
export {
  calculateColumnDesignIS456,
} from './ColumnDesignEngine';

// Slab Design Engine - IS 456:2000
export {
  calculateSlabDesignIS456,
} from './SlabDesignEngine';

// Foundation Design Engine - IS 456:2000 & IS 1904:1986
export {
  calculateIsolatedFootingIS456,
  calculateCombinedFootingIS456,
} from './FoundationDesignEngine';

// Seismic Analysis Engine - IS 1893:2016
export {
  calculateEquivalentStaticMethod,
  calculateResponseSpectrumAnalysis,
} from './SeismicAnalysisEngine';

// Steel Connection Design Engine - IS 800:2007
export {
  calculateBoltedConnectionIS800,
  calculateWeldedConnectionIS800,
  calculateBasePlateIS800,
} from './ConnectionDesignEngine';

// Steel Design Engine - IS 800:2007
export {
  calculateSteelBeamIS800 as calculateSteelBeamDesignIS800,
} from './SteelDesignEngine';

// ============================================================================
// STRUCTURAL ANALYSIS ENGINES
// ============================================================================

// Frame Analysis Engine - Continuous Beams, Portal Frames
export {
  analyzeContinuousBeam,
  analyzePortalFrame,
  generateInfluenceLine,
  performMomentRedistribution,
  analyzeStresses,
  calculateRectangularSection,
  calculateTBeamSection,
  calculateCircularSection,
  calculateFEM_UDL,
  calculateFEM_PointLoad,
  calculateFEM_TriangularLoad,
  LOAD_COMBINATIONS_IS456,
  DEFLECTION_LIMITS,
  type ContinuousBeamInput,
  type ContinuousBeamResult,
  type PortalFrameInput,
  type PortalFrameResult,
  type InfluenceLineInput,
  type InfluenceLineResult,
  type SectionProperties,
  type Node,
  type Member,
  type LoadCase,
  type LoadCombination,
} from './FrameAnalysisEngine';

// Load Analysis Engine - IS 875
export {
  calculateWindLoad,
  calculateDeadLoad,
  generateLoadCombinations,
  calculateLiveLoadReduction,
  MATERIAL_DENSITIES,
  SURFACE_LOADS,
  LIVE_LOADS,
  BASIC_WIND_SPEED,
  TERRAIN_CATEGORIES,
  type WindLoadInput,
  type WindLoadResult,
  type DeadLoadItem,
  type DeadLoadResult,
  type LoadCombinationInput,
  type LoadCombinationResult,
} from './LoadAnalysisEngine';

// Deflection Analysis Engine - Serviceability
export {
  analyzeDeflection,
  checkSpanDepthRatio,
  getConcreteProperties,
  analyzeCrackedSection,
  calculateEffectiveMoI,
  calculateMaxDeflection,
  DEFLECTION_LIMITS_IS456,
  type DeflectionAnalysisInput,
  type DeflectionAnalysisResult,
  type CrackedSectionInput,
  type CrackedSectionResult,
  type ConcreteProperties,
  type SpanDepthInput,
  type SpanDepthResult,
} from './DeflectionAnalysisEngine';

// ============================================================================
// VISUALIZATION COMPONENTS
// ============================================================================

// Diagrams
export {
  BeamCrossSection,
  StressStrainDiagram,
  MomentDiagram,
  ShearDiagram,
  InteractionDiagram,
  type BeamCrossSectionProps,
  type StressStrainDiagramProps,
  type MomentDiagramProps,
  type ShearDiagramProps,
  type InteractionDiagramProps,
  type ReinforcementLayer,
} from './StructuralDiagrams';

// Report
export {
  CalculationReport,
  type CalculationReportProps,
  type ReportData,
} from './CalculationReport';
