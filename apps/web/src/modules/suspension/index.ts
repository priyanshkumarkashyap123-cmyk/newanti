/**
 * ============================================================================
 * SUSPENSION STRUCTURE DESIGN MODULE - CENTRAL EXPORTS
 * ============================================================================
 * 
 * Comprehensive suspension bridge design including:
 * - Main cable design
 * - Hanger design
 * - Tower design
 * - Anchorage design
 * - Stiffening girder design
 * - Aerodynamic stability analysis
 * 
 * Applications:
 * - Long-span suspension bridges
 * - Pedestrian suspension bridges
 */

// =============================================================================
// DESIGN ENGINE
// =============================================================================

export {
  // Main engine class
  SuspensionBridgeDesignEngine,
  
  // Factory function
  designSuspensionBridge,
  
  // Types
  type SuspensionBridgeType,
  type SuspensionBridgeDesignResult,
  type MainCableAnalysisResult,
  type HangerAnalysisResult,
  type TowerDesignResult,
  type AnchorageDesignResult,
  type StiffeningGirderResult,
  type AerodynamicAnalysisResult,
  type TowerType,
  type HangerType,
  type SuspensionBridgeGeometry,
  type SuspensionBridgeLoading,
} from './SuspensionDesignEngine';

// Type aliases for backwards compatibility
export type SuspensionBridgeInput = import('./SuspensionDesignEngine').SuspensionBridgeGeometry;
export type SuspensionBridgeResult = import('./SuspensionDesignEngine').SuspensionBridgeDesignResult;
export type MainCableResult = import('./SuspensionDesignEngine').MainCableAnalysisResult;
export type HangerResult = import('./SuspensionDesignEngine').HangerAnalysisResult;
export type TowerResult = import('./SuspensionDesignEngine').TowerDesignResult;
export type AnchorageResult = import('./SuspensionDesignEngine').AnchorageDesignResult;
export type AerodynamicResult = import('./SuspensionDesignEngine').AerodynamicAnalysisResult;
export type AnchorageType = 'GRAVITY' | 'TUNNEL' | 'ROCK';

