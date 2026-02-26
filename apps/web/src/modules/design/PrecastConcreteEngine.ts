/**
 * ============================================================================
 * PRECAST CONCRETE DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive precast concrete design covering:
 * - Precast element design
 * - Connection design (wet and dry)
 * - Handling and erection analysis
 * - Composite action design
 * - Tolerance and clearance checks
 * 
 * Design Codes:
 * - IS 15916:2010 - Precast Concrete Guidelines
 * - PCI Design Handbook
 * - EN 1992-1-1 with EN 13369
 * - ACI 318 Chapter 16
 * - fib Model Code
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PrecastMaterial {
  concrete: {
    fck: number; // MPa
    fckRelease: number; // At stripping/handling
    Ec: number; // MPa
  };
  reinforcement: {
    fy: number; // MPa
    Es: number; // MPa
  };
  prestressing?: {
    fpu: number; // MPa
    Ep: number; // MPa
  };
}

export interface PrecastElement {
  type: 'beam' | 'column' | 'wall' | 'slab' | 'hollowcore' | 'double-tee' | 'spandrel';
  length: number; // mm
  width: number; // mm
  depth: number; // mm
  weight: number; // kN
  centroid: { x: number; y: number; z: number }; // mm from reference
}

export interface LiftingPoint {
  location: { x: number; y: number }; // mm from end
  type: 'cast-in' | 'insert' | 'loop';
  capacity: number; // kN
  angle: number; // degrees from vertical
}

export interface PrecastConnection {
  type: 'bearing' | 'corbel' | 'dowel' | 'weld' | 'bolted' | 'grouted' | 'mechanical';
  location: 'end' | 'side' | 'top' | 'embedded';
  forces: {
    vertical: number; // kN
    horizontal: number; // kN
    moment: number; // kNm
  };
}

export interface HandlingCondition {
  stage: 'stripping' | 'yard-handling' | 'transport' | 'erection';
  supportPoints: number;
  dynamicFactor: number;
  suction?: number; // kN/m² for stripping
}

// ============================================================================
// HANDLING AND ERECTION ANALYSIS
// ============================================================================

export class PrecastHandlingAnalyzer {
  /**
   * Analyze element during stripping from mold
   */
  static analyzeStripping(
    element: PrecastElement,
    material: PrecastMaterial,
    liftPoints: LiftingPoint[],
    moldType: 'horizontal' | 'tilted' | 'vertical'
  ): {
    suctionForce: number;
    liftingForces: { point: number; force: number }[];
    stresses: {
      maxTension: number;
      maxCompression: number;
      allowableTension: number;
      allowableCompression: number;
    };
    safetyFactor: number;
    status: 'SAFE' | 'CRITICAL' | 'UNSAFE';
    recommendations: string[];
  } {
    const W = element.weight;
    const L = element.length;
    const fckRelease = material.concrete.fckRelease;

    // Suction force (based on mold type)
    const suctionPressure = moldType === 'horizontal' ? 10 : moldType === 'tilted' ? 5 : 0;
    const surfaceArea = element.length * element.width / 1e6; // m²
    const suctionForce = suctionPressure * surfaceArea;

    // Total load during stripping
    const dynamicFactor = 1.5; // Stripping impact factor
    const totalLoad = (W + suctionForce) * dynamicFactor;

    // Distribute to lifting points
    const numPoints = liftPoints.length;
    const liftingForces = liftPoints.map((point, i) => ({
      point: i + 1,
      force: totalLoad / numPoints / Math.cos(point.angle * Math.PI / 180)
    }));

    // Calculate bending stresses during lifting
    const a = liftPoints[0]?.location.x || L * 0.2; // Overhang distance
    const I = element.width * Math.pow(element.depth, 3) / 12; // mm⁴
    const y = element.depth / 2;

    // Negative moment at pickup points
    const w = W / L * 1000; // N/mm
    const Mneg = w * a * a / 2 * dynamicFactor;
    const maxTension = Mneg * y / I; // MPa (bottom fiber)

    // Positive moment in span
    const span = L - 2 * a;
    const Mpos = w * span * span / 8 * dynamicFactor;
    const maxCompression = Mpos * y / I;

    // Allowable stresses at release
    const fctRelease = 0.7 * Math.sqrt(fckRelease);
    const fcRelease = 0.5 * fckRelease;

    const tensionRatio = maxTension / fctRelease;
    const compressionRatio = maxCompression / fcRelease;
    const safetyFactor = 1 / Math.max(tensionRatio, compressionRatio);

    const recommendations: string[] = [];
    let status: 'SAFE' | 'CRITICAL' | 'UNSAFE';

    if (safetyFactor >= 2.0) {
      status = 'SAFE';
    } else if (safetyFactor >= 1.5) {
      status = 'CRITICAL';
      recommendations.push('Consider additional curing time before stripping');
    } else {
      status = 'UNSAFE';
      recommendations.push('Move lifting points closer to quarter points');
      recommendations.push('Increase concrete strength at release');
      recommendations.push('Add temporary reinforcement at lifting points');
    }

    // Check individual lift point capacity
    liftingForces.forEach((lf, i) => {
      if (lf.force > liftPoints[i].capacity * 0.8) {
        recommendations.push(`Upgrade lifting point ${i + 1} capacity or add more points`);
      }
    });

    return {
      suctionForce,
      liftingForces,
      stresses: {
        maxTension,
        maxCompression,
        allowableTension: fctRelease,
        allowableCompression: fcRelease
      },
      safetyFactor,
      status,
      recommendations
    };
  }

  /**
   * Analyze element during transportation
   */
  static analyzeTransport(
    element: PrecastElement,
    material: PrecastMaterial,
    supportLocations: number[], // Distance from end, mm
    transportMethod: 'flatbed' | 'lowboy' | 'a-frame' | 'tilt'
  ): {
    supportReactions: number[];
    bendingMoments: { location: number; moment: number }[];
    maxStress: { tension: number; compression: number };
    allowable: { tension: number; compression: number };
    status: 'OK' | 'REQUIRES_ADDITIONAL_SUPPORT' | 'CHANGE_TRANSPORT_METHOD';
    recommendations: string[];
  } {
    const W = element.weight;
    const L = element.length;
    const fck = material.concrete.fck;

    // Dynamic factor for transport
    const dynamicFactor = transportMethod === 'flatbed' ? 1.8 : 
                          transportMethod === 'lowboy' ? 1.5 : 1.3;

    const w = W / L * 1000 * dynamicFactor; // N/mm

    // Calculate reactions (assuming uniform load)
    const n = supportLocations.length;
    const reactions = supportLocations.map(() => W * dynamicFactor / n);

    // Critical moments
    const moments: { location: number; moment: number }[] = [];
    
    // Cantilever moments
    const a = supportLocations[0];
    const b = L - supportLocations[supportLocations.length - 1];
    const Mcant1 = -w * a * a / 2 / 1e6; // kNm
    const Mcant2 = -w * b * b / 2 / 1e6;
    
    moments.push({ location: 0, moment: 0 });
    moments.push({ location: a, moment: Mcant1 });

    // Mid-span moment (simplified for 2 supports)
    if (n === 2) {
      const span = supportLocations[1] - supportLocations[0];
      const Mspan = w * span * span / 8 / 1e6;
      moments.push({ location: a + span / 2, moment: Mspan });
    }

    moments.push({ location: L - b, moment: Mcant2 });
    moments.push({ location: L, moment: 0 });

    // Section properties
    const I = element.width * Math.pow(element.depth, 3) / 12;
    const y = element.depth / 2;

    // Stresses
    const maxMoment = Math.max(...moments.map(m => Math.abs(m.moment)));
    const maxStress = maxMoment * 1e6 * y / I;

    const fct = 0.7 * Math.sqrt(fck);
    const fc = 0.45 * fck;

    const recommendations: string[] = [];
    let status: 'OK' | 'REQUIRES_ADDITIONAL_SUPPORT' | 'CHANGE_TRANSPORT_METHOD';

    if (maxStress < 0.7 * fct) {
      status = 'OK';
    } else if (maxStress < fct) {
      status = 'REQUIRES_ADDITIONAL_SUPPORT';
      recommendations.push('Add intermediate support point');
      recommendations.push('Reduce overhang at ends');
    } else {
      status = 'CHANGE_TRANSPORT_METHOD';
      recommendations.push('Use A-frame for reduced dynamic loading');
      recommendations.push('Consider element rotation during transport');
    }

    return {
      supportReactions: reactions,
      bendingMoments: moments,
      maxStress: { tension: maxStress, compression: maxStress },
      allowable: { tension: fct, compression: fc },
      status,
      recommendations
    };
  }

  /**
   * Calculate required lifting insert capacity
   */
  static designLiftingInsert(
    elementWeight: number, // kN
    numberOfPoints: number,
    liftingAngle: number, // degrees from vertical
    dynamicFactor: number = 1.5
  ): {
    requiredCapacity: number; // kN
    recommendedInsert: {
      type: string;
      size: string;
      capacity: number;
    };
    embedmentDepth: number; // mm
  } {
    // Force per insert
    const verticalForce = elementWeight * dynamicFactor / numberOfPoints;
    const totalForce = verticalForce / Math.cos(liftingAngle * Math.PI / 180);

    // Apply safety factor
    const requiredCapacity = totalForce * 1.5;

    // Standard lifting insert capacities (PCI standard)
    const insertCatalog = [
      { type: 'Coil Insert', size: 'M12', capacity: 20, embedment: 100 },
      { type: 'Coil Insert', size: 'M16', capacity: 45, embedment: 120 },
      { type: 'Coil Insert', size: 'M20', capacity: 75, embedment: 150 },
      { type: 'Coil Insert', size: 'M24', capacity: 120, embedment: 180 },
      { type: 'Swift Lift', size: 'SL-1', capacity: 30, embedment: 80 },
      { type: 'Swift Lift', size: 'SL-2', capacity: 60, embedment: 100 },
      { type: 'Swift Lift', size: 'SL-3', capacity: 100, embedment: 120 },
      { type: 'Swift Lift', size: 'SL-4', capacity: 150, embedment: 150 }
    ];

    const suitable = insertCatalog.find(i => i.capacity >= requiredCapacity);
    const selected = suitable || insertCatalog[insertCatalog.length - 1];

    return {
      requiredCapacity,
      recommendedInsert: {
        type: selected.type,
        size: selected.size,
        capacity: selected.capacity
      },
      embedmentDepth: selected.embedment
    };
  }
}

// ============================================================================
// CONNECTION DESIGN
// ============================================================================

export class PrecastConnectionDesigner {
  /**
   * Design bearing pad connection
   */
  static designBearingPad(
    reaction: number, // kN
    horizontalForce: number, // kN
    beamWidth: number, // mm
    supportWidth: number, // mm
    fck: number, // MPa (supporting concrete)
    code: 'PCI' | 'IS' | 'EC' = 'PCI'
  ): {
    requiredArea: number; // mm²
    padDimensions: { length: number; width: number; thickness: number };
    padType: 'plain' | 'reinforced' | 'laminated';
    allowableBearing: number; // MPa
    actualBearing: number; // MPa
    status: 'PASS' | 'FAIL';
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // Allowable bearing stress
    let allowableBearing: number;
    const A1 = Math.min(beamWidth, supportWidth); // Loaded area width
    
    switch (code) {
      case 'PCI':
        // Plain elastomeric: 3.5 MPa, Reinforced: 14 MPa
        allowableBearing = 7.0; // Moderate value for design
        break;
      case 'IS':
        allowableBearing = 0.45 * fck; // IS 456
        break;
      case 'EC':
        allowableBearing = 0.6 * fck * 0.85; // EN 1992
        break;
      default:
        allowableBearing = 5.0;
    }

    // Required bearing area
    const requiredArea = reaction * 1000 / allowableBearing;

    // Pad dimensions
    const minLength = 75; // mm, minimum bearing length
    const length = Math.max(minLength, Math.ceil(Math.sqrt(requiredArea) / 25) * 25);
    const width = Math.min(beamWidth - 50, supportWidth - 50);
    const padArea = length * width;

    // Actual bearing stress
    const actualBearing = reaction * 1000 / padArea;

    // Pad thickness (based on strain limits)
    const shapeFactorLimit = 6;
    const thickness = Math.max(10, Math.ceil(length / (2 * shapeFactorLimit) / 5) * 5);

    // Determine pad type based on requirements
    let padType: 'plain' | 'reinforced' | 'laminated';
    if (actualBearing <= 3.5 && horizontalForce / reaction < 0.2) {
      padType = 'plain';
    } else if (actualBearing <= 14 && thickness <= 50) {
      padType = 'reinforced';
    } else {
      padType = 'laminated';
      recommendations.push('Use steel-laminated bearing pad');
    }

    // Check horizontal load capacity
    const frictionCoeff = padType === 'laminated' ? 0.2 : 0.5;
    const horizontalCapacity = reaction * frictionCoeff;
    
    if (horizontalForce > horizontalCapacity) {
      recommendations.push('Add positive horizontal restraint');
      recommendations.push('Consider dowel or bearing clip');
    }

    return {
      requiredArea,
      padDimensions: { length, width, thickness },
      padType,
      allowableBearing,
      actualBearing,
      status: actualBearing <= allowableBearing ? 'PASS' : 'FAIL',
      recommendations
    };
  }

  /**
   * Design corbel connection
   */
  static designCorbel(
    Vu: number, // Vertical load, kN
    Hu: number, // Horizontal load, kN
    av: number, // Shear span (horizontal distance from face), mm
    corbel: {
      width: number;
      depth: number; // at column face
      effectiveDepth: number;
    },
    fck: number, // MPa
    fy: number, // MPa
    code: 'ACI' | 'IS' | 'PCI' = 'ACI'
  ): {
    primaryReinforcement: {
      area: number; // mm²
      bars: string;
    };
    horizontalStirrups: {
      area: number;
      bars: string;
    };
    frictionReinforcement: {
      area: number;
    };
    bearingPlate: {
      length: number;
      width: number;
      thickness: number;
    };
    checks: { name: string; status: 'PASS' | 'FAIL'; ratio: number }[];
    status: 'PASS' | 'FAIL';
  } {
    const b = corbel.width;
    const d = corbel.effectiveDepth;
    const h = corbel.depth;
    const Nu = Hu; // Horizontal (tensile) force

    // Check av/d ratio
    const avd = av / d;
    const checks: { name: string; status: 'PASS' | 'FAIL'; ratio: number }[] = [];

    checks.push({
      name: 'Shear span/depth ratio (av/d ≤ 1.0)',
      status: avd <= 1.0 ? 'PASS' : 'FAIL',
      ratio: avd
    });

    // Shear-friction method (ACI 318)
    const phi = 0.75;
    const mu = 1.4; // Monolithic concrete

    // Required reinforcement for shear friction
    const Avf = Vu * 1000 / (phi * fy * mu);

    // Required reinforcement for direct tension
    const An = Nu * 1000 / (phi * fy);

    // Required flexural reinforcement
    const Mu = Vu * av + Nu * (h - d);
    const Af = Mu / (phi * fy * 0.9 * d);

    // Primary tension reinforcement (larger of)
    const As1 = Af + An; // Flexure + tension
    const As2 = 2 * Avf / 3 + An; // 2/3 Avf + An
    const As = Math.max(As1, As2, Avf);

    // Minimum reinforcement
    const AsMin = 0.04 * fck / fy * b * d;
    const AsFinal = Math.max(As, AsMin);

    // Horizontal stirrups (closed hoops)
    const Ah = 0.5 * (AsFinal - An);

    // Select bars
    const primaryBars = selectBars(AsFinal);
    const stirrupBars = selectBars(Ah);

    // Bearing plate design
    const fc = 0.85 * fck;
    const plateBearing = Vu * 1000 / (0.85 * phi * fc);
    const plateLength = Math.max(100, Math.ceil(Math.sqrt(plateBearing / (b - 50)) / 10) * 10);
    const plateWidth = Math.min(b - 50, 200);
    const plateThickness = Math.max(12, Math.ceil(plateLength / 10));

    // Maximum shear check
    const Vnmax = 0.2 * fck * b * d / 1000; // kN
    checks.push({
      name: 'Maximum shear (Vu ≤ 0.2fck·b·d)',
      status: Vu <= phi * Vnmax ? 'PASS' : 'FAIL',
      ratio: Vu / (phi * Vnmax)
    });

    function selectBars(area: number): string {
      const barAreas = [
        { dia: 12, area: 113 },
        { dia: 16, area: 201 },
        { dia: 20, area: 314 },
        { dia: 25, area: 491 },
        { dia: 32, area: 804 }
      ];

      for (const bar of barAreas) {
        const count = Math.ceil(area / bar.area);
        if (count <= 6 && count * bar.area >= area) {
          return `${count}-T${bar.dia}`;
        }
      }
      return `${Math.ceil(area / 804)}-T32`;
    }

    return {
      primaryReinforcement: {
        area: AsFinal,
        bars: primaryBars
      },
      horizontalStirrups: {
        area: Ah,
        bars: stirrupBars
      },
      frictionReinforcement: {
        area: Avf
      },
      bearingPlate: {
        length: plateLength,
        width: plateWidth,
        thickness: plateThickness
      },
      checks,
      status: checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL'
    };
  }

  /**
   * Design grouted dowel connection
   */
  static designDowelConnection(
    forces: {
      axial: number; // kN (tension positive)
      shear: number; // kN
      moment: number; // kNm
    },
    dowelConfig: {
      diameter: number; // mm
      count: number;
      embedmentLength: number; // mm
      spacing: number; // mm
    },
    materials: {
      groutStrength: number; // MPa
      dowelFy: number; // MPa
      concreteFck: number; // MPa
    }
  ): {
    tensionCapacity: number; // kN
    shearCapacity: number; // kN
    combinedUtilization: number;
    minGroutCover: number;
    requiredEmbedment: number;
    status: 'PASS' | 'FAIL';
    recommendations: string[];
  } {
    const n = dowelConfig.count;
    const db = dowelConfig.diameter;
    const Le = dowelConfig.embedmentLength;
    const fy = materials.dowelFy;
    const fck = materials.concreteFck;
    const fgrout = materials.groutStrength;

    const Ab = Math.PI * db * db / 4;
    const recommendations: string[] = [];

    // Tension capacity (pullout or steel yielding)
    // Bond stress (simplified)
    const fbd = 2.25 * Math.sqrt(Math.min(fgrout, fck)) / 1.5; // Design bond stress
    const Tbond = n * Math.PI * db * Le * fbd / 1000; // kN
    const Tsteel = n * Ab * fy / 1000; // kN
    const tensionCapacity = Math.min(Tbond, Tsteel);

    // Shear capacity
    // Dowel action + friction
    const Vdowel = n * 0.6 * Ab * fy / 1000; // Dowel shear
    const Vfriction = 0.6 * (forces.axial < 0 ? Math.abs(forces.axial) : 0); // Friction from compression
    const shearCapacity = Vdowel + Vfriction;

    // Combined utilization
    const tensionRatio = forces.axial > 0 ? forces.axial / tensionCapacity : 0;
    const shearRatio = forces.shear / shearCapacity;
    const combinedUtilization = Math.sqrt(tensionRatio * tensionRatio + shearRatio * shearRatio);

    // Required embedment
    const requiredEmbedment = Math.max(
      12 * db, // Minimum
      Ab * fy / (Math.PI * db * fbd), // For full tension development
      150 // Absolute minimum
    );

    // Minimum grout cover
    const minGroutCover = Math.max(db, 25);

    // Recommendations
    if (Le < requiredEmbedment) {
      recommendations.push(`Increase embedment length to ${Math.ceil(requiredEmbedment)}mm`);
    }

    if (dowelConfig.spacing < 3 * db) {
      recommendations.push('Increase dowel spacing to at least 3db');
    }

    if (combinedUtilization > 0.8) {
      recommendations.push('Consider larger or more dowels');
    }

    return {
      tensionCapacity,
      shearCapacity,
      combinedUtilization,
      minGroutCover,
      requiredEmbedment,
      status: combinedUtilization <= 1.0 ? 'PASS' : 'FAIL',
      recommendations
    };
  }

  /**
   * Design welded plate connection
   */
  static designWeldedPlateConnection(
    forces: {
      vertical: number; // kN
      horizontal: number; // kN
      outOfPlane: number; // kN
    },
    plate: {
      width: number; // mm
      height: number; // mm
      thickness: number; // mm
    },
    weld: {
      size: number; // mm (fillet weld leg)
      type: 'fillet' | 'groove';
    },
    anchorConfig: {
      studs: { diameter: number; length: number; count: number };
      arrangement: 'single' | 'double-row';
    },
    fu: number = 410 // Weld metal strength, MPa
  ): {
    weldCapacity: {
      longitudinal: number;
      transverse: number;
    };
    anchorCapacity: {
      tension: number;
      shear: number;
    };
    plateChecks: {
      bendingOk: boolean;
      tearoutOk: boolean;
    };
    utilization: number;
    status: 'PASS' | 'FAIL';
  } {
    const a = weld.size;
    const Lw = 2 * (plate.width + plate.height) - 4 * a; // Effective weld length

    // Weld capacity (AISC)
    const Fnw = 0.6 * fu * 0.707 * a; // N/mm
    const weldCapacityLong = Fnw * Lw * 0.75 / 1000; // kN (longitudinal loading)
    const weldCapacityTrans = Fnw * Lw * 1.0 / 1000; // kN (transverse loading)

    // Headed stud capacity
    const n = anchorConfig.studs.count;
    const d = anchorConfig.studs.diameter;
    const Asa = Math.PI * d * d / 4;
    const hef = anchorConfig.studs.length - d;
    const fck = 40; // Assumed concrete strength

    // Tension capacity (ACI 318 Appendix D)
    const Ncb = 24 * Math.sqrt(fck) * Math.pow(hef, 1.5) / 1000; // kN per stud (breakout)
    const Nsa = n * Asa * 500 / 1000; // Steel yielding (assume fy = 500 MPa)
    const anchorTension = Math.min(n * Ncb * 0.7, Nsa); // With edge effects

    // Shear capacity
    const Vcb = 0.6 * Ncb; // Shear breakout
    const Vsa = n * 0.6 * Asa * 500 / 1000; // Steel shear
    const anchorShear = Math.min(n * Vcb * 0.7, Vsa);

    // Combined loading utilization
    const tensionDemand = forces.outOfPlane;
    const shearDemand = Math.sqrt(forces.vertical ** 2 + forces.horizontal ** 2);

    const tensionRatio = tensionDemand / anchorTension;
    const shearRatio = shearDemand / anchorShear;

    // Tri-linear interaction (ACI 318)
    let utilization: number;
    if (tensionRatio <= 0.2) {
      utilization = shearRatio;
    } else if (shearRatio <= 0.2) {
      utilization = tensionRatio;
    } else {
      utilization = tensionRatio + shearRatio; // Linear interaction
    }

    // Plate bending check
    const e = forces.outOfPlane > 0 ? 
      anchorConfig.studs.length / 2 : 0;
    const Mp = plate.width * plate.thickness * plate.thickness * 250 / 4 / 1e6; // kNm
    const Md = forces.outOfPlane * e / 1000;
    const bendingOk = Md <= Mp;

    // Tearout check (simplified)
    const tearoutArea = 2 * plate.thickness * d;
    const tearoutCapacity = 0.6 * 410 * tearoutArea / 1000;
    const tearoutOk = forces.horizontal / n <= tearoutCapacity;

    return {
      weldCapacity: {
        longitudinal: weldCapacityLong,
        transverse: weldCapacityTrans
      },
      anchorCapacity: {
        tension: anchorTension,
        shear: anchorShear
      },
      plateChecks: {
        bendingOk,
        tearoutOk
      },
      utilization,
      status: utilization <= 1.0 && bendingOk && tearoutOk ? 'PASS' : 'FAIL'
    };
  }
}

// ============================================================================
// COMPOSITE SECTION DESIGN
// ============================================================================

export class CompositePrecastDesigner {
  /**
   * Design horizontal shear interface
   */
  static designHorizontalShear(
    Vu: number, // Ultimate shear, kN
    bv: number, // Interface width, mm
    d: number, // Effective depth, mm
    surfaceCondition: 'intentionally-roughened' | 'smooth' | 'ties-only',
    fck: number, // MPa
    code: 'ACI' | 'IS' | 'EC' = 'ACI'
  ): {
    horizontalShearStress: number; // MPa
    allowableStress: number;
    tiesRequired: boolean;
    tieReinforcement: {
      areaPerMeter: number; // mm²/m
      spacing: number; // mm
      diameter: number; // mm
    };
    status: 'PASS' | 'FAIL';
  } {
    const lvh = d; // Horizontal shear length (approximately d)
    const Vuh = Vu * 1000 / (bv * lvh); // Horizontal shear stress, MPa

    let allowableWithoutTies: number;
    let maxAllowable: number;

    switch (code) {
      case 'ACI':
        if (surfaceCondition === 'intentionally-roughened') {
          allowableWithoutTies = 0.55; // MPa (80 psi)
        } else {
          allowableWithoutTies = 0;
        }
        maxAllowable = Math.min(2.5, 0.2 * fck);
        break;
      case 'IS':
        allowableWithoutTies = surfaceCondition === 'intentionally-roughened' ? 0.5 : 0;
        maxAllowable = 2.5;
        break;
      case 'EC':
        // EN 1992-1-1 Section 6.2.5
        const c = surfaceCondition === 'intentionally-roughened' ? 0.4 : 0.2;
        allowableWithoutTies = c * 0.3 * Math.pow(fck, 2/3);
        maxAllowable = 0.5 * 0.6 * (1 - fck / 250) * fck;
        break;
      default:
        allowableWithoutTies = 0.3;
        maxAllowable = 2.5;
    }

    const tiesRequired = Vuh > allowableWithoutTies;
    let tieReinforcement = { areaPerMeter: 0, spacing: 600, diameter: 10 };

    if (tiesRequired) {
      // Required tie reinforcement
      const fy = 500;
      const mu = surfaceCondition === 'intentionally-roughened' ? 1.4 : 0.6;
      
      // Avf = Vu / (fy × μ × bv × s)
      const AvfMin = 0.35 * bv / fy * 1000; // mm²/m minimum
      const AvfReq = (Vuh - allowableWithoutTies) * bv * 1000 / (fy * mu);
      
      const areaPerMeter = Math.max(AvfMin, AvfReq);

      // Select tie diameter and spacing
      const tieDia = 10;
      const tieArea = 2 * Math.PI * tieDia * tieDia / 4; // 2-legged ties
      const spacing = Math.min(600, Math.floor(tieArea / areaPerMeter * 1000));

      tieReinforcement = {
        areaPerMeter: areaPerMeter,
        spacing: Math.max(100, Math.floor(spacing / 25) * 25),
        diameter: tieDia
      };
    }

    return {
      horizontalShearStress: Vuh,
      allowableStress: tiesRequired ? maxAllowable : allowableWithoutTies,
      tiesRequired,
      tieReinforcement,
      status: Vuh <= maxAllowable ? 'PASS' : 'FAIL'
    };
  }

  /**
   * Calculate composite section properties
   */
  static compositeProperties(
    precast: {
      width: number;
      depth: number;
      area: number;
      momentOfInertia: number;
      Ec: number;
    },
    topping: {
      width: number;
      depth: number;
      Ec: number;
    }
  ): {
    transformedArea: number;
    compositeMomentOfInertia: number;
    neutralAxisFromBottom: number;
    sectionModulus: { top: number; bottom: number };
  } {
    const n = topping.Ec / precast.Ec; // Modular ratio
    const bt = topping.width * n; // Transformed width

    // Transformed topping area
    const At = bt * topping.depth;
    const Ap = precast.area;
    const totalArea = Ap + At;

    // Centroids from bottom of precast
    const yPrecast = precast.depth / 2;
    const yTopping = precast.depth + topping.depth / 2;

    const yCentroid = (Ap * yPrecast + At * yTopping) / totalArea;

    // Composite moment of inertia (parallel axis theorem)
    const Ip = precast.momentOfInertia + Ap * Math.pow(yPrecast - yCentroid, 2);
    const It = bt * Math.pow(topping.depth, 3) / 12 + 
               At * Math.pow(yTopping - yCentroid, 2);
    const Icomposite = Ip + It;

    const totalDepth = precast.depth + topping.depth;

    return {
      transformedArea: totalArea,
      compositeMomentOfInertia: Icomposite,
      neutralAxisFromBottom: yCentroid,
      sectionModulus: {
        top: Icomposite / (totalDepth - yCentroid),
        bottom: Icomposite / yCentroid
      }
    };
  }
}

// ============================================================================
// TOLERANCE AND CLEARANCE
// ============================================================================

export class PrecastToleranceChecker {
  /**
   * Check erection tolerances per PCI MNL-135
   */
  static checkErectionTolerances(
    element: PrecastElement,
    measuredPosition: {
      plan: { x: number; y: number }; // Deviation from theoretical, mm
      elevation: number; // Deviation, mm
      plumb: number; // Out of plumb, mm
      level: number; // Out of level, mm
    },
    tolerance: 'standard' | 'special' = 'standard'
  ): {
    checks: {
      parameter: string;
      measured: number;
      allowable: number;
      status: 'WITHIN_TOLERANCE' | 'EXCEEDS_TOLERANCE';
    }[];
    overallStatus: 'ACCEPTABLE' | 'REQUIRES_REMEDIATION';
    recommendations: string[];
  } {
    const L = element.length;
    const H = element.depth;

    // PCI tolerances
    const toleranceMultiplier = tolerance === 'special' ? 0.5 : 1.0;

    const allowables = {
      planDeviation: 25 * toleranceMultiplier, // mm
      elevationDeviation: 13 * toleranceMultiplier, // mm
      plumb: Math.min(25, L / 500) * toleranceMultiplier, // mm or L/500
      level: 10 * toleranceMultiplier // mm per 3m
    };

    const checks = [
      {
        parameter: 'Plan position (X)',
        measured: Math.abs(measuredPosition.plan.x),
        allowable: allowables.planDeviation,
        status: Math.abs(measuredPosition.plan.x) <= allowables.planDeviation 
          ? 'WITHIN_TOLERANCE' as const : 'EXCEEDS_TOLERANCE' as const
      },
      {
        parameter: 'Plan position (Y)',
        measured: Math.abs(measuredPosition.plan.y),
        allowable: allowables.planDeviation,
        status: Math.abs(measuredPosition.plan.y) <= allowables.planDeviation
          ? 'WITHIN_TOLERANCE' as const : 'EXCEEDS_TOLERANCE' as const
      },
      {
        parameter: 'Elevation',
        measured: Math.abs(measuredPosition.elevation),
        allowable: allowables.elevationDeviation,
        status: Math.abs(measuredPosition.elevation) <= allowables.elevationDeviation
          ? 'WITHIN_TOLERANCE' as const : 'EXCEEDS_TOLERANCE' as const
      },
      {
        parameter: 'Plumb',
        measured: Math.abs(measuredPosition.plumb),
        allowable: allowables.plumb,
        status: Math.abs(measuredPosition.plumb) <= allowables.plumb
          ? 'WITHIN_TOLERANCE' as const : 'EXCEEDS_TOLERANCE' as const
      },
      {
        parameter: 'Level',
        measured: Math.abs(measuredPosition.level),
        allowable: allowables.level,
        status: Math.abs(measuredPosition.level) <= allowables.level
          ? 'WITHIN_TOLERANCE' as const : 'EXCEEDS_TOLERANCE' as const
      }
    ];

    const recommendations: string[] = [];
    const exceeds = checks.filter(c => c.status === 'EXCEEDS_TOLERANCE');

    if (exceeds.length > 0) {
      exceeds.forEach(e => {
        recommendations.push(`${e.parameter}: Deviation of ${e.measured}mm exceeds tolerance of ${e.allowable}mm`);
      });
      recommendations.push('Document deviation and consult structural engineer');
      recommendations.push('May require connection modification or shimming');
    }

    return {
      checks,
      overallStatus: exceeds.length === 0 ? 'ACCEPTABLE' : 'REQUIRES_REMEDIATION',
      recommendations
    };
  }

  /**
   * Calculate required joint width
   */
  static calculateJointWidth(
    spanLength: number, // m
    elementLength: number, // m
    toleranceAccumulation: 'minimum' | 'maximum',
    movement: {
      thermal: number; // mm per °C change
      creep: number; // mm
      shrinkage: number; // mm
    },
    temperatureRange: number // °C
  ): {
    minimumJointWidth: number;
    recommendedJointWidth: number;
    components: {
      fabricationTolerance: number;
      erectionTolerance: number;
      thermalMovement: number;
      creepMovement: number;
      shrinkageMovement: number;
    };
  } {
    // Fabrication tolerance (± 3mm per 3m, minimum 6mm)
    const fabTol = Math.max(6, elementLength / 1000 * 3);

    // Erection tolerance
    const erectionTol = 13; // mm typical

    // Movements
    const thermal = movement.thermal * temperatureRange;
    const creep = movement.creep;
    const shrinkage = movement.shrinkage;

    // Total movement (root sum of squares for tolerances, algebraic for movements)
    const toleranceSum = toleranceAccumulation === 'maximum' 
      ? fabTol + erectionTol 
      : Math.sqrt(fabTol ** 2 + erectionTol ** 2);

    const movementSum = thermal + creep + shrinkage;

    const minimum = toleranceSum + movementSum;
    const recommended = Math.ceil(minimum * 1.25 / 5) * 5; // Round up to 5mm

    return {
      minimumJointWidth: minimum,
      recommendedJointWidth: recommended,
      components: {
        fabricationTolerance: fabTol,
        erectionTolerance: erectionTol,
        thermalMovement: thermal,
        creepMovement: creep,
        shrinkageMovement: shrinkage
      }
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  PrecastHandlingAnalyzer,
  PrecastConnectionDesigner,
  CompositePrecastDesigner,
  PrecastToleranceChecker
};
