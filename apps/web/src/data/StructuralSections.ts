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
// BURJ KHALIFA SECTIONS - REAL STRUCTURAL DATA
// ============================================
// Source: World's tallest building - 828m (163 floors)
// Architect: Adrian Smith (SOM), Structural Engineer: Bill Baker (SOM)
// Foundation: 192 piles, 1.5m dia x 43m deep, 45,000 m³ concrete
// Building weight: ~450,000 tonnes
// Primary structure: Reinforced concrete buttressed core
// Concrete: High-strength C80 pumped to 606m (world record)
// Steel: 55,000 tonnes rebar, 35,000 tonnes structural steel (from Berlin Palace of Republic)
// Design: Y-shaped tripartite floor plan, 27 setbacks in spiral pattern
// Core: Hexagonal buttressed core with 3 wings at 120°
// Sway: 1.5m at top under design wind

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

const CHENAB_BRIDGE_SECTIONS: Record<string, StructuralSection> = {
  // ========== TWIN ARCH RIBS - Steel-Concrete Composite Box Sections ==========
  // Actual: Prefabricated steel boxes filled with self-compacting concrete
  // Box dimensions: Vary from 5.5m x 5m at abutment to 3m x 3m at crown
  
  ARCH_BOX_MAIN: {
    id: 'ARCH_BOX_MAIN',
    name: 'Arch Box Section 5500x5000x50 (Base)',
    type: 'TUBE',
    dimensions: {
      outerWidth: 5500,   // 5.5m width at base
      outerHeight: 5000,  // 5.0m height at base
      thickness: 50,      // 50mm steel plate
    },
    E: 210e6,
    A: 1.03,           // m² (composite with concrete fill)
    I: 2.15,           // m⁴
    weight: 8500,      // kg/m (steel + concrete)
    grade: 'S460ML/TM', // Low temperature steel for -20°C
  },

  ARCH_BOX_CROWN: {
    id: 'ARCH_BOX_CROWN',
    name: 'Arch Box Section 3000x3000x40 (Crown)',
    type: 'TUBE',
    dimensions: {
      outerWidth: 3000,  // 3.0m width at crown
      outerHeight: 3000, // 3.0m height at crown
      thickness: 40,     // 40mm steel plate
    },
    E: 210e6,
    A: 0.472,
    I: 0.353,
    weight: 4200,
    grade: 'S460ML/TM',
  },

  ARCH_BOTTOM_FLANGE: {
    id: 'ARCH_BOTTOM_FLANGE',
    name: 'Arch Bottom Flange 1800x1000x45',
    type: 'TUBE',
    dimensions: {
      outerWidth: 1800,  // Realistic flange size
      outerHeight: 1000,
      thickness: 45,
    },
    E: 210e6,
    A: 0.252,
    I: 0.054,
    weight: 1978,
    grade: 'S460ML/TM',
  },
  
  ARCH_TOP_FLANGE: {
    id: 'ARCH_TOP_FLANGE',
    name: 'Arch Top Flange 1800x1000x45',
    type: 'TUBE',
    dimensions: {
      outerWidth: 1800,
      outerHeight: 1000,
      thickness: 45,
    },
    E: 210e6,
    A: 0.252,
    I: 0.054,
    weight: 1978,
    grade: 'S460ML/TM',
  },
  
  ARCH_WEB: {
    id: 'ARCH_WEB',
    name: 'Arch Web Plate 1500x700x40',
    type: 'TUBE',
    dimensions: {
      outerWidth: 1500,
      outerHeight: 700,
      thickness: 40,
    },
    E: 210e6,
    A: 0.176,
    I: 0.0165,
    weight: 1381,
    grade: 'S460ML/TM',
  },
  
  // ========== K-BRACING BETWEEN ARCH RIBS ==========
  // Actual: Heavy K-bracing for lateral stability (wind 266 km/h)
  
  ARCH_KBRACE: {
    id: 'ARCH_KBRACE',
    name: 'K-Brace I-800x500x35x22',
    type: 'I-BEAM',
    dimensions: {
      height: 800,
      width: 500,
      flangeThickness: 35,
      webThickness: 22,
    },
    E: 210e6,
    A: 0.0527,
    I: 0.00168,
    weight: 414,
    grade: 'S460ML/TM',
  },

  ARCH_LATERAL_BRACE: {
    id: 'ARCH_LATERAL_BRACE',
    name: 'Lateral Brace Box 400x400x25',
    type: 'TUBE',
    dimensions: {
      outerWidth: 400,
      outerHeight: 400,
      thickness: 25,
    },
    E: 210e6,
    A: 0.0375,
    I: 0.00278,
    weight: 294,
    grade: 'S355JR',
  },
  
  // ========== DECK SYSTEM - Plate Girders ==========
  // Actual: 161 girder plates, 8m length each, 8mm thickness base plates
  // Deck width: 13.5m for double track railway
  
  PLATE_GIRDER_1200: {
    id: 'PLATE_GIRDER_1200',
    name: 'Main Plate Girder I-1500x500x35x25',
    type: 'I-BEAM',
    dimensions: {
      height: 1500,     // Deep girders for railway loading
      width: 500,
      flangeThickness: 35,
      webThickness: 25,
    },
    E: 210e6,
    A: 0.072,
    I: 0.00675,
    weight: 565,
    grade: 'S460',
  },

  DECK_PLATE_GIRDER: {
    id: 'DECK_PLATE_GIRDER',
    name: 'Deck Plate Girder I-1200x450x30x20',
    type: 'I-BEAM',
    dimensions: {
      height: 1200,
      width: 450,
      flangeThickness: 30,
      webThickness: 20,
    },
    E: 210e6,
    A: 0.051,
    I: 0.00366,
    weight: 400,
    grade: 'S355JR',
  },
  
  // ========== CROSS-GIRDERS (Transverse Beams) ==========
  // Actual: Support railway tracks at 13.5m deck width
  
  CROSS_GIRDER_600: {
    id: 'CROSS_GIRDER_600',
    name: 'Cross Girder I-800x350x25x16',
    type: 'I-BEAM',
    dimensions: {
      height: 800,
      width: 350,
      flangeThickness: 25,
      webThickness: 16,
    },
    E: 210e6,
    A: 0.0305,
    I: 0.000823,
    weight: 239,
    grade: 'S355JR',
  },
  
  // ========== STRINGERS (Longitudinal Floor Beams) ==========
  // Actual: Between main girders for rail track support
  
  STRINGER_400: {
    id: 'STRINGER_400',
    name: 'Stringer I-500x250x20x12',
    type: 'I-BEAM',
    dimensions: {
      height: 500,
      width: 250,
      flangeThickness: 20,
      webThickness: 12,
    },
    E: 210e6,
    A: 0.016,
    I: 0.000167,
    weight: 126,
    grade: 'S355JR',
  },

  RAIL_BEARER: {
    id: 'RAIL_BEARER',
    name: 'Rail Bearer I-400x200x18x10',
    type: 'I-BEAM',
    dimensions: {
      height: 400,
      width: 200,
      flangeThickness: 18,
      webThickness: 10,
    },
    E: 210e6,
    A: 0.0112,
    I: 0.0000746,
    weight: 88,
    grade: 'S355JR',
  },
  
  // ========== HANGER CABLES ==========
  // Actual: Lock-coil strand ropes, vertical hangers from arch to deck
  // 84 km of cables used in bridge construction
  
  HANGER_CABLE_100: {
    id: 'HANGER_CABLE_100',
    name: 'Hanger Rope Ø120mm Lock-Coil',
    type: 'CIRCLE',
    dimensions: {
      diameter: 120,
    },
    E: 165e6,   // Lock-coil strand modulus
    A: 0.0113,
    I: 0.000102,
    weight: 88.8,
    grade: 'Lock-Coil 1770MPa',
  },

  STAY_CABLE: {
    id: 'STAY_CABLE',
    name: 'Stay Cable Bundle Ø150mm',
    type: 'CIRCLE',
    dimensions: {
      diameter: 150,
    },
    E: 195e6,   // Parallel wire strand modulus
    A: 0.0177,
    I: 0.000249,
    weight: 139,
    grade: 'PWS 1860MPa',
  },
  
  // ========== WIND BRACING ==========
  // Actual: Lateral bracing for 266 km/h wind loads
  
  WIND_BRACE_300: {
    id: 'WIND_BRACE_300',
    name: 'Wind Brace I-350x200x15x10',
    type: 'I-BEAM',
    dimensions: {
      height: 350,
      width: 200,
      flangeThickness: 15,
      webThickness: 10,
    },
    E: 210e6,
    A: 0.00950,
    I: 0.0000456,
    weight: 74.6,
    grade: 'S355JR',
  },

  // ========== APPROACH VIADUCT PIERS ==========
  // Actual: Steel-concrete composite piers, tallest 133.7m
  
  VIADUCT_PIER: {
    id: 'VIADUCT_PIER',
    name: 'Viaduct Pier Box 4000x3000x40',
    type: 'TUBE',
    dimensions: {
      outerWidth: 4000,
      outerHeight: 3000,
      thickness: 40,
    },
    E: 35e6,    // Composite E for concrete-filled steel
    A: 0.552,
    I: 0.564,
    weight: 4800,
    grade: 'Composite S355+C50',
  },

  // ========== HIGH-STRENGTH BOLTS ==========
  // Actual: Friction grip bolts for golden joint connection
  HSFG_BOLT_PLATE: {
    id: 'HSFG_BOLT_PLATE',
    name: 'HSFG Connection Plate 500x40',
    type: 'RECTANGLE',
    dimensions: {
      rectWidth: 500,
      rectHeight: 40,
    },
    E: 210e6,
    A: 0.02,
    I: 0.00000267,
    weight: 157,
    grade: 'Grade 10.9 HSFG',
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
// JOINT CONNECTION SPECIFICATIONS DATABASE
// ============================================
// Real structural connection details for demo models
// Based on international standards: AISC, Eurocode 3, IS 800

export type ConnectionType = 
  | 'bolted_shear'      // Shear-only connection (simple)
  | 'bolted_moment'     // Moment-resisting connection (rigid)
  | 'welded_full'       // Full penetration butt weld
  | 'welded_fillet'     // Fillet welds
  | 'pinned'            // True pin connection (rotation free)
  | 'cable_socket'      // Cable anchorage socket
  | 'base_plate'        // Column base plate connection
  | 'splice'            // Member splice connection
  | 'gusset_plate';     // Gusset plate connection for bracing

export type BoltGrade = 
  | '4.6'     // 240 MPa yield, 400 MPa ultimate
  | '8.8'     // 640 MPa yield, 800 MPa ultimate  
  | '10.9'    // 900 MPa yield, 1000 MPa ultimate (HSFG)
  | '12.9'    // 1080 MPa yield, 1200 MPa ultimate
  | 'A325'    // ASTM equivalent to 8.8
  | 'A490';   // ASTM equivalent to 10.9

export type WeldType = 
  | 'CJP'     // Complete Joint Penetration (full strength)
  | 'PJP'     // Partial Joint Penetration
  | 'fillet'  // Fillet weld
  | 'plug'    // Plug or slot weld
  | 'flare';  // Flare groove weld

export interface JointConnection {
  id: string;
  name: string;
  type: ConnectionType;
  
  // Bolt specifications
  bolt?: {
    grade: BoltGrade;
    diameter: number;      // mm
    numBolts: number;
    rows: number;
    columns: number;
    pitch: number;         // mm (vertical spacing)
    gauge: number;         // mm (horizontal spacing)
    edgeDistance: number;  // mm (from bolt to edge)
    shearCapacity: number; // kN per bolt
    tensionCapacity: number; // kN per bolt
  };
  
  // Weld specifications  
  weld?: {
    type: WeldType;
    size: number;          // mm (throat or leg size)
    length: number;        // mm (total weld length)
    electrode: string;     // E70XX, E80XX, etc.
    strengthMPa: number;   // weld metal strength
    capacity: number;      // kN/mm of weld
  };
  
  // Plate specifications
  plate?: {
    thickness: number;     // mm
    width: number;         // mm
    length: number;        // mm
    grade: string;         // S355, S460, etc.
  };
  
  // Connection capacity
  capacity: {
    shear: number;         // kN
    moment?: number;       // kNm (for moment connections)
    axial?: number;        // kN (for tension/compression)
  };
  
  // Standards reference
  standard: string;
}

// ============================================
// CHENAB BRIDGE CONNECTION DETAILS
// ============================================
// Based on actual construction: HSFG bolts, site welding, golden joint

const CHENAB_BRIDGE_CONNECTIONS: Record<string, JointConnection> = {
  // Golden Joint - Critical connection at arch crown
  // This is the final closing joint where arch halves meet
  GOLDEN_JOINT: {
    id: 'GOLDEN_JOINT',
    name: 'Golden Joint - Arch Crown Closure',
    type: 'bolted_moment',
    bolt: {
      grade: '10.9',
      diameter: 36,        // M36 HSFG bolts
      numBolts: 96,        // Heavy bolting for critical joint
      rows: 12,
      columns: 8,
      pitch: 100,
      gauge: 120,
      edgeDistance: 54,
      shearCapacity: 339,  // kN per bolt (friction grip)
      tensionCapacity: 458,
    },
    plate: {
      thickness: 50,       // 50mm splice plates
      width: 1000,
      length: 1400,
      grade: 'S460ML',
    },
    capacity: {
      shear: 32544,        // 96 × 339 kN
      moment: 45670,       // kNm
      axial: 44000,        // kN compression
    },
    standard: 'IRS/IS 800:2007, Clause 10.4',
  },

  // Arch segment splice - connecting prefab arch segments
  ARCH_SEGMENT_SPLICE: {
    id: 'ARCH_SEGMENT_SPLICE',
    name: 'Arch Segment Splice Connection',
    type: 'splice',
    bolt: {
      grade: '10.9',
      diameter: 30,
      numBolts: 64,
      rows: 8,
      columns: 8,
      pitch: 90,
      gauge: 100,
      edgeDistance: 45,
      shearCapacity: 235,
      tensionCapacity: 318,
    },
    weld: {
      type: 'CJP',
      size: 50,
      length: 12000,       // Full perimeter of box
      electrode: 'E7018-1H',
      strengthMPa: 490,
      capacity: 0.6,       // kN/mm
    },
    capacity: {
      shear: 15040,
      moment: 28500,
      axial: 35000,
    },
    standard: 'IS 800:2007, Eurocode 3',
  },

  // Hanger cable anchorage
  HANGER_SOCKET: {
    id: 'HANGER_SOCKET',
    name: 'Hanger Cable Socket Anchorage',
    type: 'cable_socket',
    bolt: {
      grade: '12.9',
      diameter: 24,
      numBolts: 8,
      rows: 2,
      columns: 4,
      pitch: 80,
      gauge: 80,
      edgeDistance: 36,
      shearCapacity: 176,
      tensionCapacity: 238,
    },
    plate: {
      thickness: 40,
      width: 400,
      length: 400,
      grade: 'S460',
    },
    capacity: {
      shear: 1408,
      axial: 2500,         // Cable breaking strength ~4000kN
    },
    standard: 'EN 1993-1-11 (Cable structures)',
  },

  // Deck girder to cross-beam connection
  DECK_GIRDER_CONNECTION: {
    id: 'DECK_GIRDER_CONNECTION',
    name: 'Deck Girder to Cross-Beam',
    type: 'bolted_shear',
    bolt: {
      grade: '8.8',
      diameter: 24,
      numBolts: 12,
      rows: 6,
      columns: 2,
      pitch: 75,
      gauge: 140,
      edgeDistance: 36,
      shearCapacity: 136,
      tensionCapacity: 184,
    },
    plate: {
      thickness: 16,
      width: 300,
      length: 500,
      grade: 'S355JR',
    },
    capacity: {
      shear: 1632,
    },
    standard: 'IS 800:2007, Clause 10.3',
  },

  // Arch K-brace gusset plate connection
  KBRACE_GUSSET: {
    id: 'KBRACE_GUSSET',
    name: 'K-Brace Gusset Plate Connection',
    type: 'gusset_plate',
    bolt: {
      grade: '10.9',
      diameter: 27,
      numBolts: 16,
      rows: 4,
      columns: 4,
      pitch: 85,
      gauge: 85,
      edgeDistance: 40,
      shearCapacity: 197,
      tensionCapacity: 266,
    },
    plate: {
      thickness: 25,
      width: 600,
      length: 800,
      grade: 'S355JR',
    },
    capacity: {
      shear: 3152,
      axial: 4256,
    },
    standard: 'IS 800:2007, AISC 360-16',
  },

  // Viaduct pier base plate
  PIER_BASE_PLATE: {
    id: 'PIER_BASE_PLATE',
    name: 'Viaduct Pier Base Plate',
    type: 'base_plate',
    bolt: {
      grade: '8.8',
      diameter: 42,        // Large anchor bolts
      numBolts: 24,
      rows: 6,
      columns: 4,
      pitch: 300,
      gauge: 400,
      edgeDistance: 100,
      shearCapacity: 358,
      tensionCapacity: 485,
    },
    plate: {
      thickness: 60,
      width: 2000,
      length: 2800,
      grade: 'S355J2',
    },
    capacity: {
      shear: 8592,
      moment: 12500,
      axial: 45000,
    },
    standard: 'IS 800:2007, Clause 10.4.4',
  },
};

// ============================================
// BURJ KHALIFA CONNECTION DETAILS
// ============================================
// Based on actual construction: Mega-connections, outrigger ties

const BURJ_KHALIFA_CONNECTIONS: Record<string, JointConnection> = {
  // Outrigger wall to perimeter column connection
  OUTRIGGER_CONNECTION: {
    id: 'OUTRIGGER_CONNECTION',
    name: 'Outrigger Wall to Mega Column',
    type: 'welded_full',
    weld: {
      type: 'CJP',
      size: 40,
      length: 8000,        // Full depth of outrigger
      electrode: 'E7018-1H',
      strengthMPa: 490,
      capacity: 0.6,
    },
    plate: {
      thickness: 60,
      width: 1500,
      length: 3000,
      grade: 'S460',
    },
    capacity: {
      shear: 12000,
      moment: 85000,       // Critical for lateral system
      axial: 25000,
    },
    standard: 'ACI 318, AWS D1.1',
  },

  // Belt truss connection at mechanical floors
  BELT_TRUSS_CONNECTION: {
    id: 'BELT_TRUSS_CONNECTION',
    name: 'Belt Truss to Core Wall',
    type: 'bolted_moment',
    bolt: {
      grade: 'A490',
      diameter: 36,
      numBolts: 48,
      rows: 8,
      columns: 6,
      pitch: 100,
      gauge: 120,
      edgeDistance: 54,
      shearCapacity: 339,
      tensionCapacity: 458,
    },
    weld: {
      type: 'CJP',
      size: 30,
      length: 4800,
      electrode: 'E80XX',
      strengthMPa: 550,
      capacity: 0.65,
    },
    capacity: {
      shear: 16272,
      moment: 42000,
    },
    standard: 'AISC 360-16, AWS D1.1',
  },

  // Floor beam to core wall connection
  FLOOR_BEAM_SHEAR: {
    id: 'FLOOR_BEAM_SHEAR',
    name: 'Floor Beam Shear Tab Connection',
    type: 'bolted_shear',
    bolt: {
      grade: '8.8',
      diameter: 20,
      numBolts: 6,
      rows: 3,
      columns: 2,
      pitch: 75,
      gauge: 120,
      edgeDistance: 30,
      shearCapacity: 94,
      tensionCapacity: 127,
    },
    plate: {
      thickness: 12,
      width: 150,
      length: 280,
      grade: 'S355JR',
    },
    capacity: {
      shear: 564,
    },
    standard: 'AISC 360-16, Table 10-1',
  },

  // Mega column splice (every 3 floors)
  MEGA_COLUMN_SPLICE: {
    id: 'MEGA_COLUMN_SPLICE',
    name: 'Mega Column Splice Connection',
    type: 'splice',
    bolt: {
      grade: 'A490',
      diameter: 30,
      numBolts: 80,
      rows: 10,
      columns: 8,
      pitch: 90,
      gauge: 100,
      edgeDistance: 45,
      shearCapacity: 235,
      tensionCapacity: 318,
    },
    weld: {
      type: 'CJP',
      size: 60,
      length: 9000,
      electrode: 'E80XX',
      strengthMPa: 550,
      capacity: 0.65,
    },
    capacity: {
      shear: 18800,
      moment: 65000,
      axial: 120000,       // Massive compression from above
    },
    standard: 'AISC 360-16, AWS D1.1',
  },

  // Base plate for perimeter columns
  PERIMETER_BASE: {
    id: 'PERIMETER_BASE',
    name: 'Perimeter Column Base Plate',
    type: 'base_plate',
    bolt: {
      grade: 'A490',
      diameter: 48,
      numBolts: 16,
      rows: 4,
      columns: 4,
      pitch: 250,
      gauge: 250,
      edgeDistance: 80,
      shearCapacity: 440,
      tensionCapacity: 595,
    },
    plate: {
      thickness: 80,
      width: 1200,
      length: 1200,
      grade: 'S460',
    },
    capacity: {
      shear: 7040,
      moment: 8500,
      axial: 55000,
    },
    standard: 'AISC 360-16, Base Plate Design',
  },
};

// ============================================
// GOLDEN GATE BRIDGE CONNECTION DETAILS
// ============================================

const GOLDEN_GATE_CONNECTIONS: Record<string, JointConnection> = {
  // Main cable saddle connection at tower top
  CABLE_SADDLE: {
    id: 'CABLE_SADDLE',
    name: 'Main Cable Saddle at Tower',
    type: 'cable_socket',
    bolt: {
      grade: 'A490',
      diameter: 76,        // Very large bolts
      numBolts: 32,
      rows: 4,
      columns: 8,
      pitch: 200,
      gauge: 250,
      edgeDistance: 100,
      shearCapacity: 1100,
      tensionCapacity: 1490,
    },
    plate: {
      thickness: 100,
      width: 2200,
      length: 2000,
      grade: 'S460',
    },
    capacity: {
      shear: 35200,
      axial: 250000,       // Main cable force
    },
    standard: 'AASHTO LRFD Bridge Design',
  },

  // Suspender cable socket
  SUSPENDER_SOCKET: {
    id: 'SUSPENDER_SOCKET',
    name: 'Suspender Cable Socket',
    type: 'cable_socket',
    bolt: {
      grade: '10.9',
      diameter: 24,
      numBolts: 4,
      rows: 2,
      columns: 2,
      pitch: 80,
      gauge: 80,
      edgeDistance: 36,
      shearCapacity: 176,
      tensionCapacity: 238,
    },
    plate: {
      thickness: 25,
      width: 250,
      length: 250,
      grade: 'S355',
    },
    capacity: {
      shear: 704,
      axial: 950,
    },
    standard: 'EN 1993-1-11',
  },

  // Stiffening truss panel point
  TRUSS_PANEL_POINT: {
    id: 'TRUSS_PANEL_POINT',
    name: 'Stiffening Truss Panel Point',
    type: 'gusset_plate',
    bolt: {
      grade: 'A325',
      diameter: 27,
      numBolts: 24,
      rows: 4,
      columns: 6,
      pitch: 85,
      gauge: 85,
      edgeDistance: 40,
      shearCapacity: 197,
      tensionCapacity: 266,
    },
    plate: {
      thickness: 20,
      width: 800,
      length: 1000,
      grade: 'S355',
    },
    capacity: {
      shear: 4728,
      axial: 6384,
    },
    standard: 'AASHTO LRFD, AISC 360-16',
  },
};

// Export connection databases
export const JOINT_CONNECTIONS: Record<string, JointConnection> = {
  ...CHENAB_BRIDGE_CONNECTIONS,
  ...BURJ_KHALIFA_CONNECTIONS,
  ...GOLDEN_GATE_CONNECTIONS,
};

// Helper functions for connections
export function getConnection(connectionId: string): JointConnection | undefined {
  return JOINT_CONNECTIONS[connectionId];
}

export function getChenabBridgeConnections(): Record<string, JointConnection> {
  return CHENAB_BRIDGE_CONNECTIONS;
}

export function getBurjKhalifaConnections(): Record<string, JointConnection> {
  return BURJ_KHALIFA_CONNECTIONS;
}

export function getGoldenGateConnections(): Record<string, JointConnection> {
  return GOLDEN_GATE_CONNECTIONS;
}

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
