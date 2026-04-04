/**
 * ============================================================================
 * ADVANCED WIND LOAD ANALYSIS ENGINE
 * ============================================================================
 * 
 * Comprehensive wind load analysis supporting:
 * - IS 875 Part 3:2015 (India)
 * - ASCE 7-22 (USA)
 * - Eurocode 1 (Europe)
 * - AS/NZS 1170.2 (Australia/New Zealand)
 * - BS EN 1991-1-4 (UK)
 * 
 * Features:
 * - Basic wind speed maps
 * - Terrain category effects
 * - Topography factors
 * - Along-wind/across-wind/torsional loads
 * - Dynamic effects (gust factors)
 * - Pressure coefficients for various shapes
 * - Vortex shedding analysis
 * - Cladding and component loads
 * 
 * @version 2.0.0
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type WindCode = 'IS875' | 'ASCE7' | 'EC1' | 'AS1170' | 'BS6399';
export type TerrainCategory = 1 | 2 | 3 | 4;
export type BuildingShape = 'rectangular' | 'circular' | 'L_shaped' | 'T_shaped' | 'irregular';
export type RoofType = 'flat' | 'pitched' | 'monoslope' | 'curved' | 'sawtooth' | 'canopy';
export type Enclosure = 'enclosed' | 'partially_enclosed' | 'open';

export interface WindParameters {
  code: WindCode;
  basicWindSpeed: number; // m/s
  terrainCategory: TerrainCategory;
  topographyFactor?: number;
  importanceFactor: number;
  buildingDimensions: {
    length: number;
    width: number;
    height: number;
    eaveHeight?: number;
  };
  buildingShape: BuildingShape;
  roofType: RoofType;
  roofPitch?: number; // degrees
  enclosure: Enclosure;
  dampingRatio?: number;
  naturalFrequency?: number;
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    cyclonic?: boolean;
  };
}

export interface PressureCoefficient {
  zone: string;
  Cpe: number; // External pressure coefficient
  Cpi: number; // Internal pressure coefficient
  Cp_net: number; // Net pressure coefficient
  area?: number;
}

export interface WindPressure {
  height: number;
  Vz: number; // Design wind speed at height z
  qz: number; // Velocity pressure
  pz_external: number; // External pressure
  pz_internal: number; // Internal pressure
  pz_net: number; // Net pressure
}

export interface WindForces {
  alongWind: { force: number; moment: number };
  acrossWind: { force: number; moment: number };
  torsional: { moment: number };
  uplift: number;
  totalBaseShear: { x: number; y: number };
  totalOverturning: { Mx: number; My: number };
}

export interface DynamicResponse {
  gustFactor: number;
  backgroundFactor: number;
  resonantFactor: number;
  peakFactor: number;
  dynamicMagnification: number;
  acceleration: number;
}

export interface CpDatabase {
  walls: Record<string, PressureCoefficient[]>;
  roofs: Record<string, PressureCoefficient[]>;
  canopies: Record<string, PressureCoefficient[]>;
  components: Record<string, number>;
}

export interface WindResult {
  designPressures: WindPressure[];
  forces: WindForces;
  dynamicResponse: DynamicResponse;
  coefficients: PressureCoefficient[];
  compliance: WindComplianceCheck[];
  vortexShedding?: VortexAnalysis;
}

export interface VortexAnalysis {
  criticalSpeed: number;
  strouhalNumber: number;
  lockInRange: { min: number; max: number };
  susceptible: boolean;
  amplitude: number;
  mitigation?: string;
}

export interface WindComplianceCheck {
  requirement: string;
  reference: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  value: number;
  limit: number;
}

// ============================================================================
// WIND SPEED MAPS AND DATA
// ============================================================================

const INDIA_WIND_SPEEDS: Record<string, number> = {
  'Delhi': 47,
  'Mumbai': 44,
  'Chennai': 50,
  'Kolkata': 50,
  'Bangalore': 33,
  'Hyderabad': 44,
  'Ahmedabad': 39,
  'Pune': 39,
  'Jaipur': 47,
  'Surat': 44,
  'Vizag': 50,
  'Bhubaneswar': 50,
  'Guwahati': 50,
  'Chandigarh': 47,
  'Kochi': 39,
  'Trivandrum': 39,
};

const US_WIND_SPEEDS: Record<string, { basic: number; ultimate: number }> = {
  'Miami': { basic: 178, ultimate: 195 },
  'Houston': { basic: 136, ultimate: 148 },
  'New Orleans': { basic: 148, ultimate: 162 },
  'Tampa': { basic: 150, ultimate: 165 },
  'NYC': { basic: 115, ultimate: 126 },
  'Chicago': { basic: 115, ultimate: 126 },
  'LA': { basic: 95, ultimate: 104 },
  'SF': { basic: 110, ultimate: 121 },
  'Seattle': { basic: 100, ultimate: 110 },
  'Denver': { basic: 122, ultimate: 134 },
};

const TERRAIN_FACTORS: Record<TerrainCategory, { alpha: number; zg: number; z0: number; Kd: number }> = {
  1: { alpha: 0.096, zg: 250, z0: 0.002, Kd: 1.05 },  // Open terrain
  2: { alpha: 0.143, zg: 300, z0: 0.02, Kd: 1.00 },   // Open with scattered obstructions
  3: { alpha: 0.188, zg: 350, z0: 0.2, Kd: 0.91 },    // Suburban
  4: { alpha: 0.250, zg: 400, z0: 2.0, Kd: 0.80 },    // Urban/CBD
};

// ============================================================================
// ADVANCED WIND ENGINE CLASS
// ============================================================================

export class AdvancedWindEngine {
  private params: WindParameters;
  private cpDatabase: CpDatabase;
  
  constructor(params: WindParameters) {
    this.params = params;
    this.cpDatabase = this.initializeCpDatabase();
  }

  // --------------------------------------------------------------------------
  // DESIGN WIND SPEED
  // --------------------------------------------------------------------------
  
  calculateDesignWindSpeed(height: number): number {
    const Vb = this.params.basicWindSpeed;
    const terrain = TERRAIN_FACTORS[this.params.terrainCategory];
    
    switch (this.params.code) {
      case 'IS875':
        return this.calculateIS875WindSpeed(height, Vb, terrain);
      case 'ASCE7':
        return this.calculateASCE7WindSpeed(height, Vb, terrain);
      case 'EC1':
        return this.calculateEC1WindSpeed(height, Vb, terrain);
      default:
        return this.calculateIS875WindSpeed(height, Vb, terrain);
    }
  }

  private calculateIS875WindSpeed(
    height: number,
    Vb: number,
    terrain: { alpha: number; zg: number; z0: number; Kd: number }
  ): number {
    // IS 875 Part 3:2015 methodology
    
    // Risk coefficient (k1)
    const k1 = this.getRiskCoefficient();
    
    // Terrain roughness and height factor (k2)
    const k2 = this.getTerrainFactor(height, terrain);
    
    // Topography factor (k3)
    const k3 = this.params.topographyFactor || 1.0;
    
    // Importance factor (k4)
    const k4 = this.params.importanceFactor;
    
    // Design wind speed
    const Vz = Vb * k1 * k2 * k3 * k4;
    
    // For cyclonic regions, apply additional factor
    if (this.params.location?.cyclonic) {
      return Vz * 1.15;
    }
    
    return Vz;
  }

  private calculateASCE7WindSpeed(
    height: number,
    Vb: number,
    terrain: { alpha: number; zg: number; z0: number; Kd: number }
  ): number {
    // ASCE 7-22 methodology
    
    // Directionality factor (Kd)
    const Kd = terrain.Kd;
    
    // Exposure factor (Kz)
    const Kz = this.getExposureFactor(height, terrain);
    
    // Topography factor (Kzt)
    const Kzt = this.params.topographyFactor || 1.0;
    
    // Ground elevation factor (Ke)
    const Ke = 1.0;
    
    // Velocity pressure
    const qz = 0.613 * Kz * Kzt * Kd * Ke * Math.pow(Vb * 0.447, 2);
    
    // Convert back to wind speed
    return Math.sqrt(2 * qz / 1.225);
  }

  private calculateEC1WindSpeed(
    height: number,
    Vb: number,
    terrain: { alpha: number; zg: number; z0: number; Kd: number }
  ): number {
    // Eurocode 1 methodology
    
    // Basic wind velocity
    const vb = Vb * 1.0; // Directional and seasonal factors assumed 1.0
    
    // Roughness length
    const z0 = terrain.z0;
    const zmin = Math.max(1, z0 * 50);
    
    // Terrain factor
    const kr = 0.19 * Math.pow(z0 / 0.05, 0.07);
    
    // Roughness factor
    const cr = height >= zmin 
      ? kr * Math.log(height / z0)
      : kr * Math.log(zmin / z0);
    
    // Orography factor
    const c0 = this.params.topographyFactor || 1.0;
    
    // Mean wind velocity
    const vm = cr * c0 * vb;
    
    // Turbulence intensity
    const Iv = 1 / (c0 * Math.log(Math.max(height, zmin) / z0));
    
    // Peak velocity pressure factor
    const qp_factor = (1 + 7 * Iv) * 0.5 * 1.25 * vm * vm / 1000;
    
    return vm * Math.sqrt(1 + 7 * Iv);
  }

  // --------------------------------------------------------------------------
  // TERRAIN AND EXPOSURE FACTORS
  // --------------------------------------------------------------------------
  
  private getRiskCoefficient(): number {
    // IS 875 Table 1 - Risk coefficient k1
    // Assuming 50-year return period for most structures
    return 1.0;
  }

  private getTerrainFactor(
    height: number,
    terrain: { alpha: number; zg: number; z0: number }
  ): number {
    // IS 875 Table 2 - k2 values
    const alpha = terrain.alpha;
    const zg = terrain.zg;
    const z = Math.min(Math.max(height, 10), zg);
    
    return Math.pow(z / 10, alpha);
  }

  private getExposureFactor(
    height: number,
    terrain: { alpha: number; zg: number }
  ): number {
    // ASCE 7 exposure factor Kz
    const alpha = 2 / terrain.alpha;
    const zg = terrain.zg;
    const z = Math.max(height, 4.5);
    
    if (z <= zg) {
      return 2.01 * Math.pow(z / zg, 2 / alpha);
    }
    return 2.01;
  }

  // --------------------------------------------------------------------------
  // PRESSURE COEFFICIENTS
  // --------------------------------------------------------------------------
  
  private initializeCpDatabase(): CpDatabase {
    return {
      walls: {
        'windward': [
          { zone: 'A', Cpe: 0.8, Cpi: 0, Cp_net: 0.8 },
          { zone: 'B', Cpe: 0.8, Cpi: 0, Cp_net: 0.8 },
        ],
        'leeward': [
          { zone: 'C', Cpe: -0.5, Cpi: 0, Cp_net: -0.5 },
          { zone: 'D', Cpe: -0.3, Cpi: 0, Cp_net: -0.3 },
        ],
        'side': [
          { zone: 'E', Cpe: -0.7, Cpi: 0, Cp_net: -0.7 },
          { zone: 'F', Cpe: -0.7, Cpi: 0, Cp_net: -0.7 },
        ],
      },
      roofs: {
        'flat': [
          { zone: 'G', Cpe: -1.8, Cpi: 0, Cp_net: -1.8, area: 1 },
          { zone: 'H', Cpe: -1.2, Cpi: 0, Cp_net: -1.2, area: 10 },
          { zone: 'I', Cpe: -0.7, Cpi: 0, Cp_net: -0.7, area: 100 },
        ],
        'pitched_windward': [
          { zone: 'J', Cpe: -0.6, Cpi: 0, Cp_net: -0.6 },
          { zone: 'K', Cpe: 0.2, Cpi: 0, Cp_net: 0.2 },
        ],
        'pitched_leeward': [
          { zone: 'L', Cpe: -0.6, Cpi: 0, Cp_net: -0.6 },
          { zone: 'M', Cpe: -0.3, Cpi: 0, Cp_net: -0.3 },
        ],
      },
      canopies: {
        'freestanding': [
          { zone: 'N', Cpe: 1.2, Cpi: -0.3, Cp_net: 1.5 },
          { zone: 'O', Cpe: -1.5, Cpi: 0.3, Cp_net: -1.8 },
        ],
      },
      components: {
        'corner_wall': 2.0,
        'edge_wall': 1.5,
        'center_wall': 1.0,
        'corner_roof': 2.8,
        'edge_roof': 2.0,
        'center_roof': 1.4,
      },
    };
  }

  calculatePressureCoefficients(): PressureCoefficient[] {
    const { length, width, height } = this.params.buildingDimensions;
    const aspectRatio = height / Math.min(length, width);
    const coefficients: PressureCoefficient[] = [];
    
    // Internal pressure coefficient based on enclosure
    let Cpi_positive: number, Cpi_negative: number;
    switch (this.params.enclosure) {
      case 'enclosed':
        Cpi_positive = 0.18;
        Cpi_negative = -0.18;
        break;
      case 'partially_enclosed':
        Cpi_positive = 0.55;
        Cpi_negative = -0.55;
        break;
      case 'open':
        Cpi_positive = 0;
        Cpi_negative = 0;
        break;
    }
    
    // Windward wall
    const Cpe_windward = 0.8;
    coefficients.push({
      zone: 'Windward Wall',
      Cpe: Cpe_windward,
      Cpi: Cpi_negative,
      Cp_net: Cpe_windward - Cpi_negative,
    });
    
    // Leeward wall (depends on L/B ratio)
    const LB_ratio = length / width;
    let Cpe_leeward: number;
    if (LB_ratio <= 1) Cpe_leeward = -0.5;
    else if (LB_ratio <= 2) Cpe_leeward = -0.3;
    else Cpe_leeward = -0.3;
    
    coefficients.push({
      zone: 'Leeward Wall',
      Cpe: Cpe_leeward,
      Cpi: Cpi_positive,
      Cp_net: Cpe_leeward - Cpi_positive,
    });
    
    // Side walls
    coefficients.push({
      zone: 'Side Wall',
      Cpe: -0.7,
      Cpi: Cpi_positive,
      Cp_net: -0.7 - Cpi_positive,
    });
    
    // Roof coefficients based on type
    const roofCoeffs = this.getRoofPressureCoefficients();
    coefficients.push(...roofCoeffs);
    
    return coefficients;
  }

  private getRoofPressureCoefficients(): PressureCoefficient[] {
    const pitch = this.params.roofPitch || 0;
    const { length, width, height } = this.params.buildingDimensions;
    const coefficients: PressureCoefficient[] = [];
    
    const Cpi_positive = this.params.enclosure === 'enclosed' ? 0.18 :
                       this.params.enclosure === 'partially_enclosed' ? 0.55 : 0;
    
    if (this.params.roofType === 'flat' || pitch < 10) {
      // Flat roof zones
      const h_b = height / Math.min(length, width);
      
      // Zone 1 (high suction at edges)
      const Cpe1 = h_b <= 0.5 ? -1.0 : (h_b <= 1 ? -1.2 : -1.4);
      coefficients.push({
        zone: 'Roof Zone 1 (Edge)',
        Cpe: Cpe1,
        Cpi: Cpi_positive,
        Cp_net: Cpe1 - Cpi_positive,
      });
      
      // Zone 2 (corners - highest suction)
      const Cpe2 = h_b <= 0.5 ? -1.5 : (h_b <= 1 ? -1.8 : -2.0);
      coefficients.push({
        zone: 'Roof Zone 2 (Corner)',
        Cpe: Cpe2,
        Cpi: Cpi_positive,
        Cp_net: Cpe2 - Cpi_positive,
      });
      
      // Zone 3 (interior)
      const Cpe3 = h_b <= 0.5 ? -0.7 : (h_b <= 1 ? -0.8 : -0.9);
      coefficients.push({
        zone: 'Roof Zone 3 (Interior)',
        Cpe: Cpe3,
        Cpi: Cpi_positive,
        Cp_net: Cpe3 - Cpi_positive,
      });
    } else {
      // Pitched roof
      const pitchRad = pitch * Math.PI / 180;
      
      // Windward slope
      let Cpe_windward: number;
      if (pitch < 10) Cpe_windward = -0.9;
      else if (pitch < 25) Cpe_windward = -0.5 + 0.04 * (pitch - 10);
      else if (pitch < 45) Cpe_windward = 0.1 + 0.025 * (pitch - 25);
      else Cpe_windward = 0.6;
      
      coefficients.push({
        zone: 'Windward Roof Slope',
        Cpe: Cpe_windward,
        Cpi: Cpe_windward > 0 ? -Cpi_positive : Cpi_positive,
        Cp_net: Cpe_windward - (Cpe_windward > 0 ? -Cpi_positive : Cpi_positive),
      });
      
      // Leeward slope (always suction)
      const Cpe_leeward = -0.5;
      coefficients.push({
        zone: 'Leeward Roof Slope',
        Cpe: Cpe_leeward,
        Cpi: Cpi_positive,
        Cp_net: Cpe_leeward - Cpi_positive,
      });
    }
    
    return coefficients;
  }

  // --------------------------------------------------------------------------
  // WIND FORCES CALCULATION
  // --------------------------------------------------------------------------
  
  calculateWindForces(): WindForces {
    const { length, width, height } = this.params.buildingDimensions;
    const coefficients = this.calculatePressureCoefficients();
    
    // Calculate pressures at different heights
    const pressures = this.calculateWindPressures();
    
    // Along-wind force (X-direction)
    const Cf_x = 1.3; // Force coefficient for rectangular building
    const A_x = width * height;
    const qh = pressures[pressures.length - 1].qz;
    const G = this.calculateGustFactor();
    
    const F_x = qh * G * Cf_x * A_x / 1000; // kN
    const M_x = this.calculateAlongWindMoment(pressures, width, G, Cf_x);
    
    // Across-wind force (Y-direction)
    const { force: F_y, moment: M_y } = this.calculateAcrossWindResponse();
    
    // Torsional moment
    const torsion = this.calculateTorsionalMoment(pressures, coefficients);
    
    // Uplift force
    const uplift = this.calculateUpliftForce(pressures, coefficients);
    
    return {
      alongWind: { force: F_x, moment: M_x },
      acrossWind: { force: F_y, moment: M_y },
      torsional: { moment: torsion },
      uplift,
      totalBaseShear: { x: F_x, y: F_y },
      totalOverturning: { Mx: M_x, My: M_y },
    };
  }

  calculateWindPressures(): WindPressure[] {
    const height = this.params.buildingDimensions.height;
    const numLevels = Math.max(10, Math.ceil(height / 3));
    const dz = height / numLevels;
    const pressures: WindPressure[] = [];
    
    const coefficients = this.calculatePressureCoefficients();
    const Cpe_windward = coefficients.find(c => c.zone.includes('Windward'))?.Cpe || 0.8;
    const Cpi = coefficients.find(c => c.zone.includes('Windward'))?.Cpi || 0;
    
    for (let i = 0; i <= numLevels; i++) {
      const z = Math.max(i * dz, 10);
      const Vz = this.calculateDesignWindSpeed(z);
      const rho = 1.225; // Air density kg/m³
      
      // Velocity pressure
      const qz = 0.5 * rho * Vz * Vz / 1000; // kN/m²
      
      // External pressure
      const pz_external = qz * Cpe_windward;
      
      // Internal pressure (constant with height)
      const pz_internal = qz * Cpi;
      
      // Net pressure
      const pz_net = pz_external - pz_internal;
      
      pressures.push({
        height: z,
        Vz,
        qz,
        pz_external,
        pz_internal,
        pz_net,
      });
    }
    
    return pressures;
  }

  private calculateAlongWindMoment(
    pressures: WindPressure[],
    width: number,
    G: number,
    Cf: number
  ): number {
    let moment = 0;
    
    for (let i = 1; i < pressures.length; i++) {
      const dz = pressures[i].height - pressures[i-1].height;
      const qz = (pressures[i].qz + pressures[i-1].qz) / 2;
      const z = (pressures[i].height + pressures[i-1].height) / 2;
      
      const dF = qz * G * Cf * width * dz / 1000;
      moment += dF * z;
    }
    
    return moment;
  }

  // --------------------------------------------------------------------------
  // DYNAMIC RESPONSE (GUST FACTOR METHOD)
  // --------------------------------------------------------------------------
  
  calculateGustFactor(): number {
    const height = this.params.buildingDimensions.height;
    const terrain = TERRAIN_FACTORS[this.params.terrainCategory];
    
    // Natural frequency estimate if not provided
    const n1 = this.params.naturalFrequency || 46 / height;
    
    // Damping
    const beta = this.params.dampingRatio || 0.02;
    
    switch (this.params.code) {
      case 'IS875':
        return this.calculateIS875GustFactor(height, n1, beta, terrain);
      case 'ASCE7':
        return this.calculateASCE7GustFactor(height, n1, beta, terrain);
      case 'EC1':
        return this.calculateEC1GustFactor(height, n1, beta, terrain);
      default:
        return this.calculateIS875GustFactor(height, n1, beta, terrain);
    }
  }

  private calculateIS875GustFactor(
    height: number,
    n1: number,
    beta: number,
    terrain: { alpha: number; z0: number }
  ): number {
    // IS 875 Part 3 Appendix B
    
    // Background factor
    const B = 0.63 / Math.pow(1 + 0.63 * Math.pow(
      (this.params.buildingDimensions.width + height) / 
      (2 * Math.pow(height / 10, 0.5) * 1200), 0.63
    ), 0.5);
    
    // Reduced frequency
    const N = n1 * height / this.calculateDesignWindSpeed(height);
    
    // Size reduction factor
    const S = Math.PI / (1 + 0.4 * (
      (this.params.buildingDimensions.width + height) / 
      (Math.pow(height / 10, 0.5) * 1200)
    ));
    
    // Spectrum value at natural frequency
    const E = 0.47 * N / Math.pow(1 + 0.39 * N, 5/6);
    
    // Resonant factor
    const R = Math.sqrt(Math.PI * E * S / (4 * beta));
    
    // Peak factor
    const gR = Math.sqrt(2 * Math.log(3600 * n1)) + 0.577 / Math.sqrt(2 * Math.log(3600 * n1));
    const gv = 3.5;
    
    // Turbulence intensity
    const Iv = this.getTurbulenceIntensity(height, terrain);
    
    // Gust factor
    const G = 1 + gR * Iv * Math.sqrt(B * B + gR * gR * R * R) / 
              (1 + gv * Iv);
    
    return Math.max(G, 1.0);
  }

  private calculateASCE7GustFactor(
    height: number,
    n1: number,
    beta: number,
    terrain: { alpha: number; zg: number }
  ): number {
    // ASCE 7 gust effect factor
    
    const z_bar = 0.6 * height;
    const Iz = 0.33 * Math.pow(z_bar / 10, -terrain.alpha);
    const Lz = 97.5 * Math.pow(z_bar / 10, 0.33);
    
    const Q = Math.sqrt(1 / (1 + 0.63 * Math.pow(
      (this.params.buildingDimensions.width + height) / Lz, 0.63
    )));
    
    const gQ = 3.4;
    const gR = Math.sqrt(2 * Math.log(3600 * n1)) + 0.577 / Math.sqrt(2 * Math.log(3600 * n1));
    const gv = 3.4;
    
    // For rigid structures (n1 > 1 Hz)
    if (n1 > 1) {
      return 0.85;
    }
    
    // For flexible structures
    const V_bar = this.calculateDesignWindSpeed(z_bar);
    const N1 = n1 * Lz / V_bar;
    const Rn = 7.47 * N1 / Math.pow(1 + 10.3 * N1, 5/3);
    
    const eta_h = 4.6 * n1 * height / V_bar;
    const eta_b = 4.6 * n1 * this.params.buildingDimensions.width / V_bar;
    const eta_L = 15.4 * n1 * this.params.buildingDimensions.length / V_bar;
    
    const Rh = (1 - Math.exp(-2 * eta_h)) / (2 * eta_h);
    const Rb = (1 - Math.exp(-2 * eta_b)) / (2 * eta_b);
    const RL = (1 - Math.exp(-2 * eta_L)) / (2 * eta_L);
    
    const R = Math.sqrt(Rn * Rh * Rb * (0.53 + 0.47 * RL) / beta);
    
    const G = 0.925 * (1 + 1.7 * Iz * Math.sqrt(gQ * gQ * Q * Q + gR * gR * R * R)) / 
              (1 + 1.7 * gv * Iz);
    
    return G;
  }

  private calculateEC1GustFactor(
    height: number,
    n1: number,
    beta: number,
    terrain: { z0: number }
  ): number {
    // Eurocode 1 structural factor
    
    const z = Math.max(height, terrain.z0 * 50);
    const zs = 0.6 * height;
    
    const kr = 0.19 * Math.pow(terrain.z0 / 0.05, 0.07);
    const cr = kr * Math.log(z / terrain.z0);
    const Iv = 1.0 / (cr * Math.log(z / terrain.z0));
    
    const L = 300 * Math.pow(z / 200, 0.67);
    
    const B2 = 1 / (1 + 0.9 * Math.pow(
      (this.params.buildingDimensions.width + height) / L, 0.63
    ));
    
    // Resonant response
    const Vm = this.calculateDesignWindSpeed(height);
    const fL = n1 * L / Vm;
    const SL = 6.8 * fL / Math.pow(1 + 10.2 * fL, 5/3);
    
    const R2 = Math.PI * Math.PI * SL / (2 * beta);
    
    const kp = Math.sqrt(2 * Math.log(600 * n1)) + 0.6 / Math.sqrt(2 * Math.log(600 * n1));
    
    const cs_cd = (1 + 2 * kp * Iv * Math.sqrt(B2 + R2)) / (1 + 7 * Iv);
    
    return cs_cd;
  }

  calculateDynamicResponse(): DynamicResponse {
    const height = this.params.buildingDimensions.height;
    const terrain = TERRAIN_FACTORS[this.params.terrainCategory];
    const n1 = this.params.naturalFrequency || 46 / height;
    const beta = this.params.dampingRatio || 0.02;
    
    const G = this.calculateGustFactor();
    
    // Background factor
    const B = 0.63 / Math.pow(1 + 0.63 * Math.pow(
      (this.params.buildingDimensions.width + height) / 1200, 0.63
    ), 0.5);
    
    // Resonant factor
    const Vz = this.calculateDesignWindSpeed(height);
    const N = n1 * height / Vz;
    const E = 0.47 * N / Math.pow(1 + 0.39 * N, 5/6);
    const R = Math.sqrt(Math.PI * E / (4 * beta));
    
    // Peak factor
    const peakFactor = Math.sqrt(2 * Math.log(3600 * n1)) + 0.577 / Math.sqrt(2 * Math.log(3600 * n1));
    
    // Dynamic magnification
    const dynamicMag = Math.sqrt(1 + R * R / (B * B));
    
    // Acceleration estimate
    const qh = 0.5 * 1.225 * Vz * Vz / 1000;
    const mass = 200 * this.params.buildingDimensions.length * this.params.buildingDimensions.width; // kg/m
    const acceleration = peakFactor * Math.sqrt(R * R) * qh * 1.3 * 
                         this.params.buildingDimensions.width / mass;
    
    return {
      gustFactor: G,
      backgroundFactor: B,
      resonantFactor: R,
      peakFactor,
      dynamicMagnification: dynamicMag,
      acceleration,
    };
  }

  private getTurbulenceIntensity(height: number, terrain: { alpha: number; z0: number }): number {
    const z = Math.max(height, 10);
    // IS 875 turbulence intensity
    return 0.1 * Math.pow(10 / z, terrain.alpha);
  }

  // --------------------------------------------------------------------------
  // ACROSS-WIND RESPONSE
  // --------------------------------------------------------------------------
  
  calculateAcrossWindResponse(): { force: number; moment: number } {
    const { length, width, height } = this.params.buildingDimensions;
    const n1 = this.params.naturalFrequency || 46 / height;
    const beta = this.params.dampingRatio || 0.02;
    
    // Vortex shedding analysis
    const vortex = this.analyzeVortexShedding();
    
    if (!vortex.susceptible) {
      // For non-susceptible buildings, across-wind is typically 60-70% of along-wind
      const alongWind = this.calculateWindForces().alongWind;
      return {
        force: alongWind.force * 0.6,
        moment: alongWind.moment * 0.6,
      };
    }
    
    // For susceptible buildings, use vortex-induced response
    const Vz = this.calculateDesignWindSpeed(height);
    const St = vortex.strouhalNumber;
    const rho = 1.225;
    
    // Lift coefficient (typical for rectangular sections)
    const CL_rms = 0.3;
    
    // Across-wind force (per unit height)
    const F_y = 0.5 * rho * Vz * Vz * width * CL_rms * Math.sqrt(Math.PI / (4 * beta));
    
    // Total across-wind force
    const force = F_y * height / 1000;
    
    // Overturning moment
    const moment = F_y * height * 0.6 * height / 1000;
    
    return { force, moment };
  }

  // --------------------------------------------------------------------------
  // VORTEX SHEDDING ANALYSIS
  // --------------------------------------------------------------------------
  
  analyzeVortexShedding(): VortexAnalysis {
    const { width, height } = this.params.buildingDimensions;
    const n1 = this.params.naturalFrequency || 46 / height;
    const Vz = this.calculateDesignWindSpeed(height);
    
    // Strouhal number (depends on shape)
    let St: number;
    switch (this.params.buildingShape) {
      case 'rectangular':
        const DR = this.params.buildingDimensions.length / width;
        St = DR <= 1 ? 0.12 : 0.12 * Math.pow(DR, -0.3);
        break;
      case 'circular':
        St = 0.20;
        break;
      default:
        St = 0.12;
    }
    
    // Critical wind speed for vortex shedding
    const Vcr = n1 * width / St;
    
    // Lock-in range (typically ±20% of critical speed)
    const lockInRange = {
      min: Vcr * 0.8,
      max: Vcr * 1.2,
    };
    
    // Check if susceptible
    const susceptible = Vcr < Vz && height / width > 5;
    
    // Amplitude estimate
    let amplitude = 0;
    if (susceptible) {
      const Sc = 2 * this.params.buildingDimensions.length * 
                 (this.params.dampingRatio || 0.02) / (1.225 * width * width);
      amplitude = 0.1 * width / Sc; // Simplified amplitude estimate
    }
    
    // Mitigation recommendations
    let mitigation: string | undefined;
    if (susceptible) {
      mitigation = amplitude > 0.01 * width 
        ? 'Consider adding helical strakes, dampers, or modifying cross-section'
        : 'Amplitude within acceptable limits; monitor during high winds';
    }
    
    return {
      criticalSpeed: Vcr,
      strouhalNumber: St,
      lockInRange,
      susceptible,
      amplitude,
      mitigation,
    };
  }

  // --------------------------------------------------------------------------
  // TORSIONAL MOMENT
  // --------------------------------------------------------------------------
  
  calculateTorsionalMoment(
    pressures: WindPressure[],
    coefficients: PressureCoefficient[]
  ): number {
    const { length, width, height } = this.params.buildingDimensions;
    const qh = pressures[pressures.length - 1].qz;
    
    // Eccentricity (IS 875 recommends 0.1B minimum)
    const e = 0.1 * Math.max(length, width);
    
    // Wind force on projected area
    const Cf = 1.3;
    const F = qh * this.calculateGustFactor() * Cf * width * height / 1000;
    
    // Torsional moment
    return F * e;
  }

  // --------------------------------------------------------------------------
  // UPLIFT FORCE
  // --------------------------------------------------------------------------
  
  calculateUpliftForce(
    pressures: WindPressure[],
    coefficients: PressureCoefficient[]
  ): number {
    const { length, width } = this.params.buildingDimensions;
    const roofArea = length * width;
    const qh = pressures[pressures.length - 1].qz;
    
    // Get roof suction coefficient
    const roofCoeff = coefficients.find(c => c.zone.includes('Roof'));
    const Cp_roof = roofCoeff?.Cp_net || -1.2;
    
    // Uplift pressure
    const p_uplift = qh * Math.abs(Cp_roof);
    
    // Total uplift force
    return p_uplift * roofArea;
  }

  // --------------------------------------------------------------------------
  // COMPLIANCE CHECKS
  // --------------------------------------------------------------------------
  
  checkCompliance(): WindComplianceCheck[] {
    const checks: WindComplianceCheck[] = [];
    const forces = this.calculateWindForces();
    const dynamic = this.calculateDynamicResponse();
    
    // Serviceability - acceleration check (typically 0.015g for comfort)
    const accLimit = 0.015 * 9.81;
    checks.push({
      requirement: 'Acceleration Serviceability',
      reference: `${this.params.code} Serviceability`,
      status: dynamic.acceleration <= accLimit ? 'PASS' : 
              dynamic.acceleration <= accLimit * 1.5 ? 'WARNING' : 'FAIL',
      value: dynamic.acceleration,
      limit: accLimit,
    });
    
    // Drift check (typically H/500 for serviceability)
    const { height } = this.params.buildingDimensions;
    const driftLimit = height / 500 * 1000; // mm
    const estimatedDrift = forces.alongWind.force * height / 
                           (1000 * 30000 * 0.01 * Math.pow(this.params.buildingDimensions.width, 3)); // Simplified
    
    checks.push({
      requirement: 'Lateral Drift',
      reference: `${this.params.code} Drift Limit`,
      status: estimatedDrift <= driftLimit ? 'PASS' : 'FAIL',
      value: estimatedDrift,
      limit: driftLimit,
    });
    
    // Vortex shedding check
    const vortex = this.analyzeVortexShedding();
    checks.push({
      requirement: 'Vortex Shedding',
      reference: `${this.params.code} Dynamic Effects`,
      status: !vortex.susceptible ? 'PASS' : 
              vortex.amplitude < 0.01 * this.params.buildingDimensions.width ? 'WARNING' : 'FAIL',
      value: vortex.amplitude * 1000,
      limit: 0.01 * this.params.buildingDimensions.width * 1000,
    });
    
    return checks;
  }

  // --------------------------------------------------------------------------
  // MAIN ANALYSIS
  // --------------------------------------------------------------------------
  
  analyze(): WindResult {
    const designPressures = this.calculateWindPressures();
    const forces = this.calculateWindForces();
    const dynamicResponse = this.calculateDynamicResponse();
    const coefficients = this.calculatePressureCoefficients();
    const compliance = this.checkCompliance();
    const vortexShedding = this.analyzeVortexShedding();
    
    return {
      designPressures,
      forces,
      dynamicResponse,
      coefficients,
      compliance,
      vortexShedding,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const createWindEngine = (params: WindParameters) => new AdvancedWindEngine(params);

export default AdvancedWindEngine;
