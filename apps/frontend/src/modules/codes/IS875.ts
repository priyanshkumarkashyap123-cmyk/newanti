/**
 * ============================================================================
 * IS 875 (Part 1, 2 & 3) - DESIGN LOADS
 * ============================================================================
 * 
 * Complete implementation of IS 875:1987 for Design Loads
 * 
 * Part 1 - Dead Loads
 * Part 2 - Imposed Loads (Live Loads)
 * Part 3 - Wind Loads
 * 
 * Includes:
 * - Dead load calculation for common materials
 * - Live load tables for various occupancies
 * - Wind load calculation per Part 3
 * - Design wind speed and pressure
 * - Force coefficients for buildings
 * 
 * @version 1.0.0
 * @reference IS 875:1987 (Parts 1-3) - Code of Practice for Design Loads
 */

import {
  DesignCode,
  CalculationStep,
  DiagramData,
  DiagramType,
  createCalculationStep,
  roundTo,
} from '../core/CalculationEngine';

// ============================================================================
// PART 1 - DEAD LOADS
// ============================================================================

/**
 * Unit weights of building materials per IS 875 Part 1
 * Values in kN/m³ unless otherwise specified
 */
export const IS875_UNIT_WEIGHTS = {
  // Concrete
  PCC: 24.0,                        // Plain cement concrete
  RCC: 25.0,                        // Reinforced cement concrete
  lightweight_concrete: 16.0,       // Lightweight aggregate concrete
  
  // Brick and Stone
  brick_common: 19.0,               // Common burnt clay bricks
  brick_pressed: 21.0,              // Pressed bricks
  stone_granite: 26.5,              // Granite
  stone_sandstone: 23.0,            // Sandstone
  stone_limestone: 25.0,            // Limestone
  stone_laterite: 22.0,             // Laterite
  
  // Metals
  steel: 78.5,
  cast_iron: 72.0,
  aluminium: 27.0,
  
  // Wood
  timber_teak: 6.5,
  timber_sal: 8.5,
  timber_pine: 5.5,
  plywood: 6.0,
  
  // Flooring (kN/m² per unit thickness)
  tiles_ceramic: 22.0,
  tiles_marble: 27.0,
  terrazzo: 22.0,
  
  // Roofing
  AC_sheets: 0.18,                  // Per mm thickness, kN/m²
  GI_sheets: 0.08,                  // Per mm thickness, kN/m²
  clay_tiles: 0.60,                 // kN/m²
  concrete_tiles: 0.48,             // kN/m²
  
  // Soil
  sand_dry: 16.0,
  sand_wet: 19.0,
  earth_loose: 16.0,
  earth_compacted: 18.0,
  gravel: 18.0,
  
  // Wall (kN/m² for given thickness)
  brick_wall_230: 4.4,              // 230mm brick wall
  brick_wall_115: 2.2,              // 115mm brick wall
  block_wall_200: 3.0,              // 200mm concrete block
  glass_partition: 0.5,             // Glass partition
};

/**
 * Calculate dead load of floor system
 */
export interface FloorDeadLoadInput {
  slab_thickness: number;           // mm
  floor_finish_thickness?: number;  // mm
  ceiling?: boolean;
  services?: number;                // kN/m²
}

export function calculateFloorDeadLoad(input: FloorDeadLoadInput): {
  components: Record<string, number>;
  total: number;
} {
  const { slab_thickness, floor_finish_thickness = 0, ceiling = false, services = 0 } = input;
  
  const components: Record<string, number> = {};
  
  // RCC slab
  components['RCC Slab'] = (slab_thickness / 1000) * IS875_UNIT_WEIGHTS.RCC;
  
  // Floor finish
  if (floor_finish_thickness > 0) {
    components['Floor Finish'] = (floor_finish_thickness / 1000) * IS875_UNIT_WEIGHTS.terrazzo;
  }
  
  // Ceiling
  if (ceiling) {
    components['False Ceiling'] = 0.25; // Typical value
  }
  
  // Services (electrical, plumbing, etc.)
  if (services > 0) {
    components['Services'] = services;
  }
  
  const total = Object.values(components).reduce((sum, v) => sum + v, 0);
  
  return {
    components,
    total: roundTo(total, 2),
  };
}

// ============================================================================
// PART 2 - IMPOSED LOADS (LIVE LOADS)
// ============================================================================

/**
 * Imposed loads for various occupancies per IS 875 Part 2 Table 1
 * Values in kN/m²
 */
export const IS875_IMPOSED_LOADS = {
  // Residential
  residential_general: 2.0,
  residential_bedrooms: 1.5,
  residential_dining: 2.0,
  residential_balcony: 3.0,
  residential_kitchen: 3.0,
  residential_toilet: 2.0,
  residential_staircase: 3.0,
  
  // Office
  office_general: 2.5,
  office_filing_rooms: 5.0,
  office_computer_rooms: 3.5,
  office_conference: 4.0,
  
  // Educational
  classroom: 3.0,
  laboratory: 4.0,
  library_reading: 4.0,
  library_stack: 10.0,
  
  // Assembly
  assembly_fixed_seats: 4.0,
  assembly_movable_seats: 5.0,
  dance_hall: 5.0,
  gymnasium: 5.0,
  
  // Mercantile
  retail_light: 4.0,
  retail_general: 5.0,
  wholesale: 6.0,
  
  // Industrial
  industrial_light: 5.0,
  industrial_medium: 7.5,
  industrial_heavy: 10.0,
  
  // Storage
  storage_light: 6.0,
  storage_medium: 9.0,
  storage_heavy: 12.0,
  
  // Hospital
  hospital_wards: 2.0,
  hospital_OPD: 3.0,
  hospital_operating: 4.0,
  
  // Parking
  parking_cars: 2.5,
  parking_light_vehicles: 5.0,
  parking_heavy_vehicles: 7.5,
  
  // Roof
  roof_accessible: 1.5,
  roof_non_accessible: 0.75,
};

/**
 * Reduction in imposed load per IS 875 Part 2 Clause 3.2
 */
export function getImposedLoadReduction(
  numFloors: number,      // Number of floors supported
  occupancy: 'office' | 'residential' | 'other'
): number {
  // For design of columns, foundations, and other elements
  // Reduction applicable only if floor area > 50 m²
  
  let reduction: number;
  
  if (occupancy === 'office' || occupancy === 'residential') {
    // Table 2 of IS 875 Part 2
    if (numFloors <= 1) reduction = 0;
    else if (numFloors === 2) reduction = 10;
    else if (numFloors === 3) reduction = 20;
    else if (numFloors === 4) reduction = 30;
    else if (numFloors === 5) reduction = 40;
    else reduction = 50; // Maximum 50%
  } else {
    reduction = 0; // No reduction for other occupancies
  }
  
  return reduction;
}

// ============================================================================
// PART 3 - WIND LOADS
// ============================================================================

/**
 * Basic wind speed (Vb) for major Indian cities per IS 875 Part 3
 * Values in m/s
 */
export const IS875_BASIC_WIND_SPEEDS: Record<string, number> = {
  // Zone I (33 m/s)
  bangalore: 33,
  mysore: 33,
  hubli: 33,
  shimla: 33,
  
  // Zone II (39 m/s)
  delhi: 47,
  jaipur: 47,
  lucknow: 47,
  kanpur: 47,
  nagpur: 44,
  hyderabad: 44,
  pune: 39,
  
  // Zone III (44 m/s)
  ahmedabad: 39,
  surat: 44,
  vadodara: 44,
  
  // Zone IV (47 m/s)
  mumbai: 44,
  kolkata: 50,
  bhubaneswar: 50,
  
  // Zone V (50+ m/s) - Cyclone prone
  chennai: 50,
  visakhapatnam: 50,
  machilipatnam: 55,
  
  // Zone VI (55 m/s) - Severe cyclone
  coastal_AP: 55,
  coastal_Odisha: 55,
};

/**
 * Terrain categories per IS 875 Part 3 Table 2
 */
export const IS875_TERRAIN_CATEGORIES = {
  1: { 
    description: 'Open terrain with few obstacles (coastal, flat plains)',
    k2_10: 1.05,
    k2_15: 1.09,
    k2_20: 1.12,
    k2_30: 1.15,
    k2_50: 1.20,
  },
  2: { 
    description: 'Open terrain with scattered obstructions (airfields, open parks)',
    k2_10: 1.00,
    k2_15: 1.05,
    k2_20: 1.07,
    k2_30: 1.12,
    k2_50: 1.17,
  },
  3: { 
    description: 'Terrain with closely spaced obstructions (suburban areas)',
    k2_10: 0.91,
    k2_15: 0.97,
    k2_20: 1.01,
    k2_30: 1.06,
    k2_50: 1.12,
  },
  4: { 
    description: 'Terrain with numerous large obstructions (city centers)',
    k2_10: 0.80,
    k2_15: 0.88,
    k2_20: 0.93,
    k2_30: 1.00,
    k2_50: 1.07,
  },
};

/**
 * k1 factor - Risk coefficient (Table 1)
 */
export const IS875_K1_FACTORS: Record<string, { k1: number; description: string }> = {
  general: { k1: 1.00, description: 'General buildings (50 year return period)' },
  temporary: { k1: 0.82, description: 'Temporary structures (5 year return period)' },
  important: { k1: 1.06, description: 'Important structures (100 year return period)' },
  critical: { k1: 1.12, description: 'Critical structures (200 year return period)' },
};

/**
 * k3 factor - Topography factor
 */
export function getK3Factor(
  topography: 'flat' | 'hill' | 'cliff' | 'escarpment',
  H?: number,     // Height of hill/cliff, m
  z?: number,     // Height of structure above ground, m
  L?: number      // Effective horizontal length of hill/feature, m
): number {
  if (topography === 'flat') return 1.0;
  
  // For hills, cliffs, escarpments
  // Simplified calculation - detailed as per Appendix C
  if (H && z && L) {
    const slope = H / (2 * L);
    
    if (slope < 0.05) return 1.0;
    
    // Approximate k3 for hill crest
    let C: number;
    if (topography === 'hill') C = 1.2;
    else if (topography === 'cliff') C = 1.6;
    else C = 1.4; // escarpment
    
    const s = Math.min(slope, 0.3);
    return 1 + C * s;
  }
  
  return 1.0;
}

/**
 * k4 factor - Importance factor for cyclonic regions
 */
export function getK4Factor(isCyclonicRegion: boolean, isImportant: boolean): number {
  if (!isCyclonicRegion) return 1.0;
  return isImportant ? 1.30 : 1.15;
}

/**
 * Calculate terrain and height factor k2 per IS 875 Part 3 Table 2
 */
export function getK2Factor(
  terrainCategory: 1 | 2 | 3 | 4,
  height: number     // Height above ground, m
): number {
  const terrain = IS875_TERRAIN_CATEGORIES[terrainCategory];
  
  // Interpolate for height
  if (height <= 10) return terrain.k2_10;
  if (height <= 15) return terrain.k2_10 + (terrain.k2_15 - terrain.k2_10) * (height - 10) / 5;
  if (height <= 20) return terrain.k2_15 + (terrain.k2_20 - terrain.k2_15) * (height - 15) / 5;
  if (height <= 30) return terrain.k2_20 + (terrain.k2_30 - terrain.k2_20) * (height - 20) / 10;
  if (height <= 50) return terrain.k2_30 + (terrain.k2_50 - terrain.k2_30) * (height - 30) / 20;
  
  // For heights > 50m, extrapolate
  return terrain.k2_50 + 0.002 * (height - 50);
}

/**
 * Calculate design wind speed Vz
 */
export function getDesignWindSpeed(
  Vb: number,           // Basic wind speed, m/s
  k1: number,           // Risk coefficient
  k2: number,           // Terrain factor
  k3: number,           // Topography factor
  k4?: number           // Cyclonic factor
): number {
  // Vz = Vb × k1 × k2 × k3 × k4
  const Vz = Vb * k1 * k2 * k3 * (k4 || 1.0);
  return roundTo(Vz, 2);
}

/**
 * Calculate design wind pressure pz
 */
export function getDesignWindPressure(Vz: number): number {
  // pz = 0.6 × Vz²  (kN/m²)
  const pz = 0.6 * Vz * Vz / 1000;
  return roundTo(pz, 4);
}

/**
 * Force coefficients for buildings per IS 875 Part 3 Table 4-23
 */
export const IS875_FORCE_COEFFICIENTS = {
  // Rectangular buildings with flat roof
  rectangular_flat: (h_b: number, l_b: number): { Cf: number } => {
    // h/b ratio
    const ratio = h_b;
    let Cf: number;
    
    if (l_b <= 0.5) Cf = ratio <= 1 ? 0.9 : (ratio <= 2 ? 1.0 : 1.1);
    else if (l_b <= 1) Cf = ratio <= 1 ? 0.9 : (ratio <= 2 ? 1.0 : 1.15);
    else if (l_b <= 2) Cf = ratio <= 1 ? 0.9 : (ratio <= 2 ? 1.05 : 1.2);
    else Cf = ratio <= 1 ? 0.9 : (ratio <= 2 ? 1.1 : 1.3);
    
    return { Cf };
  },
  
  // Pressure coefficients for walls
  wall_windward: 0.7,
  wall_leeward: -0.4,
  wall_side: -0.7,
  
  // Roof pressure coefficients (for flat roof)
  roof_flat: -0.8,
};

// ============================================================================
// COMPREHENSIVE WIND LOAD CALCULATION
// ============================================================================

export interface WindLoadInputIS875 {
  // Location
  location?: string;
  basicWindSpeed?: number;    // Vb, m/s (required if location not in database)
  
  // Building geometry
  height: number;             // Total height, m
  width: number;              // Width perpendicular to wind, m
  length: number;             // Length parallel to wind, m
  
  // Terrain and exposure
  terrainCategory: 1 | 2 | 3 | 4;
  topography: 'flat' | 'hill' | 'cliff' | 'escarpment';
  hillHeight?: number;
  hillLength?: number;
  
  // Building importance
  structureClass: keyof typeof IS875_K1_FACTORS;
  isCyclonicRegion?: boolean;
  
  // Options
  showDetailedCalc?: boolean;
}

export interface WindLoadResultIS875 {
  // Wind speed parameters
  Vb: number;                 // Basic wind speed, m/s
  k1: number;                 // Risk coefficient
  k2: Record<string, number>; // Terrain factor at various heights
  k3: number;                 // Topography factor
  k4: number;                 // Cyclonic factor
  
  // Design values at building height
  Vz: number;                 // Design wind speed at top, m/s
  pz: number;                 // Design wind pressure at top, kN/m²
  
  // Wind pressure distribution
  pressureProfile: Array<{
    height: number;
    k2: number;
    Vz: number;
    pz: number;
  }>;
  
  // Forces
  Cf: number;                 // Force coefficient
  Fw: number;                 // Total wind force, kN
  
  // Pressure coefficients
  pressureCoefficients: {
    windward: number;
    leeward: number;
    side: number;
    roof: number;
  };
  
  calculations: CalculationStep[];
  diagrams: DiagramData[];
}

/**
 * Calculate wind loads per IS 875 Part 3
 */
export function calculateWindLoadIS875(input: WindLoadInputIS875): WindLoadResultIS875 {
  const calculations: CalculationStep[] = [];
  const diagrams: DiagramData[] = [];
  let stepNo = 1;
  
  const {
    location,
    basicWindSpeed,
    height,
    width,
    length,
    terrainCategory,
    topography,
    hillHeight,
    hillLength,
    structureClass,
    isCyclonicRegion = false,
  } = input;
  
  // ============================================================================
  // STEP 1: BASIC WIND SPEED
  // ============================================================================
  
  let Vb: number;
  if (location && IS875_BASIC_WIND_SPEEDS[location.toLowerCase()]) {
    Vb = IS875_BASIC_WIND_SPEEDS[location.toLowerCase()];
  } else if (basicWindSpeed) {
    Vb = basicWindSpeed;
  } else {
    throw new Error('Either location or basicWindSpeed must be provided');
  }
  
  const valuesForStep1: Record<string, { value: string | number; unit?: string; description?: string }> = {
    'Vb': { value: Vb, unit: 'm/s', description: '3-second gust wind speed' },
  };
  if (location) {
    valuesForStep1['Location'] = { value: location };
  }
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Basic Wind Speed',
    description: 'Determine basic wind speed from IS 875 Part 3 map or Table',
    formula: 'Vb from Appendix A (Fig 1)',
    values: valuesForStep1,
    result: { value: Vb, unit: 'm/s', description: 'Basic wind speed' },
    code: DesignCode.IS_875_3,
    clause: '5.2',
    figure: 'Fig 1',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 2: MODIFICATION FACTORS
  // ============================================================================
  
  // k1 - Risk coefficient
  const { k1 } = IS875_K1_FACTORS[structureClass];
  
  // k3 - Topography factor
  const k3 = getK3Factor(topography, hillHeight, height, hillLength);
  
  // k4 - Cyclonic factor
  const k4 = getK4Factor(isCyclonicRegion, structureClass === 'important' || structureClass === 'critical');
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Wind Speed Modification Factors',
    description: 'Determine k1, k3, and k4 factors',
    formula: 'k1 (Table 1), k3 (Appendix C), k4 (Clause 5.3.4)',
    values: {
      'k1': { value: k1, description: IS875_K1_FACTORS[structureClass].description },
      'k3': { value: roundTo(k3, 3), description: topography === 'flat' ? 'Flat terrain' : 'Topography effect' },
      'k4': { value: roundTo(k4, 3), description: isCyclonicRegion ? 'Cyclonic region' : 'Non-cyclonic' },
    },
    result: { value: 'Factors determined' },
    code: DesignCode.IS_875_3,
    clause: '5.3',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 3: WIND PRESSURE PROFILE
  // ============================================================================
  
  // Calculate k2 and wind pressure at different heights
  const heightIntervals = [
    ...Array.from({ length: Math.ceil(height / 10) }, (_, i) => (i + 1) * 10).filter(h => h < height),
    height,
  ];
  
  const pressureProfile = heightIntervals.map(h => {
    const k2 = getK2Factor(terrainCategory, h);
    const Vz = getDesignWindSpeed(Vb, k1, k2, k3, k4);
    const pz = getDesignWindPressure(Vz);
    
    return {
      height: h,
      k2: roundTo(k2, 3),
      Vz: roundTo(Vz, 2),
      pz: roundTo(pz, 4),
    };
  });
  
  // k2 record
  const k2Record: Record<string, number> = {};
  pressureProfile.forEach(p => {
    k2Record[`${p.height}m`] = p.k2;
  });
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Terrain and Height Factor k2',
    description: 'Calculate k2 at different heights per Table 2',
    formula: 'k2 from Table 2 based on terrain category and height',
    values: {
      'Terrain Category': { value: terrainCategory, description: IS875_TERRAIN_CATEGORIES[terrainCategory].description },
    },
    result: { 
      value: pressureProfile.map(p => `h=${p.height}m: k2=${p.k2}`).join('; '),
      description: 'k2 values at different heights'
    },
    code: DesignCode.IS_875_3,
    clause: '5.3.2',
    table: 'Table 2',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 4: DESIGN WIND SPEED AND PRESSURE
  // ============================================================================
  
  const topProfile = pressureProfile[pressureProfile.length - 1];
  const Vz = topProfile.Vz;
  const pz = topProfile.pz;
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Design Wind Speed',
    description: 'Calculate design wind speed at building height',
    formula: 'Vz = Vb × k1 × k2 × k3 × k4',
    values: {
      'Vb': { value: Vb, unit: 'm/s' },
      'k1': { value: k1 },
      'k2': { value: topProfile.k2, description: `At height ${height}m` },
      'k3': { value: roundTo(k3, 3) },
      'k4': { value: roundTo(k4, 3) },
    },
    result: { value: Vz, unit: 'm/s', description: 'Design wind speed at top' },
    code: DesignCode.IS_875_3,
    clause: '5.3',
    status: 'OK',
  }));
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Design Wind Pressure',
    description: 'Calculate design wind pressure',
    formula: 'pz = 0.6 × Vz²',
    values: {
      'Vz': { value: Vz, unit: 'm/s' },
    },
    result: { value: roundTo(pz * 1000, 2), unit: 'N/m²', description: 'Design wind pressure' },
    code: DesignCode.IS_875_3,
    clause: '5.4',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 5: FORCE COEFFICIENT AND WIND FORCE
  // ============================================================================
  
  const h_b = height / width;
  const l_b = length / width;
  const { Cf } = IS875_FORCE_COEFFICIENTS.rectangular_flat(h_b, l_b);
  
  // Calculate total wind force
  // Simplified: using average pressure over height
  const avgPressure = pressureProfile.reduce((sum, p) => sum + p.pz, 0) / pressureProfile.length;
  const Fw = Cf * avgPressure * height * width;
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Force Coefficient and Total Wind Force',
    description: 'Calculate force coefficient and total wind force on building',
    formula: 'Fw = Cf × pz,avg × A',
    values: {
      'h/b': { value: roundTo(h_b, 2) },
      'l/b': { value: roundTo(l_b, 2) },
      'Cf': { value: Cf, description: 'Force coefficient (Table 4)' },
      'Area': { value: roundTo(height * width, 2), unit: 'm²', description: 'Projected area' },
    },
    result: { value: roundTo(Fw, 2), unit: 'kN', description: 'Total wind force' },
    code: DesignCode.IS_875_3,
    clause: '6.3',
    table: 'Table 4',
    status: 'OK',
    diagram: {
      type: DiagramType.LOADING_DIAGRAM,
      title: 'Wind Pressure Distribution on Building',
      data: {
        building: { height, width, length },
        pressureProfile,
        Fw,
      },
    },
  }));
  
  // ============================================================================
  // STEP 6: PRESSURE COEFFICIENTS
  // ============================================================================
  
  const pressureCoefficients = {
    windward: IS875_FORCE_COEFFICIENTS.wall_windward,
    leeward: IS875_FORCE_COEFFICIENTS.wall_leeward,
    side: IS875_FORCE_COEFFICIENTS.wall_side,
    roof: IS875_FORCE_COEFFICIENTS.roof_flat,
  };
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Pressure Coefficients for Design',
    description: 'External pressure coefficients for different surfaces',
    formula: 'Cpe from Tables 5-14',
    values: {
      'Windward wall': { value: pressureCoefficients.windward, description: 'Cpe' },
      'Leeward wall': { value: pressureCoefficients.leeward, description: 'Cpe' },
      'Side walls': { value: pressureCoefficients.side, description: 'Cpe' },
      'Flat roof': { value: pressureCoefficients.roof, description: 'Cpe (suction)' },
    },
    result: { 
      value: 'Coefficients for detailed design', 
      description: 'Apply: F = (Cpe - Cpi) × pz × A' 
    },
    code: DesignCode.IS_875_3,
    clause: '6.2',
    status: 'OK',
  }));
  
  // Add wind pressure diagram
  diagrams.push({
    type: DiagramType.LOADING_DIAGRAM,
    title: 'Wind Pressure Profile with Height',
    data: {
      pressureProfile,
      coefficients: pressureCoefficients,
    },
  });
  
  return {
    Vb,
    k1,
    k2: k2Record,
    k3,
    k4,
    Vz,
    pz,
    pressureProfile,
    Cf,
    Fw,
    pressureCoefficients,
    calculations,
    diagrams,
  };
}

// Export types
export type { CalculationStep, DiagramData };
