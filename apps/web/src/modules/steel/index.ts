/**
 * ============================================================================
 * STEEL DESIGN MODULE - CENTRAL EXPORTS
 * ============================================================================
 * 
 * Complete steel member design including:
 * - Beams (flexure, shear, LTB, deflection)
 * - Columns (compression, P-M interaction)
 * - Composite beams (steel-concrete)
 * - Tension members
 * - Beam-columns
 * - Connections (bolted, welded)
 * 
 * Design Codes Supported:
 * - IS 800:2007 (India)
 * - AISC 360-22 (USA)
 * - EN 1993-1-1:2005 (Eurocode)
 * - AS 4100:2020 (Australia)
 */

// =============================================================================
// LEGACY EXPORTS (backward compatibility)
// =============================================================================

// Steel Beam Design
export * from './beams';

// Steel Column Design
export * from './columns';

// Composite Beam Design
export * from './composite';

// =============================================================================
// NEW COMPREHENSIVE STEEL DESIGN SYSTEM
// =============================================================================

// Constants & Database
export {
  STEEL_GRADES,
  INDIAN_SECTIONS,
  AISC_SECTIONS,
  EUROPEAN_SECTIONS,
  BOLT_GRADES,
  BOLT_SIZES,
  WELD_ELECTRODES,
  getSections,
  findSection,
  getSteelGrade,
  getEffectiveLengthFactor,
  classifySection,
  type SteelGrade,
  type SteelSection,
  type BoltGrade,
  type SteelDesignCode,
  type SteelGradeType,
  type SectionType,
  type SectionClassification,
} from './SteelDesignConstants';

// Design Engine
export {
  SteelMemberDesignEngine,
  designTensionMember,
  designColumn,
  designSteelBeam,
  designBeamColumn,
  designBoltedConnection,
  designFilletWeld,
  type TensionMemberResult,
  type CompressionMemberResult,
  type BeamDesignResult,
  type BeamColumnResult,
  type BoltedConnectionResult,
  type WeldedConnectionResult,
  type SteelMemberDesignResult,
} from './SteelMemberDesignEngine';

// UI Components
export { SteelMemberDesigner } from './SteelMemberDesigner';
