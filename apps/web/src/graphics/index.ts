/**
 * Graphics Module Index
 * 
 * Professional-grade 3D Graphics Engine for Structural Engineering
 * Inspired by STAAD.Pro, SAP2000, and ETABS
 * 
 * This module provides:
 * - Advanced PBR rendering with post-processing
 * - Professional modeling tools with snapping
 * - Comprehensive section profile library
 * - Force diagram visualization (BMD, SFD, AFD)
 * - Deflected shape animation
 * - Stress contours and utilization ratios
 * - Mode shape visualization
 * - Load and reaction visualization
 */

// ============================================
// ADVANCED RENDERING ENGINE
// ============================================
export {
  AdvancedRenderingEngine,
  createRenderingEngine,
  MaterialPresets,
  ColorScales,
  type RenderingConfig,
  type RenderStats,
  type ViewMode,
  type SelectionConfig,
  type DisplayOptions,
} from './AdvancedRenderingEngine';

// ============================================
// PROFESSIONAL MODELING TOOLS
// ============================================
export {
  // Coordinate System Management
  CoordinateSystemManager,
  LocalCoordinateSystem,
  coordinateSystemManager,
  
  // Grid and Snap
  GridSnapManager,
  gridSnapManager,
  
  // Section Library
  SectionProfileLibrary,
  sectionLibrary,
  
  // Transform Operations
  TransformOperations,
  
  // Types
  type Point3D,
  type GridSettings,
  type SnapSettings,
  type MemberOffset,
  type MemberRelease,
  type SectionProfile,
  type SectionType,
  type SectionProperties,
  type SectionDimensions,
  type TransformOperation,
  type TransformParams,
  type MeshingOptions,
  type RefinementZone,
} from './ProfessionalModelingTools';

// ============================================
// STRUCTURAL VISUALIZATION
// ============================================
export {
  // Diagram Generators
  DiagramGenerator,
  
  // Deflected Shape
  DeflectedShapeVisualizer,
  
  // Load Visualization
  LoadVisualizer,
  
  // Reaction Visualization
  ReactionVisualizer,
  
  // Types
  type MemberForces,
  type NodeDisplacements,
  type MemberStresses,
  type ReactionForce,
  type LoadVisualization,
  type DiagramSettings,
  type DeflectionSettings,
  type ModeShapeSettings,
} from './StructuralVisualization';

// ============================================
// ANALYSIS RESULT RENDERING
// ============================================
export {
  // Stress Contours
  StressContourRenderer,
  
  // Utilization Visualization
  UtilizationRenderer,
  
  // Mode Shape Animation
  ModeShapeAnimator,
  
  // Result Tables
  ResultTableGenerator,
  
  // Types
  type StressResult,
  type StressComponents,
  type UtilizationResult,
  type UtilizationCheckType,
  type UtilizationDetails,
  type ModeShapeResult,
  type ContourSettings,
  type LegendConfig,
} from './AnalysisResultRenderer';

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

import { AdvancedRenderingEngine } from './AdvancedRenderingEngine';
import { SectionProfileLibrary } from './ProfessionalModelingTools';
import { DiagramGenerator, DeflectedShapeVisualizer, LoadVisualizer, ReactionVisualizer } from './StructuralVisualization';
import { StressContourRenderer, UtilizationRenderer, ModeShapeAnimator } from './AnalysisResultRenderer';
import * as THREE from 'three';

/**
 * Create a complete visualization context for a scene
 */
export function createVisualizationContext(scene: THREE.Scene) {
  return {
    diagrams: new DiagramGenerator(scene),
    deflection: new DeflectedShapeVisualizer(scene),
    loads: new LoadVisualizer(scene),
    reactions: new ReactionVisualizer(scene),
    stressContours: new StressContourRenderer(scene),
    utilization: new UtilizationRenderer(scene),
    modeShapes: new ModeShapeAnimator(scene),
  };
}

/**
 * Get standard section by name
 */
export function getStandardSection(name: string) {
  const library = new SectionProfileLibrary();
  return library.getSection(name);
}

/**
 * Get all sections of a specific type
 */
export function getSectionsByType(type: import('./ProfessionalModelingTools').SectionType) {
  const library = new SectionProfileLibrary();
  return library.getSectionsByType(type);
}

/**
 * Get all available section names
 */
export function getAllSectionNames() {
  const library = new SectionProfileLibrary();
  return library.getAllSectionNames();
}

// ============================================
// MODULE VERSION INFO
// ============================================
export const GRAPHICS_MODULE_VERSION = '2.0.0';
export const GRAPHICS_MODULE_FEATURES = [
  'Advanced PBR Rendering Engine',
  'Multi-pass Post-processing (SSAO, Bloom, Outlines)',
  'Professional Section Library (IS, AISC)',
  'Grid and Snap System',
  'Coordinate System Management',
  'Transform Operations (Copy, Mirror, Array)',
  'Force Diagram Visualization (BMD, SFD, AFD)',
  'Deflected Shape Animation',
  'Stress Contour Rendering',
  'Utilization Ratio Visualization',
  'Mode Shape Animation',
  'Load and Reaction Visualization',
  'Result Table Generation',
  'Color Scale Options (Stress, Rainbow, Thermal, Utilization)',
];

// ============================================
// DEFAULT EXPORT
// ============================================
export default {
  AdvancedRenderingEngine,
  SectionProfileLibrary,
  DiagramGenerator,
  DeflectedShapeVisualizer,
  LoadVisualizer,
  ReactionVisualizer,
  StressContourRenderer,
  UtilizationRenderer,
  ModeShapeAnimator,
  ResultTableGenerator,
  createVisualizationContext,
  getStandardSection,
  getSectionsByType,
  getAllSectionNames,
};
