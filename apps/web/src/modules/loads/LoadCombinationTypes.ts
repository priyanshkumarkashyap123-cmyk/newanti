/**
 * Load Combination Types
 * Per ASCE 7-22 Chapter 2
 * 
 * Includes:
 * - LRFD (Strength Design)
 * - ASD (Allowable Stress Design)
 * - Special combinations (seismic, wind)
 */

// ============================================================================
// Enums
// ============================================================================

export enum LoadType {
  D = 'D',           // Dead load
  L = 'L',           // Live load (floor)
  Lr = 'Lr',         // Live load (roof)
  S = 'S',           // Snow load
  R = 'R',           // Rain load
  W = 'W',           // Wind load
  E = 'E',           // Earthquake load
  H = 'H',           // Lateral earth pressure
  F = 'F',           // Fluid pressure
  T = 'T',           // Self-straining forces
}

export enum DesignMethod {
  LRFD = 'LRFD',     // Load and Resistance Factor Design
  ASD = 'ASD',       // Allowable Stress Design
}

export enum OccupancyCategory {
  I = 'I',           // Low hazard
  II = 'II',         // Standard
  III = 'III',       // Substantial hazard
  IV = 'IV',         // Essential facilities
}

export enum CombinationType {
  BASIC = 'BASIC',
  SEISMIC = 'SEISMIC',
  WIND = 'WIND',
  SPECIAL = 'SPECIAL',
}

// ============================================================================
// Interfaces
// ============================================================================

export interface LoadValue {
  type: LoadType;
  value: number;
  unit: string;
}

export interface LoadFactor {
  type: LoadType;
  factor: number;
}

export interface LoadCombination {
  id: string;
  name: string;
  type: CombinationType;
  method: DesignMethod;
  factors: LoadFactor[];
  formula: string;
  reference: string;
}

export interface LoadCombinationInput {
  designMethod: DesignMethod;
  occupancyCategory: OccupancyCategory;
  
  // Applied loads
  loads: LoadValue[];
  
  // Options
  includeSeismic?: boolean;
  includeWind?: boolean;
  sds?: number;           // Seismic design spectral acceleration
  rho?: number;           // Redundancy factor
  omega_0?: number;       // Overstrength factor
}

export interface LoadCombinationResult {
  combinations: {
    combination: LoadCombination;
    factored_loads: { type: LoadType; factored: number }[];
    total: number;
    governs?: boolean;
  }[];
  
  governing: {
    combination: LoadCombination;
    total: number;
  };
  
  summary: {
    method: DesignMethod;
    totalCombinations: number;
    maxLoad: number;
    minLoad: number;
  };
}

// ============================================================================
// Constants - LRFD Load Combinations (ASCE 7-22 Section 2.3.1)
// ============================================================================

export const LRFD_COMBINATIONS: LoadCombination[] = [
  {
    id: 'LRFD-1',
    name: 'Dead Load Only',
    type: CombinationType.BASIC,
    method: DesignMethod.LRFD,
    factors: [{ type: LoadType.D, factor: 1.4 }],
    formula: '1.4D',
    reference: 'ASCE 7-22 2.3.1(1)',
  },
  {
    id: 'LRFD-2',
    name: 'Dead + Live',
    type: CombinationType.BASIC,
    method: DesignMethod.LRFD,
    factors: [
      { type: LoadType.D, factor: 1.2 },
      { type: LoadType.L, factor: 1.6 },
      { type: LoadType.Lr, factor: 0.5 },
    ],
    formula: '1.2D + 1.6L + 0.5(Lr or S or R)',
    reference: 'ASCE 7-22 2.3.1(2)',
  },
  {
    id: 'LRFD-3',
    name: 'Dead + Roof Live',
    type: CombinationType.BASIC,
    method: DesignMethod.LRFD,
    factors: [
      { type: LoadType.D, factor: 1.2 },
      { type: LoadType.L, factor: 1.0 },
      { type: LoadType.Lr, factor: 1.6 },
    ],
    formula: '1.2D + 1.6(Lr or S or R) + (L or 0.5W)',
    reference: 'ASCE 7-22 2.3.1(3)',
  },
  {
    id: 'LRFD-4',
    name: 'Dead + Wind',
    type: CombinationType.WIND,
    method: DesignMethod.LRFD,
    factors: [
      { type: LoadType.D, factor: 1.2 },
      { type: LoadType.W, factor: 1.0 },
      { type: LoadType.L, factor: 1.0 },
      { type: LoadType.Lr, factor: 0.5 },
    ],
    formula: '1.2D + 1.0W + L + 0.5(Lr or S or R)',
    reference: 'ASCE 7-22 2.3.1(4)',
  },
  {
    id: 'LRFD-5',
    name: 'Dead + Seismic',
    type: CombinationType.SEISMIC,
    method: DesignMethod.LRFD,
    factors: [
      { type: LoadType.D, factor: 1.2 },
      { type: LoadType.E, factor: 1.0 },
      { type: LoadType.L, factor: 1.0 },
      { type: LoadType.S, factor: 0.2 },
    ],
    formula: '1.2D + 1.0E + L + 0.2S',
    reference: 'ASCE 7-22 2.3.1(5)',
  },
  {
    id: 'LRFD-6',
    name: 'Dead - Wind (Uplift)',
    type: CombinationType.WIND,
    method: DesignMethod.LRFD,
    factors: [
      { type: LoadType.D, factor: 0.9 },
      { type: LoadType.W, factor: 1.0 },
    ],
    formula: '0.9D + 1.0W',
    reference: 'ASCE 7-22 2.3.1(6)',
  },
  {
    id: 'LRFD-7',
    name: 'Dead - Seismic (Uplift)',
    type: CombinationType.SEISMIC,
    method: DesignMethod.LRFD,
    factors: [
      { type: LoadType.D, factor: 0.9 },
      { type: LoadType.E, factor: 1.0 },
    ],
    formula: '0.9D + 1.0E',
    reference: 'ASCE 7-22 2.3.1(7)',
  },
];

// ============================================================================
// Constants - ASD Load Combinations (ASCE 7-22 Section 2.4.1)
// ============================================================================

export const ASD_COMBINATIONS: LoadCombination[] = [
  {
    id: 'ASD-1',
    name: 'Dead Load Only',
    type: CombinationType.BASIC,
    method: DesignMethod.ASD,
    factors: [{ type: LoadType.D, factor: 1.0 }],
    formula: 'D',
    reference: 'ASCE 7-22 2.4.1(1)',
  },
  {
    id: 'ASD-2',
    name: 'Dead + Live',
    type: CombinationType.BASIC,
    method: DesignMethod.ASD,
    factors: [
      { type: LoadType.D, factor: 1.0 },
      { type: LoadType.L, factor: 1.0 },
    ],
    formula: 'D + L',
    reference: 'ASCE 7-22 2.4.1(2)',
  },
  {
    id: 'ASD-3',
    name: 'Dead + Roof Live',
    type: CombinationType.BASIC,
    method: DesignMethod.ASD,
    factors: [
      { type: LoadType.D, factor: 1.0 },
      { type: LoadType.Lr, factor: 1.0 },
    ],
    formula: 'D + (Lr or S or R)',
    reference: 'ASCE 7-22 2.4.1(3)',
  },
  {
    id: 'ASD-4',
    name: 'Dead + 0.75(Live + Roof)',
    type: CombinationType.BASIC,
    method: DesignMethod.ASD,
    factors: [
      { type: LoadType.D, factor: 1.0 },
      { type: LoadType.L, factor: 0.75 },
      { type: LoadType.Lr, factor: 0.75 },
    ],
    formula: 'D + 0.75L + 0.75(Lr or S or R)',
    reference: 'ASCE 7-22 2.4.1(4)',
  },
  {
    id: 'ASD-5',
    name: 'Dead + Wind',
    type: CombinationType.WIND,
    method: DesignMethod.ASD,
    factors: [
      { type: LoadType.D, factor: 1.0 },
      { type: LoadType.W, factor: 0.6 },
    ],
    formula: 'D + 0.6W',
    reference: 'ASCE 7-22 2.4.1(5)',
  },
  {
    id: 'ASD-6',
    name: 'Dead + 0.75(Wind + Live)',
    type: CombinationType.WIND,
    method: DesignMethod.ASD,
    factors: [
      { type: LoadType.D, factor: 1.0 },
      { type: LoadType.W, factor: 0.45 },
      { type: LoadType.L, factor: 0.75 },
      { type: LoadType.Lr, factor: 0.75 },
    ],
    formula: 'D + 0.75(0.6W) + 0.75L + 0.75(Lr or S or R)',
    reference: 'ASCE 7-22 2.4.1(6)',
  },
  {
    id: 'ASD-7',
    name: 'Dead + 0.7E',
    type: CombinationType.SEISMIC,
    method: DesignMethod.ASD,
    factors: [
      { type: LoadType.D, factor: 1.0 },
      { type: LoadType.E, factor: 0.7 },
    ],
    formula: 'D + 0.7E',
    reference: 'ASCE 7-22 2.4.1(7)',
  },
  {
    id: 'ASD-8',
    name: 'Dead + 0.75(0.7E + Live)',
    type: CombinationType.SEISMIC,
    method: DesignMethod.ASD,
    factors: [
      { type: LoadType.D, factor: 1.0 },
      { type: LoadType.E, factor: 0.525 },
      { type: LoadType.L, factor: 0.75 },
      { type: LoadType.S, factor: 0.75 },
    ],
    formula: 'D + 0.75(0.7E) + 0.75L + 0.75S',
    reference: 'ASCE 7-22 2.4.1(8)',
  },
  {
    id: 'ASD-9',
    name: 'Dead - Wind (Uplift)',
    type: CombinationType.WIND,
    method: DesignMethod.ASD,
    factors: [
      { type: LoadType.D, factor: 0.6 },
      { type: LoadType.W, factor: 0.6 },
    ],
    formula: '0.6D + 0.6W',
    reference: 'ASCE 7-22 2.4.1(9)',
  },
  {
    id: 'ASD-10',
    name: 'Dead - Seismic (Uplift)',
    type: CombinationType.SEISMIC,
    method: DesignMethod.ASD,
    factors: [
      { type: LoadType.D, factor: 0.6 },
      { type: LoadType.E, factor: 0.7 },
    ],
    formula: '0.6D + 0.7E',
    reference: 'ASCE 7-22 2.4.1(10)',
  },
];

// ============================================================================
// Importance Factors (ASCE 7-22 Table 1.5-2)
// ============================================================================

export const IMPORTANCE_FACTORS = {
  wind: {
    [OccupancyCategory.I]: 0.87,
    [OccupancyCategory.II]: 1.00,
    [OccupancyCategory.III]: 1.15,
    [OccupancyCategory.IV]: 1.15,
  },
  snow: {
    [OccupancyCategory.I]: 0.80,
    [OccupancyCategory.II]: 1.00,
    [OccupancyCategory.III]: 1.10,
    [OccupancyCategory.IV]: 1.20,
  },
  seismic: {
    [OccupancyCategory.I]: 1.00,
    [OccupancyCategory.II]: 1.00,
    [OccupancyCategory.III]: 1.25,
    [OccupancyCategory.IV]: 1.50,
  },
};

// ============================================================================
// Live Load Reduction (ASCE 7-22 4.7)
// ============================================================================

export const LIVE_LOAD_REDUCTION = {
  minFactor: 0.5,                    // 50% minimum
  minFactor_parking: 0.6,            // 60% for parking
  formula: 'L = Lo × (0.25 + 15/√(KLL × AT))',
  KLL: {
    interior_columns: 4,
    edge_columns: 3,
    corner_columns: 2,
    edge_beams: 2,
    interior_beams: 2,
    one_way_slabs: 1,
    two_way_slabs: 1,
  },
};
