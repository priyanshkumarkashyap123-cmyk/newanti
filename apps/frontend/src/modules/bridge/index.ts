/**
 * ============================================================================
 * BRIDGE DESIGN MODULE - CENTRAL EXPORTS
 * ============================================================================
 * 
 * Comprehensive bridge design including:
 * 
 * SUPERSTRUCTURE:
 * - Deck slab design
 * - Composite girder design
 * - Plate girder design
 * - Box girder design
 * - Shear connector design
 * 
 * SUBSTRUCTURE:
 * - Pier design (single column, multi-column, wall, hammerhead)
 * - Abutment design (cantilever, gravity, integral)
 * - Bearing design (elastomeric, pot)
 * - Foundation design (spread footing, pile)
 * - Seismic design
 * 
 * Design Codes Supported:
 * - AASHTO LRFD
 * - EN 1991-2 / EN 1992-2 / EN 1993-2
 * - IRC (India)
 */

// =============================================================================
// DECK & SUPERSTRUCTURE DESIGN
// =============================================================================

export {
  // Engine class
  BridgeDeckDesignEngine,
  
  // Factory function
  designHighwayBridge,
  
  // Vehicle load database
  VEHICLE_LOADS,
  
  // Types
  type BridgeType,
  type DeckSlabResult,
  type CompositeGirderResult,
  type PlateGirderResult,
  type BoxGirderResult,
  type ShearConnectorResult,
} from './BridgeDeckDesignEngine';

// =============================================================================
// SUBSTRUCTURE & FOUNDATION DESIGN
// =============================================================================

export {
  // Engine class
  BridgeSubstructureDesignEngine,
  
  // Factory functions
  designBridgePier,
  designBridgeAbutment,
  
  // Types
  type PierType,
  type AbutmentType,
  type FoundationType,
  type BearingType,
  type SeismicZone,
  type PierGeometry,
  type PierMaterials,
  type PierDesignResult,
  type AbutmentGeometry,
  type AbutmentDesignResult,
  type SpreadFootingInput,
  type SpreadFootingResult,
  type PileFoundationInput,
  type PileFoundationResult,
  type BearingDesignInput,
  type ElastomericBearingResult,
  type PotBearingResult,
  type SeismicDesignInput,
  type SeismicDesignResult,
  type SubstructureLoading,
  type SoilProperties,
} from './BridgeSubstructureEngine';

// =============================================================================
// UI COMPONENTS
// =============================================================================

export { BridgeDesigner } from './BridgeDesigner';
