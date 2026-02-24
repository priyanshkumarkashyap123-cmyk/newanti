/**
 * ============================================================================
 * CORE CALCULATION ENGINE
 * ============================================================================
 * 
 * Provides:
 * - Precision arithmetic for structural calculations
 * - Unit conversion utilities
 * - Calculation step tracking with formulas
 * - Diagram generation data
 * - Code compliance verification
 * 
 * Supports:
 * - IS Codes (Indian Standards)
 * - ASCE/AISC/ACI (American Standards)
 * - Eurocode (European Standards)
 * 
 * @version 3.0.0
 */

/**
 * Supported design codes
 */
export enum DesignCode {
  // Indian Standards
  IS_456 = 'IS_456',           // Plain and Reinforced Concrete
  IS_800 = 'IS_800',           // Steel Structures
  IS_875_1 = 'IS_875_1',       // Dead Loads
  IS_875_2 = 'IS_875_2',       // Imposed Loads
  IS_875_3 = 'IS_875_3',       // Wind Loads
  IS_1893 = 'IS_1893',         // Earthquake Resistant Design
  IS_2911 = 'IS_2911',         // Pile Foundations
  IS_13920 = 'IS_13920',       // Ductile Detailing
  IS_14458 = 'IS_14458',       // Retaining Walls
  
  // American Standards
  ACI_318 = 'ACI_318',         // Concrete
  AISC_360 = 'AISC_360',       // Steel
  ASCE_7 = 'ASCE_7',           // Loads
  
  // European Standards
  EC2 = 'EC2',                 // Eurocode 2 - Concrete
  EC3 = 'EC3',                 // Eurocode 3 - Steel
  EC7 = 'EC7',                 // Eurocode 7 - Geotechnical
  EC8 = 'EC8',                 // Eurocode 8 - Seismic
}

/**
 * Unit systems
 */
export enum UnitSystem {
  SI = 'SI',                   // kN, m, MPa
  MKS = 'MKS',                 // kg, m, kg/cm²
  FPS = 'FPS',                 // kips, ft, ksi
  METRIC = 'METRIC',           // kN, mm, N/mm²
}

/**
 * Calculation precision settings
 */
export const PRECISION = {
  FORCE: 3,           // kN or kips
  MOMENT: 3,          // kN-m or kip-ft
  STRESS: 2,          // MPa or ksi
  AREA: 4,            // mm² or in²
  LENGTH: 3,          // mm or in
  RATIO: 4,           // dimensionless
  PERCENTAGE: 2,      // %
  ANGLE: 2,           // degrees
};

/**
 * Detailed calculation step
 */
export interface CalculationStep {
  step: number;
  title: string;
  description: string;
  formula: string;
  formulaLatex?: string;
  substitution?: string;
  values: Record<string, { value: number | string; unit?: string; description?: string }>;
  result: {
    value: number | string;
    unit?: string;
    description?: string;
  };
  reference: {
    code: DesignCode;
    clause: string;
    table?: string;
    figure?: string;
    page?: string;
  };
  status?: 'OK' | 'WARNING' | 'FAIL';
  notes?: string[];
  diagram?: DiagramData;
}

/**
 * Diagram data for visualization
 */
export interface DiagramData {
  type: DiagramType;
  title: string;
  data: Record<string, any>;
  annotations?: Annotation[];
  dimensions?: Dimension[];
}

export enum DiagramType {
  CROSS_SECTION = 'CROSS_SECTION',
  ELEVATION = 'ELEVATION',
  PLAN = 'PLAN',
  STRESS_DIAGRAM = 'STRESS_DIAGRAM',
  STRAIN_DIAGRAM = 'STRAIN_DIAGRAM',
  MOMENT_DIAGRAM = 'MOMENT_DIAGRAM',
  SHEAR_DIAGRAM = 'SHEAR_DIAGRAM',
  INTERACTION_DIAGRAM = 'INTERACTION_DIAGRAM',
  FORCE_DIAGRAM = 'FORCE_DIAGRAM',
  PRESSURE_DIAGRAM = 'PRESSURE_DIAGRAM',
  REINFORCEMENT_LAYOUT = 'REINFORCEMENT_LAYOUT',
  CONNECTION_DETAIL = 'CONNECTION_DETAIL',
  LOADING_DIAGRAM = 'LOADING_DIAGRAM',
}

export interface Annotation {
  x: number;
  y: number;
  text: string;
  type: 'label' | 'dimension' | 'force' | 'stress';
}

export interface Dimension {
  start: { x: number; y: number };
  end: { x: number; y: number };
  value: number;
  unit: string;
  label?: string;
}

/**
 * Code clause reference
 */
export interface CodeClause {
  code: DesignCode;
  clause: string;
  title: string;
  requirement: string;
  formula?: string;
  limits?: Record<string, { min?: number; max?: number; unit?: string }>;
}

/**
 * Unit conversion factors
 */
export const UNIT_CONVERSIONS = {
  // Length
  m_to_mm: 1000,
  m_to_ft: 3.28084,
  ft_to_m: 0.3048,
  in_to_mm: 25.4,
  mm_to_in: 0.0393701,
  
  // Force
  kN_to_N: 1000,
  kN_to_kips: 0.224809,
  kips_to_kN: 4.44822,
  kN_to_kg: 101.972,
  
  // Stress
  MPa_to_ksi: 0.145038,
  ksi_to_MPa: 6.89476,
  MPa_to_kgcm2: 10.1972,
  kgcm2_to_MPa: 0.0980665,
  
  // Moment
  kNm_to_kipft: 0.737562,
  kipft_to_kNm: 1.35582,
  
  // Area
  mm2_to_in2: 0.00155,
  in2_to_mm2: 645.16,
  m2_to_ft2: 10.7639,
  
  // Pressure
  kPa_to_psf: 20.8854,
  psf_to_kPa: 0.0478803,
  kNm2_to_kgm2: 101.972,
};

/**
 * Round to specified precision
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Format number with unit
 */
export function formatWithUnit(value: number, unit: string, precision: number = 3): string {
  return `${roundTo(value, precision)} ${unit}`;
}

/**
 * Convert units
 */
export function convertUnit(
  value: number,
  fromUnit: string,
  toUnit: string
): number {
  const key = `${fromUnit}_to_${toUnit}` as keyof typeof UNIT_CONVERSIONS;
  const factor = UNIT_CONVERSIONS[key];
  
  if (factor) {
    return value * factor;
  }
  
  // Try reverse conversion
  const reverseKey = `${toUnit}_to_${fromUnit}` as keyof typeof UNIT_CONVERSIONS;
  const reverseFactor = UNIT_CONVERSIONS[reverseKey];
  
  if (reverseFactor) {
    return value / reverseFactor;
  }
  
  throw new Error(`No conversion factor found for ${fromUnit} to ${toUnit}`);
}

/**
 * Material properties database
 */
export const MATERIAL_PROPERTIES = {
  // Concrete grades (IS 456)
  concrete_IS: {
    M15: { fck: 15, Ec: 5000 * Math.sqrt(15) },
    M20: { fck: 20, Ec: 5000 * Math.sqrt(20) },
    M25: { fck: 25, Ec: 5000 * Math.sqrt(25) },
    M30: { fck: 30, Ec: 5000 * Math.sqrt(30) },
    M35: { fck: 35, Ec: 5000 * Math.sqrt(35) },
    M40: { fck: 40, Ec: 5000 * Math.sqrt(40) },
    M45: { fck: 45, Ec: 5000 * Math.sqrt(45) },
    M50: { fck: 50, Ec: 5000 * Math.sqrt(50) },
    M55: { fck: 55, Ec: 5000 * Math.sqrt(55) },
    M60: { fck: 60, Ec: 5000 * Math.sqrt(60) },
  },
  
  // Steel grades (IS 800 / IS 1786)
  steel_IS: {
    Fe250: { fy: 250, fu: 410, Es: 200000 },
    Fe415: { fy: 415, fu: 485, Es: 200000 },
    Fe500: { fy: 500, fu: 545, Es: 200000 },
    Fe550: { fy: 550, fu: 585, Es: 200000 },
    Fe600: { fy: 600, fu: 660, Es: 200000 },
  },
  
  // Structural steel (IS 800)
  structural_steel_IS: {
    E250: { fy: 250, fu: 410, Es: 200000 },
    E300: { fy: 300, fu: 440, Es: 200000 },
    E350: { fy: 350, fu: 490, Es: 200000 },
    E410: { fy: 410, fu: 540, Es: 200000 },
    E450: { fy: 450, fu: 570, Es: 200000 },
  },
  
  // Concrete grades (ACI 318)
  concrete_ACI: {
    '3000': { fc: 3000, Ec: 57000 * Math.sqrt(3000) },
    '4000': { fc: 4000, Ec: 57000 * Math.sqrt(4000) },
    '5000': { fc: 5000, Ec: 57000 * Math.sqrt(5000) },
    '6000': { fc: 6000, Ec: 57000 * Math.sqrt(6000) },
    '8000': { fc: 8000, Ec: 57000 * Math.sqrt(8000) },
  },
  
  // Steel grades (ASTM)
  steel_ASTM: {
    A36: { Fy: 36, Fu: 58, E: 29000 },
    A572_50: { Fy: 50, Fu: 65, E: 29000 },
    A992: { Fy: 50, Fu: 65, E: 29000 },
    A500B: { Fy: 46, Fu: 58, E: 29000 },
  },
};

/**
 * Partial safety factors
 */
export const SAFETY_FACTORS = {
  // IS 456 - Concrete
  IS_456: {
    gamma_c: 1.5,      // Concrete
    gamma_s: 1.15,     // Steel
    gamma_m: 1.5,      // Material (general)
  },
  
  // IS 800 - Steel
  IS_800: {
    gamma_m0: 1.10,    // Resistance governed by yielding
    gamma_m1: 1.25,    // Resistance governed by ultimate stress
    gamma_mw: 1.25,    // Welds
    gamma_mb: 1.25,    // Bolts - friction type
    gamma_mb_bearing: 1.25, // Bolts - bearing type
  },
  
  // IS 1893 - Seismic
  IS_1893: {
    importance_factor: {
      critical: 1.5,
      important: 1.2,
      ordinary: 1.0,
    },
    response_reduction: {
      SMRF: 5.0,
      OMRF: 3.0,
      braced_frame: 4.0,
      shear_wall: 4.0,
    },
  },
  
  // ACI 318
  ACI_318: {
    phi_flexure: 0.90,
    phi_shear: 0.75,
    phi_compression: 0.65,
    phi_tension: 0.90,
  },
  
  // AISC 360
  AISC_360: {
    phi_b: 0.90,       // Flexure
    phi_c: 0.90,       // Compression
    phi_t: 0.90,       // Tension (yielding)
    phi_v: 1.00,       // Shear
    omega_b: 1.67,     // ASD - Flexure
    omega_c: 1.67,     // ASD - Compression
  },
};

/**
 * Validate calculation against code limits
 */
export function validateAgainstCode(
  value: number,
  limits: { min?: number; max?: number },
  tolerance: number = 0.001
): { isValid: boolean; status: 'OK' | 'WARNING' | 'FAIL'; message: string } {
  if (limits.min !== undefined && value < limits.min - tolerance) {
    return {
      isValid: false,
      status: 'FAIL',
      message: `Value ${value} is below minimum ${limits.min}`,
    };
  }
  
  if (limits.max !== undefined && value > limits.max + tolerance) {
    return {
      isValid: false,
      status: 'FAIL',
      message: `Value ${value} exceeds maximum ${limits.max}`,
    };
  }
  
  // Check if close to limits (within 5%)
  if (limits.min !== undefined && value < limits.min * 1.05) {
    return {
      isValid: true,
      status: 'WARNING',
      message: `Value ${value} is close to minimum ${limits.min}`,
    };
  }
  
  if (limits.max !== undefined && value > limits.max * 0.95) {
    return {
      isValid: true,
      status: 'WARNING',
      message: `Value ${value} is close to maximum ${limits.max}`,
    };
  }
  
  return {
    isValid: true,
    status: 'OK',
    message: 'Within limits',
  };
}

/**
 * Generate LaTeX formula
 */
export function toLatex(formula: string): string {
  return formula
    .replace(/\*/g, ' \\times ')
    .replace(/\//g, ' \\div ')
    .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
    .replace(/\^2/g, '^{2}')
    .replace(/\^3/g, '^{3}')
    .replace(/_([a-z]+)/gi, '_{$1}')
    .replace(/phi/g, '\\phi')
    .replace(/gamma/g, '\\gamma')
    .replace(/sigma/g, '\\sigma')
    .replace(/tau/g, '\\tau')
    .replace(/epsilon/g, '\\varepsilon')
    .replace(/alpha/g, '\\alpha')
    .replace(/beta/g, '\\beta')
    .replace(/delta/g, '\\delta')
    .replace(/lambda/g, '\\lambda')
    .replace(/rho/g, '\\rho')
    .replace(/>=/, '\\geq')
    .replace(/<=/, '\\leq');
}

/**
 * Create calculation step with proper formatting
 */
export function createCalculationStep(params: {
  step: number;
  title: string;
  description: string;
  formula: string;
  values: Record<string, { value: number | string; unit?: string; description?: string }>;
  result: { value: number | string; unit?: string; description?: string };
  code: DesignCode;
  clause: string;
  table?: string;
  figure?: string;
  status?: 'OK' | 'WARNING' | 'FAIL';
  notes?: string[];
  diagram?: DiagramData;
}): CalculationStep {
  // Create substitution string
  let substitution = params.formula;
  for (const [key, val] of Object.entries(params.values)) {
    const regex = new RegExp(key, 'g');
    substitution = substitution.replace(regex, String(val.value));
  }
  
  return {
    step: params.step,
    title: params.title,
    description: params.description,
    formula: params.formula,
    formulaLatex: toLatex(params.formula),
    substitution,
    values: params.values,
    result: params.result,
    reference: {
      code: params.code,
      clause: params.clause,
      table: params.table,
      figure: params.figure,
    },
    status: params.status || 'OK',
    notes: params.notes,
    diagram: params.diagram,
  };
}

/**
 * Simplified calculation step creator for IS code modules
 * Creates a lightweight step without full CalculationReport integration
 */
export interface SimpleCalculationStep {
  title: string;
  description: string;
  formula: string;
  values: Record<string, string | number>;
  reference?: string;
}

export function createSimpleStep(
  title: string,
  description: string,
  formula: string,
  values: Record<string, string | number>,
  reference?: string
): SimpleCalculationStep {
  return {
    title,
    description,
    formula,
    values,
    reference,
  };
}

/**
 * Calculation report generator
 */
export interface CalculationReport {
  title: string;
  projectInfo?: {
    projectName?: string;
    projectNumber?: string;
    client?: string;
    engineer?: string;
    checker?: string;
    date?: string;
  };
  designCode: DesignCode;
  summary: {
    description: string;
    result: 'ADEQUATE' | 'INADEQUATE' | 'CHECK_REQUIRED';
    utilizationRatio: number;
    governingCondition: string;
  };
  inputData: Record<string, { value: number | string; unit?: string; description: string }>;
  calculations: CalculationStep[];
  results: Record<string, { value: number | string; unit?: string; description: string; status: 'OK' | 'WARNING' | 'FAIL' }>;
  diagrams: DiagramData[];
  references: string[];
  assumptions: string[];
  limitations: string[];
}

export class CalculationReportBuilder {
  private report: Partial<CalculationReport> = {};
  private steps: CalculationStep[] = [];
  private diagrams: DiagramData[] = [];
  private stepCounter = 1;
  
  constructor(title: string, code: DesignCode) {
    this.report.title = title;
    this.report.designCode = code;
    this.report.calculations = [];
    this.report.diagrams = [];
    this.report.references = [];
    this.report.assumptions = [];
    this.report.limitations = [];
  }
  
  setProjectInfo(info: CalculationReport['projectInfo']): this {
    this.report.projectInfo = info;
    return this;
  }
  
  setInputData(data: CalculationReport['inputData']): this {
    this.report.inputData = data;
    return this;
  }
  
  addStep(params: Omit<Parameters<typeof createCalculationStep>[0], 'step'>): this {
    const step = createCalculationStep({
      ...params,
      step: this.stepCounter++,
    });
    this.steps.push(step);
    
    if (params.diagram) {
      this.diagrams.push(params.diagram);
    }
    
    return this;
  }
  
  addDiagram(diagram: DiagramData): this {
    this.diagrams.push(diagram);
    return this;
  }
  
  addReference(reference: string): this {
    this.report.references?.push(reference);
    return this;
  }
  
  addAssumption(assumption: string): this {
    this.report.assumptions?.push(assumption);
    return this;
  }
  
  addLimitation(limitation: string): this {
    this.report.limitations?.push(limitation);
    return this;
  }
  
  setSummary(summary: CalculationReport['summary']): this {
    this.report.summary = summary;
    return this;
  }
  
  setResults(results: CalculationReport['results']): this {
    this.report.results = results;
    return this;
  }
  
  build(): CalculationReport {
    return {
      ...this.report,
      calculations: this.steps,
      diagrams: this.diagrams,
    } as CalculationReport;
  }
}
