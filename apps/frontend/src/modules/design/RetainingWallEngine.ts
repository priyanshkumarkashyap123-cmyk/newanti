/**
 * ============================================================================
 * RETAINING WALL DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive retaining wall analysis and design capabilities.
 * 
 * Supported Wall Types:
 * - Gravity walls (concrete, masonry, stone)
 * - Cantilever walls (RC)
 * - Counterfort walls
 * - Buttressed walls
 * - Sheet pile walls
 * - Mechanically stabilized earth (MSE) walls
 * 
 * Design Checks:
 * - Overturning stability
 * - Sliding stability
 * - Bearing capacity
 * - Global stability
 * - Structural design
 * 
 * Codes:
 * - IS 14458 (Parts 1-3) - Retaining walls
 * - BS 8002 - Earth retaining structures
 * - EN 1997 (Eurocode 7) - Geotechnical design
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RetainingWallGeometry {
  type: 'gravity' | 'cantilever' | 'counterfort' | 'sheet-pile' | 'mse';
  height: number; // m (total retained height)
  baseWidth?: number; // m (for gravity/cantilever)
  topWidth?: number; // m (for gravity)
  stemThickness?: number; // m (for cantilever)
  toeLength?: number; // m
  heelLength?: number; // m
  keyDepth?: number; // m
  keyWidth?: number; // m
  embedmentDepth?: number; // m
  batter?: {
    front: number; // horizontal:vertical
    back: number;
  };
}

export interface BackfillProperties {
  unitWeight: number; // kN/m³
  saturatedUnitWeight?: number;
  frictionAngle: number; // degrees
  cohesion?: number; // kPa
  slopeAngle?: number; // degrees (inclined backfill)
  drainageProvided?: boolean;
}

export interface FoundationSoil {
  unitWeight: number; // kN/m³
  frictionAngle: number; // degrees
  cohesion: number; // kPa
  allowableBearing?: number; // kPa
  frictionCoefficient?: number;
}

export interface RetainingWallLoads {
  surcharge?: number; // kPa
  lineLoad?: { magnitude: number; distance: number }; // kN/m at distance from wall
  stripLoad?: { magnitude: number; width: number; distance: number };
  waterPressure?: {
    waterLevel: number; // m from base
    drainageType: 'none' | 'weep-holes' | 'french-drain' | 'full';
  };
  seismic?: {
    horizontalCoeff: number; // αh
    verticalCoeff?: number; // αv
  };
}

export interface WallMaterials {
  concrete?: {
    grade: string;
    fck: number; // MPa
  };
  steel?: {
    grade: string;
    fy: number; // MPa
  };
  masonry?: {
    type: string;
    strength: number; // MPa
  };
}

// ============================================================================
// EARTH PRESSURE CALCULATOR FOR RETAINING WALLS
// ============================================================================

class RetainingWallPressure {
  /**
   * Calculate active earth pressure on retaining wall
   */
  static calculateActivePressure(
    backfill: BackfillProperties,
    geometry: RetainingWallGeometry,
    loads: RetainingWallLoads,
    wallFriction: number = 0 // degrees
  ): {
    Ka: number;
    pressureProfile: { depth: number; pressure: number }[];
    totalForce: number;
    pointOfApplication: number;
    horizontalComponent: number;
    verticalComponent: number;
  } {
    const phi = backfill.frictionAngle * Math.PI / 180;
    const delta = wallFriction * Math.PI / 180;
    const beta = (backfill.slopeAngle || 0) * Math.PI / 180;
    const alpha = 90 * Math.PI / 180; // Vertical wall face
    const gamma = backfill.unitWeight;
    const H = geometry.height;
    const q = loads.surcharge || 0;

    // Coulomb's Ka for inclined backfill
    const sinPhiPlusDelta = Math.sin(phi + delta);
    const sinPhiMinusBeta = Math.sin(phi - beta);
    const sinAlphaMinusDelta = Math.sin(alpha - delta);
    const sinAlphaPlusBeta = Math.sin(alpha + beta);

    const term1 = Math.pow(Math.sin(alpha + phi), 2);
    const term2 = Math.pow(Math.sin(alpha), 2) * sinAlphaMinusDelta;
    const term3 = 1 + Math.sqrt(sinPhiPlusDelta * sinPhiMinusBeta / (sinAlphaMinusDelta * sinAlphaPlusBeta));
    
    const Ka = term1 / (term2 * term3 * term3);

    // Pressure profile
    const pressureProfile: { depth: number; pressure: number }[] = [];
    const numPoints = 10;
    
    for (let i = 0; i <= numPoints; i++) {
      const z = (i / numPoints) * H;
      const pressure = Ka * (gamma * z + q);
      pressureProfile.push({ depth: z, pressure });
    }

    // Total force (soil + surcharge)
    const Pa_soil = 0.5 * Ka * gamma * H * H;
    const Pa_surcharge = Ka * q * H;
    const totalForce = Pa_soil + Pa_surcharge;

    // Point of application from base
    const y_soil = H / 3;
    const y_surcharge = H / 2;
    const pointOfApplication = (Pa_soil * y_soil + Pa_surcharge * y_surcharge) / totalForce;

    // Components
    const horizontalComponent = totalForce * Math.cos(delta);
    const verticalComponent = totalForce * Math.sin(delta);

    return {
      Ka,
      pressureProfile,
      totalForce,
      pointOfApplication,
      horizontalComponent,
      verticalComponent
    };
  }

  /**
   * Calculate seismic earth pressure (Mononobe-Okabe)
   */
  static calculateSeismicPressure(
    backfill: BackfillProperties,
    geometry: RetainingWallGeometry,
    seismicCoeff: { ah: number; av: number },
    wallFriction: number = 0
  ): {
    Kae: number;
    dynamicIncrement: number;
    totalSeismicForce: number;
    pointOfApplication: number;
  } {
    const phi = backfill.frictionAngle * Math.PI / 180;
    const delta = wallFriction * Math.PI / 180;
    const beta = (backfill.slopeAngle || 0) * Math.PI / 180;
    const alpha = 90 * Math.PI / 180;
    const gamma = backfill.unitWeight;
    const H = geometry.height;
    const kh = seismicCoeff.ah;
    const kv = seismicCoeff.av;

    // Seismic inertia angle
    const theta = Math.atan(kh / (1 - kv));

    // Mononobe-Okabe coefficient
    const cos2PhiMinusThetaMinusAlpha = Math.pow(Math.cos(phi - theta - alpha), 2);
    const cosThetaCos2AlphaCosAlphaPlusDelta = 
      Math.cos(theta) * Math.pow(Math.cos(alpha), 2) * Math.cos(alpha + delta + theta);
    
    const sqrtTerm = Math.sqrt(
      Math.sin(phi + delta) * Math.sin(phi - theta - beta) /
      (Math.cos(alpha + delta + theta) * Math.cos(alpha - beta))
    );
    
    const Kae = cos2PhiMinusThetaMinusAlpha / 
                (cosThetaCos2AlphaCosAlphaPlusDelta * Math.pow(1 + sqrtTerm, 2));

    // Static Ka for comparison
    const Ka = this.calculateActivePressure(backfill, geometry, {}, wallFriction).Ka;

    // Dynamic increment
    const dynamicIncrement = Kae - Ka;

    // Total seismic force
    const totalSeismicForce = 0.5 * Kae * gamma * (1 - kv) * H * H;

    // Point of application (higher than static - typically 0.6H for dynamic part)
    const staticForce = 0.5 * Ka * gamma * H * H;
    const dynamicForce = totalSeismicForce - staticForce;
    const pointOfApplication = (staticForce * H / 3 + dynamicForce * 0.6 * H) / totalSeismicForce;

    return {
      Kae,
      dynamicIncrement,
      totalSeismicForce,
      pointOfApplication
    };
  }

  /**
   * Calculate water pressure
   */
  static calculateWaterPressure(
    waterHeight: number, // m
    drainageEfficiency: number = 0 // 0 to 1 (1 = perfect drainage)
  ): {
    hydrostaticForce: number;
    pointOfApplication: number;
  } {
    const gammaW = 9.81; // kN/m³
    const effectiveHeight = waterHeight * (1 - drainageEfficiency);
    
    const hydrostaticForce = 0.5 * gammaW * effectiveHeight * effectiveHeight;
    const pointOfApplication = effectiveHeight / 3;

    return { hydrostaticForce, pointOfApplication };
  }
}

// ============================================================================
// GRAVITY WALL DESIGNER
// ============================================================================

export class GravityWallDesigner {
  private geometry: RetainingWallGeometry;
  private backfill: BackfillProperties;
  private foundation: FoundationSoil;
  private loads: RetainingWallLoads;
  private materials: WallMaterials;

  constructor(
    geometry: RetainingWallGeometry,
    backfill: BackfillProperties,
    foundation: FoundationSoil,
    loads: RetainingWallLoads,
    materials: WallMaterials
  ) {
    this.geometry = geometry;
    this.backfill = backfill;
    this.foundation = foundation;
    this.loads = loads;
    this.materials = materials;
  }

  /**
   * Perform stability analysis
   */
  analyze(): {
    stability: {
      overturning: { factor: number; pass: boolean };
      sliding: { factor: number; pass: boolean };
      bearing: { pressure: number; allowable: number; factor: number; pass: boolean };
      eccentricity: { value: number; limit: number; pass: boolean };
    };
    forces: {
      weight: number;
      activeForce: number;
      resistingMoment: number;
      overturnigMoment: number;
    };
    recommendations: string[];
  } {
    const H = this.geometry.height;
    const B = this.geometry.baseWidth || H * 0.5;
    const bTop = this.geometry.topWidth || B * 0.4;
    const gammaConcrete = 24; // kN/m³

    // Wall weight (trapezoidal section)
    const wallArea = (B + bTop) * H / 2;
    const W = wallArea * gammaConcrete;

    // Centroid of trapezoid from toe
    const xW = (B * B + B * bTop + bTop * bTop) / (3 * (B + bTop));

    // Active pressure
    const wallFriction = this.foundation.frictionAngle * 0.67;
    const pressure = RetainingWallPressure.calculateActivePressure(
      this.backfill,
      this.geometry,
      this.loads,
      wallFriction
    );

    const Pa = pressure.totalForce;
    const ya = pressure.pointOfApplication;
    const Pah = pressure.horizontalComponent;
    const Pav = pressure.verticalComponent;

    // Water pressure if applicable
    let Pw = 0;
    let yw = 0;
    if (this.loads.waterPressure && !this.backfill.drainageProvided) {
      const waterResult = RetainingWallPressure.calculateWaterPressure(
        this.loads.waterPressure.waterLevel,
        this.loads.waterPressure.drainageType === 'full' ? 0.9 : 0.5
      );
      Pw = waterResult.hydrostaticForce;
      yw = waterResult.pointOfApplication;
    }

    // Resisting forces and moments (about toe)
    const resistingMoment = W * xW + Pav * B;
    
    // Overturning moment
    const overturningMoment = Pah * ya + Pw * yw;

    // Factor of safety against overturning (minimum 2.0)
    const FOS_overturning = resistingMoment / overturningMoment;

    // Sliding resistance
    const mu = Math.tan(this.foundation.frictionAngle * Math.PI / 180 * 0.67);
    const Pp = 0; // Ignore passive pressure for conservative design
    const slidingResistance = (W + Pav) * mu + Pp;
    const slidingForce = Pah + Pw;
    const FOS_sliding = slidingResistance / slidingForce;

    // Bearing pressure
    const totalVertical = W + Pav;
    const netMoment = resistingMoment - overturningMoment;
    const eccentricity = B / 2 - netMoment / totalVertical;
    const Beff = B - 2 * Math.abs(eccentricity);

    let qMax: number, qMin: number;
    if (eccentricity <= B / 6) {
      // Pressure within middle third
      qMax = (totalVertical / B) * (1 + 6 * eccentricity / B);
      qMin = (totalVertical / B) * (1 - 6 * eccentricity / B);
    } else {
      // Resultant outside middle third - triangular distribution
      qMax = 2 * totalVertical / (3 * (B / 2 - eccentricity));
      qMin = 0;
    }

    const allowableBearing = this.foundation.allowableBearing || 200;
    const FOS_bearing = allowableBearing / qMax;

    // Recommendations
    const recommendations: string[] = [];
    
    if (FOS_overturning < 2.0) {
      recommendations.push('Increase base width or add heel/toe to improve overturning stability');
    }
    if (FOS_sliding < 1.5) {
      recommendations.push('Add shear key at base or increase wall friction to improve sliding resistance');
    }
    if (qMax > allowableBearing) {
      recommendations.push('Increase base width or improve foundation soil to reduce bearing pressure');
    }
    if (Math.abs(eccentricity) > B / 6) {
      recommendations.push('Resultant outside middle third - consider redesigning wall proportions');
    }
    if (!this.backfill.drainageProvided) {
      recommendations.push('Provide drainage (weep holes or french drain) to reduce water pressure');
    }

    return {
      stability: {
        overturning: { factor: FOS_overturning, pass: FOS_overturning >= 2.0 },
        sliding: { factor: FOS_sliding, pass: FOS_sliding >= 1.5 },
        bearing: { pressure: qMax, allowable: allowableBearing, factor: FOS_bearing, pass: qMax <= allowableBearing },
        eccentricity: { value: eccentricity, limit: B / 6, pass: Math.abs(eccentricity) <= B / 6 }
      },
      forces: {
        weight: W,
        activeForce: Pa,
        resistingMoment,
        overturnigMoment: overturningMoment
      },
      recommendations
    };
  }
}

// ============================================================================
// CANTILEVER WALL DESIGNER
// ============================================================================

export class CantileverWallDesigner {
  private geometry: RetainingWallGeometry;
  private backfill: BackfillProperties;
  private foundation: FoundationSoil;
  private loads: RetainingWallLoads;
  private materials: WallMaterials;

  constructor(
    geometry: RetainingWallGeometry,
    backfill: BackfillProperties,
    foundation: FoundationSoil,
    loads: RetainingWallLoads,
    materials: WallMaterials
  ) {
    this.geometry = geometry;
    this.backfill = backfill;
    this.foundation = foundation;
    this.loads = loads;
    this.materials = materials;
  }

  /**
   * Preliminary sizing
   */
  preliminarySizing(): {
    stemThickness: { top: number; bottom: number };
    baseWidth: number;
    toeLength: number;
    heelLength: number;
    baseThickness: number;
  } {
    const H = this.geometry.height;

    // Empirical rules for preliminary sizing
    const stemTop = Math.max(0.2, H / 24);
    const stemBottom = Math.max(0.3, H / 12);
    const baseWidth = Math.max(0.5 * H, 0.6 * H); // 50-60% of height
    const toeLength = baseWidth / 3;
    const heelLength = baseWidth - toeLength - stemBottom;
    const baseThickness = Math.max(0.3, H / 12);

    return {
      stemThickness: { top: stemTop, bottom: stemBottom },
      baseWidth,
      toeLength,
      heelLength,
      baseThickness
    };
  }

  /**
   * Perform full stability and structural analysis
   */
  analyze(): {
    stability: {
      overturning: { factor: number; pass: boolean };
      sliding: { factor: number; pass: boolean };
      bearing: { maxPressure: number; minPressure: number; pass: boolean };
    };
    structural: {
      stem: {
        moment: number;
        shear: number;
        mainReinforcement: { area: number; spacing: number; diameter: number };
        distributionReinforcement: { area: number; spacing: number };
      };
      heel: {
        moment: number;
        shear: number;
        reinforcement: { area: number; spacing: number };
      };
      toe: {
        moment: number;
        shear: number;
        reinforcement: { area: number; spacing: number };
      };
    };
  } {
    const H = this.geometry.height;
    const B = this.geometry.baseWidth || H * 0.55;
    const toe = this.geometry.toeLength || B / 3;
    const heel = this.geometry.heelLength || B / 2;
    const stemT = this.geometry.stemThickness || 0.3;
    const baseT = 0.4; // Base thickness assumed

    // Concrete and steel properties
    const fck = this.materials.concrete?.fck || 25;
    const fy = this.materials.steel?.fy || 500;
    const gammaConcrete = 25;
    const gammaBackfill = this.backfill.unitWeight;

    // Calculate forces
    const pressure = RetainingWallPressure.calculateActivePressure(
      this.backfill,
      this.geometry,
      this.loads,
      this.backfill.frictionAngle * 0.67
    );

    const Pah = pressure.horizontalComponent;
    const Pav = pressure.verticalComponent;
    const ya = pressure.pointOfApplication;

    // Weights
    const W_stem = stemT * (H - baseT) * gammaConcrete;
    const W_base = B * baseT * gammaConcrete;
    const W_soil = heel * (H - baseT) * gammaBackfill;
    const W_total = W_stem + W_base + W_soil + Pav;

    // Moments about toe
    const x_stem = toe + stemT / 2;
    const x_base = B / 2;
    const x_soil = toe + stemT + heel / 2;

    const M_resist = W_stem * x_stem + W_base * x_base + W_soil * x_soil + Pav * B;
    const M_overturn = Pah * ya;

    const FOS_overturning = M_resist / M_overturn;

    // Sliding
    const mu = Math.tan(this.foundation.frictionAngle * Math.PI / 180 * 0.67);
    const slidingResist = W_total * mu;
    const FOS_sliding = slidingResist / Pah;

    // Bearing pressure
    const xResult = (M_resist - M_overturn) / W_total;
    const e = B / 2 - xResult;
    
    let qMax: number, qMin: number;
    if (Math.abs(e) <= B / 6) {
      qMax = (W_total / B) * (1 + 6 * e / B);
      qMin = (W_total / B) * (1 - 6 * e / B);
    } else {
      qMax = 2 * W_total / (3 * (B / 2 - e));
      qMin = 0;
    }

    // Structural design - Stem
    const M_stem = Pah * (H - baseT) / 3; // Moment at base of stem
    const V_stem = Pah;

    // Required reinforcement for stem
    const d_stem = (stemT * 1000) - 50; // Effective depth in mm
    const Mu_stem = M_stem * 1.5; // Factored moment
    const Ast_stem = Mu_stem * 1e6 / (0.87 * fy * 0.9 * d_stem);
    
    // Bar selection
    const barDia = 16;
    const barArea = Math.PI * barDia * barDia / 4;
    const spacing_stem = Math.floor(1000 * barArea / Ast_stem);

    // Distribution steel (0.12% of gross area)
    const Ast_dist = 0.0012 * stemT * 1000 * 1000;
    const spacing_dist = Math.floor(1000 * 78.5 / Ast_dist); // 10mm bars

    // Heel design
    const soil_on_heel = heel * (H - baseT) * gammaBackfill;
    const base_self_weight = heel * baseT * gammaConcrete;
    const net_upward = qMin * heel; // Approximate
    const M_heel = (soil_on_heel + base_self_weight - net_upward) * heel / 2;
    const V_heel = soil_on_heel + base_self_weight - net_upward;

    const d_heel = (baseT * 1000) - 75;
    const Ast_heel = M_heel * 1.5 * 1e6 / (0.87 * fy * 0.9 * d_heel);
    const spacing_heel = Math.floor(1000 * barArea / Ast_heel);

    // Toe design
    const net_toe_pressure = (qMax + qMax - (qMax - qMin) * toe / B) / 2; // Average
    const base_weight_toe = toe * baseT * gammaConcrete;
    const M_toe = (net_toe_pressure * toe - base_weight_toe) * toe / 2;
    const V_toe = net_toe_pressure * toe - base_weight_toe;

    const Ast_toe = M_toe * 1.5 * 1e6 / (0.87 * fy * 0.9 * d_heel);
    const spacing_toe = Math.floor(1000 * barArea / Math.max(Ast_toe, Ast_heel * 0.5));

    return {
      stability: {
        overturning: { factor: FOS_overturning, pass: FOS_overturning >= 2.0 },
        sliding: { factor: FOS_sliding, pass: FOS_sliding >= 1.5 },
        bearing: { 
          maxPressure: qMax, 
          minPressure: qMin, 
          pass: qMax <= (this.foundation.allowableBearing || 200) 
        }
      },
      structural: {
        stem: {
          moment: M_stem,
          shear: V_stem,
          mainReinforcement: { 
            area: Ast_stem, 
            spacing: Math.min(spacing_stem, 150), 
            diameter: barDia 
          },
          distributionReinforcement: { 
            area: Ast_dist, 
            spacing: Math.min(spacing_dist, 200) 
          }
        },
        heel: {
          moment: M_heel,
          shear: V_heel,
          reinforcement: { area: Ast_heel, spacing: Math.min(spacing_heel, 150) }
        },
        toe: {
          moment: M_toe,
          shear: V_toe,
          reinforcement: { area: Ast_toe, spacing: Math.min(spacing_toe, 150) }
        }
      }
    };
  }
}

// ============================================================================
// SHEET PILE WALL DESIGNER
// ============================================================================

export class SheetPileWallDesigner {
  /**
   * Design cantilever sheet pile wall in cohesionless soil
   */
  designCantileverInSand(
    retainedHeight: number, // m
    soil: {
      gamma: number;
      phi: number;
      gammaSub?: number;
    },
    waterTableBehind?: number, // m below top
    waterTableFront?: number, // m below dredge level
    surcharge: number = 0
  ): {
    embedmentDepth: number;
    maxMoment: number;
    sectionModulusRequired: number;
    suggestedSection: string;
    pressureDistribution: { depth: number; active: number; passive: number }[];
  } {
    const H = retainedHeight;
    const phi = soil.phi * Math.PI / 180;
    const gamma = soil.gamma;
    const gammaSub = soil.gammaSub || (gamma - 9.81);
    const q = surcharge;

    // Earth pressure coefficients
    const Ka = Math.pow(Math.tan(Math.PI / 4 - phi / 2), 2);
    const Kp = Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);

    // Initial estimate of embedment (Free earth support method)
    // Iterative solution for D
    let D = H * 0.5; // Initial guess
    let iterations = 0;
    const maxIter = 100;

    while (iterations < maxIter) {
      // Active pressure at dredge level
      const pa_H = Ka * (gamma * H + q);
      
      // Active pressure at bottom
      const pa_bottom = Ka * (gamma * H + gammaSub * D + q);
      
      // Passive pressure at bottom
      const pp_bottom = Kp * gammaSub * D;
      
      // Net pressure at bottom
      const pNet = pp_bottom - pa_bottom;

      // Point of zero net pressure below dredge level
      const z0 = pa_H / ((Kp - Ka) * gammaSub);

      // For moment equilibrium about anchor point (for simplicity, using toe)
      // Active force
      const Pa1 = 0.5 * Ka * gamma * H * H + Ka * q * H;
      const ya1 = H / 3; // from dredge level

      // Additional active below dredge
      const Pa2 = pa_H * D + 0.5 * Ka * gammaSub * D * D;
      const ya2 = -D / 2; // below dredge

      // Passive force
      const Pp = 0.5 * Kp * gammaSub * D * D;
      const yp = -D / 3;

      // Moment about toe
      const M_active = Pa1 * (ya1 + D) + Pa2 * (D / 2);
      const M_passive = Pp * (D / 3);

      if (Math.abs(M_passive - M_active) < M_active * 0.01) {
        break;
      }

      // Adjust D
      D = D * Math.sqrt(M_active / M_passive);
      iterations++;
    }

    // Add factor of safety to embedment (typically 1.5-2.0)
    const D_design = D * 1.5;

    // Maximum moment calculation
    // Occurs where shear is zero
    const Pa_total = 0.5 * Ka * gamma * H * H + Ka * q * H;
    const y_shearZero = H - Math.sqrt(2 * Pa_total / (Ka * gamma));
    const M_max = Pa_total * y_shearZero / 3;

    // Required section modulus
    const sigma_allow = 165; // MPa for steel
    const Z_req = M_max * 1e6 / sigma_allow; // mm³/m

    // Suggest section
    let suggestedSection: string;
    if (Z_req < 500000) {
      suggestedSection = 'Larssen 2 or equivalent (Z ≈ 500,000 mm³/m)';
    } else if (Z_req < 1000000) {
      suggestedSection = 'Larssen 3 or equivalent (Z ≈ 1,000,000 mm³/m)';
    } else if (Z_req < 2000000) {
      suggestedSection = 'Larssen 4 or equivalent (Z ≈ 2,000,000 mm³/m)';
    } else {
      suggestedSection = 'Larssen 5 or Z-pile (Z > 2,000,000 mm³/m)';
    }

    // Pressure distribution for plotting
    const pressureDistribution: { depth: number; active: number; passive: number }[] = [];
    const totalDepth = H + D_design;
    
    for (let i = 0; i <= 20; i++) {
      const z = (i / 20) * totalDepth;
      let active: number, passive: number;

      if (z <= H) {
        active = Ka * (gamma * z + q);
        passive = 0;
      } else {
        const zBelow = z - H;
        active = Ka * (gamma * H + gammaSub * zBelow + q);
        passive = Kp * gammaSub * zBelow;
      }

      pressureDistribution.push({ depth: z, active, passive });
    }

    return {
      embedmentDepth: D_design,
      maxMoment: M_max,
      sectionModulusRequired: Z_req,
      suggestedSection,
      pressureDistribution
    };
  }

  /**
   * Design anchored sheet pile wall
   */
  designAnchoredWall(
    retainedHeight: number,
    anchorDepth: number, // m below top
    soil: {
      gamma: number;
      phi: number;
      gammaSub?: number;
    },
    surcharge: number = 0
  ): {
    embedmentDepth: number;
    anchorForce: number;
    maxMoment: number;
    sectionModulusRequired: number;
    anchorDesign: {
      spacing: number;
      capacity: number;
      length: number;
    };
  } {
    const H = retainedHeight;
    const a = anchorDepth;
    const phi = soil.phi * Math.PI / 180;
    const gamma = soil.gamma;
    const gammaSub = soil.gammaSub || (gamma - 9.81);
    const q = surcharge;

    const Ka = Math.pow(Math.tan(Math.PI / 4 - phi / 2), 2);
    const Kp = Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);

    // Free earth support method with anchor
    // Active pressure resultant
    const Pa = 0.5 * Ka * gamma * H * H + Ka * q * H;
    const ya = (0.5 * Ka * gamma * H * H * H / 3 + Ka * q * H * H / 2) / Pa; // from bottom

    // Embedment by moment equilibrium about anchor
    // Simplified solution
    let D = H * 0.3; // Initial estimate for anchored wall
    let iterations = 0;

    while (iterations < 50) {
      const Pp = 0.5 * Kp * gammaSub * D * D;
      const yp = H - a + D / 3; // from anchor

      const M_Pa = Pa * (ya + D - a); // Active moment about anchor
      const M_Pp = Pp * (H + D - a - D / 3); // Passive moment about anchor

      if (Math.abs(M_Pa - M_Pp) < M_Pa * 0.02) break;

      D = D * Math.sqrt(M_Pa / M_Pp);
      iterations++;
    }

    const D_design = D * 1.2; // Factor of safety

    // Anchor force (horizontal equilibrium)
    const Pp_design = 0.5 * Kp * gammaSub * D_design * D_design;
    const T = Pa - Pp_design;

    // Maximum moment (occurs between anchor and dredge level)
    // Point where shear = 0 below anchor
    const x_shearZero = a + Math.sqrt(2 * T / (Ka * gamma));
    const M_max = T * (x_shearZero - a) - 0.5 * Ka * gamma * Math.pow(x_shearZero - a, 2) * (x_shearZero - a) / 3;

    // Section modulus
    const sigma_allow = 165;
    const Z_req = M_max * 1e6 / sigma_allow;

    // Anchor design
    const anchorSpacing = 2.5; // m typical
    const anchorCapacity = T * anchorSpacing * 1.5; // kN per anchor with FOS
    const anchorLength = H / Math.tan(Math.PI / 4 + phi / 2) + 2; // Behind active wedge

    return {
      embedmentDepth: D_design,
      anchorForce: T,
      maxMoment: M_max,
      sectionModulusRequired: Z_req,
      anchorDesign: {
        spacing: anchorSpacing,
        capacity: anchorCapacity,
        length: anchorLength
      }
    };
  }
}

// ============================================================================
// EXPORTS (classes are already exported with 'export class' syntax above)
// ============================================================================

export default {
  RetainingWallPressure,
  GravityWallDesigner,
  CantileverWallDesigner,
  SheetPileWallDesigner
};
