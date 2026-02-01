/**
 * ============================================================================
 * STRUCTURAL REPAIR AND REHABILITATION ENGINE
 * ============================================================================
 * 
 * Comprehensive structural assessment and strengthening:
 * - Condition assessment
 * - Section loss evaluation
 * - FRP strengthening design
 * - Steel plate bonding
 * - Concrete jacketing
 * - Post-tensioning retrofit
 * - Corrosion damage assessment
 * - Load rating of existing structures
 * 
 * Design Codes Supported:
 * - ACI 440.2R (FRP Strengthening)
 * - ACI 562 (Repair of Concrete Structures)
 * - ACI 364.1R (Guide for Evaluation)
 * - fib Bulletin 14 (FRP for RC Structures)
 * - TR55 (Design Guidance for FRP)
 * - AASHTO MBE (Manual for Bridge Evaluation)
 * - EN 1504 (Repair of Concrete Structures)
 * - IS 15988 (Seismic Evaluation and Strengthening)
 * - FEMA 356/ASCE 41 (Seismic Rehabilitation)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ExistingStructure {
  type: 'beam' | 'column' | 'slab' | 'wall' | 'foundation';
  material: 'reinforced-concrete' | 'prestressed-concrete' | 'steel' | 'masonry';
  age: number; // years
  
  // Geometry
  dimensions: {
    width: number; // mm
    height: number; // mm (or depth)
    length?: number; // mm (span)
  };
  
  // Original design
  originalDesign: {
    fc?: number; // MPa (concrete)
    fy?: number; // MPa (steel)
    fpu?: number; // MPa (prestressing)
    reinforcement?: {
      tension: { bars: string; area: number }; // mm²
      compression?: { bars: string; area: number };
      shear?: { spacing: number; legArea: number }; // mm, mm²
    };
    steelSection?: string; // for steel members
  };
  
  // Current condition
  condition: {
    rating: 1 | 2 | 3 | 4 | 5; // 1=critical, 5=good
    observations: string[];
    sectionLoss?: number; // % (for steel or reinforcement)
    spalling?: { depth: number; area: number }; // mm, % of surface
    cracking?: { maxWidth: number; pattern: string }; // mm
    corrosion?: { extent: number; severity: 'light' | 'moderate' | 'severe' };
    deflection?: number; // mm (excessive)
  };
}

export interface StrengtheningRequirement {
  type: 'flexure' | 'shear' | 'axial' | 'confinement' | 'combined';
  requiredCapacity: {
    moment?: number; // kN·m
    shear?: number; // kN
    axial?: number; // kN
  };
  existingCapacity: {
    moment?: number; // kN·m
    shear?: number; // kN
    axial?: number; // kN
  };
  deficit: number; // % (required increase)
}

export interface FRPProperties {
  type: 'CFRP' | 'GFRP' | 'AFRP' | 'BFRP';
  form: 'sheet' | 'laminate' | 'bar' | 'grid';
  manufacturer?: string;
  
  // Mechanical properties
  tensileStrength: number; // MPa (guaranteed design value)
  elasticModulus: number; // MPa
  ultimateStrain: number; // (rupture strain)
  thickness: number; // mm (per layer)
  width: number; // mm (for laminates)
  
  // Environmental reduction factors
  exposureCondition: 'interior' | 'exterior' | 'aggressive';
}

export interface FRPStrengtheningResult {
  code: string;
  
  // Flexural strengthening
  flexure?: {
    numberOfLayers: number;
    width: number; // mm
    length: number; // mm
    momentCapacity: number; // kN·m
    strainInFRP: number;
    failureMode: 'FRP-rupture' | 'concrete-crushing' | 'debonding';
    anchorage: string;
  };
  
  // Shear strengthening
  shear?: {
    configuration: 'U-wrap' | 'full-wrap' | 'side-bonded';
    numberOfLayers: number;
    width: number; // mm (strip width)
    spacing: number; // mm (for strips)
    shearCapacity: number; // kN
    anchorage?: string;
  };
  
  // Confinement
  confinement?: {
    numberOfLayers: number;
    confinementPressure: number; // MPa
    strengthIncrease: number; // %
    ductilityIncrease: number;
  };
  
  // Checks
  stressLimits: {
    serviceStress: number; // MPa
    allowableStress: number; // MPa
    adequate: boolean;
  };
  
  debondingCheck: {
    bondStress: number; // MPa
    bondStrength: number; // MPa
    adequate: boolean;
  };
  
  fireRating?: string;
  recommendations: string[];
}

export interface ConcreteJacketingResult {
  jacketThickness: number; // mm
  newDimensions: { width: number; height: number };
  reinforcement: {
    longitudinal: string;
    transverse: string;
  };
  capacityIncrease: {
    moment: number; // %
    shear: number; // %
    axial: number; // %
  };
  interfaceBond: string;
  recommendations: string[];
}

export interface SteelPlatingResult {
  plateThickness: number; // mm
  plateWidth: number; // mm
  plateLength: number; // mm
  boltPattern: {
    diameter: number; // mm
    spacing: number; // mm
    rows: number;
  };
  adhesive?: string;
  capacityIncrease: number; // %
  recommendations: string[];
}

export interface LoadRatingResult {
  code: string;
  
  ratingFactors: {
    inventory: number;
    operating: number;
  };
  
  controllingSection: string;
  controllingAction: 'flexure' | 'shear' | 'fatigue';
  
  permittedLoad: {
    legal: number; // tonnes
    permit: number; // tonnes
    emergency: number; // tonnes
  };
  
  postingRequired: boolean;
  recommendations: string[];
}

// ============================================================================
// CONDITION ASSESSMENT
// ============================================================================

export class ConditionAssessment {
  /**
   * Calculate effective section properties with section loss
   */
  static effectiveSection(
    original: {
      width: number; // mm
      height: number; // mm
      As: number; // mm² (tension reinforcement)
      Asc?: number; // mm² (compression reinforcement)
    },
    sectionLoss: {
      rebarLoss: number; // % (reinforcement loss)
      coverLoss: number; // mm (spalling depth)
    }
  ): {
    effectiveAs: number; // mm²
    effectiveAsc: number; // mm²
    effectiveDepth: number; // mm
    effectiveWidth: number; // mm
    capacityReduction: number; // %
  } {
    const effectiveAs = original.As * (1 - sectionLoss.rebarLoss / 100);
    const effectiveAsc = (original.Asc || 0) * (1 - sectionLoss.rebarLoss / 100);
    const effectiveDepth = original.height - sectionLoss.coverLoss;
    const effectiveWidth = original.width - 2 * Math.min(sectionLoss.coverLoss, 30);
    
    // Approximate capacity reduction
    const capacityReduction = sectionLoss.rebarLoss + sectionLoss.coverLoss / original.height * 50;

    return {
      effectiveAs,
      effectiveAsc,
      effectiveDepth,
      effectiveWidth,
      capacityReduction: Math.min(capacityReduction, 75)
    };
  }

  /**
   * Corrosion damage assessment
   */
  static corrosionAssessment(
    chlorideContent: number, // % by weight of cement
    carbonationDepth: number, // mm
    coverDepth: number, // mm
    age: number // years
  ): {
    corrosionState: 'passive' | 'initiation' | 'propagation';
    remainingLife: number; // years (estimate)
    sectionLossRate: number; // mm/year
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    
    // Chloride threshold (typically 0.2-0.4% by weight of cement)
    const chlorideThreshold = 0.3;
    
    // Carbonation reaching reinforcement
    const carbonationReached = carbonationDepth >= coverDepth;
    const chlorideReached = chlorideContent >= chlorideThreshold;
    
    let corrosionState: 'passive' | 'initiation' | 'propagation';
    let sectionLossRate = 0;
    let remainingLife = 50;
    
    if (!carbonationReached && !chlorideReached) {
      corrosionState = 'passive';
      remainingLife = Math.max(0, (coverDepth - carbonationDepth) / (carbonationDepth / age) - age);
    } else if (chlorideReached) {
      corrosionState = 'propagation';
      sectionLossRate = 0.1; // mm/year (severe)
      remainingLife = Math.min(20, (coverDepth * 0.3) / sectionLossRate);
      recommendations.push('Chloride-induced corrosion - repair urgently');
      recommendations.push('Consider cathodic protection');
    } else {
      corrosionState = 'initiation';
      sectionLossRate = 0.02; // mm/year (carbonation)
      remainingLife = Math.min(30, 10 / sectionLossRate);
      recommendations.push('Apply protective coating');
    }
    
    if (sectionLossRate > 0.05) {
      recommendations.push('High corrosion rate - structural assessment needed');
    }

    return {
      corrosionState,
      remainingLife: Math.max(0, remainingLife),
      sectionLossRate,
      recommendations
    };
  }

  /**
   * Crack width assessment per EN 1992
   */
  static crackAssessment(
    crackWidth: number, // mm
    exposureClass: 'XC1' | 'XC2' | 'XC3' | 'XC4' | 'XD1' | 'XD2' | 'XS1' | 'XS2' | 'XS3',
    elementType: 'beam' | 'column' | 'slab' | 'wall'
  ): {
    severity: 'acceptable' | 'moderate' | 'severe' | 'critical';
    allowableWidth: number; // mm
    possibleCauses: string[];
    recommendations: string[];
  } {
    // Allowable crack widths per EN 1992-1-1
    const allowableWidths: Record<string, number> = {
      'XC1': 0.4,
      'XC2': 0.3,
      'XC3': 0.3,
      'XC4': 0.3,
      'XD1': 0.3,
      'XD2': 0.3,
      'XS1': 0.3,
      'XS2': 0.3,
      'XS3': 0.2
    };
    
    const allowable = allowableWidths[exposureClass] || 0.3;
    
    let severity: 'acceptable' | 'moderate' | 'severe' | 'critical';
    if (crackWidth <= allowable) {
      severity = 'acceptable';
    } else if (crackWidth <= 2 * allowable) {
      severity = 'moderate';
    } else if (crackWidth <= 5 * allowable) {
      severity = 'severe';
    } else {
      severity = 'critical';
    }
    
    const possibleCauses: string[] = [];
    const recommendations: string[] = [];
    
    if (crackWidth > 0.3) {
      possibleCauses.push('Overloading');
      possibleCauses.push('Insufficient reinforcement');
    }
    if (crackWidth > 0.5) {
      possibleCauses.push('Structural distress');
      possibleCauses.push('Settlement');
      recommendations.push('Conduct detailed structural investigation');
    }
    if (crackWidth > 1.0) {
      possibleCauses.push('Possible failure mechanism');
      recommendations.push('Reduce load immediately');
      recommendations.push('Install temporary support');
    }
    
    if (severity !== 'acceptable') {
      recommendations.push('Inject cracks with epoxy');
      recommendations.push('Monitor crack progression');
    }

    return {
      severity,
      allowableWidth: allowable,
      possibleCauses,
      recommendations
    };
  }
}

// ============================================================================
// FRP STRENGTHENING DESIGN
// ============================================================================

export class FRPStrengthening {
  /**
   * Material properties with environmental reduction
   */
  static designProperties(
    frp: FRPProperties
  ): {
    ffu: number; // MPa (design tensile strength)
    Ef: number; // MPa (modulus)
    epsilonFu: number; // design rupture strain
    CE: number; // environmental reduction factor
  } {
    // Environmental reduction factor per ACI 440.2R
    const CE_factors: Record<string, Record<string, number>> = {
      'CFRP': { 'interior': 0.95, 'exterior': 0.85, 'aggressive': 0.85 },
      'GFRP': { 'interior': 0.75, 'exterior': 0.65, 'aggressive': 0.50 },
      'AFRP': { 'interior': 0.85, 'exterior': 0.75, 'aggressive': 0.70 },
      'BFRP': { 'interior': 0.80, 'exterior': 0.70, 'aggressive': 0.60 }
    };
    
    const CE = CE_factors[frp.type]?.[frp.exposureCondition] || 0.85;
    
    return {
      ffu: frp.tensileStrength * CE,
      Ef: frp.elasticModulus,
      epsilonFu: frp.ultimateStrain * CE,
      CE
    };
  }

  /**
   * Flexural strengthening design per ACI 440.2R
   */
  static flexuralStrengthening(
    beam: {
      b: number; // mm (width)
      h: number; // mm (height)
      d: number; // mm (effective depth)
      As: number; // mm² (existing tension reinforcement)
      fc: number; // MPa (concrete strength)
      fy: number; // MPa (steel yield)
      Mn_existing: number; // kN·m (existing moment capacity)
    },
    Mu_required: number, // kN·m (required capacity)
    frp: FRPProperties,
    serviceLoad: { Mservice: number } // kN·m
  ): FRPStrengtheningResult {
    const props = this.designProperties(frp);
    const recommendations: string[] = [];
    
    const { b, h, d, As, fc, fy, Mn_existing } = beam;
    const phi = 0.85; // Strength reduction factor
    
    // Required additional moment
    const Mn_required = Mu_required / phi;
    const deltaMn = Mn_required - Mn_existing;
    
    if (deltaMn <= 0) {
      return {
        code: 'ACI 440.2R',
        flexure: {
          numberOfLayers: 0,
          width: 0,
          length: 0,
          momentCapacity: Mn_existing,
          strainInFRP: 0,
          failureMode: 'FRP-rupture',
          anchorage: 'None required'
        },
        stressLimits: { serviceStress: 0, allowableStress: props.ffu * 0.55, adequate: true },
        debondingCheck: { bondStress: 0, bondStrength: 0.41 * Math.sqrt(fc), adequate: true },
        recommendations: ['Existing capacity is adequate']
      };
    }
    
    // Initial FRP area estimate
    const df = h; // FRP at bottom face
    const leverArm = d - 0.1 * d; // Approximate
    const Af_est = deltaMn * 1e6 / (props.ffu * leverArm);
    
    // Width and number of layers
    const wf = Math.min(b - 50, frp.width || (b - 50));
    const tf = frp.thickness;
    const nLayers = Math.ceil(Af_est / (wf * tf));
    const Af = nLayers * wf * tf;
    
    // Debonding strain limit per ACI 440.2R Equation 10-2
    const epsilonFd = 0.083 * Math.sqrt(fc / (nLayers * tf * props.Ef));
    const epsilonFe = Math.min(epsilonFd, 0.9 * props.epsilonFu);
    
    // Strain compatibility analysis
    // Assuming concrete strain at failure = 0.003
    const epsilonCu = 0.003;
    const rho = As / (b * d);
    const rhoF = Af / (b * d);
    
    // Simplified neutral axis depth
    const beta1 = fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * (fc - 28) / 7);
    const c = (As * fy + Af * epsilonFe * props.Ef) / (0.85 * fc * beta1 * b);
    
    // Verify strains
    const epsilonS = epsilonCu * (d - c) / c;
    const epsilonF = epsilonCu * (df - c) / c;
    
    // Moment capacity
    const a = beta1 * c;
    const Mn = As * fy * (d - a / 2) / 1e6 + Af * props.Ef * epsilonFe * (df - a / 2) / 1e6;
    
    // Failure mode
    let failureMode: 'FRP-rupture' | 'concrete-crushing' | 'debonding';
    if (epsilonF >= props.epsilonFu) {
      failureMode = 'FRP-rupture';
    } else if (epsilonFe >= epsilonFd) {
      failureMode = 'debonding';
    } else {
      failureMode = 'concrete-crushing';
    }
    
    // Development length
    const Le = 23300 / Math.pow(nLayers * tf * props.Ef, 0.58); // mm
    const developmentLength = 2 * Le;
    
    // Service stress check
    const fss = serviceLoad.Mservice * 1e6 * (df - c) / (Af * (d - c));
    const allowableService = props.ffu * 0.55;
    
    // Debonding check
    const bondStress = (As * fy - 0.85 * fc * a * b) / (b * Le * 1e-3) / 1e3;
    const bondStrength = 0.41 * Math.sqrt(fc);
    
    // Anchorage recommendations
    let anchorage = 'Standard development length';
    if (failureMode === 'debonding' || bondStress > bondStrength * 0.8) {
      anchorage = 'Mechanical anchorage recommended';
      recommendations.push('Use U-wrap anchors or anchor bolts at FRP ends');
    }
    
    if (nLayers > 3) {
      recommendations.push('Consider steel plate strengthening for thick buildup');
    }
    
    recommendations.push(`Development length = ${Math.ceil(developmentLength)} mm`);

    return {
      code: 'ACI 440.2R',
      flexure: {
        numberOfLayers: nLayers,
        width: wf,
        length: beam.b ? beam.b * 0.9 * 1000 : developmentLength * 2,
        momentCapacity: Mn,
        strainInFRP: epsilonFe,
        failureMode,
        anchorage
      },
      stressLimits: {
        serviceStress: fss,
        allowableStress: allowableService,
        adequate: fss <= allowableService
      },
      debondingCheck: {
        bondStress,
        bondStrength,
        adequate: bondStress <= bondStrength
      },
      recommendations
    };
  }

  /**
   * Shear strengthening design
   */
  static shearStrengthening(
    beam: {
      bw: number; // mm (web width)
      d: number; // mm (effective depth)
      h: number; // mm (height)
      fc: number; // MPa
      Vc: number; // kN (concrete contribution)
      Vs: number; // kN (steel shear reinforcement)
      Vn_existing: number; // kN
    },
    Vu_required: number, // kN
    frp: FRPProperties,
    configuration: 'U-wrap' | 'full-wrap' | 'side-bonded'
  ): Partial<FRPStrengtheningResult> {
    const props = this.designProperties(frp);
    const recommendations: string[] = [];
    
    const { bw, d, h, fc, Vc, Vs, Vn_existing } = beam;
    const phi = 0.75;
    
    // Required FRP shear contribution
    const Vn_required = Vu_required / phi;
    const Vf_required = Vn_required - Vc - Vs;
    
    if (Vf_required <= 0) {
      return {
        shear: {
          configuration,
          numberOfLayers: 0,
          width: 0,
          spacing: 0,
          shearCapacity: Vn_existing
        },
        recommendations: ['Existing shear capacity is adequate']
      };
    }
    
    // Effective FRP strain
    let kv: number;
    let Le: number;
    
    if (configuration === 'full-wrap') {
      // Full wrap - higher strain allowed
      Le = 23300 / Math.pow(frp.thickness * props.Ef, 0.58);
      const k1 = Math.pow(fc / 27, 2/3);
      const k2 = (d - Le) / d;
      kv = k1 * k2 * Le / (11900 * props.epsilonFu);
      kv = Math.min(0.75, kv);
    } else if (configuration === 'U-wrap') {
      Le = 23300 / Math.pow(frp.thickness * props.Ef, 0.58);
      const k1 = Math.pow(fc / 27, 2/3);
      const k2 = (d - Le) / d;
      kv = k1 * k2 * Le / (11900 * props.epsilonFu);
      kv = Math.min(0.75, kv);
    } else {
      // Side-bonded - most restrictive
      kv = 0.4;
    }
    
    const epsilonFe = kv * props.epsilonFu;
    const ffe = epsilonFe * props.Ef;
    
    // FRP area required
    // Vf = Af × ffe × (sin α + cos α) × df / sf
    // For vertical strips at 90°: Vf = Af × ffe × df / sf
    const df = d; // Effective depth of FRP
    
    // Use continuous sheet (sf = wf)
    const psiF = 0.85; // Additional reduction
    const Af_required = Vf_required * 1000 / (psiF * ffe * df);
    
    // Number of layers
    const nLayers = Math.ceil(Af_required / (2 * frp.thickness * df));
    const Af = nLayers * 2 * frp.thickness * df; // Two sides
    
    // Actual capacity
    const Vf = psiF * Af * ffe * df / 1000;
    
    // Configuration-specific recommendations
    if (configuration === 'side-bonded') {
      recommendations.push('Side-bonded has lower efficiency - U-wrap preferred');
    }
    if (configuration === 'U-wrap') {
      recommendations.push('Provide FRP anchors at top of U-wrap');
    }

    return {
      shear: {
        configuration,
        numberOfLayers: nLayers,
        width: df, // Continuous
        spacing: 0, // Continuous sheet
        shearCapacity: Vf + Vc + Vs,
        anchorage: configuration === 'U-wrap' ? 'FRP anchors at top' : undefined
      },
      recommendations
    };
  }

  /**
   * Column confinement design
   */
  static confinementDesign(
    column: {
      diameter?: number; // mm (circular)
      width?: number; // mm (rectangular)
      height?: number; // mm (rectangular)
      fc: number; // MPa
      As: number; // mm² (longitudinal steel)
      fy: number; // MPa
    },
    targetDuctility: number, // ductility ratio
    frp: FRPProperties
  ): Partial<FRPStrengtheningResult> {
    const props = this.designProperties(frp);
    const recommendations: string[] = [];
    
    // Effective diameter
    let D: number;
    let ka: number; // Shape factor
    let rounding = 0;
    
    if (column.diameter) {
      D = column.diameter;
      ka = 1.0;
    } else if (column.width && column.height) {
      const b = column.width;
      const h = column.height;
      rounding = Math.min(25, b / 8, h / 8);
      D = Math.sqrt(b * b + h * h);
      // Shape factor per ACI 440.2R
      ka = ((b - 2 * rounding) + (h - 2 * rounding)) / (2 * D);
      recommendations.push(`Round corners to ${rounding}mm radius minimum`);
    } else {
      throw new Error('Column dimensions required');
    }
    
    // Confinement model (Lam and Teng)
    const fc = column.fc;
    
    // Required confinement pressure for ductility
    const fl_required = 0.08 * fc * (targetDuctility - 1);
    
    // FRP thickness for confinement
    // fl = 2 × tf × nf × Ef × εfe / D
    const epsilonFe = Math.min(0.004, 0.55 * props.epsilonFu);
    const tf_required = fl_required * D / (2 * props.Ef * epsilonFe);
    
    const nLayers = Math.ceil(tf_required / frp.thickness);
    const tf_actual = nLayers * frp.thickness;
    
    // Actual confinement pressure
    const fl_actual = 2 * tf_actual * props.Ef * epsilonFe / D * ka;
    
    // Confined concrete strength
    const fcc = fc * (1 + 3.3 * ka * fl_actual / fc);
    const strengthIncrease = (fcc / fc - 1) * 100;
    
    // Ultimate strain
    const epsilonCcu = 0.002 * (1.75 + 12 * (fl_actual / fc) * Math.pow(epsilonFe / 0.002, 0.45));
    const ductilityIncrease = epsilonCcu / 0.003;

    return {
      confinement: {
        numberOfLayers: nLayers,
        confinementPressure: fl_actual,
        strengthIncrease,
        ductilityIncrease
      },
      recommendations
    };
  }
}

// ============================================================================
// CONCRETE JACKETING
// ============================================================================

export class ConcreteJacketing {
  /**
   * Design concrete jacket for column strengthening
   */
  static columnJacket(
    existingColumn: {
      width: number; // mm
      height: number; // mm
      fc: number; // MPa
      As: number; // mm² (existing steel)
      fy: number; // MPa
      Pn_existing: number; // kN
    },
    requiredCapacity: {
      Pu: number; // kN
      Mu?: number; // kN·m
    },
    jacketMaterial: {
      fc_jacket: number; // MPa
      fy_jacket: number; // MPa
    }
  ): ConcreteJacketingResult {
    const recommendations: string[] = [];
    
    const { width, height, fc, As, fy, Pn_existing } = existingColumn;
    const { Pu, Mu } = requiredCapacity;
    const { fc_jacket, fy_jacket } = jacketMaterial;
    
    // Minimum jacket thickness
    const minThickness = Math.max(75, Math.ceil((Math.sqrt(Pu / (0.85 * fc_jacket / 1000)) - width) / 2));
    
    // Round to nearest 25mm
    const jacketThickness = Math.ceil(minThickness / 25) * 25;
    
    // New dimensions
    const newWidth = width + 2 * jacketThickness;
    const newHeight = height + 2 * jacketThickness;
    const Ag_new = newWidth * newHeight;
    
    // New steel area (minimum 1% of jacket area)
    const Ag_jacket = Ag_new - width * height;
    const As_jacket = 0.01 * Ag_jacket;
    
    // Select bars
    const barArea = 314; // 20mm bar
    const nBars = Math.ceil(As_jacket / barArea);
    const nBarsPerSide = Math.max(3, Math.ceil(nBars / 4) + 1);
    
    // Transverse reinforcement
    const tieSpacing = Math.min(jacketThickness * 2, 150, newWidth / 4);
    
    // Capacity of jacketed column (simplified)
    const Pn_new = 0.85 * fc_jacket * (Ag_new - As - As_jacket * nBarsPerSide * 4) + 
                   fy * As + fy_jacket * As_jacket * nBarsPerSide * 4;
    
    const axialIncrease = (Pn_new / 1000 / existingColumn.Pn_existing - 1) * 100;
    
    // Interface preparation
    recommendations.push('Roughen existing concrete surface to 6mm amplitude');
    recommendations.push('Drill dowels into existing column at 400mm spacing');
    recommendations.push('Use bonding agent at interface');
    
    if (fc_jacket < fc) {
      recommendations.push('Warning: Jacket concrete weaker than existing');
    }

    return {
      jacketThickness,
      newDimensions: { width: newWidth, height: newHeight },
      reinforcement: {
        longitudinal: `${nBarsPerSide * 4} - 20φ (total ${nBarsPerSide * 4 * barArea} mm²)`,
        transverse: `10φ ties @ ${tieSpacing}mm c/c`
      },
      capacityIncrease: {
        moment: axialIncrease * 0.8, // Approximate
        shear: axialIncrease * 0.5,
        axial: axialIncrease
      },
      interfaceBond: 'Roughened surface with dowels',
      recommendations
    };
  }

  /**
   * Design concrete jacket for beam strengthening
   */
  static beamJacket(
    existingBeam: {
      width: number; // mm
      height: number; // mm
      d: number; // mm
      fc: number; // MPa
      As: number; // mm²
      fy: number; // MPa
      Mn_existing: number; // kN·m
    },
    Mu_required: number, // kN·m
    jacketType: 'bottom-only' | 'three-sided' | 'full'
  ): ConcreteJacketingResult {
    const recommendations: string[] = [];
    
    const { width, height, d, fc, As, fy, Mn_existing } = existingBeam;
    
    // Additional moment required
    const deltaMn = Mu_required / 0.9 - Mn_existing;
    
    // Additional reinforcement area
    const jd = d * 0.9;
    const As_add = deltaMn * 1e6 / (fy * jd);
    
    // Jacket thickness
    let jacketThickness: number;
    let newHeight = height;
    let newWidth = width;
    
    if (jacketType === 'bottom-only') {
      jacketThickness = Math.max(75, Math.ceil(As_add / width * 0.5) + 50);
      newHeight = height + jacketThickness;
    } else if (jacketType === 'three-sided') {
      jacketThickness = 75;
      newHeight = height + jacketThickness;
      newWidth = width + 2 * jacketThickness;
    } else {
      jacketThickness = 75;
      newHeight = height + 2 * jacketThickness;
      newWidth = width + 2 * jacketThickness;
    }
    
    // Bar selection
    const barArea = 491; // 25mm
    const nBars = Math.ceil(As_add / barArea);
    
    // Shear reinforcement
    const stirrupSpacing = Math.min(150, newHeight / 4);
    
    // Interface
    recommendations.push('Roughen existing surface');
    recommendations.push('Extend new stirrups through existing beam (core drilling)');
    
    if (jacketType === 'bottom-only') {
      recommendations.push('Bottom jacket only - verify shear capacity');
    }

    return {
      jacketThickness,
      newDimensions: { width: newWidth, height: newHeight },
      reinforcement: {
        longitudinal: `${nBars} - 25φ at bottom`,
        transverse: `10φ U-stirrups @ ${stirrupSpacing}mm`
      },
      capacityIncrease: {
        moment: (deltaMn / Mn_existing) * 100,
        shear: 30, // Approximate
        axial: 0
      },
      interfaceBond: 'Roughened with shear connectors',
      recommendations
    };
  }
}

// ============================================================================
// STEEL PLATE BONDING
// ============================================================================

export class SteelPlateBonding {
  /**
   * Design steel plate strengthening for flexure
   */
  static flexuralPlate(
    beam: {
      width: number; // mm
      height: number; // mm
      d: number; // mm
      fc: number; // MPa
      As: number; // mm²
      fy: number; // MPa
      Mn_existing: number; // kN·m
      span: number; // mm
    },
    Mu_required: number, // kN·m
    plateGrade: number = 250 // MPa (yield strength)
  ): SteelPlatingResult {
    const recommendations: string[] = [];
    
    const { width, height, d, fc, As, fy, Mn_existing, span } = beam;
    
    // Additional moment required
    const deltaMn = Mu_required / 0.9 - Mn_existing;
    
    // Plate effective depth
    const dp = height; // At bottom face
    const leverArm = dp - 0.15 * d;
    
    // Required plate area
    const Ap_required = deltaMn * 1e6 / (plateGrade * leverArm);
    
    // Plate dimensions
    const plateWidth = Math.min(width - 50, 300);
    const plateThickness = Math.max(6, Math.ceil(Ap_required / plateWidth / 2) * 2);
    
    // Plate length
    const plateLength = span * 0.85;
    
    // Adhesive design (epoxy)
    const shearStress = 0.8; // MPa allowable
    const bondLength = (As * fy - 0.85 * fc * 0.1 * d * width) / (shearStress * plateWidth * 2);
    
    // Bolt design (additional mechanical connection)
    const boltDiameter = 12; // mm
    const boltShear = 25; // kN (grade 4.6 in shear)
    const totalForce = Ap_required * plateGrade * plateThickness / 1000;
    const nBolts = Math.ceil(totalForce / boltShear / 2); // 50% bolts + 50% adhesive
    const boltSpacing = Math.min(150, (plateLength - 200) / nBolts);
    
    recommendations.push('Clean and roughen concrete surface');
    recommendations.push('Use structural epoxy adhesive (e.g., Sikadur-30)');
    recommendations.push('Prime steel plate before bonding');
    recommendations.push('Apply corrosion protection to plate');

    return {
      plateThickness,
      plateWidth,
      plateLength,
      boltPattern: {
        diameter: boltDiameter,
        spacing: boltSpacing,
        rows: 2
      },
      adhesive: 'Structural epoxy, 2-4mm thickness',
      capacityIncrease: (deltaMn / Mn_existing) * 100,
      recommendations
    };
  }
}

// ============================================================================
// LOAD RATING
// ============================================================================

export class LoadRating {
  /**
   * Bridge load rating per AASHTO MBE
   */
  static bridgeRating(
    bridge: {
      type: 'beam' | 'slab' | 'truss';
      span: number; // m
      capacity: number; // kN·m (governing capacity)
      deadLoadMoment: number; // kN·m
      impactFactor: number;
      conditionFactor: number; // 0.85-1.0
      systemFactor: number; // 0.85-1.0
    },
    liveLoadMoment: number, // kN·m (from rating vehicle)
    ratingLevel: 'inventory' | 'operating'
  ): LoadRatingResult {
    const { capacity, deadLoadMoment, impactFactor, conditionFactor, systemFactor } = bridge;
    
    // LRFR load factors
    const gammaDC = 1.25; // Dead load
    const gammaLL = ratingLevel === 'inventory' ? 1.75 : 1.35;
    const gammaDW = 1.50; // Wearing surface
    
    // Resistance factor
    const phi = 1.0; // Condition already factored
    
    // Rating factor
    const C = phi * systemFactor * conditionFactor * capacity;
    const RF = (C - gammaDC * deadLoadMoment) / (gammaLL * (1 + impactFactor) * liveLoadMoment);
    
    // Also calculate operating
    const RF_operating = (C - gammaDC * deadLoadMoment) / (1.35 * (1 + impactFactor) * liveLoadMoment);
    
    // Permitted load
    const legalLimit = 40; // tonnes (typical)
    const permitLoad = RF_operating * legalLimit;
    
    const postingRequired = RF < 1.0;
    
    const recommendations: string[] = [];
    if (postingRequired) {
      recommendations.push('Load posting required');
      recommendations.push(`Maximum legal load: ${(RF * legalLimit).toFixed(1)} tonnes`);
    }
    if (RF < 0.5) {
      recommendations.push('Consider immediate strengthening');
    }
    if (bridge.conditionFactor < 0.95) {
      recommendations.push('Repair deterioration to improve rating');
    }

    return {
      code: 'AASHTO MBE',
      ratingFactors: {
        inventory: RF,
        operating: RF_operating
      },
      controllingSection: 'Midspan',
      controllingAction: 'flexure',
      permittedLoad: {
        legal: RF * legalLimit,
        permit: RF_operating * legalLimit * 1.2,
        emergency: RF_operating * legalLimit * 1.5
      },
      postingRequired,
      recommendations
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ConditionAssessment,
  FRPStrengthening,
  ConcreteJacketing,
  SteelPlateBonding,
  LoadRating
};
