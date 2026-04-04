/**
 * design.ts - Frontend API for Structural Design
 * 
 * Provides TypeScript interfaces and API calls for:
 * - Steel design (IS 800, AISC 360)
 * - Concrete design (IS 456)
 * - Connection design
 * - Foundation design
 * 
 * Now using high-performance Rust API for design checks
 */

import { apiClient } from '@/lib/api/client';
import { API_CONFIG } from '@/config/env';

// ============================================
// TYPES
// ============================================

export interface SectionProperties {
    name: string;
    area: number;           // mm²
    depth: number;          // mm
    width: number;          // mm
    webThickness: number;   // mm
    flangeThickness: number; // mm
    Iy: number;             // mm⁴
    Iz: number;             // mm⁴
    Zy?: number;            // mm³
    Zz?: number;            // mm³
    ry: number;             // mm
    rz: number;             // mm
}

export interface MemberGeometry {
    length: number;             // mm
    effectiveLengthY?: number;  // mm
    effectiveLengthZ?: number;  // mm
    unbracedLength?: number;    // mm
    Cb?: number;                // Moment gradient factor
}

export interface DesignForces {
    N: number;      // Axial force (kN)
    Vy: number;     // Shear Y (kN)
    Vz: number;     // Shear Z (kN)
    My: number;     // Moment Y (kNm)
    Mz: number;     // Moment Z (kNm)
}

export interface SteelMaterial {
    fy: number;     // Yield strength (MPa)
    fu: number;     // Ultimate strength (MPa)
    E?: number;     // Elastic modulus (MPa)
}

export interface SteelDesignRequest {
    code: 'IS800' | 'AISC360';
    section: SectionProperties;
    geometry: MemberGeometry;
    forces: DesignForces;
    material: SteelMaterial;
    designMethod?: 'LRFD' | 'ASD';
}

export interface SteelDesignResult {
    code: string;
    sectionClass?: string;
    method?: string;
    tensionCapacity: number;
    compressionCapacity: number;
    momentCapacity: number;
    shearCapacity: number;
    interactionRatio: number;
    status: 'PASS' | 'FAIL';
    checks: Array<{
        name: string;
        clause?: string;
        ratio: number;
        status?: string;
    }>;
}

export interface ConcreteBeamRequest {
    section: {
        width: number;
        depth: number;
        effectiveDepth: number;
        cover?: number;
    };
    forces: {
        Mu: number;     // kNm
        Vu: number;     // kN
    };
    material: {
        fck: number;    // MPa
        fy: number;     // MPa
    };
}

export interface ConcreteBeamResult {
    tensionSteel: {
        diameter: number;
        count: number;
        area: number;
    };
    compressionSteel?: {
        diameter: number;
        count: number;
        area: number;
    } | null;
    stirrups: {
        diameter: number;
        spacing: number;
    };
    MuCapacity: number;
    VuCapacity: number;
    status: 'PASS' | 'FAIL';
    checks: string[];
}

export interface ConcreteColumnRequest {
    section: {
        width: number;
        depth: number;
        cover?: number;
    };
    forces: {
        Pu: number;     // kN
        Mux: number;    // kNm
        Muy: number;    // kNm
    };
    geometry: {
        unsupportedLength: number;
        effectiveLengthFactor?: number;
    };
    material: {
        fck: number;
        fy: number;
    };
}

export interface ConcreteColumnResult {
    longitudinalSteel: Array<{
        diameter: number;
        count: number;
        area: number;
    }>;
    ties: {
        diameter: number;
        spacing: number;
    };
    PuCapacity: number;
    MuxCapacity: number;
    MuyCapacity: number;
    interactionRatio: number;
    status: 'PASS' | 'FAIL';
    checks: string[];
}

export interface ConnectionRequest {
    type: 'bolted_shear' | 'bolted_moment' | 'welded' | 'base_plate';
    forces: {
        shear?: number;
        tension?: number;
        moment?: number;
        axial?: number;
    };
    bolt?: {
        diameter: number;
        grade: string;
        numBolts?: number;
        rows?: number;
        columns?: number;
        pitch?: number;
        gauge?: number;
    };
    weld?: {
        size: number;
        length: number;
        type: 'fillet' | 'butt';
    };
    plate?: {
        thickness: number;
        fy: number;
        width?: number;
        length?: number;
    };
    material?: {
        fu: number;
        fy: number;
    };
}

export interface ConnectionResult {
    type: string;
    capacity: number;
    demand: number;
    ratio: number;
    status: 'PASS' | 'FAIL';
    checks: string[];
}

export interface FootingRequest {
    type: 'isolated' | 'combined' | 'mat';
    loads: Array<{
        P: number;
        Mx?: number;
        My?: number;
        x?: number;
        y?: number;
    }>;
    columnSize: {
        width: number;
        depth: number;
    };
    soil: {
        bearingCapacity: number;
        soilType?: string;
    };
    material: {
        fck: number;
        fy: number;
    };
    minDepth?: number;
}

export interface FootingResult {
    type: string;
    dimensions: {
        length: number;
        width: number;
        depth?: number;
        thickness?: number;
    };
    reinforcement: Record<string, string | number>;
    bearingRatio: number;
    punchingRatio: number;
    shearRatio?: number;
    flexureRatio: number;
    status: 'PASS' | 'FAIL';
    checks: string[];
}

// ============================================
// API FUNCTIONS
// ============================================

async function apiCall<T>(endpoint: string, data: unknown): Promise<T> {
    const { data: response } = await apiClient.post<{ success?: boolean; result?: T; error?: string }>(
        endpoint,
        data
    );

    if (response?.success === false) {
        throw new Error(response.error || 'Design failed');
    }

    if (response?.result !== undefined) {
        return response.result;
    }

    // Fallback: if backend returns raw data without wrapper
    return response as unknown as T;
}

/**
 * Design steel member per IS 800:2007 / AISC360.
 * Routed through Node gateway `/api/design/*` (Rust-first, Python fallback).
 */
export async function designSteelMember(
    request: SteelDesignRequest
): Promise<SteelDesignResult> {
    const payload = {
        section_name: request.section.name,
        depth: request.section.depth,
        width: request.section.width,
        web_thickness: request.section.webThickness,
        flange_thickness: request.section.flangeThickness,
        root_radius: 0,
        area: request.section.area,
        Iz: request.section.Iz,
        Iy: request.section.Iy,
        Zz: request.section.Zz ?? 0,
        Zy: request.section.Zy ?? 0,
        rz: request.section.rz,
        ry: request.section.ry,
        length: request.geometry.length,
        effective_length_y: request.geometry.effectiveLengthY ?? request.geometry.length,
        effective_length_z: request.geometry.effectiveLengthZ ?? request.geometry.length,
        unbraced_length: request.geometry.unbracedLength ?? request.geometry.length,
        Cb: request.geometry.Cb ?? 1.0,
        N: request.forces.N,
        Vy: request.forces.Vy,
        Vz: request.forces.Vz,
        My: request.forces.My,
        Mz: request.forces.Mz,
        T: 0,
        steel_grade: 'E250',
        fy: request.material.fy,
        fu: request.material.fu,
        E: request.material.E ?? 200000
    };
    const result = await apiCall<Record<string, unknown>>('/api/design/steel', payload);

    const capacities = (result.capacities as {
        tension_kN?: number;
        compression_kN?: number;
        moment_major_kNm?: number;
        shear_kN?: number;
    } | undefined) || {};

    const checksRaw = Array.isArray(result.checks) ? result.checks : [];
    const rustPassed = typeof result.passed === 'boolean' ? result.passed : undefined;
    const rustUtil = typeof result.utilization === 'number' ? result.utilization : undefined;
    const pyStatus = typeof result.overall_status === 'string' ? result.overall_status : undefined;

    return {
        code: request.code === 'AISC360' ? 'AISC 360' : 'IS 800:2007',
        sectionClass: (result.section_class as string | undefined) || undefined,
        method: (result.method as string | undefined) || 'LRFD',
        tensionCapacity: capacities.tension_kN ?? (result.tension_capacity as number | undefined) ?? 0,
        compressionCapacity: capacities.compression_kN ?? (result.compression_capacity as number | undefined) ?? 0,
        momentCapacity: capacities.moment_major_kNm ?? (result.moment_capacity as number | undefined) ?? 0,
        shearCapacity: capacities.shear_kN ?? (result.shear_capacity as number | undefined) ?? 0,
        interactionRatio:
            (result.governing_ratio as number | undefined) ??
            (result.interaction_ratio as number | undefined) ??
            rustUtil ??
            0,
        status:
            pyStatus
                ? (pyStatus === 'PASS' ? 'PASS' : 'FAIL')
                : (rustPassed ? 'PASS' : 'FAIL'),
        checks: checksRaw.map((c) => {
            const cc = c as Record<string, unknown>;
            return {
                name: String(cc.name || 'check'),
                clause: typeof cc.clause === 'string' ? cc.clause : undefined,
                ratio: typeof cc.ratio === 'number' ? cc.ratio : (typeof cc.utilization === 'number' ? cc.utilization : 0),
                status: typeof cc.status === 'string' ? cc.status : undefined,
            };
        }),
    };
}

/**
 * Design concrete beam per IS 456 (via Node gateway, Rust-first).
 */
export async function designConcreteBeam(
    request: ConcreteBeamRequest
): Promise<ConcreteBeamResult> {
    const result = await apiCall<Record<string, unknown>>('/api/design/concrete/beam', {
        section: request.section,
        forces: request.forces,
        material: request.material,
    });

    const tensionSteel = (result.tension_steel as { diameter: number; count: number; area: number } | undefined)
        || (result.tensionSteel as { diameter: number; count: number; area: number } | undefined)
        || { diameter: 16, count: 0, area: 0 };
    const compressionSteel =
        (result.compression_steel as { diameter: number; count: number; area: number } | null | undefined)
        ?? (result.compressionSteel as { diameter: number; count: number; area: number } | null | undefined)
        ?? null;
    const stirrups = (result.stirrups as { diameter: number; spacing: number } | undefined)
        || { diameter: 8, spacing: 0 };

    return {
        tensionSteel,
        compressionSteel,
        stirrups,
        MuCapacity: (result.Mu_capacity as number | undefined) ?? (result.MuCapacity as number | undefined) ?? 0,
        VuCapacity: (result.Vu_capacity as number | undefined) ?? (result.VuCapacity as number | undefined) ?? 0,
        status:
            (typeof result.status === 'string' && result.status === 'PASS') || result.passed === true
                ? 'PASS'
                : 'FAIL',
        checks: Array.isArray(result.checks) ? (result.checks as string[]) : [],
    };
}

/**
 * Design concrete column per IS 456 (via Node gateway, Rust-first).
 */
export async function designConcreteColumn(
    request: ConcreteColumnRequest
): Promise<ConcreteColumnResult> {
    const result = await apiCall<Record<string, unknown>>('/api/design/concrete/column', {
        section: request.section,
        forces: request.forces,
        geometry: request.geometry,
        material: request.material,
    });

    const longitudinalSteel =
        (result.longitudinal_steel as Array<{ diameter: number; count: number; area: number }> | undefined)
        ?? (result.longitudinalSteel as Array<{ diameter: number; count: number; area: number }> | undefined)
        ?? [];
    const ties = (result.ties as { diameter: number; spacing: number } | undefined) || { diameter: 8, spacing: 0 };

    return {
        longitudinalSteel,
        ties,
        PuCapacity: (result.Pu_capacity as number | undefined) ?? (result.PuCapacity as number | undefined) ?? 0,
        MuxCapacity: (result.Mux_capacity as number | undefined) ?? (result.MuxCapacity as number | undefined) ?? 0,
        MuyCapacity: (result.Muy_capacity as number | undefined) ?? (result.MuyCapacity as number | undefined) ?? 0,
        interactionRatio: (result.interaction_ratio as number | undefined) ?? (result.utilization as number | undefined) ?? 0,
        status:
            (typeof result.status === 'string' && result.status === 'PASS') || result.passed === true
                ? 'PASS'
                : 'FAIL',
        checks: Array.isArray(result.checks) ? (result.checks as string[]) : [],
    };
}

/** Design steel connection via Node gateway (Rust-first, Python fallback). */
export async function designConnection(
    request: ConnectionRequest
): Promise<ConnectionResult> {
    return apiCall<ConnectionResult>('/api/design/connection', request);
}

/**
 * Design foundation via Node gateway (currently Python-backed behind gateway).
 */
export async function designFoundation(
    request: FootingRequest
): Promise<FootingResult> {
    return apiCall<FootingResult>('/api/design/foundation', request);
}

/**
 * Get available design codes
 */
export async function getDesignCodes(): Promise<{
    steel: Array<{ code: string; name: string; country: string }>;
    concrete: Array<{ code: string; name: string; country: string }>;
    connections: Array<{ code: string; name: string; country: string }>;
    foundations: Array<{ code: string; name: string; country: string }>;
}> {
    const { data } = await apiClient.get<{
        success: boolean;
        codes: {
            steel: Array<{ code: string; name: string; country: string }>;
            concrete: Array<{ code: string; name: string; country: string }>;
            connections: Array<{ code: string; name: string; country: string }>;
            foundations: Array<{ code: string; name: string; country: string }>;
        }
    }>(`${API_CONFIG.baseUrl}/api/design/codes`);

    return data.codes;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create section properties from standard database values
 */
export function createSectionFromDatabase(
    name: string,
    dbSection: {
        D: number;      // Depth
        B: number;      // Width
        tw: number;     // Web thickness
        tf: number;     // Flange thickness
        A: number;      // Area
        Iy: number;     // Moment of inertia Y
        Iz: number;     // Moment of inertia Z
        ry: number;     // Radius of gyration Y
        rz: number;     // Radius of gyration Z
        Zy?: number;    // Plastic modulus Y
        Zz?: number;    // Plastic modulus Z
    }
): SectionProperties {
    return {
        name,
        area: dbSection.A,
        depth: dbSection.D,
        width: dbSection.B,
        webThickness: dbSection.tw,
        flangeThickness: dbSection.tf,
        Iy: dbSection.Iy,
        Iz: dbSection.Iz,
        ry: dbSection.ry,
        rz: dbSection.rz,
        Zy: dbSection.Zy || dbSection.Iy / (dbSection.D / 2),
        Zz: dbSection.Zz || dbSection.Iz / (dbSection.B / 2),
    };
}

/**
 * Get standard steel grades
 */
/**
 * Get standard steel grades
 */
export const STEEL_GRADES = [
    { name: 'Fe250', fy: 250, fu: 410 },
    { name: 'Fe345', fy: 345, fu: 450 },
    { name: 'Fe410', fy: 410, fu: 490 },
    { name: 'Fe440', fy: 440, fu: 520 },
    { name: 'Fe490', fy: 490, fu: 570 },
    { name: 'Fe540', fy: 540, fu: 620 },
    { name: 'A36', fy: 250, fu: 400 },      // ASTM A36
    { name: 'A572-50', fy: 345, fu: 450 },  // ASTM A572 Grade 50
    { name: 'A992', fy: 345, fu: 450 },     // ASTM A992
];

/**
 * Get standard concrete grades
 */
export const CONCRETE_GRADES = [
    { name: 'M15', fck: 15 },
    { name: 'M20', fck: 20 },
    { name: 'M25', fck: 25 },
    { name: 'M30', fck: 30 },
    { name: 'M35', fck: 35 },
    { name: 'M40', fck: 40 },
    { name: 'M45', fck: 45 },
    { name: 'M50', fck: 50 },
];

/**
 * Get standard rebar grades
 */
export const REBAR_GRADES = [
    { name: 'Fe250', fy: 250 },
    { name: 'Fe415', fy: 415 },
    { name: 'Fe500', fy: 500 },
    { name: 'Fe550', fy: 550 },
    { name: 'Fe600', fy: 600 },
];

/**
 * Get bolt grades
 */
export const BOLT_GRADES = [
    { name: '4.6', fub: 400, fyb: 240 },
    { name: '4.8', fub: 400, fyb: 320 },
    { name: '5.6', fub: 500, fyb: 300 },
    { name: '5.8', fub: 500, fyb: 400 },
    { name: '6.8', fub: 600, fyb: 480 },
    { name: '8.8', fub: 800, fyb: 640 },
    { name: '10.9', fub: 1000, fyb: 900 },
    { name: '12.9', fub: 1200, fyb: 1080 },
];

// ============================================
// PYTHON API DESIGN FUNCTIONS (IS 456:2000)
// ============================================

const PYTHON_API = API_CONFIG.pythonUrl;

async function pythonApiCall<T>(endpoint: string, payload: unknown): Promise<T> {
    const normalizedBase = PYTHON_API.endsWith('/') ? PYTHON_API.slice(0, -1) : PYTHON_API;
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullUrl = `${normalizedBase}${normalizedEndpoint}`;

    const { data } = await apiClient.post<T>(fullUrl, payload);
    return data;
}

/**
 * Design RC beam per IS 456:2000 using Python backend
 */
// Section-wise design types
export interface SectionCheck {
    location: string;
    x_ratio: number;
    Mu_capacity: number;
    Vu_capacity: number;
    Ast_bottom: number;
    Ast_top: number;
    stirrup_spacing: number;
    utilization_M: number;
    utilization_V: number;
    status: string;
}

export interface RebarZone {
    x_start: number;
    x_end: number;
    bottom_bars: string;
    top_bars: string;
    stirrup_spec: string;
    Ast_bottom: number;
    note: string;
}

export interface CurtailmentPoint {
    x: number;
    description: string;
    Ld_required: number;
    Ld_available: number;
    is_valid: boolean;
    clause: string;
}

export interface SectionWiseResult {
    n_sections: number;
    is_safe_everywhere: boolean;
    economy_ratio: number;
    summary: string;
    engineering_notes: string[];
    section_checks: SectionCheck[];
    rebar_zones: RebarZone[];
    curtailment_points: CurtailmentPoint[];
    critical_section: {
        location: string;
        utilization_M: number;
        utilization_V: number;
        Ast_bottom: number;
    };
}

export async function designBeamIS456(params: {
    width: number;          // mm
    depth: number;          // mm
    cover?: number;         // mm (default 40)
    Mu: number;             // kNm - Design moment (SIGNED: +sagging, -hogging)
    Vu: number;             // kN - Design shear
    Tu?: number;            // kNm - Torsion (IS 456 Cl. 41)
    stirrup_dia?: number;   // mm - Stirrup diameter (default 8)
    main_bar_dia?: number;  // mm - Main bar diameter (default 16)
    code?: string;          // Design code (default 'IS456')
    fck?: number;           // MPa (default 25)
    fy?: number;            // MPa (default 500)
    // Section-wise design parameters
    span?: number;          // mm - if > 0, enables section-wise design
    w_factored?: number;    // kN/m - factored UDL for demand envelope
    support_condition?: string; // 'simple', 'fixed-fixed', 'propped', 'cantilever'
    n_sections?: number;    // Number of check sections (default 11)
    section_forces?: Array<{ x: number; Mu: number; Vu: number }>; // Custom force array
}): Promise<{
    success: boolean;
    design_approach: 'single_section' | 'section_wise';
    tension_steel: { diameter: number; count: number; area: number };
    compression_steel?: { diameter: number; count: number; area: number } | null;
    stirrups: { diameter: number; legs: number; spacing: number };
    Mu_capacity: number;
    Vu_capacity: number;
    status: string;
    checks: string[];
    // Section-wise results (only present when span > 0)
    section_wise?: SectionWiseResult;
    // Effective depth & torsion results
    effective_depth?: number;
    effective_depth_formula?: string;
    torsion?: {
        Tu: number;
        Me: number;
        Ve: number;
        is_significant: boolean;
        clause: string;
    };
    // Sign convention fields
    moment_type?: string;
    reinforcement_note?: string;
    sign_convention?: string;
    demand?: { Mu: number; Mu_signed: number; Vu: number; Vu_signed: number };
    moment_analysis?: { bottom_main: number; top_main: number; notes: string };
}> {
    const body: Record<string, unknown> = {
        width: params.width,
        depth: params.depth,
        cover: params.cover ?? 40,
        Mu: params.Mu,
        Vu: params.Vu,
        Tu: params.Tu ?? 0,
        stirrup_dia: params.stirrup_dia ?? 8,
        main_bar_dia: params.main_bar_dia ?? 16,
        code: params.code ?? 'IS456',
        fck: params.fck ?? 25,
        fy: params.fy ?? 500
    };
    // Add section-wise parameters if provided
    if (params.span && params.span > 0) {
        body.span = params.span;
        if (params.w_factored) body.w_factored = params.w_factored;
        if (params.support_condition) body.support_condition = params.support_condition;
        if (params.n_sections) body.n_sections = params.n_sections;
        if (params.section_forces) body.section_forces = params.section_forces;
    }
    return pythonApiCall('/design/beam', body);
}

/**
 * Design RC column per IS 456:2000 using Python backend
 */
export async function designColumnIS456(params: {
    width: number;          // mm
    depth: number;          // mm
    cover?: number;         // mm (default 40)
    Pu: number;             // kN - Axial load
    Mux?: number;           // kNm - Moment about x-axis (SIGNED)
    Muy?: number;           // kNm - Moment about y-axis (SIGNED)
    unsupported_length: number;  // mm
    effective_length_factor?: number;
    code?: string;          // Design code
    fck?: number;
    fy?: number;
    // Section-wise column checking
    Mux_top?: number;       // Top moment about x-axis (kNm)
    Mux_bottom?: number;    // Bottom moment about x-axis (kNm)
    Muy_top?: number;
    Muy_bottom?: number;
    n_sections?: number;    // Default 5
}): Promise<{
    success: boolean;
    design_approach: 'single_section' | 'section_wise';
    longitudinal_steel: Array<{ diameter: number; count: number; area: number }>;
    ties: { diameter: number; spacing: number };
    Pu_capacity: number;
    Mux_capacity: number;
    Muy_capacity: number;
    interaction_ratio: number;
    status: string;
    checks: string[];
    // Section-wise column checking results
    section_wise?: {
        n_sections: number;
        section_checks: Array<{
            location: string;
            height_ratio: number;
            Mux: number;
            Muy: number;
            Pu: number;
            interaction_ratio: number;
            status: string;
            Ast_required: number;
        }>;
        governing_section: {
            location: string;
            interaction_ratio: number;
            status: string;
        };
        is_safe_everywhere: boolean;
        summary: string;
        engineering_notes: string[];
    };
}> {
    const body: Record<string, unknown> = {
        width: params.width,
        depth: params.depth,
        cover: params.cover ?? 40,
        Pu: params.Pu,
        Mux: params.Mux ?? 0,
        Muy: params.Muy ?? 0,
        unsupported_length: params.unsupported_length,
        effective_length_factor: params.effective_length_factor ?? 1.0,
        code: params.code ?? 'IS456',
        fck: params.fck ?? 25,
        fy: params.fy ?? 500
    };
    // Add section-wise parameters if provided
    if (params.Mux_top !== undefined && params.Mux_bottom !== undefined) {
        body.Mux_top = params.Mux_top;
        body.Mux_bottom = params.Mux_bottom;
        if (params.Muy_top !== undefined) body.Muy_top = params.Muy_top;
        if (params.Muy_bottom !== undefined) body.Muy_bottom = params.Muy_bottom;
        if (params.n_sections) body.n_sections = params.n_sections;
    }
    return pythonApiCall('/design/column', body);
}

/**
 * Design RC slab per IS 456:2000 using Python backend
 */
export async function designSlabIS456(params: {
    lx: number;             // m - Shorter span
    ly?: number;            // m - Longer span (0 or omit for one-way)
    live_load: number;      // kN/m²
    floor_finish?: number;  // kN/m² (default 1.0)
    support_type?: string;  // 'simple', 'continuous', 'cantilever'
    edge_conditions?: string; // 'all_simple', 'all_continuous', 'interior', 'corner'
    fck?: number;
    fy?: number;
}): Promise<{
    success: boolean;
    thickness: number;
    main_reinforcement: { diameter: number; spacing: number; area_per_m: number; direction: string };
    distribution_reinforcement: { diameter: number; spacing: number; area_per_m: number; direction: string };
    top_reinforcement?: { diameter: number; spacing: number; area_per_m: number } | null;
    Mu_capacity: number;
    Mu_demand: number;
    deflection_check: number;
    deflection_limit: number;
    status: string;
    checks: string[];
}> {
    return pythonApiCall('/design/slab', {
        lx: params.lx,
        ly: params.ly ?? 0,
        live_load: params.live_load,
        floor_finish: params.floor_finish ?? 1.0,
        support_type: params.support_type ?? 'simple',
        edge_conditions: params.edge_conditions ?? 'all_simple',
        fck: params.fck ?? 25,
        fy: params.fy ?? 500
    });
}

/**
 * Auto-design member based on analysis results
 * Takes max moment and shear from analysis and designs appropriate section
 */
export async function autoDesignMember(
    memberId: string,
    memberType: 'beam' | 'column' | 'slab',
    forces: {
        maxMoment: number;  // kNm
        maxShear: number;   // kN
        axialLoad?: number; // kN (for columns)
        length: number;     // mm
    },
    section?: {
        width: number;      // mm
        depth: number;      // mm
    },
    material?: {
        fck: number;
        fy: number;
    }
): Promise<{
    memberId: string;
    memberType: string;
    design: unknown;
    status: string;
}> {
    const fck = material?.fck ?? 25;
    const fy = material?.fy ?? 500;

    // Default section sizes based on member type
    const width = section?.width ?? (memberType === 'column' ? 400 : 300);
    const depth = section?.depth ?? (memberType === 'column' ? 400 : 500);

    try {
        let design;

        if (memberType === 'beam') {
            design = await designBeamIS456({
                width,
                depth,
                Mu: forces.maxMoment,
                Vu: forces.maxShear,
                fck,
                fy
            });
        } else if (memberType === 'column') {
            design = await designColumnIS456({
                width,
                depth,
                Pu: forces.axialLoad ?? 0,
                Mux: forces.maxMoment,
                unsupported_length: forces.length,
                fck,
                fy
            });
        } else {
            // Slab - convert forces to per-meter basis
            const span = forces.length / 1000; // Convert to m
            design = await designSlabIS456({
                lx: span,
                live_load: 3,  // Assume 3 kN/m² live load
                fck,
                fy
            });
        }

        return {
            memberId,
            memberType,
            design,
            status: (design as { status: string }).status
        };
    } catch (error) {
        return {
            memberId,
            memberType,
            design: null,
            status: 'ERROR: ' + (error instanceof Error ? error.message : 'Unknown error')
        };
    }
}

// ============================================
// SECTION-WISE FROM ANALYSIS (Rust API)
// ============================================

const RUST_API = API_CONFIG.rustUrl;

async function rustApiCall<T>(endpoint: string, payload: unknown): Promise<T> {
    const normalizedBase = RUST_API.endsWith('/') ? RUST_API.slice(0, -1) : RUST_API;
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullUrl = `${normalizedBase}${normalizedEndpoint}`;

    const { data } = await apiClient.post<T>(fullUrl, payload);
    return data;
}

/** Member end forces for a single load combination */
export interface MemberForcesInput {
    member_id: string;
    start_node: string;
    end_node: string;
    /** Member length in mm */
    length: number;
    /** [fx, fy, fz, mx, my, mz] at start in N / N·mm */
    forces_start: [number, number, number, number, number, number];
    /** [fx, fy, fz, mx, my, mz] at end in N / N·mm */
    forces_end: [number, number, number, number, number, number];
    displacements_start?: [number, number, number, number, number, number];
    displacements_end?: [number, number, number, number, number, number];
    /** Distributed load wy (N/mm, local Y) */
    dist_load_wy?: number;
    /** Distributed load wz (N/mm, local Z) */
    dist_load_wz?: number;
}

/** Request to design from raw analysis forces (Rust section-wise) */
export interface FromAnalysisRequest {
    material: 'rc' | 'steel';
    /** One entry = single combo; multiple = envelope */
    member_forces: MemberForcesInput[];
    // RC-specific
    b?: number;             // mm
    d?: number;             // mm
    cover?: number;         // mm
    fck?: number;           // MPa
    fy?: number;            // MPa
    // Steel-specific
    section_name?: string;
    section?: SteelSectionInput;
    steel_fy?: number;      // MPa
    design_code?: 'is800' | 'aisc360';
    unbraced_length?: number; // mm
    is_rolled?: boolean;
}

export interface SteelSectionInput {
    depth: number;
    width: number;
    tf: number;
    tw: number;
    area: number;
    iy: number;
    iz: number;
    zy: number;
    zz: number;
    ry: number;
    rz: number;
}

/** Section-wise design result from the Rust API */
export type FromAnalysisResult =
    | { material: 'rc'; demands_extracted: number; member_id: string; span_mm: number; result: SectionWiseResult }
    | { material: 'steel'; demands_extracted: number; member_id: string; span_mm: number; result: SteelSectionWiseResult };

/** Steel section-wise result (matches Rust SteelSectionWiseResult) */
export interface SteelSectionWiseResult {
    passed: boolean;
    utilization: number;
    message: string;
    n_sections: number;
    section_checks: SteelStationCheck[];
    stiffener_zones: StiffenerZone[];
    design_code: string;
    section_name: string;
    section_class: string;
    cb: number;
}

export interface SteelStationCheck {
    location: { x_mm: number; x_ratio: number; label: string };
    mu_demand_knm: number;
    vu_demand_kn: number;
    mp_knm: number;
    md_knm: number;
    utilization_m: number;
    mcr_knm: number;
    lambda_lt: number;
    chi_lt: number;
    vd_kn: number;
    utilization_v: number;
    high_shear: boolean;
    mdv_knm: number;
    section_class: string;
    moment_type: string;
    passed: boolean;
    governing_check: string;
}

export interface StiffenerZone {
    x_start_mm: number;
    x_end_mm: number;
    max_shear_kn: number;
    shear_capacity_kn: number;
    reason: string;
}

/**
 * Design a member section-wise from raw analysis end-forces.
 *
 * Calls the Rust API — auto-extracts SFD/BMD at 21 stations,
 * computes envelope if multiple load combos, then runs section-wise design.
 */
export async function designSectionWiseFromAnalysis(
    request: FromAnalysisRequest
): Promise<FromAnalysisResult> {
    return rustApiCall<FromAnalysisResult>(
        '/api/design/section-wise/from-analysis',
        request
    );
}
