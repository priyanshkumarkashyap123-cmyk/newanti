import type { StructuralSection } from './types';

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


export { BANDRA_WORLI_SECTIONS };
