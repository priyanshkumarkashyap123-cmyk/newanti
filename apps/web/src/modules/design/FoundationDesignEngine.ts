/**
 * BeamLab Ultimate - Foundation Design Engine
 * Comprehensive foundation design per international codes
 * 
 * Foundation Types:
 * - Isolated footings (square, rectangular, circular)
 * - Combined footings (rectangular, trapezoidal)
 * - Strap/cantilever footings
 * - Mat/raft foundations
 * - Pile foundations (single, group)
 * - Pile caps
 * - Retaining walls
 * 
 * Design Codes:
 * - IS 456:2000 / IS 1893:2016 (India)
 * - ACI 318-19 / ASCE 7-22 (USA)
 * - EN 1992-1-1 / EN 1997-1 (Eurocode)
 * - AS 2159 / AS 3600 (Australia)
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type FoundationCode = 'IS456' | 'ACI318' | 'EC2' | 'AS3600';
export type FoundationType = 
  | 'isolated_square' | 'isolated_rect' | 'isolated_circular'
  | 'combined_rect' | 'combined_trap' | 'strap'
  | 'mat' | 'pile' | 'pile_group' | 'pile_cap'
  | 'retaining_cantilever' | 'retaining_gravity';

export interface SoilProperties {
  type: 'rock' | 'gravel' | 'sand' | 'clay' | 'silt' | 'mixed';
  classification?: string; // USCS classification
  allowableBearing: number; // kN/m² (kPa)
  ultimateBearing?: number;
  frictionAngle: number; // degrees
  cohesion: number; // kN/m²
  unitWeight: number; // kN/m³
  saturatedWeight?: number;
  subgradeModulus?: number; // kN/m³
  nValue?: number; // SPT N-value
  waterTable?: number; // Depth below ground (m)
  elasticModulus?: number; // MPa
  poissonRatio?: number;
}

export interface FoundationLoads {
  axial: number; // kN (compression positive)
  momentX: number; // kN·m
  momentY: number; // kN·m
  shearX: number; // kN
  shearY: number; // kN
  torsion?: number; // kN·m
  isServiceLoad?: boolean; // If true, use working stress design
}

export interface FoundationGeometry {
  length?: number; // m (B)
  width?: number; // m (L)
  diameter?: number; // m (for circular)
  depth: number; // m (embedment depth)
  thickness?: number; // m (footing thickness)
  pedestal?: { length: number; width: number; height: number };
}

export interface FoundationMaterials {
  concrete: {
    grade: string; // M25, C30, etc.
    fck: number; // MPa characteristic strength
    Ec?: number; // MPa elastic modulus
  };
  steel: {
    grade: string; // Fe500, Gr60, etc.
    fy: number; // MPa yield strength
    cover: number; // mm clear cover
  };
}

export interface FoundationDesignResult {
  status: 'PASS' | 'FAIL' | 'WARNING';
  geometry: {
    length: number;
    width: number;
    thickness: number;
    embedment: number;
  };
  reinforcement: {
    bottomX: { bars: string; spacing: number; area: number };
    bottomY: { bars: string; spacing: number; area: number };
    topX?: { bars: string; spacing: number; area: number };
    topY?: { bars: string; spacing: number; area: number };
  };
  checks: FoundationCheck[];
  settlements: SettlementResult;
  capacity: {
    ultimateBearing: number;
    allowableBearing: number;
    safetyFactor: number;
  };
  quantities: {
    concrete: number; // m³
    steel: number; // kg
    excavation: number; // m³
  };
}

export interface FoundationCheck {
  name: string;
  demand: number;
  capacity: number;
  ratio: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
  reference: string;
}

export interface SettlementResult {
  immediate: number; // mm
  consolidation: number; // mm
  total: number; // mm
  differential?: number; // mm
  allowable: number; // mm
  status: 'PASS' | 'FAIL';
}

export interface PileProperties {
  type: 'driven' | 'bored' | 'CFA' | 'micropile';
  diameter: number; // mm
  length: number; // m
  material: 'concrete' | 'steel' | 'timber' | 'composite';
  capacity?: {
    compression: number; // kN
    tension: number; // kN
    lateral: number; // kN
  };
}

export interface PileGroupConfig {
  rows: number;
  columns: number;
  spacingX: number; // m
  spacingY: number; // m
  arrangement: 'rectangular' | 'triangular' | 'circular';
}

// ============================================================================
// BEARING CAPACITY CALCULATIONS
// ============================================================================

interface BearingFactors {
  Nc: number;
  Nq: number;
  Ngamma: number;
}

/**
 * Calculate Terzaghi bearing capacity factors
 */
function getTerzaghiFactors(phi: number): BearingFactors {
  const phiRad = phi * Math.PI / 180;
  
  const Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
  const Nc = (Nq - 1) / Math.tan(phiRad);
  const Ngamma = 2 * (Nq + 1) * Math.tan(phiRad);
  
  return { Nc: phi === 0 ? 5.7 : Nc, Nq, Ngamma };
}

/**
 * Calculate Meyerhof bearing capacity factors
 */
function getMeyerhofFactors(phi: number): BearingFactors {
  const phiRad = phi * Math.PI / 180;
  
  const Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
  const Nc = (Nq - 1) / Math.tan(phiRad);
  const Ngamma = (Nq - 1) * Math.tan(1.4 * phiRad);
  
  return { Nc: phi === 0 ? 5.14 : Nc, Nq, Ngamma };
}

/**
 * Calculate Hansen bearing capacity factors
 */
function getHansenFactors(phi: number): BearingFactors {
  const phiRad = phi * Math.PI / 180;
  
  const Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
  const Nc = (Nq - 1) / Math.tan(phiRad);
  const Ngamma = 1.5 * (Nq - 1) * Math.tan(phiRad);
  
  return { Nc: phi === 0 ? 5.14 : Nc, Nq, Ngamma };
}

/**
 * Calculate IS 6403 bearing capacity factors
 */
function getIS6403Factors(phi: number): BearingFactors {
  const phiRad = phi * Math.PI / 180;
  
  const Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
  const Nc = (Nq - 1) / Math.tan(phiRad);
  const Ngamma = 1.8 * (Nq - 1) * Math.tan(phiRad);
  
  return { Nc: phi === 0 ? 5.14 : Nc, Nq, Ngamma };
}

// ============================================================================
// FOUNDATION DESIGN ENGINE
// ============================================================================

export class FoundationDesignEngine {
  private code: FoundationCode;
  private gammac: number = 1.5; // Concrete partial factor
  private gammas: number = 1.15; // Steel partial factor
  private gammab: number = 2.5; // Bearing capacity factor of safety
  
  constructor(code: FoundationCode = 'IS456') {
    this.code = code;
    this.setCodeFactors();
  }
  
  private setCodeFactors(): void {
    switch (this.code) {
      case 'IS456':
        this.gammac = 1.5;
        this.gammas = 1.15;
        this.gammab = 2.5; // IS 6403
        break;
      case 'ACI318':
        this.gammac = 1 / 0.65; // phi = 0.65
        this.gammas = 1 / 0.9;
        this.gammab = 3.0;
        break;
      case 'EC2':
        this.gammac = 1.5;
        this.gammas = 1.15;
        this.gammab = 1.4; // EN 1997 DA1
        break;
      case 'AS3600':
        this.gammac = 1 / 0.6;
        this.gammas = 1 / 0.8;
        this.gammab = 2.5;
        break;
    }
  }
  
  /**
   * Design isolated footing
   */
  designIsolatedFooting(
    loads: FoundationLoads,
    soil: SoilProperties,
    materials: FoundationMaterials,
    column: { width: number; depth: number },
    options?: { maxLength?: number; maxWidth?: number; minThickness?: number }
  ): FoundationDesignResult {
    const checks: FoundationCheck[] = [];
    
    // Step 1: Size footing for bearing pressure
    const { length, width, pressure } = this.sizeFootingForBearing(
      loads, soil, column, options
    );
    
    // Step 2: Check bearing capacity
    const qu = this.calculateUltimateBearing(soil, width, length, loads);
    const qa = qu / this.gammab;
    const appliedPressure = this.calculateAppliedPressure(loads, length, width);
    
    checks.push({
      name: 'Bearing Capacity',
      demand: appliedPressure.max,
      capacity: soil.allowableBearing,
      ratio: appliedPressure.max / soil.allowableBearing,
      status: appliedPressure.max <= soil.allowableBearing ? 'PASS' : 'FAIL',
      reference: this.getCodeReference('bearing'),
    });
    
    // Check for uplift (tension)
    if (appliedPressure.min < 0) {
      checks.push({
        name: 'Uplift Check',
        demand: Math.abs(appliedPressure.min),
        capacity: 0,
        ratio: 999,
        status: 'WARNING',
        reference: 'Tension at footing base - consider increasing size or adding weight',
      });
    }
    
    // Step 3: Calculate thickness for shear
    const thickness = this.calculateThicknessForShear(
      appliedPressure.max, length, width, column, materials,
      options?.minThickness || 0.3
    );
    
    // Step 4: One-way shear check
    const oneWayShear = this.checkOneWayShear(
      appliedPressure.max, length, width, column, thickness, materials
    );
    checks.push(oneWayShear);
    
    // Step 5: Two-way (punching) shear check
    const twoWayShear = this.checkTwoWayShear(
      loads.axial, length, width, column, thickness, materials
    );
    checks.push(twoWayShear);
    
    // Step 6: Design reinforcement
    const reinforcement = this.designFootingReinforcement(
      appliedPressure.max, length, width, column, thickness, materials
    );
    
    // Step 7: Settlement calculation
    const settlements = this.calculateSettlement(
      appliedPressure.avg, length, width, loads, soil
    );
    
    // Step 8: Calculate quantities
    const concrete = length * width * thickness;
    const steelArea = (reinforcement.bottomX.area * width + reinforcement.bottomY.area * length) / 1000000;
    const steel = steelArea * thickness * 7850; // kg
    const excavation = length * width * (thickness + soil.unitWeight > 0 ? 0.1 : 0.15);
    
    const maxRatio = Math.max(...checks.map(c => c.ratio));
    const overallStatus = checks.every(c => c.status !== 'FAIL') 
      ? (checks.some(c => c.status === 'WARNING') ? 'WARNING' : 'PASS')
      : 'FAIL';
    
    return {
      status: overallStatus,
      geometry: {
        length,
        width,
        thickness,
        embedment: loads.isServiceLoad ? 1.0 : 1.5, // Minimum embedment
      },
      reinforcement,
      checks,
      settlements,
      capacity: {
        ultimateBearing: qu,
        allowableBearing: qa,
        safetyFactor: qu / appliedPressure.max,
      },
      quantities: {
        concrete,
        steel,
        excavation,
      },
    };
  }
  
  /**
   * Size footing based on bearing pressure
   */
  private sizeFootingForBearing(
    loads: FoundationLoads,
    soil: SoilProperties,
    column: { width: number; depth: number },
    options?: { maxLength?: number; maxWidth?: number }
  ): { length: number; width: number; pressure: { max: number; min: number; avg: number } } {
    const P = loads.axial;
    const Mx = loads.momentX;
    const My = loads.momentY;
    const qa = soil.allowableBearing;
    
    // Initial size from axial load only
    const A = P / (0.8 * qa); // 80% of allowable for initial
    let B = Math.sqrt(A);
    let L = B;
    
    // Iterate to account for moments
    for (let iter = 0; iter < 10; iter++) {
      const ex = Math.abs(Mx / P);
      const ey = Math.abs(My / P);
      
      // Check if within kern
      const kernX = L / 6;
      const kernY = B / 6;
      
      if (ex > kernX || ey > kernY) {
        // Increase size to keep stress positive
        B = Math.max(B, 6 * ey * 1.1);
        L = Math.max(L, 6 * ex * 1.1);
      }
      
      // Calculate pressure
      const pressure = this.calculateAppliedPressure(loads, L, B);
      
      if (pressure.max <= qa && pressure.min >= 0) {
        break;
      }
      
      // Increase size
      const factor = Math.sqrt(pressure.max / qa);
      B *= Math.max(factor, 1.05);
      L *= Math.max(factor, 1.05);
    }
    
    // Round up to practical sizes (0.1m increments)
    L = Math.ceil(L * 10) / 10;
    B = Math.ceil(B * 10) / 10;
    
    // Apply limits
    if (options?.maxLength) L = Math.min(L, options.maxLength);
    if (options?.maxWidth) B = Math.min(B, options.maxWidth);
    
    const pressure = this.calculateAppliedPressure(loads, L, B);
    
    return { length: L, width: B, pressure };
  }
  
  /**
   * Calculate applied pressure under footing
   */
  private calculateAppliedPressure(
    loads: FoundationLoads,
    L: number,
    B: number
  ): { max: number; min: number; avg: number; corners: number[] } {
    const P = loads.axial;
    const Mx = loads.momentX;
    const My = loads.momentY;
    const A = L * B;
    const Zx = B * L * L / 6;
    const Zy = L * B * B / 6;
    
    const p0 = P / A;
    const px = Mx / Zx;
    const py = My / Zy;
    
    // Corner pressures
    const p1 = p0 + px + py; // Corner 1
    const p2 = p0 + px - py; // Corner 2
    const p3 = p0 - px - py; // Corner 3
    const p4 = p0 - px + py; // Corner 4
    
    const corners = [p1, p2, p3, p4];
    
    return {
      max: Math.max(...corners),
      min: Math.min(...corners),
      avg: p0,
      corners,
    };
  }
  
  /**
   * Calculate ultimate bearing capacity
   */
  calculateUltimateBearing(
    soil: SoilProperties,
    B: number,
    L: number,
    loads: FoundationLoads,
    Df: number = 1.0
  ): number {
    const phi = soil.frictionAngle;
    const c = soil.cohesion;
    const gamma = soil.unitWeight;
    const gammaW = 10; // Water unit weight
    
    // Get bearing capacity factors
    const factors = this.code === 'IS456' 
      ? getIS6403Factors(phi) 
      : getHansenFactors(phi);
    
    // Shape factors (rectangular footing)
    const sc = 1 + (B / L) * (factors.Nq / factors.Nc);
    const sq = 1 + (B / L) * Math.tan(phi * Math.PI / 180);
    const sgamma = 1 - 0.4 * (B / L);
    
    // Depth factors
    const k = Df / B;
    const dc = 1 + 0.4 * k;
    const dq = 1 + 2 * Math.tan(phi * Math.PI / 180) * Math.pow(1 - Math.sin(phi * Math.PI / 180), 2) * k;
    const dgamma = 1.0;
    
    // Inclination factors (if lateral load present)
    const H = Math.sqrt(loads.shearX ** 2 + loads.shearY ** 2);
    const V = loads.axial;
    const m = (2 + B / L) / (1 + B / L);
    const ic = H > 0 ? 1 - m * H / (V + B * L * c / Math.tan(phi * Math.PI / 180)) : 1;
    const iq = H > 0 ? Math.pow(1 - H / (V + B * L * c / Math.tan(phi * Math.PI / 180)), m) : 1;
    const igamma = H > 0 ? Math.pow(1 - H / (V + B * L * c / Math.tan(phi * Math.PI / 180)), m + 1) : 1;
    
    // Water table correction
    let gammaEff = gamma;
    if (soil.waterTable !== undefined && soil.waterTable < Df + B) {
      if (soil.waterTable <= Df) {
        gammaEff = gamma - gammaW;
      } else {
        const dw = soil.waterTable - Df;
        gammaEff = gamma - gammaW * (1 - dw / B);
      }
    }
    
    // Ultimate bearing capacity (Hansen equation)
    const qu = c * factors.Nc * sc * dc * ic +
               gamma * Df * factors.Nq * sq * dq * iq +
               0.5 * gammaEff * B * factors.Ngamma * sgamma * dgamma * igamma;
    
    return qu;
  }
  
  /**
   * Calculate footing thickness for shear
   */
  private calculateThicknessForShear(
    pressure: number,
    L: number,
    B: number,
    column: { width: number; depth: number },
    materials: FoundationMaterials,
    minThickness: number
  ): number {
    const fck = materials.concrete.fck;
    const cover = materials.steel.cover / 1000;
    
    // Assume bar diameter
    const barDia = 16 / 1000; // 16mm bars
    
    // Two-way shear controls for most cases
    // d = sqrt(Vu / (4 * phi * sqrt(fc) * bo))
    const Vu = pressure * (L * B - (column.width + 0) * (column.depth + 0)) * 1.5;
    
    // Punching shear stress limit
    let vc: number;
    if (this.code === 'IS456') {
      vc = 0.25 * Math.sqrt(fck) * 1000; // kPa
    } else if (this.code === 'ACI318') {
      vc = 0.33 * Math.sqrt(fck) * 1000;
    } else {
      vc = 0.18 / this.gammac * Math.pow(100 * 0.002 * fck, 1/3) * 1000;
    }
    
    // Iterate to find d
    let d = 0.3; // Initial estimate
    for (let iter = 0; iter < 10; iter++) {
      const b0 = 2 * ((column.width + d) + (column.depth + d));
      const vu = Vu / (b0 * d) / 1000; // MPa
      
      if (vu <= vc / 1000) {
        break;
      }
      d += 0.05;
    }
    
    const thickness = d + cover + barDia * 1.5;
    return Math.max(Math.ceil(thickness * 20) / 20, minThickness); // Round to 50mm
  }
  
  /**
   * Check one-way shear
   */
  private checkOneWayShear(
    pressure: number,
    L: number,
    B: number,
    column: { width: number; depth: number },
    thickness: number,
    materials: FoundationMaterials
  ): FoundationCheck {
    const d = thickness - materials.steel.cover / 1000 - 0.016;
    const fck = materials.concrete.fck;
    
    // Critical section at d from column face
    const Lv = (L - column.depth) / 2 - d;
    const Vu = pressure * B * Lv * 1.5; // kN (factored)
    
    // Shear capacity
    let Vc: number;
    if (this.code === 'IS456') {
      // IS 456 Table 19
      const tauc = 0.25 * Math.sqrt(fck);
      Vc = tauc * B * d * 1000;
    } else if (this.code === 'ACI318') {
      Vc = 0.17 * Math.sqrt(fck) * B * d * 1000;
    } else {
      const k = Math.min(1 + Math.sqrt(200 / (d * 1000)), 2);
      const rhoL = 0.002; // Minimum steel ratio
      const vRd = 0.12 * k * Math.pow(100 * rhoL * fck, 1/3);
      Vc = vRd * B * d * 1000;
    }
    
    return {
      name: 'One-way Shear',
      demand: Vu,
      capacity: Vc,
      ratio: Vu / Vc,
      status: Vu <= Vc ? 'PASS' : 'FAIL',
      reference: this.getCodeReference('one_way_shear'),
    };
  }
  
  /**
   * Check two-way (punching) shear
   */
  private checkTwoWayShear(
    P: number,
    L: number,
    B: number,
    column: { width: number; depth: number },
    thickness: number,
    materials: FoundationMaterials
  ): FoundationCheck {
    const d = thickness - materials.steel.cover / 1000 - 0.016;
    const fck = materials.concrete.fck;
    
    // Critical perimeter at d/2 from column face
    const b0 = 2 * ((column.width + d) + (column.depth + d));
    const Ap = (column.width + d) * (column.depth + d);
    
    // Punching shear force
    const Vu = P * 1.5 * (1 - Ap / (L * B)); // kN
    
    // Punching shear capacity
    let Vc: number;
    if (this.code === 'IS456') {
      const ks = Math.min(0.5 + column.width / column.depth, 1.0);
      const tauc = ks * 0.25 * Math.sqrt(fck);
      Vc = tauc * b0 * d * 1000;
    } else if (this.code === 'ACI318') {
      const beta = column.depth / column.width;
      const vc1 = 0.17 * (1 + 2 / beta) * Math.sqrt(fck);
      const vc2 = 0.083 * (2 + 40 * d / b0) * Math.sqrt(fck);
      const vc3 = 0.33 * Math.sqrt(fck);
      const vc = Math.min(vc1, vc2, vc3);
      Vc = vc * b0 * d * 1000;
    } else {
      const k = Math.min(1 + Math.sqrt(200 / (d * 1000)), 2);
      const vRd = 0.18 / this.gammac * k * Math.pow(100 * 0.002 * fck, 1/3);
      Vc = vRd * b0 * d * 1000;
    }
    
    return {
      name: 'Punching Shear',
      demand: Vu,
      capacity: Vc,
      ratio: Vu / Vc,
      status: Vu <= Vc ? 'PASS' : 'FAIL',
      reference: this.getCodeReference('two_way_shear'),
    };
  }
  
  /**
   * Design footing reinforcement
   */
  private designFootingReinforcement(
    pressure: number,
    L: number,
    B: number,
    column: { width: number; depth: number },
    thickness: number,
    materials: FoundationMaterials
  ): {
    bottomX: { bars: string; spacing: number; area: number };
    bottomY: { bars: string; spacing: number; area: number };
  } {
    const d = thickness - materials.steel.cover / 1000 - 0.016;
    const fck = materials.concrete.fck;
    const fy = materials.steel.fy;
    
    // Moment at column face (cantilever action)
    const lx = (L - column.depth) / 2;
    const ly = (B - column.width) / 2;
    
    const Mux = pressure * B * lx * lx / 2 * 1.5; // kN·m/m
    const Muy = pressure * L * ly * ly / 2 * 1.5;
    
    // Required steel area
    const getAst = (Mu: number, b: number): number => {
      // Mu = 0.87 * fy * Ast * d * (1 - Ast * fy / (b * d * fck))
      const K = Mu * 1e6 / (fck * b * 1000 * d * d * 1e6);
      const z = d * (0.5 + Math.sqrt(0.25 - K / 1.134));
      const Ast = Mu * 1e6 / (0.87 * fy * z * 1000);
      return Math.max(Ast, 0.0012 * b * thickness * 1e6); // Minimum steel
    };
    
    const AstX = getAst(Mux, B);
    const AstY = getAst(Muy, L);
    
    // Select bars
    const selectBars = (Ast: number, width: number): { bars: string; spacing: number; area: number } => {
      const barDiameters = [12, 16, 20, 25];
      
      for (const dia of barDiameters) {
        const barArea = Math.PI * dia * dia / 4;
        const numBars = Math.ceil(Ast / barArea);
        const spacing = (width * 1000 - 2 * materials.steel.cover) / (numBars - 1);
        
        if (spacing >= 100 && spacing <= 300) {
          return {
            bars: `${numBars}T${dia}`,
            spacing: Math.floor(spacing),
            area: numBars * barArea,
          };
        }
      }
      
      // Default to 16mm at 150mm
      const numBars = Math.ceil(width * 1000 / 150);
      return {
        bars: `${numBars}T16`,
        spacing: 150,
        area: numBars * Math.PI * 16 * 16 / 4,
      };
    };
    
    return {
      bottomX: selectBars(AstX, B),
      bottomY: selectBars(AstY, L),
    };
  }
  
  /**
   * Calculate settlement
   */
  private calculateSettlement(
    pressure: number,
    L: number,
    B: number,
    loads: FoundationLoads,
    soil: SoilProperties
  ): SettlementResult {
    // Immediate settlement (elastic)
    const Es = soil.elasticModulus || 20; // MPa default
    const v = soil.poissonRatio || 0.3;
    
    // Influence factor for flexible footing
    const If = 0.88; // Approximate for L/B = 1
    const mu0 = 1.0;
    const mu1 = 1.0;
    
    const qnet = pressure - soil.unitWeight * 1.0; // Net pressure
    const Si = qnet * B * (1 - v * v) * If * mu0 * mu1 / (Es * 1000); // m
    
    // Consolidation settlement (for clay)
    let Sc = 0;
    if (soil.type === 'clay' || soil.type === 'silt') {
      const Cc = 0.009 * (soil.nValue ? 100 - soil.nValue : 50); // Compression index estimate
      const e0 = 0.8; // Initial void ratio estimate
      const H = 2 * B; // Compressible layer thickness
      const sigma0 = soil.unitWeight * (1.0 + B / 2);
      const deltaSigma = 0.5 * qnet; // Stress at mid-layer
      
      Sc = Cc * H / (1 + e0) * Math.log10((sigma0 + deltaSigma) / sigma0);
    }
    
    const totalSettlement = (Si + Sc) * 1000; // mm
    const allowable = soil.type === 'clay' ? 75 : 50; // mm
    
    return {
      immediate: Si * 1000,
      consolidation: Sc * 1000,
      total: totalSettlement,
      allowable,
      status: totalSettlement <= allowable ? 'PASS' : 'FAIL',
    };
  }
  
  /**
   * Design pile foundation
   */
  designPileFoundation(
    loads: FoundationLoads,
    soil: SoilProperties[],
    pile: PileProperties,
    materials: FoundationMaterials,
    options?: { groupEffect?: boolean; settlementCheck?: boolean }
  ): {
    numPiles: number;
    arrangement: { rows: number; cols: number; spacing: number };
    pileCapacity: { compression: number; tension: number; lateral: number };
    pileCap: { length: number; width: number; depth: number };
    checks: FoundationCheck[];
  } {
    const checks: FoundationCheck[] = [];
    
    // Calculate single pile capacity
    const pileCapacity = this.calculatePileCapacity(pile, soil);
    
    // Number of piles required
    const FOS = 2.5;
    const allowableCapacity = pileCapacity.compression / FOS;
    const numPiles = Math.ceil(loads.axial / allowableCapacity);
    
    // Arrange piles
    const cols = Math.ceil(Math.sqrt(numPiles));
    const rows = Math.ceil(numPiles / cols);
    const spacing = Math.max(2.5 * pile.diameter / 1000, 0.75); // Min 2.5D or 750mm
    
    // Group efficiency
    let groupEfficiency = 1.0;
    if (options?.groupEffect !== false && numPiles > 1) {
      // Converse-Labarre formula
      const theta = Math.atan(pile.diameter / (spacing * 1000)) * 180 / Math.PI;
      groupEfficiency = 1 - theta * ((rows - 1) * cols + (cols - 1) * rows) / (90 * rows * cols);
      groupEfficiency = Math.max(groupEfficiency, 0.6);
    }
    
    const groupCapacity = numPiles * allowableCapacity * groupEfficiency;
    
    checks.push({
      name: 'Pile Group Capacity',
      demand: loads.axial,
      capacity: groupCapacity,
      ratio: loads.axial / groupCapacity,
      status: loads.axial <= groupCapacity ? 'PASS' : 'FAIL',
      reference: this.getCodeReference('pile_capacity'),
    });
    
    // Pile cap design
    const capLength = (cols - 1) * spacing + 2 * 0.15 + pile.diameter / 1000;
    const capWidth = (rows - 1) * spacing + 2 * 0.15 + pile.diameter / 1000;
    const capDepth = Math.max(0.6, pile.diameter / 1000 * 1.5);
    
    return {
      numPiles,
      arrangement: { rows, cols, spacing },
      pileCapacity,
      pileCap: { length: capLength, width: capWidth, depth: capDepth },
      checks,
    };
  }
  
  /**
   * Calculate single pile capacity
   */
  private calculatePileCapacity(
    pile: PileProperties,
    soilLayers: SoilProperties[]
  ): { compression: number; tension: number; lateral: number } {
    const D = pile.diameter / 1000; // m
    const L = pile.length; // m
    const Ap = Math.PI * D * D / 4; // m²
    const perimeter = Math.PI * D;
    
    let Qp = 0; // End bearing
    let Qs = 0; // Shaft friction
    
    // Simplified calculation using deepest layer for end bearing
    const bottomSoil = soilLayers[soilLayers.length - 1];
    
    if (bottomSoil.type === 'sand' || bottomSoil.type === 'gravel') {
      // Sand - use Meyerhof method
      const phi = bottomSoil.frictionAngle;
      const Nq = Math.exp(Math.PI * Math.tan(phi * Math.PI / 180)) * 
                 Math.pow(Math.tan(45 + phi / 2), 2);
      const sigmav = bottomSoil.unitWeight * L;
      Qp = Ap * Nq * sigmav; // kN
      
      // Shaft friction
      const K = pile.type === 'driven' ? 1.0 : 0.7;
      const delta = 0.75 * phi;
      Qs = perimeter * L * K * (sigmav / 2) * Math.tan(delta * Math.PI / 180);
    } else {
      // Clay - use alpha method
      const cu = bottomSoil.cohesion;
      const Nc = 9;
      Qp = Ap * Nc * cu; // kN
      
      // Shaft friction
      const alpha = cu < 25 ? 1.0 : cu < 70 ? 1 - 0.01 * (cu - 25) : 0.55;
      Qs = perimeter * L * alpha * cu;
    }
    
    const compression = Qp + Qs;
    const tension = 0.5 * Qs; // Tension capacity typically 50% of shaft
    const lateral = 0.2 * compression; // Rough estimate
    
    return { compression, tension, lateral };
  }
  
  /**
   * Get code reference string
   */
  private getCodeReference(checkType: string): string {
    const refs: Record<FoundationCode, Record<string, string>> = {
      IS456: {
        bearing: 'IS 6403:1981',
        one_way_shear: 'IS 456:2000 Cl. 31.6',
        two_way_shear: 'IS 456:2000 Cl. 31.6.3',
        flexure: 'IS 456:2000 Cl. 38.1',
        pile_capacity: 'IS 2911 (Part 1)',
      },
      ACI318: {
        bearing: 'ACI 318-19 Sec. 13.3',
        one_way_shear: 'ACI 318-19 Sec. 22.5',
        two_way_shear: 'ACI 318-19 Sec. 22.6',
        flexure: 'ACI 318-19 Sec. 22.2',
        pile_capacity: 'ACI 543R',
      },
      EC2: {
        bearing: 'EN 1997-1 Sec. 6',
        one_way_shear: 'EN 1992-1-1 Sec. 6.2',
        two_way_shear: 'EN 1992-1-1 Sec. 6.4',
        flexure: 'EN 1992-1-1 Sec. 6.1',
        pile_capacity: 'EN 1997-1 Sec. 7',
      },
      AS3600: {
        bearing: 'AS 2159',
        one_way_shear: 'AS 3600 Sec. 8.2',
        two_way_shear: 'AS 3600 Sec. 9.2',
        flexure: 'AS 3600 Sec. 8.1',
        pile_capacity: 'AS 2159',
      },
    };
    
    return refs[this.code]?.[checkType] || `${this.code} - ${checkType}`;
  }
}

// ============================================================================
// FACTORY AND UTILITY FUNCTIONS
// ============================================================================

export function createFoundationEngine(code: FoundationCode = 'IS456'): FoundationDesignEngine {
  return new FoundationDesignEngine(code);
}

/**
 * Get typical soil properties by type
 */
export function getTypicalSoilProperties(type: SoilProperties['type']): SoilProperties {
  const properties: Record<string, SoilProperties> = {
    rock: {
      type: 'rock',
      allowableBearing: 3000,
      frictionAngle: 45,
      cohesion: 500,
      unitWeight: 25,
      elasticModulus: 50000,
      poissonRatio: 0.2,
    },
    gravel: {
      type: 'gravel',
      allowableBearing: 450,
      frictionAngle: 40,
      cohesion: 0,
      unitWeight: 20,
      elasticModulus: 100,
      poissonRatio: 0.3,
    },
    sand: {
      type: 'sand',
      allowableBearing: 200,
      frictionAngle: 32,
      cohesion: 0,
      unitWeight: 18,
      elasticModulus: 50,
      poissonRatio: 0.3,
    },
    clay: {
      type: 'clay',
      allowableBearing: 150,
      frictionAngle: 20,
      cohesion: 50,
      unitWeight: 18,
      elasticModulus: 20,
      poissonRatio: 0.4,
    },
    silt: {
      type: 'silt',
      allowableBearing: 100,
      frictionAngle: 25,
      cohesion: 20,
      unitWeight: 17,
      elasticModulus: 15,
      poissonRatio: 0.35,
    },
    mixed: {
      type: 'mixed',
      allowableBearing: 150,
      frictionAngle: 28,
      cohesion: 10,
      unitWeight: 18,
      elasticModulus: 30,
      poissonRatio: 0.33,
    },
  };
  
  return properties[type] || properties.sand;
}

/**
 * Get bearing capacity from SPT N-value
 */
export function getBearingFromSPT(N: number, footing_width: number): number {
  // Terzaghi and Peck correlation for sand
  if (footing_width <= 1.2) {
    return 12 * N; // kPa
  } else {
    return 8 * N * Math.pow((footing_width + 0.3) / footing_width, 2);
  }
}

/**
 * Calculate pile spacing requirements
 */
export function getMinPileSpacing(pileDiameter: number, soilType: string): number {
  const D = pileDiameter / 1000; // Convert to meters
  
  if (soilType === 'clay') {
    return Math.max(2.0 * D, 0.6); // 2D or 600mm
  } else {
    return Math.max(2.5 * D, 0.75); // 2.5D or 750mm
  }
}

// Default export
export default FoundationDesignEngine;
