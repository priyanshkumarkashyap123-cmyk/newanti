/**
 * advancedAnalysis.ts - Frontend API for Advanced Structural Analysis
 * 
 * Provides TypeScript interfaces and API calls for:
 * - P-Delta analysis
 * - Modal analysis
 * - Response spectrum analysis
 * - Buckling analysis
 * - Cable analysis
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============================================
// COMMON TYPES
// ============================================

export interface NodeInput {
    id: number;
    x: number;
    y: number;
    z: number;
}

export interface MemberInput {
    id: number;
    startNode: number;
    endNode: number;
    E: number;          // MPa
    A: number;          // mm²
    I: number;          // mm⁴
    J?: number;         // mm⁴ (torsional)
    behavior?: 'normal' | 'tension_only' | 'compression_only' | 'cable';
}

export interface SupportInput {
    nodeId: number;
    fx: boolean;
    fy: boolean;
    fz: boolean;
    mx?: boolean;
    my?: boolean;
    mz?: boolean;
}

export interface NodalLoadInput {
    nodeId: number;
    fx?: number;
    fy?: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
}

export interface MassInput {
    nodeId: number;
    mass: number;       // kg
}

// ============================================
// P-DELTA ANALYSIS
// ============================================

export interface PDeltaRequest {
    nodes: NodeInput[];
    members: MemberInput[];
    supports: SupportInput[];
    loads: NodalLoadInput[];
    options?: {
        maxIterations?: number;
        tolerance?: number;
    };
}

export interface PDeltaResult {
    converged: boolean;
    iterations: number;
    amplificationFactor: number;
    maxDisplacement: number;
    convergenceHistory: number[];
    displacements?: Record<number, { dx: number; dy: number; dz: number }>;
    memberForces?: Record<number, { axial: number; moment: number }>;
}

/**
 * Run P-Delta (geometric nonlinear) analysis
 */
export async function runPDeltaAnalysis(
    request: PDeltaRequest
): Promise<PDeltaResult> {
    const response = await fetch(`${API_BASE}/api/advanced/pdelta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'P-Delta analysis failed');
    }

    return response.json();
}

// ============================================
// MODAL ANALYSIS
// ============================================

export interface ModalRequest {
    nodes: NodeInput[];
    members: MemberInput[];
    supports: SupportInput[];
    masses?: MassInput[];
    numModes?: number;
    massType?: 'lumped' | 'consistent';
}

export interface ModeShape {
    modeNumber: number;
    frequency: number;          // Hz
    period: number;             // seconds
    participationFactorX: number;
    participationFactorY: number;
    participationFactorZ: number;
    effectiveMassX: number;
    effectiveMassY: number;
    effectiveMassZ: number;
    modeShape?: Record<number, { dx: number; dy: number; dz: number }>;
}

export interface ModalResult {
    numModes: number;
    modes: ModeShape[];
    totalMass?: number;
    cumulativeMassX?: number[];
    cumulativeMassY?: number[];
}

/**
 * Run modal (eigenvalue) analysis
 */
export async function runModalAnalysis(
    request: ModalRequest
): Promise<ModalResult> {
    const response = await fetch(`${API_BASE}/api/advanced/modal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Modal analysis failed');
    }

    return response.json();
}

// ============================================
// RESPONSE SPECTRUM ANALYSIS
// ============================================

export interface SpectrumCurve {
    period: number;
    acceleration: number;
}

export interface SpectrumRequest {
    nodes: NodeInput[];
    members: MemberInput[];
    supports: SupportInput[];
    masses?: MassInput[];
    numModes?: number;
    spectrum: {
        type: 'IS1893' | 'custom';
        zoneLevel?: 1 | 2 | 3 | 4 | 5;
        soilType?: 'I' | 'II' | 'III';
        dampingRatio?: number;
        importanceFactor?: number;
        responseFactor?: number;
        customCurve?: SpectrumCurve[];
    };
    combinationMethod?: 'CQC' | 'SRSS';
}

export interface SpectrumResult {
    spectrumType: string;
    combinationMethod: string;
    peakAcceleration: number;
    baseShear: number;
    nodalDisplacements: Record<number, { dx: number; dy: number; dz: number }>;
    memberForces?: Record<number, { axial: number; shear: number; moment: number }>;
    storeyDrifts?: Array<{ level: number; drift: number }>;
}

/**
 * Run response spectrum analysis
 */
export async function runSpectrumAnalysis(
    request: SpectrumRequest
): Promise<SpectrumResult> {
    const response = await fetch(`${API_BASE}/api/advanced/spectrum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Response spectrum analysis failed');
    }

    return response.json();
}

// ============================================
// BUCKLING ANALYSIS
// ============================================

export interface BucklingRequest {
    nodes: NodeInput[];
    members: MemberInput[];
    supports: SupportInput[];
    loads: NodalLoadInput[];
    numModes?: number;
}

export interface BucklingResult {
    numModes: number;
    criticalLoadFactors: number[];
    firstBucklingLoad: number | null;
    isStable: boolean;
    bucklingModes?: Array<{
        modeNumber: number;
        factor: number;
        modeShape: Record<number, { dx: number; dy: number; dz: number }>;
    }>;
}

/**
 * Run linear buckling analysis
 */
export async function runBucklingAnalysis(
    request: BucklingRequest
): Promise<BucklingResult> {
    const response = await fetch(`${API_BASE}/api/advanced/buckling`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Buckling analysis failed');
    }

    return response.json();
}

// ============================================
// CABLE ANALYSIS
// ============================================

export interface CableInput {
    memberId: number;
    weight?: number;        // N/m
    pretension?: number;    // kN
    sagRatio?: number;
}

export interface CableRequest {
    nodes: NodeInput[];
    members: MemberInput[];
    supports: SupportInput[];
    cables: CableInput[];
    loads: NodalLoadInput[];
}

export interface CableResult {
    numCables: number;
    cables: Array<{
        memberId: number;
        span: number;
        sag: number;
        cableLength: number;
        sagRatio: number;
        equivalentModulus: number;
        modulusReduction: number;
    }>;
}

/**
 * Run cable/tension-only analysis
 */
export async function runCableAnalysis(
    request: CableRequest
): Promise<CableResult> {
    const response = await fetch(`${API_BASE}/api/advanced/cable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Cable analysis failed');
    }

    return response.json();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get available advanced analysis capabilities
 */
export async function getAdvancedCapabilities(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    endpoint: string;
}>> {
    const response = await fetch(`${API_BASE}/api/advanced/capabilities`);
    const result = await response.json();
    return result.capabilities;
}

/**
 * IS 1893:2016 Zone factors
 */
export const IS1893_ZONE_FACTORS: Record<number, number> = {
    1: 0.10,   // Zone I (Not applicable for design)
    2: 0.10,   // Zone II
    3: 0.16,   // Zone III
    4: 0.24,   // Zone IV
    5: 0.36,   // Zone V
};

/**
 * IS 1893:2016 Soil type descriptions
 */
export const IS1893_SOIL_TYPES = {
    'I': 'Rock or Hard Soil (N > 30)',
    'II': 'Medium Soil (10 < N ≤ 30)',
    'III': 'Soft Soil (N ≤ 10)',
};

/**
 * Convert model from analysis store format to advanced analysis format
 */
export function convertModelForAdvancedAnalysis(
    nodes: Array<{ id: string; x: number; y: number; z: number }>,
    members: Array<{
        id: string;
        startNodeId: string;
        endNodeId: string;
        section?: { A?: number; I?: number; E?: number };
    }>,
    supports: Array<{
        nodeId: string;
        type: string;
    }>
): { nodes: NodeInput[]; members: MemberInput[]; supports: SupportInput[] } {
    // Convert node IDs to numbers
    const nodeIdMap = new Map<string, number>();
    const convertedNodes: NodeInput[] = nodes.map((n, i) => {
        const numId = i + 1;
        nodeIdMap.set(n.id, numId);
        return { id: numId, x: n.x, y: n.y, z: n.z };
    });

    // Convert members
    const convertedMembers: MemberInput[] = members.map((m, i) => ({
        id: i + 1,
        startNode: nodeIdMap.get(m.startNodeId) || 1,
        endNode: nodeIdMap.get(m.endNodeId) || 2,
        E: m.section?.E || 200000,
        A: m.section?.A || 5000,
        I: m.section?.I || 1e7,
    }));

    // Convert supports
    const convertedSupports: SupportInput[] = supports.map((s) => {
        const isFixed = s.type === 'FIXED';
        const isPinned = s.type === 'PINNED';
        return {
            nodeId: nodeIdMap.get(s.nodeId) || 1,
            fx: isFixed || isPinned,
            fy: isFixed || isPinned,
            fz: isFixed || isPinned,
            mx: isFixed,
            my: isFixed,
            mz: isFixed,
        };
    });

    return {
        nodes: convertedNodes,
        members: convertedMembers,
        supports: convertedSupports,
    };
}
