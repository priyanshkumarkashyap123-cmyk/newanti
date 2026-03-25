/**
 * SteelDesignService.ts - AISC 360-16 Steel Design Checks
 *
 * Implements comprehensive steel member design checks:
 * - Tension member design (Chapter D)
 * - Compression member design (Chapter E)
 * - Flexural member design (Chapter F)
 * - Combined forces (Chapter H)
 * - Shear design (Chapter G)
 */

import { SectionProperties, Material } from "../data/SectionDatabase";
import { API_CONFIG } from "../config/env";

// ============================================
// TYPES
// ============================================

export interface MemberForces {
  axial: number; // kN (positive = tension, negative = compression)
  shearY: number; // kN
  shearZ: number; // kN
  momentY: number; // kN-m (about Y-Y axis)
  momentZ: number; // kN-m (about Z-Z axis)
  torsion?: number; // kN-m
}

export interface DesignParameters {
  Lb: number; // Unbraced length for lateral-torsional buckling (mm)
  Lx: number; // Effective length for X-X buckling (mm)
  Ly: number; // Effective length for Y-Y buckling (mm)
  Kx?: number; // Effective length factor X-X (default 1.0)
  Ky?: number; // Effective length factor Y-Y (default 1.0)
  Cb?: number; // Lateral-torsional buckling modification factor (default 1.0)
  Cm?: number; // Moment modification factor for combined forces
}

export interface DesignResult {
  memberId: string;
  checkType: string;
  capacity: number;
  demand: number;
  ratio: number;
  status: "PASS" | "FAIL" | "WARNING";
  details: string;
  code: string;
}

export interface SteelDesignResults {
  memberId: string;
  section: SectionProperties;
  material: Material;
  forces: MemberForces;

  // Individual checks
  tensionCheck?: DesignResult;
  compressionCheck?: DesignResult;
  flexureXCheck?: DesignResult;
  flexureYCheck?: DesignResult;
  shearVyCheck?: DesignResult;
  shearVzCheck?: DesignResult;
  combinedCheck?: DesignResult;

  // Summary
  criticalRatio: number;
  overallStatus: "PASS" | "FAIL" | "WARNING";
  governingCheck: string;
}

// ============================================
// CONSTANTS
// ============================================

const PHI_TENSION = 0.9; // LRFD resistance factor for tension
const PHI_COMPRESSION = 0.9; // LRFD resistance factor for compression
const PHI_FLEXURE = 0.9; // LRFD resistance factor for flexure
const PHI_SHEAR = 1.0; // LRFD resistance factor for shear

// ============================================
// AISC 360-16 CHAPTER D - TENSION
// ============================================

export function checkTension(
  section: SectionProperties,
  material: Material,
  Pu: number, // Required tensile strength (kN)
  An?: number, // Net area (mm²) - defaults to gross area
): DesignResult {
  const fy = material.fy || 250; // MPa
  const fu = material.fu || 400; // MPa
  const Ag = section.A; // Gross area (mm²)
  const Ae = An || Ag; // Effective net area

  // D2. Tensile strength
  // (a) For yielding in gross section: Pn = Fy * Ag
  const Pn_yield = (fy * Ag) / 1000; // kN

  // (b) For rupture in net section: Pn = Fu * Ae
  const Pn_rupture = (fu * Ae) / 1000; // kN

  // Design tensile strength
  const Phi_Pn_yield = PHI_TENSION * Pn_yield;
  const Phi_Pn_rupture = 0.75 * Pn_rupture; // φ = 0.75 for rupture

  const Phi_Pn = Math.min(Phi_Pn_yield, Phi_Pn_rupture);
  const ratio = Pu / Phi_Pn;

  let status: "PASS" | "FAIL" | "WARNING" = "PASS";
  if (ratio > 1.0) status = "FAIL";
  else if (ratio > 0.9) status = "WARNING";

  const governing = Phi_Pn_yield < Phi_Pn_rupture ? "Yielding" : "Rupture";

  return {
    memberId: "",
    checkType: "Tension",
    capacity: Phi_Pn,
    demand: Pu,
    ratio,
    status,
    details: `φPn = ${Phi_Pn.toFixed(1)} kN (${governing}), Pu = ${Pu.toFixed(1)} kN`,
    code: "AISC 360-16 Chapter D",
  };
}

// ============================================
// AISC 360-16 CHAPTER E - COMPRESSION
// ============================================

export function checkCompression(
  section: SectionProperties,
  material: Material,
  Pu: number, // Required compressive strength (kN, positive value)
  params: DesignParameters,
): DesignResult {
  const fy = material.fy || 250; // MPa
  const E = material.E; // MPa
  const Ag = section.A; // mm²
  const rx = section.rx; // mm
  const ry = section.ry; // mm

  const Kx = params.Kx || 1.0;
  const Ky = params.Ky || 1.0;

  // Slenderness ratios
  const KLr_x = (Kx * params.Lx) / rx;
  const KLr_y = (Ky * params.Ly) / ry;
  const KLr = Math.max(KLr_x, KLr_y);

  // E3. Flexural Buckling
  const Fe = (Math.PI ** 2 * E) / KLr ** 2; // Elastic buckling stress

  let Fcr: number;

  if (KLr <= 4.71 * Math.sqrt(E / fy)) {
    // Inelastic buckling (E3-2)
    Fcr = fy * Math.pow(0.658, fy / Fe);
  } else {
    // Elastic buckling (E3-3)
    Fcr = 0.877 * Fe;
  }

  // Nominal compressive strength
  const Pn = (Fcr * Ag) / 1000; // kN
  const Phi_Pn = PHI_COMPRESSION * Pn;

  const ratio = Pu / Phi_Pn;

  let status: "PASS" | "FAIL" | "WARNING" = "PASS";
  if (ratio > 1.0) status = "FAIL";
  else if (ratio > 0.9) status = "WARNING";

  const bucklingType = KLr_x > KLr_y ? "X-X axis" : "Y-Y axis";

  return {
    memberId: "",
    checkType: "Compression",
    capacity: Phi_Pn,
    demand: Pu,
    ratio,
    status,
    details: `φPn = ${Phi_Pn.toFixed(1)} kN, Pu = ${Pu.toFixed(1)} kN, KL/r = ${KLr.toFixed(1)} (${bucklingType})`,
    code: "AISC 360-16 Chapter E",
  };
}

// ============================================
// AISC 360-16 CHAPTER F - FLEXURE
// ============================================

export function checkFlexure(
  section: SectionProperties,
  material: Material,
  Mu: number, // Required flexural strength (kN-m)
  params: DesignParameters,
  axis: "major" | "minor" = "major",
): DesignResult {
  const fy = material.fy || 250; // MPa
  const E = material.E; // MPa

  const Zx = section.Zx; // Plastic section modulus X-X (mm³)
  const Zy = section.Zy; // Plastic section modulus Y-Y (mm³)
  const Sx = section.Sx; // Elastic section modulus X-X (mm³)
  const Sy = section.Sy; // Elastic section modulus Y-Y (mm³)
  const ry = section.ry; // Radius of gyration Y-Y (mm)
  const J = section.J || 0; // Torsional constant (mm⁴)
  const Cw = section.Cw || 0; // Warping constant (mm⁶)

  const Lb = params.Lb; // Unbraced length (mm)
  const Cb = params.Cb || 1.0;

  let Mn: number;
  let limitState: string;

  if (axis === "major") {
    // F2. Doubly Symmetric Compact I-Shaped Members
    const Mp = (fy * Zx) / 1e6; // kN-m (plastic moment)

    // Limiting unbraced lengths
    const Lp = 1.76 * ry * Math.sqrt(E / fy); // Plastic limit

    // rts - effective radius of gyration for LTB (AISC F2-7)
    const Iy_sec = section.Iy || (section.Ix ? section.Ix * 0.1 : 1e6);
    const rts = Math.sqrt(Math.sqrt(Iy_sec * (Cw || 1e9)) / Sx);
    const c = 1.0; // For doubly symmetric I-shapes
    const ho = (section.d || 300) - (section.tf || 10); // Distance between flange centroids
    const Lr =
      1.95 *
      rts *
      (E / (0.7 * fy)) *
      Math.sqrt(
        (J * c) / (Sx * ho) +
          Math.sqrt(
            Math.pow((J * c) / (Sx * ho), 2) +
              6.76 * Math.pow((0.7 * fy) / E, 2),
          ),
      );

    if (Lb <= Lp) {
      // (a) Yielding
      Mn = Mp;
      limitState = "Yielding";
    } else if (Lb <= Lr) {
      // (b) Inelastic Lateral-Torsional Buckling
      const Mr = (0.7 * fy * Sx) / 1e6; // kN-m
      Mn = Cb * (Mp - ((Mp - Mr) * (Lb - Lp)) / (Lr - Lp));
      Mn = Math.min(Mn, Mp);
      limitState = "Inelastic LTB";
    } else {
      // (c) Elastic Lateral-Torsional Buckling
      const Fcr =
        ((Cb * Math.PI ** 2 * E) / (Lb / rts) ** 2) *
        Math.sqrt(1 + ((0.078 * (J * c)) / (Sx * ho)) * (Lb / rts) ** 2);
      Mn = (Fcr * Sx) / 1e6;
      Mn = Math.min(Mn, Mp);
      limitState = "Elastic LTB";
    }
  } else {
    // Minor axis bending - no LTB
    const Mp = (fy * Zy) / 1e6; // kN-m
    Mn = Math.min(Mp, (1.6 * fy * Sy) / 1e6);
    limitState = "Yielding";
  }

  const Phi_Mn = PHI_FLEXURE * Mn;
  const ratio = Math.abs(Mu) / Phi_Mn;

  let status: "PASS" | "FAIL" | "WARNING" = "PASS";
  if (ratio > 1.0) status = "FAIL";
  else if (ratio > 0.9) status = "WARNING";

  return {
    memberId: "",
    checkType: axis === "major" ? "Flexure (Major)" : "Flexure (Minor)",
    capacity: Phi_Mn,
    demand: Math.abs(Mu),
    ratio,
    status,
    details: `φMn = ${Phi_Mn.toFixed(1)} kN-m (${limitState}), Mu = ${Math.abs(Mu).toFixed(1)} kN-m`,
    code: "AISC 360-16 Chapter F",
  };
}

// ============================================
// AISC 360-16 CHAPTER G - SHEAR
// ============================================

export function checkShear(
  section: SectionProperties,
  material: Material,
  Vu: number, // Required shear strength (kN)
): DesignResult {
  const fy = material.fy || 250; // MPa
  const E = material.E; // MPa

  const d = section.d || 300; // Depth (mm)
  const tw = section.tw || 8; // Web thickness (mm)
  const Aw = d * tw; // Web area (mm²)

  // Web slenderness
  const h = d - 2 * (section.tf || 10);
  const h_tw = h / tw;

  // AISC 360-16 G2 — Web shear coefficient Cv1
  // kv = 5.34 for unstiffened webs (no transverse stiffeners, a/h > 3)
  const kv = 5.34;
  let Cv1: number;
  const limit_yield = 1.10 * Math.sqrt(kv * E / fy);    // G2-3 transition
  const limit_elastic = 1.37 * Math.sqrt(kv * E / fy);   // G2-5 transition

  if (h_tw <= limit_yield) {
    // G2-3: No web buckling
    Cv1 = 1.0;
  } else if (h_tw <= limit_elastic) {
    // G2-4: Inelastic web buckling
    Cv1 = limit_yield / h_tw;
  } else {
    // G2-5: Elastic web buckling
    Cv1 = (1.51 * kv * E) / (h_tw ** 2 * fy);
  }

  // Nominal shear strength (G2-1)
  const Vn = (0.6 * fy * Aw * Cv1) / 1000; // kN
  const Phi_Vn = PHI_SHEAR * Vn;

  const ratio = Math.abs(Vu) / Phi_Vn;

  let status: "PASS" | "FAIL" | "WARNING" = "PASS";
  if (ratio > 1.0) status = "FAIL";
  else if (ratio > 0.9) status = "WARNING";

  return {
    memberId: "",
    checkType: "Shear",
    capacity: Phi_Vn,
    demand: Math.abs(Vu),
    ratio,
    status,
    details: `φVn = ${Phi_Vn.toFixed(1)} kN, Vu = ${Math.abs(Vu).toFixed(1)} kN, Cv1 = ${Cv1.toFixed(3)}`,
    code: "AISC 360-16 Chapter G",
  };
}

// ============================================
// AISC 360-16 CHAPTER H - COMBINED FORCES
// ============================================

export function checkCombined(
  section: SectionProperties,
  material: Material,
  forces: MemberForces,
  params: DesignParameters,
): DesignResult {
  const Pu = Math.abs(forces.axial);
  const Mux = Math.abs(forces.momentZ); // Major axis moment
  const Muy = Math.abs(forces.momentY); // Minor axis moment

  // Get capacities
  let Pc: number;
  if (forces.axial < 0) {
    // Compression
    const compResult = checkCompression(section, material, Pu, params);
    Pc = compResult.capacity;
  } else {
    // Tension
    const tensResult = checkTension(section, material, Pu);
    Pc = tensResult.capacity;
  }

  const flexMajor = checkFlexure(section, material, Mux, params, "major");
  const flexMinor = checkFlexure(section, material, Muy, params, "minor");
  const Mcx = flexMajor.capacity;
  const Mcy = flexMinor.capacity;

  // H1. Doubly and Singly Symmetric Members
  const Pr_Pc = Pu / Pc;

  let ratio: number;
  let equation: string;

  // Guard against zero capacity
  const safeMcx = Mcx > 0 ? Mcx : 1e-10;
  const safeMcy = Mcy > 0 ? Mcy : 1e-10;

  if (Pr_Pc >= 0.2) {
    // H1-1a: Pr/Pc + 8/9 * (Mrx/Mcx + Mry/Mcy) <= 1.0
    ratio = Pr_Pc + (8 / 9) * (Mux / safeMcx + Muy / safeMcy);
    equation = "H1-1a";
  } else {
    // H1-1b: Pr/(2*Pc) + (Mrx/Mcx + Mry/Mcy) <= 1.0
    ratio = Pr_Pc / 2 + (Mux / safeMcx + Muy / safeMcy);
    equation = "H1-1b";
  }

  let status: "PASS" | "FAIL" | "WARNING" = "PASS";
  if (ratio > 1.0) status = "FAIL";
  else if (ratio > 0.9) status = "WARNING";

  return {
    memberId: "",
    checkType: "Combined Forces",
    capacity: 1.0,
    demand: ratio,
    ratio,
    status,
    details: `Eq. ${equation}: Pu/Pc = ${Pr_Pc.toFixed(3)}, Mux/Mcx = ${(Mux / safeMcx).toFixed(3)}, Muy/Mcy = ${(Muy / safeMcy).toFixed(3)}`,
    code: "AISC 360-16 Chapter H",
  };
}

// ============================================
// COMPREHENSIVE MEMBER CHECK
// ============================================

export function performSteelDesignCheck(
  memberId: string,
  section: SectionProperties,
  material: Material,
  forces: MemberForces,
  params: DesignParameters,
): SteelDesignResults {
  const results: SteelDesignResults = {
    memberId,
    section,
    material,
    forces,
    criticalRatio: 0,
    overallStatus: "PASS",
    governingCheck: "",
  };

  const allChecks: DesignResult[] = [];

  // 1. Axial check
  if (forces.axial > 0.1) {
    // Tension
    results.tensionCheck = checkTension(section, material, forces.axial);
    results.tensionCheck.memberId = memberId;
    allChecks.push(results.tensionCheck);
  } else if (forces.axial < -0.1) {
    // Compression
    results.compressionCheck = checkCompression(
      section,
      material,
      Math.abs(forces.axial),
      params,
    );
    results.compressionCheck.memberId = memberId;
    allChecks.push(results.compressionCheck);
  }

  // 2. Flexure checks
  if (Math.abs(forces.momentZ) > 0.01) {
    results.flexureXCheck = checkFlexure(
      section,
      material,
      forces.momentZ,
      params,
      "major",
    );
    results.flexureXCheck.memberId = memberId;
    allChecks.push(results.flexureXCheck);
  }

  if (Math.abs(forces.momentY) > 0.01) {
    results.flexureYCheck = checkFlexure(
      section,
      material,
      forces.momentY,
      params,
      "minor",
    );
    results.flexureYCheck.memberId = memberId;
    allChecks.push(results.flexureYCheck);
  }

  // 3. Shear checks
  if (Math.abs(forces.shearY) > 0.01) {
    results.shearVyCheck = checkShear(section, material, forces.shearY);
    results.shearVyCheck.memberId = memberId;
    allChecks.push(results.shearVyCheck);
  }

  if (Math.abs(forces.shearZ) > 0.01) {
    results.shearVzCheck = checkShear(section, material, forces.shearZ);
    results.shearVzCheck.memberId = memberId;
    allChecks.push(results.shearVzCheck);
  }

  // 4. Combined forces check
  if (
    Math.abs(forces.axial) > 0.1 &&
    (Math.abs(forces.momentZ) > 0.01 || Math.abs(forces.momentY) > 0.01)
  ) {
    results.combinedCheck = checkCombined(section, material, forces, params);
    results.combinedCheck.memberId = memberId;
    allChecks.push(results.combinedCheck);
  }

  // Determine critical ratio and overall status
  let maxRatio = 0;
  let governingCheck = "";

  for (const check of allChecks) {
    if (check.ratio > maxRatio) {
      maxRatio = check.ratio;
      governingCheck = check.checkType;
    }
    if (check.status === "FAIL") {
      results.overallStatus = "FAIL";
    } else if (check.status === "WARNING" && results.overallStatus !== "FAIL") {
      results.overallStatus = "WARNING";
    }
  }

  results.criticalRatio = maxRatio;
  results.governingCheck = governingCheck;

  return results;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getSectionClassification(
  section: SectionProperties,
  material: Material,
  axialRatio: number = 0, // P/Py for web classification
): "compact" | "noncompact" | "slender" {
  const fy = material.fy || 250;
  const E = material.E;

  const bf = section.bf || 100;
  const tf = section.tf || 8;
  const d = section.d || 300;
  const tw = section.tw || 6;

  // Flange slenderness (AISC Table B4.1b, Case 10)
  const lambda_f = bf / (2 * tf);
  const lambda_pf = 0.38 * Math.sqrt(E / fy);
  const lambda_rf = 1.0 * Math.sqrt(E / fy);

  // Web slenderness (AISC Table B4.1a, Case 1 for flexure)
  const h = d - 2 * tf;
  const lambda_w = h / tw;
  
  // Web limits depend on axial load level (AISC Table B4.1a, Case 5)
  let lambda_pw: number;
  if (axialRatio <= 0.125) {
    // Low axial: standard flexure limit
    lambda_pw = 3.76 * Math.sqrt(E / fy) * (1 - 2.75 * axialRatio);
  } else {
    // High axial: reduced limit
    lambda_pw = Math.max(
      1.12 * Math.sqrt(E / fy) * (2.33 - axialRatio),
      1.49 * Math.sqrt(E / fy)
    );
  }
  const lambda_rw = 5.70 * Math.sqrt(E / fy);

  // Classification
  if (lambda_f > lambda_rf || lambda_w > lambda_rw) {
    return "slender";
  } else if (lambda_f > lambda_pf || lambda_w > lambda_pw) {
    return "noncompact";
  }
  return "compact";
}

export function formatDesignResult(result: DesignResult): string {
  const statusIcon =
    result.status === "PASS" ? "✓" : result.status === "FAIL" ? "✗" : "⚠";
  return `${statusIcon} ${result.checkType}: ${(result.ratio * 100).toFixed(1)}% (${result.status})`;
}

// ============================================
// API INTEGRATION
// ============================================

export async function designSteelMembers(
  members: SteelDesignResults[],
  code: "AISC360" | "IS800" = "AISC360",
): Promise<SteelDesignResults[]> {
  try {
    // Use Node API gateway which proxies to Python (canonical owner for design codes)
    const API_BASE = API_CONFIG.baseUrl;

    const payload = {
      members: members.map((m) => {
        // Calculate member length from section/design parameters or use default
        const memberLength = (m as unknown as { designParams?: { Lx?: number } }).designParams?.Lx
          || ((m.section as SectionProperties & { L?: number })?.L ?? 0)
          || (m.compressionCheck?.details ? parseFloat(m.compressionCheck.details.match(/L\s*=\s*([\d.]+)/)?.[1] || '0') : 0)
          || 3000; // Default 3m if no geometry available
        return {
        id: m.memberId,
        code: code,
        grade: typeof m.material.name === "string" ? m.material.name : "E250",
        fy: m.material.fy || 250,
        fu: m.material.fu || 410,
        length: memberLength,
        effective_length_factor_y: 1.0,
        effective_length_factor_z: 1.0,
        section: {
          area: m.section.A,
          Ixx: m.section.Ix,
          Iyy: m.section.Iy,
          J: m.section.J || 0,
          Zz: m.section.Sx, // Mapping Sx to Zz (Elastic)
          Zy: m.section.Sy,
          Zpz: m.section.Zx, // Mapping Zx to Zpz (Plastic - assumption for API mapping)
          Zpy: m.section.Zy,
          ry: m.section.ry,
          rz: m.section.rx || 0, // Swap?
          depth: m.section.d,
          width: m.section.bf || m.section.b || 0,
          tf: m.section.tf || 0,
          tw: m.section.tw || 0,
        },
        forces: m.forces,
      };
      }),
    };

    // Route through Node gateway → Python design endpoint
    const endpoint =
      code === "AISC360" ? "/api/design/aisc" : "/api/design/is800";
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn("Rust API design check failed, using local calculations");
      return members; // Fallback to local
    }

    const results = await response.json();

    // Merge API results back into local results structure
    return members.map((m) => {
      const apiResult = results.find((r: any) => r.memberId === m.memberId);
      if (!apiResult) return m;

      // Map API checks to local structure
      return {
        ...m,
        overallStatus: apiResult.status?.toUpperCase() || m.overallStatus,
        criticalRatio: apiResult.overallRatio || m.criticalRatio,
      };
    });
  } catch (e) {
    console.error("Steel Design API Error:", e);
    return members; // Fallback to local calculations
  }
}

export async function optimizeMember(
  code: string,
  shapeType: string,
  memberParams: any,
  forces: {
    axial: number;
    shearY: number;
    shearZ: number;
    torsion?: number;
    momentY: number;
    momentZ: number;
  },
): Promise<{ section: any; ratio: number; weight: number } | null> {
  // Route through Node API gateway → Python design/optimize
  const API_BASE = API_CONFIG.baseUrl;
  try {
    const response = await fetch(`${API_BASE}/api/design/optimize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        shape_type: shapeType,
        member_params: memberParams,
        forces,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.success) {
      return {
        section: data.optimal_section,
        ratio: data.ratio,
        weight: data.weight,
      };
    }
    return null;
  } catch (e) {
    console.error("Optimization failed", e);
    return null;
  }
}

// ============================================
// IS 800:2007 LOCAL DESIGN ENGINE
// ============================================

const GAMMA_M0 = 1.10; // IS 800 Cl. 5.4.1 — Partial safety factor for yielding
const GAMMA_M1 = 1.25; // IS 800 Cl. 5.4.1 — Partial safety factor for ultimate

/** IS 800:2007 Cl. 6 — Tension */
export function checkTensionIS800(
  section: SectionProperties,
  material: Material,
  Pu: number,
  An?: number,
): DesignResult {
  const fy = material.fy || 250;
  const fu = material.fu || 410;
  const Ag = section.A;
  const Ae = An || Ag;

  const Td_g = (fy * Ag) / (GAMMA_M0 * 1000); // kN — yielding of gross section
  const Td_n = (0.9 * fu * Ae) / (GAMMA_M1 * 1000); // kN — rupture of net section
  const Td = Math.min(Td_g, Td_n);

  const ratio = Pu / Td;
  let status: "PASS" | "FAIL" | "WARNING" = ratio > 1 ? "FAIL" : ratio > 0.9 ? "WARNING" : "PASS";
  const governing = Td_g < Td_n ? "Yielding" : "Rupture";

  return {
    memberId: "", checkType: "Tension (IS 800)", capacity: Td, demand: Pu, ratio, status,
    details: `Td = ${Td.toFixed(1)} kN (${governing}), Pu = ${Pu.toFixed(1)} kN`,
    code: "IS 800:2007 Cl. 6",
  };
}

/** IS 800:2007 Cl. 7 — Compression */
export function checkCompressionIS800(
  section: SectionProperties,
  material: Material,
  Pu: number,
  params: DesignParameters,
  buckling_curve: "a" | "b" | "c" | "d" = "c",
): DesignResult {
  const fy = material.fy || 250;
  const E = material.E;
  const Ag = section.A;

  const Kx = params.Kx || 1.0;
  const Ky = params.Ky || 1.0;
  const rx = section.rx;
  const ry = section.ry;

  const KLr_x = (Kx * params.Lx) / rx;
  const KLr_y = (Ky * params.Ly) / ry;
  const KLr = Math.max(KLr_x, KLr_y);

  // IS 800 Cl. 7.1.2 — Non-dimensional slenderness
  const fcc = (Math.PI ** 2 * E) / (KLr ** 2);
  const lambda_bar = Math.sqrt(fy / fcc);

  // Imperfection factor (IS 800 Table 10)
  const alpha_map = { a: 0.21, b: 0.34, c: 0.49, d: 0.76 };
  const alpha = alpha_map[buckling_curve];

  const phi = 0.5 * (1 + alpha * (lambda_bar - 0.2) + lambda_bar ** 2);
  const chi = Math.min(1.0, 1 / (phi + Math.sqrt(Math.max(phi ** 2 - lambda_bar ** 2, 0.001))));

  const Pd = (chi * Ag * fy) / (GAMMA_M0 * 1000); // kN
  const ratio = Pu / Pd;
  let status: "PASS" | "FAIL" | "WARNING" = ratio > 1 ? "FAIL" : ratio > 0.9 ? "WARNING" : "PASS";

  return {
    memberId: "", checkType: "Compression (IS 800)", capacity: Pd, demand: Pu, ratio, status,
    details: `Pd = ${Pd.toFixed(1)} kN, λ = ${KLr.toFixed(1)}, χ = ${chi.toFixed(3)}`,
    code: "IS 800:2007 Cl. 7",
  };
}

/** IS 800:2007 Cl. 8.2 — Flexure */
export function checkFlexureIS800(
  section: SectionProperties,
  material: Material,
  Mu: number,
  params: DesignParameters,
): DesignResult {
  const fy = material.fy || 250;
  const E = material.E;
  const Zp = section.Zx || 0;
  const Ze = section.Sx || 0;

  // Plastic moment capacity (Cl. 8.2.1.2)
  const Mp = (fy * Zp) / (GAMMA_M0 * 1e6); // kN·m
  const My = (fy * Ze) / (GAMMA_M0 * 1e6); // kN·m

  // LTB check (Cl. 8.2.2)
  const Lb = params.Lb;
  const ry = section.ry;
  const d = section.d || 300;
  const tf = section.tf || 10;
  const Iy = section.Iy || 1e6;
  const J = section.J || 1e4;
  const ho = d - tf;

  // Critical moment Mcr (Cl. 8.2.2.1)
  const hf = d - tf;
  const Mcr_numerator = Math.PI ** 2 * E * Iy * (1 + (1/20) * ((Lb * tf) / (ry * hf)) ** 2);
  const Mcr = Math.sqrt(Mcr_numerator) * Math.sqrt(J * GAMMA_M0) / (Lb ** 2 * 1e6) * 1e3;
  // Simplified: Mcr = (π²EIy/(Lb²)) × √(1 + (π²EIw/(GJLb²)))
  const Mcr_safe = Math.max(Mcr, Mp * 0.1); // Guard against near-zero

  // Non-dimensional slenderness
  const lambda_LT = Math.sqrt(My / Mcr_safe);

  // Imperfection factor for LTB (IS 800 Cl. 8.2.2)
  const alpha_LT = 0.21; // Rolled I-sections
  const phi_LT = 0.5 * (1 + alpha_LT * (lambda_LT - 0.2) + lambda_LT ** 2);
  const chi_LT = Math.min(1.0, 1 / (phi_LT + Math.sqrt(Math.max(phi_LT ** 2 - lambda_LT ** 2, 0.001))));

  const Md = chi_LT * My; // Design bending strength (limited by Mp)
  const Md_final = Math.min(Md, Mp);

  const ratio = Math.abs(Mu) / Md_final;
  let status: "PASS" | "FAIL" | "WARNING" = ratio > 1 ? "FAIL" : ratio > 0.9 ? "WARNING" : "PASS";
  const limitState = lambda_LT < 0.4 ? "Yielding" : "LTB";

  return {
    memberId: "", checkType: "Flexure (IS 800)", capacity: Md_final, demand: Math.abs(Mu), ratio, status,
    details: `Md = ${Md_final.toFixed(1)} kN·m (${limitState}), Mu = ${Math.abs(Mu).toFixed(1)} kN·m, λLT = ${lambda_LT.toFixed(3)}`,
    code: "IS 800:2007 Cl. 8.2",
  };
}

/** IS 800:2007 Cl. 8.4 — Shear */
export function checkShearIS800(
  section: SectionProperties,
  material: Material,
  Vu: number,
): DesignResult {
  const fy = material.fy || 250;
  const d = section.d || 300;
  const tw = section.tw || 8;
  const Av = d * tw; // Web area

  // Design shear strength (Cl. 8.4.1)
  const Vd = (fy * Av) / (Math.sqrt(3) * GAMMA_M0 * 1000); // kN

  const ratio = Math.abs(Vu) / Vd;
  let status: "PASS" | "FAIL" | "WARNING" = ratio > 1 ? "FAIL" : ratio > 0.9 ? "WARNING" : "PASS";

  return {
    memberId: "", checkType: "Shear (IS 800)", capacity: Vd, demand: Math.abs(Vu), ratio, status,
    details: `Vd = ${Vd.toFixed(1)} kN, Vu = ${Math.abs(Vu).toFixed(1)} kN`,
    code: "IS 800:2007 Cl. 8.4",
  };
}

/** IS 800:2007 Cl. 9.3 — Combined Axial + Bending */
export function checkCombinedIS800(
  section: SectionProperties,
  material: Material,
  forces: MemberForces,
  params: DesignParameters,
): DesignResult {
  const Pu = Math.abs(forces.axial);
  const Mux = Math.abs(forces.momentZ);
  const Muy = Math.abs(forces.momentY);

  // Get capacities
  let Pc: number;
  if (forces.axial < 0) {
    const compRes = checkCompressionIS800(section, material, Pu, params);
    Pc = compRes.capacity;
  } else {
    const tensRes = checkTensionIS800(section, material, Pu);
    Pc = tensRes.capacity;
  }

  const flexRes = checkFlexureIS800(section, material, Mux, params);
  const Mcx = flexRes.capacity;
  const Mcy = Mcx * 0.7; // Minor axis conservative estimate

  // IS 800 Cl. 9.3.1.1 — Interaction formula
  const ratio = Pu / Pc + (Mux / Mcx) + (Muy / Mcy);

  let status: "PASS" | "FAIL" | "WARNING" = ratio > 1 ? "FAIL" : ratio > 0.9 ? "WARNING" : "PASS";

  return {
    memberId: "", checkType: "Combined (IS 800)", capacity: 1.0, demand: ratio, ratio, status,
    details: `P/Pc = ${(Pu / Pc).toFixed(3)}, Mux/Mcx = ${(Mux / Mcx).toFixed(3)}, Muy/Mcy = ${(Muy / Mcy).toFixed(3)}`,
    code: "IS 800:2007 Cl. 9.3",
  };
}

/** Full IS 800 member check */
export function performIS800DesignCheck(
  memberId: string,
  section: SectionProperties,
  material: Material,
  forces: MemberForces,
  params: DesignParameters,
): SteelDesignResults {
  const results: SteelDesignResults = {
    memberId, section, material, forces,
    criticalRatio: 0, overallStatus: "PASS", governingCheck: "",
  };

  const allChecks: DesignResult[] = [];

  if (forces.axial > 0.1) {
    results.tensionCheck = checkTensionIS800(section, material, forces.axial);
    results.tensionCheck.memberId = memberId;
    allChecks.push(results.tensionCheck);
  } else if (forces.axial < -0.1) {
    results.compressionCheck = checkCompressionIS800(section, material, Math.abs(forces.axial), params);
    results.compressionCheck.memberId = memberId;
    allChecks.push(results.compressionCheck);
  }

  if (Math.abs(forces.momentZ) > 0.01) {
    results.flexureXCheck = checkFlexureIS800(section, material, forces.momentZ, params);
    results.flexureXCheck.memberId = memberId;
    allChecks.push(results.flexureXCheck);
  }

  if (Math.abs(forces.shearY) > 0.01) {
    results.shearVyCheck = checkShearIS800(section, material, forces.shearY);
    results.shearVyCheck.memberId = memberId;
    allChecks.push(results.shearVyCheck);
  }

  if (Math.abs(forces.axial) > 0.1 && Math.abs(forces.momentZ) > 0.01) {
    results.combinedCheck = checkCombinedIS800(section, material, forces, params);
    results.combinedCheck.memberId = memberId;
    allChecks.push(results.combinedCheck);
  }

  let maxRatio = 0;
  let governingCheck = "";
  for (const check of allChecks) {
    if (check.ratio > maxRatio) { maxRatio = check.ratio; governingCheck = check.checkType; }
    if (check.status === "FAIL") results.overallStatus = "FAIL";
    else if (check.status === "WARNING" && results.overallStatus !== "FAIL") results.overallStatus = "WARNING";
  }

  results.criticalRatio = maxRatio;
  results.governingCheck = governingCheck;
  return results;
}

export default {
  checkTension,
  checkCompression,
  checkFlexure,
  checkShear,
  checkCombined,
  performSteelDesignCheck,
  getSectionClassification,
  formatDesignResult,
  designSteelMembers,
  optimizeMember,
  // IS 800:2007
  checkTensionIS800,
  checkCompressionIS800,
  checkFlexureIS800,
  checkShearIS800,
  checkCombinedIS800,
  performIS800DesignCheck,
};
