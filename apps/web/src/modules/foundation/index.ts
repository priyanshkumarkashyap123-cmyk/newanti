/**
 * ============================================================================
 * ADVANCED FOUNDATION MODULE - INDEX
 * ============================================================================
 * 
 * Central export point for foundation design functionality.
 * 
 * @version 3.0.0
 */

// Advanced Foundation Engine
export {
  AdvancedFoundationDesignEngine,
  type FoundationType,
  type BearingCapacityMethod,
  type DesignCode,
  type SoilProperties,
  type SoilLayer,
  type FoundationLoads,
  type FoundationDesignConfig,
  type CalculationStep,
  type DesignCheck,
} from './AdvancedFoundationDesignEngine';

// Original Foundation Engine (for backward compatibility)
export { FoundationDesignEngine } from './FoundationDesignEngine';

// Factory function
export const createFoundationDesigner = async (advanced: boolean = true) => {
  if (advanced) {
    const mod = await import('./AdvancedFoundationDesignEngine');
    return mod.AdvancedFoundationDesignEngine;
  }
  const mod = await import('./FoundationDesignEngine');
  return mod.FoundationDesignEngine;
};

// Foundation Types for reference
export const FOUNDATION_TYPES = {
  ISOLATED_SQUARE: 'isolated_square',
  ISOLATED_RECTANGULAR: 'isolated_rectangular',
  ISOLATED_CIRCULAR: 'isolated_circular',
  COMBINED_RECTANGULAR: 'combined_rectangular',
  COMBINED_TRAPEZOIDAL: 'combined_trapezoidal',
  STRIP_CONTINUOUS: 'strip_continuous',
  STRIP_STEPPED: 'strip_stepped',
  RAFT_FLAT: 'raft_flat',
  RAFT_RIBBED: 'raft_ribbed',
  PILE_BORED: 'pile_bored',
  PILE_DRIVEN: 'pile_driven',
  PILE_CAP: 'pile_cap',
} as const;

// Soil Types for reference
export const SOIL_TYPES = {
  GRAVEL: { description: 'Gravel', bearing: '300-600 kN/m²', settlement: 'Low' },
  SAND_DENSE: { description: 'Dense Sand', bearing: '200-400 kN/m²', settlement: 'Low' },
  SAND_MEDIUM: { description: 'Medium Sand', bearing: '100-200 kN/m²', settlement: 'Medium' },
  SAND_LOOSE: { description: 'Loose Sand', bearing: '50-100 kN/m²', settlement: 'High' },
  CLAY_HARD: { description: 'Hard Clay', bearing: '200-400 kN/m²', settlement: 'Low' },
  CLAY_STIFF: { description: 'Stiff Clay', bearing: '100-200 kN/m²', settlement: 'Medium' },
  CLAY_MEDIUM: { description: 'Medium Clay', bearing: '50-100 kN/m²', settlement: 'High' },
  CLAY_SOFT: { description: 'Soft Clay', bearing: '25-50 kN/m²', settlement: 'Very High' },
  SILT: { description: 'Silt', bearing: '50-100 kN/m²', settlement: 'High' },
  ROCK_HARD: { description: 'Hard Rock', bearing: '3000-10000 kN/m²', settlement: 'Negligible' },
  ROCK_MEDIUM: { description: 'Medium Rock', bearing: '1000-3000 kN/m²', settlement: 'Very Low' },
  ROCK_SOFT: { description: 'Soft Rock', bearing: '500-1000 kN/m²', settlement: 'Low' },
} as const;

// Design Codes for reference
export const DESIGN_CODES = {
  IS456: { name: 'IS 456:2000', country: 'India', description: 'Indian Standard for Concrete' },
  IS2950: { name: 'IS 2950:1981', country: 'India', description: 'Design of Raft Foundations' },
  IS6403: { name: 'IS 6403:1981', country: 'India', description: 'Bearing Capacity of Soils' },
  ACI318: { name: 'ACI 318-19', country: 'USA', description: 'Building Code for Structural Concrete' },
  EN1992: { name: 'EN 1992-1-1', country: 'Europe', description: 'Eurocode 2: Design of Concrete Structures' },
  EN1997: { name: 'EN 1997-1', country: 'Europe', description: 'Eurocode 7: Geotechnical Design' },
  AS3600: { name: 'AS 3600:2018', country: 'Australia', description: 'Concrete Structures' },
  BS8110: { name: 'BS 8110', country: 'UK', description: 'Structural Use of Concrete' },
} as const;

// Version Info
export const FOUNDATION_MODULE_VERSION = '3.0.0';
