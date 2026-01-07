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

import { SectionProperties, Material } from '../data/SectionDatabase';

// ============================================
// TYPES
// ============================================

export interface MemberForces {
    axial: number;      // kN (positive = tension, negative = compression)
    shearY: number;     // kN
    shearZ: number;     // kN
    momentY: number;    // kN-m (about Y-Y axis)
    momentZ: number;    // kN-m (about Z-Z axis)
    torsion?: number;   // kN-m
}

export interface DesignParameters {
    Lb: number;         // Unbraced length for lateral-torsional buckling (mm)
    Lx: number;         // Effective length for X-X buckling (mm)
    Ly: number;         // Effective length for Y-Y buckling (mm)
    Kx?: number;        // Effective length factor X-X (default 1.0)
    Ky?: number;        // Effective length factor Y-Y (default 1.0)
    Cb?: number;        // Lateral-torsional buckling modification factor (default 1.0)
    Cm?: number;        // Moment modification factor for combined forces
}

export interface DesignResult {
    memberId: string;
    checkType: string;
    capacity: number;
    demand: number;
    ratio: number;
    status: 'PASS' | 'FAIL' | 'WARNING';
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
    overallStatus: 'PASS' | 'FAIL' | 'WARNING';
    governingCheck: string;
}

// ============================================
// CONSTANTS
// ============================================

const PHI_TENSION = 0.90;       // LRFD resistance factor for tension
const PHI_COMPRESSION = 0.90;   // LRFD resistance factor for compression
const PHI_FLEXURE = 0.90;       // LRFD resistance factor for flexure
const PHI_SHEAR = 1.00;         // LRFD resistance factor for shear

// ============================================
// AISC 360-16 CHAPTER D - TENSION
// ============================================

export function checkTension(
    section: SectionProperties,
    material: Material,
    Pu: number,  // Required tensile strength (kN)
    An?: number  // Net area (mm²) - defaults to gross area
): DesignResult {
    const fy = material.fy || 250;  // MPa
    const fu = material.fu || 400;  // MPa
    const Ag = section.A;           // Gross area (mm²)
    const Ae = An || Ag;            // Effective net area

    // D2. Tensile strength
    // (a) For yielding in gross section: Pn = Fy * Ag
    const Pn_yield = (fy * Ag) / 1000;  // kN

    // (b) For rupture in net section: Pn = Fu * Ae
    const Pn_rupture = (fu * Ae) / 1000;  // kN

    // Design tensile strength
    const Phi_Pn_yield = PHI_TENSION * Pn_yield;
    const Phi_Pn_rupture = 0.75 * Pn_rupture;  // φ = 0.75 for rupture

    const Phi_Pn = Math.min(Phi_Pn_yield, Phi_Pn_rupture);
    const ratio = Pu / Phi_Pn;

    let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    if (ratio > 1.0) status = 'FAIL';
    else if (ratio > 0.9) status = 'WARNING';

    const governing = Phi_Pn_yield < Phi_Pn_rupture ? 'Yielding' : 'Rupture';

    return {
        memberId: '',
        checkType: 'Tension',
        capacity: Phi_Pn,
        demand: Pu,
        ratio,
        status,
        details: `φPn = ${Phi_Pn.toFixed(1)} kN (${governing}), Pu = ${Pu.toFixed(1)} kN`,
        code: 'AISC 360-16 Chapter D'
    };
}

// ============================================
// AISC 360-16 CHAPTER E - COMPRESSION
// ============================================

export function checkCompression(
    section: SectionProperties,
    material: Material,
    Pu: number,  // Required compressive strength (kN, positive value)
    params: DesignParameters
): DesignResult {
    const fy = material.fy || 250;  // MPa
    const E = material.E;           // MPa
    const Ag = section.A;           // mm²
    const rx = section.rx;          // mm
    const ry = section.ry;          // mm

    const Kx = params.Kx || 1.0;
    const Ky = params.Ky || 1.0;

    // Slenderness ratios
    const KLr_x = (Kx * params.Lx) / rx;
    const KLr_y = (Ky * params.Ly) / ry;
    const KLr = Math.max(KLr_x, KLr_y);

    // E3. Flexural Buckling
    const Fe = (Math.PI ** 2 * E) / (KLr ** 2);  // Elastic buckling stress

    let Fcr: number;

    if (KLr <= 4.71 * Math.sqrt(E / fy)) {
        // Inelastic buckling (E3-2)
        Fcr = fy * Math.pow(0.658, fy / Fe);
    } else {
        // Elastic buckling (E3-3)
        Fcr = 0.877 * Fe;
    }

    // Nominal compressive strength
    const Pn = (Fcr * Ag) / 1000;  // kN
    const Phi_Pn = PHI_COMPRESSION * Pn;

    const ratio = Pu / Phi_Pn;

    let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    if (ratio > 1.0) status = 'FAIL';
    else if (ratio > 0.9) status = 'WARNING';

    const bucklingType = KLr_x > KLr_y ? 'X-X axis' : 'Y-Y axis';

    return {
        memberId: '',
        checkType: 'Compression',
        capacity: Phi_Pn,
        demand: Pu,
        ratio,
        status,
        details: `φPn = ${Phi_Pn.toFixed(1)} kN, Pu = ${Pu.toFixed(1)} kN, KL/r = ${KLr.toFixed(1)} (${bucklingType})`,
        code: 'AISC 360-16 Chapter E'
    };
}

// ============================================
// AISC 360-16 CHAPTER F - FLEXURE
// ============================================

export function checkFlexure(
    section: SectionProperties,
    material: Material,
    Mu: number,  // Required flexural strength (kN-m)
    params: DesignParameters,
    axis: 'major' | 'minor' = 'major'
): DesignResult {
    const fy = material.fy || 250;  // MPa
    const E = material.E;           // MPa

    const Zx = section.Zx;  // Plastic section modulus X-X (mm³)
    const Zy = section.Zy;  // Plastic section modulus Y-Y (mm³)
    const Sx = section.Sx;  // Elastic section modulus X-X (mm³)
    const Sy = section.Sy;  // Elastic section modulus Y-Y (mm³)
    const ry = section.ry;  // Radius of gyration Y-Y (mm)
    const J = section.J || 0;    // Torsional constant (mm⁴)
    const Cw = section.Cw || 0;  // Warping constant (mm⁶)

    const Lb = params.Lb;   // Unbraced length (mm)
    const Cb = params.Cb || 1.0;

    let Mn: number;
    let limitState: string;

    if (axis === 'major') {
        // F2. Doubly Symmetric Compact I-Shaped Members
        const Mp = (fy * Zx) / 1e6;  // kN-m (plastic moment)

        // Limiting unbraced lengths
        const Lp = 1.76 * ry * Math.sqrt(E / fy);  // Plastic limit

        // Simplified Lr calculation
        const rts = Math.sqrt(Math.sqrt((section.Iy || section.Ix * 0.1) * Cw) / Sx);
        const c = 1.0;  // For doubly symmetric I-shapes
        const ho = (section.d || 300) - (section.tf || 10);  // Approximate
        const Lr = 1.95 * rts * (E / (0.7 * fy)) *
            Math.sqrt((J * c) / (Sx * ho) + Math.sqrt(Math.pow((J * c) / (Sx * ho), 2) + 6.76 * Math.pow(0.7 * fy / E, 2)));

        if (Lb <= Lp) {
            // (a) Yielding
            Mn = Mp;
            limitState = 'Yielding';
        } else if (Lb <= Lr) {
            // (b) Inelastic Lateral-Torsional Buckling
            const Mr = 0.7 * fy * Sx / 1e6;  // kN-m
            Mn = Cb * (Mp - (Mp - Mr) * (Lb - Lp) / (Lr - Lp));
            Mn = Math.min(Mn, Mp);
            limitState = 'Inelastic LTB';
        } else {
            // (c) Elastic Lateral-Torsional Buckling
            const Fcr = (Cb * Math.PI ** 2 * E) / (Lb / rts) ** 2 *
                Math.sqrt(1 + 0.078 * (J * c) / (Sx * ho) * (Lb / rts) ** 2);
            Mn = Fcr * Sx / 1e6;
            Mn = Math.min(Mn, Mp);
            limitState = 'Elastic LTB';
        }
    } else {
        // Minor axis bending - no LTB
        const Mp = (fy * Zy) / 1e6;  // kN-m
        Mn = Math.min(Mp, 1.6 * fy * Sy / 1e6);
        limitState = 'Yielding';
    }

    const Phi_Mn = PHI_FLEXURE * Mn;
    const ratio = Math.abs(Mu) / Phi_Mn;

    let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    if (ratio > 1.0) status = 'FAIL';
    else if (ratio > 0.9) status = 'WARNING';

    return {
        memberId: '',
        checkType: axis === 'major' ? 'Flexure (Major)' : 'Flexure (Minor)',
        capacity: Phi_Mn,
        demand: Math.abs(Mu),
        ratio,
        status,
        details: `φMn = ${Phi_Mn.toFixed(1)} kN-m (${limitState}), Mu = ${Math.abs(Mu).toFixed(1)} kN-m`,
        code: 'AISC 360-16 Chapter F'
    };
}

// ============================================
// AISC 360-16 CHAPTER G - SHEAR
// ============================================

export function checkShear(
    section: SectionProperties,
    material: Material,
    Vu: number  // Required shear strength (kN)
): DesignResult {
    const fy = material.fy || 250;  // MPa
    const E = material.E;           // MPa

    const d = section.d || 300;     // Depth (mm)
    const tw = section.tw || 8;     // Web thickness (mm)
    const Aw = d * tw;              // Web area (mm²)

    // Web slenderness
    const h = d - 2 * (section.tf || 10);
    const h_tw = h / tw;

    // Cv1 - Web shear coefficient
    let Cv1: number;
    const limit1 = 2.24 * Math.sqrt(E / fy);
    const limit2 = 1.10 * Math.sqrt(1.0 * E / fy);  // kv = 5.0 assumed

    if (h_tw <= limit1) {
        Cv1 = 1.0;
    } else if (h_tw <= limit2) {
        Cv1 = limit1 / h_tw;
    } else {
        Cv1 = 1.51 * E / (h_tw ** 2 * fy);
    }

    // Nominal shear strength
    const Vn = 0.6 * fy * Aw * Cv1 / 1000;  // kN
    const Phi_Vn = PHI_SHEAR * Vn;

    const ratio = Math.abs(Vu) / Phi_Vn;

    let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    if (ratio > 1.0) status = 'FAIL';
    else if (ratio > 0.9) status = 'WARNING';

    return {
        memberId: '',
        checkType: 'Shear',
        capacity: Phi_Vn,
        demand: Math.abs(Vu),
        ratio,
        status,
        details: `φVn = ${Phi_Vn.toFixed(1)} kN, Vu = ${Math.abs(Vu).toFixed(1)} kN, Cv1 = ${Cv1.toFixed(3)}`,
        code: 'AISC 360-16 Chapter G'
    };
}

// ============================================
// AISC 360-16 CHAPTER H - COMBINED FORCES
// ============================================

export function checkCombined(
    section: SectionProperties,
    material: Material,
    forces: MemberForces,
    params: DesignParameters
): DesignResult {
    const Pu = Math.abs(forces.axial);
    const Mux = Math.abs(forces.momentZ);  // Major axis moment
    const Muy = Math.abs(forces.momentY);  // Minor axis moment

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

    const flexMajor = checkFlexure(section, material, Mux, params, 'major');
    const flexMinor = checkFlexure(section, material, Muy, params, 'minor');
    const Mcx = flexMajor.capacity;
    const Mcy = flexMinor.capacity;

    // H1. Doubly and Singly Symmetric Members
    const Pr_Pc = Pu / Pc;

    let ratio: number;
    let equation: string;

    if (Pr_Pc >= 0.2) {
        // H1-1a: Pr/Pc + 8/9 * (Mrx/Mcx + Mry/Mcy) <= 1.0
        ratio = Pr_Pc + (8 / 9) * (Mux / Mcx + Muy / Mcy);
        equation = 'H1-1a';
    } else {
        // H1-1b: Pr/(2*Pc) + (Mrx/Mcx + Mry/Mcy) <= 1.0
        ratio = Pr_Pc / 2 + (Mux / Mcx + Muy / Mcy);
        equation = 'H1-1b';
    }

    let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    if (ratio > 1.0) status = 'FAIL';
    else if (ratio > 0.9) status = 'WARNING';

    return {
        memberId: '',
        checkType: 'Combined Forces',
        capacity: 1.0,
        demand: ratio,
        ratio,
        status,
        details: `Eq. ${equation}: Pu/Pc = ${Pr_Pc.toFixed(3)}, Mux/Mcx = ${(Mux / Mcx).toFixed(3)}, Muy/Mcy = ${(Muy / Mcy).toFixed(3)}`,
        code: 'AISC 360-16 Chapter H'
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
    params: DesignParameters
): SteelDesignResults {
    const results: SteelDesignResults = {
        memberId,
        section,
        material,
        forces,
        criticalRatio: 0,
        overallStatus: 'PASS',
        governingCheck: ''
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
        results.compressionCheck = checkCompression(section, material, Math.abs(forces.axial), params);
        results.compressionCheck.memberId = memberId;
        allChecks.push(results.compressionCheck);
    }

    // 2. Flexure checks
    if (Math.abs(forces.momentZ) > 0.01) {
        results.flexureXCheck = checkFlexure(section, material, forces.momentZ, params, 'major');
        results.flexureXCheck.memberId = memberId;
        allChecks.push(results.flexureXCheck);
    }

    if (Math.abs(forces.momentY) > 0.01) {
        results.flexureYCheck = checkFlexure(section, material, forces.momentY, params, 'minor');
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
    if ((Math.abs(forces.axial) > 0.1) &&
        (Math.abs(forces.momentZ) > 0.01 || Math.abs(forces.momentY) > 0.01)) {
        results.combinedCheck = checkCombined(section, material, forces, params);
        results.combinedCheck.memberId = memberId;
        allChecks.push(results.combinedCheck);
    }

    // Determine critical ratio and overall status
    let maxRatio = 0;
    let governingCheck = '';

    for (const check of allChecks) {
        if (check.ratio > maxRatio) {
            maxRatio = check.ratio;
            governingCheck = check.checkType;
        }
        if (check.status === 'FAIL') {
            results.overallStatus = 'FAIL';
        } else if (check.status === 'WARNING' && results.overallStatus !== 'FAIL') {
            results.overallStatus = 'WARNING';
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
    axialRatio: number = 0  // P/Py for web classification
): 'compact' | 'noncompact' | 'slender' {
    const fy = material.fy || 250;
    const E = material.E;

    const bf = section.bf || 100;
    const tf = section.tf || 8;
    const d = section.d || 300;
    const tw = section.tw || 6;

    // Flange slenderness
    const lambda_f = bf / (2 * tf);
    const lambda_pf = 0.38 * Math.sqrt(E / fy);
    const lambda_rf = 1.0 * Math.sqrt(E / fy);

    // Web slenderness
    const h = d - 2 * tf;
    const lambda_w = h / tw;
    const lambda_pw = 3.76 * Math.sqrt(E / fy);
    const lambda_rw = 5.70 * Math.sqrt(E / fy);

    // Classification
    if (lambda_f > lambda_rf || lambda_w > lambda_rw) {
        return 'slender';
    } else if (lambda_f > lambda_pf || lambda_w > lambda_pw) {
        return 'noncompact';
    }
    return 'compact';
}

export function formatDesignResult(result: DesignResult): string {
    const statusIcon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
    return `${statusIcon} ${result.checkType}: ${(result.ratio * 100).toFixed(1)}% (${result.status})`;
}


// ============================================
// API INTEGRATION
// ============================================

export async function designSteelMembers(members: SteelDesignResults[], code: 'AISC360' | 'IS800' = 'AISC360'): Promise<SteelDesignResults[]> {
    try {
        // Use Rust API for steel design (10x faster than Python)
        // Use Rust API for steel design (10x faster than Python)
        const RUST_API = import.meta.env.VITE_API_URL || 'https://beamlab-backend-node.azurewebsites.net';

        const payload = {
            members: members.map(m => ({
                id: m.memberId,
                code: code,
                grade: typeof m.material.name === 'string' ? m.material.name : 'E250',
                fy: m.material.fy || 250,
                fu: m.material.fu || 410,
                length: 1000, // Placeholder, should come from geometry
                effective_length_factor_y: 1.0,
                effective_length_factor_z: 1.0,
                section: {
                    area: m.section.A,
                    Ixx: m.section.Ixx,
                    Iyy: m.section.Iyy,
                    J: m.section.J || 0,
                    Zz: m.section.Zx, // Mapping Sx to Zz (Elastic)
                    Zy: m.section.Sy,
                    Zpz: m.section.Zx, // Mapping Zx to Zpz (Plastic - assumption for API mapping)
                    Zpy: m.section.Zy,
                    ry: m.section.ry,
                    rz: m.section.rx || 0, // Swap?
                    depth: m.section.d,
                    width: m.section.bf || m.section.b || 0,
                    tf: m.section.tf || 0,
                    tw: m.section.tw || 0
                },
                forces: m.forces
            }))
        };

        // Route to Rust AISC design endpoint (10x faster)
        const endpoint = code === 'AISC360' ? '/api/design/aisc' : '/api/design/is800';
        const response = await fetch(`${RUST_API}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.warn('Rust API design check failed, using local calculations');
            return members; // Fallback to local
        }

        const results = await response.json();

        // Merge API results back into local results structure
        return members.map(m => {
            const apiResult = results.find((r: any) => r.memberId === m.memberId);
            if (!apiResult) return m;

            // Map API checks to local structure
            return {
                ...m,
                overallStatus: apiResult.status?.toUpperCase() || m.overallStatus,
                criticalRatio: apiResult.overallRatio || m.criticalRatio
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
    }
): Promise<{ section: any; ratio: number; weight: number } | null> {
    const PYTHON_API = import.meta.env.VITE_PYTHON_API_URL || "https://beamlab-backend-python.azurewebsites.net";
    try {
        const response = await fetch(`${PYTHON_API}/design/optimize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                shape_type: shapeType,
                member_params: memberParams,
                forces
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (data.success) {
            return {
                section: data.optimal_section,
                ratio: data.ratio,
                weight: data.weight
            };
        }
        return null;
    } catch (e) {
        console.error("Optimization failed", e);
        return null;
    }
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
    optimizeMember
};

