/**
 * @deprecated Use `useAnalysis` hook from `apps/web/src/hooks/useAnalysis.ts` instead.
 * This module will be removed after all callers are migrated.
 *
 * advancedAnalysis.ts - Frontend API for Advanced Structural Analysis
 */

import { API_CONFIG } from '../config/env';

const RUST_API = API_CONFIG.rustUrl;
const API_BASE = API_CONFIG.baseUrl;

function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = typeof window !== 'undefined' ? window.localStorage?.getItem('auth_token') : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

export interface NodeInput { id: number; x: number; y: number; z: number; }
export interface MemberInput {
    id: number;
    startNode: number;
    endNode: number;
    E: number;
    A: number;
    I: number;
    J?: number;
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
export interface MassInput { nodeId: number; mass: number; }

export interface PDeltaRequest {
    nodes: NodeInput[];
    members: MemberInput[];
    supports: SupportInput[];
    loads: NodalLoadInput[];
    options?: { maxIterations?: number; tolerance?: number };
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
    frequency: number;
    period: number;
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

export interface SpectrumCurve { period: number; acceleration: number; }
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
    bucklingModes?: Array<{ modeNumber: number; factor: number; modeShape: Record<number, { dx: number; dy: number; dz: number }> }>;
}

export interface CableInput { memberId: number; weight?: number; pretension?: number; sagRatio?: number; }
export interface CableRequest {
    nodes: NodeInput[];
    members: MemberInput[];
    supports: SupportInput[];
    cables: CableInput[];
    loads: NodalLoadInput[];
}
export interface CableResult {
    numCables: number;
    cables: Array<{ memberId: number; span: number; sag: number; cableLength: number; sagRatio: number; equivalentModulus: number; modulusReduction: number }>;
}

function toRustModelPayload(request: {
    nodes: NodeInput[];
    members: MemberInput[];
    supports: SupportInput[];
    loads?: NodalLoadInput[];
}) {
    return {
        nodes: request.nodes.map((n) => ({ id: String(n.id), x: n.x, y: n.y, z: n.z })),
        members: request.members.map((m) => ({
            id: String(m.id),
            startNodeId: String(m.startNode),
            endNodeId: String(m.endNode),
            E: m.E,
            A: m.A,
            I: m.I,
            J: m.J,
            behavior: m.behavior,
        })),
        supports: request.supports.map((s) => ({
            nodeId: String(s.nodeId),
            fx: s.fx,
            fy: s.fy,
            fz: s.fz,
            mx: s.mx,
            my: s.my,
            mz: s.mz,
        })),
        loads: (request.loads || []).map((l) => ({
            nodeId: String(l.nodeId),
            fx: l.fx,
            fy: l.fy,
            fz: l.fz,
            mx: l.mx,
            my: l.my,
            mz: l.mz,
        })),
    };
}

export async function runPDeltaAnalysis(request: PDeltaRequest): Promise<PDeltaResult> {
    const payload = { ...toRustModelPayload(request), max_iterations: request.options?.maxIterations, tolerance: request.options?.tolerance };
    const response = await fetch(`${RUST_API}/api/advanced/pdelta`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'P-Delta analysis failed');
    }
    const data = await response.json();
    return {
        converged: Boolean(data.converged),
        iterations: Number(data.iterations ?? 0),
        amplificationFactor: Number(data.amplification_factor ?? data.amplificationFactor ?? 1),
        maxDisplacement: Number(data.max_displacement ?? data.maxDisplacement ?? 0),
        convergenceHistory: Array.isArray(data.convergence_history) ? data.convergence_history : (Array.isArray(data.convergenceHistory) ? data.convergenceHistory : []),
        displacements: data.displacements,
        memberForces: data.member_forces ?? data.memberForces,
    };
}

export async function runModalAnalysis(request: ModalRequest): Promise<ModalResult> {
    const payload = {
        ...toRustModelPayload(request),
        masses: (request.masses || []).map((m) => ({ node_id: String(m.nodeId), mass: m.mass })),
        num_modes: request.numModes,
        mass_type: request.massType,
    };
    const response = await fetch(`${RUST_API}/api/advanced/modal`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Modal analysis failed');
    }
    const data = await response.json();
    return {
        numModes: Number(data.num_modes ?? data.numModes ?? data.modes?.length ?? 0),
        modes: Array.isArray(data.modes)
            ? data.modes.map((m: any, idx: number) => ({
                modeNumber: Number(m.mode_number ?? m.modeNumber ?? idx + 1),
                frequency: Number(m.frequency_hz ?? m.frequency ?? 0),
                period: Number(m.period_s ?? m.period ?? 0),
                participationFactorX: Number(m.participation_factor_x ?? m.participationFactorX ?? 0),
                participationFactorY: Number(m.participation_factor_y ?? m.participationFactorY ?? 0),
                participationFactorZ: Number(m.participation_factor_z ?? m.participationFactorZ ?? 0),
                effectiveMassX: Number(m.effective_mass_x ?? m.effectiveMassX ?? 0),
                effectiveMassY: Number(m.effective_mass_y ?? m.effectiveMassY ?? 0),
                effectiveMassZ: Number(m.effective_mass_z ?? m.effectiveMassZ ?? 0),
                modeShape: m.mode_shape ?? m.modeShape,
            }))
            : [],
        totalMass: data.total_mass ?? data.totalMass,
        cumulativeMassX: data.cumulative_mass_x ?? data.cumulativeMassX,
        cumulativeMassY: data.cumulative_mass_y ?? data.cumulativeMassY,
    };
}

export async function runSpectrumAnalysis(request: SpectrumRequest): Promise<SpectrumResult> {
    const payload = {
        ...toRustModelPayload(request),
        masses: (request.masses || []).map((m) => ({ node_id: String(m.nodeId), mass: m.mass })),
        num_modes: request.numModes,
        spectrum: {
            spectrum_type: request.spectrum.type,
            zone_factor: request.spectrum.zoneLevel ? IS1893_ZONE_FACTORS[request.spectrum.zoneLevel] : undefined,
            soil_type: request.spectrum.soilType,
            damping_ratio: request.spectrum.dampingRatio,
            importance_factor: request.spectrum.importanceFactor,
        },
        combination_method: request.combinationMethod,
    };
    const response = await fetch(`${RUST_API}/api/advanced/spectrum`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Response spectrum analysis failed');
    }
    const data = await response.json();
    return {
        spectrumType: data.spectrum_type ?? data.spectrumType ?? request.spectrum.type,
        combinationMethod: data.combination_method ?? data.combinationMethod ?? request.combinationMethod ?? 'CQC',
        peakAcceleration: Number(data.peak_acceleration ?? data.peakAcceleration ?? 0),
        baseShear: Number(data.base_shear ?? data.baseShear ?? 0),
        nodalDisplacements: data.displacements ?? data.nodal_displacements ?? data.nodalDisplacements ?? {},
        memberForces: data.member_forces ?? data.memberForces,
        storeyDrifts: data.story_drifts ?? data.storey_drifts ?? data.storeyDrifts,
    };
}

export async function runBucklingAnalysis(request: BucklingRequest): Promise<BucklingResult> {
    const payload = { ...toRustModelPayload(request), num_modes: request.numModes };
    const response = await fetch(`${RUST_API}/api/advanced/buckling`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Buckling analysis failed');
    }
    const data = await response.json();
    return {
        numModes: Number(data.num_modes ?? data.numModes ?? data.buckling_modes?.length ?? 0),
        criticalLoadFactors: Array.isArray(data.buckling_modes)
            ? data.buckling_modes.map((m: any) => Number(m.load_factor ?? m.factor ?? 0))
            : (Array.isArray(data.critical_load_factors) ? data.critical_load_factors : (data.criticalLoadFactors || [])),
        firstBucklingLoad: data.critical_load_factor ?? data.firstBucklingLoad ?? null,
        isStable: Boolean(data.is_stable ?? data.isStable ?? true),
        bucklingModes: Array.isArray(data.buckling_modes)
            ? data.buckling_modes.map((m: any, i: number) => ({
                modeNumber: Number(m.mode_number ?? i + 1),
                factor: Number(m.load_factor ?? m.factor ?? 0),
                modeShape: m.mode_shape ?? {},
            }))
            : undefined,
    };
}

export async function runCableAnalysis(request: CableRequest): Promise<CableResult> {
    const response = await fetch(`${API_BASE}/api/advanced/cable`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(request) });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Cable analysis failed');
    }
    return response.json();
}

export async function getAdvancedCapabilities(): Promise<Array<{ id: string; name: string; description: string; endpoint: string }>> {
    const response = await fetch(`${RUST_API}/api/advanced/capabilities`, { headers: getHeaders() });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Failed to fetch capabilities');
    }
    const result = await response.json();
    return result.capabilities;
}

export const IS1893_ZONE_FACTORS: Record<number, number> = {
    1: 0.10,
    2: 0.10,
    3: 0.16,
    4: 0.24,
    5: 0.36,
};

export const IS1893_SOIL_TYPES = {
    'I': 'Rock or Hard Soil (N > 30)',
    'II': 'Medium Soil (10 < N ≤ 30)',
    'III': 'Soft Soil (N ≤ 10)',
};

export function convertModelForAdvancedAnalysis(
    nodes: Array<{ id: string; x: number; y: number; z: number }>,
    members: Array<{ id: string; startNodeId: string; endNodeId: string; section?: { A?: number; I?: number; E?: number } }>,
    supports: Array<{ nodeId: string; type: string }>,
): { nodes: NodeInput[]; members: MemberInput[]; supports: SupportInput[] } {
    const nodeIdMap = new Map<string, number>();
    const convertedNodes: NodeInput[] = nodes.map((n, i) => {
        const numId = i + 1;
        nodeIdMap.set(n.id, numId);
        return { id: numId, x: n.x, y: n.y, z: n.z };
    });

    const convertedMembers: MemberInput[] = members.map((m, i) => ({
        id: i + 1,
        startNode: nodeIdMap.get(m.startNodeId) || 1,
        endNode: nodeIdMap.get(m.endNodeId) || 2,
        E: m.section?.E || 200000,
        A: m.section?.A || 5000,
        I: m.section?.I || 1e7,
    }));

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

    return { nodes: convertedNodes, members: convertedMembers, supports: convertedSupports };
}
