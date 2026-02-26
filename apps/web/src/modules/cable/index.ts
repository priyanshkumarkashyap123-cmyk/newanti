/**
 * ============================================================================
 * CABLE DESIGN MODULE - CENTRAL EXPORTS
 * ============================================================================
 * 
 * Comprehensive cable structure design including:
 * - Catenary and parabolic cable analysis
 * - Stay cable design
 * - Cable vibration analysis
 * - Cable material database
 * 
 * Applications:
 * - Cable-stayed bridges
 * - Suspension bridges
 * - Cable roof structures
 * - Transmission lines
 */

// =============================================================================
// DESIGN ENGINE
// =============================================================================

export {
  // Main engine class
  CableDesignEngine,
  
  // Factory functions
  designStayCable,
  analyzeVibration,
  
  // Material database
  CABLE_MATERIALS,
  SPIRAL_STRAND_SIZES,
  LOCKED_COIL_SIZES,
  STAY_CABLE_STRAND_SIZES,
  
  // Types
  type CableMaterial,
  type CableGeometry,
  type CatenaryCableResult,
  type ParabolicCableResult,
  type CableDesignResult,
  type StayCableResult,
  type CableType,
} from './CableDesignEngine';

// =============================================================================
// UI COMPONENTS
// =============================================================================

export { CableSuspensionDesigner } from './CableSuspensionDesigner';
