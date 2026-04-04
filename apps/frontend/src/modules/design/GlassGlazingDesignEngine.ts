/**
 * ============================================================================
 * GLASS AND GLAZING STRUCTURAL DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive structural design for glass in buildings:
 * - Glass type selection and design
 * - Wind and impact loading
 * - Thermal stress analysis
 * - Edge stress calculations
 * - Point-supported glazing
 * - Structural silicone glazing (SSG)
 * - Bomb blast resistant glazing
 * - Post-breakage behavior
 * 
 * Design Codes Supported:
 * - ASTM E1300 (Glass in Buildings)
 * - ASTM E2751 (Blast Resistant Glazing)
 * - EN 16612 (Glass in Building - Loads)
 * - EN 13474 (Glass in Building - Design of Glass Panes)
 * - AS 1288 (Glass in Buildings - Selection and Installation)
 * - prEN 16613 (Laminated Glass and Laminated Safety Glass)
 * - GSA-TS01 (Standard Test Method for Blast)
 * - CWCT TN66/67 (Glass in Buildings)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface GlassPane {
  type: 'annealed' | 'heat-strengthened' | 'tempered' | 'chemically-strengthened';
  thickness: number; // mm (nominal)
  width: number; // mm (shorter dimension)
  height: number; // mm (longer dimension)
  surfaceCondition: 'as-cut' | 'ground' | 'polished' | 'coated';
  edgeCondition: 'cut' | 'seamed' | 'ground' | 'polished';
  coating?: 'soft-coat-LowE' | 'hard-coat-LowE' | 'reflective' | 'none';
}

export interface IGUnit {
  outerPane: GlassPane;
  innerPane: GlassPane;
  middlePane?: GlassPane; // For triple glazing
  spacer: {
    width: number; // mm
    type: 'aluminum' | 'warm-edge' | 'structural';
  };
  gassFill: 'air' | 'argon' | 'krypton';
  sealant: 'silicone' | 'polysulfide' | 'polyisobutylene';
}

export interface LaminatedGlass {
  glassLayers: GlassPane[];
  interlayer: {
    type: 'PVB' | 'SGP' | 'EVA' | 'ionoplast';
    thickness: number; // mm (total interlayer)
    numberOfLayers: number;
  };
  postBreakageBehavior: 'fail-safe' | 'retained' | 'unknown';
}

export interface GlazingSystem {
  type: 'framed-4edge' | 'framed-2edge' | 'point-supported' | 'cable-net' | 
        'structural-silicone' | 'channel-glazing' | 'butt-joint';
  
  // For framed systems
  frameMaterial?: 'aluminum' | 'steel' | 'timber' | 'GFRP';
  biteDepth?: number; // mm (edge engagement)
  settingBlocks?: { width: number; hardness: number }; // Shore A hardness
  
  // For point-supported
  fittings?: {
    type: 'countersunk' | 'clamp' | 'undercut' | 'bolt-through';
    diameter: number; // mm
    spacing: number[]; // mm [x, y]
    edgeDistance: number; // mm
    material: 'stainless-steel' | 'bronze' | 'aluminum';
  };
  
  // For structural silicone
  silicone?: {
    designStrength: number; // kPa (typically 138-207)
    biteWidth: number; // mm
    thickness: number; // mm
    type: 'one-part' | 'two-part';
  };
}

export interface GlassLoads {
  wind: {
    pressure: number; // kPa (positive for inward)
    suction: number; // kPa (negative, outward)
    gust: number; // kPa (short duration)
  };
  thermal: {
    summerExterior: number; // °C
    summerInterior: number; // °C
    winterExterior: number; // °C
    winterInterior: number; // °C
    solarAbsorption?: number; // % (for tinted/coated glass)
  };
  impact?: {
    type: 'soft-body' | 'hard-body' | 'hurricane-debris';
    energy?: number; // J
  };
  blast?: {
    peakPressure: number; // kPa
    positivePhaseDuration: number; // ms
    standoffDistance: number; // m
  };
  seismic?: {
    interstoryDrift: number; // ratio
    acceleration: number; // g
  };
}

export interface GlassDesignResult {
  code: string;
  
  // Glass specification
  recommendedType: string;
  recommendedThickness: number[]; // mm (each layer)
  makeupDescription: string;
  
  // Stress analysis
  stresses: {
    windPositive: { center: number; edge: number }; // MPa
    windNegative: { center: number; edge: number }; // MPa
    thermal: { edge: number; body: number }; // MPa
    pointLoad?: { fitting: number; body: number }; // MPa
  };
  
  // Allowable stresses
  allowableStresses: {
    surface: number; // MPa
    edge: number; // MPa
    pointSupport?: number; // MPa
  };
  
  // Deflection
  deflection: {
    shortTerm: number; // mm
    longTerm?: number; // mm
    limitL_over: number; // L/X
    ratio: number; // actual L/X
    acceptable: boolean;
  };
  
  // Probability of breakage
  probabilityOfBreakage?: number; // per panel per year
  
  // Safety ratings
  safetyRatings?: {
    impactClass?: string;
    hurricaneRated?: boolean;
    blastRating?: string;
    fireRating?: string;
  };
  
  status: 'acceptable' | 'unacceptable' | 'review-required';
  recommendations: string[];
}

// ============================================================================
// GLASS MATERIAL PROPERTIES
// ============================================================================

export class GlassMaterial {
  /**
   * Standard glass properties
   */
  static readonly PROPERTIES = {
    youngsModulus: 70000, // MPa
    poissonsRatio: 0.22,
    density: 2500, // kg/m³
    thermalExpansion: 9e-6, // per °C
    
    // Allowable stresses (MPa) - ASTM E1300 based
    annealed: {
      surface: 23.3, // 3-second duration
      edge: 17.2
    },
    'heat-strengthened': {
      surface: 46.6,
      edge: 36.5
    },
    tempered: {
      surface: 93.1,
      edge: 73.8
    },
    'chemically-strengthened': {
      surface: 120,
      edge: 100
    }
  };

  /**
   * Get allowable stress with duration factor
   */
  static allowableStress(
    glassType: GlassPane['type'],
    location: 'surface' | 'edge',
    loadDuration: '3-sec' | '1-min' | '1-hr' | 'permanent'
  ): number {
    const base = this.PROPERTIES[glassType]?.[location] || 
                 this.PROPERTIES['annealed'][location];

    // Load duration factor (glass is stronger for shorter durations)
    const durationFactor: Record<string, number> = {
      '3-sec': 1.0,
      '1-min': 0.72,
      '1-hr': 0.56,
      'permanent': 0.43
    };

    return base * (durationFactor[loadDuration] || 1.0);
  }

  /**
   * Effective thickness for laminated glass
   */
  static effectiveThicknessLaminated(
    layers: number[], // mm (glass thicknesses)
    interlayerType: LaminatedGlass['interlayer']['type'],
    loadDuration: 'short' | 'long',
    temperature: number // °C
  ): {
    deflection: number; // mm (equivalent monolithic)
    stress: number; // mm (for stress calculation)
    shearTransfer: number; // % (interlayer coupling)
  } {
    // Interlayer shear modulus (approximate values)
    const shearModulus: Record<string, Record<string, number>> = {
      'PVB': { 'short': 1.0, 'long': 0.1 }, // MPa at 20°C
      'SGP': { 'short': 100, 'long': 50 },
      'EVA': { 'short': 0.5, 'long': 0.05 },
      'ionoplast': { 'short': 120, 'long': 60 }
    };

    const G = shearModulus[interlayerType]?.[loadDuration] || 0.5;
    
    // Temperature reduction (simplified)
    const tempFactor = temperature > 20 ? Math.pow(0.95, (temperature - 20) / 10) : 1.0;
    const G_eff = G * tempFactor;

    // Effective thickness per prEN 16612
    const n = layers.length;
    const h = layers.reduce((sum, t) => sum + t, 0);
    
    // Monolithic thickness (no coupling)
    const h_mono = Math.pow(layers.reduce((sum, t) => sum + Math.pow(t, 3), 0), 1/3);

    // Full coupling thickness
    const h_full = Math.pow(layers.reduce((sum, t) => sum + Math.pow(t, 3), 0) + 
                           12 * layers.reduce((sum, t, i) => {
                             if (i === 0) return sum;
                             const hm = layers.slice(0, i).reduce((s, tt) => s + tt, 0) + 
                                       layers[i] / 2;
                             return sum + layers[i] * hm * hm;
                           }, 0), 1/3);

    // Coupling factor (depends on G and geometry)
    const omega = 1 / (1 + 9.6 * h_mono * h_mono * h_mono / (G_eff * 1000 * 1000));
    
    const h_eff_deflection = Math.pow(Math.pow(h_mono, 3) + omega * 
                              (Math.pow(h_full, 3) - Math.pow(h_mono, 3)), 1/3);

    // Stress effective thickness (different formula)
    const h_eff_stress = Math.pow(layers[0] * layers[0] / h_eff_deflection, 0.5) * 
                         layers[0];

    return {
      deflection: h_eff_deflection,
      stress: h_eff_stress,
      shearTransfer: omega * 100
    };
  }
}

// ============================================================================
// WIND LOAD ANALYSIS
// ============================================================================

export class GlassWindAnalysis {
  /**
   * Calculate glass stress under uniform pressure
   */
  static uniformPressureStress(
    pane: GlassPane,
    pressure: number, // kPa
    supportCondition: '4-edge' | '2-edge' | 'point-4' | 'point-6'
  ): {
    centerStress: number; // MPa
    edgeStress: number; // MPa
    maxDeflection: number; // mm
  } {
    const a = pane.height; // mm (longer)
    const b = pane.width; // mm (shorter)
    const t = pane.thickness;
    const E = GlassMaterial.PROPERTIES.youngsModulus;
    const nu = GlassMaterial.PROPERTIES.poissonsRatio;
    const q = pressure / 1000; // MPa

    const aspectRatio = a / b;
    
    // Plate coefficients (from tables)
    let alpha: number, beta1: number, beta2: number;
    
    if (supportCondition === '4-edge') {
      // Simply supported on 4 edges
      if (aspectRatio <= 1.2) {
        alpha = 0.0444;
        beta1 = 0.287;
        beta2 = 0.287;
      } else if (aspectRatio <= 1.5) {
        alpha = 0.0616;
        beta1 = 0.348;
        beta2 = 0.245;
      } else if (aspectRatio <= 2.0) {
        alpha = 0.0770;
        beta1 = 0.384;
        beta2 = 0.190;
      } else {
        // Approaching one-way
        alpha = 0.0906;
        beta1 = 0.400;
        beta2 = 0.120;
      }
    } else if (supportCondition === '2-edge') {
      // Supported on 2 opposite edges
      alpha = 5 / 384;
      beta1 = 0.5;
      beta2 = 0;
    } else {
      // Point supported (approximate)
      alpha = 0.12;
      beta1 = 0.5;
      beta2 = 0.5;
    }

    // Maximum deflection at center
    const maxDeflection = alpha * q * Math.pow(b, 4) / (E * Math.pow(t, 3)) * 
                          (1 - nu * nu) * 1000;

    // Maximum stress at center
    const centerStress = beta1 * q * Math.pow(b / t, 2);

    // Edge stress (typically lower for 4-edge support)
    const edgeStress = supportCondition === '4-edge' ? 
                       beta2 * q * Math.pow(b / t, 2) :
                       0.8 * centerStress;

    return {
      centerStress,
      edgeStress,
      maxDeflection
    };
  }

  /**
   * ASTM E1300 glass load resistance (non-factored)
   */
  static astmE1300LoadResistance(
    pane: GlassPane,
    probability: number = 8 // per 1000 (standard is 8/1000)
  ): {
    LR: number; // kPa (load resistance)
    GTF: number; // Glass type factor
    NFL: number; // Non-factored load
  } {
    const a = pane.height / 1000; // m
    const b = pane.width / 1000; // m
    const t = pane.thickness;

    // Glass type factor
    const GTF: Record<GlassPane['type'], number> = {
      'annealed': 1.0,
      'heat-strengthened': 2.0,
      'tempered': 4.0,
      'chemically-strengthened': 5.0
    };

    // Non-factored load from charts (simplified approximation)
    // Based on ASTM E1300 tables
    const area = a * b;
    const aspectRatio = a / b;

    // Base NFL for 6mm annealed glass (kPa)
    let NFL_base: number;
    if (area < 1) {
      NFL_base = 2.5;
    } else if (area < 2) {
      NFL_base = 2.0;
    } else if (area < 4) {
      NFL_base = 1.6;
    } else if (area < 8) {
      NFL_base = 1.3;
    } else {
      NFL_base = 1.0;
    }

    // Thickness adjustment
    const thicknessRatio = Math.pow(t / 6, 2);
    const NFL = NFL_base * thicknessRatio;

    // Load resistance
    const LR = NFL * GTF[pane.type];

    return { LR, GTF: GTF[pane.type], NFL };
  }

  /**
   * Load share in insulating glass unit
   */
  static igUnitLoadShare(
    igu: IGUnit,
    appliedPressure: number, // kPa
    altitude: number = 0, // m above sea level
    temperatureDelta: number = 0 // °C (from sealing temp)
  ): {
    outerPanePressure: number; // kPa
    innerPanePressure: number; // kPa
    cavityPressure: number; // kPa
    equalizing: boolean;
  } {
    const t1 = igu.outerPane.thickness;
    const t2 = igu.innerPane.thickness;
    const s = igu.spacer.width;

    // Stiffness ratio
    const D1 = Math.pow(t1, 3);
    const D2 = Math.pow(t2, 3);
    const ratio = D1 / (D1 + D2);

    // Pressure sharing
    const outerPanePressure = appliedPressure * (1 - ratio);
    const innerPanePressure = appliedPressure * ratio;

    // Cavity pressure change
    // ΔP = P0 * (ΔT/T0 - Δh/(8500))
    const altitudePressure = -altitude / 8500 * 101; // kPa
    const thermalPressure = temperatureDelta / 273 * 101; // kPa
    const cavityPressure = altitudePressure + thermalPressure;

    return {
      outerPanePressure: Math.abs(outerPanePressure),
      innerPanePressure: Math.abs(innerPanePressure),
      cavityPressure,
      equalizing: igu.spacer.type === 'warm-edge' // Simplified
    };
  }
}

// ============================================================================
// THERMAL STRESS ANALYSIS
// ============================================================================

export class ThermalStressAnalysis {
  /**
   * Calculate thermal stress in glass
   */
  static thermalStress(
    pane: GlassPane,
    edgeTemperature: number, // °C
    centerTemperature: number, // °C
    frameShadowWidth: number = 50 // mm
  ): {
    edgeStress: number; // MPa
    bodyStress: number; // MPa
    riskCategory: 'low' | 'medium' | 'high';
    recommendations: string[];
  } {
    const E = GlassMaterial.PROPERTIES.youngsModulus;
    const alpha = GlassMaterial.PROPERTIES.thermalExpansion;
    const nu = GlassMaterial.PROPERTIES.poissonsRatio;

    // Temperature differential
    const deltaT = Math.abs(centerTemperature - edgeTemperature);

    // Thermal stress (restrained edge)
    // σ = E * α * ΔT / (1 - ν)
    const sigma = E * alpha * deltaT / (1 - nu);

    const recommendations: string[] = [];

    // Risk assessment
    let riskCategory: 'low' | 'medium' | 'high';
    const allowable = GlassMaterial.PROPERTIES[pane.type]?.edge || 17.2;

    if (sigma < allowable * 0.5) {
      riskCategory = 'low';
    } else if (sigma < allowable * 0.8) {
      riskCategory = 'medium';
      recommendations.push('Consider heat-strengthened glass');
    } else {
      riskCategory = 'high';
      recommendations.push('Use tempered or heat-strengthened glass');
      if (pane.type === 'annealed') {
        recommendations.push('Edge polishing recommended');
      }
    }

    // Additional factors
    if (pane.coating?.includes('LowE') || pane.surfaceCondition === 'coated') {
      recommendations.push('Verify thermal performance with coating manufacturer');
    }
    if (frameShadowWidth > 75) {
      recommendations.push('Wide shadow band increases thermal stress risk');
    }

    return {
      edgeStress: sigma,
      bodyStress: sigma * 0.3, // Lower in body
      riskCategory,
      recommendations
    };
  }

  /**
   * Solar heat gain induced stress
   */
  static solarInducedStress(
    pane: GlassPane,
    solarAbsorption: number, // % (0-100)
    solarIrradiance: number = 800, // W/m²
    airTemperature: number = 30, // °C
    windSpeed: number = 2 // m/s
  ): {
    surfaceTemperature: number; // °C
    edgeTemperature: number; // °C
    thermalStress: number; // MPa
  } {
    const absorptance = solarAbsorption / 100;
    const thickness = pane.thickness / 1000; // m

    // Heat transfer coefficients
    const h_ext = 4 + 4 * windSpeed; // W/(m²·K) approximate
    const h_int = 8; // W/(m²·K) interior

    // Energy balance
    const Q_absorbed = absorptance * solarIrradiance;
    const U = 1 / (1 / h_ext + thickness / 1 + 1 / h_int);

    // Surface temperature rise
    const deltaT_surface = Q_absorbed / (h_ext + h_int);
    const surfaceTemperature = airTemperature + deltaT_surface;

    // Edge temperature (shaded, near air temperature)
    const edgeTemperature = airTemperature + deltaT_surface * 0.3;

    // Calculate thermal stress
    const thermalResult = this.thermalStress(
      pane,
      edgeTemperature,
      surfaceTemperature
    );

    return {
      surfaceTemperature,
      edgeTemperature,
      thermalStress: thermalResult.edgeStress
    };
  }
}

// ============================================================================
// POINT-SUPPORTED GLAZING
// ============================================================================

export class PointSupportedGlazing {
  /**
   * Stress at point fitting location
   */
  static fittingStress(
    pane: GlassPane,
    fittingType: GlazingSystem['fittings'],
    windPressure: number, // kPa
    pointLoads?: { x: number; y: number; force: number }[] // kN
  ): {
    holeEdgeStress: number; // MPa
    panelBodyStress: number; // MPa
    localBending: number; // MPa
    stressConcentrationFactor: number;
    recommendations: string[];
  } {
    if (!fittingType) {
      throw new Error('Fitting properties required');
    }

    const t = pane.thickness;
    const d = fittingType.diameter;
    const a = fittingType.spacing[0]; // x spacing
    const b = fittingType.spacing[1]; // y spacing
    const e = fittingType.edgeDistance;

    const recommendations: string[] = [];

    // Tributary area per fitting
    const tributaryArea = a * b; // mm²
    const forcePerFitting = windPressure * tributaryArea / 1e6; // kN

    // Stress concentration at hole
    let SCF: number;
    switch (fittingType.type) {
      case 'countersunk':
        SCF = 3.5;
        break;
      case 'clamp':
        SCF = 2.0;
        break;
      case 'undercut':
        SCF = 2.5;
        break;
      case 'bolt-through':
        SCF = 4.0;
        break;
      default:
        SCF = 3.0;
    }

    // Hole edge stress
    // σ = SCF * F / (t * d)
    const holeEdgeStress = SCF * forcePerFitting * 1000 / (t * d);

    // Local bending near fitting
    const localBending = 0.5 * holeEdgeStress;

    // Panel body stress (away from fittings)
    const panelBodyStress = holeEdgeStress / SCF;

    // Checks
    if (d / t > 5) {
      recommendations.push('Hole diameter to thickness ratio > 5 - increase glass thickness');
    }
    if (e < 2 * d) {
      recommendations.push('Edge distance should be ≥ 2× hole diameter');
    }
    if (fittingType.type === 'bolt-through' && pane.type !== 'tempered') {
      recommendations.push('Bolt-through fittings require tempered glass');
    }

    return {
      holeEdgeStress,
      panelBodyStress,
      localBending,
      stressConcentrationFactor: SCF,
      recommendations
    };
  }

  /**
   * Design point-supported panel
   */
  static designPanel(
    width: number, // mm
    height: number, // mm
    windPressure: number, // kPa
    deflectionLimit: number = 50 // L/X
  ): {
    recommendedThickness: number; // mm
    recommendedFittingSpacing: number[]; // [x, y] mm
    numberOfFittings: number;
    glassType: GlassPane['type'];
    laminated: boolean;
  } {
    const shorter = Math.min(width, height);
    const longer = Math.max(width, height);

    // Determine number of fittings
    let numX: number, numY: number;
    if (longer < 1500 && shorter < 1000) {
      numX = 2; numY = 2;
    } else if (longer < 2500) {
      numX = 2; numY = longer > 2000 ? 3 : 2;
    } else {
      numX = 3;
      numY = Math.ceil(longer / 1200);
    }

    const spacingX = width / (numX - 1);
    const spacingY = height / (numY - 1);
    const numberOfFittings = numX * numY;

    // Estimate thickness for deflection
    const E = GlassMaterial.PROPERTIES.youngsModulus;
    const nu = GlassMaterial.PROPERTIES.poissonsRatio;
    
    // Approximate deflection formula for point support
    const maxSpan = Math.max(spacingX, spacingY);
    const allowableDeflection = maxSpan / deflectionLimit;
    
    // t = k * (q * a⁴ / (E * w))^(1/3)
    const k = 0.25;
    const q = windPressure / 1000; // MPa
    const t_required = k * Math.pow(q * Math.pow(maxSpan, 4) / 
                       (E * allowableDeflection), 1/3);

    // Round up to standard thickness
    const standardThicknesses = [6, 8, 10, 12, 15, 19];
    const recommendedThickness = standardThicknesses.find(t => t >= t_required) || 19;

    return {
      recommendedThickness,
      recommendedFittingSpacing: [spacingX, spacingY],
      numberOfFittings,
      glassType: 'tempered', // Always tempered for point support
      laminated: height > 3000 || numberOfFittings > 6 // Safety consideration
    };
  }
}

// ============================================================================
// STRUCTURAL SILICONE GLAZING (SSG)
// ============================================================================

export class StructuralSiliconeGlazing {
  /**
   * Design structural silicone joint
   */
  static designJoint(
    glassWidth: number, // mm (tributary)
    glassHeight: number, // mm (tributary)
    deadWeight: number, // kg/m (glass weight)
    windPressure: number, // kPa
    siliconeDesignStrength: number = 138 // kPa (typical)
  ): {
    requiredBiteWidth: number; // mm
    requiredThickness: number; // mm
    deadLoadCapacity: number; // kN/m
    windLoadCapacity: number; // kN/m
    movementCapacity: number; // mm
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // Wind load
    const w_wind = windPressure * Math.min(glassWidth, glassHeight) / 2 / 1000; // kN/m

    // Dead load (for 2-sided SSG, dead load must be supported)
    const w_dead = deadWeight * 9.81 / 1000; // kN/m

    // Required bite width
    const f_s = siliconeDesignStrength; // kPa
    const requiredBiteWidth = w_wind * 1000 / f_s; // mm

    // Minimum dimensions per ETAG 002
    const minBite = Math.max(6, requiredBiteWidth);
    const minThickness = 6; // mm minimum

    // Aspect ratio check (bite : thickness ≤ 3:1)
    let recommendedThickness = Math.max(minThickness, minBite / 3);
    
    // Movement capacity (typically 12.5% of bite width)
    const movementCapacity = minBite * 0.125;

    // Check movement for thermal expansion
    const thermalMovement = 0.000012 * Math.max(glassWidth, glassHeight) * 40; // mm (assuming 40°C range)
    if (thermalMovement > movementCapacity) {
      recommendations.push('Increase joint thickness for thermal movement');
      recommendedThickness = Math.max(recommendedThickness, thermalMovement / 0.25 + 2);
    }

    // Capacity checks
    const deadLoadCapacity = f_s * minBite * 0.5 / 1000; // kN/m (reduced for sustained load)
    const windLoadCapacity = f_s * minBite / 1000; // kN/m

    if (w_dead > deadLoadCapacity) {
      recommendations.push('Use mechanical support for dead load (setting blocks)');
    }

    // SSG system recommendations
    if (glassHeight > 3000) {
      recommendations.push('Consider 4-sided SSG with mechanical retention');
    }

    return {
      requiredBiteWidth: Math.ceil(minBite),
      requiredThickness: Math.ceil(recommendedThickness),
      deadLoadCapacity,
      windLoadCapacity,
      movementCapacity,
      recommendations
    };
  }

  /**
   * Check SSG for seismic movement
   */
  static seismicCheck(
    biteWidth: number, // mm
    jointThickness: number, // mm
    glassWidth: number, // mm
    glassHeight: number, // mm
    interstoryDrift: number, // ratio
    storyHeight: number // mm
  ): {
    expectedMovement: number; // mm
    movementCapacity: number; // mm
    adequate: boolean;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // Parallelogram movement
    const driftMovement = interstoryDrift * storyHeight;
    const diagonalMovement = driftMovement * glassHeight / storyHeight;

    // Joint movement capacity (25% elongation typical for silicone)
    const movementCapacity = jointThickness * 0.25;

    const adequate = diagonalMovement <= movementCapacity;

    if (!adequate) {
      recommendations.push('Increase joint thickness or reduce glass panel size');
      const requiredThickness = diagonalMovement / 0.25;
      recommendations.push(`Required joint thickness: ${Math.ceil(requiredThickness)}mm`);
    }

    return {
      expectedMovement: diagonalMovement,
      movementCapacity,
      adequate,
      recommendations
    };
  }
}

// ============================================================================
// BLAST RESISTANT GLAZING
// ============================================================================

export class BlastResistantGlazing {
  /**
   * Analyze glazing under blast loading
   */
  static analyzeBlastResponse(
    pane: GlassPane | LaminatedGlass,
    width: number, // mm
    height: number, // mm
    blast: GlassLoads['blast'],
    support: 'flexible-frame' | 'rigid-frame'
  ): {
    peakDeflection: number; // mm
    edgeReaction: number; // kN/m
    glassResponse: 'elastic' | 'cracked-retained' | 'failed';
    hazardLevel: 'none' | 'low' | 'medium' | 'high' | 'very-high';
    requiredCatcher?: { depth: number; material: string };
    recommendations: string[];
  } {
    if (!blast) {
      throw new Error('Blast loading required');
    }

    const recommendations: string[] = [];
    const a = Math.max(width, height);
    const b = Math.min(width, height);

    // SDOF analysis (simplified)
    const isLaminated = 'interlayer' in pane;
    const thickness = isLaminated ? 
      (pane as LaminatedGlass).glassLayers.reduce((sum, l) => sum + l.thickness, 0) :
      (pane as GlassPane).thickness;

    // Natural period
    const E = GlassMaterial.PROPERTIES.youngsModulus;
    const rho = GlassMaterial.PROPERTIES.density;
    const Tn = 0.0283 * Math.sqrt(rho * Math.pow(a, 4) / (E * Math.pow(thickness, 3)));

    // Dynamic load factor
    const td = blast.positivePhaseDuration;
    const tdTn = td / Tn;
    let DLF: number;
    if (tdTn < 0.4) {
      DLF = 0.5 + 1.5 * tdTn;
    } else if (tdTn < 2) {
      DLF = 1.5 + 0.5 * (2 - tdTn);
    } else {
      DLF = 2.0;
    }

    // Peak deflection
    const q = blast.peakPressure * DLF;
    const deflectionCoeff = 0.00406; // Simply supported
    const peakDeflection = deflectionCoeff * q / 1000 * Math.pow(a, 4) / 
                           (E * Math.pow(thickness, 3)) * (1 - 0.22 * 0.22);

    // Edge reaction
    const edgeReaction = q * b / 2 / 1000; // kN/m

    // Glass response (simplified)
    let glassResponse: 'elastic' | 'cracked-retained' | 'failed';
    const deflectionRatio = peakDeflection / thickness;

    if (deflectionRatio < 30) {
      glassResponse = 'elastic';
    } else if (isLaminated && deflectionRatio < 100) {
      glassResponse = 'cracked-retained';
    } else {
      glassResponse = 'failed';
    }

    // Hazard level per GSA
    let hazardLevel: 'none' | 'low' | 'medium' | 'high' | 'very-high';
    if (glassResponse === 'elastic') {
      hazardLevel = 'none';
    } else if (glassResponse === 'cracked-retained') {
      hazardLevel = 'low';
    } else {
      hazardLevel = isLaminated ? 'medium' : 'very-high';
    }

    // Recommendations
    if (!isLaminated) {
      recommendations.push('Use laminated glass with ionoplast interlayer for blast');
    }
    const hazard = hazardLevel as string;
    if (hazard !== 'none' && hazard !== 'low') {
      recommendations.push('Install debris catch system');
    }
    if (support === 'flexible-frame') {
      recommendations.push('Verify frame can sustain 2× edge reaction');
    }

    // Catcher requirements
    let requiredCatcher: { depth: number; material: string } | undefined;
    if (hazard === 'medium' || hazard === 'high') {
      requiredCatcher = {
        depth: Math.max(300, peakDeflection * 2),
        material: hazard === 'high' ? 'steel-cable-net' : 'polymer-film'
      };
    }

    return {
      peakDeflection,
      edgeReaction,
      glassResponse,
      hazardLevel,
      requiredCatcher,
      recommendations
    };
  }
}

// ============================================================================
// COMPLETE GLASS DESIGN
// ============================================================================

export class GlassDesignEngine {
  /**
   * Complete glass design per applicable code
   */
  static designGlazing(
    width: number, // mm
    height: number, // mm
    loads: GlassLoads,
    system: GlazingSystem,
    code: 'ASTM-E1300' | 'EN-16612' | 'AS-1288' = 'ASTM-E1300'
  ): GlassDesignResult {
    const recommendations: string[] = [];
    const shorter = Math.min(width, height);
    const longer = Math.max(width, height);

    // Initial glass selection
    let glassType: GlassPane['type'] = 'annealed';
    let thickness = 6;

    // Wind analysis
    const maxWindPressure = Math.max(Math.abs(loads.wind.pressure), 
                                      Math.abs(loads.wind.suction));

    // Select glass thickness based on load resistance
    const testPane: GlassPane = {
      type: glassType,
      thickness,
      width: shorter,
      height: longer,
      surfaceCondition: 'as-cut',
      edgeCondition: 'seamed'
    };

    // Calculate required load resistance
    let LR = GlassWindAnalysis.astmE1300LoadResistance(testPane);
    
    while (LR.LR < maxWindPressure && thickness < 25) {
      thickness += 2;
      testPane.thickness = thickness;
      LR = GlassWindAnalysis.astmE1300LoadResistance(testPane);
    }

    if (LR.LR < maxWindPressure) {
      glassType = 'tempered';
      testPane.type = glassType;
      thickness = 6;
      testPane.thickness = thickness;
      LR = GlassWindAnalysis.astmE1300LoadResistance(testPane);
      
      while (LR.LR < maxWindPressure && thickness < 19) {
        thickness += 2;
        testPane.thickness = thickness;
        LR = GlassWindAnalysis.astmE1300LoadResistance(testPane);
      }
    }

    // Stress analysis
    const stressPositive = GlassWindAnalysis.uniformPressureStress(
      testPane, loads.wind.pressure, 
      system.type.includes('point') ? 'point-4' : '4-edge'
    );
    const stressNegative = GlassWindAnalysis.uniformPressureStress(
      testPane, loads.wind.suction,
      system.type.includes('point') ? 'point-4' : '4-edge'
    );

    // Thermal stress
    const thermalStress = ThermalStressAnalysis.solarInducedStress(
      testPane,
      30, // Assumed solar absorption
      800,
      loads.thermal.summerExterior
    );

    if (thermalStress.thermalStress > GlassMaterial.PROPERTIES[glassType].edge * 0.8) {
      if (glassType === 'annealed') {
        glassType = 'heat-strengthened';
        recommendations.push('Heat-strengthened glass required for thermal stress');
      }
    }

    // Deflection check
    const deflectionLimit = 75; // L/75 typical
    const allowableDeflection = shorter / deflectionLimit;
    const actualDeflection = stressPositive.maxDeflection;
    const deflectionOK = actualDeflection <= allowableDeflection;

    if (!deflectionOK) {
      recommendations.push(`Increase thickness to meet L/${deflectionLimit} deflection limit`);
    }

    // Makeup description
    let makeupDescription = `${thickness}mm ${glassType}`;
    
    // Consider laminated for safety
    if (longer > 2500 || system.type === 'point-supported' || loads.blast) {
      makeupDescription = `${thickness/2 + 0.5}/${thickness/2 + 0.5} laminated (1.52 PVB)`;
      recommendations.push('Laminated glass recommended for safety');
    }

    // Get allowable stresses
    const allowableSurface = GlassMaterial.allowableStress(glassType, 'surface', '3-sec');
    const allowableEdge = GlassMaterial.allowableStress(glassType, 'edge', '3-sec');

    // Status
    let status: GlassDesignResult['status'] = 'acceptable';
    const maxStress = Math.max(stressPositive.centerStress, stressNegative.centerStress);
    
    if (maxStress > allowableSurface || !deflectionOK) {
      status = 'unacceptable';
    } else if (maxStress > allowableSurface * 0.9) {
      status = 'review-required';
    }

    return {
      code,
      recommendedType: glassType,
      recommendedThickness: [thickness],
      makeupDescription,
      stresses: {
        windPositive: { center: stressPositive.centerStress, edge: stressPositive.edgeStress },
        windNegative: { center: stressNegative.centerStress, edge: stressNegative.edgeStress },
        thermal: { edge: thermalStress.thermalStress, body: thermalStress.thermalStress * 0.5 }
      },
      allowableStresses: {
        surface: allowableSurface,
        edge: allowableEdge
      },
      deflection: {
        shortTerm: actualDeflection,
        limitL_over: deflectionLimit,
        ratio: shorter / actualDeflection,
        acceptable: deflectionOK
      },
      probabilityOfBreakage: 8 / 1000, // Standard design probability
      status,
      recommendations
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  GlassMaterial,
  GlassWindAnalysis,
  ThermalStressAnalysis,
  PointSupportedGlazing,
  StructuralSiliconeGlazing,
  BlastResistantGlazing,
  GlassDesignEngine
};
