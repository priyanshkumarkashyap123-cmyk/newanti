/**
 * Foundation Design Module - Central Exports
 * Per ACI 318-19, AASHTO LRFD
 * 
 * Complete foundation design including:
 * - Pile foundations (driven piles, drilled shafts)
 * - Retaining walls (cantilever, gravity)
 */

// Pile Foundation Design (use namespace to avoid conflicts)
import * as PileTypes from './piles';
export { PileTypes };
export { PileCapacityCalculator as PileDesignCalculator, designPile as calculatePileDesign } from './piles/PileCalculator';

// Retaining Wall Design (use namespace to avoid conflicts)
import * as RetainingWallTypes from './retaining-walls';
export { RetainingWallTypes };
export { RetainingWallCalculator, designRetainingWall as calculateRetainingWall } from './retaining-walls/RetainingWallCalculator';
