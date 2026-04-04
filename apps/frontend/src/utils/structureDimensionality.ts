/**
 * structureDimensionality.ts — Auto-detect 2D vs 3D structure
 *
 * Determines the optimal `dofPerNode` (2 | 3 | 6) based on:
 *   1. Node geometry (are all nodes co-planar in Z = const?)
 *   2. Load directions (any out-of-plane loads?)
 *   3. Support conditions (any Fz / Mx / My restraints?)
 *   4. Member orientation (any members with ΔZ ≠ 0?)
 *   5. User-declared element types (truss-only → 2 DOF)
 *
 * This replaces the previous approach where dofPerNode was hard-coded to 3.
 */

// ────────────────────────────────────────────────────
// Types (kept minimal — compatible with store types)
// ────────────────────────────────────────────────────

interface NodeLike {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: {
        fx?: boolean;
        fy?: boolean;
        fz?: boolean;
        mx?: boolean;
        my?: boolean;
        mz?: boolean;
    };
}

interface MemberLike {
    id: string;
    startNodeId: string;
    endNodeId: string;
    type?: string; // 'beam' | 'column' | 'brace' | 'truss' | 'spring' etc.
    I?: number;    // moment of inertia — 0 or missing ⇒ truss
}

interface LoadLike {
    nodeId?: string;
    memberId?: string;
    fx?: number;
    fy?: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
    direction?: string;
}

export interface DimensionalityResult {
    /** Recommended DOF per node */
    dofPerNode: 2 | 3 | 6;
    /** Human-readable classification */
    classification: '2D_TRUSS' | '2D_FRAME' | '3D_FRAME' | '3D_TRUSS';
    /** Is the structure planar? */
    isPlanar: boolean;
    /** Is it truss-only (no bending)? */
    isTrussOnly: boolean;
    /** Explanation for UI display */
    reason: string;
}

const Z_TOLERANCE = 1e-3; // 1 mm

// ────────────────────────────────────────────────────
// Main detection function
// ────────────────────────────────────────────────────

export function detectStructureDimensionality(
    nodes: NodeLike[] | Map<string, NodeLike>,
    members: MemberLike[] | Map<string, MemberLike>,
    loads?: LoadLike[],
): DimensionalityResult {
    const nodeArr = nodes instanceof Map ? Array.from(nodes.values()) : nodes;
    const memberArr = members instanceof Map ? Array.from(members.values()) : members;
    const nodeMap = new Map<string, NodeLike>();
    for (const n of nodeArr) nodeMap.set(n.id, n);

    // ─── Check planarity (all Z ≈ same value) ───
    const zValues = nodeArr.map(n => n.z ?? 0);
    const zMin = Math.min(...zValues);
    const zMax = Math.max(...zValues);
    const isPlanar = (zMax - zMin) < Z_TOLERANCE;

    // ─── Check if any member has out-of-plane span ───
    let hasOutOfPlaneMembers = false;
    for (const m of memberArr) {
        const n1 = nodeMap.get(m.startNodeId);
        const n2 = nodeMap.get(m.endNodeId);
        if (!n1 || !n2) continue;
        const dz = Math.abs((n2.z ?? 0) - (n1.z ?? 0));
        if (dz > Z_TOLERANCE) {
            hasOutOfPlaneMembers = true;
            break;
        }
    }

    // ─── Check out-of-plane loads ───
    let hasOutOfPlaneLoads = false;
    if (loads) {
        for (const l of loads) {
            if ((l.fz && Math.abs(l.fz) > 1e-10) ||
                (l.mx && Math.abs(l.mx) > 1e-10) ||
                (l.my && Math.abs(l.my) > 1e-10)) {
                hasOutOfPlaneLoads = true;
                break;
            }
            // Check member load direction
            if (l.direction && (l.direction.includes('z') || l.direction.includes('Z'))) {
                hasOutOfPlaneLoads = true;
                break;
            }
        }
    }

    // ─── Check out-of-plane restraints ───
    let hasOutOfPlaneRestraints = false;
    for (const n of nodeArr) {
        if (n.restraints) {
            if (n.restraints.fz || n.restraints.mx || n.restraints.my) {
                hasOutOfPlaneRestraints = true;
                break;
            }
        }
    }

    // ─── Check if the structure is truss-only ───
    // A truss has I ≈ 0 or type === 'truss' for all members
    let isTrussOnly = memberArr.length > 0;
    for (const m of memberArr) {
        const isExplicitTruss = m.type === 'truss' || m.type === 'brace';
        const hasNoMomentOfInertia = m.I !== undefined && m.I <= 0;
        if (!isExplicitTruss && !hasNoMomentOfInertia) {
            isTrussOnly = false;
            break;
        }
    }

    // ─── Decide ───
    const is3D = !isPlanar || hasOutOfPlaneMembers || hasOutOfPlaneLoads;

    if (is3D) {
        if (isTrussOnly) {
            return {
                dofPerNode: 3, // 3D truss needs 3 translational DOFs per node
                classification: '3D_TRUSS',
                isPlanar: false,
                isTrussOnly: true,
                reason: '3D truss detected — nodes span multiple Z-planes, members are pin-connected'
            };
        }
        return {
            dofPerNode: 6,
            classification: '3D_FRAME',
            isPlanar: false,
            isTrussOnly: false,
            reason: '3D frame detected — nodes span multiple Z-planes or out-of-plane loads present'
        };
    }

    // Planar structure
    if (isTrussOnly) {
        return {
            dofPerNode: 2,
            classification: '2D_TRUSS',
            isPlanar: true,
            isTrussOnly: true,
            reason: '2D truss detected — all nodes coplanar, all members pin-connected'
        };
    }

    return {
        dofPerNode: 3,
        classification: '2D_FRAME',
        isPlanar: true,
        isTrussOnly: false,
        reason: '2D frame detected — all nodes coplanar in XY-plane'
    };
}

/**
 * Quick helper: given raw model arrays, determine the right dofPerNode.
 * Call this before sending to AnalysisService.
 */
export function getOptimalDofPerNode(
    nodes: NodeLike[] | Map<string, NodeLike>,
    members: MemberLike[] | Map<string, MemberLike>,
    loads?: LoadLike[],
): 2 | 3 | 6 {
    return detectStructureDimensionality(nodes, members, loads).dofPerNode;
}
