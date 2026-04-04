/**
 * ============================================================================
 * SPECIAL STRUCTURES DESIGN ENGINE
 * ============================================================================
 * 
 * Design of specialized industrial and utility structures:
 * - Chimneys and stacks
 * - Cooling towers
 * - Transmission towers
 * - Water towers (elevated tanks)
 * - Bunkers and silos
 * - Conveyor galleries
 * - Equipment foundations
 * - Pipe racks
 * 
 * Reference Standards:
 * - ACI 307 (Concrete Chimneys)
 * - CICIND (Chimney Design)
 * - ACI 334 (Cooling Towers)
 * - TIA-222 (Communication Towers)
 * - IS 6533 (Steel Chimneys)
 * - IS 11504 (Transmission Line Towers)
 * - AWWA D100 (Welded Steel Tanks)
 * - ACI 313 (Concrete Chimneys)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ChimneyGeometry {
  type: 'concrete' | 'steel' | 'FRP-lined';
  totalHeight: number; // m
  sections: {
    startHeight: number; // m
    endHeight: number; // m
    outerDiameter: number; // m
    thickness: number; // mm (shell)
    liningThickness?: number; // mm
  }[];
  foundation: {
    type: 'annular' | 'circular' | 'octagonal';
    diameter: number; // m
    depth: number; // m
  };
}

export interface CoolingTowerGeometry {
  type: 'hyperbolic' | 'rectangular' | 'fan-assisted';
  height: number; // m
  baseDiameter: number; // m (for hyperbolic)
  throatDiameter: number; // m
  topDiameter: number; // m
  shellThickness: number; // mm
  columns: {
    count: number;
    diameter: number; // mm
    height: number; // m
  };
}

export interface TransmissionTowerGeometry {
  type: 'lattice' | 'monopole' | 'guyed';
  totalHeight: number; // m
  baseWidth: number; // m
  topWidth: number; // m
  panelHeights: number[]; // m
  conductors: {
    level: number; // m from ground
    horizontalSpan: number; // m
    weight: number; // kN per conductor
    tension: number; // kN
  }[];
  groundWires?: {
    level: number;
    tension: number;
  };
}

export interface ChimneyLoads {
  wind: {
    V_ref: number; // m/s (reference wind)
    exposureCategory: 'B' | 'C' | 'D';
    importance: number; // 1.0 or 1.15
  };
  seismic: {
    Ss: number; // g
    S1: number; // g
    siteClass: 'A' | 'B' | 'C' | 'D' | 'E';
  };
  temperature: {
    gradient: number; // °C difference across shell
    operatingTemp: number; // °C
  };
  internalPressure?: number; // Pa
}

export interface ChimneyDesignResult {
  criticalSection: {
    height: number;
    moment: number; // kN·m
    shear: number; // kN
    axial: number; // kN
  };
  reinforcement: {
    verticalRatio: number; // %
    circumferentialRatio: number; // %
    barDiameter: number; // mm
    spacing: number; // mm
  };
  stability: {
    crackingMoment: number; // kN·m
    ultimateMoment: number; // kN·m
    deflectionAtTop: number; // mm
    naturalFrequency: number; // Hz
    criticalWindSpeed: number; // m/s (vortex shedding)
  };
  vortexShedding: {
    lockInRange: { vMin: number; vMax: number };
    amplitudeEstimate: number; // mm
    fatigueLife: number; // years
    mitigationRequired: boolean;
  };
}

export interface TowerLoadResult {
  windOnStructure: number; // kN
  windOnConductors: number; // kN
  conductorWeight: number; // kN
  icingLoad?: number; // kN
  brokenWire?: number; // kN
  totalVertical: number;
  totalHorizontal: number;
  overturningMoment: number; // kN·m
}

// ============================================================================
// CHIMNEY DESIGN (ACI 307 / CICIND)
// ============================================================================

export class ChimneyDesign {
  /**
   * Wind load on chimney per ACI 307
   */
  static windLoadACI307(
    geometry: ChimneyGeometry,
    windSpeed: number, // m/s - 3-second gust at 10m
    exposureCategory: 'B' | 'C' | 'D' = 'C'
  ): {
    baseShear: number; // kN
    baseMoment: number; // kN·m
    pressureDistribution: { height: number; pressure: number }[];
  } {
    const rhoAir = 1.225; // kg/m³
    const qz_base = 0.5 * rhoAir * windSpeed * windSpeed / 1000; // kPa
    
    // Height factor coefficients
    const alpha: Record<string, number> = { 'B': 7.0, 'C': 9.5, 'D': 11.5 };
    const zg: Record<string, number> = { 'B': 365, 'C': 274, 'D': 213 };
    
    const pressures: { height: number; pressure: number }[] = [];
    let baseShear = 0;
    let baseMoment = 0;
    
    for (const section of geometry.sections) {
      const midHeight = (section.startHeight + section.endHeight) / 2;
      
      // Velocity pressure at height
      const Kz = 2.01 * Math.pow(midHeight / zg[exposureCategory], 2 / alpha[exposureCategory]);
      const qz = qz_base * Kz;
      
      // Force coefficient for circular section
      const D = section.outerDiameter;
      const Re = windSpeed * D / 1.5e-5; // Reynolds number
      let Cf: number;
      if (Re < 3.5e5) {
        Cf = 1.2; // Subcritical
      } else if (Re < 3.5e6) {
        Cf = 0.7; // Critical (drag crisis)
      } else {
        Cf = 0.8; // Supercritical
      }
      
      // Gust effect factor
      const G = 0.85 + 0.15 * Math.log(midHeight / 10);
      
      // Pressure and force
      const pressure = qz * Cf * G;
      const sectionHeight = section.endHeight - section.startHeight;
      const force = pressure * D * sectionHeight; // kN
      
      baseShear += force;
      baseMoment += force * midHeight;
      
      pressures.push({ height: midHeight, pressure });
    }

    return {
      baseShear,
      baseMoment,
      pressureDistribution: pressures
    };
  }

  /**
   * Seismic load on chimney per ACI 307
   */
  static seismicLoadACI307(
    geometry: ChimneyGeometry,
    mass: number, // kg per meter height
    Ss: number, // Short period spectral acceleration
    S1: number, // 1-second spectral acceleration
    siteClass: 'B' | 'C' | 'D' = 'C'
  ): {
    baseShear: number; // kN
    baseMoment: number; // kN·m
    modalForces: { height: number; force: number }[];
  } {
    // Site coefficients
    const Fa: Record<string, number> = { 'B': 1.0, 'C': 1.2, 'D': 1.6 };
    const Fv: Record<string, number> = { 'B': 1.0, 'C': 1.7, 'D': 2.4 };
    
    const SDS = 2/3 * Fa[siteClass] * Ss;
    const SD1 = 2/3 * Fv[siteClass] * S1;
    
    // Approximate fundamental period (cantilever)
    const H = geometry.totalHeight;
    const D_avg = geometry.sections.reduce((sum, s) => 
      sum + s.outerDiameter * (s.endHeight - s.startHeight), 0) / H;
    const t_avg = geometry.sections[0].thickness / 1000;
    
    const T = 0.0019 * H * Math.sqrt(H / D_avg);
    
    // Spectral acceleration
    const Sa = T < SD1/SDS ? SDS : SD1/T;
    
    // Total weight
    const W = mass * H * 9.81 / 1000; // kN
    
    // Base shear (R = 2.5 for chimneys)
    const R = 2.5;
    const I = 1.25;
    const V = Sa * W * I / R;
    
    // Distribute forces (first mode shape ≈ linear for slender chimney)
    const modalForces: { height: number; force: number }[] = [];
    let sumWeight = 0;
    let sumWeightHeight = 0;
    
    for (const section of geometry.sections) {
      const h = (section.startHeight + section.endHeight) / 2;
      const dh = section.endHeight - section.startHeight;
      const w = mass * dh * 9.81 / 1000;
      sumWeight += w;
      sumWeightHeight += w * h;
    }
    
    let baseM = 0;
    for (const section of geometry.sections) {
      const h = (section.startHeight + section.endHeight) / 2;
      const dh = section.endHeight - section.startHeight;
      const w = mass * dh * 9.81 / 1000;
      const F = V * w * h / sumWeightHeight;
      modalForces.push({ height: h, force: F });
      baseM += F * h;
    }

    return {
      baseShear: V,
      baseMoment: baseM,
      modalForces
    };
  }

  /**
   * Vortex shedding analysis
   */
  static vortexShedding(
    diameter: number, // m
    height: number, // m
    mass: number, // kg/m
    damping: number, // ratio (typically 0.01-0.02)
    designWindSpeed: number // m/s
  ): {
    strouhalNumber: number;
    criticalWindSpeed: number; // m/s
    lockInRange: { vMin: number; vMax: number };
    amplitudeEstimate: number; // mm
    mitigationRequired: boolean;
    mitigationOptions: string[];
  } {
    // Strouhal number for circular section
    const St = 0.2;
    
    // Natural frequency (cantilever approximation)
    const E = 30000; // MPa for concrete
    const I = Math.PI * Math.pow(diameter, 4) / 64; // Approximate
    const fn = (1.875 * 1.875) / (2 * Math.PI * height * height) * 
               Math.sqrt(E * 1e6 * I / mass);
    
    // Critical wind speed (resonance)
    const V_cr = fn * diameter / St;
    
    // Lock-in range (±20%)
    const lockInRange = {
      vMin: 0.8 * V_cr,
      vMax: 1.2 * V_cr
    };
    
    // Scruton number
    const Sc = 2 * mass * damping / (1.225 * diameter * diameter);
    
    // Amplitude (simplified - should use more detailed analysis)
    let amplitude: number;
    if (Sc < 5) {
      amplitude = 0.1 * diameter * 1000; // Large amplitude
    } else if (Sc < 10) {
      amplitude = 0.05 * diameter * 1000;
    } else {
      amplitude = 0.01 * diameter * 1000;
    }
    
    const mitigationRequired = V_cr < designWindSpeed && Sc < 10;
    
    const mitigationOptions: string[] = [];
    if (mitigationRequired) {
      mitigationOptions.push('Helical strakes (3 strakes, 5D pitch, 0.1D height)');
      mitigationOptions.push('Perforated shroud');
      mitigationOptions.push('Tuned mass damper');
      if (Sc < 5) {
        mitigationOptions.push('Increase structural damping');
      }
    }

    return {
      strouhalNumber: St,
      criticalWindSpeed: V_cr,
      lockInRange,
      amplitudeEstimate: amplitude,
      mitigationRequired,
      mitigationOptions
    };
  }

  /**
   * Shell reinforcement design
   */
  static shellReinforcement(
    diameter: number, // m
    thickness: number, // mm
    moment: number, // kN·m
    axial: number, // kN (compression positive)
    fc: number, // MPa
    fy: number // MPa
  ): {
    verticalRatio: number; // %
    circumferentialRatio: number; // %
    barSize: number; // mm
    verticalSpacing: number; // mm
    circumferentialSpacing: number; // mm
  } {
    const D = diameter * 1000; // mm
    const t = thickness;
    const R = D / 2;
    const Ag = Math.PI * D * t; // Shell area
    
    // Section modulus
    const I = Math.PI * Math.pow(D, 3) * t / 8;
    const S = I / R;
    
    // Stresses
    const fa = axial * 1000 / Ag; // MPa (axial)
    const fb = moment * 1e6 * R / I; // MPa (bending)
    
    // Total stress
    const f_max = fa + fb;
    const f_min = fa - fb;
    
    // Vertical reinforcement for tension
    let As_vert = 0;
    if (f_min < 0) {
      // Tension on leeward side
      const T = -f_min * t * 1; // Tension per mm circumference
      As_vert = T / (0.87 * fy);
    }
    
    // Minimum reinforcement ratios (ACI 307)
    const rho_min_vert = 0.0025;
    const rho_min_circ = 0.002;
    
    const As_min_vert = rho_min_vert * t * 1000; // per m height
    const As_min_circ = rho_min_circ * t * 1000;
    
    const As_vert_req = Math.max(As_vert * Math.PI * D, As_min_vert);
    
    // Select bar size (typically 16 or 20mm)
    const barSize = As_vert_req > 2000 ? 20 : 16;
    const Ab = Math.PI * barSize * barSize / 4;
    
    // Spacing
    const vertSpacing = Math.floor(Ab / (As_vert_req / 1000));
    const circSpacing = Math.floor(Ab / (As_min_circ / 1000));

    return {
      verticalRatio: (As_vert_req / (t * 1000)) * 100,
      circumferentialRatio: rho_min_circ * 100,
      barSize,
      verticalSpacing: Math.min(vertSpacing, 300),
      circumferentialSpacing: Math.min(circSpacing, 300)
    };
  }
}

// ============================================================================
// COOLING TOWER DESIGN
// ============================================================================

export class CoolingTowerDesign {
  /**
   * Hyperbolic shell geometry
   */
  static hyperbolicGeometry(
    baseRadius: number, // m
    throatRadius: number, // m
    topRadius: number, // m
    baseHeight: number, // m (height of columns)
    totalHeight: number // m
  ): {
    throatHeight: number;
    A: number; // Hyperbola parameter
    B: number; // Hyperbola parameter
    curvatureAtThroat: number;
    equation: string;
  } {
    // Throat is at minimum radius
    const throatHeight = baseHeight + (totalHeight - baseHeight) * 0.7; // Typically 70% up
    
    // Hyperbola: r² = B² + A²(z - z_throat)²
    // At base: baseRadius² = B² + A²(baseHeight - throatHeight)²
    // At top: topRadius² = B² + A²(totalHeight - throatHeight)²
    
    const z_b = baseHeight - throatHeight;
    const z_t = totalHeight - throatHeight;
    
    const B = throatRadius;
    const A = Math.sqrt((baseRadius * baseRadius - B * B) / (z_b * z_b));
    
    // Curvature at throat (maximum)
    const curvature = A * A / (B * B * B);

    return {
      throatHeight,
      A,
      B,
      curvatureAtThroat: curvature,
      equation: `r² = ${B.toFixed(2)}² + ${A.toFixed(4)}²(z - ${throatHeight.toFixed(1)})²`
    };
  }

  /**
   * Wind load on cooling tower
   */
  static windLoad(
    geometry: CoolingTowerGeometry,
    windSpeed: number, // m/s
    exposureCategory: 'C' | 'D' = 'C'
  ): {
    pressureDistribution: { height: number; pressure: number }[];
    totalBaseShear: number; // kN
    overturningMoment: number; // kN·m
  } {
    const qz_base = 0.613 * windSpeed * windSpeed / 1000; // kPa
    
    const pressures: { height: number; pressure: number }[] = [];
    let baseShear = 0;
    let overturning = 0;
    
    // Divide height into sections
    const dz = geometry.height / 20;
    
    for (let z = 0; z <= geometry.height; z += dz) {
      // Radius at height (simplified)
      const ratio = z / geometry.height;
      const r = geometry.baseDiameter / 2 * (1 - 0.3 * ratio);
      const D = 2 * r;
      
      // Height factor
      const Kz = Math.pow(z / 10, 0.2);
      const qz = qz_base * Kz;
      
      // Pressure coefficient varies around circumference
      // Using integrated value for drag
      const Cf = 0.7; // Average for hyperbolic shell
      
      const pressure = qz * Cf;
      pressures.push({ height: z, pressure });
      
      const force = pressure * D * dz;
      baseShear += force;
      overturning += force * z;
    }

    return {
      pressureDistribution: pressures,
      totalBaseShear: baseShear,
      overturningMoment: overturning
    };
  }

  /**
   * Column loads
   */
  static columnLoads(
    totalVerticalLoad: number, // kN (shell + equipment)
    horizontalLoad: number, // kN (wind)
    overturningMoment: number, // kN·m
    columnCount: number,
    columnRadius: number // m (radius to column centerline)
  ): {
    maxCompression: number; // kN
    maxTension: number; // kN
    shearPerColumn: number; // kN
  } {
    // Vertical from self-weight
    const V_sw = totalVerticalLoad / columnCount;
    
    // Moment distributed to columns
    // M = Sum(F_i × r) where F_i is axial force in column i
    // For circular arrangement: F_max = M × r / (n × r² / 2) = 2M / (n × r)
    const F_moment = 2 * overturningMoment / (columnCount * columnRadius);
    
    const maxCompression = V_sw + F_moment;
    const maxTension = V_sw - F_moment;
    const shear = horizontalLoad / columnCount;

    return {
      maxCompression,
      maxTension: Math.max(maxTension, 0), // May be in tension or reduced compression
      shearPerColumn: shear
    };
  }
}

// ============================================================================
// TRANSMISSION TOWER DESIGN
// ============================================================================

export class TransmissionTowerDesign {
  /**
   * Conductor loads
   */
  static conductorLoads(
    weight: number, // kN/m
    span: number, // m
    sag: number, // m
    windSpeed: number, // m/s
    iceThickness: number = 0 // mm
  ): {
    verticalLoad: number; // kN per phase
    horizontalLoad: number; // kN per phase
    tensionLoad: number; // kN
  } {
    // Vertical (weight + ice)
    const iceWeight = iceThickness > 0 ? 
      Math.PI * iceThickness / 1000 * 9.17 * span : 0; // 917 kg/m³ ice
    const verticalLoad = weight * span + iceWeight;
    
    // Horizontal (wind on conductor)
    const conductorDia = 0.03; // Approximate 30mm conductor
    const effectiveDia = conductorDia + 2 * iceThickness / 1000;
    const qz = 0.613 * windSpeed * windSpeed / 1000;
    const horizontalLoad = qz * 1.2 * effectiveDia * span; // Cd = 1.2
    
    // Tension from catenary
    const H = weight * span * span / (8 * sag); // Horizontal tension
    const T = H * Math.sqrt(1 + Math.pow(4 * sag / span, 2));

    return {
      verticalLoad,
      horizontalLoad,
      tensionLoad: T
    };
  }

  /**
   * Tower wind load
   */
  static towerWindLoad(
    geometry: TransmissionTowerGeometry,
    windSpeed: number, // m/s
    withIce: boolean = false
  ): TowerLoadResult {
    const qz_base = 0.613 * windSpeed * windSpeed / 1000; // kPa
    
    let windOnStructure = 0;
    let overturningFromStructure = 0;
    
    // Lattice tower wind (using solidity ratio)
    const solidityRatio = 0.25; // Typical for lattice
    
    for (let i = 0; i < geometry.panelHeights.length; i++) {
      const z1 = geometry.panelHeights.slice(0, i).reduce((a, b) => a + b, 0);
      const z2 = z1 + geometry.panelHeights[i];
      const z_mid = (z1 + z2) / 2;
      
      // Width at mid-height
      const w1 = geometry.baseWidth;
      const w2 = geometry.topWidth;
      const width = w1 - (w1 - w2) * z_mid / geometry.totalHeight;
      
      // Height factor
      const Kz = Math.pow(z_mid / 10, 0.22);
      const qz = qz_base * Kz;
      
      // Force on panel (both faces for lattice)
      const Af = width * geometry.panelHeights[i] * solidityRatio;
      const Cf = 3.4; // Force coefficient for lattice
      const force = qz * Cf * Af;
      
      windOnStructure += force;
      overturningFromStructure += force * z_mid;
    }
    
    // Conductor loads
    let windOnConductors = 0;
    let conductorWeight = 0;
    let overturningFromConductors = 0;
    
    for (const cond of geometry.conductors) {
      const span = 400; // Assumed span
      const loads = this.conductorLoads(cond.weight / span, span, span * 0.05, windSpeed);
      
      windOnConductors += loads.horizontalLoad;
      conductorWeight += loads.verticalLoad;
      overturningFromConductors += loads.horizontalLoad * cond.level;
    }
    
    // Ground wire
    if (geometry.groundWires) {
      const gwLoad = this.conductorLoads(0.1, 400, 20, windSpeed);
      windOnConductors += gwLoad.horizontalLoad;
      conductorWeight += gwLoad.verticalLoad;
    }

    return {
      windOnStructure,
      windOnConductors,
      conductorWeight,
      icingLoad: withIce ? conductorWeight * 0.5 : 0,
      totalVertical: conductorWeight + (withIce ? conductorWeight * 0.5 : 0),
      totalHorizontal: windOnStructure + windOnConductors,
      overturningMoment: overturningFromStructure + overturningFromConductors
    };
  }

  /**
   * Foundation loads for lattice tower
   */
  static foundationLoads(
    towerLoads: TowerLoadResult,
    baseWidth: number, // m
    legCount: 4 | 6 = 4
  ): {
    maxCompression: number; // kN
    maxUplift: number; // kN
    shearPerLeg: number; // kN
  } {
    const leverArm = baseWidth / Math.sqrt(2); // For square base
    
    // Compression = V/n + M/(n × r)
    const V_per_leg = towerLoads.totalVertical / legCount;
    const M_effect = towerLoads.overturningMoment / (legCount * leverArm / 2);
    
    return {
      maxCompression: V_per_leg + M_effect,
      maxUplift: Math.max(M_effect - V_per_leg, 0),
      shearPerLeg: towerLoads.totalHorizontal / legCount
    };
  }

  /**
   * Member forces in X-bracing panel
   */
  static xBracingForces(
    panelShear: number, // kN
    panelHeight: number, // m
    panelWidth: number // m
  ): {
    diagonalTension: number; // kN
    diagonalCompression: number; // kN
    horizontalForce: number; // kN
  } {
    const diagLength = Math.sqrt(panelHeight * panelHeight + panelWidth * panelWidth);
    const angle = Math.atan(panelHeight / panelWidth);
    
    // Diagonal carries shear (one in tension, one in compression)
    const diagForce = panelShear / Math.sin(angle);

    return {
      diagonalTension: diagForce / 2,
      diagonalCompression: diagForce / 2,
      horizontalForce: diagForce * Math.cos(angle) / 2
    };
  }
}

// ============================================================================
// PIPE RACK DESIGN
// ============================================================================

export class PipeRackDesign {
  /**
   * Pipe loads
   */
  static pipeLoads(
    pipes: { diameter: number; wallThickness: number; contents: 'liquid' | 'gas' | 'empty' }[],
    insulation: boolean = true
  ): {
    totalWeight: number; // kN/m
    thermalExpansion: number; // mm per 100m at 100°C rise
    frictionLoad: number; // kN/m per °C
  } {
    let totalWeight = 0;
    
    for (const pipe of pipes) {
      // Pipe weight
      const pipeArea = Math.PI * (Math.pow(pipe.diameter, 2) - 
                       Math.pow(pipe.diameter - 2 * pipe.wallThickness, 2)) / 4e6;
      const steelWeight = pipeArea * 7850 * 9.81 / 1000; // kN/m
      
      // Contents
      let contentsWeight = 0;
      const contentsArea = Math.PI * Math.pow(pipe.diameter - 2 * pipe.wallThickness, 2) / 4e6;
      if (pipe.contents === 'liquid') {
        contentsWeight = contentsArea * 1000 * 9.81 / 1000; // Water
      }
      
      // Insulation
      const insulationWeight = insulation ? 0.05 * pipe.diameter / 1000 : 0;
      
      totalWeight += steelWeight + contentsWeight + insulationWeight;
    }
    
    // Thermal expansion
    const alpha = 12e-6; // Steel coefficient
    const thermalExpansion = alpha * 100 * 100 * 1000; // mm per 100m at ΔT=100°C
    
    // Friction (at guides)
    const frictionCoeff = 0.3;
    const frictionLoad = frictionCoeff * totalWeight / 100; // Per °C per m

    return {
      totalWeight,
      thermalExpansion,
      frictionLoad
    };
  }

  /**
   * Bent frame analysis
   */
  static bentFrameDesign(
    height: number, // m
    span: number, // m
    pipeLoad: number, // kN/m (operating)
    windLoad: number, // kN/m (on pipes)
    seismicCoeff: number = 0.1
  ): {
    beamMoment: number; // kN·m
    columnMoment: number; // kN·m
    columnAxial: number; // kN
    baseShear: number; // kN
  } {
    // Simple portal frame analysis
    const w = pipeLoad;
    const L = span;
    const H = height;
    
    // Gravity loading
    const M_beam = w * L * L / 8;
    const V_reaction = w * L / 2;
    
    // Lateral loading (wind or seismic)
    const P_lateral = Math.max(windLoad * L, seismicCoeff * w * L);
    const M_base = P_lateral * H / 2;
    
    // Combined effects
    const beamMoment = M_beam * 1.2 + 0; // Beam not affected much by lateral
    const columnMoment = M_beam * 0.5 + M_base; // Portal frame distribution
    const columnAxial = V_reaction * 1.2 + P_lateral * H / L * 1.0;
    const baseShear = P_lateral;

    return {
      beamMoment,
      columnMoment,
      columnAxial,
      baseShear
    };
  }

  /**
   * Longitudinal stability
   */
  static longitudinalBracing(
    totalLength: number, // m
    pipeWeight: number, // kN/m
    frictionLoad: number, // kN/m per °C
    temperatureRange: number, // °C
    bracingType: 'X-bracing' | 'K-bracing' | 'moment-frame'
  ): {
    totalLongitudinalForce: number; // kN
    bracingForce: number; // kN
    anchorForce: number; // kN
    expansionLoopLength?: number; // m
  } {
    // Friction from thermal movement
    const totalFriction = frictionLoad * temperatureRange * totalLength;
    
    // Anchor forces (each end takes half)
    const anchorForce = totalFriction / 2;
    
    // Bracing at each bent
    const bracingSpacing = 20; // m typical
    const nBraces = Math.ceil(totalLength / bracingSpacing);
    const bracingForce = totalFriction / nBraces;
    
    // Expansion loop (if needed)
    let expansionLoop: number | undefined;
    const maxAnchorCapacity = 500; // kN (example)
    if (anchorForce > maxAnchorCapacity) {
      // Need expansion loop
      const alpha = 12e-6;
      const expansion = alpha * temperatureRange * totalLength * 1000;
      expansionLoop = 2 * Math.sqrt(expansion * 100); // Approximate loop length
    }

    return {
      totalLongitudinalForce: totalFriction,
      bracingForce,
      anchorForce,
      expansionLoopLength: expansionLoop
    };
  }
}

// ============================================================================
// EQUIPMENT FOUNDATIONS
// ============================================================================

export class EquipmentFoundations {
  /**
   * Rotating equipment vibration
   */
  static rotatingEquipment(
    mass: number, // kg
    rotatingMass: number, // kg
    eccentricity: number, // mm
    operatingSpeed: number, // RPM
    foundationMass: number, // kg
    soilStiffness: number // kN/m
  ): {
    dynamicForce: number; // kN
    frequencyRatio: number;
    amplification: number;
    displacement: number; // mm
    acceptable: boolean;
  } {
    const omega = operatingSpeed * 2 * Math.PI / 60; // rad/s
    const e = eccentricity / 1000; // m
    
    // Dynamic force from unbalance
    const F0 = rotatingMass * e * omega * omega / 1000; // kN
    
    // Natural frequency
    const M_total = mass + foundationMass;
    const fn = Math.sqrt(soilStiffness * 1000 / M_total) / (2 * Math.PI);
    
    // Frequency ratio
    const r = (operatingSpeed / 60) / fn;
    
    // Damping ratio (assume 5%)
    const zeta = 0.05;
    
    // Amplification factor
    const D = 1 / Math.sqrt(Math.pow(1 - r * r, 2) + Math.pow(2 * zeta * r, 2));
    
    // Displacement
    const x0 = F0 / soilStiffness * D * 1000; // mm
    
    // Acceptability (per ISO 10816)
    const acceptable = x0 < 0.1; // 0.1mm typical limit for rotating equipment

    return {
      dynamicForce: F0,
      frequencyRatio: r,
      amplification: D,
      displacement: x0,
      acceptable
    };
  }

  /**
   * Reciprocating equipment
   */
  static reciprocatingEquipment(
    primaryForce: number, // kN (first order)
    secondaryForce: number, // kN (second order)
    operatingSpeed: number, // RPM
    foundationMass: number, // kg
    soilStiffness: number // kN/m
  ): {
    maxDynamicForce: number;
    resonanceCheck: { first: boolean; second: boolean };
    recommendations: string[];
  } {
    const omega = operatingSpeed * 2 * Math.PI / 60;
    const M = foundationMass;
    const K = soilStiffness * 1000;
    
    const fn = Math.sqrt(K / M) / (2 * Math.PI);
    
    // Check resonance with 1st and 2nd order
    const r1 = (operatingSpeed / 60) / fn;
    const r2 = (2 * operatingSpeed / 60) / fn;
    
    const resonance1 = r1 > 0.8 && r1 < 1.2;
    const resonance2 = r2 > 0.8 && r2 < 1.2;
    
    const recommendations: string[] = [];
    if (resonance1 || resonance2) {
      recommendations.push('Resonance detected - adjust foundation mass');
      if (r1 < 0.8) {
        recommendations.push('Increase foundation mass to lower natural frequency');
      } else {
        recommendations.push('Decrease foundation mass to raise natural frequency');
      }
    }
    
    recommendations.push(`Natural frequency: ${fn.toFixed(1)} Hz`);
    recommendations.push(`Operating frequency: ${(operatingSpeed/60).toFixed(1)} Hz (1st), ${(2*operatingSpeed/60).toFixed(1)} Hz (2nd)`);

    return {
      maxDynamicForce: Math.sqrt(primaryForce * primaryForce + secondaryForce * secondaryForce),
      resonanceCheck: { first: resonance1, second: resonance2 },
      recommendations
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ChimneyDesign,
  CoolingTowerDesign,
  TransmissionTowerDesign,
  PipeRackDesign,
  EquipmentFoundations
};
