import type { StructuralSection } from './types';

const HOWRAH_BRIDGE_SECTIONS: Record<string, StructuralSection> = {
  // K-truss top chord
  K_TRUSS_TOP_1000: {
    id: 'K_TRUSS_TOP_1000',
    name: 'K-Truss Top Chord I-1000x650x45x28',
    type: 'I-BEAM',
    dimensions: {
      height: 1000,
      width: 650,
      flangeThickness: 45,
      webThickness: 28,
    },
    E: 210e6,
    A: 0.0868,
    I: 0.00434,
    weight: 681,
    grade: 'S460',
  },
  
  // K-truss bottom chord
  K_TRUSS_BOTTOM_1000: {
    id: 'K_TRUSS_BOTTOM_1000',
    name: 'K-Truss Bottom Chord I-1000x650x45x28',
    type: 'I-BEAM',
    dimensions: {
      height: 1000,
      width: 650,
      flangeThickness: 45,
      webThickness: 28,
    },
    E: 210e6,
    A: 0.0868,
    I: 0.00434,
    weight: 681,
    grade: 'S460',
  },
  
  // K-truss verticals
  K_TRUSS_VERTICAL_800: {
    id: 'K_TRUSS_VERTICAL_800',
    name: 'K-Truss Vertical I-800x550x38x24',
    type: 'I-BEAM',
    dimensions: {
      height: 800,
      width: 550,
      flangeThickness: 38,
      webThickness: 24,
    },
    E: 210e6,
    A: 0.0610,
    I: 0.00195,
    weight: 479,
    grade: 'S460',
  },
  
  // K-truss diagonals
  K_TRUSS_DIAGONAL_700: {
    id: 'K_TRUSS_DIAGONAL_700',
    name: 'K-Truss Diagonal I-700x500x35x20',
    type: 'I-BEAM',
    dimensions: {
      height: 700,
      width: 500,
      flangeThickness: 35,
      webThickness: 20,
    },
    E: 210e6,
    A: 0.0490,
    I: 0.00120,
    weight: 385,
    grade: 'S460',
  },
  
  // Portal frames
  PORTAL_COL_900: {
    id: 'PORTAL_COL_900',
    name: 'Portal Column I-900x600x42x26',
    type: 'I-BEAM',
    dimensions: {
      height: 900,
      width: 600,
      flangeThickness: 42,
      webThickness: 26,
    },
    E: 210e6,
    A: 0.0756,
    I: 0.00307,
    weight: 594,
    grade: 'S460',
  },
  
  // Cross-girders (Floor beams)
  CROSS_GIRDER_800: {
    id: 'CROSS_GIRDER_800',
    name: 'Cross Girder I-800x400x32x20',
    type: 'I-BEAM',
    dimensions: {
      height: 800,
      width: 400,
      flangeThickness: 32,
      webThickness: 20,
    },
    E: 210e6,
    A: 0.0416,
    I: 0.00133,
    weight: 327,
    grade: 'S460',
  },
  
  // Stringers
  STRINGER_450: {
    id: 'STRINGER_450',
    name: 'Stringer I-450x220x18x11',
    type: 'I-BEAM',
    dimensions: {
      height: 450,
      width: 220,
      flangeThickness: 18,
      webThickness: 11,
    },
    E: 210e6,
    A: 0.0129,
    I: 0.000109,
    weight: 101,
    grade: 'S355',
  },
  
  // Lateral bracing (upper)
  UPPER_LATERAL_500: {
    id: 'UPPER_LATERAL_500',
    name: 'Upper Lateral I-500x300x22x14',
    type: 'I-BEAM',
    dimensions: {
      height: 500,
      width: 300,
      flangeThickness: 22,
      webThickness: 14,
    },
    E: 210e6,
    A: 0.0200,
    I: 0.000208,
    weight: 157,
    grade: 'S355',
  },
  
  // Lateral bracing (lower)
  LOWER_LATERAL_500: {
    id: 'LOWER_LATERAL_500',
    name: 'Lower Lateral I-500x300x22x14',
    type: 'I-BEAM',
    dimensions: {
      height: 500,
      width: 300,
      flangeThickness: 22,
      webThickness: 14,
    },
    E: 210e6,
    A: 0.0200,
    I: 0.000208,
    weight: 157,
    grade: 'S355',
  },
};

// ============================================
// BANDRA-WORLI SEA LINK SECTIONS
// ============================================


export { HOWRAH_BRIDGE_SECTIONS };
