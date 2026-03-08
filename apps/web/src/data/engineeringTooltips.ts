/**
 * Engineering Field Tooltips
 * Provides explanatory tooltips for common structural engineering parameters.
 * Each entry includes a short label, description, and IS/ACI/AISC code reference.
 */

export interface FieldTooltip {
  label: string;
  description: string;
  clause?: string;
}

export const engineeringTooltips: Record<string, FieldTooltip> = {
  // Concrete material properties
  fck: {
    label: 'fck (MPa)',
    description: 'Characteristic compressive strength of concrete at 28 days. Typical values: M20=20, M25=25, M30=30.',
    clause: 'IS 456 Cl. 6.2.1'
  },
  fy: {
    label: 'fy (MPa)',
    description: 'Characteristic yield strength of reinforcing steel. Fe415=415 MPa, Fe500=500 MPa.',
    clause: 'IS 456 Cl. 5.6'
  },
  cover: {
    label: 'Clear Cover (mm)',
    description: 'Minimum concrete cover to outermost reinforcement for durability and fire resistance.',
    clause: 'IS 456 Cl. 26.4'
  },

  // Beam parameters
  span: {
    label: 'Span (mm)',
    description: 'Clear span or effective span of the beam between supports.',
    clause: 'IS 456 Cl. 22.2'
  },
  width: {
    label: 'Width (mm)',
    description: 'Width of the beam or column cross-section.',
  },
  depth: {
    label: 'Overall Depth (mm)',
    description: 'Total depth of the member including cover.',
  },
  effectiveDepth: {
    label: 'Effective Depth (mm)',
    description: 'Distance from extreme compression fiber to centroid of tension reinforcement (d = D − cover − φ/2).',
    clause: 'IS 456 Cl. 38.1'
  },
  Mu: {
    label: 'Mu (kN·m)',
    description: 'Factored bending moment. Positive = sagging (tension at bottom), Negative = hogging (tension at top).',
    clause: 'IS 456 Cl. 38.1'
  },
  Vu: {
    label: 'Vu (kN)',
    description: 'Factored shear force at the critical section (d from face of support).',
    clause: 'IS 456 Cl. 40.1'
  },
  Tu: {
    label: 'Tu (kN·m)',
    description: 'Factored torsional moment. Required for compatibility torsion or equilibrium torsion checks.',
    clause: 'IS 456 Cl. 41.1'
  },

  // Column parameters
  Pu: {
    label: 'Pu (kN)',
    description: 'Factored axial load on column. Positive = compression (convention for design).',
    clause: 'IS 456 Cl. 39.3'
  },
  effectiveLength: {
    label: 'Effective Length (mm)',
    description: 'Effective length of column = K × unsupported length. K depends on end conditions.',
    clause: 'IS 456 Cl. 25.2'
  },

  // Slab parameters
  lx: {
    label: 'lx — Short Span (mm)',
    description: 'Shorter span of the slab panel. Used to classify one-way vs two-way (ly/lx > 2 = one-way).',
    clause: 'IS 456 Cl. 24.4'
  },
  ly: {
    label: 'ly — Long Span (mm)',
    description: 'Longer span of the slab panel.',
    clause: 'IS 456 Cl. 24.4'
  },
  thickness: {
    label: 'Thickness (mm)',
    description: 'Overall thickness of slab. Minimum per span/depth ratios: simply-supported L/20, continuous L/26.',
    clause: 'IS 456 Cl. 23.2'
  },

  // Foundation parameters
  axialLoad: {
    label: 'Axial Load (kN)',
    description: 'Total factored axial load from column at footing top.',
  },
  bearingCapacity: {
    label: 'SBC (kN/m²)',
    description: 'Safe bearing capacity of soil from geotechnical investigation report.',
  },
  footingDepth: {
    label: 'Footing Depth (mm)',
    description: 'Overall depth of footing. Must satisfy one-way shear, two-way punching shear, and development length.',
    clause: 'IS 456 Cl. 34.2'
  },

  // Steel design parameters
  Lb: {
    label: 'Lb (mm)',
    description: 'Unbraced length between lateral support points. Controls lateral-torsional buckling.',
    clause: 'AISC 360 Sec. F2'
  },
  Kx: {
    label: 'Kx',
    description: 'Effective length factor about major axis. 1.0 for pinned-pinned, 0.65 for fixed-fixed.',
    clause: 'AISC 360 Table C-A-7.1'
  },
  Ky: {
    label: 'Ky',
    description: 'Effective length factor about minor axis.',
    clause: 'AISC 360 Table C-A-7.1'
  },
  Cb: {
    label: 'Cb',
    description: 'Lateral-torsional buckling modification factor for non-uniform moment diagrams. 1.0 for uniform moment (conservative).',
    clause: 'AISC 360 Eq. F1-1'
  },
};
