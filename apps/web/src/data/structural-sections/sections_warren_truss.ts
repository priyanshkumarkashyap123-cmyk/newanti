import type { StructuralSection } from './types';

const WARREN_TRUSS_SECTIONS: Record<string, StructuralSection> = {
  // Top chord
  WARREN_TOP_CHORD: {
    id: 'WARREN_TOP_CHORD',
    name: 'Warren Top Chord I-600x400x28x18',
    type: 'I-BEAM',
    dimensions: {
      height: 600,
      width: 400,
      flangeThickness: 28,
      webThickness: 18,
    },
    E: 210e6,
    A: 0.0324,
    I: 0.000583,
    weight: 254,
    grade: 'S460',
  },
  
  // Bottom chord
  WARREN_BOTTOM_CHORD: {
    id: 'WARREN_BOTTOM_CHORD',
    name: 'Warren Bottom Chord I-600x400x28x18',
    type: 'I-BEAM',
    dimensions: {
      height: 600,
      width: 400,
      flangeThickness: 28,
      webThickness: 18,
    },
    E: 210e6,
    A: 0.0324,
    I: 0.000583,
    weight: 254,
    grade: 'S460',
  },
  
  // Diagonals
  WARREN_DIAGONAL: {
    id: 'WARREN_DIAGONAL',
    name: 'Warren Diagonal I-500x350x24x15',
    type: 'I-BEAM',
    dimensions: {
      height: 500,
      width: 350,
      flangeThickness: 24,
      webThickness: 15,
    },
    E: 210e6,
    A: 0.0243,
    I: 0.000253,
    weight: 191,
    grade: 'S460',
  },
  
  // Portal frame columns
  WARREN_PORTAL_COL: {
    id: 'WARREN_PORTAL_COL',
    name: 'Warren Portal Column I-550x380x26x16',
    type: 'I-BEAM',
    dimensions: {
      height: 550,
      width: 380,
      flangeThickness: 26,
      webThickness: 16,
    },
    E: 210e6,
    A: 0.0284,
    I: 0.000429,
    weight: 223,
    grade: 'S460',
  },
  
  // Portal frame beams
  WARREN_PORTAL_BEAM: {
    id: 'WARREN_PORTAL_BEAM',
    name: 'Warren Portal Beam I-500x350x24x15',
    type: 'I-BEAM',
    dimensions: {
      height: 500,
      width: 350,
      flangeThickness: 24,
      webThickness: 15,
    },
    E: 210e6,
    A: 0.0243,
    I: 0.000253,
    weight: 191,
    grade: 'S460',
  },
  
  // Cross-girders
  WARREN_CROSS_GIRDER: {
    id: 'WARREN_CROSS_GIRDER',
    name: 'Warren Cross Girder I-450x280x22x14',
    type: 'I-BEAM',
    dimensions: {
      height: 450,
      width: 280,
      flangeThickness: 22,
      webThickness: 14,
    },
    E: 210e6,
    A: 0.0186,
    I: 0.000189,
    weight: 146,
    grade: 'S355',
  },
  
  // Stringers
  WARREN_STRINGER: {
    id: 'WARREN_STRINGER',
    name: 'Warren Stringer I-350x200x16x10',
    type: 'I-BEAM',
    dimensions: {
      height: 350,
      width: 200,
      flangeThickness: 16,
      webThickness: 10,
    },
    E: 210e6,
    A: 0.0099,
    I: 0.0000509,
    weight: 77.7,
    grade: 'S355',
  },
  
  // Upper lateral bracing
  WARREN_UPPER_LATERAL: {
    id: 'WARREN_UPPER_LATERAL',
    name: 'Warren Upper Lateral I-400x250x18x12',
    type: 'I-BEAM',
    dimensions: {
      height: 400,
      width: 250,
      flangeThickness: 18,
      webThickness: 12,
    },
    E: 210e6,
    A: 0.0138,
    I: 0.000092,
    weight: 108,
    grade: 'S355',
  },
  
  // Lower lateral bracing
  WARREN_LOWER_LATERAL: {
    id: 'WARREN_LOWER_LATERAL',
    name: 'Warren Lower Lateral I-400x250x18x12',
    type: 'I-BEAM',
    dimensions: {
      height: 400,
      width: 250,
      flangeThickness: 18,
      webThickness: 12,
    },
    E: 210e6,
    A: 0.0138,
    I: 0.000092,
    weight: 108,
    grade: 'S355',
  },
};

// ============================================
// SIGNATURE BRIDGE SECTIONS
// ============================================


export { WARREN_TRUSS_SECTIONS };
