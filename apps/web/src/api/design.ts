/**
 * design.ts - Frontend API for Structural Design
 * 
 * Provides TypeScript interfaces and API calls for:
 * - Steel design (IS 800, AISC 360)
 * - Concrete design (IS 456)
 * - Connection design
 * - Foundation design
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

async function apiCall<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Design request failed');
    }

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'Design failed');
    }

    return result.result;
}

/**
 * Design steel member per IS 800 or AISC 360
 */
export async function designSteelMember(
    request: SteelDesignRequest
): Promise<SteelDesignResult> {
    return apiCall<SteelDesignResult>('/api/design/steel', request);
}

/**
 * Design concrete beam per IS 456
 */
export async function designConcreteBeam(
    request: ConcreteBeamRequest
): Promise<ConcreteBeamResult> {
    return apiCall<ConcreteBeamResult>('/api/design/concrete/beam', request);
}

/**
 * Design concrete column per IS 456
 */
export async function designConcreteColumn(
    request: ConcreteColumnRequest
): Promise<ConcreteColumnResult> {
    return apiCall<ConcreteColumnResult>('/api/design/concrete/column', request);
}

/**
 * Design steel connection
 */
export async function designConnection(
    request: ConnectionRequest
): Promise<ConnectionResult> {
    return apiCall<ConnectionResult>('/api/design/connection', request);
}

/**
 * Design foundation
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
    const response = await fetch(`${API_BASE}/api/design/codes`);
    const result = await response.json();
    return result.codes;
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
export const STEEL_GRADES = {
    'Fe250': { fy: 250, fu: 410 },
    'Fe345': { fy: 345, fu: 450 },
    'Fe410': { fy: 410, fu: 490 },
    'Fe440': { fy: 440, fu: 520 },
    'Fe490': { fy: 490, fu: 570 },
    'Fe540': { fy: 540, fu: 620 },
    'A36': { fy: 250, fu: 400 },      // ASTM A36
    'A572-50': { fy: 345, fu: 450 },  // ASTM A572 Grade 50
    'A992': { fy: 345, fu: 450 },     // ASTM A992
};

/**
 * Get standard concrete grades
 */
export const CONCRETE_GRADES = {
    'M15': { fck: 15 },
    'M20': { fck: 20 },
    'M25': { fck: 25 },
    'M30': { fck: 30 },
    'M35': { fck: 35 },
    'M40': { fck: 40 },
    'M45': { fck: 45 },
    'M50': { fck: 50 },
};

/**
 * Get standard rebar grades
 */
export const REBAR_GRADES = {
    'Fe250': { fy: 250 },
    'Fe415': { fy: 415 },
    'Fe500': { fy: 500 },
    'Fe550': { fy: 550 },
    'Fe600': { fy: 600 },
};

/**
 * Get bolt grades
 */
export const BOLT_GRADES = {
    '4.6': { fub: 400, fyb: 240 },
    '4.8': { fub: 400, fyb: 320 },
    '5.6': { fub: 500, fyb: 300 },
    '5.8': { fub: 500, fyb: 400 },
    '6.8': { fub: 600, fyb: 480 },
    '8.8': { fub: 800, fyb: 640 },
    '10.9': { fub: 1000, fyb: 900 },
    '12.9': { fub: 1200, fyb: 1080 },
};
