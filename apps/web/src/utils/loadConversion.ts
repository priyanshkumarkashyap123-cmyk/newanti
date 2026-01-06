/**
 * LoadConversion - Convert Member Loads to Equivalent Nodal Loads
 * 
 * Converts distributed member loads (UDL, triangular, trapezoidal) into
 * equivalent concentrated nodal forces and moments using Fixed-End Moment theory.
 * 
 * Reference: Structural Analysis by Hibbeler, Chapter 11
 */

export interface MemberLoad {
    id: string;
    memberId: string;
    type: 'UDL' | 'triangular' | 'trapezoidal' | 'point';
    w1: number;  // Load intensity at start (N/m or kN/m)
    w2?: number; // Load intensity at end (for triangular/trapezoidal)
    direction: string; // 'global_y', 'global_x', 'local_y', etc.
    startPos?: number;  // Position along member (0-1 ratio)
    endPos?: number;    // Position along member (0-1 ratio)
}

export interface NodalLoad {
    nodeId: string;
    fx?: number;
    fy?: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
}

export interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    length?: number;
}

export interface Node {
    id: string;
    x: number;
    y: number;
    z: number;
}

/**
 * Calculate member length from nodes
 */
function calculateMemberLength(startNode: Node, endNode: Node): number {
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const dz = endNode.z - startNode.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Convert a single UDL to equivalent nodal loads
 * 
 * For a uniformly distributed load w (N/m) over length L:
 * - Vertical force at each end: wL/2
 * - Moment at each end: ±wL²/12 (Fixed-End Moments)
 */
function convertUDL(
    memberLoad: MemberLoad,
    member: Member,
    startNode: Node,
    endNode: Node
): NodalLoad[] {
    const L = calculateMemberLength(startNode, endNode);
    const w = memberLoad.w1; // Uniform load intensity

    // Get load span (default full length)
    const a = (memberLoad.startPos || 0) * L;
    const b = (memberLoad.endPos || 1) * L;
    const loadSpan = b - a;

    // Total load
    const totalLoad = w * loadSpan;

    // For UDL at midspan: each reaction = total/2
    // For UDL anywhere: use statics
    const R1 = totalLoad * (L - a - loadSpan / 2) / L;
    const R2 = totalLoad - R1;

    // Fixed-end moments (for fully fixed beam)
    // For UDL over full span: M = wL²/12 at each end
    // For partial span, use general formula
    const M1 = -w * loadSpan * loadSpan / 12; // Negative = counterclockwise
    const M2 = w * loadSpan * loadSpan / 12;  // Positive = clockwise

    const loads: NodalLoad[] = [];

    // Direction mapping (simplified - assumes 2D vertical loads for now)
    const isVertical = memberLoad.direction.includes('y') || memberLoad.direction.includes('Y');

    if (isVertical) {
        loads.push({
            nodeId: member.startNodeId,
            fy: R1,
            mz: M1
        });
        loads.push({
            nodeId: member.endNodeId,
            fy: R2,
            mz: M2
        });
    } else {
        // Horizontal load
        loads.push({
            nodeId: member.startNodeId,
            fx: R1,
            mz: M1
        });
        loads.push({
            nodeId: member.endNodeId,
            fx: R2,
            mz: M2
        });
    }

    return loads;
}

/**
 * Convert a triangular load to equivalent nodal loads
 * 
 * For a triangular load from 0 to w_max over length L:
 * - R1 = w_max * L / 6 (at zero end)
 * - R2 = w_max * L / 3 (at max end)
 */
function convertTriangular(
    memberLoad: MemberLoad,
    member: Member,
    startNode: Node,
    endNode: Node
): NodalLoad[] {
    const L = calculateMemberLength(startNode, endNode);
    const w1 = memberLoad.w1; // Load at start
    const w2 = memberLoad.w2 || memberLoad.w1; // Load at end

    // Total load (area of triangle or trapezoid)
    const totalLoad = (w1 + w2) * L / 2;

    // For triangular load (0 to w_max):
    // Centroid at L/3 from max end
    // R1 = totalLoad * (2L/3) / L = totalLoad * 2/3
    // R2 = totalLoad * (L/3) / L = totalLoad * 1/3

    let R1, R2;
    if (w1 === 0) {
        // Triangle: 0 to w2
        R1 = totalLoad / 3;
        R2 = 2 * totalLoad / 3;
    } else if (w2 === 0) {
        // Triangle: w1 to 0
        R1 = 2 * totalLoad / 3;
        R2 = totalLoad / 3;
    } else {
        // Trapezoidal - break into rectangle + triangle
        const rectLoad = Math.min(w1, w2) * L;
        const triLoad = Math.abs(w2 - w1) * L / 2;

        if (w2 > w1) {
            // Increasing
            R1 = rectLoad / 2 + triLoad / 3;
            R2 = rectLoad / 2 + 2 * triLoad / 3;
        } else {
            // Decreasing
            R1 = rectLoad / 2 + 2 * triLoad / 3;
            R2 = rectLoad / 2 + triLoad / 3;
        }
    }

    const loads: NodalLoad[] = [];
    const isVertical = memberLoad.direction.includes('y') || memberLoad.direction.includes('Y');

    if (isVertical) {
        loads.push({
            nodeId: member.startNodeId,
            fy: R1
        });
        loads.push({
            nodeId: member.endNodeId,
            fy: R2
        });
    } else {
        loads.push({
            nodeId: member.startNodeId,
            fx: R1
        });
        loads.push({
            nodeId: member.endNodeId,
            fx: R2
        });
    }

    return loads;
}

/**
 * Convert all member loads to equivalent nodal loads
 * 
 * @param memberLoads - Array of distributed member loads
 * @param members - Array of members
 * @param nodes - Array of nodes
 * @returns Array of equivalent nodal loads
 */
export function convertMemberLoadsToNodal(
    memberLoads: MemberLoad[],
    members: Member[],
    nodes: Node[]
): NodalLoad[] {
    const nodalLoads: NodalLoad[] = [];

    // Create lookup maps
    const nodeMap = new Map<string, Node>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const memberMap = new Map<string, Member>();
    members.forEach(m => memberMap.set(m.id, m));

    // Convert each member load
    for (const memberLoad of memberLoads) {
        const member = memberMap.get(memberLoad.memberId);
        if (!member) {
            console.warn(`[LoadConversion] Member ${memberLoad.memberId} not found`);
            continue;
        }

        const startNode = nodeMap.get(member.startNodeId);
        const endNode = nodeMap.get(member.endNodeId);

        if (!startNode || !endNode) {
            console.warn(`[LoadConversion] Nodes not found for member ${member.id}`);
            continue;
        }

        let equivalentLoads: NodalLoad[] = [];

        switch (memberLoad.type) {
            case 'UDL':
                equivalentLoads = convertUDL(memberLoad, member, startNode, endNode);
                break;
            case 'triangular':
            case 'trapezoidal':
                equivalentLoads = convertTriangular(memberLoad, member, startNode, endNode);
                break;
            case 'point':
                // Point load on member - convert to nodal loads based on position
                // For now, skip (not common in templates)
                console.warn(`[LoadConversion] Point loads on members not yet implemented`);
                break;
            default:
                console.warn(`[LoadConversion] Unknown load type: ${memberLoad.type}`);
        }

        nodalLoads.push(...equivalentLoads);
    }

    console.log(`[LoadConversion] Converted ${memberLoads.length} member loads to ${nodalLoads.length} nodal loads`);

    return nodalLoads;
}

/**
 * Merge nodal loads (combine loads on the same node)
 */
export function mergeNodalLoads(loads: NodalLoad[]): NodalLoad[] {
    const merged = new Map<string, NodalLoad>();

    for (const load of loads) {
        const existing = merged.get(load.nodeId);

        if (existing) {
            // Add loads
            existing.fx = (existing.fx || 0) + (load.fx || 0);
            existing.fy = (existing.fy || 0) + (load.fy || 0);
            existing.fz = (existing.fz || 0) + (load.fz || 0);
            existing.mx = (existing.mx || 0) + (load.mx || 0);
            existing.my = (existing.my || 0) + (load.my || 0);
            existing.mz = (existing.mz || 0) + (load.mz || 0);
        } else {
            merged.set(load.nodeId, { ...load });
        }
    }

    return Array.from(merged.values());
}
