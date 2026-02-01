/**
 * Structural Analysis Solver - 3D Frame Analysis with Advanced Element Theories
 * 
 * Implements the Direct Stiffness Method for 3D space frames:
 * - 6 DOFs per node: dx, dy, dz, rx, ry, rz
 * - Full 12x12 beam-column element stiffness
 * - Euler-Bernoulli (default) or Timoshenko beam theory
 * - Coordinate transformation for arbitrarily oriented members
 * - Matrix caching for improved performance
 * - Performance metrics tracking
 * 
 * Theory Reference:
 *   [K]global = [T]^T · [K]local · [T]
 *   
 *   For Timoshenko beams, shear flexibility parameter:
 *   Φ = 12·E·I / (κ·G·A·L²)
 *   
 *   When Φ > 0.1, shear deformation is significant (deep beams, L/d < 10)
 * 
 * @author BeamLab Engineering
 */

import * as math from 'mathjs';

// ============================================
// PERFORMANCE MONITORING
// ============================================

export interface PerformanceMetrics {
    assemblyTimeMs: number;
    solveTimeMs: number;
    postProcessTimeMs: number;
    totalTimeMs: number;
    matrixSize: number;
    sparsity: number;
    cacheHits: number;
    cacheMisses: number;
}

let lastPerformanceMetrics: PerformanceMetrics = {
    assemblyTimeMs: 0,
    solveTimeMs: 0,
    postProcessTimeMs: 0,
    totalTimeMs: 0,
    matrixSize: 0,
    sparsity: 0,
    cacheHits: 0,
    cacheMisses: 0
};

export function getLastPerformanceMetrics(): PerformanceMetrics {
    return { ...lastPerformanceMetrics };
}

// ============================================
// MEMBER STIFFNESS CACHE
// ============================================

const memberStiffnessCache = new Map<string, number[][]>();
const MAX_CACHE_SIZE = 1000;

function getCachedMemberStiffness(key: string): number[][] | undefined {
    const cached = memberStiffnessCache.get(key);
    if (cached) {
        lastPerformanceMetrics.cacheHits++;
        return cached;
    }
    lastPerformanceMetrics.cacheMisses++;
    return undefined;
}

function setCachedMemberStiffness(key: string, matrix: number[][]): void {
    if (memberStiffnessCache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entry (FIFO)
        const firstKey = memberStiffnessCache.keys().next().value;
        if (firstKey) memberStiffnessCache.delete(firstKey);
    }
    memberStiffnessCache.set(key, matrix);
}

function generateMemberCacheKey(material: Material, section: Section, L: number, theory: BeamTheory): string {
    return `${material.E.toFixed(0)}_${section.A.toFixed(6)}_${section.Iy.toFixed(8)}_${section.Iz.toFixed(8)}_${section.J.toFixed(8)}_${L.toFixed(6)}_${theory}`;
}

export function clearSolverCache(): void {
    memberStiffnessCache.clear();
}

export function getSolverCacheStats(): { size: number; maxSize: number } {
    return { size: memberStiffnessCache.size, maxSize: MAX_CACHE_SIZE };
}

// ============================================
// ENUMS & INTERFACES
// ============================================

export enum BeamTheory {
    EULER_BERNOULLI = 'euler_bernoulli',
    TIMOSHENKO = 'timoshenko'
}

export interface Node3D {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: {
        dx: boolean; dy: boolean; dz: boolean;
        rx: boolean; ry: boolean; rz: boolean;
    };
}

export interface Material {
    E: number;    // Young's modulus (kN/m² or Pa)
    G?: number;   // Shear modulus (if not provided, calculated from E and nu)
    nu?: number;  // Poisson's ratio (default 0.3)
    rho?: number; // Density (kg/m³)
}

export interface Section {
    A: number;    // Cross-sectional area (m²)
    Iy: number;   // Moment of inertia about local y (m⁴)
    Iz: number;   // Moment of inertia about local z (m⁴)
    J: number;    // Torsional constant (m⁴)
    // Shear correction factors for Timoshenko (default 5/6)
    kappaY?: number;
    kappaZ?: number;
}

export interface Member3D {
    id: string;
    startNodeId: string;
    endNodeId: string;
    material: Material;
    section: Section;
    theory?: BeamTheory;  // Default EULER_BERNOULLI
}

export interface NodeLoad {
    id: string;
    nodeId: string;
    fx?: number; fy?: number; fz?: number;
    mx?: number; my?: number; mz?: number;
}

export interface AnalysisRequest3D {
    nodes: Node3D[];
    members: Member3D[];
    loads: NodeLoad[];
    options?: {
        defaultTheory?: BeamTheory;
    };
}

export interface Displacement3D {
    dx: number; dy: number; dz: number;
    rx: number; ry: number; rz: number;
}

export interface Reaction3D {
    fx: number; fy: number; fz: number;
    mx: number; my: number; mz: number;
}

export interface MemberForces3D {
    // Forces at start node (local coordinates)
    axialStart: number;
    shearYStart: number;
    shearZStart: number;
    torsionStart: number;
    momentYStart: number;
    momentZStart: number;
    // Forces at end node
    axialEnd: number;
    shearYEnd: number;
    shearZEnd: number;
    torsionEnd: number;
    momentYEnd: number;
    momentZEnd: number;
}

export interface AnalysisResult3D {
    displacements: Record<string, Displacement3D>;
    reactions: Record<string, Reaction3D>;
    memberForces: Record<string, MemberForces3D>;
    warnings: string[];
    success: boolean;
    message: string;
    performanceMetrics?: PerformanceMetrics;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate shear modulus from E and Poisson's ratio
 */
function getShearModulus(E: number, nu: number = 0.3): number {
    return E / (2 * (1 + nu));
}

/**
 * Calculate member length
 */
function getMemberLength(startNode: Node3D, endNode: Node3D): number {
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const dz = endNode.z - startNode.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate shear flexibility parameter Φ
 * 
 * Φ = 12·E·I / (G·As·L²)
 * 
 * For Euler-Bernoulli: Φ = 0
 * For deep beams (Φ > 0.1): Timoshenko recommended
 */
function getShearFlexibility(
    E: number, I: number, G: number, kappa: number, A: number, L: number,
    theory: BeamTheory
): number {
    if (theory === BeamTheory.EULER_BERNOULLI) return 0;

    const As = kappa * A;  // Effective shear area
    if (G * As * L * L < 1e-20) return 0;

    return (12 * E * I) / (G * As * L * L);
}

// ============================================
// STIFFNESS MATRIX FUNCTIONS
// ============================================

/**
 * Build 12x12 local stiffness matrix for 3D beam-column element
 * 
 * DOF order: [dx1, dy1, dz1, rx1, ry1, rz1, dx2, dy2, dz2, rx2, ry2, rz2]
 * 
 * Supports both Euler-Bernoulli and Timoshenko beam theories.
 */
function getLocalStiffnessMatrix3D(
    material: Material,
    section: Section,
    L: number,
    theory: BeamTheory
): number[][] {
    const E = material.E;
    const G = material.G ?? getShearModulus(E, material.nu ?? 0.3);
    const A = section.A;
    const Iy = section.Iy;
    const Iz = section.Iz;
    const J = section.J;
    const kappaY = section.kappaY ?? (5 / 6);
    const kappaZ = section.kappaZ ?? (5 / 6);

    // ===== SHEAR FLEXIBILITY PARAMETERS =====
    const PhiY = getShearFlexibility(E, Iz, G, kappaY, A, L, theory);  // Bending about z
    const PhiZ = getShearFlexibility(E, Iy, G, kappaZ, A, L, theory);  // Bending about y

    // ===== STIFFNESS COEFFICIENTS =====
    const EA_L = E * A / L;
    const GJ_L = G * J / L;

    // Bending about z-axis (displacement in y)
    const denomY = 1 + PhiY;
    const a1 = 12 * E * Iz / (L * L * L * denomY);
    const a2 = 6 * E * Iz / (L * L * denomY);
    const a3 = (4 + PhiY) * E * Iz / (L * denomY);
    const a4 = (2 - PhiY) * E * Iz / (L * denomY);

    // Bending about y-axis (displacement in z)
    const denomZ = 1 + PhiZ;
    const b1 = 12 * E * Iy / (L * L * L * denomZ);
    const b2 = 6 * E * Iy / (L * L * denomZ);
    const b3 = (4 + PhiZ) * E * Iy / (L * denomZ);
    const b4 = (2 - PhiZ) * E * Iy / (L * denomZ);

    // ===== BUILD 12x12 MATRIX =====
    const K: number[][] = Array(12).fill(null).map(() => Array(12).fill(0));

    // Axial (u)
    K[0][0] = EA_L; K[0][6] = -EA_L;
    K[6][0] = -EA_L; K[6][6] = EA_L;

    // Bending in XY plane (v, θz)
    K[1][1] = a1; K[1][5] = a2; K[1][7] = -a1; K[1][11] = a2;
    K[5][1] = a2; K[5][5] = a3; K[5][7] = -a2; K[5][11] = a4;
    K[7][1] = -a1; K[7][5] = -a2; K[7][7] = a1; K[7][11] = -a2;
    K[11][1] = a2; K[11][5] = a4; K[11][7] = -a2; K[11][11] = a3;

    // Bending in XZ plane (w, θy)
    K[2][2] = b1; K[2][4] = -b2; K[2][8] = -b1; K[2][10] = -b2;
    K[4][2] = -b2; K[4][4] = b3; K[4][8] = b2; K[4][10] = b4;
    K[8][2] = -b1; K[8][4] = b2; K[8][8] = b1; K[8][10] = b2;
    K[10][2] = -b2; K[10][4] = b4; K[10][8] = b2; K[10][10] = b3;

    // Torsion (θx)
    K[3][3] = GJ_L; K[3][9] = -GJ_L;
    K[9][3] = -GJ_L; K[9][9] = GJ_L;

    return K;
}

/**
 * Build 12x12 transformation matrix from local to global coordinates
 * 
 * Local x-axis: along member
 * Local y-axis: perpendicular (horizontal if possible)
 * Local z-axis: completes right-hand system
 */
function getTransformationMatrix3D(startNode: Node3D, endNode: Node3D): number[][] {
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const dz = endNode.z - startNode.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (L < 1e-10) {
        return Array(12).fill(null).map((_, i) =>
            Array(12).fill(0).map((_, j) => i === j ? 1 : 0)
        );
    }

    // Local x-axis (along member)
    const localX = [dx / L, dy / L, dz / L];

    // Choose reference vector based on member orientation
    let ref: number[];
    if (Math.abs(localX[1]) > 0.999) {
        // Nearly vertical member, use global X
        ref = [1, 0, 0];
    } else {
        // Use global Y (up)
        ref = [0, 1, 0];
    }

    // Local z = localX × ref
    let localZ = [
        localX[1] * ref[2] - localX[2] * ref[1],
        localX[2] * ref[0] - localX[0] * ref[2],
        localX[0] * ref[1] - localX[1] * ref[0]
    ];
    const normZ = Math.sqrt(localZ[0] ** 2 + localZ[1] ** 2 + localZ[2] ** 2);
    localZ = localZ.map(v => v / normZ);

    // Local y = localZ × localX
    const localY = [
        localZ[1] * localX[2] - localZ[2] * localX[1],
        localZ[2] * localX[0] - localZ[0] * localX[2],
        localZ[0] * localX[1] - localZ[1] * localX[0]
    ];

    // 3x3 rotation matrix
    const R = [localX, localY, localZ];

    // Build 12x12 transformation matrix
    const T: number[][] = Array(12).fill(null).map(() => Array(12).fill(0));

    for (let block = 0; block < 4; block++) {
        const offset = block * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                T[offset + i][offset + j] = R[i][j];
            }
        }
    }

    return T;
}

// ============================================
// MAIN SOLVER
// ============================================

/**
 * Analyze 3D frame structure using Direct Stiffness Method
 * 
 * Solves: [K]{d} = {F}
 * 
 * @param request - Analysis request with nodes, members, and loads
 * @returns Analysis results with displacements, reactions, and member forces
 */
export function analyzeStructure3D(request: AnalysisRequest3D): AnalysisResult3D {
    const startTime = performance.now();
    const { nodes, members, loads, options } = request;
    const defaultTheory = options?.defaultTheory ?? BeamTheory.EULER_BERNOULLI;
    const warnings: string[] = [];

    // Reset performance metrics
    lastPerformanceMetrics = {
        assemblyTimeMs: 0,
        solveTimeMs: 0,
        postProcessTimeMs: 0,
        totalTimeMs: 0,
        matrixSize: 0,
        sparsity: 0,
        cacheHits: 0,
        cacheMisses: 0
    };

    // ===== VALIDATION =====
    if (nodes.length < 2) {
        return {
            displacements: {}, reactions: {}, memberForces: {},
            warnings: [], success: false, message: 'Need at least 2 nodes'
        };
    }
    if (members.length < 1) {
        return {
            displacements: {}, reactions: {}, memberForces: {},
            warnings: [], success: false, message: 'Need at least 1 member'
        };
    }

    // ===== NODE INDEX MAPPING =====
    const nodeIndexMap = new Map<string, number>();
    nodes.forEach((node, idx) => nodeIndexMap.set(node.id, idx));

    const numNodes = nodes.length;
    const dofsPerNode = 6;
    const totalDofs = numNodes * dofsPerNode;

    lastPerformanceMetrics.matrixSize = totalDofs;

    // ===== INITIALIZE GLOBAL MATRICES =====
    const assemblyStart = performance.now();
    const K: number[][] = Array(totalDofs).fill(null).map(() => Array(totalDofs).fill(0));
    const F: number[] = Array(totalDofs).fill(0);

    // ===== ASSEMBLE GLOBAL STIFFNESS MATRIX =====
    for (const member of members) {
        const startIdx = nodeIndexMap.get(member.startNodeId);
        const endIdx = nodeIndexMap.get(member.endNodeId);
        if (startIdx === undefined || endIdx === undefined) {
            warnings.push(`Member ${member.id}: Node not found`);
            continue;
        }

        const startNode = nodes[startIdx];
        const endNode = nodes[endIdx];
        if (!startNode || !endNode) continue;

        const L = getMemberLength(startNode, endNode);
        if (L < 1e-10) {
            warnings.push(`Member ${member.id}: Zero length`);
            continue;
        }

        // Determine beam theory (check L/d ratio)
        const theory = member.theory ?? defaultTheory;
        const effectiveDepth = Math.sqrt(12 * member.section.Iz / member.section.A);
        const LoverD = L / effectiveDepth;

        if (theory === BeamTheory.EULER_BERNOULLI && LoverD < 10) {
            warnings.push(
                `Member ${member.id}: L/d = ${LoverD.toFixed(1)} < 10. ` +
                `Consider using Timoshenko theory for better accuracy.`
            );
        }

        // Build local stiffness matrix (with caching)
        const cacheKey = generateMemberCacheKey(member.material, member.section, L, theory);
        let kLocal = getCachedMemberStiffness(cacheKey);
        if (!kLocal) {
            kLocal = getLocalStiffnessMatrix3D(member.material, member.section, L, theory);
            setCachedMemberStiffness(cacheKey, kLocal);
        }

        // Get transformation matrix
        const T = getTransformationMatrix3D(startNode, endNode);

        // Transform to global: K_global = T^T * K_local * T
        const TT = math.transpose(T) as number[][];
        const kGlobal = math.multiply(math.multiply(TT, kLocal), T) as number[][];

        // DOF indices for this element
        const dofs: number[] = [];
        for (let i = 0; i < 6; i++) dofs.push(startIdx * 6 + i);
        for (let i = 0; i < 6; i++) dofs.push(endIdx * 6 + i);

        // Assemble into global matrix
        for (let i = 0; i < 12; i++) {
            for (let j = 0; j < 12; j++) {
                const di = dofs[i];
                const dj = dofs[j];
                if (di !== undefined && dj !== undefined) {
                    K[di]![dj]! += kGlobal[i]![j]!;
                }
            }
        }
    }

    lastPerformanceMetrics.assemblyTimeMs = performance.now() - assemblyStart;

    // ===== APPLY LOADS =====
    for (const load of loads) {
        const nodeIdx = nodeIndexMap.get(load.nodeId);
        if (nodeIdx === undefined) continue;

        const baseDof = nodeIdx * dofsPerNode;
        F[baseDof + 0] += load.fx ?? 0;
        F[baseDof + 1] += load.fy ?? 0;
        F[baseDof + 2] += load.fz ?? 0;
        F[baseDof + 3] += load.mx ?? 0;
        F[baseDof + 4] += load.my ?? 0;
        F[baseDof + 5] += load.mz ?? 0;
    }

    // ===== IDENTIFY RESTRAINED DOFs =====
    const restrainedDofs: number[] = [];
    const freeDofs: number[] = [];

    for (let i = 0; i < numNodes; i++) {
        const node = nodes[i]!;
        const baseDof = i * dofsPerNode;
        const r = node.restraints ?? { dx: false, dy: false, dz: false, rx: false, ry: false, rz: false };

        if (r.dx) restrainedDofs.push(baseDof + 0); else freeDofs.push(baseDof + 0);
        if (r.dy) restrainedDofs.push(baseDof + 1); else freeDofs.push(baseDof + 1);
        if (r.dz) restrainedDofs.push(baseDof + 2); else freeDofs.push(baseDof + 2);
        if (r.rx) restrainedDofs.push(baseDof + 3); else freeDofs.push(baseDof + 3);
        if (r.ry) restrainedDofs.push(baseDof + 4); else freeDofs.push(baseDof + 4);
        if (r.rz) restrainedDofs.push(baseDof + 5); else freeDofs.push(baseDof + 5);
    }

    // ===== CHECK STABILITY =====
    if (restrainedDofs.length < 6) {
        return {
            displacements: {}, reactions: {}, memberForces: {},
            warnings, success: false,
            message: 'Structure unstable: need at least 6 restrained DOFs for 3D'
        };
    }

    // ===== EXTRACT REDUCED SYSTEM =====
    const nFree = freeDofs.length;
    const Kff: number[][] = Array(nFree).fill(null).map(() => Array(nFree).fill(0));
    const Ff: number[] = Array(nFree).fill(0);

    for (let i = 0; i < nFree; i++) {
        Ff[i] = F[freeDofs[i]!]!;
        for (let j = 0; j < nFree; j++) {
            Kff[i]![j] = K[freeDofs[i]!]![freeDofs[j]!]!;
        }
    }

    // Calculate sparsity
    let nnz = 0;
    for (let i = 0; i < nFree; i++) {
        for (let j = 0; j < nFree; j++) {
            if (Math.abs(Kff[i]![j]!) > 1e-14) nnz++;
        }
    }
    lastPerformanceMetrics.sparsity = 1 - (nnz / (nFree * nFree));

    // ===== SOLVE FOR DISPLACEMENTS =====
    const solveStart = performance.now();
    let Uf: number[];
    try {
        const solution = math.lusolve(Kff, Ff) as number[][];
        Uf = solution.map(row => row[0] ?? 0);
    } catch {
        return {
            displacements: {}, reactions: {}, memberForces: {},
            warnings, success: false,
            message: 'Matrix singular - structure may be unstable or mechanism'
        };
    }
    lastPerformanceMetrics.solveTimeMs = performance.now() - solveStart;

    // ===== BUILD FULL DISPLACEMENT VECTOR =====
    const postProcessStart = performance.now();
    const U: number[] = Array(totalDofs).fill(0);
    for (let i = 0; i < freeDofs.length; i++) {
        U[freeDofs[i]!] = Uf[i]!;
    }

    // ===== CALCULATE REACTIONS =====
    const R = math.subtract(math.multiply(K, U), F) as number[];

    // ===== BUILD RESULT OBJECTS =====
    const displacements: Record<string, Displacement3D> = {};
    const reactions: Record<string, Reaction3D> = {};

    for (const node of nodes) {
        const idx = nodeIndexMap.get(node.id)!;
        const baseDof = idx * dofsPerNode;

        displacements[node.id] = {
            dx: U[baseDof + 0]!,
            dy: U[baseDof + 1]!,
            dz: U[baseDof + 2]!,
            rx: U[baseDof + 3]!,
            ry: U[baseDof + 4]!,
            rz: U[baseDof + 5]!
        };

        // Report reactions at restrained nodes
        const r = node.restraints;
        if (r?.dx || r?.dy || r?.dz || r?.rx || r?.ry || r?.rz) {
            reactions[node.id] = {
                fx: R[baseDof + 0]!,
                fy: R[baseDof + 1]!,
                fz: R[baseDof + 2]!,
                mx: R[baseDof + 3]!,
                my: R[baseDof + 4]!,
                mz: R[baseDof + 5]!
            };
        }
    }

    // ===== CALCULATE MEMBER FORCES =====
    const memberForces: Record<string, MemberForces3D> = {};

    for (const member of members) {
        const startIdx = nodeIndexMap.get(member.startNodeId);
        const endIdx = nodeIndexMap.get(member.endNodeId);
        if (startIdx === undefined || endIdx === undefined) continue;

        const startNode = nodes[startIdx]!;
        const endNode = nodes[endIdx]!;
        const L = getMemberLength(startNode, endNode);
        if (L < 1e-10) continue;

        const theory = member.theory ?? defaultTheory;

        // Get element displacements (global)
        const uGlobal: number[] = [];
        for (let i = 0; i < 6; i++) uGlobal.push(U[startIdx * 6 + i]!);
        for (let i = 0; i < 6; i++) uGlobal.push(U[endIdx * 6 + i]!);

        // Transform to local
        const T = getTransformationMatrix3D(startNode, endNode);
        const uLocal = math.multiply(T, uGlobal) as number[];

        // Get local stiffness and calculate forces
        const kLocal = getLocalStiffnessMatrix3D(member.material, member.section, L, theory);
        const fLocal = math.multiply(kLocal, uLocal) as number[];

        memberForces[member.id] = {
            axialStart: -fLocal[0]!,      // Tension positive
            shearYStart: fLocal[1]!,
            shearZStart: fLocal[2]!,
            torsionStart: fLocal[3]!,
            momentYStart: fLocal[4]!,
            momentZStart: fLocal[5]!,
            axialEnd: fLocal[6]!,
            shearYEnd: fLocal[7]!,
            shearZEnd: fLocal[8]!,
            torsionEnd: fLocal[9]!,
            momentYEnd: fLocal[10]!,
            momentZEnd: fLocal[11]!
        };
    }

    // Finalize performance metrics
    lastPerformanceMetrics.postProcessTimeMs = performance.now() - postProcessStart;
    lastPerformanceMetrics.totalTimeMs = performance.now() - startTime;

    return {
        displacements,
        reactions,
        memberForces,
        warnings,
        success: true,
        message: `Analysis completed: ${nodes.length} nodes, ${members.length} members, ${freeDofs.length} DOFs`,
        performanceMetrics: lastPerformanceMetrics
    };
}

// ============================================
// LEGACY 2D SOLVER (BACKWARDS COMPATIBILITY)
// ============================================

// Re-export original 2D interfaces and functions for backwards compatibility
export { analyzeStructure } from './solver.js';
