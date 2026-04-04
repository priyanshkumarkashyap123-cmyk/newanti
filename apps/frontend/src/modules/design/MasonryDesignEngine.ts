/**
 * ============================================================================
 * MASONRY DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive masonry structural design per multiple international codes.
 * 
 * Supported Design Codes:
 * - IS 1905:1987 - Indian Standard for Structural Masonry
 * - TMS 402/ACI 530 - Building Code Requirements for Masonry Structures
 * - EN 1996 (Eurocode 6) - Design of Masonry Structures
 * - BS 5628 - British Standard for Masonry
 * 
 * Features:
 * - Unreinforced masonry (URM) wall design
 * - Reinforced masonry (RM) wall design
 * - Lateral load resistance
 * - Slenderness and stability checks
 * - Combined axial and bending
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MasonryMaterial {
  type: 'clay-brick' | 'concrete-block' | 'calcium-silicate' | 'aac' | 'stone';
  unitStrength: number; // MPa
  mortarType: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'S' | 'N' | 'O';
  mortarStrength: number; // MPa
  groutStrength?: number; // MPa (for grouted masonry)
  density: number; // kg/m³
  E?: number; // MPa
}

export interface MasonryWall {
  length: number; // mm
  height: number; // mm
  thickness: number; // mm
  effectiveHeight: number; // mm (considering support conditions)
  effectiveLength?: number; // mm (for flanged walls)
  eccentricity?: number; // mm
  openings?: WallOpening[];
  reinforcement?: MasonryReinforcement;
  flanges?: WallFlange[];
}

export interface WallOpening {
  width: number; // mm
  height: number; // mm
  positionX: number; // mm from left edge
  positionY: number; // mm from bottom
}

export interface MasonryReinforcement {
  vertical: {
    diameter: number; // mm
    spacing: number; // mm
    fy: number; // MPa
    coverage?: number; // mm
  };
  horizontal: {
    diameter: number; // mm
    spacing: number; // mm
    fy: number; // MPa
  };
}

export interface WallFlange {
  position: 'left' | 'right';
  length: number; // mm
  thickness: number; // mm
}

export interface MasonryLoads {
  axialLoad: number; // kN
  lateralLoad?: number; // kN/m²
  momentTop?: number; // kNm
  momentBottom?: number; // kNm
  eccentricityTop?: number; // mm
  eccentricityBottom?: number; // mm
}

export type MasonryDesignCode = 'IS1905' | 'TMS402' | 'EC6' | 'BS5628';

// ============================================================================
// MASONRY STRENGTH TABLES
// ============================================================================

const MASONRY_STRENGTH_IS1905: Record<string, Record<string, number>> = {
  // Unit strength -> Mortar type -> Basic compressive strength (MPa)
  '3.5': { M1: 0.75, M2: 0.6, M3: 0.5 },
  '5.0': { M1: 0.9, M2: 0.75, M3: 0.6 },
  '7.5': { M1: 1.2, M2: 1.0, M3: 0.85 },
  '10.0': { M1: 1.5, M2: 1.25, M3: 1.05 },
  '12.5': { M1: 1.85, M2: 1.55, M3: 1.3 },
  '15.0': { M1: 2.15, M2: 1.8, M3: 1.5 },
  '17.5': { M1: 2.45, M2: 2.05, M3: 1.7 },
  '20.0': { M1: 2.75, M2: 2.3, M3: 1.9 },
  '25.0': { M1: 3.3, M2: 2.75, M3: 2.3 },
  '30.0': { M1: 3.8, M2: 3.15, M3: 2.65 },
  '35.0': { M1: 4.3, M2: 3.55, M3: 3.0 },
  '40.0': { M1: 4.75, M2: 3.95, M3: 3.3 }
};

const CHARACTERISTIC_STRENGTH_EC6: Record<string, Record<string, number>> = {
  // fb (unit strength) -> fm (mortar strength) -> fk (characteristic strength)
  '2.5': { '2.5': 1.4, '5': 1.8, '10': 2.2 },
  '5': { '2.5': 2.0, '5': 2.5, '10': 3.1 },
  '10': { '2.5': 3.2, '5': 4.0, '10': 5.0 },
  '15': { '2.5': 4.2, '5': 5.2, '10': 6.6 },
  '20': { '2.5': 5.1, '5': 6.3, '10': 8.0 },
  '30': { '2.5': 6.6, '5': 8.2, '10': 10.4 },
  '40': { '2.5': 8.0, '5': 9.9, '10': 12.5 }
};

// ============================================================================
// MASONRY WALL DESIGNER CLASS
// ============================================================================

export class MasonryWallDesigner {
  private code: MasonryDesignCode;

  constructor(code: MasonryDesignCode = 'IS1905') {
    this.code = code;
  }

  /**
   * Calculate basic/characteristic compressive strength of masonry
   */
  calculateMasonryStrength(material: MasonryMaterial): {
    basicStrength: number;
    designStrength: number;
    elasticModulus: number;
    shearStrength: number;
  } {
    let basicStrength: number;
    let partialSafetyFactor: number;
    let elasticModulusFactor: number;
    let shearStrength: number;

    switch (this.code) {
      case 'IS1905':
        basicStrength = this.getIS1905Strength(material);
        partialSafetyFactor = 2.5; // Safety factor for URM
        elasticModulusFactor = 550; // E = 550 * fm
        shearStrength = Math.min(0.5, 0.1 + 0.1 * basicStrength);
        break;

      case 'EC6':
        basicStrength = this.getEC6Strength(material);
        partialSafetyFactor = 2.0; // γM for Category II masonry
        elasticModulusFactor = 1000; // E = 1000 * fk
        shearStrength = 0.2 + 0.1 * basicStrength; // Simplified
        break;

      case 'TMS402':
        basicStrength = this.getTMS402Strength(material);
        partialSafetyFactor = 2.5;
        elasticModulusFactor = 700; // Em = 700 * f'm
        shearStrength = 0.5 * Math.sqrt(basicStrength);
        break;

      case 'BS5628':
        basicStrength = this.getBS5628Strength(material);
        partialSafetyFactor = 2.5; // γm for Category of manufacturing control
        elasticModulusFactor = 900;
        shearStrength = 0.15 + 0.06 * basicStrength;
        break;

      default:
        throw new Error(`Unsupported design code: ${this.code}`);
    }

    return {
      basicStrength,
      designStrength: basicStrength / partialSafetyFactor,
      elasticModulus: material.E || basicStrength * elasticModulusFactor,
      shearStrength
    };
  }

  private getIS1905Strength(material: MasonryMaterial): number {
    // Find closest unit strength
    const strengths = Object.keys(MASONRY_STRENGTH_IS1905).map(Number);
    const closestStrength = strengths.reduce((prev, curr) =>
      Math.abs(curr - material.unitStrength) < Math.abs(prev - material.unitStrength) ? curr : prev
    );

    const mortarCategory = this.getMortarCategoryIS1905(material.mortarStrength);
    return MASONRY_STRENGTH_IS1905[closestStrength.toString()][mortarCategory] || 1.0;
  }

  private getMortarCategoryIS1905(mortarStrength: number): string {
    if (mortarStrength >= 10) return 'M1';
    if (mortarStrength >= 5) return 'M2';
    return 'M3';
  }

  private getEC6Strength(material: MasonryMaterial): number {
    // Simplified characteristic strength calculation per EC6
    const fb = material.unitStrength;
    const fm = material.mortarStrength;
    const K = this.getKFactorEC6(material.type);
    
    // fk = K * fb^0.7 * fm^0.3
    return K * Math.pow(fb, 0.7) * Math.pow(fm, 0.3);
  }

  private getKFactorEC6(type: MasonryMaterial['type']): number {
    switch (type) {
      case 'clay-brick': return 0.55;
      case 'calcium-silicate': return 0.55;
      case 'concrete-block': return 0.45;
      case 'aac': return 0.45;
      case 'stone': return 0.45;
      default: return 0.45;
    }
  }

  private getTMS402Strength(material: MasonryMaterial): number {
    // f'm based on unit strength and mortar type
    const unitNet = material.unitStrength;
    const mortarFactor = material.mortarType === 'S' ? 1.0 :
                         material.mortarType === 'N' ? 0.9 : 0.8;
    
    // Simplified f'm = 0.75 * unit strength * mortar factor
    return 0.75 * unitNet * mortarFactor;
  }

  private getBS5628Strength(material: MasonryMaterial): number {
    // Similar to IS 1905 approach
    return this.getIS1905Strength(material) * 1.1; // Slight adjustment
  }

  /**
   * Calculate slenderness ratio and capacity reduction factor
   */
  calculateSlenderness(wall: MasonryWall): {
    slendernessRatio: number;
    capacityReductionFactor: number;
    effectiveThickness: number;
    status: 'OK' | 'SLENDER' | 'EXCEED_LIMIT';
  } {
    // Effective thickness
    let effectiveThickness = wall.thickness;
    
    // Consider flanges if present
    if (wall.flanges && wall.flanges.length > 0) {
      // Effective thickness increases with stiffening flanges
      const flangeContribution = wall.flanges.reduce((sum, flange) => {
        const effectiveFlangeLenth = Math.min(flange.length, 6 * flange.thickness);
        return sum + effectiveFlangeLenth * flange.thickness / wall.length;
      }, 0);
      effectiveThickness += flangeContribution * 0.3;
    }

    // Slenderness ratio
    const slendernessRatio = wall.effectiveHeight / effectiveThickness;

    // Limits and reduction factor based on code
    let limit: number;
    let capacityReductionFactor: number;

    switch (this.code) {
      case 'IS1905':
        limit = 27;
        // Capacity reduction factor from IS 1905 Table 5
        capacityReductionFactor = this.getIS1905ReductionFactor(slendernessRatio, wall.eccentricity || 0, effectiveThickness);
        break;

      case 'EC6':
        limit = 27;
        capacityReductionFactor = this.getEC6ReductionFactor(slendernessRatio, wall.eccentricity || 0, effectiveThickness);
        break;

      case 'TMS402':
        limit = 30;
        capacityReductionFactor = this.getTMS402ReductionFactor(slendernessRatio);
        break;

      case 'BS5628':
        limit = 27;
        capacityReductionFactor = this.getBS5628ReductionFactor(slendernessRatio, wall.eccentricity || 0, effectiveThickness);
        break;

      default:
        limit = 27;
        capacityReductionFactor = 1.0;
    }

    const status = slendernessRatio > limit ? 'EXCEED_LIMIT' :
                   slendernessRatio > 18 ? 'SLENDER' : 'OK';

    return {
      slendernessRatio,
      capacityReductionFactor,
      effectiveThickness,
      status
    };
  }

  private getIS1905ReductionFactor(SR: number, e: number, t: number): number {
    // Eccentricity ratio
    const er = e / t;
    
    // Simplified reduction factor (Table 5 of IS 1905)
    if (SR <= 6) {
      return er <= 1/6 ? 1.0 : (1 - 2 * er);
    } else if (SR <= 18) {
      const factor1 = 1 - (SR - 6) / 60;
      const factor2 = 1 - 2 * er;
      return Math.min(factor1, factor2);
    } else {
      const factor1 = 1 - (SR - 6) / 60 - Math.pow((SR - 18) / 30, 2);
      const factor2 = 1 - 2 * er;
      return Math.max(0.2, Math.min(factor1, factor2));
    }
  }

  private getEC6ReductionFactor(SR: number, e: number, t: number): number {
    // Φ factor per EN 1996-1-1
    const emk = Math.max(0.05 * t, e); // Minimum eccentricity
    const Φ1 = 1 - 2 * emk / t;
    
    // Slenderness factor
    const Φ2 = SR <= 15 ? 1.0 : (0.85 - 0.0011 * Math.pow(SR - 15, 2));
    
    return Math.min(Φ1, Φ2, 1.0);
  }

  private getTMS402ReductionFactor(SR: number): number {
    // R factor for slenderness
    if (SR <= 99) {
      return 1 - Math.pow(SR / 140, 2);
    } else {
      return Math.pow(70 / SR, 2);
    }
  }

  private getBS5628ReductionFactor(SR: number, e: number, t: number): number {
    // Similar to IS 1905 with small adjustments
    return this.getIS1905ReductionFactor(SR, e, t) * 0.95;
  }

  /**
   * Design unreinforced masonry wall for axial load and moment
   */
  designURMWall(
    wall: MasonryWall,
    material: MasonryMaterial,
    loads: MasonryLoads
  ): {
    capacity: number;
    demand: number;
    utilizationRatio: number;
    status: 'PASS' | 'FAIL';
    recommendations: string[];
    details: {
      basicStrength: number;
      designStrength: number;
      slendernessRatio: number;
      reductionFactor: number;
      effectiveArea: number;
    };
  } {
    const recommendations: string[] = [];

    // Calculate masonry strength
    const strength = this.calculateMasonryStrength(material);

    // Calculate slenderness
    const slenderness = this.calculateSlenderness(wall);

    if (slenderness.status === 'EXCEED_LIMIT') {
      recommendations.push(`Slenderness ratio ${slenderness.slendernessRatio.toFixed(1)} exceeds limit. Reduce height or increase thickness.`);
    }

    // Calculate effective area (deduct openings)
    let effectiveArea = wall.length * wall.thickness;
    if (wall.openings) {
      for (const opening of wall.openings) {
        effectiveArea -= opening.width * wall.thickness;
      }
    }
    effectiveArea = effectiveArea / 1e6; // Convert to m²

    // Calculate eccentricity
    let totalEccentricity = wall.eccentricity || 0;
    if (loads.momentTop || loads.momentBottom) {
      const maxMoment = Math.max(Math.abs(loads.momentTop || 0), Math.abs(loads.momentBottom || 0));
      const additionalEcc = maxMoment * 1e6 / (loads.axialLoad * 1e3); // mm
      totalEccentricity += additionalEcc;
    }

    // Update eccentricity for reduction factor calculation
    wall.eccentricity = totalEccentricity;
    const updatedSlenderness = this.calculateSlenderness(wall);

    // Calculate capacity
    const capacity = strength.designStrength * 1e3 * effectiveArea * 
                     updatedSlenderness.capacityReductionFactor; // kN

    // Demand
    const demand = loads.axialLoad;

    // Utilization
    const utilizationRatio = demand / capacity;

    // Recommendations
    if (utilizationRatio > 0.9 && utilizationRatio <= 1.0) {
      recommendations.push('Wall is highly stressed. Consider increasing thickness or using stronger masonry.');
    }
    if (utilizationRatio > 1.0) {
      recommendations.push('Wall capacity exceeded. Increase thickness, use stronger masonry, or add reinforcement.');
    }
    if (totalEccentricity > wall.thickness / 3) {
      recommendations.push('High eccentricity. Consider adding ties to reduce eccentricity.');
    }

    return {
      capacity,
      demand,
      utilizationRatio,
      status: utilizationRatio <= 1.0 ? 'PASS' : 'FAIL',
      recommendations,
      details: {
        basicStrength: strength.basicStrength,
        designStrength: strength.designStrength,
        slendernessRatio: updatedSlenderness.slendernessRatio,
        reductionFactor: updatedSlenderness.capacityReductionFactor,
        effectiveArea
      }
    };
  }

  /**
   * Design reinforced masonry wall
   */
  designRMWall(
    wall: MasonryWall,
    material: MasonryMaterial,
    loads: MasonryLoads
  ): {
    axialCapacity: number;
    momentCapacity: number;
    shearCapacity: number;
    demand: {
      axial: number;
      moment: number;
      shear: number;
    };
    utilizationRatios: {
      axial: number;
      moment: number;
      shear: number;
      combined: number;
    };
    status: 'PASS' | 'FAIL';
    reinforcementDetails: {
      verticalArea: number;
      horizontalArea: number;
      verticalRatio: number;
      horizontalRatio: number;
    };
  } {
    if (!wall.reinforcement) {
      throw new Error('Reinforcement details required for RM wall design');
    }

    const strength = this.calculateMasonryStrength(material);
    const fy = wall.reinforcement.vertical.fy;

    // Reinforcement areas
    const verticalArea = Math.PI * Math.pow(wall.reinforcement.vertical.diameter / 2, 2) *
                         wall.length / wall.reinforcement.vertical.spacing;
    const horizontalArea = Math.PI * Math.pow(wall.reinforcement.horizontal.diameter / 2, 2) *
                           wall.height / wall.reinforcement.horizontal.spacing;

    // Gross area
    const grossArea = wall.length * wall.thickness; // mm²

    // Reinforcement ratios
    const verticalRatio = verticalArea / grossArea;
    const horizontalRatio = horizontalArea / grossArea;

    // Axial capacity (simplified)
    const axialCapacity = 0.8 * (strength.designStrength * 1e3 * (grossArea - verticalArea) + 
                                  fy * verticalArea) / 1e6; // kN

    // Moment capacity (simplified rectangular stress block)
    const d = wall.thickness - (wall.reinforcement.vertical.coverage || 40); // Effective depth
    const momentCapacity = 0.9 * verticalArea * fy * (d - 0.42 * verticalArea * fy / 
                           (0.85 * strength.designStrength * wall.length)) / 1e6; // kNm

    // Shear capacity
    const Vm = 0.17 * Math.sqrt(strength.basicStrength) * wall.length * d / 1e6; // Masonry contribution
    const Vs = horizontalArea * fy * d / wall.reinforcement.horizontal.spacing / 1e6; // Steel contribution
    const shearCapacity = Vm + Vs; // kN

    // Demands
    const axialDemand = loads.axialLoad;
    const momentDemand = Math.max(
      Math.abs(loads.momentTop || 0),
      Math.abs(loads.momentBottom || 0),
      loads.lateralLoad ? loads.lateralLoad * wall.height * wall.length / 8 / 1e6 : 0
    );
    const shearDemand = loads.lateralLoad ? loads.lateralLoad * wall.length * wall.height / 2 / 1e6 : 0;

    // Utilization ratios
    const axialRatio = axialDemand / axialCapacity;
    const momentRatio = momentDemand / momentCapacity;
    const shearRatio = shearDemand / shearCapacity;
    const combinedRatio = axialRatio + momentRatio; // Simplified interaction

    return {
      axialCapacity,
      momentCapacity,
      shearCapacity,
      demand: {
        axial: axialDemand,
        moment: momentDemand,
        shear: shearDemand
      },
      utilizationRatios: {
        axial: axialRatio,
        moment: momentRatio,
        shear: shearRatio,
        combined: combinedRatio
      },
      status: Math.max(axialRatio, momentRatio, shearRatio, combinedRatio) <= 1.0 ? 'PASS' : 'FAIL',
      reinforcementDetails: {
        verticalArea,
        horizontalArea,
        verticalRatio,
        horizontalRatio
      }
    };
  }

  /**
   * Design masonry wall for lateral loads (wind/seismic)
   */
  designForLateralLoad(
    wall: MasonryWall,
    material: MasonryMaterial,
    lateralPressure: number, // kPa
    isOutOfPlane: boolean = true
  ): {
    bendingCapacity: number;
    shearCapacity: number;
    demand: {
      bending: number;
      shear: number;
    };
    utilizationRatios: {
      bending: number;
      shear: number;
    };
    status: 'PASS' | 'FAIL';
  } {
    const strength = this.calculateMasonryStrength(material);

    if (isOutOfPlane) {
      // Out-of-plane bending (wall spanning vertically)
      const w = lateralPressure * wall.length / 1000; // kN/m
      const L = wall.effectiveHeight / 1000; // m

      // Bending demand (simply supported)
      const bendingDemand = w * L * L / 8; // kNm/m

      // Section modulus per meter width
      const Z = 1000 * wall.thickness * wall.thickness / 6; // mm³/m

      // Flexural tensile strength (approximate)
      const ft = 0.25 * strength.basicStrength; // MPa

      // Bending capacity
      const bendingCapacity = ft * Z / 1e6; // kNm/m

      // Shear
      const shearDemand = w * L / 2; // kN/m
      const shearCapacity = strength.shearStrength * 1000 * wall.thickness / 1e6; // kN/m

      return {
        bendingCapacity,
        shearCapacity,
        demand: {
          bending: bendingDemand,
          shear: shearDemand
        },
        utilizationRatios: {
          bending: bendingDemand / bendingCapacity,
          shear: shearDemand / shearCapacity
        },
        status: Math.max(bendingDemand / bendingCapacity, shearDemand / shearCapacity) <= 1.0 ? 'PASS' : 'FAIL'
      };
    } else {
      // In-plane shear wall
      const V = lateralPressure * wall.height * wall.length / 1e6; // kN

      // In-plane shear capacity
      const An = wall.length * wall.thickness; // mm²
      const fv = strength.shearStrength; // MPa
      const shearCapacity = fv * An / 1e3; // kN

      // In-plane bending (cantilever assumption)
      const M = V * wall.height / 1000; // kNm
      const I = wall.thickness * Math.pow(wall.length, 3) / 12; // mm⁴
      const y = wall.length / 2; // mm
      const ft = 0.1 * strength.basicStrength; // Reduced tensile strength for in-plane
      const bendingCapacity = ft * I / y / 1e6; // kNm

      return {
        bendingCapacity,
        shearCapacity,
        demand: {
          bending: M,
          shear: V
        },
        utilizationRatios: {
          bending: M / bendingCapacity,
          shear: V / shearCapacity
        },
        status: Math.max(M / bendingCapacity, V / shearCapacity) <= 1.0 ? 'PASS' : 'FAIL'
      };
    }
  }
}

// ============================================================================
// LINTEL DESIGN CLASS
// ============================================================================

export class MasonryLintelDesigner {
  private code: MasonryDesignCode;

  constructor(code: MasonryDesignCode = 'IS1905') {
    this.code = code;
  }

  /**
   * Design a masonry lintel or RC lintel over opening
   */
  designLintel(
    openingWidth: number, // mm
    wallThickness: number, // mm
    wallLoad: number, // kN/m (load above lintel per meter)
    concentratedLoad: number = 0, // kN (point load on lintel)
    lintelType: 'masonry' | 'rc' | 'steel'
  ): {
    span: number;
    bearingLength: number;
    depth: number;
    bendingMoment: number;
    shearForce: number;
    reinforcement?: {
      mainBars: string;
      stirrups: string;
    };
    steelSection?: string;
  } {
    // Effective span
    const bearingLength = Math.max(150, openingWidth / 10);
    const span = openingWidth + bearingLength; // mm

    // Load calculation
    const triangularLoadHeight = Math.min(span * 0.6, 2000); // 60-degree dispersion
    const totalUDL = wallLoad; // kN/m

    // Bending moment
    const L = span / 1000; // m
    const M = totalUDL * L * L / 8 + concentratedLoad * L / 4; // kNm

    // Shear force
    const V = totalUDL * L / 2 + concentratedLoad / 2; // kN

    // Minimum depth
    let depth: number;
    let reinforcement: { mainBars: string; stirrups: string } | undefined;
    let steelSection: string | undefined;

    switch (lintelType) {
      case 'rc':
        depth = Math.max(L * 1000 / 12, 150); // Span/12 rule
        
        // Reinforcement calculation (simplified)
        const fck = 25; // MPa
        const fy = 500; // MPa
        const d = depth - 40; // Effective depth
        const b = wallThickness;
        
        const Mu = M * 1.5; // Factored moment
        const Ast = Mu * 1e6 / (0.87 * fy * 0.9 * d); // mm²

        // Bar selection
        const numBars = Math.ceil(Ast / (Math.PI * 64)); // 16mm bars
        reinforcement = {
          mainBars: `${numBars} - 16φ (Ast = ${Ast.toFixed(0)} mm²)`,
          stirrups: '8φ @ 150 c/c'
        };
        break;

      case 'steel':
        depth = Math.max(L * 1000 / 15, 100);
        // Select steel angle or I-section
        const Zreq = M * 1e6 / (250 * 0.66); // For Fe250, σ_allow = 165 MPa
        steelSection = `ISA 75x75x8 or ISLB 100 (Z = ${Zreq.toFixed(0)} mm³ required)`;
        break;

      case 'masonry':
        depth = Math.max(L * 1000 / 8, 200); // More conservative for masonry
        break;
    }

    return {
      span,
      bearingLength,
      depth: Math.ceil(depth / 50) * 50, // Round to 50mm
      bendingMoment: M,
      shearForce: V,
      reinforcement,
      steelSection
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  MasonryWallDesigner,
  MasonryLintelDesigner,
  MASONRY_STRENGTH_IS1905,
  CHARACTERISTIC_STRENGTH_EC6
};
