/**
 * ============================================================================
 * SEISMIC DETAILING ENGINE
 * ============================================================================
 * 
 * Comprehensive seismic detailing requirements for reinforced concrete and
 * steel structures per multiple international codes.
 * 
 * Features:
 * - Ductility classification and requirements
 * - Special moment frame detailing
 * - Special shear wall detailing
 * - Beam-column joint design
 * - Capacity design principles
 * - Confinement requirements
 * 
 * Design Codes:
 * - IS 13920:2016 - Ductile Detailing of RC Structures
 * - IS 16700:2017 - Criteria for Structural Safety of Tall Buildings
 * - ACI 318-19 Chapter 18 - Earthquake-Resistant Structures
 * - AISC 341-22 - Seismic Provisions for Structural Steel
 * - EN 1998-1 (Eurocode 8) - Seismic Design
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ConcreteProperties {
  fck: number; // MPa
  Ec?: number; // MPa
}

export interface SteelProperties {
  fy: number; // MPa
  fu: number; // MPa
  Es?: number; // MPa
}

export interface BeamGeometry {
  width: number; // mm
  depth: number; // mm
  clearSpan: number; // mm
  effectiveDepth?: number; // mm
}

export interface ColumnGeometry {
  width: number; // mm
  depth: number; // mm
  height: number; // mm
  effectiveLength?: number; // mm
}

export interface JointDimensions {
  beamWidth: number;
  beamDepth: number;
  columnWidth: number;
  columnDepth: number;
}

export type DuctilityClass = 'DCL' | 'DCM' | 'DCH' | 'OMF' | 'IMF' | 'SMF' | 'ORDINARY' | 'SPECIAL';
export type SeismicZone = 'II' | 'III' | 'IV' | 'V' | 'A' | 'B' | 'C' | 'D' | 'E';

// ============================================================================
// IS 13920:2016 DETAILING
// ============================================================================

export class IS13920Detailing {
  /**
   * Check beam detailing requirements
   */
  static beamDetailing(
    beam: BeamGeometry,
    concrete: ConcreteProperties,
    steel: SteelProperties,
    reinforcement: {
      topBars: { diameter: number; count: number }[];
      bottomBars: { diameter: number; count: number }[];
      stirrups: { diameter: number; spacing: number };
    }
  ): {
    checks: {
      name: string;
      required: string;
      provided: string;
      status: 'PASS' | 'FAIL';
    }[];
    overallStatus: 'COMPLIANT' | 'NON-COMPLIANT';
    recommendations: string[];
  } {
    const b = beam.width;
    const D = beam.depth;
    const d = beam.effectiveDepth || D - 50;
    const Ln = beam.clearSpan;
    const fck = concrete.fck;
    const fy = steel.fy;

    const checks: { name: string; required: string; provided: string; status: 'PASS' | 'FAIL' }[] = [];
    const recommendations: string[] = [];

    // 1. Minimum width (Clause 6.1.2)
    const minWidth = 200;
    checks.push({
      name: 'Minimum beam width',
      required: `≥ ${minWidth} mm`,
      provided: `${b} mm`,
      status: b >= minWidth ? 'PASS' : 'FAIL'
    });

    // 2. Width-to-depth ratio (Clause 6.1.3)
    const minWidthDepthRatio = 0.3;
    const actualRatio = b / D;
    checks.push({
      name: 'Width/Depth ratio',
      required: `≥ ${minWidthDepthRatio}`,
      provided: actualRatio.toFixed(2),
      status: actualRatio >= minWidthDepthRatio ? 'PASS' : 'FAIL'
    });

    // 3. Depth-to-span ratio (Clause 6.1.4)
    const minDepthSpanRatio = 0.25;
    const depthSpanRatio = D / Ln;
    checks.push({
      name: 'Depth/Span ratio',
      required: `≥ ${minDepthSpanRatio}`,
      provided: depthSpanRatio.toFixed(3),
      status: depthSpanRatio >= minDepthSpanRatio ? 'PASS' : 'FAIL'
    });

    // 4. Minimum longitudinal reinforcement (Clause 6.2.1)
    const topArea = reinforcement.topBars.reduce((sum, bar) => 
      sum + bar.count * Math.PI * bar.diameter * bar.diameter / 4, 0);
    const bottomArea = reinforcement.bottomBars.reduce((sum, bar) => 
      sum + bar.count * Math.PI * bar.diameter * bar.diameter / 4, 0);

    const minRho = Math.max(0.24 * Math.sqrt(fck) / fy, 0.0024);
    const minAs = minRho * b * d;
    
    checks.push({
      name: 'Minimum tension steel',
      required: `≥ ${minAs.toFixed(0)} mm² (${(minRho * 100).toFixed(2)}%)`,
      provided: `${Math.min(topArea, bottomArea).toFixed(0)} mm²`,
      status: Math.min(topArea, bottomArea) >= minAs ? 'PASS' : 'FAIL'
    });

    // 5. Maximum reinforcement (Clause 6.2.2)
    const maxRho = 0.025;
    const maxAs = maxRho * b * d;
    const actualRho = Math.max(topArea, bottomArea) / (b * d);
    
    checks.push({
      name: 'Maximum reinforcement',
      required: `≤ 2.5%`,
      provided: `${(actualRho * 100).toFixed(2)}%`,
      status: actualRho <= maxRho ? 'PASS' : 'FAIL'
    });

    // 6. Bottom steel at supports (Clause 6.2.3)
    const minBottomAtSupport = topArea * 0.5;
    checks.push({
      name: 'Bottom steel at support (≥ 50% of top)',
      required: `≥ ${minBottomAtSupport.toFixed(0)} mm²`,
      provided: `${bottomArea.toFixed(0)} mm²`,
      status: bottomArea >= minBottomAtSupport ? 'PASS' : 'FAIL'
    });

    // 7. Stirrup spacing (Clause 6.3.5)
    const stirrupDia = reinforcement.stirrups.diameter;
    const stirrupSpacing = reinforcement.stirrups.spacing;
    const mainBarDia = Math.max(
      ...reinforcement.topBars.map(b => b.diameter),
      ...reinforcement.bottomBars.map(b => b.diameter)
    );

    // In plastic hinge zone (2D from face of support)
    const maxSpacingPlasticHinge = Math.min(d / 4, 8 * mainBarDia, 24 * stirrupDia, 300);
    
    checks.push({
      name: 'Stirrup spacing in plastic hinge zone',
      required: `≤ ${maxSpacingPlasticHinge.toFixed(0)} mm`,
      provided: `${stirrupSpacing} mm`,
      status: stirrupSpacing <= maxSpacingPlasticHinge ? 'PASS' : 'FAIL'
    });

    // 8. Minimum stirrup diameter (Clause 6.3.2)
    const minStirrupDia = Math.max(6, mainBarDia / 4);
    checks.push({
      name: 'Minimum stirrup diameter',
      required: `≥ ${minStirrupDia.toFixed(0)} mm`,
      provided: `${stirrupDia} mm`,
      status: stirrupDia >= minStirrupDia ? 'PASS' : 'FAIL'
    });

    // Recommendations
    const failedChecks = checks.filter(c => c.status === 'FAIL');
    if (failedChecks.length > 0) {
      recommendations.push('Address all failed checks before construction');
    }
    if (stirrupSpacing > maxSpacingPlasticHinge) {
      recommendations.push(`Reduce stirrup spacing to ${maxSpacingPlasticHinge}mm in plastic hinge zones (2D from column face)`);
    }

    return {
      checks,
      overallStatus: failedChecks.length === 0 ? 'COMPLIANT' : 'NON-COMPLIANT',
      recommendations
    };
  }

  /**
   * Check column detailing requirements
   */
  static columnDetailing(
    column: ColumnGeometry,
    concrete: ConcreteProperties,
    steel: SteelProperties,
    reinforcement: {
      mainBars: { diameter: number; count: number };
      ties: { diameter: number; spacing: number };
    },
    axialLoadRatio: number // P/(fck * Ag)
  ): {
    checks: { name: string; required: string; provided: string; status: 'PASS' | 'FAIL' }[];
    overallStatus: 'COMPLIANT' | 'NON-COMPLIANT';
    recommendations: string[];
  } {
    const b = Math.min(column.width, column.depth);
    const D = Math.max(column.width, column.depth);
    const H = column.height;
    const fck = concrete.fck;
    const fy = steel.fy;

    const checks: { name: string; required: string; provided: string; status: 'PASS' | 'FAIL' }[] = [];
    const recommendations: string[] = [];

    // 1. Minimum dimension (Clause 7.1.1)
    const minDimension = 300;
    checks.push({
      name: 'Minimum column dimension',
      required: `≥ ${minDimension} mm`,
      provided: `${b} mm`,
      status: b >= minDimension ? 'PASS' : 'FAIL'
    });

    // 2. Aspect ratio (Clause 7.1.2)
    const maxAspectRatio = 3;
    const aspectRatio = D / b;
    checks.push({
      name: 'Aspect ratio (D/b)',
      required: `≤ ${maxAspectRatio}`,
      provided: aspectRatio.toFixed(2),
      status: aspectRatio <= maxAspectRatio ? 'PASS' : 'FAIL'
    });

    // 3. Longitudinal reinforcement ratio (Clause 7.2)
    const Ag = column.width * column.depth;
    const mainBarArea = reinforcement.mainBars.count * Math.PI * 
                        reinforcement.mainBars.diameter * reinforcement.mainBars.diameter / 4;
    const rho = mainBarArea / Ag;

    const minRho = 0.01; // 1%
    const maxRho = 0.04; // 4% (or 6% at lap locations)
    
    checks.push({
      name: 'Min longitudinal steel ratio',
      required: `≥ ${minRho * 100}%`,
      provided: `${(rho * 100).toFixed(2)}%`,
      status: rho >= minRho ? 'PASS' : 'FAIL'
    });

    checks.push({
      name: 'Max longitudinal steel ratio',
      required: `≤ ${maxRho * 100}%`,
      provided: `${(rho * 100).toFixed(2)}%`,
      status: rho <= maxRho ? 'PASS' : 'FAIL'
    });

    // 4. Minimum number of bars (Clause 7.2.1)
    const minBars = column.width === column.depth ? 8 : 6;
    checks.push({
      name: 'Minimum number of bars',
      required: `≥ ${minBars}`,
      provided: `${reinforcement.mainBars.count}`,
      status: reinforcement.mainBars.count >= minBars ? 'PASS' : 'FAIL'
    });

    // 5. Tie spacing (Clause 7.3)
    const tieDia = reinforcement.ties.diameter;
    const tieSpacing = reinforcement.ties.spacing;
    const mainDia = reinforcement.mainBars.diameter;

    // Special confining reinforcement spacing
    const Lo = Math.max(H / 6, b, 450); // Length of confinement zone
    const maxTieSpacingConfined = Math.min(b / 4, 6 * mainDia, 100);
    
    checks.push({
      name: 'Tie spacing in confinement zone (Lo)',
      required: `≤ ${maxTieSpacingConfined.toFixed(0)} mm for Lo = ${Lo.toFixed(0)} mm`,
      provided: `${tieSpacing} mm`,
      status: tieSpacing <= maxTieSpacingConfined ? 'PASS' : 'FAIL'
    });

    // 6. Tie diameter (Clause 7.3.1)
    const minTieDia = Math.max(8, mainDia / 4);
    checks.push({
      name: 'Minimum tie diameter',
      required: `≥ ${minTieDia.toFixed(0)} mm`,
      provided: `${tieDia} mm`,
      status: tieDia >= minTieDia ? 'PASS' : 'FAIL'
    });

    // 7. Axial load limit (Clause 7.4)
    const maxAxialRatio = 0.4;
    checks.push({
      name: 'Axial load ratio P/(fck·Ag)',
      required: `≤ ${maxAxialRatio}`,
      provided: axialLoadRatio.toFixed(3),
      status: axialLoadRatio <= maxAxialRatio ? 'PASS' : 'FAIL'
    });

    if (axialLoadRatio > maxAxialRatio) {
      recommendations.push('Reduce axial load ratio by increasing column size or reducing loads');
    }

    const failedChecks = checks.filter(c => c.status === 'FAIL');

    return {
      checks,
      overallStatus: failedChecks.length === 0 ? 'COMPLIANT' : 'NON-COMPLIANT',
      recommendations
    };
  }

  /**
   * Calculate special confining reinforcement
   */
  static specialConfinementReinforcement(
    column: ColumnGeometry,
    concrete: ConcreteProperties,
    steel: SteelProperties,
    axialLoadRatio: number
  ): {
    confinementZoneLength: number;
    requiredAsh: number; // mm²
    maxSpacing: number;
    recommendedTies: {
      diameter: number;
      spacing: number;
      configuration: string;
    };
  } {
    const b = Math.min(column.width, column.depth);
    const D = Math.max(column.width, column.depth);
    const H = column.height;
    const fck = concrete.fck;
    const fy = steel.fy;

    // Confinement zone length (Clause 7.4.1)
    const Lo = Math.max(H / 6, b, 450);

    // Area of special confining reinforcement (Clause 7.4.7)
    const cover = 40;
    const Dk = D - 2 * cover; // Core dimension
    const Ag = b * D;
    const Ak = (b - 2 * cover) * Dk;

    // Required Ash
    const Ash1 = 0.18 * 100 * Dk * fck / fy * (Ag / Ak - 1);
    const Ash2 = 0.05 * 100 * Dk * fck / fy;
    const requiredAsh = Math.max(Ash1, Ash2);

    // Maximum spacing
    const maxSpacing = Math.min(b / 4, 100); // 6 * mainDia typically governs

    // Recommend ties
    let tieDia = 8;
    let numLegs = 2;
    
    let providedAsh = numLegs * Math.PI * tieDia * tieDia / 4;
    
    while (providedAsh / maxSpacing * 1000 < requiredAsh && tieDia <= 16) {
      if (numLegs < 4) {
        numLegs += 2;
      } else {
        tieDia += 2;
        numLegs = 2;
      }
      providedAsh = numLegs * Math.PI * tieDia * tieDia / 4;
    }

    return {
      confinementZoneLength: Lo,
      requiredAsh,
      maxSpacing,
      recommendedTies: {
        diameter: tieDia,
        spacing: Math.min(maxSpacing, 1000 * providedAsh / requiredAsh),
        configuration: `${numLegs}-legged ties`
      }
    };
  }

  /**
   * Beam-column joint check
   */
  static beamColumnJoint(
    joint: JointDimensions,
    concrete: ConcreteProperties,
    beamMoment: number, // kNm at joint
    columnAxial: number, // kN
    jointType: 'interior' | 'exterior' | 'corner'
  ): {
    jointShear: number;
    jointShearCapacity: number;
    utilizationRatio: number;
    status: 'PASS' | 'FAIL';
    jointReinforcement: {
      horizontalHoops: { diameter: number; spacing: number; legs: number };
      verticalTies?: { diameter: number; spacing: number };
    };
    recommendations: string[];
  } {
    const bj = Math.min(joint.columnWidth, joint.beamWidth + joint.columnDepth);
    const hj = joint.columnDepth;
    const hb = joint.beamDepth;
    const fck = concrete.fck;

    const recommendations: string[] = [];

    // Joint shear (simplified)
    const Vjoint = beamMoment * 1000 / (0.9 * hb) * 1.25; // Approximate

    // Joint shear capacity (Clause 8.2)
    let shearStrengthFactor: number;
    switch (jointType) {
      case 'interior':
        shearStrengthFactor = 1.2;
        break;
      case 'exterior':
        shearStrengthFactor = 1.0;
        break;
      case 'corner':
        shearStrengthFactor = 0.8;
        break;
    }

    const Vjc = shearStrengthFactor * Math.sqrt(fck) * bj * hj / 1000;

    const utilizationRatio = Vjoint / Vjc;

    // Joint reinforcement (Clause 8.3)
    const Ash = 0.5 * requiredBeamSteelInJoint(beamMoment, hb);
    const hoopDia = 10;
    const hoopArea = 2 * Math.PI * hoopDia * hoopDia / 4; // 2-legged
    const hoopSpacing = Math.min(150, hj / 4);

    function requiredBeamSteelInJoint(M: number, d: number): number {
      return M * 1e6 / (0.87 * 500 * 0.9 * d); // Approximate Ast
    }

    if (utilizationRatio > 1.0) {
      recommendations.push('Increase column size to improve joint shear capacity');
      recommendations.push('Consider using higher grade concrete');
    }

    if (utilizationRatio > 0.8) {
      recommendations.push('Ensure adequate anchorage of beam bars into joint');
    }

    return {
      jointShear: Vjoint,
      jointShearCapacity: Vjc,
      utilizationRatio,
      status: utilizationRatio <= 1.0 ? 'PASS' : 'FAIL',
      jointReinforcement: {
        horizontalHoops: {
          diameter: hoopDia,
          spacing: hoopSpacing,
          legs: 2
        }
      },
      recommendations
    };
  }
}

// ============================================================================
// ACI 318 SEISMIC DETAILING
// ============================================================================

export class ACI318SeismicDetailing {
  /**
   * Special moment frame beam requirements
   */
  static smfBeamRequirements(
    beam: BeamGeometry,
    fc: number, // psi
    fy: number // psi
  ): {
    dimensionRequirements: {
      minWidth: number;
      minWidthToDepth: number;
      minSpanToDepth: number;
    };
    reinforcementLimits: {
      minRho: number;
      maxRho: number;
      minTopAtSupport: string;
      minBottomAtSupport: string;
    };
    transverseRequirements: {
      hoopSpacing: number;
      hoopZoneLength: number;
      firstHoopLocation: number;
    };
  } {
    const bw = beam.width;
    const d = beam.effectiveDepth || beam.depth - 50;
    const h = beam.depth;
    const ln = beam.clearSpan;

    // Section 18.6.2 - Dimensional limits
    const minWidth = Math.max(250, 0.3 * h); // mm
    const minWidthToDepth = 0.3;
    const minSpanToDepth = 4;

    // Section 18.6.3 - Reinforcement limits
    const minRho = Math.max(3 * Math.sqrt(fc) / fy, 200 / fy);
    const maxRho = 0.025;

    // Section 18.6.4 - Transverse reinforcement
    // Hoop spacing in plastic hinge regions
    const maxHoopSpacing = Math.min(d / 4, 6 * 25, 150); // Assuming 25mm main bars

    // Plastic hinge zone length
    const hoopZoneLength = 2 * h;

    // First hoop location
    const firstHoopLocation = 50;

    return {
      dimensionRequirements: {
        minWidth,
        minWidthToDepth,
        minSpanToDepth
      },
      reinforcementLimits: {
        minRho,
        maxRho,
        minTopAtSupport: '2 bars continuous',
        minBottomAtSupport: '≥ 50% of top steel, min 2 bars'
      },
      transverseRequirements: {
        hoopSpacing: maxHoopSpacing,
        hoopZoneLength,
        firstHoopLocation
      }
    };
  }

  /**
   * Special moment frame column requirements
   */
  static smfColumnRequirements(
    column: ColumnGeometry,
    fc: number,
    fy: number,
    Pu: number, // Factored axial load
    Ag: number // Gross area
  ): {
    dimensionRequirements: {
      minDimension: number;
      maxAspectRatio: number;
    };
    longitudinalSteel: {
      minRatio: number;
      maxRatio: number;
      minBars: number;
    };
    transverseSteel: {
      confinementZone: number;
      maxSpacing: number;
      volumetricRatio: number;
    };
    strongColumnCheck: string;
  } {
    const b = Math.min(column.width, column.depth);
    const h = Math.max(column.width, column.depth);
    const lu = column.height;

    // Section 18.7.2 - Dimensional limits
    const minDimension = 300; // 12 inches
    const maxAspectRatio = 2.5;

    // Section 18.7.4 - Longitudinal reinforcement
    const minRho = 0.01;
    const maxRho = 0.06;
    const minBars = 6;

    // Section 18.7.5 - Transverse reinforcement
    // Confinement zone (lo)
    const lo = Math.max(h, lu / 6, 450);

    // Maximum spacing in confinement zone
    const maxSpacing = Math.min(b / 4, 6 * 25, 150); // so/3 for high axial

    // Volumetric ratio of spiral/circular hoops
    const rhoshMin = 0.12 * fc / fy;
    const volumetricRatio = Math.max(rhoshMin, 0.45 * (Ag / (Ag * 0.85) - 1) * fc / fy);

    // Strong column - weak beam requirement
    const strongColumnCheck = 'ΣMnc ≥ 1.2 × ΣMnb at each joint';

    return {
      dimensionRequirements: {
        minDimension,
        maxAspectRatio
      },
      longitudinalSteel: {
        minRatio: minRho,
        maxRatio: maxRho,
        minBars
      },
      transverseSteel: {
        confinementZone: lo,
        maxSpacing,
        volumetricRatio
      },
      strongColumnCheck
    };
  }

  /**
   * Beam-column joint requirements
   */
  static jointRequirements(
    jointType: 'interior' | 'exterior' | 'corner',
    fc: number,
    beamWidth: number,
    columnWidth: number,
    columnDepth: number
  ): {
    effectiveJointWidth: number;
    nominalShearStrength: number;
    transverseReinforcement: string;
    developmentLengthMultiplier: number;
  } {
    // Effective joint width (Section 18.8.4.1)
    const bj = Math.min(
      columnWidth,
      beamWidth + columnDepth,
      beamWidth + 2 * (columnWidth - beamWidth) / 2
    );

    // Nominal shear strength (Section 18.8.4.1)
    let gamma: number;
    switch (jointType) {
      case 'interior':
        gamma = 20;
        break;
      case 'exterior':
        gamma = 15;
        break;
      case 'corner':
        gamma = 12;
        break;
    }

    const Vn = gamma * Math.sqrt(fc) * bj * columnDepth / 1000; // kN

    // Development length multiplier for hooked bars
    const ldMultiplier = jointType === 'interior' ? 1.0 : 1.25;

    return {
      effectiveJointWidth: bj,
      nominalShearStrength: Vn,
      transverseReinforcement: 'Hoops per 18.8.3, spacing ≤ column lo spacing',
      developmentLengthMultiplier: ldMultiplier
    };
  }
}

// ============================================================================
// STEEL SEISMIC DETAILING (AISC 341)
// ============================================================================

export class AISC341Detailing {
  /**
   * Special moment frame requirements
   */
  static smfRequirements(
    beamSection: {
      depth: number;
      flangeWidth: number;
      flangeThickness: number;
      webThickness: number;
      Zx: number;
      ry: number;
    },
    columnSection: {
      depth: number;
      Zx: number;
    },
    Fy: number,
    Ry: number = 1.1 // Expected yield ratio
  ): {
    beamRequirements: {
      widthThicknessLimits: { flange: number; web: number };
      lateralBracingSpacing: number;
      protectedZoneLength: number;
    };
    connectionRequirements: {
      probablePlasticMoment: number;
      connectionStrength: number;
      panelZoneStrength: string;
    };
    columnRequirements: {
      strongColumnRatio: number;
      spliceLocation: string;
    };
  } {
    const d = beamSection.depth;
    const bf = beamSection.flangeWidth;
    const tf = beamSection.flangeThickness;
    const tw = beamSection.webThickness;
    const Zx = beamSection.Zx;
    const ry = beamSection.ry;

    // Width-thickness limits (Table D1.1)
    const flangeLimit = 0.30 * Math.sqrt(200000 / Fy);
    const webLimit = 2.45 * Math.sqrt(200000 / Fy);

    // Lateral bracing
    const Lb = 0.086 * ry * 200000 / Fy;

    // Protected zone
    const protectedZone = Math.min(d, bf);

    // Probable plastic moment
    const Mpr = 1.1 * Ry * Fy * Zx / 1e6; // kNm

    // Strong column - weak beam
    const columnMpr = 1.1 * Ry * Fy * columnSection.Zx / 1e6;
    const scwbRatio = columnMpr / Mpr;

    return {
      beamRequirements: {
        widthThicknessLimits: { flange: flangeLimit, web: webLimit },
        lateralBracingSpacing: Lb,
        protectedZoneLength: protectedZone
      },
      connectionRequirements: {
        probablePlasticMoment: Mpr,
        connectionStrength: 1.1 * Mpr,
        panelZoneStrength: 'φvVn ≥ Σ(Mpr/db)'
      },
      columnRequirements: {
        strongColumnRatio: scwbRatio,
        spliceLocation: 'Middle half of story height, 4ft min from beam flange'
      }
    };
  }

  /**
   * Reduced beam section (RBS) design
   */
  static rbsDesign(
    beamSection: {
      depth: number;
      flangeWidth: number;
      Zx: number;
    },
    Fy: number,
    spanLength: number,
    shear: number // At RBS
  ): {
    cutDimensions: {
      a: number; // Distance from face of column
      b: number; // Length of cut
      c: number; // Depth of cut
    };
    ZRBS: number;
    Mpr_RBS: number;
    shearAtColumnFace: number;
  } {
    const d = beamSection.depth;
    const bf = beamSection.flangeWidth;
    const Zx = beamSection.Zx;

    // RBS dimensions (AISC 358 limits)
    const a = Math.max(0.5 * bf, 0.75 * bf); // Typically 0.5bf to 0.75bf
    const b = Math.max(0.65 * d, 0.85 * d); // Typically 0.65d to 0.85d
    const c = Math.max(0.1 * bf, 0.25 * bf); // Typically 0.1bf to 0.25bf

    // Reduced section modulus
    const ZRBS = Zx - 2 * c * (d - beamSection.depth * 0.1) * (d / 2);

    // Probable moment at RBS
    const Cpr = 1.15; // Connection factor
    const Ry = 1.1;
    const Mpr_RBS = Cpr * Ry * Fy * ZRBS / 1e6;

    // Shear at column face
    const Sh = a + b / 2; // Distance to plastic hinge
    const Lh = spanLength / 2 - Sh; // Distance between plastic hinges
    const Vu = (2 * Mpr_RBS / Lh) + shear;

    return {
      cutDimensions: { a, b, c },
      ZRBS,
      Mpr_RBS,
      shearAtColumnFace: Vu
    };
  }

  /**
   * Special concentrically braced frame requirements
   */
  static scbfRequirements(
    braceSection: {
      area: number;
      rx: number;
      ry: number;
    },
    unbracedLength: number,
    Fy: number,
    expectedStrength: boolean = true
  ): {
    slendernessCheck: {
      KL_r: number;
      limit: number;
      status: 'PASS' | 'FAIL';
    };
    widthThicknessCheck: string;
    connectionForce: {
      tensionCapacity: number;
      compressionCapacity: number;
    };
    stitchRequirements: string;
  } {
    const A = braceSection.area;
    const rMin = Math.min(braceSection.rx, braceSection.ry);
    const K = 1.0;
    const L = unbracedLength;

    // Slenderness
    const KL_r = K * L / rMin;
    const slendernessLimit = 200;

    // Expected strength
    const Ry = 1.1;
    const Rt = 1.1;
    const Pye = Ry * Fy * A / 1000; // Expected yield strength

    return {
      slendernessCheck: {
        KL_r,
        limit: slendernessLimit,
        status: KL_r <= slendernessLimit ? 'PASS' : 'FAIL'
      },
      widthThicknessCheck: 'Per Table D1.1 for highly ductile members',
      connectionForce: {
        tensionCapacity: expectedStrength ? Pye : Fy * A / 1000,
        compressionCapacity: expectedStrength ? 1.1 * Pye : Fy * A / 1000
      },
      stitchRequirements: 'Spacing ≤ 0.4 × min(rx, ry) for built-up sections'
    };
  }
}

// ============================================================================
// CAPACITY DESIGN HELPER
// ============================================================================

export class CapacityDesignHelper {
  /**
   * Strong column - weak beam check
   */
  static strongColumnWeakBeam(
    beamMoments: { left: number; right: number }, // Mn at joint, kNm
    columnMoments: { above: number; below: number }, // Mn, kNm
    columnAxialLoad: number, // kN
    columnArea: number, // mm²
    fck: number
  ): {
    sumMnc: number;
    sumMnb: number;
    ratio: number;
    requiredRatio: number;
    status: 'PASS' | 'FAIL';
    recommendation: string;
  } {
    const sumMnb = beamMoments.left + beamMoments.right;
    
    // Reduce column moment for axial load
    const Ag = columnArea;
    const Pn = 0.4 * fck * Ag / 1000; // Approximate pure axial
    const reductionFactor = Math.max(0, 1 - columnAxialLoad / Pn);
    const sumMnc = (columnMoments.above + columnMoments.below) * reductionFactor;

    const ratio = sumMnc / sumMnb;
    const requiredRatio = 1.2; // IS 13920 and ACI 318

    return {
      sumMnc,
      sumMnb,
      ratio,
      requiredRatio,
      status: ratio >= requiredRatio ? 'PASS' : 'FAIL',
      recommendation: ratio < requiredRatio 
        ? `Increase column moment capacity by ${((requiredRatio / ratio - 1) * 100).toFixed(0)}%`
        : 'Strong column - weak beam requirement satisfied'
    };
  }

  /**
   * Calculate capacity design shear
   */
  static capacityDesignShear(
    memberType: 'beam' | 'column',
    plasticMomentPositive: number, // kNm
    plasticMomentNegative: number, // kNm
    clearSpan: number, // mm
    gravityShear: number = 0 // kN
  ): {
    capacityShear: number;
    formula: string;
  } {
    const L = clearSpan / 1000; // Convert to m

    if (memberType === 'beam') {
      // Vcd = (Mp+ + Mp-) / Ln + 1.2 * VDL + 1.0 * VLL
      const Vcd = (plasticMomentPositive + Math.abs(plasticMomentNegative)) / L + gravityShear;
      return {
        capacityShear: Vcd,
        formula: 'Vcd = (Mp+ + Mp-)/Ln + Vgravity'
      };
    } else {
      // Column capacity shear
      const Vcd = (plasticMomentPositive + plasticMomentNegative) / L;
      return {
        capacityShear: Vcd,
        formula: 'Vcd = (Mpr_top + Mpr_bot)/Hclear'
      };
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  IS13920Detailing,
  ACI318SeismicDetailing,
  AISC341Detailing,
  CapacityDesignHelper
};
