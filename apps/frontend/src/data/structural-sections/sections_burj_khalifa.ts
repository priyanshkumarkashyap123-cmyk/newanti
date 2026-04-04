import type { StructuralSection } from './types';

const BURJ_KHALIFA_SECTIONS: Record<string, StructuralSection> = {
  // ========== MEGA-COLUMNS (Concrete-Filled Composite Tubes) ==========
  // Actual: Composite columns at base of Y-wings, grade up as building rises
  // Base: 3m x 1.5m sections, reducing with height
  
  MEGA_COLUMN_3000: {
    id: 'MEGA_COLUMN_3000',
    name: 'Mega Column 3000x1500x80 (Base Levels)',
    type: 'TUBE',
    dimensions: {
      outerWidth: 3000,   // 3.0m width at base
      outerHeight: 1500,  // 1.5m depth
      thickness: 80,      // 80mm steel plate
    },
    E: 35e6,     // Composite modulus (C80 concrete + S460 steel)
    A: 0.70,     // m² (composite section)
    I: 0.525,    // m⁴
    weight: 5500, // kg/m (steel + C80 concrete fill)
    grade: 'Composite C80+S460',
  },

  MEGA_COLUMN_2000: {
    id: 'MEGA_COLUMN_2000',
    name: 'Mega Column 2000x1200x60 (Mid Levels)',
    type: 'TUBE',
    dimensions: {
      outerWidth: 2000,
      outerHeight: 1200,
      thickness: 60,
    },
    E: 35e6,
    A: 0.38,
    I: 0.127,
    weight: 3200,
    grade: 'Composite C80+S460',
  },

  MEGA_COLUMN_1200: {
    id: 'MEGA_COLUMN_1200',
    name: 'Mega Column 1200x1200x50 (Upper Levels)',
    type: 'TUBE',
    dimensions: {
      outerWidth: 1200,
      outerHeight: 1200,
      thickness: 50,
    },
    E: 35e6,
    A: 0.23,
    I: 0.0267,
    weight: 1805,
    grade: 'Composite C80+S460',
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
// CHENAB BRIDGE SECTIONS - REAL STRUCTURAL DATA
// ============================================
// Source: World's highest railway bridge - 1315m total, 467m arch span
// Height: 359m above Chenab River (higher than Eiffel Tower)
// Steel used: 28,660 tonnes of high-strength steel (SAIL supplied)
// Concrete: 66,000 m³ self-compacting concrete
// Design life: 120 years, Earthquake: Zone V (Richter 8.0)
// Wind resistance: 266 km/h, Temperature: -20°C to +40°C
// Designers: WSP Finland, Leonhardt Andrä und Partner (arches)
// Standards: IRS, IS, BS, UIC compliant


export { BURJ_KHALIFA_SECTIONS };
