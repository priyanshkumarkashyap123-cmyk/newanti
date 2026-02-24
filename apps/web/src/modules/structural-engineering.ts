/**
 * ============================================================================
 * CIVIL STRUCTURAL ENGINEERING - MASTER MODULE INDEX
 * ============================================================================
 * 
 * COMPLETE STRUCTURAL ENGINEERING DESIGN SYSTEM
 * 
 * This module provides comprehensive structural engineering capabilities:
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                        DESIGN MODULES                                    │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ CONCRETE DESIGN                                                          │
 * │  ├── RC Beam Design (IS 456, ACI 318, EN 1992)                          │
 * │  ├── RC Column Design (P-M Interaction, Biaxial Bending)                │
 * │  ├── RC Slab Design (One-way, Two-way, Flat)                            │
 * │  ├── RC Footing Design (Isolated, Combined, Raft)                       │
 * │  ├── Special Structures (Tanks, Silos, Retaining Walls)                 │
 * │  └── Prestressed Concrete (Pre/Post-tensioned)                          │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ STEEL DESIGN                                                             │
 * │  ├── Tension Members                                                     │
 * │  ├── Compression Members (Columns)                                       │
 * │  ├── Beam Design (Flexure, Shear, LTB)                                  │
 * │  ├── Beam-Column Design (P-M Interaction)                               │
 * │  ├── Connection Design (Bolted, Welded)                                 │
 * │  └── Composite Design (Steel-Concrete)                                  │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ BRIDGE DESIGN                                                            │
 * │  ├── Deck Slab Design                                                    │
 * │  ├── Girder Design (I, Box, Plate)                                      │
 * │  ├── Pier & Abutment Design                                             │
 * │  ├── Bearing Design                                                      │
 * │  ├── Foundation Design                                                   │
 * │  └── Seismic Design                                                      │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ CABLE & SUSPENSION                                                       │
 * │  ├── Stay Cable Design                                                   │
 * │  ├── Catenary Analysis                                                   │
 * │  ├── Suspension Bridge Design                                           │
 * │  └── Aerodynamic Analysis                                               │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ FOUNDATION DESIGN                                                        │
 * │  ├── Bearing Capacity Analysis                                          │
 * │  ├── Settlement Analysis                                                 │
 * │  ├── Pile Foundation Design                                             │
 * │  └── Retaining Wall Design                                              │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ STRUCTURAL ANALYSIS                                                      │
 * │  ├── Matrix Analysis (Stiffness Method)                                 │
 * │  ├── Finite Element Analysis                                            │
 * │  ├── Modal Analysis (Eigenvalue)                                        │
 * │  ├── Dynamic Analysis (Response Spectrum, Time History)                 │
 * │  └── Stability Analysis (Buckling, P-Delta)                             │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ LOADING                                                                  │
 * │  ├── Dead Load Calculation                                              │
 * │  ├── Live Load (Occupancy, Vehicle)                                     │
 * │  ├── Wind Load (IS 875, ASCE 7, EN 1991)                               │
 * │  ├── Seismic Load (IS 1893, ASCE 7, EN 1998)                           │
 * │  └── Load Combinations                                                   │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * DESIGN CODES SUPPORTED:
 * - Indian Standards: IS 456, IS 800, IS 875, IS 1893, IS 2950, IS 6403
 * - American: ACI 318, AISC 360, ASCE 7, AASHTO LRFD
 * - European: EN 1992, EN 1993, EN 1991, EN 1998
 * - Australian: AS 3600, AS 4100
 * - British: BS 8110
 * 
 * @version 4.0.0
 * @author Head of Engineering
 */

// =============================================================================
// CONCRETE DESIGN MODULES
// =============================================================================

// RC Beam Design
export {
  RCBeamDesignEngine,
  type BeamGeometry,
  type BeamLoading,
  type BeamDesignResult,
} from './concrete/RCBeamDesignEngine';

// RC Column Design
export {
  RCColumnDesignEngine,
  type ColumnGeometry,
  type ColumnDesignResult,
} from './concrete/RCColumnDesignEngine';

// RC Slab Design
export {
  RCSlabDesignEngine,
  type SlabGeometry,
  type SlabDesignResult,
} from './concrete/RCSlabDesignEngine';

// RC Footing Design
export {
  RCFootingDesignEngine,
  type FootingGeometry,
  type FootingDesignResult,
} from './concrete/RCFootingDesignEngine';

// Special Structures
export {
  RCRetainingWallEngine,
  RCWaterTankEngine,
  RCStaircaseEngine,
  designCantileverRetainingWall,
  designDogLeggedStaircase,
  type RetainingWallGeometry,
  type TankGeometry,
  type StaircaseGeometry,
} from './concrete/RCSpecialStructuresEngine';

// Prestressed Concrete
export {
  PrestressedConcreteEngine,
} from './concrete/PrestressedConcreteEngine';

// =============================================================================
// STEEL DESIGN MODULES
// =============================================================================

export {
  // Constants & Database
  STEEL_GRADES,
  INDIAN_SECTIONS,
  AISC_SECTIONS,
  EUROPEAN_SECTIONS,
  BOLT_GRADES,
  BOLT_SIZES,
  WELD_ELECTRODES,
  getSections,
  findSection,
  type SteelGrade,
  type SteelSection,
  type BoltGrade,
  type SteelDesignCode,
  
  // Design Engine
  SteelMemberDesignEngine,
  designTensionMember,
  designColumn,
  designSteelBeam,
  designBeamColumn,
  designBoltedConnection,
  designFilletWeld,
  type TensionMemberResult,
  type CompressionMemberResult,
  type BeamDesignResult as SteelBeamResult,
  type BeamColumnResult,
  type BoltedConnectionResult,
  type WeldedConnectionResult,
  
  // UI
  SteelMemberDesigner,
} from './steel';

// =============================================================================
// BRIDGE DESIGN MODULES
// =============================================================================

export {
  // Deck & Superstructure
  BridgeDeckDesignEngine,
  designHighwayBridge,
  VEHICLE_LOADS,
  type BridgeType,
  type DeckSlabResult,
  type CompositeGirderResult,
  type PlateGirderResult,
  type BoxGirderResult,
  type ShearConnectorResult,
  
  // Substructure
  BridgeSubstructureDesignEngine,
  designBridgePier,
  designBridgeAbutment,
  type PierType,
  type AbutmentType,
  type FoundationType as BridgeFoundationType,
  type BearingType,
  type SeismicZone,
  type PierDesignResult,
  type AbutmentDesignResult,
  type SpreadFootingResult,
  type ElastomericBearingResult,
  type SeismicDesignResult,
} from './bridge';

// =============================================================================
// CABLE & SUSPENSION MODULES
// =============================================================================

export {
  // Cable Design
  CableDesignEngine,
  designStayCable,
  analyzeVibration,
  CABLE_MATERIALS,
  SPIRAL_STRAND_SIZES,
  LOCKED_COIL_SIZES,
  STAY_CABLE_STRAND_SIZES,
  type CableMaterial,
  type CableGeometry,
  type StayCableResult,
  type CableType,
  
  // UI
  CableSuspensionDesigner,
} from './cable';

export {
  // Suspension Bridge
  SuspensionBridgeDesignEngine,
  designSuspensionBridge,
  type SuspensionBridgeInput,
  type SuspensionBridgeResult,
  type MainCableResult,
  type HangerResult,
  type TowerResult,
  type AnchorageResult,
  type TowerType,
  type AnchorageType,
} from './suspension';

// =============================================================================
// FOUNDATION MODULES
// =============================================================================

export {
  AdvancedFoundationDesignEngine,
  FoundationDesignEngine,
  createFoundationDesigner,
  FOUNDATION_TYPES,
  type FoundationType,
  type BearingCapacityMethod,
  type SoilProperties,
  type FoundationDesignConfig,
} from './foundation';

// =============================================================================
// ANALYSIS MODULES
// =============================================================================

// Matrix Analysis
export {
  AdvancedMatrixAnalysisEngine,
} from './analysis/AdvancedMatrixAnalysisEngine';

// Finite Element
export { default as FiniteElementEngine } from './analysis/FiniteElementEngine';

// Stability Analysis
export {
  EffectiveLengthCalculator,
  FrameStabilityAnalyzer,
  ImperfectionModeler,
  SecondOrderAnalysis,
  BucklingAnalyzer,
} from './analysis/StabilityAnalysisEngine';

// =============================================================================
// LOADING MODULES
// =============================================================================

// Wind Load
export {
  AdvancedWindLoadEngine,
} from './core/AdvancedWindLoadEngine';

// Seismic Load
export {
  AdvancedSeismicEngine,
} from './analysis/AdvancedSeismicEngine';

// Load Combinations
export {
  AdvancedLoadCombinationEngine,
} from './core/AdvancedLoadCombinationEngine';

// =============================================================================
// DESIGN UTILITIES
// =============================================================================

// Timber Design
export { default as TimberDesignEngine } from './design/TimberDesignEngine';

// Retaining Wall
export { default as RetainingWallDesignEngine } from './design/RetainingWallEngine';
export {
  GravityWallDesigner,
  CantileverWallDesigner,
  SheetPileWallDesigner,
} from './design/RetainingWallEngine';

// =============================================================================
// CORE UTILITIES
// =============================================================================

export {
  PrecisionMath,
  EngineeringMath,
  ValidationUtils,
  UnitConverter,
  ENGINEERING_CONSTANTS,
} from './core/PrecisionMath';

// =============================================================================
// MODULE REGISTRY
// =============================================================================

/**
 * Central registry of all structural engineering modules
 */
export const STRUCTURAL_MODULES = {
  // Concrete
  concrete: {
    beam: 'RCBeamDesignEngine',
    column: 'RCColumnDesignEngine',
    slab: 'RCSlabDesignEngine',
    footing: 'RCFootingDesignEngine',
    special: 'SpecialStructuresEngine',
    prestressed: 'PrestressedConcreteEngine',
  },
  
  // Steel
  steel: {
    member: 'SteelMemberDesignEngine',
    tension: 'designTensionMember',
    compression: 'designColumn',
    beam: 'designSteelBeam',
    beamColumn: 'designBeamColumn',
    connection: ['designBoltedConnection', 'designFilletWeld'],
  },
  
  // Bridge
  bridge: {
    deck: 'BridgeDeckDesignEngine',
    substructure: 'BridgeSubstructureDesignEngine',
    pier: 'designBridgePier',
    abutment: 'designBridgeAbutment',
  },
  
  // Cable
  cable: {
    stayCable: 'designStayCable',
    catenary: 'CableDesignEngine',
    suspension: 'SuspensionBridgeDesignEngine',
  },
  
  // Foundation
  foundation: {
    isolated: 'AdvancedFoundationDesignEngine',
    pile: 'AdvancedFoundationDesignEngine',
  },
  
  // Analysis
  analysis: {
    matrix: 'AdvancedMatrixAnalysisEngine',
    fem: 'FiniteElementEngine',
    modal: 'ModalAnalysisEngine',
    stability: ['EffectiveLengthCalculator', 'BucklingAnalyzer'],
  },
  
  // Loading
  loading: {
    wind: 'AdvancedWindLoadEngine',
    seismic: 'AdvancedSeismicEngine',
    combinations: 'AdvancedLoadCombinationEngine',
  },
} as const;

/**
 * Design codes supported by each module
 */
export const SUPPORTED_CODES = {
  concrete: ['IS456', 'ACI318', 'EN1992', 'AS3600', 'BS8110'],
  steel: ['IS800', 'AISC360', 'EN1993', 'AS4100'],
  bridge: ['AASHTO', 'EN1991-2', 'IRC'],
  foundation: ['IS456', 'IS2950', 'IS6403', 'ACI318', 'EN1997'],
  seismic: ['IS1893', 'ASCE7', 'EN1998'],
  wind: ['IS875-3', 'ASCE7', 'EN1991-1-4'],
} as const;

/**
 * Version information
 */
export const VERSION = {
  major: 4,
  minor: 0,
  patch: 0,
  build: '2026.01.25',
  codename: 'Engineering Excellence',
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  modules: STRUCTURAL_MODULES,
  codes: SUPPORTED_CODES,
  version: VERSION,
};
