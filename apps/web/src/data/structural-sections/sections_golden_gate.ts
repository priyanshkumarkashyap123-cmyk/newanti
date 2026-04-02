import type { StructuralSection } from './types';

const GOLDEN_GATE_SECTIONS: Record<string, StructuralSection> = {
  // Main cables (Catenary suspension cables)
  MAIN_CABLE_940: {
    id: 'MAIN_CABLE_940',
    name: 'Main Cable Ø940mm',
    type: 'CIRCLE',
    dimensions: {
      diameter: 940,
    },
    E: 165e6,
    A: 0.694,
    I: 0.0382,
    weight: 5448,
    grade: 'Grade 1860',
  },
  
  // Suspender cables (Vertical hangers)
  SUSPENDER_CABLE_70: {
    id: 'SUSPENDER_CABLE_70',
    name: 'Suspender Cable Ø70mm',
    type: 'CIRCLE',
    dimensions: {
      diameter: 70,
    },
    E: 165e6,
    A: 0.00385,
    I: 0.0000148,
    weight: 30.2,
    grade: 'Grade 1860',
  },
  
  // Tower legs (Art Deco portal towers)
  TOWER_LEG_2000: {
    id: 'TOWER_LEG_2000',
    name: 'Tower Leg 2000x1500x60',
    type: 'TUBE',
    dimensions: {
      outerWidth: 2000,
      outerHeight: 1500,
      thickness: 60,
    },
    E: 210e6,
    A: 0.402,
    I: 0.149,
    weight: 3156,
    grade: 'S460',
  },
  
  TOWER_LEG_1800: {
    id: 'TOWER_LEG_1800',
    name: 'Tower Leg 1800x1400x55',
    type: 'TUBE',
    dimensions: {
      outerWidth: 1800,
      outerHeight: 1400,
      thickness: 55,
    },
    E: 210e6,
    A: 0.340,
    I: 0.0952,
    weight: 2669,
    grade: 'S460',
  },
  
  // Portal beams (Tower cross-beams)
  PORTAL_BEAM_1000: {
    id: 'PORTAL_BEAM_1000',
    name: 'Portal Beam I-1000x700x45x28',
    type: 'I-BEAM',
    dimensions: {
      height: 1000,
      width: 700,
      flangeThickness: 45,
      webThickness: 28,
    },
    E: 210e6,
    A: 0.0910,
    I: 0.00458,
    weight: 715,
    grade: 'S460',
  },
  
  // Tower X-bracing
  TOWER_XBRACE_700: {
    id: 'TOWER_XBRACE_700',
    name: 'Tower X-Brace I-700x500x35x20',
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
  
  // Stiffening truss - Top chord
  TOP_CHORD_800: {
    id: 'TOP_CHORD_800',
    name: 'Top Chord I-800x600x40x25',
    type: 'I-BEAM',
    dimensions: {
      height: 800,
      width: 600,
      flangeThickness: 40,
      webThickness: 25,
    },
    E: 210e6,
    A: 0.0676,
    I: 0.00216,
    weight: 531,
    grade: 'S460',
  },
  
  // Stiffening truss - Bottom chord
  BOTTOM_CHORD_800: {
    id: 'BOTTOM_CHORD_800',
    name: 'Bottom Chord I-800x600x40x25',
    type: 'I-BEAM',
    dimensions: {
      height: 800,
      width: 600,
      flangeThickness: 40,
      webThickness: 25,
    },
    E: 210e6,
    A: 0.0676,
    I: 0.00216,
    weight: 531,
    grade: 'S460',
  },
  
  // Truss verticals
  TRUSS_VERTICAL_600: {
    id: 'TRUSS_VERTICAL_600',
    name: 'Truss Vertical I-600x400x30x18',
    type: 'I-BEAM',
    dimensions: {
      height: 600,
      width: 400,
      flangeThickness: 30,
      webThickness: 18,
    },
    E: 210e6,
    A: 0.0348,
    I: 0.000624,
    weight: 273,
    grade: 'S460',
  },
  
  // Truss diagonals
  TRUSS_DIAGONAL_500: {
    id: 'TRUSS_DIAGONAL_500',
    name: 'Truss Diagonal I-500x350x25x15',
    type: 'I-BEAM',
    dimensions: {
      height: 500,
      width: 350,
      flangeThickness: 25,
      webThickness: 15,
    },
    E: 210e6,
    A: 0.0250,
    I: 0.000260,
    weight: 196,
    grade: 'S460',
  },
  
  // Floor beams
  FLOOR_BEAM_900: {
    id: 'FLOOR_BEAM_900',
    name: 'Floor Beam I-900x400x35x20',
    type: 'I-BEAM',
    dimensions: {
      height: 900,
      width: 400,
      flangeThickness: 35,
      webThickness: 20,
    },
    E: 210e6,
    A: 0.0460,
    I: 0.00175,
    weight: 361,
    grade: 'S460',
  },
  
  // Stringers
  STRINGER_500: {
    id: 'STRINGER_500',
    name: 'Stringer I-500x250x20x12',
    type: 'I-BEAM',
    dimensions: {
      height: 500,
      width: 250,
      flangeThickness: 20,
      webThickness: 12,
    },
    E: 210e6,
    A: 0.0160,
    I: 0.000167,
    weight: 126,
    grade: 'S355',
  },
};

// ============================================
// HOWRAH BRIDGE SECTIONS
// ============================================


export { GOLDEN_GATE_SECTIONS };
