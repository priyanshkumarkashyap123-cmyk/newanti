/**
 * ============================================================================
 * HYDRAULICS & HYDROLOGY ENGINE
 * ============================================================================
 * 
 * Comprehensive hydraulic and hydrological calculations including:
 * - Open channel flow
 * - Pipe flow
 * - Hydraulic structures
 * - Flood routing
 * - Rainfall-runoff analysis
 * - Water distribution
 * 
 * @version 2.0.0
 */

// =============================================================================
// CONSTANTS
// =============================================================================

export const HYDRAULIC_CONSTANTS = {
  GRAVITY: 9.81,                    // m/s²
  WATER_DENSITY: 1000,              // kg/m³
  KINEMATIC_VISCOSITY_20C: 1.004e-6, // m²/s at 20°C
  ATMOSPHERIC_PRESSURE: 101325,     // Pa
  WATER_BULK_MODULUS: 2.15e9,      // Pa
};

export const MANNING_N: Record<string, number> = {
  'concrete_smooth': 0.012,
  'concrete_rough': 0.015,
  'earth_clean': 0.022,
  'earth_weedy': 0.030,
  'gravel': 0.025,
  'rock_cut': 0.035,
  'natural_stream_clean': 0.030,
  'natural_stream_weedy': 0.050,
  'floodplain_pasture': 0.035,
  'floodplain_cultivated': 0.040,
  'floodplain_brush': 0.070,
  'pvc_pipe': 0.009,
  'steel_pipe': 0.012,
  'cast_iron': 0.013,
  'corrugated_metal': 0.024,
};

export const HAZEN_WILLIAMS_C: Record<string, number> = {
  'pvc': 150,
  'polyethylene': 140,
  'copper': 130,
  'steel_new': 120,
  'steel_old': 100,
  'cast_iron_new': 130,
  'cast_iron_old': 100,
  'concrete': 120,
  'galvanized': 120,
};

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface ChannelSection {
  type: 'rectangular' | 'trapezoidal' | 'triangular' | 'circular' | 'parabolic';
  bottomWidth?: number;        // m (b)
  depth?: number;              // m (y)
  sideSlope?: number;          // horizontal:vertical (z)
  diameter?: number;           // m (for circular)
  topWidth?: number;           // m (T)
}

export interface PipeSection {
  diameter: number;            // m
  material: string;
  length: number;              // m
  elevation1: number;          // m
  elevation2: number;          // m
}

export interface CatchmentParams {
  area: number;                // km²
  slope: number;               // %
  imperviousPercent: number;   // %
  soilType: 'A' | 'B' | 'C' | 'D';
  landUse: string;
  timeOfConcentration?: number; // minutes
}

export interface RainfallData {
  intensity: number[];         // mm/hr
  duration: number[];          // minutes
  returnPeriod: number;        // years
}

// =============================================================================
// OPEN CHANNEL FLOW
// =============================================================================

export class OpenChannelFlow {
  /**
   * Calculate hydraulic radius
   */
  static hydraulicRadius(section: ChannelSection, depth: number): number {
    const A = this.flowArea(section, depth);
    const P = this.wettedPerimeter(section, depth);
    return A / P;
  }

  /**
   * Calculate flow area
   */
  static flowArea(section: ChannelSection, depth: number): number {
    switch (section.type) {
      case 'rectangular':
        return (section.bottomWidth || 0) * depth;
      
      case 'trapezoidal':
        const b = section.bottomWidth || 0;
        const z = section.sideSlope || 0;
        return (b + z * depth) * depth;
      
      case 'triangular':
        const zT = section.sideSlope || 1;
        return zT * depth * depth;
      
      case 'circular':
        const D = section.diameter || 0;
        const r = D / 2;
        if (depth >= D) return Math.PI * r * r;
        const theta = 2 * Math.acos((r - depth) / r);
        return (theta - Math.sin(theta)) * r * r / 2;
      
      case 'parabolic':
        const T = section.topWidth || 0;
        return (2 / 3) * T * depth;
      
      default:
        return 0;
    }
  }

  /**
   * Calculate wetted perimeter
   */
  static wettedPerimeter(section: ChannelSection, depth: number): number {
    switch (section.type) {
      case 'rectangular':
        return (section.bottomWidth || 0) + 2 * depth;
      
      case 'trapezoidal':
        const b = section.bottomWidth || 0;
        const z = section.sideSlope || 0;
        return b + 2 * depth * Math.sqrt(1 + z * z);
      
      case 'triangular':
        const zT = section.sideSlope || 1;
        return 2 * depth * Math.sqrt(1 + zT * zT);
      
      case 'circular':
        const D = section.diameter || 0;
        const r = D / 2;
        if (depth >= D) return Math.PI * D;
        const theta = 2 * Math.acos((r - depth) / r);
        return theta * r;
      
      case 'parabolic':
        const T = section.topWidth || 0;
        const x = 2 * depth / T;
        return T * (Math.sqrt(1 + x * x) + (1 / x) * Math.log(x + Math.sqrt(1 + x * x)));
      
      default:
        return 0;
    }
  }

  /**
   * Calculate top width
   */
  static topWidth(section: ChannelSection, depth: number): number {
    switch (section.type) {
      case 'rectangular':
        return section.bottomWidth || 0;
      
      case 'trapezoidal':
        return (section.bottomWidth || 0) + 2 * (section.sideSlope || 0) * depth;
      
      case 'triangular':
        return 2 * (section.sideSlope || 1) * depth;
      
      case 'circular':
        const D = section.diameter || 0;
        const r = D / 2;
        if (depth >= D) return 0;
        return 2 * Math.sqrt(r * r - Math.pow(r - depth, 2));
      
      case 'parabolic':
        return section.topWidth || 0;
      
      default:
        return 0;
    }
  }

  /**
   * Calculate velocity using Manning's equation
   */
  static manningVelocity(
    R: number,           // Hydraulic radius (m)
    S: number,           // Slope (m/m)
    n: number            // Manning's roughness coefficient
  ): number {
    return (1 / n) * Math.pow(R, 2/3) * Math.pow(S, 0.5);
  }

  /**
   * Calculate discharge using Manning's equation
   */
  static manningDischarge(
    section: ChannelSection,
    depth: number,
    slope: number,
    n: number
  ): number {
    const A = this.flowArea(section, depth);
    const R = this.hydraulicRadius(section, depth);
    const V = this.manningVelocity(R, slope, n);
    return A * V;
  }

  /**
   * Calculate normal depth (iterative)
   */
  static normalDepth(
    section: ChannelSection,
    discharge: number,
    slope: number,
    n: number,
    tolerance: number = 0.001
  ): number {
    let yLow = 0.001;
    let yHigh = 20;
    
    for (let i = 0; i < 100; i++) {
      const yMid = (yLow + yHigh) / 2;
      const Q = this.manningDischarge(section, yMid, slope, n);
      
      if (Math.abs(Q - discharge) < tolerance) {
        return yMid;
      }
      
      if (Q < discharge) {
        yLow = yMid;
      } else {
        yHigh = yMid;
      }
    }
    
    return (yLow + yHigh) / 2;
  }

  /**
   * Calculate critical depth
   */
  static criticalDepth(
    section: ChannelSection,
    discharge: number
  ): number {
    const g = HYDRAULIC_CONSTANTS.GRAVITY;
    
    // For rectangular channel - analytical solution
    if (section.type === 'rectangular') {
      const b = section.bottomWidth || 1;
      const q = discharge / b;
      return Math.pow(q * q / g, 1/3);
    }
    
    // Iterative solution for other sections
    let yLow = 0.001;
    let yHigh = 20;
    
    for (let i = 0; i < 100; i++) {
      const yMid = (yLow + yHigh) / 2;
      const A = this.flowArea(section, yMid);
      const T = this.topWidth(section, yMid);
      const Fr2 = (discharge * discharge * T) / (g * Math.pow(A, 3));
      
      if (Math.abs(Fr2 - 1) < 0.001) {
        return yMid;
      }
      
      if (Fr2 > 1) {
        yLow = yMid;
      } else {
        yHigh = yMid;
      }
    }
    
    return (yLow + yHigh) / 2;
  }

  /**
   * Calculate Froude number
   */
  static froudeNumber(
    section: ChannelSection,
    depth: number,
    discharge: number
  ): number {
    const A = this.flowArea(section, depth);
    const T = this.topWidth(section, depth);
    const V = discharge / A;
    const D = A / T; // Hydraulic depth
    
    return V / Math.sqrt(HYDRAULIC_CONSTANTS.GRAVITY * D);
  }

  /**
   * Classify flow regime
   */
  static classifyFlow(Fr: number): 'subcritical' | 'critical' | 'supercritical' {
    if (Fr < 0.95) return 'subcritical';
    if (Fr > 1.05) return 'supercritical';
    return 'critical';
  }

  /**
   * Calculate specific energy
   */
  static specificEnergy(
    section: ChannelSection,
    depth: number,
    discharge: number
  ): number {
    const A = this.flowArea(section, depth);
    const V = discharge / A;
    return depth + V * V / (2 * HYDRAULIC_CONSTANTS.GRAVITY);
  }

  /**
   * Calculate hydraulic jump parameters
   */
  static hydraulicJump(
    section: ChannelSection,
    y1: number,           // Pre-jump depth
    discharge: number
  ): { y2: number; energyLoss: number; jumpLength: number } {
    if (section.type !== 'rectangular') {
      throw new Error('Hydraulic jump calculation currently supports rectangular channels only');
    }
    
    const b = section.bottomWidth || 1;
    const q = discharge / b;
    const Fr1 = this.froudeNumber(section, y1, discharge);
    
    // Conjugate depth
    const y2 = (y1 / 2) * (Math.sqrt(1 + 8 * Fr1 * Fr1) - 1);
    
    // Energy loss
    const E1 = this.specificEnergy(section, y1, discharge);
    const E2 = this.specificEnergy(section, y2, discharge);
    const energyLoss = E1 - E2;
    
    // Jump length (USBR formula)
    const jumpLength = 6.1 * y2;
    
    return { y2, energyLoss, jumpLength };
  }

  /**
   * Calculate gradually varied flow profile (Standard Step Method)
   */
  static gvfProfile(
    section: ChannelSection,
    discharge: number,
    slope: number,
    n: number,
    startDepth: number,
    stepLength: number,
    numSteps: number
  ): { distance: number; depth: number; velocity: number; energy: number }[] {
    const profile: { distance: number; depth: number; velocity: number; energy: number }[] = [];
    const g = HYDRAULIC_CONSTANTS.GRAVITY;
    
    let y = startDepth;
    let x = 0;
    
    for (let i = 0; i <= numSteps; i++) {
      const A = this.flowArea(section, y);
      const V = discharge / A;
      const R = this.hydraulicRadius(section, y);
      const Sf = Math.pow(n * V / Math.pow(R, 2/3), 2);
      
      const E = this.specificEnergy(section, y, discharge);
      profile.push({ distance: x, depth: y, velocity: V, energy: E });
      
      // Calculate next depth
      const dydx = (slope - Sf) / (1 - Math.pow(this.froudeNumber(section, y, discharge), 2));
      y = y + dydx * stepLength;
      x = x + stepLength;
      
      if (y <= 0) break;
    }
    
    return profile;
  }
}

// =============================================================================
// PIPE FLOW
// =============================================================================

export class PipeFlow {
  /**
   * Calculate Reynolds number
   */
  static reynoldsNumber(
    velocity: number,      // m/s
    diameter: number,      // m
    viscosity: number = HYDRAULIC_CONSTANTS.KINEMATIC_VISCOSITY_20C
  ): number {
    return velocity * diameter / viscosity;
  }

  /**
   * Calculate friction factor (Colebrook-White)
   */
  static frictionFactorColebrook(
    Re: number,
    roughness: number,     // m
    diameter: number       // m
  ): number {
    if (Re < 2300) {
      // Laminar flow
      return 64 / Re;
    }
    
    const relativeRoughness = roughness / diameter;
    
    // Swamee-Jain explicit approximation
    const f = 0.25 / Math.pow(
      Math.log10(relativeRoughness / 3.7 + 5.74 / Math.pow(Re, 0.9)),
      2
    );
    
    return f;
  }

  /**
   * Calculate head loss using Darcy-Weisbach
   */
  static darcyWeisbach(
    f: number,             // Friction factor
    L: number,             // Length (m)
    D: number,             // Diameter (m)
    V: number              // Velocity (m/s)
  ): number {
    return f * (L / D) * (V * V) / (2 * HYDRAULIC_CONSTANTS.GRAVITY);
  }

  /**
   * Calculate flow using Hazen-Williams
   */
  static hazenWilliamsFlow(
    C: number,             // Hazen-Williams coefficient
    D: number,             // Diameter (m)
    S: number              // Slope (m/m)
  ): number {
    // Q = 0.2785 * C * D^2.63 * S^0.54
    return 0.2785 * C * Math.pow(D, 2.63) * Math.pow(S, 0.54);
  }

  /**
   * Calculate head loss using Hazen-Williams
   */
  static hazenWilliamsHeadLoss(
    Q: number,             // Flow (m³/s)
    C: number,             // Hazen-Williams coefficient
    D: number,             // Diameter (m)
    L: number              // Length (m)
  ): number {
    // hf = 10.67 * L * Q^1.852 / (C^1.852 * D^4.87)
    return 10.67 * L * Math.pow(Q, 1.852) / (Math.pow(C, 1.852) * Math.pow(D, 4.87));
  }

  /**
   * Calculate pipe diameter for given flow and head loss
   */
  static requiredDiameter(
    Q: number,             // Flow (m³/s)
    hf: number,            // Available head loss (m)
    L: number,             // Length (m)
    C: number              // Hazen-Williams coefficient
  ): number {
    // D = (10.67 * L * Q^1.852 / (C^1.852 * hf))^(1/4.87)
    return Math.pow(10.67 * L * Math.pow(Q, 1.852) / (Math.pow(C, 1.852) * hf), 1/4.87);
  }

  /**
   * Calculate minor head losses
   */
  static minorLosses(
    V: number,             // Velocity (m/s)
    K: number              // Loss coefficient
  ): number {
    return K * V * V / (2 * HYDRAULIC_CONSTANTS.GRAVITY);
  }

  /**
   * Common minor loss coefficients
   */
  static readonly MINOR_LOSS_K: Record<string, number> = {
    'entrance_sharp': 0.5,
    'entrance_rounded': 0.04,
    'entrance_reentrant': 0.8,
    'exit': 1.0,
    'elbow_90_regular': 0.3,
    'elbow_90_long_radius': 0.2,
    'elbow_45': 0.4,
    'tee_line': 0.2,
    'tee_branch': 1.0,
    'gate_valve_open': 0.2,
    'gate_valve_half': 5.6,
    'check_valve': 2.5,
    'globe_valve_open': 10,
    'butterfly_valve_open': 0.3,
  };

  /**
   * Calculate water hammer pressure
   */
  static waterHammer(
    velocity: number,      // m/s
    celerity?: number      // Wave speed (m/s), calculated if not provided
  ): number {
    const c = celerity || 1200; // Default for water in steel pipe
    const rho = HYDRAULIC_CONSTANTS.WATER_DENSITY;
    
    return rho * c * velocity / 1000; // kPa
  }

  /**
   * Calculate wave celerity in pipe
   */
  static waveCelerity(
    pipeModulus: number,   // Pipe material modulus (Pa)
    wallThickness: number, // m
    diameter: number       // m
  ): number {
    const K = HYDRAULIC_CONSTANTS.WATER_BULK_MODULUS;
    const rho = HYDRAULIC_CONSTANTS.WATER_DENSITY;
    const E = pipeModulus;
    const t = wallThickness;
    const D = diameter;
    
    return Math.sqrt(K / rho / (1 + K * D / (E * t)));
  }

  /**
   * Pipe network analysis - Hardy Cross method
   */
  static hardyCrossIteration(
    loops: {
      pipes: { id: string; length: number; diameter: number; C: number; flow: number }[];
    }[],
    tolerance: number = 0.001
  ): Map<string, number> {
    const flows = new Map<string, number>();
    
    // Initialize flows
    loops.forEach(loop => {
      loop.pipes.forEach(pipe => {
        flows.set(pipe.id, pipe.flow);
      });
    });
    
    // Iterate
    for (let iter = 0; iter < 100; iter++) {
      let maxCorrection = 0;
      
      loops.forEach(loop => {
        let sumHeadLoss = 0;
        let sumDerivative = 0;
        
        loop.pipes.forEach(pipe => {
          const Q = flows.get(pipe.id) || 0;
          const sign = Q >= 0 ? 1 : -1;
          const hf = sign * this.hazenWilliamsHeadLoss(
            Math.abs(Q),
            pipe.C,
            pipe.diameter,
            pipe.length
          );
          
          sumHeadLoss += hf;
          sumDerivative += Math.abs(hf / Q) * 1.852;
        });
        
        const correction = -sumHeadLoss / sumDerivative;
        maxCorrection = Math.max(maxCorrection, Math.abs(correction));
        
        loop.pipes.forEach(pipe => {
          flows.set(pipe.id, (flows.get(pipe.id) || 0) + correction);
        });
      });
      
      if (maxCorrection < tolerance) break;
    }
    
    return flows;
  }
}

// =============================================================================
// HYDROLOGY
// =============================================================================

export class Hydrology {
  /**
   * Calculate runoff coefficient
   */
  static runoffCoefficient(
    landUse: string,
    slope: number
  ): number {
    const baseCoefficients: Record<string, number> = {
      'pavement': 0.90,
      'roof': 0.85,
      'commercial': 0.70,
      'industrial': 0.65,
      'residential_high': 0.50,
      'residential_medium': 0.40,
      'residential_low': 0.30,
      'park': 0.20,
      'forest': 0.15,
      'agriculture': 0.25,
    };
    
    let C = baseCoefficients[landUse] || 0.50;
    
    // Adjust for slope
    if (slope > 7) C += 0.10;
    else if (slope > 3) C += 0.05;
    
    return Math.min(1, C);
  }

  /**
   * Calculate time of concentration (Kirpich formula)
   */
  static timeOfConcentrationKirpich(
    length: number,        // Flow path length (m)
    slope: number          // Average slope (m/m)
  ): number {
    // tc in minutes
    return 0.0195 * Math.pow(length, 0.77) * Math.pow(slope, -0.385);
  }

  /**
   * Calculate time of concentration (SCS method)
   */
  static timeOfConcentrationSCS(
    length: number,        // Flow path length (m)
    CN: number,            // Curve number
    slope: number          // Average slope (%)
  ): number {
    const S = (1000 / CN - 10) * 25.4; // Potential maximum retention (mm)
    // tc in hours
    return Math.pow(length / 1000, 0.8) * Math.pow(S + 25.4, 0.7) / (4407 * Math.pow(slope, 0.5));
  }

  /**
   * Calculate SCS Curve Number
   */
  static curveNumber(
    soilGroup: 'A' | 'B' | 'C' | 'D',
    landUse: string,
    condition: 'poor' | 'fair' | 'good' = 'fair'
  ): number {
    const cnTable: Record<string, Record<string, Record<string, number>>> = {
      'residential_0.5acre': {
        A: { poor: 54, fair: 51, good: 46 },
        B: { poor: 70, fair: 68, good: 65 },
        C: { poor: 80, fair: 79, good: 77 },
        D: { poor: 85, fair: 84, good: 82 },
      },
      'commercial': {
        A: { poor: 89, fair: 89, good: 89 },
        B: { poor: 92, fair: 92, good: 92 },
        C: { poor: 94, fair: 94, good: 94 },
        D: { poor: 95, fair: 95, good: 95 },
      },
      'industrial': {
        A: { poor: 81, fair: 81, good: 81 },
        B: { poor: 88, fair: 88, good: 88 },
        C: { poor: 91, fair: 91, good: 91 },
        D: { poor: 93, fair: 93, good: 93 },
      },
      'forest': {
        A: { poor: 45, fair: 36, good: 30 },
        B: { poor: 66, fair: 60, good: 55 },
        C: { poor: 77, fair: 73, good: 70 },
        D: { poor: 83, fair: 79, good: 77 },
      },
      'agriculture': {
        A: { poor: 72, fair: 67, good: 62 },
        B: { poor: 81, fair: 78, good: 74 },
        C: { poor: 88, fair: 85, good: 82 },
        D: { poor: 91, fair: 89, good: 87 },
      },
    };
    
    return cnTable[landUse]?.[soilGroup]?.[condition] || 80;
  }

  /**
   * Calculate peak discharge (Rational Method)
   */
  static rationalMethod(
    C: number,             // Runoff coefficient
    i: number,             // Rainfall intensity (mm/hr)
    A: number              // Catchment area (hectares)
  ): number {
    // Q in m³/s
    return C * i * A / 360;
  }

  /**
   * Calculate peak discharge (SCS method)
   */
  static scsMethod(
    rainfall: number,      // Total rainfall (mm)
    CN: number,            // Curve number
    A: number,             // Area (km²)
    tc: number             // Time of concentration (hours)
  ): number {
    const S = (1000 / CN - 10) * 25.4; // mm
    const Ia = 0.2 * S;    // Initial abstraction
    
    if (rainfall <= Ia) return 0;
    
    const Q = Math.pow(rainfall - Ia, 2) / (rainfall - Ia + S); // Runoff depth (mm)
    
    // Peak discharge using SCS triangular hydrograph
    const tp = 0.5 * tc + 0.6 * tc; // Time to peak
    const qp = 0.208 * A * Q / tp;  // m³/s
    
    return qp;
  }

  /**
   * Generate SCS unit hydrograph
   */
  static scsUnitHydrograph(
    A: number,             // Area (km²)
    tc: number,            // Time of concentration (hours)
    deltaT: number = 0.1   // Time interval (hours)
  ): { time: number; discharge: number }[] {
    const tp = 0.6 * tc;   // Time to peak
    const qp = 0.208 * A / tp; // Peak discharge per mm of runoff
    
    const hydrograph: { time: number; discharge: number }[] = [];
    
    // Rising limb (t/tp <= 1)
    for (let t = 0; t <= tp; t += deltaT) {
      const q = qp * Math.pow(t / tp, 1.5);
      hydrograph.push({ time: t, discharge: q });
    }
    
    // Falling limb (t/tp > 1)
    for (let t = tp + deltaT; t <= 5 * tp; t += deltaT) {
      const q = qp * Math.exp(-2.3 * (t / tp - 1));
      hydrograph.push({ time: t, discharge: q });
      if (q < 0.01 * qp) break;
    }
    
    return hydrograph;
  }

  /**
   * Calculate IDF curve parameters (Talbot formula)
   */
  static idfTalbot(
    a: number,             // Regional parameter
    b: number,             // Regional parameter
    duration: number       // minutes
  ): number {
    return a / (duration + b);
  }

  /**
   * Calculate IDF curve parameters (Sherman formula)
   */
  static idfSherman(
    K: number,             // Regional parameter
    n: number,             // Regional parameter
    duration: number       // minutes
  ): number {
    return K / Math.pow(duration, n);
  }
}

// =============================================================================
// HYDRAULIC STRUCTURES
// =============================================================================

export class HydraulicStructures {
  /**
   * Calculate weir discharge (rectangular sharp-crested)
   */
  static rectangularWeirDischarge(
    Cd: number,            // Discharge coefficient (typically 0.6-0.65)
    L: number,             // Weir length (m)
    H: number              // Head over weir (m)
  ): number {
    const g = HYDRAULIC_CONSTANTS.GRAVITY;
    return (2/3) * Cd * L * Math.sqrt(2 * g) * Math.pow(H, 1.5);
  }

  /**
   * Calculate weir discharge (V-notch)
   */
  static vNotchWeirDischarge(
    Cd: number,            // Discharge coefficient
    theta: number,         // Notch angle (degrees)
    H: number              // Head over weir (m)
  ): number {
    const g = HYDRAULIC_CONSTANTS.GRAVITY;
    const theta_rad = theta * Math.PI / 180;
    return (8/15) * Cd * Math.tan(theta_rad / 2) * Math.sqrt(2 * g) * Math.pow(H, 2.5);
  }

  /**
   * Calculate broad-crested weir discharge
   */
  static broadCrestedWeirDischarge(
    Cd: number,            // Discharge coefficient (typically 0.85-0.95)
    L: number,             // Weir length (m)
    H: number              // Head over weir (m)
  ): number {
    const g = HYDRAULIC_CONSTANTS.GRAVITY;
    return Cd * L * Math.sqrt(g) * Math.pow(H, 1.5);
  }

  /**
   * Calculate orifice discharge
   */
  static orificeDischarge(
    Cd: number,            // Discharge coefficient (typically 0.6-0.65)
    A: number,             // Orifice area (m²)
    h: number              // Head above center (m)
  ): number {
    const g = HYDRAULIC_CONSTANTS.GRAVITY;
    return Cd * A * Math.sqrt(2 * g * h);
  }

  /**
   * Calculate spillway discharge (ogee)
   */
  static ogeeSpillwayDischarge(
    C: number,             // Discharge coefficient (typically 2.0-2.2)
    L: number,             // Spillway length (m)
    H: number,             // Head over spillway (m)
    Hd: number             // Design head (m)
  ): number {
    // Account for head ratio
    const Ceff = C * Math.pow(H / Hd, 0.12);
    return Ceff * L * Math.pow(H, 1.5);
  }

  /**
   * Calculate culvert capacity
   */
  static culvertCapacity(
    type: 'inlet' | 'outlet' | 'full',
    D: number,             // Diameter (m)
    HW: number,            // Headwater depth (m)
    TW: number,            // Tailwater depth (m)
    L: number,             // Culvert length (m)
    Ke: number = 0.5,      // Entrance loss coefficient
    n: number = 0.012      // Manning's n
  ): number {
    const g = HYDRAULIC_CONSTANTS.GRAVITY;
    const A = Math.PI * D * D / 4;
    
    if (type === 'inlet') {
      // Inlet control
      const Cd = 0.6;
      return Cd * A * Math.sqrt(2 * g * HW);
    } else if (type === 'outlet') {
      // Outlet control (submerged)
      const R = D / 4;
      const Sf = Math.pow(n / Math.pow(R, 2/3), 2);
      const H = HW - TW;
      const hf = Sf * L;
      const V = Math.sqrt(2 * g * (H - hf) / (1 + Ke));
      return A * V;
    } else {
      // Full flow
      const R = D / 4;
      return (1 / n) * A * Math.pow(R, 2/3) * Math.pow((HW - TW) / L, 0.5);
    }
  }

  /**
   * Calculate stilling basin length (USBR Type II)
   */
  static stillingBasinLength(
    Fr1: number,           // Froude number before jump
    y1: number             // Pre-jump depth (m)
  ): number {
    if (Fr1 < 4.5) {
      return 4.5 * y1 * (Fr1 - 1);
    }
    return 6.1 * y1 * Math.sqrt(Fr1);
  }
}

// =============================================================================
// FLOOD ROUTING
// =============================================================================

export class FloodRouting {
  /**
   * Muskingum flood routing
   */
  static muskingum(
    inflow: number[],      // Inflow hydrograph (m³/s)
    K: number,             // Storage constant (hours)
    x: number,             // Weighting factor (0-0.5)
    deltaT: number         // Time step (hours)
  ): number[] {
    const C0 = (deltaT - 2 * K * x) / (2 * K * (1 - x) + deltaT);
    const C1 = (deltaT + 2 * K * x) / (2 * K * (1 - x) + deltaT);
    const C2 = (2 * K * (1 - x) - deltaT) / (2 * K * (1 - x) + deltaT);
    
    const outflow: number[] = [inflow[0]];
    
    for (let i = 1; i < inflow.length; i++) {
      const Q = C0 * inflow[i] + C1 * inflow[i - 1] + C2 * outflow[i - 1];
      outflow.push(Q);
    }
    
    return outflow;
  }

  /**
   * Level pool routing
   */
  static levelPool(
    inflow: number[],      // Inflow hydrograph (m³/s)
    storageElevation: { elevation: number; storage: number }[],
    dischargeElevation: { elevation: number; discharge: number }[],
    deltaT: number,        // Time step (seconds)
    initialElevation: number
  ): { elevation: number; outflow: number }[] {
    const results: { elevation: number; outflow: number }[] = [];
    let elevation = initialElevation;
    
    // Interpolation helpers
    const getStorage = (h: number) => {
      for (let i = 1; i < storageElevation.length; i++) {
        if (h <= storageElevation[i].elevation) {
          const ratio = (h - storageElevation[i-1].elevation) / 
                       (storageElevation[i].elevation - storageElevation[i-1].elevation);
          return storageElevation[i-1].storage + 
                 ratio * (storageElevation[i].storage - storageElevation[i-1].storage);
        }
      }
      return storageElevation[storageElevation.length - 1].storage;
    };
    
    const getDischarge = (h: number) => {
      for (let i = 1; i < dischargeElevation.length; i++) {
        if (h <= dischargeElevation[i].elevation) {
          const ratio = (h - dischargeElevation[i-1].elevation) / 
                       (dischargeElevation[i].elevation - dischargeElevation[i-1].elevation);
          return dischargeElevation[i-1].discharge + 
                 ratio * (dischargeElevation[i].discharge - dischargeElevation[i-1].discharge);
        }
      }
      return dischargeElevation[dischargeElevation.length - 1].discharge;
    };
    
    for (let i = 0; i < inflow.length; i++) {
      const I = i > 0 ? (inflow[i] + inflow[i-1]) / 2 : inflow[0];
      const O = getDischarge(elevation);
      const S = getStorage(elevation);
      
      // S(t+dt) = S(t) + (I - O) * dt
      const newStorage = S + (I - O) * deltaT;
      
      // Find new elevation from storage
      for (let j = 1; j < storageElevation.length; j++) {
        if (newStorage <= storageElevation[j].storage) {
          const ratio = (newStorage - storageElevation[j-1].storage) / 
                       (storageElevation[j].storage - storageElevation[j-1].storage);
          elevation = storageElevation[j-1].elevation + 
                     ratio * (storageElevation[j].elevation - storageElevation[j-1].elevation);
          break;
        }
      }
      
      results.push({ elevation, outflow: getDischarge(elevation) });
    }
    
    return results;
  }
}

// =============================================================================
// WATER DISTRIBUTION
// =============================================================================

export class WaterDistribution {
  /**
   * Calculate population projection
   */
  static populationProjection(
    P0: number,            // Current population
    r: number,             // Growth rate (decimal)
    t: number,             // Years
    method: 'arithmetic' | 'geometric' | 'logistic'
  ): number {
    switch (method) {
      case 'arithmetic':
        return P0 + P0 * r * t;
      case 'geometric':
        return P0 * Math.pow(1 + r, t);
      case 'logistic':
        const Ps = P0 * 2; // Saturation population (assumed)
        return Ps / (1 + ((Ps - P0) / P0) * Math.exp(-r * t));
      default:
        return P0;
    }
  }

  /**
   * Calculate water demand
   */
  static waterDemand(
    population: number,
    perCapitaDemand: number,  // liters per capita per day
    multipliers: {
      maxDay?: number;        // Max day factor (typically 1.5-2.0)
      maxHour?: number;       // Max hour factor (typically 2.0-3.0)
      fireFlow?: number;      // Fire flow requirement (L/s)
    }
  ): {
    avgDay: number;          // L/day
    maxDay: number;          // L/day
    maxHour: number;         // L/day
    peakHourWithFire: number; // L/s
  } {
    const avgDay = population * perCapitaDemand;
    const maxDay = avgDay * (multipliers.maxDay || 1.5);
    const maxHour = avgDay * (multipliers.maxHour || 2.5);
    const peakHourWithFire = maxHour / 86400 + (multipliers.fireFlow || 0);
    
    return { avgDay, maxDay, maxHour, peakHourWithFire };
  }

  /**
   * Calculate storage requirements
   */
  static storageRequirements(
    avgDayDemand: number,  // L/day
    equalizing: number = 0.25,  // Fraction for equalizing storage
    fireReserve: number = 0.1,  // Fraction for fire reserve
    emergency: number = 0.15    // Fraction for emergency
  ): {
    equalizingStorage: number;
    fireStorage: number;
    emergencyStorage: number;
    totalStorage: number;
  } {
    return {
      equalizingStorage: avgDayDemand * equalizing,
      fireStorage: avgDayDemand * fireReserve,
      emergencyStorage: avgDayDemand * emergency,
      totalStorage: avgDayDemand * (equalizing + fireReserve + emergency),
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  OpenChannelFlow,
  PipeFlow,
  Hydrology,
  HydraulicStructures,
  FloodRouting,
  WaterDistribution,
  HYDRAULIC_CONSTANTS,
  MANNING_N,
  HAZEN_WILLIAMS_C,
};
