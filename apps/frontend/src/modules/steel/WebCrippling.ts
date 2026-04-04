/**
 * ============================================================================
 * WEB LOCAL YIELDING AND WEB CRIPPLING CHECKS
 * ============================================================================
 * 
 * Per IS 800:2007 Clause 8.7.3 - 8.7.6 and AISC 360-22 Section J10.2-J10.4
 * 
 * SCOPE:
 * - Web local yielding (concentrated forces)
 * - Web crippling (localized buckling)
 * - Web sidesway buckling
 * - Web compression buckling
 * - Stiffener requirements
 * 
 * @reference IS 800:2007, AISC 360-22
 * @author BeamLab Engineering Team
 * @version 1.0.0
 */

import { roundTo } from '../core/CalculationEngine';

// ============================================================================
// INTERFACES
// ============================================================================

export interface WebYieldingInput {
  // Section properties
  d: number;          // mm - Overall depth
  tw: number;         // mm - Web thickness
  tf: number;         // mm - Flange thickness
  k?: number;         // mm - Distance from outer face of flange to web toe of fillet (k = tf + r)
  r?: number;         // mm - Fillet radius
  
  // Material
  fy: number;         // MPa - Yield strength of web
  
  // Loading
  Ru: number;         // kN - Factored concentrated load or reaction
  N?: number;         // mm - Bearing length (default = 0 for point load)
  
  // Location
  location: 'interior' | 'end';  // Interior load or end reaction
  
  // Distance from edge (for end reactions)
  distance_from_end?: number;   // mm
}

export interface WebYieldingResult {
  isAdequate: boolean;
  phi_Rn: number;           // kN - Design strength
  Ru: number;               // kN - Applied load
  utilization: number;
  
  // Detailed values
  N_eff: number;            // mm - Effective bearing length
  web_local_yielding: number;  // kN
  
  stiffener_required: boolean;
  message: string;
}

export interface WebCripplingInput {
  // Section properties
  d: number;          // mm - Overall depth
  tw: number;         // mm - Web thickness
  tf: number;         // mm - Flange thickness
  
  // Material
  fy_web: number;     // MPa - Yield strength of web
  fy_flange: number;  // MPa - Yield strength of flange
  E: number;          // MPa - Modulus of elasticity (default: 2e5)
  
  // Loading
  Ru: number;         // kN - Factored concentrated load
  N?: number;         // mm - Bearing length (default = 0)
  
  // Location
  location: 'interior' | 'end';
  distance_from_end?: number;  // mm - For end condition
}

export interface WebCripplingResult {
  isAdequate: boolean;
  phi_Rn: number;           // kN - Design crippling strength
  Ru: number;               // kN - Applied load
  utilization: number;
  
  stiffener_required: boolean;
  message: string;
}

export interface WebBucklingInput {
  // Section properties
  dc: number;         // mm - Depth of web clear of fillets = d - 2k
  tw: number;         // mm - Web thickness
  
  // Material
  fy: number;         // MPa - Yield strength
  E: number;          // MPa - Modulus of elasticity
  
  // Loading
  Ru: number;         // kN - Total factored load
  
  // Stiffener presence
  stiffener_spacing?: number;  // mm - Distance between stiffeners (if present)
}

export interface WebBucklingResult {
  isAdequate: boolean;
  phi_Rn: number;           // kN - Design buckling strength
  Ru: number;               // kN - Applied load
  utilization: number;
  
  slenderness: number;
  Fcr: number;              // MPa - Critical stress
  
  stiffener_required: boolean;
  message: string;
}

export interface StiffenerDesignInput {
  // Section properties
  d: number;          // mm - Beam depth
  tw: number;         // mm - Web thickness
  tf: number;         // mm - Flange thickness
  bf: number;         // mm - Flange width
  
  // Material
  fy_stiffener: number;  // MPa - Yield strength of stiffener
  
  // Loading
  Ru: number;         // kN - Concentrated load to be resisted
  
  // Type
  type: 'bearing' | 'transverse' | 'intermediate';
}

export interface StiffenerDesignResult {
  isAdequate: boolean;
  
  // Stiffener dimensions
  width: number;      // mm - Required width (each side)
  thickness: number;  // mm - Required thickness
  area: number;       // mm² - Required cross-sectional area
  
  // Weld requirements
  weld_size: number;  // mm - Fillet weld size
  
  // Check details
  local_buckling_ok: boolean;
  bearing_ok: boolean;
  
  message: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Resistance factors per IS 800:2007 */
export const WEB_RESISTANCE_FACTORS = {
  gamma_m0: 1.10,  // Yielding
  gamma_m1: 1.25,  // Buckling
} as const;

/** AISC resistance factors */
export const AISC_RESISTANCE_FACTORS = {
  phi_web_yielding: 1.00,
  phi_web_crippling: 0.75,
  phi_sidesway_buckling: 0.85,
} as const;

// ============================================================================
// WEB LOCAL YIELDING - IS 800 Clause 8.7.3.1 / AISC J10.2
// ============================================================================

/**
 * Calculate web local yielding capacity
 * For concentrated loads applied to beam flanges
 * 
 * IS 800:2007 Clause 8.7.3.1:
 * Rn = (N + 2.5k) × tw × fyw / γm0  (interior)
 * Rn = (N + k) × tw × fyw / γm0     (end)
 */
export function checkWebLocalYielding(input: WebYieldingInput): WebYieldingResult {
  const {
    d, tw, tf,
    k = tf + (tf / 2),  // Approximate if not given
    fy,
    Ru,
    N = 0,
    location,
    distance_from_end = 0
  } = input;
  
  const gamma_m0 = WEB_RESISTANCE_FACTORS.gamma_m0;
  
  let N_eff: number;
  let phi_Rn: number;
  
  if (location === 'interior') {
    // Interior load: Rn = (N + 5k) × tw × fyw / γm0
    N_eff = N + 5 * k;
    phi_Rn = (N_eff * tw * fy / gamma_m0) / 1000; // kN
  } else {
    // End reaction
    if (distance_from_end >= d) {
      // Treat as interior if far enough from end
      N_eff = N + 5 * k;
    } else {
      // End reaction: Rn = (N + 2.5k) × tw × fyw / γm0
      N_eff = N + 2.5 * k;
    }
    phi_Rn = (N_eff * tw * fy / gamma_m0) / 1000; // kN
  }
  
  const utilization = Ru / phi_Rn;
  const isAdequate = utilization <= 1.0;
  const stiffener_required = !isAdequate;
  
  let message: string;
  if (isAdequate) {
    message = `Web local yielding OK. φRn = ${roundTo(phi_Rn, 1)} kN ≥ Ru = ${Ru} kN (${roundTo(utilization * 100, 1)}%)`;
  } else {
    message = `Web local yielding FAILS. φRn = ${roundTo(phi_Rn, 1)} kN < Ru = ${Ru} kN. Bearing stiffeners required.`;
  }
  
  return {
    isAdequate,
    phi_Rn: roundTo(phi_Rn, 1),
    Ru,
    utilization: roundTo(utilization, 3),
    N_eff: roundTo(N_eff, 1),
    web_local_yielding: roundTo(phi_Rn, 1),
    stiffener_required,
    message,
  };
}

// ============================================================================
// WEB CRIPPLING - IS 800 Clause 8.7.3.2 / AISC J10.3
// ============================================================================

/**
 * Calculate web crippling capacity
 * Localized buckling of web under concentrated load
 * 
 * AISC J10.3 formulas:
 * Interior: Rn = 0.80 × tw² × [1 + 3(N/d)(tw/tf)^1.5] × √(E×fy_f×tf/tw)
 * End:      Rn = 0.40 × tw² × [1 + 3(N/d)(tw/tf)^1.5] × √(E×fy_f×tf/tw) for N/d ≤ 0.2
 *           Rn = 0.40 × tw² × [1 + (4N/d - 0.2)(tw/tf)^1.5] × √(E×fy_f×tf/tw) for N/d > 0.2
 */
export function checkWebCrippling(input: WebCripplingInput): WebCripplingResult {
  const {
    d, tw, tf,
    fy_web, fy_flange,
    E = 200000,
    Ru,
    N = 0,
    location,
    distance_from_end = 0
  } = input;
  
  const phi = AISC_RESISTANCE_FACTORS.phi_web_crippling;
  const N_d = N / d;
  const tf_tw_ratio = Math.pow(tw / tf, 1.5);
  
  const sqrt_term = Math.sqrt((E * fy_flange * tf) / tw);
  
  let Rn: number;
  
  if (location === 'interior' || distance_from_end >= d / 2) {
    // Interior load
    Rn = 0.80 * tw * tw * (1 + 3 * N_d * tf_tw_ratio) * sqrt_term / 1000; // kN
  } else {
    // End reaction
    if (N_d <= 0.2) {
      Rn = 0.40 * tw * tw * (1 + 3 * N_d * tf_tw_ratio) * sqrt_term / 1000;
    } else {
      Rn = 0.40 * tw * tw * (1 + (4 * N_d - 0.2) * tf_tw_ratio) * sqrt_term / 1000;
    }
  }
  
  const phi_Rn = phi * Rn;
  const utilization = Ru / phi_Rn;
  const isAdequate = utilization <= 1.0;
  const stiffener_required = !isAdequate;
  
  let message: string;
  if (isAdequate) {
    message = `Web crippling OK. φRn = ${roundTo(phi_Rn, 1)} kN ≥ Ru = ${Ru} kN (${roundTo(utilization * 100, 1)}%)`;
  } else {
    message = `Web crippling FAILS. φRn = ${roundTo(phi_Rn, 1)} kN < Ru = ${Ru} kN. Bearing stiffeners required.`;
  }
  
  return {
    isAdequate,
    phi_Rn: roundTo(phi_Rn, 1),
    Ru,
    utilization: roundTo(utilization, 3),
    stiffener_required,
    message,
  };
}

// ============================================================================
// WEB SIDESWAY BUCKLING - AISC J10.4
// ============================================================================

/**
 * Check web sidesway buckling
 * Occurs when concentrated load causes lateral displacement of compression flange
 */
export function checkWebSideswayBuckling(
  input: {
    h: number;          // mm - Clear web height
    tw: number;         // mm - Web thickness
    tf: number;         // mm - Compression flange thickness
    bf: number;         // mm - Compression flange width
    Lb: number;         // mm - Laterally unbraced length of compression flange
    fy: number;         // MPa - Yield strength
    Ru: number;         // kN - Applied load
    flange_restrained: boolean;  // Is compression flange restrained against rotation?
  }
): WebBucklingResult {
  const { h, tw, tf, bf, Lb, fy, Ru, flange_restrained } = input;
  
  const phi = AISC_RESISTANCE_FACTORS.phi_sidesway_buckling;
  const h_tw = h / tw;
  const Lb_bf = Lb / bf;
  
  let Rn: number;
  let applicable = true;
  
  // Check applicability
  if (flange_restrained) {
    // For restrained flanges (h/tw) / (Lb/bf) > 2.3
    if ((h_tw / Lb_bf) <= 2.3) {
      applicable = false;
      Rn = Infinity;
    } else {
      // Cr = 960,000 × tw³ × tf / h² × [1 + 0.4(h/tw / Lb/bf)³]
      const ratio = h_tw / Lb_bf;
      Rn = (960000 * Math.pow(tw, 3) * tf / (h * h)) * 
           (1 + 0.4 * Math.pow(ratio, 3)) / 1000; // kN
    }
  } else {
    // For unrestrained flanges (h/tw) / (Lb/bf) > 1.7
    if ((h_tw / Lb_bf) <= 1.7) {
      applicable = false;
      Rn = Infinity;
    } else {
      // Cr = 480,000 × tw³ × tf / h² × [0.4(h/tw / Lb/bf)³]
      const ratio = h_tw / Lb_bf;
      Rn = (480000 * Math.pow(tw, 3) * tf / (h * h)) * 
           (0.4 * Math.pow(ratio, 3)) / 1000; // kN
    }
  }
  
  const phi_Rn = phi * Rn;
  const utilization = applicable ? Ru / phi_Rn : 0;
  const isAdequate = !applicable || utilization <= 1.0;
  
  let message: string;
  if (!applicable) {
    message = 'Web sidesway buckling check not required for this geometry';
  } else if (isAdequate) {
    message = `Web sidesway buckling OK. φRn = ${roundTo(phi_Rn, 1)} kN (${roundTo(utilization * 100, 1)}%)`;
  } else {
    message = `Web sidesway buckling FAILS. Lateral bracing required.`;
  }
  
  return {
    isAdequate,
    phi_Rn: roundTo(phi_Rn, 1),
    Ru,
    utilization: roundTo(utilization, 3),
    slenderness: h_tw / Lb_bf,
    Fcr: 0,
    stiffener_required: !isAdequate && applicable,
    message,
  };
}

// ============================================================================
// WEB COMPRESSION BUCKLING - AISC J10.5
// ============================================================================

/**
 * Check web compression buckling
 * For pair of concentrated forces applied on both flanges
 */
export function checkWebCompressionBuckling(input: WebBucklingInput): WebBucklingResult {
  const {
    dc, tw,
    fy, E,
    Ru,
    stiffener_spacing
  } = input;
  
  const phi = AISC_RESISTANCE_FACTORS.phi_web_crippling;
  
  // Web slenderness
  const lambda = dc / tw;
  
  // Critical buckling stress
  // Fcr = 24 × tw³ × √(E × fy) / h
  // Note: h = dc for web compression buckling
  let Rn: number;
  
  if (stiffener_spacing && stiffener_spacing < dc) {
    // With stiffeners closer than web depth
    const k = 5.0 + 5.0 / Math.pow(stiffener_spacing / dc, 2);
    const Fcr = (0.9 * k * E) / Math.pow(lambda, 2);
    Rn = Fcr * dc * tw / 1000; // kN
  } else {
    // Without effective stiffeners
    Rn = (24 * Math.pow(tw, 3) * Math.sqrt(E * fy)) / dc / 1000; // kN
  }
  
  const phi_Rn = phi * Rn;
  const utilization = Ru / phi_Rn;
  const isAdequate = utilization <= 1.0;
  
  let message: string;
  if (isAdequate) {
    message = `Web compression buckling OK. φRn = ${roundTo(phi_Rn, 1)} kN (${roundTo(utilization * 100, 1)}%)`;
  } else {
    message = `Web compression buckling FAILS. Stiffeners required at load points.`;
  }
  
  return {
    isAdequate,
    phi_Rn: roundTo(phi_Rn, 1),
    Ru,
    utilization: roundTo(utilization, 3),
    slenderness: lambda,
    Fcr: roundTo((24 * Math.pow(tw, 3) * Math.sqrt(E * fy)) / dc / (dc * tw), 2),
    stiffener_required: !isAdequate,
    message,
  };
}

// ============================================================================
// BEARING STIFFENER DESIGN - IS 800 Clause 8.7.5 / AISC J10.8
// ============================================================================

/**
 * Design bearing stiffener
 * Required when web local yielding or web crippling fails
 */
export function designBearingStiffener(input: StiffenerDesignInput): StiffenerDesignResult {
  const {
    d, tw, tf, bf,
    fy_stiffener,
    Ru,
    type
  } = input;
  
  const gamma_m0 = WEB_RESISTANCE_FACTORS.gamma_m0;
  const gamma_m1 = WEB_RESISTANCE_FACTORS.gamma_m1;
  
  // Clear web depth
  const hw = d - 2 * tf;
  
  // Stiffener outstand limit (to prevent local buckling)
  // Per IS 800: b/t ≤ 14ε where ε = √(250/fy)
  const epsilon = Math.sqrt(250 / fy_stiffener);
  const max_bt_ratio = 14 * epsilon;
  
  // Calculate required stiffener area
  // Stiffener + 25tw of web acts as column to resist load
  // Required area based on axial capacity
  let Ast_required: number;
  
  if (type === 'bearing') {
    // Full load transferred through stiffener
    Ast_required = (Ru * 1000 * gamma_m0) / (fy_stiffener); // mm²
  } else {
    // Partial load
    Ast_required = (Ru * 1000 * gamma_m0) / (fy_stiffener * 0.8);
  }
  
  // Minimum stiffener width (on each side of web)
  // Must extend nearly to edge of flanges
  const min_width = (bf / 2 - tw / 2) - 10; // 10mm clearance from edge
  
  // Calculate thickness based on width and local buckling
  const ts_min = min_width / max_bt_ratio;
  
  // Proposed stiffener dimensions (rounded to practical values)
  const width = Math.ceil(Math.max(min_width, 50) / 5) * 5;      // Round to nearest 5mm
  const thickness = Math.ceil(Math.max(ts_min, 8) / 2) * 2;  // Round to nearest 2mm
  
  // Check local buckling of stiffener
  const bt_ratio = width / thickness;
  const local_buckling_ok = bt_ratio <= max_bt_ratio;
  
  // Provided area (pair of stiffeners)
  const area_provided = 2 * width * thickness;
  const bearing_ok = area_provided >= Ast_required;
  
  // Weld size (minimum per IS 800 Table 22)
  const weld_size = Math.max(3, Math.ceil(thickness * 0.4));
  
  const isAdequate = local_buckling_ok && bearing_ok;
  
  let message: string;
  if (isAdequate) {
    message = `Provide ${width}×${thickness} mm stiffeners on both sides of web with ${weld_size}mm fillet welds`;
  } else {
    if (!local_buckling_ok) {
      message = `Increase stiffener thickness to prevent local buckling. Required t ≥ ${roundTo(width / max_bt_ratio, 1)} mm`;
    } else {
      message = `Increase stiffener area. Required ≥ ${roundTo(Ast_required, 0)} mm²`;
    }
  }
  
  return {
    isAdequate,
    width,
    thickness,
    area: area_provided,
    weld_size,
    local_buckling_ok,
    bearing_ok,
    message,
  };
}

// ============================================================================
// COMPREHENSIVE WEB CHECK
// ============================================================================

export interface WebCheckInput {
  // Section
  d: number;
  tw: number;
  tf: number;
  bf: number;
  k?: number;
  
  // Material  
  fy: number;
  E?: number;
  
  // Loading
  Ru: number;
  N?: number;
  location: 'interior' | 'end';
  distance_from_end?: number;
  
  // Bracing
  Lb?: number;
  flange_restrained?: boolean;
}

export interface WebCheckResult {
  local_yielding: WebYieldingResult;
  crippling: WebCripplingResult;
  sidesway_buckling?: WebBucklingResult;
  
  governing_check: string;
  governing_capacity: number;
  governing_utilization: number;
  
  stiffener_required: boolean;
  stiffener_design?: StiffenerDesignResult;
  
  overall_status: 'OK' | 'STIFFENER_REQUIRED';
  summary: string;
}

/**
 * Comprehensive web strength check
 * Performs all applicable checks and determines if stiffeners are needed
 */
export function checkWebStrength(input: WebCheckInput): WebCheckResult {
  const {
    d, tw, tf, bf,
    k = tf + tf / 2,
    fy, E = 200000,
    Ru, N = 0,
    location, distance_from_end = 0,
    Lb, flange_restrained = true
  } = input;
  
  // Check web local yielding
  const local_yielding = checkWebLocalYielding({
    d, tw, tf, k, fy, Ru, N, location, distance_from_end
  });
  
  // Check web crippling
  const crippling = checkWebCrippling({
    d, tw, tf,
    fy_web: fy, fy_flange: fy, E,
    Ru, N, location, distance_from_end
  });
  
  // Check sidesway buckling if Lb provided
  let sidesway_buckling: WebBucklingResult | undefined;
  if (Lb) {
    sidesway_buckling = checkWebSideswayBuckling({
      h: d - 2 * tf, tw, tf, bf, Lb, fy, Ru, flange_restrained: flange_restrained!
    });
  }
  
  // Determine governing check
  const checks = [
    { name: 'Web Local Yielding', capacity: local_yielding.phi_Rn, utilization: local_yielding.utilization },
    { name: 'Web Crippling', capacity: crippling.phi_Rn, utilization: crippling.utilization },
  ];
  
  if (sidesway_buckling && sidesway_buckling.phi_Rn < Infinity) {
    checks.push({ 
      name: 'Web Sidesway Buckling', 
      capacity: sidesway_buckling.phi_Rn, 
      utilization: sidesway_buckling.utilization 
    });
  }
  
  const governing = checks.reduce((prev, curr) => 
    curr.utilization > prev.utilization ? curr : prev
  );
  
  const governing_check = governing.name;
  const governing_capacity = governing.capacity;
  const governing_utilization = governing.utilization;
  
  // Determine if stiffeners are required
  const stiffener_required = governing_utilization > 1.0;
  
  // Design stiffener if required
  let stiffener_design: StiffenerDesignResult | undefined;
  if (stiffener_required) {
    stiffener_design = designBearingStiffener({
      d, tw, tf, bf,
      fy_stiffener: fy,
      Ru,
      type: 'bearing'
    });
  }
  
  const overall_status = stiffener_required ? 'STIFFENER_REQUIRED' : 'OK';
  
  let summary: string;
  if (!stiffener_required) {
    summary = `Web strength is adequate. Governing: ${governing_check} at ${roundTo(governing_utilization * 100, 1)}% utilization.`;
  } else {
    summary = `Web strength is INADEQUATE. Governing: ${governing_check} at ${roundTo(governing_utilization * 100, 1)}% utilization. ` +
              `Bearing stiffeners required: ${stiffener_design?.width}×${stiffener_design?.thickness} mm.`;
  }
  
  return {
    local_yielding,
    crippling,
    sidesway_buckling,
    governing_check,
    governing_capacity,
    governing_utilization,
    stiffener_required,
    stiffener_design,
    overall_status,
    summary,
  };
}

// ============================================================================
// QUICK REFERENCE
// ============================================================================

export const WEB_CHECK_QUICK_REFERENCE = {
  web_local_yielding: {
    description: 'Yielding of web under concentrated load',
    formula_interior: 'φRn = (N + 5k) × tw × fyw / γm0',
    formula_end: 'φRn = (N + 2.5k) × tw × fyw / γm0',
    phi: 1.0,
  },
  web_crippling: {
    description: 'Local buckling of web under concentrated load',
    formula: 'φRn = 0.80 × tw² × [1 + 3(N/d)(tw/tf)^1.5] × √(E×fyf×tf/tw)',
    phi: 0.75,
    applies_when: 'Flanges not restrained against rotation',
  },
  sidesway_buckling: {
    description: 'Lateral displacement of compression flange',
    applies_when: '(h/tw)/(Lb/bf) > 2.3 (restrained) or > 1.7 (unrestrained)',
    phi: 0.85,
  },
  stiffener_limits: {
    outstand_ratio: 'b/t ≤ 14ε',
    min_extension: 'Nearly to flange edges',
  },
};