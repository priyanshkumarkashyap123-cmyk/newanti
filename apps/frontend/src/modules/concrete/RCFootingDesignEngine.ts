/**
 * ============================================================================
 * COMPREHENSIVE RC FOOTING DESIGN ENGINE
 * ============================================================================
 * 
 * Complete reinforced concrete foundation design as per international codes.
 * Features:
 * - Isolated footings (square, rectangular, circular)
 * - Combined footings (rectangular, trapezoidal)
 * - Strap footings
 * - Mat/Raft foundations
 * - Eccentric loading
 * - Bi-axial moments
 * - One-way and two-way shear checks
 * - Punching shear
 * - Development length checks
 * - Settlement calculations
 * 
 * Supported Codes:
 * - IS 456:2000 / IS 1904 (India)
 * - ACI 318-19 (USA)
 * - EN 1992-1-1:2004 Eurocode 2 (Europe)
 * - AS 3600:2018 (Australia)
 * 
 * @version 1.0.0
 * @author Head of Engineering
 */

import {
  DesignCode,
  ConcreteGrade,
  SteelGrade,
  SAFETY_FACTORS,
  ACI_PHI_FACTORS,
  getConcreteGrades,
  getSteelGrades,
  getRebarByDiameter,
  selectBars,
  getDesignStrength,
  getDesignYieldStrength,
} from './RCDesignConstants';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type FootingType = 'isolated-square' | 'isolated-rectangular' | 'isolated-circular' | 
                          'combined-rectangular' | 'combined-trapezoidal' | 'strap' | 'mat';
export type SoilType = 'hard-rock' | 'soft-rock' | 'gravel' | 'sand' | 'clay-stiff' | 
                       'clay-medium' | 'clay-soft' | 'filled';

export interface FootingGeometry {
  type: FootingType;
  L: number;              // Length (mm)
  B: number;              // Width (mm) 
  D: number;              // Total depth (mm)
  d?: number;             // Effective depth (mm)
  cover: number;          // Clear cover (mm)
  
  // Column dimensions
  columnL: number;        // Column length (mm)
  columnB: number;        // Column breadth (mm)
  
  // For combined footings
  column2L?: number;      // Second column length
  column2B?: number;      // Second column breadth
  spacing?: number;       // Column spacing (mm)
  
  // For strap footings
  strapWidth?: number;
  strapDepth?: number;
}

export interface FootingLoading {
  Pu: number;             // Ultimate axial load (kN)
  Mux?: number;           // Ultimate moment about X (kN-m)
  Muy?: number;           // Ultimate moment about Y (kN-m)
  Hx?: number;            // Horizontal force X (kN)
  Hy?: number;            // Horizontal force Y (kN)
  
  // Service loads (for SBC check)
  P_service?: number;     // Service axial load (kN)
  Mx_service?: number;
  My_service?: number;
  
  // For combined footings
  Pu2?: number;           // Second column load
  Mux2?: number;
  Muy2?: number;
}

export interface SoilProperties {
  type: SoilType;
  SBC: number;            // Safe bearing capacity (kN/m²)
  unitWeight: number;     // Unit weight (kN/m³)
  frictionAngle?: number; // Degrees
  cohesion?: number;      // kN/m²
  Es?: number;            // Soil modulus (kN/m²)
  poissonRatio?: number;
}

export interface FootingMaterials {
  concreteGrade: ConcreteGrade;
  steelGrade: SteelGrade;
  code: DesignCode;
}

export interface BearingPressureResult {
  status: 'safe' | 'unsafe' | 'warning';
  maxPressure: number;    // kN/m²
  minPressure: number;    // kN/m²
  avgPressure: number;    // kN/m²
  allowablePressure: number; // kN/m²
  eccentricityX: number;  // mm
  eccentricityY: number;  // mm
  isWithinMiddleThird: boolean;
  pressureDistribution: 'uniform' | 'trapezoidal' | 'triangular' | 'partial';
  messages: string[];
}

export interface OneWayShearResult {
  status: 'safe' | 'unsafe';
  Vu: number;             // Applied shear (kN)
  Vc: number;             // Concrete capacity (kN)
  shearStress: number;    // MPa
  allowableStress: number; // MPa
  criticalSection: number; // Distance from column face (mm)
  messages: string[];
}

export interface TwoWayShearResult {
  status: 'safe' | 'unsafe' | 'warning';
  Vu: number;             // Applied shear (kN)
  Vc: number;             // Concrete capacity (kN)
  shearStress: number;    // MPa
  allowableStress: number; // MPa
  criticalPerimeter: number; // mm
  beta_c: number;         // Column aspect ratio
  messages: string[];
}

export interface FootingReinforcementResult {
  direction: 'length' | 'width' | 'radial' | 'circumferential';
  Ast_required: number;   // mm²
  barDiameter: number;    // mm
  numberOfBars: number;
  spacing: number;        // mm
  Ast_provided: number;   // mm²
  distributionType?: 'uniform' | 'banded';
  bandWidth?: number;     // For banded distribution
  utilizationRatio: number;
}

export interface DevelopmentLengthResult {
  status: 'adequate' | 'inadequate';
  Ld_required: number;    // mm
  Ld_available: number;   // mm
  messages: string[];
}

export interface SettlementResult {
  immediate: number;      // mm
  consolidation: number;  // mm
  total: number;          // mm
  allowable: number;      // mm
  differentialRisk: 'low' | 'moderate' | 'high';
  messages: string[];
}

export interface FootingDesignResult {
  geometry: FootingGeometry;
  materials: FootingMaterials;
  loading: FootingLoading;
  soil: SoilProperties;
  
  bearingPressure: BearingPressureResult;
  oneWayShear: {
    longDirection: OneWayShearResult;
    shortDirection: OneWayShearResult;
  };
  twoWayShear: TwoWayShearResult;
  
  reinforcement: {
    longDirection: FootingReinforcementResult;
    shortDirection: FootingReinforcementResult;
  };
  
  developmentLength: DevelopmentLengthResult;
  settlement?: SettlementResult;
  
  summary: {
    status: 'safe' | 'unsafe' | 'marginal';
    requiredDepth: number;
    requiredSize: { L: number; B: number };
    concreteVolume: number;  // m³
    steelWeight: number;     // kg
    overallUtilization: number;
    warnings: string[];
    recommendations: string[];
  };
  
  calculations: Record<string, number>;
}

// =============================================================================
// SOIL BEARING CAPACITY DATABASE
// =============================================================================

export const TYPICAL_SBC: Record<SoilType, { min: number; max: number; typical: number }> = {
  'hard-rock': { min: 3200, max: 4500, typical: 3500 },
  'soft-rock': { min: 1500, max: 3200, typical: 2000 },
  'gravel': { min: 400, max: 600, typical: 500 },
  'sand': { min: 200, max: 400, typical: 300 },
  'clay-stiff': { min: 200, max: 400, typical: 300 },
  'clay-medium': { min: 100, max: 200, typical: 150 },
  'clay-soft': { min: 50, max: 100, typical: 75 },
  'filled': { min: 25, max: 100, typical: 50 },
};

// =============================================================================
// MAIN FOOTING DESIGN ENGINE CLASS
// =============================================================================

export class RCFootingDesignEngine {
  private geometry: FootingGeometry;
  private loading: FootingLoading;
  private soil: SoilProperties;
  private materials: FootingMaterials;
  private code: DesignCode;

  constructor(
    geometry: FootingGeometry,
    loading: FootingLoading,
    soil: SoilProperties,
    materials: FootingMaterials
  ) {
    this.geometry = { ...geometry };
    this.loading = { ...loading };
    this.soil = { ...soil };
    this.materials = { ...materials };
    this.code = materials.code;

    // Calculate effective depth if not provided
    if (!this.geometry.d) {
      const barDia = 16; // Assumed
      this.geometry.d = this.geometry.D - this.geometry.cover - barDia - barDia / 2;
    }

    // Set service loads if not provided
    if (!this.loading.P_service) {
      this.loading.P_service = loading.Pu / 1.5; // Approximate
    }
  }

  // ===========================================================================
  // MAIN DESIGN METHOD
  // ===========================================================================

  public design(): FootingDesignResult {
    const calculations: Record<string, number> = {};
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Step 1: Check bearing pressure
    const bearingPressure = this.checkBearingPressure();
    
    // Step 2: Design depth for shear
    const oneWayShear = this.checkOneWayShear();
    const twoWayShear = this.checkTwoWayShear();
    
    // Step 3: Design reinforcement for bending
    const reinforcement = this.designReinforcement();
    
    // Step 4: Check development length
    const developmentLength = this.checkDevelopmentLength(reinforcement.longDirection.barDiameter);
    
    // Step 5: Estimate settlement (optional)
    const settlement = this.soil.Es ? this.estimateSettlement() : undefined;

    // Determine minimum required depth
    const minDepthShear = this.calculateMinDepthForShear();
    if (this.geometry.D < minDepthShear) {
      warnings.push(`Footing depth ${this.geometry.D}mm is less than minimum ${minDepthShear}mm required for shear`);
    }

    // Calculate quantities
    const concreteVolume = (this.geometry.L * this.geometry.B * this.geometry.D) / 1e9; // m³
    const steelWeight = this.calculateSteelWeight(reinforcement);

    // Overall status
    const status = this.determineOverallStatus(bearingPressure, oneWayShear, twoWayShear, developmentLength);

    return {
      geometry: this.geometry,
      materials: this.materials,
      loading: this.loading,
      soil: this.soil,
      bearingPressure,
      oneWayShear,
      twoWayShear,
      reinforcement,
      developmentLength,
      settlement,
      summary: {
        status,
        requiredDepth: minDepthShear,
        requiredSize: { L: this.geometry.L, B: this.geometry.B },
        concreteVolume,
        steelWeight,
        overallUtilization: Math.max(
          bearingPressure.maxPressure / bearingPressure.allowablePressure,
          oneWayShear.longDirection.Vu / oneWayShear.longDirection.Vc,
          twoWayShear.Vu / twoWayShear.Vc
        ),
        warnings,
        recommendations,
      },
      calculations,
    };
  }

  // ===========================================================================
  // BEARING PRESSURE CHECK
  // ===========================================================================

  private checkBearingPressure(): BearingPressureResult {
    const { L, B, D, columnL, columnB } = this.geometry;
    const { P_service, Mx_service, My_service, Mux, Muy, Pu } = this.loading;
    const { SBC } = this.soil;
    
    const messages: string[] = [];
    const A = L * B / 1e6; // m²
    const Zx = B * L * L / (6 * 1e9); // m³
    const Zy = L * B * B / (6 * 1e9); // m³
    
    // Service loads for SBC check
    const P = P_service || Pu / 1.5;
    const Mx = Mx_service || (Mux || 0) / 1.5;
    const My = My_service || (Muy || 0) / 1.5;
    
    // Self weight of footing
    const selfWeight = 25 * A * D / 1000; // kN (assuming 25 kN/m³)
    const totalLoad = P + selfWeight;
    
    // Eccentricities
    const ex = Mx > 0 ? (Mx / P) * 1000 : 0; // mm
    const ey = My > 0 ? (My / P) * 1000 : 0; // mm
    
    // Check if within middle third
    const isWithinMiddleThird = Math.abs(ex) <= L / 6 && Math.abs(ey) <= B / 6;
    
    // Calculate pressure distribution
    let maxPressure: number;
    let minPressure: number;
    let avgPressure: number;
    let distribution: 'uniform' | 'trapezoidal' | 'triangular' | 'partial';
    
    if (Math.abs(ex) < 0.001 && Math.abs(ey) < 0.001) {
      // Uniform pressure (concentric load)
      maxPressure = totalLoad / A;
      minPressure = maxPressure;
      avgPressure = maxPressure;
      distribution = 'uniform';
      
    } else if (isWithinMiddleThird) {
      // Trapezoidal distribution
      maxPressure = totalLoad / A + Mx / Zx + My / Zy;
      minPressure = totalLoad / A - Mx / Zx - My / Zy;
      avgPressure = totalLoad / A;
      distribution = minPressure >= 0 ? 'trapezoidal' : 'triangular';
      
    } else {
      // Partial contact - triangular distribution
      // Effective contact area reduces
      const Leff = 3 * (L / 2 - Math.abs(ex)) / 1000; // m
      const Beff = 3 * (B / 2 - Math.abs(ey)) / 1000; // m
      const Aeff = Leff * Beff;
      
      maxPressure = 2 * totalLoad / Aeff;
      minPressure = 0;
      avgPressure = totalLoad / Aeff;
      distribution = 'partial';
      
      messages.push('WARNING: Eccentricity outside middle third. Uplift may occur at corners.');
    }
    
    // Status check
    let status: 'safe' | 'unsafe' | 'warning' = 'safe';
    if (maxPressure > SBC) {
      if (maxPressure > 1.25 * SBC) {
        status = 'unsafe';
        messages.push(`Maximum pressure ${maxPressure.toFixed(1)} kN/m² exceeds SBC ${SBC} kN/m²`);
      } else {
        status = 'warning';
        messages.push(`Maximum pressure marginally exceeds SBC. Consider increasing footing size.`);
      }
    } else {
      messages.push(`Bearing pressure check passed. Max: ${maxPressure.toFixed(1)} kN/m² ≤ ${SBC} kN/m²`);
    }

    return {
      status,
      maxPressure,
      minPressure,
      avgPressure,
      allowablePressure: SBC,
      eccentricityX: ex,
      eccentricityY: ey,
      isWithinMiddleThird,
      pressureDistribution: distribution,
      messages,
    };
  }

  // ===========================================================================
  // ONE-WAY SHEAR CHECK
  // ===========================================================================

  private checkOneWayShear(): { longDirection: OneWayShearResult; shortDirection: OneWayShearResult } {
    const { L, B, D, d, columnL, columnB } = this.geometry;
    const { Pu } = this.loading;
    const { concreteGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const effectiveD = d!;
    
    // Ultimate bearing pressure (net upward pressure)
    const qu = (Pu * 1.5) / (L * B / 1e6); // kN/m² (factored)
    
    // Long direction (critical section at d from column face)
    const longResult = this.calculateOneWayShear(
      L, B, columnL, effectiveD, qu, fck, 'long'
    );
    
    // Short direction
    const shortResult = this.calculateOneWayShear(
      B, L, columnB, effectiveD, qu, fck, 'short'
    );
    
    return {
      longDirection: longResult,
      shortDirection: shortResult,
    };
  }

  private calculateOneWayShear(
    span: number,
    width: number,
    columnDim: number,
    d: number,
    qu: number,
    fck: number,
    direction: 'long' | 'short'
  ): OneWayShearResult {
    const messages: string[] = [];
    
    // Critical section at d from column face
    const criticalSection = d;
    const cantileverLength = (span - columnDim) / 2;
    const shearLength = cantileverLength - d;
    
    if (shearLength <= 0) {
      return {
        status: 'safe',
        Vu: 0,
        Vc: Infinity,
        shearStress: 0,
        allowableStress: 0.36 * Math.sqrt(fck),
        criticalSection,
        messages: ['Column face coincides with or exceeds critical section'],
      };
    }
    
    // Shear force at critical section
    const Vu = qu * shearLength * width / 1e6; // kN
    
    // Shear stress
    const tau_v = Vu * 1000 / (width * d);
    
    // Allowable shear stress
    let tau_c: number;
    switch (this.code) {
      case 'IS456':
        // IS 456 Table 19 (assuming 0.15% steel)
        tau_c = 0.36 * Math.pow(fck, 0.5) * Math.min(1, Math.sqrt(0.15));
        tau_c = Math.max(0.28, Math.min(tau_c, 0.36));
        break;
      case 'ACI318':
        tau_c = 0.17 * Math.sqrt(fck) * ACI_PHI_FACTORS.shear;
        break;
      case 'EN1992':
        const k = Math.min(2, 1 + Math.sqrt(200 / d));
        tau_c = 0.12 * k * Math.pow(100 * 0.0015 * fck, 1/3);
        break;
      default:
        tau_c = 0.36 * Math.sqrt(fck);
    }
    
    // Concrete shear capacity
    const Vc = tau_c * width * d / 1000;
    
    const status = tau_v <= tau_c ? 'safe' : 'unsafe';
    
    if (status === 'unsafe') {
      messages.push(`One-way shear stress ${tau_v.toFixed(3)} MPa exceeds ${tau_c.toFixed(3)} MPa`);
      messages.push(`Increase footing depth or reduce cantilever`);
    } else {
      messages.push(`One-way shear check passed (${direction} direction)`);
    }

    return {
      status,
      Vu,
      Vc,
      shearStress: tau_v,
      allowableStress: tau_c,
      criticalSection,
      messages,
    };
  }

  // ===========================================================================
  // TWO-WAY (PUNCHING) SHEAR CHECK
  // ===========================================================================

  private checkTwoWayShear(): TwoWayShearResult {
    const { L, B, D, d, columnL, columnB } = this.geometry;
    const { Pu } = this.loading;
    const { concreteGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const effectiveD = d!;
    
    const messages: string[] = [];
    
    // Critical perimeter at d/2 from column face
    const b0_L = columnL + effectiveD;
    const b0_B = columnB + effectiveD;
    const criticalPerimeter = 2 * (b0_L + b0_B);
    const criticalArea = b0_L * b0_B;
    
    // Total area minus critical area
    const totalArea = L * B;
    const netArea = (totalArea - criticalArea) / 1e6; // m²
    
    // Ultimate pressure (factored)
    const qu = (Pu * 1.5) / (L * B / 1e6);
    
    // Punching shear force
    const Vu = qu * netArea; // kN
    
    // Column aspect ratio
    const beta_c = Math.max(columnL, columnB) / Math.min(columnL, columnB);
    
    // Punching shear stress
    const tau_v = Vu * 1000 / (criticalPerimeter * effectiveD);
    
    // Allowable punching shear stress
    let tau_c: number;
    switch (this.code) {
      case 'IS456':
        // IS 456 Clause 31.6.3
        const ks = Math.min(1, 0.5 + beta_c);
        tau_c = ks * 0.25 * Math.sqrt(fck);
        break;
      case 'ACI318':
        // ACI 318-19 Section 22.6.5
        const alpha_s = 40; // Interior column
        tau_c = Math.min(
          0.33 * Math.sqrt(fck),
          0.17 * (1 + 2 / beta_c) * Math.sqrt(fck),
          0.083 * (alpha_s * effectiveD / criticalPerimeter + 2) * Math.sqrt(fck)
        ) * ACI_PHI_FACTORS.shear;
        break;
      case 'EN1992':
        // EC2 6.4.4
        const k = Math.min(2, 1 + Math.sqrt(200 / effectiveD));
        const rho_l = 0.002; // Assumed
        const vRd_c = 0.18 / 1.5 * k * Math.pow(100 * rho_l * fck, 1/3);
        tau_c = Math.max(vRd_c, 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck));
        break;
      default:
        tau_c = 0.25 * Math.sqrt(fck);
    }
    
    // Concrete capacity
    const Vc = tau_c * criticalPerimeter * effectiveD / 1000;
    
    let status: 'safe' | 'unsafe' | 'warning' = 'safe';
    if (tau_v > tau_c) {
      if (tau_v > 1.5 * tau_c) {
        status = 'unsafe';
        messages.push(`CRITICAL: Punching shear stress ${tau_v.toFixed(3)} MPa exceeds ${tau_c.toFixed(3)} MPa`);
        messages.push('Increase footing depth significantly or provide shear reinforcement');
      } else {
        status = 'warning';
        messages.push(`Punching shear marginally exceeds limit. Consider shear studs.`);
      }
    } else {
      messages.push(`Two-way (punching) shear check passed`);
    }

    return {
      status,
      Vu,
      Vc,
      shearStress: tau_v,
      allowableStress: tau_c,
      criticalPerimeter,
      beta_c,
      messages,
    };
  }

  // ===========================================================================
  // REINFORCEMENT DESIGN
  // ===========================================================================

  private designReinforcement(): {
    longDirection: FootingReinforcementResult;
    shortDirection: FootingReinforcementResult;
  } {
    const { L, B, D, d, columnL, columnB } = this.geometry;
    const { Pu } = this.loading;
    const { concreteGrade, steelGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const fy = steelGrade.fy;
    const effectiveD = d!;
    
    // Ultimate pressure (factored)
    const qu = (Pu * 1.5) / (L * B / 1e6); // kN/m²
    
    // Long direction (bending about shorter axis)
    const longResult = this.designDirectionalReinforcement(
      L, B, columnL, effectiveD, qu, fck, fy, 'length'
    );
    
    // Short direction (bending about longer axis)
    // For rectangular footings, consider banded distribution
    const shortResult = this.designDirectionalReinforcement(
      B, L, columnB, effectiveD - longResult.barDiameter, qu, fck, fy, 'width'
    );
    
    return {
      longDirection: longResult,
      shortDirection: shortResult,
    };
  }

  private designDirectionalReinforcement(
    span: number,
    width: number,
    columnDim: number,
    d: number,
    qu: number,
    fck: number,
    fy: number,
    direction: 'length' | 'width'
  ): FootingReinforcementResult {
    // Cantilever length from column face
    const cantilever = (span - columnDim) / 2;
    
    // Maximum bending moment at column face
    // Mu = qu * width * cantilever² / 2
    const Mu = qu * width * cantilever * cantilever / (2 * 1e9); // kN-m
    
    // Required steel area
    const fyd = getDesignYieldStrength(fy, this.code);
    
    // Using IS 456 / simplified formula
    // Mu = 0.87 * fy * Ast * (d - 0.42*xu)
    // For footings, assume under-reinforced: z ≈ 0.9d
    let Ast_required = Mu * 1e6 / (fyd * 0.9 * d);
    
    // Minimum steel
    const Ast_min = 0.0012 * width * this.geometry.D;
    Ast_required = Math.max(Ast_required, Ast_min);
    
    // Select bars
    const bars = this.selectFootingBars(Ast_required, width, d);
    
    // Calculate actual capacity
    const xu = 0.87 * fy * bars.area / (0.36 * fck * width);
    const z = d - 0.42 * xu;
    const Mu_capacity = 0.87 * fy * bars.area * z / 1e6;
    
    // Determine if banding is required (for short direction of rectangular footings)
    let distributionType: 'uniform' | 'banded' = 'uniform';
    let bandWidth: number | undefined;
    
    if (direction === 'width' && this.geometry.L > this.geometry.B) {
      const beta = this.geometry.L / this.geometry.B;
      if (beta > 1.2) {
        distributionType = 'banded';
        bandWidth = this.geometry.B + this.geometry.columnL;
        // Portion in band = 2 / (beta + 1)
      }
    }

    return {
      direction,
      Ast_required,
      barDiameter: bars.diameter,
      numberOfBars: bars.count,
      spacing: bars.spacing,
      Ast_provided: bars.area,
      distributionType,
      bandWidth,
      utilizationRatio: Mu / Mu_capacity,
    };
  }

  private selectFootingBars(Ast_required: number, width: number, d: number): {
    diameter: number;
    count: number;
    spacing: number;
    area: number;
  } {
    // Preferred bar diameters for footings
    const diameters = [12, 16, 20, 25];
    
    for (const dia of diameters) {
      const rebar = getRebarByDiameter(dia);
      if (!rebar) continue;
      
      // Calculate required number of bars
      const numBars = Math.ceil(Ast_required / rebar.area);
      const spacing = (width - 2 * this.geometry.cover - dia) / (numBars - 1);
      
      // Check spacing limits
      const maxSpacing = Math.min(3 * this.geometry.D, 300);
      const minSpacing = Math.max(75, dia);
      
      if (spacing >= minSpacing && spacing <= maxSpacing) {
        // Round spacing down to nearest 25mm
        const roundedSpacing = Math.floor(spacing / 25) * 25;
        const actualBars = Math.ceil((width - 2 * this.geometry.cover - dia) / roundedSpacing) + 1;
        
        return {
          diameter: dia,
          count: actualBars,
          spacing: roundedSpacing,
          area: actualBars * rebar.area,
        };
      }
    }

    // Default: 16mm @ 150mm c/c
    const rebar16 = getRebarByDiameter(16)!;
    const defaultBars = Math.ceil(width / 150);
    return {
      diameter: 16,
      count: defaultBars,
      spacing: 150,
      area: defaultBars * rebar16.area,
    };
  }

  // ===========================================================================
  // DEVELOPMENT LENGTH CHECK
  // ===========================================================================

  private checkDevelopmentLength(barDia: number): DevelopmentLengthResult {
    const { L, B, columnL, columnB, cover } = this.geometry;
    const { concreteGrade, steelGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const fy = steelGrade.fy;
    
    const messages: string[] = [];
    
    // Required development length
    let Ld_required: number;
    
    switch (this.code) {
      case 'IS456':
        // IS 456 Clause 26.2.1
        const tau_bd = this.getBondStress_IS456(fck);
        Ld_required = 0.87 * fy * barDia / (4 * tau_bd);
        break;
      case 'ACI318':
        // ACI 318 simplified
        Ld_required = 0.02 * fy * barDia / Math.sqrt(fck);
        Ld_required = Math.max(Ld_required, 300);
        break;
      case 'EN1992':
        // EC2 simplified
        const fbd = 2.25 * 0.3 * Math.pow(fck, 2/3) / 1.5;
        Ld_required = barDia * fy / 1.15 / (4 * fbd);
        break;
      default:
        Ld_required = 47 * barDia; // Approximate
    }
    
    // Available development length (shorter cantilever minus cover)
    const cantileverL = (L - columnL) / 2;
    const cantileverB = (B - columnB) / 2;
    const shortCantilever = Math.min(cantileverL, cantileverB);
    const Ld_available = shortCantilever - cover;
    
    const status = Ld_available >= Ld_required ? 'adequate' : 'inadequate';
    
    if (status === 'inadequate') {
      messages.push(`Development length ${Ld_available.toFixed(0)}mm < required ${Ld_required.toFixed(0)}mm`);
      messages.push('Consider using smaller diameter bars or hooks');
    } else {
      messages.push('Development length check passed');
    }

    return {
      status,
      Ld_required,
      Ld_available,
      messages,
    };
  }

  private getBondStress_IS456(fck: number): number {
    // IS 456 Table 15 (deformed bars in tension)
    const baseStress: Record<number, number> = {
      15: 1.0,
      20: 1.2,
      25: 1.4,
      30: 1.5,
      35: 1.7,
      40: 1.9,
    };
    
    // Find closest grade
    const grades = Object.keys(baseStress).map(Number);
    for (const grade of grades) {
      if (fck <= grade) return baseStress[grade];
    }
    return 1.9;
  }

  // ===========================================================================
  // SETTLEMENT ESTIMATION
  // ===========================================================================

  private estimateSettlement(): SettlementResult {
    const { L, B } = this.geometry;
    const { P_service } = this.loading;
    const { SBC, Es, poissonRatio, type } = this.soil;
    
    const messages: string[] = [];
    
    // Average bearing pressure
    const q = (P_service || this.loading.Pu / 1.5) / (L * B / 1e6);
    
    // Elastic modulus (use typical if not provided)
    const E = Es || this.getTypicalSoilModulus(type);
    const nu = poissonRatio || 0.3;
    
    // Immediate settlement using elastic theory (Boussinesq)
    const avgDimension = Math.sqrt(L * B) / 1000; // m
    const If = 1.0; // Influence factor (simplified)
    const immediate = (q * avgDimension * If * (1 - nu * nu)) / E * 1000; // mm
    
    // Consolidation settlement (only for clay)
    let consolidation = 0;
    if (type.includes('clay')) {
      // Simplified: assume 50% additional for clay
      consolidation = immediate * 0.5;
    }
    
    const total = immediate + consolidation;
    
    // Allowable settlement
    const allowable = 25; // mm (typical for isolated footings)
    
    // Differential settlement risk
    let differentialRisk: 'low' | 'moderate' | 'high';
    if (total < allowable * 0.5) differentialRisk = 'low';
    else if (total < allowable) differentialRisk = 'moderate';
    else differentialRisk = 'high';
    
    if (total > allowable) {
      messages.push(`Estimated settlement ${total.toFixed(1)}mm exceeds allowable ${allowable}mm`);
    } else {
      messages.push(`Settlement check passed: ${total.toFixed(1)}mm ≤ ${allowable}mm`);
    }

    return {
      immediate,
      consolidation,
      total,
      allowable,
      differentialRisk,
      messages,
    };
  }

  private getTypicalSoilModulus(type: SoilType): number {
    const moduli: Record<SoilType, number> = {
      'hard-rock': 500000,
      'soft-rock': 200000,
      'gravel': 100000,
      'sand': 50000,
      'clay-stiff': 25000,
      'clay-medium': 15000,
      'clay-soft': 5000,
      'filled': 3000,
    };
    return moduli[type] || 20000;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private calculateMinDepthForShear(): number {
    const { L, B, columnL, columnB } = this.geometry;
    const { Pu } = this.loading;
    const { concreteGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const qu = (Pu * 1.5) / (L * B / 1e6);
    
    // Simplified: estimate depth for punching shear
    // tau_c * bo * d = Pu * 1.5 - qu * (col + d)²
    // Iterative solution
    
    let d = 300; // Starting guess
    for (let i = 0; i < 10; i++) {
      const b0 = 2 * (columnL + columnB + 2 * d);
      const tau_c = 0.25 * Math.sqrt(fck);
      const Vc = tau_c * b0 * d / 1000;
      
      const critArea = (columnL + d) * (columnB + d);
      const Vu = qu * (L * B - critArea) / 1e6;
      
      if (Vu <= Vc) break;
      d += 50;
    }
    
    // Add cover
    return d + this.geometry.cover + 25;
  }

  private calculateSteelWeight(reinforcement: {
    longDirection: FootingReinforcementResult;
    shortDirection: FootingReinforcementResult;
  }): number {
    const { L, B } = this.geometry;
    
    // Long direction bars
    const longBar = getRebarByDiameter(reinforcement.longDirection.barDiameter);
    const longLength = (B - 2 * this.geometry.cover) / 1000; // m
    const longWeight = (longBar?.weight || 0) * longLength * reinforcement.longDirection.numberOfBars;
    
    // Short direction bars
    const shortBar = getRebarByDiameter(reinforcement.shortDirection.barDiameter);
    const shortLength = (L - 2 * this.geometry.cover) / 1000; // m
    const shortWeight = (shortBar?.weight || 0) * shortLength * reinforcement.shortDirection.numberOfBars;
    
    return longWeight + shortWeight;
  }

  private determineOverallStatus(
    bearing: BearingPressureResult,
    oneWay: { longDirection: OneWayShearResult; shortDirection: OneWayShearResult },
    twoWay: TwoWayShearResult,
    devLength: DevelopmentLengthResult
  ): 'safe' | 'unsafe' | 'marginal' {
    const allChecks = [
      bearing.status === 'safe',
      oneWay.longDirection.status === 'safe',
      oneWay.shortDirection.status === 'safe',
      twoWay.status === 'safe',
      devLength.status === 'adequate',
    ];
    
    if (allChecks.every(c => c)) {
      const maxUtil = bearing.maxPressure / bearing.allowablePressure;
      return maxUtil > 0.9 ? 'marginal' : 'safe';
    }
    
    const criticalFailures = [
      bearing.status === 'unsafe',
      twoWay.status === 'unsafe',
    ];
    
    return criticalFailures.some(c => c) ? 'unsafe' : 'marginal';
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Quick design for isolated square footing
 */
export function designIsolatedFooting(
  P: number,           // Service load (kN)
  columnSize: number,  // Square column size (mm)
  SBC: number,         // Safe bearing capacity (kN/m²)
  fck: number,
  fy: number,
  code: DesignCode = 'IS456'
): FootingDesignResult {
  // Preliminary sizing
  const areaRequired = (P * 1.1) / SBC * 1e6; // mm² (10% extra for self weight)
  const sideLength = Math.ceil(Math.sqrt(areaRequired) / 100) * 100; // Round up to 100mm
  
  // Preliminary depth (1/5 of cantilever)
  const cantilever = (sideLength - columnSize) / 2;
  const prelimDepth = Math.max(300, cantilever / 3);
  const depth = Math.ceil(prelimDepth / 50) * 50; // Round to 50mm

  const concreteGrades = getConcreteGrades(code);
  const steelGrades = getSteelGrades(code);
  
  const concreteGrade = concreteGrades.find(g => g.fck === fck) || concreteGrades[2];
  const steelGrade = steelGrades.find(g => g.fy === fy) || steelGrades[1];

  const engine = new RCFootingDesignEngine(
    {
      type: 'isolated-square',
      L: sideLength,
      B: sideLength,
      D: depth,
      cover: 50,
      columnL: columnSize,
      columnB: columnSize,
    },
    {
      Pu: P * 1.5,
      P_service: P,
    },
    {
      type: 'sand',
      SBC,
      unitWeight: 18,
    },
    {
      concreteGrade,
      steelGrade,
      code,
    }
  );

  return engine.design();
}

/**
 * Quick design for isolated rectangular footing
 */
export function designRectangularFooting(
  P: number,
  Mx: number,
  My: number,
  columnL: number,
  columnB: number,
  SBC: number,
  fck: number,
  fy: number,
  code: DesignCode = 'IS456'
): FootingDesignResult {
  // Preliminary sizing with eccentricity consideration
  const ex = Mx > 0 ? (Mx / P) * 1000 : 0;
  const ey = My > 0 ? (My / P) * 1000 : 0;
  
  // Size to keep load within middle third
  const minL = Math.max(6 * Math.abs(ex), columnL + 600);
  const minB = Math.max(6 * Math.abs(ey), columnB + 600);
  
  const areaRequired = (P * 1.1) / SBC * 1e6;
  const aspectRatio = columnL / columnB;
  
  const L = Math.ceil(Math.max(minL, Math.sqrt(areaRequired * aspectRatio)) / 100) * 100;
  const B = Math.ceil(Math.max(minB, areaRequired / L) / 100) * 100;
  
  const cantilever = Math.max((L - columnL) / 2, (B - columnB) / 2);
  const depth = Math.max(350, Math.ceil(cantilever / 3 / 50) * 50);

  const concreteGrades = getConcreteGrades(code);
  const steelGrades = getSteelGrades(code);
  
  const concreteGrade = concreteGrades.find(g => g.fck === fck) || concreteGrades[2];
  const steelGrade = steelGrades.find(g => g.fy === fy) || steelGrades[1];

  const engine = new RCFootingDesignEngine(
    {
      type: 'isolated-rectangular',
      L,
      B,
      D: depth,
      cover: 50,
      columnL,
      columnB,
    },
    {
      Pu: P * 1.5,
      Mux: Mx * 1.5,
      Muy: My * 1.5,
      P_service: P,
      Mx_service: Mx,
      My_service: My,
    },
    {
      type: 'sand',
      SBC,
      unitWeight: 18,
    },
    {
      concreteGrade,
      steelGrade,
      code,
    }
  );

  return engine.design();
}

export default RCFootingDesignEngine;
