/**
 * ============================================================================
 * DETAILING MODULE - INDEX
 * ============================================================================
 * 
 * Comprehensive RC member design and detailing per ACI 318-19
 * 
 * Includes:
 * - Foundations (Isolated footings)
 * - Columns (RC columns with P-M interaction)
 * - Beams (Flexure, shear, torsion, deflection)
 * - Slabs (One-way, two-way, flat plates)
 * - Walls (Shear walls, boundary elements)
 * 
 * @author BeamLab Engineering Team
 * @version 1.0.0
 */

// Foundation Design Module - import and re-export to avoid conflicts
export {
  type CalculationStep,
  type ColumnLoadInput,
  type ShearResult,
} from './foundations';

// Re-export foundations selectively (avoiding conflicts)
export * from './foundations';

// Column Design Module - use namespace import to avoid conflicts
import * as ColumnsModule from './columns';
export { ColumnsModule };

// Beam Design Module - use namespace import to avoid conflicts  
import * as BeamsModule from './beams';
export { BeamsModule };

// Slab Design Module
import * as SlabsModule from './slabs';
export { SlabsModule };

// Wall/Shear Wall Design Module
import * as WallsModule from './walls';
export { WallsModule };

// Design Page Component
export { DetailingDesignPage } from './DetailingDesignPage';
