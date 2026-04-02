export const DEAD_LOAD_BY_STRUCTURE: Record<string, number> = {
  building: 6.75,
  frame: 6.75,
  industrial: 8.0,
  beam: 5.5,
};

export const STRUCTURE_TYPE_KEYS = {
  building: 'building',
  frame: 'frame',
  roof: 'roof',
  truss: 'truss',
  industrial: 'industrial',
  beam: 'beam',
  column: 'column',
  purlin: 'purlin',
} as const;

export const MEMBER_TYPE_KEYS = {
  beam: 'beam',
  column: 'column',
  trussChord: 'truss_chord',
  trussWeb: 'truss_web',
  bracing: 'bracing',
} as const;

export const ROOF_TYPE_KEYS = {
  rcc: 'rcc',
  metal: 'metal',
} as const;

export const ROOF_DEAD_LOAD_BY_TYPE: Record<string, number> = {
  rcc: 3.5,
  metal: 0.5,
};

export const DEFAULT_DEAD_LOAD = 5.0;

export const LIVE_LOAD_TABLE: Record<string, number> = {
  residential: 2.0,
  office: 2.5,
  office_heavy: 4.0,
  assembly: 4.0,
  assembly_dense: 5.0,
  retail: 4.0,
  warehouse_light: 6.0,
  warehouse_medium: 10.0,
  warehouse_heavy: 15.0,
  industrial_light: 5.0,
  industrial_heavy: 10.0,
  hospital: 3.0,
  hospital_operating: 4.0,
  school: 3.0,
  library: 6.0,
  library_reading: 4.0,
  parking: 2.5,
  parking_heavy: 5.0,
  corridor: 4.0,
  stairs: 5.0,
  balcony: 3.0,
  roof_access: 1.5,
  roof_no_access: 0.75,
};

export const DEFAULT_LIVE_LOAD = 3.0;
export const DEFAULT_ROOF_LIVE_LOAD = 0.75;

export const WIND_ZONE_SPEEDS: Record<string, number> = {
  I: 33,
  II: 39,
  III: 44,
  IV: 47,
  V: 50,
  VI: 55,
};

export const DEFAULT_WIND_ZONE = 'III';

export const TERRAIN_FACTOR_K2: Record<number, Record<string, number>> = {
  1: { '10': 1.05, '15': 1.09, '20': 1.12, '30': 1.16, '50': 1.20 },
  2: { '10': 1.00, '15': 1.05, '20': 1.07, '30': 1.12, '50': 1.17 },
  3: { '10': 0.91, '15': 0.97, '20': 1.01, '30': 1.06, '50': 1.12 },
  4: { '10': 0.80, '15': 0.80, '20': 0.88, '30': 0.98, '50': 1.05 },
};

export const SEISMIC_ZONE_FACTORS: Record<string, number> = {
  II: 0.10,
  III: 0.16,
  IV: 0.24,
  V: 0.36,
};

export const DEFAULT_SEISMIC_ZONE_FACTOR = 0.16;
export const RESPONSE_REDUCTION_FACTOR = 5.0;

export const DEFAULT_OCCUPANCY = 'office';
export const DEFAULT_ROOF_TYPE = 'metal';
export const DEFAULT_SEISMIC_ZONE = 'III';
export const DEFAULT_TERRAIN_CATEGORY = 2;
export const DEFAULT_IMPORTANCE_FACTOR = 1.0;

export const CALCULATION_INPUT_DEFAULTS = {
  height: 4,
  bayWidth: 6,
  tributaryWidth: 3,
  k2Fallback: 1.0,
} as const;

export const WIND_FACTORS = {
  k1: 1.0,
  k3: 1.0,
  pressureFactor: 0.6,
  windwardCp: 0.8,
  leewardCp: -0.4,
  pressureDivisor: 1000,
} as const;

export const HEIGHT_BRACKETS = {
  h10: 10,
  h15: 15,
  h20: 20,
  h30: 30,
  b10: '10',
  b15: '15',
  b20: '20',
  b30: '30',
  b50: '50',
} as const;

export const SEISMIC_PERIOD_CONSTANTS = {
  coeff: 0.075,
  exponent: 0.75,
  t1: 0.10,
  t2: 0.55,
  t3: 4.0,
  branch1Base: 1.0,
  branch1Slope: 15,
  branch2Value: 2.5,
  branch3Numerator: 1.36,
  branch4Value: 0.34,
  zoneDivisor: 2,
} as const;

export const SELF_WEIGHT_MODELS = {
  beam: { base: 0.4, slope: 0.035 },
  column: { base: 0.6, slope: 0.04 },
  truss: { base: 0.10, slope: 0.012 },
  purlin: { fixed: 0.15 },
  defaultFixed: 0.5,
} as const;

export const LOAD_FACTORS = {
  uls: 1.5,
  sls: 1.0,
  windComboLoad: 1.2,
  windComboPressure: 1.2,
} as const;

export const SECTION_FALLBACKS = {
  beam: 'ISMB 600',
  column: 'ISHB 450',
  trussChord: 'ISMC 300',
  trussWeb: 'ISA 100x100x10',
  bracing: 'ISA 75x75x8',
  default: 'ISMB 300',
} as const;

export const SECTION_SELECTION_FACTORS = {
  fy: 250,
  gammaM0: 1.1,
  unitDivisor: 1000,
  beamMomentDivisor: 8,
  demandAmplification: 1.1,
} as const;

export const BEAM_SECTIONS_ASCENDING = [
  'ISMB 150',
  'ISMB 200',
  'ISMB 250',
  'ISMB 300',
  'ISMB 350',
  'ISMB 400',
  'ISMB 450',
  'ISMB 500',
  'ISMB 550',
  'ISMB 600',
] as const;

export const COLUMN_LOAD_TO_SECTION = [
  { maxLoad: 500, section: 'ISHB 200' },
  { maxLoad: 1000, section: 'ISHB 250' },
  { maxLoad: 1500, section: 'ISHB 300' },
  { maxLoad: 2500, section: 'ISHB 350' },
  { maxLoad: 4000, section: 'ISHB 400' },
] as const;

export const TRUSS_CHORD_SPAN_TO_SECTION = [
  { maxSpan: 15, section: 'ISMC 150' },
  { maxSpan: 25, section: 'ISMC 200' },
  { maxSpan: 35, section: 'ISMC 250' },
] as const;

export const TRUSS_WEB_SPAN_TO_SECTION = [
  { maxSpan: 15, section: 'ISA 65x65x6' },
  { maxSpan: 25, section: 'ISA 75x75x8' },
  { maxSpan: 35, section: 'ISA 90x90x10' },
] as const;
