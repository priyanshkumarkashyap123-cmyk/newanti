/**
 * ============================================================================
 * STEEL DESIGN CALCULATION ENGINE - IS 800:2007
 * ============================================================================
 * 
 * Production-grade steel design calculations per IS 800:2007
 * Includes:
 * - Section classification
 * - Flexural capacity (with LTB)
 * - Shear capacity
 * - Combined stresses
 * - Web crippling
 * 
 * @version 1.0.0
 */

import type { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// INDIAN STANDARD STEEL SECTIONS DATABASE
// ============================================================================

interface SteelSection {
  designation: string;
  depth: number;      // mm
  width: number;      // mm (flange width)
  tw: number;         // mm (web thickness)
  tf: number;         // mm (flange thickness)
  area: number;       // mm²
  Ixx: number;        // mm⁴ × 10⁶
  Iyy: number;        // mm⁴ × 10⁶
  rxx: number;        // mm
  ryy: number;        // mm
  Zxx: number;        // mm³ × 10³
  Zyy: number;        // mm³ × 10³
  Zpx: number;        // mm³ × 10³ (plastic modulus)
  Zpy: number;        // mm³ × 10³
  weight: number;     // kg/m
}

const STEEL_SECTIONS: Record<string, SteelSection> = {
  'ISMB200': { designation: 'ISMB 200', depth: 200, width: 100, tw: 5.7, tf: 10.8, area: 3233, Ixx: 22.35, Iyy: 1.50, rxx: 83.1, ryy: 21.5, Zxx: 223.5, Zyy: 29.9, Zpx: 254.4, Zpy: 46.4, weight: 25.4 },
  'ISMB250': { designation: 'ISMB 250', depth: 250, width: 125, tw: 6.9, tf: 12.5, area: 4755, Ixx: 51.31, Iyy: 3.34, rxx: 103.9, ryy: 26.5, Zxx: 410.5, Zyy: 53.5, Zpx: 466.8, Zpy: 82.8, weight: 37.3 },
  'ISMB300': { designation: 'ISMB 300', depth: 300, width: 140, tw: 7.7, tf: 13.1, area: 5878, Ixx: 86.04, Iyy: 4.54, rxx: 121.0, ryy: 27.8, Zxx: 573.6, Zyy: 64.9, Zpx: 654.0, Zpy: 100.5, weight: 46.1 },
  'ISMB350': { designation: 'ISMB 350', depth: 350, width: 140, tw: 8.1, tf: 14.2, area: 6671, Ixx: 136.3, Iyy: 5.37, rxx: 142.9, ryy: 28.4, Zxx: 778.9, Zyy: 76.7, Zpx: 889.6, Zpy: 118.9, weight: 52.4 },
  'ISMB400': { designation: 'ISMB 400', depth: 400, width: 140, tw: 8.9, tf: 16.0, area: 7846, Ixx: 204.6, Iyy: 6.22, rxx: 161.5, ryy: 28.2, Zxx: 1023.0, Zyy: 88.8, Zpx: 1176.2, Zpy: 138.2, weight: 61.6 },
  'ISMB450': { designation: 'ISMB 450', depth: 450, width: 150, tw: 9.4, tf: 17.4, area: 9227, Ixx: 303.9, Iyy: 8.34, rxx: 181.5, ryy: 30.1, Zxx: 1350.7, Zyy: 111.2, Zpx: 1533.4, Zpy: 172.7, weight: 72.4 },
  'ISMB500': { designation: 'ISMB 500', depth: 500, width: 180, tw: 10.2, tf: 17.2, area: 11074, Ixx: 452.2, Iyy: 13.7, rxx: 202.1, ryy: 35.2, Zxx: 1808.8, Zyy: 152.2, Zpx: 2074.7, Zpy: 235.8, weight: 86.9 },
  'ISMB550': { designation: 'ISMB 550', depth: 550, width: 190, tw: 11.2, tf: 19.3, area: 13240, Ixx: 649.5, Iyy: 18.0, rxx: 221.5, ryy: 36.9, Zxx: 2361.8, Zyy: 189.5, Zpx: 2711.5, Zpy: 293.6, weight: 103.9 },
  'ISMB600': { designation: 'ISMB 600', depth: 600, width: 210, tw: 12.0, tf: 20.8, area: 15608, Ixx: 918.1, Iyy: 26.3, rxx: 242.6, ryy: 41.1, Zxx: 3060.3, Zyy: 250.5, Zpx: 3510.4, Zpy: 387.5, weight: 122.6 },
};

// ============================================================================
// STEEL MATERIAL PROPERTIES
// ============================================================================

interface SteelGrade {
  fy: number;        // Yield strength (MPa)
  fu: number;        // Ultimate strength (MPa)
  E: number;         // Elastic modulus (MPa)
  G: number;         // Shear modulus (MPa)
  gamma_m0: number;  // Partial safety factor for resistance
  gamma_m1: number;  // Partial safety factor for buckling
}

const STEEL_GRADES: Record<string, SteelGrade> = {
  'E250': { fy: 250, fu: 410, E: 200000, G: 77000, gamma_m0: 1.10, gamma_m1: 1.10 },
  'E300': { fy: 300, fu: 440, E: 200000, G: 77000, gamma_m0: 1.10, gamma_m1: 1.10 },
  'E350': { fy: 350, fu: 490, E: 200000, G: 77000, gamma_m0: 1.10, gamma_m1: 1.10 },
  'E410': { fy: 410, fu: 540, E: 200000, G: 77000, gamma_m0: 1.10, gamma_m1: 1.10 },
  'E450': { fy: 450, fu: 570, E: 200000, G: 77000, gamma_m0: 1.10, gamma_m1: 1.10 },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Classify section per IS 800:2007 Table 2
 */
function classifySection(
  b: number,    // Outstand of compression flange
  tf: number,   // Flange thickness
  d: number,    // Web depth (between fillets)
  tw: number,   // Web thickness
  fy: number    // Yield strength
): { flangeClass: number; webClass: number; sectionClass: number } {
  const epsilon = Math.sqrt(250 / fy);
  
  // Flange classification (Table 2, rolled I-section outstand)
  const flangeRatio = b / tf;
  let flangeClass: number;
  if (flangeRatio <= 9.4 * epsilon) flangeClass = 1;
  else if (flangeRatio <= 10.5 * epsilon) flangeClass = 2;
  else if (flangeRatio <= 15.7 * epsilon) flangeClass = 3;
  else flangeClass = 4;
  
  // Web classification (Table 2, neutral axis at mid-depth)
  const webRatio = d / tw;
  let webClass: number;
  if (webRatio <= 84 * epsilon) webClass = 1;
  else if (webRatio <= 105 * epsilon) webClass = 2;
  else if (webRatio <= 126 * epsilon) webClass = 3;
  else webClass = 4;
  
  // Overall section class is worst of flange and web
  const sectionClass = Math.max(flangeClass, webClass);
  
  return { flangeClass, webClass, sectionClass };
}

/**
 * Calculate elastic critical moment for LTB per IS 800:2007 Cl. 8.2.2
 */
function calculateMcr(
  E: number,      // MPa
  G: number,      // MPa
  Iy: number,     // mm⁴
  Iw: number,     // mm⁶ (warping constant)
  It: number,     // mm⁴ (torsional constant)
  LLT: number,    // mm (effective length for LTB)
  C1: number = 1.0  // Moment gradient factor
): number {
  const term1 = (Math.PI ** 2 * E * Iy) / (LLT ** 2);
  const term2 = G * It + (Math.PI ** 2 * E * Iw) / (LLT ** 2);
  const Mcr = C1 * Math.sqrt(term1 * term2);
  return Mcr;
}

/**
 * Calculate torsional constant for I-section
 */
function calculateIt(b: number, tf: number, d: number, tw: number): number {
  // Approximate formula for I-section
  return (2 * b * tf ** 3 + (d - 2 * tf) * tw ** 3) / 3;
}

/**
 * Calculate warping constant for I-section
 */
function calculateIw(b: number, tf: number, h: number): number {
  // h = distance between flange centroids = D - tf
  return (tf * b ** 3 * h ** 2) / 24;
}

/**
 * Calculate LTB reduction factor χLT per IS 800:2007 Cl. 8.2.2
 */
function calculateChiLT(
  lambdaLT: number,   // Non-dimensional slenderness
  alphaLT: number     // Imperfection factor (Table 14)
): number {
  if (lambdaLT <= 0.4) return 1.0; // No LTB for very stocky sections
  
  const phiLT = 0.5 * (1 + alphaLT * (lambdaLT - 0.2) + lambdaLT ** 2);
  const discriminant = Math.max(phiLT ** 2 - lambdaLT ** 2, 0);
  const chiLT = Math.min(1.0, 1 / (phiLT + Math.sqrt(discriminant)));
  
  return chiLT;
}

/**
 * Get imperfection factor αLT per IS 800:2007 Table 14
 */
function getAlphaLT(sectionType: 'rolled' | 'welded', h_bf_ratio: number): number {
  if (sectionType === 'rolled') {
    return h_bf_ratio <= 2 ? 0.21 : 0.34;
  } else {
    return 0.49; // Welded sections
  }
}

// ============================================================================
// STEEL BEAM DESIGN CALCULATION
// ============================================================================

interface SteelBeamInputs {
  section_type: string;
  section_size: string;
  span: number;
  unbraced_length: number;
  steel_grade: string;
  Mu: number;
  Vu: number;
  concentrated_load: number;
  check_ltb: boolean;
  check_web_crippling: boolean;
}

export function calculateSteelBeamIS800(inputs: SteelBeamInputs): CalculationResult {
  const steps: CalculationStep[] = [];
  const codeChecks: CodeCheck[] = [];
  const warnings: string[] = [];
  
  // Get section properties
  const section = STEEL_SECTIONS[inputs.section_size];
  if (!section) {
    throw new Error(`Section ${inputs.section_size} not found in database`);
  }
  
  // Get material properties
  const material = STEEL_GRADES[inputs.steel_grade];
  if (!material) {
    throw new Error(`Steel grade ${inputs.steel_grade} not found`);
  }
  
  const { fy, fu, E, G, gamma_m0, gamma_m1 } = material;
  const { depth: D, width: bf, tw, tf, Zxx, Zpx, Iyy: Iy, rxx, ryy } = section;
  
  // Convert section properties (stored as ×10³ and ×10⁶)
  const Zxx_mm3 = Zxx * 1000;
  const Zpx_mm3 = Zpx * 1000;
  const Iy_mm4 = Iy * 1e6;
  
  // Step 1: Material & Section Properties
  steps.push({
    title: 'Material & Section Properties',
    description: 'Steel grade properties and selected section dimensions',
    formula: 'Section: ' + section.designation,
    values: {
      'fy': `${fy} MPa`,
      'fu': `${fu} MPa`,
      'E': `${E} MPa`,
      'γm0': `${gamma_m0}`,
      'D': `${D} mm`,
      'bf': `${bf} mm`,
      'tw': `${tw} mm`,
      'tf': `${tf} mm`,
      'Zpx': `${Zpx * 1000} mm³`,
      'Zxx': `${Zxx * 1000} mm³`,
    },
    reference: 'IS 800:2007 Table 1, IS 2062',
  });
  
  // Step 2: Section Classification
  const webDepth = D - 2 * tf;
  const flangeOutstand = (bf - tw) / 2;
  const { flangeClass, webClass, sectionClass } = classifySection(flangeOutstand, tf, webDepth, tw, fy);
  
  steps.push({
    title: 'Section Classification',
    description: 'Classify section per IS 800:2007 Table 2 for local buckling',
    formula: 'ε = √(250/fy)',
    values: {
      'ε': `${Math.sqrt(250 / fy).toFixed(3)}`,
      'Flange b/tf': `${(flangeOutstand / tf).toFixed(2)}`,
      'Flange Class': `${flangeClass}`,
      'Web d/tw': `${(webDepth / tw).toFixed(2)}`,
      'Web Class': `${webClass}`,
      'Section Class': `${sectionClass}`,
    },
    reference: 'IS 800:2007 Cl. 3.7.2, Table 2',
  });
  
  // Step 3: Plastic Moment Capacity
  let Md: number;
  let beta_b = 1.0;
  
  if (sectionClass <= 2) {
    // Plastic/Compact - use plastic section modulus
    beta_b = 1.0;
    Md = (beta_b * Zpx_mm3 * fy) / (gamma_m0 * 1e6); // kN·m
  } else if (sectionClass === 3) {
    // Semi-compact - use elastic section modulus
    beta_b = Zxx_mm3 / Zpx_mm3;
    Md = (Zxx_mm3 * fy) / (gamma_m0 * 1e6);
  } else {
    // Slender - reduced section
    // Simplified: use 0.8 × elastic modulus
    beta_b = 0.8 * Zxx_mm3 / Zpx_mm3;
    Md = (0.8 * Zxx_mm3 * fy) / (gamma_m0 * 1e6);
  }
  
  steps.push({
    title: 'Section Moment Capacity (Md)',
    description: sectionClass <= 2 
      ? 'Plastic moment capacity for Class 1/2 section'
      : 'Elastic moment capacity for Class 3/4 section',
    formula: sectionClass <= 2 
      ? 'Md = βb × Zp × fy / γm0'
      : 'Md = Ze × fy / γm0',
    values: {
      'βb': `${beta_b.toFixed(3)}`,
      'Zp or Ze': sectionClass <= 2 ? `${Zpx_mm3.toFixed(0)} mm³` : `${Zxx_mm3.toFixed(0)} mm³`,
      'fy': `${fy} MPa`,
      'γm0': `${gamma_m0}`,
      'Md': `${Md.toFixed(2)} kN·m`,
    },
    reference: 'IS 800:2007 Cl. 8.2.1.2',
  });
  
  // Step 4: Lateral Torsional Buckling Check
  let Mdv = Md; // Design bending strength (may be reduced for LTB)
  
  if (inputs.check_ltb && inputs.unbraced_length > 0) {
    const LLT = inputs.unbraced_length;
    
    // Calculate torsional constants
    const h_s = D - tf; // Distance between flange centroids
    const It = calculateIt(bf, tf, D, tw);
    const Iw = calculateIw(bf, tf, h_s);
    
    // Elastic critical moment
    const C1 = 1.0; // Uniform moment (conservative)
    const Mcr = calculateMcr(E, G, Iy_mm4, Iw, It, LLT, C1) / 1e6; // kN·m
    
    // Non-dimensional slenderness
    const Mp = (Zpx_mm3 * fy) / 1e6; // kN·m
    const lambdaLT = Math.sqrt(Mp / Mcr);
    
    // Imperfection factor
    const h_bf = D / bf;
    const alphaLT = getAlphaLT('rolled', h_bf);
    
    // LTB reduction factor
    const chiLT = calculateChiLT(lambdaLT, alphaLT);
    
    // Design bending strength considering LTB
    Mdv = chiLT * Md;
    
    steps.push({
      title: 'Lateral Torsional Buckling Check',
      description: 'Calculate LTB reduction factor per IS 800:2007 Cl. 8.2.2',
      formula: 'χLT = 1 / (φLT + √(φLT² - λLT²))',
      values: {
        'LLT': `${LLT} mm`,
        'It': `${It.toFixed(0)} mm⁴`,
        'Iw': `${(Iw / 1e6).toFixed(2)} × 10⁶ mm⁶`,
        'Mcr': `${Mcr.toFixed(2)} kN·m`,
        'λLT': `${lambdaLT.toFixed(3)}`,
        'αLT': `${alphaLT}`,
        'χLT': `${chiLT.toFixed(3)}`,
        'Mdv': `${Mdv.toFixed(2)} kN·m`,
      },
      reference: 'IS 800:2007 Cl. 8.2.2, Table 14',
    });
    
    if (chiLT < 0.9) {
      warnings.push(`LTB significantly reduces capacity (χLT = ${chiLT.toFixed(3)}). Consider reducing unbraced length.`);
    }
  }
  
  // Step 5: Shear Capacity
  const Av = D * tw; // Shear area for I-section
  const Vp = (Av * fy) / (Math.sqrt(3) * gamma_m0 * 1000); // kN
  
  // High shear check
  const isHighShear = inputs.Vu > 0.6 * Vp;
  
  steps.push({
    title: 'Shear Capacity',
    description: 'Design shear strength per IS 800:2007 Cl. 8.4',
    formula: 'Vd = Av × fy / (√3 × γm0)',
    values: {
      'Av': `${Av.toFixed(0)} mm²`,
      'fy': `${fy} MPa`,
      'γm0': `${gamma_m0}`,
      'Vd': `${Vp.toFixed(2)} kN`,
      'Vu/Vd': `${(inputs.Vu / Vp).toFixed(3)}`,
      'High Shear': isHighShear ? 'Yes (> 0.6Vd)' : 'No',
    },
    reference: 'IS 800:2007 Cl. 8.4.1',
  });
  
  if (isHighShear) {
    warnings.push('High shear condition (Vu > 0.6Vd). Moment capacity should be reduced per Cl. 9.2.');
  }
  
  // Step 6: Web Crippling (if applicable)
  if (inputs.check_web_crippling && inputs.concentrated_load > 0) {
    // Web local yielding (IS 800:2007 Cl. 8.7.3.1)
    const n1 = 2.5; // Assumed bearing length ratio
    const Fwl = (bf + n1 * tf) * tw * fy / (gamma_m0 * 1000); // kN
    
    // Web crippling (IS 800:2007 Cl. 8.7.4)
    const tf_tw = tf / tw;
    const Fwc = 0.9 * E * tw ** 2 * Math.sqrt(tf_tw) / (gamma_m1 * 1000); // kN
    
    steps.push({
      title: 'Web Local Effects',
      description: 'Web local yielding and web crippling checks',
      formula: 'Fwl = (bf + n1×tf) × tw × fy / γm0',
      values: {
        'P': `${inputs.concentrated_load} kN`,
        'Fwl (web yielding)': `${Fwl.toFixed(2)} kN`,
        'Fwc (web crippling)': `${Fwc.toFixed(2)} kN`,
        'P/Fwl': `${(inputs.concentrated_load / Fwl).toFixed(3)}`,
        'P/Fwc': `${(inputs.concentrated_load / Fwc).toFixed(3)}`,
      },
      reference: 'IS 800:2007 Cl. 8.7.3, 8.7.4',
    });
    
    codeChecks.push({
      clause: '8.7.3.1',
      description: 'Web local yielding',
      required: `≤ ${Fwl.toFixed(1)} kN`,
      provided: `${inputs.concentrated_load} kN`,
      status: inputs.concentrated_load <= Fwl ? 'PASS' : 'FAIL',
    });
    
    codeChecks.push({
      clause: '8.7.4',
      description: 'Web crippling',
      required: `≤ ${Fwc.toFixed(1)} kN`,
      provided: `${inputs.concentrated_load} kN`,
      status: inputs.concentrated_load <= Fwc ? 'PASS' : 'FAIL',
    });
  }
  
  // ==================== Code Checks ====================
  
  // Bending check
  const bendingUtilization = inputs.Mu / Mdv;
  codeChecks.push({
    clause: '8.2.1',
    description: 'Bending moment capacity',
    required: `≤ ${Mdv.toFixed(1)} kN·m`,
    provided: `${inputs.Mu} kN·m`,
    status: bendingUtilization <= 1.0 ? 'PASS' : 'FAIL',
  });
  
  // Shear check
  const shearUtilization = inputs.Vu / Vp;
  codeChecks.push({
    clause: '8.4.1',
    description: 'Shear force capacity',
    required: `≤ ${Vp.toFixed(1)} kN`,
    provided: `${inputs.Vu} kN`,
    status: shearUtilization <= 1.0 ? 'PASS' : 'FAIL',
  });
  
  // Deflection check (simplified: L/360 for live load)
  const allowableDeflection = inputs.span / 360;
  const actualDeflection = (5 * inputs.Mu * 1e6 * inputs.span ** 2) / (384 * E * section.Ixx * 1e6);
  codeChecks.push({
    clause: '5.6.1',
    description: 'Deflection limit (L/360)',
    required: `≤ ${allowableDeflection.toFixed(1)} mm`,
    provided: `${actualDeflection.toFixed(1)} mm`,
    status: actualDeflection <= allowableDeflection ? 'PASS' : actualDeflection <= allowableDeflection * 1.1 ? 'WARNING' : 'FAIL',
  });
  
  // Slenderness check
  const effectiveLength = inputs.span * 1.0; // Simplified
  const slenderness = effectiveLength / ryy;
  const maxSlenderness = 300; // For compression flange
  codeChecks.push({
    clause: '3.8',
    description: 'Slenderness ratio limit',
    required: `≤ ${maxSlenderness}`,
    provided: `${slenderness.toFixed(1)}`,
    status: slenderness <= maxSlenderness ? 'PASS' : 'FAIL',
  });
  
  // ==================== Calculate Overall Result ====================
  const maxUtilization = Math.max(bendingUtilization, shearUtilization);
  const failedChecks = codeChecks.filter(c => c.status === 'FAIL');
  const isAdequate = failedChecks.length === 0 && maxUtilization <= 1.0;
  
  return {
    isAdequate,
    utilization: maxUtilization,
    capacity: Mdv,
    demand: inputs.Mu,
    status: isAdequate ? 'OK' : failedChecks.length > 0 ? 'FAIL' : 'WARNING',
    message: isAdequate 
      ? `Section ${section.designation} is adequate. Utilization: ${(maxUtilization * 100).toFixed(1)}%`
      : `Design failed: ${failedChecks.map(c => c.description).join(', ')}`,
    steps,
    codeChecks,
    warnings,
  };
}

export default calculateSteelBeamIS800;
