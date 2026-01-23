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

// Foundation Design Module
export * from './foundations';

// Column Design Module
export * from './columns';

// Beam Design Module
export * from './beams';

// Slab Design Module
export * from './slabs';

// Wall/Shear Wall Design Module
export * from './walls';

// Design Page Component
export { DetailingDesignPage } from './DetailingDesignPage';
