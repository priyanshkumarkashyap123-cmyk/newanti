/**
 * ============================================================================
 * CABLE DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive cable structure design including:
 * - Cable materials and properties
 * - Catenary cable analysis
 * - Parabolic cable analysis
 * - Cable sag calculations
 * - Stay cable design
 * - Cable vibration and aerodynamics
 * - Pre-tensioning calculations
 * 
 * Applications:
 * - Suspension bridges
 * - Cable-stayed bridges
 * - Roof cable structures
 * - Transmission lines
 * - Guy wires and anchors
 * 
 * @version 1.0.0
 * @author Head of Engineering
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type CableType = 
  | 'spiral-strand'
  | 'locked-coil'
  | 'parallel-wire'
  | 'parallel-strand'
  | 'wire-rope'
  | 'PPWS'  // Prefabricated Parallel Wire Strand
  | 'stay-cable';

export type CableProfile = 'catenary' | 'parabolic';

export type LoadType = 
  | 'self-weight'
  | 'uniformly-distributed'
  | 'concentrated'
  | 'temperature'
  | 'wind';

// =============================================================================
// CABLE MATERIAL PROPERTIES
// =============================================================================

export interface CableMaterial {
  name: string;
  type: CableType;
  fpu: number;                // Ultimate tensile strength (MPa)
  fpy: number;                // 0.2% proof stress (MPa)
  E: number;                  // Modulus of elasticity (MPa)
  alpha: number;              // Thermal expansion coefficient (per °C)
  density: number;            // Density (kg/m³)
  fillFactor: number;         // Fill factor for strand bundles
  fatigueCategory: number;    // Fatigue detail category (MPa)
}

export const CABLE_MATERIALS: Record<string, CableMaterial> = {
  // Spiral strand cables
  'spiral-strand-1570': {
    name: 'Spiral Strand Grade 1570',
    type: 'spiral-strand',
    fpu: 1570,
    fpy: 1375,
    E: 160000,
    alpha: 12e-6,
    density: 7850,
    fillFactor: 0.78,
    fatigueCategory: 150,
  },
  'spiral-strand-1770': {
    name: 'Spiral Strand Grade 1770',
    type: 'spiral-strand',
    fpu: 1770,
    fpy: 1550,
    E: 160000,
    alpha: 12e-6,
    density: 7850,
    fillFactor: 0.78,
    fatigueCategory: 150,
  },
  
  // Locked coil cables
  'locked-coil-1570': {
    name: 'Locked Coil Grade 1570',
    type: 'locked-coil',
    fpu: 1570,
    fpy: 1375,
    E: 165000,
    alpha: 12e-6,
    density: 8100,
    fillFactor: 0.88,
    fatigueCategory: 112,
  },
  'locked-coil-1770': {
    name: 'Locked Coil Grade 1770',
    type: 'locked-coil',
    fpu: 1770,
    fpy: 1550,
    E: 165000,
    alpha: 12e-6,
    density: 8100,
    fillFactor: 0.88,
    fatigueCategory: 112,
  },
  
  // Parallel wire strand (PWS)
  'PWS-1670': {
    name: 'Parallel Wire Strand Grade 1670',
    type: 'parallel-wire',
    fpu: 1670,
    fpy: 1500,
    E: 200000,
    alpha: 12e-6,
    density: 7850,
    fillFactor: 0.85,
    fatigueCategory: 185,
  },
  'PWS-1770': {
    name: 'Parallel Wire Strand Grade 1770',
    type: 'parallel-wire',
    fpu: 1770,
    fpy: 1590,
    E: 200000,
    alpha: 12e-6,
    density: 7850,
    fillFactor: 0.85,
    fatigueCategory: 185,
  },
  
  // Parallel strand (7-wire strands)
  'strand-1860': {
    name: '7-Wire Strand Grade 1860',
    type: 'parallel-strand',
    fpu: 1860,
    fpy: 1670,
    E: 195000,
    alpha: 12e-6,
    density: 7850,
    fillFactor: 0.91,
    fatigueCategory: 160,
  },
  'strand-1960': {
    name: '7-Wire Strand Grade 1960',
    type: 'parallel-strand',
    fpu: 1960,
    fpy: 1765,
    E: 195000,
    alpha: 12e-6,
    density: 7850,
    fillFactor: 0.91,
    fatigueCategory: 160,
  },
  
  // Wire rope
  'wire-rope-1570': {
    name: 'Wire Rope 6x36',
    type: 'wire-rope',
    fpu: 1570,
    fpy: 1257,
    E: 110000,
    alpha: 12e-6,
    density: 7600,
    fillFactor: 0.56,
    fatigueCategory: 71,
  },
  'wire-rope-1770': {
    name: 'Wire Rope 6x36 High Strength',
    type: 'wire-rope',
    fpu: 1770,
    fpy: 1416,
    E: 110000,
    alpha: 12e-6,
    density: 7600,
    fillFactor: 0.56,
    fatigueCategory: 71,
  },
  
  // Stay cables
  'stay-cable-1670': {
    name: 'Stay Cable System Grade 1670',
    type: 'stay-cable',
    fpu: 1670,
    fpy: 1500,
    E: 195000,
    alpha: 12e-6,
    density: 7850,
    fillFactor: 0.75,
    fatigueCategory: 185,
  },
  'stay-cable-1860': {
    name: 'Stay Cable System Grade 1860',
    type: 'stay-cable',
    fpu: 1860,
    fpy: 1670,
    E: 195000,
    alpha: 12e-6,
    density: 7850,
    fillFactor: 0.75,
    fatigueCategory: 185,
  },
};

// =============================================================================
// STANDARD CABLE SIZES
// =============================================================================

export interface CableSize {
  nominalDiameter: number;    // mm
  metalArea: number;          // mm²
  breakingLoad: number;       // kN (for 1770 MPa)
  weight: number;             // kg/m
}

export const SPIRAL_STRAND_SIZES: CableSize[] = [
  { nominalDiameter: 20, metalArea: 222, breakingLoad: 393, weight: 1.85 },
  { nominalDiameter: 26, metalArea: 389, breakingLoad: 689, weight: 3.24 },
  { nominalDiameter: 32, metalArea: 612, breakingLoad: 1083, weight: 5.10 },
  { nominalDiameter: 40, metalArea: 925, breakingLoad: 1637, weight: 7.71 },
  { nominalDiameter: 50, metalArea: 1485, breakingLoad: 2628, weight: 12.4 },
  { nominalDiameter: 60, metalArea: 2095, breakingLoad: 3708, weight: 17.5 },
  { nominalDiameter: 70, metalArea: 2907, breakingLoad: 5145, weight: 24.2 },
  { nominalDiameter: 80, metalArea: 3800, breakingLoad: 6726, weight: 31.7 },
  { nominalDiameter: 90, metalArea: 4850, breakingLoad: 8585, weight: 40.4 },
  { nominalDiameter: 100, metalArea: 5980, breakingLoad: 10585, weight: 49.8 },
  { nominalDiameter: 110, metalArea: 7240, breakingLoad: 12815, weight: 60.3 },
  { nominalDiameter: 120, metalArea: 8580, breakingLoad: 15187, weight: 71.5 },
  { nominalDiameter: 130, metalArea: 10075, breakingLoad: 17833, weight: 83.9 },
  { nominalDiameter: 140, metalArea: 11645, breakingLoad: 20612, weight: 97.0 },
  { nominalDiameter: 150, metalArea: 13310, breakingLoad: 23559, weight: 110.9 },
  { nominalDiameter: 160, metalArea: 15120, breakingLoad: 26762, weight: 126.0 },
];

export const LOCKED_COIL_SIZES: CableSize[] = [
  { nominalDiameter: 30, metalArea: 621, breakingLoad: 1099, weight: 5.43 },
  { nominalDiameter: 40, metalArea: 1105, breakingLoad: 1956, weight: 9.66 },
  { nominalDiameter: 50, metalArea: 1725, breakingLoad: 3053, weight: 15.1 },
  { nominalDiameter: 60, metalArea: 2482, breakingLoad: 4393, weight: 21.7 },
  { nominalDiameter: 70, metalArea: 3383, breakingLoad: 5988, weight: 29.6 },
  { nominalDiameter: 80, metalArea: 4421, breakingLoad: 7825, weight: 38.7 },
  { nominalDiameter: 90, metalArea: 5593, breakingLoad: 9900, weight: 48.9 },
  { nominalDiameter: 100, metalArea: 6903, breakingLoad: 12218, weight: 60.4 },
  { nominalDiameter: 110, metalArea: 8352, breakingLoad: 14783, weight: 73.1 },
  { nominalDiameter: 120, metalArea: 9944, breakingLoad: 17601, weight: 87.0 },
  { nominalDiameter: 130, metalArea: 11680, breakingLoad: 20673, weight: 102.2 },
  { nominalDiameter: 140, metalArea: 13534, breakingLoad: 23955, weight: 118.4 },
  { nominalDiameter: 150, metalArea: 15508, breakingLoad: 27449, weight: 135.6 },
];

export const STAY_CABLE_STRAND_SIZES: CableSize[] = [
  // 15.7mm (0.6") strands
  { nominalDiameter: 15.7, metalArea: 150, breakingLoad: 279, weight: 1.18 },
  // Common bundle sizes
  { nominalDiameter: 80, metalArea: 4050, breakingLoad: 7533, weight: 31.8 },
  { nominalDiameter: 100, metalArea: 6300, breakingLoad: 11718, weight: 49.5 },
  { nominalDiameter: 120, metalArea: 9000, breakingLoad: 16740, weight: 70.7 },
  { nominalDiameter: 140, metalArea: 12300, breakingLoad: 22878, weight: 96.6 },
  { nominalDiameter: 160, metalArea: 16200, breakingLoad: 30132, weight: 127.2 },
  { nominalDiameter: 180, metalArea: 20250, breakingLoad: 37665, weight: 159.0 },
  { nominalDiameter: 200, metalArea: 24900, breakingLoad: 46314, weight: 195.5 },
];

// =============================================================================
// CABLE GEOMETRY INTERFACES
// =============================================================================

export interface CableSupport {
  x: number;                  // Horizontal position (m)
  y: number;                  // Vertical position (m)
  type: 'fixed' | 'pinned' | 'roller';
}

export interface CableGeometry {
  leftSupport: CableSupport;
  rightSupport: CableSupport;
  span: number;               // Horizontal span (m)
  sagRatio?: number;          // Sag/span ratio
  sag?: number;               // Maximum sag (m)
  cableLength?: number;       // Total cable length (m)
}

export interface CableLoading {
  selfWeight: number;         // kN/m (including cable + coatings)
  uniformLoad?: number;       // Additional uniform load (kN/m)
  concentratedLoads?: {
    position: number;         // Distance from left support (m)
    force: number;            // Force (kN)
  }[];
  temperature?: number;       // Temperature change (°C)
  windPressure?: number;      // Wind pressure (kPa)
}

// =============================================================================
// CABLE ANALYSIS RESULTS
// =============================================================================

export interface CatenaryCableResult {
  // Geometry
  span: number;               // m
  heightDifference: number;   // m
  sag: number;                // Maximum sag (m)
  sagRatio: number;           // Sag/span
  cableLength: number;        // Total cable length (m)
  
  // Catenary parameters
  catenaryParameter: number;  // c = H/w (m)
  
  // Forces
  horizontalTension: number;  // H (kN)
  maxTension: number;         // Tmax at supports (kN)
  minTension: number;         // Tmin at lowest point (kN)
  leftReaction: {
    horizontal: number;
    vertical: number;
    resultant: number;
    angle: number;            // degrees
  };
  rightReaction: {
    horizontal: number;
    vertical: number;
    resultant: number;
    angle: number;
  };
  
  // Cable profile
  lowestPointX: number;       // Position of lowest point from left (m)
  lowestPointY: number;       // Y-coordinate of lowest point (m)
  
  // Profile coordinates
  profile: { x: number; y: number; tension: number }[];
}

export interface ParabolicCableResult {
  // Geometry
  span: number;
  heightDifference: number;
  sag: number;
  sagRatio: number;
  cableLength: number;
  
  // Forces
  horizontalTension: number;
  maxTension: number;
  minTension: number;
  leftReaction: {
    horizontal: number;
    vertical: number;
    resultant: number;
    angle: number;
  };
  rightReaction: {
    horizontal: number;
    vertical: number;
    resultant: number;
    angle: number;
  };
  
  // Parabola parameters
  lowestPointX: number;
  lowestPointY: number;
  
  // Profile
  profile: { x: number; y: number; tension: number }[];
}

export interface CableDesignResult {
  // Input summary
  material: CableMaterial;
  metalArea: number;          // mm²
  nominalDiameter: number;    // mm
  
  // Analysis results
  catenaryAnalysis?: CatenaryCableResult;
  parabolicAnalysis?: ParabolicCableResult;
  
  // Capacity check
  ultimateCapacity: number;   // kN
  serviceCapacity: number;    // kN (with safety factor)
  maxTension: number;         // kN (demand)
  utilizationRatio: number;
  status: 'pass' | 'fail';
  
  // Stiffness
  axialStiffness: number;     // kN/m
  effectiveModulus: number;   // MPa (Ernst formula for sag effect)
  
  // Elongation
  elasticElongation: number;  // mm
  thermalElongation: number;  // mm
  totalElongation: number;    // mm
  
  // Vibration
  fundamentalFrequency: number;  // Hz
  vibrationCheck: 'ok' | 'warning' | 'critical';
  
  // Fatigue
  fatigueStressRange: number;    // MPa
  fatigueCapacity: number;       // MPa
  fatigueCheck: 'pass' | 'fail';
  
  // Weight
  cableWeight: number;        // kg/m
  totalCableWeight: number;   // kg
  
  // Recommendations
  warnings: string[];
  recommendations: string[];
}

// =============================================================================
// CABLE DESIGN ENGINE CLASS
// =============================================================================

export class CableDesignEngine {
  private geometry: CableGeometry;
  private loading: CableLoading;
  private material: CableMaterial;
  private area: number;
  private diameter: number;

  constructor(
    geometry: CableGeometry,
    loading: CableLoading,
    materialKey: string,
    metalArea: number
  ) {
    this.geometry = { ...geometry };
    this.loading = { ...loading };
    this.material = CABLE_MATERIALS[materialKey] || CABLE_MATERIALS['spiral-strand-1770'];
    this.area = metalArea;
    this.diameter = this.estimateDiameter(metalArea);
  }

  private estimateDiameter(area: number): number {
    // Estimate diameter from metal area using fill factor
    const totalArea = area / this.material.fillFactor;
    return Math.sqrt(4 * totalArea / Math.PI);
  }

  // ===========================================================================
  // CATENARY CABLE ANALYSIS
  // ===========================================================================

  public analyzeCatenary(): CatenaryCableResult {
    const { leftSupport, rightSupport, span } = this.geometry;
    const w = this.loading.selfWeight + (this.loading.uniformLoad || 0);
    const h = rightSupport.y - leftSupport.y;  // Height difference
    
    // Determine sag
    let targetSag: number;
    if (this.geometry.sag) {
      targetSag = this.geometry.sag;
    } else if (this.geometry.sagRatio) {
      targetSag = span * this.geometry.sagRatio;
    } else {
      targetSag = span / 10;  // Default 10% sag
    }
    
    // Solve for catenary parameter c = H/w
    // Using iterative solution
    const c = this.solveCatenaryParameter(span, h, targetSag, w);
    
    // Horizontal tension
    const H = c * w;
    
    // Position of lowest point
    let x0: number;  // Distance from left support to lowest point
    if (Math.abs(h) < 0.001) {
      // Level supports
      x0 = span / 2;
    } else {
      // Inclined cable
      x0 = span / 2 - (h / 2) * c / this.calculateSinhInverse(span / (2 * c));
    }
    
    // Calculate reactions
    const sinh_left = Math.sinh(x0 / c);
    const sinh_right = Math.sinh((span - x0) / c);
    const cosh_left = Math.cosh(x0 / c);
    const cosh_right = Math.cosh((span - x0) / c);
    
    const Vl = w * c * sinh_left;   // Left vertical reaction
    const Vr = w * c * sinh_right;  // Right vertical reaction
    
    // Tensions
    const Tl = H * cosh_left;  // Tension at left support
    const Tr = H * cosh_right; // Tension at right support
    const Tmax = Math.max(Tl, Tr);
    const Tmin = H;  // At lowest point
    
    // Cable length
    const L = c * (sinh_left + sinh_right);
    
    // Actual sag
    const y0 = leftSupport.y - c * (cosh_left - 1);
    const actualSag = leftSupport.y - y0;
    
    // Lowest point coordinates
    const lowestPointY = y0;
    
    // Generate profile
    const profile: { x: number; y: number; tension: number }[] = [];
    const numPoints = 51;
    for (let i = 0; i <= numPoints - 1; i++) {
      const x = (i / (numPoints - 1)) * span;
      let y: number;
      let T: number;
      if (x <= x0) {
        const cosh_val = Math.cosh((x0 - x) / c);
        y = y0 + c * (cosh_val - 1);
        T = H * cosh_val;
      } else {
        const cosh_val = Math.cosh((x - x0) / c);
        y = y0 + c * (cosh_val - 1);
        T = H * cosh_val;
      }
      profile.push({ x, y, tension: T });
    }
    
    return {
      span,
      heightDifference: h,
      sag: actualSag,
      sagRatio: actualSag / span,
      cableLength: L,
      catenaryParameter: c,
      horizontalTension: H,
      maxTension: Tmax,
      minTension: Tmin,
      leftReaction: {
        horizontal: H,
        vertical: Vl,
        resultant: Tl,
        angle: Math.atan(Vl / H) * 180 / Math.PI,
      },
      rightReaction: {
        horizontal: H,
        vertical: Vr,
        resultant: Tr,
        angle: Math.atan(Vr / H) * 180 / Math.PI,
      },
      lowestPointX: x0,
      lowestPointY,
      profile,
    };
  }

  private solveCatenaryParameter(L: number, h: number, d: number, w: number): number {
    // Newton-Raphson iteration to find c
    let c = L * L / (8 * d);  // Initial guess from parabola
    
    for (let iter = 0; iter < 50; iter++) {
      const sinh_half = Math.sinh(L / (2 * c));
      const cosh_half = Math.cosh(L / (2 * c));
      
      // For level supports: sag = c * (cosh(L/2c) - 1)
      const f = c * (cosh_half - 1) - d;
      const df = cosh_half - 1 - (L / (2 * c)) * sinh_half;
      
      if (Math.abs(df) < 1e-10) break;
      
      const c_new = c - f / df;
      if (Math.abs(c_new - c) < 1e-6) break;
      c = c_new;
    }
    
    return c;
  }

  private calculateSinhInverse(x: number): number {
    return Math.log(x + Math.sqrt(x * x + 1));
  }

  // ===========================================================================
  // PARABOLIC CABLE ANALYSIS
  // ===========================================================================

  public analyzeParabolic(): ParabolicCableResult {
    const { leftSupport, rightSupport, span } = this.geometry;
    const w = this.loading.selfWeight + (this.loading.uniformLoad || 0);
    const h = rightSupport.y - leftSupport.y;
    
    // Determine sag
    let sag: number;
    if (this.geometry.sag) {
      sag = this.geometry.sag;
    } else if (this.geometry.sagRatio) {
      sag = span * this.geometry.sagRatio;
    } else {
      sag = span / 10;
    }
    
    // Horizontal tension (from parabolic formula)
    // H = wL²/(8d) for level cable
    const H = w * span * span / (8 * sag);
    
    // For inclined cable, adjust position of lowest point
    let x0: number;
    if (Math.abs(h) < 0.001) {
      x0 = span / 2;
    } else {
      // Lowest point position
      x0 = span / 2 - H * h / (w * span);
    }
    
    // Ensure x0 is within span
    x0 = Math.max(0, Math.min(span, x0));
    
    // Vertical reactions
    const Vl = w * x0;
    const Vr = w * (span - x0);
    
    // Resultant tensions
    const Tl = Math.sqrt(H * H + Vl * Vl);
    const Tr = Math.sqrt(H * H + Vr * Vr);
    const Tmax = Math.max(Tl, Tr);
    const Tmin = H;
    
    // Cable length (approximate for parabola)
    const theta_l = Math.atan(Vl / H);
    const theta_r = Math.atan(Vr / H);
    const L = span + (8 * sag * sag) / (3 * span);
    
    // Lowest point Y coordinate
    const lowestPointY = leftSupport.y - w * x0 * x0 / (2 * H);
    
    // Generate profile
    const profile: { x: number; y: number; tension: number }[] = [];
    const numPoints = 51;
    for (let i = 0; i <= numPoints - 1; i++) {
      const x = (i / (numPoints - 1)) * span;
      // Parabola equation: y = y0 + w(x-x0)²/(2H)
      const y = lowestPointY + w * (x - x0) * (x - x0) / (2 * H);
      const slope = w * (x - x0) / H;
      const T = H * Math.sqrt(1 + slope * slope);
      profile.push({ x, y, tension: T });
    }
    
    return {
      span,
      heightDifference: h,
      sag,
      sagRatio: sag / span,
      cableLength: L,
      horizontalTension: H,
      maxTension: Tmax,
      minTension: Tmin,
      leftReaction: {
        horizontal: H,
        vertical: Vl,
        resultant: Tl,
        angle: Math.atan(Vl / H) * 180 / Math.PI,
      },
      rightReaction: {
        horizontal: H,
        vertical: Vr,
        resultant: Tr,
        angle: Math.atan(Vr / H) * 180 / Math.PI,
      },
      lowestPointX: x0,
      lowestPointY,
      profile,
    };
  }

  // ===========================================================================
  // FULL DESIGN
  // ===========================================================================

  public design(profileType: CableProfile = 'catenary'): CableDesignResult {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Perform analysis
    const catenaryAnalysis = this.analyzeCatenary();
    const parabolicAnalysis = this.analyzeParabolic();
    
    // Use specified profile type for design
    const primaryAnalysis = profileType === 'catenary' ? catenaryAnalysis : parabolicAnalysis;
    
    // Ultimate capacity
    const ultimateCapacity = this.area * this.material.fpu / 1000;
    
    // Service capacity (0.45 * fpu for permanent + variable)
    const safetyFactor = 2.2;
    const serviceCapacity = ultimateCapacity / safetyFactor;
    
    // Check capacity
    const maxTension = primaryAnalysis.maxTension;
    const utilizationRatio = maxTension / serviceCapacity;
    const status = utilizationRatio <= 1.0 ? 'pass' : 'fail';
    
    // Axial stiffness
    const E = this.material.E;
    const axialStiffness = E * this.area / (primaryAnalysis.cableLength * 1000);
    
    // Effective modulus (Ernst formula for sag effect)
    const sigma = maxTension * 1000 / this.area;
    const w = this.loading.selfWeight / primaryAnalysis.cableLength;
    const L_h = this.geometry.span;
    const gamma = w * L_h * L_h * L_h / (12 * sigma * sigma);
    const effectiveModulus = E / (1 + gamma * E);
    
    // Elongation
    const elasticElongation = maxTension * 1000 * primaryAnalysis.cableLength * 1000 / (E * this.area);
    const deltaT = this.loading.temperature || 0;
    const thermalElongation = this.material.alpha * deltaT * primaryAnalysis.cableLength * 1000;
    const totalElongation = elasticElongation + thermalElongation;
    
    // Vibration check
    const mass = this.area * this.material.density / 1e6;  // kg/m
    const fundamentalFrequency = (1 / (2 * this.geometry.span)) * 
                                  Math.sqrt(primaryAnalysis.horizontalTension * 1000 / mass);
    
    let vibrationCheck: 'ok' | 'warning' | 'critical';
    if (fundamentalFrequency > 3) {
      vibrationCheck = 'ok';
    } else if (fundamentalFrequency > 1) {
      vibrationCheck = 'warning';
      warnings.push(`Low fundamental frequency (${fundamentalFrequency.toFixed(2)} Hz) - consider vibration dampers`);
    } else {
      vibrationCheck = 'critical';
      warnings.push(`Very low fundamental frequency (${fundamentalFrequency.toFixed(2)} Hz) - aerodynamic instability risk`);
    }
    
    // Fatigue check (simplified)
    const stressRange = (primaryAnalysis.maxTension - primaryAnalysis.minTension) * 1000 / this.area;
    const fatigueCapacity = this.material.fatigueCategory;
    const fatigueCheck = stressRange < fatigueCapacity ? 'pass' : 'fail';
    
    if (fatigueCheck === 'fail') {
      warnings.push('Fatigue stress range exceeds capacity - review loading cycles');
    }
    
    // Cable weight
    const cableWeight = this.area * this.material.density / 1e6;
    const totalCableWeight = cableWeight * primaryAnalysis.cableLength;
    
    // Recommendations
    if (utilizationRatio < 0.3) {
      recommendations.push('Cable is significantly under-utilized - consider smaller size');
    } else if (utilizationRatio > 0.9) {
      recommendations.push('Cable is highly utilized - consider larger size for margin');
    }
    
    if (primaryAnalysis.sagRatio > 0.15) {
      recommendations.push('High sag ratio may require larger towers or more cables');
    } else if (primaryAnalysis.sagRatio < 0.03) {
      recommendations.push('Very low sag - cable forces are high, verify anchor capacity');
    }
    
    return {
      material: this.material,
      metalArea: this.area,
      nominalDiameter: this.diameter,
      catenaryAnalysis,
      parabolicAnalysis,
      ultimateCapacity,
      serviceCapacity,
      maxTension,
      utilizationRatio,
      status,
      axialStiffness,
      effectiveModulus,
      elasticElongation,
      thermalElongation,
      totalElongation,
      fundamentalFrequency,
      vibrationCheck,
      fatigueStressRange: stressRange,
      fatigueCapacity,
      fatigueCheck,
      cableWeight,
      totalCableWeight,
      warnings,
      recommendations,
    };
  }
}

// =============================================================================
// STAY CABLE DESIGN
// =============================================================================

export interface StayCableInput {
  anchorPoint: { x: number; y: number };  // Tower anchor (m)
  deckPoint: { x: number; y: number };    // Deck anchor (m)
  designForce: number;                     // Required cable force (kN)
  liveLoadRange: number;                   // Live load force range (kN)
  temperature: number;                     // Temperature change (°C)
  fatigueStressRange?: number;             // Direct stress range if known (MPa)
}

export interface StayCableResult {
  // Geometry
  cableLength: number;        // m
  horizontalSpan: number;     // m
  verticalRise: number;       // m
  angle: number;              // degrees from horizontal
  
  // Selected cable
  material: CableMaterial;
  numStrands: number;
  strandArea: number;         // mm² per strand
  totalArea: number;          // mm²
  nominalDiameter: number;    // mm
  
  // Forces
  axialForce: number;         // kN
  horizontalComponent: number;// kN
  verticalComponent: number;  // kN
  
  // Capacity
  ultimateCapacity: number;   // kN
  serviceCapacity: number;    // kN
  utilizationRatio: number;
  status: 'pass' | 'fail';
  
  // Elongation
  elasticElongation: number;  // mm
  thermalElongation: number;  // mm
  totalElongation: number;    // mm
  
  // Vibration
  fundamentalFrequency: number;
  criticalWindSpeed: number;  // m/s for vortex shedding
  
  // Fatigue
  fatigueStressRange: number;
  fatigueLife: number;        // million cycles
  
  // Weight
  cableWeight: number;        // kg
}

export function designStayCable(input: StayCableInput, materialKey: string = 'stay-cable-1860'): StayCableResult {
  const material = CABLE_MATERIALS[materialKey] || CABLE_MATERIALS['stay-cable-1860'];
  
  // Calculate geometry
  const dx = input.deckPoint.x - input.anchorPoint.x;
  const dy = input.deckPoint.y - input.anchorPoint.y;
  const cableLength = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
  
  // Force components
  const cosAngle = Math.abs(dx) / cableLength;
  const sinAngle = Math.abs(dy) / cableLength;
  const horizontalComponent = input.designForce * cosAngle;
  const verticalComponent = input.designForce * sinAngle;
  
  // Select cable size
  // Use 15.7mm strands (standard stay cable strand)
  const strandArea = 150; // mm²
  const strandBreaking = 279; // kN for 1860 MPa
  
  // Safety factor for stay cables = 2.0 to 2.5
  const safetyFactor = 2.2;
  const requiredUltimate = input.designForce * safetyFactor;
  const numStrands = Math.ceil(requiredUltimate / strandBreaking);
  const totalArea = numStrands * strandArea;
  const nominalDiameter = Math.sqrt(4 * totalArea / (Math.PI * material.fillFactor));
  
  // Capacity
  const ultimateCapacity = numStrands * strandBreaking;
  const serviceCapacity = ultimateCapacity / safetyFactor;
  const utilizationRatio = input.designForce / serviceCapacity;
  
  // Elongation
  const E = material.E;
  const elasticElongation = input.designForce * 1000 * cableLength * 1000 / (E * totalArea);
  const thermalElongation = material.alpha * input.temperature * cableLength * 1000;
  const totalElongation = elasticElongation + Math.abs(thermalElongation);
  
  // Vibration
  const mass = totalArea * material.density / 1e6; // kg/m
  const fundamentalFrequency = (1 / (2 * cableLength)) * 
                                Math.sqrt(input.designForce * 1000 / mass);
  
  // Critical wind speed for vortex shedding (Strouhal number ~ 0.2)
  const St = 0.2;
  const criticalWindSpeed = fundamentalFrequency * nominalDiameter / (1000 * St);
  
  // Fatigue
  const fatigueStressRange = input.fatigueStressRange || 
                              (input.liveLoadRange * 1000 / totalArea);
  const fatigueLife = Math.pow(material.fatigueCategory / fatigueStressRange, 3) * 2e6 / 1e6;
  
  // Weight
  const cableWeight = mass * cableLength;
  
  return {
    cableLength,
    horizontalSpan: Math.abs(dx),
    verticalRise: Math.abs(dy),
    angle,
    material,
    numStrands,
    strandArea,
    totalArea,
    nominalDiameter,
    axialForce: input.designForce,
    horizontalComponent,
    verticalComponent,
    ultimateCapacity,
    serviceCapacity,
    utilizationRatio,
    status: utilizationRatio <= 1.0 ? 'pass' : 'fail',
    elasticElongation,
    thermalElongation,
    totalElongation,
    fundamentalFrequency,
    criticalWindSpeed,
    fatigueStressRange,
    fatigueLife,
    cableWeight,
  };
}

// =============================================================================
// CABLE VIBRATION AND DAMPING
// =============================================================================

export interface CableVibrationAnalysis {
  // Natural frequencies
  frequencies: { mode: number; frequency: number }[];
  
  // Vortex shedding
  criticalWindSpeeds: { mode: number; speed: number }[];
  lockInRange: { min: number; max: number };
  
  // Rain-wind vibration susceptibility
  rainWindSusceptible: boolean;
  
  // Damper requirements
  requiredDamping: number;    // % of critical
  damperForce: number;        // kN
  
  // Recommendations
  recommendations: string[];
}

export function analyzeVibration(
  cableLength: number,
  tension: number,
  mass: number,
  diameter: number
): CableVibrationAnalysis {
  const recommendations: string[] = [];
  
  // Natural frequencies for first 10 modes
  const frequencies: { mode: number; frequency: number }[] = [];
  for (let n = 1; n <= 10; n++) {
    const fn = (n / (2 * cableLength)) * Math.sqrt(tension * 1000 / mass);
    frequencies.push({ mode: n, frequency: fn });
  }
  
  // Vortex shedding critical wind speeds (Strouhal ~ 0.2)
  const St = 0.2;
  const criticalWindSpeeds: { mode: number; speed: number }[] = [];
  for (let n = 1; n <= 5; n++) {
    const Vcr = frequencies[n - 1].frequency * diameter / (1000 * St);
    criticalWindSpeeds.push({ mode: n, speed: Vcr });
  }
  
  // Lock-in range (typically ±20% of critical)
  const V1 = criticalWindSpeeds[0].speed;
  const lockInRange = { min: 0.8 * V1, max: 1.2 * V1 };
  
  // Rain-wind susceptibility (typically 5-15 m/s wind, 70-200mm diameter)
  const rainWindSusceptible = diameter > 70 && diameter < 200 && V1 > 5 && V1 < 20;
  
  if (rainWindSusceptible) {
    recommendations.push('Cable is susceptible to rain-wind induced vibration');
    recommendations.push('Consider helical strakes or cable surface treatment');
  }
  
  // Damper requirements
  // Scruton number for vortex shedding: Sc = 2mζ/(ρD²)
  // Recommended Sc > 10 for stable cable
  const rho_air = 1.225; // kg/m³
  const Sc_target = 10;
  const requiredDamping = (Sc_target * rho_air * diameter * diameter / 1e6) / (2 * mass) * 100;
  
  // Damper force estimate (at cable end for viscous damper)
  const damperForce = 0.02 * tension * requiredDamping / 100;
  
  if (frequencies[0].frequency < 1.5) {
    recommendations.push('Low fundamental frequency - consider tuned mass damper');
  }
  
  if (frequencies[0].frequency < 3) {
    recommendations.push('Install viscous dampers to prevent low-frequency oscillation');
  }
  
  return {
    frequencies,
    criticalWindSpeeds,
    lockInRange,
    rainWindSusceptible,
    requiredDamping,
    damperForce,
    recommendations,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate cable sag for given tension
 */
export function calculateSag(
  span: number,
  tension: number,
  load: number,  // kN/m
  profile: CableProfile = 'parabolic'
): number {
  if (profile === 'parabolic') {
    return load * span * span / (8 * tension);
  } else {
    // Catenary
    const c = tension / load;
    return c * (Math.cosh(span / (2 * c)) - 1);
  }
}

/**
 * Calculate tension for given sag
 */
export function calculateTension(
  span: number,
  sag: number,
  load: number,
  profile: CableProfile = 'parabolic'
): number {
  if (profile === 'parabolic') {
    return load * span * span / (8 * sag);
  } else {
    // Catenary - iterative solution
    let c = span * span / (8 * sag);  // Initial guess
    for (let i = 0; i < 20; i++) {
      const f = c * (Math.cosh(span / (2 * c)) - 1) - sag;
      const df = Math.cosh(span / (2 * c)) - 1 - (span / (2 * c)) * Math.sinh(span / (2 * c));
      c = c - f / df;
    }
    return c * load;
  }
}

/**
 * Calculate cable length
 */
export function calculateCableLength(
  span: number,
  sag: number,
  profile: CableProfile = 'parabolic'
): number {
  if (profile === 'parabolic') {
    return span + 8 * sag * sag / (3 * span);
  } else {
    // Catenary
    const c = span * span / (8 * sag); // Approximate c
    return 2 * c * Math.sinh(span / (2 * c));
  }
}

/**
 * Select cable size for given tension
 */
export function selectCableSize(
  requiredCapacity: number,
  cableType: CableType,
  safetyFactor: number = 2.2
): CableSize | null {
  let sizes: CableSize[];
  
  if (cableType === 'spiral-strand') {
    sizes = SPIRAL_STRAND_SIZES;
  } else if (cableType === 'locked-coil') {
    sizes = LOCKED_COIL_SIZES;
  } else if (cableType === 'stay-cable' || cableType === 'parallel-strand') {
    sizes = STAY_CABLE_STRAND_SIZES;
  } else {
    sizes = SPIRAL_STRAND_SIZES;
  }
  
  for (const size of sizes) {
    if (size.breakingLoad / safetyFactor >= requiredCapacity) {
      return size;
    }
  }
  
  return null; // No suitable size found
}

// =============================================================================
// EXPORTS - Note: Most items are already exported with 'export const/class' above
// =============================================================================

export default CableDesignEngine;
