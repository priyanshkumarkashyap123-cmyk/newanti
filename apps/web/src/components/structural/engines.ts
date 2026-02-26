/**
 * ============================================================================
 * STRUCTURAL ENGINES INDEX
 * ============================================================================
 * 
 * Central export point for all structural engineering calculation engines
 * 
 * @version 1.0.0
 */

// ============================================================================
// CONCRETE DESIGN ENGINES
// ============================================================================

export { TorsionDesignEngine, torsionDesignEngine } from './TorsionDesignEngine';
export type { TorsionDesignInput, TorsionDesignResult } from './TorsionDesignEngine';

export { PunchingShearEngine, punchingShearEngine } from './PunchingShearEngine';
export type { PunchingShearInput, PunchingShearResult } from './PunchingShearEngine';

export { CrackWidthEngine, crackWidthEngine } from './CrackWidthEngine';
export type { CrackWidthInput, CrackWidthResult } from './CrackWidthEngine';

export { CorbelDesignEngine, corbelDesignEngine } from './CorbelDesignEngine';
export type { CorbelDesignInput, CorbelDesignResult } from './CorbelDesignEngine';

export { DeepBeamDesignEngine, deepBeamDesignEngine } from './DeepBeamDesignEngine';
export type { DeepBeamDesignInput, DeepBeamDesignResult } from './DeepBeamDesignEngine';

export { FlatSlabDesignEngine, flatSlabDesignEngine } from './FlatSlabDesignEngine';
export type { FlatSlabDesignInput, FlatSlabDesignResult } from './FlatSlabDesignEngine';

export { StaircaseDesignEngine, staircaseDesignEngine } from './StaircaseDesignEngine';
export type { StaircaseInput, StaircaseResult } from './StaircaseDesignEngine';

// ============================================================================
// FOUNDATION DESIGN ENGINES
// ============================================================================

export { FootingDesignEngine, footingDesignEngine } from './FootingDesignEngine';
export type { FootingDesignInput, FootingDesignResult } from './FootingDesignEngine';

export { RetainingWallDesignEngine, retainingWallDesignEngine } from './RetainingWallDesignEngine';
export type { RetainingWallDesignInput, RetainingWallResult } from './RetainingWallDesignEngine';

// ============================================================================
// SPECIAL STRUCTURES
// ============================================================================

export { WaterTankDesignEngine, waterTankDesignEngine } from './WaterTankDesignEngine';
export type { WaterTankDesignInput, WaterTankDesignResult } from './WaterTankDesignEngine';

// ============================================================================
// STEEL CONNECTIONS
// ============================================================================

export { BoltedConnectionEngine, boltedConnectionEngine } from './BoltedConnectionEngine';
export type { BoltedConnectionInput, BoltedConnectionResult } from './BoltedConnectionEngine';

export { WeldedConnectionEngine, weldedConnectionEngine } from './WeldedConnectionEngine';
export type { WeldedConnectionInput, WeldedConnectionResult } from './WeldedConnectionEngine';

// ============================================================================
// PRESTRESSED CONCRETE
// ============================================================================

export { PrestressedConcreteEngine, prestressedConcreteEngine } from './PrestressedConcreteEngine';
export type { PrestressedDesignInput, PrestressedDesignResult } from './PrestressedConcreteEngine';

// ============================================================================
// ENGINE REGISTRY
// ============================================================================

/**
 * Registry of all available structural design engines
 * Useful for dynamic loading and module discovery
 */
export const STRUCTURAL_ENGINES = {
  // Concrete
  torsion: {
    name: 'Torsion Design',
    engine: 'torsionDesignEngine',
    category: 'concrete',
    codes: ['IS456', 'ACI318'] as readonly string[],
    description: 'RC beam torsion design with combined bending, shear, and torsion',
  },
  punchingShear: {
    name: 'Punching Shear',
    engine: 'punchingShearEngine',
    category: 'concrete',
    codes: ['IS456', 'ACI318'] as readonly string[],
    description: 'Flat slab punching shear check at slab-column connections',
  },
  crackWidth: {
    name: 'Crack Width',
    engine: 'crackWidthEngine',
    category: 'concrete',
    codes: ['IS456', 'EC2'] as readonly string[],
    description: 'Serviceability crack width calculation',
  },
  corbel: {
    name: 'Corbel Design',
    engine: 'corbelDesignEngine',
    category: 'concrete',
    codes: ['IS456', 'ACI318'] as readonly string[],
    description: 'Short cantilever bracket design',
  },
  deepBeam: {
    name: 'Deep Beam',
    engine: 'deepBeamDesignEngine',
    category: 'concrete',
    codes: ['IS456', 'ACI318'] as readonly string[],
    description: 'Deep beam design using strut-and-tie model',
  },
  flatSlab: {
    name: 'Flat Slab',
    engine: 'flatSlabDesignEngine',
    category: 'concrete',
    codes: ['IS456', 'ACI318'] as readonly string[],
    description: 'Flat slab design using Direct Design Method',
  },
  staircase: {
    name: 'Staircase Design',
    engine: 'staircaseDesignEngine',
    category: 'concrete',
    codes: ['IS456'] as readonly string[],
    description: 'RC staircase design - dog-leg, open well, straight',
  },
  
  // Foundations
  footing: {
    name: 'Isolated Footing',
    engine: 'footingDesignEngine',
    category: 'foundation',
    codes: ['IS456'] as readonly string[],
    description: 'Isolated and combined footing design',
  },
  retainingWall: {
    name: 'Retaining Wall',
    engine: 'retainingWallDesignEngine',
    category: 'foundation',
    codes: ['IS456'] as readonly string[],
    description: 'Cantilever retaining wall with stability checks',
  },
  
  // Special Structures
  waterTank: {
    name: 'Water Tank',
    engine: 'waterTankDesignEngine',
    category: 'special',
    codes: ['IS3370'] as readonly string[],
    description: 'Rectangular and circular water tank design',
  },
  
  // Steel Connections
  boltedConnection: {
    name: 'Bolted Connection',
    engine: 'boltedConnectionEngine',
    category: 'steel',
    codes: ['IS800', 'AISC360'] as readonly string[],
    description: 'Shear, moment, and splice connections with bolts',
  },
  weldedConnection: {
    name: 'Welded Connection',
    engine: 'weldedConnectionEngine',
    category: 'steel',
    codes: ['IS800', 'AISC360'] as readonly string[],
    description: 'Fillet and groove weld design',
  },
  
  // Prestressed Concrete
  prestressed: {
    name: 'Prestressed Concrete',
    engine: 'prestressedConcreteEngine',
    category: 'concrete',
    codes: ['IS1343'] as readonly string[],
    description: 'Pre-tensioned and post-tensioned member design',
  },
};

/**
 * Get engine by category
 */
export function getEnginesByCategory(category: 'concrete' | 'foundation' | 'special' | 'steel') {
  return Object.entries(STRUCTURAL_ENGINES)
    .filter(([_, config]) => config.category === category)
    .map(([key, config]) => ({ key, ...config }));
}

/**
 * Get engine by design code
 */
export function getEnginesByCode(code: string) {
  return Object.entries(STRUCTURAL_ENGINES)
    .filter(([_, config]) => (config.codes as readonly string[]).includes(code))
    .map(([key, config]) => ({ key, ...config }));
}
