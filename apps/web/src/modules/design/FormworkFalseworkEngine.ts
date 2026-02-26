/**
 * ============================================================================
 * FORMWORK AND FALSEWORK DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive temporary works design:
 * - Formwork pressure calculation
 * - Shoring and reshoring analysis
 * - Scaffold design
 * - Falsework for bridges
 * - Form tie design
 * - Stripping time determination
 * - Lateral bracing
 * 
 * Design Codes Supported:
 * - ACI 347 (Guide to Formwork for Concrete)
 * - BS 5975 (Code of Practice for Falsework)
 * - EN 12812 (Falsework - Performance Requirements)
 * - EN 12811 (Temporary Works Equipment - Scaffolds)
 * - AS 3610 (Formwork for Concrete)
 * - ASCE 37 (Design Loads for Structures During Construction)
 * - ACI 318 (Stripping Requirements)
 * - BS EN 13670 (Execution of Concrete Structures)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ConcreteProperties {
  type: 'normal-weight' | 'lightweight' | 'heavyweight';
  density: number; // kg/m³
  fc28: number; // MPa (28-day strength)
  cementType: 'Type-I' | 'Type-II' | 'Type-III' | 'rapid-hardening';
  slump: number; // mm
  admixtures: ('retarder' | 'accelerator' | 'superplasticizer' | 'fly-ash')[];
  temperature: number; // °C (concrete temperature at placement)
}

export interface FormworkSection {
  type: 'wall' | 'column' | 'slab' | 'beam-side' | 'beam-soffit';
  
  // Geometry
  height?: number; // m (for walls/columns)
  thickness?: number; // m (for walls)
  span?: number; // m (for slabs/beams)
  width?: number; // m
  
  // Material
  formMaterial: 'plywood' | 'steel' | 'aluminum' | 'plastic' | 'timber';
  formThickness: number; // mm
  
  // Support system
  studs?: {
    spacing: number; // mm
    size: string; // e.g., "50x100"
    material: 'timber' | 'steel';
  };
  walers?: {
    spacing: number; // mm
    size: string;
  };
  ties?: {
    spacing: { horizontal: number; vertical: number }; // mm
    type: 'snap-tie' | 'she-bolt' | 'coil-tie' | 'taper-tie';
    capacity: number; // kN
  };
}

export interface ShoringSystem {
  type: 'single-post' | 'frame' | 'tower' | 'table-form';
  
  // Post/leg properties
  posts: {
    type: 'steel-prop' | 'timber-post' | 'aluminum-shore';
    capacity: number; // kN (allowable)
    spacing: { x: number; y: number }; // m
    height: number; // m
    extension?: number; // m (adjustable portion)
  };
  
  // Stringers and joists
  stringers?: {
    span: number; // m
    size: string;
    material: 'timber' | 'steel' | 'aluminum';
  };
  joists?: {
    span: number; // m
    spacing: number; // m
    size: string;
    material: 'timber' | 'steel' | 'aluminum';
  };
  
  // Bracing
  bracing: {
    type: 'diagonal' | 'cross' | 'horizontal' | 'none';
    spacing?: number; // m
  };
}

export interface FormworkLoads {
  concretePressure: number; // kN/m² (lateral)
  deadLoad: number; // kN/m² (self-weight of form)
  liveLoad: number; // kN/m² (workers, equipment)
  concreteLoad: number; // kN/m² (weight of fresh concrete)
  impactLoad: number; // kN/m² (from concrete placement)
  windLoad?: number; // kN/m² (for exposed formwork)
  seismic?: number; // fraction of weight
}

export interface FormworkDesignResult {
  code: string;
  
  // Pressure/loads
  designPressure: number; // kN/m²
  loadCombination: string;
  
  // Component checks
  sheathing: {
    stress: number; // MPa
    deflection: number; // mm
    adequate: boolean;
  };
  studs?: {
    bendingStress: number; // MPa
    deflection: number; // mm
    spacing: number; // mm
    adequate: boolean;
  };
  walers?: {
    bendingStress: number; // MPa
    shearStress: number; // MPa
    adequate: boolean;
  };
  ties?: {
    force: number; // kN
    utilization: number;
    adequate: boolean;
  };
  
  // Shoring checks
  shores?: {
    load: number; // kN per shore
    capacity: number; // kN
    utilization: number;
    buckling: boolean; // check passed
    adequate: boolean;
  };
  
  recommendations: string[];
}

export interface StrippingTime {
  element: 'slab-soffit' | 'beam-soffit' | 'column' | 'wall' | 'slab-props';
  minimumDays: number;
  strengthRequired: number; // % of fc28
  conditions: string;
  code: string;
}

// ============================================================================
// CONCRETE PRESSURE CALCULATION
// ============================================================================

export class ConcretePressure {
  /**
   * Calculate lateral pressure on wall formwork per ACI 347
   */
  static wallPressureACI347(
    concrete: ConcreteProperties,
    height: number, // m
    rateOfPour: number, // m/hr
    formworkType: 'conventional' | 'steel' | 'absorbent'
  ): {
    maximumPressure: number; // kN/m²
    fullLiquidHead: number; // m
    method: string;
    envelope: { depth: number; pressure: number }[];
  } {
    const W = concrete.density / 1000; // kN/m³
    const R = rateOfPour; // m/hr
    const T = concrete.temperature; // °C
    const h = height; // m
    const g = 9.81;
    
    // Chemistry factor Cc
    let Cc: number;
    switch (concrete.cementType) {
      case 'Type-I':
        Cc = 1.0;
        break;
      case 'Type-II':
        Cc = 1.0;
        break;
      case 'Type-III':
        Cc = 1.15;
        break;
      case 'rapid-hardening':
        Cc = 1.2;
        break;
      default:
        Cc = 1.0;
    }
    
    // Unit weight factor Cw
    let Cw: number;
    if (W <= 23) {
      Cw = 0.5 * (1 + W / 23);
    } else {
      Cw = 1.0;
    }
    
    // Method based on rate of pour
    let pmax: number;
    let method: string;
    
    if (R < 2.1) {
      // Equation 2-2 (walls with R < 2.1 m/hr)
      pmax = Cw * Cc * (7.2 + 785 * R / (T + 17.8));
      method = 'ACI 347 Equation 2-2';
    } else {
      // Equation 2-3 (walls with R ≥ 2.1 m/hr or columns)
      pmax = Cw * Cc * (7.2 + 1156 / (T + 17.8) + 244 * R / (T + 17.8));
      method = 'ACI 347 Equation 2-3';
    }
    
    // Apply limits
    const pmin = 30 * Cw; // Minimum pressure
    const pgmax = W * h; // Full liquid head
    
    pmax = Math.max(pmin, Math.min(pmax, pgmax));
    
    // Full liquid head depth
    const fullHead = pmax / W;
    
    // Pressure envelope
    const envelope: { depth: number; pressure: number }[] = [];
    for (let d = 0; d <= h; d += 0.5) {
      const p = d <= fullHead ? W * d : pmax;
      envelope.push({ depth: d, pressure: p });
    }
    envelope.push({ depth: h, pressure: h <= fullHead ? W * h : pmax });

    return {
      maximumPressure: pmax,
      fullLiquidHead: fullHead,
      method,
      envelope
    };
  }

  /**
   * Column pressure per ACI 347
   */
  static columnPressureACI347(
    concrete: ConcreteProperties,
    height: number, // m
    rateOfPour: number = 5 // m/hr (typically fast for columns)
  ): {
    maximumPressure: number; // kN/m²
    assumeFullLiquid: boolean;
  } {
    const W = concrete.density / 1000; // kN/m³
    const h = height;
    const T = concrete.temperature;
    
    // Chemistry and weight factors
    const Cc = concrete.cementType === 'Type-III' ? 1.15 : 1.0;
    const Cw = concrete.density <= 2300 ? 0.5 * (1 + concrete.density / 2300) : 1.0;
    
    // For columns, use full hydrostatic pressure up to limits
    const pLiquid = W * h;
    const pmax = 150 * Cw; // kN/m² maximum
    
    // Usually assume full liquid for columns < 3m
    const assumeFullLiquid = h < 3;
    
    return {
      maximumPressure: Math.min(pLiquid, pmax),
      assumeFullLiquid
    };
  }

  /**
   * CIRIA Report 108 method (European approach)
   */
  static wallPressureCIRIA(
    concrete: ConcreteProperties,
    height: number, // m
    rateOfPour: number, // m/hr
    formworkStiffness: 'flexible' | 'rigid'
  ): {
    maximumPressure: number; // kN/m²
    h1: number; // m (depth to hydrostatic zone)
    h2: number; // m (transition zone)
  } {
    const gamma = concrete.density / 1000; // kN/m³
    const R = rateOfPour;
    const T = concrete.temperature;
    const H = height;
    
    // Stiffness factor
    const C1 = formworkStiffness === 'flexible' ? 1.0 : 1.5;
    
    // Temperature factor
    const C2 = Math.sqrt(36 / (T + 16));
    
    // Additive factor (retarders, superplasticizers)
    let K = 0;
    if (concrete.admixtures.includes('retarder')) K += 0.3;
    if (concrete.admixtures.includes('superplasticizer')) K += 0.2;
    
    // Vertical limiting heights
    const h1 = C1 * C2 * Math.sqrt(R) + K;
    const h2 = 1.5 * h1;
    
    // Maximum pressure
    let pmax: number;
    if (H <= h1) {
      pmax = gamma * H;
    } else if (H <= h2) {
      pmax = gamma * h1 + (H - h1) * gamma * 0.6;
    } else {
      pmax = gamma * h1 + (h2 - h1) * gamma * 0.6;
    }

    return {
      maximumPressure: pmax,
      h1,
      h2
    };
  }

  /**
   * Self-compacting concrete (SCC) pressure
   */
  static sccPressure(
    density: number, // kg/m³
    height: number // m
  ): {
    pressure: number; // kN/m²
    note: string;
  } {
    // SCC typically develops full hydrostatic pressure
    const gamma = density / 1000;
    return {
      pressure: gamma * height,
      note: 'SCC assumed to develop full hydrostatic pressure'
    };
  }
}

// ============================================================================
// FORMWORK COMPONENT DESIGN
// ============================================================================

export class FormworkDesign {
  /**
   * Design plywood sheathing
   */
  static sheathingDesign(
    pressure: number, // kN/m²
    spanBetweenStuds: number, // mm
    plywoodThickness: number, // mm
    grain: 'face-parallel' | 'face-perpendicular' = 'face-parallel'
  ): {
    bendingStress: number; // MPa
    shearStress: number; // MPa
    deflection: number; // mm
    allowable: { bending: number; shear: number; deflection: number };
    adequate: boolean;
    recommendations: string[];
  } {
    const p = pressure / 1000; // MPa
    const L = spanBetweenStuds; // mm
    const t = plywoodThickness; // mm
    const b = 1000; // mm (1m width)
    
    // Plywood properties (typical B-B grade)
    let Fb: number, Fs: number, E: number;
    if (grain === 'face-parallel') {
      Fb = 9.65; // MPa (bending stress across grain)
      Fs = 0.69; // MPa (rolling shear)
      E = 8270; // MPa
    } else {
      Fb = 6.55;
      Fs = 0.60;
      E = 4140;
    }
    
    // Section properties
    const I = b * Math.pow(t, 3) / 12; // mm⁴
    const S = b * Math.pow(t, 2) / 6; // mm³
    const Ib_Q = t / 1.5; // mm (for shear)
    
    // Load per unit length
    const w = p * b; // N/mm
    
    // Bending moment (simply supported)
    const M = w * Math.pow(L, 2) / 8; // N·mm
    const fb = M / S; // MPa
    
    // Shear
    const V = w * L / 2; // N
    const fs = 1.5 * V / (b * t); // MPa (parabolic distribution)
    
    // Deflection
    const delta = 5 * w * Math.pow(L, 4) / (384 * E * I); // mm
    const deltaAllow = L / 360;
    
    const recommendations: string[] = [];
    let adequate = true;
    
    if (fb > Fb) {
      recommendations.push('Reduce stud spacing or increase plywood thickness');
      adequate = false;
    }
    if (fs > Fs) {
      recommendations.push('Rolling shear critical - use thicker plywood');
      adequate = false;
    }
    if (delta > deltaAllow) {
      recommendations.push('Deflection exceeds L/360 - reduce span');
      adequate = false;
    }

    return {
      bendingStress: fb,
      shearStress: fs,
      deflection: delta,
      allowable: { bending: Fb, shear: Fs, deflection: deltaAllow },
      adequate,
      recommendations
    };
  }

  /**
   * Design timber studs
   */
  static studDesign(
    load: number, // kN/m (from sheathing)
    studSpacing: number, // mm
    studSpan: number, // mm (between walers)
    studSize: { width: number; depth: number } // mm
  ): {
    bendingStress: number; // MPa
    allowableBending: number; // MPa
    deflection: number; // mm
    adequate: boolean;
  } {
    const w = load * studSpacing / 1000; // kN/m per stud
    const L = studSpan / 1000; // m
    const b = studSize.width;
    const d = studSize.depth;
    
    // Section modulus
    const S = b * d * d / 6; // mm³
    const I = b * Math.pow(d, 3) / 12; // mm⁴
    const E = 9500; // MPa (typical timber)
    const Fb = 8.5; // MPa (allowable bending, sawn timber)
    
    // Bending moment
    const M = w * L * L / 8 * 1e6; // N·mm
    const fb = M / S;
    
    // Deflection
    const delta = 5 * w * 1000 * Math.pow(L * 1000, 3) / (384 * E * I); // mm

    return {
      bendingStress: fb,
      allowableBending: Fb,
      deflection: delta,
      adequate: fb <= Fb && delta <= L * 1000 / 360
    };
  }

  /**
   * Design form ties
   */
  static tieDesign(
    pressure: number, // kN/m²
    tieSpacing: { h: number; v: number }, // mm
    tieCapacity: number // kN (working load)
  ): {
    tributaryArea: number; // mm²
    tieForce: number; // kN
    utilization: number;
    adequate: boolean;
    safetyFactor: number;
  } {
    const A = tieSpacing.h * tieSpacing.v; // mm²
    const F = pressure * A / 1e6; // kN
    const utilization = F / tieCapacity;
    
    return {
      tributaryArea: A,
      tieForce: F,
      utilization,
      adequate: utilization <= 1.0,
      safetyFactor: 1 / utilization
    };
  }
}

// ============================================================================
// SHORING AND RESHORING
// ============================================================================

export class ShoringDesign {
  /**
   * Calculate shore loads for slab formwork
   */
  static slabShoreLoads(
    slabThickness: number, // m
    shoreSpacing: { x: number; y: number }, // m
    concreteDensity: number = 2400, // kg/m³
    formworkWeight: number = 0.5, // kN/m²
    liveLoad: number = 2.5, // kN/m² (construction)
    impactFactor: number = 1.25
  ): {
    deadLoad: number; // kN/m²
    liveLoad: number; // kN/m²
    totalLoad: number; // kN/m²
    loadPerShore: number; // kN
  } {
    const concreteWeight = slabThickness * concreteDensity / 1000 * 9.81; // kN/m²
    const DL = concreteWeight + formworkWeight;
    const LL = liveLoad;
    const total = DL + LL * impactFactor;
    const tributaryArea = shoreSpacing.x * shoreSpacing.y;
    
    return {
      deadLoad: DL,
      liveLoad: LL,
      totalLoad: total,
      loadPerShore: total * tributaryArea
    };
  }

  /**
   * Design individual shore (prop)
   */
  static shoreCapacity(
    type: 'steel-prop' | 'timber-4x4' | 'timber-6x6' | 'aluminum',
    height: number, // m
    extension: number = 0 // m (beyond closed length)
  ): {
    capacity: number; // kN (allowable)
    bucklingLoad: number; // kN
    extensionReduction: number;
    recommendations: string[];
  } {
    // Typical capacities
    const baseCapacity: Record<string, { cap: number; ext: number }> = {
      'steel-prop': { cap: 30, ext: 0.02 }, // 30 kN, 2% reduction per 100mm extension
      'timber-4x4': { cap: 15, ext: 0.03 },
      'timber-6x6': { cap: 35, ext: 0.02 },
      'aluminum': { cap: 25, ext: 0.02 }
    };
    
    const props = baseCapacity[type] || baseCapacity['steel-prop'];
    const extReduction = 1 - props.ext * extension / 0.1;
    const capacity = props.cap * Math.max(0.5, extReduction);
    
    // Buckling capacity (Euler)
    const E = type.includes('timber') ? 9500 : 200000; // MPa
    const r = type.includes('6x6') ? 43 : 29; // mm (radius of gyration)
    const Le = height * 1000 * 1.0; // mm (effective length, fixed-pinned)
    const A = type.includes('6x6') ? 22500 : 10000; // mm²
    
    const Pcr = Math.PI * Math.PI * E * A * r * r / (Le * Le) / 1000; // kN
    
    const recommendations: string[] = [];
    if (extension > height * 0.3) {
      recommendations.push('Extension > 30% of height - consider higher capacity shore');
    }
    if (height > 4) {
      recommendations.push('Height > 4m - provide intermediate bracing');
    }

    return {
      capacity,
      bucklingLoad: Pcr,
      extensionReduction: extReduction,
      recommendations
    };
  }

  /**
   * Reshoring analysis per ACI 347
   */
  static reshoringAnalysis(
    slabThickness: number, // m
    shoreSpacing: { x: number; y: number }, // m
    numberOfLevels: number, // levels below being cast
    slabStrength: number[], // % of fc28 for each level
    fc28: number // MPa
  ): {
    loads: {
      level: number;
      shoreLoad: number; // kN per shore
      slabLoad: number; // kN/m²
      slabCapacity: number; // kN/m²
      adequate: boolean;
    }[];
    maxShoreLoad: number; // kN
    recommendations: string[];
  } {
    const W = slabThickness * 24; // kN/m² (concrete weight)
    const tributaryArea = shoreSpacing.x * shoreSpacing.y;
    
    const loads: {
      level: number;
      shoreLoad: number;
      slabLoad: number;
      slabCapacity: number;
      adequate: boolean;
    }[] = [];
    
    const recommendations: string[] = [];
    
    // Simplified load distribution
    // Load splits between shores and slab based on relative stiffness
    for (let i = 0; i < numberOfLevels; i++) {
      const strengthRatio = (slabStrength[i] || 70) / 100;
      const stiffnessRatio = Math.pow(strengthRatio, 0.5); // Approximate
      
      // Shore takes load inversely proportional to slab stiffness
      const shoreLoadFraction = 1 - stiffnessRatio * 0.7;
      const shoreLoad = W * tributaryArea * shoreLoadFraction * (numberOfLevels - i) / numberOfLevels;
      
      const slabLoad = W * (1 - shoreLoadFraction);
      const slabCapacity = W * strengthRatio * 0.75; // 75% of capacity for safety
      
      loads.push({
        level: i + 1,
        shoreLoad,
        slabLoad,
        slabCapacity,
        adequate: slabLoad <= slabCapacity
      });
      
      if (slabLoad > slabCapacity) {
        recommendations.push(`Level ${i + 1} slab may be overstressed - delay stripping`);
      }
    }
    
    const maxShoreLoad = Math.max(...loads.map(l => l.shoreLoad));
    
    if (numberOfLevels > 3) {
      recommendations.push('Consider limiting to 3 levels of reshoring');
    }

    return {
      loads,
      maxShoreLoad,
      recommendations
    };
  }
}

// ============================================================================
// FALSEWORK FOR BRIDGES
// ============================================================================

export class BridgeFalsework {
  /**
   * Design falsework tower loads
   */
  static towerLoads(
    superstructure: {
      width: number; // m
      depth: number; // m
      span: number; // m
      concreteWeight: number; // kN/m
    },
    towerSpacing: number, // m
    constructionMethod: 'cast-in-place' | 'precast' | 'incremental-launch'
  ): {
    deadLoad: number; // kN per tower
    constructionLoad: number; // kN per tower
    windLoad: number; // kN (lateral)
    totalVertical: number; // kN
    totalHorizontal: number; // kN
  } {
    // Vertical loads
    const DL = superstructure.concreteWeight * towerSpacing;
    const formworkDL = 0.5 * superstructure.width * towerSpacing; // kN
    
    // Construction loads
    let construction: number;
    switch (constructionMethod) {
      case 'cast-in-place':
        construction = 2.5 * superstructure.width * towerSpacing; // kN
        break;
      case 'precast':
        construction = 1.5 * superstructure.width * towerSpacing;
        break;
      case 'incremental-launch':
        construction = 5.0 * superstructure.width * towerSpacing;
        break;
      default:
        construction = 2.5 * superstructure.width * towerSpacing;
    }
    
    // Wind load (simplified)
    const area = superstructure.depth * towerSpacing;
    const windPressure = 1.0; // kN/m² (temporary works)
    const wind = windPressure * area;

    return {
      deadLoad: DL + formworkDL,
      constructionLoad: construction,
      windLoad: wind,
      totalVertical: DL + formworkDL + construction,
      totalHorizontal: wind
    };
  }

  /**
   * Design falsework bracing
   */
  static bracingDesign(
    towerHeight: number, // m
    towerWidth: number, // m (base width)
    horizontalForce: number, // kN
    verticalLoad: number // kN
  ): {
    diagonalForce: number; // kN
    recommendedBrace: string;
    numberOfBracePanels: number;
    swayCritical: boolean;
  } {
    // P-delta effect
    const sway = horizontalForce * towerHeight / (verticalLoad * 0.1 * towerHeight);
    const swayCritical = sway > 0.1;
    
    // Diagonal force in cross-bracing
    const panelHeight = 2.0; // m (typical)
    const numberOfPanels = Math.ceil(towerHeight / panelHeight);
    const diagonalLength = Math.sqrt(towerWidth * towerWidth + panelHeight * panelHeight);
    
    // Horizontal force distribution
    const forcePerPanel = horizontalForce / numberOfPanels;
    const diagonalForce = forcePerPanel * diagonalLength / towerWidth;
    
    // Recommend brace size
    let recommendedBrace: string;
    if (diagonalForce < 20) {
      recommendedBrace = 'L50x50x5 or 48.3mm tube';
    } else if (diagonalForce < 50) {
      recommendedBrace = 'L75x75x6 or 60.3mm tube';
    } else {
      recommendedBrace = 'L100x100x8 or 76.1mm tube';
    }

    return {
      diagonalForce,
      recommendedBrace,
      numberOfBracePanels: numberOfPanels,
      swayCritical
    };
  }
}

// ============================================================================
// STRIPPING AND CURING
// ============================================================================

export class StrippingRequirements {
  /**
   * Minimum stripping times per ACI 347/318
   */
  static minimumStrippingTime(
    element: StrippingTime['element'],
    cementType: ConcreteProperties['cementType'],
    temperature: number, // °C (average)
    spanToDepthRatio?: number
  ): StrippingTime {
    // Base times for Type I cement at 20°C
    const baseTimes: Record<string, { days: number; strength: number }> = {
      'wall': { days: 1, strength: 0 },
      'column': { days: 1, strength: 0 },
      'beam-side': { days: 1, strength: 0 },
      'slab-soffit': { days: 7, strength: 50 },
      'beam-soffit': { days: 14, strength: 70 },
      'slab-props': { days: 21, strength: 75 }
    };
    
    const base = baseTimes[element] || { days: 7, strength: 50 };
    
    // Cement type factor
    const cementFactor: Record<string, number> = {
      'Type-I': 1.0,
      'Type-II': 1.2,
      'Type-III': 0.7,
      'rapid-hardening': 0.5
    };
    
    // Temperature factor (Nurse-Saul maturity concept)
    const tempFactor = temperature < 20 ? 20 / Math.max(5, temperature) : 1.0;
    
    const days = Math.ceil(base.days * (cementFactor[cementType] || 1.0) * tempFactor);

    return {
      element,
      minimumDays: days,
      strengthRequired: base.strength,
      conditions: `At ${temperature}°C with ${cementType} cement`,
      code: 'ACI 347'
    };
  }

  /**
   * Strength-based stripping criteria per BS EN 13670
   */
  static strengthBasedStripping(
    element: 'slab' | 'beam' | 'cantilever',
    fc28: number, // MPa
    spanToDepthRatio: number
  ): {
    requiredStrength: number; // MPa
    percentageOf28Day: number;
    note: string;
  } {
    // EN 13670 Table 7
    let percentage: number;
    
    if (element === 'cantilever') {
      percentage = 100; // Full strength for cantilevers
    } else if (element === 'beam' || (element === 'slab' && spanToDepthRatio > 20)) {
      if (spanToDepthRatio > 30) {
        percentage = 90;
      } else if (spanToDepthRatio > 20) {
        percentage = 80;
      } else {
        percentage = 70;
      }
    } else {
      percentage = 50;
    }
    
    return {
      requiredStrength: fc28 * percentage / 100,
      percentageOf28Day: percentage,
      note: `Based on L/d ratio of ${spanToDepthRatio}`
    };
  }
}

// ============================================================================
// SCAFFOLD DESIGN
// ============================================================================

export class ScaffoldDesign {
  /**
   * Standard duty classification
   */
  static dutyClassification(
    use: 'inspection' | 'light-duty' | 'general-purpose' | 'heavy-duty' | 'special-duty'
  ): {
    uniformLoad: number; // kN/m²
    concentratedLoad: number; // kN
    maxBayLength: number; // m
    maxLiftHeight: number; // m
  } {
    const classifications: Record<string, { uniform: number; conc: number; bay: number; lift: number }> = {
      'inspection': { uniform: 0.75, conc: 1.0, bay: 2.4, lift: 2.0 },
      'light-duty': { uniform: 1.5, conc: 1.5, bay: 2.4, lift: 2.0 },
      'general-purpose': { uniform: 2.0, conc: 1.5, bay: 2.1, lift: 2.0 },
      'heavy-duty': { uniform: 2.75, conc: 2.0, bay: 1.8, lift: 2.0 },
      'special-duty': { uniform: 3.75, conc: 2.0, bay: 1.5, lift: 2.0 }
    };
    
    const c = classifications[use] || classifications['general-purpose'];
    
    return {
      uniformLoad: c.uniform,
      concentratedLoad: c.conc,
      maxBayLength: c.bay,
      maxLiftHeight: c.lift
    };
  }

  /**
   * Calculate standard leg load
   */
  static legLoad(
    bayLength: number, // m
    bayWidth: number, // m
    numberOfLifts: number,
    dutyClass: 'inspection' | 'light-duty' | 'general-purpose' | 'heavy-duty' | 'special-duty'
  ): {
    loadPerLeg: number; // kN
    basePlateSize: number; // mm
    solePlateRequired: boolean;
  } {
    const duty = this.dutyClassification(dutyClass);
    
    // Platform self-weight
    const platformDL = 0.3; // kN/m² per level
    
    // Total load
    const tributaryArea = bayLength * bayWidth / 4; // per leg
    const loadPerLevel = (duty.uniformLoad + platformDL) * tributaryArea;
    const scaffoldWeight = 0.15 * numberOfLifts * bayLength; // kN per leg
    
    const totalLoad = loadPerLevel * 2 + scaffoldWeight; // Assume 2 working platforms
    
    // Base plate sizing (125 kN/m² soil bearing)
    const bearingCapacity = 125; // kN/m²
    const requiredArea = totalLoad * 1000 / bearingCapacity; // mm²
    const basePlateSize = Math.ceil(Math.sqrt(requiredArea) / 50) * 50; // Round to 50mm
    
    const solePlateRequired = totalLoad > 20 || basePlateSize > 200;

    return {
      loadPerLeg: totalLoad,
      basePlateSize: Math.max(150, basePlateSize),
      solePlateRequired
    };
  }

  /**
   * Tie requirements
   */
  static tiePattern(
    height: number, // m
    exposure: 'sheltered' | 'normal' | 'exposed'
  ): {
    horizontalSpacing: number; // m
    verticalSpacing: number; // m
    tieForcePerpendicular: number; // kN
    tieForceParallel: number; // kN
  } {
    // BS EN 12811 based
    const patterns: Record<string, { h: number; v: number }> = {
      'sheltered': { h: 8, v: 4 },
      'normal': { h: 8, v: 4 },
      'exposed': { h: 4, v: 4 }
    };
    
    const p = patterns[exposure] || patterns['normal'];
    
    // Tie forces (simplified)
    const perpForce = exposure === 'exposed' ? 12.5 : 6.0; // kN
    const parallelForce = 3.0; // kN

    return {
      horizontalSpacing: p.h,
      verticalSpacing: p.v,
      tieForcePerpendicular: perpForce,
      tieForceParallel: parallelForce
    };
  }
}

// ============================================================================
// COMPLETE FORMWORK DESIGN
// ============================================================================

export class FormworkDesignEngine {
  /**
   * Complete wall formwork design
   */
  static designWallFormwork(
    wallHeight: number, // m
    wallThickness: number, // m
    concrete: ConcreteProperties,
    rateOfPour: number, // m/hr
    form: FormworkSection
  ): FormworkDesignResult {
    // Calculate pressure
    const pressure = ConcretePressure.wallPressureACI347(
      concrete, wallHeight, rateOfPour, 'conventional'
    );
    
    const pmax = pressure.maximumPressure;
    
    // Design sheathing
    const sheathingResult = FormworkDesign.sheathingDesign(
      pmax,
      form.studs?.spacing || 300,
      form.formThickness,
      'face-parallel'
    );
    
    // Design studs
    let studsResult;
    if (form.studs && form.walers) {
      const studLoad = pmax * form.studs.spacing / 1000; // kN/m
      studsResult = FormworkDesign.studDesign(
        studLoad,
        form.studs.spacing,
        form.walers.spacing,
        { width: 50, depth: 100 }
      );
    }
    
    // Design ties
    let tiesResult;
    if (form.ties) {
      tiesResult = FormworkDesign.tieDesign(
        pmax,
        { h: form.ties.spacing.horizontal, v: form.ties.spacing.vertical },
        form.ties.capacity
      );
    }
    
    const recommendations: string[] = [];
    if (!sheathingResult.adequate) {
      recommendations.push(...sheathingResult.recommendations);
    }
    if (studsResult && !studsResult.adequate) {
      recommendations.push('Reduce stud spacing or increase stud size');
    }
    if (tiesResult && !tiesResult.adequate) {
      recommendations.push('Reduce tie spacing or use higher capacity ties');
    }

    return {
      code: 'ACI 347',
      designPressure: pmax,
      loadCombination: pressure.method,
      sheathing: {
        stress: sheathingResult.bendingStress,
        deflection: sheathingResult.deflection,
        adequate: sheathingResult.adequate
      },
      studs: studsResult ? {
        bendingStress: studsResult.bendingStress,
        deflection: studsResult.deflection,
        spacing: form.studs!.spacing,
        adequate: studsResult.adequate
      } : undefined,
      ties: tiesResult ? {
        force: tiesResult.tieForce,
        utilization: tiesResult.utilization,
        adequate: tiesResult.adequate
      } : undefined,
      recommendations
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ConcretePressure,
  FormworkDesign,
  ShoringDesign,
  BridgeFalsework,
  StrippingRequirements,
  ScaffoldDesign,
  FormworkDesignEngine
};
