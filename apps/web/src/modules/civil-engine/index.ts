/**
 * ============================================================================
 * CIVIL ENGINEERING MODULE - INDEX & EXPORTS
 * ============================================================================
 * 
 * Central export file for all civil engineering modules
 * 
 * @version 1.0.0
 */

// =============================================================================
// CORE ENGINES
// =============================================================================

export * from './core/CivilEngineeringCore';
export * from './core/StructuralAnalysisEngine';

// =============================================================================
// DOMAIN ENGINES
// =============================================================================

export * from './geotechnical/GeotechnicalEngine';
export * from './hydraulics/HydraulicsEngine';
export * from './transportation/TransportationEngine';
export * from './surveying/SurveyingEngine';

// =============================================================================
// VISUALIZATION
// =============================================================================

export * from './visualization/VisualizationEngine';

// =============================================================================
// UI COMPONENTS
// =============================================================================

export { CivilEngineeringDesignCenter } from './components/CivilEngineeringDesignCenter';
export {
  FrameAnalysisUI,
  TrussAnalysisUI,
  ContinuousBeamUI,
} from './components/StructuralAnalysisUI';
export {
  BearingCapacityCalculator,
  SettlementCalculator,
  SlopeStabilityAnalyzer,
} from './components/GeotechnicalUI';
export {
  OpenChannelFlowCalculator,
  PipeFlowCalculator,
  HydrologyCalculator,
} from './components/HydraulicsUI';

// Book-style Interface
export { BookInterface } from './components/BookInterface';
export { BookApp } from './components/BookApp';
export { RealisticBook } from './components/RealisticBook';

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  // Core types
  Material,
  UnitSystem,
  
  // Structural types
  Node2D,
  Member2D,
  Support,
  Load,
  FrameAnalysisResult,
  TrussAnalysisResult,
  
  // Geotechnical types
  SoilProperties,
  FoundationGeometry,
  BearingCapacityResult,
  SettlementResult,
  SlopeStabilityResult,
  
  // Hydraulics types
  ChannelSection,
  FlowParameters,
  ChannelFlowResult,
  PipeFlowResult,
  
  // Transportation types
  HighwayDesignParameters,
  PavementDesignParameters,
  TrafficFlowParameters,
  
  // Surveying types
  Coordinate,
  TraverseStation,
  TraverseResult,
} from './types';

// =============================================================================
// VERSION INFO
// =============================================================================

export const CIVIL_ENGINE_VERSION = '2.0.0';
export const CIVIL_ENGINE_BUILD_DATE = '2025-01-04';

// =============================================================================
// MODULE REGISTRY
// =============================================================================

export const CIVIL_ENGINE_MODULES = {
  structural: {
    name: 'Structural Analysis',
    version: '2.0.0',
    capabilities: [
      '2D Frame Analysis (Direct Stiffness Method)',
      '2D Truss Analysis',
      'Continuous Beam Analysis (Three-Moment Equation)',
      'Influence Lines',
      'P-Delta Analysis',
    ],
  },
  geotechnical: {
    name: 'Geotechnical Engineering',
    version: '2.0.0',
    capabilities: [
      'Bearing Capacity (Terzaghi, Meyerhof, Hansen, Vesic)',
      'Settlement Analysis (Immediate, Consolidation, Secondary)',
      'Earth Pressure (Rankine, Coulomb)',
      'Slope Stability (Infinite Slope, Culmann, Bishop, Fellenius)',
      'Pile Foundation Design',
    ],
  },
  hydraulics: {
    name: 'Hydraulics & Hydrology',
    version: '2.0.0',
    capabilities: [
      'Open Channel Flow (Manning, Critical Depth)',
      'Pipe Flow (Darcy-Weisbach, Hazen-Williams)',
      'Hydraulic Jump Analysis',
      'GVF Profile Computation',
      'Hydrology (Rational Method, SCS Curve Number)',
      'Flood Routing (Muskingum)',
    ],
  },
  transportation: {
    name: 'Transportation Engineering',
    version: '2.0.0',
    capabilities: [
      'Highway Geometric Design',
      'Pavement Design (AASHTO, IRC)',
      'Traffic Flow Analysis',
      'Signal Design (Webster)',
      'Railway Engineering',
      'Airport Planning',
    ],
  },
  surveying: {
    name: 'Surveying & Geodesy',
    version: '2.0.0',
    capabilities: [
      'Coordinate Transformations',
      'Traverse Computation & Adjustment',
      'Leveling Calculations',
      'Curve Setting Out',
      'Earthwork Volumes',
      'GPS Coordinate Processing',
    ],
  },
  visualization: {
    name: 'Visualization Engine',
    version: '2.0.0',
    capabilities: [
      'SVG Drawing Generation',
      'Structural Diagrams (BMD, SFD, AFD)',
      'Geotechnical Visualizations',
      'Hydraulic Flow Visualization',
      '3D Wireframe Rendering',
    ],
  },
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

const CivilEngine = {
  version: CIVIL_ENGINE_VERSION,
  buildDate: CIVIL_ENGINE_BUILD_DATE,
  modules: CIVIL_ENGINE_MODULES,
};

export default CivilEngine;
