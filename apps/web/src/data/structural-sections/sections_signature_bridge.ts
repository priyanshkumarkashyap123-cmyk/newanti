import type { StructuralSection } from './types';

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


export { SIGNATURE_BRIDGE_SECTIONS };
