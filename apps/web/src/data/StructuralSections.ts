/**
 * StructuralSections.ts - Real Steel Section Database
 * 
 * Comprehensive section library for all iconic structures with:
 * - Actual section geometries (I-beams, box sections, cables, angles, plates)
 * - Full material properties (E, A, I)
 * - 3D rendering dimensions for proper visualization
 * - Based on real-world structural engineering standards
 */

export type SectionType = 'I-BEAM' | 'TUBE' | 'L-ANGLE' | 'RECTANGLE' | 'CIRCLE' | 'C-CHANNEL';

export interface SectionDimensions {
  // I-BEAM dimensions
  height?: number;      // Web depth (mm)
  width?: number;       // Flange width (mm)
  webThickness?: number;
  flangeThickness?: number;
  
  // TUBE/BOX dimensions
  outerWidth?: number;
  outerHeight?: number;
  thickness?: number;
  
  // L-ANGLE dimensions
  legWidth?: number;
  legHeight?: number;
  
  // RECTANGLE/PLATE dimensions
  rectWidth?: number;
  rectHeight?: number;
  
  // CIRCLE/CABLE dimensions
  diameter?: number;
  
  // C-CHANNEL dimensions
  channelHeight?: number;
  channelWidth?: number;
  channelThickness?: number;
}

export interface StructuralSection {
  id: string;
  name: string;
  type: SectionType;
  dimensions: SectionDimensions;
  
  // Material properties
  E: number;    // Young's modulus (kN/m²)
  A: number;    // Cross-sectional area (m²)
  I: number;    // Second moment of area (m⁴)
  
  // Additional properties
  weight?: number;  // kg/m
  grade?: string;   // Steel grade
}

// ============================================
// BURJ KHALIFA SECTIONS
// ============================================

const BURJ_KHALIFA_SECTIONS: Record<string, StructuralSection> = {
  // Mega-columns (Composite: concrete-filled steel tubes)
  MEGA_COLUMN_1200: {
    id: 'MEGA_COLUMN_1200',
    name: 'Mega Column 1200x1200x50',
    type: 'TUBE',
    dimensions: {
      outerWidth: 1200,
      outerHeight: 1200,
      thickness: 50,
    },
    E: 210e6,  // kN/m²
    A: 0.23,   // m²
    I: 0.0267, // m⁴
    weight: 1805,
    grade: 'S460',
  },
  
  MEGA_COLUMN_1000: {
    id: 'MEGA_COLUMN_1000',
    name: 'Mega Column 1000x1000x40',
    type: 'TUBE',
    dimensions: {
      outerWidth: 1000,
      outerHeight: 1000,
      thickness: 40,
    },
    E: 210e6,
    A: 0.154,
    I: 0.0125,
    weight: 1209,
    grade: 'S460',
  },
  
  MEGA_COLUMN_800: {
    id: 'MEGA_COLUMN_800',
    name: 'Mega Column 800x800x35',
    type: 'TUBE',
    dimensions: {
      outerWidth: 800,
      outerHeight: 800,
      thickness: 35,
    },
    E: 210e6,
    A: 0.108,
    I: 0.0056,
    weight: 848,
    grade: 'S460',
  },
  
  // Core walls (Reinforced concrete - represented as thick rectangles)
  CORE_WALL_600: {
    id: 'CORE_WALL_600',
    name: 'Core Wall 600x400',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 600,
      rectHeight: 400,
    },
    E: 30e6,   // Concrete modulus
    A: 0.24,   // m²
    I: 0.0072, // m⁴
    weight: 600,
    grade: 'C80',
  },
  
  CORE_WALL_500: {
    id: 'CORE_WALL_500',
    name: 'Core Wall 500x400',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 500,
      rectHeight: 400,
    },
    E: 30e6,
    A: 0.20,
    I: 0.00417,
    weight: 500,
    grade: 'C80',
  },
  
  // Outrigger trusses (Heavy I-sections)
  OUTRIGGER_TRUSS_800: {
    id: 'OUTRIGGER_TRUSS_800',
    name: 'Outrigger I-Beam 800x600x40x25',
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
  
  OUTRIGGER_TRUSS_600: {
    id: 'OUTRIGGER_TRUSS_600',
    name: 'Outrigger I-Beam 600x500x35x20',
    type: 'I-BEAM',
    dimensions: {
      height: 600,
      width: 500,
      flangeThickness: 35,
      webThickness: 20,
    },
    E: 210e6,
    A: 0.046,
    I: 0.000834,
    weight: 361,
    grade: 'S460',
  },
  
  // Belt trusses
  BELT_TRUSS_700: {
    id: 'BELT_TRUSS_700',
    name: 'Belt Truss I-Beam 700x550x35x22',
    type: 'I-BEAM',
    dimensions: {
      height: 700,
      width: 550,
      flangeThickness: 35,
      webThickness: 22,
    },
    E: 210e6,
    A: 0.0539,
    I: 0.00132,
    weight: 423,
    grade: 'S460',
  },
  
  // Wing beams (Floor beams in Y-wings)
  WING_BEAM_500: {
    id: 'WING_BEAM_500',
    name: 'Wing Beam I-500x300x20x12',
    type: 'I-BEAM',
    dimensions: {
      height: 500,
      width: 300,
      flangeThickness: 20,
      webThickness: 12,
    },
    E: 210e6,
    A: 0.0174,
    I: 0.000182,
    weight: 137,
    grade: 'S355',
  },
  
  WING_BEAM_400: {
    id: 'WING_BEAM_400',
    name: 'Wing Beam I-400x250x18x10',
    type: 'I-BEAM',
    dimensions: {
      height: 400,
      width: 250,
      flangeThickness: 18,
      webThickness: 10,
    },
    E: 210e6,
    A: 0.0130,
    I: 0.0000833,
    weight: 102,
    grade: 'S355',
  },
  
  // Spandrel beams (Perimeter beams)
  SPANDREL_BEAM_350: {
    id: 'SPANDREL_BEAM_350',
    name: 'Spandrel Beam I-350x220x15x9',
    type: 'I-BEAM',
    dimensions: {
      height: 350,
      width: 220,
      flangeThickness: 15,
      webThickness: 9,
    },
    E: 210e6,
    A: 0.0096,
    I: 0.0000491,
    weight: 75,
    grade: 'S355',
  },
  
  // Perimeter columns (Composite: Concrete-filled steel tubes)
  PERIMETER_COL_600: {
    id: 'PERIMETER_COL_600',
    name: 'Perimeter Column 600x600 Composite',
    type: 'RECTANGLE',  // Changed to RECTANGLE to represent concrete
    dimensions: {
      rectWidth: 600,
      rectHeight: 600,
    },
    E: 35e6,  // Composite modulus (concrete-filled steel)
    A: 0.36,  // m² (solid concrete cross-section)
    I: 0.0108,  // m⁴
    weight: 900,  // kg/m (heavier due to concrete)
    grade: 'Composite C80+S460',
  },
  
  PERIMETER_COL_400: {
    id: 'PERIMETER_COL_400',
    name: 'Perimeter Column 400x400 Composite',
    type: 'RECTANGLE',  // Changed to RECTANGLE to represent concrete
    dimensions: {
      rectWidth: 400,
      rectHeight: 400,
    },
    E: 35e6,  // Composite modulus
    A: 0.16,  // m² (solid concrete cross-section)
    I: 0.00213,  // m⁴
    weight: 400,  // kg/m
    grade: 'Composite C80+S460',
  },
  
  // Buttress walls (Wing walls)
  BUTTRESS_WALL_500: {
    id: 'BUTTRESS_WALL_500',
    name: 'Buttress Wall 500x350',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 500,
      rectHeight: 350,
    },
    E: 30e6,
    A: 0.175,
    I: 0.00179,
    weight: 438,
    grade: 'C80',
  },

  // Additional Burj Khalifa sections (realistic concrete and steel)
  CORE_WALL_600x400: {
    id: 'CORE_WALL_600x400',
    name: 'Core Wall 600x400 RC',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 600,
      rectHeight: 400,
    },
    E: 30e6,   // Concrete modulus
    A: 0.24,
    I: 0.0072,
    weight: 600,
    grade: 'C80',
  },

  CORE_WALL_400x300: {
    id: 'CORE_WALL_400x300',
    name: 'Core Wall 400x300 RC',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 400,
      rectHeight: 300,
    },
    E: 30e6,
    A: 0.12,
    I: 0.0036,
    weight: 300,
    grade: 'C80',
  },

  CORE_BEAM_450x300: {
    id: 'CORE_BEAM_450x300',
    name: 'Core Beam 450x300 RC',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 450,
      rectHeight: 300,
    },
    E: 30e6,
    A: 0.135,
    I: 0.00253,
    weight: 338,
    grade: 'C80',
  },

  PERIMETER_COL_800x800: {
    id: 'PERIMETER_COL_800x800',
    name: 'Perimeter Column 800x800 Composite',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 800,
      rectHeight: 800,
    },
    E: 35e6,
    A: 0.64,
    I: 0.0341,
    weight: 1600,
    grade: 'Composite C80',
  },

  PERIMETER_COL_600x600: {
    id: 'PERIMETER_COL_600x600',
    name: 'Perimeter Column 600x600 Composite',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 600,
      rectHeight: 600,
    },
    E: 35e6,
    A: 0.36,
    I: 0.0108,
    weight: 900,
    grade: 'Composite C80',
  },

  PERIMETER_COL_500x500: {
    id: 'PERIMETER_COL_500x500',
    name: 'Perimeter Column 500x500 Composite',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 500,
      rectHeight: 500,
    },
    E: 35e6,
    A: 0.25,
    I: 0.00521,
    weight: 625,
    grade: 'Composite C80',
  },

  OUTRIGGER_TRUSS_800x600: {
    id: 'OUTRIGGER_TRUSS_800x600',
    name: 'Outrigger Truss I-800x600x40x25',
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

  BELT_TRUSS_700x500: {
    id: 'BELT_TRUSS_700x500',
    name: 'Belt Truss I-700x500x35x22',
    type: 'I-BEAM',
    dimensions: {
      height: 700,
      width: 500,
      flangeThickness: 35,
      webThickness: 22,
    },
    E: 210e6,
    A: 0.0539,
    I: 0.00132,
    weight: 423,
    grade: 'S460',
  },
  
  // Floor beams (Secondary beams)
  FLOOR_BEAM_300: {
    id: 'FLOOR_BEAM_300',
    name: 'Floor Beam I-300x180x12x8',
    type: 'I-BEAM',
    dimensions: {
      height: 300,
      width: 180,
      flangeThickness: 12,
      webThickness: 8,
    },
    E: 210e6,
    A: 0.00662,
    I: 0.0000224,
    weight: 52,
    grade: 'S355',
  },
};

// ============================================
// CHENAB BRIDGE SECTIONS
// ============================================

const CHENAB_BRIDGE_SECTIONS: Record<string, StructuralSection> = {
  // Arch ribs - Box sections (twin steel tubes)
  ARCH_BOTTOM_FLANGE: {
    id: 'ARCH_BOTTOM_FLANGE',
    name: 'Arch Bottom Flange 1500x800x40',
    type: 'TUBE',
    dimensions: {
      outerWidth: 1500,
      outerHeight: 800,
      thickness: 40,
    },
    E: 210e6,
    A: 0.178,
    I: 0.0265,
    weight: 1397,
    grade: 'S460',
  },
  
  ARCH_TOP_FLANGE: {
    id: 'ARCH_TOP_FLANGE',
    name: 'Arch Top Flange 1500x800x40',
    type: 'TUBE',
    dimensions: {
      outerWidth: 1500,
      outerHeight: 800,
      thickness: 40,
    },
    E: 210e6,
    A: 0.178,
    I: 0.0265,
    weight: 1397,
    grade: 'S460',
  },
  
  ARCH_WEB: {
    id: 'ARCH_WEB',
    name: 'Arch Web 1200x600x35',
    type: 'TUBE',
    dimensions: {
      outerWidth: 1200,
      outerHeight: 600,
      thickness: 35,
    },
    E: 210e6,
    A: 0.122,
    I: 0.00875,
    weight: 958,
    grade: 'S460',
  },
  
  // K-bracing between arch ribs
  ARCH_KBRACE: {
    id: 'ARCH_KBRACE',
    name: 'Arch K-Brace I-600x400x30x18',
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
  
  // Plate girder deck (main longitudinal girders)
  PLATE_GIRDER_1200: {
    id: 'PLATE_GIRDER_1200',
    name: 'Plate Girder I-1200x400x30x20',
    type: 'I-BEAM',
    dimensions: {
      height: 1200,
      width: 400,
      flangeThickness: 30,
      webThickness: 20,
    },
    E: 210e6,
    A: 0.048,
    I: 0.00346,
    weight: 377,
    grade: 'S460',
  },
  
  // Cross-girders (transverse beams)
  CROSS_GIRDER_600: {
    id: 'CROSS_GIRDER_600',
    name: 'Cross Girder I-600x300x20x12',
    type: 'I-BEAM',
    dimensions: {
      height: 600,
      width: 300,
      flangeThickness: 20,
      webThickness: 12,
    },
    E: 210e6,
    A: 0.0192,
    I: 0.000216,
    weight: 151,
    grade: 'S355',
  },
  
  // Stringers (longitudinal floor beams)
  STRINGER_400: {
    id: 'STRINGER_400',
    name: 'Stringer I-400x200x15x10',
    type: 'I-BEAM',
    dimensions: {
      height: 400,
      width: 200,
      flangeThickness: 15,
      webThickness: 10,
    },
    E: 210e6,
    A: 0.0100,
    I: 0.0000667,
    weight: 78.5,
    grade: 'S355',
  },
  
  // Hanger cables (vertical hangers from arch to deck)
  HANGER_CABLE_100: {
    id: 'HANGER_CABLE_100',
    name: 'Hanger Cable Ø100mm',
    type: 'CIRCLE',
    dimensions: {
      diameter: 100,
    },
    E: 165e6,  // Steel strand modulus
    A: 0.00785,
    I: 0.0000491,
    weight: 61.7,
    grade: 'Grade 1860',
  },
  
  // Wind bracing (lateral bracing in deck)
  WIND_BRACE_300: {
    id: 'WIND_BRACE_300',
    name: 'Wind Brace I-300x150x12x8',
    type: 'I-BEAM',
    dimensions: {
      height: 300,
      width: 150,
      flangeThickness: 12,
      webThickness: 8,
    },
    E: 210e6,
    A: 0.00600,
    I: 0.0000135,
    weight: 47.1,
    grade: 'S355',
  },
};

// ============================================
// GOLDEN GATE BRIDGE SECTIONS
// ============================================

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

const BANDRA_WORLI_SECTIONS: Record<string, StructuralSection> = {
  // Inverted-Y tower base legs
  TOWER_BASE_LEG: {
    id: 'TOWER_BASE_LEG',
    name: 'Tower Base Leg 1600x1200x50',
    type: 'TUBE',
    dimensions: {
      outerWidth: 1600,
      outerHeight: 1200,
      thickness: 50,
    },
    E: 210e6,
    A: 0.270,
    I: 0.0576,
    weight: 2120,
    grade: 'S460',
  },
  
  // Tower pylons (upper vertical legs)
  TOWER_PYLON: {
    id: 'TOWER_PYLON',
    name: 'Tower Pylon 1400x1000x45',
    type: 'TUBE',
    dimensions: {
      outerWidth: 1400,
      outerHeight: 1000,
      thickness: 45,
    },
    E: 210e6,
    A: 0.206,
    I: 0.0334,
    weight: 1617,
    grade: 'S460',
  },
  
  // Tower cross-beams
  TOWER_XBEAM_900: {
    id: 'TOWER_XBEAM_900',
    name: 'Tower Cross-Beam I-900x650x40x25',
    type: 'I-BEAM',
    dimensions: {
      height: 900,
      width: 650,
      flangeThickness: 40,
      webThickness: 25,
    },
    E: 210e6,
    A: 0.0740,
    I: 0.00300,
    weight: 581,
    grade: 'S460',
  },
  
  // Stay cables (Semi-harp arrangement)
  STAY_CABLE_140: {
    id: 'STAY_CABLE_140',
    name: 'Stay Cable Ø140mm',
    type: 'CIRCLE',
    dimensions: {
      diameter: 140,
    },
    E: 165e6,
    A: 0.0154,
    I: 0.000188,
    weight: 121,
    grade: 'Grade 1860',
  },
  
  STAY_CABLE_120: {
    id: 'STAY_CABLE_120',
    name: 'Stay Cable Ø120mm',
    type: 'CIRCLE',
    dimensions: {
      diameter: 120,
    },
    E: 165e6,
    A: 0.0113,
    I: 0.000127,
    weight: 88.7,
    grade: 'Grade 1860',
  },
  
  // Box girder deck - Webs
  BOX_GIRDER_WEB_1800: {
    id: 'BOX_GIRDER_WEB_1800',
    name: 'Box Girder Web 1800x40',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 40,
      rectHeight: 1800,
    },
    E: 210e6,
    A: 0.072,
    I: 0.00311,
    weight: 565,
    grade: 'S460',
  },
  
  // Box girder - Top/Bottom slabs
  BOX_GIRDER_SLAB: {
    id: 'BOX_GIRDER_SLAB',
    name: 'Box Girder Slab 8000x35',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 8000,
      rectHeight: 35,
    },
    E: 210e6,
    A: 0.280,
    I: 0.00286,
    weight: 2198,
    grade: 'S460',
  },
  
  // Diaphragms (Internal transverse frames)
  DIAPHRAGM_700: {
    id: 'DIAPHRAGM_700',
    name: 'Diaphragm I-700x450x32x20',
    type: 'I-BEAM',
    dimensions: {
      height: 700,
      width: 450,
      flangeThickness: 32,
      webThickness: 20,
    },
    E: 210e6,
    A: 0.0428,
    I: 0.00112,
    weight: 336,
    grade: 'S460',
  },
};

// ============================================
// WARREN TRUSS RAILWAY SECTIONS
// ============================================

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

const SIGNATURE_BRIDGE_SECTIONS: Record<string, StructuralSection> = {
  // Pylon (inclined asymmetric tower)
  PYLON_LOWER: {
    id: 'PYLON_LOWER',
    name: 'Pylon Lower Section 2200x1800x65',
    type: 'TUBE',
    dimensions: {
      outerWidth: 2200,
      outerHeight: 1800,
      thickness: 65,
    },
    E: 210e6,
    A: 0.502,
    I: 0.202,
    weight: 3941,
    grade: 'S460',
  },
  
  PYLON_UPPER: {
    id: 'PYLON_UPPER',
    name: 'Pylon Upper Section 1800x1500x55',
    type: 'TUBE',
    dimensions: {
      outerWidth: 1800,
      outerHeight: 1500,
      thickness: 55,
    },
    E: 210e6,
    A: 0.350,
    I: 0.100,
    weight: 2748,
    grade: 'S460',
  },
  
  // Stay cables (Asymmetric harp arrangement)
  STAY_CABLE_160: {
    id: 'STAY_CABLE_160',
    name: 'Stay Cable Ø160mm',
    type: 'CIRCLE',
    dimensions: {
      diameter: 160,
    },
    E: 165e6,
    A: 0.0201,
    I: 0.000322,
    weight: 158,
    grade: 'Grade 1860',
  },
  
  STAY_CABLE_130: {
    id: 'STAY_CABLE_130',
    name: 'Stay Cable Ø130mm',
    type: 'CIRCLE',
    dimensions: {
      diameter: 130,
    },
    E: 165e6,
    A: 0.0133,
    I: 0.000177,
    weight: 104,
    grade: 'Grade 1860',
  },
  
  // Box girder deck
  SIGNATURE_BOX_WEB: {
    id: 'SIGNATURE_BOX_WEB',
    name: 'Signature Box Web 1600x38',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 38,
      rectHeight: 1600,
    },
    E: 210e6,
    A: 0.0608,
    I: 0.00217,
    weight: 477,
    grade: 'S460',
  },
  
  SIGNATURE_BOX_SLAB: {
    id: 'SIGNATURE_BOX_SLAB',
    name: 'Signature Box Slab 7500x32',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 7500,
      rectHeight: 32,
    },
    E: 210e6,
    A: 0.240,
    I: 0.00205,
    weight: 1884,
    grade: 'S460',
  },
};

// ============================================
// EXPORT COMBINED DATABASE
// ============================================

export const STRUCTURAL_SECTIONS: Record<string, StructuralSection> = {
  ...BURJ_KHALIFA_SECTIONS,
  ...CHENAB_BRIDGE_SECTIONS,
  ...GOLDEN_GATE_SECTIONS,
  ...HOWRAH_BRIDGE_SECTIONS,
  ...BANDRA_WORLI_SECTIONS,
  ...WARREN_TRUSS_SECTIONS,
  ...SIGNATURE_BRIDGE_SECTIONS,
};

// Helper function to get section by ID
export function getSection(sectionId: string): StructuralSection | undefined {
  return STRUCTURAL_SECTIONS[sectionId];
}

// Helper function to get all sections of a specific type
export function getSectionsByType(type: SectionType): StructuralSection[] {
  return Object.values(STRUCTURAL_SECTIONS).filter(s => s.type === type);
}

// Helper function to get sections by structure
export function getBurjKhalifaSections(): Record<string, StructuralSection> {
  return BURJ_KHALIFA_SECTIONS;
}

export function getChenabBridgeSections(): Record<string, StructuralSection> {
  return CHENAB_BRIDGE_SECTIONS;
}

export function getGoldenGateSections(): Record<string, StructuralSection> {
  return GOLDEN_GATE_SECTIONS;
}

export function getHowrahBridgeSections(): Record<string, StructuralSection> {
  return HOWRAH_BRIDGE_SECTIONS;
}

export function getBandraWorliSections(): Record<string, StructuralSection> {
  return BANDRA_WORLI_SECTIONS;
}

export function getWarrenTrussSections(): Record<string, StructuralSection> {
  return WARREN_TRUSS_SECTIONS;
}

export function getSignatureBridgeSections(): Record<string, StructuralSection> {
  return SIGNATURE_BRIDGE_SECTIONS;
}
