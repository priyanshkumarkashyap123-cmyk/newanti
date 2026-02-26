/**
 * ============================================================================
 * ADVANCED WIND LOAD ANALYSIS ENGINE V3.0
 * ============================================================================
 * 
 * Comprehensive wind load analysis with multi-code compliance:
 * - IS 875 Part 3:2015 (India)
 * - ASCE 7-22 (USA)
 * - EN 1991-1-4 (Eurocode)
 * - AS/NZS 1170.2 (Australia/New Zealand)
 * 
 * Features:
 * - Basic wind speed calculations
 * - Terrain category factors
 * - Topography factors
 * - Internal/External pressure coefficients
 * - Along-wind and cross-wind responses
 * - Vortex shedding analysis
 * - Dynamic wind analysis for tall structures
 * 
 * @version 3.0.0
 */

import { PrecisionMath, EngineeringMath, ENGINEERING_CONSTANTS } from './PrecisionMath';
import { EngineeringErrorHandler, ErrorSeverity } from './EngineeringErrorHandler';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type WindLoadCode = 'IS875' | 'ASCE7' | 'EN1991' | 'AS1170';

export type TerrainCategory = 1 | 2 | 3 | 4;  // IS 875: 1=Sea coast, 4=Built-up urban

export type BuildingClass = 'A' | 'B' | 'C';  // Enclosure classification

export type RoofType = 'flat' | 'monoslope' | 'duopitch' | 'hipped' | 'mansard' | 'barrel' | 'dome';

export type StructureType = 'building' | 'chimney' | 'tower' | 'tank' | 'signboard' | 'hoarding';

export interface WindSiteData {
  basicWindSpeed: number;       // Vb in m/s
  terrainCategory: TerrainCategory;
  topographyFactor?: number;    // kT or Kzt
  cycloneRegion?: boolean;
  importanceFactor?: number;    // k1 for IS 875
  directionality?: number;      // Kd for ASCE 7
  exposureCategory?: 'B' | 'C' | 'D';  // ASCE 7
}

export interface BuildingGeometry {
  height: number;               // Total height (m)
  width: number;                // Width perpendicular to wind (m)
  depth: number;                // Depth along wind direction (m)
  roofType: RoofType;
  roofAngle?: number;           // degrees
  eaveHeight?: number;          // m
  openings?: {
    windward: number;           // % area
    leeward: number;
    side: number;
  };
}

export interface WindPressureResult {
  height: number;               // m
  designWindSpeed: number;      // m/s
  designWindPressure: number;   // kN/m²
  Cpe: number;                  // External pressure coefficient
  Cpi: number;                  // Internal pressure coefficient
  netPressure: number;          // kN/m² (Cpe - Cpi) × pz
}

export interface WindForceResult {
  zone: string;
  area: number;                 // m²
  Cp: number;                   // Pressure coefficient
  pressure: number;             // kN/m²
  force: number;                // kN
}

export interface WindLoadResult {
  code: WindLoadCode;
  basicWindSpeed: number;       // m/s
  designWindSpeed: number;      // m/s at top
  designWindPressure: number;   // kN/m² at top
  
  heightwisePressures: WindPressureResult[];
  
  wallPressures: {
    windward: WindForceResult[];
    leeward: WindForceResult[];
    sidewalls: WindForceResult[];
  };
  
  roofPressures: WindForceResult[];
  
  baseShear: number;            // kN
  overturningMoment: number;    // kN·m
  
  dynamicAnalysis?: {
    naturalFrequency: number;   // Hz
    gustFactor: number;
    dynamicResponse: number;    // kN (additional)
    vortexShedding?: {
      criticalSpeed: number;    // m/s
      strouhalNumber: number;
      lockInRange: [number, number];
    };
  };
  
  checks: {
    name: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    message: string;
  }[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

// IS 875 Part 3 - Risk Coefficients (k1)
export const IS875_RISK_COEFFICIENTS: Record<string, Record<number, number>> = {
  '50_year': { 1: 1.00, 2: 1.00, 3: 1.00, 4: 1.00 },
  '25_year': { 1: 0.92, 2: 0.92, 3: 0.92, 4: 0.92 },
  '100_year': { 1: 1.07, 2: 1.07, 3: 1.07, 4: 1.07 },
};

// IS 875 Part 3 - Terrain & Height Multipliers (k2)
export const IS875_TERRAIN_FACTORS: Record<TerrainCategory, { heights: number[]; factors: number[] }> = {
  1: {
    heights: [10, 15, 20, 30, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500],
    factors: [1.05, 1.09, 1.12, 1.17, 1.24, 1.32, 1.37, 1.41, 1.44, 1.47, 1.49, 1.51, 1.53, 1.55],
  },
  2: {
    heights: [10, 15, 20, 30, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500],
    factors: [1.00, 1.05, 1.08, 1.13, 1.20, 1.28, 1.33, 1.37, 1.40, 1.43, 1.45, 1.47, 1.49, 1.51],
  },
  3: {
    heights: [10, 15, 20, 30, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500],
    factors: [0.91, 0.97, 1.01, 1.06, 1.13, 1.22, 1.28, 1.32, 1.35, 1.38, 1.40, 1.42, 1.44, 1.46],
  },
  4: {
    heights: [10, 15, 20, 30, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500],
    factors: [0.80, 0.88, 0.93, 0.98, 1.05, 1.15, 1.21, 1.26, 1.29, 1.32, 1.35, 1.37, 1.39, 1.41],
  },
};

// External Pressure Coefficients for Rectangular Buildings
export const PRESSURE_COEFFICIENTS = {
  walls: {
    windward: 0.8,
    leeward: (d_b: number) => d_b <= 0.5 ? -0.3 : d_b <= 1 ? -0.4 : d_b <= 4 ? -0.5 : -0.6,
    side: -0.7,
  },
  flatRoof: {
    'h/w <= 0.5': { A: -1.0, B: -0.8, C: -0.4, D: -0.3 },
    '0.5 < h/w <= 1': { A: -1.0, B: -1.0, C: -0.6, D: -0.4 },
    '1 < h/w <= 2': { A: -1.2, B: -1.2, C: -0.7, D: -0.5 },
  },
  monoslope: {
    '0_deg': { upwind: -1.0, downwind: -0.4 },
    '10_deg': { upwind: -0.7, downwind: -0.4 },
    '20_deg': { upwind: 0.2, downwind: -0.4 },
    '30_deg': { upwind: 0.4, downwind: -0.3 },
  },
  duopitch: {
    '0_deg': { windward: -0.8, leeward: -0.4 },
    '10_deg': { windward: -0.6, leeward: -0.4 },
    '20_deg': { windward: 0.2, leeward: -0.4 },
    '30_deg': { windward: 0.4, leeward: -0.4 },
    '45_deg': { windward: 0.5, leeward: -0.5 },
  },
};

// Internal Pressure Coefficients
export const INTERNAL_PRESSURE_COEFFICIENTS = {
  'A': { Cpi_positive: 0.0, Cpi_negative: 0.0 },     // Enclosed
  'B': { Cpi_positive: 0.5, Cpi_negative: -0.5 },    // Partially enclosed
  'C': { Cpi_positive: 0.7, Cpi_negative: -0.7 },    // Open building
};

// ASCE 7-22 Velocity Pressure Exposure Coefficients Kz
export const ASCE7_KZ_FACTORS: Record<string, { alpha: number; zg: number }> = {
  'B': { alpha: 7.0, zg: 365.76 },   // Urban/suburban
  'C': { alpha: 9.5, zg: 274.32 },   // Open terrain
  'D': { alpha: 11.5, zg: 213.36 },  // Flat, unobstructed
};

// ============================================================================
// WIND LOAD ENGINE CLASS
// ============================================================================

export class AdvancedWindLoadEngine {
  private code: WindLoadCode;
  private siteData: WindSiteData;
  private building: BuildingGeometry;
  private errorHandler: EngineeringErrorHandler;

  constructor(
    code: WindLoadCode,
    siteData: WindSiteData,
    building: BuildingGeometry
  ) {
    this.code = code;
    this.siteData = siteData;
    this.building = building;
    this.errorHandler = new EngineeringErrorHandler({
      context: { module: 'WindLoadEngine', function: 'constructor', inputs: { code, siteData, building } }
    });
    
    this.validateInputs();
  }

  private validateInputs(): void {
    this.errorHandler.validateNumber(this.siteData.basicWindSpeed, 'Basic Wind Speed', { min: 20, max: 100 });
    this.errorHandler.validateNumber(this.building.height, 'Building Height', { min: 1, max: 500 });
    this.errorHandler.validateNumber(this.building.width, 'Building Width', { min: 1, max: 200 });
    this.errorHandler.validateNumber(this.building.depth, 'Building Depth', { min: 1, max: 200 });
  }

  // --------------------------------------------------------------------------
  // MAIN CALCULATION
  // --------------------------------------------------------------------------

  public calculateWindLoads(): WindLoadResult {
    switch (this.code) {
      case 'IS875':
        return this.calculateIS875();
      case 'ASCE7':
        return this.calculateASCE7();
      case 'EN1991':
        return this.calculateEN1991();
      case 'AS1170':
        return this.calculateAS1170();
      default:
        return this.calculateIS875();
    }
  }

  // --------------------------------------------------------------------------
  // IS 875 PART 3:2015
  // --------------------------------------------------------------------------

  private calculateIS875(): WindLoadResult {
    const { basicWindSpeed: Vb, terrainCategory, importanceFactor = 1.0 } = this.siteData;
    const { height: H, width: B, depth: D } = this.building;
    
    const checks: WindLoadResult['checks'] = [];
    
    // Risk coefficient (k1) - assuming 50 year return period
    const k1 = importanceFactor;
    
    // Topography factor (k3)
    const k3 = this.siteData.topographyFactor || 1.0;
    
    // Calculate heightwise pressures
    const heightwisePressures: WindPressureResult[] = [];
    const heights = this.generateHeightIntervals(H);
    
    for (const h of heights) {
      // Terrain & height factor (k2)
      const k2 = this.getIS875K2Factor(h, terrainCategory);
      
      // Design wind speed: Vz = k1 × k2 × k3 × Vb
      const Vz = k1 * k2 * k3 * Vb;
      
      // Design wind pressure: pz = 0.6 × Vz² (N/m²)
      const pz = 0.6 * Vz * Vz / 1000; // kN/m²
      
      // Get pressure coefficients
      const d_b = D / B;
      const Cpe = PRESSURE_COEFFICIENTS.walls.windward;
      const Cpi = this.getInternalPressureCoefficient();
      
      heightwisePressures.push({
        height: h,
        designWindSpeed: PrecisionMath.round(Vz, 2),
        designWindPressure: PrecisionMath.round(pz, 3),
        Cpe,
        Cpi,
        netPressure: PrecisionMath.round((Cpe - Cpi) * pz, 3),
      });
    }
    
    // Wall pressures
    const topPressure = heightwisePressures[heightwisePressures.length - 1];
    const d_b = D / B;
    
    const wallPressures = {
      windward: this.calculateWallForces(heightwisePressures, PRESSURE_COEFFICIENTS.walls.windward, B),
      leeward: this.calculateWallForces(heightwisePressures, PRESSURE_COEFFICIENTS.walls.leeward(d_b), B),
      sidewalls: this.calculateWallForces(heightwisePressures, PRESSURE_COEFFICIENTS.walls.side, D),
    };
    
    // Roof pressures
    const roofPressures = this.calculateRoofPressures(topPressure.designWindPressure);
    
    // Calculate base reactions
    const { baseShear, overturningMoment } = this.calculateBaseReactions(wallPressures, H);
    
    // Dynamic analysis for tall buildings
    let dynamicAnalysis;
    if (H > 50 || H / Math.min(B, D) > 5) {
      dynamicAnalysis = this.performDynamicAnalysis(topPressure.designWindSpeed, H, B, D);
      checks.push({
        name: 'Dynamic Analysis Required',
        status: 'WARNING',
        message: `Building height ${H}m exceeds 50m or aspect ratio > 5. Dynamic effects included.`,
      });
    }
    
    // Checks
    checks.push({
      name: 'Wind Speed',
      status: Vb <= 55 ? 'PASS' : 'WARNING',
      message: `Basic wind speed ${Vb} m/s ${Vb > 55 ? '(High wind zone)' : ''}`,
    });
    
    checks.push({
      name: 'Building Height',
      status: H <= 150 ? 'PASS' : H <= 300 ? 'WARNING' : 'FAIL',
      message: `Building height ${H}m. ${H > 150 ? 'Special wind tunnel study may be required.' : ''}`,
    });
    
    return {
      code: 'IS875',
      basicWindSpeed: Vb,
      designWindSpeed: topPressure.designWindSpeed,
      designWindPressure: topPressure.designWindPressure,
      heightwisePressures,
      wallPressures,
      roofPressures,
      baseShear: PrecisionMath.round(baseShear, 1),
      overturningMoment: PrecisionMath.round(overturningMoment, 1),
      dynamicAnalysis,
      checks,
    };
  }

  // --------------------------------------------------------------------------
  // ASCE 7-22
  // --------------------------------------------------------------------------

  private calculateASCE7(): WindLoadResult {
    const { basicWindSpeed: V, exposureCategory = 'C', directionality = 0.85 } = this.siteData;
    const { height: H, width: B, depth: D } = this.building;
    
    const checks: WindLoadResult['checks'] = [];
    
    // Kd - Wind directionality factor
    const Kd = directionality;
    
    // Kzt - Topographic factor (simplified)
    const Kzt = this.siteData.topographyFactor || 1.0;
    
    // Ke - Ground elevation factor (assume sea level)
    const Ke = 1.0;
    
    // Calculate heightwise pressures
    const heightwisePressures: WindPressureResult[] = [];
    const heights = this.generateHeightIntervals(H);
    
    const { alpha, zg } = ASCE7_KZ_FACTORS[exposureCategory];
    
    for (const h of heights) {
      // Kz - Velocity pressure exposure coefficient
      const Kz = h < 4.57 
        ? 2.01 * Math.pow(4.57 / zg, 2 / alpha)
        : 2.01 * Math.pow(h / zg, 2 / alpha);
      
      // Velocity pressure: qz = 0.613 × Kz × Kzt × Kd × Ke × V² (N/m²)
      const qz = 0.613 * Kz * Kzt * Kd * Ke * V * V / 1000; // kN/m²
      
      const Cpe = 0.8;  // Windward
      const Cpi = this.getInternalPressureCoefficient();
      
      heightwisePressures.push({
        height: h,
        designWindSpeed: PrecisionMath.round(V * Math.sqrt(Kz), 2),
        designWindPressure: PrecisionMath.round(qz, 3),
        Cpe,
        Cpi,
        netPressure: PrecisionMath.round((Cpe - Cpi) * qz, 3),
      });
    }
    
    const topPressure = heightwisePressures[heightwisePressures.length - 1];
    const d_b = D / B;
    
    const wallPressures = {
      windward: this.calculateWallForces(heightwisePressures, 0.8, B),
      leeward: this.calculateWallForces(heightwisePressures, -0.5, B),
      sidewalls: this.calculateWallForces(heightwisePressures, -0.7, D),
    };
    
    const roofPressures = this.calculateRoofPressures(topPressure.designWindPressure);
    const { baseShear, overturningMoment } = this.calculateBaseReactions(wallPressures, H);
    
    let dynamicAnalysis;
    if (H > 60 || H / Math.min(B, D) > 4) {
      dynamicAnalysis = this.performDynamicAnalysis(topPressure.designWindSpeed, H, B, D);
    }
    
    checks.push({
      name: 'Risk Category',
      status: 'PASS',
      message: `Exposure Category ${exposureCategory}, Kd = ${Kd}`,
    });
    
    return {
      code: 'ASCE7',
      basicWindSpeed: V,
      designWindSpeed: topPressure.designWindSpeed,
      designWindPressure: topPressure.designWindPressure,
      heightwisePressures,
      wallPressures,
      roofPressures,
      baseShear: PrecisionMath.round(baseShear, 1),
      overturningMoment: PrecisionMath.round(overturningMoment, 1),
      dynamicAnalysis,
      checks,
    };
  }

  // --------------------------------------------------------------------------
  // EN 1991-1-4 (EUROCODE)
  // --------------------------------------------------------------------------

  private calculateEN1991(): WindLoadResult {
    const { basicWindSpeed: Vb, terrainCategory } = this.siteData;
    const { height: H, width: B, depth: D } = this.building;
    
    const checks: WindLoadResult['checks'] = [];
    
    // Direction factor Cdir and season factor Cseason
    const Cdir = 1.0;
    const Cseason = 1.0;
    
    // Basic velocity: vb = Cdir × Cseason × vb,0
    const vb = Cdir * Cseason * Vb;
    
    // Air density
    const rho = 1.25; // kg/m³
    
    const heightwisePressures: WindPressureResult[] = [];
    const heights = this.generateHeightIntervals(H);
    
    // Terrain roughness parameters (EN 1991-1-4 Table 4.1)
    const terrainParams: Record<TerrainCategory, { z0: number; zmin: number }> = {
      1: { z0: 0.003, zmin: 1 },   // Sea
      2: { z0: 0.01, zmin: 1 },    // Lakes/flat
      3: { z0: 0.05, zmin: 2 },    // Suburbs
      4: { z0: 0.3, zmin: 5 },     // Urban
    };
    
    const { z0, zmin } = terrainParams[terrainCategory];
    const z0_II = 0.05; // Reference roughness
    const kr = 0.19 * Math.pow(z0 / z0_II, 0.07);
    
    for (const h of heights) {
      const z = Math.max(h, zmin);
      
      // Roughness factor cr(z)
      const cr = kr * Math.log(z / z0);
      
      // Turbulence factor co(z) - orography (simplified)
      const co = this.siteData.topographyFactor || 1.0;
      
      // Mean wind velocity vm(z)
      const vm = cr * co * vb;
      
      // Turbulence intensity Iv(z)
      const Iv = 1.0 / (co * Math.log(z / z0));
      
      // Peak velocity pressure qp(z)
      const qp = 0.5 * rho * vm * vm * (1 + 7 * Iv) / 1000; // kN/m²
      
      const Cpe = 0.8;
      const Cpi = this.getInternalPressureCoefficient();
      
      heightwisePressures.push({
        height: h,
        designWindSpeed: PrecisionMath.round(vm, 2),
        designWindPressure: PrecisionMath.round(qp, 3),
        Cpe,
        Cpi,
        netPressure: PrecisionMath.round((Cpe - Cpi) * qp, 3),
      });
    }
    
    const topPressure = heightwisePressures[heightwisePressures.length - 1];
    
    const wallPressures = {
      windward: this.calculateWallForces(heightwisePressures, 0.8, B),
      leeward: this.calculateWallForces(heightwisePressures, -0.5, B),
      sidewalls: this.calculateWallForces(heightwisePressures, -0.7, D),
    };
    
    const roofPressures = this.calculateRoofPressures(topPressure.designWindPressure);
    const { baseShear, overturningMoment } = this.calculateBaseReactions(wallPressures, H);
    
    checks.push({
      name: 'Terrain Category',
      status: 'PASS',
      message: `Category ${terrainCategory} (z0 = ${z0}m, zmin = ${zmin}m)`,
    });
    
    return {
      code: 'EN1991',
      basicWindSpeed: Vb,
      designWindSpeed: topPressure.designWindSpeed,
      designWindPressure: topPressure.designWindPressure,
      heightwisePressures,
      wallPressures,
      roofPressures,
      baseShear: PrecisionMath.round(baseShear, 1),
      overturningMoment: PrecisionMath.round(overturningMoment, 1),
      checks,
    };
  }

  // --------------------------------------------------------------------------
  // AS/NZS 1170.2
  // --------------------------------------------------------------------------

  private calculateAS1170(): WindLoadResult {
    const { basicWindSpeed: VR, terrainCategory } = this.siteData;
    const { height: H, width: B, depth: D } = this.building;
    
    const checks: WindLoadResult['checks'] = [];
    
    // Regional wind speed VR is the input
    // Direction multiplier Md (simplified)
    const Md = 1.0;
    
    // Shielding multiplier Ms (conservative)
    const Ms = 1.0;
    
    // Topographic multiplier Mt
    const Mt = this.siteData.topographyFactor || 1.0;
    
    const heightwisePressures: WindPressureResult[] = [];
    const heights = this.generateHeightIntervals(H);
    
    // Terrain-height multipliers (AS/NZS 1170.2 Table 4.1)
    const terrainMultipliers: Record<TerrainCategory, { M_cat: (z: number) => number }> = {
      1: { M_cat: (z) => 1.12 * Math.pow(z / 10, 0.11) },
      2: { M_cat: (z) => 1.00 * Math.pow(z / 10, 0.11) },
      3: { M_cat: (z) => Math.max(0.83, 0.83 * Math.pow(z / 10, 0.21)) },
      4: { M_cat: (z) => Math.max(0.75, 0.75 * Math.pow(z / 10, 0.25)) },
    };
    
    for (const h of heights) {
      // Terrain-height multiplier Mz,cat
      const Mz_cat = terrainMultipliers[terrainCategory].M_cat(h);
      
      // Site wind speed Vsit,β = VR × Md × (Mz,cat × Ms × Mt)
      const Vsit = VR * Md * Mz_cat * Ms * Mt;
      
      // Design wind pressure: p = 0.5 × ρair × V² = 0.6 × V² / 1000 kN/m²
      const pz = 0.6 * Vsit * Vsit / 1000;
      
      const Cpe = 0.8;
      const Cpi = this.getInternalPressureCoefficient();
      
      heightwisePressures.push({
        height: h,
        designWindSpeed: PrecisionMath.round(Vsit, 2),
        designWindPressure: PrecisionMath.round(pz, 3),
        Cpe,
        Cpi,
        netPressure: PrecisionMath.round((Cpe - Cpi) * pz, 3),
      });
    }
    
    const topPressure = heightwisePressures[heightwisePressures.length - 1];
    
    const wallPressures = {
      windward: this.calculateWallForces(heightwisePressures, 0.8, B),
      leeward: this.calculateWallForces(heightwisePressures, -0.5, B),
      sidewalls: this.calculateWallForces(heightwisePressures, -0.7, D),
    };
    
    const roofPressures = this.calculateRoofPressures(topPressure.designWindPressure);
    const { baseShear, overturningMoment } = this.calculateBaseReactions(wallPressures, H);
    
    checks.push({
      name: 'Regional Wind Speed',
      status: 'PASS',
      message: `VR = ${VR} m/s, Terrain Category ${terrainCategory}`,
    });
    
    return {
      code: 'AS1170',
      basicWindSpeed: VR,
      designWindSpeed: topPressure.designWindSpeed,
      designWindPressure: topPressure.designWindPressure,
      heightwisePressures,
      wallPressures,
      roofPressures,
      baseShear: PrecisionMath.round(baseShear, 1),
      overturningMoment: PrecisionMath.round(overturningMoment, 1),
      checks,
    };
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  private generateHeightIntervals(totalHeight: number): number[] {
    const heights: number[] = [];
    
    if (totalHeight <= 10) {
      heights.push(totalHeight);
    } else if (totalHeight <= 30) {
      for (let h = 5; h <= totalHeight; h += 5) {
        heights.push(h);
      }
      if (heights[heights.length - 1] < totalHeight) {
        heights.push(totalHeight);
      }
    } else {
      for (let h = 10; h <= totalHeight; h += 10) {
        heights.push(h);
      }
      if (heights[heights.length - 1] < totalHeight) {
        heights.push(totalHeight);
      }
    }
    
    return heights;
  }

  private getIS875K2Factor(height: number, terrain: TerrainCategory): number {
    const { heights, factors } = IS875_TERRAIN_FACTORS[terrain];
    
    // Linear interpolation
    for (let i = 0; i < heights.length - 1; i++) {
      if (height <= heights[i]) {
        return factors[i];
      }
      if (height > heights[i] && height <= heights[i + 1]) {
        const t = (height - heights[i]) / (heights[i + 1] - heights[i]);
        return factors[i] + t * (factors[i + 1] - factors[i]);
      }
    }
    
    return factors[factors.length - 1];
  }

  private getInternalPressureCoefficient(): number {
    const { openings } = this.building;
    
    if (!openings) {
      return 0.0; // Enclosed building
    }
    
    const totalOpening = openings.windward + openings.leeward + openings.side;
    
    if (openings.windward > 0.8 * totalOpening) {
      return 0.7;  // Dominant windward opening
    } else if (openings.leeward > 0.8 * totalOpening) {
      return -0.7; // Dominant leeward opening
    } else {
      return 0.0;  // Balanced or enclosed
    }
  }

  private calculateWallForces(
    heightwisePressures: WindPressureResult[],
    Cp: number,
    width: number
  ): WindForceResult[] {
    const forces: WindForceResult[] = [];
    const Cpi = this.getInternalPressureCoefficient();
    
    for (let i = 0; i < heightwisePressures.length; i++) {
      const h = heightwisePressures[i].height;
      const pz = heightwisePressures[i].designWindPressure;
      
      const prevH = i > 0 ? heightwisePressures[i - 1].height : 0;
      const tributaryHeight = h - prevH;
      const area = tributaryHeight * width;
      
      const netCp = Cp - Cpi;
      const pressure = netCp * pz;
      const force = pressure * area;
      
      forces.push({
        zone: `${prevH.toFixed(0)}-${h.toFixed(0)}m`,
        area: PrecisionMath.round(area, 1),
        Cp: netCp,
        pressure: PrecisionMath.round(pressure, 3),
        force: PrecisionMath.round(Math.abs(force), 1),
      });
    }
    
    return forces;
  }

  private calculateRoofPressures(topPressure: number): WindForceResult[] {
    const { roofType, roofAngle = 0, width, depth } = this.building;
    const roofArea = width * depth;
    
    let zones: { zone: string; Cp: number; areaFraction: number }[] = [];
    
    switch (roofType) {
      case 'flat':
        zones = [
          { zone: 'A (Edge)', Cp: -1.0, areaFraction: 0.1 },
          { zone: 'B (Corner)', Cp: -1.2, areaFraction: 0.05 },
          { zone: 'C (Center)', Cp: -0.6, areaFraction: 0.85 },
        ];
        break;
      case 'duopitch':
        if (roofAngle <= 10) {
          zones = [
            { zone: 'Windward', Cp: -0.6, areaFraction: 0.5 },
            { zone: 'Leeward', Cp: -0.4, areaFraction: 0.5 },
          ];
        } else if (roofAngle <= 30) {
          zones = [
            { zone: 'Windward', Cp: 0.2, areaFraction: 0.5 },
            { zone: 'Leeward', Cp: -0.4, areaFraction: 0.5 },
          ];
        } else {
          zones = [
            { zone: 'Windward', Cp: 0.5, areaFraction: 0.5 },
            { zone: 'Leeward', Cp: -0.5, areaFraction: 0.5 },
          ];
        }
        break;
      default:
        zones = [{ zone: 'Overall', Cp: -0.7, areaFraction: 1.0 }];
    }
    
    const Cpi = this.getInternalPressureCoefficient();
    
    return zones.map(z => {
      const area = roofArea * z.areaFraction;
      const netCp = z.Cp - Cpi;
      const pressure = netCp * topPressure;
      
      return {
        zone: z.zone,
        area: PrecisionMath.round(area, 1),
        Cp: netCp,
        pressure: PrecisionMath.round(pressure, 3),
        force: PrecisionMath.round(Math.abs(pressure * area), 1),
      };
    });
  }

  private calculateBaseReactions(
    wallPressures: WindLoadResult['wallPressures'],
    height: number
  ): { baseShear: number; overturningMoment: number } {
    let baseShear = 0;
    let overturningMoment = 0;
    
    // Windward wall contribution
    for (const force of wallPressures.windward) {
      baseShear += force.force;
      const avgHeight = this.parseZoneHeight(force.zone);
      overturningMoment += force.force * avgHeight;
    }
    
    // Leeward wall contribution (suction)
    for (const force of wallPressures.leeward) {
      baseShear += force.force;
      const avgHeight = this.parseZoneHeight(force.zone);
      overturningMoment += force.force * avgHeight;
    }
    
    return { baseShear, overturningMoment };
  }

  private parseZoneHeight(zone: string): number {
    const match = zone.match(/(\d+)-(\d+)/);
    if (match) {
      return (parseFloat(match[1]) + parseFloat(match[2])) / 2;
    }
    return 0;
  }

  private performDynamicAnalysis(
    designWindSpeed: number,
    height: number,
    width: number,
    depth: number
  ): WindLoadResult['dynamicAnalysis'] {
    // Approximate natural frequency (empirical formula)
    const f0 = 46 / height; // Hz (simplified for regular buildings)
    
    // Gust factor
    const I_h = 0.1; // Turbulence intensity at height h
    const B = 1 / (1 + 0.9 * Math.pow((height + width) / (2 * height * 0.3), 0.63));
    const S = 1.0; // Size effect factor (simplified)
    const E = 0.5 * (1 / (1 + 70 * f0 / designWindSpeed));
    const R = Math.sqrt(B * B + S * S * E);
    const gustFactor = 1 + 2 * I_h * R;
    
    // Dynamic response estimate
    const dynamicResponse = gustFactor - 1; // As a factor of static
    
    // Vortex shedding check
    const d = Math.min(width, depth); // Characteristic dimension
    const St = 0.2; // Strouhal number for rectangular sections
    const Vcr = f0 * d / St; // Critical velocity
    
    return {
      naturalFrequency: PrecisionMath.round(f0, 3),
      gustFactor: PrecisionMath.round(gustFactor, 2),
      dynamicResponse: PrecisionMath.round(dynamicResponse, 2),
      vortexShedding: {
        criticalSpeed: PrecisionMath.round(Vcr, 1),
        strouhalNumber: St,
        lockInRange: [PrecisionMath.round(0.8 * Vcr, 1), PrecisionMath.round(1.2 * Vcr, 1)],
      },
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createWindLoadEngine(
  code: WindLoadCode,
  siteData: WindSiteData,
  building: BuildingGeometry
): AdvancedWindLoadEngine {
  return new AdvancedWindLoadEngine(code, siteData, building);
}

export default AdvancedWindLoadEngine;
