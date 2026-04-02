import type { StructuralSection } from './types';

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


export { CHENAB_BRIDGE_SECTIONS };
