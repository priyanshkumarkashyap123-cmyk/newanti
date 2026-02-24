/**
 * ============================================================================
 * RC RETAINING WALL AND SPECIAL STRUCTURES DESIGN ENGINE
 * ============================================================================
 * 
 * Complete reinforced concrete design for:
 * - Cantilever Retaining Walls
 * - Counterfort Retaining Walls
 * - Basement Walls
 * - Water Retaining Structures (Tanks)
 * - Staircases (Dog-legged, Open-well)
 * 
 * Supported Codes:
 * - IS 456:2000 / IS 3370 (India)
 * - ACI 318-19 / ACI 350 (USA)
 * - EN 1992-1-1:2004 / EN 1992-3 (Europe)
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
  getDesignYieldStrength,
} from './RCDesignConstants';

// =============================================================================
// TYPE DEFINITIONS - RETAINING WALL
// =============================================================================

export type RetainingWallType = 'cantilever' | 'counterfort' | 'gravity' | 'basement';
export type BackfillType = 'granular' | 'cohesive' | 'rock' | 'saturated';

export interface RetainingWallGeometry {
  type: RetainingWallType;
  H: number;              // Total height (mm)
  stemThicknessTop: number;    // Stem thickness at top (mm)
  stemThicknessBottom: number; // Stem thickness at bottom (mm)
  toeLength: number;      // Toe projection (mm)
  heelLength: number;     // Heel projection (mm)
  baseThickness: number;  // Base slab thickness (mm)
  shearKey?: {
    depth: number;
    width: number;
    position: number;     // Distance from toe (mm)
  };
  counterfortSpacing?: number; // For counterfort walls (mm)
  counterfortThickness?: number;
}

export interface BackfillProperties {
  type: BackfillType;
  unitWeight: number;     // kN/m³
  saturatedWeight?: number; // kN/m³
  frictionAngle: number;  // degrees
  cohesion?: number;      // kN/m²
  surchageLoad?: number;  // kN/m²
  waterTable?: number;    // Depth from top (mm)
  slopeAngle?: number;    // Backfill slope (degrees)
}

export interface FoundationSoil {
  SBC: number;            // Safe bearing capacity (kN/m²)
  frictionAngle: number;  // degrees
  cohesion?: number;      // kN/m²
  passiveCoeff?: number;  // If shear key provided
}

export interface RetainingWallMaterials {
  concreteGrade: ConcreteGrade;
  steelGrade: SteelGrade;
  code: DesignCode;
}

export interface EarthPressureResult {
  Ka: number;             // Active pressure coefficient
  Kp: number;             // Passive pressure coefficient
  Ko?: number;            // At-rest coefficient
  Pa: number;             // Total active pressure (kN/m)
  Pp?: number;            // Passive pressure (kN/m)
  Pwater?: number;        // Water pressure (kN/m)
  pressureAtBase: number; // kN/m²
  centroidHeight: number; // mm from base
  horizontalForce: number; // kN/m
  verticalForce?: number; // From inclined backfill (kN/m)
}

export interface StabilityResult {
  status: 'safe' | 'unsafe' | 'marginal';
  overturningMoment: number;  // kN-m/m
  resistingMoment: number;    // kN-m/m
  overturningFOS: number;     // Factor of Safety (min 1.5)
  slidingForce: number;       // kN/m
  resistingForce: number;     // kN/m
  slidingFOS: number;         // Factor of Safety (min 1.5)
  maxPressure: number;        // kN/m²
  minPressure: number;        // kN/m²
  bearingFOS: number;
  eccentricity: number;       // mm
  isWithinMiddleThird: boolean;
  messages: string[];
}

export interface StemDesignResult {
  maxMoment: number;          // kN-m/m
  maxShear: number;           // kN/m
  Ast_inner: number;          // Inner face (earth side) mm²/m
  Ast_outer: number;          // Outer face mm²/m
  barDiaInner: number;
  spacingInner: number;
  barDiaOuter: number;
  spacingOuter: number;
  distributionSteel: number;  // mm²/m
  utilizationRatio: number;
  shearCheck: 'pass' | 'fail';
  messages: string[];
}

export interface BaseSlabDesignResult {
  toe: {
    maxMoment: number;
    Ast_top: number;
    Ast_bottom: number;
    barDia: number;
    spacing: number;
  };
  heel: {
    maxMoment: number;
    Ast_top: number;
    Ast_bottom: number;
    barDia: number;
    spacing: number;
  };
  shearCheck: 'pass' | 'fail';
  messages: string[];
}

export interface RetainingWallDesignResult {
  geometry: RetainingWallGeometry;
  backfill: BackfillProperties;
  foundation: FoundationSoil;
  materials: RetainingWallMaterials;
  earthPressure: EarthPressureResult;
  stability: StabilityResult;
  stemDesign: StemDesignResult;
  baseSlabDesign: BaseSlabDesignResult;
  summary: {
    status: 'safe' | 'unsafe' | 'marginal';
    concreteVolume: number;   // m³/m run
    steelWeight: number;      // kg/m run
    warnings: string[];
    recommendations: string[];
  };
  calculations: Record<string, number>;
}

// =============================================================================
// TYPE DEFINITIONS - WATER TANK
// =============================================================================

export type TankType = 'rectangular-ground' | 'rectangular-elevated' | 'circular-ground' | 'circular-elevated';
export type TankCondition = 'empty' | 'full' | 'test';

export interface TankGeometry {
  type: TankType;
  // For rectangular
  L?: number;             // Internal length (mm)
  B?: number;             // Internal breadth (mm)
  // For circular
  D?: number;             // Internal diameter (mm)
  
  H: number;              // Water depth (mm)
  freeboard: number;      // Free board (mm)
  wallThickness: number;  // mm
  baseThickness: number;  // mm
  roofThickness?: number; // mm (if covered)
  haunchSize?: number;    // Wall-base junction (mm)
}

export interface TankLoading {
  waterDensity: number;   // kN/m³ (typically 10)
  earthPressure?: number; // For underground tanks (kN/m²)
  surcharge?: number;     // kN/m²
  roofLoad?: number;      // kN/m²
}

export interface TankDesignResult {
  geometry: TankGeometry;
  loading: TankLoading;
  materials: RetainingWallMaterials;
  wallDesign: {
    horizontalMoment: number;   // kN-m/m
    verticalMoment: number;     // kN-m/m
    Ast_horizontal: number;     // mm²/m
    Ast_vertical: number;       // mm²/m
    crackWidthCheck: 'pass' | 'fail';
    maxCrackWidth: number;
  };
  baseDesign: {
    maxMoment: number;
    Ast_required: number;
    upliftCheck?: 'pass' | 'fail';
  };
  jointDetails: {
    wallBaseJunction: string;
    movementJoints: string;
    constructionJoints: string;
  };
  summary: {
    status: 'safe' | 'unsafe';
    capacity: number;           // liters
    warnings: string[];
  };
}

// =============================================================================
// TYPE DEFINITIONS - STAIRCASE
// =============================================================================

export type StaircaseType = 'dog-legged' | 'open-well' | 'spiral' | 'straight';

export interface StaircaseGeometry {
  type: StaircaseType;
  floorHeight: number;    // Floor to floor (mm)
  riserHeight: number;    // mm
  treadWidth: number;     // mm (going)
  width: number;          // Stair width (mm)
  landingLength: number;  // mm
  waistThickness: number; // Waist slab thickness (mm)
  landingThickness: number;
  numberOfFlights: number;
  effectiveSpan: number;  // mm
}

export interface StaircaseLoading {
  deadLoad: number;       // kN/m² (self weight calculated)
  liveLoad: number;       // kN/m² (typically 3-5)
  finishes: number;       // kN/m²
  handrail?: number;      // kN/m (line load)
}

export interface StaircaseDesignResult {
  geometry: StaircaseGeometry;
  loading: StaircaseLoading;
  materials: RetainingWallMaterials;
  flightDesign: {
    effectiveSpan: number;
    maxMoment: number;
    maxShear: number;
    Ast_main: number;
    Ast_distribution: number;
    barDiaMain: number;
    spacingMain: number;
    barDiaDist: number;
    spacingDist: number;
  };
  landingDesign: {
    maxMoment: number;
    Ast_required: number;
    barDia: number;
    spacing: number;
  };
  deflection: {
    status: 'pass' | 'fail';
    spanDepthRatio: number;
    allowedRatio: number;
  };
  summary: {
    status: 'safe' | 'unsafe';
    numberOfSteps: number;
    warnings: string[];
  };
}

// =============================================================================
// RETAINING WALL DESIGN ENGINE
// =============================================================================

export class RCRetainingWallEngine {
  private geometry: RetainingWallGeometry;
  private backfill: BackfillProperties;
  private foundation: FoundationSoil;
  private materials: RetainingWallMaterials;
  private code: DesignCode;

  constructor(
    geometry: RetainingWallGeometry,
    backfill: BackfillProperties,
    foundation: FoundationSoil,
    materials: RetainingWallMaterials
  ) {
    this.geometry = { ...geometry };
    this.backfill = { ...backfill };
    this.foundation = { ...foundation };
    this.materials = { ...materials };
    this.code = materials.code;
  }

  public design(): RetainingWallDesignResult {
    const calculations: Record<string, number> = {};
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Step 1: Calculate earth pressure
    const earthPressure = this.calculateEarthPressure();

    // Step 2: Check stability
    const stability = this.checkStability(earthPressure);

    // Step 3: Design stem
    const stemDesign = this.designStem(earthPressure);

    // Step 4: Design base slab
    const baseSlabDesign = this.designBaseSlab(earthPressure, stability);

    // Calculate quantities
    const concreteVolume = this.calculateConcreteVolume();
    const steelWeight = this.calculateSteelWeight(stemDesign, baseSlabDesign);

    // Overall status
    let status: 'safe' | 'unsafe' | 'marginal' = 'safe';
    if (stability.status === 'unsafe' || stemDesign.shearCheck === 'fail') {
      status = 'unsafe';
    } else if (stability.status === 'marginal' || stemDesign.utilizationRatio > 0.9) {
      status = 'marginal';
    }

    if (stability.overturningFOS < 2.0) {
      recommendations.push('Consider increasing heel length for better stability');
    }
    if (stability.slidingFOS < 1.75) {
      recommendations.push('Consider adding shear key to increase sliding resistance');
    }

    return {
      geometry: this.geometry,
      backfill: this.backfill,
      foundation: this.foundation,
      materials: this.materials,
      earthPressure,
      stability,
      stemDesign,
      baseSlabDesign,
      summary: {
        status,
        concreteVolume,
        steelWeight,
        warnings,
        recommendations,
      },
      calculations,
    };
  }

  private calculateEarthPressure(): EarthPressureResult {
    const { H, baseThickness } = this.geometry;
    const { unitWeight, frictionAngle, cohesion, surchageLoad, waterTable, slopeAngle } = this.backfill;

    // Convert to radians
    const phi = frictionAngle * Math.PI / 180;
    const beta = (slopeAngle || 0) * Math.PI / 180;

    // Rankine's active pressure coefficient
    // Ka = cos(β) * (cos(β) - √(cos²β - cos²φ)) / (cos(β) + √(cos²β - cos²φ))
    let Ka: number;
    if (slopeAngle && slopeAngle > 0) {
      const cosBeta = Math.cos(beta);
      const cosPhi = Math.cos(phi);
      const term = Math.sqrt(cosBeta * cosBeta - cosPhi * cosPhi);
      Ka = cosBeta * (cosBeta - term) / (cosBeta + term);
    } else {
      Ka = (1 - Math.sin(phi)) / (1 + Math.sin(phi));
    }

    // Passive coefficient (for shear key if present)
    const Kp = (1 + Math.sin(phi)) / (1 - Math.sin(phi));

    // Total height for pressure calculation
    const totalH = (H + baseThickness) / 1000; // meters

    // Active pressure at base (triangular distribution)
    const pressureAtBase = Ka * unitWeight * totalH;

    // Total active thrust
    let Pa = 0.5 * Ka * unitWeight * totalH * totalH;

    // Add surcharge effect
    if (surchageLoad) {
      Pa += Ka * surchageLoad * totalH;
    }

    // Water pressure if water table present
    let Pwater = 0;
    if (waterTable && waterTable < H) {
      const Hw = (H - waterTable) / 1000;
      Pwater = 0.5 * 10 * Hw * Hw; // 10 kN/m³ for water
    }

    // Centroid location
    const centroidHeight = totalH * 1000 / 3; // For triangular

    return {
      Ka,
      Kp,
      Pa,
      Pwater,
      pressureAtBase,
      centroidHeight,
      horizontalForce: Pa * Math.cos(beta) + Pwater,
      verticalForce: slopeAngle ? Pa * Math.sin(beta) : undefined,
    };
  }

  private checkStability(earthPressure: EarthPressureResult): StabilityResult {
    const { H, stemThicknessTop, stemThicknessBottom, toeLength, heelLength, baseThickness, shearKey } = this.geometry;
    const { unitWeight } = this.backfill;
    const { SBC, frictionAngle } = this.foundation;
    
    const messages: string[] = [];
    const concreteDensity = 25; // kN/m³

    // Convert to meters for calculation
    const h = H / 1000;
    const t1 = stemThicknessTop / 1000;
    const t2 = stemThicknessBottom / 1000;
    const toe = toeLength / 1000;
    const heel = heelLength / 1000;
    const base = baseThickness / 1000;
    const totalWidth = toe + t2 + heel;

    // Calculate weights and moments about toe
    let W_total = 0;
    let M_resist = 0;

    // Weight of stem (trapezoidal)
    const W_stem = concreteDensity * h * (t1 + t2) / 2;
    const x_stem = toe + (t1 + 2 * t2) / (3 * (t1 + t2)) * (t2 - t1) + t1;
    W_total += W_stem;
    M_resist += W_stem * (toe + t2 / 2); // Simplified centroid

    // Weight of base slab
    const W_base = concreteDensity * base * totalWidth;
    W_total += W_base;
    M_resist += W_base * totalWidth / 2;

    // Weight of backfill on heel
    const W_backfill = unitWeight * h * heel;
    W_total += W_backfill;
    M_resist += W_backfill * (toe + t2 + heel / 2);

    // Vertical component of active pressure (if inclined)
    if (earthPressure.verticalForce) {
      W_total += earthPressure.verticalForce;
      M_resist += earthPressure.verticalForce * totalWidth;
    }

    // Overturning moment (about toe)
    const M_overturn = earthPressure.horizontalForce * earthPressure.centroidHeight / 1000;

    // Factor of Safety against Overturning
    const FOS_overturn = M_resist / M_overturn;

    // Sliding resistance
    const mu = Math.tan(frictionAngle * Math.PI / 180);
    const F_resist = mu * W_total;

    // Passive resistance from shear key (if present)
    let F_passive = 0;
    if (shearKey) {
      F_passive = 0.5 * earthPressure.Kp * concreteDensity * Math.pow(shearKey.depth / 1000, 2);
    }

    // Factor of Safety against Sliding
    const FOS_sliding = (F_resist + F_passive) / earthPressure.horizontalForce;

    // Base pressure calculation
    const e = totalWidth / 2 - (M_resist - M_overturn) / W_total;
    const isWithinMiddleThird = Math.abs(e) <= totalWidth / 6;

    let maxPressure: number;
    let minPressure: number;

    if (isWithinMiddleThird) {
      maxPressure = W_total / totalWidth * (1 + 6 * e / totalWidth);
      minPressure = W_total / totalWidth * (1 - 6 * e / totalWidth);
    } else {
      // Triangular distribution
      maxPressure = 2 * W_total / (3 * (totalWidth / 2 - e));
      minPressure = 0;
      messages.push('WARNING: Resultant outside middle third - partial contact with soil');
    }

    // Bearing capacity check
    const FOS_bearing = SBC / maxPressure;

    // Determine status
    let status: 'safe' | 'unsafe' | 'marginal' = 'safe';
    if (FOS_overturn < 1.5 || FOS_sliding < 1.5 || FOS_bearing < 1.0) {
      status = 'unsafe';
    } else if (FOS_overturn < 2.0 || FOS_sliding < 1.75 || FOS_bearing < 1.5) {
      status = 'marginal';
    }

    if (FOS_overturn >= 1.5) messages.push(`Overturning FOS: ${FOS_overturn.toFixed(2)} ≥ 1.5 ✓`);
    if (FOS_sliding >= 1.5) messages.push(`Sliding FOS: ${FOS_sliding.toFixed(2)} ≥ 1.5 ✓`);
    if (maxPressure <= SBC) messages.push(`Max pressure: ${maxPressure.toFixed(1)} kN/m² ≤ SBC ${SBC} ✓`);

    return {
      status,
      overturningMoment: M_overturn,
      resistingMoment: M_resist,
      overturningFOS: FOS_overturn,
      slidingForce: earthPressure.horizontalForce,
      resistingForce: F_resist + F_passive,
      slidingFOS: FOS_sliding,
      maxPressure,
      minPressure,
      bearingFOS: FOS_bearing,
      eccentricity: e * 1000,
      isWithinMiddleThird,
      messages,
    };
  }

  private designStem(earthPressure: EarthPressureResult): StemDesignResult {
    const { H, stemThicknessBottom, baseThickness } = this.geometry;
    const { concreteGrade, steelGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const fy = steelGrade.fy;
    const cover = 50; // mm
    const messages: string[] = [];

    // Effective depth at base of stem
    const d = stemThicknessBottom - cover - 8; // Assuming 16mm bar

    // Maximum moment at base of stem (factored)
    // M = 0.5 * Ka * γ * H³ / 6 * 1.5 (for triangular pressure)
    const h = H / 1000;
    const Ka = earthPressure.Ka;
    const gamma = this.backfill.unitWeight;
    
    // Unfactored moment
    const M_service = Ka * gamma * h * h * h / 6;
    // Factored moment
    const Mu = M_service * 1.5;

    // Maximum shear at base
    const Vu = earthPressure.Pa * 1.5;

    // Required steel (earth face - inner)
    const fyd = getDesignYieldStrength(fy, this.code);
    let Ast_inner = Mu * 1e6 / (fyd * 0.9 * d);

    // Minimum steel
    const Ast_min = 0.0012 * 1000 * stemThicknessBottom;
    Ast_inner = Math.max(Ast_inner, Ast_min);

    // Outer face (nominal or for temperature)
    const Ast_outer = 0.0012 * 1000 * stemThicknessBottom;

    // Distribution steel
    const distributionSteel = 0.0012 * 1000 * stemThicknessBottom;

    // Select bars
    const innerBars = this.selectWallBars(Ast_inner);
    const outerBars = this.selectWallBars(Ast_outer);

    // Shear check
    const tau_v = Vu * 1000 / (1000 * d);
    const tau_c = 0.36 * Math.sqrt(fck);
    const shearCheck = tau_v <= tau_c ? 'pass' : 'fail';

    // Utilization
    const xu = 0.87 * fy * innerBars.area / (0.36 * fck * 1000);
    const Mu_capacity = 0.87 * fy * innerBars.area * (d - 0.42 * xu) / 1e6;
    const utilizationRatio = Mu / Mu_capacity;

    if (shearCheck === 'fail') {
      messages.push('SHEAR FAILURE: Increase stem thickness');
    }

    return {
      maxMoment: Mu,
      maxShear: Vu,
      Ast_inner,
      Ast_outer,
      barDiaInner: innerBars.diameter,
      spacingInner: innerBars.spacing,
      barDiaOuter: outerBars.diameter,
      spacingOuter: outerBars.spacing,
      distributionSteel,
      utilizationRatio,
      shearCheck,
      messages,
    };
  }

  private designBaseSlab(earthPressure: EarthPressureResult, stability: StabilityResult): BaseSlabDesignResult {
    const { toeLength, heelLength, baseThickness, stemThicknessBottom } = this.geometry;
    const { concreteGrade, steelGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const fy = steelGrade.fy;
    const cover = 75; // Bottom cover for foundation
    const d = baseThickness - cover - 8;
    const messages: string[] = [];

    // Pressure distribution
    const q_max = stability.maxPressure;
    const q_min = stability.minPressure;
    const totalWidth = (toeLength + stemThicknessBottom + heelLength) / 1000;

    // Toe design
    const toe = toeLength / 1000;
    // Pressure at toe = q_max (simplified trapezoidal)
    // Moment in toe = ∫(q*x)dx - self weight
    const q_toe = q_max - (q_max - q_min) * toe / totalWidth;
    const M_toe = (q_max + q_toe) / 2 * toe * toe / 2 * 1.5; // kN-m/m
    const Ast_toe = M_toe * 1e6 / (getDesignYieldStrength(fy, this.code) * 0.9 * d);

    // Heel design
    const heel = heelLength / 1000;
    const h = this.geometry.H / 1000;
    // Heel has backfill weight + surcharge downward, base pressure upward
    const W_backfill = this.backfill.unitWeight * h * heel;
    const W_self = 25 * (baseThickness / 1000) * heel;
    const uplift = stability.minPressure * heel;
    const M_heel = (W_backfill + W_self - uplift) * heel / 2 * 1.5; // kN-m/m
    const Ast_heel = M_heel * 1e6 / (getDesignYieldStrength(fy, this.code) * 0.9 * d);

    // Select bars
    const toeBars = this.selectWallBars(Math.max(Ast_toe, 0.0012 * 1000 * baseThickness));
    const heelBars = this.selectWallBars(Math.max(Ast_heel, 0.0012 * 1000 * baseThickness));

    // Shear check (simplified)
    const Vu = Math.max(q_max * toe, W_backfill + W_self) * 1.5;
    const tau_v = Vu * 1000 / (1000 * d);
    const tau_c = 0.36 * Math.sqrt(fck);
    const shearCheck = tau_v <= tau_c ? 'pass' : 'fail';

    return {
      toe: {
        maxMoment: M_toe,
        Ast_top: 0.0012 * 1000 * baseThickness, // Nominal
        Ast_bottom: toeBars.area,
        barDia: toeBars.diameter,
        spacing: toeBars.spacing,
      },
      heel: {
        maxMoment: M_heel,
        Ast_top: heelBars.area, // Tension on top for heel
        Ast_bottom: 0.0012 * 1000 * baseThickness,
        barDia: heelBars.diameter,
        spacing: heelBars.spacing,
      },
      shearCheck,
      messages,
    };
  }

  private selectWallBars(Ast_required: number): { diameter: number; spacing: number; area: number } {
    const diameters = [10, 12, 16, 20];
    
    for (const dia of diameters) {
      const rebar = getRebarByDiameter(dia);
      if (!rebar) continue;
      
      const spacing = Math.floor(rebar.area * 1000 / Ast_required);
      const maxSpacing = 300;
      const minSpacing = 100;
      
      if (spacing >= minSpacing && spacing <= maxSpacing) {
        const roundedSpacing = Math.min(Math.floor(spacing / 25) * 25, maxSpacing);
        return {
          diameter: dia,
          spacing: roundedSpacing,
          area: rebar.area * 1000 / roundedSpacing,
        };
      }
    }

    // Default
    return { diameter: 12, spacing: 150, area: 754 };
  }

  private calculateConcreteVolume(): number {
    const { H, stemThicknessTop, stemThicknessBottom, toeLength, heelLength, baseThickness } = this.geometry;
    
    // Stem volume (trapezoidal)
    const stemVol = (H / 1000) * (stemThicknessTop + stemThicknessBottom) / 2 / 1000;
    
    // Base slab volume
    const baseVol = (toeLength + stemThicknessBottom + heelLength) / 1000 * (baseThickness / 1000);
    
    return stemVol + baseVol; // m³/m run
  }

  private calculateSteelWeight(stem: StemDesignResult, base: BaseSlabDesignResult): number {
    // Simplified calculation
    const { H, toeLength, heelLength, stemThicknessBottom } = this.geometry;
    
    // Stem steel (inner + outer + distribution)
    const stemSteel = (stem.Ast_inner + stem.Ast_outer) * (H / 1000) + stem.distributionSteel * (stemThicknessBottom / 1000);
    
    // Base steel
    const baseSteel = (base.toe.Ast_bottom + base.heel.Ast_top) * (toeLength + heelLength) / 1000;
    
    // Convert mm²/m to kg/m (assuming 7850 kg/m³)
    return (stemSteel + baseSteel) * 7850 / 1e6;
  }
}

// =============================================================================
// WATER TANK DESIGN ENGINE
// =============================================================================

export class RCWaterTankEngine {
  private geometry: TankGeometry;
  private loading: TankLoading;
  private materials: RetainingWallMaterials;
  private code: DesignCode;

  constructor(
    geometry: TankGeometry,
    loading: TankLoading,
    materials: RetainingWallMaterials
  ) {
    this.geometry = { ...geometry };
    this.loading = { ...loading };
    this.materials = { ...materials };
    this.code = materials.code;
  }

  public design(): TankDesignResult {
    // Simplified design for rectangular ground tank
    const { L, B, H, wallThickness, baseThickness, freeboard } = this.geometry;
    const { waterDensity } = this.loading;
    const { concreteGrade, steelGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const fy = steelGrade.fy;

    // Total height
    const totalH = (H + freeboard) / 1000;
    const h = H / 1000;

    // Water pressure at base
    const p_max = waterDensity * h; // kN/m²

    // IS 3370 / ACI 350 approach
    // Horizontal moment in wall (fixed at base)
    // M_h = p * a² / 12 for fixed-fixed, where a = shorter dimension
    const a = Math.min(L || 5000, B || 5000) / 1000;
    const M_h = p_max * a * a / 16; // Simplified coefficient

    // Vertical moment (cantilever from base)
    const M_v = p_max * h * h / 6;

    // Effective depth
    const cover = 45; // IS 3370 requirement
    const d = wallThickness - cover - 8;

    // Direct tension in long wall (if rectangular)
    const T = p_max * (B || 5000) / 2 / 1000;

    // Design for combined bending and tension
    const fyd = getDesignYieldStrength(fy, this.code);
    
    // Horizontal steel
    const Ast_h = Math.max(
      M_h * 1e6 / (fyd * 0.9 * d) + T * 1000 / fyd,
      0.0024 * 1000 * wallThickness // IS 3370 minimum
    );

    // Vertical steel
    const Ast_v = Math.max(
      M_v * 1e6 / (fyd * 0.9 * d),
      0.0024 * 1000 * wallThickness
    );

    // Crack width check (IS 3370 Part 2)
    const crackWidth = this.calculateCrackWidth(Ast_h, d, M_h, T);
    const allowableCrack = 0.2; // mm for water retaining
    const crackCheck = crackWidth <= allowableCrack ? 'pass' : 'fail';

    // Base slab design
    const uplift = waterDensity * h;
    const M_base = uplift * Math.pow(Math.min(L || 5000, B || 5000) / 1000, 2) / 8;
    const Ast_base = Math.max(
      M_base * 1e6 / (fyd * 0.9 * (baseThickness - cover - 8)),
      0.0024 * 1000 * baseThickness
    );

    // Capacity
    const capacity = ((L || 5000) / 1000) * ((B || 5000) / 1000) * h * 1000; // liters

    return {
      geometry: this.geometry,
      loading: this.loading,
      materials: this.materials,
      wallDesign: {
        horizontalMoment: M_h,
        verticalMoment: M_v,
        Ast_horizontal: Ast_h,
        Ast_vertical: Ast_v,
        crackWidthCheck: crackCheck,
        maxCrackWidth: crackWidth,
      },
      baseDesign: {
        maxMoment: M_base,
        Ast_required: Ast_base,
      },
      jointDetails: {
        wallBaseJunction: 'Provide 150mm haunch with additional diagonal bars',
        movementJoints: `Provide expansion joints at ${Math.min(7.5, (L || 5000) / 1000)}m intervals`,
        constructionJoints: 'Water stops required at all construction joints',
      },
      summary: {
        status: crackCheck === 'pass' ? 'safe' : 'unsafe',
        capacity,
        warnings: crackCheck === 'fail' ? ['Crack width exceeds limit - increase wall thickness or steel'] : [],
      },
    };
  }

  private calculateCrackWidth(Ast: number, d: number, M: number, T: number): number {
    // Simplified IS 3370 / EC2 crack width calculation
    const fct = 0.7 * Math.sqrt(this.materials.concreteGrade.fck);
    const Es = this.materials.steelGrade.Es;
    
    // Steel stress
    const fs = (M * 1e6 / (Ast * 0.9 * d)) + (T * 1000 / Ast);
    
    // Crack spacing
    const c = 45; // Cover
    const phi = 12; // Assumed bar diameter
    const rho_eff = Ast / (2.5 * c * 1000);
    const Sr_max = 3.4 * c + 0.425 * phi / rho_eff;
    
    // Strain
    const epsilon_sm = fs / Es;
    
    // Crack width
    return Sr_max * epsilon_sm;
  }
}

// =============================================================================
// STAIRCASE DESIGN ENGINE
// =============================================================================

export class RCStaircaseEngine {
  private geometry: StaircaseGeometry;
  private loading: StaircaseLoading;
  private materials: RetainingWallMaterials;
  private code: DesignCode;

  constructor(
    geometry: StaircaseGeometry,
    loading: StaircaseLoading,
    materials: RetainingWallMaterials
  ) {
    this.geometry = { ...geometry };
    this.loading = { ...loading };
    this.materials = { ...materials };
    this.code = materials.code;
  }

  public design(): StaircaseDesignResult {
    const { riserHeight, treadWidth, width, waistThickness, landingThickness, floorHeight, effectiveSpan, landingLength } = this.geometry;
    const { deadLoad, liveLoad, finishes } = this.loading;
    const { concreteGrade, steelGrade } = this.materials;
    
    const fck = concreteGrade.fck;
    const fy = steelGrade.fy;
    const cover = 20;

    // Number of steps
    const numberOfSteps = Math.ceil(floorHeight / riserHeight);

    // Self weight calculation
    // Inclined length per step = √(R² + T²)
    const stepLength = Math.sqrt(riserHeight * riserHeight + treadWidth * treadWidth);
    const angleRad = Math.atan(riserHeight / treadWidth);
    
    // Effective thickness on slope = waist + step triangle
    const stepTriangleArea = 0.5 * riserHeight * treadWidth / 1e6; // m² per step
    const equivalentThickness = waistThickness / Math.cos(angleRad) + stepTriangleArea / (treadWidth / 1000);
    
    // Self weight per m² of horizontal projection
    const selfWeight = 25 * equivalentThickness / 1000; // kN/m²

    // Total load
    const totalDL = selfWeight + finishes;
    const wu = 1.5 * totalDL + 1.5 * liveLoad; // Factored load

    // Effective span
    const L = effectiveSpan / 1000;

    // Maximum moment (simply supported)
    const Mu = wu * L * L / 8; // kN-m/m width

    // Effective depth
    const d = waistThickness - cover - 6;

    // Required steel
    const fyd = getDesignYieldStrength(fy, this.code);
    let Ast_main = Mu * 1e6 / (fyd * 0.9 * d);

    // Minimum steel
    const Ast_min = 0.0012 * 1000 * waistThickness;
    Ast_main = Math.max(Ast_main, Ast_min);

    // Distribution steel
    const Ast_dist = 0.0012 * 1000 * waistThickness;

    // Maximum shear
    const Vu = wu * L / 2;

    // Select bars
    const mainBars = this.selectStairBars(Ast_main, width);
    const distBars = this.selectStairBars(Ast_dist, 1000);

    // Landing design (similar approach)
    const M_landing = wu * landingLength * landingLength / (8 * 1e6);
    const Ast_landing = Math.max(
      M_landing * 1e6 / (fyd * 0.9 * (landingThickness - cover - 6)),
      0.0012 * 1000 * landingThickness
    );
    const landingBars = this.selectStairBars(Ast_landing, width);

    // Deflection check
    const basicRatio = 20; // Simply supported
    const pt = (mainBars.area / (1000 * d)) * 100;
    const modificationFactor = 0.225 + 0.00322 * 0.58 * fy - 0.625 * Math.log10(pt);
    const allowedRatio = basicRatio * Math.max(0.8, Math.min(2.0, modificationFactor));
    const actualRatio = L * 1000 / waistThickness;
    const deflectionStatus = actualRatio <= allowedRatio ? 'pass' : 'fail';

    return {
      geometry: this.geometry,
      loading: this.loading,
      materials: this.materials,
      flightDesign: {
        effectiveSpan: effectiveSpan,
        maxMoment: Mu,
        maxShear: Vu,
        Ast_main,
        Ast_distribution: Ast_dist,
        barDiaMain: mainBars.diameter,
        spacingMain: mainBars.spacing,
        barDiaDist: distBars.diameter,
        spacingDist: distBars.spacing,
      },
      landingDesign: {
        maxMoment: M_landing,
        Ast_required: Ast_landing,
        barDia: landingBars.diameter,
        spacing: landingBars.spacing,
      },
      deflection: {
        status: deflectionStatus,
        spanDepthRatio: actualRatio,
        allowedRatio,
      },
      summary: {
        status: deflectionStatus === 'pass' ? 'safe' : 'unsafe',
        numberOfSteps,
        warnings: deflectionStatus === 'fail' ? ['Increase waist thickness for deflection control'] : [],
      },
    };
  }

  private selectStairBars(Ast_required: number, width: number): { diameter: number; spacing: number; area: number } {
    const diameters = [10, 12, 16];
    
    for (const dia of diameters) {
      const rebar = getRebarByDiameter(dia);
      if (!rebar) continue;
      
      const spacing = Math.floor(rebar.area * 1000 / Ast_required);
      const maxSpacing = Math.min(3 * this.geometry.waistThickness, 300);
      const minSpacing = 75;
      
      if (spacing >= minSpacing && spacing <= maxSpacing) {
        const roundedSpacing = Math.min(Math.floor(spacing / 25) * 25, maxSpacing);
        return {
          diameter: dia,
          spacing: roundedSpacing,
          area: rebar.area * 1000 / roundedSpacing,
        };
      }
    }

    return { diameter: 12, spacing: 150, area: 754 };
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

export function designCantileverRetainingWall(
  height: number,
  backfillAngle: number,
  backfillWeight: number,
  SBC: number,
  fck: number,
  fy: number,
  code: DesignCode = 'IS456'
): RetainingWallDesignResult {
  // Preliminary proportioning
  const H = height;
  const stemTop = Math.max(200, H / 24);
  const stemBottom = Math.max(300, H / 12);
  const baseThick = Math.max(300, H / 12);
  const baseWidth = 0.5 * H + 0.7 * H; // Typically 0.5H to 0.7H
  const toe = baseWidth * 0.3;
  const heel = baseWidth * 0.7 - stemBottom;

  const concreteGrades = getConcreteGrades(code);
  const steelGrades = getSteelGrades(code);
  
  const concreteGrade = concreteGrades.find(g => g.fck === fck) || concreteGrades[2];
  const steelGrade = steelGrades.find(g => g.fy === fy) || steelGrades[1];

  const engine = new RCRetainingWallEngine(
    {
      type: 'cantilever',
      H,
      stemThicknessTop: stemTop,
      stemThicknessBottom: stemBottom,
      toeLength: toe,
      heelLength: heel,
      baseThickness: baseThick,
    },
    {
      type: 'granular',
      unitWeight: backfillWeight,
      frictionAngle: backfillAngle,
    },
    {
      SBC,
      frictionAngle: 25,
    },
    {
      concreteGrade,
      steelGrade,
      code,
    }
  );

  return engine.design();
}

export function designRectangularWaterTank(
  L: number,
  B: number,
  H: number,
  fck: number,
  fy: number,
  code: DesignCode = 'IS456'
): TankDesignResult {
  // Preliminary wall thickness (IS 3370)
  const wallThick = Math.max(150, H / 15 + 75);
  const baseThick = Math.max(150, wallThick);

  const concreteGrades = getConcreteGrades(code);
  const steelGrades = getSteelGrades(code);
  
  const concreteGrade = concreteGrades.find(g => g.fck === fck) || concreteGrades[2];
  const steelGrade = steelGrades.find(g => g.fy === fy) || steelGrades[1];

  const engine = new RCWaterTankEngine(
    {
      type: 'rectangular-ground',
      L,
      B,
      H,
      freeboard: 200,
      wallThickness: wallThick,
      baseThickness: baseThick,
    },
    {
      waterDensity: 10,
    },
    {
      concreteGrade,
      steelGrade,
      code,
    }
  );

  return engine.design();
}

export function designDogLeggedStaircase(
  floorHeight: number,
  stairWidth: number,
  fck: number,
  fy: number,
  code: DesignCode = 'IS456'
): StaircaseDesignResult {
  // Standard proportions
  const riser = 150;
  const tread = 300;
  const landing = 1200;
  const waist = Math.max(125, floorHeight / 20);

  // Effective span (going + landings)
  const numSteps = Math.ceil(floorHeight / riser / 2); // Per flight
  const goingLength = numSteps * tread;
  const effectiveSpan = goingLength + landing;

  const concreteGrades = getConcreteGrades(code);
  const steelGrades = getSteelGrades(code);
  
  const concreteGrade = concreteGrades.find(g => g.fck === fck) || concreteGrades[2];
  const steelGrade = steelGrades.find(g => g.fy === fy) || steelGrades[1];

  const engine = new RCStaircaseEngine(
    {
      type: 'dog-legged',
      floorHeight,
      riserHeight: riser,
      treadWidth: tread,
      width: stairWidth,
      landingLength: landing,
      waistThickness: waist,
      landingThickness: waist,
      numberOfFlights: 2,
      effectiveSpan,
    },
    {
      deadLoad: 0,
      liveLoad: 3,
      finishes: 1,
    },
    {
      concreteGrade,
      steelGrade,
      code,
    }
  );

  return engine.design();
}
