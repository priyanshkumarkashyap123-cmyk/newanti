/**
 * ============================================================================
 * TRANSPORTATION ENGINEERING MODULE
 * ============================================================================
 * 
 * Comprehensive transportation engineering calculations including:
 * - Geometric design of highways
 * - Pavement design (flexible & rigid)
 * - Traffic flow analysis
 * - Intersection design
 * - Railway engineering
 * - Airport runway design
 * 
 * @version 2.0.0
 */

// =============================================================================
// CONSTANTS
// =============================================================================

export const TRANSPORTATION_CONSTANTS = {
  GRAVITY: 9.81,                    // m/s²
  PERCEPTION_REACTION_TIME: 2.5,    // seconds (typical)
  DRIVER_EYE_HEIGHT: 1.08,          // m
  OBJECT_HEIGHT_STOPPING: 0.6,      // m
  OBJECT_HEIGHT_PASSING: 1.08,      // m
  HEADLIGHT_HEIGHT: 0.6,            // m
  HEADLIGHT_BEAM_DIVERGENCE: 1,     // degrees upward
};

export const VEHICLE_DIMENSIONS: Record<string, { length: number; width: number; height: number; wheelbase: number }> = {
  'passenger_car': { length: 5.8, width: 2.1, height: 1.3, wheelbase: 3.4 },
  'single_unit_truck': { length: 9.2, width: 2.6, height: 4.1, wheelbase: 6.1 },
  'intermediate_semitrailer': { length: 16.8, width: 2.6, height: 4.1, wheelbase: 12.2 },
  'large_semitrailer': { length: 20.9, width: 2.6, height: 4.1, wheelbase: 15.2 },
  'bus': { length: 12.2, width: 2.6, height: 3.4, wheelbase: 7.6 },
};

export const FRICTION_COEFFICIENTS: Record<string, { wet: number; dry: number }> = {
  'new_asphalt': { wet: 0.45, dry: 0.75 },
  'worn_asphalt': { wet: 0.35, dry: 0.60 },
  'concrete': { wet: 0.40, dry: 0.70 },
  'gravel': { wet: 0.30, dry: 0.50 },
  'ice': { wet: 0.10, dry: 0.15 },
  'snow': { wet: 0.15, dry: 0.25 },
};

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface HighwayParams {
  designSpeed: number;           // km/h
  terrain: 'level' | 'rolling' | 'mountainous';
  vehicleType: string;
  laneWidth: number;             // m
  shoulderWidth: number;         // m
  numberOfLanes: number;
}

export interface CurveParams {
  type: 'horizontal' | 'vertical';
  designSpeed: number;           // km/h
  radius?: number;               // m (for horizontal)
  length?: number;               // m (for vertical)
  superelevation?: number;       // % (for horizontal)
  grade1?: number;               // % (entry grade for vertical)
  grade2?: number;               // % (exit grade for vertical)
}

export interface PavementParams {
  type: 'flexible' | 'rigid';
  designLife: number;            // years
  trafficLoad: number;           // Million Standard Axles (MSA)
  subgradeStrength: number;      // CBR % or k-value
  reliability: number;           // %
  serviceability: {
    initial: number;
    terminal: number;
  };
}

export interface TrafficParams {
  volume: number;                // veh/hr
  freeFlowSpeed: number;         // km/h
  jamDensity: number;            // veh/km
  peakHourFactor?: number;
  heavyVehiclePercent?: number;
}

// =============================================================================
// GEOMETRIC DESIGN
// =============================================================================

export class GeometricDesign {
  /**
   * Calculate minimum stopping sight distance
   */
  static stoppingSightDistance(
    designSpeed: number,         // km/h
    grade: number = 0,           // % (positive = uphill)
    frictionCoeff: number = 0.35,
    perceptionTime: number = 2.5
  ): { distance: number; perceptionDistance: number; brakingDistance: number } {
    const V = designSpeed / 3.6; // Convert to m/s
    const g = TRANSPORTATION_CONSTANTS.GRAVITY;
    const f = frictionCoeff;
    const G = grade / 100;
    
    const perceptionDistance = V * perceptionTime;
    const brakingDistance = (V * V) / (2 * g * (f + G));
    
    return {
      distance: perceptionDistance + brakingDistance,
      perceptionDistance,
      brakingDistance,
    };
  }

  /**
   * Calculate passing sight distance
   */
  static passingSightDistance(
    designSpeed: number          // km/h
  ): number {
    // AASHTO method (simplified)
    // d = d1 + d2 + d3 + d4
    // d1 = Initial maneuver distance
    // d2 = Distance traveled during passing
    // d3 = Clearance distance
    // d4 = Distance traveled by opposing vehicle
    
    const V = designSpeed;
    
    // Approximation for various speeds
    if (V <= 50) return 180;
    if (V <= 60) return 240;
    if (V <= 70) return 300;
    if (V <= 80) return 370;
    if (V <= 90) return 440;
    if (V <= 100) return 520;
    return 600;
  }

  /**
   * Calculate decision sight distance
   */
  static decisionSightDistance(
    designSpeed: number,         // km/h
    avoidanceManeuver: 'A' | 'B' | 'C' | 'D' | 'E'
  ): number {
    const V = designSpeed;
    
    // Maneuver types:
    // A - Stop on rural road
    // B - Stop on urban road
    // C - Speed/path change on rural road
    // D - Speed/path change on suburban road
    // E - Speed/path change on urban road
    
    const distances: Record<string, Record<number, number>> = {
      'A': { 50: 75, 60: 95, 70: 115, 80: 140, 90: 170, 100: 200, 110: 235 },
      'B': { 50: 105, 60: 130, 70: 160, 80: 185, 90: 215, 100: 250, 110: 285 },
      'C': { 50: 150, 60: 180, 70: 210, 80: 250, 90: 295, 100: 345, 110: 395 },
      'D': { 50: 175, 60: 215, 70: 250, 80: 295, 90: 345, 100: 395, 110: 450 },
      'E': { 50: 200, 60: 245, 70: 290, 80: 340, 90: 400, 100: 460, 110: 530 },
    };
    
    const speedValues = Object.keys(distances[avoidanceManeuver]).map(Number);
    const closestSpeed = speedValues.reduce((prev, curr) => 
      Math.abs(curr - V) < Math.abs(prev - V) ? curr : prev
    );
    
    return distances[avoidanceManeuver][closestSpeed];
  }

  /**
   * Calculate minimum radius for horizontal curve
   */
  static minimumRadius(
    designSpeed: number,         // km/h
    superelevation: number,      // % (max typically 6-8%)
    sidefriction: number = 0.15
  ): number {
    const V = designSpeed;
    const e = superelevation / 100;
    const f = sidefriction;
    
    // R = V² / (127 * (e + f))
    return (V * V) / (127 * (e + f));
  }

  /**
   * Calculate superelevation for given radius
   */
  static superelevation(
    designSpeed: number,         // km/h
    radius: number,              // m
    maxSuperelevation: number = 8
  ): number {
    const V = designSpeed;
    const R = radius;
    const fMax = 0.15;
    
    // e = V² / (127 * R) - f
    let e = (V * V) / (127 * R) - fMax;
    e = e * 100; // Convert to percent
    
    return Math.min(maxSuperelevation, Math.max(0, e));
  }

  /**
   * Calculate transition curve (spiral) length
   */
  static spiralLength(
    designSpeed: number,         // km/h
    radius: number,              // m
    method: 'comfort' | 'superelevation' | 'minimum'
  ): number {
    const V = designSpeed / 3.6; // m/s
    const R = radius;
    
    switch (method) {
      case 'comfort':
        // Based on rate of change of centripetal acceleration
        const C = 1.0; // Rate of change (m/s³)
        return Math.pow(V, 3) / (C * R);
      
      case 'superelevation':
        // Based on superelevation runoff
        const e = this.superelevation(designSpeed, radius) / 100;
        const w = 3.6; // Lane width (m)
        const deltaGrade = 1 / 200; // Max relative gradient
        return e * w / deltaGrade;
      
      case 'minimum':
        // IRC recommendations
        return 2.7 * V * V / R;
      
      default:
        return 0;
    }
  }

  /**
   * Calculate K-value for vertical curve
   */
  static kValue(
    type: 'crest' | 'sag',
    designSpeed: number          // km/h
  ): number {
    const SSD = this.stoppingSightDistance(designSpeed).distance;
    
    if (type === 'crest') {
      const h1 = TRANSPORTATION_CONSTANTS.DRIVER_EYE_HEIGHT;
      const h2 = TRANSPORTATION_CONSTANTS.OBJECT_HEIGHT_STOPPING;
      // K = S² / (200 * (√h1 + √h2)²)
      return (SSD * SSD) / (200 * Math.pow(Math.sqrt(h1) + Math.sqrt(h2), 2));
    } else {
      // Sag curve - headlight criteria
      const S = SSD;
      const H = TRANSPORTATION_CONSTANTS.HEADLIGHT_HEIGHT;
      const beta = TRANSPORTATION_CONSTANTS.HEADLIGHT_BEAM_DIVERGENCE;
      // K = S² / (200 * (H + S * tan(β)))
      return (S * S) / (200 * (H + S * Math.tan(beta * Math.PI / 180)));
    }
  }

  /**
   * Calculate vertical curve length
   */
  static verticalCurveLength(
    grade1: number,              // % (entry grade)
    grade2: number,              // % (exit grade)
    K: number                    // K-value
  ): number {
    const A = Math.abs(grade1 - grade2);
    return K * A;
  }

  /**
   * Calculate vertical curve elevation at station
   */
  static verticalCurveElevation(
    PVC: { station: number; elevation: number },
    grade1: number,              // %
    grade2: number,              // %
    L: number,                   // Curve length
    station: number
  ): number {
    const x = station - PVC.station;
    const g1 = grade1 / 100;
    const g2 = grade2 / 100;
    const r = (g2 - g1) / L;
    
    return PVC.elevation + g1 * x + (r * x * x) / 2;
  }

  /**
   * Calculate sight distance on crest vertical curve
   */
  static sightDistanceOnCrest(
    L: number,                   // Curve length (m)
    A: number,                   // Algebraic difference of grades (%)
    h1: number = 1.08,           // Eye height (m)
    h2: number = 0.6             // Object height (m)
  ): number {
    // S = √(L * (√h1 + √h2)² / (2 * A))  when S < L
    const term = (Math.sqrt(h1) + Math.sqrt(h2));
    return Math.sqrt(L * term * term * 200 / A);
  }

  /**
   * Calculate widening on curves
   */
  static curveWidening(
    radius: number,              // m
    wheelbase: number = 6.1,     // m (default for trucks)
    numberOfLanes: number = 2,
    designSpeed: number = 80     // km/h
  ): number {
    const R = radius;
    const L = wheelbase;
    const V = designSpeed;
    
    // Mechanical widening
    const Wm = numberOfLanes * (L * L) / (2 * R);
    
    // Psychological widening
    const Wp = V / (9.5 * Math.sqrt(R));
    
    return Wm + Wp;
  }

  /**
   * Calculate gradient for given terrain
   */
  static maxGradient(
    terrain: 'level' | 'rolling' | 'mountainous',
    roadType: 'expressway' | 'national' | 'state' | 'rural'
  ): number {
    const gradients: Record<string, Record<string, number>> = {
      'level': { expressway: 3, national: 3, state: 4, rural: 5 },
      'rolling': { expressway: 4, national: 4, state: 5, rural: 6 },
      'mountainous': { expressway: 5, national: 5, state: 6, rural: 7 },
    };
    
    return gradients[terrain][roadType];
  }
}

// =============================================================================
// PAVEMENT DESIGN
// =============================================================================

export class PavementDesign {
  /**
   * Calculate flexible pavement thickness (AASHTO method)
   */
  static flexiblePavementAASHTO(
    W18: number,                 // Design ESALs (Million)
    R: number,                   // Reliability (%)
    So: number = 0.45,           // Combined standard error
    deltasPSI: number = 2.0,     // Serviceability loss
    MR: number                   // Resilient modulus of subgrade (psi)
  ): { SN: number; layers: { layer: string; coefficient: number; thickness: number }[] } {
    // Convert reliability to ZR
    const ZR_table: Record<number, number> = {
      50: 0, 75: -0.674, 80: -0.841, 85: -1.037, 
      90: -1.282, 95: -1.645, 99: -2.327
    };
    const ZR = ZR_table[R] || -1.282;
    
    // AASHTO equation
    // log10(W18) = ZR*So + 9.36*log10(SN+1) - 0.20 + log10(ΔPSI/(4.2-1.5))/(0.40+1094/(SN+1)^5.19) + 2.32*log10(MR) - 8.07
    
    // Iterative solution for SN
    let SN = 4; // Initial guess
    const W18_log = Math.log10(W18 * 1e6);
    
    for (let i = 0; i < 100; i++) {
      const term1 = ZR * So;
      const term2 = 9.36 * Math.log10(SN + 1) - 0.20;
      const term3 = Math.log10(deltasPSI / 2.7) / (0.40 + 1094 / Math.pow(SN + 1, 5.19));
      const term4 = 2.32 * Math.log10(MR) - 8.07;
      
      const calculated_W18 = term1 + term2 + term3 + term4;
      
      if (Math.abs(calculated_W18 - W18_log) < 0.01) break;
      
      SN = SN + (W18_log - calculated_W18) * 0.5;
    }
    
    // Typical layer coefficients
    const a1 = 0.44; // AC surface
    const a2 = 0.14; // Granular base
    const a3 = 0.11; // Granular subbase
    
    // Calculate layer thicknesses (approximate)
    const D1 = Math.max(3, SN * 0.3 / a1 * 2.54); // Surface course (inches to cm)
    const D2 = Math.max(6, SN * 0.4 / a2 * 2.54); // Base course
    const D3 = Math.max(8, SN * 0.3 / a3 * 2.54); // Subbase
    
    return {
      SN,
      layers: [
        { layer: 'AC Surface', coefficient: a1, thickness: D1 },
        { layer: 'Granular Base', coefficient: a2, thickness: D2 },
        { layer: 'Granular Subbase', coefficient: a3, thickness: D3 },
      ],
    };
  }

  /**
   * Calculate flexible pavement thickness (IRC method)
   */
  static flexiblePavementIRC(
    MSA: number,                 // Million Standard Axles
    CBR: number                  // Subgrade CBR (%)
  ): { totalThickness: number; layers: { layer: string; thickness: number }[] } {
    // IRC:37-2018 catalogue approach (simplified)
    
    // Calculate total pavement thickness based on CBR
    let totalThickness: number;
    
    if (CBR <= 2) {
      totalThickness = 660 + MSA * 10;
    } else if (CBR <= 5) {
      totalThickness = 550 + MSA * 8;
    } else if (CBR <= 10) {
      totalThickness = 450 + MSA * 6;
    } else if (CBR <= 15) {
      totalThickness = 350 + MSA * 5;
    } else {
      totalThickness = 300 + MSA * 4;
    }
    
    // Layer distribution
    const bcThickness = Math.min(75, totalThickness * 0.15);
    const dbmThickness = Math.min(100, totalThickness * 0.2);
    const baseThickness = Math.min(250, totalThickness * 0.35);
    const subbaseThickness = totalThickness - bcThickness - dbmThickness - baseThickness;
    
    return {
      totalThickness,
      layers: [
        { layer: 'Bituminous Concrete (BC)', thickness: bcThickness },
        { layer: 'Dense Bituminous Macadam (DBM)', thickness: dbmThickness },
        { layer: 'Wet Mix Macadam (WMM)', thickness: baseThickness },
        { layer: 'Granular Sub-Base (GSB)', thickness: Math.max(150, subbaseThickness) },
      ],
    };
  }

  /**
   * Calculate rigid pavement thickness (AASHTO method)
   */
  static rigidPavementAASHTO(
    W18: number,                 // Design ESALs (Million)
    R: number,                   // Reliability (%)
    So: number = 0.35,           // Standard error
    deltasPSI: number = 2.0,     // Serviceability loss
    Sc: number = 650,            // Concrete modulus of rupture (psi)
    Cd: number = 1.0,            // Drainage coefficient
    J: number = 3.2,             // Load transfer coefficient
    Ec: number = 4e6,            // Concrete elastic modulus (psi)
    k: number = 150              // Modulus of subgrade reaction (pci)
  ): { thickness: number } {
    const ZR_table: Record<number, number> = {
      50: 0, 75: -0.674, 80: -0.841, 85: -1.037, 
      90: -1.282, 95: -1.645, 99: -2.327
    };
    const ZR = ZR_table[R] || -1.282;
    
    // Iterative solution for D
    let D = 9; // Initial guess (inches)
    const W18_log = Math.log10(W18 * 1e6);
    
    for (let i = 0; i < 100; i++) {
      const term1 = ZR * So;
      const term2 = 7.35 * Math.log10(D + 1) - 0.06;
      const term3 = Math.log10(deltasPSI / 2.7) / 
                   (1 + 1.624e7 / Math.pow(D + 1, 8.46));
      const term4 = (4.22 - 0.32 * Math.log10(1)) * 
                   Math.log10(Sc * Cd * Math.pow(D, 0.75) / 
                   (18.42 * Math.pow(Ec / k, 0.25) * Math.pow(J, 0.75)));
      
      const calculated_W18 = term1 + term2 + term3 + term4;
      
      if (Math.abs(calculated_W18 - W18_log) < 0.01) break;
      
      D = D + (W18_log - calculated_W18) * 0.5;
    }
    
    return { thickness: D * 25.4 }; // Convert to mm
  }

  /**
   * Calculate rigid pavement thickness (IRC method)
   */
  static rigidPavementIRC(
    MSA: number,                 // Million Standard Axles
    k: number,                   // Modulus of subgrade reaction (MPa/m)
    flexuralStrength: number = 4.5  // MPa
  ): { slabThickness: number; dlcThickness: number } {
    // IRC:58-2015 simplified
    
    // Minimum DLC thickness
    const dlcThickness = 150; // mm
    
    // Effective k-value with DLC
    const kEffective = k * 1.5;
    
    // Slab thickness calculation (simplified)
    let slabThickness: number;
    
    if (MSA <= 2) {
      slabThickness = 200 + (k < 100 ? 50 : 0);
    } else if (MSA <= 10) {
      slabThickness = 250 + (k < 100 ? 50 : 0);
    } else if (MSA <= 50) {
      slabThickness = 280 + (k < 100 ? 50 : 0);
    } else {
      slabThickness = 300 + (k < 100 ? 50 : 0);
    }
    
    return { slabThickness, dlcThickness };
  }

  /**
   * Calculate CBR from different tests
   */
  static cbrFromOtherTests(
    testType: 'SPT' | 'DCP' | 'subgrade_modulus',
    value: number
  ): number {
    switch (testType) {
      case 'SPT':
        // CBR ≈ N/5 for sandy soils
        return value / 5;
      case 'DCP':
        // CBR = 292 / DCP^1.12 (mm/blow)
        return 292 / Math.pow(value, 1.12);
      case 'subgrade_modulus':
        // MR = 1500 * CBR for fine-grained soils
        return value / 1500;
      default:
        return 5; // Default conservative value
    }
  }

  /**
   * Calculate design traffic (ESAL)
   */
  static designTraffic(
    initialADT: number,          // Average Daily Traffic
    truckPercent: number,        // % of trucks
    growthRate: number,          // Annual growth rate (%)
    designLife: number,          // years
    laneFactor: number = 0.5,    // Distribution factor
    truckFactor: number = 1.0    // Truck factor (ESALs per truck)
  ): number {
    const r = growthRate / 100;
    const n = designLife;
    
    // Growth factor
    const GF = (Math.pow(1 + r, n) - 1) / r;
    
    // Design ESALs
    const ESALs = initialADT * (truckPercent / 100) * truckFactor * laneFactor * GF * 365;
    
    return ESALs / 1e6; // Million ESALs
  }
}

// =============================================================================
// TRAFFIC FLOW THEORY
// =============================================================================

export class TrafficFlow {
  /**
   * Calculate fundamental traffic flow relationship
   */
  static fundamentalDiagram(
    density: number,             // veh/km
    freeFlowSpeed: number,       // km/h
    jamDensity: number           // veh/km
  ): { flow: number; speed: number } {
    // Greenshields model
    const speed = freeFlowSpeed * (1 - density / jamDensity);
    const flow = density * speed;
    
    return { flow, speed };
  }

  /**
   * Calculate capacity and critical density
   */
  static capacity(
    freeFlowSpeed: number,       // km/h
    jamDensity: number           // veh/km
  ): { capacity: number; criticalDensity: number; criticalSpeed: number } {
    const criticalDensity = jamDensity / 2;
    const criticalSpeed = freeFlowSpeed / 2;
    const capacity = criticalDensity * criticalSpeed;
    
    return { capacity, criticalDensity, criticalSpeed };
  }

  /**
   * Calculate Level of Service
   */
  static levelOfService(
    volumeCapacityRatio: number
  ): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' {
    if (volumeCapacityRatio <= 0.35) return 'A';
    if (volumeCapacityRatio <= 0.55) return 'B';
    if (volumeCapacityRatio <= 0.75) return 'C';
    if (volumeCapacityRatio <= 0.90) return 'D';
    if (volumeCapacityRatio <= 1.00) return 'E';
    return 'F';
  }

  /**
   * Calculate Peak Hour Factor
   */
  static peakHourFactor(
    hourlyVolume: number,
    peak15MinVolume: number
  ): number {
    return hourlyVolume / (4 * peak15MinVolume);
  }

  /**
   * Calculate service flow rate
   */
  static serviceFlowRate(
    volume: number,              // veh/hr
    PHF: number,                 // Peak hour factor
    heavyVehiclePercent: number, // %
    ET: number = 2.0             // PCE for trucks
  ): number {
    const fHV = 1 / (1 + (heavyVehiclePercent / 100) * (ET - 1));
    return volume / (PHF * fHV);
  }

  /**
   * Calculate headway
   */
  static headway(
    flow: number                 // veh/hr
  ): { timeHeadway: number; spaceHeadway: number } {
    const timeHeadway = 3600 / flow; // seconds
    return { timeHeadway, spaceHeadway: timeHeadway * 15 }; // Assuming 15 m/s ≈ 54 km/h
  }

  /**
   * Calculate delay at signalized intersection (Webster's)
   */
  static websterDelay(
    cycleLength: number,         // seconds
    greenRatio: number,          // g/C
    flow: number,                // veh/hr
    saturationFlow: number       // veh/hr
  ): number {
    const C = cycleLength;
    const lambda = greenRatio;
    const x = flow / (saturationFlow * lambda); // Degree of saturation
    
    // Uniform delay
    const d1 = C * Math.pow(1 - lambda, 2) / (2 * (1 - lambda * x));
    
    // Random delay
    const d2 = Math.pow(x, 2) / (2 * flow * (1 - x));
    
    return d1 + d2;
  }

  /**
   * Calculate optimum cycle length (Webster's)
   */
  static websterOptimumCycle(
    totalLostTime: number,       // seconds
    totalCriticalFlowRatios: number
  ): number {
    const L = totalLostTime;
    const Y = totalCriticalFlowRatios;
    
    return (1.5 * L + 5) / (1 - Y);
  }

  /**
   * Calculate queue length
   */
  static queueLength(
    arrivalRate: number,         // veh/hr
    serviceRate: number,         // veh/hr
    time: number = 1             // hours
  ): { averageQueue: number; maxQueue: number } {
    const lambda = arrivalRate;
    const mu = serviceRate;
    const rho = lambda / mu;
    
    if (rho >= 1) {
      // Oversaturated
      return {
        averageQueue: (lambda - mu) * time,
        maxQueue: (lambda - mu) * time * 1.5,
      };
    }
    
    // M/M/1 queue
    const averageQueue = rho / (1 - rho);
    const maxQueue = averageQueue * 2;
    
    return { averageQueue, maxQueue };
  }

  /**
   * Calculate shock wave speed
   */
  static shockWaveSpeed(
    flow1: number, density1: number,
    flow2: number, density2: number
  ): number {
    return (flow1 - flow2) / (density1 - density2);
  }
}

// =============================================================================
// INTERSECTION DESIGN
// =============================================================================

export class IntersectionDesign {
  /**
   * Calculate minimum green time
   */
  static minimumGreen(
    pedestrianCrossingDistance: number,  // m
    pedestrianSpeed: number = 1.2         // m/s
  ): number {
    return 7 + pedestrianCrossingDistance / pedestrianSpeed;
  }

  /**
   * Calculate yellow interval
   */
  static yellowInterval(
    approachSpeed: number,       // km/h
    perceptionTime: number = 1.0,
    deceleration: number = 3.0   // m/s²
  ): number {
    const V = approachSpeed / 3.6;
    return perceptionTime + V / (2 * deceleration);
  }

  /**
   * Calculate all-red interval
   */
  static allRedInterval(
    intersectionWidth: number,   // m
    vehicleLength: number = 6,   // m
    approachSpeed: number        // km/h
  ): number {
    const V = approachSpeed / 3.6;
    return (intersectionWidth + vehicleLength) / V;
  }

  /**
   * Calculate saturation flow rate
   */
  static saturationFlow(
    laneWidth: number = 3.5,     // m
    grade: number = 0,           // %
    heavyVehicles: number = 0,   // %
    parkingAdjustment: number = 1.0,
    busBlockage: number = 1.0,
    areaType: 'CBD' | 'other' = 'other'
  ): number {
    const baseSaturationFlow = 1900; // pcph/lane
    
    const fw = laneWidth >= 3.6 ? 1.0 : 0.9 + laneWidth / 36;
    const fHV = 100 / (100 + heavyVehicles);
    const fg = 1 - grade / 200;
    const fa = areaType === 'CBD' ? 0.9 : 1.0;
    
    return baseSaturationFlow * fw * fHV * fg * parkingAdjustment * busBlockage * fa;
  }

  /**
   * Calculate intersection capacity
   */
  static intersectionCapacity(
    saturationFlow: number,      // veh/hr/lane
    numberOfLanes: number,
    greenTime: number,           // seconds
    cycleLength: number          // seconds
  ): number {
    return saturationFlow * numberOfLanes * (greenTime / cycleLength);
  }

  /**
   * Calculate turning radius
   */
  static turningRadius(
    vehicleType: string,
    angle: number = 90           // degrees
  ): { innerRadius: number; outerRadius: number } {
    const vehicle = VEHICLE_DIMENSIONS[vehicleType] || VEHICLE_DIMENSIONS['passenger_car'];
    
    // Minimum inner radius based on vehicle
    const innerRadius = vehicle.wheelbase * 1.5;
    const outerRadius = innerRadius + vehicle.width + 1.0;
    
    return { innerRadius, outerRadius };
  }

  /**
   * Calculate corner radius for channelization
   */
  static cornerRadius(
    designVehicle: string,
    turnAngle: number = 90
  ): number {
    const radii: Record<string, number> = {
      'passenger_car': 7.5,
      'single_unit_truck': 12,
      'intermediate_semitrailer': 15,
      'large_semitrailer': 18,
      'bus': 12,
    };
    
    const baseRadius = radii[designVehicle] || 10;
    
    // Adjust for turn angle
    if (turnAngle < 90) {
      return baseRadius * 0.8;
    } else if (turnAngle > 90) {
      return baseRadius * 1.2;
    }
    
    return baseRadius;
  }
}

// =============================================================================
// RAILWAY ENGINEERING
// =============================================================================

export class RailwayEngineering {
  /**
   * Calculate ruling gradient
   */
  static rulingGradient(
    tractiveEffort: number,      // kN
    trainWeight: number,         // tonnes
    trainResistance: number      // N/tonne
  ): number {
    // G = (TE - TR*W) / W
    const W = trainWeight;
    const TE = tractiveEffort * 1000; // Convert to N
    const TR = trainResistance;
    
    return ((TE - TR * W) / (W * 9.81)) * 100;
  }

  /**
   * Calculate compensated gradient on curves
   */
  static compensatedGradient(
    actualGradient: number,      // %
    curveRadius: number          // m
  ): number {
    // Compensation = 0.04% per degree of curve (for BG)
    const degreeOfCurve = 1750 / curveRadius;
    const compensation = 0.04 * degreeOfCurve;
    
    return actualGradient + compensation;
  }

  /**
   * Calculate super-elevation for curves
   */
  static railwaySuperElevation(
    speed: number,               // km/h (maximum)
    radius: number,              // m
    gauge: number = 1676         // mm (Broad Gauge)
  ): { equilibrium: number; cant: number; cantDeficiency: number } {
    const V = speed;
    const R = radius;
    const G = gauge;
    
    // Equilibrium cant
    const eqCant = G * V * V / (127 * R);
    
    // Maximum cant (typically 165mm for BG)
    const maxCant = 165;
    
    // Actual cant (limited by maximum)
    const cant = Math.min(eqCant, maxCant);
    
    // Cant deficiency
    const cantDeficiency = eqCant - cant;
    
    return { equilibrium: eqCant, cant, cantDeficiency };
  }

  /**
   * Calculate transition curve length for railways
   */
  static transitionLength(
    cant: number,                // mm
    cantGradient: number = 1     // mm per meter (typically 1:720 = 1.39)
  ): number {
    return cant / cantGradient;
  }

  /**
   * Calculate extra clearance on curves
   */
  static extraClearance(
    radius: number,              // m
    vehicleLength: number = 21.34  // m (for coaches)
  ): { overturn: number; lean: number; total: number } {
    const R = radius;
    const L = vehicleLength;
    
    // Overturn (mid-ordinate)
    const overturn = (L * L) / (8 * R) * 1000; // mm
    
    // Lean due to superelevation
    const lean = 50; // Approximate, mm
    
    return { overturn, lean, total: overturn + lean };
  }
}

// =============================================================================
// AIRPORT ENGINEERING
// =============================================================================

export class AirportEngineering {
  /**
   * Calculate runway length requirements
   */
  static runwayLength(
    baseLength: number,          // Standard runway length (m)
    elevation: number,           // Airport elevation (m)
    temperature: number,         // Reference temperature (°C)
    effectiveGradient: number    // % (effective runway gradient)
  ): number {
    // Elevation correction (7% per 300m)
    const elevationFactor = 1 + 0.07 * (elevation / 300);
    
    // Temperature correction (1% per °C above 15°C at sea level)
    const stdTemp = 15 - 0.0065 * elevation;
    const tempFactor = 1 + 0.01 * (temperature - stdTemp);
    
    // Gradient correction (10% per 1% effective gradient)
    const gradientFactor = 1 + 0.1 * effectiveGradient;
    
    return baseLength * elevationFactor * tempFactor * gradientFactor;
  }

  /**
   * Calculate runway orientation
   */
  static runwayOrientation(
    windData: { direction: number; speed: number; frequency: number }[],
    crosswindLimit: number = 15  // knots
  ): { orientation: number; coverage: number } {
    // Calculate wind coverage for different orientations
    let bestOrientation = 0;
    let maxCoverage = 0;
    
    for (let angle = 0; angle < 180; angle += 10) {
      let coverage = 0;
      
      windData.forEach(wind => {
        const crossAngle = Math.abs(wind.direction - angle);
        const effectiveAngle = Math.min(crossAngle, 180 - crossAngle);
        const crosswindComponent = wind.speed * Math.sin(effectiveAngle * Math.PI / 180);
        
        if (crosswindComponent <= crosswindLimit) {
          coverage += wind.frequency;
        }
      });
      
      if (coverage > maxCoverage) {
        maxCoverage = coverage;
        bestOrientation = angle;
      }
    }
    
    return { orientation: bestOrientation, coverage: maxCoverage };
  }

  /**
   * Calculate taxiway separation
   */
  static taxiwaySeparation(
    aircraftCategory: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  ): { runwayToTaxiway: number; taxiwayToTaxiway: number; taxiwayToObject: number } {
    const separations: Record<string, { rtw: number; ttt: number; tto: number }> = {
      'A': { rtw: 82.5, ttt: 21, tto: 16.25 },
      'B': { rtw: 87, ttt: 33.5, tto: 21.5 },
      'C': { rtw: 168, ttt: 44, tto: 26 },
      'D': { rtw: 176, ttt: 66.5, tto: 40.5 },
      'E': { rtw: 182.5, ttt: 80, tto: 47.5 },
      'F': { rtw: 190, ttt: 97.5, tto: 57.5 },
    };
    
    const sep = separations[aircraftCategory];
    return {
      runwayToTaxiway: sep.rtw,
      taxiwayToTaxiway: sep.ttt,
      taxiwayToObject: sep.tto,
    };
  }

  /**
   * Calculate PCN (Pavement Classification Number)
   */
  static pavementStrength(
    ACN: number,                 // Aircraft Classification Number
    tirePressure: string,        // 'high', 'medium', 'low', 'very low'
    subgradeStrength: string     // 'A' (high) to 'D' (low)
  ): { PCN: number; compatible: boolean } {
    // Simplified - PCN should equal or exceed ACN for unrestricted operations
    const tireFactor: Record<string, number> = {
      'high': 1.0, 'medium': 0.95, 'low': 0.90, 'very low': 0.85
    };
    
    const subgradeFactor: Record<string, number> = {
      'A': 1.0, 'B': 0.9, 'C': 0.8, 'D': 0.7
    };
    
    const PCN = ACN * tireFactor[tirePressure] * subgradeFactor[subgradeStrength];
    
    return { PCN, compatible: PCN >= ACN };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  GeometricDesign,
  PavementDesign,
  TrafficFlow,
  IntersectionDesign,
  RailwayEngineering,
  AirportEngineering,
  TRANSPORTATION_CONSTANTS,
  VEHICLE_DIMENSIONS,
  FRICTION_COEFFICIENTS,
};
