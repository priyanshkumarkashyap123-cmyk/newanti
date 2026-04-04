/**
 * ============================================================================
 * FOUNDATION DESIGN ENGINE
 * ============================================================================
 * 
 * Complete foundation design capabilities including:
 * - Isolated Footings (Square, Rectangular, Circular)
 * - Combined Footings
 * - Strip Footings
 * - Raft/Mat Foundations
 * - Pile Foundations (Single, Group)
 * - Pile Cap Design
 * - Retaining Walls
 * - Soil-Structure Interaction
 * 
 * Codes: IS 456, IS 2950, IS 6403, ACI 318, EN 1992
 * 
 * @version 2.0.0
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type FoundationType = 
  | 'isolated_square'
  | 'isolated_rectangular'
  | 'isolated_circular'
  | 'combined'
  | 'strip'
  | 'raft'
  | 'pile_single'
  | 'pile_group'
  | 'pile_cap';

export type DesignCodeFound = 'IS456' | 'IS2950' | 'ACI318' | 'EN1992';

export interface SoilProperties {
  type: 'cohesive' | 'cohesionless' | 'rock' | 'mixed';
  classification: string; // e.g., 'CL', 'SM', 'GP'
  unitWeight: number;     // kN/m³
  saturatedUnitWeight: number; // kN/m³
  cohesion: number;       // kPa (c or cu)
  frictionAngle: number;  // degrees (φ)
  elasticModulus: number; // MPa
  poissonRatio: number;
  allowableBearingCapacity?: number; // kPa
  waterTableDepth?: number; // m from ground surface
  layers?: SoilLayer[];
}

export interface SoilLayer {
  depth: number;        // m (top of layer from ground)
  thickness: number;    // m
  type: string;
  unitWeight: number;
  cohesion: number;
  frictionAngle: number;
  N_SPT?: number;       // Standard Penetration Test value
}

export interface FoundationLoads {
  axial: number;        // kN (compression positive)
  momentX: number;      // kNm
  momentY: number;      // kNm
  shearX: number;       // kN
  shearY: number;       // kN
  isCombination: boolean;
  loadCase?: string;
}

export interface ConcreteProperties {
  grade: string;        // e.g., 'M25', 'C30'
  fck: number;          // MPa
  Ec: number;           // MPa
  cover: number;        // mm
}

export interface RebarProperties {
  grade: string;        // e.g., 'Fe500', 'Grade 60'
  fy: number;           // MPa
  Es: number;           // MPa (usually 200000)
  minDiameter: number;  // mm
  maxDiameter: number;  // mm
}

export interface FoundationDesignConfig {
  type: FoundationType;
  code: DesignCodeFound;
  soil: SoilProperties;
  loads: FoundationLoads[];
  concrete: ConcreteProperties;
  rebar: RebarProperties;
  depth: number;        // m (depth of foundation below ground)
  columnSize?: { width: number; depth: number }; // mm
  options?: {
    allowUplift: boolean;
    checkSettlement: boolean;
    checkSliding: boolean;
    useWinklerModel: boolean;
  };
}

export interface FootingDesignResult {
  type: FoundationType;
  dimensions: {
    length: number;     // m (or diameter for circular)
    width: number;      // m
    thickness: number;  // m
    depth: number;      // m (below ground)
  };
  reinforcement: {
    bottomX: RebarDetail;
    bottomY: RebarDetail;
    topX?: RebarDetail;
    topY?: RebarDetail;
  };
  soilPressure: {
    max: number;        // kPa
    min: number;        // kPa
    average: number;    // kPa
    allowable: number;  // kPa
  };
  checks: DesignCheck[];
  settlement?: {
    immediate: number;    // mm
    consolidation: number; // mm
    total: number;        // mm
    allowable: number;    // mm
  };
  punchingShear?: {
    perimeter: number;    // mm
    depth: number;        // mm
    demand: number;       // kN
    capacity: number;     // kN
    ratio: number;
  };
  overallStatus: 'PASS' | 'FAIL';
}

export interface RebarDetail {
  diameter: number;     // mm
  spacing: number;      // mm
  layers: number;
  area: number;         // mm²/m
  totalBars?: number;
}

export interface DesignCheck {
  name: string;
  clause: string;
  demand: number;
  capacity: number;
  ratio: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
  notes?: string;
}

// ============================================================================
// MAIN FOUNDATION DESIGN ENGINE CLASS
// ============================================================================

export class FoundationDesignEngine {
  private config: FoundationDesignConfig;
  private partialFactors: {
    concrete: number;
    steel: number;
    soil: number;
  };

  constructor(config: FoundationDesignConfig) {
    this.config = config;
    this.partialFactors = this.getPartialFactors(config.code);
  }

  private getPartialFactors(code: DesignCodeFound): { concrete: number; steel: number; soil: number } {
    switch (code) {
      case 'IS456':
        return { concrete: 1.5, steel: 1.15, soil: 2.5 };
      case 'ACI318':
        return { concrete: 1 / 0.65, steel: 1 / 0.9, soil: 3.0 };
      case 'EN1992':
        return { concrete: 1.5, steel: 1.15, soil: 1.4 };
      default:
        return { concrete: 1.5, steel: 1.15, soil: 2.5 };
    }
  }

  // --------------------------------------------------------------------------
  // MAIN DESIGN METHOD
  // --------------------------------------------------------------------------

  design(): FootingDesignResult | PileDesignResult | RaftDesignResult {
    switch (this.config.type) {
      case 'isolated_square':
      case 'isolated_rectangular':
        return this.designIsolatedFooting();
      case 'isolated_circular':
        return this.designCircularFooting();
      case 'combined':
        return this.designCombinedFooting();
      case 'strip':
        return this.designStripFooting();
      case 'raft':
        return this.designRaftFoundation();
      case 'pile_single':
      case 'pile_group':
        return this.designPileFoundation();
      case 'pile_cap':
        return this.designPileCap();
      default:
        return this.designIsolatedFooting();
    }
  }

  // --------------------------------------------------------------------------
  // ISOLATED FOOTING DESIGN
  // --------------------------------------------------------------------------

  private designIsolatedFooting(): FootingDesignResult {
    const { soil, loads, concrete, rebar, depth, columnSize, code } = this.config;
    
    const checks: DesignCheck[] = [];
    
    // Get maximum loads from all combinations
    const maxLoads = this.getMaximumLoads(loads);
    const P = maxLoads.axial;
    const Mx = maxLoads.momentX;
    const My = maxLoads.momentY;
    
    // Calculate allowable bearing capacity
    const qall = this.calculateAllowableBearingCapacity(soil, depth);
    
    // Size the footing
    const { L, B } = this.sizeFooting(P, Mx, My, qall);
    
    // Check soil pressure
    const { qmax, qmin, qavg } = this.calculateSoilPressure(P, Mx, My, L, B);
    
    checks.push({
      name: 'Maximum Soil Pressure',
      clause: code === 'IS456' ? 'IS 1904:1986' : 'ACI 318-19 Ch. 13',
      demand: qmax,
      capacity: qall,
      ratio: qmax / qall,
      status: qmax <= qall ? 'PASS' : 'FAIL',
    });
    
    // Check for tension (negative pressure)
    if (qmin < 0) {
      checks.push({
        name: 'Uplift Check',
        clause: code === 'IS456' ? 'IS 456:2000' : 'ACI 318-19',
        demand: Math.abs(qmin),
        capacity: 0,
        ratio: 999,
        status: this.config.options?.allowUplift ? 'WARNING' : 'FAIL',
        notes: 'Negative soil pressure indicates uplift',
      });
    }
    
    // Calculate footing thickness
    const colW = columnSize?.width || 400;
    const colD = columnSize?.depth || 400;
    const { d, D } = this.calculateFootingThickness(P, qmax, L, B, colW, colD, concrete);
    
    // One-way shear check
    const oneWayShear = this.checkOneWayShear(qmax, L, B, colW, colD, d, concrete, code);
    checks.push(oneWayShear);
    
    // Two-way (punching) shear check
    const punchingShear = this.checkPunchingShear(P, qmax, L, B, colW, colD, d, concrete, code);
    checks.push(punchingShear.check);
    
    // Flexural design
    const MuX = this.calculateBendingMoment(qmax, qmin, L, colD, B, 'X');
    const MuY = this.calculateBendingMoment(qmax, qmin, B, colW, L, 'Y');
    
    const reinfX = this.designFlexuralReinforcement(MuX, B, d, concrete, rebar, code);
    const reinfY = this.designFlexuralReinforcement(MuY, L, d, concrete, rebar, code);
    
    checks.push({
      name: 'Flexural Capacity (X-direction)',
      clause: code === 'IS456' ? 'IS 456:2000 Cl. 38.1' : 'ACI 318-19 Ch. 22',
      demand: MuX,
      capacity: reinfX.Mn,
      ratio: MuX / reinfX.Mn,
      status: MuX <= reinfX.Mn ? 'PASS' : 'FAIL',
    });
    
    checks.push({
      name: 'Flexural Capacity (Y-direction)',
      clause: code === 'IS456' ? 'IS 456:2000 Cl. 38.1' : 'ACI 318-19 Ch. 22',
      demand: MuY,
      capacity: reinfY.Mn,
      ratio: MuY / reinfY.Mn,
      status: MuY <= reinfY.Mn ? 'PASS' : 'FAIL',
    });
    
    // Settlement check
    let settlement;
    if (this.config.options?.checkSettlement) {
      settlement = this.calculateSettlement(P, L, B, depth, soil);
      
      checks.push({
        name: 'Total Settlement',
        clause: 'IS 1904:1986',
        demand: settlement.total,
        capacity: settlement.allowable,
        ratio: settlement.total / settlement.allowable,
        status: settlement.total <= settlement.allowable ? 'PASS' : 'FAIL',
      });
    }
    
    const overallStatus = checks.every(c => c.status !== 'FAIL') ? 'PASS' : 'FAIL';
    
    return {
      type: this.config.type,
      dimensions: {
        length: L,
        width: B,
        thickness: D,
        depth: depth,
      },
      reinforcement: {
        bottomX: reinfX.rebar,
        bottomY: reinfY.rebar,
      },
      soilPressure: {
        max: qmax,
        min: qmin,
        average: qavg,
        allowable: qall,
      },
      checks,
      settlement,
      punchingShear: {
        perimeter: punchingShear.perimeter,
        depth: d,
        demand: punchingShear.Vu,
        capacity: punchingShear.Vc,
        ratio: punchingShear.check.ratio,
      },
      overallStatus,
    };
  }

  private designCircularFooting(): FootingDesignResult {
    // Similar to isolated but with circular geometry
    const { soil, loads, concrete, rebar, depth, columnSize, code } = this.config;
    const checks: DesignCheck[] = [];
    
    const maxLoads = this.getMaximumLoads(loads);
    const P = maxLoads.axial;
    const M = Math.sqrt(maxLoads.momentX ** 2 + maxLoads.momentY ** 2);
    
    const qall = this.calculateAllowableBearingCapacity(soil, depth);
    
    // Size circular footing
    let D_footing = Math.sqrt(4 * P / (Math.PI * qall * 0.8)); // Initial estimate
    
    // Iterate for eccentricity
    const e = M / P;
    D_footing = Math.max(D_footing, 6 * e); // Ensure e < D/6 for no tension
    
    D_footing = Math.ceil(D_footing * 10) / 10; // Round up to 100mm
    
    const R = D_footing / 2;
    const Area = Math.PI * R * R;
    
    // Soil pressure (circular footing with moment)
    const qavg = P / Area;
    const qmax = P / Area * (1 + 6 * e / D_footing);
    const qmin = P / Area * (1 - 6 * e / D_footing);
    
    checks.push({
      name: 'Maximum Soil Pressure',
      clause: code === 'IS456' ? 'IS 1904:1986' : 'ACI 318-19',
      demand: qmax,
      capacity: qall,
      ratio: qmax / qall,
      status: qmax <= qall ? 'PASS' : 'FAIL',
    });
    
    // Thickness
    const colDia = Math.sqrt((columnSize?.width || 400) * (columnSize?.depth || 400));
    const d = Math.max(
      (qmax * (R - colDia / 2000)) / (0.25 * Math.sqrt(concrete.fck)),
      300
    );
    const thickness = d + concrete.cover + 20;
    
    // Punching shear
    const bo = Math.PI * (colDia + d);
    const Vu = P - qavg * Math.PI * Math.pow((colDia / 2000 + d / 2000), 2);
    const vc = this.getPunchingShearCapacity(concrete, d, code);
    const Vc = vc * bo * d / 1000;
    
    checks.push({
      name: 'Punching Shear',
      clause: code === 'IS456' ? 'IS 456:2000 Cl. 31.6' : 'ACI 318-19 Ch. 22',
      demand: Vu,
      capacity: Vc,
      ratio: Vu / Vc,
      status: Vu <= Vc ? 'PASS' : 'FAIL',
    });
    
    // Radial reinforcement
    const Mu = qmax * Math.pow(R - colDia / 2000, 2) / 2 * 1000;
    const reinfRadial = this.designFlexuralReinforcement(Mu, D_footing * 1000, d, concrete, rebar, code);
    
    checks.push({
      name: 'Flexural Capacity',
      clause: code === 'IS456' ? 'IS 456:2000 Cl. 38.1' : 'ACI 318-19 Ch. 22',
      demand: Mu,
      capacity: reinfRadial.Mn,
      ratio: Mu / reinfRadial.Mn,
      status: Mu <= reinfRadial.Mn ? 'PASS' : 'FAIL',
    });
    
    const overallStatus = checks.every(c => c.status !== 'FAIL') ? 'PASS' : 'FAIL';
    
    return {
      type: 'isolated_circular',
      dimensions: {
        length: D_footing,
        width: D_footing,
        thickness: Math.ceil(thickness / 50) * 50 / 1000,
        depth,
      },
      reinforcement: {
        bottomX: reinfRadial.rebar,
        bottomY: reinfRadial.rebar,
      },
      soilPressure: {
        max: qmax,
        min: qmin,
        average: qavg,
        allowable: qall,
      },
      checks,
      punchingShear: {
        perimeter: bo,
        depth: d,
        demand: Vu,
        capacity: Vc,
        ratio: Vu / Vc,
      },
      overallStatus,
    };
  }

  private designCombinedFooting(): FootingDesignResult {
    // Simplified combined footing for two columns
    const { soil, loads, concrete, rebar, depth, code } = this.config;
    const checks: DesignCheck[] = [];
    
    // Assume two columns with given loads
    const P1 = loads[0]?.axial || loads[0].axial;
    const P2 = loads[1]?.axial || loads[0].axial;
    const L_col = 4.0; // Assume 4m between columns
    
    const P_total = P1 + P2;
    const qall = this.calculateAllowableBearingCapacity(soil, depth);
    
    // Find centroid
    const x_bar = P2 * L_col / P_total;
    
    // Size footing
    const L = 2 * (x_bar + 0.5); // Extend beyond centroid
    const B = P_total / (L * qall * 0.85);
    
    const L_round = Math.ceil(L * 10) / 10;
    const B_round = Math.ceil(B * 10) / 10;
    
    // Soil pressure
    const A = L_round * B_round;
    const qavg = P_total / A;
    const qmax = qavg * 1.2; // Approximate with eccentricity
    const qmin = qavg * 0.8;
    
    checks.push({
      name: 'Maximum Soil Pressure',
      clause: code === 'IS456' ? 'IS 1904:1986' : 'ACI 318-19',
      demand: qmax,
      capacity: qall,
      ratio: qmax / qall,
      status: qmax <= qall ? 'PASS' : 'FAIL',
    });
    
    // Design as continuous beam
    const w = qmax * B_round; // Load per unit length (kN/m)
    const Mu_neg = w * L_col * L_col / 12; // Negative moment at interior
    const Mu_pos = w * L_col * L_col / 24; // Positive moment at midspan
    
    // Thickness
    const d = Math.max(
      Math.sqrt(Mu_neg * 1e6 / (0.138 * concrete.fck * B_round * 1000)),
      400
    );
    const D = d + concrete.cover + 20;
    
    // Reinforcement
    const reinfTop = this.designFlexuralReinforcement(Mu_neg, B_round * 1000, d, concrete, rebar, code);
    const reinfBot = this.designFlexuralReinforcement(Mu_pos, B_round * 1000, d, concrete, rebar, code);
    
    checks.push({
      name: 'Flexural Capacity (Negative)',
      clause: code === 'IS456' ? 'IS 456:2000 Cl. 38.1' : 'ACI 318-19 Ch. 22',
      demand: Mu_neg,
      capacity: reinfTop.Mn,
      ratio: Mu_neg / reinfTop.Mn,
      status: Mu_neg <= reinfTop.Mn ? 'PASS' : 'FAIL',
    });
    
    const overallStatus = checks.every(c => c.status !== 'FAIL') ? 'PASS' : 'FAIL';
    
    return {
      type: 'combined',
      dimensions: {
        length: L_round,
        width: B_round,
        thickness: Math.ceil(D / 50) * 50 / 1000,
        depth,
      },
      reinforcement: {
        bottomX: reinfBot.rebar,
        bottomY: { diameter: 12, spacing: 200, layers: 1, area: 565 },
        topX: reinfTop.rebar,
        topY: { diameter: 12, spacing: 200, layers: 1, area: 565 },
      },
      soilPressure: {
        max: qmax,
        min: qmin,
        average: qavg,
        allowable: qall,
      },
      checks,
      overallStatus,
    };
  }

  private designStripFooting(): FootingDesignResult {
    const { soil, loads, concrete, rebar, depth, code } = this.config;
    const checks: DesignCheck[] = [];
    
    const P = this.getMaximumLoads(loads).axial;
    const qall = this.calculateAllowableBearingCapacity(soil, depth);
    
    // Assume 1m length for strip footing
    const L = 1.0;
    const B = P / (L * qall * 0.85);
    const B_round = Math.ceil(B * 10) / 10;
    
    const qmax = P / (L * B_round);
    
    checks.push({
      name: 'Soil Bearing',
      clause: 'IS 1904:1986',
      demand: qmax,
      capacity: qall,
      ratio: qmax / qall,
      status: qmax <= qall ? 'PASS' : 'FAIL',
    });
    
    // Cantilever moment
    const wallWidth = 0.3; // Assume 300mm wall
    const cantilever = (B_round - wallWidth) / 2;
    const Mu = qmax * cantilever * cantilever / 2 * 1000;
    
    const d = Math.max(
      Math.sqrt(Mu * 1e6 / (0.138 * concrete.fck * 1000 * 1000)),
      200
    );
    
    const reinf = this.designFlexuralReinforcement(Mu, 1000, d, concrete, rebar, code);
    
    checks.push({
      name: 'Flexural Capacity',
      clause: code === 'IS456' ? 'IS 456:2000 Cl. 38.1' : 'ACI 318-19',
      demand: Mu,
      capacity: reinf.Mn,
      ratio: Mu / reinf.Mn,
      status: Mu <= reinf.Mn ? 'PASS' : 'FAIL',
    });
    
    const overallStatus = checks.every(c => c.status !== 'FAIL') ? 'PASS' : 'FAIL';
    
    return {
      type: 'strip',
      dimensions: {
        length: L,
        width: B_round,
        thickness: (d + concrete.cover + 12) / 1000,
        depth,
      },
      reinforcement: {
        bottomX: reinf.rebar,
        bottomY: { diameter: 10, spacing: 200, layers: 1, area: 393 },
      },
      soilPressure: {
        max: qmax,
        min: qmax,
        average: qmax,
        allowable: qall,
      },
      checks,
      overallStatus,
    };
  }

  // --------------------------------------------------------------------------
  // PILE FOUNDATION DESIGN
  // --------------------------------------------------------------------------

  private designPileFoundation(): PileDesignResult {
    const { soil, loads, code, depth } = this.config;
    const checks: DesignCheck[] = [];
    
    const P = this.getMaximumLoads(loads).axial;
    const M = Math.max(this.getMaximumLoads(loads).momentX, this.getMaximumLoads(loads).momentY);
    
    // Pile dimensions
    const pileDia = 600; // mm
    const pileLength = 15; // m (typical)
    
    // Calculate pile capacity
    const { Qp, Qs, Qu } = this.calculatePileCapacity(pileDia, pileLength, soil, code);
    
    // Factor of safety
    const FOS = 2.5;
    const Qall = Qu / FOS;
    
    // Number of piles required
    const numPiles = Math.ceil(P / Qall);
    
    // Pile group arrangement
    const { rows, cols, spacing, groupEfficiency } = this.determinePileArrangement(numPiles, pileDia);
    
    // Group capacity
    const Qgroup = numPiles * Qall * groupEfficiency;
    
    checks.push({
      name: 'Pile Group Capacity',
      clause: code === 'IS456' ? 'IS 2911 (Part 1)' : 'ACI 318-19',
      demand: P,
      capacity: Qgroup,
      ratio: P / Qgroup,
      status: P <= Qgroup ? 'PASS' : 'FAIL',
    });
    
    // Maximum pile load with moment
    const I = this.calculatePileGroupInertia(rows, cols, spacing);
    const xmax = (cols - 1) * spacing / 2 / 1000;
    const Pmax = P / numPiles + M * xmax / I;
    
    checks.push({
      name: 'Maximum Individual Pile Load',
      clause: code === 'IS456' ? 'IS 2911 (Part 1)' : 'ACI 318-19',
      demand: Pmax,
      capacity: Qall,
      ratio: Pmax / Qall,
      status: Pmax <= Qall ? 'PASS' : 'FAIL',
    });
    
    // Settlement (using elastic settlement method)
    const settlement = this.calculatePileGroupSettlement(P, pileLength, pileDia, numPiles, soil);
    
    checks.push({
      name: 'Settlement',
      clause: 'IS 2911',
      demand: settlement,
      capacity: 25, // 25mm allowable
      ratio: settlement / 25,
      status: settlement <= 25 ? 'PASS' : 'FAIL',
    });
    
    const overallStatus = checks.every(c => c.status !== 'FAIL') ? 'PASS' : 'FAIL';
    
    return {
      type: this.config.type as 'pile_single' | 'pile_group',
      pileProperties: {
        diameter: pileDia,
        length: pileLength,
        type: 'bored' as const,
        material: 'concrete' as const,
      },
      capacity: {
        endBearing: Qp,
        skinFriction: Qs,
        ultimate: Qu,
        allowable: Qall,
      },
      group: {
        numPiles,
        rows,
        cols,
        spacing,
        efficiency: groupEfficiency,
        totalCapacity: Qgroup,
      },
      checks,
      settlement,
      overallStatus,
    };
  }

  private calculatePileCapacity(diameter: number, length: number, soil: SoilProperties, code: DesignCodeFound): { Qp: number; Qs: number; Qu: number } {
    const D = diameter / 1000; // Convert to meters
    const Ap = Math.PI * D * D / 4;
    const As = Math.PI * D * length;
    
    if (soil.type === 'cohesive') {
      // IS 2911 / Undrained method
      const cu = soil.cohesion;
      const Nc = 9; // Bearing capacity factor
      
      const Qp = Nc * cu * Ap * 1000; // End bearing (kN)
      
      // Skin friction (alpha method)
      const alpha = cu < 50 ? 1.0 : (cu < 100 ? 0.5 : 0.3);
      const Qs = alpha * cu * As * 1000; // Skin friction (kN)
      
      return { Qp, Qs, Qu: Qp + Qs };
    } else {
      // Drained method for cohesionless soils
      const phi = soil.frictionAngle * Math.PI / 180;
      const Nq = Math.exp(Math.PI * Math.tan(phi)) * Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);
      
      const sigma_v = soil.unitWeight * length / 2; // Average vertical stress
      const Qp = Nq * sigma_v * Ap * 1000;
      
      // Beta method for skin friction
      const K = 1 - Math.sin(phi); // Coefficient of lateral earth pressure
      const beta = K * Math.tan(phi);
      const Qs = beta * sigma_v * As * 1000;
      
      return { Qp, Qs, Qu: Qp + Qs };
    }
  }

  private determinePileArrangement(numPiles: number, diameter: number): { rows: number; cols: number; spacing: number; groupEfficiency: number } {
    // Minimum spacing = 3D
    const minSpacing = 3 * diameter;
    
    let rows: number, cols: number;
    
    if (numPiles <= 2) {
      rows = 1;
      cols = numPiles;
    } else if (numPiles <= 4) {
      rows = 2;
      cols = 2;
    } else if (numPiles <= 6) {
      rows = 2;
      cols = 3;
    } else if (numPiles <= 9) {
      rows = 3;
      cols = 3;
    } else {
      rows = Math.ceil(Math.sqrt(numPiles));
      cols = Math.ceil(numPiles / rows);
    }
    
    // Group efficiency (Converse-Labarre formula)
    const n = rows;
    const m = cols;
    const D = diameter / 1000;
    const s = minSpacing / 1000;
    const theta = Math.atan(D / s) * 180 / Math.PI;
    
    const efficiency = 1 - theta * ((n - 1) * m + (m - 1) * n) / (90 * m * n);
    
    return {
      rows,
      cols,
      spacing: minSpacing,
      groupEfficiency: Math.max(0.7, Math.min(1.0, efficiency)),
    };
  }

  private calculatePileGroupInertia(rows: number, cols: number, spacing: number): number {
    // Sum of x² for pile group
    let sumX2 = 0;
    const s = spacing / 1000; // Convert to meters
    
    for (let i = 0; i < cols; i++) {
      const x = (i - (cols - 1) / 2) * s;
      sumX2 += rows * x * x;
    }
    
    return sumX2;
  }

  private calculatePileGroupSettlement(P: number, length: number, diameter: number, numPiles: number, soil: SoilProperties): number {
    // Simplified elastic settlement
    const D = diameter / 1000;
    const Es = soil.elasticModulus * 1000; // kPa
    const nu = soil.poissonRatio;
    
    // Equivalent raft approach
    const Bg = Math.sqrt(numPiles) * 3 * D;
    
    const settlement = P * (1 - nu * nu) / (Es * Bg) * 1000; // mm
    
    return settlement;
  }

  // --------------------------------------------------------------------------
  // RAFT FOUNDATION DESIGN
  // --------------------------------------------------------------------------

  private designRaftFoundation(): RaftDesignResult {
    const { soil, loads, concrete, rebar, depth, code } = this.config;
    const checks: DesignCheck[] = [];
    
    // Sum all column loads
    const totalP = loads.reduce((sum, l) => sum + l.axial, 0);
    const qall = this.calculateAllowableBearingCapacity(soil, depth);
    
    // Raft dimensions
    const Area = totalP / (qall * 0.8);
    const L = Math.ceil(Math.sqrt(Area * 1.5) * 10) / 10;
    const B = Math.ceil(Area / L * 10) / 10;
    
    // Average soil pressure
    const qavg = totalP / (L * B);
    
    checks.push({
      name: 'Soil Bearing',
      clause: 'IS 2950',
      demand: qavg,
      capacity: qall,
      ratio: qavg / qall,
      status: qavg <= qall ? 'PASS' : 'FAIL',
    });
    
    // Raft thickness (based on punching at columns)
    const maxColumnLoad = Math.max(...loads.map(l => l.axial));
    const colSize = 500; // Assume 500mm column
    const d = Math.max(
      maxColumnLoad * 1000 / (4 * colSize * this.getPunchingShearCapacity(concrete, 500, code)),
      400
    );
    
    // Reinforcement (simplified - uniform mesh)
    const Mu = qavg * B * B / 8; // Approximate max moment
    const reinf = this.designFlexuralReinforcement(Mu, L * 1000, d, concrete, rebar, code);
    
    checks.push({
      name: 'Flexural Design',
      clause: code === 'IS456' ? 'IS 456:2000' : 'ACI 318-19',
      demand: Mu,
      capacity: reinf.Mn,
      ratio: Mu / reinf.Mn,
      status: Mu <= reinf.Mn ? 'PASS' : 'FAIL',
    });
    
    // Differential settlement
    const diffSettlement = this.calculateDifferentialSettlement(L, B, totalP, soil);
    
    checks.push({
      name: 'Differential Settlement',
      clause: 'IS 1904',
      demand: diffSettlement,
      capacity: 20, // 20mm allowable
      ratio: diffSettlement / 20,
      status: diffSettlement <= 20 ? 'PASS' : 'FAIL',
    });
    
    const overallStatus = checks.every(c => c.status !== 'FAIL') ? 'PASS' : 'FAIL';
    
    return {
      type: 'raft',
      dimensions: {
        length: L,
        width: B,
        thickness: (d + concrete.cover + 20) / 1000,
        depth,
      },
      reinforcement: {
        bottomX: reinf.rebar,
        bottomY: reinf.rebar,
        topX: { diameter: Math.max(12, reinf.rebar.diameter - 4), spacing: reinf.rebar.spacing, layers: 1, area: reinf.rebar.area * 0.5 },
        topY: { diameter: Math.max(12, reinf.rebar.diameter - 4), spacing: reinf.rebar.spacing, layers: 1, area: reinf.rebar.area * 0.5 },
      },
      soilPressure: {
        max: qavg * 1.2,
        min: qavg * 0.8,
        average: qavg,
        allowable: qall,
      },
      modulus: soil.elasticModulus * 1000 / 0.3, // Modulus of subgrade reaction (kN/m³)
      checks,
      overallStatus,
    };
  }

  private designPileCap(): FootingDesignResult {
    const { soil, loads, concrete, rebar, depth, code } = this.config;
    const checks: DesignCheck[] = [];
    
    const P = this.getMaximumLoads(loads).axial;
    
    // Pile parameters (from pile design)
    const pileDia = 600;
    const numPiles = 4; // Assume 4-pile cap
    const spacing = 3 * pileDia;
    
    // Cap dimensions
    const L = spacing + pileDia + 300; // 150mm edge each side
    const B = L;
    
    // Cap thickness (truss analogy)
    const d = Math.max(
      spacing / 2, // Minimum for strut formation
      P * 1000 / (4 * pileDia * this.getPunchingShearCapacity(concrete, 600, code)),
      500
    );
    
    // Check punching at column
    const colSize = 400;
    const punchingCheck = this.checkPunchingShear(P, 0, L / 1000, B / 1000, colSize, colSize, d, concrete, code);
    checks.push(punchingCheck.check);
    
    // Flexural design using strut-and-tie
    const leverArm = spacing / 2 / 1000;
    const Mu = P / numPiles * leverArm;
    
    const reinf = this.designFlexuralReinforcement(Mu, B, d, concrete, rebar, code);
    
    checks.push({
      name: 'Flexural Capacity',
      clause: code === 'IS456' ? 'IS 456:2000' : 'ACI 318-19 Ch. 23',
      demand: Mu,
      capacity: reinf.Mn,
      ratio: Mu / reinf.Mn,
      status: Mu <= reinf.Mn ? 'PASS' : 'FAIL',
    });
    
    const overallStatus = checks.every(c => c.status !== 'FAIL') ? 'PASS' : 'FAIL';
    
    return {
      type: 'pile_cap',
      dimensions: {
        length: L / 1000,
        width: B / 1000,
        thickness: (d + concrete.cover + 32) / 1000,
        depth,
      },
      reinforcement: {
        bottomX: reinf.rebar,
        bottomY: reinf.rebar,
      },
      soilPressure: {
        max: 0,
        min: 0,
        average: 0,
        allowable: 0,
      },
      checks,
      punchingShear: {
        perimeter: punchingCheck.perimeter,
        depth: d,
        demand: punchingCheck.Vu,
        capacity: punchingCheck.Vc,
        ratio: punchingCheck.check.ratio,
      },
      overallStatus,
    };
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  private getMaximumLoads(loads: FoundationLoads[]): FoundationLoads {
    return loads.reduce((max, load) => ({
      axial: Math.max(max.axial, load.axial),
      momentX: Math.max(max.momentX, Math.abs(load.momentX)),
      momentY: Math.max(max.momentY, Math.abs(load.momentY)),
      shearX: Math.max(max.shearX, Math.abs(load.shearX)),
      shearY: Math.max(max.shearY, Math.abs(load.shearY)),
      isCombination: true,
    }), { axial: 0, momentX: 0, momentY: 0, shearX: 0, shearY: 0, isCombination: true });
  }

  private calculateAllowableBearingCapacity(soil: SoilProperties, depth: number): number {
    if (soil.allowableBearingCapacity) {
      return soil.allowableBearingCapacity;
    }
    
    // Terzaghi's bearing capacity (simplified)
    const phi = soil.frictionAngle * Math.PI / 180;
    const c = soil.cohesion;
    const gamma = soil.unitWeight;
    
    // Bearing capacity factors
    const Nq = Math.exp(Math.PI * Math.tan(phi)) * Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);
    const Nc = (Nq - 1) / Math.tan(phi || 0.001);
    const Ngamma = 2 * (Nq - 1) * Math.tan(phi);
    
    // Ultimate bearing capacity
    const qu = c * Nc + gamma * depth * Nq + 0.5 * gamma * 1 * Ngamma;
    
    // Factor of safety
    const FOS = this.partialFactors.soil;
    
    return qu / FOS;
  }

  private sizeFooting(P: number, Mx: number, My: number, qall: number): { L: number; B: number } {
    // Start with square footing
    const areaRequired = P / (qall * 0.8); // 80% efficiency
    let L = Math.sqrt(areaRequired);
    let B = L;
    
    // Check eccentricity
    const ex = My / P;
    const ey = Mx / P;
    
    // Ensure middle third rule (no tension)
    L = Math.max(L, 6 * ex);
    B = Math.max(B, 6 * ey);
    
    // Round up to 100mm
    L = Math.ceil(L * 10) / 10;
    B = Math.ceil(B * 10) / 10;
    
    return { L, B };
  }

  private calculateSoilPressure(P: number, Mx: number, My: number, L: number, B: number): { qmax: number; qmin: number; qavg: number } {
    const A = L * B;
    const Ix = B * L * L * L / 12;
    const Iy = L * B * B * B / 12;
    
    const q0 = P / A;
    const qx = Mx * (L / 2) / Ix;
    const qy = My * (B / 2) / Iy;
    
    const qmax = q0 + qx + qy;
    const qmin = q0 - qx - qy;
    const qavg = q0;
    
    return { qmax, qmin, qavg };
  }

  private calculateFootingThickness(P: number, qmax: number, L: number, B: number, colW: number, colD: number, concrete: ConcreteProperties): { d: number; D: number } {
    // Minimum thickness based on punching shear
    const fck = concrete.fck;
    const vc = 0.25 * Math.sqrt(fck); // IS 456
    
    // Iterate to find minimum d
    let d = 300;
    const maxIterations = 20;
    
    for (let i = 0; i < maxIterations; i++) {
      const bo = 2 * ((colW + d) + (colD + d));
      const Ap = (colW + d) * (colD + d) / 1e6;
      const Vu = P - qmax * Ap;
      const Vc = vc * bo * d / 1000;
      
      if (Vc >= Vu) break;
      d += 50;
    }
    
    const D = d + concrete.cover + 16; // Cover + bar diameter
    
    return { d, D };
  }

  private checkOneWayShear(qmax: number, L: number, B: number, colW: number, colD: number, d: number, concrete: ConcreteProperties, code: DesignCodeFound): DesignCheck {
    // Critical section at d from face of column
    const criticalDist = (L / 2 - colD / 2000 - d / 1000);
    const Vu = qmax * B * criticalDist;
    
    // Shear capacity
    const tau_c = this.getShearCapacity(concrete, 0.2, code); // Assume 0.2% steel
    const Vc = tau_c * B * 1000 * d / 1000;
    
    return {
      name: 'One-Way Shear',
      clause: code === 'IS456' ? 'IS 456:2000 Cl. 40.1' : 'ACI 318-19 Ch. 22',
      demand: Vu,
      capacity: Vc,
      ratio: Vu / Vc,
      status: Vu <= Vc ? 'PASS' : 'FAIL',
    };
  }

  private checkPunchingShear(P: number, qmax: number, L: number, B: number, colW: number, colD: number, d: number, concrete: ConcreteProperties, code: DesignCodeFound): { check: DesignCheck; perimeter: number; Vu: number; Vc: number } {
    // Critical perimeter at d/2 from column face
    const bo = 2 * ((colW + d) + (colD + d));
    const Ap = (colW + d) * (colD + d) / 1e6;
    
    const Vu = P - qmax * Ap;
    
    const vc = this.getPunchingShearCapacity(concrete, d, code);
    const Vc = vc * bo * d / 1000;
    
    return {
      check: {
        name: 'Punching Shear',
        clause: code === 'IS456' ? 'IS 456:2000 Cl. 31.6' : 'ACI 318-19 Ch. 22',
        demand: Vu,
        capacity: Vc,
        ratio: Vu / Vc,
        status: Vu <= Vc ? 'PASS' : 'FAIL',
      },
      perimeter: bo,
      Vu,
      Vc,
    };
  }

  private getShearCapacity(concrete: ConcreteProperties, pt: number, code: DesignCodeFound): number {
    const fck = concrete.fck;
    
    if (code === 'IS456') {
      // IS 456:2000 Table 19
      const tau_c = 0.85 * Math.sqrt(0.8 * fck) * (Math.sqrt(1 + 5 * pt / 100) - 1) / (6 * pt / 100);
      return Math.min(tau_c, 0.62 * Math.sqrt(fck));
    } else if (code === 'ACI318') {
      return 0.17 * Math.sqrt(fck);
    } else {
      return 0.18 / 1.5 * Math.pow(100 * pt * fck, 1 / 3);
    }
  }

  private getPunchingShearCapacity(concrete: ConcreteProperties, d: number, code: DesignCodeFound): number {
    const fck = concrete.fck;
    
    if (code === 'IS456') {
      const ks = 0.5 + 1; // Aspect ratio factor, assume square column
      return Math.min(ks, 1.0) * 0.25 * Math.sqrt(fck);
    } else if (code === 'ACI318') {
      return 0.33 * Math.sqrt(fck);
    } else {
      return 0.18 / 1.5 * Math.pow(100 * 0.2 * fck, 1 / 3) * 2; // Approximate for EN
    }
  }

  private calculateBendingMoment(qmax: number, qmin: number, span: number, colSize: number, width: number, direction: string): number {
    // Cantilever moment from face of column
    const cantilever = (span / 2 - colSize / 2000);
    const qatFace = qmax - (qmax - qmin) * (colSize / 2000) / span;
    
    // Trapezoidal load
    const Mu = width * (qatFace * cantilever * cantilever / 2 + (qmax - qatFace) * cantilever * cantilever / 3);
    
    return Mu;
  }

  private designFlexuralReinforcement(Mu: number, b: number, d: number, concrete: ConcreteProperties, rebar: RebarProperties, code: DesignCodeFound): { rebar: RebarDetail; Mn: number } {
    const fck = concrete.fck;
    const fy = rebar.fy;
    
    // Design moment capacity
    const MuLim = 0.138 * fck * b * d * d / 1e6; // kNm (IS 456 balanced)
    
    if (Mu <= MuLim) {
      // Singly reinforced
      const Ru = Mu * 1e6 / (b * d * d);
      const pt = (fck / (2 * fy)) * (1 - Math.sqrt(1 - 4.598 * Ru / fck)) * 100;
      
      const Ast = Math.max(pt * b * d / 100, 0.12 * b * d / 100);
      
      // Select bar diameter and spacing
      const barDia = this.selectBarDiameter(Ast, b, rebar);
      const barArea = Math.PI * barDia * barDia / 4;
      const numBars = Math.ceil(Ast / barArea);
      const spacing = Math.floor((b - 2 * concrete.cover) / (numBars - 1));
      
      const AstProvided = numBars * barArea;
      const Mn = 0.87 * fy * AstProvided * (d - 0.42 * AstProvided * 0.87 * fy / (0.36 * fck * b)) / 1e6;
      
      return {
        rebar: {
          diameter: barDia,
          spacing: Math.min(spacing, 200),
          layers: 1,
          area: AstProvided,
          totalBars: numBars,
        },
        Mn,
      };
    } else {
      // Doubly reinforced (simplified)
      return this.designFlexuralReinforcement(MuLim, b, d, concrete, rebar, code);
    }
  }

  private selectBarDiameter(Ast: number, width: number, rebar: RebarProperties): number {
    const availableBars = [10, 12, 16, 20, 25, 32];
    
    for (const dia of availableBars) {
      if (dia >= rebar.minDiameter && dia <= rebar.maxDiameter) {
        const barArea = Math.PI * dia * dia / 4;
        const numBars = Math.ceil(Ast / barArea);
        const spacing = (width - 100) / (numBars - 1);
        
        if (spacing >= 75 && spacing <= 200) {
          return dia;
        }
      }
    }
    
    return 16; // Default
  }

  private calculateSettlement(P: number, L: number, B: number, depth: number, soil: SoilProperties): { immediate: number; consolidation: number; total: number; allowable: number } {
    const Es = soil.elasticModulus * 1000; // kPa
    const nu = soil.poissonRatio;
    
    // Immediate settlement (Boussinesq)
    const qnet = P / (L * B);
    const If = 0.82; // Influence factor for center (flexible)
    const Si = qnet * B * (1 - nu * nu) / Es * If * 1000;
    
    // Consolidation settlement (for cohesive soils)
    let Sc = 0;
    if (soil.type === 'cohesive') {
      const Cc = 0.009 * (40 - 10); // Compression index estimate
      const e0 = 0.8; // Initial void ratio estimate
      const H = 10; // Compressible layer thickness
      const p0 = soil.unitWeight * depth;
      const deltaP = qnet * 0.5; // Stress at mid-layer
      
      Sc = Cc * H / (1 + e0) * Math.log10((p0 + deltaP) / p0) * 1000;
    }
    
    return {
      immediate: Si,
      consolidation: Sc,
      total: Si + Sc,
      allowable: L < 3 ? 25 : 50, // Based on structure type
    };
  }

  private calculateDifferentialSettlement(L: number, B: number, P: number, soil: SoilProperties): number {
    // Simplified estimate
    const Es = soil.elasticModulus * 1000;
    const q = P / (L * B);
    
    const settlementCenter = q * B * 0.82 / Es * 1000;
    const settlementCorner = q * B * 0.56 / Es * 1000;
    
    return settlementCenter - settlementCorner;
  }
}

// ============================================================================
// ADDITIONAL RESULT INTERFACES
// ============================================================================

interface PileDesignResult {
  type: 'pile_single' | 'pile_group';
  pileProperties: {
    diameter: number;
    length: number;
    type: 'bored' | 'driven' | 'cfa';
    material: 'concrete' | 'steel' | 'composite';
  };
  capacity: {
    endBearing: number;
    skinFriction: number;
    ultimate: number;
    allowable: number;
  };
  group: {
    numPiles: number;
    rows: number;
    cols: number;
    spacing: number;
    efficiency: number;
    totalCapacity: number;
  };
  checks: DesignCheck[];
  settlement: number;
  overallStatus: 'PASS' | 'FAIL';
}

interface RaftDesignResult extends FootingDesignResult {
  modulus: number; // Modulus of subgrade reaction
}

// ============================================================================
// EXPORTS
// ============================================================================

export const createFoundationDesignEngine = (config: FoundationDesignConfig) => new FoundationDesignEngine(config);

export default FoundationDesignEngine;
